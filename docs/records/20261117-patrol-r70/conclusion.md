# r70 两小时巡检结论（北京时间 2026-11-17 15:06—17:06）

- Sub2API 任务口径（排除 Luna 27 条）：10,346 请求、成功 10,254、失败 92，成功率 99.1108%，TTFT P95 9.635 秒，两项达标。
- Api2Business：372 请求、0 失败、非 5xx 100%，管理面 P95 3.6235 秒，超过 3 秒目标；不是业务成功率或 TTFT。
- 事故判定：无公共故障或用户可感知不可用；管理面查询拥塞和探活失败只作巡检证据。
- 重要口径：账号 37/39 的 20 次 `unknown provider for model gpt-5.6-sol` 全部来自 `api2business-probe-37/39` 探活分组，客户可见为 0；不得写成用户失败。
- 真实用户残余：2 条 429 在响应写出后无法切号；3 条 502 与 1 条客户端 499 属低量残余，未触发事故。
- 四作用域：Codex 92/A、42 可调度；Claude 96.5/A、20；Grok 94/A、7；DeepSeek 99.3/A、3；17:16 自动轮次均 applied。
- OpenCode：11 个可调度账号有观测、10 个不可调度 unknown；7 个月度 0%、1589 周 9%、1595 周 0%；24 小时无 `Workspace access denied`，不形成封禁候选。
- CommandCode：5 小时 6/6、周 6/6、月 0/6 unknown；1579/1580/1581 近两小时 3,947 成功、0 错误、P95 3.9—5.3 秒；月额度与独立作用域缺失，结论为可补充供给、尚未证明无缝替代。
- 充值：www.sheapi.cc、sub.yjxm1221.top、api.mmcapi.cn、sub2.xingqiao.cc 各建议 50 元；qianfan.baidubce.com 余额未知，待核实。
- 余额/冲突：无 `conflictingBalances`，无“stale 且有 24 小时消耗”的钱包。
- QQ：配置群、全群、私聊三路均 complete、0 命中；本窗口无新增可核验上游候选。

## 收尾复验（17:26—17:50）

- 四作用域自然轮次：17:26 与 17:36 两轮均 `applied`，查询 0.08—0.52 秒、快照年龄约 6 分钟；修复后自动调度持续前进。
- 查询修复：`src/consumption-stall.ts` 的 `probe_window` CTE 改为 `AS MATERIALIZED`；单测 8 项、`bun run check`、`bun run deploy:validate` 均通过。API 容器 17:15:55 重启并 healthy，`consumption-stalls` 查询 649ms 级，未再出现 15 秒超时。补充邮件 `email_8bf045d7907643bb92b3b95de4030a7c` 已核验送达。
- 新增错误窗口 17:26—17:42：42 条客户可见，其中 31 条为下游 API Key 额度耗尽（`API_KEY_QUOTA_EXHAUSTED`，request 阶段、无账号，按规则排除）、8 条 426 归入 #6561、3 条 502（账号 308 两笔、525 一笔，均为响应写出后低量残余）。
- 消耗停滞新窗口 15:44—17:44：扫描 166、healthy 6、stalled 25、watch 129、demand-insufficient 4、excluded 2、alerts 19；抽查账号均 active/schedulable，原生优先级为 `lower-is-higher`，流量集中于 1547，属低优先回填与流量集中，不是事故；1493 窗口内仍有 37 次归属请求。
- 钱包：61 个钱包、30 个非 fresh、0 冲突；仅 OpenCode、CommandCode、qianfan 三个非 fresh 钱包有 24 小时消耗，均余额未知，保持未知并按一般储备待核实。
- 审批回复：`automatic-tasks.message` 队列为空，无新的用户回复或决策事件。
- 外部依赖观察：API 日志自 09:16:47 至 09:51:21 每约 80 秒出现 `BugTeam /api/customer/inventory` 与 `inventory/shelves` 返回 HTTP 522，共 27 次；调用方为内部 worker，未影响 Sub2API/Api2Business 用户请求，按巡检证据记录，不升级为事故，下一轮继续观察。
- 最新 10 分钟复验（17:43—17:53）：Sub2API 1,271 请求、0 失败、成功率 100%、TTFT P95 5.473 秒、TTFT 有效 1,261、缺失 0，Luna 排除 0 条；Api2Business 34 请求、0 失败、P95 1.701 秒、覆盖 600/600 秒。同期 26 条客户可见 429 均归入下游 `user_id=39`/API Key 额度耗尽（业务额度排除 27 条），不进入 SLO 分子分母。
- 下一轮冻结窗口与精确核查时间：北京时间 2026-11-17 19:06。
