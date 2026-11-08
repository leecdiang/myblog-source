---
title: 性能模型的形式与硬件落点：Roofline、Amdahl、CPI 与存储层次
date: 2026-11-06 17:30:00
lang: zh-CN
categories: Silicon & Circuits
tags:
  - 计算机体系结构
  - 性能分析
  - Roofline
  - GPU
etoc: true
mathjax: true
published: true
description: 从 Roofline、Amdahl 定律、CPU 时间方程、AMAT 与 Little 定律出发，讨论性能模型的形式、假设、适用边界及其在 CPU、GPU 与存储层次中的结构对应关系。
keywords: Roofline, Amdahl 定律, CPU 时间方程, AMAT, Little 定律, 计算机体系结构
---

程序跑得慢，先加算力还是先改访存？Roofline、Amdahl 定律、CPU 时间方程和存储层次模型，能把这个问题拆到可以检查的程度：数据搬得够不够快，能并行的部分有多少，周期又耗在了哪里。

这些模型各有假设，也各有看不到的限制。下面会把公式与处理器中的具体结构对起来。交互面板均使用教学参数，用于观察变量之间的关系，不代表任何产品的规格或实测性能。

<!-- more -->

## 1. 性能度量与模型分解

比较性能之前，得先把“完成了多少工作”说清楚。设工作量为 $W$，完成时间为 $T$，平均吞吐率就是 $P = W/T$。工作量固定时，时间越短，吞吐越高；换了工作量或计时边界，两个数字便不能直接这样比较。启动和数据传输是否计时，也要用同一口径。

硬件的峰值吞吐通常写成每周期可完成的操作数与时钟频率的乘积。对一类指令：

$$P_{\text{peak}} = N_{\text{lanes}} \times O_{\text{lane/cycle}} \times f$$

$N_{\text{lanes}}$ 是并行执行通道数，$O_{\text{lane/cycle}}$ 是每通道每周期完成的操作数，$f$ 是时钟频率。乘出来的是执行资源的理论吞吐。指令能否及时送到、操作数是否就绪、下一次运算是否依赖上一次结果，都还没有算进去。

这五组模型可以一起用。Roofline 与 AMAT 分别看存储和计算的吞吐约束、访存延迟，Amdahl 估计并行化能省多少时间；CPU 时间方程追踪指令执行成本，BDP 与 Little 定律则检查并发请求和队列是否够用。

| 模型 | 主要问题 | 典型单位 | 结构对应 |
|---|---|---|---|
| Roofline | 计算吞吐还是数据搬运限制性能 | FLOP/s、Byte/s、FLOP/Byte | 向量/FMA 单元、缓存、DRAM |
| Amdahl | 局部加速对整体时间的回报 | 无量纲加速比 | 核数、专用单元、串行路径 |
| CPU 时间方程 | 指令、周期与频率如何累积 | cycle、指令、秒 | 前端、调度器、执行端口、缓存 |
| AMAT | 一次访存的平均代价 | ns、cycle | L1/L2/LLC、TLB、内存控制器 |
| BDP / Little | 维持吞吐需要多少在途工作 | Byte、request、秒 | MSHR、load/store queue、NoC credit |

## 2. Roofline 模型

[Roofline 模型](https://doi.org/10.1145/1498765.1498785)将计算吞吐和访存带宽表示为同一坐标系中的两条上界。设工作负载完成 $W$ 次浮点运算，并从某一内存层级搬运 $Q$ 字节，则运算强度定义为：

$$I = \frac{W}{Q}$$

可达到的吞吐 $P$ 受计算峰值与带宽共同约束：

$$P_{\text{attainable}} \le \min\left(P_{\text{peak}}, I B\right)$$

其中 $B$ 为该内存层级的持续带宽。两条上界的交点称为 ridge point：

$$I_{\mathrm{ridge}} = \frac{P_{\text{peak}}}{B}$$

$I < I_{\mathrm{ridge}}$ 时，带宽给出的上界更低；$I > I_{\mathrm{ridge}}$ 时，计算峰值的上界更低。但这还不能直接预测运行时间。这里假设系统已进入稳态，$P_{\text{peak}}$ 和 $B$ 分别是对应数据类型、访问模式下的持续值，而且程序有足够的并行度填满执行单元。条件不满足时，实际性能还会落在屋顶之下。

{% raw %}
<div class="v-figure arch-lab" id="roofline-lab">
  <div class="arch-lab-head"><div><p class="arch-kicker">INTERACTIVE MODEL · 01</p><p class="arch-title">Roofline 实验台</p><p>调节峰值算力、带宽和运算强度，观察受限上界与 ridge point 如何变化。</p></div><button type="button" class="arch-reset" data-reset="roofline">恢复示例值</button></div>
  <div class="arch-controls">
    <label>峰值算力 <output id="rf-peak-out">1.0 TFLOP/s</output><input id="rf-peak" type="range" min="0.2" max="4" step="0.1" value="1" aria-label="峰值算力，TFLOP 每秒"></label>
    <label>持续带宽 <output id="rf-bw-out">200 GB/s</output><input id="rf-bw" type="range" min="25" max="800" step="5" value="200" aria-label="持续带宽，GB 每秒"></label>
    <label>运算强度 <output id="rf-int-out">8 FLOP/Byte</output><input id="rf-int" type="range" min="0.25" max="64" step="0.25" value="8" aria-label="运算强度，FLOP 每 Byte"></label>
  </div>
  <p class="v-scroll-hint">图表可横向滚动；键盘聚焦后可用方向键浏览。</p>
  <div class="arch-plot-wrap"><svg id="rf-plot" viewBox="0 0 720 330" role="img" aria-label="Roofline 性能模型交互图"><g class="rf-grid"><path d="M75 40V270H680M75 226.783H680M75 155.000H680M75 83.217H680"/></g><path id="rf-band" class="rf-band"/><path id="rf-roof" class="rf-roof"/><line id="rf-ridge" class="rf-ridge" y1="40" y2="270"/><circle id="rf-dot" r="7"/><text x="375" y="318" text-anchor="middle">运算强度（FLOP/Byte，对数刻度）</text><text transform="translate(20 160) rotate(-90)" text-anchor="middle">吞吐上界（TFLOP/s，对数刻度）</text><text x="75" y="292" text-anchor="middle">0.25</text><text x="226" y="292" text-anchor="middle">1</text><text x="378" y="292" text-anchor="middle">4</text><text x="529" y="292" text-anchor="middle">16</text><text x="680" y="292" text-anchor="middle">64</text><text id="rf-ridge-label" x="0" y="0" text-anchor="middle">ridge</text><text id="rf-point-label" x="0" y="0">workload</text><text x="30" y="274.000">0.005</text><text x="30" y="230.783">0.02</text><text x="30" y="159.000">0.2</text><text x="30" y="87.217">2</text></svg></div>
  <p class="arch-result" id="rf-result" aria-live="polite"></p>
  <p class="v-caption">教学模型，未对应具体芯片。实际峰值需按数据类型与可用指令计算；带宽应采用该工作负载、该内存层级的持续值，而非只抄接口标称速率。</p>
</div>
{% endraw %}

实验台里的圆点代表当前负载，竖向虚线是 ridge point。提高数据复用、用分块增加缓存命中，或通过算法减少访存字节数，都可能让圆点右移。增加计算资源或提高该精度的执行吞吐，则会抬高水平屋顶。

如果圆点仍在带宽斜坡上，单独抬高屋顶并不能改变它受到的带宽限制。

### 2.1 硬件对应

表 2 把这三个参数落到硬件上。

| 模型参数 | 结构对应 | 主要影响因素 |
|---|---|---|
| $P_{\text{peak}}$ | 向量/FMA 管线、SIMT 管线、矩阵单元 | 数据类型、指令组合、执行单元数量、频率 |
| $B$ | L1/L2/LLC、片上 SRAM、HBM/DDR | 命中率、访问合并、读写比例、竞争访问 |
| $I$ | 算法与数据布局 | 分块、复用距离、工作集大小、访存粒度 |

同一矩阵单元在 FP16、BF16 与 FP32 下，吞吐可能不同。即便精度选对了，每周期也得有足够的独立指令可供发射，才能接近计算峰值。

带宽要分层看。缓存命中和访问合并会改变送往下一级的数据量，读写比例与并发竞争会改变持续带宽。算运算强度时，分母是实际穿过所选层级的字节数，不能直接拿数组的逻辑大小代替。GEMM 把矩阵块留在缓存或片上 SRAM 中反复使用，通常就能提高相对 DRAM 的运算强度。

下图把四类模型对应到典型 SoC 的功能块。点击按钮，可以看到各模型最直接涉及哪些资源。图中位置只是逻辑示意，不是具体芯片的物理布局。

{% raw %}
<div class="v-figure arch-map v-chart-scroll"><div class="arch-map-picker" role="group" aria-label="选择公式查看芯片落点"><button type="button" data-map="roofline" aria-pressed="true">Roofline</button><button type="button" data-map="amdahl" aria-pressed="false">Amdahl</button><button type="button" data-map="cpi" aria-pressed="false">CPI</button><button type="button" data-map="bdp" aria-pressed="false">BDP / Little</button></div><p class="arch-map-note" id="map-note">Roofline：计算单元、缓存与内存带宽共同决定屋顶。</p><p class="v-scroll-hint">左右滑动查看完整芯片结构图；键盘聚焦后可用方向键。</p><div class="v-chart-viewport" tabindex="0" role="region" aria-label="可横向滚动的芯片结构图"><svg viewBox="0 0 900 470" role="img" aria-label="性能公式在真实芯片结构上的落点"><text x="26" y="30" font-size="20" class="v-ink">同一颗芯片，四种限制同时存在</text><text x="26" y="52" font-size="12" class="v-sub">这些公式各自指向不同的资源与等待来源。</text><rect x="48" y="72" width="804" height="330" rx="16" class="am-die"/><rect x="70" y="92" width="250" height="120" rx="10" class="am-block am-cpu"/><text x="86" y="114" font-size="13" class="v-ink">CPU cluster</text><rect x="86" y="126" width="46" height="42" rx="4" class="am-core"/><rect x="140" y="126" width="46" height="42" rx="4" class="am-core"/><rect x="194" y="126" width="46" height="42" rx="4" class="am-core"/><rect x="248" y="126" width="46" height="42" rx="4" class="am-core"/><text x="86" y="196" font-size="11" class="am-tag">Amdahl · CPI · 分支与依赖</text><rect x="338" y="92" width="250" height="120" rx="10" class="am-block am-gpu"/><text x="354" y="114" font-size="13" class="v-ink">GPU / SIMT</text><rect x="354" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="386" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="418" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="450" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="482" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="514" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="354" y="160" width="24" height="24" rx="3" class="am-core"/><rect x="386" y="160" width="24" height="24" rx="3" class="am-core"/><rect x="418" y="160" width="24" height="24" rx="3" class="am-core"/><rect x="450" y="160" width="24" height="24" rx="3" class="am-core"/><rect x="482" y="160" width="24" height="24" rx="3" class="am-core"/><rect x="514" y="160" width="24" height="24" rx="3" class="am-core"/><text x="354" y="196" font-size="11" class="am-tag">Roofline · 并行度 · 占用率</text><rect x="606" y="92" width="228" height="120" rx="10" class="am-block am-matrix"/><text x="622" y="114" font-size="13" class="v-ink">Matrix / Vector</text><rect x="622" y="126" width="196" height="54" fill="none" stroke="var(--chart-amber)" stroke-width="1.1" opacity=".8"/><path d="M671 126V180M720 126V180M769 126V180M622 144H818M622 162H818" fill="none" stroke="var(--chart-amber)" stroke-width=".8" opacity=".55"/><text x="622" y="196" font-size="11" class="am-tag">P peak · 数据类型 · FMA</text><rect x="70" y="228" width="360" height="58" rx="8" class="am-block am-cache"/><text x="86" y="250" font-size="13" class="v-ink">L1 / L2 / 末级缓存</text><text x="86" y="270" font-size="11" class="v-sub">命中率决定实际流向 DRAM 的字节数</text><rect x="448" y="228" width="386" height="58" rx="8" class="am-block am-mem"/><text x="464" y="250" font-size="13" class="v-ink">内存控制器 · HBM / DDR PHY</text><text x="464" y="270" font-size="11" class="v-sub">持续带宽 B · 访存延迟 L · 读写比例</text><rect x="70" y="302" width="764" height="48" rx="8" class="am-block am-noc"/><text x="86" y="324" font-size="13" class="v-ink">片上互连 NoC</text><text x="196" y="324" font-size="11" class="v-sub">队列深度 / credit / MSHR / load-store queue</text><text x="650" y="324" font-size="11" class="am-tag">Little 定律 · BDP</text><text x="70" y="378" font-size="12" class="v-sub">同一个程序会同时受多层限制；优化前先找出当前的主导项。</text></svg></div><p class="v-caption">这是逻辑示意，不按任何芯片的物理布局绘制。缓存、内存控制器与互连的具体数量和位置随产品差异很大；箭头所指的是模型最直接作用的资源类型。</p>
</div>
{% endraw %}

标准 Roofline 没有显式描述依赖链、分支、指令前端、同步、并行度不足和数据布局开销。可以继续给模型加约束，但每加一项，就多一组待测参数，也更难分清误差从哪里来。我会先用它判断瓶颈类别、估计上界，再靠测量解释程序为什么没有接近这个上界。

## 3. 存储层次：多级 Roofline 与 AMAT

同一个程序，在 L1、L2、末级缓存和 HBM 上看到的流量并不相同。这些层级各有容量、带宽与延迟，分析哪一层，就要用哪一层的持续带宽。对第 $\ell$ 层：

$$P_{\ell} \le \min\left(P_{\text{peak}}, I_{\ell} B_{\ell}\right)$$

对同一计算量 $W$，分别统计穿过各层边界的流量 $Q_{\ell}$，定义 $I_{\ell} = W/Q_{\ell}$。缓存复用使下层流量减少，各层的横坐标也随之不同；整体吞吐上界取所有层级约束与计算峰值的最小值。[NERSC 的分层 Roofline 说明](https://docs.nersc.gov/tools/performance/roofline/)采用了这种按层级统计流量的方法。

下方预设将计算量归一为 1 GFLOP：流式访问假设四层流量相同；LLC 复用让 HBM 流量降为 L1 的 1/16；L2 分块让 LLC 与 HBM 流量分别降为 L1 的 1/8、1/64。它们是说明流量关系的教学假设，未模拟容量、写回、预取及访存重叠。表格列出每层流量、运算强度和独立上界，图上的四个点分别使用各自的横坐标。

{% raw %}
<div class="v-figure arch-lab" id="multi-roofline-lab">
  <div class="arch-lab-head"><div><p class="arch-kicker">INTERACTIVE MODEL · 02</p><p class="arch-title">多级 Roofline：同一负载，四层屋顶</p><p>选择复用预设，比较各层流量与吞吐上界；点击层级可高亮对应屋顶。</p></div></div>
  <div class="arch-controls arch-controls--two">
    <label>峰值算力 <output id="ml-peak-out">8.0 TFLOP/s</output><input id="ml-peak" type="range" min="1" max="16" step="0.5" value="8" aria-label="峰值算力，TFLOP 每秒"></label>
    <label>L1 运算强度 <output id="ml-int-out">8 FLOP/Byte</output><input id="ml-int" type="range" min="0.25" max="128" step="0.25" value="8" aria-label="L1 运算强度，FLOP 每 Byte"></label>
  </div>
  <label class="arch-preset">流量预设 <select id="ml-preset"><option value="stream">流式访问 · 各层流量相同</option><option value="llc">LLC 复用 · HBM 流量 ÷16</option><option value="l2">L2 分块 · LLC ÷8，HBM ÷64</option></select></label>
  <div class="arch-levels" role="group" aria-label="选择内存层级">
    <button type="button" data-level="l1" aria-pressed="false">L1 · 2000 GB/s</button>
    <button type="button" data-level="l2" aria-pressed="false">L2 · 800 GB/s</button>
    <button type="button" data-level="llc" aria-pressed="false">LLC · 300 GB/s</button>
    <button type="button" data-level="hbm" aria-pressed="true">HBM · 100 GB/s</button>
  </div>
  <p class="v-scroll-hint">图表可横向滚动；键盘聚焦后可用方向键浏览。</p>
  <div class="arch-plot-wrap"><svg id="ml-plot" viewBox="0 0 720 340" role="img" aria-label="多级 Roofline 交互图"><g class="ml-grid"><path d="M75 40V280H680M75 240.748H680M75 175.553H680M75 110.358H680M75 45.162H680"/></g><path id="ml-roof-l1" class="ml-roof ml-l1"/><path id="ml-roof-l2" class="ml-roof ml-l2"/><path id="ml-roof-llc" class="ml-roof ml-llc"/><path id="ml-roof-hbm" class="ml-roof ml-hbm"/><circle id="ml-dot-l1" class="ml-dot ml-l1" r="5"/><circle id="ml-dot-l2" class="ml-dot ml-l2" r="5"/><circle id="ml-dot-llc" class="ml-dot ml-llc" r="5"/><circle id="ml-dot-hbm" class="ml-dot ml-hbm" r="5"/><text id="ml-point-label" x="0" y="0">HBM</text><text x="375" y="326" text-anchor="middle">运算强度（FLOP/Byte，对数刻度）</text><text transform="translate(20 170) rotate(-90)" text-anchor="middle">吞吐（TFLOP/s，对数刻度）</text><text x="75" y="300" text-anchor="middle">0.25</text><text x="195" y="300" text-anchor="middle">2</text><text x="315" y="300" text-anchor="middle">16</text><text x="435" y="300" text-anchor="middle">128</text><text x="555" y="300" text-anchor="middle">1024</text><text x="675" y="300" text-anchor="middle">8192</text><text x="30" y="284.000">0.005</text><text x="30" y="244.748">0.02</text><text x="30" y="179.553">0.2</text><text x="30" y="114.358">2</text><text x="30" y="49.162">20</text></svg></div>
  <div class="table-container"><table class="arch-flow-table"><caption>归一计算量 W = 1 GFLOP；流量采用十进制 MB</caption><thead><tr><th>层级</th><th>流量 Q（MB）</th><th>I（FLOP/Byte）</th><th>上界（TFLOP/s）</th></tr></thead><tbody id="ml-flows"></tbody></table></div>
  <p class="arch-result" id="ml-result" aria-live="polite"></p>
  <p class="v-caption">带宽为教学示例，不对应具体产品。实际应使用该层级、该访问模式的持续带宽；接口标称值不能替代该值。</p>
</div>
{% endraw %}

Roofline 描述稳态吞吐上界，AMAT 描述单次访存的平均延迟。设命中时间为 $t_{\text{hit}}$，缺失率为 $m$，一次缺失的代价为 $t_{\text{miss}}$，则单级近似为：

$$AMAT = t_{\text{hit}} + m \times t_{\text{miss}}$$

多级缓存可以继续展开：

$$AMAT_{L1} = t_{L1} + m_{L1}\left(t_{L2} + m_{L2} t_{\text{mem}}\right)$$

两个缺失率的分母不同：$m_{L1}$ 统计全部 L1 访问，$m_{L2}$ 只统计到达 L2 的访问，都是局部缺失率。$t_{\text{miss}}$ 是命中查询之外多付的平均代价；多级式里的 $t_{\text{mem}}$ 也指计入 L2 查询后额外增加的内存代价。

这样相加，假定缺失可以按平均值处理，各级代价也能直接叠加。真实处理器会用乱序执行重叠多个 miss，程序的停滞时间未必等于 AMAT 的累加。因此，用 AMAT 比较缓存配置的相对代价比较合适；要预测运行时间，还得结合其他模型和实测。

{% raw %}
<div class="v-figure arch-lab" id="amat-lab">
  <div class="arch-lab-head"><div><p class="arch-kicker">INTERACTIVE MODEL · 03</p><p class="arch-title">AMAT：一次访问的平均代价</p><p>调节命中时间、缺失率与缺失代价，观察平均访存时间由哪一项主导。</p></div></div>
  <div class="arch-controls arch-controls--three">
    <label>命中时间 <output id="amat-hit-val">1.0 ns</output><input id="amat-hit" type="range" min="0.5" max="5" step="0.1" value="1" aria-label="命中时间，纳秒"></label>
    <label>缺失率 <output id="amat-miss-val">5.0%</output><input id="amat-miss" type="range" min="0.001" max="0.2" step="0.001" value="0.05" aria-label="缺失率"></label>
    <label>缺失代价 <output id="amat-pen-val">100 ns</output><input id="amat-penalty" type="range" min="20" max="400" step="5" value="100" aria-label="缺失代价，纳秒"></label>
  </div>
  <div class="mem-bars" id="amat-bars">
    <div class="mem-bar-row"><span>命中时间</span><div class="mem-bar"><i id="amat-hit-bar"></i></div><b id="amat-hit-cost"></b></div>
    <div class="mem-bar-row"><span>缺失代价</span><div class="mem-bar mem-bar--alt"><i id="amat-miss-bar"></i></div><b id="amat-miss-cost"></b></div>
  </div>
  <p class="arch-result" id="amat-result" aria-live="polite"></p>
  <p class="v-caption">单级近似：AMAT = 命中时间 + 缺失率 × 缺失代价。真实多级缓存会把缺失代价继续展开为下一级的命中与缺失。</p>
</div>
{% endraw %}

两种模型观察的是同一套存储系统：AMAT 看一次访问平均要等多久，Roofline 看大量访问持续进行时能达到多大吞吐。提高命中率，既可能降低 AMAT，也可能让负载用上更高一层的 Roofline；单独提高带宽，却不一定缩短单次访问的等待。

## 4. Amdahl 定律与扩展性

[Amdahl 定律](https://doi.org/10.1145/1465482.1465560)描述固定工作量下局部优化的整体回报。设原始运行时间中比例为 $s$ 的部分无法被该优化加速，其余 $1-s$ 获得 $k$ 倍加速，则整体加速比为：

$$S = \frac{1}{s + \frac{1-s}{k}}$$

当 $k \to \infty$ 时，$S \to 1/s$。只要还有一部分时间省不掉，另一部分加速到后来，整体收益就会越来越小。

{% raw %}
<div class="v-figure arch-lab" id="amdahl-lab">
  <div class="arch-lab-head"><div><p class="arch-kicker">INTERACTIVE MODEL · 04</p><p class="arch-title">Amdahl 加速收益</p><p>拖动串行时间比例与被优化部分的加速倍数。</p></div></div>
  <div class="arch-controls arch-controls--two">
    <label>不可加速部分 <output id="am-s-out">20%</output><input id="am-s" type="range" min="0" max="0.9" step="0.01" value="0.2" aria-label="不可加速部分的时间比例"></label>
    <label>其余部分加速倍数 <output id="am-k-out">4×</output><input id="am-k" type="range" min="1" max="32" step="0.5" value="4" aria-label="可加速部分的加速倍数"></label>
  </div>
  <div class="arch-amdahl-track" aria-hidden="true"><span id="am-serial"></span><span id="am-parallel"></span></div>
  <p class="arch-result" id="am-result" aria-live="polite"></p>
  <p class="v-caption">Amdahl 的“串行部分”是对当前优化而言不能随之加速的时间，不一定等同于源代码中写成单线程的那几行。</p>
</div>
{% endraw %}

这里的 $s$ 要相对于当前优化来算，不能只数代码里哪些语句是串行的。锁竞争、同步、串行初始化、内存带宽饱和和设备启动，都可能成为省不掉的时间。

加 CPU 核主要帮助可并行的工作。GPU 多一些计算单元，也不会自动缩短主机准备、kernel launch、数据传输或严格串行的依赖链。专用矩阵单元的收益，则还取决于运算形状和数据类型是否匹配。

固定工作量假设并非唯一场景。Gustafson 定律考虑问题规模随处理器数量增长的情况。若并行执行时间中串行比例为 $s$，处理器数为 $k$，则固定时间模型下的加速比可写为：

$$S_{G} = s + k(1-s)$$

Amdahl 固定工作量，问同一件工作能快多少；Gustafson 固定时间，问增加处理器以后能多做多少工作。使用场景不同，两者可以同时成立。

## 5. CPU 时间方程与 CPI

对一段程序，CPU 时间可以分解为动态指令数、平均每指令周期数和时钟周期：

$$T_{\text{CPU}} = IC \times CPI \times T_{\text{cycle}} = \frac{IC \times CPI}{f}$$

$IC$ 是动态执行的指令数，$CPI$ 是总周期数除以 $IC$，$f$ 是时钟频率。CPI 不能当成一颗 CPU 的固定属性：换程序，甚至只换输入，分支、缓存命中、依赖链和指令并行度都可能变化，总周期数也随之变化。

按指令类别拆 CPI 时，微基准测出的孤立 CPI 与混合程序的实际 CPI 要分开。程序中的停顿可能重叠，不能把各类孤立 CPI 简单相加。要追查周期去了哪里，可以继续看性能计数器给出的前端、后端、分支和内存停顿。

顺着 $IC \times CPI$ 往处理器里看，取指和译码先供给指令，寄存器重命名与调度窗口找出就绪操作，执行端口完成运算，缓存和加载/存储单元提供数据。分支预测则尽量让前端不断流。乱序执行能把独立指令叠在一起，却绕不过真实数据依赖。

换成加速器，单一 CPI 往往不够直观。每周期完成多少向量、矩阵 tile 或事务，更贴近它的执行粒度。

## 6. 延迟、带宽与并发

带宽回答每秒能通过多少数据，延迟回答一次传输或访问要等多久，二者要分别看。目标吞吐为 $B$ Byte/s、往返延迟为 $L$ 秒时，维持链路满载需要的平均在途数据量为：

$$D_{\text{in-flight}} = B \times L$$

该乘积称为延迟-带宽积（Bandwidth-Delay Product, BDP）。例如持续带宽 200 GB/s、往返延迟 100 ns 时：

$$D = 200 \times 10^{9} \times 100 \times 10^{-9} = 20{,}000\;\text{Byte}$$

即 20.0 KB（约 19.5 KiB）。单位检查为 Byte/s × s = Byte。

算出 BDP，还要看硬件能否容纳这么多在途工作。MSHR 限制同时追踪的 cache miss，load queue 限制保留的访存操作，互连 buffer 和 credit 限制在途 flit。资源不够，链路就填不满；如果下一次访问的地址依赖上一次结果，单纯加深队列也未必能增加并发。

[Little 定律](https://doi.org/10.1287/opre.9.3.383)给出更一般的稳态关系。设系统平均吞吐率为 $\lambda$，每个请求平均停留时间为 $W$，则系统内平均工作量为：

$$N = \lambda W$$

用于内存事务时，$N$ 是平均在途请求数，$\lambda$ 是完成率，$W$ 是平均停留时间。Little 定律描述稳定系统，不能拿来还原瞬态过程；BDP 则以字节计量填满链路所需的数据。带宽再高，也得有足够的并发工作覆盖等待时间，才能转化为有效吞吐。

{% raw %}
<div class="v-figure arch-lab" id="memory-lab">
  <div class="arch-lab-head"><div><p class="arch-kicker">INTERACTIVE MODEL · 05</p><p class="arch-title">在途请求够不够？</p><p>调节带宽、延迟、在途请求数与每次请求的大小，观察结构容量如何限制可达带宽。</p></div></div>
  <div class="arch-controls arch-controls--four">
    <label>持续带宽 <output id="mem-bw-out">200 GB/s</output><input id="mem-bw" type="range" min="25" max="1200" step="25" value="200" aria-label="持续带宽，GB 每秒"></label>
    <label>往返延迟 <output id="mem-lat-out">100 ns</output><input id="mem-lat" type="range" min="40" max="600" step="10" value="100" aria-label="往返延迟，纳秒"></label>
    <label>在途请求 <output id="mem-n-out">64</output><input id="mem-n" type="range" min="1" max="512" step="1" value="64" aria-label="同时在途的请求数量"></label>
    <label>每请求字节 <output id="mem-size-out">64 B</output><input id="mem-size" type="range" min="32" max="256" step="32" value="64" aria-label="每个请求搬运的字节数"></label>
  </div>
  <div class="mem-bars">
    <div class="mem-bar-row"><span>链路所需在途数据</span><div class="mem-bar"><i id="mem-bdp-bar"></i></div><b id="mem-bdp-out"></b></div>
    <div class="mem-bar-row"><span>结构可提供的在途数据</span><div class="mem-bar mem-bar--alt"><i id="mem-have-bar"></i></div><b id="mem-have-out"></b></div>
  </div>
  <p class="arch-result" id="mem-result" aria-live="polite"></p>
  <p class="v-caption">按 BDP = B × L 与 Little 定律的稳态形式估算。真实系统中 MSHR、缓存行大小、请求合并和依赖链会进一步改变并发能力。</p>
</div>
{% endraw %}

## 7. 模型的适用边界

这些模型省略了大量细节，误差通常出在工作量边界、参数取值和没有纳入的约束上。表 3 列出了排查时容易碰到的几种情况。

| 误差来源 | 对模型的影响 |
|---|---|
| 工作量边界不一致 | 吞吐率与加速比无法直接比较 |
| 单位与计数口径不一致 | FLOP 与 MAC、GB 与 GiB、单程与往返延迟产生系统性偏差 |
| 参数取自规格峰值 | 忽略频率调节、功耗限制和实际指令组合 |
| 未建模的并行度限制 | Roofline 高估可达吞吐，Amdahl 低估串行比例 |
| 未建模的队列与依赖 | BDP 高估可填充的并发，AMAT 低估实际停滞 |
| 瞬态与尾延迟 | 稳态平均值掩盖最慢请求和启动阶段 |

模型给出判断以后，下一步是设法验证它。Roofline 指向 DRAM，就检查实际读写流量、命中率和持续带宽；Amdahl 指向较大的串行占比，就逐阶段计时。CPI 升高时，还要拆开看前端、后端、分支和内存停顿，CPI 这个数字本身并不是原因。

## 8. 根据观测选择排查方向

表 4 列出几种常见现象，以及可以先检查的模型、代码和硬件结构。它能帮助缩小范围，具体原因仍要测。

| 观测现象 | 可先检查的模型 | 代码方向 | 硬件结构 |
|---|---|---|---|
| 算力单元利用率低、DRAM 流量高 | Roofline、运算强度 | 分块、数据复用、压缩传输 | 缓存、HBM 带宽、片上 SRAM |
| 增加核心后收益迅速减小 | Amdahl、强/弱扩展 | 减少串行阶段与同步 | 核数、互连、共享资源 |
| IPC 下降或 CPI 上升 | CPU 时间方程、停顿分解 | 改善局部性、依赖和分支 | 前端、ROB、执行端口、缓存 |
| 带宽低于预期但延迟不变 | BDP、Little 定律 | 提高独立访存并发 | MSHR、队列深度、credit |
| 小工作负载启动开销占比高 | 固定开销模型 | 合并任务、减少 launch | 命令处理器、驱动、调度器 |

表 4 最后一行可以写成 $T = T_{\text{fixed}} + T_{\text{work}}$。工作量小时，固定开销占大头，提高执行单元峰值未必能省下多少时间。

实际诊断可以从工作量和计时口径开始，再用 Roofline 看吞吐约束、用 Amdahl 估计并行收益。周期与吞吐计数帮助定位微架构停顿，BDP 和 Little 定律则用来检查数据通路是否有足够的并发请求。

## 9. 公式之后还要测什么

这些公式把同一段运行过程拆成了不同问题。Roofline 和 AMAT 分别看吞吐与访存延迟，Amdahl 看局部加速能省掉多少总时间，CPU 时间方程把时间拆到指令和周期，BDP 与 Little 定律检查并发能否覆盖等待。它们用到最小值、乘积或加权和，约束的资源和时间尺度却不一样。

我更关心的是：代入数字以后，能否提出一个可以被测量推翻的判断。参数从哪里来，工作量算到哪里，还有哪些约束没写进式子，都比计算结果的小数位重要。若继续把这套分析接到数字 IC 实现上，动态功耗、时序、面积和良率还需要各自的模型。

## 参考资料

1. Samuel Williams, Andrew Waterman, David Patterson, “Roofline: An Insightful Visual Performance Model for Multicore Architectures,” Communications of the ACM, 2009. https://doi.org/10.1145/1498765.1498785
2. Gene M. Amdahl, “Validity of the Single Processor Approach to Achieving Large Scale Computing Capabilities,” AFIPS, 1967. https://doi.org/10.1145/1465482.1465560
3. John L. Gustafson, “Reevaluating Amdahl’s Law,” Communications of the ACM, 1988. https://doi.org/10.1145/42411.42415
4. John D. C. Little, “A Proof for the Queuing Formula: L = λW,” Operations Research, 1961. https://doi.org/10.1287/opre.9.3.383
5. John L. Hennessy and David A. Patterson, Computer Architecture: A Quantitative Approach, 6th edition, Morgan Kaufmann, 2019.
6. Intel, Intel 64 and IA-32 Architectures Optimization Reference Manual. https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html
7. NVIDIA, CUDA C++ Programming Guide, Performance Guidelines. https://docs.nvidia.com/cuda/cuda-c-programming-guide/

<script defer src="/js/architecture-models.js"></script>
