import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';

export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; label?: string;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}

export function FilterDropdown({ value, onChange, options, label }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="hidden text-slate-500 sm:inline">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Pagination({ page, totalPages, onPage, total, unit = 'records' }: {
  page: number; totalPages: number; onPage: (p: number) => void; total?: number; unit?: string;
}) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-3">
      <p className="text-xs text-slate-500">
        Page {page} of {totalPages}{total !== undefined ? ` · ${total} ${unit}` : ''}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button" onClick={() => onPage(page - 1)} disabled={page <= 1}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={15} />
        </button>
        <button
          type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages}
          aria-label="Next page"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </nav>
  );
}

export function ExportButton({ onExport, label = 'Export CSV' }: { onExport: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onExport}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
    >
      <Download size={15} aria-hidden="true" /> {label}
    </button>
  );
}
