type Item = Record<string, unknown>;

export class ToolProbeError extends Error {
  constructor(reason: string, readonly implicatedNames: string[] = []) { super(reason); }
}

export async function readProbeBody(response: Response): Promise<string> {
  if (!response.ok) {
    await response.body?.cancel();
    throw new ToolProbeError(`http_${response.status}`);
  }
  if (!response.body) throw new ToolProbeError('missing_response_body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 1024 * 1024) {
        await reader.cancel();
        throw new ToolProbeError("response_too_large");
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  body += decoder.decode();
  return body;
}

export async function readToolTurn(response: Response, onUsage?: (usage: unknown) => void): Promise<Item[]> {
  const body = await readProbeBody(response);
  const items: Item[] = [];
  let terminal: Item[] | undefined;
  for (const block of body.split(/\r?\n\r?\n/u)) {
    const data = block.split(/\r?\n/u).filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart()).join("\n");
    if (!data || data === "[DONE]") continue;
    let event;
    try { event = JSON.parse(data); } catch { throw new ToolProbeError("invalid_stream"); }
    if (terminal || !event || typeof event.type !== "string") throw new ToolProbeError("invalid_stream");
    if (["response.failed", "response.incomplete", "error"].includes(event.type)) throw new ToolProbeError("stream_failed");
    if (event.type === "response.output_item.done") items.push(event.item);
    if (event.type === "response.completed") {
      if (event.response?.status !== "completed" || !Array.isArray(event.response.output)) throw new ToolProbeError("invalid_terminal");
      terminal = event.response.output;
      onUsage?.(event.response.usage);
    }
  }
  if (!terminal) throw new ToolProbeError("missing_terminal");
  const output = terminal.length ? terminal : items;
  if ([...output, ...items].some((item) => !item || typeof item.type !== "string")) throw new ToolProbeError("invalid_item");
  const wireCalls = items.filter((item) => item.type !== "reasoning" && item.type !== "message");
  const finalCalls = terminal.filter((item) => item.type !== "reasoning" && item.type !== "message");
  if (terminal.length && wireCalls.length) {
    if (wireCalls.length !== finalCalls.length) throw new ToolProbeError("stream_item_mismatch");
    const conflicts = wireCalls.flatMap((item, index) => {
      const final = finalCalls[index];
      if (["type", "call_id", "name", "namespace", "arguments", "input"].every((key) => item[key] === final[key])) return [];
      return [typeof item.name === "string" && item.name === final.name ? item.name : null];
    });
    if (conflicts.length) throw new ToolProbeError("stream_item_mismatch", conflicts.filter((name): name is string => name !== null));
  }
  return output;
}
