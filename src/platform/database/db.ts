// Offline-first IndexedDB layer for PharmaChain (reconstruction of original src/lib/db.ts)
import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'manufacturer' | 'dealer' | 'pharmacy' | 'transport' | 'patient';
  createdAt: string;
  /** Present on server-issued users returned by /api/auth/me. */
  organization?: string;
}

export interface Batch {
  id: string;
  drugName: string;
  batchNumber: string;
  quantity: number;
  manufactureDate: string;
  expiryDate: string;
  status: 'active' | 'recalled' | 'expired';
  manufacturer: string;
  createdAt: string;
}

export interface Order {
  id: string;
  from: string;   // who placed it (pharmacy/dealer/patient)
  to: string;     // who fulfils it (dealer/manufacturer)
  drugName: string;
  quantity: number;
  status: 'pending' | 'dispatched' | 'in_transit' | 'delivered' | 'cancelled';
  createdAt: string;
}

export interface StockItem {
  id: string;
  owner: string;           // dealer / pharmacy / manufacturer name
  role: User['role'];
  drugName: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  price: number;
  createdAt: string;
}

export interface Sale {
  id: string;
  pharmacy: string;
  drugName: string;
  batchNumber: string;
  quantity: number;
  price: number;
  buyerEmail: string;
  createdAt: string;
}

export interface ScanRecord {
  id: string;
  code: string;
  result: 'green' | 'orange' | 'red';
  reasons: string[];
  scannedBy: string;
  at: string;
}

export interface NotificationRow {
  id: string;
  targetEmail: string | null; // null = broadcast
  title: string;
  body: string;
  read: boolean;
  at: string;
}

export interface Reminder {
  id: string;
  patientEmail: string;
  drugName: string;
  nextDoseAt: string;
  done: boolean;
}

export interface RefillRow {
  id: string;
  patientEmail: string;
  drugName: string;
  refillDue: string;
  done: boolean;
}

export interface SideEffectRow {
  id: string;
  patientEmail: string;
  drugName: string;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  at: string;
}

export interface ActivityRow {
  id: string;
  actor: string;
  action: string;
  detail: string;
  at: string;
}

export interface PharmaDB extends DBSchema {
  users: { key: string; value: User; indexes: { 'by-email': string } };
  batches: { key: string; value: Batch; indexes: { 'by-batchNumber': string } };
  orders: { key: string; value: Order };
  stock: { key: string; value: StockItem };
  sales: { key: string; value: Sale };
  scans: { key: string; value: ScanRecord };
  notifications: { key: string; value: NotificationRow };
  reminders: { key: string; value: Reminder };
  refills: { key: string; value: RefillRow };
  sideeffects: { key: string; value: SideEffectRow };
  activity: { key: string; value: ActivityRow };
}

let dbPromise: Promise<IDBPDatabase<PharmaDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<PharmaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PharmaDB>('pharmachain', 1, {
      upgrade(db) {
        const u = db.createObjectStore('users', { keyPath: 'id' });
        u.createIndex('by-email', 'email');
        const b = db.createObjectStore('batches', { keyPath: 'id' });
        b.createIndex('by-batchNumber', 'batchNumber');
        db.createObjectStore('orders', { keyPath: 'id' });
        db.createObjectStore('stock', { keyPath: 'id' });
        db.createObjectStore('sales', { keyPath: 'id' });
        db.createObjectStore('scans', { keyPath: 'id' });
        db.createObjectStore('notifications', { keyPath: 'id' });
        db.createObjectStore('reminders', { keyPath: 'id' });
        db.createObjectStore('refills', { keyPath: 'id' });
        db.createObjectStore('sideeffects', { keyPath: 'id' });
        db.createObjectStore('activity', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function logActivity(actor: string, action: string, detail = '') {
  const db = await getDB();
  await db.add('activity', { id: generateId(), actor, action, detail, at: new Date().toISOString() });
}

export async function notify(targetEmail: string | null, title: string, body = '') {
  const db = await getDB();
  await db.add('notifications', { id: generateId(), targetEmail, title, body, read: false, at: new Date().toISOString() });
}

export async function seedDemoData() {
  const db = await getDB();
  const existing = await db.count('users');
  if (existing > 0) return;

  const mkUser = (id: string, name: string, role: User['role'], email: string): User =>
    ({ id, name, role, email, password: 'demo123', createdAt: new Date().toISOString() });
  await db.add('users', mkUser('u1', 'System Admin', 'admin', 'admin@pharmachain.io'));
  await db.add('users', mkUser('u2', 'Acme Pharma', 'manufacturer', 'manufacturer@pharmachain.io'));
  await db.add('users', mkUser('u3', 'MediDist Dealer', 'dealer', 'dealer@pharmachain.io'));
  await db.add('users', mkUser('u4', 'sahana Pharmacy', 'pharmacy', 'sahana@pharmachain.io'));
  await db.add('users', mkUser('u5', 'FleetGo Transport', 'transport', 'transport@pharmachain.io'));
  await db.add('users', mkUser('u6', 'John Patient', 'patient', 'patient@pharmachain.io'));

  const days = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();
  await db.add('batches', { id: 'b1', drugName: 'Paracetamol 500mg', batchNumber: 'B-2024-001', quantity: 5000, manufactureDate: days(-60), expiryDate: days(400), status: 'active', manufacturer: 'Acme Pharma', createdAt: days(-60) });
  await db.add('batches', { id: 'b2', drugName: 'Amoxicillin 250mg', batchNumber: 'B-2024-002', quantity: 800, manufactureDate: days(-300), expiryDate: days(20), status: 'active', manufacturer: 'Acme Pharma', createdAt: days(-300) });
  await db.add('batches', { id: 'b3', drugName: 'Ibuprofen 400mg', batchNumber: 'B-2024-003', quantity: 0, manufactureDate: days(-200), expiryDate: days(200), status: 'active', manufacturer: 'Acme Pharma', createdAt: days(-200) });

  await db.add('stock', { id: 'st1', owner: 'MediDist Dealer', role: 'dealer', drugName: 'Paracetamol 500mg', batchNumber: 'B-2024-001', quantity: 1200, expiryDate: days(400), price: 12, createdAt: days(-50) });
  await db.add('stock', { id: 'st2', owner: 'MediDist Dealer', role: 'dealer', drugName: 'Amoxicillin 250mg', batchNumber: 'B-2024-002', quantity: 40, expiryDate: days(20), price: 30, createdAt: days(-45) });
  await db.add('stock', { id: 'st3', owner: 'sahana Pharmacy', role: 'pharmacy', drugName: 'Paracetamol 500mg', batchNumber: 'B-2024-001', quantity: 150, expiryDate: days(400), price: 18, createdAt: days(-30) });
  await db.add('stock', { id: 'st4', owner: 'sahana Pharmacy', role: 'pharmacy', drugName: 'Amoxicillin 250mg', batchNumber: 'B-2024-002', quantity: 15, expiryDate: days(20), price: 45, createdAt: days(-30) });

  await db.add('orders', { id: 'o1', from: 'sahana Pharmacy', to: 'MediDist Dealer', drugName: 'Paracetamol 500mg', quantity: 200, status: 'pending', createdAt: new Date().toISOString() });
  await db.add('orders', { id: 'o2', from: 'MediDist Dealer', to: 'Acme Pharma', drugName: 'Ibuprofen 400mg', quantity: 500, status: 'pending', createdAt: new Date().toISOString() });

  await db.add('sales', { id: 'sl1', pharmacy: 'sahana Pharmacy', drugName: 'Paracetamol 500mg', batchNumber: 'B-2024-001', quantity: 10, price: 18, buyerEmail: 'patient@pharmachain.io', createdAt: days(-7) });
  await db.add('sales', { id: 'sl2', pharmacy: 'sahana Pharmacy', drugName: 'Amoxicillin 250mg', batchNumber: 'B-2024-002', quantity: 5, price: 45, buyerEmail: 'patient@pharmachain.io', createdAt: days(-3) });

  await logActivity('System', 'seed', 'Demo data seeded');
}
