# หลักฐานส่ง backend ป้องกันรหัสค้างหลังยกเลิก

[กลับสารบัญหลักฐาน](../README.md) · [กติกาการยกเลิกและนำรหัสกลับมาใช้](../../api/menus/connection-requests/operator-cancel-request.md)

## ชุดที่ส่งขึ้น production

- Source commit: [`0700edebe0bb9bbb3ba6cea5c1196d743803c126`](https://github.com/Nongten1010/POMS-app/commit/0700edebe0bb9bbb3ba6cea5c1196d743803c126)
- Workflow: [Deploy POMS — run 43172405240](https://github.com/Nongten1010/POMS-app/actions/runs/43172405240) ผล `success` ทั้ง build/tests และติดตั้ง backend บน production
- ตรวจ checkout ก่อนส่งด้วย [Inspect production checkout — run 43172251926](https://github.com/Nongten1010/POMS-app/actions/runs/43172251926): HEAD `127d19e596e771280afc5a63aff2b1eaef128a0e`, ไม่มี tracked changes หรือ untracked backend source และตรวจ hash ของ artifact แล้ว
- Release แก้ config ค้างจากคำขอที่ยกเลิกในระบบรุ่นเก่า โดยตรวจเจ้าของการจอง โรงงาน ระบบ และประวัติเชื่อมต่อก่อนปิด config/channels ใน transaction เดียวกับการนำรหัสกลับมาใช้

## ผลตรวจ

| รายการ | ผล |
| --- | --- |
| CI build | ผ่าน |
| CI tests | 424 suites ผ่าน, 3 suites ข้าม; 5,940 tests ผ่าน, 21 tests ข้าม |
| ตรวจ artifact และ sync server checkout | ผ่าน; log ยืนยัน SHA `0700edebe0bb9bbb3ba6cea5c1196d743803c126` |
| Migration workflow | ผ่าน; release นี้ไม่มี migration ใหม่ |
| Restart และ local health | ผ่าน; HTTP `200`, `success: true`, `status: ok` เวลา 12 พฤศจิกายน 2026 14:08:01 น. (Asia/Bangkok) |
| Deploy marker | ขั้นตอน `Write backend deploy marker` สำเร็จ โดย workflow เขียน SHA ของ release นี้ |
| [Runtime OpenAPI](https://d-poms.diw.go.th/api/v1/openapi.json) | HTTP `200`; description ของ `POST /cems-wpms-requests/{id}/review`, `/status`, `/cancel` ตรงกับ source commit ครบทั้งข้อความ |
| [Swagger UI](https://d-poms.diw.go.th/api/v1/docs/) | HTTP `200` |

Regression tests ใช้ routes, service, repository และ SQL predicate จริงกับฐานข้อมูล fixture ครอบคลุม `P0212`, การยกเลิกโดยผู้ประกอบการ/เจ้าหน้าที่/หมดเวลา, การคงประวัติ, config ของแหล่งอื่น, สิทธิ์อนุมัติ และ rollback เมื่อปิด channels หรือจองรหัสใหม่ไม่สำเร็จ ดู [API tests](../../../../backend/tests/unit/canceled-point-code-reuse.api.test.ts) และ [implementation](../../../../backend/src/modules/connection-requests/reclaim-canceled-point-code.ts)

## สถานะคำขอหลังส่ง

ตรวจฐานข้อมูลแบบอ่านอย่างเดียวหลัง deploy พบคำขอเก่า `WPMS-0054/2569` ยังเป็น `CANCELED` และคำขอใหม่ `WPMS-0190/2569` ยังเป็น `PENDING_DESIGN_REVIEW`. การตรวจ release ไม่ได้อนุมัติคำขอธุรกิจจริง; กติกาปิด config ค้างและเปลี่ยนเจ้าของการจอง `P0212` จะทำงานภายใน transaction เมื่อเจ้าหน้าที่อนุมัติคำขอใหม่
