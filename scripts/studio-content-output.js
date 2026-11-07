'use strict';

const crypto = require('node:crypto');
const cheerio = require('cheerio');
const sharp = require('sharp');
const {imageSize} = (() => { const size = require('image-size'); return {imageSize: size.imageSize || size}; })();

async function readRoute(route, name) {
  const stream = route.get(name);
  if (!stream) return null;
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
function localRoute(src, page) {
  try {
    const url = new URL(src, new URL(page, hexo.config.url + '/'));
    if (url.origin !== new URL(hexo.config.url).origin) return null;
    return decodeURIComponent(url.pathname).replace(/^\//, '');
  } catch { return null; }
}

// Run after watermark processing (default priority 10): dimensions and derivatives
// must describe the bytes actually shipped, including PNG-to-JPEG conversion.
hexo.extend.filter.register('after_generate', async function () {
  const route = this.route;
  const dimensions = new Map();
  const variants = new Map();
  const posts = new Map(this.locals.get('posts').toArray().map(post => [(post.path.endsWith('/') ? post.path + 'index.html' : post.path).replace(/^\/+/, ''), post]));
  for (const name of route.list().filter(name => name.endsWith('.html'))) {
    const buffer = await readRoute(route, name);
    const $ = cheerio.load(buffer.toString(), {decodeEntities: false});
    const post = posts.get(name);
    const photos = name === '2026/06/06/eight-thousand-miles/index.html';
    const images = $('.post-body img').toArray();
    for (const [index, element] of images.entries()) {
      const img = $(element);
      const src = img.attr('src') || img.attr('data-src');
      if (!src) continue;
      img.attr('src', src).removeAttr('data-src');
      if (img.attr('data-srcset')) img.attr('srcset', img.attr('data-srcset')).removeAttr('data-srcset');
      img.attr('decoding', 'async');
      if (!img.attr('loading')) img.attr('loading', photos && index === 0 ? 'eager' : 'lazy');
      const imageRoute = localRoute(src, name);
      if (!imageRoute) continue;
      if (!dimensions.has(imageRoute)) {
        const bytes = await readRoute(route, imageRoute);
        if (!bytes) throw new Error('Missing local content image: ' + imageRoute + ' in ' + name);
        let size;
        try { size = imageSize(bytes); } catch {
          try { size = await sharp(bytes).metadata(); } catch (error) { throw new Error('Unable to read dimensions: ' + imageRoute + ': ' + error.message); }
        }
        dimensions.set(imageRoute, {width: size.width, height: size.height});
      }
      const size = dimensions.get(imageRoute);
      img.attr({width: size.width, height: size.height});
      if (!photos) continue;
      // The route map already contains the watermarked, orientation-correct image.
      if (!variants.has(imageRoute)) {
        const bytes = await readRoute(route, imageRoute);
        const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0,16);
        const candidates = [];
        for (const width of [480, 960]) {
          if (width >= size.width) continue;
          const output = await sharp(bytes).resize({width}).webp({quality: 86}).toBuffer();
          const file = `assets/photos/${hash}-${width}.webp`;
          route.set(file, output);
          candidates.push(`/${file} ${width}w`);
        }
        candidates.push(`/${imageRoute} ${size.width}w`);
        variants.set(imageRoute, candidates.join(', '));
      }
      img.attr({srcset: variants.get(imageRoute), sizes: '(max-width: 700px) calc(100vw - 44px), 518px'});
      if (!img.parents('a').length) {
        img.wrap($('<a class="photo-original"></a>').attr({href: '/' + imageRoute, title: '查看大图：' + (img.attr('alt') || '')}));
        img.after('<span class="photo-original-label" aria-hidden="true">查看大图 ↗</span>');
      }
    }
    if ($('meta[property="og:image"]').attr('content')?.includes('/images/social/')) {
      $('head').append('<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">');
    }
    $('.post-body table').each((_, element) => {
      if (!$(element).parents('.table-container,figure.highlight').length) $(element).wrap('<div class="table-container"></div>');
    });
    // Extend the existing Article microdata, avoiding a competing JSON-LD graph.
    if (post) {
      const article = $('article[itemtype="http://schema.org/Article"]');
      article.children('[itemprop="post"]').remove();
      article.prepend($('<meta itemprop="datePublished">').attr('content', post.date.toISOString()));
      article.prepend($('<meta itemprop="dateModified">').attr('content', post.updated.toISOString()));
      article.find('[itemprop="author"]').append($('<link itemprop="url">').attr('href', this.config.url + '/about/'));
      const cover = $('meta[property="og:image"]').first().attr('content');
      if (cover) article.prepend($('<meta itemprop="image">').attr('content', cover));
    }
    route.set(name, $.html());
  }

  // Atom's default content type is text. Supply a static HTML reading version
  // from the final page so image URLs and transformed formats stay in sync.
  const feedName = this.config.feed.path;
  if (typeof feedName !== 'string' || !route.get(feedName)) return;
  const xml = cheerio.load((await readRoute(route, feedName)).toString(), {xmlMode: true, decodeEntities: true});
  for (const entry of xml('entry').toArray()) {
    const item = xml(entry);
    const permalink = item.children('id').text();
    const htmlRoute = localRoute(permalink, 'index.html');
    const finalRoute = htmlRoute && (htmlRoute.endsWith('/') ? htmlRoute + 'index.html' : htmlRoute);
    const html = finalRoute && await readRoute(route, finalRoute);
    if (!html) continue;
    const $ = cheerio.load(html.toString(), {decodeEntities: false});
    const body = $('.post-body').first();
    body.find('mjx-container[data-tex]').each((_, node) => {
      const formula=$(node), tex=formula.attr('data-tex');
      formula.replaceWith($('<code></code>').text(tex));
    });
    body.find('svg[aria-label]').each((_, node) => $(node).before($('<p></p>').text($(node).attr('aria-label'))));
    body.find('script,style,button,input,select,output,svg,.arch-controls,.arch-preset,.arch-levels,.arch-map-picker,.arch-map-note,.mem-bars,.arch-amdahl-track,.arch-flow-table,.arch-result,.arch-plot-wrap').remove();
    const defaults = {
      'roofline-lab': '示例上界：1.00 TFLOP/s；ridge point 为 5 FLOP/Byte。',
      'multi-roofline-lab': '流式预设：各层 I = 8 FLOP/Byte，四层上界分别为 8、6.4、2.4、0.8 TFLOP/s。LLC 复用预设将 HBM 流量降为 1/16，使 LLC 的 2.4 TFLOP/s 成为最低上界。',
      'amat-lab': '示例 AMAT = 1 ns + 5% × 100 ns = 6 ns。',
      'amdahl-lab': '示例整体加速比 2.50×，不可加速部分为 20% 时理论上限为 5×。',
      'memory-lab': '示例所需在途量为 20,000 B = 20.0 KB；64 个 64 B 请求提供 4,096 B，可达带宽 40.96 GB/s。'
    };
    body.find('.arch-lab').each((_, node) => {
      const lab = $(node);
      if (defaults[lab.attr('id')]) lab.append($('<p></p>').text(defaults[lab.attr('id')]));
      lab.append($('<p></p>').append($('<a>打开原文使用交互模型</a>').attr('href', permalink + '#' + lab.attr('id'))));
    });
    body.find('a[href],img[src],source[srcset]').each((_, node) => {
      const element = $(node);
      for (const attr of ['href','src']) {
        const value = element.attr(attr);
        if (value) element.attr(attr, new URL(value, permalink).href);
      }
      element.removeAttr('srcset').removeAttr('sizes').removeAttr('loading');
    });
    body.find('[id]').removeAttr('id');
    item.children('content').attr('type', 'html').text(body.html() || '');
    // Metadata descriptions are plain text, not HTML text constructs.
    item.children('summary').attr('type', 'text');
  }
  route.set(feedName, xml.xml());
}, 30);
