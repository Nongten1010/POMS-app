# ขอเชื่อมต่อ

> Owner: Backend

## Frontend Quick Start

เมนูนี้รองรับคำขอเชื่อมต่อ CEMS/WPMS ของผู้ประกอบการ หลังเจ้าหน้าที่อนุมัติแบบ backend จะออกรหัสให้ทุกจุดตรวจวัดที่ยังไม่มีรหัสโดยอัตโนมัติ และคืนรหัสผ่าน `measurementPoints[].pointCode`.

### Main Flow

1. ผู้ประกอบการสร้างคำขอปกติ; client ไม่กำหนด `pointCode` สำหรับจุดใหม่.
2. เจ้าหน้าที่อนุมัติแบบด้วย `APPROVE_DESIGN`.
3. Backend เปลี่ยนสถานะเป็น `WAITING_CONNECTION` และออกรหัสเรียงตามลำดับจุดในคำขอ.
4. Client ใช้ `measurementPoints[].pointCode` จาก response สำหรับตั้งค่าอุปกรณ์และเรียก API ที่ใช้ `stationId` ต่อไป.

ผู้ประกอบการอ่านรายชื่อโรงงานเข้าข่ายที่ตนมีสิทธิ์:

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/cems-wpms-requests/operator-factories' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/cems-wpms-requests/101/review' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{"decision":"APPROVE_DESIGN","officerNote":null}'
```

ผู้ประกอบการยกเลิกคำขอของตนเอง:

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/cems-wpms-requests/101/cancel' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{"reason":"ยุติโครงการติดตั้งระบบตรวจวัด"}'
```

## Endpoint Summary

| งาน | Method | Path | Auth | Permission | Contract |
| --- | --- | --- | --- | --- | --- |
| อ่านรายชื่อโรงงานเข้าข่ายของผู้ประกอบการ | `GET` | `/api/v1/cems-wpms-requests/operator-factories` | Bearer | `factories:view` | [Operator factory list source](#operator-factory-list-source) |
| สร้างคำขอเชื่อมต่อใหม่ | `POST` | `/api/v1/cems-wpms-requests` | Bearer | `cems_wpms_requests:edit` | [Eligibility gate](#eligibility-gate) |
| สร้างคำขอเพิ่มจุดตรวจวัด | `POST` | `/api/v1/cems-wpms-requests/measurement-points` | Bearer | `cems_wpms_requests:edit` | [Eligibility gate](#eligibility-gate) |
| สร้างคำขอเพิ่มพารามิเตอร์ | `POST` | `/api/v1/cems-wpms-requests/parameters` | Bearer | `cems_wpms_requests:edit` | [Eligibility gate](#eligibility-gate) |
| เชื่อมต่อโดยเจ้าหน้าที่โดยตรง | `POST` | `/api/v1/cems-wpms-requests/direct-connections` | Bearer | `cems_wpms_requests:direct_connect` | [Eligibility gate](#eligibility-gate) |
| ตรวจสอบและเปลี่ยนคำขอเป็นเชื่อมต่อแล้ว | `POST` | `/api/v1/cems-wpms-requests/:id/verify-connection` | Bearer | `cems_wpms_requests:approve` | [Connected factory profile sync](#connected-factory-profile-sync) |
| อนุมัติแบบและออกรหัสจุดตรวจวัด | `POST` | `/api/v1/cems-wpms-requests/:id/review` | Bearer | `cems_wpms_requests:approve` | [Approve design](#approve-design) |
| อ่านรายละเอียดคำขอและรหัสจุด | `GET` | `/api/v1/cems-wpms-requests/:id` | Bearer | `cems_wpms_requests:view` | [Read request](#read-request) |
| อ่านจุดตรวจวัดที่เชื่อมต่อแล้ว | `GET` | `/api/v1/connected-measurement-points` | Bearer | `cems_wpms_requests:view` | [Connected points](#connected-points) |
| ผู้ประกอบการยกเลิกคำขอ | `POST` | `/api/v1/cems-wpms-requests/:id/cancel` | Bearer | `cems_wpms_requests:edit` + owner | [Cancel request](./operator-cancel-request.md) |

## Point-code Contract

กติกานี้ใช้เฉพาะ flow ปกติของผู้ประกอบการ:

| `systemType` | รูปแบบรหัสใหม่ | รหัสแรกขั้นต่ำ | ตัวอย่างลำดับ |
| --- | --- | --- | --- |
| `CEMS` | `S` + ตัวเลขอย่างน้อย 4 หลัก | `S2001` | `S2001`, `S2002`, ... |
| `WPMS` | `W` + ตัวเลขอย่างน้อย 4 หลัก | `W2001` | `W2001`, `W2002`, ... |

- CEMS และ WPMS ใช้ลำดับแยกกัน.
- ถ้ามีรหัส prefix เดียวกันซึ่งมีเลขสูงกว่า `2000` อยู่แล้ว ระบบออกเลขต่อจากค่าสูงสุด.
- รหัส `Sxxxx` และ `Pxxxx` เดิมไม่ถูก migrate; client ต้องยังอ่านและส่งรหัสเดิมเหล่านั้นเป็น opaque identifier ได้.
- รหัส `Pxxxx` เดิมไม่ถูกนำมาคำนวณลำดับ `Wxxxx`.
- คำขอ `ADD_PARAMETER` ใช้รหัสจุดเดิมและไม่ออกรหัสใหม่.
- `POST /api/v1/cems-wpms-requests/direct-connections` ไม่ใช้ลำดับนี้ และเก็บรหัสที่เจ้าหน้าที่ส่งใน `measurementPoints[0].pointCode`.
- การจองเลขและการเปลี่ยนสถานะทำใน transaction เดียวกันเพื่อไม่ให้คำขอพร้อมกันได้รหัสซ้ำ.

## Contracts

### Operator factory list source

`GET /api/v1/cems-wpms-requests/operator-factories` ใช้ `factories` เฉพาะตรวจความสัมพันธ์และสิทธิ์ว่า user เข้าถึงโรงงานใดได้ จากนั้นรับเฉพาะโรงงานที่จับคู่กับ active row ใน `eligible_factories` ได้ ข้อมูลโรงงานที่ส่งกลับ เช่น ชื่อโรงงาน เลขทะเบียน ประเภทโรงงาน การประกอบกิจการ ที่อยู่ จังหวัด พิกัด EIA และชื่อโครงการ ต้องอ่านจาก `eligible_factories`; ห้ามใช้ descriptive fields จาก `factories` เป็น fallback.

จำนวนจุดตรวจวัดยังคำนวณจาก active rows ใน `cems_wpms_connected_measurement_points` และสถานะคำขออ่านจากคำขอล่าสุดของโรงงานตามเดิม.

| Response field | Type | Source/Meaning |
| --- | --- | --- |
| `data[].factoryId` | string | `eligible_factories.source_factory_id`; fallback เป็น `factory_registration_no_new` เมื่อ source id ไม่มีค่า |
| `data[].factoryName` | string | `eligible_factories.factory_name` |
| `data[].newRegistrationNo` | string | `eligible_factories.factory_registration_no_new` |
| `data[].oldRegistrationNo` | string \| null | `eligible_factories.factory_registration_no_old` |
| `data[].industryMainOrder`, `industrySubOrder` | string \| null | แยกจาก `eligible_factories.factory_type_sequence` |
| `data[].businessActivity` | string \| null | `eligible_factories.business_activity` |
| `data[].address`, `province` | string \| null | `eligible_factories.address`, `province_name` |
| `data[].latitude`, `longitude` | string \| null | พิกัดโรงงานจาก `eligible_factories` |
| `data[].eia`, `projectName` | string \| null | `eligible_factories.eia_assessment`, `project_name` |
| `data[].monitoringPointCount` | number | จำนวน active POMS points ที่จับคู่กับโรงงาน |
| `data[].requestStatusCode` | string \| null | สถานะคำขอล่าสุดของโรงงาน |

Minimal response:

```json
{
  "success": true,
  "data": [
    {
      "factoryId": "F000123",
      "factoryName": "บริษัท โรงงานตัวอย่าง จำกัด",
      "newRegistrationNo": "10120000325542",
      "oldRegistrationNo": "3-34(3)-3/54นบ",
      "businessActivity": "ผลิตผลิตภัณฑ์ตัวอย่าง",
      "province": "นนทบุรี",
      "latitude": "13.8621",
      "longitude": "100.5144",
      "eia": "มี EIA",
      "projectName": "โครงการโรงงานตัวอย่าง",
      "monitoringPointCount": 1,
      "requestStatusCode": "CONNECTED"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

### Eligibility gate

ทุก endpoint ที่สร้างคำขอรับเฉพาะโรงงานที่มี active row ใน `eligible_factories` โดย resolve จาก identifier aliases ของโรงงานก่อนเริ่ม transaction สร้างคำขอ พฤติกรรมนี้ใช้กับ `NEW_CONNECTION`, `ADD_MEASUREMENT_POINT`, `ADD_PARAMETER` และ Direct Connection.

Direct Connection resolve และตรวจ scope จาก `eligible_factories` โดยตรง โรงงานจึงยังไม่ต้องมี row ใน `factories` หรือ `cems_wpms_connected_measurement_points` มาก่อน ชื่อและเลขทะเบียน canonical ที่บันทึกมาจาก active eligible row; backend ไม่ใช้ `factoryName` จาก client เป็นแหล่งยืนยันตัวตน.

Relevant request fields:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `factoryId` | string | yes | ต้อง resolve ไปยัง `eligible_factories.source_factory_id`, `factory_registration_no_new` หรือ `factory_registration_no_old` ที่ active |
| `factoryRegistrationNo` | string | yes | ใช้เป็น alias สำรองกับ identifier ทั้งสามแบบข้างต้น |

Minimal relevant request fragment:

```json
{
  "factoryId": "F000123",
  "factoryRegistrationNo": "3-106-33/50สบ"
}
```

ถ้า resolve ไม่พบ ระบบไม่สร้าง request, history หรือ measurement point และตอบ:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Active eligible factory not found"
  }
}
```

สำหรับ Direct Connection เงื่อนไข “ไม่พบ” รวมถึง active eligible row ที่อยู่นอก region/province ของเจ้าหน้าที่ และใช้ข้อความ `Active eligible factory not found within officer access scope` เพื่อไม่เปิดเผยข้อมูลโรงงานนอกขอบเขตสิทธิ์.

ระบบเก็บ `eligibleFactoryId` ที่ resolve ได้ใน response ของคำขอ เพื่อยืนยันความสัมพันธ์เดียวกันระหว่างคำขอ โรงงานเข้าข่าย และข้อมูล current/live ของ POMS. Field นี้เป็น server-resolved response field; client ไม่ใช้เลือก eligible row โดยตรง.

### Connected factory profile sync

เมื่อ Direct Connection สำเร็จ หรือ `POST /api/v1/cems-wpms-requests/:id/verify-connection` เปลี่ยนคำขอจาก `CONNECTION_CONFIRMED` เป็น `CONNECTED` ระบบทำงานต่อไปนี้ใน transaction เดียว:

| ข้อมูลจาก request snapshot | POMS current/live (`cems_wpms_connected_measurement_points`) | `eligible_factories` |
| --- | --- | --- |
| `latitude` + `longitude` | `factory_latitude` + `factory_longitude` | `latitude` + `longitude` |
| `eia`, `eiaOther`, derived `hasEia` | factory-profile fields | `eia_assessment`, `eia_other`, `has_eia` |
| `projectName` | `factory_project_name` | `project_name` |
| เอกสาร title `ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน` | `factory_front_photos_json` | ไม่เขียน |
| เอกสาร title `สัญลักษณ์ของโรงงานหรือโลโก้บริษัท` | `factory_logo_json` | ไม่เขียน |

พิกัดข้างต้นเป็นพิกัดโรงงานเท่านั้น ระบบไม่เปลี่ยน `cems_wpms_measurement_points.latitude` / `longitude` ซึ่งเป็นพิกัดจุดตรวจวัด และไม่เขียนทับ `documents_json` ของจุดตรวจวัดเดิม.

การอัปเดตใช้ patch semantics:

- พิกัดอัปเดตเมื่อมีทั้ง `latitude` และ `longitude`; หากมาไม่ครบให้คงพิกัดเดิมทั้งคู่.
- `eia`, `projectName`, รูปหน้าโรงงาน และโลโก้ที่เป็น `null`, ไม่ส่งมา หรือไม่พบ document title จะคงค่าเดิม.
- ค่าใหม่ของ factory profile ถูกใช้กับทุก active POMS point ของโรงงานเดียวกัน แต่ข้อมูลเฉพาะจุดยังคงเดิม.
- ก่อนเปลี่ยนสถานะ ระบบตรวจ `eligibleFactoryId` ซ้ำภายใน transaction; หาก eligible row ถูกถอดออกแล้วตอบ `409 Conflict`, คงสถานะคำขอเดิม และไม่เขียน POMS.

Minimal verify request:

```json
{
  "verifiedAt": "2026-07-21T05:00:00.000Z",
  "note": null
}
```

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "id": 101,
    "eligibleFactoryId": 25,
    "status": "CONNECTED",
    "latitude": 13.7563,
    "longitude": 100.5018,
    "eia": "มี EIA",
    "projectName": "โครงการปรับปรุงโรงงาน"
  }
}
```

### Approve design

Request fields:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `decision` | string | yes | ต้องเป็น `APPROVE_DESIGN` สำหรับ flow นี้ |
| `officerNote` | string \| null | no | ข้อความที่ trim แล้ว สูงสุด 1000 ตัวอักษร |

Minimal request:

```json
{
  "decision": "APPROVE_DESIGN",
  "officerNote": null
}
```

Relevant response fields (`200 OK`):

| Field | Type | Meaning |
| --- | --- | --- |
| `success` | boolean | สำเร็จเป็น `true` |
| `data.status` | string | เป็น `WAITING_CONNECTION` หลังอนุมัติแบบ |
| `data.systemType` | string | `CEMS` หรือ `WPMS` |
| `data.measurementPoints[].pointCode` | string | รหัสที่ backend ออกตาม Point-code Contract |

Minimal response:

```json
{
  "success": true,
  "data": {
    "id": 101,
    "systemType": "WPMS",
    "status": "WAITING_CONNECTION",
    "measurementPoints": [
      {
        "id": 201,
        "pointName": "จุดระบายน้ำทิ้ง 1",
        "pointCode": "W2001"
      }
    ]
  }
}
```

### Read request

Path fields:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `id` | integer | yes | รหัสคำขอที่ผู้ใช้มีสิทธิ์อ่าน |

Minimal request: ไม่มี request body.

Minimal response:

```json
{
  "success": true,
  "data": {
    "id": 101,
    "systemType": "CEMS",
    "measurementPoints": [
      {
        "id": 201,
        "pointCode": "S2001"
      }
    ]
  }
}
```

### Connected points

Query fields ที่เกี่ยวกับรหัสจุด:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `stationId` | string | no | กรองด้วยรหัสจุดตรวจวัดแบบ exact identifier |
| `factoryId` | string | no | กรองจุดตรวจวัดที่เชื่อมต่อแล้วของโรงงาน |

Authorization:

- scope `ALL`, `IN_REGION` และ `IN_PROVINCE` ใช้กฎการกรองตาม permission และพื้นที่.
- scope `OWN_FACTORY` ตรวจ factory assignment จาก `user_juristics` หรือ `user_factory_access`; ไม่บังคับว่าผู้เรียกต้องเป็น `createdBy` ของคำขอเชื่อมต่อ จึงอ่านจุดที่เจ้าหน้าที่เชื่อมต่อให้โรงงานนั้นได้.
- กฎ factory assignment นี้ใช้กับ connected-points flow; สิทธิ์ที่ผูกกับผู้สร้างคำขอ เช่นการยกเลิก ยังตรวจ `createdBy` ตาม contract ของ endpoint นั้น.

Minimal request: ไม่มี request body.

Minimal response:

```json
{
  "success": true,
  "data": [
    {
      "type": "WPMS",
      "point": {
        "pointCode": "W2001"
      }
    }
  ],
  "meta": {
    "total": 1
  }
}
```

## Errors

ใช้ error envelope กลางของระบบ:

- `401 Unauthorized` เมื่อไม่มี bearer token ที่ถูกต้อง.
- `403 Forbidden` เมื่อไม่มี permission หรืออ่านคำขอนอก scope.
- `404 Not Found` เมื่อไม่พบคำขอหรือจุดตรวจวัดใน scope.
- `404 Not Found` เมื่อ endpoint สร้างคำขอ resolve active eligible factory ไม่สำเร็จ.
- `409 Conflict` เมื่อคำขอเคยผูก eligible factory ไว้ แต่ eligible row ไม่ active แล้วในเวลาที่เชื่อมต่อ.
- `400 Bad Request` เมื่อ payload หรือสถานะปัจจุบันไม่อนุญาตให้ทำ action.

## Business Flow And Explanations

- Workflow spec: [`workflows/operator-normal-connection-point-code.md`](../../../../../workflows/operator-normal-connection-point-code.md)
- [Connected factory profile sync workflow](../../../../../workflows/connected-factory-profile-sync.md) — นิยาม POMS/eligible, patch semantics และ migration fail-fast.
- [Contract ผู้ประกอบการยกเลิกคำขอ](./operator-cancel-request.md) และ [workflow spec](../../../../../workflows/operator-cancel-connection-request.md)
- การเชื่อมต่อโดยเจ้าหน้าที่โดยตรงเป็น flow แยกและไม่ใช้ลำดับอัตโนมัตินี้.

## Backend Maintainer Map

| Concern | Canonical source |
| --- | --- |
| Routes | [`connection-requests.routes.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.routes.ts), [`connected-measurement-points.routes.ts`](../../../../../backend/src/modules/connection-requests/connected-measurement-points.routes.ts) |
| Validators | [`connection-requests.validator.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.validator.ts) |
| Public types | [`connection-requests.types.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.types.ts) |
| Sequence implementation | [`connection-requests.repository.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.repository.ts) |
| Factory-profile patch rules | [`connected-factory-profile.ts`](../../../../../backend/src/modules/connection-requests/connected-factory-profile.ts) |
| Migrations | [`0075_start_operator_point_codes_at_2001.ts`](../../../../../backend/src/db/migrations/0075_start_operator_point_codes_at_2001.ts), [`0076_sync_connected_factory_profiles_with_eligible_factories.ts`](../../../../../backend/src/db/migrations/0076_sync_connected_factory_profiles_with_eligible_factories.ts) |
| Tests | [`connection-requests.point-code-sequence.repository.test.ts`](../../../../../backend/tests/unit/connection-requests.point-code-sequence.repository.test.ts), [`connected-factory-profile-sync.test.ts`](../../../../../backend/tests/unit/connected-factory-profile-sync.test.ts), [`connection-requests.connect.repository.test.ts`](../../../../../backend/tests/unit/connection-requests.connect.repository.test.ts), [`connected-factory-profile-migration.test.ts`](../../../../../backend/tests/unit/connected-factory-profile-migration.test.ts) |
