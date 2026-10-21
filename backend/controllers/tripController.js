const dbService = require('../data/dbService');

const tripController = {
  async createTrip(req, res, next) {
    try {
      const { startLocation, endLocation, price, departureTime, availableSeats, stops, type } = req.body;
      const driverId = req.user.userId;

      // Check if driver exists and is approved
      const driver = await dbService.findOne('drivers', { userId: driverId });
      if (!driver) {
        return res.status(403).json({ message: 'Only registered drivers can offer rides.' });
      }

      if (!driver.isApproved) {
        return res.status(403).json({
          message: 'Your driver account is pending administrator verification. You cannot offer rides until approved.'
        });
      }

      // Validate future departure time
      if (new Date(departureTime) <= new Date()) {
        return res.status(400).json({ message: 'Departure time must be in the future.' });
      }

      // Generate route checkpoints
      const stopsArray = Array.isArray(stops) ? stops : [];
      const path = [
        startLocation,
        ...stopsArray.map((stopName, idx) => {
          const ratio = (idx + 1) / (stopsArray.length + 1);
          return {
            name: typeof stopName === 'string' ? stopName.trim() : stopName.name,
            lat: Number((startLocation.lat + (endLocation.lat - startLocation.lat) * ratio).toFixed(6)),
            lng: Number((startLocation.lng + (endLocation.lng - startLocation.lng) * ratio).toFixed(6))
          };
        }),
        endLocation
      ];

      const trip = await dbService.create('trips', {
        type: type || 'carpool',
        driverId,
        routeName: `${startLocation.name} ➔ ${endLocation.name} Carpool`,
        startLocation,
        endLocation,
        path,
        price: parseFloat(price),
        departureTime: new Date(departureTime).toISOString(),
        availableSeats: parseInt(availableSeats, 10),
        stops: stopsArray,
        status: 'scheduled'
      });

      res.status(201).json({ message: 'Ride created successfully', trip });
    } catch (err) {
      next(err);
    }
  },

  async searchTrips(req, res, next) {
    try {
      const { from, to, type } = req.query;
      
      const allTrips = await dbService.find('trips');
      
      let filtered = allTrips;
      
      if (type) {
        filtered = filtered.filter(t => t.type === type);
      }
      
      if (from) {
        const fromLower = from.toLowerCase().trim();
        filtered = filtered.filter(t => 
          (t.startLocation && t.startLocation.name && t.startLocation.name.toLowerCase().includes(fromLower)) ||
          (Array.isArray(t.stops) && t.stops.some(s => (typeof s === 'string' ? s : s.name || '').toLowerCase().includes(fromLower)))
        );
      }

      if (to) {
        const toLower = to.toLowerCase().trim();
        filtered = filtered.filter(t => 
          (t.endLocation && t.endLocation.name && t.endLocation.name.toLowerCase().includes(toLower)) ||
          (Array.isArray(t.stops) && t.stops.some(s => (typeof s === 'string' ? s : s.name || '').toLowerCase().includes(toLower)))
        );
      }

      // Only return scheduled or active trips for public discovery
      filtered = filtered.filter(t => t.status === 'scheduled' || t.status === 'active');

      const enrichedTrips = [];
      for (const trip of filtered) {
        let driverName = trip.type === 'bus' ? 'Smart Electric Bus' : 'Verified Partner';
        let driverRating = 5.0;
        let plateNumber = trip.type === 'bus' ? 'JK02-EBUS' : 'JK02-XXXX';
        let vehicleModel = trip.type === 'bus' ? 'Jammu Smart Transit Bus' : 'Standard Car';
        
        if (trip.driverId) {
          const u = await dbService.findById('users', trip.driverId);
          if (u) {
            driverName = u.name;
            const d = await dbService.findOne('drivers', { userId: u._id });
            if (d) {
              driverRating = d.rating || 5.0;
              if (d.vehicleId) {
                const v = await dbService.findById('vehicles', d.vehicleId);
                if (v) {
                  plateNumber = v.plateNumber;
                  vehicleModel = v.model;
                }
              }
            }
          }
        }
        
        enrichedTrips.push({
          ...trip,
          driverName,
          driverRating,
          plateNumber,
          vehicleModel
        });
      }

      const total = enrichedTrips.length;
      let paginated = enrichedTrips;
      let pagination = null;
      if (req.query.page || req.query.limit) {
        const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        paginated = enrichedTrips.slice((pageNum - 1) * limitNum, pageNum * limitNum);
        pagination = { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) || 1 };
      }

      res.status(200).json({ trips: paginated, ...(pagination ? { pagination } : {}) });
    } catch (err) {
      next(err);
    }
  },

  async getTripById(req, res, next) {
    try {
      const { tripId } = req.params;
      const trip = await dbService.findById('trips', tripId);
      
      if (!trip) {
        return res.status(404).json({ message: 'Trip not found.' });
      }

      let driverName = trip.type === 'bus' ? 'Smart Electric Bus' : 'Verified Partner';
      let driverRating = 5.0;
      let plateNumber = trip.type === 'bus' ? 'JK02-EBUS' : 'JK02-XXXX';
      let vehicleModel = trip.type === 'bus' ? 'Jammu Smart Transit Bus' : 'Standard Car';

      if (trip.driverId) {
        const u = await dbService.findById('users', trip.driverId);
        if (u) {
          driverName = u.name;
          const d = await dbService.findOne('drivers', { userId: u._id });
          if (d) {
            driverRating = d.rating || 5.0;
            if (d.vehicleId) {
              const v = await dbService.findById('vehicles', d.vehicleId);
              if (v) {
                plateNumber = v.plateNumber;
                vehicleModel = v.model;
              }
            }
          }
        }
      }

      res.status(200).json({
        trip: {
          ...trip,
          driverName,
          driverRating,
          plateNumber,
          vehicleModel
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async bookTrip(req, res, next) {
    try {
      const { tripId, seatsBooked } = req.body;
      const passengerId = req.user.userId;

      const seats = parseInt(seatsBooked, 10) || 1;
      if (seats < 1 || seats > 8) {
        return res.status(400).json({ message: 'Seats booked must be between 1 and 8.' });
      }

      const trip = await dbService.findById('trips', tripId);

      if (!trip) {
        return res.status(404).json({ message: 'Trip not found.' });
      }

      if (trip.status !== 'scheduled') {
        return res.status(400).json({ message: 'This ride is no longer joinable.' });
      }

      // Departure time validation
      if (new Date(trip.departureTime) <= new Date()) {
        return res.status(400).json({ message: 'Cannot book past or departed rides.' });
      }

      if (trip.driverId && trip.driverId.toString() === passengerId.toString()) {
        return res.status(400).json({ message: 'You cannot book your own offered ride.' });
      }

      // Check for duplicate active or pending booking by the same passenger on this trip
      const existingBookings = await dbService.find('bookings', {
        tripId: trip._id.toString(),
        passengerId: passengerId.toString()
      });
      const activeExisting = existingBookings.find(b => b.status === 'pending' || b.status === 'confirmed');
      if (activeExisting) {
        return res.status(400).json({
          message: 'You already have an active or pending booking request for this ride.'
        });
      }

      // Concurrency-safe atomic seat reservation
      const reservedTrip = await dbService.atomicReserveSeats(tripId, seats);
      if (!reservedTrip) {
        return res.status(400).json({
          message: `Only ${trip.availableSeats} seats available on this vehicle.`
        });
      }

      // Create Booking: public buses auto-confirm; carpools start as pending driver review
      const initialStatus = trip.type === 'bus' ? 'confirmed' : 'pending';
      const totalPrice = Math.round(trip.price * seats);
      const booking = await dbService.create('bookings', {
        tripId: trip._id.toString(),
        passengerId: passengerId.toString(),
        seatsBooked: seats,
        totalPrice,
        status: initialStatus
      });

      // Send Notification to Driver
      if (trip.driverId) {
        const passenger = await dbService.findById('users', passengerId);
        await dbService.create('notifications', {
          userId: trip.driverId,
          title: initialStatus === 'pending' ? 'New Ride Booking Request!' : 'New Ride Booking!',
          message: `${passenger ? passenger.name : 'A commuter'} has ${initialStatus === 'pending' ? 'requested' : 'booked'} ${seats} seat(s) on your route (${trip.routeName}).`,
          type: 'booking'
        });
      }

      res.status(201).json({
        message: initialStatus === 'pending'
          ? 'Ride booking request submitted successfully. Awaiting driver acceptance.'
          : 'Ride booked successfully',
        booking
      });
    } catch (err) {
      next(err);
    }
  },

  async respondToBooking(req, res, next) {
    try {
      const { bookingId } = req.params;
      const { action, status } = req.body;
      const userId = req.user.userId;
      const userRole = req.user.role;

      let resolvedAction = action;
      if (!resolvedAction && status) {
        if (status === 'confirmed') resolvedAction = 'accept';
        if (status === 'cancelled') resolvedAction = 'reject';
      }

      if (!resolvedAction || !['accept', 'reject'].includes(resolvedAction)) {
        return res.status(400).json({ message: "Action must be either 'accept' or 'reject'." });
      }

      const booking = await dbService.findById('bookings', bookingId);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found.' });
      }

      const trip = await dbService.findById('trips', booking.tripId);
      if (!trip) {
        return res.status(404).json({ message: 'Associated trip not found.' });
      }

      // Authorization: Driver of trip or Admin
      const isDriver = trip.driverId && (trip.driverId.toString() === userId.toString());
      const isAdmin = userRole === 'admin';
      if (!isDriver && !isAdmin) {
        return res.status(403).json({
          message: 'Unauthorized. Only the driver offering this ride can respond to booking requests.'
        });
      }

      // State machine transitions: only pending bookings can be accepted or rejected
      if (booking.status === 'confirmed') {
        return res.status(400).json({ message: 'Booking is already confirmed.' });
      }
      if (booking.status === 'cancelled') {
        return res.status(400).json({ message: 'Cannot respond to an already cancelled booking.' });
      }
      if (booking.status === 'completed') {
        return res.status(400).json({ message: 'Cannot respond to a completed booking.' });
      }
      if (booking.status !== 'pending') {
        return res.status(400).json({ message: `Cannot respond to booking in '${booking.status}' status.` });
      }

      let updatedBooking;
      if (resolvedAction === 'accept') {
        updatedBooking = await dbService.findByIdAndUpdate('bookings', bookingId, {
          status: 'confirmed'
        });

        // Notify passenger
        await dbService.create('notifications', {
          userId: booking.passengerId,
          title: 'Booking Request Accepted!',
          message: `Your booking for ${booking.seatsBooked} seat(s) on ${trip.routeName} has been confirmed by the driver.`,
          type: 'booking'
        });

        return res.status(200).json({
          message: 'Booking request accepted successfully.',
          booking: updatedBooking
        });
      } else {
        // Reject: mark cancelled and release seats back to the trip
        updatedBooking = await dbService.findByIdAndUpdate('bookings', bookingId, {
          status: 'cancelled'
        });

        await dbService.atomicReleaseSeats(trip._id, booking.seatsBooked);

        // Notify passenger
        await dbService.create('notifications', {
          userId: booking.passengerId,
          title: 'Booking Request Declined',
          message: `The driver was unable to accept your booking request for ${trip.routeName}.`,
          type: 'booking'
        });

        return res.status(200).json({
          message: 'Booking request rejected and seats released.',
          booking: updatedBooking
        });
      }
    } catch (err) {
      next(err);
    }
  },

  async cancelBooking(req, res, next) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.role;

      const booking = await dbService.findById('bookings', bookingId);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found.' });
      }

      const trip = await dbService.findById('trips', booking.tripId);

      // Authorization: Passenger, Driver of the trip, or Admin
      const isPassenger = booking.passengerId && (booking.passengerId.toString() === userId.toString());
      const isDriver = trip && trip.driverId && (trip.driverId.toString() === userId.toString());
      const isAdmin = userRole === 'admin';

      if (!isPassenger && !isDriver && !isAdmin) {
        return res.status(403).json({
          message: 'Unauthorized. You can only cancel your own bookings.'
        });
      }

      // State validation
      if (booking.status === 'cancelled') {
        return res.status(400).json({ message: 'Booking is already cancelled.' });
      }
      if (booking.status === 'completed') {
        return res.status(400).json({ message: 'Cannot cancel a completed booking.' });
      }

      const previousStatus = booking.status;
      const updatedBooking = await dbService.findByIdAndUpdate('bookings', bookingId, {
        status: 'cancelled'
      });

      // Restore seats if it was active or pending
      if (trip && (previousStatus === 'confirmed' || previousStatus === 'pending')) {
        await dbService.atomicReleaseSeats(trip._id, booking.seatsBooked);
      }

      // Notify counterparty
      if (isPassenger && trip && trip.driverId) {
        const passenger = await dbService.findById('users', userId);
        await dbService.create('notifications', {
          userId: trip.driverId,
          title: 'Booking Cancelled',
          message: `${passenger ? passenger.name : 'A commuter'} cancelled their booking (${booking.seatsBooked} seat(s)) on route ${trip.routeName}.`,
          type: 'booking'
        });
      } else if ((isDriver || isAdmin) && booking.passengerId) {
        await dbService.create('notifications', {
          userId: booking.passengerId,
          title: 'Booking Cancelled',
          message: `Your booking on route ${trip ? trip.routeName : 'your trip'} was cancelled.`,
          type: 'booking'
        });
      }

      res.status(200).json({
        message: 'Booking cancelled successfully.',
        booking: updatedBooking
      });
    } catch (err) {
      next(err);
    }
  },

  async getTripBookings(req, res, next) {
    try {
      const { tripId } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.role;

      const trip = await dbService.findById('trips', tripId);
      if (!trip) {
        return res.status(404).json({ message: 'Trip not found.' });
      }

      const isDriver = trip.driverId && (trip.driverId.toString() === userId.toString());
      const isAdmin = userRole === 'admin';
      if (!isDriver && !isAdmin) {
        return res.status(403).json({
          message: 'Unauthorized. Only the assigned driver or an administrator can view the passenger manifest.'
        });
      }

      const bookings = await dbService.find('bookings', { tripId: trip._id.toString() });
      const enriched = [];
      for (const b of bookings) {
        let passengerName = 'Commuter';
        let passengerEmail = '';
        let passengerPhone = '';
        if (b.passengerId) {
          const u = await dbService.findById('users', b.passengerId);
          if (u) {
            passengerName = u.name;
            passengerEmail = u.email;
            passengerPhone = u.phone || '';
          }
        }
        enriched.push({
          ...b,
          passenger: {
            name: passengerName,
            email: passengerEmail,
            phone: passengerPhone
          }
        });
      }

      res.status(200).json({ bookings: enriched });
    } catch (err) {
      next(err);
    }
  },

  async updateTripStatus(req, res, next) {
    try {
      const { tripId } = req.params;
      const { status } = req.body;
      const userId = req.user.userId;

      const trip = await dbService.findById('trips', tripId);
      if (!trip) {
        return res.status(404).json({ message: 'Trip not found.' });
      }

      // Normalize string vs ObjectId comparison
      const isDriver = trip.driverId && (trip.driverId.toString() === userId.toString());
      const isAdmin = req.user.role === 'admin';

      if (!isDriver && !isAdmin) {
        return res.status(403).json({ message: 'Unauthorized. Only the assigned driver or an administrator can modify trip status.' });
      }

      const updated = await dbService.findByIdAndUpdate('trips', tripId, { status });

      // When trip is cancelled, cancel all active/pending bookings and notify passengers
      if (status === 'cancelled') {
        const bookings = await dbService.find('bookings', { tripId: tripId.toString() });
        for (const booking of bookings) {
          if (booking.status === 'pending' || booking.status === 'confirmed') {
            await dbService.findByIdAndUpdate('bookings', booking._id, { status: 'cancelled' });
            await dbService.create('notifications', {
              userId: booking.passengerId,
              title: 'Trip Cancelled by Driver',
              message: `Your ride ${trip.routeName} has been cancelled by the driver.`,
              type: 'status'
            });
          }
        }
      } else if (status === 'completed') {
        const bookings = await dbService.find('bookings', { tripId: tripId.toString() });
        for (const booking of bookings) {
          if (booking.status === 'confirmed') {
            await dbService.findByIdAndUpdate('bookings', booking._id, { status: 'completed' });
          }
        }
      } else {
        // Normal status broadcast
        const bookings = await dbService.find('bookings', { tripId: tripId.toString() });
        for (const booking of bookings) {
          await dbService.create('notifications', {
            userId: booking.passengerId,
            title: `Trip Status Update`,
            message: `Your ride ${trip.routeName} status is now: ${status.toUpperCase()}.`,
            type: 'status'
          });
        }
      }

      res.status(200).json({ message: 'Trip status updated', trip: updated });
    } catch (err) {
      next(err);
    }
  },

  async getMyBookings(req, res, next) {
    try {
      const passengerId = req.user.userId;
      const { status } = req.query;
      let bookings = await dbService.find('bookings', { passengerId: passengerId.toString() });

      if (status && status !== 'all') {
        bookings = bookings.filter(b => b.status === status);
      }
      
      const enrichedBookings = [];
      for (const b of bookings) {
        const trip = await dbService.findById('trips', b.tripId);
        if (trip) {
          let driverName = 'Smart Transit Bus';
          let phone = '+91-94191-00000';
          if (trip.driverId) {
            const drv = await dbService.findById('users', trip.driverId);
            if (drv) {
              driverName = drv.name;
              phone = drv.phone;
            }
          }
          enrichedBookings.push({
            ...b,
            tripDetails: {
              ...trip,
              driverName,
              phone
            }
          });
        }
      }
      res.status(200).json({ bookings: enrichedBookings });
    } catch (err) {
      next(err);
    }
  },

  async getMyTrips(req, res, next) {
    try {
      const driverId = req.user.userId;
      const trips = await dbService.find('trips', { driverId: driverId.toString() });
      
      // Enrich trips with booking counts for driver dashboard
      const enrichedTrips = [];
      for (const t of trips) {
        const tripBookings = await dbService.find('bookings', { tripId: t._id.toString() });
        const pendingCount = tripBookings.filter(b => b.status === 'pending').length;
        const confirmedCount = tripBookings.filter(b => b.status === 'confirmed').length;
        enrichedTrips.push({
          ...t,
          pendingRequestsCount: pendingCount,
          confirmedBookingsCount: confirmedCount,
          bookingsCount: tripBookings.length
        });
      }

      const total = enrichedTrips.length;
      let paginated = enrichedTrips;
      let pagination = null;
      if (req.query.page || req.query.limit) {
        const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        paginated = enrichedTrips.slice((pageNum - 1) * limitNum, pageNum * limitNum);
        pagination = { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) || 1 };
      }

      res.status(200).json({ trips: paginated, ...(pagination ? { pagination } : {}) });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = tripController;
