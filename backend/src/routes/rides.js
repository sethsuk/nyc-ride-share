const express = require('express');
const pool = require('../config/db.js');

require('dotenv').config();

const router = express.Router();

// GET dummy endpoint
router.get('/test', async (req, res) => {
    try {
        const dummyQuery = await pool.query('SELECT * FROM weather LIMIT 5');

        const weather = dummyQuery.rows;

        res.status(200).json({ weather });
    } catch (err) {
        console.error(err);
        res.status(401).json({ message: "error" });
    }
});

router.get('/avgFareWeather', async (req, res, next) => {
    console.log("Avg Fare Weather Called");

    const temp  = parseFloat(req.query.temperature);
    const rain  = parseFloat(req.query.rain);
    const wind = parseFloat(req.query.wind_speed);

    if ([temp, rain, wind].some(Number.isNaN)) {
        return res.status(400).json({ error: 'temperature, rain, and wind_speed must be numeric query parameters' });
    }

    try {
        const sql = `
            SELECT AVG(u.total_fare) AS avg_fare
            FROM uber_rides u
            JOIN weather w
                ON u.request_hour = w.time
            WHERE w.temperature BETWEEN $1 - 2 AND $1 + 2
            AND w.rain BETWEEN $2 - 0.1 AND $2 + 0.1
            AND w.wind_speed BETWEEN $3 - 1 AND $3 + 1;
        `;
        const { rows } = await pool.query(sql, [temp, rain, wind]);

        if (!rows[0].avg_fare) {
            return res.status(404).json({ error: 'No rides matched those conditions' });
        }

        res.status(200).json({ averageFare: Number(rows[0].avg_fare) });
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: 'Database error'})
    }
  });

module.exports = router;