#!/usr/bin/env node
/**
 * สร้าง dist/preview.html — เปิดในเบราว์เซอร์ได้ทันทีโดยไม่ต้อง deploy
 * รวม client/*.html (แทน include()) + server/*.gs + dev shim (backend จำลองในเบราว์เซอร์)
 * แถบเครื่องมือมุมล่างซ้าย: สลับผู้ใช้/บทบาท และวันที่ เพื่อทดสอบ workflow
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const inc = (name) => read(`src/${name}.html`).replace(/<\?!=\s*include\('([^']+)'\);?\s*\?>/g, (_, n) => inc(n));

const SERVER = ['Config', 'Status', 'Workflow', 'Validation', 'Seed', 'Auth', 'Audit', 'Dashboard', 'ReportService', 'Evidence', 'Export'];
const backend = SERVER.map((f) => read(`src/server/${f}.gs`)).join('\n;\n') + '\n' + read('dev/fixture.js') + '\n' + read('dev/shim.js');

const bridge = `
DEV.reset({ demo: true });
try { var s = JSON.parse(sessionStorage.getItem('rct-dev') || 'null'); if (s) { DEV.user = s.user; } } catch (e) {}
window.DEV_API = function (name) {
  return function () {
    var args = JSON.parse(JSON.stringify(Array.prototype.slice.call(arguments)));
    return new Promise(function (res, rej) {
      setTimeout(function () {
        try { res(JSON.parse(JSON.stringify(window[name].apply(null, args)))); } catch (e) { rej(e); }
      }, 150);
    });
  };
};`;

const toolbar = `
<div id="devbar" style="position:fixed;left:12px;bottom:12px;z-index:99;background:#0F2A1F;color:#fff;border-radius:12px;padding:10px 12px;font:13px system-ui,sans-serif;display:flex;gap:8px;align-items:center;flex-wrap:wrap;max-width:calc(100vw - 24px);box-shadow:0 8px 24px rgba(0,0,0,.25)">
  <strong>DEV</strong>
  <label>ผู้ใช้ <select id="dev-user" style="font:inherit"></select></label>
  <label>วันที่ <input id="dev-date" type="date" style="font:inherit"></label>
  <button id="dev-reset" type="button" style="font:inherit">รีเซ็ตข้อมูลตัวอย่าง</button>
  <button id="dev-hide" type="button" aria-label="ซ่อนแถบ DEV" style="font:inherit">×</button>
</div>
<script>
(function () {
  var sel = document.getElementById('dev-user'), date = document.getElementById('dev-date');
  DEV_FIXTURE.users.forEach(function (u) { var o = document.createElement('option'); o.value = u.email; o.textContent = u.display_name + ' · ' + u.role; sel.appendChild(o); });
  sel.value = DEV.user; date.value = DEV.today;
  var save = function () { try { sessionStorage.setItem('rct-dev', JSON.stringify({ user: DEV.user })); } catch (e) {} };
  sel.onchange = function () { DEV.user = sel.value; save(); App.reload(); };
  date.onchange = function () { DEV.today = date.value || null; DEV.cache = {}; App.reload(); };
  document.getElementById('dev-reset').onclick = function () { DEV.reset({ demo: true }); date.value = DEV.today; App.reload(); };
  document.getElementById('dev-hide').onclick = function () { document.getElementById('devbar').remove(); };
  if (/[?&]nodev=1/.test(location.search)) document.getElementById('devbar').remove();
})();
</script>`;

let html = inc('client/Index');
html = html.replace('<!--DEV_HOOK-->', () => `<script>\n${backend}\n${bridge}\n</script>`);
html = html.replace('</body>', () => toolbar + '\n</body>');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/preview.html'), html);
console.log('✓ dist/preview.html — เปิดไฟล์นี้ในเบราว์เซอร์ (ข้อมูลตัวอย่าง ณ 10 เม.ย. 2570)');
