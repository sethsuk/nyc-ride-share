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

// 10. Register user
router.post('/register', async (req, res) => {
    const { username, hashed_password } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO users (username, hashed_password) VALUES ($1, $2)',
            [username, hashed_password]
        );
        res.json({ message: 'User registered successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// 11. Login user
router.post('/login', async (req, res) => {
    const { username } = req.body;

    try {
        const result = await pool.query(
            'SELECT hashed_password FROM users WHERE username = $1',
            [username]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ hashed_password: result.rows[0].hashed_password });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// 12 & 13. Log Uber Ride & User Ride
router.post('/logUberRide', async (req, res) => {
  const {
    username,
    request_datetime,
    on_scene_datetime,
    trip_time,
    PULocationID,
    DOLocationID,
    trip_miles,
    tolls,
    total_fare,
    driver_pay,
    tips
  } = req.body;

  // Parse and validate datetime inputs
  const parsedRequestDatetime = new Date(request_datetime);
  const parsedOnSceneDatetime = new Date(on_scene_datetime);

  if (isNaN(parsedRequestDatetime) || isNaN(parsedOnSceneDatetime)) {
    console.error('invalid datetime input');
    return res.status(400).json({ error: 'Invalid datetime format' });
  }

  const request_hour = new Date(parsedRequestDatetime);
  request_hour.setMinutes(0, 0, 0);
  const requestHourISO = request_hour.toISOString();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');


    const insertRide = await client.query(`
  INSERT INTO Uber_Rides (
    request_datetime, on_scene_datetime, trip_time,
    PULocationID, DOLocationID, trip_miles, tolls,
    total_fare, driver_pay, tips, request_hour
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  RETURNING ride_id;
`, [
  parsedRequestDatetime.toISOString(),
  parsedOnSceneDatetime.toISOString(),
  trip_time,
  PULocationID,
  DOLocationID,
  trip_miles,
  tolls,
  total_fare,
  driver_pay,
  tips,
  requestHourISO
]);


    const ride_id = insertRide.rows[0].ride_id;

    await client.query(
      'INSERT INTO user_rides (username, ride_id) VALUES ($1, $2)',
      [username, ride_id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Ride logged successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error logging ride:', err);
    res.status(500).json({ error: 'Failed to log ride' });
  } finally {
    client.release();
  }
});

module.exports = router;