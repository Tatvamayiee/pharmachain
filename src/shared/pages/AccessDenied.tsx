import { Link } from 'react-router-dom';
import { ArrowRight, ShieldX } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthContext';
import { ROLE_HOME, ROLE_LABEL } from '../data/demoAccounts';

export default function AccessDenied() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 shadow-sm">
        <ShieldX size={30} aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-2xl font-bold text-slate-900 sm:text-3xl">Access Denied</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
        Your account{user ? ` (${ROLE_LABEL[user.role]})` : ''} does not have permission to view this page.
        If you believe this is a mistake, contact your organization administrator.
      </p>
      {user && (
        <Link
          to={ROLE_HOME[user.role]}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Return to my dashboard <ArrowRight size={15} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
