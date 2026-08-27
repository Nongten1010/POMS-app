# Integration API Index

API contract ในกลุ่มนี้ใช้สำหรับอุปกรณ์ worker หรือระบบภายนอก ไม่ใช่ API navigation ตามหน้า frontend

Swagger UI ที่ `GET /api/v1/docs` จะแยกกลุ่มนี้ไว้ใต้ `ระบบเชื่อมต่อภายนอก` และบาง endpoint ที่ใช้ร่วมกับงานเจ้าหน้าที่อาจถูกจัด tag ตามเมนูการใช้งานแทน canonical directory

## Canonical Target Map

| Directory                                               | Contract                                          |
| ------------------------------------------------------- | ------------------------------------------------- |
| [`device-configs/`](./device-configs/README.md)         | ระบบภายนอกดึง device, parameter และ status config |
| [`alert-events/`](./alert-events/README.md)             | ระบบภายนอกส่ง alert events รายชั่วโมง             |
| [`factory-dashboard/`](./factory-dashboard/README.md)   | ระบบภายนอกอ่าน dashboard รายชั่วโมงของหนึ่งโรงงาน |
| [`device-connections/`](./device-connections/README.md) | Connection configuration และ connection test      |

Canonical links จะเพิ่มเมื่อแต่ละ contract ตรวจเทียบกับ implementation และ tests แล้ว
