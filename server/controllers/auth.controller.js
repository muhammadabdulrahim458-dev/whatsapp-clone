const bcrypt = require("bcryptjs");
const { generateToken } = require("../.config/jwt");
const UserRepository = require("../repositories/user.repository");

// REGISTER USER
async function registerUser(req, res) {
  try {
    const { username, email, password } = req.body;

    // Check existing user
    const existingUser = await UserRepository.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists"
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await UserRepository.create({
      username,
      email,
      password: hashedPassword
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
}

// LOGIN USER
async function loginUser(req, res) {
  try {
    const { email, password } = req.body;

    const currentUser = await UserRepository.findByEmail(email);
    if (!currentUser) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const isMatch = await bcrypt.compare(password, currentUser.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const token = generateToken(currentUser._id);
    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: currentUser._id,
        username: currentUser.username,
        email: currentUser.email
      }
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

module.exports = {
  registerUser,
  loginUser
};