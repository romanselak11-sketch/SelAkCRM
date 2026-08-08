const TOKEN_KEY = 'selak_token';
export type { Me } from './api.types';

/** Пусто в dev: запросы на тот же origin, Vite проксирует `/api` на бэкенд. Для продакшена: полный URL API без завершающего слэша. */
const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, '') ?? '';

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(t: string | null) {
  if (t) sessionStorage.setItem(TOKEN_KEY, t);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function api<T>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const headers = new Headers(opts.headers);
  if (opts.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const t = getToken();
  if (t) headers.set('Authorization', `Bearer ${t}`);
  const url = `${API_ORIGIN}/api/v1${path}`;
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    if (
      res.status === 403 &&
      typeof data === 'object' &&
      data &&
      'licenseReason' in data
    ) {
      window.dispatchEvent(
        new CustomEvent('license-inactive', {
          detail: String((data as { licenseReason: unknown }).licenseReason),
        }),
      );
    }
    throw new ApiError(msg || 'Ошибка запроса', res.status, data);
  }
  return data as T;
}
