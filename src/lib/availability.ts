// Shared booking-availability logic. Computes which time slots are actually
// bookable for a psychologist on a given day, from their clinic_settings
// (working hours/days/buffer/vacation mode) and their existing bookings —
// replacing the hardcoded slot lists previously duplicated across
// Reservation.tsx and the reschedule wizard in PatientSessions.tsx.

export interface ClinicSettings {
  vacationMode: boolean;
  startHour: string; // "HH:MM"
  endHour: string; // "HH:MM"
  bufferMinutes: number;
  workingDays: string[]; // subset of DAY_KEYS
}

export const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const DEFAULT_CLINIC_SETTINGS: ClinicSettings = {
  vacationMode: false,
  startHour: "09:00",
  endHour: "19:00",
  bufferMinutes: 15,
  workingDays: ["Sun", "Mon", "Tue", "Wed", "Thu"],
};

export interface ExistingBooking {
  // Nullable because these come from a view (psychologist_availability) —
  // Postgres/Supabase's generated types mark view columns nullable
  // regardless of the underlying base column's NOT NULL constraint.
  // booked_at is never actually null in practice.
  booked_at: string | null;
  duration_minutes?: number | null;
}

// Working hours are the psychologist's wall-clock time in Algeria (Africa/Algiers,
// UTC+1, no DST) — not the viewer's browser time zone. The server validates against
// the same rule (api/_lib/slots.ts); src/test/slotsParity.test.ts keeps them aligned.
export const ALGIERS_OFFSET_MIN = 60;
export const ALGIERS_TZ = "Africa/Algiers";

/** Wall-clock parts of an instant in Algiers. */
export function algiersParts(d: Date) {
  const s = new Date(d.getTime() + ALGIERS_OFFSET_MIN * 60000);
  return { y: s.getUTCFullYear(), mo: s.getUTCMonth(), d: s.getUTCDate(), dow: s.getUTCDay(), minutes: s.getUTCHours() * 60 + s.getUTCMinutes() };
}

/** The instant at which "HH:MM" on calendar day y-mo-d happens in Algiers. */
export function algiersSlotToDate(y: number, mo: number, d: number, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(y, mo, d, h || 0, m || 0) - ALGIERS_OFFSET_MIN * 60000);
}

/** ISO bounds [start, end) of an Algiers calendar day. */
export function algiersDayRange(y: number, mo: number, d: number) {
  return {
    start: new Date(Date.UTC(y, mo, d) - ALGIERS_OFFSET_MIN * 60000).toISOString(),
    end: new Date(Date.UTC(y, mo, d + 1) - ALGIERS_OFFSET_MIN * 60000).toISOString(),
  };
}

const SLOT_INTERVAL_MINUTES = 30;
const DEFAULT_SESSION_DURATION_MINUTES = 60;

function parseHourMinute(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Returns every bookable "HH:MM" slot start-time for `date`, given the
 * psychologist's clinic settings and their existing (non-cancelled)
 * bookings that day. A slot is excluded if it would overlap another
 * booking once `bufferMinutes` padding is added on both sides, if it falls
 * outside working hours/days, if the psychologist is on vacation, or if
 * it's already in the past (for today).
 */
export function getAvailableSlots(
  date: Date,
  clinicSettings: ClinicSettings | null | undefined,
  existingBookings: ExistingBooking[],
  sessionDurationMinutes: number = DEFAULT_SESSION_DURATION_MINUTES,
  now: Date = new Date()
): string[] {
  const settings = clinicSettings ?? DEFAULT_CLINIC_SETTINGS;
  if (settings.vacationMode) return [];

  // `date` is a calendar day (its local y/m/d components), read as an Algiers day.
  const y = date.getFullYear(), mo = date.getMonth(), dd = date.getDate();
  const dayKey = DAY_KEYS[new Date(Date.UTC(y, mo, dd)).getUTCDay()];
  if (!settings.workingDays?.includes(dayKey)) return [];

  const startMin = parseHourMinute(settings.startHour || DEFAULT_CLINIC_SETTINGS.startHour);
  const endMin = parseHourMinute(settings.endHour || DEFAULT_CLINIC_SETTINGS.endHour);
  const buffer = settings.bufferMinutes ?? 0;
  if (endMin <= startMin) return [];

  // Busy windows, padded by the buffer on both sides, in Algiers minutes-of-day.
  const busyRanges = existingBookings.filter((b) => b.booked_at).map((b) => {
    const p = algiersParts(new Date(b.booked_at!));
    const duration = b.duration_minutes ?? DEFAULT_SESSION_DURATION_MINUTES;
    return { start: p.minutes - buffer, end: p.minutes + duration + buffer, same: p.y === y && p.mo === mo && p.d === dd };
  }).filter((r) => r.same);

  const np = algiersParts(now);
  const isToday = np.y === y && np.mo === mo && np.d === dd;
  const nowMin = np.minutes;

  const slots: string[] = [];
  for (let t = startMin; t + sessionDurationMinutes <= endMin; t += SLOT_INTERVAL_MINUTES) {
    if (isToday && t <= nowMin) continue;
    const slotEnd = t + sessionDurationMinutes;
    const overlaps = busyRanges.some((r) => t < r.end && slotEnd > r.start);
    if (overlaps) continue;
    const h = String(Math.floor(t / 60)).padStart(2, "0");
    const m = String(t % 60).padStart(2, "0");
    slots.push(`${h}:${m}`);
  }
  return slots;
}

/** Groups "HH:MM" slots into morning/afternoon/evening buckets for display. */
export function groupSlotsByPeriod(slots: string[]) {
  const morning = slots.filter((s) => Number(s.split(":")[0]) < 12);
  const afternoon = slots.filter((s) => { const h = Number(s.split(":")[0]); return h >= 12 && h < 17; });
  const evening = slots.filter((s) => Number(s.split(":")[0]) >= 17);
  return { morning, afternoon, evening };
}
