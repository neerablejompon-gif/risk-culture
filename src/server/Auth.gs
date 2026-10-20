/**
 * ตรวจตัวตน/สิทธิ์ — เรียกในทุก api* endpoint
 */
function currentUser_() {
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) {
    fail_('AUTH', 'ระบบระบุบัญชีผู้ใช้ไม่ได้ — ต้องเข้าด้วยบัญชีในโดเมนเดียวกับผู้ deploy');
  }
  const u = readTable_(TABS.USR).filter(function (x) {
    return String(x.email).toLowerCase() === email && truthy_(x.active);
  })[0];
  if (!u) fail_('FORBIDDEN', 'บัญชี ' + email + ' ยังไม่ได้รับสิทธิ์ใช้งานระบบ กรุณาติดต่อผู้ดูแล (กบค.)');
  if (ROLES.indexOf(u.role) < 0) fail_('FORBIDDEN', 'บทบาทของบัญชีนี้ไม่ถูกต้อง: ' + u.role);
  return { email: email, display_name: u.display_name || email.split('@')[0], role: u.role, unit: u.unit || '' };
}

function requireRole_(u, roles) {
  if (roles.indexOf(u.role) < 0) fail_('FORBIDDEN', 'บทบาท ' + u.role + ' ไม่มีสิทธิ์ทำรายการนี้');
}

function isOwner_(u, act) {
  return splitEmails_(act.owner_emails).indexOf(u.email) >= 0;
}

/** สิทธิ์แก้ไขกิจกรรม (ใช้ทั้งรายงานและหลักฐาน) */
function canEditActivity_(u, act, state) {
  return canEditReport(state, u.role, isOwner_(u, act));
}
