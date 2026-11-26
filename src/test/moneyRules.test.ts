import { describe, it, expect } from "vitest";
import { calculateRefund } from "../../api/_lib/cancellation-policy";
import { refundBasis } from "../../api/_lib/refunds";
import { wantsEmail } from "../../api/_lib/db";

const H = 3600_000;

describe("calculateRefund — the patient's payment is returned OR paid to the therapist, never both", () => {
  const now = new Date("2027-01-06T12:00:00Z");
  const at = (h: number) => new Date(now.getTime() + h * H);
  it.each([
    [48, 100, 0, "full-refund"],
    [10, 70, 30, "partial-refund"],
    [1, 0, 100, "no-refund"],
    [-1, 0, 100, "no-show"],
  ])("%sh before → %s%% refund, %s%% compensation", (h, refund, comp, tier) => {
    const r = calculateRefund(at(h as number), now);
    expect(r).toEqual({ refundPercent: refund, compensationPercent: comp, policyTier: tier });
    expect(r.refundPercent + r.compensationPercent).toBe(100);
  });
});

describe("refundBasis — rescheduling does not reset the cancellation clock", () => {
  it("uses booked_at when the session was never moved", () => {
    expect(refundBasis({ booked_at: "2027-01-10T09:00:00Z" }).toISOString()).toBe("2027-01-10T09:00:00.000Z");
  });
  it("uses the original (earlier) date after a reschedule to later", () => {
    const basis = refundBasis({ booked_at: "2027-01-17T09:00:00Z", policy_anchor_at: "2027-01-06T15:00:00Z" });
    expect(basis.toISOString()).toBe("2027-01-06T15:00:00.000Z");
    // 3 h before the original slot: the moved session must NOT be 100 % refundable
    expect(calculateRefund(basis, new Date("2027-01-06T12:00:00Z")).refundPercent).toBe(70);
  });
  it("uses the new date when it was moved earlier", () => {
    expect(refundBasis({ booked_at: "2027-01-08T09:00:00Z", policy_anchor_at: "2027-01-10T09:00:00Z" }).toISOString()).toBe("2027-01-08T09:00:00.000Z");
  });
});

describe("wantsEmail — therapist e-mail switches are honoured", () => {
  it("always e-mails patients", () => {
    expect(wantsEmail({ userType: "patient", prefs: { messages: false } }, "messages")).toBe(true);
  });
  it("uses the UI defaults for therapists (messages off, rest on)", () => {
    expect(wantsEmail({ userType: "psychologue", prefs: {} }, "messages")).toBe(false);
    expect(wantsEmail({ userType: "psychologue", prefs: {} }, "newBookings")).toBe(true);
  });
  it("respects an explicit choice", () => {
    expect(wantsEmail({ userType: "psychologue", prefs: { reminders: false } }, "reminders")).toBe(false);
    expect(wantsEmail({ userType: "psychologue", prefs: { messages: true } }, "messages")).toBe(true);
  });
});
