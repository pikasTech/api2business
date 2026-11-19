# r86 两小时巡检结论

- 窗口：北京时间 2026-11-19 01:06:08–03:06:08。
- 常驻 Task：`tt_fc0f9529-7eee-4529-be8f-271126685788`。
- 完整报告：https://github.com/pikasTech/unidesk/issues/7763
- 缺陷 Issue：https://github.com/pikasTech/api2business/issues/3
- 邮件：`email_591c42afabdb482291e8fccffa439e2c`，`receiveVerified=true`。

## 服务指标

- Sub2API 任务口径：11,174 请求 / 11,164 成功 / 10 失败 / 99.9105%；TTFT P95 5,069ms；Luna 样本 0。
- Api2Business：310 请求 / 0 失败 / P95 2,222.4ms；覆盖 7,195.066/7,200 秒；两项 SLO 为 `insufficient_data`。
- 修复后 10 分钟：Sub2API 380/0、P95 6,916.6ms；Api2Business 41/0、P95 1,544.5ms、覆盖完整、两项 SLO 达标。

## 主要问题与处置

- 账号 1514 对 `gpt-5.6-terra` 的 10 条真实用户请求失败，上游 404 正文为 `Model "gpt-5.6-terra" is not available for this group`；9 条客户端 502、1 条流式中断。
- 根因是上游 API-key 分组不提供该模型；`/v1/models` 仍列出，模型同步无法纠正。
- Codex 模板缺少 `not available for this group` 精确短语；已增加 404 规则，热加载成功，并向 84 个 OpenAI API-key 账号全量同步，应用 84、验证 84、失败 0、错位 0。
- broker 回读账号 1514 已含该规则；修复后 10 分钟无 1514 承流记录，也无 502；待下次自然选中复核。
- 1 条流式中断在响应已开始后发生，模板不能修复。

## 供给与成本

- 四作用域均 ready/complete/matched，无 blocked、score_error；修复后均产生自然自动轮次。
- OpenCode Go 13/23 有效，月额度 11 个低额度；CommandCode 6/6 探测成功，月额度全部 unknown，可补充供给但未证明无缝替代。
- 探活成本 `budget.status=within`；评估日估算 3.530808 元，七日中位数 13.0165115 元。
- 消耗停滞 169 账号：healthy 5、stalled 34、watch 114、demand-insufficient 14、excluded 2、强触发 20；仅巡检提示，不是告警或事故。
- 168 小时已知成本 9,278.64785 元，覆盖 99.9932%；主要承流钱包余额新鲜。
- QQ 私聊与重点群本窗无新增消息，无新增可核验上游候选。
