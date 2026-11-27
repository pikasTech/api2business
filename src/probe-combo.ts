import { createHash, randomBytes, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { probeCacheUsage } from "./probe-cache-usage";
import { PROBE_CACHE_HISTORY, type MathProbeTransport } from "./probe-math";
import { readProbeBody, readToolTurn, ToolProbeError } from "./probe-tool-stream";
import { assessCalls, parseObject, receiptKey, type ProbeTool, type ToolIssue } from "./probe-combo-attribution";

export type ComboMode = "mixed" | "functions";
type Row = Record<string, unknown>;
function template(name: string) {
  return readFileSync(new URL(`../skills/api2business/references/${name}.md`, import.meta.url), "utf8").trim();
}
function fail(reason: string): never { throw new ToolProbeError(reason); }

type Send = (body: Row) => Promise<Response>;
async function runRound(model: string, mode: ComboMode | ProbeTool, transport: MathProbeTransport, send: Send) {
  const chat = transport === "chat_completions";
  const single = mode === "mixed" || mode === "functions" ? undefined : mode;
  const mixed = mode === "mixed" || mode === "exec";
  const left = randomInt(10, 100), right = randomInt(10, 100);
  const description = template("tool-probe-description");
  const question = `Q-${randomBytes(8).toString("hex")}`;
  const expected: ProbeTool[] = single ? [single] : ["submit_sum", mixed ? "exec" : "submit_product"];
  const prompt = template(single ? "combo-probe-single" : "combo-probe-prompt").replace("{{id}}", question).replace("{{left}}", String(left)).replace("{{right}}", String(right))
    .replace(single ? "{{operation}}" : "{{product}}", template(single === "submit_sum" ? "combo-probe-sum" : mixed ? "combo-probe-custom" : "combo-probe-functions"))
    .replace("{{key}}", single ? receiptKey(single) : "");
  const functions = expected.filter((tool) => tool !== "exec").map((name) => ({ name, description, strict: true,
    parameters: { type: "object", properties: { id: { type: "string" }, value: { type: "integer" } }, required: ["id", "value"], additionalProperties: false } }));
  const tools: Row[] = functions.map((definition) => chat ? { type: "function", function: definition } : { type: "function", ...definition });
  const input: Row[] = PROBE_CACHE_HISTORY.map((message) => ({ ...message }));
  if (expected.includes("exec")) {
    const custom = { name: "exec", description, format: { type: "text" } };
    tools.push(chat ? { type: "custom", custom } : { type: "custom", ...custom });
  }
  const cachePrefixFingerprint = createHash("sha256").update(JSON.stringify({ transport, tools, input })).digest("hex");
  input.push({ role: "user", content: prompt });
  const base = { model, tools, parallel_tool_calls: !single, tool_choice: "auto" };
  const requestIds: (string | null)[] = [];
  const clientRequestIds: (string | null)[] = [];
  let cache = probeCacheUsage(null), stage = "call";
  let observedTypes: unknown[] = [];
  let observedToolNames: string[] = [];
  let toolIssues: ToolIssue[] = [];
  async function turn() {
    const response = await send(chat ? { ...base, messages: input, stream: false } : { ...base, input, store: false, stream: true, include: ["reasoning.encrypted_content"], prompt_cache_key: cachePrefixFingerprint });
    requestIds.push(response.headers.get("x-request-id"));
    clientRequestIds.push(response.headers.get("x-client-request-id"));
    if (!chat) {
      const items = await readToolTurn(response, (usage) => { if (stage === "receipt") cache = probeCacheUsage(usage); });
      return { items, transcript: items };
    }
    const payload = parseObject(await readProbeBody(response));
    const choices = payload?.choices;
    if (!Array.isArray(choices) || choices.length !== 1) fail("invalid_terminal");
    const { finish_reason: finish, message } = choices[0] ?? {};
    if (message?.role !== "assistant" || message.refusal || (stage === "call" ? finish !== "tool_calls" && !(finish === "stop" && !message.tool_calls?.length) : finish !== "stop")) fail("unexpected_finish");
    if (stage === "receipt") cache = probeCacheUsage(payload?.usage);
    const calls = message.tool_calls ?? [];
    if (!Array.isArray(calls)) fail("invalid_item");
    if (calls.some((call) => !call || typeof call !== "object")) fail("invalid_item");
    const items: Row[] = calls.map((call) => ({ type: call.type === "custom" ? "custom_tool_call" : call.type === "function" ? "function_call" : "other",
      call_id: call.id, name: call[call.type]?.name, arguments: call.function?.arguments, input: call.custom?.input }));
    if (message.content) items.push({ type: "message", role: "assistant", content: [{ type: "output_text", text: message.content }] });
    return { items, transcript: [message] as Row[] };
  }
  const result = (qualityOk: boolean, reason: string) => ({ qualityOk, mode, transport, stage, reason, requestIds, clientRequestIds, observedTypes, observedToolNames, toolIssues, cachePrefixFingerprint, ...cache });
  try {
    const first = await turn();
    const calls = first.items.filter((item) => item.type !== "reasoning" && item.type !== "message");
    observedTypes = calls.map((item) => ["function_call", "custom_tool_call"].includes(String(item.type)) ? item.type : "other");
    const assessment = assessCalls(expected, calls, question, left, right);
    toolIssues = assessment.issues;
    observedToolNames = assessment.observed;
    if (assessment.reason) fail(assessment.reason);
    const receipts: Record<string, string> = {};
    input.push(...first.transcript);
    for (const call of calls) {
      const custom = call.name === "exec";
      const key = receiptKey(call.name as ProbeTool);
      const receipt = `R-${randomBytes(16).toString("hex")}`;
      receipts[key] = receipt;
      input.push(chat ? { role: "tool", tool_call_id: call.call_id, content: receipt } : { type: custom ? "custom_tool_call_output" : "function_call_output", call_id: call.call_id, output: receipt });
    }
    stage = "receipt";
    const visible = (await turn()).items.filter((item) => item.type !== "reasoning");
    const content = visible[0]?.content;
    if (visible.length !== 1 || visible[0].type !== "message" || visible[0].role !== "assistant" || !Array.isArray(content) || !content.every((part) => part?.type === "output_text" && typeof part.text === "string")) fail("receipt_mismatch");
    const answer = parseObject(content.map((part) => part.text).join(""));
    const mismatched = expected.filter((tool) => !answer || answer[receiptKey(tool)] !== receipts[receiptKey(tool)]);
    if (answer && expected.some((tool) => Object.hasOwn(answer, receiptKey(tool)))) toolIssues = mismatched.map((tool) => ({ tool, reason: "receipt_mismatch" }));
    if (!answer || Object.keys(answer).length !== expected.length || mismatched.length) fail("receipt_mismatch");
    if (single) return result(true, "correct");
    stage = "cache";
    if (!cache.cacheHit) fail(cache.cacheHit === null ? "cache_unknown" : "cache_miss");
    return result(true, "correct");
  } catch (error) {
    if (stage === "call" && error instanceof ToolProbeError && error.implicatedNames.length) toolIssues = expected.filter((tool) => error.implicatedNames.includes(tool)).map((tool) => ({ tool, reason: error.message }));
    return result(false, error instanceof ToolProbeError ? error.message : error instanceof Error && /Timeout|Abort/u.test(error.name) ? "timeout" : "transport_error");
  }
}

export async function runComboProbe(model: string, mode: ComboMode, transport: MathProbeTransport, send: Send) {
  return runRound(model, mode, transport, send);
}

export async function runSingleToolProbe(model: string, tool: ProbeTool, transport: MathProbeTransport, send: Send) {
  return runRound(model, tool, transport, send);
}
