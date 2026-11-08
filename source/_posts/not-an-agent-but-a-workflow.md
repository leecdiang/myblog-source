---
lang: zh-CN
title: 我搭的不是 Agent,而是一套工作方式
date: 2026-06-11 13:33:00
description: "记录 Main Agent 与 Code Lab 的职责划分，以及证据、审批、校验器和 Obsidian 视图的协作方式；通过实际失败案例分析长期任务中的状态与执行约束。"
keywords: Agent架构,工作流设计,证据链,审批流,Validator,Obsidian看板,长期任务管理,OpenClaw,cost-aware
categories:
  - Everyday Anatomy
image_width: max
etoc: true
tags:
  - OpenClaw
  - Agent
  - 工作流
  - AI
  - 思考
  - DeepSeek
---
<style>
.v-arch{--a-front:#ffffff;--a-top:#f5f5f7;--a-side:#e8e8ed;--a-border:rgba(0,0,0,.08);--a-title:#1d1d1f;--a-sub:#6e6e73;--a-accent:#0071e3;--a-chip:rgba(0,0,0,.045);--a-shadow:rgba(0,0,0,.10)}
@media (prefers-color-scheme: dark){.v-arch{--a-front:#1c1c1e;--a-top:#2c2c2e;--a-side:#141416;--a-border:rgba(255,255,255,.12);--a-title:#f5f5f7;--a-sub:#a1a1a6;--a-accent:#0a84ff;--a-chip:rgba(255,255,255,.08);--a-shadow:rgba(0,0,0,.45)}}
.v-arch .a-front{fill:var(--a-front);stroke:var(--a-border);stroke-width:1}
.v-arch .a-top{fill:var(--a-top)}
.v-arch .a-side{fill:var(--a-side)}
.v-arch .a-shadow{fill:var(--a-shadow);opacity:.18}
.v-arch .a-title{fill:var(--a-title)}
.v-arch .a-sub{fill:var(--a-sub)}
.v-arch .a-chip{fill:var(--a-chip)}
.v-arch .a-chip-text{fill:var(--a-title)}
.v-arch .a-accent{fill:var(--a-accent)}
.v-arch .a-spine{stroke:var(--a-border);stroke-width:1;stroke-dasharray:4 5}
.v-arch .a-dot{fill:var(--a-accent)}
.v-figure{padding:.6rem .7rem .45rem}
</style>

> **Abstract**  
> This development record examines a personal AI workflow for long-running tasks. Main Agent maintains planning and records, while Code Lab executes engineering work. Evidence files, approval states, validators, and generated Obsidian views make their actions traceable. Two observed failures, reporting unwritten records and substituting a semantically incorrect status to pass validation, motivated stricter execution and data contracts. The account distinguishes these deployment observations from broader claims about agent architecture.

---

## 申请管理中的长期任务需求

系统围绕留学申请提供晨检、院校查询、deadline 整理、Obsidian 同步和 Mac 备忘录待审批提醒。功能表面上接近申请助手，实现中却需要维护跨时间变化的资料与决策状态。

我关注的是这些动作能否形成连续流程：资料可以检索，政策更新有依据，失败能够定位到具体执行步骤。

因此，搜索、候选生成、提醒和文件维护需要与证据记录、校验和审批一起设计，不能只检验即时回答。

完成状态应由实际文件与执行记录支持，而非由 Agent 的自然语言汇报定义。

---

## 1. 长期申请任务的状态与依赖

我在准备留学申请，要同时管理学校、项目要求、APS、IELTS、GRE、推荐人、材料时间线、CV 和 SOP。

单次查询可以回答 GRE 要求，但后续政策变化还会影响选校、材料与时间安排，因此查询结果必须进入可更新的任务状态。

deadline、学院语言要求和 APS 程序可能调整，个人实习、项目、成绩与竞赛也会更新。选校梯度 Reach、Target、Safety 依赖这些信息，并需区分已核验与低置信度内容，再据时间压力安排行动。

当时我对 Gemini 网页版的能力和效率已经不满，反复对话也难以持续维护这些状态。因此，目标转向一个能记录资料、历史与任务依赖的工作台。

最终形成的结构如下：

<div class="v-figure">
<svg class="v-arch" viewBox="0 0 880 500" role="img" aria-label="PERSONAL WORKBENCH · LAYERED CONTROL"><text x="40" y="34" font-size="10.5" font-weight="600" fill="var(--a-sub)" letter-spacing="1.6" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">PERSONAL WORKBENCH · LAYERED CONTROL</text><text x="40" y="56" font-size="11" fill="var(--a-sub)" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">Agent 只是其中一层；证据、控制与事实源决定了它能不能被信任</text><line class="a-spine" x1="48" y1="84" x2="48" y2="466"/><rect class="a-front" x="80" y="84" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="98" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="115" r="4"/><circle class="a-chip" cx="110" cy="115" r="14"/><text class="a-title" x="110" y="119" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">01</text><text class="a-title" x="136" y="110" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">View Layer</text><text class="a-sub" x="136" y="129" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">Obsidian · Mac 备忘录</text><rect class="a-chip" x="670" y="102" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="119" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">只读视图</text><rect class="a-front" x="80" y="164" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="178" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="195" r="4"/><circle class="a-chip" cx="110" cy="195" r="14"/><text class="a-title" x="110" y="199" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">02</text><text class="a-title" x="136" y="190" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">Agent Layer</text><text class="a-sub" x="136" y="209" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">Main Agent · Code Lab</text><rect class="a-chip" x="670" y="182" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="199" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">职责与权限</text><rect class="a-front" x="80" y="244" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="258" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="275" r="4"/><circle class="a-chip" cx="110" cy="275" r="14"/><text class="a-title" x="110" y="279" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">03</text><text class="a-title" x="136" y="270" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">Control Layer</text><text class="a-sub" x="136" y="289" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">Validator · 健康检查</text><rect class="a-chip" x="670" y="262" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="279" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">格式与语义</text><rect class="a-front" x="80" y="324" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="338" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="355" r="4"/><circle class="a-chip" cx="110" cy="355" r="14"/><text class="a-title" x="110" y="359" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">04</text><text class="a-title" x="136" y="350" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">Evidence Layer</text><text class="a-sub" x="136" y="369" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">source · run · claim · approval</text><rect class="a-chip" x="670" y="342" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="359" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">可追溯记录</text><rect class="a-front" x="80" y="404" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="418" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="435" r="4"/><circle class="a-chip" cx="110" cy="435" r="14"/><text class="a-title" x="110" y="439" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">05</text><text class="a-title" x="136" y="430" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">Source of Truth</text><text class="a-sub" x="136" y="449" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">OpenClaw workspace</text><rect class="a-chip" x="670" y="422" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="439" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">正式事实源</text><text x="40" y="486" font-size="9.5" fill="var(--a-sub)" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">2D 分层：层级只由顺序和缩进表达，不用透视和阴影。</text></svg>
<p class="v-caption">图 1：个人工作台的分层控制。Agent 只是其中一层，证据、控制与事实源决定它能否被信任。</p>
</div>

```text
System Structure

Main Agent:长期规划、晨检、审批、策略、资料库维护
Code Lab:代码项目、脚本、validator、Obsidian 生成逻辑
Evidence Layer:source → run → claim → approval
Validator:检查格式、语义和生成文件健康状态
Obsidian:可视化看板
Mac 备忘录:轻提醒副本
OpenClaw workspace:事实源
```

申请是首先跑通的场景，后续计划覆盖工程、学习、毕业设计与博客。跨场景复用的对象是状态和记录机制，以减少每次重新建立上下文的成本。

---

## 2. 按职责与权限拆分执行角色

设计时，我参考了两篇 single-agent 与 multi-agent 论文。

> **论文一:When Single-Agent with Skills Replace Multi-Agent Systems and When They Fail**
> arXiv: [https://arxiv.org/abs/2601.04748](https://arxiv.org/abs/2601.04748)
>
> 这篇论文的核心是如果一个 multi-agent system 里的多个 agent 只是承担不同角色，并通过显式通信协作，那么这些角色可以被编译成一个 single-agent 内部可调用的多个 skills。论文的结论是: 在共享上下文、同一模型 backbone、任务流程可以序列化的情况下，single-agent with skills 往往可以用更低的 token、延迟和 API 调用成本，达到接近甚至相当的效果。但它也指出，skill library 不能无限扩张; 当 skills 数量过多，尤其是语义相似时，模型的 skill selection 会出现明显退化。论文中这个分界点大概在 20 个 skills，但具体分界点与不同 skill 易混淆程度和是否采用了正确的 skills  路由器有关。

> **论文二:Single-Agent LLMs Outperform Multi-Agent Systems on Multi-Hop Reasoning Under Equal Thinking Token Budgets**
> arXiv: [https://arxiv.org/abs/2604.02460](https://arxiv.org/abs/2604.02460)
>
> 这篇论文的核心观点是: 很多 multi-agent 系统看起来更强，可能只是因为它用了更多 test-time compute。多个 agent 轮流发言、互相总结、互相修正，本质上消耗了更多 thinking tokens、更多上下文传递和更多中间推理。当把 reasoning-token budget 控制到相同水平时，single-agent 在多跳推理任务中经常可以匹配甚至超过 multi-agent。这说明，multi-agent 的优势不应被默认归因于"架构更聪明"，而要先排除计算预算、上下文组织和通信开销带来的影响。

这些工作使我优先检查状态、工具与权限是否独立，再决定是否需要增加常驻 Agent。

最初方案按领域拆分留学、芯片、代码和博客角色。

这种划分却将异质职责留在同一角色内：博客同时涉及写作、主题与 Git，申请同时涉及规划、检索、归档和文件修改。

领域边界没有自动形成执行权限边界。

芯片角色也同时承担知识解释和毕业设计文档维护，进一步增加职责交叉。

Skills 方案提供了另一种组织方式：若角色没有独立状态、权限、工具链或目标，可以先由同一 Agent 内的少量明确 Skills 承担，减少上下文转述成本。其适用性仍受论文列出的共享上下文和可序列化条件限制。

工程执行则需要单独隔离。规划与记忆维护若同时具备任意改代码、运行 shell 和重写配置的权限，理解错误便可能直接改变工程状态，且难以区分决策与执行责任。

最终保留 Main Agent 与 Code Lab 两个常驻角色，按职责和风险划定权限。

```text
Main Agent = 长期规划 / 策略 / 资料库 / 记忆 / 决策支持
Code Lab = 工程执行 / 脚本 / 测试 / 本地工具维护
```

Main Agent 负责目标解释、路径分解、资料库、待办与审批，覆盖申请、数字 IC 学习、毕业设计、实习分析及归档。领域知识作为任务上下文保留，不再各自建立执行角色。

它承担规划、解释和记忆，主要回答这些问题：

```text
这个目标应该怎么拆？
哪些信息值得长期保存？
哪些任务应该交给 Code Lab 执行？
哪些决策需要我本人确认？
哪些资料还只是草稿，不能写入正式记录？
```

Main Agent 可以生成方案、任务单与决策记录，但不直接扫描代码仓库、修改脚本或项目，也不将未经审批的信息写入正式资料库。

---

Code Lab 负责 Apple-Health-Pro、Hexo、同步脚本、validator、CSS、Git、测试与本地 shell。其交付对象是文件修改、执行结果和可核查的验证证据。

Code Lab 应该回答的是另一组问题:

```text
当前 Git 状态是什么？
测试是否通过？
哪个脚本失败了？
改了哪些文件？
diff 是否最小？
能否复现问题？
是否需要回滚？
```

APS 路线、学校优先级、申请策略和学习方向仍由规划与个人决策处理。Code Lab 执行工程任务并返回结果，不能将信息判断直接升级为正式事实。

隔离的目的是限制跨职责副作用，例如晨检失败时由规划角色自行重写脚本，或由执行角色直接更改选校策略。

因此，这里的架构边界依据权限、风险与职责，而非知识主题。

```text
上下文隔离：长期规划和工程执行的上下文不要互相污染。
权限隔离：能做策略判断的 agent，不必有本地执行权限。
风险隔离：低风险的信息整理和高风险的文件修改，应该在不同边界里。
```

申请、芯片和博客可作为 Main Agent 内部 Skills 或资料库；代码、脚本、Git 与测试交给 Code Lab。这样保留领域上下文，同时集中工程执行。

两个角色是此次部署的具体折中：过多拆分增加通信与选择成本，完全合并则削弱权限隔离，不能由角色数量本身判断架构优劣。

这一分工分别保存长期记忆与策略，以及本地实现与验证的责任。

---

## 3. 证据层、事实声明与审批状态

模型记忆提供上下文，不能独立充当事实核验依据。

“Purdue GRE 可能 optional”可以引导查询，但进入正式 tracker 以前，需要来源、时间、置信度、核验日期和变更记录。

为此建了四个 JSONL 证据文件。

```text
source_registry.jsonl
retrieval_runs.jsonl
fact_claims.jsonl
approval_queue.jsonl
```

`source_registry.jsonl` 记录 URL、标题、来源类型、检索时间和置信度，区分官方页面、手册、论坛与非正式总结的证据地位。

`retrieval_runs.jsonl` 记录 query、工具、目的与结论，用于追溯检索是否实际发生及其执行条件。

`fact_claims.jsonl` 把项目 GRE、IELTS writing 要求和 deadline 等信息拆成可追溯声明，并区分估算与官方确认。

`approval_queue.jsonl` 保存处理状态：无变化为 `no_action_required`，待行动为 `pending`，信息不足为 `needs_more_research`；APS 的 TestAS 或标准面谈等路线选择为 `decision_item`，等待本人决定。

---

第一次测试 Purdue GRE 政策时，Main Agent 口头说已经记录了 retrieval run、注册了 source、生成了 claim、写入了 approval queue。但 validator 一跑，四个 JSONL 文件全是空的。

可读摘要被更新，并未产生机器可读审计记录。后续晨检强制写入 JSONL，使完成状态能够与实际产物核对。

还有一次，`approval_queue` 里本来要写"核验无变化，无需审批"，但 validator 不接受 `no_action_required`。Agent 为了让 validator PASS，改成了 `rejected`。

格式验证通过，但状态含义与实际操作不一致。

`rejected` 只表示明确拒绝，不能表示无需改动。否则，历史记录会产生并未发生的审批事件。验证器因此还需保护状态语义，而非只检查枚举值合法。

于是我们补齐了 status 语义:

```text
pending - 等待我审批
approved - 我已批准,但尚未应用
applied - 已写入正式 tracker / checklist / timeline
rejected - 只有我明确拒绝时使用
needs_more_research - 信息不足,不能写入正式 tracker
no_action_required - 核验无变化,无需人工审批
```

Agent 可以收集证据和生成行动项，个人路线选择则通过明确决策进入记录。

---

## 4. 事实源与生成视图的分离

Obsidian 承担可视化与检索入口，把分散状态组织为可查看页面。

最终生成了这些页面：

```text
Dashboard - Overview
Dashboard - Timeline
Dashboard - By Tier
Dashboard - Pending Approval
Board - Application Status
Schools/
```

![](我搭的不是Agent而是一套工作方式-20260612-002150.png)

Overview 汇总阶段、待审批、时间压力和下一步；Timeline 按 deadline 排序，By Tier 看选校梯度。Pending Approval 集中待确认事项，Kanban 按 Research、Needs Verification、Shortlist、Preparing、Applying、Submitted、Archived 展示流程，Schools 下则是一校一项目的页面。

不同视图分别呈现时间、选校结构和审批，避免同一页面同时承担全部查询目标。

OpenClaw workspace 中的 CSV、Markdown、JSONL、approval log 和 change log 保存正式状态；Obsidian 与 Mac 备忘录则保存生成视图和提醒副本。

页面完整性不能证明内容已核验。deadline 的来源和核验情况仍应回到工作区记录。

```text
OpenClaw workspace = 事实源
Obsidian = 可视化看板 / 阅读副本
Mac Notes = 轻提醒副本
Excel/CSV = 结构化数据和快照
```

直接修改生成视图会绕过记录流程，也可能在同步时被覆盖，因此事实更新应进入正式状态层。

---

## 5. 以更新契约和验证器约束模型错误

部署时的 API 价格对比如下。

![](我搭的不是Agent而是一套工作方式-20260612-002215.png)

在这次部署中，DeepSeek V4 Flash 的成本、速度与上下文适合日常任务，但复杂流程仍需反复修正。识图、记忆检索和联网场景接入 Gemini API，其免费额度在当时用法下基本够用；DeepSeek 缺少多模态能力是这一配置的原因之一。

多步骤执行暴露了以下问题：

```text
口头说完成，但实际没写 JSONL
工具报错后仍然汇报"写入完成"
把 rejected 当成 no_action_required
忘记脚本路径
用 fragile exact oldText 替换文件，结果失败
同步看板时写出 \n 或 \u000 这类转义污染
```

这类失败需要执行层约束，单纯加强提示词无法验证实际文件状态。

以 `DAILY_BRIEF.md` 的更新逻辑为例：

开始时，Main Agent 用精确文本替换更新每日简报:

```text
edit(oldText=..., newText=...)
```

精确替换依赖日期、空格、emoji 与换行一致。一次更新按 2026-06-11 匹配，实际文件停在 2026-06-09，导致工具报错；Agent 仍汇报完成，说明执行返回未正确约束最终状态。

后来我们把它改成 marker-based update:

```markdown
<!-- DAILY_BRIEF:BEGIN -->
这里是最新晨检摘要
<!-- DAILY_BRIEF:END -->
```

改用 `update_daily_brief.py` 仅替换 marker 区间，更新后读取前 80 行核对，读取成功后才能报告完成。

validator 检查 JSONL 格式、字段、status 语义、Obsidian 转义、Kanban 列和学校 frontmatter。它验证产物是否满足契约，不能由模型自述替代。

写后读取与语义校验共同建立完成证据，使错误有机会在后续同步和决策前暴露。

---

## 6. 以申请晨检验证工作流

申请同时包含检索、证据核验、时间线、材料和个人选择，适合作为长期状态管理的部署案例。

后来把“执行留学晨检”固化成 Skill，按明确的 11 步执行：

```text
写入 retrieval_runs.jsonl
写入 source_registry.jsonl
写入 fact_claims.jsonl
写入 approval_queue.jsonl
用 update_daily_brief.py 更新 DAILY_BRIEF.md
读取前 80 行确认
更新 PENDING_APPROVAL.md
跑 validator
同步 Mac 备忘录
同步 Obsidian
汇报全部结果
```

SCHOOL_LIST 默认只读，修改需要专门审批；validator FAIL 不能跳过；Main Agent 只调用固定脚本，不重写实现。`rejected` 与 `no_action_required` 继续保留各自的审批语义。

这套流程后来跑通了几个真实测试:

- Purdue GRE policy: 核验无变化，进入 `no_action_required`。

- Purdue IELTS 小分: 确认 W6.0 / S6.0 满足要求，写入 evidence。

- APS 审核: 生成了 action_item 和 decision_item。比如材料清单需要补充，TestAS 060 vs 标准面谈则需要我自己决策。

这些测试覆盖无变化事实核验、行动需求和路线决策三种处理路径，支持该流程在已测场景下可执行。

工程、毕业设计、学习和博客可以复用证据、审批与验证机制，但仍需分别定义资料与验收条件，不能将申请场景的成功直接外推。

---

## 7. 从系统搭建转向持续使用

当前系统已阶段性可用，后续重点是检验它对具体任务的帮助。

继续扩展飞书、Telegram、iMessage、日历、监控或更多 Agent 与 Dashboard，会增加维护和接入成本，也占用申请与工程时间。新增能力因此需要对应实际任务需求。

使用效果应体现在持续产出和可维护记录上，而非组件数量。

Code Lab 继续维护 Apple-Health-Pro、Hexo 与同步脚本，每轮先检查 `git status`，限制读取和命令范围，避免递归扫描，再以小步修改和提交保留可追溯性。

Main Agent 依据证据流程晨检 APS、推荐人、High priority 项目、IELTS/GRE/deadline、CV_FACTS 和 SOP 主线，路线选择继续经过审批。

数字 IC、实习与毕业设计则采用长期资料和阶段任务组织，记录每次选择的依据。

博客维护中，Code Lab 负责 Hexo 和样式，Main Agent 整理结构、复盘和主题线索，最终表达由我决定。

日常使用时，我希望按下面的关系分配工作：

```text
Main Agent：帮我想清楚、记下来、形成决策流
Code Lab：帮我做出来、跑起来、修到稳定
Obsidian：让我看见
Evidence Layer：让一切有迹可循
Validator：让错误尽早暴露
```

---

## 失败记录与协作可靠性

即时问答便于快速获取信息，长期任务则还需要状态、历史和决策记录。引入这些结构后，也必须承担同步与语义约定的维护成本。

模型、脚本和看板仍可能失败。validator、approval queue 与 evidence 文件提供了定位和修复路径，但不能保证全部错误都被拦截；其有效性需要在长期使用中继续检查。

我会逐步交出重复整理与工程执行，把申请路线和重要选择保留在明确的个人决策环节。这套系统的边界由实际失败和验证结果继续调整。

部署中遇到问题，也可以写邮件给我交流。

---
