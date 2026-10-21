require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { connectDB } = require('./config/db');
const { seedAll } = require('./data/seed');
const apiRoutes = require('./routes/api');
const { securityHeaders, apiRateLimiter } = require('./middleware/security');
const { notFoundHandler, centralErrorHandler } = require('./middleware/errorHandler');
const correlationIdMiddleware = require('./middleware/correlationId');
const healthController = require('./controllers/healthController');
const logger = require('./utils/logger');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Correlation ID & Security Middleware
app.use(correlationIdMiddleware);
app.use(securityHeaders);
app.use(cors({
  origin: CORS_ORIGIN === '*' ? '*' : [CORS_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiRateLimiter);

// Health & Readiness Probes (Root level)
app.get('/health', healthController.getHealth);
app.get('/ready', healthController.getReadiness);

// API Routes
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to JammuMove API Services',
    status: 'Online',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Central 404 & Error Handling
app.use(notFoundHandler);
app.use(centralErrorHandler);

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN === '*' ? '*' : [CORS_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

// Map to track active simulations by tripId to prevent double loops
const activeSimulations = new Map();

// Socket.IO Logic
io.on('connection', (socket) => {
  // User joins a ride-tracking room
  socket.on('joinTrip', async ({ tripId }) => {
    if (!tripId || typeof tripId !== 'string') return;
    const sanitizedTripId = tripId.trim();
    socket.join(sanitizedTripId);

    // If tripId is an active carpool, trigger the simulated movement
    if (!activeSimulations.has(sanitizedTripId)) {
      startTripSimulation(sanitizedTripId);
    }
  });

  // User leaves a ride room
  socket.on('leaveTrip', ({ tripId }) => {
    if (!tripId || typeof tripId !== 'string') return;
    socket.leave(tripId.trim());
  });

  // Send real-time chat messages
  socket.on('sendChatMessage', ({ tripId, senderName, content }) => {
    if (!tripId || !content || typeof content !== 'string') return;
    const cleanContent = content.trim();
    if (cleanContent.length === 0 || cleanContent.length > 500) return;

    const messageData = {
      senderName: typeof senderName === 'string' && senderName.trim().length > 0 ? senderName.trim().slice(0, 50) : 'Commuter',
      content: cleanContent,
      createdAt: new Date().toISOString()
    };
    io.to(tripId.trim()).emit('newChatMessage', messageData);
  });

  // Driver Location Update override
  socket.on('driverLocationUpdate', ({ tripId, lat, lng }) => {
    if (!tripId || typeof lat !== 'number' || typeof lng !== 'number') return;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    io.to(tripId.trim()).emit('locationUpdate', { lat, lng });
  });

  socket.on('disconnect', () => {
    // Clean disconnection
  });
});

// Live Location Simulation Helper
const dbService = require('./data/dbService');

async function startTripSimulation(tripId) {
  try {
    const trip = await dbService.findById('trips', tripId);
    if (!trip || trip.status !== 'active') return;

    const path = trip.path;
    if (!path || path.length < 2) return;
    
    // Generate fine-grained subpoints between route checkpoints for smooth motion
    const interpolatedPoints = [];
    const stepsPerSegment = 20;

    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i];
      const end = path[i + 1];
      
      for (let step = 0; step < stepsPerSegment; step++) {
        const ratio = step / stepsPerSegment;
        interpolatedPoints.push({
          lat: Number((start.lat + (end.lat - start.lat) * ratio).toFixed(6)),
          lng: Number((start.lng + (end.lng - start.lng) * ratio).toFixed(6)),
          checkpoint: step === 0 ? start.name : null
        });
      }
    }
    interpolatedPoints.push({
      ...path[path.length - 1],
      checkpoint: path[path.length - 1].name
    });

    let currentIndex = 0;
    io.to(tripId).emit('locationUpdate', interpolatedPoints[0]);

    const intervalId = setInterval(() => {
      if (currentIndex >= interpolatedPoints.length - 1) {
        io.to(tripId).emit('destinationReached', { message: 'Destination reached' });
        clearInterval(intervalId);
        activeSimulations.delete(tripId);
        dbService.findByIdAndUpdate('trips', tripId, { status: 'completed' });
        return;
      }

      currentIndex++;
      const currentPoint = interpolatedPoints[currentIndex];
      io.to(tripId).emit('locationUpdate', currentPoint);
    }, 1500);

    activeSimulations.set(tripId, intervalId);
  } catch (err) {
    console.error('Error in trip simulation:', err);
  }
}

// Connect Database & Start Server only if directly executed (never in test runs)
const isTestRunner = 
  process.env.NODE_ENV === 'test' ||
  process.execArgv.some(arg => arg.includes('test')) ||
  process.argv.some(arg => arg.includes('test')) ||
  require.main !== module;

if (!isTestRunner) {
  connectDB().then(() => {
    seedAll().then(() => {
      server.listen(PORT, () => {
        console.log(`[JammuMove Server] Listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
      });
    });
  });
}

// Graceful Shutdown & Process Lifecycle Handlers
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Initiating graceful server shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed.');

    // Clear all active trip simulation intervals
    for (const [tripId, intervalId] of activeSimulations.entries()) {
      clearInterval(intervalId);
    }
    activeSimulations.clear();

    // Close Mongoose connection cleanly if open
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        await mongoose.connection.close(false);
        logger.info('MongoDB connection closed cleanly.');
      } catch (err) {
        logger.error('Error closing MongoDB connection:', { error: err.message });
      }
    }

    if (process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
  });

  // Force close if tasks take longer than 10 seconds
  setTimeout(() => {
    logger.error('Graceful shutdown timed out after 10s. Forcing exit.');
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection detected:', {
    reason: reason && reason.message ? reason.message : String(reason)
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception detected:', { error: err.message, stack: err.stack });
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
});

module.exports = app;
module.exports.app = app;
module.exports.server = server;
module.exports.io = io;
module.exports.gracefulShutdown = gracefulShutdown;
