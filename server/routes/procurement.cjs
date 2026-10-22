const express = require('express');
const z = require('zod');
const { auth, requireRole } = require('../middleware/auth.cjs');
const validate = require('../middleware/validate.cjs');
const { createRepository } = require('../db/repositories/repositoryFactory.cjs');
const models = require('../db/models/index.cjs');

const router = express.Router();
const buyerRoles = ['dealer', 'hospital'];
const batchRepo = createRepository({ name: 'batches', model: models.Batch, prefix: 'B' });
const medicineRepo = createRepository({ name: 'medicines', model: models.Medicine, prefix: 'M' });
const orderRepo = createRepository({ name: 'procurement_orders', model: models.ProcurementOrder, prefix: 'PO' });
const inventoryRepo = createRepository({ name: 'inventory_batches', model: models.InventoryBatch, prefix: 'IB' });

function buyerOrganization(user) {
  return user.organization || user.name || '';
}

function isOrderableLot(batch) {
  if ((Number(batch.availableQuantity) || 0) <= 0) return false;
  if (!batch.expiryDate) return true;
  const expiry = new Date(batch.expiryDate);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.toISOString().slice(0, 10) >= new Date().toISOString().slice(0, 10);
}

router.get('/catalog', auth, requireRole(buyerRoles), async (req, res, next) => {
  try {
    const { items: batches } = await batchRepo.find({ filter: { status: 'released' }, limit: 5000 });
    const products = new Map();
    for (const batch of batches) {
      if (!isOrderableLot(batch) || !batch.manufacturerId || !batch.medicineId) continue;
      const quantity = Number(batch.availableQuantity) || 0;
      const key = `${batch.manufacturerId}\u0000${batch.medicineId}`;
      const product = products.get(key) || {
        medicineId: batch.medicineId,
        medicineName: batch.medicineName || batch.medicineId,
        manufacturerId: batch.manufacturerId,
        availableQuantity: 0,
      };
      product.availableQuantity += quantity;
      products.set(key, product);
    }
    const catalog = await Promise.all([...products.values()].map(async (product) => {
      const medicine = await medicineRepo.findOne({ id: product.medicineId });
      return {
        ...product,
        genericName: medicine?.genericName || '',
        strength: medicine?.strength || '',
      };
    }));
    res.json({ products: catalog.sort((a, b) => a.medicineName.localeCompare(b.medicineName)) });
  } catch (err) {
    next(err);
  }
});

router.get('/orders', auth, requireRole([...buyerRoles, 'manufacturer']), async (req, res, next) => {
  try {
    const filter = req.user.role === 'manufacturer'
      ? { manufacturerId: buyerOrganization(req.user) }
      : { buyerId: req.user.id };
    const { items } = await orderRepo.find({ filter, sort: { createdAt: -1 }, limit: 500 });
    res.json({ orders: items });
  } catch (err) {
    next(err);
  }
});

const createOrderSchema = {
  body: z.object({
    medicineId: z.string().trim().min(1).max(100),
    manufacturerId: z.string().trim().min(1).max(200),
    quantity: z.number().int().min(1).max(1000000),
    notes: z.string().trim().max(500).default(''),
  }),
};

router.post('/orders', auth, requireRole(buyerRoles), validate(createOrderSchema), async (req, res, next) => {
  try {
    const organization = buyerOrganization(req.user);
    if (!organization) return res.status(422).json({ error: 'Your account has no organization to place an order.' });

    const { medicineId, manufacturerId, quantity, notes } = req.body;
    const { items: lots } = await batchRepo.find({
      filter: { medicineId, manufacturerId, status: 'released' },
      sort: { expiryDate: 1 },
    });
    const orderableLots = lots.filter(isOrderableLot);
    const available = orderableLots.reduce((total, lot) => total + (Number(lot.availableQuantity) || 0), 0);
    if (!orderableLots.length) return res.status(404).json({ error: 'That manufacturer does not have this medicine in unexpired, released stock.' });
    if (available < quantity) {
      return res.status(409).json({ error: `Only ${available} unit(s) are currently available.`, available });
    }
    const medicine = await medicineRepo.findOne({ id: medicineId });
    const order = await orderRepo.create({
      buyerId: req.user.id,
      buyerName: req.user.name || '',
      buyerRole: req.user.role,
      buyerOrganization: organization,
      manufacturerId,
      medicineId,
      medicineName: orderableLots[0].medicineName || medicine?.name || medicineId,
      quantity,
      notes,
      status: 'pending',
      allocations: [],
    });
    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
});

const actionSchema = {
  body: z.object({
    action: z.enum(['accept', 'reject', 'ship', 'receive', 'cancel']),
    note: z.string().trim().max(500).default(''),
  }),
};

router.patch('/orders/:id', auth, requireRole([...buyerRoles, 'manufacturer']), validate(actionSchema), async (req, res, next) => {
  try {
    const order = await orderRepo.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const isBuyer = order.buyerId === req.user.id;
    const isManufacturer = order.manufacturerId === buyerOrganization(req.user);
    if ((req.user.role === 'manufacturer' && !isManufacturer) ||
        (req.user.role !== 'manufacturer' && !isBuyer)) {
      return res.status(403).json({ error: 'You cannot update this order.' });
    }

    const { action, note } = req.body;
    let patch;
    if (action === 'accept' && isManufacturer && order.status === 'pending') {
      patch = { status: 'accepted', decisionNote: note };
    } else if (action === 'reject' && isManufacturer && order.status === 'pending') {
      patch = { status: 'rejected', decisionNote: note };
    } else if (action === 'cancel' && isBuyer && order.status === 'pending') {
      patch = { status: 'cancelled', decisionNote: note };
    } else if (action === 'ship' && isManufacturer && order.status === 'accepted') {
      const { items: lots } = await batchRepo.find({
        filter: {
          medicineId: order.medicineId,
          manufacturerId: order.manufacturerId,
          status: 'released',
        },
        sort: { expiryDate: 1 },
      });
      const orderableLots = lots.filter(isOrderableLot);
      const available = orderableLots.reduce((total, lot) => total + (Number(lot.availableQuantity) || 0), 0);
      if (available < order.quantity) {
        return res.status(409).json({ error: `Stock changed after acceptance. ${available} unit(s) remain; ${order.quantity} required.` });
      }
      let remaining = order.quantity;
      const allocations = [];
      for (const lot of orderableLots) {
        if (remaining <= 0) break;
        const quantity = Math.min(remaining, Number(lot.availableQuantity) || 0);
        if (!quantity) continue;
        const updated = await batchRepo.updateById(lot.id, { availableQuantity: lot.availableQuantity - quantity });
        if (!updated) return res.status(409).json({ error: 'Stock changed while shipping. Refresh and try again.' });
        allocations.push({
          batchId: lot.id,
          batchNumber: lot.batchNumber,
          expiryDate: lot.expiryDate ? new Date(lot.expiryDate).toISOString().slice(0, 10) : '',
          quantity,
        });
        remaining -= quantity;
      }
      patch = { status: 'shipped', allocations, decisionNote: note };
    } else if (action === 'receive' && isBuyer && order.status === 'shipped') {
      for (const allocation of order.allocations || []) {
        const existing = await inventoryRepo.findOne({
          organizationId: order.buyerOrganization,
          batchNumber: allocation.batchNumber,
        });
        if (existing) {
          await inventoryRepo.updateById(existing.id, {
            availableQuantity: (Number(existing.availableQuantity) || 0) + allocation.quantity,
          });
        } else {
          const sourceBatch = await batchRepo.findOne({ id: allocation.batchId });
          await inventoryRepo.create({
            organizationId: order.buyerOrganization,
            medicineName: order.medicineName,
            genericName: '',
            batchNumber: allocation.batchNumber,
            expiryDate: allocation.expiryDate,
            availableQuantity: allocation.quantity,
            status: sourceBatch?.status === 'released' ? 'released' : 'quarantine',
          });
        }
      }
      patch = { status: 'received', decisionNote: note };
    } else {
      return res.status(409).json({ error: `Action "${action}" is not allowed while this order is ${order.status}.` });
    }

    const updated = await orderRepo.updateById(order.id, patch);
    res.json({ order: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
