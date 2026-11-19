# r77 两小时巡检结论（北京时间 2026-11-18 07:06–09:06）

## 总评
- Sub2API 任务口径：8,403 请求、成功 8,389、失败 14，成功率 99.8334%；流式 TTFT 有效 8,225、缺失 0，P95 7,743ms；两项 SLO 达标。原始 8,404 请求中排除 Luna 1 条。
- Api2Business：280 请求、0 失败，P95 1,249.21ms，处于 owning 3,000ms 目标内；non-5xx 100%。
- 结论：SLO 达标，但 14 条 `gpt-6.1-sol` 客户可见失败构成真实退化，全部为响应已写出后的流中断；账号 487 占 12×502 + 1×429，账号 62 占 1×502。
- 07:06 轮次在 TaskTree 与邮件中均无记录；本轮回补 05:06–07:06 窗口，发现 3 条客户可见失败（1597 两条 `gpt-6.2-astra` 503、1534 一条 502）。
- 完整报告：`https://api2business.hwpod.com/observability?report=ce99f011-1b89-4a08-8607-08197d119055`（HTTP 200）。

## 平台与错误证据
- platform：openai 2,148 请求、14 失败、P95 12.902s；deepseek 3,053、0 失败、P95 3.994s；opencode_go 3,087、0 失败、P95 3.299s；command_code 78、0 失败、P95 2.567s；anthropic 24、0 失败；grok 14、0 失败。
- `errors aggregate --top 100`：18 行、18 distinct；客户可见 14、恢复 4，`probeNoiseExcluded=true`；status 为 502×13、429×1、200×4；account 为 487×13、62×1、1549×4（全部恢复）。
- 14 条当前窗口失败均为 `gpt-6.1-sol`、`/v1/responses`、`stream=true`、单次尝试、`upstreamErrorResponseAlreadyWritten=true`；模板与切号无法补救。
- 账号 487（`banliapi.top pro 0.13`）12×502 + 1×429，时间 23:21–00:32Z；502 系统日志均为 `openai.forward_failed`；429 上游正文为 `gateway_queue_full` / `Too many pending requests, please retry later` / `type=rate_limit_error`。
- 账号 62（`sub.yjxm1221.top pro 0.2`）1×502，01:01:42Z，`upstreamErrorResponseAlreadyWritten=true`。
- 4 条恢复：200 状态、upstream phase，`failoverTriggered=true`、`recovered=true`，不构成客户失败。
- 缺口窗口 05:06–07:06：3 条客户可见失败。
  - 账号 1597（`lumibest.cc pro2 0.15`）2×503 `gpt-6.2-astra`，上游正文 `model_not_found` / `No available channel for model gpt-6.2-astra under group codex不降智退款流20x (distributor)`；尝试链 1597→1597，`failover_observed_recovery_unconfirmed`；commit-stage 提交前。
  - 账号 1534（`laaai.cc plus 0.07`）1×502，23:05:15Z，`openai.forward_failed`，提交前、无 failover，归 #6561。
- DeepSeek 独立核对：3,053 请求、0 失败、P95 3.994s，无客户可见错误。
- Grok：14 请求、0 失败；V2 池分 84.3/88.2 B，无失败主线。

## 调度与四作用域
- Codex：pool 94.8 / rolling 94.1 A；80 账号、42 可调度；sampledAt 01:05:20Z、sampleStale=false；`reconciliation=matched`、query <10s、无阻断。
- Claude：98.8/97.7 A；22 账号、20 可调度。
- Grok：84.3/88.2 B；11 账号、7 可调度。
- DeepSeek：100/99.6 A；13 账号、3 可调度。
- 账号 487：00:32、00:42、00:52 自动轮次均为 noop、priority 300；01:02:48 由 300 调整为 211（score 94.9、failure_rate 2.1%）；01:12:49 保持 211/noop（score 95.0、failureRate 2.09%）。失败期间已在最低优先级，00:32 后无新增失败。
- 账号 62：score 86.6 B、priority 247、failureRate 1.09%，较 r76 的 94.0 A/268 下降。
- 账号 1549：score 82.2 B、priority 289、effectiveFailureRate 5%；本窗 4 条错误均已恢复。
- 账号 1597：score 96.6 A、priority 174；01:08Z 自动 model-sync 成功，模型数 5→7（changed 2）；`gpt-6.2-astra` 是否恢复待下一轮真实请求。

## OpenCode Go 与 CommandCode
- OpenCode Go：21 账号；11 个三窗口可观测、10 个 unknown（`Sub2API /v1/usage HTTP 403`，账号 1563/1564/1570/1571/1573/1574/1575/1576/1577/1578，均 active 但 schedulable=false）。
- 5 小时：11 observed / 10 unknown，low 0；周：11 observed / 10 unknown，low 2（1589 1%、1595 0%，11-23 00:00Z 重置）；月：11 observed / 10 unknown，low 10（1552/1555/1558/1559/1560/1561/1562/1589 为 0%，1588 20%、1595 1%）。
- 主要有效额度：1588 月 20%/周 40%/5h 67%（12-12 07:33Z）；1592 月 46%/周 92%/5h 100%（12-13 14:01Z）。1588 月度较 r76 的 27% 继续下降。
- 封禁证据边界：本窗无真实用户 403/Workspace access denied；10 个不可调度账号的 `/v1/usage` 403 仅为额度探测错误，不形成封禁候选。
- CommandCode：6 账号、5 可调度（1556 schedulable=false）；5 小时 6/6、周 6/6、月 0/6 unknown；1579/1580/1581 周剩余 21.474%/38.853%/38.627%，1583/1584 周额度 -0.008%/-0.01%，11-18 06:33Z/06:38Z 重置。
- CommandCode 五项：account_group 可用；quota_windows 5h/周可解析、月 unknown；model_protocol 兼容（78 请求、0 失败、P95 2.567s）；scheduler 无独立 command_code 作用域、未知；natural_traffic 满足。结论：可补充供给，尚未证明无缝替代。

## 探活成本
- `probe-costs --days 7`：63,538 请求、已知 63,529、缺 9、覆盖 99.9858%、已知成本 97.016259 元；缺因仅 `historical_provider_rate_missing=9`。
- 逐日：11-12 29.609694、11-13 44.462671、11-14 9.744757、11-15 3.844097、11-16 4.040339、11-17 4.017366（缺 1）、11-18 部分日截至 09:07 为 1.297335 元/2,033 次。
- 评估日 11-17：4.017366 元（估算 4.018072）；日预算 5 元、趋势阈值 27.67638 元、基线中位数 18.45092 元；`budget.status=within`。
- Top 账号：xixiapi.cc ccmax 1.2 13.62%、cf.sheapi.cc grok 12.13%、www.sheapi.cc ccmax 1.2 11.98%、banliapi.top ccmax 1.1 11.68%、rapidapi.cc ccmax 0.78 7.79%。
- Top 模型：claude-sonnet-5-5 64.79%、grok-4.5 17.40%、gpt-6.1-sol 11.48%、claude-opus-5 3.75%、deepseek-v4.1-flash 2.41%。
- Top 上游：www.sheapi.cc 24.97%、banliapi.top 15.65%、xixiapi.cc 14.27%、rapidapi.cc 7.92%、api.laoliimage2.win 7.92%。

## 成本与充值
- 168h：2026-11-11T01:07:23Z–2026-11-18T01:07:23Z；700,743 总记录、700,071 纳入、699,990 已知、缺 81、覆盖 99.9884%、已知成本 9,314.130739 元（下界）；61 个钱包；冲突 0。
- 预算口径：max(六个完整日均、完整日峰值、`recent24Hours`) × 1.25；recent24Hours 窗口 2026-11-17T01:07:23Z–2026-11-18T01:07:23Z（北京 11-17 09:07–11-18 09:07）。
- 强烈建议：api.mmcapi.cn 13.79/43.75/54.69→50；laaai.cc 30.52/35.98/44.98→50；sub.yjxm1221.top 53.96/28.67/92.77→50；www.sheapi.cc 37.43/4.83/47.87→50。
- 一般储备：banliapi.top 20.31/19.98/32.44→50；hyueapi.com 17.70/14.50/19.94→50；qianfan.baidubce.com 余额未知/8.64/272.18→待核实。
- qianfan 余额来源 unknown，预算按历史峰值 217.74×1.25 估算；未列 0、未实际充值。

## 消耗停滞
- 扫描 166：healthy 10、consumption-stalled 17、watch 124、demand-insufficient 13、excluded 2、alerts 14。
- 强触发仅供关注、不是告警或事故：
  - ai.hththt.top/openai 1528（49.86 USD，fresh，需求 2,133，0/0）。
  - ai1.c0c.cc/openai 1591（24.86 USD，fresh，需求 2,133，0/0）。
  - aishenji.top/openai 369（12.69 USD，fresh，需求 1,047，当前 0 条，上一窗 116 条/5.922 USD）。
  - api.xingqiaolab.top/openai 1498/1499（24.02 USD，fresh，需求 2,134，0/0）。
  - laaai.cc/openai 1535（30.52 USD，fresh，需求 2,134，0/0）。
- Watch 124 主要为余额陈旧、不可调度或非正余额；excluded 2 为无兼容需求或探活噪声；未修改供给、未伪造 resolved。

## QQ、语音与其他
- `messages sources`：qq-main available、refresh applied、index ready；last_sync 01:09:15Z、outcome=unchanged、messages_added=0。
- QQ 当前窗口三路检索 0 匹配；缺口窗口 05:06–07:06 三路检索 0 匹配；coverage complete、degraded=false。结论：本窗口无新增可核验候选。
- `gateway service-policy` 预览：changedCount=0、denyAudio=true，无漂移。
- Codex Auto Review：`reads query` 本窗 0 行。

## 本轮动作
- 新建 #7548：账号 487 两小时 13 条客户可见失败（12×502 + 1×429），响应已写出。
- 新建 #7549：gpt-6.2-astra 在账号 1597 连续 503 `model_not_found`，无可用候选。
- #6561 追加缺口窗口 1534 提交前 502：comment `6965913977`。
- #7507 追加账号 62 本窗 1 条提交后 502：comment `6965913997`。
- #7548 追加窗口后 10 分钟复核：comment `6966016741`。
- 窗口后 10 分钟（01:06:06Z–01:16:06Z）：413 请求、0 失败、P95 11.813s；账号 62/487 未再复发。
- 07:06 轮次缺失：TaskTree 与邮件均无记录；本轮已回补 05:06–07:06 错误与 QQ 检索。属自动任务调度缺口，非 Api2Business 代码/CLI 缺陷；若连续缺失再报平台侧核查。
- 本轮无新增代码/CLI 改动；上一轮 observability 文档改进仍有效，本轮沿用 `errors aggregate` 全窗覆盖入口。
- 未修改 Sub2API 源码、模板、路由、账号、优先级或额度；未暂停账号、未充值、未改账务。
- 定期报告：job `email_16e2f85c82194d8b827a6e11880fc066`，Message-ID `<179496462248.1998873.6056820951539352720@qq.com>`，`receiveVerified=true`，`smtpReplyCode=250`。

## 未完成与下一步
- 账号 487：失败集中在 07:21–08:32，之后未复发；当前 priority 211、failureRate 2.09%，继续观察自动轮次；若持续，按上游供给质量处理，不手动改路由。
- 账号 62：低频提交后 502，score 86.6 B，继续观察 #7507。
- 账号 1597：`gpt-6.2-astra` 可用性待下一轮真实请求复核；model-sync 成功不等于恢复。
- OpenCode 1588 月度降至 20%，需核对能否撑到 11-23 周重置；CommandCode 1583/1584 周额度 06:33–06:38Z 重置后复核。
- 下一精确核查时间：北京时间 2026-11-18 11:06（UTC 03:06）。
