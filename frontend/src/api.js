// Tiny fetch helper. Vite dev server proxies /api -> http://localhost:8000
const J = { "Content-Type": "application/json" };

async function handle(res) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (username, password) =>
    fetch("/api/login", { method: "POST", headers: J, body: JSON.stringify({ username, password }) }).then(handle),
  profile: (id) => fetch(`/api/players/${id}/profile`).then(handle),
  health: (id) => fetch(`/api/players/${id}/health`).then(handle),
  performance: (id) => fetch(`/api/players/${id}/performance`).then(handle),
  sessions: (id) => fetch(`/api/players/${id}/sessions`).then(handle),
  createSession: (body) =>
    fetch("/api/sessions", { method: "POST", headers: J, body: JSON.stringify(body) }).then(handle),
  insights: (sessionId, force = false) =>
    fetch(`/api/sessions/${sessionId}/insights${force ? "?force=true" : ""}`).then(handle),
  demoScript: () => fetch("/api/demo/script").then(handle),
};
