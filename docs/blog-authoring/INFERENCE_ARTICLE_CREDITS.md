# 图片、图表与依赖出处

资料与图片核对日期：2026-11-08。机器可读的原始页面、图片 URL、尺寸、版本、裁切坐标与 SHA-256 记录位于文章资源目录 `data/image_sources.json`。

## 厂商原图

以下图片保持下载文件的原始字节，用于解释文中讨论的具体设备。它们来自厂商公开资料，不是本次生成的图像。来源没有逐一标明拍摄、渲染或合成方式，因此正文统一称“官方产品图/场景图”，不宣称现场实拍。

| 文件 | 权利人和来源 | 正文用途 |
| --- | --- | --- |
| `macbook-air-m4-official.jpg` | © Apple，[Apple Newsroom：M4 MacBook Air](https://www.apple.com/newsroom/2025/03/apple-introduces-the-new-macbook-air-with-the-m4-chip-and-a-sky-blue-color/) | 基础 M4 Mac 的具体设备示例 |
| `ryzen-ai-halo-395-official.jpg` | © AMD，[Ryzen AI Halo Developer Platform](https://www.amd.com/en/products/processors/desktops/ryzen/ryzen-ai-halo/ryzen-ai-max-plus-395.html) | 区分 Strix Halo 芯片代号与 Ryzen AI Halo 平台名称 |
| `dgx-spark-official.png` | © NVIDIA，[DGX Spark](https://www.nvidia.com/en-us/products/workstations/dgx-spark/) | 桌边统一内存设备的官方场景 |
| `dgx-h100-official.png` | © NVIDIA，[DGX H100/H200 User Guide](https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html) | 机架系统的前面板图，保留原图标注 |

厂商图片的公开可访问性不等于 CC 开放许可；本包不对它们另行授权。来源、署名与权利归属已保留。

## 两张论文原图

| 文件 | 原始版本与位置 | 许可与处理 |
| --- | --- | --- |
| `gqa-original-fig2.png` | Ainslie et al., *GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints*，[arXiv:2305.13245v3](https://arxiv.org/abs/2305.13245v3)，物理第 2 页，Figure 2 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。从原 PDF 裁切并转为 PNG，未改图中文字与原 caption |
| `speculative-original-fig1.png` | Yaniv Leviathan, Matan Kalman, Yossi Matias, *Fast Inference from Transformers via Speculative Decoding*，[arXiv:2211.17192v2](https://arxiv.org/abs/2211.17192v2)，物理第 2 页，Figure 1 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。从原 PDF 裁切并转为 PNG，未改图中文字与原 caption |

许可链接已从对应 arXiv 版本页面核对。只包含与正文相关的两张图，不附整篇论文。可选裁切复现脚本位于 `reproduce/extract_paper_figures.py`。

## 原创图表与视觉规范

11 幅自绘图由 `reproduce/make_figures.py` 生成：6 幅为公式计算，5 幅为机制示意。机制图独立组织布局，依据文中标明的原始研究解释概念；没有把论文的历史实测曲线或倍率改画成自有测试。

图表沿用用户提供的 2026-11-05 博客模板与先前 GEMM 文章的视觉语言。正式主题 SVG 使用原站的 `--surface-card`、`--surface-soft`、`--text-primary`、`--text-muted`、`--divider`、`--chart-blue`、`--chart-teal`、`--chart-amber` 等变量，数字图的单位与假设均可追溯到 CSV 和脚本。

## 离线预览依赖

- **MathJax 3.2.2**：`preview/vendor/tex-svg-full.js`，来自 [MathJax 官方仓库](https://github.com/mathjax/MathJax/tree/3.2.2)。Apache License 2.0 全文随包保存在 `MathJax-LICENSE.txt`。
- **Font Awesome Free 5.15.4**：原有 `fas fa-file-pdf` / `fas fa-code` 的官方 SVG，来自 [FortAwesome 官方仓库](https://github.com/FortAwesome/Font-Awesome/tree/5.15.4)。图形为 Fonticons, Inc. 的 CC BY 4.0 内容；原库 LICENSE 与文件来源随包保存在 `preview/vendor/fontawesome-5.15.4/`。预览使用原 SVG 几何，正式文章继续调用站点已有图标类。
- **marked 17.x**：仅在本地重建预览时需要，MIT 许可；不作为运行时网络依赖。预览构建器读取本机安装包，输出 HTML 不需要加载 marked。

本包没有使用图片生成模型制作设备图或数据图，也没有包含仅用于验收的中文字体与测试浏览器。


## 2026-11-08 网站部署图像压缩记录

线上仓库为减少网络负载，将 `dgx-h100-official.png` 与 `dgx-spark-official.png` 转为不改颜色的 JPEG，宽度上限 1500px、质量 88。正式 Markdown 引用 `.jpg`，完整原始 `.png` 和原始 SHA-256 仍保存在 2026-11-08 原始交付 ZIP。其余四张图片保持原字节。
