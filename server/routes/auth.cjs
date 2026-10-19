const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env.cjs');
const { auth } = require('../middleware/auth.cjs');
const validate = require('../middleware/validate.cjs');
const z = require('zod');
const { createRepository } = require('../db/repositories/repositoryFactory.cjs');
const models = require('../db/models/index.cjs');

const router = express.Router();
const userRepository = createRepository({ name: 'users', model: models.User, prefix: 'U' });

const loginSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1)
  })
};

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await userRepository.findOne({ email: email.toLowerCase() });
    
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    const payload = { id: user.id, email: user.email, name: user.name, role: user.role, organization: user.organization };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    
    const userWithoutHash = { ...user };
    delete userWithoutHash.passwordHash;
    
    res.json({ token, user: userWithoutHash });
  } catch (err) {
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

