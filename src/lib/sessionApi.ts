import { supabase } from "@/integrations/supabase/client";

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

/** POST to one of our /api functions; throws with the server's message. */
export async function apiPost<T = any>(path: string, body: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(path, { method: "POST", headers: await authHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((data as any)?.error || `Erreur ${res.status}`), { status: res.status, data });
  return { status: res.status, data };
}

/**
 * Opens a paid session's private video room with a personal join link.
 * Both the patient and the therapist can open it (from 15 min before the start);
 * the link carries a meeting token, so a forwarded room URL alone lets nobody in.
 *
 * The tab is opened synchronously, before the network call, so mobile browsers
 * don't treat it as a blocked pop-up.
 */
export async function joinSession(bookingId: string): Promise<void> {
  const tab = window.open("about:blank", "_blank");
  try {
    const { data } = await apiPost<{ url: string }>("/api/calls?action=room", { booking_id: bookingId });
    if (tab) tab.location.href = data.url;
    else window.location.href = data.url;
  } catch (err) {
    tab?.close();
    throw err;
  }
}

/** Same for a live audio room (listener or host). */
export async function joinAudioRoom(roomId: string): Promise<string> {
  const { data } = await apiPost<{ url: string }>("/api/calls?action=audio-join", { room_id: roomId });
  return data.url;
}

export const ALGIERS_TZ = "Africa/Algiers";

/**
 * Session dates/times are always shown in Algiers time (the time the therapist
 * works in and the time used in e-mails), not the viewer's device time zone —
 * a patient abroad used to see a different hour in the app than in the e-mail.
 */
export function fmtDate(iso: string, locale: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Date(iso).toLocaleDateString(locale, { ...opts, timeZone: ALGIERS_TZ });
}
export function fmtTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: ALGIERS_TZ });
}
