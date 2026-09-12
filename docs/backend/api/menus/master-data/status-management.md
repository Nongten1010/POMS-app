# จัดการสถานะโรงงาน จุดตรวจวัด และพารามิเตอร์ (Admin)

> Owner: Backend

## Frontend Quick Start

ใช้ `GET /api/v1/poms-factories/:factoryId/status-management` เมื่อเปิดปุ่ม **จัดการสถานะ** และใช้ `PATCH` ที่ URL เดียวกันเมื่อบันทึกทั้งหน้าต่าง โดยอ่าน `revision` ล่าสุดและส่งกลับเป็น `expectedRevision` ทุกครั้ง

```bash
curl '<BASE_URL>/api/v1/poms-factories/<FACTORY_ID>/status-management' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'

curl -X PATCH '<BASE_URL>/api/v1/poms-factories/<FACTORY_ID>/status-management' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  --data '{"expectedRevision":0,"factory":{"visibility":"HIDDEN"}}'
```

บัญชีต้องมี JWT `roles` ที่มี `admin` ไม่ได้ตรวจจากชื่อผู้ใช้หรือ `userType` เพียงอย่างเดียว ดังนั้น Admin ที่ล็อกอินเป็น `userType=officer` ใช้ได้

| Endpoint | Permission / scope |
| --- | --- |
| `GET /api/v1/poms-factories/:factoryId/status-management` | `admin` + `factories:view` และโรงงานต้องอยู่ใน scope |
| `PATCH /api/v1/poms-factories/:factoryId/status-management` | `admin` + `factories:view` + `factories:edit` และโรงงานต้องอยู่ใน scope ทั้งสอง permission |

## ความหมายของสถานะ

| ระดับ | ซ่อน/แสดง | สถานะการเชื่อมต่อ |
| --- | --- | --- |
| โรงงาน | `visibility: VISIBLE / HIDDEN` | `connectionStatus: CONNECTED / DISCONNECTED` |
| จุดตรวจวัด | เช่นเดียวกับโรงงาน | เช่นเดียวกับโรงงาน |
| พารามิเตอร์ในจุดตรวจวัด | `visibility: VISIBLE / HIDDEN` | ไม่มี field นี้; ใช้สถานะของจุดตรวจวัด |

- ค่าเริ่มต้นของ current/live POMS คือ `VISIBLE` และ `CONNECTED`, `revision=0`
- สรุป visibility จากลูกขึ้นแม่: พารามิเตอร์ปัจจุบันทั้งหมดซ่อน → จุดซ่อน; มีอย่างน้อยหนึ่งตัวแสดง → จุดแสดง โรงงานสรุปจากจุดที่ยัง `CONNECTED` ด้วยกฎเดียวกัน
- PATCH visibility ที่โรงงานจะตั้ง visibility ของทุกจุดและทุกพารามิเตอร์ปัจจุบันให้เหมือนกัน; PATCH visibility ที่จุดจะตั้งทุกพารามิเตอร์ของจุดนั้น จากนั้นคำนวณสถานะแม่ใหม่
- เมื่อส่งหลายระดับใน PATCH เดียว ใช้ลำดับ โรงงาน → จุด → พารามิเตอร์ → สรุปสถานะแม่ การระบุลูกชัดเจนจึงชนะคำสั่งแม่ เช่น ซ่อนโรงงานพร้อมเปิด CO หนึ่งตัวจะทำให้จุดนั้นและโรงงานเป็นแสดง
- เปิดพารามิเตอร์อย่างน้อยหนึ่งตัวจะเปิด visibility ของจุดและโรงงาน แต่ไม่เปลี่ยน `connectionStatus` ของจุดหรือโรงงานที่ยกเลิกอยู่; ป้ายยกเลิกการเชื่อมต่อมีลำดับก่อนซ่อน/แสดง
- จุดที่ `DISCONNECTED` ไม่นำมาสรุป visibility โรงงาน ถ้าไม่มีจุดที่ CONNECTED เลย ให้คง visibility โรงงานเดิม ไม่อนุมานว่าต้องยกเลิกโรงงานด้วย ส่วนจุดที่ไม่มีพารามิเตอร์ใช้ visibility ที่บันทึกไว้
- GET คำนวณจากรายการลูก current/live ทุกครั้ง รวมข้อมูลที่บันทึกก่อนเพิ่มกฎนี้ โดยไม่เขียนฐานข้อมูลหรือเพิ่ม revision ขณะอ่าน ค่าของจุด/พารามิเตอร์ที่ไม่อยู่ในรายการปัจจุบันไม่นำมาสรุป
- `DISCONNECTED` ของโรงงานทำให้ `effectiveConnectionStatus` ของทุกจุดเป็น `DISCONNECTED` โดยไม่ทับค่ารายจุด ไม่ลบโรงงาน จุดตรวจวัด หรือพารามิเตอร์
- จุดที่ยังไม่มีค่าบันทึกใช้ visibility โรงงานเป็นค่าเริ่มต้น; พารามิเตอร์ที่ยังไม่มีค่าบันทึกใช้ visibility จุดเป็นค่าเริ่มต้น; connectionStatus รายจุดเริ่มต้นเป็น CONNECTED แต่รับผลการยกเลิกจากโรงงาน
- `connectionStatus` เป็นสถานะการบริหารในระบบ POMS การตั้งกลับเป็น `CONNECTED` ไม่ใช่การทดสอบการเชื่อมต่อจริงหรือคำสั่งเปิดอุปกรณ์
- การบันทึกนี้ไม่เปลี่ยนคำขอเชื่อมต่อเดิม, `monitoringPointStatus`, `deleted_at`, config อุปกรณ์, การรับ telemetry หรือข้อมูลรายงานย้อนหลัง
- การซ่อนเป็นสถานะการแสดงผล ไม่ใช่การถอนสิทธิ์อ่านข้อมูล API เดิม รายการข้อมูลพื้นฐานยังคืนโรงงานที่ซ่อน/ยกเลิกไว้เพื่อให้จัดการต่อได้; frontend ที่แสดงข้อมูลตามสถานะต้องอ่านค่า effective และเชื่อม API นี้ รายการ current POMS ใช้สถานะบริหารชุดเดียวกัน โดยไม่ลบแถวหรือเปลี่ยนประวัติคำขอ
- [หน้าขอเชื่อมต่อของผู้ประกอบการ](../connection-requests/README.md#operator-factory-list-source) (`GET /cems-wpms-requests/operator-factories`) และรายการเจ้าหน้าที่ (`GET /cems-wpms-requests/eligible-factories`) ยังคงคืนแถวและรายละเอียดโรงงานทุกสถานะตามสิทธิ์ โดยใช้สถานะจริงเป็นป้ายกำกับ และนับ `meta.total` รวมโรงงานที่ซ่อน/ยกเลิกการเชื่อมต่อด้วย

### Mapping ตัวเลือกในหน้าต่าง

| ตัวเลือกโรงงาน/จุด | Patch ที่ส่ง |
| --- | --- |
| แสดง | `{"visibility":"VISIBLE","connectionStatus":"CONNECTED"}` |
| ซ่อน | `{"visibility":"HIDDEN","connectionStatus":"CONNECTED"}` — dropdown เปลี่ยนเป็นซ่อนแทนสถานะยกเลิกเดิม |
| ยกเลิกการเชื่อมต่อ | `{"connectionStatus":"DISCONNECTED"}` — คงค่าการแสดงผลเดิม |

หาก frontend ใช้ dropdown เดียว ให้แสดง `ยกเลิกการเชื่อมต่อ` ก่อนเมื่อ connectionStatus เป็น `DISCONNECTED` ส่วนรายการโรงงาน `GET /poms-factories` คืน `status` ตามลำดับนี้แล้ว พารามิเตอร์มีเฉพาะ แสดง=`VISIBLE`, ซ่อน=`HIDDEN`

## GET: เปิดหน้าต่างสถานะ

`factoryId` รองรับ identifier เดียวกับ [รายละเอียดโรงงาน](./factory-edit-requests.md) และต้องยาว 1–80 ตัวอักษร

| Response field | Type | ความหมาย |
| --- | --- | --- |
| `eligibleFactoryId` | integer | รหัสกลุ่มโรงงาน current/live |
| `factoryId`, `factoryName` | string | โรงงานเป้าหมาย |
| `revision` | integer ≥ 0 | เวอร์ชันของสถานะทั้งหน้าต่าง |
| `updatedAt`, `updatedBy` | ISO date-time/null, integer/null | การแก้สถานะล่าสุด; null เมื่อยังไม่เคยตั้ง |
| `factory.visibility`, `factory.connectionStatus` | enum | ค่าที่ตั้งรายโรงงาน |
| `factory.status` | แสดง/ซ่อน/ยกเลิกการเชื่อมต่อ | ป้ายสถานะบริหารที่มีผลจริง |
| `factory.connectionStatusLabel` | เชื่อมต่อแล้ว/ยกเลิกการเชื่อมต่อ | ป้ายการเชื่อมต่อ |
| `measurementPoints[].connectedPointId` | integer | identity ของ current connected point ใช้ส่ง PATCH |
| `pointCode`, `pointName`, `systemType` | string/null, string, CEMS/WPMS | ข้อมูลระบุจุด |
| `visibility`, `connectionStatus` ของจุด | enum | ค่าที่ตั้งเฉพาะจุด |
| `effectiveVisibility`, `effectiveConnectionStatus` ของจุด | enum | ค่าหลังรวมผลจากโรงงาน |
| `parameters[].parameter` | string | key จาก current connected parameters ให้ส่งกลับตรงตัว |
| `parameters[].displayName` | string | ชื่อพารามิเตอร์พร้อมหน่วย; ห้ามใช้ชื่อที่แปลเองเป็น key |
| `parameters[].visibility`, `effectiveVisibility` | enum | ค่ารายพารามิเตอร์ และค่ารวมผลจากโรงงาน/จุด |

```json
{
  "success": true,
  "data": {
    "eligibleFactoryId": 7,
    "factoryId": "F1",
    "factoryName": "โรงงานตัวอย่าง",
    "revision": 0,
    "updatedAt": null,
    "updatedBy": null,
    "factory": {
      "visibility": "VISIBLE", "connectionStatus": "CONNECTED",
      "status": "แสดง", "connectionStatusLabel": "เชื่อมต่อแล้ว"
    },
    "measurementPoints": [{
      "connectedPointId": 11, "pointCode": "S0011", "pointName": "Boiler", "systemType": "CEMS",
      "visibility": "VISIBLE", "connectionStatus": "CONNECTED",
      "effectiveVisibility": "VISIBLE", "effectiveConnectionStatus": "CONNECTED",
      "parameters": [{"parameter":"CO","displayName":"CO (ppm)","visibility":"VISIBLE","effectiveVisibility":"VISIBLE"}]
    }]
  }
}
```

## PATCH: บันทึกทั้งหน้าต่าง

| Request field | Required | ข้อกำหนด |
| --- | --- | --- |
| `expectedRevision` | yes | integer 0–2147483646; ใช้ revision จาก GET ล่าสุด |
| `factory` | no | object ไม่ว่าง; ส่ง visibility และ/หรือ connectionStatus |
| `measurementPoints` | no | array 1–200 จุด; ต้องไม่ซ้ำ connectedPointId |
| `measurementPoints[].connectedPointId` | yes | positive safe integer; ต้องอยู่ในโรงงานเป้าหมาย |
| `measurementPoints[].visibility`, `.connectionStatus` | no | enum ตามตาราง; connectionStatus ที่ไม่ส่งคงค่าเดิม; visibility อาจเปลี่ยนตามคำสั่งแม่หรือผลสรุปจากลูก |
| `measurementPoints[].parameters` | no | array 1–100 รายการ; ห้าม parameter ซ้ำในจุดเดียวกันโดยไม่แยกตัวพิมพ์เล็กใหญ่ |
| `parameters[].parameter`, `.visibility` | yes | key 1–200 ตัวอักษร และ enum; ต้องเป็นพารามิเตอร์ที่เชื่อมต่ออยู่ในจุดนั้น |

ต้องส่ง `factory` หรือ `measurementPoints` อย่างน้อยหนึ่งอย่าง แต่ละจุดต้องมีการเปลี่ยนค่าอย่างน้อยหนึ่ง field ไม่ต้องระบุเหตุผล และไม่รับฟิลด์ `reason` ห้ามส่ง field นอกสัญญา เช่น `actorUserId` หรือ `parameters[].connectionStatus`

```json
{
  "expectedRevision": 0,
  "factory": {"visibility":"VISIBLE"},
  "measurementPoints": [{
    "connectedPointId": 11,
    "connectionStatus": "DISCONNECTED",
    "parameters": [{"parameter":"CO","visibility":"HIDDEN"}]
  }]
}
```

สำเร็จตอบ `200` รูปแบบเดียวกับ GET พร้อมสถานะหลังบันทึกและ revision ใหม่ บันทึกสถานะและ audit ทั้งชุดใน transaction เดียว ถ้าพบข้อมูลข้ามโรงงาน, parameter ไม่ถูกต้อง, หรือบันทึก audit ไม่สำเร็จ จะไม่บันทึกส่วนใด การบันทึก state ที่เหมือนเดิมทุกประการด้วย revision ปัจจุบันไม่เพิ่ม revision/audit; ส่ง revision เก่าซ้ำตอบ `409`

### ตัวอย่างเปิดจากลูกขึ้นแม่

เมื่อพารามิเตอร์ของทุกจุดซ่อนอยู่ ส่งเฉพาะพารามิเตอร์ที่ต้องการเปิด:

```json
{"expectedRevision":4,"measurementPoints":[{"connectedPointId":11,"parameters":[{"parameter":"CO","visibility":"VISIBLE"}]}]}
```

หากโรงงานและจุดยัง CONNECTED, response ของ PATCH และ GET จะมี `factory.status = "แสดง"`, จุด 11 `status = "แสดง"` และพารามิเตอร์อื่นคงซ่อนอยู่ ไม่ต้องส่ง visibility ของแม่ตามไปด้วย หน้า client ที่ยังไม่คำนวณขณะเลือกจะเห็นผลเมื่อบันทึกและโหลด response ใหม่

## Errors

ใช้ [error envelope กลาง](../../shared/common-api/README.md) ของระบบ

| HTTP / code | สาเหตุ | Frontend |
| --- | --- | --- |
| `400 VALIDATION_ERROR` | ค่าว่าง, enum ผิด, field เกิน, ID/parameter ซ้ำ | แสดงข้อผิดพลาดราย field |
| `401 UNAUTHORIZED` | JWT ไม่ถูกต้อง/หมดอายุ | เข้าสู่ระบบใหม่ |
| `403 FORBIDDEN` | ไม่มี role admin หรือ permission | ไม่แสดง action สำหรับผู้ใช้นี้ |
| `404 NOT_FOUND` | ไม่พบ current factory, นอก scope, จุดข้ามโรงงาน, parameter ไม่อยู่ในจุด | โหลดรายการใหม่ |
| `409 CONFLICT` | revision เก่า หรือข้อมูลพารามิเตอร์ต้นทางผิดรูปแบบ | โหลด GET ใหม่แล้วให้ผู้ใช้ตรวจการเปลี่ยนแปลงก่อนบันทึก |
| `500 INTERNAL_ERROR` | การบันทึกล้มเหลว | ไม่ถือว่าบันทึกสำเร็จ; backend rollback ทั้งชุด |

## Backend implementation และการส่งต่อ

- Migration: `backend/src/db/migrations/0113_create_poms_status_management.ts` ต้องรันก่อน backend รุ่นนี้ ใช้ตารางสถานะตาม `eligible_factory_id` และ audit แยกต่างหาก
- Routes/validator/service/repository: `backend/src/modules/poms-factories/poms-status-management.*`
- Lock: ล็อกโรงงาน `UPDLOCK, HOLDLOCK` ก่อนอ่าน revision/insert/update และอ่าน current points ภายใน transaction เพื่อป้องกัน first-insert race
- Audit เก็บ actor จาก JWT, revision, before/after และ patch; คอลัมน์ reason เดิมใช้ข้อความระบบ `อัปเดตสถานะผ่าน status-management` จึงไม่ต้องเปลี่ยน schema ฐานข้อมูลสำหรับการถอด reason จาก request; API นี้ไม่รับ reason หรือ actor จาก body
- Runtime OpenAPI: `backend/src/modules/api-docs/poms-status-management.openapi.ts`
- Tests: `backend/tests/unit/poms-status-management.*.test.ts`
- [หลักฐานการตรวจและทดสอบ](../../../evidence/master-data/status-management.md)
- Frontend ผูก GET/PATCH และโหลดรายการ/รายละเอียดที่เปิดอยู่ใหม่หลังสำเร็จ; dialog ใช้ status/effective fields แทน monitoringPointStatus

## สถานะเดียวกันใน API อ่านข้อมูล current POMS

GET `/poms-factories/{factoryId}` คืน fields ต่อไปนี้ทั้งระดับโรงงานและใน `measurementPoints[]`:

| Field | Type | ความหมาย |
| --- | --- | --- |
| status | แสดง / ซ่อน / ยกเลิกการเชื่อมต่อ | ป้ายสถานะบริหารที่มีผลจริง |
| visibility | VISIBLE / HIDDEN | ค่าที่สรุปจากลูกปัจจุบันตามกฎด้านบน |
| connectionStatus | CONNECTED / DISCONNECTED | ค่าการเชื่อมต่อที่ตั้งเฉพาะระดับนั้น |
| effectiveVisibility | VISIBLE / HIDDEN | visibility หลังสรุปจากลูกและรวมผลโรงงานแม่ |
| effectiveConnectionStatus | CONNECTED / DISCONNECTED | สถานะการเชื่อมต่อที่รวมผลจากโรงงานแม่ |

```json
{"status":"ซ่อน","visibility":"HIDDEN","connectionStatus":"CONNECTED","effectiveVisibility":"HIDDEN","effectiveConnectionStatus":"CONNECTED"}
```

ตัวอย่างคือจุดที่พารามิเตอร์ปัจจุบันทั้งหมดซ่อน เมื่อเปิดพารามิเตอร์หนึ่งตัว visibility จุดกลับเป็น VISIBLE; `DISCONNECTED` มีลำดับก่อน `HIDDEN` เสมอ

GET `/poms-factories` คืน status ระดับโรงงานจากตัวสรุปเดียวกับ GET รายละเอียดและ status-management เมื่อจุด CONNECTED ทั้งหมดซ่อน โรงงานซ่อน; มีหนึ่งจุดแสดง โรงงานแสดง จำนวนจุดและแถวที่ซ่อนยังอยู่เพื่อให้จัดการต่อได้

API รายการจุดตรวจวัดที่เชื่อมต่อ (`/connected-measurement-points` และ alias) ใช้สถานะบริหารใน `status` ส่วน `statusCode` ยังคงเป็นสถานะคำขอเดิม จุดในข้อมูลโรงงาน dashboard/overview/map รับ effective fields เดียวกัน และสถานะโรงงานมาจากค่าระดับโรงงาน

`monitoringPointStatus` ยังคงหมายถึงขั้นตอนการเชื่อมต่อเดิมและไม่ถูกเขียนทับ การซ่อน/ยกเลิกนี้ไม่สั่งปิดอุปกรณ์ ไม่หยุดรับ telemetry และไม่เปลี่ยนสถานะรายงานย้อนหลัง
