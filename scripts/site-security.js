'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cheerio = require('cheerio');

const version = '2026-11-07';
const executable = type => !type || /^(?:text|application)\/(?:java|ecma)script(?:;|$)/i.test(type) || type === 'module';
const digest = script => "'sha256-" + crypto.createHash('sha256').update(script).digest('base64') + "'";

function policy(hashes, allowLocalInferenceFrame = false, allowVisitorMap = false) {
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "script-src 'self' " + [...hashes].sort().join(' '),
    "script-src-attr 'none'",
    // Mermaid and the theme update SVG and CSS styles at runtime.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://leecdiang.com https://media.overclock3d.net" + (allowVisitorMap ? " https://mapmyvisitors.com/map.png" : ""),
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self'",
    "frame-src " + (allowLocalInferenceFrame ? "'self'" : "'none'"),
    "worker-src 'none'",
    "form-action 'self'"
  ].join('; ');
}

function trustedScripts() {
  const layout = fs.readFileSync(path.join(hexo.base_dir, 'themes/next/layout/_layout-studio.njk'), 'utf8');
  const scripts = new Set();
  for (const match of layout.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    // Dynamic template expressions are never automatically trusted.
    if (!/[{%][{%]/.test(match[1])) scripts.add(digest(match[1]));
  }
  const bootstrap = hexo.extend.helper.get('studio_theme_bootstrap');
  if (bootstrap) scripts.add(digest(bootstrap()));
  return scripts;
}

hexo.extend.filter.register('before_generate', function () {
  if (!this.render.isRenderable('security-probe.md')) {
    throw new Error('Markdown renderer is unavailable; refusing to generate a partial website.');
  }
}, 0);

async function readRoute(route, name) {
  const chunks = [];
  for await (const chunk of route.get(name)) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
}

// Run after math, image and feed transforms: hashes must describe the final bytes.
hexo.extend.filter.register('after_generate', async function () {
  const trusted = trustedScripts();
  let count = 0;
  for (const name of this.route.list().filter(name => name.endsWith('.html'))) {
    const $ = cheerio.load(await readRoute(this.route, name), {decodeEntities: false});
    const hashes = new Set();
    $('script:not([src])').each((_, element) => {
      const script = $(element);
      if (!executable(script.attr('type'))) return;
      const hash = digest(script.text());
      if (!trusted.has(hash)) throw new Error('Unapproved inline script in ' + name + ' (' + hash + '); move reviewed code to a local JS file.');
      hashes.add(hash);
    });
    // Never silently authorize content-supplied handlers or remote executable code.
    $('*').each((_, element) => {
      for (const [attribute, value] of Object.entries(element.attribs || {})) {
        if (/^on/i.test(attribute) || /^(?:href|src|action|formaction)$/i.test(attribute) && /^\s*javascript:/i.test(value)) {
          throw new Error('Unsafe executable attribute in ' + name);
        }
      }
    });
    $('script[src]').each((_, element) => {
      const url = new URL($(element).attr('src'), this.config.url);
      if (url.origin !== new URL(this.config.url).origin) throw new Error('Unapproved remote script in ' + name);
    });
    $('meta[http-equiv="Content-Security-Policy"],meta[name="referrer"],meta[name="security-policy-version"]').remove();
    const head = $('head');
    const charset = head.children('meta[charset]').first();
    if (!charset.length) throw new Error('Missing HTML charset in ' + name);
    charset.after($('<meta http-equiv="Content-Security-Policy">').attr('content', policy(hashes, name === '2026/11/08/llm-inference-from-token-to-cluster/index.html', name === 'index.html')));
    head.append('<meta name="referrer" content="strict-origin-when-cross-origin">');
    head.append($('<meta name="security-policy-version">').attr('content', version));
    this.route.set(name, $.html());
    count++;
  }
  this.log.info(`[Security] CSP hashes, script guards and referrer policy applied to ${count} HTML pages.`);
}, 1000);

hexo.extend.filter.register('server_middleware', function (app) {
  app.use((req, res, next) => {
    const address = req.socket.remoteAddress;
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) {
      res.writeHead(403, {'Content-Type': 'text/plain; charset=utf-8'});
      return res.end('Local preview only.');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    next();
  });
}, 0);

function checkPublishFiles() {
  const forbidden = /^(?:\.git|\.github|\.env(?:\..*)?|\.DS_Store|_admin-config\.yml|_config(?:\.local)?\.ya?ml)$|\.bak|\.(?:pem|key)$/i;
  let htmlCount = 0;
  for (const root of [hexo.source_dir, hexo.public_dir]) {
    const visit = dir => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const file = path.join(dir, entry.name);
        if (forbidden.test(entry.name)) throw new Error('Refusing to publish a sensitive or backup file: ' + file);
        if (entry.isSymbolicLink()) throw new Error('Refusing to publish a symbolic link: ' + file);
        if (entry.isDirectory()) visit(file);
        else if (root === hexo.public_dir && entry.name.endsWith('.html')) {
          if (!fs.readFileSync(file, 'utf8').includes('name="security-policy-version" content="' + version + '"')) {
            throw new Error('Refusing to publish HTML without the current security policy: ' + file);
          }
          htmlCount++;
        }
      }
    };
    visit(root);
  }
  if (!htmlCount) throw new Error('Refusing to publish an empty website. Generate and check the site first.');
}

// Also applies when deploy is invoked without generating first.
hexo.on('deployBefore', checkPublishFiles);
