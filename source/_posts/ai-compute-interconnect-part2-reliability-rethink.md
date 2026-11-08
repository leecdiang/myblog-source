---
lang: zh-CN
title: "智算互联（中）：RDMA 可靠性与拥塞控制"
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
description: "区分 Fabric 容损、端到端可靠性与排序语义，分析 PFC、ECN、DCQCN 的职责，并比较 IRN、TTPoE 与 Ultra Ethernet 对恢复和拥塞控制的不同安排。"
keywords: RoCE, RDMA, PFC, ECN, DCQCN, TTPoE, UET, 数据中心网络, 拥塞控制
---

> **Abstract - Part 2**
> Priority-based Flow Control protects Ethernet buffers through hop-by-hop backpressure, but can also cause head-of-line blocking and propagate congestion upstream. This article distinguishes fabric loss tolerance, end-to-end reliability, and ordering requirements, then compares how RoCE, IRN, TTPoE, and Ultra Ethernet distribute recovery and congestion-control responsibilities. The analysis follows the resulting trade-offs across endpoint state, switch buffering, multipath transport, and control-plane coordination, and outlines the evidence needed to evaluate alternatives to PFC-dependent operation.

{% note info %}
本文是「智算互联」系列中篇。<a href="/series/ai-interconnect/">查看系列目录 →</a><br>
上篇讨论通信墙与流量指纹；本文讨论传输与 Fabric；下篇将讨论网卡芯片、SerDes、PCIe 与光互联。
{% endnote %}

---

同步训练的完成时间受最慢 Rank 约束，丢包恢复、乱序处理和队列等待都可能进入 Collective 的关键路径。为维持 RDMA（Remote Direct Memory Access，远程直接内存访问）的低时延与高吞吐，智算网络长期倾向于在交换 Fabric 中尽量避免丢包。

这种部署选择将一部分可靠性压力转化为了交换网络的缓冲与流控要求。

PFC（Priority-based Flow Control）在队列接近溢出时暂停上游发送，但未被消除的数据会在上游继续积压，使暂停向更大范围传播。共享优先级的无关流也可能被阻塞；若缓冲依赖形成循环，还存在死锁风险。

另一条设计路径允许 Fabric 在拥塞时丢包，由端点检测并恢复，同时通过端网协同控制发送节奏和路径使用。

两条路径都需要可靠交付，区别在于恢复责任的分配，以及为此付出的状态、缓冲和控制成本。

---

## 一、RDMA 的执行路径与 RoCE 部署基础

### 1. 主机协议栈的参与成本

普通 Socket 通信可能经历:

1. 应用缓冲区;
2. 用户态与内核态切换;
3. 内核 TCP/IP 协议栈;
4. 内核网络缓冲区;
5. 网卡 DMA;
6. 接收端反向执行类似路径。

零拷贝与硬件卸载已降低传统网络栈的成本，但在微秒级通信中，CPU 介入、数据复制及上下文切换仍可能构成显著开销。

RDMA 通过网卡访问已注册内存，以较少的 CPU 参与完成远端读写和 Send/Recv。GPUDirect RDMA 进一步连接网卡与 GPU 显存，减少经由主机内存中转的路径。

### 2. RoCEv2 把 RDMA 放到可路由以太网上

RDMA over Converged Ethernet version 2(RoCEv2)通常封装在 UDP/IP 之上,因此可以跨三层网络路由。它保留 RDMA 的队列对(Queue Pair, QP)、完成队列(Completion Queue, CQ)、内存注册和可靠连接等语义,同时利用成熟的 Ethernet 交换生态。

这一选择能够利用以太网已有的部署条件：

- Ethernet 设备和运维体系成熟;
- 可以与 IP 路由和 Clos Fabric 结合;
- 服务器、网卡和交换机供应商众多;
- 与 MPI、NCCL、存储和云平台生态衔接。

传统 RoCE 可靠连接对丢包与乱序较为敏感，因此部署中常组合使用 PFC、ECN 和端到端拥塞控制，尽量避免进入代价较高的重传路径。

## 二、PFC、ECN 与 DCQCN 的控制职责

三者分别承担逐跳暂停、拥塞信号传递和源端速率调整，作用范围与响应时间并不相同。

### 1. PFC:逐跳、按优先级暂停

Priority-based Flow Control(PFC)由 IEEE 802.1Qbb 定义。与暂停整个端口的传统 Pause Frame 不同,PFC 可以暂停某个优先级类别。

下游优先级队列达到阈值后，向上游发送 PFC Pause，暂时阻止同优先级流量继续进入，为队列排空提供时间。

逐跳控制具有以下特征：

- 响应发生在相邻链路之间;
- 不必等待端到端控制环路;
- 能防止队列立即溢出;
- 对不擅长处理丢包的旧式 RoCE 端点友好。

但暂停并不消除待传输数据，积压只是向上游转移；其影响范围取决于后续缓冲与流量依赖。

### 2. ECN:交换机标记拥塞,而不是立刻丢包

Explicit Congestion Notification(ECN)允许交换机在队列达到标记阈值时,为报文设置拥塞标志。接收端把拥塞信息反馈给发送端,发送端再降低速率。

ECN 的作用是将队列压力在溢出前反馈给源端，为主动减速提供信号。

源端速率调整需要经过完整的反馈环路：

- 报文抵达接收端;
- 接收端生成反馈;
- 反馈返回发送端;
- 发送端调整发送速率。

在 400G、800G 链路上，一个反馈周期内仍可能注入大量数据。若标记阈值、缓冲容量与控制参数不匹配，源端完成减速之前队列就可能继续增长。

### 3. DCQCN:为 RoCEv2 设计的端到端速率控制

Data Center Quantized Congestion Notification(DCQCN)由 Microsoft 等提出,用于大规模 RoCEv2 部署。交换机使用 ECN 标记,接收端向发送端发送 Congestion Notification Packet(CNP),发送端根据反馈调整速率。[Congestion Control for Large-Scale RDMA Deployments](https://www.microsoft.com/en-us/research/publication/congestion-control-for-large-scale-rdma-deployments/)

DCQCN 希望通过端到端调速减少 PFC 触发，将逐跳暂停保留为缓冲紧张时的保护机制。

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

实际 RoCE 部署常将三者组合使用。规模、线速和同步流量增加后，控制环路与缓冲参数需要共同匹配，维持低丢包运行的配置和运维成本也随之上升。

## 三、逐跳暂停的系统性代价

### 1. Head-of-Line Blocking：共享队列的连带阻塞

队头阻塞(Head-of-Line Blocking, HoL Blocking)指的是:队列前部的报文被阻塞,后面的报文即使目的地和路径并不拥塞,也无法前进。

PFC 按优先级暂停,而不是按单条流暂停。如果多条流共享同一优先级和队列,一条热点流触发 Pause,其他流也可能被迫等待。

### 2. 反压传播与 Congestion Tree

若 A 的出口拥塞并暂停 B，B 无法排出数据后又暂停 C，压力便沿反向路径扩散，可能形成 Congestion Tree。最初的局部热点因此能够影响更大范围。

其可观察后果包括：

- 原本不经过热点出口的流也可能受影响;
- 故障定位变得困难,因为看到 Pause 的设备未必是拥塞根源。

### 3. 循环缓冲依赖与死锁条件

当多个队列循环等待下游释放缓冲，且没有队列能够先恢复发送时，就可能形成 PFC Deadlock。

启用 PFC 本身不意味着必然死锁，而“配置正确”也不能替代对循环依赖条件的分析。

拓扑、路由、虚拟通道、优先级、缓冲分配和故障状态都会改变依赖关系。规模扩大、路径动态变化及业务混合，使得持续证明依赖无环更加困难。

Microsoft 的研究和后续 IRN 工作都把 Head-of-Line Blocking、Congestion Spreading 与偶发死锁列为 PFC 的核心问题。[Revisiting Network Support for RDMA](https://dl.acm.org/doi/10.1145/3230543.3230557)

### 4. Headroom 与暂停响应期间的在途数据

PFC Pause 发出后，到上游实际停止发送之前仍会有数据到达。因此，Headroom 至少需要考虑：

- 链路速率;
- 电缆与光纤传播时延;
- 交换机处理延迟;
- 对端响应时间;
- 最大帧长;
- 多个上游端口同时注入的情况。

阈值过低可能导致频繁暂停，过高则可能无法及时避免溢出。从 100G 提高到 400G、800G 后，相同响应时间对应更多在途字节，预留缓冲也需要重新计算。

## 四、Fabric 容损、传输可靠性与有序语义

这三个概念对应不同系统层面的约束。交换机允许丢包，并不意味着应用最终收到的数据可以不完整。

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

新的 AI Transport 常采用表中第二或第三种组合：允许 Fabric 在极端拥塞时丢包，同时由端点承担最终可靠交付。

## 五、选择性重传与端点状态成本

采用 Go-Back-N 时，单个包丢失可能触发从缺口开始的连续重发，使已经到达的数据再次消耗链路带宽。

选择性确认与重传仅补发缺失部分，可以减少高速有损 Fabric 上的重复传输，但需要更细粒度的接收和恢复状态。

这需要端点维护更多状态：

- 更精确的序列号和丢包检测;
- 更复杂的 Outstanding Packet 状态;
- 每包直接数据放置;
- 乱序完成管理;
- 更细粒度的计时器与重传队列;
- 防止重复写入或状态失配。

因此，允许丢包并未消除可靠传输的硬件成本，而是将部分复杂性从交换机缓冲与 PFC 运维转移到 RNIC Transport Engine。

## 六、IRN：重新审视 RoCE 对 PFC 的依赖

SIGCOMM 2018 的 IRN（Improved RoCE NIC）将 RoCE 对 PFC 的依赖归因于当时的 NIC 设计选择，而非 RDMA 语义本身的必然约束。

IRN 结合有限接收窗口、选择性重传与丢包处理，使 RoCE 可以在无 PFC 条件下运行。论文在典型实验场景中报告，相对传统 RoCE + PFC 的性能提升为 6%–83%，NIC 资源开销约为 3%–10%。这些数字仅适用于其实现与实验条件，不能直接外推到商用网络；其主要意义在于展示另一种可靠传输设计的可行性。

由此，依靠全网强无损维持 RDMA 运行，是一种实现路径，而非唯一前提。

[Revisiting Network Support for RDMA](https://dl.acm.org/doi/10.1145/3230543.3230557)

## 七、TTPoE：垂直整合条件下的传输设计

Tesla Transport Protocol over Ethernet(TTPoE)常被误写成 Tensor over Ethernet。Tesla 在 Hot Chips 2024 后公开了相关代码与说明。[Tesla TTPoE GitHub Repository](https://github.com/teslamotors/ttpoe)

Tesla 的官方 README 给出了几个关键设计取向:

- 丢包和重放被视为可接受的默认情况,但完整传输仍得到保证;
- 初始部署用于 Dojo v1;
- 协议在硬件中执行;
- 数据链路不需要 CPU 或操作系统参与;
- 拥塞管理强调端点自治,而不是集中式控制。

### 1. 系统控制范围与通用性取舍

同时掌握加速器、接口、拓扑与软件栈，可以围绕特定系统设计 Transport，并舍弃部分通用兼容性。TTPoE 提供了这一取舍的具体案例。

其向行业通用部署推广时，仍受到以下条件限制：

- 公开实现和生态远小于 RoCE;
- 部署条件高度特定;
- 与通用 Verbs、libfabric 和多厂商交换生态的兼容性有限;
- 公开材料不足以完整评估大规模故障、隔离和安全语义。

因此，更合理的定位是垂直整合系统中的定制传输案例。现有公开证据不足以将其认定为 RoCE 的通用继任方案。

## 八、Ultra Ethernet 的协同传输架构

Ultra Ethernet Consortium(UEC)在 2025 年发布 Ultra Ethernet Specification 1.0,目标是为 AI 与 HPC 的 Scale-out 网络提供开放、多厂商的完整通信架构。[Ultra Ethernet Specification 1.0 Announcement](https://ultraethernet.org/ultra-ethernet-consortium-uec-launches-specification-1-0-transforming-ethernet-for-ai-and-hpc-at-scale/)

UET（Ultra Ethernet Transport）处于同时协调 Transport、API、交换机、安全与物理层的架构中，其设计范围超出了为 RoCE 增加单一拥塞算法。

### 1. Packet Spraying：包级多路径与乱序代价

传统 ECMP 通常对五元组做哈希,同一条流固定走一条路径。这能避免乱序,但当少数大流碰巧哈希到同一路径时,其他路径可能空闲,热点路径却拥塞。

UET 支持多路径 Packet Spraying,让同一传输的不同包使用多条可用路径,并结合端点与网络的实时拥塞信息进行更细粒度负载均衡。[UEC Progresses Towards v1.0 Set of Specifications](https://ultraethernet.org/uec-progresses-towards-v1-0-set-of-specifications/)

包级分散有助于提高路径利用率、缓解 Flow Collision 与尾延迟，但也要求接收端处理由多路径时延差异产生的乱序。实际收益取决于这两方面能否匹配。

### 2. Flexible Ordering：按应用需求约束顺序

有些应用只关心整个消息何时完成,并不要求每个包按顺序交给软件。UET 允许应用通过 libfabric 表达不同的 Ordering 需求。

如果报文携带目标位置等元数据,接收端可以将乱序到达的包直接放入最终内存位置,而不是先写入巨大 Reorder Buffer,再按顺序复制。

### 3. Sender-based CC 与 Receiver Credit

UEC 公开资料描述的基础路径是可扩展的发送端拥塞控制,并可选用接收端基于 Credit 的控制来缓解 All-to-All Incast。

路径拥塞与接收侧拥塞所需的观测信息并不相同：

- Fabric 中间链路拥塞,适合由路径遥测和发送端调速处理;
- 接收端口或最终 ToR 出口 Incast,接收端更清楚自己能够接收多少数据。

### 4. Packet Trimming：保留拥塞反馈信息

在极端拥塞时,交换机可以截断报文 Payload,只把 Header 和拥塞信息送到接收端。这样接收端更快知道哪个包受损,而不必等待超时。

Header 得以保留后，接收端能够更早获得受损包信息，减少静默丢包后等待超时的恢复延迟。

### 5. Transport 与多租户安全

多租户云中，训练数据、参数、梯度与 KV Cache 会跨越主机和网络边界。UEC 因而将安全纳入 Transport 协同设计，使其与传输和隔离机制共同考虑。

规范发布并不等于完整部署链路已得到验证，后续仍需检查：

- RNIC 实现;
- Switch 支持;
- libfabric 与 Collective Library 集成;
- 跨厂商互操作;
- 大规模故障和性能测试;
- 与现有 RoCE 网络的迁移成本。

## 九、RoCE、TTPoE 与 UET 的比较口径

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

RoCE 的既有部署与软件生态构成实际优势，TTPoE 通过限定通用性适配特定系统，UET 则推进开放的多厂商架构。表中分级仅概括这些设计方向，不能用作实测性能排名。

## 十、端点、交换机与 Fabric Controller 的闭环

NIC、Switch 与 Controller 分别掌握不同粒度的信息，适合承担不同时间尺度的控制任务。

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

端点掌握连接状态与应用语义，交换机观测局部队列和链路，Controller 掌握全局拓扑。三者需要依据各自的观测范围与响应时间协作，任何单层都不足以独立完成全部控制。

## 十一、在网计算的适用范围

### 1. SHARP 与集合通信卸载

NVIDIA Scalable Hierarchical Aggregation and Reduction Protocol(SHARP)把 AllReduce、Reduce 和 Broadcast 等 Collective 的部分操作卸载到交换 Fabric 中。交换 ASIC 在数据经过时完成归约,减少端点之间重复传输的数据量。[NVIDIA SHARP In-Network Computing](https://developer.nvidia.com/blog/advancing-performance-with-nvidia-sharp-in-network-computing/)

公开资料将 SHARP 描述为集成在交换 ASIC 中的在网集合通信能力，并未披露其采用通用 CGRA。因此，不能由“可执行归约”反推内部阵列结构。

### 2. 适合数据面的计算特征

适合放入数据面的任务通常具备以下约束：

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

### 3. 交换芯片的计算与状态边界

交换芯片受到严格约束:

- 每包处理时间固定;
- 片上 SRAM 有限;
- 外部 HBM 会增加成本和功耗;
- 浮点精度、状态一致性和多租户隔离复杂;
- 可编程性越强,PPA 与验证代价越高;
- 交换机故障会影响整个 Fabric,不能随意运行复杂代码。

在这些限制下，有限的归约和反馈操作能够减少后续流量；完整训练算子则会显著改变面积、存储、隔离与故障约束，不能直接沿用 GPU 的计算组织方式。

## 十二、FPGA、CGRA 与微引擎的实现取舍

网络数据面可以采用多种实现:

| 架构 | 优点 | 局限 | 适合任务 |
| :--- | :--- | :--- | :------- |
| 固定功能 ASIC | 最高吞吐和能效、确定性强 | 灵活性低 | 稳定协议、核心转发路径 |
| Match-Action Pipeline | 线速、规则可编程 | 算术与状态能力有限 | Parser、分类、转发、遥测 |
| 多核网络处理器 | 软件灵活、生态友好 | 单核无法承担全线速数据面 | 控制面、异常路径、复杂协议 |
| 专用微引擎 | 吞吐与灵活性折中 | 编程模型专有 | 隧道、协议处理、队列任务 |
| FPGA | 开发快、位级可重构 | 面积、功耗和频率劣于 ASIC | 原型、小批量、快速变化功能 |
| CGRA | 算术密集数据流效率较高 | 工具链和映射复杂 | 规则计算图、特定流式加速 |

FPGA、CGRA 与 ASIC 的选择，需要结合位级灵活性、控制流、状态规律、并行吞吐和产量摊销分析。仅凭“FPGA 能效低”或“CGRA 更好”，无法形成充分的工程判断。

## 十三、无 PFC 方案的验证维度

支持包喷洒、乱序接收和重传，说明方案具备相应机制，却不能直接证明任务完成时间更短。性能收益需要在拥塞、故障与混合负载条件下测量。

评估至少应覆盖以下结果与测试条件：

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

## 可靠性职责的重新分配

传统 RoCE 端点处理丢包的代价较高，PFC 通过逐跳暂停保护有限缓冲，为大规模部署提供了可行条件。既有系统仍依赖这些能力，其价值不能因新协议出现而被忽略。

但在 400G、800G 下，更强的同步、Incast 与多路径需求，也增加了逐跳暂停所需的缓冲、配置和运维成本。

IRN 重新设计端点恢复机制，TTPoE 借助定制系统实现端点自治，UET 则将多路径、排序、重传、遥测与安全纳入开放架构。

这些路线的共同问题，是如何在端点、交换机和控制平面之间分配拥塞控制与恢复职责，并控制由此产生的复杂性。

因此，是否采用 PFC 需要与替代机制一并评估：关闭逐跳暂停后，哪些组件负责检测、恢复、限速和隔离，才是判断方案是否完整的依据。

下篇将把这些需求映射到芯片实现，从 PCIe、DMA、NoC 与 RDMA Engine，到 112G/224G SerDes 和可编程微引擎，分析维持线速所需的资源，并据此讨论沐创 N20、N30 等公开路线。

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
