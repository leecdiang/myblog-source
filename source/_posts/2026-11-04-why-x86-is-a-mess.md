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
description: "不规则编码与历史兼容性增加了 x86 前端实现的复杂度。结合 x86S 提案的搁置，讨论这些工程代价及多架构发展的条件。"
etoc: true
mathjax: true
---

{% note primary %}
x86 的争议不仅涉及指令编码，还涉及长期兼容契约如何约束新一代实现。若一个持续迭代四十多年的 RTL 系统必须保留旧状态和兼容分支，其重构成本便不能只按当前代码规模衡量。

本文据此讨论 x86 的前端复杂度、遗留模式与迁移成本，并区分可识别的工程负担和公开资料尚无法量化的部分。
{% endnote %}

x86 自 1978 年 Intel 8086 发展至 PC、服务器和工作站，形成了大规模软件生态。现代高性能实现已经采用宽乱序后端、复杂预测、向量计算与先进封装，但对软件可见的架构契约仍需要延续。生态规模因此同时构成竞争优势和架构重构的约束。[S01](#x86-ref-S01) [S05](#x86-ref-S05)

Intel 曾在 2023 年提出 x86S 精简方案，随后停止推进；2024 年，Intel、AMD 与产业伙伴成立 x86 生态咨询组。这些事件说明，ISA 调整还依赖软件、固件及平台参与者之间的协调。[S05](#x86-ref-S05) [S06](#x86-ref-S06)

我对 x86 的批评集中于持续兼容的工程代价，而非否定其微架构设计能力。需要讨论的是：哪些历史约束仍然有效，维护它们消耗哪些资源，以及已有更简单方案的机制为何难以退出。

启动路径提供了一个例子。现代系统最终进入 64 位模式，现有处理器仍须从 8086 遗留启动状态过渡。Intel 曾提议直接以 64 位状态启动，后根据生态反馈撤回。因此，兼容约束并不只存在于旧应用，也存在于系统启动所依赖的平台契约。[S05](#x86-ref-S05)

<!-- more -->

{% raw %}
<div class="v-figure v-chart-scroll"><p class="v-scroll-hint">左右滑动查看完整图表；键盘聚焦后可用方向键。</p><div class="v-chart-viewport" tabindex="0" role="region" aria-label="现有 Intel 64 和 x86S 提案的启动路径"><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="现有 Intel 64 和 x86S 提案的启动路径" viewBox="0 0 800 350"><text x="24" y="36" font-size="25" class="v-ink">开机之后，谁还需要旧模式？</text><text x="24" y="68" font-size="15" class="v-sub">同一个目标：让现代 64 位系统开始运行。只画复位与模式切换。</text><text x="24" y="102" font-size="17" class="v-ink">现有 Intel 64</text><rect x="24" y="119" width="190" height="58" rx="8" fill="var(--surface-card)" stroke="var(--chart-amber)"/><text x="36" y="154.0" font-size="17" class="v-ink">8086 式复位状态</text><text x="225" y="154" font-size="24" class="v-sub">→</text><rect x="256" y="119" width="260" height="58" rx="8" fill="var(--surface-card)" stroke="var(--chart-amber)"/><text x="268" y="154.0" font-size="17" class="v-ink">启动代码切换模式</text><text x="527" y="154" font-size="24" class="v-sub">→</text><rect x="558" y="119" width="164" height="58" rx="8" fill="var(--surface-card)" stroke="var(--chart-amber)"/><text x="570" y="154.0" font-size="17" class="v-ink">64 位运行</text><text x="24" y="215" font-size="17" class="v-ink">x86S 提案</text><rect x="24" y="232" width="465" height="58" rx="8" fill="var(--surface-card)" stroke="var(--chart-teal)"/><text x="36" y="267.0" font-size="17" class="v-ink">直接进入 64 位复位状态</text><text x="500" y="267" font-size="24" class="v-sub">→</text><rect x="531" y="232" width="164" height="58" rx="8" fill="var(--surface-card)" stroke="var(--chart-teal)"/><text x="543" y="267.0" font-size="17" class="v-ink">64 位运行</text><text x="24" y="326" font-size="16" class="v-sub">提案仍保留 64 位系统运行 32 位应用的能力。Intel 后来停止推进 x86S。</text></svg></div><p class="v-caption">图 1 · Intel 提案给出了一个具体的简化机会：从 64 位状态复位，省去进入 64 位模式的过渡步骤。下排是提案。<a href="#x86-ref-S05">[S05]</a></p></div>
{% endraw %}

## 指令边界与前端译码复杂度

x86 变长编码使指令边界识别依赖当前指令的解析结果，增加了前端并行译码的组织难度。

x86-64 的指令可以长 1 到 15 Byte。它可能带有传统前缀、REX 前缀，也可能采用 VEX、EVEX 等扩展编码；寻址与操作数又可能需要 ModR/M、SIB、位移量和立即数。APX 还引入了 REX2。字段的位置和长度由指令类别与执行模式决定。[S02](#x86-ref-S02)

AArch64 的 A64 指令统一为 32 bit，即 4 Byte，边界可由定长规则确定。RISC-V 的基础指令为 32 bit，常见 RV64GC 同时支持 16 bit 压缩指令，需要区分 2 Byte 与 4 Byte；其编码结构预留了长度判定。规范还允许更长格式，因此不能将整个 RISC-V 家族限定为两种长度。[S03](#x86-ref-S03) [S04](#x86-ref-S04) [S18](#x86-ref-S18)

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

图中比较的是边界识别规则。A64 的定长边界与 x86 的长度、前缀和操作数联合解析，确实具有不同的设计条件；但 15 Byte 与 4 Byte 的长度范围不能用于推导门数或功耗比例。

前端需要对取回的字节流划分指令边界、处理跨界，并解释编码与操作数。随着译码宽度增加，不规则边界的并行处理也增加。长度预译码、复杂解码器和微操作缓存可以缓解限制，但相应机制仍需设计、验证和维护。[S02](#x86-ref-S02)

### 内存读改写指令的编码取舍

以 `p` 指向的 64 位整数加一为例，可比较紧凑编码与显式访存的取舍。以下仅讨论单线程普通读改写，不涉及并发原子性，也不要求最终条件标志位相同。

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

我用 GNU `as` 与 `objdump` 核对了这组机器码。四个字节同时编码了内存寻址、读改写和立即数：`48` 为 REX.W，`83` 为操作码，`07` 为 ModR/M，`01` 为立即数。译码必须识别这些字段及其约束，才能得到完整操作语义。

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

对应的 RISC-V RV64I 实现为：

```asm
ld   t0, 0(a0)
addi t0, t0, 1
sd   t0, 0(a0)
```

在这个限定示例中，x86 使用一条、四字节指令，A64 与 RV64I 各使用三条基础指令、十二字节。实际编译结果仍取决于上下文，压缩扩展也可能改变字节数。这说明复杂语义能够提高编码密度，但尚不足以比较执行速度。

而且，x86 的一条机器指令并不保证在核心内部只是一项操作。复杂的内存操作可能被拆解成加载、运算、存储相关的内部操作。不同微架构如何拆解、融合、执行，没有统一答案。A64 和 RISC-V 的高性能核心同样可能采用内部操作、投机执行和复杂调度。[S10](#x86-ref-S10)

## 遗留模式与架构状态的维护

变长编码并非全部负担。8086、286、386 延续下来的运行模式与架构状态，还要求当前实现保持相应的可观察行为。

16 位实模式、分段、保护模式、32 位兼容与 x86-64 long mode 逐步叠加，x87 浮点栈、SIMD 扩展和前缀语义继续扩大状态与交互范围。这是硬件兼容机制的问题，不能由此推断 Windows 11 能直接运行全部 DOS 程序；操作系统支持范围与硬件保留机制需要分别判断。[S05](#x86-ref-S05)

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

x86S 的出发点是，64 位系统普及后，一部分旧模式主要用于启动过渡。草案尝试移除部分 16/32 位特权和运行模式，同时保留 long mode 下的 32 位应用兼容子模式。它因此属于有限范围的架构精简，并非取消全部旧软件兼容。[S05](#x86-ref-S05)

Intel 最终停止推进，并继续强调软件兼容。大致同期，Intel、AMD 与产业伙伴开始通过咨询组协调架构接口，说明即使有限精简也受到生态约束。[S05](#x86-ref-S05) [S06](#x86-ref-S06)

删除硬件功能还需要确认固件、企业虚拟化和旧二进制业务是否依赖它。内部实现的简化收益，与外部兼容承诺的撤销成本，属于不同主体承担的成本。

因此，识别 RTL 死逻辑与证明全球软件不再依赖某项行为，是规模和证据要求均不同的问题。

## 兼容成本的量化证据

Intel 与 AMD 的年报提供总研发开支，不能直接分离 x86 兼容性维护的成本。

Intel 的 2025 年报写明，当年的研发费用为 **138 亿美元**；AMD 的同期研发费用为 **80.91 亿美元**。加起来约 **218.91 亿美元**。这笔钱涵盖了制程、封装、CPU、GPU、AI 加速器、FPGA、软件以及其他研究方向。财报没有把“维护 x86 旧模式、旧指令和相关验证”单独拆出来。[S07](#x86-ref-S07) [S08](#x86-ref-S08)

{% raw %}
<div class="v-figure v-chart-scroll"><p class="v-scroll-hint">左右滑动查看完整图表；键盘聚焦后可用方向键。</p><div class="v-chart-viewport" tabindex="0" role="region" aria-label="公司总研发费用与未披露的兼容成本"><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="公司总研发费用与未披露的兼容成本" viewBox="0 0 800 285"><text x="24" y="38" font-size="25" class="v-ink">财报能回答哪一栏？</text><text x="24" y="70" font-size="15" class="v-sub">2025 财年，单位：十亿美元</text><text x="24" y="126" font-size="17" class="v-sub">公司</text><text x="185" y="126" font-size="17" class="v-sub">公司总研发费用</text><text x="430" y="126" font-size="17" class="v-sub">其中：维护 x86 兼容性</text><path d="M24 147 L770 147" stroke="var(--divider)" stroke-width="2"/><text x="24" y="184" font-size="22" class="v-ink">Intel</text><text x="185" y="184" font-size="24" class="v-ink">13.8</text><text x="430" y="184" font-size="22" class="v-ink">未单独披露</text><path d="M24 212 L770 212" stroke="var(--divider)" stroke-width="2"/><text x="24" y="249" font-size="22" class="v-ink">AMD</text><text x="185" y="249" font-size="24" class="v-ink">8.091</text><text x="430" y="249" font-size="22" class="v-ink">未单独披露</text></svg></div><p class="v-caption">图 5 · 财报能给出左栏金额。右栏缺少单独披露，无法据此估算兼容成本或潜在节省额。<a href="#x86-ref-S07">[S07]</a> <a href="#x86-ref-S08">[S08]</a></p></div>
{% endraw %}

约 219 亿美元不能作为 x86 浪费额。工艺、晶圆厂、GPU、AI 与软件研发等支出，均不能未经分摊就归因于 ISA 兼容。

可以明确指出的，是以下持续存在的工程工作：

- **指令前端。** 处理变长指令、前缀、跨界和罕见编码，还要在高吞吐、低延迟与低功耗之间做设计选择。
- **功能验证。** 旧模式、异常、特权切换、虚拟化、指令扩展之间的交互，需要规格、测试与回归；软件可以观察到的行为，不能随便改。
- **固件与操作系统。** 启动路径、特性枚举、微码更新、ABI 及虚拟化兼容，都需要厂商和系统软件合作。
- **产品迭代。** 一部分工程人力持续用于确保“旧程序还是对的”，而不是完全投入新指令、新执行模型或更简单的硬件接口。

这些工作具有可识别的成本来源，公开资料却不足以给出可信总额。即使改用 A64，仍需要微架构、工具链、验证和操作系统团队，也不能将现有前端成本全部视为可节省项。

### 解码功耗研究的适用条件

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

3%–10% 对应 2016 年特定平台与微基准条件，研究没有保持其余核心设计不变而只替换 ISA。因此，该结果不能解释为改用 Arm 后整机必然节省 10% 功耗。

更有针对性的比较应量化精简模式与编码后，前端结构、验证矩阵及取指译码吞吐如何变化。这些结果依赖具体设计与测量，无法仅由 ISA 名称推定。

## Arm 产品表现与 ISA 归因的边界

Apple Silicon 的出现，显然让这件事有了很强的现实感。Apple 在 2020 年正式启动 Mac 从 Intel 到自研 Arm 架构芯片的迁移，连编译器、通用二进制和翻译层的过渡方案都一起准备好了。用户后来看到的则是出色的性能、能效和整机体验。云服务器也已经可以在 x86 以外选择 Arm 平台。[S20](#x86-ref-S20)

《ISA Wars》对 ARM、MIPS 和 x86 的比较指出，各平台处于不同的工程设计点，RISC/CISC 分类不足以预测性能和能效。这也限制了仅凭 Apple 产品表现推断 ISA 因果作用的解释。[S10](#x86-ref-S10)

缓存、预测、乱序窗口、执行单元、内存与互连占用大量晶体管和功耗。制程、频率、电压、核心规模及系统集成也共同影响结果，A64 的 32 位定长编码只能作为其中一项设计条件。

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

AArch64 也在通过 SVE、SME、虚拟化、安全机制和系统寄存器扩展架构规模。RISC-V 的模块化提供定制空间，同时要求软硬件就扩展组合达成一致，因此仍有兼容和配置管理成本。[S18](#x86-ref-S18) [S19](#x86-ref-S19)

对于新设计，我仍倾向于 A64 或 RISC-V，理由是可以重新评估历史功能的边界，而不必完整继承既有 x86 状态。这是对设计起点的偏好，并非对所有实现性能的断言。

## 多架构迁移的收益与现实约束

可以设想主流软件默认支持 AArch64 和成熟 RISC-V 配置，x86 负载逐步转入独立兼容环境。这个假设用于分析迁移条件，并不意味着全球平台能够同时切换。

潜在收益在于重新界定软硬件接口，使新 CPU 不必围绕相同遗留状态设计。Arm 厂商可围绕各自 SoC 优化，RISC-V 实现者可探索开放 ISA 上的微架构和扩展；但接口自由度增加本身不等于性能自动翻倍。[S13](#x86-ref-S13)

这里也有一个微妙的选择：如果目标是摆脱架构锁定，**“全世界统一改用 Arm”并不等于最自由的结局**。Arm 的架构与核心 IP 有商业授权模式，RISC-V 的基础 ISA 与标准扩展则是开放、免版税规范。开放 ISA 不等于免费获得先进 CPU 核心、EDA、验证 IP 或量产能力，但它把指令集本身从专有授权中独立了出来。[S13](#x86-ref-S13) [S17](#x86-ref-S17)

RISC-V 眼下也没有成熟到能直接接管全球的高端 PC。2026 年一项面向实际硬件与软件栈的研究指出，现有实现的性能与系统集成水平仍然参差，尤其在通用高性能领域还需要继续追赶。[S21](#x86-ref-S21) 我愿意看到更多 RISC-V 方案进场，但不会把一张开放 ISA 规范误当成已经完工的桌面平台。

迁移成本主要集中在无法直接重新编译或缺乏原生替代的组件。

Windows on Arm 已经能通过 Prism 翻译运行不少 x86/x64 用户态程序，但微软明确说明：**内核驱动不能靠这种翻译运行，必须提供原生 Arm64 版本。** 游戏里的反作弊、专业设备驱动、闭源插件、企业虚拟机镜像、特定 ISA 的手写汇编和性能库，都可能成为真正的障碍。[S14](#x86-ref-S14)

### 应用依赖与整机兼容的统计范围

浏览器工作负载通常不直接使用 16 位实模式，但现有 Intel 64 平台仍经过旧启动路径。因此，应用层的零次调用不能证明整机不再依赖该机制，兼容使用率需要先定义统计边界。[S05](#x86-ref-S05)

对个人或实验室，更可执行的评估是建立必要任务清单，逐项验证现有软件与设备在 Windows on Arm 上是否依赖 x86 二进制。它衡量迁移依赖，不等同于统计使用过的指令比例。

{% raw %}
<div class="v-figure v-chart-scroll"><p class="v-scroll-hint">左右滑动查看完整图表；键盘聚焦后可用方向键。</p><div class="v-chart-viewport" tabindex="0" role="region" aria-label="六项假设任务的迁移依赖"><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="六项假设任务的迁移依赖" viewBox="0 0 800 400"><text x="24" y="35" font-size="25" class="v-ink">换到 Windows on Arm：逐项查依赖</text><text x="24" y="66" font-size="15" class="v-sub">下面是六项假设任务，每项只计一次。颜色和文字共同表示处理方式。</text><text x="24" y="109" font-size="17" class="v-sub">场景</text><text x="150" y="109" font-size="17" class="v-sub">手头的任务</text><text x="500" y="109" font-size="17" class="v-sub">迁移条件</text><path d="M24 122 L777 122" stroke="var(--divider)" stroke-width="2"/><text x="24" y="147" font-size="17" class="v-ink">日常</text><text x="150" y="147" font-size="17" class="v-ink">用原生 Arm64 浏览器看网页</text><path d="M486 132 L486 149" stroke="var(--chart-teal)" stroke-width="2"/><text x="500" y="147" font-size="17" class="v-ink">原生应用</text><path d="M24 166 L777 166" stroke="var(--divider)" stroke-width="2"/><text x="24" y="191" font-size="17" class="v-ink">日常</text><text x="150" y="191" font-size="17" class="v-ink">用原生文档软件编辑文档</text><path d="M486 176 L486 193" stroke="var(--chart-teal)" stroke-width="2"/><text x="500" y="191" font-size="17" class="v-ink">原生应用</text><path d="M24 210 L777 210" stroke="var(--divider)" stroke-width="2"/><text x="24" y="235" font-size="17" class="v-ink">日常</text><text x="150" y="235" font-size="17" class="v-ink">用原生播放器看视频</text><path d="M486 220 L486 237" stroke="var(--chart-teal)" stroke-width="2"/><text x="500" y="235" font-size="17" class="v-ink">原生应用</text><path d="M24 254 L777 254" stroke="var(--divider)" stroke-width="2"/><text x="24" y="279" font-size="17" class="v-ink">工程</text><text x="150" y="279" font-size="17" class="v-ink">用原生工具链编译可移植源码</text><path d="M486 264 L486 281" stroke="var(--chart-teal)" stroke-width="2"/><text x="500" y="279" font-size="17" class="v-ink">原生工具链</text><path d="M24 298 L777 298" stroke="var(--divider)" stroke-width="2"/><text x="24" y="323" font-size="17" class="v-ink">工程</text><text x="150" y="323" font-size="17" class="v-ink">运行仅发 x64 版的用户态工具</text><path d="M486 308 L486 325" stroke="var(--chart-amber)" stroke-width="2"/><text x="500" y="323" font-size="17" class="v-ink">可尝试翻译，须验证</text><path d="M24 342 L777 342" stroke="var(--divider)" stroke-width="2"/><text x="24" y="367" font-size="17" class="v-ink">工程</text><text x="150" y="367" font-size="17" class="v-ink">连接仅有 x64 内核驱动的仪器</text><path d="M486 352 L486 369" stroke="var(--chart-red)" stroke-width="2"/><text x="500" y="367" font-size="17" class="v-ink">缺原生驱动，受阻</text></svg></div><p class="v-caption">图 8 · 假设系统与应用都满足所列条件。Prism 可以翻译受支持的用户态代码，内核驱动必须有 Arm64 版。<a href="#x86-ref-S14">[S14]</a></p></div>
{% endraw %}

按图中的假设，日常组有 **0/3（0%）** 项任务依赖 x86 二进制。工程组有 **2/3（约 67%）**：用户态工具可以尝试翻译，仪器驱动却必须另找 Arm64 版本。如果测量必须用这台仪器，哪怕其他工作全能迁走，少这一个驱动也交不了实验报告。[S14](#x86-ref-S14)

这两个比例仅描述图中六项假设任务。插件和驱动条件改变，结果也会改变。真实迁移需要核验工具、插件、驱动和仪器；判断可删除的 CPU 机制，则还需要独立分析启动、虚拟化及异常行为。

Apple 给出了一条现实路线。它在 2020 年开启 Mac 向 Apple Silicon 的转换，用 Rosetta 为 x86-64 应用提供过渡。到 2026 年 9 月，Apple 已明确宣布 macOS 27 是通用 Rosetta 支持的最后一个大版本；未来只为某些依赖 Intel 框架的老游戏保留有限支持。[S11](#x86-ref-S11) [S12](#x86-ref-S12)

Apple 案例支持跨 ISA 迁移的可行性，同时显示其需要多年协调。企业机房、DIY PC、科研设备、工业控制与游戏生态更分散，闭源组件和外设驱动的适配成本不会因共同迁移而消失。

较可行的路径是持续维护多架构构建与自动测试，减少新项目对专有 SIMD intrinsic 和二进制插件的绑定，并提供长期可验证的驱动与系统接口。难以迁移的负载继续使用翻译器或旧平台，直到替代收益足以支持适配。

先建立软件的多架构基线，可以降低客户采用新芯片的门槛，也减少迁移完全依赖单家厂商决策的程度。

## 兼容收益与新架构选择

x86 高性能实现中有大量值得研究的缓存、分支预测和乱序执行设计。我的批评指向兼容契约占用的持续工程资源，而非这些实现工作的技术价值。

重新设计接口可能释放一部分空间，但采用新架构的决定还取决于软件迁移成本及承担方式。

旧程序持续可用，为用户提供明确价值，也使维护兼容的厂商更容易保留客户。率先退出者则需要承担迁移成本，收益和成本分布不对称，因而很难由一家企业单独完成架构转换。

我希望 Intel、AMD 能在更简洁的接口上竞争缓存、预测和执行资源，也希望 Arm 与 RISC-V 为新设计者保留进入空间。其前提是迁移方案足以承接 1978 年以来不断积累的软件依赖。

在这些条件逐步具备以前，对 x86 的评价需要同时承认其历史兼容价值，以及这种价值对新设计施加的限制。

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
