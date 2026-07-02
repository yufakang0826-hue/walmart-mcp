# 优化清单（2026-07-02 体检产出）

体检方式：加载 build 后的工具定义做 schema 审计、vitest --coverage、npm audit/outdated、client/oauth 代码审查、以及一整个下午против生产环境的实战（19 次 feed 提交逆向 MP_MAINTENANCE 格式）。

本次已修复的不再列（见 CHANGELOG 0.5.8：MP_MAINTENANCE schema、call_endpoint POST params、poll 超时、get_item_spec 参数、429 自动重试、axios 安全底线）。以下是**剩余**建议，按优先级排序。

## P1 — 立即可做

### 1. 拉取后跑一次 `npm audit fix`
package.json 的 axios 底线已提到 ^1.18.1，但 lockfile 还钉在 1.13.5。
`npm audit fix` 一并清掉传递依赖的 HIGH 告警（@hono/node-server、fast-uri、form-data、express-rate-limit、follow-redirects）。已在 /tmp 沙箱验证 fix 后 250/250 测试全绿。

### 2. oauth.ts 零测试覆盖
认证是所有 130 个工具的公共依赖，目前 0% 覆盖。实现本身是好的
（2 分钟过期余量、并发 refresh 去重），恰恰值得用测试锁住。建议用例：
- 未过期 token 直接返回（不发请求）
- 过期触发 refresh；并发 getAccessToken 只 refresh 一次
- refresh 失败的错误传播
- 401 拦截器路径联动（refresh→重放）

## P2 — 高价值改进

### 3. 20 个写工具的参数是不透明 object（本次 P0 的同根源隐患）
`labelData` / `refundData` / `orderData` / `subscriptionData` 等 20 个参数只声明
`object`，无内部 schema。AI 调用方只能猜结构——MP_MAINTENANCE 之前就是这么坏的，
只是这些还没被踩到。清单（审计脚本产出）：
shipping_label、repricer_strategy×2、inbound_order、shipment_tracking、
mcs_order×2、carrier_rate_quotes、carrier_shipment、carrier_pickup、
return_refund、return_label、report、report_schedule×2、subscription×2、
ad_report_snapshot、hazmat_search、generic_feed（最后这个是刻意的，保留）。
建议按调用频率分批补 zod schema，每补一个都消除一类"格式盲猜"事故。

### 4. 覆盖率洼地
全局语句 86% 但函数仅 59%。fulfillment 42%、inventory 36%、returns 52%、
notifications 50%、orders 58%。这些 api 模块多是薄封装，用参数透传断言即可快速拉高。

### 5. 大响应无瘦身选项
`get_all_orders` 每单 ~3KB（今天实测 5 单 ≈15KB），一页 100 单会把 AI 客户端
上下文炸掉。建议给 orders/returns/items 列表工具加 `summary: true`（默认开）投影：
订单号、日期、状态、SKU、金额、追踪号；`summary: false` 才回全量。
对 MCP 客户端这是最直接的 token 成本优化。

## P3 — 择机

### 6. 工具面裁剪/分组
130 工具、定义总量 82.5KB。支持懒加载的客户端（Cowork）没问题，但对全量注入
的客户端是纯上下文负担。可加 `WALMART_TOOL_PROFILE=core|full|ads|wfs` 按需注册
（core ≈ 订单+商品+库存+价格+feed ≈ 60 个工具）。

### 7. spec 版本自动发现
`DEFAULT_ITEM_SPEC_VERSION` 目前是常量 + env 覆盖。Walmart 每季度发新版本串，
可在启动时（或首次 item feed 前）调 Get Spec 探测最新版，失败再回退常量。

### 8. major 升级窗口
zod 3→4（schema 定义语法有变）、vitest 3→4、TypeScript 5.9→6、
@modelcontextprotocol/sdk 1.27→1.29（minor，随手升）。建议单独 PR 逐个过。

### 9. known-issues 补一条 feeds 通道限流提示
feed 提交通道的令牌桶远比普通读接口严（实测连发十几个 feed 后 retry-after 60s
且补充慢于宣称）。可在 429 报错 hint 里对 /v3/feeds 路径特判提示"feed 通道限流
独立且严格，批量操作请合并为单个多 item feed 而不是逐个提交"——这也是最佳实践：
**批量更新永远优先合并进一个 feed**。

## 附：本次实战验证记录

- 修复后格式端到端验证：feed `18BE535D81BE56A4AC777455D14D08D7@AX8BBgA`
  (MP_MAINTENANCE, SKU GLMY-S6-PRC-19-TIS) → PROCESSED / itemsSucceeded=1，
  listing 标题+描述+卖点已在前台更新。
- 体检环境：Linux 沙箱 /tmp 副本，node 22.22.3，250/250 测试通过，tsc 零错误。
