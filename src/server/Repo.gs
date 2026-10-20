/**
 * อ่าน/เขียนแท็บใน Google Sheet — ไม่มี business logic
 * ทุกค่าถูกเก็บเป็นข้อความ (number format '@') เพื่อไม่ให้ Sheets แปลง 001001001001 เป็นตัวเลข
 * (ใน dev/preview ไฟล์นี้ถูกแทนด้วย dev/shim.js ที่มีฟังก์ชันชื่อเดียวกัน)
 */
let READ_CACHE_ = {};

function getSs_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  const sh = getSs_().getSheetByName(name);
  if (!sh) fail_('SETUP', 'ไม่พบแท็บ ' + name + ' — ให้ผู้ดูแลรัน setup() ก่อน');
  return sh;
}

function readTable_(name) {
  if (!READ_CACHE_[name]) {
    const vals = sheet_(name).getDataRange().getValues();
    const head = vals[0].map(String);
    const rows = [];
    for (let i = 1; i < vals.length; i++) {
      const v = vals[i];
      if (v.every(function (x) { return x === ''; })) continue;
      const o = { _row: i + 1 };
      head.forEach(function (h, j) {
        const x = v[j];
        o[h] = x instanceof Date ? Utilities.formatDate(x, TZ, 'yyyy-MM-dd') : (x === '' || x == null ? '' : String(x));
      });
      rows.push(o);
    }
    READ_CACHE_[name] = rows;
  }
  return READ_CACHE_[name].map(function (r) { return Object.assign({}, r); });
}

/** อ่านแท็บต้นฉบับแบบ raw (อ่านอย่างเดียว) */
function readRawSheet_(name) {
  const sh = getSs_().getSheetByName(name);
  if (!sh) fail_('SETUP', 'ไม่พบแท็บต้นฉบับ "' + name + '"');
  return sh.getDataRange().getDisplayValues();
}

function rowValues_(name, obj) {
  return SCHEMA[name].map(function (h) { return obj[h] == null ? '' : String(obj[h]); });
}

function insertRow_(name, obj) {
  const sh = sheet_(name);
  const r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, SCHEMA[name].length).setNumberFormat('@').setValues([rowValues_(name, obj)]);
  delete READ_CACHE_[name];
  return r;
}

function updateRow_(name, obj) {
  if (!obj._row) fail_('INTERNAL', 'updateRow_ ต้องมี _row');
  sheet_(name).getRange(obj._row, 1, 1, SCHEMA[name].length).setNumberFormat('@').setValues([rowValues_(name, obj)]);
  delete READ_CACHE_[name];
}

/** สร้างแท็บใหม่ถ้ายังไม่มี และตรวจว่า header ตรง schema (ไม่แตะแท็บต้นฉบับ) */
function ensureTable_(name) {
  if (name === SOURCE_TABS.PLAN || name === SOURCE_TABS.GUIDE) fail_('SETUP', 'ห้ามแก้ไขแท็บต้นฉบับ');
  const ss = getSs_();
  const head = SCHEMA[name];
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const width = Math.max(sh.getLastColumn(), 1);
  const cur = sh.getRange(1, 1, 1, width).getValues()[0].map(String);
  if (cur.join('') === '') {
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else if (head.some(function (h, i) { return cur[i] !== h; })) {
    fail_('SETUP', 'header ของแท็บ ' + name + ' ไม่ตรงกับ schema ใน Config.gs');
  }
}
