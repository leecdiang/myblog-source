---
lang: zh-CN
title: EdgeControl：我把 Windows 笔记本的触控板边缘手势，搬到了 macOS 上
date: 2026-08-30 12:54:00
categories: Everyday Anatomy
etoc: true
toc:
  number: true
tags:
  - macOS
  - Swift
  - 触控板
  - 开源
  - 私有 API
description: 记录 EdgeControl 从零到 v1.7.3 的开发全过程：私有 API 逆向、手势状态机、两周十五个版本，以及完整技术栈。
keywords: EdgeControl, macOS, 触控板, Swift, 私有 API, MultitouchSupport, 开源
---
<style>
.v-arch{--a-front:#ffffff;--a-top:#f5f5f7;--a-side:#e8e8ed;--a-border:rgba(0,0,0,.08);--a-title:#1d1d1f;--a-sub:#6e6e73;--a-accent:#0071e3;--a-chip:rgba(0,0,0,.045);--a-shadow:rgba(0,0,0,.10)}
@media (prefers-color-scheme: dark){.v-arch{--a-front:#1c1c1e;--a-top:#2c2c2e;--a-side:#141416;--a-border:rgba(255,255,255,.12);--a-title:#f5f5f7;--a-sub:#a1a1a6;--a-accent:#0a84ff;--a-chip:rgba(255,255,255,.08);--a-shadow:rgba(0,0,0,.45)}}
.v-arch .a-front{fill:var(--a-front);stroke:var(--a-border);stroke-width:1}
.v-arch .a-top{fill:var(--a-top)}
.v-arch .a-side{fill:var(--a-side)}
.v-arch .a-shadow{fill:var(--a-shadow);opacity:.18}
.v-arch .a-title{fill:var(--a-title)}
.v-arch .a-sub{fill:var(--a-sub)}
.v-arch .a-chip{fill:var(--a-chip)}
.v-arch .a-chip-text{fill:var(--a-title)}
.v-arch .a-accent{fill:var(--a-accent)}
.v-arch .a-spine{stroke:var(--a-border);stroke-width:1;stroke-dasharray:4 5}
.v-arch .a-dot{fill:var(--a-accent)}
.v-figure{padding:.6rem .7rem .45rem}
</style>


## 从一块 Windows 触控板说起

小胡的小米 Book Pro14，可以从触控板边缘滑入调节音量和亮度。第一次用我就爱上了：手指从机身滑上触控板，上滑音量变大，下滑变小，每到一个刻度还有一下清脆的振动。那个感觉很像 EDC 玩具，拧一下、拨一下，咔嗒一声，东西就真的变了。物理直觉拉满。

我的看法很直接：**没有振动反馈的机器，没必要做这个功能。** 音量变了，手指却什么都没收到，边缘手势也就只是少按了几次键；有了振动，它才更像在拨一个看不见的实体旋钮。

我后来才意识到，自己想搬过来的其实不只是“从边缘调参数”这件事，而是一个完整的反馈闭环：手指进入边缘，数值开始变化，指尖收到一个小脉冲，然后继续决定要不要往下推。少掉中间那一下，功能很容易退化成另一种键盘快捷键。我不想先做一个只能把音量改掉的 demo，再把触觉当成装饰补上，所以从第一轮原型开始，触觉就和手势是否成立放在同一张验证清单里。

回到自己的 MacBook Air，这个功能却不存在。我搜了一圈，找到的方案要么收费、要么闭源，要么塞进了太多我用不到的东西。免费、开源、轻量、离线，这几个条件放在一起，没找到合适的。

那就自己写。项目仓库：<a href="https://github.com/leecdiang/EdgeControl" target="_blank" class="glass-pill"><i class="fab fa-github"></i> leecdiang/EdgeControl</a>

## 先把边界划清楚

项目 README 的第一行：

> Two edges. Two controls. Nothing else.

两条边缘，两个控制，没有别的。EdgeControl 从一开始就没打算做成一套触控板手势大全，边界一直很窄：

- 左边缘、右边缘各自独立指派：音量 / 亮度 / 关闭
- 手势必须诞生在边缘：手指先落在触控板内部、再滑到边缘的，永不触发
- 无账号、无遥测、没有自建后端；更新功能只会从 GitHub Releases 托管的签名 appcast 检查新版本，默认自动检查，也可手动触发
- 菜单栏常驻（`LSUIElement`），没有 Dock 图标，不打扰

“手势必须诞生在边缘”是最重要的一条。如果只看手指最后有没有来到边缘，日常移动光标、拖文件、打字时手掌蹭到触控板，都可能误触。EdgeControl 需要记住一次接触从哪里开始、往哪边走、何时形成明确的纵向意图，再决定要不要接管。

这条规则既是整个软件的地基，也是后面大部分调试工作的来源。

这几个约束写在 README 里很像产品口号，真正落到触控板上才知道它们有多具体。一次有效接触要从对应边缘开始，单指先沿着边缘进入，再在很短的时间内形成明确的上下方向；从中间开始的接触，即使后来一路滑到边缘，也要在整个生命周期里保持拒绝。多指、手掌和刚刚打字留下的接触同样不能因为“碰巧到了边上”就被接管。

这也决定了 EdgeControl 不会试图猜用户的全部意图。它宁愿漏掉一次含糊的滑动，也不愿在拖文件、移动光标或敲字时突然改掉音量。对菜单栏工具来说，偶尔需要重新滑一次，通常比一次误触之后到处找声音为什么变小更容易接受。

## 两周十五个版本

整个项目的时间线短得有点不真实：

- 8 月 16 日晚：第一次提交，P1-P8 原型期开始
- 8 月 17 日凌晨：v1.0.0 发布，一个晚上
- 8 月 30 日：v1.7.3 发布，前后十五个版本，两周

v1.0.0 之前的提交按 P1-P8 编号，最不确定的部分被一关一关跑通：能不能读到触点，坐标方向对不对，音量和亮度能不能连续变化，触觉有没有反馈。设置窗口反而排在最后。

这个顺序不是为了把功能拆得好看，而是因为每一层都依赖上一层的证据。原始触点的步长不对，状态机拿到的就是假坐标；状态机没有稳定的激活和取消边界，映射公式越顺滑，误触时改出来的数值越危险；音量和亮度没有在真机上跑通，HUD 做得再像系统组件也只是截图。设置界面可以晚一点出现，底层行为却不能靠想象往后补。

| 阶段 | 内容 |
| :--- | :--- |
| P1/P2 | 修复 MT contact ABI 结构体步长 80→96；边缘接触调参 |
| P2 | entryTimeout 250→350ms；A-K 手势矩阵全量验证 |
| P3 | 音量端到端验证；修复 y 轴极性；dwell-then-push 调参 |
| P4 | 内置亮度端到端（DisplayServices）；增益调至 2.0，边缘满行程覆盖 0-100 |
| P5 | 触觉验证；确认 MTActuator 在 macOS 26.5 不存在，退回公共后端 |
| P8 | 救活 LSUIElement 应用里的设置窗口（手动 NSWindow） |

那个晚上大部分时间其实花在 P1/P2 上。只要原始触点读错，后面的状态机、映射和 UI 做得再完整也没有意义。

那一段调试还有一个很不起眼、但很容易误导人的问题：探针把结果打印到标准输出时，重定向环境会缓冲 stdout。程序明明读到了数据，终端里却像什么都没有。后来给探针设置了无缓冲输出，或者在关键位置主动 `fflush`，才把“没有回调”和“输出还没刷出来”区分开。类似的小问题不会出现在版本说明里，却经常占掉真正调试时间。

首发之后的节奏也很明确：每个版本只处理一类问题，不趁机大改结构。

| 版本 | 核心内容 |
| :--- | :--- |
| 1.1.0 | 手掌误触防御：方向性判定、过零取消 |
| 1.2.0 | 下半屏启动模式、中性 HUD、更严格的手势准入 |
| 1.2.1 | 下半屏模式相对映射，进入高度不再造成跳变 |
| 1.3.0 | 加入外接 Magic Trackpad 的实验性选择与筛选路径（尚无外接真机验证） |
| 1.3.1 | 亮度后端可靠性：只走内置，杜绝 DDC 误路由 |
| 1.4.0 | HUD 渲染定稿、三档调节速度预设 |
| 1.5.0 | 三级触觉强度、144×40 磨砂 HUD |
| 1.5.1 | 强脉冲可取消、DDC 连接固定 |
| 1.6.0 | 自定义磨砂菜单弹窗、设置界面重组、HUD 调色板 |
| 1.6.1 | DDC VCP10 回复偏移修复、完整 ad-hoc 签名 |
| 1.7.0 | 磨砂设置窗口、更宽入口条、莫兰迪 HUD 配色、Homebrew cask |
| 1.7.1 | 磨砂窗口渲染修复、入口条再放宽 |
| 1.7.2 | 签名的 Sparkle 自动更新 |
| 1.7.3 | HUD 手势稳定性、单实例锁、音量会话固定设备 |

看提交记录像是在一路加功能，其实多数版本都在缩小误触、修正边界条件，或者把已经能用的东西变得稳定一点。功能本身不复杂，难的是让它每天挂在菜单栏里，又不在不该出现的时候冒出来。

从 1.1.0 到 1.3.1，版本号看起来在往前走，手势的核心其实一直被反复收紧：方向性判定用来挡住手掌抖动，过零取消用来处理激活后的反向滑动，下半屏模式则要解决“从哪里进入就从哪里跳值”的问题。到了 1.4.0 之后，才有余力把速度预设、触觉强度、HUD 和分发链路逐一补齐。每次只动一类问题，回归测试和真机轨迹才看得出到底是哪一处改变了体验。

## 私有 API、调参与系统怪脾气

第一道坎是 96 字节。

macOS 的触控板原始数据藏在私有框架 MultitouchSupport 里，没有公开文档。最开始按 80 字节的步长遍历 contact 结构体，读出来的数据全是乱的。最后只能做原始字节探针，把缓冲区逐字节打印，再和已知的触点坐标比对，才确认这台机器上的真实步长是 96 字节。这里错一个数字，后面的手势识别就是空中楼阁。

96 字节这个结论只对当前验证机的 ABI 证据负责，并不是可以写进所有 Mac 的常量。私有框架没有公开契约，硬件和系统更新都可能改变布局，所以 bridge 里只做动态加载和最小解析，Swift 侧继续使用稳定的数据契约。这样遇到框架不存在、符号变了或初始化失败时，功能会安全地失效，而不是把一块错误的内存继续当成触点坐标。

探针本身还遇到过一个很容易误判的细节：把结果重定向到标准输出时，stdout 可能被缓冲。程序明明读到了触点，终端里却像什么都没有。后来给探针设置无缓冲输出，或者在关键位置主动 `fflush`，才把“没有回调”和“输出还没刷出来”区分开。这样的细节不会出现在功能列表里，却经常占掉真正调试时间。

私有 API 更麻烦的地方在于它随系统和硬件变化。EdgeControl 没有把这些符号当成理所当然，而是通过 `dlopen` / `dlsym` 动态查找；框架不存在、符号缺失或者初始化失败，就把对应功能视为不可用。与其在未知环境里硬跑，不如直接失败并退出这条路径。

数据读对之后，才轮到手势本身。边缘入口宽度、意图判定窗口（entryTimeout）、候选走廊、方向阈值，这些参数都没有标准答案。手指并不会沿着一条笔直的数学曲线移动，同一个人快滑、慢滑、先停一下再推，轨迹都不一样。原型期因此做了一套 A-K 手势矩阵：边缘诞生、向上和向下这些正例必须触发；内部起手、多指、手掌等负例必须拒绝。后来每次改识别语义，都先补回归测试，再动参数。

当前这套参数来自验证机上的实测轨迹：左侧入口条是 0.008，右侧是 0.015，候选阶段只能在距离边缘 3% 的走廊里移动，激活后放宽到 8%；450ms 内要完成至少 1.5% 的纵向移动，而且方向一致性要达到 0.80。右侧入口条刻意比左侧宽一点，是因为这台机器上右侧的有效边缘接触分布更靠外，放宽后能补回自然滑入的样本，又不会把候选阶段变成一条大面积的触发区。每个数字都不是“看起来舒服”就留下，而是要和正例、负例轨迹一起看。

激活之后的映射反而简单一些：以手势开始时的音量或亮度为基准，叠加累计纵向位移、基础增益和速度倍率，最后钳制在 0 到 1。下半区模式也采用相对映射，因此从不同高度进入时不会突然跳值。让数值变化不难，确认用户有没有这个意图才难。

这也是为什么我把“激活前”和“激活后”分成两套规则。激活前要尽量保守，宁可在 450ms 内没有形成明显的上下意图就结束；一旦进入 Active，用户需要的是连续、可预期的控制，8% 的活动走廊和固定在激活瞬间的速度倍率会让后续移动保持稳定。方向反转超过 0.5% 的死区时，本次手势取消，避免一次缓慢回拉把前面已经确认的方向悄悄改掉。

### 防误触不是一个开关

设置里的误触保护有 Light、Standard、Strong 三档。它们不去改 450ms 的判定期限、3% 的候选走廊、8% 的活动走廊、1.5% 的纵向意图和 0.80 的方向一致性；这些是所有档位共享的底线。三档只控制两件更贴近日常使用的事：刚按过键之后暂缓多长时间接管触控板，以及手指必须离边缘多近才算“从边缘出生”。

| 档位 | 打字后的抑制窗口 | 左侧入口条 | 右侧入口条 |
| :--- | ---: | ---: | ---: |
| Strong | 600ms | 0.6% | 1.2% |
| Standard | 350ms | 0.8% | 1.5% |
| Light | 200ms | 1.0% | 1.9% |

右侧一直比左侧宽，是验证机的触点分布使然，不是视觉上的对称要求。Strong 把入口收得最窄，Light 留出更多自然滑入的余地。它们调的是准入条件，已经激活的手势不会因为用户开始打字而在半途停掉；但如果手指还按着就改误触档位或下半区限制，程序会丢弃这次接触，等抬手后再重新开始。速度倍率和触觉强度则都在激活那一刻固定下来。

“刚按过键”这件事没有靠监听键盘实现。程序只向 Quartz 查询距最近一次 key-down 过去了多久，不安装 event tap、不看按键值，更不会读输入内容。只要一次接触因为近期打字、从内部起手、走出候选走廊或出现多指而被拒绝，它就会一直保持拒绝，直到所有手指抬起；不能靠在边缘多停一会儿把同一根手指重新变成有效手势。多指如果发生在已经激活之后，当前会话同样立即取消。这个“拒绝锁定到抬手”的规则听起来有点死板，却是把手掌和普通滑动挡在外面的关键。

macOS 自己也贡献了几处很具体的坑：

- `LSUIElement` 应用没有常规主菜单，SwiftUI 的 Settings scene 无法正常唤起，最后改成手动托管 `NSWindow`
- 这台 Mac 上的 MT y 轴是上大下小，向上滑时 y 值增加；按常见直觉反转一次，音量方向反而会错
- 原先设想的私有 MTActuator 在 macOS 26.5 上不存在。验证机最终使用 AppKit 公共触觉后端：激活时给一个提示，滑动过程中按刻度反馈；触觉后端不可用时，数值控制仍会继续，只是不提供振动

外接显示器亮度则是另一类问题。它走 DDC/CI 的 VCP `0x10` 命令，1.6.1 修过一次回复字段偏移：只错一个字节，读出的最大亮度和当前亮度就可能差一个数量级。多显示器时，写入还必须复用成功返回初始值的那条连接，否则读的是一台，写的可能是另一台。不同显示器、转接器和扩展坞的实现差异太大，所以 DDC 到现在仍是实验功能，默认关闭。

到了 1.7.x，问题已经从“能不能用”变成了“别出幺蛾子”。磨砂设置窗口曾经因为 SwiftUI 材质挂错层级而透底；连续更新 HUD 时，反复调整窗口会让颜色和明暗跳变；重复启动两个实例还可能争用触控板服务。1.7.3 最后把 HUD 展示复用、用户级 `flock` 单实例锁和音量输出设备会话固定补齐。音量手势开始后会固定当时的输出设备，如果设备中途消失，本次手势直接结束，不把旧设备算出的值写到新设备上。

还有一批平时看不见、出问题时才会被想起的收尾逻辑。成功进入控制状态之后才会冻结指针；无论正常抬手、取消、控制后端报错、睡眠还是唤醒恢复，都会结束会话并恢复指针。设备选择也不是启动后就定死：设置里可以选自动、内置或外接 Magic Trackpad，并在连接或断开设备后手动 Rescan。这里的“外接”仍只是实验性选择路径，文章不把它写成已验证支持。

蓝牙断开时，私有触控板回调可能不会留下最后一帧“所有手指已抬起”。因此程序会盯住回调静默时间，连续 750ms 没有新帧就收掉当前会话、取消尚未发出的强脉冲并重置手势状态；即使旧触点后来又来了一帧，也要等它真的抬手。睡眠唤醒则会主动刷新亮度后端、重启触控板输入。内置亮度始终优先；只有用户明确打开实验性的 DDC，才会把外接显示器当作候选后端。

触觉也不是简单地“有或没有”。Light 每跨过 4% 给一次较疏的定位反馈，Standard 和 Strong 是 2%；边界回差 0.008 避免在同一刻度来回抖动，30ms 的限速避免快速滑动变成一串嗡鸣。Strong 用更有力的公共系统模式，并在 12ms 后补一记脉冲；手势结束或睡眠恢复时，这个尚未发出的第二下会被取消。触觉档位和速度一样，在一次手势开始时固定，设置窗口不会在半程改变手感。

这些修复都没有改变手势的基本语义，处理的是“已经能工作之后，怎样少一点偶发状态”。HUD 复用解决的是连续更新时的窗口状态，单实例锁解决的是两个进程同时抢同一套触控板回调，音量会话固定则把一次手势的起点和目标设备绑在一起。它们看起来不像新功能，却决定了这个工具能不能一直放在菜单栏里而不让人担心下一次滑动会发生什么。

## 技术栈和分发

EdgeControl 的功能不多，但从触点到屏幕上的 HUD，中间还是分了几层：

<div class="v-figure">
<svg class="v-arch" viewBox="0 0 880 500" role="img" aria-label="EDGECONTROL · LAYERED ARCHITECTURE"><text x="40" y="34" font-size="10.5" font-weight="600" fill="var(--a-sub)" letter-spacing="1.6" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">EDGECONTROL · LAYERED ARCHITECTURE</text><text x="40" y="56" font-size="11" fill="var(--a-sub)" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">从私有触点回调到 HUD：每一层只暴露稳定的数据契约</text><line class="a-spine" x1="48" y1="84" x2="48" y2="466"/><rect class="a-front" x="80" y="84" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="98" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="115" r="4"/><circle class="a-chip" cx="110" cy="115" r="14"/><text class="a-title" x="110" y="119" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">01</text><text class="a-title" x="136" y="110" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">UI 层</text><text class="a-sub" x="136" y="129" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">菜单栏 · 设置窗口 · HUD</text><rect class="a-chip" x="670" y="102" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="119" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">SwiftUI + AppKit</text><rect class="a-front" x="80" y="164" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="178" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="195" r="4"/><circle class="a-chip" cx="110" cy="195" r="14"/><text class="a-title" x="110" y="199" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">02</text><text class="a-title" x="136" y="190" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">手势层</text><text class="a-sub" x="136" y="209" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">MultitouchSupport · 状态机</text><rect class="a-chip" x="670" y="182" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="199" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">私有 API 隔离</text><rect class="a-front" x="80" y="244" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="258" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="275" r="4"/><circle class="a-chip" cx="110" cy="275" r="14"/><text class="a-title" x="110" y="279" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">03</text><text class="a-title" x="136" y="270" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">控制层</text><text class="a-sub" x="136" y="289" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">CoreAudio · DisplayServices · DDC</text><rect class="a-chip" x="670" y="262" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="279" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">音量 / 亮度</text><rect class="a-front" x="80" y="324" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="338" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="355" r="4"/><circle class="a-chip" cx="110" cy="355" r="14"/><text class="a-title" x="110" y="359" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">04</text><text class="a-title" x="136" y="350" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">反馈层</text><text class="a-sub" x="136" y="369" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">AppKit 触觉 · OSLog</text><rect class="a-chip" x="670" y="342" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="359" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">触觉与日志</text><rect class="a-front" x="80" y="404" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="418" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="435" r="4"/><circle class="a-chip" cx="110" cy="435" r="14"/><text class="a-title" x="110" y="439" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">05</text><text class="a-title" x="136" y="430" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">基础设施</text><text class="a-sub" x="136" y="449" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">launchd · Sparkle · Homebrew</text><rect class="a-chip" x="670" y="422" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="439" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">分发与更新</text><text x="40" y="486" font-size="9.5" fill="var(--a-sub)" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">2D 分层：层级只由顺序和缩进表达，不用透视和阴影。</text></svg>
<p class="v-caption">图 1：EdgeControl 的分层架构。私有 API 只出现在手势层，UI 与控制层使用稳定契约。</p>
</div>

UI 主要用 SwiftUI，窗口层级、材质和 `LSUIElement` 下的设置窗口由 AppKit 兜底。触点从 MultitouchSupport 进入 C bridge，再交给 Swift 手势状态机。音量走 CoreAudio，内置亮度走 DisplayServices，外接亮度才会在用户明确开启后尝试 DDC/CI。触觉使用 AppKit，日志使用 OSLog。

SwiftUI 负责的是菜单栏 Popover、设置内容和状态展示，AppKit 负责那些必须精确控制生命周期的部分：窗口什么时候创建、显示在哪个屏幕、材质挂在哪一层，以及菜单栏应用没有常规主菜单时怎样稳定打开设置。两者混用并不是为了堆技术栈，而是因为 `LSUIElement` 这个运行形态本身就绕开了 SwiftUI 默认假设的应用窗口流程。

基础设施部分包括 `flock` 单实例锁、Sparkle 更新和 76 个 XCTest 测试方法。手势识别的大部分测试使用合成触点，不需要每次都在真机上划，但触觉、睡眠唤醒、设备切换和私有 API 行为仍然必须回到硬件上验证。合成测试能守住状态机，代替不了手指和机器。

分发链路比写完 app 多了不少步骤。当前版本没有 Developer ID 证书，只做完整的 ad-hoc bundle 签名，也不宣称公证；首次启动仍可能遇到 Gatekeeper，需要右键打开，或者通过 Homebrew 的 `--no-quarantine` 安装。Release 同时构建 arm64 和 x86_64，打包 DMG、ZIP 与签名 appcast，再同步 GitHub Releases 和 Homebrew cask。现在一条命令就能装好：

```bash
brew install --cask leecdiang/edgecontrol/edgecontrol
```

## 到 1.7.3

当前版本是 v1.7.3，验证机上 76/76 个 XCTest 方法通过，仓库检查、Universal 2 Release 构建和完整 ad-hoc 签名校验也都通过。这里的 Universal 2 只表示构建产物包含 arm64 与 x86_64，不等于已经在 Intel 真机上验证。

还有几条边界需要继续摆在明面上：外接显示器 DDC 仍是实验功能；物理音频设备切换、登录项并发、Sparkle 重启和睡眠唤醒仍需要更多本地流程验证；外接触控板、Intel、其他 macOS 版本以及全新机器上的 Gatekeeper 行为，也都没有足够的硬件证据。能构建、能通过合成测试，和在所有机器上都可靠，是两回事。

我会把“已经验证”和“理论上应该可以”分开写。当前验证机是 Apple Silicon 的 MacBook Air，76/76 的测试覆盖了状态机和不少边界条件，但触觉反馈、设备切换、睡眠唤醒以及 DDC 的真实表现仍然受硬件和系统组合影响。Universal 2 让同一个发布包带上两种架构，不会自动替我完成 Intel 真机验证；构建成功也不能替代那一次真实的触控板滑动。

十四天，十五个版本。最开始只是想把小米触控板上的一个手势搬到 Mac，做着做着却碰到了私有 ABI、状态机、CoreAudio、显示器协议、窗口材质、签名和分发。我现在再看这段提交记录，记住的是两件很具体的事：私有 API 没有文档，但字节不会骗人；调参没有捷径，但一套完整的正负例矩阵，至少能让每次改动都有底。

项目开源，有问题提 issue，想改代码直接 PR。最新版本：<a href="https://github.com/leecdiang/EdgeControl/releases/latest" target="_blank" class="glass-pill"><i class="fab fa-apple"></i> EdgeControl 最新 Release</a>
