import { BarChart3, Boxes, ChevronRight, Database, Layers, LogOut, PackageSearch, QrCode, Send, Warehouse, X } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import LogoutDialog from './LogoutDialog';
import { useLogoutDialog } from '../../hooks/useLogoutDialog';

interface SidebarProps {
  /** Closes the mobile drawer (no-op on desktop). */
  onClose?: () => void;
  /** Whether the mobile drawer variant is rendered. */
  isMobileOpen?: boolean;
}

const NAV_ITEMS = [
  { label: 'Live Tracking', icon: BarChart3, to: '/manufacturer/live-tracking' },
  { label: 'Tracking Dashboard', icon: Boxes, to: '/manufacturer/tracking-dashboard' },
  { label: 'Dashboard', icon: Layers, to: '/manufacturer/dashboard' },
  { label: 'Track Box', icon: PackageSearch, to: '/manufacturer/track-box' },
  { label: 'Data Entry', icon: Database, to: '/manufacturer/data-entry' },
  { label: 'Stock Maintenance', icon: Warehouse, to: '/manufacturer/stock-maintenance' },
  { label: 'Dispatch', icon: Send, to: '/manufacturer/dispatch' },
  { label: 'QR Generation', icon: QrCode, to: '/manufacturer/qr-generation' },
  { label: 'Batch Management', icon: Layers, to: '/manufacturer/batch-management' },
];

/** Left sidebar: manufacturer profile card + navigation. */
export default function Sidebar({ onClose, isMobileOpen = false }: SidebarProps) {
  const navigate = useNavigate();
  const { isOpen, open, close, confirm } = useLogoutDialog(() => {
    onClose?.();
    navigate('/login');
  });

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      <aside
        id="manufacturer-sidebar"
        aria-label="Sidebar navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-[280px] transform flex-col border-r border-slate-100 bg-white pt-16 shadow-lg transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:w-[360px] lg:translate-x-0 lg:pt-0 lg:shadow-none ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile drawer header */}
        <div className="flex items-center justify-between px-5 pb-2 pt-4 lg:hidden">
          <span className="text-sm font-semibold text-slate-500">Menu</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {/* Manufacturer profile/menu card */}
          <div className="mb-5 mt-4 flex items-center gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 p-4 shadow-sm">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm"
              aria-hidden="true"
            >
              <Boxes size={22} />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold text-slate-900">Manufacturer</p>
              <p className="text-sm text-slate-500">Menu</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1" aria-label="Manufacturer sections">
            {NAV_ITEMS.map(({ label, icon: Icon, to }) => (
              <NavLink
                key={label}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-indigo-50/60 hover:text-indigo-700'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="flex items-center gap-3">
                      <Icon size={18} strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
                      {label}
                    </span>
                    {isActive && <ChevronRight size={16} className="text-indigo-500" aria-hidden="true" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Logout */}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={open}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              <LogOut size={18} aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <LogoutDialog isOpen={isOpen} onClose={close} onConfirm={confirm} />
    </>
  );
}
