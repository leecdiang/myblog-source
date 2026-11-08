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

小胡的小米 Book Pro14 能从触控板边缘滑入，调音量和亮度。我第一次用就喜欢上了：手指从机身滑上去，向上音量变大，向下变小，每到一个刻度还有一下清脆振动。很像拨 EDC 玩具，手指有动作，东西有回应。

我的看法很直接：**没有振动反馈的机器，没必要做这个功能。** 音量变了，手指却什么都没收到，边缘手势也就只是少按了几次键；有了振动，它才更像在拨一个看不见的实体旋钮。

我要搬过来的也包括这一下触觉：进入边缘，改变数值，手指收到脉冲，再决定是否继续推。所以原型一开始就把触觉和手势放在一起验证，不能只确认音量改了就算做完。

回到自己的 MacBook Air，这个功能却不存在。我搜了一圈，找到的方案要么收费、要么闭源，要么塞进了太多我用不到的东西。免费、开源、轻量、离线，这几个条件放在一起，没找到合适的。

那就自己写。项目仓库：<a href="https://github.com/leecdiang/EdgeControl" target="_blank" class="glass-pill"><i class="fab fa-github"></i> leecdiang/EdgeControl</a>

## 先把边界划清楚

项目 README 的第一行：

> Two edges. Two controls. Nothing else.

两条边缘，两个控制。它的范围也一直按这句话来定：

- 左边缘、右边缘各自独立指派：音量 / 亮度 / 关闭
- 手势必须诞生在边缘：手指先落在触控板内部、再滑到边缘的，永不触发
- 无账号、无遥测、没有自建后端；更新功能只会从 GitHub Releases 托管的签名 appcast 检查新版本，默认自动检查，也可手动触发
- 菜单栏常驻（`LSUIElement`），没有 Dock 图标，不打扰

只看最后的位置，会把移动光标、拖文件和手掌接触也当成手势。程序必须记住接触起点、方向和明确的纵向意图，再决定接管。

后面的大部分调试，都与这条规则有关。

具体到一次接触，它必须由单指从对应边缘进入，再及时形成上下意图。内部起手后滑到边缘，整个接触周期都拒绝；多指、手掌和刚打字后的接触，也不能碰到边缘就触发。

我宁愿含糊的滑动需要重来一次，也不想拖文件时突然把音量改了。这决定了准入阶段要保守。

## 两周十五个版本

从第一次提交到 v1.7.3，一共两周：

- 8 月 16 日晚：第一次提交，P1-P8 原型期开始
- 8 月 17 日凌晨：v1.0.0 发布，一个晚上
- 8 月 30 日：v1.7.3 发布，前后十五个版本，两周

v1.0.0 之前的提交按 P1-P8 编号，最不确定的部分被一关一关跑通：能不能读到触点，坐标方向对不对，音量和亮度能不能连续变化，触觉有没有反馈。设置窗口反而排在最后。

先确认触点步长和坐标，再确认状态机的激活、取消边界，随后才验证音量、亮度与 HUD。底层输入错了，上层映射再顺滑也没有用。设置界面可以稍后做，这些行为需要逐层拿到证据。

| 阶段 | 内容 |
| :--- | :--- |
| P1/P2 | 修复 MT contact ABI 结构体步长 80→96；边缘接触调参 |
| P2 | entryTimeout 250→350ms；A-K 手势矩阵全量验证 |
| P3 | 音量端到端验证；修复 y 轴极性；dwell-then-push 调参 |
| P4 | 内置亮度端到端（DisplayServices）；增益调至 2.0，边缘满行程覆盖 0-100 |
| P5 | 触觉验证；确认 MTActuator 在 macOS 26.5 不存在，退回公共后端 |
| P8 | 救活 LSUIElement 应用里的设置窗口（手动 NSWindow） |

那个晚上多数时间花在 P1/P2，原始触点是后续工作的前提。

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

多数版本没有扩张功能，而是在修误触和边界条件。这个工具要一直挂在菜单栏里，难处正是该出现时出现，其余时间别接管。

1.1.0 到 1.3.1 主要收紧识别：方向判断挡住手掌抖动，过零取消处理反向滑动，下半区模式避免入口位置导致跳值。1.4.0 后才补速度、触觉、HUD 与分发。每轮只改一类，回归与真机轨迹才容易对应到实际变化。

## 私有 API、调参与系统怪脾气

第一道坎是 96 字节。

MultitouchSupport 是没有公开文档的私有框架。最初按 80 字节步长遍历 contact，数据全乱了。用探针逐字节打印，再对照已知触点坐标，才确认验证机上的步长为 96 字节。

96 字节只描述当前验证机的 ABI。私有布局可能随硬件和系统变化，因此 C bridge 负责动态加载与最小解析，Swift 侧使用稳定契约。框架、符号或初始化出问题时，就把功能置为不可用，不能继续解释未知内存。

探针本身还遇到过一个很容易误判的细节：把结果重定向到标准输出时，stdout 可能被缓冲。程序明明读到了触点，终端里却像什么都没有。后来给探针设置无缓冲输出，或者在关键位置主动 `fflush`，才把“没有回调”和“输出还没刷出来”区分开。这样的细节不会出现在功能列表里，却经常占掉真正调试时间。

动态加载使用 `dlopen` / `dlsym`。这一层遇到未知环境就退出，不把私有符号当成永久契约。

数据读对之后，才轮到手势本身。边缘入口宽度、意图判定窗口（entryTimeout）、候选走廊、方向阈值，这些参数都没有标准答案。手指并不会沿着一条笔直的数学曲线移动，同一个人快滑、慢滑、先停一下再推，轨迹都不一样。原型期因此做了一套 A-K 手势矩阵：边缘诞生、向上和向下这些正例必须触发；内部起手、多指、手掌等负例必须拒绝。后来每次改识别语义，都先补回归测试，再动参数。

当前这套参数来自验证机上的实测轨迹：左侧入口条是 0.008，右侧是 0.015，候选阶段只能在距离边缘 3% 的走廊里移动，激活后放宽到 8%；450ms 内要完成至少 1.5% 的纵向移动，而且方向一致性要达到 0.80。右侧入口条刻意比左侧宽一点，是因为这台机器上右侧的有效边缘接触分布更靠外，放宽后能补回自然滑入的样本，又不会把候选阶段变成一条大面积的触发区。每个数字都不是“看起来舒服”就留下，而是要和正例、负例轨迹一起看。

激活后，以起始音量或亮度叠加累计纵向位移、基础增益和速度倍率，再钳制到 0–1。下半区也用相对映射，避免不同高度进入时跳值。相比怎样变更数值，确认用户是否想变更更费功夫。

激活前后因此用不同规则：450ms 内没有明确上下意图就结束；进入 Active 后，活动走廊放宽到 8%，速度倍率固定，保证连续控制。反向滑动越过 0.5% 死区时取消本次手势，避免缓慢回拉悄悄改掉已确认的方向。

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

1.7.x 主要处理持续使用时的状态错误：设置窗口材质挂错层级会透底，HUD 连续调窗会跳色，两个实例会争触控板服务。1.7.3 补了 HUD 复用、用户级 `flock` 锁和音量会话设备固定。手势开始后输出设备不再变；它若中途消失，就结束手势，不能把旧设备的值写到新设备。

还有一批平时看不见、出问题时才会被想起的收尾逻辑。成功进入控制状态之后才会冻结指针；无论正常抬手、取消、控制后端报错、睡眠还是唤醒恢复，都会结束会话并恢复指针。设备选择也不是启动后就定死：设置里可以选自动、内置或外接 Magic Trackpad，并在连接或断开设备后手动 Rescan。这里的“外接”仍只是实验性选择路径，文章不把它写成已验证支持。

蓝牙断开时，私有触控板回调可能不会留下最后一帧“所有手指已抬起”。因此程序会盯住回调静默时间，连续 750ms 没有新帧就收掉当前会话、取消尚未发出的强脉冲并重置手势状态；即使旧触点后来又来了一帧，也要等它真的抬手。睡眠唤醒则会主动刷新亮度后端、重启触控板输入。内置亮度始终优先；只有用户明确打开实验性的 DDC，才会把外接显示器当作候选后端。

触觉也不是简单地“有或没有”。Light 每跨过 4% 给一次较疏的定位反馈，Standard 和 Strong 是 2%；边界回差 0.008 避免在同一刻度来回抖动，30ms 的限速避免快速滑动变成一串嗡鸣。Strong 用更有力的公共系统模式，并在 12ms 后补一记脉冲；手势结束或睡眠恢复时，这个尚未发出的第二下会被取消。触觉档位和速度一样，在一次手势开始时固定，设置窗口不会在半程改变手感。

这些修改处理的是已能工作之后的偶发状态。HUD、进程实例和音频设备，各自都需要在一次操作期间保持一致。

## 技术栈和分发

触点到 HUD，按下面几层连接：

<div class="v-figure">
<svg class="v-arch" viewBox="0 0 880 500" role="img" aria-label="EDGECONTROL · LAYERED ARCHITECTURE"><text x="40" y="34" font-size="10.5" font-weight="600" fill="var(--a-sub)" letter-spacing="1.6" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">EDGECONTROL · LAYERED ARCHITECTURE</text><text x="40" y="56" font-size="11" fill="var(--a-sub)" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">从私有触点回调到 HUD：每一层只暴露稳定的数据契约</text><line class="a-spine" x1="48" y1="84" x2="48" y2="466"/><rect class="a-front" x="80" y="84" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="98" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="115" r="4"/><circle class="a-chip" cx="110" cy="115" r="14"/><text class="a-title" x="110" y="119" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">01</text><text class="a-title" x="136" y="110" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">UI 层</text><text class="a-sub" x="136" y="129" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">菜单栏 · 设置窗口 · HUD</text><rect class="a-chip" x="670" y="102" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="119" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">SwiftUI + AppKit</text><rect class="a-front" x="80" y="164" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="178" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="195" r="4"/><circle class="a-chip" cx="110" cy="195" r="14"/><text class="a-title" x="110" y="199" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">02</text><text class="a-title" x="136" y="190" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">手势层</text><text class="a-sub" x="136" y="209" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">MultitouchSupport · 状态机</text><rect class="a-chip" x="670" y="182" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="199" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">私有 API 隔离</text><rect class="a-front" x="80" y="244" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="258" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="275" r="4"/><circle class="a-chip" cx="110" cy="275" r="14"/><text class="a-title" x="110" y="279" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">03</text><text class="a-title" x="136" y="270" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">控制层</text><text class="a-sub" x="136" y="289" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">CoreAudio · DisplayServices · DDC</text><rect class="a-chip" x="670" y="262" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="279" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">音量 / 亮度</text><rect class="a-front" x="80" y="324" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="338" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="355" r="4"/><circle class="a-chip" cx="110" cy="355" r="14"/><text class="a-title" x="110" y="359" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">04</text><text class="a-title" x="136" y="350" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">反馈层</text><text class="a-sub" x="136" y="369" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">AppKit 触觉 · OSLog</text><rect class="a-chip" x="670" y="342" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="359" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">触觉与日志</text><rect class="a-front" x="80" y="404" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="418" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="435" r="4"/><circle class="a-chip" cx="110" cy="435" r="14"/><text class="a-title" x="110" y="439" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">05</text><text class="a-title" x="136" y="430" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">基础设施</text><text class="a-sub" x="136" y="449" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">launchd · Sparkle · Homebrew</text><rect class="a-chip" x="670" y="422" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="439" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">分发与更新</text><text x="40" y="486" font-size="9.5" fill="var(--a-sub)" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">2D 分层：层级只由顺序和缩进表达，不用透视和阴影。</text></svg>
<p class="v-caption">图 1：EdgeControl 的分层架构。私有 API 只出现在手势层，UI 与控制层使用稳定契约。</p>
</div>

UI 主要用 SwiftUI，窗口层级、材质和 `LSUIElement` 下的设置窗口由 AppKit 兜底。触点从 MultitouchSupport 进入 C bridge，再交给 Swift 手势状态机。音量走 CoreAudio，内置亮度走 DisplayServices，外接亮度才会在用户明确开启后尝试 DDC/CI。触觉使用 AppKit，日志使用 OSLog。

SwiftUI 处理 Popover、设置内容和状态，AppKit 管窗口创建、屏幕位置与材质层级。`LSUIElement` 没有常规主菜单，无法完全沿用 SwiftUI 默认的设置窗口流程，手动托管窗口就是为了解决这个差别。

基础设施还有 `flock`、Sparkle 更新和 76 个 XCTest 方法。合成触点能检查状态机，触觉、睡眠唤醒、切设备和私有 API 则还要真机验证。两部分证据各管一段。

分发链路比写完 app 多了不少步骤。当前版本没有 Developer ID 证书，只做完整的 ad-hoc bundle 签名，也不宣称公证；首次启动仍可能遇到 Gatekeeper，需要右键打开，或者通过 Homebrew 的 `--no-quarantine` 安装。Release 同时构建 arm64 和 x86_64，打包 DMG、ZIP 与签名 appcast，再同步 GitHub Releases 和 Homebrew cask。现在一条命令就能装好：

```bash
brew install --cask leecdiang/edgecontrol/edgecontrol
```

## 到 1.7.3

当前版本是 v1.7.3，验证机上 76/76 个 XCTest 方法通过，仓库检查、Universal 2 Release 构建和完整 ad-hoc 签名校验也都通过。这里的 Universal 2 只表示构建产物包含 arm64 与 x86_64，不等于已经在 Intel 真机上验证。

还有几条边界需要继续摆在明面上：外接显示器 DDC 仍是实验功能；物理音频设备切换、登录项并发、Sparkle 重启和睡眠唤醒仍需要更多本地流程验证；外接触控板、Intel、其他 macOS 版本以及全新机器上的 Gatekeeper 行为，也都没有足够的硬件证据。能构建、能通过合成测试，和在所有机器上都可靠，是两回事。

当前验证机是 Apple Silicon MacBook Air。76/76 主要支撑状态机和边界条件，不能延伸为其他硬件组合都可靠。尤其是触觉和触控板行为，仍需要一次次回到机器上试。

两周十五个版本，最初的边缘手势牵出了 ABI、状态机、CoreAudio、显示器协议和分发。回看这些提交，我最想保留的是两种调试办法：布局不清楚就打印字节，比对实际触点；参数要改就带着正负例矩阵，确认修好的轨迹没有放进新的误触。

项目开源，有问题提 issue，想改代码直接 PR。最新版本：<a href="https://github.com/leecdiang/EdgeControl/releases/latest" target="_blank" class="glass-pill"><i class="fab fa-apple"></i> EdgeControl 最新 Release</a>
