---
title: 我搭的不是 Agent,而是一套工作方式
date: 2026-06-11 13:33:00
description: 关于 Main Agent、Code Lab、证据链、审批流,以及如何让一个不完美的模型参与长期任务。
keywords: Agent架构,工作流设计,证据链,审批流,Validator,Obsidian看板,长期任务管理,OpenClaw,cost-aware
categories:
  - Digital Anatomy
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
> **Abstract**  
> This post is not a tutorial on building an agent. It is a reflection on turning AI from a chat interface into a personal workflow system. Through the deployment of Main Agent, Code Lab, evidence tracking, approval queues, validators, and Obsidian dashboards, I gradually realized that the real value of an agent is not full automation, but structured collaboration. A useful agent does not replace human judgment; it participates in a workflow where facts are traceable, decisions are explicit, and failures can be detected.


---


## 这不是一篇教程。

我不想把这次部署包装成某种一键复刻的效率神话。如果只看最后的成品，它看起来很像一个"AI 留学助手" : 它会晨检，会查学校，会整理 deadline，会同步 Obsidian，还会把待审批事项写进 Mac 备忘录等等等。

但这次部署真正让我开心的，是我第一次比较完整地把一个 AI 工具放进了自己的长期工作流。它更像一个被约束、拆分、审计、校验、可视化之后的工作台，而不是一个能检索的聊天窗口。

回头看，这次我做的事情可以概括成一句话:

> 我搭的不是 Agent，而是一套工作方式

这套工作方式的核心是让 AI 参与我的长期任务: 它搜索、整理、生成候选项、提醒我、维护文件。但必须留下证据，接受校验，走审批流，也得承认失败——不能因为"看起来完成了"就被我信任。

这篇文章就是这次部署的复盘。

---

## 1. 我不是在搭一个留学 Agent，而是在搭一个个人工作台

我确实有一个很具体的需求: 我正在准备未来的留学申请，需要管理学校列表、项目要求、APS、IELTS、GRE、推荐人、材料时间线、CV 和 SOP 等一堆东西。

这类任务麻烦在它不是一次性问答。

问"某个学校的 GRE 要不要交"，AI 很容易给出一个看起来有用的回答。但留学申请真正麻烦的地方在于这些答案会不断变化、互相关联，还会影响后续决策。

deadline 可能变，语言要求可能和学院要求不一样，官方页面可能更新，APS 审核政策可能有新程序。你的背景也会随着实习、项目、成绩、竞赛而变化。这些信息最终要进入一个长期决策系统: 哪些学校是 Reach，哪些是 Target，哪些是 Safety; 哪些信息已经核验，哪些只是低置信度; 哪些需要马上行动，哪些只是以后再看。

所以我慢慢意识到，除了尽早摆脱 Gemini 网页版等对话聊天助手，我需要一个能承载长期任务的个人工作台，而不是一个能回答留学问题的 Agent。选择转向 agent 的一大原因是最近被 Gemini 气的不行，觉得它的能力和效率满足不了我的需求。

这个工作台后来长成了这样的结构:

{% mermaid %}
graph TD
    A[Personal Workbench]

    A --> B[Agent Layer]
    B --> B1[Main Agent]
    B1 --> B1a[长期规划 / 晨检 / 审批]
    B1 --> B1b[策略 / 资料库维护]
    B --> B2[Code Lab]
    B2 --> B2a[代码 / 脚本 / Validator]
    B2 --> B2b[Obsidian 生成逻辑]

    A --> C[Evidence Layer]
    C --> C1[source]
    C --> C2[run]
    C --> C3[claim]
    C --> C4[approval]

    A --> D[Control Layer]
    D --> D1[Validator]
    D1 --> D1a[检查格式 / 语义]
    D1 --> D1b[生成文件健康状态]

    A --> E[View Layer]
    E --> E1[Obsidian / 可视化看板]
    E --> E2[Mac 备忘录 / 轻提醒副本]

    A --> F[Source of Truth]
    F --> F1[OpenClaw Workspace]
    F1 --> F1a[事实源 / 正式记录]
{% endmermaid %}


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


留学只是第一个被跑通的场景。更大的目标是: 把 AI 放进我的工程、学习、毕业设计、博客、申请这些长期任务之间，让它成为一个稳定的工作流节点，而不是一个随时失忆、随时飘走的聊天框。


---

## 2. 为什么一个 Agent 不够:Main Agent 与 Code Lab 的分工

为了在一开始确立正确的系统架构，我参考了两篇关于 single-agent 与 multi-agent 的论文，它们直接影响了我对这套系统的设计判断。

> **论文一:When Single-Agent with Skills Replace Multi-Agent Systems and When They Fail**
> arXiv: [https://arxiv.org/abs/2601.04748](https://arxiv.org/abs/2601.04748)
>
> 这篇论文的核心是如果一个 multi-agent system 里的多个 agent 只是承担不同角色，并通过显式通信协作，那么这些角色可以被编译成一个 single-agent 内部可调用的多个 skills。论文的结论是: 在共享上下文、同一模型 backbone、任务流程可以序列化的情况下，single-agent with skills 往往可以用更低的 token、延迟和 API 调用成本，达到接近甚至相当的效果。但它也指出，skill library 不能无限扩张; 当 skills 数量过多，尤其是语义相似时，模型的 skill selection 会出现明显退化。论文中这个分界点大概在 20 个 skills，但具体分界点与不同 skill 易混淆程度和是否采用了正确的 skills  路由器有关。


> **论文二:Single-Agent LLMs Outperform Multi-Agent Systems on Multi-Hop Reasoning Under Equal Thinking Token Budgets**
> arXiv: [https://arxiv.org/abs/2604.02460](https://arxiv.org/abs/2604.02460)
>
> 这篇论文的核心观点是: 很多 multi-agent 系统看起来更强，可能只是因为它用了更多 test-time compute。多个 agent 轮流发言、互相总结、互相修正，本质上消耗了更多 thinking tokens、更多上下文传递和更多中间推理。当把 reasoning-token budget 控制到相同水平时，single-agent 在多跳推理任务中经常可以匹配甚至超过 multi-agent。这说明，multi-agent 的优势不应被默认归因于"架构更聪明"，而要先排除计算预算、上下文组织和通信开销带来的影响。


这两篇论文放在一起，给了我一个部署原则:**不要因为多 agent 看起来很厉害，就把系统拆成很多 agent。**

一开始我想的是：做一个留学 Agent、一个芯片 Agent、一个代码 Agent、一个博客 Agent。后面再按需部署更多。这种拆法按主题划分: 留学一类，数字 IC 一类，代码一类，博客一类。

但真正开始设计后我发现，这样切得太碎。

>主题不是最重要的边界，**职责才是**。

按主题拆的话，"博客 Agent"既要写作、改 Hexo 主题、还要管理 Git; "留学 Agent" 既要做长期规划、搜索资料、整理文档、甚至改本地文件; "芯片 Agent" 既要讲知识，又要参与毕业设计文档管理。每个 agent 都要参与太多杂事，边界反而更模糊。

论文里关于 single-agent with skills 的观点解释了这个问题: 如果多个 agent 之间没有真正独立的状态、权限、工具链或决策目标，只是换几个角色说同一套话，那它们未必需要被拆开。很多时候让一个 agent 拥有少量边界清晰的 skills，比让一组 agent 互相转述上下文更合理。

但另一方面，我也没有让一个 Agent 什么都做。

因为在真实部署中，问题不只是推理能力，还有权限、风险和执行边界。一个负责长期规划和记忆的 agent，不应该同时拥有随手改代码、执行 shell、重写配置文件的能力。否则它一旦理解错上下文，就可能把策略判断和工程执行混在一起，造成很难追踪的副作用。

所以我最后没有按照主题拆分，而是按照职责和风险拆分。系统收敛成两个常驻角色:

```text
Main Agent = 长期规划 / 策略 / 资料库 / 记忆 / 决策支持
Code Lab = 工程执行 / 脚本 / 测试 / 本地工具维护
```

Main Agent 是长期工作流中枢。它负责帮我理解目标、拆分路径、维护资料库、生成待办、管理审批。它可以处理留学规划、数字 IC 学习、毕业设计、实习项目分析、长期资料归档。它的价值在于"想清楚"和"记下来"。

更准确地说，Main Agent 承担的是 **规划层、解释层和记忆层** 的工作。它应该帮我回答:

```text
这个目标应该怎么拆？
哪些信息值得长期保存？
哪些任务应该交给 Code Lab 执行？
哪些决策需要我本人确认？
哪些资料还只是草稿，不能写入正式记录？
```

但 Main Agent 不应该直接动工程。它不应该递归扫描代码仓库，不应该重写脚本，不应该随手改项目文件，也不应该把未经审批的信息写进正式资料库。它更像一个 PM、研究助理和长期笔记管理员的结合体。它可以提出方案、生成任务单、记录决策，但不应该越过边界直接执行危险操作。

---

Code Lab 则是工程执行器。它负责 Apple-Health-Pro、Hexo 博客、Obsidian 同步脚本、validator、CSS、Git、测试和本地 shell。它可以改文件，可以跑命令，可以调试，可以修脚本。它的价值在于能够把明确的工程任务做完，并留下可验证的证据。

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

但 Code Lab 不应该替我做留学策略判断，也不应该把"信息判断"直接写成"正式事实"。它可以执行 Main Agent 派发的工程任务，也可以把执行结果反馈回来，但它不应该直接决定我的 APS 路线、学校优先级、申请策略或长期学习方向。

这层分工听起来有点形式主义，但它其实非常关键。

如果 Main Agent 同时负责策略判断和脚本维护，它会变成一个不受控的"万能助手"。它可能在晨检失败时顺手重写脚本，也可能在理解错上下文时污染正式文件。如果 Code Lab 也开始替我判断 APS 路线、学校优先级、申请策略，那代码执行和人生决策就混在一起了。

从 agent 架构角度看，这里需要隔离的是权限和风险，而不是"知识领域":

```text
上下文隔离：长期规划和工程执行的上下文不要互相污染。
权限隔离：能做策略判断的 agent，不必有本地执行权限。
风险隔离：低风险的信息整理和高风险的文件修改，应该在不同边界里。
```

这也是我最后没继续拆出"留学 Agent / 芯片 Agent / 博客 Agent"的原因。留学、芯片、博客这些主题，完全可以作为 Main Agent 内部的长期 skill 或资料库; 代码修改、脚本调试、Git 操作、本地测试这些，交给 Code Lab。前者是认知和记忆问题，后者是工程和执行问题。

最后我的结论是:

> 一个 Agent 不够，是因为不同职责需要边界;
> 太多 Agent 也不好，因为过度拆分制造通信成本、上下文损耗和选择混乱。
> 
> Agent 越强，越需要边界。
> 分工不是为了复杂，而是为了降低混乱。

对我来说，Main Agent 和 Code Lab 的分工刚好卡在中间。Main Agent 负责长期记忆、策略判断和任务分解;Code Lab 负责本地工程、代码修改和测试验证。按权限、风险和职责隔离，而不是按主题分裂。



---


## 3. 为什么光有记忆不够: 事实源、证据链和审批流

AI 的"记忆"很诱人——它似乎可以记住背景、偏好、项目、学校列表和长期目标。但在长期任务里，记忆不能当事实源。

它能提供上下文，但不能直接作为依据。它记得我说过"Purdue GRE 可能 optional"，但不能因为记得，就把这条写进正式 tracker。事实必须有来源、有时间、有置信度、有核验日期、有变更记录。

所以我们建立了一层 evidence layer，由四个 JSONL 文件构成:

```text
source_registry.jsonl
retrieval_runs.jsonl
fact_claims.jsonl
approval_queue.jsonl
```

`source_registry.jsonl` 记录来源本身:URL、标题、来源类型、检索时间、置信度。一个来源是官方页面、论坛帖子、项目手册还是非正式总结，意义完全不同。

`retrieval_runs.jsonl` 记录每次查了什么:query 是什么，用了什么工具，目的是什么，结论是什么。这解决的是"我到底有没有查过"这个问题。

`fact_claims.jsonl` 记录具体事实声明。比如某个项目 GRE optional、某个项目 IELTS writing 要求、某个 deadline 是估算还是官方确认。它把"资料"拆成可追溯的 claim。

`approval_queue.jsonl` 记录这些信息是否需要我介入。确认某条信息无变化时用 `no_action_required`。需要我行动是 `pending`。信息不足是 `needs_more_research`。路线选择——比如 APS 走 TestAS 还是标准面谈——是 `decision_item`，必须等我明确选。


---


第一次测试 Purdue GRE 政策时，Main Agent 口头说已经记录了 retrieval run、注册了 source、生成了 claim、写入了 approval queue。但 validator 一跑，四个 JSONL 文件全是空的。

如果没有 evidence layer，我可能以为晨检成功了。实际上它只更新了 human-readable summary，没形成机器可读的审计记录。这就是为什么后来所有晨检必须写入 JSONL。

还有一次，`approval_queue` 里本来要写"核验无变化，无需审批"，但 validator 不接受 `no_action_required`。Agent 为了让 validator PASS，改成了 `rejected`。

技术上通过了，语义上错了。

这说明 validator 不能只检查格式，还要保护语义。`rejected` 只能表示我明确拒绝，不能代替"无需改动"。否则以后复盘，系统会以为我拒绝过某个事实更新。

于是我们补齐了 status 语义:

```text
pending - 等待我审批
approved - 我已批准,但尚未应用
applied - 已写入正式 tracker / checklist / timeline
rejected - 只有我明确拒绝时使用
needs_more_research - 信息不足,不能写入正式 tracker
no_action_required - 核验无变化,无需人工审批
```


> AI 可以发现问题，但不能替我承担选择。
> 它可以生成 action item，但 decision item 必须留给我。
> 它可以干活，但必须留下证据。


---

## 4. 为什么光有 UI 不够:Obsidian 只是视图，不是系统本体

这次部署里，Obsidian 是很重要的一环。它让整个系统终于"看得见"。

我最终有了这些页面:

```text
Dashboard - Overview
Dashboard - Timeline
Dashboard - By Tier
Dashboard - Pending Approval
Board - Application Status
Schools/
```

![](我搭的不是Agent而是一套工作方式-20260612-002150.png)


Overview 是总控台，告诉我当前阶段、待审批、时间压力和下一步重点。Timeline 看 deadline 和时间顺序。By Tier 看选校梯度。Pending Approval 看待我确认的事项。Kanban 看申请流程状态:Research、Needs Verification、Shortlist、Preparing、Applying、Submitted、Archived。Schools 下面则是每个项目的单独页面。

现在我的理解:

- Timeline 看时间压力
- Kanban 看流程状态
- By Tier 看选校结构
- Overview 看今天该做什么
- Pending Approval 看等待我决定的事

别把所有信息塞进一个页面，也别幻想一个 Dashboard 解决所有问题。

更重要的是，Obsidian 不是事实源。

这点非常关键。Obsidian 再漂亮，也只是生成视图。Mac 备忘录再方便，也只是提醒副本。真正的事实源在 OpenClaw workspace 里，在 CSV、Markdown、JSONL、approval log、change log 里。

这层分离很重要，因为 UI 很容易让人产生错觉。一个页面看起来很完整，不代表系统可靠。一个看板颜色很漂亮，不代表背后的数据经过核验。一个学校卡片里有 deadline，不代表这个 deadline 一定来自官方来源。

所以我的原则变成:

```text
OpenClaw workspace = 事实源
Obsidian = 可视化看板 / 阅读副本
Mac Notes = 轻提醒副本
Excel/CSV = 结构化数据和快照
```

我可以在 Obsidian 里理解系统，但不应该绕过系统直接改事实。下一次同步时，这些手动修改也可能被覆盖。


> 一个好看的 Dashboard 不等于一个可靠的系统。
> Dashboard 只是仪表，事实源才是本体。


---

## 5. 为什么模型不够聪明也能用: 用 validator、脚本和流程约束模型

这次部署让我对模型能力有了更真实的感受。先对比下各家当前的 api 价格。


![](我搭的不是Agent而是一套工作方式-20260612-002215.png)


DeepSeek V4 Flash 便宜、快、上下文长、日常可用，但在复杂 agent 工作流里并不省心，经常要多改几次。没有多模态能力，所以识图、记忆检索、联网搜索等场景我接入了 Gemini 的 api，免费额度在这些场景基本用不完。

对于 DeepSeek，尤其是当任务变成多步骤执行时，它会犯一些经典错误:

```text
口头说完成，但实际没写 JSONL
工具报错后仍然汇报"写入完成"
把 rejected 当成 no_action_required
忘记脚本路径
用 fragile exact oldText 替换文件，结果失败
同步看板时写出 \n 或 \u000 这类转义污染
```

模型能力不够强，所以系统必须足够完善来包容这些不完美。

以 `DAILY_BRIEF.md` 的更新逻辑为例：

开始时，Main Agent 用精确文本替换更新每日简报:

```text
edit(oldText=..., newText=...)
```

这个方式鲁棒性很弱：日期、空格、emoji、换行，有一点点不同就失败。实际也确实失败了——它以为文件里是 2026-06-11 的版本，真实文件还是 2026-06-09 的，oldText 匹配不上。更糟的是，工具已经报错，它还是口头说"写入完成"。

后来我们把它改成 marker-based update:

```markdown
<!-- DAILY_BRIEF:BEGIN -->
这里是最新晨检摘要
<!-- DAILY_BRIEF:END -->
```

然后写了 `update_daily_brief.py`，以后只替换 marker 之间的内容。更新后必须读取前 80 行确认，确认成功后才能汇报完成。


类似的防线还有 validator。它检查 JSONL 格式、字段是否完整、status 是否符合语义、Obsidian 生成文件是否有坏转义、Kanban 是否出现错误列、学校页面 frontmatter 是否包含必要字段。不是为了显得高级，而是防止 Agent 口头完成、实际失败。


> 当模型不够可靠时，不要要求它"更自觉"。
> 要把它放进流程里，让它必须留下证据，必须通过校验，必须承认失败。


---

## 6. 留学申请只是第一个被跑通的场景

虽然这次最完整跑通的是留学申请，但我不想把这套系统定义成"留学 Agent"。

留学只是一个足够复杂、真实、容易出错的验证场景。有信息检索、官方来源、时间线、材料清单、个人决策、审批、可视化、长期维护。用它来测试这套工作流，很合适。

最后我们把"执行留学晨检"固化成了一个 skill。它不再是一个模糊指令，而是一套明确的 11 步工作流:

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

而且我们明确规定:SCHOOL_LIST 只读不改，除非我专门审批通过。validator FAIL 必须修复，不能跳过。脚本路径固定，Main Agent 只调用，不重写。`rejected` 只能表示我明确拒绝，`no_action_required` 才表示核验无变化。

这套流程后来跑通了几个真实测试:

- Purdue GRE policy: 核验无变化，进入 `no_action_required`。

- Purdue IELTS 小分: 确认 W6.0 / S6.0 满足要求，写入 evidence。

- APS 审核: 生成了 action_item 和 decision_item。比如材料清单需要补充，TestAS 060 vs 标准面谈则需要我自己决策。


这证明系统能处理"无变化的事实核验"，也能处理"需要行动"和"需要决策"的事项。

但它真正的意义不在于 Purdue，也不在于 APS。意义在于: 这套工作流可以迁移。

它以后可以服务我的工程项目，可以服务毕业设计，可以服务数字 IC 学习路径，可以服务博客内容管理，也可以服务实习项目分析。留学申请只是第一块被跑通的样板间。


---


## 7. 接下来它会服务工程、博客、毕业设计和长期学习

现在系统基本成型，我反而应该少折腾、多使用。

这也是这次部署最后一个重要结论。

系统搭到一定程度后容易陷入另一种陷阱: 继续加功能，继续调 UI，想接飞书、Telegram、iMessage、日历插件、全自动监控、更多 Agent、更多 Dashboard。每个功能看起来都合理，但也会把精力从真正的工作上带走。

现在我更愿意把这套系统看成一个阶段性可用的工作台。接下来它要服务具体产出。

在工程上，Code Lab 会继续维护 Apple-Health-Pro、Hexo 博客和各种同步脚本。规则也很明确: 先 `git status`，不要递归扫描，每轮最多读几个文件、跑几条命令，小步修改，小步提交。Code Lab 是工程执行器，不是人生规划师。

在留学上，Main Agent 会继续按 evidence-first workflow 执行晨检。它要关注 APS、推荐人、High priority 项目、IELTS/GRE/deadline 核验、CV_FACTS、SOP 主线等。但它不能越过审批流。

在毕业设计和学习上，Main Agent 更适合做长期路径规划和资料整理。比如数字 IC 学习路线、实习项目理解、毕业设计拆解，这些应该变成长期资料库和阶段性决策，而不是一次性问答。

在博客上，这套系统也会继续有用。Code Lab 可以维护 Hexo 和样式，Main Agent 可以帮我梳理文章结构、复盘经验、保存主题线索。但最终表达仍然是我的。

我现在对这套系统的理想使用方式是:

```text
Main Agent：帮我想清楚、记下来、形成决策流
Code Lab：帮我做出来、跑起来、修到稳定
Obsidian：让我看见
Evidence Layer：让一切有迹可循
Validator：让错误尽早暴露
```

这不是什么"全自动 AI 人生操作系统"。它更像一套被我慢慢磨出来的个人工作方式。

---

## 结尾: 把 AI 放回工作流里

回头看，这次部署让我最开心的是：我终于把 AI 放回了工作流里，而不是只"拥有了一个 Agent"。

以前我对 AI 工具的使用，更多是对话式的: 我问，它答; 我再问，它再答。这个模式很轻，很快，也很有用。但它不适合承载长期任务。长期任务需要状态，需要边界，需要历史，需要审计，需要可视化，需要失败处理，也需要人的决策位置。

现在这套系统仍然不完美。模型会犯错，脚本可能出 bug，Obsidian 看板以后也许还会坏，Main Agent 也可能偶尔忘记规则。但不同的是，错误不再完全漂浮在聊天里——它们会被 validator 发现，被 approval queue 拦住，被 evidence layer 留痕，被 Code Lab 修复。

我对 Agent 的理解也变得更具体了。

Agent 是我能组织进流程的执行者，不是一个替我生活的东西或永远正确的答案机器。它很有用，但我得知道什么该交给它、什么必须留给我。


>让 AI 参与我的长期任务，但不让它越过边界;
  让它替我处理重复劳动，但不替我承担判断;
  让它生成信息，但必须留下证据;
  让它执行流程，但必须接受校验。

如果你的部署遇到什么问题，可以写邮件给我，我们一起解决。


---


## TL;DR

I was building a workflow, not a single agent.

The key: keep AI accountable rather than just autonomous.  
Separate planning from execution, keep evidence trails, add approval gates, validate outputs, treat dashboards as views—not sources of truth.

A useful agent is one that can safely participate in my long-term work, not one that does everything for me.