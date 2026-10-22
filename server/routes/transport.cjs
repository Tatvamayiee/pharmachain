// Transport-QR (QR 2) — medicine transport + location tracking.
// STRICTLY SEPARATE from the authentication QR (QR 1):
//   QR 1 answers "is this medicine record valid?"  → /api/platform/verify/:code
//   QR 2 answers "where is this shipment now?"     → this file
// Identification is via an opaque random transportQrId (never the batch
// number), the payload is only an ID + URL, and every mutation requires a
// JWT plus a server-side role-permission check.
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const z = require('zod');
const { JWT_SECRET } = require('../config/env.cjs');
const { auth, requireRole } = require('../middleware/auth.cjs');
const validate = require('../middleware/validate.cjs');
const { createRepository } = require('../db/repositories/repositoryFactory.cjs');
const models = require('../db/models/index.cjs');

const router = express.Router();
const shipmentRepo = createRepository({ name: 'shipments', model: models.Shipment, prefix: 'SHP' });
const eventRepo = createRepository({ name: 'transportEvents', model: models.TransportEvent, prefix: 'TE' });
const userRepo = createRepository({ name: 'users', model: models.User, prefix: 'U' });

// Optional auth: identify the caller if a valid Bearer token is present, but
// never reject — public scan/history reads stay open (minimal, safe fields).
async function optionalAuth(req, _res, next) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    let payload;
    try {
      payload = jwt.verify(h.slice(7), JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      return next();
    }
    if (!payload || typeof payload.id !== 'string' || !payload.id) return next();
    try {
      const user = await userRepo.findById(payload.id);
      if (user?.status === 'active') {
        req.user = {
          id: user.id,
          name: user.name,
          role: user.role,
          organization: user.organization || '',
        };
      }
    } catch (err) {
      return next(err);
    }
  }
  return next();
}
router.use(optionalAuth);

function canAccess(shipment, user) {
  if (user.role === 'admin') return true;
  const organization = user.organization || '';
  return Boolean(organization && [shipment.senderId, shipment.receiverId, shipment.manufacturer].includes(organization))
    || shipment.transporterId === user.id;
}

function isSender(shipment, user) {
  return user.role === 'admin' || (
    ['manufacturer', 'distributor'].includes(user.role)
    && user.organization === shipment.senderId
  );
}

// Who may update location/status for a transport QR scan. Server-side RBAC —
// the UI mirrors this but never trusts it. Customer/admin deliberately cannot
// move shipments; customer gets read-only tracking.
const CAN_UPDATE = new Set(['transport', 'distributor', 'manufacturer', 'dealer', 'hospital', 'pharmacy', 'admin']);
// Roles allowed to list shipments / read full tracking dashboards.
const CAN_VIEW = new Set(['transport', 'distributor', 'manufacturer', 'dealer', 'hospital', 'pharmacy', 'admin', 'customer']);

const STATUS_FLOW = [
  'PREPARED', 'PICKED_UP', 'IN_TRANSIT', 'AT_DISTRIBUTION_CENTER',
  'OUT_FOR_DELIVERY', 'AT_PHARMACY', 'DELIVERED',
];

function nowIso() { return new Date().toISOString(); }

async function shipmentSummary(s) {
  return {
    shipmentId: s.code,
    id: s.id,
    transportQrId: s.transportQrId,
    medicine: s.drugName,
    batchNumber: s.batch,
    quantity: s.quantity || 1,
    manufacturer: s.manufacturer,
    receiverId: s.receiverId || '',
    destination: s.destination || '',
    currentLocation: s.currentLocation || '',
    currentStatus: String(s.status || 'created').toUpperCase() === 'CREATED' ? 'PREPARED' : String(s.status || '').toUpperCase(),
    lastUpdated: (await latestEventAt(s.id)) || s.createdAt || nowIso(),
    delivered: String(s.status).toLowerCase() === 'delivered',
  };
}

async function latestEventAt(shipmentId) {
  const { items } = await eventRepo.find({ filter: { shipmentId }, sort: { timestamp: -1 }, limit: 1 });
  return items[0]?.timestamp || '';
}

/** POST /api/transport/qr — generate (or return) the transport QR for a shipment. */
router.post('/qr', auth, requireRole('manufacturer', 'admin', 'distributor'), async (req, res, next) => {
  try {
    const { shipmentCode } = req.body || {};
    if (!shipmentCode) return res.status(400).json({ error: 'shipmentCode is required' });
    const s = await shipmentRepo.findOne({ code: String(shipmentCode) });
    if (!s) return res.status(404).json({ error: 'Shipment not found' });
    if (!isSender(s, req.user)) return res.status(403).json({ error: 'Forbidden' });

    if (!s.transportQrId) {
      const id = `TRQ-${crypto.randomBytes(9).toString('base64url')}`;
      const updated = await shipmentRepo.updateById(s.id, { transportQrId: id });
      return res.json({
        transportQrId: id,
        payload: `https://pharmachain.app/transport/${id}`,
        shipment: await shipmentSummary(updated),
      });
    }
    return res.json({
      transportQrId: s.transportQrId,
      payload: `https://pharmachain.app/transport/${s.transportQrId}`,
      shipment: await shipmentSummary(s),
    });
  } catch (err) { next(err); }
});

router.post('/assign', auth, requireRole(['manufacturer', 'distributor', 'admin']), validate({
  body: z.object({
    shipmentCode: z.string().trim().min(1).max(80),
    transporterId: z.string().trim().min(1).max(100),
  }).strict(),
}), async (req, res, next) => {
  try {
    const shipment = await shipmentRepo.findOne({ code: req.body.shipmentCode });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
    if (!isSender(shipment, req.user)) return res.status(403).json({ error: 'Forbidden' });
    const transporter = await userRepo.findById(req.body.transporterId);
    if (!transporter || transporter.status !== 'active' || transporter.role !== 'transport') {
      return res.status(422).json({ error: 'Select an active transporter account.' });
    }
    const updated = await shipmentRepo.updateById(shipment.id, { transporterId: transporter.id });
    res.json({ shipment: await shipmentSummary(updated) });
  } catch (err) { next(err); }
});

/** GET /api/transport/resolve/:qrId — public: resolve a scanned transport QR. */
router.get('/resolve/:qrId', async (req, res, next) => {
  try {
    const s = await shipmentRepo.findOne({ transportQrId: req.params.qrId });
    if (!s) return res.status(404).json({ error: 'Unknown transport QR code' });
    res.json(await shipmentSummary(s));
  } catch (err) { next(err); }
});

/**
 * POST /api/transport/scan — authenticated scan by transporter/distributor:
 * updates current location + status and appends a tracking event.
 * Body: { transportQrId, location, status?, note? }
 */
router.post('/scan', auth, async (req, res, next) => {
  try {
    const { transportQrId, location, status, note } = req.body || {};
    if (!transportQrId) return res.status(400).json({ error: 'transportQrId is required' });
    if (!location || !String(location).trim()) return res.status(400).json({ error: 'location is required' });

    if (!CAN_UPDATE.has(req.user.role)) {
      return res.status(403).json({ error: 'Your role is not authorized to update transport locations.' });
    }

    const s = await shipmentRepo.findOne({ transportQrId: String(transportQrId) });
    if (!s) return res.status(404).json({ error: 'Unknown transport QR code' });
    if (!canAccess(s, req.user)) return res.status(403).json({ error: 'You are not assigned to this shipment.' });

    if (String(s.status).toLowerCase() === 'delivered') {
      return res.status(409).json({ error: 'Shipment already delivered — timeline is closed.' });
    }

    // Status is optional; default keeps the current one. Validate against flow.
    const nextStatus = status
      ? String(status).toUpperCase()
      : (String(s.status).toUpperCase() === 'CREATED' ? 'PICKED_UP' : String(s.status).toUpperCase());
    if (!STATUS_FLOW.includes(nextStatus)) {
      return res.status(422).json({ error: `Invalid status "${nextStatus}". Allowed: ${STATUS_FLOW.join(', ')}` });
    }
    const currentIndex = STATUS_FLOW.indexOf(mapLegacy(s.status));
    const nextIndex = STATUS_FLOW.indexOf(nextStatus);
    if (nextIndex < currentIndex) {
      return res.status(409).json({ error: `Cannot move backwards: shipment is already ${mapLegacy(s.status)}.` });
    }
    if (req.user.role === 'transport' && s.transporterId !== req.user.id) {
      return res.status(403).json({ error: 'Shipment is not assigned to your transporter account.' });
    }
    if (['manufacturer', 'distributor'].includes(req.user.role) && (!isSender(s, req.user) || nextIndex > currentIndex + 1)) {
      return res.status(403).json({ error: 'Sender accounts may only advance their shipment one checkpoint at a time.' });
    }
    if (['dealer', 'hospital', 'pharmacy'].includes(req.user.role)
      && (req.user.organization !== s.receiverId || nextStatus !== 'DELIVERED')) {
      return res.status(403).json({ error: 'Receiving organizations may only confirm delivery of their own shipments.' });
    }
    if (nextIndex > currentIndex + 1) {
      return res.status(409).json({ error: 'Shipment checkpoints must be completed in order.' });
    }

    const event = await eventRepo.create({
      shipmentId: s.id,
      shipmentCode: s.code,
      transportQrId: s.transportQrId,
      location: String(location).trim(),
      status: nextStatus,
      timestamp: nowIso(),
      updatedBy: req.user.name,
      updatedById: req.user.id,
      organization: req.user.organization || req.user.name,
      role: req.user.role,
      note: String(note || '').slice(0, 300),
    });

    await shipmentRepo.updateById(s.id, {
      status: nextStatus.toLowerCase(),
      currentLocation: event.location,
    });

    const fresh = await shipmentRepo.findOne({ id: s.id });
    res.json({ event, shipment: await shipmentSummary(fresh) });
  } catch (err) { next(err); }
});

function mapLegacy(s) {
  const u = String(s || '').toUpperCase();
  if (u === 'CREATED') return 'PREPARED';
  if (u === 'IN_TRANSIT') return 'IN_TRANSIT';
  if (u === 'DELIVERED') return 'DELIVERED';
  if (u === 'VERIFIED') return 'DELIVERED';
  return u || 'PREPARED';
}

/**
 * GET /api/transport/history/:qrId — full tracking timeline (public: supply-chain
 * roles get full events; anonymous gets the public summary timeline).
 */
router.get('/history/:qrId', async (req, res, next) => {
  try {
    const s = await shipmentRepo.findOne({ transportQrId: req.params.qrId });
    if (!s) return res.status(404).json({ error: 'Unknown transport QR code' });

    const { items } = await eventRepo.find({ filter: { shipmentId: s.id }, sort: { timestamp: 1 }, limit: 500 });
    const summary = await shipmentSummary(s);

    // Anonymous / customer: summary + public timeline, no internal actor IDs.
    if (!req.user || !CAN_VIEW.has(req.user.role) || !canAccess(s, req.user)) {
      return res.json({
        shipment: summary,
        timeline: items.map((e) => ({ location: e.location, status: e.status, timestamp: e.timestamp, note: e.note })),
        fullAccess: false,
      });
    }

    res.json({
      shipment: summary,
      timeline: items.map((e) => ({
        location: e.location, status: e.status, timestamp: e.timestamp, note: e.note,
        updatedBy: e.updatedBy, organization: e.organization, role: e.role,
      })),
      fullAccess: true,
    });
  } catch (err) { next(err); }
});

/** GET /api/transport/shipments — supply-chain roles list shipments with transport QRs. */
router.get('/shipments', auth, async (req, res, next) => {
  try {
    if (!CAN_VIEW.has(req.user.role)) {
      return res.status(403).json({ error: 'Your role cannot view transport tracking.' });
    }
    const { items } = await shipmentRepo.find({ sort: { createdAt: -1 }, limit: 500 });
    // Include shipments without a transport QR too — the manufacturer needs
    // them listed so they can generate one. Only cancelled boxes are hidden.
    const visible = items.filter((s) => String(s.status).toUpperCase() !== 'CANCELLED' && canAccess(s, req.user));
    res.json({ shipments: await Promise.all(visible.map(async (s) => ({ ...(await shipmentSummary(s)), hasTransportQr: Boolean(s.transportQrId) }))) });
  } catch (err) { next(err); }
});

module.exports = { router, STATUS_FLOW, CAN_UPDATE };
