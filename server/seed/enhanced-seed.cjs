// Seeds demo users + a sample shipment into the in-memory store.
// Data lives for the lifetime of the server process; re-run after restarts.
console.log('Seed: demo users and a sample shipment are seeded automatically on server start.');
console.log('Demo accounts (password: demo123):');
['admin', 'manufacturer', 'distributor', 'transport', 'pharmacy'].forEach(r =>
  console.log(`  ${r}@pharmachain.io`));
