// Server-side booking-slot validation. Mirrors src/lib/availability.ts (kept as
// a separate file on purpose: Vercel bundles each function from api/ only, so we
// do not import from src/). A parity test (src/test/slotsParity.test.ts) keeps
// the two implementations in agreement.
//
// Working hours are the psychologist's wall-clock time in Algeria
// (Africa/Algiers, UTC+1, no DST since 2010), NOT the viewer's or the server's
// time zone.

export const ALGIERS_OFFSET_MIN = 60;
export const ALGIERS_TZ = "Africa/Algiers";
export const SESSION_MINUTES = 60;
const SLOT_STEP_MIN = 30;
const STALE_PENDING_MS = 30 * 60 * 1000;

export interface ClinicSettings {
  vacationMode?: boolean;
  startHour?: string;
  endHour?: string;
  bufferMinutes?: number;
  workingDays?: string[];
}

export const DEFAULT_CLINIC_SETTINGS = {
  vacationMode: false,
  startHour: "09:00",
  endHour: "19:00",
  bufferMinutes: 15,
  workingDays: ["Sun", "Mon", "Tue", "Wed", "Thu"],
};

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface ExistingBooking {
  id?: string;
  booked_at: string;
  duration_minutes?: number | null;
  status?: string | null;
  created_at?: string | null;
  patient_id?: string | null;
}

export type SlotCheck =
  | { ok: true; start: Date; duration: number }
  | { ok: false; status: number; error: string };

const hm = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Wall-clock parts of an instant in Algiers. */
export function algiersParts(d: Date) {
  const shifted = new Date(d.getTime() + ALGIERS_OFFSET_MIN * 60000);
  return {
    y: shifted.getUTCFullYear(),
    mo: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    dow: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
  };
}

/** Is a booking row still holding its slot? (cancelled and abandoned-pending ones are not) */
export function holdsSlot(b: ExistingBooking, now: Date): boolean {
  if (b.status === "cancelled") return false;
  if (b.status === "pending" && b.created_at) {
    return now.getTime() - new Date(b.created_at).getTime() < STALE_PENDING_MS;
  }
  return true;
}

export function validateBookingSlot(opts: {
  bookedAt: unknown;
  duration?: unknown;
  patientId: string;
  psychologistId: string;
  psychologist: { user_type?: string | null; approval_status?: string | null; clinic_settings?: ClinicSettings | null } | null;
  existing: ExistingBooking[];
  /** booking being moved (reschedule) or a reservation this patient already holds for the same slot */
  ignoreBookingId?: string;
  now?: Date;
}): SlotCheck {
  const now = opts.now ?? new Date();
  const fail = (status: number, error: string): SlotCheck => ({ ok: false, status, error });

  if (!opts.psychologist || opts.psychologist.user_type !== "psychologue") return fail(404, "Psychologue introuvable.");
  if (opts.psychologist.approval_status !== "approved") return fail(400, "Ce psychologue n'accepte pas encore de réservations.");
  if (opts.patientId === opts.psychologistId) return fail(400, "Vous ne pouvez pas réserver une séance avec vous-même.");

  const start = new Date(String(opts.bookedAt));
  if (Number.isNaN(start.getTime())) return fail(400, "Date de séance invalide.");
  if (start.getTime() <= now.getTime()) return fail(400, "Le créneau choisi est déjà passé.");

  const duration = opts.duration == null || opts.duration === "" ? SESSION_MINUTES : Number(opts.duration);
  if (duration !== SESSION_MINUTES) return fail(400, "Durée de séance non valide.");

  const p = algiersParts(start);
  if (p.seconds !== 0 || p.minutes % SLOT_STEP_MIN !== 0) return fail(400, "Créneau non valide.");

  const cs = { ...DEFAULT_CLINIC_SETTINGS, ...(opts.psychologist.clinic_settings ?? {}) };
  if (cs.vacationMode) return fail(409, "Ce psychologue est actuellement en congé.");
  if (!cs.workingDays.includes(DAY_KEYS[p.dow])) return fail(409, "Ce psychologue ne consulte pas ce jour-là.");
  if (p.minutes < hm(cs.startHour) || p.minutes + duration > hm(cs.endHour)) return fail(409, "Ce créneau est en dehors des horaires du psychologue.");

  const buffer = cs.bufferMinutes ?? 0;
  const s = start.getTime();
  const e = s + duration * 60000;
  for (const b of opts.existing) {
    if (opts.ignoreBookingId && b.id === opts.ignoreBookingId) continue;
    if (!holdsSlot(b, now)) continue;
    const bs = new Date(b.booked_at).getTime();
    const be = bs + (b.duration_minutes ?? SESSION_MINUTES) * 60000;
    // The same patient re-opening checkout for the exact slot they already reserved is fine.
    if (bs === s && b.patient_id === opts.patientId) continue;
    if (s < be + buffer * 60000 && e > bs - buffer * 60000) return fail(409, "Ce créneau n'est plus disponible.");
  }

  return { ok: true, start, duration };
}

/** Bookings that could conflict with a slot starting at `start` (±1 day window, cheap and safe). */
export async function fetchConflictCandidates(db: any, psychologistId: string, start: Date): Promise<ExistingBooking[]> {
  const from = new Date(start.getTime() - 24 * 3600 * 1000).toISOString();
  const to = new Date(start.getTime() + 24 * 3600 * 1000).toISOString();
  const { data } = await db
    .from("bookings")
    .select("id, booked_at, duration_minutes, status, created_at, patient_id")
    .eq("psychologist_id", psychologistId)
    .neq("status", "cancelled")
    .gte("booked_at", from)
    .lte("booked_at", to);
  return (data ?? []) as ExistingBooking[];
}

/** Human-readable date/time in Algiers for emails and notifications. */
export function formatAlgiers(d: Date | string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(d).toLocaleString("fr-FR", { timeZone: ALGIERS_TZ, ...opts });
}
export const formatAlgiersLong = (d: Date | string) =>
  `${formatAlgiers(d, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} (heure d'Alger)`;
