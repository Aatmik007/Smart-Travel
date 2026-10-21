const mongoose = require('mongoose');

// User Schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['passenger', 'driver', 'admin'], default: 'passenger' },
  phone: { type: String },
  profilePic: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

// Driver Schema
const DriverSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  licenseNumber: { type: String, required: true },
  rating: { type: Number, default: 5.0 },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  isApproved: { type: Boolean, default: false }
});

// Vehicle Schema
const VehicleSchema = new mongoose.Schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  model: { type: String, required: true },
  plateNumber: { type: String, required: true },
  capacity: { type: Number, required: true },
  type: { type: String, enum: ['car', 'auto', 'bike'], default: 'car' }
});

// Trip Schema (Carpool or Bus)
const TripSchema = new mongoose.Schema({
  type: { type: String, enum: ['carpool', 'bus'], default: 'carpool' },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  routeName: { type: String }, // For bus routes or general trip names
  startLocation: {
    name: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  endLocation: {
    name: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  path: [{
    lat: { type: Number },
    lng: { type: Number }
  }],
  price: { type: Number, required: true },
  departureTime: { type: Date, required: true },
  status: { type: String, enum: ['scheduled', 'active', 'completed', 'cancelled'], default: 'scheduled' },
  availableSeats: { type: Number, required: true },
  stops: [{ type: String }]
});

// Booking Schema
const BookingSchema = new mongoose.Schema({
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seatsBooked: { type: Number, default: 1 },
  totalPrice: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

// BusRoute Schema
const BusRouteSchema = new mongoose.Schema({
  name: { type: String, required: true },
  routeNumber: { type: String, required: true },
  stops: [{
    name: { type: String },
    lat: { type: Number },
    lng: { type: Number }
  }]
});

// Message Schema
const MessageSchema = new mongoose.Schema({
  tripId: { type: String },
  senderId: { type: String, required: true },
  receiverId: { type: String },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// LostFound Schema
const LostFoundSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemDescription: { type: String, required: true },
  category: { type: String, default: 'other' },
  location: { type: String, default: '' },
  reportType: { type: String, enum: ['lost', 'found'], default: 'lost' },
  tripId: { type: String },
  status: { type: String, enum: ['reported', 'found', 'claimed', 'expired'], default: 'reported' },
  contactDetails: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Indexes for performance and analytics
TripSchema.index({ 'startLocation.name': 1, 'endLocation.name': 1 });
TripSchema.index({ departureTime: 1, status: 1 });
TripSchema.index({ driverId: 1, status: 1 });
TripSchema.index({ type: 1, status: 1 });
BookingSchema.index({ tripId: 1, status: 1 });
BookingSchema.index({ tripId: 1, passengerId: 1, status: 1 });
BookingSchema.index({ passengerId: 1, createdAt: -1 });
BookingSchema.index({ createdAt: 1 });
LostFoundSchema.index({ reportType: 1, status: 1, category: 1 });
LostFoundSchema.index({ reporterId: 1, createdAt: -1 });
DriverSchema.index({ userId: 1 });
VehicleSchema.index({ driverId: 1 });

// Notification Schema
const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  type: { type: String, default: 'info' },
  createdAt: { type: Date, default: Date.now }
});

// Complaint Schema
const ComplaintSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tripId: { type: String },
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['pending', 'resolved'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

// Expense Schema
const ExpenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  description: { type: String },
  date: { type: Date, default: Date.now }
});

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
ComplaintSchema.index({ userId: 1, createdAt: -1 });
ComplaintSchema.index({ status: 1, createdAt: -1 });
ExpenseSchema.index({ userId: 1, date: -1 });

module.exports = {
  User: mongoose.model('User', UserSchema),
  Driver: mongoose.model('Driver', DriverSchema),
  Vehicle: mongoose.model('Vehicle', VehicleSchema),
  Trip: mongoose.model('Trip', TripSchema),
  Booking: mongoose.model('Booking', BookingSchema),
  BusRoute: mongoose.model('BusRoute', BusRouteSchema),
  Message: mongoose.model('Message', MessageSchema),
  LostFound: mongoose.model('LostFound', LostFoundSchema),
  Notification: mongoose.model('Notification', NotificationSchema),
  Complaint: mongoose.model('Complaint', ComplaintSchema),
  Expense: mongoose.model('Expense', ExpenseSchema)
};
