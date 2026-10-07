import { describe, expect, it } from "vitest";
import {
  buildTaskAssignedMessage,
  buildTaskCreatedMessage,
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
