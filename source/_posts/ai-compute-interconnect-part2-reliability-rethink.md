---
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
>**Abstract - Part 2**
>Modern AI fabrics are challenging the traditional assumption that high-performance RDMA must rely on a strictly lossless network. This article explores the limits of PFC-based Ethernet, distinguishes fabric loss from end-to-end reliability, and compares emerging approaches such as RoCE, TTPoE, and Ultra Ethernet to show how transport, congestion control, and recovery are being redistributed across endpoints, switches, and the control plane.

{% note info %}
本文是「智算互联」系列中篇。<a href="/series/ai-interconnect/">查看系列目录 →</a><br>
上篇讨论通信墙与流量指纹；本文讨论传输与 Fabric；下篇将讨论网卡芯片、SerDes、PCIe 与光互联。
{% endnote %}

---

在传统数据中心里,丢一个包通常只意味着某条流稍后重传;在大规模同步训练里,丢包、乱序和排队抖动可能让整个 Collective 等待最慢的 Rank。因此,智算网络长期追求"无损":尽可能不让交换机丢包,让远程直接内存访问(Remote Direct Memory Access, RDMA)维持低时延和高吞吐。

问题在于,**无损不是免费的**。

Priority-based Flow Control(PFC)可以在队列接近溢出时向上游发送 Pause,但暂停会传播,拥塞会扩散,互不相关的流可能被同一个优先级队列阻塞。在足够复杂的依赖关系下,还可能形成死锁。

下一代智算网络的变化不是放弃可靠性,而是换了一种实现方式:

> **从逐跳强制刹车,变为端到端的容损、恢复与协同调度。**


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

现代内核、零拷贝接口和卸载技术已经能显著降低这些成本,但对微秒级、高吞吐的 GPU 集群而言,CPU 介入、内存复制和上下文切换仍可能成为负担。

RDMA 的目标是让网卡直接访问已经注册的内存区域,在较少 CPU 参与的情况下完成远端读、写或 Send/Recv。对于 GPU 集群,GPUDirect RDMA 进一步允许网卡与 GPU 显存建立更直接的数据路径,减少经主机内存中转的成本。

### 2. RoCEv2 把 RDMA 放到可路由以太网上

RDMA over Converged Ethernet version 2(RoCEv2)通常封装在 UDP/IP 之上,因此可以跨三层网络路由。它保留 RDMA 的队列对(Queue Pair, QP)、完成队列(Completion Queue, CQ)、内存注册和可靠连接等语义,同时利用成熟的 Ethernet 交换生态。

这使 RoCEv2 成为智算网络的重要路线:

- Ethernet 设备和运维体系成熟;
- 可以与 IP 路由和 Clos Fabric 结合;
- 服务器、网卡和交换机供应商众多;
- 与 MPI、NCCL、存储和云平台生态衔接。

但传统 RoCE 的可靠连接实现对丢包和乱序较为敏感。为了避免频繁触发重传,工程部署常通过 PFC、ECN 与端到端拥塞控制,把 Fabric 尽量维持在低丢包状态。

## 二、PFC、ECN 与 DCQCN 各自做什么

三者经常被一起提及,但作用并不相同。

### 1. PFC:逐跳、按优先级暂停

Priority-based Flow Control(PFC)由 IEEE 802.1Qbb 定义。与暂停整个端口的传统 Pause Frame 不同,PFC 可以暂停某个优先级类别。

当下游交换机某个优先级队列达到阈值时,它向上游发送 PFC Pause。上游停止发送该优先级流量,为下游释放缓冲区争取时间。

PFC 的优点非常直接:

- 响应发生在相邻链路之间;
- 不必等待端到端控制环路;
- 能防止队列立即溢出;
- 对不擅长处理丢包的旧式 RoCE 端点友好。

它的代价也来自同一个机制:**上游被暂停后,数据不会消失,只会在更上游积压。**

### 2. ECN:交换机标记拥塞,而不是立刻丢包

Explicit Congestion Notification(ECN)允许交换机在队列达到标记阈值时,为报文设置拥塞标志。接收端把拥塞信息反馈给发送端,发送端再降低速率。

ECN 的核心价值是提前反馈:在队列真正溢出之前,让源端看到拥塞趋势。

但 ECN 是端到端闭环。反馈需要经过:

- 报文抵达接收端;
- 接收端生成反馈;
- 反馈返回发送端;
- 发送端调整发送速率。

在 400G、800G 链路上,一个往返时延内可以注入大量数据。若阈值和控制参数不合适,反馈到达前队列可能已经迅速增长。

### 3. DCQCN:为 RoCEv2 设计的端到端速率控制

Data Center Quantized Congestion Notification(DCQCN)由 Microsoft 等提出,用于大规模 RoCEv2 部署。交换机使用 ECN 标记,接收端向发送端发送 Congestion Notification Packet(CNP),发送端根据反馈调整速率。[Congestion Control for Large-Scale RDMA Deployments](https://www.microsoft.com/en-us/research/publication/congestion-control-for-large-scale-rdma-deployments/)

DCQCN 试图让大多数流在队列触发 PFC 之前主动减速,因此 PFC 更像最后一道保险,而不是日常调速器。

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

现实中的 RoCE 网络往往同时使用三者。困难不在于某个机制有根本缺陷,而在于规模、速率和流量模式变化后,靠它们维持强无损的工程成本快速上升。

## 三、PFC 的诅咒到底是什么

### 1. Head-of-Line Blocking:无辜流量一起停车

队头阻塞(Head-of-Line Blocking, HoL Blocking)指的是:队列前部的报文被阻塞,后面的报文即使目的地和路径并不拥塞,也无法前进。

PFC 按优先级暂停,而不是按单条流暂停。如果多条流共享同一优先级和队列,一条热点流触发 Pause,其他流也可能被迫等待。

### 2. Congestion Spreading:拥塞从一个端口长成一棵树

假设交换机 A 的某个出口拥塞,它暂停上游交换机 B;B 的队列随之增长,又暂停更上游的 C。最终,最初局限在一个出口的拥塞沿反向路径传播,形成拥塞树(Congestion Tree)。

这会产生两个后果:

- 原本不经过热点出口的流也可能受影响;
- 故障定位变得困难,因为看到 Pause 的设备未必是拥塞根源。

### 3. Deadlock:循环等待不是 PFC 的必然,但确实可能发生

如果多个队列和路径形成循环依赖,每个节点都在等待下游释放缓冲区,就可能发生 PFC Deadlock。

这里需要避免两个极端说法:

- 说"PFC 一定导致死锁"是不准确的;
- 说"只要配置正确就没有问题"也低估了大规模网络的复杂度。

死锁与拓扑、路由、虚拟通道、优先级映射、缓冲区和故障状态有关。网络越大、路径越动态、业务越混杂,证明所有依赖关系始终安全越困难。

Microsoft 的研究和后续 IRN 工作都把 Head-of-Line Blocking、Congestion Spreading 与偶发死锁列为 PFC 的核心问题。[Revisiting Network Support for RDMA](https://dl.acm.org/doi/10.1145/3230543.3230557)

### 4. Buffer Threshold 是一场精密预算

PFC 阈值不能随意设置。它必须为"Pause Frame 发出后仍在路上的数据"预留 Headroom,通常需要考虑:

- 链路速率;
- 电缆与光纤传播时延;
- 交换机处理延迟;
- 对端响应时间;
- 最大帧长;
- 多个上游端口同时注入的情况。

阈值过低,会频繁暂停并损失利用率;阈值过高,又可能来不及阻止溢出。端口从 100G 升到 400G、800G 后,同样的时间窗口内会飞入更多字节,Headroom 压力随之增加。

## 四、先拆开"有损、可靠、有序"三个概念

很多讨论把有损网络等同于不可靠传输,这是一个关键误区。

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

下一代 AI Transport 的方向通常是第二或第三种:Fabric 可以在极端拥塞时丢包,但端点仍保证最终可靠交付。

## 五、为什么选择性重传改变了问题

传统可靠连接如果采用 Go-Back-N,一旦检测到一个报文丢失,可能从缺失位置开始重传之后的一串报文。大量已成功到达的数据也被重复发送,浪费带宽。

选择性确认与选择性重传(Selective Acknowledgment / Selective Retransmission)只恢复缺失部分,更适合高速、有损 Fabric。

这背后需要端点增加能力:

- 更精确的序列号和丢包检测;
- 更复杂的 Outstanding Packet 状态;
- 每包直接数据放置;
- 乱序完成管理;
- 更细粒度的计时器与重传队列;
- 防止重复写入或状态失配。

"允许网络丢包"不是省掉硬件,而是把部分复杂性从交换机缓冲和 PFC 运维转移到 RNIC Transport Engine。

## 六、IRN:PFC 不是 RDMA 的物理定律

SIGCOMM 2018 的 IRN(Improved RoCE NIC)研究提出一个重要观点:RoCE 对 PFC 的依赖,很大程度上来自当时 NIC 的设计,而不是 RDMA 本身的必然要求。

IRN 通过有限的接收窗口、选择性重传和更好的丢包处理,使 RoCE 可以在不依赖 PFC 的情况下运行。论文报告,在其典型网络场景中,IRN 无 PFC 方案相对传统 RoCE + PFC 获得 6% 到 83% 的性能提升,NIC 资源开销约为 3% 到 10%。这些数字属于论文特定实现与实验条件,不能直接外推到所有商用网络,但它证明了一个架构命题:

> "RDMA 必须依靠全网强无损"不是不可改变的规则。

[Revisiting Network Support for RDMA](https://dl.acm.org/doi/10.1145/3230543.3230557)

## 七、TTPoE:垂直整合系统的极端样本

Tesla Transport Protocol over Ethernet(TTPoE)常被误写成 Tensor over Ethernet。Tesla 在 Hot Chips 2024 后公开了相关代码与说明。[Tesla TTPoE GitHub Repository](https://github.com/teslamotors/ttpoe)

Tesla 的官方 README 给出了几个关键设计取向:

- 丢包和重放被视为可接受的默认情况,但完整传输仍得到保证;
- 初始部署用于 Dojo v1;
- 协议在硬件中执行;
- 数据链路不需要 CPU 或操作系统参与;
- 拥塞管理强调端点自治,而不是集中式控制。

### 1. TTPoE 的意义不在于"替代所有协议"

TTPoE 的价值在于它展示了垂直整合的力量:当厂商同时控制加速器、网络接口、拓扑和软件栈时,可以放弃大量通用性,围绕特定系统目标设计更简单的 Transport。

但这也限制了它作为行业通用路线的代表性:

- 公开实现和生态远小于 RoCE;
- 部署条件高度特定;
- 与通用 Verbs、libfabric 和多厂商交换生态的兼容性有限;
- 公开材料不足以完整评估大规模故障、隔离和安全语义。

因此,TTPoE 更适合作为"垂直整合系统如何重新定义可靠性"的案例,而不是简单写成 RoCE 的继任者。

## 八、Ultra Ethernet:不是给 Ethernet 换一个名字

Ultra Ethernet Consortium(UEC)在 2025 年发布 Ultra Ethernet Specification 1.0,目标是为 AI 与 HPC 的 Scale-out 网络提供开放、多厂商的完整通信架构。[Ultra Ethernet Specification 1.0 Announcement](https://ultraethernet.org/ultra-ethernet-consortium-uec-launches-specification-1-0-transforming-ethernet-for-ai-and-hpc-at-scale/)

Ultra Ethernet Transport(UET)不是在 RoCE 上加一个拥塞算法,而是在 Transport、API、交换机能力、安全与物理层之间重新协同。

### 1. Packet Spraying:从"每条流选一条路"到"每个包利用多条路"

传统 ECMP 通常对五元组做哈希,同一条流固定走一条路径。这能避免乱序,但当少数大流碰巧哈希到同一路径时,其他路径可能空闲,热点路径却拥塞。

UET 支持多路径 Packet Spraying,让同一传输的不同包使用多条可用路径,并结合端点与网络的实时拥塞信息进行更细粒度负载均衡。[UEC Progresses Towards v1.0 Set of Specifications](https://ultraethernet.org/uec-progresses-towards-v1-0-set-of-specifications/)

它的收益是提高路径利用率、降低 Flow Collision 和尾延迟;代价是接收端必须面对乱序。

### 2. Flexible Ordering:不为应用不需要的顺序付费

有些应用只关心整个消息何时完成,并不要求每个包按顺序交给软件。UET 允许应用通过 libfabric 表达不同的 Ordering 需求。

如果报文携带目标位置等元数据,接收端可以将乱序到达的包直接放入最终内存位置,而不是先写入巨大 Reorder Buffer,再按顺序复制。

### 3. Sender-based CC 与 Receiver Credit

UEC 公开资料描述的基础路径是可扩展的发送端拥塞控制,并可选用接收端基于 Credit 的控制来缓解 All-to-All Incast。

这体现了两类拥塞的差异:

- Fabric 中间链路拥塞,适合由路径遥测和发送端调速处理;
- 接收端口或最终 ToR 出口 Incast,接收端更清楚自己能够接收多少数据。

### 4. Packet Trimming:丢 Payload,但保留快速反馈

在极端拥塞时,交换机可以截断报文 Payload,只把 Header 和拥塞信息送到接收端。这样接收端更快知道哪个包受损,而不必等待超时。

Packet Trimming 保留 Header 丢弃 Payload,把"无声 Drop"变成快速、明确的控制信号。

### 5. Security 是一等公民

UEC 把安全与 Transport 协同设计,而不是把加密视为后挂功能。对多租户 AI 云而言,这一点很重要:训练数据、模型参数、梯度和 KV Cache 都可能跨越主机和交换网络边界。

不过,规范发布不等于所有特性已经在多厂商设备中成熟部署。UET 的真实价值最终要通过:

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

这张表不是胜负表。RoCE 的部署基础和软件生态是实实在在的优势;TTPoE 展示了定制系统可以多激进;UET 则试图在开放性与 AI 原生能力之间找到新的平衡。

## 十、端点、交换机与 Fabric Controller 的闭环

下一代智算网络不能被写成"NIC 进化成 Switch,再进化成 Controller"。三者是并列的责任域。

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

端点看到连接状态和应用语义,交换机看到局部队列和链路状态,Controller 看到全局拓扑。任何一方都缺少完整信息,因此真正有效的架构往往是多时间尺度协同,而不是让某一层"包办一切"。

## 十一、In-Network Computing:交换机可以计算什么

### 1. SHARP 的正确位置

NVIDIA Scalable Hierarchical Aggregation and Reduction Protocol(SHARP)把 AllReduce、Reduce 和 Broadcast 等 Collective 的部分操作卸载到交换 Fabric 中。交换 ASIC 在数据经过时完成归约,减少端点之间重复传输的数据量。[NVIDIA SHARP In-Network Computing](https://developer.nvidia.com/blog/advancing-performance-with-nvidia-sharp-in-network-computing/)

SHARP 是一种在网集合通信能力,但不能据此推断交换芯片内部一定采用 CGRA。公开资料说明它集成于交换 ASIC,却没有把其底层实现定义为通用粗粒度可重构阵列。

### 2. 在网计算的优势

适合放进网络的数据面任务通常具有以下特征:

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

因此,In-Network Computing 更像是**在正确的位置执行少量高价值操作**,而不是把交换机变成另一种 GPU。

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

"FPGA 能效低""CGRA 一定更好"都过于绝对。真正的问题是:任务是否需要位级灵活性、控制流是否复杂、状态是否规则、吞吐是否可并行,以及产品量是否足以摊薄 ASIC 成本。

## 十三、怎样判断一种"无 PFC"方案是否真的更好

厂商很容易宣称支持有损网络、包喷洒、乱序接收和选择性重传,但工程评价不能停留在功能列表。

至少需要测试:

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

## 结语:无损没有消失,可靠性的位置正在改变

PFC 解决了一个真实问题:当端点不擅长处理丢包时,用逐跳流控保护有限的交换机缓冲。它帮助 RoCE 走进大规模数据中心,也不会在短期内突然消失。

但随着链路进入 400G、800G,AI 流量出现更强同步、更剧烈 Incast 和更多多路径需求,单纯依靠"不要让任何包丢失"来维持性能,正在变得越来越昂贵。

IRN 证明了 RDMA 可以重新设计丢包恢复;TTPoE 展示了垂直整合系统可以让端点自治;UET 则试图把 Packet Spraying、Flexible Ordering、Selective Retransmission、Telemetry 与 Security 组合成开放的 Scale-out 架构。

真正的变化不是从可靠走向不可靠:

> **从网络内部用 Pause 掩盖拥塞,转向由端点、交换机和控制平面共同感知、承受并恢复拥塞。**

下一篇将回到硅片:一张 400G 智算网卡内部到底有哪些模块?112G / 224G SerDes 为什么困难?PCIe、DMA、NoC、RDMA Engine 和可编程微引擎如何维持线速?沐创从密码安全芯片走向 N20 与 N30,又选择了怎样的技术路线?

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
