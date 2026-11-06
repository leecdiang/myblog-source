# OpenClaw 维护交接：Studio 主题

## 仓库与构建

- 源码：`https://github.com/leecdiang/myblog-source`，分支 `main`。
- 发布产物：`https://github.com/leecdiang/leecdiang.github.io`，分支 `main`；网站 `https://leecdiang.com/`。
- 当前 Mac 项目路径为 `/Users/lee/myblog`。接手其他主机时使用实际克隆路径，不把本机路径当成远端固定路径。
- `themes/next/` 现在是主仓库内完整保存的普通目录，不再是缺少 `.gitmodules` 的上游 Git 指针。不要重新拉取上游主题覆盖定制文件。原 NexT Git 元数据及 bundle 已备份到项目外。
- 保留工作区改动后拉取 `main`，运行 `npm ci`、`./node_modules/.bin/hexo generate --force`；本地预览使用 `./node_modules/.bin/hexo server -p 4187 -s`。本机 Safari 的 4190 端口被限制，继续使用 4187。
- 旧 Git 历史中的 Apple Health Pro 8.9.1 中英文发布已按主人要求撤回；本次保留那两条远端维护提交，不恢复被撤回的文章。

## 文件入口

| 内容 | 文件 |
| --- | --- |
| 公共布局、资源加载 | `themes/next/layout/_layout-studio.njk` |
| 首页、关于、Links | `themes/next/layout/_studio/` |
| 阅读页 | `themes/next/layout/post.njk`、`layout/_macro/post.njk` |
| 样式与阅读底板 | `source/css/studio.css` |
| 语言与正文保护 | `source/js/site-language.js` |
| 主题、搜索、目录 | `source/js/studio.js` |
| 动效与背景按需加载 | `source/js/studio-motion.js` |
| 天象仪、Mermaid 延迟加载 | `source/js/studio-orrery-loader.js`、`studio-mermaid-loader.js` |
| 压缩、摘要文件名、SVG 图标、公式检测 | `scripts/studio-assets.js` |
| 背景、头像、组织和研究图片 | `source/images/ambient/`、`avatar-snow.jpg`、`organizations/`、`research/` |

`public/` 和 `.deploy_git/` 是产物，不是编辑入口。MathJax 由锁定的 npm 依赖提供并在构建时输出到 `/vendor/mathjax/`。图标构建数据及许可证放在 `theme-assets/fontawesome/`，不要移入 `scripts/`。

## 必须保留的设计决定

1. 首页只有一屏，三个入口为关于、文章、摄影；文章列表和摄影跳到独立页面。
2. 手机竖屏保持现有照片背景与底部介绍的 B 构图，不套用桌面分栏；手机首页不下载光环背景。
3. 右上角保留语言、深浅色两个按钮；首次跟随系统语言与主题，手动选择持久保存。
4. UI 可切换中英文，文章标题、正文、摘要和目录不自动翻译。教育、公司/组织经历的名称及说明始终英文。
5. 深色保留暖金光环与颗粒感；浅色保留全幅灰银颗粒的自然过渡。只请求当前主题/方向的背景，不恢复双背景同时下载。
6. 深色文章页光环为 0.20、羽化阅读底板为 `rgba(24,33,43,.94)`，正文 18px / 1.9，桌面文字列 700px。这里比展示页更稳定，不要用全站透明度调整把正文底板一起削弱。
7. 头像是雪地照片 `avatar-snow.jpg`；四个组织 logo 保持统一尺寸与对齐，电子科大校徽保留白底。研究缩略图用无损 WebP，点击仍打开 PNG 原图。
8. 保留文章分类与组合搜索、键盘焦点、减少动态效果偏好、代码复制反馈、天象仪 Escape 返回焦点、图表延迟加载与主题重着色。

## 验证与发布纪律

本次本地采样中，About 的资源字节减少 49.0%、请求 18 → 10；Links 初始资源字节减少 67.3%、请求 14 → 4。这是相同桌面视口的开发样本，不是线上速度或真实用户指标。

后续修改先构建并检查本地深浅色及手机端，尤其公式、Mermaid、代码复制、分类搜索和天象仪。确认没有丢文章媒体，检查生成目录不含备份和临时审计页面，再按主人的明确发布授权部署。部署后等 Pages 状态 `built` 且 commit 对应本次发布，再核验线上 HTML 的摘要资源路径及 CSS 标记；不能只凭 HTTP 200。

源码媒体忽略规则仍在：部分 `source/_posts/` 下照片不会跟随普通 clone。现有维护主机请保留这些文件；新主机从历史备份或发布仓库对应文章路径恢复后再构建。不要提交密钥、缓存、备份、`node_modules` 或生成产物到源码库。

## 备份与回退

当前 Mac 备份目录：`/Users/lee/myblog-backups/2026-11-06-performance-reading/`。包括性能/阅读调整前文件、源码及 NexT Git bundle、原主题 Git 元数据。更早完整改版备份在 `/Users/lee/myblog-backups/2026-11-05-design/`。

回退前先保存当前工作，再恢复相应源文件、安装锁定依赖、构建和预览。`studio_design: false` 可临时使用保留的旧版布局。线上回退也需要按部署流程核验。

## 本次发布记录

- 正式域名：**https://leecdiang.com/**。`CNAME` 保持 `leecdiang.com`。
- 完整改版与性能/阅读实现提交：源码仓库 `fecb7a3a29cd9f41ad64a3abcbf441da5d7f2b48`。此后维护文档提交不改变已发布页面。
- 发布仓库提交：`fa4237e1e6aa8d02fe8c91dd7ec4efcee4c1be6a`；GitHub Pages 已报告 `built`，无构建错误。
- 发布前的线上版本：`aaa0c44c6822395684f3cc3b1dd1060b7cdd3190`，可在发布仓库历史中查阅、恢复。
- 正式域名六个入口已核对：首页、About、Archives、Photography、Links、流控文章；样式、核心脚本、文章脚本、新头像、研究缩略图已逐字节对比本地构建。
- 当前资源标记：`/assets/studio/style.3ccaeaac006f.css`、`core.38bf5c7b74cd.js`、`content.f8c2acaeff11.js`。
- 已将该源码提交单独导出到干净目录，重新运行 `npm ci` 和 Hexo 构建，构建无警告/错误；生成的四个 Studio 摘要资源文件名与正式发布一致。此检查不包含被既有忽略规则排除的文章照片，完整媒体仍按前文恢复。
- 发布前逐篇比较了旧线上产物与新产物的 `.post-body` 文字：20 篇全部一致；本轮也未改变 187 个文章源文件/素材的快照校验值。
- GitHub 原有维护历史已合并保留；不强推覆盖 OpenClaw 的源码分支更新。本次完成发布，不需要重复部署同一版本。
