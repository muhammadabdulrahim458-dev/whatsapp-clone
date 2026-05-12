const express = require("express");
const authMiddleware = require("../middleware/auth");
const Conversation = require("../models/Conversation.model");
const User = require("../models/User.model");
const router = express.Router();

// @route   GET /api/chat/group/:id
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id)
      .populate("participants", "-password")
      .populate("groupAdmin", "-password");
    if (!conv || !conv.isGroup)
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    if (!conv.participants.some((p) => p._id.equals(req.user._id)))
      return res.status(403).json({ success: false, message: "Not a member" });
    res.json({ success: true, data: conv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/chat/group/:id/name
router.put("/:id/name", authMiddleware, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv || !conv.isGroup)
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    if (conv.groupAdmin.toString() !== req.user._id.toString())
      return res
        .status(403)
        .json({ success: false, message: "Only admin can change name" });
    conv.groupName = req.body.name;
    await conv.save();
    res.json({ success: true, data: conv });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/chat/group/:id/add
router.put("/:id/add", authMiddleware, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv || !conv.isGroup)
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    if (!conv.participants.includes(req.user._id))
      return res
        .status(403)
        .json({ success: false, message: "Only members can add" });
    const { userIds } = req.body; // array of user IDs
    if (!userIds || userIds.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "Provide userIds" });
    for (const uid of userIds) {
      if (!conv.participants.includes(uid)) conv.participants.push(uid);
    }
    await conv.save();
    const io = req.app.get("io");
    conv.participants.forEach((p) =>
      io.to(p.toString()).emit("groupUpdated", conv),
    );
    res.json({
      success: true,
      data: await conv.populate("participants", "-password"),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/chat/group/:id/remove
router.put("/:id/remove", authMiddleware, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv || !conv.isGroup)
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    if (conv.groupAdmin.toString() !== req.user._id.toString())
      return res
        .status(403)
        .json({ success: false, message: "Only admin can remove members" });
    const { userId } = req.body;
    if (!userId)
      return res
        .status(400)
        .json({ success: false, message: "Provide userId" });
    conv.participants = conv.participants.filter(
      (p) => p.toString() !== userId,
    );
    await conv.save();
    const io = req.app.get("io");
    io.to(userId).emit("removedFromGroup", conv._id); // notify removed user
    conv.participants.forEach((p) =>
      io.to(p.toString()).emit("groupUpdated", conv),
    );
    res.json({
      success: true,
      data: await conv.populate("participants", "-password"),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/chat/group/:id/leave
router.put("/:id/leave", authMiddleware, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv || !conv.isGroup)
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    conv.participants = conv.participants.filter(
      (p) => p.toString() !== req.user._id.toString(),
    );
    if (conv.groupAdmin.toString() === req.user._id.toString()) {
      // If admin leaves, assign a new admin (first participant)
      conv.groupAdmin = conv.participants[0] || null;
      if (!conv.groupAdmin) {
        // no participants left -> delete group?
        await Conversation.findByIdAndDelete(conv._id);
        const io = req.app.get("io");
        io.emit("groupDeleted", conv._id);
        return res.json({ success: true, message: "Group deleted" });
      }
    }
    await conv.save();
    const io = req.app.get("io");
    io.to(req.user._id.toString()).emit("removedFromGroup", conv._id);
    conv.participants.forEach((p) =>
      io.to(p.toString()).emit("groupUpdated", conv),
    );
    res.json({ success: true, message: "Left group" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
