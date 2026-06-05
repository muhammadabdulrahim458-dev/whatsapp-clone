const express = require("express");
const http = require("http");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const socketio = require("socket.io");
const jwt = require("jsonwebtoken");
const { PORT, JWT_SECRET } = require("./.config/env");
const connectDB = require("./.config/db");
const authroute = require("./routes/auth.route");
const User = require("./models/User.model");
const chatRoutes = require("./routes/chat.route");
const Conversation = require("./models/Conversation.model");
const Message = require("./models/Message.model");
const Sentiment = require("sentiment");
const sentiment = new Sentiment();
const path = require("path");
const groupRoutes = require("./routes/group.route");

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined.");
  process.exit(1);
}
if (!PORT) {
  console.warn("PORT not defined, defaulting to 5000");
}
console.log("JWT_SECRET:", JWT_SECRET ? "Loaded" : "MISSING");

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

connectDB();
User.updateMany({}, { isOnline: false }).exec().catch(console.error);

app.use("/api/auth", authroute);
app.use("/api/chat", chatRoutes);
app.use("/api/chat/group", groupRoutes);
app.set("io", io);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error: no token"));
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return next(new Error("Authentication error: user not found"));
    socket.user = user;
    next();
  } catch (error) {
    console.error("Socket auth error:", error.message);
    next(new Error("Authentication error: invalid token"));
  }
});

io.on("connection", async (socket) => {
  console.log(`User connected: ${socket.user.username}`);
  socket.join(socket.user._id.toString());
  await User.findByIdAndUpdate(socket.user._id, { isOnline: true }).exec();

  const onlineUsers = await User.find({ isOnline: true }).select("_id");
  socket.emit("onlineUsers", onlineUsers.map(u => u._id.toString()));
  socket.broadcast.emit("userStatus", {
    userId: socket.user._id.toString(),
    isOnline: true,
  });

  socket.on("requestOnlineUsers", async () => {
    const fresh = await User.find({ isOnline: true }).select("_id");
    socket.emit("onlineUsers", fresh.map(u => u._id.toString()));
  });

  socket.on("joinConversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`${socket.user.username} joined conversation ${conversationId}`);
  });
  socket.on("leaveConversation", (conversationId) => socket.leave(conversationId));

  socket.on("sendMessage", async (data, callback) => {
    try {
      const { conversationId, text } = data;
      if (!text || !conversationId) return callback({ error: "Missing fields" });
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(socket.user._id)) {
        return callback({ error: "Not a participant" });
      }
      const result = sentiment.analyze(text);
      const score = result.comparative;
      let label = "neutral";
      if (score > 0.2) label = "positive";
      else if (score < -0.2) label = "negative";

      const message = await Message.create({
        sender: socket.user._id,
        conversation: conversationId,
        text,
        sentiment: { score, label },
      });
      const populatedMessage = await message.populate("sender", "username email avatar");
      
      // Add conversation name for notifications
      let conversationName = "";
      if (conversation.isGroup) {
        conversationName = conversation.groupName;
      } else {
        const otherUserId = conversation.participants.find(pid => pid.toString() !== socket.user._id.toString());
        const otherUser = otherUserId ? await User.findById(otherUserId).select("username") : null;
        conversationName = otherUser?.username || "Unknown";
      }
      populatedMessage.conversationName = conversationName;

      conversation.lastMessage = message._id;
      await conversation.save();
      io.to(conversationId.toString()).emit("newMessage", populatedMessage);
      callback({ success: true, message: populatedMessage });
    } catch (error) {
      callback({ error: error.message });
    }
  });

  socket.on("sendFileMessage", async (data, callback) => {
    try {
      const { conversationId, fileUrl, fileType, fileName, text } = data;
      if (!conversationId || !fileUrl) return callback({ error: "Missing fields" });
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(socket.user._id)) {
        return callback({ error: "Not a participant" });
      }
      const message = await Message.create({
        sender: socket.user._id,
        conversation: conversationId,
        text: text || "",
        fileUrl,
        fileType,
        fileName,
        sentiment: { score: 0, label: "neutral" },
      });
      const populatedMessage = await message.populate("sender", "username email avatar");
      
      // Add conversation name for notifications
      let conversationName = "";
      if (conversation.isGroup) {
        conversationName = conversation.groupName;
      } else {
        const otherUserId = conversation.participants.find(pid => pid.toString() !== socket.user._id.toString());
        const otherUser = otherUserId ? await User.findById(otherUserId).select("username") : null;
        conversationName = otherUser?.username || "Unknown";
      }
      populatedMessage.conversationName = conversationName;

      conversation.lastMessage = message._id;
      await conversation.save();
      io.to(conversationId.toString()).emit("newMessage", populatedMessage);
      callback({ success: true, message: populatedMessage });
    } catch (error) {
      console.error("sendFileMessage error:", error);
      callback({ error: error.message });
    }
  });

  socket.on("typing", (conversationId) => {
    socket.to(conversationId).emit("userTyping", {
      userId: socket.user._id,
      username: socket.user.username,
      conversationId,
    });
  });
  socket.on("stopTyping", (conversationId) => {
    socket.to(conversationId).emit("userStopTyping", {
      userId: socket.user._id,
      conversationId,
    });
  });

  socket.on("disconnect", async () => {
    console.log(`User disconnected: ${socket.user.username}`);
    await User.findByIdAndUpdate(socket.user._id, { isOnline: false }).exec();
    io.emit("userStatus", {
      userId: socket.user._id.toString(),
      isOnline: false,
    });
  });
});

const listenPort = PORT || 5000;
server.listen(listenPort, () => {
  console.log(`Server running on http://localhost:${listenPort}`);
});

module.exports = server;