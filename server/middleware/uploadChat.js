const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads/chat directory exists
const chatUploadDir = path.join(__dirname, "../uploads/chat");
if (!fs.existsSync(chatUploadDir)) {
  fs.mkdirSync(chatUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, chatUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Allow all file types (you can restrict by mime type if needed)
const fileFilter = (req, file, cb) => {
  cb(null, true);
};

const uploadChat = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
  fileFilter: fileFilter,
});

module.exports = uploadChat;