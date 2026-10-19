import { useMemo, useState } from 'react';
import { BellOff, CheckCheck, Info, AlertTriangle, XCircle } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { EmptyState, SkeletonCard } from '../../components/ui/states';
import { FilterDropdown } from '../../components/ui/inputs';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../contexts/AuthContext';
import { dataService } from '../../services/dataService';
import type { Notification, NotificationType } from '../../types';

const ICONS: Record<NotificationType, React.ReactNode> = {
  info: <Info size={17} className="text-cyan-600" aria-hidden="true" />,
  success: <CheckCheck size={17} className="text-emerald-600" aria-hidden="true" />,
  warning: <AlertTriangle size={17} className="text-orange-500" aria-hidden="true" />,
  error: <XCircle size={17} className="text-red-600" aria-hidden="true" />,
};

const BG: Record<NotificationType, string> = {
  info: 'bg-cyan-50', success: 'bg-emerald-50', warning: 'bg-amber-50', error: 'bg-red-50',
};

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function Notifications() {
  const { user } = useAuth();
  const { data, loading } = useFetch<Notification[]>(() => dataService.getNotifications(user?.id));
  const [filter, setFilter] = useState('all');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    let list = data ?? [];
    if (filter === 'unread') list = list.filter((n) => !n.isRead && !readIds.has(n.id));
    else if (filter !== 'all') list = list.filter((n) => n.type === filter);
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data, filter, readIds]);

  const unreadCount = (data ?? []).filter((n) => !n.isRead && !readIds.has(n.id)).length;

  const markAll = () => setReadIds(new Set((data ?? []).map((n) => n.id)));

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'You are all caught up'}
        crumbs={[{ label: 'Notifications' }]}
        actions={
          <button
            type="button" onClick={markAll} disabled={unreadCount === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-40"
          >
            <CheckCheck size={15} aria-hidden="true" /> Mark all read
          </button>
        }
      />

      <div className="mb-4">
        <FilterDropdown
          label="Show" value={filter} onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'unread', label: 'Unread' },
            { value: 'info', label: 'Info' },
            { value: 'success', label: 'Success' },
            { value: 'warning', label: 'Warnings' },
            { value: 'error', label: 'Errors' },
          ]}
        />
      </div>

      {loading ? (
        <div className="space-y-3" role="status" aria-label="Loading notifications">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={BellOff} title="No notifications" message="New alerts about shipments, recalls and stock will appear here." />
      ) : (
        <ul className="space-y-2.5" aria-label="Notification list">
          {rows.map((n) => {
            const unread = !n.isRead && !readIds.has(n.id);
            return (
              <li
                key={n.id}
                className={`flex items-start gap-3.5 rounded-2xl border p-4 shadow-sm transition-colors sm:items-center ${
                  unread ? 'border-indigo-100 bg-white' : 'border-slate-100 bg-white/70'
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${BG[n.type]}`} aria-hidden="true">
                  {ICONS[n.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm ${unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>{n.title}</p>
                    {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" aria-label="Unread" />}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{n.message}</p>
                </div>
                <time className="shrink-0 text-xs text-slate-400">{timeAgo(n.createdAt)}</time>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
