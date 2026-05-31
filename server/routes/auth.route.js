const express = require("express");
const router = express.Router();
const { registerUser, loginUser } = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth");
const UserRepository = require("../repositories/user.repository");
const upload = require("../middleware/upload");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

router.post("/register", registerUser);
router.post("/login", loginUser);

// @route   GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// @route   GET /api/auth/search?q=john
router.get("/search", authMiddleware, async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ success: false, message: "Search query required" });
    }
    const users = await UserRepository.searchUsersExact(query, req.user._id);
    res.json({ success: true, data: users });
  } catch (error) {
    console.error("SEARCH ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/auth/profile
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { username, email, currentPassword, newPassword } = req.body;
    const user = await UserRepository.findById(req.user._id, true);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Check email uniqueness
    if (email && email !== user.email) {
      const emailExists = await UserRepository.findByEmail(email);
      if (emailExists) {
        return res.status(400).json({ success: false, message: "Email already in use" });
      }
      user.email = email;
    }

    // Check username uniqueness
    if (username && username !== user.username) {
      const usernameExists = await UserRepository.findByUsername(username);
      if (usernameExists) {
        return res.status(400).json({ success: false, message: "Username already taken" });
      }
      user.username = username;
    }

    // Change password
    if (currentPassword && newPassword) {
      const isMatch = await UserRepository.checkPassword(user, currentPassword);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: "Current password is incorrect" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
      }
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
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
router.post("/avatar", authMiddleware, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image provided" });
    }

    const user = await UserRepository.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Delete old avatar if exists
    if (user.avatar) {
      const oldPath = path.join(__dirname, "..", user.avatar);
      fs.unlink(oldPath, (err) => {
        if (err) console.log("Failed to delete old avatar:", err.message);
      });
    }

    const avatarPath = "/uploads/avatars/" + req.file.filename;
    user.avatar = avatarPath;
    await user.save();

    res.json({ success: true, data: { avatar: avatarPath } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;