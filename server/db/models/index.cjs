// Mongoose schemas — shared shape for both MongoDB and in-memory modes.
const mongoose = require('mongoose');

const { Schema } = mongoose;

const base = { timestamps: true, versionKey: false, minimize: false };

const UserSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['manufacturer', 'distributor', 'dealer', 'hospital', 'customer', 'admin', 'transport', 'pharmacy'], required: true },
  organization: { type: String, default: '' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
}, base);

const MedicineSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  genericName: { type: String, default: '' },
  category: { type: String, default: '' },
  dosageForm: { type: String, default: '' },
  strength: { type: String, default: '' },
  manufacturerId: { type: String, default: '' },
  status: { type: String, enum: ['active', 'recalled', 'inactive'], default: 'active' },
}, base);

const BatchSchema = new Schema({
  id: { type: String, required: true, unique: true },
  medicineId: { type: String, required: true },
  manufacturerId: { type: String, required: true },
  batchNumber: { type: String, required: true, unique: true },
  // Denormalized display name so lists never need a catalog join.
  medicineName: { type: String, default: '' },
  manufacturingDate: { type: Date },
  expiryDate: { type: Date },
  quantityProduced: { type: Number, default: 0 },
  availableQuantity: { type: Number, default: 0 },
  status: { type: String, enum: ['in_production', 'released', 'quarantine', 'expired', 'recalled'], default: 'released' },
  // Populated when a batch is recalled (shown to every org holding it).
  recallReason: { type: String, default: '' },
  // Criticality captured at recall time (drives UI triage on recall pages).
  recallSeverity: { type: String, enum: ['low', 'medium', 'high', 'critical', ''], default: '' },
}, base);

const ShipmentSchema = new Schema({
  id: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  batchId: { type: String, default: '' },
  senderId: { type: String, default: '' },
  receiverId: { type: String, default: '' },
  transporterId: { type: String, default: '' },
  destination: { type: String, default: '' },
  route: { type: [String], default: [] },
  quantity: { type: Number, default: 1 },
  drugName: { type: String, default: '' },
  batch: { type: String, default: '' },
  manufacturer: { type: String, default: '' },
  status: {
    type: String,
    enum: ['created', 'prepared', 'packed', 'picked_up', 'dispatched', 'in_transit', 'at_distribution_center',
      'out_for_delivery', 'at_pharmacy', 'delivered', 'verified', 'cancelled'],
    default: 'created',
  },
  trackingNumber: { type: String, default: '' },
  checkpoints: [{
    at: String, by: String, note: String,
  }],
  // --- Transport-QR (QR 2) fields — separate from authentication QR ---
  // Opaque, unguessable token embedded in the transport QR payload. Never
  // reuse it across shipments; random at dispatch so codes can't be guessed.
  transportQrId: { type: String, default: '', index: true },
  // Denormalized "where is it now" mirror for list views; the append-only
  // truth lives in the TransportEvent collection below.
  currentLocation: { type: String, default: '' },
}, { ...base, timestamps: false });

// Append-only transport-tracking events (QR 2). One row per scan/update —
// history is never overwritten, only appended, so the full journey stays
// auditable. Keeps who/where/when/what for each hand-off.
const TransportEventSchema = new Schema({
  id: { type: String, required: true, unique: true },
  shipmentId: { type: String, required: true, index: true },
  shipmentCode: { type: String, default: '' },
  transportQrId: { type: String, default: '' },
  location: { type: String, required: true },
  status: { type: String, required: true },
  timestamp: { type: String, required: true },
  updatedBy: { type: String, default: '' },
  updatedById: { type: String, default: '' },
  organization: { type: String, default: '' },
  role: { type: String, default: '' },
  note: { type: String, default: '' },
}, base);

const ReviewChecklistSchema = new Schema({
  originalReviewed: Boolean, namesVerified: Boolean, strengthsVerified: Boolean,
  dosagesReviewed: Boolean, frequencyReviewed: Boolean, durationReviewed: Boolean,
  allergiesReviewed: Boolean, interactionsReviewed: Boolean, dosageAlertsReviewed: Boolean,
  decisionConfirmed: Boolean,
}, { _id: false });

const PrescriptionSchema = new Schema({
  id: { type: String, required: true, unique: true },
  prescriptionId: { type: String, required: true, unique: true },
  organizationId: { type: String, required: true },
  uploadedBy: { type: String, required: true },
  createdByRole: { type: String, enum: ['manufacturer', 'distributor', 'dealer', 'hospital', 'customer', 'admin', 'transport', 'pharmacy', ''], default: '' },
  patientReference: { type: String, required: true },
  patientAge: { type: Number, min: 0, max: 130 },
  patientGender: { type: String, enum: ['female', 'male', 'other', ''] },
  allergies: { type: String, default: '' },
  existingConditions: { type: String, default: '' },
  currentMedicines: { type: String, default: '' },
  prescriptionDate: { type: String, required: true },
  prescriberName: { type: String, default: '' },
  department: { type: String, default: '' },
  status: {
    type: String,
    enum: ['uploaded', 'processing', 'needs_correction', 'analyzed', 'safety_review_required',
      'clarification_requested', 'approved', 'rejected', 'dispensed', 'cancelled'],
    default: 'uploaded',
  },
  extractedText: { type: String, default: '' },
  // Structured AI extraction (Hugging Face VLM) + provenance metadata.
  aiExtraction: { type: Schema.Types.Mixed, default: null },
  analysisModel: { type: String, default: '' },
  analysisConfidence: { type: Number, min: 0, max: 1, default: null },
  analysisFailed: { type: Boolean, default: false },
  medicines: { type: [Schema.Types.Mixed], default: [] },
  interactionAlerts: { type: [Schema.Types.Mixed], default: [] },
  dosageAlerts: { type: [Schema.Types.Mixed], default: [] },
  analysisProvider: { type: String, default: 'mock' },
  // Multi-AI re-analysis: the FIRST analysis stays in medicines/aiExtraction;
  // every re-analysis is appended here with its own provider/model/confidence.
  analysisHistory: { type: [Schema.Types.Mixed], default: [] },
  // Snapshot of the latest parallel OCR+AI run: { features, fieldComparison,
  // providers, startedAt } — the training-capture source for the Random
  // Forest layer (features only; never the image).
  parallelAnalysis: { type: Schema.Types.Mixed, default: null },
  lastReanalysisProvider: { type: String, default: null },
  lastReanalysisAt: { type: String, default: null },
  requiresHumanReview: { type: Boolean, default: true },
  reviewChecklist: { type: ReviewChecklistSchema, default: null },
  pharmacistReviewer: { type: String, default: '' },
  reviewNotes: { type: String, default: '' },
  // Encrypted-upload metadata (never the file bytes) + dispensing record.
  fileMetadata: { type: Schema.Types.Mixed, default: null },
  dispensingRecord: { type: Schema.Types.Mixed, default: null },
  // Confirmed extraction + blockchain anchoring (hash only on-chain).
  confirmedMedicines: { type: Schema.Types.Mixed, default: null },
  confirmedAt: { type: String, default: null },
  confirmedBy: { type: String, default: null },
  confirmedHash: { type: String, default: null },
  blockchain: { type: Schema.Types.Mixed, default: null },
}, base);

const InventoryBatchSchema = new Schema({
  id: { type: String, required: true, unique: true },
  organizationId: { type: String, required: true },
  medicineName: { type: String, required: true },
  genericName: { type: String, default: '' },
  batchNumber: { type: String, required: true },
  expiryDate: { type: String },
  availableQuantity: { type: Number, default: 0 },
  status: { type: String, enum: ['released', 'quarantine', 'expired', 'recalled'], default: 'released' },
}, base);

// POS sale recorded by a dealer/pharmacy. medicineName/batchNumber are kept
// denormalized so receipts render without joins; quantity is deducted from
// the org's matching inventory lot (earliest expiry first) by the route.
const SaleSchema = new Schema({
  id: { type: String, required: true, unique: true },
  organizationId: { type: String, required: true },
  dealerName: { type: String, default: '' },
  medicineName: { type: String, required: true },
  batchNumber: { type: String, default: '' },
  customerName: { type: String, default: 'Walk-in customer' },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
}, base);

// Scan log for QR verifications (who verified which batch, outcome).
const QRVerificationSchema = new Schema({
  id: { type: String, required: true, unique: true },
  batchId: { type: String, default: '' },
  batchNumber: { type: String, default: '' },
  code: { type: String, required: true },
  result: { type: String, enum: ['authentic', 'expired', 'recalled', 'invalid', 'quarantine'], required: true },
  verifiedBy: { type: String, default: '' },
  organizationId: { type: String, default: '' },
  location: { type: String, default: '' },
}, base);

const DrugReferenceSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  genericName: { type: String, default: '' },
  category: { type: String, default: '' },
  dosageForm: { type: String, default: '' },
  strengths: { type: [String], default: [] },
  source: { type: String, default: 'reference_dataset' },
}, base);

const PatientRecordSchema = new Schema({
  id: { type: String, required: true, unique: true },
  organizationId: { type: String, required: true },
  referenceHash: { type: String, required: true },
  patientNameHash: { type: String, default: '' },
  patientAge: { type: Number, default: null },
  patientGender: { type: String, default: '' },
  allergiesEnc: { type: String, default: '' },
  existingConditionsEnc: { type: String, default: '' },
  currentMedicinesEnc: { type: String, default: '' },
}, base);

const PrescriptionAuditSchema = new Schema({
  id: { type: String, required: true, unique: true },
  prescriptionId: { type: String, required: true },
  actorId: { type: String, default: '' },
  actorRole: { type: String, default: '' },
  eventType: { type: String, required: true },
  note: { type: String, default: '' },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

// Pharmacy POS bill — header + line items. Stock deduction and the per-line
// Sale records are written by the billing route; the bill is the printable
// receipt referencing them. medicineName/batchNumber are denormalized so the
// receipt renders without joins.
const BillItemSchema = new Schema({
  medicineName: { type: String, required: true },
  batchNumber: { type: String, default: '' },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
}, { _id: false });

const BillSchema = new Schema({
  id: { type: String, required: true, unique: true },
  billNumber: { type: String, required: true, unique: true },
  organizationId: { type: String, required: true },
  customerName: { type: String, default: 'Walk-in customer' },
  patientRef: { type: String, default: '' },
  prescriptionId: { type: String, default: '' },
  items: { type: [BillItemSchema], default: [] },
  subtotal: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  paymentMethod: { type: String, enum: ['cash', 'card', 'upi'], default: 'cash' },
  status: { type: String, enum: ['paid', 'pending', 'void'], default: 'paid' },
  saleIds: { type: [String], default: [] },
}, base);

const ProcurementOrderSchema = new Schema({
  id: { type: String, required: true, unique: true },
  buyerId: { type: String, required: true, index: true },
  buyerName: { type: String, default: '' },
  buyerRole: { type: String, enum: ['dealer', 'hospital'], required: true },
  buyerOrganization: { type: String, required: true, index: true },
  manufacturerId: { type: String, required: true, index: true },
  medicineId: { type: String, required: true },
  medicineName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  notes: { type: String, default: '' },
  decisionNote: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'shipped', 'received', 'cancelled'],
    default: 'pending',
    index: true,
  },
  allocations: [{
    batchId: String,
    batchNumber: String,
    expiryDate: String,
    quantity: Number,
  }],
}, base);

const models = {
  User: mongoose.models.User || mongoose.model('User', UserSchema),
  Bill: mongoose.models.Bill || mongoose.model('Bill', BillSchema),
  Medicine: mongoose.models.Medicine || mongoose.model('Medicine', MedicineSchema),
  Batch: mongoose.models.Batch || mongoose.model('Batch', BatchSchema),
  Shipment: mongoose.models.Shipment || mongoose.model('Shipment', ShipmentSchema),
  Prescription: mongoose.models.Prescription || mongoose.model('Prescription', PrescriptionSchema),
  PrescriptionAudit: mongoose.models.PrescriptionAudit || mongoose.model('PrescriptionAudit', PrescriptionAuditSchema),
  DrugReference: mongoose.models.DrugReference || mongoose.model('DrugReference', DrugReferenceSchema),
  PatientRecord: mongoose.models.PatientRecord || mongoose.model('PatientRecord', PatientRecordSchema),
  InventoryBatch: mongoose.models.InventoryBatch || mongoose.model('InventoryBatch', InventoryBatchSchema),
  Sale: mongoose.models.Sale || mongoose.model('Sale', SaleSchema),
  QRVerification: mongoose.models.QRVerification || mongoose.model('QRVerification', QRVerificationSchema),
  TransportEvent: mongoose.models.TransportEvent || mongoose.model('TransportEvent', TransportEventSchema),
  ProcurementOrder: mongoose.models.ProcurementOrder || mongoose.model('ProcurementOrder', ProcurementOrderSchema),
};

module.exports = models;
