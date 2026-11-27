import type { AppConfig } from '../../../../src/config';
import type { AdminHttpClient } from '../../../../src/admin-http-client';

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  if (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('探活历史不是有效的记录列表');
  }
  return value;
}

async function latestAutomatic(client: Pick<AdminHttpClient, 'idleProbeHistory'>, scope: string, since: number) {
  for (let page = 1; page <= 10; page++) {
    const history = await client.idleProbeHistory(page, scope);
    if (history.ok !== true) throw new Error('探活历史 API 未返回成功');
    for (const round of rows(history.records)) {
      const started = Date.parse(String(round.startedAt));
      if (!Number.isFinite(started)) throw new Error('探活历史缺少开始时间');
      if (started < since) return null;
      if (round.triggerType === 'automatic') return round;
    }
    const pages = Number((history.pagination as Row | undefined)?.totalPages);
    if (!Number.isSafeInteger(pages) || pages < 1) throw new Error('探活历史分页无效');
    if (page >= pages) return null;
  }
  throw new Error('已读 10 页历史，未定位窗口内的自动轮次');
}

export async function verifyIdleProbes(client: Pick<AdminHttpClient, 'idleProbeHistory'>, config: AppConfig, selector: string | null, sinceText: string | null) {
  const scheduling = config.operations.upstreamSchedulingV2;
  const names = [...new Set(selector?.split(',').map(name => name.trim()))];
  const since = Date.parse(sinceText ?? '');
  if (!Number.isFinite(since) || !sinceText || !/T.*(?:Z|[+-]\d\d:\d\d)$/i.test(sinceText) || since > Date.now()) throw new Error('verify 需要 --since <带时区的切换时间>，不能晚于现在');
  if (!names.length || names.some(name => !scheduling || !Object.hasOwn(scheduling.scopes, name))) throw new Error('verify 需要 --scope <已配置作用域，以逗号分隔>');
  const scopes = [];
  for (const scope of names) {
    const policy = scheduling!.scopes[scope]!;
    const expectedMode = policy.idleProbeMode ?? 'math';
    const base = { scope, expectedMode, verified: false };
    if (!scheduling!.enabled || !policy.enabled || !policy.features.idleProbe) {
      scopes.push({ ...base, reason: 'disabled' });
      continue;
    }
    try {
      const round = await latestAutomatic(client, scope, since);
      if (!round) { scopes.push({ ...base, reason: 'no_recent_automatic_round' }); continue; }
      const evidence = rows(round.requestEvidence);
      const terminal = ['succeeded','partial','failed'].includes(String(round.status)) && typeof round.operationId === 'string' && !!round.operationId.trim()
        && Date.parse(String(round.completedAt)) >= Date.parse(String(round.startedAt));
      const matches = evidence.filter(item => expectedMode === 'math' ? item.requestKind === 'probe'
        : item.requestKind === 'single-tool' && item.mode === expectedMode);
      const observed = matches.filter(item => typeof item.httpStatus === 'number' || (Array.isArray(item.requests) && item.requests.some(hop => typeof hop?.httpStatus === 'number')));
      const verified = terminal && observed.length > 0 && matches.length === evidence.length;
      const receipts = matches.filter(item => item.requestKind === 'single-tool' && item.stage === 'receipt');
      scopes.push({ ...base, verified, reason: !terminal ? 'not_executed' : !evidence.length ? 'no_evidence' : matches.length !== evidence.length ? 'mode_mismatch' : !observed.length ? 'no_http_evidence' : 'observed',
        operationId: round.operationId, startedAt: round.startedAt, status: round.status, attempted: round.attempted, succeeded: round.succeeded, failed: round.failed,
        evidenceCount: evidence.length, observedCount: observed.length,
        receiptCache: { hit: receipts.filter(item => item.cacheHit === true).length, miss: receipts.filter(item => item.cacheHit === false).length, unknown: receipts.filter(item => typeof item.cacheHit !== 'boolean').length },
        failureReasons: [...new Set(evidence.filter(item => item.qualityOk === false).map(item => String(item.reason ?? item.answerClassification ?? 'unknown')))].slice(0, 8) });
    } catch (error) {
      scopes.push({ ...base, reason: 'history_error', error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { ok: scopes.every(item => item.verified), since: new Date(since).toISOString(), scopes, mutation: false };
}

export function printProbeVerification(output: Row) {
  console.log(`自动探活核验 ${output.ok ? '通过' : '未通过'}  ${output.canonicalUrl}  自 ${output.since}`);
  for (const scope of rows(output.scopes)) {
    const detail = scope.error ?? (Array.isArray(scope.failureReasons) ? scope.failureReasons.join(', ') : '');
    console.log(`${scope.scope}  ${scope.expectedMode}  ${scope.reason}  ${scope.status ?? '-'}  成功/尝试 ${scope.succeeded ?? '-'}/${scope.attempted ?? '-'}  ${detail}`.trimEnd());
  }
}
