const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const db = require('../db/connection.cjs');
const { bootstrapDemoUsers } = require('./bootstrap.cjs');

async function runSeed() {
  await db.connect();

  const created = await bootstrapDemoUsers();
  console.log(`Demo user seeding complete (${created} created, existing users unchanged).`);
  process.exit(0);
}

runSeed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
