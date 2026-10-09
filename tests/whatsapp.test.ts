import { describe, expect, it } from "vitest";
import {
  buildTaskAssignedMessage,
  buildTaskCommentedMessage,
  buildTaskCreatedMessage,
  buildTaskTimingChangedMessage,
} from "@/lib/whatsapp";

const task = {
  title: "CHECK_OUT",
  type: "CHECK_OUT",
  apartment: { number: "5805" },
  assignedTo: { name: "Cleaner Test" },
  date: "2026-10-07T00:00:00.000Z",
  checkoutTime: "11:00",
  checkinWindow: "15:00–16:00",
};

describe("WhatsApp task messages", () => {
  it("includes task hours in assignment messages", () => {
    expect(buildTaskAssignedMessage(task)).toContain(
      "Date: 07/10/2026\nCheckout: 11:00\nCheck-in: 15:00–16:00",
    );
  });

  it("omits empty schedule lines", () => {
    const message = buildTaskCreatedMessage({
      ...task,
      checkoutTime: null,
      checkinWindow: null,
    });

    expect(message).toContain("Date: 07/10/2026");
    expect(message).not.toContain("Checkout:");
    expect(message).not.toContain("Check-in:");
  });
});

describe("WhatsApp timing changed message", () => {
  it("is headed TIMING CHANGED and strikes through the old time", () => {
    const message = buildTaskTimingChangedMessage(
      { ...task, checkoutTime: "12:30" },
      "11:00",
    );

    expect(message).toContain("⚠️ *TIMING CHANGED* ⚠️");
    expect(message).toContain("CHECK_OUT — Apt 5805");
    expect(message).toContain("Checkout: ~11:00~ → *12:30*");
    expect(message).toContain("Check-in: 15:00–16:00");
  });

  it("shows only the new time when none was sent before", () => {
    const message = buildTaskTimingChangedMessage(task, null);

    expect(message).toContain("Checkout: *11:00*");
    expect(message).not.toContain("~");
  });

  it("says the time is not set when it was removed", () => {
    const message = buildTaskTimingChangedMessage(
      { ...task, checkoutTime: null },
      "11:00",
    );

    expect(message).toContain("Checkout: ~11:00~ → _not set_");
  });
});

describe("WhatsApp comment message", () => {
  it("names the author and quotes the comment", () => {
    const message = buildTaskCommentedMessage(
      task,
      "Kinga",
      "Key is at reception",
    );

    expect(message).toContain("*Kinga* commented on:");
    expect(message).toContain("CHECK_OUT — Apt 5805");
    expect(message).toContain('"Key is at reception"');
  });

  it("truncates very long comments", () => {
    const message = buildTaskCommentedMessage(task, "Kinga", "x".repeat(500));

    expect(message).toContain(`${"x".repeat(300)}…`);
    expect(message).not.toContain("x".repeat(301));
  });
});
