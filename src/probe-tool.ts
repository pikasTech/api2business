import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { readToolTurn, ToolProbeError } from "./probe-tool-stream";
import { createMathProbeQuestion, PROBE_CACHE_HISTORY } from "./probe-math";
import { probeCacheUsage } from "./probe-cache-usage";

export type ToolProbeMode = "codex-custom" | "function";
type Row = Record<string, unknown>;
type Send = (body: Row) => Promise<Response>;

function template(name: string): string {
  return readFileSync(new URL(`../skills/api2business/references/tool-probe-${name}.md`, import.meta.url), "utf8").trim();
}

export async function runToolProbe(model: string, mode: ToolProbeMode, send: Send) {
  const custom = mode === "codex-custom";
  const description = template("description");
  const challenge = `C-${randomBytes(8).toString("hex")}`;
  const math = createMathProbeQuestion();
  const expected = `${challenge}:${math.expectedAnswer}`;
  const payload = custom ? `text('${challenge}:SUM')` : JSON.stringify({ challenge: `${challenge}:SUM` });
  const prompt = template("prompt").replace("{{question}}", math.prompt).replace("{{tool}}", custom ? "functions.exec" : "probe_receipt").replace("{{payload}}", payload);
  const input: Row[] = PROBE_CACHE_HISTORY.map((message) => ({ ...message }));
  const base: Row = { model, stream: true, store: false, parallel_tool_calls: false, tool_choice: "auto", include: ["reasoning.encrypted_content"] };
  if (custom) {
    input.push({ type: "additional_tools", id: "at_api2business_single_exec", role: "developer", tools: [{
      type: "namespace", name: "functions", description, tools: [{ type: "custom", name: "exec", description,
        format: { type: "grammar", syntax: "lark", definition: "start: SOURCE\nSOURCE: /[\\s\\S]+/" } }],
    }] });
  } else {
    base.tools = [{ type: "function", name: "probe_receipt", description, strict: true,
      parameters: { type: "object", properties: { challenge: { type: "string" } }, required: ["challenge"], additionalProperties: false } }];
  }
  const cachePrefixFingerprint = createHash("sha256").update(JSON.stringify({ input, tools: base.tools })).digest("hex");
  base.prompt_cache_key = cachePrefixFingerprint;
  input.push({ role: "user", content: prompt });
  const requestIds: (string | null)[] = [];
  const clientRequestIds: (string | null)[] = [];
  let cache = probeCacheUsage(null);
  let observedCall: { type: string; toolNameMatched: boolean; emptyArguments: boolean } | undefined;
  let stage = "call";
  async function turn() {
    const response = await send({ ...base, input });
    requestIds.push(response.headers.get("x-request-id"));
    clientRequestIds.push(response.headers.get("x-client-request-id"));
    return readToolTurn(response, (usage) => { if (stage === "receipt") cache = probeCacheUsage(usage); });
  }
  try {
    const first = await turn();
    const calls = first.filter((item) => item.type !== "message" && item.type !== "reasoning");
    if (calls.length !== 1) throw new ToolProbeError("call_count");
    const call = calls[0];
    const nameMatches = custom
      ? (call.name === "exec" || call.name === "functions.exec") && (call.namespace === undefined || call.namespace === "functions")
      : call.name === "probe_receipt" && !call.namespace;
    observedCall = { type: ["custom_tool_call", "function_call"].includes(String(call.type)) ? String(call.type) : "other", toolNameMatched: nameMatches, emptyArguments: call.arguments === "{}" };
    if (call.type !== (custom ? "custom_tool_call" : "function_call")) throw new ToolProbeError("call_type_mismatch");
    if (!nameMatches) throw new ToolProbeError("wrong_tool");
    if (typeof call.call_id !== "string" || !call.call_id.trim()) throw new ToolProbeError("missing_call_id");
    if (custom) {
      const match = typeof call.input === "string" && /^\s*text\(\s*(['"])(C-[0-9a-f]+:\d+)\1\s*\)\s*;?\s*$/u.exec(call.input);
      if (!match || match[2] !== expected) throw new ToolProbeError("invalid_payload");
    } else {
      let args;
      try { args = JSON.parse(String(call.arguments)); } catch { throw new ToolProbeError("invalid_payload"); }
      if (!args || Object.keys(args).length !== 1 || args.challenge !== expected) throw new ToolProbeError("invalid_payload");
    }
    stage = "receipt";
    const receipt = `R-${randomBytes(16).toString("hex")}`;
    input.push(...first, { type: custom ? "custom_tool_call_output" : "function_call_output", call_id: call.call_id, output: receipt });
    const visible = (await turn()).filter((item) => item.type !== "reasoning");
    const message = visible[0];
    if (visible.length !== 1 || message.type !== "message" || message.role !== "assistant" || !Array.isArray(message.content)
      || !message.content.length || !message.content.every((part) => part?.type === "output_text" && typeof part.text === "string")
      || message.content.map((part) => part.text).join("").trim() !== receipt) throw new ToolProbeError("receipt_mismatch");
    return { qualityOk: true, mode, stage, reason: "correct", requestIds, clientRequestIds, observedCall, cachePrefixFingerprint, ...cache };
  } catch (error) {
    const reason = error instanceof ToolProbeError ? error.message : error instanceof Error && /Timeout|Abort/u.test(error.name) ? "timeout" : "transport_error";
    return { qualityOk: false, mode, stage, reason, requestIds, clientRequestIds, observedCall, cachePrefixFingerprint, ...cache };
  }
}
