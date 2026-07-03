# MCP Builder 设计审查 — @lehaotech/walmart-mcp

审查日期：2026-07-03 ｜ 基准：Anthropic mcp-builder 最佳实践清单 ｜ 版本：0.5.9（含 0.5.10 未发布修复）
前置说明：本次为**设计质量**审查。功能正确性已在 2026-07-02 的生产实战中验证并修复 12 个 bug（见 CHANGELOG），不在本文重复。

## 总评：4.2 / 5 —— 生产级水准，两处协议层缺口

| 维度 | 得分 | 评语 |
| --- | --- | --- |
| 服务/工具命名 | 5/5 | `walmart-mcp` + `walmart_{action}_{resource}` 全量一致，动词开头，零冲突风险 |
| 工具描述质量 | 4.5/5 | 修复后达到教科书级：信封示例、工作流指引（taxonomy→spec→feed→poll）、限流提示都写进了描述 |
| **工具 annotations** | **0/5** | **130 个工具全部缺失** readOnlyHint / destructiveHint / idempotentHint —— 最大缺口 |
| **结构化输出** | **2/5** | 无 outputSchema、无 structuredContent，全部 text+JSON.stringify。客户端无法程序化理解返回结构 |
| 响应格式 | 3/5 | 仅 JSON，无 markdown 模式；但 summary/requiredOnly/category 三个紧凑投影是超越基准的上下文管理实践 |
| 分页 | 3.5/5 | 尊重 limit/offset，透传 Walmart 原生 nextCursor；但各域元数据不统一（orders 有 meta，items 只有 totalItems，无统一 has_more） |
| 传输与日志纪律 | 5/5 | stdio + winston 全级别 stderrLevels——stdout 零污染，教科书正确 |
| 安全 | 4.5/5 | 凭证走 env、展示打码、日志 truncateData、Windows 粘贴防泄漏；-0.5：set_credentials 明文写 .env（本地场景可接受，README 可注明） |
| 错误处理 | 5/5 | 树标杆的水平：isError 在结果内、结构化 payload、endpoint+known-issues hint、feed ingestionHint、双层 zod 校验（fail-fast 于本地） |
| 测试 | 4/5 | 299 个单测覆盖到位；缺 MCP 协议层集成测试（inspector 冒烟）与 LLM 使用评测 |
| 文档 | 4.5/5 | README/CHANGELOG/docs 齐备且诚实（连误报更正都记录）；缺"每大类 3 个可复制示例" |
| 版本与元数据 | 5/5 | 版本从 package.json 动态读取（修过硬编码漂移），server name/version 规范 |

## 超越基准的亮点（值得写进 README 卖点）

1. **known-issues 提示系统**：Walmart 端点损坏时错误响应自带 workaround hint，替 LLM 省 token
2. **ingestionHint**：把 WM_SPEC_MODE / PGW NPE 两个天书错误翻译成可执行修法
3. **feed 留底账本**：每次内容提交落 JSONL——弥补 Walmart 无内容读取 API 的平台缺陷
4. **spec 版本自动探测**：拆掉了季度性全线故障的引信
5. **紧凑投影默认值**（orders summary / spec requiredOnly / taxonomy category / report 自动解压）：AI 上下文成本直降一个数量级

## 差距与修复方案（按优先级）

### P0：补全 130 个工具的 annotations（约半天，纯机械）

客户端（含 Claude 系）用这些 hint 决定是否需要用户确认、能否并行调用。当前全缺 = 所有写操作和读操作在客户端眼里同权重。

方案：在各 definitions 文件的工具对象上加 `annotations` 字段，registerTool 时透传：

```ts
// definitions: 读类工具
{ name: 'walmart_get_item', annotations: { readOnlyHint: true }, ... }
// 写但幂等（价格/库存/lag time 设定值）
{ name: 'walmart_update_price', annotations: { destructiveHint: false, idempotentHint: true }, ... }
// 破坏性（retire/delete/cancel/refund）
{ name: 'walmart_retire_item', annotations: { destructiveHint: true }, ... }
```

分布参考：约 70 个纯读（get/search/download/poll）、约 40 个幂等写、约 20 个破坏性写。

### P1：outputSchema + structuredContent（增量推进）

TypeScript SDK 已支持。建议从投影类工具开始（它们的输出结构是我们自己定义的、稳定）：get_all_orders(summary)、get_item_spec(requiredOnly)、get_taxonomy(category)、download_report、get_feed_item_status。Walmart 原样透传的工具可后置。

```ts
this.server.registerTool(name, { description, inputSchema, outputSchema }, async (args) => {
  const result = await executeTool(...);
  return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
});
```

第一步可以零成本做：所有工具先加 `structuredContent: result`（无 schema 也合法），客户端立即受益。

### P2：分页元数据统一

在 client 层加一个 `normalizePagination()`，把各域响应包一层统一的 `{ items, totalCount, hasMore, nextCursor }`（保留原始字段）。优先 orders/items/returns/inventories 四个列表工具。

### P3：评测套件（mcp-builder Phase 4）

按评测指南建 10 个只读、可验证、多跳的问答对（例：「90 天内退货次数最多的 SKU 的当前在售价格是多少？」需要 returns→聚合→get_item 两跳）。放 `evals/walmart-mcp-evals.xml`，接入 CI 做回归。这是防"工具描述漂移导致 LLM 用不对"的唯一自动化手段。

### P3：markdown 响应模式（可选）

基准建议 json/markdown 双格式。考虑到本 MCP 的消费者几乎全是 AI 客户端（JSON 更优），此项优先级最低；若做，只给 top 5 高频读工具加 `response_format` 参数即可。

## 建议路线

- **0.5.10**（已有两个 bug 修复待发）顺车带上：annotations 全量 + structuredContent 零成本版
- **0.6.0**：outputSchema 投影类工具 + 分页统一 + 评测套件接 CI
