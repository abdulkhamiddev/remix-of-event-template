import { describe, expect, it } from "vitest";

import { evaluatePasswordStrength, generateStrongPassword } from "@/lib/passwordStrength.ts";

describe("passwordStrength", () => {
  it("generates a strong-looking password with required diversity", () => {
    const password = generateStrongPassword(18);
    expect(password.length).toBeGreaterThanOrEqual(16);
    expect(password.length).toBeLessThanOrEqual(20);
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/\d/.test(password)).toBe(true);
    expect(/[^A-Za-z0-9]/.test(password)).toBe(true);
  });

  it("scores weak and strong passwords differently", () => {
    const weak = evaluatePasswordStrength("12345678", "user@example.com");
    const strong = evaluatePasswordStrength("Str0ng!Passw0rd#2026", "user@example.com");

    expect(weak.label).toBe("Weak");
    expect(strong.label === "OK" || strong.label === "Strong").toBe(true);
    expect(strong.percent).toBeGreaterThan(weak.percent);
  });
});

