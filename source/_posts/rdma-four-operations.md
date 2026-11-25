---
title: "通信原语背后的 RDMA ——理解四种 RDMA 操作"
date: 2026-11-25 18:00:00
updated: 2026-11-25 18:15:00
lang: zh-CN
published: true
categories: Silicon & Circuits
tags:
  - RDMA
  - 网卡
  - PCIe
  - 集合通信
  - AI Infrastructure
etoc: true
toc:
  max_depth: 2
description: "跟踪一条 4 KiB 消息的队列项、PCIe 事务和网络包，对照 SEND、WRITE、READ 和 Atomic，再从 RecoNIC 和 NCCL 源码看接收地址与完成通知怎样传递。"
---

{% note primary %}
A 要给 B 发 4 KiB 数据。用 SEND，A 可以一直不知道这 4 KiB 最后落在 B 的哪个地址。换成 RDMA WRITE，A 在提交请求时就得把那个地址填好。同样是把数据从 A 搬到 B，两张网卡分别要做什么？
{% endnote %}

<!-- more -->

A 的网卡从本机内存把数据读出来，B 的网卡把收到的数据写进去。数据先经过 A 的 PCIe，再过网络，最后经过 B 的 PCIe。文末的 NCCL 例子里，还有一次沿反方向走的 WRITE。B 用它把接收地址告诉 A。有关这块数据为什么需要跨卡传输，可对照读[《大模型训练和推理中的通信》](/2026/11/25/llm-training-inference-communication/)。

## 一、先找出缓冲区，再看网卡

A、B 各有一张支持远程直接内存访问（RDMA）的网卡，下文简称 RNIC。两边已经建好可靠连接（RC），数据放在主机内存里。图 1 中间的以太网链路用的是 RoCEv2，两张网卡把 RDMA 传输包封装在 UDP/IP 里收发。<sup class="cite"><a href="#rd-ref-1">[1]</a></sup>

应用先把可用的内存范围注册为 **MR**（Memory Region）。程序用散布／聚集列表描述本地缓冲区。列表中的每一项叫 SGE（scatter/gather element），用地址、长度和 `lkey` 指出要访问哪一段。如果 B 还希望 A 能远程读或写某段内存，就要授予相应权限，并通过双方的协议把远端地址和 `rkey` 告诉 A。网卡据此检查请求访问的范围和权限。B 可以把一个区域开放给 A 读，另一个区域开放给 A 写。<sup class="cite"><a href="#rd-ref-1">[1]</a></sup><sup class="cite"><a href="#rd-ref-2">[2]</a></sup>

{% visual_svg rdma-four-operations/01-two-hosts %}
图 1｜两台主机、一条网络和两段 PCIe。发一次普通的 4 KiB 消息，A 的网卡从本地内存读出载荷，B 的网卡把载荷写进自己的主机内存。图中选用主存队列、网卡主动取发送 WQE、载荷不内联的路径。
{% endvisual_svg %}

图 1 里，A 的程序向发送队列（SQ）提交一条工作请求（WR）。负责适配设备的 verbs provider 会把它编码成网卡能读的队列项（WQE）。CPU 写门铃寄存器（doorbell），提醒网卡取新工作。CPU 用内存地址访问设备寄存器，称为内存映射 I/O（MMIO）。接下来由网卡通过 PCIe 主动读主存，先取 WQE，再读它指向的载荷。这就是直接内存访问（DMA）。<sup class="cite"><a href="#rd-ref-1">[1]</a></sup><sup class="cite"><a href="#rd-ref-13">[13]</a></sup>

发送队列和接收队列（RQ）组成队列对（QP）。每个 QP 有自己的编号 QPN。包里的目的 QPN 让 B 的网卡找到连接的状态，至于到达的数据该往哪个地址写，还得看操作码。应用通过完成队列（CQ）取回已完成请求的状态。下文的单条示例给 A 的请求设置了完成标志（signaled），因此成功后也会报告。<sup class="cite"><a href="#rd-ref-1">[1]</a></sup><sup class="cite"><a href="#rd-ref-4">[4]</a></sup>

### 一条 SEND 在主机里占几块内存

设 A 注册了一块 12 KiB 的内存，基址为 P。第一段从 P 起取 1024 B，第二段从 P + 8192 起取 3072 B，中间的空隙不用发送。A 用一条 SEND 引用两段内存，先列 1 KiB 的 SGE，再列 3 KiB 的 SGE。B 可以用一个连续的 4096 B 缓冲区接收，接到的字节顺序就是第一段接第二段。<sup class="cite"><a href="#rd-ref-1">[1]</a></sup><sup class="cite"><a href="#rd-ref-3">[3]</a></sup>

{% visual_svg rdma-four-operations/06-queue-walk %}
图 2｜A 端的发送队列和载荷。上图按比例画出了两段源数据，中间空出的 7 KiB 不会上网。下图的读请求向左走，返回的数据向右走。最下面一行对应整条 SEND 的本地完成。
{% endvisual_svg %}

提交函数返回成功时，网卡未必已把第二段读完。若 A 这时就覆写它，可能改掉本次要发的内容。A 可以在提交时给工作请求分配一个本地标识 `wr_id`，稍后轮询 CQ，通过完成记录认出是哪条请求成功了，再复用两段源缓冲区。这个标识留在本端。以 mlx5 为例，provider 会保存应用填的标识，轮询时能依据硬件返回的信息找到它。<sup class="cite"><a href="#rd-ref-3">[3]</a></sup><sup class="cite"><a href="#rd-ref-4">[4]</a></sup><sup class="cite"><a href="#rd-ref-13">[13]</a></sup>

## 二、同一对网卡，四种操作

先播放 SEND，再切到 WRITE，看看 B 端哪一项给出了目的地址。WRITE 还可以切换成“带立即数”，这时数据仍然落在原处，变化的是 B 的接收队列和完成通知。动画把 A 的 4 KiB 统称为 TX。要看网卡怎样从两个地址读出这块数据，可以回看图 2。

{% raw %}
<style>
#rdma-operation-path {
  --rd-ink: var(--text-primary, #263543);
  --rd-muted: var(--text-secondary, #4c5c6c);
  --rd-rule: var(--border-subtle, #a1b1bf);
  --rd-panel: var(--surface-card, #fff);
  --rd-control: var(--chart-blue, #34699a);
  --rd-data: var(--chart-teal, #18796c);
  --rd-local: var(--chart-amber, #8c581a);
  --rd-current: var(--rd-local);
  color: var(--rd-ink);
  container-type: inline-size;
}
#rdma-operation-path[data-event-kind="control"] { --rd-current: var(--rd-control); }
#rdma-operation-path[data-event-kind="data"] { --rd-current: var(--rd-data); }
#rdma-operation-path [hidden], #rdma-operation-path[data-rdma-ready] [data-rdma-static] { display: none !important; }
#rdma-operation-path .rd-actions, #rdma-operation-path .rd-ops, #rdma-operation-path .rd-nav { display:flex; flex-wrap:wrap; align-items:center; gap:.35rem; }
#rdma-operation-path .rd-actions { justify-content:space-between; gap:.55rem; }
#rdma-operation-path :is(button, select) {
  color:var(--rd-ink); border:1px solid var(--rd-rule); background:var(--rd-panel);
  border-radius:.38rem; padding:.27rem .55rem; min-height:2.15rem; font:inherit; font-size:.85rem;
}
#rdma-operation-path button { cursor:pointer; }
#rdma-operation-path button[aria-pressed="true"] { border-color:var(--rd-ink); box-shadow:inset 0 -2px var(--rd-ink); font-weight:700; }
#rdma-operation-path button[aria-disabled="true"] { opacity:.42; cursor:default; }
#rdma-operation-path :is(button,select):focus-visible { outline:2px solid var(--rd-control); outline-offset:2px; }
#rdma-operation-path .rd-variant { display:flex; align-items:center; flex-wrap:wrap; gap:.45rem; margin:.6rem 0 0; font-size:.88rem; }
#rdma-operation-path .rd-map { display:grid; grid-template-columns:minmax(0,1.15fr) .64fr minmax(0,1fr) .77fr minmax(0,1fr) .64fr minmax(0,1.15fr); grid-template-areas:"am pa an net bn pb bm"; align-items:center; margin:1.05rem 0; }
#rdma-operation-path [data-node="am"] { grid-area:am; } #rdma-operation-path [data-node="an"] { grid-area:an; }
#rdma-operation-path [data-node="bn"] { grid-area:bn; } #rdma-operation-path [data-node="bm"] { grid-area:bm; }
#rdma-operation-path [data-edge="a"] { grid-area:pa; } #rdma-operation-path [data-edge="b"] { grid-area:pb; }
#rdma-operation-path [data-edge="wire"] { grid-area:net; }
#rdma-operation-path .rd-node {
  display:grid; place-content:center; text-align:center; min-height:3.55rem; line-height:1.25; padding:.26rem;
  color:var(--rd-ink); border:1px solid var(--rd-rule); border-radius:.45rem; background:var(--rd-panel);
}
#rdma-operation-path .rd-node b { font-weight:650; font-size:.92rem; }
#rdma-operation-path .rd-node small { margin-top:.2rem; font:.79rem/1.15 ui-monospace, monospace; color:var(--rd-muted); }
#rdma-operation-path .rd-node[data-current] { border:2px solid var(--rd-current); background:color-mix(in srgb, var(--rd-current) 8%, var(--rd-panel)); }
#rdma-operation-path .rd-edge { display:grid; position:relative; place-items:center; color:var(--rd-muted); height:2.8rem; min-width:0; }
#rdma-operation-path .rd-edge small { position:absolute; top:.05rem; font-size:.73rem; line-height:1.1; white-space:nowrap; color:var(--rd-muted); }
#rdma-operation-path .rd-edge i { position:relative; display:block; width:100%; border-top:1px solid var(--rd-rule); }
#rdma-operation-path .rd-edge[data-direction] i { color:var(--rd-current); border-top:3px solid currentColor; }
#rdma-operation-path[data-event-kind="control"] .rd-edge[data-direction] i { border-top-style:dashed; }
#rdma-operation-path .rd-edge[data-direction] i::after {
  position:absolute; right:0; top:-5px; content:""; width:7px; height:7px;
  border-top:2px solid; border-right:2px solid; transform:rotate(45deg);
}
#rdma-operation-path .rd-edge[data-direction="back"] i::after { left:0; right:auto; transform:rotate(-135deg); }
#rdma-operation-path .rd-edge[data-direction] i::before {
  content:""; position:absolute; z-index:1; width:6px; height:6px; border-radius:50%; top:-4.5px;
  background:currentColor; animation:rdma-four-pulse .8s ease-out both;
}
#rdma-operation-path .rd-edge[data-direction="back"] i::before { animation-direction:reverse; }
@keyframes rdma-four-pulse { from { left:4%; } to { left:86%; } }
#rdma-operation-path .rd-story { border-left:3px solid var(--rd-current); padding:.15rem 0 .15rem .8rem; margin:.5rem 0 .85rem; }
#rdma-operation-path .rd-story strong { font-size:1rem; font-weight:650; }
#rdma-operation-path .rd-counter { font:.78rem/1.2 ui-monospace,monospace; color:var(--rd-muted); margin-right:.5rem; white-space:nowrap; }
#rdma-operation-path .rd-story p { margin:.25rem 0 0; text-align:start; font-size:.93rem; line-height:1.6; }
#rdma-operation-path .rd-ledger { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.9rem; }
#rdma-operation-path .rd-ledger section { border-top:1px solid var(--rd-rule); padding-top:.4rem; }
#rdma-operation-path .rd-ledger strong { font-weight:650; font-size:.85rem; }
#rdma-operation-path .rd-ledger dl { display:grid; grid-template-columns:max-content minmax(0,1fr); gap:.2rem .5rem; margin:.4rem 0 0; font-size:.82rem; line-height:1.45; text-align:start; }
#rdma-operation-path .rd-ledger dt { color:var(--rd-muted); }
#rdma-operation-path .rd-ledger dd { margin:0; overflow-wrap:anywhere; }
#rdma-operation-path .rd-ledger dd[data-changed] { font-weight:650; }
#rdma-operation-path .rd-request { margin:.7rem 0 .2rem; border-top:1px solid var(--rd-rule); padding:.4rem 0 0; }
#rdma-operation-path .rd-request summary { cursor:pointer; color:var(--rd-ink); font-size:.86rem; font-weight:650; overflow-wrap:anywhere; }
#rdma-operation-path .rd-request summary:focus-visible { outline:2px solid var(--rd-control); outline-offset:2px; }
#rdma-operation-path .rd-request code { padding:.06rem .23rem; font-size:.8rem; color:inherit; background:transparent; overflow-wrap:anywhere; white-space:normal; }
#rdma-operation-path .rd-request dl { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.48rem .9rem; margin:.52rem 0 .28rem; font-size:.82rem; line-height:1.42; }
#rdma-operation-path .rd-request dl div { min-width:0; }
#rdma-operation-path .rd-request dt { color:var(--rd-muted); }
#rdma-operation-path .rd-request dd { margin:.07rem 0 0; overflow-wrap:anywhere; }
#rdma-operation-path figcaption { margin:.8rem 0 0; text-align:start; }
#rdma-operation-path [data-rdma-static] { margin:.6rem 0; font-size:.9rem; }
@container (max-width: 32rem) {
  #rdma-operation-path .rd-map { grid-template-columns:minmax(0,1fr) .55fr minmax(0,1fr); grid-template-rows:auto 2.5rem auto; grid-template-areas:"am pa an" ". . net" "bm pb bn"; max-width:25rem; margin:.8rem auto; }
  #rdma-operation-path [data-edge="b"] i { transform:rotate(180deg); }
  #rdma-operation-path [data-edge="wire"] { height:100%; }
  #rdma-operation-path [data-edge="wire"] small { top:50%; left:calc(50% + .65rem); transform:translateY(-50%); }
  #rdma-operation-path [data-edge="wire"] i { width:2.5rem; transform:rotate(90deg); }
  #rdma-operation-path .rd-node { min-height:2.6rem; }
}
@container (max-width: 24rem) {
  #rdma-operation-path .rd-request dl { grid-template-columns:1fr; }
  #rdma-operation-path .rd-request dl div { display:grid; grid-template-columns:6.5em minmax(0,1fr); gap:.4rem; }
  #rdma-operation-path .rd-ledger { grid-template-columns:1fr; gap:.55rem; }
  #rdma-operation-path .rd-ledger section { display:grid; grid-template-columns:4.3em 1fr; gap:.4rem; align-items:start; }
  #rdma-operation-path .rd-ledger dl { margin:0; }
}
@media (prefers-reduced-motion: reduce) {
  #rdma-operation-path .rd-edge[data-direction] i::before { display:none; animation:none; }
}
</style>
<figure class="v-figure" id="rdma-operation-path" aria-label="四种 RDMA 操作的双端路径">
  <div data-rdma-controls hidden>
    <div class="rd-actions">
      <div class="rd-ops" role="group" aria-label="选择操作">
        <button type="button" data-op="send" aria-pressed="true">SEND</button>
        <button type="button" data-op="write" aria-pressed="false">WRITE</button>
        <button type="button" data-op="read" aria-pressed="false">READ</button>
        <button type="button" data-op="atomic" aria-pressed="false">ATOMIC</button>
      </div>
      <div class="rd-nav" role="group" aria-label="演示进度">
        <button type="button" data-move="prev" aria-disabled="true">上一步</button>
        <button type="button" data-move="next">下一步</button>
        <button type="button" data-move="play">播放</button>
      </div>
    </div>
    <div class="rd-variant" data-atomic-controls hidden>
      <label for="rdma-four-atomic">原子操作</label>
      <select id="rdma-four-atomic"><option value="faa" selected>Fetch &amp; Add (+1)</option><option value="hit">CAS (41 → 99)</option><option value="miss">CAS (40 → 99)</option></select>
    </div>
    <div class="rd-variant" data-write-controls hidden>
      <label for="rdma-four-write">写入方式</label>
      <select id="rdma-four-write"><option value="plain" selected>普通 WRITE</option><option value="imm">WRITE_WITH_IMM（立即数 3）</option></select>
    </div>
  </div>
  <div class="rd-map" aria-label="从 A 到 B 依次经过 A 主机内存、PCIe、A RNIC、网络、B RNIC、PCIe 和 B 主机内存">
    <div class="rd-node" data-node="am"><b>A 主机</b><small data-memory-label="a">DRAM · TX</small></div>
    <span class="rd-edge" data-edge="a"><small>PCIe</small><i aria-hidden="true"></i></span>
    <div class="rd-node" data-node="an"><b>A 网卡</b><small>RNIC</small></div>
    <span class="rd-edge" data-edge="wire"><small>网络</small><i aria-hidden="true"></i></span>
    <div class="rd-node" data-node="bn"><b>B 网卡</b><small>RNIC</small></div>
    <span class="rd-edge" data-edge="b"><small>PCIe</small><i aria-hidden="true"></i></span>
    <div class="rd-node" data-node="bm"><b>B 主机</b><small data-memory-label="b">DRAM · RX7</small></div>
  </div>
  <div class="rd-story" role="status" aria-live="polite" aria-atomic="true">
    <span class="rd-counter" data-counter>0 / 5</span><strong data-event-title>SEND 的起点</strong>
    <p data-event-text>A 有 4 KiB 待发数据。B 已提前投递一条接收请求，指定 RX7 用来存放这条消息。</p>
  </div>
  <div class="rd-ledger">
    <section aria-label="发起端状态"><strong>A 发起端</strong><dl>
      <dt>内存</dt><dd data-field="aMem">TX · 4 KiB</dd>
      <dt>SQ</dt><dd data-field="sq">尚未提交</dd>
      <dt>CQ</dt><dd data-field="aCq">等待</dd>
    </dl></section>
    <section aria-label="响应端状态"><strong>B 响应端</strong><dl>
      <dt>内存</dt><dd data-field="bMem">RX7 · 空</dd>
      <dt>RQ</dt><dd data-field="rq">RX7 已投递</dd>
      <dt>CQ</dt><dd data-field="bCq">等待</dd>
    </dl></section>
  </div>
  <details class="rd-request" open>
    <summary>请求字段与接收条件　<code data-wr-field="opcode">IBV_WR_SEND</code></summary>
    <dl>
      <div><dt>A 的本地 SGE</dt><dd data-wr-field="local">源 TX · 4 KiB · lkey(TX)</dd></div>
      <div><dt>A 填的远端目标或源</dt><dd data-wr-field="remote">只指定已连接 QP，无远端地址和 rkey</dd></div>
      <div><dt>B 的内存权限</dt><dd data-wr-field="access">RX7 允许本地 RNIC 写入</dd></div>
      <div><dt>B 的接收 WQE</dt><dd data-wr-field="receive">1 条 · 指定载荷缓冲区 RX7</dd></div>
      <div data-wr-extra hidden><dt data-wr-extra-label></dt><dd data-wr-field="extra"></dd></div>
    </dl>
  </details>
  <div data-rdma-static><p>SEND 把数据送进 B 预投的 RX7。WRITE 写入 A 指定的 B 端 slot3。带立即数的写还消耗 B 的一条接收 WQE，B 轮询 CQ 后从返回的工作完成记录（WC）读到立即数 3。READ 把 slot3 的数据拉回 A。对 B 的计数器执行 Fetch &amp; Add (+1)，B 的值从 41 变为 42，A 收到旧值 41。</p></div>
  <figcaption class="v-caption">图 3｜虚线箭头表示控制信息，实线箭头表示数据。每步跟踪一次逻辑动作，可以包含多个包。可靠连接的确认与重传从略。</figcaption>
</figure>
<script src="/js/rdma-four-operations.js" defer></script>
{% endraw %}

### SEND 由 B 决定消息落在哪儿

B 先挑一块够大的接收缓冲区，叫它 `RX7`。B 通过 `ibv_post_recv` 把它挂到 RQ 上，随后可以去做别的工作。A 只要在自己 SQ 的 SEND 请求里填写本地数据的位置、长度及本地密钥。A 的网卡从内存读出 4 KiB，沿连接发往 B。B 的网卡从自己的 RQ 取下一个接收项，才知道要把数据写入 `RX7`。缓冲区的地址始终由 B 管。<sup class="cite"><a href="#rd-ref-1">[1]</a></sup><sup class="cite"><a href="#rd-ref-3">[3]</a></sup>

B 轮询到这条接收完成后，可以凭接收请求的标识找到 `RX7`，并从完成项读出实际收到的长度。如果包已经到了，B 却还没有可用的接收项，RC 响应方可以回复 Receiver Not Ready（RNR），A 的网卡按配置重试。即使 A 的网卡已经收到对端的 ACK，B 的程序也可能还没来得及轮询 CQ。<sup class="cite"><a href="#rd-ref-1">[1]</a></sup><sup class="cite"><a href="#rd-ref-4">[4]</a></sup>

{% visual_svg rdma-four-operations/04-send-segments %}
图 4｜同一条 SEND 可以装进一个包，也可以拆成四个。横向长度代表应用载荷字节数。两行均假设传输成功、无重传，B 预投了足够大的接收缓冲区。图中不计报头和 ACK。
{% endvisual_svg %}

把这条 SEND 的路径 MTU（PMTU）设为 1024 B，网卡在网络上依次发 First、Middle、Middle、Last 四个包。四个包合起来才是一条消息，B 总共消耗一个接收项，得到一次成功接收完成。改回 4096 B，网络上一个 Only 包就能发完，应用看到的完成数相同。<sup class="cite"><a href="#rd-ref-1">[1]</a></sup><sup class="cite"><a href="#rd-ref-9">[9]</a></sup>

{% raw %}<details><summary>同一笔 4 KiB，换到 PCIe 上会看到多少个事务？</summary>{% endraw %}

只数载荷的搬运。假设两段源缓冲区和连续的目的缓冲区都从 4 KiB 页边界开始，PCIe 最大读请求大小（MRRS）为 512 B，两端相关路径的最大有效载荷（MPS）都为 256 B。下表按每次都取到上限计算。<sup class="cite"><a href="#rd-ref-15">[15]</a></sup>

| 观察位置 | 在链路上数什么 | 4 KiB 这一例 |
| --- | --- | ---: |
| A 端 PCIe，RNIC 向主机发请求 | 内存读请求（MRd），每次请求 512 B | 8 个 |
| A 端 PCIe，主机向 RNIC 返回数据 | 带数据的读完成（CplD），每个至多带 256 B | 16 个 |
| 两台机器之间的网络 | PMTU 为 1024 B 的 SEND 数据包 | 4 个 |
| B 端 PCIe，RNIC 向主存写载荷 | 内存写事务（MWr），每个带 256 B | 16 个 |
| B 的应用 | 轮询到的成功接收完成 | 1 条 |

两端 PCIe 计数中的 8、16、16 是上述条件下的最少数量。真实设备可以拆得更细，取 WQE、写完成项也另有流量。比如 A 的网卡向主机读 512 B，至少要等两个 CplD 才收齐这一笔读请求的数据。B 的应用轮询时，只看到整条 4 KiB 消息的一次接收完成。

{% raw %}</details>{% endraw %}

### WRITE 把数据放进约好的位置

这次 B 在已注册区域里留出 `slot3`，开好远程写权限，把槽的地址和 `rkey` 告诉 A。A 提交 RDMA WRITE 时，同时填写本地 4 KiB 的来源和 B 的目的地址。A 的网卡照旧读本地内存，B 的网卡检查请求后，直接把数据写进 `slot3`。和刚才的 SEND 相比，两端 PCIe 上大块数据的方向完全一样，换掉的是 B 查找写入位置的方法。<sup class="cite"><a href="#rd-ref-1">[1]</a></sup><sup class="cite"><a href="#rd-ref-2">[2]</a></sup><sup class="cite"><a href="#rd-ref-3">[3]</a></sup>

普通 WRITE 不消耗 B 的接收 WQE，也不给 B 的应用产生这笔写入的接收完成。如果 B 还想知道哪一个槽可以读，可以约定用 **WRITE_WITH_IMM**。A 写入的目的地址仍是 `slot3`，同时附上一个 32 位立即数，比如槽号 3。B 为通知预投一个接收请求，给它取本地标识 7。<sup class="cite"><a href="#rd-ref-1">[1]</a></sup><sup class="cite"><a href="#rd-ref-3">[3]</a></sup><sup class="cite"><a href="#rd-ref-4">[4]</a></sup>

{% visual_svg rdma-four-operations/07-receive-placement %}
图 5｜只看 B。实线跟踪 4 KiB 载荷，虚线跟踪接收通知。每一行是一次独立实验。最下一行，软件轮询所得的 wr_id = 7 由 B 填写，立即数 3 由 A 填写。
{% endvisual_svg %}

在 B 看到的这条完成记录里，`wr_id = 7` 告诉 B 哪一个接收请求被消耗了，`imm_data` 经双方约定的编码解读为 3，告诉 B 去哪个槽读数据。两项都出现在一次轮询结果里，却来自两台机器。普通 SEND 若遇上空的接收队列会触发 RNR，带立即数的 WRITE 同样需要可用的接收项。普通 WRITE 可以在不消耗接收项的情况下着陆，但仍得等上层协议允许，A 才能覆盖 B 正在读的槽。<sup class="cite"><a href="#rd-ref-1">[1]</a></sup><sup class="cite"><a href="#rd-ref-4">[4]</a></sup>

还有一个细节在抓包时能看见。如果 WRITE 跨越多个传输包，远端起始地址、rkey 和总长度在 First 包的远端扩展传输头（RETH）里。Middle 和普通 Last 不再重发这三个字段。若是带立即数的多包 WRITE，立即数跟在 Last 包里。单包操作则在 Only 包里一次给齐所需字段。<sup class="cite"><a href="#rd-ref-16">[16]</a></sup>

### READ 的请求和数据往相反方向走

如果数据原本就在 B 的 `slot3`，而 A 想把它取回来，B 可以给这段内存开远程读权限，把地址和 `rkey` 交给 A。A 在 SQ 提交 READ，填的是 **B 的源地址和 A 的目的缓冲区**。离开 A 的先是一条读请求，写明从哪里读、读多少，4 KiB 载荷此时还在 B。<sup class="cite"><a href="#rd-ref-1">[1]</a></sup><sup class="cite"><a href="#rd-ref-2">[2]</a></sup><sup class="cite"><a href="#rd-ref-3">[3]</a></sup>

看一笔 PMTU 为 1024 B、无重传的 4 KiB READ。A 只发一条读请求，B 的 RNIC 通过 B 端 PCIe 读出主存里的 4 KiB，把数据分进四个响应包。A 的 RNIC 收到它们后，按自己原先提交的 READ 请求，把数据写入 A 的目的缓冲区。B 只需要知道读自己哪块内存，A 的目的地址和本地 lkey 可以一直留在 A。A 轮询到成功完成后就可以读结果。B 无需为这次读取投递接收请求，但要保证源内存在读取期间有效。<sup class="cite"><a href="#rd-ref-1">[1]</a></sup><sup class="cite"><a href="#rd-ref-3">[3]</a></sup><sup class="cite"><a href="#rd-ref-16">[16]</a></sup>

### Atomic 拿回计数器修改前的值

把 4 KiB 的槽换成一个 8 字节对齐的 64 位计数器，初值为 41。B 为它所在的 MR 开启远程原子权限，并把地址和 rkey 交给请求方。两台请求方都想领一个编号。如果各自先 READ，再把旧值加一 WRITE 回去，它们可能同时读到 41，最后都写回 42。明明领了两次号，计数器只走了一步。

支持远端原子的 RNIC 可以执行 **Fetch-and-Add（FAA）**。A 给出远端地址、`rkey` 和加数 1，并留出本地的 8 字节结果缓冲区。B 对这个字做一次不可分割的读改写，计数器变为 42，返回 A 的是**旧值 41**。若两个请求都通过同一响应 RNIC 对这个字做 FAA，并且中间没有其他写入，它们会分别领到 41 和 42，最终计数为 43。谁先领到哪个号取决于操作的执行顺序。<sup class="cite"><a href="#rd-ref-3">[3]</a></sup><sup class="cite"><a href="#rd-ref-10">[10]</a></sup>

{% visual_svg rdma-four-operations/03-atomic-race %}
图 6｜A 和 C 通过 B 的同一张 RNIC 更新一个计数器。左边是先 READ 再 WRITE 的一种交错次序，右边让两个请求都执行 Fetch-and-Add。两次返回的旧值可以直接用作不同的编号。
{% endvisual_svg %}

另一种经典操作是 **Compare-and-Swap（CAS）**。A 可以要求“若还是 41，就改成 99”。在演示的命中分支里，B 从 41 变为 99，A 收到 41。再切到未命中分支，这次 A 要求“若为 40，就换成 99”，B 的初值仍为 41，于是它保持 41，A 收到的也是 41。A 把返回的旧值与本次提交的期望值一比，就知道是否发生了替换。两条工作请求都可以正常完成。线上返回的是带旧值的 Atomic ACK，A 的网卡把旧值写进结果缓冲区，成功状态则通过 CQ 交给 A 的程序。因而查 CQ 可以知道请求是否执行完，查结果缓冲区才能知道旧值。<sup class="cite"><a href="#rd-ref-16">[16]</a></sup>

经典 RC 原子操作针对一个 64 位字。能否与 B 的 CPU 或另一张网卡并发地对同一字做原子访问，取决于设备报告的原子能力范围。远端 RNIC 怎样实现这次读改写，verbs 也没有规定必须用某一种 PCIe 事务。<sup class="cite"><a href="#rd-ref-3">[3]</a></sup><sup class="cite"><a href="#rd-ref-10">[10]</a></sup>

| A 提交的操作 | B 端访问哪里 | 网络上主要的数据方向 | B 消耗接收 WQE | B 轮询 CQ 时能否得到接收完成 |
| --- | --- | --- | --- | --- |
| SEND | B 从 RQ 取出的接收缓冲区 | 4 KiB 从 A 到 B | 是 | 是 |
| WRITE | A 给出的远端目的地址 | 4 KiB 从 A 到 B | 否 | 否 |
| READ | A 给出的远端源地址 | 请求从 A 到 B，4 KiB 从 B 到 A | 否 | 否 |
| Atomic | A 给出的远端 64 位字地址 | 操作数从 A 到 B，旧值从 B 到 A | 否 | 否 |
| WRITE_WITH_IMM（WRITE 的变体） | A 给出的远端目的地址 | 载荷和立即数从 A 到 B | 是 | 是，带立即数 |

## 三、一条 WRITE 在 RecoNIC 里怎么走

回到 WRITE 的例子。B 的网卡收到了包，准备往主机内存里的 `slot3` 写 4 KiB。这次把图 1 中 B 的方框展开，换成 Alveo U250 上的 **RecoNIC**。它的板级设计和软件都可以查源码，负责处理 RoCEv2 的是 AMD 的许可 IP ERNIC v3.1。<sup class="cite"><a href="#rd-ref-5">[5]</a></sup><sup class="cite"><a href="#rd-ref-6">[6]</a></sup>

{% visual_svg rdma-four-operations/02-reconic %}
图 7｜RecoNIC 的收包分流和内存访问。沿以太网入口看，普通包与 RoCE 包进不同模块。沿 ERNIC 的内存接口看，目标可以是主机内存，也可以是板载 DDR。两边的 ERNIC 是同一个硬件模块。<sup class="cite"><a href="#rd-ref-5">[5]</a></sup><sup class="cite"><a href="#rd-ref-6">[6]</a></sup>
{% endvisual_svg %}

从网线进来，帧先到以太网 MAC（CMAC）。分类器把 RoCE 流量送给 ERNIC，普通网络流量另走常规收包路径。这个 WRITE 会进 ERNIC。找到目标缓冲区后，引擎从片上的 AXI 内存接口发出写入，经交叉开关和 QDMA 的 PCIe 桥到达主机内存。如果目的缓冲区在板载 DDR，写入就在板上结束。图里 QDMA 出现了两次。左边处理普通包的接收，右边给 ERNIC 提供通往主机内存的桥。<sup class="cite"><a href="#rd-ref-5">[5]</a></sup><sup class="cite"><a href="#rd-ref-7">[7]</a></sup>

### 网卡保存了什么，队列又放在哪里

选 RecoNIC 示例的 `host_mem` 配置，SQ、RQ 和 CQ 的存储在主机里。那 ERNIC 怎么知道该读哪一项？建 RC QP 时，软件把队列基地址和深度等参数交给硬件，同时配置远端 QPN、包序号（PSN）、路径 MTU、重试参数及保护域（PD）。它们属于每条连接自己的状态。PG332 描述的 QP Manager 会在发送队列间仲裁，缓存已经取回的发送 WQE，再交给 WQE Processor 按 PMTU 组包、驱动 DMA。这样，主存里有发送队列，卡上也能暂存其中一项的副本。<sup class="cite"><a href="#rd-ref-6">[6]</a></sup><sup class="cite"><a href="#rd-ref-7">[7]</a></sup>

进来的 WRITE 还要查另一组信息。比方说 B 注册了 16 KiB，并分成四个连续的 4 KiB 槽，`slot3` 占用最后 4096 B。目的 QPN 让 ERNIC 找到连接。远端地址、rkey 和长度用来检查相应内存窗口与写权限。若把同一个写请求的起点再后移 64 B，尾部就越过窗口，网卡不能把它作为合法的 4 KiB 写入执行。QPN 指出包属于哪条连接，网卡还要核对 QP 与 MR 是否属于同一保护域，以及 MR 是否允许这次写入。<sup class="cite"><a href="#rd-ref-2">[2]</a></sup><sup class="cite"><a href="#rd-ref-6">[6]</a></sup>

RecoNIC 随库提供了 SEND/RECV、WRITE 和 READ 的双端示例。它自己的接收程序轮询 RQ 生产者索引，从预分配的槽取消息，用完再更新消费位置。在源码里，收到新消息的信号就是这个索引向前移动。前面动画里的接收完成项对应通用 libibverbs 接口。这版 ERNIC 的手册也明确列出不支持 Atomic，图 6 的取号例子要用具备该能力的 RNIC。<sup class="cite"><a href="#rd-ref-6">[6]</a></sup><sup class="cite"><a href="#rd-ref-8">[8]</a></sup>

## 四、NCCL 的一次发送为什么会用 WRITE

跨机 AllGather 完成后，B 的结果缓冲区里应当有一段来自 A 的张量。只看这块张量怎样从 A 传到 B。至于每次传输怎样安排，NCCL 可以交给网络后端。即使上层用的是成对的 `ncclSend` 和 `ncclRecv`，网卡也可以用 RDMA WRITE 把这块数据送到位。下面跟的是内置 IB 后端的一个具体分支。<sup class="cite"><a href="#rd-ref-11">[11]</a></sup><sup class="cite"><a href="#rd-ref-12">[12]</a></sup>

先动手的是 B。在这个版本的 `ncclIbIrecv()` 里，有一条很容易忽略的接收请求。它有 `wr_id`，但 `sg_list = NULL`、`num_sge = 0`。B 先把这个接收项投给相应 QP，留给写入通知使用。它没有指定任何用来放张量的缓冲区。真正的落点由接下来的 `ncclIbPostFifo()` 公布。B 把地址、容量和 rkey 写进 A 那边的 FIFO 槽，A 读到它们以后，才知道往哪里写。<sup class="cite"><a href="#rd-ref-12">[12]</a></sup><sup class="cite"><a href="#rd-ref-17">[17]</a></sup>

{% visual_svg rdma-four-operations/05-nccl-write-imm %}
图 8｜NCCL v2.26.5-1 内置 IB 后端。固定一条消息、一个 QP，开启自适应路由并保留默认阈值 8192 B。两种大小共用 B 发布缓冲区的步骤，区别从 A 提交数据 WR 时开始。图中省略传输层 ACK。<sup class="cite"><a href="#rd-ref-12">[12]</a></sup><sup class="cite"><a href="#rd-ref-17">[17]</a></sup>
{% endvisual_svg %}

在这个分支里，`ncclIbMultiSend()` 判断消息大小是否严格大于 `NCCL_IB_AR_THRESHOLD`。把开头的 4 KiB 和一条 16 KiB 消息代进去，数一数 A 要提交几条 WR。

| A 要发的数据 | A 在这一条 QP 上提交的工作 | B 从接收完成读回的大小 |
| --- | --- | --- |
| 4 KiB | 一条 WRITE_WITH_IMM，同时带 4096 B 张量数据和立即数 | 4096 B |
| 16 KiB | 一条普通 WRITE 搬 16384 B，再接一条零载荷 WRITE_WITH_IMM，串成链一次提交 | 16384 B |

恰好 8 KiB 也走第一行的路径。第二行末尾的写没有第二份张量数据，却照样能触发 B 的接收完成。B 的代码从 `wc->imm_data` 取回原消息的长度，所以即便最后那条写的载荷长度为零，B 仍能读出 16384。图 5 里两端约定把这个字段用作槽号，NCCL 在这里用它传长度。表里数的是 A 传张量的工作请求，前面 B 发布地址的那条控制 WRITE 两种情形都有。<sup class="cite"><a href="#rd-ref-12">[12]</a></sup><sup class="cite"><a href="#rd-ref-17">[17]</a></sup>

如果张量在 GPU 显存里，而且平台支持 GPUDirect RDMA，图 1 里指向主机 DRAM 的载荷箭头还可以改指向 GPU 显存。RNIC 可以直接走 PCIe 点对点访问这块内存。依赖这批数据的 GPU 内核何时可以启动，还要遵守 CUDA 和通信库的同步要求。<sup class="cite"><a href="#rd-ref-14">[14]</a></sup>

回到开头的 4 KiB。用 SEND，B 把可写地址留在自己的接收队列里。图 8 的方案则先把可写地址送到 A，所以 A 用一次带立即数的写就能把张量送到位。B 的网络后端收到了这一块的通知，接下来可以推进这笔传输。整个 AllGather 还要等其余分块满足依赖，而原来的槽什么时候能再次使用，取决于消费它的那一步是否已经结束。

## 资料与源码

1. <span id="rd-ref-1" class="ref-anchor"></span> NVIDIA，《[RDMA Aware Networks Programming User Manual](https://docs.nvidia.com/rdma-aware-networks-programming-user-manual-1-7.pdf)》，§3.1–3.3。RC 的通信操作、队列和工作请求。线上封装见 NVIDIA 的 [RoCE 模式说明](https://docs.nvidia.com/networking/display/mlnxenv23102131201lts/rdma-over-converged-ethernet-roce.pdf)。
2. <span id="rd-ref-2" class="ref-anchor"></span> rdma-core，[ibv_reg_mr(3)](https://man7.org/linux/man-pages/man3/ibv_reg_mr.3.html)。内存区域、访问权限、lkey 和 rkey。
3. <span id="rd-ref-3" class="ref-anchor"></span> rdma-core，[ibv_post_send(3)](https://man7.org/linux/man-pages/man3/ibv_post_send.3.html) 与 [ibv_wr_post(3)](https://man7.org/linux/man-pages/man3/ibv_wr_post.3.html)。工作请求字段、立即数、原子操作及返回值。
4. <span id="rd-ref-4" class="ref-anchor"></span> rdma-core，[ibv_post_recv(3)](https://man7.org/linux/man-pages/man3/ibv_post_recv.3.html) 与 [ibv_poll_cq(3)](https://man7.org/linux/man-pages/man3/ibv_poll_cq.3.html)。接收请求与成功完成项。
5. <span id="rd-ref-5" class="ref-anchor"></span> AMD/Xilinx，[RecoNIC 顶层收包分流](https://github.com/Xilinx/RecoNIC/blob/c8b784938777076805c428c73f90f92374004ed5/shell/top/reconic.sv#L455-L488) 与 [IP 生成配置](https://github.com/Xilinx/RecoNIC/blob/c8b784938777076805c428c73f90f92374004ed5/shell/plugs/rdma_onic_plugin/vivado_ip/rdma_core.tcl#L6-L16)。板级案例固定在提交 <code>c8b7849</code>。
6. <span id="rd-ref-6" class="ref-anchor"></span> AMD/Xilinx，[ERNIC v3.1 产品手册 PG332](https://docs.amd.com/api/khub/documents/nDGs8OYpH_RaOoMVNdbegA/content)，第 7–8、10–11、30–32、59–61 页。QP Manager、缓存的 WQE、MR 访问窗口及 RC QP 配置。
7. <span id="rd-ref-7" class="ref-anchor"></span> RecoNIC，[OpenNIC shell 与 ERNIC 内存接口的连接](https://github.com/Xilinx/RecoNIC/blob/c8b784938777076805c428c73f90f92374004ed5/patches/open-nic-shell/rdma_onic.patch#L1469-L1658) 及 [host_mem / dev_mem 示例](https://github.com/Xilinx/RecoNIC/blob/c8b784938777076805c428c73f90f92374004ed5/README.md#L220-L302)。
8. <span id="rd-ref-8" class="ref-anchor"></span> RecoNIC，[接收与消费指针实现](https://github.com/Xilinx/RecoNIC/blob/c8b784938777076805c428c73f90f92374004ed5/lib/rdma_api.c#L936-L989) 与 [send_recv 示例](https://github.com/Xilinx/RecoNIC/blob/c8b784938777076805c428c73f90f92374004ed5/examples/rdma_test/send_recv.c#L289-L325)。
9. <span id="rd-ref-9" class="ref-anchor"></span> Linux v6.12，[Soft-RoCE 请求端的 RC SEND 分包选择](https://github.com/torvalds/linux/blob/v6.12/drivers/infiniband/sw/rxe/rxe_req.c#L238-L258)。可对照 Only、First、Middle、Last 的条件。
10. <span id="rd-ref-10" class="ref-anchor"></span> NVIDIA，[Atomic Operations](https://networking-docs.nvidia.com/doca/archive/3-5-0/atomic-operations)。64 位操作与设备原子性范围。
11. <span id="rd-ref-11" class="ref-anchor"></span> NVIDIA NCCL，[Collective Operations](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html) 与 [Point-to-point Communication](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/p2p.html)。集合操作与进程间点对点接口。
12. <span id="rd-ref-12" class="ref-anchor"></span> NVIDIA NCCL v2.26.5-1，[公布接收缓冲区](https://github.com/NVIDIA/nccl/blob/3000e3c797b4b236221188c07aa09c1f3a0170d4/src/transport/net_ib.cc#L2111-L2153) 与 [构造 WRITE 及 WRITE_WITH_IMM](https://github.com/NVIDIA/nccl/blob/3000e3c797b4b236221188c07aa09c1f3a0170d4/src/transport/net_ib.cc#L1900-L2011)，固定提交 <code>3000e3c</code>。
13. <span id="rd-ref-13" class="ref-anchor"></span> rdma-core v53.0，[mlx5 provider 的发送门铃路径](https://github.com/linux-rdma/rdma-core/blob/v53.0/providers/mlx5/qp.c#L754-L792)。另见[本地记录发送请求标识](https://github.com/linux-rdma/rdma-core/blob/v53.0/providers/mlx5/qp.c#L1125-L1138)和[轮询时还原工作完成](https://github.com/linux-rdma/rdma-core/blob/v53.0/providers/mlx5/cq.c#L786-L806)。
14. <span id="rd-ref-14" class="ref-anchor"></span> NVIDIA，[GPUDirect RDMA 与内存顺序](https://docs.nvidia.com/cuda/gpudirect-rdma/index.html#synchronization-and-memory-ordering)。显存的 PCIe 点对点访问与 CUDA 同步。
15. <span id="rd-ref-15" class="ref-anchor"></span> Intel，[AN 855, PCI Express High Performance Reference Design](https://cdrdv2-public.intel.com/666287/an855-683504-666287.pdf)，读完成拆分示例。另见 AMD [PG055 的 MPS、MRRS 和 4 KiB 边界规则](https://docs.amd.com/r/en-US/pg055-axi-bridge-pcie/Max-Payload-Size-for-PCIe-Max-Read-Request-Size-or-4K-Page-Violated)。
16. <span id="rd-ref-16" class="ref-anchor"></span> Linux v6.12，[Soft-RoCE 的 RC 操作码与传输头布局](https://github.com/torvalds/linux/blob/v6.12/drivers/infiniband/sw/rxe/rxe_opcode.c#L185-L376)。WRITE 的 RETH 与立即数、READ 的请求和响应、Atomic ACK。
17. <span id="rd-ref-17" class="ref-anchor"></span> NVIDIA NCCL v2.26.5-1，[默认自适应路由阈值](https://github.com/NVIDIA/nccl/blob/3000e3c797b4b236221188c07aa09c1f3a0170d4/src/transport/net_ib.cc#L100-L105)、[先预投零 SGE 接收项再发布 FIFO](https://github.com/NVIDIA/nccl/blob/3000e3c797b4b236221188c07aa09c1f3a0170d4/src/transport/net_ib.cc#L2208-L2244)、[在完成时读回单条消息大小](https://github.com/NVIDIA/nccl/blob/3000e3c797b4b236221188c07aa09c1f3a0170d4/src/transport/net_ib.cc#L2387-L2396)。
