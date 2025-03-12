const express = require("express");
const router = express.Router();
const pool = require("../config/dbConfig");

// Route to send a message
router.post("/send", async (req, res) => {
    try {
        const { user_id, group_id, message, type } = req.body;

        if (!user_id || !group_id || !message) {
            console.log(user_id);
            console.log(group_id);
            console.log(message);
            console.log(type);
            return res.status(400).json({ error: "All fields are required" });
        }

        const query = `
            INSERT INTO CHAT (user_id, group_id, message, type)
            VALUES ($1, $2, $3, $4) RETURNING *;
        `;

        const values = [user_id, group_id, message, type || "normal"];
        const result = await pool.query(query, values);

        res.status(201).json({ message: "Message sent successfully", chat: result.rows[0] });

    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Route to get messages of a group
router.get("/:groupId", async (req, res) => {
    try {
        const { groupId } = req.params;

        const query = `
            SELECT c.id as "chat_id", u.name as "userFullName", u.id AS "user_id", c.message, c.type, c.time, u.username 
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


// DELETE a chat message and its related expenses and splits
router.delete("/delete", async (req, res) => {
    const { chat_id } = req.query;

    try {
        await pool.query("BEGIN"); // Start transaction

        // Delete related records from `splits`
        await pool.query(
            "DELETE FROM splits WHERE expense_id IN (SELECT id FROM expenses WHERE chat_id = $1);",
            [chat_id]
        );

        // Delete related records from `expenses`
        await pool.query(
            "DELETE FROM expenses WHERE chat_id = $1;",
            [chat_id]
        );

        // Delete the chat message
        const result = await pool.query(
            "DELETE FROM CHAT WHERE id = $1 RETURNING *;",
            [chat_id]
        );

        await pool.query("COMMIT"); // Commit transaction

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Chat message not found" });
        }

        res.status(200).json({ message: "Chat and related records deleted successfully" });

    } catch (error) {
        await pool.query("ROLLBACK"); // Rollback in case of error
        console.error("Error deleting chat:", error);
        res.status(500).json({ error: "Internal Server Error : " + error });
    }
});

module.exports = router;
