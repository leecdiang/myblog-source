/**
 * Hexo auto-watermark filter
 *
 * Intercepts image routes during hexo generate, compresses images,
 * and adds a Diang logo watermark to each image.
 *
 * Place this file in scripts/ and it will run automatically.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const sharp = require('sharp');

// ──────────────────────────────────────────────
//  Configuration
// ──────────────────────────────────────────────

const LOGO_SVG_PATH = path.join(__dirname, '..', 'diang-logo.svg');

const WM_CONFIG = {
  position: 'southeast',
  marginRatio: 0.025,
  logoMaxWidthRatio: 0.15,
};

const COMPRESS_CONFIG = {
  // Resize so the longest edge is at most this many pixels (null = no resize)
  maxDimension: 1600,
  // JPEG quality (1-100)
  jpegQuality: 82,
  // PNG compression level (0-9, 9 = smallest file)
  pngCompressionLevel: 9,
  // WebP quality (1-100)
  webpQuality: 82,
};

const MIN_DIMENSION = 300;
const MIN_FILE_SIZE = 30 * 1024;
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

// ──────────────────────────────────────────────
//  Logo cache
// ──────────────────────────────────────────────

let _logoSvg = null;

async function ensureLogo() {
  if (_logoSvg) return;
  if (!fs.existsSync(LOGO_SVG_PATH)) {
    throw new Error('Logo SVG not found: ' + LOGO_SVG_PATH);
  }
  _logoSvg = await fsp.readFile(LOGO_SVG_PATH, 'utf-8');
}

// ──────────────────────────────────────────────
//  Process image: resize + watermark + compress
// ──────────────────────────────────────────────

async function processImage(imgBuffer, outputFormat) {
  const meta = await sharp(imgBuffer).metadata();
  const { width: imgW, height: imgH, format } = meta;

  if (imgW < MIN_DIMENSION || imgH < MIN_DIMENSION) return imgBuffer;

  // 1. Resize if too large
  let pipeline = sharp(imgBuffer);
  if (COMPRESS_CONFIG.maxDimension) {
    const longest = Math.max(imgW, imgH);
    if (longest > COMPRESS_CONFIG.maxDimension) {
      pipeline = pipeline.resize({
        width: imgW >= imgH ? COMPRESS_CONFIG.maxDimension : undefined,
        height: imgW < imgH ? COMPRESS_CONFIG.maxDimension : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
  }
  const resized = await pipeline.toBuffer();
  const resizedMeta = await sharp(resized).metadata();
  const rW = resizedMeta.width;
  const rH = resizedMeta.height;

  // 2. Render SVG logo at target size (vector → no quality loss)
  const logoW = Math.round(rW * WM_CONFIG.logoMaxWidthRatio);
  const logoPng = await sharp(Buffer.from(_logoSvg))
    .resize(logoW)
    .png()
    .toBuffer();
  const logoMeta = await sharp(logoPng).metadata();
  const logoH = logoMeta.height;

  const margin = Math.round(rW * WM_CONFIG.marginRatio);
  const left = rW - logoW - margin;
  const top = rH - logoH - margin;

  // 3. Determine final output format
  const finalFormat = outputFormat || format;
  const outputOpts = {};
  if (finalFormat === 'jpeg' || finalFormat === 'jpg') {
    outputOpts.jpeg = { quality: COMPRESS_CONFIG.jpegQuality, mozjpeg: true };
  } else if (finalFormat === 'png') {
    outputOpts.png = { compressionLevel: COMPRESS_CONFIG.pngCompressionLevel };
  } else if (finalFormat === 'webp') {
    outputOpts.webp = { quality: COMPRESS_CONFIG.webpQuality };
  }

  return sharp(resized)
    .composite([{ input: logoPng, top, left }])
    .toFormat(finalFormat, outputOpts)
    .toBuffer();
}

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────

async function readRouteData(data) {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === 'function') {
    const result = await data();
    return readRouteData(result);
  }
  if (data && typeof data.pipe === 'function') {
    const chunks = [];
    for await (const c of data) {
      chunks.push(c);
    }
    return Buffer.concat(chunks);
  }
  if (data != null) {
    return Buffer.from(data);
  }
  return null;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a PNG image is photo-like (no transparency) and should be converted to JPEG.
 *
 * Note: use meta.hasAlpha / meta.channels, NOT meta.alpha — sharp's metadata()
 * does not reliably populate `alpha` for RGBA PNGs (undefined), which previously
 * caused transparent screenshots (rounded corners) to be converted to JPEG with
 * black baked into the transparent areas.
 */
async function shouldConvertPngToJpeg(meta) {
  // Only for PNGs
  if (meta.format !== 'png') return false;
  // Skip small images (icons, thumbnails)
  if (meta.width < MIN_DIMENSION || meta.height < MIN_DIMENSION) return false;
  // Skip only PNGs that actually contain transparent pixels: converting
  // RGBA→JPEG turns those pixels black (rounded-corner screenshots).
  // hasAlpha alone is not enough — many screenshots have an opaque alpha
  // channel and convert to JPEG just fine.
  return !(await hasRealTransparency(meta));
}

/**
 * True when the PNG has an alpha channel with at least one pixel < 255
 * (i.e. real transparency). Uses sharp stats() — metadata flags like
 * `alpha`/`hasAlpha` are unreliable for detecting actual transparency.
 */
async function hasRealTransparency(meta) {
  const hasAlphaChannel = meta.hasAlpha === true || meta.alpha === true ||
    (typeof meta.channels === 'number' && meta.channels >= 4);
  if (!hasAlphaChannel) return false;
  try {
    const stats = await require('sharp')(meta.buf).stats();
    const alphaChannel = stats.channels[3];
    return !alphaChannel || alphaChannel.min < 255;
  } catch (e) {
    // If we cannot inspect the alpha channel, assume transparency to be safe.
    return true;
  }
}

/**
 * Update all HTML routes to replace oldImgName with newImgName.
 */
async function updateHtmlReferences(route, routes, oldName, newName) {
  // Try matching raw filename and URL-encoded filename (for non-ASCII names)
  const candidates = [
    { re: new RegExp(escapeRegex(oldName), 'g'), replacement: newName },
    { re: new RegExp(escapeRegex(encodeURI(oldName)), 'g'), replacement: encodeURI(newName) },
  ];
  const htmlRoutes = routes.filter(r => r.endsWith('.html'));
  let updatedCount = 0;

  for (const hr of htmlRoutes) {
    const raw = route.get(hr);
    if (!raw) continue;
    const htmlBuf = await readRouteData(raw);
    if (!htmlBuf) continue;
    let htmlStr = htmlBuf.toString('utf-8');
    let changed = false;

    for (const { re, replacement } of candidates) {
      re.lastIndex = 0;
      if (!re.test(htmlStr)) continue;
      re.lastIndex = 0;
      const updated = htmlStr.replace(re, replacement);
      if (updated !== htmlStr) {
        htmlStr = updated;
        changed = true;
      }
    }

    if (changed) {
      route.set(hr, Buffer.from(htmlStr));
      updatedCount++;
    }
  }

  return updatedCount;
}

// ──────────────────────────────────────────────
//  Hexo auto-watermark filter
// ──────────────────────────────────────────────

hexo.extend.filter.register('after_generate', async function () {
  try {
    await ensureLogo();
  } catch (err) {
    const log = this.log || hexo.log || { warn: console.warn, info: console.log };
    log.warn('[Watermark] Logo init failed: ' + err.message);
    return;
  }

  const route = this.route || hexo.route;
  const routes = route.list().filter(r => {
    const ext = path.extname(r).toLowerCase();
    return IMAGE_EXTS.has(ext) && !r.startsWith('images/');
  });

  let count = 0;
  let pngToJpegCount = 0;

  for (const r of routes) {
    try {
      const raw = route.get(r);
      if (!raw) continue;

      const buf = await readRouteData(raw);
      if (!buf || buf.length < MIN_FILE_SIZE) continue;

      const meta = await sharp(buf).metadata();

      // Check if photo-like PNG should be converted to JPEG
      if (await shouldConvertPngToJpeg(Object.assign({}, meta, { buf }))) {
        // Flatten (remove alpha by compositing onto white) and process as JPEG
        const flattened = meta.alpha ? await sharp(buf).flatten({ background: { r: 255, g: 255, b: 255 } }).toBuffer() : buf;
        const processed = await processImage(flattened, 'jpeg');
        if (processed === buf) continue;

        const jpegRoute = r.replace(/\.png$/i, '.jpg');
        route.set(jpegRoute, processed);
        route.remove(r);

        // Update HTML references to point to new .jpg path
        const pngName = path.basename(r);
        const jpgName = path.basename(jpegRoute);
        const htmlUpdated = await updateHtmlReferences(route, route.list(), pngName, jpgName);

        hexo.log.info('[Watermark] ✓ ' + r + ' \u2192 ' + jpegRoute + ' (PNG\u2192JPEG, ' + htmlUpdated + ' HTML refs updated)');
        pngToJpegCount++;
        continue;
      }

      const processed = await processImage(buf);
      if (processed === buf) continue;

      route.set(r, processed);
      count++;
    } catch (err) {
      hexo.log.debug('[Watermark] Skip ' + r + ': ' + err.message);
    }
  }

  hexo.log.info('[Watermark] \u2713 Processed ' + count + ' image' + (count !== 1 ? 's' : ''));
  if (pngToJpegCount > 0) {
    hexo.log.info('[Watermark] \u2713 ' + pngToJpegCount + ' PNG\u2192JPEG conversion' + (pngToJpegCount !== 1 ? 's' : ''));
  }
});
