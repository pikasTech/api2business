# r73 两小时巡检结论（2026-11-17 21:06–23:06 北京时间）

## 总评
- Sub2API 任务口径已排除 Luna 4 条：6,564 请求、成功 6,547、失败 17，成功率 99.7410%，流式 TTFT P95 10.316 秒；有效 TTFT 6,434、缺失 0，两项达标。
- 原始含 Luna：6,568 请求、成功率 99.7410%、TTFT P95 10.315 秒；仅作对照，不用于任务总评。
- Api2Business：354 请求、0 失败、P95 1.433 秒，处于 owning 配置 3 秒目标内；该指标是管理面观测，不是业务成功率或 TTFT。
- 结论：总体 SLO 达标，但 17 条真实用户失败仍未闭合；未观察到平台级整体中断，不能写成全部正常。
- 完整报告：`https://api2business.hwpod.com/observability?report=0fa31ebb-f0ca-4510-862c-35ea101d132f`。

## 平台与错误证据
- platform：openai 1,552 请求、失败 14、P95 14.91 秒；deepseek 2,338、失败 2、P95 6.02 秒；command_code 1,522、失败 1、P95 5.05 秒；grok 211、0 失败、P95 37.45 秒；opencode_go 921、0 失败、P95 5.20 秒；anthropic 24、0 失败。
- errors aggregate：217 行、217 distinct；客户可见 215、恢复 2，`probeNoiseExcluded=true`；business_limit 198 为下游额度 429（user 39 / `juice@test.com`，API Key 81/701），已从任务失败中排除。
- 17 条真实任务失败：
  - 账号 1534（laaai.cc plus，gpt-6.1-sol）4 条提交前 502，`commit-stage complete=true`、`upstreamErrorResponseAlreadyWritten=false`、`failoverTriggered=false`、`attemptCount=1`。request IDs：`f4c77fa6-c1da-464b-b71d-fd9bd8e6ea57`、`99fb9f0e-730c-4319-945c-8d075324e505`、`39f30097-31b4-4996-a76b-b568cd87f64d`、`51f92f3c-c093-4798-b4cf-cfa635ff6b80`。
  - 账号 1496（flow-node.com plus，gpt-6.1-terra）8 条 502 与 1 条 429，均 `upstreamErrorResponseAlreadyWritten=true`；无提交前模板证据。
  - 账号 1554（opencode，deepseek-v4.1-flash）1 条 504 `commit-stage complete=false`，原因未知的残余错误。
  - 账号 1557、1580 各 1 条 502，均 `upstreamErrorResponseAlreadyWritten=true`；两请求 request ID 分别为 `18246f3f-f198-47d3-85ae-cc106db36a70`、`1b98c2b3-a704-4d7f-8cbc-2bc59ba4c7da`，不是同一请求。
- Grok 单平台 TTFT P95 37.45 秒：账号 516（Grok-hyueapi）151 样本、P95 38.5905 秒并承担约 58% 观测承流；账号 1538 P95 17.0214 秒、参与占比约 40.8%；1488 P95 4.987 秒但样本仅 5.8。三账号均 active/schedulable，516 分数 89.6、1538 94.3、1488 88.9、失败率均低；判断为个别上游延迟/供给质量观察，不据此手动改路由或暂停账号。
- 账号 1496、1534、1554、1557、1580 当前均 active、schedulable；1534 与 1496 余额分别约 54.57 / 48.24 USD，未暂停账号。
- `Codex Auto Review` 本轮无真实用户请求；只有 13:32:31Z 的探活目录 404（account null / routing / model_not_found），未新建 issue、未改 alias、未把探活错误当事故。

## 四作用域
- Codex：pool 94.1、rolling 90.7；15:09:04Z automatic applied，写入/完成/验证 12/12，score query 456.5ms，snapshot age 143s。
- Claude：pool 97.6、rolling 95.7；15:09:11Z applied，8/8/8，query 106.7ms，age 138s。
- Grok：pool 90.2、rolling 93.3；15:09:09Z applied，no-change，query 148.5ms，age 141s。
- DeepSeek：pool 99.3、rolling 99.4；15:09:10Z applied，no-change，query 644.2ms，age 163s。
- 四作用域 V2 reconciliation 均 matched，`planWrite=false`、`priorityAutomation=true`、`upstreamWrite=false`，无 automation_blocked_reasons 或 score_error。

## 额度与供给
- OpenCode：21 账号、11 有三窗口观测、10 unknown（`Sub2API /v1/usage HTTP 403`）。5h low 0、周 low 2（1589 1%、1595 0%，11-23 00:00Z 重置）、月 low 9；仍有余量的主要观测账号为 1588（32%，12-12 07:33Z）与 1592（46%，12-13 14:01Z）。本窗 921 请求、0 失败，未形成账号级封禁候选。
- CommandCode：6 账号、5 可调度（1556 不可调度）；5h 6/6、周 6/6、月 0/6 unknown；1583/1584 周额度约 -0.008% / -0.01%，11-18 06:33–06:38Z 重置。组 193 可用，DeepSeek Flash 真实流量 2h 1,522/1 失败、P95 5.05 秒；独立 10 分钟窗 128 请求、0 失败、P95 4.465 秒。没有独立 command_code 作用域，结论“可补充供给，尚未证明无缝替代”。

## 探活成本
- 固定窗口 `--days 7 --end 2026-11-17T15:06:16Z`：101,264 请求、已知 101,125、缺 139、覆盖 99.8627%、已知成本 170.753642 元；缺因 provider_rate_missing 130、historical_provider_rate_missing 9。
- 11-11 至 11-17 日成本：75.182357、29.609694、44.462671、9.744757、3.844097、4.040339、3.869727（今日部分日）。
- 11-16 评估日 4.040339 元；日预算 5 元、趋势阈值 27.768593 元、七日基线中位数 18.512395 元；`budget.status=within`。
- Top 平台 anthropic 71.30%、grok 17.36%、openai 9.09%；Top 账号 xixiapi.cc ccmax 1.2 14.13%、cf.sheapi.cc grok 13.27%、www.sheapi.cc ccmax 1.2 12.12%；Top 模型 claude-sonnet-5-5 67.97%、grok-4.5 17.36%、gpt-6.1-sol 9.08%。

## 成本与充值
- 168h：窗口 2026-11-10T15:07:05Z–2026-11-17T15:07:05Z；718,039 条总记录、717,367 纳入、717,285 已知、缺 82、覆盖 99.9886%、已知成本 9,468.06486 元（下界）。
- 强建议：sub.yjxm1221.top 余额 66.48457705、24h 23.02807678、预算 92.77027165、建议 50；api.mmcapi.cn 31.73096499、36.39310057、46.22790687、50；www.sheapi.cc 38.174668、30.55403208、47.86695531、50。
- 一般储备：sub2.xingqiao.cc 15.20803612、5.80462749、16.02817155、50；aishenji.top 15.28018542、1.15960142、15.33307489、50；qianfan.baidubce.com 余额未知、24h 8.64257733、预算 272.17795826（按完整日峰值 217.74236661 加 25%），金额待核实。

## 消耗停滞
- 扫描 166：healthy 7、consumption-stalled 19、watch 125、demand-insufficient 13、excluded 2、alerts 13。
- 强触发示例：sub2.xingqiao.cc/openai 1493（余额 15.208 USD、需求 795/336、0/0）；api.xingqiaolab.top 1498/1499（24.058 USD、1,534/972、0/14.1588618）；ai1.c0c.cc 1590/1591（26.729 USD、669/333、0/0）。
- 13 条告警涉及账号均 active、schedulable，组和容量存在；低优先级与实际承流仍待自然流量核对。该提示仅供关注，不是告警或事故。

## QQ 与语音
- `messages sources`：qq-main、wechat-main 均 completed、refresh_state complete、无 degraded source。
- QQ 三路检索：关键词（上游/API/额度/余额/充值/试用/Key/供应商/模型）、重点群、全部私聊；窗口 21:06:16–23:06:16，均 completed、coverage_degraded=false、matched 0。
- `gateway service-policy` 预览：changedCount=0、denyAudio=true，无漂移。

## 本轮动作
- 向 #6561 追加 r73 提交前 502 证据：comment 6952143874，`https://github.com/pikasTech/unidesk/issues/6561#issuecomment-6952143874`。
- 未修改 Sub2API 源码、模板、路由、账号、优先级或额度；未暂停任何账号。
- 未发现需当轮修复的 CLI/工具摩擦；使用 `errors commit-stage` 与批量 `upstreams usage` 完成取证，无新增工具改动。
- 定期报告已发送：job `email_4a4a163505104cc7a7513dfde9a71de1`，status=succeeded，smtpSent=true，sentVerified=true，receiveVerified=true，mimeVerified=true；Message-ID `<179492868702.1748980.5265172793897324393@qq.com>`。

## 未完成与下一步
- 1534 的提交前 502 未切号继续由 #6561 跟踪；1496 的已写出 502/429、1554 的无提交证据 504、1557/1580 的已写出 502 分别保留为残余错误，不扩模板。
- OpenCode 月度供给集中与 10 个 unknown、CommandCode 月窗口 unknown 继续观察；不购买、不充值、不新增外部凭据。
- `Codex Auto Review` 原映射/供给问题按 #6368 保留；本轮 0 真实请求不代表恢复。
- 下一精确核查时间：北京时间 2026-11-18 01:06；续接常驻 TaskTree 与 #6561/#6368。
