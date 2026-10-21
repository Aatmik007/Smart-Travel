const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const mockDbPath = path.join(__dirname, '..', 'data', 'db.json');

const healthController = {
  getHealth(req, res) {
    res.status(200).json({
      status: 'UP',
      service: 'jammumove-backend',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || 'development'
    });
  },

  getReadiness(req, res) {
    const isMockMode = global.useMockDB || !(mongoose.connection && mongoose.connection.readyState === 1);
    
    if (isMockMode) {
      try {
        const canAccessMock = fs.existsSync(mockDbPath);
        if (canAccessMock) {
          return res.status(200).json({
            status: 'READY',
            database: 'ready',
            mode: 'mock_json',
            timestamp: new Date().toISOString()
          });
        } else {
          return res.status(503).json({
            status: 'NOT_READY',
            database: 'unreachable',
            mode: 'mock_json',
            message: 'Mock database store is not accessible.'
          });
        }
      } catch (err) {
        return res.status(503).json({
          status: 'NOT_READY',
          database: 'error',
          error: err.message
        });
      }
    } else {
      const readyState = mongoose.connection.readyState;
      // 1 = connected
      if (readyState === 1) {
        return res.status(200).json({
          status: 'READY',
          database: 'connected',
          mode: 'mongodb',
          timestamp: new Date().toISOString()
        });
      } else {
        return res.status(503).json({
          status: 'NOT_READY',
          database: 'disconnected',
          mode: 'mongodb',
          readyState,
          timestamp: new Date().toISOString()
        });
      }
    }
  }
};

module.exports = healthController;
