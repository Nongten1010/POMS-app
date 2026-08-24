# โรงงานและคำขอแก้ไขข้อมูลในระบบ POMS

> Owner: Backend

## Frontend Quick Start

เมนูนี้ใช้ข้อมูลโรงงาน current/live จาก active rows ใน `cems_wpms_connected_measurement_points` เพื่อแสดงรายชื่อโรงงานและจุดตรวจวัดในระบบ POMS ผู้ประกอบการส่งคำขอแก้ไขข้อมูลระดับโรงงานได้ แต่ข้อมูลจริงจะยังไม่เปลี่ยนจนกว่าเจ้าหน้าที่พิจารณาอนุมัติ

การอ่านข้อมูลและการกำหนดขอบเขตโรงงานใช้ `factories:view` ส่วนการส่งหรือส่งกลับคำขอใช้ทั้ง `factories:view` และ `factories:edit` แต่การคัด resource สำหรับ mutation จะยึด data scope ของ `factories:edit` และการพิจารณาใช้ทั้ง `factories:view` และ `factories:approve` โดยยึด data scope ของ `factories:approve` ทุก endpoint ต้องใช้ Bearer token

### Main Flow

1. เรียก `GET /api/v1/poms-factories` เพื่อแสดงโรงงาน current/live ที่อยู่ใน data scope ของผู้ใช้
2. เรียก `GET /api/v1/poms-factories/:factoryId` เพื่ออ่าน profile ปัจจุบันและ `measurementPoints` สำหรับแสดงผลแบบ read-only
3. ผู้ประกอบการส่ง profile ที่ต้องการแก้ด้วย `POST /api/v1/poms-factories/:factoryId/edit-requests`
4. เจ้าหน้าที่อ่านรายการและรายละเอียดคำขอ แล้วเลือก `APPROVE`, `REQUEST_REVISION` หรือ `REJECT`
5. ถ้าขอให้แก้ไข ผู้ประกอบการส่งกลับด้วย `PUT /api/v1/poms-factories/edit-requests/:id/resubmission`
6. เมื่ออนุมัติ backend อัปเดต active `cems_wpms_connected_measurement_points` และ active `eligible_factories` ใน transaction เดียวกัน โดยไม่อัปเดตตาราง `factories`

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/poms-factories' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json'

curl --request GET \
  --url '<BASE_URL>/api/v1/poms-factories/factory-001' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json'

curl --request POST \
  --url '<BASE_URL>/api/v1/poms-factories/factory-001/edit-requests' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{"factoryName":"บริษัท ตัวอย่าง จำกัด (มหาชน)","factoryAddress":"99 หมู่ 1 ตำบลตัวอย่าง","latitude":14.315,"longitude":100.612,"eia":"มี","eiaOther":null,"projectName":"โครงการปรับปรุงระบบตรวจวัด","factoryFrontPhotos":[],"factoryLogo":null,"note":"ปรับชื่อและที่อยู่ให้ตรงกับเอกสารล่าสุด"}'

curl --request POST \
  --url '<BASE_URL>/api/v1/poms-factories/edit-requests/11/review' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{"decision":"APPROVE","revisionReason":null,"officerNote":"ตรวจสอบเอกสารแล้ว"}'
```

## Endpoint Summary

เมนูข้อมูลพื้นฐานมี `13` canonical endpoints และแสดงเป็น `17` Swagger operations เพราะ endpoint เดิมของจุดตรวจวัดมี annual path variants เพิ่ม `4` operations

| งาน                            | Method | Path                                                             | Permission                             | Contract                                                                                                                               |
| ------------------------------ | ------ | ---------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| รายชื่อโรงงาน current/live     | `GET`  | `/api/v1/poms-factories`                                         | `factories:view`                       | [List POMS factories](#get-apiv1poms-factories)                                                                                        |
| ข้อมูลโรงงานและจุดตรวจวัด      | `GET`  | `/api/v1/poms-factories/:factoryId`                              | `factories:view`                       | [POMS factory detail](#get-apiv1poms-factoriesfactoryid)                                                                               |
| ส่งคำขอแก้ไข profile           | `POST` | `/api/v1/poms-factories/:factoryId/edit-requests`                | `factories:view` + `factories:edit`    | [Create edit request](#post-apiv1poms-factoriesfactoryidedit-requests)                                                                 |
| รายการคำขอแก้ไข                | `GET`  | `/api/v1/poms-factories/edit-requests`                           | `factories:view`                       | [List edit requests](#get-apiv1poms-factoriesedit-requests)                                                                            |
| รายละเอียดคำขอแก้ไข            | `GET`  | `/api/v1/poms-factories/edit-requests/:id`                       | `factories:view`                       | [Edit-request detail](#get-apiv1poms-factoriesedit-requestsid)                                                                         |
| ส่งคำขอแก้ไขกลับเข้าพิจารณา    | `PUT`  | `/api/v1/poms-factories/edit-requests/:id/resubmission`          | `factories:view` + `factories:edit`    | [Resubmission](#put-apiv1poms-factoriesedit-requestsidresubmission)                                                                    |
| เจ้าหน้าที่พิจารณาคำขอ         | `POST` | `/api/v1/poms-factories/edit-requests/:id/review`                | `factories:view` + `factories:approve` | [Review](#post-apiv1poms-factoriesedit-requestsidreview)                                                                               |
| อ่านจุดที่เชื่อมต่อแล้วแบบเดิม | `GET`  | `/api/v1/connected-measurement-points`                           | `cems_wpms_requests:view`              | [Shared connected points](../../shared/connected-measurement-points/README.md)                                                         |
| อ่านจุดของโรงงานแบบเดิม        | `GET`  | `/api/v1/connected-measurement-points/factories/:factoryId`      | `cems_wpms_requests:view`              | [Shared connected points](../../shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsfactoriesfactoryid) |
| อ่านประวัติคำขอของจุด          | `GET`  | `/api/v1/connected-measurement-points/:stationId/requests`       | `cems_wpms_requests:view`              | [Shared connected points](../../shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidrequests)  |
| อ่าน prefill เพิ่มพารามิเตอร์  | `GET`  | `/api/v1/connected-measurement-points/:stationId/parameter-form` | `cems_wpms_requests:view`              | [ขอเชื่อมต่อ](../connection-requests/README.md#add-parameter-prefill)                                                                  |
| อ่าน config ปัจจุบัน           | `GET`  | `/api/v1/connected-measurement-points/:stationId/device-configs` | `cems_wpms_requests:view`              | [Device configs](../connection-requests/device-configs.md)                                                                             |
| แทนที่ config ปัจจุบัน         | `POST` | `/api/v1/connected-measurement-points/:stationId/device-configs` | `cems_wpms_requests:edit`              | [Device configs](../connection-requests/device-configs.md)                                                                             |

## Shared Data-scope And Permission Contract

| Concern              | Contract                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authentication       | ทุก endpoint ภายใต้ `/api/v1/poms-factories` ต้องมี Bearer token                                                                                                         |
| Read scope           | `GET` ทั้งหมดใช้ scope ของ `factories:view`: `ALL`, `IN_REGION`, `IN_PROVINCE`, `IN_ESTATE` หรือ `OWN_FACTORY`                                                           |
| Edit scope           | `POST .../edit-requests` และ `PUT .../resubmission` ต้องผ่านทั้ง `factories:view` และ `factories:edit` แต่การคัด resource สำหรับ mutation ยึด scope ของ `factories:edit` |
| Approval scope       | `POST .../review` ต้องผ่านทั้ง `factories:view` และ `factories:approve` และการคัดคำขอยึด scope ของ `factories:approve`                                                   |
| Object scope         | รายการถูกกรองตาม effective scope ของ endpoint; detail หรือ mutation ที่อ้างโรงงาน/คำขอนอก scope ตอบ `404 NOT_FOUND` เพื่อไม่เปิดเผยว่าข้อมูลมีอยู่                       |
| Separation of duties | ผู้พิจารณาต้องไม่ตรงกับทั้ง `createdBy` และ `submittedBy` ของคำขอ; กฎนี้ใช้กับ `APPROVE`, `REQUEST_REVISION` และ `REJECT`; ถ้าซ้ำตอบ `403 FORBIDDEN`                     |

## Contracts

### `GET /api/v1/poms-factories`

คืนโรงงาน current/live แบบไม่ซ้ำโรงงาน โดยนับและสรุปจาก active `cems_wpms_connected_measurement_points` เท่านั้น ไม่ใช้ตาราง `factories` เป็นแหล่งรายชื่อ POMS

#### Request Fields

| Field    | Location | Type   | Required | Rules                                                                              |
| -------- | -------- | ------ | -------- | ---------------------------------------------------------------------------------- |
| `search` | query    | string | no       | trim แล้ว 1–255 ตัวอักษร; ค้นจากรหัส/ชื่อ/เลขทะเบียนโรงงาน หรือชื่อ/รหัสจุดตรวจวัด |

Minimal request JSON สำหรับ endpoint ที่ไม่มี body:

```json
{}
```

#### Success Response Fields

| Field                            | Type                 | Nullable | Description                                                    |
| -------------------------------- | -------------------- | -------- | -------------------------------------------------------------- |
| `success`                        | boolean              | no       | `true`                                                         |
| `data`                           | object[]             | no       | โรงงาน current/live ที่ผู้เรียกมองเห็น                         |
| `data[].eligibleFactoryId`       | number               | no       | active `eligible_factories.id` ที่จับคู่กับข้อมูล current/live |
| `data[].factoryId`               | string               | no       | stable factory identifier ของข้อมูล current/live               |
| `data[].factoryRegistrationNo`   | string               | no       | เลขทะเบียนโรงงาน                                               |
| `data[].factoryName`             | string               | no       | ชื่อโรงงานปัจจุบัน                                             |
| `data[].factoryAddress`          | string               | yes      | ที่อยู่โรงงานปัจจุบัน                                          |
| `data[].provinceName`            | string               | yes      | จังหวัดสำหรับแสดงผลและตรวจ scope                               |
| `data[].industrialEstateName`    | string               | yes      | นิคมอุตสาหกรรมสำหรับแสดงผลและตรวจ scope                        |
| `data[].latitude`                | number               | yes      | ละติจูด                                                        |
| `data[].longitude`               | number               | yes      | ลองจิจูด                                                       |
| `data[].eia`                     | string               | yes      | ค่า EIA ตาม enum ของระบบ                                       |
| `data[].eiaOther`                | string               | yes      | รายละเอียดเมื่อ `eia = "อื่นๆ"`                                |
| `data[].projectName`             | string               | yes      | ชื่อโครงการ                                                    |
| `data[].factoryFrontPhotos`      | object[]             | no       | เอกสาร/ภาพด้านหน้าโรงงาน                                       |
| `data[].factoryLogo`             | object               | yes      | โลโก้โรงงาน                                                    |
| `data[].systemTypes`             | (`CEMS` \| `WPMS`)[] | no       | ระบบที่มี active point ในโรงงาน เรียงและไม่ซ้ำ                 |
| `data[].measurementPointCount`   | number               | no       | จำนวน active connected points ของโรงงาน                        |
| `data[].pendingEditRequestCount` | number               | no       | จำนวน open edit request ของโรงงาน; รองรับค่า `0` หรือ `1`      |
| `data[].updatedAt`               | ISO 8601 string      | no       | เวลาแก้ไขล่าสุดของ active point ที่นำมาสรุป                    |
| `meta.total`                     | number               | no       | จำนวนโรงงานใน `data`                                           |

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": [
    {
      "eligibleFactoryId": 7,
      "factoryId": "factory-001",
      "factoryRegistrationNo": "3-106-33/50สบ",
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "factoryAddress": "99 หมู่ 1",
      "provinceName": "สระบุรี",
      "industrialEstateName": null,
      "latitude": 14.315,
      "longitude": 100.612,
      "eia": "มี",
      "eiaOther": null,
      "projectName": "โครงการระบบตรวจวัด",
      "factoryFrontPhotos": [],
      "factoryLogo": null,
      "systemTypes": ["CEMS"],
      "measurementPointCount": 2,
      "pendingEditRequestCount": 0,
      "updatedAt": "2026-08-24T02:00:00.000Z"
    }
  ],
  "meta": { "total": 1 }
}
```

### `GET /api/v1/poms-factories/:factoryId`

คืน profile current/live พร้อม `measurementPoints` สำหรับแสดงผล จุดตรวจวัดทั้งหมดเป็น read-only ใน workflow แก้ไข profile รุ่นแรก

#### Request Fields

| Field       | Location | Type   | Required | Rules                                                                                |
| ----------- | -------- | ------ | -------- | ------------------------------------------------------------------------------------ |
| `factoryId` | path     | string | yes      | trim แล้ว 1–64 ตัวอักษร; รับ current `factoryId` หรือเลขทะเบียนโรงงานที่ resolve ได้ |

Minimal request JSON:

```json
{}
```

#### Additional Success Fields

นอกจาก field ระดับโรงงานของ list endpoint แล้ว detail เพิ่ม field ต่อไปนี้

| Field                                               | Type                               | Nullable | Description                                            |
| --------------------------------------------------- | ---------------------------------- | -------- | ------------------------------------------------------ |
| `data.measurementPoints`                            | object[]                           | no       | active connected points ของโรงงาน                      |
| `data.measurementPoints[].connectedPointId`         | number                             | no       | ID ของ active `cems_wpms_connected_measurement_points` |
| `data.measurementPoints[].sourceMeasurementPointId` | number                             | no       | จุดต้นทางในคำขอเชื่อมต่อ                               |
| `data.measurementPoints[].systemType`               | `CEMS` \| `WPMS`                   | no       | ระบบของจุดตรวจวัด                                      |
| `data.measurementPoints[].pointName`                | string                             | no       | ชื่อจุดตรวจวัด                                         |
| `data.measurementPoints[].pointCode`                | string                             | yes      | รหัสจุดตรวจวัด                                         |
| `data.measurementPoints[].pointType`                | `STACK` \| `WASTEWATER` \| `OTHER` | no       | ประเภทจุด                                              |
| `data.measurementPoints[].parameters`               | string[]                           | no       | ชื่อพารามิเตอร์พร้อมหน่วยเมื่อมีข้อมูลหน่วย            |
| `data.measurementPoints[].monitoringPointStatus`    | string                             | yes      | สถานะจุดตรวจวัดตาม enum กลาง                           |
| `data.measurementPoints[].details`                  | object                             | yes      | รายละเอียดจุด current/live                             |
| `data.measurementPoints[].documentsAndImages`       | object[]                           | no       | เอกสารและภาพของจุด                                     |
| `data.measurementPoints[].measurementInstruments`   | object                             | yes      | ข้อมูลเครื่องมือตรวจวัด                                |
| `data.measurementPoints[].updatedAt`                | ISO 8601 string                    | no       | เวลาแก้ไขจุดล่าสุด                                     |

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "eligibleFactoryId": 7,
    "factoryId": "factory-001",
    "factoryRegistrationNo": "3-106-33/50สบ",
    "factoryName": "บริษัท ตัวอย่าง จำกัด",
    "factoryAddress": "99 หมู่ 1",
    "provinceName": "สระบุรี",
    "industrialEstateName": null,
    "latitude": 14.315,
    "longitude": 100.612,
    "eia": "มี",
    "eiaOther": null,
    "projectName": "โครงการระบบตรวจวัด",
    "factoryFrontPhotos": [],
    "factoryLogo": null,
    "systemTypes": ["CEMS"],
    "measurementPointCount": 1,
    "pendingEditRequestCount": 0,
    "updatedAt": "2026-08-24T02:00:00.000Z",
    "measurementPoints": [
      {
        "connectedPointId": 15,
        "sourceMeasurementPointId": 2,
        "systemType": "CEMS",
        "pointName": "ปล่อง A",
        "pointCode": "S2001",
        "pointType": "STACK",
        "parameters": ["CO (ppm)"],
        "monitoringPointStatus": "Normal",
        "details": null,
        "documentsAndImages": [],
        "measurementInstruments": null,
        "updatedAt": "2026-08-24T02:00:00.000Z"
      }
    ]
  }
}
```

### Shared Profile-edit Fields

`POST .../edit-requests` และ `PUT .../resubmission` ใช้ profile allowlist เดียวกัน จุดตรวจวัดและ field ตัวตน/สิทธิ์ไม่อยู่ใน write contract รุ่นแรก

| Field                | Type           | Required | Rules                                                                                               |
| -------------------- | -------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `factoryName`        | string         | yes      | trim แล้ว 1–500 ตัวอักษร                                                                            |
| `factoryAddress`     | string \| null | no       | omission = คงค่าเดิม; `null` = ล้างค่า; string trim แล้วไม่เกิน 1000 ตัวอักษร                       |
| `latitude`           | number \| null | no       | ช่วง `-90` ถึง `90`; ต้องส่งพร้อม `longitude` รวมถึงกรณีส่ง `null` เพื่อล้างพิกัด                   |
| `longitude`          | number \| null | no       | ช่วง `-180` ถึง `180`; ต้องส่งพร้อม `latitude`                                                      |
| `eia`                | string \| null | no       | omission = คงค่าเดิม; `null` = ล้างค่า; enum: `มี`, `ไม่มี`, `มี IEE`, `มี EIA`, `มี EHIA`, `อื่นๆ` |
| `eiaOther`           | string \| null | no       | ต้องมีข้อความเมื่อส่ง `eia = "อื่นๆ"`; ห้ามส่งค่า non-null ในกรณีอื่น; ไม่เกิน 500 ตัวอักษร         |
| `projectName`        | string \| null | no       | omission = คงค่าเดิม; `null` = ล้างค่า; string ไม่เกิน 500 ตัวอักษร                                 |
| `factoryFrontPhotos` | object[]       | no       | omission = คงค่าเดิม; `[]` = ล้างทั้งหมด; มากสุด 10 รายการ                                          |
| `factoryLogo`        | object \| null | no       | omission = คงค่าเดิม; `null` = ล้างโลโก้                                                            |
| `note`               | string \| null | no       | หมายเหตุผู้ส่ง ไม่เกิน 1000 ตัวอักษร                                                                |

Document object ของ `factoryFrontPhotos[]` และ `factoryLogo`:

Endpoint นี้ไม่รับ multipart/binary upload; client ต้องอัปโหลดไฟล์ผ่านช่องทางที่ระบบอนุญาตก่อน แล้วส่ง document metadata ที่มี absolute URL

| Field         | Type                     | Required | Rules                                                                                             |
| ------------- | ------------------------ | -------- | ------------------------------------------------------------------------------------------------- |
| `title`       | string                   | yes      | trim แล้ว 1–255 ตัวอักษร                                                                          |
| `description` | string \| null           | no       | ไม่เกิน 1000 ตัวอักษร                                                                             |
| `link`        | string \| null           | no       | absolute `http`/`https` URL ไม่เกิน 2048 ตัวอักษร; ต้องมี `link` หรือ `fileUrl` อย่างน้อยหนึ่งค่า |
| `fileName`    | string \| null           | no       | ไม่เกิน 255 ตัวอักษร                                                                              |
| `fileUrl`     | string \| null           | no       | absolute `http`/`https` URL ไม่เกิน 2048 ตัวอักษร; ต้องมี `link` หรือ `fileUrl` อย่างน้อยหนึ่งค่า |
| `fileType`    | string \| null           | no       | ไม่เกิน 128 ตัวอักษร                                                                              |
| `fileSize`    | positive integer \| null | no       | 1–5,242,880 bytes                                                                                 |

field ที่ห้ามส่ง ได้แก่ `eligibleFactoryId`, `factoryId`, `factoryRegistrationNo`, จังหวัด/ภูมิภาค/นิคม, กลุ่มอุตสาหกรรม, สถานะ/audit, `measurementPoints` และ point configuration ทุกชนิด เนื่องจาก schema เป็น strict object จึงตอบ `400 VALIDATION_ERROR` เมื่อมี field นอก allowlist

### `POST /api/v1/poms-factories/:factoryId/edit-requests`

สร้างคำขอ `PENDING_REVIEW` โดยเก็บ snapshot profile ปัจจุบันและ proposed profile หนึ่งโรงงานมี open request ได้หนึ่งรายการในเวลาเดียวกัน response ใช้ field contract เดียวกับ [edit-request detail](#get-apiv1poms-factoriesedit-requestsid)

#### Request Fields

ใช้ `factoryId` path ตาม detail endpoint และ body ตาม [Shared Profile-edit Fields](#shared-profile-edit-fields)

Minimal request:

```json
{
  "factoryName": "บริษัท ตัวอย่าง จำกัด (มหาชน)",
  "factoryAddress": "99 หมู่ 1 ตำบลตัวอย่าง",
  "latitude": 14.315,
  "longitude": 100.612,
  "eia": "มี",
  "eiaOther": null,
  "projectName": "โครงการปรับปรุงระบบตรวจวัด",
  "factoryFrontPhotos": [],
  "factoryLogo": null,
  "note": "ปรับข้อมูลตามหนังสือรับรองล่าสุด"
}
```

Minimal response (`201 Created`):

```json
{
  "success": true,
  "data": {
    "id": 11,
    "requestNo": "PFE-20260824-A1B2C3D4",
    "revisionNo": 0,
    "isOpen": true,
    "eligibleFactoryId": 7,
    "factoryId": "factory-001",
    "factoryName": "บริษัท ตัวอย่าง จำกัด (มหาชน)",
    "status": "PENDING_REVIEW",
    "statusLabel": "รอพิจารณา",
    "requestNote": "ปรับข้อมูลตามหนังสือรับรองล่าสุด",
    "revisionReason": null,
    "officerNote": null,
    "submittedBy": 42,
    "reviewedBy": null,
    "reviewedAt": null,
    "createdAt": "2026-08-24T02:00:00.000Z",
    "updatedAt": "2026-08-24T02:00:00.000Z"
  }
}
```

### `GET /api/v1/poms-factories/edit-requests`

คืนรายการคำขอที่อยู่ใน `factories:view` data scope ของผู้เรียก เรียงใหม่ก่อน สมาชิกใน `data[]` ใช้ field contract เดียวกับ [edit-request detail](#get-apiv1poms-factoriesedit-requestsid)

#### Request Fields

| Field       | Location | Type   | Required | Rules                                                                             |
| ----------- | -------- | ------ | -------- | --------------------------------------------------------------------------------- |
| `status`    | query    | string | no       | ค่าใดค่าหนึ่งใน workflow status table                                             |
| `factoryId` | query    | string | no       | trim แล้ว 1–64 ตัวอักษร; รับ identifier ที่ระบบ resolve ได้                       |
| `search`    | query    | string | no       | trim แล้ว 1–255 ตัวอักษร; ค้น `requestNo`, `factoryId`, เลขทะเบียน หรือชื่อโรงงาน |

Minimal request JSON:

```json
{}
```

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": [
    {
      "id": 11,
      "requestNo": "PFE-20260824-A1B2C3D4",
      "revisionNo": 0,
      "isOpen": true,
      "eligibleFactoryId": 7,
      "factoryId": "factory-001",
      "factoryName": "บริษัท ตัวอย่าง จำกัด (มหาชน)",
      "status": "PENDING_REVIEW",
      "statusLabel": "รอพิจารณา",
      "submittedBy": 42,
      "createdAt": "2026-08-24T02:00:00.000Z",
      "updatedAt": "2026-08-24T02:00:00.000Z"
    }
  ],
  "meta": { "total": 1 }
}
```

### `GET /api/v1/poms-factories/edit-requests/:id`

คืน current/proposed snapshot, workflow events และ audit metadata ของคำขอเดียว

#### Request Fields

| Field | Location | Type             | Required | Rules           |
| ----- | -------- | ---------------- | -------- | --------------- |
| `id`  | path     | positive integer | yes      | edit-request ID |

Minimal request JSON:

```json
{}
```

#### Success Response Fields

| Field                        | Type                                                                  | Nullable | Description                                                                      |
| ---------------------------- | --------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| `data.id`                    | number                                                                | no       | edit-request ID                                                                  |
| `data.requestNo`             | string                                                                | no       | `PFE-YYYYMMDD-XXXXXXXX`; วันที่ UTC ตอนสร้างตามด้วย UUID 8 ตัวแรกแบบตัวพิมพ์ใหญ่ |
| `data.eligibleFactoryId`     | number                                                                | no       | active `eligible_factories.id` ของคำขอ                                           |
| `data.factoryId`             | string                                                                | no       | current/live factory identifier                                                  |
| `data.factoryRegistrationNo` | string                                                                | no       | เลขทะเบียนโรงงาน                                                                 |
| `data.factoryName`           | string                                                                | no       | ชื่อโรงงานใน proposed profile                                                    |
| `data.revisionNo`            | number                                                                | no       | รอบแก้ไข เริ่มที่ `0` และเพิ่มเมื่อ resubmit                                     |
| `data.isOpen`                | boolean                                                               | no       | `true` สำหรับสถานะที่ workflow ยังไม่สิ้นสุด                                     |
| `data.status`                | string                                                                | no       | workflow status code                                                             |
| `data.statusLabel`           | string                                                                | no       | label สำหรับแสดงผล                                                               |
| `data.requestNote`           | string                                                                | yes      | หมายเหตุผู้ส่ง                                                                   |
| `data.revisionReason`        | string                                                                | yes      | เหตุผลที่เจ้าหน้าที่ขอแก้ไข                                                      |
| `data.officerNote`           | string                                                                | yes      | หมายเหตุการพิจารณา                                                               |
| `data.currentFactory`        | object                                                                | no       | snapshot ก่อนส่งคำขอรอบล่าสุด                                                    |
| `data.proposedFactory`       | object                                                                | no       | snapshot ที่เสนอแก้ไขรอบล่าสุด                                                   |
| `data.submittedBy`           | number                                                                | no       | user ID ผู้ส่งรอบล่าสุด                                                          |
| `data.submittedAt`           | ISO 8601 string                                                       | no       | เวลาส่งรอบล่าสุด                                                                 |
| `data.reviewedBy`            | number                                                                | yes      | user ID ผู้พิจารณาล่าสุด                                                         |
| `data.reviewedAt`            | ISO 8601 string                                                       | yes      | เวลาพิจารณาล่าสุด                                                                |
| `data.approvedAt`            | ISO 8601 string                                                       | yes      | เวลาอนุมัติ; มีเฉพาะ `APPROVED`                                                  |
| `data.createdBy`             | number                                                                | no       | user ID ผู้สร้างคำขอครั้งแรก                                                     |
| `data.events`                | object[]                                                              | no       | audit events เรียงตามเวลาและ ID                                                  |
| `data.events[].id`           | number                                                                | no       | event ID                                                                         |
| `data.events[].action`       | `SUBMIT` \| `RESUBMIT` \| `APPROVE` \| `REQUEST_REVISION` \| `REJECT` | no       | action ที่เกิดขึ้น                                                               |
| `data.events[].fromStatus`   | string                                                                | yes      | status ก่อน action                                                               |
| `data.events[].toStatus`     | string                                                                | no       | status หลัง action                                                               |
| `data.events[].note`         | string                                                                | yes      | note หรือเหตุผลของ event                                                         |
| `data.events[].actorUserId`  | number                                                                | no       | user ID ผู้ทำ action                                                             |
| `data.events[].createdAt`    | ISO 8601 string                                                       | no       | เวลาเกิด event                                                                   |
| `data.createdAt`             | ISO 8601 string                                                       | no       | เวลาสร้างคำขอ                                                                    |
| `data.updatedAt`             | ISO 8601 string                                                       | no       | เวลาเปลี่ยนแปลงล่าสุด                                                            |

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "id": 11,
    "requestNo": "PFE-20260824-A1B2C3D4",
    "eligibleFactoryId": 7,
    "factoryId": "factory-001",
    "factoryRegistrationNo": "3-106-33/50สบ",
    "factoryName": "บริษัท ตัวอย่าง จำกัด (มหาชน)",
    "revisionNo": 0,
    "isOpen": true,
    "status": "REVISION_REQUESTED",
    "statusLabel": "ส่งกลับให้แก้ไข",
    "requestNote": "ปรับข้อมูลตามหนังสือรับรองล่าสุด",
    "revisionReason": "กรุณาแนบภาพด้านหน้าโรงงานล่าสุด",
    "officerNote": null,
    "currentFactory": {
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "factoryAddress": "88 หมู่ 1"
    },
    "proposedFactory": {
      "factoryName": "บริษัท ตัวอย่าง จำกัด (มหาชน)",
      "factoryAddress": "99 หมู่ 1 ตำบลตัวอย่าง"
    },
    "submittedBy": 42,
    "submittedAt": "2026-08-24T02:00:00.000Z",
    "reviewedBy": 77,
    "reviewedAt": "2026-08-24T03:00:00.000Z",
    "approvedAt": null,
    "createdBy": 42,
    "events": [
      {
        "id": 2,
        "action": "REQUEST_REVISION",
        "fromStatus": "PENDING_REVIEW",
        "toStatus": "REVISION_REQUESTED",
        "note": "กรุณาแนบภาพด้านหน้าโรงงานล่าสุด",
        "actorUserId": 77,
        "createdAt": "2026-08-24T03:00:00.000Z"
      }
    ],
    "createdAt": "2026-08-24T02:00:00.000Z",
    "updatedAt": "2026-08-24T03:00:00.000Z"
  }
}
```

### `PUT /api/v1/poms-factories/edit-requests/:id/resubmission`

ใช้ได้เมื่อสถานะเป็น `REVISION_REQUESTED` เท่านั้น backend โหลด profile current/live ล่าสุดเป็น snapshot ใหม่และแทนที่ proposed profile จาก body แล้วเปลี่ยนสถานะเป็น `REVISED_PENDING_REVIEW`

#### Request Fields

ใช้ `id` path ตาม detail endpoint และ body ตาม [Shared Profile-edit Fields](#shared-profile-edit-fields)

Minimal request:

```json
{
  "factoryName": "บริษัท ตัวอย่าง จำกัด (มหาชน)",
  "factoryFrontPhotos": [
    {
      "title": "ภาพด้านหน้าโรงงานล่าสุด",
      "fileName": "factory-front.jpg",
      "fileUrl": "https://example.com/uploads/factory-front.jpg",
      "fileType": "image/jpeg",
      "fileSize": 245760
    }
  ],
  "note": "แก้ไขตามข้อสังเกตแล้ว"
}
```

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "id": 11,
    "requestNo": "PFE-20260824-A1B2C3D4",
    "revisionNo": 1,
    "isOpen": true,
    "status": "REVISED_PENDING_REVIEW",
    "statusLabel": "แก้ไขแล้ว รอพิจารณา",
    "revisionReason": null,
    "submittedBy": 42,
    "updatedAt": "2026-08-24T04:00:00.000Z"
  }
}
```

### `POST /api/v1/poms-factories/edit-requests/:id/review`

เจ้าหน้าที่พิจารณาคำขอที่อยู่ใน `PENDING_REVIEW` หรือ `REVISED_PENDING_REVIEW` และอยู่ใน data scope ของ `factories:approve` ผู้พิจารณาต้องไม่ใช่ทั้งผู้สร้างคำขอครั้งแรก (`createdBy`) และผู้ส่งรอบล่าสุด (`submittedBy`) แม้จะเป็นคนละคนกัน

#### Request Fields

| Field            | Type                                        | Required    | Rules                                                                              |
| ---------------- | ------------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| `decision`       | `APPROVE` \| `REQUEST_REVISION` \| `REJECT` | yes         | decision ของ state transition                                                      |
| `revisionReason` | string \| null                              | conditional | บังคับเมื่อ `decision = "REQUEST_REVISION"`; trim แล้วไม่เกิน 1000 ตัวอักษร        |
| `officerNote`    | string \| null                              | conditional | บังคับเมื่อ `decision = "REJECT"`; optional เมื่อ `APPROVE`; ไม่เกิน 1000 ตัวอักษร |

Minimal request:

```json
{
  "decision": "APPROVE",
  "revisionReason": null,
  "officerNote": "ตรวจสอบเอกสารแล้ว"
}
```

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "id": 11,
    "requestNo": "PFE-20260824-A1B2C3D4",
    "revisionNo": 1,
    "isOpen": false,
    "status": "APPROVED",
    "statusLabel": "อนุมัติแล้ว",
    "officerNote": "ตรวจสอบเอกสารแล้ว",
    "reviewedBy": 77,
    "reviewedAt": "2026-08-24T05:00:00.000Z",
    "updatedAt": "2026-08-24T05:00:00.000Z"
  }
}
```

## Workflow, Concurrency And Idempotency

### Status And Decisions

| Status                   | `statusLabel`         | `isOpen` | Meaning                            |
| ------------------------ | --------------------- | -------- | ---------------------------------- |
| `PENDING_REVIEW`         | `รอพิจารณา`           | `true`   | ส่งคำขอครั้งแรกแล้ว                |
| `REVISION_REQUESTED`     | `ส่งกลับให้แก้ไข`     | `true`   | รอผู้ส่งแก้ไขตาม `revisionReason`  |
| `REVISED_PENDING_REVIEW` | `แก้ไขแล้ว รอพิจารณา` | `true`   | ส่งกลับเข้ารอบพิจารณาแล้ว          |
| `APPROVED`               | `อนุมัติแล้ว`         | `false`  | อัปเดต profile current/live สำเร็จ |
| `REJECTED`               | `ไม่อนุมัติ`          | `false`  | ปิดคำขอโดยไม่เปลี่ยนข้อมูลจริง     |

State transitions:

| Current status                                 | Who                    | Operation/decision | Next status              | Effect                                                |
| ---------------------------------------------- | ---------------------- | ------------------ | ------------------------ | ----------------------------------------------------- |
| none                                           | ผู้มี `factories:edit` | create             | `PENDING_REVIEW`         | เก็บ current/proposed snapshot และเปิดคำขอ            |
| `PENDING_REVIEW`                               | เจ้าหน้าที่            | `REQUEST_REVISION` | `REVISION_REQUESTED`     | บันทึก `revisionReason`; ยังไม่แก้ข้อมูลจริง          |
| `REVISION_REQUESTED`                           | ผู้มี `factories:edit` | resubmission       | `REVISED_PENDING_REVIEW` | refresh current snapshot และส่ง proposed profile ใหม่ |
| `PENDING_REVIEW` หรือ `REVISED_PENDING_REVIEW` | เจ้าหน้าที่            | `APPROVE`          | `APPROVED`               | sync ข้อมูลจริงแบบ atomic                             |
| `PENDING_REVIEW` หรือ `REVISED_PENDING_REVIEW` | เจ้าหน้าที่            | `REJECT`           | `REJECTED`               | ปิดคำขอโดยไม่แก้ข้อมูลจริง                            |

Approval target mapping:

| API profile field                   | active `cems_wpms_connected_measurement_points`                                           | active `eligible_factories`                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `factoryName`                       | `factory_name` ทุก active point                                                           | `factory_name`                                   |
| `factoryAddress`                    | `factory_address` ทุก active point                                                        | `address`                                        |
| `latitude`, `longitude`             | `factory_latitude`, `factory_longitude` ทุก active point                                  | `latitude`, `longitude`                          |
| `eia`, `eiaOther`                   | `factory_eia_assessment`, `factory_eia_other`, derived `factory_has_eia` ทุก active point | `eia_assessment`, `eia_other`, derived `has_eia` |
| `projectName`                       | `factory_project_name` ทุก active point                                                   | `project_name`                                   |
| `factoryFrontPhotos`, `factoryLogo` | `factory_front_photos_json`, `factory_logo_json` ทุก active point                         | ไม่มี target field และไม่อัปเดต                  |

- หนึ่งโรงงานมี open request ได้หนึ่งรายการ โดย open status คือ `PENDING_REVIEW`, `REVISION_REQUESTED` หรือ `REVISED_PENDING_REVIEW`
- create/resubmission/review ไม่รับ `Idempotency-Key`; การเรียกซ้ำหลัง transition สำเร็จจะตอบ `409 CONFLICT` แทนการทำซ้ำ
- การอนุมัติ lock คำขอและข้อมูล current/live ที่เกี่ยวข้องใน transaction เดียวกัน และตรวจ source version จากตอนส่ง/ส่งกลับ หากข้อมูลจริงถูกเปลี่ยนระหว่างรอพิจารณาให้ตอบ `409 CONFLICT` โดยไม่มี partial update
- approval ทำ target updates ตามตารางข้างต้นแบบ atomic; ตาราง `factories` ไม่ใช่เป้าหมายของ workflow นี้
- `measurementPoints` ใน detail เป็นข้อมูลแสดงผลเท่านั้น การอนุมัติ profile edit รุ่นแรกไม่เปลี่ยน point name, parameter, status, device config หรือข้อมูลเครื่องมือ

## Errors

ทุก endpoint ใช้ [shared success/error envelope](../../shared/common-api/README.md#shared-response-shape)

| HTTP status | `error.code`       | Condition                                                                                                                                  | Client action                                   |
| ----------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `400`       | `VALIDATION_ERROR` | path/query/body ไม่ตรง strict schema, พิกัดไม่ส่งเป็นคู่, `eiaOther` ผิดเงื่อนไข หรือมี field นอก allowlist                                | แสดง validation ตาม `error.issues[].pathString` |
| `401`       | `UNAUTHORIZED`     | token ไม่มี/หมดอายุ/ไม่ถูกต้อง                                                                                                             | login ใหม่                                      |
| `403`       | `FORBIDDEN`        | ไม่มี action permission หรือ user ผู้พิจารณาซ้ำกับ `createdBy` หรือ `submittedBy` ของคำขอ                                                  | ซ่อน action หรือให้เจ้าหน้าที่คนอื่นพิจารณา     |
| `404`       | `NOT_FOUND`        | ไม่พบโรงงาน/คำขอ หรือ resource อยู่นอก effective data scope ของ endpoint (`factories:view`, `factories:edit`, หรือ `factories:approve`)    | กลับหน้ารายการและ refresh                       |
| `409`       | `CONFLICT`         | ไม่มี profile field เปลี่ยน, มี open request อยู่แล้ว, status ไม่รองรับ transition, source version เปลี่ยน หรือ request ถูกพิจารณาพร้อมกัน | refresh detail และตัดสินใจจากสถานะล่าสุด        |

## Business Flow And Explanations

- [Connected factory profile sync workflow](../../../../../workflows/connected-factory-profile-sync.md)
- [จุดตรวจวัดที่เชื่อมต่อแล้ว](../../shared/connected-measurement-points/README.md)
- [นิยามโรงงาน current/live และโรงงานที่เข้าข่าย](../eligible-factories/README.md)

## Backend Maintainer Map

| Concern                | Canonical source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mounting               | [`app.ts`](../../../../../backend/src/app.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Routes                 | [`poms-factories.routes.ts`](../../../../../backend/src/modules/poms-factories/poms-factories.routes.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Controller             | [`poms-factories.controller.ts`](../../../../../backend/src/modules/poms-factories/poms-factories.controller.ts)                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Validators             | [`poms-factories.validator.ts`](../../../../../backend/src/modules/poms-factories/poms-factories.validator.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Service/state rules    | [`poms-factories.service.ts`](../../../../../backend/src/modules/poms-factories/poms-factories.service.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Repository/atomic sync | [`poms-factories.repository.ts`](../../../../../backend/src/modules/poms-factories/poms-factories.repository.ts)                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Public types/statuses  | [`poms-factories.types.ts`](../../../../../backend/src/modules/poms-factories/poms-factories.types.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Runtime OpenAPI        | [`poms.openapi.ts`](../../../../../backend/src/modules/api-docs/poms.openapi.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Migration              | [`0100_create_poms_factory_edit_requests.ts`](../../../../../backend/src/db/migrations/0100_create_poms_factory_edit_requests.ts)                                                                                                                                                                                                                                                                                                                                                                                                              |
| Tests                  | [`poms-factories.route.test.ts`](../../../../../backend/tests/unit/poms-factories.route.test.ts), [`poms-factories.service.test.ts`](../../../../../backend/tests/unit/poms-factories.service.test.ts), [`poms-factories.repository.test.ts`](../../../../../backend/tests/unit/poms-factories.repository.test.ts), [`poms-factory-edit-requests-migration.test.ts`](../../../../../backend/tests/unit/poms-factory-edit-requests-migration.test.ts), [`api-docs.openapi.test.ts`](../../../../../backend/tests/unit/api-docs.openapi.test.ts) |

ไม่มี breaking-change entry สำหรับ capability นี้ เพราะเป็นการเพิ่ม endpoints ใหม่โดยไม่เปลี่ยน contract เดิม
