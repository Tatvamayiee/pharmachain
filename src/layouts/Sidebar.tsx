import { useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, X } from 'lucide-react';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABEL } from '../data/demoAccounts';
import { useLogoutDialog } from '../components/hooks/useLogoutDialog';
import { COMMON_NAV, ROLE_NAV, type NavItem } from '../routes/navigation';

interface SidebarProps {
  isMobileOpen: boolean;
  onClose: () => void;
}

function NavButton({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) => {
        const active = isActive || (item.match ? location.pathname.startsWith(item.match) : false);
        return `group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
          active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-indigo-50/60 hover:text-indigo-700'
        }`;
      }}
    >
      {({ isActive }) => {
        const active = isActive || (item.match ? location.pathname.startsWith(item.match) : false);
        return (
          <>
            <span className="flex items-center gap-3">
              <Icon size={18} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
              {item.label}
            </span>
            {active && <ChevronRight size={15} className="text-indigo-500" aria-hidden="true" />}
          </>
        );
      }}
    </NavLink>
  );
}

export default function Sidebar({ isMobileOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { isOpen, open, close, confirm } = useLogoutDialog(() => {
    logout();
    onClose();
    navigate('/login');
  });

  // Keep the nav list anchored to its top when the route changes, matching
  // the main content — otherwise the sidebar stays mid-scroll from the
  // previous page.
  // Hooks must run unconditionally (before any early return) to respect the
  // Rules of Hooks — conditional rendering is handled below instead.
  const navScrollRef = useRef<HTMLDivElement | null>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    navScrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  if (!user) return null;
  const sections = ROLE_NAV[user.role];

  return (
    <>
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden" aria-hidden="true" onClick={onClose} />
      )}

      <aside
        id="app-sidebar"
        aria-label={`${ROLE_LABEL[user.role]} navigation`}
        className={`fixed inset-y-0 left-0 z-40 flex w-[280px] transform flex-col border-r border-slate-100 bg-white pt-16 transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-[300px] lg:translate-x-0 lg:pt-0 xl:w-[320px] ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4 lg:hidden">
          <span className="text-sm font-semibold text-slate-500">Menu</span>
          <button
            type="button" onClick={onClose} aria-label="Close navigation menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <X size={18} />
          </button>
        </div>

        <div ref={navScrollRef} className="flex-1 overflow-y-auto px-4 pb-6">
          {/* Role profile card */}
          <div className="mb-5 mt-4 flex items-center gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 p-4 shadow-sm">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-lg font-bold text-white shadow-sm" aria-hidden="true">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold text-slate-900">{ROLE_LABEL[user.role]}</p>
              <p className="truncate text-xs text-slate-500">{user.organization}</p>
            </div>
          </div>

          <nav className="space-y-5" aria-label={`${ROLE_LABEL[user.role]} sections`}>
            {sections.map((section, si) => (
              <div key={si} className="space-y-1">
                {section.title && (
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.title}</p>
                )}
                {section.items.map((item) => (
                  <NavButton key={item.to} item={item} onNavigate={onClose} />
                ))}
              </div>
            ))}
            <div className="space-y-1 border-t border-slate-100 pt-4">
              {COMMON_NAV.map((item) => (
                <NavButton key={item.to} item={item} onNavigate={onClose} />
              ))}
            </div>
          </nav>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <button
              type="button" onClick={open}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              <LogOut size={18} aria-hidden="true" /> Logout
            </button>
          </div>
        </div>
      </aside>

      <ConfirmDialog
        isOpen={isOpen} title="Confirm logout" tone="primary"
        message="Log out of PharmaChain? Any unsaved changes will be lost."
        confirmLabel="Logout" onConfirm={confirm} onCancel={close}
      />
    </>
  );
}
