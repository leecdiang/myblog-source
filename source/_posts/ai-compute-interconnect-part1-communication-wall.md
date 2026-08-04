---
title: 智算互联（上）：通信墙——为什么更多 GPU 不等于更高吞吐
date: 2026-06-28 22:39:30
categories: Silicon & Circuits
etoc: true
tags:
  - 分布式训练
  - 集合通信
  - 网络拓扑
  - MFU
  - AI集群
  - 智算网络
  - AI-Infrastructure
  - Distributed-Training
  - GPU-Cluster
  - NCCL
  - Scale-Up
  - Scale-Out
description: 从 MFU、并行策略、集合通信与网络拓扑出发，解释 AI 集群为什么会从计算密集型系统走向通信受限系统，以及为什么 400G、800G 链路并不自动等于更高的有效吞吐。
keywords: 分布式训练, AI集群通信, 集合通信, 网络拓扑, MFU, 长尾同步, 并行策略,Scale-Up, Scale-Out
---
>**Abstract - Part 1**  
>As AI clusters scale from hundreds to tens of thousands of accelerators, peak compute no longer translates directly into usable throughput. This article examines how distributed parallelism, collective communication, network topology, synchronization, and tail latency reshape training efficiency, and explains why moving data has become one of the central constraints of large-scale AI systems.

{% note info %}
本文是「智算互联」系列上篇。<a href="/series/ai-interconnect/">查看系列目录 →</a>
{% endnote %}

<div style="display: flex; justify-content: center; gap: 16px; margin: 32px 0;">
  <a class="glass-pill" href="../ai-compute-interconnect-part2-reliability-rethink/">
    中篇：关于可靠性 →
  </a>
  <a class="glass-pill" href="../ai-compute-interconnect-part3-smart-nic-chip/">
    下篇：剖析智算网卡 →
  </a>
</div>

---

## 一、峰值算力不等于有效吞吐

### 1. 从 FLOPS 到 MFU

芯片规格表通常给出峰值浮点算力（Peak FLOPS），但训练系统真正关心的是：这些理论算力中，有多少被模型的有效计算使用。

模型 FLOPs 利用率（Model FLOPs Utilization, MFU）可以写成：

$$
\mathrm{MFU}=
\frac{\text{模型每步所需 FLOPs}}{\text{单步时间}\times\text{加速器数量}\times\text{单卡峰值 FLOPS}}
$$

PaLM 论文将 MFU 定义为模型有效计算吞吐与硬件理论峰值吞吐之比。这个指标刻意不把通信、内存访问、重计算和系统等待算作“有用模型 FLOPs”，因此它能够直观暴露集群中的非计算开销。[PaLM: Scaling Language Modeling with Pathways](https://arxiv.org/abs/2204.02311)

但 MFU 下降可能来自多种原因：

- GPU 内核没有充分利用 Tensor Core
- HBM 带宽或访存模式成为瓶颈
- 计算与通信没有重叠
- 流水线出现 Bubble
- MoE 专家负载不均衡
- 数据加载、Checkpoint 或故障恢复打断训练
- 某个 Rank 变成 Straggler，迫使其余设备等待

网络只是其中一项。

> 随着加速器变快、集群变大，通信成为越来越难以被计算隐藏的主要开销之一。

### 2. 单步时间应该怎样拆解

一个训练 Step 可以近似拆成：

$$
T_{\mathrm{step}} = T_{\mathrm{compute}} +
T_{\mathrm{exposed\ comm}} +
T_{\mathrm{bubble}} +
T_{\mathrm{sync}} +
T_{\mathrm{I/O}}
$$

$T_{\mathrm{exposed\ comm}}$ 是**没有被计算覆盖、暴露在关键路径上的通信时间**，不同于总通信时间。

例如，梯度 AllReduce 可能在反向传播过程中分桶并提前启动。如果网络足够快，通信可以与后续层的反向计算重叠；如果网络稍慢，最后一个 Bucket 仍未完成，优化器就必须等待。此时的性能往往不是平滑下降，而是在某个临界点后突然恶化。

只看“总通信量”不够实用。实际还要问：

- 通信发生在 Step 的什么位置？
- 是否位于依赖链关键路径？
- 消息能否拆分并流水化？
- 通信库是否理解实际拓扑？
- 发送端、交换网络和接收端是否同时可用？

### 3. Amdahl 定律在 AI 集群中的变体

经典 Amdahl 定律说明，无法并行化的串行部分会限制整体加速比：

$$
S(N)=\frac{1}{(1-P)+\frac{P}{N}}
$$

但大模型训练中的“串行部分”并不是固定常数。卡数增加后，通信范围、同步参与者和拓扑跨度也在变化。更接近现实的表达是：

$$
S(N)=\frac{T_1}{\frac{T_{\mathrm{compute}}}{N}+T_{\mathrm{comm}}(N)+T_{\mathrm{sync}}(N)+T_{\mathrm{imbalance}}(N)}
$$

这里的 $T_{\mathrm{comm}}(N)$ 和 $T_{\mathrm{sync}}(N)$ 可能随规模上升。于是，新增 GPU 一方面降低每张卡承担的计算量，另一方面也可能增加集体通信和等待成本。

从系统视角看，真正应该观测的是**扩展效率（Scaling Efficiency）**：

$$
\eta(N)=\frac{\text{使用 }N\text{ 张卡的实际加速比}}{N}
$$

如果 1024 张卡只获得相对单卡 600 倍的速度，扩展效率约为 58.6%。剩余部分并不一定全部被“网络吃掉”，但它提醒我们：卡数不是有效算力的等价单位。

## 二、并行策略决定流量，而不是“AI”两个字

“AI 流量”并不是一种统一的网络负载。数据并行、张量并行、流水线并行、专家并行和上下文并行，会产生完全不同的通信指纹。

NVIDIA Megatron Core 也把这些策略视为可以组合的不同维度：数据并行（DP）、张量并行（TP）、流水线并行（PP）、上下文并行（CP）与专家并行（EP）。[Megatron Core Parallelism Strategies Guide](https://docs.nvidia.com/megatron-core/developer-guide/latest/user-guide/parallelism-guide.html)

### 1. Data Parallelism：周期性的大规模归约

数据并行（Data Parallelism, DP）让不同设备持有相同模型副本，各自处理不同 Mini-batch，然后同步梯度。

典型通信原语是：

- AllReduce；
- ReduceScatter + AllGather；
- 参数或优化器状态同步。

它的特点通常是：

- 消息尺寸较大；
- 具有明显的周期性；
- 对总带宽和二分带宽敏感；
- 最慢 Rank 会拖住整个同步点；
- 梯度分桶后可以与反向计算重叠。

DP 的流量不是单一的大尺寸 AllReduce。训练框架通常把梯度拆成多个 Bucket，形成一串具有依赖关系的中等或大消息。网络既要有持续吞吐，也要控制最后几个 Bucket 的尾延迟。

### 2. Tensor Parallelism：每层都可能等待网络

张量并行（Tensor Parallelism, TP）把同一层的矩阵或张量切分到多张 GPU。它解决单卡显存与单卡计算容量不足的问题，但代价是层内频繁同步。

常见通信包括：

- AllReduce；
- AllGather；
- ReduceScatter；
- 点对点交换局部结果。

TP 的通信频率通常高于 DP，而且往往出现在每个 Transformer Layer 内部。即使单次消息没有 DP 梯度那么大，通信也更难隐藏，因为下一步矩阵计算可能依赖刚刚收到的结果。

这使 TP 对以下指标格外敏感：

- 单跳与端到端时延；
- 小到中等消息效率；
- 拥塞下的 P99/P999 延迟；
- 节点内与跨节点拓扑边界。

工程上通常优先把 TP 放在高带宽、低时延的 Scale-up 域内，而不是轻易跨越普通数据中心网络。

### 3. Pipeline Parallelism：带宽之外还有 Bubble

流水线并行（Pipeline Parallelism, PP）把模型的不同层分配到不同 Stage，并将 Mini-batch 切成多个 Micro-batch，在 Stage 之间流水执行。

它的网络流量主要是：

- Forward 阶段传递 Activation；
- Backward 阶段传递 Activation Gradient；
- 相邻 Stage 间的点对点通信。

PP 的核心问题不只是链路带宽，而是流水线 Bubble。Stage 计算量不均、通信延迟波动或 Micro-batch 数量不足，都会让部分设备空等。Megatron-LM 的交错流水线调度正是为了减少这种 Bubble。[Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM](https://arxiv.org/abs/2104.04473)

### 4. Expert Parallelism：All-to-All 与 Incast

Mixture-of-Experts（MoE）模型只激活部分专家，但不同 Token 会被路由到不同设备上的专家。专家并行（Expert Parallelism, EP）通常需要：

1. 将 Token 分发到对应专家；
2. 完成专家计算；
3. 把结果送回原设备。

这往往形成两次 All-to-All。Switch Transformer 的实现也明确使用 All-to-All 在设备间重新分片 Token。[Switch Transformers](https://arxiv.org/abs/2101.03961)

EP 的网络难点包括：

- 多对多通信；
- 瞬时 Incast；
- Token 路由不均衡；
- 热门专家造成局部热点；
- 小消息与大消息混杂；
- 尾延迟直接传导到下一层。

相比规则、对称的 Ring AllReduce，MoE 流量更难仅靠静态 ECMP 哈希均衡。

### 5. Context Parallelism：长上下文把序列维度变成互联问题

上下文并行（Context Parallelism, CP）沿序列长度切分输入。它主要服务于长上下文训练，减轻单卡 Activation 与 Attention 计算的内存压力。

随着上下文窗口从数千扩展到数十万甚至更长，Attention 相关的 KV、Query 或中间状态需要跨设备交换。Megatron Core 支持 CP 与 TP、PP、DP 组合，这意味着长上下文的通信并不是一个孤立问题，而会叠加在原有并行维度之上。[Megatron Core Context Parallelism](https://docs.nvidia.com/megatron-core/developer-guide/latest/user-guide/features/context_parallel.html)

### 6. 一张流量指纹表

| 并行策略 | 常见通信原语 | 典型位置 | 更敏感的网络指标 | 主要风险 |
| :------- | :----------- | :------- | :----------------- | :------- |
| DP / FSDP | AllReduce、ReduceScatter、AllGather | 每个训练 Step | 持续吞吐、二分带宽、尾延迟 | 最慢 Rank、跨机架拥塞 |
| TP | AllReduce、AllGather、ReduceScatter | 每层或每组算子 | 低时延、中小消息效率 | 通信暴露在关键路径 |
| PP | P2P Send/Recv | 相邻 Stage | 稳定时延、链路局部性 | Pipeline Bubble |
| EP / MoE | All-to-All | 每个 MoE Layer | Incast 控制、负载均衡 | 热点专家、长尾 |
| CP / SP | AllGather、ReduceScatter、P2P | Attention 与序列切分 | 带宽与时延兼顾 | 长序列状态交换 |
| Checkpoint | Gather、Storage Write | 周期性 | 存储网络吞吐 | 与训练 Fabric 争用 |
| 推理 Decode | KV 访问、P2P、小批量 Collective | 每个 Token 或若干 Token | P99 时延、抖动 | 小消息效率与排队 |

## 三、集合通信不是“发一个大包”

NVIDIA Collective Communications Library（NCCL）提供 AllReduce、Broadcast、Reduce、AllGather、ReduceScatter 等 GPU 集合通信原语，并根据拓扑选择算法和路径。[NCCL Collective Operations](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html)

### 1. Ring AllReduce：带宽效率高，但步数多

Ring AllReduce 通常由 ReduceScatter 和 AllGather 两阶段组成。每个 Rank 只与相邻 Rank 通信，能够较好利用链路带宽，并避免中心节点成为瓶颈。

对于 $N$ 个 Rank、每个 Rank 数据量为 $M$ 的情形，每个 Rank 传输的数据量近似为：

$$
2\frac{N-1}{N}M
$$

当消息较大时，Ring 的带宽利用率通常很好；但它需要较多通信步，延迟项会随 Rank 数量增加。因此 Ring 更适合大消息，不一定适合延迟主导的小消息。

### 2. Tree：减少步数，但更依赖拓扑与上层链路

Tree 或 Double Binary Tree 可以把通信步数降低到对数级，更适合小消息或延迟敏感场景。但树的上层节点和链路承担更多聚合流量，若物理拓扑与逻辑树不匹配，可能形成热点。

### 3. Hierarchical Collective：先节点内，再节点间

现代 GPU 服务器通常同时存在多层互联：

- GPU 封装或板内互联；
- 节点内 NVLink、UALink 类 Scale-up Fabric；
- PCIe 与 CPU/网卡路径；
- 跨节点 Ethernet 或 InfiniBand Scale-out Fabric。

因此，集合通信往往采用分层算法：先在节点内归约，再由每个节点的代表参与跨节点归约，最后把结果广播回节点内。这一策略的本质是尽量减少穿过较慢、较拥塞层级的数据量。

## 四、必须先区分 Scale-up 与 Scale-out

很多智算互联讨论混淆了 NVLink、UALink、PCIe、RoCE 和 UET，因为它们都在“连接加速器”。但它们解决的层级并不相同。

### 1. Scale-up：把一个 Pod 看成更大的计算节点

Scale-up 面向服务器、机架或 Pod 内的紧耦合加速器，追求：

- 极低时延；
- 高带宽密度；
- 直接 Load、Store 与 Atomic 语义；
- 更强的确定性；
- 较小的故障与管理域。

UALink 200G 1.0 就是一个开放的 Scale-up 互联规范，定义加速器与交换机之间的低时延、高带宽连接，并支持 Read、Write 和 Atomic Transaction。[UALink 200G 1.0 Specification Overview](https://ualinkconsortium.org/blog/ualink-200g-1-0-specification-overview-802/)

### 2. Scale-out：把大量节点组成可路由集群

Scale-out 面向跨服务器、跨机架甚至跨园区的集群，优先考虑：

- 可路由与可扩展；
- 多路径；
- 故障隔离；
- 集合通信；
- 多租户与运维；
- 成本和生态兼容。

RoCEv2、InfiniBand 与 Ultra Ethernet Transport（UET）主要处于这一层。Scale-out 不会被 Scale-up 完全取代：即使一个 Pod 内部拥有高速内存语义互联，多个 Pod 之间仍需要可扩展网络。

### 3. PCIe 与 CXL：主机 I/O 和内存扩展层

PCI Express（PCIe）首先是主机与设备之间的 I/O 互联。CXL 建立在 PCIe 物理层之上，为缓存与内存扩展提供更丰富语义。它们与 Scale-out 网络之间存在交汇，但不能简单视作同一种 Fabric。

{% mermaid %}
flowchart LR
    A[GPU / AI Accelerator] --> B[封装内或板内互联]
    B --> C[Scale-up Fabric<br/>NVLink / UALink 类]
    C --> D[主机与 I/O<br/>PCIe / CXL]
    D --> E[SmartNIC / RNIC]
    E --> F[Scale-out Fabric<br/>RoCE / UET / InfiniBand]
    F --> G[其他服务器或 Pod]
    F --> H[存储与 Checkpoint 网络]
{% endmermaid %}

这张图画的是工程边界，不是协议分层：**每一层的延迟预算、可靠性语义和可扩展范围不同。**

## 五、拓扑决定了“400G”能不能变成 400G

### 1. Clos / Fat-tree：用多级交换换取规模

大型数据中心常采用 Clos 或 Fat-tree 类拓扑。服务器通过 Leaf 交换机接入，再经 Spine 层互联。它提供多条等价路径和较好的横向扩展能力，但也引入了几个关键问题：

- 上行带宽是否与下行带宽匹配；
- Leaf-to-Spine 是否过订阅；
- ECMP 是否把多条大流哈希到同一路径；
- 跨 Rail 通信是否穿越额外层级；
- 故障后剩余路径是否出现新的热点。

### 2. Oversubscription：端口速率没有消失，二分带宽才是上限

假设一个 Leaf 交换机有 32 个 400G 下行端口，却只有 16 个 400G 上行端口，那么下行总带宽为 12.8 Tbps，上行只有 6.4 Tbps，过订阅比为 2:1。

单台服务器做点对点测试时可以跑满 400G，但当大量服务器同时跨 Leaf 通信时，每台服务器可获得的平均带宽可能远低于端口标称值。

因此，集群网络不能只看：

- 单端口速率；
- 交换芯片总容量；
- 单条链路延迟。

还应关注：

- Bisection Bandwidth（二分带宽）；
- Oversubscription Ratio（过订阅比）；
- 多路径利用率；
- Job Placement 与拓扑亲和性；
- 故障降级后的剩余容量。

### 3. Rail-optimized：让并行维度与物理网络对齐

AI 集群常把每台服务器内相同编号的 GPU 或网卡连接到同一条 Rail。这样，跨节点 Collective 可以尽量沿固定 Rail 进行，减少不必要的横向跳转。

但 Rail 优化并非自动生效。训练框架、NCCL 拓扑发现、容器调度、GPU/NIC NUMA 亲和性和交换网络布线必须一致。否则硬件拥有多条 Rail，软件却可能把流量集中到少数路径。

{% mermaid %}
flowchart TB
    subgraph S1[Server 1]
      G11[GPU 0] --- N11[NIC 0]
      G12[GPU 1] --- N12[NIC 1]
    end
    subgraph S2[Server 2]
      G21[GPU 0] --- N21[NIC 0]
      G22[GPU 1] --- N22[NIC 1]
    end
    subgraph S3[Server 3]
      G31[GPU 0] --- N31[NIC 0]
      G32[GPU 1] --- N32[NIC 1]
    end
    N11 --> R0[Rail 0 Fabric]
    N21 --> R0
    N31 --> R0
    N12 --> R1[Rail 1 Fabric]
    N22 --> R1
    N32 --> R1
{% endmermaid %}

## 六、为什么 400G / 800G 仍然会遇到通信墙

### 1. 序列化时间只是最低下限

在理想情况下，400 Gbit/s 链路发送 1 MiB 数据的纯序列化时间约为 21 微秒，发送 4 MiB 约为 84 微秒。现实中还要加入：

- Ethernet、IP、UDP、RoCE 等头部开销；
- PCIe DMA 与内存访问；
- 队列调度；
- 交换芯片转发；
- FEC 与 PHY Pipeline；
- 路径竞争；
- 接收端处理与完成队列更新。

当 Collective 包含多个阶段、多个跳数和全局同步时，一次通信的有效延迟远高于单链路序列化下限。

### 2. 小消息看时延，大消息看带宽，混合消息看调度

用经典的 $\alpha$-$\beta$ 模型表示一次消息传输：

$$
T(M)=\alpha+\beta M
$$

其中：

- $\alpha$ 是固定启动延迟；
- $\beta$ 是每字节传输时间；
- $M$ 是消息大小。

小消息由 $\alpha$ 主导，提高链路速率的收益有限；大消息由 $\beta M$ 主导，更快的 SerDes 和更多 Lane 更有效。AI 集群的难点在于两者同时存在：控制消息、Doorbell、Completion、小 Bucket 与大规模 Activation/Gradient 可能共享同一 Fabric。

### 3. 尾延迟比平均带宽更危险

同步训练遵循“木桶效应”。999 个 Rank 按时完成，而第 1000 个 Rank 因拥塞晚了 200 微秒，整个 Collective 仍要等它。

因此，AI 网络不仅追求平均吞吐，还要追求：

- 低抖动；
- 低 P99/P999；
- 快速故障检测；
- 稳定的多路径负载均衡；
- Incast 下的队列可控；
- 避免无关流量污染训练关键路径。

### 4. Goodput 比 Line Rate 更诚实

Line Rate 表示端口能够处理的物理线速；Goodput 表示应用最终获得的有效数据吞吐。两者之间可能损失在：

- 协议头与 FEC；
- 重传；
- 空闲与流控；
- PCIe、DMA 和内存系统；
- 软件栈；
- 拥塞与路径不均；
- Collective 算法本身。

所以一张“400G 网卡”只说明它具备进入高性能网络的必要条件，并不能单独证明它能在千卡或万卡训练中维持高扩展效率。

## 七、从工作负载到网络需求

把以上内容压缩成一条因果链：

{% mermaid %}
flowchart LR
    A[模型规模与上下文增长] --> B[多维并行]
    B --> C[Collective 更频繁]
    C --> D[同步与 Incast 增加]
    D --> E[尾延迟和路径热点]
    E --> F[暴露通信时间上升]
    F --> G[MFU 与扩展效率下降]
{% endmermaid %}

这条链条说明，通信墙不是“网速不够快”这么简单。它同时涉及：

- 模型切分；
- Collective 算法；
- GPU 与 NIC 的亲和性；
- 网络拓扑；
- 拥塞控制；
- 传输可靠性；
- 网卡和交换机实现；
- 光电物理层。

## 八、评价一套智算网络，应该看什么

| 层级 | 不应只看 | 更应该看 |
| :--- | :------- | :------- |
| 加速器 | 峰值 FLOPS | MFU、Scaling Efficiency、Step Time |
| 网卡 | 端口标称速率 | Goodput、小包 Mpps、DMA 效率、P99 延迟 |
| 交换机 | 总交换容量 | 二分带宽、缓冲、调度、故障降级 |
| Fabric | 是否“无损” | Incast、热点、重传、尾延迟、稳定性 |
| Collective | 单次带宽测试 | 真实模型下 AllReduce / All-to-All JCT |
| 集群 | GPU 数量 | 作业完成时间、利用率、故障恢复时间 |

## 结语：真正稀缺的是“按时抵达的数据”

AI 集群的演进正在改变基础设施的价值排序。过去我们习惯把 GPU 看作计算主体，把网络看作外设；但在多维并行和大规模同步下，网络已经参与决定每一步计算能否按时开始。

更多 GPU 仍然能够提供更高的理论算力，但只有当通信、拓扑和调度共同跟上，理论算力才会转化为训练吞吐。

上篇回答了通信压力从哪里来。接下来更尖锐的问题是：传统 RoCE 网络为什么如此依赖 PFC？当“绝不丢包”的代价越来越高，可靠性应该由交换机、网卡还是端点承担？

<link rel="stylesheet" href="/css/series-page.css">

<div class="series-nav series-nav--single">
  <a href="/2026/06/28/ai-compute-interconnect-part2-reliability-rethink/" class="series-nav__link">下一篇：重构可靠性 →</a>
</div>

## 参考资料

1. [PaLM: Scaling Language Modeling with Pathways](https://arxiv.org/abs/2204.02311)
2. [NVIDIA Megatron Core: Parallelism Strategies Guide](https://docs.nvidia.com/megatron-core/developer-guide/latest/user-guide/parallelism-guide.html)
3. [Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM](https://arxiv.org/abs/2104.04473)
4. [Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity](https://arxiv.org/abs/2101.03961)
5. [NVIDIA NCCL User Guide: Collective Operations](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html)
6. [NVIDIA Megatron Core: Context Parallelism](https://docs.nvidia.com/megatron-core/developer-guide/latest/user-guide/features/context_parallel.html)
7. [UALink 200G 1.0 Specification Overview](https://ualinkconsortium.org/blog/ualink-200g-1-0-specification-overview-802/)

<!-- 上篇：通信墙——为什么更多 GPU 不等于更高吞吐 -->
