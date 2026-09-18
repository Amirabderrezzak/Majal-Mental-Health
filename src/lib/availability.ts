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

  const dayKey = DAY_KEYS[date.getDay()];
  if (!settings.workingDays?.includes(dayKey)) return [];

  const startMin = parseHourMinute(settings.startHour || DEFAULT_CLINIC_SETTINGS.startHour);
  const endMin = parseHourMinute(settings.endHour || DEFAULT_CLINIC_SETTINGS.endHour);
  const buffer = settings.bufferMinutes ?? 0;
  if (endMin <= startMin) return [];

  // Busy windows, padded by the buffer on both sides, in minutes-of-day.
  const busyRanges = existingBookings.filter((b) => b.booked_at).map((b) => {
    const start = new Date(b.booked_at!);
    const startOfDayMin = start.getHours() * 60 + start.getMinutes();
    const duration = b.duration_minutes ?? DEFAULT_SESSION_DURATION_MINUTES;
    return {
      start: startOfDayMin - buffer,
      end: startOfDayMin + duration + buffer,
      dateKey: start.toDateString(),
    };
  }).filter((r) => r.dateKey === date.toDateString());

  const isToday = date.toDateString() === now.toDateString();
  const nowMin = now.getHours() * 60 + now.getMinutes();

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
