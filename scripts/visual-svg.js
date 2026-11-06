'use strict';
// Keep theme variables in the document while keeping long SVG paths out of prose.
const fs = require('fs');
const path = require('path');
hexo.extend.tag.register('visual_svg', function (args, content) {
  const name = args[0] || '';
  if (!/^[a-z0-9_-]+\/[a-z0-9_-]+$/.test(name)) throw new Error('Invalid visual_svg name');
  const svg = fs.readFileSync(path.join(hexo.source_dir, '_visuals', name + '.svg'), 'utf8').trim();
  if (Buffer.byteLength(svg) > 200000) throw new Error('visual_svg exceeds 200 KB: ' + name);
  const title = (svg.match(/aria-label="([^"]+)"/) || [null, '图表'])[1];
  return '<div class="v-figure v-chart-scroll">' +
    '<p class="v-scroll-hint">左右滑动查看完整图表；键盘聚焦后可用方向键。</p>' +
    '<div class="v-chart-viewport" tabindex="0" role="region" aria-label="' + title + '（可横向滚动）">' + svg + '</div>' +
    '<p class="v-caption">' + content.trim() + '</p></div>';
}, { ends: true });
