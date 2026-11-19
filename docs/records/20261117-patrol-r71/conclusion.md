# r71 两小时巡检结论（2026-11-17 17:06–19:06 北京时间）

## 总评
- Sub2API 任务口径已排除 Luna 3 条：11,560 请求、成功 11,532、失败 28，成功率 99.76%，流式 TTFT P95 7.09 秒；TTFT 有效 11,453、缺失 0，两项达标。
- 原始口径含 Luna：11,563 请求、TTFT P95 7.09 秒；仅作对照，不用于任务总评。
- Api2Business：374 请求、0 失败、P95 2.00 秒，处于 owning 配置 3 秒目标内；管理面指标，非业务成功率。
- 结论：两系统总体平稳，无真实用户请求事故；低量残余错误与 BugTeam 内部集成 522 继续跟踪。

## 关键证据
- 四作用域 11:17 自动轮次均 applied：Codex changed=10/applied=10，Grok 2/2，Claude/DeepSeek no-change；查询 0.10–0.65 秒，快照年龄 4–14 分钟。
- scores rank 11:22:03 刷新，queryDurationMs 1081，154 账号/152 组、ready；平台分布 openai 80、anthropic 22、grok 18、deepseek 13、opencode_go 21。
- 探活覆盖：Codex 42/40（缺 525、1547），Claude 20/19（缺 1502），Grok 7/7，DeepSeek 3/3；525、1547、1502 reconcile 均 completed、attempted=0/succeeded=0，确认绑定已存在。
- 错误窗口：315 条、310 客户可见、5 恢复；429 281、426 9、502 8、400 6、503 4、403 3、200 4。
- 426 9 条归 #6561；400 invalid_encrypted_content 6 条（账号 308）归 #6260；308 有 3 条写出后 502；1597 有 2 条 503 候选耗尽；404 2 条经 1535→1597→1594 后仍 404；路由层 429 2 条；403 3 条下游欠费已排除。
- Codex idle-probe planned 10/ready 10/attempted 10/succeeded 5/failed 5（账号 50、1019、1018、49、522），仅巡检证据，不是事故。
- 消耗停滞扫描 166：healthy 9、stalled 25、watch 126、demand-insufficient 4、excluded 2、强触发 19；结论为低优先回填/流量集中，仅供关注，不是告警或事故。
- 探活成本：11-16 完整日 5,790 次、4.04 元，日预算 5 元、趋势阈值 20.04 元，budget.status=within；今日部分日截至 11:07Z 为 4,552 次、3.22 元、覆盖率 99.98%；近七日中位数 13.36 元；覆盖率 99.86%、缺 139 条（provider_rate_missing 130、historical 8）。
- OpenCode：21 账号、11 有观测/10 unknown；5h 低 0、周低 2（1589 7%、1595 0%，11-23 00:00Z 重置）、月低 9；24h 无 Workspace access denied/permission_error，不形成封禁候选。
- CommandCode：6 账号、5 可调度；5h 6/6、周 6/6、月 0/6 unknown（missingReason=upstream-monthly-limit-or-percent-missing，remaining credits 11.60）；1579/1580/1581 最近 10 分钟真实用户 74 请求、0 错误、P95 1.6–4.0 秒；无独立 command_code 作用域，结论“可补充供给，尚未证明无缝替代”。
- QQ：sources qq-main last_sync completed/unchanged、新增 0、水位 11:15:30Z；群/私聊/关键词三路 job 均 completed、complete=true、matched 0、coverage_degraded=false；本窗口无新增可核验上游候选。
- 语音 gateway service-policy 预览 changedCount=0、denyAudio=true，无漂移。
- BugTeam 内部库存轮询 522 持续，约每 80 秒一次，最新 11:45Z；属内部集成调用，非用户事故；已向 #6638 追加证据评论 6947139576。

## 本轮动作
- 新增 errors aggregate/errors diagnose 操作级帮助；单测 10/10、bun run check、deploy:validate 均通过；本轮已用 errors diagnose --help 复验，仅 CLI 源码改动，不影响业务运行面。
- 定期报告已发送并核验：job email_50a6c033b8b64d56a81a96f62f493ada，status=succeeded，smtpSent=true，sentVerified=true，receiveVerified=true，mimeVerified=true；Message-ID <179491611681.1661525.2593637024235392092@qq.com>。
- TaskTree Checkpoint：tc_763ba581-bbd1-4704-8e71-30ded0a2e986（in_progress，99%）。

## 未完成与下一步
- 426/400/502/503/404 残余错误继续按既有 Issue 跟踪；无证据支持新增通用 400/502/503 模板，未改路由算法、未暂停账号。
- 下一精确核查时间：北京时间 2026-11-17 21:06；续接原 TaskTree。

## 报告口径更正（r71 邮件）
- 邮件中“近七个完整日中位数 13.36 元”应表述为“接口 7 日基线中位数 13.36 元（6 个完整日 + 1 个部分日）”；数值与 `budget.status=within` 不变。
- 邮件中“今日部分日消耗已接近历史基准”应表述为“今日部分日已用约日预算 64%，但仍低于 7 日基线中位数 13.36 元”；趋势判定仍为未超阈值。
- 下一轮报告将明确上述更正，避免把部分日计入完整日或误判趋势。

## 更正邮件
- job email_4bc48f5063cf4207b433bc2694138672，status=succeeded，smtpSent=true，sentVerified=true，receiveVerified=true，mimeVerified=true。
- Message-ID <179491645798.1663997.2928736287722194722@qq.com>；receivedMessageId <tencent_5D026CFB061FE7B297076651748E859A4E06@qq.com>。
- 更正内容：基线为 7 日基线中位数（6 完整日+1 部分日）；今日部分日 3.22 元低于基线而非接近；historical_provider_rate_missing 为 9 条。
- TaskTree 更正 Checkpoint：tc_703e47d1-0835-479b-9f6d-b982f405daaa。

## 工具摩擦
- TaskTree `checkpoint write` 使用 `--over-api https://lab-native.hwpod.com` 或 `https://lab-native.hwpod.com/tasktree` 均返回 401 `workbench_internal_identity_invalid`；默认已认证入口可正常写入。
- 下轮直接使用默认 TaskTree 入口写入 Checkpoint，避免重复 401；该现象记录为 CLI 认证摩擦，不据此回退 Api2Business 或其他运行面。
