const express = require('express');
const { auth } = require('../middleware/auth.cjs');
const { createRepository } = require('../db/repositories/repositoryFactory.cjs');
const models = require('../db/models/index.cjs');

const router = express.Router();
const shipmentRepo = createRepository({ name: 'shipments', model: models.Shipment, prefix: 'SHP' });

let seq = 0;
function nextCode() { return `PC-${String(++seq).padStart(4, '0')}`; }

router.get('/', auth, async (req, res, next) => {
  try {
    const { items } = await shipmentRepo.find({ sort: { createdAt: -1 } });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.post('/', auth, async (req, res, next) => {
  try {
    const { drugName, batch, quantity } = req.body || {};
    if (!drugName || !batch) return res.status(400).json({ error: 'drugName and batch are required' });
    
    const s = await shipmentRepo.create({
      code: nextCode(),
      drugName: String(drugName),
      batch: String(batch),
      quantity: Number(quantity) || 1,
      manufacturer: req.user.name,
      status: 'created',
      checkpoints: [{ at: new Date().toISOString(), by: req.user.name, note: 'Shipment created' }],
      createdAt: new Date().toISOString()
    });
    res.status(201).json(s);
  } catch (err) {
    next(err);
  }
});

const FLOW = ['created', 'in_transit', 'delivered', 'verified'];

router.post('/:code/advance', auth, async (req, res, next) => {
  try {
    const s = await shipmentRepo.findOne({ code: req.params.code });
    if (!s) return res.status(404).json({ error: 'Shipment not found' });
    
    const idx = FLOW.indexOf(s.status);
    if (idx === FLOW.length - 1) return res.status(400).json({ error: 'Shipment already verified' });
    
    const newStatus = FLOW[idx + 1];
    const checkpoints = s.checkpoints || [];
    checkpoints.push({ at: new Date().toISOString(), by: req.user.name, note: `Status → ${newStatus.replace('_', ' ')}` });
    
    const updated = await shipmentRepo.updateById(s.id, { status: newStatus, checkpoints });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Proxy routes for verification (mounted at root in index.cjs)
const verifyRouter = express.Router();
verifyRouter.get('/:code', async (req, res, next) => {
  try {
    const s = await shipmentRepo.findOne({ code: req.params.code }); // Note: case sensitive in DB
    if (!s) return res.status(404).json({ error: 'Unknown box code — check the QR or code and try again.' });
    res.json(s);
  } catch (err) {
    next(err);
  }
});

const trackRouter = express.Router();
trackRouter.get('/:code', async (req, res, next) => {
  try {
    const s = await shipmentRepo.findOne({ code: req.params.code });
    if (!s) return res.status(404).json({ error: 'Shipment not found' });
    res.json(s);
  } catch (err) {
    next(err);
  }
});

module.exports = { router, verifyRouter, trackRouter, shipmentRepo };

