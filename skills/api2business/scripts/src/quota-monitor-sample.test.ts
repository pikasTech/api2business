import { expect, test } from "bun:test";
import { sampleQuotaMonitor } from "./quota-monitor-sample";

test("quota monitor sample waits for terminal workflow and verifies cache advance", async () => {
  let summaryReads = 0;
  let statusReads = 0;
  const client = {
    async quotaMonitorSample() {
      return { ok: true, workflowId: "wf-sample", runId: "run-1", state: "submitted" };
    },
    async workflowStatus() {
      statusReads += 1;
      return statusReads === 1
        ? { ok: true, workflowId: "wf-sample", state: "running", terminal: false, result: null }
        : { ok: true, workflowId: "wf-sample", runId: "run-1", state: "completed", terminal: true, result: { ok: true, stages: { usage: { ok: true } } } };
    },
    async upstreamQuotaSummary() {
      summaryReads += 1;
      return summaryReads === 1
        ? { sampledAt: "2026-11-25T03:00:00.000Z", knownWallets: 49, unknownWallets: 12 }
        : { sampledAt: "2026-11-25T04:00:00.000Z", knownWallets: 49, unknownWallets: 12 };
    },
  };
  let clock = 0;
  const result = await sampleQuotaMonitor(client, {
    timeoutMs: 10_000,
    pollIntervalMs: 100,
    now: () => clock,
    sleep: async (milliseconds) => { clock += milliseconds; },
  });
  expect(result).toMatchObject({
    ok: true,
    action: "upstream-quota-sample",
    state: "completed",
    baselineSampledAt: "2026-11-25T03:00:00.000Z",
    sampledAt: "2026-11-25T04:00:00.000Z",
    cacheAdvanced: true,
    resultOk: true,
  });
  expect(statusReads).toBe(2);
});

test("quota monitor sample reports timeout without reading the cache as complete", async () => {
  const client = {
    async quotaMonitorSample() {
      return { ok: true, workflowId: "wf-timeout", runId: "run-2", state: "submitted" };
    },
    async workflowStatus() {
      return { ok: true, workflowId: "wf-timeout", state: "running", terminal: false, result: null };
    },
    async upstreamQuotaSummary() {
      return { sampledAt: "2026-11-25T03:00:00.000Z" };
    },
  };
  let clock = 0;
  const result = await sampleQuotaMonitor(client, {
    timeoutMs: 250,
    pollIntervalMs: 100,
    now: () => clock,
    sleep: async (milliseconds) => { clock += milliseconds; },
  });
  expect(result).toMatchObject({
    ok: false,
    timedOut: true,
    workflowId: "wf-timeout",
  });
  expect(result).not.toHaveProperty("cacheAdvanced");
  expect(String(result.next)).toContain("workflow status --id wf-timeout");
});

test("quota monitor sample rejects a completed workflow when the cache does not advance", async () => {
  const client = {
    async quotaMonitorSample() {
      return { ok: true, workflowId: "wf-stale", runId: "run-3", state: "submitted" };
    },
    async workflowStatus() {
      return {
        ok: true,
        workflowId: "wf-stale",
        runId: "run-3",
        state: "completed",
        terminal: true,
        result: { ok: true, stages: { usage: { ok: true, error: null } } },
      };
    },
    async upstreamQuotaSummary() {
      return { sampledAt: "2026-11-25T03:00:00.000Z", knownWallets: 49, unknownWallets: 12 };
    },
  };
  const result = await sampleQuotaMonitor(client, {
    timeoutMs: 10_000,
    now: () => 0,
    sleep: async () => undefined,
  });
  expect(result).toMatchObject({
    ok: false,
    state: "completed",
    baselineSampledAt: "2026-11-25T03:00:00.000Z",
    sampledAt: "2026-11-25T03:00:00.000Z",
    cacheAdvanced: false,
    resultOk: true,
  });
  expect(result.next).toBe("inspect workflow status and quota-summary cache before retrying");
});
