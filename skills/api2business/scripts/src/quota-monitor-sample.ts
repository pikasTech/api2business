import type { AdminHttpClient } from "../../../../src/admin-http-client";

type Row = Record<string, unknown>;

const TERMINAL_STATES = new Set(["completed", "failed", "cancelled", "terminated", "timed_out", "not_found"]);

export interface QuotaMonitorSampleOptions {
  timeoutMs: number;
  pollIntervalMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  onProgress?: (event: Row) => void;
}

function object(value: unknown): Row | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Row : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function instant(value: unknown): number | null {
  const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

function summaryProjection(value: Row): Row {
  return {
    sampledAt: value.sampledAt ?? null,
    totalRemainingCny: value.totalRemainingCny ?? null,
    schedulableRemainingCny: value.schedulableRemainingCny ?? null,
    unschedulableRemainingCny: value.unschedulableRemainingCny ?? null,
    knownWallets: value.knownWallets ?? null,
    unknownWallets: value.unknownWallets ?? null,
    warning: value.warning ?? null,
    excludedWalletKeys: value.excludedWalletKeys ?? [],
  };
}

function stageProjection(value: Row): Row | null {
  const stages = object(value.stages);
  if (!stages) return null;
  return Object.fromEntries(Object.entries(stages).map(([name, stage]) => {
    const row = object(stage);
    return [name, { ok: row?.ok ?? null, error: row?.error ?? null }];
  }));
}

export async function sampleQuotaMonitor(
  client: Pick<AdminHttpClient, "quotaMonitorSample" | "workflowStatus" | "upstreamQuotaSummary">,
  options: QuotaMonitorSampleOptions,
): Promise<Row> {
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1) throw new Error("timeoutMs must be a positive integer");
  const pollIntervalMs = options.pollIntervalMs ?? 3000;
  if (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 1) throw new Error("pollIntervalMs must be a positive integer");
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? Bun.sleep;

  const baseline = await client.upstreamQuotaSummary();
  const submitted = await client.quotaMonitorSample();
  const workflowId = text(submitted.workflowId);
  if (submitted.ok !== true || !workflowId) {
    return {
      ok: false,
      action: "upstream-quota-sample",
      submittedOk: submitted.ok ?? null,
      workflowId,
      error: text(submitted.error) ?? "quota-monitor sample submission did not return a workflow ID",
      baseline: summaryProjection(baseline),
      valuesPrinted: false,
    };
  }

  const startedAt = now();
  const deadline = startedAt + options.timeoutMs;
  let workflow: Row = submitted;
  while (true) {
    const state = text(workflow.state)?.toLowerCase() ?? "unknown";
    const terminal = workflow.terminal === true || TERMINAL_STATES.has(state);
    const elapsedMs = Math.max(0, now() - startedAt);
    options.onProgress?.({ workflowId, state, terminal, elapsedMs });
    if (terminal) break;
    if (now() >= deadline) {
      return {
        ok: false,
        action: "upstream-quota-sample",
        timedOut: true,
        timeoutMs: options.timeoutMs,
        elapsedMs,
        workflowId,
        runId: submitted.runId ?? null,
        state,
        terminal: false,
        baseline: summaryProjection(baseline),
        next: `workflow status --id ${workflowId} --over-api`,
        valuesPrinted: false,
      };
    }
    await sleep(Math.min(pollIntervalMs, Math.max(1, deadline - now())));
    workflow = await client.workflowStatus(workflowId);
  }

  const state = text(workflow.state)?.toLowerCase() ?? "unknown";
  if (state !== "completed") {
    return {
      ok: false,
      action: "upstream-quota-sample",
      timedOut: false,
      elapsedMs: Math.max(0, now() - startedAt),
      workflowId,
      runId: workflow.runId ?? submitted.runId ?? null,
      state,
      terminal: true,
      error: text(workflow.error) ?? null,
      baseline: summaryProjection(baseline),
      valuesPrinted: false,
    };
  }

  const summary = await client.upstreamQuotaSummary();
  const baselineSampledAt = text(baseline.sampledAt);
  const sampledAt = text(summary.sampledAt);
  const baselineInstant = instant(baselineSampledAt);
  const sampledInstant = instant(sampledAt);
  const cacheAdvanced = sampledInstant !== null && (baselineInstant === null || sampledInstant > baselineInstant);
  const result = object(workflow.result);
  return {
    ok: cacheAdvanced,
    action: "upstream-quota-sample",
    timedOut: false,
    elapsedMs: Math.max(0, now() - startedAt),
    workflowId,
    runId: workflow.runId ?? submitted.runId ?? null,
    state,
    terminal: true,
    resultOk: result?.ok ?? null,
    stages: result ? stageProjection(result) : null,
    baselineSampledAt,
    sampledAt,
    cacheAdvanced,
    summary: summaryProjection(summary),
    next: cacheAdvanced ? null : "inspect workflow status and quota-summary cache before retrying",
    valuesPrinted: false,
  };
}
