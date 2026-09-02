# โรงงานและคำขอแก้ไขข้อมูลในระบบ POMS

> Owner: Backend

## Frontend Quick Start

เมนูนี้ใช้ข้อมูลโรงงาน current/live จาก active rows ใน `cems_wpms_connected_measurement_points` เพื่อแสดงรายชื่อโรงงานและจุดตรวจวัดในระบบ POMS ผู้ประกอบการส่งคำขอแก้ไขได้ 2 แบบฟอร์มคือ `BASIC_INFO` และ `MEASUREMENT_POINTS` แต่ข้อมูลจริงจะยังไม่เปลี่ยนจนกว่า admin จะพิจารณาอนุมัติ

การอ่านข้อมูลและการกำหนดขอบเขตโรงงานใช้ `factories:view` ส่วนการส่งหรือส่งกลับคำขอใช้ทั้ง `factories:view` และ `factories:edit` แต่การคัด resource สำหรับ mutation จะยึด data scope ของ `factories:edit` และการพิจารณาใช้ทั้ง `factories:view` และ `factories:approve` โดยยึด data scope ของ `factories:approve` พร้อมบังคับว่า reviewer ต้องมี role `admin` ทุก endpoint ต้องใช้ Bearer token

### Main Flow

1. เรียก `GET /api/v1/poms-factories` เพื่อแสดงโรงงาน current/live ที่อยู่ใน data scope ของผู้ใช้
2. เรียก `GET /api/v1/poms-factories/:factoryId/form` เพื่อลง current/live values ด้วยชื่อและ shape เดียวกับ `GET /api/v1/cems-wpms-requests/:id/form`
3. ผู้ประกอบการส่งคำขอแก้ไขด้วย `POST /api/v1/poms-factories/:factoryId/edit-requests` โดยเลือก `formType` เป็น `BASIC_INFO` หรือ `MEASUREMENT_POINTS`
4. admin อ่านรายการและรายละเอียดคำขอ แล้วเลือก `APPROVE`, `REQUEST_REVISION` หรือ `REJECT`
5. ถ้าขอให้แก้ไข ผู้ประกอบการเรียก `GET /api/v1/poms-factories/edit-requests/:id/form` เพื่อลง proposed values แล้วส่งกลับด้วย `PUT /api/v1/poms-factories/edit-requests/:id/resubmission`
6. เมื่ออนุมัติ backend อัปเดต current/live POMS data ตาม `formType`: `BASIC_INFO` sync active `cems_wpms_connected_measurement_points` และ active `eligible_factories`, ส่วน `MEASUREMENT_POINTS` sync active `cems_wpms_connected_measurement_points` ของโรงงานนั้น โดยไม่อัปเดตตาราง `factories`

### Capability Boundary

- `BASIC_INFO` ใช้แก้ profile โรงงานตาม allowlist และเมื่ออนุมัติจะ sync ทั้ง current/live connected rows กับ `eligible_factories`
- `MEASUREMENT_POINTS` ใช้ patch เฉพาะ `pointName`, `monitoringPointStatus`, `details`, `documentsAndImages` และ `measurementInstruments`
- โรงงานที่อ่านหรือแก้ได้ต้องอยู่ใน effective data scope ของ permission ที่ endpoint ใช้ และหนึ่งโรงงานมี open request ได้สูงสุดหนึ่งรายการต่อ `formType`
- การ review ทุก decision จำกัดเฉพาะผู้ใช้ที่มีทั้ง `userType = "admin"`, role `admin` และ permission `factories:approve`
- ไม่อยู่ใน scope ของ capability นี้: การแก้ `pointCode`, `pointType`, `systemType`, `parameters`, device configuration, identity/audit fields, ตาราง `factories` และโค้ด frontend

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/poms-factories' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json'

curl --request GET \
  --url '<BASE_URL>/api/v1/poms-factories/factory-001' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json'

curl --request GET \
  --url '<BASE_URL>/api/v1/poms-factories/factory-001/form?formType=BASIC_INFO&systemType=CEMS' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json'

curl --request POST \
  --url '<BASE_URL>/api/v1/poms-factories/factory-001/edit-requests' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{"formType":"BASIC_INFO","factoryName":"บริษัท ตัวอย่าง จำกัด (มหาชน)","address":"99 หมู่ 1 ตำบลตัวอย่าง","latitude":14.315,"longitude":100.612,"eia":"มี","eiaOther":null,"projectName":"โครงการปรับปรุงระบบตรวจวัด","factoryFrontPhotos":[],"factoryLogo":null,"remarks":"ปรับชื่อและที่อยู่ให้ตรงกับเอกสารล่าสุด"}'

curl --request POST \
  --url '<BASE_URL>/api/v1/poms-factories/factory-001/edit-requests' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{"formType":"MEASUREMENT_POINTS","measurementPoints":[{"connectedPointId":15,"monitoringPointStatus":"อยู่ระหว่างเชื่อมต่อ"}],"remarks":"ปรับสถานะจุดตรวจวัด"}'

curl --request POST \
  --url '<BASE_URL>/api/v1/poms-factories/edit-requests/11/review' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{"decision":"APPROVE","revisionReason":null,"officerNote":"ตรวจสอบเอกสารแล้ว"}'
```

## Endpoint Summary

เมนูข้อมูลพื้นฐานมี `15` canonical endpoints และแสดงเป็น `19` Swagger operations เพราะ endpoint เดิมของจุดตรวจวัดมี annual path variants เพิ่ม `4` operations

| งาน                            | Method | Path                                                             | Permission                             | Contract                                                                                                                               |
| ------------------------------ | ------ | ---------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| รายชื่อโรงงาน current/live     | `GET`  | `/api/v1/poms-factories`                                         | `factories:view`                       | [List POMS factories](#get-apiv1poms-factories)                                                                                        |
| ข้อมูลโรงงานและจุดตรวจวัด      | `GET`  | `/api/v1/poms-factories/:factoryId`                              | `factories:view`                       | [POMS factory detail](#get-apiv1poms-factoriesfactoryid)                                                                               |
| อ่าน prefill ฟอร์มจาก POMS     | `GET`  | `/api/v1/poms-factories/:factoryId/form`                         | `factories:view`                       | [Factory form prefill](#get-apiv1poms-factoriesfactoryidform)                                                                          |
| ส่งคำขอแก้ไขข้อมูล             | `POST` | `/api/v1/poms-factories/:factoryId/edit-requests`                | `factories:view` + `factories:edit`    | [Create edit request](#post-apiv1poms-factoriesfactoryidedit-requests)                                                                 |
| รายการคำขอแก้ไข                | `GET`  | `/api/v1/poms-factories/edit-requests`                           | `factories:view`                       | [List edit requests](#get-apiv1poms-factoriesedit-requests)                                                                            |
| รายละเอียดคำขอแก้ไข            | `GET`  | `/api/v1/poms-factories/edit-requests/:id`                       | `factories:view`                       | [Edit-request detail](#get-apiv1poms-factoriesedit-requestsid)                                                                         |
| อ่าน prefill รอบแก้ไข        | `GET`  | `/api/v1/poms-factories/edit-requests/:id/form`                  | `factories:view`                       | [Edit-request form prefill](#get-apiv1poms-factoriesedit-requestsidform)                                                               |
| ส่งคำขอแก้ไขกลับเข้าพิจารณา    | `PUT`  | `/api/v1/poms-factories/edit-requests/:id/resubmission`          | `factories:view` + `factories:edit`    | [Resubmission](#put-apiv1poms-factoriesedit-requestsidresubmission)                                                                    |
| Admin พิจารณาคำขอ              | `POST` | `/api/v1/poms-factories/edit-requests/:id/review`                | `factories:view` + `factories:approve` | [Review](#post-apiv1poms-factoriesedit-requestsidreview)                                                                               |
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
| Approval scope       | `POST .../review` ต้องผ่านทั้ง `factories:view` และ `factories:approve`, ยึด scope ของ `factories:approve` และบังคับ `userType = admin` พร้อม role `admin`                |
| Object scope         | รายการถูกกรองตาม effective scope ของ endpoint; detail หรือ mutation ที่อ้างโรงงาน/คำขอนอก scope ตอบ `404 NOT_FOUND` เพื่อไม่เปิดเผยว่าข้อมูลมีอยู่                       |
| Separation of duties | ผู้พิจารณาต้องไม่ตรงกับทั้ง `createdBy` และ `submittedBy` ของคำขอ; กฎนี้ใช้กับ `APPROVE`, `REQUEST_REVISION` และ `REJECT`; ถ้าซ้ำตอบ `403 FORBIDDEN`                     |

## Contracts

### `GET /api/v1/poms-factories`

คืนโรงงาน current/live แบบไม่ซ้ำโรงงานด้วย response shape เดียวกับ `GET /api/v1/cems-wpms-requests/operator-factories` แต่ขอบเขตข้อมูลต่างกัน: endpoint นี้คืนเฉพาะโรงงานที่มี active `cems_wpms_connected_measurement_points` และอยู่ใน `factories:view` scope ของผู้เรียก

active `cems_wpms_connected_measurement_points` เป็น authoritative source สำหรับการเป็นสมาชิก POMS และ current/live profile ส่วน active `eligible_factories` ที่ผูกกับ connected row ใช้เฉพาะ metadata ด้าน identity, ประเภทกิจการ และพื้นที่ Endpoint นี้ไม่ hydrate response จาก connection-request snapshots และไม่ใช้ข้อมูล payload จากตาราง `factories`

#### Request Fields

| Field    | Location | Type   | Required | Rules                                                                              |
| -------- | -------- | ------ | -------- | ---------------------------------------------------------------------------------- |
| `search` | query    | string | no       | trim แล้ว 1–255 ตัวอักษร; ค้นจากรหัส/ชื่อ/เลขทะเบียนโรงงาน current/live, เลขทะเบียนใหม่/เก่าจาก eligible metadata หรือชื่อ/รหัสจุดตรวจวัด |

Minimal request JSON สำหรับ endpoint ที่ไม่มี body:

```json
{}
```

#### Success Response Fields

ชื่อ field, type และ nullability ของแต่ละ row ตรงกับ shared [`OperatorFactoryTableRow`](../connection-requests/README.md#operator-factory-list-source) โดย endpoint นี้ส่งเฉพาะ field ต่อไปนี้

| Field                                        | Type                                                        | Nullable | Source/Meaning                                                                                                         |
| -------------------------------------------- | ----------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `success`                                    | boolean                                                     | no       | คงที่เป็น `true`                                                                                                       |
| `data`                                       | object[]                                                    | no       | โรงงาน current/live ที่ผู้เรียกมองเห็น; ทุก row มี active connected point                                               |
| `data[].id`                                  | integer                                                     | yes      | active `eligible_factories.id`; schema กลางรองรับ `null` แต่ POMS row ปัจจุบันมีค่าเสมอ                                 |
| `data[].factoryId`                           | string                                                      | no       | stable factory identifier จาก current/live connected row                                                               |
| `data[].factoryName`                         | string                                                      | no       | ชื่อโรงงาน current/live จาก connected row ล่าสุด                                                                        |
| `data[].newRegistrationNo`                   | string                                                      | yes      | เลขทะเบียนใหม่จาก active eligible metadata ที่ผูกกับ connected row                                                      |
| `data[].oldRegistrationNo`                   | string                                                      | yes      | เลขทะเบียนเก่าจาก active eligible metadata                                                                              |
| `data[].industryType`                        | string                                                      | yes      | คำอธิบายประเภทกิจการจาก active eligible metadata; ใช้ค่าเดียวกับ `businessActivity` เพื่อคง shared display contract     |
| `data[].industryMainOrder`                   | string                                                      | yes      | ลำดับประเภทโรงงานหลักที่แยกจาก active `eligible_factories.factory_type_sequence`                                        |
| `data[].industrySubOrder`                    | string                                                      | yes      | ลำดับประเภทย่อยที่แยกจาก active `eligible_factories.factory_type_sequence`                                              |
| `data[].businessActivity`                    | string                                                      | yes      | การประกอบกิจการจาก active eligible metadata                                                                             |
| `data[].eia`                                 | `มี` \| `ไม่มี` \| `มี IEE` \| `มี EIA` \| `มี EHIA` \| `อื่นๆ` | yes      | ค่า EIA current/live จาก connected row ล่าสุด                                                                           |
| `data[].projectName`                         | string                                                      | yes      | ชื่อโครงการ current/live จาก connected row ล่าสุด                                                                       |
| `data[].address`                             | string                                                      | yes      | ที่อยู่ current/live จาก connected row ล่าสุด                                                                            |
| `data[].latitude`, `data[].longitude`         | string                                                      | yes      | พิกัด current/live ในรูป string ตาม shared operator-factory contract                                                     |
| `data[].province`                            | string                                                      | yes      | จังหวัดจาก active eligible metadata ที่ผูกกับ connected row                                                              |
| `data[].officerNotificationEmails`           | string[]                                                    | no       | คงที่เป็น `[]` เพราะ POMS source ไม่เก็บ field นี้                                                                       |
| `data[].isEligible`                          | boolean                                                     | no       | คงที่เป็น `true` เพราะรายการ POMS ต้องจับคู่ active eligible row                                                         |
| `data[].eligibilityStatus`                   | `เข้าข่าย` \| `ไม่เข้าข่าย`                                | no       | คงที่เป็น `เข้าข่าย`                                                                                                    |
| `data[].eligibilityRequest`                  | object                                                      | yes      | คงที่เป็น `null`; endpoint นี้ไม่อ่าน workflow คำขอเพิ่มโรงงาน                                                          |
| `data[].canRequestEligibility`               | boolean                                                     | no       | คงที่เป็น `false`                                                                                                       |
| `data[].monitoringPointCount`                | integer                                                     | no       | จำนวน active connected points ของโรงงาน                                                                                 |
| `data[].requestStatusCode`                   | `CONNECTED`                                                 | no       | derive จากการมี active connected point; ไม่อ่านสถานะจาก connection-request snapshot                                     |
| `data[].status`                              | `แสดง` \| `ซ่อน`                                          | no       | คงที่เป็น `แสดง`                                                                                                        |
| `meta.total`                                 | integer                                                     | no       | จำนวนโรงงานใน `data`                                                                                                    |

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": [
    {
      "id": 7,
      "factoryId": "factory-001",
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "newRegistrationNo": "10120000325542",
      "oldRegistrationNo": "3-106-33/50สบ",
      "industryType": "ผลิตผลิตภัณฑ์ตัวอย่าง",
      "industryMainOrder": "00343",
      "industrySubOrder": "00003",
      "businessActivity": "ผลิตผลิตภัณฑ์ตัวอย่าง",
      "eia": "มี",
      "projectName": "โครงการระบบตรวจวัด",
      "address": "99 หมู่ 1",
      "latitude": "14.315",
      "longitude": "100.612",
      "province": "สระบุรี",
      "officerNotificationEmails": [],
      "isEligible": true,
      "eligibilityStatus": "เข้าข่าย",
      "eligibilityRequest": null,
      "canRequestEligibility": false,
      "monitoringPointCount": 2,
      "requestStatusCode": "CONNECTED",
      "status": "แสดง"
    }
  ],
  "meta": { "total": 1 }
}
```

### `GET /api/v1/poms-factories/:factoryId`

คืน profile current/live พร้อม `measurementPoints` สำหรับแสดงผลและใช้เป็นฐานของฟอร์ม `MEASUREMENT_POINTS`

#### Request Fields

| Field       | Location | Type   | Required | Rules                                                                                |
| ----------- | -------- | ------ | -------- | ------------------------------------------------------------------------------------ |
| `factoryId` | path     | string | yes      | trim แล้ว 1–64 ตัวอักษร; รับ current `factoryId` หรือเลขทะเบียนโรงงานที่ resolve ได้ |

Minimal request JSON:

```json
{}
```

#### Success Response Fields

Detail endpoint นี้คง `PomsFactoryDetail` shape เดิมและไม่เปลี่ยนตาม shared operator-factory row ของ list endpoint

| Field                                               | Type                               | Nullable | Description                                            |
| --------------------------------------------------- | ---------------------------------- | -------- | ------------------------------------------------------ |
| `success`                                           | boolean                            | no       | `true`                                                 |
| `data`                                              | object                             | no       | profile current/live และจุดตรวจวัดของโรงงาน           |
| `data.eligibleFactoryId`                            | number                             | no       | active `eligible_factories.id`                         |
| `data.factoryId`                                    | string                             | no       | stable factory identifier                              |
| `data.factoryRegistrationNo`                        | string                             | no       | เลขทะเบียนโรงงานรูปแบบเดิมของ detail contract         |
| `data.factoryName`                                  | string                             | no       | ชื่อโรงงาน current/live                                |
| `data.factoryAddress`                               | string                             | yes      | ที่อยู่โรงงาน current/live                             |
| `data.provinceName`, `data.industrialEstateName`    | string                             | yes      | ชื่อจังหวัดและนิคมอุตสาหกรรม                           |
| `data.latitude`, `data.longitude`                    | number                             | yes      | พิกัดในรูป number ตาม detail contract เดิม             |
| `data.eia`, `data.eiaOther`, `data.projectName`     | string                             | yes      | ข้อมูล EIA และชื่อโครงการ current/live                 |
| `data.factoryFrontPhotos`                           | object[]                           | no       | เอกสาร/ภาพด้านหน้าโรงงาน                               |
| `data.factoryLogo`                                  | object                             | yes      | โลโก้โรงงาน                                            |
| `data.systemTypes`                                  | (`CEMS` \| `WPMS`)[]               | no       | ระบบที่มี active point เรียงและไม่ซ้ำ                  |
| `data.measurementPointCount`                        | number                             | no       | จำนวน active connected points                          |
| `data.pendingEditRequestCount`                      | number                             | no       | จำนวน open edit requests ของโรงงานทุก `formType`       |
| `data.updatedAt`                                    | ISO 8601 string                    | no       | เวลาแก้ไขล่าสุดของ active point ที่นำมาสรุป            |
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
        "monitoringPointStatus": "เชื่อมต่อครบแล้ว",
        "details": null,
        "documentsAndImages": [],
        "measurementInstruments": null,
        "updatedAt": "2026-08-24T02:00:00.000Z"
      }
    ]
  }
}
```

### `GET /api/v1/poms-factories/:factoryId/form`

คืน prefill จาก current/live POMS เท่านั้น โดยใช้ชื่อและ shape ของ `data` ตรงกับ [Connection-request form prefill](../connection-requests/README.md#connection-request-form-prefill) ไม่คืน wrapper `formDefaults`, workflow metadata, `factoryAddress`, `systemTypes`, `connectedPointId` หรือ `sourceMeasurementPointId`

ข้อมูลระดับโรงงานและจุดตรวจวัดยึด active `cems_wpms_connected_measurement_points`; endpoint นี้ไม่ hydrate จากคำขอเชื่อมต่อเดิม ดังนั้น field ที่ POMS ไม่เก็บจะเป็น `null`, `[]` หรือ empty string ตาม type ของ shared contract

#### Request Fields

| Field        | Location | Type                              | Required    | Rules |
| ------------ | -------- | --------------------------------- | ----------- | ----- |
| `factoryId`  | path     | string                            | yes         | current `factoryId` หรือเลขทะเบียนที่ resolve ได้ |
| `formType`   | query    | `BASIC_INFO` \| `MEASUREMENT_POINTS` | no          | ระบุบริบทฟอร์ม; ไม่เพิ่ม field ใน response |
| `systemType` | query    | `CEMS` \| `WPMS`                 | conditional | optional เมื่อมีระบบเดียว; บังคับเมื่อโรงงานมีทั้ง CEMS และ WPMS |

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/poms-factories/factory-001/form?formType=BASIC_INFO&systemType=CEMS' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json'
```

#### POMS Source And Nullability

| Form field | Current/live source | Fallback เมื่อ POMS ไม่เก็บ |
| ---------- | ------------------- | ---------------------------- |
| `requestType` | compatibility field ของ shared form contract | คงที่เป็น `NEW_CONNECTION`; ไม่ใช่สถานะหรือประเภทคำขอแก้ไข POMS |
| `factoryId`, `factoryName`, `factoryRegistrationNo`, `address`, EIA/project, ชื่อพื้นที่, พิกัดโรงงาน | current/live factory profile | `null` สำหรับ field nullable |
| `measurementPoints[]` | active points ของ `systemType` ที่เลือก | ถ้าไม่มี active point ตอบ `404` และไม่เปิดฟอร์ม |
| กลุ่มอุตสาหกรรม, รหัสพื้นที่, พิกัด/คำอธิบายเฉพาะจุด, ผู้ให้ข้อมูล | POMS ไม่เก็บ | `null` |
| `contactName`, `contactPhone` | POMS ไม่เก็บ | `""` |
| `contactPersons`, `notificationEmails`, `officerNotificationEmails` | POMS ไม่เก็บ | omit `contactPersons`; email arrays เป็น `[]` |
| `remarks` | ไม่มีคำขอแก้ไขใน endpoint นี้ | `null` |

`factoryFrontPhotos` และ `factoryLogo` ไม่เป็น top-level field ใน shared form contract; metadata ที่มีจะรวมใน `measurementPoints[0].documentsAndImages`

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "requestType": "NEW_CONNECTION",
    "factoryId": "factory-001",
    "factoryName": "บริษัท ตัวอย่าง จำกัด",
    "factoryRegistrationNo": "3-106-33/50สบ",
    "address": "99 หมู่ 1",
    "systemType": "CEMS",
    "contactName": "",
    "contactPhone": "",
    "notificationEmails": [],
    "officerNotificationEmails": [],
    "measurementPoints": [
      {
        "pointName": "ปล่อง A",
        "pointCode": "S2001",
        "pointType": "STACK",
        "parameters": ["CO (ppm)"],
        "documentsAndImages": [],
        "measurementInstruments": null
      }
    ],
    "remarks": null
  }
}
```

### Shared Basic-info Fields

เมื่อ body ไม่ส่ง `formType` backend จะตีความเป็นฟอร์ม `BASIC_INFO`; client ใหม่ควรส่ง `formType = "BASIC_INFO"` ให้ชัดเจน และใช้ profile allowlist ต่อไปนี้

| Field                | Type           | Required | Rules                                                                                               |
| -------------------- | -------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `formType`           | string         | no       | ถ้าส่งต้องเป็น `BASIC_INFO`; omission รองรับ client เดิม                                           |
| `factoryName`        | string         | yes      | trim แล้ว 1–500 ตัวอักษร                                                                            |
| `address`            | string \| null | no       | canonical field; omission = คงค่าเดิม; `null` = ล้างค่า; string trim แล้วไม่เกิน 1000 ตัวอักษร       |
| `factoryAddress`     | string \| null | no       | legacy alias ของ `address`; หากส่งทั้งคู่ค่าต้องตรงกัน                                                |
| `latitude`           | number \| null | no       | ช่วง `-90` ถึง `90`; ต้องส่งพร้อม `longitude` รวมถึงกรณีส่ง `null` เพื่อล้างพิกัด                   |
| `longitude`          | number \| null | no       | ช่วง `-180` ถึง `180`; ต้องส่งพร้อม `latitude`                                                      |
| `eia`                | string \| null | no       | omission = คงค่าเดิม; `null` = ล้างค่า; enum: `มี`, `ไม่มี`, `มี IEE`, `มี EIA`, `มี EHIA`, `อื่นๆ` |
| `eiaOther`           | string \| null | no       | ต้องมีข้อความเมื่อส่ง `eia = "อื่นๆ"`; ห้ามส่งค่า non-null ในกรณีอื่น; ไม่เกิน 500 ตัวอักษร         |
| `projectName`        | string \| null | no       | omission = คงค่าเดิม; `null` = ล้างค่า; string ไม่เกิน 500 ตัวอักษร                                 |
| `factoryFrontPhotos` | object[]       | no       | omission = คงค่าเดิม; `[]` = ล้างทั้งหมด; มากสุด 10 รายการ                                          |
| `factoryLogo`        | object \| null | no       | omission = คงค่าเดิม; `null` = ล้างโลโก้                                                            |
| `remarks`            | string \| null | no       | canonical field ของหมายเหตุผู้ส่ง; ไม่เกิน 1000 ตัวอักษร                                            |
| `note`               | string \| null | no       | legacy alias ของ `remarks`; หากส่งทั้งคู่ค่าต้องตรงกัน                                                |

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

field ที่ห้ามส่ง ได้แก่ `eligibleFactoryId`, `factoryId`, `factoryRegistrationNo`, จังหวัด/ภูมิภาค/นิคม, กลุ่มอุตสาหกรรม และสถานะ/audit เนื่องจาก schema เป็น strict object จึงตอบ `400 VALIDATION_ERROR` เมื่อมี field นอก allowlist

### Measurement-point Fields

เมื่อ body ส่ง `formType = "MEASUREMENT_POINTS"` backend จะใช้ payload สำหรับแก้ไขข้อมูลจุดตรวจวัด current/live ของโรงงานนั้นโดยอิง `connectedPointId`

| Field                                        | Type             | Required | Rules                                                                                  |
| -------------------------------------------- | ---------------- | -------- | -------------------------------------------------------------------------------------- |
| `formType`                                   | string           | yes      | ต้องเป็น `MEASUREMENT_POINTS`                                                         |
| `measurementPoints`                          | object[]         | yes      | อย่างน้อย 1 รายการ และ `connectedPointId` ต้องไม่ซ้ำภายในคำขอ                         |
| `measurementPoints[].connectedPointId`       | number           | yes      | active `cems_wpms_connected_measurement_points.id` ของโรงงานเดียวกับ path `factoryId` |
| `measurementPoints[].pointName`              | string           | no       | trim แล้ว 1–255 ตัวอักษร; omission = คงค่าเดิม                                        |
| `measurementPoints[].monitoringPointStatus`  | string \| null   | no       | omission = คงค่าเดิม; `null` = ล้างค่า; ใช้ enum สถานะจุดตรวจวัดกลาง                 |
| `measurementPoints[].details`                | object \| null   | no       | omission = คงค่าเดิม; `null` = ล้างค่า                                                |
| `measurementPoints[].documentsAndImages`     | object[]         | no       | omission = คงค่าเดิม; `[]` = ล้างทั้งหมด                                              |
| `measurementPoints[].measurementInstruments` | object \| null   | no       | omission = คงค่าเดิม; `null` = ล้างค่า                                                |
| `remarks`                                    | string \| null   | no       | canonical field ของหมายเหตุผู้ส่ง; ไม่เกิน 1000 ตัวอักษร                                  |
| `note`                                       | string \| null   | no       | legacy alias ของ `remarks`; หากส่งทั้งคู่ค่าต้องตรงกัน                                                |

แต่ละ `measurementPoints[]` ต้องส่งอย่างน้อยหนึ่ง field ที่แก้ได้ นอกเหนือจาก `connectedPointId` ค่า `monitoringPointStatus` ที่รับคือ `เชื่อมต่อครบแล้ว`, `ได้รับการยกเว้นทั้งหมด`, `เชื่อมต่อแล้วแต่ยังไม่ครบ`, `อยู่ระหว่างขยายเวลา`, `ยังไม่ได้ดำเนินการเชื่อมต่อ`, `อยู่ระหว่างการตรวจสอบของจังหวัด` หรือ `อยู่ระหว่างเชื่อมต่อ`

field ที่ห้ามส่งในฟอร์มนี้ ได้แก่ `pointCode`, `pointType`, `systemType`, `parameters`, `sourceMeasurementPointId`, `eligibleFactoryId`, `factoryId`, `factoryName`, `updatedAt`, device configuration และ field identity/audit อื่น ๆ เพราะ approval จะอัปเดตเฉพาะข้อมูลจุด current/live ที่ผู้ใช้แก้ได้จริง

### `POST /api/v1/poms-factories/:factoryId/edit-requests`

สร้างคำขอ `PENDING_REVIEW` โดยเก็บ snapshot ตาม `formType` หนึ่งโรงงานมี open request ได้ครั้งละหนึ่งรายการต่อ `formType` response ใช้ field contract เดียวกับ [edit-request detail](#get-apiv1poms-factoriesedit-requestsid)

#### Request Fields

ใช้ `factoryId` path ตาม detail endpoint และ body ตาม [Shared Basic-info Fields](#shared-basic-info-fields) หรือ [Measurement-point Fields](#measurement-point-fields)

Minimal request:

```json
{
  "formType": "BASIC_INFO",
  "factoryName": "บริษัท ตัวอย่าง จำกัด (มหาชน)",
  "address": "99 หมู่ 1 ตำบลตัวอย่าง",
  "latitude": 14.315,
  "longitude": 100.612,
  "eia": "มี",
  "eiaOther": null,
  "projectName": "โครงการปรับปรุงระบบตรวจวัด",
  "factoryFrontPhotos": [],
  "factoryLogo": null,
  "remarks": "ปรับข้อมูลตามหนังสือรับรองล่าสุด"
}
```

Minimal request สำหรับฟอร์มจุดตรวจวัด:

```json
{
  "formType": "MEASUREMENT_POINTS",
  "measurementPoints": [
    {
      "connectedPointId": 15,
      "monitoringPointStatus": "อยู่ระหว่างเชื่อมต่อ",
      "documentsAndImages": []
    }
  ],
  "remarks": "ปรับสถานะและล้างรายการเอกสารของจุดตรวจวัด"
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
    "formType": "BASIC_INFO",
    "status": "PENDING_REVIEW",
    "statusLabel": "รอพิจารณา",
    "requestNote": "ปรับข้อมูลตามหนังสือรับรองล่าสุด",
    "revisionReason": null,
    "officerNote": null,
    "currentMeasurementPoints": null,
    "proposedMeasurementPoints": null,
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
      "formType": "BASIC_INFO",
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
| `data.formType`              | `BASIC_INFO` \| `MEASUREMENT_POINTS`                                  | no       | ประเภทแบบฟอร์มของคำขอ                                                           |
| `data.revisionNo`            | number                                                                | no       | รอบแก้ไข เริ่มที่ `0` และเพิ่มเมื่อ resubmit                                     |
| `data.isOpen`                | boolean                                                               | no       | `true` สำหรับสถานะที่ workflow ยังไม่สิ้นสุด                                     |
| `data.status`                | string                                                                | no       | workflow status code                                                             |
| `data.statusLabel`           | string                                                                | no       | label สำหรับแสดงผล                                                               |
| `data.requestNote`           | string                                                                | yes      | หมายเหตุผู้ส่ง                                                                   |
| `data.revisionReason`        | string                                                                | yes      | เหตุผลที่เจ้าหน้าที่ขอแก้ไข                                                      |
| `data.officerNote`           | string                                                                | yes      | หมายเหตุการพิจารณา                                                               |
| `data.currentFactory`        | object                                                                | no       | snapshot ก่อนส่งคำขอรอบล่าสุด                                                    |
| `data.proposedFactory`       | object                                                                | no       | snapshot ที่เสนอแก้ไขรอบล่าสุด                                                   |
| `data.currentMeasurementPoints`  | object[]                                                           | yes      | snapshot จุดตรวจวัดก่อนแก้; เป็น `null` สำหรับ `BASIC_INFO`                     |
| `data.proposedMeasurementPoints` | object[]                                                           | yes      | snapshot จุดตรวจวัดที่เสนอ; เป็น `null` สำหรับ `BASIC_INFO`                     |
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
    "formType": "BASIC_INFO",
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
    "currentMeasurementPoints": null,
    "proposedMeasurementPoints": null,
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

### `GET /api/v1/poms-factories/edit-requests/:id/form`

คืน `data` ด้วย shared form contract เดียวกับ [Connection-request form prefill](../connection-requests/README.md#connection-request-form-prefill) แต่ overlay proposed values ของคำขอแก้ไขบน current/live POMS: `BASIC_INFO` ใช้ proposed factory profile, `MEASUREMENT_POINTS` ใช้ proposed measurement points และทั้งสองแบบใช้ `requestNote` เป็น `remarks`

ไม่ hydrate field ที่ขาดจากคำขอเชื่อมต่อเดิม และไม่คืน `id`, `requestNo`, `status`, `revisionReason` หรือ audit metadata ใน `data`; field ที่ POMS ไม่เก็บใช้ null/empty semantics ตาม [POMS Source And Nullability](#poms-source-and-nullability)

#### Request Fields

| Field        | Location | Type              | Required    | Rules |
| ------------ | -------- | ----------------- | ----------- | ----- |
| `id`         | path     | positive integer  | yes         | edit-request ID ที่อยู่ใน `factories:view` scope |
| `systemType` | query    | `CEMS` \| `WPMS` | conditional | optional เมื่อ proposed/current points มีระบบเดียว; บังคับเมื่อมีทั้ง CEMS และ WPMS |

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/poms-factories/edit-requests/11/form?systemType=CEMS' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json'
```

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "requestType": "NEW_CONNECTION",
    "factoryId": "factory-001",
    "factoryName": "บริษัท ตัวอย่าง จำกัด (แก้ไข)",
    "factoryRegistrationNo": "3-106-33/50สบ",
    "address": "100 หมู่ 2",
    "systemType": "CEMS",
    "contactName": "",
    "contactPhone": "",
    "notificationEmails": [],
    "officerNotificationEmails": [],
    "measurementPoints": [
      {
        "pointName": "ปล่อง A",
        "pointCode": "S2001",
        "pointType": "STACK",
        "parameters": ["CO (ppm)"],
        "documentsAndImages": [],
        "measurementInstruments": null
      }
    ],
    "remarks": "แก้ไขตามข้อสังเกตแล้ว"
  }
}
```

### `PUT /api/v1/poms-factories/edit-requests/:id/resubmission`

ใช้ได้เมื่อสถานะเป็น `REVISION_REQUESTED` เท่านั้น backend โหลดข้อมูล current/live ล่าสุดเป็น snapshot ใหม่ แทนที่ proposed data จาก body แล้วเปลี่ยนสถานะเป็น `REVISED_PENDING_REVIEW`; `formType` ต้องตรงกับคำขอเดิม

#### Request Fields

ใช้ `id` path ตาม detail endpoint และ body ตาม [Shared Basic-info Fields](#shared-basic-info-fields) หรือ [Measurement-point Fields](#measurement-point-fields) ให้ตรงกับ `formType` เดิม

Minimal request:

```json
{
  "formType": "BASIC_INFO",
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
  "remarks": "แก้ไขตามข้อสังเกตแล้ว"
}
```

Minimal request สำหรับส่งฟอร์มจุดตรวจวัดกลับเข้าพิจารณา:

```json
{
  "formType": "MEASUREMENT_POINTS",
  "measurementPoints": [
    {
      "connectedPointId": 15,
      "pointName": "ปล่อง A (แก้ไขตามข้อสังเกต)"
    }
  ],
  "remarks": "แก้ไขตามข้อสังเกตแล้ว"
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

admin พิจารณาคำขอที่อยู่ใน `PENDING_REVIEW` หรือ `REVISED_PENDING_REVIEW` และอยู่ใน data scope ของ `factories:approve` ผู้พิจารณาต้องไม่ใช่ทั้งผู้สร้างคำขอครั้งแรก (`createdBy`) และผู้ส่งรอบล่าสุด (`submittedBy`) แม้จะเป็นคนละคนกัน

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
| `APPROVED`               | `อนุมัติแล้ว`         | `false`  | อัปเดต current/live ตาม `formType` สำเร็จ |
| `REJECTED`               | `ไม่อนุมัติ`          | `false`  | ปิดคำขอโดยไม่เปลี่ยนข้อมูลจริง     |

State transitions:

| Current status                                 | Who                    | Operation/decision | Next status              | Effect                                                |
| ---------------------------------------------- | ---------------------- | ------------------ | ------------------------ | ----------------------------------------------------- |
| none                                           | ผู้มี `factories:edit` | create             | `PENDING_REVIEW`         | เก็บ current/proposed snapshot ตาม `formType` และเปิดคำขอ     |
| `PENDING_REVIEW`                               | admin                  | `REQUEST_REVISION` | `REVISION_REQUESTED`     | บันทึก `revisionReason`; ยังไม่แก้ข้อมูลจริง                 |
| `REVISION_REQUESTED`                           | ผู้มี `factories:edit` | resubmission       | `REVISED_PENDING_REVIEW` | refresh current snapshot และส่ง proposed payload เดิมอีกครั้ง |
| `PENDING_REVIEW` หรือ `REVISED_PENDING_REVIEW` | admin                  | `APPROVE`          | `APPROVED`               | sync ข้อมูลจริงแบบ atomic ตาม `formType`                    |
| `PENDING_REVIEW` หรือ `REVISED_PENDING_REVIEW` | admin                  | `REJECT`           | `REJECTED`               | ปิดคำขอโดยไม่แก้ข้อมูลจริง                                   |

Approval target mapping:

| API profile field                   | active `cems_wpms_connected_measurement_points`                                           | active `eligible_factories`                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `factoryName`                       | `factory_name` ทุก active point                                                           | `factory_name`                                   |
| `address` (legacy `factoryAddress`) | `factory_address` ทุก active point                                                        | `address`                                        |
| `latitude`, `longitude`             | `factory_latitude`, `factory_longitude` ทุก active point                                  | `latitude`, `longitude`                          |
| `eia`, `eiaOther`                   | `factory_eia_assessment`, `factory_eia_other`, derived `factory_has_eia` ทุก active point | `eia_assessment`, `eia_other`, derived `has_eia` |
| `projectName`                       | `factory_project_name` ทุก active point                                                   | `project_name`                                   |
| `factoryFrontPhotos`, `factoryLogo` | `factory_front_photos_json`, `factory_logo_json` ทุก active point                         | ไม่มี target field และไม่อัปเดต                  |

- หนึ่งโรงงานมี open request ได้หนึ่งรายการต่อ `formType` โดย open status คือ `PENDING_REVIEW`, `REVISION_REQUESTED` หรือ `REVISED_PENDING_REVIEW`
- create/resubmission/review ไม่รับ `Idempotency-Key`; การเรียกซ้ำหลัง transition สำเร็จจะตอบ `409 CONFLICT` แทนการทำซ้ำ
- การอนุมัติ lock คำขอและข้อมูล current/live ที่เกี่ยวข้องใน transaction เดียวกัน และตรวจ source version จากตอนส่ง/ส่งกลับ หากข้อมูลจริงถูกเปลี่ยนระหว่างรอพิจารณาให้ตอบ `409 CONFLICT` โดยไม่มี partial update
- approval ทำ target updates ตาม `formType` แบบ atomic; ตาราง `factories` ไม่ใช่เป้าหมายของ workflow นี้
- เมื่อ `formType = "MEASUREMENT_POINTS"` backend อัปเดตเฉพาะ active `cems_wpms_connected_measurement_points` ของโรงงานนั้น ได้แก่ `point_name`, `monitoring_point_status`, `details_json`, `documents_json` และ `instruments_json`

## Errors

ทุก endpoint ใช้ [shared success/error envelope](../../shared/common-api/README.md#shared-response-shape)

| HTTP status | `error.code`       | Condition                                                                                                                                  | Client action                                   |
| ----------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `400`       | `VALIDATION_ERROR` | path/query/body ไม่ตรง strict schema, พิกัดไม่ส่งเป็นคู่, `eiaOther` ผิดเงื่อนไข หรือมี field นอก allowlist                                | แสดง validation ตาม `error.issues[].pathString` |
| `401`       | `UNAUTHORIZED`     | token ไม่มี/หมดอายุ/ไม่ถูกต้อง                                                                                                             | login ใหม่                                      |
| `403`       | `FORBIDDEN`        | ไม่มี action permission, reviewer ไม่ใช่ admin หรือ user ผู้พิจารณาซ้ำกับ `createdBy` หรือ `submittedBy` ของคำขอ                              | ซ่อน action หรือให้ admin คนอื่นพิจารณา         |
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
| Migrations             | [`0100_create_poms_factory_edit_requests.ts`](../../../../../backend/src/db/migrations/0100_create_poms_factory_edit_requests.ts), [`0106_extend_poms_factory_edit_requests_for_measurement_points.ts`](../../../../../backend/src/db/migrations/0106_extend_poms_factory_edit_requests_for_measurement_points.ts), [`0107_enforce_admin_only_factory_approval.ts`](../../../../../backend/src/db/migrations/0107_enforce_admin_only_factory_approval.ts) |
| Tests                  | [`poms-factories.route.test.ts`](../../../../../backend/tests/unit/poms-factories.route.test.ts), [`poms-factories.service.test.ts`](../../../../../backend/tests/unit/poms-factories.service.test.ts), [`poms-factories.repository.test.ts`](../../../../../backend/tests/unit/poms-factories.repository.test.ts), [`poms-measurement-point-edit-requests.validator.test.ts`](../../../../../backend/tests/unit/poms-measurement-point-edit-requests.validator.test.ts), [`poms-measurement-point-edit-requests.migration.test.ts`](../../../../../backend/tests/unit/poms-measurement-point-edit-requests.migration.test.ts), [`factory-approval-admin-only-migration.test.ts`](../../../../../backend/tests/unit/factory-approval-admin-only-migration.test.ts), [`poms-factories.openapi.test.ts`](../../../../../backend/tests/unit/poms-factories.openapi.test.ts) |

Breaking change ด้านสิทธิ์ review ถูกบันทึกใน [API changelog](../../CHANGELOG.md#2026-09-01--เพิ่ม-2-แบบฟอร์มคำขอแก้ไขข้อมูลพื้นฐานจาก-poms-และจำกัดผู้อนุมัติเป็น-admin)
