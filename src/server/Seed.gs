/**
 * ติดตั้งครั้งแรก + seed กิจกรรมจากแท็บต้นฉบับ "แผน/ผล" (อ่านอย่างเดียว)
 * รันจาก Apps Script editor: setup() → seedActivitiesFromSheet()
 * ทั้งสองฟังก์ชัน idempotent — รันซ้ำได้
 */

function setup() {
  Object.keys(SCHEMA).forEach(ensureTable_);
  const have = {};
  readTable_(TABS.SET).forEach(function (r) { have[r.key] = true; });
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
    if (!have[k]) insertRow_(TABS.SET, { key: k, value: DEFAULT_SETTINGS[k] });
  });
  const me = String(Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail()).toLowerCase();
  if (!readTable_(TABS.USR).length && me) {
    insertRow_(TABS.USR, { email: me, display_name: me.split('@')[0], role: 'ADMIN', unit: 'กบค.', active: 'true' });
    writeAudit_(me, 'SETUP', 'user', me, null, { role: 'ADMIN' });
  }
  Logger.log('setup เสร็จ — แท็บ: ' + Object.keys(SCHEMA).join(', '));
}

function seedActivitiesFromSheet() {
  const s = getSettings_();
  const mapped = mapSourceRows_(readRawSheet_(SOURCE_TABS.PLAN), s.fy);
  const res = withLock_(function () { return upsertActivities_(mapped, 'seed'); });
  Logger.log('seed ปี ' + s.fy + ': เพิ่ม ' + res.added + ', อัปเดต ' + res.updated + ' จาก ' + mapped.length + ' กิจกรรม');
  return res;
}

/** แปลงแถวจากแท็บ "แผน/ผล" → cfg_Activities (อ่านคอลัมน์ตามชื่อ header ไม่ใช่ตำแหน่ง) */
function mapSourceRows_(values, fy) {
  const hi = values.findIndex(function (r) { return String(r[0]).trim() === 'ลำดับ'; });
  if (hi < 0) fail_('SETUP', 'ไม่พบแถวหัวตารางที่ขึ้นต้นด้วย "ลำดับ" ในแท็บ ' + SOURCE_TABS.PLAN);
  const H = values[hi].map(function (x) { return String(x).trim(); });
  const col = function (prefix) {
    const i = H.findIndex(function (h) { return h.indexOf(prefix) === 0; });
    if (i < 0) fail_('SETUP', 'ไม่พบคอลัมน์ "' + prefix + '" ในแท็บ ' + SOURCE_TABS.PLAN);
    return i;
  };
  const c = {
    no: col('ลำดับ'), value: col('ค่านิยมองค์กร'), dim: col('มิติ Risk Culture'), name: col('โครงการ/กิจกรรม'),
    tg: col('กลุ่มเป้าหมาย'), kpi: col('ตัวชี้วัด'), target: col('ค่าเป้าหมาย'), unit: col('หน่วยนับ'),
    owner: col('ผู้รับผิดชอบ'), outcome: col('ผลลัพธ์เชิงพฤติกรรม'), doT: col('พฤติกรรมที่พึงประสงค์'),
    dontT: col('พฤติกรรมที่ไม่พึงประสงค์')
  };
  const months = MONTHS_TH.map(col);
  const txt = function (r, i) { return String(r[i] == null ? '' : r[i]).replace(/[ \t]+/g, ' ').trim(); };
  const out = [];
  for (let i = hi + 1; i < values.length; i++) {
    const r = values[i];
    const no = txt(r, c.no);
    if (!/^\d+\.\d+$/.test(no)) continue;
    const v = splitCode_(txt(r, c.value));
    const d = splitCode_(txt(r, c.dim));
    const unit = txt(r, c.unit);
    out.push({
      activity_id: fy + '-' + no, fiscal_year: fy, no: no, group_no: Number(no.split('.')[0]),
      value_code: v[0], value_name: v[1], dimension: d[1], name: txt(r, c.name), target_group: txt(r, c.tg),
      kpi: txt(r, c.kpi), target_value: Number(txt(r, c.target).replace(/,/g, '')) || 0, unit: unit,
      measure_type: unit === 'ร้อยละ' ? 'PERCENT_LATEST' : 'COUNT_CUMULATIVE', formula_note: '',
      plan_months: months.map(function (m) { return txt(r, m) ? '1' : '0'; }).join(''),
      owner_unit: txt(r, c.owner), owner_emails: '', expected_outcome: txt(r, c.outcome),
      do_text: String(r[c.doT] || '').trim(), dont_text: String(r[c.dontT] || '').trim(), active: 'true'
    });
  }
  return out;
}

/** "U - Unity" → ['U', 'Unity'] */
function splitCode_(s) {
  const m = String(s).match(/^\s*([A-Z])\s*[-–]\s*(.+?)\s*$/);
  return m ? [m[1], m[2]] : ['', String(s).trim()];
}

/** อัปเดตจากต้นฉบับ แต่คงค่าที่ผู้ดูแลตั้งเอง (owner_emails, measure_type, formula_note, active) */
function upsertActivities_(mapped, actor) {
  const existing = {};
  readTable_(TABS.ACT).forEach(function (a) { existing[a.activity_id] = a; });
  let added = 0;
  let updated = 0;
  mapped.forEach(function (m) {
    const cur = existing[m.activity_id];
    if (!cur) {
      insertRow_(TABS.ACT, m);
      writeAudit_(actor, 'SEED', 'activity', m.activity_id, null, m);
      added++;
      return;
    }
    const keep = { owner_emails: cur.owner_emails, measure_type: cur.measure_type || m.measure_type, formula_note: cur.formula_note, active: cur.active || 'true', _row: cur._row };
    const next = Object.assign({}, m, keep);
    const changed = SCHEMA[TABS.ACT].some(function (h) { return String(next[h]) !== String(cur[h]); });
    if (changed) {
      updateRow_(TABS.ACT, next);
      writeAudit_(actor, 'SEED_UPDATE', 'activity', m.activity_id, cur, next);
      updated++;
    }
  });
  return { added: added, updated: updated };
}
