const WS_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(
  /^http/,
  "ws"
);

// Connects to the poll's live tally stream. onMessage receives parsed JSON:
// { type: "tally", counts: {...}, total: N, last?: { optionId, voter } }
export function connectPollSocket(code, onMessage) {
  const ws = new WebSocket(`${WS_BASE}/ws/polls/${code}`);
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch {
      // ignore malformed frames
    }
  };
  return ws;
}