import { useMemo, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export interface Column<T> {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  className?: string;
  /** Mobile card line: include this column's value in the card subtitle. */
  hideOnMobile?: boolean;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sortKey?: keyof T | null;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: keyof T) => void;
  loading?: boolean;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  skeletonRows?: number;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns, rows, rowKey, sortKey, sortDir, onSort,
  loading = false, emptyMessage = 'No records found', emptyAction, skeletonRows = 5,
}: DataTableProps<T>) {
  const mobilePrimary = useMemo(() => columns.find((c) => !c.hideOnMobile) ?? columns[0], [columns]);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm" role="status" aria-label="Loading table">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>{columns.map((c) => <th key={c.key} className="px-4 py-3">{c.header}</th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={i} className="border-t border-slate-100">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3.5"><div className="h-3.5 w-full max-w-32 animate-pulse rounded bg-slate-100" /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <span className="sr-only">Loading data…</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
        <p className="text-sm font-medium text-slate-600">{emptyMessage}</p>
        {emptyAction}
      </div>
    );
  }

  const cell = (c: Column<T>, row: T) =>
    c.render ? c.render(row) : String(row[c.key] ?? '—');

  return (
    <>
      {/* Desktop / tablet: full table */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={`px-4 py-3 ${c.className ?? ''}`} aria-sort={sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {c.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(c.key as keyof T)}
                        className="inline-flex items-center gap-1 rounded transition-colors hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                      >
                        {c.header}
                        {sortKey === c.key
                          ? (sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)
                          : <ArrowUpDown size={13} className="text-slate-300" />}
                      </button>
                    ) : c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)} className="border-t border-slate-100 transition-colors duration-150 hover:bg-indigo-50/40">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3.5 align-middle ${c.className ?? ''}`}>
                      {cell(c, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: stacked cards */}
      <div className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <div key={rowKey(row)} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">{String(row[mobilePrimary.key] ?? '—')}</p>
            </div>
            <dl className="mt-2 space-y-1.5">
              {columns.filter((c) => c.key !== mobilePrimary.key).map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-3 text-sm">
                  <dt className="shrink-0 text-xs text-slate-400">{c.header}</dt>
                  <dd className="text-right text-slate-700">{cell(c, row)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
