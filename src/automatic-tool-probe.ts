import { runSingleToolProbe } from './probe-combo';
import { runToolProbe } from './probe-tool';
import type { MathProbeTransport } from './probe-math';

type Hop = { stage: string; requestId: string | null; clientRequestId: string | null; httpStatus: number };
export async function runAutomaticToolProbe(accountId: number, groupId: number, model: string, mode: 'codex-custom' | 'submit_sum', transport: MathProbeTransport, send: (body: Record<string, unknown>) => Promise<Response>) {
  const started = Date.now();
  const requests: Hop[] = [];
  const tracked = async (body: Record<string, unknown>) => {
    const response = await send(body);
    requests.push({ stage: requests.length ? 'receipt' : 'call', requestId: response.headers.get('x-request-id'),
      clientRequestId: response.headers.get('x-client-request-id'), httpStatus: response.status });
    return response;
  };
  const result = mode === 'codex-custom' ? await runToolProbe(model, mode, tracked) : await runSingleToolProbe(model, mode, transport, tracked);
  const last = requests.at(-1);
  const ordinaryLogRecorded = requests.length > 0 && requests.every((request) => !!(request.clientRequestId || request.requestId))
    && last?.stage === result.stage && (last?.httpStatus ?? 0) >= 200 && (last?.httpStatus ?? 0) < 300
    && result.reason !== 'transport_error' && result.reason !== 'timeout';
  const end = Date.now();
  return { ...result, accountId, groupId, model, requestKind: 'single-tool', transport, requests, cacheMode: 'full',
    startedAt: new Date(started).toISOString(), completedAt: new Date(end).toISOString(), durationMs: end - started,
    endToEndMs: end - started, ordinaryLogRecorded, httpStatus: last?.stage === result.stage ? last.httpStatus : null,
    requestId: last?.requestId ?? null, clientRequestId: last?.clientRequestId ?? null,
    classification: ordinaryLogRecorded ? 'alive' : 'error', answerClassification: result.reason,
    errorMarker: result.qualityOk ? null : result.reason };
}
