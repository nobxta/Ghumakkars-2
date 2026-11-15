'use client';

import type { JobRow, MessageRow, ProjectRow, ReferenceRow, StudioSettings, VersionRow } from '@/lib/ai-itinerary/types';

export const BASE = '/api/admin/ai-itinerary';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...rest,
      headers: json !== undefined ? { 'Content-Type': 'application/json', ...(rest.headers || {}) } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'Network error — check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data?.code);
  return data as T;
}

export interface ProjectListItem {
  id: string;
  title: string;
  destination: string | null;
  duration_label: string | null;
  status: ProjectRow['status'];
  theme: string;
  theme_options?: import('@/lib/ai-itinerary/types').ThemeOptions;
  model: string | null;
  current_version_id: string | null;
  is_final: boolean;
  itinerary_dirty: boolean;
  last_error: string | null;
  weighted_tokens: number;
  raw_tokens: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  version_count: number;
  pdf_size?: number | null;
  page_count?: number | null;
}

export interface StudioState {
  project: ProjectRow;
  messages: MessageRow[];
  versions: VersionRow[];
  references: ReferenceRow[];
  job: JobRow | null;
}

export interface SettingsPayload {
  settings: StudioSettings;
  apiKey: { configured: boolean; masked: string | null };
}

export const pdfUrl = (versionId: string, download = false) => `${BASE}/versions/${versionId}/pdf${download ? '?download=1' : ''}`;

/** Download through fetch so failures surface as an error instead of a broken tab. */
export async function downloadPdf(versionId: string, fallbackName = 'itinerary.pdf') {
  const res = await fetch(pdfUrl(versionId, true), { cache: 'no-store' });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new ApiError(res.status, j?.error || 'Download failed');
  }
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') || '';
  const name = /filename="([^"]+)"/.exec(cd)?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function fmtBytes(n?: number | null) {
  if (!n && n !== 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function fmtDate(iso?: string | null, withTime = false) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', withTime
    ? { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

export const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const LS = {
  get(key: string) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* ignore */ } },
  del(key: string) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};
