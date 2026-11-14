export class ApiError extends Error {
  constructor(
    public status: number,
    public fields: Record<string, string> = {},
  ) {
    super(`API request failed (${status})`);
  }
}

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api'
).replace(/\/$/, '');

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (error) {
    if (
      (error instanceof Error || error instanceof DOMException) &&
      error.name === 'AbortError'
    )
      throw error;
    throw new ApiError(0);
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new ApiError(response.status, problem.errors ?? {});
  }

  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

export function errorKey(
  error: unknown,
):
  | 'offline'
  | 'notFound'
  | 'conflict'
  | 'invalid'
  | 'unavailable'
  | 'unexpected' {
  if (!(error instanceof ApiError)) return 'unexpected';
  if (error.status === 0) return 'offline';
  if (error.status === 404) return 'notFound';
  if (error.status === 409) return 'conflict';
  if (error.status === 400 || error.status === 413 || error.status === 415)
    return 'invalid';
  if (error.status === 503) return 'unavailable';

  return 'unexpected';
}
