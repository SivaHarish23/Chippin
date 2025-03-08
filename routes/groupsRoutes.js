const express = require("express");
const router = express.Router();
const pool = require("../config/dbConfig");
const crypto = require("crypto");


// Function to generate a unique 6-character alphanumeric string
const generateCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();

router.post("/create", async (req, res) => {
    const { groupName, userId } = req.body;
    if (!groupName || !userId) {
        return res.status(400).json({ error: "Group name and user ID are required" });
    }
    try {
        // Check if group name already exists
        const groupCheck = await pool.query("SELECT id FROM groups WHERE group_name = $1", [groupName]);
        if (groupCheck.rowCount > 0) {
            return res.status(400).json({ message: "Group name already exists, please choose a different name" });
        }
        let groupCode;
        let isUnique = false;
        while (!isUnique) { // Keep generating new codes until we find a unique one
            groupCode = generateCode();
            const codeCheck = await pool.query("SELECT id FROM groups WHERE group_code = $1", [groupCode]);
            if (codeCheck.rowCount === 0) { isUnique = true; }
        }
        // Insert the new group into the database
        const newGroup = await pool.query(
            "INSERT INTO groups (group_name, group_code, host, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *",
            [groupName, groupCode, userId]
        );
        const group_code = newGroup.rows[0].group_code;
        const group_id = newGroup.rows[0].id;
        await pool.query(
            "INSERT INTO group_members (group_id, user_id, type) VALUES ($1, $2, $3)",
            [group_id, userId, "host"]
        );
        console.log(group_code);
        // Update the user's groups count
        await pool.query(
            "UPDATE users SET groups = groups + 1 WHERE id = $1",
            [userId]
        );
        res.status(201).json({ message: "Group created successfully", group: newGroup.rows[0] });
    } catch (err) {
        console.error("Error creating group:", err);
        res.status(500).json({ message: "Internal Server Error : " + err });
    }
});

router.get("/loadGroups", async (req, res) => {
    const { userId } = req.query; // Use query params instead of body for GET request
    if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
    }
    try {
        const groups = await pool.query(
            `SELECT g.* 
             FROM groups g
             JOIN group_members gm ON g.id = gm.group_id
             WHERE gm.user_id = $1`,
            [userId]
        );
        console.log(groups.rows);
        res.json(groups.rows); // Send the fetched groups data to the client
    } catch (error) {
        console.error("Error fetching groups:", error);
        res.status(500).json({ message: "Internal server error: " + error });
    }
});


router.post("/joinGroup", async (req, res) => {
    const { groupCode, userId } = req.body;

    if (!groupCode || !userId) {
        return res.status(400).json({ error: "Group code and user ID are required" });
    }

    try {
        // Get group details using groupCode
        const groupQuery = await pool.query("SELECT id, group_name FROM groups WHERE group_code = $1", [groupCode]);

        if (groupQuery.rowCount === 0) {
            return res.status(404).json({ message: "Group not found" });
        }

        const groupId = groupQuery.rows[0].id;
        const groupName = groupQuery.rows[0].group_name;

        // Check if user is already in the group
        const memberCheck = await pool.query("SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2", [groupId, userId]);

        if (memberCheck.rowCount > 0) {
            return res.status(400).json({ message: `You are already a member of '${groupName}'` });
        }

        // Add user to group_members table as 'member'
        await pool.query("INSERT INTO group_members (group_id, user_id, type) VALUES ($1, $2, $3)", [groupId, userId, "member"]);

        // Increment the member count in groups table
        await pool.query("UPDATE groups SET no_of_members = no_of_members + 1 WHERE id = $1", [groupId]);

        // Increment the groups count in users table
        await pool.query("UPDATE users SET groups = groups + 1 WHERE id = $1", [userId]);

        res.status(201).json({ message: `You have successfully joined '${groupName}'` });
    } catch (err) {
        console.error("Error joining group:", err);
        res.status(500).json({ message: "Internal Server Error: " + err });
    }
});


module.exports = router;