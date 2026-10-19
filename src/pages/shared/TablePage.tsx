import { useMemo, useState, type ReactNode } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { SearchInput, FilterDropdown, ExportButton, Pagination } from '../../components/ui/inputs';
import { ErrorState } from '../../components/ui/states';
import { useFetch } from '../../hooks/useFetch';
import { useTableControls } from '../../hooks/useSearchSort';
import { exportCsv } from '../../services/exportService';

export interface TablePageProps<T extends Record<string, unknown>, TRaw = unknown> {
  title: string;
  subtitle: string;
  crumbs: { label: string; to?: string }[];
  load: () => Promise<TRaw[]>;
  buildRows: (data: TRaw[]) => T[];
  columns: Column<T>[];
  searchFields: (keyof T)[];
  filters?: { label: string; field: keyof T; options: { value: string; label: string }[] }[];
  headerActions?: ReactNode;
  emptyMessage?: string;
  csvName?: string;
  csvHeaders?: string[];
  belowTable?: ReactNode;
  pageSize?: number;
}

/**
 * Shared scaffolding for list pages: search, filters, sortable table,
 * pagination, export and empty/error states in one consistent layout.
 */
export default function TablePage<T extends Record<string, unknown>, TRaw = unknown>({
  title, subtitle, crumbs, load, buildRows, columns, searchFields,
  filters, headerActions, emptyMessage, csvName, csvHeaders, belowTable, pageSize = 8,
}: TablePageProps<T, TRaw>) {
  const q = useFetch<TRaw[]>(load);
  const [filterVals, setFilterVals] = useState<Record<string, string>>({});

  const rows = useMemo(() => (q.data ? (buildRows(q.data) as T[]) : []), [q.data, buildRows]);

  const filtered = useMemo(() => {
    let out = rows;
    for (const f of filters ?? []) {
      const v = filterVals[f.field as string];
      if (v && v !== 'all') out = out.filter((r) => String(r[f.field]) === v);
    }
    return out;
  }, [rows, filters, filterVals]);

  const tc = useTableControls<T>(filtered, searchFields, pageSize);

  if (q.error && !q.loading) return <ErrorState message={q.error} onRetry={q.retry} />;

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        crumbs={crumbs}
        actions={headerActions ?? (csvName ? (
          <ExportButton onExport={() => exportCsv(csvName, csvHeaders ?? columns.map((c) => c.header), filtered.map((r) => columns.map((c) => String(r[c.key] ?? ''))))} />
        ) : undefined)}
      />

      {/* Search + optional filter toolbar — always rendered (the search box
          must remain visible even when no filters are configured). */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={tc.query} onChange={(v) => { tc.setQuery(v); tc.setPage(1); }} placeholder={`Search ${title.toLowerCase()}…`} label={`Search ${title}`} />
        {filters?.map((f) => (
          <FilterDropdown
            key={f.field as string} label={f.label}
            value={filterVals[f.field as string] ?? 'all'}
            onChange={(v) => { setFilterVals((s) => ({ ...s, [f.field as string]: v })); tc.setPage(1); }}
            options={f.options}
          />
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={tc.paged}
        rowKey={(r) => String(r.id ?? r[columns[0].key])}
        sortKey={tc.sortKey} sortDir={tc.sortDir} onSort={tc.toggleSort}
        loading={q.loading}
        emptyMessage={emptyMessage ?? 'No records found'}
        emptyAction={
          <button type="button" onClick={() => { tc.setQuery(''); setFilterVals({}); }} className="rounded-xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">
            Clear filters
          </button>
        }
      />
      <Pagination page={tc.page} totalPages={tc.totalPages} onPage={tc.setPage} total={tc.totalFiltered} />
      {belowTable}
    </>
  );
}
