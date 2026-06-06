const express = require("express");
const authMiddleware = require("../middleware/auth");
const ConversationRepository = require("../repositories/conversation.repository");
const UserRepository = require("../repositories/user.repository");
const MessageRepository = require("../repositories/message.repository");
const router = express.Router();

const getIO = (req) => req.app.get("io");

// @route   GET /api/chat/group/:id
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const conv = await ConversationRepository.findById(req.params.id, ['participants', 'groupAdmin']);
    if (!conv || !conv.isGroup) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }
    if (!conv.participants.some(p => p._id.equals(req.user._id))) {
      return res.status(403).json({ success: false, message: "Not a member" });
    }
    res.json({ success: true, data: conv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/chat/group/:id/name
router.put("/:id/name", authMiddleware, async (req, res) => {
  try {
    const conv = await ConversationRepository.findById(req.params.id);
    if (!conv || !conv.isGroup) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }
    if (conv.groupAdmin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Only admin can change name" });
    }
    await ConversationRepository.updateGroupName(req.params.id, req.body.name);
    const updatedConv = await ConversationRepository.findById(req.params.id, ['participants', 'groupAdmin']);
    const io = getIO(req);
    updatedConv.participants.forEach(p => io.to(p._id.toString()).emit("groupUpdated", updatedConv));
    res.json({ success: true, data: updatedConv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/chat/group/:id/add
router.put("/:id/add", authMiddleware, async (req, res) => {
  try {
    const conv = await ConversationRepository.findById(req.params.id);
    if (!conv || !conv.isGroup) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }
    if (!conv.participants.includes(req.user._id)) {
      return res.status(403).json({ success: false, message: "Only members can add" });
    }
    const { userIds } = req.body;
    if (!userIds || userIds.length === 0) {
      return res.status(400).json({ success: false, message: "Provide userIds" });
    }
    // Add participants (avoid duplicates)
    await ConversationRepository.addParticipants(req.params.id, userIds);
    const updatedConv = await ConversationRepository.findById(req.params.id, ['participants', 'groupAdmin']);
    const io = getIO(req);
    updatedConv.participants.forEach(p => io.to(p._id.toString()).emit("groupUpdated", updatedConv));
    res.json({ success: true, data: updatedConv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/chat/group/:id/remove
router.put("/:id/remove", authMiddleware, async (req, res) => {
  try {
    const conv = await ConversationRepository.findById(req.params.id);
    if (!conv || !conv.isGroup) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }
    if (conv.groupAdmin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Only admin can remove members" });
    }
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: "Provide userId" });
    }
    await ConversationRepository.removeParticipant(req.params.id, userId);
    const updatedConv = await ConversationRepository.findById(req.params.id, ['participants', 'groupAdmin']);
    const io = getIO(req);
    io.to(userId).emit("removedFromGroup", conv._id);
    updatedConv.participants.forEach(p => io.to(p._id.toString()).emit("groupUpdated", updatedConv));
    res.json({ success: true, data: updatedConv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/chat/group/:id/leave
router.put("/:id/leave", authMiddleware, async (req, res) => {
  try {
    const conv = await ConversationRepository.findById(req.params.id);
    if (!conv || !conv.isGroup) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }
    // Remove the leaving user
    await ConversationRepository.removeParticipant(req.params.id, req.user._id);
    let updatedConv = await ConversationRepository.findById(req.params.id, ['participants', 'groupAdmin']);
    const io = getIO(req);
    // If the leaving user was admin and there are other participants, assign new admin
    if (conv.groupAdmin.toString() === req.user._id.toString() && updatedConv && updatedConv.participants.length > 0) {
      updatedConv.groupAdmin = updatedConv.participants[0]._id;
      await ConversationRepository.updateGroupAdmin?.(req.params.id, updatedConv.groupAdmin); // we'll add this method if needed
      await updatedConv.save();
    }
    if (!updatedConv || updatedConv.participants.length === 0) {
      // No members left: delete the group and all messages
      await MessageRepository.deleteManyByConversation(req.params.id);
      await ConversationRepository.deleteConversation(req.params.id);
      io.emit("groupDeleted", req.params.id);
      return res.json({ success: true, message: "Group deleted (no members left)" });
    }
    // Notify the leaving user
    io.to(req.user._id.toString()).emit("removedFromGroup", conv._id);
    // Notify remaining participants
    updatedConv.participants.forEach(p => io.to(p._id.toString()).emit("groupUpdated", updatedConv));
    res.json({ success: true, message: "Left group" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;