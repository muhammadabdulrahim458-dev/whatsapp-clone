Perfect! We'll go full JavaScript — no TypeScript. Here's the final confirmed stack:

**Client:** Electron + React + Vite + Tailwind CSS  
**Server:** Node.js + Express + Socket.io + MongoDB + Mongoose + JWT  
**Tools:** Git, npm, electron-builder (later)

Everything in plain JavaScript.

---




### 🚀 We'll build step by step:

1. **Server** – Initialize, Express, MongoDB connection, User model, Auth routes (register/login) with JWT  
2. **Server** – Conversation & Message models, one-on-one chat APIs, Socket.io setup for real-time  
3. **Server** – Group model, group messaging, membership  
4. **Client** – Initialize Electron + React + Vite project structure  
5. **Client** – Login/Register UI, authentication flow  
6. **Client** – Main chat layout (sidebar + chat area), Socket.io integration  
7. **Client** – One-on-one chat, sending/receiving messages  
8. **Client** – Group chats creation & interaction  
9. **Polish** – Timestamps, online status, read receipts, UI refinements  

---

**Ready to start with Step 1: Server setup?**  
I’ll give you the exact commands and code files. Let me know and I’ll begin.


Awesome! Let’s build the server first. I’ll walk you through creating the entire authentication system with Node.js, Express, MongoDB, and JWT.

---

## 🧱 Step 1: Server – Auth & Real-Time Foundation

We’ll create the `server` folder, set up Express, connect to MongoDB, define a **User** model, and build **Register/Login** routes that return JWT tokens.

---

### 1.1 Initial Setup

Create the root project folder and server:

```bash
mkdir whatsapp-electron
cd whatsapp-electron
mkdir server
cd server
npm init -y
```

Install dependencies:

```bash
npm install express mongoose bcryptjs jsonwebtoken dotenv cors socket.io
```

Install dev dependency for auto‑restart during development:

```bash
npm install --save-dev nodemon
```

---

### 1.2 Environment Variables

Create a `.env` file inside `server/`:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string_here
JWT_SECRET=your_super_secret_key_change_this
```

- If you’re using **MongoDB Atlas**, replace `your_mongodb_connection_string_here` with your actual URI.  
- For local MongoDB: `mongodb://localhost:27017/whatsapp-clone`

---

### 1.3 Main Server File – `server/index.js`

This file connects to MongoDB, sets up Express, and mounts the auth routes.

```javascript
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');                // for socket.io later
const authRoutes = require('./routes/auth');

dotenv.config();

const app = express();
const server = http.createServer(app);      // wrap express with http server

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/', (req, res) => {
  res.send('WhatsApp Clone Server is running...');
});

// MongoDB connection and server start
const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
  });

module.exports = server;  // export for socket.io later
```

---

### 1.4 User Model – `server/models/User.js`

We’ll hash passwords using `bcryptjs` before saving.

```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // don't return password in queries by default
    },
    avatar: {
      type: String,
      default: '',
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
```

---

### 1.5 Authentication Middleware – `server/middleware/auth.js`

This will protect future routes by verifying the JWT token.

```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

module.exports = { protect };
```

---

### 1.6 Auth Routes – `server/routes/auth.js`

Register and Login endpoints. On success, they return a JWT token.

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @route   POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        message: 'User already exists with that email or username',
      });
    }

    const user = await User.create({ username, email, password });

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user and explicitly select password field (default select: false)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
```

---

### 1.7 Update `package.json` Scripts

Inside `server/package.json`, add a dev script:

```json
"scripts": {
  "start": "node index.js",
  "dev": "nodemon index.js"
}
```

---

### 1.8 Test It!

1. Make sure your MongoDB is running (local or Atlas).
2. Start the server:
   ```bash
   npm run dev
   ```
3. Use Postman or curl to test:

**Register:**
```
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "username": "john",
  "email": "john@example.com",
  "password": "123456"
}
```

**Login:**
```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "123456"
}
```

Both should return a JSON with `_id`, `username`, `email`, and `token`.

---

✅ **Step 1 complete!** You now have a working authentication server with JWT.

**Next step (Step 2):** We’ll add the Conversation & Message models, create one-on-one chat API endpoints, and set up Socket.io for real-time messaging.

Ready to continue? Let me know!





Great, you’ve already restructured the server nicely! I’ll work with your current layout. Let’s move on to **Step 2** – adding real-time messaging foundation with Socket.io and the chat data models (Conversation & Message).

I’ll assume your `auth.middleware.js` exports a `protect` function similar to what we had earlier (verifies JWT and attaches `req.user`). I’ll also assume your folder structure looks like:

```
server/
├── .config/
│   ├── env.js          (exports PORT, MONGO_URI, JWT_SECRET etc.)
│   └── db.js           (exports connectDB)
├── models/
├── routes/
├── middlewares/
│   └── auth.middleware.js
├── index.js
└── package.json
```

If anything differs, let me know and I’ll adapt.

---

## 🔌 Step 2 – Real-time with Socket.io & Chat Models

### 2.1 Install new dependencies

Inside `server/`, run:

```bash
npm install socket.io
```

(socket.io should already be in node_modules if you installed it earlier, but just in case)

---

### 2.2 Update the main server file – `server/index.js`

We need to wrap the Express app with an HTTP server and attach Socket.io. We’ll also set up authentication for socket connections using your existing auth middleware logic.

```javascript
const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const http = require('http');
const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');          // your User model

const { PORT } = require('./.config/env');
const connectDB = require('./.config/db');

const authRoute = require('./routes/auth.route');
// We'll add chat routes later
// const chatRoutes = require('./routes/chat.routes');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: '*',           // restrict in production
    methods: ['GET', 'POST']
  }
});

// Middlewares
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser());

// DB connection
connectDB();

// Routes
app.use('/api/auth', authRoute);
// app.use('/api/chat', chatRoutes);    // later

// ------------- Socket.io Authentication Middleware -------------
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: no token'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(new Error('Authentication error: user not found'));
    }

    // Attach user to socket
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error: invalid token'));
  }
});

// ------------- Socket.io Connection Handling -------------
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.username} (${socket.user._id})`);

  // Join a personal room named after user ID (for private messages)
  socket.join(socket.user._id.toString());

  // Update user online status (optional)
  User.findByIdAndUpdate(socket.user._id, { isOnline: true }).exec();

  // When a user sends a message (handled later)
  // socket.on('sendMessage', ...)

  // When user disconnects
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.username}`);
    User.findByIdAndUpdate(socket.user._id, { isOnline: false }).exec();
  });
});

// Make io accessible to routes if needed (we'll attach to app)
app.set('io', io);

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**Note:**  
- I used `socket.handshake.auth.token` – the client will send the token in the handshake auth object.  
- The user is joined to a personal room with `socket.user._id.toString()`. This lets us send private messages directly to that room.  
- The `io` instance is attached to the Express app so routes can use it: `req.app.get('io')`.

---

### 2.3 Create the Conversation & Message models

Create `models/Conversation.js`:

```javascript
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupName: {
      type: String,
      default: '',
    },
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', conversationSchema);
```

Create `models/Message.js`:

```javascript
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
```

---

### 2.4 Authentication middleware for routes (if not already)

I’ll assume you have `middlewares/auth.middleware.js` exporting something like this:

```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

module.exports = { protect };   // or module.exports = protect; adjust accordingly
```

If your export is different, I’ll adjust later.

---

### 2.5 Chat API routes

Create `routes/chat.routes.js` (or `chat.route.js`) with endpoints for creating/retrieving conversations and messages. We’ll rely on HTTP for these, but real-time messaging will use Socket.io.

```javascript
const express = require('express');
const { protect } = require('../middlewares/auth.middleware');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const router = express.Router();

// @route   GET /api/chat/conversations
// Get all conversations for the logged-in user
router.get('/conversations', protect, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate('participants', '-password')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/chat/conversations
// Create a one-on-one conversation (if it doesn't exist)
router.post('/conversations', protect, async (req, res) => {
  try {
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ message: 'Participant ID is required' });
    }

    // Check if a private conversation already exists between these two users
    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, participantId] },
    }).populate('participants', '-password');

    if (conversation) {
      return res.json(conversation); // return existing conversation
    }

    // Create new conversation
    conversation = await Conversation.create({
      participants: [req.user._id, participantId],
    });

    conversation = await conversation.populate('participants', '-password');

    // Notify the other user via socket (optional)
    const io = req.app.get('io');
    io.to(participantId).emit('newConversation', conversation);

    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/chat/conversations/group
// Create a group conversation
router.post('/conversations/group', protect, async (req, res) => {
  try {
    const { name, participants } = req.body;

    if (!name || !participants || participants.length < 1) {
      return res.status(400).json({ message: 'Group name and at least one participant required' });
    }

    // Add current user to participants if not already included
    const allParticipants = [...new Set([req.user._id, ...participants])];

    const conversation = await Conversation.create({
      participants: allParticipants,
      isGroup: true,
      groupName: name,
      groupAdmin: req.user._id,
    });

    const fullConversation = await conversation.populate('participants', '-password');

    // Notify all group members about the new group
    const io = req.app.get('io');
    allParticipants.forEach((userId) => {
      io.to(userId.toString()).emit('newConversation', fullConversation);
    });

    res.status(201).json(fullConversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/chat/conversations/:id/messages
// Get messages for a conversation
router.get('/conversations/:id/messages', protect, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || !conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const messages = await Message.find({ conversation: req.params.id })
      .populate('sender', 'username email avatar')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/chat/conversations/:id/messages
// Send a message via HTTP (for backup or testing, but we'll use socket for real-time)
router.post('/conversations/:id/messages', protect, async (req, res) => {
  try {
    const { text } = req.body;
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const message = await Message.create({
      sender: req.user._id,
      conversation: conversationId,
      text,
    });

    const populatedMessage = await message.populate('sender', 'username email avatar');

    // Update lastMessage in conversation
    conversation.lastMessage = message._id;
    await conversation.save();

    // Emit to all participants via socket
    const io = req.app.get('io');
    conversation.participants.forEach((participantId) => {
      io.to(participantId.toString()).emit('newMessage', populatedMessage);
    });

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
```

Then mount these routes in `index.js` after the auth route:

```javascript
const chatRoutes = require('./routes/chat.routes');
app.use('/api/chat', chatRoutes);
```

---

### 2.6 Socket.io event handlers for real-time messaging

Update the `io.on('connection', ...)` block in `index.js` with message sending:

```javascript
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.username}`);

  socket.join(socket.user._id.toString());
  User.findByIdAndUpdate(socket.user._id, { isOnline: true }).exec();

  // Join a specific conversation room (when user opens a chat)
  socket.on('joinConversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`${socket.user.username} joined conversation ${conversationId}`);
  });

  // Leave a conversation room
  socket.on('leaveConversation', (conversationId) => {
    socket.leave(conversationId);
  });

  // Send a message in real-time
  socket.on('sendMessage', async (data, callback) => {
    try {
      const { conversationId, text } = data;
      if (!text || !conversationId) {
        return callback({ error: 'Missing fields' });
      }

      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(socket.user._id)) {
        return callback({ error: 'Not a participant' });
      }

      const message = await Message.create({
        sender: socket.user._id,
        conversation: conversationId,
        text,
      });

      const populatedMessage = await message.populate('sender', 'username email avatar');

      // Update lastMessage
      conversation.lastMessage = message._id;
      await conversation.save();

      // Emit to all participants (their personal rooms) AND to the conversation room
      conversation.participants.forEach((participantId) => {
        io.to(participantId.toString()).emit('newMessage', populatedMessage);
      });

      // Also emit to anyone in the conversation room (if you use room per conversation)
      io.to(conversationId).emit('newMessage', populatedMessage);

      callback({ success: true, message: populatedMessage });
    } catch (error) {
      callback({ error: error.message });
    }
  });

  // Typing indicator
  socket.on('typing', (conversationId) => {
    socket.to(conversationId).emit('userTyping', {
      userId: socket.user._id,
      username: socket.user.username,
    });
  });

  socket.on('stopTyping', (conversationId) => {
    socket.to(conversationId).emit('userStopTyping', {
      userId: socket.user._id,
    });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.username}`);
    User.findByIdAndUpdate(socket.user._id, { isOnline: false }).exec();
  });
});
```

---

### 2.7 Test the setup

1. Make sure MongoDB is running and your `.config/env.js` exports all necessary variables.
2. Start the server: `npm run dev` (or `npm start`).
3. Test authentication endpoints again – they should still work.
4. Use a tool like **Postman** or **Insomnia** to create a conversation between two users (you’ll need at least two registered users):
   - Register two users (e.g., `john` and `jane`).
   - Login to get their tokens.
   - Create a conversation (POST `/api/chat/conversations`) with `john`’s token in the Authorization header and body `{ "participantId": "<jane's _id>" }`.
   - Get messages (GET `/api/chat/conversations/:id/messages`).
   - Send a message via HTTP POST `/api/chat/conversations/:id/messages`.
5. To test the real-time part, you can connect a Socket.io client manually (we’ll build the Electron client later). For now, you can test using a simple socket.io client in Node.js or a browser console.

---


ali ka token

```json
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhMDA2ODQ5NDM2OTRkMWJlM2RmMjc4MiIsImlhdCI6MTc3ODQxMTU5MywiZXhwIjoxNzc5MDE2MzkzfQ.BXkuCWJTpUtgEkyKMO7jhHFHD_gQkS9ntCADIlC-81k
```


ali ki id

```js
6a00687a43694d1be3df2783
```

faisal token:
```js
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhMDA2ODQ5NDM2OTRkMWJlM2RmMjc4MiIsImlhdCI6MTc3ODQxMTc5NCwiZXhwIjoxNzc5MDE2NTk0fQ.l_63lwMnz-Y-ClGC6zGllnHiQY4RfIciV1k_DsDQR7M
```




## ✅ Next: Step 3 – Electron + React Client

Once you confirm that the server is working (auth + conversations working), we’ll move on to building the Electron client with React. We’ll:

- Set up Electron + React + Vite (or electron-forge)  
- Create the login/register pages  
- Integrate Socket.io client  
- Build the WhatsApp-like UI with sidebar and chat area  
- Connect to the server for real-time messaging

Ready when you are!



Great! Let’s move to **Step 3: Building the Electron + React Client** 🎉  

We’ll create a **desktop chat app** with:
- Electron (main process)
- React (renderer) + Vite (fast bundling)
- Tailwind CSS for styling
- Socket.io-client for real‑time messaging
- React Router for page navigation
- Context API for authentication & socket management

---

## 📁 Project structure inside `client/`

```
client/
├── electron/
│   ├── main.js          # Electron main process
│   └── preload.js       # Securely expose APIs to renderer
├── src/                 # React app
│   ├── components/
│   │   ├── Sidebar.jsx
│   │   ├── ChatArea.jsx
│   │   ├── Message.jsx
│   │   └── ...
│   ├── contexts/
│   │   ├── AuthContext.jsx
│   │   └── SocketContext.jsx
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   └── Home.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js (if using Tailwind)
```

---

## 1️⃣ Initialize the React + Vite project

Open a terminal in the root `whatsapp-clone/` folder (where `server/` is) and run:

```bash
npm create vite@latest client -- --template react
cd client
npm install
```

Now install additional dependencies:

```bash
npm install socket.io-client react-router-dom
npm install -D tailwindcss @tailwindcss/vite  # if using Tailwind v4, or postcss/autoprefixer for v3
```

If you prefer **plain CSS** or another library, say so and I’ll adjust. I’ll assume Tailwind for now.

---

## 2️⃣ Install Electron and configure it

Inside `client/`, install Electron and a helper to run Vite and Electron together:

```bash
npm install -D electron electron-builder concurrently wait-on
```

We’ll use `concurrently` to start both Vite dev server and Electron.

---

## 3️⃣ Set up Tailwind CSS (optional but recommended)

For Tailwind v4 (if that's what you installed), add to `vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

For Tailwind v3, you’d need `postcss.config.js` and `tailwind.config.js`. Let me know which version you prefer.

If you skip Tailwind, we’ll write simple CSS.

---

## 4️⃣ Create Electron main process files

Create `electron/main.js`:

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In development, load the Vite dev server
  if (isDev) {
    win.loadURL('http://localhost:5173'); // default Vite port
    win.webContents.openDevTools();
  } else {
    // In production, load the built index.html
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

Create `electron/preload.js`:

```javascript
const { contextBridge } = require('electron');

// Expose a safe API to the renderer (we'll expand later)
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});
```

---

## 5️⃣ Update `package.json` scripts

Add these scripts in `client/package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "electron:dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
  "electron:build": "vite build && electron-builder"
}
```

And add a `"main"` field pointing to the Electron entry:

```json
"main": "electron/main.js"
```

---

## 6️⃣ Configure Vite for Electron

In `vite.config.js`, ensure the base is set correctly so Electron can load files in production:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',   // important for Electron file:// loading
  server: {
    port: 5173,
  },
})
```

---

## 7️⃣ Create the Auth Context (JWT + User State)

Create `src/contexts/AuthContext.jsx`:

```jsx
import { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);

  // Fetch user profile using the token (optional, if server provides /api/auth/me)
  const loadUser = async () => {
    if (!token) return;
    try {
      const res = await fetch('http://localhost:5000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
      } else {
        logout();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token) loadUser();
  }, [token]);

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    setToken(token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

> **Note:** You need to add a `/api/auth/me` route on the server that returns the current user. It’s simple – I’ll give you that route below.

---

## 8️⃣ Server: Add `/api/auth/me` endpoint

In `routes/auth.route.js` (or your auth route file), add:

```javascript
// @route   GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});
```

Make sure `protect` is the auth middleware. This returns the logged-in user.

---

## 9️⃣ Create Login & Register Pages

**`src/pages/Login.jsx`**:

```jsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        login({ _id: data._id, username: data.username, email: data.email }, data.token);
        navigate('/');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md w-80">
        <h2 className="text-2xl font-bold mb-4">Login</h2>
        {error && <p className="text-red-500 mb-2">{error}</p>}
        <input className="w-full border p-2 mb-3" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="w-full border p-2 mb-3" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="w-full bg-blue-500 text-white p-2 rounded" type="submit">Login</button>
        <p className="mt-2 text-sm">Don't have an account? <Link to="/register" className="text-blue-500">Register</Link></p>
      </form>
    </div>
  );
};

export default Login;
```

**`src/pages/Register.jsx`**:

```jsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        login({ _id: data._id, username: data.username, email: data.email }, data.token);
        navigate('/');
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md w-80">
        <h2 className="text-2xl font-bold mb-4">Register</h2>
        {error && <p className="text-red-500 mb-2">{error}</p>}
        <input className="w-full border p-2 mb-3" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <input className="w-full border p-2 mb-3" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="w-full border p-2 mb-3" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="w-full bg-green-500 text-white p-2 rounded" type="submit">Register</button>
        <p className="mt-2 text-sm">Already have an account? <Link to="/login" className="text-blue-500">Login</Link></p>
      </form>
    </div>
  );
};

export default Register;
```

---

## 🔟 Set up routing and main App

**`src/App.jsx`**:

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';

const PrivateRoute = ({ children }) => {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
```

---

## 1️⃣1️⃣ Create the Home page: Sidebar + Chat Area

We’ll need a Socket.io connection and conversation fetching. I’ll give you a simplified but functional version.  

**`src/pages/Home.jsx`**:

```jsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket'; // we'll create this hook
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';

const Home = () => {
  const { token, user, logout } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const socket = useSocket(token);

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    const res = await fetch('http://localhost:5000/api/chat/conversations', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) setConversations(data.data);
  };

  // Join conversation room and fetch messages when active conversation changes
  useEffect(() => {
    if (!activeConversation) return;
    // Fetch messages
    fetchMessages(activeConversation._id);
    // Join socket room
    socket?.emit('joinConversation', activeConversation._id);
  }, [activeConversation]);

  const fetchMessages = async (conversationId) => {
    const res = await fetch(`http://localhost:5000/api/chat/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) setMessages(data.data);
  };

  // Listen for new messages via socket
  useEffect(() => {
    if (!socket) return;
    socket.on('newMessage', (message) => {
      // If the message belongs to the active conversation, add it to messages
      if (activeConversation && message.conversation === activeConversation._id) {
        setMessages(prev => [...prev, message]);
      }
      // Update conversation list order (or last message) – you can refresh list or update locally
      fetchConversations(); // simple refresh for now
    });

    // Listen for new conversations (when someone creates a chat with you)
    socket.on('newConversation', () => {
      fetchConversations();
    });

    return () => {
      socket.off('newMessage');
      socket.off('newConversation');
    };
  }, [socket, activeConversation]);

  const sendMessage = (text) => {
    if (!socket || !activeConversation) return;
    socket.emit('sendMessage', { conversationId: activeConversation._id, text }, (response) => {
      if (response.error) {
        console.error(response.error);
      }
      // Response with the saved message (optional)
    });
  };

  return (
    <div className="flex h-screen">
      <Sidebar
        conversations={conversations}
        activeConversation={activeConversation}
        setActiveConversation={setActiveConversation}
        user={user}
        logout={logout}
      />
      <ChatArea
        conversation={activeConversation}
        messages={messages}
        sendMessage={sendMessage}
      />
    </div>
  );
};

export default Home;
```

---

## 1️⃣2️⃣ Create a custom Socket Hook

**`src/hooks/useSocket.js`**:

```javascript
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export const useSocket = (token) => {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    socketRef.current = io('http://localhost:5000', {
      auth: { token },
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to server');
    });

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected');
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [token]);

  return socketRef.current;
};
```

---

## 1️⃣3️⃣ Create Sidebar & ChatArea Components (minimal)

**`src/components/Sidebar.jsx`**:

```jsx
const Sidebar = ({ conversations, activeConversation, setActiveConversation, user, logout }) => {
  return (
    <div className="w-1/3 bg-gray-200 h-full flex flex-col">
      <div className="p-4 bg-gray-300 flex justify-between items-center">
        <span>{user?.username}</span>
        <button onClick={logout} className="text-red-500">Logout</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map(conv => (
          <div
            key={conv._id}
            className={`p-3 border-b cursor-pointer ${activeConversation?._id === conv._id ? 'bg-blue-100' : ''}`}
            onClick={() => setActiveConversation(conv)}
          >
            {conv.isGroup ? conv.groupName : conv.participants.find(p => p._id !== user._id)?.username}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
```

**`src/components/ChatArea.jsx`**:

```jsx
import { useState } from 'react';

const ChatArea = ({ conversation, messages, sendMessage }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input.trim());
      setInput('');
    }
  };

  if (!conversation) {
    return <div className="w-2/3 h-full flex items-center justify-center text-gray-500">Select a conversation</div>;
  }

  return (
    <div className="w-2/3 h-full flex flex-col">
      <div className="p-4 bg-gray-300 font-bold">
        {conversation.isGroup ? conversation.groupName : conversation.participants.find(p => p._id !== conversation.participants[0]?._id)?.username}
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        {messages.map(msg => (
          <div key={msg._id} className={`mb-2 ${msg.sender._id === conversation.participants[0]?._id ? 'text-left' : 'text-right'}`}>
            <span className="bg-white p-2 rounded inline-block">{msg.text}</span>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="p-4 bg-gray-200 flex">
        <input className="flex-1 p-2 border rounded" value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message..." />
        <button className="ml-2 px-4 py-2 bg-blue-500 text-white rounded" type="submit">Send</button>
      </form>
    </div>
  );
};

export default ChatArea;
```

---

## 1️⃣4️⃣ Start the Electron dev environment

Make sure the server is running (`npm start` in `server/`). Then in `client/`:

```bash
npm run electron:dev
```

This will start Vite on port 5173, wait for it, then launch Electron pointing to it. You should see the login page.

---

## 🔜 Next improvements:

- Group creation UI, typing indicators, online status, proper message alignment, read receipts, dark mode.
- Better state management (useContext for socket and messages).
- Production build with `electron-builder`.

For now, test the basic flow: register two users, create a conversation, send messages.

Let me know if you encounter any issues, and I’ll help you adjust! We’re now on the exciting final stretch 🥳





