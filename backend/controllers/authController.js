const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dbService = require('../data/dbService');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing in production!');
    }
    return 'jammumove_dev_jwt_secret_key_secure_2026_phase1';
  }
  return secret;
};

const authController = {
  async register(req, res, next) {
    try {
      const { name, email, password, role, phone, vehicleModel, plateNumber, capacity, vehicleType, licenseNumber } = req.body;

      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanName = (name || '').trim();

      // Check if user already exists
      const existingUser = await dbService.findOne('users', { email: cleanEmail });
      if (existingUser) {
        return res.status(400).json({ message: 'A user with this email address is already registered.' });
      }

      // Restrict public registration to passenger or driver
      const targetRole = role === 'driver' ? 'driver' : 'passenger';

      // Hash password securely with salt rounds = 10
      const hashedPassword = bcrypt.hashSync(password, 10);

      // Create User
      const user = await dbService.create('users', {
        name: cleanName,
        email: cleanEmail,
        password: hashedPassword,
        role: targetRole,
        phone: (phone || '').trim(),
        profilePic: ''
      });

      // If registered as driver, create Vehicle and Driver records
      if (targetRole === 'driver') {
        const vehicle = await dbService.create('vehicles', {
          driverId: user._id,
          model: (vehicleModel || 'Standard Vehicle').trim(),
          plateNumber: (plateNumber || 'JK02-XXXX').trim().toUpperCase(),
          capacity: parseInt(capacity, 10) || 4,
          type: vehicleType || 'car'
        });

        await dbService.create('drivers', {
          userId: user._id,
          licenseNumber: (licenseNumber || 'JK02-PENDING').trim().toUpperCase(),
          rating: 5.0,
          vehicleId: vehicle._id,
          isApproved: false // Explicitly requires admin verification
        });
      }

      // Generate JWT Token
      const token = jwt.sign(
        { userId: user._id.toString(), email: user.email, role: user.role },
        getJwtSecret(),
        { expiresIn: '24h' }
      );

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const cleanEmail = (email || '').trim().toLowerCase();

      const user = await dbService.findOne('users', { email: cleanEmail });
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      const isPasswordValid = bcrypt.compareSync(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      // Generate token
      const token = jwt.sign(
        { userId: user._id.toString(), email: user.email, role: user.role },
        getJwtSecret(),
        { expiresIn: '24h' }
      );

      res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          profilePic: user.profilePic || ''
        }
      });
    } catch (err) {
      next(err);
    }
  },

  // Auth Middleware
  verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access Denied. Authentication token missing.' });
    }

    try {
      const decoded = jwt.verify(token, getJwtSecret());
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(403).json({ message: 'Invalid or expired authentication session.' });
    }
  },

  async getCurrentUser(req, res, next) {
    try {
      const user = await dbService.findById('users', req.user.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }
      
      const { password, ...userWithoutPassword } = user;
      
      let driverDetails = null;
      let vehicleDetails = null;
      if (user.role === 'driver') {
        driverDetails = await dbService.findOne('drivers', { userId: user._id });
        vehicleDetails = await dbService.findOne('vehicles', { driverId: user._id });
      }

      res.status(200).json({
        user: userWithoutPassword,
        driverDetails,
        vehicleDetails
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = authController;
