# โรงงานและคำขอแก้ไขข้อมูลในระบบ POMS

> Owner: Backend

## Frontend Quick Start

คู่มือสำหรับทีม frontend: [แบบฟอร์มแก้ไขข้อมูลทั่วไปของโรงงาน](../../../guides/frontend-handoffs/factory-basic-info/README.md) — จุดที่ต้องปรับ ตัวอย่าง payload และรายการตรวจรับ

เมนูนี้ใช้ข้อมูลโรงงาน current/live จาก active rows ใน `cems_wpms_connected_measurement_points` เพื่อแสดงรายชื่อโรงงานและจุดตรวจวัดในระบบ POMS ผู้ประกอบการส่งคำขอแก้ไขได้ 2 แบบฟอร์มคือ `BASIC_INFO` และ `MEASUREMENT_POINTS` แต่ข้อมูลจริงจะยังไม่เปลี่ยนจนกว่า admin จะพิจารณาอนุมัติ

การอ่านข้อมูลและการกำหนดขอบเขตโรงงานใช้ `factories:view` การอัปโหลดเอกสารใช้ `factories:edit` ส่วนการส่ง ส่งกลับ หรือยกเลิกคำขอใช้ทั้ง `factories:view` และ `factories:edit` แต่การคัด resource สำหรับ mutation จะยึด data scope ของ `factories:edit` และการพิจารณาใช้ทั้ง `factories:view` และ `factories:approve` โดยยึด data scope ของ `factories:approve` พร้อมบังคับว่า reviewer ต้องมี role `admin` ทุก endpoint ต้องใช้ Bearer token

### ข้อมูลสามชุดและเวอร์ชัน

ทะเบียนต้นทาง Fac60k เป็นข้อมูลอ้างอิงแบบ read-only ตามเดิม โรงงานเข้าข่ายและโรงงาน POMS ใช้ข้อมูลทั่วไปหลักร่วมกันเมื่อเปิด canonical mode หลังตรวจและย้ายข้อมูล; ข้อมูลจุดตรวจวัด สถานะเฉพาะระบบ และ snapshot ของคำขอยังคงแยกตามหน้าที่ ดู[แนวทางเปิดใช้ข้อมูลทั่วไปชุดเดียวและตรวจย้ายข้อมูล](../../../guides/factory-profile-consistency-rollout.md)

| ข้อมูล | พฤติกรรมใน canonical mode |
| --- | --- |
| ข้อมูลทั่วไปโรงงาน | หนึ่ง profile ต่อโรงงาน ใช้ร่วมกันระหว่างเข้าข่ายและ POMS; อนุมัติแล้วอ่านค่าร่วมตรงกัน |
| `data.updatedAt` | เวลาแก้ข้อมูลทั่วไปล่าสุด แยกจากเวลาจุดตรวจวัด |
| `data.measurementPoints[].updatedAt` | เวลาของจุดนั้น ใช้ตรวจการแก้จุดพร้อมกัน ไม่ใช้แทน revision ข้อมูลทั่วไป |
| คำขอแก้ข้อมูลทั่วไป | Backend เก็บ source revision ภายในเมื่อสร้าง/ส่งกลับ แล้วตรวจซ้ำก่อนอนุมัติ; คำขอเก่าที่ไม่มี revision ตรวจ editable baseline |
| คำขอแก้เฉพาะจุด | แก้ข้อมูลจุดใน POMS และการผูกช่องอุปกรณ์ที่เกี่ยวข้อง ไม่เขียนข้อมูลทั่วไปหรือเข้าข่าย |
| ประวัติคำขอ | คง current/proposed snapshots ณ เวลาคำขอ แม้ profile ปัจจุบันเปลี่ยนแล้ว |

ไม่เพิ่ม field revision หรือรหัส profile ที่ frontend ต้องส่ง และไม่เปลี่ยนความหมายรหัส API เดิม หาก profile เปลี่ยนระหว่างรออนุมัติหรือยังไม่พร้อมใช้ ตอบ `409 CONFLICT` โดยไม่บันทึกสำเร็จเพียงบางส่วน

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

- `BASIC_INFO` แก้ได้เฉพาะการประเมินผลกระทบสิ่งแวดล้อม (`eia`), ชื่อโครงการ (`projectName`), อื่นๆ ของ EIA (`eiaOther`), ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน (`factoryFrontPhotos`), สัญลักษณ์ของโรงงานหรือโลโก้บริษัท (`factoryLogo`), ละติจูด (`latitude`) และลองติจูด (`longitude`) รวมถึง [ข้อมูลติดต่อและอีเมล](#contact-comparison); เมื่ออนุมัติจะ sync ตาม target mapping โดยคงชื่อและที่อยู่โรงงานเดิม
- `MEASUREMENT_POINTS` ใช้ patch `pointName`, `monitoringPointStatus`, `details`, `documentsAndImages`, `measurementInstruments` และ `officerNotificationEmails` พร้อมข้อมูลทั่วไปของโรงงานและ [ข้อมูลติดต่อ](#contact-comparison) เดียวกับ `BASIC_INFO` ได้ในคำขอเดียวกัน
- binary upload รับครั้งละหนึ่งไฟล์และคืน metadata เท่านั้น การผูกไฟล์กับคำขอเกิดเมื่อ client ส่ง metadata นั้นใน create/resubmission payload
- เฉพาะ `createdBy` ยกเลิกคำขอของตนเองได้ และยกเลิกได้เมื่อสถานะเป็น `PENDING_REVIEW`, `REVISION_REQUESTED`, `REVISED_PENDING_REVIEW` หรือ `REJECTED`
- โรงงานที่อ่านหรือแก้ได้ต้องอยู่ใน effective data scope ของ permission ที่ endpoint ใช้ และหนึ่งโรงงานมี open request ได้สูงสุดหนึ่งรายการต่อ `formType`
- การ review ทุก decision ต้องมี role `admin` ใน JWT พร้อม permissions `factories:view` และ `factories:approve`; บัญชี `userType = officer` ที่ได้รับ role `admin` ใช้งานได้ และ `userType = admin` อย่างเดียวไม่เพียงพอ ไม่ต้องเปลี่ยนประเภทบัญชีหรือ migrate ข้อมูลผู้ใช้
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
| Approval scope       | `POST .../review` ต้องผ่านทั้ง `factories:view` และ `factories:approve`, ยึด scope ของ `factories:approve` และบังคับ role `admin` ใน JWT (ไม่บังคับ `userType`)                |
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
| `data[].officerNotificationEmails`           | string[]                                                    | no       | รวมอีเมลเจ้าหน้าที่ current ของ active points ในโรงงานแบบไม่ซ้ำ                                                                       |
| `data[].isEligible`                          | boolean                                                     | no       | คงที่เป็น `true` เพราะรายการ POMS ต้องจับคู่ active eligible row                                                         |
| `data[].eligibilityStatus`                   | `เข้าข่าย` \| `ไม่เข้าข่าย`                                | no       | คงที่เป็น `เข้าข่าย`                                                                                                    |
| `data[].eligibilityRequest`                  | object                                                      | yes      | คงที่เป็น `null`; endpoint นี้ไม่อ่าน workflow คำขอเพิ่มโรงงาน                                                          |
| `data[].canRequestEligibility`               | boolean                                                     | no       | คงที่เป็น `false`                                                                                                       |
| `data[].monitoringPointCount`                | integer                                                     | no       | จำนวน active connected points ของโรงงาน                                                                                 |
| `data[].requestStatusCode`                   | `CONNECTED`                                                 | no       | derive จากการมี active connected point; ไม่อ่านสถานะจาก connection-request snapshot                                     |
| `data[].status`                              | `แสดง` \| `ซ่อน` \| `ยกเลิกการเชื่อมต่อ`                                          | no       | อ่านค่าจัดการสถานะของ Admin; ดู [จัดการสถานะ](./status-management.md)                                                                                                        |
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
| `data.factoryRegistrationNo`                        | string                             | no       | เลขทะเบียนเดิมจาก active eligible metadata; ถ้าไม่มีใช้เลขใหม่ |
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

คืน prefill โดยให้ข้อมูลโรงงานและจุดตรวจวัดมาจาก current/live POMS ใช้ชื่อและ shape ของ `data` ตรงกับ [Connection-request form prefill](../connection-requests/README.md#connection-request-form-prefill) และไม่คืน wrapper `formDefaults`, workflow metadata, `factoryAddress`, `systemTypes`, `connectedPointId` หรือ `sourceMeasurementPointId`

ข้อมูลระดับโรงงานและจุดตรวจวัดยึด active `cems_wpms_connected_measurement_points`; `contactPersons` และ `notificationEmails` (รวม legacy `contactName`, `contactPhone`, `contactEmail`) ใช้ค่าที่อนุมัติบน active connected point ก่อน หากไม่มี override จึงใช้ source; `[]` ที่ล้างไว้ไม่ fallback. ส่วน `informationProviderName` และ `informationProviderPosition` จะ hydrate จาก `cems_wpms_connection_requests` ที่ผูกผ่าน `source_request_id` ของ active point ล่าสุดใน `systemType` ที่เลือก `officerNotificationEmails` ใช้ค่าของ active points ในระบบที่เลือกก่อน source request ตามหัวข้อ [อีเมลเจ้าหน้าที่](#เพิ่มแก้ไขอีเมลสำหรับแจ้งเตือนเจ้าหน้าที่); ถ้าไม่มี source request ให้ fallback เป็น `null`, `[]` หรือ empty string ตาม type ของ shared contract

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

| Form field | Source | Fallback เมื่อไม่มีข้อมูล |
| ---------- | ------ | -------------------------- |
| `requestType` | compatibility field ของ shared form contract | คงที่เป็น `NEW_CONNECTION`; ไม่ใช่สถานะหรือประเภทคำขอแก้ไข POMS |
| `factoryId`, `factoryName`, `address`, EIA/project, ชื่อพื้นที่, พิกัดโรงงาน | current/live factory profile | `null` สำหรับ field nullable |
| `factoryRegistrationNo` | active `eligible_factories.factory_registration_no_old` เมื่อไม่ว่าง | เลขใหม่ `factory_registration_no_new`; ถ้า metadata ไม่มีค่าใช้เลขที่บันทึกใน POMS |
| `measurementPoints[]` | active points ของ `systemType` ที่เลือก | ถ้าไม่มี active point ตอบ `404` และไม่เปิดฟอร์ม |
| `measurementPoints[].details.eligibleParameters` | รายการพารามิเตอร์ที่เข้าข่ายของจุด | `[]` |
| `measurementPoints[].details.connectedParameters`, `requestedParameters` | พารามิเตอร์ที่เชื่อมต่ออยู่ปัจจุบันจาก active `cems_wpms_connected_measurement_points.parameters_json` | `[]` |
| `measurementPoints[].details.pendingParameters` | `eligibleParameters - connectedParameters` โดยเทียบชื่อพารามิเตอร์แบบ normalize ตัวพิมพ์/Unicode แต่คง label พร้อมหน่วยใน response | `[]` |
| `industryMainOrder`, `industryMainOrderLabel`, `industrySubOrder`, `businessActivity` | active `eligible_factories.factory_type_sequence` และ `eligible_factories.business_activity` ที่ผูกกับ current/live POMS | `null` เมื่อ eligible metadata ไม่มีค่า |
| รหัสพื้นที่, พิกัด/คำอธิบายเฉพาะจุด | POMS ไม่เก็บ | `null` |
| `contactName`, `contactPhone`, `contactEmail` | source connection request ล่าสุดของ active point ใน `systemType` ที่เลือก | `""`, `""`, `null` |
| `contactPersons`, `notificationEmails` | approved override บน active connected point ก่อน source request | `[]` ที่บันทึกไม่ fallback; ถ้าไม่มี override ใช้ source และ legacy fallback เดิม |
| `informationProviderName`, `informationProviderPosition` | `information_provider_name`, `information_provider_position` จาก source row เดียวกัน | `null` เมื่อไม่มีค่า; ไม่ fallback เป็นผู้ติดต่อ |
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
    "contactName": "สมหญิง ใจดี",
    "contactPhone": "0812345678",
    "contactEmail": "contact@example.com",
    "contactPersons": [
      {
        "name": "สมหญิง ใจดี",
        "phone": "0812345678",
        "email": "contact@example.com",
        "position": "ผู้จัดการสิ่งแวดล้อม"
      }
    ],
    "notificationEmails": ["factory-alert@example.com"],
    "officerNotificationEmails": ["officer-alert@example.go.th"],
    "measurementPoints": [
      {
        "pointName": "ปล่อง A",
        "pointCode": "S2001",
        "pointType": "STACK",
        "parameters": ["CO (ppm)"],
        "details": {
          "eligibleParameters": ["CO (ppm)", "NOx (ppm)"],
          "connectedParameters": ["CO (ppm)"],
          "pendingParameters": ["NOx (ppm)"],
          "requestedParameters": ["CO (ppm)"]
        },
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

เมื่อ body ไม่ส่ง `formType` backend จะตีความเป็นฟอร์ม `BASIC_INFO`; client ใหม่ควรส่ง `formType = "BASIC_INFO"` ให้ชัดเจน โดย `formType` เป็นเพียงตัวเลือกแบบฟอร์ม และแก้ข้อมูลทั่วไป 7 fields ต่อไปนี้และ [ข้อมูลติดต่อ](#contact-comparison) ได้

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

ข้อมูลทั่วไปที่ไม่ส่งคงค่าเดิม ยังคงส่ง `measurementPoints` อย่างน้อยหนึ่งรายการตามตารางด้านล่างได้แม้ค่าในจุดนั้นไม่เปลี่ยน โดยคำขอต้องมีการเปลี่ยนข้อมูลทั่วไป ข้อมูลจุด หรือข้อมูลติดต่ออย่างน้อยหนึ่งส่วน หากทุกส่วนเหมือนเดิมตอบ `409 CONFLICT`

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

แต่ละ `measurementPoints[]` ต้องส่งอย่างน้อยหนึ่ง field ที่แก้ได้ นอกเหนือจาก `connectedPointId` เว้นแต่ส่ง contact field ที่ root เพื่อแก้ข้อมูลติดต่อของระบบที่เลือก ค่า `monitoringPointStatus` ที่รับคือ `เชื่อมต่อครบแล้ว`, `ได้รับการยกเว้นทั้งหมด`, `เชื่อมต่อแล้วแต่ยังไม่ครบ`, `อยู่ระหว่างขยายเวลา`, `ยังไม่ได้ดำเนินการเชื่อมต่อ`, `อยู่ระหว่างการตรวจสอบของจังหวัด` หรือ `อยู่ระหว่างเชื่อมต่อ`

field ที่ห้ามส่งในฟอร์มนี้ ได้แก่ `pointCode`, `pointType`, `systemType`, `parameters`, `sourceMeasurementPointId`, `eligibleFactoryId`, `factoryId`, `factoryName`, `updatedAt`, device configuration และ field identity/audit อื่น ๆ เพราะ approval อัปเดตเฉพาะ fields ที่อนุญาตของข้อมูลโรงงานและจุดตรวจวัด

<a id="contact-comparison"></a>

### ผู้ติดต่อและอีเมล: การแก้ไขและเปรียบเทียบก่อน–หลัง

ใช้กับ `POST /api/v1/poms-factories/:factoryId/edit-requests` และ `PUT /api/v1/poms-factories/edit-requests/:id/resubmission` ภายใต้ permission/data scope และสถานะเดิม ส่งเฉพาะข้อมูลติดต่อที่เปลี่ยนได้; field ที่ไม่ส่งคงค่าปัจจุบัน, `[]` ล้างรายการ และ `null` ไม่อนุญาต

| Field ใน body | Type | Required | Validation |
| --- | --- | --- | --- |
| `contactPersons` | object[] | no | สูงสุด 20 คน; `name` trim แล้ว 1–255, `phone` trim แล้ว 1–64; `email` optional/nullable รูปแบบ email ไม่เกิน 255; `position` optional/nullable ไม่เกิน 255 ตาม `ContactPerson` |
| `notificationEmails` | string[] | no | สูงสุด 20 รายการ; email ไม่เกิน 254 ตัวอักษร; trim, lowercase, ตัดซ้ำ |
| `officerNotificationEmails` | string[] | no | สูงสุด 20 รายการ; email ไม่เกิน 254 ตัวอักษร; trim, lowercase, ตัดซ้ำ; ห้ามส่งพร้อม `measurementPoints[].officerNotificationEmails` |

`BASIC_INFO` แก้ข้อมูลติดต่อของ active points ทั้งโรงงาน โดยอ่านค่าก่อนแก้จาก source ล่าสุดข้ามระบบตามกติกาฟอร์มเดิม ส่วน `MEASUREMENT_POINTS` ต้องเลือกจุดจากระบบเดียว (`CEMS` หรือ `WPMS`) เมื่อส่ง contact field ที่ root และจะมีผลกับ active points ทั้งระบบนั้น; ส่งเฉพาะ `connectedPointId` เพื่อเลือกระบบได้โดยไม่ต้องแก้ชื่อจุด หากต้องการแก้อีเมลเจ้าหน้าที่เฉพาะจุด ให้ใช้ field รายจุดตามหัวข้อถัดไป

ตัวอย่างยื่นคำขอแก้เฉพาะข้อมูลติดต่อ:

```json
{
  "formType": "BASIC_INFO",
  "contactPersons": [{ "name": "ผู้ประสานงานใหม่", "phone": "0800000000", "email": null, "position": "วิศวกร" }],
  "notificationEmails": ["new@example.com"],
  "officerNotificationEmails": []
}
```

ทุก workflow response ที่มี edit-request DTO (create, list, detail, resubmission, review และ cancel) เพิ่ม `currentContacts` และ `proposedContacts` เป็น snapshot ณ รอบที่ยื่นล่าสุด:

| Field ในแต่ละ snapshot | Type | ความหมาย |
| --- | --- | --- |
| `systemType` | `CEMS` \| `WPMS` \| null | ระบบที่เลือก; `null` ภายใน object หมายถึงทั้งโรงงาน |
| `contactPersons` | object[] | รายชื่อผู้ติดต่อ ณ ฝั่งก่อน/หลัง ตาม `ContactPerson` |
| `notificationEmails` | string[] | อีเมลโรงงาน ณ ฝั่งก่อน/หลัง |
| `officerNotificationEmails` | string[] | รายชื่อเจ้าหน้าที่รวมในขอบเขตแบบไม่ซ้ำ; รายจุดยังเทียบด้วย `connectedPointId` ใน current/proposed measurement points |

ตัวอย่างส่วนข้อมูลเปรียบเทียบของ response:

```json
{
  "currentContacts": {
    "systemType": null,
    "contactPersons": [],
    "notificationEmails": ["old@example.com"],
    "officerNotificationEmails": ["officer@example.com"]
  },
  "proposedContacts": {
    "systemType": null,
    "contactPersons": [{ "name": "ผู้ประสานงานใหม่", "phone": "0800000000", "email": null, "position": "วิศวกร" }],
    "notificationEmails": ["new@example.com"],
    "officerNotificationEmails": []
  }
}
```

รายละเอียดคำขอยังคง 3 contact fields ที่ root เพื่อรองรับผู้เรียกเดิม โดยใช้ค่าจาก `proposedContacts` เมื่อมี snapshot. ฝั่งแสดงผลเปรียบเทียบให้อ่าน snapshot ทั้งสองฝั่ง ไม่ใช้ root เป็นค่าก่อนแก้ และไม่ใช้ข้อมูลโรงงานล่าสุดแทนประวัติ `/edit-requests/:id/form` ใช้ proposed contacts รวมถึง `[]` ที่ล้างไว้เมื่อ snapshot ครอบคลุมระบบที่เลือก

คำขอเก่าที่ไม่เคยเก็บ contact snapshots คืน `currentContacts: null` และ `proposedContacts: null` พร้อม root fields สำหรับแสดงบริบทตามเดิม; ห้ามตีความ `null` ว่าไม่มีผู้ติดต่อหรือไม่มีอีเมล คำขอจุดตรวจวัดข้ามระบบที่ไม่มี contact patch และระบุขอบเขตเดียวไม่ได้ก็คืน snapshot pair เป็น `null` โดยยังเก็บค่าก่อน–หลังอีเมลเจ้าหน้าที่รายจุด หากส่งคำขอเก่ากลับมาแก้ไขในสถานะ `REVISION_REQUESTED` ระบบจะสร้าง snapshot จากข้อมูลปัจจุบันสำหรับรอบใหม่เท่านั้น ไม่เติมประวัติย้อนหลัง

ก่อนอนุมัติข้อมูลที่ใช้งานอยู่ยังไม่เปลี่ยน เมื่ออนุมัติจะอัปเดตเฉพาะ contact fields ที่เปลี่ยนบน active `cems_wpms_connected_measurement_points` ภายใน transaction เดียวกับสถานะคำขอและ audit event ทั้ง legacy และ canonical mode ไม่เขียนทับ `cems_wpms_connection_requests` ต้นทาง. หากข้อมูลติดต่อไม่ตรงกับค่าที่จับไว้ก่อนยื่น ตอบ `409 CONFLICT` และ rollback ทั้งรายการ; create/resubmission ตรวจซ้ำใน transaction เช่นกัน. การปฏิเสธ ส่งกลับ หรือยกเลิกไม่เปลี่ยนข้อมูลติดต่อที่ใช้งานอยู่

สำหรับ backend: ต้องรัน migration [0117](../../../../../backend/src/db/migrations/0117_add_poms_contact_snapshots.ts) ก่อนใช้ code รุ่นนี้ เพิ่ม nullable live override และ contact snapshot columns โดยไม่ backfill ข้อมูลเก่า ทดสอบเส้นทาง capture/resubmit/approve/stale/rollback ใน [approval tests](../../../../../backend/tests/unit/poms-factories.general-info-approval.test.ts), [canonical tests](../../../../../backend/tests/unit/poms-factories.canonical-profiles.repository.test.ts) และ [service tests](../../../../../backend/tests/unit/poms-factories.service.test.ts)

### เพิ่ม/แก้ไขอีเมลสำหรับแจ้งเตือนเจ้าหน้าที่

ใช้ API เดิม `POST /api/v1/poms-factories/:factoryId/edit-requests` และ `PUT /api/v1/poms-factories/edit-requests/:id/resubmission` เมื่อต้องการกำหนดรายชื่อแยกแต่ละจุด ให้ส่ง **ภายในแต่ละ `measurementPoints[]`** ส่วนการกำหนดรายชื่อทั้งขอบเขตให้ใช้ root field ตาม [ข้อมูลติดต่อ](#contact-comparison):

```json
{
  "formType": "MEASUREMENT_POINTS",
  "measurementPoints": [
    {
      "connectedPointId": 15,
      "officerNotificationEmails": ["officer@example.go.th"]
    }
  ]
}
```

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `measurementPoints[].officerNotificationEmails` | string[] | no | สูงสุด 20 รายการ; อีเมลไม่เกิน 254 ตัวอักษร; trim, lowercase และตัดซ้ำ; ไม่ส่งคงเดิม, `[]` ล้างรายชื่อ, `null` และอีเมลผิดรูปแบบตอบ 400 |

แก้เฉพาะอีเมลได้โดยส่งคู่กับ `connectedPointId` ไม่ต้องส่งชื่อหรือรายละเอียดจุดใหม่ รายชื่อเป็นการแทนที่ทั้งชุดของจุดที่เลือก หากต้องการเพิ่มอีเมลให้ส่งรายชื่อเดิมรวมกับรายการใหม่ จุดอื่นคงค่าเดิม และไม่แก้รายชื่อกลางจังหวัด/นิคม

Frontend ใช้ `GET /poms-factories/:factoryId` อ่าน `data.measurementPoints[].officerNotificationEmails` ของจุดที่เลือก แล้วส่ง field นี้กลับใน point patch; ใช้ `connectedPointId` จาก detail เดียวกัน ส่วน `/form` ยังใช้ shared form shape และคืน `officerNotificationEmails` ที่ root เป็นรายชื่อรวมแบบไม่ซ้ำของจุดใน `systemType` ที่เลือก จึงไม่ควรนำรายชื่อรวมไปเขียนทับทุกจุดอัตโนมัติ

ตัวอย่าง response ส่วนจุดตรวจวัดหลังอนุมัติ:

```json
{
  "connectedPointId": 15,
  "officerNotificationEmails": ["officer@example.go.th"]
}
```

ก่อนอนุมัติ `GET /poms-factories/:factoryId` และ `/form` ยังคงค่าปัจจุบัน ขณะที่ `GET /poms-factories/edit-requests/:id` คืนค่าก่อน/หลังใน `currentMeasurementPoints[].officerNotificationEmails` และ `proposedMeasurementPoints[].officerNotificationEmails`; root `officerNotificationEmails` ของคำขอและ `/edit-requests/:id/form` ใช้รายชื่อ proposed ของระบบที่แก้ไข คำขอเก่าที่ไม่มี field นี้ยังอ่านได้และไม่ล้างอีเมลตอนอนุมัติ

เมื่อ admin อนุมัติ จะบันทึก `cems_wpms_connected_measurement_points.officer_notification_emails_json` พร้อมการอนุมัติใน transaction เดียวกัน โดยไม่เขียนทับ snapshot คำขอเชื่อมต่อเดิม ค่า `NULL` ในจุดที่ยังไม่เคยตั้งค่าให้อ่านจาก source request ของจุดนั้น ส่วน JSON `[]` เป็นการล้างโดยชัดเจนและไม่ fallback กลับไปอีเมลเดิม การบันทึกรายชื่อไม่ส่งอีเมลทันที และไม่เปลี่ยน trigger/ระบบส่งการแจ้งเตือน

`GET /poms-factories` รวมรายชื่อ current ของ active points ในแต่ละโรงงานแบบไม่ซ้ำ สิทธิ์เข้าถึง การตรวจเจ้าของคำขอ การอนุมัติโดย admin และการปฏิเสธข้อมูลที่เปลี่ยนหลังสร้าง snapshot ยังคงใช้กติกาเดิม

### เปลี่ยนพารามิเตอร์หลังอนุมัติ

ใช้ `measurementPoints[].details.requestedParameters` เป็นรายการเป้าหมาย เช่น BOD/COD/Watt → BOD/Watt/Flow โดยยังห้ามส่ง `measurementPoints[].parameters` ตรง ๆ ฟิลด์นี้ต้องเป็น `string[]` ไม่เกิน 100 รายการ ชื่อไม่เกิน 255 ตัวอักษร ไม่ว่างและไม่ซ้ำหลัง normalize ตัวพิมพ์/ช่องว่าง; ห้าม `null`, `ไม่มี` และ `ได้รับการยกเว้นทั้งหมด` ใช้ `[]` หากต้องล้างทั้งหมด ส่วน omission หรือ `details: null` คงพารามิเตอร์หลักเดิม

```json
{
  "formType": "MEASUREMENT_POINTS",
  "measurementPoints": [{
    "connectedPointId": 15,
    "details": { "requestedParameters": ["BOD (mg/l)", "Watt (kW/hr)", "Flow rate (m3/hr)"] }
  }]
}
```

เมื่ออนุมัติ backend เขียน `parameters_json` พร้อม metadata ของเครื่องมือใน transaction เดียวกับ status/event และเลิกใช้ channel รวมถึง status schedule ของพารามิเตอร์ที่ถอดออก เฉพาะ config ปัจจุบัน (`request_id IS NULL`) คง address/range/encoding ของพารามิเตอร์ที่ยังอยู่ และคง request/device snapshots เดิมไว้ ไม่มีการนำ Address ID ของ COD ไปตั้งเป็น Flow อัตโนมัติ

ฟอร์ม [ตั้งค่าอุปกรณ์ปัจจุบัน](../connection-requests/device-configs.md#พารามิเตอร์หลังอนุมัติคำขอแก้ไขจุดตรวจวัด) แสดง Flow เป็น mapping ที่ `addressId = ""` จนผู้ใช้ตั้งค่าจริง Integration ส่งเฉพาะ channel ที่บันทึกแล้ว

#### ซ่อมคำขอที่อนุมัติก่อนแก้บั๊ก

การ deploy ไม่เปลี่ยนข้อมูลคำขอที่อนุมัติไปแล้ว ใช้ [maintenance script](../../../../../backend/scripts/repair-approved-poms-parameters.ts) บนเครื่องที่เข้าถึงฐานข้อมูลได้ โดยค่าเริ่มต้นเป็น dry-run:

```bash
npx tsx scripts/repair-approved-poms-parameters.ts --factory 10100000125241 --request-no point-00001/2569
```

ตรวจผล `before`/`after` ก่อนใช้ `--apply --actor-id USER_ID` โดย `USER_ID` ต้องเป็นผู้ดำเนินการจริง Script ทำงานเฉพาะคำขอ `APPROVED` แบบจุดตรวจวัดของโรงงานที่ระบุ ปฏิเสธเมื่อมีคำขออนุมัติใหม่กว่า, live data เปลี่ยนหลังอนุมัติ หรือไม่ตรง snapshot และไม่เขียนชื่อ/ที่อยู่/รายละเอียดอื่นย้อนหลัง การรันซ้ำเมื่อ parameters ตรงแล้วเป็น no-op เก็บ stdout ของการ apply เป็นหลักฐานการซ่อม; ฐานข้อมูลบันทึกผู้แก้ใน `updated_by` โดยคงประวัติคำขอเดิม

### `POST /api/v1/poms-factories/:factoryId/edit-requests`

สร้างคำขอ `PENDING_REVIEW` โดยเก็บ snapshot ตาม `formType` หนึ่งโรงงานมี open request ได้ครั้งละหนึ่งรายการต่อ `formType` response ใช้ workflow snapshot contract หลัก; ส่วน [edit-request detail](#get-apiv1poms-factoriesedit-requestsid) เพิ่มข้อมูลผู้ติดต่อและอีเมลแจ้งเตือนสำหรับหน้าเปรียบเทียบ

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

คืนรายการคำขอที่อยู่ใน `factories:view` data scope ของผู้เรียก เรียงใหม่ก่อน โดยสมาชิกใน `data[]` ใช้ workflow snapshot contract หลัก; ข้อมูลผู้ติดต่อและอีเมลแจ้งเตือนโหลดเพิ่มเฉพาะ [edit-request detail](#get-apiv1poms-factoriesedit-requestsid)

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

คืน current/proposed snapshot, ข้อมูลผู้ติดต่อ, อีเมลแจ้งเตือน, workflow events และ audit metadata ของคำขอเดียว

`events[].actorName` คืนชื่อผู้ทำ action จาก `users.first_name` และ `users.last_name` ณ เวลาอ่าน โดย trim แต่ละส่วนแล้วเชื่อมส่วนที่มีค่าด้วยช่องว่างหนึ่งตัว ถ้ามีเพียงชื่อหรือนามสกุลให้ใช้ส่วนที่มีค่า ถ้าไม่มีชื่อทั้งสองส่วนหรือไม่พบผู้ใช้ให้คืน `null` โดยยังคง event และ `actorUserId` เดิม ชื่อนี้ไม่ใช่ snapshot และอาจเปลี่ยนตามข้อมูลผู้ใช้ กติกานี้ใช้กับทุก response ที่คืน edit-request events รวมถึง list, create, resubmission, review และ cancel

`factoryRegistrationNo` เป็นเลขสำหรับแสดงผล โดยใช้เลขทะเบียนเดิมจาก active `eligible_factories.factory_registration_no_old` ก่อน ถ้าค่าเป็น `null` หรือว่างให้ใช้เลขทะเบียนใหม่ `factory_registration_no_new`; ถ้าไม่มี metadata ให้คงเลขที่บันทึกในคำขอ กติกาเดียวกันใช้กับ `currentFactory.factoryRegistrationNo` และ `proposedFactory.factoryRegistrationNo` รวมถึงคำขอเก่าที่เคยบันทึกเลขใหม่ ทั้งนี้ `factoryId` ไม่เปลี่ยน และไม่ได้เขียนทับ JSON snapshots หรือ events ในฐานข้อมูล ข้อมูลก่อน/หลังอื่นยังคงตาม snapshot เดิม

`currentFactory` และ `proposedFactory` ยังคง profile response ที่มีชื่อ ที่อยู่ และ identity fields เพื่อแสดงบริบท; การมี field ใน response ไม่ทำให้ field นั้นแก้ไขได้ สำหรับ `BASIC_INFO` ที่สร้างหรือ resubmit ภายใต้ contract นี้ ชื่อและที่อยู่ใน proposed snapshot คงค่าปัจจุบัน ส่วนคำขอเก่าอาจยังมี proposed ชื่อ/ที่อยู่เดิมในประวัติ แต่ approval จะไม่เขียนสอง field นี้

สำหรับ `MEASUREMENT_POINTS` ฝั่ง `currentMeasurementPoints[].details.connectedParameters` และ `requestedParameters` ยึดรายการที่เชื่อมต่อจริงจาก `currentMeasurementPoints[].parameters` ซึ่ง snapshot มาจาก active `cems_wpms_connected_measurement_points.parameters_json`; `pendingParameters` คำนวณเป็น `eligibleParameters - connectedParameters` ส่วน `proposedMeasurementPoints[].details` คงค่าที่ผู้ใช้ส่งมากับคำขอแก้ไข จึงแสดงก่อน/หลังต่างกันเมื่อรายการพารามิเตอร์เปลี่ยน

`contactPersons`, `notificationEmails` และ `officerNotificationEmails` ที่ root ใช้ `proposedContacts` เมื่อมี snapshot ตาม [ข้อมูลเปรียบเทียบก่อน–หลัง](#contact-comparison). สำหรับคำขอเก่า contact arrays ใช้ข้อมูลปัจจุบันเพื่อเป็นบริบทเท่านั้น ส่วน `informationProviderName` และ `informationProviderPosition` อ่านจาก source connection request หลังคำขอผ่าน `factories:view` data scope โดยใช้ชื่อและตำแหน่งจาก source row เดียวกัน: `BASIC_INFO` ใช้ source ล่าสุดของโรงงานข้าม CEMS/WPMS (เรียง `req.created_at DESC, req.id DESC`); `MEASUREMENT_POINTS` ใช้ source ล่าสุดของระบบที่แก้ไขตาม snapshots ถ้าระบุระบบเดียวไม่ได้ให้คืน arrays เป็น `[]` และ provider เป็น `null` แทนการเลือกระบบใดระบบหนึ่ง

ข้อมูลผู้ให้ข้อมูล (`informationProviderName`/`informationProviderPosition`) เป็นบริบทจากคำขอเชื่อมต่อที่ผูกกับ active POMS point ปัจจุบัน ไม่ใช่ snapshot ผู้ลงนามของคำขอแก้ไขและอาจเปลี่ยนเมื่อ source เปลี่ยน ถ้าต้นทางไม่มีข้อมูลผู้ให้ข้อมูลจะคืนสอง field เป็น `null` โดยไม่แทนด้วยผู้ติดต่อหรือผู้สร้างคำขอ

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
| `data.factoryRegistrationNo` | string                                                                | no       | เลขทะเบียนเดิมก่อนเลขใหม่ตามกติกาข้างต้น |
| `data.factoryName`           | string                                                                | no       | ชื่อโรงงานใน proposed profile                                                    |
| `data.formType`              | `BASIC_INFO` \| `MEASUREMENT_POINTS`                                  | no       | ประเภทแบบฟอร์มของคำขอ                                                           |
| `data.revisionNo`            | number                                                                | no       | รอบแก้ไข เริ่มที่ `0` และเพิ่มเมื่อ resubmit                                     |
| `data.isOpen`                | boolean                                                               | no       | `true` สำหรับสถานะที่ workflow ยังไม่สิ้นสุด                                     |
| `data.status`                | string                                                                | no       | workflow status code                                                             |
| `data.statusLabel`           | string                                                                | no       | label สำหรับแสดงผล                                                               |
| `data.requestNote`           | string                                                                | yes      | หมายเหตุผู้ส่ง; `BASIC_INFO` ที่สร้างหรือ resubmit ภายใต้ contract นี้เป็น `null` |
| `data.revisionReason`        | string                                                                | yes      | เหตุผลที่เจ้าหน้าที่ขอแก้ไข                                                      |
| `data.officerNote`           | string                                                                | yes      | หมายเหตุการพิจารณา                                                               |
| `data.currentContacts` | object \| null | yes | snapshot ผู้ติดต่อและอีเมลก่อนส่งคำขอรอบล่าสุด; โครงสร้างตาม [contact comparison](#contact-comparison) |
| `data.proposedContacts` | object \| null | yes | snapshot ผู้ติดต่อและอีเมลที่เสนอ; `null` เมื่อไม่มีหลักฐาน snapshot |
| `data.currentFactory`        | object                                                                | no       | snapshot ก่อนส่งคำขอรอบล่าสุด                                                    |
| `data.proposedFactory`       | object                                                                | no       | snapshot ที่เสนอแก้ไขรอบล่าสุด                                                   |
| `data.currentMeasurementPoints`  | object[]                                                           | yes      | snapshot จุดตรวจวัดก่อนแก้; กลุ่มพารามิเตอร์ current derive จาก `parameters`; เป็น `null` สำหรับ `BASIC_INFO` |
| `data.proposedMeasurementPoints` | object[]                                                           | yes      | snapshot จุดตรวจวัดที่เสนอ โดยคง `details.*Parameters` ตามคำขอ; เป็น `null` สำหรับ `BASIC_INFO` |
| `data.contactPersons`            | object[]                                                           | no       | `proposedContacts.contactPersons`; คำขอเก่า fallback live/source หรือ `[]` |
| `data.informationProviderName` | string | yes | ชื่อผู้ให้ข้อมูลหรือผู้รับมอบอำนาจจาก source connection request; `null` เมื่อไม่มีข้อมูล |
| `data.informationProviderPosition` | string | yes | ตำแหน่งจาก source row เดียวกับชื่อ; `null` เมื่อไม่มีข้อมูล |
| `data.notificationEmails`        | string[]                                                           | no       | `proposedContacts.notificationEmails`; คำขอเก่า fallback live/source หรือ `[]`                                       |
| `data.officerNotificationEmails` | string[]                                                           | no       | `proposedContacts.officerNotificationEmails`; คำขอเก่าใช้ proposed points แล้ว fallback source หรือ `[]`                                  |
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
| `data.events[].actorName`    | string                                                                | yes      | ชื่อผู้ทำ action ณ เวลาอ่าน; คืน field เสมอ โดยใช้ `null` เมื่อไม่มีชื่อหรือไม่พบผู้ใช้ |
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
    "contactPersons": [],
    "notificationEmails": [],
    "officerNotificationEmails": [],
    "informationProviderName": null,
    "informationProviderPosition": null,
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
        "actorName": "สมชาย ใจดี",
        "createdAt": "2026-08-24T03:00:00.000Z"
      }
    ],
    "createdAt": "2026-08-24T02:00:00.000Z",
    "updatedAt": "2026-08-24T03:00:00.000Z"
  }
}
```

ตัวอย่างส่วนเปรียบเทียบพารามิเตอร์ของ `MEASUREMENT_POINTS`:

```json
{
  "contactPersons": [
    {
      "name": "ผู้ประสานงานโรงงาน",
      "phone": "0812345678",
      "email": "contact@example.com",
      "position": "ผู้จัดการสิ่งแวดล้อม"
    }
  ],
  "notificationEmails": ["factory-alert@example.com"],
  "officerNotificationEmails": ["officer-alert@example.go.th"],
  "currentMeasurementPoints": [
    {
      "details": {
        "connectedParameters": ["BOD (mg/l)", "COD (mg/l)", "Watt (kW/hr)"],
        "pendingParameters": ["Flow rate (m3/hr)"],
        "requestedParameters": ["BOD (mg/l)", "COD (mg/l)", "Watt (kW/hr)"]
      }
    }
  ],
  "proposedMeasurementPoints": [
    {
      "details": {
        "connectedParameters": ["BOD (mg/l)", "Watt (kW/hr)", "Flow rate (m3/hr)"],
        "pendingParameters": ["COD (mg/l)"],
        "requestedParameters": ["BOD (mg/l)", "Watt (kW/hr)", "Flow rate (m3/hr)"]
      }
    }
  ]
}
```

### `GET /api/v1/poms-factories/edit-requests/:id/form`

คืน `data` ด้วย shared form contract เดียวกับ [Connection-request form prefill](../connection-requests/README.md#connection-request-form-prefill) แต่ overlay proposed values ของคำขอแก้ไขบน current/live POMS: `BASIC_INFO` ใช้เฉพาะ 7 editable fields จาก proposed factory profile โดยชื่อ ที่อยู่ และข้อมูลอ่านอย่างเดียวยึด current/live รวมถึงเมื่อเปิดคำขอเก่า; `MEASUREMENT_POINTS` ใช้ proposed measurement points และใช้ 7 editable fields จาก proposed factory profile เมื่อมีการแก้ข้อมูลทั่วไป; ถ้าแก้เฉพาะจุดใช้ข้อมูลทั่วไป current/live และทั้งสองแบบใช้ `requestNote` เป็น `remarks` (`BASIC_INFO` ที่สร้างหรือ resubmit ภายใต้ contract นี้คืน `null`)

endpoint edit-request form ใช้ผู้ติดต่อและอีเมลจาก `proposedContacts` เมื่อ snapshot ครอบคลุม `systemType` ที่เลือก โดยคง `[]` ที่ล้างไว้; คำขอเก่า fallback เช่นเดียวกับ factory form. `informationProviderName`/`informationProviderPosition` อ่านจากคำขอเชื่อมต่อต้นทางล่าสุด; ถ้าไม่มีต้นทางใช้ `""`, `[]` หรือ `null` ตาม shared contract ส่วน proposed values ของจุดตรวจวัดยังคงเดิม และไม่คืน `id`, `requestNo`, `status`, `revisionReason` หรือ audit metadata ใน `data`

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
    "informationProviderName": null,
    "informationProviderPosition": null,
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

ยกเลิกได้เมื่อสถานะปัจจุบันเป็น `PENDING_REVIEW`, `REVISION_REQUESTED`, `REVISED_PENDING_REVIEW` หรือ `REJECTED` ยกเว้น `APPROVED` และ `CANCELLED` หลังสำเร็จสถานะเป็น `CANCELLED`, `statusLabel = "ยกเลิก"`, `isOpen = false` และเพิ่ม event `CANCEL` การตอบกลับเป็น full [`PomsFactoryEditRequestResponse`](#get-apiv1poms-factoriesedit-requestsid) ไม่ใช่ summary object

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
        "actorName": "สมหญิง รักษ์สิ่งแวดล้อม",
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

เมื่อพิจารณาสำเร็จ response ใช้ detail contract เดียวกับ `GET /api/v1/poms-factories/edit-requests/:id` จึงคืน `contactPersons`, `notificationEmails`, `informationProviderName` และ `informationProviderPosition` ที่ hydrate จาก source connection request แล้วด้วย

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
    "contactPersons": [],
    "notificationEmails": [],
    "officerNotificationEmails": [],
    "informationProviderName": "สมหญิง ใจดี",
    "informationProviderPosition": "ผู้รับมอบอำนาจ",
    "reviewedBy": 77,
    "reviewedAt": "2026-08-24T05:00:00.000Z",
    "updatedAt": "2026-08-24T05:00:00.000Z"
  }
}
```

หลัง `APPROVE` สำเร็จ ให้ refresh ข้อมูลโรงงานด้วย `GET /api/v1/poms-factories/:factoryId` หรือฟอร์มด้วย `GET /api/v1/poms-factories/:factoryId/form` เพื่ออ่านค่าปัจจุบัน ห้ามใช้ `currentFactory` ของรายละเอียดคำขอแทนข้อมูลโรงงานล่าสุด เพราะเป็น snapshot ก่อนแก้ไขที่ต้องเก็บไว้เพื่อเปรียบเทียบกับ `proposedFactory` แม้สถานะเป็น `APPROVED` แล้ว การพิจารณาแบบ `REQUEST_REVISION` หรือ `REJECT` จะไม่เปลี่ยนข้อมูลโรงงานจริง

## Workflow, Concurrency And Idempotency

การเปิดใช้ cancellation จาก `REJECTED` ต้องรัน migration `0111_allow_rejected_poms_factory_edit_request_cancellation.ts` ด้วย เพื่อให้ audit constraint ยอมรับ `REJECTED → CANCELLED` โดยยังตรวจผู้สร้างคำขอและล็อกสถานะก่อนบันทึก การ rollback จะถูกปฏิเสธหากมีประวัติ transition ใหม่นี้แล้ว

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
| `PENDING_REVIEW`, `REVISION_REQUESTED`, `REVISED_PENDING_REVIEW` หรือ `REJECTED` | ผู้สร้างคำขอ (`createdBy`) | `CANCEL` | `CANCELLED` | ปิดคำขอโดยไม่แก้ข้อมูล current/live |
| `PENDING_REVIEW` หรือ `REVISED_PENDING_REVIEW` | admin                  | `APPROVE`          | `APPROVED`               | sync ข้อมูลจริงแบบ atomic ตาม `formType`                    |
| `PENDING_REVIEW` หรือ `REVISED_PENDING_REVIEW` | admin                  | `REJECT`           | `REJECTED`               | ปิดคำขอโดยไม่แก้ข้อมูลจริง                                   |

ใน canonical mode `BASIC_INFO` เขียนข้อมูลทั่วไปหลักและประวัติ revision ใน transaction เดียวกับ approval พร้อมอัปเดตสำเนาสำหรับรองรับระบบเดิมตามตารางด้านล่าง; ตารางนี้เป็น compatibility projection ไม่ใช่หลายแหล่งหลัก. ใน legacy mode ใช้ตารางเดิมตาม mapping นี้โดยตรง. ใช้ allowlist เดิมรวมถึงการอนุมัติคำขอเก่าที่ยังรอพิจารณา:

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
- ใน legacy mode source timestamp คงความละเอียดระดับมิลลิวินาทีตั้งแต่ create/resubmission; คำขอเก่าที่เวลาในฐานข้อมูลถูกปัดแบบ SQL `DATETIME` จะใช้ `currentFactory.updatedAt` ใน snapshot เดิมได้เฉพาะเมื่อ source timestamp ตรงกับผลการปัดเวลานั้น และยังต้องตรงกับ current/live ทุกมิลลิวินาที จึงอนุมัติคำขอที่ค้างได้โดยไม่ต้องสร้างหรือส่งคำขอใหม่ หากเวลาเปลี่ยนจริงยังตอบ `409 CONFLICT`; snapshot เก่าที่ไม่มีเวลาที่ใช้ได้ยังตรวจ source timestamp เดิมแบบตรงกันเท่านั้น
- approval ทำ target updates ตาม `formType` แบบ atomic; `BASIC_INFO` ไม่เขียน `factory_name`, `factory_address` หรือ `eligible_factories.address` แม้ proposed snapshot ของคำขอเก่ามีค่าที่ต่างออกไป; ตาราง `factories` ไม่ใช่เป้าหมายของ workflow นี้
- ถ้าคำขอ `MEASUREMENT_POINTS` เปลี่ยนข้อมูลทั่วไปด้วย จะตรวจ source profile version และ sync ข้อมูลทั่วไปไป active connected rows ทุกจุดและ active `eligible_factories` ตาม mapping ของ `BASIC_INFO` ใน transaction เดียวกับจุดตรวจวัด หากเปลี่ยนเฉพาะจุดจะไม่เขียนข้อมูลทั่วไปจาก snapshot เก่าทับ live data; หากส่วนใดล้มเหลวให้ rollback ทั้งคำขอ
- เมื่อ `formType = "MEASUREMENT_POINTS"` backend อัปเดตข้อมูลจุดใน active `cems_wpms_connected_measurement_points` ของโรงงานนั้น ได้แก่ `point_name`, `monitoring_point_status`, `details_json`, `documents_json`, `instruments_json` และ `officer_notification_emails_json`

## Errors

ทุก endpoint ใช้ [shared success/error envelope](../../shared/common-api/README.md#shared-response-shape)

| HTTP status | `error.code`       | Condition                                                                                                                                  | Client action                                   |
| ----------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `400`       | `VALIDATION_ERROR` | path/query/body ไม่ตรง strict schema, `BASIC_INFO` ไม่มี editable field, พิกัดไม่ส่งเป็นคู่, `eiaOther` ผิดเงื่อนไข หรือมี field นอก allowlist                                | แสดง validation ตาม `error.issues[].pathString` |
| `400`       | `FILE_UPLOAD_FAILED` | multipart upload เกิน limit เช่นไฟล์เกิน 5 MiB หรือส่งไฟล์/part เกินจำนวน                                                            | แสดงข้อผิดพลาดอัปโหลดและให้เลือกไฟล์ใหม่        |
| `400`       | `BAD_REQUEST`      | แก้ข้อมูลติดต่อโดยเลือกจุดข้าม CEMS/WPMS, upload ไม่ส่งไฟล์ ไฟล์ว่าง MIME/นามสกุล/signature ไม่ตรง หรือ `link` ไม่ใช่ absolute `http`/`https` URL                                | แก้ไฟล์หรือ metadata แล้วส่งใหม่                 |
| `401`       | `UNAUTHORIZED`     | token ไม่มี/หมดอายุ/ไม่ถูกต้อง                                                                                                             | login ใหม่                                      |
| `403`       | `FORBIDDEN`        | ไม่มี action permission, ผู้ยกเลิกไม่ใช่ `createdBy`, reviewer ไม่ใช่ admin หรือผู้พิจารณาซ้ำกับ `createdBy`/`submittedBy`                  | ซ่อน action หรือใช้ผู้ทำรายการที่ถูกต้อง         |
| `404`       | `NOT_FOUND`        | ไม่พบโรงงาน/คำขอ หรือ resource อยู่นอก effective data scope ของ endpoint (`factories:view`, `factories:edit`, หรือ `factories:approve`)    | กลับหน้ารายการและ refresh                       |
| `409`       | `INVALID_STATUS_TRANSITION` | cancel เมื่อสถานะไม่ใช่ `PENDING_REVIEW`, `REVISION_REQUESTED`, `REVISED_PENDING_REVIEW` หรือ `REJECTED`                                      | refresh detail และซ่อนปุ่มยกเลิก                 |
| `409`       | `CONFLICT`         | ไม่มีข้อมูลที่แก้ไขเปลี่ยน, ข้อมูลติดต่อเปลี่ยนหลังยื่นคำขอ, มี open request อยู่แล้ว, transition อื่นไม่รองรับ, source version/revision เปลี่ยน, canonical profile ยังไม่พร้อม, request ถูกพิจารณาพร้อมกัน หรือเลขคำขอของประเภทและปีนั้นครบ `99999` | refresh detail และตัดสินใจจากสถานะล่าสุด; ถ้าเลขครบให้ติดต่อผู้ดูแล        |

## Business Flow And Explanations

- [Connected factory profile sync workflow](../../../../../workflows/connected-factory-profile-sync.md)
- [จุดตรวจวัดที่เชื่อมต่อแล้ว](../../shared/connected-measurement-points/README.md)
- [นิยามโรงงาน current/live และโรงงานที่เข้าข่าย](../eligible-factories/README.md)

## Backend Maintainer Map

การอ่าน contact snapshot ภายใน transaction ต้องผูก `WITH (UPDLOCK)` กับชื่อ/alias ของตารางทั้ง connected points และ source requests ก่อน `JOIN ... ON`. ห้ามใช้ Knex MSSQL `.forUpdate()` กับ query นี้ เพราะจะสร้าง hint หลังเงื่อนไข `ON` ทำให้ SQL Server ปฏิเสธคำสั่งและคำขอตอบ 500. ตรวจ SQL ที่ compile จริงด้วย [contact lock regression tests](../../../../../backend/tests/unit/poms-factories.profile-lock.repository.test.ts) ควบคู่กับ transaction mocks; การแก้ lock ไม่เปลี่ยน API payload หรือ contact comparison contract

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
| Migrations             | [`0100_create_poms_factory_edit_requests.ts`](../../../../../backend/src/db/migrations/0100_create_poms_factory_edit_requests.ts), [`0106_extend_poms_factory_edit_requests_for_measurement_points.ts`](../../../../../backend/src/db/migrations/0106_extend_poms_factory_edit_requests_for_measurement_points.ts), [`0107_enforce_admin_only_factory_approval.ts`](../../../../../backend/src/db/migrations/0107_enforce_admin_only_factory_approval.ts), [`0109_add_poms_factory_edit_request_cancellation.ts`](../../../../../backend/src/db/migrations/0109_add_poms_factory_edit_request_cancellation.ts), [`0111_allow_rejected_poms_factory_edit_request_cancellation.ts`](../../../../../backend/src/db/migrations/0111_allow_rejected_poms_factory_edit_request_cancellation.ts) |
| Tests                  | [`poms-factories.route.test.ts`](../../../../../backend/tests/unit/poms-factories.route.test.ts), [`poms-factories.service.test.ts`](../../../../../backend/tests/unit/poms-factories.service.test.ts), [`poms-factories.repository.test.ts`](../../../../../backend/tests/unit/poms-factories.repository.test.ts), [`poms-factories.registration.test.ts`](../../../../../backend/tests/unit/poms-factories.registration.test.ts), [`poms-factories.cancel.service.test.ts`](../../../../../backend/tests/unit/poms-factories.cancel.service.test.ts), [`poms-factories.cancel.repository.test.ts`](../../../../../backend/tests/unit/poms-factories.cancel.repository.test.ts), [`poms-factory-document-upload.route.test.ts`](../../../../../backend/tests/unit/poms-factory-document-upload.route.test.ts), [`poms-measurement-point-edit-requests.validator.test.ts`](../../../../../backend/tests/unit/poms-measurement-point-edit-requests.validator.test.ts), [`poms-measurement-point-edit-requests.migration.test.ts`](../../../../../backend/tests/unit/poms-measurement-point-edit-requests.migration.test.ts), [`factory-approval-admin-only-migration.test.ts`](../../../../../backend/tests/unit/factory-approval-admin-only-migration.test.ts), [`poms-factory-edit-request-cancellation-migration.test.ts`](../../../../../backend/tests/unit/poms-factory-edit-request-cancellation-migration.test.ts), [`poms-factories.openapi.test.ts`](../../../../../backend/tests/unit/poms-factories.openapi.test.ts) |
| Evidence               | [POMS factory form contact prefill TDD](../../../evidence/master-data/poms-factory-form-contact-prefill.tdd.md), [POMS factory form current parameter semantics TDD](../../../evidence/master-data/poms-factory-form-current-parameters.tdd.md) |

Breaking change ด้าน editable fields ของ `BASIC_INFO` ถูกบันทึกใน [API changelog](../../CHANGELOG.md#2026-09-05--จำกัด-basic_info-ให้แก้ได้เฉพาะ-7-fields)

Breaking change ด้านสิทธิ์ review ถูกบันทึกใน [API changelog](../../CHANGELOG.md#2026-09-01--เพิ่ม-2-แบบฟอร์มคำขอแก้ไขข้อมูลพื้นฐานจาก-poms-และจำกัดผู้อนุมัติเป็น-admin)

### สถานะบริหารในข้อมูลโรงงาน current/live

GET รายละเอียดส่ง `status`, `visibility`, `connectionStatus`, `effectiveVisibility`, `effectiveConnectionStatus` ทั้งระดับโรงงานและจุดตรวจวัด ดู [สัญญาสถานะบริหาร](./status-management.md) ใช้ status สำหรับ dialog รายการจุดตรวจวัด ส่วน monitoringPointStatus เป็นขั้นตอนเชื่อมต่อเดิม ไม่รับ fields สถานะบริหารใหม่ในคำขอแก้ไขข้อมูลโรงงาน
