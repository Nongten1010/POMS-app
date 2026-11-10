# ผลเผยแพร่รายงานตามเงื่อนไข กวภ.04 บน production

สัญญาอ้างอิง: [รายงานตามเงื่อนไข กวภ.04](../../api/menus/kwp-forms/kwp04-report-condition.md)

## Release และขอบเขต

- ตรวจเมื่อ 10 พฤศจิกายน 2569 เวลาประมาณ 13:58–14:00 น. (`Asia/Bangkok`)
- Release: [`d90e3394`](https://github.com/Nongten1010/POMS-app/commit/d90e3394f16f21c124110fd1743f427767d1012b)
- [Deploy POMS run 42771497152](https://github.com/Nongten1010/POMS-app/actions/runs/42771497152): สำเร็จทั้ง detect, CI และ installation
- ส่งเฉพาะ Backend และ canonical docs; workflow ข้าม `Build frontend` และ `Deploy frontend to IIS site root`

## ตรวจ Git และ source บน server

- ก่อน push ตรวจไฟล์เปลี่ยน 17 ไฟล์ในช่วง `1a1722c9..d90e3394`: Backend 14 ไฟล์ และเอกสาร 3 ไฟล์ ไม่มี frontend
- [Inspect production checkout run 42771377769](https://github.com/Nongten1010/POMS-app/actions/runs/42771377769): checkout เดิมอยู่ที่ `c6b13c06`, ไม่มี tracked changes หรือ untracked backend source และตรวจ SHA-256 ของ snapshot ทั้ง 11 ไฟล์แล้ว
- Installation log ยืนยัน server checkout เลื่อนไป `d90e3394f16f21c124110fd1743f427767d1012b`; artifact verification และขั้นตอนเขียน deploy marker สำเร็จ

## Build, tests, migration และ health

| การตรวจ | ผล |
| --- | --- |
| Local checks ที่เกี่ยวข้อง | 23 suites / 414 tests ผ่าน; typecheck และ formatting ผ่าน; ESLint ไม่มี error มี warning เดิม 2 จุด |
| CI build | ผ่าน ก่อน package artifact ของ release |
| CI tests ทั้ง Backend | 418 suites ผ่าน / 2 ข้าม; 5,802 tests ผ่าน / 18 ข้าม; ไม่มี failures |
| Migration | หยุด service ก่อน migration; `npm run db:migrate` สำเร็จด้วย `Batch 129 run: 1 migrations`; release นี้เพิ่มเฉพาะ `0159_add_kwp04_measurement_report_condition.ts` |
| Restart และ health | ผ่าน; health ของ backend ที่ `http://127.0.0.1:3000/health` คืน `success: true`, `status: "ok"` เวลา 13:57:59 น. |
| ข้อมูลเก่าบนฐานจริง | หลัง migration API อ่านคอลัมน์ใหม่ได้ และคืน `reportCondition: null` โดยไม่ backfill |

ไม่ได้ใช้ rollback ของฐานข้อมูล การคืนแอปรุ่นเก่าให้คงคอลัมน์ nullable ไว้ตาม [แนวทางเปลี่ยนผ่าน](../../api/menus/kwp-forms/kwp04-report-condition.md#การเปลี่ยนผ่านและแหล่งอ้างอิง-backend)

## HTTP และ runtime OpenAPI

- `GET https://d-poms.diw.go.th/api/v1`: `200`
- `GET https://d-poms.diw.go.th/api/v1/docs/`: `200`
- `GET https://d-poms.diw.go.th/api/v1/openapi.json`: `200`; เทียบ JSON ของ `Kwp04Request`, `Kwp04SubmissionDetail` และ `Kwp04SubmissionDetailResponse` กับ source ของ release แล้วตรงกันทุกฟิลด์ รวม required, enum, nullable และตัวอย่าง
- ตรวจ refs ของ POST/PATCH/GET/resubmit กวภ.04 ให้ชี้ request/response schema ที่ถูกต้อง รวม status `201`/`200` และ authentication
- `Kwp02Or04Request` ที่ กวภ.02 ใช้ ไม่มี `reportCondition` ตามเดิม
- เรียก GET detail, POST create, PATCH และ POST resubmit ของ กวภ.04 โดยไม่มี token: ทั้งหมดตอบ `401 UNAUTHORIZED`; GET detail กวภ.02 โดยไม่มี token ตอบ `401` เช่นกัน

## อ่านข้อมูลจริงผ่าน session ที่ล็อกอิน

เปิดรายการแบบ กวภ. ผ่าน browser session เดิม เลือกอ่านเอกสาร กวภ.04 และตรวจ Network response โดยไม่ดึง token ออกมา:

- `GET /api/v1/kwp-form-submissions/kwp04/42` ตอบ `200 OK`
- Response มี `measurementItems[].reportCondition: null` สำหรับข้อมูลเก่าที่ตรวจ ยืนยันว่าอ่านคอลัมน์ใหม่จาก SQL Server และ serialize กลับเป็น camelCase สำเร็จ
- ไม่คัดลอกชื่อผู้ใช้ ข้อมูลติดต่อ โรงงาน เอกสารแนบ หรือ response เต็มลงหลักฐานนี้

## ข้อจำกัดของหลักฐาน

การตรวจ production รอบนี้ใช้การอ่านข้อมูลและตรวจ authentication/contract ไม่สร้างแบบใหม่ ไม่ PATCH และไม่ resubmit แบบจริง การรับ enum ทั้งสี่, validation ที่ผิด/ขาด, การบันทึกแล้วอ่านกลับ, ข้อมูลเก่า และการส่งซ้ำทดสอบในชุด CI ที่ผ่านแล้ว หลักฐานนี้จึงไม่ใช่ผลทดสอบเขียนข้อมูลครบ flow บน production

ใช้ [สัญญา API กลาง](../../api/menus/kwp-forms/kwp04-report-condition.md) เป็น contract ปัจจุบัน และดู [breaking change](../../api/CHANGELOG.md#kwp04-report-condition) สำหรับ client เดิม
