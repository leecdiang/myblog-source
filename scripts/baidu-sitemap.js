'use strict';

// Preserve the existing Baidu sitemap without the abandoned plugin's Hexo 3 tree.
const escapeXML = value => String(value).replace(/[<>&"']/g, char => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
})[char]);

hexo.extend.generator.register('baidusitemap', function (locals) {
  const config = this.config.baidusitemap || {};
  const base = new URL(this.config.root, (config.url || this.config.url).replace(/\/$/, '') + '/');
  const posts = locals.posts.toArray()
    .filter(post => post.published !== false && post.baidusitemap !== false)
    .sort((a, b) => b.updated - a.updated);
  const urls = posts.map(post => {
    const url = new URL(post.path, base);
    if (url.origin !== base.origin) throw new Error('Baidu sitemap URL must remain on the site origin.');
    return `  <url><loc>${escapeXML(url.href)}</loc><lastmod>${post.updated.toISOString().slice(0, 10)}</lastmod></url>`;
  });
  return {
    path: config.path || 'baidusitemap.xml',
    data: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n'
  };
});
