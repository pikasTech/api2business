import { expect, test } from "bun:test";
import { assertErrorsQueryBounds, assertObservationWindow, assertSchedulingRuntimeQuery, normalizeCliArgs, parseArgs, poolQualityScope, priorityHistoryDiagnostics, readSecretLine, selectPriorityHistory, summarizeWorkflowStatus } from "./cli";
import { operationHelp, priorityHistoryHelp, rechargeCandidatesHelp, upstreamsUsageCacheHelp, upstreamsUsageHelp, upstreamWriteHelp } from "./operation-help";
import { webProbeElementArgs } from "./web-screenshot";

test("historical balance CLI accepts signed USD without consuming the next option", () => {
  const args = ["--config", "config/api2business.yaml", "upstreams", "usage-cache", "restore"];
  for (const remaining of ["-0.00203599", "0", "15.5"]) {
    const parsed = parseArgs([...args, "--remaining-usd", remaining, "--confirm"]);
    expect(parsed.remainingUsd).toBe(Number(remaining));
    expect(parsed.confirm).toBe(true);
    expect(parsed.command).toEqual(["upstreams", "usage-cache", "restore"]);
  }
  for (const invalid of ["--confirm", "NaN", "Infinity", ""]) {
    expect(() => parseArgs([...args, "--remaining-usd", invalid])).toThrow();
  }
  expect(() => parseArgs([...args, "--over-api", "--confirm"])).toThrow();
  const screenshot = parseArgs(["--config", "config/api2business.yaml", "web", "screenshot", "--click-selector", "th[data-sort-key=remaining]", "--selector", "#v2-history-table", "--full-page"]);
  expect(screenshot.clickSelector).toBe("th[data-sort-key=remaining]");
  expect(screenshot.selector).toBe("#v2-history-table");
  expect(screenshot.fullPage).toBe(true);
  expect(screenshot.command).toEqual(["web", "screenshot"]);
  expect(webProbeElementArgs(screenshot.clickSelector, screenshot.selector)).toEqual([
    "--click-selector", "th[data-sort-key=remaining]",
    "--selector", "#v2-history-table",
  ]);
  expect(() => parseArgs(["--config", "config/api2business.yaml", "web", "screenshot", "--selector"])).toThrow("--selector requires a value");
});

test("CLI uses the repository config only when --config is omitted", () => {
  const defaultConfig = "config/api2business.yaml";
  expect(normalizeCliArgs(["scores", "rank"], defaultConfig)).toEqual(["--config", defaultConfig, "scores", "rank"]);
  const explicit = ["--config", "config/custom.yaml", "scores", "rank"];
  expect(normalizeCliArgs(explicit, defaultConfig)).toEqual(explicit);
  expect(normalizeCliArgs(["scores", "rank"], null)).toEqual(["scores", "rank"]);
  expect(() => parseArgs(normalizeCliArgs(["scores", "rank"], null)))
    .toThrow("run from the Api2Business repository root");
});

test("errors CLI rejects out-of-range limit and top before the API call", () => {
  expect(() => assertErrorsQueryBounds(200, 60)).not.toThrow();
  expect(() => assertErrorsQueryBounds(undefined, 100)).not.toThrow();
  expect(() => assertErrorsQueryBounds(undefined, 200)).toThrow("errors --top 必须是 1–100 的整数");
  expect(() => assertErrorsQueryBounds(10001, 10)).toThrow("errors --limit 必须是 1–10000 的整数");
  expect(() => assertErrorsQueryBounds(0, 10)).toThrow("errors --limit 必须是 1–10000 的整数");
});

test("errors CLI rejects invalid or future observation windows locally", () => {
  const now = Date.parse("2026-11-13T19:44:30Z");
  expect(() => assertObservationWindow("2026-11-13T19:30:00Z", "2026-11-13T19:44:00Z", now)).not.toThrow();
  expect(() => assertObservationWindow(null, null, now)).not.toThrow();
  expect(() => assertObservationWindow("2026-11-13T19:30:00Z", "2026-11-13T19:46:00Z", now))
    .toThrow("errors --end 不能晚于当前时间");
  expect(() => assertObservationWindow("2026-11-13T19:44:00Z", "2026-11-13T19:30:00Z", now))
    .toThrow("errors --start 必须早于 --end");
  expect(() => assertObservationWindow("not-a-time", null, now))
    .toThrow("errors --start 必须是可解析的 ISO 时间");
});

test("operation help returns action-specific contracts without loading config", () => {
  const reconcile = operationHelp(["accounts", "idle-probe", "--scope", "codex", "reconcile", "--confirm", "--help"]);
  expect(reconcile).toMatchObject({ ok: true, command: "accounts idle-probe reconcile" });
  expect(String(reconcile?.usage)).toContain("accounts idle-probe reconcile");
  expect(String(reconcile?.usage)).toContain("--confirm");
  expect(String(reconcile?.verification)).toContain("coverage");
  expect(JSON.stringify(reconcile)).toContain("仓库根自动读取");

  const coverage = operationHelp(["accounts", "idle-probe", "coverage", "--help"]);
  expect(coverage).toMatchObject({ ok: true, command: "accounts idle-probe coverage" });
  expect(String(coverage?.usage)).toContain("accounts idle-probe coverage");
  expect(String(coverage?.usage)).toContain("--window-minutes");
  expect(JSON.stringify(coverage)).toContain("<configured-scope>");
  expect(JSON.stringify(coverage)).not.toContain("codex|claude|grok");

  const snapshot = operationHelp(["upstream-scheduling-v2", "--scope", "codex", "snapshot", "--help"]);
  expect(snapshot).toMatchObject({ ok: true, command: "upstream-scheduling-v2 snapshot" });
  expect(String(snapshot?.usage)).toContain("--cache-only");
  expect(String(snapshot?.verification)).toContain("complete=true");
  expect(JSON.stringify(snapshot)).toContain("<configured-scope>");
  expect(JSON.stringify(snapshot)).not.toContain("codex|claude|grok");

  const priorityRun = operationHelp(["upstream-scheduling-v2", "priority-run", "--help"]);
  expect(priorityRun).toMatchObject({ ok: true, command: "upstream-scheduling-v2 priority-run" });
  expect(String(priorityRun?.usage)).toContain("--confirm");
  expect(JSON.stringify(priorityRun)).toContain("<configured-scope>");
  expect(JSON.stringify(priorityRun)).not.toContain("codex|claude|grok");

  const priorityHistory = priorityHistoryHelp();
  expect(priorityHistory).toMatchObject({ ok: true, command: "priority history" });
  expect(JSON.stringify(priorityHistory)).toContain("owning YAML");
  expect(JSON.stringify(priorityHistory)).not.toContain("codex、claude");

  const rank = operationHelp(["scores", "rank", "--help"]);
  expect(rank).toMatchObject({ ok: true, command: "scores rank" });
  expect(String(rank?.verification)).toContain("refreshedAt");
  expect(operationHelp(["scores", "get", "--help"])).toBeNull();

  const usage = upstreamsUsageHelp();
  expect(usage).toMatchObject({ ok: true, command: "upstreams usage" });
  expect(String(usage.usage)).toContain("--accounts");
  expect(String(usage.verification)).toContain("quotaWindowCoverage");
  expect(JSON.stringify(usage)).toContain("workflow status");

  const usageCache = operationHelp(["upstreams", "usage-cache", "--help"]);
  expect(usageCache).toMatchObject({ ok: true, command: "upstreams usage-cache" });
  expect(String(usageCache?.usage)).toContain("--accounts");
  expect(String(usageCache?.verification)).toContain("lastSuccessfulAt");
  expect(upstreamsUsageCacheHelp()).toMatchObject({ ok: true, command: "upstreams usage-cache" });

  const rechargeCandidates = operationHelp(["upstreams", "recharge-candidates", "--help"]);
  expect(rechargeCandidates).toMatchObject({ ok: true, command: "upstreams recharge-candidates" });
  expect(String(rechargeCandidates?.verification)).toContain("recommendedCount");
  expect(rechargeCandidatesHelp()).toMatchObject({ ok: true, command: "upstreams recharge-candidates" });

  const errorsAggregate = operationHelp(["errors", "aggregate", "--help"]);
  expect(errorsAggregate).toMatchObject({ ok: true, command: "errors aggregate" });
  expect(String(errorsAggregate?.usage)).toContain("--model");
  expect(String(errorsAggregate?.verification)).toContain("签名");

  const errorsDiagnose = operationHelp(["errors", "diagnose", "--model", "deepseek-v4.1-flash", "--help"]);
  expect(errorsDiagnose).toMatchObject({ ok: true, command: "errors diagnose" });
  expect(String(errorsDiagnose?.usage)).toContain("--request-id");
  expect(String(errorsDiagnose?.verification)).toContain("topN");

  const errorsList = operationHelp(["errors", "list", "--help"]);
  expect(errorsList).toMatchObject({ ok: true, command: "errors list" });
  expect(String(errorsList?.usage)).toContain("--start");
  expect(String(errorsList?.verification)).toContain("probeRowsExcluded");

  const quotaSample = operationHelp(["upstreams", "quota-monitor", "sample", "--help"]);
  expect(quotaSample).toMatchObject({ ok: true, command: "upstreams quota-monitor sample" });
  expect(String(quotaSample?.usage)).toContain("--confirm");
  expect(String(quotaSample?.verification)).toContain("sampledAt");
});

test("upstream operation help stays scoped instead of returning the root command table", () => {
  const create = operationHelp(["upstreams", "create", "--help"]);
  expect(create).toMatchObject({ ok: true, command: "upstreams create" });
  expect(create?.secretInput).toMatchObject({ flag: "--api-key-stdin" });
  expect(JSON.stringify(create)).toContain("恰好一行非空");
  expect(create?.commands).toBeUndefined();

  const template = operationHelp(["upstreams", "template", "-h"]);
  expect(template).toMatchObject({ ok: true, command: "upstreams template" });
  expect(String(template?.verification)).toContain("misalignedCount");
  expect(template?.commands).toBeUndefined();

  const list = operationHelp(["upstreams", "list", "--help"]);
  expect(list).toMatchObject({ ok: true, command: "upstreams list" });
  expect(String(list?.behavior)).toContain("只读");
  expect(list?.commands).toBeUndefined();
  expect(() => operationHelp(["upstreams", "not-an-action", "--help"]))
    .toThrow("unknown upstreams operation not-an-action");
});

test("secret stdin accepts one line and rejects empty or ambiguous input", async () => {
  const nonInteractive = (text: string) => ({
    interactive: false,
    text: async () => text,
    stream: () => { throw new Error("stream must not be read in non-interactive mode"); },
  });
  expect(await readSecretLine("--api-key-stdin", nonInteractive("  one-line-secret  \n"))).toBe("one-line-secret");
  await expect(readSecretLine("--api-key-stdin", nonInteractive(""))).rejects.toThrow("empty stdin");
  await expect(readSecretLine("--api-key-stdin", nonInteractive("first\nsecond\n"))).rejects.toThrow("2 non-empty lines");

  const encoder = new TextEncoder();
  const interactive = (text: string) => ({
    interactive: true,
    text: async () => { throw new Error("text must not be read in interactive mode"); },
    stream: () => new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encoder.encode(text)); controller.close(); } }),
  });
  expect(await readSecretLine("--api-key-stdin", interactive("one-line-secret\nignored-after-enter\n"))).toBe("one-line-secret");
  await expect(readSecretLine("--api-key-stdin", interactive("one-line-secret"))).resolves.toBe("one-line-secret");
});

test("priority history scope keeps matching rounds and discloses omissions", () => {
  const records = [
    { id: "ds", profile: "deepseek", profiles: ["deepseek"], created_by: "v2-scheduler:deepseek" },
    { id: "mixed", profile: "combined", profiles: ["codex", "deepseek"] },
    { id: "cx", profile: "codex", profiles: ["codex"] },
    { id: "oc", profile: "opencode", profiles: ["opencode"], created_by: "v2-scheduler:opencode" },
    { id: "free", profile: "codex", profiles: ["codex"], created_by: "v2-scheduler:opencode-free" },
  ];
  const selected = selectPriorityHistory({ ok: true, records }, "deepseek");
  expect(selected.records).toEqual([
    { id: "ds", profile: "deepseek", profiles: ["deepseek"], created_by: "v2-scheduler:deepseek" },
    { id: "mixed", profile: "combined", profiles: ["codex", "deepseek"] },
  ]);
  expect(selected).toMatchObject({ scope: "deepseek", matchedCount: 2, omittedCount: 3 });
  expect(selectPriorityHistory({ records }, "opencode").records).toEqual([
    { id: "oc", profile: "opencode", profiles: ["opencode"], created_by: "v2-scheduler:opencode" },
  ]);
  expect(selectPriorityHistory({ records }, "opencode-free").records).toEqual([
    { id: "free", profile: "codex", profiles: ["codex"], created_by: "v2-scheduler:opencode-free" },
  ]);
  expect(selectPriorityHistory({ records: [] }, "openai")).toMatchObject({ scope: "openai", matchedCount: 0 });
  expect(selectPriorityHistory({ records: [] }, "opencode-free")).toMatchObject({ scope: "opencode-free", matchedCount: 0 });
  expect(() => selectPriorityHistory({ records: [] }, "OpenCode Free")).toThrow("--scope must be a configured lowercase scope name");
});

test("priority history human diagnostics expose query, snapshot age, block and recovery", () => {
  expect(priorityHistoryDiagnostics({
    score_query_duration_ms: 14731.6,
    score_snapshot_age_seconds: 18300,
    automation_blocked_reasons: ["score-query-slow-or-unknown"],
    recovery_action: "inspect-score-query-and-probe-volume",
  })).toEqual({
    query: "14.73s",
    snapshotAge: "5.1h",
    reason: "score-query-slow-or-unknown",
    recovery: "inspect-score-query-and-probe-volume",
  });
  expect(priorityHistoryDiagnostics({
    failure_reason: "score-query-failed",
    score_error: "sub2api_read_query_timeout: query scores.rank exceeded 15000ms",
  }).reason).toContain("sub2api_read_query_timeout");
});

test("pool quality reads the requested scope and runtime evidence accepts deepseek", () => {
  expect(poolQualityScope(null, null)).toBe("codex");
  expect(poolQualityScope("claude", null)).toBe("claude");
  expect(poolQualityScope(null, "deepseek")).toBe("deepseek");
  expect(poolQualityScope("grok", "grok")).toBe("grok");
  expect(poolQualityScope(null, "gemini")).toBe("gemini");
  expect(poolQualityScope(null, "opencode-free")).toBe("opencode-free");
  expect(() => poolQualityScope("OpenAI", null)).toThrow("<configured-scope>");
  expect(() => poolQualityScope("codex", "claude")).toThrow("same scope");
  expect(assertSchedulingRuntimeQuery("131", "deepseek")).toEqual({ group: "131", platform: "deepseek" });
  expect(assertSchedulingRuntimeQuery("665", "gemini")).toEqual({ group: "665", platform: "gemini" });
  expect(assertSchedulingRuntimeQuery("191", "opencode_go")).toEqual({ group: "191", platform: "opencode_go" });
  expect(assertSchedulingRuntimeQuery("193", "command_code")).toEqual({ group: "193", platform: "command_code" });
  expect(() => assertSchedulingRuntimeQuery("131", "codex")).toThrow("deepseek");
});

test("workflow summary exposes partial initialization and an in-flight probe", () => {
  const summary = summarizeWorkflowStatus({ ok: true, state: "completed", terminal: true,
    result: { ok: false, operation: "initialize", status: "partial", verifiedCount: 1,
      probeVerifiedCount: 0, accounts: [{ accountId: 42, responsesMode: "force_responses" }],
      probes: [{ scope: "codex", skipped: true, reason: "in-flight", verified: false }] } });
  expect(summary).toMatchObject({ resultOk: false, onboardingStatus: "partial", configurationVerified: 1,
    probeVerified: 0, probes: [{ skipped: true, reason: "in-flight" }] });
  expect(summary.nextAction).toContain("upstreams initialize");
});

test("scores rank rejects unsupported --scope instead of silently returning global ranking", () => {
  expect(() => parseArgs(["--config", "config/api2business.yaml", "scores", "rank", "--scope", "claude"]))
    .toThrow("scores rank 不支持 --scope");
  expect(parseArgs(["--config", "config/api2business.yaml", "scores", "rank", "--calls", "100"]).scope).toBeNull();
});

test("upstreams model-alias help stays operation-scoped", () => {
  const help = operationHelp(["upstreams", "model-alias", "--help"]);
  expect(help).toMatchObject({ ok: true, command: "upstreams model-alias" });
  expect(JSON.stringify(help)).toContain("--upstream-model");
});

test("upstream write and status help keep full operation contracts", () => {
  const recover = operationHelp(["upstreams", "recover", "--help"]);
  expect(recover).toMatchObject({ ok: true, command: "upstreams recover" });
  expect(String(recover?.usage)).toContain("upstreams recover --accounts");
  expect(String(recover?.behavior)).toContain("mutation=false");
  expect(String(recover?.verification)).toContain("upstreams status");

  const status = operationHelp(["upstreams", "status", "--help"]);
  expect(status).toMatchObject({ ok: true, command: "upstreams status" });
  expect(String(status?.usage)).toContain("upstreams status --id");
  expect(String(status?.behavior)).toContain("只读");

  const update = operationHelp(["upstreams", "update", "--help"]);
  expect(update).toMatchObject({ ok: true, command: "upstreams update" });
  expect(String(update?.usage)).toContain("--template-only");
  expect(String(update?.verification)).toContain("credentials.base_url");

  const modelsSync = operationHelp(["upstreams", "models", "sync", "--help"]);
  expect(modelsSync).toMatchObject({ ok: true, command: "upstreams models sync" });
  expect(String(modelsSync?.usage)).toContain("upstreams models sync --accounts");
  expect(String(modelsSync?.verification)).toContain("不生成 workflow");
  expect(modelsSync).toEqual(upstreamWriteHelp("models sync"));
});
