/**
 * ค่าคงที่ + utility กลาง (ห้ามใส่ secret — ID ของ Sheet/Folder อยู่ใน Script Properties)
 */
const TZ = 'Asia/Bangkok';

const TABS = {
  ACT: 'cfg_Activities',
  REP: 'tx_Reports',
  EVI: 'tx_Evidence',
  USR: 'cfg_Users',
  SET: 'cfg_Settings',
  AUD: 'log_Audit'
};

/** แท็บเดิม — อ่านอย่างเดียว ห้ามเขียน */
const SOURCE_TABS = { PLAN: 'แผน/ผล', GUIDE: 'แนวทางการปฏิบัติตน' };

const SCHEMA = {
  cfg_Activities: ['activity_id', 'fiscal_year', 'no', 'group_no', 'value_code', 'value_name', 'dimension', 'name',
    'target_group', 'kpi', 'target_value', 'unit', 'measure_type', 'formula_note', 'plan_months', 'owner_unit',
    'owner_emails', 'expected_outcome', 'do_text', 'dont_text', 'active'],
  tx_Reports: ['report_id', 'activity_id', 'period_index', 'actual_value', 'progress_status', 'summary', 'issues',
    'fix_plan', 'eta_date', 'workflow_state', 'reporter_email', 'submitted_at', 'reviewer_email', 'reviewed_at',
    'review_comment', 'approver_email', 'approved_at', 'approve_comment', 'return_comment', 'version',
    'updated_at', 'updated_by'],
  tx_Evidence: ['evidence_id', 'report_id', 'kind', 'name', 'drive_file_id', 'url', 'mime_type', 'size_bytes',
    'uploaded_by', 'uploaded_at', 'deleted'],
  cfg_Users: ['email', 'display_name', 'role', 'unit', 'active'],
  cfg_Settings: ['key', 'value'],
  log_Audit: ['ts', 'actor_email', 'action', 'entity', 'entity_id', 'before_json', 'after_json']
};

const ROLES = ['STAFF', 'GROUP_HEAD', 'DIRECTOR', 'EXEC_VIEWER', 'ADMIN'];
const MEASURE_TYPES = ['PERCENT_LATEST', 'COUNT_CUMULATIVE', 'SCORE'];
const PROGRESS = ['ON_PLAN', 'DELAYED', 'NOT_STARTED'];
const STATES = ['DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'RETURNED'];
const SENT_STATES = ['SUBMITTED', 'REVIEWED', 'APPROVED'];
const STATUS_ORDER = ['DONE', 'ON_TRACK', 'LATE', 'BELOW_TARGET', 'NOT_DUE'];
const MONTHS_TH = ['ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.'];

const DEFAULT_SETTINGS = {
  current_fiscal_year: '2570',
  report_due_day: '5',
  evidence_folder_id: '',
  max_file_mb: '10',
  allowed_ext: 'pdf,docx,xlsx,pptx,jpg,png'
};

const MIME_BY_EXT = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png']
};

function nowIso_() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function todayYmd_() {
  return nowIso_().slice(0, 10);
}

/** โยน error ที่ client parse ได้: {code, message, fields?} */
function fail_(code, message, extra) {
  throw new Error(JSON.stringify(Object.assign({ code: code, message: message }, extra || {})));
}

function toNum_(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function truthy_(v) {
  return v === true || String(v).toUpperCase() === 'TRUE' || String(v) === '1';
}

function splitEmails_(s) {
  return String(s || '').split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
}

function pad2_(n) {
  return (n < 10 ? '0' : '') + n;
}

function getSettings_() {
  const s = Object.assign({}, DEFAULT_SETTINGS);
  readTable_(TABS.SET).forEach(function (r) { if (r.key) s[r.key] = String(r.value); });
  const props = PropertiesService.getScriptProperties();
  return {
    fy: Number(s.current_fiscal_year),
    dueDay: Number(s.report_due_day) || 5,
    folderId: props.getProperty('EVIDENCE_FOLDER_ID') || s.evidence_folder_id || '',
    maxFileMb: Number(s.max_file_mb) || 10,
    allowedExt: String(s.allowed_ext).split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean)
  };
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    fail_('BUSY', 'ระบบกำลังบันทึกข้อมูลของผู้ใช้อื่น กรุณาลองใหม่อีกครั้ง');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function dashCacheKey_(fy) {
  return 'dash:' + fy + ':' + todayYmd_();
}

function invalidate_(fy) {
  try { CacheService.getScriptCache().remove(dashCacheKey_(fy)); } catch (e) { /* cache เป็น best-effort */ }
}
