# 博客写作模板、图表与图标：固定入口

本文件用于避免后续写博文时重复从聊天、Library 或历史交付包搜索模板。2026-11-08 根据当前 `leecdiang/myblog-source` 主分支和 2026-11-05 提供的模板包校对。**仓库中的实时文件是实施基准；归档 ZIP 是参考快照，不可直接整体覆盖当前仓库。**

## 唯一工作树与源代码入口

- 网站源码仓库：`leecdiang/myblog-source`；本机推荐根目录 `/Users/lee/myblog`。
- 文章完整写作模板：`source/_posts/writing-template.md`（`published: false`，仅用作参考，不发布）。
- 新文章骨架：`scaffolds/post.md`。
- **长期可查的完整 AI 写作/UI 规范**：[`docs/blog-authoring/BLOG_AUTHORING_GUIDE_FOR_AI.md`](BLOG_AUTHORING_GUIDE_FOR_AI.md)，由 2026-11-05 提交的原始指导包提取，已经进入仓库。
- 图表、卡片与颜色规范：`source/_visuals/README.md`。
- 图表示例源码：`source/_visuals/templates/figure.html`、`source/_visuals/templates/matrix.html`。
- SVG 构建标签：`scripts/visual-svg.js`；主题联动：`source/js/visual-diagrams.js`。
- 新版站点视觉变量：`source/css/studio.css`；NexT 现行实现：`themes/next/`。
- 用户可见图标：使用仓库现有 Font Awesome 资产（`theme-assets/fontawesome/`），复用 `glass-pill`，**不要再引入一套新的图标库**。

## 原始包的固定来源（归档，不当作部署工作树）

- ChatGPT Library `/blog-writing-ui-guide-for-ai-2026-11-05.zip`（原始写作规范 + UI Kit 副本）。
- ChatGPT Library `/blog-template-ui-kit-2026-11-05.zip`（UI Kit 完整快照）。
- 两份原 ZIP 的版本日期都是 2026-11-05；站点已经在 2026-11-06–08 继续迭代，**已有仓库文件优先于 ZIP 同名旧文件**。

## 新文章在仓库中的固定结构

```text
source/_posts/<slug>.md             # YAML front matter，正文从 ## 开始
source/_posts/<slug>/images/         # 照片、论文原图及有出处的资源
source/_posts/<slug>/data/           # 数据与假设、来源记录
source/_posts/<slug>/interactive/    # 有静态后备内容的交互
source/_posts/<slug>/reproduce/      # 复现脚本、说明；原样分发
source/_visuals/<topic>/*.svg        # CSS 主题联动科研图
```

图表复用 `v-figure`、`v-caption`、`visual_svg` 和 CSS `--chart-blue/--chart-teal/--chart-amber`；照片不做深色反相。全文首次出现缩写展开、数值注明理论/实测、参考文献与图源在文内直接可达。发布前依根 `README.md` 依次完成 `npm ci`、Hexo 构建、`check:content`、`check:loading`、桌面和移动端双主题验收。发布站点是 `leecdiang/leecdiang.github.io`，源码提交本身不等于实际发布。
