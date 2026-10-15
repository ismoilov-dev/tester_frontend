// Backend anti-cheat tekshiruvi: node scripts/check-proctoring.mjs <kod>
// Ochiq testga "Diagnostika" nomli ishtirokchi qo'shadi, event yuboradi va server javobini chiqaradi.
const API = "https://tester-backend.duckdns.org/api", WS = "wss://tester-backend.duckdns.org/ws";
const code = process.argv[2];
if (!code) { console.log("Foydalanish: node scripts/check-proctoring.mjs abc-defg-hij"); process.exit(1); }

let token = "";
async function call(method, path, body) {
  const r = await fetch(API + path, {
    method, headers: { "Content-Type": "application/json", ...(token && { "X-Participant-Token": token }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => null);
  console.log(`${method} ${path} -> ${r.status}`, JSON.stringify(data)?.slice(0, 400));
  return data;
}
const ev = (type, extra = {}) => ({ client_id: crypto.randomUUID(), type, client_ts: new Date().toISOString(), ...extra });

const join = await call("POST", `/rooms/${code}/join/`, { full_name: "Diagnostika", group: "test" });
token = join?.participant_token;
if (!token) process.exit(1);
await call("POST", "/attempt/consent/", { consent: true, client_info: { ua: "diagnostic-script" } });
await call("POST", "/attempt/start/");

console.log("\n--- WebSocket orqali ---");
await new Promise(res => {
  const ws = new WebSocket(`${WS}/attempt/?token=${encodeURIComponent(token)}`);
  const done = setTimeout(() => { ws.close(); res(); }, 8000);
  ws.onopen = () => {
    console.log("WS ulandi");
    for (const e of [ev("tab_hidden"), ev("multiple_faces", { duration_ms: 300, meta: { count: 2 } }), ev("voice_detected", { duration_ms: 400, meta: { db: -20 } })])
      ws.send(JSON.stringify({ type: "proctor.event", data: e }));
  };
  ws.onmessage = m => console.log("WS <-", String(m.data).slice(0, 400));
  ws.onclose = e => { clearTimeout(done); console.log("WS yopildi", e.code); res(); };
});

console.log("\n--- REST orqali ---");
await call("POST", "/attempt/events/", { events: [ev("look_away", { duration_ms: 600, meta: { yaw: 45 } }), ev("copy_attempt")] });
await call("GET", "/attempt/state/");
