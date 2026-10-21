const analyticsService = require('../services/analyticsService');

const analyticsController = {
  /**
   * Comprehensive Transit Demand Analytics
   * GET /api/analytics/demand
   * Role: Admin or Driver only
   */
  async getDemandAnalytics(req, res, next) {
    try {
      const userRole = req.user ? req.user.role : null;
      if (userRole !== 'admin' && userRole !== 'driver') {
        return res.status(403).json({
          message: 'Access denied. Detailed transit analytics are restricted to authorized drivers and administrators.'
        });
      }

      const analytics = await analyticsService.getTransitAnalytics();
      res.status(200).json(analytics);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Public Congestion Forecast Overview
   * GET /api/analytics/overview
   * Role: Public / All commuters
   */
  async getPublicOverview(req, res, next) {
    try {
      const forecast = analyticsService.getProjectedDemand();
      res.status(200).json({ forecast });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = analyticsController;
