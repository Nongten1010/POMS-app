# APIDoc

เอกสาร API สำหรับส่งต่อให้ frontend/Postman โดยไม่ต้องแก้ไฟล์ frontend

`CEMS_WPMS_REQUEST_APIS.md` เป็นเอกสารหลักของ API คำขอ CEMS/WPMS ให้ยึดไฟล์นี้เป็น source of truth สำหรับ payload, response, field mapping และตัวอย่าง curl.

## Files

| File | Description |
| --- | --- |
| [CEMS_WPMS_REQUEST_APIS.md](./CEMS_WPMS_REQUEST_APIS.md) | API คำขอ CEMS/WPMS ครบ 10 รายการ พร้อมตัวอย่าง request/response และ field mapping ทุกช่อง |
| [INTEGRATION_DEVICE_CONFIGS.md](./INTEGRATION_DEVICE_CONFIGS.md) | API สำหรับระบบภายนอก/worker ดึง active device config, parameter config, และ status schedule ด้วย `X-API-Key` |
| [OPERATOR_FACTORY_DASHBOARD.md](./OPERATOR_FACTORY_DASHBOARD.md) | API เฉพาะหน้าแผนที่/รายการโรงงาน CEMS/WPMS, favorite, ตารางค่าตรวจวัดล่าสุด และหน้ารายละเอียดจุดตรวจวัด |
| [live-api-responses/](./live-api-responses/README.md) | ผลยิง API จริงแยกตาม endpoint สำหรับตรวจ response, พารามิเตอร์ และ status |
