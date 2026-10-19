import {
  Activity, AlertTriangle, Boxes, Building2, Database, FileBarChart, Factory, History,
  Cross, Map, QrCode, ShieldAlert, ShoppingBag, Truck, User, Users,
} from 'lucide-react';

const GROUPS = [
  {
    title: 'For Manufacturers',
    icon: Factory,
    items: ['Medicine catalog & data entry', 'Batch lifecycle management', 'Stock inward/outward & reorder levels', 'QR generation with download & print', 'Dispatch planning & live tracking', 'Recall initiation with severity', 'Expiry monitoring & reports'],
  },
  {
    title: 'For Distributors',
    icon: Truck,
    items: ['Incoming shipment acceptance', 'Warehouse inventory control', 'Dealer & hospital order processing', 'Outbound dispatch management', 'Returns & damaged stock records', 'Expiry alerts before rotation risk'],
  },
  {
    title: 'For Dealers & Pharmacies',
    icon: ShoppingBag,
    items: ['Available stock with QR status', 'Sales recording & history', 'Customer order management', 'Expiry & recall alerting', 'Verification of every received batch'],
  },
  {
    title: 'For Hospitals',
    icon: Cross,
    items: ['Ward-level medicine inventory', 'Priority medicine requests', 'Department usage records', 'Received shipment verification', 'Expiry & recall surveillance'],
  },
  {
    title: 'For Customers',
    icon: User,
    items: ['Scan or type a batch number', 'Authenticity verdict in seconds', 'Full supply-chain journey view', 'Order tracking & saved medicines', 'Report suspicious products'],
  },
  {
    title: 'For Regulators',
    icon: Users,
    items: ['Ecosystem-wide dashboards', 'User & organization approvals', 'Batch & medicine registries', 'QR verification logs', 'Recall supervision & audit trail'],
  },
];

const PLATFORM = [
  { icon: Boxes, label: 'Batch-level traceability' },
  { icon: QrCode, label: 'Instant QR verification' },
  { icon: Map, label: 'Shipment tracking' },
  { icon: AlertTriangle, label: 'Expiry alerts' },
  { icon: ShieldAlert, label: 'Recall management' },
  { icon: History, label: 'Immutable audit logs' },
  { icon: Database, label: 'API-ready architecture' },
  { icon: FileBarChart, label: 'Exportable reports' },
  { icon: Activity, label: 'Role-based analytics' },
  { icon: Building2, label: 'Multi-org governance' },
];

export default function Features() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Features</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
        Everything the supply chain needs
      </h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Each role gets a purpose-built workspace. Here is what is inside PharmaChain for every
        participant — and the platform capabilities underneath them all.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GROUPS.map((g) => (
          <article key={g.title} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white" aria-hidden="true">
                <g.icon size={18} />
              </span>
              <h2 className="font-semibold text-slate-900">{g.title}</h2>
            </div>
            <ul className="mt-4 space-y-2">
              {g.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <section aria-label="Platform capabilities" className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">Platform-wide</h2>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {PLATFORM.map((p) => (
            <span key={p.label} className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
              <p.icon size={15} className="text-indigo-600" aria-hidden="true" /> {p.label}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
