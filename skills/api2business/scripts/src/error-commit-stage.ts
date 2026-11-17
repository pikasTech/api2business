type Row = Record<string, unknown>;

function record(value: unknown): Row | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Row : null;
}

function boolean(value: unknown): boolean {
  return value === true || value === "true";
}

export function summarizeErrorCommitStage(requestId: string, rows: Row[]): Row {
  const events = rows.map((row) => {
    const extra = record(row.extra) ?? {};
    return {
      id: row.id ?? null,
      createdAt: row.created_at ?? null,
      message: row.message ?? null,
      accountId: extra.account_id ?? row.account_id ?? null,
      component: extra.component ?? null,
      upstreamErrorResponseAlreadyWritten: boolean(extra.upstream_error_response_already_written),
      fallbackErrorResponseWritten: boolean(extra.fallback_error_response_written),
    };
  });
  const messages = events.map((event) => String(event.message ?? ""));
  return {
    ok: true,
    mode: "error-commit-stage",
    requestId,
    complete: events.length > 0,
    missingReason: events.length > 0 ? null : "no_system_logs_for_request",
    evidenceCount: events.length,
    upstreamErrorResponseAlreadyWritten: events.some((event) => event.upstreamErrorResponseAlreadyWritten),
    fallbackErrorResponseWritten: events.some((event) => event.fallbackErrorResponseWritten),
    failoverSuppressedAfterSemanticOutput: messages.includes("gateway.failover_suppressed_after_semantic_output"),
    events,
    valuesPrinted: false,
  };
}
