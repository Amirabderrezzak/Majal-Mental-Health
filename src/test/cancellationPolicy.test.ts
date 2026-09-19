import { describe, it, expect } from "vitest";
import { getRefundTier } from "@/lib/cancellationPolicy";

const at = (hoursFromNow: number) => {
  const now = new Date("2027-01-06T12:00:00Z");
  return { now, session: new Date(now.getTime() + hoursFromNow * 3600_000) };
};

describe("getRefundTier (mirrors api/_lib/cancellation-policy.ts)", () => {
  it("refunds 100% more than 24h ahead", () => {
    const { now, session } = at(48);
    expect(getRefundTier(session, now)).toEqual({ tier: "full-refund", refundPercent: 100 });
  });
  it("refunds 70% between 2h and 24h ahead", () => {
    const { now, session } = at(10);
    expect(getRefundTier(session, now)).toEqual({ tier: "partial-refund", refundPercent: 70 });
  });
  it("refunds nothing under 2h ahead", () => {
    const { now, session } = at(1);
    expect(getRefundTier(session, now)).toEqual({ tier: "no-refund", refundPercent: 0 });
  });
  it("refunds nothing once the session has started", () => {
    const { now, session } = at(-0.5);
    expect(getRefundTier(session, now)).toEqual({ tier: "no-show", refundPercent: 0 });
  });
  it("treats exactly 24h and exactly 2h as the lower tier (strict >)", () => {
    expect(getRefundTier(at(24).session, at(24).now).tier).toBe("partial-refund");
    expect(getRefundTier(at(2).session, at(2).now).tier).toBe("no-refund");
  });
});
