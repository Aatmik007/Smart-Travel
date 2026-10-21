const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_phase4_carpool_2026';

const { app } = require('../server');
const dbService = require('../data/dbService');

describe('Phase 4: Carpool Lifecycle, Concurrency & State Machine Tests', () => {
  let server;
  let baseUrl;

  let driverToken;
  let driverUserId;

  let otherDriverToken;

  let passenger1Token;
  let passenger1UserId;

  let passenger2Token;
  let passenger2UserId;

  let passenger3Token;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // 1. Create Primary Driver
    const dRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Phase4 Driver',
        email: `driver_p4_${Date.now()}@test.com`,
        password: 'password123',
        role: 'driver',
        licenseNumber: 'JK02-P4DRV',
        vehicleModel: 'Hyundai Creta',
        plateNumber: 'JK02-9999',
        capacity: 4,
        vehicleType: 'car'
      })
    });
    const dData = await dRes.json();
    driverToken = dData.token;
    driverUserId = dData.user._id;

    const dRec = await dbService.findOne('drivers', { userId: driverUserId });
    if (dRec) {
      await dbService.findByIdAndUpdate('drivers', dRec._id, { isApproved: true });
    }

    // 2. Create Other Driver (for unauthorized access testing)
    const odRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Other Driver',
        email: `other_drv_${Date.now()}@test.com`,
        password: 'password123',
        role: 'driver',
        licenseNumber: 'JK02-OTHER',
        vehicleModel: 'Maruti Swift',
        plateNumber: 'JK02-1111',
        capacity: 4,
        vehicleType: 'car'
      })
    });
    const odData = await odRes.json();
    otherDriverToken = odData.token;

    // 3. Create Passenger 1
    const p1Res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Passenger One',
        email: `p1_${Date.now()}@test.com`,
        password: 'password123',
        role: 'passenger',
        phone: '+91-94191-11111'
      })
    });
    const p1Data = await p1Res.json();
    passenger1Token = p1Data.token;
    passenger1UserId = p1Data.user._id;

    // 4. Create Passenger 2
    const p2Res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Passenger Two',
        email: `p2_${Date.now()}@test.com`,
        password: 'password123',
        role: 'passenger',
        phone: '+91-94191-22222'
      })
    });
    const p2Data = await p2Res.json();
    passenger2Token = p2Data.token;
    passenger2UserId = p2Data.user._id;

    // 5. Create Passenger 3
    const p3Res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Passenger Three',
        email: `p3_${Date.now()}@test.com`,
        password: 'password123',
        role: 'passenger',
        phone: '+91-94191-33333'
      })
    });
    const p3Data = await p3Res.json();
    passenger3Token = p3Data.token;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  // Helper to publish a ride
  async function createTestTrip(seats = 1, price = 60) {
    const res = await fetch(`${baseUrl}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverToken}`
      },
      body: JSON.stringify({
        startLocation: { name: 'Janipur', lat: 32.7533, lng: 74.8461 },
        endLocation: { name: 'Gandhi Nagar', lat: 32.7096, lng: 74.8732 },
        price,
        departureTime: new Date(Date.now() + 7200000).toISOString(), // 2 hours in future
        availableSeats: seats,
        stops: ['Jewel Chowk'],
        type: 'carpool'
      })
    });
    const data = await res.json();
    return data.trip;
  }

  test('CONCURRENCY: Multiple passengers simultaneously race for the last remaining seat', async () => {
    // Create a trip with EXACTLY 1 available seat
    const trip = await createTestTrip(1, 75);
    const tripId = trip._id;

    // Passenger 1, Passenger 2, and Passenger 3 all fire booking requests concurrently
    const [res1, res2, res3] = await Promise.all([
      fetch(`${baseUrl}/api/trips/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${passenger1Token}` },
        body: JSON.stringify({ tripId, seatsBooked: 1 })
      }),
      fetch(`${baseUrl}/api/trips/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${passenger2Token}` },
        body: JSON.stringify({ tripId, seatsBooked: 1 })
      }),
      fetch(`${baseUrl}/api/trips/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${passenger3Token}` },
        body: JSON.stringify({ tripId, seatsBooked: 1 })
      })
    ]);

    const results = [
      { status: res1.status, data: await res1.json() },
      { status: res2.status, data: await res2.json() },
      { status: res3.status, data: await res3.json() }
    ];

    const successes = results.filter(r => r.status === 201);
    const failures = results.filter(r => r.status === 400);

    // Exactly ONE passenger should succeed; the other two must be rejected (no overbooking)
    assert.strictEqual(successes.length, 1, 'Exactly one concurrent booking request must succeed');
    assert.strictEqual(failures.length, 2, 'The remaining concurrent booking requests must fail with 400');

    // Verify trip capacity is exactly 0 (no negative or corrupted seats)
    const updatedTrip = await dbService.findById('trips', tripId);
    assert.strictEqual(updatedTrip.availableSeats, 0);
  });

  test('DUPLICATE BOOKING GUARD: Passenger cannot book the same trip twice while active/pending', async () => {
    const trip = await createTestTrip(3, 50);
    const tripId = trip._id;

    // First booking request succeeds
    const firstRes = await fetch(`${baseUrl}/api/trips/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${passenger1Token}` },
      body: JSON.stringify({ tripId, seatsBooked: 1 })
    });
    assert.strictEqual(firstRes.status, 201);

    // Second booking request by same passenger for same trip must be rejected with 400
    const secondRes = await fetch(`${baseUrl}/api/trips/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${passenger1Token}` },
      body: JSON.stringify({ tripId, seatsBooked: 1 })
    });
    assert.strictEqual(secondRes.status, 400);
    const secondData = await secondRes.json();
    assert.match(secondData.message, /already have an active or pending booking/i);
  });

  test('DRIVER ACCEPT WORKFLOW: Driver accepts passenger request; status becomes confirmed', async () => {
    const trip = await createTestTrip(2, 80);
    const tripId = trip._id;

    // Passenger requests booking
    const bookRes = await fetch(`${baseUrl}/api/trips/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${passenger1Token}` },
      body: JSON.stringify({ tripId, seatsBooked: 1 })
    });
    assert.strictEqual(bookRes.status, 201);
    const bookData = await bookRes.json();
    const bookingId = bookData.booking._id;
    assert.strictEqual(bookData.booking.status, 'pending');

    // Driver accepts request
    const acceptRes = await fetch(`${baseUrl}/api/trips/bookings/${bookingId}/respond`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${driverToken}` },
      body: JSON.stringify({ action: 'accept' })
    });
    assert.strictEqual(acceptRes.status, 200);
    const acceptData = await acceptRes.json();
    assert.strictEqual(acceptData.booking.status, 'confirmed');

    // Verify booking in DB is confirmed
    const savedBooking = await dbService.findById('bookings', bookingId);
    assert.strictEqual(savedBooking.status, 'confirmed');
  });

  test('DRIVER REJECT WORKFLOW: Driver rejects passenger request; seats are restored', async () => {
    const trip = await createTestTrip(2, 80);
    const tripId = trip._id;

    // Passenger requests booking (reserving 1 seat, 1 seat remaining)
    const bookRes = await fetch(`${baseUrl}/api/trips/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${passenger1Token}` },
      body: JSON.stringify({ tripId, seatsBooked: 1 })
    });
    assert.strictEqual(bookRes.status, 201);
    const bookData = await bookRes.json();
    const bookingId = bookData.booking._id;

    let tripCheck = await dbService.findById('trips', tripId);
    assert.strictEqual(tripCheck.availableSeats, 1);

    // Driver rejects request
    const rejectRes = await fetch(`${baseUrl}/api/trips/bookings/${bookingId}/respond`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${driverToken}` },
      body: JSON.stringify({ action: 'reject' })
    });
    assert.strictEqual(rejectRes.status, 200);
    const rejectData = await rejectRes.json();
    assert.strictEqual(rejectData.booking.status, 'cancelled');

    // Verify seats were restored back to 2
    tripCheck = await dbService.findById('trips', tripId);
    assert.strictEqual(tripCheck.availableSeats, 2);
  });

  test('PASSENGER CANCELLATION: Passenger cancels confirmed booking; seats are restored', async () => {
    const trip = await createTestTrip(3, 60);
    const tripId = trip._id;

    // Passenger books 2 seats
    const bookRes = await fetch(`${baseUrl}/api/trips/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${passenger2Token}` },
      body: JSON.stringify({ tripId, seatsBooked: 2 })
    });
    const bookData = await bookRes.json();
    const bookingId = bookData.booking._id;

    let tripCheck = await dbService.findById('trips', tripId);
    assert.strictEqual(tripCheck.availableSeats, 1); // 3 - 2 = 1

    // Passenger cancels their booking
    const cancelRes = await fetch(`${baseUrl}/api/trips/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${passenger2Token}` }
    });
    assert.strictEqual(cancelRes.status, 200);
    const cancelData = await cancelRes.json();
    assert.strictEqual(cancelData.booking.status, 'cancelled');

    // Verify seats were restored back to 3
    tripCheck = await dbService.findById('trips', tripId);
    assert.strictEqual(tripCheck.availableSeats, 3);
  });

  test('STATE MACHINE GUARD: Cannot accept or cancel already cancelled booking', async () => {
    const trip = await createTestTrip(2, 50);
    const bookRes = await fetch(`${baseUrl}/api/trips/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${passenger1Token}` },
      body: JSON.stringify({ tripId: trip._id, seatsBooked: 1 })
    });
    const bookData = await bookRes.json();
    const bookingId = bookData.booking._id;

    // Cancel the booking first
    await fetch(`${baseUrl}/api/trips/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${passenger1Token}` }
    });

    // Attempting to cancel again should fail with 400
    const cancelAgain = await fetch(`${baseUrl}/api/trips/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${passenger1Token}` }
    });
    assert.strictEqual(cancelAgain.status, 400);

    // Attempting to accept a cancelled booking should fail with 400
    const acceptCancelled = await fetch(`${baseUrl}/api/trips/bookings/${bookingId}/respond`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${driverToken}` },
      body: JSON.stringify({ action: 'accept' })
    });
    assert.strictEqual(acceptCancelled.status, 400);
  });

  test('AUTHORIZATION GUARD: Other driver cannot accept or reject booking requests', async () => {
    const trip = await createTestTrip(2, 50);
    const bookRes = await fetch(`${baseUrl}/api/trips/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${passenger1Token}` },
      body: JSON.stringify({ tripId: trip._id, seatsBooked: 1 })
    });
    const bookData = await bookRes.json();
    const bookingId = bookData.booking._id;

    // Other driver attempts to respond to this booking
    const unauthorizedRes = await fetch(`${baseUrl}/api/trips/bookings/${bookingId}/respond`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${otherDriverToken}` },
      body: JSON.stringify({ action: 'accept' })
    });
    assert.strictEqual(unauthorizedRes.status, 403);
    const unauthData = await unauthorizedRes.json();
    assert.match(unauthData.message, /unauthorized|only the driver/i);
  });

  test('AUTHORIZATION GUARD: Other passenger cannot cancel someone else booking', async () => {
    const trip = await createTestTrip(2, 50);
    const bookRes = await fetch(`${baseUrl}/api/trips/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${passenger1Token}` },
      body: JSON.stringify({ tripId: trip._id, seatsBooked: 1 })
    });
    const bookData = await bookRes.json();
    const bookingId = bookData.booking._id;

    // Passenger 2 tries to cancel Passenger 1's booking
    const hackRes = await fetch(`${baseUrl}/api/trips/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${passenger2Token}` }
    });
    assert.strictEqual(hackRes.status, 403);
    const hackData = await hackRes.json();
    assert.match(hackData.message, /only cancel your own/i);
  });

  test('DRIVER MANIFEST: Driver fetches passenger manifest; unauthorized user receives 403', async () => {
    const trip = await createTestTrip(3, 70);
    const tripId = trip._id;

    // Passenger 1 books
    await fetch(`${baseUrl}/api/trips/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${passenger1Token}` },
      body: JSON.stringify({ tripId, seatsBooked: 1 })
    });

    // Driver fetches manifest
    const manifestRes = await fetch(`${baseUrl}/api/trips/${tripId}/bookings`, {
      headers: { 'Authorization': `Bearer ${driverToken}` }
    });
    assert.strictEqual(manifestRes.status, 200);
    const manifestData = await manifestRes.json();
    assert.ok(Array.isArray(manifestData.bookings));
    assert.strictEqual(manifestData.bookings.length, 1);
    assert.strictEqual(manifestData.bookings[0].passenger.name, 'Passenger One');
    assert.strictEqual(manifestData.bookings[0].passenger.phone, '+91-94191-11111');

    // Unauthorized commuter receives 403
    const unauthRes = await fetch(`${baseUrl}/api/trips/${tripId}/bookings`, {
      headers: { 'Authorization': `Bearer ${passenger2Token}` }
    });
    assert.strictEqual(unauthRes.status, 403);
  });

  test('CASCADING CANCEL: Driver cancelling trip cascades cancellation to active bookings', async () => {
    const trip = await createTestTrip(3, 60);
    const tripId = trip._id;

    // Passenger 1 requests booking
    const bRes = await fetch(`${baseUrl}/api/trips/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${passenger1Token}` },
      body: JSON.stringify({ tripId, seatsBooked: 1 })
    });
    const bData = await bRes.json();
    const bookingId = bData.booking._id;

    // Driver cancels the trip
    const cancelTripRes = await fetch(`${baseUrl}/api/trips/${tripId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${driverToken}` },
      body: JSON.stringify({ status: 'cancelled' })
    });
    assert.strictEqual(cancelTripRes.status, 200);

    // Verify booking is automatically marked cancelled
    const bookingCheck = await dbService.findById('bookings', bookingId);
    assert.strictEqual(bookingCheck.status, 'cancelled');
  });
});
