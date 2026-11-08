---
lang: zh-CN
title: "reliable-web-search：Agent 搜索调用的可靠性设计"
date: 2026-06-19 00:05:00
updated: 2026-06-26 00:00:00
description: "OpenClaw 搜索治理演进为 reliable-web-search 的实现记录，涵盖失败分类、参数治理、取消、熔断、多 Provider 与凭据路由，以及 CLI、MCP 的执行契约验证。"
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
> Intermittent failures in OpenClaw's Gemini-backed search exposed an ambiguity between transport errors, invalid parameters, response parsing failures, and empty results. I first implemented a runtime gate for parameter validation, failure classification, bounded retries, response normalization, and JSONL audit records, then extracted these controls into `reliable-web-search`. The resulting multi-provider runtime supports cancellation, circuit breaking, fallback/race/aggregate execution, credential routing, a CLI, and a stdio MCP server. This post examines the implementation through observed failures, including proxy outages, response-envelope mismatches, and tool-policy bypasses. Its scope is execution reliability and diagnostic evidence; assessing whether retrieved material supports a factual claim remains the caller's responsibility.

> **2026-06-26 更新**
>
> 本文最初记录的是一个运行在 OpenClaw 内部的本地插件原型。随后,我将其中可复用的参数治理、搜索路由、错误语义、取消、熔断和诊断能力抽象为独立开源项目 [`reliable-web-search`](https://github.com/leecdiang/reliable-web-search),并发布到 npm。当前公开版本为 `v0.4.0`,已支持统一 CLI、stdio MCP、多 Provider、多凭据 profile、环境变量临时路由,以及 OpenClaw 等 Agent Host 的自动接入。文中的本地插件与当前 npm 包不是同一套代码:前者解释项目为什么出现,后者则是这套思路经过重构后的通用实现。
>
> <a href="https://github.com/leecdiang/reliable-web-search/tree/main" target="_blank" class="glass-pill"><i class="fab fa-github"></i> leecdiang/reliable-web-search</a>

这次改造源于 OpenClaw 联网搜索的间歇性失败。表面上是同一个工具有时返回、有时失败，排查后却发现，这些现象分属不同的执行层级。

最初，我主要检查 API Key、本地代理和 Gateway 配置。配置问题确实存在，但调用链缺少明确的失败语义，使得修复某一处配置后，仍难以判断下一次失败是否出于同一原因。

网络连接失败、服务过载、配额耗尽、鉴权异常、解析错误与空结果，都可能被压缩成“搜索失败”。Agent 甚至会将调用失败解释为“没有相关资料”。与此同时，重试预算、超时取消、Provider 顺序、结果可用性和执行记录也缺少统一约定。

因此，需要在运行时明确描述调用状态，并将允许采取的后续动作与状态绑定。

本文围绕这一目标展开：使请求过程可测试、可取消、可审计，并在失败后保留足以判断执行进展与证据可用性的记录。

---

## 1. 搜索调用的故障分层与结果语义

OpenClaw 已有通过 Gemini 搜索的 `web_search`，调用路径如下：

```text
Agent
→ web_search
→ Gemini
→ 搜索结果
```

返回内容本身未必提供足够的诊断信息，Agent 因而难以区分故障发生在请求构造、传输、服务端执行还是响应解析阶段。

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

这些状态对应不同的恢复条件，不能共享同一种重试与终止策略。

### 1.1 区分参数拒绝、服务故障与空结果

Gemini、Brave、Tavily 与 SearXNG 在语言、国家、时间范围、结果数量和索引能力上存在差异。上层工具接口统一，只能统一请求表达，不能推定每个底层服务接受相同字段。

早期 OpenClaw 调用中,Gemini 不接受部分通用字段:

```text
language
search_lang
country
ui_lang
```

此时 Provider 拒绝的是请求参数，尚未进入检索结果是否存在的判断阶段：

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

只有 Provider 成功响应、响应结构正确解析，且未得到可用检索内容时，才应归类为 `no_results`。

请求未能发出、响应无法解析与检索结果为空，必须作为不同状态记录。

```text
不应原样重试同一个 Provider
≠
不应 fallback 到其他 Provider
```

某个 Provider 未返回结果，可能受索引范围、查询理解或服务类型限制。这个结论只描述本次调用，不能外推为互联网上不存在相关资料。

### 1.2 将失败分类映射为恢复决策

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

若这些规则没有进入运行时，Agent 就需要在每次错误后重新推断处理方式，行为也难以稳定复现。

据此，我将可靠性要求归纳为以下执行规则：

```text
"让搜索成功"
→
"让每一种失败都有明确的类型、边界和后续动作"
```

---

## 2. Runtime Gate 的工具入口与权限配置

最直接的做法,是在 Prompt 或 Skill 中加规则:

```text
如果搜索失败,不要编造答案。
遇到 503 时有限重试。
网络错误不能解释成没有结果。
```

这类规则能够引导模型选择，却无法约束运行时实际暴露的调用能力。

随着上下文和工具数量增加，模型仍可能偏离规则。若同时暴露 `web_search` 与 `reliable_web_search`，仅在提示中要求优先使用后者，不能阻止原始入口被直接调用。

治理入口因此需要在工具层统一：

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

再由权限配置关闭未经治理的原始路径：

```text
web_search = denied
```

入口统一与权限限制共同生效后，模型即使选择原始工具，也无法绕过治理流程。

### 2.1 隔离测试与工具权限验证

我先建立隔离的临时 `test` Agent，在不改动 Main Agent 和 Code Lab 的条件下验证三项行为：

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

随后实际请求调用 `write`，Runtime 返回“工具未注册”。这一结果验证了权限在执行层生效，比依赖 Agent 自述遵守限制更有说服力。

这里的 Tool Policy 定义了运行时可执行的能力范围。

### 2.2 宿主基础设施的复用

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

直接向 Gemini 发起 `fetch` 会绕过这些已有管理能力。因此，wrapper 继续调用宿主 Runtime，将自身职责限定为参数与执行治理。

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

结果契约中没有加入 `usable_for_claim` 字段。

原因如下：

```text
retrieval_succeeded
= 检索成功并得到可解析内容

usable_for_review
= 内容可以进入后续来源审查

usable_for_claim
= 不应由搜索层决定,而应由 Evidence Layer 判断
```

搜索层负责报告取得的内容及其执行状态；这些内容是否足以支持具体事实主张，仍需后续步骤结合来源与语境判断。

### 2.3 参数治理与 Provider 能力检查

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

参数转换本身也是执行过程的一部分，需要显式记录：

```text
用户意图
→ 统一搜索请求
→ Provider capability check
→ Provider-specific request
```

独立项目保留了这一能力检查。各 Provider 通过 `capabilities` 声明其提供完整网页搜索、AI Search 或 Instant Answer 的类型，以及 freshness 支持和结果数量上限。

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

`attempts` 曾出现计数错误，修复后采用以下统一统计口径：

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

重试、切换服务与停止分别由错误类型及剩余预算决定，避免将失败恢复交给无界循环。

### 2.5 响应封装层级错误与空结果误判

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

wrapper 在错误的封装层级查找正文，因而将实际包含内容的成功响应误判为 `no_results`。

内容检测之前，必须先解开 Runtime envelope：

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

适配器无法解析响应时，应返回 parse failure。解析实现的错误不能被解释为检索没有结果。

修复后还发生过一次回归：清理调试代码时使用的宽泛正则，同时删除了解包逻辑。此后增加了以下约束：

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

### 2.6 代理依赖与基础设施故障

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

这使相同代码随代理进程存活状态表现出不同结果，单独检查业务实现无法解释这种变化。

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

排查时需要区分代码行为与基础设施状态：

```text
关闭窗口
≠
退出代理进程
```

`reliable_web_search` 可以正确识别代理故障,却不能自动恢复一个已经退出的代理服务。

搜索层能够识别依赖故障、隔离影响并选择后续路径；恢复已经退出的代理服务，则属于另一层运维职责。

### 2.7 JSONL 调用审计

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

单一失败消息无法说明实际调用的 Provider、尝试次数、参数删减、错误类型、耗时和是否取得可用内容。

结构化记录将这些信息关联到同一次调用，使排查能够依据执行过程进行。

日志中刻意不保存 API Key、Authorization Header、完整 Provider 原始响应和完整搜索正文。

不过 query 本身也可能包含姓名、文件路径、项目代号等敏感信息。正式部署时,日志系统仍应支持关闭 query 日志、对 query 脱敏、只保存 query hash、设置日志保留期限。

因此，审计范围既要满足故障定位，也需要受隐私要求和日志保留期限约束。

---

<div class="v-figure">
<svg viewBox="0 0 1000 420" role="img" aria-label="可靠搜索 Runtime Gate"><defs><marker id="gA" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#5d7f96"/></marker><marker id="gR" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#a34a4a"/></marker></defs><text x="25" y="38" font-size="11" fill="#7b8b99" letter-spacing="2" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">RELIABLE WEB SEARCH · RUNTIME GATE</text><text x="25" y="62" font-size="11" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Agent 不能绕过 Gate；每一种失败都有类型、边界和下一步</text><ellipse cx="109" cy="260" rx="86" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="25,154 185,154 167,136 7,136" fill="#7aa6c6"/><polygon points="25,154 185,154 185,250 25,250" fill="#3f6f96"/><polygon points="185,154 167,136 167,232 185,250" fill="#2b5578"/><circle cx="45" cy="174" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="45" y="178" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">01</text><text x="105" y="198" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Agent 查询</text><text x="105" y="217" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">原始请求</text><path d="M189,224 L211,224" fill="none" stroke="#5d7f96" stroke-width="2" marker-end="url(#gA)"/><ellipse cx="299" cy="260" rx="86" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="215,154 375,154 357,136 197,136" fill="#78b7ae"/><polygon points="215,154 375,154 375,250 215,250" fill="#2f7f7a"/><polygon points="375,154 357,136 357,232 375,250" fill="#1f5f5b"/><circle cx="235" cy="174" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="235" y="178" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">02</text><text x="295" y="198" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Runtime Gate</text><text x="295" y="217" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">参数治理 · 权限</text><path d="M379,224 L401,224" fill="none" stroke="#5d7f96" stroke-width="2" marker-end="url(#gA)"/><ellipse cx="489" cy="260" rx="86" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="405,154 565,154 547,136 387,136" fill="#d2ad72"/><polygon points="405,154 565,154 565,250 405,250" fill="#9a7434"/><polygon points="565,154 547,136 547,232 565,250" fill="#77551f"/><circle cx="425" cy="174" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="425" y="178" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">03</text><text x="485" y="198" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Provider 路由</text><text x="485" y="217" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">多凭据 · 优先级</text><path d="M569,224 L591,224" fill="none" stroke="#5d7f96" stroke-width="2" marker-end="url(#gA)"/><ellipse cx="679" cy="260" rx="86" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="595,154 755,154 737,136 577,136" fill="#8fa7b6"/><polygon points="595,154 755,154 755,250 595,250" fill="#5c7383"/><polygon points="755,154 737,136 737,232 755,250" fill="#455c6c"/><circle cx="615" cy="174" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="615" y="178" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">04</text><text x="675" y="198" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">响应解析</text><text x="675" y="217" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">结构化错误</text><path d="M759,224 L781,224" fill="none" stroke="#5d7f96" stroke-width="2" marker-end="url(#gA)"/><ellipse cx="869" cy="260" rx="86" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="785,154 945,154 927,136 767,136" fill="#8fc0a9"/><polygon points="785,154 945,154 945,250 785,250" fill="#4f8a6f"/><polygon points="945,154 927,136 927,232 945,250" fill="#356a51"/><circle cx="805" cy="174" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="805" y="178" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">05</text><text x="865" y="198" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">证据可用</text><text x="865" y="217" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">JSONL 审计</text><rect x="25" y="330" width="950" height="52" rx="10" fill="rgba(163,74,74,.08)" stroke="rgba(163,74,74,.30)" stroke-dasharray="4 4"/><text x="45" y="352" font-size="10.5" fill="#8a4a4a" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">失败分类：503 / 429 → 有限重试或切换；auth → 换凭据；parse → fallback；no_results → 换索引或 Provider；全部失败 → 明确停止</text><text x="45" y="370" font-size="9.5" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">网络没连上、响应解析不了、Provider 真的返回空结果，是三种不同状态。</text></svg>
<p class="v-caption">图 1：可靠搜索的 Runtime Gate。Agent 不能绕过入口，失败类型决定下一步动作。</p>
</div>

## 3. 从 OpenClaw 插件到通用搜索运行时

原型解决了当时的调用问题，但其可复用部分仍与本地 OpenClaw 环境紧密耦合：

- 依赖 OpenClaw Runtime;
- Provider 路由写在插件内部;
- JSONL 路径固定在 workspace;
- 错误类型和返回结构服务于特定 Agent;
- 其他 Node.js 应用无法直接复用。

其中可独立抽取的共性包括：

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

独立运行时位于应用与多个搜索 API 之间，集中管理调用策略：

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

### 3.1 Provider registry：优先级、能力与配置检查

最初，服务选择依赖注册顺序，导致无需密钥但能力有限的 Provider 有时排在更合适的服务之前。

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

对未知名称给出相近候选，使配置错误能够被及时识别，避免静默忽略后继续使用非预期路由。

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

winner 确认后，运行时立即触发其余 Provider 各自的 `AbortController`，取消尚未完成的请求，以减少继续占用连接与消耗额度。`Promise.all()` 本身不提供这种取消传播。

#### `aggregate`

aggregate 并发收集各 Provider 的成功结果。当前版本实现了统一执行和状态诊断；URL canonicalization、跨 Provider 去重、融合排序与域名多样性控制仍未实现，因此不能将结果汇集等同于完成检索融合。

### 3.3 超时与底层请求取消的传播

早期实现使用:

```ts
Promise.race([providerPromise, timeoutPromise])
```

这种写法只终止上层等待，底层 `fetch` 仍可能继续执行。

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

取消需要传播至实际请求，否则仍会出现以下资源状态：

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

这些字段为重试、凭据切换、fallback、熔断计数与等待提供决策依据，并共同决定最终返回状态。

鉴权错误说明凭据存在问题，不应作为瞬态服务故障计入熔断器。网络错误、超时和 5xx 才用于反映此处的 Provider 健康状态。

熔断器有 closed、open、half-open 三种状态。失败达到阈值后:closed → open → 暂时跳过该 Provider → recovery timeout → half-open 试探 → 成功后 closed。

当前实现还验证了调用级配置确实进入 breaker，包括 `failureThreshold = 1`、`recoveryTimeout = 100ms`，避免配置仅存在于类型定义而未参与执行。

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

最终结果的来源与中间尝试路径因而可以分别追溯，避免只保留成功 Provider 而丢失恢复过程。

缓存命中也会明确返回:

```ts
cacheHit: true
```

缓存命中保留与实时调用一致的主要字段，调用者可以按同一结果契约处理两种路径。

### 3.6 发布包入口与执行契约验证

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

## 4. v0.4.0：多凭据路由、CLI 与 MCP

v0.4.0 将路由问题进一步扩展到凭据层：同一个 Provider 可能配置多个凭据，需要明确它们的接替顺序与失败隔离方式。

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

多凭据用于备用、团队 workspace、Key rotation 和故障隔离。默认策略是故障接替，没有实现跨账号轮询消耗额度。

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

### 4.4 环境变量临时路由

如果环境中存在:

```bash
export TAVILY_API_KEY="..."
```

系统将其构造成高优先级的临时 `tavily.env` 路由，不写入 `config.json` 或 `credentials.json`，并与本地相同 Key 去重。该路由在 `routes list` 中标为 `[env]`，不能由 `credentials remove` 删除；移除环境变量后，路由随之消失。

CI、服务器和临时开发环境可以直接注入 Key,无需改写本地凭据文件。

### 4.5 凭据与配置分离

v0.4.0 将数据分开保存:`config.json` 放 routes、优先级、启停状态等非敏感配置;`credentials.json` 放 credential profiles 和 API Key。

安全约束包括:Unix 下 `credentials.json` 权限为 `0600`;API Key 不进入 Host MCP 配置、`AttemptRecord`、stdout、日志或诊断输出;setup 和 doctor 只显示 label 或掩码;v1 → v2 迁移会创建备份;损坏文件不会被自动覆盖。

### 4.6 MCP 工具的多宿主接入

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

Agent 始终调用同一个工具并读取结构化结果，Provider 选择、凭据接替与 fallback 则由下层运行时统一处理。

在 OpenClaw 实机验证中,新版 MCP 工具最终返回:

```text
providerPath: ["tavily.default"]
routeId: tavily.default
status: success
credentialProfile: default
```

迁移时，旧 `0.1.0` 插件仍注册了同名工具，导致模型先调用旧 Gemini 路径，再调用新版 MCP。禁用旧插件、仅保留 `rws mcp` 后，搜索入口才真正统一。

这一问题说明，接入验证还需检查工具名称及其注册所有权；新工具单独运行正常，并不足以证明宿主实际调用了它。

---

## 5. 当前范围与仍待处理的问题

从本地原型到通用运行时，执行行为经历了以下三个阶段。

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

当前实现的能力边界仍然明确。

当前版本还没有跨 Provider URL canonicalization、复杂重复结果融合、相关性重排序、域名多样性控制、round-robin 或健康权重、完整用量统计与成本预算、云端凭据管理、Web UI、通用 telemetry hooks。

后续扩展顺序将依据实际使用中暴露的故障确定。现阶段先发布并持续使用，以观察哪些问题足以要求新的机制。

例如，重复链接需要结果融合，实例间状态污染需要更强隔离，费用难以控制时需要预算；Web UI 则应由具体交互需求驱动。

在扩展这些能力之前，首先保证现有契约能够通过测试复核。

### 分层诊断中的几类实际误判

排障中耗时较多的部分，是确定相似表象对应的实际故障层级：

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

`tail` 曾同时展示旧 `transport_failure` 与新的成功记录；wrapper 曾读取错误的响应层级；关闭代理窗口也曾使后台进程退出。新版 MCP 正常运行后，旧插件仍可能抢占同名工具。这些现象都表现为搜索异常，却需要在不同位置修复。

因此，系统需要报告具体执行状态。仅有“成功/失败”两种描述，无法区分这些原因。

一次调用的结果至少应支持回答以下问题：

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

记录覆盖这些问题后，后续故障才有可追溯的定位依据。

---

## 可靠性的范围：可诊断、可恢复与明确停止

从 OpenClaw 插件到 `reliable-web-search`，参数治理、权限、代理依赖、响应封装、取消、路由与工具注册逐步形成了统一的执行契约。CLI 与 MCP 则将这套能力暴露给其他宿主。

```text
一个 Agent 绕不过去的治理入口
一套能准确描述故障的状态语义
一个超时后不会偷跑资源的执行层
一条能根据错误选择 retry、credential failover、provider fallback 或停止的路由
一份能回溯每次 Provider 尝试的诊断记录
一个可以通过 CLI、MCP 和 SDK 复用的统一接口
```

这套运行时仍不能保证每次取得资料，但可以保留失败类型、执行边界和已有证据，再依据预算选择重试、切换或停止。调用未完成时，结果也应准确保留失败状态，避免被后续流程当作检索成功。

当单个 Provider、Key 或网络路径故障时，其他可用路线为恢复提供了条件；是否继续执行，仍受配置和调用预算约束。

---

<a href="https://github.com/leecdiang/reliable-web-search/tree/main" target="_blank" class="glass-pill"><i class="fab fa-github"></i> leecdiang/reliable-web-search</a>
