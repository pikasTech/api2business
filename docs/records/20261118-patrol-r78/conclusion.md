# r78 两小时巡检完整结论

- 触发时间：北京时间 2026-11-18 11:15:43（UTC 2026-11-18T03:15:43Z）。
- 冻结窗口：北京时间 2026-11-18 09:06:06–11:06:06（UTC 2026-11-18T01:06:06Z–03:06:06Z）。
- 任务口径：排除 Luna 61 条请求；探活、健康检查、额度探测和管理接口错误只作巡检证据。
- 常驻 Task：`tt_fc0f9529-7eee-4529-be8f-271126685788`（进行中，99%）。
- 报告 job：`email_25099432d1774c048f15cb7f7f976156`；Message-ID `<179497337583.2058367.17793462304784516316@qq.com>`；`receiveVerified=true`。
- 更正 job：`email_0cdf7925282a45d39d2315f19db16ea1`；Message-ID `<179497362306.2060204.15132539477523110367@qq.com>`；`receiveVerified=true`；`inReplyTo` 原报告 Message-ID。

## 1. 总体指标

### Sub2API 任务口径

- 请求 5,057；成功 5,037；失败 20；成功率 99.6045%（目标 >95%，达标）。
- TTFT 有效 4,848；缺失 0；P95 19,993.55ms（目标 ≤30,000ms，达标）。
- 原始含 Luna 口径：请求 5,118；成功 5,095；失败 23；成功率 99.5506%；P95 19,889ms。

### Api2Business

- 请求 335；失败 0；P95 1,069.69ms；非 5xx 100%；覆盖完整。

### 分平台（含 Luna 原始口径，仅作背景）

- DeepSeek：1,172 请求、0 失败、P95 4,919.8ms。
- CommandCode：398 请求、0 失败、P95 4,486.3ms。
- OpenCode Go：823 请求、5 失败、P95 5,397.45ms。
- OpenAI：2,667 请求、8 失败、P95 28,878.75ms。
- Anthropic：35 请求、0 失败、P95 6,212.5ms。
- Grok：13 请求、0 失败、TTFT 无样本。
- unknown：10 请求、10 失败（组 191 路由 429）。

## 2. 窗口后 10 分钟事故

### 11:06–11:16（UTC 03:06–03:16）

- 602 任务口径请求、582 成功、20 失败，成功率 96.68%（仍 >95%）。
- TTFT P95 32,065.5ms，短窗 SLO 未达标。
- 20 条客户可见失败：
  - 13× `claude-haiku-4.5` 503 routing，正文 `gateway.select_account_no_available`。
  - 1× `claude-haiku-4.5` 502 upstream，账号 1525，正文 `Upstream request failed`。
  - 4× `gpt-6-sol` 502 request，正文 `openai.user_slot_acquire_failed`。
  - 2× `claude-sonnet-5-5-thinking` 404 routing model_not_found。
- TTFT 主要贡献：1534 `gpt-6.1-sol` 21 样本 P95 55,732ms；1535 `gpt-6-sol` 25 样本 P95 53,157ms；1535 `gpt-6.1-sol` 40 样本 P95 52,022ms。

### 11:13–11:23（UTC 03:13–03:23）

- 913 请求、905 成功、8 条非下游真实失败，成功率 99.12%。
- TTFT P95 18,909.1ms，已恢复达标。
- 剩余真实失败：3× haiku 503、1× haiku 502 账号 1525、2× sonnet-5-5-thinking 404、2× haiku dated thinking 404。
- 6 条 `API_KEY_QUOTA_EXHAUSTED` 为下游 Key 额度不足，已排除，不计上游质量。

## 3. Claude Kiro 组 161 根因与修复

- 组 161 仅两个账号：1525（score 49.6 E、failureRate 45.16%、priority 195）与 1548（score 93.8 A、failureRate 0、priority 121）。
- 修复前 1548 的 `model_mapping` 只有 `claude-haiku-4-5`，缺少请求模型 `claude-haiku-4.5`；1525 同时有两者。
- 请求 `57babf8e-b5c0-4c6a-af5d-0272a19d9554`：账号 1525、`claude-haiku-4.5`、502 upstream、attemptCount=1、failoverObserved=false。
- 请求 `2adf7fc9-98c3-49a8-97f7-99b240497079`：无账号、503 routing、gateway.select_account_no_available。
- 组 161 `model_allowlist` 包含 `claude-haiku-4.5`、`claude-haiku-4-5-20251001-thinking`、`claude-sonnet-5-5-thinking`，问题在账号侧映射/兼容候选，不在允许列表。

### 已执行修复

```bash
bun skills/api2business/scripts/api2business-cli.ts upstreams model-alias \
  --id 1548 \
  --model claude-haiku-4.5 \
  --upstream-model claude-haiku-4-5 \
  --confirm \
  --over-api https://api2business.hwpod.com
```

- 回执：`persisted=true`、`mappingKeyCount=14`、`writeMode=native-bulk-merge`。
- 回滚：删除 `claude-haiku-4.5` 键。
- 回读：1548 同时存在 `claude-haiku-4.5` 与 `claude-haiku-4-5`；账号 active、schedulable、组 161/187、priority 121。

### 修复后 10 分钟复验（03:30–03:40Z）

- 1,608 请求、1,605 成功、3 失败，成功率 99.81%；TTFT P95 9,161.45ms。
- `claude-haiku-4.5` 错误链 0 条。
- 1548 承接 11 条 `claude-haiku-4.5` 请求，上游模型 `claude-haiku-4-5`；last_at 03:34:18Z。
- 结论：haiku 别名修复已验证；thinking 变体仍是未知映射缺口。

## 4. gpt-6-sol 用户槽位与短窗 TTFT

- 4 条 `gpt-6-sol` 502：`e9a3a5b4-9c23-488f-8823-50e5cff0e7e2`、`05134585-cf19-4380-beaa-56f50a515b22`、`f454697f-3f08-477d-bd64-f935a89a6f35`、`3d3ac1f7-2c04-4a7c-9d5d-f11b9e32fdbc`。
- 四条均为用户 `ric***`、API Key `T1`、组 132「【24H稳定】GPT 保不降智」、phase=request、502、正文 `openai.user_slot_acquire_failed`；无账号、无切号。
- 归因边界：发生在账号选择之前的用户槽位/并发获取失败，不是上游账号失败；当前没有证据支持暂停账号或改路由算法。
- 1534/1535 为 D 级慢账号（66.7/65.3，TTFT P95 约 50–52s），短窗 TTFT 尖峰主要来自它们；调度评分已反映慢速，本轮未手工暂停。
- 修复后 10 分钟未再出现 `user_slot_acquire_failed`。

## 5. 主窗口其余真实失败

- 5 条 `gpt-6.1-sol` 响应已写出后失败：
  - 524：`d653a0cd-4524-4fee-9892-deddc28f7c0d`、`7e9feebb-be53-4372-8e66-60ee7ae61ede`，均为 502。
  - 487：`c98697d0-0f7f-4841-b81a-3f47462c1081`，502 `openai.forward_failed`。
  - 62：`eed1cc23-d19c-4298-8409-5a1531bc9c19`，502 internal `openai.forward_failed`。
  - 1590：`96d0c0b0-9154-4169-b14c-59c39f044e89`，429 `Upstream rate limit exceeded`。
- 4 条 426 WebSocket：
  - `256cdea1-83de-4af0-ac69-0446e042b3ae`、`fd1acda4-ff42-464f-8ce6-22d228218f5c`、`d0bb8165-5780-4fd8-b13e-f338a96f6c84`、`6db20652-57fe-4e95-8fea-7eba5d7f5c51`。
  - `phase=request`、正文 `WebSocket upgrade required (Upgrade: websocket)`；属请求侧兼容问题。
- 4 条 OpenCode Go 配额 429：
  - `586af8e1-8c29-49f9-9925-256298ec628e`：11 次尝试，最后账号 1562 monthly。
  - `2324d4b7-f46c-4356-898a-ae777716ae0a`：9 次尝试，最后账号 1562 monthly。
  - `ae950ead-c665-41eb-9132-5c815ae74ba6`：9 次尝试，最后账号 1589 monthly。
  - `19b05c6f-2a5e-4000-bd16-d8a76f331e79`：4 次尝试，最后账号 1588 5-hour。
- 6 条组 191 路由 429：
  - `ddf2041d-c2b5-4210-92b0-a1d27b2f17b6`、`344308f0-5ae3-4d3f-9916-28f4a89d42b9`、`99a5aaeb-b5c4-4701-abbe-337c0cc6306b`、`ce1cc4fd-2855-487f-9756-bec3d5aaef99`、`2c3575cd-e847-42f5-aaff-19a8ec997a29`、`69defce6-6c5c-4a05-b1c9-615859156391`。
  - 均为 `deepseek-v4-pro`/`deepseek-v4.1-flash`/`DeepSeek-V4.1-Flash-1017`，正文 `openai.account_select_failed`，无账号。
- 1 条 OpenCode Go 账号 1588 流超时 502：
  - `15dc901c-bd55-46a2-ab2f-c8faaf4c8ab3`，`DeepSeek-V4.1-Flash-1017`，正文 `Upstream response stream timed out`。
  - `upstreamErrorResponseAlreadyWritten=false`，本可切号；`failoverObserved=false`，与 #6745 的 1588 无切号规则一致。
- 11 条下游 `403 INSUFFICIENT_BALANCE` 已排除，不降低上游评分，不列入问题或协助清单。

## 6. 四作用域调度

最新自动轮次均为 2026-11-18T03:13Z 自动 `applied`：

| 作用域 | 池分 | 滚动分 | changed/completed/verified | 查询耗时 | 快照年龄 | 阻断 |
| --- | --- | --- | --- | --- | --- | --- |
| Codex | 84.3 B | 94 | 9/9/9 | 328.2ms | 366s | 无 |
| Claude | 98.6 A | 97.9 | 0/0/0 | 85.6ms | 363s | 无 |
| Grok | 84.3 B | 87.1 | 1/1/1 | 129.1ms | 365s | 无 |
| DeepSeek | 100 A | 99.6 | 0/0/0 | 204.3ms | 366s | 无 |

- `scores rank`：`refreshedAt=03:19:51Z`、`queryDurationMs=900.3`、154 账号，低于 10 秒安全预算。
- `upstream-scheduling-v2 snapshot --scope codex` 当时 `status=refreshing`，但 `cache.complete=true`、无 failed sections；其余 scope ready。

## 7. OpenCode Go / CommandCode 额度

### OpenCode Go

- 21 账号；额度探测成功 11 个，10 个 `/v1/usage HTTP 403` 为 unknown、active 但不可调度，不构成封禁证据。
- 5 小时：11 observed / 10 unknown / 低额度 0。
- 周：11 observed / 10 unknown / 低额度 3。
- 月：11 observed / 10 unknown / 低额度 10。
- 主要可用供给：1592（5h 100%、周 51%、月 26%）；1588 临近耗尽（周 11%、月 6%）。
- 周/月耗尽账号：1589、1595、1552、1555、1558、1559、1560、1561、1562 等。
- 本窗无真实用户 `Workspace access denied`/`permission_error`；只有额度耗尽 429，不认定封禁。

### CommandCode

- 6 账号，5 可调度。
- 5 小时：6 observed / 0 unknown / 低额度 0。
- 周：6 observed / 0 unknown / 低额度 3：1579 19.38%、1583 -0.008%、1584 -0.01%。
- 月：0 observed / 6 unknown / 低额度 0；月窗口未知，不填 0。
- 真实流量：398 请求、0 失败、P95 4,486.3ms。
- 无独立 `command_code` 作用域；结论“可补充供给，尚未证明无缝替代”。

## 8. 探活成本

- 7 日合计：63,986 请求，已知 63,977，缺 9，覆盖率 99.9859%，已知成本 97.318061 元。
- 逐日：
  - 11-12：29.609694 元 / 14,133 次。
  - 11-13：44.462671 元 / 21,795 次。
  - 11-14：9.744757 元 / 8,063 次。
  - 11-15：3.844097 元 / 6,029 次。
  - 11-16：4.040339 元 / 5,790 次。
  - 11-17：4.017366 元 / 5,695 次。
  - 11-18 部分日截至 11:17：1.599137 元 / 2,481 次。
- 评估日 11-17：已知 4.017366、估算 4.018072、覆盖率 99.9824%；日预算 5 元；基线中位数 18.45092 元；趋势阈值 27.67638 元。
- `budget.status=within`，未超预算/趋势阈值。
- Top 账号：1503 13.62%、1488 12.13%、1500 11.97%、1510 11.67%、1509 7.77%。
- Top 模型：claude-sonnet-5-5 64.72%、grok-4.5 17.42%、gpt-6.1-sol 11.51%、claude-opus-5 3.73%。
- Top 上游：www.sheapi.cc 24.96%、banliapi.top 15.65%、xixiapi.cc 14.28%、rapidapi.cc 7.89%、api.laoliimage2.win 7.89%。
- 缺失仅 `historical_provider_rate_missing` 9 条；未知不填 0。

## 9. 成本与充值

- 168 小时窗口：2026-11-11T03:17:12.409Z–2026-11-18T03:17:12.409Z。
- 694,634 记录；纳入 693,962；已知 693,881；缺失 81；覆盖 99.9883%；已知成本 9,272.704140 元（下界）。
- 61 个钱包。

### 强烈建议充值

| 钱包 | 剩余额度 | 24小时实际消耗 | 预计24小时消费 | 建议充值额度 |
| --- | --- | --- | --- | --- |
| api.mmcapi.cn | 10.85 | 46.00 | 57.50 | 50 |
| sub.yjxm1221.top | 52.73 | 26.56 | 92.77 | 50 |
| laaai.cc | 22.28 | 39.58 | 49.47 | 50 |
| www.sheapi.cc | 34.53 | 5.25 | 47.87 | 50 |

### 一般储备充值

| 钱包 | 剩余额度 | 24小时实际消耗 | 预计24小时消费 | 建议充值额度 |
| --- | --- | --- | --- | --- |
| banliapi.top | 17.75 | 22.45 | 32.44 | 50 |
| hyueapi.com | 17.39 | 13.75 | 19.94 | 50 |
| qianfan.baidubce.com | 未知 | 38.26 | 272.18 | 待核实 |

- qianfan 余额 NewAPI 不可查，保持未知，建议立即核实并安排资金；不要求外部核验。
- `sub.api2business.com` 余额约 975,979 元、最近 24 小时约 1,025 元，缺口 0，不列入。
- `lumibest.cc` 缺口 0，不列入。
- 本轮未实际充值、未改账务、未购买账号。

## 10. 消耗停滞

- 扫描 166 账号：healthy 10、consumption-stalled 13、watch 128、demand-insufficient 13、excluded 2、alerts 12。
- 强触发示例：
  - sub2.xingqiao.cc / openai / 1493：余额 15.19 USD，当前/上一窗需求 1,446/1,047，真实消耗 0/0。
  - hyueapi.com / anthropic。
  - api.xingqiaolab.top / openai。
  - ai1.c0c.cc / openai。
  - lumibest.cc / openai。
  - banliapi.top / anthropic。
  - www.sheapi.cc / openai、anthropic、grok。
  - aishenji.top / openai。
  - xixiapi.cc / anthropic。
- 强触发仅供关注、不是告警或事故；未创建订阅、未伪造 resolved。

## 11. QQ、语音、工具

- QQ sources：qq-main `refresh=applied`、index ready；last_sync=03:17:10Z，unchanged，新增 0。
- 本窗三路检索 0 匹配：关键词、私聊、重点群；覆盖 complete、degraded=false。
- 结论：本窗口无新增可核验候选。
- `gateway service-policy`：changedCount=0、denyAudio=true、无漂移。
- Codex Auto Review：`reads query` 0 行。
- 本轮未发现需要修改工具/技能的摩擦；`errors aggregate` 的未来时间保护正常拒绝，不是缺陷。

## 12. Issue 与下一步

- 新建：
  - #7564：Claude Kiro 组 161 haiku 别名缺失与 thinking 映射缺口。
  - #7565：gpt-6-sol 组 132 用户槽位 502 与短窗 TTFT 超标。
- 续接：
  - #6745：1588 流超时 502 无切号规则。
  - #7549：1597 `gateway_queue_full` 429 后切号恢复，旧 503 未复现。
  - #6012：OpenCode Go 周/月额度 429。
  - #6561：4 条 426 WebSocket。
  - #6014：5 条 gpt-6.1-sol 已写出后失败。
  - #7548：487 1 条 502。
  - #7507：62 1 条 502。
  - #5819：524 2 条 502。
- 尚未闭合：
  - thinking 变体上游兼容与映射缺口。
  - gpt-6-sol 用户槽位是否复发。
  - 1534/1535 慢速供给与 D 级评分降权效果。
  - OpenCode Go 月额度供给与 CommandCode 替代五项证据。
  - 1588 无切号规则（#6745）。
- 下一精确核查：北京时间 2026-11-18 13:06（UTC 05:06）。

## 13. 证据文件

- 原始数据：`/root/api2business/.state/patrol-r78/`
- 报告 Markdown：`/root/api2business/.state/patrol-r78/email.md`
- 邮件回执：`/root/api2business/.state/patrol-r78/email-send.txt`、`email-wait.txt`
- 更正邮件：`/root/api2business/.state/patrol-r78/email-correction.md`、`email-correction-send.txt`、`email-correction-wait.txt`
- 1548 别名回执：`model-alias-1548.json`
- 1548 回读：`model-alias-1548-readback.json`
- 修复后 10 分钟：`after-fix-10m-report.json`、`after-fix-10m-errors.json`

## 14. 补充运行时证据

- 2026-11-18T03:44Z 左右只读 `reads runtime --group 132 --platform openai`：组 132 `current_in_use=1`、`max_capacity=306`、`waiting_in_queue=0`；20 个账号均未出现全局排队或容量耗尽。
- 因此 4 条 `openai.user_slot_acquire_failed` 更像用户级槽位/客户端突发并发，而不是组容量或上游账号故障；已追加到 #7565。
- 已向 #6119 追加组 161 映射缺口交叉引用：`kiro-opus-5-5` 与本轮 haiku 问题同属账号侧映射/供给缺口，不是允许列表问题。
- 请求级 broker 回读进一步确认：4 条 `gpt-6-sol` 502 均为 `user_id=4`、`api_key_id=436`、`group_id=132`，稳定正文为 `Concurrency limit exceeded for user, please retry later`；时间集中在 03:10:49–03:11:22，属用户级并发突发，组容量 306 未耗尽。
- 钱包新鲜度：61 个钱包中 31 fresh、20 stale、10 unknown；未发现 `conflictingBalances`。两张充值表只列 fresh 或明确 unknown 且存在资金需求的候选；其余 stale/unknown 钱包未发现正向缺口，未逐钱包展开。
