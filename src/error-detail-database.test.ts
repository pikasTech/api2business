import { expect, test } from "bun:test";
import { errorGetQuery, errorListQuery, errorProbeCountQuery, projectErrorDetailRow } from "./error-detail-database";

test("error detail queries are bounded and request scoped", () => {
  expect(errorListQuery).toContain("LIMIT $1");
  expect(errorListQuery).toContain("candidate_errors AS MATERIALIZED");
  expect(errorListQuery).toContain("selected_errors AS MATERIALIZED");
  expect(errorListQuery).toContain("WHERE NOT probe");
  expect(errorListQuery).toContain("usage_recovery_keys AS MATERIALIZED");
  expect(errorListQuery).toContain("terminal_policy_keys AS MATERIALIZED");
  expect(errorListQuery).toContain("system_log_evidence AS MATERIALIZED");
  expect(errorListQuery).toContain("ORDER BY created_at DESC, id DESC");
  expect(errorListQuery).not.toContain("OR success.request_id IN");
  expect(errorListQuery).not.toContain("WHERE (COALESCE(status_code, 0) >= 400");
  expect(errorListQuery).not.toContain("COALESCE(is_business_limited, false) = false");
  expect(errorListQuery).toContain("COALESCE(o.status_code, 0) >= 400");
  expect(errorListQuery).toContain("COALESCE(o.upstream_status_code, 0) >= 400");
  expect(errorGetQuery).toContain("WHERE request_id = $1");
  expect(errorGetQuery).toContain('o.request_id = terminal.request_id');
  expect(errorGetQuery).toContain("'badGateway'");
  expect(errorGetQuery).toContain("'gatewayTimeout'");
  expect(errorGetQuery).toContain("'streamInterrupted'");
  expect(errorGetQuery).toContain("'insufficientCredits'");
  expect(errorGetQuery).toContain("'laneLocked'");
  expect(errorGetQuery).toContain("our free model is holding this lane shut locally");
  expect(errorGetQuery).toContain("insufficient account balance");
  expect(errorGetQuery).toContain("error_phase");
  expect(errorListQuery).not.toContain("SET TRANSACTION READ ONLY");
  expect(errorProbeCountQuery).toContain("COUNT(*)::int AS probe_rows_excluded");
  expect(errorProbeCountQuery).toContain("WHERE probe");
});

test("error detail projection masks identity and excludes bodies", () => {
  const row = projectErrorDetailRow({
    id: 1,
    request_id: "req-1",
    user_email: "Hi-ShuXS@test.com",
    api_key_name: "CODEX",
    api_key_prefix: "sk-63860",
    account_id: 65,
    account_name: "https://errors.example.com plus 0.035",
    display_status_code: 503,
    recorded_status_code: 499,
    upstream_status_code: 503,
    recovered: false,
    stable_phrases: { modelNotFound: true },
    created_at: new Date("2026-07-27T08:03:34Z"),
    error_body: "must not escape",
  }, "Asia/Shanghai");
  expect(row.user).toBe("Hi-***");
  expect(row.customerVisible).toBeTrue();
  expect(row.statusCode).toBe(503);
  expect(row.recordedStatusCode).toBe(499);
  expect(row.upstreamStatusCode).toBe(503);
  expect(row).not.toHaveProperty("error_body");
});

test("upstream-only status is customer-visible", () => {
  const row = projectErrorDetailRow({
    id: 4,
    recorded_status_code: null,
    upstream_status_code: 503,
  }, "Asia/Shanghai");
  expect(row.customerVisible).toBeTrue();
});

test("error category follows Sub2API native phase and type mapping", () => {
  const row = projectErrorDetailRow({
    id: 2,
    error_phase: "request",
    error_type: "api_error",
    category: "quota",
    recorded_status_code: 502,
  }, "Asia/Shanghai");
  expect(row.category).toBe("quota");
  expect(row.customerVisible).toBeTrue();
});

test("OpenCode Free lane lock is projected as a shared-outlet failure", () => {
  const row = projectErrorDetailRow({
    id: 7,
    status_code: 429,
    display_status_code: 429,
    upstream_status_code: 429,
    error_phase: "upstream",
    error_type: "upstream_error",
    category: "rate_limit",
    upstream_error_detail: "Free usage limit reached. recorded at 2026-11-25T09:30:00Z; lifts at 2026-11-25T10:00:00Z",
  }, "Asia/Shanghai");

  expect(row.category).toBe("lane_locked");
  expect(row.stablePhrases).toMatchObject({ laneLocked: true });
  expect(row.laneLock).toMatchObject({
    classification: "lane_locked",
    failureScope: "shared-outlet",
    accountScoped: false,
    accountSwitchCanBypass: false,
    recordedAt: "2026-11-25T09:30:00.000Z",
    liftsAt: "2026-11-25T10:00:00.000Z",
  });
});

test("native error list keeps business-limited rows visible", () => {
  const row = projectErrorDetailRow({
    id: 3,
    error_phase: "request",
    error_type: "billing_error",
    category: "quota",
    recorded_status_code: 429,
    display_status_code: 429,
    is_business_limited: true,
    error_message: "insufficient account balance",
  }, "Asia/Shanghai");
  expect(row.businessLimited).toBeTrue();
  expect(row.category).toBe("quota");
  expect(row.customerVisible).toBeTrue();
});

test("routing upstream unavailable does not inherit an ambiguous business flag", () => {
  const row = projectErrorDetailRow({
    id: 8,
    account_id: 1604,
    error_phase: "routing",
    error_type: "api_error",
    category: "quota",
    recorded_status_code: 503,
    display_status_code: 503,
    upstream_status_code: 503,
    is_business_limited: true,
    upstream_error_detail: '{"error":{"code":503,"message":"No available Gemini accounts: no available accounts","status":"INTERNAL"}}',
  }, "Asia/Shanghai");
  expect(row.businessLimited).toBeFalse();
  expect(row.category).toBe("quota");
  expect(row.customerVisible).toBeTrue();
});

test("response evidence is bounded and redacts credentials", () => {
  const row = projectErrorDetailRow({
    id: 1,
    error_message: "upstream request failed",
    upstream_error_detail: "Bearer secret-token authorization=sk-secret",
    created_at: new Date("2026-08-21T00:00:00Z"),
  }, "Asia/Shanghai");
  expect(row.responseEvidence).toMatchObject({ available: true, source: "upstreamErrorDetail" });
  expect(JSON.stringify(row.responseEvidence)).not.toContain("secret-token");
  expect(JSON.stringify(row.responseEvidence)).not.toContain("sk-secret");
  expect(String((row.responseEvidence as Record<string, unknown>).summary).length).toBeLessThanOrEqual(512);
});

test("probe key rows are flagged and not customer visible", () => {
  const probeRow = projectErrorDetailRow({
    id: 5,
    request_id: "probe-1",
    api_key_name: "api2business-probe-368",
    group_name: "api2business-probe-368",
    probe: true,
    upstream_status_code: 403,
    recorded_status_code: 503,
  }, "Asia/Shanghai");
  expect(probeRow.probe).toBeTrue();
  expect(probeRow.customerVisible).toBeFalse();
  const realRow = projectErrorDetailRow({
    id: 6,
    request_id: "real-1",
    api_key_name: "CODEX",
    group_name: "default",
    probe: false,
    upstream_status_code: 502,
  }, "Asia/Shanghai");
  expect(realRow.probe).toBeFalse();
  expect(realRow.customerVisible).toBeTrue();
});

test("error list projection exposes probe detection for downstream filtering", () => {
  expect(errorListQuery).toContain("AS probe");
  expect(errorListQuery).toContain("api2business-probe-%");
});

test("error list accepts a bounded observation window", () => {
  expect(errorListQuery).toContain("o.created_at >= $2::timestamptz");
  expect(errorListQuery).toContain("o.created_at < $3::timestamptz");
});
