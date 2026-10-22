// Shared API client for backend-integrated services. Browser auth is carried
// in an HttpOnly cookie; no bearer token is exposed to JavaScript.
export type ApiError = Error & { status?: number; details?: string };

const DEFAULT_TIMEOUT_MS = 10_000;
export const BACKEND_SESSION_KEY = 'pharmachain_backend_session';

// Base URL of the backend API. Local dev: unset → relative paths through the
// Vite proxy. Production (Vercel → Render): set VITE_API_URL to the backend
// origin, e.g. https://pharmachain-api.onrender.com (no trailing slash).
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/** Build an absolute API URL from a root-relative path like /api/... */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}

export function authHeaders(): Record<string, string> {
  return {};
}

export function apiFetch(input: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.delete('Authorization');
  return fetch(input, { ...options, headers, credentials: 'include' });
}

export function backendSessionActive(): boolean {
  return localStorage.getItem(BACKEND_SESSION_KEY) === 'active';
}

export function setBackendSessionActive(active: boolean): void {
  if (active) localStorage.setItem(BACKEND_SESSION_KEY, 'active');
  else localStorage.removeItem(BACKEND_SESSION_KEY);
}

function errorMessageFor(status: number, body: { error?: string; details?: string }): string {
  switch (status) {
    case 401: return 'Your session has expired. Please sign in again.';
    case 403: return 'You do not have permission to perform this action.';
    case 404: return 'The requested record was not found.';
    case 422: return body.details ? `Validation failed: ${body.details}` : (body.error || 'Validation failed.');
    default: return body.error || `Request failed (${status}).`;
  }
}

export async function api<T = unknown>(path: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    res = await apiFetch(apiUrl(path), {
      ...options,
      signal: controller.signal,
      headers: {
        // Let the browser set the multipart boundary for FormData; otherwise JSON.
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    // Network failure / timeout: caller decides how to fall back.
    const error = new Error('Backend unavailable. Please try again later.') as ApiError;
    error.status = 0;
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string; details?: string });
    const error = new Error(errorMessageFor(res.status, body)) as ApiError;
    error.status = res.status;
    error.details = body.details;
    throw error;
  }
  return (res.status === 204 ? (undefined as T) : res.json()) as Promise<T>;
}

export interface Shipment {
  id: string;
  code: string;
  drugName: string;
  batch: string;
  quantity: number;
  manufacturer: string;
  status: 'created' | 'in_transit' | 'delivered' | 'verified';
  checkpoints: { at: string; by: string; note: string }[];
  createdAt: string;
}
