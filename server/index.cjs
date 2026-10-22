// PharmaChain backend — Express API on port 41837
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { IS_DEV, JSON_LIMIT, CORS_ORIGINS } = require('./config/env.cjs');
const db = require('./db/connection.cjs');
const errorHandler = require('./middleware/errorHandler.cjs');

const authRoutes = require('./routes/auth.cjs');
const prescriptionRoutes = require('./routes/prescriptions.cjs');
const drugsRoutes = require('./routes/drugs.cjs');
const { router: inventoryRouter, seedDemoStock } = require('./routes/inventory.cjs');
const { medicineRepo, REFERENCE_MEDICINES } = require('./services/drugDatabaseService.cjs');
const { bootstrapDemoUsers } = require('./seed/bootstrap.cjs');

const PORT = process.env.PORT || 41837;

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || (IS_DEV && CORS_ORIGINS.length === 0) || CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
}));
app.set('trust proxy', IS_DEV ? false : 1);
app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_LIMIT }));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime(), dbMode: db.getMode() }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/drugs', drugsRoutes);
app.use('/api/inventory', inventoryRouter);

// ---------------------------------------------------------------------------
// Platform / commerce / logistics routers.
//
// These modules already existed and loaded cleanly but were never mounted, so
// every frontend call to /api/platform/*, /api/transport/* and the stock-upload
// endpoints returned 404 and the UI silently fell back to demo data.
// Mounting them makes billing, QR verification, transport tracking, stock
// upload and the admin registries live against the real database.
// ---------------------------------------------------------------------------
const platformRoutes = require('./routes/platform.cjs');
const stockUploadRoutes = require('./routes/stockUpload.cjs');
const transportRoutes = require('./routes/transport.cjs').router;
const procurementRoutes = require('./routes/procurement.cjs');

app.use('/api/platform', platformRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/transport', transportRoutes);
// stockUpload defines /stock/upload, /stock-availability and /purchase, so it
// is mounted at the /api/platform prefix to match the client's call sites.
app.use('/api/platform', stockUploadRoutes);

const { router: shipmentRoutes, verifyRouter, trackRouter } = require('./routes/shipments.cjs');
app.use('/api/shipments', shipmentRoutes);
app.use('/verify', verifyRouter);
app.use('/track', trackRouter);

// ---------- Static frontend ----------
const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/(api|verify|track|ml)\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}
app.use(errorHandler);

// NOTE: only ONE app.listen() is allowed — start() below owns it. Calling it
// here as well crashed the process with EADDRINUSE on the second bind.
async function start() {
  await db.connect();
  try {
    if (IS_DEV) {
      const demoUsersCreated = await bootstrapDemoUsers();
      if (demoUsersCreated > 0) console.log(`Seeded ${demoUsersCreated} demo accounts`);
    }
    // Seed the reference drug database + demo stock lots (idempotent).
    const existing = await medicineRepo.count({});
    if (existing === 0 && Array.isArray(REFERENCE_MEDICINES) && REFERENCE_MEDICINES.length) {
      await medicineRepo.insertMany(REFERENCE_MEDICINES.map((medicine) => ({ ...medicine })));
      console.log(`Seeded reference drug database (${REFERENCE_MEDICINES.length} medicines)`);
    }
    await seedDemoStock();
  } catch (e) {
    console.log(`Seed warning: ${e && e.message ? e.message : 'error'}`);
  }
  app.listen(PORT, () => console.log(`PharmaChain backend listening on http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error(`Startup failed: ${err instanceof Error ? err.message : 'unexpected error'}`);
  process.exitCode = 1;
});
