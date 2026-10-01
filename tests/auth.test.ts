import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("should hash and verify a password", async () => {
    const hash = await hashPassword("Hubigo123!");
    expect(hash).not.toBe("Hubigo123!");
    expect(await verifyPassword(hash, "Hubigo123!")).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });
});
