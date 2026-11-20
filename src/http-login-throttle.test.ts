import { describe, expect, test } from "bun:test";
import { authorizeLoginAttempt } from "./http";
import { createLoginThrottle } from "./login-throttle";
import type { AppConfig } from "./config";

const config = { webAuth: { username: "admin", cookieName: "api2business_session", sessionTtlSeconds: 43200 } } as unknown as AppConfig;
const auth = { password: "correct-horse", apiKey: "api-key", sessionSecret: "session-secret" };

describe("login endpoint throttling", () => {
  test("wrong passwords after the threshold become 429 with retry-after", () => {
    const throttle = createLoginThrottle({ maxFailures: 3, windowMs: 60_000, lockoutMs: 60_000, now: () => 0 });
    const results = [0, 0, 0].map(() => authorizeLoginAttempt("admin", "nope", config, auth, throttle));
    expect(results.map((r) => r.status)).toEqual([401, 401, 429]);
    expect(results[2].headers?.["retry-after"]).toBe("60");
  });

  test("a correct password still authenticates while the throttle is blocking", () => {
    const throttle = createLoginThrottle({ maxFailures: 2, windowMs: 60_000, lockoutMs: 60_000, now: () => 0 });
    authorizeLoginAttempt("admin", "nope", config, auth, throttle);
    authorizeLoginAttempt("admin", "nope", config, auth, throttle);
    expect(throttle.isBlocked()).toBe(true);
    const success = authorizeLoginAttempt("admin", "correct-horse", config, auth, throttle);
    expect(success).toEqual({ ok: true, status: 200 });
    expect(throttle.isBlocked()).toBe(false);
  });

  test("unknown usernames count as failures like any wrong credential", () => {
    const throttle = createLoginThrottle({ maxFailures: 2, windowMs: 60_000, lockoutMs: 60_000, now: () => 0 });
    expect(authorizeLoginAttempt("root", "correct-horse", config, auth, throttle).status).toBe(401);
    expect(authorizeLoginAttempt("root", "correct-horse", config, auth, throttle).status).toBe(429);
  });
});
