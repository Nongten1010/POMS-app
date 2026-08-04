# Frontend handoff: ตั้งค่าอุปกรณ์

[กลับไป Backend Guides](../../README.md)

เอกสารชุดนี้เป็น handoff ที่ backend ดูแลสำหรับ dialog **ตั้งค่าอุปกรณ์** ในหน้าขอเชื่อมต่อ ใช้สำหรับส่งให้ทีม frontend อ่านและลงมือแก้ โดย API contract ฉบับเต็มยังอยู่ที่ [ตั้งค่าอุปกรณ์ของจุดตรวจวัด](../../../api/menus/connection-requests/device-configs.md) เพียงแห่งเดียว

Path สำหรับส่งต่อ:

```text
docs/backend/guides/frontend-handoffs/device-config/README.md
```

## สถานะปัจจุบัน

- Backend และฐานข้อมูลรองรับ `statusManagement.schedules[]` หลายช่วงแล้ว
- Frontend ยังมีงาน P0 ก่อนใช้งานหลายช่วงแบบ end-to-end ได้ครบ
- Database table names และ nullable channel/settings ส่วนใหญ่มีใน frontend แล้ว ให้คงพฤติกรรมและเพิ่ม regression test
- `POMS Box` ใช้ `POMS_BOX` เป็น protocol ของตัวเอง; ห้าม map เป็น protocol อื่น
- เอกสารชุดนี้ไม่ใช่ frontend progress tracker เมื่อทีม frontend แก้เสร็จให้ทดสอบตาม checklist และอ้างอิง API contract เป็นหลัก

## Endpoint ที่ dialog ใช้

| Context | Method | Path |
| --- | --- | --- |
| อ่านค่าของคำขอ | `GET` | `/api/v1/cems-wpms-requests/:id/device-configs?stationId=:stationId` |
| บันทึกค่าระหว่างคำขอ | `POST` | `/api/v1/cems-wpms-requests/:id/device-configs` |
| อ่านค่าจุดที่เชื่อมต่อแล้ว | `GET` | `/api/v1/connected-measurement-points/:stationId/device-configs` |
| แทนที่ค่าจุดที่เชื่อมต่อแล้ว | `POST` | `/api/v1/connected-measurement-points/:stationId/device-configs` |

ทั้งสอง context ใช้ dialog และ shared request contract ชุดเดียวกัน แต่เลือก URL และรูปแบบ wrapper ตามจำนวนอุปกรณ์/จุดเริ่มต้นของ dialog

## เอกสารแยกตามเรื่อง

| เรื่อง | Priority | อ่านเมื่อ |
| --- | --- | --- |
| [ตั้งสถานะหลายช่วง](./status-schedules.md) | P0 | แก้ local datetime format, enum, payload, overlap และ load/save schedules |
| [Device settings และ parameter channels](./device-settings-and-channels.md) | P0/P1 | ตรวจ nullable fields, dropdown mappings, table names และ `POMS_BOX` |
| [Validation และ error handling](./validation-and-errors.md) | P0 | ทำ client validation และแสดง `error.issues[]`/`error.details` ตรง field |
| [Test checklist](./test-checklist.md) | Release gate | ทดสอบทั้ง request endpoint และ connected-point endpoint |

## จุดแก้ไขหลักใน frontend

ไฟล์ปัจจุบันรวม dialog, mapper และ payload builder ไว้ที่ [`frontend/src/pages/ConnectionRequestPage.jsx`](../../../../../frontend/src/pages/ConnectionRequestPage.jsx) โดยส่วนที่เกี่ยวข้องคือ:

- `connectionParameterStatusOptions`
- `StatusManagementSection`
- `buildConnectionSettings`
- `buildDeviceConfigChannels`
- `buildDeviceConfigStatusManagement`
- `buildCurrentDeviceConfigRequest`
- `saveDeviceConfig`

ทีม frontend แยก helper/tests ออกเป็นไฟล์ย่อยได้ตามโครงสร้างของ frontend แต่ payload สุดท้ายต้องตรง canonical contract

## แหล่งที่ตรวจสอบแล้ว

เอกสารชุดนี้ตรวจเทียบกับ:

- Contract: [`device-configs.md`](../../../api/menus/connection-requests/device-configs.md)
- Validator: [`device-connections.validator.ts`](../../../../../backend/src/modules/device-connections/device-connections.validator.ts)
- Types/status enum: [`device-connections.types.ts`](../../../../../backend/src/modules/device-connections/device-connections.types.ts)
- Parameter validation: [`connection-requests.service.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.service.ts)
- Error envelope: [`errorHandler.ts`](../../../../../backend/src/shared/middlewares/errorHandler.ts)
- Route tests: [`connection-requests.create.route.test.ts`](../../../../../backend/tests/unit/connection-requests.create.route.test.ts)
- Service tests: [`connection-requests.service.test.ts`](../../../../../backend/tests/unit/connection-requests.service.test.ts)

## กติกาการใช้งานเอกสาร

- ส่ง path ของ README นี้ให้ frontend เป็นจุดเข้าเดียว
- อย่าคัดลอก field table จาก canonical contract มาแก้แยกอีกชุด
- หาก contract กับ backend code/tests ไม่ตรงกัน ให้หยุดและแจ้ง backend ก่อนแก้ frontend
- ห้ามใช้เอกสารเดิมใต้ `frontend/md/` เป็น contract สำหรับงานนี้
