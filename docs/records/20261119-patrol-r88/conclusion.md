# r88 巡检结论（北京时间 2026-11-19 05:05–07:05）

- 窗口：`2026-11-18T21:05:57Z`–`2026-11-18T23:05:57Z`，7200 秒。
- Sub2API（排除 Luna，样本 0）：2,645 请求 / 0 失败 / 100%，TTFT P95 4,784.5ms。
- Api2Business：332 请求 / 0 失败 / P95 876.1ms，覆盖 7,200/7,200 秒。
- 218 条 429 全为下游 API Key 额度耗尽，已排除。
- 四作用域：Codex 99.3 A、Claude 98.3 A、Grok 95.8 A、DeepSeek 100 A；均 ready/complete/applied。
- 探活成本 `within`：评估日 3.5308 元，七日中位数 13.0165 元。
- 消耗停滞：169 账号，stalled 36、watch 114、demand-insufficient 14、excluded 2、强触发 23（仅供关注）。
- 成本：9,185.7474 元，61 钱包，31 fresh / 20 stale / 10 unknown，冲突 0。
- 1514：仅探活 Key 470 的 7 条请求，自然用户 0，无错误，模板无漂移，待自然承流复核。
- OpenCode Go：13 可探测 / 10 停调度；月额度 11 低（7 个 0%）。
- CommandCode：6 账号 / 5 可调度；月额度 6 unknown；可补充供给，尚未证明无缝替代。
- QQ：本窗 0 消息，无新增可核验候选。
- 工具改进：`scores rank --scope` 由静默忽略改为显式拒绝，补单测并通过 typecheck/deploy:validate。
- 邮件：`email_af98967374ce42d5a039b057aac16abc`，`receiveVerified=true`，Message-ID `<179504356560.2550902.13035648603555246182@qq.com>`。
- 完整报告：https://github.com/pikasTech/unidesk/issues/7774
- 1514 工单：https://github.com/pikasTech/api2business/issues/3#issuecomment-6994386628
