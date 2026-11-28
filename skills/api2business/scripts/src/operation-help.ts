const entry = "bun skills/api2business/scripts/api2business-cli.ts";

const configOption = "可选；Api2Business 仓库根自动读取 config/api2business.yaml，其他 cwd 必须显式传入 owning YAML；查看帮助不加载配置";
const overApiOption = "实际查询或写入必填；owning YAML 声明的绝对 HTTP(S) URL，不接受别名、布尔开关或隐式目标";
const scopeOption = "可选；限定 owning YAML 中已配置的 scope，包括自定义 scope；生产排查应显式传入，避免把默认作用域当成所问作用域";
const jsonOption = "输出结构化回执，便于 jq 只投影必要字段";
const secretStdinOption = "只从 stdin 读取一行非空值；预览不读取，--confirm 才消费；进入 TTY 后按 Enter，管道需换行或 EOF；不接受 argv";

export function priorityHistoryHelp(): Record<string, unknown> {
  return {
    ok: true,
    command: "priority history",
    usage: `${entry} --config <owning-YAML> priority history --over-api <absolute-http(s)-URL> [--scope <configured-scope>] [--account <positive-id>] [--json]`,
    options: {
      "--config": "实际查询使用的 owning YAML；查看帮助不加载配置",
      "--over-api": "实际查询必填；owning YAML 声明的绝对 HTTP(S) URL，不接受别名或布尔开关",
      "--scope": "可选；只保留 profile、profiles 或自动执行归因含该作用域的轮次；取值来自 owning YAML 的已配置 scope",
      "--account": "可选；正整数账号 ID。给出后只返回该账号的前后优先级，不返回其他账号或原始 priorities",
      "--json": "展开匹配轮次的完整回执，包括作用域、触发方式、终态及实际变更数",
    },
    behavior: "只读查询原优先级执行历史，不触发评分、优先级调整或上游写入。未给 --account 时人类输出只打印有界轮次摘要，并披露过滤与展示省略数。",
    verification: "applied 只表示该轮执行过。单账号变化以 --account 的 before_priority 与 desired_priority 为准，再独立回读原生账号。",
  };
}

export function nativeHelp(action?: string): Record<string, unknown> {
  const actions = ["start", "stop", "status", "logs"];
  const selected = !action || action.startsWith("-") ? null : action;
  if (selected && !actions.includes(selected)) throw new Error(`unknown native action ${selected}`);
  return {
    ok: true,
    command: `native${selected ? ` ${selected}` : ""}`,
    usage: `${entry} --config <owning-YAML> native ${selected ?? "start|stop|status|logs"} [--component all|api|worker|web]${!selected || selected === "logs" ? " [--tail N]" : ""} [--json]`,
    options: {
      "--config": "必填；实际执行时从 owning YAML 解析唯一实例，不按环境回退",
      "--component": "all、api、worker 或 web；省略时为 all",
      ...(!selected || selected === "logs" ? { "--tail": "日志尾部行数；省略时为 40" } : {}),
      "--json": "输出结构化回执",
    },
    behavior: "生命周期操作只作用于 YAML 选中的实例；Compose 模式 start 构建并启动，status 和 logs 只读。查看帮助不加载配置、不启动服务。",
  };
}

export function historicalBalanceHelp(): Record<string, unknown> {
  return {
    ok: true,
    command: "upstreams usage-cache restore",
    usage: `${entry} --config <owning-YAML> upstreams usage-cache restore --id <account-id> --base-url <https-url> --remaining-usd <USD> --since <original-observed-ISO-time> --confirm --over-api <absolute-http(s)-URL> [--json]`,
    options: {
      "--config": "必填；目标运行面的 owning YAML",
      "--id": "必填；已核实余额对应的账号 ID",
      "--base-url": "必填；该钱包的 HTTPS 地址",
      "--remaining-usd": "必填；已核实的有限美元余额，允许负数和真实零",
      "--since": "必填；不晚于当前的原始观测时间，不能使用回填操作时间冒充新鲜余额",
      "--confirm": "必填；确认恢复已核实的历史成功值",
      "--over-api": "必填；owning YAML 声明的绝对 HTTP(S) URL，不接受别名或布尔开关",
      "--json": "输出结构化回执",
    },
    behavior: "仅恢复历史成功缓存，不探测供应商、不充值、不改写实际钱包余额；查看帮助不加载配置或执行写入。",
  };
}

export function upstreamsUsageHelp(): Record<string, unknown> {
  return {
    ok: true,
    command: "upstreams usage",
    usage: `${entry} --config <owning-YAML> upstreams usage [--accounts <id-or-range,...>] --over-api <absolute-http(s)-URL> [--json]`,
    options: {
      "--config": configOption,
      "--accounts": "可选；正整数账号 ID、逗号列表或范围。省略时批量探测运行面既有账号，按供应商返回五小时/周/月额度",
      "--over-api": overApiOption,
      "--json": jsonOption,
    },
    behavior: "提交异步上游额度探测作业，回执 state=submitted 不是终态；再执行 workflow status --id <workflow-id> 读取终态。额度低或探测失败只作巡检与调度证据，不触发暂停或事故。",
    verification: "用同一绝对 --over-api 追原 workflow，核对 succeeded/failed、quotaWindowCoverage、quotaProviderCoverage 与 lowQuotaWarnings；缺失窗口写 unknown，不填零。",
  };
}

export function upstreamsUsageCacheHelp(): Record<string, unknown> {
  return {
    ok: true,
    command: "upstreams usage-cache",
    usage: `${entry} --config <owning-YAML> upstreams usage-cache [--accounts <id-or-range,...>] --over-api <absolute-http(s)-URL> [--json]`,
    options: {
      "--config": configOption,
      "--accounts": "可选；正整数账号 ID、逗号列表或范围；省略时读取全部既有额度缓存行",
      "--over-api": overApiOption,
      "--json": jsonOption,
    },
    behavior: "只读读取最近一次持久化额度缓存，不探测供应商、不充值、不恢复账号或修改调度。",
    verification: "核对 cachedAt、lastSuccessfulAt、results 行数及账号覆盖；缺失窗口写 unknown，不把缓存值当作本轮供应商探活成功。",
  };
}

export function rechargeCandidatesHelp(): Record<string, unknown> {
  return {
    ok: true,
    command: "upstreams recharge-candidates",
    usage: `${entry} --config <owning-YAML> upstreams recharge-candidates --over-api <absolute-http(s)-URL> [--json]`,
    options: {
      "--config": configOption,
      "--over-api": overApiOption,
      "--json": jsonOption,
    },
    behavior: "只读生成充值候选与建议，不充值、不恢复账号、不修改余额或调度；证据不足的候选保留原因并降低置信度。",
    verification: "核对 candidateCount、耗尽与低余额分类、recommendedCount，并按 walletKey 去重；只有证据充分的候选才进入建议表。",
  };
}

type UpstreamWriteAction = "recover" | "status" | "update" | "models sync";

export function upstreamWriteHelp(action: UpstreamWriteAction): Record<string, unknown> {
  const common = {
    ok: true,
    command: `upstreams ${action}`,
    options: {
      "--config": configOption,
      "--over-api": overApiOption,
      "--json": jsonOption,
    },
  };
  if (action === "recover") return {
    ...common,
    usage: `${entry} --config <owning-YAML> upstreams recover --accounts <id-or-range,...> [--confirm] --over-api <absolute-http(s)-URL> [--json]`,
    options: {
      ...common.options,
      "--accounts": "必填；正整数账号 ID，可用逗号列表或闭区间范围；执行前去重并排序",
      "--confirm": "写入确认；省略时只返回账号 IDs 和 mutation=false",
    },
    behavior: "默认只读预览并返回 mutation=false；--confirm 提交异步恢复作业，将目标账号设为 active 且 schedulable=true。不会充值、切号、改分组、改模板或删除账号。",
    verification: "先用 upstreams status --id <workflow-id> 和同一绝对 URL 追到终态，再原生回读每个账号的 status、schedulable、额度与上游可用性；recovered 计数不证明上游已恢复供给。",
  };
  if (action === "status") return {
    ...common,
    usage: `${entry} --config <owning-YAML> upstreams status --id <workflow-id> --over-api <absolute-http(s)-URL> [--json]`,
    options: {
      ...common.options,
      "--id": "必填；异步 upstream 作业返回的 workflow ID",
    },
    behavior: "只读查询原 workflow，不提交新作业、不恢复账号、不修改调度；省略 --json 时只显示有界终态摘要。",
    verification: "核对 state、terminal、result.ok、result.status 和各类计数；还在运行时继续查询同一 workflow，不用重新提交或账号成功状态替代。",
  };
  if (action === "update") return {
    ...common,
    usage: `${entry} --config <owning-YAML> upstreams update --id <account-id> [--base-url <https-url>] [--groups <id,id,...>] [--suffix <name>] [--rate <CNY/API_USD>] [--template-only] [--confirm] --over-api <absolute-http(s)-URL> [--json]`,
    options: {
      ...common.options,
      "--id": "必填；正整数 Sub2API API-key 上游账号 ID",
      "--base-url": "可选；HTTPS 供应商 origin。Anthropic 不写 /v1，只合并 credentials.base_url",
      "--groups": "可选；分组 ID 整表替换，并同步重写该平台切号模板；探活私有分组不得遗漏",
      "--suffix": "可选；与费率共同生成账号名，不单独重置 API key 或模型映射",
      "--rate": "可选；CNY/API_USD 费率；与 suffix 共同生成账号名",
      "--template-only": "可选；仅按当前平台和地址重新应用切号模板，不替换其他凭据",
      "--confirm": "写入确认；省略时只返回 mutation=false 的计划",
    },
    behavior: "默认只读预览；--confirm 提交异步单账号更新。只合并指定字段并重写切号模板，不充值、不恢复、不删除账号，也不替换 API key 或模型映射。",
    verification: "先用 upstreams status --id <workflow-id> 和同一绝对 URL 追到终态，再原生回读账号名、credentials.base_url、group_ids、切号模板及未改凭据；页面请求成功不等于持久化正确。",
  };
  return {
    ...common,
    usage: `${entry} --config <owning-YAML> upstreams models sync --accounts <id-or-range,...> --confirm --over-api <absolute-http(s)-URL> [--json]`,
    options: {
      ...common.options,
      "--accounts": "必填；正整数账号 ID，可用逗号列表或闭区间范围；批量按 ID 顺序处理",
      "--confirm": "写入确认；省略时只返回 mutation=false 的账号列表",
    },
    behavior: "默认只读预览；--confirm 直接执行原生模型发现和 mapping bulk merge。保留非映射凭据，不写 model_mapping 以外的账号字段；多账号遇到单账号失败会继续其余账号并以 failures 返回部分成功。",
    verification: "逐账号核对 result 中 persisted=true、persistedModelCount、changedModelCount、mappingAfter，并确认 failures 为空、非映射凭据未变；该命令是同步执行，不生成 workflow，不能改用 upstreams status 等待。",
  };
}

export function quotaMonitorSampleHelp(): Record<string, unknown> {
  return {
    ok: true,
    command: "upstreams quota-monitor sample",
    usage: `${entry} --config <owning-YAML> upstreams quota-monitor sample [--confirm] --over-api <absolute-http(s)-URL> [--json]`,
    options: {
      "--config": configOption,
      "--confirm": "必填；提交一次手动额度采样作业。省略时只返回预览并设置 mutation=false",
      "--over-api": overApiOption,
      "--json": jsonOption,
    },
    behavior: "提交页面同源的 upstream.quota.sample 作业，等待同一 workflow 终态，再读取同一 quota-summary 缓存；不会修改采样间隔、余额或调度配置。",
    verification: "只有 workflow state=completed 且 sampledAt 相对提交前前进才返回 ok=true；同时核对 stages、knownWallets、unknownWallets 与 cacheAdvanced。",
  };
}

const idleProbeActions = ["plan", "history", "verify", "coverage", "reconcile", "run"] as const;

export function idleProbeHelp(action?: string): Record<string, unknown> {
  const selected = action && idleProbeActions.includes(action as typeof idleProbeActions[number]) ? action : null;
  if (action && !selected && action !== "--help") throw new Error(`unknown accounts idle-probe action ${action}`);
  if (selected === 'verify') return { ok: true, command: 'accounts idle-probe verify',
    usage: `${entry} --config <owning-YAML> accounts idle-probe verify --scope <scope,...> --since <ISO-with-timezone> --over-api <absolute-http(s)-URL> [--json]`,
    behavior: '按作用域只读核对切换后最新自动轮次。不发探针、不调整优先级。', verification: '以终态、实际题型和 HTTP 证据判定生效；账号答错仍显示失败原因。任一作用域证据不足退出非零。' };
  const usageSuffix = selected === "history"
    ? "[--scope <configured-scope>] [--page N]"
    : selected === "coverage"
      ? "[--scope <configured-scope>] [--window-minutes N]"
      : selected === "reconcile"
        ? "[--accounts <id-or-range,...>] [--scope <configured-scope>] [--confirm]"
        : selected === "run"
          ? "[--accounts <id-or-range,...>] [--scope <configured-scope>] [--rounds 1..10] [--confirm]"
          : selected === "plan"
            ? "[--accounts <id-or-range,...>] [--scope <configured-scope>]"
            : `${idleProbeActions.join('|')} [options]`;
  const options: Record<string, string> = {
    "--config": configOption,
    "--over-api": overApiOption,
    "--scope": scopeOption,
    "--json": jsonOption,
  };
  if (selected === "plan" || selected === "reconcile" || selected === "run" || selected === null) {
    options["--accounts"] = "可选；正整数账号 ID、逗号列表或范围；省略表示该作用域全部候选账号";
  }
  if (selected === "history" || selected === null) options["--page"] = "可选；正整数页码，省略为 1";
  if (selected === "coverage" || selected === null) options["--window-minutes"] = "可选；正整数覆盖窗口，省略为 20 分钟；生产核对同时查看 24 小时窗口";
  if (selected === "run" || selected === null) options["--rounds"] = "可选；1 到 10 的整数，省略为 1";
  if (selected === "reconcile" || selected === "run" || selected === null) options["--confirm"] = "写入确认；省略时只返回预览并设置 mutation=false";
  const usageAction = selected ?? idleProbeActions.join('|');
  const usageTail = selected ? usageSuffix : "[options]";
  return {
    ok: true,
    command: `accounts idle-probe${selected ? ` ${selected}` : ""}`,
    usage: `${entry} --config <owning-YAML> accounts idle-probe ${usageAction} ${usageTail} --over-api <absolute-http(s)-URL> [--json]`,
    options,
    behavior: selected === "plan"
      ? "只读计算同作用域待探活计划，不创建隔离 Key、不发送探活请求。"
      : selected === "history"
        ? "只读读取持久化探活轮次；省略 scope 时不能把混合轮次归属到某个平台。"
        : selected === "coverage"
          ? "只读统计同作用域专用 Key 的覆盖记录；短窗口缺失不等于账号永久无样本。"
          : selected === "reconcile"
            ? "默认只读预览；--confirm 仅补齐缺失的探活隔离绑定，不发送探活请求、不改账号状态。"
            : selected === "run"
              ? "默认只读预览；--confirm 提交异步探活轮次，只执行 active、schedulable、已就绪且非 in-flight 的账号。"
              : "plan、history、coverage 只读；reconcile 和 run 默认预览，只有 --confirm 才写入。",
    verification: selected === "reconcile"
      ? "先核对预览中的缺失绑定，再确认执行；回读同作用域 coverage、账号隔离分组和 workflow 终态。"
      : selected === "run"
        ? "用 workflow status --id <workflow-id> 追踪真实终态，再回读 idle-probe history 与 coverage；作业创建成功不等于探活完成。"
        : "以同作用域 workspace 的 plan、history、coverage 和真实账号范围交叉核对，不用其他作用域或旧全局标签推断。",
  };
}

const schedulingActions = ["scopes", "snapshot", "plan", "priority-run", "model-sync"] as const;

export function upstreamSchedulingV2Help(action?: string, subaction?: string): Record<string, unknown> {
  const selected = action && schedulingActions.includes(action as typeof schedulingActions[number]) ? action : null;
  if (action && !selected && action !== "--help") throw new Error(`unknown upstream-scheduling-v2 action ${action}`);
  const modelSyncAction = selected === "model-sync" && subaction && ["plan", "run", "history"].includes(subaction)
    ? subaction
    : null;
  const path = selected === "model-sync"
    ? `model-sync ${modelSyncAction ?? "plan|run|history"}`
    : selected ?? "scopes|snapshot|plan|priority-run|model-sync";
  const options: Record<string, string> = {
    "--config": configOption,
    "--over-api": overApiOption,
    "--scope": scopeOption,
    "--json": jsonOption,
  };
  if (selected === "snapshot") {
    options["--refresh"] = "同步等待一次读模型重建；不得与 --cache-only 同时使用";
    options["--cache-only"] = "只读取最近成功缓存，不触发刷新；用于刷新失败后的单次兜底";
  }
  if (selected === "priority-run") options["--confirm"] = "执行确认；省略时只返回预览并设置 mutation=false";
  if (selected === "model-sync") {
    options["--accounts"] = "可选；正整数账号 ID、逗号列表或范围，省略表示该作用域全部候选账号";
    if (!modelSyncAction || modelSyncAction === "run") options["--confirm"] = "执行确认；省略时只返回预览并设置 mutation=false";
    if (!modelSyncAction || modelSyncAction === "history") options["--page"] = "可选；正整数页码，省略为 1";
  }
  const usage = selected === "priority-run"
    ? `${entry} --config <owning-YAML> upstream-scheduling-v2 priority-run --scope <configured-scope> [--confirm] --over-api <absolute-http(s)-URL> [--json]`
    : selected === "snapshot"
      ? `${entry} --config <owning-YAML> upstream-scheduling-v2 snapshot [--scope <configured-scope>] [--refresh|--cache-only] --over-api <absolute-http(s)-URL> [--json]`
      : selected === "model-sync"
        ? `${entry} --config <owning-YAML> upstream-scheduling-v2 model-sync ${modelSyncAction ?? "plan|run|history"} [--scope <configured-scope>] [--accounts <id-or-range,...>]${!modelSyncAction || modelSyncAction === "run" ? " [--confirm]" : ""}${!modelSyncAction || modelSyncAction === "history" ? " [--page N]" : ""} --over-api <absolute-http(s)-URL> [--json]`
        : `${entry} --config <owning-YAML> upstream-scheduling-v2 ${path} [--scope <configured-scope>] --over-api <absolute-http(s)-URL> [--json]`;
  return {
    ok: true,
    command: `upstream-scheduling-v2 ${path}`,
    usage,
    options,
    behavior: selected === "snapshot"
      ? "默认读取缓存；缓存陈旧时最多等待约 10 秒让服务后台重建完成后返回最新回执，重建失败或超时则原样返回陈旧回执；--refresh 同步等待重建；--cache-only 只读最近成功缓存。三者均为只读，不修改调度配置。"
      : selected === "priority-run"
        ? "默认只读预览；--confirm 通过原生 worker 执行一次指定作用域的优先级调整，不直接连接业务库。"
        : selected === "model-sync"
          ? "plan 与 history 只读；run 默认预览，--confirm 后执行模型同步，并用 workflow 与原生账号回读核验。"
          : "scopes 与 plan 只读；其他动作按各自 usage 执行，不把页面存在或请求成功当作业务终态。",
    verification: selected === "snapshot"
      ? "同时核对 cache.state、cache.complete、capturedAt、cache.sections、failedSections 与 lastCompleteAt；state=stale 且 complete=true 不等于刷新失败。"
      : selected === "priority-run"
        ? "回读 priority history --scope <scope>、snapshot 和 plan，核对真实变更数、查询耗时、score_error 与阻断原因；applied 只表示执行过。"
        : "以同一绝对 URL 的 workflow 终态、同作用域 snapshot/plan 和原生账号回读交叉核验，不跨作用域推断。",
  };
}

export function scoreRankHelp(): Record<string, unknown> {
  return {
    ok: true,
    command: "scores rank",
    usage: `${entry} --config <owning-YAML> scores rank [--calls N] [--account <id-or-name>] [--group <id-or-exact-name>] --over-api <absolute-http(s)-URL> [--json]`,
    options: {
      "--config": configOption,
      "--over-api": overApiOption,
      "--calls": "可选；必须是 owning YAML monitor.recentCallOptions 中的值（默认 100/500/1000/2000/5000），覆盖本窗口最近调用样本上限；省略时读取 monitor.recentCallLimit",
      "--account": "可选；只读取一个账号，接受正整数 ID 或精确账号名",
      "--group": "可选；只读取一个业务分组，接受正整数 ID 或精确分组名",
      "--json": jsonOption,
    },
    behavior: "读取当前账号评分与真实刷新结果；不会把已有旧缓存当成本次查询成功。",
    verification: "核对 refreshedAt 是否前进、queryDurationMs、账号数，以及窗口失败率、突发失败率和有效失败率；单账号变化再用 priority history --account 回读。",
  };
}

export function modelAliasHelp(): Record<string, unknown> {
  return {
    ok: true,
    command: "upstreams model-alias",
    usage: `${entry} --config <owning-YAML> upstreams model-alias --id <account-id> --model <alias> --upstream-model <upstream-model> [--confirm] --over-api <absolute-http(s)-URL> [--json]`,
    options: {
      "--config": configOption,
      "--over-api": overApiOption,
      "--id": "必填；正整数 Sub2API 账号 ID",
      "--model": "必填；对外暴露的模型别名，原样写入 model_mapping 键",
      "--upstream-model": "必填；该别名映射到的上游模型，写入 model_mapping 值",
      "--confirm": "执行确认；省略时只返回预览并设置 mutation=false",
      "--json": jsonOption,
    },
    behavior: "只合并单个账号的 model_mapping 键，不改其他键、优先级、分组、并发或凭据；默认预览，--confirm 后写入并回读 persisted。",
    verification: "回读 model_mapping 中该别名与目标上游模型，核对 persisted=true、mappingKeyCount 只增不减；回滚动作见回执 deleteModel。",
  };
}

export function upstreamCreateHelp(): Record<string, unknown> {
  return {
    ok: true,
    command: "upstreams create",
    usage: `${entry} --config <owning-YAML> upstreams create --platform <platform> --base-url <https-url> --suffix <name> --groups <id,id,...> --api-key-stdin [--pool-mode true|false] [--rate <temporary-CNY/API_USD>] [--priority 1 --capacity 16 --recharge-cny <CNY>] [--confirm] --over-api <absolute-http(s)-URL> [--json]`,
    options: {
      "--config": configOption,
      "--platform": "必填；openai、grok、anthropic、deepseek 或 gemini",
      "--base-url": "必填；供应商 HTTPS origin，不静默回退到平台默认地址",
      "--suffix": "必填；用于生成账号名的供应商后缀",
      "--groups": "必填；实时解析出的业务分组 ID，逗号列表；不提供默认业务分组",
      "--pool-mode": "可选；true 或 false，按平台模板与 owning policy 校验",
      "--rate": "可选；创建后探测前的临时 CNY/API_USD 费率，不能替代最终费率回读",
      "--priority": "可选；正整数账号优先级，默认 1",
      "--capacity": "可选；正整数账号并发，默认 16",
      "--recharge-cny": "可选；创建后充值的人民币金额",
      "--api-key-stdin": secretStdinOption,
      "--confirm": "执行确认；省略时只返回脱敏计划且不读取 stdin",
      "--over-api": overApiOption,
      "--json": jsonOption,
    },
    secretInput: {
      flag: "--api-key-stdin",
      format: "恰好一行非空 API key；管道多行会失败，不静默截断",
      pipe: `printf '%s\\n' "$API_KEY" | ${entry} --config <owning-YAML> upstreams create <required-options> --api-key-stdin --confirm --over-api <absolute-http(s)-URL>`,
      terminal: "按 Enter 提交；没有换行时用 Ctrl-D 结束输入",
      boundary: "密钥不得进入 argv、帮助输出、日志或回执",
    },
    behavior: "默认预览；--confirm 只读取一次 stdin 密钥并提交上游创建、费率探测、分组、切号模板和探活初始化。",
    verification: "保留 workflow ID，使用 upstreams status --id <workflow-id> 追到终态，再分别回读配置、Secret presence 和实际探活结果。",
  };
}

export function upstreamTemplateHelp(): Record<string, unknown> {
  return {
    ok: true,
    command: "upstreams template",
    usage: `${entry} --config <owning-YAML> upstreams template [--accounts <id-or-range,...>] [--confirm] --over-api <absolute-http(s)-URL> [--json]`,
    options: {
      "--config": configOption,
      "--accounts": "可选；正整数账号 ID、逗号列表或范围。单平台更新必须传该平台全部未删除 API-key 账号",
      "--confirm": "执行确认；省略时只返回目标账号、平台与 mutation=false 计划",
      "--over-api": overApiOption,
      "--json": jsonOption,
    },
    behavior: "默认预览；--confirm 按账号所属平台应用切号模板，提交异步作业。未传 --accounts 时会覆盖全部已配置模板平台，不能用于单平台更新。",
    verification: "用 upstreams status --id <workflow-id> 和同一绝对 URL 核对 targetCount、appliedCount、verifiedCount、failedCount、misalignedCount，再按平台无缓存回读规则和未改平台边界。",
  };
}

export function upstreamListHelp(): Record<string, unknown> {
  return {
    ok: true,
    command: "upstreams list",
    usage: `${entry} --config <owning-YAML> upstreams list [--page <positive-integer>] [--search <text>] --over-api <absolute-http(s)-URL> [--json]`,
    options: {
      "--config": configOption,
      "--page": "可选；正整数页码，省略时为第 1 页",
      "--search": "可选；对上游账号列表进行有界搜索",
      "--over-api": overApiOption,
      "--json": jsonOption,
    },
    behavior: "只读查询上游账号分页列表，不创建账号、不修改调度、不读取或输出 API key。",
    verification: "核对分页元数据、搜索条件和账号 ID；列表摘要不能替代单账号 credentials、分组、模板和探活回读。",
  };
}

export function upstreamsGroupHelp(): Record<string, unknown> {
  return {
    ok: true,
    command: "upstreams",
    usage: `${entry} --config <owning-YAML> upstreams <operation> [options] --over-api <absolute-http(s)-URL> [--json]`,
    operationHelp: [
      "upstreams create --help",
      "upstreams template --help",
      "upstreams list --help",
      "upstreams update --help",
      "upstreams recover --help",
      "upstreams status --help",
      "upstreams models sync --help",
      "upstreams model-alias --help",
      "upstreams usage --help",
      "upstreams usage-cache --help",
      "upstreams recharge-candidates --help",
      "upstreams quota-monitor sample --help",
    ],
    behavior: "操作级帮助是参数真相；查看帮助不加载配置、不读取 stdin、不连接运行面。未知操作帮助返回失败，不回退整份根命令表。",
  };
}

export function errorsAggregateHelp(): Record<string, unknown> {
  return {
    ok: true,
    command: "errors aggregate",
    usage: `${entry} --config <owning-YAML> errors aggregate [--start ISO --end ISO] [--limit N] [--top N] [--account <id-or-name>] [--group <id-or-exact-name>] [--model <exact-id>] --over-api <absolute-http(s)-URL> [--json]`,
    options: {
      "--config": configOption,
      "--over-api": overApiOption,
      "--start": "可选；与 --end 同时提供，按半开区间过滤错误样本",
      "--end": "可选；不晚于当前时间，且必须晚于 --start",
      "--limit": "可选；限制参与聚合的错误记录数",
      "--top": "可选；限制返回的高频签名数",
      "--account": "可选；按正整数账号 ID 或精确账号名过滤",
      "--group": "可选；按正整数分组 ID 或精确分组名过滤",
      "--model": "可选；按精确模型 ID 过滤",
      "--json": jsonOption,
    },
    behavior: "只读聚合窗口内错误签名、恢复与切号证据，不读取请求正文或修改账号。探活流量默认排除。",
    verification: "核对窗口、样本数、去重请求数、恢复数和签名分组；聚合结果不能替代单请求链核验。",
  };
}

export function errorsDiagnoseHelp(): Record<string, unknown> {
  return {
    ok: true,
    command: "errors diagnose",
    usage: `${entry} --config <owning-YAML> errors diagnose [--start ISO --end ISO] [--request-id <request-id>] [--model <exact-id>] [--limit N] [--top N] [--account <id-or-name>] [--group <id-or-exact-name>] --over-api <absolute-http(s)-URL> [--json]`,
    options: {
      "--config": configOption,
      "--over-api": overApiOption,
      "--start": "可选；与 --end 同时提供，按半开区间过滤错误样本",
      "--end": "可选；不晚于当前时间，且必须晚于 --start",
      "--request-id": "可选；精确读取一个网关请求的错误链",
      "--model": "可选；按精确模型 ID 定位错误链",
      "--limit": "可选；限制参与诊断的错误记录数",
      "--top": "可选；限制返回的展示链数，默认 50、上限 100",
      "--account": "可选；按正整数账号 ID 或精确账号名过滤",
      "--group": "可选；按正整数分组 ID 或精确分组名过滤",
      "--json": jsonOption,
    },
    behavior: "只读返回错误尝试、最终签名、恢复与切号证据，不读取或改写业务请求。探活流量默认排除。",
    verification: "单请求以 requestId 的完整链为准；窗口诊断的 topN 不是全窗链数，需结合 errors list 或逐请求 inspect。",
  };
}

export function errorsListHelp(): Record<string, unknown> {
  return {
    ok: true,
    command: "errors list",
    usage: `${entry} --config <owning-YAML> errors list [--limit N] [--start ISO --end ISO] --over-api <absolute-http(s)-URL> [--json]`,
    options: {
      "--config": configOption,
      "--over-api": overApiOption,
      "--limit": "可选；限制返回的错误记录数",
      "--start": "可选；与 --end 同时提供，按半开区间过滤错误记录",
      "--end": "可选；不晚于当前时间，且必须晚于 --start",
      "--json": jsonOption,
    },
    behavior: "只读列出错误记录并默认排除探活流量；不会把零命中解释为没有历史错误。",
    verification: "核对窗口、记录总数、响应中的 probeRowsExcluded 与逐请求身份；需要恢复或切号结论时继续 errors diagnose 或 inspect。",
  };
}

export function operationHelp(args: string[]): Record<string, unknown> | null {
  const position = (first: string, second?: string): number => args.findIndex((item, index) => item === first && (second === undefined || args[index + 1] === second));
  const actionAfter = (start: number, actions: readonly string[]): string | undefined => args.slice(start + 1).find((item) => actions.includes(item));
  const idleProbe = position("accounts", "idle-probe");
  if (position('config','idle-probes') >= 0) return {ok:true, command:'config idle-probes', usage:'config idle-probes --file <scope-policy.json> [--confirm]', behavior:'只修改本地 owning YAML。输入为作用域到 {mode, enabled?} 的对象，默认预览；未列出的作用域保持原状。'};
  if (position("accounts", "combo-probe") >= 0) return {
    ok: true, command: "accounts combo-probe", usage: "accounts combo-probe --scope <configured-scope> --accounts <ids> [--mode mixed|functions] [--model <id>] [--json]",
    behavior: "L0 多工具题校验算术、同轮双工具、回执与缓存。失败只报告 toolIssues，不触发单工具探针。mixed 默认；functions 是双普通函数对照。",
  };
  if (position("accounts", "tool-probe") >= 0) return {
    ok: true, command: "accounts tool-probe",
    usage: "accounts tool-probe --scope <configured-scope> --accounts <ids> [--model <id>] [--mode exec|submit_sum|submit_product|codex-custom|function] [--json]",
    behavior: "L0 独立单工具算术题；调用、算术与回执正确即通过。只观察回执轮缓存，未命中或未知不判错。标准模式跨作用域，codex-custom（默认）及 function 限 codex。",
  };
  if (idleProbe >= 0) return idleProbeHelp(actionAfter(idleProbe + 1, idleProbeActions));
  const quotaMonitorSample = position("upstreams", "quota-monitor");
  if (quotaMonitorSample >= 0 && args[quotaMonitorSample + 2] === "sample") return quotaMonitorSampleHelp();
  const scheduling = args.indexOf("upstream-scheduling-v2");
  if (scheduling >= 0) {
    const action = actionAfter(scheduling, schedulingActions);
    const modelSync = action === "model-sync" ? args.indexOf("model-sync") : -1;
    return upstreamSchedulingV2Help(action, action === "model-sync"
      ? actionAfter(modelSync, ["plan", "run", "history"])
      : undefined);
  }
  const scores = position("scores", "rank");
  if (scores >= 0) return scoreRankHelp();
  for (const action of ["aggregate", "diagnose", "list"] as const) {
    if (position("errors", action) >= 0) {
      if (action === "aggregate") return errorsAggregateHelp();
      if (action === "diagnose") return errorsDiagnoseHelp();
      return errorsListHelp();
    }
  }
  const modelsSync = position("upstreams", "models");
  if (modelsSync >= 0 && args[modelsSync + 2] === "sync") return upstreamWriteHelp("models sync");
  for (const action of ["recover", "status", "update"] as const) {
    if (position("upstreams", action) >= 0) return upstreamWriteHelp(action);
  }
  const modelAlias = position("upstreams", "model-alias");
  if (modelAlias >= 0) return modelAliasHelp();
  const usageCache = position("upstreams", "usage-cache");
  if (usageCache >= 0 && args[usageCache + 2] !== "restore") return upstreamsUsageCacheHelp();
  if (position("upstreams", "recharge-candidates") >= 0) return rechargeCandidatesHelp();
  const upstreams = args.indexOf("upstreams");
  if (upstreams >= 0) {
    const knownActions = new Set(["list", "capacity", "usage", "models", "model-alias", "usage-cache",
      "quota-summary", "quota-monitor", "recharge-candidates", "benchmark", "benchmark-status",
      "benchmark-history", "template", "initialize", "isolation", "create", "update", "recharge",
      "recharge-status", "recover", "pause", "status"]);
    const firstAction = args[upstreams + 1];
    if (firstAction && !firstAction.startsWith("-") && !knownActions.has(firstAction)) {
      throw new Error(`unknown upstreams operation ${firstAction}; run upstreams --help to choose a supported operation`);
    }
    const action = actionAfter(upstreams, ["create", "template", "list"] as const);
    if (action === "create") return upstreamCreateHelp();
    if (action === "template") return upstreamTemplateHelp();
    if (action === "list") return upstreamListHelp();
    return upstreamsGroupHelp();
  }
  return null;
}
