import { describe, it, expect } from "vitest";
import { validateBookingSlot } from "../../api/_lib/slots";

// Sunday 6 Dec 2026, a working day; "now" is a week earlier.
const now = new Date("2026-11-29T08:00:00Z");
const psy = { user_type: "psychologue", approval_status: "approved", clinic_settings: { startHour: "09:00", endHour: "17:00", workingDays: ["Sun", "Mon", "Tue", "Wed", "Thu"], bufferMinutes: 15 } };
const base = { patientId: "pat", psychologistId: "psy", psychologist: psy, now };
const at = (iso: string) => ({ ...base, bookedAt: iso });
const existing = [{ id: "other", booked_at: "2026-12-06T09:00:00Z", duration_minutes: 60, status: "confirmed", patient_id: "x" }]; // 10:00–11:00 Algiers

describe("therapist-approved times (reschedule requests)", () => {
  it("a Saturday evening is refused for a normal booking but allowed once the therapist approves", () => {
    const sat = "2026-12-05T18:00:00Z"; // Saturday 19:00 Algiers
    expect(validateBookingSlot({ ...at(sat), existing: [] }).ok).toBe(false);
    expect(validateBookingSlot({ ...at(sat), existing: [], therapistApproved: true }).ok).toBe(true);
  });

  it("allows quarter-hour times only when approved", () => {
    const q = "2026-12-06T13:15:00Z"; // 14:15 Algiers
    expect(validateBookingSlot({ ...at(q), existing: [] }).ok).toBe(false);
    expect(validateBookingSlot({ ...at(q), existing: [], therapistApproved: true }).ok).toBe(true);
  });

  it("still refuses an overlap with another session", () => {
    const r = validateBookingSlot({ ...at("2026-12-06T09:30:00Z"), existing, therapistApproved: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/déjà une séance/);
  });

  it("drops the buffer (the therapist chose it), so back-to-back is fine", () => {
    expect(validateBookingSlot({ ...at("2026-12-06T10:00:00Z"), existing }).ok).toBe(false); // 15 min buffer
    expect(validateBookingSlot({ ...at("2026-12-06T10:00:00Z"), existing, therapistApproved: true }).ok).toBe(true);
  });

  it("still refuses past times and unapproved therapists", () => {
    expect(validateBookingSlot({ ...at("2026-11-28T10:00:00Z"), existing: [], therapistApproved: true }).ok).toBe(false);
    expect(validateBookingSlot({ ...at("2026-12-06T13:00:00Z"), existing: [], therapistApproved: true, psychologist: { ...psy, approval_status: "pending" } }).ok).toBe(false);
  });
});
