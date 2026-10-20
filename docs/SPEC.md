# ระบบติดตามและรายงานผล แผนปฏิบัติการเสริมสร้างค่านิยมและวัฒนธรรมความเสี่ยง กยท. ปี 2570

> Spec สำหรับ Claude Code · เวอร์ชัน 0.1 (19 ต.ค. 2569) · เจ้าของ: Jom (กบค.)
> Design reference (Design canvas, private): https://claude.ai/artifact/PHsEf2RxjyYDRbWsyzatvs
> Source data: Google Sheet `1XZZQlqbgt8VAwV5PrF3rGJx62C3nL_c3_I7TwlnU1Uc`

---

## 0. วิธีใช้ไฟล์นี้กับ Claude Code

- วางไฟล์นี้ที่ `docs/SPEC.md` ใน repo และอ้างจาก `CLAUDE.md` ("อ่าน docs/SPEC.md ก่อนเริ่มงานทุกครั้ง")
- ทำงานตาม **Phase ในหัวข้อ 11** ทีละ phase ห้ามข้าม และหยุดให้ผู้ใช้ตรวจหลังจบแต่ละ phase
- **ห้ามแก้ไขแท็บเดิมใน Google Sheet** (`แผนปรับปรุง 2570`, `Sheet1`, `แนวทางการปฏิบัติตน`) ให้สร้างแท็บใหม่ตามหัวข้อ 4 เท่านั้น
- ข้อที่ระบุว่า **[OPEN]** ต้องถามผู้ใช้ก่อนตัดสินใจ อย่าเดา

---

## 1. Objective

| | |
|---|---|
| **Problem** | แผนปฏิบัติการ 18 กิจกรรมอยู่ใน Sheet แบบตารางแผน ไม่มีที่บันทึกผลรายเดือน ไม่มีการอนุมัติ และผู้บริหารไม่เห็นภาพรวมแบบ real-time |
| **Goal** | ให้ผู้รับผิดชอบรายงานผลรายเดือนได้ง่าย (รวมบนมือถือ) ผ่านการตรวจ/อนุมัติ 3 ระดับ และให้ผู้บริหารเห็นสถานะทั้งแผนในหน้าเดียว |
| **Users** | < 20 คน ภายใน ฝยศ./กบค. + ผู้ประสานงานส่วนงาน |
| **KPI ของระบบ** | ส่งรายงานตรงเวลา ≥ 90% · ผู้บริหารเปิด Dashboard แทนการขอรายงานทางไลน์/อีเมล · ข้อมูลผลทุกตัวมี audit trail |

## 2. Platform & Constraints

- **Google Apps Script Web App + Google Sheets เป็นฐานข้อมูล** (ให้สอดคล้องกับระบบมอบหมายงาน กบค. และระบบ SIPOC ที่มีอยู่ เพื่อรวมกันในอนาคต)
- Deploy: Execute as **User accessing the web app**, Access: **Anyone within domain** (ถ้าใช้ Google Workspace ขององค์กร) — [OPEN] ยืนยันโดเมนและบัญชีที่ใช้
- หลักฐานแนบเก็บใน Google Drive folder เดียว (สิทธิ์จำกัดเฉพาะผู้ใช้ระบบ)
- ปีงบประมาณ: **ต.ค. – ก.ย.** แสดงผลเป็น **พ.ศ.** ทั้งระบบ
- ภาษา UI: ไทย (ศัพท์เทคนิคอังกฤษได้)
- ไม่มี build step ที่ซับซ้อน: HTML Service + vanilla JS (หรือ Alpine.js จาก CDN ถ้าจำเป็น) + CSS variables

## 3. Domain Model (จากข้อมูลจริงใน Sheet1)

### 3.1 ค่านิยม RUBBER × มิติ Risk Culture

| Group | ค่านิยม | มิติ Risk Culture | กิจกรรม |
|---|---|---|---|
| 1 | R – Rules | R – Risk awareness | 1.1, 1.2, 1.3 |
| 2 | U – Unity | U – Understand impact | 2.1, 2.2, 2.3 |
| 3 | B – Be Innovative | B – Be proactive | 3.1, 3.2, 3.3 |
| 4 | B – Beyond Service | B – Build accountability | 4.1, 4.2, 4.3 |
| 5 | E – Expertise | E – Embed in process | 5.1, 5.2, 5.3 |
| 6 | R – Responsibility | R – Review & Improve | 6.1, 6.2, 6.3 |

> **[OPEN] Data issue #1:** ใน `Sheet1` เนื้อหากิจกรรมหมวด 5 (สำรวจ/ประเมิน/ทบทวน) เข้ากับ "Review & Improve" และหมวด 6 (เชื่อมแผน/แบบคำขอ/จุดควบคุม) เข้ากับ "Embed in process" มากกว่า — แท็บ `แผนปรับปรุง 2570` จัดไว้กลับกัน ให้ระบบอ่าน mapping จาก config (ไม่ hardcode) และรอผู้ใช้ยืนยัน

### 3.2 กิจกรรมทั้ง 18 รายการ (ค่าเป้าหมายและเดือนตามแผนจาก Sheet1)

`plan_months` = 12 ตัวอักษร เรียง ต.ค.→ก.ย. (`1` = มีแผนเดือนนั้น)

| ID | ตัวชี้วัด (ย่อ) | เป้า | หน่วย | measure_type | plan_months |
|---|---|---|---|---|---|
| 1.1 | ระดับการรับรู้สารสำคัญด้านความเสี่ยงและ Do & Don't | 85 | ร้อยละ | PERCENT_LATEST | 111111111111 |
| 1.2 | ผู้เรียนผ่านเกณฑ์ทดสอบหลังเรียน | 80 | ร้อยละ | PERCENT_LATEST | 011100000000 |
| 1.3 | จำนวนรอบการสื่อสารความเสี่ยงโดยผู้นำ | 4 | ครั้ง/ปี | COUNT_CUMULATIVE | 001001001001 |
| 2.1 | ผู้เข้าร่วมผ่านเกณฑ์ประเมินความรู้ความเข้าใจ | 80 | ร้อยละ | PERCENT_LATEST | 000110000000 |
| 2.2 | รายงานผลการบริหารความเสี่ยงที่นำเสนอเพื่อใช้ตัดสินใจ | 4 | ครั้ง/ปี | COUNT_CUMULATIVE | 001001001001 |
| 2.3 | รายงานการซ้อมแผน BCP | 1 | ฉบับ | COUNT_CUMULATIVE | 000000011100 |
| 3.1 | รายงานปรับปรุงแผนจัดการความเสี่ยงและมาตรการ IC | 2 | ครั้ง/ปี | COUNT_CUMULATIVE | 010000010000 |
| 3.2 | รายงานผล Early Warning System (EWS) | 12 | ครั้ง/ปี | COUNT_CUMULATIVE | 111111111111 |
| 3.3 | แนวคิดลดความเสี่ยงที่นำไปทดลอง/ใช้จริง | 1 | ผลงาน | COUNT_CUMULATIVE | 000011111100 |
| 4.1 | ความเสี่ยงสำคัญที่ระบุ Risk Owner/ผู้รับผิดชอบ Action | 100 | ร้อยละ | PERCENT_LATEST | 110000000000 |
| 4.2 | Risk Owner ส่งรายงาน/ติดตามผลตรงเวลา | 90 | ร้อยละ | PERCENT_LATEST | 001111001001 |
| 4.3 | ข้อหารือที่ตอบ/สนับสนุนภายใน SLA | 90 | ร้อยละ | PERCENT_LATEST | 111111111111 |
| 5.1 | ผลสำรวจทัศนคติ RM/IC เพิ่มขึ้นจากปีก่อน ไม่น้อยกว่า | 10 | ร้อยละ | PERCENT_LATEST | 000000000011 |
| 5.2 | รายงานผลการประเมินประสิทธิผลฯ | 1 | ฉบับ | COUNT_CUMULATIVE | 001001001001 |
| 5.3 | ส่วนงานที่ผ่านเกณฑ์หรือมีผลดีขึ้นจากรอบก่อน | 80 | ร้อยละ | PERCENT_LATEST | 001001001001 |
| 6.1 | ส่วนงาน/โครงการที่เชื่อม Action Plan กับแผน RM | 100 | ร้อยละ | PERCENT_LATEST | 111000000000 |
| 6.2 | แบบคำขอ ฝยศ.1 ถูกต้องครบถ้วน | 100 | ร้อยละ | PERCENT_LATEST | 000111111111 |
| 6.3 | กระบวนการสำคัญที่ระบุ Control Point และผู้รับผิดชอบ | 80 | ร้อยละ | PERCENT_LATEST | 000111111000 |

> **[OPEN] Data issue #2:** ตัวชี้วัด 5.1 "เพิ่มขึ้น ไม่น้อยกว่า 10 ร้อยละ" — เป็น percentage point หรือ relative %? ต้องระบุสูตรใน `formula_note` ก่อนคำนวณ
> **[OPEN] Data issue #3:** `measure_type` ข้างบนเป็นข้อเสนอ ต้องให้ผู้ใช้ยืนยัน โดยเฉพาะ 4.2/4.3 (ค่าล่าสุด หรือ ค่าเฉลี่ยสะสม?)

## 4. Data Schema (แท็บใหม่ใน Sheet เดิม)

ทุกแท็บ: แถวที่ 1 = header (ภาษาอังกฤษ snake_case), ID เป็น string, timestamp เก็บเป็น ISO 8601 (UTC+7) แสดงผลเป็น พ.ศ.

### `cfg_Activities` — 1 แถว/กิจกรรม/ปีงบ (seed จาก Sheet1 ด้วย script ครั้งเดียว)
| column | type | note |
|---|---|---|
| activity_id | string | `2570-2.2` (fy-no) PK |
| fiscal_year | number | 2570 |
| no | string | `2.2` |
| group_no | number | 1–6 |
| value_code / value_name | string | `U` / `Unity` |
| dimension | string | `Understand impact` |
| name | string | ชื่อโครงการ/กิจกรรม |
| target_group | string | |
| kpi | string | |
| target_value | number | |
| unit | string | |
| measure_type | enum | `PERCENT_LATEST` \| `COUNT_CUMULATIVE` \| `SCORE` |
| formula_note | string | วิธีคำนวณ (ถ้ามี) |
| plan_months | string(12) | `001001001001` |
| owner_unit | string | ผู้รับผิดชอบตาม Sheet |
| owner_emails | string | คั่นด้วย `,` — คนที่มีสิทธิ์รายงาน |
| expected_outcome | string | ผลลัพธ์เชิงพฤติกรรมที่คาดหวัง |
| do_text / dont_text | string | คงรูปแบบ `บทบาท: ข้อความ\n` จาก Sheet |
| active | boolean | |

### `tx_Reports` — 1 แถว/กิจกรรม/รอบเดือน
| column | type | note |
|---|---|---|
| report_id | string | `2570-2.2-06` PK (06 = เดือนที่ 6 ของปีงบ = มี.ค.) |
| activity_id | string | FK |
| period_index | number | 1–12 (ต.ค.=1) |
| actual_value | number \| blank | ผลสะสม/ผลล่าสุดตาม measure_type |
| progress_status | enum | `ON_PLAN` \| `DELAYED` \| `NOT_STARTED` |
| summary | string | ≤ 1,000 ตัวอักษร, required |
| issues | string | required ถ้า `DELAYED` หรือ `NOT_STARTED` |
| fix_plan | string | |
| eta_date | date | required ถ้า `DELAYED` |
| workflow_state | enum | `DRAFT` \| `SUBMITTED` \| `REVIEWED` \| `APPROVED` \| `RETURNED` |
| reporter_email, submitted_at | | |
| reviewer_email, reviewed_at, review_comment | | |
| approver_email, approved_at, approve_comment | | |
| version | number | optimistic locking |
| updated_at, updated_by | | |

### `tx_Evidence`
`evidence_id, report_id, kind (FILE|LINK), name, drive_file_id, url, mime_type, size_bytes, uploaded_by, uploaded_at, deleted (bool)`

### `cfg_Users`
`email (PK), display_name, role (STAFF|GROUP_HEAD|DIRECTOR|EXEC_VIEWER|ADMIN), unit, active`

### `cfg_Settings`
key/value: `current_fiscal_year=2570`, `report_due_day=5`, `evidence_folder_id`, `max_file_mb=10`, `allowed_ext=pdf,docx,xlsx,pptx,jpg,png`

### `log_Audit` (append-only)
`ts, actor_email, action, entity, entity_id, before_json, after_json`

## 5. Business Rules

### 5.1 รอบรายงานและกำหนดส่ง
- รอบรายงาน = เดือนที่ `plan_months` เป็น `1`
- กำหนดส่ง = วันที่ `report_due_day` (5) ของเดือนถัดไป
- `period_index`: ต.ค.=1 … ก.ย.=12; ปีปฏิทินของเดือน ต.ค.–ธ.ค. = fiscal_year − 1 (พ.ศ.)

### 5.2 ผลที่นับเข้าตัวชี้วัด
- **นับเฉพาะรายงานที่ `APPROVED` เท่านั้น**
- `COUNT_CUMULATIVE` → ใช้ `actual_value` ของรอบล่าสุดที่อนุมัติ (ผู้รายงานกรอกยอดสะสม) — validate ว่าไม่ลดลงจากรอบก่อน
- `PERCENT_LATEST` → ใช้ค่าของรอบล่าสุดที่อนุมัติ
- progress % = `min(actual / target, 1)`

### 5.3 สถานะกิจกรรม (คำนวณฝั่ง server ไม่เก็บใน Sheet)
ประเมินตามลำดับ ตัวแรกที่เป็นจริงคือสถานะ:
1. **ล่าช้า (LATE)** — มีรอบที่เลยกำหนดส่งแล้ว แต่ `workflow_state` ยังเป็น `DRAFT`/`RETURNED`/ไม่มีรายงาน **หรือ** รายงานล่าสุดเลือก `DELAYED`
2. **ต่ำกว่าเป้า (BELOW_TARGET)** — รอบตามแผนสุดท้ายผ่านไปแล้ว และค่าที่อนุมัติ < target
3. **เสร็จสิ้น (DONE)** — ค่าที่อนุมัติ ≥ target และรอบตามแผนสุดท้ายอนุมัติแล้ว
4. **ยังไม่ถึงกำหนด (NOT_DUE)** — ยังไม่มีรอบตามแผนใดถึงเดือนปัจจุบัน
5. **ตามแผน (ON_TRACK)** — กรณีอื่นทั้งหมด

ต้องมี unit test ของฟังก์ชันนี้ครอบคลุมทั้ง 5 สถานะ + edge case (ไม่มีรายงานเลย, รายงานถูก RETURNED, ข้ามปีงบ)

### 5.4 Workflow อนุมัติ
```
DRAFT --submit(STAFF)--> SUBMITTED --review(GROUP_HEAD)--> REVIEWED --approve(DIRECTOR)--> APPROVED
   ^                         |                                 |
   +------return(+comment)---+---------------------------------+   (RETURNED → แก้ไขแล้ว submit ใหม่)
```
- return ต้องมี comment
- `APPROVED` แก้ไม่ได้ ยกเว้น ADMIN "reopen" พร้อมเหตุผล (บันทึก audit)
- ทุก transition เขียน `log_Audit`

## 6. Roles & Permissions (enforce ฝั่ง server ทุก call)

| Action | STAFF | GROUP_HEAD | DIRECTOR | EXEC_VIEWER | ADMIN |
|---|---|---|---|---|---|
| ดู Dashboard / รายการกิจกรรม | ✓ | ✓ | ✓ | ✓ | ✓ |
| สร้าง/แก้รายงาน (DRAFT/RETURNED) | ✓ เฉพาะกิจกรรมที่ตนอยู่ใน owner_emails | ✓ | – | – | ✓ |
| Submit | ✓ (ของตน) | ✓ | – | – | ✓ |
| Review / Return | – | ✓ | – | – | ✓ |
| Approve / Return | – | – | ✓ | – | ✓ |
| แก้ cfg_* / Reopen | – | – | – | – | ✓ |
| Export | ✓ | ✓ | ✓ | ✓ | ✓ |

[OPEN] ยืนยันว่ามี EXEC_VIEWER (ผู้บริหารระดับสูง) หรือไม่ และหัวหน้ากลุ่มงานแต่ละคนดูแลกิจกรรมใดบ้าง

## 7. Screens (ตาม Design canvas)

### 7.1 Dashboard ภาพรวม (`?page=dashboard`, default)
- Header: ปีงบประมาณ (select), "ข้อมูล ณ <วันที่ พ.ศ.>", ปุ่ม `ส่งออกรายงาน`, ปุ่มหลัก `รายงานผลรอบนี้`
- KPI 4 ใบ: กิจกรรมทั้งหมด · เสร็จสิ้น/ตามแผน (x / จำนวนที่เริ่มแล้ว) · ต้องติดตาม (ล่าช้า + ต่ำกว่าเป้า) · ส่งรายงานรอบล่าสุด (x / y + progress bar)
- Stacked bar สถานะ 18 กิจกรรม + legend มีตัวเลข
- การ์ด 6 ค่านิยม RUBBER: ตัวอักษร, ชื่อค่านิยม, มิติ, mini bar ตามสถานะ, สรุปข้อความ → คลิกไปหน้ากิจกรรมพร้อม filter
- รายการ "ต้องติดตาม" (เรียง: ล่าช้ามากสุดก่อน)
- กราฟแท่ง "การส่งรายงานรายเดือน" (ส่งตรงเวลา / ถึงรอบ) + แถบแจ้งรอบถัดไป

### 7.2 แผนและกิจกรรม (`?page=activities`)
- Filter: ค้นหา (ชื่อ/ตัวชี้วัด/ผู้รับผิดชอบ), สถานะ, ผู้รับผิดชอบ, chips ค่านิยม (`aria-pressed`)
- ตารางจัดกลุ่มตามค่านิยม: ลำดับ · ชื่อ + กลุ่มเป้าหมาย + ผู้รับผิดชอบ · ตัวชี้วัด · ผล/เป้า + progress · ปฏิทิน 12 เดือน · สถานะ
- ปฏิทิน: ส่งแล้ว (เขียวทึบ) · ถึงรอบแต่ยังไม่ส่ง (เหลืองขอบส้ม) · แผนอนาคต (ขอบเขียวอ่อน) · ไม่มีแผน (เส้นเทา) · เดือนปัจจุบันมี outline
- ตารางกว้าง → อยู่ใน container `overflow-x: auto`; ใช้ `role=table/row/cell` หรือ `<table>` จริง
- Empty state เมื่อค้นหาไม่พบ + ปุ่ม `ล้างตัวกรองทั้งหมด`

### 7.3 รายละเอียดกิจกรรม + รายงานผล (`?page=report&id=2570-2.2&period=6`)
- Header: badge ค่านิยม, เลขกิจกรรม, สถานะ, ชื่อ, กลุ่มเป้าหมาย/ผู้รับผิดชอบ, 3 ช่องสรุป (เป้า · ผลสะสมที่อนุมัติ · %)
- ฟอร์ม: รอบรายงาน (readonly + กำหนดส่ง) · ผลสะสม (number + หน่วย) · สถานะ (radio card 3 ตัวเลือก) · สรุปผล (นับตัวอักษร) · ปัญหา/อุปสรรค (required ตามเงื่อนไข) · แนวทางแก้ไข · วันที่คาดว่าเสร็จ (พ.ศ.) · หลักฐาน (dropzone + ลิงก์ Drive + รายการไฟล์พร้อมสถานะ)
- Error summary ด้านบนฟอร์ม (`role=alert`) ลิงก์ไปยังช่องที่ผิด; ช่องผิดมี `aria-invalid` + ข้อความ + ไอคอน
- ปุ่ม: `ยกเลิก` · `บันทึกร่าง` · `ส่งให้หัวหน้ากลุ่มงานตรวจ` (disabled จนกว่าผ่าน validation)
- Auto-save draft ทุก 30 วินาที + toast "บันทึกร่างอัตโนมัติแล้ว · HH:mm น."
- Sidebar: ขั้นตอนอนุมัติ 3 ขั้น (who/when) · ประวัติรายงานตามรอบ + comment ล่าสุด · พฤติกรรมที่คาดหวัง Do/Don't แยกบทบาท (`<details>`)
- ผู้ตรวจ/ผู้อนุมัติเห็นหน้าเดียวกันแบบ readonly + ปุ่ม `ส่งกลับแก้ไข` (บังคับ comment) / `ผ่านการตรวจ` / `อนุมัติ`

### 7.4 Mobile — งานของฉัน (≤ 480px)
- Header ทักทาย + ปุ่มแจ้งเตือน
- การ์ดรอบรายงานปัจจุบัน (ส่งแล้ว x/y)
- Segmented: ต้องส่ง · รอตรวจ · เสร็จ
- การ์ดงาน: เลขกิจกรรม/ค่านิยม, สถานะ, ชื่อ, ผล/เป้า, กำหนดส่ง, CTA ขนาด 44px
- Bottom nav 4 เมนู: ภาพรวม · งานของฉัน · กิจกรรม · Do & Don't

### 7.5 หน้าอื่น (Phase 3)
- รออนุมัติ (inbox ของ GROUP_HEAD/DIRECTOR)
- แนวทาง Do & Don't (จากแท็บ `แนวทางการปฏิบัติตน` 4 บทบาท × 6 ค่านิยม)
- ส่งออกรายงานผู้บริหาร (Google Sheet/PDF สรุปรายไตรมาส)

## 8. Design System

**Direction:** Glassmorphism แบบพอดี · เขียว-ขาว · Corporate Premium × Modern Minimal — การ์ดขาวโปร่งแสง blur บนพื้นเขียวมิ้นต์อ่อน, accent เขียวสีเดียว

```css
:root{
  /* Brand */
  --brand-600:#0F7A4A; --brand-700:#0B6B41; --brand-800:#0B5C37;
  --brand-50:#E3F4EA;  --brand-25:#E8F6EE;
  /* Text */
  --text:#0F2A1F; --text-2:#2E4A3D; --text-muted:#3F5A4D;
  /* Surfaces */
  --bg:#F4FAF6;
  --glass-bg:rgba(255,255,255,.64); --glass-border:rgba(255,255,255,.8);
  --glass-blur:blur(18px) saturate(150%);
  --line:rgba(15,42,31,.10); --field-border:rgba(15,42,31,.16);
  /* Status (bg / fg / chart) */
  --done-bg:#DDF1E6; --done-fg:#0B5C37; --done-c:#0B6B41;
  --ok-bg:#E8F6EE;   --ok-fg:#14653F;   --ok-c:#74C99B;
  --late-bg:#FDECC8; --late-fg:#7A4100; --late-c:#E0912A; --late-ring:#C26A00;
  --risk-bg:#FDE3D6; --risk-fg:#9A2B06; --risk-c:#C2410C;
  --na-bg:#ECF0EE;   --na-fg:#3F5A4D;   --na-c:#CDD8D2;
  --info-bg:#E7EEF9; --info-fg:#1E4A85;
  --error:#B42318; --error-bg:#FFF1EC;
  /* Shape & elevation */
  --r-sm:10px; --r-md:12px; --r-lg:16px; --r-full:999px;
  --shadow:0 1px 2px rgba(12,64,40,.05),0 10px 30px rgba(12,64,40,.07);
  --shadow-cta:0 6px 16px rgba(15,122,74,.25);
}
body{
  font-family:'IBM Plex Sans Thai',sans-serif; font-size:15px; line-height:1.65; color:var(--text);
  background:
    radial-gradient(1100px 620px at 8% -10%,#CDEEDB 0%,transparent 60%),
    radial-gradient(900px 560px at 100% 10%,#DFF3E8 0%,transparent 60%),
    radial-gradient(800px 600px at 60% 110%,#D3EEDF 0%,transparent 60%),
    var(--bg);
}
.glass{background:var(--glass-bg);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);
  border:1px solid var(--glass-border);box-shadow:var(--shadow);border-radius:var(--r-lg)}
@supports not (backdrop-filter:blur(1px)){ .glass{background:rgba(255,255,255,.92)} }
```

- **Font:** IBM Plex Sans Thai 400/500/600/700 (Google Fonts) · ตัวเลขใช้ `font-variant-numeric: tabular-nums`
- **Type scale:** 12 · 13 · 14 · 15 (body) · 18 (section) · 20/22 · 26/30 (page title) · 36 (KPI)
- **Spacing:** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48
- **Status chip:** ไอคอน/สัญลักษณ์ + ข้อความเสมอ (`✓ เสร็จสิ้น`, `● ตามแผน`, `! ล่าช้า`, `▼ ต่ำกว่าเป้า`, `○ ยังไม่ถึงกำหนด`) — ห้ามใช้สีอย่างเดียว
- **Icons:** Lucide stroke 1.8 · ห้ามใช้ emoji เป็นไอคอน
- **Buttons:** สูง 40px (desktop) / 44px (mobile, ฟอร์ม) · primary เขียวทึบ, ghost ขาวโปร่ง · disabled `#A9C9B8`
- **Focus:** `outline: 2px solid var(--brand-600); outline-offset: 2px` บนทุก interactive element
- **Layout:** sidebar 240–280px + content (flex-wrap) · content max-width ~1240px สำหรับหน้าฟอร์ม · ไม่มี horizontal scroll ระดับหน้า
- **Motion:** 150–200ms ease-out · เคารพ `prefers-reduced-motion`
- **วันที่:** `Intl.DateTimeFormat('th-TH-u-ca-buddhist',{day:'numeric',month:'short',year:'numeric'})` → `10 เม.ย. 2570`

## 9. Non-functional Requirements

**Security**
- ทุก `google.script.run` endpoint: ตรวจ `Session.getActiveUser().getEmail()` กับ `cfg_Users` + ตรวจ role/ownership ก่อนทำงาน
- Validate input ฝั่ง server ทั้งหมด (type, length, enum, required ตามเงื่อนไข, actual ไม่ติดลบ, cumulative ไม่ลดลง)
- ห้ามใช้ `innerHTML` กับข้อมูลผู้ใช้ → ใช้ `textContent` หรือ escape; ใช้ `HtmlService` template แบบ `<?= ?>` (escaped) เท่านั้น
- อัปโหลดไฟล์: whitelist นามสกุล + MIME, ≤ 10MB, ตั้งชื่อใหม่ `report_id_timestamp_ext`, เก็บใน folder เดียวที่แชร์เฉพาะผู้ใช้ระบบ
- ไม่มี secret ใน code; ID ของ Sheet/Folder อยู่ใน `PropertiesService`

**Reliability**
- ทุกการเขียนใช้ `LockService.getScriptLock()` + ตรวจ `version` (ถ้าไม่ตรง → แจ้ง "มีผู้แก้ไขก่อนหน้า" และไม่ทับข้อมูล)
- ข้อมูลที่ผู้ใช้กรอกต้องไม่หายเมื่อ submit ไม่สำเร็จ (เก็บ draft ฝั่ง client ด้วย)
- Audit ทุก create/update/transition

**Performance**
- Dashboard โหลดด้วย call เดียว (`getDashboard(fy)`) อ่าน Sheet แบบ `getValues()` ครั้งเดียวต่อแท็บ + `CacheService` 60 วินาที (invalidate เมื่อมีการเขียน)
- เป้าหมาย: Dashboard แสดงผล < 3 วินาทีบน 4G

**Accessibility (WCAG 2.2 AA)**
- Semantic HTML, label ทุก input, keyboard ครบทุก flow, target ≥ 24px (44px บนมือถือ), contrast ข้อความ ≥ 4.5:1, ซูม 200% ไม่แตก

**States ที่ต้องมีทุก component:** default · hover · focus-visible · active · disabled · loading (skeleton) · success (toast) · error (inline + summary) · empty

## 10. Suggested File Structure (clasp)

```
/appsscript.json
/src/server/
  Main.gs          # doGet, routing, include()
  Auth.gs          # getCurrentUser(), requireRole(), canEditActivity()
  Repo.gs          # read/write แต่ละแท็บ (ไม่มี business logic)
  Status.gs        # computeActivityStatus(), computeProgress()  ← pure functions
  ReportService.gs # saveDraft, submit, review, approve, returnReport
  Evidence.gs      # upload, link, delete (soft)
  Dashboard.gs     # getDashboard(fy), getActivities(fy, filters)
  Audit.gs         # writeAudit()
  Seed.gs          # seedActivitiesFromSheet1() — รันครั้งเดียว, idempotent
  Validation.gs
/src/client/
  Index.html  Styles.html  App.js.html
  views/Dashboard.html  Activities.html  Report.html  MyTasks.html
/tests/
  Status.test.gs   # รันด้วย function runTests() หรือ GasT
/docs/SPEC.md      # ไฟล์นี้
```

## 11. Implementation Phases

| Phase | Scope | Done when |
|---|---|---|
| **0** | ยืนยัน [OPEN] ทั้งหมดกับผู้ใช้ | ได้คำตอบเป็นลายลักษณ์อักษรใน SPEC |
| **1** | สร้างแท็บ schema + `Seed.gs` + `Status.gs` + unit test | 18 กิจกรรมถูก seed ตรงกับ Sheet1 ทุกค่า, test สถานะผ่านครบ |
| **2** | Web App shell + Auth + Dashboard + Activities (read-only) | ตัวเลขบน Dashboard ตรงกับข้อมูลใน Sheet (ตรวจมือ 3 กิจกรรม) |
| **3** | ฟอร์มรายงาน + Evidence + Workflow อนุมัติ + Audit | flow DRAFT→APPROVED และ RETURNED ทำงานจริงกับ 3 บัญชีทดสอบ |
| **4** | Mobile view + รออนุมัติ + Do & Don't + Export | ใช้งานบนมือถือจริงได้, export ตรงกับ Dashboard |
| **5** | Hardening: a11y check, performance, error handling, คู่มือผู้ใช้ | ผ่าน checklist หัวข้อ 12 |

## 12. Acceptance Checklist

- [ ] ไม่มีการแก้ไขแท็บเดิมใน Sheet
- [ ] ผลที่แสดงนับเฉพาะรายงาน APPROVED
- [ ] สถานะกิจกรรมตรงตามกฎ 5.3 และมี test
- [ ] ผู้ใช้ที่ไม่มีสิทธิ์เรียก endpoint ตรง ๆ แล้วถูกปฏิเสธ (ทดสอบฝั่ง server)
- [ ] วันที่ทุกจุดแสดงเป็น พ.ศ. รูปแบบเดียวกัน
- [ ] สถานะทุกจุดมีไอคอน/ข้อความ ไม่ใช่สีอย่างเดียว
- [ ] Keyboard-only ทำ flow รายงาน → ส่ง ได้ครบ
- [ ] หน้ามือถือ 390px ไม่มี horizontal scroll
- [ ] ทุก transition มี audit log
- [ ] ระบุชัดในรายงานส่งมอบว่าทดสอบอะไรแล้ว และอะไรยังไม่ได้ทดสอบ

## 13. Open Questions (สรุป)

1. Mapping มิติของหมวด 5/6 ใน Sheet1 ถูกต้องหรือไม่ (Data issue #1)
2. สูตรตัวชี้วัด 5.1 (Data issue #2)
3. `measure_type` ของแต่ละกิจกรรม โดยเฉพาะ 4.2, 4.3 (Data issue #3)
4. รายชื่อผู้ใช้ + role + หัวหน้ากลุ่มงานที่ดูแลแต่ละกิจกรรม
5. กำหนดส่งวันที่ 5 ของเดือนถัดไปใช้ได้หรือไม่
6. Workspace domain / บัญชี deploy และ Drive folder สำหรับหลักฐาน
7. ต้องรวมกับระบบมอบหมายงาน กบค. / SIPOC ในเฟสนี้หรือภายหลัง (แนะนำ: ภายหลัง แต่ใช้ `cfg_Users` และ design token ร่วมกันตั้งแต่ตอนนี้)
