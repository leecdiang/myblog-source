---
title: 博文创作模板与元素参考
published: false
date: 2026-06-28 22:46:00
categories: Meta
etoc: true
tags:
  - template
  - hexo
  - next-theme
  - reference
description: Beyond the Clock 博客的 Markdown 写作规范与可用元素速查。不发布，只供创建新博文时参考。
keywords: 写作模板, markdown, hexo, next-theme, tag plugins
---

# Front Matter 字段说明

```yaml
---
title: 中文标题 # 必须，主标题
date: 2026-06-28 22:00:00 # 必须，发布时间
categories: Silicon & Circuits # 可选，分类（多个用数组或子分类）
categories:
  - Silicon & Circuits
  - AI Infrastructure
etoc: true             # 可选，开启侧边栏目录（主题特性）
published: true        # 可选，false 则不生成页面（用于草稿/模板）
tags:
  - 标签名             # 可选，多个标签
description: >         # 可选，页面描述 / 摘要
  一段话描述本文内容。
keywords: 关键词, 逗号, 分隔 # 可选，SEO
mathjax: true          # 可选，开启 MathJax 公式渲染
---
```

> `published: false` 的文件留在 `_posts/` 目录但不会被 `hexo generate` 输出。
> `etoc: true` 在有 >=2 个标题时自动在侧边栏显示目录。
> 需要公式的页面设置 `mathjax: true`（需主题配置启用）。

---

# 文本样式

**粗体** `**粗体**`

*斜体* `*斜体*`

~~删除线~~ `~~删除线~~`

`行内代码` `` `行内代码` ``

---

# 标题层级

```markdown
## 二级标题（文章大段）
### 三级标题（小节）
#### 四级标题（一般不超出四级）
```

> 不要直接用 `#` 一级标题。Hexo 会在页面标题外自动生成 `<h1>`。

---

# 链接

```markdown
[显示文字](https://example.com)

[带标题的链接](https://example.com "鼠标悬停提示")
```

---

# 图片

## 带 asset folder 的图片（推荐）

`post_asset_folder: true` 已在 `_config.yml` 开启。建博文时 Hexo 自动创建同名目录，图片放进去：

```markdown
{% asset_img filename.png 图片描述（可选，HTML alt + title） %}
```

## 不带 asset folder 的图片

```markdown
![](post-name-20260628.png)
```

### 命名规范

- **时效性图片**：`<post-slug>-<日期>.png|jpg|webp`
  例：`apple-health-pro-20260503.png`
- **序号插图**：`<post-slug>-<序号>.jpg`
  例：macbook-air-m4-ssd-upgrade 用 `1.png` / `2.png`

## 图片带说明文字

一张图+说明的最佳做法：

```markdown
{% asset_img 1.png UV胶封边示意图 %}
```

`asset_img` 标签会把第二个参数渲染为图片的 `alt` 和 `title`，NexT 主题在图片下方显示说明文字。

---

# 引用

## 单行引用

```markdown
> 引用内容
```

## 多段引用

```markdown
> 第一段
>
> 第二段
```

## 实际用法示例

```
> 青甘之所以吸引我，是这一路集齐了雪山、古迹、沙漠、戈壁、丹霞、草原、石窟。
```

> 青甘之所以吸引我，是这一路集齐了雪山、古迹、沙漠、戈壁、丹霞、草原、石窟。

---

# 列表

## 无序列表

```markdown
- 项目一
- 项目二
  - 二级项目
- 项目三
```

## 有序列表

```markdown
1. 第一步
2. 第二步
3. 第三步
```

---

# 表格

```markdown
| 左对齐 | 居中对齐 | 右对齐 |
| :----- | :------: | -----: |
| 内容   | 内容     | 内容   |
| 内容   | 内容     | 内容   |
```

| 协议     | 传输层 | 拥塞控制 | 适用场景       |
| :------- | :----: | :------: | :------------- |
| RoCE v2  |  UDP   | DCQCN    | AI 训练集群    |
| TCP      |  TCP   |  Reno    | 通用数据中心   |
| TTPoE    |  UDP   |  自定义  | Tesla 内部互联 |

---

# 代码块

## 代语言标签的代码块

````markdown
```python
def hello():
    print("Hello, World!")
```
````

## 纯文本代码块

````markdown
```text
$ hexo generate
INFO  38 files generated in 264 ms
```
````

---

# NexT Tag Plugins

以下是 NexT 主题内置的标签插件，可在博文中直接使用。

## 1. 提示框 note

```markdown
{% raw %}{% note default %}
默认提示框
{% endnote %}

{% note primary %}
主要提示
{% endnote %}

{% note success %}
成功提示
{% endnote %}

{% note warning %}
警告提示
{% endnote %}

{% note danger %}
危险提示
{% endnote %}

{% note info %}
信息提示
{% endnote %}{% endraw %}
```

## 2. 内联标签 label

```markdown
{% raw %}{% label primary @主要 %}
{% label success @成功 %}
{% label warning @警告 %}
{% label danger @危险 %}
{% label info @信息 %}
{% label default @默认 %}{% endraw %}
```

## 3. 按钮 button / btn

```markdown
{% raw %}{% button https://example.com, 按钮文字, icon-name %}{% endraw %}
```

## 4. 标签页 tabs

```markdown
{% raw %}{% tabs tab-name %}
<!-- tab 标签一 -->
内容一
<!-- endtab -->

<!-- tab 标签二 -->
内容二
<!-- endtab -->
{% endtabs %}{% endraw %}
```

## 5. 流程图 / 序列图 mermaid

```markdown
{% raw %}{% mermaid %}
flowchart LR
    A[输入] --> B[处理]
    B --> C[输出]
{% endmermaid %}{% endraw %}
```

支持的图类型：`flowchart`、`sequenceDiagram`、`classDiagram`、`stateDiagram`、`gantt`、`pie`、`gitgraph`。

## 6. 波形图 wavedrom

```markdown
{% raw %}{% wavedrom %}
{ signal: [
  { name: "clk",  wave: "p.....|..." },
  { name: "data", wave: "x.345x|=.x" },
]}
{% endwavedrom %}{% endraw %}
```

## 7. 视频嵌入 video

```markdown
{% raw %}{% video https://example.com/video.mp4 %}{% endraw %}
```

## 8. 居中引用 center-quote

```markdown
{% raw %}{% center-quote %}
这是一段居中引用的文字。
{% endcenter-quote %}{% endraw %}
```

## 9. 图片组 group-pictures

```markdown
{% raw %}{% group-pictures %}
![描述1](image1.jpg)
![描述2](image2.jpg)
{% endgroup-pictures %}{% endraw %}
```

## 10. 链接网格 link-grid

```markdown
{% raw %}{% link-grid %}
{% link-grid-item https://example.com, 标题, 描述文字, /path/to/icon.png %}
{% endlink-grid %}{% endraw %}
```

---

# 分隔线与摘要截断

## 水平分割线

```markdown
---
```

## 摘要截断

NexT 按 `description` 字段作为摘要，不需要 `<!-- more -->`。

---

# 公式

需在 front matter 设置 `mathjax: true`。

```markdown
行内公式：$E = mc^2$

独立公式：
$$
\frac{\partial L}{\partial w} = \frac{1}{m} \sum_{i=1}^{m} (h_\theta(x^{(i)}) - y^{(i)}) x^{(i)}
$$
```

---

# 通用写作规范

| 规范           | 要求                                                         |
| :------------- | :----------------------------------------------------------- |
| 标题大小写     | 英文标题：首字母大写 + 专有名词大写。中文标题：正常标点。   |
| 引用来源       | 重要技术声明附来源链接，避免无法验证的断言。                 |
| 图片命名       | 见上方"图片命名规范"。                                       |
| 代码语言标签   | 始终添加（python / bash / text / yaml / json / c / verilog）。 |
| 中英文混排     | 中英文之间加空格（例：使用 `hexo generate` 命令）。          |
| 第一次提缩写   | 首次出现时写全称。例：模型 FLOPs 利用率（Model FLOPs Utilization, MFU）。 |

---

# 文章检查清单

写作完成后对照检查：

- [ ] Front matter 完整（title / date / tags / description）
- [ ] `etoc: true` 已设置
- [ ] 所有图片路径正确
- [ ] 代码块标识了语言
- [ ] 专有名词首次出现时写全称
- [ ] `hexo generate` 无报错
- [ ] `hexo server` 本地预览内容排版正常
