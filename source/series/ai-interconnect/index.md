---
title: 智算互联：分布式训练的通信与硬件架构
layout: page
header: false
date: 2026-07-01 00:00:00
comments: false
---

<!--
  本页面是“智算互联”系列目录页，使用 layout: page，
  不会出现在 Blog Archive 归档页中。
-->

<link rel="stylesheet" href="/css/series-page.css">

<div class="series-hero">
  <p class="series-hero-kicker">SERIES · AI–INFRASTRUCTURE</p>
  <h1 class="series-hero-title">智算互联：分布式训练的通信与硬件架构</h1>
  <p class="series-hero-desc">
    本系列讨论分布式训练中的通信开销、RDMA 可靠性与网卡芯片实现，
    联系模型并行策略、网络控制机制和硬件资源约束。
  </p>
  <div class="series-hero-meta">
    <span>2026–07</span>
    <span>·</span>
    <span>三篇连载</span>
  </div>
</div>

<div class="btc-cards" style="margin: 32px 0;">
  <a href="/2026/06/28/ai-compute-interconnect-part1-communication-wall/" class="btc-card">
    <span class="btc-card-kicker">Part 1 · 上篇</span>
    <h3 class="btc-card-title">训练吞吐与通信瓶颈</h3>
    <p class="btc-card-desc">分析 MFU、并行策略、集合通信与拓扑对训练吞吐的约束。</p>
    <span class="btc-card-date">2026-06</span>
  </a>
  <a href="/2026/06/28/ai-compute-interconnect-part2-reliability-rethink/" class="btc-card">
    <span class="btc-card-kicker">Part 2 · 中篇</span>
    <h3 class="btc-card-title">RDMA 可靠性与拥塞控制</h3>
    <p class="btc-card-desc">比较 RoCE、IRN、TTPoE 与 UET 的可靠传输及拥塞控制机制。</p>
    <span class="btc-card-date">2026-06</span>
  </a>
  <a href="/2026/06/28/ai-compute-interconnect-part3-smart-nic-chip/" class="btc-card">
    <span class="btc-card-kicker">Part 3 · 下篇</span>
    <h3 class="btc-card-title">高性能网卡的芯片架构</h3>
    <p class="btc-card-desc">讨论 PCIe、DMA、片上存储、高速 SerDes 与光互联的实现约束。</p>
    <span class="btc-card-date">2026-06</span>
  </a>
</div>

---

## 系列背景

GPU 集群从数百张扩展到成千上万张时，扩展效率仍受到计算内核、访存、通信与调度共同限制。集合通信的关键路径、拥塞反馈和设备间的数据传输，都会影响有效训练吞吐。

三篇文章分别分析训练负载产生的通信需求、端点与交换网络的可靠性分工，以及这些要求在网卡数据路径和高速接口中的实现约束。

---

## 文章目录

### 上篇：训练吞吐与通信瓶颈

**摘要：** 多维并行改变消息尺寸、同步频率与依赖关系。上篇联系 MFU、集合通信、网络拓扑和尾延迟，分析理论算力向有效训练吞吐转化的条件。 400G、800G 端口速率只描述局部能力。

**核心话题：**
- MFU 与暴露通信开销
- DP / TP / PP / CP / EP 的通信模式
- All-Reduce 的长尾同步效应
- Scale-Up 拓扑（NVLink、UALink）与 Scale-Out 拓扑（RoCE、UET）的分化逻辑

<a href="/2026/06/28/ai-compute-interconnect-part1-communication-wall/" class="series-btn">阅读上篇 →</a>

---

### 中篇：RDMA 可靠性与拥塞控制

**摘要：** 从 RoCE、PFC、ECN 与 DCQCN 出发，拆解无损以太网的收益和代价，并对比 IRN、TTPoE 与 Ultra Ethernet 如何把可靠性、拥塞控制和多路径能力重新分配给端点、交换机与控制平面。

**核心话题：**
- PFC 的队头阻塞、拥塞传播与死锁条件
- Fabric Loss vs. End-to-End Retransmission 的权衡
- TTPoE 的端到端重传方案
- Ultra Ethernet Transport 的包级多路径与选择性 ACK
- In-Network Computing 的角色分配

<a href="/2026/06/28/ai-compute-interconnect-part2-reliability-rethink/" class="series-btn">阅读中篇 →</a>

---

### 下篇：高性能网卡的芯片架构

**摘要：** 沿 RNIC 数据路径分析 PCIe、DMA、Transport 状态、NoC 与 SRAM 的吞吐约束，进一步讨论 112G/224G SerDes、FEC、软件栈和光互联的工程取舍。

**核心话题：**
- PCIe Gen5 x16 / CXL 带宽瓶颈
- DMA Engine 与地址翻译的数据面设计
- 片上 SRAM 建模与 NoC 互连
- 112G / 224G SerDes 的实现挑战与功耗
- CPO / SiPh 对 Scale-Out 网络的重塑可能

<a href="/2026/06/28/ai-compute-interconnect-part3-smart-nic-chip/" class="series-btn">阅读下篇 →</a>

---

<div class="series-footer-note">
  <p>三篇文章按通信需求、传输机制和芯片实现组织，也可单独阅读。每篇末尾提供系列导航。</p>
  <p>标签：<code>AI-Infrastructure</code> · <code>Distributed-Training</code> · <code>GPU-Cluster</code> · <code>SmartNIC</code> · <code>RDMA</code></p>
</div>
