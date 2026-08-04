---
title: 智算互联：从算力堆叠到数据移动的底层博弈
layout: page
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
  <h1 class="series-hero-title">智算互联：从算力堆叠到数据移动的底层博弈</h1>
  <p class="series-hero-desc">
    AI 集群的核心矛盾正在从"单芯片能算多快"转向"数据能否在正确的时间抵达正确的位置"。
    本系列从通信墙、可靠性重构到智算网卡芯片实现，逐层拆解 AI 基础设施中数据移动的底层博弈。
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
    <h3 class="btc-card-title">通信墙</h3>
    <p class="btc-card-desc">从 MFU、并行策略与集合通信出发，解释 AI 集群为什么会从计算密集型走向通信受限。</p>
    <span class="btc-card-date">2026-06</span>
  </a>
  <a href="/2026/06/28/ai-compute-interconnect-part2-reliability-rethink/" class="btc-card">
    <span class="btc-card-kicker">Part 2 · 中篇</span>
    <h3 class="btc-card-title">重构可靠性</h3>
    <p class="btc-card-desc">拆解无损以太网的收益和代价，对比 TTPoE 与 Ultra Ethernet 如何重新分配可靠性。</p>
    <span class="btc-card-date">2026-06</span>
  </a>
  <a href="/2026/06/28/ai-compute-interconnect-part3-smart-nic-chip/" class="btc-card">
    <span class="btc-card-kicker">Part 3 · 下篇</span>
    <h3 class="btc-card-title">智算网卡芯片</h3>
    <p class="btc-card-desc">从 PCIe、DMA、SerDes 到光互联，解析一张高速网卡如何真正成为 AI 集群互联端点。</p>
    <span class="btc-card-date">2026-06</span>
  </a>
</div>

---

## 系列背景

随着 GPU 集群规模从数百张卡扩展到成千上万张，分布式训练的核心瓶颈已经不再是单芯片浮点算力，而是跨节点数据搬运的效率。集合通信、拥塞控制、网络拓扑、传输协议选择乃至 SerDes 与光互联——这些原本分属不同工程领域的子系统，正在共同决定一块 GPU 到底能发挥多大有效算力。

本系列试图回答同一个问题：**当计算能力持续增长时，下一代 AI 系统究竟应该如何重新设计数据移动路径，才能把昂贵的峰值算力真正转化为有效吞吐？**

---

## 文章目录

### 上篇：通信墙——为什么更多 GPU 不等于更高吞吐

**摘要：** 从 MFU、并行策略、集合通信与网络拓扑出发，解释 AI 集群为什么会从计算密集型走向通信受限，以及为什么 400G、800G 链路并不自动等于更高的有效吞吐。

**核心话题：**
- MFU 与通信开销的实系数值关系
- DP / TP / PP / SP / EP 下的流量指纹差异
- All-Reduce 的长尾同步效应
- Scale-Up 拓扑（NVLink、UALink）与 Scale-Out 拓扑（RoCE、UET）的分化逻辑

<a href="/2026/06/28/ai-compute-interconnect-part1-communication-wall/" class="series-btn">阅读上篇 →</a>

---

### 中篇：重构可靠性——从强制无损到端网协同

**摘要：** 从 RoCE、PFC、ECN 与 DCQCN 出发，拆解无损以太网的收益和代价，并对比 IRN、TTPoE 与 Ultra Ethernet 如何把可靠性、拥塞控制和多路径能力重新分配给端点、交换机与控制平面。

**核心话题：**
- PFC 的死锁、不公平与头端阻塞
- Fabric Loss vs. End-to-End Retransmission 的权衡
- TTPoE 的端到端重传方案
- Ultra Ethernet Transport 的包级多路径与选择性 ACK
- In-Network Computing 的角色分配

<a href="/2026/06/28/ai-compute-interconnect-part2-reliability-rethink/" class="series-btn">阅读中篇 →</a>

---

### 下篇：一颗智算网卡如何被造出来——高速接口、数据通路与光互联

**摘要：** 从一颗智算网卡的内部数据通路出发，分析 PCIe、DMA、RDMA Transport、片上 NoC、SRAM、112G/224G SerDes、FEC、可编程处理器与光互联，讨论一张高速网卡如何真正成为 AI 集群中的互联端点。

**核心话题：**
- PCIe Gen5 x16 / CXL 带宽瓶颈
- DMA Engine 与地址翻译的数据面设计
- 片上 SRAM 建模与 NoC 互连
- 112G / 224G SerDes 的实现挑战与功耗
- CPO / SiPh 对 Scale-Out 网络的重塑可能

<a href="/2026/06/28/ai-compute-interconnect-part3-smart-nic-chip/" class="series-btn">阅读下篇 →</a>

---

<div class="series-footer-note">
  <p>三篇文章依次阅读效果最佳，但也支持单独阅读。每篇文章末尾提供了系列内导航。</p>
  <p>标签：<code>AI-Infrastructure</code> · <code>Distributed-Training</code> · <code>GPU-Cluster</code> · <code>SmartNIC</code> · <code>RDMA</code></p>
</div>
