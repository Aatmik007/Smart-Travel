const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_phase5_resilience_2026';

const { app } = require('../server');
const dbService = require('../data/dbService');

describe('Phase 5: Production Readiness, Observability & Resilience Integration Tests', () => {
  let server;
  let baseUrl;
  let adminToken;
  let driverToken;
  let driverUserId;
  let passengerToken;
  let passengerUserId;
  let testDriverTripId;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // 1. Create Admin User & Token
    const adminUser = await dbService.create('users', {
      name: 'Phase 5 Admin',
      email: `admin_p5_${Date.now()}@test.com`,
      password: 'password123',
      role: 'admin'
    });
    adminToken = jwt.sign({ userId: adminUser._id.toString(), role: 'admin' }, process.env.JWT_SECRET);

    // 2. Create Driver
    const dRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Phase 5 Driver',
        email: `driver_p5_${Date.now()}@test.com`,
        password: 'password123',
        role: 'driver',
        licenseNumber: 'JK02-P5DRV',
        vehicleModel: 'Toyota Innova',
        plateNumber: 'JK02-5555',
        capacity: 6,
        vehicleType: 'car'
      })
    });
    const dData = await dRes.json();
    driverToken = dData.token;
    driverUserId = dData.user._id;

    // Approve driver
    const driverRecord = await dbService.findOne('drivers', { userId: driverUserId });
    if (driverRecord) {
      await dbService.findByIdAndUpdate('drivers', driverRecord._id, { isApproved: true });
    }

    // 3. Create Passenger
    const pRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Phase 5 Commuter',
        email: `commuter_p5_${Date.now()}@test.com`,
        password: 'password123',
        role: 'passenger',
        phone: '+91-94191-88888'
      })
    });
    const pData = await pRes.json();
    passengerToken = pData.token;
    passengerUserId = pData.user._id;

    // Create sample trips for pagination tests
    for (let i = 1; i <= 3; i++) {
      const tRes = await fetch(`${baseUrl}/api/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken}`
        },
        body: JSON.stringify({
          startLocation: { name: 'Janipur', lat: 32.7533, lng: 74.8461 },
          endLocation: { name: 'Gandhi Nagar', lat: 32.7096, lng: 74.8732 },
          price: 50 + i * 5,
          departureTime: new Date(Date.now() + 86400000 * i).toISOString(),
          availableSeats: 4,
          stops: ['Jewel Chowk'],
          type: 'carpool'
        })
      });
      const tData = await tRes.json();
      if (i === 1) testDriverTripId = tData.trip._id;
    }

    // Create sample expenses for pagination tests
    for (let i = 1; i <= 3; i++) {
      await fetch(`${baseUrl}/api/utility/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${passengerToken}`
        },
        body: JSON.stringify({
          amount: 25 * i,
          category: 'bus',
          description: `Bus commute ${i}`
        })
      });
    }
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  // --- HEALTH & READINESS PROBES ---
  test('GET /health and GET /api/health return HTTP 200 with service uptime metadata', async () => {
    const resRoot = await fetch(`${baseUrl}/health`);
    assert.strictEqual(resRoot.status, 200);
    const bodyRoot = await resRoot.json();
    assert.strictEqual(bodyRoot.status, 'UP');
    assert.strictEqual(bodyRoot.service, 'jammumove-backend');
    assert.ok(typeof bodyRoot.uptime === 'number');

    const resApi = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(resApi.status, 200);
    const bodyApi = await resApi.json();
    assert.strictEqual(bodyApi.status, 'UP');
  });

  test('GET /ready and GET /api/ready return HTTP 200 readiness probe', async () => {
    const res = await fetch(`${baseUrl}/ready`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'READY');
    assert.ok(body.mode === 'mongodb' || body.mode === 'mock_json');
  });

  // --- OBSERVABILITY: CORRELATION IDS ---
  test('Preserves incoming X-Correlation-ID header on API responses', async () => {
    const testCorrId = 'jmove-custom-trace-999';
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { 'X-Correlation-ID': testCorrId }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('x-correlation-id'), testCorrId);
  });

  test('Auto-generates unique correlation ID when header is omitted', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const corrId = res.headers.get('x-correlation-id');
    assert.ok(corrId, 'Response must include X-Correlation-ID header');
    assert.ok(corrId.length >= 10, 'Generated ID must be a valid unique string');
  });

  // --- PERFORMANCE & PAGINATION ---
  test('PAGINATION: GET /api/trips?page=1&limit=2 returns paginated slice with metadata', async () => {
    const res = await fetch(`${baseUrl}/api/trips?page=1&limit=2`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.trips));
    assert.ok(body.trips.length <= 2);
    assert.ok(body.pagination);
    assert.strictEqual(body.pagination.page, 1);
    assert.strictEqual(body.pagination.limit, 2);
    assert.ok(body.pagination.total >= 3);
    assert.ok(body.pagination.totalPages >= 2);
  });

  test('PAGINATION: GET /api/utility/expenses?page=1&limit=2 returns paginated expenses', async () => {
    const res = await fetch(`${baseUrl}/api/utility/expenses?page=1&limit=2`, {
      headers: { 'Authorization': `Bearer ${passengerToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.expenses));
    assert.strictEqual(body.expenses.length, 2);
    assert.ok(body.pagination);
    assert.strictEqual(body.pagination.page, 1);
    assert.strictEqual(body.pagination.limit, 2);
    assert.ok(body.pagination.total >= 3);
  });

  test('PAGINATION: GET /api/admin/users?page=1&limit=2 returns paginated users with sanitized passwords', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users?page=1&limit=2`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.users));
    assert.strictEqual(body.users.length, 2);
    assert.ok(body.pagination);
    assert.strictEqual(body.pagination.page, 1);
    assert.strictEqual(body.pagination.limit, 2);
    // Security check: passwords must never be exposed
    for (const u of body.users) {
      assert.strictEqual(u.password, undefined);
    }
  });

  // --- AI PROVIDER RESILIENCE & FALLBACK ---
  test('AI RESILIENCE: Falls back cleanly to deterministic route engine if AI provider is unavailable', async () => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passengerToken}`
      },
      body: JSON.stringify({
        message: 'How do I travel from Janipur to Jammu Tawi Railway Station?'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.reply);
    assert.match(body.reply, /Route 1A|Smart Electric Bus|Railway Station|Step-by-step/i);
    assert.ok(body.routeData);
    assert.strictEqual(body.routeData.success, true);
  });

  test('AI RESILIENCE: Fare prediction operates reliably on deterministic pricing tiers', async () => {
    const res = await fetch(`${baseUrl}/api/ai/predict-fare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ distance: 10 })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.fares);
    assert.ok(typeof body.fares.car === 'number');
    assert.ok(typeof body.fares.auto === 'number');
    assert.ok(typeof body.fares.bike === 'number');
  });

  // --- REGRESSION TESTS ---
  test('REGRESSION: Driver cannot book their own trip (prevents self-booking bug)', async () => {
    const res = await fetch(`${baseUrl}/api/trips/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverToken}`
      },
      body: JSON.stringify({
        tripId: testDriverTripId,
        seatsBooked: 1
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /cannot book your own/i);
  });

  test('REGRESSION: Chatbot handles general greeting without circular fallback', async () => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.reply);
    assert.match(body.reply, /JammuMove/i);
    assert.strictEqual(body.reply.includes('Could you please clarify'), false);
  });
});
