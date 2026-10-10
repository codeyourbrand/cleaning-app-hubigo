import { describe, expect, it } from "vitest";
import { getTaskNotifyState } from "@/lib/task-notify";

const base = {
  assignedTo: [
    { id: "u1", whatsappSentAt: null, whatsappSentCheckoutTime: null },
  ],
  checkoutTime: "11:00" as string | null,
};

describe("getTaskNotifyState", () => {
  it("has no one to notify without an assignee", () => {
    expect(getTaskNotifyState({ ...base, assignedTo: [] })).toBe("NO_ASSIGNEE");
  });

  it("is pending until every assignee has been messaged", () => {
    expect(getTaskNotifyState(base)).toBe("PENDING");
  });

  it("is sent when all assignees have matching sent state", () => {
    expect(
      getTaskNotifyState({
        ...base,
        assignedTo: [
          {
            id: "u1",
            whatsappSentAt: new Date(),
            whatsappSentCheckoutTime: "11:00",
          },
        ],
      }),
    ).toBe("SENT");
  });

  it("is pending when only some assignees have been messaged", () => {
    expect(
      getTaskNotifyState({
        ...base,
        assignedTo: [
          {
            id: "u1",
            whatsappSentAt: new Date(),
            whatsappSentCheckoutTime: "11:00",
          },
          {
            id: "u2",
            whatsappSentAt: null,
            whatsappSentCheckoutTime: null,
          },
        ],
      }),
    ).toBe("PENDING");
  });

  it("flags timing changed when the time is edited after sending", () => {
    expect(
      getTaskNotifyState({
        ...base,
        checkoutTime: "12:30",
        assignedTo: [
          {
            id: "u1",
            whatsappSentAt: new Date(),
            whatsappSentCheckoutTime: "11:00",
          },
        ],
      }),
    ).toBe("TIMING_CHANGED");
  });

  it("treats a missing time as unchanged when it was sent without one", () => {
    expect(
      getTaskNotifyState({
        ...base,
        checkoutTime: null,
        assignedTo: [
          {
            id: "u1",
            whatsappSentAt: "2026-10-09T10:00:00.000Z",
            whatsappSentCheckoutTime: null,
          },
        ],
      }),
    ).toBe("SENT");
  });
});
