import { expect, test } from "bun:test";
import { runComboProbe, runSingleToolProbe, type ComboMode } from "./probe-combo";
import { type MathProbeTransport } from "./probe-math";
import { probeCacheUsage } from "./probe-cache-usage";
import { assessCalls, type ProbeTool } from "./probe-combo-attribution";

type Row = Record<string, unknown>;
type Fault = "none" | "partial" | "wrong_product" | "same_id" | "swapped" | "zero" | "unknown" | "wrong_type" | "repeated_tool" | "bad_receipt" | "unparseable";
function simulate(transport: MathProbeTransport, mode: ComboMode, fault: Fault, soloFault?: "http" | "invalid" | "no_call") {
  const chat = transport === "chat_completions";
  let turns = 0;
  let firstTools = "";
  return { count: () => turns, send: async (body: Row) => {
    const input = (body.messages ?? body.input) as Row[];
    const tools = body.tools as Row[];
    const single = tools.length === 1;
    const first = input.at(-1)?.role === "user";
    const names = tools.map((tool) => chat ? (tool[String(tool.type)] as Row).name : tool.name);
    if (!single) expect(tools.map((tool) => tool.type)).toEqual(["function", mode === "mixed" ? "custom" : "function"]);
    turns++;
    if (single && soloFault === "http") return new Response(null, { status: 503 });
    let items: Row[] = [], message: Row, usage: Row = { input_tokens_details: { cached_tokens: 999 } };
    if (first) {
      firstTools = JSON.stringify(tools);
      const prompt = String(input.at(-1)?.content);
      expect(prompt).not.toMatch(/R-[0-9a-f]{32}/u);
      const question = prompt.match(/Q-[0-9a-f]{16}/u)![0];
      const operands = /operands are (\d+) and (\d+)/u.exec(prompt)!;
      expect(body.parallel_tool_calls).toBe(!single);
      const left = Number(operands[1]), right = Number(operands[2]);
      const custom = mode === "mixed" && (single || fault !== "wrong_type");
      const product = left * right + ((!single && fault === "wrong_product") || (single && soloFault === "invalid") ? 1 : 0);
      const sumArgs = JSON.stringify({ id: question, value: left + right });
      const productArgs = JSON.stringify({ id: question, value: product });
      const raw = `text('${question}:${product}')`;
      const prodId = fault === "same_id" ? "sum_id" : "product_id";
      items = [{ type: custom ? "custom_tool_call" : "function_call", name: mode === "mixed" ? "exec" : "submit_product", call_id: prodId, ...(custom ? { input: raw } : { arguments: productArgs }) },
        { type: "function_call", name: "submit_sum", call_id: "sum_id", arguments: sumArgs }];
      if (single) items = soloFault === "no_call" ? [] : items.filter((item) => names.includes(item.name));
      else if (fault === "partial") items.pop();
      else if (fault === "repeated_tool") items[0] = { ...items[1], call_id: prodId };
      message = { role: "assistant", reasoning_content: "trace", tool_calls: items.map((item) => item.type === "function_call"
        ? { id: item.call_id, type: "function", function: { name: item.name, arguments: item.arguments } }
        : { id: item.call_id, type: "custom", custom: { name: item.name, input: item.input } }) };
    } else {
      expect(JSON.stringify(tools)).toBe(firstTools);
      if (chat) expect(input.at(single ? -2 : -3)?.reasoning_content).toBe("trace");
      const [product, sum] = input.slice(-2).map((item) => item.content ?? item.output);
      expect(product).not.toBe(sum);
      const text = single ? JSON.stringify({ [names[0] === "submit_sum" ? "sum" : "product"]: sum }) : fault === "unparseable" ? "not JSON" : JSON.stringify(fault === "swapped" ? { product: sum, sum: product } : { product: fault === "bad_receipt" ? "stale" : product, sum });
      message = { role: "assistant", content: text };
      items = [{ type: "message", role: "assistant", content: [{ type: "output_text", text }] }];
      usage = fault === "unknown" ? {} : { prompt_tokens_details: { cached_tokens: fault === "zero" ? 0 : 128 } };
    }
    return new Response(chat ? JSON.stringify({ choices: [{ message, finish_reason: first && items.length ? "tool_calls" : "stop" }], usage })
      : `data: ${JSON.stringify({ type: "response.completed", response: { status: "completed", output: items, usage } })}\n\n`);
  } };
}
for (const transport of ["responses", "chat_completions"] as const) {
  for (const mode of ["mixed", "functions"] as const) {
    test(`${transport} ${mode}: only the scored turn's cache counts`, async () => {
      for (const [fault, reason, turns] of [["none", "correct", 2], ["partial", "call_count", 1], ["wrong_product", "invalid_product", 1],
        ["same_id", "invalid_call_id", 1], ["swapped", "receipt_mismatch", 2], ["zero", "cache_miss", 2], ["unknown", "cache_unknown", 2], ["repeated_tool", "duplicate_tool", 1]] as const) {
        const fixture = simulate(transport, mode, fault);
        const result = await runComboProbe("test", mode, transport, fixture.send);
        expect(result).toMatchObject({ qualityOk: fault === "none", reason });
        const productTool = mode === "mixed" ? "exec" : "submit_product";
        const targets: ProbeTool[] = fault === "partial" ? ["submit_sum"] : fault === "wrong_product" ? [productTool] : ["swapped", "repeated_tool"].includes(fault) ? ["submit_sum", productTool] : [];
        expect(result.toolIssues.map(({ tool }) => tool)).toEqual(targets);
        expect(result).not.toHaveProperty("singleToolRetests");
        expect(fixture.count()).toBe(turns);
      }
    });
  }
  test(`${transport}: two ordinary calls cannot pass mixed`, async () => {
    const fixture = simulate(transport, "mixed", "wrong_type");
    expect(await runComboProbe("test", "mixed", transport, fixture.send)).toMatchObject({ reason: "call_type_mismatch", toolIssues: [{ tool: "exec" }] });
    expect(fixture.count()).toBe(1);
  });
  test(`${transport}: receipt failures terminate the multi-tool probe`, async () => {
    for (const fault of ["bad_receipt", "unparseable"] as const) {
      const fixture = simulate(transport, "mixed", fault);
      const result = await runComboProbe("test", "mixed", transport, fixture.send);
      expect(result).toMatchObject({ qualityOk: false, reason: "receipt_mismatch", toolIssues: fault === "bad_receipt" ? [{ tool: "exec" }] : [] });
      expect(fixture.count()).toBe(2);
    }
  });
  test(`${transport}: single-tool arithmetic reports receipt-turn cache independently of correctness`, async () => {
    for (const tool of ["exec", "submit_product", "submit_sum"] as const) {
      const fixture = simulate(transport, tool === "exec" ? "mixed" : "functions", "none");
      const result = await runSingleToolProbe("test", tool, transport, fixture.send);
      expect(result).toMatchObject({ qualityOk: true, mode: tool, observedToolNames: [tool], cacheHit: true, cacheReadTokens: 128 });
      expect(fixture.count()).toBe(2);
    }
    for (const [fault, cacheHit] of [["zero", false], ["unknown", null]] as const) {
      const fixture = simulate(transport, "functions", fault);
      expect(await runSingleToolProbe("test", "submit_sum", transport, fixture.send)).toMatchObject({ qualityOk: true, stage: "receipt", reason: "correct", cacheHit });
      expect(fixture.count()).toBe(2);
    }
    for (const [fault, reason] of [["invalid", "invalid_product"], ["http", "http_503"], ["no_call", "call_count"]] as const) {
      const fixture = simulate(transport, "mixed", "none", fault);
      expect(await runSingleToolProbe("test", "exec", transport, fixture.send)).toMatchObject({ qualityOk: false, mode: "exec", reason });
      expect(fixture.count()).toBe(1);
    }
  });
}
test("cache evidence keeps exact source and missing/zero distinct", () => {
  expect(probeCacheUsage({ prompt_cache_hit_tokens: 24 })).toMatchObject({ cacheReadField: "prompt_cache_hit_tokens", cacheHit: true });
  expect(probeCacheUsage({ input_tokens_details: { cached_tokens: 0 }, cached_tokens: 24 }).cacheHit).toBe(false);
  expect(probeCacheUsage({ cached_tokens: "error" }).cacheHit).toBe(null);
});

test("partial sets still detect a malformed observed tool; no recognizable calls cannot identify a culprit", () => {
  const calls = [{ name: "submit_sum", type: "function_call", call_id: "sum", arguments: "{}" }];
  expect(assessCalls(["submit_sum", "exec"], calls, "Q-1", 10, 12).issues).toEqual([
    { tool: "submit_sum", reason: "invalid_sum" }, { tool: "exec", reason: "missing_tool" },
  ]);
  expect(assessCalls(["submit_sum", "exec"], [], "Q-1", 10, 12).issues).toEqual([]);
});

test("a stream conflict reports an identifiable tool but never retries", async () => {
  for (const finalName of ["exec", "other"]) {
    let sends = 0;
    const result = await runComboProbe("test", "mixed", "responses", async () => {
      sends++;
      const wire = { type: "function_call", name: "exec", arguments: "{}", call_id: "prod" };
      const final = { type: "custom_tool_call", name: finalName, input: "dummy", call_id: "prod" };
      return new Response([ { type: "response.output_item.done", item: wire }, { type: "response.completed", response: { status: "completed", output: [final] } } ].map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""));
    });
    expect(result.reason).toBe("stream_item_mismatch");
    expect(result.toolIssues.map(({ tool }) => tool)).toEqual(finalName === "exec" ? ["exec"] : []);
    expect(sends).toBe(1);
  }
});
