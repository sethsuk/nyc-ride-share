const express = require('express');
const pool = require('../config/db.js');

require('dotenv').config();

const router = express.Router();

// GET dummy endpoint
router.get('/test', async (req, res) => {
    try {
        const dummyQuery = await pool.query('SELECT * FROM users');

        const allUsers = dummyQuery.rows;

        res.status(200).json({ allUsers });
    } catch (err) {
        console.error(err);
        res.status(401).json({ message: "error" });
    }
});

module.exports = router;