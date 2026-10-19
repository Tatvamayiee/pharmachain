// PharmaChain backend — Express API on port 41837
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = require('./db/connection.cjs');
const errorHandler = require('./middleware/errorHandler.cjs');

const authRoutes = require('./routes/auth.cjs');
const prescriptionRoutes = require('./routes/prescriptions.cjs');
const drugsRoutes = require('./routes/drugs.cjs');
const { seedDemoStock } = require('./routes/inventory.cjs');
const { medicineRepo, REFERENCE_MEDICINES } = require('./services/drugDatabaseService.cjs');

const PORT = process.env.PORT || 41837;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '15mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '15mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

// ---------- In-memory store (seeded) ----------
const users = [
  { id: 'u1', email: 'admin@pharmachain.io', name: 'Admin', role: 'admin', password: 'demo123' },
  { id: 'u2', email: 'manufacturer@pharmachain.io', name: 'Acme Pharma', role: 'manufacturer', password: 'demo123' },
  { id: 'u3', email: 'distributor@pharmachain.io', name: 'MediDist', role: 'distributor', password: 'demo123' },
  { id: 'u4', email: 'transport@pharmachain.io', name: 'FleetGo', role: 'transport', password: 'demo123' },
  { id: 'u5', email: 'pharmacy@pharmachain.io', name: 'City Pharmacy', role: 'pharmacy', password: 'demo123' },
].map(u => ({ ...u, passwordHash: bcrypt.hashSync(u.password, 10) }));
// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime(), dbMode: db.getMode() }));

const shipments = [];
let seq = 0;
function nextCode() { return `PC-${String(++seq).padStart(4, '0')}`; }
// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/drugs', drugsRoutes);

function seed() {
  const s = { id: 's1', code: nextCode(), drugName: 'Paracetamol 500mg', batch: 'B-2024-001', quantity: 500, manufacturer: 'Acme Pharma', status: 'in_transit', checkpoints: [{ at: new Date().toISOString(), by: 'Acme Pharma', note: 'Shipment created' }, { at: new Date().toISOString(), by: 'FleetGo', note: 'Picked up for transport' }], createdAt: new Date().toISOString() };
  shipments.push(s);
}
seed();
const { router: shipmentRoutes, verifyRouter, trackRouter } = require('./routes/shipments.cjs');
app.use('/api/shipments', shipmentRoutes);
app.use('/verify', verifyRouter);
app.use('/track', trackRouter);

// ---------- Auth ----------
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
// Compatibility endpoints (Wait, the instructions say "Add a development-only compatibility endpoint for the existing demo accounts" -> I used authRoutes for this which seeds the DB, or uses in-memory. So authRoutes is fine.)

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = users.find(u => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});
// Error handler
app.use(errorHandler);

app.get('/api/auth/me', auth, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

// ---------- Shipments ----------
app.get('/api/shipments', auth, (req, res) => {
  res.json(shipments);
});

app.post('/api/shipments', auth, (req, res) => {
  const { drugName, batch, quantity } = req.body || {};
  if (!drugName || !batch) return res.status(400).json({ error: 'drugName and batch are required' });
  const s = {
    id: `s${Date.now()}`,
    code: nextCode(),
    drugName: String(drugName),
    batch: String(batch),
    quantity: Number(quantity) || 1,
    manufacturer: req.user.name,
    status: 'created',
    checkpoints: [{ at: new Date().toISOString(), by: req.user.name, note: 'Shipment created' }],
    createdAt: new Date().toISOString(),
  };
  shipments.unshift(s);
  res.status(201).json(s);
});

const FLOW = ['created', 'in_transit', 'delivered', 'verified'];

app.post('/api/shipments/:code/advance', auth, (req, res) => {
  const s = shipments.find(x => x.code === req.params.code);
  if (!s) return res.status(404).json({ error: 'Shipment not found' });
  const idx = FLOW.indexOf(s.status);
  if (idx === FLOW.length - 1) return res.status(400).json({ error: 'Shipment already verified' });
  s.status = FLOW[idx + 1];
  s.checkpoints.push({ at: new Date().toISOString(), by: req.user.name, note: `Status → ${s.status.replace('_', ' ')}` });
  res.json(s);
});

// ---------- Public verify/track (proxied by Vite) ----------
app.get('/verify/:code', (req, res) => {
  const s = shipments.find(x => x.code.toLowerCase() === req.params.code.toLowerCase());
  if (!s) return res.status(404).json({ error: 'Unknown box code — check the QR or code and try again.' });
  res.json(s);
});

app.get('/track/:code', (req, res) => {
  const s = shipments.find(x => x.code.toLowerCase() === req.params.code.toLowerCase());
  if (!s) return res.status(404).json({ error: 'Shipment not found' });
  res.json(s);
});

app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// ---------- Static frontend ----------
const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/(api|verify|track)\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// NOTE: only ONE app.listen() is allowed — start() below owns it. Calling it
// here as well crashed the process with EADDRINUSE on the second bind.
async function start() {
  await db.connect();
  try {
    // Seed the reference drug database + demo stock lots (idempotent).
    const existing = await medicineRepo.count({});
    if (existing === 0 && Array.isArray(REFERENCE_MEDICINES) && REFERENCE_MEDICINES.length) {
      await medicineRepo.insertMany(REFERENCE_MEDICINES.map((m) => ({ ...m })));
      console.log(`Seeded reference drug database (${REFERENCE_MEDICINES.length} medicines)`);
    }
    await seedDemoStock();
  } catch (e) {
    console.log(`Seed warning: ${e && e.message ? e.message : 'error'}`);
  }
  app.listen(PORT, () => console.log(`PharmaChain backend listening on http://localhost:${PORT}`));
}

start();
