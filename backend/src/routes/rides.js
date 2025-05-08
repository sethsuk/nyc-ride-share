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
router.get('/avgFareweather', async (req, res) => {
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
            WHERE w.temperature BETWEEN $1 - 1 AND $1 + 1
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
            FROM uber_rides as U JOIN weather as W
            ON U.request_hour = W.time
            WHERE U.pulocationid = $1 AND U.dolocationid = $2
                AND W.temperature BETWEEN $3 - 1 AND $3 + 1
                AND W.rain BETWEEN $4 - 0.1 AND $4 + 0.1
                AND W.wind_speed BETWEEN $5 - 1 AND $5 + 1
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
            FROM uber_rides as U JOIN weather as W
            ON u.request_hour = W.time
            WHERE U.trip_miles BETWEEN $6 - 5 AND $6 + 5
                AND W.temperature BETWEEN $3 - 1 AND $3 + 1
                AND W.rain BETWEEN $4 - 0.1 AND $4 + 0.1
                AND W.wind_speed BETWEEN $5 - 1 AND $5 + 1;
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
        FROM uber_rides as U JOIN weather as W
        ON U.request_hour = W.time
        WHERE U.pulocationid = $1 AND U.dolocationid = $2
            AND W.temperature BETWEEN $3 - 1 AND $3 + 1
            AND W.rain BETWEEN $4 - 0.1 AND $4 + 0.1
            AND W.wind_speed BETWEEN $5 - 1 AND $5 + 1;
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
        SELECT hour, ride_count, avg_fare
        FROM mv_hourly_ride_stats
        WHERE avg_fare > (SELECT AVG(avg_fare) FROM mv_hourly_ride_stats);
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
        SELECT
            pulocationid,
            dolocationid,
            avg_fare,
            avg_trip_time,
            ride_count
        FROM
            mv_extreme_weather_stats
        WHERE
            ride_count > (
                SELECT AVG(ride_count)
                FROM mv_extreme_weather_stats
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
router.get('/rush-hour-analysis', async (req, res) => {
    const sql = `
        SELECT * FROM mv_rush_hour_stats ORDER BY pulocationid;
    `;

    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// 7. Outlier rides
router.get('/outlier-rides', async (req, res) => {
    console.log("called outlier-rides")
    const sql = `
        SELECT
            u.ride_id,
            u.pulocationid,
            u.dolocationid,
            u.total_fare,
            u.trip_time,
            rs.avg_fare,
            rs.std_fare,
            rs.avg_trip_time,
            rs.std_trip_time
        FROM
            uber_rides u
            JOIN mv_route_stats rs ON u.pulocationid = rs.pulocationid
            AND u.dolocationid = rs.dolocationid
        WHERE
            u.total_fare > rs.avg_fare + 2 * rs.std_fare
            OR u.trip_time > rs.avg_trip_time + 2 * rs.std_trip_time
        LIMIT 5;
    `;

    try {
        const result = await pool.query(sql);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// 8. Statistics about user's hourly rides and the price difference
router.get('/user-hourly-stats', async (req, res) => {
    const { username } = req.query;

    const sql = `
        WITH user_hourly AS (
            SELECT
                u.request_hour,
                AVG(u.total_fare) AS user_avg_fare
            FROM user_rides ur
            JOIN uber_rides u
            ON ur.ride_id = u.ride_id
            WHERE ur.username = $1
            GROUP BY u.request_hour
        ),
        filtered_global AS (
            SELECT
                m.hour,
                m.avg_fare AS global_avg_fare
            FROM mv_hourly_ride_stats m
            WHERE EXISTS (
                SELECT 1
                FROM user_hourly uh
                WHERE uh.request_hour = m.hour
            )
        )
        SELECT
            f.hour,
            uh.user_avg_fare,
            f.global_avg_fare,
            (uh.user_avg_fare - f.global_avg_fare) AS fare_diff
        FROM filtered_global f
        JOIN user_hourly uh
        ON uh.request_hour = f.hour
        ORDER BY fare_diff DESC;
    `;

    try {
        const result = await pool.query(sql, [username]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// 9. Hourly user-aggregated ride stats by weather
router.get('/hourly-user-aggregates', async (req, res) => {
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
            JOIN Weather W ON U.request_hour = W.time
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

// 10. Similar users that might carpool together
router.get('/carpool', async (req, res) => {
    const { username } = req.query;

    const sql = `
        WITH user_features AS (
            SELECT
                ur.username,
                AVG(EXTRACT(HOUR FROM u.request_datetime)) AS avg_hour,
                AVG(w.temperature) AS avg_temp,
                AVG(w.rain) AS avg_rain,
                AVG(u.trip_time) AS avg_trip_time,
                AVG(u.trip_miles) AS avg_trip_miles,
                COUNT(*) AS total_rides
            FROM user_rides ur
                JOIN uber_rides u ON ur.ride_id = u.ride_id
                JOIN weather w ON u.request_hour = w."time"
            GROUP BY ur.username
        ), target AS (
            SELECT * 
            FROM user_features
            WHERE username = $1 
        )
        SELECT
            uf.username,
            ABS(uf.avg_hour - t.avg_hour)
                + ABS(uf.avg_temp - t.avg_temp)
                + ABS(uf.avg_rain - t.avg_rain)
                + ABS(uf.avg_trip_time - t.avg_trip_time)
                + ABS(uf.avg_trip_miles - t.avg_trip_miles)
            AS similarity_score
        FROM user_features uf
        CROSS JOIN target t
        WHERE uf.username <> t.username
        ORDER BY similarity_score
        LIMIT 5;
    `;
    try {
        const result = await pool.query(sql, [username]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// 11. overpaid
router.get('/overpaid', async (req, res) => {
    const { username } = req.query;

    const sql = `
        WITH user_corridor_fares AS (
            SELECT
                r.pulocationid,
                r.dolocationid,
                AVG(r.total_fare) AS user_avg_fare
            FROM user_rides ur
            JOIN uber_rides r ON ur.ride_id = r.ride_id
            WHERE ur.username = $1
            GROUP BY r.pulocationid, r.dolocationid
        ),
        joined_stats AS (
            SELECT
                ucf.user_avg_fare,
                mv.avg_fare AS overall_avg_fare
            FROM user_corridor_fares ucf
            JOIN mv_route_stats mv
            ON ucf.pulocationid = mv.pulocationid AND ucf.dolocationid = mv.dolocationid
        )
        SELECT
            AVG(user_avg_fare - overall_avg_fare) AS avg_fare_difference
        FROM joined_stats
        WHERE EXISTS (
            SELECT 1
            FROM joined_stats js
            WHERE js.user_avg_fare > js.overall_avg_fare
        );
    `;
    try {
        const result = await pool.query(sql, [username]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;