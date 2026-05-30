const express = require("express");
const authMiddleware = require("../middleware/auth");
const Conversation = require("../models/Conversation.model");
const User = require("../models/User.model");
const Message = require("../models/Message.model");
const router = express.Router();

// @route   GET /api/chat/group/:id
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id)
      .populate("participants", "-password")
      .populate("groupAdmin", "-password");
    if (!conv || !conv.isGroup)
      return res.status(404).json({ success: false, message: "Group not found" });
    if (!conv.participants.some((p) => p._id.equals(req.user._id)))
      return res.status(403).json({ success: false, message: "Not a member" });
    res.json({ success: true, data: conv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id/name (unchanged)
router.put("/:id/name", authMiddleware, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv || !conv.isGroup)
      return res.status(404).json({ success: false, message: "Group not found" });
    if (conv.groupAdmin.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "Only admin can change name" });
    conv.groupName = req.body.name;
    await conv.save();
    const io = req.app.get("io");
    conv.participants.forEach(p => io.to(p.toString()).emit("groupUpdated", conv));
    res.json({ success: true, data: conv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id/add (unchanged)
router.put("/:id/add", authMiddleware, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv || !conv.isGroup)
      return res.status(404).json({ success: false, message: "Group not found" });
    if (!conv.participants.includes(req.user._id))
      return res.status(403).json({ success: false, message: "Only members can add" });
    const { userIds } = req.body;
    if (!userIds || userIds.length === 0)
      return res.status(400).json({ success: false, message: "Provide userIds" });
    for (const uid of userIds) {
      if (!conv.participants.includes(uid)) conv.participants.push(uid);
    }
    await conv.save();
    const io = req.app.get("io");
    conv.participants.forEach((p) => io.to(p.toString()).emit("groupUpdated", conv));
    res.json({ success: true, data: await conv.populate("participants", "-password") });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id/remove (unchanged)
router.put("/:id/remove", authMiddleware, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv || !conv.isGroup)
      return res.status(404).json({ success: false, message: "Group not found" });
    if (conv.groupAdmin.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "Only admin can remove members" });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "Provide userId" });
    conv.participants = conv.participants.filter(p => p.toString() !== userId);
    await conv.save();
    const io = req.app.get("io");
    io.to(userId).emit("removedFromGroup", conv._id);
    conv.participants.forEach(p => io.to(p.toString()).emit("groupUpdated", conv));
    res.json({ success: true, data: await conv.populate("participants", "-password") });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id/leave (fixed to not delete group unless no members left)
router.put("/:id/leave", authMiddleware, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv || !conv.isGroup)
      return res.status(404).json({ success: false, message: "Group not found" });
    
    // Remove the leaving user
    conv.participants = conv.participants.filter(p => p.toString() !== req.user._id.toString());
    
    // If the leaving user was admin and there are other participants, assign new admin
    if (conv.groupAdmin.toString() === req.user._id.toString() && conv.participants.length > 0) {
      conv.groupAdmin = conv.participants[0];
    }
    
    const io = req.app.get("io");
    
    if (conv.participants.length === 0) {
      // No members left: delete the group and all messages
      await Message.deleteMany({ conversation: conv._id });
      await Conversation.findByIdAndDelete(conv._id);
      io.emit("groupDeleted", conv._id); // notify all connected clients
      return res.json({ success: true, message: "Group deleted (no members left)" });
    }
    
    await conv.save();
    // Notify the leaving user
    io.to(req.user._id.toString()).emit("removedFromGroup", conv._id);
    // Notify remaining participants
    conv.participants.forEach(p => io.to(p.toString()).emit("groupUpdated", conv));
    
    res.json({ success: true, message: "Left group" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;