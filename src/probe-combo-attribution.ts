export type ProbeTool = "submit_sum" | "submit_product" | "exec";
export type ToolIssue = { tool: ProbeTool; reason: string };
type Row = Record<string, unknown>;

export function parseObject(text: unknown): Row | null {
  try {
    const parsed = typeof text === "string" && JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

export function receiptKey(tool: ProbeTool) { return tool === "submit_sum" ? "sum" : "product"; }

export function assessCalls(expected: ProbeTool[], calls: Row[], question: string, left: number, right: number) {
  const issues: ToolIssue[] = [];
  const observed = calls.map((call) => expected.includes(call.name as ProbeTool) ? call.name as ProbeTool : "other");
  for (const tool of expected) {
    const matching = calls.filter((call) => call.name === tool);
    const call = matching[0];
    let reason: string | undefined;
    if (!matching.length) reason = "missing_tool";
    else if (matching.length > 1) reason = "duplicate_tool";
    else if (call.namespace) reason = "wrong_tool";
    else if (call.type !== (tool === "exec" ? "custom_tool_call" : "function_call")) reason = "call_type_mismatch";
    else if (typeof call.call_id !== "string" || !call.call_id.trim()) reason = "invalid_call_id";
    else if (tool === "exec") {
      const match = typeof call.input === "string" && /^\s*text\(\s*(['"])(Q-[0-9a-f]+:\d+)\1\s*\)\s*;?\s*$/u.exec(call.input);
      if (!match || match[2] !== `${question}:${left * right}`) reason = "invalid_product";
    } else {
      const args = parseObject(call.arguments);
      if (!args || Object.keys(args).length !== 2 || args.id !== question || args.value !== (tool === "submit_sum" ? left + right : left * right)) reason = `invalid_${receiptKey(tool)}`;
    }
    if (reason && (reason !== "missing_tool" || expected.length === 1 || observed.some((name) => name !== "other"))) issues.push({ tool, reason });
  }
  const reason = calls.length !== expected.length ? "call_count" : issues.find((issue) => issue.reason === "duplicate_tool")?.reason
    ?? (observed.includes("other") ? "wrong_tool" : issues[0]?.reason)
    ?? (new Set(calls.map((call) => call.call_id)).size !== calls.length ? "invalid_call_id" : null);
  return { issues, observed, reason };
}
