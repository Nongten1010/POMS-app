# ผู้ประกอบการยกเลิกคำขอเชื่อมต่อ

[กลับไปหน้าเมนู](./README.md)

## `POST /api/v1/cems-wpms-requests/:id/cancel`

ให้ผู้ประกอบการยกเลิกคำขอ `OPERATOR_FORM` ของโรงงานตนเองก่อนเชื่อมต่อสำเร็จ โดยระบบเก็บคำขอและข้อมูลประกอบไว้เป็นประวัติ เปลี่ยนสถานะเป็น `CANCELED` และเพิ่ม status history โดยไม่ลบข้อมูลเดิม.

### Authentication And Permission

- Authentication: required bearer access token.
- Permission: `cems_wpms_requests:edit`.
- Data scope: ใช้ scope ของ `cems_wpms_requests:edit` และ `regionalAccess`; `OWN_FACTORY` ต้องได้รับมอบหมายโรงงานผ่าน `user_juristics` หรือ `user_factory_access` ผู้ทำรายการไม่จำเป็นต้องตรงกับ `createdBy`.
- Submission source: รองรับเฉพาะ `OPERATOR_FORM`; ไม่ใช้กับ `OFFICER_DIRECT_API`.

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | integer | Yes | ID คำขอ ค่าต่ำสุด `1` |
| `reason` | body | string \| null | No | เหตุผลการยกเลิก; trim ก่อนบันทึก, ค่าว่างเป็น `null`, สูงสุด 1000 ตัวอักษร |

### Request Example

ไม่ส่งเหตุผล:

```json
{}
```

ส่งเหตุผล:

```json
{
  "reason": "ยุติโครงการติดตั้งระบบตรวจวัด"
}
```

### Success Response Fields

ตอบ `200 OK` ด้วย full connection-request DTO ตาม endpoint อ่านรายละเอียด โดย field สำคัญต่อการ refresh หน้าจอมีดังนี้:

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | เป็น `true` |
| `data.id` | integer | No | ID คำขอ |
| `data.status` | string | No | เป็น `CANCELED` |
| `data.statusLabel` | string | No | เป็น `ยกเลิก` |
| `data.revisionReason` | string | Yes | เหตุผลที่ส่งมา หรือ `null` |
| `data.statusHistory[]` | array | No | ประวัติสถานะ รวม event `CANCELED` ของการยกเลิกครั้งแรก |

### Success Response Example

```json
{
  "success": true,
  "data": {
    "id": 101,
    "requestNo": "CEMS-0001/2569",
    "requestType": "NEW_CONNECTION",
    "submissionSource": "OPERATOR_FORM",
    "status": "CANCELED",
    "statusLabel": "ยกเลิก",
    "revisionReason": "ยุติโครงการติดตั้งระบบตรวจวัด",
    "statusHistory": [
      {
        "status": "CANCELED",
        "statusLabel": "ยกเลิก",
        "note": "ยุติโครงการติดตั้งระบบตรวจวัด",
        "changedById": 42,
        "changedAt": "2026-07-21T12:00:00.000Z",
        "isTerminal": true
      }
    ]
  }
}
```

### Validation And Business Rules

ผู้ประกอบการยกเลิกคำขอของตนเองได้ทุกขั้นตอน ยกเว้นสถานะปลายทาง `CONNECTED` และ `CANCELED`:

| `status` | `statusLabel` ปัจจุบัน | ยกเลิกได้ |
| --- | --- | --- |
| `PENDING_DESIGN_REVIEW` | รอพิจารณาแบบ | ได้ |
| `WAITING_FACTORY_REVISION` | รอโรงงานแก้ไข | ได้ |
| `REVISED_PENDING_DESIGN_REVIEW` | แก้ไขแล้ว/รอพิจารณาแบบ | ได้ |
| `WAITING_CONNECTION` | รอโรงงานตั้งค่าอุปกรณ์ | ได้ |
| `CONNECTION_CONFIRMED` | รอเชื่อมต่อ | ได้ |
| `CONNECTED` | เชื่อมต่อแล้ว | ไม่ได้ — `409 CONFLICT` |
| `CANCELED` | ยกเลิก | ไม่ได้ — `409 CONFLICT` |

ข้อกำหนดที่เรียกสถานะปลายทางว่า “ผ่านการพิจารณา” ใช้รหัส `CONNECTED` ใน API นี้ โดย `statusLabel` ยังคงเป็น `เชื่อมต่อแล้ว`; การอนุมัติแบบที่คำขอยังอยู่ `WAITING_CONNECTION` ยังยกเลิกได้ ให้ client ใช้รหัสสถานะตัดสิน action แทนข้อความบนหน้าจอ

สำหรับปุ่มยกเลิก ให้ตรวจ permission, `createdBy`, `submissionSource = OPERATOR_FORM` และสถานะที่ยกเลิกได้ตามตาราง ทั้งหน้ารายการและรายละเอียด เมื่อสำเร็จใช้ DTO ที่ตอบกลับเพื่อ refresh สถานะ และเมื่อได้ `409` ให้อ่านรายละเอียดล่าสุดเพื่อปรับ action ตามสถานะปัจจุบัน

กติกาเพิ่มเติม:

- `CONNECTED` ยกเลิกไม่ได้; การเลิกใช้จุดที่เชื่อมต่อแล้วเป็นคนละ workflow.
- หากคำขอเป็น `CANCELED` อยู่แล้ว endpoint ตอบ `409 CONFLICT` และไม่แก้เหตุผล, เวลา, actor หรือเพิ่ม history ซ้ำ รวมกรณีมีการยกเลิกอีกคำสั่งก่อน lock แถวสำเร็จ.
- Backend lock แถวคำขอใน transaction ก่อนตรวจสถานะและเขียน history เพื่อไม่ให้ cancel แข่งกับ action อื่นแล้วสำเร็จทั้งคู่.
- ไม่ลบ request, factory snapshot, measurement points, documents, point codes หรือ device configs.
- เวอร์ชันนี้ไม่ส่ง email, push notification หรือ notification อื่น.

### Errors

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | `id` ไม่ถูกต้อง, `reason` เกิน 1000 ตัวอักษร หรือมี field ที่ contract ไม่รองรับ | แสดง validation message และไม่ retry จนกว่าจะแก้ payload |
| `401` | `UNAUTHORIZED` | ไม่มีหรือใช้ bearer token ไม่ถูกต้อง | ให้ผู้ใช้เข้าสู่ระบบใหม่ |
| `403` | `FORBIDDEN` | ไม่มี edit permission หรืออยู่นอก scope/assignment | ซ่อน action และแจ้งว่าไม่มีสิทธิ์ |
| `404` | `NOT_FOUND` | ไม่พบคำขอ | refresh รายการและปิดหน้ารายละเอียดเดิม |
| `409` | `CONFLICT` | เป็น `CONNECTED`, `CANCELED`, `OFFICER_DIRECT_API` หรือมี action อื่นเปลี่ยนเป็นสถานะที่ยกเลิกไม่ได้ก่อน | refresh ด้วยข้อมูลล่าสุดและไม่ retry อัตโนมัติ |

กรณีสถานะไม่อนุญาต `error.details.currentStatus` คือสถานะที่ตรวจพบ และ `error.details.allowedStatuses` คือรหัสสถานะที่ยกเลิกได้ทั้ง 5 ค่า; กรณี source ไม่อนุญาตใช้ `error.details.submissionSource` แทน ตรวจ edit scope/assignment ก่อนส่งรายละเอียดเหล่านี้ และตรวจซ้ำหลังล็อกคำขอใน transaction

การเรียกยกเลิกซ้ำเปลี่ยนจาก `200` เป็น `409` ดู [ผลกระทบและการปรับ client](../../CHANGELOG.md#operator-cancel-terminal-statuses)

## Backend Maintainer Links

- Workflow: [`workflows/operator-cancel-connection-request.md`](../../../../../workflows/operator-cancel-connection-request.md)
- Route: [`connection-requests.routes.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.routes.ts)
- Controller: [`connection-requests.controller.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.controller.ts)
- Validator: [`connection-requests.validator.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.validator.ts)
- Types: [`connection-requests.types.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.types.ts)
- Service: [`connection-requests.service.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.service.ts)
- Repository: [`connection-requests.repository.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.repository.ts)
- Tests: [`connection-requests.cancel.route.test.ts`](../../../../../backend/tests/unit/connection-requests.cancel.route.test.ts), [`connection-requests.cancel.service.test.ts`](../../../../../backend/tests/unit/connection-requests.cancel.service.test.ts), [`connection-requests.cancel.repository.test.ts`](../../../../../backend/tests/unit/connection-requests.cancel.repository.test.ts)
- HTTP status matrix: [`connection-requests.cancel-state.route.test.ts`](../../../../../backend/tests/unit/connection-requests.cancel-state.route.test.ts) ใช้ service จริงและจำลองเฉพาะ repository
- Runtime OpenAPI: [`connection-requests.openapi.ts`](../../../../../backend/src/modules/api-docs/connection-requests.openapi.ts), [`contract test`](../../../../../backend/tests/unit/connection-requests.cancel.openapi.test.ts)
- Evidence: [`operator-cancel-connection-request.tdd.md`](../../../../../docs/testing/operator-cancel-connection-request.tdd.md)
