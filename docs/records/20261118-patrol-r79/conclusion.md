# r79 两小时巡检结论（北京时间 2026-11-18 11:06–13:06）

## 1. 运行时与窗口

- 触发时间：北京时间 2026-11-18 13:06:22；冻结窗口 11:06:06–13:06:06 CST（03:06:06–05:06:06Z）。
- 任务：tt_fc0f9529-7eee-4529-be8f-271126685788（常驻巡检母任务）。
- 证据目录：`/root/api2business/.state/patrol-r79/`。

## 2. 任务口径 SLO（排除 Luna）

| 指标 | 值 | 目标 | 结论 |
| --- | --- | --- | --- |
| 请求数 | 13,602 | - | - |
| 成功 | 13,536 | - | - |
| 失败 | 66 | - | - |
| 成功率 | 99.514777% | >95% | 达标 |
| TTFT 有效样本 | 13,398（缺失 0） | - | 覆盖 100% |
| TTFT P95 | 9,103.5ms | ≤30,000ms | 达标 |

- 原始含 Luna：13,613 请求、13,547 成功、66 失败、P95 9,093.8ms；仅并列保留。
- Api2Business：344 请求、0 失败、P95 2,103.33ms、非 5xx 100%、覆盖完整。

## 3. 平台分布（窗口）

- DeepSeek 5,499 / 0 失败 / P95 4,533ms。
- CommandCode 4,980 / 0 / 3,896.05ms。
- OpenCode Go 552 / 0 / 2,684.1ms。
- Anthropic 56 / 6 失败；OpenAI 2,426 / 6；Grok 47 / 1。
- Unknown 53 / 53 失败，全部为下游 API-key 欠费或额度不足，已排除上游质量，不列协助。

## 4. 真实用户失败与根因

- `claude-haiku-4.5` 49 条客户可见：43×503 `gateway.select_account_no_available`、6×502（1525/1527）；突发 03:09–03:11、03:19、03:51–03:57、04:42–04:45Z。
- 根因：自动模型同步 03:43:04Z 将 1548 映射键 14→13，删除 r78 修复的 `claude-haiku-4.5`；1525/1527 自映射；组 161 仅三账号且全部可调度。
- thinking 404 6 条：haiku-4-5-20251001-thinking 2、sonnet-5-5-thinking 2、sonnet-5-thinking 2；上游支持未知。
- gpt-6-sol 4×502 `openai.user_slot_acquire_failed`（03:10:49–03:11:22Z，用户级并发，组容量未耗尽）。
- gpt-6.1-sol 3×502（1534/1535）+ 487 队列满 429（已写出后）。
- Grok 516 1×524；其余 6×502 恢复；DeepSeek 5,499 全成功。

## 5. 本轮修复

1. `config/api2business.yaml`：`modelSyncPolicy.canonicalModels.claude-haiku-4-5` 增加 `retainAliasesUntil: 2026-11-26T00:00:00Z` 与 alias `claude-haiku-4.5`；`config validate` 与 `deploy:validate` 通过（ok:true，5 files）。
2. 1548/1525：`claude-haiku-4.5 -> claude-haiku-4-5`（persisted，native-bulk-merge）。
3. 1527：model-sync 采纳上游真实名 `claude-haiku-4.5`；上游该模型 502/503（见 #7595）。
4. api/worker 05:12:56Z 热加载，健康；Sub2API 未重启。
5. claude 切号模板重应用到 1525/1527/1548：applied 3 / verified 3 / failed 0 / misaligned 0。
6. 技能文档：`references/upstream-scheduling.md` 增补 alias canonical 写入限制与 broker 回读滞后处置。

## 6. 复验

- 05:12:56–05:22:56Z：592 请求、0 失败、100%、P95 4,480.5ms。
- 05:12:56–05:35:20Z：`errors diagnose --model claude-haiku-4.5` 无近期错误。
- 05:13:36–05:30:12Z：1548 承接 23 条 haiku 真实请求，全部成功。
- 1527 benchmark：haiku 6/6 失败（502/503）；sonnet-5-5 succeeded（66.7）→ 账号正常、haiku 上游不可用。
- 四作用域自然轮次：05:24:54–05:24:56 与 05:34:56–05:35:11 均 applied、无阻断，查询 10–47ms，快照 ready、complete。
- 模板应用后待自然 haiku 流量验证 1527→1525/1548 切换。

## 7. 其他巡检事实

- 探活成本：今日部分日 1.86 元/2,883 次；7 日 97.57 元/64,388 次，覆盖 99.9860%，缺 9 条历史倍率；评估日 11-17 4.02 元，低于 5 元预算，7 日中位 18.45，阈值 27.68，`within`。
- 消耗停滞：166 账号，healthy 14 / stalled 15 / watch 131 / demand-insufficient 4 / excluded 2 / alerts 12；仅供关注。
- 成本：168 小时 698,028 记录，纳入口径 697,356，已知 697,275，缺 81，覆盖 99.9884%，已知 9,349.391444 元（下界）。
- 钱包：61 个，31 fresh / 20 stale / 10 unknown，0 冲突。
- OpenCode Go：21 账号，11 可读、10 个 403 unknown；5h 低 0、周低 3、月低 10；无账号级权限正文。
- CommandCode：6 账号探测成功；5h 6/0、周 6/3 低、月 0/6 unknown；自然 4,980 请求 0 失败、P95 3.896s；无独立 command_code 作用域 → “可补充供给，尚未证明无缝替代”。
- QQ：三路检索 0 条，本窗口无新增可核验候选；语音 `changedCount=0`、`denyAudio=true`。

## 8. 邮件

- 标题：`【通知】【两小时巡检】Sub2API 与 Api2Business｜北京时间 2026-11-18 11:06–13:06｜存在异常｜【建议充值】`
- jobId：`email_adafd1852d9f48d18a6173de3c9ee412`
- Message-ID：`<tencent_3C7418604736C2380FBC463081A2632CAC09@qq.com>`
- receiveVerified：true。

## 9. 事故状态

- #7564：haiku 别名与 thinking 映射缺口。别名部分已修复并 22 分钟无错误；thinking 404 与 1527 上游 haiku 缺陷仍在，保持 open。
- #7565：gpt-6-sol 用户槽位；本窗口 4 条后无复发，保持 open 观察。
- #6745：1588 无近期客户错误；仅巡检证据。
- #7549：1597 仅 1 条已恢复 429。
- #7595：新开，1527 haiku 上游 502/503。
- 下一精确核查：北京时间 2026-11-18 13:45（UTC 05:45），重点 1527 自然流量切换与 thinking 404。
