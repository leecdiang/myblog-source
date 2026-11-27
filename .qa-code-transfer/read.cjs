'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const slug = 'code-training-and-reasoning';
const root = 'http://127.0.0.1:4000';
const path = '/2026/11/27/' + slug + '/';
const url = root + path;
const out = '../receipts';
const report = {url, runs: [], errors: []};
const validate = (condition, label) => assert.ok(condition, label);
function targetByHash() {
  return location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1))) !== null;
}
async function main() {
  const browser = await chromium.launch({headless: true});
  try {
    for (const width of [1440, 390]) {
      const height = width === 1440 ? 960 : 844;
      const context = await browser.newContext({viewport: {width, height}, locale: 'zh-CN',
        colorScheme: 'light', deviceScaleFactor: 1});
      const page = await context.newPage();
      page.on('pageerror', err => report.errors.push(String(err)));
      page.on('response', res => {
        if (res.url().startsWith(root) && res.status() >= 400)
          report.errors.push('HTTP ' + res.status() + ' ' + res.url());
      });
      page.on('console', msg => {
        if (msg.type() === 'error' && /Content Security Policy/i.test(msg.text()))
          report.errors.push(msg.text());
      });
      const response = await page.goto(url, {waitUntil:'networkidle'});
      validate(response.ok(), 'Article is served by Hexo');
      await page.evaluate(() => document.fonts.ready);
      await page.locator('[data-transfer-ready="true"]').first().waitFor();
      const title = await page.locator('h1.post-title').innerText();
      const body = page.locator('.post-body');
      const figures = body.locator('.v-figure,[data-transfer-widget]:not(.v-figure)');
      validate(await figures.count() >= 10, 'All numbered illustrations render');
      assert.equal(await body.locator('[data-transfer-ready="true"]').count(),3);
      for (const mode of ['light','dark']) {
        if (await page.locator('html').getAttribute('data-color') !== mode) {
          await page.locator('#color-mode').click();
          await page.waitForFunction(mode => document.documentElement.dataset.color === mode, mode);
        }
        await page.waitForTimeout(390);
        await page.evaluate(() => window.scrollTo({top: 0, behavior:'instant'}));
        await page.screenshot({path: out + '/' + width + '-' + mode + '-intro.jpg',type:'jpeg',quality:80});
        const geometry = await page.evaluate(() => ({
          viewport: window.innerWidth, page: document.documentElement.scrollWidth,
          formulas: document.querySelectorAll('mjx-container[data-tex]').length,
          brokenMath: document.querySelectorAll('mjx-merror').length,
          badAnchors: [...document.querySelectorAll('.post-body a[href^="#"],.toc-scroll a[href^="#"]')]
            .map(a => a.getAttribute('href')).filter(h => h.length>1 && !document.getElementById(decodeURIComponent(h.slice(1)))),
          clipped: [...document.querySelectorAll('.v-chart-viewport svg text')].flatMap(t => {
            const svg=t.ownerSVGElement; const box=t.getBoundingClientRect(); const view=svg.getBoundingClientRect();
            return box.left < view.left-2 || box.right > view.right+2 || box.top < view.top-2 || box.bottom>view.bottom+2 ? [t.textContent] : [];
          }),
          citations: document.querySelectorAll('.post-body a[href^="#ref-"]').length,
          toc: document.querySelectorAll('.toc-scroll a').length,
          staticFigures: document.querySelectorAll('.v-chart-viewport>svg').length
        }));
        validate(geometry.page <= width+1, 'No document-wide horizontal overflow at '+width);
        validate(geometry.formulas >= 1 && !geometry.brokenMath, 'Pre-rendered math without errors');
        assert.deepEqual(geometry.badAnchors,[],'All internal links have destinations');
        validate(geometry.citations >= 4 && geometry.toc >= 4, 'Citations and table of contents present');
        assert.deepEqual(geometry.clipped,[], 'SVG labels remain inside their viewBox');
        for (let i=0;i<await figures.count();i++) {
          const figure = figures.nth(i);
          await figure.scrollIntoViewIfNeeded();
          await figure.screenshot({path: out+'/'+width+'-'+mode+'-fig'+String(i+1).padStart(2,'0')+'.jpg',type:'jpeg',quality:78});
        }
        report.runs.push({width, height, mode, title, geometry, figures:await figures.count()});
      }
      await page.locator('#language-mode').click();
      validate((await page.locator('html').getAttribute('data-language'))==='en','English UI');
      assert.equal(await page.locator('h1.post-title').innerText(),title);
      assert.equal(await body.locator('[data-transfer-widget]>div[lang=en]').count(),3);
      await page.locator('#language-mode').click();
      if (width >=1100) {
        const wide = page.locator('.reading-width-toggle');
        await wide.click();
        validate(await page.locator('html').evaluate(el=>el.hasAttribute('data-reading-wide')),'Wide reading');
        await wide.click();
      }
      const toc = page.locator('.reading-toc details');
      if (!(await toc.getAttribute('open') !== null)) await toc.locator('summary').click();
      await toc.locator('.toc-scroll a').first().click();
      validate(await page.evaluate(targetByHash),'TOC navigation');
      await body.locator('a[href^="#ref-"]').first().click();
      validate(await page.evaluate(targetByHash),'Citation jump');
      const trace=page.locator('#trace-next-token');
      const trCounter=trace.locator('[data-counter]');
      for (const [i,digit] of [2,2,0].entries()) {
        assert.match(await trCounter.innerText(),new RegExp((i+1)+'\\s*/\\s*3'));
        await trace.locator('[data-answer="'+digit+'"]').click();
        if(i<2)await trace.locator('[data-action=nextEntry]').click();
      }
      await trace.locator('[data-action=reset]').click();
      assert.match(await trCounter.innerText(),/1\s*\/\s*3/);
      const sched=page.locator('#trace-schedule');
      await sched.locator('[data-action=next]').click();
      assert.deepEqual(await sched.locator('.tr-lanes>div').evaluateAll(l=>l.map(el=>el.querySelectorAll('.tr-done').length)),[1,4]);
      await sched.locator('[data-action=prev]').click();
      for(let i=0;i<4;i++) await sched.locator('[data-action=next]').click();
      assert.deepEqual(await sched.locator('.tr-lanes>div').evaluateAll(l=>l.map(el=>el.querySelectorAll('.tr-done').length)),[4,4]);
      await sched.locator('[data-action=reset]').click();
      await sched.locator('[data-action=play]').click();
      await sched.locator('[data-action=play]').click();
      const paused=await sched.locator('[data-counter]').innerText();
      await page.waitForTimeout(2300);
      assert.equal(await sched.locator('[data-counter]').innerText(),paused,'Pause holds the current tick');
      const grad=page.locator('#trace-gradients');
      for (const [angle,dot,loss] of [[0,'+1.000','−0.250'],[90,'0.000','0.000'],[180,'−1.000','+0.250'],[60,'+0.500','−0.125']]) {
        await grad.locator('[data-degrees="'+angle+'"]').click();
        assert.equal(await grad.locator('[data-dot]').innerText(),dot);
        assert.equal(await grad.locator('[data-delta]').innerText(),loss);
      }
      await grad.locator('#tr-angle').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await grad.locator('#tr-angle').inputValue(),'61');
      await page.emulateMedia({reducedMotion:'reduce'});
      validate(!(await sched.locator('[data-action=play]').isVisible()),'Reduced motion removes autoplay');
      await sched.locator('[data-action=next]').click();
      await page.goto(root+'/archives/',{waitUntil:'networkidle'});
      validate(await page.locator('a[href="'+path+'"]').count() > 0,'Article listed in archive');
      await page.goto(root+'/',{waitUntil:'networkidle'});
      validate(await page.locator('a[href="'+path+'"]').count() > 0,'Article linked from home');
      await context.close();
    }
    const nojs = await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844},locale:'zh-CN'});
    const page=await nojs.newPage();
    await page.goto(url);
    assert.equal(await page.locator('[data-fallback]:visible').count(),3,'Three explanatory fallbacks without JS');
    await page.locator('[data-fallback]').first().screenshot({path:out+'/no-js.jpg',type:'jpeg',quality:80});
    await nojs.close();
    assert.deepEqual(report.errors,[], 'No missing local resources, uncaught errors or CSP violations');
    console.log(JSON.stringify(report,null,2));
  } finally {
    fs.writeFileSync(out+'/browser.json',JSON.stringify(report,null,2));
    await browser.close();
  }
}
main().catch(err=>{console.error(err);process.exitCode=1;});