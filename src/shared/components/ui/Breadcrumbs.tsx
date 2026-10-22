import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface Crumb {
  label: string;
  to?: string;
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
      <Link to="/" className="rounded p-0.5 transition-colors hover:text-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600" aria-label="Home">
        <Home size={14} />
      </Link>
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight size={13} className="text-slate-300" aria-hidden="true" />
          {c.to && i < items.length - 1 ? (
            <Link to={c.to} className="rounded px-0.5 transition-colors hover:text-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
              {c.label}
            </Link>
          ) : (
            <span className="px-0.5 font-medium text-slate-700" aria-current="page">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
