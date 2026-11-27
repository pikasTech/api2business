import { expect, test } from "bun:test";
import {
  errorDiagnoseQuery,
  projectErrorDiagnoseRow,
} from "./error-diagnose-database";

test("error diagnosis uses one bounded query for signatures and failover chains", () => {
  expect(errorDiagnoseQuery).toContain("LIMIT $1");
  expect(errorDiagnoseQuery).toContain("selected_errors AS MATERIALIZED");
  expect(errorDiagnoseQuery).toContain("system_log_evidence AS MATERIALIZED");
  expect(errorDiagnoseQuery).toContain("usage_recovery_keys AS MATERIALIZED");
  expect(errorDiagnoseQuery).toContain("terminal_policy_keys AS MATERIALIZED");
  expect(errorDiagnoseQuery).toContain("u.request_id = e.request_id");
  expect(errorDiagnoseQuery).toContain("u.request_id = 'client:' ||");
  expect(errorDiagnoseQuery).toContain('terminal.request_id = e.request_id');
  expect(errorDiagnoseQuery).not.toContain("OR u.request_id IN");
  expect(errorDiagnoseQuery).toContain("GROUP BY request_key");
  expect(errorDiagnoseQuery).toContain("COUNT(DISTINCT account_id)");
  expect(errorDiagnoseQuery).toContain("rank <= $4");
  expect(errorDiagnoseQuery).toContain("rank <= $5");
  expect(errorDiagnoseQuery).toContain("LOWER($7::text)");
  expect(errorDiagnoseQuery).toContain("routing_matrix AS");
  expect(errorDiagnoseQuery).toContain("JSONB_ARRAY_ELEMENTS(chain.attempts)");
  expect(errorDiagnoseQuery).toContain("a.name = $2::text");
  expect(errorDiagnoseQuery).toContain("g.name = $3::text");
  expect(errorDiagnoseQuery).toContain("request_group.id = o.group_id");
  expect(errorDiagnoseQuery).toContain("api2business-probe-%");
  expect(errorDiagnoseQuery).toContain("COALESCE(o.upstream_status_code, 0) >= 400");
  expect(errorDiagnoseQuery).toContain("o.created_at >= $8::timestamptz");
  expect(errorDiagnoseQuery).toContain("o.created_at < $9::timestamptz");
  expect(errorDiagnoseQuery).toContain("probe.id = o.api_key_id");
  expect(errorDiagnoseQuery).not.toContain("account_groups");
  expect(errorDiagnoseQuery).not.toContain("api_key_prefix");
  expect(errorDiagnoseQuery).toContain("message_text LIKE '%insufficient credits%'");
  expect(errorDiagnoseQuery).toContain("our free model is holding this lane shut locally");
  expect(errorDiagnoseQuery).toContain("THEN 'lane_locked'");
  expect(errorDiagnoseQuery).toContain("insufficient account balance");
  expect(errorDiagnoseQuery).toContain("error_phase");
});

test("error diagnosis projection exposes bounded facts without raw payloads", () => {
  const projected = projectErrorDiagnoseRow({
    sampled_error_rows: 5,
    distinct_requests: 3,
    customer_visible_requests: 2,
    recovered_requests: 1,
    failover_triggered_requests: 2,
    failover_recovered_requests: 1,
    failover_failed_requests: 1,
    failover_aborted_requests: 1,
    signatures: [{
      signature: "502:upstream:upstream_error:-:upstream_overloaded",
      stablePhrase: "upstream_overloaded",
      requests: 2,
    }],
    chains: [{ requestId: "request-1", attempts: [{ accountId: 1 }] }],
    routing_matrix: [{ model: "gpt-5.6-terra", accountId: "1", chains: 1, attempts: 2 }],
  });
  expect(projected.summary).toEqual({
    sampledErrorRows: 5,
    distinctRequests: 3,
    customerVisibleRequests: 2,
    recoveredRequests: 1,
    failoverTriggeredRequests: 2,
    failoverRecoveredRequests: 1,
    failoverFailedRequests: 1,
    failoverAbortedRequests: 1,
  });
  expect(projected.analysisHints).toEqual({
    failoverWithoutRecovery: 1,
    unclassifiedSignatures: 0,
  });
  expect(projected.routingMatrix).toEqual([
    { model: "gpt-5.6-terra", accountId: "1", chains: 1, attempts: 2 },
  ]);
  expect(JSON.stringify(projected)).not.toContain("errorBody");
  expect(JSON.stringify(projected)).not.toContain("errorMessage");
});

test("error diagnosis classifies OpenCode Free lane locks before generic 429s", () => {
  const projected = projectErrorDiagnoseRow({
    sampled_error_rows: 1,
    distinct_requests: 1,
    customer_visible_requests: 1,
    signatures: [{ signature: "429:upstream:upstream_error:-:lane_locked", stablePhrase: "lane_locked" }],
    chains: [{
      requestId: "request-lane",
      attempts: [{
        accountId: 1641,
        statusCode: 429,
        upstreamStatusCode: 429,
        upstreamErrorDetail: "Our free model is holding this lane shut locally. Free usage limit reached. recorded at 2026-11-25T09:30:00Z lifts at 2026-11-25T10:00:00Z",
      }],
    }],
  });

  const attempts = ((projected.chains as Array<Record<string, unknown>>)[0].attempts as Array<Record<string, unknown>>);
  expect(attempts[0].laneLock).toMatchObject({
    classification: "lane_locked",
    failureScope: "shared-outlet",
    accountScoped: false,
    accountSwitchCanBypass: false,
    recordedAt: "2026-11-25T09:30:00.000Z",
    liftsAt: "2026-11-25T10:00:00.000Z",
  });
});

test("error diagnosis does not label upstream no-account errors as customer billing", () => {
  const projected = projectErrorDiagnoseRow({
    sampled_error_rows: 1,
    distinct_requests: 1,
    customer_visible_requests: 1,
    chains: [{
      requestId: "request-gemini",
      attempts: [{
        accountId: 1604,
        statusCode: 503,
        upstreamStatusCode: 503,
        phase: "routing",
        upstreamErrorDetail: '{"error":{"code":503,"message":"No available Gemini accounts: no available accounts","status":"INTERNAL"}}',
        businessLimited: true,
      }],
    }],
  });
  const attempts = ((projected.chains as Array<Record<string, unknown>>)[0].attempts as Array<Record<string, unknown>>);
  expect(attempts[0].businessLimited).toBeFalse();
});
