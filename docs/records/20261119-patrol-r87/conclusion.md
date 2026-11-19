# r87 两小时巡检结论

- 窗口：北京时间 2026-11-19 03:05:57–05:05:57。
- 常驻 Task：`tt_fc0f9529-7eee-4529-be8f-271126685788`。
- 完整报告：https://github.com/pikasTech/unidesk/issues/7768
- 1514 缺陷 Issue：https://github.com/pikasTech/api2business/issues/3
- 邮件：`email_aa31fc137d41467a8b63ae966b11ee92`，`receiveVerified=true`。

## 服务指标

- Sub2API 任务口径：3,505 请求 / 3,505 成功 / 0 失败 / 100%；TTFT P95 5,421.7ms；Luna 样本 0。
- Api2Business：341 请求 / 0 失败 / P95 1,000.8ms；覆盖 7,200/7,200 秒；non5xx 与延迟 SLO 均达标。
- 232 条 429 全部为下游 API Key 额度耗尽，已从业务 SLO 排除；本窗无 502/404/503、无流式中断。

## 1514 复核

- 本窗 1514 无客户可见错误；8 条 usage 全部来自专用探活 Key，其中 6 条在修复后成功。
- 自然用户请求为 0，模板修复仍未获自然承流验证，不能写成已恢复；Issue #3 保持 open。
- `scores rank` 中 10 次失败仍是 r86 旧样本；当前 active、schedulable、priority 300，主承流 1547 priority 100、约占 94.7%。

## 四作用域

- Codex 99.5 A、Claude 98.2 A、Grok 95.6 A、DeepSeek 100 A。
- 快照均 ready/complete/matched，修复后均产生自然自动轮次，无 blocked、score_error、recovery_action。

## 成本与供给

- 168 小时已知成本 9,218.2479 元，覆盖 99.9931%，缺失 46 条，61 个钱包。
- 24 小时全钱包已知成本 1,681.17 元；钱包 31 fresh、20 stale、10 unknown，冲突 0。
- 探活成本 `budget.status=within`；评估日 3.530808 元，七日中位数 13.0165115 元。
- 消耗停滞 169 账号：healthy 3、stalled 32、watch 108、demand-insufficient 24、excluded 2、强触发 18；仅巡检提示，不是告警或事故。
- OpenCode Go 13/23 有效、月 11 个低额度；CommandCode 6/6 探测成功、月额度全部 unknown，可补充供给但未证明无缝替代。
- QQ 私聊与重点群本窗无新增消息，无新增可核验上游候选。
- 本轮未发现需当轮修复的工具摩擦，未改代码、配置或模板。
