import { expect, test } from "bun:test";
import { readSnapshotAwaitingBackgroundRefresh, snapshotCacheTelemetry } from "./snapshot-read";

function snapshot(state: string, capturedAt: string, complete = true): Record<string, unknown> {
  return { ok: true, cache: { state, capturedAt, complete } };
}

test("snapshot telemetry projects cache state without printing the payload", () => {
  expect(snapshotCacheTelemetry(snapshot("stale", "2026-11-17T01:00:00Z"))).toEqual({
    state: "stale",
    capturedAt: "2026-11-17T01:00:00Z",
    complete: true,
  });
  expect(snapshotCacheTelemetry({})).toEqual({ state: null, capturedAt: null, complete: false });
});

test("fresh snapshot returns on the first read", async () => {
  let reads = 0;
  const result = await readSnapshotAwaitingBackgroundRefresh({
    read: async () => {
      reads += 1;
      return snapshot("hit", "2026-11-17T01:00:00Z");
    },
  });
  expect(reads).toBe(1);
  expect(snapshotCacheTelemetry(result).state).toBe("hit");
});

test("stale snapshot waits for the background rebuild and returns the fresh payload", async () => {
  const payloads = [
    snapshot("stale", "2026-11-16T23:13:58Z"),
    snapshot("stale", "2026-11-16T23:13:58Z"),
    snapshot("hit", "2026-11-17T01:15:10Z"),
  ];
  let reads = 0;
  const result = await readSnapshotAwaitingBackgroundRefresh({
    read: async () => payloads[Math.min(reads++, payloads.length - 1)]!,
    sleep: async () => {},
    now: () => 0,
    timeoutMs: 10_000,
    intervalMs: 1_000,
  });
  expect(reads).toBe(3);
  expect(snapshotCacheTelemetry(result)).toEqual({ state: "hit", capturedAt: "2026-11-17T01:15:10Z", complete: true });
});

test("stale snapshot returns the latest stale payload when the rebuild does not advance in time", async () => {
  let clock = 0;
  let reads = 0;
  const result = await readSnapshotAwaitingBackgroundRefresh({
    read: async () => {
      reads += 1;
      return snapshot("stale", "2026-11-16T23:13:58Z");
    },
    sleep: async (milliseconds) => { clock += milliseconds; },
    now: () => clock,
    timeoutMs: 3_000,
    intervalMs: 1_000,
  });
  expect(reads).toBeGreaterThan(1);
  expect(snapshotCacheTelemetry(result)).toEqual({ state: "stale", capturedAt: "2026-11-16T23:13:58Z", complete: true });
});

test("incomplete stale snapshot is returned immediately instead of waiting", async () => {
  let reads = 0;
  const result = await readSnapshotAwaitingBackgroundRefresh({
    read: async () => {
      reads += 1;
      return snapshot("stale", "2026-11-16T23:13:58Z", false);
    },
    sleep: async () => {},
    now: () => 0,
    timeoutMs: 10_000,
  });
  expect(reads).toBe(1);
  expect(snapshotCacheTelemetry(result).complete).toBe(false);
});
