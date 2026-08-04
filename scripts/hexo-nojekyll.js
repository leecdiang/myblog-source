/**
 * Ensure .nojekyll exists in public/ after generate.
 * GitHub Pages needs this to serve Hexo-generated files correctly.
 * Without it, Google Search Console often reports "couldn't fetch" for sitemaps.
 */
'use strict';

const fs = require('fs');
const path = require('path');

hexo.extend.filter.register('after_generate', function () {
  const publicDir = this.public_dir;
  const nojekyllPath = path.join(publicDir, '.nojekyll');
  
  if (!fs.existsSync(nojekyllPath)) {
    try {
      fs.writeFileSync(nojekyllPath, '', 'utf8');
      this.log.info('[nojekyll] ✓ .nojekyll created');
    } catch (e) {
      this.log.warn('[nojekyll] Failed to create: ' + e.message);
    }
  }
});
