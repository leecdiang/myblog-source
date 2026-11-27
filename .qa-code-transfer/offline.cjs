'use strict';
// Make a single offline copy of the tested article. This changes only the review artifact.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cheerio = require('cheerio');
const { chromium } = require('playwright');
const dir=path.resolve('public');
const home='https://leecdiang.com';
const route='/2026/11/27/code-training-and-reasoning/';
const input=fs.readFileSync(path.join(dir,route,'index.html'),'utf8');
const $=cheerio.load(input);
const mimes={'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.ico':'image/x-icon'};
const memo=new Map();
function inline(url,base=home+route) {
  if (!url||url.startsWith('data:')||url.startsWith('#'))return url;
  const src=new URL(url,base);
  if(src.origin!==home)return url;
  const file=path.join(dir,decodeURIComponent(src.pathname));
  if(!file.startsWith(dir+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return url;
  if(memo.has(src.href))return memo.get(src.href);
  let bytes=fs.readFileSync(file);
  if (src.pathname.endsWith('.css')) {
    const css=bytes.toString().replace(/url\((['"]?)(.*?)\1\)/g,(m,q,u)=>u.startsWith('data:')||u.startsWith('#')?m:'url("'+inline(u,src.href)+'")');
    bytes=Buffer.from(css);
  }
  const value='data:'+(mimes[path.extname(src.pathname)]||'application/octet-stream')+';base64,'+bytes.toString('base64');
  memo.set(src.href,value);return value;
}
$("link[rel='dns-prefetch'],link[rel='preconnect'],link[rel='prefetch'],link[rel='preload'],link[rel='alternate']").remove();
$('link[href]').each((_,el)=>{
  const e=$(el);
  if(/stylesheet|icon/.test(e.attr('rel')||''))e.attr('href',inline(e.attr('href')));
});
$('script[src],img[src],source[src]').each((_,el)=>$(el).attr('src',inline($(el).attr('src'))));
$('[srcset]').each((_,el)=>{const e=$(el);e.attr('srcset',e.attr('srcset').split(',').map(item=>{const [u,...rest]=item.trim().split(/\s+/);return [inline(u),...rest].join(' ');}).join(', '));});
$('a[href]').each((_,el)=>{const e=$(el), h=e.attr('href'); if (h&&!h.startsWith('#')&&!/^(https?:|mailto:|tel:)/.test(h)) e.attr('href',new URL(h,home+route).href);});
const inlineHashes=$('script:not([src])').get().map(e=>"'sha256-"+crypto.createHash('sha256').update($(e).html()||'').digest('base64')+"'");
$('meta[http-equiv="Content-Security-Policy"]').attr('content',[
  "default-src 'none'", "base-uri 'none'", "object-src 'none'", "script-src data: "+inlineHashes.join(' '),
  "style-src data: 'unsafe-inline'", "img-src data:", "font-src data:", "connect-src 'none'", "form-action 'none'"
].join('; '));
const dest=path.resolve('../receipts/offline-preview.html');
fs.writeFileSync(dest,$.html());
(async()=>{
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},locale:'zh-CN'});
    await page.goto(require('node:url').pathToFileURL(dest).href,{waitUntil:'networkidle'});
    await page.locator('[data-transfer-ready="true"]').first().waitFor();
    if(await page.locator('[data-transfer-ready="true"]').count()!==3)throw Error('The offline snapshot lost a widget');
    await page.locator('#trace-gradients [data-degrees="180"]').click();
    if(await page.locator('#trace-gradients [data-delta]').innerText()!=='+0.250')throw Error('Offline gradient widget failed');
    if(!await page.locator('html').evaluate(el=>parseFloat(getComputedStyle(el.querySelector('.post-body')).lineHeight)>20))throw Error('Offline site CSS was not applied');
    console.log('Opened offline artifact from disk, confirmed article CSS and all three interactive panels');
  } finally {await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});