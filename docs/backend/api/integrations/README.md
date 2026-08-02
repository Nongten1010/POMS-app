# Integration API Index

API contract ในกลุ่มนี้ใช้สำหรับอุปกรณ์ worker หรือระบบภายนอก ไม่ใช่ API navigation ตามหน้า frontend

## Canonical Target Map

| Directory | Contract |
| --- | --- |
| [`device-configs/`](./device-configs/README.md) | ระบบภายนอกดึง device, parameter และ status config |
| [`alert-events/`](./alert-events/README.md) | ระบบภายนอกส่ง alert events รายชั่วโมง |
| `device-connections/` | Connection configuration และ connection test |

Canonical links จะเพิ่มเมื่อแต่ละ contract ตรวจเทียบกับ implementation และ tests แล้ว
