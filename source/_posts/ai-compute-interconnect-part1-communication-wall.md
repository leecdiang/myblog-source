---
lang: zh-CN
title: "智算互联（上）：训练吞吐与通信瓶颈"
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
description: "多维并行改变消息尺寸、同步频率与依赖关系。本文联系 MFU、集合通信、网络拓扑和尾延迟，分析理论算力为何未必转化为有效训练吞吐。"
keywords: 分布式训练, AI集群通信, 集合通信, 网络拓扑, MFU, 长尾同步, 并行策略,Scale-Up, Scale-Out
---

> **Abstract - Part 1**<br>
> Increasing accelerator count raises peak compute capacity, but training throughput also depends on when data becomes available at synchronization points. This article examines the communication patterns induced by data, tensor, pipeline, expert, and context parallelism, and relates them to collective algorithms, topology, exposed communication time, and tail latency. The analysis distinguishes port line rate from application goodput and identifies the conditions under which interconnect constraints limit scaling efficiency.

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

## 一、峰值算力、MFU 与训练吞吐

### 1. MFU 的定义与影响因素

硬件规格通常以 Peak FLOPS 描述计算上限，训练性能评估则需要进一步区分：其中多少吞吐实际用于模型所需的有效计算。

模型 FLOPs 利用率（Model FLOPs Utilization, MFU）可以写成：

$$
\mathrm{MFU}=
\frac{\text{模型每步所需 FLOPs}}{\text{单步时间}\times\text{加速器数量}\times\text{单卡峰值 FLOPS}}
$$

PaLM 将模型有效计算吞吐与硬件理论峰值之比定义为 MFU。通信、访存、重计算及系统等待不计入分子的“有用模型 FLOPs”；这些开销占用执行时间时，会反映为利用率下降。[PaLM: Scaling Language Modeling with Pathways](https://arxiv.org/abs/2204.02311)

MFU 是整体执行效率指标，不能仅凭其偏低就将瓶颈归因于网络。可能原因还包括：

- GPU 内核没有充分利用 Tensor Core
- HBM 带宽或访存模式成为瓶颈
- 计算与通信没有重叠
- 流水线出现 Bubble
- MoE 专家负载不均衡
- 数据加载、Checkpoint 或故障恢复打断训练
- 某个 Rank 变成 Straggler，迫使其余设备等待

网络性能需要与计算内核、存储访问和执行调度共同诊断，才能确定其对利用率下降的实际贡献。

当加速器计算速度提高、同步参与规模扩大时，原本能够与计算重叠的通信也更容易暴露在关键路径上。

### 2. 单步时间与暴露通信开销

一个训练 Step 可以近似拆成：

$$
T_{\mathrm{step}} = T_{\mathrm{compute}} +
T_{\mathrm{exposed\ comm}} +
T_{\mathrm{bubble}} +
T_{\mathrm{sync}} +
T_{\mathrm{I/O}}
$$

$T_{\mathrm{exposed\ comm}}$ 仅表示未被计算覆盖、实际落在关键路径上的通信时间。它与总通信时间并不等价，评估优化收益时需要保持这一口径。

例如，梯度 AllReduce 可以通过分桶在反向传播尚未结束时提前启动。后续层的计算若足够长，部分通信开销可以被覆盖；最后一桶若未及时完成，优化器仍需等待。因此，网络时延增加对 Step 时间的影响可能具有临界性，取决于计算与通信之间尚余多少重叠空间。

定位这类等待，需要将消息传输放回 Step 的依赖关系中分析：

- 通信发生在 Step 的什么位置？
- 是否位于依赖链关键路径？
- 消息能否拆分并流水化？
- 通信库是否理解实际拓扑？
- 发送端、交换网络和接收端是否同时可用？

### 3. 扩展效率与规模相关的同步开销

经典 Amdahl 定律说明，无法并行化的串行部分会限制整体加速比：

$$
S(N)=\frac{1}{(1-P)+\frac{P}{N}}
$$

训练中的不可并行开销并非固定比例。随着卡数增加，通信范围、同步参与者和拓扑跨度都会变化，因此可以进一步写成：

$$
S(N)=\frac{T_1}{\frac{T_{\mathrm{compute}}}{N}+T_{\mathrm{comm}}(N)+T_{\mathrm{sync}}(N)+T_{\mathrm{imbalance}}(N)}
$$

$T_{\mathrm{comm}}(N)$ 与 $T_{\mathrm{sync}}(N)$ 可能随规模增长。增加 GPU 在分摊计算的同时，也可能提高集合通信与同步等待的成本。

这时可以检查扩展效率（Scaling Efficiency）：

$$
\eta(N)=\frac{\text{使用 }N\text{ 张卡的实际加速比}}{N}
$$

若 1024 张卡只达到单卡的 600 倍速度，扩展效率约为 58.6%。这部分效率损失需要按实际瓶颈分解，既不能全部归因于网络，也不能忽略它而直接以卡数估计有效算力。

## 二、并行策略与通信模式

DP、TP、PP、EP 与 CP 沿不同维度划分计算与数据，对应的消息尺寸、调用频率和依赖关系也不同。网络需求必须从具体并行策略推导，笼统的“AI 流量”无法表达这些差异。

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

梯度分桶使 DP 通信表现为一组具有依赖关系的中、大消息。因此，持续带宽影响整体同步效率，末尾几个 Bucket 的尾延迟则可能直接延长 Step。

### 2. Tensor Parallelism：层内同步与时延敏感性

张量并行（Tensor Parallelism, TP）把同一层的矩阵或张量切分到多张 GPU。它解决单卡显存与单卡计算容量不足的问题，但代价是层内频繁同步。

常见通信包括：

- AllReduce；
- AllGather；
- ReduceScatter；
- 点对点交换局部结果。

TP 往往需要在每个 Transformer Layer 内同步，其通信频率高于 DP。即使消息较小，后续矩阵计算也可能依赖其完成，使固定时延难以被其他计算覆盖。

需要重点看：

- 单跳与端到端时延；
- 小到中等消息效率；
- 拥塞下的 P99/P999 延迟；
- 节点内与跨节点拓扑边界。

这也是工程上通常优先将 TP 放置在高带宽、低时延 Scale-up 域内的原因。跨越普通数据中心网络时，必须重新评估层内同步的时延预算。

### 3. Pipeline Parallelism：流水线通信与 Bubble

流水线并行（Pipeline Parallelism, PP）把模型的不同层分配到不同 Stage，并将 Mini-batch 切成多个 Micro-batch，在 Stage 之间流水执行。

它的网络流量主要是：

- Forward 阶段传递 Activation；
- Backward 阶段传递 Activation Gradient；
- 相邻 Stage 间的点对点通信。

PP 的执行效率还受流水线 Bubble 约束。Stage 计算量不均、通信时延波动或 Micro-batch 数量不足，都会形成设备空闲区间。Megatron-LM 的交错调度正是用于减少这类空泡。[Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM](https://arxiv.org/abs/2104.04473)

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

EP 的热点随 Token 路由变化，通信分布不具备规则 Ring AllReduce 那样的对称性。因此，静态 ECMP 哈希未必能够随 MoE 负载变化维持均衡。

### 5. Context Parallelism：序列切分与长上下文通信

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

## 三、集合通信算法与拓扑映射

NVIDIA Collective Communications Library（NCCL）提供 AllReduce、Broadcast、Reduce、AllGather、ReduceScatter 等 GPU 集合通信原语，并根据拓扑选择算法和路径。[NCCL Collective Operations](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html)

### 1. Ring AllReduce 的带宽与延迟

Ring AllReduce 通常由 ReduceScatter 和 AllGather 两阶段组成。每个 Rank 只与相邻 Rank 通信，能够较好利用链路带宽，并避免中心节点成为瓶颈。

对于 $N$ 个 Rank、每个 Rank 数据量为 $M$ 的情形，每个 Rank 传输的数据量近似为：

$$
2\frac{N-1}{N}M
$$

Ring 对大消息通常具有较高的带宽利用率，但 Rank 增多也会增加通信步数及相应延迟项。若消息较小、固定启动开销占主导，其优势便未必成立。

### 2. Tree 算法的步数与拓扑约束

Tree 与 Double Binary Tree 将通信步数降低到对数级，更适合对启动时延敏感的小消息。不过，上层节点及链路承担更集中的聚合流量；逻辑树若与物理拓扑不匹配，仍可能在少数位置形成瓶颈。

### 3. Hierarchical Collective：节点内与节点间归约

现代 GPU 服务器通常同时存在多层互联：

- GPU 封装或板内互联；
- 节点内 NVLink、UALink 类 Scale-up Fabric；
- PCIe 与 CPU/网卡路径；
- 跨节点 Ethernet 或 InfiniBand Scale-out Fabric。

分层集合通信利用这些带宽与时延差异，先在节点内归约，再由各节点代表执行跨节点归约，最后向节点内广播，从而减少穿越较慢或较拥塞层级的数据量。

## 四、Scale-up、Scale-out 与主机互联的边界

NVLink、UALink、PCIe、RoCE 与 UET 都参与加速器之间的数据交换，但服务的控制范围与访问语义不同。比较其性能之前，应先明确各自承担的系统角色。

### 1. Scale-up：紧耦合加速器互联

Scale-up 面向服务器、机架或 Pod 内的紧耦合加速器，追求：

- 极低时延；
- 高带宽密度；
- 直接 Load、Store 与 Atomic 语义；
- 更强的确定性；
- 较小的故障与管理域。

UALink 200G 1.0 就是一个开放的 Scale-up 互联规范，定义加速器与交换机之间的低时延、高带宽连接，并支持 Read、Write 和 Atomic Transaction。[UALink 200G 1.0 Specification Overview](https://ualinkconsortium.org/blog/ualink-200g-1-0-specification-overview-802/)

### 2. Scale-out：跨节点可路由网络

Scale-out 面向跨服务器、跨机架甚至跨园区的集群，优先考虑：

- 可路由与可扩展；
- 多路径；
- 故障隔离；
- 集合通信；
- 多租户与运维；
- 成本和生态兼容。

RoCEv2、InfiniBand 与 Ultra Ethernet Transport（UET）主要服务于这一层。即使 Pod 内部采用高速内存语义互联，多个 Pod 之间仍需可扩展网络，因此 Scale-up 与 Scale-out 通常是不同范围内的互补设计。

### 3. PCIe 与 CXL：主机 I/O 和内存扩展层

PCI Express（PCIe）首先是主机与设备之间的 I/O 互联。CXL 建立在 PCIe 物理层之上，为缓存与内存扩展提供更丰富语义。它们与 Scale-out 网络之间存在交汇，但不能简单视作同一种 Fabric。

<div style="margin:1.8rem 0;padding:1rem 1.1rem;background:var(--surface-card);border:1px solid var(--border-subtle);border-radius:14px">
<svg viewBox="0 0 1000 260" role="img" aria-label="SCALE-UP vs SCALE-OUT"><defs><marker id="pA" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#5d7f96"/></marker></defs><text x="30" y="40" font-size="11" fill="#7b8b99" letter-spacing="2" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">SCALE-UP vs SCALE-OUT</text><text x="30" y="64" font-size="11" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">每一层的延迟预算、可靠性语义与可扩展范围不同</text><ellipse cx="93" cy="230" rx="81" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="14,120 164,120 146,102 -4,102" fill="#7aa6c6"/><polygon points="14,120 164,120 164,220 14,220" fill="#3f6f96"/><polygon points="164,120 146,102 146,202 164,220" fill="#2b5578"/><line x1="14" y1="120" x2="164" y2="120" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="34" cy="140" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="34" y="144" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">01</text><text x="89" y="164" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">GPU / 加速器</text><text x="89" y="183" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">计算与显存</text><ellipse cx="257" cy="230" rx="81" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="178,120 328,120 310,102 160,102" fill="#78b7ae"/><polygon points="178,120 328,120 328,220 178,220" fill="#2f7f7a"/><polygon points="328,120 310,102 310,202 328,220" fill="#1f5f5b"/><line x1="178" y1="120" x2="328" y2="120" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="198" cy="140" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="198" y="144" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">02</text><text x="253" y="164" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Scale-up Fabric</text><text x="253" y="183" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">NVLink / UALink 类</text><ellipse cx="421" cy="230" rx="81" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="342,120 492,120 474,102 324,102" fill="#8fa7b6"/><polygon points="342,120 492,120 492,220 342,220" fill="#5c7383"/><polygon points="492,120 474,102 474,202 492,220" fill="#455c6c"/><line x1="342" y1="120" x2="492" y2="120" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="362" cy="140" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="362" y="144" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">03</text><text x="417" y="164" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">PCIe / CXL</text><text x="417" y="183" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">主机 I/O 与内存扩展</text><ellipse cx="585" cy="230" rx="81" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="506,120 656,120 638,102 488,102" fill="#d2ad72"/><polygon points="506,120 656,120 656,220 506,220" fill="#9a7434"/><polygon points="656,120 638,102 638,202 656,220" fill="#77551f"/><line x1="506" y1="120" x2="656" y2="120" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="526" cy="140" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="526" y="144" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">04</text><text x="581" y="164" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">SmartNIC / RNIC</text><text x="581" y="183" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">协议卸载与拥塞控制</text><ellipse cx="749" cy="230" rx="81" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="670,120 820,120 802,102 652,102" fill="#c59a9a"/><polygon points="670,120 820,120 820,220 670,220" fill="#8a4a4a"/><polygon points="820,120 802,102 802,202 820,220" fill="#6a3434"/><line x1="670" y1="120" x2="820" y2="120" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="690" cy="140" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="690" y="144" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">05</text><text x="745" y="164" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Scale-out Fabric</text><text x="745" y="183" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">RoCE / UET / InfiniBand</text><ellipse cx="913" cy="230" rx="81" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="834,120 984,120 966,102 816,102" fill="#8fc0a9"/><polygon points="834,120 984,120 984,220 834,220" fill="#4f8a6f"/><polygon points="984,120 966,102 966,202 984,220" fill="#356a51"/><line x1="834" y1="120" x2="984" y2="120" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="854" cy="140" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="854" y="144" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">06</text><text x="909" y="164" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">其他服务器 / Pod</text><text x="909" y="183" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">存储与 Checkpoint</text><path d="M168,194 Q171,184 174,194" fill="none" stroke="#5d7f96" stroke-width="2" stroke-linecap="round" marker-end="url(#pA)"/><path d="M332,194 Q335,184 338,194" fill="none" stroke="#5d7f96" stroke-width="2" stroke-linecap="round" marker-end="url(#pA)"/><path d="M496,194 Q499,184 502,194" fill="none" stroke="#5d7f96" stroke-width="2" stroke-linecap="round" marker-end="url(#pA)"/><path d="M660,194 Q663,184 666,194" fill="none" stroke="#5d7f96" stroke-width="2" stroke-linecap="round" marker-end="url(#pA)"/><path d="M824,194 Q827,184 830,194" fill="none" stroke="#5d7f96" stroke-width="2" stroke-linecap="round" marker-end="url(#pA)"/></svg>
<p style="font-size:.78rem;line-height:1.7;color:var(--text-muted);text-align:center;margin:.55rem 0 0">图 1：Scale-up 与 Scale-out 的工程边界。它们不是同一层的替代关系。</p>
</div>

图中边界按工程需求划分，体现不同的延迟预算、可靠性语义与扩展范围，不应将其理解为严格的协议分层图。

## 五、拓扑约束与集群可用带宽

### 1. Clos / Fat-tree 的路径与扩展能力

Clos、Fat-tree 通过 Leaf 接入服务器，再用 Spine 互联，提供多条等价路径和扩展空间。实际带宽还受以下配置影响：

- 上行带宽是否与下行带宽匹配；
- Leaf-to-Spine 是否过订阅；
- ECMP 是否把多条大流哈希到同一路径；
- 跨 Rail 通信是否穿越额外层级；
- 故障后剩余路径是否出现新的热点。

### 2. Oversubscription：共享上行与二分带宽

假设一个 Leaf 交换机有 32 个 400G 下行端口，却只有 16 个 400G 上行端口，那么下行总带宽为 12.8 Tbps，上行只有 6.4 Tbps，过订阅比为 2:1。

单台服务器点对点达到 400G，只能验证该路径在相应条件下的能力。大量服务器同时跨 Leaf 通信时，共享上行仍会限制平均可用带宽。

设备规格通常给出以下局部能力：

- 单端口速率；
- 交换芯片总容量；
- 单条链路延迟。

集群层面的评估还需要纳入：

- Bisection Bandwidth（二分带宽）；
- Oversubscription Ratio（过订阅比）；
- 多路径利用率；
- Job Placement 与拓扑亲和性；
- 故障降级后的剩余容量。

### 3. Rail-optimized：让并行维度与物理网络对齐

AI 集群常把每台服务器内相同编号的 GPU 或网卡连接到同一条 Rail。这样，跨节点 Collective 可以尽量沿固定 Rail 进行，减少不必要的横向跳转。

Rail 的实际利用取决于训练框架、NCCL 拓扑发现、容器调度、GPU/NIC NUMA 亲和性与物理布线的共同配合。多条物理路径若未与软件映射对齐，仍可能出现局部路径集中。

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

## 六、400G / 800G 下的通信墙与性能口径

### 1. 序列化时间与端到端延迟下限

在理想情况下，400 Gbit/s 链路发送 1 MiB 数据的纯序列化时间约为 21 微秒，发送 4 MiB 约为 84 微秒。现实中还要加入：

- Ethernet、IP、UDP、RoCE 等头部开销；
- PCIe DMA 与内存访问；
- 队列调度；
- 交换芯片转发；
- FEC 与 PHY Pipeline；
- 路径竞争；
- 接收端处理与完成队列更新。

上述开销经过多阶段、多跳和全局同步叠加后，应用观察到的通信时间会高于单链路的纯序列化下限。

### 2. 消息尺寸与时延、带宽需求

用经典的 $\alpha$-$\beta$ 模型表示一次消息传输：

$$
T(M)=\alpha+\beta M
$$

其中：

- $\alpha$ 是固定启动延迟；
- $\beta$ 是每字节传输时间；
- $M$ 是消息大小。

小消息主要受 $\alpha$ 约束，仅提高线速通常收益有限；大消息主要受 $\beta M$ 影响，更快 SerDes 与更多 Lane 才能直接缩短传输时间。实际集群还同时承载 Doorbell、Completion、小 Bucket 和大 Activation/Gradient，需要通过调度协调它们对共享 Fabric 的竞争。

### 3. 同步完成时间由尾部 Rank 决定

例如，999 个 Rank 已完成，第 1000 个因拥塞延迟 200 微秒，Collective 仍需等待这 200 微秒。平均时延可能掩盖这部分代价，但同步完成时间会完整承受它。

因此，平均吞吐之外还需要关注以下特征：

- 低抖动；
- 低 P99/P999；
- 快速故障检测；
- 稳定的多路径负载均衡；
- Incast 下的队列可控；
- 避免无关流量污染训练关键路径。

### 4. Line Rate 与应用 Goodput

Line Rate 描述端口的物理线速，Goodput 描述应用最终取得的有效数据吞吐。两者之间的差额可能来自：

- 协议头与 FEC；
- 重传；
- 空闲与流控；
- PCIe、DMA 和内存系统；
- 软件栈；
- 拥塞与路径不均；
- Collective 算法本身。

“400G 网卡”说明端口能力，却不足以推定千卡、万卡训练下的持续有效吞吐；后者必须结合实际拓扑、工作负载和故障状态测量。

## 七、从工作负载推导网络需求

模型切分、通信依赖与执行效率之间的关系可表示如下：

{% mermaid %}
flowchart LR
    A[模型规模与上下文增长] --> B[多维并行]
    B --> C[Collective 更频繁]
    C --> D[同步与 Incast 增加]
    D --> E[尾延迟和路径热点]
    E --> F[暴露通信时间上升]
    F --> G[MFU 与扩展效率下降]
{% endmermaid %}

减少暴露通信时间，需要沿这些依赖逐层检查：

- 模型切分；
- Collective 算法；
- GPU 与 NIC 的亲和性；
- 网络拓扑；
- 拥塞控制；
- 传输可靠性；
- 网卡和交换机实现；
- 光电物理层。

## 八、智算网络的评估维度

| 层级 | 不应只看 | 更应该看 |
| :--- | :------- | :------- |
| 加速器 | 峰值 FLOPS | MFU、Scaling Efficiency、Step Time |
| 网卡 | 端口标称速率 | Goodput、小包 Mpps、DMA 效率、P99 延迟 |
| 交换机 | 总交换容量 | 二分带宽、缓冲、调度、故障降级 |
| Fabric | 是否“无损” | Incast、热点、重传、尾延迟、稳定性 |
| Collective | 单次带宽测试 | 真实模型下 AllReduce / All-to-All JCT |
| 集群 | GPU 数量 | 作业完成时间、利用率、故障恢复时间 |

## 通信就绪时间与有效计算吞吐

在多维并行训练中，网络参与决定数据何时就绪，并通过计算依赖影响下一步任务的启动时间。其作用不能仅用端口带宽概括。

增加 GPU 提高了理论计算容量；实际吞吐能否随之增长，还取决于通信算法、拓扑与调度能否控制关键路径上的等待。

中篇将沿可靠性机制继续分析：RoCE 为何依赖 PFC，逐跳暂停引入哪些代价，以及将丢包恢复更多交由端点承担的条件。

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
