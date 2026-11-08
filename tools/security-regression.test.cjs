'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const merge = require('../vendor/deepmerge-safe');

test('poison keys cannot change returned prototypes from either merge input', () => {
  const poison = JSON.parse('{"__proto__":{"admin":true},"constructor":{"prototype":{"admin":true}},"nested":{"__proto__":{"admin":true}}}');
  const nullPrototype = Object.create(null);
  nullPrototype.__proto__ = {admin: true};
  for (const result of [merge(poison, {}), merge({}, poison), merge({}, nullPrototype), merge.all([poison, nullPrototype])]) {
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
    assert.equal(result.admin, undefined);
    assert.equal(Object.hasOwn(result, '__proto__'), false);
    assert.equal(Object.hasOwn(result, 'constructor'), false);
    if (result.nested) assert.equal(result.nested.admin, undefined);
  }
  assert.equal({}.admin, undefined);
});

test('normal merges retain array options, symbols, dates and cloning', () => {
  const symbol = Symbol('metadata'), date = new Date('2026-11-07T00:00:00Z');
  const source = {nested: {right: 2}, list: [{b: 2}], date, [symbol]: 'ok'};
  const result = merge({nested: {left: 1}, list: [{a: 1}]}, source);
  assert.deepEqual(result.nested, {left: 1, right: 2});
  assert.deepEqual(result.list, [{a: 1}, {b: 2}]);
  assert.notEqual(result.nested, source.nested);
  assert.equal(result.date, date);
  assert.equal(result[symbol], 'ok');
  assert.deepEqual(merge({list: [1]}, {list: [2]}, {arrayMerge: (_, incoming) => incoming}), {list: [2]});
  const {deepMerge} = require('hexo-util');
  assert.deepEqual(deepMerge({list: [{a: 1}]}, {list: [{b: 2}]}), {list: [{a: 1, b: 2}]});
  assert.equal(deepMerge(poisonTarget(), {}).admin, undefined);
});
function poisonTarget() { return JSON.parse('{"__proto__":{"admin":true}}'); }

test('updated Markdown parser retains headings, permalinks, marks and HTML', () => {
  const Renderer = require('hexo-renderer-markdown-it/lib/renderer');
  const renderer = new Renderer({
    base_dir: path.resolve(__dirname, '..'), execFilterSync() {}, log: {warn() {}},
    config: {markdown: {preset: 'default', render: {html: true, linkify: true}, plugins: ['markdown-it-mark'],
      anchors: {level: 1, permalink: true, permalinkClass: 'header-anchor', permalinkSymbol: '#', permalinkSide: 'left'}}}
  });
  const html = renderer.render({text: '## Heading\n\n==Marked== <strong>HTML</strong> https://example.com', path: 'probe.md'});
  assert.match(html, /<h2 id="[^"]+">/);
  assert.match(html, /class="header-anchor"/);
  assert.match(html, /<mark>Marked<\/mark>/);
  assert.match(html, /<strong>HTML<\/strong>/);
  assert.match(html, /href="https:\/\/example.com"/);
});

function fixture(t, html) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-security-test-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  fs.mkdirSync(path.join(root, 'themes/next/layout'), {recursive: true});
  fs.writeFileSync(path.join(root, 'themes/next/layout/_layout-studio.njk'), '<script>window.trusted=true;</script>');
  const filters = {}, events = {}, routes = new Map([['index.html', html]]);
  const hexo = {
    base_dir: root, source_dir: path.join(root, 'source'), public_dir: path.join(root, 'public'),
    config: {url: 'https://leecdiang.com'}, log: {info() {}},
    extend: {helper: {get() {}}, filter: {register(name, fn) {filters[name] = fn;}}},
    route: {list: () => [...routes.keys()], get: name => require('node:stream').Readable.from([routes.get(name)]), set: (name, value) => routes.set(name, value)},
    on: (name, fn) => {events[name] = fn;}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/site-security.js'), 'utf8'), {require, hexo, URL, Buffer});
  return {root, hexo, filters, events, routes};
}
const page = body => '<!doctype html><html><head><meta charset="UTF-8"><script>window.trusted=true;</script></head><body>' + body + '</body></html>';

test('build approves template scripts and inert JSON, but refuses injected executable code', async t => {
  const good = fixture(t, page('<script type="application/json">{"safe":true}</script>'));
  await good.filters.after_generate.call(good.hexo);
  assert.match(good.routes.get('index.html'), /Content-Security-Policy/);
  assert.match(good.routes.get('index.html'), /sha256-/);
  assert.doesNotMatch(good.routes.get('index.html'), /script-src[^;]*unsafe-inline/);
  for (const body of ['<script>window.injected=true;</script>', '<img src="x" onerror="alert(1)">', '<a href="javascript:alert(1)">x</a>', '<script src="https://example.invalid/a.js"></script>']) {
    const bad = fixture(t, page(body));
    await assert.rejects(bad.filters.after_generate.call(bad.hexo), /Unapproved|Unsafe/);
  }
});

test('preview rejects remote clients even with a forged forwarding header', t => {
  const f = fixture(t, page('')); let middleware;
  f.filters.server_middleware({use(fn) {middleware = fn;}});
  let next = false, status, ended = false;
  middleware({socket: {remoteAddress: '192.0.2.1'}, headers: {'x-forwarded-for': '127.0.0.1'}}, {writeHead(code) {status = code;}, end() {ended = true;}}, () => {next = true;});
  assert.equal(status, 403); assert.equal(ended, true); assert.equal(next, false);
  middleware({socket: {remoteAddress: '127.0.0.1'}}, {setHeader() {}}, () => {next = true;});
  assert.equal(next, true);
});

test('preview permits same-origin embedding only for the inference lab', t => {
  const f = fixture(t, page('')); let middleware;
  f.filters.server_middleware({use(fn) {middleware = fn;}});
  const lab = '/2026/11/08/llm-inference-from-token-to-cluster/interactive/inference-lab.html';
  for (const [url, expected] of [
    [lab, 'SAMEORIGIN'],
    [lab + '?tab=batch', 'SAMEORIGIN'],
    [lab + '?tab=memory', 'SAMEORIGIN'],
    ['/', 'DENY'],
    ['/2026/11/08/llm-inference-from-token-to-cluster/', 'DENY'],
    [lab + '.other', 'DENY']
  ]) {
    const headers = {}; let proceeded = false;
    middleware({url, socket: {remoteAddress: '127.0.0.1'}},
      {setHeader(name, value) {headers[name] = value;}}, () => {proceeded = true;});
    assert.equal(proceeded, true, url);
    assert.equal(headers['X-Frame-Options'], expected, url);
  }
});

test('visitor maps permit only the image endpoint on the homepage and keep remote scripts blocked', async t => {
  const f = fixture(t, page('<img src="https://mapmyvisitors.com/map.png?d=example">'));
  f.routes.set('archives/index.html', page(''));
  await f.filters.after_generate.call(f.hexo);
  const cheerio = require('cheerio');
  const policyFor = route => cheerio.load(f.routes.get(route))('meta[http-equiv="Content-Security-Policy"]').attr('content');
  assert.match(policyFor('index.html'), /img-src[^;]* https:\/\/mapmyvisitors\.com\/map\.png(?:;|$)/);
  assert.doesNotMatch(policyFor('index.html'), /script-src[^;]*mapmyvisitors/);
  assert.doesNotMatch(policyFor('archives/index.html'), /mapmyvisitors/);
  const remote = fixture(t, page('<script src="https://mapmyvisitors.com/map.js?d=example"></script>'));
  await assert.rejects(remote.filters.after_generate.call(remote.hexo), /Unapproved remote script/);
});

test('deployment stops before copying sensitive files or symbolic links', t => {
  const f = fixture(t, page(''));
  fs.mkdirSync(f.hexo.public_dir);
  fs.writeFileSync(path.join(f.hexo.public_dir, '.env'), 'TEST_ONLY=1');
  assert.throws(() => f.events.deployBefore(), /sensitive/);
  fs.unlinkSync(path.join(f.hexo.public_dir, '.env'));
  fs.symlinkSync(path.join(f.root, 'themes'), path.join(f.hexo.public_dir, 'unexpected-link'));
  assert.throws(() => f.events.deployBefore(), /symbolic link/);
});

test('deployment refuses stale or empty output and accepts generated policy markers', async t => {
  const f = fixture(t, page(''));
  fs.mkdirSync(f.hexo.public_dir);
  assert.throws(() => f.events.deployBefore(), /empty website/);
  const index = path.join(f.hexo.public_dir, 'index.html');
  fs.writeFileSync(index, page(''));
  assert.throws(() => f.events.deployBefore(), /without the current security policy/);
  await f.filters.after_generate.call(f.hexo);
  fs.writeFileSync(index, f.routes.get('index.html'));
  assert.doesNotThrow(() => f.events.deployBefore());
});
