// Daily.co helpers. Rooms are PRIVATE: joining needs a meeting token minted here
// for one specific user. Previously therapy rooms were "public", so anyone who
// got hold of the link could walk into a session; and private audio rooms were
// created with no token flow at all, so nobody could join them.

const DAILY_API = process.env.DAILY_API_BASE || "https://api.daily.co/v1";

export function dailyConfigured(): boolean {
  return !!process.env.DAILY_API_KEY;
}

async function daily(path: string, init: RequestInit = {}) {
  const res = await fetch(`${DAILY_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      ...(init.headers || {}),
    },
  });
  let body: any = null;
  try { body = await res.json(); } catch { /* empty body */ }
  return { ok: res.ok, status: res.status, body };
}

export function roomNameFromUrl(url: string): string {
  return url.replace(/[?#].*$/, "").split("/").filter(Boolean).pop() || "";
}

/** Creates the private room, or returns it if it already exists. */
export async function ensureRoom(name: string, opts: { expSeconds: number; audioOnly?: boolean }): Promise<string> {
  const created = await daily("/rooms", {
    method: "POST",
    body: JSON.stringify({
      name,
      privacy: "private",
      properties: {
        enable_chat: true,
        enable_knocking: false,
        start_video_off: !!opts.audioOnly,
        start_audio_off: false,
        exp: opts.expSeconds,
        eject_at_room_exp: true,
      },
    }),
  });
  if (created.ok && created.body?.url) return created.body.url;
  const existing = await daily(`/rooms/${encodeURIComponent(name)}`);
  if (existing.ok && existing.body?.url) return existing.body.url;
  throw new Error(`Daily room error (${created.status})`);
}

/** Per-user meeting token; user_id lets the attendance check tell who joined. */
export async function createToken(opts: { room: string; userId: string; userName: string; isOwner: boolean; expSeconds: number; audioOnly?: boolean }): Promise<string> {
  const r = await daily("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: opts.room,
        user_id: opts.userId,
        user_name: opts.userName,
        is_owner: opts.isOwner,
        exp: opts.expSeconds,
        ...(opts.audioOnly ? { start_video_off: true } : {}),
      },
    }),
  });
  if (!r.ok || !r.body?.token) throw new Error(`Daily token error (${r.status})`);
  return r.body.token;
}

export function joinUrl(roomUrl: string, token: string): string {
  return `${roomUrl}${roomUrl.includes("?") ? "&" : "?"}t=${encodeURIComponent(token)}`;
}

/**
 * Which of the given user ids were in the room around the session window.
 * Returns null when Daily can't be queried (we then leave the booking alone).
 */
export async function attendance(roomUrl: string, fromMs: number, toMs: number, userIds: string[]): Promise<Record<string, boolean> | null> {
  if (!dailyConfigured()) return null;
  const room = roomNameFromUrl(roomUrl);
  const r = await daily(`/meetings?room=${encodeURIComponent(room)}&limit=50`);
  const result: Record<string, boolean> = Object.fromEntries(userIds.map((u) => [u, false]));
  if (r.status === 404) return result;
  if (!r.ok) return null;
  for (const m of r.body?.data ?? []) {
    const start = Number(m.start_time) * 1000;
    if (start > toMs || start + Number(m.duration ?? 0) * 1000 < fromMs) continue;
    for (const p of m.participants ?? []) {
      if (p.user_id && p.user_id in result) result[p.user_id] = true;
    }
  }
  return result;
}
