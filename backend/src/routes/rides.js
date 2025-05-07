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

// 1. Avg fare by weather
router.get('/avgFareWeather', async (req, res) => {
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
            JOIN weather w ON u.request_hour = w.time
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
        console.log(err);
        res.status(500).json({ error: 'Database error'});
    }
});

// 2. Avg fare by PU/DO + weather (with fallback)
router.get('/avgFareEstimate', async (req, res) => {
    const { puLocationId, doLocationId, temperature, rain, windSpeed, tripMiles } = req.query;

    try {
        const exactQuery = `
            SELECT AVG(U.total_fare) as avg_fare
            FROM Uber_Rides as U JOIN Weather as W
            ON u.request_hour = W.time
            WHERE U.PULocationID = $1 AND U.DOLocationID = $2
              AND W.temperature = $3 AND W.rain = $4 AND W.wind_speed = $5;
        `;
        const exactResult = await pool.query(exactQuery, [puLocationId, doLocationId, temperature, rain, windSpeed]);

        if (exactResult.rows[0].avg_fare) {
            return res.json({ avg_fare: exactResult.rows[0].avg_fare, method: "exact" });
        }

        if (!tripMiles) {
            return res.status(404).json({ error: 'No results for exact query and no fallback tripMiles provided' });
        }

        const fallbackQuery = `
            SELECT AVG(U.total_fare) as avg_fare
            FROM Uber_Rides as U JOIN Weather as W
            ON u.request_hour = W.time
            WHERE U.trip_miles BETWEEN $6 - 5 AND $6 + 5
              AND W.temperature BETWEEN $3 - 5 AND $3 + 5
              AND W.rain = $4 AND W.wind_speed BETWEEN $5 - 5 AND $5 + 5;
        `;
        const fallbackResult = await pool.query(fallbackQuery, [puLocationId, doLocationId, temperature, rain, windSpeed, tripMiles]);
        res.json({ avg_fare: fallbackResult.rows[0].avg_fare, method: "range" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// 3. Average trip time given weather and PU/DO
router.get('/averageTripTime', async (req, res) => {
    const { Pickup_id, Dropoff_id, Temperature, Rain, Wind_speed } = req.query;
    const sql = `
        SELECT AVG(U.trip_time) as avg_time
        FROM Uber_Rides as U JOIN Weather as W
        ON u.request_hour = W.time
        WHERE U.PULocationID = $1 AND U.DOLocationID = $2
          AND W.temperature BETWEEN $3 - 5 AND $3 + 5
          AND W.rain = $4 AND W.wind_speed BETWEEN $5 - 5 AND $5 + 5;
    `;
    try {
        const result = await pool.query(sql, [Pickup_id, Dropoff_id, Temperature, Rain, Wind_speed]);
        res.json({ avg_time: result.rows[0].avg_time });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// 4. Hourly ride count for above-average fares
router.get('/high-fare-hours', async (req, res) => {
    const sql = `
        SELECT EXTRACT(HOUR FROM request_datetime) AS hour,
               COUNT(*) AS ride_count,
               AVG(total_fare) AS avg_fare
        FROM Uber_Rides
        GROUP BY hour
        HAVING AVG(total_fare) > (
            SELECT AVG(total_fare) FROM Uber_Rides
        );
    `;
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// 5. Ride analysis under extreme weather by route
router.get('/stats/extreme-weather-routes', async (req, res) => {
    const sql = `
        SELECT T.PULocationID, T.DOLocationID, T.avg_fare, T.avg_trip_time, T.ride_count
        FROM (
            SELECT U.PULocationID, U.DOLocationID,
                   AVG(U.total_fare) AS avg_fare,
                   AVG(U.trip_time) AS avg_trip_time,
                   COUNT(*) AS ride_count
            FROM Uber_Rides U JOIN Weather W ON u.request_hour = W.time
            WHERE W.temperature > 85 OR W.temperature < 40 OR W.rain > 0
            GROUP BY U.PULocationID, U.DOLocationID
        ) T
        WHERE T.ride_count > (
            SELECT AVG(sub.ride_count)
            FROM (
                SELECT COUNT(*) AS ride_count
                FROM Uber_Rides
                GROUP BY PULocationID, DOLocationID
            ) sub
        );
    `;
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// 6. Rush vs. non-rush hour analysis
router.get('/rushHourAnalysis', async (req, res) => {
    const sql = `
        SELECT U.PULocationID,
               COUNT(*) AS total_rides,
               AVG(CASE WHEN EXTRACT(HOUR FROM request_datetime) BETWEEN 7 AND 9 OR EXTRACT(HOUR FROM request_datetime) BETWEEN 16 AND 18 THEN total_fare END) AS avg_fare_rush,
               AVG(CASE WHEN NOT (EXTRACT(HOUR FROM request_datetime) BETWEEN 7 AND 9 OR EXTRACT(HOUR FROM request_datetime) BETWEEN 16 AND 18) THEN total_fare END) AS avg_fare_nonrush,
               AVG(CASE WHEN EXTRACT(HOUR FROM request_datetime) BETWEEN 7 AND 9 OR EXTRACT(HOUR FROM request_datetime) BETWEEN 16 AND 18 THEN trip_time END) AS avg_trip_time_rush,
               AVG(CASE WHEN NOT (EXTRACT(HOUR FROM request_datetime) BETWEEN 7 AND 9 OR EXTRACT(HOUR FROM request_datetime) BETWEEN 16 AND 18) THEN trip_time END) AS avg_trip_time_nonrush
        FROM Uber_Rides U
        GROUP BY U.PULocationID
        HAVING COUNT(*) > 50
        ORDER BY U.PULocationID;
    `;
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// 7. Outlier rides
router.get('/outlierRides', async (req, res) => {
    const sql = `
        WITH ROUTE_STATS AS (
            SELECT ride_id, PULocationID, DOLocationID, total_fare, trip_time,
                   AVG(total_fare) OVER (PARTITION BY PULocationID, DOLocationID) AS avg_fare,
                   STDDEV(total_fare) OVER (PARTITION BY PULocationID, DOLocationID) AS std_fare,
                   AVG(trip_time) OVER (PARTITION BY PULocationID, DOLocationID) AS avg_trip_time,
                   STDDEV(trip_time) OVER (PARTITION BY PULocationID, DOLocationID) AS std_trip_time
            FROM Uber_Rides
        )
        SELECT * FROM ROUTE_STATS
        WHERE total_fare > avg_fare + 2 * std_fare
           OR trip_time > avg_trip_time + 2 * std_trip_time;
    `;
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// 8. Top 5 most similar rides
router.get('/similar', async (req, res) => {
    const { username, input_pu, input_do, input_time, input_temp, input_rain } = req.query;

    const sql = `
        SELECT * FROM (
            SELECT U.*, 
                   ABS(EXTRACT(EPOCH FROM (U.request_datetime - $1))) AS time_diff,
                   ABS(W.temperature - $2) AS temp_diff,
                   ABS(W.rain - $3) AS rain_diff,
                   (
                       ABS(EXTRACT(EPOCH FROM (U.request_datetime - $1))) / 3600.0 +
                       ABS(W.temperature - $2) +
                       ABS(W.rain - $3)
                   ) AS similarity_score
            FROM Uber_Rides U
            JOIN Weather W ON U.request_datetime = W.time
            JOIN user_rides UR ON U.ride_id = UR.ride_id
            JOIN users Us ON UR.username = Us.username
            WHERE Us.username = $4
              AND U.PULocationID = $5
              AND U.DOLocationID = $6
        ) sub
        ORDER BY similarity_score
        LIMIT 5;
    `;

    try {
        const result = await pool.query(sql, [input_time, input_temp, input_rain, username, input_pu, input_do]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// 9. Hourly user-aggregated ride stats by weather
router.get('/stats/hourly-user-aggregates', async (req, res) => {
    const sql = `
        SELECT hour, rain_status, SUM(total_revenue) AS total_revenue, 
               AVG(avg_trip_miles) AS avg_trip_miles, 
               SUM(ride_count) AS ride_count, 
               AVG(ride_count) AS avg_rides_per_user
        FROM (
            SELECT EXTRACT(HOUR FROM U.request_datetime) AS hour,
                   CASE WHEN W.rain > 0 THEN 'Rain' ELSE 'No Rain' END AS rain_status,
                   UR.username,
                   COUNT(*) AS ride_count,
                   SUM(U.total_fare) AS total_revenue,
                   AVG(U.trip_miles) AS avg_trip_miles
            FROM Uber_Rides U
            JOIN Weather W ON U.request_datetime = W.time
            JOIN user_rides UR ON U.ride_id = UR.ride_id
            JOIN Users S ON UR.username = S.username
            GROUP BY hour, rain_status, UR.username
        ) AS per_user
        GROUP BY hour, rain_status
        ORDER BY hour, rain_status;
    `;
    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;