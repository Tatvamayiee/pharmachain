import {
  Activity, AlertTriangle, ArrowLeftRight, Award, Bell, Boxes,
  Building2, ClipboardCheck, ClipboardList, Database, FileBarChart, FileClock, FileText,
  HelpCircle, History, LayoutDashboard, LifeBuoy, Map, Megaphone, Package,
  PackageCheck, Pill,  QrCode, ReceiptText, ScanLine, Settings,
  ShieldAlert, ShieldCheck, ShoppingBag, Store, Stethoscope, Truck, User, Users,
  Warehouse, type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '../types';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Matched against the pathname prefix to compute the active state. */
  match?: string;
  end?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const ROLE_NAV: Record<UserRole, NavSection[]> = {
  manufacturer: [
    {
      items: [
        { label: 'Dashboard', to: '/manufacturer', icon: LayoutDashboard, end: true },
        { label: 'Data Entry', to: '/manufacturer/data-entry', icon: Database },
        { label: 'Medicine Catalog', to: '/manufacturer/medicines', icon: Pill },
        { label: 'Batch Management', to: '/manufacturer/batches', icon: Boxes },
        { label: 'Stock Maintenance', to: '/manufacturer/stock', icon: Warehouse },
      ],
    },
    {
      title: 'Supply Chain',
      items: [
        { label: 'QR Generation', to: '/manufacturer/qr', icon: QrCode },
        { label: 'Dispatch', to: '/manufacturer/dispatch', icon: Truck },
        { label: 'Live Tracking', to: '/manufacturer/tracking', icon: Map },
        { label: 'Recall Management', to: '/manufacturer/recalls', icon: ShieldAlert },
      ],
    },
    {
      title: 'Insights',
      items: [
        { label: 'Expiry Monitoring', to: '/manufacturer/expiry', icon: AlertTriangle },
        { label: 'Reports', to: '/manufacturer/reports', icon: FileBarChart },
      ],
    },
  ],

  distributor: [
    {
      items: [
        { label: 'Dashboard', to: '/distributor', icon: LayoutDashboard, end: true },
        { label: 'Incoming Shipments', to: '/distributor/incoming', icon: Package },
        { label: 'Inventory', to: '/distributor/inventory', icon: Warehouse },
      ],
    },
    {
      title: 'Orders',
      items: [
        { label: 'Dealer Orders', to: '/distributor/dealer-orders', icon: Store },
        { label: 'Hospital Orders', to: '/distributor/hospital-orders', icon: Building2 },
        { label: 'Dispatch', to: '/distributor/dispatch', icon: Truck },
      ],
    },
    {
      title: 'Operations',
      items: [
        { label: 'Live Tracking', to: '/distributor/tracking', icon: Map },
        { label: 'QR Verification', to: '/distributor/verify', icon: ScanLine },
        { label: 'Returns', to: '/distributor/returns', icon: ArrowLeftRight },
        { label: 'Expiry Alerts', to: '/distributor/expiry', icon: AlertTriangle },
        { label: 'Reports', to: '/distributor/reports', icon: FileBarChart },
      ],
    },
  ],

  dealer: [
    {
      items: [
        { label: 'Dashboard', to: '/dealer', icon: LayoutDashboard, end: true },
        { label: 'Available Stock', to: '/dealer/stock', icon: Package },
        { label: 'Billing (POS)', to: '/dealer/billing', icon: ReceiptText },
      ],
    },
    {
      title: 'Safety',
      items: [
        { label: 'QR Verification', to: '/dealer/verify', icon: ScanLine },
        { label: 'Recall Alerts', to: '/dealer/recalls', icon: ShieldAlert },
      ],
    },
    {
      title: 'Prescriptions',
      items: [
        { label: 'Prescription Scanner', to: '/dealer/prescriptions/scan', icon: ScanLine, match: '/dealer/prescriptions/scan' },
        { label: 'Prescription History', to: '/dealer/prescriptions', icon: History, match: '/dealer/prescriptions' },
        { label: 'Interaction Alerts', to: '/dealer/prescriptions/alerts', icon: ShieldAlert, match: '/dealer/prescriptions/alerts' },
        { label: 'Dispensing Review', to: '/dealer/prescriptions/dispensing', icon: ClipboardCheck, match: '/dealer/prescriptions/dispensing' },
      ],
    },
    {
      title: 'Insights',
      items: [
        { label: 'Reports', to: '/dealer/prescriptions/reports', icon: FileBarChart },
      ],
    },
  ],

  hospital: [
    {
      items: [
        { label: 'Dashboard', to: '/hospital', icon: LayoutDashboard, end: true },
        { label: 'Medicine Inventory', to: '/hospital/inventory', icon: Pill },
        { label: 'Request Medicines', to: '/hospital/request', icon: FileText },
        { label: 'Purchase Orders', to: '/hospital/orders', icon: ClipboardList },
        { label: 'Received Shipments', to: '/hospital/received', icon: PackageCheck },
      ],
    },
    {
      title: 'Ward Operations',
      items: [
        { label: 'Usage Records', to: '/hospital/usage', icon: Activity },
        { label: 'Departments', to: '/hospital/departments', icon: Building2 },
      ],
    },
    {
      title: 'Safety & Reports',
      items: [
        { label: 'QR Verification', to: '/hospital/verify', icon: ScanLine },
        { label: 'Expiry Alerts', to: '/hospital/expiry', icon: AlertTriangle },
        { label: 'Recall Alerts', to: '/hospital/recalls', icon: ShieldAlert },
        { label: 'Reports', to: '/hospital/reports', icon: FileBarChart },
      ],
    },
    {
      title: 'Prescriptions',
      items: [
        { label: 'Prescription Scanner', to: '/hospital/prescriptions/scan', icon: Stethoscope, match: '/hospital/prescriptions/scan' },
        { label: 'Prescription Records', to: '/hospital/prescriptions', icon: History, match: '/hospital/prescriptions' },
        { label: 'Interaction Alerts', to: '/hospital/prescriptions/alerts', icon: ShieldAlert, match: '/hospital/prescriptions/alerts' },
        { label: 'Dosage Review', to: '/hospital/prescriptions/dosage', icon: Activity, match: '/hospital/prescriptions/dosage' },
        { label: 'Pharmacist Approval Queue', to: '/hospital/prescriptions/approval-queue', icon: ClipboardCheck, match: '/hospital/prescriptions/approval-queue' },
        { label: 'Prescription Reports', to: '/hospital/prescriptions/reports', icon: FileBarChart, match: '/hospital/prescriptions/reports' },
      ],
    },
  ],

  transport: [
    {
      items: [
        { label: 'Dashboard', to: '/transporter', icon: LayoutDashboard, end: true },
        { label: 'Scan Transport QR', to: '/transporter/scan', icon: ScanLine },
      ],
    },
  ],

  customer: [
    {
      items: [
        { label: 'Dashboard', to: '/customer', icon: LayoutDashboard, end: true },
        { label: 'Scan Medicine QR', to: '/customer/scan', icon: ScanLine },
        { label: 'Verify Medicine', to: '/customer/verify', icon: ShieldCheck },
        { label: 'My Orders', to: '/customer/orders', icon: ShoppingBag },
        { label: 'Order Tracking', to: '/customer/tracking', icon: Map },
      ],
    },
    {
      title: 'Personal',
      items: [
        { label: 'Saved Medicines', to: '/customer/saved', icon: Award },
        { label: 'Recall Alerts', to: '/customer/recalls', icon: Megaphone },
        { label: 'Report Medicine', to: '/customer/report', icon: Megaphone },
        { label: 'Help & Support', to: '/customer/help', icon: LifeBuoy },
      ],
    },
  ],

  admin: [
    {
      items: [
        { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
        { label: 'User Management', to: '/admin/users', icon: Users },
      ],
    },
    {
      title: 'Registries',
      items: [
        { label: 'Medicine Registry', to: '/admin/medicines', icon: Pill },
        { label: 'Batch Registry', to: '/admin/batches', icon: Boxes },
        { label: 'Shipment Monitoring', to: '/admin/shipments', icon: Truck },
      ],
    },
    {
      title: 'Oversight',
      items: [
        { label: 'QR Verification Logs', to: '/admin/verifications', icon: ScanLine },
        { label: 'Recall Supervision', to: '/admin/recalls', icon: ShieldAlert },
        { label: 'Compliance Monitoring', to: '/admin/compliance', icon: FileClock },
        { label: 'Audit Logs', to: '/admin/audit', icon: History },
      ],
    },
    {
      title: 'System',
      items: [
        { label: 'Reports', to: '/admin/reports', icon: FileBarChart },
        { label: 'System Settings', to: '/admin/settings', icon: Settings },
      ],
    },
  ],
};

// Shared footer links for every role's sidebar.
export const COMMON_NAV: NavItem[] = [
  { label: 'Notifications', to: '/notifications', icon: Bell },
  { label: 'Profile', to: '/profile', icon: User },
  { label: 'Settings', to: '/settings', icon: Settings },
  { label: 'Help & Support', to: '/help', icon: HelpCircle },
];
