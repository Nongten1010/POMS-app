# Frontend Handoff: เจ้าหน้าที่ส่งฟอร์มเพิ่มจุดตรวจวัด

[กลับไปหน้าเมนู](./README.md) · [ดู payload และ validation ฉบับเต็ม](./request-payloads-and-validation.md#post-apiv1cems-wpms-requestsmeasurement-points)

## `POST /api/v1/cems-wpms-requests/measurement-points`

หน้าเพิ่มจุดตรวจวัดของเจ้าหน้าที่ส่งสถานะที่เลือกไปพร้อม request body เดิมผ่าน `submissionAction` โดยไม่ต้องเรียก API เปลี่ยนสถานะซ้ำ

### ค่าที่ frontend ต้องส่ง

| ตัวเลือกบนหน้าจอ | `submissionAction` | สถานะใน response | Field ที่ต้องส่งเพิ่ม |
| --- | --- | --- | --- |
| รอโรงงานแก้ไข | `REQUEST_FACTORY_REVISION` | `WAITING_FACTORY_REVISION` | `revisionReason` |
| เชื่อมต่อแล้ว | `CONNECT` | `CONNECTED` | `measurementPoints` ต้องมี 1 รายการและต้องมี `measurementPoints[0].pointCode` |

สำหรับหน้าจอเจ้าหน้าที่ ให้บังคับเลือกหนึ่งค่าใน UI แม้ field นี้ยังเป็น optional ใน API เพื่อรองรับ client เดิม หากไม่ส่ง `submissionAction` backend จะใช้ flow เดิมและสร้าง `PENDING_DESIGN_REVIEW`

### Authentication And Permission

- Authentication: required bearer access token
- Permission พื้นฐาน: `cems_wpms_requests:edit`
- Actor: `userType` ต้องเป็น `officer` หรือ `admin` และมี role `monitoring_kpm` หรือ `admin`
- เมื่อเลือก `CONNECT`: ต้องมี `cems_wpms_requests:direct_connect` เพิ่ม และโรงงานต้องอยู่ใน direct-connect scope

### Request Fields ที่เพิ่มจากฟอร์มเดิม

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `submissionAction` | body | enum | สำหรับ UI ใหม่ให้ส่งเสมอ | `REQUEST_FACTORY_REVISION` หรือ `CONNECT`; ห้ามส่ง `null` |
| `revisionReason` | body | string | เมื่อเลือก `REQUEST_FACTORY_REVISION` | trim แล้วต้องไม่ว่างและยาวไม่เกิน 1000 ตัวอักษร |
| `officerNote` | body | string \| null | No | หมายเหตุภายในของเจ้าหน้าที่; trim แล้วไม่เกิน 1000 ตัวอักษร |

Field อื่นใช้ request body ของฟอร์มเพิ่มจุดเดิมทั้งหมด ห้ามส่ง `status` มากับ endpoint นี้; `status` เป็น legacy field ของ `/direct-connections` เท่านั้น

### Request Example: รอโรงงานแก้ไข

นำ field เหล่านี้ไปรวมกับ payload ฟอร์มเดิม:

```json
{
  "submissionAction": "REQUEST_FACTORY_REVISION",
  "revisionReason": "กรุณาแก้ไขข้อมูลเครื่องมือวัดและแนบเอกสารเพิ่มเติม",
  "officerNote": "ตรวจแบบครั้งแรกแล้ว"
}
```

### Request Example: เชื่อมต่อแล้ว

ตัวอย่างนี้แสดงเฉพาะ field ที่เกี่ยวข้องกับ action; object ของจุดตรวจวัดยังต้องผ่าน validation ของฟอร์มเดิม

```json
{
  "submissionAction": "CONNECT",
  "officerNote": "ข้อมูลครบและพร้อมเชื่อมต่อ",
  "measurementPoints": [
    {
      "pointCode": "S2201"
    }
  ]
}
```

### Success Response Fields

ตอบ `201 Created` ด้วย connection-request DTO เดิม โดย frontend ใช้ field ต่อไปนี้เพื่ออัปเดตหน้าจอ:

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | เป็น `true` |
| `data.id` | integer | No | ID ของคำขอที่สร้าง |
| `data.requestType` | string | No | เป็น `ADD_MEASUREMENT_POINT` |
| `data.status` | string | No | `WAITING_FACTORY_REVISION` หรือ `CONNECTED` ตาม action |
| `data.statusLabel` | string | No | `รอโรงงานแก้ไข` หรือ `เชื่อมต่อแล้ว` |
| `data.revisionReason` | string | Yes | เหตุผลที่ต้องแก้ไข หรือ `null` |
| `data.officerNote` | string | Yes | หมายเหตุเจ้าหน้าที่ หรือ `null` |
| `data.measurementPoints[].pointCode` | string | Yes | `CONNECT` คืนรหัสที่ส่งมา; `REQUEST_FACTORY_REVISION` อาจคืน `null` ระหว่างรอแก้ไข |

### Success Response Example

```json
{
  "success": true,
  "data": {
    "id": 101,
    "requestType": "ADD_MEASUREMENT_POINT",
    "status": "WAITING_FACTORY_REVISION",
    "statusLabel": "รอโรงงานแก้ไข",
    "revisionReason": "กรุณาแก้ไขข้อมูลเครื่องมือวัดและแนบเอกสารเพิ่มเติม",
    "officerNote": "ตรวจแบบครั้งแรกแล้ว",
    "measurementPoints": [
      {
        "pointName": "ปล่องระบาย A",
        "pointCode": null
      }
    ]
  }
}
```

### Frontend Behavior

1. เปิด dialog ยืนยันส่งและให้เจ้าหน้าที่เลือกสถานะหลังส่ง
2. ถ้าเลือก “รอโรงงานแก้ไข” ให้แสดงและบังคับช่องเหตุผลก่อนเรียก API
3. ถ้าเลือก “เชื่อมต่อแล้ว” ให้ตรวจว่ามีจุดเดียวและมี `pointCode`; ซ่อนตัวเลือกนี้หากผู้ใช้ไม่มี direct-connect permission
4. ส่ง `submissionAction`, `revisionReason` และ `officerNote` ไปพร้อม payload ฟอร์มเดิมใน request เดียว
5. หลังได้ `201` ให้อัปเดต UI จาก `data.status` ใน response ไม่ใช้ค่าที่เลือกบนหน้าจอเป็น source of truth
6. เมื่อได้ validation error ให้ map `details.issues[].pathString` กลับไปยัง field ที่เกี่ยวข้อง

### Validation And Business Rules

- Backend ปฏิเสธ action ของเจ้าหน้าที่ด้วย `403 FORBIDDEN` หาก actor/role ไม่ถูกต้อง
- `CONNECT` ตรวจ direct-connect permission ก่อน lookup ข้อมูลโรงงาน
- `CONNECT` ต้องมี exactly 1 measurement point และ `pointCode` ที่ trim แล้วไม่ว่าง
- `REQUEST_FACTORY_REVISION` ต้องมี `revisionReason`
- Request body เป็น strict object; unknown field ถูกปฏิเสธ
- ไม่ควร retry `POST` อัตโนมัติ เพราะอาจสร้างคำขอซ้ำ ให้ disable ปุ่มระหว่างส่งและ refresh รายการเมื่อไม่แน่ใจว่าคำขอสำเร็จหรือไม่

### Errors

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Frontend action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` หรือ `BAD_REQUEST` | ขาด `revisionReason`, จำนวนจุด/`pointCode` ไม่ถูกต้อง หรือ payload ไม่ผ่าน validation | แสดงข้อความที่ field จาก `details.issues[]` และไม่ส่งซ้ำจนกว่าจะแก้ |
| `401` | `UNAUTHORIZED` | token ไม่มีหรือหมดอายุ | ให้ผู้ใช้เข้าสู่ระบบใหม่ |
| `403` | `FORBIDDEN` | actor/role ไม่รองรับ หรือไม่มี permission สำหรับ action | ซ่อน action ที่ไม่มีสิทธิ์และแจ้งผู้ใช้ |
| `404` | `NOT_FOUND` | ไม่พบ active eligible factory ภายใน scope | refresh ข้อมูลโรงงานและสิทธิ์ |
| `409` | `CONFLICT` | `pointCode` ของ `CONNECT` ชนกับ active connected point | ให้เจ้าหน้าที่เปลี่ยนรหัสจุดและส่งใหม่ |

### ข้อจำกัดปัจจุบัน

การเลือก `REQUEST_FACTORY_REVISION` เปลี่ยนสถานะเริ่มต้นของคำขอเท่านั้น แต่ `PUT /api/v1/cems-wpms-requests/:id/form` ยังเป็น owner-only ดังนั้นคำขอที่เจ้าหน้าที่สร้างยังไม่ได้ให้สิทธิ์บัญชีโรงงานแก้และ resubmit โดยอัตโนมัติ

## Backend Maintainer Links

- Route: [`connection-requests.routes.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.routes.ts)
- Controller: [`connection-requests.controller.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.controller.ts)
- Validator: [`connection-requests.validator.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.validator.ts)
- Types: [`connection-requests.types.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.types.ts)
- Service: [`connection-requests.service.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.service.ts)
- Repository: [`connection-requests.repository.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.repository.ts)
- Tests: [`connection-requests.validator.test.ts`](../../../../../backend/tests/unit/connection-requests.validator.test.ts), [`connection-requests.create.route.test.ts`](../../../../../backend/tests/unit/connection-requests.create.route.test.ts), [`connection-requests.service.test.ts`](../../../../../backend/tests/unit/connection-requests.service.test.ts)
- Evidence: [`add-measurement-point-submission-action.tdd.md`](../../../evidence/connection-requests/add-measurement-point-submission-action.tdd.md)
