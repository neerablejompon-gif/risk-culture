/* eslint-disable */
/**
 * Integration tests: รัน service จริงบน in-memory shim (Node เท่านั้น — เรียกผ่าน tests/run.js)
 */
function runIntegrationTests() {
  var res = { passed: 0, failed: 0, failures: [] };
  var eq = function (a, e, m) { if (JSON.stringify(a) !== JSON.stringify(e)) throw new Error((m || '') + ' expected ' + JSON.stringify(e) + ' got ' + JSON.stringify(a)); };
  var as = function (email) { DEV.user = email; };
  var code = function (fn) { try { fn(); return 'OK'; } catch (e) { var m = e.message; try { return JSON.parse(m).code; } catch (_) { return 'RAW:' + m; } } };
  var t = function (name, fn) {
    DEV.reset({ today: '2027-01-02' });
    try { fn(); res.passed++; } catch (e) { res.failed++; res.failures.push(name + ': ' + e.message); }
  };
  var ID = '2570-2.2';
  var good = { actual_value: 1, progress_status: 'ON_PLAN', summary: 'นำเสนอรายงานไตรมาส 1 แล้ว' };

  t('seed: 18 กิจกรรม ค่าตรงกับต้นฉบับ', function () {
    var acts = readTable_(TABS.ACT);
    eq(acts.length, 18);
    var a = acts.filter(function (x) { return x.no === '2.2'; })[0];
    eq([a.value_code, a.value_name, a.dimension, a.target_value, a.unit, a.plan_months, a.measure_type],
      ['U', 'Unity', 'Understand impact', '4', 'ครั้ง/ปี', '001001001001', 'COUNT_CUMULATIVE']);
    eq(acts.filter(function (x) { return x.no === '6.2'; })[0].plan_months, '000111111111');
  });

  t('seed idempotent + คงค่า owner_emails', function () {
    var r = upsertActivities_(mapSourceRows_(DEV_FIXTURE.raw['แผน/ผล'], 2570), 'test');
    eq(r, { added: 0, updated: 0 });
    eq(readTable_(TABS.ACT)[0].owner_emails, 'staff@example.com');
  });

  t('flow DRAFT → SUBMITTED → REVIEWED → APPROVED + audit', function () {
    as('staff@example.com');
    var d = apiSaveDraft({ activity_id: ID, period_index: 3, version: 0, fields: { actual_value: 1 } });
    eq([d.workflow_state, d.version], ['DRAFT', 1]);
    var s = apiSubmit({ activity_id: ID, period_index: 3, version: 1, fields: good });
    eq(s.workflow_state, 'SUBMITTED');
    as('head@example.com');
    var r = apiTransition(s.report_id, 'review', '', s.version);
    eq(r.workflow_state, 'REVIEWED');
    as('director@example.com');
    var a = apiTransition(r.report_id, 'approve', 'ดี', r.version);
    eq(a.workflow_state, 'APPROVED');
    var item = apiGetActivities(2570).items.filter(function (x) { return x.activity_id === ID; })[0];
    eq([item.value, item.cal[2]], [1, 'sent']);
    var actions = readTable_(TABS.AUD).map(function (x) { return x.action; });
    eq(actions, ['CREATE', 'UPDATE', 'SUBMIT', 'REVIEW', 'APPROVE']);
  });

  t('ผลที่ยังไม่อนุมัติไม่นับ', function () {
    as('staff@example.com');
    apiSubmit({ activity_id: ID, period_index: 3, version: 0, fields: good });
    var item = apiGetActivities(2570).items.filter(function (x) { return x.activity_id === ID; })[0];
    eq(item.value, null);
  });

  t('return ต้องมี comment และกลับไปแก้ได้', function () {
    as('staff@example.com');
    var s = apiSubmit({ activity_id: ID, period_index: 3, version: 0, fields: good });
    as('head@example.com');
    eq(code(function () { apiTransition(s.report_id, 'return', '  ', s.version); }), 'VALIDATION');
    var r = apiTransition(s.report_id, 'return', 'แนบหลักฐาน', s.version);
    eq([r.workflow_state, r.return_comment], ['RETURNED', 'แนบหลักฐาน']);
    as('staff@example.com');
    eq(apiSubmit({ activity_id: ID, period_index: 3, version: r.version, fields: good }).workflow_state, 'SUBMITTED');
  });

  t('สิทธิ์: STAFF ที่ไม่ใช่เจ้าของ / EXEC_VIEWER / DIRECTOR แก้ไม่ได้', function () {
    as('staff2@example.com');
    eq(code(function () { apiSaveDraft({ activity_id: ID, period_index: 3, version: 0, fields: {} }); }), 'FORBIDDEN');
    as('exec@example.com');
    eq(code(function () { apiSaveDraft({ activity_id: ID, period_index: 3, version: 0, fields: {} }); }), 'FORBIDDEN');
    as('director@example.com');
    eq(code(function () { apiSaveDraft({ activity_id: ID, period_index: 3, version: 0, fields: {} }); }), 'FORBIDDEN');
  });

  t('สิทธิ์: ข้ามขั้น / บทบาทผิด ถูกปฏิเสธ', function () {
    as('staff@example.com');
    var s = apiSubmit({ activity_id: ID, period_index: 3, version: 0, fields: good });
    eq(code(function () { apiTransition(s.report_id, 'review', '', s.version); }), 'FORBIDDEN');
    as('director@example.com');
    eq(code(function () { apiTransition(s.report_id, 'approve', '', s.version); }), 'FORBIDDEN');
    as('head@example.com');
    eq(code(function () { apiTransition(s.report_id, 'submit', '', s.version); }), 'VALIDATION');
  });

  t('ผู้ใช้ไม่อยู่ใน cfg_Users ถูกปฏิเสธทุก endpoint', function () {
    as('stranger@example.com');
    ['apiBootstrap', 'apiGetDashboard', 'apiGetActivities', 'apiGetMyTasks', 'apiGetGuidelines'].forEach(function (f) {
      eq(code(function () { globalThis[f](); }), 'FORBIDDEN', f);
    });
  });

  t('APPROVED แก้ไม่ได้ ยกเว้น ADMIN reopen พร้อมเหตุผล', function () {
    as('staff@example.com');
    var s = apiSubmit({ activity_id: ID, period_index: 3, version: 0, fields: good });
    as('head@example.com'); var r = apiTransition(s.report_id, 'review', '', s.version);
    as('director@example.com'); var a = apiTransition(r.report_id, 'approve', '', r.version);
    as('staff@example.com');
    eq(code(function () { apiSaveDraft({ activity_id: ID, period_index: 3, version: a.version, fields: good }); }), 'FORBIDDEN');
    as('director@example.com');
    eq(code(function () { apiTransition(a.report_id, 'reopen', 'แก้ตัวเลข', a.version); }), 'FORBIDDEN');
    as('admin@example.com');
    eq(code(function () { apiTransition(a.report_id, 'reopen', '', a.version); }), 'VALIDATION');
    eq(apiTransition(a.report_id, 'reopen', 'แก้ตัวเลข', a.version).workflow_state, 'RETURNED');
  });

  t('optimistic locking: version ไม่ตรง → CONFLICT และไม่ทับข้อมูล', function () {
    as('staff@example.com');
    apiSaveDraft({ activity_id: ID, period_index: 3, version: 0, fields: { summary: 'A' } });
    apiSaveDraft({ activity_id: ID, period_index: 3, version: 1, fields: { summary: 'B' } });
    eq(code(function () { apiSaveDraft({ activity_id: ID, period_index: 3, version: 1, fields: { summary: 'C' } }); }), 'CONFLICT');
    eq(findReport_(ID + '-03').summary, 'B');
  });

  t('validation ฝั่ง server: cumulative ห้ามลด, รอบนอกแผน, submit ไม่ครบ', function () {
    as('admin@example.com');
    var s = apiSubmit({ activity_id: ID, period_index: 3, version: 0, fields: { actual_value: 2, progress_status: 'ON_PLAN', summary: 'x' } });
    apiTransition(s.report_id, 'review', '', s.version);
    apiTransition(s.report_id, 'approve', '', s.version + 1);
    eq(code(function () { apiSaveDraft({ activity_id: ID, period_index: 6, version: 0, fields: { actual_value: 1 } }); }), 'VALIDATION');
    eq(code(function () { apiSaveDraft({ activity_id: ID, period_index: 4, version: 0, fields: {} }); }), 'VALIDATION');
    eq(code(function () { apiSubmit({ activity_id: ID, period_index: 6, version: 0, fields: { actual_value: 3, progress_status: 'DELAYED', summary: 'x' } }); }), 'VALIDATION');
    eq(findReport_(ID + '-06'), null);
  });

  t('หลักฐาน: whitelist นามสกุล/MIME/ขนาด, ลิงก์ Drive เท่านั้น, soft delete', function () {
    as('staff@example.com');
    var d = apiSaveDraft({ activity_id: ID, period_index: 3, version: 0, fields: {} });
    var b64 = btoa('%PDF-1.4 test');
    eq(code(function () { apiUploadEvidence(d.report_id, { name: 'x.exe', mimeType: 'application/octet-stream', base64: b64 }); }), 'VALIDATION');
    eq(code(function () { apiUploadEvidence(d.report_id, { name: 'x.pdf', mimeType: 'image/png', base64: b64 }); }), 'VALIDATION');
    var e = apiUploadEvidence(d.report_id, { name: 'รายงาน.pdf', mimeType: 'application/pdf', base64: b64 });
    eq(e.kind, 'FILE');
    eq(readTable_(TABS.EVI)[0].name, 'รายงาน.pdf');
    eq(code(function () { apiAddEvidenceLink(d.report_id, { url: 'https://evil.example.com/x' }); }), 'VALIDATION');
    apiAddEvidenceLink(d.report_id, { url: 'https://drive.google.com/drive/folders/abc' });
    apiDeleteEvidence(e.evidence_id);
    eq(apiGetReportPage(ID, 3).evidence.length, 1);
    as('staff2@example.com');
    eq(code(function () { apiAddEvidenceLink(d.report_id, { url: 'https://drive.google.com/x' }); }), 'FORBIDDEN');
  });

  t('demo: dashboard สถานะครบ 5 แบบ และ export ตรงกับ dashboard', function () {
    DEV.reset({ demo: true });
    as('exec@example.com');
    var d = apiGetDashboard(2570);
    var n = {};
    d.dist.forEach(function (x) { n[x.status] = x.n; });
    eq(n, { DONE: 3, ON_TRACK: 9, LATE: 3, BELOW_TARGET: 1, NOT_DUE: 2 });
    eq(d.follow.map(function (x) { return x.no; }), ['2.2', '4.2', '6.3', '2.1']);
    apiExportSummary(2570);
    var rows = DEV.lastExport;
    eq(rows.length, 19);
    var byNo = {};
    rows.slice(1).forEach(function (r) { byNo[r[0]] = r[13]; });
    eq([byNo['2.2'], byNo['2.1'], byNo['4.1']], ['ล่าช้า', 'ต่ำกว่าเป้า', 'เสร็จสิ้น']);
  });

  t('demo: inbox ตามบทบาท และ my tasks', function () {
    DEV.reset({ demo: true });
    as('head@example.com');
    eq(apiGetInbox().items.map(function (x) { return x.no; }).sort(), ['3.2', '6.3']);
    as('director@example.com');
    eq(apiGetInbox().items.map(function (x) { return x.no; }), ['1.3']);
    as('staff@example.com');
    eq(code(function () { apiGetInbox(); }), 'FORBIDDEN');
    var m = apiGetMyTasks();
    eq(m.tasks.todo.map(function (x) { return x.no + '/' + x.period; }).slice(0, 2), ['2.2/6', '4.2/6']);
  });

  t('guidelines: 4 บทบาท', function () {
    as('staff@example.com');
    var g = apiGetGuidelines();
    eq(g.roles.length, 4);
    eq(g.groups[1].value_name, 'Unity');
    eq(g.groups[0].cells[3]['do'][0], 'รู้และเข้าใจว่างานที่ตนเองทำอยู่มีจุดเสี่ยงอะไรบ้าง');
  });

  console.log('integration: ผ่าน ' + res.passed + ', ไม่ผ่าน ' + res.failed);
  res.failures.forEach(function (f) { console.log('  ✗ ' + f); });
  return res;
}
