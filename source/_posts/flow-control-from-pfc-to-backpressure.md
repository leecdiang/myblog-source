---
title: "PFC、Credit 与 ready/valid：流控机制比较"
date: 2026-11-05 17:30:00
updated: 2026-11-05 20:23:54
lang: zh-CN
published: true
categories: Silicon & Circuits
tags:
  - 网络流控
  - RDMA
  - 计算机体系结构
  - FPGA
  - 以太网
etoc: true
toc:
  max_depth: 2
description: "有限缓冲与反馈延迟决定流控的作用边界。本文比较 PAUSE、PFC、ECN/DCQCN、credit、ready/valid、TCP 接收窗口与流量整形的控制对象和生效范围。"
mathjax: true
---

{% note primary %}
PFC、PCIe credit 与 ready/valid 都可能抑制发送，但其控制对象、作用范围和反馈时延并不相同。本文沿报文路径分析交换机缓冲、主机互连、片内流水线与接收端软件的资源约束，区分链路暂停、端到端调速、接收空间许可和流量整形。文中涉及 RDMA（远程直接内存访问）；速率与缓冲算例均为理论计算，不代表产品实测。
{% endnote %}

<!-- more -->

## 1. 缓冲积压与反馈控制的作用边界

假设两条 400 Gb/s 输入同时流向一条 400 Gb/s 输出。即使每一条链路都在正常工作，交换机仍然会以大约 400 Gb/s 的净速度积累数据。持续 10 μs，就是额外的 500,000 字节，约 488 KiB。这里暂时忽略链路开销，只计算输入与输出速率之差。

缓冲可以吸收短时突发，无法长期抵消持续的输入、输出速率差。对尚未溢出的队列，占用量变化可由以下收支关系描述：

{% raw %}
<p><strong>队列增量 = 到达的数据量 − 成功送出的数据量。</strong></p>
{% endraw %}

分析积压需要确定三项条件：被保护的缓冲资源、能够减少其输入的发送者，以及反馈生效前的延迟。控制机制的作用范围由这些条件共同限定，仅观察发送速率下降，无法完成机制归因。

{% visual_svg flow-control/fig01_scope %}
图 1｜沿报文路径寻找控制边界。PCIe credit、片内握手、以太网链路级暂停和端到端控制可以同时存在；箭头表示作用范围，不是完整协议栈。依据 <a href="#ref-1">[1]</a>、<a href="#ref-13">[13]</a>、<a href="#ref-15">[15]</a>、<a href="#ref-16">[16]</a> 绘制。
{% endvisual_svg %}

按控制目标区分，三类机制的差别如下。

{% raw %}
<div class="v-figure"><table class="v-matrix"><thead><tr><th>问题</th><th>控制依据</th><th>典型机制</th></tr></thead><tbody><tr><td>流量控制</td><td>接收资源还能承受多少</td><td>PAUSE / PFC、buffer credit、rwnd</td></tr><tr><td>拥塞控制</td><td>共享网络是否正在积压</td><td>DCQCN、DCTCP、TIMELY、HPCC</td></tr><tr><td>流量整形</td><td>本端设定的速率与突发预算</td><td>Token Bucket、发送 pacing</td></tr></tbody></table><p class="v-caption">表 1｜按主要控制目标分类。pacing 是发包节奏的执行手段，也可以接受拥塞控制器给出的目标速率；三个类别并非互斥的硬件分区。</p></div>
{% endraw %}

PAUSE、PFC 会因为队列积压而触发，但它们直接执行的是链路级暂停；ECN 标记的是拥塞，如何降速还要由端点算法决定；一个固定限速的 shaper 则不必知道网络是否拥塞。只看发送速率下降，分辨不出是哪一种机制在起作用。<sup class="cite"><a href="#ref-1">[1]</a></sup><sup class="cite"><a href="#ref-6">[6]</a></sup><sup class="cite"><a href="#ref-20">[20]</a></sup>

## 2. PAUSE 与 PFC：链路暂停与优先级粒度

PAUSE 与 PFC 通过相邻设备间的控制消息限制发送：当 B 的接收缓冲趋于耗尽，B 请求相邻的 A 暂停朝这一方向发送普通数据帧。

传统以太网 PAUSE，也就是常说的 802.3x 流控，不区分这些数据属于哪个业务。PFC，Priority-based Flow Control，则把暂停粒度细化到最多 8 个优先级。这里的“8 个”是协议可表达的粒度，不等于每台设备都能同时启用 8 个无损队列。<sup class="cite"><a href="#ref-1">[1]</a></sup><sup class="cite"><a href="#ref-2">[2]</a></sup><sup class="cite"><a href="#ref-3">[3]</a></sup>

{% visual_svg flow-control/fig02_pause_pfc %}
图 2｜同样是 B 要求 A 停发，PAUSE 不区分普通数据帧的优先级，PFC 可以只暂停指定优先级。示例选择 priority 3，没有赋予它固定业务含义；控制帧不画入这组业务条带。来源：<a href="#ref-1">[1]</a>、<a href="#ref-2">[2]</a>。
{% endvisual_svg %}
{% raw %}
<div class="v-figure paper-figure"><a href="/images/flow-control-papers/pfc-mechanism.png" target="_blank" rel="noopener"><img src="/images/flow-control-papers/pfc-mechanism.png" alt="论文原图：相邻交换机通过 PFC 暂停指定优先级。这里展示的是逐跳反馈，不是按 RDMA QP 暂停。" loading="lazy" /></a><p class="v-caption">论文原图：相邻交换机通过 PFC 暂停指定优先级。这里展示的是逐跳反馈，不是按 RDMA QP 暂停。 来源：<a href="https://www.techscience.com/cmc/v75n1/51518/html">Jin Wang et al. (2023), Figure 1</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>。原图未修改；点击查看大图。</p></div>
{% endraw %}

PFC 缩小了暂停粒度，但其语义仍受优先级映射与链路方向约束。

PFC 暂停链路上的优先级类别，不能直接选择单个 QP（Queue Pair，队列对）。多个 QP 映射到同一优先级时，会同时受到暂停影响；报文分类与硬件队列之间的映射，则取决于设备配置。

暂停请求具有方向性。B 发出的请求约束 A 向 B 的相应发送，不会自动停止 B 向 A 的反向数据，也不等于关闭全双工端口。定时器到期或收到恢复指示后，发送可以继续。<sup class="cite"><a href="#ref-2">[2]</a></sup><sup class="cite"><a href="#ref-3">[3]</a></sup>

这些控制消息由相邻设备处理。NIC 与交换机之间可以运行，交换机与交换机之间也可以运行。普通以太网业务也可以使用这些机制。

## 3. 反馈延迟与 headroom 预算

从生成 PFC 到对端停止发送存在非零延迟，链路及流水线中的在途数据也会继续到达。因此，暂停阈值必须早于缓冲耗尽，并为不可避免的后续输入预留空间。<sup class="cite"><a href="#ref-3">[3]</a></sup>

{% visual_svg flow-control/fig03_stop_delay %}
图 3｜从触发 XOFF 到最后一批不可避免的数据抵达，存在非零的停止生效时间。接收端必须为这段时间预留 headroom。时序为示意，不按实际比例绘制。来源：<a href="#ref-3">[3]</a>。
{% endvisual_svg %}

这块预留空间就是 **headroom**。在“单个输入以固定速率持续到达、接收端暂时完全不排空”的保守模型中：

{% raw %}
<p><code>H ≥ R<sub>in</sub> × T<sub>stop</sub> + B<sub>margin</sub></code></p>
{% endraw %}

H 为预留字节数，R<sub>in</sub> 为流入该缓冲区的字节速率，T<sub>stop</sub> 覆盖从触发暂停到最后一批不可避免的数据抵达的时间，B<sub>margin</sub> 为未建模的实现裕量。整帧尾部和链路在途数据若已折算进 T<sub>stop</sub>，便不应再作为独立项重复计入。

400 Gb/s 换算成字节速率是 50 GB/s。假设 T<sub>stop</sub> 为 2 μs，仅速率与时间的乘积就是 **100,000 B，约 97.7 KiB**。这只是量纲清楚的算例，不是“400G 端口统一配置 100 KB headroom”的建议。

{% visual_svg flow-control/fig04_headroom_theory %}
图 4｜理论缓冲需求 H = R × T。横纵轴均为线性刻度，GB 与 Gb 使用十进制，KiB = 1024 B；假设输入保持标称速率、暂停生效前没有排空，并且不含额外裕量。数据由随包脚本计算，非硬件测量。
{% endvisual_svg %}

共享缓冲的预算还受分配粒度、控制消息排队及多输入并发影响。估计共享池总增量时，应累计所有相关输入并扣除期间排空量，不能以单端口线速代替共享池的实际输入。

常见的 XOFF 与 XON 阈值也不相同：较高的 XOFF 触发暂停，降到较低的 XON 后再允许恢复，形成迟滞，避免占用量在一个阈值附近来回波动。具体阈值必须服从设备的缓冲架构。<sup class="cite"><a href="#ref-3">[3]</a></sup>

## 4. 暂停粒度与拥塞传播

考虑两条业务 A、B：它们经过同一条上游链路，使用同一优先级，但随后走向不同目的地。A 的目的方向拥塞，B 的目的方向空闲。一旦共享上游链路上的这个优先级被暂停，B 也要停。

优先级级别的暂停范围可能大于实际拥塞流的范围，因此会阻塞仍具备可用下游路径的业务。增加 QP 数量或改变目的地，并不保证改变两条业务共享的暂停边界。<sup class="cite"><a href="#ref-4">[4]</a></sup>

{% visual_svg flow-control/fig05_hol %}
图 5｜A、B 共享上游链路的 priority 3。A 所在方向拥塞后，该优先级被暂停，去往空闲方向的 B 也受影响。下方为背压继续向上游传播的示意；每一跳生成自己的流控消息，并不是把原 PFC 帧一路转发。参考 <a href="#ref-4">[4]</a>、<a href="#ref-5">[5]</a>。
{% endvisual_svg %}
{% raw %}
<div class="v-figure paper-figure"><a href="/images/flow-control-papers/pfc-propagation.png" target="_blank" rel="noopener"><img src="/images/flow-control-papers/pfc-propagation.png" alt="论文仿真拓扑：长流与突发短流共享部分上游路径，用于分析 PFC 暂停对非拥塞流的影响。" loading="lazy" /></a><p class="v-caption">论文仿真拓扑：长流与突发短流共享部分上游路径，用于分析 PFC 暂停对非拥塞流的影响。 来源：<a href="https://www.techscience.com/cmc/v75n1/51518/html">Jin Wang et al. (2023), Figure 3</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>。原图未修改；点击查看大图。</p></div>
{% endraw %}

{% raw %}
<div class="v-figure paper-figure"><a href="/images/flow-control-papers/pfc-hol-blocking.png" target="_blank" rel="noopener"><img src="/images/flow-control-papers/pfc-hol-blocking.png" alt="论文原图：Head-of-Line Blocking。拥塞流触发的暂停，会波及共享队列或优先级的其他流。" loading="lazy" /></a><p class="v-caption">论文原图：Head-of-Line Blocking。拥塞流触发的暂停，会波及共享队列或优先级的其他流。 来源：<a href="https://www.techscience.com/cmc/v75n1/51518/html">Jin Wang et al. (2023), Figure 2</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>。原图未修改；点击查看大图。</p></div>
{% endraw %}

下游暂停使上游难以排空，缓冲占用进一步升高后，上游又可能触发更早一跳的 PFC。这种背压传播将局部资源压力扩展到更大范围。

拥塞传播与死锁需要分别判断。死锁还要求循环等待等条件，例如多个缓冲相互等待资源释放；PFC storm 则涉及异常暂停消息持续发送。它们与短时背压具有不同的触发条件和诊断路径，大规模部署论文分别讨论了相应故障与处理经验。<sup class="cite"><a href="#ref-5">[5]</a></sup>

### 论文导读：victim flow 与部署故障

Zhu 等人的 DCQCN 论文 §2.2 讨论 PFC 及 victim-flow 场景，适合核对拥塞路径与受损流路径如何分离，以及优先级暂停绑定了哪些发送者。Guo 等人的 RDMA over Commodity Ethernet at Scale 则在 §4.2 和 §4.3 分别讨论死锁与 PFC storm，补充了真实部署中的故障表现。两篇论文的设备与性能数据均对应各自实验年代，不直接外推至当前产品。

{% raw %}
<p><a class="glass-pill" href="https://conferences.sigcomm.org/sigcomm/2015/pdf/papers/p523.pdf" target="_blank" rel="noopener"><i class="fas fa-file-pdf" aria-hidden="true"></i> DCQCN · SIGCOMM 2015</a> <a class="glass-pill" href="https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/rdma_sigcomm2016.pdf" target="_blank" rel="noopener"><i class="fas fa-file-pdf" aria-hidden="true"></i> RDMA at Scale · SIGCOMM 2016</a></p>
{% endraw %}

## 5. ECN 与 DCQCN 的端到端控制路径

PFC 限制相邻链路上的瞬时发送，但不负责为各源端分配长期可持续的速率。DCQCN（Data Center Quantized Congestion Notification）在 RoCEv2 中采用 ECN 标记、接收端反馈与发送端调速构成闭环。<sup class="cite"><a href="#ref-4">[4]</a></sup>

ECN 是 Explicit Congestion Notification，显式拥塞通知。对具备 ECN 能力的 IP 流量，交换机可以按拥塞判定规则将报文标为 CE，Congestion Experienced。这里的 CE 传达“路径上出现了拥塞”，本身不规定发送方应该减速多少。<sup class="cite"><a href="#ref-6">[6]</a></sup>

在 DCQCN 所描述的 RoCEv2 控制链路中，接收端收到被标记的报文后，向发送端反馈 CNP，即 Congestion Notification Packet。发送端再根据反馈更新发送速率，并在后续过程中探测恢复。接收端可以限制 CNP 的生成频率，因此不能把每个 CE 报文与一个 CNP 机械地一一对应。<sup class="cite"><a href="#ref-4">[4]</a></sup>

{% visual_svg flow-control/fig06_dcqcn %}
图 6｜DCQCN 的控制闭环。交换机观察拥塞并标记，接收端生成反馈，发送端执行调速；控制逻辑分布在不同设备上。箭头时序为示意，不代表每个标记都产生一个 CNP。来源：<a href="#ref-4">[4]</a>、<a href="#ref-6">[6]</a>。
{% endvisual_svg %}
{% raw %}
<div class="v-figure paper-figure"><a href="/images/flow-control-papers/dcqcn-vs-timely-hpcc.png" target="_blank" rel="noopener"><img src="/images/flow-control-papers/dcqcn-vs-timely-hpcc.png" alt="论文原始 NS-3 仿真：在指定突发流量场景下 DCQCN、TIMELY、HPCC 和 FACC 的交换机队列长度与发送速率恢复。这里对比的是拥塞响应，不是 PAUSE/PFC 控制帧时序。" loading="lazy" /></a><p class="v-caption">论文原始 NS-3 仿真：在指定突发流量场景下 DCQCN、TIMELY、HPCC 和 FACC 的交换机队列长度与发送速率恢复。这里对比的是拥塞响应，不是 PAUSE/PFC 控制帧时序。 来源：<a href="https://link.springer.com/article/10.1186/s13677-025-00830-0">Xin He et al. (2025), Figure 2</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>。原图未修改；点击查看大图。</p></div>
{% endraw %}

DCQCN 的速率降低与恢复由算法状态决定，并非每次收到 CNP 都固定减半。速率上下限、更新周期和状态粒度还取决于实现。与 PFC 的逐跳发送资格控制相比，DCQCN 调整的是源端发送速率，两者具有不同的空间范围与响应时间。

组合部署时，拥塞控制用于减少持续积压，PFC 在接收缓冲紧张时提供保护。这种分工仍受反馈时延约束，不能保证任意突发下均无丢包。

“ECN 阈值低于 PFC 阈值”的配置意图，是使端到端反馈在紧急暂停前发挥作用。但 ECN 可能观察出口队列，PFC 可能观察入口优先级组及共享池；若计量对象不同，阈值的数值大小便不能直接比较。DCQCN 论文对缓冲架构与阈值配置的讨论，应在这一前提下理解。<sup class="cite"><a href="#ref-4">[4]</a></sup>

### 论文导读：ECN 标记与拥塞控制算法

继续读 **DCQCN** 的 §3，把发送端、交换机、接收端三个角色对照图 6，再看速率降低与恢复各由什么事件触发。作为对照，读 **DCTCP** 的 §3：它通过 ECN 反馈估计拥塞程度，调整的是 TCP 拥塞窗口。共享 ECN 这个信号，不代表二者具有相同的反馈编码、更新规则或执行接口。<sup class="cite"><a href="#ref-7">[7]</a></sup><sup class="cite"><a href="#ref-8">[8]</a></sup>

{% raw %}
<p><a class="glass-pill" href="https://conferences.sigcomm.org/sigcomm/2015/pdf/papers/p523.pdf" target="_blank" rel="noopener"><i class="fas fa-file-pdf" aria-hidden="true"></i> DCQCN · 源端速率控制</a> <a class="glass-pill" href="https://www.microsoft.com/en-us/research/wp-content/uploads/2017/01/dctcp-sigcomm2010.pdf" target="_blank" rel="noopener"><i class="fas fa-file-pdf" aria-hidden="true"></i> DCTCP · TCP 窗口控制</a></p>
{% endraw %}

## 6. RTT 与遥测提供的拥塞观测

除 ECN 标记外，源端还可以通过往返时延感知积压，或利用报文携带的沿途负载信息。观测精度与信息量的提高，也会增加对网络设备和端点能力的要求。

QCN，Quantized Congestion Notification，是二层以太网中的拥塞通知机制，由网络中的拥塞点向支持速率限制的源端反馈。它与 DCQCN 的名字相近，但不能把二者当成同一协议的两个拼法；作用域和通知路径都不同。<sup class="cite"><a href="#ref-9">[9]</a></sup>

TIMELY 选择 RTT，即往返时延，尤其关注时延变化。队列开始积压，报文往返往往会变慢；难点是测量精度，以及如何把排队变化与其他时延波动区分开。HPCC 则使用 INT，In-band Network Telemetry，带内网络遥测，让端点获得更具体的链路负载信息。更丰富的观测也要求网络设备与端点支持相应机制。<sup class="cite"><a href="#ref-10">[10]</a></sup><sup class="cite"><a href="#ref-11">[11]</a></sup>

{% visual_svg flow-control/fig07_signals %}
图 7｜拥塞控制的观测信号与代价。表中的“代价”指该机制需要额外处理的条件，不是性能排名；QCN、TIMELY、HPCC 也不是可以直接互换的线缆协议。来源：<a href="#ref-4">[4]</a>、<a href="#ref-9">[9]</a>–<a href="#ref-11">[11]</a>。
{% endvisual_svg %}
{% raw %}
<div class="v-figure paper-figure"><a href="/images/flow-control-papers/switch-queue-comparison.png" target="_blank" rel="noopener"><img src="/images/flow-control-papers/switch-queue-comparison.png" alt="论文原始仿真曲线：不同拥塞控制策略下的交换机队列积压，展示队列作为拥塞观测信号的价值；不能由此断言某机制在所有网络中最优。" loading="lazy" /></a><p class="v-caption">论文原始仿真曲线：不同拥塞控制策略下的交换机队列积压，展示队列作为拥塞观测信号的价值；不能由此断言某机制在所有网络中最优。 来源：<a href="https://www.techscience.com/cmc/v75n1/51518/html">Jin Wang et al. (2023), Figure 11</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>。原图未修改；点击查看大图。</p></div>
{% endraw %}

{% raw %}
<div class="v-figure paper-figure"><a href="/images/flow-control-papers/burst-throughput-recovery.png" target="_blank" rel="noopener"><img src="/images/flow-control-papers/burst-throughput-recovery.png" alt="论文原始仿真曲线：突发流量发生后，ICC、DCQCN、TIMELY 与 PCN 的流吞吐恢复过程。属于论文 NS-3 场景，不是现代 400G 网卡实测。" loading="lazy" /></a><p class="v-caption">论文原始仿真曲线：突发流量发生后，ICC、DCQCN、TIMELY 与 PCN 的流吞吐恢复过程。属于论文 NS-3 场景，不是现代 400G 网卡实测。 来源：<a href="https://www.techscience.com/cmc/v75n1/51518/html">Jin Wang et al. (2023), Figure 5</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>。原图未修改；点击查看大图。</p></div>
{% endraw %}

### 论文导读：拥塞信号与反馈控制的取舍

TIMELY 使用 RTT 梯度，原始方案在主机端运行控制算法，并利用 NIC 的低延迟测量能力。HPCC 则依据带内遥测计算发送速率，仍需处理反馈抵达前的状态变化。两项工作的设备能力、负载与实验设置不同，性能数字只有在相应条件下才有可比意义。

{% raw %}
<p><a class="glass-pill" href="https://research.google/pubs/timely-rtt-based-congestion-control-for-the-datacenter/" target="_blank" rel="noopener"><i class="fas fa-file-alt" aria-hidden="true"></i> TIMELY · SIGCOMM 2015</a> <a class="glass-pill" href="https://liyuliang001.github.io/publications/hpcc.pdf" target="_blank" rel="noopener"><i class="fas fa-file-pdf" aria-hidden="true"></i> HPCC · SIGCOMM 2019</a></p>
{% endraw %}

## 7. Credit：接收空间授权

PAUSE/PFC 允许数据持续前进，等接收资源紧张时再要求停下。另一条思路是：发送者先确认自己持有接收端授予的空间额度，额度足够才允许发送。

假设接收端有 8 个等大的缓冲槽，其中 5 个已经占用。在暂时没有在途数据、双方状态已经同步的简化时刻，发送端可以持有 3 个可用 credit。发送一份数据，消耗一个 credit；接收端释放槽位并把可用额度反馈回来，发送者才能再次使用它。

{% visual_svg flow-control/fig08_credit_ledger %}
图 8｜以一个 credit 对应一个固定槽位的教学模型说明空间许可。真实协议可能按字节、块或不同报文类别计数，并通过累计计数更新额度；“返还 credit”不要求逐条发送确认。参考 <a href="#ref-12">[12]</a>、<a href="#ref-13">[13]</a>。
{% endvisual_svg %}

credit 记账需要覆盖在途数据、已承诺的空间和反馈延迟。已释放但尚未反馈的槽位不会立即增加发送端额度；尚未抵达的数据则可能已经占用接收端的预留资源。因此，发送端可用 credit 与接收端即时空闲空间通常不能直接等同。

InfiniBand 的数据虚拟通道使用链路级 credit 管理；PCIe 也有接收流控额度。例如 AMD 的传统 7 系列 PCIe IP 文档把 Posted、Non-Posted、Completion 各自拆成 Header 与 Data 两类，共六组 credit。这个例子说明额度可以按资源类别隔离，并不是在概括所有 PCIe 版本的全部流控细节。<sup class="cite"><a href="#ref-12">[12]</a></sup><sup class="cite"><a href="#ref-13">[13]</a></sup>

### credit 循环时间对吞吐的约束

假设一个简化通道总共有 B<sub>credit</sub> 字节的循环额度，从消耗到重新可用需要 T<sub>return</sub>，链路容量为 C。那么一个必要的吞吐上界是：

{% raw %}
<p><code>R ≤ min(C, B<sub>credit</sub> / T<sub>return</sub>)</code></p>
{% endraw %}

该上界尚未计入报文开销、仲裁和其他资源瓶颈。即使接收缓冲未满，发送端也可能因额度更新尚未返回而停等。因此，缓冲预算既要保证空间安全，也要覆盖 credit 循环延迟。

{% visual_svg flow-control/fig09_credit_window %}
图 9｜理论上界：固定 128 KiB 的循环额度，链路容量为 400 Gb/s。当额度循环时间为 4 μs 时，上界降到约 262.1 Gb/s；2 μs 时，额度本身允许约 524.3 Gb/s，但实际仍受 400 Gb/s 链路限制。线性坐标，非设备实测。
{% endvisual_svg %}

### 延伸阅读：跨链路的 credit 控制

InfiniBand 与 PCIe 文档首先说明链路资源的记账方式；ExpressPass 则研究以 credit 调度实现数据中心端到端拥塞控制。其分析重点是 credit 的传递、限速及对反向数据流的约束。credit 因而是一类可用于不同层次的控制方法，ExpressPass 的端到端设计不应被解释为 InfiniBand 链路规范。<sup class="cite"><a href="#ref-14">[14]</a></sup>

{% raw %}
<p><a class="glass-pill" href="https://www.mellanox.com/pdf/whitepapers/IB_Intro_WP_190.pdf" target="_blank" rel="noopener"><i class="fas fa-file-pdf" aria-hidden="true"></i> InfiniBand · 架构资料</a> <a class="glass-pill" href="https://research.google/pubs/credit-scheduled-delay-bounded-congestion-control-for-datacenters/" target="_blank" rel="noopener"><i class="fas fa-file-alt" aria-hidden="true"></i> ExpressPass · SIGCOMM 2017</a></p>
{% endraw %}

## 8. ready/valid 的周期级接收约束

在片内可停顿接口中，接收能力可以由 `ready` 直接表达，反馈范围缩短到相邻模块及其流水级。

以 AXI-Stream 为例：发送方用 `TVALID` 表示当前数据有效，接收方用 `TREADY` 表示这一拍可以接收。只有在时钟上升沿二者同时为高，才完成一次传输。遇到 `TVALID=1`、`TREADY=0`，发送方必须保持有效数据和相关控制信息，等到握手成功；发送方也不能把“先等到 ready”作为提出 valid 的前提。<sup class="cite"><a href="#ref-15">[15]</a></sup>

{% visual_svg flow-control/fig10_ready_valid %}
图 10｜每一列表示一个时钟上升沿看到的信号值。数据 B 在第 2、3 个采样沿没有被接收，必须保持到第 4 个采样沿握手；总共只传输 A、B、C 三拍。该图描述 AXI-Stream 的基本握手规则，不代表任意同名私有接口。来源：<a href="#ref-15">[15]</a>。
{% endvisual_svg %}

下面是用于说明规则的 SystemVerilog 节选。断言中的 `tdata`、`tkeep`、`tlast` 是示例接口已声明的信号；真实设计还有其他有效负载边带时，也应一起检查。

```systemverilog
// Sampling and state updates use the rising edge of clk.
wire fire = tvalid && tready;

// A stalled beat must remain valid and unchanged until acceptance.
assert property (@(posedge clk) disable iff (!rst_n)
    tvalid && !tready |=>
        tvalid && $stable({tdata, tkeep, tlast}));
```

这条断言检查的是发送端的保持义务，并不能单独证明整个 FIFO 没有丢数据，也没有覆盖复位、跨时钟域或计数器实现。

### 片内背压与链路流控的衔接

接收 DMA 处理变慢可能引起内部 FIFO 积压，并通过 ready/valid 向上游模块传播。要将片内压力转换为链路 PFC，还需要缓冲监测、优先级映射与控制帧生成逻辑，明确触发时机及暂停类别；单独拉低内部 `ready` 并不会完成这一转换。

可停顿内部接口能够等待，已进入物理链路的数据却无法撤回。无法及时停止的外部输入必须由缓冲吸收，否则可能丢弃。`almost_full` 阈值同样需要覆盖检测、流水与背压传播期间的新增数据，其预算结构与 headroom 相近，但反馈距离和数据单位不同。

**AXI-Stream 规范 §2.2** 给出了这组接口的直接约束。重点核对 source 和 destination 各自的义务，尤其是停止接收以后哪些信号必须保持稳定。

{% raw %}
<p><a class="glass-pill" href="https://documentation-service.arm.com/static/64819f1516f0f201aa6b963c" target="_blank" rel="noopener"><i class="fas fa-file-pdf" aria-hidden="true"></i> AMBA AXI-Stream · IHI 0051B</a></p>
{% endraw %}

## 9. 接收资源不足：TCP 窗口与 RDMA 的 RNR

端到端送达还受软件和传输资源约束。网络路径可用，并不等于接收端已经准备好特定操作需要的资源。

TCP 同时面对两个限制。接收窗口 **rwnd** 是接收端通告的接收空间约束；拥塞窗口 **cwnd** 是发送端维护的网络拥塞约束。为理解窗口大小的作用，可以把允许新增的在途字节近似写成：<sup class="cite"><a href="#ref-16">[16]</a></sup><sup class="cite"><a href="#ref-17">[17]</a></sup>

{% raw %}
<div class="table-container" tabindex="0" role="region" aria-label="TCP 发送窗口公式，可横向滚动"><p><code>新增可发送量 ≈ max(0, min(rwnd, cwnd) − FlightSize)</code></p></div>
{% endraw %}

FlightSize 表示已经发送、尚未被确认的数据量。这个简化式省略了重传恢复、窗口边缘与实际发包节奏等细节，但能说明：接收方空间很多，网络拥塞仍然可以限制发送；网络很空闲，接收方没有空间也不能无限灌入。

{% visual_svg flow-control/fig11_receiver_resources %}
图 11｜两类端到端接收约束。左侧为 TCP 简化窗口算例：rwnd = 64 KiB、cwnd = 256 KiB、FlightSize = 48 KiB，新增余量为 16 KiB。右侧为 RC RDMA 的接收 WQE 资源反馈，不是交换机队列告警。来源：<a href="#ref-16">[16]</a>–<a href="#ref-19">[19]</a>。
{% endvisual_svg %}

RDMA 中对应的资源并不一定是同一种“接收字节缓冲”。例如在可靠连接 RC 传输下，SEND 或 RDMA WRITE with Immediate 需要接收端预先准备相应的 Receive WQE，Work Queue Element。没有可用接收 WQE 时，可能返回 **RNR NAK**，Receiver Not Ready Negative Acknowledgement，要求请求方按规则等待、重试。<sup class="cite"><a href="#ref-18">[18]</a></sup>

WRITE with Immediate 的数据写入指定的远端地址，接收 WQE 用于相关接收完成通知，并不接管这次写入的数据缓冲。普通 RDMA WRITE 和 RDMA READ 也不能套用“每次必须先 post receive”的规则。<sup class="cite"><a href="#ref-18">[18]</a></sup><sup class="cite"><a href="#ref-19">[19]</a></sup>

RNR 描述特定 RDMA 操作的端点资源不足，不能替代交换网络的拥塞控制。硬件操作完成也不保证应用环形队列仍有空位，应用可能需要独立的 credit 协商。因此，接收就绪必须具体到链路缓冲、WQE 或应用数据结构。

## 10. 接收额度、整形资格与队列调度

名为 `credit` 的寄存器不必然对应接收缓冲。判断其语义，应检查额度的更新事件，以及它是否代表远端已授予的真实资源。

在 token bucket，令牌桶，模型里，令牌按本地配置的速率随时间补充，发送消耗令牌。若桶容量为 B，补充速率为 r，那么对任意长度为 Δt 的区间，理想字节模型允许的发送量满足：<sup class="cite"><a href="#ref-20">[20]</a></sup>

{% raw %}
<p><code>发送字节数 ≤ B + r × Δt</code></p>
{% endraw %}

B 允许短时突发，r 约束较长时间尺度的平均发送量。它不意味着每一个极短时间片内的瞬时发送速率都必须小于 r；具体实现还要考虑整包发送与记账粒度。

{% visual_svg flow-control/fig12_tokens %}
图 12｜同样是计数器，“为什么增加”决定了含义。令牌桶按时间补充预算，接收 buffer credit 对应下游释放并重新授予的空间。下方表示调度、速率资格与暂停条件共同约束发送的概念关系，不规定固定的硬件排列顺序。参考 <a href="#ref-13">[13]</a>、<a href="#ref-20">[20]</a>。
{% endvisual_svg %}

接收 buffer credit 对应接收方能够承诺的资源，不能仅因时间推移而增加。时间补充的发送预算与资源释放后返回的空间许可，具有不同的约束含义。

以太网 AVB/TSN 的 Credit-Based Shaper 根据发送与空闲阶段的斜率更新 credit，用于仲裁和带宽分配；PCIe、InfiniBand 的接收 credit 则表示远端授予的缓冲许可。更新规则与资源含义，是区分二者的依据。<sup class="cite"><a href="#ref-21">[21]</a></sup>

调度器则主要回答“在当前有资格发送的队列中选谁”。例如轮询或加权调度负责服务分配，shaper 负责速率资格，PFC 状态可能让某类队列暂时失去发送资格。拥塞控制器还可以动态修改发送速率目标。实际硬件往往把这些模块组合起来，但任何一个都不能只凭名字替代另外几个。<sup class="cite"><a href="#ref-20">[20]</a></sup>

## 11. 网卡数据路径中的流控分工

在 NIC 发送路径中，取数、队列选择、速率资格与链路暂停共同约束发送；接收路径负责缓冲、主机写入与资源压力监测。传输反馈和拥塞控制连接两端，形成图 13 所示的多层控制关系。

{% visual_svg flow-control/fig13_composition %}
图 13｜一个概念性的控制分层。实线表示主要数据方向，虚线表示不同作用范围的控制；片内背压与 PFC 的连接必须由实现明确建立。该图不是任何厂商网卡的模块框图，也不暗示所有网卡都实现全部机制。综合 <a href="#ref-1">[1]</a>、<a href="#ref-4">[4]</a>、<a href="#ref-13">[13]</a>、<a href="#ref-15">[15]</a>、<a href="#ref-18">[18]</a>、<a href="#ref-20">[20]</a> 绘制。
{% endvisual_svg %}

同一数据路径依次受到端点软件、片内接口、主机互连、以太网链路和交换网络的约束。RDMA NIC 是这些边界的一部分，不能将全部流控归为网卡中的单一功能。

吞吐诊断也应覆盖这些边界，并将 PFC 计数与其他资源状态结合，避免只依据暂停现象推断端到端原因。

{% raw %}
<div class="v-figure"><table class="v-matrix"><thead><tr><th>观察到什么</th><th>优先追问</th><th>尚不能据此断言</th></tr></thead><tbody><tr><td>某优先级暂停时间增加</td><td>哪一跳、哪个池触发 XOFF？</td><td>所有业务都发生端到端拥塞</td></tr><tr><td>CNP 或 CE 标记增加</td><td>哪条路径积压，源端速率如何变化？</td><td>接收端没有 Receive WQE</td></tr><tr><td>credit 经常耗尽</td><td>下游未释放，还是更新还在路上？</td><td>链路物理带宽不够</td></tr><tr><td>内部 ready 长时间为低</td><td>从哪个模块开始无法排空？</td><td>外部 PFC 一定已经生效</td></tr><tr><td>RNR 重试增加</td><td>操作类型与接收 WQE 补充是否匹配？</td><td>交换机 buffer 溢出</td></tr><tr><td>吞吐稳定停在某个值</td><td>是否命中 shaper、窗口或处理上限？</td><td>一定是某种流控故障</td></tr></tbody></table><p class="v-caption">表 2｜诊断线索而非自动判定规则。计数器名称、统计窗口和可见粒度取决于实现；应结合队列占用与速率变化验证因果。</p></div>
{% endraw %}

### RoCE 与 InfiniBand 的流控组合

InfiniBand 把逐跳 credit 纳入自己的链路设计；RoCE 运行在以太网之上，PFC 为特定优先级提供链路级暂停，ECN/DCQCN 则是一条端到端拥塞控制路径。这些是不同体系下的组合选择，不是“所有 RDMA 天生只能用 PFC”。RDMA 也不等同于 RoCE：基于 TCP 的 iWARP 就属于另一条协议路线。<sup class="cite"><a href="#ref-12">[12]</a></sup><sup class="cite"><a href="#ref-4">[4]</a></sup><sup class="cite"><a href="#ref-23">[23]</a></sup>

逐跳缓冲不溢出，仍可能存在长期排队、热点争用与不公平分配。局部空间安全和端到端资源分配需要分别控制。

**IRN** 论文进一步追问：改进 RDMA NIC 的丢包恢复和在途数据约束，能否降低对 PFC 的依赖？这是一条 NIC 与网络共同设计的研究路线。它支持的判断是“PFC 不是 RDMA 语义上的必要条件”，而不是“把任何现有 RoCE 网络的 PFC 直接关闭都没问题”。<sup class="cite"><a href="#ref-22">[22]</a></sup>

### 论文导读：区分协议语义与实现选择

Revisiting Network Support for RDMA 通过 selective retransmission 减少重复传输，并以带宽时延积约束在途数据。其结论依赖 NIC 具备相应机制，不能直接迁移至未经修改的设备。评估无 PFC 部署时，应先核查这些实现前提。

{% raw %}
<p><a class="glass-pill" href="https://arxiv.org/abs/1806.08159" target="_blank" rel="noopener"><i class="fas fa-file-alt" aria-hidden="true"></i> IRN · SIGCOMM 2018</a></p>
{% endraw %}

诊断发送停顿，应首先定位被保护的资源，再追踪许可来源与反馈时延。缓冲不足、额度循环过慢、速率目标偏低和接收资源补充不足，可以产生相似表象，却需要不同层次的修正。

## 参考资料

以下资料按正文首次使用的主题组织。论文用于机制导读，官方文档用于协议与接口语义；链接核验日期为 2026-11-05。正文未引用论文中的性能数字作为当代设备跑分。

<span id="ref-1" class="ref-anchor"></span>
**[1] IEEE 802.1.** [802.1Qbb — Priority-based Flow Control](https://1.ieee802.org/dcb/802-1qbb/). 工作组项目说明，介绍按优先级的链路级流控。

<span id="ref-2" class="ref-anchor"></span>
**[2] AMD.** [Priority-Based Flow Control Frames](https://docs.amd.com/r/en-US/pg051-tri-mode-eth-mac/Priority-Based-Flow-Control-Frames). *Tri-Mode Ethernet MAC Product Guide*, PG051 v9.0，2024-12-11。帧格式与逐优先级暂停时间。

<span id="ref-3" class="ref-anchor"></span>
**[3] HPE Aruba Networking.** [Priority-based flow control](https://arubanetworking.hpe.com/techdocs/AOS-CX/10.16/HTML/qos_832x-93xx-100xx/Content/Chp_DCB/dcb-pfc.htm). *AOS-CX 10.16 Quality of Service Guide*. 用于解释方向、headroom 和缓冲阈值；其产品配置限制不泛化到所有设备。

<span id="ref-4" class="ref-anchor"></span>
**[4] Yibo Zhu et al.** [Congestion Control for Large-Scale RDMA Deployments](https://conferences.sigcomm.org/sigcomm/2015/pdf/papers/p523.pdf). SIGCOMM 2015. DOI: [10.1145/2785956.2787484](https://doi.org/10.1145/2785956.2787484). DCQCN 原始论文。

<span id="ref-5" class="ref-anchor"></span>
**[5] Chuanxiong Guo et al.** [RDMA over Commodity Ethernet at Scale](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/rdma_sigcomm2016.pdf). SIGCOMM 2016. DOI: [10.1145/2934872.2934908](https://doi.org/10.1145/2934872.2934908).

<span id="ref-6" class="ref-anchor"></span>
**[6] K. Ramakrishnan, S. Floyd, D. Black.** [RFC 3168: The Addition of Explicit Congestion Notification (ECN) to IP](https://www.rfc-editor.org/rfc/rfc3168.html). 2001。用于 ECN/CE 基础语义，不代替 RoCE 的反馈协议。

<span id="ref-7" class="ref-anchor"></span>
**[7] Mohammad Alizadeh et al.** [Data Center TCP (DCTCP)](https://www.microsoft.com/en-us/research/wp-content/uploads/2017/01/dctcp-sigcomm2010.pdf). SIGCOMM 2010。

<span id="ref-8" class="ref-anchor"></span>
**[8] S. Bensley et al.** [RFC 8257: Data Center TCP (DCTCP): TCP Congestion Control for Data Centers](https://www.rfc-editor.org/rfc/rfc8257.html). 2017，Informational。

<span id="ref-9" class="ref-anchor"></span>
**[9] IEEE 802.1.** [802.1Qau — Congestion Notification](https://1.ieee802.org/dcb/802-1qau/). QCN 的作用域与源端速率限制。

<span id="ref-10" class="ref-anchor"></span>
**[10] Radhika Mittal et al.** [TIMELY: RTT-based Congestion Control for the Datacenter](https://research.google/pubs/timely-rtt-based-congestion-control-for-the-datacenter/). SIGCOMM 2015. DOI: [10.1145/2785956.2787510](https://doi.org/10.1145/2785956.2787510).

<span id="ref-11" class="ref-anchor"></span>
**[11] Yuliang Li et al.** [HPCC: High Precision Congestion Control](https://liyuliang001.github.io/publications/hpcc.pdf). SIGCOMM 2019. DOI: [10.1145/3341302.3342085](https://doi.org/10.1145/3341302.3342085).

<span id="ref-12" class="ref-anchor"></span>
**[12] Mellanox Technologies.** [Introduction to InfiniBand](https://www.mellanox.com/pdf/whitepapers/IB_Intro_WP_190.pdf). Rev. 1.90。只引用链路和虚拟通道的基础流控原理，不引用旧代际速率或产品结论。

<span id="ref-13" class="ref-anchor"></span>
**[13] AMD.** [Flow Control Credit Information](https://docs.amd.com/r/en-US/pg054-7series-pcie/Flow-Control-Credit-Information). *7 Series FPGAs Integrated Block for PCI Express*, PG054 v3.3，2024-12-06。作为传统 PCIe IP 的六类 credit 示例。

<span id="ref-14" class="ref-anchor"></span>
**[14] Inho Cho, Keon Jang, Dongsu Han.** [Credit-Scheduled Delay-Bounded Congestion Control for Datacenters](https://research.google/pubs/credit-scheduled-delay-bounded-congestion-control-for-datacenters/). SIGCOMM 2017。ExpressPass。

<span id="ref-15" class="ref-anchor"></span>
**[15] Arm.** [AMBA AXI-Stream Protocol Specification](https://documentation-service.arm.com/static/64819f1516f0f201aa6b963c). IHI 0051B，2021，§2.2。握手与停顿时的信号保持要求。

<span id="ref-16" class="ref-anchor"></span>
**[16] W. Eddy, Ed.** [RFC 9293: Transmission Control Protocol (TCP)](https://www.rfc-editor.org/rfc/rfc9293.html). 2022。TCP 接收窗口与流量控制。

<span id="ref-17" class="ref-anchor"></span>
**[17] M. Allman, V. Paxson, E. Blanton.** [RFC 5681: TCP Congestion Control](https://www.rfc-editor.org/rfc/rfc5681.html). 2009。cwnd、rwnd 与 FlightSize 的基础关系。

<span id="ref-18" class="ref-anchor"></span>
**[18] NVIDIA.** [RDMA-aware Networks Programming Guide](https://networking-docs.nvidia.com/doca/archive/3-5-0/rdma-aware-networks-programming-guide). DOCA 3.5.0 文档归档。操作语义、接收 WQE 与 RNR。

<span id="ref-19" class="ref-anchor"></span>
**[19] NVIDIA.** [DOCA RDMA Programming Guide](https://docs.nvidia.com/doca/archive/doca-v2.2.1/rdma-programming-guide/index.html). DOCA 2.2.1。用于核对 WRITE with Immediate 的数据与接收通知语义。

<span id="ref-20" class="ref-anchor"></span>
**[20] Y. Bernet et al.** [RFC 3290: An Informal Management Model for Diffserv Routers](https://www.rfc-editor.org/rfc/rfc3290.html). 2002。调度、整形与令牌桶模型；该文为 Informational，不是某一硬件实现规范。

<span id="ref-21" class="ref-anchor"></span>
**[21] AMD.** [Credit-Based Traffic Shaping Algorithm](https://docs.amd.com/r/en-US/pg051-tri-mode-eth-mac/Credit-Based-Traffic-Shaping-Algorithm). PG051 v9.0，2024-12-11。AVB credit-based shaper 的斜率记账。

<span id="ref-22" class="ref-anchor"></span>
**[22] Radhika Mittal et al.** [Revisiting Network Support for RDMA](https://arxiv.org/abs/1806.08159). SIGCOMM 2018. DOI: [10.1145/3230543.3230557](https://doi.org/10.1145/3230543.3230557). IRN。

<span id="ref-23" class="ref-anchor"></span>
**[23] R. Recio et al.** [RFC 5040: A Remote Direct Memory Access Protocol Specification](https://www.rfc-editor.org/rfc/rfc5040.html). 2007。iWARP/RDMAP 协议背景。
