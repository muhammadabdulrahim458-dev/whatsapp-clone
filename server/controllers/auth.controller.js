const User = require("../models/User.model");
const bcrypt = require("bcryptjs");
const { generateToken } = require("../.config/jwt");


// REGISTER USER
async function registerUser(req, res) {

    try {

        const { username, email, password } = req.body;
        
        // Check existing user
        const existingUser = await User.findOne({ email });

        if (existingUser) {

            return res.status(400).json({
                success: false,
                message: "Email already exists"
            });

        }

        // Generate salt
        const salt = await bcrypt.genSalt(10);

        // Hash password
        const hashedPassword = await bcrypt.hash(
            password,
            salt
        );

        // Create user
        const user = await User.create({
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
        // res.redirect('/login');



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

        // Find user
        const currentUser = await User.findOne({ email });

        // Check user
        if (!currentUser) {

            return res.status(400).json({
                success: false,
                message: "Invalid credentials"
            });

        }

        // Compare password
        const isMatch = await bcrypt.compare(
            password,
            currentUser.password
        );

        // Invalid password
        if (!isMatch) {

            return res.status(400).json({
                success: false,
                message: "Invalid credentials"
            });

        }

        // Generate token
        const token = generateToken(currentUser._id);

        res.cookie('token', token, {
            httpOnly: true,
            secure: false,
            maxAge: 24 * 60 * 60 * 1000
        });

        // res.redirect('/');

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