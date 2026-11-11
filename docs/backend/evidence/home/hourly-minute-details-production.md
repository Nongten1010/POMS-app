# ผลเผยแพร่ข้อมูลรายนาทีของชั่วโมงที่เลือกบน production

สัญญาอ้างอิง: [ข้อมูลรายนาทีของชั่วโมงที่เลือก](../../api/shared/connected-measurement-points/measurement-minutes.md) · [TDD และผลตรวจในเครื่อง](./hourly-minute-details.tdd.md)

## Release และขอบเขต

- ตรวจเมื่อ 11 พฤศจิกายน 2569 เวลา 10:51–10:52 น. (`Asia/Bangkok`)
- Application release: [`e939e511`](https://github.com/Nongten1010/POMS-app/commit/e939e511ce91f8d7cad150ea195948d772f42573)
- Implementation: [`4a6c041f`](https://github.com/Nongten1010/POMS-app/commit/4a6c041f5ef0a06e16f4f212ffcbb974b744e8f1) เพิ่ม endpoint, validation, unit-safe mapping, tests, canonical docs และ runtime OpenAPI
- [Deploy POMS run 42955069708](https://github.com/Nongten1010/POMS-app/actions/runs/42955069708): detect, CI และ installation สำเร็จ
- ส่ง backend เท่านั้น ไม่มี frontend, dependencies หรือ migration ใหม่; steps `Build frontend` และ `Deploy frontend to IIS site root` ถูกข้าม

## Git และ source บนเซิร์ฟเวอร์

- ตรวจ diff ก่อน push: implementation 21 ไฟล์ แบ่ง backend 14 และ canonical docs 7 ไม่มี generated files หรือ credentials
- [Inspect production checkout run 42954483132](https://github.com/Nongten1010/POMS-app/actions/runs/42954483132): checkout เดิมเป็น `7ad55be4`, ไม่มี tracked changes หรือ untracked backend source จึงไม่ต้อง reconcile source นอก Git
- Installation log ยืนยัน server checkout เป็น `e939e511ce91f8d7cad150ea195948d772f42573`; artifact verification และขั้นตอนเขียน backend deploy marker สำเร็จ
- [CI รอบแรก 42954609258](https://github.com/Nongten1010/POMS-app/actions/runs/42954609258) หยุดก่อนติดตั้ง เพราะ test ของหน้า docs ยังคาดจำนวน operations เดิม 173 แทน 175; follow-up commit แก้เฉพาะ expectation นี้ และ local docs tests 93 ข้อผ่านก่อนรัน workflow release ใหม่ ไม่มีการข้าม test เพื่อ deploy

## Build, SQL Server, tests และ health

| การตรวจ | ผล |
| --- | --- |
| Local build/typecheck | ผ่าน |
| Local targeted tests | 266 ข้อผ่าน; docs regression หลังแก้ CI อีกชุด 93 ข้อผ่าน โดยเป็นชุดที่มี tests ทับซ้อนกัน ไม่ใช่ยอดบวกสะสม |
| SQL Server จริง | 3 tests ผ่านบน SQL Server 2022 (`16.0.4255.1`) ใน local Docker กับฐานแยก `poms_measurement_minutes_test` และข้อมูลสมมติ: ชั่วโมง 00/09/23, DATE/TIME(7), เศษวินาทีท้ายชั่วโมง และไม่ดึงวันถัดไป |
| CI build/tests ทั้ง backend | 421 suites ผ่าน, 3 suites ข้าม; 5,855 tests ผ่าน, 21 ข้าม ไม่มี failures; opt-in SQL Server ไม่ได้เปิดใน hosted CI แต่ minute-reader ทั้ง 3 cases ผ่านจริงในเครื่องแล้ว |
| Production migration command | `npm run db:migrate` ผ่านด้วย `Already up to date`; ไม่มี migration ใหม่ใน release นี้ |
| Restart และ health | ผ่าน: `http://127.0.0.1:3000/health` คืน `success: true`, `status: "ok"` เวลา 10:51:57 น. |
| Deploy marker | ขั้นตอน `Write backend deploy marker` ผ่านสำหรับ commit ของ release |

## HTTP และ runtime OpenAPI

ตรวจผ่าน HTTPS ภายนอกเมื่อ 10:52:19 น.:

- `GET /api/v1`: `200`, `success: true`
- `GET /api/v1/docs/`: `200`, เป็นหน้า POMS API Playground
- `GET /api/v1/openapi.json`: `200`, canonical endpoint count เป็น 165
- เทียบ JSON ของ `MinuteMeasurementValue` และ `MeasurementMinutesResponse` จาก runtime กับ source ที่ build แล้ว: ตรงกันทุกฟิลด์ รวม nullable, enum, numeric string, 60 แถว และตัวอย่าง
- เทียบ GET operation ของ `/connected-measurement-points/{stationId}/measurement-minutes` และ annual alias ที่มี `/{buddhistYear}`: ตรงกันทุกฟิลด์ รวม parameters, permission, status codes, error 503 และ authentication
- เรียก endpoint รายนาทีแบบ legacy และ annual path โดยไม่มี token: ทั้งคู่ตอบ `401 UNAUTHORIZED`

## ข้อจำกัดของหลักฐาน

รอบนี้ไม่ได้อ่านค่ารายนาทีจริงผ่านบัญชีผู้ใช้ที่ล็อกอินบน production และไม่ได้ทดสอบ dialog ผ่าน browser; frontend ยังรอเชื่อม API ตาม [canonical contract](../../api/shared/connected-measurement-points/measurement-minutes.md) การยืนยันค่า/สถานะ/หน่วยและสิทธิ์ใช้ HTTP regression tests กับข้อมูลสมมติ ส่วนชนิดข้อมูลและขอบเวลาตรวจบน SQL Server จริงที่แยกจาก production จึงไม่ใช่ผลทดสอบครบ flow ของหน้าจอหรือ performance บนฐาน production
