# 交给 leecdiang.com 维护 Agent

## 交付目标

将本包中的完整长文接入已有 Hexo + NexT Gemini 博客。文章标题为《大模型推理到底在忙什么：从一个 token 到多机集群》，slug 为 `llm-inference-from-token-to-cluster`。正文已完成两轮文字编辑；不要为了接入而再次压缩为摘要、改写算例或增加硬件排名。

项目资料指明实际仓库是 `/Users/lee/myblog`，线上地址为 `https://leecdiang.com/`。进入实际仓库后先阅读当前 `AGENTS.md`、`README.md`、`source/_posts/writing-template.md` 与 `source/_visuals/README.md`，确认项目没有在本包制作后变更约定。本包没有执行该仓库的 Hexo 构建或线上部署。

## 需要复制的三处

1. `source/_posts/llm-inference-from-token-to-cluster.md`
2. `source/_posts/llm-inference-from-token-to-cluster/` 整个资源目录
3. `source/_visuals/inference/` 的 11 个 SVG 文件

保留当前仓库的 `scripts/visual-svg.js`、`source/js/visual-diagrams.js` 与主题样式。包内没有要求替换这些全局文件。若相同路径已存在，先按仓库规则备份并检查差异；不要直接覆盖用户后续修改。

## 渲染核验

正文使用 `note primary`、`glass-pill`、原有 Font Awesome `fas fa-file-pdf` 和 `visual_svg`。主题 SVG 以 CSS 变量着色，带 viewBox、可访问标签和独立 ID，单个文件均小于现有 200,000 字节限制。

图片与交互页使用 `./images/...`、`./interactive/...`。交互桥接脚本只负责同一篇文章的 iframe 高度与主题，支持 `pjax:success` 重新挂载，不改站点导航或全局主题。

检查实际构建是否把文章资源目录中的交互 HTML 当作模板再次渲染。必要时在现有 `skip_render` 配置中最小化补充对应路径，保留已有条目；不要用本包覆盖整个 `_config.yml`。尤其核对：

```yaml
skip_render:
  - '_posts/**/interactive/**'
  - '_posts/**/data/**'
  - '_posts/**/reproduce/**'
```

这是一段待合并的路径示例，不是完整配置。构建产物中应能按文章实际 URL 打开 `interactive/inference-lab.html?tab=batch` 与 `?tab=memory`。必须根据当前 Hexo 资源处理方式检验结果，不能只看 YAML 已写入。

文章源保留 `published: false`。按照当前仓库的草稿预览规则准备本地构建；如需要临时调整该字段，应在隔离的本地预览工作副本中操作，并明确记录最终状态。

然后执行项目规定的 `hexo generate` 与 `hexo server`。启动前检查 4000 端口；通过 `curl --noproxy '*'` 访问实际文章 URL。本文的完整 Hexo 页面验收仍需要在此完成。

## 必须看的页面行为

- 公式完整渲染，正文从 H2 开始，目录只按原约定生成。
- 17 幅图按阅读顺序编号；11 幅主题 SVG、6 张外部来源图片都能打开。
- 深浅主题与阅读中切换正常；厂商图和论文原图不做颜色反转。
- 桌面、390 px 与 320 px 窄屏没有页面级横向溢出。宽表格、公式与科学图允许在自身区域内滚动。
- 两个实验分别初始打开 batch 和 memory 页签；调整参数后结果更新，iframe 高度跟随，键盘可操作。
- 55 个参考资料锚点有效；原论文和官方规格链接保留。
- 关闭 JavaScript 或使用 RSS 时，正文、公式源码、图注和静态图仍有完整信息；交互是补充，不承载唯一结论。

项目的水印插件曾把 PNG 转为 JPG 并改写引用。因此需要检查最终 HTML 中的真实图片路径，也检查 favicon 仍指向正确 `.png`。不要仅因预览里图片正常就认为生产构建无误；修改水印插件前遵守现有仓库规则。

## 发布边界

这次交付授权写作、素材整理和可审阅预览。上线仍按项目现有的明确发布授权规则执行。先完成上述接入与本地验收，再把具体结果交给用户；不要在准备工作尚未完成时要求用户先确认发布。

## 可直接交给维护 Agent 的短指令

> 请将这个素材包接入 leecdiang.com 的现有 Hexo 博客。先阅读实际仓库的 AGENTS.md、README 和写作/图表规范，按本文件只复制文章、同名资源目录和 inference SVG；保留已有全局样式与插件。正文已完成 Humanizer 和第二轮编辑，不要改写事实或删减技术解释。检查交互 HTML 的原样输出和相对路径，在本地完成 Hexo 构建、桌面/手机与深浅色验收，特别检查 PNG 水印改写和 favicon。交付本地预览及待发布状态；发布按既有明确授权规则处理。
