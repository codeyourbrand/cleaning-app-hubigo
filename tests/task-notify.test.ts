import { describe, expect, it } from "vitest";
import { getTaskNotifyState } from "@/lib/task-notify";

const base = {
  assignedTo: { id: "u1" },
  checkoutTime: "11:00",
  whatsappSentAt: null,
  whatsappSentToUserId: null,
  whatsappSentCheckoutTime: null,
};

describe("getTaskNotifyState", () => {
  it("has no one to notify without an assignee", () => {
    expect(getTaskNotifyState({ ...base, assignedTo: null })).toBe(
      "NO_ASSIGNEE",
    );
  });

  it("is pending until the assignee has been messaged", () => {
    expect(getTaskNotifyState(base)).toBe("PENDING");
  });

  it("is sent when the assignee and time match what was sent", () => {
    expect(
      getTaskNotifyState({
        ...base,
        whatsappSentAt: new Date(),
        whatsappSentToUserId: "u1",
        whatsappSentCheckoutTime: "11:00",
      }),
    ).toBe("SENT");
  });

  it("flags timing changed when the time is edited after sending", () => {
    expect(
      getTaskNotifyState({
        ...base,
        checkoutTime: "12:30",
        whatsappSentAt: new Date(),
        whatsappSentToUserId: "u1",
        whatsappSentCheckoutTime: "11:00",
      }),
    ).toBe("TIMING_CHANGED");
  });

  it("is pending again when a different cleaner is assigned", () => {
    expect(
      getTaskNotifyState({
        ...base,
        assignedTo: { id: "u2" },
        whatsappSentAt: new Date(),
        whatsappSentToUserId: "u1",
        whatsappSentCheckoutTime: "11:00",
      }),
    ).toBe("PENDING");
  });

  it("treats a missing time as unchanged when it was sent without one", () => {
    expect(
      getTaskNotifyState({
        ...base,
        checkoutTime: null,
        whatsappSentAt: "2026-10-09T10:00:00.000Z",
        whatsappSentToUserId: "u1",
        whatsappSentCheckoutTime: null,
      }),
    ).toBe("SENT");
  });

  it("accepts a plain assignedToUserId instead of the relation", () => {
    expect(
      getTaskNotifyState({ ...base, assignedTo: null, assignedToUserId: "u1" }),
    ).toBe("PENDING");
  });
});
