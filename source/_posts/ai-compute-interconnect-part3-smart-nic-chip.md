---
lang: zh-CN
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

> **Abstract - Part 3**<br>
> A 400G port can be limited by the host interface, DMA, queue state, on-chip memory, or software before it reaches line rate. This article follows that path through an RNIC, then examines the SerDes, FEC, firmware, and optical interconnect choices needed to sustain it.
   
---

{% note info %}
本文是「智算互联」系列下篇。<a href="/series/ai-interconnect/">查看系列目录 →</a>
{% endnote %}

前两篇讨论了通信压力和可靠性分工。包级多路径、选择性重传与端网协同，最终都要由芯片、板卡和软件实现。

“400G”“RoCEv2”“GPUDirect RDMA”写在规格表上，仍看不出整条路径能否持续工作。数据经过主机接口、地址转换、DMA、队列、Transport、片上存储与 PHY，还要由驱动和 Collective 库共同安排。

我想按数据经过的位置看 RNIC/SmartNIC，而不是拆某一家的产品。

先看各模块处理什么，再看 PCIe、NoC、112G/224G SerDes 怎样约束吞吐，最后回到训练系统能否持续利用这些带宽。

{% note warning %}
本文中的芯片框图均为基于公开标准与通用工程原理绘制的**典型架构示意**，不代表任何特定厂商产品的实际内部实现。

文中涉及具体产品时，只用于说明公开可见的产业路线；厂商规格、工程推导与第三方实测会被明确区分。
{% endnote %}

## 一、从系统需求倒推一颗智算网卡

### 1. 端口之外的训练需求

传统网卡已经要稳定收发和卸载协议。用于训练时，还要面对这些更紧的约束：

- GPU 或加速器持续产生大规模 DMA 流量；
- 集合通信要求多个 Rank 在相近时间到达同步点；
- Tensor Parallel 和 Expert Parallel 对尾延迟高度敏感；
- 一个丢包、慢流或异常队列可能拖慢整次 Collective；
- 数万甚至更多 Queue Pair 带来庞大的连接状态；
- 多租户环境还要求虚拟化、隔离与安全；
- 驱动、Firmware、RDMA Core 和通信库必须共同工作。

所以需要在资源预算里检查的目标是：

尽量多的数据按时到达正确的 GPU 内存，同时控制拥塞、丢包和软件开销。PCIe、片上 SRAM、封装功耗和网络带宽，都会限制这个目标。

### 2. 网卡同时包含三个平面

可以按三个相互依赖的平面理解：

| 平面 | 主要职责 | 典型模块 |
| :--- | :------- | :------- |
| 数据平面 | 线速搬运和处理报文 | DMA、Parser、RDMA Engine、Scheduler、MAC、FEC |
| 控制平面 | 初始化、配置与异常处理 | 嵌入式 CPU、Firmware、管理队列、Telemetry |
| 管理与安全平面 | 生命周期、隔离和可信性 | Secure Boot、密钥、SR-IOV、设备管理、升级 |

最常走的热路径尽量硬化，复杂、低频的控制交给嵌入式核，需要随协议变化的部分则留给微引擎或受限指令集。

### 3. 典型数据路径

<div style="margin:1.8rem 0;padding:1rem 1.1rem;background:var(--surface-card);border:1px solid var(--border-subtle);border-radius:14px">
<svg viewBox="0 0 1000 480" role="img" aria-label="SMARTNIC · DATA PATH"><defs><marker id="pA" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#5d7f96"/></marker></defs><text x="30" y="40" font-size="11" fill="#7b8b99" letter-spacing="2" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">SMARTNIC · DATA PATH</text><text x="30" y="64" font-size="11" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">三平面：数据面硬化，控制面交给 Firmware，管理面独立</text><ellipse cx="144" cy="230" rx="106" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="40,128 240,128 222,110 22,110" fill="#8fa7b6"/><polygon points="40,128 240,128 240,220 40,220" fill="#5c7383"/><polygon points="240,128 222,110 222,202 240,220" fill="#455c6c"/><line x1="40" y1="128" x2="240" y2="128" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="60" cy="148" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="60" y="152" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">01</text><text x="140" y="172" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Host / GPU 内存</text><text x="140" y="191" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">DMA 发起与完成</text><ellipse cx="384" cy="230" rx="106" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="280,128 480,128 462,110 262,110" fill="#7aa6c6"/><polygon points="280,128 480,128 480,220 280,220" fill="#3f6f96"/><polygon points="480,128 462,110 462,202 480,220" fill="#2b5578"/><line x1="280" y1="128" x2="480" y2="128" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="300" cy="148" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="300" y="152" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">02</text><text x="380" y="172" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">PCIe Controller</text><text x="380" y="191" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">ATS · PASID · SR-IOV</text><ellipse cx="624" cy="230" rx="106" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="520,128 720,128 702,110 502,110" fill="#7aa6c6"/><polygon points="520,128 720,128 720,220 520,220" fill="#3f6f96"/><polygon points="720,128 702,110 702,202 720,220" fill="#2b5578"/><line x1="520" y1="128" x2="720" y2="128" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="540" cy="148" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="540" y="152" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">03</text><text x="620" y="172" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">DMA + 地址转换</text><text x="620" y="191" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">零拷贝不等于零工作</text><ellipse cx="864" cy="230" rx="106" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="760,128 960,128 942,110 742,110" fill="#78b7ae"/><polygon points="760,128 960,128 960,220 760,220" fill="#2f7f7a"/><polygon points="960,128 942,110 942,202 960,220" fill="#1f5f5b"/><line x1="760" y1="128" x2="960" y2="128" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="780" cy="148" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="780" y="152" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">04</text><text x="860" y="172" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">RDMA Transport</text><text x="860" y="191" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">QP · 重传 · 完成事件</text><ellipse cx="144" cy="450" rx="106" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="40,348 240,348 222,330 22,330" fill="#78b7ae"/><polygon points="40,348 240,348 240,440 40,440" fill="#2f7f7a"/><polygon points="240,348 222,330 222,422 240,440" fill="#1f5f5b"/><line x1="40" y1="348" x2="240" y2="348" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="60" cy="368" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="60" y="372" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">05</text><text x="140" y="392" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Packet Processing</text><text x="140" y="411" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Parser · Scheduler</text><ellipse cx="384" cy="450" rx="106" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="280,348 480,348 462,330 262,330" fill="#d2ad72"/><polygon points="280,348 480,348 480,440 280,440" fill="#9a7434"/><polygon points="480,348 462,330 462,422 480,440" fill="#77551f"/><line x1="280" y1="348" x2="480" y2="348" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="300" cy="368" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="300" y="372" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">06</text><text x="380" y="392" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">MAC / PCS / FEC</text><text x="380" y="411" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">线速与纠错</text><ellipse cx="624" cy="450" rx="106" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="520,348 720,348 702,330 502,330" fill="#d2ad72"/><polygon points="520,348 720,348 720,440 520,440" fill="#9a7434"/><polygon points="720,348 702,330 702,422 720,440" fill="#77551f"/><line x1="520" y1="348" x2="720" y2="348" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="540" cy="368" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="540" y="372" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">07</text><text x="620" y="392" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">SerDes / PMA</text><text x="620" y="411" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">112G / 224G</text><ellipse cx="864" cy="450" rx="106" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="760,348 960,348 942,330 742,330" fill="#c59a9a"/><polygon points="760,348 960,348 960,440 760,440" fill="#8a4a4a"/><polygon points="960,348 942,330 942,422 960,440" fill="#6a3434"/><line x1="760" y1="348" x2="960" y2="348" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="780" cy="368" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="780" y="372" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">08</text><text x="860" y="392" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">DAC / 光模块</text><text x="860" y="411" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">铜缆或光互连</text><path d="M244,194 Q260,184 276,194" fill="none" stroke="#5d7f96" stroke-width="2" stroke-linecap="round" marker-end="url(#pA)"/><path d="M484,194 Q500,184 516,194" fill="none" stroke="#5d7f96" stroke-width="2" stroke-linecap="round" marker-end="url(#pA)"/><path d="M724,194 Q740,184 756,194" fill="none" stroke="#5d7f96" stroke-width="2" stroke-linecap="round" marker-end="url(#pA)"/><path d="M964,194 Q500,294 36,414" fill="none" stroke="#5d7f96" stroke-width="2" stroke-linecap="round" marker-end="url(#pA)"/><path d="M244,414 Q260,404 276,414" fill="none" stroke="#5d7f96" stroke-width="2" stroke-linecap="round" marker-end="url(#pA)"/><path d="M484,414 Q500,404 516,414" fill="none" stroke="#5d7f96" stroke-width="2" stroke-linecap="round" marker-end="url(#pA)"/><path d="M724,414 Q740,404 756,414" fill="none" stroke="#5d7f96" stroke-width="2" stroke-linecap="round" marker-end="url(#pA)"/></svg>
<p style="font-size:.78rem;line-height:1.7;color:var(--text-muted);text-align:center;margin:.55rem 0 0">图 1：智算网卡的数据路径。控制面由 Firmware 管理，数据面尽量硬化。</p>
</div>

图里的线是为方便阅读。实际描述符、队列上下文、重传状态、地址映射和完成事件会在模块间来回访问。任一处带宽或状态访问不足，都可能让端口闲下来。

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

连接 GPU 或主机内存时，多数业务数据都要经过 PCIe。除了标称速率，还得看 Max Payload Size、Read Request、Completion、NUMA、Root Complex、PCIe Switch 和内存控制器。

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

PCIe 总带宽够，只能排除一种限制；事务效率等开销还要另算。

### 3. PCIe 5.0 x16 与 400G 网卡

PCIe 5.0 将速率提高到 32 GT/s。PCI-SIG 给出的 x16 单方向编码后原始有效带宽约为 504 Gbit/s。[PCI-SIG：PCIe 5.0 带宽](https://pcisig.com/what-bit-rates-does-pcie-50-specification-support-and-how-does-it-compare-prior-pcie-generations)

504 Gbit/s 因此能支撑常见 400G 主机接口组合，但中间差额不能全部当余量。报文以外的 PCIe 事务、地址转换和完成队列，也会使用带宽。

两边都是全双工，以下几种工作状态需要分别测：

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

带宽翻倍以后，信号完整性、FEC、延迟、封装和系统验证的要求也随之提高。

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

这些元数据和控制操作，同样占时间、带宽和状态访问，尤其影响小消息及大量活跃队列。

### 2. 地址转换可能成为隐藏瓶颈

在虚拟化或 GPU Direct 场景中，网卡需要理解进程、虚拟机与设备地址空间。常见机制包括：

- IOMMU；
- Address Translation Services（ATS）；
- Process Address Space ID（PASID）；
- Page Request Interface（PRI）；
- 网卡内部 Translation Cache。

转换缓存不命中，或页粒度不适合访问模式，都会增加地址转换和 PCIe 往返，拖慢 DMA。

### 3. 大规模队列意味着上下文分层存储

QP、CQ、Memory Region 和 Flow 上到数万甚至更多时，最快的 SRAM 装不下全部状态，通常需要分层：

{% mermaid %}
flowchart LR
    A[Hot Context<br/>On-chip SRAM] --> B[Warm Context<br/>External Memory / On-board DRAM]
    B --> C[Cold Context<br/>Host Memory]
    D[Queue / Transport Engine] --> A
    A -.miss.-> B
    B -.miss.-> C
{% endmermaid %}

标称支持 100 万 QP 还不够。要用目标业务的活跃集测 Context Cache Miss，查它给尾延迟和 PCIe 增加了多少负担。

## 四、RDMA Transport Engine 怎样维护状态

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

这些状态同时关乎网络和远端内存。做错以后，可能影响的不只是丢包，还有内存语义、完成顺序与应用可见状态。

### 2. 包级多路径会扩大状态空间

如果网卡支持 Packet Spraying、乱序接收与选择性重传，通常还需要：

- 每包级路径选择；
- Out-of-order Tracking；
- Selective ACK / NACK；
- 直接数据放置；
- Duplicate Suppression；
- 更细粒度的重传 Buffer；
- 更复杂的完成条件判断。

多路径利用率更高、丢包重发范围更小，换来的是更多 SRAM、状态机与待验证组合。

### 3. 协议灵活性首先是验证问题

RTL 写完以后，仍要验证这些组合情况：

- 包重复、乱序与丢失同时发生；
- ACK 或 Credit 本身丢失；
- QP Reset 与重传并发；
- 链路故障与路径切换；
- 多租户资源耗尽；
- Firmware 升级与状态迁移；
- 交换机行为不完全符合预期。

算法在纸面上成立以后，还需要证明有限状态、有限 Buffer 和实际时序足以承载它。灵活性增加，也会增加 Corner Case。

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

稳定且延迟敏感的逻辑适合固定实现；协议变化、客户差异更大的部分，可以放进微引擎或处理器。

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

按 64B 最小包估算，400G 的包率已达数亿 PPS，通用嵌入式核很难逐包承担全部热路径。它更适合上面这些控制工作。

### 4. 专用微引擎填补中间地带

专用微引擎常具有：

- 多线程隐藏访存延迟；
- 受限但高效的指令集；
- 本地 Scratchpad；
- 硬件队列；
- 与 Parser、DMA、Crypto 紧耦合。

可变协议、隧道、定制逻辑、Telemetry 和拥塞算法，可以在这里取得比固定 ASIC 更灵活、比通用 CPU 更贴近数据面的实现。

### 5. CGRA 不是所有“可重构引擎”的统称

Coarse-Grained Reconfigurable Array（CGRA）通常由多个可编程处理单元与可配置互联构成，擅长映射规则数据流和算术计算图。

认定 CGRA 需要看到处理单元、互联、调度或映射模型。“可编程”“可重构微引擎”这两个产品词，还不足以判断内部是哪种结构。

## 六、片上互联的位宽、仲裁与存储

### 1. AXI 是接口协议，不是完整 NoC

AMBA AXI 定义事务与通道语义，适合连接 Master 与 Slave；大型网络 SoC 还需要片上网络（Network-on-Chip, NoC）、Crossbar、Arbiter、Bridge 和多组 SRAM Bank。

分析带宽时，要先分清接口所在的位置：

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

这还只是原始算术带宽。仲裁、空泡、Header、跨时钟、Credit 与读写冲突都会消耗周期，片内资源需要留出余量。

### 3. SRAM 存的远不止报文

高性能网卡需要 SRAM 存放：

- Packet Buffer；
- QP / CQ Context Cache；
- Flow Table；
- Retransmission State；
- Descriptor；
- Scheduler Queue；
- Security Association；
- Telemetry Counter。

这些状态需要大面积 SRAM，可能还要多端口或多 Bank。Buffer 小会增加丢包和外部访问，大了又增加面积、静态功耗与访问延迟，无法只按容量越大越好来选。

### 4. 数据通路与控制通路必须隔离

Firmware、遥测或异常处理如果长时间占住热路径共用的 NoC、SRAM 端口，也会把控制流量变成数据面的抖动。

设计中可以从以下位置隔离：

- 独立管理网络；
- 数据面保留带宽；
- QoS 与优先级；
- 分离的 SRAM Bank；
- 控制面限速；
- 故障风暴下的资源保护。

## 七、112G/224G SerDes 在困难什么

### 1. 速率提升不再靠简单提高时钟

现代高速以太网广泛采用 PAM4（四电平脉冲幅度调制）。PAM4 每个 Symbol 携带 2 bit，因此能够在相近 Baud Rate 下提高数据率。

相应地，一个大眼图分成三个较小眼图，电平间距更小，这些噪声和损耗更难容忍：

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

更强均衡增加功耗与复杂度，DFE 还可能传播误判。SNR 要与通道损耗、面积、功耗、抖动容限和 BER 一起权衡，不能只优化一个数字。

### 3. Pre-FEC BER 与 Post-FEC BER

高速链路通常允许 FEC 前存在一定误码，再由 Forward Error Correction（FEC）把最终 BER 降到系统目标。

$$
\text{Channel Loss / Noise}
\rightarrow \text{Equalization}
\rightarrow \text{Pre-FEC BER}
\rightarrow \text{FEC Coding Gain}
\rightarrow \text{Post-FEC BER}
$$

因此，FEC 不能简单按 SNR 临时决定开关；许多 112G/224G PAM4 标准已经把它放进链路预算。

“FEC 延迟几百纳秒”也缺少实现条件。延迟还取决于：

- 码型与码长；
- Decoder 架构；
- 并行度；
- Interleaving；
- 时钟频率；
- PHY Pipeline。

### 4. 224G 不只是“112G 翻倍”

OIF 的 CEI-224G 工作覆盖 Very Short Reach、Medium Reach、Long Reach 和 Linear 等不同信道目标，面向 800G、1.6T 及更高容量系统。[OIF：CEI-224G](https://www.oiforum.com/technical-work/hot-topics/common-electrical-i-o-cei-224g/)

Reach 不同，对均衡、功耗、材料和封装的预算就不同。短距 224G 能工作，不能证明穿过长 PCB、连接器和铜缆也达到同样结果。

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

换工艺需要重新处理这些模拟与物理条件，无法像数字逻辑那样只重新综合 RTL。

### 2. 一次成功流片的价值极高

数字逻辑有时还能用 Firmware、旁路或后续版本补救，关键 SerDes 通道的眼图与 BER 若达不到要求，却可能直接失去目标端口速率。

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

采购以后仍有大量集成工作。决定自研还是购买，要看差异化来自哪里，以及某块 IP 失败会把项目拖到什么程度。

### 4. 差异化通常落在哪里

资源有限时，我会重点看这些系统能力：

- RDMA Transport；
- Congestion Control；
- Packet Spraying 与乱序恢复；
- Queue / Context 管理；
- 安全卸载；
- 可编程数据面；
- 驱动、Firmware 与生态适配。

把团队用在这些差异化位置，往往比把成熟 PHY 都重新做一遍更有意义。

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

数据跨服务器、机架或数据中心时，加密、身份与租户隔离也就进入了数据路径。

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

### 3. 算法之后还有密钥和状态

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

算法列表不足以描述安全能力。还得说明密钥怎样进入、更新、撤销，租户与控制面如何隔离。

### 4. 安全也会消耗 PPA 与验证资源

安全模块使用面积、功耗、Buffer 和验证资源。低时延封闭 Fabric 未必需要全部功能，要按实际威胁模型选择。

落到产品上，需要回答：

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

这些能力不改变端口峰值，却影响真实服务器能否长期稳定使用它。

### 2. Collective Library 决定实际流量形态

通信库没发现拓扑、GPU Direct 未启用、Collective 算法不匹配，都会让业务绕进 Host Staging 或其他低效路径。400G 的端口本身不会修正这些选择。

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

### 4. 兼容与现场维护需要时间积累

网络控制器的长期壁垒往往来自：

- 多年驱动维护；
- 大量服务器兼容性；
- BIOS / BMC / PXE / NC-SI；
- Linux Kernel Version；
- DPDK；
- RDMA Core；
- GPU Runtime；
- 故障日志与现场支持。

首次流片之后，兼容、驱动与现场支持还要靠持续部署积累。

## 十一、铜通道的限制与 CPO 的取舍

### 1. 高速电信号为什么越来越难走到前面板

芯片到前面板光模块之间，SerDes 要穿过封装、PCB、连接器。Lane 更快、端口更密以后，会遇到：

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

公告能说明已有产品路线，功耗与可靠性比例则仍要回到厂商测试条件，不能直接拼成跨平台跑分。

### 4. CPO 的代价

- 光引擎与高功耗 ASIC 热耦合；
- 封装良率与测试复杂；
- 单个光引擎故障可能影响整机维修；
- 外置激光源、光纤连接器和自动装配要求高；
- 供应链从模块级转向封装级协作；
- 现场更换不如可插拔模块简单。

我据此更倾向于判断：

CPO 会先用于高容量交换和高带宽密度场景，也会与可插拔模块、LPO、LRO、AEC、NPO 长期共存。

## 十二、评价网卡需要哪些测试条件

规格之外，我会查下面几类证据。

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
这些测试都需要保留服务器、GPU、交换机、线缆、拓扑、驱动、Firmware、通信库版本、消息大小与完整命令。条件齐全，别人才能复现，也才知道数字可以比较到哪里。
{% endnote %}

## 十三、国产智算网卡真正面对的机会与边界

### 1. 机会不只来自“国产替代”

国内 CPU、GPU、服务器和云平台需要可控接口、驱动与运维。供应链变化提供机会，最终仍要靠性能、稳定性和适配留住部署。

持续需求还来自：

- 国内异构计算平台需要深度适配；
- AI 网络协议仍在快速演进；
- 安全、虚拟化与多租户需求具有本地差异；
- 客户需要能够快速响应的 Firmware 和驱动团队；
- 网络、存储和加速器之间仍存在大量系统优化空间。

### 2. 端口速率很快会商品化

端口进入 400G、800G 后，下列能力仍难快速补齐：

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

两条路线可以复用 SerDes、封装、DMA 或部分协议，但系统目标和验证方法不同，不能由 Scale-out 成功直接推导 Scale-up 已具备。

### 4. 软件维护周期远长于一次流片

Linux Kernel、DPDK、RDMA Core、GPU Runtime、固件与云平台会继续变化。Tape-out 以后，仍有多年的维护、兼容测试和故障处理，网卡才逐渐成为稳定基础设施。

## 最后看整条路径能否持续工作

分析到这里，需要同时对照三组约束：

- 模拟与物理世界：SerDes、抖动、信道和 FEC；
- 数字芯片世界：DMA、NoC、SRAM、队列、状态机和 PPA；
- 分布式系统世界：Collective、拥塞、故障、软件栈和多租户。

它们会相互影响，单看一组很容易漏掉代价。

端口给出搬运上限，Transport、片上存储和软件决定应用能否稳定用到，交换网络与 Collective 再决定是否缩短训练时间。

因此，评价应沿着工作负载、软件、传输、交换与物理信道走完整条路径。

对 IC 设计，我会继续追问数据为什么移动、状态放在哪里，以及本层优化给下一层增加了多少工作。RTL 正确是起点，持续吞吐还需要把这些接口一起验证。

---

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
