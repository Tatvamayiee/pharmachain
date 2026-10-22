import type { Prescription, PrescriptionStatus } from '../types/prescription';
import { api } from '../../../platform/api/api';

export const prescriptionApiService = {
  async getPrescriptions(status?: string): Promise<Prescription[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await api<{ items: Prescription[] }>(`/api/prescriptions${query}`);
    return res.items;
  },

  async getPrescription(id: string): Promise<Prescription> {
    return await api<Prescription>(`/api/prescriptions/${encodeURIComponent(id)}`);
  },

  async updatePrescriptionStatus(id: string, status: PrescriptionStatus): Promise<void> {
    await api(`/api/prescriptions/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  async submitReview(id: string, checklist: Record<string, boolean>, notes?: string): Promise<void> {
    await api(`/api/prescriptions/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: JSON.stringify({ checklist, notes }),
    });
  },

  async approvePrescription(id: string): Promise<void> {
    await api(`/api/prescriptions/${encodeURIComponent(id)}/approve`, { method: 'POST' });
  },

  async rejectPrescription(id: string, reason: string): Promise<void> {
    await api(`/api/prescriptions/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async requestClarification(id: string, recipientType: string, message: string): Promise<void> {
    await api(`/api/prescriptions/${encodeURIComponent(id)}/clarification`, {
      method: 'POST',
      body: JSON.stringify({ recipientType, message }),
    });
  },

  async dispensePrescription(id: string): Promise<void> {
    await api(`/api/prescriptions/${encodeURIComponent(id)}/dispense`, { method: 'POST' });
  },

  async createPrescription(data: Partial<Prescription>): Promise<Prescription> {
    return await api<Prescription>('/api/prescriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
