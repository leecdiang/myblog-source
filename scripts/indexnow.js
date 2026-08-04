/**
 * IndexNow URL submission for Hexo
 *
 * After hexo deploy, submits changed URLs to IndexNow API
 * (Bing, Yandex, etc.) for instant search engine indexing.
 *
 * Adapted from tutorial:
 *   https://wittzh.github.io/2026/01/25/tech_blog/personal_blog_12/
 *
 * Features:
 * - Config-driven via _config.yml indexnow section
 * - Reads all URLs from generated sitemap.xml
 * - URL caching: only submits changed URLs (add/remove)
 * - Auto-creates key file in public/ if missing from source/
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// ──────────────────────────────────────────────
//  Config
// ──────────────────────────────────────────────
function readConfig(hexo) {
  const config = hexo.config.indexnow;
  if (!config || !config.enable) return null;
  if (!config.key) {
    hexo.log.warn('[IndexNow] 配置错误: 缺少 key 字段');
    return null;
  }
  if (!config.keyLocation) {
    hexo.log.warn('[IndexNow] 配置错误: 缺少 keyLocation 字段');
    return null;
  }
  const siteUrl = hexo.config.url;
  if (!siteUrl) {
    hexo.log.warn('[IndexNow] 配置错误: 缺少站点 URL');
    return null;
  }
  return {
    key: config.key,
    keyLocation: config.keyLocation,
    host: new URL(siteUrl).hostname,
    siteUrl
  };
}

// ──────────────────────────────────────────────
//  Key file — ensure it exists in public/
// ──────────────────────────────────────────────
function ensureKeyFile(hexo, cfg) {
  const publicDir = hexo.public_dir;
  const keyFile = path.join(publicDir, cfg.key + '.txt');

  if (fs.existsSync(keyFile)) return;

  // Try source/ first
  const srcPath = path.join(hexo.source_dir, cfg.key + '.txt');
  if (fs.existsSync(srcPath)) {
    try {
      fs.cpSync(srcPath, keyFile);
      hexo.log.info('[IndexNow] Key file copied from source/');
      return;
    } catch (e) { /* fall through */ }
  }

  // Create directly
  try {
    fs.writeFileSync(keyFile, cfg.key, 'utf8');
    hexo.log.info('[IndexNow] Key file created in public/');
  } catch (e) {
    hexo.log.warn('[IndexNow] Failed to create key file: ' + e.message);
  }
}

// ──────────────────────────────────────────────
//  URL collection from sitemap
// ──────────────────────────────────────────────
function extractUrlsFromSitemap(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const regex = /<loc>(.*?)<\/loc>/g;
    const urls = [];
    let m;
    while ((m = regex.exec(content)) !== null) {
      urls.push(m[1]);
    }
    return urls;
  } catch (_) {
    return [];
  }
}

function collectUrls(hexo) {
  const publicDir = hexo.public_dir;
  const urls = new Set();

  // Try sitemap.xml (our single sitemap)
  const sitemapFile = path.join(publicDir, 'sitemap.xml');
  const sitemapUrls = extractUrlsFromSitemap(sitemapFile);
  sitemapUrls.forEach(u => urls.add(u));

  // Also add the sitemap itself so search engines know it
  urls.add(hexo.config.url + '/sitemap.xml');

  return Array.from(urls);
}

// ──────────────────────────────────────────────
//  URL caching
// ──────────────────────────────────────────────
function loadCache(cacheFile) {
  try {
    if (fs.existsSync(cacheFile)) {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }
  } catch (_) { /* ignore */ }
  return { urls: [] };
}

function saveCache(cacheFile, urls) {
  try {
    const dir = path.dirname(cacheFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify({
      urls,
      timestamp: new Date().toISOString()
    }, null, 2), 'utf8');
  } catch (_) { /* ignore */ }
}

function detectChanges(current, cached) {
  const cur = new Set(current);
  const old = new Set(cached);
  const changed = current.filter(u => !old.has(u))
    .concat(cached.filter(u => !cur.has(u)));
  return changed;
}

// ──────────────────────────────────────────────
//  Submit to IndexNow API
// ──────────────────────────────────────────────
function submitToIndexNow(cfg, urlList) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      host: cfg.host,
      key: cfg.key,
      keyLocation: cfg.keyLocation,
      urlList
    });

    const options = {
      hostname: 'api.indexnow.org',
      port: 443,
      path: '/IndexNow',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 202) {
          resolve({ success: true, statusCode: res.statusCode });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body || 'unknown'}`));
        }
      });
    });

    req.on('error', e => reject(new Error('Network: ' + e.message)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(payload);
    req.end();
  });
}

// ──────────────────────────────────────────────
//  Hook: deployAfter
// ──────────────────────────────────────────────
hexo.on('deployAfter', async function () {
  const log = this.log;

  try {
    log.info('[IndexNow] === 开始 IndexNow 提交 ===');

    const cfg = readConfig(this);
    if (!cfg) {
      log.info('[IndexNow] 未配置或未启用，跳过');
      return;
    }

    // Ensure key file exists in public/
    ensureKeyFile(this, cfg);

    // Collect current URLs
    const currentUrls = collectUrls(this);
    log.info('[IndexNow] 从 sitemap 读取到 %d 个 URL', currentUrls.length);

    if (currentUrls.length === 0) {
      log.warn('[IndexNow] 没有 URL 需要提交');
      return;
    }

    // Load cache and detect changes
    const cacheFile = path.join(this.base_dir, '.indexnow-cache.json');
    const cache = loadCache(cacheFile);
    const changed = detectChanges(currentUrls, cache.urls);

    if (changed.length === 0) {
      log.info('[IndexNow] ✓ 无 URL 变化，跳过提交');
      saveCache(cacheFile, currentUrls);
      return;
    }

    log.info('[IndexNow] 检测到 %d 个 URL 变化', changed.length);
    changed.forEach(u => log.info('[IndexNow]   %s', u));

    // Submit
    log.info('[IndexNow] 正在提交到 api.indexnow.org ...');
    const result = await submitToIndexNow(cfg, changed);
    log.info('[IndexNow] ✓ 提交成功! HTTP %d', result.statusCode);
    log.info('[IndexNow] 已通知搜索引擎索引 %d 个 URL', changed.length);

    // Update cache
    saveCache(cacheFile, currentUrls);
    log.info('[IndexNow] URL 缓存已更新');

  } catch (error) {
    log.warn('[IndexNow] 提交失败: ' + error.message);
    log.warn('[IndexNow] 提交失败不影响部署流程');
  }
});
