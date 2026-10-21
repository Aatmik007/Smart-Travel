const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  CANONICAL_HUBS,
  findMultimodalRoutes,
  haversineDistance
} = require('../services/routeEngine');

const {
  inferCategory,
  redactContact,
  assessDescriptionCompleteness,
  calculateMatch
} = require('../services/lostFoundMatcher');

const {
  getTransitAnalytics,
  getProjectedDemand
} = require('../services/analyticsService');

const logger = require('../utils/logger');

describe('Unit Tests: Deterministic Route Engine', () => {
  test('CANONICAL_HUBS contains core Jammu transit hubs with valid coordinates', () => {
    const requiredHubs = [
      'janipur',
      'jewelChowk',
      'gandhiNagar',
      'jammuUniversity',
      'railwayStation',
      'satwari',
      'channiHimmat',
      'talabTillo',
      'panjtirthi',
      'parade'
    ];

    for (const hubKey of requiredHubs) {
      const hub = CANONICAL_HUBS[hubKey];
      assert.ok(hub, `Hub ${hubKey} must exist in CANONICAL_HUBS`);
      assert.ok(typeof hub.lat === 'number', `${hubKey} must have numeric latitude`);
      assert.ok(typeof hub.lng === 'number', `${hubKey} must have numeric longitude`);
      assert.ok(typeof hub.name === 'string', `${hubKey} must have name`);
    }
  });

  test('Haversine distance calculates accurate geographic distance between points', () => {
    // Janipur to Gandhi Nagar (~5.5 - 6 km)
    const dist = haversineDistance(
      { lat: CANONICAL_HUBS.janipur.lat, lng: CANONICAL_HUBS.janipur.lng },
      { lat: CANONICAL_HUBS.gandhiNagar.lat, lng: CANONICAL_HUBS.gandhiNagar.lng }
    );
    assert.ok(dist >= 4.5 && dist <= 7.0, `Expected distance between 4.5 and 7.0 km, got ${dist}`);
  });

  test('Optimization: Duration produces journey from Janipur to Jammu University', async () => {
    const result = await findMultimodalRoutes('Janipur', 'Jammu University', 'duration');
    assert.strictEqual(result.success, true);
    assert.ok(result.routes.length >= 1);
    const primary = result.routes[0];
    assert.ok(primary.totalDurationMins > 0);
    assert.ok(primary.totalFare > 0);
    assert.strictEqual(primary.legs[0].from, 'Janipur');
    assert.strictEqual(primary.legs[primary.legs.length - 1].to, 'Jammu University');
  });

  test('Optimization: Cost preference selects economic transit combinations', async () => {
    const resultCost = await findMultimodalRoutes('Jewel Chowk', 'Jammu Tawi Railway Station', 'cost');
    assert.strictEqual(resultCost.success, true);
    const primaryCost = resultCost.routes[0];
    assert.ok(primaryCost.totalFare <= 30, 'Cost optimized route should utilize economic bus/walk legs');
  });

  test('Optimization: Transfers preference minimizes intermediate modal shifts', async () => {
    const resultTransfers = await findMultimodalRoutes('Jewel Chowk', 'Jammu University', 'transfers');
    assert.strictEqual(resultTransfers.success, true);
    const primary = resultTransfers.routes[0];
    assert.strictEqual(primary.transfers, 0, 'Direct connection should have 0 transfers');
  });

  test('Handles identical origin and destination cleanly without crashing', async () => {
    const result = await findMultimodalRoutes('Gandhi Nagar', 'Gandhi Nagar', 'duration');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'SAME_LOCATION');
  });

  test('Handles unrecognized locations with UNKNOWN_ORIGIN code', async () => {
    const result = await findMultimodalRoutes('NonExistentPlaceXYZ', 'Gandhi Nagar', 'duration');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'UNKNOWN_ORIGIN');
  });

  test('Alternative routes generator returns distinct transit options', async () => {
    const result = await findMultimodalRoutes('Janipur', 'Jammu Tawi Railway Station', 'duration');
    assert.strictEqual(result.success, true);
    assert.ok(result.routes.length >= 2, 'Should generate primary and alternative route');
    assert.notStrictEqual(result.routes[0].routeId, result.routes[1].routeId);
  });
});

describe('Unit Tests: Lost & Found Similarity Engine', () => {
  test('Tokenization and descriptive scoring matches complementary keywords', () => {
    const lostItem = {
      reporterId: 'user_1',
      reportType: 'lost',
      category: 'electronics',
      location: 'Route 1A',
      itemDescription: 'Lost black Lenovo ThinkPad 65W laptop charger with USB-C cable',
      contactDetails: '+91-94191-11111',
      createdAt: new Date().toISOString()
    };

    const foundItem = {
      reporterId: 'user_2',
      reportType: 'found',
      category: 'electronics',
      location: 'Route 1A',
      itemDescription: 'Found Lenovo laptop charger 65W near front row seats',
      contactDetails: '+91-94191-22222',
      createdAt: new Date().toISOString()
    };

    const match = calculateMatch(lostItem, foundItem);
    assert.ok(match, 'Complementary reports should match');
    assert.ok(match.matchScore >= 50, `Score should be >= 50, got ${match.matchScore}`);
    assert.ok(match.matchSignals.some(s => s.signal === 'Category Match'));
    assert.ok(match.matchSignals.some(s => s.signal === 'Transit Location Overlap'));
  });

  test('Privacy contact redaction protects commuter phone numbers and emails', () => {
    const phoneRedacted = redactContact('Phone: +91-94191-23456');
    assert.strictEqual(phoneRedacted.includes('23456'), false);
    assert.match(phoneRedacted, /\+91-94191-XXXXX/);

    const emailRedacted = redactContact('Contact: rahul.sharma@example.com');
    assert.strictEqual(emailRedacted.includes('rahul.sharma'), false);
    assert.match(emailRedacted, /r\*\*\*@example\.com/);
  });

  test('Description completeness assessor flags short and uninformative reports', () => {
    const shortCheck = assessDescriptionCompleteness('lost phone');
    assert.strictEqual(shortCheck.isComplete, false);
    assert.ok(shortCheck.warning.length > 0);

    const detailedCheck = assessDescriptionCompleteness('Navy blue Dell Inspiron laptop with a silver Apple sticker near trackpad');
    assert.strictEqual(detailedCheck.isComplete, true);
    assert.strictEqual(detailedCheck.warning, null);
  });
});

describe('Unit Tests: Transit Demand Analytics Engine', () => {
  test('Projected demand returns realistic Jammu time-of-day traffic model', () => {
    const forecast = getProjectedDemand();
    assert.ok(forecast.model.includes('Jammu'));
    assert.ok(typeof forecast.currentHour === 'number');
    assert.ok(['Low', 'Medium', 'High'].includes(forecast.currentCongestionLevel));
    assert.ok(forecast.currentMultiplier > 0);
    assert.ok(Array.isArray(forecast.forecastedRushHours));
  });

  test('Analytics service returns structured demand metrics without fabricating statistics', async () => {
    const analytics = await getTransitAnalytics();
    assert.ok(analytics);
    assert.ok(typeof analytics.hasSufficientData === 'boolean');
    assert.ok(analytics.projectedForecast);
    assert.ok(analytics.projectedForecast.currentCongestionLevel);
  });
});

describe('Unit Tests: Structured Logger & Data Sanitization', () => {
  test('Sanitizes sensitive password, token, and authorization fields', () => {
    const payload = {
      email: 'driver@test.com',
      password: 'SuperSecretPassword123',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz',
      nested: {
        authorization: 'Bearer secret_token_value',
        apiKey: 'AIzaSyExampleKey123'
      }
    };

    const sanitized = logger.sanitize(payload);
    assert.strictEqual(sanitized.password, '[REDACTED]');
    assert.strictEqual(sanitized.token, '[REDACTED]');
    assert.strictEqual(sanitized.nested.authorization, '[REDACTED]');
    assert.strictEqual(sanitized.nested.apiKey, '[REDACTED]');
    assert.strictEqual(sanitized.email, 'driver@test.com');
  });
});
