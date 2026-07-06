const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'psidss_jwt_secret_key_98765';

const authController = {
  // Register new user
  register: async (req, res) => {
    try {
      const { username, password, role } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ where: { username } });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        username,
        password: hashedPassword,
        role: role || 'Viewer'
      });

      res.status(201).json({ message: 'User registered successfully', userId: user.id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error during registration' });
    }
  },

  // User login
  login: async (req, res) => {
    try {
      const { username, password, loginType } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const type = loginType || 'staff';

      if (type === 'party') {
        const { PartyPin } = require('../models');
        const record = await PartyPin.findOne({ where: { party_name: username } });
        if (!record || record.pin !== password) {
          return res.status(401).json({ error: 'Invalid Party Name or PIN' });
        }

        // Generate JWT for Party
        const token = jwt.sign(
          { username: record.party_name, role: 'Party', party_name: record.party_name },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        return res.json({
          token,
          user: {
            username: record.party_name,
            role: 'Party'
          }
        });
      } else if (type === 'vcn') {
        const { VcnPin } = require('../models');
        const record = await VcnPin.findOne({ where: { vcn: username } });
        if (!record || record.pin !== password) {
          return res.status(401).json({ error: 'Invalid VCN Number or PIN' });
        }

        // Generate JWT for VCN
        const token = jwt.sign(
          { username: record.vcn, role: 'VCN', vcn: record.vcn },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        return res.json({
          token,
          user: {
            username: record.vcn,
            role: 'VCN'
          }
        });
      } else {
        const user = await User.findOne({ where: { username } });
        if (!user) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Generate JWT
        const token = jwt.sign(
          { id: user.id, username: user.username, role: user.role },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.json({
          token,
          user: {
            username: user.username,
            role: user.role
          }
        });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error during login' });
    }
  },

  // Seed default users
  seedUsers: async () => {
    try {
      const count = await User.count();
      if (count === 0) {
        console.log('Seeding default users...');
        const users = [
          { username: 'viewer', password: 'viewer123', role: 'Viewer' },
          { username: 'analyst', password: 'analyst123', role: 'Analyst' },
          { username: 'admin', password: 'admin123', role: 'Admin' }
        ];

        for (const u of users) {
          const hashedPassword = await bcrypt.hash(u.password, 10);
          await User.create({
            username: u.username,
            password: hashedPassword,
            role: u.role
          });
        }
        console.log('Default users seeded successfully.');
      }
    } catch (error) {
      console.error('Error seeding users:', error);
    }
  }
};

module.exports = authController;
