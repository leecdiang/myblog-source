'use strict';
// Markdown consumes the backslash before MathJax runs. Preserve literal prices.
const token = 'FILMESCAPEDDOLLAR20261102';
hexo.extend.filter.register('before_post_render', data => {
  if (data.slug === 'film-emulation-pipelines') data.content = data.content.replace(/\\\$/g, token);
  return data;
});
hexo.extend.filter.register('after_post_render', data => {
  if (data.slug === 'film-emulation-pipelines') data.content = data.content.split(token).join('\\$').replace(/<table>([\s\S]*?)<\/table>/g, (table, content) => content.includes('<img ') ? table.replace('<table>', '<table style="min-width:620px">') : table);
  return data;
});
