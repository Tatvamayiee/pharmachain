import type {
  AuditLog,
  Batch,
  Bill,
  Medicine,
  Notification,
  ProcurementOrder,
  ProcurementProduct,
  QRVerification,
  Recall,
  Sale,
  Shipment,
  Stock,
  User,
} from '../../shared/types';
import {
  mockAuditLogs,
  mockBatches,
  mockMedicines,
  mockNotifications,
  mockRecalls,
  mockSales,
  mockShipments,
  mockStock,
  mockUsers,
  mockVerifications,
} from '../../shared/data/mockData';
import { apiFetch, apiUrl, authHeaders, backendSessionActive } from '../api/api';

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

function clone<T>(rows: T[]): T[] {
  return rows.map((r) => ({ ...r }));
}

/**
 * Backend-first data service.
 *
 * Methods backed by the REAL database reflect changes across every login
 * (what one role creates, another role sees). Each method falls back to the
 * prototype mock data ONLY when there is no session or the backend is
 * unreachable, so dashboards never hard-break in offline demos. Mock-backed
 * methods are explicitly labelled in their doc comment.
 */

async function getJSON<T>(path: string): Promise<T | null> {
  const token = backendSessionActive() ? 'active' : null;
  if (!token) return null;
  try {
    const res = await apiFetch(apiUrl(path), {
      headers: {},
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const dataService = {
  async getProcurementCatalog(): Promise<{ ok: true; products: ProcurementProduct[] } | { ok: false; error: string }> {
    try {
      const res = await apiFetch(apiUrl('/api/procurement/catalog'), { headers: authHeaders() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error || `Request failed (${res.status}).` };
      return { ok: true, products: body.products || [] };
    } catch {
      return { ok: false, error: 'Could not load manufacturer stock. Check the backend connection and retry.' };
    }
  },
  async getProcurementOrders(): Promise<{ ok: true; orders: ProcurementOrder[] } | { ok: false; error: string }> {
    try {
      const res = await apiFetch(apiUrl('/api/procurement/orders'), { headers: authHeaders() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error || `Request failed (${res.status}).` };
      return { ok: true, orders: body.orders || [] };
    } catch {
      return { ok: false, error: 'Could not load orders. Check the backend connection and retry.' };
    }
  },
  async createProcurementOrder(input: {
    medicineId: string; manufacturerId: string; quantity: number; notes?: string;
  }): Promise<{ ok: true; order: ProcurementOrder } | { ok: false; error: string }> {
    try {
      const res = await apiFetch(apiUrl('/api/procurement/orders'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error || `Request failed (${res.status}).` };
      return { ok: true, order: body.order };
    } catch {
      return { ok: false, error: 'Could not place order. Check the backend connection and retry.' };
    }
  },
  async updateProcurementOrder(
    id: string,
    action: 'accept' | 'reject' | 'ship' | 'receive' | 'cancel',
    note = '',
  ): Promise<{ ok: true; order: ProcurementOrder } | { ok: false; error: string }> {
    try {
      const res = await apiFetch(apiUrl(`/api/procurement/orders/${encodeURIComponent(id)}`), {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error || `Request failed (${res.status}).` };
      return { ok: true, order: body.order };
    } catch {
      return { ok: false, error: 'Could not update order. Check the backend connection and retry.' };
    }
  },
  /** REAL: platform user directory (admin-only endpoint). */
  async getUsers(): Promise<User[]> {
    const data = await getJSON<{ users: User[] }>('/api/platform/users');
    if (data?.users?.length) return data.users;
    await delay();
    return clone(mockUsers);
  },
  /** MOCK: reference medicine catalog is seeded server-side but the UI shape
   *  differs; wired to the real endpoint and mapped. */
  async getMedicines(): Promise<Medicine[]> {
    const data = await getJSON<{ medicines: Array<Record<string, unknown>> }>('/api/platform/medicines');
    if (data?.medicines?.length) {
      return data.medicines.map((m) => ({
        id: String(m.id ?? ''),
        name: String(m.name ?? ''),
        genericName: String(m.genericName ?? ''),
        category: String(m.category ?? ''),
        dosageForm: String(m.dosageForm ?? ''),
        strength: Array.isArray(m.strengths) ? String(m.strengths[0] ?? '') : String(m.strength ?? ''),
        manufacturerId: String(m.manufacturerId ?? ''),
        description: '',
        storageCondition: '',
      })) as Medicine[];
    }
    await delay();
    return clone(mockMedicines);
  },
  /** REAL: manufacturer production batches (org-scoped on the server). */
  async getBatches(): Promise<Batch[]> {
    const data = await getJSON<{ batches: Array<Record<string, unknown>> }>('/api/platform/batches');
    if (data?.batches) {
      return data.batches.map((b) => ({
        id: String(b.id ?? ''),
        medicineId: String(b.medicineId ?? ''),
        medicineName: b.medicineName ? String(b.medicineName) : undefined,
        batchNumber: String(b.batchNumber ?? ''),
        manufacturingDate: String(b.manufacturingDate ?? ''),
        expiryDate: String(b.expiryDate ?? ''),
        quantityProduced: Number(b.quantityProduced ?? 0),
        availableQuantity: Number(b.availableQuantity ?? 0),
        status: (b.status as Batch['status']) || 'active',
        qrCode: String(b.qrCode ?? ''),
        recallReason: b.recallReason ? String(b.recallReason) : undefined,
        createdAt: String(b.createdAt ?? new Date().toISOString()),
      }));
    }
    await delay();
    return clone(mockBatches);
  },
  /** REAL: register a catalog medicine (manufacturer). */
  async createMedicine(input: {
    name: string; genericName?: string; category?: string; dosageForm?: string; strength?: string;
  }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    const token = backendSessionActive() ? 'active' : null;
    if (!token) return { ok: false, error: 'Not signed in.' };
    try {
      const res = await apiFetch(apiUrl('/api/platform/medicines'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error || `Request failed (${res.status}).` };
      return { ok: true, id: String(body.medicine?.id ?? '') };
    } catch {
      return { ok: false, error: 'Could not reach the server.' };
    }
  },
  /** REAL: delete a catalog medicine (blocked while batches exist). */
  async deleteMedicine(id: string): Promise<{ ok: boolean; error?: string }> {
    const token = backendSessionActive() ? 'active' : null;
    if (!token) return { ok: false, error: 'Not signed in.' };
    try {
      const res = await apiFetch(apiUrl(`/api/platform/medicines/${encodeURIComponent(id)}`), {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.error || `Request failed (${res.status}).` };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not reach the server.' };
    }
  },
  /** REAL: register a production batch (manufacturer/admin). The returned
   * server batch includes the real QR1 verification URL. */
  async createBatch(input: {
    medicineName: string; genericName: string; category: string; dosageForm: string;
    strength: string; batchNumber: string; manufacturingDate: string; expiryDate: string;
    quantityProduced: number; storageConditions?: string; price?: number; description?: string;
  }): Promise<{ ok: true; batch: Batch; medicineValidation?: Record<string, unknown> } | { ok: false; error: string }> {
    const token = backendSessionActive() ? 'active' : null;
    if (!token) return { ok: false, error: 'Not signed in.' };
    try {
      const res = await apiFetch(apiUrl('/api/platform/batches'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = body.details ? ` ${body.details}` : '';
        return { ok: false, error: `${body.error || `Request failed (${res.status}).`}${detail}` };
      }
      const b = body.batch;
      if (!b?.id || !b?.batchNumber || !b?.qrCode) return { ok: false, error: 'Server did not return a complete batch and QR1 record.' };
      return {
        ok: true,
        batch: {
          id: String(b.id), medicineId: String(b.medicineId || ''), medicineName: String(b.medicineName || input.medicineName),
          batchNumber: String(b.batchNumber), manufacturingDate: String(b.manufacturingDate), expiryDate: String(b.expiryDate),
          quantityProduced: Number(b.quantityProduced || input.quantityProduced), availableQuantity: Number(b.availableQuantity || 0),
          status: b.status as Batch['status'], qrCode: String(b.qrCode), recallReason: b.recallReason, createdAt: String(b.createdAt),
        },
        medicineValidation: body.medicineValidation,
      };
    } catch {
      return { ok: false, error: 'Backend unavailable. Please try again later.' };
    }
  },
  /** REAL: recall / expire / release a batch — visible to every login. */
  async setBatchStatus(batchId: string, status: 'recalled' | 'expired' | 'released', reason?: string, severity?: 'low' | 'medium' | 'high' | 'critical'): Promise<{ ok: boolean; error?: string }> {
    const token = backendSessionActive() ? 'active' : null;
    if (!token) return { ok: false, error: 'Not signed in.' };
    try {
      const res = await apiFetch(apiUrl(`/api/platform/batches/${encodeURIComponent(batchId)}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason, severity }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.error || `Request failed (${res.status}).` };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Backend unavailable. Please try again later.' };
    }
  },
  /** REAL: shipments are persisted per organization on the server. */
  async getShipments(): Promise<Shipment[]> {
    // Backend-first with a deliberate mock fallback: when a backend session
    // exists we fetch live shipments; on any failure (no token, server down,
    // error response) we serve mock data so dashboards never break.
    const token = backendSessionActive() ? 'active' : null;
    if (!token) {
      await delay();
      return clone(mockShipments);
    }
    try {
      const res = await apiFetch(apiUrl('/api/shipments'), {
        headers: {},
      });
      if (!res.ok) return clone(mockShipments);
      const raw = (await res.json()) as Array<Record<string, unknown>>;
      if (!Array.isArray(raw)) return clone(mockShipments);
      // Server Shipment docs: { code, drugName, batch, destination, route,
      // receiverId, quantity, trackingNumber, status(lowercase) … } — map to
      // the UI Shipment shape.
      const UPCASE: Record<string, string> = {
        created: 'CREATED', packed: 'PACKED', dispatched: 'DISPATCHED',
        in_transit: 'IN_TRANSIT', assigned_to_distributor: 'ASSIGNED_TO_DISTRIBUTOR',
        assigned_to_dealer: 'ASSIGNED_TO_DEALER', delivered: 'DELIVERED', verified: 'DELIVERED', cancelled: 'CANCELLED',
      };
      return raw.map((s) => ({
        id: String(s.code ?? s.id ?? ''),
        batchId: String(s.batch ?? ''),
        medicineId: String(s.drugName ?? ''),
        senderId: String(s.senderId ?? ''),
        receiverId: String(s.receiverId ?? ''),
        destination: String(s.destination ?? ''),
        route: Array.isArray(s.route) ? s.route.join(' → ') : String(s.route ?? ''),
        quantity: Number(s.quantity ?? 1),
        trackingNumber: String(s.trackingNumber ?? ''),
        status: (UPCASE[String(s.status ?? 'created')] ?? 'CREATED') as Shipment['status'],
        estimatedDelivery: '',
        createdAt: String(s.createdAt ?? new Date().toISOString()),
      }));
    } catch {
      return clone(mockShipments);
    }
  },
  /** REAL: full dispatch creation (receiver resolved by org name server-side). */
  async createDispatch(input: {
    medicineName: string; batchNumber: string; quantity: number;
    receiverOrg: string; destination: string; route: string; trackingNumber: string;
  }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    const token = backendSessionActive() ? 'active' : null;
    if (!token) return { ok: false, error: 'Not signed in.' };
    try {
      const res = await apiFetch(apiUrl('/api/shipments/dispatch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error || `Request failed (${res.status}).` };
      return { ok: true, id: String(body.code ?? body.id ?? '') };
    } catch {
      return { ok: false, error: 'Could not reach the server.' };
    }
  },
  /** REAL: cancel a CREATED/PACKED shipment. */
  async cancelShipment(code: string): Promise<{ ok: boolean; error?: string }> {
    const token = backendSessionActive() ? 'active' : null;
    if (!token) return { ok: false, error: 'Not signed in.' };
    try {
      const res = await apiFetch(apiUrl(`/api/shipments/${encodeURIComponent(code)}/cancel`), {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.error || `Request failed (${res.status}).` };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not reach the server.' };
    }
  },
  /** REAL: active orgs that can receive dispatches. */
  async getReceivers(): Promise<Array<{ organization: string; role: string; name: string }>> {
    const data = await getJSON<{ receivers: Array<{ organization: string; role: string; name: string }> }>('/api/shipments/receivers');
    if (data?.receivers) return data.receivers;
    await delay();
    // Fallback: derive from the mock directory (offline demo only).
    const seen = new Set<string>();
    return mockUsers
      .filter((u) => ['distributor', 'dealer', 'hospital'].includes(u.role) && u.organization && !seen.has(u.organization) && seen.add(u.organization))
      .map((u) => ({ organization: u.organization, role: u.role, name: u.name }));
  },
  /** REAL: org-scoped inventory lots from /api/platform/inventory, mapped to
   *  the UI Stock shape using the medicine NAME (mock catalogs use different
   *  ids, so name is the reliable join key across real + fallback data). */
  async getStock(): Promise<Stock[]> {
    const data = await getJSON<{ stock: Array<Record<string, unknown>> }>('/api/platform/inventory');
    if (data?.stock?.length) {
      return data.stock.map((b) => ({
        id: String(b.id ?? ''),
        medicineId: String(b.medicineName ?? ''),
        batchId: String(b.batchNumber ?? ''),
        ownerId: String(b.organizationId ?? ''),
        openingQuantity: Number(b.availableQuantity ?? 0),
        receivedQuantity: 0,
        dispatchedQuantity: 0,
        damagedQuantity: 0,
        availableQuantity: Number(b.availableQuantity ?? 0),
        reorderLevel: 100,
        updatedAt: String(b.updatedAt ?? b.createdAt ?? new Date().toISOString()),
        expiryDate: b.expiryDate ? String(b.expiryDate) : undefined,
      }));
    }
    await delay();
    return clone(mockStock);
  },
  /** REAL: server-side QR scan log (mock rows only when backend down). */
  async getVerifications(): Promise<QRVerification[]> {
    try {
      const res = await apiFetch(apiUrl('/api/platform/verifications'), { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json() as { verifications?: Array<Record<string, unknown>> };
        return (data.verifications || []).map((v) => ({
          id: String(v.id ?? ''),
          qrCode: String(v.code ?? v.batchNumber ?? ''),
          batchId: String(v.batchId ?? ''),
          verifiedBy: String(v.verifiedBy ?? ''),
          result: (v.result as QRVerification['result']) ?? 'invalid',
          location: String(v.organizationId ?? '—'),
          timestamp: String(v.createdAt ?? new Date().toISOString()),
        }));
      }
    } catch { /* backend down → labelled mock below */ }
    await delay();
    console.warn('[dataService] getVerifications: backend unavailable — showing labelled mock history');
    return clone(mockVerifications);
  },
  /** REAL: recall cases derived from recalled batches (global safety info).
   *  Mock fallback only when there is no session/server (labelled offline). */
  async getRecalls(): Promise<Recall[]> {
    const data = await getJSON<{ recalls: Recall[] }>('/api/platform/recalls');
    if (data?.recalls) return data.recalls;
    await delay();
    console.warn('[dataService] getRecalls: server unavailable — showing labelled mock recalls');
    return clone(mockRecalls);
  },
  /** MOCK: notifications are per-user client preferences, not shared state. */
  async getNotifications(userId?: string): Promise<Notification[]> {
    await delay();
    return clone(mockNotifications).filter((n) => !userId || n.userId === userId || n.userId === 'all');
  },
  /** REAL: prescription audit trail (admin-only endpoint). */
  async getAuditLogs(): Promise<AuditLog[]> {
    const data = await getJSON<{ logs: AuditLog[] }>('/api/platform/audit-logs');
    if (data?.logs?.length) return data.logs;
    await delay();
    return clone(mockAuditLogs);
  },
  /** REAL: org-scoped POS sales (admin sees all orgs). Mock fallback only
   *  when there is no session/server, so offline demos still render. */
  async getSales(): Promise<Sale[]> {
    const data = await getJSON<{ sales: Sale[] }>('/api/platform/sales');
    if (data?.sales) return data.sales;
    await delay();
    return clone(mockSales);
  },
  /** REAL: pharmacy POS bills (org-scoped; admin sees all). Mock fallback
   *  only when the backend is unreachable, so offline demos still render. */
  async getBills(): Promise<Bill[]> {
    try {
      const data = await getJSON<{ bills: Bill[] }>('/api/platform/bills');
      if (data?.bills) return data.bills;
    } catch { /* fall through to labelled mock */ }
    await delay();
    console.warn('[dataService] getBills: backend unavailable — no bills shown');
    return [];
  },
  /** REAL: create a POS bill — the server verifies stock for every line,
   *  deducts FIFO across released lots, records Sales and persists the bill.
   *  Insufficient stock is rejected server-side (409); no fake success. */
  async createBill(input: {
    customerName?: string; patientRef?: string; prescriptionId?: string;
    paymentMethod?: 'cash' | 'card' | 'upi'; discount?: number;
    items: { medicineName: string; quantity: number; unitPrice?: number }[];
  }): Promise<{ ok: true; bill: Bill } | { ok: false; error: string }> {
    const token = backendSessionActive() ? 'active' : null;
    if (!token) return { ok: false, error: 'Not signed in.' };
    try {
      const res = await apiFetch(apiUrl('/api/platform/bills'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error || `Request failed (${res.status}).` };
      return { ok: true, bill: body.bill as Bill };
    } catch {
      return { ok: false, error: 'Backend unavailable. Please try again later.' };
    }
  },
  /** REAL: aggregate stock availability per medicine name across released
   *  batch lots (the same store the manufacturer upload fills). Used by the
   *  prescription scanner to show 🟢/🔴/🟠/⚪ availability. */
  async getStockAvailability(names: string[]): Promise<Record<string, { available: number; found: boolean }>> {
    if (!names.length) return {};
    try {
      const res = await apiFetch(apiUrl(`/api/platform/stock-availability?names=${encodeURIComponent(names.join('|'))}`), { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json() as { availability?: Record<string, { available: number; found: boolean }> };
        if (data?.availability) return data.availability;
      }
    } catch { /* backend down → empty map (UI shows an error note) */ }
    return {};
  },
  /** REAL: purchase — the server verifies stock, deducts FIFO across released
   *  batch lots and records the transaction. Insufficient stock is rejected
   *  server-side (409); the UI never invents a success. */
  async recordPurchase(input: {
    medicineName: string; quantity: number; customerName?: string; unitPrice?: number;
  }): Promise<{ ok: true; remainingStock: number } | { ok: false; error: string }> {
    const token = backendSessionActive() ? 'active' : null;
    if (!token) return { ok: false, error: 'Not signed in.' };
    try {
      const res = await apiFetch(apiUrl('/api/platform/purchase'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
 if (!res.ok) return { ok: false, error: body.error || `Request failed (${res.status}).` };
      return { ok: true, remainingStock: body.remainingStock };
    } catch {
      return { ok: false, error: 'Backend unavailable. Please try again later.' };
    }
  },
  /** REAL: record a sale — the server deducts FIFO from the org's stock, so
   *  the Stock page and every dashboard stay consistent across logins. */
  async recordSale(input: {
    medicineName: string; batchNumber?: string; customerName?: string;
    quantity: number; unitPrice?: number;
  }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    const token = backendSessionActive() ? 'active' : null;
    if (!token) return { ok: false, error: 'Not signed in.' };
    try {
      const res = await apiFetch(apiUrl('/api/platform/sales'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error || `Request failed (${res.status}).` };
      return { ok: true, id: body.sale.id };
    } catch {
      return { ok: false, error: 'Backend unavailable. Please try again later.' };
    }
  },
  /** REAL: receive stock into the caller's organization (merges into an
   *  existing medicine+batch lot when one exists). */
  async receiveStock(input: {
    medicineName: string; genericName?: string; batchNumber: string;
    expiryDate: string; quantity: number;
  }): Promise<{ ok: true; merged: boolean } | { ok: false; error: string }> {
    const token = backendSessionActive() ? 'active' : null;
    if (!token) return { ok: false, error: 'Not signed in.' };
    try {
      const res = await apiFetch(apiUrl('/api/inventory/stock'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error || `Request failed (${res.status}).` };
      return { ok: true, merged: !!body.merged };
    } catch {
      return { ok: false, error: 'Backend unavailable. Please try again later.' };
    }
  },
};
