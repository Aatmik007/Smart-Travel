const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Schemas = require('../models/Schemas');

const mockDbPath = path.join(__dirname, 'db.json');

const modelMap = {
  users: Schemas.User,
  drivers: Schemas.Driver,
  vehicles: Schemas.Vehicle,
  trips: Schemas.Trip,
  bookings: Schemas.Booking,
  busRoutes: Schemas.BusRoute,
  messages: Schemas.Message,
  lostFound: Schemas.LostFound,
  notifications: Schemas.Notification,
  complaints: Schemas.Complaint,
  expenses: Schemas.Expense
};

// Use Mongoose only if mock DB is not forced AND mongoose is actually connected
const shouldUseMongoose = () => {
  return !global.useMockDB && mongoose.connection && mongoose.connection.readyState === 1;
};

// Helper: Read JSON mock file
function readMockData() {
  try {
    const data = fs.readFileSync(mockDbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading mock database:', err);
    return {};
  }
}

// Helper: Write JSON mock file
function writeMockData(data) {
  try {
    fs.writeFileSync(mockDbPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing mock database:', err);
  }
}

// In-memory mutex lock for serializing mock DB writes during concurrent async requests
let mockLock = Promise.resolve();
function withMockLock(fn) {
  const next = mockLock.then(() => fn(), () => fn());
  mockLock = next.catch(() => {});
  return next;
}

// Helper: Filter items based on a simple query object with normalized ID checks and operator support
function matchQuery(item, query) {
  if (!item || typeof item !== 'object') return false;
  for (const key in query) {
    if (query[key] !== undefined) {
      const qVal = query[key];
      const itemVal = item[key];
      if (qVal === null && itemVal === null) continue;
      if (qVal === undefined) continue;

      // Operator support: $gte, $lte, $gt, $lt, $in, $ne
      if (typeof qVal === 'object' && qVal !== null && !Array.isArray(qVal) && !(qVal instanceof mongoose.Types.ObjectId)) {
        if (qVal.$gte !== undefined && (itemVal === undefined || Number(itemVal) < Number(qVal.$gte))) return false;
        if (qVal.$lte !== undefined && (itemVal === undefined || Number(itemVal) > Number(qVal.$lte))) return false;
        if (qVal.$gt !== undefined && (itemVal === undefined || Number(itemVal) <= Number(qVal.$gt))) return false;
        if (qVal.$lt !== undefined && (itemVal === undefined || Number(itemVal) >= Number(qVal.$lt))) return false;
        if (qVal.$ne !== undefined) {
          if (itemVal !== undefined && itemVal !== null && itemVal.toString() === qVal.$ne.toString()) return false;
          if (itemVal === qVal.$ne) return false;
        }
        if (qVal.$in !== undefined && Array.isArray(qVal.$in)) {
          const inMatch = qVal.$in.some(v => 
            (itemVal !== undefined && itemVal !== null && v !== null && itemVal.toString() === v.toString()) || itemVal === v
          );
          if (!inMatch) return false;
        }
        continue;
      }

      // Normalize string vs ObjectId / number comparisons
      if (itemVal !== undefined && itemVal !== null && qVal !== null) {
        if (itemVal.toString() === qVal.toString()) {
          continue;
        }
      }
      if (itemVal !== qVal) {
        return false;
      }
    }
  }
  return true;
}

const dbService = {
  async find(collection, query = {}) {
    if (shouldUseMongoose()) {
      return await modelMap[collection].find(query).lean();
    } else {
      const data = readMockData();
      const items = data[collection] || [];
      return items.filter(item => matchQuery(item, query));
    }
  },

  async findOne(collection, query = {}) {
    if (shouldUseMongoose()) {
      return await modelMap[collection].findOne(query).lean();
    } else {
      const data = readMockData();
      const items = data[collection] || [];
      return items.find(item => matchQuery(item, query)) || null;
    }
  },

  async findById(collection, id) {
    if (!id) return null;
    const strId = id.toString();
    if (shouldUseMongoose()) {
      try {
        return await modelMap[collection].findById(id).lean();
      } catch (err) {
        return null;
      }
    } else {
      const data = readMockData();
      const items = data[collection] || [];
      return items.find(item => item._id && item._id.toString() === strId) || null;
    }
  },

  async create(collection, documentData) {
    if (shouldUseMongoose()) {
      const modelClass = modelMap[collection];
      const newDoc = new modelClass(documentData);
      return await newDoc.save();
    } else {
      return withMockLock(async () => {
        const data = readMockData();
        if (!data[collection]) data[collection] = [];
        
        const newDoc = {
          _id: 'mock_' + Math.random().toString(36).substr(2, 9),
          ...documentData,
          createdAt: documentData.createdAt || new Date().toISOString()
        };
        data[collection].push(newDoc);
        writeMockData(data);
        return newDoc;
      });
    }
  },

  async findByIdAndUpdate(collection, id, updateData) {
    if (!id) return null;
    const strId = id.toString();
    if (shouldUseMongoose()) {
      try {
        return await modelMap[collection].findByIdAndUpdate(id, updateData, { new: true }).lean();
      } catch (err) {
        return null;
      }
    } else {
      return withMockLock(async () => {
        const data = readMockData();
        const items = data[collection] || [];
        const index = items.findIndex(item => item._id && item._id.toString() === strId);
        if (index === -1) return null;
        
        items[index] = {
          ...items[index],
          ...updateData,
          updatedAt: new Date().toISOString()
        };
        
        writeMockData(data);
        return items[index];
      });
    }
  },

  async findOneAndUpdate(collection, query, updateData, options = { new: true }) {
    if (shouldUseMongoose()) {
      try {
        return await modelMap[collection].findOneAndUpdate(query, updateData, { new: true, ...options }).lean();
      } catch (err) {
        return null;
      }
    } else {
      return withMockLock(async () => {
        const data = readMockData();
        const items = data[collection] || [];
        const index = items.findIndex(item => matchQuery(item, query));
        if (index === -1) return null;

        const current = items[index];
        if (updateData.$inc && typeof updateData.$inc === 'object') {
          for (const k in updateData.$inc) {
            current[k] = (Number(current[k]) || 0) + Number(updateData.$inc[k]);
          }
        }
        if (updateData.$set && typeof updateData.$set === 'object') {
          for (const k in updateData.$set) {
            current[k] = updateData.$set[k];
          }
        }
        for (const k in updateData) {
          if (k !== '$inc' && k !== '$set') {
            current[k] = updateData[k];
          }
        }

        current.updatedAt = new Date().toISOString();
        items[index] = current;
        writeMockData(data);
        return current;
      });
    }
  },

  async atomicReserveSeats(tripId, seatsToReserve) {
    const seats = parseInt(seatsToReserve, 10);
    if (isNaN(seats) || seats <= 0) return null;
    return await this.findOneAndUpdate('trips', {
      _id: tripId,
      status: 'scheduled',
      availableSeats: { $gte: seats }
    }, {
      $inc: { availableSeats: -seats }
    });
  },

  async atomicReleaseSeats(tripId, seatsToRestore) {
    const seats = parseInt(seatsToRestore, 10);
    if (isNaN(seats) || seats <= 0) return null;
    return await this.findOneAndUpdate('trips', {
      _id: tripId
    }, {
      $inc: { availableSeats: seats }
    });
  },

  async updateOne(collection, query, updateData) {
    if (shouldUseMongoose()) {
      return await modelMap[collection].updateOne(query, updateData);
    } else {
      return withMockLock(async () => {
        const data = readMockData();
        const items = data[collection] || [];
        const index = items.findIndex(item => matchQuery(item, query));
        if (index === -1) return { nModified: 0 };

        items[index] = {
          ...items[index],
          ...updateData,
          updatedAt: new Date().toISOString()
        };
        writeMockData(data);
        return { nModified: 1 };
      });
    }
  },

  async deleteOne(collection, query) {
    if (shouldUseMongoose()) {
      return await modelMap[collection].deleteOne(query);
    } else {
      return withMockLock(async () => {
        const data = readMockData();
        const items = data[collection] || [];
        const index = items.findIndex(item => matchQuery(item, query));
        if (index === -1) return { deletedCount: 0 };
        
        items.splice(index, 1);
        writeMockData(data);
        return { deletedCount: 1 };
      });
    }
  },

  async aggregate(collection, pipeline, fallbackFn) {
    if (shouldUseMongoose()) {
      try {
        return await modelMap[collection].aggregate(pipeline);
      } catch (err) {
        console.warn(`[dbService aggregate warning] Falling back for collection ${collection}:`, err.message);
        if (typeof fallbackFn === 'function') {
          const data = readMockData();
          return fallbackFn(data[collection] || []);
        }
        throw err;
      }
    } else {
      if (typeof fallbackFn === 'function') {
        const data = readMockData();
        return fallbackFn(data[collection] || []);
      }
      return [];
    }
  }
};

module.exports = dbService;
