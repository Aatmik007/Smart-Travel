const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_phase1_2026';

const { app } = require('../server');
const dbService = require('../data/dbService');

describe('Trips, Single Fetch, and Booking Tests', () => {
  let server;
  let baseUrl;
  let driverToken;
  let driverUserId;
  let passengerToken;
  let passengerUserId;
  let testTripId;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // 1. Create Verified Driver
    const dRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Booking Driver',
        email: `driver_bk_${Date.now()}@test.com`,
        password: 'password123',
        role: 'driver',
        licenseNumber: 'JK02-BK001',
        vehicleModel: 'Maruti Brezza',
        plateNumber: 'JK02EF-2222',
        capacity: 4,
        vehicleType: 'car'
      })
    });
    const dData = await dRes.json();
    driverToken = dData.token;
    driverUserId = dData.user._id;

    // Approve the driver
    const driverRecord = await dbService.findOne('drivers', { userId: driverUserId });
    if (driverRecord) {
      await dbService.findByIdAndUpdate('drivers', driverRecord._id, { isApproved: true });
    }

    // 2. Create Passenger
    const pRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Booking Passenger',
        email: `passenger_bk_${Date.now()}@test.com`,
        password: 'password123',
        role: 'passenger'
      })
    });
    const pData = await pRes.json();
    passengerToken = pData.token;
    passengerUserId = pData.user._id;

    // 3. Driver creates a test trip with 2 available seats
    const tripRes = await fetch(`${baseUrl}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverToken}`
      },
      body: JSON.stringify({
        startLocation: { name: 'Jammu University', lat: 32.7163, lng: 74.8647 },
        endLocation: { name: 'Channi Himmat', lat: 32.6953, lng: 74.8967 },
        price: 50,
        departureTime: new Date(Date.now() + 3600000).toISOString(),
        availableSeats: 2,
        stops: ['Railway Station']
      })
    });
    const tripData = await tripRes.json();
    testTripId = tripData.trip._id;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('GET /api/trips/:tripId returns 200 with enriched trip details', async () => {
    const res = await fetch(`${baseUrl}/api/trips/${testTripId}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.trip);
    assert.strictEqual(body.trip._id.toString(), testTripId.toString());
    assert.strictEqual(body.trip.driverName, 'Booking Driver');
    assert.strictEqual(body.trip.plateNumber, 'JK02EF-2222');
  });

  test('GET /api/trips/:tripId returns 404 for invalid/non-existent tripId', async () => {
    const res = await fetch(`${baseUrl}/api/trips/non_existent_trip_id_999`);
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.match(body.message, /Trip not found/i);
  });

  test('Driver cannot book their own offered trip (returns 400)', async () => {
    const res = await fetch(`${baseUrl}/api/trips/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverToken}`
      },
      body: JSON.stringify({
        tripId: testTripId,
        seatsBooked: 1
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /cannot book your own/i);
  });

  test('Passenger cannot book more seats than available (returns 400)', async () => {
    const res = await fetch(`${baseUrl}/api/trips/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passengerToken}`
      },
      body: JSON.stringify({
        tripId: testTripId,
        seatsBooked: 5 // only 2 seats available
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /seats available/i);
  });

  test('Passenger successfully books 1 seat, decrementing available capacity', async () => {
    const res = await fetch(`${baseUrl}/api/trips/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passengerToken}`
      },
      body: JSON.stringify({
        tripId: testTripId,
        seatsBooked: 1
      })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.booking);
    assert.strictEqual(body.booking.seatsBooked, 1);
    assert.strictEqual(body.booking.totalPrice, 50);

    // Verify seats decremented on the trip record
    const updatedTrip = await dbService.findById('trips', testTripId);
    assert.strictEqual(updatedTrip.availableSeats, 1);
  });

  test('Driver can update their trip status to active (returns 200)', async () => {
    const res = await fetch(`${baseUrl}/api/trips/${testTripId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverToken}`
      },
      body: JSON.stringify({ status: 'active' })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.trip.status, 'active');
  });

  test('Unauthorized user cannot update trip status (returns 403)', async () => {
    const res = await fetch(`${baseUrl}/api/trips/${testTripId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passengerToken}`
      },
      body: JSON.stringify({ status: 'completed' })
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /Only the assigned driver or an administrator/i);
  });
});
