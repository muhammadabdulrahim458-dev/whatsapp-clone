const express = require("express");
const router = express.Router();
const { registerUser, loginUser } = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth");
const User = require("../models/User.model");
const upload = require("../middleware/upload");
const fs = require("fs");
const path = require("path");

router.post("/register", registerUser); // http://localhost:5000/api/auth/register
router.post("/login", loginUser); // http://localhost:5000/api/auth/login

// @route   GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// @route   GET /api/auth/search?q=john
// @desc    Search users (for starting new chats)
router.get("/search", authMiddleware, async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res
        .status(400)
        .json({ success: false, message: "Search query required" });
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } },
        {
          $or: [
            { username: { $regex: `^${query}$`, $options: "i" } },
            { email: { $regex: `^${query}$`, $options: "i" } },
          ],
        },
      ],
    })
      .select("-password")
      .limit(10);

    res.json({ success: true, data: users });
  } catch (error) {
    console.error("SEARCH ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update username / email / password
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { username, email, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select("+password");

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // If updating email, check uniqueness
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists)
        return res
          .status(400)
          .json({ success: false, message: "Email already in use" });
      user.email = email;
    }

    // If updating username, check uniqueness
    if (username && username !== user.username) {
      const usernameExists = await User.findOne({ username });
      if (usernameExists)
        return res
          .status(400)
          .json({ success: false, message: "Username already taken" });
      user.username = username;
    }

    // If changing password
    if (currentPassword && newPassword) {
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch)
        return res
          .status(401)
          .json({ success: false, message: "Current password is incorrect" });
      if (newPassword.length < 6)
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      user.password = newPassword;
    }

    await user.save();
    res.json({
      success: true,
      data: { username: user.username, email: user.email, avatar: user.avatar },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/auth/avatar
// @desc    Upload user avatar
router.post(
  "/avatar",
  authMiddleware,
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file)
        return res
          .status(400)
          .json({ success: false, message: "No image provided" });

      const user = await User.findById(req.user._id);

      // Delete old avatar if exists
      if (user.avatar) {
        const oldPath = path.join(__dirname, "..", user.avatar);
        fs.unlink(oldPath, (err) => {
          if (err) console.log("Failed to delete old avatar:", err.message);
        });
      }

      // Update avatar path
      const avatarPath = "/uploads/avatars/" + req.file.filename;
      user.avatar = avatarPath;
      await user.save();

      res.json({ success: true, data: { avatar: avatarPath } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

module.exports = router;
