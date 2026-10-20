# CLAUDE.md — Risk Culture Tracker (กยท.)

อ่าน `docs/SPEC.md` และ `README.md` (หัวข้อ "การตีความที่ต้องยืนยัน") ก่อนเริ่มงานทุกครั้ง

## Stack
Google Apps Script (V8) + HTML Service + vanilla JS · Google Sheets เป็น DB · ไม่มี build step
deploy ด้วย clasp (`rootDir: src`) · dev/test ใน Node 18+

## Commands
- `npm test` — unit (`src/server/Tests.gs`) + integration (`tests/integration.js`) ใน Node vm. **ต้องผ่านก่อนบอกว่าเสร็จ**
- `npm run preview` — สร้าง `dist/preview.html` (backend จำลองในเบราว์เซอร์, แถบ DEV สลับผู้ใช้/วันที่)
- `npm run screenshots` — ตรวจ UI ทุกหน้า (ต้องติดตั้ง playwright) ต้องไม่มี JS error / horizontal scroll
- `npm run push` / `npm run deploy` — ส่งขึ้น Apps Script (ต้อง `clasp login` ก่อน)

## Rules (ห้ามละเมิด)
1. **ห้ามเขียนแท็บเดิม** ใน Sheet (`แผน/ผล`, `แนวทางการปฏิบัติตน`, `แผนปรับปรุง 2570`) — อ่านผ่าน `readRawSheet_` เท่านั้น
2. ทุก `api*` endpoint เรียก `currentUser_()` แล้วตรวจ role/ownership ฝั่ง server; ฟังก์ชันภายในลงท้ายด้วย `_`
3. ทุกการเขียน: `withLock_` + ตรวจ `version` + `writeAudit_`; ล้าง cache ด้วย `invalidate_(fy)`
4. ห้าม `innerHTML`/`insertAdjacentHTML` กับข้อมูล — ใช้ `UI.h()` / `UI.fill()` / `textContent`
5. ผลตัวชี้วัดนับเฉพาะรายงาน `APPROVED`
6. วันที่แสดงเป็น พ.ศ. ผ่าน `UI.fmtDate` เท่านั้น; ฝั่ง server ใช้สตริง `YYYY-MM-DD` (ค.ศ. เวลาไทย)
7. สถานะต้องมีสัญลักษณ์ + ข้อความ ไม่ใช้สีอย่างเดียว; ใช้ token สีใน `Styles.html` (`:root`)
8. ข้อที่ spec ระบุ **[OPEN]** หรืออยู่ในตาราง "การตีความ" — ถามผู้ใช้ก่อนเปลี่ยน อย่าเดา
9. แก้ business rule → แก้ pure function (`Status/Workflow/Validation.gs`) + เพิ่ม test ใน `Tests.gs`; client มี validation ซ้ำใน `views/Report.html` ต้องแก้ให้ตรงกัน
10. เพิ่มคอลัมน์ → แก้ `SCHEMA` ใน `Config.gs` ต่อท้ายเท่านั้น (ห้ามสลับลำดับ — `ensureTable_` ตรวจ header) และบันทึกใน README

## Architecture
- `src/server/*.gs` โหลดเป็น global scope เดียวกัน (ทั้งใน Apps Script และ Node vm / preview)
- `dev/shim.js` แทน `Repo.gs` + services ของ Google (ฟังก์ชันชื่อเดียวกัน) — ถ้าเพิ่มการเรียก service ใหม่ ต้องเพิ่ม stub ใน shim ด้วย
- Client: `App.js.html` = shell/routing/`UI` helpers; `views/*.html` แต่ละหน้า register `window.Views.<page>`; routing ด้วย `?page=` ผ่าน `google.script.history`
- Error จาก server: `fail_(code, message, {fields})` → client ได้ `{code, message, fields}`; code: AUTH, FORBIDDEN, VALIDATION, CONFLICT, NOT_FOUND, SETUP, BUSY

## Status
Phase 1–4 เขียนครบและผ่าน test ใน Node/preview แต่**ยังไม่เคยรันบน Apps Script จริง** — งานถัดไป: Phase 0 (ยืนยัน OPEN) แล้ว deploy + ทดสอบด้วยบัญชีจริง 3 บทบาท (STAFF / GROUP_HEAD / DIRECTOR)
เมื่อรายงานผลการทำงาน ให้แยก "ทดสอบแล้ว" กับ "ยังไม่ได้ทดสอบ" เสมอ (SPEC §12)
