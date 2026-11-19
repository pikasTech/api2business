# r76 两小时巡检结论（北京时间 2026-11-18 03:06–05:06）

## 总评
- Sub2API 任务口径：4,522 请求、成功 4,519、失败 3，成功率 99.9337%；流式 TTFT 有效 4,361、缺失 0，P95 11,399ms；成功率与 TTFT 两项 SLO 达标。Luna 0 条，原始口径与任务过滤口径一致。
- Api2Business：334 请求、0 失败，P95 1,630.77ms，处于 owning 3,000ms 目标内；non-5xx 100%（目标 ≥99.9%）。
- 结论：总体 SLO 达标；3 条 `gpt-6.1-sol` 客户可见 502（0.066%）构成真实退化，其中 2 条提交后流中断、1 条提交前未切号，均已归入既有 Issue。
- 完整报告：`https://api2business.hwpod.com/observability?report=e4e4a81d-f408-429e-9931-9c364fee687f`（HTTP 200）。

## 平台与错误证据
- platform：openai 1,918 请求、3 失败、P95 18.468s；deepseek 1,227、0 失败、P95 6.102s；opencode_go 1,130、0 失败、P95 3.555s；command_code 211、0 失败、P95 7.195s；anthropic 24、0 失败；grok 12、0 失败。
- `errors aggregate --top 100`：7 行、7 distinct；客户可见 3、恢复 4，`probeNoiseExcluded=true`；status 维度为 502×3、200×4；phase 为 internal×3、upstream×4；family 为 gateway_unavailable×3、stream_interrupted×4。
- 3 条客户可见 502（全部 `gpt-6.1-sol`、`/v1/responses`、`stream=true`、单次尝试、无 failover）：
  - 账号 62（`sub.yjxm1221.top pro 0.2`）1 条：`df48eb1b-070a-434c-a414-bd65e629c0a9`，19:08:08Z；`commit-stage` 为 `upstreamErrorResponseAlreadyWritten=true`、`fallbackErrorResponseWritten=false`；提交后流中断，归 #7507。
  - 账号 487（`banliapi.top pro 0.13`）1 条：`2755a651-874c-4552-bb86-ed91fa900128`，19:38:19Z；`upstreamErrorResponseAlreadyWritten=true`；同签名提交后流中断，已在 #7507 记录，复发再单独建单。
  - 账号 1549（`lumibest.cc pro 0.13`）1 条：`69d99cad-33f0-4c11-bdac-c3aae24fd86e`，20:23:39Z；`upstreamErrorResponseAlreadyWritten=false`、`fallbackErrorResponseWritten=false`；`responseEvidence` 仅系统日志 `openai.forward_failed`（21 字符），无稳定上游正文；归 #6561。
- 4 条恢复：403×3（1495→1528、1535 等）与 520×1，均 `failoverTriggered=true`、`recovered=true`，不构成客户失败。
- DeepSeek 独立核对：1,227 请求、0 失败、P95 6.102s；无客户可见错误。
- Grok：12 请求、0 失败；V2 池分 83.6/90.3 B，无失败主线。
- 429 routing、503 upstream 等大量原始行来自专用探活 Key；`errors aggregate` 已排除，未计入客户可见错误。

## 调度与四作用域
- Codex：pool 95.8 / rolling 93.7 A；80 账号、42 可调度；sampledAt 21:07:17Z、sampleStale=false；21:01Z 自动轮次 applied，verified 5。
- Claude：pool 98.2 / rolling 97.0 A；22 账号、20 可调度；21:01Z 自动轮次 applied、no-change。
- Grok：pool 83.6 / rolling 90.3 B；11 账号、7 可调度；21:01Z 自动轮次 applied，verified 2。
- DeepSeek：pool 100 / rolling 99.4 A；13 账号、3 可调度；21:01Z 自动轮次 applied、no-change。
- 四作用域 `reconciliation=matched`、`mismatchCount=0`；所有 section fresh、查询低于 10 秒、无阻断；`scores rank` query 801.6ms。
- 关键账号：62 score 94.0 A、priority 268、failureRate 0；1549 94.3 A、priority 184；487 99.9 A、priority 121；1534 96.0 A、priority 100；1554 100 A。
- 账号 62 从 r75 的 73.0 C/279 恢复，本窗仅 1 条低频提交后 502；未手动改路由、未暂停账号。

## OpenCode Go 与 CommandCode
- OpenCode Go：21 账号；11 个三窗口可观测、10 个 unknown（`Sub2API /v1/usage HTTP 403`，账号 1563/1564/1570/1571/1573/1574/1575/1576/1577/1578，均 active 但 schedulable=false）。
- 5 小时：11 observed / 10 unknown，low 0；周：11 observed / 10 unknown，low 2（1589 1%、1595 0%，11-23 00:00Z 重置）；月：11 observed / 10 unknown，low 9（1552/1555/1558/1559/1560/1561/1562 为 0%，1589 0%、1595 1%）。
- 主要有效月度额度：1588 月 27%/周 54%（12-12 07:33Z）；1592 月 46%/周 92%（12-13 14:01Z）；月度重置最晚 12-14。
- 封禁证据边界：本窗无真实用户 403/Workspace access denied；10 个不可调度账号的 `/v1/usage` 403 仅为额度探测错误，不形成封禁候选；OpenCode 平台 1,130 请求、0 失败、P95 3.555s。
- CommandCode：6 账号，5 可调度（1556 schedulable=false）；5 小时 6/6、周 6/6、月 0/6 unknown；1579/1580/1581 周剩余 21.483%/38.854%/39.521%，1583/1584 周额度 -0.008%/-0.01%，11-18 06:33Z/06:38Z 重置。
- CommandCode 五项：account_group 可用；quota_windows 5h/周可解析、月 unknown；model_protocol 兼容（211 请求、0 失败、P95 7.195s）；scheduler 无独立 command_code 作用域、未知；natural_traffic 满足。结论：可补充供给，尚未证明无缝替代。

## 探活成本
- `probe-costs --days 7`：62,640 请求、已知 62,631、缺 9、覆盖 99.9856%、已知成本 96.444521 元；缺因仅 `historical_provider_rate_missing=9`。
- 逐日：11-12 29.609694、11-13 44.462671、11-14 9.744757、11-15 3.844097、11-16 4.040339、11-17 4.017366（缺 1）、11-18 部分日截至 05:08 为 0.725596 元/1,135 次。
- 评估日 11-17：4.017366 元（估算 4.018072）；日预算 5 元、趋势阈值 27.67638 元、基线中位数 18.45092 元；`budget.status=within`。
- Top 账号：xixiapi.cc ccmax 1.2 13.65%、cf.sheapi.cc grok 12.15%、www.sheapi.cc ccmax 1.2 11.93%、banliapi.top ccmax 1.1 11.70%、rapidapi.cc ccmax 0.78 7.84%。
- Top 模型：claude-sonnet-5-5 64.96%、grok-4.5 17.37%、gpt-6.1-sol 11.43%、claude-opus-5 3.68%、deepseek-v4.1-flash 2.38%。
- Top 平台：anthropic 68.65%、grok 17.37%、openai 11.44%、deepseek 2.54%。
- Top 上游：www.sheapi.cc 24.93%、banliapi.top 15.64%、xixiapi.cc 14.28%、rapidapi.cc 7.97%、api.laoliimage2.win 7.96%。

## 成本与充值
- 168h：2026-11-10T21:08:19Z–2026-11-17T21:08:19Z；699,837 总记录、699,165 纳入、699,084 已知、缺 81、覆盖 99.9884%、已知成本 9,286.949851 元（下界）；61 个钱包；冲突 0。
- 预算口径：max(六个完整日均、完整日峰值、`recent24Hours`) × 1.25；recent24Hours 窗口 2026-11-16T21:08:19Z–2026-11-17T21:08:19Z（北京 11-17 05:08–11-18 05:08）。
- 强烈建议：api.mmcapi.cn 19.01/41.12/51.40→50；sub.yjxm1221.top 56.48/26.14/92.77→50；www.sheapi.cc 37.85/10.09/47.87→50。
- 一般储备：banliapi.top 24.13/16.26/32.44→50；hyueapi.com 17.78/16.96/21.20→50；sub2.xingqiao.cc 15.20/5.80/16.03→50；qianfan.baidubce.com 余额未知/8.64/272.18→待核实。
- qianfan 余额来源 unknown，预算按历史峰值 217.74×1.25 估算；未列 0、未实际充值。

## 消耗停滞
- 扫描 166：healthy 7、consumption-stalled 18、watch 123、demand-insufficient 16、excluded 2、alerts 14。
- 强触发仅供关注、不是告警或事故：
  - sub2.xingqiao.cc/openai 1493（15.20 USD，fresh，需求 1,052，0/0）。
  - api.xingqiaolab.top/openai 1498/1499（24.03 USD，fresh，需求 1,915，0/0）。
  - ai1.c0c.cc/openai 1591（26.67 USD，fresh，需求 1,915，0/0）。
  - flow-node.com/openai 1495（44.96 USD，fresh，需求 1,915，当前 95 条/0.561 USD，上一窗 260 条/9.347 USD）。
  - lumibest.cc/openai 1597（33.67 USD，fresh，需求 1,915，0/0）。
- Watch 123 主要为余额陈旧、不可调度或非正余额；excluded 2 为无兼容需求或探活噪声；未修改供给、未伪造 resolved。

## QQ、语音与其他
- `messages sources`：qq-main available、refresh applied、index ready；last_sync 21:17:45Z、outcome=unchanged、messages_added=0。
- QQ 三路检索（窗口 03:06:09–05:06:09）：私聊 0 匹配（job 5f20a6805c86481496aa01f38b5c4408）、群关键词 0 匹配（job bc1ed24ea8154fd89f6b429f4339b546）、重点群 0 匹配（job 11c0d338be794a0abe9d23221ab8bb00）；coverage complete、degraded=false。结论：本窗口无新增可核验候选。
- `gateway service-policy` 预览：changedCount=0、denyAudio=true，无漂移。
- Codex Auto Review：`reads query` 本窗 0 行，无真实用户请求。

## 本轮动作与工具改进
- #6561 追加 r76 证据：comment `6961328445`（1549 提交前 502、62/487 提交后 502）。
- #7507 追加 r76 续接：comment `6961328417`（账号 62 低频复发、487 同签名、62 分数恢复）。
- 窗口后 10 分钟自然流量复核（21:06:09Z–21:16:09Z）：464 请求、0 失败、P95 8.875s；账号 62/487 未再出现 502，已追加 #7507 comment `6961416910`。
- 工具改进：`skills/api2business/references/observability.md` 补充“只读 broker 不暴露 Api2Business `internal_probe_keys`/`request_groups`，全窗状态覆盖优先用 `errors aggregate --top 100` 的 `dimensions.status`”；本轮已实际使用，避免重复 409。
- 未修改 Sub2API 源码、模板、路由、账号、优先级或额度；未暂停账号；未充值、未改账务。
- 定期报告：job `email_81f650b4060949a6bf63a14e6fccd843`，Message-ID `<179495052142.1899556.13290422158941661499@qq.com>`，`receiveVerified=true`，`smtpReplyCode=250`。

## 未完成与下一步
- 账号 62 的提交后流中断仍为低频复发（本窗 1 条），继续观察自然轮次与滚动失败率；不手动改路由。
- 1549 的提交前 502 已并入 #6561；等待网关侧提交阶段/failover 审计。
- 487 的提交后 502 已在 #7507 记录；若复发再单独建单。
- OpenCode Go 月度额度集中在 1588/1592，需在下一轮核对是否仍能承流到 11-23 周重置；CommandCode 月度窗口仍 unknown，1583/1584 周额度 06:33–06:38Z 重置后复核。
- 下一精确核查时间：北京时间 2026-11-18 07:06（UTC 23:06）。
