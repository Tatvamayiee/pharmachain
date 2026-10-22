import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, LogOut, Bell, FileClock, BarChart3, Factory, Truck,
  Store, Package, User, ShieldCheck, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../platform/auth/auth';

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manufacturer', 'dealer', 'pharmacy', 'transport', 'patient'] },
  { to: '/notifications', label: 'Notifications', icon: Bell, roles: ['admin', 'manufacturer', 'dealer', 'pharmacy', 'transport', 'patient'] },
  { to: '/activity', label: 'Activity Log', icon: FileClock, roles: ['admin'] },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['admin', 'manufacturer', 'dealer', 'pharmacy'] },
];

const roleIcon: Record<string, LucideIcon> = {
  admin: ShieldCheck, manufacturer: Factory, dealer: Package, pharmacy: Store, transport: Truck, patient: User,
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const RoleIcon = roleIcon[user.role] ?? User;

  return (
    <nav className="sticky top-0 z-10 flex items-center gap-4 border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden">
          <img src="/logo.jpg" alt="PharmaChain Logo" className="w-full h-full object-contain" />
        </div>
        <span className="font-bold">PharmaChain</span>
      </div>
      <div className="ml-auto flex items-center gap-1">
        {items.filter(i => i.roles.includes(user.role)).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Icon size={16} /> {label}
          </NavLink>
        ))}
        <div className="ml-2 flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs">
          <RoleIcon size={14} /> {user.name} · {user.role}
        </div>
        <button onClick={() => { logout(); navigate('/login'); }}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
          <LogOut size={16} /> Log out
        </button>
      </div>
    </nav>
  );
}
