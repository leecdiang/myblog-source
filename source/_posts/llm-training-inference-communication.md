---
title: "大模型训练和推理中的通信"
date: 2026-11-25 13:00:00
lang: zh-CN
published: true
categories: Silicon & Circuits
tags:
  - 集合通信
  - 分布式训练
  - 大模型推理
  - GPU
  - RDMA
  - AI Infrastructure
etoc: true
toc:
  max_depth: 2
mathjax: true
description: "用张量在 GPU 之间的分布解释 AllReduce、AllGather、ReduceScatter 和 All-to-All，再对照 DDP、FSDP、张量并行、MoE 专家并行与分离式推理的消息大小和同步位置。"
---

{% note primary %}
四张 GPU 分别存着 1、5、9、13。做一次 AllGather，每张卡都会拿齐这四个数。
{% endnote %}

<!-- more -->

## 一、四张卡怎么交换数据

{% raw %}
<style>
#llm-collectives {
  --cl-line: var(--figure-line, #b8c4d2);
  --cl-tile: var(--figure-node, #f0f4f8);
  --cl-ink: var(--text-primary, var(--ink, #243549));
  --cl-muted: var(--text-muted, var(--muted, #526071));
  --cl-strong: var(--chart-blue, #376b9f);
  color: var(--cl-ink);
}
#llm-collectives :is(.llm-cl-ops, .llm-cl-tools) {
  display:flex; flex-wrap:wrap; align-items:center; gap:.4rem;
}
#llm-collectives .llm-cl-ops { margin-bottom:.6rem; }
#llm-collectives .llm-cl-tools { margin-top:.8rem; }
#llm-collectives button {
  border:1px solid var(--cl-line); border-radius:.4rem;
  padding:.25rem .58rem; min-height:36px; background:transparent;
  color:inherit; font:inherit; font-size:.84rem; cursor:pointer;
}
#llm-collectives button[aria-pressed="true"] {
  border-color:var(--cl-strong); box-shadow:inset 0 -2px var(--cl-strong); font-weight:700;
}
#llm-collectives button[aria-disabled="true"] { opacity:.43; cursor:default; }
#llm-collectives button:focus-visible { outline:2px solid var(--cl-strong); outline-offset:2px; }
#llm-collectives [data-collectives-step] {
  color:var(--cl-muted); font-size:.84rem; font-variant-numeric:tabular-nums;
}
#llm-collectives .llm-cl-board {
  display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); gap:clamp(.4rem, 2vw, 1.2rem);
  margin:.7rem 0 0;
}
#llm-collectives .llm-cl-board table {
  display:table; width:100%; min-width:0; max-width:100%; margin:0;
  table-layout:fixed; border-collapse:separate; border-spacing:clamp(1px, .35vw, 4px); border:0;
  background:transparent; font-variant-numeric:tabular-nums;
}
#llm-collectives caption {
  text-align:left; color:var(--cl-muted); font-size:.85rem;
}
#llm-collectives .llm-cl-board :is(th, td) {
  line-height:1; padding:.35rem .12rem; height:1.9rem; text-align:center;
  font-size:clamp(.73rem, 2.5vw, .95rem); white-space:nowrap;
}
#llm-collectives .llm-cl-board th {
  width:2ch; border:0; background:transparent; color:var(--cl-muted); font-weight:500;
}
#llm-collectives .llm-cl-board td {
  border:1px solid transparent; border-radius:.28rem; background:var(--cl-tile);
  color:var(--cl-ink);
}
#llm-collectives td[aria-label="待填入"] { color:var(--cl-muted); }
#llm-collectives td[data-collectives-focus] {
  border-color:var(--cl-strong); color:var(--cl-strong); font-weight:700;
  background:color-mix(in srgb, var(--cl-strong) 14%, var(--cl-tile));
  animation:llm-collectives-in .26s ease-out both;
}
#llm-collectives[data-collectives-mode="allgather"] table[data-collectives-input],
#llm-collectives[data-collectives-mode="reducescatter"] table[data-collectives-output] {
  width:48%;
}
#llm-collectives [data-collectives-status] {
  margin:.65rem 0 0; color:var(--cl-ink); font-size:.92rem; line-height:1.55; min-block-size:2.9em;
}
#llm-collectives figcaption { margin-top:.65rem; }
@keyframes llm-collectives-in {
  from { opacity:.48; transform:translateY(2px); }
  to { opacity:1; transform:translateY(0); }
}
@media (prefers-reduced-motion:reduce) {
  #llm-collectives td[data-collectives-focus] { animation:none; }
}
</style>
<figure id="llm-collectives" class="v-figure" data-collectives-mode="allgather" aria-label="四卡集合通信演示">
  <div data-collectives-controls hidden>
    <div class="llm-cl-ops" role="group" aria-label="选择通信操作">
      <button type="button" data-collectives-op="allgather" aria-pressed="true">AllGather</button>
      <button type="button" data-collectives-op="allreduce" aria-pressed="false">AllReduce</button>
      <button type="button" data-collectives-op="reducescatter" aria-pressed="false">ReduceScatter</button>
      <button type="button" data-collectives-op="alltoall" aria-pressed="false">All-to-All</button>
    </div>
    <div class="llm-cl-tools" role="group" aria-label="演示进度">
      <button type="button" data-collectives-action="prev" aria-disabled="true">上一步</button>
      <button type="button" data-collectives-action="next">下一步</button>
      <button type="button" data-collectives-action="play">播放</button>
      <span data-collectives-step aria-label="当前步骤">0 / 4</span>
    </div>
  </div>
  <p data-collectives-status role="status" aria-live="polite" aria-atomic="true">AllGather 把四个输入按 rank 排好，每张卡都得到 1、5、9、13。</p>
  <div class="llm-cl-board">
    <table data-collectives-input>
      <caption>各卡输入</caption>
      <tbody>
        <tr><th scope="row" aria-label="rank 0">r0</th><td>1</td></tr>
        <tr><th scope="row" aria-label="rank 1">r1</th><td>5</td></tr>
        <tr><th scope="row" aria-label="rank 2">r2</th><td>9</td></tr>
        <tr><th scope="row" aria-label="rank 3">r3</th><td>13</td></tr>
      </tbody>
    </table>
    <table data-collectives-output>
      <caption>各卡输出</caption>
      <tbody>
        <tr><th scope="row" aria-label="rank 0">r0</th><td>1</td><td>5</td><td>9</td><td>13</td></tr>
        <tr><th scope="row" aria-label="rank 1">r1</th><td>1</td><td>5</td><td>9</td><td>13</td></tr>
        <tr><th scope="row" aria-label="rank 2">r2</th><td>1</td><td>5</td><td>9</td><td>13</td></tr>
        <tr><th scope="row" aria-label="rank 3">r3</th><td>1</td><td>5</td><td>9</td><td>13</td></tr>
      </tbody>
    </table>
  </div>
  <figcaption class="v-caption">高亮格子表示当前步骤的输入和输出。演示按位置展开数据关系，通信库的传输轮次由算法决定。</figcaption>
</figure>
<script src="/js/llm-collectives.js" defer></script>
{% endraw %}

{% raw %}
<details class="collective-static-reference">
<summary>查看四种操作的结果</summary>
{% endraw %}

{% visual_svg llm-communication/01-collective-layouts %}
图 1｜四种操作的输入和最终结果。每行对应一个 rank。
{% endvisual_svg %}

{% raw %}
</details>
{% endraw %}

| 操作 | 一个 rank 提供什么 | 操作结束后拿到什么 |
| --- | --- | --- |
| AllReduce | 同形状张量的一份局部结果 | 各 rank 逐元素归约后的完整张量 |
| ReduceScatter | 同形状张量的一份局部结果 | 完整归约结果中分给自己的那一片 |
| AllGather | 属于自己的分片 | 按 rank 顺序拼起来的完整张量 |
| All-to-All | 为每个目的 rank 准备的数据 | 各来源 rank 专门发给自己的数据 |
| Broadcast | 根 rank 提供完整数据 | 根 rank 的一份副本 |
| Send/Recv | 发送方提供一条消息 | 指定接收方拿到这条消息 |

ReduceScatter 做完后，每张卡只保留一段求和结果。接着做 AllGather，每张卡便能恢复完整结果，布局和 AllReduce 一样。浮点数若换了加法顺序，末位可能不同。<sup class="cite"><a href="#ref-1">[1]</a></sup>

### 每张卡搬多少字节

拿一组 16 GB 的权重做 AllGather。均分给四张卡，每张已有 4 GB，还要收 12 GB。改用八张卡，每张要收 14 GB。把每张卡的接收量加起来，四卡共 48 GB，八卡共 112 GB。

推广到 $p$ 张卡，若拼好的张量共 $S$ 字节，均匀切成 $p$ 片，每张卡手里先有 $S/p$，还要收 $(p-1)S/p$。把整组收到的字节加起来，就是 $(p-1)S$。若改成每张卡固定带入 1 GB，四卡时每张收 3 GB，八卡时每张收 7 GB，因为拼好的张量也跟着变大。<sup class="cite"><a href="#ref-2">[2]</a></sup>

### Ring AllReduce 的耗时

设 $p$ 张卡在均匀链路上做 ring AllReduce，归约前每张卡各有 $S$ 字节。ReduceScatter 走 $p-1$ 轮，AllGather 再走 $p-1$ 轮。每轮每张卡向下游发 $S/p$ 字节，也从上游收同样多，单卡发送量合计 $2(p-1)S/p$。设一轮的启动时间为 $\alpha$，单向传输速率为 $B$，暂且省去归约计算、链路争用和协议开销。

{% raw %}<div>$$
t_{\mathrm{ring}}(S)\approx 2(p-1)\alpha + \frac{2(p-1)}{p}\frac{S}{B}.
$$</div>{% endraw %}

{% visual_svg llm-communication/02-ring-cost %}
图 2｜八 rank ring AllReduce 的时延模型。取每轮启动 2 µs、单向 50 GB/s，两项在 800 kB 处相等。横纵轴均为对数，曲线按公式计算。
{% endvisual_svg %}

把 8 KiB 切成八片，每轮只发 1 KiB。按图 2 的参数，14 轮的传输加起来约 0.29 µs，启动项是 28 µs。几条小消息若能等到一起发，可以合成一条。数据并行可以攒够一桶梯度再交给通信库。张量并行的后一层还得读前一层的结果，跨层的归约很难攒在一起发。实际通信库也会随消息大小和拓扑换算法。

## 二、训练中的通信

### DDP 与 FSDP 交换的是梯度还是参数

两张卡各存一份模型，分别拿不同样本做前向和反向，这就是分布式数据并行（Distributed Data Parallel，DDP）。如果两边算出的本地平均梯度分别是 `[2, 4]` 和 `[6, 8]`，归约后各自除以二，两张卡就能用同一份 `[4, 6]` 更新模型。这个平均给每张卡相同的权重。若各卡的有效 token 数不等，想求所有 token 的平均梯度，就要把各卡的 token 数算进损失归一化。<sup class="cite"><a href="#ref-3">[3]</a></sup>

沿着 Transformer 从输出端往回算，末几层的梯度会早一些出来。PyTorch DDP 把梯度分桶，一桶的梯度凑齐了就开始归约，其余层接着做反向。反向计算都结束后，若最后一桶还在归约，优化器就得等它收尾。这一段通信落在反向和参数更新之间，没法用反向计算的时间盖过去。

完全分片数据并行（Fully Sharded Data Parallel，FSDP）也让各 rank 处理不同样本。PyTorch FSDP2 把参数、梯度和优化器状态按 rank 分片存放。算到一个模块时，先用 AllGather 拼齐它的参数组。前向用完，若把完整参数释放掉，到了反向还得再拼一次。梯度算完后做 ReduceScatter，每张卡收到自己负责更新的那段归约结果。<sup class="cite"><a href="#ref-4">[4]</a></sup>

{% visual_svg llm-communication/03-training-schedule %}
图 3｜DDP 的梯度桶与 FSDP2 的单个参数组。下图在前向后释放完整参数，反向前需要重新收集。条带只表示操作的依赖关系。
{% endvisual_svg %}

以 80 亿参数的模型为例，参数收集和梯度归约都用每元素 2 B，总量各为 16 GB（十进制）。在八卡 ring 上，把各参数组的传输加起来，做完一遍参数 AllGather 或一遍梯度 ReduceScatter，每张卡都要发 $7/8\times16=14$ GB。这里按每步一次前向、一次反向算，各参数组采用相同的策略，略去初始化与辅助消息。

DDP 把各桶的 AllReduce 加起来是 28 GB/卡。FSDP2 若在两段计算之间保留完整参数，一次 AllGather 加一次 ReduceScatter，也是 28 GB/卡。前向后若重新分片，反向前得再做一轮 AllGather，发送量就到了 42 GB/卡。多花的 14 GB 对应那一轮参数收集，省下的是两次计算之间存放完整参数所用的显存。要比单步耗时，还得看各次参数收集或梯度归约能和多少计算重叠。

### 张量并行在一层里面交换部分和

把一个多层感知机（Multilayer Perceptron，MLP）分给两张卡，先切中间特征。设输入 $X$ 有 $T$ 行 token、$H$ 列隐藏特征，上投影把宽度扩到 $F$，下投影再收回 $H$。把上投影 $W_1$ 沿输出列分成两半，下投影 $W_2$ 沿对应的输入行分成两半。每张卡读同一份 $X$，各自算自己那半边中间特征。到了下投影，两张卡算出来的都是 $T\times H$ 的矩阵，其中每个位置各贡献一部分。把这两份部分和相加，就拿到了输出 $Y$。下式省略偏置，$\phi$ 是逐元素激活函数。<sup class="cite"><a href="#ref-5">[5]</a></sup>

{% raw %}<div>$$
Y=\sum_{r=0}^{1}U_r,\qquad
U_r=\phi(XW_{1,r})W_{2,r},\qquad
U_r\in\mathbb{R}^{T\times H}.
$$</div>{% endraw %}

{% visual_svg llm-communication/04-tp-mlp %}
图 4｜两路张量并行的 MLP。<em>W</em><sub>1</sub> 按列切，<em>W</em><sub>2</sub> 沿同一组特征按行切，两路输出在下投影之后做 AllReduce。
{% endvisual_svg %}

经典 Megatron 张量并行（Tensor Parallelism，TP）里，attention 的输出投影也这么算。加上 MLP，每个 Transformer block 前向归约两次。训练时还要给两个列并行入口分别归约输入梯度，反向也是两次。若用了序列并行（Sequence Parallelism），行并行的出口可以用 ReduceScatter，把归约后的 token 行分给各卡。等下一处列并行要用完整序列了，再做 AllGather。<sup class="cite"><a href="#ref-5">[5]</a></sup> <sup class="cite"><a href="#ref-6">[6]</a></sup>

### 流水线并行在阶段边界传激活

把第 1 到第 16 层放在一个阶段，第 17 层起交给下一个阶段，两段之间就有了一条流水线边界。前向做完一个微批，第 16 层的激活用 Send/Recv 交给后一个阶段。训练反向沿原路送回对应的激活梯度。这个切法叫流水线并行（Pipeline Parallelism，PP）。阶段内部若用了 TP，归约仍由阶段内的 TP 组完成。<sup class="cite"><a href="#ref-7">[7]</a></sup>

### MoE 专家并行按 token 的去向发消息

给一批 token 选完专家，路由器就有了一张去向表。混合专家模型（Mixture of Experts，MoE）采用专家并行（Expert Parallelism，EP）时，专家分布在不同 rank 上。采用 All-to-All 的实现先在来源 rank 按目的地打包向量，再发给各专家。这一程叫 dispatch。专家算完，结果循原路送回，来源 rank 恢复 token 的顺序。如果一个 token 选了多个专家，就按路由权重把对应的几份输出加起来。返回并合并的过程叫 combine，训练反向的梯度也沿相应的路径交换。<sup class="cite"><a href="#ref-8">[8]</a></sup>

{% visual_svg llm-communication/05-moe-traffic %}
图 5｜四个 rank 的 top-1 路由。行是来源，列是专家所在的 rank，每格计路由条数。落在对角线上的 token 留在本卡。
{% endvisual_svg %}

两批都跨卡发了 12 份，右图有 9 份发往 rank 0。这张卡加上本地那一份，要替专家处理 10 条路由。每列加起来就是该 rank 的专家要处理的条数，跨卡流量只算对角线以外的格子。Top-$k$ 路由会为 $T$ 个 token 产生 $kT$ 个 token–expert 分配。若同一个 token 选中的几个专家落在同一目的地，传输实现可以复用同一份输入向量，跨节点流量还取决于专家的位置和打包方式。<sup class="cite"><a href="#ref-8">[8]</a></sup>

## 三、推理要传什么

### 完整副本分请求，TP 副本在层内归约

部署了几份独立的稠密模型时，请求分给哪个副本，它的前向和 KV Cache 就归哪个副本。副本里若有几张卡做 TP，层内归约在这几张卡之间进行。有些 MoE 服务把 attention 留在各自的副本里，却共用一组专家。各 rank 到了专家层仍要交换路由到其他 rank 的 token。<sup class="cite"><a href="#ref-9">[9]</a></sup>

拿一个 32 层模型算，隐藏宽度 $H=4096$，激活用 BF16（每元素 2 B），沿用前面每层两次 AllReduce 的切法。提示有 2048 个 token，prefill 一次做完时，每次归约的输入有 2048 行，共 16 MiB。decode 若在同一步里推进 16 条序列，每条只添一个位置，归约的输入就缩到 16 行，也就是 128 KiB。两次前向都走过 32 层，算下来各有 64 次层内归约。这里按每 rank 交给归约的张量大小计，算链路字节还要指定通信算法和拓扑。<sup class="cite"><a href="#ref-5">[5]</a></sup>

{% visual_svg llm-communication/06-tp-inference %}
图 6｜横轴是单次层内 AllReduce 在一个 rank 上的输入大小，采用对数刻度。归约计数只含 attention 和 MLP。
{% endvisual_svg %}

Attention 会读历史 KV，但给输出投影的只有这一轮新算的 16 行。这 16 行才是接下来归约的数据。把两个点放回图 2 的模型，128 KiB 那笔开销主要来自启动，16 MiB 那笔主要来自传输。每轮 decode 都要重新走这 64 次归约，当前 token 选出来，下一轮的输入才确定。<sup class="cite"><a href="#ref-5">[5]</a></sup> <sup class="cite"><a href="#ref-10">[10]</a></sup>

### Prefill 与 Decode 分离时，转移的是 KV

若 prefill 和 decode 各用一组设备，读完提示词之后还有一次交接。Prefill worker 得把已经算好的 K、V 交给接手这条请求的 decode worker。DistServe 按对应层传送缓存，遇到带宽受限的部署，还可以让负责同一批层的两个 worker 留在一台机器上。若两边的并行布局不同，也可能要把一个源分片拆给几个目的 rank。<sup class="cite"><a href="#ref-10">[10]</a></sup>

以 32 层、8 个 KV 头、头维度 128 的分组查询注意力（Grouped-Query Attention，GQA）模型为例，KV 用 BF16 存储。令 $L$ 是层数、$h_{\mathrm{KV}}$ 是 KV 头数、$d_h$ 是头维度、$b$ 是每个元素的字节数。每个提示 token 对应的总逻辑缓存量如下。

{% raw %}<div>$$
S_{\mathrm{KV/token}}=2Lh_{\mathrm{KV}}d_hb
=2\times32\times8\times128\times2\ \mathrm{B}
=128\ \mathrm{KiB}.
$$</div>{% endraw %}

{% visual_svg llm-communication/07-kv-transfer %}
图 7｜KV 交接的理论序列化下限。每个提示 token 对应 128 KiB，总量经过一条等效链路。横轴以 1024 个 token 为一单位，链路速率使用十进制 Gb/s。每条曲线只计算有效载荷上链所需的时间。
{% endvisual_svg %}

8192 个提示 token 累积起来就是 1 GiB。这 1 GiB 若全过一条 400 Gb/s 的链路，光把字节送上链就要至少 21.47 ms。用两条链路时，要由最后传完的那份来算时间。只有两条链路能并行满速跑、数据又按速率分得开，才够得上按合计带宽算的下限。这里还要留出数据准备和接收端等待的时间。

交接的等待算在哪段，要看首 token 由谁发给客户端。若 prefill 端先把它发出去，交接中尚未完成的部分就落在首、次 token 之间。若由 decode 端开始返回结果，这部分等待会落在首 token 延迟里。后续 KV 直接由 decode 端追加。<sup class="cite"><a href="#ref-10">[10]</a></sup> <sup class="cite"><a href="#ref-14">[14]</a></sup>

## 四、从 collective 到网卡

DeepSeek-V3 的技术报告里，同一套 MoE dispatch 和 combine，在 prefill 和 decode 用了不同的走法。Prefill 先走 InfiniBand 跨节点，再用 NVLink 在节点内转发。Decode 为了降低延迟，跨节点时用 InfiniBand 点对点直传，通过 IBGDA（InfiniBand GPUDirect Async）提交操作。<sup class="cite"><a href="#ref-11">[11]</a></sup>

框架里的 `Send` 指把一条消息交给目标 rank。RDMA verbs 里的 `SEND` 则是网卡执行的一种操作。以可靠连接为例，发 `SEND` 之前，收方得在接收队列上备好缓冲区。用普通 `RDMA_WRITE` 时，发方按远端虚拟地址和 rkey 写进获准访问的内存。框架调用 Send/Recv 后，具体选哪种操作，由传输后端决定。有 GPUDirect RDMA 时，支持它的网卡可以直接读写 GPU 显存。由 CPU 还是 GPU 提交工作请求，则由后端的控制路径决定。<sup class="cite"><a href="#ref-12">[12]</a></sup> <sup class="cite"><a href="#ref-13">[13]</a></sup>

| 场景 | 交换的数据 | 典型操作 | 等到什么时候才能继续 |
| --- | --- | --- | --- |
| DDP 训练 | 本地样本产生的梯度 | AllReduce | 归约结果到齐后更新参数 |
| FSDP2 训练 | 参数组分片、各自计算的梯度 | 参数 AllGather，梯度 ReduceScatter | 参数齐了才算该组，梯度分片齐了才更新 |
| 经典 TP 训练或推理 | 激活的部分和、训练时的输入梯度部分和 | AllReduce | 同层的后继算子等待对应结果 |
| PP | 微批的边界激活或激活梯度 | Send/Recv | 相邻阶段等到该微批的输入 |
| MoE 专家并行 | 路由后的 token 向量与专家输出 | 两次按目的地交换 | 专家等输入，来源 rank 等自己的输出 |
| 独立稠密推理副本 | 请求交给某个副本 | 请求分发 | 请求等待选中的副本排程 |
| Prefill/Decode 分离 | 一条请求的提示 KV | 点对点或分片重分布 | Decode worker 等它需要的缓存 |

相关博文包括[智算互联（上）：训练吞吐与通信瓶颈](/2026/06/28/ai-compute-interconnect-part1-communication-wall/)、[大模型推理的执行机制与性能约束](/2026/11/08/llm-inference-from-token-to-cluster/)和[智算互联（下）：高性能网卡的芯片架构](/2026/06/28/ai-compute-interconnect-part3-smart-nic-chip/)。

## 参考资料

1. <span id="ref-1" class="ref-anchor"></span> NVIDIA. [NCCL Collective Operations](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html). 集合操作的输入输出语义。
2. <span id="ref-2" class="ref-anchor"></span> NVIDIA. [NCCL Tests Performance](https://github.com/NVIDIA/nccl-tests/blob/master/doc/PERFORMANCE.md). 集合操作的流量系数与带宽口径。
3. <span id="ref-3" class="ref-anchor"></span> PyTorch. [DistributedDataParallel Design Note](https://docs.pytorch.org/docs/stable/notes/ddp.html). 梯度分桶、归约与优化器顺序。
4. <span id="ref-4" class="ref-anchor"></span> PyTorch. [FSDP2 fully_shard](https://docs.pytorch.org/docs/stable/distributed.fsdp.fully_shard.html). 参数组、重分片与梯度归约。
5. <span id="ref-5" class="ref-anchor"></span> Shoeybi et al., 2019. [Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism](https://arxiv.org/abs/1909.08053). §3，MLP 与 attention 的张量并行。
6. <span id="ref-6" class="ref-anchor"></span> Korthikanti et al., MLSys 2023. [Reducing Activation Recomputation in Large Transformer Models](https://arxiv.org/abs/2205.05198). 序列并行与激活布局。
7. <span id="ref-7" class="ref-anchor"></span> Narayanan et al., SC 2021. [Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM](https://arxiv.org/abs/2104.04473). 流水线阶段及微批调度。
8. <span id="ref-8" class="ref-anchor"></span> NVIDIA. [Megatron Core MoE Token Dispatcher](https://docs.nvidia.com/megatron-core/developer-guide/0.15.0/apidocs/core/core.transformer.moe.token_dispatcher.html). 专家并行的 dispatch、combine 与局部重排。
9. <span id="ref-9" class="ref-anchor"></span> vLLM. [Data Parallel Deployment](https://docs.vllm.ai/en/stable/serving/data_parallel_deployment/). 独立推理副本与跨副本的专家层。
10. <span id="ref-10" class="ref-anchor"></span> Zhong et al., OSDI 2024. [DistServe: Disaggregating Prefill and Decoding for Goodput-optimized Large Language Model Serving](https://www.usenix.org/conference/osdi24/presentation/zhong-yinmin). Prefill/Decode 解耦、KV 交接及放置策略。
11. <span id="ref-11" class="ref-anchor"></span> DeepSeek-AI, 2024. [DeepSeek-V3 Technical Report](https://arxiv.org/html/2412.19437#S3.SS4). §3.4，推理两阶段的 MoE 通信路径。
12. <span id="ref-12" class="ref-anchor"></span> NVIDIA. [GPUDirect RDMA](https://docs.nvidia.com/cuda/gpudirect-rdma/). 第三方 PCIe 设备访问 GPU 显存的数据路径。
13. <span id="ref-13" class="ref-anchor"></span> NVIDIA. [RDMA Aware Networks Programming User Manual](https://docs.nvidia.com/rdma-aware-networks-programming-user-manual-1-7.pdf#page=20). §3.1，Send 和 RDMA Write 的接收缓冲区与地址约定。
14. <span id="ref-14" class="ref-anchor"></span> vLLM. [Disaggregated Prefilling](https://docs.vllm.ai/en/latest/features/disagg_prefill/#generate-api-output-modes). 分离式推理的输出模式与 KV 交接。
