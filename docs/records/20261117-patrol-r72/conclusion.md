# r72 两小时巡检结论（2026-11-17 19:06–21:06 北京时间）

## 总评
- Sub2API 任务口径已排除 Luna 2 条：5,394 请求、成功 5,371、失败 23，成功率 99.57%，流式 TTFT P95 9.34 秒；TTFT 有效 5,293、缺失 0，两项达标。
- 原始口径含 Luna：5,396 请求、成功率 99.57%、TTFT P95 9.34 秒；仅作对照，不用于任务总评。
- Api2Business：345 请求、0 失败、P95 1.22 秒，处于 owning 配置 3 秒目标内；管理面指标，非业务成功率。
- 结论：SLO 达标，但存在 20 条 `Codex Auto Review` 单模型真实用户失败；按真实用户请求失败进入问题跟踪，未观察到平台级中断。

## 关键证据
- 真实失败 23 条：20 条 `Codex Auto Review`（19:44:02–19:44:25）、2 条 426、1 条 gpt-6.1-sol 502。
- `Codex Auto Review`：3 条在账号 1597（lumibest.cc pro2 0.15）上游 503，正文 `No available channel for model Codex Auto Review under group codex不降智退款流20x (distributor)`；随后 17 条路由阶段无候选 503（`openai.account_select_failed`）。
- 组 662（【24H稳定】GPT 保不降智）仅账号 1597 一个未删除账号；该模型近 7 天 usage_logs 0 条、ops_error_logs 20 条，无成功基线。
- 426 2 条为客户端请求阶段 `WebSocket upgrade required`，无账号、无系统日志提交证据，归 #6561；502 1 条为账号 525，`errors commit-stage` 显示 `upstreamErrorResponseAlreadyWritten=true`，上游错误正文已写出，按规则抑制切号（组 2 有 79 个账号、42 个可调度，不是单候选），现有 502 规则已覆盖 `please retry later`，未重复加词。
- 335 条 429 全部为下游 Key 额度耗尽（user 39），按规则排除；探活/管理接口 864 条已排除，仅作巡检证据。
- 四作用域 21:18 自然轮次均 applied：Codex 1/1、Claude 2/2、Grok 0、DeepSeek 0；查询 137–480ms，快照约 6 分钟，无阻断或 score_error。
- 四作用域池分：Codex 96.5、Claude 97.1、Grok 94、DeepSeek 100；rolling 89.7/95.1/93.3/99.4。
- scores rank 13:08:51 刷新，queryDurationMs 1124.7，154 账号/152 组、ready。
- 探活覆盖：Codex 42/41（缺 1547）、Claude 20/19（缺 1502）、Grok 7/7、DeepSeek 3/3；1547、1502 reconcile 均 completed、attempted=0/succeeded=0，确认绑定已存在。
- 探活成本：11-16 完整日 4.040339 元、5,790 次、缺 0；今日部分日截至 21:06 为 3.55222 元、5,014 次、已知 5,013、缺 1、覆盖 99.98%；日预算 5 元、趋势阈值 20.036854 元，budget.status=within；七日基线中位数 13.3579 元（6 完整日+1 部分日）；七日合计 153.446341 元、100,790 次、覆盖 99.8621%，缺 139 条（provider_rate_missing 130、historical_provider_rate_missing 9）。
- 成本 168h：727,864 条总记录、727,192 条纳入范围、727,110 条已知、缺 82 条、672 条超出范围，覆盖率 99.9887%，已知成本 9,583.48 元（下界）；逐日 11-10 240.04（部分）、11-11 1767.998、11-12 1507.047、11-13 1199.525、11-14 1269.485、11-15 957.239、11-16 1433.145、11-17 1209.004（部分）。
- 钱包 61 个：31 fresh、20 stale、10 unknown、0 conflicting；仅 commandcode、opencode、qianfan 三个非 fresh 钱包有 24h 消耗。
- 消耗停滞扫描 166：healthy 8、stalled 20、watch 123、demand-insufficient 13、excluded 2、alerts 16；强触发示例 sub2.xingqiao.cc/openai 1493（余额 15.21 USD、需求 336/448、0/0）、hyueapi.com/anthropic 1520、api.xingqiaolab.top 1498、sub.yjxm1221.top 62、lumibest.cc 1597；仅供关注，不是告警或事故。
- OpenCode：21 账号、11 有观测/10 unknown；5h 低 0、周低 2（1589 1%、1595 0%，11-23 00:00Z 重置）、月低 9；24h 无 Workspace access denied/permission_error，不形成封禁候选。
- CommandCode：6 账号、5 可调度；5h 6/6、周 6/6、月 0/6 unknown（upstream-monthly-limit-or-percent-missing）；最近 10 分钟真实用户 132 请求、0 失败、P95 4.55 秒；无独立 command_code 作用域，结论“可补充供给，尚未证明无缝替代”。
- QQ：关键词搜索、私聊、配置群三路均 completed、matched 0、coverage_degraded=false；本窗口无新增可核验上游候选。
- 语音 gateway service-policy 预览 changedCount=0、denyAudio=true，无漂移。
- BugTeam 内部 inventory/shelves 522 持续至 13:12Z，约每 80 秒一次，非用户事故。

## 本轮动作
- 未修改业务运行面；补充 `skills/api2business/references/observability.md` 的 topN 截断取证说明，并用 `--top 100` 复核 426/502/503，避免默认 topN 掩盖低占比错误。
- 复核 `errors get`/`reads query` 后确认：17 条 routing 503 是真实用户 `Codex Auto Review` 请求，不是探活噪声；探活 864 条已正确排除，本轮无需修改 observability SQL。
- 向 #6368 追加 r72 证据评论：comment 6949381541。
- 定期报告已发送并核验：job email_8cc1be3b7b0841528fa81deec46f7531，status=succeeded，smtpSent=true，sentVerified=true，receiveVerified=true，mimeVerified=true；Message-ID <179492195350.1702318.1245952426179627454@qq.com>。
- TaskTree Checkpoint：tc_e7850d81-6667-4c13-bd4d-32f52402c8de（in_progress，99%）。

## 未完成与下一步
- `Codex Auto Review` 未找到可验证上游映射目标，未做猜测性 model-alias，未暂停账号；若客户确有需求，需确认映射目标或补充该模型供给。
- 426 继续按 #6561 跟踪；gpt-6.1-sol 单条 502、下游 429 与探活错误不扩大为事故。
- 下一精确核查时间：北京时间 2026-11-17 23:06；续接原 TaskTree，复核 #6368 是否复现、四作用域自然轮次与探活覆盖。

## 工具摩擦
- `observability report` 默认 topN 不保证覆盖低占比错误类型，已补充参考文档并要求取证时显式使用 `--top 100` 或请求级筛选；本轮已实际使用该入口。
- 补充两条取证说明：`observability report` 的 `platform=unknown` 只表示路由失败无账号行，需用 `ops_error_logs.platform` 回查；`upstreams benchmark` 对探活目录外模型返回 routing 404，不能当作上游不支持。
- 本轮实际使用了 `reads query` 的探活/benchmark 证据核对；未发现需要当轮修复的代码或 CLI 缺陷。

## 更正邮件
- 原报告将 gpt-6.1-sol 502（账号 525）写成“单候选未发生 failover”，复核 `errors commit-stage` 后更正为 `upstreamErrorResponseAlreadyWritten=true`，上游错误正文已写出，按规则抑制切号；组 2 有 79 个账号、42 个可调度，不是单候选。
- 426 两条复核为客户端请求阶段 `WebSocket upgrade required`，无系统日志提交证据，仍归 #6561。
- 更正邮件 job `email_385541bcb51348f5b9d7546efeef8888`，status=succeeded、smtpSent=true、sentVerified=true、receiveVerified=true、mimeVerified=true；Message-ID `<179492218366.1703854.8959647400024813196@qq.com>`。
- 更正不改变 r72 总评、Sub2API 成功率/TTFT、`Codex Auto Review` 问题与充值建议。
- 另发探活成本更正邮件 job `email_48ef3526b4be41369f6fd001727f6740`，`receiveVerified=true`，Message-ID `<179492265733.1707448.8334813474287234735@qq.com>`；今日部分日应为 3.55222 元、5,014 次、缺 1、覆盖 99.98%（原 3.22/4,552 为旧查询口径），`budget.status=within` 不变。

## 后续观察（报告发送后）
- 13:28Z 自然自动轮次继续正常：Codex applied 18/18、Claude 10/10、Grok 1/1、DeepSeek 0；查询 143–501ms，快照年龄 183–193 秒，无阻断或 score_error。
- `Codex Auto Review` 自 11:44:25Z 后未再出现新错误；继续在下一轮核验是否复现。

## 补充核验：Codex Auto Review 供给
- 对同供应商账号 1549（lumibest.cc pro）执行 `upstreams benchmark --id 1549 --model 'Codex Auto Review' --confirm`，benchmark run 44385e66-4329-499c-869d-3f3defc4ac85 终态 failed，6 个探针全部 HTTP 404，无有效分数。
- 但 6 条 404 均为 `account_id=null`、`error_phase=routing`、`error_type=model_not_found`（`api2business-probe-1549`），属于探活身份目录未配置该模型，不能独立证明 lumibest 上游缺少模型。
- 仍有效的直接上游证据只有账号 1597 的真实用户请求 503 `No available channel ... under group codex不降智退款流20x`；结论保持为组 662 单账号、无可验证内部映射。
- 已向 #6368 追加 comment 6949529546 并用 comment 6949543490 更正 benchmark 口径；未做 model-alias、暂停或路由修改。

## OpenCode 月额度补充
- 21 账号中 11 有观测、10 unknown；9 个账号月度 0–1%：其中 1552、1555、1558、1559、1560、1561、1562、1589 为 `rate-limited`，1595 为 1% 且 `status=ok`；重置时间分布在 11-30 至 12-14。
- 仍有月度余额的观测账号只有 1588（33%，12-12 07:33Z）与 1592（46%，12-13 14:01Z）；周窗口低额度 1589 1%、1595 0%，11-23 00:00Z 重置。
- 判断：若 OpenCode 是主力供给，月度有效额度高度集中于 1588/1592，存在月中供给不足风险；10 个 unknown 继续探测，不按有额度处理。
- 已发送补充邮件 job `email_7a4aa6f3fb1e4c6b829da0f3aae8a2af`，`receiveVerified=true`，Message-ID `<179492248898.1706081.6491007125403680309@qq.com>`；未购买账号、未充值、未调整路由。
