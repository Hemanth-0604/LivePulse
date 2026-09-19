const KEY = "livepulse_recent_emails";
const MAX = 5;

export function getRecentEmails() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function rememberEmail(email) {
  const clean = email.trim().toLowerCase();
  if (!clean) return;
  const existing = getRecentEmails().filter((e) => e !== clean);
  const updated = [clean, ...existing].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(updated));
}