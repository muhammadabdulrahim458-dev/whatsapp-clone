const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require("../.config/env");
const User = require("../models/User.model");

async function authMiddleware(req, res, next) {
    try {
        let token = null;

        // 1. Check Authorization header (Bearer token) - preferred by client
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')
        ) {
            token = req.headers.authorization.split(' ')[1];
        }
        // 2. Fallback to cookie (if your client later uses cookies)
        else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }


        console.log('Extracted token:', token ? token.substring(0, 15) + '...' : 'MISSING');
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("Auth middleware error:", error.message);
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
}

module.exports = authMiddleware;