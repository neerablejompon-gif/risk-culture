/**
 * ส่งออกรายงานผู้บริหาร → Google Sheet ใหม่ใน Drive ของผู้กด (สรุปรายกิจกรรม + ผลรายไตรมาส)
 * ใช้ model เดียวกับ Dashboard จึงตรงกันเสมอ
 */
const STATUS_TH = { DONE: 'เสร็จสิ้น', ON_TRACK: 'ตามแผน', LATE: 'ล่าช้า', BELOW_TARGET: 'ต่ำกว่าเป้า', NOT_DUE: 'ยังไม่ถึงกำหนด' };

function buildExportRows_(fy, today, dueDay) {
  const m = buildModel_(fy, today, dueDay);
  const head = ['ลำดับ', 'ค่านิยม', 'มิติ Risk Culture', 'กิจกรรม', 'ตัวชี้วัด', 'เป้าหมาย', 'หน่วย',
    'Q1 (ต.ค.–ธ.ค.)', 'Q2 (ม.ค.–มี.ค.)', 'Q3 (เม.ย.–มิ.ย.)', 'Q4 (ก.ค.–ก.ย.)', 'ผลล่าสุดที่อนุมัติ', 'ความคืบหน้า (%)', 'สถานะ', 'ผู้รับผิดชอบ'];
  const rows = m.items.map(function (i) {
    const q = [1, 2, 3, 4].map(function (k) {
      let v = '';
      for (let p = 1; p <= k * 3; p++) {
        const r = i._byP[p];
        if (r && r.workflow_state === 'APPROVED' && r.actual_value !== '') v = Number(r.actual_value);
      }
      return v;
    });
    return [i.no, i.value_code + ' – ' + i.value_name, i.dimension, i.name, i.kpi, i.target_value, i.unit]
      .concat(q, [i.value == null ? '' : i.value, Math.round(i.progress * 100), STATUS_TH[i.status], i.owner_unit]);
  });
  return [head].concat(rows);
}

function apiExportSummary(fy) {
  const u = currentUser_();
  const s = getSettings_();
  fy = Number(fy) || s.fy;
  const today = todayYmd_();
  const values = buildExportRows_(fy, today, s.dueDay);
  const ss = SpreadsheetApp.create('สรุปผลแผนวัฒนธรรมความเสี่ยง ปี ' + fy + ' ณ ' + today);
  const sh = ss.getActiveSheet();
  sh.getRange(1, 1, values.length, values[0].length).setValues(values);
  sh.setFrozenRows(1);
  writeAudit_(u.email, 'EXPORT', 'dashboard', String(fy), null, { url: ss.getUrl(), rows: values.length - 1 });
  return { url: ss.getUrl() };
}
