---
lang: zh-CN
title: 智算互联(中):重构可靠性--从强制无损到端网协同
date: 2026-06-28 22:39:00
categories: Silicon & Circuits
etoc: true
tags:
  - RoCE
  - RDMA
  - 拥塞控制
  - 数据中心网络
  - 智算网络
  - PFC
  - ECN
  - Ultra-Ethernet
  - TTPoE
  - In-Network-Computing
description: 从 RoCE、PFC、ECN 与 DCQCN 出发,拆解无损以太网的收益和代价,并比较 IRN、TTPoE 与 Ultra Ethernet 如何把可靠性、拥塞控制和多路径能力重新分配给端点、交换机与控制平面。
keywords: RoCE, RDMA, PFC, ECN, DCQCN, TTPoE, UET, 数据中心网络, 拥塞控制
---

> **Abstract - Part 2**
> PFC can protect Ethernet buffers while also spreading pauses upstream. This article separates fabric loss, end-to-end reliability, and ordering, then examines RoCE, IRN, TTPoE, and Ultra Ethernet. Each assigns recovery and congestion control differently across endpoints, switches, and the control plane.

{% note info %}
本文是「智算互联」系列中篇。<a href="/series/ai-interconnect/">查看系列目录 →</a><br>
上篇讨论通信墙与流量指纹；本文讨论传输与 Fabric；下篇将讨论网卡芯片、SerDes、PCIe 与光互联。
{% endnote %}

---

同步训练里，一个包丢了、一条流乱序了，或某个队列多等一会儿，都可能让 Collective 卡在最慢 Rank。为保持 RDMA（Remote Direct Memory Access，远程直接内存访问）的低时延、高吞吐，智算网络长期尽量避免交换机丢包。

代价也从这里开始。

PFC（Priority-based Flow Control）在队列接近溢出时暂停上游，但数据会改在上游积压，暂停可能继续传播；共享优先级的无关流也会被挡住。依赖关系形成循环时，还可能死锁。

另一种办法是允许 Fabric 丢包，让端点检测和恢复，再由端网协同调度减少拥塞。

可靠性仍然需要保证，只是执行恢复的位置变了。

---

## 一、为什么 AI 集群偏爱 RDMA

### 1. 传统网络栈的路径太长

普通 Socket 通信可能经历:

1. 应用缓冲区;
2. 用户态与内核态切换;
3. 内核 TCP/IP 协议栈;
4. 内核网络缓冲区;
5. 网卡 DMA;
6. 接收端反向执行类似路径。

零拷贝与卸载已经减少了传统栈的成本，但 CPU 介入、复制和上下文切换，对微秒级通信仍可能昂贵。

RDMA 让网卡访问已注册内存，以较少 CPU 参与完成远端读写和 Send/Recv。GPUDirect RDMA 继续打通网卡与 GPU 显存的路径，减少主机内存中转。

### 2. RoCEv2 把 RDMA 放到可路由以太网上

RDMA over Converged Ethernet version 2(RoCEv2)通常封装在 UDP/IP 之上,因此可以跨三层网络路由。它保留 RDMA 的队列对(Queue Pair, QP)、完成队列(Completion Queue, CQ)、内存注册和可靠连接等语义,同时利用成熟的 Ethernet 交换生态。

以太网生态给它提供了这些条件：

- Ethernet 设备和运维体系成熟;
- 可以与 IP 路由和 Clos Fabric 结合;
- 服务器、网卡和交换机供应商众多;
- 与 MPI、NCCL、存储和云平台生态衔接。

传统 RoCE 可靠连接对丢包、乱序比较敏感，部署时常结合 PFC、ECN 和端到端拥塞控制，尽量少走重传路径。

## 二、PFC、ECN 与 DCQCN 各自做什么

先按暂停、拥塞信号和调速分开看。

### 1. PFC:逐跳、按优先级暂停

Priority-based Flow Control(PFC)由 IEEE 802.1Qbb 定义。与暂停整个端口的传统 Pause Frame 不同,PFC 可以暂停某个优先级类别。

下游优先级队列达到阈值后，向上游发 PFC Pause，暂时阻止同优先级发送，为排空留出时间。

这种处理发生在相邻链路上：

- 响应发生在相邻链路之间;
- 不必等待端到端控制环路;
- 能防止队列立即溢出;
- 对不擅长处理丢包的旧式 RoCE 端点友好。

但暂停并不会消除数据，它只是把积压移到上游。

### 2. ECN:交换机标记拥塞,而不是立刻丢包

Explicit Congestion Notification(ECN)允许交换机在队列达到标记阈值时,为报文设置拥塞标志。接收端把拥塞信息反馈给发送端,发送端再降低速率。

标记的作用，是在溢出前把队列压力传给源端。

反馈要完成一圈，源端才会改变速率：

- 报文抵达接收端;
- 接收端生成反馈;
- 反馈返回发送端;
- 发送端调整发送速率。

400G、800G 在一圈反馈时间内仍能注入大量数据，阈值或控制参数没匹配好，队列就可能先涨起来。

### 3. DCQCN:为 RoCEv2 设计的端到端速率控制

Data Center Quantized Congestion Notification(DCQCN)由 Microsoft 等提出,用于大规模 RoCEv2 部署。交换机使用 ECN 标记,接收端向发送端发送 Congestion Notification Packet(CNP),发送端根据反馈调整速率。[Congestion Control for Large-Scale RDMA Deployments](https://www.microsoft.com/en-us/research/publication/congestion-control-for-large-scale-rdma-deployments/)

DCQCN 希望尽量在 PFC 触发前让源端减速，把 PFC 留作接收缓冲紧张时的保护。

{% mermaid %}
sequenceDiagram
    participant S as Sender RNIC
    participant SW as Congested Switch
    participant R as Receiver RNIC
    S->>SW: RoCE Data
    SW->>R: ECN-marked Data
    R-->>S: CNP / Congestion Feedback
    S->>S: Reduce sending rate
    Note over SW,S: If queue rises too fast, PFC may pause upstream before end-to-end loop converges
{% endmermaid %}

### 4. 三者作用在不同时间尺度

| 机制 | 作用位置 | 主要动作 | 优势 | 主要代价 |
| :--- | :------- | :------- | :--- | :------- |
| PFC | 相邻链路 | 暂停某优先级 | 反应快,避免瞬时丢包 | Pause 传播、HoL Blocking、死锁风险 |
| ECN | 交换机到端点 | 标记拥塞 | 不必立刻丢包,可提前反馈 | 依赖端到端控制环路 |
| DCQCN | 发送端 | 调整发送速率 | 改善吞吐、公平性和队列 | 参数复杂,对突发流量反应有限 |

实际 RoCE 常将三者组合。规模、线速和同步流量增加后，要同时配好控制参数与缓冲，维持低丢包的成本也会上升。

## 三、PFC 的代价怎样显现

### 1. Head-of-Line Blocking:无辜流量一起停车

队头阻塞(Head-of-Line Blocking, HoL Blocking)指的是:队列前部的报文被阻塞,后面的报文即使目的地和路径并不拥塞,也无法前进。

PFC 按优先级暂停,而不是按单条流暂停。如果多条流共享同一优先级和队列,一条热点流触发 Pause,其他流也可能被迫等待。

### 2. 暂停怎样向上游传播

A 出口拥塞，暂停 B；B 排不掉数据，又暂停 C。压力沿反向路径继续扩散，就可能形成 Congestion Tree。

这时会看到：

- 原本不经过热点出口的流也可能受影响;
- 故障定位变得困难,因为看到 Pause 的设备未必是拥塞根源。

### 3. 形成循环依赖以后，才可能死锁

多个队列互等下游释放缓冲，没有谁能先继续时，就可能发生 PFC Deadlock。

不能从启用 PFC 直接推断死锁，也不能只凭“配置正确”排除所有风险。

拓扑、路由、虚拟通道、优先级、缓冲和故障状态都会改变依赖。规模越大、路径越动态、业务越混杂，就越难证明它们始终没有循环。

Microsoft 的研究和后续 IRN 工作都把 Head-of-Line Blocking、Congestion Spreading 与偶发死锁列为 PFC 的核心问题。[Revisiting Network Support for RDMA](https://dl.acm.org/doi/10.1145/3230543.3230557)

### 4. 阈值要覆盖暂停生效前的数据

Pause 发出后，链路还会继续送来数据，Headroom 至少要考虑：

- 链路速率;
- 电缆与光纤传播时延;
- 交换机处理延迟;
- 对端响应时间;
- 最大帧长;
- 多个上游端口同时注入的情况。

阈值低，可能频繁暂停；阈值高，又可能来不及止住溢出。100G 到 400G、800G，同样的响应时间会带来更多在途字节，预留空间也要重算。

## 四、先拆开"有损、可靠、有序"三个概念

“交换机可以丢包”和“应用数据不可靠”，不能等同起来。

### 1. Fabric 是否允许丢包

这是交换网络层面的问题:队列满时,交换机是否可以 Drop 或 Trim 报文。

### 2. 端到端传输是否可靠

这是 Transport 的问题:如果报文丢失,端点是否检测、确认并重传,最终保证完整数据抵达。

### 3. 数据是否必须严格有序

这是 Ordering 的问题:应用是否要求所有报文严格按发送顺序交付,还是允许报文乱序到达后直接放入最终内存位置。

三者可以形成不同组合:

| Fabric | Transport | Ordering | 含义 |
| :----- | :-------- | :------- | :--- |
| 尽量无损 | 可靠 | 严格有序 | 传统 RoCE RC 的典型部署思路 |
| 允许丢包 | 可靠 | 严格有序 | 端点承担重传,但可能需要重排缓存 |
| 允许丢包 | 可靠 | 灵活有序 | 可使用包级多路径和直接数据放置 |
| 允许丢包 | 不可靠 | 不保证有序 | 适合能自行容错的特殊应用,不适合普通 RDMA 语义 |

新的 AI Transport 常采用表中第二或第三种组合：极端拥塞时允许 Fabric 丢包，由端点完成最终可靠交付。

## 五、为什么选择性重传改变了问题

Go-Back-N 丢了一个包，可能从缺口开始把后面一串重发，已到达的数据也占了一次带宽。

选择性确认与重传只补缺口，能减少高速有损 Fabric 上的重复工作。

这需要端点维护更多状态：

- 更精确的序列号和丢包检测;
- 更复杂的 Outstanding Packet 状态;
- 每包直接数据放置;
- 乱序完成管理;
- 更细粒度的计时器与重传队列;
- 防止重复写入或状态失配。

因此，容损也没有省掉全部硬件工作。部分复杂性从交换机缓冲和 PFC 运维，转移到了 RNIC Transport Engine。

## 六、IRN:PFC 不是 RDMA 的物理定律

SIGCOMM 2018 的 IRN（Improved RoCE NIC）把 RoCE 对 PFC 的依赖指向当时的 NIC 设计，而非 RDMA 语义的必然要求。

IRN 以有限接收窗口、选择性重传和丢包处理，让 RoCE 在无 PFC 条件下工作。论文的典型场景报告性能比传统 RoCE + PFC 高 6%–83%，NIC 资源开销约 3%–10%。数字只对应其实现与实验，不能直接推广到商用网络；它验证的是，这种可靠传输可以另做设计。

因此，全网强无损并非 RDMA 唯一可用的实现前提。

[Revisiting Network Support for RDMA](https://dl.acm.org/doi/10.1145/3230543.3230557)

## 七、TTPoE:垂直整合系统的极端样本

Tesla Transport Protocol over Ethernet(TTPoE)常被误写成 Tensor over Ethernet。Tesla 在 Hot Chips 2024 后公开了相关代码与说明。[Tesla TTPoE GitHub Repository](https://github.com/teslamotors/ttpoe)

Tesla 的官方 README 给出了几个关键设计取向:

- 丢包和重放被视为可接受的默认情况,但完整传输仍得到保证;
- 初始部署用于 Dojo v1;
- 协议在硬件中执行;
- 数据链路不需要 CPU 或操作系统参与;
- 拥塞管理强调端点自治,而不是集中式控制。

### 1. 垂直整合为 TTPoE 留出了哪些条件

同时控制加速器、接口、拓扑与软件栈，就能舍弃部分通用性，围绕特定系统设计 Transport。TTPoE 展示了这种取舍。

把它推广到行业通用部署，还受以下条件限制：

- 公开实现和生态远小于 RoCE;
- 部署条件高度特定;
- 与通用 Verbs、libfabric 和多厂商交换生态的兼容性有限;
- 公开材料不足以完整评估大规模故障、隔离和安全语义。

所以我会把它看作定制系统的案例，现有证据不足以称它为 RoCE 的通用继任者。

## 八、Ultra Ethernet 怎样重新安排传输

Ultra Ethernet Consortium(UEC)在 2025 年发布 Ultra Ethernet Specification 1.0,目标是为 AI 与 HPC 的 Scale-out 网络提供开放、多厂商的完整通信架构。[Ultra Ethernet Specification 1.0 Announcement](https://ultraethernet.org/ultra-ethernet-consortium-uec-launches-specification-1-0-transforming-ethernet-for-ai-and-hpc-at-scale/)

UET（Ultra Ethernet Transport）同时协调 Transport、API、交换机、安全与物理层，其范围超出给 RoCE 加一个拥塞算法。

### 1. Packet Spraying:从"每条流选一条路"到"每个包利用多条路"

传统 ECMP 通常对五元组做哈希,同一条流固定走一条路径。这能避免乱序,但当少数大流碰巧哈希到同一路径时,其他路径可能空闲,热点路径却拥塞。

UET 支持多路径 Packet Spraying,让同一传输的不同包使用多条可用路径,并结合端点与网络的实时拥塞信息进行更细粒度负载均衡。[UEC Progresses Towards v1.0 Set of Specifications](https://ultraethernet.org/uec-progresses-towards-v1-0-set-of-specifications/)

包级分散提高了路径利用率，减少 Flow Collision 和尾延迟，接收端则要承担乱序处理。

### 2. Flexible Ordering:不为应用不需要的顺序付费

有些应用只关心整个消息何时完成,并不要求每个包按顺序交给软件。UET 允许应用通过 libfabric 表达不同的 Ordering 需求。

如果报文携带目标位置等元数据,接收端可以将乱序到达的包直接放入最终内存位置,而不是先写入巨大 Reorder Buffer,再按顺序复制。

### 3. Sender-based CC 与 Receiver Credit

UEC 公开资料描述的基础路径是可扩展的发送端拥塞控制,并可选用接收端基于 Credit 的控制来缓解 All-to-All Incast。

路径与接收拥塞，需要的信息也不同：

- Fabric 中间链路拥塞,适合由路径遥测和发送端调速处理;
- 接收端口或最终 ToR 出口 Incast,接收端更清楚自己能够接收多少数据。

### 4. Packet Trimming:丢 Payload,但保留快速反馈

在极端拥塞时,交换机可以截断报文 Payload,只把 Header 和拥塞信息送到接收端。这样接收端更快知道哪个包受损,而不必等待超时。

保留 Header，相当于让受损包还能带回明确反馈，减少等待静默丢包超时的时间。

### 5. 把安全放进 Transport 设计

多租户云里，训练数据、参数、梯度和 KV Cache 会穿过主机与网络边界。UEC 因此把安全放在 Transport 协同设计中，而非最后再加一层。

规范发布以后，仍有一整条实现链需要验证：

- RNIC 实现;
- Switch 支持;
- libfabric 与 Collective Library 集成;
- 跨厂商互操作;
- 大规模故障和性能测试;
- 与现有 RoCE 网络的迁移成本。

## 九、RoCE、TTPoE 与 UET 应该怎样比较

| 维度 | RoCEv2 | TTPoE | UET |
| :--- | :----- | :---- | :-- |
| 主要定位 | 通用 Ethernet RDMA | Tesla 垂直整合 Fabric | 开放 AI/HPC Scale-out Transport |
| 生态成熟度 | 高 | 有限、特定部署 | 规范与产品生态建设中 |
| 典型可靠性思路 | 强无损部署 + 端到端 RC | 允许丢包并由端点保证传输 | 容损、选择性恢复、灵活 Ordering |
| 多路径 | 常依赖 Flow-level ECMP | 特定系统设计 | Packet Spraying 是核心能力之一 |
| 乱序处理 | 传统 RC 较敏感 | 自定义 | Direct Data Placement + Flexible Ordering |
| 拥塞控制 | PFC、ECN、DCQCN 等 | 分布式端点自治 | Sender CC、可选 Receiver Credit、Telemetry |
| 通用性 | 面向广泛服务器与存储生态 | 为特定系统简化 | 追求多厂商互操作 |

<div class="v-figure">
<table class="v-matrix">
<thead><tr><th>维度</th><th>RoCEv2</th><th>TTPoE</th><th>UET</th></tr></thead>
<tbody>
<tr><td>生态成熟度</td><td class="lv4">高</td><td class="lv1">有限</td><td class="lv2">建设中</td></tr>
<tr><td>容损能力</td><td class="lv1">弱</td><td class="lv3">端点保证</td><td class="lv4">强</td></tr>
<tr><td>多路径</td><td class="lv2">ECMP</td><td class="lv2">定制</td><td class="lv4">Packet Spraying</td></tr>
<tr><td>乱序处理</td><td class="lv2">敏感</td><td class="lv3">自定义</td><td class="lv4">灵活排序</td></tr>
<tr><td>拥塞控制</td><td class="lv3">PFC / ECN / DCQCN</td><td class="lv3">端点自治</td><td class="lv4">Sender CC + Credit</td></tr>
<tr><td>通用性</td><td class="lv4">广泛</td><td class="lv1">特定</td><td class="lv3">多厂商</td></tr>
</tbody>
</table>
<p class="v-caption">图 1：三种 Transport 的定性对比。lv0–lv4 是作者主观分级，不是性能测试。</p>
</div>

RoCE 已有的部署和软件是实际优势，TTPoE 用通用性换系统定制，UET 则尝试开放的多厂商路线。表中分级只描述这些方向，不能当作性能排名。

## 十、端点、交换机与 Fabric Controller 的闭环

NIC、Switch 和 Controller 看到的信息不同，需要并行分工。

### 1. Endpoint / RNIC

端点最适合承担:

- Pacing 与发送速率控制;
- Packet Spraying;
- 选择性重传;
- 乱序接收与直接数据放置;
- QP、CQ、内存注册和 DMA;
- 应用语义与 Transport 的映射;
- 多租户隔离和安全上下文。

### 2. Switch

交换机最适合承担:

- 高速转发;
- 队列管理与调度;
- ECN 标记;
- 遥测与路径状态;
- Packet Trimming;
- Congestion Isolation;
- 特定 Collective 的在网卸载。

### 3. Fabric Controller

控制平面最适合处理较慢时间尺度的全局问题:

- 拓扑与路径规划;
- 作业放置;
- Rail 与租户分配;
- 故障隔离;
- 流量工程;
- 策略下发;
- 网络遥测分析。

{% mermaid %}
flowchart TB
    A[Training Framework / NCCL / MPI] --> B[Endpoint RNIC]
    B -->|Data, pacing, retransmission| C[Switch Fabric]
    C -->|ECN, telemetry, trim| B
    D[Fabric Controller] -->|Path and policy| B
    D -->|Routing and queue policy| C
    C -->|Telemetry| D
    B -->|Endpoint statistics| D
{% endmermaid %}

端点知道连接和应用语义，交换机看到局部队列、链路，Controller 掌握全局拓扑。控制应按各自的观测和时间尺度配合，单独一层没有全部信息。

## 十一、In-Network Computing:交换机可以计算什么

### 1. SHARP 的正确位置

NVIDIA Scalable Hierarchical Aggregation and Reduction Protocol(SHARP)把 AllReduce、Reduce 和 Broadcast 等 Collective 的部分操作卸载到交换 Fabric 中。交换 ASIC 在数据经过时完成归约,减少端点之间重复传输的数据量。[NVIDIA SHARP In-Network Computing](https://developer.nvidia.com/blog/advancing-performance-with-nvidia-sharp-in-network-computing/)

公开资料把 SHARP 定义为集成在交换 ASIC 中的在网集合通信能力，没有说明采用通用 CGRA，不能反推其内部阵列结构。

### 2. 在网计算的优势

适合数据面计算的任务通常有这些限制：

- 操作简单;
- 状态有限;
- 数据流式经过;
- 需要线速;
- 能显著减少后续流量;
- 对确定性和延迟敏感。

例如:

- Sum、Min、Max 等归约;
- Telemetry;
- Sketch 和计数;
- 报文裁剪与拥塞信号;
- 某些安全、压缩或校验操作。

### 3. 为什么不能把整个训练算子塞进交换机

交换芯片受到严格约束:

- 每包处理时间固定;
- 片上 SRAM 有限;
- 外部 HBM 会增加成本和功耗;
- 浮点精度、状态一致性和多租户隔离复杂;
- 可编程性越强,PPA 与验证代价越高;
- 交换机故障会影响整个 Fabric,不能随意运行复杂代码。

在这些限制里，少量归约和反馈操作可以减少后续流量。把整个训练算子放进交换机，却会改变面积、存储、隔离和故障风险，不能照搬 GPU 的做法。

## 十二、从 FPGA 到可编程微引擎:不要把"可编程"混成一个词

网络数据面可以采用多种实现:

| 架构 | 优点 | 局限 | 适合任务 |
| :--- | :--- | :--- | :------- |
| 固定功能 ASIC | 最高吞吐和能效、确定性强 | 灵活性低 | 稳定协议、核心转发路径 |
| Match-Action Pipeline | 线速、规则可编程 | 算术与状态能力有限 | Parser、分类、转发、遥测 |
| 多核网络处理器 | 软件灵活、生态友好 | 单核无法承担全线速数据面 | 控制面、异常路径、复杂协议 |
| 专用微引擎 | 吞吐与灵活性折中 | 编程模型专有 | 隧道、协议处理、队列任务 |
| FPGA | 开发快、位级可重构 | 面积、功耗和频率劣于 ASIC | 原型、小批量、快速变化功能 |
| CGRA | 算术密集数据流效率较高 | 工具链和映射复杂 | 规则计算图、特定流式加速 |

选 FPGA、CGRA 或 ASIC，要看位级灵活性、控制流、状态规律、并行吞吐和产量能否摊薄成本。“FPGA 能效低”或“CGRA 更好”都不足以作决定。

## 十三、怎样判断一种"无 PFC"方案是否真的更好

支持包喷洒、乱序和重传，只说明机制存在。能否减少实际任务时间，需要放进拥塞与故障环境里测。

我会先查以下结果：

### 1. 性能

- AllReduce Bus Bandwidth;
- All-to-All Job Completion Time;
- 64B 小包 Mpps;
- 大消息 Goodput;
- P50、P99、P999 延迟;
- 多跳与跨机架性能。

### 2. 拥塞

- Many-to-One Incast;
- 多个 Collective 叠加;
- Elephant 与 Mice Flow 混合;
- 链路故障后的路径收敛;
- Packet Spraying 下的乱序程度;
- Credit 耗尽与接收端过载。

### 3. 可靠性

- 单包和突发丢包;
- Reorder;
- Bit Error 与 FEC 后残余错误;
- QP 数量扩大后的状态压力;
- 网卡重置、进程退出和节点故障;
- 重传风暴与超时恢复。

### 4. 生态

- NCCL、MPI、libfabric、Verbs 支持;
- GPU Direct 与国产加速器适配;
- Switch 多厂商互操作;
- 遥测、调试与故障定位;
- 与现有 RoCE Fabric 的迁移方式。

## 容损以后，复杂性移到了哪里

旧式 RoCE 端点不擅长处理丢包，PFC 用逐跳暂停保护有限缓冲，为大规模部署提供了条件。这部分价值仍在，短期不会突然消失。

但 400G、800G 上更强的同步、Incast 和多路径需求，也增加了逐跳暂停的配置与缓冲成本。

IRN 重做恢复，TTPoE 利用定制系统让端点自治，UET 则把多路径、排序、重传、遥测与安全组合到开放架构中。

几条路线共同面对的，是端点、交换机和控制平面各自承担多少拥塞与恢复工作。

不能只问“要不要 PFC”，还得查关掉之后由哪些机制接替。

下篇把这些要求放回芯片：从 PCIe、DMA、NoC 与 RDMA Engine，到 112G/224G SerDes 和可编程微引擎，查看线速需要哪些资源。沐创 N20、N30 等公开路线也在这个范围内讨论。

<link rel="stylesheet" href="/css/series-page.css">

<div class="series-nav series-nav--both">
  <a href="/2026/06/28/ai-compute-interconnect-part1-communication-wall/" class="series-nav__link">← 上一篇：通信墙</a>
  <a href="/2026/06/28/ai-compute-interconnect-part3-smart-nic-chip/" class="series-nav__link">下一篇：智算网卡芯片 →</a>
</div>

## 参考资料

1. [Microsoft Research: Congestion Control for Large-Scale RDMA Deployments](https://www.microsoft.com/en-us/research/publication/congestion-control-for-large-scale-rdma-deployments/)
2. [Revisiting Network Support for RDMA, SIGCOMM 2018](https://dl.acm.org/doi/10.1145/3230543.3230557)
3. [Tesla Transport Protocol over Ethernet, Official GitHub Repository](https://github.com/teslamotors/ttpoe)
4. [Ultra Ethernet Consortium: Specification 1.0 Announcement](https://ultraethernet.org/ultra-ethernet-consortium-uec-launches-specification-1-0-transforming-ethernet-for-ai-and-hpc-at-scale/)
5. [UEC Progresses Towards v1.0 Set of Specifications](https://ultraethernet.org/uec-progresses-towards-v1-0-set-of-specifications/)
6. [Ultra Ethernet Specification 1.0](https://ultraethernet.org/wp-content/uploads/sites/20/2025/06/UE-Specification-6.11.25.pdf)
7. [NVIDIA SHARP In-Network Computing](https://developer.nvidia.com/blog/advancing-performance-with-nvidia-sharp-in-network-computing/)
8. [NVIDIA NCCL User Guide](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/)

<!-- 中篇:重构可靠性--从强制无损到端网协同 -->
