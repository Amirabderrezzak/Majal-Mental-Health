import { describe, it, expect } from "vitest";
import { getAvailableSlots, groupSlotsByPeriod, ClinicSettings, algiersSlotToDate } from "@/lib/availability";

const tightWindow: ClinicSettings = {
  vacationMode: false,
  startHour: "09:00",
  endHour: "12:00",
  bufferMinutes: 15,
  workingDays: ["Sun", "Mon", "Tue", "Wed", "Thu"],
};

const wideWindow: ClinicSettings = {
  ...tightWindow,
  startHour: "09:00",
  endHour: "18:00",
};

// A Wednesday (working day) far enough in the future that "today" logic never kicks in.
const WEDNESDAY = new Date(2027, 0, 6); // 2027-01-06 is a Wednesday
const SATURDAY = new Date(2027, 0, 9); // non-working day by default

describe("getAvailableSlots", () => {
  it("returns nothing when vacationMode is on", () => {
    const slots = getAvailableSlots(WEDNESDAY, { ...tightWindow, vacationMode: true }, []);
    expect(slots).toEqual([]);
  });

  it("returns nothing on a day not in workingDays", () => {
    const slots = getAvailableSlots(SATURDAY, tightWindow, []);
    expect(slots).toEqual([]);
  });

  it("generates 30-minute slots within working hours, stopping once a 60-minute session no longer fits", () => {
    const slots = getAvailableSlots(WEDNESDAY, tightWindow, [], 60);
    // 09:00-12:00 window: last slot that still ends by 12:00 is 11:00 (11:00-12:00).
    expect(slots).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });

  it("excludes slots that overlap an existing booking plus buffer, keeps ones that don't", () => {
    // Booked 12:00-13:00, padded by a 15min buffer -> busy 11:45-13:15.
    const existing = [{ booked_at: algiersSlotToDate(2027, 0, 6, "12:00").toISOString(), duration_minutes: 60 }];
    const slots = getAvailableSlots(WEDNESDAY, wideWindow, existing, 60);

    // A slot ending after 11:45 or starting before 13:15 overlaps the padded busy window.
    expect(slots).not.toContain("11:00"); // 11:00-12:00 ends at 12:00, after busy start 11:45
    expect(slots).not.toContain("11:30"); // 11:30-12:30 overlaps directly
    expect(slots).not.toContain("12:30"); // 12:30-13:30 overlaps directly
    expect(slots).not.toContain("13:00"); // 13:00-14:00 starts before busy end 13:15

    // Clear of the padded window on both sides.
    expect(slots).toContain("10:00"); // 10:00-11:00 ends well before 11:45
    expect(slots).toContain("13:30"); // 13:30-14:30 starts after busy end 13:15
  });

  it("ignores bookings on a different day", () => {
    const existing = [{ booked_at: algiersSlotToDate(2027, 0, 7, "10:00").toISOString(), duration_minutes: 60 }];
    const slots = getAvailableSlots(WEDNESDAY, wideWindow, existing, 60);
    expect(slots).toContain("10:00");
  });

  it("excludes past times for today but keeps future ones", () => {
    const now = algiersSlotToDate(2027, 0, 6, "10:15"); // Wednesday 10:15
    const slots = getAvailableSlots(WEDNESDAY, wideWindow, [], 60, now);
    expect(slots).not.toContain("09:00");
    expect(slots).not.toContain("10:00");
    expect(slots).toContain("10:30");
  });

  it("falls back to sane defaults when clinicSettings is null", () => {
    const slots = getAvailableSlots(WEDNESDAY, null, []);
    expect(slots.length).toBeGreaterThan(0);
  });
});

describe("groupSlotsByPeriod", () => {
  it("buckets slots into morning/afternoon/evening", () => {
    const { morning, afternoon, evening } = groupSlotsByPeriod(["09:00", "11:30", "14:00", "16:30", "18:00", "19:30"]);
    expect(morning).toEqual(["09:00", "11:30"]);
    expect(afternoon).toEqual(["14:00", "16:30"]);
    expect(evening).toEqual(["18:00", "19:30"]);
  });
});
