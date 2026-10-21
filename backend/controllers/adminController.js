const dbService = require('../data/dbService');

const adminController = {
  async getStats(req, res, next) {
    try {
      const users = await dbService.find('users');
      const drivers = await dbService.find('drivers');
      const trips = await dbService.find('trips');
      const complaints = await dbService.find('complaints');
      const lostFound = await dbService.find('lostFound');
      const bookings = await dbService.find('bookings');

      const passengersCount = users.filter(u => u.role === 'passenger').length;
      const driversCount = users.filter(u => u.role === 'driver').length;
      const activeTripsCount = trips.filter(t => t.status === 'active').length;
      const pendingComplaintsCount = complaints.filter(c => c.status === 'pending').length;
      const pendingDriversCount = drivers.filter(d => !d.isApproved).length;

      res.status(200).json({
        stats: {
          totalUsers: users.length,
          passengers: passengersCount,
          drivers: driversCount,
          activeTrips: activeTripsCount,
          totalTrips: trips.length,
          pendingComplaints: pendingComplaintsCount,
          pendingDrivers: pendingDriversCount,
          lostItems: lostFound.filter(l => l.status === 'reported').length,
          totalBookings: bookings.length
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async getAllUsers(req, res, next) {
    try {
      const { page, limit } = req.query;
      const users = await dbService.find('users');
      const safeUsers = users.map(u => {
        const { password, ...rest } = u;
        return rest;
      });

      const total = safeUsers.length;
      let paginated = safeUsers;
      let pagination = null;
      if (page || limit) {
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        paginated = safeUsers.slice((pageNum - 1) * limitNum, pageNum * limitNum);
        pagination = { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) || 1 };
      }

      res.status(200).json({ users: paginated, ...(pagination ? { pagination } : {}) });
    } catch (err) {
      next(err);
    }
  },

  async getPendingDrivers(req, res, next) {
    try {
      const drivers = await dbService.find('drivers', { isApproved: false });
      
      const enrichedDrivers = [];
      for (const d of drivers) {
        const user = await dbService.findById('users', d.userId);
        if (user) {
          enrichedDrivers.push({
            ...d,
            driverName: user.name,
            driverEmail: user.email,
            driverPhone: user.phone
          });
        }
      }
      res.status(200).json({ drivers: enrichedDrivers });
    } catch (err) {
      next(err);
    }
  },

  async approveDriver(req, res, next) {
    try {
      const { driverId } = req.params;
      
      const driver = await dbService.findById('drivers', driverId);
      if (!driver) {
        return res.status(404).json({ message: 'Driver record not found.' });
      }

      await dbService.findByIdAndUpdate('drivers', driverId, { isApproved: true });

      // Notify User
      if (driver.userId) {
        await dbService.create('notifications', {
          userId: driver.userId.toString(),
          title: 'Driver License Verified!',
          message: 'Your driver credentials have been officially approved by the JammuMove Administrator. You may now publish carpool routes.',
          type: 'approval'
        });
      }

      res.status(200).json({ message: 'Driver license successfully verified and approved.' });
    } catch (err) {
      next(err);
    }
  },

  async getAllComplaints(req, res, next) {
    try {
      const { page, limit } = req.query;
      const complaints = await dbService.find('complaints');
      
      const enriched = [];
      for (const c of complaints) {
        let userName = 'Anonymous Commuter';
        let userEmail = '';
        if (c.userId) {
          const user = await dbService.findById('users', c.userId);
          if (user) {
            userName = user.name;
            userEmail = user.email;
          }
        }
        enriched.push({
          ...c,
          userName,
          userEmail
        });
      }

      const total = enriched.length;
      let paginated = enriched;
      let pagination = null;
      if (page || limit) {
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        paginated = enriched.slice((pageNum - 1) * limitNum, pageNum * limitNum);
        pagination = { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) || 1 };
      }

      res.status(200).json({ complaints: paginated, ...(pagination ? { pagination } : {}) });
    } catch (err) {
      next(err);
    }
  },

  async resolveComplaint(req, res, next) {
    try {
      const { complaintId } = req.params;
      
      const complaint = await dbService.findById('complaints', complaintId);
      if (!complaint) {
        return res.status(404).json({ message: 'Complaint ticket not found.' });
      }

      await dbService.findByIdAndUpdate('complaints', complaintId, { status: 'resolved' });

      // Notify complainant
      if (complaint.userId) {
        await dbService.create('notifications', {
          userId: complaint.userId.toString(),
          title: 'Complaint Resolved',
          message: `Your complaint regarding '${complaint.title}' has been reviewed and marked as resolved by platform administrators.`,
          type: 'complaint_resolution'
        });
      }

      res.status(200).json({ message: 'Complaint ticket resolved successfully.' });
    } catch (err) {
      next(err);
    }
  },

  async deleteUser(req, res, next) {
    try {
      const { userId } = req.params;
      if (userId.toString() === req.user.userId.toString()) {
        return res.status(400).json({ message: 'Administrator cannot delete their own active account.' });
      }

      const existing = await dbService.findById('users', userId);
      if (!existing) {
        return res.status(404).json({ message: 'User not found.' });
      }

      await dbService.deleteOne('users', { _id: userId });
      res.status(200).json({ message: 'User record removed from platform.' });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = adminController;
