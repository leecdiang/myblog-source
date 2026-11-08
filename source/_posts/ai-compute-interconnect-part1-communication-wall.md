---
lang: zh-CN
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

> **Abstract - Part 1**<br>
> Adding accelerators increases peak compute, but synchronization can leave them waiting for data. This article follows the traffic created by data, tensor, pipeline, expert, and context parallelism, then examines how collectives, topology, and tail latency affect training throughput.

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

规格表给出 Peak FLOPS，训练时却还要看其中多少真的用于模型计算。

模型 FLOPs 利用率（Model FLOPs Utilization, MFU）可以写成：

$$
\mathrm{MFU}=
\frac{\text{模型每步所需 FLOPs}}{\text{单步时间}\times\text{加速器数量}\times\text{单卡峰值 FLOPS}}
$$

PaLM 用模型有效计算吞吐除以硬件理论峰值，定义 MFU。通信、访存、重计算和系统等待不计入分子的“有用模型 FLOPs”，这些开销会反映在利用率里。[PaLM: Scaling Language Modeling with Pathways](https://arxiv.org/abs/2204.02311)

但不能看到 MFU 低，就认定网络慢。原因还可能是：

- GPU 内核没有充分利用 Tensor Core
- HBM 带宽或访存模式成为瓶颈
- 计算与通信没有重叠
- 流水线出现 Bubble
- MoE 专家负载不均衡
- 数据加载、Checkpoint 或故障恢复打断训练
- 某个 Rank 变成 Straggler，迫使其余设备等待

网络需要与这些因素一起排查。

加速器越快、同步规模越大，通信就越不容易藏在计算后面。

### 2. 单步时间应该怎样拆解

一个训练 Step 可以近似拆成：

$$
T_{\mathrm{step}} = T_{\mathrm{compute}} +
T_{\mathrm{exposed\ comm}} +
T_{\mathrm{bubble}} +
T_{\mathrm{sync}} +
T_{\mathrm{I/O}}
$$

$T_{\mathrm{exposed\ comm}}$ 只算没有被计算覆盖、落在关键路径上的通信，不能用总通信时间代替。

梯度 AllReduce 可以分桶，在反向传播尚未结束时提前启动。后续层计算得足够久，就能盖住这部分通信；若最后一桶迟迟未完成，优化器仍得等。于是某个临界点前只是网络慢一点，越过后却可能明显拖长 Step。

定位等待，要把消息放回 Step 的位置：

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

训练里的“串行部分”会随卡数改变，通信范围、同步参与者和拓扑跨度都不是常量。可以进一步写成：

$$
S(N)=\frac{T_1}{\frac{T_{\mathrm{compute}}}{N}+T_{\mathrm{comm}}(N)+T_{\mathrm{sync}}(N)+T_{\mathrm{imbalance}}(N)}
$$

$T_{\mathrm{comm}}(N)$ 与 $T_{\mathrm{sync}}(N)$ 可能随规模上升。加 GPU 分摊了计算，也可能增加集合通信与等待。

这时可以检查扩展效率（Scaling Efficiency）：

$$
\eta(N)=\frac{\text{使用 }N\text{ 张卡的实际加速比}}{N}
$$

1024 张卡若只有单卡的 600 倍速度，扩展效率约 58.6%。其余时间要按瓶颈拆解，不能全算给网络，也不能再把卡数直接当有效算力。

## 二、并行方式怎样改变流量

DP、TP、PP、EP 和 CP 切分的维度不同，产生的消息大小、频率与依赖也不同。“AI 流量”这个名字不足以描述它们。

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

梯度分桶以后，DP 通常是一串带依赖的中、大消息。持续带宽重要，最后几桶的尾延迟也重要。

### 2. Tensor Parallelism：每层都可能等待网络

张量并行（Tensor Parallelism, TP）把同一层的矩阵或张量切分到多张 GPU。它解决单卡显存与单卡计算容量不足的问题，但代价是层内频繁同步。

常见通信包括：

- AllReduce；
- AllGather；
- ReduceScatter；
- 点对点交换局部结果。

TP 往往在每个 Transformer Layer 内同步，频率比 DP 高。消息即使较小，下一步矩阵计算也可能要等它返回，因此难以隐藏。

需要重点看：

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

PP 还受流水线 Bubble 影响。Stage 计算量不均、延迟波动、Micro-batch 太少，都会留出设备空等的区间。Megatron-LM 的交错调度就是为减少这些空泡。[Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM](https://arxiv.org/abs/2104.04473)

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

Token 路由会改变热点，不像规则对称的 Ring AllReduce 那样容易安排。只靠静态 ECMP 哈希，未必能均衡 MoE 流量。

### 5. Context Parallelism：长上下文把序列维度变成互联问题

上下文并行（Context Parallelism, CP）沿序列长度切分输入。它主要服务于长上下文训练，减轻单卡 Activation 与 Attention 计算的内存压力。

上下文从数千增长到数十万甚至更长时，Attention 的 KV、Query 或中间状态需要跨设备交换。CP 还能与 TP、PP、DP 组合，因此长上下文流量会叠加在已有通信上。[Megatron Core Context Parallelism](https://docs.nvidia.com/megatron-core/developer-guide/latest/user-guide/features/context_parallel.html)

### 6. 各种并行方式的流量对照

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

Ring 大消息通常能较好用满带宽，Rank 增多却也增加通信步数和延迟项。小消息由固定开销主导时，未必适合它。

### 2. Tree：减少步数，但更依赖拓扑与上层链路

Tree、Double Binary Tree 把步数降到对数级，更适合小消息与低延迟需求。不过上层节点和链路承担的聚合流量更大，逻辑树与物理拓扑没对齐，仍可能堵在少数位置。

### 3. Hierarchical Collective：先节点内，再节点间

现代 GPU 服务器通常同时存在多层互联：

- GPU 封装或板内互联；
- 节点内 NVLink、UALink 类 Scale-up Fabric；
- PCIe 与 CPU/网卡路径；
- 跨节点 Ethernet 或 InfiniBand Scale-out Fabric。

分层集合通信先做节点内归约，再由各节点代表参与跨节点归约，最后向节点内广播。它减少穿过较慢或较拥塞层级的数据量。

## 四、必须先区分 Scale-up 与 Scale-out

NVLink、UALink、PCIe、RoCE 和 UET 都能连接加速器，但不能只凭这一点互相比较，它们的控制范围与语义不同。

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

<div style="margin:1.8rem 0;padding:1rem 1.1rem;background:var(--surface-card);border:1px solid var(--border-subtle);border-radius:14px">
<svg viewBox="0 0 1000 260" role="img" aria-label="SCALE-UP vs SCALE-OUT"><defs><marker id="pA" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#5d7f96"/></marker></defs><text x="30" y="40" font-size="11" fill="#7b8b99" letter-spacing="2" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">SCALE-UP vs SCALE-OUT</text><text x="30" y="64" font-size="11" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">每一层的延迟预算、可靠性语义与可扩展范围不同</text><ellipse cx="93" cy="230" rx="81" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="14,120 164,120 146,102 -4,102" fill="#7aa6c6"/><polygon points="14,120 164,120 164,220 14,220" fill="#3f6f96"/><polygon points="164,120 146,102 146,202 164,220" fill="#2b5578"/><line x1="14" y1="120" x2="164" y2="120" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="34" cy="140" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="34" y="144" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">01</text><text x="89" y="164" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">GPU / 加速器</text><text x="89" y="183" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">计算与显存</text><ellipse cx="257" cy="230" rx="81" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="178,120 328,120 310,102 160,102" fill="#78b7ae"/><polygon points="178,120 328,120 328,220 178,220" fill="#2f7f7a"/><polygon points="328,120 310,102 310,202 328,220" fill="#1f5f5b"/><line x1="178" y1="120" x2="328" y2="120" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="198" cy="140" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="198" y="144" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">02</text><text x="253" y="164" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Scale-up Fabric</text><text x="253" y="183" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">NVLink / UALink 类</text><ellipse cx="421" cy="230" rx="81" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="342,120 492,120 474,102 324,102" fill="#8fa7b6"/><polygon points="342,120 492,120 492,220 342,220" fill="#5c7383"/><polygon points="492,120 474,102 474,202 492,220" fill="#455c6c"/><line x1="342" y1="120" x2="492" y2="120" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="362" cy="140" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="362" y="144" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">03</text><text x="417" y="164" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">PCIe / CXL</text><text x="417" y="183" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">主机 I/O 与内存扩展</text><ellipse cx="585" cy="230" rx="81" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="506,120 656,120 638,102 488,102" fill="#d2ad72"/><polygon points="506,120 656,120 656,220 506,220" fill="#9a7434"/><polygon points="656,120 638,102 638,202 656,220" fill="#77551f"/><line x1="506" y1="120" x2="656" y2="120" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="526" cy="140" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="526" y="144" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">04</text><text x="581" y="164" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">SmartNIC / RNIC</text><text x="581" y="183" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">协议卸载与拥塞控制</text><ellipse cx="749" cy="230" rx="81" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="670,120 820,120 802,102 652,102" fill="#c59a9a"/><polygon points="670,120 820,120 820,220 670,220" fill="#8a4a4a"/><polygon points="820,120 802,102 802,202 820,220" fill="#6a3434"/><line x1="670" y1="120" x2="820" y2="120" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="690" cy="140" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="690" y="144" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">05</text><text x="745" y="164" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Scale-out Fabric</text><text x="745" y="183" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">RoCE / UET / InfiniBand</text><ellipse cx="913" cy="230" rx="81" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="834,120 984,120 966,102 816,102" fill="#8fc0a9"/><polygon points="834,120 984,120 984,220 834,220" fill="#4f8a6f"/><polygon points="984,120 966,102 966,202 984,220" fill="#356a51"/><line x1="834" y1="120" x2="984" y2="120" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="854" cy="140" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="854" y="144" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">06</text><text x="909" y="164" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">其他服务器 / Pod</text><text x="909" y="183" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">存储与 Checkpoint</text><path d="M168,194 Q171,184 174,194" fill="none" stroke="#5d7f96" stroke-width="2" stroke-linecap="round" marker-end="url(#pA)"/><path d="M332,194 Q335,184 338,194" fill="none" stroke="#5d7f96" stroke-width="2" stroke-linecap="round" marker-end="url(#pA)"/><path d="M496,194 Q499,184 502,194" fill="none" stroke="#5d7f96" stroke-width="2" stroke-linecap="round" marker-end="url(#pA)"/><path d="M660,194 Q663,184 666,194" fill="none" stroke="#5d7f96" stroke-width="2" stroke-linecap="round" marker-end="url(#pA)"/><path d="M824,194 Q827,184 830,194" fill="none" stroke="#5d7f96" stroke-width="2" stroke-linecap="round" marker-end="url(#pA)"/></svg>
<p style="font-size:.78rem;line-height:1.7;color:var(--text-muted);text-align:center;margin:.55rem 0 0">图 1：Scale-up 与 Scale-out 的工程边界。它们不是同一层的替代关系。</p>
</div>

图中的边界按工程需求划分，各层延迟预算、可靠性语义和扩展范围不同，并非协议分层图。

## 五、端口标称速率之外，还要看拓扑

### 1. Clos / Fat-tree：用多级交换换取规模

Clos、Fat-tree 通过 Leaf 接入服务器，再用 Spine 互联，提供多条等价路径和扩展空间。实际带宽还受以下配置影响：

- 上行带宽是否与下行带宽匹配；
- Leaf-to-Spine 是否过订阅；
- ECMP 是否把多条大流哈希到同一路径；
- 跨 Rail 通信是否穿越额外层级；
- 故障后剩余路径是否出现新的热点。

### 2. Oversubscription：端口速率没有消失，二分带宽才是上限

假设一个 Leaf 交换机有 32 个 400G 下行端口，却只有 16 个 400G 上行端口，那么下行总带宽为 12.8 Tbps，上行只有 6.4 Tbps，过订阅比为 2:1。

一台服务器点对点跑满 400G，不能说明大量服务器跨 Leaf 时也都能跑满。共享上行会压低平均可用带宽。

单端口速率、交换芯片容量和单链路延迟，只能说明一部分：

- 单端口速率；
- 交换芯片总容量；
- 单条链路延迟。

放到集群里还要查：

- Bisection Bandwidth（二分带宽）；
- Oversubscription Ratio（过订阅比）；
- 多路径利用率；
- Job Placement 与拓扑亲和性；
- 故障降级后的剩余容量。

### 3. Rail-optimized：让并行维度与物理网络对齐

AI 集群常把每台服务器内相同编号的 GPU 或网卡连接到同一条 Rail。这样，跨节点 Collective 可以尽量沿固定 Rail 进行，减少不必要的横向跳转。

Rail 是否被用好，要同时看训练框架、NCCL 发现、容器调度、GPU/NIC NUMA 亲和性和布线。硬件铺了多条路，软件若没对齐，流量仍会挤到少数路径。

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

多阶段、多跳和全局同步叠加以后，有效通信延迟会高于这里的单链路序列化下限。

### 2. 小消息看时延，大消息看带宽，混合消息看调度

用经典的 $\alpha$-$\beta$ 模型表示一次消息传输：

$$
T(M)=\alpha+\beta M
$$

其中：

- $\alpha$ 是固定启动延迟；
- $\beta$ 是每字节传输时间；
- $M$ 是消息大小。

小消息主要受 $\alpha$ 影响，只加线速收益不大；大消息主要受 $\beta M$ 影响，更快 SerDes、更多 Lane 才更直接。集群往往同时有 Doorbell、Completion、小 Bucket 和大 Activation/Gradient，共享 Fabric 还要靠调度协调。

### 3. 同步点在等最后一个 Rank

999 个 Rank 已完成，第 1000 个因拥塞晚 200 微秒，Collective 仍得等这 200 微秒。平均值会把这段等待藏掉。

因此除了平均吞吐，还要看：

- 低抖动；
- 低 P99/P999；
- 快速故障检测；
- 稳定的多路径负载均衡；
- Incast 下的队列可控；
- 避免无关流量污染训练关键路径。

### 4. 应用最终得到了多少 Goodput

Line Rate 表示端口能够处理的物理线速；Goodput 表示应用最终获得的有效数据吞吐。两者之间可能损失在：

- 协议头与 FEC；
- 重传；
- 空闲与流控；
- PCIe、DMA 和内存系统；
- 软件栈；
- 拥塞与路径不均；
- Collective 算法本身。

“400G 网卡”给出端口能力。千卡、万卡训练能否持续利用，还要在实际拓扑和负载下测。

## 七、从工作负载到网络需求

前面这些依赖可以连成下图：

{% mermaid %}
flowchart LR
    A[模型规模与上下文增长] --> B[多维并行]
    B --> C[Collective 更频繁]
    C --> D[同步与 Incast 增加]
    D --> E[尾延迟和路径热点]
    E --> F[暴露通信时间上升]
    F --> G[MFU 与扩展效率下降]
{% endmermaid %}

要减少暴露的通信时间，可以从这些位置逐项检查：

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

## 下一步计算何时能开始

多维并行下，网络决定数据什么时候就绪，也就参与决定下一步计算什么时候开始。

更多 GPU 提高理论算力，通信、拓扑和调度跟上以后，才有机会变成更高训练吞吐。

中篇继续查这条路径上的可靠性：RoCE 为什么依赖 PFC，逐跳暂停有什么代价，又能否把丢包恢复更多交给端点。

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
