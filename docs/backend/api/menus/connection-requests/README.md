# ขอเชื่อมต่อ

> Owner: Backend

## Frontend Quick Start

เมนูนี้รองรับคำขอเชื่อมต่อ CEMS/WPMS ของผู้ประกอบการ หลังเจ้าหน้าที่อนุมัติแบบ backend จะออกรหัสให้ทุกจุดตรวจวัดที่ยังไม่มีรหัสโดยอัตโนมัติ และคืนรหัสผ่าน `measurementPoints[].pointCode`.

permission code, grouped response alias และ scope keyword ที่อ้างในหน้านี้ใช้ canonical contract จาก [สิทธิ์การใช้งาน](../permissions/README.md)

### Main Flow

1. ผู้ประกอบการสร้างคำขอปกติ; client ไม่กำหนด `pointCode` สำหรับจุดใหม่.
2. เจ้าหน้าที่อนุมัติแบบด้วย `APPROVE_DESIGN`.
3. Backend เปลี่ยนสถานะเป็น `WAITING_CONNECTION` และออกรหัสเรียงตามลำดับจุดในคำขอ.
4. Client ใช้ `measurementPoints[].pointCode` จาก response สำหรับตั้งค่าอุปกรณ์และเรียก API ที่ใช้ `stationId` ต่อไป.

ผู้ประกอบการอ่านรายชื่อโรงงานทั้งหมดที่ตนมีสิทธิ์ พร้อมสถานะว่าโรงงานเข้าข่ายหรือไม่:

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
| อ่านรายการคำขอสำหรับตาราง | `GET` | `/api/v1/cems-wpms-requests/table-rows` | Bearer | `cems_wpms_requests:view` | [Request table location source](#request-table-location-source) |
| อ่านโรงงานเข้าข่ายสำหรับฟอร์มเจ้าหน้าที่ | `GET` | `/api/v1/cems-wpms-requests/eligible-factories` | Bearer | `cems_wpms_requests:view` | ใช้ scope เดียวกับคำขอและส่ง region/province/estate ลง eligible-factory repository |
| อ่านรายชื่อโรงงานทั้งหมดที่ผู้ประกอบการเข้าถึงได้ พร้อมสถานะเข้าข่าย | `GET` | `/api/v1/cems-wpms-requests/operator-factories` | Bearer | `factories:view` | [Operator factory list source](#operator-factory-list-source) |
| อ่านข้อมูลทั่วไปของโรงงานสำหรับ prefill | `GET` | `/api/v1/cems-wpms-requests/factories/:factoryId/general` | Bearer | `factories:view` | [Frontend measurement-point handoff](#frontend-measurement-point-handoff) |
| สร้างคำขอเชื่อมต่อใหม่ | `POST` | `/api/v1/cems-wpms-requests` | Bearer | `cems_wpms_requests:edit` | [Eligibility gate](#eligibility-gate) |
| สร้างคำขอเพิ่มจุดตรวจวัด | `POST` | `/api/v1/cems-wpms-requests/measurement-points` | Bearer | `cems_wpms_requests:edit` | [Eligibility gate](#eligibility-gate), [Frontend measurement-point handoff](#frontend-measurement-point-handoff) |
| สร้างคำขอเพิ่มพารามิเตอร์ | `POST` | `/api/v1/cems-wpms-requests/parameters` | Bearer | `cems_wpms_requests:edit` | [Eligibility gate](#eligibility-gate) |
| เชื่อมต่อโดยเจ้าหน้าที่โดยตรง | `POST` | `/api/v1/cems-wpms-requests/direct-connections` | Bearer | `cems_wpms_requests:direct_connect` | [Eligibility gate](#eligibility-gate), [Frontend measurement-point handoff](#frontend-measurement-point-handoff) |
| ตรวจสอบและเปลี่ยนคำขอเป็นเชื่อมต่อแล้ว | `POST` | `/api/v1/cems-wpms-requests/:id/verify-connection` | Bearer | `cems_wpms_requests:approve` | [Connected factory profile sync](#connected-factory-profile-sync) |
| อนุมัติแบบและออกรหัสจุดตรวจวัด | `POST` | `/api/v1/cems-wpms-requests/:id/review` | Bearer | `cems_wpms_requests:approve` | [Approve design](#approve-design) |
| อ่านรายละเอียดคำขอและรหัสจุด | `GET` | `/api/v1/cems-wpms-requests/:id` | Bearer | `cems_wpms_requests:view` | [Read request](#read-request) |
| อ่านรายละเอียดเต็มสำหรับ prefill | `GET` | `/api/v1/cems-wpms-requests/:id/detail` | Bearer | `cems_wpms_requests:view` | [Frontend measurement-point handoff](#frontend-measurement-point-handoff) |
| แก้ไขและส่งแบบคำขออีกครั้ง | `PUT` | `/api/v1/cems-wpms-requests/:id/form` | Bearer | `cems_wpms_requests:edit` | [Frontend measurement-point handoff](#frontend-measurement-point-handoff) |
| อ่านแบบตั้งค่าอุปกรณ์ของจุดในคำขอ | `GET` | `/api/v1/cems-wpms-requests/:id/device-configs?stationId=:stationId` | Bearer | `cems_wpms_requests:view` | [Device configs](./device-configs.md) |
| บันทึกการตั้งค่าอุปกรณ์ของจุดในคำขอ | `POST` | `/api/v1/cems-wpms-requests/:id/device-configs` | Bearer | `cems_wpms_requests:edit` | [Device configs](./device-configs.md) |
| อ่านจุดตรวจวัดที่เชื่อมต่อแล้ว | `GET` | `/api/v1/connected-measurement-points` | Bearer | `cems_wpms_requests:view` | [Connected points](#connected-points) |
| อ่านจุดตรวจวัดของโรงงานและข้อมูล prefill | `GET` | `/api/v1/connected-measurement-points/factories/:factoryId` | Bearer | `cems_wpms_requests:view` | [Shared connected-point contract](../../shared/connected-measurement-points/README.md) |
| อ่านข้อมูลปัจจุบันสำหรับฟอร์มเพิ่มพารามิเตอร์ | `GET` | `/api/v1/connected-measurement-points/:stationId/parameter-form` | Bearer | `cems_wpms_requests:view` | [Add-parameter prefill](#add-parameter-prefill) |
| อ่าน/แทนที่ config ของจุดที่เชื่อมต่อแล้ว | `GET`, `POST` | `/api/v1/connected-measurement-points/:stationId/device-configs` | Bearer | `cems_wpms_requests:view`, `cems_wpms_requests:edit` | [Device configs](./device-configs.md) |
| อ่าน raw parameter values | `GET` | `/api/v1/parameter-values`, `/api/v1/parameter-values/latest` | Bearer | `cems_wpms_requests:view` | [Parameter values](./parameter-values.md) |
| ทดสอบข้อมูลเชื่อมต่อและแปลง StatusCode | `GET` | `/api/v1/parameter-values/connection-test` | Bearer | `cems_wpms_requests:view` | [Parameter values](./parameter-values.md) |
| ผู้ประกอบการยกเลิกคำขอ | `POST` | `/api/v1/cems-wpms-requests/:id/cancel` | Bearer | `cems_wpms_requests:edit` + owner | [Cancel request](./operator-cancel-request.md) |

Location enforcement ของทุก endpoint ในตารางใช้จุดตัดกับ profile assignment. `IN_REGION`, `IN_PROVINCE` หรือ `IN_ESTATE` ที่ไม่มี qualifier ที่ resolve ได้ หรือขัดกับพื้นที่ประจำตัว ต้องคืนศูนย์รายการ/`404` และห้าม fallback ไปใช้ request ownership หรือโรงงานที่เคยผูกไว้. สำหรับ กนอ. `IN_ESTATE` หมายถึงโรงงานทุกแห่งในนิคม `estateCode` ที่มอบหมาย

## Request-number Contract

คำขอที่สร้างใหม่ใช้เลขชุดเดียวกันตาม `systemType` และปี พ.ศ. ไม่ว่าผู้ส่งจะเป็นผู้ประกอบการหรือเจ้าหน้าที่เชื่อมต่อโดยตรง:

| `systemType` | รูปแบบ | ตัวอย่างแรกของปี 2569 |
| --- | --- | --- |
| `CEMS` | `CEMS-` + ลำดับอย่างน้อย 4 หลัก + `/` + ปี พ.ศ. 4 หลัก | `CEMS-0001/2569` |
| `WPMS` | `WEMS-` + ลำดับอย่างน้อย 4 หลัก + `/` + ปี พ.ศ. 4 หลัก | `WEMS-0001/2569` |

- `POST /api/v1/cems-wpms-requests/direct-connections` ใช้ลำดับเดียวกับคำขอของผู้ประกอบการ ไม่ใช้ prefix `OLDC` หรือ `OLDW` สำหรับคำขอใหม่.
- ค่า `submissionSource` ยังคงแยกแหล่งที่มา: ผู้ประกอบการเป็น `OPERATOR_FORM` และเจ้าหน้าที่เชื่อมต่อโดยตรงเป็น `OFFICER_DIRECT_API`.
- Direct Connection ยังคงสถานะ `CONNECTED` ทันทีและเก็บ `measurementPoints[0].pointCode` ที่เจ้าหน้าที่กรอกเอง; การเปลี่ยนนี้มีผลเฉพาะ `requestNo`.
- คำขอเดิมที่มี `OLDC-*` หรือ `OLDW-*` ไม่ถูกแก้ย้อนหลัง.

## Point-code Contract

กติกานี้ใช้เฉพาะ flow ปกติของผู้ประกอบการ:

| `systemType` | รูปแบบรหัสใหม่ | รหัสแรกขั้นต่ำ | ตัวอย่างลำดับ |
| --- | --- | --- | --- |
| `CEMS` | `S` + ลำดับอย่างน้อย 4 หลัก | `S2001` | `S2001`, `S2002`, ... |
| `WPMS` | `W` + ลำดับอย่างน้อย 4 หลัก | `W2001` | `W2001`, `W2002`, ... |

- CEMS และ WPMS ใช้ลำดับแยกกัน เริ่มขั้นต่ำที่ `2001` และไม่เริ่มใหม่เมื่อเปลี่ยนปี.
- ระบบออกเลขต่อจากค่าที่มากกว่าระหว่าง sequence ที่บันทึกไว้กับรหัส `S...`/`W...` สูงสุดที่ยังใช้งานอยู่.
- รหัสเดิมรูปแบบอื่น เช่น `Pxxxx`, `CEMS-NNNN/YYYY` และ `WEMS-NNNN/YYYY` ยังอ่านเป็น opaque identifier ได้ แต่ไม่ถูกนำมาคำนวณเลขใหม่.
- คำขอ `ADD_PARAMETER` ใช้รหัสจุดเดิมและไม่ออกรหัสใหม่.
- `POST /api/v1/cems-wpms-requests/direct-connections` ไม่ใช้ลำดับรหัสจุดนี้ และเก็บรหัสที่เจ้าหน้าที่ส่งใน `measurementPoints[0].pointCode`.
- การจองเลขและการเปลี่ยนสถานะทำใน transaction เดียวกันเพื่อไม่ให้คำขอพร้อมกันได้รหัสซ้ำ.

เพื่อรองรับข้อมูลที่เคยมี `/` อยู่ในรหัสจุด:

- ใน query string หรือ JSON body ให้ส่งค่ารหัสตามปกติ เช่น `stationId=CEMS-0001/2569`.
- ใน path parameter ต้อง URL-encode อักขระ `/` เป็น `%2F` เช่น
  `/api/v1/connected-measurement-points/CEMS-0001%2F2569/requests`.
- Client ควรสร้าง path segment ด้วย `encodeURIComponent(pointCode)` และต้องไม่แยกหรือคำนวณความหมายจากรหัสเอง.
- Backend รองรับทั้ง `%2F` ที่ส่งถึง Express โดยตรง และ path สอง segment ที่ reverse proxy ถอด `%2F` เป็น `/` ก่อนส่งต่อ โดยประกอบกลับเป็น point code เดิมก่อน validation.

## Contracts

### Frontend measurement-point handoff

Contract นี้ใช้กับ `POST /api/v1/cems-wpms-requests/measurement-points`, `POST /api/v1/cems-wpms-requests/direct-connections` และ `PUT /api/v1/cems-wpms-requests/:id/form`. Field ต่อไปนี้อยู่ใต้ `measurementPoints[].details` และใช้ชื่อ key เดิมทุก endpoint:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `measurementPoints[].details.primaryFuelPercent` | number \| null | no | เมื่อไม่มี `primaryFuel` ไม่บังคับ field นี้; ไม่ส่งหรือส่ง `null` ได้ |
| `measurementPoints[].details.secondaryFuelPercent` | number \| null | no | เมื่อไม่มี `secondaryFuel` ไม่บังคับ field นี้; ไม่ส่งหรือส่ง `null` ได้ |
| `measurementPoints[].details.sharedStackCode` | string \| null | no | ชื่อ key ยังคงเป็น `sharedStackCode`; client ไม่ต้องเปลี่ยนเป็น key ใหม่ |
| `measurementPoints[].details.exemptedParameterRegulationClauses` | string \| null | no | canonical write เป็นค่าเดียวใน `ไม่มี`, `4(1)`, `4(2)`, `11(3)`, `อื่นๆ`; แม้ชื่อ field เป็นพหูพจน์ โดย historical detail ที่ยังไม่ถูกบันทึกซ้ำอาจยังเป็น legacy array |
| `measurementPoints[].details.exemptedParameterRegulationClauseOther` | string \| null | conditional | เมื่อเลือก `อื่นๆ` ต้องเป็นข้อความที่ trim แล้วไม่ว่างและยาวไม่เกิน 500 ตัวอักษร; เมื่อเลือกค่าอื่น backend normalize เป็น `null` |

เพื่อ compatibility backend ยังรับ legacy array ที่มี supported value เพียงหนึ่งค่า เช่น `["4(1)"]` แล้ว normalize และบันทึกเป็น string `"4(1)"`. Array ที่มีหลายค่าถูกปฏิเสธด้วย `400 VALIDATION_ERROR` ที่ path `measurementPoints.0.details.exemptedParameterRegulationClauses`; client ใหม่ต้องส่ง string ค่าเดียวหรือ `null` และไม่ควรพึ่ง compatibility ของ single-item array.

Minimal relevant request fragment:

```json
{
  "systemType": "CEMS",
  "measurementPoints": [
    {
      "pointName": "ปล่องหลัก",
      "pointType": "STACK",
      "details": {
        "primaryFuel": null,
        "primaryFuelPercent": null,
        "secondaryFuel": "ก๊าซธรรมชาติ",
        "secondaryFuelPercent": 25,
        "sharedStackCode": "S2002",
        "exemptedParameterRegulationClauses": "อื่นๆ",
        "exemptedParameterRegulationClauseOther": "ข้อ 15 ตามประกาศเฉพาะ"
      }
    }
  ]
}
```

`GET /api/v1/cems-wpms-requests/:id/detail` คืนค่าที่บันทึกใน `data.measurementPoints[].details`; รายการที่สร้างหรือ resubmit ผ่าน contract ใหม่นี้จะเป็น string ที่ normalize แล้ว. Historical row ที่ยังไม่ถูกบันทึกซ้ำอาจยังคืน legacy array ดังนั้น client ควรรองรับ single-item array ในช่วงเปลี่ยนผ่าน. `POST` ทั้งสอง endpoint ตอบ `201 Created`; `PUT /:id/form` ตอบ `200 OK` และใช้ validation/normalization เดียวกัน.

Minimal detail response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "id": 101,
    "measurementPoints": [
      {
        "id": 201,
        "details": {
          "primaryFuelPercent": null,
          "secondaryFuelPercent": 25,
          "sharedStackCode": "S2002",
          "exemptedParameterRegulationClauses": "อื่นๆ",
          "exemptedParameterRegulationClauseOther": "ข้อ 15 ตามประกาศเฉพาะ"
        }
      }
    ]
  }
}
```

`GET /api/v1/cems-wpms-requests/factories/:factoryId/general` ยังคง contract ข้อมูลทั่วไประดับโรงงานเดิม การเปลี่ยนนี้ไม่เพิ่มหรือย้าย field ของจุดตรวจวัดไปไว้ใน `data.formDefaults`.

### เชื่อมต่อโดยเจ้าหน้าที่โดยตรง

`POST /api/v1/cems-wpms-requests/direct-connections` ใช้ request schema แยกจากฟอร์มคำขอปกติ โดย client ต้องส่งเฉพาะข้อมูลที่ใช้เลือกโรงงาน ระบบ และรหัสจุดตรวจวัด ส่วน field อื่นไม่ส่งหรือส่ง `null` ได้.

Request fields ที่ต้องมีจริง:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `factoryId` | string \| null | conditional | ต้องมี `factoryId` หรือ `factoryRegistrationNo` อย่างน้อยหนึ่งค่า เพื่อ resolve active `eligible_factories` และตรวจ scope |
| `factoryRegistrationNo` | string \| null | conditional | เป็น identifier สำรอง; ส่ง `null` ได้เมื่อมี `factoryId` |
| `systemType` | `CEMS` \| `WPMS` | yes | ห้ามเป็น `null` |
| `measurementPoints` | array | yes | ต้องมีหนึ่งรายการเท่านั้น |
| `measurementPoints[0].pointCode` | string | yes | trim แล้วต้องไม่ว่าง, ยาวไม่เกิน 64 ตัวอักษร และห้ามซ้ำกับ active point ใน `cems_wpms_connected_measurement_points` |

Minimal request:

```json
{
  "factoryId": "F000123",
  "factoryRegistrationNo": null,
  "systemType": "CEMS",
  "measurementPoints": [
    {
      "pointCode": "S1125"
    }
  ]
}
```

Minimal response (`201 Created`):

```json
{
  "success": true,
  "data": {
    "id": 91,
    "eligibleFactoryId": 17,
    "requestNo": "CEMS-0001/2569",
    "requestType": "ADD_MEASUREMENT_POINT",
    "submissionSource": "OFFICER_DIRECT_API",
    "systemType": "CEMS",
    "status": "CONNECTED",
    "measurementPoints": [
      {
        "pointName": "S1125",
        "pointCode": "S1125",
        "pointType": "STACK"
      }
    ]
  }
}
```

Field อื่นของ Direct Connection เช่น `factoryName`, ข้อมูล EIA, ที่อยู่, พิกัด, ผู้ติดต่อ, `remarks`, `pointName`, `pointType`, parameters, details, เอกสาร และเครื่องมือวัด เป็น optional และรับ `null`. เมื่อไม่ส่งหรือส่ง `null`:

- backend ใช้ชื่อและเลขทะเบียน canonical จาก `eligible_factories`;
- `pointName` ใช้ค่า `pointCode`;
- `pointType` ใช้ `STACK` สำหรับ `CEMS` และ `WASTEWATER` สำหรับ `WPMS`;
- PK, request number, `eligibleFactoryId`, request/measurement-point FK และ audit fields เป็น server-owned;
- ถ้า `pointCode` ซ้ำ ระบบตอบ `409 Conflict` ที่ path `measurementPoints.0.pointCode`.

สำหรับ `measurementPoints[0].documentsAndImages`:

- client ไม่ต้องส่งรายการของช่องแนบไฟล์ที่ยังว่าง;
- เพื่อรองรับฟอร์มที่สร้างช่องเอกสารไว้ล่วงหน้า backend จะละทิ้งรายการที่มีเพียง `title`/`description` และมี `link`, `fileName`, `fileUrl`, `fileType`, `fileSize` เป็น `null`, ค่าว่าง หรือไม่ได้ส่ง;
- เอกสารที่แนบจริงแต่ละรายการต้องมี `link` หรือ `fileUrl` แบบ `http`/`https`;
- object ที่มี metadata ของไฟล์ เช่น `fileName`, `fileType` หรือ `fileSize` แต่ไม่มี `link`/`fileUrl` ไม่ถือเป็นช่องว่างและระบบตอบ `400 VALIDATION_ERROR`.

### Email normalization

ทุก endpoint ที่รับแบบฟอร์มคำขอเชื่อมต่อใช้กติกาเดียวกันกับฟิลด์อีเมลต่อไปนี้:

| Field | Type | Normalization ก่อน validation |
| --- | --- | --- |
| `contactEmail` | string \| null | ลบ `U+200B`, `U+200C`, `U+200D`, `U+2060`, `U+FEFF` แล้ว trim |
| `contactPersons[].email` | string \| null | กติกาเดียวกับ `contactEmail` |
| `notificationEmails[]` | string[] | กติกาเดียวกับ `contactEmail` |
| `officerNotificationEmails[]` | string[] | กติกาเดียวกับ `contactEmail` |

- Backend ลบเฉพาะอักขระ formatting แบบมองไม่เห็นข้างต้นเพื่อรองรับค่าที่ติดมาจากการ copy/paste; อักขระอื่นยังผ่าน email validation ตามปกติ.
- เครื่องหมาย `+` เป็นส่วนที่ใช้ได้ในอีเมลและต้องไม่ถูกลบ เช่น `name+alerts@example.com` หรือ `+name@example.com`.
- หลัง normalization ถ้าค่ายังไม่ใช่อีเมลที่ถูกต้อง endpoint ตอบ `400 Bad Request` พร้อม issue path ของฟิลด์เดิม เช่น `notificationEmails.0`.

ตัวอย่าง request fragment:

```json
{
  "contactPersons": [
    {
      "name": "ผู้ประสานงาน",
      "phone": "0812345678",
      "email": "ops@example.com"
    }
  ],
  "notificationEmails": ["name+alerts@example.com"],
  "officerNotificationEmails": ["officer@example.com"]
}
```

### Request table location source

`GET /api/v1/cems-wpms-requests/table-rows` คืน `data[].province` จาก factory snapshot ของคำขอ โดย snapshot ต้องรับจังหวัดจาก active row ใน `eligible_factories` ที่เชื่อมด้วย `eligibleFactoryId`. โรงงานที่ไม่มี row ใน `factories` ต้องยังคงจังหวัดเดิมหลังส่งคำขอ และ backend ต้องไม่ใช้การมีอยู่ของ factory master เป็นเงื่อนไขในการคืนจังหวัด.

สำหรับ scope `OWN_FACTORY` ตารางนี้คืนคำขอของทุกโรงงานที่ผู้ประกอบการได้รับมอบหมายผ่าน `user_juristics` หรือ `user_factory_access` แม้เจ้าหน้าที่หรือผู้ใช้อื่นจะเป็นผู้สร้างคำขอ; endpoint ที่ระบุ owner โดยตรง เช่นการยกเลิกคำขอ ยังคงตรวจ `createdBy` ตาม contract ของ endpoint นั้น.

`data[].factoryName` ใช้ชื่อจาก active current/live POMS point ใน `cems_wpms_connected_measurement_points` ที่อัปเดตล่าสุดและจับคู่ด้วย `eligibleFactoryId`, `factoryId` หรือเลขทะเบียนโรงงาน โดยไม่บังคับว่าต้องมี factory master. ถ้ายังไม่มี current/live point ให้ fallback ไป `factories.name` และชื่อ snapshot ในคำขอตามลำดับ. กติกานี้ใช้เหมือนกันทั้งผู้ประกอบการและเจ้าหน้าที่; role มีผลเฉพาะ permission/scope ของรายการที่มองเห็น.

| Response field | Type | Source/Meaning |
| --- | --- | --- |
| `data[].factoryName` | string | active current/live POMS point ล่าสุด; fallback เป็น factory master แล้วจึง request snapshot |
| `data[].province` | string \| null | factory snapshot ของคำขอที่มาจาก active eligible factory |

### Operator factory list source

`GET /api/v1/cems-wpms-requests/operator-factories` คืนทุกโรงงานที่ user เข้าถึงได้จากความสัมพันธ์ใน `factories` และสิทธิ์ `factories:view` แม้โรงงานนั้นจะยังไม่มี active row ใน `eligible_factories`. Endpoint นี้ใช้เป็น owner/request list ไม่ใช่ connected-only dashboard list.

โรงงานที่เข้าข่ายได้รับรายละเอียดจาก active `eligible_factories` และข้อมูล current/live ที่จับคู่ได้. โรงงานที่ไม่เข้าข่ายส่งข้อมูลที่มีความหมายเฉพาะ `factoryId`, `factoryName`, `isEligible: false` และ `eligibilityStatus: "ไม่เข้าข่าย"`; descriptive fields อื่นเป็น `null`. ฟิลด์โครงสร้างที่ frontend ใช้วนแสดงยังคง type เดิม ได้แก่ `officerNotificationEmails: []`, `monitoringPointCount: 0`, `requestStatusCode: null` และ `status: "แสดง"`. Eligibility ใช้ field แยกใน response แทนการกรองรายการออก:

- `isEligible = true` เมื่อจับคู่ active `eligible_factories` ได้
- `eligibilityStatus = "เข้าข่าย"` เมื่อ `isEligible = true`
- `eligibilityStatus = "ไม่เข้าข่าย"` เมื่อ `isEligible = false`

จำนวนจุดตรวจวัดและสถานะคำขอคำนวณเฉพาะโรงงานที่เข้าข่าย. Public map และ authenticated `GET /api/v1/operator-factory-dashboard` ยังคงเป็น connected/current-live only สำหรับทุก scope รวม `OWN_FACTORY`; รายการโรงงานทั้งหมดของ owner พร้อมแถวข้อมูลขั้นต่ำสำหรับโรงงานไม่เข้าข่ายใช้เฉพาะ `GET /api/v1/cems-wpms-requests/operator-factories` ในหน้าขอเชื่อมต่อ.

| Response field | Type | Source/Meaning |
| --- | --- | --- |
| `data[].id` | number \| null | row id ของ factory master; อาจเป็น `null` กับบางแหล่งข้อมูลที่ไม่มี row id แบบเดียวกัน |
| `data[].factoryId` | string | factory identifier ที่ใช้เป็น owner scope key |
| `data[].factoryName` | string | ชื่อโรงงานที่ owner เข้าถึงได้; ใช้ factory master เป็นฐานและอาจถูกเสริมด้วยข้อมูลที่ sync แล้ว |
| `data[].newRegistrationNo` | string \| null | เลขทะเบียนโรงงานใหม่เมื่อเข้าข่าย; เป็น `null` เมื่อไม่เข้าข่าย |
| `data[].oldRegistrationNo` | string \| null | เลขทะเบียนเก่าเมื่อเข้าข่าย; เป็น `null` เมื่อไม่เข้าข่าย |
| `data[].industryType` | string \| null | คำอธิบายประเภทกิจการเมื่อเข้าข่าย; เป็น `null` เมื่อไม่เข้าข่าย |
| `data[].industryMainOrder`, `data[].industrySubOrder` | string \| null | ลำดับหลัก/ย่อยจาก active `eligible_factories`; เป็น `null` เมื่อไม่เข้าข่าย |
| `data[].businessActivity` | string \| null | การประกอบกิจการจาก active `eligible_factories`; เป็น `null` เมื่อไม่เข้าข่าย |
| `data[].eia`, `data[].projectName` | string \| null | ข้อมูล EIA/ชื่อโครงการจาก active `eligible_factories`; เป็น `null` เมื่อไม่เข้าข่าย |
| `data[].address` | string \| null | ที่อยู่จาก active `eligible_factories`; เป็น `null` เมื่อไม่เข้าข่าย |
| `data[].province` | string \| null | จังหวัดจาก eligible data; เป็น `null` เมื่อไม่เข้าข่าย |
| `data[].latitude`, `data[].longitude` | string \| null | พิกัดจาก active `eligible_factories`; เป็น `null` เมื่อไม่เข้าข่าย |
| `data[].officerNotificationEmails` | string[] | รายชื่ออีเมลเจ้าหน้าที่สำหรับโรงงานเข้าข่าย; เป็น `[]` เมื่อไม่เข้าข่าย |
| `data[].isEligible` | boolean | true เมื่อจับคู่ active `eligible_factories` ได้; false เมื่อ owner เข้าถึงโรงงานได้แต่โรงงานยังไม่เข้าข่าย |
| `data[].eligibilityStatus` | `"เข้าข่าย"` \| `"ไม่เข้าข่าย"` | สถานะที่อ่านง่ายสำหรับ UI; derive จาก `isEligible` |
| `data[].monitoringPointCount` | number | จำนวน active POMS points ของโรงงานเข้าข่าย; เป็น `0` เมื่อไม่เข้าข่าย |
| `data[].requestStatusCode` | string \| null | สถานะคำขอล่าสุดของโรงงานเข้าข่าย; เป็น `null` เมื่อไม่เข้าข่าย |
| `data[].status` | `"แสดง"` | สถานะการแสดงผลของ owner list ปัจจุบัน |

Minimal response:

```json
{
  "success": true,
  "data": [
    {
      "id": 7,
      "factoryId": "F000123",
      "factoryName": "บริษัท โรงงานตัวอย่าง จำกัด",
      "newRegistrationNo": "10120000325542",
      "oldRegistrationNo": "3-34(3)-3/54นบ",
      "industryType": "ผลิตผลิตภัณฑ์ตัวอย่าง",
      "industryMainOrder": "0343",
      "industrySubOrder": "0003",
      "businessActivity": "ผลิตผลิตภัณฑ์ตัวอย่าง",
      "address": "88 หมู่ 2 ตำบลตัวอย่าง อำเภอตัวอย่าง จังหวัดนนทบุรี 11120",
      "province": "นนทบุรี",
      "latitude": "13.8621",
      "longitude": "100.5144",
      "eia": "มี EIA",
      "projectName": "โครงการโรงงานตัวอย่าง",
      "officerNotificationEmails": [
        "saraban_nonthaburi@industry.go.th"
      ],
      "isEligible": true,
      "eligibilityStatus": "เข้าข่าย",
      "monitoringPointCount": 1,
      "requestStatusCode": "CONNECTED",
      "status": "แสดง"
    },
    {
      "id": 8,
      "factoryId": "F000456",
      "factoryName": "บริษัท โรงงานที่ยังไม่เข้าข่าย จำกัด",
      "newRegistrationNo": null,
      "oldRegistrationNo": null,
      "industryType": null,
      "industryMainOrder": null,
      "industrySubOrder": null,
      "businessActivity": null,
      "address": null,
      "province": null,
      "latitude": null,
      "longitude": null,
      "eia": null,
      "projectName": null,
      "officerNotificationEmails": [],
      "isEligible": false,
      "eligibilityStatus": "ไม่เข้าข่าย",
      "monitoringPointCount": 0,
      "requestStatusCode": null,
      "status": "แสดง"
    }
  ],
  "meta": {
    "total": 2
  }
}
```

### Eligibility gate

ทุก endpoint ที่สร้างคำขอรับเฉพาะโรงงานที่มี active row ใน `eligible_factories` โดย resolve จาก identifier aliases ของโรงงานก่อนเริ่ม transaction สร้างคำขอ พฤติกรรมนี้ใช้กับ `NEW_CONNECTION`, `ADD_MEASUREMENT_POINT`, `ADD_PARAMETER` และ Direct Connection.

Direct Connection resolve และตรวจ scope จาก `eligible_factories` โดยตรง โรงงานจึงยังไม่ต้องมี row ใน `factories` หรือ `cems_wpms_connected_measurement_points` มาก่อน ชื่อและเลขทะเบียน canonical ที่บันทึกมาจาก active eligible row; backend ไม่ใช้ `factoryName` จาก client เป็นแหล่งยืนยันตัวตน.

Field requirements ของ Direct Connection อยู่ที่ [เชื่อมต่อโดยเจ้าหน้าที่โดยตรง](#เชื่อมต่อโดยเจ้าหน้าที่โดยตรง). ตารางต่อไปนี้ใช้กับ endpoint ฟอร์มคำขอปกติ:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `factoryId` | string | yes | ต้อง resolve เป็น active eligible factory |
| `factoryRegistrationNo` | string | yes | ใช้เป็น alias กับ identifier ทั้งสามแบบข้างต้น |

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
- กฎ factory assignment นี้ใช้กับ `GET /api/v1/connected-measurement-points`, `GET /api/v1/connected-measurement-points/:stationId/requests`, `GET /api/v1/connected-measurement-points/:stationId/device-configs` และ `GET /api/v1/cems-wpms-requests/table-rows`; สิทธิ์ที่ผูกกับผู้สร้างคำขอ เช่นการยกเลิก ยังตรวจ `createdBy` ตาม contract ของ endpoint นั้น.

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

### Add-parameter prefill

`GET /api/v1/connected-measurement-points/:stationId/parameter-form` ใช้ข้อมูลคำขอที่เชื่อมต่อแล้วเป็นฐานสำหรับรายละเอียดโรงงานและจุดตรวจวัด แต่ประกอบสถานะพารามิเตอร์ปัจจุบันจาก active device config ของ `stationId` ทุกครั้ง จึงไม่ใช้ `connectedParameters` และ `pendingParameters` จาก request snapshot โดยตรง.

Response fields ที่เพิ่มเติมสำหรับเลขทะเบียนโรงงาน:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `data.formDefaults.newRegistrationNo` | string | yes | เลขทะเบียนโรงงานใหม่จาก active `eligible_factories` |
| `data.formDefaults.oldRegistrationNo` | string \| null | yes | เลขทะเบียนโรงงานเดิมจาก active `eligible_factories` |
| `data.formDefaults.factoryRegistrationNo` | string | yes | compatibility alias สำหรับ client เดิม; ใช้เลขทะเบียนเดิมเมื่อมี มิฉะนั้นใช้เลขทะเบียนใหม่ |
| `data.formDefaults.measurementPoints[0].details.connectedParameters` | string[] | yes | พารามิเตอร์ที่มี active channel ใน device config ปัจจุบัน โดยตัดค่าซ้ำ |
| `data.formDefaults.measurementPoints[0].details.pendingParameters` | string[] | yes | พารามิเตอร์ที่เข้าข่ายซึ่งยังไม่มี active channel และไม่ได้รับการยกเว้น |

Minimal request: ไม่มี request body.

Minimal response:

```json
{
  "success": true,
  "data": {
    "requestType": "ADD_PARAMETER",
    "sourceRequestId": 12,
    "sourceRequestNo": "CEMS-0001/2569",
    "stationId": "S1125",
    "formDefaults": {
      "factoryId": "10120000325542",
      "factoryRegistrationNo": "3-34(3)-3/54นบ",
      "newRegistrationNo": "10120000325542",
      "oldRegistrationNo": "3-34(3)-3/54นบ",
      "measurementPoints": [
        {
          "pointCode": "S1125",
          "details": {
            "eligibleParameters": ["CO (ppm)", "NOx (ppm)"],
            "exemptedParameters": [],
            "connectedParameters": ["CO (ppm)", "NOx (ppm)"],
            "pendingParameters": []
          }
        }
      ]
    }
  }
}
```

`GET /api/v1/connected-measurement-points/:stationId/requests` ยังคงเป็นประวัติคำขอและอาจคืนค่าพารามิเตอร์ตาม snapshot ณ เวลายื่นคำขอ; client ที่ต้องการ prefill ฟอร์มเพิ่มพารามิเตอร์ต้องใช้ endpoint `parameter-form` นี้.

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
| Validators | [`connection-requests.validator.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.validator.ts), [`parameter-values.validator.ts`](../../../../../backend/src/modules/parameter-values/parameter-values.validator.ts), [`alert-events.validator.ts`](../../../../../backend/src/modules/alert-events/alert-events.validator.ts), [`integration-device-configs.validator.ts`](../../../../../backend/src/modules/integrations/integration-device-configs.validator.ts) |
| Public types | [`connection-requests.types.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.types.ts) |
| Sequence implementation | [`connection-requests.repository.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.repository.ts) |
| Reverse-proxy path normalization | [`annual-point-code-path.ts`](../../../../../backend/src/shared/middlewares/annual-point-code-path.ts), [`connected-measurement-points.routes.ts`](../../../../../backend/src/modules/connection-requests/connected-measurement-points.routes.ts), [`integrations.routes.ts`](../../../../../backend/src/modules/integrations/integrations.routes.ts) |
| Factory-profile patch rules | [`connected-factory-profile.ts`](../../../../../backend/src/modules/connection-requests/connected-factory-profile.ts) |
| Migrations | [`0075_start_operator_point_codes_at_2001.ts`](../../../../../backend/src/db/migrations/0075_start_operator_point_codes_at_2001.ts), [`0076_sync_connected_factory_profiles_with_eligible_factories.ts`](../../../../../backend/src/db/migrations/0076_sync_connected_factory_profiles_with_eligible_factories.ts) |
| Tests | [`connection-requests.point-code-sequence.repository.test.ts`](../../../../../backend/tests/unit/connection-requests.point-code-sequence.repository.test.ts), [`parameter-values.validator.test.ts`](../../../../../backend/tests/unit/parameter-values.validator.test.ts), [`alert-events.route.test.ts`](../../../../../backend/tests/unit/alert-events.route.test.ts), [`connected-measurement-points.route.test.ts`](../../../../../backend/tests/unit/connected-measurement-points.route.test.ts), [`integration-device-configs.route.test.ts`](../../../../../backend/tests/unit/integration-device-configs.route.test.ts) |
| Evidence | [Restore S/W point-code format TDD](../../../evidence/connection-requests/legacy-point-code-format-restored.tdd.md), [Request table current/live POMS factory name TDD](../../../evidence/connection-requests/request-table-current-factory-name.tdd.md) |
