import { expect, test } from "bun:test";
import { runToolProbe, type ToolProbeMode } from "./probe-tool";
import { readToolTurn } from "./probe-tool-stream";

type Row = Record<string, unknown>;
function complete(output: Row[]) {
  return new Response(`data: ${JSON.stringify({ type: "response.completed", response: { status: "completed", output } })}\n\n`);
}

function fixture(mode: ToolProbeMode, change: (call: Row) => Row[] = (call) => [call], answer?: string) {
  let turns = 0;
  let challenge = "";
  const send = async (body: Row) => {
    turns++;
    const input = body.input as Row[];
    if (turns === 1) {
      challenge = String(input.at(-1)?.content).match(/C-[a-f0-9]{16}/u)![0];
      expect(JSON.stringify(input)).not.toMatch(/R-[0-9a-f]{32}/u);
      const tool = mode === "codex-custom"
        ? { type: "custom_tool_call", namespace: "functions", name: "exec", input: ` text( "${challenge}" );` }
        : { type: "function_call", name: "probe_receipt", arguments: JSON.stringify({ challenge }) };
      return complete(change({ ...tool, call_id: "call_probe" }));
    }
    const receipt = input.at(-1)!;
    expect(receipt.type).toBe(mode === "codex-custom" ? "custom_tool_call_output" : "function_call_output");
    expect(receipt.call_id).toBe("call_probe");
    expect(receipt.output).toMatch(/^R-[0-9a-f]{32}$/u);
    return complete([{ type: "message", role: "assistant", content: [{ type: "output_text", text: answer ?? ` ${receipt.output}\n` }] }]);
  };
  return { send, count: () => turns };
}

for (const mode of ["codex-custom", "function"] as const) {
  test(`${mode}: one correct receipt is one passing result`, async () => {
    const run = fixture(mode);
    expect(await runToolProbe("test", mode, run.send)).toMatchObject({ qualityOk: true, reason: "correct" });
    expect(run.count()).toBe(2);
  });
}

test("307 shape, wrong namespace, duplicate, wrong challenge and missing id never get receipts", async () => {
  for (const [reason, change] of [
    ["call_type_mismatch", (call: Row) => [{ ...call, type: "function_call", arguments: "{}" }]],
    ["wrong_tool", (call: Row) => [{ ...call, namespace: "other" }]],
    ["call_count", (call: Row) => [call, call]],
    ["invalid_payload", (call: Row) => [{ ...call, input: `${call.input}; extra()` }]],
    ["missing_call_id", (call: Row) => [{ ...call, call_id: " " }]],
  ] as const) {
    const run = fixture("codex-custom", change);
    expect(await runToolProbe("test", "codex-custom", run.send)).toMatchObject({ qualityOk: false, reason });
    expect(run.count()).toBe(1);
  }
});

test("a stale or forged receipt cannot pass", async () => {
  const run = fixture("function", undefined, "R-previous");
  expect(await runToolProbe("test", "function", run.send)).toMatchObject({ qualityOk: false, reason: "receipt_mismatch" });
});

test("a unique unqualified custom call still needs the correct receipt", async () => {
  const run = fixture("codex-custom", (call) => [{ ...call, namespace: undefined }]);
  expect((await runToolProbe("test", "codex-custom", run.send)).qualityOk).toBe(true);
});

test("stream must complete, identity must agree with done events", async () => {
  await expect(readToolTurn(new Response("data: [DONE]\n\n"))).rejects.toThrow("missing_terminal");
  await expect(readToolTurn(new Response(null, { status: 429 }))).rejects.toThrow("http_429");
  const done = 'data: {"type":"response.output_item.done","item":{"type":"function_call"}}\n\n';
  await expect(readToolTurn(new Response(done + await complete([{ type: "custom_tool_call" }]).text()))).rejects.toThrow("stream_item_mismatch");
});
