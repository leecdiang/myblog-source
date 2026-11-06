# 博客项目规则（Codex 交接版）

Hexo 博客。唯一有效项目根目录：`/Users/lee/myblog`。实际地址：https://leecdiang.com/（`root: /`）。主题为 NexT Gemini。当前聊天工作目录不一定是博客根目录。

维护入口见根目录 `README.md`；写作参考 `source/_posts/writing-template.md`；图表规范见 `source/_visuals/README.md`。旧域名或旧路径的 IndexNow 提交应作为配置异常检查，不能忽略。
维护方：Codex。交流语言：中文。

## 部署纪律（最高优先级，违反 = 事故）

1. **禁止跳过构建、预览和发布授权直接部署**；具体命令与核验流程见 `README.md`。
2. 必须先 `hexo generate` 构建
3. 本地预览用 `hexo server`（先 `lsof -i :4000` 检查端口，避免冲突）
4. 用 `curl --noproxy '*'` 验证本地页面（环境有 http_proxy 代理，不加会走到代理返回 502）
5. **Diang 明确授权部署/发布到线上后**才执行 `./node_modules/.bin/hexo deploy`。“效果不错/OK”不算发布授权；已有明确授权不重复询问。若要求先看预览，先交付预览。

## 已知坑（历史教训）

- **水印插件** `scripts/hexo-watermark.js`：会把博文 PNG 图转 JPG 并改写 HTML 引用。它曾用无边界文件名替换，短文件名（如 `2.png`）会误伤 `favicon-32x32.png` 这类含同名子串的引用（改写成不存在的 .jpg）。已加文件名边界修复（备份：`scripts/hexo-watermark.js.bak.20260805-1006`）。**修改该脚本后必须验证其他博文图片不受影响**
- **favicon**：图标文件放 `source/images/`（favicon-16x16.png / favicon-32x32.png / apple-touch-icon.png），引用配置在 `themes/next/_config.yml` 的 `favicon:` 块。换 favicon 后必须 `hexo generate` 并检查生成的 HTML 里 favicon 引用保持 `.png`
- 修改已有博文前，备份到 `/Users/lee/myblog-backups/<日期>/`。不要把 `.bak`、`.DS_Store` 或临时文件放入 `source/`、`public/`；deploy 会发布整个 `public/`。

## 写作规范

- 正式博文完成后使用当前可用的 `humanizer` 技能；保留事实、数字、公式、引用与证据边界，不编造作者经历。
- 新博文开头加入与内容相称的 `note primary` 简介；图表与链接复用现有 UI，详见维护文档。

## 结构速览

- `source/_posts/`：文章（md）
- `source/images/`：图片资源
- `scripts/`：hexo 插件（hexo-watermark.js、hexo-nojekyll.js、indexnow.js）
- `themes/next/`：NexT 主题
- sitemap：https://leecdiang.com/sitemap.xml（站长平台的实际验证/收录状态需另行核验；`source/` 下 yandex/Bing 验证文件勿删）
