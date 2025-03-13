const express = require("express");
const router = express.Router();
const pool = require("../config/dbConfig");

router.post("/logExpense", async (req, res) => {
    try {
        const { amount, description, category, group_id, paid_by, split_type, split_details, chat_id } = req.body;

        // Validate required fields
        if (!amount || !description || !category || !group_id || !paid_by || !split_type || !chat_id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // ✅ Insert into expenses table
        const expenseResult = await pool.query(
            `INSERT INTO expenses (amount, description, category, group_id, paid_by, split_type, created_at , chat_id) 
            VALUES ($1, $2, $3, $4, $5, $6, NOW() , $7) RETURNING id;`,
            [amount, description, category, group_id, paid_by, split_type, chat_id]
        );

        const expense_id = expenseResult.rows[0].id;

        // ✅ Insert into splits table (if split_type is not "none")
        if (split_type !== "none" && Array.isArray(split_details)) {
            const splitPromises = split_details.map(({ user_id, per_share }) => {
                return pool.query(
                    `INSERT INTO splits (expense_id, user_id, per_share, chat_id , group_id) 
                    VALUES ($1, $2, $3, $4 , $5);`,
                    [expense_id, user_id, per_share, chat_id, group_id]
                );
            });

            await Promise.all(splitPromises);
        }

        return res.status(201).json({ message: "Expense logged successfully", expense_id });

    } catch (error) {
        console.error("Error logging expense:", error);
        return res.status(500).json({ error: "Internal Server Error" , error });
    }
});

router.get("/groupInfo", async (req, res) => {
    try {
        const { group_id } = req.query;

        if (!group_id) {
            return res.status(400).json({ error: "group_id is required" });
        }

        // Step 1: Get group members
        const membersQuery = `
            SELECT gm.user_id, u.username, u.name 
            FROM group_members gm 
            JOIN users u ON gm.user_id = u.id 
            WHERE gm.group_id = $1;
        `;
        const membersResult = await pool.query(membersQuery, [group_id]);

        console.log("membersResult");
        console.log(membersResult);

        let members = membersResult.rows.map(member => ({
            user_id: member.user_id,
            username: member.username,
            name: member.name,
            paid: 0.00,
            share: 0.00
        }));

        console.log("members");
        console.log(members);

        // Step 2: Get amount paid by each member
        const paidQuery = `
            SELECT paid_by, SUM(amount) AS total_paid, split_type 
            FROM expenses 
            WHERE group_id = $1 
            GROUP BY paid_by, split_type;
        `;
        const paidResult = await pool.query(paidQuery, [group_id]);

        // Update members with paid amount
        paidResult.rows.forEach(expense => {
            const member = members.find(m => m.user_id === expense.paid_by);
            if (member) {
                member.paid += parseFloat(expense.total_paid) || 0;
            }
        });

        // Step 3: Get share amount from splits table
        const shareQuery = `
            SELECT user_id, SUM(per_share) AS total_share 
            FROM splits 
            WHERE group_id = $1 
            GROUP BY user_id;
        `;
        const shareResult = await pool.query(shareQuery, [group_id]);

        // Update members with share amount
        shareResult.rows.forEach(split => {
            const member = members.find(m => m.user_id === split.user_id);
            if (member) {
                member.share += parseFloat(split.total_share) || 0;
            }
        });

        // Step 4: Handle 'none' split type (add full expense amount as share)
        paidResult.rows.forEach(expense => {
            if (expense.split_type === "none") {
                const member = members.find(m => m.user_id === expense.paid_by);
                if (member) {
                    member.share += parseFloat(expense.total_paid) || 0;
                }
            }
        });

        // Remove user_id before sending response
        const result = members.map(({ user_id, ...rest }) => ({
            ...rest,
            paid: parseFloat(rest.paid.toFixed(2)),
            share: parseFloat(rest.share.toFixed(2))
        }));
        console.log(result);

        res.json(result);
    } catch (error) {
        console.error("Error fetching group info:", error);
        res.status(500).json({ error: "Internal Server Error : " , error });
    }
});




module.exports = router;