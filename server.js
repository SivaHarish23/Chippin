const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const pool = require("./config/dbConfig"); // PostgreSQL connection
const authRoutes = require("./routes/authRoutes");
const groupRoutes = require("./routes/groupsRoutes");
const chatRoutes = require("./routes/chatRoutes");
const expenseRoutes = require("./routes/expenseRoute");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.use("/users", authRoutes);
app.use("/groups", groupRoutes);
app.use("/chat", chatRoutes);
app.use("/expense",expenseRoutes);

// 🚀 WebSocket Server Setup
const io = new Server(server, {
    cors: {
        origin: "*", // Allow frontend access
        methods: ["GET", "POST"]
    },
});

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("joinGroup", (groupId) => {
        socket.join(groupId);
        console.log(`User ${socket.id} joined group ${groupId}`);
    });
    
    // 📩 Listen for new messages from clients
    socket.on("sendMessage", async ({ type, message, user_id, username , userFullName, group_id } , callback) => {
        try {
            const query = `
                INSERT INTO CHAT (type, message, user_id, group_id) 
                VALUES ($1, $2, $3, $4) RETURNING *;
            `;
            const values = [type || "normal", message, user_id , group_id];
            const result = await pool.query(query, values);
            const newMessage = result.rows[0];

            console.log("newMsg : " + newMessage);
            newMessage.username = username;
            newMessage.userFullName = userFullName;

            io.to(group_id).emit("receiveMessage", newMessage); // Send message to group
            // Acknowledge successful message sending
            callback({ success: true });
        } catch (err) {
            console.error("Error saving message:", err);
            callback({ success: false });
        }
    });

    // 📢 User joins a group
    socket.on("joinGroup", (groupId) => {
        socket.join(groupId);
        console.log(`User ${socket.id} joined group ${groupId}`);
    });

    socket.on("disconnect", () => {
        console.log("A user disconnected:", socket.id);
    });
});

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));