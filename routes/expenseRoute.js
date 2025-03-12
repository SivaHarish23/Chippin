const express = require("express");
const router = express.Router();
const pool = require("../config/dbConfig");

router.post("/logExpense", async (req, res) => {
    try {
        const { amount, description, category, group_id, paid_by, split_type, split_details , chat_id } = req.body;

        // Validate required fields
        if (!amount || !description || !category || !group_id || !paid_by || !split_type || !chat_id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // ✅ Insert into expenses table
        const expenseResult = await pool.query(
            `INSERT INTO expenses (amount, description, category, group_id, paid_by, split_type, created_at , chat_id) 
            VALUES ($1, $2, $3, $4, $5, $6, NOW() , $7) RETURNING id;`,
            [amount, description, category, group_id, paid_by, split_type , chat_id]
        );

        const expense_id = expenseResult.rows[0].id;

        // ✅ Insert into splits table (if split_type is not "none")
        if (split_type !== "none" && Array.isArray(split_details)) {
            const splitPromises = split_details.map(({ user_id, per_share }) => {
                return pool.query(
                    `INSERT INTO splits (expense_id, user_id, per_share, chat_id) 
                    VALUES ($1, $2, $3, $4);`,
                    [expense_id, user_id, per_share, chat_id]
                );
            });

            await Promise.all(splitPromises);
        }

        return res.status(201).json({ message: "Expense logged successfully", expense_id });

    } catch (error) {
        console.error("Error logging expense:", error);
        return res.status(500).json({ error: "Internal Server Error" + error });
    }
});



module.exports = router;