import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import AccessDenied from '../pages/shared/AccessDenied';
import NotFound from '../pages/shared/NotFound';
import Landing from '../pages/public/Landing';
import About from '../pages/public/About';
import Features from '../pages/public/Features';
import Contact from '../pages/public/Contact';
import Login from '../pages/public/Login';
import Register from '../pages/public/Register';
import ForgotPassword from '../pages/public/ForgotPassword';
import QRVerificationPage from '../pages/shared/QRVerificationPage';
import TransportTrackingPage from '../pages/shared/TransportTrackingPage';
import Notifications from '../pages/shared/Notifications';
import Profile from '../pages/shared/Profile';
import Settings from '../pages/shared/Settings';
import Help from '../pages/shared/Help';
import type { UserRole } from '../types';

// Dashboards
import ManufacturerDashboard from '../dashboards/ManufacturerDashboard';
import DistributorDashboard from '../dashboards/DistributorDashboard';
import DealerDashboard from '../dashboards/DealerDashboard';
import HospitalDashboard from '../dashboards/HospitalDashboard';
import CustomerDashboard from '../dashboards/CustomerDashboard';
import AdminDashboard from '../dashboards/AdminDashboard';

// Manufacturer pages
import DataEntry from '../pages/manufacturer/DataEntry';
import MedicineCatalog from '../pages/manufacturer/MedicineCatalog';
import BatchManagement from '../pages/manufacturer/BatchManagement';
import StockMaintenance from '../pages/manufacturer/StockMaintenance';
import QRGeneration from '../pages/manufacturer/QRGeneration';
import Dispatch from '../pages/manufacturer/Dispatch';
import LiveTracking from '../pages/manufacturer/LiveTracking';
import RecallManagement from '../pages/manufacturer/RecallManagement';
import ExpiryMonitoring from '../pages/manufacturer/ExpiryMonitoring';
import ReportsPage from '../pages/shared/ReportsPage';

// Distributor pages
import {
  IncomingShipments, Inventory, StockInward, StockOutward, DealerOrders, HospitalOrders,
  DistributorDispatch, DistributorTracking, DistributorReturns, ExpiryAlerts, DistributorReports,
} from '../pages/distributor/pages';

import DealerStock from '../pages/dealer/DealerStock';
import PharmacyBilling from '../pages/dealer/PharmacyBilling';
import { OrgRecallAlerts } from '../pages/shared/OrgRecallAlerts';

// Hospital pages
import {
  HospitalInventory, RequestMedicines, PurchaseOrders, ReceivedShipments, UsageRecords,
  Departments, HospitalExpiry, HospitalRecalls, HospitalReports,
} from '../pages/hospital/pages';

// Customer pages
import {
  ScanMedicineQR, VerifyMedicine, MyOrders, OrderTracking, SavedMedicines,
  CustomerRecalls, ReportMedicine, CustomerHelp,
} from '../pages/customer/pages';

// Admin pages
import {
  UserManagement, MedicineRegistry, BatchRegistry, ShipmentMonitoring, VerificationLogs,
  RecallSupervision, ComplianceMonitoring, AuditLogs, AdminReports, SystemSettings,
} from '../pages/admin/pages';

// Transporter (QR 2)
import TransporterDashboard from '../dashboards/TransporterDashboard';
import TransporterScanPage from '../pages/transporter/TransporterScanPage';

// Prescription prototype (dealer + hospital only)
import PrescriptionScannerPage from '../components/prescription/PrescriptionScannerPage';
import PrescriptionHistoryPage from '../components/prescription/PrescriptionHistoryPage';
import PrescriptionReviewPage from '../components/prescription/PrescriptionReviewPage';
import InteractionAlertsPage from '../components/prescription/InteractionAlertsPage';
import DispensingReviewPage from '../components/prescription/DispensingReviewPage';
import DosageReviewPage from '../components/prescription/DosageReviewPage';
import ApprovalQueuePage from '../components/prescription/ApprovalQueuePage';
import PrescriptionReportsPage from '../components/prescription/PrescriptionReportsPage';

/** QR 1 payload deep link: /verify/<batchNumber> → /verify?code=<batchNumber>. */
function VerifyDeepLink() {
  const { code } = useParams();
  return <Navigate to={`/verify?code=${encodeURIComponent(code || '')}`} replace />;
}

/** Single /verify route: dashboard chrome for signed-in users, public chrome
 *  for anonymous package scans (verification itself is server-side). */
function VerifyRouteLayout() {
  const { user, initializing } = useAuth();
  if (initializing) return null;
  return user ? <DashboardLayout /> : <PublicLayout />;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  if (initializing) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRole({ role, children }: { role: UserRole | UserRole[]; children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  if (initializing) return null;
  if (!user) return <Navigate to="/login" replace />;
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(user.role)) return <AccessDenied />;
  return <>{children}</>;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<PublicLayout />}>
        <Route index element={<Landing />} />
        <Route path="about" element={<About />} />
        <Route path="features" element={<Features />} />
        <Route path="contact" element={<Contact />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Public transport-tracking page (QR 2) — must be reachable directly
          from a phone camera scan, so it lives OUTSIDE the auth wall. */}
      <Route path="transport/:qrId" element={<TransportTrackingPage />} />

      {/* QR 1 payload deep link — the printed authentication QR encodes
          https://…/verify/<batchNumber>; a phone scan opens it directly, so
          this route must also live outside the auth wall. */}
      <Route path="verify/:code" element={<VerifyDeepLink />} />

      {/* Public /verify?code=… — the landing page for scanned QR 1 payloads.
          Anonymous visitors verify server-side (the endpoint is public);
          signed-in users get the same page inside the dashboard chrome. */}
      <Route path="verify" element={<VerifyRouteLayout />}>
        <Route index element={<QRVerificationPage />} />
      </Route>

      {/* Authenticated (any role) */}
      <Route element={<RequireAuth><DashboardLayout /></RequireAuth>}>
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="help" element={<Help />} />
      </Route>

      {/* Manufacturer */}
      <Route path="manufacturer" element={<RequireRole role="manufacturer"><DashboardLayout /></RequireRole>}>
        <Route index element={<ManufacturerDashboard />} />
        <Route path="data-entry" element={<DataEntry />} />
        <Route path="medicines" element={<MedicineCatalog />} />
        <Route path="batches" element={<BatchManagement />} />
        <Route path="stock" element={<StockMaintenance />} />
        <Route path="qr" element={<QRGeneration />} />
        <Route path="dispatch" element={<Dispatch />} />
        <Route path="tracking" element={<LiveTracking />} />
        <Route path="recalls" element={<RecallManagement />} />
        <Route path="expiry" element={<ExpiryMonitoring />} />
        <Route path="reports" element={<ReportsPage crumbs={[{ label: 'Manufacturer' }, { label: 'Reports' }]} />} />
        <Route path="*" element={<AccessDenied />} />
      </Route>

      {/* Distributor */}
      <Route path="distributor" element={<RequireRole role="distributor"><DashboardLayout /></RequireRole>}>
        <Route index element={<DistributorDashboard />} />
        <Route path="incoming" element={<IncomingShipments />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="stock-inward" element={<StockInward />} />
        <Route path="stock-outward" element={<StockOutward />} />
        <Route path="dealer-orders" element={<DealerOrders />} />
        <Route path="hospital-orders" element={<HospitalOrders />} />
        <Route path="dispatch" element={<DistributorDispatch />} />
        <Route path="tracking" element={<DistributorTracking />} />
        <Route path="verify" element={<QRVerificationPage />} />
        <Route path="returns" element={<DistributorReturns />} />
        <Route path="expiry" element={<ExpiryAlerts />} />
        <Route path="reports" element={<DistributorReports />} />
        <Route path="*" element={<AccessDenied />} />
      </Route>

      {/* Dealer (pharmacy) — restored: real stock from /api/inventory, the
          shared prescription pipeline, QR verification, and honest
          "coming soon" placeholders for tools not yet built. */}
      <Route path="dealer" element={<RequireRole role="dealer"><DashboardLayout /></RequireRole>}>
        <Route index element={<DealerDashboard />} />
        <Route path="stock" element={<DealerStock />} />
        <Route path="billing" element={<PharmacyBilling />} />
        <Route path="recalls" element={<OrgRecallAlerts role="dealer" />} />
        <Route path="prescriptions/scan" element={<PrescriptionScannerPage role="dealer" />} />
        <Route path="prescriptions" element={<PrescriptionHistoryPage role="dealer" />} />
        <Route path="prescriptions/review" element={<PrescriptionReviewPage role="dealer" />} />
        <Route path="prescriptions/alerts" element={<InteractionAlertsPage role="dealer" />} />
        <Route path="prescriptions/dispensing" element={<DispensingReviewPage />} />
        <Route path="prescriptions/approval-queue" element={<ApprovalQueuePage role="dealer" />} />
        <Route path="prescriptions/reports" element={<PrescriptionReportsPage role="dealer" />} />
        <Route path="verify" element={<QRVerificationPage />} />
        <Route path="*" element={<AccessDenied />} />
      </Route>

      {/* Hospital */}
      <Route path="hospital" element={<RequireRole role="hospital"><DashboardLayout /></RequireRole>}>
        <Route index element={<HospitalDashboard />} />
        <Route path="inventory" element={<HospitalInventory />} />
        <Route path="request" element={<RequestMedicines />} />
        <Route path="orders" element={<PurchaseOrders />} />
        <Route path="received" element={<ReceivedShipments />} />
        <Route path="verify" element={<QRVerificationPage />} />
        <Route path="usage" element={<UsageRecords />} />
        <Route path="expiry" element={<HospitalExpiry />} />
        <Route path="recalls" element={<HospitalRecalls />} />
        <Route path="departments" element={<Departments />} />
        <Route path="reports" element={<HospitalReports />} />
        <Route path="prescriptions/scan" element={<PrescriptionScannerPage role="hospital" />} />
        <Route path="prescriptions" element={<PrescriptionHistoryPage role="hospital" />} />
        <Route path="prescriptions/review" element={<PrescriptionReviewPage role="hospital" />} />
        <Route path="prescriptions/alerts" element={<InteractionAlertsPage role="hospital" />} />
        <Route path="prescriptions/dosage" element={<DosageReviewPage />} />
        <Route path="prescriptions/approval-queue" element={<ApprovalQueuePage role="hospital" />} />
        <Route path="prescriptions/reports" element={<PrescriptionReportsPage role="hospital" />} />
        <Route path="*" element={<AccessDenied />} />
      </Route>

      {/* Transporter (QR 2) — scan-and-update shipments */}
      <Route path="transporter" element={<RequireRole role="transport"><DashboardLayout /></RequireRole>}>
        <Route index element={<TransporterDashboard />} />
        <Route path="scan" element={<TransporterScanPage />} />
        <Route path="*" element={<AccessDenied />} />
      </Route>

      {/* Customer */}
      <Route path="customer" element={<RequireRole role="customer"><DashboardLayout /></RequireRole>}>
        <Route index element={<CustomerDashboard />} />
        <Route path="scan" element={<ScanMedicineQR />} />
        <Route path="verify" element={<VerifyMedicine />} />
        <Route path="orders" element={<MyOrders />} />
        <Route path="tracking" element={<OrderTracking />} />
        <Route path="saved" element={<SavedMedicines />} />
        <Route path="recalls" element={<CustomerRecalls />} />
        <Route path="report" element={<ReportMedicine />} />
        <Route path="help" element={<CustomerHelp />} />
        <Route path="*" element={<AccessDenied />} />
      </Route>

      {/* Admin */}
      <Route path="admin" element={<RequireRole role="admin"><DashboardLayout /></RequireRole>}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="medicines" element={<MedicineRegistry />} />
        <Route path="batches" element={<BatchRegistry />} />
        <Route path="shipments" element={<ShipmentMonitoring />} />
        <Route path="verifications" element={<VerificationLogs />} />
        <Route path="recalls" element={<RecallSupervision />} />
        <Route path="compliance" element={<ComplianceMonitoring />} />
        <Route path="audit" element={<AuditLogs />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="settings" element={<SystemSettings />} />
        <Route path="*" element={<AccessDenied />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
