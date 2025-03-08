const express = require("express");
const router = express.Router();
const pool = require("../config/dbConfig");

// Route to send a message
// router.post("/send", async (req, res) => {
//     try {
//         const { user_id, group_id, message, type } = req.body;

//         if (!user_id || !group_id || !message) {
//             return res.status(400).json({ error: "All fields are required" });
//         }

//         const query = `
//             INSERT INTO CHAT (user_id, group_id, message, type)
//             VALUES ($1, $2, $3, $4) RETURNING *;
//         `;

//         const values = [user_id, group_id, message, type || "normal"];
//         const result = await pool.query(query, values);

//         res.status(201).json({ message: "Message sent successfully", chat: result.rows[0] });

//     } catch (error) {
//         console.error("Error sending message:", error);
//         res.status(500).json({ error: "Internal Server Error" });
//     }
// });

// Route to get messages of a group
router.get("/:groupId", async (req, res) => {
    try {
        const { groupId } = req.params;

        const query = `
            SELECT u.id AS "user_id", c.message, c.type, c.time, u.username 
            FROM CHAT c
            JOIN USERS u ON c.user_id = u.id
            WHERE c.group_id = $1
            ORDER BY c.time ASC;
        `;

        const result = await pool.query(query, [groupId]);
        
        res.status(200).json({ messages: result.rows });

    } catch (error) {
        console.error("Error retrieving messages:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
