const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const tripController = require('../controllers/tripController');
const aiController = require('../controllers/aiController');
const utilityController = require('../controllers/utilityController');
const adminController = require('../controllers/adminController');
const analyticsController = require('../controllers/analyticsController');
const healthController = require('../controllers/healthController');

// Middlewares
const { authRateLimiter, sosRateLimiter } = require('../middleware/security');
const {
  validateRegister,
  validateLogin,
  validateCreateTrip,
  validateBookTrip,
  validateUpdateTripStatus,
  validateRespondBooking,
  validateChatbot,
  validatePredictFare,
  validatePredictDemand,
  validateCheckSpam,
  validateMultimodalRoute,
  validateExpense,
  validateLostFound,
  validateComplaint
} = require('../middleware/validator');

const verifyToken = authController.verifyToken;

const verifyDriver = (req, res, next) => {
  if (req.user && req.user.role === 'driver') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Only registered drivers can publish carpool trips.' });
  }
};

const verifyAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
  }
};

const verifyAdminOrDriver = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'driver')) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Restricted to drivers and administrators.' });
  }
};

// --- HEALTH & OBSERVABILITY ROUTES ---
router.get('/health', healthController.getHealth);
router.get('/ready', healthController.getReadiness);

// --- AUTH ROUTES ---
router.post('/auth/register', authRateLimiter, validateRegister, authController.register);
router.post('/auth/login', authRateLimiter, validateLogin, authController.login);
router.get('/auth/profile', verifyToken, authController.getCurrentUser);

// --- TRIP / CARPOOL ROUTES ---
router.get('/trips', tripController.searchTrips);
router.get('/trips/my-bookings', verifyToken, tripController.getMyBookings);
router.get('/trips/my-trips', verifyToken, tripController.getMyTrips);
router.get('/trips/:tripId/bookings', verifyToken, tripController.getTripBookings);
router.get('/trips/:tripId', tripController.getTripById);
router.post('/trips', verifyToken, verifyDriver, validateCreateTrip, tripController.createTrip);
router.post('/trips/book', verifyToken, validateBookTrip, tripController.bookTrip);
router.patch('/trips/bookings/:bookingId/respond', verifyToken, validateRespondBooking, tripController.respondToBooking);
router.patch('/trips/bookings/:bookingId/cancel', verifyToken, tripController.cancelBooking);
router.patch('/trips/:tripId/status', verifyToken, validateUpdateTripStatus, tripController.updateTripStatus);

// --- AI & MULTIMODAL ROUTING FEATURES ---
router.post('/routes/multimodal', validateMultimodalRoute, aiController.getMultimodalRoute);
router.post('/ai/plan-route', validateMultimodalRoute, aiController.getMultimodalRoute);
router.post('/ai/chat', validateChatbot, aiController.chatbot);
router.post('/ai/predict-fare', validatePredictFare, aiController.predictFare);
router.post('/ai/predict-demand', validatePredictDemand, aiController.predictDemand);
router.post('/ai/check-spam', validateCheckSpam, aiController.checkSpam);

// --- UTILITY ROUTES ---
router.post('/utility/sos', verifyToken, sosRateLimiter, utilityController.triggerSOS);
router.post('/utility/lost-found', verifyToken, validateLostFound, utilityController.reportLostFound);
router.get('/utility/lost-found/my-matches', verifyToken, utilityController.getMyMatches);
router.get('/utility/lost-found/:itemId/matches', verifyToken, utilityController.getItemMatches);
router.get('/utility/lost-found', utilityController.getLostFoundItems);
router.patch('/utility/lost-found/:itemId', verifyToken, utilityController.updateLostFoundStatus);
router.post('/utility/expenses', verifyToken, validateExpense, utilityController.createExpense);
router.get('/utility/expenses', verifyToken, utilityController.getMyExpenses);
router.get('/utility/notifications', verifyToken, utilityController.getMyNotifications);
router.patch('/utility/notifications/:id/read', verifyToken, utilityController.markNotificationRead);
router.post('/utility/complaints', verifyToken, validateComplaint, utilityController.createComplaint);

// --- ANALYTICS ROUTES ---
router.get('/analytics/demand', verifyToken, verifyAdminOrDriver, analyticsController.getDemandAnalytics);
router.get('/analytics/overview', analyticsController.getPublicOverview);

// --- ADMIN ROUTES ---
router.get('/admin/stats', verifyToken, verifyAdmin, adminController.getStats);
router.get('/admin/users', verifyToken, verifyAdmin, adminController.getAllUsers);
router.get('/admin/drivers/pending', verifyToken, verifyAdmin, adminController.getPendingDrivers);
router.patch('/admin/drivers/:driverId/approve', verifyToken, verifyAdmin, adminController.approveDriver);
router.get('/admin/complaints', verifyToken, verifyAdmin, adminController.getAllComplaints);
router.patch('/admin/complaints/:complaintId/resolve', verifyToken, verifyAdmin, adminController.resolveComplaint);
router.delete('/admin/users/:userId', verifyToken, verifyAdmin, adminController.deleteUser);

module.exports = router;
