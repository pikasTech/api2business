import { parseAccountIdSelector } from "../../../../src/account-batch-economics";
import type { AppConfig } from "../../../../src/config";
import { accountGroupIds, ProbeIsolationService } from "../../../../src/probe-isolation";
import { readSub2ApiCredentials } from "../../../../src/secrets";
import { Sub2ApiClient } from "../../../../src/sub2api-client";
import { Sub2ApiRuntimeService } from "../../../../src/sub2api-runtime-service";
import type { parseArgs } from "./cli";

export async function runAccountProbeL0(
  parsed: ReturnType<typeof parseArgs>,
  config: AppConfig,
): Promise<Record<string, unknown>> {
  const scopeName = parsed.scope;
  const tool = parsed.command[1] === "tool-probe";
  const combo = parsed.command[1] === "combo-probe";
  const operation = parsed.command[1];
  const mode = parsed.mode ?? (combo ? "mixed" : "codex-custom");
  const single = tool && (mode === "exec" || mode === "submit_sum" || mode === "submit_product");
  if (combo && mode !== "mixed" && mode !== "functions") throw new Error("combo-probe requires --mode mixed|functions");
  const standardMode = single || (combo && (mode === "mixed" || mode === "functions")) ? mode : null;
  if (tool && !single && (scopeName !== "codex" || (mode !== "codex-custom" && mode !== "function"))) throw new Error("tool-probe requires --mode exec|submit_sum|submit_product; codex also supports codex-custom|function");
  if (parsed.overApi || parsed.targetId) throw new Error(`accounts ${operation} is L0 only; do not select a remote target`);
  if (!scopeName) throw new Error(`accounts ${operation} requires --scope`);
  if (!standardMode && !["codex", "claude", "grok", "deepseek", "opencode", "commandcode", "gemini"].includes(scopeName)) throw new Error(`accounts ${operation} does not support scope ${scopeName}`);
  if (!parsed.accounts) throw new Error(`accounts ${operation} requires --accounts`);
  const accountIds = parseAccountIdSelector(parsed.accounts);
  if (accountIds.length === 0) throw new Error(`accounts ${operation} requires at least one positive account id`);
  const scope = config.operations.upstreamSchedulingV2?.scopes[scopeName];
  if (!scope || scope.enabled !== true) throw new Error(`scheduling scope ${scopeName} is not enabled`);
  const model = parsed.model
    ?? (standardMode ? scope.idleProbeModels?.[0] : undefined)
    ?? config.sub2api.idleProbe.platformModels?.[scope.platform]?.[0]
    ?? config.sub2api.idleProbe.model;
  if (standardMode && scope.idleProbeModels && !scope.idleProbeModels.includes(model)) throw new Error(`model not allowed by ${scopeName} probe policy`);
  const client = new Sub2ApiClient(config, readSub2ApiCredentials(config));
  const runtime = new Sub2ApiRuntimeService(
    client,
    config.operations.upstreamManagement.failoverRules,
    config.operations.upstreamManagement.failoverRulesByPlatform,
  );
  const isolation = new ProbeIsolationService(config, client, runtime);
  const isolationScope = {
    platform: scope.platform,
    eligibleGroupIds: scope.eligibleGroupIds,
    bindingGroupIds: [],
  };
  const results: Array<Record<string, unknown>> = [];
  for (const accountId of accountIds) {
    const startedAt = Date.now();
    try {
      const account = await client.getAccount(accountId, config.operations.upstreamManagement.mutationTimeoutMs);
      const platform = String(account.platform ?? "").toLowerCase();
      const status = String(account.status ?? "").toLowerCase();
      if (platform !== scope.platform) {
        throw new Error(`account ${accountId} platform ${platform || "-"} does not match scope ${scopeName}/${scope.platform}`);
      }
      if (status !== "active" || account.schedulable !== true) {
        throw new Error(`account ${accountId} must be active and schedulable before ${operation}`);
      }
      if (standardMode && !accountGroupIds(account).some((groupId) => scope.eligibleGroupIds.includes(groupId))) throw new Error(`账号 ${accountId} 不属于 ${scopeName} 的可用分组`);
      const binding = isolation.get(accountId, isolationScope) ?? (tool || combo ? null : await isolation.ensure(accountId, isolationScope));
      if (!binding) throw new Error(`账号 ${accountId} 缺少已就绪的 ${scopeName} 探活绑定`);
      const response = standardMode ? await isolation.standardProbe(accountId, model, standardMode, isolationScope, config.sub2api.idleProbe.accountTimeoutMs) : tool
        ? await isolation.toolProbe(accountId, model, mode === "function" ? mode : "codex-custom", config.sub2api.idleProbe.accountTimeoutMs)
        : await isolation.probe(accountId, model, config.sub2api.idleProbe.accountTimeoutMs, config.sub2api.idleProbe.reasoningEffort);
      results.push({
        accountId,
        accountName: account.name ?? null,
        platform,
        scope: scopeName,
        model,
        isolationGroupId: binding.groupId,
        keyCreated: binding.keyCreated,
        ok: response.qualityOk === true,
        elapsedMs: Date.now() - startedAt,
        response,
      });
    } catch (error) {
      results.push({
        accountId,
        platform: scope.platform,
        scope: scopeName,
        model,
        ok: false,
        elapsedMs: Date.now() - startedAt,
        ...(tool || combo ? { response: { qualityOk: false, mode, stage: "setup", reason: "setup_failed", requestIds: [] } } : {}),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    ok: results.length > 0 && results.every((result) => result.ok === true),
    action: `${operation}-l0`,
    transport: "direct-sub2api-isolated-user-key",
    servicesStarted: false,
    scope: scopeName,
    platform: scope.platform,
    model,
    attempted: results.length,
    succeeded: results.filter((result) => result.ok === true).length,
    failed: results.filter((result) => result.ok === false).length,
    durationMs: results.reduce((total, result) => total + Number(result.elapsedMs ?? 0), 0),
    results,
    valuesPrinted: false,
  };
}
