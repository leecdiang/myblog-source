---
lang: zh-CN
title: "为什么我觉得 X86 指令集 就是一坨狗屎"
slug: why-x86-is-a-mess
permalink: 2026/11/04/why-x86-is-a-mess/
date: 2026-11-04 18:30:00
updated: 2026-11-04 18:30:00
categories:
  - 计算机体系结构
tags:
  - x86
  - ARM
  - RISC-V
  - 指令集
  - 计算机体系结构
description: "从不规则指令编码、历史兼容性和 x86S 提案的搁置，谈 x86 的真实工程代价，以及世界转向多架构的可能。"
etoc: true
mathjax: true
---

{% raw %}
<aside class="article-lead">
<p>假如你接手了一个迭代四十多年的 RTL 仓库，每次升级都不敢删除旧逻辑，状态机、旁路条件和兼容分支越堆越多，你会怎么评价它？</p>
<p>我大概会说：这玩意儿早该重构了。</p>
</aside>
{% endraw %}

x86 从 1978 年的 Intel 8086 一路走到 PC、服务器和工作站，软件生态越成功，架构就越难重构。今天的高性能 x86 芯片有宽大的乱序后端、复杂的分支预测、向量计算和先进封装，早已不是当年那颗处理器。但新设计仍须兑现那份不断续写的兼容契约。[S01](#x86-ref-S01) [S05](#x86-ref-S05)

Intel 也试过删减它。2023 年提出的 x86S 后来停止推进；2024 年，Intel、AMD 和产业伙伴又成立 x86 生态咨询组，协商 ISA 的后续发展。连精简架构这件事，都得把生态拉到一起谈。[S05](#x86-ref-S05) [S06](#x86-ref-S06)

我佩服把 x86 做快的工程师。标题里骂的，是每一代新设计都得背上旧兼容承诺这件事。它到底耗掉多少工程资源？已经有更简单替代办法的约束，又为什么迟迟退不掉？

我说 x86 落后，指的是它让今天的设计者仍须兑现几十年前的承诺。最直观的例子就在按下电源键之后。现代系统最终要在 64 位模式下运行，处理器却得先按 8086 的规矩醒来，再靠启动代码切过去。Intel 提议过让新处理器直接从 64 位状态启动，后来根据生态反馈收回了方案。[S05](#x86-ref-S05)

<!-- more -->

{% raw %}
<div class="v-figure v-chart-scroll"><p class="v-scroll-hint">左右滑动查看完整图表；键盘聚焦后可用方向键。</p><div class="v-chart-viewport" tabindex="0" role="region" aria-label="现有 Intel 64 和 x86S 提案的启动路径"><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="现有 Intel 64 和 x86S 提案的启动路径" viewBox="0 0 800 350"><text x="24" y="36" font-size="25" class="v-ink">开机之后，谁还需要旧模式？</text><text x="24" y="68" font-size="15" class="v-sub">同一个目标：让现代 64 位系统开始运行。只画复位与模式切换。</text><text x="24" y="102" font-size="17" class="v-ink">现有 Intel 64</text><rect x="24" y="119" width="190" height="58" rx="8" fill="var(--surface-card)" stroke="var(--chart-amber)"/><text x="36" y="154.0" font-size="17" class="v-ink">8086 式复位状态</text><text x="225" y="154" font-size="24" class="v-sub">→</text><rect x="256" y="119" width="260" height="58" rx="8" fill="var(--surface-card)" stroke="var(--chart-amber)"/><text x="268" y="154.0" font-size="17" class="v-ink">启动代码切换模式</text><text x="527" y="154" font-size="24" class="v-sub">→</text><rect x="558" y="119" width="164" height="58" rx="8" fill="var(--surface-card)" stroke="var(--chart-amber)"/><text x="570" y="154.0" font-size="17" class="v-ink">64 位运行</text><text x="24" y="215" font-size="17" class="v-ink">x86S 提案</text><rect x="24" y="232" width="465" height="58" rx="8" fill="var(--surface-card)" stroke="var(--chart-teal)"/><text x="36" y="267.0" font-size="17" class="v-ink">直接进入 64 位复位状态</text><text x="500" y="267" font-size="24" class="v-sub">→</text><rect x="531" y="232" width="164" height="58" rx="8" fill="var(--surface-card)" stroke="var(--chart-teal)"/><text x="543" y="267.0" font-size="17" class="v-ink">64 位运行</text><text x="24" y="326" font-size="16" class="v-sub">提案仍保留 64 位系统运行 32 位应用的能力。Intel 后来停止推进 x86S。</text></svg></div><p class="v-caption">图 1 · Intel 提案给出了一个具体的简化机会：从 64 位状态复位，省去进入 64 位模式的过渡步骤。下排是提案。<a href="#x86-ref-S05">[S05]</a></p></div>
{% endraw %}

## 从四个字节开始，理解 x86 为什么难伺候

x86 译码有一层很直接的麻烦：想知道下一条指令从哪里开始，得先解析当前这一条。

x86-64 的指令可以长 1 到 15 Byte。它可能带有传统前缀、REX 前缀，也可能采用 VEX、EVEX 等扩展编码；寻址与操作数又可能需要 ModR/M、SIB、位移量和立即数。APX 还引入了 REX2。字段的位置和长度由指令类别与执行模式决定。[S02](#x86-ref-S02)

AArch64 的 A64 指令则统一是 32 bit，也就是 4 Byte。处理器沿着指令流取出四个字节，天然就知道下一条从哪里开始。RISC-V 的基础指令为 32 bit，常见的 RV64GC 又引入 16 bit 压缩指令：需要判断 2 Byte 还是 4 Byte，但它从一开始就为这种长度变化留好了编码结构。严格说，RISC-V 规范还允许更长的格式，不能把整个 RISC-V 家族说成永远只有两种长度。[S03](#x86-ref-S03) [S04](#x86-ref-S04) [S18](#x86-ref-S18)

{% raw %}
<div class="v-figure v-chart-scroll">
<p class="v-scroll-hint">左右滑动查看完整图表；键盘聚焦后可用方向键。</p>
<div class="v-chart-viewport" tabindex="0" role="region" aria-label="x86-64、A64 和 RV64GC 的指令编码长度范围">
<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="x86-64、A64 和 RV64GC 的指令编码长度范围" viewBox="0 0 800 450">
<text x="25" y="38" font-size="23" class="v-ink" text-anchor="start" font-weight="650">指令边界有多难找？</text><text x="26" y="65" font-size="13" class="v-sub" text-anchor="start">按公开 ISA 规范绘制；字节长度不能直接当作硬件面积。</text><path d="M176.0 107 V338" stroke="var(--divider)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 6"/><text x="176.0" y="365" font-size="12" class="v-muted" text-anchor="middle">0</text><path d="M248.2 107 V338" stroke="var(--divider)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 6"/><text x="248.2" y="365" font-size="12" class="v-muted" text-anchor="middle">2</text><path d="M320.5 107 V338" stroke="var(--divider)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 6"/><text x="320.5" y="365" font-size="12" class="v-muted" text-anchor="middle">4</text><path d="M392.8 107 V338" stroke="var(--divider)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 6"/><text x="392.8" y="365" font-size="12" class="v-muted" text-anchor="middle">6</text><path d="M465.0 107 V338" stroke="var(--divider)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 6"/><text x="465.0" y="365" font-size="12" class="v-muted" text-anchor="middle">8</text><path d="M537.2 107 V338" stroke="var(--divider)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 6"/><text x="537.2" y="365" font-size="12" class="v-muted" text-anchor="middle">10</text><path d="M609.5 107 V338" stroke="var(--divider)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 6"/><text x="609.5" y="365" font-size="12" class="v-muted" text-anchor="middle">12</text><path d="M681.8 107 V338" stroke="var(--divider)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 6"/><text x="681.8" y="365" font-size="12" class="v-muted" text-anchor="middle">14</text><path d="M754.0 107 V338" stroke="var(--divider)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 6"/><text x="754.0" y="365" font-size="12" class="v-muted" text-anchor="middle">16</text><text x="466" y="395" font-size="14" class="v-sub" text-anchor="middle">单条机器指令的编码长度（Byte）</text><text x="24" y="151" font-size="16" class="v-ink" text-anchor="start">x86-64</text><text x="24" y="238" font-size="16" class="v-ink" text-anchor="start">AArch64 / A64</text><text x="24" y="324" font-size="16" class="v-ink" text-anchor="start">RISC-V · RV64GC</text><path d="M212.1 144 H717.9" stroke="var(--chart-red)" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="212.125" cy="144" r="6" fill="var(--chart-red)"/><circle cx="717.875" cy="144" r="6" fill="var(--chart-red)"/><text x="209.125" y="119" font-size="13" class="v-sub" text-anchor="middle">1 B</text><text x="717.875" y="119" font-size="13" class="v-sub" text-anchor="middle">15 B</text><path d="M312.5 229 H328.5" stroke="var(--chart-blue)" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="320.5" cy="229" r="7" fill="var(--chart-blue)"/><text x="320.5" y="206" font-size="13" class="v-sub" text-anchor="middle">固定 4 B</text><circle cx="248.25" cy="316" r="7" fill="var(--chart-teal)"/><circle cx="320.5" cy="316" r="7" fill="var(--chart-teal)"/><path d="M248.2 316 H320.5" stroke="var(--chart-teal)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 6"/><text x="248.25" y="293" font-size="13" class="v-sub" text-anchor="middle">2 B</text><text x="320.5" y="293" font-size="13" class="v-sub" text-anchor="middle">4 B</text><text x="26" y="424" font-size="12" class="v-sub" text-anchor="start">RV64GC 以 16/32 bit 常见指令为主；RISC-V 通用编码机制还预留更长格式。</text>
</svg>
</div>
<p class="v-caption">图 2 · 按 Intel XED、Arm 官方文档与 RISC-V 规范绘制的指令长度。x86 为定义的范围，RISC-V 显示 RV64GC 常见的 2/4 Byte，并不表示整体复杂度倍数。<a href="#x86-ref-S02">[S02]</a> <a href="#x86-ref-S03">[S03]</a> <a href="#x86-ref-S18">[S18]</a></p>
</div>
{% endraw %}

图里比较的是指令边界规则。A64 的定长编码直接给出边界，x86 则要一并解释长度、前缀和操作数。不能拿 15 Byte 对 4 Byte，就算出解码器门数或功耗的比例。

前端从缓存取回一批字节后，要先划分指令边界，处理跨界的指令，再解释编码和操作数。前端越宽，同时处理这些不规则边界的压力就越大。长度预译码、复杂解码器、微操作缓存能缓解问题，各家还有自己的实现技巧。不过，这些额外机制也都要设计、验证和维护。[S02](#x86-ref-S02)

### 四个字节里装了什么

给 `p` 指向的 64 位整数加一就能看到这种取舍。这里比较单线程下的普通读改写，不涉及并发原子性，也不要求最后的条件标志位相同。

```c
#include <stdint.h>
void increment(uint64_t *p) {
    *p += 1;
}
```

x86-64 可以用一条合法的机器指令完成这件事：

```asm
add QWORD PTR [rdi], 1   ; 48 83 07 01
```

我用 GNU `as` 和 `objdump` 核对了这组机器码。它一共四个字节，已经把内存寻址、读改写操作和立即数塞进去了。但 `48` 是 REX.W，`83` 是操作码，`07` 是 ModR/M，`01` 才是真正要加的数。处理器必须知道这些字段如何相互约束，才能弄明白这条指令要求做什么。

{% raw %}
<div class="v-figure v-chart-scroll">
<p class="v-scroll-hint">左右滑动查看完整图表；键盘聚焦后可用方向键。</p>
<div class="v-chart-viewport" tabindex="0" role="region" aria-label="一条x86-64内存加法的四个编码字节">
<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="一条x86-64内存加法的四个编码字节" viewBox="0 0 800 445">
<text x="26" y="37" font-size="22" class="v-ink" text-anchor="start" font-weight="650">一条 64 位内存加法，里面藏着什么？</text><text x="26" y="63" font-size="12" class="v-sub" text-anchor="start">手工挑选的一条合法 x86-64 指令；不是编译器对 C 函数的唯一输出。</text><rect x="24" y="96" width="171" height="124" rx="10" fill="var(--surface-card)" stroke="var(--chart-teal)" stroke-width="1.6"/><text x="109.5" y="136" font-size="30" class="v-ink" text-anchor="middle" font-weight="650">48</text><text x="109.5" y="168" font-size="15" class="v-sub" text-anchor="middle">REX.W</text><text x="109.5" y="198" font-size="12" class="v-sub" text-anchor="middle">操作数 64 bit</text><rect x="220" y="96" width="171" height="124" rx="10" fill="var(--surface-card)" stroke="var(--chart-blue)" stroke-width="1.6"/><text x="305.5" y="136" font-size="30" class="v-ink" text-anchor="middle" font-weight="650">83</text><text x="305.5" y="168" font-size="15" class="v-sub" text-anchor="middle">Opcode</text><text x="305.5" y="198" font-size="12" class="v-sub" text-anchor="middle">组操作码</text><rect x="416" y="96" width="171" height="124" rx="10" fill="var(--surface-card)" stroke="var(--chart-amber)" stroke-width="1.6"/><text x="501.5" y="136" font-size="30" class="v-ink" text-anchor="middle" font-weight="650">07</text><text x="501.5" y="168" font-size="15" class="v-sub" text-anchor="middle">ModR/M</text><text x="501.5" y="198" font-size="12" class="v-sub" text-anchor="middle">[rdi] 与 ADD</text><rect x="612" y="96" width="171" height="124" rx="10" fill="var(--surface-card)" stroke="var(--chart-red)" stroke-width="1.6"/><text x="697.5" y="136" font-size="30" class="v-ink" text-anchor="middle" font-weight="650">01</text><text x="697.5" y="168" font-size="15" class="v-sub" text-anchor="middle">imm8</text><text x="697.5" y="198" font-size="12" class="v-sub" text-anchor="middle">立即数 +1</text><text x="25" y="259" font-size="20" class="v-ink" text-anchor="start" font-weight="600">ADD QWORD PTR [RDI], 1</text><text x="25" y="291" font-size="14" class="v-sub" text-anchor="start">机器码：48 83 07 01 · 合计 4 Byte</text><path d="M25 320 H772" stroke="var(--divider)" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="25" y="359" font-size="15" class="v-ink" text-anchor="start">真实的 x86 编码还可能涉及：</text><text x="25" y="386" font-size="13" class="v-sub" text-anchor="start">Legacy prefix / REX2 / VEX / EVEX · ModR/M · SIB · displacement · immediate</text><text x="25" y="418" font-size="13" class="v-sub" text-anchor="start">字段是否存在、占几字节，取决于具体指令、寻址方式和模式。</text>
</svg>
</div>
<p class="v-caption">图 3 · <code>48 83 07 01</code> 在 GNU as / objdump（x86-64）中核对。标记了本例实际出现的编码字段；其他指令可以有更多字段。<a href="#x86-ref-S02">[S02]</a></p>
</div>
{% endraw %}

同一操作若用 A64 的普通 load/store 指令表达，可以写成：

```asm
ldr x8, [x0]
add x8, x8, #1
str x8, [x0]
```

RISC-V RV64I 也很直白：

```asm
ld   t0, 0(a0)
addi t0, t0, 1
sd   t0, 0(a0)
```

这个例子里，x86 的代码确实紧凑：一条、四字节；A64 和 RV64I 的写法都是三条基础指令、十二字节。真实编译结果会受上下文影响，RISC-V 压缩扩展也可能改变字节数。这还说明不了谁执行得快，但把 CISC 的一项收益摆出来了：复杂的机器语义，可以换来紧凑的代码。

而且，x86 的一条机器指令并不保证在核心内部只是一项操作。复杂的内存操作可能被拆解成加载、运算、存储相关的内部操作。不同微架构如何拆解、融合、执行，没有统一答案。A64 和 RISC-V 的高性能核心同样可能采用内部操作、投机执行和复杂调度。[S10](#x86-ref-S10)

## 麻烦不只在译码器，还有那些舍不得删的历史

如果只有变长编码，我还不至于用这个标题。更让我介意的，是 8086、286、386 留下的运行模式与架构状态，到今天仍要逐一兑现。

早年的 16 位实模式、分段寻址、保护模式、32 位兼容性，再到后来的 x86-64 long mode，让 x86 形成了一张层层叠加的历史地图。x87 浮点栈、各代 SIMD 扩展、不同的前缀语义，又让这张地图不断向外扩张。注意，这不等于“Windows 11 现在还可以直接运行所有 DOS 程序”：操作系统能运行什么，与硬件保留了哪些历史机制，是两回事。[S05](#x86-ref-S05)

{% raw %}
<div class="v-figure v-chart-scroll">
<p class="v-scroll-hint">左右滑动查看完整图表；键盘聚焦后可用方向键。</p>
<div class="v-chart-viewport" tabindex="0" role="region" aria-label="x86从8086到Intel停止推进x86S的时间线">
<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="x86从8086到Intel停止推进x86S的时间线" viewBox="0 0 800 437">
<text x="24" y="39" font-size="21" class="v-ink" text-anchor="start" font-weight="650">半个世纪里，x86 是怎样长成现在这样的</text><text x="24" y="66" font-size="12" class="v-sub" text-anchor="start">架构与生态事件时间线；只选与兼容性讨论有关的节点。</text><path d="M70 241 H748" stroke="var(--chart-blue)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="70" cy="241" r="7" fill="var(--chart-teal)"/><path d="M70 236 V181" stroke="var(--chart-teal)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="70" y="120" font-size="16" class="v-ink" text-anchor="middle" font-weight="600">1978</text><text x="70" y="144" font-size="14" class="v-sub" text-anchor="middle">8086</text><text x="70" y="164" font-size="12" class="v-sub" text-anchor="middle">16 位起点</text><circle cx="235" cy="241" r="7" fill="var(--chart-teal)"/><path d="M235 248 V288" stroke="var(--chart-teal)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="235" y="314" font-size="16" class="v-ink" text-anchor="middle" font-weight="600">1985</text><text x="235" y="337" font-size="14" class="v-sub" text-anchor="middle">80386</text><text x="235" y="358" font-size="12" class="v-sub" text-anchor="middle">32 位扩展</text><circle cx="407" cy="241" r="7" fill="var(--chart-teal)"/><path d="M407 236 V181" stroke="var(--chart-teal)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="407" y="120" font-size="16" class="v-ink" text-anchor="middle" font-weight="600">2003</text><text x="407" y="144" font-size="14" class="v-sub" text-anchor="middle">AMD64</text><text x="407" y="164" font-size="12" class="v-sub" text-anchor="middle">x86-64 扩展</text><circle cx="580" cy="241" r="7" fill="var(--chart-teal)"/><path d="M580 248 V288" stroke="var(--chart-teal)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="580" y="314" font-size="16" class="v-ink" text-anchor="middle" font-weight="600">2023</text><text x="580" y="337" font-size="14" class="v-sub" text-anchor="middle">x86S</text><text x="580" y="358" font-size="12" class="v-sub" text-anchor="middle">Intel 提案</text><circle cx="748" cy="241" r="7" fill="var(--chart-red)"/><path d="M748 236 V181" stroke="var(--chart-teal)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="748" y="120" font-size="16" class="v-ink" text-anchor="middle" font-weight="600">2024</text><text x="748" y="144" font-size="14" class="v-sub" text-anchor="middle">x86S</text><text x="748" y="164" font-size="12" class="v-sub" text-anchor="middle">不再推进</text><text x="24" y="399" font-size="13" class="v-sub" text-anchor="start">2024：Intel / AMD 成立 x86 生态咨询组。节点等距排列，不按时间间隔缩放。</text>
</svg>
</div>
<p class="v-caption">图 4 · 选取 8086、386、AMD64 与 x86S 的主要历史节点。为保证可读性，节点等间距排列，不按真实年份间隔缩放。<a href="#x86-ref-S16">[S16]</a> <a href="#x86-ref-S15">[S15]</a> <a href="#x86-ref-S05">[S05]</a></p>
</div>
{% endraw %}

Intel 当年提出 x86S，理由已经够说明问题了：64 位操作系统成为主流后，一部分遗留模式在现代系统中几乎只用于启动过渡，值得考虑移除。它的草案想删掉部分 16/32 位特权与运行模式，同时**保留 long mode 下的 32 位应用兼容子模式**。也就是说，Intel 提议的都不是“立刻砸碎全部旧软件”，而是一次相当克制的清理。[S05](#x86-ref-S05)

可连这一步都没走成。Intel 最终宣布不继续推进 x86S，并强调继续维护软件兼容性。大约同一阶段，Intel、AMD 和产业伙伴开始通过 x86 生态咨询组讨论更一致的架构接口。[S05](#x86-ref-S05) [S06](#x86-ref-S06)

删除功能不是只改 RTL。固件、企业虚拟化环境、依赖老二进制的业务，都可能还在使用它。厂商卖的是能接住这些软件的芯片，不能因为内部设计想简化，就单方面撤销外部承诺。

清掉仓库里的死逻辑容易一些；证明整个软件生态都不再依赖某个行为，困难得多。

## Intel 和 AMD 到底为这套包袱花了多少钱？

维护兼容性一年花多少钱？两家的年报只能给出很粗的边界。

Intel 的 2025 年报写明，当年的研发费用为 **138 亿美元**；AMD 的同期研发费用为 **80.91 亿美元**。加起来约 **218.91 亿美元**。这笔钱涵盖了制程、封装、CPU、GPU、AI 加速器、FPGA、软件以及其他研究方向。财报没有把“维护 x86 旧模式、旧指令和相关验证”单独拆出来。[S07](#x86-ref-S07) [S08](#x86-ref-S08)

{% raw %}
<div class="v-figure v-chart-scroll"><p class="v-scroll-hint">左右滑动查看完整图表；键盘聚焦后可用方向键。</p><div class="v-chart-viewport" tabindex="0" role="region" aria-label="公司总研发费用与未披露的兼容成本"><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="公司总研发费用与未披露的兼容成本" viewBox="0 0 800 285"><text x="24" y="38" font-size="25" class="v-ink">财报能回答哪一栏？</text><text x="24" y="70" font-size="15" class="v-sub">2025 财年，单位：十亿美元</text><text x="24" y="126" font-size="17" class="v-sub">公司</text><text x="185" y="126" font-size="17" class="v-sub">公司总研发费用</text><text x="430" y="126" font-size="17" class="v-sub">其中：维护 x86 兼容性</text><path d="M24 147 L770 147" stroke="var(--divider)" stroke-width="2"/><text x="24" y="184" font-size="22" class="v-ink">Intel</text><text x="185" y="184" font-size="24" class="v-ink">13.8</text><text x="430" y="184" font-size="22" class="v-ink">未单独披露</text><path d="M24 212 L770 212" stroke="var(--divider)" stroke-width="2"/><text x="24" y="249" font-size="22" class="v-ink">AMD</text><text x="185" y="249" font-size="24" class="v-ink">8.091</text><text x="430" y="249" font-size="22" class="v-ink">未单独披露</text></svg></div><p class="v-caption">图 5 · 财报能给出左栏金额。右栏缺少单独披露，无法据此估算兼容成本或潜在节省额。<a href="#x86-ref-S07">[S07]</a> <a href="#x86-ref-S08">[S08]</a></p></div>
{% endraw %}

所以我不会拿这约 219 亿美元当作“x86 的浪费”。Intel 的工艺节点和晶圆厂投入，AMD 的 GPU、AI 与软件投入，都不能算到 ISA 兼容性的账上。

公开资料虽然算不出总价，却能看出工作落在哪里：

- **指令前端。** 处理变长指令、前缀、跨界和罕见编码，还要在高吞吐、低延迟与低功耗之间做设计选择。
- **功能验证。** 旧模式、异常、特权切换、虚拟化、指令扩展之间的交互，需要规格、测试与回归；软件可以观察到的行为，不能随便改。
- **固件与操作系统。** 启动路径、特性枚举、微码更新、ABI 及虚拟化兼容，都需要厂商和系统软件合作。
- **产品迭代。** 一部分工程人力持续用于确保“旧程序还是对的”，而不是完全投入新指令、新执行模型或更简单的硬件接口。

这些成本有具体的工程内容，公开信息却不足以估出可信总额。换用 A64 也仍需要微架构、工具链、验证和操作系统团队，原有前端成本不会因此全部省掉。

### 功耗上倒是有一份值得看的实验

2016 年的 USENIX CoolDC 论文试着专门激活 x86-64 的解码路径。在微基准超出已解码指令缓存容量的条件下，作者通过封装 RAPL 功耗测量与回归模型，估计解码器消耗了封装功耗的 **3%–10%**。[S09](#x86-ref-S09)

{% raw %}
<div class="v-figure v-chart-scroll">
<p class="v-scroll-hint">左右滑动查看完整图表；键盘聚焦后可用方向键。</p>
<div class="v-chart-viewport" tabindex="0" role="region" aria-label="2016年解码器在特定微基准中占封装功耗3到10个百分点的估计">
<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="2016年解码器在特定微基准中占封装功耗3到10个百分点的估计" viewBox="0 0 800 438">
<text x="24" y="39" font-size="21" class="v-ink" text-anchor="start" font-weight="650">x86 解码器到底吃多少电？有一份实测</text><text x="24" y="66" font-size="12" class="v-sub" text-anchor="start">USENIX CoolDC 2016：针对解码路径的微基准与 RAPL 回归估计。</text><text x="24" y="122" font-size="14" class="v-sub" text-anchor="start">0%</text><text x="704" y="122" font-size="14" class="v-sub" text-anchor="start">100%</text><path d="M44.0 151 V256" stroke="var(--divider)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 5"/><text x="44.0" y="278" font-size="11" class="v-muted" text-anchor="middle">0</text><path d="M115.0 151 V256" stroke="var(--divider)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 5"/><text x="115.0" y="278" font-size="11" class="v-muted" text-anchor="middle">10</text><path d="M186.0 151 V256" stroke="var(--divider)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 5"/><text x="186.0" y="278" font-size="11" class="v-muted" text-anchor="middle">20</text><path d="M328.0 151 V256" stroke="var(--divider)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 5"/><text x="328.0" y="278" font-size="11" class="v-muted" text-anchor="middle">40</text><path d="M470.0 151 V256" stroke="var(--divider)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 5"/><text x="470.0" y="278" font-size="11" class="v-muted" text-anchor="middle">60</text><path d="M612.0 151 V256" stroke="var(--divider)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 5"/><text x="612.0" y="278" font-size="11" class="v-muted" text-anchor="middle">80</text><path d="M754.0 151 V256" stroke="var(--divider)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 5"/><text x="754.0" y="278" font-size="11" class="v-muted" text-anchor="middle">100</text><rect x="44" y="180" width="710" height="44" rx="7" fill="var(--divider)" opacity="0.6"/><rect x="65.30" y="174" width="49.70" height="56" rx="4" fill="var(--chart-red)"/><text x="64.3" y="162" font-size="14" class="v-ink" text-anchor="middle">3%</text><text x="115.0" y="162" font-size="14" class="v-ink" text-anchor="middle">10%</text><rect x="24" y="322" width="752" height="84" rx="8" fill="var(--surface-card)" stroke="var(--chart-amber)" stroke-width="1.6"/><text x="41" y="349" font-size="13" class="v-sub" text-anchor="start">触发条件：译码后的指令缓存容量被超过</text><text x="41" y="379" font-size="13" class="v-sub" text-anchor="start">含义：这是一项历史实验的条件性范围，不能推算现代 CPU 或切换 ISA 后的省电比例。</text>
</svg>
</div>
<p class="v-caption">图 6 · 2016 年 CoolDC 论文估计，当 decoded-instruction cache 被突破时解码器占封装功耗约 3%–10%。不是现代芯片的通用范围，也不能据此计算换 ISA 的节能率。<a href="#x86-ref-S09">[S09]</a></p>
</div>
{% endraw %}

这份实验值得看，是因为它真的测了。但 3%–10% 只属于 2016 年那个平台和负载，也没有保持其余核心设计不变、只更换 ISA。不能据此承诺“换成 ARM，整机立刻省 10% 的电”。

我更想看到的实验是：减少旧模式和不规则指令以后，前端究竟能简化多少，验证矩阵能缩小多少，取指译码又能做多宽。这些都需要具体设计和测量，ISA 的名字回答不了。

## 那 ARM 为什么看起来那么香？

Apple Silicon 的出现，显然让这件事有了很强的现实感。Apple 在 2020 年正式启动 Mac 从 Intel 到自研 Arm 架构芯片的迁移，连编译器、通用二进制和翻译层的过渡方案都一起准备好了。用户后来看到的则是出色的性能、能效和整机体验。云服务器也已经可以在 x86 以外选择 Arm 平台。[S20](#x86-ref-S20)

Apple 的结果很容易让人归因到 RISC，但《ISA Wars》对 ARM、MIPS 与 x86 的比较已经提醒过：这些平台处在不同的工程设计点，RISC/CISC 分类本身预测不了性能和能效。[S10](#x86-ref-S10)

缓存、分支预测、执行单元、乱序窗口、内存系统和互连，都会消耗大量晶体管和功耗。制程、频率、电压、核心规模，再加上系统调度、内存和 SoC 集成，也都影响结果。Apple 的整机表现包含这些选择，不能只归功于 A64 的 32 位定长编码。

{% raw %}
<div class="v-figure v-chart-scroll">
<p class="v-scroll-hint">左右滑动查看完整图表；键盘聚焦后可用方向键。</p>
<div class="v-chart-viewport" tabindex="0" role="region" aria-label="x86与A64 RISC-V前端解码以及共有的后端复杂度">
<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="x86与A64 RISC-V前端解码以及共有的后端复杂度" viewBox="0 0 800 440">
<text x="24" y="38" font-size="22" class="v-ink" text-anchor="start" font-weight="650">前端先把“语言”翻译成能执行的动作</text><text x="24" y="64" font-size="12" class="v-sub" text-anchor="start">功能示意，不对应任何特定芯片的门级结构、流水级数或解码宽度。</text><text x="24" y="109" font-size="17" class="v-ink" text-anchor="start" font-weight="600">x86-64</text><rect x="24" y="119" width="170" height="70" rx="10" fill="var(--surface-card)" stroke="var(--chart-red)" stroke-width="1.6"/><text x="109" y="160" font-size="13" class="v-ink" text-anchor="middle">取指 / 边界识别</text><path d="M196 154 L209 154" stroke="var(--chart-red)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M204 148 L211 154 L204 160" stroke="var(--chart-red)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="219" y="119" width="170" height="70" rx="10" fill="var(--surface-card)" stroke="var(--chart-red)" stroke-width="1.6"/><text x="304" y="160" font-size="13" class="v-ink" text-anchor="middle">前缀与模式解释</text><path d="M391 154 L404 154" stroke="var(--chart-red)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M399 148 L406 154 L399 160" stroke="var(--chart-red)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="414" y="119" width="170" height="70" rx="10" fill="var(--surface-card)" stroke="var(--chart-red)" stroke-width="1.6"/><text x="499" y="160" font-size="13" class="v-ink" text-anchor="middle">解码 / 生成 µops</text><path d="M586 154 L599 154" stroke="var(--chart-red)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M594 148 L601 154 L594 160" stroke="var(--chart-red)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="609" y="119" width="170" height="70" rx="10" fill="var(--surface-card)" stroke="var(--chart-red)" stroke-width="1.6"/><text x="694" y="160" font-size="13" class="v-ink" text-anchor="middle">重命名与乱序执行</text><text x="24" y="230" font-size="17" class="v-ink" text-anchor="start" font-weight="600">A64 / RV64</text><rect x="24" y="240" width="170" height="70" rx="10" fill="var(--surface-card)" stroke="var(--chart-teal)" stroke-width="1.6"/><text x="109" y="281" font-size="13" class="v-ink" text-anchor="middle">取指 / 已知边界</text><path d="M196 275 L209 275" stroke="var(--chart-teal)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M204 269 L211 275 L204 281" stroke="var(--chart-teal)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="219" y="240" width="170" height="70" rx="10" fill="var(--surface-card)" stroke="var(--chart-teal)" stroke-width="1.6"/><text x="304" y="281" font-size="13" class="v-ink" text-anchor="middle">字段解码</text><path d="M391 275 L404 275" stroke="var(--chart-teal)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M399 269 L406 275 L399 281" stroke="var(--chart-teal)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="414" y="240" width="170" height="70" rx="10" fill="var(--surface-card)" stroke="var(--chart-teal)" stroke-width="1.6"/><text x="499" y="281" font-size="13" class="v-ink" text-anchor="middle">内部操作生成</text><path d="M586 275 L599 275" stroke="var(--chart-teal)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M594 269 L601 275 L594 281" stroke="var(--chart-teal)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="609" y="240" width="170" height="70" rx="10" fill="var(--surface-card)" stroke="var(--chart-teal)" stroke-width="1.6"/><text x="694" y="281" font-size="13" class="v-ink" text-anchor="middle">重命名与乱序执行</text><rect x="24" y="346" width="752" height="65" rx="8" fill="var(--surface-card)" stroke="var(--chart-amber)" stroke-width="1.6"/><text x="400" y="372" font-size="14" class="v-ink" text-anchor="middle">共同的难题：预测分支、调度、缓存、向量单元、内存一致性</text><text x="400" y="398" font-size="12" class="v-sub" text-anchor="middle">简单的外部 ISA 不等于简单的高性能 CPU。</text>
</svg>
</div>
<p class="v-caption">图 7 · 高层功能路径。并非任何 Intel、AMD、Apple 或 RISC-V 实现的真实 RTL 框图；现代高性能核心的后端复杂性同样重要。<a href="#x86-ref-S10">[S10]</a></p>
</div>
{% endraw %}

AArch64 自身当然也不是一本永远保持极简的教科书。SVE、SME、虚拟化、安全特性和各种系统寄存器都在扩充它的架构规模。RISC-V 也并非不用付扩展兼容的账；模块化让它易于定制，同时要求软件与硬件对支持哪些扩展达成一致。[S18](#x86-ref-S18) [S19](#x86-ref-S19)

即便如此，如果今天开始一项新设计，我仍更愿意从 A64 或 RISC-V 出发。至少有机会重新划定保留哪些功能，而不必默认四十年前的选择都要继续承担。

## 假设全世界约好不再用 x86，会怎么样？

我当然希望看到这个平行宇宙。全世界的操作系统、编译器、云厂商、游戏工作室、芯片公司一起宣布：以后主力通用计算转向 AArch64 和成熟的 RISC-V 配置，新软件默认多架构发布，x86 留在隔离的兼容环境里慢慢退役。

我期待的是产业有机会重新商定软硬件接口。CPU 的新设计可以少围绕一些历史状态打转，软件也可以把 x86-64 之外的平台视作常规目标。Arm 设计者能围绕各自 SoC 优化，RISC-V 实现者能基于开放 ISA 探索微架构和专用扩展。不过，这不会让明天的电脑自动快一倍。[S13](#x86-ref-S13)

这里也有一个微妙的选择：如果目标是摆脱架构锁定，**“全世界统一改用 Arm”并不等于最自由的结局**。Arm 的架构与核心 IP 有商业授权模式，RISC-V 的基础 ISA 与标准扩展则是开放、免版税规范。开放 ISA 不等于免费获得先进 CPU 核心、EDA、验证 IP 或量产能力，但它把指令集本身从专有授权中独立了出来。[S13](#x86-ref-S13) [S17](#x86-ref-S17)

RISC-V 眼下也没有成熟到能直接接管全球的高端 PC。2026 年一项面向实际硬件与软件栈的研究指出，现有实现的性能与系统集成水平仍然参差，尤其在通用高性能领域还需要继续追赶。[S21](#x86-ref-S21) 我愿意看到更多 RISC-V 方案进场，但不会把一张开放 ISA 规范误当成已经完工的桌面平台。

迁移的困难，往往出在不能随手重新编译的部分。

Windows on Arm 已经能通过 Prism 翻译运行不少 x86/x64 用户态程序，但微软明确说明：**内核驱动不能靠这种翻译运行，必须提供原生 Arm64 版本。** 游戏里的反作弊、专业设备驱动、闭源插件、企业虚拟机镜像、特定 ISA 的手写汇编和性能库，都可能成为真正的障碍。[S14](#x86-ref-S14)

### 普通人和工程师，到底用到了多少兼容性？

统计“用了多少兼容性”，要先定分母。浏览器看视频不会直接用到 16 位实模式，可在现有 Intel 64 平台上，开机已经经过了旧启动路径。对应用是零次直接调用，对整机却仍是启动所需。只盘点应用，会漏掉固件。[S05](#x86-ref-S05)

评估自己的迁移，我会列出非做不可的任务，逐项查现有软件和设备在 Windows on Arm 上是否还依赖 x86 二进制。这个清单回答迁移是否可行，数不出“用过多少条 x86 指令”。

{% raw %}
<div class="v-figure v-chart-scroll"><p class="v-scroll-hint">左右滑动查看完整图表；键盘聚焦后可用方向键。</p><div class="v-chart-viewport" tabindex="0" role="region" aria-label="六项假设任务的迁移依赖"><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="六项假设任务的迁移依赖" viewBox="0 0 800 400"><text x="24" y="35" font-size="25" class="v-ink">换到 Windows on Arm：逐项查依赖</text><text x="24" y="66" font-size="15" class="v-sub">下面是六项假设任务，每项只计一次。颜色和文字共同表示处理方式。</text><text x="24" y="109" font-size="17" class="v-sub">场景</text><text x="150" y="109" font-size="17" class="v-sub">手头的任务</text><text x="500" y="109" font-size="17" class="v-sub">迁移条件</text><path d="M24 122 L777 122" stroke="var(--divider)" stroke-width="2"/><text x="24" y="147" font-size="17" class="v-ink">日常</text><text x="150" y="147" font-size="17" class="v-ink">用原生 Arm64 浏览器看网页</text><path d="M486 132 L486 149" stroke="var(--chart-teal)" stroke-width="2"/><text x="500" y="147" font-size="17" class="v-ink">原生应用</text><path d="M24 166 L777 166" stroke="var(--divider)" stroke-width="2"/><text x="24" y="191" font-size="17" class="v-ink">日常</text><text x="150" y="191" font-size="17" class="v-ink">用原生文档软件编辑文档</text><path d="M486 176 L486 193" stroke="var(--chart-teal)" stroke-width="2"/><text x="500" y="191" font-size="17" class="v-ink">原生应用</text><path d="M24 210 L777 210" stroke="var(--divider)" stroke-width="2"/><text x="24" y="235" font-size="17" class="v-ink">日常</text><text x="150" y="235" font-size="17" class="v-ink">用原生播放器看视频</text><path d="M486 220 L486 237" stroke="var(--chart-teal)" stroke-width="2"/><text x="500" y="235" font-size="17" class="v-ink">原生应用</text><path d="M24 254 L777 254" stroke="var(--divider)" stroke-width="2"/><text x="24" y="279" font-size="17" class="v-ink">工程</text><text x="150" y="279" font-size="17" class="v-ink">用原生工具链编译可移植源码</text><path d="M486 264 L486 281" stroke="var(--chart-teal)" stroke-width="2"/><text x="500" y="279" font-size="17" class="v-ink">原生工具链</text><path d="M24 298 L777 298" stroke="var(--divider)" stroke-width="2"/><text x="24" y="323" font-size="17" class="v-ink">工程</text><text x="150" y="323" font-size="17" class="v-ink">运行仅发 x64 版的用户态工具</text><path d="M486 308 L486 325" stroke="var(--chart-amber)" stroke-width="2"/><text x="500" y="323" font-size="17" class="v-ink">可尝试翻译，须验证</text><path d="M24 342 L777 342" stroke="var(--divider)" stroke-width="2"/><text x="24" y="367" font-size="17" class="v-ink">工程</text><text x="150" y="367" font-size="17" class="v-ink">连接仅有 x64 内核驱动的仪器</text><path d="M486 352 L486 369" stroke="var(--chart-red)" stroke-width="2"/><text x="500" y="367" font-size="17" class="v-ink">缺原生驱动，受阻</text></svg></div><p class="v-caption">图 8 · 假设系统与应用都满足所列条件。Prism 可以翻译受支持的用户态代码，内核驱动必须有 Arm64 版。<a href="#x86-ref-S14">[S14]</a></p></div>
{% endraw %}

按图中的假设，日常组有 **0/3（0%）** 项任务依赖 x86 二进制。工程组有 **2/3（约 67%）**：用户态工具可以尝试翻译，仪器驱动却必须另找 Arm64 版本。如果测量必须用这台仪器，哪怕其他工作全能迁走，少这一个驱动也交不了实验报告。[S14](#x86-ref-S14)

这两个比例只适用于图里的六项假设任务。网页若依赖旧插件，或仪器已经有 Arm64 驱动，结果就会变。实验室要盘点真实的工具、插件、驱动和仪器，并逐项验证。至于哪些 CPU 逻辑可以删，还得另查启动、虚拟化和异常行为，不能从旧应用有没有被打开来推断。

Apple 给出了一条现实路线。它在 2020 年开启 Mac 向 Apple Silicon 的转换，用 Rosetta 为 x86-64 应用提供过渡。到 2026 年 9 月，Apple 已明确宣布 macOS 27 是通用 Rosetta 支持的最后一个大版本；未来只为某些依赖 Intel 框架的老游戏保留有限支持。[S11](#x86-ref-S11) [S12](#x86-ref-S12)

Apple 证明迁移可以完成，也说明这需要多年。它能协调自己的硬件、操作系统和分发体系；企业机房、DIY PC、科研仪器、工业控制和游戏则分散得多。即使共同推进，闭源软件和外设驱动的适配也仍要有人付账。

可行的转型要从持续支持多架构开始：软件在 x86-64、AArch64 和 RISC-V 上构建、自动测试，主流组件维护共同基线；新项目少绑定某一家 SIMD intrinsic 或二进制插件，硬件厂商提供长期可验证的驱动和系统接口。难迁的闭源负载先留在翻译器或旧平台上，等到确实有理由迁移。

这条路不必从说服 Intel 和 AMD 开始。先让软件不再把 x86 当成唯一默认平台，芯片厂商才有足够多的客户愿意试新架构。

## 我想让今天的设计者还能选

x86 内部的缓存、分支预测和乱序执行，有很多值得学的设计。我的不满始终是：这些工程能力为什么必须一次次花在维持旧架构行为上。

我宁愿看到更多精力用于尝试更简单的接口。当然，做芯片的人无法独自决定这件事。

旧程序能继续运行，对用户和厂商都有实际价值。兼容性曾帮助 PC 产业扩张，如今也省去了许多公司的系统重写。代价则留给了后续芯片和开发工具。谁先退出兼容，谁先承担迁移成本；继续支持，反而更容易留住客户。单靠一家公司的决定，很难改变这个局面。

我希望新高性能 CPU 的竞争，能更多落在缓存、预测、执行宽度和计算单元上。Intel、AMD 可以有机会采用更干净的架构，Arm 与 RISC-V 也能让更多设计者进场，而用户不必永远替 1978 年的选择续费。

如果真走到那一天，x86 留给我的，大概会是对那段工程历史的佩服，而不是今天这句骂。

---

## 资料来源与图表口径

下列链接是本篇写作与图表的数据来源。文中所有 2025 年财务数据均为公司披露的 **总研发费用**；2016 年解码器功耗数字是有条件的研究结果；没有用未经验证的数据拼出“x86 的总浪费额”。

1. <span id="x86-ref-S01"></span> **[S01]** [Intel：The Intel 8086 and the IBM PC](https://www.intel.com/content/www/us/en/history/virtual-vault/articles/the-8086-and-the-ibm-pc.html)，1978 年 8086 历史及软件生态起点。
2. <span id="x86-ref-S02"></span> **[S02]** [Intel XED 文档](https://github.com/intelxed/xed/blob/main/docsrc/xed-doc-top.txt)，x86 指令 1–15 Byte 与前缀/字段格式。
3. <span id="x86-ref-S03"></span> **[S03]** [Arm：The A64 ISA and Compilers](https://developer.arm.com/community/arm-community-blogs/b/architectures-and-processors-blog/posts/the-a64-isa-and-compilers)，A64 的 32-bit 定长编码。
4. <span id="x86-ref-S04"></span> **[S04]** [RISC-V Unprivileged ISA：C Extension](https://docs.riscv.org/reference/isa/v20260120/unpriv/c-st-ext.html)，RVC 的 16-bit 压缩指令。
5. <span id="x86-ref-S05"></span> **[S05]** [Intel：Envisioning a Simplified Intel Architecture](https://www.intel.com/content/www/us/en/developer/articles/technical/envisioning-future-simplified-architecture.html)，x86S 提案及官方停止推进声明。
6. <span id="x86-ref-S06"></span> **[S06]** [Intel / AMD：x86 Ecosystem Advisory Group](https://newsroom.intel.com/corporate/october-2024-intel-news)，2024 年 10 月公告。
7. <span id="x86-ref-S07"></span> **[S07]** [Intel 2025 Form 10-K](https://www.intc.com/filings-reports/annual-reports/content/0000050863-26-000011/intc-20251227.htm)，2025 总研发 13.8B 美元。
8. <span id="x86-ref-S08"></span> **[S08]** [AMD 2025 Form 10-K](https://ir.amd.com/financial-information/sec-filings/content/0000002488-26-000018/amd-20251227.htm)，2025 总研发 8.091B 美元。
9. <span id="x86-ref-S09"></span> **[S09]** [Hirki et al., CoolDC/USENIX 2016](https://www.usenix.org/conference/cooldc16/workshop-program/presentation/hirki)，解码器封装功耗占比估计 3%–10%，仅在特定微基准条件下。
10. <span id="x86-ref-S10"></span> **[S10]** [Blem et al., *ISA Wars*, ACM TOCS (2015)](https://doi.org/10.1145/2699682)，RISC/CISC 与能效不能简单划等号。
11. <span id="x86-ref-S11"></span> **[S11]** [Apple Developer，2026-09-01：Upcoming changes to Rosetta support](https://developer.apple.com/news/?id=w5ngl9k2)，Rosetta 通用支持的结束安排。
12. <span id="x86-ref-S12"></span> **[S12]** [Apple：About the Rosetta translation environment](https://developer.apple.com/documentation/apple-silicon/about-the-rosetta-translation-environment)，翻译层能力与限制。
13. <span id="x86-ref-S13"></span> **[S13]** [RISC-V International：About RISC-V](https://riscv.org/about/)，开放 ISA 与商业实现的区别。
14. <span id="x86-ref-S14"></span> **[S14]** [Microsoft Learn：How emulation works on Arm](https://learn.microsoft.com/en-us/windows/arm/apps-on-arm-x86-emulation)，Prism 与用户态/内核态的兼容边界。
15. <span id="x86-ref-S15"></span> **[S15]** [AMD 2003–2004 Annual Report](https://ir.amd.com/financial-information/sec-filings/content/0001193125-04-037179/d10k.htm)，2003 年 AMD64 / Opteron 的历史。
16. <span id="x86-ref-S16"></span> **[S16]** [Intel Microprocessor Quick Reference](https://www.intel.com/pressroom/kits/quickrefyr.htm)，8086 / 386 发布年份。

17. <span id="x86-ref-S17"></span> **[S17]** [Arm：Architecture](https://www.arm.com/architecture)，Arm ISA 授权模式。
18. <span id="x86-ref-S18"></span> **[S18]** [RISC-V Ratified ISA：Introduction](https://docs.riscv.org/reference/isa/v20240411/unpriv/intro.html)，RISC-V 基本指令长度与扩展方式。
19. <span id="x86-ref-S19"></span> **[S19]** [RISC-V Profiles：Introduction](https://docs.riscv.org/reference/rva20-rvi20-rva22/intro.html)，扩展碎片化与 profile 的动机。

20. <span id="x86-ref-S20"></span> **[S20]** [Apple Newsroom：Mac transition to Apple silicon, 2020-06-22](https://www.apple.com/newsroom/2020/06/apple-announces-mac-transition-to-apple-silicon/)，正式迁移与 Universal 2/Rosetta 2 方案。
21. <span id="x86-ref-S21"></span> **[S21]** [IEEE ETS 2026：A real opportunity or still a promise?](https://ieeexplore.ieee.org/abstract/document/11591831)，RISC-V 现实软硬件成熟度研究。

*图 1–8 为依据公开资料或明确假设制作的原创 SVG 图表，[下载配图数据和复算脚本](/2026/11/04/why-x86-is-a-mess/figure-sources.zip)。资料检索日期：2026 年 11 月 3 日。*
