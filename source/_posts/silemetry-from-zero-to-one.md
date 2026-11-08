---
lang: zh-CN
title: "Silemetry：Apple Silicon 持续负载测量工具的开发记录"
date: 2026-08-03 14:30:00
categories:
  - Everyday Anatomy
etoc: true
published: true
tags:
  - macOS
  - SwiftUI
  - Rust
  - Metal
  - Apple Silicon
  - 项目复盘
description: "Silemetry 从 7 月 28 日首次提交到 8 月 3 日 v0.2.1 的开发记录，重点讨论四语言架构、Apple Silicon 遥测、负载控制、并发缺陷、数据完整性与发布验证。"
keywords: Silemetry, macOS, SwiftUI, Rust, Metal, Apple Silicon, 遥测, 散热测试, 性能分析, 项目复盘
---

> **Silemetry — See what your silicon can sustain.**

Silemetry 是一款面向 Apple Silicon 的持续负载测量工具，将温度、功耗、频率、每核心利用率与电源状态记录在同一时间轴上。应用提供 CPU、GPU 及混合负载，并保留从空闲基线、负载升温到停止后冷却的完整采样过程。

从 7 月 28 日第一次提交到 8 月 3 日完成 v0.2.1，项目经历了一周开发。最初的目标是观察 MacBook Air 在持续负载下的降频行为；随着测量需求展开，实现逐步涉及 SwiftUI 界面、Rust 遥测、C 与 Metal 负载、SwiftData 与 JSONL 存储，以及 CI 和 DMG 分发。

本文记录这些实现选择及其约束，重点讨论数据口径、并发资源的生命周期、文件与数据库的一致性，以及跨语言接口中实际发生的错误。

项目仓库：<a href="https://github.com/leecdiang/Silemetry-mac" target="_blank" class="glass-pill"><i class="fab fa-github"></i> leecdiang/Silemetry-mac</a>

![](silemetry-overview.png)

## 1. 项目动机与目标

### 1.1 MacBook Air 的持续性能问题

我的主力机是 M4 MacBook Air。无风扇设计带来了安静、轻薄和较长续航，也使持续负载下的散热主要依赖均热结构、外壳与自然对流。

浏览网页、处理文档通常不容易暴露这一约束，长时间编译、视频导出、本地推理和科学计算则会持续积累热量。系统通过频率、电压及调度调整控制温度和功耗，任务的执行速度也可能随之变化：初始表现、持续运行后的波动，以及停止负载后的恢复过程，需要分别观察。

因此，我关心的是性能变化与运行条件在时间上的对应关系：

- 第几分钟开始降频？
- 降频前后的频率和功耗分别是多少？
- CPU 与 GPU 同时工作时，谁先受热限制？
- 机身冷却后，性能恢复需要多久？
- 两次测试之间的差异究竟来自散热条件，还是来自供电、低电量模式和后台进程？

最终分数无法还原这些过程，主观感受到的变慢也不足以区分热限制与其他干扰。

### 1.2 单次跑分与过程测量的差异

Geekbench 更偏重短时峰值，Cinebench 循环可以呈现部分持续性能衰减。但若要解释衰减发生时的运行状态，仍需同步记录温度、功耗与频率，并将它们对齐到同一条时间轴。

需要保留的测量过程如下：

```text
空闲状态 → 开始负载 → 温度爬升 → 功耗稳定 → 频率变化 → 停止负载 → 冷却恢复
```

例如，若第 6 分钟出现频率下降，就应能定位同一时刻的温度、CPU/GPU 功耗和 Thermal State，而不只看到一条下降曲线。更换环境或散热条件后，两轮测试也应能在相同数据口径下对照。

这一需求决定了开发顺序：先建立连续测量与记录能力，再设计可控的压力负载。

### 1.3 测量对象：持续负载下的系统行为

持续性能取决于芯片、封装、机身散热、调度、供电与工作负载之间的共同作用。单一硬件参数无法描述这组约束随时间变化的结果。

要使测试过程能够复核，工具需要同时满足连续采样、负载可重复和记录完整三个条件。

1. **连续采样**：温度、功耗、频率和利用率需要按时间记录；
2. **稳定负载**：必须有可控、可重复的 CPU/GPU 工作负载；
3. **完整保存**：测试结束后能够回看、导出和比较，而不是只显示一个瞬时数字。

保存完整过程后，才有依据比较系统版本、室温、供电条件或优化前后的差异，并检查这些差异是否伴随其他条件变化。

### 1.4 项目边界：原生、轻量、不关闭 SIP、不安装内核扩展

立项时定下的范围如下。

- **原生应用**：使用 SwiftUI 和 macOS 原生框架，不使用 Electron 套壳；
- **开箱即用**：拖入 Applications 即可，不依赖 Homebrew、Python 或外部服务；
- **无需管理员权限**：运行测试时不弹 sudo，不要求用户输入密码；
- **不关闭 SIP**：不修改系统安全策略；
- **不安装内核扩展**：所有采样和负载都在用户态完成。

这些边界直接约束了技术选择。核心目标只能通过 QoS 表达调度倾向，不能依赖受限的硬绑定；遥测需要嵌入应用进程，也不能以反复启动需要 root 权限的 `powermetrics` 为基础。

底层采用 IOReport 相关能力。它可在用户态使用，但并非 Apple 向普通第三方长期承诺稳定的公开高层 API。因此，无需 root 仅说明权限条件得到满足，不能据此推定不同系统版本之间的兼容性。

### 1.5 项目命名与功能范围

项目最初名为 ThermalBench。设备识别、遥测、外部负载监控和历史比较陆续加入后，应用的范围已超出单纯的热测试。

于是我把公开名称改成了 Silemetry：`Silicon + Telemetry`。

Silemetry 更贴近观察芯片持续行为的定位。工程目录和部分类型仍保留 `ThermalBench` 名称；这些内部标识不影响使用，因此没有为统一名称进行大范围重构。

## 2. Swift、Rust、C 与 Metal 混合架构

### 2.1 整体架构

应用按界面与调度、遥测、CPU 负载和 GPU 负载划分职责，分别由 Swift、Rust、C 和 Metal 实现：

<div style="margin:1.8rem 0;padding:1rem 1.1rem;background:var(--surface-card);border:1px solid var(--border-subtle);border-radius:14px">
<svg viewBox="0 0 900 640" role="img" aria-label="Silemetry 四语言架构分层"><text x="30" y="40" font-size="11" fill="#7b8b99" letter-spacing="2" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">SILEMETRY · LAYERED ARCHITECTURE</text><text x="30" y="64" font-size="11" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">不是堆技术栈，而是把 UI、状态机、采样、负载和存储的责任边界划清</text><polygon points="475.26,725 665.78,615 94.22000000000003,505 284.74,395" fill="#7aa6c6" stroke="rgba(255,255,255,.35)"/><polygon points="665.78,615 475.26,725 475.26,747 665.78,637" fill="#2b5578"/><polygon points="475.26,725 284.74,395 284.74,417 475.26,747" fill="#3f6f96"/><polygon points="94.22000000000003,505 284.74,395 284.74,417 94.22000000000003,527" fill="#3f6f96" opacity=".55"/><rect x="650" y="552" width="10" height="10" rx="2" fill="#3f6f96"/><text x="668" y="561" font-size="12" fill="currentColor" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">SwiftUI Views</text><text x="668" y="576" font-size="9.5" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">页面 · 路由 · 状态绑定</text><polygon points="483.92,670 691.76,550 68.24000000000001,430 276.08,310" fill="#bcd6e4" stroke="rgba(255,255,255,.35)"/><polygon points="691.76,550 483.92,670 483.92,692 691.76,572" fill="#6e8fa3"/><polygon points="483.92,670 276.08,310 276.08,332 483.92,692" fill="#8fb0c4"/><polygon points="68.24000000000001,430 276.08,310 276.08,332 68.24000000000001,452" fill="#8fb0c4" opacity=".55"/><rect x="650" y="482" width="10" height="10" rx="2" fill="#8fb0c4"/><text x="668" y="491" font-size="12" fill="currentColor" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">TestCoordinator</text><text x="668" y="506" font-size="9.5" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">@MainActor 状态机</text><polygon points="492.58,615 717.74,485 42.25999999999999,355 267.42,225" fill="#78b7ae" stroke="rgba(255,255,255,.35)"/><polygon points="717.74,485 492.58,615 492.58,637 717.74,507" fill="#1f5f5b"/><polygon points="492.58,615 267.42,225 267.42,247 492.58,637" fill="#2f7f7a"/><polygon points="42.25999999999999,355 267.42,225 267.42,247 42.25999999999999,377" fill="#2f7f7a" opacity=".55"/><rect x="650" y="412" width="10" height="10" rx="2" fill="#2f7f7a"/><text x="668" y="421" font-size="12" fill="currentColor" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Services / Workloads</text><text x="668" y="436" font-size="9.5" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Telemetry · CPU · GPU 管理</text><polygon points="501.24,560 743.72,420 16.28000000000003,280 258.76,140" fill="#d2ad72" stroke="rgba(255,255,255,.35)"/><polygon points="743.72,420 501.24,560 501.24,582 743.72,442" fill="#77551f"/><polygon points="501.24,560 258.76,140 258.76,162 501.24,582" fill="#9a7434"/><polygon points="16.28000000000003,280 258.76,140 258.76,162 16.28000000000003,302" fill="#9a7434" opacity=".55"/><rect x="650" y="342" width="10" height="10" rx="2" fill="#9a7434"/><text x="668" y="351" font-size="12" fill="currentColor" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Rust / C / Metal</text><text x="668" y="366" font-size="9.5" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">采样 · 线程 · 计算</text><polygon points="509.9,505 769.7,355 -9.699999999999989,205 250.1,55" fill="#8fa7b6" stroke="rgba(255,255,255,.35)"/><polygon points="769.7,355 509.9,505 509.9,527 769.7,377" fill="#455c6c"/><polygon points="509.9,505 250.1,55 250.1,77 509.9,527" fill="#5c7383"/><polygon points="-9.699999999999989,205 250.1,55 250.1,77 -9.699999999999989,227" fill="#5c7383" opacity=".55"/><rect x="650" y="272" width="10" height="10" rx="2" fill="#5c7383"/><text x="668" y="281" font-size="12" fill="currentColor" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">JSONL / SwiftData</text><text x="668" y="296" font-size="9.5" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">原始样本 · 摘要索引</text><text x="30" y="616" font-size="10" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">跨语言边界统一走 C ABI；Rust 静态链接进 App，不启动外部进程。</text></svg>
<p style="font-size:.78rem;line-height:1.7;color:var(--text-muted);text-align:center;margin:.55rem 0 0">图 1：Silemetry 的分层架构。UI、状态机、服务、采样与存储各自有明确边界。</p>
</div>

{% note info %}
UI、状态机、采样、负载和存储具有各自的生命周期。跨语言交互统一通过 C ABI 完成，Swift 不直接依赖 Rust 的内部类型，以限制实现细节在层间传播。
{% endnote %}

![](silemetry-swiftui.png)

### 2.2 SwiftUI 应用层

SwiftUI 负责应用外观、页面路由和状态展示。界面主要由几类页面组成：

- Home：选择预设或进入自定义测试；
- Active Test：展示当前阶段、实时指标和曲线；
- Results：查看温度、功耗、频率、核心利用率和数据质量；
- History：管理历史测试；
- Compare：比较两次测试；
- Diagnostics：检查设备和遥测后端状态。

全局导航和上下文由 `AppModel` 管理，测试运行状态由 `TestCoordinator` 统一发布。SwiftUI View 不直接控制 CPU/GPU worker，也不直接触碰 FFI handle，只根据状态更新界面并提交用户意图。

若 View 直接持有 worker 或 FFI handle，页面切换、窗口销毁与用户取消都会介入底层资源管理。将资源留在服务层，可以使其生命周期由明确的运行流程控制。

### 2.3 TestCoordinator：测试调度与状态机

`TestCoordinator` 是整个应用的核心。它运行在 `@MainActor` 上，负责测试配置、阶段切换、采样循环、负载启停和最终记录生成。

状态被显式建模为一个枚举：

```swift
@MainActor
@Observable
final class TestCoordinator {
    enum State: Equatable {
        case idle
        case running(TestPhase, elapsed: TimeInterval, remaining: TimeInterval)
        case complete(RunRecord)
        case cancelled(RunRecord)   // 中断，但保存数据
        case discarded              // 丢弃，不保存
        case failed(String)
    }

    var state: State = .idle
}
```

显式状态用于约束界面与底层任务的组合。例如，取消后 GPU 是否仍在执行、记录保存后界面是否仍处于运行态，都需要由统一的状态发布和收尾流程保证一致。

### 2.4 Rust 遥测核心

`TelemetryCore` 是一个嵌入应用的 Rust crate，内部 vendor 了 macmon 0.8.0。它负责：

1. 启动后台采样线程；
2. 按指定间隔读取底层指标；
3. 把结果转换成 C 兼容结构体；
4. 给每条样本分配递增序列号；
5. 通过 FFI 向 Swift 提供等待、读取、停止和销毁接口。

macmon 提供 IOReport 通道枚举与聚合能力，嵌入的 Rust 模块在此基础上管理采样线程、队列和错误处理，再向应用暴露受控接口。

应用运行时不会启动外部 Rust 进程。Rust 被编译成静态库，直接链接进 macOS App。

### 2.5 C：CPU 工作负载与每核心利用率

CPU 负载由 C 实现。每个 worker 使用 pthread 启动，在循环中执行 NEON FMA 运算，持续消耗执行单元，同时通过校验和防止编译器把计算优化掉。

每核心利用率也放在 C 层，通过 `host_processor_info` 读取每个逻辑核心的 tick 变化，再计算相邻采样之间的 busy ratio。

C 层的执行路径较短，运行时开销较低，也能通过 C ABI 与 Swift、Rust 交互，适合承载这里的计算循环与系统计数读取。

### 2.6 Metal：GPU 计算负载

GPU 负载由 Metal compute shader 生成。shader 主要执行 FMA、三角函数和寄存器内迭代，目标是让负载偏向计算而不是大规模内存搬运。

Swift 侧的 `GPUWorkloadManager` 负责创建 command queue、pipeline、buffer 和持续提交循环。Metal shader 在构建阶段编译为 `default.metallib`，随应用一起打包。

### 2.7 SwiftData 与 JSONL：两层数据存储

测试数据分成两层：

- **JSONL 文件**保存逐条原始样本；
- **SwiftData** 保存每次测试的摘要和索引。

目录大致是：

```text
Application Support/Silemetry/
└── Runs/
    └── <run-uuid>/
        └── samples.jsonl
```

长时间测试可能积累几千至几万条样本。若逐条映射为数据库实体，写入、查询和迁移都会承担额外成本；JSONL 则支持流式追加，个别行损坏后仍可尝试读取其余记录。

History 的访问模式不同：它需要排序、检索、重命名和快速展示摘要。因此，每次测试的元数据和统计摘要由 SwiftData 管理。

两层存储分别服务于原始过程复核与历史记录检索，文件保存逐条样本，数据库保存索引和摘要。

## 3. Apple Silicon 的遥测实现

### 3.1 进程内遥测与 `powermetrics` 的取舍

`powermetrics` 是 macOS 自带的性能采样工具，输出内容很丰富，但直接把它作为应用后端有几个问题：

- 某些采样能力需要更高权限；
- 外部进程的启动、停止和 stdout 解析较重；
- 采样节奏和错误恢复不容易精确控制；
- 用户会看到权限和命令行层面的复杂度。

Silemetry 的目标是单 App、无 sudo，因此采用进程内遥测核心。Swift 只面对结构化样本，不需要解析文本输出，也不用维护一个外部子进程。

### 3.2 macmon 的嵌入与接口封装

macmon 解决了底层通道枚举和大量指标聚合问题。Silemetry 没有直接调用它的命令行界面，而是把相关代码 vendor 到自己的 Rust crate 中，再包一层稳定的采样接口。

选择 vendor 有两个原因：

1. **可复现构建**：CI 不依赖运行时网络拉取；
2. **接口可控**：应用只暴露自己需要的字段和错误码，不让 Swift 依赖上游内部实现。

TelemetryCore 对上层只提供一组 C 函数，内部如何采样、缓存和聚合都可以独立演进。

### 3.3 Swift 与 Rust 的 FFI 接口

Rust 侧通过 `extern "C"` 导出函数，Swift 通过 Bridging Header 调用：

```rust
#[no_mangle]
pub extern "C" fn tb_telemetry_create() -> *mut TelemetrySampler {
    // ...
}

#[no_mangle]
pub extern "C" fn tb_telemetry_wait_next(
    handle: *mut TelemetrySampler,
    after_sequence_id: u64,
    timeout_ms: u32,
    out: *mut TBTelemetrySample,
) -> TBErrorCode {
    // ...
}

#[no_mangle]
pub extern "C" fn tb_telemetry_destroy(handle: *mut TelemetrySampler) {
    // ...
}
```

`wait_next` 是关键接口。Swift 传入最后一次消费的序列号，Rust 只在出现更新样本时返回。这样既避免了高频空轮询，也能检测重复或跳过的序列。

所有跨语言结构都使用固定宽度的 C 类型，布尔值和 Optional 语义则通过 mask 表达，避免把 Rust 的复杂枚举直接暴露给 Swift。

### 3.4 温度、功耗、频率和利用率的数据口径

Silemetry 记录的主要指标包括：

- **CPU / GPU 平均温度**：多个有效传感器的聚合值；
- **CPU / GPU Hottest 温度**：本次采样中最高的有效传感器值；
- **CPU / GPU 功耗**：基于底层能量计数差分得到的瞬时功率；
- **P/E Cluster 频率**：当前采样周期内的簇频率；
- **CPU / GPU 利用率**：0 到 1 的归一化利用率；
- **每核心利用率**：每个逻辑核心的 busy ratio；
- **电源状态**：AC、Battery 或 Unknown；
- **Low Power Mode**：测试期间是否启用及是否发生变化。

平均温度用于描述总体趋势，Hottest 用于计算峰值；测试总时长与有效样本跨度也分别保存。它们对应不同统计对象，不能因为单位相同就在分析中互相替代。

### 3.5 Average 与 Hottest Sensor

Average 聚合多个有效传感器，适合观察较平滑的温度趋势；全程峰值则应对每次采样的 Hottest 再取最大值，避免在聚合阶段丢失局部高温。

早期摘要误用 Average 计算峰值，因而系统性低估最高温度。此类错误不会触发崩溃，输出也可能处于合理数值范围，必须依靠字段语义和专门测试识别。

最终实现把两种口径完全分开：

```text
趋势曲线 / 平均状态 → Average
峰值统计 / 热风险提示 → Hottest
```

测试套件增加了专门用例，确保 `RunAnalyzer` 的 peak 一定来自 hottest 字段，防止后续重构再次退化。

### 3.6 每项指标独立的 availability 与 validity mask

早期 TelemetryCore 有一个过于粗糙的“样本有效”标志。问题是，不同指标的可用性并不一致：某台机器可能有 CPU 温度但没有 GPU 温度，或者功耗有效但频率暂时不可用。

v0.2.1 改成逐字段 mask：

```rust
let sane_temp = |v: f32| v.is_finite() && v > -50.0 && v < 150.0;

if t.cpu_sensor_count > 0 && sane_temp(t.cpu_temp_avg) {
    mask |= TB_AVAIL_CPU_TEMP;
}
if t.cpu_sensor_count > 0 && sane_temp(t.cpu_temp_max) {
    mask |= TB_AVAIL_CPU_TEMP_HOTTEST;
}
if metrics.cpu_power.is_finite() && metrics.cpu_power >= 0.0 {
    mask |= TB_AVAIL_CPU_POWER;
}
if metrics.pcpu_freq_mhz > 0 {
    mask |= TB_AVAIL_P_FREQ;
}
```

Swift 根据 bit 决定字段是 `Double` 还是 `nil`。这条规则贯穿整条链路：

```text
底层不可用 → Optional 为 nil → 摘要不参与统计 → UI 显示 Not available
```

缺失值在这条链路中始终保持缺失语义，不以 0 代填，避免影响后续统计和结果解释。

### 3.7 不同 Apple Silicon 设备的兼容性

Silemetry 不把设备写死成 M4，也不假设所有芯片都有固定的 P/E 核数量。

设备信息在运行时读取：

- `hw.model`：机型标识；
- `machdep.cpu.brand_string`：芯片名称；
- `ProcessInfo.processorCount`：逻辑核心数；
- `hw.perflevelN.logicalcpu`：P/E 拓扑；
- `ProcessInfo.physicalMemory`：内存容量；
- `MTLCreateSystemDefaultDevice()`：Metal 设备；
- `ProcessInfo.operatingSystemVersion`：系统版本。

拓扑读取失败时标记为 Unknown；GPU 核心数缺少可靠读取接口时留空。按核心总数猜测 P/E 划分，会把未验证的假设写入设备记录。

每次测试开始时，设备信息会被快照到 RunRecord。这样即使把数据库迁移到另一台 Mac，历史记录仍然描述测试发生时的设备，而不是当前设备。

## 4. CPU 与 GPU 负载控制

### 4.1 CPU 压力线程

CPU worker 的核心是持续 NEON FMA 运算：

```c
while (!atomic_load(&g_stop_flag)) {
    for (int iter = 0; iter < 1000; iter++) {
        for (int i = 0; i < 16; i++) {
            c[i] = vfmaq_f32(
                vfmaq_f32(vfmaq_f32(c[i], a[i], b[i]), b[i], c[i]),
                a[i], vfmaq_f32(a[i], b[i], c[i])
            );
        }

        if ((iter & 0xFF) == 0) {
            // 累积校验和，避免计算被优化掉
        }
    }
}
```

工作线程只负责制造稳定计算压力，不进行文件 I/O，也不频繁分配内存。校验和既防止优化，也能作为“负载确实执行过”的附加证据。

线程数量可以由用户指定，0 表示使用当前目标范围内的全部可用核心。

### 4.2 Performance Core 与 Efficiency Core

Apple Silicon 是异构核心架构。P 核追求性能，E 核追求能效，两者在频率、功耗和热行为上差异明显。

同样的线程数，放在 P 核和 E 核上，产生的功耗与温升可能完全不同。因此自定义测试允许用户选择：

- All Cores；
- Performance Cores；
- Efficiency Cores。

这里的选择通过调度偏好实现，不构成绝对绑核保证。

### 4.3 P/E 拓扑的动态识别

不同 M 系列芯片的核心组合不同，硬编码 `6E + 4P` 只能在某一台机器上工作。即使当前测试机是 M4，也不能让数据模型假设未来设备沿用相同布局。

核心拓扑由 `sysctl` 动态读取，UI 标签也从设备快照生成。如果系统无法提供可靠拓扑，核心只保留逻辑编号和 Unknown 类型。

设备记录应区分可靠读取的信息与尚未取得的信息，因此未知拓扑保留为未知。

### 4.4 QoS 与线程调度

macOS 用户态没有一个面向普通应用、可以保证线程永远固定在某个 P/E 核上的稳定接口。Silemetry 使用 QoS 影响调度倾向：

```c
case CPU_CORE_TYPE_PERFORMANCE:
    pthread_set_qos_class_self_np(QOS_CLASS_USER_INTERACTIVE, 0);
    break;

case CPU_CORE_TYPE_EFFICIENCY:
    pthread_set_qos_class_self_np(QOS_CLASS_BACKGROUND, 0);
    break;
```

{% note warning %}
QoS 是调度提示，不是硬绑定。系统仍然可以根据热状态、前台任务和整体负载迁移线程。因此结果页描述的是 P/E preference，而不是绝对核心隔离。
{% endnote %}

同时记录每核心利用率，便于事后检查实际调度分布是否大体符合所选偏好。

### 4.5 Metal Compute GPU Workload

GPU workload 使用 compute shader，线程主要在寄存器中进行 FMA 和 `sin/cos` 计算：

```metal
kernel void thermal_gpu_load(
    device float4 *output [[buffer(0)]],
    device const float4 *input [[buffer(1)]],
    uint id [[thread_position_in_grid]])
{
    float4 a = input[id % 16];
    float4 b = float4(id * 0.618f, id * 1.618f, id * 2.718f, id * 3.141f);
    float4 c = float4(0.0f);

    for (uint i = 0; i < KERNEL_INTENSITY; i++) {
        c = fma(fma(fma(c, a, b), b, c), a, fma(a, b, c));
        c = fma(sin(c), cos(c), c);
        a = fma(a, float4(1.0001f), float4(0.0001f));
    }

    output[id] = c;
}
```

每轮提交后等待 command buffer 完成，再开始下一轮计算。这既限制了 GPU 命令的排队规模，也使停止流程能够等待当前任务完成后再释放资源。

### 4.6 Moderate 与 Maximum GPU 模式

GPU 强度分两档：

- **Moderate**：较轻的 kernel，并在提交之间保留间隔；
- **Maximum**：更高迭代次数，连续提交，尽量保持 GPU 饱和。

两档配置调整的是 duty cycle，不能解释为精确的 30% 或 100% 功率上限。实际占用仍受芯片、系统状态和后台图形任务影响，因此界面将其表述为负载强度。

### 4.7 CPU Only、GPU Only 与 Combined Test

工作负载类型由配置决定：

```swift
if config.workloadType.usesCPU {
    cpu_workload_start(&cpuConfig)
}

if config.workloadType.usesGPU {
    gpuWorkload.start(intensity: config.gpuIntensity)
}
```

三种模式的意义不同：

- CPU Only：观察 CPU 持续功耗和频率；
- GPU Only：观察 GPU 温度、功耗和共享热预算；
- Combined：观察 CPU/GPU 争夺整机功耗与散热能力时的行为。

UI、有效性判断和 Compare 都根据工作负载类型决定哪些字段是关键指标。GPU Only 不会因为 P-Core frequency 缺失就被判成无效测试。

### 4.8 Monitor Only：监控外部程序负载

Monitor Only 不启动内部 CPU/GPU worker，只负责连续采样。它适合和外部程序配合：

- 跑 Cinebench；
- 编译大型工程；
- 执行本地模型推理；
- 运行 Blender、视频导出或科学计算。

这种模式没有固定结束时间，用户点击 Finish Recording 才结束。样本阶段被记录为 `monitoringExternal`，不会和标准测试中的 Baseline 混在一起。

## 5. 测试阶段与终止流程

### 5.1 Baseline、Loading、Transition 与 Cooldown

标准测试被拆成四个阶段：

| 阶段 | 作用 |
|---|---|
| Baseline | 不启动内部负载，记录空闲状态和起始环境 |
| Loading | 启动 CPU、GPU 或组合负载，观察升温和稳态 |
| Transition | 停止负载后的短暂过渡，观察热惯性 |
| Cooldown | 继续采样，观察温度和频率恢复 |

阶段时长来自 `TestConfiguration`。进 Loading 前启动 workload，进入 Transition 时停止 workload，采样本身持续贯穿全部阶段。

阶段标签为曲线提供解释上下文，使空闲基线、负载施加与停止后冷却能够在记录中明确区分。

### 5.2 正常完成、Stop and Save 与 Discard

测试有三种主要结局：

- **Complete**：所有阶段正常结束；
- **Stop and Save**：用户提前停止，但保留已经采集的数据；
- **Discard**：终止并删除本次测试产生的数据。

UI 按钮不会直接创建 RunRecord，也不会直接删除文件。它们只提出终止请求，真正的清理、刷盘和状态切换由主测试任务完成。

UI 仅提交终止意图，可以避免按钮处理与后台任务分别执行收尾，从而产生重复记录或状态覆盖。

### 5.3 测试收尾的单一所有权

早期实现中，Stop 按钮会立即构造一条记录，而正在运行的 `start()` 任务在发现取消后也会构造记录。两个路径都认为自己有权结束测试，于是可能出现：

- 同一测试保存两次；
- Stop 后又进入下一阶段；
- 一个路径删文件，另一个路径仍保存文件路径；
- `.cancelled` 很快又被 `.complete` 覆盖。

最终方案是让主任务成为唯一的 finalization owner：

```swift
switch finishReason {
case .discarded:
    SampleArchive.deleteFiles(uuid: runUUID)
    state = .discarded

case .saveInterrupted:
    let analysis = accumulator.makeAnalysis(config: testConfig)
    let run = buildRunRecord(analysis: analysis, ...)
    state = .cancelled(run)

case .failedSavePartial(let message):
    let run = buildPartialRun(...)
    state = .failed(message)

case nil:
    let run = buildCompletedRun(...)
    state = .complete(run)
}
```

Stop、Discard 和 fatal failure 只设置 `finishReason`。一旦已经有终止原因，后来的请求不会覆盖它。

主任务拥有唯一的收尾权，其余入口只提交终止原因。记录构造、资源清理和终态发布由同一流程完成。

### 5.4 测试开始时间、总时长和样本跨度

项目中有三个容易混淆的时间：

- `createdAt`：测试真正开始的墙钟时间；
- `duration`：遥测运行到最后一条样本的总时长；
- `sampleSpan`：第一条有效样本与最后一条有效样本之间的跨度。

早期版本在测试结束时才初始化 RunRecord，导致 Results 中的 “Started” 实际接近保存时间。另一个版本用 `lastElapsed - firstElapsed` 作为 duration，漏掉了启动到第一条样本之间的时间。

最终做法是在 `start()` 开头快照 `runStartedAt`，总时长和样本跨度分别保存，避免用一个字段承载三种语义。

### 5.5 电源、低电量模式和环境变化

对笔记本来说，供电条件会直接影响性能策略。测试开始是 AC、结束时是 Battery，和全程 AC 并不是同一种实验。

因此 RunRecord 不只存最后一条样本，而是保存：

```text
powerSourceAtStart
powerSourceAtEnd
powerSourceChanged
lowPowerModeAtStart
lowPowerModeAtEnd
lowPowerModeChanged
```

当系统无法可靠读取电源状态时，值是 Unknown，而不是默认写成 Battery。Compare 遇到电源切换或低电量模式变化，会降低可比性并显示告警。

环境温度是可选人工输入。未填写时保存为 `nil`，不会自动假设为 25°C。

### 5.6 失败后的部分结果保存

遥测偶发一次读取失败不应该立刻终止测试，因此 Coordinator 维护连续失败计数；成功采样后计数清零。超过阈值后，才把它视为 fatal failure。

早期失败路径直接 `return`，会绕过尾部缓冲刷盘和统一清理。现在 fatal failure 也进入同一个 finalization 流程：

1. 停止 CPU/GPU workload；
2. 停止并销毁 telemetry；
3. 尝试刷入最后一批 JSONL；
4. 基于 accumulator 生成 partial summary；
5. 让用户选择保存部分记录或丢弃。

已采集的数据仍有保留价值，但必须连同失败原因和部分完成状态一起保存，不能沿正常完成路径生成完整结果。

## 6. 数据模型与完整性管理

### 6.1 TelemetrySample 与 RunRecord

Silemetry 有两个主要数据模型：

- `TelemetrySample`：一次采样的瞬时数据；
- `RunRecord`：一次测试的摘要、配置和环境元数据。

`TelemetrySample` 写入 JSONL，包含时间、阶段、温度、功耗、频率、利用率和电源状态；`RunRecord` 存进 SwiftData，包含峰值、平均值、样本数、覆盖率、设备快照、归档状态和 Compare 所需配置。

数据链路保持单向：

```text
采样 → 有效性判断 → 流式统计 → JSONL → RunRecord → History → Compare
```

存储设计需要保留未知与不完整状态，使数据质量问题能够继续传递到结果页和比较逻辑。

### 6.2 缺失值的存储与统计语义

传感器没有提供 GPU 温度，`gpuTemp` 就应为 `nil`。填 0 会影响整条统计链：

- 平均值会被拉低；
- 峰值逻辑可能错误；
- 数据覆盖率会虚高；
- UI 会显示一个看似真实的 0°C；
- Compare 会把两个不存在的值当作相同。

缺失语义从 Rust mask、Swift Optional、RunAccumulator 一直保留到 RunRecord、JSONL 和图表，最终显示为 `Not available` 或 `—`。任何一层以 0 代填，都会改变后续统计的含义。

### 6.3 流式 RunAccumulator

实时曲线只需要一个有界的显示窗口；全程统计则必须覆盖全部有效样本，两者不能共享同一套截断规则。

`RunAccumulator` 对每条样本进行 O(1) 聚合：

```swift
struct RunAccumulator {
    private(set) var sampleCount = 0
    private(set) var cpuPeakTemp: Double?
    private(set) var cpuTempSum = 0.0
    private(set) var cpuTempCount = 0

    mutating func add(_ sample: TelemetrySample) {
        sampleCount += 1
        // 更新峰值、总和、有效计数和阶段统计
    }

    func makeAnalysis(config: TestConfiguration) -> RunAnalysis {
        // 从聚合状态生成最终摘要
    }
}
```

RunAccumulator 不保存完整样本，其内存占用不随测试时长增长。正常完成、Stop and Save 与 fatal partial 都使用同一个 accumulator 生成摘要，使不同终止路径遵循相同统计口径。

### 6.4 7200 条环形缓冲与全程统计

环形缓冲最多保留 7200 条样本。它的实际覆盖时长取决于采样间隔：

- 1 秒采样：约 2 小时；
- 0.5 秒采样：约 1 小时；
- 2 秒采样：约 4 小时。

早期摘要直接由结束时的图表样本 `samples` 计算，环形缓冲覆盖旧数据后，测试初期的峰值也随之丢失。JSONL 仍保留早期高温，Summary 和 Compare 却已遗漏它，使摘要与原始记录不一致。

显示窗口和统计范围由此分开：前者控制内存与绘制成本，后者保证结果覆盖完整测量过程。

```text
环形缓冲 → 只服务实时 UI
RunAccumulator → 负责全程摘要
JSONL → 保存完整原始样本
```

### 6.5 JSONL 原始数据与 SwiftData 摘要

JSONL 每行一条独立 JSON，适合追加和流式读取。写入使用批量缓冲，达到 batch size 或测试结束时再刷盘，减少频繁小写入。

SwiftData 只保存测试级别摘要，因此 History 可以快速加载，不需要每次启动都解析所有原始文件。

Results 和 Compare 需要画曲线时，才在后台加载对应 JSONL。大文件不会在 SwiftUI `body` 中同步解析，避免窗口重绘时反复读盘。

### 6.6 Complete、Partial 与 Unavailable

原始数据有三种状态：

- **Complete**：文件存在、可读取、行数与记录匹配且没有坏行；
- **Partial**：存在截断、坏行、重复/缺失行或写盘中断；
- **Unavailable**：文件不存在或无法读取。

加载器返回的不只是 `[TelemetrySample]`，还包括诊断信息：

```swift
struct ArchiveLoadResult {
    let samples: [TelemetrySample]
    let totalLines: Int
    let malformedLines: Int
    let fileExists: Bool
    let readError: String?
}
```

加载时将数据库保存的状态与磁盘实际情况交叉核验。即使记录曾标为 Complete，只要文件随后被删除或损坏，当前有效状态也应降为 Partial 或 Unavailable。

可比性判断必须使用核验后的数据状态，避免界面同时给出 Highly Comparable 与原始文件损坏两种相互矛盾的提示。

### 6.7 文件和数据库的一致性

文件系统操作与 SwiftData 提交无法天然组成原子事务。删除历史记录时，无论先删除文件还是先删除数据库对象，后续步骤失败都可能破坏两者的一致性。

最终使用 staging 思路：

1. 把 Run 目录移动到临时 Trash；
2. 删除 SwiftData 对象；
3. 调用 `modelContext.save()`；
4. 成功后永久删除 Trash；
5. 失败则 rollback，并把目录恢复到原位置。

重命名失败时同样恢复旧名称。保存失败产生的 pending insert 则显式 rollback，避免后续无关的 `save()` 再次提交该对象，形成“幽灵记录”。

### 6.8 History 与 Compare

History 管理记录的打开、重命名与删除，Results 展示单轮测量过程，Compare 则先判断测试条件与数据质量是否支持比较，再呈现差异。

Compare 页面分成三层：

1. 可比性结论；
2. 配置、设备和环境字段对照；
3. 时间曲线和摘要差异。

曲线在后台加载，并采用磁盘诊断后的 effective raw status。原始数据 unavailable 时，持久化摘要仍可用于有限比较，但界面不生成缺乏原始样本支持的曲线。

### 6.9 测试可比性的判定条件

两轮测试设备相同，并不等于结果可比。`CompareAnalyzer` 会检查：

- 是否是同一条记录；
- 设备型号和芯片是否一致；
- 工作负载类型是否一致；
- CPU 核心目标、线程数和 GPU 强度是否一致；
- Baseline、Loading、Cooldown 和采样间隔是否一致；
- AC/Battery、Low Power Mode 是否相同；
- 测试期间是否发生电源切换；
- 环境温度差是否过大；
- App、TelemetryCore 和 analysis version 是否一致；
- 样本数量、覆盖率和归档完整性是否足够。

最终结论分为：

- `Highly Comparable` / 可直接比较；
- `Comparable with Warnings` / 可以看，但必须注意差异；
- `Invalid` / 不应该生成误导性差值。

当配置或数据质量不足以支持比较时，省略差值比输出缺乏解释条件的百分比更符合测量工具的职责。

## 7. 关键缺陷及其修复机制

开发中较重要的缺陷集中在快速停止、长期运行、磁盘异常和旧 SDK 编译等条件下。一次正常启动并完成的测试，只能验证其中有限的一条执行路径。

### 7.1 Metal 输出缓冲区越界

**现象**：GPU workload 运行时可能出现 Metal validation error、command buffer failure，严重时应用不稳定。

**根因**：最初只为 16 个 `float4` 分配了输出 buffer，却 dispatch 了 1024 个线程。shader 中每个线程都会执行：

```metal
output[id] = c;
```

当 `id` 大于 15 时就是越界写。

Swift 侧成功创建对象并提交命令，不能证明 GPU 执行阶段没有越界。未启用验证时，这一问题还可能表现为偶发 command buffer error，而非稳定复现的崩溃。

**最终修复**：输出 buffer 大小严格由 dispatch element count 派生，并检查 command buffer 状态：

```swift
let elementCount = 1024
let bufferSize = elementCount * MemoryLayout<SIMD4<Float>>.stride
```

同时把 grid size 收敛到单一常量，避免 Swift 与 shader 两边各自硬编码。

buffer 容量与 dispatch 数量应由同一尺寸定义派生，避免两端独立维护常量后发生偏离。

### 7.2 GPU Stop / Start 竞争

**现象**：Stop 后快速重新 Start，旧循环可能继续提交 command buffer，新循环同时启动，导致两套 workload 重叠。

**根因**：`stop()` 很快把 `isRunning` 改成 false，但旧 dispatch loop 仍在等待最后一个 command buffer 完成。新的 `start()` 看到 false 后重新启动，并把共享 stop flag 重置。

锁只能约束 Bool 的并发读写，不能证明旧循环已经退出；`DispatchWorkItem.cancel()` 也依赖循环主动检查取消状态。

**最终修复**：使用 generation token 和串行状态队列。每次 start 获取一个 generation，循环在每轮提交前验证自己仍然是当前 generation；stop 让旧 generation 失效，并等待 loop 确认退出。

因此，Stop 的完成条件必须包含异步循环退出确认。仅修改运行标志就允许下一轮复用资源，无法保证生命周期交接安全。

### 7.3 Stop、Cancel 和 Discard 的双终态

**现象**：用户点击 Stop 后，记录先进入 `.cancelled`，随后又被后台主任务改成 `.complete`；Monitor Only 的 Discard 也可能留下残缺记录。

**根因**：UI action 和采样任务都在做 finalization，没有唯一所有者。

**最终修复**：按钮只提交意图，主任务统一消费 `finishReason`，所有 workload cleanup、telemetry stop、archive flush 和 RunRecord 构造只执行一次。

缺陷来自多个入口同时拥有终结权。将资源清理和记录生成统一交由主任务后，终态覆盖才有明确的控制边界。

### 7.4 遥测读取期间销毁 FFI Handle

**现象**：测试运行中快速 Stop，偶发野指针或崩溃。

**根因**：`TelemetryService` 虽然是 actor，但 `readSampleOnce()` 在等待后台队列结果时会 `await`。actor 在挂起期间是可重入的，`stopTelemetry()` 可能插入并执行 `destroy(handle)`，而后台 `wait_next` 仍在使用同一个裸指针。

**最终修复**：create、start、wait、stop 和 destroy 全部进入同一条串行 telemetry queue。stop/destroy 只能排在已经提交的 wait 后面，确保裸指针不会在使用期间释放。

```swift
private let queue = DispatchQueue(
    label: "com.leecdiang.silemetry.telemetry"
)
```

actor 在 `await` 处允许重入，其隔离机制不能自动保护外部裸指针跨挂起点的使用期。FFI handle 的创建、使用与销毁仍需要独立的串行生命周期约束。

### 7.5 第一条 Rust 样本被跳过

**现象**：每次启动都比预期少一条样本，并额外等待一个采样周期。

**根因**：Swift 的 `lastSeq` 从 0 开始，Rust 第一条样本也编号 0，而查询条件是：

```text
sample.sequence_id > after_sequence_id
```

于是第一条 `0 > 0` 永远不成立。

**最终修复**：Rust 序列号从 1 开始，Swift 保持 `lastSeq = 0`。并增加测试锁定两端初始化约定。

序列号的初始值属于跨语言协议的一部分。两端即使各自逻辑成立，只要初始约定不同，仍会稳定遗漏第一条样本，因此需要将其纳入协议测试。

### 7.6 `Sendable`、裸指针与 `@unchecked Sendable`

**现象**：Xcode 15.4 的严格并发检查提示：

```text
capture of 'h' with non-Sendable type 'TBTelemetryHandle'
in a @Sendable closure
```

`TBTelemetryHandle` 本质是 `void *`，在 Swift 中是 `UnsafeMutableRawPointer`，默认不满足 `Sendable`。

**第一次修复的问题**：即使引入包装对象，如果先在闭包外写 `let h = box.raw`，闭包最终捕获的仍然是裸指针，警告不会消失。

**最终修复**：闭包直接捕获 `TelemetryHandleBox`，进入串行队列后再读取 `.raw`：

```swift
final class TelemetryHandleBox: @unchecked Sendable {
    let raw: TBTelemetryHandle

    init(_ raw: TBTelemetryHandle) {
        self.raw = raw
    }
}
```

这里使用 `@unchecked Sendable` 的安全前提非常具体：所有 FFI 访问都在同一个串行队列，stop/destroy 不会与 wait 并发。

`@unchecked Sendable` 的合理性建立在上述队列不变式上。标注本身不提供同步，也不能替代对指针访问范围和销毁时序的约束。

### 7.7 SwiftData 保存失败后的幽灵记录

**现象**：保存失败后，当前页面看似没有记录，但后续某次 `modelContext.save()` 又把之前的对象写进 History。与此同时，关联的 JSONL 可能已经删除，形成一条无法打开的记录。

**根因**：SwiftData 的 insert 已经进入 ModelContext，只是提交失败。失败路径没有 rollback，pending 状态一直存在。

**最终修复**：

- 保存失败时显式 rollback；
- pending run 的 Discard 同时回滚模型和处理样本文件；
- History 删除使用 staging/restore；
- 重命名失败恢复旧值；
- 任何数据库错误都向用户可见，不再 `try?` 静默吞掉。

提交失败并不意味着 ModelContext 自动恢复到插入前的状态；失败路径需要显式处理 pending 对象及其关联文件。

### 7.8 JSONL 写盘失败导致摘要与曲线不一致

**现象**：磁盘满、权限异常或 I/O 失败时，RunAccumulator 仍然继续统计后续样本，因此 Summary 看起来完整；但 JSONL 只保存了前半段，曲线是不完整的。

**根因**：摘要和归档是两条并行数据路径，早期只关注摘要，没有把 archive failure 提升为测试数据状态。

**最终修复**：

- `SampleArchive.append` 改为 `throws`；
- 只有写入成功才清空 buffer；
- 写入失败设置 `archiveUnhealthy` 和错误信息；
- RunRecord 保存 `complete / partial / unavailable`；
- Results 和 Compare 读取磁盘后再次核验；
- 用户能看到“摘要完整但原始曲线不完整”的明确提示。

摘要完整性与归档完整性分别描述两条数据路径，必须独立记录。只有同时呈现这两种状态，使用者才能判断结果能否由原始样本复核。

## 8. 构建、测试与发布验证

### 8.1 SwiftUI 页面与实时图表

实时图表使用 Swift Charts。测试中只渲染有限环形缓冲，避免长期运行后 View 持有无限样本。Results 按 Summary、Thermal、Power、Frequency、Cores、Timeline 和 Quality 组织。

布局使用 adaptive grid 和 `ViewThatFits`，避免窗口缩小时三个固定列把文字挤到重叠。状态胶囊、设备摘要和电池图标也都根据真实状态渲染，而不是依赖固定宽度和硬编码设备信息。

Thermal State 与温度曲线被明确区分：前者是系统级离散状态，后者是传感器数值。一次测试如果全程 Nominal，就显示简洁结论，而不是绘制一条占据大量空间的水平线。

### 8.2 动态设备识别与历史快照

Home 页显示的设备摘要来自 `DeviceProfile.current`，例如：

```text
Apple M4 · 10 cores (4P + 6E) · 24 GB
```

但 RunRecord 使用的是测试开始时的快照，而不是页面打开时重新读取。这样 History 和 Compare 中的设备信息具备可追溯性。

旧记录缺少字段时显示 Unknown，不用当前设备回填，也不猜测 GPU core count。

### 8.3 小窗口和状态展示

macOS 应用不能假设用户始终最大化窗口。开发中出现过状态胶囊换行、结果选择器覆盖 Done 按钮、指标卡在窄窗口挤压等问题。

最终采用：

- `lineLimit(1)` 和 `fixedSize` 保证状态标签不折行；
- Done 放进 toolbar；
- segmented control 在空间不足时回退为 menu；
- 指标区使用 adaptive grid；
- 异步文件加载显示 `ProgressView`。

这些调整针对窄窗口下实际出现的遮挡、折行和挤压，使状态与操作在不同窗口尺寸下仍可辨识。

### 8.4 Swift、Rust、C、Metal 混合构建

`build_app.sh` 负责完整构建：

1. `cargo build --release` 编译 Rust TelemetryCore；
2. `cc` 编译 C workload 和 core utilization；
3. `xcrun metal` / `metallib` 编译 Metal shader；
4. `swiftc` 链接 Swift、Rust 静态库、C object 和系统框架；
5. 生成 `.app` bundle；
6. 拷贝 `Info.plist`、图标和 `default.metallib`；
7. 注入 Git SHA 和构建时间；
8. ad-hoc codesign 并验证签名。

关键构建产物缺失时，脚本直接失败，避免残缺应用仍被标记为 “Build Complete”。

### 8.5 本地与 CI 的工具链差异

本地环境和 GitHub Actions 的工具链不同。本地使用更新的 Xcode 和 macOS SDK，CI 使用 Xcode 15.4 / macOS 14。项目曾多次出现“本地完全正常，CI 编译失败”。

典型问题包括：

- 旧 SwiftUI 工具链对 `@MainActor` 隔离的要求不同；
- SwiftData 测试进程没有 active ModelContainer；
- 独立测试二进制缺少 bundle metadata；
- `UnsafeMutableRawPointer` 被 `@Sendable` closure 捕获；
- SwiftData `@Model` 被错误地跨 actor 返回。

最后一轮修复把测试套件整体放到 `@MainActor`，让 `RunRecord` 不再跨隔离边界；Telemetry handle 改为捕获 Sendable wrapper；CI 同款编译参数下 Swift warning 清零。

CI 工具链也是项目需要支持的构建环境。本地较新工具链编译通过，不能替代对最低支持工具链的验证。

### 8.6 Swift 5 与 Swift 6 严格并发检查

项目为了兼容 Xcode 15.4 仍使用 Swift 5 language mode，但尽量按 Swift 6 的并发规则写代码。

这意味着：

- 不把 SwiftData model 跨 actor 传递；
- 不让裸指针直接进入 `@Sendable` closure；
- 对 `@unchecked Sendable` 写明安全不变式；
- 资源清理不依赖 actor “看起来是串行的”；
- 在 CI 中把 concurrency warning 当作未来 error 处理。

本地与 CI 最终均消除了 Swift 编译警告。这些修复没有扩展功能范围，但提前处理了迁移 Swift 6 时已知的并发约束问题。

### 8.7 70 项测试与 GitHub Actions

测试套件覆盖的重点不是 UI 快照，而是数据和状态语义：

- Hottest 字段是否用于 peak；
- Optional 是否保持 unavailable；
- Compare 的三档判定；
- 同一记录是否禁止比较；
- long-run accumulator 是否保留早期峰值；
- JSONL 的 malformed / missing / duplicate 行处理；
- Stop、Discard 和 partial failure 终结；
- DeviceProfile 和 RunRecord 编解码；
- 文件 staging 与恢复。

最终测试结果为 70/70，CI #15 在 Xcode 15.4 / macOS 14 环境全绿。

测试框架目前仍是轻量自定义 runner，而不是标准 SwiftPM `testTarget`。这不是最理想的终局，但对 v0.2.1 来说已经能覆盖核心回归，标准测试 target 可以在后续独立重构。

### 8.8 DMG、ZIP、SHA256 与 Release

发布产物包括：

- `Silemetry-v0.2.1-arm64.dmg`；
- `Silemetry-v0.2.1-arm64.zip`；
- `Silemetry-v0.2.1-SHA256SUMS.txt`。

DMG 是标准拖拽安装布局，ZIP 方便直接解压，SHA256 用于校验文件完整性。

发布前从最终 DMG 安装，而不是直接运行 build 目录里的 App，并完成：

- Quick Check；
- GPU Only；
- CPU + GPU Combined；
- Monitor Only；
- Stop and Save；
- 重启后 History 恢复；
- 两条有效记录 Compare；
- 删除记录并确认样本目录同步清理。

最终 DMG 的验收通过以后才创建 tag 和 Release。构建、CI 与真实传感器、安装包验证各检查不同环节，不能彼此代替。

## 9. 数据可信度与工程边界

### 9.1 数据可信度审查

开发前半段主要扩展功能，包括动态设备识别、GPU workload、自定义测试、History 与 Compare；后半段的工作重心则转向数据可信度和异常路径。

对测量工具而言，未被察觉的口径错误尤其难以接受。页面缺失容易暴露，峰值被系统性低估却可能长期影响使用者的判断。

后续审查因此优先沿以下问题展开：

```text
采集是否真实 → 缺失是否诚实 → 存储是否完整 → 比较是否有条件 → 错误是否可见
```

### 9.2 异常路径的状态组合

启动、采样、结束与保存构成最先验证通过的正常流程。

但资源和数据的一致性更多是在以下条件下受到考验：

- Stop 时后台 wait 还没有返回；
- GPU command buffer 正在执行时又重新 Start；
- JSONL 写入失败，但 accumulator 仍有数据；
- SwiftData save 失败，ModelContext 里还有 pending insert；
- 文件已经移动，数据库事务却回滚；
- Monitor Only 偶发读取失败，但下一次采样又成功；
- 两条记录摘要可比，原始曲线却只有一条完整。

这些异常还可能叠加，例如用户 Stop 时恰逢写盘失败。测试需要覆盖关键状态组合，单独验证每一种错误仍不足以约束组合后的行为。

### 9.3 测量结果的解释条件

测量工具应直接呈现未知、缺失和不完整状态，使结果的证据边界可见。

- 没测到就是 `nil`，不是 0；
- 文件坏了就是 Partial，不是 Complete；
- 环境不同就给 warning，不是假装 Highly Comparable；
- QoS 只是调度倾向，就不能写成 P-Core 硬绑定；
- IOReport 存在兼容性风险，就应该在局限里写清楚。

当数值缺乏完整解释条件时，结果页需要说明缺失的条件，以及它们对结论的影响。

### 9.4 跨语言接口的协议与生命周期

跨语言工程中，较难排查的问题往往来自接口两端没有共享同一组约定：

- Rust 与 Swift 对序列号起点的约定；
- C ABI 结构体的 Optional 语义；
- Swift closure 捕获裸指针的 Sendable 规则；
- GPU buffer 与 dispatch grid 的元素数量；
- actor 生命周期与 FFI handle 生命周期；
- 数据库对象和文件目录之间的事务关系。

每条边界都需要明确约定的定义方和维护责任，并尽可能以测试固定下来，避免协议只存在于注释或开发者的默认理解中。

### 9.5 AI Agent 在项目中的作用与局限

Silemetry 的开发大量借助了 AI Agent：从 SwiftUI 页面、Rust FFI、测试补全，到多轮代码审查、CI 排障和发布流程。

审查中，Agent 能沿数据从采集到展示的链路反复追踪：

```text
采样 → 状态机 → 存储 → Results → History → Compare → 删除
```

多轮审查逐步发现了 GPU buffer 越界、双终态、长测试摘要丢失、数据库幽灵记录、FFI use-after-free 和严格并发警告。

但 Agent 也有很清楚的局限：

- 它可能修复一个局部 warning，却没有真正理解闭包捕获的是 box 还是裸指针；
- 它容易关注正常路径，忽略失败后的资源状态；
- 它无法替代真实 Mac 上的传感器和安装包验收；
- 跨语言约定仍需要人来确认“哪一边才是事实来源”。

AI 提高了实现和审查效率，但测量目标、数据口径及最终验收仍需由我判断，尤其是自动检查无法覆盖的真实设备行为。

### 9.6 当前局限与后续计划

当前版本仍有明确局限：

- 目前是 ad-hoc 签名，尚未完成 Developer ID notarization；
- 只面向 Apple Silicon / arm64；
- IOReport 相关接口可能随系统版本变化；
- GPU 核心数没有可靠公开读取方式，当前不猜；
- Compare 主要做条件一致性和描述性差异，没有统计显著性分析；
- 超长曲线虽然后台加载，但未来仍可增加分层降采样；
- 测试套件尚未迁移为标准 SwiftPM `testTarget`。

后续更有价值的方向包括：

- Developer ID 签名与 notarization；
- 温升速率和降频点自动检测；
- 更明确的稳态区间识别；
- 可导出的完整测试报告；
- 更多不同 Apple Silicon 机型的兼容性验证；
- 标准 XCTest / SwiftPM 测试集成。

v0.2.1 的工作重点是明确记录数据来源、完整性和比较条件。上述能力将在此基础上逐项补充，而不会改变现有结果的解释范围。

### 9.7 项目地址和下载方式

<div style="display: flex; justify-content: center; gap: 16px; margin: 24px 0;">
  <a class="glass-pill" href="https://github.com/leecdiang/Silemetry-mac" target="_blank"><i class="fab fa-github"></i> 项目仓库</a>
  <a class="glass-pill" href="https://github.com/leecdiang/Silemetry-mac/releases/latest" target="_blank"><i class="fab fa-apple"></i> 下载 Releases</a>
</div>

- 推荐文件：`Silemetry-v0.2.1-arm64.dmg`
- 平台要求：Apple Silicon Mac，macOS 14.0+
- 仓库内容：源码、测试、构建脚本、发布说明和验收记录

{% note default %}
最初的问题是 MacBook Air 在持续负载下如何降频。一周开发后，更大一部分精力用于确认测量链路的失败行为：数据未读到、文件未写完或任务尚未退出时，应用能否准确呈现结果的实际状态。

后续版本会继续检查这些边界，再扩展测量与分析能力。
{% endnote %}
