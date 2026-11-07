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

体系结构性能分析通常从一个受限优化问题开始：给定工作负载、编译结果与硬件资源，程序的执行时间由哪些项构成，各项的上界由什么决定，改变其中一项后整体性能如何变化。Roofline、Amdahl 定律、CPU 时间方程与存储层次模型分别从吞吐、并行度、指令执行和访存延迟四个角度给出近似描述。本文讨论这些模型的形式、主要假设与适用边界，并说明它们与真实处理器结构之间的对应关系。文中的交互面板用于展示参数变化对模型结果的影响，均采用教学参数，不对应特定产品的规格或实测性能。

<!-- more -->

## 1. 性能度量与模型分解

设工作量为 $W$，完成时间为 $T$，则平均吞吐率为 $P = W/T$。对固定工作量，完成时间与吞吐率互为倒数；若工作量或测量边界改变，这一关系不再直接成立。因此，比较性能时必须同时说明工作量、计时范围以及是否包含启动和数据传输开销。

硬件的峰值吞吐通常写成每周期可完成的操作数与时钟频率的乘积。对一类指令：

$$P_{\text{peak}} = N_{\text{lanes}} \times O_{\text{lane/cycle}} \times f$$

其中 $N_{\text{lanes}}$ 为并行执行通道数，$O_{\text{lane/cycle}}$ 为每通道每周期完成的操作数，$f$ 为时钟频率。该式只描述执行资源的理论吞吐，不包含指令供给、操作数到达和依赖关系带来的限制。

表 1 汇总了本文讨论的五组模型。它们并不互斥：Roofline 与 AMAT 描述存储和计算资源，Amdahl 描述并行化的收益，CPU 时间方程描述指令执行成本，BDP 与 Little 定律描述并发请求与队列。

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

当 $I < I_{\mathrm{ridge}}$ 时，工作负载位于带宽受限区域；当 $I > I_{\mathrm{ridge}}$ 时，位于计算受限区域。上述结论依赖若干假设：系统处于稳态，$P_{\text{peak}}$ 是该数据类型的持续峰值，$B$ 是该访问模式的持续带宽，且工作负载具有足够的并行度来填满执行单元。若这些条件不成立，Roofline 给出的是上界，而非运行时间预测。

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

Roofline 实验台中的圆点表示当前工作负载，竖向虚线表示 ridge point。圆点右移可以表示提高数据复用、采用分块使更多访问命中缓存，或改变算法降低访存字节数；抬高水平屋顶则表示增加计算资源或提高该精度的执行吞吐。若工作负载仍位于带宽斜坡上，继续增加计算峰值不会改变其受限类型。

### 2.1 硬件对应

Roofline 的三个参数分别对应不同的硬件资源，如表 2 所示。

| 模型参数 | 结构对应 | 主要影响因素 |
|---|---|---|
| $P_{\text{peak}}$ | 向量/FMA 管线、SIMT 管线、矩阵单元 | 数据类型、指令组合、执行单元数量、频率 |
| $B$ | L1/L2/LLC、片上 SRAM、HBM/DDR | 命中率、访问合并、读写比例、竞争访问 |
| $I$ | 算法与数据布局 | 分块、复用距离、工作集大小、访存粒度 |

计算峰值取决于数据精度和可用指令。例如，同一矩阵单元在 FP16、BF16 与 FP32 下的吞吐可能不同，实际峰值还要求每个周期都有足够的独立指令可供发射。带宽同样具有层级性：缓存命中率与访问合并会改变流向下一级的数据量，读写比例和并发访问会改变持续带宽。运算强度的分母应取实际从所选层级搬运的字节数；数组的逻辑大小不构成分母。GEMM 分块将矩阵块保留在缓存或片上 SRAM 中复用，通常可以提高相对 DRAM 的运算强度。

下方的结构图将四类模型映射到典型 SoC 的功能块。图中的按钮用于选择模型并高亮其最直接作用的资源。该图是逻辑示意，不表示任何具体芯片的物理布局。

{% raw %}
<div class="v-figure arch-map v-chart-scroll"><div class="arch-map-picker" role="group" aria-label="选择公式查看芯片落点"><button type="button" data-map="roofline" aria-pressed="true">Roofline</button><button type="button" data-map="amdahl" aria-pressed="false">Amdahl</button><button type="button" data-map="cpi" aria-pressed="false">CPI</button><button type="button" data-map="bdp" aria-pressed="false">BDP / Little</button></div><p class="arch-map-note" id="map-note">Roofline：计算单元、缓存与内存带宽共同决定屋顶。</p><p class="v-scroll-hint">左右滑动查看完整芯片结构图；键盘聚焦后可用方向键。</p><div class="v-chart-viewport" tabindex="0" role="region" aria-label="可横向滚动的芯片结构图"><svg viewBox="0 0 900 470" role="img" aria-label="性能公式在真实芯片结构上的落点"><text x="26" y="30" font-size="20" class="v-ink">同一颗芯片，四种限制同时存在</text><text x="26" y="52" font-size="12" class="v-sub">这些公式各自指向不同的资源与等待来源。</text><rect x="48" y="72" width="804" height="330" rx="16" class="am-die"/><rect x="70" y="92" width="250" height="120" rx="10" class="am-block am-cpu"/><text x="86" y="114" font-size="13" class="v-ink">CPU cluster</text><rect x="86" y="126" width="46" height="42" rx="4" class="am-core"/><rect x="140" y="126" width="46" height="42" rx="4" class="am-core"/><rect x="194" y="126" width="46" height="42" rx="4" class="am-core"/><rect x="248" y="126" width="46" height="42" rx="4" class="am-core"/><text x="86" y="196" font-size="11" class="am-tag">Amdahl · CPI · 分支与依赖</text><rect x="338" y="92" width="250" height="120" rx="10" class="am-block am-gpu"/><text x="354" y="114" font-size="13" class="v-ink">GPU / SIMT</text><rect x="354" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="386" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="418" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="450" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="482" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="514" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="354" y="160" width="24" height="24" rx="3" class="am-core"/><rect x="386" y="160" width="24" height="24" rx="3" class="am-core"/><rect x="418" y="160" width="24" height="24" rx="3" class="am-core"/><rect x="450" y="160" width="24" height="24" rx="3" class="am-core"/><rect x="482" y="160" width="24" height="24" rx="3" class="am-core"/><rect x="514" y="160" width="24" height="24" rx="3" class="am-core"/><text x="354" y="196" font-size="11" class="am-tag">Roofline · 并行度 · 占用率</text><rect x="606" y="92" width="228" height="120" rx="10" class="am-block am-matrix"/><text x="622" y="114" font-size="13" class="v-ink">Matrix / Vector</text><rect x="622" y="126" width="196" height="54" fill="none" stroke="var(--chart-amber)" stroke-width="1.1" opacity=".8"/><path d="M671 126V180M720 126V180M769 126V180M622 144H818M622 162H818" fill="none" stroke="var(--chart-amber)" stroke-width=".8" opacity=".55"/><text x="622" y="196" font-size="11" class="am-tag">P peak · 数据类型 · FMA</text><rect x="70" y="228" width="360" height="58" rx="8" class="am-block am-cache"/><text x="86" y="250" font-size="13" class="v-ink">L1 / L2 / 末级缓存</text><text x="86" y="270" font-size="11" class="v-sub">命中率决定实际流向 DRAM 的字节数</text><rect x="448" y="228" width="386" height="58" rx="8" class="am-block am-mem"/><text x="464" y="250" font-size="13" class="v-ink">内存控制器 · HBM / DDR PHY</text><text x="464" y="270" font-size="11" class="v-sub">持续带宽 B · 访存延迟 L · 读写比例</text><rect x="70" y="302" width="764" height="48" rx="8" class="am-block am-noc"/><text x="86" y="324" font-size="13" class="v-ink">片上互连 NoC</text><text x="196" y="324" font-size="11" class="v-sub">队列深度 / credit / MSHR / load-store queue</text><text x="650" y="324" font-size="11" class="am-tag">Little 定律 · BDP</text><text x="70" y="378" font-size="12" class="v-sub">同一个程序会同时受多层限制；优化前先找出当前的主导项。</text></svg></div><p class="v-caption">这是逻辑示意，不按任何芯片的物理布局绘制。缓存、内存控制器与互连的具体数量和位置随产品差异很大；箭头所指的是模型最直接作用的资源类型。</p>
</div>
{% endraw %}

标准 Roofline 不显式描述依赖链、分支、指令前端、同步、并行度不足和数据布局开销。扩展模型可以纳入这些因素，但模型越细，所需参数越多，误差来源也越难分离。因此，Roofline 适合用于瓶颈分类和上界估计，不宜单独用于绝对性能预测。

## 3. 存储层次：多级 Roofline 与 AMAT

存储层次使带宽 $B$ 具有层级性。L1、L2、末级缓存和 HBM 各有容量、带宽与延迟；工作负载的数据由哪一层供给，就应使用该层的持续带宽。对第 $\ell$ 层：

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

式中的 $m_{L1}$ 以全部 L1 访问为分母，$m_{L2}$ 以到达 L2 的访问为分母，均为局部缺失率。$t_{\text{miss}}$ 是在命中查询时间之外额外增加的平均代价；多级式中的 $t_{\text{mem}}$ 也是已计入 L2 查询后额外增加的内存代价。该近似假设缺失事件可以按平均值处理，且各级代价可以直接相加。乱序执行可以重叠多个 miss，实际停滞时间不一定等于 AMAT 的简单累加；因此，AMAT 更适合比较不同缓存配置的相对代价；预测程序运行时间仍需结合其他模型与实测。

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

AMAT 与 Roofline 描述同一存储系统的两个侧面。AMAT 给出一次访问的平均延迟，Roofline 给出大量访问持续进行时的吞吐上界。缓存命中率提高既降低 AMAT，也可能把工作负载推向更高的 Roofline 层级；反之，提高带宽不一定降低单次访问延迟。

## 4. Amdahl 定律与扩展性

[Amdahl 定律](https://doi.org/10.1145/1465482.1465560)描述固定工作量下局部优化的整体回报。设原始运行时间中比例为 $s$ 的部分无法被该优化加速，其余 $1-s$ 获得 $k$ 倍加速，则整体加速比为：

$$S = \frac{1}{s + \frac{1-s}{k}}$$

当 $k \to \infty$ 时，$S \to 1/s$。该上限说明：若不可加速部分占运行时间的比例较高，继续提高可加速部分的性能，整体收益会迅速减小。

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

在处理器实现中，$s$ 是相对于给定优化不能随之加速的时间比例，不一定等于源代码中串行语句的比例。锁竞争、同步、串行初始化、内存带宽饱和和设备启动开销都可能进入 $s$。增加 CPU 核数主要加速可并行工作；GPU 增加计算单元不能自动加速主机端准备、kernel launch、数据传输或严格串行的依赖；专用矩阵单元只在运算形状和数据类型匹配时提升对应部分。

固定工作量假设并非唯一场景。Gustafson 定律考虑问题规模随处理器数量增长的情况。若并行执行时间中串行比例为 $s$，处理器数为 $k$，则固定时间模型下的加速比可写为：

$$S_{G} = s + k(1-s)$$

Amdahl 与 Gustafson 回答不同问题：前者估计固定工作量下的加速上限，后者估计固定时间内完成更大工作量时的扩展收益。两者并不互相否定。

## 5. CPU 时间方程与 CPI

对一段程序，CPU 时间可以分解为动态指令数、平均每指令周期数和时钟周期：

$$T_{\text{CPU}} = IC \times CPI \times T_{\text{cycle}} = \frac{IC \times CPI}{f}$$

其中 $IC$ 为动态执行的指令数，$CPI$ 为总周期数除以 $IC$，$f$ 为时钟频率。CPI 随程序与微架构变化：同一颗 CPU 运行不同程序，或同一程序使用不同输入，都可能得到不同的 CPI。分支行为、缓存命中、依赖链和可并行指令数量都会改变总周期数。

按指令类别分解 CPI 时，需要区分“各类指令的孤立 CPI”和“混合负载的实际 CPI”。前者可以在微基准中测量，后者由总周期数除以动态指令数得到；由于停顿事件可能重叠，各类 CPI 不能简单相加。性能计数器通常进一步给出前端、后端、分支和内存停顿的分解，用于定位周期消耗的来源。

在处理器内部，$IC \times CPI$ 对应一条动态路径：取指与译码供给指令，寄存器重命名与调度窗口选择可执行操作，执行端口完成运算，缓存与加载/存储单元提供数据，分支预测减少前端断流。乱序执行可以重叠彼此独立的指令，但无法消除真实数据依赖。对加速器，单一 CPI 往往不如每周期完成的向量、矩阵 tile 或事务数更能反映执行粒度。

## 6. 延迟、带宽与并发

带宽描述单位时间可以通过的数据量，延迟描述一次传输或访问的等待时间。二者是独立规格。若目标吞吐为 $B$ Byte/s，往返延迟为 $L$ 秒，则维持链路满载所需的平均在途数据量为：

$$D_{\text{in-flight}} = B \times L$$

该乘积称为延迟-带宽积（Bandwidth-Delay Product, BDP）。例如持续带宽 200 GB/s、往返延迟 100 ns 时：

$$D = 200 \times 10^{9} \times 100 \times 10^{-9} = 20{,}000\;\text{Byte}$$

即 20.0 KB（约 19.5 KiB）。单位检查为 Byte/s × s = Byte。

BDP 给出了链路填充的下界，但实际在途请求受结构资源限制：MSHR 数量限制同时追踪的 cache miss，load queue 限制可保留的访存操作，互连 buffer 和 credit 限制飞行中的 flit。若这些结构容纳不了足够多的请求，链路无法持续满载；若请求之间存在地址依赖，增加队列深度也未必提高并发。

[Little 定律](https://doi.org/10.1287/opre.9.3.383)给出更一般的稳态关系。设系统平均吞吐率为 $\lambda$，每个请求平均停留时间为 $W$，则系统内平均工作量为：

$$N = \lambda W$$

对内存事务，$N$ 对应平均在途请求数，$\lambda$ 对应完成率，$W$ 对应平均停留时间。Little 定律适用于稳定系统，不描述瞬态行为；BDP 则用字节数描述链路填充量。二者都说明：高带宽并不自动等于高有效吞吐，并发资源必须足以覆盖延迟。

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

上述模型均为粗粒化描述，其误差主要来自工作量边界、参数来源和未建模约束。表 3 列出了常见误差来源及其影响。

| 误差来源 | 对模型的影响 |
|---|---|
| 工作量边界不一致 | 吞吐率与加速比无法直接比较 |
| 单位与计数口径不一致 | FLOP 与 MAC、GB 与 GiB、单程与往返延迟产生系统性偏差 |
| 参数取自规格峰值 | 忽略频率调节、功耗限制和实际指令组合 |
| 未建模的并行度限制 | Roofline 高估可达吞吐，Amdahl 低估串行比例 |
| 未建模的队列与依赖 | BDP 高估可填充的并发，AMAT 低估实际停滞 |
| 瞬态与尾延迟 | 稳态平均值掩盖最慢请求和启动阶段 |

因此，模型输出应作为可检验的假设；结论仍需测量支持。对真实芯片，合理的流程是先用模型提出瓶颈判断，再用性能计数器和微基准验证。若 Roofline 判断工作负载受限于 DRAM，应检查实际读写流量、缓存命中率和持续带宽；若 Amdahl 估计串行段占比较高，应逐阶段计时；若 CPI 上升，应进一步拆解前端、后端、分支和内存停顿，不能把 CPI 本身当作原因。

## 8. 从观测到结构

表 4 将常见观测现象映射到可先检查的模型、代码方向和硬件结构。该表用于缩小排查范围，不替代测量。

| 观测现象 | 可先检查的模型 | 代码方向 | 硬件结构 |
|---|---|---|---|
| 算力单元利用率低、DRAM 流量高 | Roofline、运算强度 | 分块、数据复用、压缩传输 | 缓存、HBM 带宽、片上 SRAM |
| 增加核心后收益迅速减小 | Amdahl、强/弱扩展 | 减少串行阶段与同步 | 核数、互连、共享资源 |
| IPC 下降或 CPI 上升 | CPU 时间方程、停顿分解 | 改善局部性、依赖和分支 | 前端、ROB、执行端口、缓存 |
| 带宽低于预期但延迟不变 | BDP、Little 定律 | 提高独立访存并发 | MSHR、队列深度、credit |
| 小工作负载启动开销占比高 | 固定开销模型 | 合并任务、减少 launch | 命令处理器、驱动、调度器 |

表 4 最后一行可写成 $T = T_{\text{fixed}} + T_{\text{work}}$。当工作量较小时，固定开销主导；提高执行单元峰值对这类场景帮助有限。诊断顺序可以概括为：先界定工作量与测量口径，再用 Roofline 判断受限类型；用 Amdahl 估计并行化收益；通过周期与吞吐计数定位微架构停顿；最后用 BDP 和 Little 定律检查并发资源是否足以填满数据通路。

## 9. 结论

本文以 Roofline、Amdahl、CPU 时间方程、AMAT、BDP 与 Little 定律为线索，给出了性能模型的形式化表述、主要假设和硬件对应关系。这些模型的共同结构是将执行时间或吞吐分解为若干资源约束的最小值、乘积或加权和；差异在于约束对象和时间尺度：Roofline 与 AMAT 约束存储和计算资源，Amdahl 约束并行收益，CPU 时间方程约束指令执行，BDP 与 Little 定律约束并发填充。

模型的价值在于把复杂系统压缩为可推理的变量，并据此提出可证伪的判断。模型本身不能替代测量；参数来源、工作量边界和未建模约束决定了结论的可信度。后续工作可以将同一框架扩展到动态功耗、时序、面积与良率，使性能分析与数字 IC 实现之间的对应关系更加完整。

## 参考资料

1. Samuel Williams, Andrew Waterman, David Patterson, “Roofline: An Insightful Visual Performance Model for Multicore Architectures,” Communications of the ACM, 2009. https://doi.org/10.1145/1498765.1498785
2. Gene M. Amdahl, “Validity of the Single Processor Approach to Achieving Large Scale Computing Capabilities,” AFIPS, 1967. https://doi.org/10.1145/1465482.1465560
3. John L. Gustafson, “Reevaluating Amdahl’s Law,” Communications of the ACM, 1988. https://doi.org/10.1145/42411.42415
4. John D. C. Little, “A Proof for the Queuing Formula: L = λW,” Operations Research, 1961. https://doi.org/10.1287/opre.9.3.383
5. John L. Hennessy and David A. Patterson, Computer Architecture: A Quantitative Approach, 6th edition, Morgan Kaufmann, 2019.
6. Intel, Intel 64 and IA-32 Architectures Optimization Reference Manual. https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html
7. NVIDIA, CUDA C++ Programming Guide, Performance Guidelines. https://docs.nvidia.com/cuda/cuda-c-programming-guide/

<script defer src="/js/architecture-models.js"></script>
