// Ensure SRV/TXT resolution for MongoDB Atlas only on local Windows environments
if (process.platform === 'win32') {
  try {
    const dns = require('dns');
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  } catch {}
}
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
});

// Expose io to routes
app.set('io', io);

// CORS configuration (supports CLIENT_URL if provided, or allows all)
const allowedOrigins = process.env.CLIENT_URL ? [process.env.CLIENT_URL, '*'] : '*';
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'PG Fortune Fiesta API Server',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'connecting',
    time: new Date().toISOString(),
  });
});

// Auth route available immediately without waiting for DB
app.use('/api/auth', require('./routes/auth'));

// Connect to MongoDB with caching for serverless
let isConnected = false;
async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) return;
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/diwali_lucky_draw";
    if (!mongoUri) return;
    const conn = await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    isConnected = conn.connections[0].readyState === 1;
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
  }
}
connectDB();

// Middleware to ensure DB connection on serverless database queries
app.use(async (req, res, next) => {
  if (!isConnected || mongoose.connection.readyState !== 1) {
    await connectDB();
  }
  next();
});

// Business routes
app.use('/api/employees', require('./routes/employees'));
app.use('/api/prizes', require('./routes/prizes'));
app.use('/api/cards', require('./routes/cards'));
app.use('/api/game', require('./routes/game'));
app.use('/api/guests', require('./routes/guests')(io));

// Socket.IO
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// Only listen on a port if executed directly (e.g. `node server.js` locally)
// In Vercel serverless, do NOT call server.listen() to prevent EADDRINUSE crashes!
if (require.main === module && !process.env.VERCEL) {
  server.listen(process.env.PORT || 5000, () => {
    console.log(`Server running on port ${process.env.PORT || 5000}`);

    // Self-ping to prevent Render Free-tier instance from sleeping after 15m inactivity
    const renderUrl = process.env.RENDER_EXTERNAL_URL || 'https://pg-fortune-fiesta-server.onrender.com';
    try {
      const client = renderUrl.startsWith('https') ? require('https') : require('http');
      setInterval(() => {
        client.get(renderUrl, () => {}).on('error', () => {});
      }, 10 * 60 * 1000);
    } catch {}
  });
}

// Export Express app as request handler for Vercel Serverless
module.exports = app;
