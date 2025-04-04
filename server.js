// backend/server.js
const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

mongoose.connect(
  "mongodb+srv://sfayazmr:Abcdef067@cluster01.ibbs2.mongodb.net/chatDB?retryWrites=true&w=majority",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
)
  .then(() => console.log("MongoDB connected successfully!"))
  .catch((err) => console.error("MongoDB connection error:", err));

// User Schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});
const User = mongoose.model("User", userSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  messageText: { type: String, default: "" },
  timestamp: { type: Date, default: Date.now },
  file: {
    name: { type: String },
    type: { type: String },
    data: { type: Buffer }, // Ensure data is stored as Buffer
  },
});
const Message = mongoose.model("Message", messageSchema);

// User Registration
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// User Login
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ username }, "secretKey", { expiresIn: "1h" });
    res.json({ token, username });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch Messages
app.get("/api/messages", async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch User List
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find().select("username");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Socket.io for Real-time Chat
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("sendMessage", async ({ sender, receiver, messageText, file }) => {
    try {
      let newMessageData = { sender, receiver, timestamp: Date.now() };
  
      if (file) {
        newMessageData.file = {
          name: file.name,
          type: file.type,
          data: Buffer.from(file.data, "base64"), // Convert base64 to Buffer
        };
      } else {
        newMessageData.messageText = messageText;
      }
  
      const newMessage = new Message(newMessageData);
      await newMessage.save();
  
      io.emit("newMessage", newMessage);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  });
  
  socket.on("typing", ({ user, isTyping }) => {
    io.emit("typing", { user, isTyping });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Edit Message
app.put("/api/messages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { messageText } = req.body;

    const message = await Message.findByIdAndUpdate(
      id,
      { messageText },
      { new: true }
    );
    if (!message) return res.status(404).json({ message: "Message not found" });

    res.json({ message: "Message updated successfully", updatedMessage: message });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete Message
app.delete("/api/messages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const message = await Message.findByIdAndDelete(id);
    if (!message) return res.status(404).json({ message: "Message not found" });

    res.json({ message: "Message deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Start Server
server.listen(5000, () => console.log("Server running on port 5000"));
