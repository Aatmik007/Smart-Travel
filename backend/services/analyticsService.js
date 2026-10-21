/**
 * Transit Demand Analytics Service
 * 
 * Provides:
 * 1. Measured Historical Demand Analytics:
 *    - Popular hubs (frequent pickup and drop-off hubs)
 *    - Peak periods (hourly transit and booking distributions)
 *    - Frequently requested routes (corridors with highest volume)
 *    - Carpool demand & seat capacity utilization
 * 2. Projected Demand & Heuristic Rush Hour Forecasts
 * 3. Transparent Insufficient Data State (zero fabricated statistics)
 */

const dbService = require('../data/dbService');

/**
 * Computes projected rush hour congestion model based on current time
 */
function getProjectedDemand() {
  const currentHour = new Date().getHours();
  let level = 'Medium';
  let factor = 1.0;
  let periodName = 'Midday Transit';
  let reason = 'Normal midday vehicular and public transit flow.';

  if (currentHour >= 8 && currentHour <= 11) {
    level = 'High';
    factor = 1.35;
    periodName = 'Morning Peak';
    reason = 'Heavy commuter, university, and administrative secretariat movement.';
  } else if (currentHour >= 17 && currentHour <= 20) {
    level = 'High';
    factor = 1.40;
    periodName = 'Evening Peak';
    reason = 'Evening homebound flow across Tawi Bridges and Jewel Chowk.';
  } else if (currentHour >= 21 || currentHour <= 6) {
    level = 'Low';
    factor = 0.85;
    periodName = 'Night Off-Peak';
    reason = 'Reduced night transit activity with free flow on arterial roads.';
  }

  return {
    model: 'Jammu Time-of-Day Traffic Heuristic',
    currentHour,
    currentCongestionLevel: level,
    currentMultiplier: factor,
    currentPeriod: periodName,
    reason,
    forecastedRushHours: [
      {
        window: '08:30 - 11:00 AM',
        corridor: 'Janipur ➔ Jewel Chowk ➔ Secretariat',
        expectedCongestion: 'High (1.35x)',
        primaryTransitModes: ['Smart Bus Route 1A', 'Carpools', 'E-Rickshaws']
      },
      {
        window: '05:30 - 08:00 PM',
        corridor: 'Gandhi Nagar ➔ Tawi Bridges ➔ Janipur / Panjtirthi',
        expectedCongestion: 'High (1.40x)',
        primaryTransitModes: ['Smart Bus Route 1A', 'Shared Autos', 'Carpools']
      }
    ]
  };
}

/**
 * Computes measured historical analytics from database records
 */
async function getTransitAnalytics() {
  const trips = await dbService.find('trips');
  const bookings = await dbService.find('bookings');

  // Check if historical data is sufficient (minimum 2 trips/bookings)
  const totalRecords = trips.length + bookings.length;
  if (totalRecords < 2) {
    return {
      hasSufficientData: false,
      message: 'Insufficient historical transit data. At least 2 active, scheduled, or completed trips are required to generate measured analytics.',
      measuredDataPoints: totalRecords,
      measuredHistorical: null,
      projectedForecast: getProjectedDemand()
    };
  }

  // --- 1. POPULAR HUBS (Origins & Destinations) ---
  const originCounts = {};
  const destCounts = {};

  for (const t of trips) {
    const oName = t.startLocation ? t.startLocation.name : 'Unknown';
    const dName = t.endLocation ? t.endLocation.name : 'Unknown';
    originCounts[oName] = (originCounts[oName] || 0) + 1;
    destCounts[dName] = (destCounts[dName] || 0) + 1;
  }

  const popularOrigins = Object.entries(originCounts)
    .map(([hub, count]) => ({ hub, departureCount: count }))
    .sort((a, b) => b.departureCount - a.departureCount)
    .slice(0, 5);

  const popularDestinations = Object.entries(destCounts)
    .map(([hub, count]) => ({ hub, arrivalCount: count }))
    .sort((a, b) => b.arrivalCount - a.arrivalCount)
    .slice(0, 5);

  // --- 2. PEAK PERIODS & HOURLY DISTRIBUTION ---
  const hourlyCounts = Array(24).fill(0);
  const periodBuckets = {
    morningPeak: { label: 'Morning Peak (08:00 - 11:00)', count: 0 },
    midday: { label: 'Midday Transit (11:00 - 16:00)', count: 0 },
    eveningPeak: { label: 'Evening Peak (16:00 - 20:00)', count: 0 },
    night: { label: 'Off-Peak / Night (20:00 - 08:00)', count: 0 }
  };

  for (const t of trips) {
    if (t.departureTime) {
      const d = new Date(t.departureTime);
      if (!isNaN(d.getTime())) {
        const h = d.getHours();
        hourlyCounts[h]++;
        if (h >= 8 && h < 11) periodBuckets.morningPeak.count++;
        else if (h >= 11 && h < 16) periodBuckets.midday.count++;
        else if (h >= 16 && h < 20) periodBuckets.eveningPeak.count++;
        else periodBuckets.night.count++;
      }
    }
  }

  for (const b of bookings) {
    if (b.createdAt) {
      const d = new Date(b.createdAt);
      if (!isNaN(d.getTime())) {
        const h = d.getHours();
        hourlyCounts[h]++;
      }
    }
  }

  let peakHour = 0;
  let maxHourVolume = 0;
  hourlyCounts.forEach((count, hour) => {
    if (count > maxHourVolume) {
      maxHourVolume = count;
      peakHour = hour;
    }
  });

  // --- 3. FREQUENTLY REQUESTED ROUTES ---
  const routeCorridors = {};
  for (const t of trips) {
    const oName = t.startLocation ? t.startLocation.name : 'Unknown';
    const dName = t.endLocation ? t.endLocation.name : 'Unknown';
    const corridorKey = `${oName} ➔ ${dName}`;

    if (!routeCorridors[corridorKey]) {
      routeCorridors[corridorKey] = {
        route: corridorKey,
        origin: oName,
        destination: dName,
        tripsOffered: 0,
        type: t.type || 'carpool',
        totalCapacityOffered: 0,
        pricePerSeat: t.price || 0
      };
    }

    routeCorridors[corridorKey].tripsOffered++;
    routeCorridors[corridorKey].totalCapacityOffered += (t.availableSeats || 0);
  }

  // Count bookings matching routes
  for (const b of bookings) {
    const t = trips.find(tr => tr._id && tr._id.toString() === (b.tripId ? b.tripId.toString() : ''));
    if (t) {
      const oName = t.startLocation ? t.startLocation.name : 'Unknown';
      const dName = t.endLocation ? t.endLocation.name : 'Unknown';
      const corridorKey = `${oName} ➔ ${dName}`;
      if (routeCorridors[corridorKey]) {
        routeCorridors[corridorKey].bookingsCount = (routeCorridors[corridorKey].bookingsCount || 0) + (b.seatsBooked || 1);
      }
    }
  }

  const topRoutes = Object.values(routeCorridors)
    .sort((a, b) => b.tripsOffered - a.tripsOffered)
    .slice(0, 5);

  // --- 4. CARPOOL DEMAND & SEAT CAPACITY UTILIZATION ---
  const carpoolTrips = trips.filter(t => t.type === 'carpool');
  let totalCarpoolSeatsOffered = 0;
  let totalAvailableSeatsRemaining = 0;
  let carpoolRevenue = 0;

  for (const cp of carpoolTrips) {
    const seats = cp.availableSeats || 0;
    totalAvailableSeatsRemaining += seats;
    totalCarpoolSeatsOffered += seats;
  }

  let totalCarpoolSeatsBooked = 0;
  for (const b of bookings) {
    const matchingTrip = carpoolTrips.find(ct => ct._id && ct._id.toString() === (b.tripId ? b.tripId.toString() : ''));
    if (matchingTrip) {
      const seats = b.seatsBooked || 1;
      totalCarpoolSeatsBooked += seats;
      carpoolRevenue += (b.totalPrice || seats * matchingTrip.price);
    }
  }

  const totalEffectiveCapacity = totalAvailableSeatsRemaining + totalCarpoolSeatsBooked;
  const utilizationRate = totalEffectiveCapacity > 0
    ? Math.round((totalCarpoolSeatsBooked / totalEffectiveCapacity) * 100)
    : 0;

  return {
    hasSufficientData: true,
    measuredDataPoints: totalRecords,
    measuredHistorical: {
      totalTripsRecorded: trips.length,
      totalBookingsRecorded: bookings.length,
      popularAreas: {
        topOrigins: popularOrigins,
        topDestinations: popularDestinations
      },
      peakPeriods: {
        peakHour: `${String(peakHour).padStart(2, '0')}:00`,
        maxHourVolume,
        hourlyDistribution: hourlyCounts.map((count, hour) => ({
          hour: `${String(hour).padStart(2, '0')}:00`,
          volume: count
        })),
        periodsBreakdown: Object.values(periodBuckets)
      },
      frequentlyRequestedRoutes: topRoutes,
      carpoolDemand: {
        totalCarpoolListings: carpoolTrips.length,
        activeCarpools: carpoolTrips.filter(t => t.status === 'active').length,
        scheduledCarpools: carpoolTrips.filter(t => t.status === 'scheduled').length,
        seatsBooked: totalCarpoolSeatsBooked,
        seatsAvailable: totalAvailableSeatsRemaining,
        capacityUtilizationRate: `${utilizationRate}%`,
        measuredRevenue: carpoolRevenue
      }
    },
    projectedForecast: getProjectedDemand()
  };
}

module.exports = {
  getTransitAnalytics,
  getProjectedDemand
};
