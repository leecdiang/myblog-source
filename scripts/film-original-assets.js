'use strict';
const fs = require('fs');
const path = require('path');
// The global watermark pass emits JPEGs and removes PNG routes. Keep the
// article's original downloadable assets available under their existing URLs.
hexo.extend.filter.register('after_generate', () => {
  const source = path.join(hexo.source_dir, '_posts/film-emulation-pipelines/assets');
  for (const name of fs.readdirSync(source)) {
    if (!fs.statSync(path.join(source, name)).isFile()) continue;
    hexo.route.set('2026/11/01/film-emulation-pipelines/assets/' + name, () => fs.createReadStream(path.join(source, name)));
  }
}, 1000);
