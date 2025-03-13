require("dotenv").config();
// const { Pool } = require("pg");

// const pool = new Pool({
//     user: process.env.DB_USER,
//     host: process.env.DB_HOST,
//     database: process.env.DB_NAME,
//     password: process.env.DB_PASS,
//     port: process.env.DB_PORT,
// });

// module.exports = pool;

const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,  // Important for Render
});

module.exports = pool;

