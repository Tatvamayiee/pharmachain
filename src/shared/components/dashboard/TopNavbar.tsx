import { Bell, LogOut, Menu, ScanLine, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LogoutDialog from './LogoutDialog';
import { useLogoutDialog } from '../../hooks/useLogoutDialog';

interface TopNavbarProps {
  /** Opens the mobile sidebar drawer (only visible below lg). */
  onMenuClick: () => void;
  /** Opens the QR scanner modal. */
  onScanClick?: () => void;
}

/** Fixed top navigation bar for the manufacturer dashboard. */
export default function TopNavbar({ onMenuClick, onScanClick }: TopNavbarProps) {
  const navigate = useNavigate();
  const { isOpen, open, close, confirm } = useLogoutDialog(() => navigate('/login'));

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <nav aria-label="Main navigation" className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={onMenuClick}
              aria-label="Open navigation menu"
              aria-controls="manufacturer-sidebar"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors duration-150 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 lg:hidden"
            >
              <Menu size={20} />
            </button>

          {/* Logo */}
          <a href="#main" className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
            <img
              src="/logo.jpg"
              alt="PharmaChain Logo"
              className="h-9 w-9 rounded-lg object-contain"
              aria-hidden="true"
            />
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-lg font-bold text-transparent">
              PharmaChain
            </span>
          </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Scan QR */}
            <button
              type="button"
              onClick={onScanClick ?? (() => navigate('/manufacturer/scan'))}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:opacity-90 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-95 sm:px-4"
            >
              <ScanLine size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Scan QR</span>
              <span className="sr-only sm:hidden">Scan QR</span>
            </button>

            {/* Notifications */}
            <button
              type="button"
              aria-label="View notifications"
              onClick={() => navigate('/manufacturer/notifications')}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              <Bell size={18} />
              <span className="absolute right-[4.2rem] top-4 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" aria-hidden="true" />
            </button>

            <span className="mx-1 h-7 w-px bg-slate-200" aria-hidden="true" />

            {/* User */}
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white"
                aria-hidden="true"
              >
                <User size={18} />
              </span>
              <div className="hidden leading-tight md:block">
                <p className="text-sm font-semibold text-slate-800">tatva manufacturer</p>
                <p className="text-xs text-slate-500">Manufacturer</p>
              </div>
            </div>

            <span className="mx-1 hidden h-7 w-px bg-slate-200 sm:block" aria-hidden="true" />

            {/* Logout */}
            <button
              type="button"
              onClick={open}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              <LogOut size={16} aria-hidden="true" />
              <span className="hidden lg:inline">Logout</span>
              <span className="sr-only sm:hidden">Logout</span>
            </button>
          </div>
        </nav>
      </header>
      <LogoutDialog isOpen={isOpen} onClose={close} onConfirm={confirm} />
    </>
  );
}
