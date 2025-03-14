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
            share: 0.00,
            personal : 0.00
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
            if (member && member.split_type !== 'none') {
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

router.get("/personalExpense", async (req, res) => {
    try {
        const { user_id } = req.query;

        if (!user_id) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const query = `
            SELECT 
                e.id AS expense_id,
                TO_CHAR(e.created_at, 'HH24:MI') AS time,
                TO_CHAR(e.created_at, 'DD/MM/YYYY') AS date,
                u.id AS user_id,
                u.username,
                u.name AS userFullName,
                e.amount AS "Amount",
                COALESCE(s.per_share, 0) AS "My Share",
                e.group_id,
                g.group_name AS groupName,
                e.chat_id
            FROM expenses e
            LEFT JOIN splits s ON e.id = s.expense_id AND s.user_id = $1
            JOIN users u ON e.paid_by = u.id
            JOIN groups g ON e.group_id = g.id
            WHERE e.paid_by = $1 OR s.user_id = $1
            ORDER BY e.created_at DESC;
        `;

        const rows = await pool.query(query, [user_id]);

        res.json(rows.rows);
    } catch (error) {
        console.error("Error fetching personal expense history:", error);
        res.status(500).json({ error: "Internal Server Error: " + error.message });
    }
});


router.get("/oweDetails", async (req, res) => {
    try {
        const { user_id } = req.query;
        if (!user_id) {
            return res.status(400).json({ error: "user_id is required" });
        }

        const query = `
            WITH amount_owed AS (
                SELECT COALESCE(SUM(per_share), 0) AS owes_others
                FROM splits s
                JOIN expenses e ON s.expense_id = e.id
                WHERE s.user_id = $1 AND e.paid_by <> $1
            ),
            amount_to_get AS (
                SELECT COALESCE(SUM(per_share), 0) AS others_owe
                FROM splits s
                JOIN expenses e ON s.expense_id = e.id
                WHERE e.paid_by = $1 AND s.user_id <> $1
            )
            SELECT owes_others, others_owe FROM amount_owed, amount_to_get;
        `;

        const { rows } = await pool.query(query, [user_id]);
        res.json(rows[0]); // Returns { owes_others: 1500.00, others_owe: 2000.00 }
        
    } catch (error) {
        console.error("Error fetching user balance:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});




module.exports = router;