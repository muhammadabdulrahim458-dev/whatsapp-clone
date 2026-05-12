const mongoose = require("mongoose")
const { MONGO_URI } = require("./env")

async function connectDB() {

    try {
        await mongoose.connect(MONGO_URI)
        console.log("Connection to DB Successfully");
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

module.exports = connectDB