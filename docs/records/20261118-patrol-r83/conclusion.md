# r83 两小时巡检记录（北京时间 2026-11-18 19:06–21:06）

## 窗口与总评

- 冻结窗口：2026-11-18T11:06:03Z–13:06:03Z（19:06:03–21:06:03 CST）。
- Sub2API（排除 Luna）：7,915 请求，成功 7,892，失败 23，成功率 99.709%；TTFT 有效 7,815、缺失 0，P95 6,200.3ms；两项 SLO 达标。
- 原始含 Luna：7,931 请求，P95 6,200.5ms；排除 16 条 Luna，仅并列保存，不作任务总评。
- Api2Business：309 请求，0 失败，P95 1,415.5ms，非 5xx 100%，覆盖 7,200/7,200 秒。
- 失败分族：gateway_unavailable 18、business_limit 5；其中 5 条 business_limit 为下游 API Key 额度耗尽 429 一类，已排除服务质量。

## 关键更正（发信后）

- 账号 1524 `https://api.laoliimage2.win cc-kiro 0.35` 在 20:29:00 CST 对 `kiro-opus-5-5` 返回客户可见 403，上游正文 `{"code":"GROUP_DELETED","message":"API Key 所属分组已删除"}`，请求 `dbef3a14-afa1-477c-8d32-499218f9c057`。
- 提交阶段为响应写出前；`gateway.failover_same_account_retry` 后 `gateway.select_account_no_available`，未成功切号。1524 专用探活 18/18 失败、评分 E/24.3。
- 该错误被 `is_business_limited` 归为 `business_limit`，首封报告因此把它当下游 429 排除，未进入“发现的问题”；已发补充报告更正。
- 已新建 #7687 记录分类缺陷；供给缺口续接 #6119。未暂停 1524，因为它是当前该模型唯一映射候选。

## 已执行修复

- `src/error-aggregate-database.ts`：有账号、`error_phase=routing`、`upstream_status_code in (401,403)` 时优先归 `upstream_permission`，不再落入 `business_limit`。
- `src/error-aggregate-database.test.ts` 增加断言；`bun test src/error-aggregate-database.test.ts` 2/2、`bun run check`、`bun run deploy:validate` 通过。
- 受控 `native start --component api` 部署；健康端点 `{"ok":true,"service":"api2business-api","readiness":"data-plane"}`；`deploy:verify` 全项通过。
- 线上回读 1524 同一请求 family 已从 `business_limit` 变为 `upstream_permission`。
- 未改 Sub2API 原始 `is_business_limited`、SLO 分母、账号评分公式或路由算法。

## 真实用户失败

- 525 `https://www.sheapi.cc plus 0.08`：14 条客户可见 502/503（8 条 gpt-6.1-sol 502、6 条 gpt-5.6-terra 503），20:34:50–20:44:25 CST；20:44 后至 21:20 无新增；#7685。
- 1557 `command code`：2 条 `deepseek-v4.1-flash` 504；提交阶段证据缺失，不强制重放；#7644。
- 1554 `opencode`（deepseek 平台）：1 条 502 `openai.forward_failed`；1592 `user013@api2business.com`（opencode_go）：1 条 502；均为单账号供给失败。
- 1513 `gpt-6.2-sol`：1 条 `upstream_key_pool_send_state_unknown_no_replay`，`customerVisible=false`、已恢复；#7664 未见跨窗持续。
- 525 发信后复核：最后失败仍为 20:44:25 CST；525 active/schedulable、priority 300 最低；组 2 共 79 账号，评分前 6 名均 ≥97.8，525 在有评分账号中排 28/50；未人工暂停、未人工 priority-run。

## 四作用域

- 全部 `complete=true`、`ready`、`reconciliation matched`、section 全 fresh。
- Codex：最新自动 12:59:51Z applied no-change，query 278.6ms；池分 93.9 A、TTFT 6,691ms。
- Claude：12:57:45Z applied no-change，134.7ms；96.5 A、TTFT 7,406ms；最老可调度样本 28 分钟（阈值内）。
- Grok：12:57:22Z applied 写 2 验 2，201.8ms；94.4 A、TTFT 16,879ms。
- DeepSeek：12:57:40Z applied no-change，611.7ms；99.8 A、TTFT 5,491ms。
- 部署后复核：scores rank refreshedAt 13:26:27Z、query 1,491.6ms；四作用域 cache.complete=true，DeepSeek 快照 13:03Z（23 分钟，阈值内）。

## 探活成本

- 近七日 66,468 次、已知 98.6958 元、覆盖率 99.9579%、缺失 28 条（历史供应商倍率缺失）。
- 评估日 11-17 估算 4.0103 元；`budget.status=within`，未超日预算 5 元与趋势阈值 27.6702 元；基准中位数 18.4468 元。
- 今日部分日截至 21:06 已知 3.0586 元。
- Top 模型 claude-sonnet-5-5 64.40%、grok-4.5 17.49%、gpt-6.1-sol 11.66%；Top 账号 1503 13.58%、1488 12.09%、1500 11.93%；Top 上游 sheapi 24.88%、banliapi 15.64%、xixiapi 14.25%。

## 余额与消耗停滞

- 扫描 169 个账号：healthy 4、consumption-stalled 27、watch 112、demand-insufficient 24、excluded 2。
- 钱包级 alerts 18 条，全部 warning、无 critical；逐账号强信号 27 条；均仅巡检提示，不是告警或事故。
- 钱包 61 个：31 fresh、20 stale（供应商接口读取失败且零消耗）、10 unknown、冲突 0。
- 典型强信号：478/479 rapidapi.cc、308 hyueapi.com、1535 laaai.cc、1514 api.laoliimage2.win、524 www.sheapi.cc、1528/1529 ai.hththt.top、62 sub.yjxm1221.top。

## 额度与供给

- OpenCode Go：23 账号、13 成功、10 个 `/v1/usage` 403 unknown；5h 无低额度；weekly 1588=5%、1589=1%、1595=0%；monthly 8 个 0%，最早重置 11-30。
- CommandCode：6/6 成功、5 可调度；weekly 1579=0.93%、1580=18.2%、1581=17.9%；monthly 6/6 unknown。
- 五项：账号分组可用、额度部分可解析、模型协议兼容、无独立 `command_code` 作用域（unknown）、自然流量承流 → “可补充供给，尚未证明无缝替代”。
- 语音：`denyAudio=true`、221 组、`changedCount=0`；三条语音路径实测 403。

## 充值建议

- 24 小时窗口：北京时间 11-17 21:06 至 11-18 21:06；预算取完整日日均、完整日峰值、近 24 小时实测较高值再乘 1.25。
- 强烈：`banliapi.top` 50、`sub.yjxm1221.top` 50；一般：`qianfan.baidubce.com` 待核实、`sub2.xingqiao.cc` 50。
- 未充值、未购买账号、未改用户账务；`qianfan.baidubce.com` 余额接口未知，仍需立即核实。

## 待续接

- #6119：1524 上游 Key 分组恢复或补充新的 `kiro-opus-5-5` 映射账号。
- #7687：产品级是否把上游账户权限错误计入评分/切号触发的裁决。
- #7595：1527 haiku 自然流量复验；24h 回溯 2 条真实用户 502（12:42–12:45 CST），链为 1525→1527 后失败，05:13–05:30Z 1525/1548 已恢复 23 条成功。
- #7394：DeepSeek 前缀模型零成本定价入口仍缺。
- QQ 归档 `archive_updated_at=2026-11-17T02:33Z`，约 35 小时未更新；最近同步 13:21Z `unchanged`，本窗无新增可核验候选。
- OpenCode/CommandCode monthly unknown；525 跨窗失败率；1557 504 复发。
