# r84 巡检结论文档

- 窗口：北京时间 2026-11-18 21:06:05–23:06:05
- 报告：https://github.com/pikasTech/unidesk/issues/7713
- 邮件：email_6148f85aa84644f5a76f967222866617，Message-ID `<179501508629.2351388.9948100944419837816@qq.com>`，receiveVerified=true

## 结论

- Sub2API 任务口径（排除 Luna）11,421 请求 / 24 失败 / 99.7899%，TTFT P95 6,380.6ms，两项 SLO 达标。
- Api2Business 359 请求 / 0 失败 / P95 2,020.4ms；覆盖 7,197.365 秒，SLO 状态 insufficient_data，不记为达标。
- 四作用域快照全部 complete、ready、matched；自动轮次时间前进，仅 Grok 发生实际写入（3 写 3 验）。
- 消耗停滞 31 强触发全部为可调度账号的选择性闲置，同平台流量未下降，非故障。

## 本轮修复

- `errors list` 探活噪声：新增 `probe` 判定与默认剔除，返回 `probeRowsExcluded`。
- 验证：`bun test src/error-detail-database.test.ts` 8/8、`bun run check`、`bun run deploy:validate`、受控部署镜像 `79da476c997d`、`deploy:verify` failures=[]。
- 线上复验：`probeRowsExcluded=31`，剩余 29 条客户可见（28 条下游额度 429、1 条 404）。

## 未完成/待续接

- 426 WebSocket 17 条：Sub2API 侧 Upgrade 透传与提交前切号问题，续接 Issue #6561。
- GPT 502 5 条：487/1534 internal `openai.forward_failed`、1496 已写出结构化输出错误，续接 Issue #6679/#5819。
- 1496 已写出后失败，不纳入切号模板优化范围。

## 部署后 10 分钟复验（15:16–15:26Z）

- Sub2API：1,008 请求 / 0 失败 / 100%，TTFT P95 5,760ms，两项 SLO 达标。
- Api2Business：29 请求 / 0 失败 / P95 1,752ms，覆盖 600/600 秒（complete=true，failedWrites=0），两项 SLO 达标。
- 部署后客户可见错误仅下游额度 429（103 条）与 1 条已恢复 404；无新增 502/426。
- 结论：error list 探活剔除修复未影响服务面，复验通过。

## 更正记录

- 首封报告把 sheapi 524/525/1500 本窗写成 0 条，实际 49 条（上窗 439 条，下降约 89%）。
- 已更正 Issue #7713 并发送更正邮件（email_e108487a2e28439686c273c637f4dcf8，receiveVerified=true）。
