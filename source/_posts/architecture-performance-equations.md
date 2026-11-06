---
title: 从公式到硅片：读懂计算机体系结构里的性能模型
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
description: 用可视化和交互实验解释 Roofline、Amdahl、CPI、存储延迟与带宽等性能模型，并追踪它们如何映射到真实 CPU、GPU 与片上存储系统。
keywords: Roofline, Amdahl 定律, CPI, Little 定律, 计算机体系结构, 芯片性能
---

一颗芯片可以在规格表上拥有很高的峰值算力，跑起真实程序却不一定快。程序可能在等数据、受制于串行部分、没有足够并行任务，或被指令依赖链卡住。体系结构里的公式，正是把这些不同的限制压缩成可以推理的模型。

这篇文章不追求罗列所有曾经出现过的公式。更实用的路线是沿着一个问题逐层往下问：程序的时间花在哪里？瓶颈是哪一层？改变硬件或代码后，性能上限会怎样移动？ 我们从 Roofline、Amdahl、CPI 和存储延迟带宽关系出发，再把每个模型映射到芯片上的计算单元、缓存、内存控制器与互连。

公式描述模型边界；具体芯片还要看实测。下方交互面板里的数字是可调的教学参数；它们不会假装成某个 SKU 的规格或跑分。

<!-- more -->

## 1. 先把性能说清楚

性能最常见的两种表达是完成时间与吞吐率。对固定工作量，时间越短越好；对持续提供的工作流，单位时间完成的工作越多越好。若工作量为 $W$、运行时间为 $T$，平均吞吐就是 $W/T$。两者互为倒数只在工作量固定、测量范围一致时成立。

硬件的峰值吞吐通常由每周期可完成的操作数和时钟频率相乘得到。对一类指令：

$$P_{\text{peak}} = N_{\text{lanes}} \times O_{\text{lane/cycle}} \times f$$

这条式子能解释 SIMD/FMA 单元和频率为何会进入峰值规格，却不能推出应用性能。执行单元需要有指令可发射，操作数需要及时到达，程序也必须暴露足够的并行性。

| 模型 | 回答的问题 | 常见单位 | 芯片上的落点 |
|---|---|---|---|
| Roofline | 算力还是数据搬运限制吞吐？ | FLOP/s、Byte/s、FLOP/Byte | 向量/FMA 单元、缓存与 DRAM |
| Amdahl | 加速一个部分后，整体最多快多少？ | 无量纲加速比 | 核数扩展、专用加速器、关键路径 |
| CPI / CPU 时间方程 | 指令执行成本如何累积？ | cycle、指令、秒 | 前端、调度、执行单元、分支预测 |
| 延迟-带宽积 | 隐藏传输延迟需要多少在途数据？ | Byte、request | MSHR、load/store queue、互连 credit |
| 吞吐 / 延迟与 Little 定律 | 稳态维持吞吐需要多少并发工作？ | request、秒 | 队列、流水线、并发访存 |

## 2. Roofline：算力屋顶与带宽斜坡

Roofline 把两个上限放进同一张图。横轴是运算强度 $I$，即每从指定内存层级搬运一个 Byte，完成多少 FLOP；纵轴是可达到的浮点吞吐 $P$。简化模型为：

$$P_{\text{attainable}} \le \min(P_{\text{peak}},\; I \times B)$$

其中 $P_{\text{peak}}$ 是该精度下的计算峰值，$B$ 是指定层级的持续带宽。斜线是带宽上限，水平线是计算上限，两者交点的运算强度叫 ridge point：

$$I^* = \frac{P_{\text{peak}}}{B}$$

左边的工作负载偏 memory-bound，右边偏 compute-bound。这里的“内存”必须注明层级：L1、L2、末级缓存、HBM/DRAM 的带宽不同，Roofline 也可以分别画多级屋顶。

{% raw %}
<div class="v-figure arch-lab" id="roofline-lab">
  <div class="arch-lab-head"><div><p class="arch-kicker">INTERACTIVE MODEL · 01</p><p class="arch-title">Roofline 实验台</p><p>调节峰值算力、带宽和运算强度，观察受限上界与 ridge point 如何变化。</p></div><button type="button" class="arch-reset" data-reset="roofline">恢复示例值</button></div>
  <div class="arch-controls">
    <label>峰值算力 <output id="rf-peak-out">1.0 TFLOP/s</output><input id="rf-peak" type="range" min="0.2" max="4" step="0.1" value="1" aria-label="峰值算力，TFLOP 每秒"></label>
    <label>持续带宽 <output id="rf-bw-out">200 GB/s</output><input id="rf-bw" type="range" min="25" max="800" step="5" value="200" aria-label="持续带宽，GB 每秒"></label>
    <label>运算强度 <output id="rf-int-out">8 FLOP/Byte</output><input id="rf-int" type="range" min="0.25" max="64" step="0.25" value="8" aria-label="运算强度，FLOP 每 Byte"></label>
  </div>
  <div class="arch-plot-wrap"><svg id="rf-plot" viewBox="0 0 720 330" role="img" aria-label="Roofline 性能模型交互图"><g class="rf-grid"><path d="M75 40V270H680M75 212H680M75 154H680M75 96H680"/></g><path id="rf-band" class="rf-band"/><path id="rf-roof" class="rf-roof"/><line id="rf-ridge" class="rf-ridge" y1="40" y2="270"/><circle id="rf-dot" r="7"/><text x="375" y="318" text-anchor="middle">运算强度（FLOP/Byte，对数刻度）</text><text transform="translate(20 160) rotate(-90)" text-anchor="middle">吞吐上界（TFLOP/s，对数刻度）</text><text x="75" y="292" text-anchor="middle">0.25</text><text x="226" y="292" text-anchor="middle">1</text><text x="378" y="292" text-anchor="middle">4</text><text x="529" y="292" text-anchor="middle">16</text><text x="680" y="292" text-anchor="middle">64</text><text x="40" y="274">0.1</text><text x="40" y="216">0.3</text><text x="40" y="158">1</text><text x="40" y="100">3</text><text x="40" y="44">10</text><text id="rf-ridge-label" x="0" y="0" text-anchor="middle">ridge</text><text id="rf-point-label" x="0" y="0">workload</text></svg></div>
  <p class="arch-result" id="rf-result" aria-live="polite"></p>
  <p class="v-caption">教学模型，未对应具体芯片。实际峰值需按数据类型与可用指令计算；带宽应采用该工作负载、该内存层级的持续值，而非只抄接口标称速率。</p>
</div>
{% endraw %}

图上的竖向虚线标记 ridge point，圆点标记当前工作负载。移动圆点向右，可以代表增加数据复用、分块后更多命中缓存，或改变算法降低访存量；抬高水平屋顶则对应增加计算资源或提高该精度的执行吞吐。若圆点仍落在斜坡上，继续堆算力未必有明显收益。

### 从公式到真实芯片

- **计算峰值**：CPU 的向量 FMA 管线、GPU 的 SIMT 运算管线、矩阵乘法单元分别有不同精度和吞吐。数据类型改变，峰值可能相差很大；峰值还假设每周期都有足够独立指令。
- **带宽**：L1/L2/末级缓存、片上 SRAM、HBM/DDR 都是不同的屋顶。缓存命中率和访问合并会改变流向下一级的数据量，竞争访问和读写比例会改变持续带宽。
- **运算强度**：它不等于源代码里“运算次数除以数组大小”的比值。分母应是实际从所选层级搬运的字节数。GEMM 的分块把矩阵块留在缓存或片上 SRAM 中复用，通常可以提高相对 DRAM 的运算强度。
- **模型限制**：标准 Roofline 没有描述依赖链、分支、指令前端、同步、并行度不足和数据布局开销。扩展模型会把这些因素纳入，但不会让测量变得可有可无。

所以 Roofline 适合回答“该往哪一类瓶颈找”，不适合单独预测“这个程序一定能跑到多少”。

{% raw %}
<div class="v-figure arch-map v-chart-scroll"><p class="v-scroll-hint">左右滑动查看完整芯片结构图；键盘聚焦后可用方向键。</p><div class="v-chart-viewport" tabindex="0" role="region" aria-label="可横向滚动的芯片结构图"><svg viewBox="0 0 900 470" role="img" aria-label="性能公式在真实芯片结构上的落点"><text x="26" y="30" font-size="20" class="v-ink">同一颗芯片，四种限制同时存在</text><text x="26" y="52" font-size="12" class="v-sub">这些公式各自指向不同的资源与等待来源。</text><rect x="48" y="72" width="804" height="330" rx="16" class="am-die"/><rect x="70" y="92" width="250" height="120" rx="10" class="am-block am-cpu"/><text x="86" y="114" font-size="13" class="v-ink">CPU cluster</text><rect x="86" y="126" width="46" height="42" rx="4" class="am-core"/><rect x="140" y="126" width="46" height="42" rx="4" class="am-core"/><rect x="194" y="126" width="46" height="42" rx="4" class="am-core"/><rect x="248" y="126" width="46" height="42" rx="4" class="am-core"/><text x="86" y="196" font-size="11" class="am-tag">Amdahl · CPI · 分支与依赖</text><rect x="338" y="92" width="250" height="120" rx="10" class="am-block am-gpu"/><text x="354" y="114" font-size="13" class="v-ink">GPU / SIMT</text><rect x="354" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="386" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="418" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="450" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="482" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="514" y="128" width="24" height="24" rx="3" class="am-core"/><rect x="354" y="160" width="24" height="24" rx="3" class="am-core"/><rect x="386" y="160" width="24" height="24" rx="3" class="am-core"/><rect x="418" y="160" width="24" height="24" rx="3" class="am-core"/><rect x="450" y="160" width="24" height="24" rx="3" class="am-core"/><rect x="482" y="160" width="24" height="24" rx="3" class="am-core"/><rect x="514" y="160" width="24" height="24" rx="3" class="am-core"/><text x="354" y="196" font-size="11" class="am-tag">Roofline · 并行度 · 占用率</text><rect x="606" y="92" width="228" height="120" rx="10" class="am-block am-matrix"/><text x="622" y="114" font-size="13" class="v-ink">Matrix / Vector</text><rect x="622" y="126" width="196" height="54" fill="none" stroke="var(--chart-amber)" stroke-width="1.1" opacity=".8"/><path d="M671 126V180M720 126V180M769 126V180M622 144H818M622 162H818" fill="none" stroke="var(--chart-amber)" stroke-width=".8" opacity=".55"/><text x="622" y="196" font-size="11" class="am-tag">P peak · 数据类型 · FMA</text><rect x="70" y="228" width="360" height="58" rx="8" class="am-block"/><text x="86" y="250" font-size="13" class="v-ink">L1 / L2 / 末级缓存</text><text x="86" y="270" font-size="11" class="v-sub">命中率决定真正流向 DRAM 的字节数</text><rect x="448" y="228" width="386" height="58" rx="8" class="am-block am-mem"/><text x="464" y="250" font-size="13" class="v-ink">内存控制器 · HBM / DDR PHY</text><text x="464" y="270" font-size="11" class="v-sub">持续带宽 B · 访存延迟 L · 读写比例</text><rect x="70" y="302" width="764" height="48" rx="8" class="am-block am-noc"/><text x="86" y="324" font-size="13" class="v-ink">片上互连 NoC</text><text x="196" y="324" font-size="11" class="v-sub">队列深度 / credit / MSHR / load-store queue</text><text x="650" y="324" font-size="11" class="am-tag">Little 定律 · BDP</text><text x="70" y="378" font-size="12" class="v-sub">同一个程序会同时受多层限制；优化前先找出当前的主导项。</text></svg></div><p class="v-caption">这是逻辑示意，不按任何芯片的物理布局绘制。缓存、内存控制器与互连的具体数量和位置随产品差异很大；箭头所指的是模型最直接作用的资源类型。</p>
</div>
{% endraw %}


## 3. Amdahl 定律：局部加速的整体回报

假设原始运行时间中，有比例 $s$ 无法被某种优化加速，其余比例 $1-s$ 获得 $k$ 倍加速。整体加速比为：

$$S = \frac{1}{s + \frac{1-s}{k}}$$

即使可加速部分无限快，整体上限也只有 $1/s$。优化之前，先量清楚时间花在哪儿。

{% raw %}
<div class="v-figure arch-lab" id="amdahl-lab">
  <div class="arch-lab-head"><div><p class="arch-kicker">INTERACTIVE MODEL · 02</p><p class="arch-title">Amdahl 加速收益</p><p>拖动串行时间比例与被优化部分的加速倍数。</p></div></div>
  <div class="arch-controls arch-controls--two">
    <label>不可加速部分 <output id="am-s-out">20%</output><input id="am-s" type="range" min="0" max="0.9" step="0.01" value="0.2" aria-label="不可加速部分的时间比例"></label>
    <label>其余部分加速倍数 <output id="am-k-out">4×</output><input id="am-k" type="range" min="1" max="32" step="0.5" value="4" aria-label="可加速部分的加速倍数"></label>
  </div>
  <div class="arch-amdahl-track" aria-hidden="true"><span id="am-serial"></span><span id="am-parallel"></span></div>
  <p class="arch-result" id="am-result" aria-live="polite"></p>
  <p class="v-caption">Amdahl 的“串行部分”是对当前优化而言不能随之加速的时间，不一定等同于源代码中写成单线程的那几行。</p>
</div>
{% endraw %}

真实芯片里，增加 CPU 核心数主要加速可并行工作；锁竞争、串行阶段、内存带宽饱和和同步时间会形成剩余部分。GPU 上增加计算单元，也无法自动加速主机端准备、kernel launch、数据传输或严格串行的依赖。使用专用矩阵单元，则只有映射到它支持的运算形状和数据类型时才会提升对应那部分。

强尺度扩展下还要考虑 Gustafson 定律：若问题规模随处理器数量一起增大，固定串行比例的假设不再适用。它说明“固定工作量加速”与“固定时间完成更大工作量”是两个不同问题。

## 4. CPU 时间方程：指令、周期与频率

对一个程序，常见的 CPU 性能分解为：

$$T_{\text{CPU}} = IC \times CPI \times T_{\text{cycle}} = \frac{IC \times CPI}{f}$$

$IC$ 是动态执行的指令数，$CPI$ 是每条指令平均消耗的周期数，$f$ 是时钟频率。对一段程序，平均 CPI 可以写成各类指令比例与该类有效 CPI 的加权和；现代乱序 CPU 的实际 CPI 还受到重叠执行与停顿事件影响，因此不宜把各类指令延迟简单相加。

这条式子能把优化拆成三个方向：减少工作所需指令、改善每条指令平均所需周期、提高频率。代价和边界也各不相同。更少的指令不保证更少的周期；提高频率可能受功耗与热约束；降低某个指令延迟，也可能被其他阶段的瓶颈遮住。

CPI 会随程序和微架构变化。 同一颗 CPU 跑两个程序、甚至同一个程序换一组输入，都可能得到不同 CPI。程序的分支行为、缓存命中、依赖链和可并行指令数量都会改变它。IPC 常被写成 CPI 的倒数，但只有在相同计数范围和相同定义下比较才有意义。

在处理器内部，这个乘积对应一条动态路径：取指与译码供给指令，寄存器重命名和调度窗口寻找可执行操作，执行端口完成运算，缓存与加载/存储单元提供数据，分支预测减少前端断流。乱序执行试图把彼此独立的指令重叠起来；数据依赖链无法凭空并行。

对加速器，单一 CPI 往往不如每周期完成多少向量、矩阵 tile 或事务来得直观。选指标时应贴近硬件实际执行粒度。

## 5. 延迟和带宽：管道里需要多少数据？

带宽描述单位时间可以通过多少数据，延迟描述一次传输或访问要等多久。带宽和延迟是两项独立规格。延迟为 $L$ 秒、目标吞吐为 $B$ Byte/s 时，要让链路保持满载，平均需要在途的数据量：

$$D_{\text{in-flight}} = B \times L$$

这是延迟-带宽积（Bandwidth-Delay Product, BDP）。例如持续带宽 200 GB/s、往返延迟 100 ns，对应 20 KB 的在途数据。单位检查很直接：Byte/s × s = Byte。

它解释了为什么“带宽很高”仍需要足够多的并发请求。访存控制器、缓存 miss 状态、load/store queue 或互连 credit 若容纳不了足够多的请求，链路就无法持续满载。

### Little 定律：队列中有多少工作

稳定系统中，平均在系统内的工作量 $N$ 等于吞吐率 $\lambda$ 乘平均停留时间 $W$：

$$N = \lambda W$$

对内存事务，若平均每秒完成 $\lambda$ 个请求、每个请求平均停留 $W$ 秒，系统平均就需要容纳 $N$ 个在途请求。它与 BDP 讲的是相近的管线填充问题，但 Little 定律适用于一般稳定队列；BDP 常用字节数来表达链路填充量。

真实芯片会在有限资源处停住：MSHR 数量限制同时追踪的 cache miss，load queue 受限于可保留的访存操作，互连 buffer/credit 限制飞行中的 flit。增大这些结构可能提升并发，却也增加面积、功耗和验证复杂度；依赖下一次地址的指针追逐也无法轻易产生大量并发请求。

{% raw %}
<div class="v-figure arch-lab" id="memory-lab">
  <div class="arch-lab-head"><div><p class="arch-kicker">INTERACTIVE MODEL · 03</p><p class="arch-title">在途请求够不够？</p><p>调节带宽、延迟、在途请求数与每次请求的大小，观察结构容量如何限制可达带宽。</p></div></div>
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


## 6. 一个公式解释不了的地方

公式把复杂系统压成几个变量，优点是能快速定位量级与上限，代价是忽略了一些细节。读模型时，建议顺手追问四件事：

1. **工作量与边界是什么？** 单核还是整机，kernel 还是完整应用，缓存是否预热？
2. **单位和计数口径一致吗？** FLOP 还是 MAC，十进制 GB/s 还是二进制 GiB/s，延迟是单程还是往返？
3. **参数来自哪里？** 架构手册峰值、芯片规格、微基准持续值，还是应用端实测？
4. **哪些限制未入模？** 功耗/频率调节、并行度、数据布局、同步、操作系统和设备间通信。

对于真实芯片分析，先用公式提出可证伪的判断，再用性能计数器和微基准验证。若 Roofline 判断受限于 DRAM，应查看实际读写流量、缓存命中和带宽；若 Amdahl 估计串行段占比高，应逐阶段计时；若 CPI 上升，进一步拆解前端、后端、分支和内存停顿，不要把 CPI 本身当作原因。

## 7. 从问题映射到结构

| 观察到的现象 | 可先检查的模型 | 可能的代码方向 | 可能的硬件结构 |
|---|---|---|---|
| 算力单元利用率低、DRAM 流量高 | Roofline / 运算强度 | 分块、数据复用、压缩传输 | 缓存、HBM 带宽、片上 SRAM |
| 增加核心后收益迅速变小 | Amdahl / 强弱扩展 | 减少串行阶段与同步 | 核数、互连、共享资源 |
| IPC 下降或 CPI 上升 | CPU 时间方程与停顿分解 | 改善局部性、依赖和分支 | 前端、ROB、执行端口、缓存 |
| 带宽低于预期但延迟不变 | BDP / Little 定律 | 提高独立访存并发 | MSHR、队列深度、credit |
| 小工作负载启动开销占比高 | 固定开销模型 | 合并任务、减少 launch | 命令处理器、驱动、调度器 |

最后一行可以写成 $T = T_{\text{fixed}} + T_{\text{work}}$。当工作量很小时，固定开销主导；把执行单元峰值提高十倍，对这类场景几乎没有帮助。这也是为什么性能优化必须从端到端时间开始，不要从规格表上最高的数字开始。

## 8. 记住模型各自的边界

- **Roofline** 看计算与数据搬运的上限关系；不负责解释所有低于上限的原因。
- **Amdahl** 看固定工作量下的局部加速回报；并行问题规模扩大时要换一种扩展模型。
- **CPU 时间方程** 分解指令数、周期数和频率；CPI 是程序与微架构共同决定的结果。
- **BDP 与 Little 定律** 估算维持目标吞吐所需的在途数据或并发工作；有足够队列不代表请求之间不存在依赖。

把它们连起来，就得到一条实用分析顺序：先界定工作和测量口径，再看 Roofline 判断瓶颈类别；用 Amdahl 估算优化收益；通过周期/吞吐计数定位微架构停顿；最后用 BDP 和 Little 定律检查并发资源是否足以喂饱数据通路。模型之间互相补充，但都需要实测闭环。

## 参考资料

1. Samuel Williams, Andrew Waterman, David Patterson, “Roofline: An Insightful Visual Performance Model for Multicore Architectures,” Communications of the ACM, 2009. https://doi.org/10.1145/1498765.1498785
2. Gene M. Amdahl, “Validity of the Single Processor Approach to Achieving Large Scale Computing Capabilities,” AFIPS, 1967. https://doi.org/10.1145/1465482.1465560
3. John L. Gustafson, “Reevaluating Amdahl’s Law,” Communications of the ACM, 1988. https://doi.org/10.1145/42411.42415
4. John D. C. Little, “A Proof for the Queuing Formula: L = λW,” Operations Research, 1961. https://doi.org/10.1287/opre.9.3.383
5. John L. Hennessy and David A. Patterson, Computer Architecture: A Quantitative Approach, 6th edition, Morgan Kaufmann, 2019.
6. Intel, Intel 64 and IA-32 Architectures Optimization Reference Manual. https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html
7. NVIDIA, CUDA C++ Programming Guide, Performance Guidelines. https://docs.nvidia.com/cuda/cuda-c-programming-guide/

<script>
(function(){
  var $=function(id){return document.getElementById(id)};
  var peak=$('rf-peak'), bw=$('rf-bw'), intensity=$('rf-int');
  function roof(){
    if(!peak||!bw||!intensity)return;
    var p=+peak.value, b=+bw.value, i=+intensity.value, ridge=p*1000/b;
    var x=function(v){return 75+(Math.log2(v/.25)/8)*605};
    var y=function(v){return 270-(Math.log10(v/.1)/2)*230};
    var roof=$('rf-roof'), band=$('rf-band'), dot=$('rf-dot');
    var knee=Math.max(.25,Math.min(64,ridge));
    roof.setAttribute('d','M'+x(.25)+' '+y(Math.min(10,.25*b/1000))+' L'+x(knee)+' '+y(Math.min(10,knee*b/1000))+' L'+x(64)+' '+y(Math.min(p,64*b/1000)));
    band.setAttribute('d','M'+x(.25)+' 270 L'+x(.25)+' '+y(Math.min(10,.25*b/1000))+' L'+x(knee)+' '+y(Math.min(10,knee*b/1000))+' L'+x(knee)+' 270 Z');
    $('rf-ridge').setAttribute('x1',x(knee));$('rf-ridge').setAttribute('x2',x(knee));
    $('rf-ridge-label').setAttribute('x',Math.min(650,Math.max(110,x(knee))));$('rf-ridge-label').setAttribute('y',52);$('rf-ridge-label').textContent='ridge '+ridge.toFixed(1)+' FLOP/Byte';
    var perf=Math.min(p,i*b/1000);dot.setAttribute('cx',x(i));dot.setAttribute('cy',y(Math.max(.1,Math.min(10,perf))));
    $('rf-point-label').setAttribute('x',Math.min(600,x(i)+10));$('rf-point-label').setAttribute('y',y(Math.max(.1,Math.min(10,perf)))-12);$('rf-point-label').textContent=perf.toFixed(2)+' TFLOP/s 上界';
    $('rf-peak-out').textContent=p.toFixed(1)+' TFLOP/s';$('rf-bw-out').textContent=b+' GB/s';$('rf-int-out').textContent=i.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')+' FLOP/Byte';
    $('rf-result').textContent='当前工作负载的 Roofline 上界约为 '+perf.toFixed(2)+' TFLOP/s，受'+(i<ridge?'带宽':'计算')+'屋顶限制。ridge point ≈ '+ridge.toFixed(1)+' FLOP/Byte。';
  }
  [peak,bw,intensity].forEach(function(el){el&&el.addEventListener('input',roof)});
  var ams=$('am-s'), amk=$('am-k');
  function amdahl(){if(!ams||!amk)return;var s=+ams.value,k=+amk.value,sp=1/(s+(1-s)/k),limit=s?1/s:Infinity;
    $('am-s-out').textContent=Math.round(s*100)+'%';$('am-k-out').textContent=k+'×';
    $('am-serial').style.flexBasis=(s*100)+'%';$('am-parallel').style.flexBasis=((1-s)*100)+'%';
    $('am-result').textContent='整体加速比约 '+sp.toFixed(2)+'×；即使可加速部分无限快，上限仍是 '+(isFinite(limit)?limit.toFixed(2)+'×':'无限大')+'。';
  }
  [ams,amk].forEach(function(el){el&&el.addEventListener('input',amdahl)});
  document.querySelectorAll('[data-reset="roofline"]').forEach(function(button){button.addEventListener('click',function(){peak.value=1;bw.value=200;intensity.value=8;roof()})});
  var mb=$('mem-bw'), ml=$('mem-lat'), mn=$('mem-n'), ms=$('mem-size');
  function mem(){
    if(!mb||!ml||!mn||!ms)return;
    var B=+mb.value,L=+ml.value,N=+mn.value,S=+ms.value;
    var bdp=B*L, have=N*S, ach=Math.min(B,N*S/L), util=B?ach/B*100:0;
    var fmt=function(v){return v>=1024?(v/1024).toFixed(1)+' KB':v.toFixed(0)+' B'};
    $('mem-bw-out').textContent=B+' GB/s';
    $('mem-lat-out').textContent=L+' ns';
    $('mem-n-out').textContent=N;
    $('mem-size-out').textContent=S+' B';
    $('mem-bdp-bar').style.width='100%';
    $('mem-have-bar').style.width=Math.min(100,have/bdp*100)+'%';
    $('mem-bdp-out').textContent=fmt(bdp);
    $('mem-have-out').textContent=fmt(have);
    $('mem-result').textContent='保持 '+B+' GB/s 需要约 '+fmt(bdp)+' 在途；当前 '+N+' 个请求提供 '+fmt(have)+'，可达带宽约 '+ach.toFixed(1)+' GB/s（'+util.toFixed(0)+'%）。'+(have<bdp?'增加在途请求或每次请求的字节数，才可能填满这条链路。':'在途数据已足够，继续增加并发不会突破带宽上限。');
  }
  [mb,ml,mn,ms].forEach(function(el){el&&el.addEventListener('input',mem)});
  mem();
  roof();amdahl();
})();
</script>
