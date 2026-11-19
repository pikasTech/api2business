# r74 两小时巡检结论（北京时间 2026-11-17 23:06–2026-11-18 01:06）

## 总评
- Sub2API 任务口径已排除 Luna 8 条：6,712 请求、成功 6,711、失败 1，成功率 99.9851%，流式 TTFT 有效 6,549、缺失 0，P95 11,240ms；两项达标。
- 原始含 Luna：6,720 请求、失败 1、TTFT P95 11,238ms；仅作对照。
- Api2Business：331 请求、0 失败、P95 1,353.02ms，处于 owning 3,000ms 目标内（管理面观测口径）。
- 结论：总体 SLO 达标；2 条客户可见 5xx 未闭合（1554 的 504 原因未知、1534 的提交前 502 属 #6561 同族）；Grok 2 小时 P95 53.54s 超 30s，修复后 10 分钟降至 17.0s。
- 完整报告：`https://api2business.hwpod.com/observability?report=89ddfcf2-866a-42a2-a8e7-ac61de6b09d4`（HTTP 200）。

## 平台与错误证据
- platform：openai 2,355 请求、0 失败、P95 15.587s；deepseek 1,905、1 失败、P95 5.262s；command_code 916、0 失败、P95 4.592s；grok 424、0 失败、P95 53.542s；opencode_go 1,096、0 失败、P95 4.035s；anthropic 24、0 失败。
- errors aggregate（2h 窗口）：2 行、2 distinct；客户可见 1、恢复 1，`probeNoiseExcluded=true`。
- 客户可见 504：request `e1b6c155-41ca-46e1-bb11-48de3db2a9ed`，账号 1554（opencode，平台 deepseek，模型 deepseek-v4.1-flash，stream），`/v1/responses`，上游 504、recorded 499、单次尝试、`failoverTriggered=false`、`responseEvidence.available=false`；`errors commit-stage` 返回 `complete=false`、`missingReason=no_system_logs_for_request`，提交阶段未知；`abortedClientDisconnected=false` 仅表示无系统日志证据。
- 已恢复：账号 1534 `gpt-6.1-terra` 404 `model_not_found`，`failoverTriggered=true`、recovered=true，不构成客户失败。
- 账号 1554 近 7 天另有 6 条客户可见 `502:internal` 单次无 failover：`b341145d-3d2f-4498-a5de-6411ae473216`、`fd46f571-d491-452e-99f4-c7227aa0ad66`、`38290b97-c164-4e21-b75c-06c4add012b7`、`37d7c6a9-0ac0-44bb-ab5b-79770d87cdcd`、`023500c5-daf3-4a44-820c-547b1d714121`、`aa9263d6-e6de-4888-811d-5650ff4d26e7`、`8ad32e38-a800-4779-80cf-63cd36181f38`。
- 修复后 10 分钟窗口（17:19:50Z–17:29:50Z）新增 1 条客户可见 502：request `fe7e6f5d-78e2-4ce8-b69f-fa66259608f0`，账号 1534（laaai.cc plus，gpt-6.1-sol），`commit-stage complete=true`、`upstreamErrorResponseAlreadyWritten=false`、`fallbackErrorResponseWritten=false`、`failoverSuppressedAfterSemanticOutput=false`、单次尝试、`failoverTriggered=false`。
- 候选核对：1554 所在组 131 内另有 1557（priority 111）、1582（priority 121），均 active/schedulable；504 时兼容候选存在，但提交阶段未知，不能仅凭候选存在判定“应切未切”。
- 1534 与 1554 当前均 active/schedulable，未暂停。

## Grok 延迟与调度
- 2 小时：grok 424 请求、0 失败、P95 53.542s；账号 516（Grok-hyueapi）94 样本、P50 33.3825s、P95 72.206s、max 85.713s、约 36.2% 承流；1538 307 样本、P95 13.552s、约 61.8%；1488 11 样本、P95 6.68s。
- 自动轮次：16:59:43 applied 2/2；17:09:47 applied 2/2；17:19:50 applied 3/3（1538 111→100、1488 100→111、54 300→142），snapshot age 40s、无阻断；17:29:52 no-change。
- 当前优先级：1538=100、1488=111、516=121、54=142、1506=132、1517=300、1530=300；516 仍为 C 级（score 77.8）但 17:19 计划为 noop。
- 修复后 10 分钟：grok 36 请求、0 失败、P95 16.998s；516 14 样本、P95 18.433s；1538 21 样本、P95 5.817s。10 分钟窗口已回到 30s 目标内；历史 2 小时 P95 如实保留。

## 四作用域 V2
- Codex：pool 96.0、rolling 92.1、A；17:29:49 automatic applied 4/4，query 预算内、无阻断。
- Claude：pool 97.9、rolling 96.3、A；17:29:53 applied no-change；`cache.state=hit`、`complete=true`、failedSections 空。
- Grok：pool 82.8、rolling 92.4、B；17:29:52 no-change。
- DeepSeek：pool 100、rolling 99.4、A；17:29:52 no-change。
- 四作用域 poolQuality sampledAt 均为 2026-11-17T16:57:37Z、sampleStale=false；17:30 复读 pool/rolling 为 Codex 96.0/92.1、Claude 97.9/96.3、Grok 82.8/92.4、DeepSeek 100/99.4。
- 四作用域 reconciliation 全部 matched，query 均低于 10 秒；无 automation_blocked_reasons 或 score_error。

## OpenCode Go 与 CommandCode
- OpenCode Go：21 账号；11 个三窗口可观测、10 个 unknown（`Sub2API /v1/usage HTTP 403`，账号 1563/1564/1570/1571/1573/1574/1575/1576/1577/1578，均 active 但 schedulable=false）。
- 5 小时：11 observed / 10 unknown，low 0；周：11 observed / 10 unknown，low 2（1589 1%、1595 0%，11-23 00:00Z 重置）；月：11 observed / 10 unknown，low 9（1552/1555/1558/1559/1560/1561/1562 为 0%，1589 0%、1595 1%）。
- 主要有效月度额度：1588 30%（12-12 07:33Z）、1592 46%（12-13 14:01Z）；月度重置最晚 12-14。
- 封禁证据边界：本窗无真实用户 403/Workspace access denied；10 个不可调度账号的 `/v1/usage` 403 仅为额度探测错误，不形成封禁候选；账号级结论为“无新增封禁证据”。
- CommandCode：6 账号，5 可调度（1556 schedulable=false）；5 小时 6/6、周 6/6、月 0/6 unknown；1583/1584 周额度 -0.008%/-0.01%，11-18 06:33–06:38Z 重置。
- CommandCode 五项：account_group 可用；quota_windows 5h/周可解析、月 unknown；model_protocol 兼容（deepseek-v4.1-flash 真实流量 916 请求、0 失败、P95 4.592s）；scheduler 无独立 command_code 作用域、未知；natural_traffic 满足（916 请求、0 失败）。结论：可补充供给，尚未证明无缝替代。

## 探活成本
- `probe-costs --days 7`：61,757 请求、已知 61,748、缺 9、覆盖 99.9854%、已知成本 95.891829 元；缺因仅 `historical_provider_rate_missing=9`。
- 逐日：11-12 29.609694、11-13 44.462671、11-14 9.744757、11-15 3.844097、11-16 4.040339、11-17 4.017366（缺 1）、11-18 部分日截至 01:06 为 0.172904 元/252 次。
- 评估日 11-17：4.017366 元（估算 4.018072）；日预算 5 元、趋势阈值 27.67638 元、基线中位数 18.45092 元；`budget.status=within`。
- Top 账号：xixiapi.cc ccmax 1.2 13.68%、cf.sheapi.cc grok 12.19%、www.sheapi.cc ccmax 1.2 11.87%、banliapi.top ccmax 1.1 11.71%、rapidapi.cc ccmax 0.78 7.88%。
- Top 模型：claude-sonnet-5-5 65.16%、grok-4.5 17.34%、gpt-6.1-sol 11.39%、claude-opus-5 3.58%、deepseek-v4.1-flash 2.35%。
- Top 平台：anthropic 68.75%、grok 17.34%、openai 11.39%、deepseek 2.51%。
- Top 上游：www.sheapi.cc 24.90%、banliapi.top 15.61%、xixiapi.cc 14.29%、rapidapi.cc 8.01%、api.laoliimage2.win 8.01%。

## 成本与充值
- 168h：2026-11-10T17:06:13Z–2026-11-17T17:06:13Z；712,808 总记录、712,136 纳入、712,054 已知、缺 82、覆盖 99.9885%、已知成本 9,404.925006 元（下界）；61 个钱包。
- 预算口径：max(11-12..11-17 六个完整日均、完整日峰值、recent24Hours) × 1.25；recent24Hours 窗口 11-16T17:06:13Z–11-17T17:06:13Z。
- 强烈建议：sub.yjxm1221.top 63.10/20.60/92.77→50；api.mmcapi.cn 27.84/39.72/49.65→50；www.sheapi.cc 38.05/23.92/47.87→50。
- 一般储备：hyueapi.com 18.76/18.03/22.53→50；banliapi.top 29.79/11.10/32.44→50；sub2.xingqiao.cc 15.20/5.80/16.03→50。
- qianfan.baidubce.com 余额未知（recent24Hours 8.64 元），未列金额；opencode/commandcode 钱包余额来源 unknown，未列。

## 消耗停滞
- 扫描 166：healthy 8、consumption-stalled 19、watch 124、demand-insufficient 13、excluded 2、alerts 14。
- 强触发仅供关注、不是告警或事故：sub2.xingqiao.cc/openai 1493（15.20391166 USD，需求 1,118/795，0/0）；api.xingqiaolab.top/openai 1498/1499（24.04733677 USD，2,347/1,533，0/0）；ai1.c0c.cc/openai 1590/1591（26.71721305 USD，1,035/669，0/0）；flow-node.com/openai 1496（46.65503657 USD，1,118/795，0/4.7918385）；lumibest.cc/openai 1549/1597（34.490882 USD，2,244/1,361，0/0）。

## QQ、语音与其他
- `messages sources`：qq-main available、refresh applied、index ready；archive_updated_at 2026-11-17T02:12:24Z，last_sync 17:13:47Z outcome=unchanged。
- QQ 三路检索（窗口 23:06:16–01:06:13）：群关键词 matched 0（job 13cb4541409848b08773ca183006088f）；私聊关键词 matched 0（job c8f040f18b0144a28eea6b1fd7f04c67）；重点群 matched 0（job 9f45fb27a8ce44a8a3c79bd5ba2f78c9）；coverage_degraded=false。归档未覆盖本窗口，结论为“无新增可检索消息”，不据此推断外部无活动。
- `gateway service-policy` 预览：changedCount=0、denyAudio=true，无漂移。
- Codex Auto Review：`reads query` 本窗 0 行，无真实用户请求；未把探活 404 当事故。

## 本轮动作
- 向 #6561 追加 r74 证据：comment 6955533127，`https://github.com/pikasTech/unidesk/issues/6561#issuecomment-6955533127`（含 1554 的 504、1554 历史 502:internal、1534 新 502）。
- 未修改 Sub2API 源码、模板、路由、账号、优先级或额度；未暂停账号。
- 未做工具/技能改动；未发现需当轮修复的工具摩擦。操作误差记录：误用 `upstreams workflow status`（正确为 `workflow status`）、`email wait --job`（正确为 `email wait <job-id>`），均已按 help 修正，未改代码。
- 定期报告已发送：job `email_62caa15585af4701900a557cf618f7a0`，status=succeeded，smtpSent=true，sentVerified=true，receiveVerified=true，mimeVerified=true；Message-ID `<179493679667.1804235.6428258766701431999@qq.com>`，receivedMessageId `<tencent_434E2D2F2ACCC1685B0B299D49D8E58D5007@qq.com>`。

## 未完成与下一步
- 1554 的 504 原因仍未知：等待下一次同类样本或系统日志；若出现可用的提交前上游正文，再按精确规则判断模板。
- 1534 提交前 502 未 failover 属 #6561 未闭合问题，继续沿该 Issue 跟踪，不在本任务重复建单。
- Grok 修复后 10 分钟已达标，继续观察后续自然轮次与 2 小时滚动 P95；若 516 延迟仍高且承担大量流量，按评分结果继续由自动调度处理，不手动改路由。
- OpenCode Go 月度额度集中在 1588/1592，需在下一轮核对是否仍能承流到 11-23 周重置；CommandCode 月度窗口仍 unknown。
- 下一精确核查时间：北京时间 2026-11-18 03:06（UTC 19:06）。
