# Shared API Index

API contract ในกลุ่มนี้ใช้ข้ามหลายเมนูและไม่ควรถูกคัดลอกเข้าเอกสารของแต่ละเมนู ตัวอย่างเช่น authentication, current-user profile, user management และ permissions

## Canonical Target Map

| Directory | Contract |
| --- | --- |
| `common-api/` | Base URL, headers, response envelope, pagination และ shared errors |
| `authentication/` | Login และ current-user profile |
| [`connected-measurement-points/`](./connected-measurement-points/README.md) | Contract ที่หน้าหลัก, ขอเชื่อมต่อ และ กวภ. ใช้ร่วมกัน |
| `notification-recipients/` | การตั้งค่าผู้รับอีเมลเจ้าหน้าที่ |
| `internal-tools/` | Internal-only endpoints เช่น email test |

Canonical links จะเพิ่มเมื่อแต่ละ contract ตรวจเทียบกับ implementation และ tests แล้ว
