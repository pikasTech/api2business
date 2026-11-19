# r85 巡检结论文档

- 窗口：北京时间 2026-11-18 23:06:43–2026-11-19 01:06:43
- 报告：https://github.com/pikasTech/unidesk/issues/7742
- 邮件：email_eb0f169a1c8d4373954c4862b580cf09，Message-ID `<179502212643.2401892.15210125896236591470@qq.com>`，receiveVerified=true

## 结论

- Sub2API（排除 Luna，本窗口无 Luna 流量）14,335 请求 / 8 失败 / 99.9442%，TTFT P95 5,431.75ms，两项 SLO 达标。
- Api2Business 325 请求 / 0 失败 / P95 2,007.97ms；覆盖 7,195.771 秒，SLO 记为 insufficient_data。
- 四作用域快照 complete、ready、matched，自动轮次均写 2–3 验同数，无阻断、无评分错误。
- 消耗停滞 31 强触发全部为可调度账号的选择性闲置，同平台流量未下降。

## 8 条 502

- 1557 ×4：提交后失败，`upstreamErrorResponseAlreadyWritten=true`，不可切号。
- 1581 ×2：提交前失败，1 条无切号、1 条切号后仍失败。
- 1584 ×2：`Upstream response stream was interrupted`，提交阶段未知。
- 均无稳定上游正文，不新增模板、不暂停账号；续接 #7644，并在 #6561 补提交前样本。

## 本轮修复

- `errors list` 新增 `--start/--end` 有界窗口：CLI/HTTP/服务层透传，SQL 在 selected_errors 内按时间过滤，校验 ISO 与 start<end。
- 验证：单测 9/9、`bun run check`、`bun run deploy:validate`、受控部署、`deploy:verify` failures=[]。
- 线上复验：窗口查询返回 239 条非探活错误（23:38–01:06），探活剔除 261 条。

## 部署后 10 分钟复验（17:16–17:26Z）

- Sub2API：816 请求 / 0 失败 / 100%，TTFT P95 5,393ms，两项 SLO 达标。
- Api2Business：24 请求 / 0 失败 / P95 2,170ms，覆盖 600/600 秒（complete=true，failedWrites=0）。
- 分平台失败均为 0：command_code 123、deepseek 328、openai 129、opencode_go 215、anthropic 20、grok 1。
- 结论：窗口查询改进未影响服务面，复验通过；DeepSeek 502 在本复验窗口未复发。
