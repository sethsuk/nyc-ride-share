const express = require('express');
const cors = require('cors');

const userRoutes = require('./routes/user.js');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/user', userRoutes)

module.exports = app;