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

// Validate critical config
if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined.");
  process.exit(1);
}
if (!PORT) {
  console.warn("PORT not defined, defaulting to 5000");
  const PORT_FALLBACK = 5000;
}

console.log("JWT_SECRET:", JWT_SECRET ? "Loaded" : "MISSING");

// Initialize express
const app = express();

// Create the server using the express app
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*", // restrict in production
    methods: ["GET", "POST"],
  },
});

// Middlewares
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// DB connection
connectDB();

// Routes
app.use("/api/auth", authroute);
app.use("/api/chat", chatRoutes);
app.use("/api/chat/group", groupRoutes);

// Make io accessible to routes
app.set("io", io);

// ------------- Socket.io Authentication Middleware -------------
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error: no token"));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return next(new Error("Authentication error: user not found"));
    }

    socket.user = user;
    next();
  } catch (error) {
    console.error("Socket auth error:", error.message);
    next(new Error("Authentication error: invalid token"));
  }
});

// ------------- Socket.io Connection Handling -------------
io.on("connection", async (socket) => {
  console.log(`User connected: ${socket.user.username}`);

  socket.join(socket.user._id.toString());
  await User.findByIdAndUpdate(socket.user._id, { isOnline: true }).exec();

  // 1) Send current online users list to the newly connected socket
  const onlineUsers = await User.find({ isOnline: true }).select("_id");
  const onlineIds = onlineUsers.map((u) => u._id.toString());
  console.log("📡 Emitting onlineUsers to", socket.user.username, onlineIds);
  socket.emit("onlineUsers", onlineIds);

  // 2) Broadcast to all OTHER users that this user is now online
  socket.broadcast.emit("userStatus", {
    userId: socket.user._id.toString(),
    isOnline: true,
  });

  // 3) Handle request for online list (client may have missed initial emit)
  socket.on("requestOnlineUsers", async () => {
    const freshOnlineUsers = await User.find({ isOnline: true }).select("_id");
    socket.emit(
      "onlineUsers",
      freshOnlineUsers.map((u) => u._id.toString()),
    );
  });

  // Join a specific conversation room (when user opens a chat)
  socket.on("joinConversation", (conversationId) => {
    socket.join(conversationId);
    console.log(
      `${socket.user.username} joined conversation ${conversationId}`,
    );
  });

  // Leave a conversation room
  socket.on("leaveConversation", (conversationId) => {
    socket.leave(conversationId);
  });

  // Send a message in real-time
  socket.on("sendMessage", async (data, callback) => {
    try {
      const { conversationId, text } = data;
      if (!text || !conversationId) {
        return callback({ error: "Missing fields" });
      }

      const conversation = await Conversation.findById(conversationId);
      if (
        !conversation ||
        !conversation.participants.includes(socket.user._id)
      ) {
        return callback({ error: "Not a participant" });
      }

      // Analyze sentiment
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

      const populatedMessage = await message.populate(
        "sender",
        "username email avatar",
      );

      // Update lastMessage
      conversation.lastMessage = message._id;
      await conversation.save();

      // ✅ Emit ONLY to the conversation room → no duplicate
      io.to(conversationId.toString()).emit("newMessage", populatedMessage);

      callback({ success: true, message: populatedMessage });
    } catch (error) {
      callback({ error: error.message });
    }
  });

  // Typing indicator (with missing conversationId fixed)
  socket.on("typing", (conversationId) => {
    console.log(`⌨️ ${socket.user.username} typing in ${conversationId}`);
    socket.to(conversationId).emit("userTyping", {
      userId: socket.user._id,
      username: socket.user.username,
      conversationId, // ✅ ADDED
    });
  });

  socket.on("stopTyping", (conversationId) => {
    socket.to(conversationId).emit("userStopTyping", {
      userId: socket.user._id,
      conversationId, // ✅ ADDED
    });
  });

  // Disconnect
  socket.on("disconnect", async () => {
    console.log(`User disconnected: ${socket.user.username}`);
    await User.findByIdAndUpdate(socket.user._id, { isOnline: false }).exec();
    // Broadcast offline status
    io.emit("userStatus", {
      userId: socket.user._id.toString(),
      isOnline: false,
    });
  });
});

// Listen on the 'server' instance, not 'app'
const listenPort = PORT || 5000;
server.listen(listenPort, () => {
  console.log(`Server running on http://localhost:${listenPort}`);
});

module.exports = server;
