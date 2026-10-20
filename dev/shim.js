/* eslint-disable */
/**
 * จำลองบริการของ Apps Script + ฐานข้อมูลในหน่วยความจำ
 * ใช้กับ: tests/run.js (Node vm) และ dist/preview.html (เบราว์เซอร์)
 * โหลดหลังไฟล์ server/*.gs (ยกเว้น Repo.gs) — ฟังก์ชันชื่อเดียวกันในไฟล์นี้จะทับของจริง
 */
var DEV = { today: null, user: 'staff@example.com', store: {}, cache: {}, props: { EVIDENCE_FOLDER_ID: 'dev-folder' }, seq: 1 };

function nowIso_() {
  var t = new Date(Date.now() + 7 * 3600e3).toISOString().slice(11, 19);
  var d = DEV.today || new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  return d + 'T' + t + '+07:00';
}

// ---------- in-memory Repo (แทน Repo.gs) ----------
function readTable_(name) {
  return (DEV.store[name] || []).map(function (r, i) { return Object.assign({}, r, { _row: i + 2 }); });
}
function readRawSheet_(name) { return DEV_FIXTURE.raw[name] || []; }
function devRow_(name, obj) {
  var o = {};
  SCHEMA[name].forEach(function (h) { o[h] = obj[h] == null ? '' : String(obj[h]); });
  return o;
}
function insertRow_(name, obj) { (DEV.store[name] = DEV.store[name] || []).push(devRow_(name, obj)); return DEV.store[name].length + 1; }
function updateRow_(name, obj) { DEV.store[name][obj._row - 2] = devRow_(name, obj); }
function ensureTable_(name) { DEV.store[name] = DEV.store[name] || []; }

// ---------- Apps Script services ----------
var Session = {
  getActiveUser: function () { return { getEmail: function () { return DEV.user; } }; },
  getEffectiveUser: function () { return { getEmail: function () { return DEV.user; } }; }
};
var LockService = { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } };
var CacheService = {
  getScriptCache: function () {
    return {
      get: function (k) { return DEV.cache[k] || null; },
      put: function (k, v) { DEV.cache[k] = v; },
      remove: function (k) { delete DEV.cache[k]; }
    };
  }
};
var PropertiesService = { getScriptProperties: function () { return { getProperty: function (k) { return DEV.props[k] || null; } }; } };
var Utilities = {
  base64Decode: function (s) { var b = atob(s); var out = []; for (var i = 0; i < b.length; i++) out.push(b.charCodeAt(i)); return out; },
  newBlob: function (bytes, mime, name) { return { bytes: bytes, mime: mime, name: name }; },
  getUuid: function () { return 'dev-' + (DEV.seq++); },
  formatDate: function (d) { return new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10); }
};
var DriveApp = {
  getFolderById: function () {
    return { createFile: function (blob) { var id = 'f' + (DEV.seq++); return { getId: function () { return id; }, getUrl: function () { return 'https://drive.google.com/file/d/' + id; } }; } };
  }
};
var SpreadsheetApp = {
  create: function () {
    var range = { setValues: function (v) { DEV.lastExport = v; return range; } };
    var sheet = { getRange: function () { return range; }, setFrozenRows: function () {} };
    return { getActiveSheet: function () { return sheet; }, getUrl: function () { return '#dev-export'; } };
  }
};
var Logger = { log: function (m) { if (typeof console !== 'undefined') console.log(m); } };

// ---------- seed + demo data ----------
DEV.reset = function (opts) {
  opts = opts || {};
  DEV.store = {}; DEV.cache = {};
  DEV.today = opts.today || null;
  Object.keys(SCHEMA).forEach(ensureTable_);
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) { insertRow_(TABS.SET, { key: k, value: DEFAULT_SETTINGS[k] }); });
  DEV_FIXTURE.users.forEach(function (u) { insertRow_(TABS.USR, u); });
  mapSourceRows_(DEV_FIXTURE.raw['แผน/ผล'], 2570).forEach(function (a) {
    a.owner_emails = 'staff@example.com';
    insertRow_(TABS.ACT, a);
  });
  if (opts.demo) DEV.demo();
};

/** สร้างรายงานตัวอย่าง ณ 10 เม.ย. 2570 ให้เห็นครบทุกสถานะ */
DEV.demo = function () {
  DEV.today = '2027-04-10';
  var PCT = { '1.1': 78, '1.2': 86, '2.1': 74, '4.1': 100, '4.2': 82, '4.3': 92, '5.3': 78, '6.1': 100, '6.2': 100, '6.3': 55 };
  var LATE_SUBMIT = { '4.3-3': 1, '1.1-4': 1, '3.2-5': 1 };
  var addDays = function (ymd, n) { return new Date(Date.parse(ymd + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10); };
  readTable_(TABS.ACT).forEach(function (a) {
    var planned = plannedPeriods(a.plan_months);
    planned.forEach(function (p, k) {
      if (p > 6) return;
      var key = a.no + '-' + p;
      var due = dueDateOf(2570, p, 5);
      var sub = addDays(due, LATE_SUBMIT[key] ? 3 : -2) + 'T09:15:00+07:00';
      var val = a.unit === 'ร้อยละ' ? PCT[a.no] : Math.round(Number(a.target_value) * (k + 1) / planned.length);
      var r = {
        report_id: a.activity_id + '-' + pad2_(p), activity_id: a.activity_id, period_index: p, actual_value: val, progress_status: 'ON_PLAN',
        summary: 'ดำเนินการตามแผนรอบ ' + MONTHS_TH[p - 1] + ' เรียบร้อย', issues: '', fix_plan: '', eta_date: '', workflow_state: 'APPROVED',
        reporter_email: 'staff@example.com', submitted_at: sub, reviewer_email: 'head@example.com', reviewed_at: addDays(due, 1) + 'T10:00:00+07:00',
        review_comment: '', approver_email: 'director@example.com', approved_at: addDays(due, 3) + 'T14:00:00+07:00', approve_comment: '',
        return_comment: '', version: 4, updated_at: sub, updated_by: 'staff@example.com'
      };
      if (a.no === '2.2' && p === 6) return; // ค้างส่ง → ล่าช้า
      if (a.no === '4.2' && p === 6) Object.assign(r, { workflow_state: 'RETURNED', approved_at: '', approver_email: '', version: 3, return_comment: 'กรุณาแนบรายชื่อ Risk Owner ที่ยังไม่ส่งรายงาน และระบุแผนติดตาม' });
      if (a.no === '6.3' && p === 6) Object.assign(r, { workflow_state: 'SUBMITTED', progress_status: 'DELAYED', issues: 'ระบบดิจิทัลของ ฝทส. ยังไม่พร้อมสำหรับ 3 กระบวนการ', eta_date: '2027-06-30', reviewer_email: '', reviewed_at: '', approver_email: '', approved_at: '', version: 2 });
      if (a.no === '3.2' && p === 6) Object.assign(r, { workflow_state: 'SUBMITTED', reviewer_email: '', reviewed_at: '', approver_email: '', approved_at: '', version: 2 });
      if (a.no === '1.3' && p === 6) Object.assign(r, { workflow_state: 'REVIEWED', approver_email: '', approved_at: '', version: 3, review_comment: 'ครบถ้วน' });
      if (a.no === '2.2' && p === 3) r.approve_comment = 'เพิ่มสรุปประเด็นที่คณะกรรมการให้ข้อสังเกตในรอบถัดไป';
      insertRow_(TABS.REP, r);
    });
  });
};
