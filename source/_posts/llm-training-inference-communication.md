---
title: "大模型训练和推理中的通信"
date: 2026-11-25 13:00:00
updated: 2026-11-25 17:01:00
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
description: "两张 GPU 各算一批样本，怎么用梯度更新同一个模型？用同一组梯度对照 DDP 和 FSDP，再看张量并行和 MoE 分别要传什么，以及生成一个 token 要等哪些通信。"
---

{% note primary %}
四张 GPU 分别存着 1、5、9、13。做一次 AllGather，每张卡都会拿齐这四个数。
{% endnote %}

<!-- more -->

## 一、四张卡怎么交换数据

如果这四个数是一层权重的四块，每张卡都得拿齐，才能算这一层。如果它们是同一个参数在四批样本上算出的梯度，就要把它们加起来。图中每行是一张卡，r0 到 r3 对应四个通信进程的组内编号（rank）。

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
  <figcaption class="v-caption">高亮格子表示当前步骤的输入和输出。每一步显示一组数的去向。实际传几轮取决于通信库所用的算法。</figcaption>
</figure>
<script src="/js/llm-collectives.js" defer></script>
{% endraw %}

{% raw %}
<details class="collective-static-reference">
<summary>查看四种操作的结果</summary>
{% endraw %}

{% visual_svg llm-communication/01-collective-layouts %}
图 1｜四种操作的输入和结果。每行对应一张卡，两种归约均按列求和。
{% endvisual_svg %}

{% raw %}
</details>
{% endraw %}

切到 AllReduce，点一次「下一步」。第一列的四个数相加得到 28，四张卡都拿到 28。把各卡同一位置的数合成一个结果叫作**归约**，这个例子用的是加法。<sup class="cite"><a href="#ref-1">[1]</a></sup>

ReduceScatter 也按列求和，区别在于谁拿结果。第一列的和 28 归 0 号卡，第二列的和 32 归 1 号卡，余下两张卡各得 36 和 40。如果此时再做一次 AllGather，四张卡就都有了完整的 `[28, 32, 36, 40]`。这和一次 AllReduce 求的是同一组和。实际使用浮点数时，加法顺序可能影响结果的末位。<sup class="cite"><a href="#ref-1">[1]</a></sup>

All-to-All 里的列有另一层意思。第一列是各卡准备发给 0 号卡的数，第二列都发给 1 号卡。0 号卡最后收到一整列，四个数原样保留。后面 MoE 要把 token 送往各自的专家，就用到了这种交换。

<div id="二、训练中的通信" aria-hidden="true"></div>

## 二、各读一批样本，怎么更新同一个模型

<div id="DDP-与-FSDP-交换的是梯度还是参数" aria-hidden="true"></div>

### DDP 和 FSDP 各自更新哪些参数

假设模型只有两个待更新的参数。两张卡起初拿着相同的参数，各读一批样本。反向传播结束后，0 号卡算出的平均梯度是 `[2, 4]`，1 号卡是 `[6, 8]`。要是各自拿这个梯度更新，两份模型走一步就不同了。

分布式数据并行（DDP）在初始化时可以用 Broadcast，让 0 号卡把同一份参数发给大家。训练时，两张卡用 AllReduce 把梯度逐项相加。如果两批样本含有同样多的有效 token，求和再除以二，两边就能用同一个平均梯度 `[4, 6]` 更新模型。若损失按 token 求平均，而两批的有效 token 数却不同，就要按各批的有效 token 数加权。<sup class="cite"><a href="#ref-3">[3]</a></sup>

换一种存法。0 号卡平时只保管第一个参数，1 号卡只保管第二个，两份样本照旧各算各的。算到需要这两个参数的层时，每张卡都缺对方手里那一份，于是先用 AllGather 拼齐权重。更新时用 ReduceScatter。0 号卡领到第一项的和 $2+6=8$，1 号卡领到第二项的和 $4+8=12$。各自除以二，0 号卡用 4 更新第一个参数，1 号卡用 6 更新第二个。

这就是完全分片数据并行（FSDP）的做法。PyTorch FSDP2 可以把一层或几层的参数编成一组，算到哪组，就收集哪组的权重。梯度和优化器状态也按参数分片。前向算完释放这组完整权重，可以腾出显存，代价是反向算到它时还要再收集一次。<sup class="cite"><a href="#ref-4">[4]</a></sup>

图 2 把两种训练方式放在了一起。DDP 会把多个参数的梯度凑成一桶，按各卡约定的桶顺序发起 AllReduce。靠近输出端的梯度先算出来，所以传第一桶时，GPU 还可以继续计算靠近输入端的梯度。等反向计算结束，最后一桶如果还没传完，优化器就得等它。<sup class="cite"><a href="#ref-3">[3]</a></sup>

{% visual_svg llm-communication/03-training-schedule %}
图 2｜上半部画 DDP 的三个梯度桶，下半部跟踪 FSDP2 的一个参数组。两次 AllGather 分别发生在前向和反向之前，中间一段可以释放完整权重。条带长度为示意。
{% endvisual_svg %}

<div id="每张卡搬多少字节" aria-hidden="true"></div>

### 八张卡，每步要发多少数据

取一个 80 亿参数的模型，通信时每个参数和每个梯度元素都占 2 字节，权重和梯度各有 16 GB。把权重均分到四张卡，做一次完整的参数收集时，每张已有 4 GB，还要收 12 GB。换成八张卡，每张已有 2 GB，要收 14 GB。

把各卡收到的字节加起来，四卡共收 48 GB，八卡共收 112 GB。若模型大小固定为 $S$，均分到 $p$ 张卡，每张接收 $(p-1)S/p$，全组共接收 $(p-1)S$。若固定的是每张卡带来的分片大小，比如一律 1 GB，那么四卡时每张收 3 GB，八卡时每张就要收 7 GB。<sup class="cite"><a href="#ref-2">[2]</a></sup>

在均匀的八卡环上，每张卡把分片传给下一张，同时从上一张接收，发送量和接收量相等。一遍参数 AllGather 每张卡发 14 GB。等大的梯度做一遍 ReduceScatter，每张也发 14 GB。下表按一步做一次前向、一次反向来算，各参数组采用相同的策略。<sup class="cite"><a href="#ref-2">[2]</a></sup><sup class="cite"><a href="#ref-4">[4]</a></sup>

| 训练方式 | 一步里要传什么 | 单卡每步发送量 |
| --- | --- | ---: |
| DDP | 每桶梯度各做一次 AllReduce | 28 GB |
| FSDP2，前向后保留完整权重 | 收集一次权重，归约并分发一次梯度 | 28 GB |
| FSDP2，前向后释放完整权重 | 前向、反向各收集一次权重，再归约并分发梯度 | 42 GB |

表中只计发送，单位用十进制 GB。FSDP2 多发这 14 GB，就可以在前向结束后释放完整权重。至于每步要多等多久，还要看其中多少通信能和别的层的计算同时进行。

## 三、模型还能怎么分

<div id="张量并行在一层里面交换部分和" aria-hidden="true"></div>

### 张量并行为什么要把输出相加

FSDP 临时凑齐一层的权重，每张卡算自己的样本。张量并行（TP）可以让两张卡同时算**同一层里的同一个 token**。以 Transformer 里的前馈网络（MLP）为例，输入先经过一次矩阵乘法扩展到较宽的中间层，经过激活函数，再由第二次矩阵乘法投回原来的宽度。

假设中间层只有四个特征。0 号卡算前两个，1 号卡算后两个。要算最终输出的第一个数，第二次矩阵乘法需要把四个特征各乘一个权重，再把四项加起来。0 号卡能算前两项之和，1 号卡能算后两项之和。把两个部分和相加，才得到第一个输出。其余位置也一样。后续算子在两张卡上都要读完整输出，于是用 AllReduce 把两边的结果逐项加起来。<sup class="cite"><a href="#ref-5">[5]</a></sup>

{% visual_svg llm-communication/04-tp-mlp %}
图 3｜沿任意一张卡的分支读。第一块权重按列切，中间特征减半。第二块权重沿相同的特征按行切，所得部分和已经具有完整输出的形状。两条分支的结果在右侧相加。
{% endvisual_svg %}

写成矩阵，输入 $X$ 有 $T$ 行 token、$H$ 列特征。图中 $W_1$ 是第一块权重，$W_2$ 是第二块，$\phi$ 是逐元素激活函数。下标 $r$ 表示第几张卡，省去偏置后有

{% raw %}<div>$$
U_r=\phi(XW_{1,r})W_{2,r},\qquad
U_r\in\mathbb{R}^{T\times H},\qquad Y=U_0+U_1.
$$</div>{% endraw %}

经典 Megatron 的 attention 输出投影也会产生这样的部分和。一个 Transformer 层里，attention 和 MLP 在前向各做一次 AllReduce。训练反向时，attention 和 MLP 还各有一次输入梯度归约。如果同时启用序列并行，可以把归约后的 token 行分给各卡，用 ReduceScatter 收尾。下一处需要完整序列的列并行算子再做 AllGather。<sup class="cite"><a href="#ref-5">[5]</a></sup><sup class="cite"><a href="#ref-6">[6]</a></sup>

<div id="流水线并行在阶段边界传激活" aria-hidden="true"></div>

### 流水线并行只把中间结果交给下一段

流水线并行（PP）把连续的几层交给同一个阶段。假设前 16 层在第一张卡，第 17 层起在第二张。先把一批样本拆成几小份（微批）。第一张卡算完一份，就把第 16 层的输出发给第二张卡，后者接着算第 17 层。边界上的两张卡用一对 Send/Recv 交接这份激活，反向时沿原路送回它的梯度。一个阶段内部仍可以用多张卡做 TP。<sup class="cite"><a href="#ref-7">[7]</a></sup>

<div id="MoE-专家并行按-token-的去向发消息" aria-hidden="true"></div>

### MoE 怎么把一个 token 送到它的专家

混合专家模型（MoE）的一层里有多个专家网络。假设 0 号卡上的一个 token 选中了 2 号卡上的专家。0 号卡要把这个 token 的隐藏向量（这一层的输入）送过去，2 号卡算完后再把专家的输出送回。若选中了两个专家，来源卡就按路由器给的权重合并两份输出。

把一批 token 放在一起，各卡先按目的地打包向量，一起发出，这一程叫 dispatch。专家计算完成后，各卡把结果送回来源卡，恢复 token 顺序并合并输出，这一程叫 combine。这就是专家并行（EP）里常见的两次 All-to-All 交换。演示里每张卡给每个目的地各送一格，MoE 的路由器选出来的数量可以不等。通信实现可以为每个目的地指定不同的发送长度。训练反向时，梯度也沿对应的路由交换。<sup class="cite"><a href="#ref-8">[8]</a></sup><sup class="cite"><a href="#ref-15">[15]</a></sup>

{% visual_svg llm-communication/05-moe-traffic %}
图 4｜每个 token 只选一个专家。每行是一张来源卡，每列是一张专家卡，格子里的数是分给它的 token 个数。对角线上的 token 就地计算。
{% endvisual_svg %}

图 4 两边都只有 12 个 token 跨卡，差别藏在第一列。左图每张卡收 3 个远端 token。右图的 0 号卡独自收了 9 个，加上本地 1 个，一共要处理 10 个，其他三张卡各处理 2 个。即使总流量相同，等待这批输出的时间也会受最忙那张卡影响。推广到每个 token 选 $k$ 个专家，$T$ 个 token 共有 $kT$ 次分配。同一个 token 选中的几个专家若在同一目的节点，还可以共用一次跨节点传输。在一些 MoE 推理部署里，各副本独立计算 attention，却共用一组专家。到了专家层，这些副本之间也要传 token。<sup class="cite"><a href="#ref-8">[8]</a></sup><sup class="cite"><a href="#ref-9">[9]</a></sup><sup class="cite"><a href="#ref-11">[11]</a></sup>

<div id="三、推理要传什么" aria-hidden="true"></div>

## 四、跟一条推理请求走一遍

<div id="完整副本分请求，TP-副本在层内归约" aria-hidden="true"></div>

### 读提示词和逐个生成 token，哪一笔通信变小了

一条请求先由调度器交给一个模型副本。如果几张 GPU 各自运行一份完整的稠密模型，它们可以各接各的请求，生成一个 token 用到的层间结果和历史缓存都留在本卡。如果一个副本用了多张卡做 TP，同一条请求每经过一层，就会遇到图 3 的部分和。<sup class="cite"><a href="#ref-5">[5]</a></sup><sup class="cite"><a href="#ref-9">[9]</a></sup>

假设这个 TP 副本有 32 层，隐藏宽度 4096，激活使用 BF16。每个 token 的一行数据占 $4096\times2$ 字节，也就是 8 KiB。先读一条 2048 个 token 的提示，整段一次算完，叫作预填充（prefill）。每个 rank 交给一次 AllReduce 的输入就是 $2048\times8$ KiB，合 16 MiB。

生成阶段（decode）里，一条序列每步只算一个新位置。假设这一轮同时推进 16 条序列，一次归约便只有 16 行，合 128 KiB。Attention 仍要读各序列的历史 KV 缓存，但输出投影只为本步新算的 16 个位置产生部分和。两次前向都要经过相同的 32 层，各做 $32\times2=64$ 次归约。<sup class="cite"><a href="#ref-5">[5]</a></sup>

{% visual_svg llm-communication/06-tp-inference %}
图 5｜每次 AllReduce 的单卡输入相差 128 倍，两次前向的层内归约次数都为 64。横轴是输入张量的大小。要换算链路上发送的字节数，还需指定通信算法。
{% endvisual_svg %}

<div id="Ring-AllReduce-的耗时" aria-hidden="true"></div>

### 128 KiB 的归约要等多久

用八卡 ring AllReduce 估一次。先用 ReduceScatter 让各卡拿到各自负责的和，再用 AllGather 让每张卡拿到全部结果。每个阶段都绕环传 7 轮。每轮都有启动开销，即使消息很短，这 14 轮也要走完。

{% visual_svg llm-communication/02-ring-cost %}
图 6｜八卡环，每轮启动 2 µs、单向带宽 50 GB/s。单卡输入达到 800 kB（十进制）时，启动和传输各占 28 µs。两轴均为对数刻度，曲线由上式计算。
{% endvisual_svg %}

代入图 5 的两个数。128 KiB 的输入花在传输上的时间约为 4.6 µs，14 轮启动却要 28 µs。输入增到 16 MiB，启动仍是 28 µs，传输耗时增至约 587 µs。DDP 可以把多个梯度攒成一桶，少付几次启动开销。TP 做 decode 时，下一层要读上一层的结果，每生成一步又要依次走过这些层。实际通信库会按消息大小和拓扑选算法，图 6 算的是选用环形算法时的情形。

{% raw %}
<details><summary>展开环形 AllReduce 的耗时公式</summary>
{% endraw %}

设有 $p$ 张卡，每张的输入是 $S$ 字节，每轮各发 $S/p$ 字节给下一张卡，同时从上一张收同样多。设每轮启动耗时 $\alpha$，单向带宽为 $B$。忽略链路争用、协议开销和归约计算，两段通信的总耗时近似如下。<sup class="cite"><a href="#ref-2">[2]</a></sup>

{% raw %}<div>$$
t_{\mathrm{ring}}(S)\approx 2(p-1)\alpha + \frac{2(p-1)}{p}\frac{S}{B}.
$$</div>{% endraw %}

{% raw %}
</details>
{% endraw %}

<div id="Prefill-与-Decode-分离时，转移的是-KV" aria-hidden="true"></div>

### 如果换一组卡接着生成，历史 KV 怎么办

如果读提示和生成 token 用的是两组设备，接手生成的 GPU 从哪里读历史 KV？提示词的 key 和 value 是前一组 GPU 算的，此时还在它们的显存里。DistServe 这样的系统会在两组设备之间传递各层的 KV 缓存。两边的分片方式如果不同，一张源卡保存的那一片还得拆给几张目的卡。<sup class="cite"><a href="#ref-10">[10]</a></sup>

取一个 32 层的分组查询注意力（GQA）模型，每层有 8 个 KV 头，每个头有 128 个分量。一个提示 token 在每一层都要留下 K 和 V 两份数据。设元素大小为 $b$，层数为 $L$，KV 头数为 $h_{\mathrm{KV}}$，头维度为 $d_h$。用 BF16 存储时，有

{% raw %}<div>$$
S_{\mathrm{KV/token}}=2Lh_{\mathrm{KV}}d_hb
=2\times32\times8\times128\times2\ \mathrm{B}
=128\ \mathrm{KiB}.
$$</div>{% endraw %}

这里恰好也是 128 KiB。图 5 的 128 KiB 来自 16 条序列，是一个 rank 在一层里交给一次归约的激活。这里的 128 KiB 属于**一个提示 token**，把它在 32 层留下的 KV 全部加了起来。提示长到 8192 个 token，整条请求就有 1 GiB 的逻辑缓存。

{% visual_svg llm-communication/07-kv-transfer %}
图 7｜一条请求的提示 KV 全部通过一条等效链路时，发完有效载荷至少需要多久。横轴每单位为 1024 个提示 token，曲线按标出的十进制 Gb/s 计算。
{% endvisual_svg %}

如果这 1 GiB 全要经过一条 400 Gb/s 链路，跑满线速也要 21.47 ms。实际还要算上准备、排队和接收。若分到两条独立链路并行传，完成时间取决于最后传完的那一份。DistServe 因此也考虑设备放置，在跨机带宽紧张时，可以把负责相同层的两段计算放在同一台机器上。<sup class="cite"><a href="#ref-10">[10]</a></sup>

如果 prefill 端先返回首个 token，而 decode 端需要的 KV 还在路上，用户会多等一会儿才看到第二个 token。如果首个 token 由 decode 端返回，这段等待就算在首 token 延迟里。后续的新 KV 由 decode 端就地追加。<sup class="cite"><a href="#ref-10">[10]</a></sup><sup class="cite"><a href="#ref-14">[14]</a></sup>

{% raw %}
<details><summary>对照各场景传的数据和等待它的计算</summary>
{% endraw %}

| 场景 | 跨卡交换的数据 | 哪一步需要它 |
| --- | --- | --- |
| DDP 训练 | 各卡的梯度，按桶 AllReduce | 每张卡用相同的平均梯度更新完整模型 |
| FSDP2 训练 | AllGather 收集参数，ReduceScatter 分发归约后的梯度 | 计算时需要完整参数组，更新时只要本卡的梯度分片 |
| 经典 TP | AllReduce 合并输出部分和，训练时还要归约输入梯度 | 同层后续计算读取完整结果 |
| PP | Send/Recv 传微批的边界激活，反向传激活梯度 | 相邻阶段接着算这一个微批 |
| MoE 专家并行 | 按目的地交换 token 向量，再把专家输出送回 | 专家先等输入，来源卡再等专家结果 |
| 独立稠密推理副本 | 调度器分发请求，副本间无需交换本次前向的激活 | 选中的副本独立生成 |
| Prefill/Decode 分离 | 点对点传递或重新分片的提示 KV | 接手生成的设备读取历史缓存 |

{% raw %}
</details>
{% endraw %}

<div id="四、从-collective-到网卡" aria-hidden="true"></div>

## 五、到了网卡上，All-to-All 怎么传

回到图 4，从 0 号卡发往 2 号卡的 token，到底走哪条链路？DeepSeek-V3 的技术报告给了一个具体例子。预填充时，发往其他节点的 token 先走 InfiniBand（IB），到了目标节点，再经 NVLink 转交给专家所在的 GPU。专家返回结果时方向相反，先在节点内汇集，再跨 IB 返回。逐 token 生成时，请求对延迟更敏感，这套部署在 dispatch 和 combine 两程都采用 IB 点对点直传，并用 IBGDA 让 GPU 提交通信操作。<sup class="cite"><a href="#ref-11">[11]</a></sup>

流水线里调用 Send/Recv，框架知道要把哪条消息交给哪个 rank。至于网卡怎么交付这条消息，要看传输后端。在可靠连接上使用 RDMA 的 `SEND` 时，接收方须事先在接收队列挂好缓冲区。若选用普通 `RDMA_WRITE`，发送方凭远端地址和访问密钥（rkey），直接把数据写入对方授权的内存。启用 GPUDirect RDMA 后，这块内存可以是 GPU 显存。工作请求可以由 CPU 提交，也可以像前面的 IBGDA 配置那样由 GPU 提交。<sup class="cite"><a href="#ref-12">[12]</a></sup><sup class="cite"><a href="#ref-13">[13]</a></sup>

回头看图 5 里的 128 KiB。如果参与这次归约的 GPU 全在同一台机器上，GPU 之间走的又是 NVLink，这次归约产生的跨机网卡流量就是零。要和网卡计数器对账，除了每张卡交给 AllReduce 的字节数，还得知道哪些卡参加了归约、它们之间走哪条链路。

延伸阅读　[智算互联（上）：训练吞吐与通信瓶颈](/2026/06/28/ai-compute-interconnect-part1-communication-wall/) · [大模型推理的执行机制与性能约束](/2026/11/08/llm-inference-from-token-to-cluster/) · [智算互联（下）：高性能网卡的芯片架构](/2026/06/28/ai-compute-interconnect-part3-smart-nic-chip/)

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
11. <span id="ref-11" class="ref-anchor"></span> DeepSeek-AI, 2024. [DeepSeek-V3 Technical Report](https://arxiv.org/html/2412.19437#S3.SS4). §3.2.2、§3.4，MoE 分发与合并在训练、预填充和解码中的通信路径。
12. <span id="ref-12" class="ref-anchor"></span> NVIDIA. [GPUDirect RDMA](https://docs.nvidia.com/cuda/gpudirect-rdma/). 第三方 PCIe 设备访问 GPU 显存的数据路径。
13. <span id="ref-13" class="ref-anchor"></span> NVIDIA. [RDMA Aware Networks Programming User Manual](https://docs.nvidia.com/rdma-aware-networks-programming-user-manual-1-7.pdf#page=20). §3.1，Send 和 RDMA Write 的接收缓冲区与地址约定。
14. <span id="ref-14" class="ref-anchor"></span> vLLM. [Disaggregated Prefilling](https://docs.vllm.ai/en/latest/features/disagg_prefill/#generate-api-output-modes). 分离式推理的输出模式与 KV 交接。
15. <span id="ref-15" class="ref-anchor"></span> PyTorch. [Distributed communication package，all_to_all_single](https://docs.pytorch.org/docs/stable/distributed.html#torch.distributed.all_to_all_single). 各目的地收发不等长分片的示例。
