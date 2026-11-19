# r81 两小时巡检记录（北京时间 2026-11-18 15:06–17:06）

## 窗口与总评

- 冻结窗口：2026-11-18T07:06:06Z–09:06:06Z（15:06:06–17:06:06 CST）。
- Sub2API（排除 Luna）：11,423 请求，成功 11,411，失败 12，成功率 99.895%；TTFT 有效 11,317、缺失 0，P95 7,173ms；两项 SLO 达标。
- 原始含 Luna：11,453 请求，P95 7,161ms；排除 30 条 Luna，仅并列保存，不作任务总评。
- Api2Business：320 请求，0 失败，P95 1,501ms，非 5xx 100%，覆盖 7,200/7,200 秒。
- 12 条失败分族：business_limit 7（下游用户 39 Key 额度耗尽 429）、unknown 4（426 WebSocket）、gateway_unavailable 1（gpt-6.2-sol 502，账号 1547）。

## 关键更正

- r81 报告中“1 条内部 command code→sub 管理员 503”不是任务口径的第 12 条终态失败。
- 第 12 条是 `7af46495-5e87-4e39-a5fb-ef1c80932b3c`：16:04:52 CST，gpt-6.2-sol，账号 1547 mmcapi-gpt，502 `Upstream request failed`，`upstreamErrorResponseAlreadyWritten=true`，客户可见、未恢复。
- `530df451-c018-4b8c-87bc-6fcb439aa370`（17:00:19 CST，command_code 路由 503）按报告平台口径 command_code 0 失败，属中间尝试，不计终态失败。

## 窗口外即时新增

- 17:20:52 CST：`9a3334a0-294d-40a2-948c-c1ed8c8d28fa`，claude-opus-5-5，账号 1510 banliapi ccmax，HTTP 400 `Invalid signature in thinking block`；单次、未切号、客户可见 phu***；24 小时内同模型仅此 1 条。已登记 #7641。

## 四作用域

- Codex：池分 93.2 / 滚动 94.3；09:17 自然轮次 applied 13/13，评分查询 385ms，快照 complete。
- Claude：95.8 / 97.5；applied 16/16，查询 114ms。
- Grok：92.8 / 85.5；applied 0/0（no-change），查询 261ms。
- DeepSeek：100 / 99.7；applied 0/0（no-change），查询 754ms。
- 修复后待 09:27Z 自然轮次复核（部署 09:19Z 完成）。

## 探活与成本

- 探活今日部分日 2.46 CNY / 3,907 次（截至 17:07），覆盖率 99.51%；评估日 11-17 为 4.017 CNY，status=within，未超阈值。
- 近七日 98.18 CNY / 65,412 次，6 完整日 + 1 部分日，覆盖率 99.957%，28 条缺历史倍率；中位数 18.45，趋势阈值 27.68。
- 168h 成本：698,216 条已知记录、46 缺失、覆盖率 99.9934%、已知 9,410.14 CNY（下界）。
- 钱包 61 个：31 fresh / 20 stale / 10 unknown，0 conflicts。

## 停滞扫描

- 169 账号：healthy 9、stalled 28、watch 121、demand-insufficient 9、excluded 2、强触发 21。
- 21 个强触发均为低需求/严格优先级集中导致，账号 active+schedulable、样本新鲜、无零优先级/冷却；按“仅供关注”记录，不是告警或事故。

## 工具改进（本轮已实际使用）

- `accounts idle-probe coverage` 新增 `businessSampleCount`/`businessLatestAt`/`trafficSampled` 与 `actionableMissingAccountIds`；严格 `ok` 语义不变。
- Codex 覆盖 50/52，缺 1496（78 条业务样本）与 1547（343 条业务样本），均为 `trafficSampled=true`，`actionableMissingCount=0`，排除“探活绑定缺口”误判。
- 测试 24 通过、tsc 0、deploy:validate ok、api 组件受控重建、deploy:verify 0 failure。

## 额度与供给

- OpenCode Go：23 账号，13 可读 / 10 个 `/v1/usage` 403 unknown；5h 无低值；weekly 低 3（1588=7%、1589=1%、1595=0%）；monthly 低 11（7 个为 0）。任务口径 2,506 请求 0 失败。
- CommandCode：6 账号 5 可调度；5h 最低 89.4%，weekly 1579=1.064%，monthly 6 unknown；2,788 请求 0 失败、P95 5.24s；无独立 `command_code` 作用域，结论“可补充供给，尚未证明无缝替代”。
- 无用户级 OpenCode 403 封禁证据；管理接口 403 只作覆盖未知。

## QQ 与语音

- QQ 群/私聊两路 0 匹配，coverage complete、未降级；本窗口无新增可核验上游候选。
- `gateway service-policy` changedCount=0、denyAudio=true、groupCount=221。

## 充值建议

- 强烈建议：sub.yjxm1221.top 余额 49.63，24h 实测 18.04，预算 92.77，缺口 43.14 → 50。
- 一般储备：sub2.xingqiao.cc 余额 12.73，24h 实测 2.46，预算 16.03，缺口 3.30 → 50；qianfan.baidubce.com 余额未知、24h 实测 55.13、预算 272.18 → 待核实。
- 24h 窗口 2026-11-17 17:07–2026-11-18 17:07 CST；预算取 7 日均、完整日峰值、最近 24h 三者较高值 ×1.25。

## 未完成与下一轮

- 09:27Z 后复核四作用域自然轮次在 api 重启后继续推进。
- #7641 thinking 签名 400 观察频率；#7564 thinking 映射待产品决策；#7595 1527 haiku 自然流量仍缺；#7394 定价入口仍缺；#6561 426 WebSocket 透传待入口复验。
- 下一轮窗口 17:06–19:06 CST（09:06–11:06Z）。
