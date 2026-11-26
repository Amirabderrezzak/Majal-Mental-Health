// Runs the real api/*.ts Vercel handlers on :3001 (Vite proxies /api here), with:
//  • a controllable clock (POST /__clock {offsetMs}) so the journey can jump to
//    "15 minutes before the session" or "after it ended" without waiting;
//  • a fake Daily.co (rooms, meeting tokens, meetings) on :54400. Its room pages
//    refuse visitors without a valid token for that room and record who joined,
//    which is what the attendance check reads back;
//  • an e-mail sink for Resend (GET /__emails).
import http from "node:http";
import crypto from "node:crypto";

// ── clock ────────────────────────────────────────────────────────────────────
let offsetMs = 0;
const RealDate = Date;
class ShiftedDate extends RealDate {
  constructor(...args: any[]) {
    if (args.length === 0) super(RealDate.now() + offsetMs);
    else super(...(args as [any]));
  }
  static now() { return RealDate.now() + offsetMs; }
}
(globalThis as any).Date = ShiftedDate;

// ── fake Daily ───────────────────────────────────────────────────────────────
const DAILY_PORT = 54400;
const rooms = new Map<string, any>();
const tokens = new Map<string, any>();
const meetings = new Map<string, { start_time: number; duration: number; participants: { user_id: string; user_name: string; join_time: number }[] }>();
const dailyLog: string[] = [];

function handleDaily(req: http.IncomingMessage, res: http.ServerResponse, body: any) {
  const url = new URL(req.url!, "http://x");
  const json = (s: number, o: any) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
  if (url.pathname.startsWith("/v1/")) {
    if (req.headers.authorization !== "Bearer daily-test-key") return json(401, { error: "authentication-error" });
    if (url.pathname === "/v1/rooms" && req.method === "POST") {
      if (rooms.has(body.name)) return json(400, { error: "invalid-request-error", info: "a room named " + body.name + " already exists" });
      const room = { name: body.name, privacy: body.privacy, properties: body.properties, url: `http://localhost:${DAILY_PORT}/${body.name}` };
      rooms.set(body.name, room);
      dailyLog.push(`room created ${body.name} privacy=${body.privacy}`);
      return json(200, room);
    }
    const rm = url.pathname.match(/^\/v1\/rooms\/(.+)$/);
    if (rm && req.method === "GET") return rooms.has(rm[1]) ? json(200, rooms.get(rm[1])) : json(404, { error: "not-found" });
    if (url.pathname === "/v1/meeting-tokens" && req.method === "POST") {
      const token = crypto.randomBytes(16).toString("hex");
      tokens.set(token, body.properties);
      dailyLog.push(`token for ${body.properties.user_id} in ${body.properties.room_name} owner=${body.properties.is_owner}`);
      return json(200, { token });
    }
    if (url.pathname === "/v1/meetings") {
      const m = meetings.get(url.searchParams.get("room") || "");
      return json(200, { total_count: m ? 1 : 0, data: m ? [{ room: url.searchParams.get("room"), ...m, max_participants: new Set(m.participants.map((p) => p.user_id)).size }] : [] });
    }
    return json(404, { error: "not-found" });
  }
  // Room page (what the browser opens).
  const name = url.pathname.slice(1);
  const room = rooms.get(name);
  const t = url.searchParams.get("t");
  const props = t ? tokens.get(t) : null;
  res.writeHead(room && props && props.room_name === name ? 200 : 403, { "Content-Type": "text/html; charset=utf-8" });
  if (!room) return res.end(`<h1>Salle introuvable</h1>`);
  if (room.privacy === "private" && (!props || props.room_name !== name)) {
    dailyLog.push(`REFUSED visitor without valid token for ${name}`);
    return res.end(`<h1 id="refused">Accès refusé : cette salle est privée</h1>`);
  }
  const now = Math.floor(Date.now() / 1000);
  const m = meetings.get(name) ?? { start_time: now, duration: 0, participants: [] };
  if (!m.participants.some((p) => p.user_id === props.user_id)) m.participants.push({ user_id: props.user_id, user_name: props.user_name, join_time: now });
  m.duration = Math.max(m.duration, 60 * 60);
  meetings.set(name, m);
  dailyLog.push(`JOIN ${props.user_name} (${props.user_id}) → ${name}`);
  res.end(`<!doctype html><meta charset="utf-8"><title>Daily (fake) — ${name}</title>
<h1 id="joined">Connecté·e à ${name}</h1><p id="who">${props.user_name}${props.is_owner ? " (hôte)" : ""}</p>
<p id="count">${m.participants.length} participant(s)</p>`);
}

// ── outgoing HTTP interception (Resend, Daily) ───────────────────────────────
const emails: any[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input.url;
  if (url.startsWith("https://api.resend.com")) {
    const body = JSON.parse(init?.body || "{}");
    emails.push({ to: body.to, subject: body.subject, html: body.html, at: new Date().toISOString() });
    return new Response(JSON.stringify({ id: crypto.randomUUID() }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return realFetch(input, init);
}) as typeof fetch;

// ── handler host ─────────────────────────────────────────────────────────────
const modules: Record<string, () => Promise<any>> = {
  admin: () => import("../../api/admin.ts"),
  bookings: () => import("../../api/bookings.ts"),
  calls: () => import("../../api/calls.ts"),
  contact: () => import("../../api/contact.ts"),
  health: () => import("../../api/health.ts"),
  messages: () => import("../../api/messages.ts"),
  notifications: () => import("../../api/notifications.ts"),
  payments: () => import("../../api/payments.ts"),
};

function vercelRes(res: http.ServerResponse) {
  const r: any = res;
  r.status = (code: number) => { res.statusCode = code; return r; };
  r.json = (obj: unknown) => { if (!res.headersSent) res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); return r; };
  r.send = (b: unknown) => { res.end(typeof b === "string" ? b : JSON.stringify(b)); return r; };
  return r;
}

const apiLog: string[] = [];
http.createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString();
  const url = new URL(req.url!, "http://x");
  const body = raw ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : undefined;

  if (url.pathname === "/__clock" && req.method === "POST") { offsetMs = Number(body?.offsetMs ?? 0); res.end(JSON.stringify({ now: new Date().toISOString() })); return; }
  if (url.pathname === "/__emails") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(emails)); return; }
  if (url.pathname === "/__daily") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ log: dailyLog, rooms: [...rooms.keys()], meetings: Object.fromEntries(meetings) })); return; }
  if (url.pathname === "/__api") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(apiLog)); return; }

  const m = url.pathname.match(/^\/api\/([a-z]+)$/);
  if (!m || !modules[m[1]]) { res.statusCode = 404; res.end(JSON.stringify({ error: "no such function" })); return; }
  const mod = await modules[m[1]]();
  (req as any).query = Object.fromEntries(url.searchParams);
  (req as any).body = body;
  const vres = vercelRes(res);
  const started = RealDate.now();
  try {
    await mod.default(req, vres);
  } catch (e) {
    console.error(`[api] ${req.method} ${req.url} crashed:`, e);
    if (!res.headersSent) { res.statusCode = 500; res.end(JSON.stringify({ error: "crash" })); }
  }
  apiLog.push(`${req.method} ${url.pathname}?${url.searchParams} → ${res.statusCode} (${RealDate.now() - started} ms)`);
}).listen(3001, () => console.log("[api] handlers on :3001"));

http.createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString();
  handleDaily(req, res, raw ? JSON.parse(raw) : {});
}).listen(DAILY_PORT, () => console.log(`[daily] fake Daily on :${DAILY_PORT}`));
