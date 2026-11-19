# r75 两小时巡检结论（北京时间 2026-11-18 01:06–03:06）

## 总评
- Sub2API 任务口径：6,689 请求、成功 6,679、失败 10，成功率 99.8505%；流式 TTFT 有效 6,517、缺失 0，P95 12,889ms；两项达标。本轮 Luna 0 条，任务口径与原始一致。
- Api2Business：387 请求、0 失败、P95 1,210.14ms，处于 owning 3,000ms 目标内（管理面观测口径）。
- 结论：总体 SLO 达标；openai 平台 10 条客户可见 502（全部 gpt-6.1-sol）构成真实退化；19:10:31Z 自动调度后 10 分钟 0 失败。
- 完整报告：本轮存在并行运行；先发报告为 `https://api2business.hwpod.com/observability?report=4a2ad764-d17f-4b5d-bc38-1249e42806f3`，本运行报告为 `https://api2business.hwpod.com/observability?report=856e3daa-c596-4930-b074-7434499276fa`（均 HTTP 200）。

## 平台与错误证据
- platform：openai 2,825 请求、10 失败、P95 18.069s；deepseek 1,811、0 失败、P95 6.301s；opencode_go 1,442、0 失败、P95 4.516s；command_code 484、0 失败、P95 8.399s；grok 103、0 失败、P95 16.615s；anthropic 24、0 失败。
- errors aggregate：13 行、13 distinct；客户可见 10、恢复 3，`probeNoiseExcluded=true`；business_limit 0。
- 10 条客户可见 502（全部 gpt-6.1-sol、phase internal、gateway_unavailable、单次尝试、无 failover）：
  - 账号 62（sub.yjxm1221.top pro 0.2）8 条：`fbf803cb-61e8-4e10-8547-586cd03e8e3c`、`d5eade8b-3d20-4cd2-91fc-e1d1cdb041c1`、`6565eb54-1474-4ea5-8c90-645c1a3ad38e`、`b6c83233-a254-4eb7-abf1-4213b2187532`、`d551fa18-d167-427a-b135-6c6e5b794a33`、`2fb5cd0f-0e29-4ff1-8c42-2dd1755f405f`、`d588a937-574b-44e2-9ec7-c25b41ea417f`、`19465e9b-70e5-4beb-91ae-28ac91d5cb0e`；commit-stage 均 `complete=true`、`upstreamErrorResponseAlreadyWritten=true`、`fallbackErrorResponseWritten=false`、`failoverSuppressedAfterSemanticOutput=false`；系统日志 `openai.forward_failed`；属提交后流中断，不能靠模板修复。
  - 账号 1549（lumibest.cc pro 0.13）1 条：`f43701e1-870d-4376-b3b6-e97ead9814cd`；commit-stage `complete=true`、`upstreamErrorResponseAlreadyWritten=false`、`fallbackErrorResponseWritten=false`；responseEvidence 仅系统日志 `openai.forward_failed`（21 字符），无稳定上游正文；无 failover。
  - 账号 1534（laaai.cc plus 0.07）1 条：`fe7e6f5d-78e2-4ce8-b69f-fa66259608f0`；提交前 502，属 #6561 同族（r74 已记录，本窗口重复）。
- 3 条恢复：gpt-5.6-terra 403（1495→1528）、gpt-5.6-sol 503（1498）、gpt-5.6-terra 403（1535），均 `failoverTriggered=true`、`recovered=true`，不构成客户失败。

## 调度与四作用域
- 账号 62：priority 279、score 73.0 C、failureRate 1.67%；自动轮次 18:30（14）、18:40（6）、18:50（4）、19:00（7）、19:10（11）连续应用，已降权。
- 账号 1549：priority 132、score 95.6 A、failureRate 1.41%；账号 1534：priority 100、score 97.6 A、failureRate 0.09%。
- 19:10:31Z 后 10 分钟（19:10:31Z–19:20:31Z）：588 请求、0 失败、P95 13.724s；openai 169 请求、0 失败；账号 62 17 样本、0 失败，502 未再出现。
- 四作用域：Codex 92.8/93.0 A（19:10 applied 11/11）、Claude 98.0/96.6 A（no-change）、Grok 83.6/91.4 B（19:10 applied 1/1）、DeepSeek 99.4/99.4 A（no-change）；sampledAt 19:07:55Z、sampleStale=false；query 均低于 10 秒、reconciliation matched、无阻断。
- Grok：103 请求、0 失败、P95 16.615s；516 56 样本 P95 16.978s、1538 31 样本 P95 10.175s、1488 4 样本 P95 5.476s；r74 修复后保持达标。

## OpenCode Go 与 CommandCode
- OpenCode Go：21 账号；11 个三窗口可观测、10 个 unknown（`Sub2API /v1/usage HTTP 403`，账号 1563/1564/1570/1571/1573/1574/1575/1576/1577/1578，均 active 但 schedulable=false）。
- 5 小时：11 observed / 10 unknown，low 0；周：11 observed / 10 unknown，low 2（1589 1%、1595 0%，11-23 00:00Z 重置）；月：11 observed / 10 unknown，low 9（1552/1555/1558/1559/1560/1561/1562 为 0%，1589 0%、1595 1%）。
- 主要有效月度额度：1588 28%（周 56%，12-12 07:33Z）、1592 46%（周 92%，12-13 14:01Z）；月度重置最晚 12-14。
- 封禁证据边界：本窗无真实用户 403/Workspace access denied；10 个不可调度账号的 `/v1/usage` 403 仅为额度探测错误，不形成封禁候选。
- CommandCode：6 账号，5 可调度（1556 schedulable=false）；5 小时 6/6、周 6/6、月 0/6 unknown；1583/1584 周额度 -0.008%/-0.01%，11-18 06:33–06:38Z 重置。
- CommandCode 五项：account_group 可用；quota_windows 5h/周可解析、月 unknown；model_protocol 兼容（deepseek-v4.1-flash 真实流量 484 请求、0 失败、P95 8.399s）；scheduler 无独立 command_code 作用域、未知；natural_traffic 满足（484 请求、0 失败）。结论：可补充供给，尚未证明无缝替代。

## 探活成本
- `probe-costs --days 7 --end 2026-11-17T19:06:44Z`：62,206 请求、已知 62,197、缺 9、覆盖 99.9855%、已知成本 96.192166 元；缺因仅 `historical_provider_rate_missing=9`。
- 逐日：11-12 29.609694、11-13 44.462671、11-14 9.744757、11-15 3.844097、11-16 4.040339、11-17 4.017366（缺 1）、11-18 部分日截至 03:06 为 0.473241 元/701 次。
- 评估日 11-17：4.017366 元（估算 4.018072）；日预算 5 元、趋势阈值 27.67638 元、基线中位数 18.45092 元；`budget.status=within`。
- Top 账号：xixiapi.cc ccmax 1.2 13.67%、cf.sheapi.cc grok 12.18%、www.sheapi.cc ccmax 1.2 11.91%、banliapi.top ccmax 1.1 11.70%、rapidapi.cc ccmax 0.78 7.86%。
- Top 模型：claude-sonnet-5-5 65.06%、grok-4.5 17.35%、gpt-6.1-sol 11.41%、claude-opus-5 3.64%、deepseek-v4.1-flash 2.37%。
- Top 平台：anthropic 68.71%、grok 17.35%、openai 11.41%、deepseek 2.53%。
- Top 上游：www.sheapi.cc 24.93%、banliapi.top 15.62%、xixiapi.cc 14.29%、rapidapi.cc 7.99%、api.laoliimage2.win 7.98%。

## 成本与充值
- 168h：2026-11-10T19:06:44Z–2026-11-17T19:06:44Z；705,474 总记录、704,802 纳入、704,721 已知、缺 81、覆盖 99.9885%、已知成本 9,340.172984 元（下界）；61 个钱包。
- 预算口径：max(11-12..11-17 六个完整日均、完整日峰值、recent24Hours) × 1.25；recent24Hours 窗口 11-16T19:06:44Z–11-17T19:06:44Z。
- 强烈建议：api.mmcapi.cn 22.17/44.75/55.94→50；sub.yjxm1221.top 59.53/23.26/92.77→50；www.sheapi.cc 37.94/17.28/47.87→50。
- 一般储备：banliapi.top 26.59/13.99/32.44→50；hyueapi.com 17.83/17.84/22.30→50；sub2.xingqiao.cc 15.20/5.80/16.03→50。
- qianfan.baidubce.com 余额未知（recent24Hours 8.642577 元），未列金额；opencode/commandcode 钱包余额来源 unknown，未列。

## 消耗停滞
- 扫描 166：healthy 6、consumption-stalled 17、watch 123、demand-insufficient 18、excluded 2、alerts 14。
- 强触发仅供关注、不是告警或事故：sub2.xingqiao.cc/openai 1493（15.20259116 USD，需求 1,563/1,121，0/0）；api.xingqiaolab.top/openai 1498/1499（24.03789777 USD，2,815/2,350，0/0）；ai1.c0c.cc/openai 1590（26.71041105 USD，1,475/1,039，0/0）；flow-node.com/openai 1496（45.1563757 USD，1,563/1,121，0/0）；lumibest.cc/openai 1597（34.406438 USD，2,815/2,358，0/0）。

## QQ、语音与其他
- `messages sources`：qq-main available、refresh applied、index ready；archive_updated_at 2026-11-17T02:12:24Z，last_sync 19:08:58Z outcome=unchanged、messages_added=0。
- QQ 三路检索（窗口 01:06:44–03:06:44）：群关键词 matched 0（job 9568b4aa72884ba2b5cfcad04a6895fe）；私聊关键词 matched 0（job 0ba11af4fbec4052a65f070902d884eb）；重点群 matched 0（job 408ef4b2007c491796d96e2d81ed1355）；coverage_degraded=false。归档未覆盖本窗口，结论为“无新增可检索消息”，不据此推断外部无活动。
- `gateway service-policy` 预览：changedCount=0、denyAudio=true，无漂移。
- Codex Auto Review：`reads query` 本窗 0 行，无真实用户请求。

## 本轮动作
- r75 的 #6561 证据由并行运行以 comment 6958267713 追加（1549 提交前 502、1534 重复样本、62 归 #7507）；本运行重复 comment 6958413554 已删除。
- 10 分钟复验追加到 #7507：comment 6958533464，`https://github.com/pikasTech/unidesk/issues/7507#issuecomment-6958533464`。
- 未修改 Sub2API 源码、模板、路由、账号、优先级或额度；未暂停账号。
- 未做工具/技能改动；未发现需当轮修复的工具摩擦。
- 定期报告：并行运行已于 19:18:39Z 发送并核验 job `email_3262d8ca3ed343b1afe11283ec12bf8a`（Message-ID `<179494313488.1848442.7371575132606487390@qq.com>`，receiveVerified=true）；本运行 19:22:36Z 又发送了一封内容不同的 r75 报告 job `email_847b5301b1054a5597ae8a0174cbebde`（Message-ID `<179494336955.1850063.2151760382866823801@qq.com>`，receiveVerified=true），属并行重复投递，已记录并停止继续发送。

## 未完成与下一步
- 账号 62 的提交后流中断：10 分钟已 0 失败，但 2 小时历史仍有 8 条；继续观察自然轮次与 2 小时滚动失败率，若复发再评估供给或进一步降权（不手动改路由）。
- 1549 的提交前 `openai.forward_failed` 已并入 #6561；等待网关侧提交阶段/failover 审计。
- 1534 提交前 502 仍属 #6561 未闭合问题，继续沿该 Issue 跟踪。
- OpenCode Go 月度额度集中在 1588/1592，需在下一轮核对是否仍能承流到 11-23 周重置；CommandCode 月度窗口仍 unknown。
- 下一精确核查时间：北京时间 2026-11-18 05:06（UTC 21:06）。
