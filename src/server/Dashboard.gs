/**
 * Read endpoints: bootstrap, dashboard, activities, my tasks, inbox, guidelines
 * นับผลเฉพาะรายงาน APPROVED (ผ่าน computeActivityStatus)
 */

function byNo_(a, b) {
  const pa = String(a.no).split('.').map(Number);
  const pb = String(b.no).split('.').map(Number);
  return (pa[0] - pb[0]) || (pa[1] - pb[1]);
}

function publicAct_(a) {
  return {
    activity_id: a.activity_id, fiscal_year: Number(a.fiscal_year), no: a.no, group_no: Number(a.group_no),
    value_code: a.value_code, value_name: a.value_name, dimension: a.dimension, name: a.name,
    target_group: a.target_group, kpi: a.kpi, target_value: Number(a.target_value), unit: a.unit,
    measure_type: a.measure_type, plan_months: a.plan_months, owner_unit: a.owner_unit
  };
}

function publicReport_(r) {
  if (!r) return null;
  const o = stripRow_(r);
  o.period_index = Number(r.period_index);
  o.version = Number(r.version) || 0;
  o.actual_value = toNum_(r.actual_value);
  return o;
}

function loadFy_(fy) {
  const acts = readTable_(TABS.ACT).filter(function (a) {
    return Number(a.fiscal_year) === fy && truthy_(a.active);
  }).sort(byNo_);
  const byAct = {};
  readTable_(TABS.REP).forEach(function (r) {
    if (String(r.activity_id).indexOf(fy + '-') === 0) (byAct[r.activity_id] = byAct[r.activity_id] || []).push(r);
  });
  return { acts: acts, byAct: byAct };
}

/** สร้าง model ของทั้งปีงบ: กิจกรรม + สถานะ + รายงานรายรอบ */
function buildModel_(fy, today, dueDay) {
  const m = loadFy_(fy);
  const items = m.acts.map(function (a) {
    const reps = m.byAct[a.activity_id] || [];
    const byP = {};
    reps.forEach(function (r) { byP[Number(r.period_index)] = r; });
    return Object.assign(publicAct_(a), computeActivityStatus(a, reps, today, dueDay), { _byP: byP, _owners: a.owner_emails });
  });
  return { fy: fy, today: today, cur: currentPeriodIndex(fy, today), items: items };
}

function stripItem_(it) {
  const o = Object.assign({}, it);
  delete o._byP;
  delete o._owners;
  return o;
}

/** รอบล่าสุดที่ควรรายงาน = เดือนที่เพิ่งจบ (ถ้ายังไม่จบสักเดือน ใช้เดือนปัจจุบัน) */
function latestRound_(cur) {
  if (cur <= 0) return 0;
  if (cur >= 13) return 12;
  return Math.max(cur - 1, 1);
}

function roundStats_(items, p) {
  const planned = items.filter(function (i) { return i.plan_months.charAt(p - 1) === '1'; });
  const sent = planned.filter(function (i) { const r = i._byP[p]; return r && SENT_STATES.indexOf(r.workflow_state) >= 0; });
  return { planned: planned.length, sent: sent.length };
}

function apiBootstrap() {
  const u = currentUser_();
  const s = getSettings_();
  const years = {};
  years[s.fy] = true;
  readTable_(TABS.ACT).forEach(function (a) { if (a.fiscal_year) years[Number(a.fiscal_year)] = true; });
  return {
    user: u,
    fy: s.fy,
    today: todayYmd_(),
    fiscalYears: Object.keys(years).map(Number).sort(function (a, b) { return b - a; }),
    inboxCount: inboxItems_(u).length
  };
}

function apiGetDashboard(fy) {
  currentUser_();
  const s = getSettings_();
  fy = Number(fy) || s.fy;
  const cache = CacheService.getScriptCache();
  const key = dashCacheKey_(fy);
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const out = buildDashboard_(fy, todayYmd_(), s.dueDay);
  try { cache.put(key, JSON.stringify(out), 60); } catch (e) { /* >100KB หรือ cache ล่ม — ข้ามได้ */ }
  return out;
}

function buildDashboard_(fy, today, dueDay) {
  const m = buildModel_(fy, today, dueDay);
  const items = m.items;
  const count = function (k) { return items.filter(function (i) { return i.status === k; }).length; };
  const round = latestRound_(m.cur);
  const rs = round ? roundStats_(items, round) : { planned: 0, sent: 0 };

  const groups = [];
  items.forEach(function (i) {
    let g = groups.filter(function (x) { return x.group_no === i.group_no; })[0];
    if (!g) {
      g = { group_no: i.group_no, value_code: i.value_code, value_name: i.value_name, dimension: i.dimension, statuses: [] };
      groups.push(g);
    }
    g.statuses.push(i.status);
  });

  const follow = items.filter(function (i) { return i.status === 'LATE' || i.status === 'BELOW_TARGET'; })
    .sort(function (a, b) {
      return (a.status === 'LATE' ? 0 : 1) - (b.status === 'LATE' ? 0 : 1) || b.overdueDays - a.overdueDays || byNo_(a, b);
    }).map(stripItem_);

  const monthly = [];
  for (let p = 1; p <= 12; p++) {
    const due = dueDateOf(fy, p, dueDay);
    const planned = items.filter(function (i) { return i.plan_months.charAt(p - 1) === '1'; });
    const onTime = planned.filter(function (i) {
      const r = i._byP[p];
      return r && SENT_STATES.indexOf(r.workflow_state) >= 0 && String(r.submitted_at).slice(0, 10) <= due;
    }).length;
    const sent = planned.filter(function (i) { const r = i._byP[p]; return r && SENT_STATES.indexOf(r.workflow_state) >= 0; }).length;
    monthly.push({ p: p, planned: planned.length, sent: sent, onTime: onTime, due: due, past: today > due });
  }

  let nextRound = null;
  for (let p = Math.max(m.cur, 1); p <= 12 && m.cur <= 12; p++) {
    const mo = monthly[p - 1];
    if (mo.planned && !mo.past) { nextRound = { p: p, planned: mo.planned, due: mo.due }; break; }
  }

  return {
    fy: fy, today: today, asOf: nowIso_(), currentPeriod: m.cur, total: items.length,
    dist: STATUS_ORDER.map(function (k) { return { status: k, n: count(k) }; }),
    kpi: {
      doneOnTrack: count('DONE') + count('ON_TRACK'),
      started: items.length - count('NOT_DUE'),
      late: count('LATE'),
      below: count('BELOW_TARGET'),
      round: { p: round, planned: rs.planned, sent: rs.sent, due: round ? dueDateOf(fy, round, dueDay) : '' }
    },
    groups: groups, follow: follow, monthly: monthly, nextRound: nextRound
  };
}

function apiGetActivities(fy) {
  currentUser_();
  const s = getSettings_();
  fy = Number(fy) || s.fy;
  const m = buildModel_(fy, todayYmd_(), s.dueDay);
  const owners = {};
  const items = m.items.map(function (i) {
    owners[i.owner_unit] = true;
    const cal = [];
    for (let p = 1; p <= 12; p++) {
      let kind = 'none';
      if (i.plan_months.charAt(p - 1) === '1') {
        const r = i._byP[p];
        if (r && SENT_STATES.indexOf(r.workflow_state) >= 0) kind = 'sent';
        else if (p < m.cur) kind = 'due';
        else kind = 'plan';
      }
      cal.push(kind);
    }
    return Object.assign(stripItem_(i), { cal: cal });
  });
  return { fy: fy, today: m.today, currentPeriod: m.cur, owners: Object.keys(owners).sort(), items: items };
}

function apiGetMyTasks() {
  const u = currentUser_();
  const s = getSettings_();
  const m = buildModel_(s.fy, todayYmd_(), s.dueDay);
  const mine = m.items.filter(function (i) { return splitEmails_(i._owners).indexOf(u.email) >= 0; });
  const tasks = { todo: [], review: [], done: [] };
  mine.forEach(function (i) {
    plannedPeriods(i.plan_months).forEach(function (p) {
      if (p > m.cur) return;
      const r = i._byP[p];
      const st = r ? r.workflow_state : '';
      const due = dueDateOf(s.fy, p, s.dueDay);
      const t = {
        activity_id: i.activity_id, no: i.no, value_name: i.value_name, name: i.name, period: p, due: due,
        state: st, value: i.value, target_value: i.target_value, unit: i.unit,
        overdueDays: m.today > due ? daysBetween(due, m.today) : 0,
        return_comment: r ? r.return_comment : ''
      };
      if (!st || st === 'DRAFT' || st === 'RETURNED') tasks.todo.push(t);
      else if (st === 'APPROVED') tasks.done.push(t);
      else tasks.review.push(t);
    });
  });
  tasks.todo.sort(function (a, b) { return b.overdueDays - a.overdueDays || a.period - b.period; });
  tasks.done.sort(function (a, b) { return b.period - a.period; });
  const round = latestRound_(m.cur);
  const rs = round ? roundStats_(mine, round) : { planned: 0, sent: 0 };
  return {
    user: u, fy: s.fy, today: m.today, assigned: mine.length,
    round: { p: round, planned: rs.planned, sent: rs.sent, due: round ? dueDateOf(s.fy, round, s.dueDay) : '' },
    tasks: tasks
  };
}

function inboxItems_(u) {
  const want = u.role === 'GROUP_HEAD' ? ['SUBMITTED'] : u.role === 'DIRECTOR' ? ['REVIEWED']
    : u.role === 'ADMIN' ? ['SUBMITTED', 'REVIEWED'] : [];
  if (!want.length) return [];
  const acts = {};
  readTable_(TABS.ACT).forEach(function (a) { acts[a.activity_id] = a; });
  return readTable_(TABS.REP).filter(function (r) { return want.indexOf(r.workflow_state) >= 0 && acts[r.activity_id]; })
    .map(function (r) {
      const a = acts[r.activity_id];
      return Object.assign(publicReport_(r), {
        no: a.no, name: a.name, value_name: a.value_name, fiscal_year: Number(a.fiscal_year), unit: a.unit,
        target_value: Number(a.target_value)
      });
    }).sort(function (a, b) { return String(a.submitted_at).localeCompare(String(b.submitted_at)); });
}

function apiGetInbox() {
  const u = currentUser_();
  requireRole_(u, ['GROUP_HEAD', 'DIRECTOR', 'ADMIN']);
  return { role: u.role, items: inboxItems_(u) };
}

/** แท็บ "แนวทางการปฏิบัติตน": 4 บทบาท × (พึงกระทำ/ไม่พึงกระทำ) × 6 ค่านิยม */
function parseGuideSheet_(values) {
  const h = values.findIndex(function (r) { return String(r[0]).trim() === 'พึงกระทำ'; });
  if (h < 0) return { roles: [], rows: [] };
  let roleRow = [];
  for (let i = h - 1; i >= 0; i--) { if (String(values[i][0]).trim()) { roleRow = values[i]; break; } }
  const roles = [0, 2, 4, 6].map(function (c) { return String(roleRow[c] || '').trim(); });
  const items = function (s) {
    return String(s || '').split('\n').map(function (x) { return x.replace(/^\s*\d+\.\s*/, '').trim(); }).filter(Boolean);
  };
  const rows = [];
  for (let i = h + 1; i < values.length; i++) {
    const r = values[i];
    if (!r.some(function (x) { return String(x).trim(); })) continue;
    rows.push(roles.map(function (_, k) { return { 'do': items(r[k * 2]), dont: items(r[k * 2 + 1]) }; }));
  }
  return { roles: roles, rows: rows };
}

function apiGetGuidelines() {
  currentUser_();
  const cache = CacheService.getScriptCache();
  const hit = cache.get('guide');
  if (hit) return JSON.parse(hit);
  const g = parseGuideSheet_(readRawSheet_(SOURCE_TABS.GUIDE));
  const s = getSettings_();
  const meta = {};
  readTable_(TABS.ACT).forEach(function (a) {
    if (Number(a.fiscal_year) === s.fy && !meta[a.group_no]) meta[a.group_no] = { value_code: a.value_code, value_name: a.value_name, dimension: a.dimension };
  });
  const out = {
    roles: g.roles,
    groups: g.rows.map(function (cells, i) {
      return Object.assign({ group_no: i + 1 }, meta[i + 1] || { value_code: '', value_name: 'ค่านิยมที่ ' + (i + 1), dimension: '' }, { cells: cells });
    })
  };
  try { cache.put('guide', JSON.stringify(out), 21600); } catch (e) { /* ข้ามได้ */ }
  return out;
}
