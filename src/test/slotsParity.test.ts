import { describe, it, expect } from "vitest";
import { getAvailableSlots, algiersSlotToDate, algiersParts, DEFAULT_CLINIC_SETTINGS } from "@/lib/availability";
import { validateBookingSlot } from "../../api/_lib/slots";

// The client (availability.ts) decides which slots to offer; the server
// (api/_lib/slots.ts) decides which to accept. They must never disagree.
const psy = (cs: Record<string, unknown>) => ({ user_type: "psychologue", approval_status: "approved", clinic_settings: cs as any });
const NOW = new Date("2027-01-01T00:00:00Z");
const settings = { ...DEFAULT_CLINIC_SETTINGS, startHour: "09:00", endHour: "13:00", bufferMinutes: 15 };
const existing = [{ id: "b1", booked_at: algiersSlotToDate(2027, 0, 6, "10:00").toISOString(), duration_minutes: 60, status: "confirmed", patient_id: "other" }];

describe("client/server slot parity", () => {
  for (const [label, d] of [["Wednesday", 6], ["Friday (closed)", 8], ["Thursday", 7]] as const) {
    it(`agrees on every half-hour of ${label}`, () => {
      const offered = new Set(getAvailableSlots(new Date(2027, 0, d), settings as any, existing, 60, NOW));
      for (let t = 0; t < 24 * 60; t += 30) {
        const hhmm = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
        const res = validateBookingSlot({
          bookedAt: algiersSlotToDate(2027, 0, d, hhmm).toISOString(),
          patientId: "me", psychologistId: "psy", psychologist: psy(settings), existing, now: NOW,
        });
        expect(res.ok, `${label} ${hhmm}`).toBe(offered.has(hhmm));
      }
    });
  }

  it("reads working hours as Algiers time regardless of machine zone", () => {
    expect(algiersParts(new Date("2027-01-06T08:00:00Z")).minutes).toBe(9 * 60);
    expect(algiersSlotToDate(2027, 0, 6, "09:00").toISOString()).toBe("2027-01-06T08:00:00.000Z");
  });

  it("server rejects a stale-pending-free slot only when the hold is fresh", () => {
    const held = [{ id: "p", booked_at: algiersSlotToDate(2027, 0, 6, "11:00").toISOString(), status: "pending", created_at: new Date(NOW.getTime() - 5 * 60000).toISOString(), patient_id: "x" }];
    const base = { bookedAt: algiersSlotToDate(2027, 0, 6, "11:00").toISOString(), patientId: "me", psychologistId: "psy", psychologist: psy(settings), now: NOW };
    expect(validateBookingSlot({ ...base, existing: held }).ok).toBe(false);
    const stale = [{ ...held[0], created_at: new Date(NOW.getTime() - 40 * 60000).toISOString() }];
    expect(validateBookingSlot({ ...base, existing: stale }).ok).toBe(true);
  });
});
