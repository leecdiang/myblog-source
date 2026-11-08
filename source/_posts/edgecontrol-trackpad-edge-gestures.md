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
description: "EdgeControl 从原型到 v1.7.3 的开发记录：私有触控接口解析、边缘手势状态机、触觉反馈、误触防御与分发维护，并说明验证机结果的适用范围。"
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

## 开发动机：边缘输入与触觉反馈

小胡的小米 Book Pro14 提供触控板边缘音量、亮度控制。第一次使用时，我注意到每次刻度变化都伴随清晰振动，手指从机身滑入后，上下移动与数值变化形成稳定对应。这种反馈接近实体控件，也是我希望移植到 Mac 的部分。

对这个功能，我更看重触觉与控制之间的联系：只有数值变化，边缘手势只是另一种输入入口；刻度脉冲则提供了指尖可感知的状态反馈。因此，我不认为缺少振动反馈时仍有相同的设计价值。

原型阶段同时验证手势和触觉：边缘进入建立候选，数值变化触发脉冲，反馈再帮助判断是否继续移动。单独确认音量可以修改，还不足以验证这套交互。

MacBook Air 缺少相同功能。检索到的方案在收费、闭源或功能范围上不符合我的需求，免费、开源、轻量和离线成为这个实现的边界。

我因此开始实现 EdgeControl。项目仓库：<a href="https://github.com/leecdiang/EdgeControl" target="_blank" class="glass-pill"><i class="fab fa-github"></i> leecdiang/EdgeControl</a>

## 功能范围与手势准入条件

项目 README 的第一行：

> Two edges. Two controls. Nothing else.

功能限定为两条边缘的独立控制，并据此确定以下约束：

- 左边缘、右边缘各自独立指派：音量 / 亮度 / 关闭
- 手势必须诞生在边缘：手指先落在触控板内部、再滑到边缘的，永不触发
- 无账号、无遥测、没有自建后端；更新功能只会从 GitHub Releases 托管的签名 appcast 检查新版本，默认自动检查，也可手动触发
- 菜单栏常驻（`LSUIElement`），没有 Dock 图标，不打扰

仅根据最终位置判定，会将光标移动、拖拽和手掌接触混入手势。识别器需要记录接触起点、运动方向和纵向意图，再决定是否接管输入。

因此，接触的完整生命周期是识别单位，边缘位置只是准入条件之一。

有效接触必须由单指在对应边缘开始，并在判定窗口内形成明确上下意图。内部起手后到达边缘仍保持拒绝；多指、手掌和近期打字后的接触也需经过独立限制。

误触会改变用户并未打算调整的系统状态，漏识别通常只要求重新操作一次。因此，我将准入阶段设为保守判定，优先保护普通触控板操作。

## 两周十五个版本

从第一次提交到 v1.7.3，一共两周：

- 8 月 16 日晚：第一次提交，P1-P8 原型期开始
- 8 月 17 日凌晨：v1.0.0 发布，一个晚上
- 8 月 30 日：v1.7.3 发布，前后十五个版本，两周

P1-P8 先后验证原始触点、坐标方向、连续音量亮度控制和触觉反馈，设置窗口随后加入。验证顺序对应各层输入与输出的依赖。

步长和坐标是状态机的前提，激活与取消规则又是映射的前提；音量、亮度和 HUD 只有在这些条件稳定后才有解释意义。逐层验证可以避免上层完整掩盖底层输入错误。

| 阶段 | 内容 |
| :--- | :--- |
| P1/P2 | 修复 MT contact ABI 结构体步长 80→96；边缘接触调参 |
| P2 | entryTimeout 250→350ms；A-K 手势矩阵全量验证 |
| P3 | 音量端到端验证；修复 y 轴极性；dwell-then-push 调参 |
| P4 | 内置亮度端到端（DisplayServices）；增益调至 2.0，边缘满行程覆盖 0-100 |
| P5 | 触觉验证；确认 MTActuator 在 macOS 26.5 不存在，退回公共后端 |
| P8 | 救活 LSUIElement 应用里的设置窗口（手动 NSWindow） |

P1/P2 占用了当晚多数调试时间，原始触点的正确解析限制了后续验证进度。

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

多数后续版本处理误触和边界条件。菜单栏常驻工具需要在普通移动、拖拽和输入期间保持不干预，识别稳定性因而比扩张手势数量更重要。

1.1.0 到 1.3.1 主要收紧识别：方向判断挡住手掌抖动，过零取消处理反向滑动，下半区模式避免入口位置导致跳值。1.4.0 后才补速度、触觉、HUD 与分发。每轮只改一类，回归与真机轨迹才容易对应到实际变化。

## 私有 ABI、状态机参数与系统接口

原始输入首先遇到 contact 结构体的 96 字节步长问题。

MultitouchSupport 缺少公开布局文档。初始按 80 字节遍历 contact，无法得到一致坐标；随后逐字节输出缓冲，并与已知触点位置对照，才确认验证机的实际步长为 96 字节。

这一 96 字节结果只对应当前验证机 ABI，不能作为全部 Mac 的稳定常量。C bridge 仅负责动态加载和最小解析，Swift 使用独立数据契约；框架、符号或初始化失败时，将能力置为不可用，避免继续解释未知布局。

探针输出还受 stdout 缓冲影响。重定向后未见输出，不能直接判断没有触点回调；设为无缓冲或在关键位置 `fflush` 后，才能区分输入缺失与日志尚未刷新。

`dlopen` / `dlsym` 用于运行时发现符号，失败则终止对应路径。私有接口的可用性因而作为运行条件处理。

输入稳定后，边缘宽度、entryTimeout、候选走廊和方向阈值还需依据轨迹确定。原型建立 A-K 矩阵，覆盖边缘起手和上下移动的正例，以及内部起手、多指和手掌负例。改变识别语义前先补回归，使调参始终受到明确样本约束。

验证机参数为：左入口 0.008、右入口 0.015，候选走廊 3%、激活后 8%；450ms 内至少完成 1.5% 纵向移动，方向一致性不低于 0.80。右入口较宽来自该机有效接触的分布，意在补回自然滑入样本，而不扩大候选走廊。参数只对应已测正负轨迹，不能视为跨设备通用值。

激活后采用相对映射，以起始音量或亮度叠加累计纵向位移、基础增益与速度倍率，再限制到 0–1。下半区使用相同语义，避免入口高度改变初值；主要识别难点仍在激活前的意图判断。

候选阶段在 450ms 内未形成意图即结束；Active 阶段使用 8% 走廊并固定速度倍率，保证连续映射。反向移动越过 0.5% 死区则取消会话，避免已确认方向被缓慢回拉改变。

### 准入保护与激活状态的分离

设置里的误触保护有 Light、Standard、Strong 三档。它们不去改 450ms 的判定期限、3% 的候选走廊、8% 的活动走廊、1.5% 的纵向意图和 0.80 的方向一致性；这些是所有档位共享的底线。三档只控制两件更贴近日常使用的事：刚按过键之后暂缓多长时间接管触控板，以及手指必须离边缘多近才算“从边缘出生”。

| 档位 | 打字后的抑制窗口 | 左侧入口条 | 右侧入口条 |
| :--- | ---: | ---: | ---: |
| Strong | 600ms | 0.6% | 1.2% |
| Standard | 350ms | 0.8% | 1.5% |
| Light | 200ms | 1.0% | 1.9% |

左右宽度不对称来自验证机的接触分布。Strong 缩窄入口，Light 保留较多滑入余量，但不改变已激活手势。接触期间修改保护档位或下半区限制，会丢弃当前接触并等待抬手；速度与触觉参数则在激活时固定。

近期打字只通过 Quartz 查询距上次 key-down 的时间，不安装 event tap，也不读取按键值或输入内容。因近期打字、内部起手、越出候选走廊或多指被拒绝的接触，保持拒绝直到全部抬手；激活后出现多指也立即取消。该锁定避免同一次无效接触因停留位置改变而重新准入。

其他系统接口问题包括：

- `LSUIElement` 应用没有常规主菜单，SwiftUI 的 Settings scene 无法正常唤起，最后改成手动托管 `NSWindow`
- 这台 Mac 上的 MT y 轴是上大下小，向上滑时 y 值增加；按常见直觉反转一次，音量方向反而会错
- 原先设想的私有 MTActuator 在 macOS 26.5 上不存在。验证机最终使用 AppKit 公共触觉后端：激活时给一个提示，滑动过程中按刻度反馈；触觉后端不可用时，数值控制仍会继续，只是不提供振动

外接亮度采用 DDC/CI VCP `0x10`。1.6.1 修复回复字段偏移，一字节错误即可使当前值和最大值出现数量级偏差。多显示器写入还必须复用成功读取初值的连接，保证目标一致。显示器、转接器和扩展坞差异尚未充分覆盖，因此 DDC 默认关闭并标为实验功能。

1.7.x 处理了设置材质透底、HUD 连续更新跳色和多实例争用。1.7.3 增加 HUD 复用、用户级 `flock` 锁与音频目标固定；会话中输出设备消失即结束操作，避免旧设备计算结果写入新设备。

指针仅在控制激活后冻结，正常抬手、取消、后端错误、睡眠和唤醒均进入结束与恢复流程。设备可选自动、内置或外接 Magic Trackpad，并支持连接变化后的 Rescan；外接选项仍属于实验路径，不构成已验证兼容声明。

蓝牙中断可能缺少最终抬手帧，因此以 750ms 回调静默作为结束条件，同时取消待发强脉冲并重置状态。旧触点恢复后仍需等待实际抬手。唤醒时刷新亮度后端并重启输入；内置亮度优先，外接后端仅在用户启用实验 DDC 后参与选择。

Light 每 4% 给一次刻度反馈，Standard 和 Strong 为 2%；0.008 回差抑制边界抖动，30ms 限速控制触觉频率。Strong 在公共系统模式后延迟 12ms 补脉冲，会话结束或睡眠恢复时取消待发脉冲。一次会话的参数固定，避免设置变化改变中途反馈。

这些修复分别保护窗口、进程和目标设备的一致性，处理的是控制已建立后的生命周期，而非新增识别功能。

## 模块职责、验证与分发

从原始触点到 HUD，接口关系如下。

<div class="v-figure">
<svg class="v-arch" viewBox="0 0 880 500" role="img" aria-label="EDGECONTROL · LAYERED ARCHITECTURE"><text x="40" y="34" font-size="10.5" font-weight="600" fill="var(--a-sub)" letter-spacing="1.6" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">EDGECONTROL · LAYERED ARCHITECTURE</text><text x="40" y="56" font-size="11" fill="var(--a-sub)" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">从私有触点回调到 HUD：每一层只暴露稳定的数据契约</text><line class="a-spine" x1="48" y1="84" x2="48" y2="466"/><rect class="a-front" x="80" y="84" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="98" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="115" r="4"/><circle class="a-chip" cx="110" cy="115" r="14"/><text class="a-title" x="110" y="119" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">01</text><text class="a-title" x="136" y="110" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">UI 层</text><text class="a-sub" x="136" y="129" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">菜单栏 · 设置窗口 · HUD</text><rect class="a-chip" x="670" y="102" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="119" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">SwiftUI + AppKit</text><rect class="a-front" x="80" y="164" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="178" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="195" r="4"/><circle class="a-chip" cx="110" cy="195" r="14"/><text class="a-title" x="110" y="199" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">02</text><text class="a-title" x="136" y="190" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">手势层</text><text class="a-sub" x="136" y="209" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">MultitouchSupport · 状态机</text><rect class="a-chip" x="670" y="182" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="199" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">私有 API 隔离</text><rect class="a-front" x="80" y="244" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="258" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="275" r="4"/><circle class="a-chip" cx="110" cy="275" r="14"/><text class="a-title" x="110" y="279" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">03</text><text class="a-title" x="136" y="270" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">控制层</text><text class="a-sub" x="136" y="289" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">CoreAudio · DisplayServices · DDC</text><rect class="a-chip" x="670" y="262" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="279" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">音量 / 亮度</text><rect class="a-front" x="80" y="324" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="338" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="355" r="4"/><circle class="a-chip" cx="110" cy="355" r="14"/><text class="a-title" x="110" y="359" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">04</text><text class="a-title" x="136" y="350" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">反馈层</text><text class="a-sub" x="136" y="369" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">AppKit 触觉 · OSLog</text><rect class="a-chip" x="670" y="342" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="359" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">触觉与日志</text><rect class="a-front" x="80" y="404" width="770" height="62" rx="14"/><rect class="a-accent" x="80" y="418" width="3" height="34" rx="1.5"/><circle class="a-dot" cx="48" cy="435" r="4"/><circle class="a-chip" cx="110" cy="435" r="14"/><text class="a-title" x="110" y="439" text-anchor="middle" font-size="9.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">05</text><text class="a-title" x="136" y="430" font-size="14.5" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">基础设施</text><text class="a-sub" x="136" y="449" font-size="10.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">launchd · Sparkle · Homebrew</text><rect class="a-chip" x="670" y="422" width="160" height="26" rx="13"/><text class="a-chip-text" x="750" y="439" text-anchor="middle" font-size="9.5" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">分发与更新</text><text x="40" y="486" font-size="9.5" fill="var(--a-sub)" font-family="-apple-system,BlinkMacSystemFont,SF Pro Text,Segoe UI,sans-serif">2D 分层：层级只由顺序和缩进表达，不用透视和阴影。</text></svg>
<p class="v-caption">图 1：EdgeControl 的分层架构。私有 API 只出现在手势层，UI 与控制层使用稳定契约。</p>
</div>

SwiftUI 负责页面内容，AppKit 处理窗口、触觉与 `LSUIElement` 应用中的设置窗口。触点由 MultitouchSupport 经 C bridge 进入 Swift 状态机；CoreAudio 承担音量，DisplayServices 承担内置亮度，DDC/CI 仅在实验选项开启后处理外接显示器，日志使用 OSLog。

Popover、设置内容和状态由 SwiftUI 维护，窗口创建、屏幕位置及材质层级由 AppKit 管理。`LSUIElement` 缺少常规主菜单，手动托管窗口用于补足默认 Settings scene 在这一应用形态下的限制。

基础设施包括 `flock`、Sparkle 与 76 个 XCTest 方法。合成触点验证状态机规则，触觉、睡眠、设备切换和私有 API 仍需真机检验，不能由合成测试推断硬件行为。

分发链路比写完 app 多了不少步骤。当前版本没有 Developer ID 证书，只做完整的 ad-hoc bundle 签名，也不宣称公证；首次启动仍可能遇到 Gatekeeper，需要右键打开，或者通过 Homebrew 的 `--no-quarantine` 安装。Release 同时构建 arm64 和 x86_64，打包 DMG、ZIP 与签名 appcast，再同步 GitHub Releases 和 Homebrew cask。现在一条命令就能装好：

```bash
brew install --cask leecdiang/edgecontrol/edgecontrol
```

## v1.7.3 的验证范围与未解决问题

当前版本是 v1.7.3，验证机上 76/76 个 XCTest 方法通过，仓库检查、Universal 2 Release 构建和完整 ad-hoc 签名校验也都通过。这里的 Universal 2 只表示构建产物包含 arm64 与 x86_64，不等于已经在 Intel 真机上验证。

DDC 仍为实验功能；物理音频切换、登录项并发、Sparkle 重启和睡眠唤醒还需扩展验证。外接触控板、Intel、其他 macOS 与全新机器上的 Gatekeeper 行为，也缺少充分硬件证据。构建成功和合成测试通过，只支持各自覆盖的条件。

当前验证机为 Apple Silicon MacBook Air，76/76 主要覆盖状态机及边界。触觉、触控板和外设行为仍依赖具体硬件与系统组合，不能据此扩展到全部平台。

这两周的实现使问题逐步从手势映射转向 ABI、状态所有权和系统集成。对私有布局，保留字节与轨迹对照；对识别参数，保留正负例矩阵，是后续继续修改时可以复用的验证依据。

项目开源，有问题提 issue，想改代码直接 PR。最新版本：<a href="https://github.com/leecdiang/EdgeControl/releases/latest" target="_blank" class="glass-pill"><i class="fab fa-apple"></i> EdgeControl 最新 Release</a>
