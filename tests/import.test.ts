import { describe, it, expect } from "vitest";
import { importRowSchema, csvImportSchema } from "@/lib/schemas";

describe("CSV import schemas", () => {
  it("validates a row", () => {
    const row = {
      apartmentNumber: "157",
      checkoutTime: "11:00",
      checkinWindow: "15:00–16:00",
      guestsCount: 4,
      nightsCount: 3,
      requests: "luggage",
      instructions: "check balcony",
    };
    const parsed = importRowSchema.safeParse(row);
    expect(parsed.success).toBe(true);
  });

  it("rejects empty apartment number", () => {
    const parsed = importRowSchema.safeParse({ apartmentNumber: "" });
    expect(parsed.success).toBe(false);
  });
});
