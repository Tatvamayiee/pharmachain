const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const bcrypt = require('bcryptjs');
const db = require('../db/connection.cjs');
const models = require('../db/models/index.cjs');
const { createRepository } = require('../db/repositories/repositoryFactory.cjs');

async function runSeed() {
  await db.connect();

  const userRepo = createRepository({ name: 'users', model: models.User, prefix: 'U' });

  console.log('Seeding demo users...');
  
  const usersToSeed = [
    { id: 'u1', email: 'admin@pharmachain.io', name: 'Admin', role: 'admin', organization: 'PharmaChain Global' },
    { id: 'u2', email: 'manufacturer@pharmachain.io', name: 'Acme Pharma', role: 'manufacturer', organization: 'Acme Pharma' },
    { id: 'u3', email: 'distributor@pharmachain.io', name: 'MediDist', role: 'distributor', organization: 'MediDist' },
    { id: 'u4', email: 'dealer@pharmachain.io', name: 'City Dealer', role: 'dealer', organization: 'City Dealer' },
    { id: 'u5', email: 'hospital@pharmachain.io', name: 'General Hospital', role: 'hospital', organization: 'General Hospital' },
    { id: 'u6', email: 'transport@pharmachain.io', name: 'FleetGo', role: 'transport', organization: 'FleetGo' },
  ];

  for (const u of usersToSeed) {
    const existing = await userRepo.findOne({ email: u.email });
    if (!existing) {
      await userRepo.create({
        ...u,
        passwordHash: bcrypt.hashSync('demo123', 10),
        status: 'active'
      });
      console.log(`Created user ${u.email}`);
    } else {
      console.log(`User ${u.email} already exists.`);
    }
  }

  console.log('Seeding complete.');
  process.exit(0);
}

runSeed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

