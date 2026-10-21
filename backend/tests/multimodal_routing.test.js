process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_phase1_2026';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { app } = require('../server');
const dbService = require('../data/dbService');

describe('Multimodal Route Engine & AI Assistant Integration Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  // 1. Direct and Multimodal Route Calculations
  test('POST /api/routes/multimodal calculates valid route between Janipur and Gandhi Nagar', async () => {
    const res = await fetch(`${baseUrl}/api/routes/multimodal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: 'Janipur',
        destination: 'Gandhi Nagar',
        preference: 'duration'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.origin.id, 'janipur');
    assert.strictEqual(body.destination.id, 'gandhiNagar');
    assert.ok(Array.isArray(body.routes));
    assert.ok(body.routes.length >= 1);

    const primary = body.routes[0];
    assert.ok(primary.totalFare > 0);
    assert.ok(primary.totalDurationMins > 0);
    assert.ok(Array.isArray(primary.legs));
    assert.ok(primary.legs.length >= 1);
    assert.strictEqual(primary.confidence, 'verified');

    // Each leg must have structured properties
    for (const leg of primary.legs) {
      assert.ok(leg.from);
      assert.ok(leg.to);
      assert.ok(['bus', 'erickshaw', 'walking', 'carpool'].includes(leg.mode));
      assert.ok(typeof leg.durationMins === 'number');
      assert.ok(typeof leg.fare === 'number');
      assert.ok(leg.instruction);
    }
  });

  test('POST /api/routes/multimodal returns multimodal journey for Janipur to Railway Station', async () => {
    const res = await fetch(`${baseUrl}/api/routes/multimodal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: 'Janipur',
        destination: 'Jammu Tawi Railway Station',
        preference: 'duration'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.routes.length >= 1);

    const primary = body.routes[0];
    // Janipur to Railway Station requires transit transfer
    assert.ok(primary.legs.length >= 2);
    assert.ok(primary.totalFare >= 20);
    assert.ok(primary.totalDurationMins >= 15);
  });

  test('POST /api/routes/multimodal includes walking transfer with zero fare between Panjtirthi and Parade Ground', async () => {
    const res = await fetch(`${baseUrl}/api/routes/multimodal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: 'Panjtirthi',
        destination: 'Parade Ground',
        preference: 'cost'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    const primary = body.routes[0];

    // Under cost preference, walking is free (₹0)
    assert.strictEqual(primary.totalFare, 0);
    assert.ok(primary.modes.includes('walking'));
    assert.strictEqual(primary.legs[0].fare, 0);
    assert.strictEqual(primary.legs[0].mode, 'walking');
  });

  // 2. Optimization Preferences
  test('Route engine respects cost optimization preference', async () => {
    const costRes = await fetch(`${baseUrl}/api/routes/multimodal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: 'Janipur',
        destination: 'Jammu Tawi Railway Station',
        preference: 'cost'
      })
    });

    assert.strictEqual(costRes.status, 200);
    const costData = await costRes.json();
    const costRoute = costData.routes[0];

    // Bus-based transit path fare is significantly lower than private carpool
    assert.ok(costRoute.totalFare <= 45);
    assert.ok(costRoute.modes.includes('bus'));
  });

  test('Route engine provides alternative route options when multiple valid paths exist', async () => {
    const res = await fetch(`${baseUrl}/api/routes/multimodal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: 'Janipur',
        destination: 'Jammu Tawi Railway Station',
        preference: 'duration'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    // Engine generates alternatives (e.g. Carpool+Auto vs Pure Bus)
    assert.ok(body.routes.length >= 2, `Expected at least 2 route options, got ${body.routes.length}`);
    assert.notStrictEqual(body.routes[0].routeId, body.routes[1].routeId);
  });

  // 3. Disconnected / Unknown / Invalid Inputs
  test('POST /api/routes/multimodal returns 404 with list of supported hubs for unrecognized origin', async () => {
    const res = await fetch(`${baseUrl}/api/routes/multimodal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: 'Katra Vaishno Devi',
        destination: 'Gandhi Nagar'
      })
    });

    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.code, 'UNKNOWN_ORIGIN');
    assert.ok(Array.isArray(body.supportedHubs));
    assert.ok(body.supportedHubs.includes('Janipur'));
    assert.ok(body.supportedHubs.includes('Gandhi Nagar'));
  });

  test('POST /api/routes/multimodal returns 404 for unrecognized destination', async () => {
    const res = await fetch(`${baseUrl}/api/routes/multimodal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: 'Janipur',
        destination: 'Udhampur Cantt'
      })
    });

    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.code, 'UNKNOWN_DESTINATION');
  });

  test('POST /api/routes/multimodal returns 400 when origin and destination are identical', async () => {
    const res = await fetch(`${baseUrl}/api/routes/multimodal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: 'Janipur',
        destination: 'Janipur'
      })
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /identical/i);
  });

  test('POST /api/routes/multimodal validates missing inputs and invalid preference', async () => {
    const missingRes = await fetch(`${baseUrl}/api/routes/multimodal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(missingRes.status, 400);

    const invalidPrefRes = await fetch(`${baseUrl}/api/routes/multimodal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: 'Janipur',
        destination: 'Gandhi Nagar',
        preference: 'teleport'
      })
    });
    assert.strictEqual(invalidPrefRes.status, 400);
    const body = await invalidPrefRes.json();
    assert.match(body.message, /duration, cost, transfers/i);
  });

  // 4. AI Assistant Multimodal Integration (/api/ai/chat)
  test('AI Chatbot extracts natural language routing query and returns verified routeData', async () => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'How do I go from Janipur to Satwari Airport?'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.reply);
    assert.match(body.reply, /Janipur/i);
    assert.match(body.reply, /Satwari/i);

    // AI Chat response must contain structured routeData matching route engine
    assert.ok(body.routeData, 'Response should contain structured routeData');
    assert.strictEqual(body.routeData.origin.id, 'janipur');
    assert.strictEqual(body.routeData.destination.id, 'satwari');
    assert.ok(body.routeData.routes.length >= 1);
  });

  test('AI Chatbot automatically detects cost preference from keywords', async () => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'What is the cheapest way to travel from Panjtirthi to Railway Station?'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.routeData);
    assert.strictEqual(body.routeData.preference, 'cost');
    assert.ok(body.routeData.routes[0].totalFare <= 25);
  });

  test('AI Chatbot gracefully handles unrecognized route queries without crashing', async () => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Can you book a flight from Jammu to Srinagar airport?'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.match(body.reply, /could not determine a verified direct public transit route/i);
    assert.match(body.reply, /Covered Hubs/i);
  });
});
