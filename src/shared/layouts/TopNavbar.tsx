import { Bell, LogOut, Menu, ScanLine, Search } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AppLogo from '../components/ui/AppLogo';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuth } from '../../app/providers/AuthContext';
import { ROLE_LABEL } from '../data/demoAccounts';
import { useLogoutDialog } from '../hooks/useLogoutDialog';
import type { NavItem } from '../../app/routes/navigation';

interface TopNavbarProps {
  onMenuClick: () => void;
  onScanClick: () => void;
  navSections?: { items: NavItem[] }[];
}

function pageTitle(pathname: string, sections?: { items: NavItem[] }[]): string | null {
  if (sections) {
    for (const s of sections) {
      for (const item of s.items) {
        if (item.end ? pathname === item.to : pathname.startsWith(item.to)) return item.label;
      }
    }
  }
  const shared: Record<string, string> = {
    '/notifications': 'Notifications', '/profile': 'Profile', '/settings': 'Settings', '/help': 'Help & Support',
    '/verify': 'QR Verification',
  };
  return shared[pathname] ?? null;
}

export default function TopNavbar({ onMenuClick, onScanClick, navSections }: TopNavbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen, open, close, confirm } = useLogoutDialog(() => {
    logout();
    navigate('/login');
  });
  const title = pageTitle(location.pathname, navSections);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <button
              type="button" onClick={onMenuClick} aria-label="Open navigation menu" aria-controls="app-sidebar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <AppLogo to="/" size="sm" />
            {title && (
              <span className="hidden min-w-0 items-center gap-2 border-l border-slate-200 pl-4 text-sm font-medium text-slate-600 md:flex">
                <span className="truncate">{title}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button" aria-label="Global search" onClick={() => navigate('/verify')}
              className="hidden h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 sm:flex"
            >
              <Search size={17} />
            </button>

            <button
              type="button" onClick={onScanClick}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:opacity-90 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-95"
            >
              <ScanLine size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Scan QR</span>
              <span className="sr-only sm:hidden">Scan QR</span>
            </button>

            <Link
              to="/notifications" aria-label={`Notifications${title === 'Notifications' ? ', current page' : ''}`}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              <Bell size={18} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" aria-hidden="true" />
            </Link>

            <span className="mx-0.5 h-7 w-px bg-slate-200" aria-hidden="true" />

            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-semibold text-white" aria-hidden="true">
                {user?.name?.charAt(0).toUpperCase() ?? 'U'}
              </span>
              <div className="hidden leading-tight lg:block">
                <p className="max-w-40 truncate text-sm font-semibold text-slate-800">{user?.name}</p>
                <p className="text-xs text-slate-500">{user ? ROLE_LABEL[user.role] : ''}</p>
              </div>
            </div>

            <span className="mx-0.5 hidden h-7 w-px bg-slate-200 md:block" aria-hidden="true" />

            <button
              type="button" onClick={open}
              className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              <LogOut size={16} aria-hidden="true" />
              <span className="hidden xl:inline">Logout</span>
              <span className="sr-only md:not-sr-only md:hidden">Logout</span>
            </button>
          </div>
        </div>
      </header>
      <ConfirmDialog
        isOpen={isOpen} title="Confirm logout" tone="primary"
        message={`Log out of PharmaChain, ${user?.name ?? ''}? Any unsaved changes will be lost.`}
        confirmLabel="Logout" onConfirm={confirm} onCancel={close}
      />
    </>
  );
}
