const express = require('express');
const crypto = require('crypto');
const z = require('zod');
const { auth, requireRole } = require('../middleware/auth.cjs');
const validate = require('../middleware/validate.cjs');
const { createRepository } = require('../db/repositories/repositoryFactory.cjs');
const models = require('../db/models/index.cjs');

const router = express.Router();
const shipmentRepo = createRepository({ name: 'shipments', model: models.Shipment, prefix: 'SHP' });
const batchRepo = createRepository({ name: 'batches', model: models.Batch, prefix: 'B' });
const userRepo = createRepository({ name: 'users', model: models.User, prefix: 'U' });
const BUYER_ROLES = ['distributor', 'dealer', 'hospital'];
const SHIPMENT_ROLES = ['manufacturer', ...BUYER_ROLES, 'transport', 'admin'];

let seq = 0;
function nextCode() {
  seq += 1;
  return `PC-${Date.now().toString(36).toUpperCase()}-${String(seq).padStart(4, '0')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function canAccess(shipment, user) {
  if (user.role === 'admin') return true;
  const organization = user.organization || '';
  return Boolean(organization && [
    shipment.senderId,
    shipment.receiverId,
    shipment.manufacturer,
  ].includes(organization)) || shipment.transporterId === user.id;
}

function isSender(shipment, user) {
  return user.role === 'admin' || (
    ['manufacturer', 'distributor'].includes(user.role)
    && user.organization === shipment.senderId
  );
}

const dispatchSchema = {
  body: z.object({
    medicineName: z.string().trim().min(2).max(200),
    batchNumber: z.string().trim().min(1).max(60),
    quantity: z.number().int().min(1).max(1_000_000),
    receiverOrg: z.string().trim().min(1).max(120),
    destination: z.string().trim().min(2).max(200),
    route: z.string().trim().min(2).max(500),
    trackingNumber: z.string().trim().min(3).max(80),
  }).strict(),
};

router.get('/receivers', auth, requireRole(['manufacturer', 'distributor', 'admin']), async (req, res, next) => {
  try {
    const { items } = await userRepo.find({ filter: { status: 'active' }, sort: { organization: 1 }, limit: 1000 });
    const seen = new Set();
    const receivers = items
      .filter((user) => BUYER_ROLES.includes(user.role) && user.organization)
      .filter((user) => user.organization !== req.user.organization && !seen.has(user.organization) && seen.add(user.organization))
      .map(({ organization, role, name }) => ({ organization, role, name }));
    res.json({ receivers });
  } catch (err) {
    next(err);
  }
});

router.get('/', auth, requireRole(SHIPMENT_ROLES), async (req, res, next) => {
  try {
    const { items } = await shipmentRepo.find({ sort: { createdAt: -1 }, limit: 1000 });
    res.json(items.filter((shipment) => canAccess(shipment, req.user)));
  } catch (err) {
    next(err);
  }
});

router.post('/dispatch', auth, requireRole(['manufacturer', 'admin']), validate(dispatchSchema), async (req, res, next) => {
  try {
    const { medicineName, batchNumber, quantity, receiverOrg, destination, route, trackingNumber } = req.body;
    const batch = await batchRepo.findOne({ batchNumber });

    if (!batch || (req.user.role !== 'admin' && batch.manufacturerId !== req.user.organization)) {
      return res.status(404).json({ error: 'Released batch not found for your organization.' });
    }
    if (batch.status !== 'released' || (batch.expiryDate && new Date(batch.expiryDate) <= new Date())) {
      return res.status(409).json({ error: 'This batch is not available for dispatch.' });
    }
    if (batch.medicineName.toLowerCase() !== medicineName.toLowerCase()) {
      return res.status(422).json({ error: 'Medicine name does not match the selected batch.' });
    }
    if ((batch.availableQuantity || 0) < quantity) {
      return res.status(409).json({ error: `Only ${batch.availableQuantity || 0} units are available.` });
    }

    const { items: receiverUsers } = await userRepo.find({
      filter: { organization: receiverOrg, status: 'active' },
      limit: 1000,
    });
    const receiver = receiverUsers.find((user) => BUYER_ROLES.includes(user.role));
    if (!receiver) return res.status(422).json({ error: 'Select an active receiving organization.' });

    const originalAvailable = batch.availableQuantity || 0;
    await batchRepo.updateById(batch.id, { availableQuantity: originalAvailable - quantity });

    try {
      const shipment = await shipmentRepo.create({
        code: nextCode(),
        batchId: batch.id,
        senderId: req.user.organization || req.user.name,
        receiverId: receiverOrg,
        destination,
        route: route.split(/[,→]/).map((part) => part.trim()).filter(Boolean),
        quantity,
        drugName: medicineName,
        batch: batchNumber,
        manufacturer: req.user.organization || req.user.name,
        status: 'created',
        trackingNumber,
        checkpoints: [{ at: new Date().toISOString(), by: req.user.name, note: 'Shipment created' }],
        createdAt: new Date().toISOString(),
      });
      return res.status(201).json(shipment);
    } catch (err) {
      await batchRepo.updateById(batch.id, { availableQuantity: originalAvailable });
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// Compatibility endpoint for the older shipment form. Batch ownership and
// available quantity are still enforced; the manufacturer dispatch screen
// should be used when a receiver and delivery details are required.
const legacyCreateSchema = {
  body: z.object({
    drugName: z.string().trim().min(2).max(200),
    batch: z.string().trim().min(1).max(60),
    quantity: z.number().int().min(1).max(1_000_000),
  }).strict(),
};
router.post('/', auth, requireRole(['manufacturer', 'admin']), validate(legacyCreateSchema), async (req, res, next) => {
  try {
    const batch = await batchRepo.findOne({ batchNumber: req.body.batch });
    if (!batch || (req.user.role !== 'admin' && batch.manufacturerId !== req.user.organization)) {
      return res.status(404).json({ error: 'Released batch not found for your organization.' });
    }
    if (batch.status !== 'released' || (batch.availableQuantity || 0) < req.body.quantity) {
      return res.status(409).json({ error: 'Batch is unavailable or has insufficient quantity.' });
    }

    const originalAvailable = batch.availableQuantity || 0;
    await batchRepo.updateById(batch.id, { availableQuantity: originalAvailable - req.body.quantity });

    try {
      const shipment = await shipmentRepo.create({
        code: nextCode(),
        batchId: batch.id,
        senderId: req.user.organization || req.user.name,
        drugName: req.body.drugName,
        batch: req.body.batch,
        quantity: req.body.quantity,
        manufacturer: req.user.organization || req.user.name,
        status: 'created',
        checkpoints: [{ at: new Date().toISOString(), by: req.user.name, note: 'Shipment created' }],
        createdAt: new Date().toISOString(),
      });
      res.status(201).json(shipment);
    } catch (err) {
      await batchRepo.updateById(batch.id, { availableQuantity: originalAvailable });
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

const FLOW = ['created', 'in_transit', 'delivered', 'verified'];
router.post('/:code/advance', auth, requireRole(SHIPMENT_ROLES), async (req, res, next) => {
  try {
    const shipment = await shipmentRepo.findOne({ code: req.params.code });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
    if (!canAccess(shipment, req.user)) return res.status(403).json({ error: 'Forbidden' });

    const index = FLOW.indexOf(shipment.status);
    if (index < 0 || index === FLOW.length - 1) {
      return res.status(400).json({ error: 'Shipment cannot advance from its current status.' });
    }
    const nextStatus = FLOW[index + 1];
    const assignedTransporter = req.user.role === 'transport' && shipment.transporterId === req.user.id;
    const receiver = ['dealer', 'hospital', 'distributor'].includes(req.user.role)
      && req.user.organization === shipment.receiverId;
    const permitted = nextStatus === 'in_transit'
      ? isSender(shipment, req.user) || assignedTransporter
      : receiver || assignedTransporter || req.user.role === 'admin';
    if (!permitted) return res.status(403).json({ error: 'You cannot advance this shipment.' });

    const checkpoints = [...(shipment.checkpoints || []), {
      at: new Date().toISOString(),
      by: req.user.name,
      note: `Status: ${nextStatus.replace('_', ' ')}`,
    }];
    res.json(await shipmentRepo.updateById(shipment.id, { status: nextStatus, checkpoints }));
  } catch (err) {
    next(err);
  }
});

router.post('/:code/cancel', auth, requireRole(['manufacturer', 'admin']), async (req, res, next) => {
  try {
    const shipment = await shipmentRepo.findOne({ code: req.params.code });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
    if (!isSender(shipment, req.user)) return res.status(403).json({ error: 'Forbidden' });
    if (shipment.status !== 'created') return res.status(409).json({ error: 'Only unshipped orders can be cancelled.' });

    if (shipment.batchId) {
      const batch = await batchRepo.findById(shipment.batchId);
      if (batch) {
        await batchRepo.updateById(batch.id, { availableQuantity: (batch.availableQuantity || 0) + shipment.quantity });
      }
    }
    const checkpoints = [...(shipment.checkpoints || []), {
      at: new Date().toISOString(), by: req.user.name, note: 'Shipment cancelled',
    }];
    res.json(await shipmentRepo.updateById(shipment.id, { status: 'cancelled', checkpoints }));
  } catch (err) {
    next(err);
  }
});

const publicShipment = (shipment) => ({
  code: shipment.code,
  drugName: shipment.drugName,
  batch: shipment.batch,
  manufacturer: shipment.manufacturer,
  status: shipment.status,
  destination: shipment.destination,
  checkpoints: (shipment.checkpoints || []).map(({ at, note }) => ({ at, note })),
});

const verifyRouter = express.Router();
verifyRouter.get('/:code', async (req, res, next) => {
  try {
    const shipment = await shipmentRepo.findOne({ code: req.params.code });
    if (!shipment) return res.status(404).json({ error: 'Unknown box code — check the QR or code and try again.' });
    res.json(publicShipment(shipment));
  } catch (err) {
    next(err);
  }
});

const trackRouter = express.Router();
trackRouter.get('/:code', async (req, res, next) => {
  try {
    const shipment = await shipmentRepo.findOne({ code: req.params.code });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
    res.json(publicShipment(shipment));
  } catch (err) {
    next(err);
  }
});

module.exports = { router, verifyRouter, trackRouter, shipmentRepo };
