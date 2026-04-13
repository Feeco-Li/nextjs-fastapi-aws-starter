/**
 * Authenticated API client.
 *
 * Every request automatically carries the Cognito access token as
 *   Authorization: Bearer <token>
 *
 * Token refresh is fully handled by Amplify — fetchAuthSession() returns a
 * fresh token if the current one is expired. If the backend still returns 401
 * (e.g. clock skew), callers can catch the error and retry once.
 */
import { fetchAuthSession } from 'aws-amplify/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

async function getAccessToken(): Promise<string> {
  const session = await fetchAuthSession();
  const token = session.tokens?.accessToken?.toString();
  if (!token) throw new Error('No access token — user is not authenticated');
  return token;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // This should be rare — Amplify refreshes tokens automatically.
    // Throw so the caller can decide whether to retry.
    throw new Error('401 Unauthorized');
  }

  return response;
}

// Typed convenience helpers

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}
