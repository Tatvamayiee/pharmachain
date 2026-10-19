/**
 * Client-side export helpers. CSV is generated directly; PDF uses the
 * browser print dialog on a print-styled view (works offline, no deps).
 */

export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.split('"').join('""')}"` : s;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function printSection() {
  window.print();
}

/** PDF export placeholder — wires to jsPDF or a server-side renderer later. */
export function exportPdfNote(filename: string): void {
  void filename;
  printSection();
}
