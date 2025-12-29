require('dotenv').config();
const express = require('express');
const db = require('./database');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));

const allowedDevOrigins = new Set([
  'http://localhost:19006',
  'http://127.0.01:19006',
  'http://localhost:8081',
  'http://127.0.01:8081',
])

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedDevOrigins.DevOrigins.has(origin)) return callback(null, true);

      return callback(new Error('CORS blocked origin: ${origin}'));
    },
    credentials: true,
  })
);

// Middleware to parse JSON
app.use(express.json());

// Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  const isCorsError = typeof err.message === 'string' && err.message.startsWith('CORS blocked origin');
  if (isCorsError) {
    return res.status(403).json({ error: err.message });
  }

  res.status(500).json({ error: 'Internal Server Error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
