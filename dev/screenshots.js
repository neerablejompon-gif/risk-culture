#!/usr/bin/env node
/**
 * ถ่ายภาพหน้าจอทุกหน้าจาก dist/preview.html (ต้องมี playwright: npm i -D playwright)
 * และตรวจ: ไม่มี JS error, ไม่มี horizontal scroll ระดับหน้า ที่ 390px
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const url = 'file://' + path.join(root, 'dist/preview.html');
const out = path.join(root, 'docs/screenshots');
fs.mkdirSync(out, { recursive: true });

const shots = [
  ['dashboard', '?page=dashboard', 1440, 'staff@example.com'],
  ['activities', '?page=activities', 1440, 'staff@example.com'],
  ['report-staff', '?page=report&id=2570-2.2&period=6', 1440, 'staff@example.com'],
  ['report-review', '?page=report&id=2570-6.3&period=6', 1440, 'head@example.com'],
  ['inbox-head', '?page=inbox', 1440, 'head@example.com'],
  ['guidelines', '?page=guidelines', 1440, 'staff@example.com'],
  ['mobile-mytasks', '?page=mytasks', 390, 'staff@example.com'],
  ['mobile-dashboard', '?page=dashboard', 390, 'staff@example.com'],
  ['mobile-report', '?page=report&id=2570-4.2&period=6', 390, 'staff@example.com']
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  let problems = 0;
  for (const [name, q, w, user] of shots) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((u) => sessionStorage.setItem('rct-dev', JSON.stringify({ user: u })), user);
    await page.goto(url + q + '&nodev=1');
    await page.waitForFunction(() => document.getElementById('main').getAttribute('aria-busy') === 'false', null, { timeout: 10000 });
    await page.waitForTimeout(300);
    if (name === 'report-staff') { await page.click('text=ส่งให้หัวหน้ากลุ่มงานตรวจ', { force: true }); await page.waitForTimeout(200); }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
    const flag = errors.length || overflow > 0;
    if (flag) problems++;
    console.log(`${flag ? '✗' : '✓'} ${name}${errors.length ? ' errors: ' + errors.join(' | ') : ''}${overflow > 0 ? ' h-scroll ' + overflow + 'px' : ''}`);
    await page.close();
  }
  await browser.close();
  process.exit(problems ? 1 : 0);
})();
