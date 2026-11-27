import { expect, test } from 'bun:test';
import { loadConfig } from '../../../../src/config';
import { verifyIdleProbes } from './verify-idle-probes';
import { operationHelp } from './operation-help';

const since = '2026-01-01T00:00:00Z';
function config() {
  const config = loadConfig(new URL('../../../../config/api2business.example.yaml', import.meta.url).pathname);
  for (const name of ['codex', 'claude']) {
    const scope = config.operations.upstreamSchedulingV2!.scopes[name]!;
    scope.features.idleProbe = true;
    scope.enabled = true;
    scope.idleProbeMode = 'submit_sum';
  }
  return config;
}
const round = { triggerType: 'automatic', operationId: 'fixture-round', startedAt: since, completedAt: since, status: 'failed',
  requestEvidence: [{ requestKind: 'single-tool', mode: 'submit_sum', httpStatus: 200, qualityOk: false, reason: 'wrong_tool', cacheHit: null }] };
const page = (records: unknown[], totalPages = 1) => ({ ok: true, records, pagination: { totalPages } });

test('one scoped verification preserves quality failure and skips manual records across pages', async () => {
  const calls: string[] = [];
  const result = await verifyIdleProbes({ idleProbeHistory: async (number, scope) => {
    calls.push(`${scope}:${number}`);
    if (scope === 'claude') throw new Error('HTTP 503');
    return number === 1 ? page([{ ...round, triggerType: 'manual' }], 2) : page([round], 2);
  } }, config(), 'claude,codex,codex', since);
  expect(calls).toEqual(['claude:1', 'codex:1', 'codex:2']);
  expect(result).toMatchObject({ ok: false, scopes: [{ reason: 'history_error', error: 'HTTP 503' }, { verified: true, status: 'failed', failureReasons: ['wrong_tool'] }] });
});

test('stale, skipped, wrong mode, setup-only and absent evidence never verify activation', async () => {
  for (const [record, reason] of [
    [{ ...round, startedAt: '2025-12-31T23:59:00Z' }, 'no_recent_automatic_round'],
    [{ ...round, status: 'skipped' }, 'not_executed'],
    [{ ...round, requestEvidence: [{ requestKind: 'probe', httpStatus: 200 }] }, 'mode_mismatch'],
    [{ ...round, requestEvidence: [{ requestKind: 'single-tool', mode: 'submit_sum', httpStatus: null, requests: [] }] }, 'no_http_evidence'],
    [{ ...round, requestEvidence: [] }, 'no_evidence'],
  ] as const) {
    expect(await verifyIdleProbes({ idleProbeHistory: async () => page([record]) }, config(), 'codex', since)).toMatchObject({ ok: false, scopes: [{ reason }] });
  }
});

test('invalid selectors and timestamps fail without reads; operation help names the read-only boundary', async () => {
  const client = { idleProbeHistory: async () => { throw new Error('unexpected read'); } };
  await expect(verifyIdleProbes(client, config(), 'codex,typo', since)).rejects.toThrow('--scope');
  await expect(verifyIdleProbes(client, config(), 'codex', 'yesterday')).rejects.toThrow('--since');
  expect(operationHelp(['accounts','idle-probe','verify','--help'])).toMatchObject({ command: 'accounts idle-probe verify' });
});

test('receipt cache counts exclude first-turn failures and never decide verification', async () => {
  const receipts = [true, false, null].map(cacheHit => ({ ...round.requestEvidence[0], stage: 'receipt', cacheHit }));
  const record = { ...round, requestEvidence: [...receipts, { ...round.requestEvidence[0], stage: 'call' }] };
  expect(await verifyIdleProbes({ idleProbeHistory: async () => page([record]) }, config(), 'codex', since))
    .toMatchObject({ ok: true, scopes: [{ receiptCache: { hit: 1, miss: 1, unknown: 1 } }] });
});
