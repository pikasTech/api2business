import { describe, expect, test } from "bun:test";
import { summarizeErrorCommitStage } from "./error-commit-stage";

describe("error commit-stage projection", () => {
  test("projects only the response commit markers from system log extras", () => {
    const result = summarizeErrorCommitStage("request-1", [{
      id: "1",
      created_at: "2026-11-16T05:43:33.263Z",
      account_id: "1496",
      message: "openai.forward_failed",
      extra: {
        account_id: 1496,
        component: "handler.openai_gateway.responses",
        upstream_error_response_already_written: true,
        fallback_error_response_written: false,
        authorization: "must-not-be-projected",
      },
    }]);

    expect(result).toMatchObject({
      ok: true,
      complete: true,
      missingReason: null,
      evidenceCount: 1,
      upstreamErrorResponseAlreadyWritten: true,
      fallbackErrorResponseWritten: false,
      events: [{
        accountId: 1496,
        component: "handler.openai_gateway.responses",
        upstreamErrorResponseAlreadyWritten: true,
        fallbackErrorResponseWritten: false,
      }],
    });
    expect(JSON.stringify(result)).not.toContain("must-not-be-projected");
  });

  test("marks missing system-log evidence as incomplete", () => {
    expect(summarizeErrorCommitStage("request-2", [])).toMatchObject({
      ok: true,
      complete: false,
      missingReason: "no_system_logs_for_request",
      evidenceCount: 0,
      upstreamErrorResponseAlreadyWritten: false,
      fallbackErrorResponseWritten: false,
      failoverSuppressedAfterSemanticOutput: false,
    });
  });
});
