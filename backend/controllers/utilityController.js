const dbService = require('../data/dbService');
const {
  inferCategory,
  redactContact,
  assessDescriptionCompleteness,
  isReportExpired,
  findMatchesForItem,
  checkDuplicateReport
} = require('../services/lostFoundMatcher');

const utilityController = {
  // SOS Safety Trigger
  async triggerSOS(req, res, next) {
    try {
      const { tripId, currentCoords } = req.body;
      const userId = req.user.userId;

      const user = await dbService.findById('users', userId);
      
      // Create SOS notification for all Admins
      const admins = await dbService.find('users', { role: 'admin' });
      for (const admin of admins) {
        await dbService.create('notifications', {
          userId: admin._id.toString(),
          title: `⚠️ CRITICAL: SOS ALERT DISPATCHED`,
          message: `Passenger ${user ? user.name : 'Unknown'} has triggered SOS! Trip: ${tripId || 'General Location'}. Location: [${currentCoords ? currentCoords.lat : 'Lat N/A'}, ${currentCoords ? currentCoords.lng : 'Lng N/A'}]. Phone: ${user ? user.phone : 'Not Provided'}.`,
          type: 'sos'
        });
      }

      console.warn(`[EMERGENCY SOS ALERT] User: ${userId} | Trip: ${tripId || 'N/A'}`);
      res.status(200).json({ message: 'Emergency alert successfully dispatched to transit safety operators.' });
    } catch (err) {
      next(err);
    }
  },

  // Lost & Found - Create Report
  async reportLostFound(req, res, next) {
    try {
      const { itemDescription, tripId, contactDetails, status, category, location, reportType } = req.body;
      const reporterId = req.user.userId;

      // Check for duplicate reports submitted within 24 hours
      const isDuplicate = await checkDuplicateReport(reporterId, itemDescription);
      if (isDuplicate) {
        return res.status(400).json({
          message: 'A duplicate or very similar item report was recently submitted by your account. Please check your existing registry under My Reported Items.'
        });
      }

      // Assess description completeness
      const completeness = assessDescriptionCompleteness(itemDescription);
      const inferredCat = inferCategory(itemDescription, category);
      const inferredType = reportType || (status === 'found' ? 'found' : 'lost');

      const item = await dbService.create('lostFound', {
        reporterId: reporterId.toString(),
        itemDescription: itemDescription.trim(),
        category: inferredCat,
        location: (location || tripId || 'Jammu Transit').trim(),
        reportType: inferredType,
        tripId: tripId || 'General Transit',
        status: status || (inferredType === 'found' ? 'found' : 'reported'),
        contactDetails: contactDetails.trim()
      });

      // Find initial candidate matches
      const initialMatches = await findMatchesForItem(item);

      res.status(201).json({
        message: 'Item reported successfully.',
        item,
        completenessWarning: completeness.warning,
        potentialMatchesCount: initialMatches.length,
        potentialMatches: initialMatches.slice(0, 5)
      });
    } catch (err) {
      next(err);
    }
  },

  // Lost & Found - Get Registry Items (with pagination and filtering)
  async getLostFoundItems(req, res, next) {
    try {
      const { status, category, reportType, page = 1, limit = 50 } = req.query;
      
      const query = {};
      if (status) query.status = status;
      if (category) query.category = category;
      if (reportType) query.reportType = reportType;

      const items = await dbService.find('lostFound', query);
      
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
      const totalCount = items.length;

      const startIndex = (pageNum - 1) * limitNum;
      const paginatedItems = items.slice(startIndex, startIndex + limitNum);

      const enriched = [];
      for (const item of paginatedItems) {
        let reporterName = 'Community Commuter';
        if (item.reporterId) {
          const user = await dbService.findById('users', item.reporterId);
          if (user) reporterName = user.name;
        }

        const expired = isReportExpired(item);

        enriched.push({
          ...item,
          reporterName,
          category: item.category || inferCategory(item.itemDescription),
          reportType: item.reportType || (item.status === 'found' ? 'found' : 'lost'),
          isExpired: expired,
          maskedContact: redactContact(item.contactDetails)
        });
      }

      res.status(200).json({
        items: enriched,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum)
        }
      });
    } catch (err) {
      next(err);
    }
  },

  // Lost & Found - Get Candidate Matches for Specific Item
  async getItemMatches(req, res, next) {
    try {
      const { itemId } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.role;

      const item = await dbService.findById('lostFound', itemId);
      if (!item) {
        return res.status(404).json({ message: 'Reported item not found.' });
      }

      // Check ownership or admin privilege
      const isReporter = item.reporterId && (item.reporterId.toString() === userId.toString());
      const isAdmin = userRole === 'admin';

      if (!isReporter && !isAdmin) {
        return res.status(403).json({
          message: 'Access denied. You can only view intelligent matches for items you reported, unless you are an administrator.'
        });
      }

      const matches = await findMatchesForItem(item);

      res.status(200).json({
        itemId,
        itemDescription: item.itemDescription,
        reportType: item.reportType || (item.status === 'found' ? 'found' : 'lost'),
        status: item.status,
        matchesCount: matches.length,
        matches
      });
    } catch (err) {
      next(err);
    }
  },

  // Lost & Found - Get All Matches for Current User's Active Items
  async getMyMatches(req, res, next) {
    try {
      const userId = req.user.userId;
      const userItems = await dbService.find('lostFound', { reporterId: userId.toString() });

      const activeUserItems = userItems.filter(item => item.status !== 'claimed' && !isReportExpired(item));
      const results = [];

      for (const item of activeUserItems) {
        const matches = await findMatchesForItem(item);
        if (matches.length > 0) {
          results.push({
            item: {
              _id: item._id,
              itemDescription: item.itemDescription,
              reportType: item.reportType || (item.status === 'found' ? 'found' : 'lost'),
              status: item.status,
              createdAt: item.createdAt
            },
            matchesCount: matches.length,
            topMatch: matches[0],
            allMatches: matches
          });
        }
      }

      res.status(200).json({
        totalMatchedItems: results.length,
        itemMatches: results
      });
    } catch (err) {
      next(err);
    }
  },

  async updateLostFoundStatus(req, res, next) {
    try {
      const { itemId } = req.params;
      const { status } = req.body;
      const userId = req.user.userId;
      const userRole = req.user.role;

      const item = await dbService.findById('lostFound', itemId);
      if (!item) {
        return res.status(404).json({ message: 'Item not found.' });
      }

      // Enforce authorization: only reporter or admin can modify status
      const isReporter = item.reporterId && (item.reporterId.toString() === userId.toString());
      const isAdmin = userRole === 'admin';

      if (!isReporter && !isAdmin) {
        return res.status(403).json({
          message: 'Unauthorized. Only the item reporter or an administrator can update the resolution status.'
        });
      }

      const updated = await dbService.findByIdAndUpdate('lostFound', itemId, { status });
      res.status(200).json({ message: 'Item status updated', item: updated });
    } catch (err) {
      next(err);
    }
  },

  // Expense Tracker
  async createExpense(req, res, next) {
    try {
      const { amount, category, description, date } = req.body;
      const userId = req.user.userId;

      const expense = await dbService.create('expenses', {
        userId: userId.toString(),
        amount: parseFloat(amount),
        category,
        description: (description || '').trim(),
        date: date || new Date().toISOString()
      });

      res.status(201).json({ message: 'Expense logged successfully.', expense });
    } catch (err) {
      next(err);
    }
  },

  async getMyExpenses(req, res, next) {
    try {
      const userId = req.user.userId;
      const { page, limit } = req.query;
      const expenses = await dbService.find('expenses', { userId: userId.toString() });
      const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

      const total = sorted.length;
      let paginated = sorted;
      let pagination = null;
      if (page || limit) {
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        paginated = sorted.slice((pageNum - 1) * limitNum, pageNum * limitNum);
        pagination = { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) || 1 };
      }

      res.status(200).json({ expenses: paginated, ...(pagination ? { pagination } : {}) });
    } catch (err) {
      next(err);
    }
  },

  // Notifications
  async getMyNotifications(req, res, next) {
    try {
      const userId = req.user.userId;
      const { page, limit, unreadOnly } = req.query;
      let notifications = await dbService.find('notifications', { userId: userId.toString() });
      
      if (unreadOnly === 'true') {
        notifications = notifications.filter(n => !n.read);
      }
      const sorted = [...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const total = sorted.length;
      let paginated = sorted;
      let pagination = null;
      if (page || limit) {
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        paginated = sorted.slice((pageNum - 1) * limitNum, pageNum * limitNum);
        pagination = { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) || 1 };
      }

      res.status(200).json({ notifications: paginated, ...(pagination ? { pagination } : {}) });
    } catch (err) {
      next(err);
    }
  },

  async markNotificationRead(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const notif = await dbService.findById('notifications', id);
      if (!notif) {
        return res.status(404).json({ message: 'Notification not found' });
      }

      // Authorization guard: users can only mark their own notifications read
      if (notif.userId && notif.userId.toString() !== userId.toString()) {
        return res.status(403).json({ message: 'Unauthorized access to notification.' });
      }

      const updated = await dbService.findByIdAndUpdate('notifications', id, { read: true });
      res.status(200).json({ message: 'Notification marked read', notification: updated });
    } catch (err) {
      next(err);
    }
  },

  // User Complaints
  async createComplaint(req, res, next) {
    try {
      const { title, description, tripId } = req.body;
      const userId = req.user.userId;

      const complaint = await dbService.create('complaints', {
        userId: userId.toString(),
        tripId: tripId || '',
        title: title.trim(),
        description: description.trim(),
        status: 'pending'
      });

      res.status(201).json({ message: 'Complaint submitted successfully.', complaint });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = utilityController;
