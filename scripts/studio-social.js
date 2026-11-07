'use strict';
const crypto = require('node:crypto');
const sharp = require('sharp');
const {escapeHTML} = require('hexo-util');
let covers = new Map();
let routes = [];
function lines(title) {
  const result = [];
  let line = '', weight = 0;
  for (const character of title.match(/[A-Za-z0-9]+|[^A-Za-z0-9]/gu) || []) {
    const size = /^[\x00-\x7F]+$/.test(character) ? .55 * character.length : 1;
    if (weight + size > 14) { result.push(line.trim()); line = ''; weight = 0; }
    line += character; weight += size;
  }
  if (line) result.push(line);
  return result;
}
hexo.extend.filter.register('before_generate', async () => {
  covers = new Map(); routes = [];
  for (const post of hexo.locals.get('posts').toArray()) {
    if (post.image_width) continue; // Photography can use its own representative image.
    const title = lines(post.title);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#101a28"/><path d="M850 150V470H1100M850 430L980 270H1100" fill="none" stroke="#93b6da" stroke-width="3"/><circle cx="960" cy="295" r="7" fill="#d9b57c"/><text x="80" y="100" font-family="sans-serif" font-size="25" fill="#a9bdd2">LEEcDiang · Beyond the Clock</text><g font-family="sans-serif" font-size="48" font-weight="600" fill="#edf1f6">${title.map((line,i) => `<text x="80" y="${title.length > 3 ? 200+i*68 : 240+i*78}">${escapeHTML(line)}</text>`).join('')}</g><text x="80" y="550" font-family="sans-serif" font-size="23" fill="#a9bdd2">${post.date.format('YYYY.MM.DD')} · leecdiang.com</text></svg>`;
    const bytes = await sharp(Buffer.from(svg)).png().toBuffer();
    const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);
    const path = `images/social/${hash}.png`;
    routes.push({path, data: bytes});
    covers.set(post.path, '/' + path);
  }
});
hexo.extend.generator.register('studio-social', () => routes);
hexo.extend.helper.register('studio_social', page => {
  const cover = covers.get(page.path);
  return cover ? {image: hexo.config.url + cover, twitter_card: 'summary_large_image', language: page.lang || 'zh-CN'} : {};
});
