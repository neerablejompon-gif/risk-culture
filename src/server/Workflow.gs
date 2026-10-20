/**
 * Pure: กฎ workflow อนุมัติ 3 ระดับ (SPEC 5.4 + 6)
 * DRAFT/RETURNED --submit--> SUBMITTED --review--> REVIEWED --approve--> APPROVED
 * return (ต้องมี comment) จาก SUBMITTED (GROUP_HEAD) หรือ REVIEWED (DIRECTOR) → RETURNED
 * reopen (ADMIN, ต้องมี comment) จาก APPROVED → RETURNED
 */
const WF = {
  submit: { from: ['DRAFT', 'RETURNED'], to: 'SUBMITTED', roles: ['STAFF', 'GROUP_HEAD', 'ADMIN'], comment: false },
  review: { from: ['SUBMITTED'], to: 'REVIEWED', roles: ['GROUP_HEAD', 'ADMIN'], comment: false },
  approve: { from: ['REVIEWED'], to: 'APPROVED', roles: ['DIRECTOR', 'ADMIN'], comment: false },
  'return': { from: ['SUBMITTED', 'REVIEWED'], to: 'RETURNED', roles: null, comment: true },
  reopen: { from: ['APPROVED'], to: 'RETURNED', roles: ['ADMIN'], comment: true }
};

const RETURN_ROLES = { SUBMITTED: ['GROUP_HEAD', 'ADMIN'], REVIEWED: ['DIRECTOR', 'ADMIN'] };

const ACTION_LABEL = {
  submit: 'ส่งรายงาน', review: 'ผ่านการตรวจ', approve: 'อนุมัติ', 'return': 'ส่งกลับแก้ไข', reopen: 'เปิดแก้ไขใหม่'
};

/** STAFF แก้/ส่งได้เฉพาะกิจกรรมที่ตนอยู่ใน owner_emails */
function canEditReport(state, role, isOwner) {
  const st = state || 'DRAFT';
  if (st !== 'DRAFT' && st !== 'RETURNED') return false;
  return role === 'ADMIN' || role === 'GROUP_HEAD' || (role === 'STAFF' && !!isOwner);
}

function canTransition(action, state, role, isOwner) {
  const rule = WF[action];
  if (!rule) return false;
  const st = state || 'DRAFT';
  if (rule.from.indexOf(st) < 0) return false;
  const roles = action === 'return' ? RETURN_ROLES[st] : rule.roles;
  if (!roles || roles.indexOf(role) < 0) return false;
  if (action === 'submit' && role === 'STAFF' && !isOwner) return false;
  return true;
}

function allowedActions(state, role, isOwner) {
  return Object.keys(WF).filter(function (a) { return canTransition(a, state, role, isOwner); });
}
