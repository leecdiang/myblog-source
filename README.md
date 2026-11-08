# Beyond the Clock · 博客维护指南

本文档记录当前已验证的流程，更新于 2026-11-08。


## 以后写文章直接从这里开始：固定模板与组件路径（2026-11-08）

**不必再从聊天记录和旧 ZIP 搜索博客模板。** 按顺序阅读仓库里的这些固定文件：

- **完整写作/UI 规范（已归档到仓库）**：[`docs/blog-authoring/BLOG_AUTHORING_GUIDE_FOR_AI.md`](docs/blog-authoring/BLOG_AUTHORING_GUIDE_FOR_AI.md)。
- **目录与原始包来源、图标/图表路径**：[`docs/blog-authoring/README.md`](docs/blog-authoring/README.md)。
- **博文模板**：[`source/_posts/writing-template.md`](source/_posts/writing-template.md)；创建骨架：[`scaffolds/post.md`](scaffolds/post.md)。
- **图表/卡片规范**：[`source/_visuals/README.md`](source/_visuals/README.md)；现成组件：[`source/_visuals/templates/figure.html`](source/_visuals/templates/figure.html) 和 [`matrix.html`](source/_visuals/templates/matrix.html)。
- **运行时实现**：`scripts/visual-svg.js`、`source/js/visual-diagrams.js`、`source/css/studio.css`、`theme-assets/fontawesome/`。

2026-11-05 的原始 Library 归档仍在 `/blog-writing-ui-guide-for-ai-2026-11-05.zip` 与 `/blog-template-ui-kit-2026-11-05.zip`；它们只是历史快照，**以当前主仓库实现为准**。新文章只从上述仓库路径读取，不重复寻找 ZIP，亦不可用 ZIP 整包覆盖已更新的主题。

## 当前维护入口（2026-11-06）

当前默认界面是 Studio，自定义 NexT 代码完整保存在 `themes/next/`，已由原来的 Git 指针改为主仓库中的普通文件。不要通过更新 NexT 上游覆盖这里的布局。上游基线为 NexT 8.25.0、提交 `5098e8cdfa04d860c3d686b690eb591f8f84f6d2`，许可证保留。

- OpenClaw 接手说明：[`docs/OPENCLAW-HANDOFF-2026-11-06.md`](docs/OPENCLAW-HANDOFF-2026-11-06.md)。
- 性能与深色阅读方案：[`docs/theme-performance-2026-11-06.md`](docs/theme-performance-2026-11-06.md)。
- 拉取源码后先 `npm ci`，再运行本地 Hexo。主题样式和核心脚本由 `scripts/studio-assets.js` 生成到 `public/assets/studio/`，文件名带内容摘要；不要直接修改生成文件，也不要再以 `public/css/main.css` 作为 Studio 样式是否生效的判断依据。
- `theme-assets/fontawesome/` 是构建数据，不放入 `scripts/`；Hexo 会尝试把 scripts 内的文件作为脚本执行。
- 发布仓库为 `leecdiang/leecdiang.github.io`，源码仓库为 `leecdiang/myblog-source`。正文大媒体继续遵循现有忽略规则；从零克隆时需保留或恢复文章媒体，不能用缺图构建覆盖线上。

下文带“本地预览，未发布”的旧轮次条目是历史记录。当前发布状态以交接文档和 GitHub Pages 实际构建记录为准。

## 项目身份与文件入口

- 唯一项目根目录：`/Users/lee/myblog`。聊天工作目录可能不同，执行命令前必须确认。
- 站点：<https://leecdiang.com/>；`root: /`；Hexo 本地版，NexT Gemini。
- 发布目标：`_config.yml` 中 git deploy → `leecdiang/leecdiang.github.io` 的 `main`。
- 全站样式：新版 `source/css/studio.css`；旧版 `source/_data/styles.styl`。`source/_visuals/visuals.css` 仅保留入口说明，不再维护重复样式。
- 主题覆盖：根 `_config.next.yml`、`source/_data/_config.next.yml`；修改前检查实际配置与覆盖关系。
- 写作模板：`source/_posts/writing-template.md`（`published: false`）；新建骨架：`scaffolds/post.md`。
- 图表规范：`source/_visuals/README.md`；页面布局：`themes/next/layout/`。
- 行为约束：`AGENTS.md`；若有可用的 hexo-blog-content / hexo-blog-design 技能，先读取实际文件，不假定其存在。

## 工作范围

- A：文章、样式、布局编辑，生成和本地预览，可以执行。
- B：删除、移动、重命名、目录结构调整或修复已有基线构建错误，先说明方案并确认。
- C：发布需要用户明确授权“部署/发布到线上”等；“不错/OK”不是授权。已有明确发布授权无需重复询问。
- 修改前查看工作区，保留既有未提交改动。备份放在 `/Users/lee/myblog-backups/<日期>/`，不得混入发布源目录。

## 写作和 UI

文章用完整 front matter，正文从 `##` 开始。研究文章保留资料日期、来源、公式假设和未实测的边界；最后过 humanizer，避免把聊天中的“你之前用……”直接带入公开正文。

开头用现有简介卡片，内容简短，说明问题、重点和必要的适用范围：

```text
{% note primary %}
<strong>这篇文章讲什么</strong>
<p>用一段话说明本文要回答的问题。</p>
<ul><li>重点一</li><li>重点二</li></ul>
{% endnote %}
```

外部资料入口复用图标胶囊按钮，不另外引入图标库。图标与正文标签同时出现，装饰图标对辅助阅读隐藏：

```html
<a class="glass-pill" href="https://github.com/owner/repo" target="_blank" rel="noopener"><i class="fab fa-github" aria-hidden="true"></i> 项目源码</a>
```

图表用 `v-figure`、`v-caption` 和主题变量；摄影样片保持原色，不做深色反相。宽图用 `visual_svg` 标签或 `v-chart-scroll` + `v-chart-viewport`；图内横向滚动，图注正常换行，窄屏显示操作提示。`film-chart` 保留旧文兼容。详细说明见图表规范。

流程图用 NexT 标签，不能假定普通 mermaid 代码围栏会渲染：

```text
{% mermaid %}
flowchart LR
  A[输入] --> B[处理] --> C[输出]
{% endmermaid %}
```

开启数学排版的文章要检查美元价格是否误作公式。价格可写 `USD 69`，保留实际数值和币种；不要批量替换数学公式的美元分隔符。参考文献可复用 `<sup class="cite"><a href="#ref-1">[1]</a></sup>` 与 `<span id="ref-1" class="ref-anchor"></span>`；同篇统一一种编号方式。

## 构建与预览

以下命令逐步执行，检查结果后再进行下一步：

```sh
cd /Users/lee/myblog
pwd
git status --short
./node_modules/.bin/hexo generate
lsof -i :4000
./node_modules/.bin/hexo server -p 4000
```

若端口已被本项目预览使用，复用现有服务；不要随意结束未知进程。预览服务留在独立终端，另一个终端检查：

```sh
curl --noproxy '*' -I http://localhost:4000/
```

使用 `./node_modules/.bin/hexo`，本机 `npx hexo` 曾卡在 npm exec。先确认基线无 ERROR，再做修改；修改后重新构建。

构建后运行 `npm run check:content`，检查 Atom 类型与静态内容、已修复公式、摄影图片属性、内容语言、分享封面、文章 microdata 和核心栏目 sitemap。检查脚本位于 `tools/check-content-output.py`，使用 Python 标准库。浏览器中的图形坐标、交互和主题仍需实际复查。加载与数学静态输出另用 `npm run check:loading` 检查。

`studio-math-prerender.js` 使用当前锁定的 MathJax 在构建时生成 CHTML、辅助 MathML 和 `data-tex` 源码，阅读页无需加载客户端排版器；公开正文仍从原始 Markdown 维护。站内导航保留完整文档加载，在链接意图出现时预取目标页及必要样式，使用 150ms 离场与 420ms 入场衔接；背景的四个原始 WebP 版本按原字节嵌入公共样式，不缩尺寸、不二次压缩，首帧显示并保持呼吸相位。归档筛选、目录、标签页、控件及弹层共用短时动效；键盘操作及减少动态效果设置即时更新。后退恢复时清理离场状态，避免页面停在透明状态。 本地审查记录见 `docs/continuity-2026-11-07.json`；更早的加载速度对比保留在 `docs/loading-motion-2026-11-07.json`，其中背景与转场策略已被本轮替换。

至少检查：文章标题/简介、目录、图表、公式、图片和引用跳转。深浅两色都要目视检查；手机宽度检查表格和图表是否仅在容器内滚动、页面是否横向溢出。只看配置不能声称完成两种主题的视觉验收。

样式改动后检查 `public/css/main.css` 确有新增选择器；必要时 `./node_modules/.bin/hexo generate --force`。水印插件可能把 PNG 转为 JPEG，应核验生成 HTML 中的最终图片路径，而非只查 Markdown 原图名。

## 发布前与发布后

发布前扫描整个源目录和生成目录：

```sh
find source public \( -name '*.bak*' -o -name '.DS_Store' \) -print
```

发现源目录杂项时，先说明移动方案；获准后移到项目外备份目录，再 `hexo clean`、`hexo generate`。仅 generate 不会删除旧 public 文件；只在有旧产物问题时做清理，不无故 clean。

检查本轮新增的生成路径：附件中的 README.md 也可能被 Hexo 生成页面并进入 sitemap。`skip_render` 已覆盖 `_posts/**/reproduce/**`，复现附件原样提供下载，不生成文章。修改该规则后需重启预览并 clean + generate，核对 sitemap 中没有附件页面。

确认构建成功、预览检查完成且已获发布授权后：

```sh
./node_modules/.bin/hexo deploy
```

部署发布整个 `public/`，并非只发布本轮文章。记录退出码和推送 commit，再检查线上文章是否含本轮唯一标记，例如新增简介标题。HTTP 200 不能单独证明新版已经上线。

线上尚旧时，可查：

```sh
gh api repos/leecdiang/leecdiang.github.io/pages/builds/latest --jq '{status,commit,error}'
```

也可对照 `raw.githubusercontent.com/leecdiang/leecdiang.github.io/main/<生成路径>`。仓库已更新但线上尚旧，应等待 Pages 构建/CDN 传播，不反复部署；当前响应可见 `max-age=600`，以实际响应为准。

IndexNow 成功表示提交已接收，不保证已收录。Google/Bing 实际搜索、站长平台索引状态与网络安全网关拦截是不同问题；不要用某一个搜索结果推断全网封禁。

## 图表维护（2026-11-01）

- 深浅主题变量统一在 styles.styl 开头；正文、导航、卡片与图表复用 surface 变量。
- 图表颜色使用 `--chart-blue / amber / red / teal`；多条曲线保留文字图例和不同线型。照片不改色。
- 胶片文章正文只保存图表标签与图注；SVG 在 `source/_visuals/film/`，数据在文章同名目录的 `data/`。
- 修改数据后运行 `python3 source/_posts/film-emulation-pipelines/reproduce/make_theme_figures.py`，再构建。生成器只依赖 Python 标准库，不联网、不改正文；旧 make_figures.py 用于原始静态图片。
- `scripts/visual-svg.js` 在构建时内联 SVG，每幅限制 200 KB，保留主题继承和无脚本可用的键盘滚动。
- 价格采用 USD 前缀，数学公式保留原分隔符；附件 README 原样保留为 .md 文件。

本轮修复只在本地构建与预览，发布仍按上面的授权流程执行。


## 2026-11-05 全站设计（本地预览，未发布）

- `_config.next.yml` 的 `studio_design: true` 启用独立页面外观，沿用 Hexo/NexT 的文章渲染、链接和资源。
- 首页：`themes/next/layout/_studio/home.njk`，桌面图文分栏、手机独立照片与介绍；摄影 `/photography/`、文章 `/archives/` 是独立页面。
- 公共布局：`themes/next/layout/_layout-studio.njk`；样式：`source/css/studio.css`；主题切换、归档筛选：`source/js/studio.js`。
- 画廊收录 Visual Narrative 分类中声明了 `image_width` 的摄影文章；读取已有正文首图和描述。
- 首次进入站点和刷新页面时跟随系统，忽略旧版永久保存的手动主题。右上角保留原有按钮，本次浏览的选择以 sessionStorage 在站内页面间共享；导航、前进后退、切回标签页保持当前选择。新一轮进入、刷新或系统主题变化时恢复跟随。主题初始化在公共样式前内联执行，避免跳页首帧配色错误；不写入永久主题偏好。Links 页保留天象仪。
- 本地首页 `?portrait=mono` 可以对照黑白效果，仅在 localhost / 127.0.0.1 生效；照片源文件没有修改。
- 完整改版前备份与回退说明：`/Users/lee/myblog-backups/2026-11-05-design/README.md`。回退脚本会先保存当前版本，再恢复旧文件。`studio_design: false` 可临时切回旧主题外观。
- 预览：`./node_modules/.bin/hexo generate --force` 后运行 `./node_modules/.bin/hexo server -p 4187 -s`，访问 `http://127.0.0.1:4187/`。此操作不会发布线上。

Safari 本地预览使用 4187 端口；本机 Safari 会阻止 4190 并报 WebKitErrorDomain:103（受限制的网络端口）。

本地设计第二轮：归档页使用“技术与研究 / 日常与实践 / 影像与旅行”筛选分组（不改原始分类），可与搜索组合，筛选条件保存在 URL。文章页标题下加入原头像、作者和日期。本轮修改前文件保存在 `/Users/lee/myblog-backups/2026-11-05-design/iteration-2/before.tar`。


## 本地设计第三轮（2026-11-05）

使用 frontend-design 与 web-design-guidelines 审阅；技能来自 anthropics/skills 和 vercel-labs/agent-skills，已安装至 ~/.codex/skills。

- 首页仅保留三个主入口：关于、文章列表、摄影；右上角为单个主题切换按钮，底部 Links / Email / GitHub 保留。照片独立呈现，不再铺满背景。
- 关于页模板 `themes/next/layout/_studio/about.njk`：左侧资料、右侧教育/研究/项目。事实取自已有关于页与 ASV、Silemetry、EdgeControl 文章；旧版源文件保留。
- Links 页模板 `themes/next/layout/_studio/links.njk`：朋友网站、资料与工具的开放列表，保留天象仪和键盘操作。旧版源文件保留。
- 新版首页、索引页不加载数学/流程图脚本；阅读页目录标记当前章节。搜索支持清除筛选及浏览器前进/后退。
- 修改前备份 `/Users/lee/myblog-backups/2026-11-05-design/iteration-3/`；完整旧站备份与回退流程仍在上级目录。
- 24 组桌面/手机/浅深色检查通过，包含导航、目录、键盘、主题、数学与 Mermaid、天象仪；预览端口仍为 4187。此轮未发布线上。
