import type {
  AuditLog,
  Batch,
  Medicine,
  Notification,
  QRVerification,
  Recall,
  Sale,
  Shipment,
  Stock,
  User,
} from '../types';
import { DEMO_ACCOUNTS } from './demoAccounts';

const DAY = 86_400_000;
export const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();
export const daysAhead = (n: number) => new Date(Date.now() + n * DAY).toISOString();

// --------------------------------- Users -----------------------------------

export const mockUsers: User[] = [
  ...DEMO_ACCOUNTS.map((acc, i) => ({
    id: `u${i + 1}`,
    name: acc.name,
    email: acc.email,
    role: acc.role,
    organization: acc.organization,
    phone: `+91 98${String(40000000 + i * 111111).slice(0, 8)}`,
    address: acc.location,
    status: 'active' as const,
    createdAt: daysAgo(300 - i * 20),
    lastLogin: daysAgo(i * 0.2),
  })),
  { id: 'u7', name: 'vijay hospitals', email: 'vijay@careplus.in', role: 'hospital', organization: 'CarePlus Multi-Speciality', phone: '+91 9841022334', address: 'Chennai, Tamil Nadu', status: 'pending', createdAt: daysAgo(4), lastLogin: undefined },
  { id: 'u8', name: 'medi distrib', email: 'medi@distr.in', role: 'distributor', organization: 'MediDist Logistics', phone: '+91 9884732110', address: 'Kochi, Kerala', status: 'suspended', createdAt: daysAgo(120), lastLogin: daysAgo(30) },
  { id: 'u9', name: 'green pharmacy', email: 'green@meds.in', role: 'dealer', organization: 'GreenLeaf Pharmacy', phone: '+91 9003188221', address: 'Bengaluru, Karnataka', status: 'pending', createdAt: daysAgo(2) },
  { id: 'u10', name: 'sunrise pharma', email: 'sunrise@mfg.in', role: 'manufacturer', organization: 'Sunrise Labs', phone: '+91 9042255667', address: 'Hyderabad, Telangana', status: 'active', createdAt: daysAgo(200), lastLogin: daysAgo(3) },
];

export const USER_BY_ID = new Map(mockUsers.map((u) => [u.id, u]));
export const userName = (id: string) => USER_BY_ID.get(id)?.name ?? id;

// -------------------------------- Medicines --------------------------------

export const mockMedicines: Medicine[] = [
  { id: 'm1', name: 'Paracetamol 500 mg', genericName: 'Acetaminophen', category: 'Analgesic', dosageForm: 'Tablet', strength: '500 mg', manufacturerId: 'u1', description: 'First-line relief for mild to moderate pain and fever.', storageCondition: 'Store below 30°C, dry place' },
  { id: 'm2', name: 'Amoxicillin 500 mg', genericName: 'Amoxicillin Trihydrate', category: 'Antibiotic', dosageForm: 'Capsule', strength: '500 mg', manufacturerId: 'u1', description: 'Broad-spectrum penicillin antibiotic for bacterial infections.', storageCondition: 'Store below 25°C' },
  { id: 'm3', name: 'Azithromycin 250 mg', genericName: 'Azithromycin', category: 'Antibiotic', dosageForm: 'Tablet', strength: '250 mg', manufacturerId: 'u10', description: 'Macrolide antibiotic for respiratory and skin infections.', storageCondition: 'Store below 30°C' },
  { id: 'm4', name: 'Cetirizine 10 mg', genericName: 'Cetirizine HCl', category: 'Antihistamine', dosageForm: 'Tablet', strength: '10 mg', manufacturerId: 'u1', description: 'Once-daily relief for allergic rhinitis and hives.', storageCondition: 'Store below 30°C, protect from light' },
  { id: 'm5', name: 'Metformin 500 mg', genericName: 'Metformin HCl', category: 'Antidiabetic', dosageForm: 'Tablet', strength: '500 mg', manufacturerId: 'u10', description: 'Biguanide for type-2 diabetes glycaemic control.', storageCondition: 'Store below 30°C' },
  { id: 'm6', name: 'Ibuprofen 400 mg', genericName: 'Ibuprofen', category: 'NSAID', dosageForm: 'Tablet', strength: '400 mg', manufacturerId: 'u1', description: 'NSAID for pain, fever and inflammation.', storageCondition: 'Store below 30°C' },
  { id: 'm7', name: 'Omeprazole 20 mg', genericName: 'Omeprazole', category: 'PPI', dosageForm: 'Capsule', strength: '20 mg', manufacturerId: 'u10', description: 'Proton-pump inhibitor for acid reflux and ulcers.', storageCondition: 'Store below 25°C, dry place' },
  { id: 'm8', name: 'Vitamin D3 Tablets', genericName: 'Cholecalciferol', category: 'Supplement', dosageForm: 'Tablet', strength: '60000 IU', manufacturerId: 'u1', description: 'Weekly high-dose vitamin D supplement.', storageCondition: 'Store below 30°C' },
];

export const MEDICINE_BY_ID = new Map(mockMedicines.map((m) => [m.id, m]));
export const medicineName = (id: string) => MEDICINE_BY_ID.get(id)?.name ?? 'Unknown medicine';

// --------------------------------- Batches ---------------------------------

export const mockBatches: Batch[] = [
  { id: 'b1', medicineId: 'm1', batchNumber: 'PCM-2411-A', manufacturingDate: daysAgo(75), expiryDate: daysAhead(640), quantityProduced: 50000, availableQuantity: 32000, status: 'active', qrCode: 'https://verify.pharmachain.com/b/PCM-2411-A', createdAt: daysAgo(75) },
  { id: 'b2', medicineId: 'm1', batchNumber: 'PCM-2501-B', manufacturingDate: daysAgo(30), expiryDate: daysAhead(700), quantityProduced: 40000, availableQuantity: 40000, status: 'active', qrCode: 'https://verify.pharmachain.com/b/PCM-2501-B', createdAt: daysAgo(30) },
  { id: 'b3', medicineId: 'm2', batchNumber: 'AMX-2409-C', manufacturingDate: daysAgo(120), expiryDate: daysAhead(480), quantityProduced: 25000, availableQuantity: 18500, status: 'active', qrCode: 'https://verify.pharmachain.com/b/AMX-2409-C', createdAt: daysAgo(120) },
  { id: 'b4', medicineId: 'm2', batchNumber: 'AMX-2402-D', manufacturingDate: daysAgo(410), expiryDate: daysAgo(15), quantityProduced: 30000, availableQuantity: 2200, status: 'expired', qrCode: 'https://verify.pharmachain.com/b/AMX-2402-D', createdAt: daysAgo(410) },
  { id: 'b5', medicineId: 'm3', batchNumber: 'AZT-2502-E', manufacturingDate: daysAgo(20), expiryDate: daysAhead(560), quantityProduced: 18000, availableQuantity: 18000, status: 'active', qrCode: 'https://verify.pharmachain.com/b/AZT-2502-E', createdAt: daysAgo(20) },
  { id: 'b6', medicineId: 'm4', batchNumber: 'CTZ-2410-F', manufacturingDate: daysAgo(90), expiryDate: daysAhead(590), quantityProduced: 60000, availableQuantity: 41000, status: 'active', qrCode: 'https://verify.pharmachain.com/b/CTZ-2410-F', createdAt: daysAgo(90) },
  { id: 'b7', medicineId: 'm4', batchNumber: 'CTZ-2503-G', manufacturingDate: daysAgo(10), expiryDate: daysAhead(620), quantityProduced: 20000, availableQuantity: 20000, status: 'active', qrCode: 'https://verify.pharmachain.com/b/CTZ-2503-G', createdAt: daysAgo(10) },
  { id: 'b8', medicineId: 'm5', batchNumber: 'MET-2408-H', manufacturingDate: daysAgo(140), expiryDate: daysAhead(430), quantityProduced: 45000, availableQuantity: 9000, status: 'active', qrCode: 'https://verify.pharmachain.com/b/MET-2408-H', createdAt: daysAgo(140) },
  { id: 'b9', medicineId: 'm5', batchNumber: 'MET-2401-I', manufacturingDate: daysAgo(440), expiryDate: daysAgo(60), quantityProduced: 22000, availableQuantity: 0, status: 'depleted', qrCode: 'https://verify.pharmachain.com/b/MET-2401-I', createdAt: daysAgo(440) },
  { id: 'b10', medicineId: 'm6', batchNumber: 'IBU-2412-J', manufacturingDate: daysAgo(60), expiryDate: daysAhead(510), quantityProduced: 35000, availableQuantity: 27500, status: 'recalled', qrCode: 'https://verify.pharmachain.com/b/IBU-2412-J', recallReason: 'Dissolution test failure in routine stability study', createdAt: daysAgo(60) },
  { id: 'b11', medicineId: 'm7', batchNumber: 'OMP-2501-K', manufacturingDate: daysAgo(35), expiryDate: daysAhead(540), quantityProduced: 28000, availableQuantity: 25000, status: 'active', qrCode: 'https://verify.pharmachain.com/b/OMP-2501-K', createdAt: daysAgo(35) },
  { id: 'b12', medicineId: 'm8', batchNumber: 'VTD-2502-L', manufacturingDate: daysAgo(15), expiryDate: daysAhead(730), quantityProduced: 15000, availableQuantity: 14000, status: 'active', qrCode: 'https://verify.pharmachain.com/b/VTD-2502-L', createdAt: daysAgo(15) },
  { id: 'b13', medicineId: 'm3', batchNumber: 'AZT-2406-M', manufacturingDate: daysAgo(300), expiryDate: daysAgo(5), quantityProduced: 16000, availableQuantity: 800, status: 'expired', qrCode: 'https://verify.pharmachain.com/b/AZT-2406-M', createdAt: daysAgo(300) },
  { id: 'b14', medicineId: 'm6', batchNumber: 'IBU-2503-N', manufacturingDate: daysAgo(8), expiryDate: daysAhead(600), quantityProduced: 12000, availableQuantity: 12000, status: 'active', qrCode: 'https://verify.pharmachain.com/b/IBU-2503-N', createdAt: daysAgo(8) },
];

export const BATCH_BY_ID = new Map(mockBatches.map((b) => [b.id, b]));
export const BATCH_BY_NUMBER = new Map(mockBatches.map((b) => [b.batchNumber.toUpperCase(), b]));
export const batchByNumber = (n: string) => BATCH_BY_NUMBER.get(n.trim().toUpperCase());
export const batchById = (id: string) => BATCH_BY_ID.get(id);

// -------------------------------- Shipments --------------------------------

export const mockShipments: Shipment[] = [
  { id: 'SHIP-MTAZSD1I8CNA3V', batchId: 'b2', medicineId: 'm1', senderId: 'u1', receiverId: 'u2', destination: 'Coimbatore', route: 'Tiruppur → Coimbatore', quantity: 8000, trackingNumber: 'TRK-88120', status: 'ASSIGNED_TO_DISTRIBUTOR', estimatedDelivery: daysAhead(2), createdAt: daysAgo(3) },
  { id: 'SHIP-MTK9QW2PLORD7X', batchId: 'b3', medicineId: 'm2', senderId: 'u1', receiverId: 'u2', destination: 'Coimbatore', route: 'Tiruppur → Coimbatore', quantity: 6000, trackingNumber: 'TRK-88121', status: 'IN_TRANSIT', estimatedDelivery: daysAhead(1), createdAt: daysAgo(4) },
  { id: 'SHIP-MTR4TG8HZKQ21B', batchId: 'b6', medicineId: 'm4', senderId: 'u2', receiverId: 'u3', destination: 'Chennai', route: 'Coimbatore → Chennai', quantity: 4000, trackingNumber: 'TRK-88122', status: 'ASSIGNED_TO_DEALER', estimatedDelivery: daysAhead(3), createdAt: daysAgo(2) },
  { id: 'SHIP-MTB7VD5NXJWQ6C', batchId: 'b1', medicineId: 'm1', senderId: 'u2', receiverId: 'u3', destination: 'Chennai', route: 'Coimbatore → Chennai', quantity: 5000, trackingNumber: 'TRK-88123', status: 'DELIVERED', estimatedDelivery: daysAgo(1), createdAt: daysAgo(8), deliveredAt: daysAgo(1) },
  { id: 'SHIP-MTF3JN9SRTA84D', batchId: 'b5', medicineId: 'm3', senderId: 'u1', receiverId: 'u4', destination: 'KMCH Hospital, Coimbatore', route: 'Tiruppur → Coimbatore', quantity: 3000, trackingNumber: 'TRK-88124', status: 'IN_TRANSIT', estimatedDelivery: daysAhead(1), createdAt: daysAgo(2) },
  { id: 'SHIP-MTD8KP4VLZRQ9E', batchId: 'b8', medicineId: 'm5', senderId: 'u1', receiverId: 'u2', destination: 'Coimbatore', route: 'Tiruppur → Coimbatore → Chennai', quantity: 4500, trackingNumber: 'TRK-88125', status: 'DISPATCHED', estimatedDelivery: daysAhead(4), createdAt: daysAgo(1) },
  { id: 'SHIP-MTC2RN7XTWBK5H', batchId: 'b11', medicineId: 'm7', senderId: 'u2', receiverId: 'u4', destination: 'KMCH Hospital, Coimbatore', route: 'Coimbatore → Coimbatore', quantity: 2500, trackingNumber: 'TRK-88126', status: 'DELIVERED', estimatedDelivery: daysAgo(3), createdAt: daysAgo(9), deliveredAt: daysAgo(3) },
  { id: 'SHIP-MTV6JH3QYDNM8F', batchId: 'b12', medicineId: 'm8', senderId: 'u1', receiverId: 'u3', destination: 'Chennai', route: 'Tiruppur → Chennai', quantity: 2000, trackingNumber: 'TRK-88127', status: 'PACKED', estimatedDelivery: daysAhead(6), createdAt: daysAgo(1) },
  { id: 'SHIP-MTB1XC9GKFRP4L', batchId: 'b7', medicineId: 'm4', senderId: 'u1', receiverId: 'u4', destination: 'Vijay Care, Chennai', route: 'Tiruppur → Chennai', quantity: 1500, trackingNumber: 'TRK-88128', status: 'CANCELLED', estimatedDelivery: daysAgo(0), createdAt: daysAgo(6) },
  { id: 'SHIP-MTN4VD2PLZQ7S', batchId: 'b6', medicineId: 'm4', senderId: 'u2', receiverId: 'u4', destination: 'KMCH Hospital, Coimbatore', route: 'Coimbatore → Coimbatore', quantity: 3200, trackingNumber: 'TRK-88129', status: 'ASSIGNED_TO_DISTRIBUTOR', estimatedDelivery: daysAhead(2), createdAt: daysAgo(2) },
  { id: 'SHIP-MTW8TG5XRHNK2D', batchId: 'b14', medicineId: 'm6', senderId: 'u1', receiverId: 'u2', destination: 'Bengaluru', route: 'Tiruppur → Bengaluru', quantity: 2800, trackingNumber: 'TRK-88130', status: 'CREATED', estimatedDelivery: daysAhead(7), createdAt: daysAgo(0) },
  { id: 'SHIP-MTZ5NB6CVQLP9K', batchId: 'b1', medicineId: 'm1', senderId: 'u2', receiverId: 'u9', destination: 'GreenLeaf Pharmacy, Bengaluru', route: 'Coimbatore → Bengaluru', quantity: 1800, trackingNumber: 'TRK-88131', status: 'IN_TRANSIT', estimatedDelivery: daysAhead(2), createdAt: daysAgo(3) },
];

export const SHIPMENT_BY_ID = new Map(mockShipments.map((s) => [s.id, s]));

// ---------------------------------- Stock ----------------------------------

export const mockStock: Stock[] = [
  { id: 'st1', medicineId: 'm1', batchId: 'b1', ownerId: 'u1', openingQuantity: 40000, receivedQuantity: 0, dispatchedQuantity: 8000, damagedQuantity: 0, availableQuantity: 32000, reorderLevel: 5000, updatedAt: daysAgo(1) },
  { id: 'st2', medicineId: 'm1', batchId: 'b2', ownerId: 'u1', openingQuantity: 40000, receivedQuantity: 0, dispatchedQuantity: 0, damagedQuantity: 0, availableQuantity: 40000, reorderLevel: 5000, updatedAt: daysAgo(1) },
  { id: 'st3', medicineId: 'm2', batchId: 'b3', ownerId: 'u1', openingQuantity: 25000, receivedQuantity: 0, dispatchedQuantity: 6500, damagedQuantity: 0, availableQuantity: 18500, reorderLevel: 4000, updatedAt: daysAgo(2) },
  { id: 'st4', medicineId: 'm2', batchId: 'b4', ownerId: 'u1', openingQuantity: 30000, receivedQuantity: 0, dispatchedQuantity: 27800, damagedQuantity: 0, availableQuantity: 2200, reorderLevel: 3000, updatedAt: daysAgo(2) },
  { id: 'st5', medicineId: 'm3', batchId: 'b5', ownerId: 'u1', openingQuantity: 18000, receivedQuantity: 0, dispatchedQuantity: 0, damagedQuantity: 0, availableQuantity: 18000, reorderLevel: 3000, updatedAt: daysAgo(1) },
  { id: 'st6', medicineId: 'm4', batchId: 'b6', ownerId: 'u1', openingQuantity: 60000, receivedQuantity: 0, dispatchedQuantity: 19000, damagedQuantity: 0, availableQuantity: 41000, reorderLevel: 6000, updatedAt: daysAgo(1) },
  { id: 'st7', medicineId: 'm4', batchId: 'b7', ownerId: 'u1', openingQuantity: 20000, receivedQuantity: 0, dispatchedQuantity: 0, damagedQuantity: 0, availableQuantity: 20000, reorderLevel: 4000, updatedAt: daysAgo(1) },
  { id: 'st8', medicineId: 'm5', batchId: 'b8', ownerId: 'u1', openingQuantity: 45000, receivedQuantity: 0, dispatchedQuantity: 36000, damagedQuantity: 0, availableQuantity: 9000, reorderLevel: 8000, updatedAt: daysAgo(0) },
  { id: 'st9', medicineId: 'm6', batchId: 'b10', ownerId: 'u1', openingQuantity: 35000, receivedQuantity: 0, dispatchedQuantity: 7500, damagedQuantity: 0, availableQuantity: 27500, reorderLevel: 5000, updatedAt: daysAgo(0) },
  { id: 'st10', medicineId: 'm7', batchId: 'b11', ownerId: 'u1', openingQuantity: 28000, receivedQuantity: 0, dispatchedQuantity: 3000, damagedQuantity: 0, availableQuantity: 25000, reorderLevel: 4000, updatedAt: daysAgo(1) },
  { id: 'st11', medicineId: 'm8', batchId: 'b12', ownerId: 'u1', openingQuantity: 15000, receivedQuantity: 0, dispatchedQuantity: 1000, damagedQuantity: 0, availableQuantity: 14000, reorderLevel: 2500, updatedAt: daysAgo(1) },
  { id: 'st12', medicineId: 'm1', batchId: 'b1', ownerId: 'u3', openingQuantity: 0, receivedQuantity: 5000, dispatchedQuantity: 2200, damagedQuantity: 30, availableQuantity: 2770, reorderLevel: 500, updatedAt: daysAgo(0) },
  { id: 'st13', medicineId: 'm4', batchId: 'b6', ownerId: 'u3', openingQuantity: 0, receivedQuantity: 4000, dispatchedQuantity: 1500, damagedQuantity: 0, availableQuantity: 2500, reorderLevel: 600, updatedAt: daysAgo(0) },
  { id: 'st14', medicineId: 'm7', batchId: 'b11', ownerId: 'u4', openingQuantity: 0, receivedQuantity: 2500, dispatchedQuantity: 900, damagedQuantity: 0, availableQuantity: 1600, reorderLevel: 400, updatedAt: daysAgo(0) },
  { id: 'st15', medicineId: 'm2', batchId: 'b3', ownerId: 'u2', openingQuantity: 0, receivedQuantity: 12500, dispatchedQuantity: 6100, damagedQuantity: 40, availableQuantity: 6360, reorderLevel: 2000, updatedAt: daysAgo(0) },
];

// ------------------------------ QR verifications ---------------------------

export const mockVerifications: QRVerification[] = [
  { id: 'qv1', qrCode: 'PCM-2411-A', batchId: 'b1', verifiedBy: 'u5', result: 'authentic', location: 'Madurai, Tamil Nadu', timestamp: daysAgo(1) },
  { id: 'qv2', qrCode: 'AMX-2409-C', batchId: 'b3', verifiedBy: 'u3', result: 'authentic', location: 'Chennai, Tamil Nadu', timestamp: daysAgo(2) },
  { id: 'qv3', qrCode: 'AMX-2402-D', batchId: 'b4', verifiedBy: 'u5', result: 'expired', location: 'Coimbatore, Tamil Nadu', timestamp: daysAgo(2) },
  { id: 'qv4', qrCode: 'IBU-2412-J', batchId: 'b10', verifiedBy: 'u5', result: 'recalled', location: 'Madurai, Tamil Nadu', timestamp: daysAgo(3) },
  { id: 'qv5', qrCode: 'CTZ-2410-F', batchId: 'b6', verifiedBy: 'u4', result: 'authentic', location: 'Coimbatore, Tamil Nadu', timestamp: daysAgo(3) },
  { id: 'qv6', qrCode: 'MET-2408-H', batchId: 'b8', verifiedBy: 'u3', result: 'authentic', location: 'Chennai, Tamil Nadu', timestamp: daysAgo(4) },
  { id: 'qv7', qrCode: 'ZZZ-0000-X', batchId: '', verifiedBy: 'u5', result: 'invalid', location: 'Hyderabad, Telangana', timestamp: daysAgo(4) },
  { id: 'qv8', qrCode: 'OMP-2501-K', batchId: 'b11', verifiedBy: 'u4', result: 'authentic', location: 'Coimbatore, Tamil Nadu', timestamp: daysAgo(5) },
  { id: 'qv9', qrCode: 'VTD-2502-L', batchId: 'b12', verifiedBy: 'u5', result: 'authentic', location: 'Madurai, Tamil Nadu', timestamp: daysAgo(6) },
  { id: 'qv10', qrCode: 'AZT-2406-M', batchId: 'b13', verifiedBy: 'u3', result: 'expired', location: 'Chennai, Tamil Nadu', timestamp: daysAgo(7) },
  { id: 'qv11', qrCode: 'PCM-2501-B', batchId: 'b2', verifiedBy: 'u2', result: 'authentic', location: 'Coimbatore, Tamil Nadu', timestamp: daysAgo(8) },
  { id: 'qv12', qrCode: 'IBU-2412-J', batchId: 'b10', verifiedBy: 'u4', result: 'recalled', location: 'Coimbatore, Tamil Nadu', timestamp: daysAgo(9) },
];

// ---------------------------------- Recalls --------------------------------

export const mockRecalls: Recall[] = [
  { id: 'rc1', batchId: 'b10', reason: 'Dissolution test failure in routine stability study', severity: 'high', status: 'in_progress', affectedQuantity: 27500, createdAt: daysAgo(5) },
  { id: 'rc2', batchId: 'b4', reason: 'Batch past expiry date — market withdrawal', severity: 'medium', status: 'resolved', affectedQuantity: 2200, createdAt: daysAgo(20), resolvedAt: daysAgo(10) },
  { id: 'rc3', batchId: 'b9', reason: 'Label mismatch detected during self-inspection', severity: 'low', status: 'open', affectedQuantity: 0, createdAt: daysAgo(2) },
];

// ------------------------------ Notifications ------------------------------

export const mockNotifications: Notification[] = [
  { id: 'n1', userId: 'u1', title: 'Low stock alert', message: 'Metformin 500 mg (MET-2408-H) is below reorder level (9,000 / 8,000).', type: 'warning', isRead: false, createdAt: daysAgo(0.1) },
  { id: 'n2', userId: 'u1', title: 'Shipment delivered', message: 'SHIP-MTB7VD5NXJWQ6C delivered to sahana Medicals, Chennai.', type: 'success', isRead: false, createdAt: daysAgo(1) },
  { id: 'n3', userId: 'u2', title: 'Incoming shipment', message: 'SHIP-MTK9QW2PLORD7X (Amoxicillin 500 mg) arriving tomorrow.', type: 'info', isRead: false, createdAt: daysAgo(0.5) },
  { id: 'n4', userId: 'u5', title: 'Recall alert', message: 'Ibuprofen 400 mg batch IBU-2412-J has been recalled. Stop selling this batch.', type: 'error', isRead: false, createdAt: daysAgo(5) },
  { id: 'n5', userId: 'u4', title: 'Expiry warning', message: 'Amoxicillin batch AMX-2402-D expired 15 days ago. Quarantine remaining stock.', type: 'warning', isRead: true, createdAt: daysAgo(15) },
  { id: 'n6', userId: 'u6', title: 'Pending approvals', message: '3 organizations are awaiting regulatory approval.', type: 'info', isRead: false, createdAt: daysAgo(0.2) },
  { id: 'n7', userId: 'all', title: 'Scheduled maintenance', message: 'PharmaChain will be briefly unavailable Sunday 02:00–03:00 IST.', type: 'info', isRead: true, createdAt: daysAgo(3) },
];

// -------------------------------- Audit logs -------------------------------

export const mockAuditLogs: AuditLog[] = [
  { id: 'a1', userId: 'u1', action: 'batch.create', entity: 'Batch', entityId: 'b14', description: 'Created batch IBU-2503-N (Ibuprofen 400 mg)', timestamp: daysAgo(0.2) },
  { id: 'a2', userId: 'u1', action: 'recall.initiate', entity: 'Batch', entityId: 'b10', description: 'Initiated recall of IBU-2412-J — dissolution failure', timestamp: daysAgo(5) },
  { id: 'a3', userId: 'u2', action: 'shipment.receive', entity: 'Shipment', entityId: 'SHIP-MTB7VD5NXJWQ6C', description: 'Received shipment at Coimbatore warehouse', timestamp: daysAgo(8) },
  { id: 'a4', userId: 'u3', action: 'sale.record', entity: 'Sale', entityId: 's1', description: 'Sold 10 units of Paracetamol 500 mg', timestamp: daysAgo(1) },
  { id: 'a5', userId: 'u6', action: 'user.suspend', entity: 'User', entityId: 'u8', description: 'Suspended MediDist Logistics pending licence renewal', timestamp: daysAgo(12) },
  { id: 'a6', userId: 'u5', action: 'qr.verify', entity: 'QRVerification', entityId: 'qv4', description: 'Verified IBU-2412-J — result: recalled', timestamp: daysAgo(3) },
  { id: 'a7', userId: 'u6', action: 'user.approve', entity: 'User', entityId: 'u7', description: 'Approved CarePlus Multi-Speciality hospital registration', timestamp: daysAgo(2) },
];

export const mockSales: Sale[] = [
  { id: 's1', dealerId: 'u3', batchId: 'b1', medicineId: 'm1', customerName: 'Walk-in customer', quantity: 10, unitPrice: 18, total: 180, timestamp: daysAgo(0.3) },
  { id: 's2', dealerId: 'u3', batchId: 'b6', medicineId: 'm4', customerName: 'R. Krishnan', quantity: 5, unitPrice: 32, total: 160, timestamp: daysAgo(0.6) },
  { id: 's3', dealerId: 'u3', batchId: 'b11', medicineId: 'm7', customerName: 'S. Meena', quantity: 14, unitPrice: 55, total: 770, timestamp: daysAgo(1.2) },
  { id: 's4', dealerId: 'u3', batchId: 'b3', medicineId: 'm2', customerName: 'Dr. A. Ramesh', quantity: 20, unitPrice: 42, total: 840, timestamp: daysAgo(2) },
  { id: 's5', dealerId: 'u3', batchId: 'b12', medicineId: 'm8', customerName: 'P. Lakshmi', quantity: 4, unitPrice: 90, total: 360, timestamp: daysAgo(3.5) },
  { id: 's6', dealerId: 'u3', batchId: 'b1', medicineId: 'm1', customerName: 'Walk-in customer', quantity: 25, unitPrice: 18, total: 450, timestamp: daysAgo(4.1) },
];

// ------------------------------ Derived helpers ----------------------------

export const lowStockRows = () =>
  mockStock
    .filter((s) => s.availableQuantity < s.reorderLevel)
    .map((s) => ({ stock: s, medicine: MEDICINE_BY_ID.get(s.medicineId), batch: BATCH_BY_ID.get(s.batchId) }));

export const expiringBatches = (withinDays = 90) =>
  mockBatches.filter((b) => b.status === 'active' && new Date(b.expiryDate).getTime() - Date.now() < withinDays * DAY);

export const nextBatchNumber = (medicineNameInput: string) => {
  const prefix = medicineNameInput.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'BTC';
  return `${prefix}-${new Date().getFullYear().toString().slice(2)}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(mockBatches.length + 1).padStart(2, '0')}`;
};
