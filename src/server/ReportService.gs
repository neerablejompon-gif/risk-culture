/**
 * Report endpoints: หน้าแสดง/บันทึกร่าง/ส่ง/ตรวจ/อนุมัติ/ส่งกลับ/reopen
 * ทุกการเขียน: LockService + ตรวจ version (optimistic locking) + audit
 */

function reportId_(activityId, p) {
  return activityId + '-' + pad2_(p);
}

function getActivity_(id) {
  const a = readTable_(TABS.ACT).filter(function (x) { return x.activity_id === String(id); })[0];
  if (!a) fail_('NOT_FOUND', 'ไม่พบกิจกรรม ' + id);
  return a;
}

function findReport_(rid) {
  return readTable_(TABS.REP).filter(function (r) { return r.report_id === String(rid); })[0] || null;
}

function prevApprovedValue_(activityId, p) {
  const rs = readTable_(TABS.REP).filter(function (r) {
    return r.activity_id === activityId && r.workflow_state === 'APPROVED' && Number(r.period_index) < p && r.actual_value !== '';
  }).sort(byPeriodDesc_);
  return rs.length ? Number(rs[0].actual_value) : null;
}

function assertPlanned_(a, p) {
  if (!(p >= 1 && p <= 12) || String(a.plan_months).charAt(p - 1) !== '1') {
    fail_('VALIDATION', 'รอบที่ ' + p + ' ไม่อยู่ในแผนของกิจกรรม ' + a.no);
  }
}

/** แยก "บทบาท: ข้อความ / ข้อความ" เป็นรายการตามบทบาท */
function parseRoleLines_(text) {
  const out = [];
  String(text || '').split('\n').forEach(function (line) {
    const i = line.indexOf(':');
    if (i < 0 || !line.trim()) return;
    out.push({
      role: line.slice(0, i).trim(),
      items: line.slice(i + 1).split(' / ').map(function (x) { return x.trim(); }).filter(Boolean)
    });
  });
  return out;
}

function mergeGuide_(doText, dontText) {
  const map = {};
  const order = [];
  const put = function (list, key) {
    list.forEach(function (x) {
      if (!map[x.role]) { map[x.role] = { role: x.role, 'do': [], dont: [] }; order.push(x.role); }
      map[x.role][key] = map[x.role][key].concat(x.items);
    });
  };
  put(parseRoleLines_(doText), 'do');
  put(parseRoleLines_(dontText), 'dont');
  return order.map(function (r) { return map[r]; });
}

function publicEvidence_(e) {
  return {
    evidence_id: e.evidence_id, kind: e.kind, name: e.name, url: e.url, mime_type: e.mime_type,
    size_bytes: Number(e.size_bytes) || 0, uploaded_by: e.uploaded_by, uploaded_at: e.uploaded_at
  };
}

function apiGetReportPage(activityId, period) {
  const u = currentUser_();
  const s = getSettings_();
  const a = getActivity_(activityId);
  const fy = Number(a.fiscal_year);
  const today = todayYmd_();
  const reps = readTable_(TABS.REP).filter(function (r) { return r.activity_id === a.activity_id; });
  const stateOf = function (p) {
    const r = reps.filter(function (x) { return Number(x.period_index) === p; })[0];
    return r ? r.workflow_state : '';
  };
  const planned = plannedPeriods(a.plan_months);
  let p = Number(period) || 0;
  if (!p) {
    const cur = currentPeriodIndex(fy, today);
    const open = planned.filter(function (x) { const st = stateOf(x); return x <= cur && (!st || st === 'DRAFT' || st === 'RETURNED'); });
    const past = planned.filter(function (x) { return x <= cur; });
    p = open[0] || past[past.length - 1] || planned[0] || 0;
  }
  assertPlanned_(a, p);
  const r = reps.filter(function (x) { return Number(x.period_index) === p; })[0] || null;
  const state = r ? r.workflow_state : '';
  const owner = isOwner_(u, a);
  const perms = { edit: canEditReport(state, u.role, owner) };
  Object.keys(WF).forEach(function (k) { perms[k] = canTransition(k, state, u.role, owner); });
  const evidence = r ? readTable_(TABS.EVI).filter(function (e) { return e.report_id === r.report_id && !truthy_(e.deleted); }).map(publicEvidence_) : [];

  return {
    user: u,
    activity: Object.assign(publicAct_(a), computeActivityStatus(a, reps, today, s.dueDay), {
      formula_note: a.formula_note, expected_outcome: a.expected_outcome
    }),
    period: { index: p, due: dueDateOf(fy, p, s.dueDay), report_id: reportId_(a.activity_id, p) },
    planned: planned.map(function (x) { return { index: x, state: stateOf(x) }; }),
    report: publicReport_(r),
    prevValue: prevApprovedValue_(a.activity_id, p),
    evidence: evidence,
    history: reps.slice().sort(function (x, y) { return Number(x.period_index) - Number(y.period_index); }).map(publicReport_),
    perms: perms,
    guide: mergeGuide_(a.do_text, a.dont_text),
    limits: { maxFileMb: s.maxFileMb, allowedExt: s.allowedExt },
    today: today
  };
}

function saveDraft_(u, payload, mode) {
  payload = payload || {};
  const a = getActivity_(payload.activity_id);
  const p = Number(payload.period_index);
  assertPlanned_(a, p);
  const rid = reportId_(a.activity_id, p);
  const cur = findReport_(rid);
  const state = cur ? cur.workflow_state : '';
  if (!canEditReport(state, u.role, isOwner_(u, a))) fail_('FORBIDDEN', 'ไม่มีสิทธิ์แก้ไขรายงานนี้ (สถานะ ' + (state || 'ใหม่') + ')');
  if (cur && Number(payload.version) !== Number(cur.version)) {
    fail_('CONFLICT', 'มีผู้แก้ไขรายงานนี้ก่อนหน้า ข้อมูลของคุณยังไม่ถูกบันทึก — กรุณาโหลดข้อมูลล่าสุด');
  }
  const v = validateReport(payload.fields, {
    measureType: a.measure_type, prevValue: prevApprovedValue_(a.activity_id, p), mode: mode
  });
  if (v.errors.length) fail_('VALIDATION', 'ข้อมูลไม่ถูกต้อง ' + v.errors.length + ' รายการ', { fields: v.errors });

  const now = nowIso_();
  const base = cur || { report_id: rid, activity_id: a.activity_id, period_index: p, workflow_state: 'DRAFT', reporter_email: u.email, version: 0 };
  const next = Object.assign({}, base, v.clean, { version: Number(base.version) + 1, updated_at: now, updated_by: u.email });
  if (cur) {
    updateRow_(TABS.REP, next);
    writeAudit_(u.email, 'UPDATE', 'report', rid, cur, next);
  } else {
    insertRow_(TABS.REP, next);
    writeAudit_(u.email, 'CREATE', 'report', rid, null, next);
  }
  invalidate_(a.fiscal_year);
  return next;
}

function apiSaveDraft(payload) {
  const u = currentUser_();
  return withLock_(function () { return publicReport_(saveDraft_(u, payload, 'draft')); });
}

/** บันทึก + ส่งในครั้งเดียว (ผ่าน validation โหมด submit) */
function apiSubmit(payload) {
  const u = currentUser_();
  return withLock_(function () {
    const saved = saveDraft_(u, payload, 'submit');
    return publicReport_(transition_(u, saved.report_id, 'submit', '', saved.version));
  });
}

/** review | approve | return | reopen */
function apiTransition(reportId, action, comment, version) {
  const u = currentUser_();
  if (action === 'submit' || !WF[action]) fail_('VALIDATION', 'action ไม่ถูกต้อง');
  return withLock_(function () { return publicReport_(transition_(u, reportId, action, comment, version)); });
}

function transition_(u, rid, action, comment, version) {
  const r = findReport_(rid);
  if (!r) fail_('NOT_FOUND', 'ไม่พบรายงาน ' + rid);
  const a = getActivity_(r.activity_id);
  if (Number(version) !== Number(r.version)) fail_('CONFLICT', 'รายงานถูกแก้ไขก่อนหน้า กรุณาโหลดข้อมูลล่าสุด');
  if (!canTransition(action, r.workflow_state, u.role, isOwner_(u, a))) {
    fail_('FORBIDDEN', 'ไม่สามารถ' + ACTION_LABEL[action] + 'ได้ (สถานะ ' + r.workflow_state + ', บทบาท ' + u.role + ')');
  }
  comment = String(comment || '').trim();
  if (WF[action].comment && !comment) {
    fail_('VALIDATION', 'กรุณาระบุความเห็นก่อน' + ACTION_LABEL[action], { fields: [{ field: 'comment', message: 'กรุณาระบุความเห็น' }] });
  }
  if (comment.length > 1000) fail_('VALIDATION', 'ความเห็นยาวเกิน 1,000 ตัวอักษร');

  const now = nowIso_();
  const next = Object.assign({}, r, { workflow_state: WF[action].to, version: Number(r.version) + 1, updated_at: now, updated_by: u.email });
  if (action === 'submit') {
    next.reporter_email = u.email;
    next.submitted_at = now;
  } else if (action === 'review') {
    next.reviewer_email = u.email; next.reviewed_at = now; next.review_comment = comment;
  } else if (action === 'approve') {
    next.approver_email = u.email; next.approved_at = now; next.approve_comment = comment;
  } else if (action === 'return') {
    if (r.workflow_state === 'SUBMITTED') { next.reviewer_email = u.email; next.reviewed_at = now; next.review_comment = comment; }
    else { next.approver_email = u.email; next.approve_comment = comment; }
    next.return_comment = comment;
  } else if (action === 'reopen') {
    next.return_comment = comment;
    next.approved_at = '';
  }
  updateRow_(TABS.REP, next);
  writeAudit_(u.email, action.toUpperCase(), 'report', rid, r, next);
  invalidate_(a.fiscal_year);
  return next;
}
