const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/auth");
const Conversation = require("../models/Conversation.model");
const Message = require("../models/Message.model");
const User = require("../models/User.model");
const UserConversationState = require("../models/UserConversationState.model");
const Sentiment = require("sentiment");
const sentiment = new Sentiment();

const router = express.Router();

const userExists = async (userId) => {
  const user = await User.findById(userId).select("_id");
  return !!user;
};

// ==================== CONVERSATIONS ====================
router.get("/conversations", authMiddleware, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate("participants", "username email avatar")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    const convWithState = await Promise.all(conversations.map(async (conv) => {
      const state = await UserConversationState.findOne({
        user: req.user._id,
        conversation: conv._id
      });
      if (state?.deletedAt) return null;
      return {
        ...conv.toObject(),
        clearedAt: state?.clearedAt || null,
      };
    }));

    const filtered = convWithState.filter(c => c !== null);
    res.json({ success: true, data: filtered });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/conversations", authMiddleware, async (req, res) => {
  try {
    const { participantId } = req.body;
    if (!participantId) {
      return res.status(400).json({ success: false, message: "Participant ID is required" });
    }
    if (participantId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "Cannot create conversation with yourself" });
    }

    const participantExists = await userExists(participantId);
    if (!participantExists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, participantId] },
    }).populate("participants", "username email avatar");

    if (conversation) {
      await UserConversationState.updateOne(
        { user: req.user._id, conversation: conversation._id },
        { $set: { deletedAt: null } },
        { upsert: true }
      );
      return res.json({ success: true, data: conversation });
    }

    conversation = await Conversation.create({
      participants: [req.user._id, participantId],
    });
    conversation = await conversation.populate("participants", "username email avatar");

    const io = req.app.get("io");
    io.to(participantId.toString()).emit("newConversation", conversation);

    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/conversations/group", authMiddleware, async (req, res) => {
  try {
    let { name, participants } = req.body;
    if (!name || !participants || !Array.isArray(participants) || participants.length < 1) {
      return res.status(400).json({
        success: false,
        message: "Group name and at least one participant (array) are required",
      });
    }
    const uniqueParticipantIds = [...new Set([req.user._id.toString(), ...participants])];
    const existingUsers = await User.find({ _id: { $in: uniqueParticipantIds } }).select("_id");
    const existingIds = existingUsers.map((u) => u._id.toString());
    const invalidIds = uniqueParticipantIds.filter((id) => !existingIds.includes(id));
    if (invalidIds.length) {
      return res.status(400).json({
        success: false,
        message: `Invalid participant IDs: ${invalidIds.join(", ")}`,
      });
    }
    const conversation = await Conversation.create({
      participants: existingIds,
      isGroup: true,
      groupName: name,
      groupAdmin: req.user._id,
    });
    const fullConversation = await conversation.populate("participants", "username email avatar");
    const io = req.app.get("io");
    existingIds.forEach((userId) => {
      io.to(userId.toString()).emit("newConversation", fullConversation);
    });
    res.status(201).json({ success: true, data: fullConversation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== MESSAGES ====================
router.get("/conversations/:id/messages", authMiddleware, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    if (!conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const state = await UserConversationState.findOne({
      user: req.user._id,
      conversation: conversationId
    });
    const clearedAt = state?.clearedAt || null;
    let query = { conversation: conversationId };
    if (clearedAt) {
      query.createdAt = { $gt: clearedAt };
    }
    const messages = await Message.find(query)
      .populate("sender", "username email avatar")
      .sort({ createdAt: 1 });
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/conversations/:id/messages", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    const conversationId = req.params.id;
    if (!text || text.trim() === "") {
      return res.status(400).json({ success: false, message: "Message text cannot be empty" });
    }
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    if (!conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const result = sentiment.analyze(text.trim());
    const score = result.comparative;
    let label = "neutral";
    if (score > 0.2) label = "positive";
    else if (score < -0.2) label = "negative";

    const message = await Message.create({
      sender: req.user._id,
      conversation: conversationId,
      text: text.trim(),
      sentiment: { score, label },
    });
    const populatedMessage = await message.populate("sender", "username email avatar");

    conversation.lastMessage = message._id;
    await conversation.save();

    const io = req.app.get("io");
    conversation.participants.forEach((participantId) => {
      io.to(participantId.toString()).emit("newMessage", populatedMessage);
    });

    res.status(201).json({ success: true, data: populatedMessage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// File upload
const uploadChat = require("../middleware/uploadChat");
router.post("/upload", authMiddleware, uploadChat.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const fileUrl = `/uploads/chat/${req.file.filename}`;
    let fileType = "document";
    if (req.file.mimetype.startsWith("image/")) fileType = "image";
    else if (req.file.mimetype.startsWith("video/")) fileType = "video";
    else if (req.file.mimetype.startsWith("audio/")) fileType = "audio";
    res.json({
      success: true,
      data: { fileUrl, fileType, fileName: req.file.originalname },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete message
router.delete("/messages/:id", authMiddleware, async (req, res) => {
  try {
    const messageId = req.params.id;
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    await message.deleteOne();
    const conversation = await Conversation.findById(message.conversation);
    if (conversation) {
      const io = req.app.get("io");
      conversation.participants.forEach((participantId) => {
        io.to(participantId.toString()).emit("messageDeleted", {
          messageId,
          conversationId: conversation._id,
        });
      });
    }
    res.json({ success: true, message: "Message deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Forward message
router.post("/messages/:id/forward", authMiddleware, async (req, res) => {
  try {
    const messageId = req.params.id;
    const { targetConversationId } = req.body;
    if (!targetConversationId) {
      return res.status(400).json({ success: false, message: "Target conversation ID required" });
    }
    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    if (originalMessage.conversation.toString() === targetConversationId) {
      return res.status(400).json({ success: false, message: "Cannot forward to same conversation" });
    }
    const targetConv = await Conversation.findById(targetConversationId);
    if (!targetConv || !targetConv.participants.includes(req.user._id)) {
      return res.status(403).json({ success: false, message: "Not a participant of target conversation" });
    }
    const forwardedMessage = await Message.create({
      sender: req.user._id,
      conversation: targetConversationId,
      text: originalMessage.text,
      fileUrl: originalMessage.fileUrl,
      fileType: originalMessage.fileType,
      fileName: originalMessage.fileName,
      isForwarded: true,
      sentiment: { score: 0, label: "neutral" },
    });
    const populated = await forwardedMessage.populate("sender", "username email avatar");
    targetConv.lastMessage = forwardedMessage._id;
    await targetConv.save();
    const io = req.app.get("io");
    targetConv.participants.forEach((pid) => {
      io.to(pid.toString()).emit("newMessage", populated);
    });
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clear chat (per user)
router.delete("/conversations/:id/messages", authMiddleware, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    if (!conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ success: false, message: "Not a participant" });
    }

    await UserConversationState.findOneAndUpdate(
      { user: req.user._id, conversation: conversationId },
      { clearedAt: new Date() },
      { upsert: true, new: true }
    );

    const io = req.app.get("io");
    io.to(req.user._id.toString()).emit("chatCleared", { conversationId });

    res.json({ success: true, message: "Chat cleared for you" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete contact (soft delete + clear chat)
router.delete("/conversations/:id/contact", authMiddleware, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || conversation.isGroup) {
      return res.status(404).json({ success: false, message: "Conversation not found or is a group" });
    }
    if (!conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ success: false, message: "Not a participant" });
    }

    await UserConversationState.findOneAndUpdate(
      { user: req.user._id, conversation: conversationId },
      { deletedAt: new Date(), clearedAt: new Date() },
      { upsert: true, new: true }
    );

    const io = req.app.get("io");
    io.to(req.user._id.toString()).emit("conversationRemoved", { conversationId });

    res.json({ success: true, message: "Contact deleted and chat cleared" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;