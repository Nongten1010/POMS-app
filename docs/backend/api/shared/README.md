# Shared API Index

API contract ในกลุ่มนี้ใช้ข้ามหลายเมนูและไม่ควรถูกคัดลอกเข้าเอกสารของแต่ละเมนู ตัวอย่างเช่น authentication, current-user profile, user management และ permissions

สำหรับการกดเทสจริงให้ใช้ Swagger UI ที่ `GET /api/v1/docs` ส่วน index นี้มีไว้ชี้ canonical pages ของ API กลางที่หลายเมนูอ้างร่วมกัน

## Canonical Target Map

| Directory                                                                   | Contract                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [`common-api/`](./common-api/README.md)                                     | Base URL, headers, response envelope, pagination และ shared errors |
| [`regional-jurisdictions/`](./regional-jurisdictions/README.md) | รายชื่อจังหวัดทั้ง 77 จังหวัดตามพื้นที่รับผิดชอบ 6 ภาค และผลต่อ `IN_REGION` |
| [`authentication/`](./authentication/README.md)                             | Login และ current-user profile                                     |
| [`menu-badges/`](./menu-badges/README.md) | จุด Badge งานค้าง เหตุการณ์ และ Chat ของบัญชีปัจจุบันครบ 7 เมนู |
| [`connected-measurement-points/`](./connected-measurement-points/README.md) | Contract ที่หน้าหลัก, ขอเชื่อมต่อ และ กวภ. ใช้ร่วมกัน              |
| [`notification-recipients/`](./notification-recipients/README.md)           | การตั้งค่าผู้รับอีเมลเจ้าหน้าที่                                   |
| [`internal-tools/`](./internal-tools/README.md)                             | Internal-only endpoints เช่น email test                            |

- [นโยบายอัปโหลดไฟล์ทั่วไป](./file-uploads/README.md) — กฎกรองโปรแกรม สคริปต์ macro และ ZIP ที่ใช้ร่วมกันทุกเมนู

Canonical links จะเพิ่มเมื่อแต่ละ contract ตรวจเทียบกับ implementation และ tests แล้ว
