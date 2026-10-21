const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_phase1_2026';

const { app } = require('../server');
const dbService = require('../data/dbService');

describe('RBAC & Authorization Tests', () => {
  let server;
  let baseUrl;
  let adminToken;
  let passengerToken;
  let passengerUserId;
  let unapprovedDriverToken;
  let approvedDriverToken;
  let approvedDriverUserId;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // 1. Get Admin Token
    const adminRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@jammumove.com', password: 'admin123' })
    });
    const adminData = await adminRes.json();
    adminToken = adminData.token;

    // 2. Register a Passenger
    const pRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'RBAC Passenger',
        email: `passenger_rbac_${Date.now()}@test.com`,
        password: 'password123',
        role: 'passenger'
      })
    });
    const pData = await pRes.json();
    passengerToken = pData.token;
    passengerUserId = pData.user._id;

    // 3. Register an Unapproved Driver
    const dRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Driver',
        email: `driver_unapproved_${Date.now()}@test.com`,
        password: 'password123',
        role: 'driver',
        licenseNumber: 'JK02-UNAPPROVED',
        vehicleModel: 'Hyundai i20',
        plateNumber: 'JK02AB-9999',
        capacity: 4,
        vehicleType: 'car'
      })
    });
    const dData = await dRes.json();
    unapprovedDriverToken = dData.token;

    // 4. Register an Approved Driver
    const dAppRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Approved Driver',
        email: `driver_approved_${Date.now()}@test.com`,
        password: 'password123',
        role: 'driver',
        licenseNumber: 'JK02-APPROVED',
        vehicleModel: 'Maruti Dzire',
        plateNumber: 'JK02CD-1111',
        capacity: 4,
        vehicleType: 'car'
      })
    });
    const dAppData = await dAppRes.json();
    approvedDriverToken = dAppData.token;
    approvedDriverUserId = dAppData.user._id;

    // Approve the second driver directly via driverId lookup
    const driverRecord = await dbService.findOne('drivers', { userId: approvedDriverUserId });
    if (driverRecord) {
      await dbService.findByIdAndUpdate('drivers', driverRecord._id, { isApproved: true });
    }
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('Passenger cannot access Admin Stats endpoint (returns 403)', async () => {
    const res = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { 'Authorization': `Bearer ${passengerToken}` }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /Administrator privileges required/i);
  });

  test('Passenger cannot publish carpool trips (returns 403)', async () => {
    const res = await fetch(`${baseUrl}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passengerToken}`
      },
      body: JSON.stringify({
        startLocation: { name: 'Janipur', lat: 32.7533, lng: 74.8461 },
        endLocation: { name: 'Gandhi Nagar', lat: 32.7096, lng: 74.8732 },
        price: 80,
        departureTime: new Date(Date.now() + 3600000).toISOString(),
        availableSeats: 3
      })
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /Only registered drivers/i);
  });

  test('Unapproved driver is blocked from publishing trips (returns 403)', async () => {
    const res = await fetch(`${baseUrl}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${unapprovedDriverToken}`
      },
      body: JSON.stringify({
        startLocation: { name: 'Janipur', lat: 32.7533, lng: 74.8461 },
        endLocation: { name: 'Gandhi Nagar', lat: 32.7096, lng: 74.8732 },
        price: 80,
        departureTime: new Date(Date.now() + 3600000).toISOString(),
        availableSeats: 3
      })
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /pending administrator verification/i);
  });

  test('Verified driver can publish trip successfully (returns 201)', async () => {
    const res = await fetch(`${baseUrl}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${approvedDriverToken}`
      },
      body: JSON.stringify({
        startLocation: { name: 'Jewel Chowk', lat: 32.7291, lng: 74.8617 },
        endLocation: { name: 'Satwari', lat: 32.6888, lng: 74.8622 },
        price: 50,
        departureTime: new Date(Date.now() + 7200000).toISOString(),
        availableSeats: 3,
        stops: ['Gandhi Nagar']
      })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.trip);
    assert.strictEqual(body.trip.status, 'scheduled');
  });

  test('Unauthorized user cannot update another user lost & found report (returns 403)', async () => {
    // 1. Create lost report as passenger
    const reportRes = await fetch(`${baseUrl}/api/utility/lost-found`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passengerToken}`
      },
      body: JSON.stringify({
        itemDescription: 'Blue umbrella left in auto',
        contactDetails: '+91 94191-00000'
      })
    });
    const reportData = await reportRes.json();
    const itemId = reportData.item._id;

    // 2. Attempt to update it using unapprovedDriverToken (different user)
    const updateRes = await fetch(`${baseUrl}/api/utility/lost-found/${itemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${unapprovedDriverToken}`
      },
      body: JSON.stringify({ status: 'claimed' })
    });

    assert.strictEqual(updateRes.status, 403);
    const updateBody = await updateRes.json();
    assert.match(updateBody.message, /Only the item reporter or an administrator/i);

    // 3. Admin can update it
    const adminUpdateRes = await fetch(`${baseUrl}/api/utility/lost-found/${itemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'claimed' })
    });
    assert.strictEqual(adminUpdateRes.status, 200);
  });
});
