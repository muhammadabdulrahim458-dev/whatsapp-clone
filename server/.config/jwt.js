const jwt = require("jsonwebtoken")
const { JWT_SECRET, JWT_EXPIRE } = require("./env")

const generateToken = (userId) => {
    return jwt.sign({ id: userId }, JWT_SECRET, {
        expiresIn: JWT_EXPIRE
    })
}

const verifyToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
}

module.exports={
    generateToken,
    verifyToken
}