import { describe, expect, test } from "bun:test";
import { createLoginThrottle } from "./login-throttle";

describe("login throttle", () => {
  test("allows failures below the threshold", () => {
    const throttle = createLoginThrottle({ maxFailures: 5, windowMs: 60_000, lockoutMs: 300_000, now: () => 0 });
    for (let i = 0; i < 4; i += 1) {
      throttle.recordFailure();
      expect(throttle.isBlocked()).toBe(false);
    }
  });

  test("blocks after reaching the threshold and reports retry-after", () => {
    let now = 1_000;
    const throttle = createLoginThrottle({ maxFailures: 3, windowMs: 60_000, lockoutMs: 30_000, now: () => now });
    throttle.recordFailure();
    throttle.recordFailure();
    throttle.recordFailure();
    expect(throttle.isBlocked()).toBe(true);
    expect(throttle.retryAfterSeconds()).toBe(30);
    now += 29_500;
    expect(throttle.isBlocked()).toBe(true);
    now += 600;
    expect(throttle.isBlocked()).toBe(false);
  });

  test("expires failures outside the rolling window", () => {
    let now = 0;
    const throttle = createLoginThrottle({ maxFailures: 3, windowMs: 10_000, lockoutMs: 60_000, now: () => now });
    throttle.recordFailure();
    throttle.recordFailure();
    now += 11_000;
    throttle.recordFailure();
    expect(throttle.isBlocked()).toBe(false);
  });

  test("success clears accumulated failures", () => {
    const throttle = createLoginThrottle({ maxFailures: 3, windowMs: 60_000, lockoutMs: 60_000, now: () => 0 });
    throttle.recordFailure();
    throttle.recordFailure();
    throttle.recordSuccess();
    throttle.recordFailure();
    throttle.recordFailure();
    expect(throttle.isBlocked()).toBe(false);
  });

  test("a blocked window is not extended by continued failures", () => {
    let now = 0;
    const throttle = createLoginThrottle({ maxFailures: 1, windowMs: 1_000, lockoutMs: 60_000, now: () => now });
    throttle.recordFailure();
    expect(throttle.isBlocked()).toBe(true);
    now += 30_000;
    throttle.recordFailure();
    expect(throttle.retryAfterSeconds()).toBe(30);
    now += 30_000;
    expect(throttle.isBlocked()).toBe(false);
  });
});
