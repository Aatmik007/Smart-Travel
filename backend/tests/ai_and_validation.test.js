const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_phase1_2026';

const { app } = require('../server');

describe('AI Features & Validation Middleware Tests', () => {
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

  test('AI Assistant returns accurate transit advice for Janipur to Gandhi Nagar', async () => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'How do I travel from Janipur to Gandhi Nagar?' })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.match(body.reply, /Route 1A/i);
    assert.match(body.reply, /Jewel Chowk/i);
    assert.match(body.reply, /Gandhi Nagar/i);
  });

  test('AI Assistant returns clear explanation and limitation for unserved/unknown location', async () => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'How do I travel from Katra to Leh Ladakh?' })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.match(body.reply, /could not determine a verified direct public transit route/i);
    assert.match(body.reply, /Covered Hubs/i);
    // Must NOT contain the old unhelpful circular message
    assert.doesNotMatch(body.reply, /If you specify your pickup and destination \(e\.g\., 'Janipur to Channi Himmat'\)/i);
  });

  test('AI Assistant handles greetings with helpful orientation', async () => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello JammuMove' })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.match(body.reply, /JammuMove Route Assistant/i);
  });

  test('Fare predictor validates distance and returns realistic tiered rates', async () => {
    const res = await fetch(`${baseUrl}/api/ai/predict-fare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ distance: 10 })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.fares.car > body.fares.auto);
    assert.ok(body.fares.auto > body.fares.bike);
    assert.ok(body.fares.car >= 50);
  });

  test('Fare predictor rejects invalid or negative distances (returns 400)', async () => {
    const res = await fetch(`${baseUrl}/api/ai/predict-fare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ distance: -5 })
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /between 0.1 and 500 kilometers/i);
  });

  test('Spam analyzer identifies zero or excessive prices as suspicious', async () => {
    const res = await fetch(`${baseUrl}/api/ai/check-spam`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price: 0,
        startName: 'Janipur',
        endName: 'Jewel Chowk',
        availableSeats: 3
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.isSpam, true);
    assert.ok(body.reasons.some(r => /greater than zero/i.test(r)));
  });

  test('Spam analyzer identifies identical start and end locations', async () => {
    const res = await fetch(`${baseUrl}/api/ai/check-spam`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price: 80,
        startName: 'Janipur',
        endName: 'Janipur',
        availableSeats: 2
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.isSpam, true);
    assert.ok(body.reasons.some(r => /cannot be identical/i.test(r)));
  });

  test('Demand forecaster returns congestion score and reasoning', async () => {
    const res = await fetch(`${baseUrl}/api/ai/predict-demand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routeName: 'Janipur-Satwari' })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(['Low', 'Medium', 'High'].includes(body.level));
    assert.ok(typeof body.factor === 'number');
    assert.ok(typeof body.reason === 'string');
  });
});
