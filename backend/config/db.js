const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const mockDbPath = path.join(__dirname, '../data/db.json');

async function connectDB() {
  try {
    // Attempt to connect to local/env MongoDB with a 1.5-second timeout
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/jammumove', {
      serverSelectionTimeoutMS: 1500,
    });
    console.log('MongoDB Connected Successfully.');
    global.useMockDB = false;
  } catch (error) {
    console.warn('\x1b[33m%s\x1b[0m', 'WARNING: MongoDB connection failed or timed out.');
    console.warn('\x1b[33m%s\x1b[0m', 'Falling back to local JSON database for out-of-the-box demo...');
    global.useMockDB = true;
    initMockDB();
  }
}

function initMockDB() {
  const dataDir = path.dirname(mockDbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(mockDbPath)) {
    console.log('Initializing mock DB file...');
    const initialData = {
      users: [],
      drivers: [],
      vehicles: [],
      trips: [],
      bookings: [],
      busRoutes: [],
      messages: [],
      lostFound: [],
      notifications: [],
      complaints: [],
      expenses: []
    };
    fs.writeFileSync(mockDbPath, JSON.stringify(initialData, null, 2));
  }
}

// Ensure mock DB exists on load
initMockDB();

module.exports = { connectDB, initMockDB };
