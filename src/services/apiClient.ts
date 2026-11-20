const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function buildUrl(endpoint: string): string {
  const base = API_BASE.replace(/\/$/, '');
  const normalized =
    base.endsWith('/api') && endpoint.startsWith('/api/')
      ? endpoint.slice(4)
      : endpoint.startsWith('/')
        ? endpoint
        : `/${endpoint}`;
  return `${base}${normalized}`;
}

async function handleJsonResponse<TResponse>(res: Response): Promise<TResponse> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const message =
      (payload as { error?: string; message?: string } | null)?.error ||
      (payload as { message?: string } | null)?.message ||
      `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status);
  }
  if (payload === null) {
    throw new ApiError('Server returned an unexpected non-JSON response.', res.status || 502);
  }
  return payload as TResponse;
}

export async function apiGet<TResponse>(endpoint: string, signal?: AbortSignal): Promise<TResponse> {
  const res = await fetch(buildUrl(endpoint), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  return handleJsonResponse<TResponse>(res);
}

export async function apiPost<TResponse, TBody = unknown>(
  endpoint: string,
  body: TBody,
  signal?: AbortSignal
): Promise<TResponse> {
  const res = await fetch(buildUrl(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  return handleJsonResponse<TResponse>(res);
}

export async function apiPut<TResponse, TBody = unknown>(
  endpoint: string,
  body: TBody,
  signal?: AbortSignal
): Promise<TResponse> {
  const res = await fetch(buildUrl(endpoint), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  return handleJsonResponse<TResponse>(res);
}

export async function apiDelete<TResponse>(endpoint: string, signal?: AbortSignal): Promise<TResponse> {
  const res = await fetch(buildUrl(endpoint), {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    signal,
  });
  return handleJsonResponse<TResponse>(res);
}

export function getApiBaseUrl(): string {
  return API_BASE;
}
