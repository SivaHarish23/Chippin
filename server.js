const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/" , (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.use("/users" , authRoutes);


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));