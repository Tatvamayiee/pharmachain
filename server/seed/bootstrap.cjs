// Server-start bootstrap: ensures the six demo accounts exist in whichever
// store is active (in-memory or MongoDB). Idempotent — existing rows are
// never overwritten. Only the demo credentials documented on the Login page
// are seeded; nothing else is auto-created.
const bcrypt = require('bcryptjs');
const models = require('../db/models/index.cjs');
const { createRepository } = require('../db/repositories/repositoryFactory.cjs');
const { DEMO_USERS } = require('./demoUsers.cjs');

async function bootstrapDemoUsers() {
  const userRepo = createRepository({ name: 'users', model: models.User, prefix: 'U' });
  let created = 0;
  for (const u of DEMO_USERS) {
    const existing = await userRepo.findOne({ email: u.email });
    if (!existing) {
      await userRepo.create({
        ...u,
        passwordHash: bcrypt.hashSync(u.id.replace('demo-', '') + '123', 10),
        status: 'active',
      });
      created += 1;
    }
  }
  return created;
}

module.exports = { bootstrapDemoUsers };
