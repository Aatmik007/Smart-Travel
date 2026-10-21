const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_phase1_2026';

const { app } = require('../server');
const dbService = require('../data/dbService');

describe('Security & Authentication Tests', () => {
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

  test('Security headers should be present on API responses', async () => {
    const res = await fetch(`${baseUrl}/api/trips`);
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
    assert.strictEqual(res.headers.get('x-xss-protection'), '1; mode=block');
  });

  test('Registration fails if password is shorter than 6 characters', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Short Pass User',
        email: `shortpass_${Date.now()}@test.com`,
        password: '123'
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /Password must be at least 6 characters/i);
  });

  test('Registration fails with invalid email format', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bad Email User',
        email: 'invalid-email-format',
        password: 'validPassword123'
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /valid email/i);
  });

  test('Successful registration returns token and sanitized user object', async () => {
    const uniqueEmail = `testuser_${Date.now()}@jammutest.com`;
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Jammu Commuter',
        email: uniqueEmail,
        password: 'securePassword123',
        role: 'passenger',
        phone: '+91 94191-99887'
      })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.token, 'Token must be returned');
    assert.strictEqual(body.user.email, uniqueEmail);
    assert.strictEqual(body.user.role, 'passenger');
    assert.strictEqual(body.user.password, undefined, 'Password must never be returned in response');
  });

  test('Login fails with incorrect password', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@jammumove.com',
        password: 'wrong_password_attempt'
      })
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.message, 'Invalid email or password.');
  });

  test('Protected endpoint returns 401 if Authorization token is missing', async () => {
    const res = await fetch(`${baseUrl}/api/auth/profile`);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.match(body.message, /token missing/i);
  });
});
