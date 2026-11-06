# Beyond the Clock · 图表与文章组件

NexT Gemini 的现有组件使用规范，更新于 2026-11-01。部署与权限说明见项目根 `README.md`。

## 实际文件

- `templates/figure.html`：图表容器。
- `templates/matrix.html`：矩阵模板。
- `visuals.css`：仅保留入口说明。唯一运行样式在 `source/_data/styles.styl`，修改该文件才会进入全站 CSS。

旧说明提到的 generate.js、pipeline-3d、stack-3d、loop、timeline、state-machine 模板目前不在本目录，不应按现有文件引用。已有博文中的图表可作实现参考。

## 选用组件

| 内容 | 现有组件 | 示例 |
| --- | --- | --- |
| 开头简介 | NexT `note primary` | motorcycle-cylinders-displacement-vibration.md、film-emulation-pipelines.md |
| 资料/源码入口 | `glass-pill` + Font Awesome 图标 + 文本 | agent-step-value.md |
| 数据与结构图 | `v-figure` + 内联 SVG + `v-caption` | film-emulation-pipelines.md |
| 宽图横向浏览 | `v-chart-scroll` + `v-chart-viewport` | 胶片模拟文章的曲线图 |
| 比较矩阵 | `v-matrix` | templates/matrix.html |
| 简单流程图 | NexT `mermaid` 标签 | 写作模板 |
| 照片/官方样片 | 原始图片及出处 | 不用 CSS 反相适配深色 |

## 图表标记

```text
{% raw %}
<div class="v-figure"><svg viewBox="0 0 800 420" role="img" aria-label="图表的含义"><text x="30" y="40" class="v-ink">标题</text></svg><p class="v-caption">图 1｜数据来源、单位、假设或必要限制。</p></div>
{% endraw %}
```

SVG 压成单行，防止 Markdown 插入换行标签。raw 块内图注和链接直接写 HTML，不放需要 Markdown 转换的强调或引用语法。SVG 提供 `viewBox`、`role="img"` 和有意义的 `aria-label`；页面有多个图时，marker、clipPath 等 ID 必须唯一。

## 配色与排版

- 背景、文字与边线使用 `--surface-card`、`--text-primary`、`--text-secondary`、`--text-muted`、`--border-subtle`、`--divider`、`--shadow`、`--accent`。
- SVG 文字使用 `v-ink / v-sub / v-muted`；网格使用 `v-grid`；强调描边可用 `v-accent / v-teal / v-amber`。这些强调类控制 stroke，不自动控制 fill。
- 系列色用 `--chart-blue / --chart-amber / --chart-red / --chart-teal`，深浅两套值；`v-teal / v-amber` 也引用这些变量。
- 普通图用 width:100% 与 viewBox 自适应。信息密集的宽图可使用 `v-chart-scroll`，内部 `v-chart-viewport` 的 SVG 最小宽度 620px；图注留在滚动区外。旧 `film-chart` 继续兼容。
- 单幅图建议控制在约 380–760 的 viewBox 高度；多面板可拆分，每幅保留标题和必要署名。不要堆成超长纵向 Mermaid。
- 图注用 `v-caption`。数据图必须保留坐标单位、线性/对数刻度说明、图例、来源与范围值；缺失数据保留断点，不补零或随意连线。
- 不用颜色作为唯一识别方式；曲线应有文字标签，胶片曲线已使用实线、虚线、点线和点划线，图例同步；离散观测值保留点标记。

## 发布验收

除分别打开深浅主题外，还要在同一页面连续切换“浅→深→浅”和“深→浅→深”，不刷新检查文字、连线与节点颜色。Mermaid 的颜色修正必须对每个逗号分隔的选择器限定范围，不能覆盖普通 SVG 的主题变量。

确认亮/暗两色文字可读；手机端宽图可浏览、图注自然换行、页面不横向溢出；流程图确实渲染为图，图片最终地址有效。样式更新必须核对 public/css/main.css；具体命令与发布后验证见根 README。

## 可复用 SVG 标签

```text
{% visual_svg film/fig04_burst_noise_theory %}
图 2｜图注及 <a href="#film-ref-S01">来源</a>。
{% endvisual_svg %}
```

标签不要放入 raw 块。图注写 HTML。构建时读取 `source/_visuals/<目录>/<名称>.svg` 并内联，SVG 需带 aria-label；不允许路径穿越，每幅限 200 KB。无 JavaScript 也能滚动；增强脚本只在确实溢出时显示提示和加入 Tab 顺序，支持 PJAX 重新挂载。

胶片图的 CSV、离线生成器路径及命令见根 README。不要手改生成 SVG，修改生成器或数据后再生成。长路径不再放入 Markdown；Visual Diagram Kit CSS 只维护 styles.styl 中的一份。

## 天象仪交互验收

太阳系入口使用 `source/js/orrery.js` 与 `source/css/orrery.css`。修改后检查：

- 时间滑块方向键可从 0 调到 ±0.25 天，“实时”归零。
- Tab 焦点留在弹窗，Escape 先关闭设置再关闭弹窗，关闭后回到入口。
- 减少动态效果停止持续绘制；手动拖动、双指缩放、点选和双击复位仍可操作。
- 三个星盘图层的八种组合都能绘制，控件不覆盖画布；小屏默认只开现代科学。
- 检查 390px 竖屏及低高度横屏，列表和原有控件均可滚动访问；深浅主题和中英文切换正常。
- 画布尺寸仅在变化时重设；静态背景按尺寸和主题缓存，天体和星空仍按视角绘制。
