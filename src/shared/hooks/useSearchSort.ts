import { useMemo, useState } from 'react';

export interface TableControls<T> {
  query: string;
  setQuery: (q: string) => void;
  sortKey: keyof T | null;
  sortDir: 'asc' | 'desc';
  toggleSort: (key: keyof T) => void;
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  filtered: T[];
  paged: T[];
  totalPages: number;
  totalFiltered: number;
}

/** Search + sort + paginate a dataset for DataTable usage. */
export function useTableControls<T extends Record<string, unknown>>(
  rows: T[],
  searchFields: (keyof T)[],
  initialPageSize = 8,
): TableControls<T> {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows;
    if (q) {
      out = out.filter((r) => searchFields.some((f) => String(r[f] ?? '').toLowerCase().includes(q)));
    }
    if (sortKey) {
      out = [...out].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''), undefined, { sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, query, searchFields, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  const toggleSort = (key: keyof T) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  return {
    query, setQuery, sortKey, sortDir, toggleSort,
    page: safePage, setPage, pageSize, setPageSize,
    filtered, paged, totalPages, totalFiltered: filtered.length,
  };
}
