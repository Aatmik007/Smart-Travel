/**
 * Request validation middlewares for JammuMove API routes.
 * Validates bodies, parameters, and query parameters cleanly.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(schemaFn) {
  return (req, res, next) => {
    try {
      const errors = schemaFn(req);
      if (errors && errors.length > 0) {
        return res.status(400).json({
          message: errors[0], // Primary message
          errors // Full list of issues
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// 1. Auth Validations
const validateRegister = validate((req) => {
  const errors = [];
  const { name, email, password, role, phone, vehicleModel, plateNumber, capacity, vehicleType, licenseNumber } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Full name is required and must be at least 2 characters.');
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push('A valid email address is required.');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password must be at least 6 characters long.');
  }

  if (role && !['passenger', 'driver', 'admin'].includes(role)) {
    errors.push('Role must be one of: passenger, driver, admin.');
  }

  if (phone && (typeof phone !== 'string' || phone.trim().length < 5)) {
    errors.push('Phone number format is invalid.');
  }

  if (role === 'driver') {
    if (!licenseNumber || typeof licenseNumber !== 'string' || licenseNumber.trim().length < 4) {
      errors.push('A valid driving license number is required for driver registration.');
    }
    if (!vehicleModel || typeof vehicleModel !== 'string' || vehicleModel.trim().length < 2) {
      errors.push('Vehicle model name is required.');
    }
    if (!plateNumber || typeof plateNumber !== 'string' || plateNumber.trim().length < 4) {
      errors.push('Vehicle plate number is required.');
    }
    const capNum = parseInt(capacity, 10);
    if (isNaN(capNum) || capNum < 1 || capNum > 10) {
      errors.push('Vehicle seat capacity must be an integer between 1 and 10.');
    }
    if (vehicleType && !['car', 'auto', 'bike'].includes(vehicleType)) {
      errors.push('Vehicle type must be car, auto, or bike.');
    }
  }

  return errors;
});

const validateLogin = validate((req) => {
  const errors = [];
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push('A valid email address is required.');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
  }

  return errors;
});

// 2. Trip Validations
const validateCreateTrip = validate((req) => {
  const errors = [];
  const { startLocation, endLocation, price, departureTime, availableSeats, stops, type } = req.body;

  if (!startLocation || typeof startLocation !== 'object') {
    errors.push('Start location object is required.');
  } else {
    if (!startLocation.name || typeof startLocation.name !== 'string') errors.push('Start location name is required.');
    if (typeof startLocation.lat !== 'number' || startLocation.lat < -90 || startLocation.lat > 90) errors.push('Start location latitude is invalid.');
    if (typeof startLocation.lng !== 'number' || startLocation.lng < -180 || startLocation.lng > 180) errors.push('Start location longitude is invalid.');
  }

  if (!endLocation || typeof endLocation !== 'object') {
    errors.push('End location object is required.');
  } else {
    if (!endLocation.name || typeof endLocation.name !== 'string') errors.push('End location name is required.');
    if (typeof endLocation.lat !== 'number' || endLocation.lat < -90 || endLocation.lat > 90) errors.push('End location latitude is invalid.');
    if (typeof endLocation.lng !== 'number' || endLocation.lng < -180 || endLocation.lng > 180) errors.push('End location longitude is invalid.');
  }

  if (startLocation && endLocation && startLocation.name && endLocation.name) {
    if (startLocation.name.trim().toLowerCase() === endLocation.name.trim().toLowerCase()) {
      errors.push('Start and end locations cannot be identical.');
    }
  }

  const numPrice = parseFloat(price);
  if (isNaN(numPrice) || numPrice <= 0 || numPrice > 5000) {
    errors.push('Price must be a valid number between ₹1 and ₹5000.');
  }

  const seats = parseInt(availableSeats, 10);
  if (isNaN(seats) || seats < 1 || seats > 50) {
    errors.push('Available seats must be an integer between 1 and 50.');
  }

  if (!departureTime || isNaN(Date.parse(departureTime))) {
    errors.push('A valid departure date/time is required.');
  }

  if (type && !['carpool', 'bus'].includes(type)) {
    errors.push('Trip type must be carpool or bus.');
  }

  if (stops && !Array.isArray(stops)) {
    errors.push('Stops must be an array of stop names.');
  }

  return errors;
});

const validateBookTrip = validate((req) => {
  const errors = [];
  const { tripId, seatsBooked } = req.body;

  if (!tripId || typeof tripId !== 'string' || tripId.trim().length === 0) {
    errors.push('A valid Trip ID is required.');
  }

  const seats = parseInt(seatsBooked, 10);
  if (isNaN(seats) || seats < 1 || seats > 10) {
    errors.push('Seats booked must be an integer between 1 and 10.');
  }

  return errors;
});

const validateUpdateTripStatus = validate((req) => {
  const errors = [];
  const { status } = req.body;
  if (!status || !['scheduled', 'active', 'completed', 'cancelled'].includes(status)) {
    errors.push('Status must be scheduled, active, completed, or cancelled.');
  }
  return errors;
});

const validateRespondBooking = validate((req) => {
  const errors = [];
  const { action, status } = req.body;
  const validAction = action && ['accept', 'reject'].includes(action);
  const validStatus = status && ['confirmed', 'cancelled'].includes(status);
  if (!validAction && !validStatus) {
    errors.push("Action must be 'accept' or 'reject'.");
  }
  return errors;
});

// 3. AI Features Validations
const validateChatbot = validate((req) => {
  const errors = [];
  const { message } = req.body;
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    errors.push('Message query is required.');
  } else if (message.length > 500) {
    errors.push('Message is too long (maximum 500 characters).');
  }
  return errors;
});

const validatePredictFare = validate((req) => {
  const errors = [];
  const { distance } = req.body;
  const distNum = parseFloat(distance);
  if (distance === undefined || isNaN(distNum) || distNum <= 0 || distNum > 500) {
    errors.push('Distance must be a valid number between 0.1 and 500 kilometers.');
  }
  return errors;
});

const validatePredictDemand = validate((req) => {
  const errors = [];
  const { routeName } = req.body;
  if (routeName && (typeof routeName !== 'string' || routeName.length > 100)) {
    errors.push('Invalid route name.');
  }
  return errors;
});

const validateCheckSpam = validate((req) => {
  const errors = [];
  const { price, startName, endName, availableSeats } = req.body;
  const p = parseFloat(price);
  const s = parseInt(availableSeats, 10);

  if (price === undefined || isNaN(p)) errors.push('Price must be a valid number.');
  if (availableSeats === undefined || isNaN(s)) errors.push('Seat count must be a valid integer.');
  if (!startName || typeof startName !== 'string') errors.push('Start location name is required.');
  if (!endName || typeof endName !== 'string') errors.push('End location name is required.');

  return errors;
});

const validateMultimodalRoute = validate((req) => {
  const errors = [];
  const { origin, destination, preference } = req.body;

  if (!origin || typeof origin !== 'string' || origin.trim().length < 2) {
    errors.push('Origin location is required (at least 2 characters).');
  }

  if (!destination || typeof destination !== 'string' || destination.trim().length < 2) {
    errors.push('Destination location is required (at least 2 characters).');
  }

  if (origin && destination && origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
    errors.push('Origin and destination cannot be identical.');
  }

  if (preference && !['duration', 'cost', 'transfers'].includes(preference)) {
    errors.push('Preference must be one of: duration, cost, transfers.');
  }

  return errors;
});

// 4. Utility Validations
const validateExpense = validate((req) => {
  const errors = [];
  const { amount, category, description } = req.body;

  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0 || amt > 50000) {
    errors.push('Expense amount must be a positive number up to ₹50,000.');
  }

  if (!category || !['carpool', 'bus', 'auto', 'other'].includes(category)) {
    errors.push('Category must be carpool, bus, auto, or other.');
  }

  if (description && (typeof description !== 'string' || description.length > 200)) {
    errors.push('Description cannot exceed 200 characters.');
  }

  return errors;
});

const validateLostFound = validate((req) => {
  const errors = [];
  const { itemDescription, contactDetails, status, reportType } = req.body;

  if (!itemDescription || typeof itemDescription !== 'string' || itemDescription.trim().length < 3) {
    errors.push('Item description is required and must be at least 3 characters.');
  }

  if (!contactDetails || typeof contactDetails !== 'string' || contactDetails.trim().length < 3) {
    errors.push('Contact details are required and must be at least 3 characters.');
  }

  if (status && !['reported', 'found', 'claimed', 'expired'].includes(status)) {
    errors.push('Status must be reported, found, claimed, or expired.');
  }

  if (reportType && !['lost', 'found'].includes(reportType)) {
    errors.push('Report type must be lost or found.');
  }

  return errors;
});

const validateComplaint = validate((req) => {
  const errors = [];
  const { title, description } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    errors.push('Complaint title is required (at least 3 characters).');
  }

  if (!description || typeof description !== 'string' || description.trim().length < 5) {
    errors.push('Complaint description is required (at least 5 characters).');
  }

  return errors;
});

module.exports = {
  validateRegister,
  validateLogin,
  validateCreateTrip,
  validateBookTrip,
  validateUpdateTripStatus,
  validateRespondBooking,
  validateChatbot,
  validatePredictFare,
  validatePredictDemand,
  validateCheckSpam,
  validateMultimodalRoute,
  validateExpense,
  validateLostFound,
  validateComplaint
};
