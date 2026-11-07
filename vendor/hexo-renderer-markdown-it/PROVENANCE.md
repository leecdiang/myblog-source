# Markdown renderer compatibility patch

Upstream: hexo-renderer-markdown-it 7.1.1 (MIT), https://github.com/hexojs/hexo-renderer-markdown-it.

The upstream renderer pins markdown-it 13 and imports its private `lib/token` path. To use the security-fixed markdown-it 15 parser, this copy changes only the parser dependency and obtains Token from the heading token already supplied to the permalink renderer. All rendering, anchors, image behavior and plugin configuration otherwise remain upstream code. Keep the upstream license.

Original `lib/anchors.js` SHA-256: `b5f010556cc4b1f70adde801e02ea23aa97a05ca8697634c25b2de22c86afc72`.
