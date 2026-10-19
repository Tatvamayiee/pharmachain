import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, QrCode, PackageSearch, ScanBarcode, PlusCircle, LogOut,
} from 'lucide-react';
import { useAuth } from '../lib/auth';

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manufacturer', 'distributor', 'transport', 'pharmacy'] },
  { to: '/create-shipment', label: 'Create Shipment', icon: PlusCircle, roles: ['admin', 'manufacturer', 'distributor'] },
  { to: '/scan', label: 'Scan QR', icon: QrCode, roles: ['admin', 'manufacturer', 'distributor', 'transport', 'pharmacy'] },
  { to: '/track', label: 'Track Box', icon: PackageSearch, roles: ['admin', 'manufacturer', 'distributor', 'transport', 'pharmacy'] },
  { to: '/shipment-scan', label: 'Shipment Scan', icon: ScanBarcode, roles: ['admin', 'transport', 'pharmacy', 'distributor', 'manufacturer'] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white min-h-screen p-4 flex-col">
      <div className="flex items-center gap-2 px-2 py-4">
        <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">P</div>
        <span className="font-bold text-lg">PharmaChain</span>
      </div>
      <nav className="flex-1 space-y-1">
        {items.filter(i => i.roles.includes(user.role)).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <Icon size={18} /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 pt-3">
        <div className="px-3 text-xs text-slate-500">{user.name} · {user.role}</div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          <LogOut size={18} /> Log out
        </button>
      </div>
    </aside>
  );
}
