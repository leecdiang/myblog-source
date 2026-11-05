---
title: 从 PFC 到 ready/valid：流控到底在控制什么？
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
description: 从有限缓冲区与反馈延迟出发，串起 PAUSE、PFC、ECN/DCQCN、credit、ready/valid、TCP 接收窗口与流量整形，理解每种机制控制什么、在哪里生效，以及为什么不能互相替代。
mathjax: true
---

{% note primary %}
看到 PFC、PAUSE，很容易把“流控”理解成 RDMA（远程直接内存访问）网卡里的某个功能开关。沿着一条报文路径走一遍，会发现交换机、PCIe、网卡内部流水线和接收端软件都可能要求发送方等一等。本文从缓冲区和反馈延迟讲起，区分暂停、调速、空间许可与整形额度。文中的速率与缓冲算例均为理论计算，不是特定产品的实测结果。
{% endnote %}

<!-- more -->

## 1. 先找缓冲区，再问谁该慢下来

假设两条 400 Gb/s 输入同时流向一条 400 Gb/s 输出。即使每一条链路都在正常工作，交换机仍然会以大约 400 Gb/s 的净速度积累数据。持续 10 μs，就是额外的 500,000 字节，约 488 KiB。这里暂时忽略链路开销，只计算输入与输出速率之差。

缓冲区能接住突发，却不能消除持续的速率差。对一个尚未溢出的队列，可以先用一个简单的收支关系理解它：

{% raw %}
<p><strong>队列增量 = 到达的数据量 − 成功送出的数据量。</strong></p>
{% endraw %}

定位这类积压，先问：**哪块缓冲区在积压？谁有能力减少它的输入？反馈多久能生效？** 控制的资源和距离不同，“让发送方慢下来”的办法也会不同。

{% visual_svg flow-control/fig01_scope %}
图 1｜沿报文路径寻找控制边界。PCIe credit、片内握手、以太网链路级暂停和端到端控制可以同时存在；箭头表示作用范围，不是完整协议栈。依据 <a href="#ref-1">[1]</a>、<a href="#ref-13">[13]</a>、<a href="#ref-15">[15]</a>、<a href="#ref-16">[16]</a> 绘制。
{% endvisual_svg %}

按控制目标，可以先分成下面三类。

{% raw %}
<div class="v-figure"><table class="v-matrix"><thead><tr><th>问题</th><th>控制依据</th><th>典型机制</th></tr></thead><tbody><tr><td>流量控制</td><td>接收资源还能承受多少</td><td>PAUSE / PFC、buffer credit、rwnd</td></tr><tr><td>拥塞控制</td><td>共享网络是否正在积压</td><td>DCQCN、DCTCP、TIMELY、HPCC</td></tr><tr><td>流量整形</td><td>本端设定的速率与突发预算</td><td>Token Bucket、发送 pacing</td></tr></tbody></table><p class="v-caption">表 1｜按主要控制目标分类。pacing 是发包节奏的执行手段，也可以接受拥塞控制器给出的目标速率；三个类别并非互斥的硬件分区。</p></div>
{% endraw %}

PAUSE、PFC 会因为队列积压而触发，但它们直接执行的是链路级暂停；ECN 标记的是拥塞，如何降速还要由端点算法决定；一个固定限速的 shaper 则不必知道网络是否拥塞。只看发送速率下降，分辨不出是哪一种机制在起作用。<sup class="cite"><a href="#ref-1">[1]</a></sup><sup class="cite"><a href="#ref-6">[6]</a></sup><sup class="cite"><a href="#ref-20">[20]</a></sup>

## 2. PAUSE 与 PFC：暂停相邻链路，粒度不同

先看最直接的办法。B 的接收缓冲区快装不下了，就向相邻的 A 发一条控制消息，要求 A 暂时不要再朝这个方向发送普通数据帧。

传统以太网 PAUSE，也就是常说的 802.3x 流控，不区分这些数据属于哪个业务。PFC，Priority-based Flow Control，则把暂停粒度细化到最多 8 个优先级。这里的“8 个”是协议可表达的粒度，不等于每台设备都能同时启用 8 个无损队列。<sup class="cite"><a href="#ref-1">[1]</a></sup><sup class="cite"><a href="#ref-2">[2]</a></sup><sup class="cite"><a href="#ref-3">[3]</a></sup>

{% visual_svg flow-control/fig02_pause_pfc %}
图 2｜同样是 B 要求 A 停发，PAUSE 不区分普通数据帧的优先级，PFC 可以只暂停指定优先级。示例选择 priority 3，没有赋予它固定业务含义；控制帧不画入这组业务条带。来源：<a href="#ref-1">[1]</a>、<a href="#ref-2">[2]</a>。
{% endvisual_svg %}
{% raw %}
<div class="v-figure paper-figure"><a href="/images/flow-control-papers/pfc-mechanism.png" target="_blank" rel="noopener"><img src="/images/flow-control-papers/pfc-mechanism.png" alt="论文原图：相邻交换机通过 PFC 暂停指定优先级。这里展示的是逐跳反馈，不是按 RDMA QP 暂停。" loading="lazy" /></a><p class="v-caption">论文原图：相邻交换机通过 PFC 暂停指定优先级。这里展示的是逐跳反馈，不是按 RDMA QP 暂停。 来源：<a href="https://www.techscience.com/cmc/v75n1/51518/html">Jin Wang et al. (2023), Figure 1</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>。原图未修改；点击查看大图。</p></div>
{% endraw %}


“PFC 是 PAUSE 的升级版”这个理解还需要补上两个限定。

第一，**PFC 暂停的是链路上的优先级，不是单个 RDMA QP。** QP 是 Queue Pair，即队列对；多个 QP 完全可能映射到同一优先级，并一起受到影响。优先级如何从报文分类映射到硬件队列，还取决于设备配置。

第二，暂停有方向。B 发出的请求影响 A 向 B 的相应数据发送，不是把整个全双工端口断开，也不等于 B 向 A 的反向数据自动停下。暂停定时器到期，或收到相应的恢复指示后，发送可以继续。<sup class="cite"><a href="#ref-2">[2]</a></sup><sup class="cite"><a href="#ref-3">[3]</a></sup>

这些控制消息由相邻设备处理。NIC 与交换机之间可以运行，交换机与交换机之间也可以运行。普通以太网业务也可以使用这些机制。

## 3. 按下暂停以后，数据为什么还在进来

发送 PFC 的瞬间，链路不会立刻安静下来。请求需要被生成和传输，对端需要作出反应，已经在链路上或流水线里的数据还会继续到达。PFC 的阈值因此不能简单设在“缓冲区已经满了”的位置。<sup class="cite"><a href="#ref-3">[3]</a></sup>

{% visual_svg flow-control/fig03_stop_delay %}
图 3｜从触发 XOFF 到最后一批不可避免的数据抵达，存在非零的停止生效时间。接收端必须为这段时间预留 headroom。时序为示意，不按实际比例绘制。来源：<a href="#ref-3">[3]</a>。
{% endvisual_svg %}

这块预留空间就是 **headroom**。在“单个输入以固定速率持续到达、接收端暂时完全不排空”的保守模型中：

{% raw %}
<p><code>H ≥ R<sub>in</sub> × T<sub>stop</sub> + B<sub>margin</sub></code></p>
{% endraw %}

这里，H 是预留字节数；R<sub>in</sub> 是该缓冲区承受的输入字节速率；T<sub>stop</sub> 从触发暂停算到最后一批不可避免的数据抵达；B<sub>margin</sub> 为模型之外的实现裕量。若把整帧尾部和链路中在途数据的影响计入 T<sub>stop</sub>，就不要再用另一个“在途报文项”重复计算。

400 Gb/s 换算成字节速率是 50 GB/s。假设 T<sub>stop</sub> 为 2 μs，仅速率与时间的乘积就是 **100,000 B，约 97.7 KiB**。这只是量纲清楚的算例，不是“400G 端口统一配置 100 KB headroom”的建议。

{% visual_svg flow-control/fig04_headroom_theory %}
图 4｜理论缓冲需求 H = R × T。横纵轴均为线性刻度，GB 与 Gb 使用十进制，KiB = 1024 B；假设输入保持标称速率、暂停生效前没有排空，并且不含额外裕量。数据由随包脚本计算，非硬件测量。
{% endvisual_svg %}

真实设备还要看缓冲区按什么粒度分配、流控消息如何排队，以及同一共享池是否同时承受多个输入。若确实在估算共享池的总增量，就应累计流入它的各条输入，扣除期间的排空；不能拿某一端口的线速代替所有输入。

常见的 XOFF 与 XON 阈值也不相同：较高的 XOFF 触发暂停，降到较低的 XON 后再允许恢复，形成迟滞，避免占用量在一个阈值附近来回波动。具体阈值必须服从设备的缓冲架构。<sup class="cite"><a href="#ref-3">[3]</a></sup>

## 4. PFC 保住了缓冲区，也可能扩大拥塞

考虑两条业务 A、B：它们经过同一条上游链路，使用同一优先级，但随后走向不同目的地。A 的目的方向拥塞，B 的目的方向空闲。一旦共享上游链路上的这个优先级被暂停，B 也要停。

这就是 PFC 容易带来队头阻塞和无辜流受影响的原因：暂停的粒度比实际拥塞的流更粗。只把 QP 数量加大，或者把另一条业务的目的地换掉，都不保证能够绕开这条共享的暂停边界。<sup class="cite"><a href="#ref-4">[4]</a></sup>

{% visual_svg flow-control/fig05_hol %}
图 5｜A、B 共享上游链路的 priority 3。A 所在方向拥塞后，该优先级被暂停，去往空闲方向的 B 也受影响。下方为背压继续向上游传播的示意；每一跳生成自己的流控消息，并不是把原 PFC 帧一路转发。参考 <a href="#ref-4">[4]</a>、<a href="#ref-5">[5]</a>。
{% endvisual_svg %}
{% raw %}
<div class="v-figure paper-figure"><a href="/images/flow-control-papers/pfc-propagation.png" target="_blank" rel="noopener"><img src="/images/flow-control-papers/pfc-propagation.png" alt="论文仿真拓扑：长流与突发短流共享部分上游路径，用于分析 PFC 暂停对非拥塞流的影响。" loading="lazy" /></a><p class="v-caption">论文仿真拓扑：长流与突发短流共享部分上游路径，用于分析 PFC 暂停对非拥塞流的影响。 来源：<a href="https://www.techscience.com/cmc/v75n1/51518/html">Jin Wang et al. (2023), Figure 3</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>。原图未修改；点击查看大图。</p></div>
{% endraw %}

{% raw %}
<div class="v-figure paper-figure"><a href="/images/flow-control-papers/pfc-hol-blocking.png" target="_blank" rel="noopener"><img src="/images/flow-control-papers/pfc-hol-blocking.png" alt="论文原图：Head-of-Line Blocking。拥塞流触发的暂停，会波及共享队列或优先级的其他流。" loading="lazy" /></a><p class="v-caption">论文原图：Head-of-Line Blocking。拥塞流触发的暂停，会波及共享队列或优先级的其他流。 来源：<a href="https://www.techscience.com/cmc/v75n1/51518/html">Jin Wang et al. (2023), Figure 2</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>。原图未修改；点击查看大图。</p></div>
{% endraw %}


暂停还可能向上游传播：下游暂停，上游无法排空，自己的缓冲继续升高，于是再向更上游发出 PFC。拥塞影响的范围由此扩大。

拥塞传播未必形成死锁；**死锁需要形成循环等待等条件**，例如几组缓冲区互相等待对方先释放资源。持续发送异常暂停消息造成的 PFC storm，也应与一般的短时背压区分开。把这几种现象统称为“PFC 导致卡死”，不利于定位问题。大规模部署论文分别讨论了这些故障模式和处理经验。<sup class="cite"><a href="#ref-5">[5]</a></sup>

### 论文导读：先看“暂停为什么伤及无辜”

Zhu 等人的 **DCQCN 论文**不必一上来就读算法公式。先看 §2.2 对 PFC 的讨论，以及文中的 victim-flow 场景：拥塞链路与受损流是否是同一条路径？暂停究竟把哪些发送者绑在了一起？再读 Guo 等人的 **RDMA over Commodity Ethernet at Scale**，重点看 §4.2 的死锁与 §4.3 的 PFC storm。前者解释机制为何会产生副作用，后者说明故障在部署中怎样暴露。两篇论文中的设备和性能数据均属于各自年代，不直接外推到今天的产品。

{% raw %}
<p><a class="glass-pill" href="https://conferences.sigcomm.org/sigcomm/2015/pdf/papers/p523.pdf" target="_blank" rel="noopener"><i class="fas fa-file-pdf" aria-hidden="true"></i> DCQCN · SIGCOMM 2015</a> <a class="glass-pill" href="https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/rdma_sigcomm2016.pdf" target="_blank" rel="noopener"><i class="fas fa-file-pdf" aria-hidden="true"></i> RDMA at Scale · SIGCOMM 2016</a></p>
{% endraw %}

## 5. ECN 与 DCQCN：让源端把速度降下来

PFC 能阻止某条相邻链路继续灌入，却没有替各个源端安排一个长期可持续的发送速率。DCQCN（Data Center Quantized Congestion Notification）在 RoCEv2 中采用的控制路径是 **ECN 标记 → 接收端反馈 → 发送端调速**。<sup class="cite"><a href="#ref-4">[4]</a></sup>

ECN 是 Explicit Congestion Notification，显式拥塞通知。对具备 ECN 能力的 IP 流量，交换机可以按拥塞判定规则将报文标为 CE，Congestion Experienced。这里的 CE 传达“路径上出现了拥塞”，本身不规定发送方应该减速多少。<sup class="cite"><a href="#ref-6">[6]</a></sup>

在 DCQCN 所描述的 RoCEv2 控制链路中，接收端收到被标记的报文后，向发送端反馈 CNP，即 Congestion Notification Packet。发送端再根据反馈更新发送速率，并在后续过程中探测恢复。接收端可以限制 CNP 的生成频率，因此不能把每个 CE 报文与一个 CNP 机械地一一对应。<sup class="cite"><a href="#ref-4">[4]</a></sup>

{% visual_svg flow-control/fig06_dcqcn %}
图 6｜DCQCN 的控制闭环。交换机观察拥塞并标记，接收端生成反馈，发送端执行调速；控制逻辑分布在不同设备上。箭头时序为示意，不代表每个标记都产生一个 CNP。来源：<a href="#ref-4">[4]</a>、<a href="#ref-6">[6]</a>。
{% endvisual_svg %}
{% raw %}
<div class="v-figure paper-figure"><a href="/images/flow-control-papers/dcqcn-vs-timely-hpcc.png" target="_blank" rel="noopener"><img src="/images/flow-control-papers/dcqcn-vs-timely-hpcc.png" alt="论文原始 NS-3 仿真：在指定突发流量场景下 DCQCN、TIMELY、HPCC 和 FACC 的交换机队列长度与发送速率恢复。这里对比的是拥塞响应，不是 PAUSE/PFC 控制帧时序。" loading="lazy" /></a><p class="v-caption">论文原始 NS-3 仿真：在指定突发流量场景下 DCQCN、TIMELY、HPCC 和 FACC 的交换机队列长度与发送速率恢复。这里对比的是拥塞响应，不是 PAUSE/PFC 控制帧时序。 来源：<a href="https://link.springer.com/article/10.1186/s13677-025-00830-0">Xin He et al. (2025), Figure 2</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>。原图未修改；点击查看大图。</p></div>
{% endraw %}


“收到 CNP 就固定减半”不是 DCQCN 的准确概括。减速与恢复由算法状态决定；工程实现中的速率上下限、更新周期和状态粒度，也要看具体实现。最重要的区别是：PFC 直接控制一跳内的优先级能否发送，DCQCN 让源端根据拥塞反馈调整流的发送速率。

因此，两者可以配合：先用拥塞控制减少积压，必要时再由 PFC 保护相应接收缓冲。但这个配合不会消除反馈时延，也不意味着任意突发都一定不丢包。

还要小心“ECN 阈值一定低于 PFC 阈值”这句配置口诀。其意图是让拥塞反馈早于紧急暂停发挥作用；但交换机的 ECN 可能依据出口队列，PFC 可能依据入口优先级组及共享池。**观察对象不同的两个数值，不能不看缓冲架构就直接比较大小。** DCQCN 论文对交换机缓冲与阈值配置的讨论，正是为了处理这类问题。<sup class="cite"><a href="#ref-4">[4]</a></sup>

### 论文导读：同样使用 ECN，为什么不等于同一种算法

继续读 **DCQCN** 的 §3，把发送端、交换机、接收端三个角色对照图 6，再看速率降低与恢复各由什么事件触发。作为对照，读 **DCTCP** 的 §3：它通过 ECN 反馈估计拥塞程度，调整的是 TCP 拥塞窗口。共享 ECN 这个信号，不代表二者具有相同的反馈编码、更新规则或执行接口。<sup class="cite"><a href="#ref-7">[7]</a></sup><sup class="cite"><a href="#ref-8">[8]</a></sup>

{% raw %}
<p><a class="glass-pill" href="https://conferences.sigcomm.org/sigcomm/2015/pdf/papers/p523.pdf" target="_blank" rel="noopener"><i class="fas fa-file-pdf" aria-hidden="true"></i> DCQCN · 源端速率控制</a> <a class="glass-pill" href="https://www.microsoft.com/en-us/research/wp-content/uploads/2017/01/dctcp-sigcomm2010.pdf" target="_blank" rel="noopener"><i class="fas fa-file-pdf" aria-hidden="true"></i> DCTCP · TCP 窗口控制</a></p>
{% endraw %}

## 6. 除了 ECN，还能观察什么

源端要减速，总得先知道网络正在发生什么。ECN 之外，还可以观察往返时延，或让报文携带沿途设备测得的负载信息。

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


### 论文导读：信号更丰富，控制一定更好吗

读 **TIMELY**，先看它为什么使用 RTT 梯度，再看主机端算法如何与低延迟测量配合。其原始方案在主机端运行拥塞控制算法，并利用 NIC 提供的低延迟测量能力。读 **HPCC**，重点看遥测信息怎样变成发送速率，以及反馈回来之前网络又可能发生什么变化。不要只比较两篇摘要里的性能数字；它们采用的设备能力、工作负载和实验设置并不相同。

{% raw %}
<p><a class="glass-pill" href="https://research.google/pubs/timely-rtt-based-congestion-control-for-the-datacenter/" target="_blank" rel="noopener"><i class="fas fa-file-alt" aria-hidden="true"></i> TIMELY · SIGCOMM 2015</a> <a class="glass-pill" href="https://liyuliang001.github.io/publications/hpcc.pdf" target="_blank" rel="noopener"><i class="fas fa-file-pdf" aria-hidden="true"></i> HPCC · SIGCOMM 2019</a></p>
{% endraw %}

## 7. Credit：发送之前，先取得空间许可

PAUSE/PFC 允许数据持续前进，等接收资源紧张时再要求停下。另一条思路是：发送者先确认自己持有接收端授予的空间额度，额度足够才允许发送。

假设接收端有 8 个等大的缓冲槽，其中 5 个已经占用。在暂时没有在途数据、双方状态已经同步的简化时刻，发送端可以持有 3 个可用 credit。发送一份数据，消耗一个 credit；接收端释放槽位并把可用额度反馈回来，发送者才能再次使用它。

{% visual_svg flow-control/fig08_credit_ledger %}
图 8｜以一个 credit 对应一个固定槽位的教学模型说明空间许可。真实协议可能按字节、块或不同报文类别计数，并通过累计计数更新额度；“返还 credit”不要求逐条发送确认。参考 <a href="#ref-12">[12]</a>、<a href="#ref-13">[13]</a>。
{% endvisual_svg %}

实际记账要覆盖在途数据和已经承诺出去的空间，并处理反馈延迟。发送端“当前可用 credit”不一定等于接收端此刻实际空闲的槽位数：有些空间已经释放，但更新还没传回来；有些数据还在路上，空间却已经为它预留。

InfiniBand 的数据虚拟通道使用链路级 credit 管理；PCIe 也有接收流控额度。例如 AMD 的传统 7 系列 PCIe IP 文档把 Posted、Non-Posted、Completion 各自拆成 Header 与 Data 两类，共六组 credit。这个例子说明额度可以按资源类别隔离，并不是在概括所有 PCIe 版本的全部流控细节。<sup class="cite"><a href="#ref-12">[12]</a></sup><sup class="cite"><a href="#ref-13">[13]</a></sup>

### 有 credit 不等于一定跑满

假设一个简化通道总共有 B<sub>credit</sub> 字节的循环额度，从消耗到重新可用需要 T<sub>return</sub>，链路容量为 C。那么一个必要的吞吐上界是：

{% raw %}
<p><code>R ≤ min(C, B<sub>credit</sub> / T<sub>return</sub>)</code></p>
{% endraw %}

这个上界尚未计入报文开销、仲裁冲突和其他瓶颈。即使下游并不满，发送端也可能因为额度更新尚未到达而停等。预留足够缓冲，不仅为了避免溢出，也可能是为了覆盖 credit 的往返时间。

{% visual_svg flow-control/fig09_credit_window %}
图 9｜理论上界：固定 128 KiB 的循环额度，链路容量为 400 Gb/s。当额度循环时间为 4 μs 时，上界降到约 262.1 Gb/s；2 μs 时，额度本身允许约 524.3 Gb/s，但实际仍受 400 Gb/s 链路限制。线性坐标，非设备实测。
{% endvisual_svg %}

### 延伸阅读：credit 也可以跨越一跳

InfiniBand 与 PCIe 的官方资料适合先理解资源账本。随后可以读 **ExpressPass**：它研究如何把 credit 调度用于数据中心端到端拥塞控制。阅读重点是 credit 怎样通过网络、谁限制 credit 的流量，以及数据流如何被反向约束。它说明 credit 是一种可用于不同层次的控制思路，不是 InfiniBand 某一个字段的专属名字；也不要把 ExpressPass 当成 InfiniBand 链路流控的实现规范。<sup class="cite"><a href="#ref-14">[14]</a></sup>

{% raw %}
<p><a class="glass-pill" href="https://www.mellanox.com/pdf/whitepapers/IB_Intro_WP_190.pdf" target="_blank" rel="noopener"><i class="fas fa-file-pdf" aria-hidden="true"></i> InfiniBand · 架构资料</a> <a class="glass-pill" href="https://research.google/pubs/credit-scheduled-delay-bounded-congestion-control-for-datacenters/" target="_blank" rel="noopener"><i class="fas fa-file-alt" aria-hidden="true"></i> ExpressPass · SIGCOMM 2017</a></p>
{% endraw %}

## 8. 回到 RTL：ready/valid 是更近的一层流控

把视角缩到芯片内部，流控就不再表现为网络报文，而可能只是一根 `ready` 信号。

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

### 片内背压怎样变成链路级流控

接收 DMA 变慢，可能使内部 FIFO 积压；FIFO 的空间不足又可能通过 ready/valid 向前一级传播。但“拉低内部 `ready`”与“向链路对端发送 PFC”之间，必须有明确的缓冲监测、优先级映射和流控生成逻辑。这些逻辑决定了内部资源压力何时、以哪个优先级通知链路对端。

物理链路已经到达的数据也不能因为某个内部模块拉低 `ready` 而凭空撤回。可停顿的内部接口可以等待；无法及时停下的外部输入则要由缓冲接住，或最终面临丢弃。设计 `almost_full` 阈值时，同样要为检测、流水和背压传播的延迟留出空间。这与 headroom 的问题结构相似，只是控制距离和数据单位变了。

**AXI-Stream 规范 §2.2** 给出了这组接口的直接约束。重点核对 source 和 destination 各自的义务，尤其是停止接收以后哪些信号必须保持稳定。

{% raw %}
<p><a class="glass-pill" href="https://documentation-service.arm.com/static/64819f1516f0f201aa6b963c" target="_blank" rel="noopener"><i class="fas fa-file-pdf" aria-hidden="true"></i> AMBA AXI-Stream · IHI 0051B</a></p>
{% endraw %}

## 9. 接收资源不足：TCP 窗口与 RDMA 的 RNR

到达终点以后，还有一类问题：网络能够送达，不代表接收端已经准备好相应的软件或传输资源。

TCP 同时面对两个限制。接收窗口 **rwnd** 是接收端通告的接收空间约束；拥塞窗口 **cwnd** 是发送端维护的网络拥塞约束。为理解窗口大小的作用，可以把允许新增的在途字节近似写成：<sup class="cite"><a href="#ref-16">[16]</a></sup><sup class="cite"><a href="#ref-17">[17]</a></sup>

{% raw %}
<div class="table-container" tabindex="0" role="region" aria-label="TCP 发送窗口公式，可横向滚动"><p><code>新增可发送量 ≈ max(0, min(rwnd, cwnd) − FlightSize)</code></p></div>
{% endraw %}

FlightSize 表示已经发送、尚未被确认的数据量。这个简化式省略了重传恢复、窗口边缘与实际发包节奏等细节，但能说明：接收方空间很多，网络拥塞仍然可以限制发送；网络很空闲，接收方没有空间也不能无限灌入。

{% visual_svg flow-control/fig11_receiver_resources %}
图 11｜两类端到端接收约束。左侧为 TCP 简化窗口算例：rwnd = 64 KiB、cwnd = 256 KiB、FlightSize = 48 KiB，新增余量为 16 KiB。右侧为 RC RDMA 的接收 WQE 资源反馈，不是交换机队列告警。来源：<a href="#ref-16">[16]</a>–<a href="#ref-19">[19]</a>。
{% endvisual_svg %}

RDMA 中对应的资源并不一定是同一种“接收字节缓冲”。例如在可靠连接 RC 传输下，SEND 或 RDMA WRITE with Immediate 需要接收端预先准备相应的 Receive WQE，Work Queue Element。没有可用接收 WQE 时，可能返回 **RNR NAK**，Receiver Not Ready Negative Acknowledgement，要求请求方按规则等待、重试。<sup class="cite"><a href="#ref-18">[18]</a></sup>

这里有个容易忽略的区别：WRITE with Immediate 的数据仍然写到指定远端地址，接收 WQE 服务于相关接收完成通知，并不是把数据改写进这份 WQE 指定的接收缓冲。普通 RDMA WRITE 和 RDMA READ 也不能一概套用“每次都需要接收方先 post receive”的说法。<sup class="cite"><a href="#ref-18">[18]</a></sup><sup class="cite"><a href="#ref-19">[19]</a></sup>

因此，RNR 是特定操作下的端点资源反馈，不能替代交换网络的拥塞控制。即使硬件操作成功完成，应用自己的环形队列是否还有空位，也可能要通过应用层 credit 另外协商。判断“接收方准备好了没有”，必须先说清楚准备的是链路缓冲、WQE，还是应用数据结构。

## 10. Shaper 和调度器，别再混成同一种流控

网卡或交换机里出现一个叫 `credit` 的寄存器，不足以证明它在做接收缓冲流控。先看额度由什么事件增加，会更可靠。

在 token bucket，令牌桶，模型里，令牌按本地配置的速率随时间补充，发送消耗令牌。若桶容量为 B，补充速率为 r，那么对任意长度为 Δt 的区间，理想字节模型允许的发送量满足：<sup class="cite"><a href="#ref-20">[20]</a></sup>

{% raw %}
<p><code>发送字节数 ≤ B + r × Δt</code></p>
{% endraw %}

B 允许短时突发，r 约束较长时间尺度的平均发送量。它不意味着每一个极短时间片内的瞬时发送速率都必须小于 r；具体实现还要考虑整包发送与记账粒度。

{% visual_svg flow-control/fig12_tokens %}
图 12｜同样是计数器，“为什么增加”决定了含义。令牌桶按时间补充预算，接收 buffer credit 对应下游释放并重新授予的空间。下方表示调度、速率资格与暂停条件共同约束发送的概念关系，不规定固定的硬件排列顺序。参考 <a href="#ref-13">[13]</a>、<a href="#ref-20">[20]</a>。
{% endvisual_svg %}

buffer credit 的物理含义不同：接收方必须确实拥有可以承诺的资源。仅仅“等了足够久”，不能凭空多发几个接收槽位的额度。

还有一种容易造成名字误会的机制：以太网 AVB/TSN 的 **Credit-Based Shaper**。它的 credit 依据发送和空闲时的斜率调整，用于发送仲裁与带宽分配；不是 PCIe 或 InfiniBand 那种远端缓冲许可。区分两者，要看 credit 是按本地斜率更新，还是代表远端授予的接收空间。<sup class="cite"><a href="#ref-21">[21]</a></sup>

调度器则主要回答“在当前有资格发送的队列中选谁”。例如轮询或加权调度负责服务分配，shaper 负责速率资格，PFC 状态可能让某类队列暂时失去发送资格。拥塞控制器还可以动态修改发送速率目标。实际硬件往往把这些模块组合起来，但任何一个都不能只凭名字替代另外几个。<sup class="cite"><a href="#ref-20">[20]</a></sup>

## 11. 把这些机制装回同一张网卡

把这些机制放回一张 NIC，可以看到几个不同的控制边界。发送路径要协调取数、队列选择、速率资格和链路状态；接收路径要接住外部流量，把数据送进主机，并监测自身的资源压力。两端之间还有传输与拥塞反馈。

{% visual_svg flow-control/fig13_composition %}
图 13｜一个概念性的控制分层。实线表示主要数据方向，虚线表示不同作用范围的控制；片内背压与 PFC 的连接必须由实现明确建立。该图不是任何厂商网卡的模块框图，也不暗示所有网卡都实现全部机制。综合 <a href="#ref-1">[1]</a>、<a href="#ref-4">[4]</a>、<a href="#ref-13">[13]</a>、<a href="#ref-15">[15]</a>、<a href="#ref-18">[18]</a>、<a href="#ref-20">[20]</a> 绘制。
{% endvisual_svg %}

**流控分布在端点软件、芯片内部接口、主机互连、以太网链路和交换网络中。** 同一条数据路径会经过多个控制边界，RDMA NIC 只是其中的一部分。

排查吞吐下降时，也应沿着这个分层检查，而不是看到速度变低就只盯着 PFC 计数。

{% raw %}
<div class="v-figure"><table class="v-matrix"><thead><tr><th>观察到什么</th><th>优先追问</th><th>尚不能据此断言</th></tr></thead><tbody><tr><td>某优先级暂停时间增加</td><td>哪一跳、哪个池触发 XOFF？</td><td>所有业务都发生端到端拥塞</td></tr><tr><td>CNP 或 CE 标记增加</td><td>哪条路径积压，源端速率如何变化？</td><td>接收端没有 Receive WQE</td></tr><tr><td>credit 经常耗尽</td><td>下游未释放，还是更新还在路上？</td><td>链路物理带宽不够</td></tr><tr><td>内部 ready 长时间为低</td><td>从哪个模块开始无法排空？</td><td>外部 PFC 一定已经生效</td></tr><tr><td>RNR 重试增加</td><td>操作类型与接收 WQE 补充是否匹配？</td><td>交换机 buffer 溢出</td></tr><tr><td>吞吐稳定停在某个值</td><td>是否命中 shaper、窗口或处理上限？</td><td>一定是某种流控故障</td></tr></tbody></table><p class="v-caption">表 2｜诊断线索而非自动判定规则。计数器名称、统计窗口和可见粒度取决于实现；应结合队列占用与速率变化验证因果。</p></div>
{% endraw %}

### 为什么 RoCE 与 InfiniBand 选择了不同组合

InfiniBand 把逐跳 credit 纳入自己的链路设计；RoCE 运行在以太网之上，PFC 为特定优先级提供链路级暂停，ECN/DCQCN 则是一条端到端拥塞控制路径。这些是不同体系下的组合选择，不是“所有 RDMA 天生只能用 PFC”。RDMA 也不等同于 RoCE：基于 TCP 的 iWARP 就属于另一条协议路线。<sup class="cite"><a href="#ref-12">[12]</a></sup><sup class="cite"><a href="#ref-4">[4]</a></sup><sup class="cite"><a href="#ref-23">[23]</a></sup>

链路级 credit 也不能替代全网拥塞控制：每一跳都不溢出，仍可能有长期排队、热点争抢和不公平。局部空间安全与端到端资源分配，是不同的问题。

**IRN** 论文进一步追问：改进 RDMA NIC 的丢包恢复和在途数据约束，能否降低对 PFC 的依赖？这是一条 NIC 与网络共同设计的研究路线。它支持的判断是“PFC 不是 RDMA 语义上的必要条件”，而不是“把任何现有 RoCE 网络的 PFC 直接关闭都没问题”。<sup class="cite"><a href="#ref-22">[22]</a></sup>

### 论文导读：区分协议语义与实现选择

读 **Revisiting Network Support for RDMA**，重点看 selective retransmission 如何减少丢包后的重复工作，以及基于带宽时延积的在途约束如何限制积压。然后回头检查自己的系统：这些前提真的具备了吗？研究设计证明了一条路线可行，不会自动给未修改的设备增加同样的能力。

{% raw %}
<p><a class="glass-pill" href="https://arxiv.org/abs/1806.08159" target="_blank" rel="noopener"><i class="fas fa-file-alt" aria-hidden="true"></i> IRN · SIGCOMM 2018</a></p>
{% endraw %}

面对一种不熟悉的流控机制，先沿着图 1 找到它保护的资源，再看发送许可由谁发出、何时生效。缓冲不足、反馈太慢、速率目标过低和接收资源补充不及时，都可能表现为“发送停了”，处理办法却不相同。

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
