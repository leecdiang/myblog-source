'use strict';
const crypto = require('node:crypto');
const cheerio = require('cheerio');
const {init} = require('mathjax');
const CleanCSS = require('clean-css');
let engine;
function getEngine() {
  return engine || (engine = init({
    loader: {load: ['input/tex', 'output/chtml', 'a11y/assistive-mml']},
    tex: {inlineMath: [['$', '$'], ['\\(', '\\)']], tags: 'none'},
    chtml: {fontURL: '/vendor/mathjax/output/chtml/fonts/woff-v2'}
  }));
}
async function textRoute(route, name) {
  const chunks = [];
  for await (const chunk of route.get(name)) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
}

// Typeset the same TeX with the pinned MathJax version, before static image/feed QA.
// Browsers receive CHTML + assistive MathML; no client parser is needed for articles.
hexo.extend.filter.register('after_generate', async function () {
  const route = this.route;
  const rendered = [];
  let math;
  let count = 0;
  for (const name of route.list().filter(name => name.endsWith('.html')).sort()) {
    const html = await textRoute(route, name);
    if (!html.includes('data-name="enableMath"')) continue;
    const $ = cheerio.load(html, {decodeEntities: false});
    if ($('script[data-name="enableMath"]').text().trim() !== 'true') continue;
    math = math || await getEngine();
    const adaptor = math.startup.adaptor;
    let pageCount = 0;
    for (const body of $('.post-body').toArray()) {
      const target = $(body);
      if (target.find('[data-math-prerendered]').length) continue;
      math.texReset();
      const document = math.startup.getDocument(target.html());
      await math._.mathjax.mathjax.handleRetriesFor(() => document.render());
      let formulas = 0;
      for (const item of document.math) {
        if (!item.typesetRoot || adaptor.kind(item.typesetRoot) !== 'mjx-container') continue;
        adaptor.setAttribute(item.typesetRoot, 'data-tex', item.math);
        formulas++;
      }
      const result = adaptor.innerHTML(adaptor.body(document.document));
      if (/<mjx-merror\b/.test(result)) throw new Error('MathJax error in ' + name);
      target.html(result).attr('data-math-prerendered', String(formulas));
      count += formulas;
      pageCount += formulas;
    }
    $('script[src*="/third-party/math/mathjax.js"],script[data-name="mathjax"]').remove();
    $('script[data-name="enableMath"]').text('false');
    $('html').attr('data-static-math', 'true');
    rendered.push({name, $, formulas: pageCount});
  }
  if (!rendered.length) return;
  const css = math.startup.adaptor.textContent(math.chtmlStylesheet()) + '\n' +
    'mjx-assistive-mml{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}' +
    'mjx-container[jax="CHTML"]{color:inherit}';
  const minified = new CleanCSS({rebase: false}).minify(css);
  if (minified.errors.length) throw new Error(minified.errors.join('\n'));
  const hash = crypto.createHash('sha256').update(minified.styles).digest('hex').slice(0,12);
  const cssPath = `assets/studio/math.${hash}.css`;
  route.set(cssPath, minified.styles);
  for (const {name, $, formulas} of rendered) {
    if (formulas) $('link[data-studio-style]').after($('<link rel="stylesheet" data-static-math-style>').attr('href', '/' + cssPath));
    route.set(name, $.html());
  }
  this.log.info(`[Static math] ${count} expressions in ${rendered.length} pages; client MathJax omitted.`);
}, 25);
