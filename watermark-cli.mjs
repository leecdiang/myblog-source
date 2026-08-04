#!/usr/bin/env node
/**
 * Photography watermark tool for Hexo blog
 *
 * Usage:
 *   node scripts/watermark.mjs <image-path>        # Single image
 *   node scripts/watermark.mjs <directory>         # Batch all images in folder
 *
 * Configuration – edit CONFIG below to your liking.
 */

import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { readdir, stat, copyFile, unlink } from 'node:fs/promises';
import { join, extname, basename, dirname } from 'node:path';
import sharp from 'sharp';

// ════════════════════════════════════════════════════════════════
//  WATERMARK CONFIG – tweak these to match your brand
// ════════════════════════════════════════════════════════════════

const CONFIG = {
  // --- Image (logo) watermark ---
  // Set to null to use text watermark instead
  logoPath: null, // e.g. '/Users/lee/myblog/source/images/watermark-logo.png'

  // --- Text watermark (used when logoPath is null) ---
  text: '© Diang',
  textFontSize: 32,
  textFontFile: null,  // optional: path to .ttf/.otf font file
  textColor: 'rgba(255,255,255,0.50)',
  textBgColor: 'rgba(0,0,0,0.30)',
  textPadding: 12,

  // --- Position ---
  // 'southeast' | 'southwest' | 'northeast' | 'northwest' | 'center'
  position: 'southeast',
  margin: 20,           // px from edge

  // --- Image watermark ---
  logoOpacity: 0.6,
  logoMaxWidthRatio: 0.12,   // relative to image width

  // --- Output ---
  mode: 'overwrite',    // 'overwrite' | 'suffix'
  suffix: '-wm',        // suffix for 'suffix' mode

  extensions: ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.avif'],
};

// ════════════════════════════════════════════════════════════════
//  ENGINE
// ════════════════════════════════════════════════════════════════

const EXT_SET = new Set(CONFIG.extensions.map(e => e.toLowerCase()));

function isImage(file) {
  return EXT_SET.has(extname(file).toLowerCase());
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function loadLogo() {
  if (!CONFIG.logoPath) return null;
  if (!existsSync(CONFIG.logoPath)) {
    console.warn(`⚠ Logo not found: ${CONFIG.logoPath}, falling back to text`);
    return null;
  }
  return readFileSync(CONFIG.logoPath);
}

/**
 * Build an SVG text label buffer + positioning.
 */
function makeTextOverlay(imgW, imgH) {
  const { text, textFontSize, textColor, textBgColor, textPadding, position, margin } = CONFIG;

  const cw = textFontSize * 0.60;
  const tw = Math.ceil(text.length * cw + textPadding * 2);
  const th = Math.ceil(textFontSize * 1.4 + textPadding * 2);

  let x, y;
  switch (position) {
    case 'northwest':  x = margin;                          y = margin;                          break;
    case 'northeast':  x = imgW - tw - margin;              y = margin;                          break;
    case 'southwest':  x = margin;                          y = imgH - th - margin;              break;
    case 'center':     x = (imgW - tw) / 2;                 y = (imgH - th) / 2;                break;
    default:           x = imgW - tw - margin;               y = imgH - th - margin;              break;
  }

  const svg = `
    <svg width="${tw}" height="${th}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="${textPadding}" fill="${textBgColor}"/>
      <text x="${textPadding + 2}" y="${textPadding + textFontSize + 2}"
            font-family="${CONFIG.textFontFile ? `'${basename(CONFIG.textFontFile)}'` : 'sans-serif'}"
            font-size="${textFontSize}" fill="${textColor}"
            dominant-baseline="text-after-edge">${escapeXml(text)}</text>
    </svg>`;

  return { buf: Buffer.from(svg), left: Math.round(x), top: Math.round(y) };
}

/**
 * Apply watermark to a single image. Writes to outputPath.
 */
async function applyWatermark(srcPath, dstPath, logoBuf) {
  const meta = await sharp(srcPath).metadata();
  const { width: w, height: h } = meta;

  const layers = [];

  if (logoBuf) {
    const logoMax = Math.round(w * CONFIG.logoMaxWidthRatio);
    const lm = await sharp(logoBuf).metadata();
    const ar = lm.width / lm.height;
    const lw = Math.min(logoMax, lm.width);
    const lh = Math.round(lw / ar);
    const resized = await sharp(logoBuf)
      .resize(lw, lh, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    let lx, ly;
    switch (CONFIG.position) {
      case 'northwest': lx = CONFIG.margin; ly = CONFIG.margin; break;
      case 'northeast': lx = w - lw - CONFIG.margin; ly = CONFIG.margin; break;
      case 'southwest': lx = CONFIG.margin; ly = h - lh - CONFIG.margin; break;
      case 'center':    lx = (w - lw) / 2; ly = (h - lh) / 2; break;
      default:          lx = w - lw - CONFIG.margin; ly = h - lh - CONFIG.margin; break;
    }

    layers.push({ input: resized, top: Math.round(ly), left: Math.round(lx) });
  } else {
    const ov = makeTextOverlay(w, h);
    layers.push({ input: ov.buf, top: ov.top, left: ov.left });
  }

  await sharp(srcPath).composite(layers).toFile(dstPath);

  const s = await stat(dstPath);
  console.log(`  ✓ ${basename(srcPath)}  (${(s.size / 1024).toFixed(1)} KB)`);
}

/**
 * Handle a file or directory path.
 */
async function handlePath(input, logoBuf) {
  const s = await stat(input);
  const dir = dirname(input);

  if (s.isFile()) {
    if (!isImage(input)) {
      console.log(`  ⏭ Skipping non-image: ${basename(input)}`);
      return;
    }
    const ext = extname(input);
    const base = basename(input, ext);

    if (CONFIG.mode === 'suffix') {
      const out = join(dir, `${base}${CONFIG.suffix}${ext}`);
      await applyWatermark(input, out, logoBuf);
    } else {
      // overwrite: write to tmp then swap
      const tmp = join(dir, `.${base}${ext}.tmp`);
      await applyWatermark(input, tmp, logoBuf);
      await copyFile(tmp, input);
      await unlink(tmp);
    }
    return;
  }

  if (s.isDirectory()) {
    console.log(`\n📁 ${input}`);
    const files = (await readdir(input)).filter(f => isImage(f)).sort();
    if (files.length === 0) {
      console.log('  (no images)');
      return;
    }
    for (const f of files) {
      const fp = join(input, f);
      if ((await stat(fp)).isFile()) {
        await handlePath(fp, logoBuf);
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════════════

async function main() {
  const proc = globalThis.process;
  const args = proc.argv.slice(2);

  console.log('📷 Photo Watermark Tool\n');

  const logoBuf = await loadLogo();
  console.log(`Watermark: ${CONFIG.logoPath ? `logo (${basename(CONFIG.logoPath)})` : `text "${CONFIG.text}"`}`);
  console.log(`Position:  ${CONFIG.position}, mode: ${CONFIG.mode}\n`);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node scripts/watermark.mjs <image>');
    console.log('  node scripts/watermark.mjs <directory>');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/watermark.mjs source/_posts/my-photo/');
    console.log('  node scripts/watermark.mjs source/images/my-photo.jpg');
    return;
  }

  for (const arg of args) {
    if (!existsSync(arg)) {
      console.error(`❌ Not found: ${arg}`);
      continue;
    }
    await handlePath(arg, logoBuf);
  }

  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  globalThis.process.exit(1);
});
