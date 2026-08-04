---
title: 智算互联（下）：一颗智算网卡如何被造出来——高速接口、数据通路与光互联
date: 2026-06-28 22:38:30
categories: Silicon & Circuits
etoc: true
tags:
  - 智能网卡
  - SmartNIC
  - SerDes
  - RDMA
  - 芯片设计
  - 沐创
  - 国产芯片
  - 可编程网络
  - PCIe
  - Network-on-Chip
  - CPO
description: 从一颗智算网卡的内部数据通路出发，分析 PCIe、DMA、RDMA Transport、片上 NoC、SRAM、112G/224G SerDes、FEC、可编程处理器与光互联，讨论一张高速网卡如何真正成为 AI 集群中的互联端点。
keywords: 智算网卡, SmartNIC, RNIC, RDMA, SerDes, PCIe, DMA, NoC, FEC, CPO
---
>**Abstract - Part 3**  
> A high-performance AI network interface card is far more than a fast Ethernet controller. This article traces the complete data path from PCIe, DMA, and RDMA transport to packet processing, on-chip memory, SerDes, FEC, firmware, and optical interconnects, revealing the architectural trade-offs behind building network silicon capable of sustaining hundreds of gigabits per second.
   
---

{% note info %}
本文是「智算互联」系列下篇。<a href="/series/ai-interconnect/">查看系列目录 →</a>
{% endnote %}

前两篇分别讨论了通信墙与可靠性范式的变化。但无论是 RoCE、包级多路径、选择性重传，还是端网协同，最终都必须落到芯片、板卡和软件栈上。

“支持 400G”“支持 RoCEv2”“支持 GPUDirect RDMA”只是产品规格的最外层描述。真正决定一张智算网卡能否持续线速运行的，是一条横跨主机接口、地址转换、DMA、队列状态、传输协议、片上存储、以太网 PHY、驱动和 Collective 通信库的完整数据路径。

这一篇不针对某一家厂商做产品拆解，而是回答三个更基础的问题：

1. 一颗高性能 RNIC / SmartNIC 内部到底有什么；
2. PCIe、DMA、片上 NoC、112G / 224G SerDes 为什么会共同决定最终吞吐；
3. 一张“端口很快”的网卡，怎样才能真正成为 AI 集群中的高效互联端点。

{% note warning %}
本文中的芯片框图均为基于公开标准与通用工程原理绘制的**典型架构示意**，不代表任何特定厂商产品的实际内部实现。

文中涉及具体产品时，只用于说明公开可见的产业路线；厂商规格、工程推导与第三方实测会被明确区分。
{% endnote %}

## 一、从系统需求倒推一颗智算网卡

### 1. AI 网卡不是“更快的以太网卡”

传统网卡负责稳定收发报文，把部分协议处理从 CPU 卸载到硬件。智算网卡面对的约束更苛刻：

- GPU 或加速器持续产生大规模 DMA 流量；
- 集合通信要求多个 Rank 在相近时间到达同步点；
- Tensor Parallel 和 Expert Parallel 对尾延迟高度敏感；
- 一个丢包、慢流或异常队列可能拖慢整次 Collective；
- 数万甚至更多 Queue Pair 带来庞大的连接状态；
- 多租户环境还要求虚拟化、隔离与安全；
- 驱动、Firmware、RDMA Core 和通信库必须共同工作。

因此，智算网卡优化的目标不是峰值吞吐，而是：

> 在有限的 PCIe、片上 SRAM、封装功耗和网络带宽下，让尽可能多的数据按时抵达正确的 GPU 内存，并把拥塞、丢包与软件开销对训练步骤的影响降到最低。

### 2. 网卡同时包含三个平面

可以把一颗高性能网卡拆成三个相互依赖的平面：

| 平面 | 主要职责 | 典型模块 |
| :--- | :------- | :------- |
| 数据平面 | 线速搬运和处理报文 | DMA、Parser、RDMA Engine、Scheduler、MAC、FEC |
| 控制平面 | 初始化、配置与异常处理 | 嵌入式 CPU、Firmware、管理队列、Telemetry |
| 管理与安全平面 | 生命周期、隔离和可信性 | Secure Boot、密钥、SR-IOV、设备管理、升级 |

最热的数据路径必须尽量硬化；复杂但低频的控制逻辑适合交给嵌入式处理器；需要随协议演进的部分，则可能使用可编程微引擎或受限的数据面指令集。

### 3. 典型数据路径

{% mermaid %}
flowchart LR
    A[Host CPU / GPU Memory] --> B[PCIe Controller<br/>ATS / PASID / SR-IOV]
    B --> C[DMA + Address Translation]
    C --> D[Queue / RDMA Transport Engine]
    D --> E[Packet Processing<br/>Parser / Scheduler / Security]
    E --> F[MAC / PCS / FEC]
    F --> G[SerDes / PMA]
    G --> H[DAC / AEC / Optical Module]
    I[Embedded CPU / Firmware] -.control.-> C
    I -.control.-> D
    I -.control.-> E
    J[On-chip SRAM / NoC] --- C
    J --- D
    J --- E
{% endmermaid %}

这张图画得像顺序流水线，但真实芯片的数据路径不是直线。描述符、队列上下文、重传状态、地址映射与完成事件会在多个模块之间反复交互；任何一处带宽不足或状态访问失衡，都可能让 400G 端口无法转化成 400G 有效吞吐。

## 二、PCIe：网络端口背后的主机侧天花板

### 1. PCIe 是主数据通道，不是管理接口

PCIe Controller 通常负责：

- Link Training 与链路状态管理；
- Transaction Layer Packet（TLP）收发；
- BAR 与配置空间；
- MSI-X 中断；
- SR-IOV PF / VF；
- Advanced Error Reporting；
- ATS、PASID 等地址与进程隔离能力；
- 与 DMA Engine 交互。

当网卡连接 GPU 或主机内存时，大部分业务数据都要经过 PCIe。端口带宽能否被利用，不只取决于 PCIe 的标称速率，还取决于 Max Payload Size、Read Request、Completion、NUMA 路径、Root Complex、PCIe Switch 和内存控制器。

### 2. PCIe 4.0 x16 与 200G 级网卡

PCIe 4.0 每 Lane 为 16 GT/s，采用 128b/130b 编码。x16 单方向编码后的原始有效带宽约为 31.5 GB/s，即约 252 Gbit/s。

对于网络端总带宽为 200 Gbit/s 的网卡，PCIe 4.0 x16 在数值上能够覆盖单方向线速，但实际余量还要扣除：

- TLP 与 Data Link Layer 开销；
- DMA 地址不连续；
- Doorbell、CQE 和元数据访问；
- 小包造成的事务效率下降；
- IOMMU 与地址转换；
- 多设备共享 Root Complex；
- Host Memory 或 GPU Memory 的实际服务能力。

因此，“PCIe 带宽大于网络端口带宽”只是必要条件，不是线速保证。

### 3. PCIe 5.0 x16 与 400G 网卡

PCIe 5.0 将速率提高到 32 GT/s。PCI-SIG 给出的 x16 单方向编码后原始有效带宽约为 504 Gbit/s。[PCI-SIG：PCIe 5.0 带宽](https://pcisig.com/what-bit-rates-does-pcie-50-specification-support-and-how-does-it-compare-prior-pcie-generations)

这使 PCIe 5.0 x16 成为 400G 网卡常见的主机接口组合。但 504 Gbit/s 与 400 Gbit/s 之间的差额不能直接视为完整设计余量，因为网络报文、PCIe 事务、地址转换和完成队列都会产生额外流量。

PCIe 与以太网都是全双工链路，分析时也必须分别考察：

- Host-to-Network；
- Network-to-Host；
- 双向同时满载；
- RDMA Read 与 RDMA Write 的非对称事务行为。

### 4. 800G 为什么会再次逼近接口极限

800G 网络端已经超过 PCIe 5.0 x16 的单方向原始有效能力。下一代高端网卡可能采用：

- PCIe 6.0 x16；
- 多个 PCIe Endpoint；
- 多 Host 或多 Accelerator 直连；
- 板载 PCIe Switch；
- 更紧密的 Scale-up 或芯粒级接口。

PCIe 6.0 采用 PAM4、FLIT、轻量 FEC 和 CRC，在 64 GT/s 下进一步翻倍带宽。[PCI-SIG：PCI Express 6.0](https://pcisig.com/pci-express-6.0-specification)

但接口升级会把困难从“带宽不够”转移到信号完整性、FEC、延迟、封装和系统验证上。

## 三、DMA 与地址转换：零拷贝并不等于零工作

### 1. RDMA 的数据仍然必须移动

RDMA 所谓“零拷贝”，主要指减少 CPU 介入和中间缓冲区复制。网卡仍然要完成：

- 读取 Work Queue Entry（WQE）；
- 查询 Memory Region；
- 校验 Local Key / Remote Key；
- 完成虚拟地址到物理地址转换；
- 发起 PCIe Read / Write；
- 处理 Scatter-Gather List；
- 更新 Completion Queue Entry（CQE）；
- 维护 Doorbell 与 Producer / Consumer Index。

这些动作不会出现在“400G”三个字符中，却直接决定小消息延迟和大规模队列下的持续吞吐。

### 2. 地址转换可能成为隐藏瓶颈

在虚拟化或 GPU Direct 场景中，网卡需要理解进程、虚拟机与设备地址空间。常见机制包括：

- IOMMU；
- Address Translation Services（ATS）；
- Process Address Space ID（PASID）；
- Page Request Interface（PRI）；
- 网卡内部 Translation Cache。

如果 Translation Cache 命中率过低，或页粒度与访问模式不匹配，DMA 会被地址转换和 PCIe 往返拖慢。

### 3. 大规模队列意味着上下文分层存储

当 QP、CQ、Memory Region 和 Flow 数量达到数万甚至更多时，所有状态不可能同时驻留在最快的片上 SRAM。芯片通常需要建立类似缓存层级：

{% mermaid %}
flowchart LR
    A[Hot Context<br/>On-chip SRAM] --> B[Warm Context<br/>External Memory / On-board DRAM]
    B --> C[Cold Context<br/>Host Memory]
    D[Queue / Transport Engine] --> A
    A -.miss.-> B
    B -.miss.-> C
{% endmermaid %}

真正困难的不是“能否支持 100 万 QP”，而是：在目标业务的活跃集规模下，Context Cache Miss 是否会把尾延迟和 PCIe 流量推高。

## 四、RDMA Transport Engine：最复杂的数字状态机之一

### 1. 可靠连接需要维护什么

以 Reliable Connection（RC）为例，Transport Engine 需要维护：

- Packet Sequence Number；
- ACK / NAK；
- Retransmission Timer；
- RDMA Read / Write / Send / Atomic 语义；
- Outstanding Request；
- QP 状态；
- Completion Ordering；
- Congestion Notification；
- Error Recovery。

它既像网络协议处理器，又像远程内存访问控制器。错误不仅可能造成丢包，还可能破坏内存语义、完成顺序和应用可见状态。

### 2. 包级多路径会扩大状态空间

如果网卡支持 Packet Spraying、乱序接收与选择性重传，通常还需要：

- 每包级路径选择；
- Out-of-order Tracking；
- Selective ACK / NACK；
- 直接数据放置；
- Duplicate Suppression；
- 更细粒度的重传 Buffer；
- 更复杂的完成条件判断。

这些能力可以提升多路径利用率，并减少单个丢包导致的大范围重传，但代价是更多 SRAM、更复杂的状态机以及更大的验证空间。

### 3. 协议灵活性首先是验证问题

网络芯片中的新 Transport 机制并不只需要“写出 RTL”。它还必须覆盖：

- 包重复、乱序与丢失同时发生；
- ACK 或 Credit 本身丢失；
- QP Reset 与重传并发；
- 链路故障与路径切换；
- 多租户资源耗尽；
- Firmware 升级与状态迁移；
- 交换机行为不完全符合预期。

协议越灵活，Corner Case 越多。很多纸面上合理的算法，真正困难的部分是能否在硅片上以有限状态、有限 Buffer 和可验证的时序实现。

## 五、Packet Processing：固定功能与可编程性的分界

### 1. 数据面通常要处理什么

报文处理模块可能包含：

- Parser；
- Flow Classification；
- RSS / Hash；
- ACL 与五元组过滤；
- VXLAN、Geneve 等隧道；
- Checksum、TSO / LRO；
- Queue Selection；
- QoS 与 Scheduler；
- Telemetry；
- IPsec / MACsec；
- 厂商扩展 Header 与拥塞控制。

最常用、最稳定、对延迟敏感的逻辑适合硬化；变化快或客户差异大的部分，则更适合放进微引擎或可编程处理器。

### 2. 固定功能 ASIC 的优势与边界

固定功能逻辑通常具有最高的能效和最确定的延迟，适合：

- Ethernet MAC / PCS；
- CRC / Checksum；
- 常见 Parser；
- DMA Fast Path；
- 成熟 RDMA 操作；
- Queue Scheduler；
- AES、SM4 等密码流水线。

缺点是协议一旦变化，硬件修改往往需要重新流片。

### 3. 嵌入式 CPU 适合控制面与慢路径

RISC-V、Arm 或其他嵌入式核常用于：

- 初始化硬件；
- 管理 QP 与异常；
- 运行 Firmware；
- 处理 Control Packet；
- 更新 Table；
- 设备管理与 Telemetry；
- 实现低频但复杂的协议逻辑。

它们的价值不在于逐包处理全部 400G 流量。以 64B 最小包计算，400G Ethernet 的包率可达到数亿 PPS，通用核无法承担所有热路径。

### 4. 专用微引擎填补中间地带

专用微引擎常具有：

- 多线程隐藏访存延迟；
- 受限但高效的指令集；
- 本地 Scratchpad；
- 硬件队列；
- 与 Parser、DMA、Crypto 紧耦合。

它适合处理可变协议、隧道、客户定制逻辑、Telemetry 和拥塞算法，在固定 ASIC 与通用 CPU 之间取得折中。

### 5. CGRA 不是所有“可重构引擎”的统称

Coarse-Grained Reconfigurable Array（CGRA）通常由多个可编程处理单元与可配置互联构成，擅长映射规则数据流和算术计算图。

只有公开了 Processing Element、互联结构、调度或映射模型，才能较有把握地判断某个模块是否属于 CGRA。厂商使用“可编程引擎”或“可重构微引擎”，并不自动意味着其内部采用 CGRA。

## 六、片上互联：AXI 不是一条无限宽的高速公路

### 1. AXI 是接口协议，不是完整 NoC

AMBA AXI 定义事务与通道语义，适合连接 Master 与 Slave；大型网络 SoC 还需要片上网络（Network-on-Chip, NoC）、Crossbar、Arbiter、Bridge 和多组 SRAM Bank。

直接比较“PCIe 和 AXI 谁更快”没有意义：

- PCIe 是芯片外部串行 I/O；
- AXI 是芯片内部事务接口；
- NoC 决定多个模块如何共享片上带宽；
- 实际吞吐取决于位宽、频率、并发、路由和仲裁。

### 2. 1 Tbps 数据通路有多宽

一个 512-bit、1 GHz 的理想单向数据通路，原始带宽为：

$$
512\ \mathrm{bit} \times 1\ \mathrm{GHz}=512\ \mathrm{Gbit/s}
$$

要承载 1 Tbps，可以采用：

- 1024-bit × 1 GHz；
- 512-bit × 2 GHz；
- 多条并行 256 / 512-bit Fabric；
- 分片 Packet Pipeline；
- 多 Bank SRAM 与多 DMA Channel。

现实中还会损失在仲裁、空泡、Header、跨时钟域、Credit 和读写冲突中，因此设计目标必须显著高于端口速率的算术下限。

### 3. On-chip SRAM 是隐形核心

高性能网卡需要 SRAM 存放：

- Packet Buffer；
- QP / CQ Context Cache；
- Flow Table；
- Retransmission State；
- Descriptor；
- Scheduler Queue；
- Security Association；
- Telemetry Counter。

SRAM 面积大、静态功耗高，又往往要求多端口或多 Bank。Buffer 太小会增加丢包和外部访问；Buffer 太大则显著推高 Die Area、功耗与访问延迟。

### 4. 数据通路与控制通路必须隔离

如果 Firmware、Telemetry 或异常处理可以长期占用与热路径相同的 NoC 和 SRAM 端口，就可能在最不应该抖动的时候制造抖动。

因此，高性能设计通常会考虑：

- 独立管理网络；
- 数据面保留带宽；
- QoS 与优先级；
- 分离的 SRAM Bank；
- 控制面限速；
- 故障风暴下的资源保护。

## 七、112G / 224G SerDes 为什么像“黑魔法”

### 1. 速率提升不再靠简单提高时钟

现代高速以太网广泛采用 PAM4（四电平脉冲幅度调制）。PAM4 每个 Symbol 携带 2 bit，因此能够在相近 Baud Rate 下提高数据率。

代价是原本一个大眼图变成三个更小的眼图。相邻电平间距缩小，系统对以下因素更敏感：

- 热噪声；
- 串扰；
- 电源噪声；
- 抖动；
- 封装损耗；
- PCB 插入损耗与反射；
- 连接器；
- 光电器件线性度。

### 2. Tx 与 Rx 要共同恢复眼图

发送端常使用 Feed-Forward Equalization（FFE）预加重，接收端可能使用：

- Continuous-Time Linear Equalizer（CTLE）；
- Variable Gain Amplifier；
- Decision Feedback Equalizer（DFE）；
- Clock and Data Recovery（CDR）；
- ADC / DSP 或模拟判决电路。

均衡越强，功耗和复杂度越高；DFE 还可能产生误判传播。设计目标不是单点追求最高 SNR，而是在通道损耗、功耗、面积、抖动容限与误码率之间寻找可量产的平衡。

### 3. Pre-FEC BER 与 Post-FEC BER

高速链路通常允许 FEC 前存在一定误码，再由 Forward Error Correction（FEC）把最终 BER 降到系统目标。

$$
\text{Channel Loss / Noise}
\rightarrow \text{Equalization}
\rightarrow \text{Pre-FEC BER}
\rightarrow \text{FEC Coding Gain}
\rightarrow \text{Post-FEC BER}
$$

因此，不能简单写成“SNR 决定是否开启 FEC”。在许多 112G / 224G PAM4 标准中，FEC 本身就是链路预算的一部分。

FEC 延迟也不存在统一的“几百纳秒”，它取决于：

- 码型与码长；
- Decoder 架构；
- 并行度；
- Interleaving；
- 时钟频率；
- PHY Pipeline。

### 4. 224G 不只是“112G 翻倍”

OIF 的 CEI-224G 工作覆盖 Very Short Reach、Medium Reach、Long Reach 和 Linear 等不同信道目标，面向 800G、1.6T 及更高容量系统。[OIF：CEI-224G](https://www.oiforum.com/technical-work/hot-topics/common-electrical-i-o-cei-224g/)

不同 Reach 对均衡、功耗、封装和信道材料的要求不同。一颗适用于封装附近短距离连接的 224G SerDes，不等于能够穿越长 PCB、连接器和铜缆完成更长距离传输。

## 八、自研还是采购：高速 IP 的工程经济学

### 1. SerDes 是工艺绑定的模拟系统

数字逻辑可以通过综合与布局布线迁移，但高速 SerDes 深度依赖：

- 晶体管模型；
- PLL / CDR；
- I/O Device；
- Package Model；
- ESD；
- PVT Corner；
- 模拟版图与寄生参数；
- 测试芯片和实验室设备。

从一个工艺节点迁移到另一个节点，远不是重新综合 RTL。

### 2. 一次成功流片的价值极高

数字逻辑问题有时可以通过 Firmware、旁路或后续版本修复；SerDes 如果在关键通道上达不到眼图和 BER，整颗芯片可能无法满足目标端口速率。

成熟 IP 的价值通常包括：

- Silicon Proven 记录；
- 标准 Compliance 经验；
- 信道、封装和测试模型；
- 缩短上市周期；
- 降低首次流片失败风险。

代价则是授权费、Royalty、供应商锁定、工艺绑定与定制受限。

### 3. 采购 IP 不等于放弃核心能力

即使购买 SerDes、PCIe 或 DDR IP，芯片公司仍要完成：

- IP 评估与 PPA 验证；
- SoC 集成；
- Clock、Power 与 Reset；
- DFT；
- Package / Board SI；
- Firmware；
- Compliance；
- Yield 与量产测试。

真正的决策不是“自研高尚、采购简单”，而是哪些模块决定产品差异化，哪些模块的失败风险又足以拖垮整个项目。

### 4. 差异化通常落在哪里

对资源有限的网络芯片公司，产品差异常来自：

- RDMA Transport；
- Congestion Control；
- Packet Spraying 与乱序恢复；
- Queue / Context 管理；
- 安全卸载；
- 可编程数据面；
- 驱动、Firmware 与生态适配。

把有限的工程资源集中在这些系统级能力上，往往比重复实现所有成熟 PHY IP 更有价值。

## 九、安全为什么可能成为智算网卡的原生能力

### 1. AI 集群不再总是单租户封闭机器

云端 GPU 集群可能同时承载不同客户与不同安全等级的任务。需要保护的数据包括：

- 训练数据；
- 模型参数；
- 梯度；
- Checkpoint；
- 推理请求；
- KV Cache；
- Agent 工具调用与中间状态。

当数据跨越服务器、机架或数据中心边界，网络加密、设备身份和租户隔离会逐渐成为数据路径的一部分。

### 2. Inline Security 的价值

如果加密完全由 CPU 或 GPU 软件完成，可能带来：

- 额外内存访问；
- CPU 占用；
- GPU Kernel 干扰；
- 更长关键路径；
- 难以维持线速。

网卡中的 Inline IPsec / MACsec 可以在报文数据路径中完成加解密和认证，尽量减少对 RDMA 与零拷贝路径的破坏。

{% note info %}
国内厂商已经出现把高速网络、RDMA 与安全卸载结合的公开产品路线。例如，沐创公开的 N20 同时强调双 100G、RoCEv2、可编程处理与 Inline Security。这里仅把它视为一种产业路线样本，不讨论其未公开的内部架构。[沐创 N20 公开信息](https://mucse.com/about/detail.aspx?Id=280&mtt=1)
{% endnote %}

### 3. 真正困难的是状态和密钥生命周期

安全网卡不仅要计算 AES、SM4 或哈希，还要处理：

- Security Association 数量；
- Key Provisioning；
- Rekey；
- Anti-Replay Window；
- 多租户密钥隔离；
- Secure Boot；
- Firmware 签名；
- Device Attestation；
- Debug Port 与生产测试安全。

如果产品只说明“支持某算法”，却没有密钥生命周期、租户隔离与控制面设计，就不能完整说明其安全能力。

### 4. 安全也会消耗 PPA 与验证资源

安全模块占用面积、功耗、Buffer 和验证周期。对于追求极低时延的封闭训练 Fabric，用户可能并不需要所有安全功能。

合理的产品设计可能需要回答：

- 是否采用不同 SKU；
- 安全模块关闭后能否完全旁路；
- Inline 加密对 RDMA 延迟与吞吐影响多大；
- 能否接入云平台密钥管理和可信计算体系；
- 安全能力是否真正对应用户威胁模型。

## 十、驱动与软件栈不是芯片的附件

一张 RNIC 从应用到物理网络至少经过：

{% mermaid %}
flowchart TB
    A[PyTorch / Training Framework] --> B[NCCL / MPI / Collective Library]
    B --> C[libfabric / Verbs / Communication Runtime]
    C --> D[Kernel Driver / User-space Driver]
    D --> E[Firmware]
    E --> F[Queue + RDMA + DMA Hardware]
    F --> G[Ethernet Fabric]
{% endmermaid %}

### 1. 驱动决定硬件能否被稳定使用

驱动需要处理：

- Device Initialization；
- Queue Allocation；
- Memory Registration；
- Interrupt 与 Polling；
- SR-IOV；
- Error Recovery；
- Firmware Upgrade；
- ethtool / devlink / RDMA Core；
- NUMA 与 CPU Affinity。

这些工作不会提高峰值端口数字，却直接决定设备能否在真实服务器中长期运行。

### 2. Collective Library 决定实际流量形态

即使网卡支持 400G，如果通信库没有正确发现拓扑、GPU Direct 路径未启用，或 Collective Algorithm 选择不匹配，实际训练仍可能走 Host Staging 或低效路径。

NCCL、MPI 或其他通信运行时会决定：

- Ring、Tree 或分层算法；
- 通道数量；
- Chunk Size；
- GPU、NIC 与 NUMA 的绑定；
- 多 Rail 使用方式；
- 是否启用特定网络插件。

### 3. Firmware 是硬件与协议之间的长期契约

Firmware 负责初始化、错误恢复、配置与设备生命周期。新协议和新平台适配往往需要 Firmware 更新，而不是重新流片。

这也意味着 Firmware 必须处理：

- 版本兼容；
- 安全更新；
- 回滚；
- 现场升级失败；
- 日志与故障诊断；
- 不同硬件 Revision。

### 4. 生态是最慢形成的护城河

网络控制器的长期壁垒往往来自：

- 多年驱动维护；
- 大量服务器兼容性；
- BIOS / BMC / PXE / NC-SI；
- Linux Kernel Version；
- DPDK；
- RDMA Core；
- GPU Runtime；
- 故障日志与现场支持。

芯片可以在一次流片后出现，生态却需要通过长期部署逐渐积累。

## 十一、从铜到光：CPO 是关键路线，但不是唯一终点

### 1. 高速电信号为什么越来越难走到前面板

交换 ASIC 或网络芯片与前面板光模块之间，需要高速 SerDes 穿越封装、PCB 和连接器。端口密度和 Lane 速率提升后：

- 插入损耗增加；
- Retimer / DSP 功耗上升；
- PCB 材料更昂贵；
- 前面板散热困难；
- 信号完整性 Margin 缩小。

Co-Packaged Optics（CPO）把光引擎放到交换 ASIC 附近，缩短高损耗电通道，再通过光纤离开封装。

### 2. 高速互联是一组连续方案

| 方案 | 电通道长度 | 模块可维护性 | 功耗趋势 | 主要特点 |
| :--- | :--------- | :----------- | :------- | :------- |
| DAC | 较长铜缆 | 高 | 较低 | 距离短、成本低 |
| AEC | 铜缆 + 有源均衡 | 高 | 中 | 比 DAC 更长，包含有源器件 |
| Retimed Pluggable Optics | ASIC 到前面板 | 很高 | 较高 | 生态成熟、易更换 |
| LPO / LRO | 缩减模块侧 DSP | 高 | 较低 | 功耗下降，但链路预算更敏感 |
| NPO | 光引擎靠近 ASIC | 中 | 较低 | 缩短电通道，保持部分模块化 |
| CPO | 光引擎与 ASIC 共封装 | 较低 | 最低潜力 | 高带宽密度，维护和良率复杂 |

### 3. CPO 已经从概念走向产品

Broadcom 已公开多代高容量 CPO 交换平台，强调系统功耗与带宽密度收益。[Broadcom：第三代 CPO](https://investors.broadcom.com/news-releases/news-release-details/broadcom-announces-third-generation-co-packaged-optics-cpo)

NVIDIA 也公开了 Spectrum-X Ethernet Photonics，将硅光引擎放到交换 ASIC 封装附近。[NVIDIA Silicon Photonics Networking](https://www.nvidia.com/en-sg/networking/products/silicon-photonics/)

这些资料能够证明产业方向，但厂商给出的功耗和可靠性数字仍需要结合测试条件理解，不能直接视为跨平台 Benchmark。

### 4. CPO 的代价

- 光引擎与高功耗 ASIC 热耦合；
- 封装良率与测试复杂；
- 单个光引擎故障可能影响整机维修；
- 外置激光源、光纤连接器和自动装配要求高；
- 供应链从模块级转向封装级协作；
- 现场更换不如可插拔模块简单。

因此，更现实的判断是：

> CPO 会优先进入高容量交换芯片和极高带宽密度场景，并与可插拔光模块、LPO、LRO、AEC 和 NPO 长期共存。

## 十二、如何严肃评价一张智算网卡

判断一张网卡是否真正适合智算集群，不能只看“400G + RoCEv2”。至少需要以下证据。

### 1. 基础数据面

- 单端口与多端口同时吞吐；
- 64B、128B、256B、1KB、4KB、1MB 消息性能；
- 单向与双向吞吐；
- PCIe Read / Write Efficiency；
- 功耗与每 Gbit/s 能效；
- 不同 NUMA 与 PCIe Topology 下的性能。

### 2. RDMA

- 最大 QP / CQ / MR 数量；
- 活跃连接规模下的 Context Cache Miss；
- RDMA Read、Write、Send 延迟；
- RC 丢包恢复；
- Selective Retransmission；
- Out-of-order 深度；
- Memory Registration 开销；
- GPUDirect RDMA 的真实路径。

### 3. AI Collective

- NCCL Tests AllReduce / AllGather / ReduceScatter / All-to-All；
- 8、16、64、256 节点扩展；
- Ring、Tree 与 Hierarchical Algorithm；
- 多 Job 并发；
- MoE Incast；
- P50、P99、P999；
- 故障后的恢复时间。

### 4. 端网协同

- 配套交换机和 ECN 配置；
- Packet Spraying 的路径选择；
- Credit 或其他反馈机制；
- Telemetry；
- 是否依赖私有扩展；
- 与第三方交换机的兼容性；
- PFC 开启、关闭和混合场景。

### 5. 安全与虚拟化

- Inline IPsec / MACsec 吞吐和延迟；
- 加密开启后的 RDMA 性能；
- VF 数量与隔离；
- 密钥管理；
- Firmware 安全；
- 恶意租户压力下的资源保护。

{% note primary %}
最有说服力的材料不是再增加一页功能列表，而是公开可复现的测试条件：服务器、GPU、交换机、线缆、拓扑、驱动、Firmware、通信库版本、消息大小和完整命令。
{% endnote %}

## 十三、国产智算网卡真正面对的机会与边界

### 1. 机会不只来自“国产替代”

国内 CPU、GPU、服务器和云平台需要可控的高速网络接口、驱动与运维体系。但供应链窗口只能提供入场机会，无法代替性能、稳定性和生态。

更长期的机会来自：

- 国内异构计算平台需要深度适配；
- AI 网络协议仍在快速演进；
- 安全、虚拟化与多租户需求具有本地差异；
- 客户需要能够快速响应的 Firmware 和驱动团队；
- 网络、存储和加速器之间仍存在大量系统优化空间。

### 2. 端口速率很快会商品化

400G、800G 会逐渐成为产品入场券。真正难复制的能力是：

- 大规模 RDMA 状态与故障恢复；
- Collective 下的尾延迟；
- 交换机与端点协同；
- 驱动和 Firmware 稳定性；
- 多平台兼容；
- 可复现的系统级性能。

### 3. Scale-out 与 Scale-up 不是自然升级关系

拥有高速 Scale-out RNIC，并不意味着自然获得 Scale-up 互联能力。Scale-up 往往还需要：

- 更低的端到端延迟；
- Load / Store / Atomic 等内存语义；
- 加速器一致的软件模型；
- 专用交换芯片；
- Fabric Manager；
- 故障域和拓扑管理。

两者可以共享 SerDes、封装、DMA 或部分协议能力，但系统目标和验证方法并不相同。

### 4. 软件维护周期远长于一次流片

Linux Kernel、DPDK、RDMA Core、GPU Runtime、服务器固件与云平台会持续变化。一颗网卡从 Tape-out 到成为稳定基础设施，中间往往隔着多年的软件维护、兼容性测试和现场故障处理。

## 结语：网卡设计师正在变成互联系统架构师

一颗智算网卡同时面对三个世界：

- 模拟与物理世界：SerDes、抖动、信道和 FEC；
- 数字芯片世界：DMA、NoC、SRAM、队列、状态机和 PPA；
- 分布式系统世界：Collective、拥塞、故障、软件栈和多租户。

只懂其中一层，很难定义下一代互联。

端口速率决定了一张网卡理论上能够搬运多少数据；Transport、片上存储与软件栈则决定这些带宽能否被稳定地交付给应用；交换网络和 Collective Runtime 最终决定它能否转化成训练吞吐。

> 下一代互联架构的竞争，不再发生在单一 MAC、SerDes 或协议模块内部，而发生在工作负载、软件、传输语义、交换结构和物理信道之间。

对于 IC 设计师而言，真正值得培养的能力也不只是把一个 RTL 模块写对，而是理解数据为什么移动、状态应该放在哪里，以及每一层的优化会把代价转移到哪一层。

---

## 建议配图

全文以 Mermaid 自绘架构图为主，不需要加入具体厂商产品图。若希望增加一张视觉主图，建议自行绘制以下内容：

1. **智算网卡从 GPU 内存到光口的端到端数据路径**  
   文件名建议：`ai-nic-end-to-end-datapath.png`

2. **固定功能 ASIC、微引擎与嵌入式 CPU 的职责分层**  
   文件名建议：`ai-nic-programmability-layers.png`

3. **PCIe、片上 NoC、SerDes 三个带宽域的对应关系**  
   文件名建议：`ai-nic-bandwidth-domains.png`

配图应明确标注“通用架构示意”，避免让读者误认为是任何特定芯片的内部框图。

<link rel="stylesheet" href="/css/series-page.css">

<div class="series-nav series-nav--single">
  <a href="/2026/06/28/ai-compute-interconnect-part2-reliability-rethink/" class="series-nav__link">← 上一篇：重构可靠性</a>
</div>

## 参考资料

1. [PCI-SIG：PCIe 5.0 Bit Rates and Bandwidth](https://pcisig.com/what-bit-rates-does-pcie-50-specification-support-and-how-does-it-compare-prior-pcie-generations)
2. [PCI-SIG：PCI Express 6.0 Specification](https://pcisig.com/pci-express-6.0-specification)
3. [OIF：Common Electrical I/O CEI-224G](https://www.oiforum.com/technical-work/hot-topics/common-electrical-i-o-cei-224g/)
4. [NVIDIA：GPUDirect RDMA Documentation](https://docs.nvidia.com/cuda/gpudirect-rdma/)
5. [Linux Kernel：Userspace Verbs Access](https://docs.kernel.org/infiniband/user_verbs.html)
6. [UALink 200G 1.0 Specification Overview](https://ualinkconsortium.org/blog/ualink-200g-1-0-specification-overview-802/)
7. [Broadcom：Third-Generation Co-Packaged Optics](https://investors.broadcom.com/news-releases/news-release-details/broadcom-announces-third-generation-co-packaged-optics-cpo)
8. [Broadcom：What Is Co-Packaged Optics](https://www.broadcom.com/topics/what-is-co-packaged-optics)
9. [NVIDIA：Silicon Photonics Networking](https://www.nvidia.com/en-sg/networking/products/silicon-photonics/)
10. [沐创 N20 公开产品信息](https://mucse.com/about/detail.aspx?Id=280&mtt=1)
