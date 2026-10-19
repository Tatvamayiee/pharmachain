import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_HOME } from '../../data/demoAccounts';

export default function NotFound() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <p className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-7xl font-extrabold tracking-tight text-transparent" aria-hidden="true">
        404
      </p>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-3 max-w-md text-sm text-slate-500">
        The page you're looking for doesn't exist or may have been moved. Use the links below to find your way.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Home
        </Link>
        {user && (
          <Link
            to={ROLE_HOME[user.role]}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <Compass size={15} aria-hidden="true" /> My dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
