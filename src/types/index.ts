// ---------------------------------------------------------------------------
// PharmaChain core domain types
// ---------------------------------------------------------------------------

export type UserRole =
  | 'manufacturer'
  | 'distributor'
  | 'dealer'
  | 'hospital'
  | 'customer'
  | 'transport'
  | 'admin';

export type UserStatus = 'active' | 'pending' | 'suspended' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization: string;
  phone: string;
  address: string;
  status: UserStatus;
  avatar?: string;
  createdAt: string;
  lastLogin?: string;
}

export type BatchStatus = 'active' | 'expired' | 'recalled' | 'depleted';

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  category: string;
  dosageForm: string;
  strength: string;
  manufacturerId: string;
  description: string;
  storageCondition: string;
  image?: string;
}

export interface Batch {
  id: string;
  medicineId: string;
  /** Real medicine display name (server-backed batches); undefined on mock. */
  medicineName?: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  quantityProduced: number;
  availableQuantity: number;
  status: BatchStatus;
  qrCode: string; // verification URL encoded in the QR
  recallReason?: string;
  createdAt: string;
}

export type ShipmentStatus =
  | 'CREATED'
  | 'PACKED'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'ASSIGNED_TO_DISTRIBUTOR'
  | 'ASSIGNED_TO_DEALER'
  | 'DELIVERED'
  | 'CANCELLED';

export interface Shipment {
  id: string;
  batchId: string;
  medicineId: string;
  senderId: string;
  receiverId: string;
  destination: string;
  route: string;
  quantity: number;
  trackingNumber: string;
  status: ShipmentStatus;
  estimatedDelivery: string;
  createdAt: string;
  deliveredAt?: string;
}

export interface Stock {
  id: string;
  medicineId: string;
  batchId: string;
  ownerId: string;
  openingQuantity: number;
  receivedQuantity: number;
  dispatchedQuantity: number;
  damagedQuantity: number;
  availableQuantity: number;
  reorderLevel: number;
  updatedAt: string;
  /** Present on server-backed stock (inventory lots); mock data omits it. */
  expiryDate?: string;
}

/** 'quarantine' = a real batch whose verification is not complete (⚠ state). */
export type VerificationResult = 'authentic' | 'expired' | 'recalled' | 'invalid' | 'quarantine';

export interface QRVerification {
  id: string;
  qrCode: string;
  batchId: string;
  verifiedBy: string;
  result: VerificationResult;
  location: string;
  timestamp: string;
}

export type RecallSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RecallStatus = 'open' | 'in_progress' | 'resolved';

export interface Recall {
  id: string;
  batchId: string;
  /** Denormalized display fields on server-backed recalls (real batches). */
  batchNumber?: string;
  medicineName?: string;
  manufacturerId?: string;
  reason: string;
  severity: RecallSeverity;
  status: RecallStatus;
  affectedQuantity: number;
  createdAt: string;
  resolvedAt?: string;
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  userId: string; // userId or 'all'
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  description: string;
  timestamp: string;
}

// ------------------------------ Support types ------------------------------

export interface Department {
  id: string;
  hospitalId: string;
  name: string;
  head: string;
  staffCount: number;
}

export interface UsageRecord {
  id: string;
  hospitalId: string;
  batchId: string;
  medicineId: string;
  departmentId: string;
  quantityUsed: number;
  usedFor: string;
  timestamp: string;
}

export interface HospitalRequest {
  id: string;
  hospitalId: string;
  medicineName: string;
  quantity: number;
  department: string;
  priority: 'normal' | 'important' | 'emergency';
  requiredDate: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  createdAt: string;
}

export interface Sale {
  id: string;
  dealerId: string;
  dealerName?: string;
  batchId: string;
  medicineId: string;
  customerName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  timestamp: string;
}

/** One line item on a pharmacy bill. */
export interface BillItem {
  medicineName: string;
  batchNumber: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/** A POS bill: header + items + totals, persisted by POST /api/platform/bills. */
export interface Bill {
  id: string;
  billNumber: string;
  organizationId: string;
  customerName: string;
  patientRef: string;
  prescriptionId: string;
  items: BillItem[];
  subtotal: number;
  tax: number;
  discount: number;
  grandTotal: number;
  paymentMethod: 'cash' | 'card' | 'upi';
  status: 'paid' | 'pending' | 'void';
  saleIds: string[];
  createdAt?: string;
}

export interface TimelineEvent {
  label: string;
  description?: string;
  timestamp?: string;
  done: boolean;
  tone?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface TrendStat {
  label: string;
  value: number;
  trend?: number;
  format?: 'number' | 'currency' | 'percent';
  tone?: 'default' | 'success' | 'warning' | 'error' | 'info';
  linkTo?: string;
}
