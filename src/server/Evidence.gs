/**
 * หลักฐานแนบ: ไฟล์ (Drive folder เดียว) หรือ ลิงก์ Drive — ลบแบบ soft delete
 */

function editableReport_(u, reportId) {
  const r = findReport_(reportId);
  if (!r) fail_('NOT_FOUND', 'กรุณาบันทึกร่างรายงานก่อนแนบหลักฐาน');
  const a = getActivity_(r.activity_id);
  if (!canEditActivity_(u, a, r.workflow_state)) fail_('FORBIDDEN', 'ไม่มีสิทธิ์แก้ไขหลักฐานของรายงานนี้');
  return { r: r, a: a };
}

/** @param {{name:string, mimeType:string, base64:string}} file */
function apiUploadEvidence(reportId, file) {
  const u = currentUser_();
  return withLock_(function () {
    editableReport_(u, reportId);
    const s = getSettings_();
    file = file || {};
    const name = String(file.name || '').slice(0, 200);
    const ext = name.indexOf('.') >= 0 ? name.split('.').pop().toLowerCase() : '';
    if (s.allowedExt.indexOf(ext) < 0) fail_('VALIDATION', 'ไม่รองรับไฟล์ประเภท .' + (ext || '?') + ' (รองรับ ' + s.allowedExt.join(', ') + ')');
    const mime = String(file.mimeType || '');
    if ((MIME_BY_EXT[ext] || []).indexOf(mime) < 0) fail_('VALIDATION', 'ประเภทไฟล์ไม่ตรงกับนามสกุล .' + ext);
    const bytes = Utilities.base64Decode(String(file.base64 || ''));
    if (!bytes.length) fail_('VALIDATION', 'ไฟล์ว่างเปล่า');
    if (bytes.length > s.maxFileMb * 1024 * 1024) fail_('VALIDATION', 'ไฟล์ใหญ่เกิน ' + s.maxFileMb + ' MB');
    if (!s.folderId) fail_('SETUP', 'ยังไม่ได้ตั้งค่า EVIDENCE_FOLDER_ID ใน Script Properties');

    const stamp = nowIso_().replace(/[-:T]/g, '').slice(0, 14);
    const blob = Utilities.newBlob(bytes, mime, reportId + '_' + stamp + '.' + ext);
    const f = DriveApp.getFolderById(s.folderId).createFile(blob);
    const row = {
      evidence_id: Utilities.getUuid(), report_id: reportId, kind: 'FILE', name: name, drive_file_id: f.getId(),
      url: f.getUrl(), mime_type: mime, size_bytes: bytes.length, uploaded_by: u.email, uploaded_at: nowIso_(), deleted: 'false'
    };
    insertRow_(TABS.EVI, row);
    writeAudit_(u.email, 'UPLOAD', 'evidence', row.evidence_id, null, row);
    return publicEvidence_(row);
  });
}

/** @param {{name:string, url:string}} link */
function apiAddEvidenceLink(reportId, link) {
  const u = currentUser_();
  return withLock_(function () {
    editableReport_(u, reportId);
    link = link || {};
    const url = String(link.url || '').trim();
    if (!/^https:\/\/(drive|docs)\.google\.com\/[^\s<>"']+$/.test(url) || url.length > 500) {
      fail_('VALIDATION', 'รองรับเฉพาะลิงก์ Google Drive / Docs (https://drive.google.com/…)', { fields: [{ field: 'link', message: 'ลิงก์ไม่ถูกต้อง' }] });
    }
    const row = {
      evidence_id: Utilities.getUuid(), report_id: reportId, kind: 'LINK',
      name: String(link.name || '').trim().slice(0, 200) || 'ลิงก์ Google Drive', drive_file_id: '', url: url,
      mime_type: '', size_bytes: 0, uploaded_by: u.email, uploaded_at: nowIso_(), deleted: 'false'
    };
    insertRow_(TABS.EVI, row);
    writeAudit_(u.email, 'LINK', 'evidence', row.evidence_id, null, row);
    return publicEvidence_(row);
  });
}

function apiDeleteEvidence(evidenceId) {
  const u = currentUser_();
  return withLock_(function () {
    const e = readTable_(TABS.EVI).filter(function (x) { return x.evidence_id === String(evidenceId); })[0];
    if (!e || truthy_(e.deleted)) fail_('NOT_FOUND', 'ไม่พบหลักฐาน');
    editableReport_(u, e.report_id);
    const next = Object.assign({}, e, { deleted: 'true' });
    updateRow_(TABS.EVI, next);
    writeAudit_(u.email, 'DELETE', 'evidence', e.evidence_id, e, next);
    return { ok: true };
  });
}
