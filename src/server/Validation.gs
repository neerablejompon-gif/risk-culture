/**
 * Pure: ตรวจข้อมูลรายงานฝั่ง server (client ตรวจซ้ำเพื่อ UX แต่ server คือผู้ตัดสิน)
 * mode 'draft' = ตรวจชนิด/ความยาวเท่านั้น, 'submit' = ตรวจ required ตามเงื่อนไขด้วย
 */
const TEXT_LIMITS = { summary: 1000, issues: 2000, fix_plan: 2000 };

function isValidYmd(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * @param {Object} f ข้อมูลจากฟอร์ม
 * @param {{measureType:string, prevValue:?number, mode:string}} ctx
 * @return {{errors:Array<{field:string,message:string}>, clean:Object}}
 */
function validateReport(f, ctx) {
  f = f || {};
  const errors = [];
  const seen = {};
  const add = function (field, message) {
    if (seen[field]) return;
    seen[field] = true;
    errors.push({ field: field, message: message });
  };
  const clean = {};

  const raw = f.actual_value;
  if (raw === '' || raw == null) {
    clean.actual_value = '';
  } else {
    const n = Number(raw);
    if (!isFinite(n)) add('actual_value', 'ผลต้องเป็นตัวเลข');
    else if (n < 0) add('actual_value', 'ผลต้องไม่ติดลบ');
    else if (ctx.measureType === 'PERCENT_LATEST' && n > 100) add('actual_value', 'ค่าร้อยละต้องไม่เกิน 100');
    else if (ctx.measureType === 'COUNT_CUMULATIVE' && ctx.prevValue != null && n < ctx.prevValue) {
      add('actual_value', 'ยอดสะสมต้องไม่น้อยกว่ารอบก่อนที่อนุมัติแล้ว (' + ctx.prevValue + ')');
    }
    clean.actual_value = isFinite(n) ? String(n) : '';
  }

  const ps = String(f.progress_status || '');
  if (ps && PROGRESS.indexOf(ps) < 0) add('progress_status', 'สถานะการดำเนินงานไม่ถูกต้อง');
  clean.progress_status = PROGRESS.indexOf(ps) >= 0 ? ps : '';

  Object.keys(TEXT_LIMITS).forEach(function (k) {
    const v = String(f[k] == null ? '' : f[k]).trim();
    if (v.length > TEXT_LIMITS[k]) add(k, 'ความยาวต้องไม่เกิน ' + TEXT_LIMITS[k].toLocaleString() + ' ตัวอักษร');
    clean[k] = v.slice(0, TEXT_LIMITS[k]);
  });

  const eta = String(f.eta_date || '').trim();
  if (eta && !isValidYmd(eta)) add('eta_date', 'รูปแบบวันที่ไม่ถูกต้อง');
  clean.eta_date = eta && isValidYmd(eta) ? eta : '';

  if (ctx.mode === 'submit') {
    if (!clean.progress_status) add('progress_status', 'กรุณาเลือกสถานะการดำเนินงาน');
    if (clean.actual_value === '' && clean.progress_status !== 'NOT_STARTED') add('actual_value', 'กรุณากรอกผลการดำเนินงาน');
    if (!clean.summary) add('summary', 'กรุณาสรุปผลการดำเนินงาน');
    if ((clean.progress_status === 'DELAYED' || clean.progress_status === 'NOT_STARTED') && !clean.issues) {
      add('issues', 'กรุณาระบุปัญหา/อุปสรรค');
    }
    if (clean.progress_status === 'DELAYED' && !clean.eta_date) add('eta_date', 'กรุณาระบุวันที่คาดว่าจะแล้วเสร็จ');
  }
  return { errors: errors, clean: clean };
}
