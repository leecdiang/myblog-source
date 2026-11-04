---
title: "Apple Health Pro：把苹果健康导出变成可检查、可复用的数据"
date: 2026-11-04 15:00:00
lang: zh-CN
categories:
  - Everyday Anatomy
tags:
  - Apple
  - CSV
  - XML
description: "Apple Health Pro 本地导出指南：CSV、JSONL、命令行、多来源记录与隐私边界。"
etoc: true
---

<p><a hreflang="en" href="/2026/11/04/apple-health-pro-local-export-en/">Read in English</a></p>


从 iPhone 导出健康数据之后，下一步往往会卡住：拿到的是 ZIP 和 XML，想按来源、时间或指标整理，还得自己写脚本。

我开发的 Apple Health Pro，就是处理这一步的工具。它在本机读取 Apple 健康导出 ZIP，按来源和日期筛选，再生成分类 CSV。需要接入脚本时，也可以通过命令行导出 JSONL。

本文按已发布的 v8.9.1 介绍。它提供 macOS、Windows 和 Linux 桌面版，以及对应的独立命令行程序。[下载与版本说明](https://github.com/leecdiang/Apple-Health-Pro/releases/tag/v8.9.1)。

![Apple Health Pro 浅色界面，217 条合成演示记录](/images/apple-health-pro-20261104/linux-offscreen-light.png)

图：v8.9.0 源码在 Linux 环境中离屏渲染的应用界面，使用合成演示数据，不是 macOS 桌面实拍。

## 01. 先把数据整理出来

1. 在 iPhone 健康 App 中点头像，选择“导出所有健康数据”，把 ZIP 保存到电脑。
2. 打开 Apple Health Pro，选择或拖入 ZIP，等扫描结束后勾选需要的来源。
3. 选择日期范围和输出文件夹，点击“导出 CSV”。

完成后会生成一个独立的结果目录，里面有分类文件和 `export_manifest.json`。清单记录筛选条件、写出数量、排除数量、未知类型及文件 SHA-256，方便回头检查这次究竟导出了什么。

日期筛选有一个细节：按每条记录 `startDate` 所在原时区的自然日判断，起止日期都包含。跨午夜的记录不会被拆成每天一段。

如果只想先看看界面，可以用“文件 → 载入演示数据”。应用内置的演示记录是合成数据，不需要先导入自己的健康档案。

## 02. 命令行可以接进已有工作流

v8.9.1 提供独立 CLI，不用额外安装 Python 或 Qt。macOS / Linux 解压对应程序后，可以这样运行：

```bash
mkdir -p output
./healthpro-cli sources --input export.zip --quiet
./healthpro-cli export --input export.zip --output ./output --format jsonl
```

`sources` 查询准确的来源名称。它会显示原始名称，输出不能当作匿名数据分享。导出时可以用 `--source-filter` 精确筛选，也可以加起止日期。

JSONL 每行一个对象，适合逐行处理。原始数值字符串会保留，另外提供辅助数值字段。需要精确计算时，应以原始字符串为依据，而不是假设浮点数没有舍入。

成功结果写到 stdout，进度和错误写到 stderr，方便脚本接收。完整参数和退出码见 [CLI 文档](https://github.com/leecdiang/Apple-Health-Pro/blob/v8.9.1/docs/cli.md)。

## 03. 多来源数据，需要先理解再统计

Apple Watch、iPhone 和第三方应用可能记录同一类指标。Apple Health Pro 保留各来源的原始记录，不自动去重，也不复现健康 App 的来源优先级。

所以，导出成功不等于可以直接把所有来源的步数、距离加起来。这样可能重复计算。做分析前，应先决定使用哪个来源，或者明确自己的重叠处理规则。导出清单会列出由多个来源贡献的指标，帮助检查这个问题。

v8.9.1 只导出顶层 Record、Workout 和 StateOfMind，并保留未知的顶层 Record 类型。Correlation 中重复引用的 Record 不会再额外计数或导出，未知容器里的嵌套记录也不会被采集。这个修复不等于跨设备、跨来源自动去重。如果之前的 ZIP 包含 Correlation，建议用新版重新导出。也有明确范围：ECG 和路线附件、ClinicalRecord、自由文本元数据不在本版输出范围；StateOfMind 的嵌套标签和关联暂不解释。

![Apple Health Pro 深色界面，合成演示数据导出完成](/images/apple-health-pro-20261104/linux-offscreen-dark.png)

图：v8.9.0 同一组合成演示数据的深色界面，Linux 离屏渲染。两张截图用于展示界面，不展示 v8.9.1 的解析修复。

## 04. 本地处理，也要注意输出文件

解析和导出在本机完成。默认的来源名称匿名化会把 `sourceName` 替换成同一次导出内一致的 `Source_001` 等标签，不输出名称映射、设备描述或自由文本元数据。

但时间戳与健康数值仍然保留，仍可能识别个人。这个选项不能保证完整去标识化。

把 CSV 或 JSONL 上传到云盘、在线分析工具或大模型，是另一次数据分享。分享前要检查文件内容和接收方的数据使用方式。用合成数据演示或报告问题更合适。

CSV 默认还开启 Excel 安全文本，对可能被当作公式的文本做防护。它不代表任何来源的 CSV 都可以不加判断地打开。

Apple Health Pro 负责数据整理。导出文件和后续分析不能代替医疗诊断，也不应据此自行作医疗决定。

## 05. 开源与使用

项目采用 MIT 许可证，代码、说明和问题反馈都在 [GitHub](https://github.com/leecdiang/Apple-Health-Pro)。macOS 安装包目前为 ad-hoc 签名，尚未进行 Developer ID 公证，请在下载前了解这一点。

Linux 提供 .deb 和 AppImage，也提供独立 CLI。这些发行包不代表所有发行版和桌面环境都经过人工交互验证。本文配图来自离屏运行，不能代替真实桌面的文件选择器、窗口交互或显示兼容性测试。没有 FUSE 的环境可以使用 AppImage 的 `--appimage-extract-and-run` 模式，具体见[本版发布说明](https://github.com/leecdiang/Apple-Health-Pro/releases/tag/v8.9.1)。

如果你也想把 Apple 健康导出接入自己的表格、脚本或可视化流程，可以先用演示数据试一下。反馈问题时，请描述系统、版本和复现步骤，不要上传真实健康档案。

