'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const CleanCSS = require('clean-css');
const {minify} = require('terser');
const root = hexo.base_dir;
let manifest = {};
let assets = [];
let themeBootstrap = '';

// Ship only the SVG glyphs used by this site, retaining the existing fa-* API.
function iconCSS() {
  const bank = JSON.parse(fs.readFileSync(path.join(root, 'theme-assets/fontawesome/studio-icons.json')));
  const names = new Set(['copy', 'check-circle', 'times-circle', 'angle-down']);
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (entry.name === 'data') continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (/\.(?:njk|md|html|js|yml)$/.test(file)) {
        const content = fs.readFileSync(file, 'utf8');
        for (const match of content.matchAll(/\bfa-([a-z0-9]+(?:-[a-z0-9]+)*)/g)) names.add(match[1]);
      }
    }
  }
  scan(path.join(root, 'source'));
  scan(path.join(root, 'themes/next/layout'));
  let css = '/*! Font Awesome Free 7.0.0 SVG icons: CC BY 4.0; see theme-assets/fontawesome/FONT-AWESOME-LICENSE.txt. */\n';
  css += '.fa,.fas,.far,.fab{display:inline-block;font-style:normal;font-variant:normal;line-height:1;vertical-align:-.125em}.fa::before,.fas::before,.far::before,.fab::before{content:"";display:inline-block;width:1em;height:1em;background:currentColor;-webkit-mask:var(--studio-icon) center/contain no-repeat;mask:var(--studio-icon) center/contain no-repeat}.fa-fw{width:1.25em;text-align:center}';
  const url = svg => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  for (const name of [...names].sort()) {
    const icon = bank.icons[name] || bank.icons[bank.aliases[name]];
    if (!icon) continue; // Utility classes, such as fa-fw, are not glyphs.
    css += `.fa-${name}{--studio-icon:${url(icon.solid || icon.brands || icon.regular)}}`;
    if (icon.regular) css += `.far.fa-${name}{--studio-icon:${url(icon.regular)}}`;
    if (icon.brands) css += `.fab.fa-${name}{--studio-icon:${url(icon.brands)}}`;
  }
  return css;
}

hexo.extend.filter.register('before_generate', async () => {
  manifest = {};
  assets = [];
  const bootstrap = await minify(fs.readFileSync(path.join(root, 'source/js/studio-theme-state.js'), 'utf8'), {
    compress: {passes: 2}, mangle: true
  });
  themeBootstrap = bootstrap.code;
  function add(name, extension, content) {
    const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
    const route = `assets/studio/${name}.${hash}.${extension}`;
    manifest[name] = '/' + route;
    assets.push({path: route, data: content});
  }
  // Keep the original artwork byte-for-byte: shrinking it erases its texture.
  // Embedding preserves first-paint availability without a late image request.
  let ambientCSS = ':root{';
  for (const [name, file] of Object.entries({
    'light-landscape': 'halo-light-landscape-v9.webp',
    'light-portrait': 'halo-light-portrait-v9.webp',
    'dark-landscape': 'halo-dark-landscape-v2.webp',
    'dark-portrait': 'halo-dark-portrait-v2.webp'
  })) {
    const buffer = fs.readFileSync(path.join(root, 'source/images/ambient', file));
    ambientCSS += `--ambient-${name}:url("data:image/webp;base64,${buffer.toString('base64')}");`;
  }
  ambientCSS += '}';
  const css = new CleanCSS({level: 1, rebase: false}).minify(
    fs.readFileSync(path.join(root, 'source/css/studio.css'), 'utf8') + '\n' + iconCSS() + '\n' + ambientCSS
  );
  if (css.errors.length) throw new Error(css.errors.join('\n'));
  add('style', 'css', css.styles);
  const bundles = {
    core: ['source/js/site-language.js', 'source/js/studio-motion.js', 'source/js/studio-navigation.js', 'source/js/studio.js'],
    content: ['themes/next/source/js/config.js', 'themes/next/source/js/utils.js'],
    orrery: ['source/js/studio-orrery-loader.js']
  };
  for (const [name, files] of Object.entries(bundles)) {
    const result = await minify(files.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n;\n'), {
      compress: {passes: 2}, mangle: true, format: {comments: /^!/}
    });
    add(name, 'js', result.code);
  }
});
hexo.extend.generator.register('studio-assets', () => {
  const output = [...assets];
  // Cached HTML can outlive a deployment; keep previously shipped content hashes.
  const compatibility = path.join(root, 'theme-assets/studio-compat');
  if (fs.existsSync(compatibility)) {
    for (const name of fs.readdirSync(compatibility)) {
      if (/^(?:style|core|content|math|orrery)\.[a-f0-9]{12}\.(?:css|js)$/.test(name) && !output.some(asset => asset.path === 'assets/studio/' + name)) {
        output.push({path: 'assets/studio/' + name, data: () => fs.createReadStream(path.join(compatibility, name))});
      }
    }
  }
  // Keep MathJax components and fonts same-origin; its loader discovers these paths.
  const base = path.join(root, 'node_modules/mathjax/es5');
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else output.push({path: 'vendor/mathjax/' + path.relative(base, file).split(path.sep).join('/'), data: () => fs.createReadStream(file)});
    }
  }
  visit(base);
  output.push({path: 'vendor/mathjax/LICENSE', data: () => fs.createReadStream(path.join(root, 'node_modules/mathjax/LICENSE'))});
  return output;
});
hexo.extend.helper.register('studio_asset', name => manifest[name]);
hexo.extend.helper.register('studio_theme_bootstrap', () => themeBootstrap);
hexo.extend.helper.register('studio_has_math', page => {
  if (page.mathjax === false) return false;
  if (page.mathjax === true) return true;
  const content = String(page.content || '').replace(/<(pre|code)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  return /\$\$|\\\(|\\\[|\$(?!\s|\d+[.,]?\d*\b)[^$\n]+\$/.test(content);
});
