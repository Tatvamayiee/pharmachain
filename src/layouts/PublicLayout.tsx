import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import AppLogo from '../components/ui/AppLogo';

const LINKS = [
  { to: '/about', label: 'About' },
  { to: '/features', label: 'Features' },
  { to: '/contact', label: 'Contact' },
];

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F8FF]">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <AppLogo />
          <nav aria-label="Public navigation" className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <Link
                key={l.to} to={l.to}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                  location.pathname.startsWith(l.to) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/login"
              className="ml-2 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Login <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link
              to="/register"
              className="ml-2 inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition-all hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Register
            </Link>
          </nav>
          <button
            type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 md:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {open && (
          <nav aria-label="Mobile navigation" className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700">
                {l.label}
              </Link>
            ))}
            <Link to="/login" onClick={() => setOpen(false)}
              className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white">
              Login <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link to="/register" onClick={() => setOpen(false)}
              className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700">
              Register
            </Link>
          </nav>
        )}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:px-6">
          <AppLogo size="sm" />
          <p>Secure pharmaceutical supply-chain traceability</p>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} PharmaChain</p>
        </div>
      </footer>
    </div>
  );
}
