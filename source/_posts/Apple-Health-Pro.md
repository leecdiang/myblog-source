---
lang: zh-CN
title: 打破围城：将 Apple Health 导出的 XML数据转换为友好的 CSV 格式
date: 2026-04-05 20:00:00
categories:
  - Everyday Anatomy
etoc: true
tags:
  - AI
  - Productivity
  - 数据处理
  - DataScience
  - 苹果健康
  - Apple
  - Health
  - XML
  - CSV
keywords: Apple Health XML to CSV, 苹果健康数据转换, AI 训练数据, 健康数据分析工具, XML 转换 CSV 教程
description: Apple Health 导出的 XML 文件庞大且难以直接读取。本文介绍如何利用我开发的转换工具，将复杂的 ZIP/XML 数据瞬间转换为 AI 可读的清爽 CSV 格式，助力你的个人健康数据分析。
image_width: wide
---

## 01. 导出以后，数据仍然不好用

Apple 健康可以导出全部记录，但得到 ZIP 并不意味着可以开始分析。

`导出.xml` 可能达到数 GB，记事本难以打开，Excel 也可能耗尽内存。
    
即使交给大模型，冗长的 XML 层级也不方便分析长期趋势，还可能诱发幻觉。
    
我开发 Apple Health Pro🍎，就是想先把这些记录整理成能筛选、能打开的 CSV。

安装包：<a href="https://github.com/leecdiang/Apple-Health-Pro/releases" target="_blank" class="glass-pill download-btn"><i class="fab fa-github"></i> 前往 GitHub 下载安装包</a>

---

## 02. 从 iPhone 导出到 CSV

### 第一步：iPhone 端的原始导出

在健康 App 中点击头像 -> **“导出所有健康数据”**。这一步你将得到一个 `导出.zip`。

![](Apple-Health-Pro-20260405-2.jpg)
### 第二步：筛选来源与日期

启动应用，macOS、Windows 和 Linux 均支持。

点击 `SELECT DATA ARCHIVE`，选择刚导出的 ZIP。

在 `IDENTIFIED SOURCES` 中勾选需要的来源，排除不想保留的第三方 App 记录。

在 `Date range` 填起止日期。也可以隐藏设备名，导出时统一替换成 `AppleHealthPro_device`。
   
点击 `EXECUTE EXPORT` 开始转换。

![](Apple-Health-Pro-20260503.png)
### 第三步：查看分类后的文件

v8.6.0 按 15 个医疗与运动维度归类输出，具体见下表。某类没有记录，就不生成对应文件。

|  分类序号  | 维度名称 (Category)                    | 导出文件名 (Exported CSV)         | 核心指标涵盖 (Key Metrics Included)    |
| :----: | :--------------------------------- | :--------------------------- | :------------------------------- |
| **01** | **核心心血管** (Heart & Cardio)         | `1_Heart_Cardio.csv`         | 心率、静息心率、HRV (心率变异性)、步行平均心率       |
| **02** | **身体成分** (Body Metrics)            | `2_Body_Metrics.csv`         | 体重、BMI、体脂率、瘦体重、身体水分              |
| **03** | **日常基础消耗** (Daily Activity)        | `3_Daily_Activity.csv`       | 步数、活动能量消耗、静息能量消耗、步行距离、爬楼层数       |
| **04** | **睡眠与恢复** (Sleep Recovery)         | `4_Sleep_Recovery.csv`       | 睡眠分析 (核心、深度、快速动眼、清醒等状态)          |
| **05** | **步态与行动力** (Mobility & Gait)       | `5_Mobility_Gait.csv`        | 步行速度、步长、不对称性、双足支撑时间、步态稳定性        |
| **06** | **生殖与生理健康** (Reproductive)         | `6_Reproductive.csv`         | 经期记录、排卵测试结果、宫颈粘液质量               |
| **07** | **生命体征** (Vitals & Respiratory)    | `7_Vitals_Respiratory.csv`   | 血氧饱和度、呼吸率、体温、血压                  |
| **08** | **跑步硬核动态** (Running Dynamics)      | `8_Running_Dynamics.csv`     | 跑步功率、垂直振幅、触地时间、跑步步幅、跑步速度         |
| **09** | **骑行表现** (Cycling Stats)           | `9_Cycling_Stats.csv`        | 骑行功率、踏频、骑行速度、功能性阈值功率 (FTP)       |
| **10** | **游泳与水域** (Swimming & Water)       | `10_Swimming_Water.csv`      | 游泳距离、划水次数、水下深度、水温                |
| **11** | **通用体能训练** (Workouts & Training)   | `11_Workouts_Training.csv`   | 力量训练、瑜伽、HIIT、传统跑/骑/游等所有手动开启的运动记录 |
| **12** | **环境与感官** (Environment & Senses)   | `12_Environment_Senses.csv`  | 日照时间、环境音量暴露、耳机音量暴露               |
| **13** | **营养与摄入** (Nutrition & Hydration)  | `13_Nutrition_Hydration.csv` | 膳食能量、碳水、蛋白质、饮水量、咖啡因摄入            |
| **14** | **心理状态与正念** (Mindfulness & Mental) | `14_Mindfulness_Mental.csv`  | 心理状态打卡、情绪追踪、正念冥想时间               |
| **15** | **症状与病史** (Symptoms & Illness)     | `15_Symptoms_Illness.csv`    | 头痛、咳嗽、疲劳等手动打卡的各类症状记录             |

这些 CSV 也可以交给 ChatGPT 或 Gemini 整理趋势。我推荐的提示词如下：

> **[你是一名具备运动生理学、 心血管医学 和健康数据建模能力的专业分析师。我将提供Apple Health原始数据（CSV），请基于数据进行接近专业体检级别的分析，并严格按照以下结构输出：首先给出【一句话结论】，直接判断整体健康状态（健康 / 亚健康 / 风险状态），不得模糊；然后进行【生理系统拆解分析】，从心血管系统（心率、HRV、静息心率）、神经系统（基于HRV分析交感/副交感平衡）、睡眠恢复系统、代谢与活动水平四个层面分析，必须解释背后的生理机制而非表象；接着进行【趋势建模】，基于时间序列判断是否存在周期性波动、长期改善或恶化趋势]**
> 
![](Apple-Health-Pro-20260405-1.png)

---

<div style="margin:1.8rem 0;padding:1rem 1.1rem;background:var(--surface-card);border:1px solid var(--border-subtle);border-radius:14px">
<svg viewBox="0 0 1000 360" role="img" aria-label="Apple Health Pro 数据处理管道"><defs><marker id="aA" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#5d7f96"/></marker></defs><text x="25" y="38" font-size="11" fill="#7b8b99" letter-spacing="2" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">APPLE HEALTH PRO · CLEANSTREAM</text><text x="25" y="62" font-size="11" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">从十几 GB 的 XML 到可分析的 15 类 CSV：每一步都避免把全量数据读进内存</text><ellipse cx="109" cy="250" rx="86" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="25,146 185,146 167,128 7,128" fill="#7aa6c6"/><polygon points="25,146 185,146 185,240 25,240" fill="#3f6f96"/><polygon points="185,146 167,128 167,222 185,240" fill="#2b5578"/><line x1="25" y1="146" x2="185" y2="146" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="45" cy="166" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="45" y="170" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">01</text><text x="105" y="190" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">iPhone 导出 ZIP</text><text x="105" y="209" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Health 全量数据</text><path d="M189,214 L211,214" fill="none" stroke="#5d7f96" stroke-width="2" marker-end="url(#aA)"/><ellipse cx="299" cy="250" rx="86" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="215,146 375,146 357,128 197,128" fill="#78b7ae"/><polygon points="215,146 375,146 375,240 215,240" fill="#2f7f7a"/><polygon points="375,146 357,128 357,222 375,240" fill="#1f5f5b"/><line x1="215" y1="146" x2="375" y2="146" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="235" cy="166" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="235" y="170" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">02</text><text x="295" y="190" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">O(1) 流式清洗</text><text x="295" y="209" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">逐块读取 · 低内存</text><path d="M379,214 L401,214" fill="none" stroke="#5d7f96" stroke-width="2" marker-end="url(#aA)"/><ellipse cx="489" cy="250" rx="86" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="405,146 565,146 547,128 387,128" fill="#78b7ae"/><polygon points="405,146 565,146 565,240 405,240" fill="#2f7f7a"/><polygon points="565,146 547,128 547,222 565,240" fill="#1f5f5b"/><line x1="405" y1="146" x2="565" y2="146" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="425" cy="166" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="425" y="170" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">03</text><text x="485" y="190" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">字符串去重</text><text x="485" y="209" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">sys.intern 共享地址</text><path d="M569,214 L591,214" fill="none" stroke="#5d7f96" stroke-width="2" marker-end="url(#aA)"/><ellipse cx="679" cy="250" rx="86" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="595,146 755,146 737,128 577,128" fill="#d2ad72"/><polygon points="595,146 755,146 755,240 595,240" fill="#9a7434"/><polygon points="755,146 737,128 737,222 755,240" fill="#77551f"/><line x1="595" y1="146" x2="755" y2="146" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="615" cy="166" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="615" y="170" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">04</text><text x="675" y="190" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">智能分卷</text><text x="675" y="209" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">88 万行 / 约 90MB</text><path d="M759,214 L781,214" fill="none" stroke="#5d7f96" stroke-width="2" marker-end="url(#aA)"/><ellipse cx="869" cy="250" rx="86" ry="12" fill="rgba(25,52,72,.10)"/><polygon points="785,146 945,146 927,128 767,128" fill="#8fc0a9"/><polygon points="785,146 945,146 945,240 785,240" fill="#4f8a6f"/><polygon points="945,146 927,128 927,222 945,240" fill="#356a51"/><line x1="785" y1="146" x2="945" y2="146" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/><circle cx="805" cy="166" r="10" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.35)"/><text x="805" y="170" text-anchor="middle" font-size="9" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">05</text><text x="865" y="190" text-anchor="middle" font-size="13" font-weight="600" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">15 类 CSV</text><text x="865" y="209" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.80)" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">喂给 LLM 分析</text><text x="25" y="330" font-size="10" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">流式清洗把内存从 O(N) 降到 O(1)；去重和分卷保证大文件不会撑爆 Python 或 Excel。</text></svg>
<p style="font-size:.78rem;line-height:1.7;color:var(--text-muted);text-align:center;margin:.55rem 0 0">图 1：Apple Health Pro 的 CleanStream 管道。流式清洗、去重和分卷是处理十几 GB XML 的关键。</p>
</div>

## 03. 15GB+ XML 怎样处理

部分用户的 `导出.xml` 超过 13GB，全量读取很容易耗尽内存。v8.4.0 我重构了解析引擎，主要改了清洗、字符串复用和导出分卷。

![697](Apple-Health-Pro-20260407.png)

![](Apple-Health-Pro-20260407-1.png)

XML 偶尔带有 `\x0b` 等异常字符。用 `f.read().replace()` 清洗，要先把十几 GB 全部读入内存。我改成按块读取的 CleanStream 代理，让这一步的内存消耗由 O(N) 变成 O(1)，处理这类文件时不再依赖一次装下全部内容。

3000 万条健康记录里的 `type`、`unit` 大量重复。我用 `sys.intern()` 让相同字符串共享内存，再配合 `gc.collect()` 回收对象，减少 Python 字典记录占用。

CSV 太大，Excel 也不好加载。我在压力测试后把分卷阈值设为 88 万行，单文件约 90MB，在保留记录连续性和加载稳定性之间做了取舍。

---

## 04. 开源与后续计划

项目已在 GitHub 开源。后续想支持更多运动指标提取，并用图表展示数据。

源码：<a href="https://github.com/leecdiang/Apple-Health-Pro" target="_blank" class="glass-pill"><i class="fab fa-github"></i> leecdiang/Apple-Health-Pro</a>
