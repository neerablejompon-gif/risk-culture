/**
 * Unit tests ของ pure functions — รันได้ทั้งใน Apps Script editor (runTests) และ Node (npm test)
 */
function runTests() {
  const results = { passed: 0, failed: 0, failures: [] };
  const log = typeof Logger !== 'undefined' ? function (m) { Logger.log(m); } : function (m) { console.log(m); };
  const eq = function (actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error((msg || '') + ' expected ' + e + ' got ' + a);
  };
  const t = function (name, fn) {
    try { fn(); results.passed++; } catch (err) { results.failed++; results.failures.push(name + ': ' + err.message); }
  };

  const ACT = { fiscal_year: '2570', target_value: '4', plan_months: '001001001001' };
  const rep = function (p, state, value, progress) {
    return { period_index: String(p), workflow_state: state, actual_value: value == null ? '' : String(value), progress_status: progress || 'ON_PLAN' };
  };
  const st = function (reports, today, act) { return computeActivityStatus(act || ACT, reports, today, 5); };

  // --- รอบ/กำหนดส่ง ---
  t('periodMonth', function () { eq([1, 3, 4, 12].map(periodMonth), [10, 12, 1, 9]); });
  t('dueDateOf ต.ค.', function () { eq(dueDateOf(2570, 1, 5), '2026-11-05'); });
  t('dueDateOf ธ.ค. ข้ามปี', function () { eq(dueDateOf(2570, 3, 5), '2027-01-05'); });
  t('dueDateOf ก.ย.', function () { eq(dueDateOf(2570, 12, 5), '2027-10-05'); });
  t('currentPeriodIndex', function () {
    eq([currentPeriodIndex(2570, '2026-09-30'), currentPeriodIndex(2570, '2026-10-01'),
      currentPeriodIndex(2570, '2027-03-15'), currentPeriodIndex(2570, '2027-09-30'), currentPeriodIndex(2570, '2027-10-01')], [0, 1, 6, 12, 13]);
  });
  t('plannedPeriods', function () { eq(plannedPeriods('001001001001'), [3, 6, 9, 12]); });
  t('computeProgress', function () { eq([computeProgress(null, 4), computeProgress(2, 4), computeProgress(9, 4), computeProgress(1, 0)], [0, 0.5, 1, 0]); });

  // --- สถานะ 5 แบบ ---
  t('NOT_DUE ก่อนรอบแรก', function () { eq(st([], '2026-10-21').status, 'NOT_DUE'); });
  t('ON_TRACK อยู่ในรอบแต่ยังไม่เลยกำหนด', function () { eq(st([], '2026-12-20').status, 'ON_TRACK'); });
  t('LATE เลยกำหนดไม่มีรายงาน', function () {
    const r = st([], '2027-01-10');
    eq([r.status, r.reason, r.overdueDays], ['LATE', 'OVERDUE', 5]);
  });
  t('LATE รายงานถูก RETURNED และเลยกำหนด', function () { eq(st([rep(3, 'RETURNED', 1)], '2027-01-10').status, 'LATE'); });
  t('LATE รายงานยังเป็น DRAFT และเลยกำหนด', function () { eq(st([rep(3, 'DRAFT', 1)], '2027-01-10').status, 'LATE'); });
  t('ON_TRACK ส่งแล้วรออนุมัติ', function () { eq(st([rep(3, 'SUBMITTED', 1)], '2027-01-10').status, 'ON_TRACK'); });
  t('LATE รายงานล่าสุดเลือก DELAYED', function () {
    const r = st([rep(3, 'APPROVED', 1, 'DELAYED')], '2027-01-10');
    eq([r.status, r.reason], ['LATE', 'REPORTED_DELAYED']);
  });
  t('DONE ครบเป้าและรอบสุดท้ายอนุมัติ', function () {
    const r = st([rep(3, 'APPROVED', 1), rep(6, 'APPROVED', 2), rep(9, 'APPROVED', 3), rep(12, 'APPROVED', 4)], '2027-10-10');
    eq([r.status, r.value, r.progress], ['DONE', 4, 1]);
  });
  t('BELOW_TARGET รอบสุดท้ายผ่านไปแล้วและต่ำกว่าเป้า', function () {
    eq(st([rep(3, 'APPROVED', 1), rep(6, 'APPROVED', 2), rep(9, 'APPROVED', 3), rep(12, 'APPROVED', 3)], '2027-10-10').status, 'BELOW_TARGET');
  });
  t('ON_TRACK รอบสุดท้ายยังรออนุมัติ', function () {
    eq(st([rep(3, 'APPROVED', 1), rep(6, 'APPROVED', 2), rep(9, 'APPROVED', 3), rep(12, 'REVIEWED', 4)], '2027-10-10').status, 'ON_TRACK');
  });
  t('นับเฉพาะ APPROVED', function () {
    eq(st([rep(3, 'APPROVED', 1), rep(6, 'SUBMITTED', 3)], '2027-04-01').value, 1);
  });
  t('ไม่มีรายงานเลยหลังจบปีงบ', function () { eq(st([], '2027-11-01').status, 'LATE'); });
  t('ข้ามปีงบ: กิจกรรมปีหน้ายังไม่ถึงกำหนด', function () {
    eq(st([], '2027-01-10', { fiscal_year: '2571', target_value: '4', plan_months: '001001001001' }).status, 'NOT_DUE');
  });
  t('ไม่มีเดือนตามแผน → NOT_DUE', function () {
    eq(st([], '2027-01-10', { fiscal_year: '2570', target_value: '1', plan_months: '000000000000' }).status, 'NOT_DUE');
  });

  // --- workflow ---
  t('canTransition submit owner/non-owner', function () {
    eq([canTransition('submit', '', 'STAFF', true), canTransition('submit', '', 'STAFF', false), canTransition('submit', 'RETURNED', 'STAFF', true)], [true, false, true]);
  });
  t('canTransition review/approve ตามบทบาท', function () {
    eq([canTransition('review', 'SUBMITTED', 'GROUP_HEAD'), canTransition('review', 'SUBMITTED', 'DIRECTOR'),
      canTransition('approve', 'REVIEWED', 'DIRECTOR'), canTransition('approve', 'SUBMITTED', 'DIRECTOR')], [true, false, true, false]);
  });
  t('canTransition return ตามขั้น', function () {
    eq([canTransition('return', 'SUBMITTED', 'GROUP_HEAD'), canTransition('return', 'SUBMITTED', 'DIRECTOR'),
      canTransition('return', 'REVIEWED', 'DIRECTOR'), canTransition('return', 'APPROVED', 'ADMIN')], [true, false, true, false]);
  });
  t('reopen เฉพาะ ADMIN', function () { eq([canTransition('reopen', 'APPROVED', 'ADMIN'), canTransition('reopen', 'APPROVED', 'DIRECTOR')], [true, false]); });
  t('canEditReport', function () {
    eq([canEditReport('', 'STAFF', true), canEditReport('SUBMITTED', 'STAFF', true), canEditReport('DRAFT', 'EXEC_VIEWER', true), canEditReport('DRAFT', 'DIRECTOR', true)], [true, false, false, false]);
  });

  // --- validation ---
  const fields = function (v) { return validateReport(v.f, v.c).errors.map(function (e) { return e.field; }); };
  t('submit: required ครบ', function () {
    eq(fields({ f: {}, c: { mode: 'submit' } }), ['progress_status', 'actual_value', 'summary']);
  });
  t('submit: DELAYED ต้องมี issues + eta', function () {
    eq(fields({ f: { actual_value: 1, progress_status: 'DELAYED', summary: 'x' }, c: { mode: 'submit' } }), ['issues', 'eta_date']);
  });
  t('submit: NOT_STARTED ไม่ต้องมีผล แต่ต้องมี issues', function () {
    eq(fields({ f: { progress_status: 'NOT_STARTED', summary: 'x' }, c: { mode: 'submit' } }), ['issues']);
  });
  t('draft: ตรวจเฉพาะชนิด', function () { eq(fields({ f: { actual_value: 'abc' }, c: { mode: 'draft' } }), ['actual_value']); });
  t('ติดลบไม่ได้', function () { eq(fields({ f: { actual_value: -1 }, c: { mode: 'draft' } }), ['actual_value']); });
  t('cumulative ห้ามลดลง', function () {
    eq(fields({ f: { actual_value: 1 }, c: { mode: 'draft', measureType: 'COUNT_CUMULATIVE', prevValue: 2 } }), ['actual_value']);
  });
  t('percent ไม่เกิน 100', function () { eq(fields({ f: { actual_value: 101 }, c: { mode: 'draft', measureType: 'PERCENT_LATEST' } }), ['actual_value']); });
  t('summary ยาวเกิน 1000', function () { eq(fields({ f: { summary: new Array(1002).join('ก') }, c: { mode: 'draft' } }), ['summary']); });
  t('eta ไม่ใช่วันที่จริง', function () { eq(fields({ f: { eta_date: '2027-02-30' }, c: { mode: 'draft' } }), ['eta_date']); });

  // --- parsing ---
  t('splitCode_', function () { eq([splitCode_('U - Unity'), splitCode_('B - Be proactive')], [['U', 'Unity'], ['B', 'Be proactive']]); });
  t('parseRoleLines_', function () {
    eq(parseRoleLines_('พนักงาน: ก / ข\nผู้บริหาร: ค'), [{ role: 'พนักงาน', items: ['ก', 'ข'] }, { role: 'ผู้บริหาร', items: ['ค'] }]);
  });

  log('runTests: ผ่าน ' + results.passed + ', ไม่ผ่าน ' + results.failed);
  results.failures.forEach(function (f) { log('  ✗ ' + f); });
  return results;
}
