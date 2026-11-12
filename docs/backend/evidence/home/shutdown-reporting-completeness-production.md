# ผลเผยแพร่สูตรการส่งข้อมูลที่ตัด SHUTDOWN บน production

[กลับสารบัญหลักฐาน](../README.md) · [สัญญาสถิติและปฏิทิน](../../api/shared/connected-measurement-points/README.md#home-measurement-rules) · [ผลกระทบต่อ client](../../api/CHANGELOG.md#reporting-completeness-exclude-shutdown)

## ชุดที่ส่ง

- Source commit: [`f7ef0849`](https://github.com/Nongten1010/POMS-app/commit/f7ef084958041e436e85b93c869fa3dcd5c239a0) บน `main` รวม backend, ชุดทดสอบ และเอกสาร API 10 ไฟล์
- [Deploy POMS run 43174111280](https://github.com/Nongten1010/POMS-app/actions/runs/43174111280): detect, CI build/tests และการติดตั้ง production สำเร็จ
- [Inspect production checkout run 43173917257](https://github.com/Nongten1010/POMS-app/actions/runs/43173917257): source เดิมเป็น `0700edebe0bb9bbb3ba6cea5c1196d743803c126`, ไม่มี tracked changes หรือ untracked backend source และตรวจ SHA-256 ของ snapshot ทั้ง 11 ไฟล์แล้ว
- Installation log ยืนยัน server checkout เป็น SHA ของ source commit ข้างต้น; artifact verification และขั้นตอนเขียน backend deploy marker สำเร็จ ส่งเฉพาะ backend โดยขั้นตอน build/deploy frontend ถูกข้าม

## พฤติกรรมที่แก้

สูตรเดิมยังรวมชั่วโมง SHUTDOWN ในตัวหาร และ SHUTDOWN ที่มีตัวเลขอาจถูกนับเป็นข้อมูลรับเข้า รุ่นนี้ตัดสถานะ `Shut Down` (code `6`) ออกจากทั้งตัวตั้งและตัวหาร แยกตามพารามิเตอร์และชั่วโมง รวมสถานะที่มีค่า `0`, ไม่มีค่าตัวเลข หรือส่งช้า โดยชั่วโมงที่ข้อมูลขาดยังอยู่ในตัวหาร

เคสตามภาพมี Normal ส่งตรงเวลา 5 ชั่วโมงกับ SHUTDOWN 8 ชั่วโมงจาก 13 ชั่วโมงที่จบแล้ว จึงได้ `5 / (13 - 8) * 100 = 100%` หากทุก expected bucket เป็น SHUTDOWN เปอร์เซ็นต์รายวันเป็น `null`; แถวรายชั่วโมงที่ไม่เหลือพารามิเตอร์ที่ต้องส่งยังคืน `0` ตามสัญญา ดู [regression tests](../../../../backend/tests/unit/parameter-values.shutdown-completeness.test.ts)

## ผลตรวจ build, tests และ service

| รายการ | ผล |
| --- | --- |
| Local targeted tests บน checkout จาก main ล่าสุด | 22 suites, 539 tests ผ่าน รวม regression SHUTDOWN 20 cases |
| Local typecheck และ lint ของไฟล์ที่แก้ | ผ่าน |
| CI build/tests ทั้ง backend | 425 suites ผ่าน, 3 suites ข้าม; 5,957 tests ผ่าน, 21 tests ข้าม ไม่มี failures |
| Artifact และ server checkout | ตรวจ artifact ของ commit เดียวกันผ่าน และ sync checkout แบบ fast-forward สำเร็จ |
| Migration workflow | ผ่านด้วย `Already up to date`; release นี้ไม่มี migration ใหม่ |
| Restart และ local health | HTTP `200`, `success: true`, `status: "ok"` เวลา 12 พฤศจิกายน 2026 14:22:06 น. (`Asia/Bangkok`) |
| Deploy marker | ขั้นตอน `Write backend deploy marker` สำเร็จสำหรับ source commit นี้ |

## HTTP และ runtime OpenAPI

ตรวจผ่าน HTTPS ภายนอกเมื่อ 12 พฤศจิกายน 2026 14:22:14 น. (`Asia/Bangkok`):

- `GET /api/v1`, `GET /api/v1/docs/` และ [runtime OpenAPI](https://d-poms.diw.go.th/api/v1/openapi.json) ตอบ HTTP `200`
- เทียบ JSON ของ schemas `HomeMeasurementSummary`, `HomeCalendarDay`, `HomeParameterSummary`, `HomeCalendarLowDataDetailRow` และ `HomeMeasurementStatisticRow` กับ source commit: ตรงกันครบทั้ง 5 schemas
- เทียบ description ของ GET operations `/measurement-statistics`, `/calendar-status` และ `/calendar-status/details` ใต้ `/connected-measurement-points/{stationId}` และ annual alias ที่มี `/{buddhistYear}`: ตรงกันครบทั้ง 6 operations
- Runtime เผยแพร่กติกาตัด SHUTDOWN ออกจากทั้งตัวตั้งและตัวหาร ตัวอย่าง `5 / (13 - 8) = 100%` และกรณีไม่มีฐานคำนวณตรงกับ canonical contract

## ขอบเขตของหลักฐาน

ผล 100% ตามภาพยืนยันด้วย fixture ที่เรียก service จริงและ regression tests; รอบ release นี้ไม่ได้อ่านข้อมูลโรงงานในภาพผ่าน session ผู้ใช้บน production หรือทดสอบหน้าจอผ่าน browser การตรวจ production ยืนยัน commit ที่ติดตั้ง, health และ runtime contract จึงไม่ใช่หลักฐานผลครบทั้ง UI flow หรือ performance ของข้อมูลจริง เอกสารนี้เป็น snapshot ของ release และไม่ใช้แทน canonical API contract
