import { getToken } from "./auth";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error ?? `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  signup: (email, password) =>
    request("/api/auth/signup", { method: "POST", body: { email, password } }),
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: { email, password } }),
  getPoll: (code) => request(`/api/polls/${code}`),
  vote: (code, optionId, voter) =>
    request(`/api/polls/${code}/vote`, { method: "POST", body: { optionId, voter } }),
  createPoll: (payload) =>
    request(`/api/polls`, { method: "POST", body: payload, auth: true }),
};