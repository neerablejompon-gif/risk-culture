/**
 * Pure functions: รอบรายงาน กำหนดส่ง ความคืบหน้า และสถานะกิจกรรม (SPEC 5.1–5.3)
 * วันที่ทั้งหมดเป็นสตริง 'YYYY-MM-DD' (ค.ศ., เวลาไทย) เพื่อเลี่ยงปัญหา timezone
 * fiscal_year เป็น พ.ศ. — ปีงบ 2570 = ต.ค. 2569 (ค.ศ. 2026) ถึง ก.ย. 2570 (ค.ศ. 2027)
 */

/** period 1 = ต.ค. … 12 = ก.ย. → เดือนปฏิทิน 1–12 */
function periodMonth(p) {
  return ((p + 8) % 12) + 1;
}

/** ปี ค.ศ. ของเดือนในรอบนั้น (ต.ค.–ธ.ค. = ปีงบ − 1) */
function periodCeYear(fy, p) {
  return fy - 543 - (p <= 3 ? 1 : 0);
}

/** กำหนดส่ง = วันที่ dueDay ของเดือนถัดไป */
function dueDateOf(fy, p, dueDay) {
  let y = periodCeYear(fy, p);
  let m = periodMonth(p) + 1;
  if (m > 12) { m = 1; y++; }
  return y + '-' + pad2_(m) + '-' + pad2_(dueDay);
}

/** 0 = ก่อนเริ่มปีงบ, 1–12 = รอบของเดือนปัจจุบัน, 13 = หลังสิ้นปีงบ */
function currentPeriodIndex(fy, today) {
  const parts = String(today).split('-').map(Number);
  const idx = parts[0] * 12 + parts[1] - ((fy - 544) * 12 + 10) + 1;
  return idx < 1 ? 0 : idx > 12 ? 13 : idx;
}

function plannedPeriods(planMonths) {
  const out = [];
  String(planMonths || '').split('').forEach(function (c, i) { if (c === '1' && i < 12) out.push(i + 1); });
  return out;
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

function computeProgress(value, target) {
  if (value == null || !(Number(target) > 0)) return 0;
  return Math.max(0, Math.min(Number(value) / Number(target), 1));
}

function byPeriodDesc_(a, b) {
  return Number(b.period_index) - Number(a.period_index);
}

/** ค่าที่นับเข้าตัวชี้วัด = actual_value ของรอบล่าสุดที่ APPROVED (ทั้ง PERCENT_LATEST และ COUNT_CUMULATIVE) */
function approvedValue(reports) {
  const ap = reports.filter(function (r) {
    return r.workflow_state === 'APPROVED' && r.actual_value !== '' && r.actual_value != null;
  }).sort(byPeriodDesc_);
  return ap.length ? Number(ap[0].actual_value) : null;
}

/**
 * สถานะกิจกรรม (SPEC 5.3) — ตัวแรกที่เป็นจริง:
 * LATE → BELOW_TARGET → DONE → NOT_DUE → ON_TRACK
 *
 * การตีความที่ต้องยืนยันกับผู้ใช้ (ดู README › การตีความ):
 *  - "รายงานล่าสุดเลือก DELAYED" = รายงานรอบล่าสุดที่ส่งแล้ว (SUBMITTED/REVIEWED/APPROVED)
 *  - BELOW_TARGET ต้องรอให้รอบสุดท้ายตามแผนอนุมัติแล้ว (ถ้ายังรออนุมัติ ถือว่า ON_TRACK)
 */
function computeActivityStatus(act, reports, today, dueDay) {
  const fy = Number(act.fiscal_year);
  const target = Number(act.target_value);
  const planned = plannedPeriods(act.plan_months);
  const byP = {};
  reports.forEach(function (r) { byP[Number(r.period_index)] = r; });
  const cur = currentPeriodIndex(fy, today);
  const value = approvedValue(reports);

  let overdueDays = 0;
  planned.forEach(function (p) {
    const due = dueDateOf(fy, p, dueDay);
    const r = byP[p];
    if (today > due && (!r || r.workflow_state === 'DRAFT' || r.workflow_state === 'RETURNED')) {
      overdueDays = Math.max(overdueDays, daysBetween(due, today));
    }
  });

  const sent = reports.filter(function (r) { return SENT_STATES.indexOf(r.workflow_state) >= 0; }).sort(byPeriodDesc_);
  const reportedDelayed = sent.length > 0 && sent[0].progress_status === 'DELAYED';
  const base = { value: value, progress: computeProgress(value, target), overdueDays: overdueDays, currentPeriod: cur, reason: '' };
  const res = function (status, reason) { return Object.assign(base, { status: status, reason: reason || '' }); };

  if (overdueDays > 0) return res('LATE', 'OVERDUE');
  if (reportedDelayed) return res('LATE', 'REPORTED_DELAYED');

  const last = planned.length ? planned[planned.length - 1] : 0;
  const lastApproved = !!(last && byP[last] && byP[last].workflow_state === 'APPROVED');
  const lastPassed = !!(last && today > dueDateOf(fy, last, dueDay));

  if (lastPassed && lastApproved && (value == null || value < target)) return res('BELOW_TARGET');
  if (lastApproved && value != null && value >= target) return res('DONE');
  if (!planned.length || planned[0] > cur) return res('NOT_DUE');
  return res('ON_TRACK');
}
