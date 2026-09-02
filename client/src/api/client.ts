/// <reference types="vite/client" />
// Base API fetch wrapper — all requests go through here

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options;

  let url = `${BASE_URL}${path}`;

  if (params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') {
        qs.set(k, String(v));
      }
    }
    const queryString = qs.toString();
    if (queryString) url += `?${queryString}`;
  }

  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  // Handle empty responses (e.g. 204 No Content)
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

export const api = {
  get: <T>(path: string, params?: RequestOptions['params']) =>
    request<T>(path, { params }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};
