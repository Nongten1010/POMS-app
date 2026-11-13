# ผลเผยแพร่ค่ารายชั่วโมงล่าสุดที่ใช้เฉพาะเกณฑ์ อก.

หลักฐานการส่ง backend ขึ้น production วันที่ 13 พฤศจิกายน 2026 ตาม `Asia/Bangkok` อ้างอิง [สัญญาค่าล่าสุด](../../api/menus/home/README.md#latest-hourly-criteria), [สถิติและปฏิทิน](../../api/shared/connected-measurement-points/README.md#home-measurement-rules) และ [breaking change](../../api/CHANGELOG.md#latest-hourly-diw-criteria-only)

## ชุด release และการตรวจ source

- Source commit บน `main`: [`c891b5e1`](https://github.com/Nongten1010/POMS-app/commit/c891b5e17767e59ac5ff04f6b5233ff94b2cd173) จาก [PR #53](https://github.com/Nongten1010/POMS-app/pull/53) รวม application source/OpenAPI 2 ไฟล์, tests 3 ไฟล์ และเอกสาร 3 ไฟล์
- [ตรวจ production checkout ก่อน release](https://github.com/Nongten1010/POMS-app/actions/runs/43384901976): HEAD `f7ef084958041e436e85b93c869fa3dcd5c239a0`, ไม่มี tracked changes หรือ untracked backend source; ตรวจ SHA-256 ของ audit artifact ผ่านครบ 11 paths จึงไม่ต้อง reconcile source บนเซิร์ฟเวอร์
- [PR CI](https://github.com/Nongten1010/POMS-app/actions/runs/43385241573) และ [production workflow](https://github.com/Nongten1010/POMS-app/actions/runs/43385717264) สำเร็จ โดย production log ยืนยัน checkout เป็น source commit ข้างต้น และขั้นตอนเขียน backend deploy marker สำเร็จ
- ชุดนี้ไม่มี migration ใหม่; ขั้น migration รายงาน `Already up to date` และขั้น build/deploy frontend ถูกข้าม

## ผลทดสอบและติดตั้ง

| การตรวจ | ผล |
| --- | --- |
| Regression ก่อนแก้ | dashboard และ map คืน `NOx (ppm)` ค่า `10` เป็น `exceeded` จาก EIA เมื่อไม่มีแถวเกณฑ์ อก. ทำให้ 2 tests ไม่ผ่าน |
| Regression หลังแก้ | ค่าล่าสุดเป็น `normal` ทั้งเกณฑ์ อก. แบบ `null` และ `rows: []`; `CO (ppm)` ค่า `999` ยังเป็น `exceeded` ตามเกณฑ์ อก. และ response ยังเก็บ EIA criteria |
| สถิติ | `SO2 (ppm)` ค่า `55` ยังเป็น `warning` จาก EIA เมื่อไม่มีแถวเกณฑ์ อก. |
| ตรวจใน release worktree จาก `main` ล่าสุด | 6 suites / 117 tests ผ่าน; typecheck, ESLint, Prettier, diff check และลิงก์เอกสารผ่าน |
| CI ของ source commit ที่ deploy | 425 suites / 5,959 tests ผ่าน; ข้าม 3 suites / 21 tests ตามการตั้งค่าชุดทดสอบเดิม |
| Artifact และ checkout | ตรวจ artifact ของ commit เดียวกันผ่าน และ sync checkout แบบ fast-forward สำเร็จ |
| Restart และ local health | HTTP `200`, `success: true`, `status: "ok"` เวลา 14:31:19 น. |
| Production workflow | ติดตั้งเสร็จเวลา 14:31:36 น. |

## HTTP และ runtime contract

ตรวจผ่าน HTTPS ภายนอกเวลา 14:31:49 น.:

- `GET /api/v1`, `GET /api/v1/docs/`, [runtime OpenAPI](https://d-poms.diw.go.th/api/v1/openapi.json) และ `GET /api/v1/public/factory-map-points?systemType=CEMS` ตอบ HTTP `200`
- `HomeLatestMeasurement` ตรงกับ schema ที่ export จาก source ของ release รวมกติกาใช้เฉพาะ `standardCriteria.rows` และไม่ใช้ EIA เป็นเกณฑ์สำรอง
- เทียบ OpenAPI ก่อนและหลัง release: เปลี่ยนเฉพาะ `HomeLatestMeasurement`; schemas อื่น 293 รายการและ operation contracts ทั้ง 145 paths ตรงกัน รวมสถิติและปฏิทิน
- โรงงานในภาพ เลขทะเบียน `72070000325635` มีค่าล่าสุดวันที่ `2026-11-13` เวลา `13:00:00` ดังนี้ โดยเกณฑ์ EIA ยังอยู่ใน response:

| จุดตรวจวัด | Station | `NOx (ppm)` | API status |
| --- | --- | ---: | --- |
| HRSG-11 | `S0427` | 19.0945 | `normal` |
| HRSG-12 | `S0428` | 21.8815 | `normal` |
| Auxiliary Boiler | `S0429` | 0 | `normal` |

## ขอบเขตของหลักฐาน

API โรงงานในภาพคืน `normal` ทั้งสามจุดตั้งแต่ก่อน deploy เพราะมีแถวเกณฑ์ อก. อยู่แล้ว จึงไม่ถือว่าการตรวจนี้ยืนยันว่าสีส้มบนหน้าจอได้รับการแก้ รอบนี้ไม่ได้แก้หรือทดสอบ frontend และไม่ได้ใช้ authenticated session เรียกสถิติบน production; กติกาสถิติเดิมยืนยันด้วย regression tests, CI และ runtime contract ที่ไม่เปลี่ยน การตัด EIA fallback ของค่าล่าสุดยืนยันจาก source ที่ติดตั้งและชุดทดสอบ ไม่ได้ใช้ตัวอย่างข้อมูลจริงที่มีแต่เกณฑ์ EIA
