# โรงงานและคำขอแก้ไขข้อมูลในระบบ POMS

> Owner: Backend

## Frontend Quick Start

คู่มือสำหรับทีม frontend: [แบบฟอร์มแก้ไขข้อมูลทั่วไปของโรงงาน](../../../guides/frontend-handoffs/factory-basic-info/README.md) — จุดที่ต้องปรับ ตัวอย่าง payload และรายการตรวจรับ

เมนูนี้ใช้ข้อมูลโรงงาน current/live จาก active rows ใน `cems_wpms_connected_measurement_points` เพื่อแสดงรายชื่อโรงงานและจุดตรวจวัดในระบบ POMS ผู้ประกอบการส่งคำขอแก้ไขได้ 2 แบบฟอร์มคือ `BASIC_INFO` และ `MEASUREMENT_POINTS` แต่ข้อมูลจริงจะยังไม่เปลี่ยนจนกว่า admin จะพิจารณาอนุมัติ

การอ่านข้อมูลและการกำหนดขอบเขตโรงงานใช้ `factories:view` การอัปโหลดเอกสารใช้ `factories:edit` ส่วนการส่ง ส่งกลับ หรือยกเลิกคำขอใช้ทั้ง `factories:view` และ `factories:edit` แต่การคัด resource สำหรับ mutation จะยึด data scope ของ `factories:edit` และการพิจารณาใช้ทั้ง `factories:view` และ `factories:approve` โดยยึด data scope ของ `factories:approve` พร้อมบังคับว่า reviewer ต้องมี role `admin` ทุก endpoint ต้องใช้ Bearer token

### Main Flow

1. เรียก `GET /api/v1/poms-factories` เพื่อแสดงโรงงาน current/live ที่อยู่ใน data scope ของผู้ใช้
2. เรียก `GET /api/v1/poms-factories/:factoryId/form` เพื่อลง current/live values ด้วยชื่อและ shape เดียวกับ `GET /api/v1/cems-wpms-requests/:id/form`
3. ถ้ามีไฟล์ ผู้ประกอบการอัปโหลดทีละไฟล์ด้วย `POST /api/v1/poms-factories/document-images` แล้วนำ `RequestDocumentImage` metadata ที่ได้ไปใส่ใน `factoryFrontPhotos`, `factoryLogo` หรือ document field ที่รองรับ
4. ผู้ประกอบการส่งคำขอแก้ไขด้วย `POST /api/v1/poms-factories/:factoryId/edit-requests` โดยเลือก `formType` เป็น `BASIC_INFO` หรือ `MEASUREMENT_POINTS`
5. admin อ่านรายการและรายละเอียดคำขอ แล้วเลือก `APPROVE`, `REQUEST_REVISION` หรือ `REJECT`
6. ถ้าขอให้แก้ไข ผู้ประกอบการเรียก `GET /api/v1/poms-factories/edit-requests/:id/form` เพื่อลง proposed values แล้วส่งกลับด้วย `PUT /api/v1/poms-factories/edit-requests/:id/resubmission`
7. ผู้สร้างคำขอเดิม (`createdBy`) ยกเลิกคำขอที่ยังเปิดอยู่ได้ด้วย `POST /api/v1/poms-factories/edit-requests/:id/cancel`
8. เมื่ออนุมัติ backend อัปเดต current/live POMS data ตาม `formType`: `BASIC_INFO` sync active `cems_wpms_connected_measurement_points` และ active `eligible_factories`, ส่วน `MEASUREMENT_POINTS` sync จุดตรวจวัดและข้อมูลทั่วไปของโรงงานที่มีการแก้ไข โดยข้อมูลทั่วไป sync เป้าหมายเดียวกับ `BASIC_INFO` โดยไม่อัปเดตตาราง `factories`

### Capability Boundary

- `BASIC_INFO` แก้ได้เฉพาะการประเมินผลกระทบสิ่งแวดล้อม (`eia`), ชื่อโครงการ (`projectName`), อื่นๆ ของ EIA (`eiaOther`), ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน (`factoryFrontPhotos`), สัญลักษณ์ของโรงงานหรือโลโก้บริษัท (`factoryLogo`), ละติจูด (`latitude`) และลองติจูด (`longitude`); เมื่ออนุมัติจะ sync ตาม target mapping โดยคงชื่อและที่อยู่โรงงานเดิม
- `MEASUREMENT_POINTS` ใช้ patch `pointName`, `monitoringPointStatus`, `details`, `documentsAndImages` และ `measurementInstruments` พร้อมข้อมูลทั่วไปของโรงงาน 7 fields เดียวกับ `BASIC_INFO` ได้ในคำขอเดียวกัน
- binary upload รับครั้งละหนึ่งไฟล์และคืน metadata เท่านั้น การผูกไฟล์กับคำขอเกิดเมื่อ client ส่ง metadata นั้นใน create/resubmission payload
- เฉพาะ `createdBy` ยกเลิกคำขอของตนเองได้ และยกเลิกได้เมื่อสถานะเป็น `PENDING_REVIEW`, `REVISION_REQUESTED` หรือ `REVISED_PENDING_REVIEW`
- โรงงานที่อ่านหรือแก้ได้ต้องอยู่ใน effective data scope ของ permission ที่ endpoint ใช้ และหนึ่งโรงงานมี open request ได้สูงสุดหนึ่งรายการต่อ `formType`
- การ review ทุก decision จำกัดเฉพาะผู้ใช้ที่มีทั้ง `userType = "admin"`, role `admin` และ permission `factories:approve`
- ไม่อยู่ใน scope ของ capability นี้: การแก้ `pointCode`, `pointType`, `systemType`, `parameters`, device configuration, identity/audit fields, ตาราง `factories` และโค้ด frontend

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/poms-factories' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json'

curl --request POST \
  --url '<BASE_URL>/api/v1/poms-factories/document-images' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --form 'file=@./factory-front.jpg;type=image/jpeg' \
  --form 'title=ภาพถ่ายหน้าโรงงาน'

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
  --data '{"formType":"BASIC_INFO","latitude":14.315,"longitude":100.612,"eia":"มี","eiaOther":null,"projectName":"โครงการปรับปรุงระบบตรวจวัด","factoryFrontPhotos":[],"factoryLogo":null}'

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

curl --request POST \
  --url '<BASE_URL>/api/v1/poms-factories/edit-requests/11/cancel' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json'
```

### Request Number Contract

| `formType` | งาน | รูปแบบเลขที่คำขอใหม่ | ตัวอย่าง |
| --- | --- | --- | --- |
| `BASIC_INFO` | แก้ไขข้อมูลพื้นฐาน | `base-NNNNN/YYYY` | `base-00001/2569` |
| `MEASUREMENT_POINTS` | แก้ไขจุดตรวจวัด | `point-NNNNN/YYYY` | `point-00001/2569` |

- `NNNNN` เป็นลำดับ 5 หลัก เริ่ม `00001` แยกตามประเภทแบบฟอร์มและปี พ.ศ. (`YYYY`) โดยใช้เขตเวลา `Asia/Bangkok`; เป็นลำดับรวมทุกโรงงานของประเภทนั้น
- backend จัดสรรเลขและบันทึกคำขอใน transaction เดียวกัน พร้อม lock ช่วงเลขเพื่อป้องกันคำขอพร้อมกันได้เลขซ้ำ; เลขของคำขอที่ปิด ยกเลิก หรือลบแบบ soft delete ยังถูกสงวนไว้ เมื่อครบ `99999` ตอบ `409 CONFLICT`
- การ resubmit, review และ cancel คงเลขเดิม; คำขอเก่าที่เป็น `PFE-*` ยังใช้เลขเดิม ไม่มีการ backfill หรือ database migration
- client ต้องถือ `requestNo` เป็น opaque string สำหรับแสดงผลและค้นหา ใช้ `id` อ้างอิงใน URL และไม่แยกข้อมูลจาก prefix หรือ `/`

## Endpoint Summary

เมนูข้อมูลพื้นฐานมี `17` canonical endpoints และแสดงเป็น `21` Swagger operations เพราะ endpoint เดิมของจุดตรวจวัดมี annual path variants เพิ่ม `4` operations

| งาน                            | Method | Path                                                             | Permission                             | Contract                                                                                                                               |
| ------------------------------ | ------ | ---------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| รายชื่อโรงงาน current/live     | `GET`  | `/api/v1/poms-factories`                                         | `factories:view`                       | [List POMS factories](#get-apiv1poms-factories)                                                                                        |
| ข้อมูลโรงงานและจุดตรวจวัด      | `GET`  | `/api/v1/poms-factories/:factoryId`                              | `factories:view`                       | [POMS factory detail](#get-apiv1poms-factoriesfactoryid)                                                                               |
| อ่าน prefill ฟอร์มจาก POMS     | `GET`  | `/api/v1/poms-factories/:factoryId/form`                         | `factories:view`                       | [Factory form prefill](#get-apiv1poms-factoriesfactoryidform)                                                                          |
| อัปโหลดเอกสารหรือรูปภาพ        | `POST` | `/api/v1/poms-factories/document-images`                         | `factories:edit`                       | [Document/image upload](#post-apiv1poms-factoriesdocument-images)                                                                      |
| ส่งคำขอแก้ไขข้อมูล             | `POST` | `/api/v1/poms-factories/:factoryId/edit-requests`                | `factories:view` + `factories:edit`    | [Create edit request](#post-apiv1poms-factoriesfactoryidedit-requests)                                                                 |
| รายการคำขอแก้ไข                | `GET`  | `/api/v1/poms-factories/edit-requests`                           | `factories:view`                       | [List edit requests](#get-apiv1poms-factoriesedit-requests)                                                                            |
| รายละเอียดคำขอแก้ไข            | `GET`  | `/api/v1/poms-factories/edit-requests/:id`                       | `factories:view`                       | [Edit-request detail](#get-apiv1poms-factoriesedit-requestsid)                                                                         |
| อ่าน prefill รอบแก้ไข        | `GET`  | `/api/v1/poms-factories/edit-requests/:id/form`                  | `factories:view`                       | [Edit-request form prefill](#get-apiv1poms-factoriesedit-requestsidform)                                                               |
| ส่งคำขอแก้ไขกลับเข้าพิจารณา    | `PUT`  | `/api/v1/poms-factories/edit-requests/:id/resubmission`          | `factories:view` + `factories:edit`    | [Resubmission](#put-apiv1poms-factoriesedit-requestsidresubmission)                                                                    |
| ยกเลิกคำขอแก้ไข                | `POST` | `/api/v1/poms-factories/edit-requests/:id/cancel`                | `factories:view` + `factories:edit`    | [Cancel edit request](#post-apiv1poms-factoriesedit-requestsidcancel)                                                                  |
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
| Edit scope           | `POST .../document-images` ใช้ `factories:edit`; ส่วน `POST .../edit-requests`, `PUT .../resubmission` และ `POST .../cancel` ต้องผ่านทั้ง `factories:view` และ `factories:edit` โดยการคัด resource สำหรับ mutation ยึด scope ของ `factories:edit` |
| Approval scope       | `POST .../review` ต้องผ่านทั้ง `factories:view` และ `factories:approve`, ยึด scope ของ `factories:approve` และบังคับ `userType = admin` พร้อม role `admin`                |
| Object scope         | รายการถูกกรองตาม effective scope ของ endpoint; detail หรือ mutation ที่อ้างโรงงาน/คำขอนอก scope ตอบ `404 NOT_FOUND` เพื่อไม่เปิดเผยว่าข้อมูลมีอยู่                       |
| Separation of duties | ผู้พิจารณาต้องไม่ตรงกับทั้ง `createdBy` และ `submittedBy` ของคำขอ; กฎนี้ใช้กับ `APPROVE`, `REQUEST_REVISION` และ `REJECT`; ถ้าซ้ำตอบ `403 FORBIDDEN`                     |
| Cancel ownership     | `POST .../cancel` อนุญาตเฉพาะผู้ใช้ที่ตรงกับ `createdBy`; ผู้มี permission แต่ไม่ใช่เจ้าของตอบ `403 FORBIDDEN`                                                              |

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

Detail endpoint นี้ยังใช้ `PomsFactoryDetail` โดยไม่เปลี่ยนไปใช้ shared operator-factory row ของ list endpoint และเพิ่มกลุ่มอุตสาหกรรมจาก active eligible metadata ที่ผูกกับโรงงาน current/live

| Field                                               | Type                               | Nullable | Description                                            |
| --------------------------------------------------- | ---------------------------------- | -------- | ------------------------------------------------------ |
| `success`                                           | boolean                            | no       | `true`                                                 |
| `data`                                              | object                             | no       | profile current/live และจุดตรวจวัดของโรงงาน           |
| `data.eligibleFactoryId`                            | number                             | no       | active `eligible_factories.id`                         |
| `data.factoryId`                                    | string                             | no       | stable factory identifier                              |
| `data.factoryRegistrationNo`                        | string                             | no       | เลขทะเบียนโรงงานรูปแบบเดิมของ detail contract         |
| `data.factoryName`                                  | string                             | no       | ชื่อโรงงาน current/live                                |
| `data.industryMainOrder`                            | string                             | yes      | ลำดับประเภทโรงงานหลักจาก active `eligible_factories.factory_type_sequence` |
| `data.industryMainOrderLabel`                       | string                             | yes      | ข้อความแสดงผลที่สร้างจากลำดับประเภทโรงงานหลักที่ normalize แล้ว |
| `data.industrySubOrder`                             | string                             | yes      | ลำดับประเภทย่อยจาก active `eligible_factories.factory_type_sequence` |
| `data.businessActivity`                             | string                             | yes      | การประกอบกิจการจาก active `eligible_factories`        |
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
    "industryMainOrder": "00343",
    "industryMainOrderLabel": "ประเภทโรงงานลำดับที่ 00343",
    "industrySubOrder": "00003",
    "businessActivity": "ผลิตผลิตภัณฑ์ตัวอย่าง",
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

response prefill ยังคืนชื่อโรงงาน ที่อยู่ เลขทะเบียน และ field อื่นของ shared contract เพื่อแสดงข้อมูลประกอบเท่านั้น สำหรับ `BASIC_INFO` ให้เปิดแก้เฉพาะ [7 fields ที่อนุญาต](#shared-basic-info-fields) และสร้าง write payload จาก allowlist นี้ ห้ามส่ง response ทั้ง object กลับเป็น create/resubmission body; `remarks` ใน response ไม่ใช่ field ที่แก้ได้ของ `BASIC_INFO`

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
| `industryMainOrder`, `industryMainOrderLabel`, `industrySubOrder`, `businessActivity` | active `eligible_factories.factory_type_sequence` และ `eligible_factories.business_activity` ที่ผูกกับ current/live POMS | `null` เมื่อ eligible metadata ไม่มีค่า |
| รหัสพื้นที่, พิกัด/คำอธิบายเฉพาะจุด, ผู้ให้ข้อมูล | POMS ไม่เก็บ | `null` |
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
    "industryMainOrder": "00343",
    "industryMainOrderLabel": "ประเภทโรงงานลำดับที่ 00343",
    "industrySubOrder": "00003",
    "businessActivity": "ผลิตผลิตภัณฑ์ตัวอย่าง",
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

### `POST /api/v1/poms-factories/document-images`

อัปโหลด binary file เพื่อสร้าง `RequestDocumentImage` metadata สำหรับ payload คำขอแก้ไข Endpoint นี้ใช้ Bearer token และ permission `factories:edit`, รับ `multipart/form-data` ครั้งละหนึ่งไฟล์ และยังไม่ผูกไฟล์กับโรงงานหรือคำขอจนกว่า client จะนำ object ที่ตอบกลับไปใส่ใน create/resubmission payload

#### Request Fields

| Field         | Type   | Required | Rules                                                                                                                           |
| ------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `file`        | binary | yes      | หนึ่งไฟล์ต่อ request; 1–5,242,880 bytes; JPEG (`.jpg`, `.jpeg`), PNG (`.png`) หรือ PDF (`.pdf`); MIME, นามสกุล และ signature ต้องตรงกัน |
| `title`       | string | no       | trim ค่าว่างเป็น omitted; ไม่เกิน 255 ตัวอักษร; เมื่อไม่ส่งใช้ค่าเริ่มต้น `เอกสารและรูปภาพ`                                    |
| `description` | string | no       | trim ค่าว่างเป็น `null`; ไม่เกิน 1000 ตัวอักษร                                                                                 |
| `link`        | string | no       | reference URL แบบ absolute `http`/`https`; trim ค่าว่างเป็น `null`; ไม่เกิน 2048 ตัวอักษร                                      |

มุมมองเชิงโครงสร้างของ multipart request:

```json
{
  "file": "<binary: factory-front.jpg>",
  "title": "ภาพถ่ายหน้าโรงงาน",
  "description": "ภาพถ่ายล่าสุด",
  "link": "https://example.com/factory-reference"
}
```

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/poms-factories/document-images' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --form 'file=@./factory-front.jpg;type=image/jpeg' \
  --form 'title=ภาพถ่ายหน้าโรงงาน' \
  --form 'description=ภาพถ่ายล่าสุด' \
  --form 'link=https://example.com/factory-reference'
```

Minimal response (`201 Created`):

```json
{
  "success": true,
  "data": {
    "title": "ภาพถ่ายหน้าโรงงาน",
    "description": "ภาพถ่ายล่าสุด",
    "link": "https://example.com/factory-reference",
    "fileName": "factory-front.jpg",
    "fileUrl": "https://example.com/uploads/cems-wpms/document-images/2026/09/550e8400-e29b-41d4-a716-446655440000.jpg",
    "fileType": "image/jpeg",
    "fileSize": 245760
  }
}
```

response คืนทั้ง 7 fields ใน `data` ทุกครั้ง โดย `description` และ `link` อาจเป็น `null`; เนื่องจาก endpoint นี้บังคับ `file` ค่า `fileName`, `fileUrl`, `fileType` และ `fileSize` จึงไม่เป็น `null`

client ใช้ `data` ทั้ง object เป็นสมาชิกของ `factoryFrontPhotos` หรือเป็นค่า `factoryLogo`: `factoryFrontPhotos` รับมากสุด 10 objects ส่วน `factoryLogo` รับได้หนึ่ง object หรือ `null` เท่านั้น การเรียก upload ไม่เปลี่ยนค่าเดิมจนกว่าจะส่งคำขอแก้ไข

Multer failure เช่นเกิน 5 MiB หรือส่งไฟล์/part เกิน limit ตอบ `400 FILE_UPLOAD_FAILED`; กรณีไม่ส่งไฟล์ ไฟล์ว่าง ชนิด/นามสกุล/signature ไม่ตรง หรือ `link` ไม่ใช่ `http`/`https` ตอบ `400 BAD_REQUEST`

### Shared Basic-info Fields

เมื่อ body ไม่ส่ง `formType` backend จะตีความเป็นฟอร์ม `BASIC_INFO`; client ใหม่ควรส่ง `formType = "BASIC_INFO"` ให้ชัดเจน โดย `formType` เป็นเพียงตัวเลือกแบบฟอร์ม และแก้ได้เฉพาะ 7 fields ต่อไปนี้

| Field                | Type           | Required | Rules                                                                                               |
| -------------------- | -------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `formType`           | string         | no       | ถ้าส่งต้องเป็น `BASIC_INFO`; omission รองรับ client เดิม                                           |
| `eia`                | string \| null | no       | การประเมินผลกระทบสิ่งแวดล้อม; enum: `มี`, `ไม่มี`, `มี IEE`, `มี EIA`, `มี EHIA`, `อื่นๆ`             |
| `projectName`        | string \| null | no       | ชื่อโครงการ; string ไม่เกิน 500 ตัวอักษร                                                             |
| `eiaOther`           | string \| null | no       | อื่นๆ ของ EIA; ต้องมีข้อความเมื่อส่ง `eia = "อื่นๆ"`; ห้ามส่งค่า non-null ในกรณีอื่น; ไม่เกิน 500 ตัวอักษร |
| `factoryFrontPhotos` | object[]       | no       | ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน; `[]` = ล้างทั้งหมด; object array ใหม่ = แทนที่ค่าเดิม; มากสุด 10 รายการ |
| `factoryLogo`        | object \| null | no       | สัญลักษณ์ของโรงงานหรือโลโก้บริษัท; object ใหม่ = แทนที่ค่าเดิม; มากสุด 1 object                       |
| `latitude`           | number \| null | no       | ละติจูด ช่วง `-90` ถึง `90`; ต้องส่งพร้อม `longitude` รวมถึงกรณีส่ง `null` เพื่อล้างพิกัด              |
| `longitude`          | number \| null | no       | ลองติจูด ช่วง `-180` ถึง `180`; ต้องส่งพร้อม `latitude`                                             |

- ต้องส่งอย่างน้อยหนึ่ง field ที่แก้ได้; body `{}` หรือ `{ "formType": "BASIC_INFO" }` ตอบ `400 VALIDATION_ERROR`
- omission = คงค่าจาก current/live snapshot รอบส่งคำขอนั้น; `null` = ล้างค่าของ field ที่ nullable ตามเงื่อนไขของแต่ละ field; `factoryFrontPhotos` ใช้ `[]` เพื่อล้างรูปทั้งหมด
- `eiaOther` เป็นรายละเอียดที่ส่งพร้อม `eia = "อื่นๆ"`; หากต้องการล้างรายละเอียดให้เปลี่ยน `eia` เป็นค่าอื่นหรือ `null` แล้ว backend จะล้าง `eiaOther` ด้วย การส่ง `eiaOther: null` เพียงอย่างเดียวไม่เปลี่ยนรายละเอียดเดิม
- `factoryName`, `address`, `factoryAddress`, `remarks` และ `note` ไม่อยู่ใน allowlist และตอบ `400 VALIDATION_ERROR` แม้ส่งค่าเดิมหรือ `null`; กฎเดียวกันใช้ทั้ง create และ resubmission รวมถึงคำขอเก่า
- ชื่อและที่อยู่ใน proposed profile คงค่าจาก current/live snapshot; `requestNote` ของ `BASIC_INFO` ที่สร้างหรือ resubmit ภายใต้ contract นี้เป็น `null` ส่วน `MEASUREMENT_POINTS` ยังรองรับ `remarks`/`note` ตามเดิม

Document object ของ `factoryFrontPhotos[]` และ `factoryLogo`:

create/resubmission endpoints ไม่รับ multipart/binary upload; client ต้องเรียก [`POST /api/v1/poms-factories/document-images`](#post-apiv1poms-factoriesdocument-images) ก่อน แล้วส่ง document metadata ที่มี absolute URL ใน JSON payload

| Field         | Type                     | Required | Rules                                                                                             |
| ------------- | ------------------------ | -------- | ------------------------------------------------------------------------------------------------- |
| `title`       | string                   | yes      | trim แล้ว 1–255 ตัวอักษร                                                                          |
| `description` | string \| null           | no       | ไม่เกิน 1000 ตัวอักษร                                                                             |
| `link`        | string \| null           | no       | absolute `http`/`https` URL ไม่เกิน 2048 ตัวอักษร; ต้องมี `link` หรือ `fileUrl` อย่างน้อยหนึ่งค่า |
| `fileName`    | string \| null           | no       | ไม่เกิน 255 ตัวอักษร                                                                              |
| `fileUrl`     | string \| null           | no       | absolute `http`/`https` URL ไม่เกิน 2048 ตัวอักษร; ต้องมี `link` หรือ `fileUrl` อย่างน้อยหนึ่งค่า |
| `fileType`    | string \| null           | no       | ไม่เกิน 128 ตัวอักษร                                                                              |
| `fileSize`    | positive integer \| null | no       | 1–5,242,880 bytes                                                                                 |

field ที่ห้ามส่งเพิ่มเติม ได้แก่ `eligibleFactoryId`, `factoryId`, `factoryRegistrationNo`, จังหวัด/ภูมิภาค/นิคม, กลุ่มอุตสาหกรรม และสถานะ/audit เนื่องจาก schema เป็น strict object จึงตอบ `400 VALIDATION_ERROR` เมื่อมี field นอก allowlist

### Measurement-point Fields

เมื่อ body ส่ง `formType = "MEASUREMENT_POINTS"` backend จะใช้ payload สำหรับแก้ไขข้อมูลจุดตรวจวัด current/live ของโรงงานนั้นโดยอิง `connectedPointId` และรับข้อมูลทั่วไปของโรงงานเป็น top-level fields ในคำขอเดียวกัน

| ข้อมูลทั่วไปของโรงงาน | Type | Required | Rules |
| --- | --- | --- | --- |
| `eia` | string \| null | no | enum และเงื่อนไขเดียวกับ [Shared Basic-info Fields](#shared-basic-info-fields) |
| `eiaOther` | string \| null | no | ข้อความไม่เกิน 500 ตัวอักษร; ส่งพร้อม `eia = "อื่นๆ"` |
| `projectName` | string \| null | no | ไม่เกิน 500 ตัวอักษร; `null` ล้างค่า |
| `factoryFrontPhotos` | object[] | no | `RequestDocumentImage` สูงสุด 10 รูป; `[]` ล้างรูป |
| `factoryLogo` | object \| null | no | `RequestDocumentImage` หนึ่ง object; `null` ล้างโลโก้ |
| `latitude`, `longitude` | number \| null | no | ต้องส่งคู่กัน; ช่วง -90 ถึง 90 และ -180 ถึง 180; `null` ทั้งคู่ล้างพิกัด |

การเชื่อมต่อ frontend: ปลด `generalFactoryFieldsReadOnly` ในฟอร์มแก้ไขจุดตรวจวัด แล้วให้ตัวสร้าง payload ส่ง 7 fields นี้ที่ root ของ body; metadata รูปโรงงานและโลโก้ต้องส่งใน `factoryFrontPhotos` / `factoryLogo` โดยเฉพาะ การส่งไว้เฉพาะ `measurementPoints[].documentsAndImages` ไม่ถือเป็นการแก้ข้อมูลทั่วไปของโรงงาน ใช้ `GET /poms-factories/edit-requests/:id/form` เพื่อโหลด proposed values เมื่อแก้คำขอที่ถูกส่งกลับ

ข้อมูลทั่วไปที่ไม่ส่งคงค่าเดิม ยังคงส่ง `measurementPoints` อย่างน้อยหนึ่งรายการตามตารางด้านล่างได้แม้ค่าในจุดนั้นไม่เปลี่ยน โดยคำขอต้องมีการเปลี่ยนข้อมูลทั่วไปหรือข้อมูลจุดอย่างน้อยหนึ่งส่วน หากทั้งสองส่วนเหมือนเดิมตอบ `409 CONFLICT`

```json
{
  "formType": "MEASUREMENT_POINTS",
  "projectName": "โครงการปรับปรุงระบบตรวจวัด",
  "latitude": 13.1,
  "longitude": 100.1,
  "measurementPoints": [{ "connectedPointId": 15, "pointName": "ปล่อง A" }]
}
```


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

field ที่ห้ามส่งในฟอร์มนี้ ได้แก่ `pointCode`, `pointType`, `systemType`, `parameters`, `sourceMeasurementPointId`, `eligibleFactoryId`, `factoryId`, `factoryName`, `updatedAt`, device configuration และ field identity/audit อื่น ๆ เพราะ approval อัปเดตเฉพาะ fields ที่อนุญาตของข้อมูลโรงงานและจุดตรวจวัด

### `POST /api/v1/poms-factories/:factoryId/edit-requests`

สร้างคำขอ `PENDING_REVIEW` โดยเก็บ snapshot ตาม `formType` หนึ่งโรงงานมี open request ได้ครั้งละหนึ่งรายการต่อ `formType` response ใช้ field contract เดียวกับ [edit-request detail](#get-apiv1poms-factoriesedit-requestsid)

#### Request Fields

ใช้ `factoryId` path ตาม detail endpoint และ body ตาม [Shared Basic-info Fields](#shared-basic-info-fields) หรือ [Measurement-point Fields](#measurement-point-fields)

Minimal request:

```json
{
  "formType": "BASIC_INFO",
  "latitude": 14.315,
  "longitude": 100.612,
  "eia": "มี",
  "eiaOther": null,
  "projectName": "โครงการปรับปรุงระบบตรวจวัด",
  "factoryFrontPhotos": [],
  "factoryLogo": null
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
    "requestNo": "base-00001/2569",
    "revisionNo": 0,
    "isOpen": true,
    "eligibleFactoryId": 7,
    "factoryId": "factory-001",
    "factoryName": "บริษัท ตัวอย่าง จำกัด",
    "formType": "BASIC_INFO",
    "status": "PENDING_REVIEW",
    "statusLabel": "รอพิจารณา",
    "requestNote": null,
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
      "requestNo": "base-00001/2569",
      "revisionNo": 0,
      "isOpen": true,
      "eligibleFactoryId": 7,
      "factoryId": "factory-001",
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
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

`currentFactory` และ `proposedFactory` ยังคง profile response ที่มีชื่อ ที่อยู่ และ identity fields เพื่อแสดงบริบท; การมี field ใน response ไม่ทำให้ field นั้นแก้ไขได้ สำหรับ `BASIC_INFO` ที่สร้างหรือ resubmit ภายใต้ contract นี้ ชื่อและที่อยู่ใน proposed snapshot คงค่าปัจจุบัน ส่วนคำขอเก่าอาจยังมี proposed ชื่อ/ที่อยู่เดิมในประวัติ แต่ approval จะไม่เขียนสอง field นี้

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
| `data.requestNo`             | string                                                                | no       | เลขตาม [Request Number Contract](#request-number-contract); คำขอเดิม `PFE-*` ยังคงเลขเดิม |
| `data.eligibleFactoryId`     | number                                                                | no       | active `eligible_factories.id` ของคำขอ                                           |
| `data.factoryId`             | string                                                                | no       | current/live factory identifier                                                  |
| `data.factoryRegistrationNo` | string                                                                | no       | เลขทะเบียนโรงงาน                                                                 |
| `data.factoryName`           | string                                                                | no       | ชื่อโรงงานใน proposed profile                                                    |
| `data.formType`              | `BASIC_INFO` \| `MEASUREMENT_POINTS`                                  | no       | ประเภทแบบฟอร์มของคำขอ                                                           |
| `data.revisionNo`            | number                                                                | no       | รอบแก้ไข เริ่มที่ `0` และเพิ่มเมื่อ resubmit                                     |
| `data.isOpen`                | boolean                                                               | no       | `true` สำหรับสถานะที่ workflow ยังไม่สิ้นสุด                                     |
| `data.status`                | string                                                                | no       | workflow status code                                                             |
| `data.statusLabel`           | string                                                                | no       | label สำหรับแสดงผล                                                               |
| `data.requestNote`           | string                                                                | yes      | หมายเหตุผู้ส่ง; `BASIC_INFO` ที่สร้างหรือ resubmit ภายใต้ contract นี้เป็น `null` |
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
| `data.events[].action`       | `SUBMIT` \| `RESUBMIT` \| `APPROVE` \| `REQUEST_REVISION` \| `REJECT` \| `CANCEL` | no       | action ที่เกิดขึ้น                                                               |
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
    "requestNo": "base-00001/2569",
    "eligibleFactoryId": 7,
    "factoryId": "factory-001",
    "factoryRegistrationNo": "3-106-33/50สบ",
    "factoryName": "บริษัท ตัวอย่าง จำกัด",
    "formType": "BASIC_INFO",
    "revisionNo": 0,
    "isOpen": true,
    "status": "REVISION_REQUESTED",
    "statusLabel": "ส่งกลับให้แก้ไข",
    "requestNote": null,
    "revisionReason": "กรุณาแนบภาพด้านหน้าโรงงานล่าสุด",
    "officerNote": null,
    "currentFactory": {
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "factoryAddress": "99 หมู่ 1",
      "projectName": "โครงการเดิม"
    },
    "proposedFactory": {
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "factoryAddress": "99 หมู่ 1",
      "projectName": "โครงการปรับปรุงระบบตรวจวัด"
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

คืน `data` ด้วย shared form contract เดียวกับ [Connection-request form prefill](../connection-requests/README.md#connection-request-form-prefill) แต่ overlay proposed values ของคำขอแก้ไขบน current/live POMS: `BASIC_INFO` ใช้เฉพาะ 7 editable fields จาก proposed factory profile โดยชื่อ ที่อยู่ และข้อมูลอ่านอย่างเดียวยึด current/live รวมถึงเมื่อเปิดคำขอเก่า; `MEASUREMENT_POINTS` ใช้ proposed measurement points และใช้ 7 editable fields จาก proposed factory profile เมื่อมีการแก้ข้อมูลทั่วไป; ถ้าแก้เฉพาะจุดใช้ข้อมูลทั่วไป current/live และทั้งสองแบบใช้ `requestNote` เป็น `remarks` (`BASIC_INFO` ที่สร้างหรือ resubmit ภายใต้ contract นี้คืน `null`)

ไม่ hydrate field ที่ขาดจากคำขอเชื่อมต่อเดิม และไม่คืน `id`, `requestNo`, `status`, `revisionReason` หรือ audit metadata ใน `data`; field ที่ POMS ไม่เก็บใช้ null/empty semantics ตาม [POMS Source And Nullability](#poms-source-and-nullability)

ชื่อ ที่อยู่ และ identity fields ใน prefill เป็นข้อมูลอ่านอย่างเดียวสำหรับ `BASIC_INFO`; ให้ส่งกลับเฉพาะ [7 editable fields](#shared-basic-info-fields) รวมถึงเมื่อเปิดแก้ไขคำขอเก่า ส่วน `remarks` ยังคงเป็น field ของ shared response แต่ห้ามส่งใน `BASIC_INFO` resubmission

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
    "factoryName": "บริษัท ตัวอย่าง จำกัด",
    "factoryRegistrationNo": "3-106-33/50สบ",
    "address": "99 หมู่ 1",
    "projectName": "โครงการปรับปรุงระบบตรวจวัด",
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

### `PUT /api/v1/poms-factories/edit-requests/:id/resubmission`

ใช้ได้เมื่อสถานะเป็น `REVISION_REQUESTED` เท่านั้น backend โหลดข้อมูล current/live ล่าสุดเป็น snapshot ใหม่ แทนที่ proposed data จาก body แล้วเปลี่ยนสถานะเป็น `REVISED_PENDING_REVIEW`; `formType` ต้องตรงกับคำขอเดิม

`BASIC_INFO` ใช้ allowlist เดียวกับ create: ส่งอย่างน้อยหนึ่ง editable field และห้ามส่ง `factoryName`, `address`, `factoryAddress`, `remarks` หรือ `note` แม้คำขอเดิมเคยรับ field เหล่านี้; field ที่ละไว้คงค่าจาก current/live ล่าสุด ไม่ใช่ proposed snapshot รอบก่อน

#### Request Fields

ใช้ `id` path ตาม detail endpoint และ body ตาม [Shared Basic-info Fields](#shared-basic-info-fields) หรือ [Measurement-point Fields](#measurement-point-fields) ให้ตรงกับ `formType` เดิม

Minimal request:

```json
{
  "formType": "BASIC_INFO",
  "factoryFrontPhotos": [
    {
      "title": "ภาพด้านหน้าโรงงานล่าสุด",
      "fileName": "factory-front.jpg",
      "fileUrl": "https://example.com/uploads/factory-front.jpg",
      "fileType": "image/jpeg",
      "fileSize": 245760
    }
  ]
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
    "requestNo": "base-00001/2569",
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

### `POST /api/v1/poms-factories/edit-requests/:id/cancel`

ยกเลิกคำขอแก้ไขโดยไม่เปลี่ยนข้อมูล current/live ใช้ Bearer token พร้อม `factories:view` และ `factories:edit`; การคัด resource ยึด data scope ของ `factories:edit` และผู้เรียกต้องเป็นผู้สร้างคำขอเดิมตาม `createdBy` เท่านั้น

ยกเลิกได้เมื่อสถานะปัจจุบันเป็น `PENDING_REVIEW`, `REVISION_REQUESTED` หรือ `REVISED_PENDING_REVIEW` หลังสำเร็จสถานะเป็น `CANCELLED`, `statusLabel = "ยกเลิก"`, `isOpen = false` และเพิ่ม event `CANCEL` การตอบกลับเป็น full [`PomsFactoryEditRequestResponse`](#get-apiv1poms-factoriesedit-requestsid) ไม่ใช่ summary object

#### Request Fields

| Field | Location | Type             | Required | Rules           |
| ----- | -------- | ---------------- | -------- | --------------- |
| `id`  | path     | positive integer | yes      | edit-request ID |

endpoint นี้ไม่มี request body:

```json
{}
```

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "id": 11,
    "requestNo": "base-00001/2569",
    "eligibleFactoryId": 7,
    "factoryId": "factory-001",
    "factoryRegistrationNo": "3-106-33/50สบ",
    "factoryName": "บริษัท ตัวอย่าง จำกัด",
    "formType": "BASIC_INFO",
    "revisionNo": 0,
    "isOpen": false,
    "status": "CANCELLED",
    "statusLabel": "ยกเลิก",
    "requestNote": null,
    "revisionReason": null,
    "officerNote": null,
    "currentFactory": {
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "factoryAddress": "99 หมู่ 1",
      "projectName": "โครงการเดิม"
    },
    "proposedFactory": {
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "factoryAddress": "99 หมู่ 1",
      "projectName": "โครงการปรับปรุงระบบตรวจวัด"
    },
    "currentMeasurementPoints": null,
    "proposedMeasurementPoints": null,
    "createdBy": 42,
    "submittedBy": 42,
    "submittedAt": "2026-08-24T02:00:00.000Z",
    "reviewedBy": null,
    "reviewedAt": null,
    "approvedAt": null,
    "events": [
      {
        "id": 2,
        "action": "CANCEL",
        "fromStatus": "PENDING_REVIEW",
        "toStatus": "CANCELLED",
        "note": null,
        "actorUserId": 42,
        "createdAt": "2026-09-04T10:30:00.000Z"
      }
    ],
    "createdAt": "2026-08-24T02:00:00.000Z",
    "updatedAt": "2026-09-04T10:30:00.000Z"
  }
}
```

ถ้าไม่พบคำขอหรือนอก data scope ตอบ `404 NOT_FOUND`; ถ้าผู้เรียกไม่ใช่ `createdBy` ตอบ `403 FORBIDDEN`; ถ้าสถานะไม่อนุญาตให้ยกเลิกตอบ `409 INVALID_STATUS_TRANSITION` พร้อม `error.details.id` และ `error.details.status`

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
    "requestNo": "base-00001/2569",
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
| `CANCELLED`              | `ยกเลิก`              | `false`  | ผู้สร้างคำขอปิดคำขอโดยไม่เปลี่ยนข้อมูลจริง |

State transitions:

| Current status                                 | Who                    | Operation/decision | Next status              | Effect                                                |
| ---------------------------------------------- | ---------------------- | ------------------ | ------------------------ | ----------------------------------------------------- |
| none                                           | ผู้มี `factories:edit` | create             | `PENDING_REVIEW`         | เก็บ current/proposed snapshot ตาม `formType` และเปิดคำขอ     |
| `PENDING_REVIEW`                               | admin                  | `REQUEST_REVISION` | `REVISION_REQUESTED`     | บันทึก `revisionReason`; ยังไม่แก้ข้อมูลจริง                 |
| `REVISION_REQUESTED`                           | ผู้มี `factories:edit` | resubmission       | `REVISED_PENDING_REVIEW` | refresh current snapshot และส่ง proposed payload เดิมอีกครั้ง |
| `PENDING_REVIEW`, `REVISION_REQUESTED` หรือ `REVISED_PENDING_REVIEW` | ผู้สร้างคำขอ (`createdBy`) | `CANCEL` | `CANCELLED` | ปิดคำขอโดยไม่แก้ข้อมูล current/live |
| `PENDING_REVIEW` หรือ `REVISED_PENDING_REVIEW` | admin                  | `APPROVE`          | `APPROVED`               | sync ข้อมูลจริงแบบ atomic ตาม `formType`                    |
| `PENDING_REVIEW` หรือ `REVISED_PENDING_REVIEW` | admin                  | `REJECT`           | `REJECTED`               | ปิดคำขอโดยไม่แก้ข้อมูลจริง                                   |

Approval target mapping สำหรับ `BASIC_INFO` (ใช้ allowlist นี้รวมถึงการอนุมัติคำขอเก่าที่ยังรอพิจารณา):

| API profile field                   | active `cems_wpms_connected_measurement_points`                                           | active `eligible_factories`                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `latitude`, `longitude`             | `factory_latitude`, `factory_longitude` ทุก active point                                  | `latitude`, `longitude`                          |
| `eia`, `eiaOther`                   | `factory_eia_assessment`, `factory_eia_other`, derived `factory_has_eia` ทุก active point | `eia_assessment`, `eia_other`, derived `has_eia` |
| `projectName`                       | `factory_project_name` ทุก active point                                                   | `project_name`                                   |
| `factoryFrontPhotos`, `factoryLogo` | `factory_front_photos_json`, `factory_logo_json` ทุก active point                         | ไม่มี target field และไม่อัปเดต                  |

- หนึ่งโรงงานมี open request ได้หนึ่งรายการต่อ `formType` โดย open status คือ `PENDING_REVIEW`, `REVISION_REQUESTED` หรือ `REVISED_PENDING_REVIEW`
- create/resubmission/cancel/review ไม่รับ `Idempotency-Key`; การยกเลิกซ้ำตอบ `409 INVALID_STATUS_TRANSITION` ส่วนการเรียก transition อื่นซ้ำตอบ `409 CONFLICT`
- create/resubmission lock ข้อมูล current/live connected POMS และตรวจ source version ของ snapshot ใน transaction เดียวกับการบันทึกคำขอและ event; หากขั้นตอนใดล้มเหลว transaction จะ rollback จึงไม่เหลือคำขอหรือ event ที่บันทึกเพียงบางส่วน
- การอนุมัติ lock คำขอและข้อมูล current/live ที่เกี่ยวข้องใน transaction เดียวกัน และตรวจ source version จากตอนส่ง/ส่งกลับ หากข้อมูลจริงถูกเปลี่ยนระหว่างรอพิจารณาให้ตอบ `409 CONFLICT` โดยไม่มี partial update
- approval ทำ target updates ตาม `formType` แบบ atomic; `BASIC_INFO` ไม่เขียน `factory_name`, `factory_address` หรือ `eligible_factories.address` แม้ proposed snapshot ของคำขอเก่ามีค่าที่ต่างออกไป; ตาราง `factories` ไม่ใช่เป้าหมายของ workflow นี้
- ถ้าคำขอ `MEASUREMENT_POINTS` เปลี่ยนข้อมูลทั่วไปด้วย จะตรวจ source profile version และ sync ข้อมูลทั่วไปไป active connected rows ทุกจุดและ active `eligible_factories` ตาม mapping ของ `BASIC_INFO` ใน transaction เดียวกับจุดตรวจวัด หากเปลี่ยนเฉพาะจุดจะไม่เขียนข้อมูลทั่วไปจาก snapshot เก่าทับ live data; หากส่วนใดล้มเหลวให้ rollback ทั้งคำขอ
- เมื่อ `formType = "MEASUREMENT_POINTS"` backend อัปเดตข้อมูลจุดใน active `cems_wpms_connected_measurement_points` ของโรงงานนั้น ได้แก่ `point_name`, `monitoring_point_status`, `details_json`, `documents_json` และ `instruments_json`

## Errors

ทุก endpoint ใช้ [shared success/error envelope](../../shared/common-api/README.md#shared-response-shape)

| HTTP status | `error.code`       | Condition                                                                                                                                  | Client action                                   |
| ----------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `400`       | `VALIDATION_ERROR` | path/query/body ไม่ตรง strict schema, `BASIC_INFO` ไม่มี editable field, พิกัดไม่ส่งเป็นคู่, `eiaOther` ผิดเงื่อนไข หรือมี field นอก allowlist                                | แสดง validation ตาม `error.issues[].pathString` |
| `400`       | `FILE_UPLOAD_FAILED` | multipart upload เกิน limit เช่นไฟล์เกิน 5 MiB หรือส่งไฟล์/part เกินจำนวน                                                            | แสดงข้อผิดพลาดอัปโหลดและให้เลือกไฟล์ใหม่        |
| `400`       | `BAD_REQUEST`      | upload ไม่ส่งไฟล์ ไฟล์ว่าง MIME/นามสกุล/signature ไม่ตรง หรือ `link` ไม่ใช่ absolute `http`/`https` URL                                | แก้ไฟล์หรือ metadata แล้วส่งใหม่                 |
| `401`       | `UNAUTHORIZED`     | token ไม่มี/หมดอายุ/ไม่ถูกต้อง                                                                                                             | login ใหม่                                      |
| `403`       | `FORBIDDEN`        | ไม่มี action permission, ผู้ยกเลิกไม่ใช่ `createdBy`, reviewer ไม่ใช่ admin หรือผู้พิจารณาซ้ำกับ `createdBy`/`submittedBy`                  | ซ่อน action หรือใช้ผู้ทำรายการที่ถูกต้อง         |
| `404`       | `NOT_FOUND`        | ไม่พบโรงงาน/คำขอ หรือ resource อยู่นอก effective data scope ของ endpoint (`factories:view`, `factories:edit`, หรือ `factories:approve`)    | กลับหน้ารายการและ refresh                       |
| `409`       | `INVALID_STATUS_TRANSITION` | cancel เมื่อสถานะไม่ใช่ `PENDING_REVIEW`, `REVISION_REQUESTED` หรือ `REVISED_PENDING_REVIEW`                                      | refresh detail และซ่อนปุ่มยกเลิก                 |
| `409`       | `CONFLICT`         | ไม่มี profile field เปลี่ยน, มี open request อยู่แล้ว, transition อื่นไม่รองรับ, source version เปลี่ยน, request ถูกพิจารณาพร้อมกัน หรือเลขคำขอของประเภทและปีนั้นครบ `99999` | refresh detail และตัดสินใจจากสถานะล่าสุด; ถ้าเลขครบให้ติดต่อผู้ดูแล        |

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
| Migrations             | [`0100_create_poms_factory_edit_requests.ts`](../../../../../backend/src/db/migrations/0100_create_poms_factory_edit_requests.ts), [`0106_extend_poms_factory_edit_requests_for_measurement_points.ts`](../../../../../backend/src/db/migrations/0106_extend_poms_factory_edit_requests_for_measurement_points.ts), [`0107_enforce_admin_only_factory_approval.ts`](../../../../../backend/src/db/migrations/0107_enforce_admin_only_factory_approval.ts), [`0109_add_poms_factory_edit_request_cancellation.ts`](../../../../../backend/src/db/migrations/0109_add_poms_factory_edit_request_cancellation.ts) |
| Tests                  | [`poms-factories.route.test.ts`](../../../../../backend/tests/unit/poms-factories.route.test.ts), [`poms-factories.service.test.ts`](../../../../../backend/tests/unit/poms-factories.service.test.ts), [`poms-factories.repository.test.ts`](../../../../../backend/tests/unit/poms-factories.repository.test.ts), [`poms-factories.cancel.service.test.ts`](../../../../../backend/tests/unit/poms-factories.cancel.service.test.ts), [`poms-factories.cancel.repository.test.ts`](../../../../../backend/tests/unit/poms-factories.cancel.repository.test.ts), [`poms-factory-document-upload.route.test.ts`](../../../../../backend/tests/unit/poms-factory-document-upload.route.test.ts), [`poms-measurement-point-edit-requests.validator.test.ts`](../../../../../backend/tests/unit/poms-measurement-point-edit-requests.validator.test.ts), [`poms-measurement-point-edit-requests.migration.test.ts`](../../../../../backend/tests/unit/poms-measurement-point-edit-requests.migration.test.ts), [`factory-approval-admin-only-migration.test.ts`](../../../../../backend/tests/unit/factory-approval-admin-only-migration.test.ts), [`poms-factory-edit-request-cancellation-migration.test.ts`](../../../../../backend/tests/unit/poms-factory-edit-request-cancellation-migration.test.ts), [`poms-factories.openapi.test.ts`](../../../../../backend/tests/unit/poms-factories.openapi.test.ts) |

Breaking change ด้าน editable fields ของ `BASIC_INFO` ถูกบันทึกใน [API changelog](../../CHANGELOG.md#2026-09-05--จำกัด-basic_info-ให้แก้ได้เฉพาะ-7-fields)

Breaking change ด้านสิทธิ์ review ถูกบันทึกใน [API changelog](../../CHANGELOG.md#2026-09-01--เพิ่ม-2-แบบฟอร์มคำขอแก้ไขข้อมูลพื้นฐานจาก-poms-และจำกัดผู้อนุมัติเป็น-admin)
