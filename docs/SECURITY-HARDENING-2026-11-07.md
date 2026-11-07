# 博客安全加固记录 · 2026-11-07

## 本地源码与预览

- 移除 `hexo-admin`、旧百度 sitemap 插件及已公开的后台账号配置。不再保留任何 Web 管理入口，历史密码哈希和会话密钥不再用于本项目；若原密码在别处复用，需由账号持有人自行更换。
- 预览绑定 `127.0.0.1:4000`，中间件也拒绝非回环地址；伪造转发头不能绕过。线上无需暴露本机端口或建立隧道。
- 使用官方 npm registry 和锁文件。`npm ci --ignore-scripts` 已验证，sharp 的预编译原生组件可正常加载。
- Hexo 更新至 8.1.2、sharp 至 0.35.5、image-size 至 2.1.0；移除未启用的字数统计插件及其旧依赖。直接声明代码实际使用的 cheerio、image-size。主题自带开发依赖中的 js-yaml 从 4.1.0 更新到已修复的 4.3.2；它不属于网站运行时。
- Markdown 解析器更新至 15.0.3。原 Hexo Markdown 插件有私有 Token 导入兼容问题，最小适配放在 `vendor/hexo-renderer-markdown-it`，保留上游许可证、实现和来源记录。
- deepmerge 的上游漏洞 GHSA-gcqx-w48m-w2h4 尚无已发布修复。`vendor/deepmerge-safe` 保留 4.3.1 的实现和 MIT 许可，在复制两个输入时均过滤原型污染键；npm override 让所有依赖复用该补丁。该本地维护补丁不能只凭 npm 审计判断，应持续运行回归检查。
- 百度 sitemap 改由 `scripts/baidu-sitemap.js` 生成，保留公开文章 URL 和更新时间并执行 XML 转义。

## 页面与发布保护

- `scripts/site-security.js` 在所有生成的 HTML 中加入 CSP 和 Referrer Policy。可执行内联代码只接受模板产生的已知摘要，禁止任意内联事件、外部脚本和 `javascript:` 链接；正文交互脚本改为本地独立资源。
- CSP 的脚本策略不包含 `unsafe-inline` 或 `unsafe-eval`；样式保留 `unsafe-inline`，以兼容主题和 Mermaid 的 SVG/CSS 更新。
- 构建在 Markdown 渲染器不可用时中止，防止 Hexo 仅输出少量页面却以成功状态退出。
- 发布前同步扫描 source 和 public，阻止敏感配置、环境文件、Git 目录、备份、密钥文件、符号链接，以及缺少当前安全标记的 HTML；也拒绝空站点。
- 不把 `_headers` 文件当成 GitHub Pages 的响应头配置。线上响应头由 Cloudflare 规则设置，页面 CSP 由 Hexo 构建生成，两份策略共同生效。

## 已应用到 GitHub 与 Cloudflare 的保护

- 源码与发布仓库均已开启密钥扫描、推送保护、Dependabot 告警及安全更新。
- 两个 main 分支均禁止删除和非快进覆盖，规则对管理员生效。保留日常直接发布能力，没有增加不存在的必需 CI 检查。
- 主域名的四个 A 记录和 www 的 CNAME 均已启用 Cloudflare 代理。源站地址和 CNAME 目标保持原值，Google 验证 TXT 保留。
- Full (strict)、Always Use HTTPS、最低 TLS 1.2；TLS 1.3 保持启用。
- 响应头规则仅匹配 `leecdiang.com` 和 `www.leecdiang.com`，设置 nosniff、DENY、严格来源 Referrer Policy、禁用不需要的浏览器权限、禁止被嵌入及对象加载。HSTS 初始 `max-age=86400`，未开启 includeSubDomains 或 preload。
- 敏感路径拦截覆盖 Git/环境文件、废弃后台和 WordPress 扫描端点。实测 `.env`、`.git/HEAD`、`admin/`、配置文件返回 Cloudflare 403；首页、归档和 sitemap 正常。
- 页面限速：每 IP 10 秒超过 60 次 HTML 页面请求时阻断 10 秒；排除 Cloudflare 已验证机器人，不把图片、脚本、视频等资源计入本规则。
- HTML 缓存仅匹配两个博客域名上的 GET/HEAD 页面请求，尊重源站 Cache-Control；忽略查询字符串以降低随机参数绕过缓存的风险。归档筛选在客户端执行，不依赖服务端参数。发布后应清除相关页面缓存并验证唯一版本标记。
- 界面确认网络层与 SSL/TLS DDoS 防护为 Active，HTTP DDoS 托管规则始终启用。未购买套餐，未启用全站挑战模式。
- GitHub Pages 账号设置已显示 `leecdiang.com Verified`；对应 TXT 记录已添加并应长期保留。GitHub 双重验证已启用，账号已配置通行密钥和验证器，不改动这些凭据。

## 核验与维护

执行 `npm run check:security`、`npm run check:content`、`npm run check:loading`，再做浏览器抽查。2026-11-07 的生成结果包含 152 个带 CSP 的 HTML 页面、179 个静态公式（9 页）、21 个百度 sitemap 文章 URL；Atom、图片、目录及 404 检查通过。与加固前生成结果比较，29 个正文区域的规范化文本、图片引用及标题锚点均未变化。

本次 npm 官方审计为 0 已报告漏洞，包含两个有来源记录的本地维护包，不代表不存在未知漏洞。不要用 `npm audit fix --force` 随意回退 Hexo 或其他直接依赖。

GitHub Pages 发布仍要求明确的上线授权，并执行项目既定构建、预览、杂项扫描、部署及线上内容核验。整个 public 会发布，其中可能包含其他尚未提交的界面或文章改动，应在授权时说明。主分支保护可能拒绝新建部署目录中的无关历史；应先同步发布仓库，不能通过关闭保护强行覆盖。

剩余边界：平台防护没有无限抗攻击保证；GitHub Pages 源站本身仍公开。Cloudflare 双重验证在检查时为 Inactive，已将绑定验证器和保存恢复码的步骤交给持有人；域名注册商的双重验证和 DNSSEC 仍需另行确认。域名注册商、GitHub、Cloudflare 的账号凭据和恢复码只能由持有人管理。

GitHub 的依赖图仍可能按 deepmerge 上游 4.3.1 的版本区间提示已回移修复的本地包。对此只处理 GHSA-gcqx-w48m-w2h4 的特定告警，并附本地代码及回归检查依据，不关闭安全扫描或其他新告警。
