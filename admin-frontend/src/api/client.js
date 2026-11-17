// Fetch wrapper for the admin API. Attaches the JWT when present.
// Exported so non-JSON calls (e.g. multipart file uploads) can target the same
// backend base instead of a relative /api URL (which would hit the frontend host).
//export const BASE = 'https://adminbackend.fufvkgylntiyepgk.net/api';
export const BASE = '/api';

export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // No JSON body.
  }

  if (!res.ok) {
    throw new Error(data?.message || 'Request failed. Please try again.');
  }
  return data;
}
