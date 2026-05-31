// server/routes/chat.route.js
const express = require("express");
const authMiddleware = require("../middleware/auth");
const ConversationRepository = require("../repositories/conversation.repository");
const MessageRepository = require("../repositories/message.repository");
const UserConversationStateRepository = require("../repositories/userConversationState.repository");
const UserRepository = require("../repositories/user.repository");
const Sentiment = require("sentiment");
const sentiment = new Sentiment();
const uploadChat = require("../middleware/uploadChat");

const router = express.Router();

const getIO = (req) => req.app.get("io");

// ==================== CONVERSATIONS ====================

router.get("/conversations", authMiddleware, async (req, res) => {
  try {
    const conversations = await ConversationRepository.findUserConversations(req.user._id);
    const convWithState = await Promise.all(conversations.map(async (conv) => {
      const state = await UserConversationStateRepository.getState(req.user._id, conv._id);
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

    const participantExists = await UserRepository.findById(participantId);
    if (!participantExists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let conversation = await ConversationRepository.findOnePrivateConversation(req.user._id, participantId);
    if (conversation) {
      // Re-add contact: remove deletedAt flag for this user
      await UserConversationStateRepository.removeDeleted(req.user._id, conversation._id);
      return res.json({ success: true, data: conversation });
    }

    conversation = await ConversationRepository.createPrivateConversation([req.user._id, participantId]);
    const io = getIO(req);
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
    const existingUsers = await Promise.all(uniqueParticipantIds.map(id => UserRepository.findById(id)));
    const existingIds = existingUsers.filter(u => u !== null).map(u => u._id.toString());
    if (existingIds.length !== uniqueParticipantIds.length) {
      return res.status(400).json({ success: false, message: "One or more participants invalid" });
    }

    const conversation = await ConversationRepository.createGroupConversation(existingIds, name, req.user._id);
    const io = getIO(req);
    existingIds.forEach((userId) => {
      io.to(userId.toString()).emit("newConversation", conversation);
    });
    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== MESSAGES ====================

router.get("/conversations/:id/messages", authMiddleware, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const isParticipant = await ConversationRepository.checkUserInConversation(conversationId, req.user._id);
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const state = await UserConversationStateRepository.getState(req.user._id, conversationId);
    const clearedAt = state?.clearedAt || null;
    const options = clearedAt ? { afterDate: clearedAt } : {};
    const messages = await MessageRepository.findByConversation(conversationId, options);
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

    const conversation = await ConversationRepository.findById(conversationId);
    if (!conversation || !conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ success: false, message: "Not a participant" });
    }

    const result = sentiment.analyze(text.trim());
    const score = result.comparative;
    let label = "neutral";
    if (score > 0.2) label = "positive";
    else if (score < -0.2) label = "negative";

    const message = await MessageRepository.create({
      sender: req.user._id,
      conversation: conversationId,
      text: text.trim(),
      sentiment: { score, label },
    });

    await ConversationRepository.updateLastMessage(conversationId, message._id);
    const io = getIO(req);
    conversation.participants.forEach((participantId) => {
      io.to(participantId.toString()).emit("newMessage", message);
    });

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// File upload (unchanged)
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
    const message = await MessageRepository.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    if (message.sender._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    await MessageRepository.deleteById(message._id);
    const conversation = await ConversationRepository.findById(message.conversation);
    if (conversation) {
      const io = getIO(req);
      conversation.participants.forEach((participantId) => {
        io.to(participantId.toString()).emit("messageDeleted", {
          messageId: message._id,
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
    const originalMessage = await MessageRepository.findById(req.params.id);
    if (!originalMessage) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    const { targetConversationId } = req.body;
    if (!targetConversationId) {
      return res.status(400).json({ success: false, message: "Target conversation ID required" });
    }
    if (originalMessage.conversation.toString() === targetConversationId) {
      return res.status(400).json({ success: false, message: "Cannot forward to same conversation" });
    }
    const targetConv = await ConversationRepository.findById(targetConversationId);
    if (!targetConv || !targetConv.participants.includes(req.user._id)) {
      return res.status(403).json({ success: false, message: "Not a participant of target conversation" });
    }
    const forwardedMessage = await MessageRepository.create({
      sender: req.user._id,
      conversation: targetConversationId,
      text: originalMessage.text,
      fileUrl: originalMessage.fileUrl,
      fileType: originalMessage.fileType,
      fileName: originalMessage.fileName,
      isForwarded: true,
      sentiment: { score: 0, label: "neutral" },
    });
    await ConversationRepository.updateLastMessage(targetConversationId, forwardedMessage._id);
    const io = getIO(req);
    targetConv.participants.forEach((pid) => {
      io.to(pid.toString()).emit("newMessage", forwardedMessage);
    });
    res.json({ success: true, data: forwardedMessage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clear chat (per user)
router.delete("/conversations/:id/messages", authMiddleware, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const isParticipant = await ConversationRepository.checkUserInConversation(conversationId, req.user._id);
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Not a participant" });
    }
    await UserConversationStateRepository.setCleared(req.user._id, conversationId);
    const io = getIO(req);
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
    const conversation = await ConversationRepository.findById(conversationId);
    if (!conversation || conversation.isGroup) {
      return res.status(404).json({ success: false, message: "Conversation not found or is a group" });
    }
    if (!conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ success: false, message: "Not a participant" });
    }
    await UserConversationStateRepository.setDeleted(req.user._id, conversationId);
    const io = getIO(req);
    io.to(req.user._id.toString()).emit("conversationRemoved", { conversationId });
    res.json({ success: true, message: "Contact deleted and chat cleared" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;