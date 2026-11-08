# Beyond the Clock 博客写作与 UI 图表规范

版本日期为 2026-11-05。适用站点为 https://leecdiang.com/，主题为 Hexo NexT Gemini。

请依据本规范完成新博文及配套图表，让正文、简介、引用、代码和图表沿用博客的现有风格。用户本轮给出的主题、读者、篇幅和事实材料决定文章内容。本规范提供写作与实现约定，不代表发布授权。

## 1 开始任务时

先明确文章要回答的问题、目标读者、可用材料和交付范围。能从用户材料判断的事项直接推进，影响结论的关键缺失信息再询问。

- 能访问仓库时，以 `/Users/lee/myblog` 为项目根目录，读取 `AGENTS.md`、`README.md`、写作模板和图表规范，检查既有未提交改动。聊天目录可能与项目目录不同。
- 只能接收附件时，依据本规范和模板文件包输出 Markdown、SVG 与所需数据或脚本，保留目录结构。在交付说明中列出待本地验证项。
- 使用项目现有类名、Hexo 标签和主题变量。新增交互须有明确阅读用途，界面保持简洁。
- 交付前核对当前文件。本文记录的是版本日期对应的实现；后续仓库变更应以实际读取到的配置与样式为准。

## 2 文章写法

### 读者与行文

从具体问题、观察或任务切入，说明本文要回答什么。涉及技术时，先给读者理解结论所需的概念，再解释机制和证据。首次出现的缩写写出含义，同一概念使用稳定的中文名和英文术语。

段落围绕一个意思展开。用完整句子连接现象、原因和结果，平行事项才用列表，比较同一组维度时用表格。重点可以加粗，但不把整段加粗，也不把普通正文拆成大量卡片。

用具体描述代替“赋能”“重塑范式”“值得注意的是”等空泛表述。删除聊天口吻、向用户承诺下一步的句子和生成过程说明。写作示例中的第一人称经历不能移植为作者经历。

### 证据与边界

- 数字保留单位、时间、来源和比较条件。性能结论说明设备、软件版本、数据规模、精度、线程数与计时口径中实际相关的条件。
- 实测结果、文献结果、理论推导与示意数据分别标明。缺少证据时缩小结论范围，或把待核实项留在交付说明中。
- 引用优先使用论文、官方文档、原始数据和项目仓库。时效性信息重新核实并记录日期。
- 引述原话保持准确。不得编造作者实验、使用经历、来源、链接、跑分和精确数据。
- 正式博文完成后使用当前可用的 humanizer 技能润色，保留事实、数值、公式、引用和必要限制。技能不可用时按上述要求人工检查，并如实说明。

### 结构

正文标题从 `##` 开始，子节用 `###`，需要时才用 `####`。文章标题由 front matter 提供。编号方式在同篇内统一。

开头必须有与内容相称的 `note primary` 简介，说明问题、重点和必要适用范围。简介后放 `<!-- more -->`。主体结构随内容安排，可采用“问题与范围 → 机制或过程 → 例子与证据 → 适用条件与结论”。摄影、旅行类文章按叙事需要组织，不机械套用技术文章结构。

结尾回答开头的问题，保留结论成立的条件。参考文献与正文引用对应。

## 3 文章骨架与文件组织

文章放在 `source/_posts/<slug>.md`，普通图片和附件放在同名资产目录 `source/_posts/<slug>/`。slug 使用清楚、稳定的英文小写名称，单词用连字符连接。

以下骨架中的标题、日期、分类、标签和描述需按文章替换。日期使用 Asia/Shanghai 时区。分类优先复用仓库已有名称。`categories` 只声明一次，需要多级分类时使用 YAML 数组。

```markdown
---
title: 替换为文章标题
date: 2026-11-05 12:00:00
lang: zh-CN
published: false
categories: Silicon & Circuits
tags:
  - 替换为主题标签
etoc: true
toc:
  max_depth: 2
description: 用一两句话说明本文讨论的问题和范围。
mathjax: false
---

{% note primary %}
用一段话交代本文要回答的问题，以及读者读完后能理解什么。
{% endnote %}

<!-- more -->

## 问题与范围

交代场景、比较对象和必要条件。

## 机制与证据

解释机制，并用例子、图表或资料支持结论。

## 适用条件与结论

回答开头的问题，说明结论适用的条件。

## 参考资料

列出正文实际引用的资料。
```

`published: false` 用于草稿，常规生成不会输出该文章。需要生成本地文章页面时，将已准备好预览的文章设为 `published: true`，然后构建并检查。此设置与推送线上是两个步骤。

有公式时开启 `mathjax: true`，有实际 SEO 关键词需要时添加 `keywords`。元数据应与正文内容一致。

## 4 简介与图标链接

简短简介优先采用上方骨架的形式。确有多个阅读重点时，可在 `note primary` 中使用简洁的 HTML 段落和列表。

资料、论文和源码入口复用 `glass-pill` 与现有 Font Awesome 图标。图标后保留文字，装饰图标使用 `aria-hidden="true"`。

```html
{% raw %}
<a class="glass-pill" href="https://github.com/OWNER/REPO" target="_blank" rel="noopener"><i class="fab fa-github" aria-hidden="true"></i> 项目源码</a>
<a class="glass-pill" href="https://example.com/paper.pdf" target="_blank" rel="noopener"><i class="fas fa-file-pdf" aria-hidden="true"></i> 阅读论文</a>
{% endraw %}
```

示例链接均须替换为已核实的实际地址。现有文章还使用 `fas fa-file-alt` 表示文档、`fas fa-code` 表示 HTML 或代码入口。新增图标前确认本站已加载该图标。普通正文引用使用文字链接，胶囊按钮留给主要资料入口。

## 5 图表组件选择

| 内容 | 使用方式 |
| --- | --- |
| 简单步骤或流程 | NexT `mermaid` 标签 |
| 结构图、曲线、带坐标的数据图 | 内联 SVG，外层使用 `v-figure` |
| 多方案比较 | HTML 表格或 `v-matrix` |
| 信息密集的宽图 | `visual_svg` 标签，或 `v-chart-scroll` 与 `v-chart-viewport` |
| 照片、截图、官方样片 | 原始图片，提供说明与出处 |
| 需要反复生成的数据图 | 数据文件、生成脚本与生成的 SVG 一起交付 |

每张图先明确要帮助读者回答的问题。示意图注明示意性质；数据图提供单位、刻度、图例、来源和适用范围。缺失值保留断点。多条曲线同时使用文字标签和不同线型，离散观测值保留点标记。

## 6 SVG 配色与布局

SVG 通过内联方式继承页面主题。图表绘制使用下面的现有变量与类名。

| 用途 | 变量或类名 | 实际作用 |
| --- | --- | --- |
| 图表卡片背景 | `--surface-card` | 背景颜色 |
| 主要文字 | `v-ink` / `--text-primary` | 类名设置 SVG fill |
| 次级文字 | `v-sub` / `--text-secondary` | 类名设置 SVG fill |
| 图注与弱化文字 | `v-muted` / `--text-muted` | 类名设置 SVG fill |
| 网格 | `v-grid` / `--divider` | 类名设置 stroke |
| 边界 | `--border-subtle` | 填写在需要的边框或描边上 |
| 主题强调 | `v-accent` / `--accent` | 类名设置 stroke |
| 数据系列 | `--chart-blue`、`--chart-amber`、`--chart-red`、`--chart-teal` | 深浅主题分别定义 |
| 青色和琥珀色描边 | `v-teal`、`v-amber` | 类名设置 stroke |
| 图注 | `v-caption` | 字号、颜色与间距 |

`v-accent`、`v-teal`、`v-amber` 不自动设置填充色。节点填充单独写 `fill="var(--surface-card)"` 或适合的系列变量。避免在新图中写死白色背景、黑色文字或亮色主题专用颜色。普通 SVG 的 CSS 规则需限定范围，Mermaid 专用规则的每个逗号分隔选择器都要包含 Mermaid 范围。

SVG 应有 `viewBox`、`role="img"` 和说明图意的 `aria-label`。同一页面内的 marker、clipPath、gradient 等 ID 必须唯一，推荐加入文章 slug 和图号。图中只放绘图所需的元素与可信内容。

先调整分组、圆环或行列布局，再处理标签避让。标签与连线要能辨认所属对象，密集信息可拆成多幅图。单图 viewBox 高度约 380–760 可作为起点，最终以真实页面可读性为准。窄屏字太小时使用宽图滚动或拆图。

照片和摄影样片保留原色，深浅主题适配由周围卡片、文字和图注承担。

### 内联 SVG 示例

下面是结构示意。SVG 保持单行，放入 `{% raw %}` 块，防止 Markdown 给 SVG 插入换行标签。raw 块中的图注与链接使用 HTML。

```html
{% raw %}
<div class="v-figure"><svg viewBox="0 0 800 380" role="img" aria-label="输入经过处理得到输出的流程示意"><rect x="40" y="130" width="180" height="100" rx="12" fill="var(--surface-card)" class="v-accent"/><rect x="310" y="130" width="180" height="100" rx="12" fill="var(--surface-card)" class="v-accent"/><rect x="580" y="130" width="180" height="100" rx="12" fill="var(--surface-card)" class="v-accent"/><path d="M220 180H300M288 172L300 180L288 188M490 180H570M558 172L570 180L558 188" class="v-accent" fill="none" stroke-width="2"/><g class="v-ink" text-anchor="middle" font-size="24"><text x="130" y="188">输入</text><text x="400" y="188">处理</text><text x="670" y="188">输出</text></g></svg><p class="v-caption">图 1｜处理流程示意。</p></div>
{% endraw %}
```

### 独立 SVG 与宽图

复杂 SVG 文件放在 `source/_visuals/<group>/<name>.svg`。正文通过现有标签内联，图注留在滚动区外。

```text
{% visual_svg film/fig04_burst_noise_theory %}
图 2｜图表说明、单位、假设，以及 <a href="#ref-1">资料来源</a>。
{% endvisual_svg %}
```

这是仓库现有文件的调用示例，新图要改用自己的 group/name。当前标签参数必须是一个目录名加一个文件名，使用小写字母、数字、下划线或连字符，不写 `.svg` 后缀。先创建对应 SVG 再引用，每幅文件不超过 200000 字节。`visual_svg` 标签直接放在 Markdown 中，外围不包 raw。

标签自动生成 `v-figure v-chart-scroll`、`v-chart-viewport` 和图注。当前宽图 SVG 最小宽度为 620px，滚动提示与键盘焦点由 `source/js/visual-diagrams.js` 按实际溢出情况增强。简单自适应图使用普通 `v-figure` 即可。

## 7 Mermaid 与比较矩阵

简单流程使用现有 NexT 标签。

```text
{% mermaid %}
flowchart LR
  A[输入] --> B[处理] --> C[输出]
{% endmermaid %}
```

生成后确认出现流程图。普通 Mermaid 代码围栏不能作为本项目已确认的渲染入口。节点文字控制长度，长流程按逻辑拆图，检查同页实时切换深浅色后文字和连线是否更新。

比较矩阵使用下方结构，示例内容需换成有证据支撑的实际比较。`lv0` 到 `lv4` 表示分级强度，必须由表内文字说明含义，分级标准写在图注中。

```html
{% raw %}
<div class="v-figure">
<table class="v-matrix">
<thead><tr><th>维度</th><th>方案 A</th><th>方案 B</th></tr></thead>
<tbody><tr><td>某项能力</td><td class="lv3">较强</td><td class="lv1">有限</td></tr></tbody>
</table>
<p class="v-caption">图 3｜示例矩阵。正式使用时说明分级标准与来源。</p>
</div>
{% endraw %}
```

## 8 代码 图片 公式与引用

### 代码块

用带语言标记的 Markdown 代码围栏，例如 python、c、bash 或 text。可运行示例保留必要的导入、参数和调用。省略片段要明确标记为节选，不能把节选描述为完整脚本。

当前主题已关闭自动折叠。长代码由内部 `.table-container` 原生滚动，最大高度是 `min(500px, 60vh)`。行号与代码共用滚动区域、字号与行高，复制按钮显示在代码上层。写新文章通常只需使用标准代码围栏。

修改代码样式时，检查最后一行是否可达、长行能否横向浏览、行号是否对齐、复制按钮能否点击，以及复制结果是否完整。保持滚动容器可滚动，避免再次用固定高度配合隐藏溢出截断内容。Stylus 中需用 `unquote('min(500px, 60vh)')` 保留这个 CSS 表达式，并检查编译后的 CSS。

### 图片与附件

当前开启 `post_asset_folder: true`。同名资产目录内的图片可这样引用。

```text
{% asset_img example-photo.jpg 准确说明图片内容的文字 %}
```

为图片提供有意义的说明，引用外部图时保留来源。构建后的最终图片地址必须有效，水印插件可能把 PNG 转成 JPEG。复现材料放入资产目录的 `reproduce/`，当前 `skip_render` 覆盖 `_posts/**/reproduce/**`。交付时检查 README 附件是否被误生成文章或进入 sitemap。

### 公式与引用

公式文章设置 `mathjax: true`，定义变量、单位与必要假设。依据当前写作模板选择公式语法，构建后检查下标、转义和行内显示。价格可写 `USD 69`，避免美元符号误触发公式解析。

正文引用可使用下面的锚点形式，同篇保持编号一致。

```html
<sup class="cite"><a href="#ref-1">[1]</a></sup>
```

参考资料对应放置 `<span id="ref-1" class="ref-anchor"></span>`，随后写资料标题、机构或作者、版本或日期，以及可访问链接。所有图注来源和正文引用都要能定位到对应资料。

## 9 文件入口

下列路径均相对 `/Users/lee/myblog`。附件包保留相同相对路径。

| 文件 | 作用 |
| --- | --- |
| `source/_posts/writing-template.md` | 完整写作元素速查，保持 `published: false` |
| `scaffolds/post.md` | Hexo 新建骨架，只有基础字段 |
| `source/_visuals/README.md` | 图表组件与使用规范 |
| `source/_visuals/templates/figure.html` | 宽图容器模板 |
| `source/_visuals/templates/matrix.html` | 比较矩阵模板 |
| `source/_data/styles.styl` | 实际运行的主题与图表样式 |
| `_config.next.yml`、`source/_data/_config.next.yml` | 主题覆盖，修改前检查合并结果 |
| `source/_data/body-end.njk` | 页面脚本及相关注入 |
| `scripts/visual-svg.js` | 构建时读取并内联 SVG |
| `source/js/visual-diagrams.js` | 宽图滚动提示与焦点增强 |
| `source/_visuals/film/` | 现有深浅主题 SVG 示例 |
| `source/_posts/film-emulation-pipelines.md` | 图表标签与图注的完整文章示例 |
| `source/_posts/film-emulation-pipelines/reproduce/make_theme_figures.py` | 胶片图表生成器 |
| `source/_posts/film-emulation-pipelines/data/` | 对应数据与来源文件 |
| `source/js/orrery.js`、`source/js/orrery-sky.js`、`source/css/orrery.css` | 太阳系与星盘组件，属于站点功能 |
| `README.md`、`AGENTS.md` | 项目维护与发布要求 |

`source/_visuals/visuals.css` 只保留说明，图表实际样式统一在 `styles.styl`。旧说明中的 generate.js、pipeline-3d、stack-3d、loop、timeline、state-machine 模板未出现在当前模板目录，使用前须确认真实文件。

## 10 本地验收与发布

能够访问仓库时，逐步执行以下检查，确认前一步成功再继续。

```sh
cd /Users/lee/myblog
pwd
git status --short
./node_modules/.bin/hexo generate
```

编辑已有文章前备份到 `/Users/lee/myblog-backups/<日期>/`。保留既有未提交改动。删除、移动、重命名、目录结构调整及修复已有基线构建错误，按当前项目约定先说明方案并确认。

构建无 ERROR 后检查 4000 端口，复用本项目已有预览，或启动本地服务。

```sh
lsof -i :4000
./node_modules/.bin/hexo server -p 4000
```

本地请求绕过代理。

```sh
curl --noproxy '*' -I http://localhost:4000/
```

样式改动后核对 `public/css/main.css` 中的实际规则，必要时执行 `./node_modules/.bin/hexo generate --force`。当前机器使用本地 Hexo 二进制，避免使用曾卡住的 `npx hexo`。

### 阅读与交互验收

- 标题、简介、目录和章节结构一致，资料链接与引用锚点可用。
- 所有图表、公式、代码和图片正确生成，文字可读，标签不互相遮盖。
- 浅色与深色分别检查，并在同一页执行“浅→深→浅”和“深→浅→深”，无需刷新即可得到正确文字、节点与连线颜色。
- 检查桌面与 390px 左右手机宽度。图表和代码在自己的容器内滚动，整页没有横向溢出，图注自然换行。
- 长代码能滚动到底部并横向查看长行，行号同步，复制结果完整。
- 对生成型数据图同时核对数据、生成脚本和 SVG。修改源数据或脚本后再生成，避免只改产物造成下次生成覆盖。
- 交付说明只列实际完成的验证，工具或环境不足的项目列为待检查。

### 发布边界

只有用户明确授权部署、发布或推送本轮结果后，才执行发布。“不错”“OK”仅表示反馈。已有覆盖本轮的明确发布授权无需重复询问；用户要求先预览时，先交付预览。

发布前扫描整个生成目录。

```sh
find source public \( -name '*.bak*' -o -name '.DS_Store' \) -print
```

杂项移出源目录或需要清理旧产物时，按项目约定说明方案并确认，再进行清理和重建。`generate` 不会删除旧的 public 文件。部署会发布整个 `public/`。

确认本地验收和授权后运行 `./node_modules/.bin/hexo deploy`。记录退出码、推送 commit，并请求线上文章与所引用的样式或脚本，查找本轮标记或对比文件内容。HTTP 200 不能单独证明更新。Pages 构建或 CDN 传播期间先核对仓库内容和构建状态，等待传播后再次验证。

## 11 交付给作者的结果

交付完整 Markdown、实际引用的图片和 SVG、相关数据与生成脚本，以及一段简短说明。说明列出文章要点、已完成的检查、仍需核实的事实或素材，以及本地预览或线上发布状态。

以下任务描述可与本规范一起发送给其他 AI，方括号内容由作者填写。

> 请按附件《Beyond the Clock 博客写作与 UI 图表规范》完成一篇新博文。主题为 [主题]，面向 [读者]，重点回答 [核心问题]。请使用 [资料与附件]，篇幅约 [范围]。交付完整 Markdown 和所引用的图表文件，复用现有简介卡片、图标链接与图表组件。对事实、来源、深浅主题、手机布局和长代码滚动进行对应检查，说明实际验证范围。本轮工作范围为 [仅生成文件／写入项目并本地预览／预览后等待发布授权]。
