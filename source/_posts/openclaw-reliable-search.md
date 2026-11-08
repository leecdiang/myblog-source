---
lang: zh-CN
title: 让 Agent 正确地失败：从 OpenClaw 搜索治理到 reliable-web-search
date: 2026-06-19 00:05:00
updated: 2026-06-26 00:00:00
description: 从一次 OpenClaw 搜索故障出发,记录如何把参数治理、错误分类、有限重试、权限隔离和审计日志,逐步抽象为一个支持多 Provider、多凭据、真实取消、熔断、CLI 与 MCP 接入的搜索可靠性运行时。
keywords: OpenClaw, reliable-web-search, 可靠搜索, Agent架构, MCP, 容错设计, API容灾, tool call, circuit breaker
categories:
  - Everyday Anatomy
etoc: true
image_width: mid
toc:
  number: false
tags:
  - OpenClaw
  - Agent
  - 架构
  - 可靠性
  - 容错
  - 工程实践
---

![](openclaw-reliable-search-20260619-115308.png)

> **Abstract**
>
> OpenClaw's unstable Gemini-backed search led me to build a runtime gate for parameter checks, failure classification, bounded retries, response normalization, and JSONL records. I then extracted those controls into `reliable-web-search`: a multi-provider runtime with cancellation, circuit breaking, fallback/race/aggregate strategies, credential routing, a CLI, and a stdio MCP server. This post records the failures behind those features, including proxy outages, response-envelope mistakes, and tool-policy bypasses. The runtime reports what failed and what can happen next; it leaves factual judgments to the caller.

> **2026-06-26 更新**
>
> 本文最初记录的是一个运行在 OpenClaw 内部的本地插件原型。随后,我将其中可复用的参数治理、搜索路由、错误语义、取消、熔断和诊断能力抽象为独立开源项目 [`reliable-web-search`](https://github.com/leecdiang/reliable-web-search),并发布到 npm。当前公开版本为 `v0.4.0`,已支持统一 CLI、stdio MCP、多 Provider、多凭据 profile、环境变量临时路由,以及 OpenClaw 等 Agent Host 的自动接入。文中的本地插件与当前 npm 包不是同一套代码:前者解释项目为什么出现,后者则是这套思路经过重构后的通用实现。
>
> <a href="https://github.com/leecdiang/reliable-web-search/tree/main" target="_blank" class="glass-pill"><i class="fab fa-github"></i> leecdiang/reliable-web-search</a>

OpenClaw 的联网搜索时好时坏，是这次改造的起点。

我先查 API Key、本地代理和 Gateway，起初以为修配置就够了。后来发现，调用链连失败发生在哪一层都没有说清。

网络没连上、过载、配额、鉴权、解析错误和空结果，可能都只返回“搜索失败”。Agent 还可能把调用失败写成“没有相关资料”。而重试次数、超时后是否取消、Provider 顺序、结果可用性和执行记录，也都缺少统一约定。

要修好搜索，就得把这些状态和下一步动作写进运行时。

请求需要可测试、可取消、可审计，失败以后也要知道是否还有可用证据。

---

## 1. 先分清请求到底在哪一步失败

OpenClaw 已有通过 Gemini 搜索的 `web_search`，调用路径如下：

```text
Agent
→ web_search
→ Gemini
→ 搜索结果
```

Agent 能看到返回，却未必能从返回中定位故障层级。

排查时遇到的状态包括：

```text
unsupported_language
503 UNAVAILABLE / high demand
429 rate limited
fetch failed
ECONNREFUSED
no_results
response_parse_failure
401 authentication failure
```

这些状态需要不同处理。

### 1.1 参数错误、服务过载、网络故障和空结果不是一回事

Gemini、Brave、Tavily、SearXNG 在语言、国家、时间范围、数量和索引能力上都有差异。统一工具接口不能保证底层接受同一组字段。

早期 OpenClaw 调用中,Gemini 不接受部分通用字段:

```text
language
search_lang
country
ui_lang
```

Provider 拒绝的是参数，请求还没走到“有没有结果”这一步：

```text
调用参数
≠
Provider 能力
```

其他故障也要分开处理:

| 状态 | 实际含义 | 合理动作 |
| :-- | :-- | :-- |
| `provider_overloaded` | Provider 暂时过载 | 有限重试,或切换 Provider |
| `rate_limited` | 触发速率或配额限制 | 尊重 `Retry-After`,或切换凭据/Provider |
| `transport_failure` | DNS、代理、连接或网络路径失败 | 短重试,之后切换故障域 |
| `authentication_failure` | Key 缺失、失效或权限不足 | 不原样重试;可换凭据 |
| `response_parse_failure` | Provider 有响应,但适配器无法理解 | 记录兼容性错误并 fallback |
| `no_results` | Provider 成功响应,但没有可用结果 | 不原样重试;可换索引或 Provider |

只有 Provider 成功响应、结构解析正确，且内容确实不可用，才能归为 `no_results`。

没发出去、读不懂响应和返回为空，需要分别记录。

```text
不应原样重试同一个 Provider
≠
不应 fallback 到其他 Provider
```

某个 Provider 没找到，可能与索引范围、查询理解或服务类型有关，结论只能限定在这次调用。

### 1.2 给每种失败安排下一步

运行时需要明确这些决定：

```text
这次请求发出去了没有?
发给了哪个 Provider?
系统读懂响应了吗?
错误值得重试吗?
应该换凭据,还是换 Provider?
超时后底层请求真的停了吗?
当前结果能进入证据审查吗?
什么时候必须停止?
```

否则 Agent 每遇到一次错误，都得重新猜处理办法。

我把可靠性的要求写成下面这条规则：

```text
"让搜索成功"
→
"让每一种失败都有明确的类型、边界和后续动作"
```

---

## 2. 在 OpenClaw 工具层加入 Runtime Gate

最直接的做法,是在 Prompt 或 Skill 中加规则:

```text
如果搜索失败,不要编造答案。
遇到 503 时有限重试。
网络错误不能解释成没有结果。
```

这能引导行为，却不能限制实际调用能力。

上下文变长、工具变多时，模型可能忘记规则。若同时暴露 `web_search` 和 `reliable_web_search`，要求“优先后者”也拦不住它调用原始入口。

所以需要在工具层统一入口：

```text
Agent
→ 受控搜索入口
→ 参数治理
→ Provider 路由
→ 错误分类
→ 有限重试
→ 结果标准化
→ 状态判断
→ 审计记录
```

再通过权限关闭原始路径：

```text
web_search = denied
```

这样，即使模型选错工具，也不能绕过治理。

### 2.1 先建立隔离的 Test Agent

我先单独建立临时 `test` Agent，没有直接改 Main Agent 和 Code Lab，检查以下三件事：

1. 插件是否被 OpenClaw Runtime 正确加载;
2. 新工具是否真的可调用;
3. 被禁止的工具是否在 Runtime 层不可调用。

当时的工具策略大致如下:

```json
{
  "id": "test",
  "tools": {
    "profile": "full",
    "allow": [
      "reliable_web_search",
      "read",
      "session_status",
      "memory_get",
      "memory_search"
    ],
    "deny": [
      "web_search"
    ]
  }
}
```

使用 `full` profile 是因为 OpenClaw 的处理顺序是：

```text
profile
→ allow
→ deny
```

之前用 `minimal` 时，插件工具在 profile 阶段就被过滤掉，allowlist 无法把它加回来。最后采用：

```text
full profile
→ 让插件工具进入候选集合
→ allowlist 严格收窄
→ deny 明确移除原始 web_search
```

最终 Runtime 中确认:

```text
reliable_web_search = present
web_search = absent
write = absent
apply_patch = absent
```

我还实际请求了 `write`，Runtime 返回“工具未注册”。这比 Agent 自述不会调用，更能证明权限限制生效。

Tool Policy 在这里控制的是运行时能力。

### 2.2 OpenClaw 原型只治理调用,不重写整套基础设施

第一版插件注册了一个新的工具:

```text
reliable_web_search
```

它没有重新实现 Gemini API,而是调用 OpenClaw 自己的搜索 Runtime:

```ts
api.runtime.webSearch.search({
  config: api.config,
  args
})
```

这样做是因为 OpenClaw 已经负责:

- API Key 管理;
- 代理设置;
- Provider 适配;
- 网络与安全约束;
- 引用包装;
- Runtime 返回结构;
- 基础日志。

直接向 Gemini `fetch` 会绕过 OpenClaw 已有管理，所以 wrapper 继续使用宿主 Runtime，只加治理。

原型被拆成几个部分:

```text
src/index.ts
    插件入口、调用流程和路由

src/pure.ts
    参数清洗、响应标准化和错误分类

src/retry.ts
    重试计划、退避和 jitter

src/search-run-log.ts
    JSONL 审计记录

src/index.test.ts
    回归测试
```

标准输出被设计为:

```json
{
  "ok": true,
  "status": "success",
  "provider": "gemini",
  "attempts": 1,
  "results": [],
  "error": null,
  "removed_parameters": [],
  "retrieval_succeeded": true,
  "usable_for_review": true
}
```

结果没有加入 `usable_for_claim` 字段。

原因如下：

```text
retrieval_succeeded
= 检索成功并得到可解析内容

usable_for_review
= 内容可以进入后续来源审查

usable_for_claim
= 不应由搜索层决定,而应由 Evidence Layer 判断
```

搜索层报告拿到了什么和调用状态，证据能否支持事实由后续步骤判断。

### 2.3 参数治理:统一请求经过 Provider capability check

OpenClaw 原型中,调用前先经过:

```ts
sanitizeSearchArgs(provider, args)
```

输入:

```json
{
  "query": "ASIC design flow",
  "count": 10,
  "country": "US",
  "language": "zh"
}
```

如果当前 Provider 不支持 `country` 和 `language`,发送前变成:

```json
{
  "query": "ASIC design flow",
  "count": 10
}
```

同时记录:

```json
{
  "removed_parameters": [
    "country",
    "language"
  ]
}
```

请求经过的转换也要显式记录：

```text
用户意图
→ 统一搜索请求
→ Provider capability check
→ Provider-specific request
```

独立项目保留了这一步。各 Provider 声明 `capabilities`，包括完整网页、AI Search 或 Instant Answer 类型，是否支持 freshness，以及结果数量上限。

### 2.4 失败语义、有限重试和停止条件

原型阶段,我将错误归纳为:

```text
provider_overloaded
rate_limited
transport_failure
authentication_failure
no_results
response_parse_failure
```

然后把这两个动作分开：

```text
retry
= 再次调用同一个 Provider

fallback
= 换一个 Provider 继续执行
```

合理策略大致如下:

```text
provider_overloaded
→ 2s → 5s → 12s
→ 有限尝试

rate_limited
→ 优先读取 Retry-After
→ 否则最多短暂重试一次

transport_failure
→ 短等待
→ 最多重试一次

authentication_failure
→ 不重试当前凭据

no_results
→ 不对同一 Provider 原样重试
→ 可以换 Provider
```

`attempts` 曾计数出错，修复后按下面口径统计：

```text
attempts
= 包含首次调用在内的总调用次数

retryIndex
= 已完成的重试次数
```

真实网络失败时,结果类似:

```json
{
  "ok": false,
  "status": "transport_failure",
  "provider": "gemini",
  "attempts": 2,
  "results": [],
  "error": "fetch failed",
  "retrieval_succeeded": false,
  "usable_for_review": false
}
```

它表达的是:

```text
首次调用失败
→ 有限等待
→ 重试一次
→ 仍然失败
→ 明确停止
```

继续重试、换服务或停止，都由错误类型和预算决定。

### 2.5 有正文，却被判成空结果

响应封装层曾导致一次误判：

```text
网络失败
Provider 返回空结果
wrapper 解析失败
```

一开始 Gemini Runtime 返回:

```json
{
  "provider": "gemini",
  "result": {
    "content": "...",
    "citations": []
  }
}
```

wrapper 检查的却是:

```ts
rawRecord.content
```

真正内容在:

```ts
rawRecord.result.content
```

wrapper 在错误层级找正文，把有内容的成功响应归成了 `no_results`。

先解开 Runtime envelope，才能检查内容：

```ts
const rawData =
  rawRecord &&
  typeof rawRecord === "object" &&
  "result" in rawRecord &&
  typeof rawRecord.result === "object"
    ? rawRecord.result
    : rawRecord;
```

之后所有内容检测、引用读取和标准化都基于 `rawData`。

解析失败必须报 parse failure，不能因为适配器读错结构就宣布没有结果。

修好后又出过一次问题：宽泛正则清理调试代码，把解包逻辑也删了。此后增加了这条约束：

```text
不使用宽泛正则批量改源码;
修复必须落在 src;
每次修改后重新 build 并跑回归测试。
```

最终,真实调用链闭环为:

```text
Agent
→ reliable_web_search
→ OpenClaw Web Search Runtime
→ Gemini
→ Runtime envelope
→ normalize
→ Agent
```

### 2.6 基础设施故障不会因为代码正确而消失

当时另一个反复出现的变量,是本地代理:

```text
127.0.0.1:17891
```

只要代理进程退出,Gateway 仍然尝试连接原端口,最终得到:

```text
ECONNREFUSED
fetch failed
transport_failure
```

同样的代码，代理在就成功，进程退出就失败。

最终确认的代理配置是:

```text
代理模式:规则
HTTP/SOCKS 端口:17891

服务模式 TUN:关闭
DNS 防污染:关闭
局域网代理:关闭

自启动:开启
关闭时询问:关闭
退出时最小化:开启
```

要把代码行为和基础设施状态分开：

```text
关闭窗口
≠
退出代理进程
```

`reliable_web_search` 可以正确识别代理故障,却不能自动恢复一个已经退出的代理服务。

搜索层可以识别依赖故障、隔离影响和选择下一步，恢复代理服务则是另一件事。

### 2.7 用 JSONL 还原调用过程

原型会把每次搜索追加到:

```text
~/.openclaw/workspace/90_system/search/search_runs.jsonl
```

成功记录类似:

```json
{
  "search_run_id": "SEARCH-2bb117-372755",
  "query": "latest OpenClaw version 2026",
  "provider": "gemini",
  "attempts": 1,
  "status": "success",
  "error_code": null,
  "latency_ms": 7758,
  "result_count": 1,
  "removed_parameters": [],
  "retrieval_succeeded": true,
  "usable_for_review": true,
  "started_at": "2026-06-18T13:42:26.336Z",
  "finished_at": "2026-06-18T13:42:34.094Z"
}
```

网络失败也会留下记录:

```json
{
  "query": "OpenClaw official documentation",
  "provider": "gemini",
  "attempts": 2,
  "status": "transport_failure",
  "error_code": "fetch failed",
  "result_count": 0,
  "retrieval_succeeded": false,
  "usable_for_review": false
}
```

过去只看到一句失败，无法确定 Provider、次数、参数删减、错误类型、耗时和可用内容。

这些现在都可以回到结构化记录检查。

日志中刻意不保存 API Key、Authorization Header、完整 Provider 原始响应和完整搜索正文。

不过 query 本身也可能包含姓名、文件路径、项目代号等敏感信息。正式部署时,日志系统仍应支持关闭 query 日志、对 query 脱敏、只保存 query hash、设置日志保留期限。

审计只记录排障所需信息，也要受隐私与保留期限限制。

---

<div class="v-figure">
<svg viewBox="0 0 1000 420" role="img" aria-label="可靠搜索 Runtime Gate"><defs><marker id="gA" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#5d7f96"/></marker><marker id="gR" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#a34a4a"/></marker></defs><text x="25" y="38" font-size="11" fill="#7b8b99" letter-spacing="2" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">RELIABLE WEB SEARCH · RUNTIME GATE</text><text x="25" y="62" font-size="11" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Agent 不能绕过 Gate；每一种失败都有类型、边界和下一步</text><ellipse cx="109" cy="260" rx="86" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="25,154 185,154 167,136 7,136" fill="#7aa6c6"/><polygon points="25,154 185,154 185,250 25,250" fill="#3f6f96"/><polygon points="185,154 167,136 167,232 185,250" fill="#2b5578"/><circle cx="45" cy="174" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="45" y="178" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">01</text><text x="105" y="198" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Agent 查询</text><text x="105" y="217" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">原始请求</text><path d="M189,224 L211,224" fill="none" stroke="#5d7f96" stroke-width="2" marker-end="url(#gA)"/><ellipse cx="299" cy="260" rx="86" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="215,154 375,154 357,136 197,136" fill="#78b7ae"/><polygon points="215,154 375,154 375,250 215,250" fill="#2f7f7a"/><polygon points="375,154 357,136 357,232 375,250" fill="#1f5f5b"/><circle cx="235" cy="174" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="235" y="178" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">02</text><text x="295" y="198" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Runtime Gate</text><text x="295" y="217" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">参数治理 · 权限</text><path d="M379,224 L401,224" fill="none" stroke="#5d7f96" stroke-width="2" marker-end="url(#gA)"/><ellipse cx="489" cy="260" rx="86" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="405,154 565,154 547,136 387,136" fill="#d2ad72"/><polygon points="405,154 565,154 565,250 405,250" fill="#9a7434"/><polygon points="565,154 547,136 547,232 565,250" fill="#77551f"/><circle cx="425" cy="174" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="425" y="178" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">03</text><text x="485" y="198" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Provider 路由</text><text x="485" y="217" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">多凭据 · 优先级</text><path d="M569,224 L591,224" fill="none" stroke="#5d7f96" stroke-width="2" marker-end="url(#gA)"/><ellipse cx="679" cy="260" rx="86" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="595,154 755,154 737,136 577,136" fill="#8fa7b6"/><polygon points="595,154 755,154 755,250 595,250" fill="#5c7383"/><polygon points="755,154 737,136 737,232 755,250" fill="#455c6c"/><circle cx="615" cy="174" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="615" y="178" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">04</text><text x="675" y="198" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">响应解析</text><text x="675" y="217" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">结构化错误</text><path d="M759,224 L781,224" fill="none" stroke="#5d7f96" stroke-width="2" marker-end="url(#gA)"/><ellipse cx="869" cy="260" rx="86" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="785,154 945,154 927,136 767,136" fill="#8fc0a9"/><polygon points="785,154 945,154 945,250 785,250" fill="#4f8a6f"/><polygon points="945,154 927,136 927,232 945,250" fill="#356a51"/><circle cx="805" cy="174" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="805" y="178" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">05</text><text x="865" y="198" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">证据可用</text><text x="865" y="217" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">JSONL 审计</text><rect x="25" y="330" width="950" height="52" rx="10" fill="rgba(163,74,74,.08)" stroke="rgba(163,74,74,.30)" stroke-dasharray="4 4"/><text x="45" y="352" font-size="10.5" fill="#8a4a4a" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">失败分类：503 / 429 → 有限重试或切换；auth → 换凭据；parse → fallback；no_results → 换索引或 Provider；全部失败 → 明确停止</text><text x="45" y="370" font-size="9.5" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">网络没连上、响应解析不了、Provider 真的返回空结果，是三种不同状态。</text></svg>
<p class="v-caption">图 1：可靠搜索的 Runtime Gate。Agent 不能绕过入口，失败类型决定下一步动作。</p>
</div>

## 3. 从 OpenClaw 插件到通用搜索运行时

原型能解决当时的问题，但仍绑在本地 OpenClaw 环境：

- 依赖 OpenClaw Runtime;
- Provider 路由写在插件内部;
- JSONL 路径固定在 workspace;
- 错误类型和返回结构服务于特定 Agent;
- 其他 Node.js 应用无法直接复用。

可以抽出的共性如下。

```text
如何选择 Provider?
什么状态触发 retry?
什么状态触发 fallback?
超时后请求是否真的停止?
多个 Provider 并发时如何结束?
Provider 连续故障时如何隔离?
如何判断结果是否满足最低质量门?
如何记录每一次尝试?
```

于是这部分能力被抽象成独立项目:

```text
reliable-web-search
```

独立项目在应用与多个搜索 API 之间安排调用策略：

```text
Application / Agent
        │
        ▼
reliable-web-search
        │
        ├─ Provider registry
        ├─ Priority routing
        ├─ Capability and configuration checks
        ├─ Retry and fallback policy
        ├─ Timeout cancellation
        ├─ Circuit breaker
        ├─ Result status and quality gate
        └─ Attempt diagnostics
        │
        ▼
Search Providers
```

### 3.1 Provider registry:显式优先级、能力和配置门

最初按注册顺序选择服务，无密钥但能力有限的 Provider 有时反而排在前面。

现在每个 Provider 都具有:

```ts
priority
capabilities
isConfigured()
```

registry 只加入真实配置完成的 Provider,并按优先级路由。SearXNG 只有显式配置 Base URL 才算可用,不再默认向本机 `localhost` 发请求。

如果用户写错 Provider 名称:

```ts
providers: ["brvae", "tavily"]
```

拼错时给出接近的名字，避免配置被悄悄忽略。

当前内置八个 Provider:

| Provider | 类型 | 当前定位 |
| :-- | :-- | :-- |
| Brave | 完整网页搜索 | Verified |
| Tavily | 面向 LLM 的网页搜索 | Verified |
| Bocha | 完整网页搜索 | Experimental |
| Metaso | AI Search | Experimental |
| Gemini | AI Grounding | Verified |
| SerpAPI | 多搜索引擎适配 | Verified |
| SearXNG | 自托管聚合搜索 | Verified |
| DuckDuckGo | Instant Answer | 零配置兜底 |

DuckDuckGo 使用 Instant Answer API,不是完整网页搜索,更适合百科式主题摘要,因此被放在低优先级兜底位置。

### 3.2 三种执行策略:fallback、race、aggregate

三种模式:

```text
fallback
race
aggregate
```

#### `fallback`

按优先级顺序调用 Provider:

```text
Provider A
→ 失败或空结果
→ Provider B
→ 成功后停止
```

#### `race`

同时启动多个 Provider,第一个获得可用结果的请求成为 winner:

```text
A ───────────────
B ───── success
C ─────────

B wins
→ abort A
→ abort C
```

winner 确认后，会立即触发其他 Provider 的独立 `AbortController`，取消落败请求，避免它们继续占连接、耗额度。仅靠 `Promise.all()` 做不到这一步。

#### `aggregate`

aggregate 并发收集成功结果。当前版本完成统一执行与状态诊断，URL canonicalization、跨 Provider 去重、融合排序和域名多样性仍待实现。

### 3.3 超时现在真的会取消请求

早期实现使用:

```ts
Promise.race([providerPromise, timeoutPromise])
```

上层虽然停止等待，底层 `fetch` 却可能还在执行。

当前实现通过 `AbortController` 将 timeout 传入实际请求:

```text
达到超时
→ signal.abort()
→ Provider fetch 终止
→ 记录 timeout
→ 根据策略 retry 或 fallback
```

测试会直接验证 Provider 能观察到:

```ts
signal.aborted === true
```

取消需要传到实际请求，否则出现的就是：

> 表面已经超时,后台请求还在继续消耗额度。

### 3.4 结构化 `ProviderError` 与 Circuit Breaker

Provider 不再只抛一个字符串,而是返回结构化错误:

```text
providerId
error code
HTTP status
retryable
shouldBreakerTrip
Retry-After
```

系统据此区分:

```text
401 auth_failed
429 rate_limited
500 server_error
timeout
aborted
no_results
parse_error
```

这些字段决定重试、切凭据、fallback、熔断计数、等待与最终返回状态。

鉴权错误不应该当成瞬态服务故障记入熔断器。网络错误、超时和 5xx 才真正反映 Provider 健康状态。

熔断器有 closed、open、half-open 三种状态。失败达到阈值后:closed → open → 暂时跳过该 Provider → recovery timeout → half-open 试探 → 成功后 closed。

当前实现验证了调用级配置能真正进入 breaker--比如 `failureThreshold = 1`、`recoveryTimeout = 100ms`--不只是类型定义里有。

### 3.5 结果契约与 AttemptRecord

最终返回值不只包含结果,还包含完整的执行元数据:

```ts
interface ReliableSearchResult {
  results: UnifiedSearchResult[];
  provider: string;
  providerPath: string[];
  fallbackReason?: string;
  attempts: AttemptRecord[];
  elapsedMs: number;
  retrievalSucceeded: boolean;
  usableForReview: boolean;
  resultStatus:
    | "success"
    | "partial"
    | "no_results"
    | "failed"
    | "aborted";
  cacheHit: boolean;
}
```

每次尝试都会记录:

```text
Provider
Route
凭据 profile
状态
耗时
错误分类
HTTP 状态
结果数量
```

例如:

```json
{
  "providerPath": ["tavily.default"],
  "attempts": [
    {
      "providerId": "tavily",
      "routeId": "tavily.default",
      "credentialProfile": "default",
      "status": "success",
      "resultCount": 5
    }
  ],
  "resultStatus": "success",
  "retrievalSucceeded": true,
  "usableForReview": true
}
```

因此既能看到最终结果来自谁，也能还原中间试过哪些路径。

缓存命中也会明确返回:

```ts
cacheHit: true
```

缓存结果保留与实时调用一致的主要字段，调用者不必再适配一套残缺结构。

### 3.6 从安装包检查实际入口

项目通过 `tsup` 同时输出:

```text
ESM
CommonJS
TypeScript declarations
```

除了源码测试，发布前也检查：

```text
ESM import
CJS require
typecheck
build
npm pack
packaged CLI
MCP handshake
```

v0.4.0 发布前完成:

```text
196 tests
8 packaged smoke tests
0 failures
```

覆盖的行为包括：

- 空结果会继续 fallback；
- timeout 会真正 abort；
- race winner 会取消 loser；
- attempts 顺序稳定；
- breaker 自定义配置真实生效；
- cache hit 返回完整结构；
- ESM/CJS 包可以真实加载；
- 打包后的 CLI 和 MCP Server 可以启动；
- 多凭据 route 能被 MCP 正确读取。

---

## 4. v0.4.0:从"多个 Provider"走向"多个凭据、统一 CLI 与 MCP"

v0.4.0 又加入一层问题：同一 Provider 内也可能有多个凭据，需要明确它们怎样接替。

```text
同一个 Provider 可能有多个合法凭据；
多个 Agent Host 需要共享同一个搜索入口；
用户不应该手工修改 JSON 才能配置；
环境变量、文件凭据和无 Key Provider 应该共存。
```

因此,配置模型从:

```text
Provider
```

升级为:

```text
Provider Definition
→ Credential Profile
→ Provider Route
```

例如:

```text
tavily.default
tavily.backup-2
gemini.default
duckduckgo
```

### 4.1 两层故障决策:credential failover 与 provider fallback

v0.4.0 明确区分两层切换。

第一层是同一 Provider 内的凭据切换:

```text
tavily.default
→ tavily.backup-2
```

第二层是 Provider 级 fallback:

```text
tavily.*
→ gemini.*
→ duckduckgo
```

规则如下:

| 错误类型 | 后续动作 |
| :-- | :-- |
| `rate_limited` | 尝试同 Provider 的下一个 credential |
| `quota_exhausted` | 尝试同 Provider 的下一个 credential |
| `authentication_failure` | 当前 credential 标记失败,尝试同 Provider 其他凭据 |
| `network_error` | 按 retry/breaker 处理后切换 Provider |
| `timeout` | 按 retry/breaker 处理后切换 Provider |
| `server_error` | 按 retry/breaker 处理后切换 Provider |
| `provider_overloaded` | 按 retry/breaker 处理后切换 Provider |
| `no_results` | 直接切换 Provider |
| `unusable_results` | 直接切换 Provider |
| 用户取消 | 立即停止 |

这里默认只做 failover：

> 默认实现 failover,不做 round-robin。

多个凭据用于备用、团队 workspace、Key rotation 和故障隔离，没有默认做跨账号轮询消耗额度。

### 4.2 循环式 Setup Wizard

v0.3.0 的 `rws setup` 只能选择一个 Provider、输入一个 Key,然后结束。v0.4.0 改成循环式流程:

```text
添加 Provider
→ 添加凭据
→ 继续添加同 Provider 凭据
→ 添加其他 Provider
→ 查看和调整路由
→ 完成配置
→ 检测 Agent Host
```

使用方式:

```bash
npm install --global reliable-web-search
rws setup
```

在 macOS 或 Linux 上,如果系统全局目录无写权限,可以安装到用户目录:

```bash
npm install --global \
  --prefix "$HOME/.local" \
  reliable-web-search
```

再把下面路径加入 `PATH`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

不需要使用:

```text
sudo npm install -g
```

向导能够连续添加:

```text
tavily.default
tavily.backup-2
gemini.default
duckduckgo
```

并在最终确认路由后,检测 OpenClaw、Codex、Claude Code 或 Generic MCP 环境。

### 4.3 CLI 管理能力

除了 setup,v0.4.0 还提供独立管理命令:

```bash
rws credentials list
rws credentials add tavily --label backup
rws credentials remove tavily.backup
rws credentials enable tavily.backup
rws credentials disable tavily.backup
```

```bash
rws routes list
rws routes move tavily.backup --before gemini.default
rws routes enable tavily.backup
rws routes disable tavily.backup
```

诊断命令:

```bash
rws doctor
rws doctor --live
rws doctor --live --all-credentials
```

其中:

```text
doctor
= 检查配置、凭据引用、路由完整性和宿主环境

doctor --live
= 验证每个 Provider 的首选 credential

doctor --live --all-credentials
= 明确警告后逐个发起真实请求
```

最后一个命令会消耗每个凭据的真实额度,因此不应作为日常检查默认执行。

### 4.4 环境变量成为不落盘的临时路由

如果环境中存在:

```bash
export TAVILY_API_KEY="..."
```

系统把它临时生成为高优先级 `tavily.env` 路由，不写 `config.json` 或 `credentials.json`。它会与本地相同 Key 去重，在 `routes list` 标成 `[env]`，不能通过 `credentials remove` 删除；移除环境变量，路由就消失。

CI、服务器和临时开发环境可以直接注入 Key,无需改写本地凭据文件。

### 4.5 凭据与配置分离

v0.4.0 将数据分开保存:`config.json` 放 routes、优先级、启停状态等非敏感配置;`credentials.json` 放 credential profiles 和 API Key。

安全约束包括:Unix 下 `credentials.json` 权限为 `0600`;API Key 不进入 Host MCP 配置、`AttemptRecord`、stdout、日志或诊断输出;setup 和 doctor 只显示 label 或掩码;v1 → v2 迁移会创建备份;损坏文件不会被自动覆盖。

### 4.6 一个工具接入多个 Agent Host

v0.3.0 开始,项目提供 stdio MCP Server:

```bash
rws mcp
```

Agent Host 只需要注册:

```json
{
  "command": "/path/to/rws",
  "args": ["mcp"]
}
```

当前支持状态为:

| Host | 状态 |
| :-- | :-- |
| OpenClaw | Verified |
| Generic MCP | Standard MCP |
| Codex | Beta |
| Claude Code | Beta |

对 Agent 来说,始终只看到一个搜索工具:

```text
reliable_web_search
```

Agent 只需调用同一工具、读取结构化结果，Provider、凭据和 fallback 在下面统一管理。

在 OpenClaw 实机验证中,新版 MCP 工具最终返回:

```text
providerPath: ["tavily.default"]
routeId: tavily.default
status: success
credentialProfile: default
```

迁移时旧 `0.1.0` 插件仍注册同名工具，模型先走旧 Gemini，再调新版 MCP。禁用旧插件、只保留 `rws mcp` 后，调用才统一。

因此，工具名和注册所有权也要查，不能只确认新工具本身能运行。

---

## 5. 当前范围与仍待处理的问题

从原型前到通用运行时，行为发生了这些变化。

### 原型之前

```text
搜索成功
→ 返回结果

搜索失败
→ 原因不清楚
→ Agent 自己推断
→ 可能重试
→ 可能直接回答
```

### OpenClaw Runtime Gate

```text
Agent
→ 参数清洗
→ Gemini / Tavily
→ 错误分类
→ 有限重试与 fallback
→ 标准化输出
→ JSONL
→ Evidence Review
```

### 当前通用运行时

```text
Application / Agent
→ Provider detection and priority
→ Credential-aware routes
→ Abortable timeout
→ Retry / credential failover / provider fallback
→ Race / aggregate
→ Circuit breaker
→ Result quality gate
→ Stable attempt diagnostics
→ CLI / MCP / SDK
```

对照如下：

| 第一阶段 | 当前阶段 |
| :-- | :-- |
| 搜索工具 wrapper | 搜索可靠性运行时 |
| 单一 OpenClaw 环境 | 通用 Node.js SDK + CLI + MCP |
| Gemini 为主、Tavily 兜底 | 八个 Provider 的统一 registry |
| 单 Provider 单 Key | 多 Provider、多 credential profile |
| 普通错误分类 | 结构化 `ProviderError` |
| 上层 timeout | 底层真实取消 |
| 简单 fallback | fallback / race / aggregate |
| JSONL 本地审计 | 标准化 `AttemptRecord[]` |
| 工具权限治理 | Provider、凭据与 Host 三层治理 |
| 能搜索吗 | 是否值得继续、切换或停止 |

当前实现仍有缺口。

当前版本还没有跨 Provider URL canonicalization、复杂重复结果融合、相关性重排序、域名多样性控制、round-robin 或健康权重、完整用量统计与成本预算、云端凭据管理、Web UI、通用 telemetry hooks。

我想先发布、实际使用，再按观察到的故障决定扩展顺序。

例如重复链接出现后做融合，实例互相污染时加强隔离，费用难控时加预算，确有 GUI 需求再做 Web UI。

现阶段先保证已承诺的行为可以被测试检查。

### 几次“刚修好又坏了”

排障耗时最多的，是分清哪一层出了问题：

```text
代码错误?
配置错误?
Provider API 变化?
Runtime 没有加载新构建?
本地代理退出?
请求被限流?
响应 envelope 改变?
旧插件和新 MCP 同时存在?
旧日志和新日志混在一起?
```

`tail` 曾把旧 `transport_failure` 和新成功记录一起显示，wrapper 曾读错响应层级，关代理窗口时也退出过后台进程。新 MCP 工作正常以后，还碰到了旧插件抢同名工具。看起来都像搜索又坏了，修复位置却不同。

这些问题需要系统报告具体状态，单凭“成功/失败”两种描述追不下去。

我希望调用结果至少能回答：

```text
请求到底发出去了没有?
发给了谁?
使用了哪个 route 和 credential profile?
响应结构是什么?
系统是否读懂了响应?
失败发生在哪一层?
这个错误是否值得重试?
要不要换凭据?
要不要换 Provider?
底层请求到底停了没有?
当前结果能不能进入证据审查?
整个过程是否留下了可追踪记录?
```

这些记录齐全，下一次失败就有位置可查。

---

## 搜索失败以后，还能做什么

从 OpenClaw 插件走到 `reliable-web-search`，参数、权限、代理、响应封装、取消、路由与工具注册逐步进入同一套契约。CLI 和 MCP 则让其他宿主也能使用它。

```text
一个 Agent 绕不过去的治理入口
一套能准确描述故障的状态语义
一个超时后不会偷跑资源的执行层
一条能根据错误选择 retry、credential failover、provider fallback 或停止的路由
一份能回溯每次 Provider 尝试的诊断记录
一个可以通过 CLI、MCP 和 SDK 复用的统一接口
```

现在每次失败可以留下类型、边界和证据，再按预算重试、切换或停止。它仍可能拿不到资料，但不会把这件事悄悄写成检索成功。

单个 Provider、Key 或网络路径出故障时，也有机会继续走其他可用路线。

---

<a href="https://github.com/leecdiang/reliable-web-search/tree/main" target="_blank" class="glass-pill"><i class="fab fa-github"></i> leecdiang/reliable-web-search</a>
