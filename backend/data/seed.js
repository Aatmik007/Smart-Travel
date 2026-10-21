const bcrypt = require('bcryptjs');
const dbService = require('./dbService');

const jammuLocations = {
  janipur: { name: 'Janipur', lat: 32.7533, lng: 74.8461 },
  jewelChowk: { name: 'Jewel Chowk', lat: 32.7291, lng: 74.8617 },
  gandhiNagar: { name: 'Gandhi Nagar', lat: 32.7096, lng: 74.8732 },
  jammuUniversity: { name: 'Jammu University', lat: 32.7163, lng: 74.8647 },
  railwayStation: { name: 'Jammu Tawi Railway Station', lat: 32.7056, lng: 74.8794 },
  channiHimmat: { name: 'Channi Himmat', lat: 32.6953, lng: 74.8967 },
  satwari: { name: 'Satwari Chowk (Airport)', lat: 32.6888, lng: 74.8622 },
  talabTillo: { name: 'Talab Tillo', lat: 32.7275, lng: 74.8317 },
  panjtirthi: { name: 'Panjtirthi', lat: 32.7431, lng: 74.8719 },
  parade: { name: 'Parade Ground', lat: 32.7358, lng: 74.8672 }
};

async function seedAll() {
  try {
    const existingUsers = await dbService.find('users');
    if (existingUsers.length > 0) {
      console.log('Database already seeded. Skipping seed.');
      return;
    }

    console.log('Seeding initial data for JammuMove...');

    // Hashed Passwords
    const adminPassword = bcrypt.hashSync('admin123', 10);
    const driverPassword = bcrypt.hashSync('driver123', 10);
    const passengerPassword = bcrypt.hashSync('pass123', 10);

    // 1. Create Users
    const admin = await dbService.create('users', {
      name: 'JammuMove Administrator',
      email: 'admin@jammumove.com',
      password: adminPassword,
      role: 'admin',
      phone: '+91-94191-11111'
    });

    const driver1 = await dbService.create('users', {
      name: 'Raman Singh',
      email: 'driver1@jammumove.com',
      password: driverPassword,
      role: 'driver',
      phone: '+91-94191-22222'
    });

    const driver2 = await dbService.create('users', {
      name: 'Mohammad Bilal',
      email: 'driver2@jammumove.com',
      password: driverPassword,
      role: 'driver',
      phone: '+91-94191-33333'
    });

    const passenger1 = await dbService.create('users', {
      name: 'Aarav Sharma',
      email: 'passenger1@jammumove.com',
      password: passengerPassword,
      role: 'passenger',
      phone: '+91-94191-44444'
    });

    const passenger2 = await dbService.create('users', {
      name: 'Sneha Gupta',
      email: 'passenger2@jammumove.com',
      password: passengerPassword,
      role: 'passenger',
      phone: '+91-94191-55555'
    });

    // 2. Create Vehicles
    const vehicle1 = await dbService.create('vehicles', {
      driverId: driver1._id,
      model: 'Maruti Suzuki Swift',
      plateNumber: 'JK02AZ-1234',
      capacity: 4,
      type: 'car'
    });

    const vehicle2 = await dbService.create('vehicles', {
      driverId: driver2._id,
      model: 'Bajaj RE Auto',
      plateNumber: 'JK02BW-5678',
      capacity: 3,
      type: 'auto'
    });

    // 3. Create Drivers Info
    await dbService.create('drivers', {
      userId: driver1._id,
      licenseNumber: 'DL-JK0220220101',
      rating: 4.8,
      vehicleId: vehicle1._id,
      isApproved: true
    });

    await dbService.create('drivers', {
      userId: driver2._id,
      licenseNumber: 'DL-JK0220230202',
      rating: 4.6,
      vehicleId: vehicle2._id,
      isApproved: true
    });

    // Update drivers back-ref
    await dbService.findByIdAndUpdate('users', driver1._id, { profilePic: 'driver_avatar_1' });
    await dbService.findByIdAndUpdate('users', driver2._id, { profilePic: 'driver_avatar_2' });

    // 4. Create Bus Routes
    const busRoute1 = await dbService.create('busRoutes', {
      name: 'Janipur to Satwari Airport Express',
      routeNumber: '1A',
      stops: [
        jammuLocations.janipur,
        jammuLocations.jewelChowk,
        jammuLocations.gandhiNagar,
        jammuLocations.satwari
      ]
    });

    const busRoute2 = await dbService.create('busRoutes', {
      name: 'Panjtirthi to Railway Station circular route',
      routeNumber: '4',
      stops: [
        jammuLocations.panjtirthi,
        jammuLocations.parade,
        jammuLocations.jewelChowk,
        jammuLocations.jammuUniversity,
        jammuLocations.railwayStation
      ]
    });

    // 5. Create Trips (Active & Scheduled Carpools + Buses)
    // Trip 1: Raman (Janipur to Gandhi Nagar)
    const trip1 = await dbService.create('trips', {
      type: 'carpool',
      driverId: driver1._id,
      routeName: 'Janipur ➔ Gandhi Nagar Carpool',
      startLocation: jammuLocations.janipur,
      endLocation: jammuLocations.gandhiNagar,
      path: [
        jammuLocations.janipur,
        jammuLocations.jewelChowk,
        jammuLocations.gandhiNagar
      ],
      price: 80,
      departureTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // starts in 1 hour
      status: 'scheduled',
      availableSeats: 3,
      stops: ['Jewel Chowk']
    });

    // Trip 2: Bilal (Jammu University to Channi Himmat) - ACTIVE (simulates live tracking)
    const trip2 = await dbService.create('trips', {
      type: 'carpool',
      driverId: driver2._id,
      routeName: 'University ➔ Channi Auto pool',
      startLocation: jammuLocations.jammuUniversity,
      endLocation: jammuLocations.channiHimmat,
      path: [
        jammuLocations.jammuUniversity,
        jammuLocations.railwayStation,
        jammuLocations.channiHimmat
      ],
      price: 50,
      departureTime: new Date().toISOString(), // starts now
      status: 'active',
      availableSeats: 2,
      stops: ['Railway Station']
    });

    // Trip 3: Bus Route 1A Scheduled
    await dbService.create('trips', {
      type: 'bus',
      routeName: 'Route 1A Bus Service',
      startLocation: jammuLocations.janipur,
      endLocation: jammuLocations.satwari,
      path: [
        jammuLocations.janipur,
        jammuLocations.jewelChowk,
        jammuLocations.gandhiNagar,
        jammuLocations.satwari
      ],
      price: 25,
      departureTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 mins
      status: 'scheduled',
      availableSeats: 40,
      stops: ['Jewel Chowk', 'Gandhi Nagar']
    });

    // Trip 4: Bus Route 4 Scheduled
    await dbService.create('trips', {
      type: 'bus',
      routeName: 'Route 4 Bus Service',
      startLocation: jammuLocations.panjtirthi,
      endLocation: jammuLocations.railwayStation,
      path: [
        jammuLocations.panjtirthi,
        jammuLocations.parade,
        jammuLocations.jewelChowk,
        jammuLocations.jammuUniversity,
        jammuLocations.railwayStation
      ],
      price: 20,
      departureTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // 45 mins
      status: 'scheduled',
      availableSeats: 40,
      stops: ['Parade Ground', 'Jewel Chowk', 'Jammu University']
    });

    // 6. Create initial Lost & Found item
    await dbService.create('lostFound', {
      reporterId: passenger1._id,
      itemDescription: 'Black Laptop Charger (Lenovo 65W) forgotten in Route 1A bus',
      tripId: 'bus_trip',
      status: 'reported',
      contactDetails: 'Aarav Sharma - +91-94191-44444'
    });

    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Error seeding data:', err);
  }
}

module.exports = { seedAll };
