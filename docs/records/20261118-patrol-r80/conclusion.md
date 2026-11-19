# r80 两小时巡检结论（北京时间 2026-11-18 13:06–15:06）

## 1. 窗口与任务

- 触发：北京时间 2026-11-18 15:06:09；窗口 13:06:06–15:06:06 CST（05:06:06–07:06:06Z）。
- 任务：tt_fc0f9529-7eee-4529-be8f-271126685788（常驻巡检）。
- 证据：`/root/api2business/.state/patrol-r80/`。

## 2. 任务口径 SLO（排除 Luna）

- 请求 9,255、成功 9,194、失败 61，成功率 99.3409%（>95% 达标）。
- TTFT 有效 9,101、缺失 0，P95 7,352ms（≤30s 达标）。
- 原始含 Luna：9,286 / 9,225 / 61，P95 7,357ms。
- Api2Business：627 请求、0 失败、P95 1,814ms、覆盖完整。

## 3. 平台

- anthropic 112 / 6 失败；command_code 2,826 / 0；deepseek 4,110 / 0；grok 159 / 0；openai 638 / 6；opencode_go 1,393 / 1；unknown 48 / 48（下游限额）。

## 4. 真实用户失败

- haiku 10 条（9×503 路由 + 1×502 账号 1525），全部 05:10:23–05:12:52Z，修复前；05:12:56Z 后 1h53m 无错误。
- thinking 404 9 条：opus-5-5-thinking 5、sonnet-5-5-thinking 2、haiku-5-5-thinking 2；路由 model_not_found，allowlist 与映射缺口。
- gpt-6.1-sol 6 条：524 流超时 4×502 + 1×429，525 客户端 400 1 条；commit-stage 显示已写出，不适用模板。
- DeepSeek-V4.1-Flash-1017 经 1588 内部 502 流超时 1 条；DeepSeek 平台 0 失败。
- 下游限额 429 456 条、用户 83 的 26 条 503 已排除。

## 5. 四作用域与调度

- 快照 07:05:37 ready、complete、0 失败段；池分 Codex 94.9、Claude 95.1、Grok 92.3、DeepSeek 98.8。
- 07:05 自然轮次：Codex 24/24（查询 420ms，总 10.59s 为 8 批写入）、Claude 2/2、Grok 1/1、DeepSeek 0/0；无阻断。
- 样本：Codex 52/80（最旧 06:31，1498 A 91.4 覆盖仍有效）、Claude 20/22、Grok 8/12、DeepSeek 3/13；快照年龄 0 秒。
- 探活：最新 codex 轮 planned/ready 10、成功 5、失败 5（1019/1018/1594/1593/61 上游 502/503），仅巡检证据。

## 6. 余额与供给

- 探活成本：今日部分日 2.16 元/3,393 次；7 日 97.88 元/64,898 次，覆盖 99.9569%，缺 28；评估日 4.02 元，`within`。
- 成本：168h 701,191 记录，纳入口径 700,519，已知 700,493，缺 26，覆盖 99.9963%，已知 9,409.84 元（下界）。
- 钱包：61 个，31 fresh / 20 stale / 10 unknown，0 冲突。
- 消耗停滞：167 扫描，healthy 5、stalled 7、watch 113、demand-insufficient 40、excluded 2、alerts 7。
- OpenCode Go：21 账号，11 可读、10 个 403 unknown；5h 低 0、周低 3、月低 10。
- CommandCode：6 账号；5h 6/6、周 6/6（低 1）、月 0/6 unknown；自然 2,826 请求 0 失败、P95 5.04s；结论“可补充供给，尚未证明无缝替代”。

## 7. 其他

- QQ：重点群 0 匹配、私聊 0 条，覆盖完整；无新增可核验候选。
- 语音：changedCount=0、denyAudio=true、groupCount 221。
- 工具：无新增改动；一次 messages 参数误用按 help 纠正。

## 8. 邮件

- 标题：`【通知】【两小时巡检】Sub2API 与 Api2Business｜北京时间 2026-11-18 13:06–15:06｜存在异常｜【建议充值】`
- jobId：`email_844ab00899ca4d22a3d991d56f02ec42`
- Message-ID：`<tencent_260498ACD13C16463A50B0601B4F9C625E08@qq.com>`
- receiveVerified：true。

## 9. 事故与下一步

- #7564：haiku 别名已稳定；thinking 404 待产品决策，保持 open。
- #7595：1527 haiku 供给缺陷，awaiting_natural_traffic，保持 open。
- 下一轮：北京时间 2026-11-18 17:06（UTC 09:06）。
