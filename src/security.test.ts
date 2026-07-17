import { describe, expect, it } from "vitest";
import {
  cardNameKey,
  normalizeCardName,
  normalizeInviteCode,
  normalizeRsn,
  randomInviteCode,
  randomToken,
  rsnKey,
  sha256,
} from "./security";

describe("RuneScape name handling", () => {
  it("normalizes spaces and underscores", () => {
    expect(normalizeRsn("  Sqwiglyy__HC  ")).toBe("Sqwiglyy HC");
    expect(rsnKey("Sqwiglyy HC")).toBe("sqwiglyy hc");
  });

  it("rejects invalid names", () => {
    expect(normalizeRsn(123)).toBeNull();
    expect(normalizeRsn("this name is too long")).toBeNull();
    expect(normalizeRsn("bad/name")).toBeNull();
  });
});

describe("card names", () => {
  it("normalizes harmless whitespace and makes stable keys", () => {
    expect(normalizeCardName("  Great   Olm ")).toBe("Great Olm");
    expect(cardNameKey("Great Olm")).toBe("great olm");
  });
});

describe("credentials", () => {
  it("creates normalized twelve-character invite codes", () => {
    const code = randomInviteCode();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(normalizeInviteCode(code.toLowerCase().replaceAll("-", " "))).toBe(code);
  });

  it("creates high-entropy URL-safe member tokens", () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("hashes credentials deterministically", async () => {
    expect(await sha256("test")).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
  });
});

