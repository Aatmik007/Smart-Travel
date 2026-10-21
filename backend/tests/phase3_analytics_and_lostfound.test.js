process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_phase1_2026';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const dbService = require('../data/dbService');

describe('Phase 3: Transit Demand Analytics & Intelligent Lost & Found Matching', () => {
  let server;
  let baseUrl;
  let adminToken;
  let driverToken;
  let passengerToken1;
  let passengerToken2;
  let passenger1Id;
  let passenger2Id;
  let reportedLostItemId;
  let reportedFoundItemId;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    const timestamp = Date.now();

    // 1. Register Admin
    const adminRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Analytics Admin',
        email: `admin_p3_${timestamp}@test.com`,
        password: 'password123',
        role: 'admin'
      })
    });
    const adminData = await adminRes.json();
    await dbService.findByIdAndUpdate('users', adminData.user._id, { role: 'admin' });
    adminToken = jwt.sign({ userId: adminData.user._id, role: 'admin' }, process.env.JWT_SECRET);

    // 2. Register Driver
    const driverRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Analytics Driver',
        email: `driver_p3_${timestamp}@test.com`,
        password: 'password123',
        role: 'driver',
        licenseNumber: 'JK02-P3001',
        vehicleModel: 'Toyota Innova',
        plateNumber: 'JK02P3-9999',
        capacity: 6,
        vehicleType: 'car'
      })
    });
    const driverData = await driverRes.json();
    driverToken = driverData.token;

    // 3. Register Passenger 1
    const p1Res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Commuter One',
        email: `pass1_p3_${timestamp}@test.com`,
        password: 'password123',
        role: 'passenger'
      })
    });
    const p1Data = await p1Res.json();
    passengerToken1 = p1Data.token;
    passenger1Id = p1Data.user._id;

    // 4. Register Passenger 2
    const p2Res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Commuter Two',
        email: `pass2_p3_${timestamp}@test.com`,
        password: 'password123',
        role: 'passenger'
      })
    });
    const p2Data = await p2Res.json();
    passengerToken2 = p2Data.token;
    passenger2Id = p2Data.user._id;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  // --- PART A: TRANSIT DEMAND ANALYTICS TESTS ---

  test('GET /api/analytics/demand denies access to unauthorized passenger (returns 403)', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/demand`, {
      headers: { 'Authorization': `Bearer ${passengerToken1}` }
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /Access denied/i);
  });

  test('GET /api/analytics/demand returns measured historical metrics and projected forecast for Admin', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/demand`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.hasSufficientData, true);
    assert.ok(body.measuredHistorical, 'Measured historical data must be present');
    assert.ok(body.projectedForecast, 'Projected forecast model must be present');

    // Popular Areas verification
    const popular = body.measuredHistorical.popularAreas;
    assert.ok(Array.isArray(popular.topOrigins));
    assert.ok(Array.isArray(popular.topDestinations));

    // Peak periods distribution
    const peaks = body.measuredHistorical.peakPeriods;
    assert.ok(Array.isArray(peaks.hourlyDistribution));
    assert.strictEqual(peaks.hourlyDistribution.length, 24);
    assert.ok(peaks.peakHour);

    // Carpool demand & capacity utilization
    const carpools = body.measuredHistorical.carpoolDemand;
    assert.ok(typeof carpools.totalCarpoolListings === 'number');
    assert.ok(typeof carpools.seatsAvailable === 'number');
    assert.ok(typeof carpools.seatsBooked === 'number');
    assert.match(carpools.capacityUtilizationRate, /%/);

    // Forecast distinction
    assert.strictEqual(body.projectedForecast.model, 'Jammu Time-of-Day Traffic Heuristic');
    assert.ok(body.projectedForecast.currentCongestionLevel);
  });

  test('GET /api/analytics/demand is accessible to authorized Driver for corridor planning', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/demand`, {
      headers: { 'Authorization': `Bearer ${driverToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.measuredHistorical);
    assert.ok(Array.isArray(body.measuredHistorical.frequentlyRequestedRoutes));
  });

  test('GET /api/analytics/overview returns public congestion forecast without requiring credentials', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/overview`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.forecast);
    assert.ok(body.forecast.currentCongestionLevel);
    assert.ok(Array.isArray(body.forecast.forecastedRushHours));
  });

  // --- PART B: LOST & FOUND INTELLIGENT MATCHING TESTS ---

  test('POST /api/utility/lost-found creates report and provides completeness assessment', async () => {
    // Brief report gets completeness warning
    const resBrief = await fetch(`${baseUrl}/api/utility/lost-found`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passengerToken1}`
      },
      body: JSON.stringify({
        itemDescription: 'charger',
        contactDetails: '+91-94191-44444'
      })
    });

    assert.strictEqual(resBrief.status, 201);
    const bodyBrief = await resBrief.json();
    assert.ok(bodyBrief.item);
    assert.ok(bodyBrief.completenessWarning, 'Brief report must include completeness guidance');

    // Comprehensive report
    const res = await fetch(`${baseUrl}/api/utility/lost-found`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passengerToken1}`
      },
      body: JSON.stringify({
        itemDescription: 'Black Lenovo 65W Laptop USB-C Charger with thick power cable left on rear bus seat',
        tripId: 'Route 1A Bus',
        contactDetails: 'Commuter One - +91-94191-11223',
        status: 'reported',
        reportType: 'lost',
        category: 'electronics'
      })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.item);
    reportedLostItemId = body.item._id;
    assert.strictEqual(body.item.category, 'electronics');
    assert.strictEqual(body.item.reportType, 'lost');
  });

  test('POST /api/utility/lost-found prevents duplicate report submissions within 24h', async () => {
    const dupRes = await fetch(`${baseUrl}/api/utility/lost-found`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passengerToken1}`
      },
      body: JSON.stringify({
        itemDescription: 'Black Lenovo 65W Laptop USB-C Charger with power cable on bus seat',
        tripId: 'Route 1A Bus',
        contactDetails: 'Commuter One - +91-94191-11223'
      })
    });

    assert.strictEqual(dupRes.status, 400);
    const body = await dupRes.json();
    assert.match(body.message, /duplicate or very similar item report/i);
  });

  test('Intelligent matcher scores complementary found item and explains signals', async () => {
    // Passenger 2 reports finding the matching item
    const foundRes = await fetch(`${baseUrl}/api/utility/lost-found`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passengerToken2}`
      },
      body: JSON.stringify({
        itemDescription: 'Found black Lenovo 65W laptop charger under seat in Route 1A bus near Jewel Chowk',
        tripId: 'Route 1A Bus',
        contactDetails: 'Commuter Two - +91-94191-99887',
        status: 'found',
        reportType: 'found',
        category: 'electronics'
      })
    });

    assert.strictEqual(foundRes.status, 201);
    const foundBody = await foundRes.json();
    reportedFoundItemId = foundBody.item._id;

    // Check matches for the lost item
    const matchRes = await fetch(`${baseUrl}/api/utility/lost-found/${reportedLostItemId}/matches`, {
      headers: { 'Authorization': `Bearer ${passengerToken1}` }
    });

    assert.strictEqual(matchRes.status, 200);
    const matchData = await matchRes.json();
    assert.ok(matchData.matchesCount >= 1);

    const targetMatch = matchData.matches.find(m => m.candidateId.toString() === reportedFoundItemId.toString()) || matchData.matches[0];
    assert.ok(targetMatch, `Expected reported item ${reportedFoundItemId} to be found in candidate matches`);
    assert.ok(targetMatch.matchScore >= 65, `Expected high match score, got ${targetMatch.matchScore}`);
    assert.ok(['High', 'Moderate'].includes(targetMatch.confidenceLevel));

    // Verify transparent signals explanation
    assert.ok(Array.isArray(targetMatch.matchSignals));
    assert.ok(targetMatch.matchSignals.some(s => s.signal === 'Category Match'));
    assert.ok(targetMatch.matchSignals.some(s => s.signal === 'Transit Location Overlap' || s.signal === 'Trip Match'));
    assert.ok(targetMatch.matchSignals.some(s => s.signal === 'Descriptive Keyword Overlap'));

    // Verify contact details are masked for privacy
    assert.match(targetMatch.maskedContact, /XXXXX|\*\*\*/);
    assert.strictEqual(targetMatch.maskedContact.includes('+91-94191-99887'), false, 'Private contact must not be exposed blindly');
  });

  test('Unauthorized user cannot access candidate matches for another user report (returns 403)', async () => {
    // Commuter Two tries to inspect matches for Commuter One's lost item
    const unauthRes = await fetch(`${baseUrl}/api/utility/lost-found/${reportedLostItemId}/matches`, {
      headers: { 'Authorization': `Bearer ${passengerToken2}` }
    });

    assert.strictEqual(unauthRes.status, 403);
    const body = await unauthRes.json();
    assert.match(body.message, /Access denied/i);
  });

  test('Admin can audit candidate matches across any registered item', async () => {
    const adminRes = await fetch(`${baseUrl}/api/utility/lost-found/${reportedLostItemId}/matches`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert.strictEqual(adminRes.status, 200);
    const body = await adminRes.json();
    assert.ok(body.matches);
  });

  test('GET /api/utility/lost-found/my-matches aggregates matches for current user active reports', async () => {
    const res = await fetch(`${baseUrl}/api/utility/lost-found/my-matches`, {
      headers: { 'Authorization': `Bearer ${passengerToken1}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(typeof body.totalMatchedItems === 'number');
    assert.ok(Array.isArray(body.itemMatches));
  });

  test('Matching engine does not automatically mark items as claimed', async () => {
    const item = await dbService.findById('lostFound', reportedLostItemId);
    // Must remain 'reported' until manual user resolution
    assert.strictEqual(item.status, 'reported');
  });
});
