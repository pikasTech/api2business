export interface LoginThrottleOptions {
  maxFailures: number;
  windowMs: number;
  lockoutMs: number;
  now?: () => number;
}

export interface LoginThrottle {
  isBlocked(): boolean;
  retryAfterSeconds(): number;
  recordFailure(): boolean;
  recordSuccess(): void;
}

export const DEFAULT_LOGIN_THROTTLE = { maxFailures: 5, windowMs: 60_000, lockoutMs: 300_000 } as const;

export function createLoginThrottle(options: LoginThrottleOptions = { ...DEFAULT_LOGIN_THROTTLE }): LoginThrottle {
  const maxFailures = Math.max(1, Math.trunc(options.maxFailures));
  const windowMs = Math.max(1, Math.trunc(options.windowMs));
  const lockoutMs = Math.max(1, Math.trunc(options.lockoutMs));
  const now = options.now ?? (() => Date.now());
  let failures: number[] = [];
  let blockedUntil = 0;

  const prune = (at: number): void => {
    const cutoff = at - windowMs;
    if (failures.length > 0 && failures[0] <= cutoff) failures = failures.filter((stamp) => stamp > cutoff);
  };

  return {
    isBlocked(): boolean {
      return now() < blockedUntil;
    },
    retryAfterSeconds(): number {
      const remaining = blockedUntil - now();
      return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    },
    recordFailure(): boolean {
      const at = now();
      if (at < blockedUntil) return true;
      prune(at);
      failures.push(at);
      if (failures.length >= maxFailures) {
        blockedUntil = at + lockoutMs;
        failures = [];
        return true;
      }
      return false;
    },
    recordSuccess(): void {
      failures = [];
      blockedUntil = 0;
    },
  };
}
