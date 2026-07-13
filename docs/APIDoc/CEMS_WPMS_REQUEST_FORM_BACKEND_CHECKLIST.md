# Checklist: แบบฟอร์มคำขอเพิ่มจุดตรวจวัด CEMS/WPMS

วันที่ตรวจ: 2026-07-13

## สถานะงานจัดการเครื่องมือตรวจวัด (รอบ cross-stack)

| ข้อที่ขอ | สถานะ | สิ่งที่แก้และตรวจแล้ว |
| --- | --- | --- |
| คำนวณ ปกติ/เฝ้าระวัง/แจ้งเตือน จากค่ามาตรฐาน | `DONE` | Frontend คำนวณ 80% และแสดง `0 < ปกติ ≤ 80`, `80 < เฝ้าระวัง ≤ 100`, `100 < แจ้งเตือน ≤ -`; backend derive ค่าเดียวกันสำหรับ CEMS/WPMS เมื่อ `standardValue` เป็นตัวเลขบวก |
| Footer ของ dialog อยู่กึ่งกลาง | `DONE` | `InstrumentDataDialog` ใช้ `DialogActions` แบบ `justifyContent: center` ร่วมกันทั้ง CEMS/WPMS |
| ยืนยันก่อนบันทึก/แก้ไข และแจ้งสำเร็จ | `DONE` | เปิด dialog ยืนยันก่อนเปลี่ยนแถวและแสดง success Snackbar; ปิดปุ่มบันทึกเมื่อเกณฑ์ที่เปิดใช้ไม่มีค่ามาตรฐานที่ถูกต้อง |
| ยืนยันการลบ/แจ้งลบสำเร็จ | `NOT_APPLICABLE` | ข้อกำหนดเดียวกันสั่งเอาปุ่มลบออก จึงไม่มี delete action หรือ delete API ให้เรียก |
| ตารางแสดงเฉพาะพารามิเตอร์ที่ขอเชื่อมและไม่มีปุ่มลบ | `DONE` | Frontend sync แถวตาม `requestedParameters`; backend reject เมื่อชุด instrument parameters ไม่ตรงกัน |
| เอาปุ่มเพิ่มพารามิเตอร์ออกจาก section | `DONE` | เอาออกเฉพาะ section รายละเอียดเครื่องมือ; workflow เพิ่มพารามิเตอร์ของจุดที่เชื่อมต่อแล้วเป็นคนละส่วน |
| WPMS ไม่มีหัวข้อ/คอลัมน์การรายงานค่า | `DONE` | ซ่อน `standardCondition`, `dryBasis`, `oxygenOrExcessAir` ใน dialog/table ของ WPMS โดย backend ยังรองรับค่าเก่า |

## ขอบเขตงาน

- งาน backend audit เดิมแก้ production code ใต้ `backend/`, tests และเอกสาร Markdown.
- รอบ follow-up นี้ผู้ใช้ระบุให้แก้ frontend โดยตรง จึงเพิ่ม frontend implementation/helper/test สำหรับเกณฑ์ 80% และ UI ที่เกี่ยวข้อง.
- ข้อมูลรายละเอียด เอกสาร และรูปภาพยังเก็บใน JSON columns เดิมของ measurement point จึงไม่ต้องเพิ่ม migration.

หลักฐาน TDD และคำสั่งที่รันอยู่ที่ [cems-wpms-request-form-update.tdd.md](../testing/cems-wpms-request-form-update.tdd.md) และ contract สำหรับ frontend อยู่ที่ [CEMS_WPMS_REQUEST_FORM_FRONTEND_HANDOFF.md](./CEMS_WPMS_REQUEST_FORM_FRONTEND_HANDOFF.md).

## สถานะรายข้อ

คำสถานะ:

- `BACKEND_DONE` = backend รองรับ/ตรวจแล้วในรอบนี้
- `NO_BACKEND_CHANGE` = backend เดิมรองรับอยู่แล้วหรือเป็น UI-only
- `FRONTEND_DONE` = frontend implementation อยู่บน `origin/main` และตรวจ source แล้ว
- `FRONTEND_PARTIAL` = พบโค้ด frontend บางส่วนแล้ว แต่ยังมี gap
- `FRONTEND_PENDING` = ต้องแก้ frontend ก่อนถือว่าจบ end-to-end

| # | ข้อกำหนด | Backend ที่ทำ/ตรวจแล้ว | สถานะ frontend จาก source audit |
| --- | --- | --- | --- |
| 1 | บัญชีแนบท้ายลำดับ 1–13 | `BACKEND_DONE` ตรวจ `legalAnnexNo` ให้รับเฉพาะ string `1`–`13`; test ครอบคลุม `1`, `13`, `14` | มีตัวเลือก 1–13 แล้ว |
| 2 | CS2 ppm, ppb, mg/m³ รวม Mobile/Station | `BACKEND_DONE` รับและเก็บ label พร้อมหน่วยโดยไม่ตัดหน่วย; test CS2 สามหน่วย | `FRONTEND_PARTIAL`: JSON มี `mg/m3` ไม่ตรง `mg/m³`; Mobile/Station แสดง option แต่ input ไม่มี name และยังไม่ถูกสร้างเป็น payload จริง |
| 3 | พารามิเตอร์ที่ขอเชื่อมต่อมาจากรายการยังไม่เชื่อมต่อ | `BACKEND_DONE` เพิ่ม `requestedParameters` เป็น string[]; บังคับเป็น subset ของ `pendingParameters`; ใช้ requested list เป็น point parameters | `FRONTEND_PENDING`: CEMS/WPMS ยังแสดง master list ทั้งหมด ไม่ได้จำกัด options จาก pending list |
| 4 | เพิ่ม `ไม่มี` เป็นตัวเลือกแรกใน 4 กลุ่มพารามิเตอร์ | `BACKEND_DONE` รับ `ไม่มี`, บังคับให้เลือกเดี่ยว และไม่ให้กลายเป็น telemetry parameter | `FRONTEND_PARTIAL`: CEMS ครบ; WPMS ไม่มีช่อง exempted; UI ยังเลือก `ไม่มี` ปนค่าจริงได้ |
| 5 | ชีวมวลต้องระบุรายละเอียด | `BACKEND_DONE` บังคับ `primaryFuelOther`/`secondaryFuelOther` สำหรับ `ชีวมวล`, `Biomass`, `อื่นๆ` | UI เปิดช่องรายละเอียดแล้ว |
| 6 | ระบบควบคุม Dropdown `[ระบบปิด, ระบบเปิด]` | `BACKEND_DONE` รับค่าใหม่ทั้งสอง, รับ legacy `ควบคุมอัตโนมัติ` เพื่อแก้คำขอเก่า และ reject string อื่น | Dropdown และ options มีแล้วจาก source audit |
| 7 | ระบบบำบัดเป็น Multiselect CEMS/WPMS | `BACKEND_DONE` รับ `string[]`; ยังรับ legacy string เพื่อ backward compatibility | UI ส่ง array แล้ว |
| 8 | WPMS ใช้ `wpmsTreatmentSystemOptions.json` | `NO_BACKEND_CHANGE`: option list เป็น frontend-owned; backend ตรวจ shape ไม่ทำ allow-list ซ้ำ | `FRONTEND_DONE`: ไฟล์ถูก track, import และใช้กับ WPMS บน `origin/main` แล้ว |
| 9 | เลือก `อื่นๆ` ต้องระบุระบบบำบัด | `BACKEND_DONE` บังคับทั้ง CEMS และ WPMS สำหรับ string/array | ช่องระบุมีแล้ว |
| 10 | เปลี่ยน POMS เป็น D-POMS | `BACKEND_DONE` backend รับ label ใหม่และยังรับค่าเก่าเพื่ออ่าน history | `FRONTEND_PARTIAL`: มี `D-POMS Client (ใหม่)` แต่ `POMS Box` และ `POMS Client (เดิม)` ยังไม่เปลี่ยน |
| 11 | ย้ายภาพหน้าโรงงาน/โลโก้ไปข้อมูลทั่วไป | `NO_BACKEND_CHANGE`: ตำแหน่งหน้าจอไม่เปลี่ยน data model; backend ยังเก็บ metadata ใต้ measurement point | UI ย้ายตำแหน่งแล้ว แต่ WPMS ยังไม่ส่ง `documentsAndImages` ใน JSON |
| 12 | เพิ่มเอกสารระบบบำบัด/ภาพเครื่องมือ WPMS | `BACKEND_DONE` validator และ JSON persistence รับหลายรายการของสอง title นี้ | `FRONTEND_PENDING`: แสดงและ upload แล้ว แต่ WPMS payload ลืมใส่ `documentsAndImages` |
| 13 | ทุกไฟล์ไม่เกิน 5 MB | `BACKEND_DONE` ลด Multer/service/metadata limit จาก 20 MB เป็น 5 MiB; route test ยืนยันเกิน 1 byte ได้ HTTP 400 | `FRONTEND_PARTIAL`: มีหมายเหตุแต่เขียน `5 Mb`; ไม่มี client-side size validation |
| 14 | โลโก้ 512 × 512 Pixel และไม่เกิน 5 MB | `BACKEND_DONE` สำหรับขนาดไฟล์และบังคับ metadata โลโก้ไม่เกิน 1 รายการต่อคำขอ; pixel เป็นข้อความแนะนำ UI จึงยังไม่ parse dimension ที่ server | `FRONTEND_PARTIAL`: single-file และข้อความมีแล้ว แต่ casing/ถ้อยคำยังไม่ตรง (`pixel`, `Mb`) |
| 15 | หลายไฟล์ได้ ยกเว้นโลโก้ | `BACKEND_DONE` upload ทีละไฟล์หลาย request แล้วรวม metadata ได้; non-logo title ซ้ำได้; logo ที่ซ้ำข้ามจุดในคำขอเดียวกันถูก reject | `FRONTEND_PARTIAL`: CEMS รวมหลายไฟล์ได้; WPMS ยังทำ metadata หล่นจาก final payload |

## สิ่งที่ backend แก้

1. `connection-requests.validator.ts`
   - รองรับ treatment system แบบ array พร้อม legacy scalar.
   - เพิ่ม validation สำหรับ requested/pending, `ไม่มี`, annex 1–13, biomass detail, control-system enum, treatment Other, file 5 MB, URL แบบ HTTP(S) และโลโก้หนึ่งไฟล์ต่อคำขอ.
   - กรอง `ไม่มี` ออกจาก `measurementPoints[].parameters`.
2. `connection-request-document-image.service.ts`
   - เปลี่ยน upload limit และ error message จาก 20 MB เป็น 5 MB.
   - ตรวจ signature ของ PNG/JPEG/PDF ให้ตรง MIME type และ extension ก่อนบันทึก.
3. `connection-requests.service.ts`
   - รักษา `treatmentSystemType: string|null` ของ modal เดิม โดย join treatment array ด้วย `, `.
   - ตอน resubmit ให้ใช้ประเภทเดิมของคำขอ, reject การเปลี่ยน `requestType` และตรวจ validation ตามประเภทนั้นก่อน replace form.
4. `connection-requests.routes.ts`
   - จำกัด multipart เป็น 1 file, 3 text fields, 5 parts และ field size 4 KiB ต่อ request.
5. Tests
   - เพิ่ม validator contract tests, upload boundary tests และ HTTP route test.

## ข้อที่ยังบล็อก end-to-end บน frontend `origin/main`

ต้องแก้อย่างน้อย 5 จุดก่อนถือว่าหน้าปัจจุบันพร้อมส่งจริง:

1. ให้ requested-parameter options มาจาก `pendingParameters` เท่านั้น.
2. ใส่ `documentsAndImages` ใน WPMS measurement point payload.
3. เปลี่ยน CS2 label เป็น `CS2 (mg/m³)` ให้ตรง contract.
4. ทำ `ไม่มี` ให้ exclusive และเติม exempted field ของ WPMS หาก requirement ยืนยันว่าต้องมี.
5. แก้ EIA payload ที่อยู่นอก requirement ชุดนี้: frontend ปัจจุบันส่ง `eia: "มี EIA"` และ `eiaOther`, แต่ connection-request backend ปัจจุบันรับ `eia: "มี"|"ไม่มี"|null` และไม่มี `eiaOther`. หากไม่แก้ จุดนี้ยังทำให้ request ได้ HTTP 400 แม้ 15 ข้อด้านบนจะรองรับแล้ว.

## หลักฐานตรวจ

- RED: focused tests ล้มจาก treatment array, 20 MB limit, requested/pending, annex, biomass, logo และ WPMS modal array ตามพฤติกรรมเก่า.
- GREEN: 6 suites, 127 tests ผ่าน.
- `npm run typecheck` ผ่าน.
- Targeted ESLint, backend build, `npm audit --omit=dev` (0 vulnerabilities) และ scoped `git diff --check` ผ่าน.
- Full backend `npm test` ใน clean worktree ผ่านครบ 47 suites, 502 tests.
- Focused coverage ผ่าน; changed modules มี line coverage 84.72% (upload service), 91.80% (validator), 92.58% (connection request service).
- ดูรายละเอียดคำสั่งและ gap ที่ [../testing/cems-wpms-request-form-update.tdd.md](../testing/cems-wpms-request-form-update.tdd.md).

## Compatibility และ security follow-up

- Limit ใหม่ใช้กับ metadata ตอน submit/resubmit ด้วย คำขอเก่าที่มี `fileSize` มากกว่า 5 MiB จะต้องลบหรืออัปโหลดไฟล์ใหม่ก่อนส่งแก้ไขซ้ำ; รอบนี้ไม่มี data migration เพราะไม่มีสิทธิ์ชี้ว่าไฟล์เก่าใดควรถูกลบแทนผู้ใช้.
- Backend ตรวจ MIME/extension/signature และ HTTP(S) URL แล้ว แต่ metadata ของฟอร์มยังอ้าง remote URL ได้และยังไม่ได้ผูกกับ upload ID ที่เป็นเจ้าของโดย actor/factory.
- ไฟล์ภายใต้ upload public path ยังถูก serve แบบ static ก่อน auth ตามสถาปัตยกรรมเดิม การเปลี่ยนเป็น private download ต้องออกแบบ authorization และ compatibility ของ URL แยกต่างหาก.
- ยังไม่มี per-user/per-factory quota, orphan-file cleanup หรือ HTTP 413 mapping; oversized upload ปัจจุบันคืน HTTP 400.
- ขนาดโลโก้ 512 × 512 ยังเป็น UI requirement เท่านั้น หากต้องการบังคับที่ server ต้องเพิ่ม image-dimension parser และตกลงนโยบายสำหรับโลโก้เดิม.
