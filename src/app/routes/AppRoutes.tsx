import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import PublicLayout from '../../shared/layouts/PublicLayout';
import DashboardLayout from '../../shared/layouts/DashboardLayout';
import { useAuth } from '../providers/AuthContext';
import AccessDenied from '../../shared/pages/AccessDenied';
import NotFound from '../../shared/pages/NotFound';
import type { UserRole } from '../../shared/types';

const Landing = lazy(() => import('../../features/public/pages/Landing'));
const About = lazy(() => import('../../features/public/pages/About'));
const Features = lazy(() => import('../../features/public/pages/Features'));
const Contact = lazy(() => import('../../features/public/pages/Contact'));
const Login = lazy(() => import('../../features/public/pages/Login'));
const Register = lazy(() => import('../../features/public/pages/Register'));
const ForgotPassword = lazy(() => import('../../features/public/pages/ForgotPassword'));
const QRVerificationPage = lazy(() => import('../../shared/pages/QRVerificationPage'));
const TransportTrackingPage = lazy(() => import('../../shared/pages/TransportTrackingPage'));
const Notifications = lazy(() => import('../../shared/pages/Notifications'));
const Profile = lazy(() => import('../../shared/pages/Profile'));
const Settings = lazy(() => import('../../shared/pages/Settings'));
const Help = lazy(() => import('../../shared/pages/Help'));

const ManufacturerDashboard = lazy(() => import('../../features/manufacturer/dashboard/ManufacturerDashboard'));
const DistributorDashboard = lazy(() => import('../../features/distributor/dashboard/DistributorDashboard'));
const DealerDashboard = lazy(() => import('../../features/dealer/dashboard/DealerDashboard'));
const HospitalDashboard = lazy(() => import('../../features/hospital/dashboard/HospitalDashboard'));
const CustomerDashboard = lazy(() => import('../../features/customer/dashboard/CustomerDashboard'));
const AdminDashboard = lazy(() => import('../../features/admin/dashboard/AdminDashboard'));

const DataEntry = lazy(() => import('../../features/manufacturer/pages/DataEntry'));
const MedicineCatalog = lazy(() => import('../../features/manufacturer/pages/MedicineCatalog'));
const BatchManagement = lazy(() => import('../../features/manufacturer/pages/BatchManagement'));
const StockMaintenance = lazy(() => import('../../features/manufacturer/pages/StockMaintenance'));
const QRGeneration = lazy(() => import('../../features/manufacturer/pages/QRGeneration'));
const Dispatch = lazy(() => import('../../features/manufacturer/pages/Dispatch'));
const LiveTracking = lazy(() => import('../../features/manufacturer/pages/LiveTracking'));
const RecallManagement = lazy(() => import('../../features/manufacturer/pages/RecallManagement'));
const ExpiryMonitoring = lazy(() => import('../../features/manufacturer/pages/ExpiryMonitoring'));
const ReportsPage = lazy(() => import('../../shared/pages/ReportsPage'));

const IncomingShipments = lazy(() => import('../../features/distributor/pages/pages').then((m) => ({ default: m.IncomingShipments })));
const Inventory = lazy(() => import('../../features/distributor/pages/pages').then((m) => ({ default: m.Inventory })));
const StockInward = lazy(() => import('../../features/distributor/pages/pages').then((m) => ({ default: m.StockInward })));
const StockOutward = lazy(() => import('../../features/distributor/pages/pages').then((m) => ({ default: m.StockOutward })));
const DealerOrders = lazy(() => import('../../features/distributor/pages/pages').then((m) => ({ default: m.DealerOrders })));
const HospitalOrders = lazy(() => import('../../features/distributor/pages/pages').then((m) => ({ default: m.HospitalOrders })));
const DistributorDispatch = lazy(() => import('../../features/distributor/pages/pages').then((m) => ({ default: m.DistributorDispatch })));
const DistributorTracking = lazy(() => import('../../features/distributor/pages/pages').then((m) => ({ default: m.DistributorTracking })));
const DistributorReturns = lazy(() => import('../../features/distributor/pages/pages').then((m) => ({ default: m.DistributorReturns })));
const ExpiryAlerts = lazy(() => import('../../features/distributor/pages/pages').then((m) => ({ default: m.ExpiryAlerts })));
const DistributorReports = lazy(() => import('../../features/distributor/pages/pages').then((m) => ({ default: m.DistributorReports })));

const DealerStock = lazy(() => import('../../features/dealer/pages/DealerStock'));
const PharmacyBilling = lazy(() => import('../../features/dealer/pages/PharmacyBilling'));
const OrgRecallAlerts = lazy(() => import('../../shared/pages/OrgRecallAlerts').then((m) => ({ default: m.OrgRecallAlerts })));

const HospitalInventory = lazy(() => import('../../features/hospital/pages/pages').then((m) => ({ default: m.HospitalInventory })));
const RequestMedicines = lazy(() => import('../../features/hospital/pages/pages').then((m) => ({ default: m.RequestMedicines })));
const ReceivedShipments = lazy(() => import('../../features/hospital/pages/pages').then((m) => ({ default: m.ReceivedShipments })));
const UsageRecords = lazy(() => import('../../features/hospital/pages/pages').then((m) => ({ default: m.UsageRecords })));
const Departments = lazy(() => import('../../features/hospital/pages/pages').then((m) => ({ default: m.Departments })));
const HospitalExpiry = lazy(() => import('../../features/hospital/pages/pages').then((m) => ({ default: m.HospitalExpiry })));
const HospitalRecalls = lazy(() => import('../../features/hospital/pages/pages').then((m) => ({ default: m.HospitalRecalls })));
const HospitalReports = lazy(() => import('../../features/hospital/pages/pages').then((m) => ({ default: m.HospitalReports })));

const ScanMedicineQR = lazy(() => import('../../features/customer/pages/pages').then((m) => ({ default: m.ScanMedicineQR })));
const VerifyMedicine = lazy(() => import('../../features/customer/pages/pages').then((m) => ({ default: m.VerifyMedicine })));
const MyOrders = lazy(() => import('../../features/customer/pages/pages').then((m) => ({ default: m.MyOrders })));
const OrderTracking = lazy(() => import('../../features/customer/pages/pages').then((m) => ({ default: m.OrderTracking })));
const SavedMedicines = lazy(() => import('../../features/customer/pages/pages').then((m) => ({ default: m.SavedMedicines })));
const CustomerRecalls = lazy(() => import('../../features/customer/pages/pages').then((m) => ({ default: m.CustomerRecalls })));
const ReportMedicine = lazy(() => import('../../features/customer/pages/pages').then((m) => ({ default: m.ReportMedicine })));
const CustomerHelp = lazy(() => import('../../features/customer/pages/pages').then((m) => ({ default: m.CustomerHelp })));

const UserManagement = lazy(() => import('../../features/admin/pages/pages').then((m) => ({ default: m.UserManagement })));
const MedicineRegistry = lazy(() => import('../../features/admin/pages/pages').then((m) => ({ default: m.MedicineRegistry })));
const BatchRegistry = lazy(() => import('../../features/admin/pages/pages').then((m) => ({ default: m.BatchRegistry })));
const ShipmentMonitoring = lazy(() => import('../../features/admin/pages/pages').then((m) => ({ default: m.ShipmentMonitoring })));
const VerificationLogs = lazy(() => import('../../features/admin/pages/pages').then((m) => ({ default: m.VerificationLogs })));
const RecallSupervision = lazy(() => import('../../features/admin/pages/pages').then((m) => ({ default: m.RecallSupervision })));
const ComplianceMonitoring = lazy(() => import('../../features/admin/pages/pages').then((m) => ({ default: m.ComplianceMonitoring })));
const AuditLogs = lazy(() => import('../../features/admin/pages/pages').then((m) => ({ default: m.AuditLogs })));
const AdminReports = lazy(() => import('../../features/admin/pages/pages').then((m) => ({ default: m.AdminReports })));
const SystemSettings = lazy(() => import('../../features/admin/pages/pages').then((m) => ({ default: m.SystemSettings })));

const TransporterDashboard = lazy(() => import('../../features/transport/dashboard/TransporterDashboard'));
const TransporterScanPage = lazy(() => import('../../features/transport/pages/TransporterScanPage'));
const PrescriptionScannerPage = lazy(() => import('../../features/prescription/components/PrescriptionScannerPage'));
const PrescriptionHistoryPage = lazy(() => import('../../features/prescription/components/PrescriptionHistoryPage'));
const PrescriptionReviewPage = lazy(() => import('../../features/prescription/components/PrescriptionReviewPage'));
const InteractionAlertsPage = lazy(() => import('../../features/prescription/components/InteractionAlertsPage'));
const DispensingReviewPage = lazy(() => import('../../features/prescription/components/DispensingReviewPage'));
const DosageReviewPage = lazy(() => import('../../features/prescription/components/DosageReviewPage'));
const ApprovalQueuePage = lazy(() => import('../../features/prescription/components/ApprovalQueuePage'));
const PrescriptionReportsPage = lazy(() => import('../../features/prescription/components/PrescriptionReportsPage'));
const ProcurementOrdersPage = lazy(() => import('../../features/procurement/ProcurementOrdersPage'));

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
    <Suspense fallback={<div className="p-6 text-sm text-slate-500" role="status" aria-live="polite">Loading page...</div>}>
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
        <Route path="orders" element={<ProcurementOrdersPage mode="manufacturer" />} />
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
        <Route path="orders" element={<ProcurementOrdersPage mode="buyer" />} />
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
        <Route path="orders" element={<ProcurementOrdersPage mode="buyer" />} />
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
    </Suspense>
  );
}
