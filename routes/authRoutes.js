const express = require("express");
const router = express.Router();
const pool = require("../config/dbConfig");

const { sendOTP, otpStore } = require("../utils/sendOTP");

const emailStore ={}; //store username and email for for forgot password verification

router.get("/chippin" , (req, res) => {
    res.json("Chippin Server Auth is running");
});

router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        console.log("Login request received for:", username);

        const userResult = await pool.query("SELECT * FROM users WHERE username = $1", [username]);

        console.log("Database query result:", userResult);

        if (!userResult.rows.length) {
            return res.status(400).json({ message: "Username not found!" });
        }

        const user = userResult.rows[0];

        if (user.password !== password) {
            return res.status(400).json({ message: "Invalid password!" });
        }

        res.status(200).json({ 
            message: "Login successful", 
            user: { id: user.id, username: user.username, userFullName: user.name } 
        });

    } catch (error) {
        console.error("❌ Error during login:", error);

        // Log the error details
        if (error instanceof AggregateError) {
            error.errors.forEach((err, index) => console.error(`Error ${index + 1}:`, err));
        }

        res.status(500).json({ message: "Server error", error: error.message });
    }
});

router.post("/verify", async (req, res) => {
    const { email, username } = req.body;
    try {
        const resultUser = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (resultUser.rows.length > 0) {
            console.log("Error: Username already exists!");
            return res.status(409).json({ message: "Username already exists!" });
        }
        const resultEmail = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (resultEmail.rows.length > 0) {
            console.log("Error: Username already exists!");
            return res.status(409).json({ message: "Email already exists!" });
        }
        console.log("Username and Email are available.");
        await sendOTP(email);
        res.status(200).json({ message: "OTP sent to email!" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error });
    }
});

router.post("/register", async (req, res) => {
    const { name, email, username, password, otp } = req.body;
    if (!otpStore[email]) {
        return res.status(410).json({ message: "OTP expired. Request a new one." });
    }
    const { otp: storedOtp, expiry, attempts } = otpStore[email];
    if (Date.now() > expiry) {
        delete otpStore[email];
        return res.status(410).json({ message: "OTP expired. Request a new one." });
    }
    if (attempts >= 5) {
        delete otpStore[email];
        return res.status(410).json({ message: "Too many failed attempts. Request a new OTP." });
    }
    if (otp !== storedOtp) {
        otpStore[email].attempts += 1;
        return res.status(401).json({ message: `Invalid OTP. ${5 - otpStore[email].attempts} attempts left.` });
    }
    try {
        const userResult = await pool.query("INSERT INTO users (name, email, username, password, created_at) VALUES ($1 , $2 , $3 , $4 , NOW())", [name, email, username, password]);
        console.log("User inserted!");
        delete otpStore[email]; // Clear OTP after successful verification
        res.status(200).json({ message: "User Registered" });
    } catch (error) {
        console.error("Error during Signing up:", error);
        res.status(500).json({ message: error });
    }
    delete otpStore[email]; // Clear OTP after successful registration
});

router.post("/forgotPassword" , async (req , res) => {
    const { username } = req.body;
    try{
        const user = await pool.query("SELECT * FROM users WHERE username = $1" , [username]);
        if(user.rows.length === 0) {
            return res.status(400).json({ message : "Username not found!"});
        }
        console.log(user.rows[0]);
        emailStore[username] = user.rows[0].email;
        await sendOTP(emailStore[username]);
        res.status(200).json({ message: "OTP sent to email!" });
    } catch(error){
        console.log("Error during forgot password verification : " , error);
        res.status(500).json({ message: error });
    }
});

router.post("/verify-forgotOTP", async (req, res) => {
    const { username, otp } = req.body;
    const email = emailStore[username];
    if (!otpStore[email]) {
        return res.status(410).json({ message: "OTP expired. Request a new one." });
    }
    const { otp: storedOtp, expiry, attempts } = otpStore[email];
    if (Date.now() > expiry) {
        delete otpStore[email]; return res.status(410).json({ message: "OTP expired. Request a new one." });
    }
    if (attempts >= 5) {
        delete otpStore[email]; return res.status(410).json({ message: "Too many failed attempts. Request a new OTP." });
    }
    if (otp !== storedOtp) {
        otpStore[email].attempts += 1; return res.status(401).json({ message: `Invalid OTP. ${5 - otpStore[email].attempts} attempts left.` });
    }
    delete otpStore[username]; // OTP is correct, remove from storage
    res.json({ message: "OTP verified. Proceed to reset password." });
});

router.post("/resetPassword" , async (req , res) => {
    const { username, password } = req.body;
    try {
        await pool.query("UPDATE users SET password = $2 WHERE username = $1", [ username , password ]);
        res.json({ message: "Password updated successfully. Please log in." });
    } catch (error) {
        res.status(500).json({ message: error, error: error.message });
    }
});



module.exports = router;