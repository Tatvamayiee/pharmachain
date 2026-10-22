const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env.cjs');
const { auth } = require('../middleware/auth.cjs');
const validate = require('../middleware/validate.cjs');
const z = require('zod');
const { createRepository } = require('../db/repositories/repositoryFactory.cjs');
const models = require('../db/models/index.cjs');

const router = express.Router();
const userRepository = createRepository({ name: 'users', model: models.User, prefix: 'U' });
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' },
});

const loginSchema = {
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(1).max(72)
  })
};

const registerSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email(),
    password: z.string().min(12).max(72),
    role: z.literal('customer'),
  })
};

router.post('/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await userRepository.findOne({ email: email.toLowerCase() });
    
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    const payload = { id: user.id, email: user.email, name: user.name, role: user.role, organization: user.organization };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' });
    
    const userWithoutHash = { ...user };
    delete userWithoutHash.passwordHash;
    
    res.json({ token, user: userWithoutHash });
  } catch (err) {
    next(err);
  }
});

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email.toLowerCase();
    const existing = await userRepository.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const user = await userRepository.create({
      name,
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'customer',
      organization: '',
      status: 'active',
    });
    const payload = { id: user.id, email: user.email, name: user.name, role: user.role, organization: user.organization };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' });
    const userWithoutHash = { ...user };
    delete userWithoutHash.passwordHash;

    res.status(201).json({ token, user: userWithoutHash });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    next(err);
  }
});

router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await userRepository.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const userWithoutHash = { ...user };
    delete userWithoutHash.passwordHash;
    res.json({ user: userWithoutHash });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
