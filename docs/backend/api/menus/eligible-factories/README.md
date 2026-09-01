# โรงงานที่เข้าข่าย

> Owner: Backend

## Frontend Quick Start

คู่มือสำหรับต่อ UI เอกสารแนบโดยตรง: [Frontend attachment integration](./frontend-attachment-integration.md)

อ่านรายการโรงงานที่ถูกเลือกเป็นโรงงานเข้าข่าย:

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/eligible-factories' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

เมื่อต้องแนบเอกสารกับจุดตรวจวัด:

1. อัปโหลดไฟล์ทีละไฟล์ด้วย `POST /api/v1/monitoring-point-forms/attachments`.
2. เก็บ `data.uploadToken` และส่ง `{ "uploadToken": "<UPLOAD_TOKEN>" }` ใน `points[].attachments[]` ตอนสร้างหรือแก้ไขฟอร์ม; ห้ามส่ง metadata หรือ URL ของไฟล์กลับมาเอง.
3. สำหรับไฟล์ที่ผูกกับฟอร์มแล้ว ให้ส่ง `{ "id": <ATTACHMENT_ID> }` เมื่อต้องการคงไฟล์ไว้ในการแทนที่รายการ และใช้ `fileUrl` ที่ API คืนเป็น signed relative URL สำหรับเปิดไฟล์.
4. ส่ง URL เอกสารภายนอกเพิ่มเติมแยกใน `points[].attachmentLinks[]`.

ความหมายของ `eligible_factories:view`, `eligible_factories:edit`, `eligible_factories:approve`, `cems_wpms_requests:view`, `cems_wpms_requests:edit` และ data scope ที่เกี่ยวข้องอ้างตาม [สิทธิ์การใช้งาน](../permissions/README.md)

## Endpoint Summary

| งาน | Method | Path | Auth | Permission |
| --- | --- | --- | --- | --- |
| รายการ candidate | `GET` | `/api/v1/eligible-factories/candidates` | Bearer | `eligible_factories:view` |
| ข้อมูลต้นทาง Fac60k รายโรงงาน | `GET` | `/api/v1/eligible-factories/source-factories/:factoryRegistrationNo` | Bearer | `eligible_factories:view` |
| รายการโรงงานที่เข้าข่าย | `GET` | `/api/v1/eligible-factories` | Bearer | `eligible_factories:view` |
| รายการคำขอเพิ่มโรงงาน | `GET` | `/api/v1/eligible-factories/add-requests` | Bearer | `eligible_factories:view` |
| ผู้ประกอบการส่งคำขอเพิ่มโรงงาน | `POST` | `/api/v1/eligible-factories/add-requests` | Bearer | `factories:view` + `factories:edit` (ต้องมีครบ) |
| เจ้าหน้าที่พิจารณาคำขอเพิ่มโรงงาน | `POST` | `/api/v1/eligible-factories/add-requests/:id/review` | Bearer | `eligible_factories:view` + `eligible_factories:approve` (ต้องมีครบ) |
| เลือกโรงงานเข้าข่าย | `POST` | `/api/v1/eligible-factories` | Bearer | `eligible_factories:edit` |
| ถอดโรงงานออกจากเข้าข่าย | `DELETE` | `/api/v1/eligible-factories/:id` | Bearer | `eligible_factories:edit` |
| รายการฟอร์มข้อมูลจุดตรวจวัด | `GET` | `/api/v1/monitoring-point-forms` | Bearer | `cems_wpms_requests:view` |
| รายละเอียดฟอร์มข้อมูลจุดตรวจวัด | `GET` | `/api/v1/monitoring-point-forms/:id` | Bearer | `cems_wpms_requests:view` |
| อัปโหลดเอกสารแนบของจุดตรวจวัด | `POST` | `/api/v1/monitoring-point-forms/attachments` | Bearer | `cems_wpms_requests:edit` |
| เปิดเนื้อหาเอกสารแนบ | `GET` | `/api/v1/monitoring-point-forms/attachments/:publicId/content` | Signed URL | - |
| เพิ่มข้อมูลจุดตรวจวัด | `POST` | `/api/v1/monitoring-point-forms` | Bearer | `cems_wpms_requests:edit` |
| แก้ไขข้อมูลจุดตรวจวัด | `PUT` | `/api/v1/monitoring-point-forms/:id` | Bearer | `cems_wpms_requests:edit` |
| เลือกฟอร์มเป็นโรงงานเข้าข่าย | `POST` | `/api/v1/monitoring-point-forms/:id/select-eligible` | Bearer | `eligible_factories:approve` |

รายการและ candidate ถูกกรองตาม data scope ของผู้เรียก: `ALL`, `IN_REGION`, `IN_PROVINCE`, `IN_ESTATE`, `OWN_FACTORY` หรือ `FACTORY_TYPE_88` โดย `FACTORY_TYPE_88` เทียบรหัสประเภทโรงงานหลักที่ normalize เป็น `00088`; `IN_REGION` หา region จาก province master และ intersect กับ `regionalAccess`; ถ้าไม่มี qualifier ที่ต้องใช้หรือ qualifier ขัดกัน ระบบคืนผลลัพธ์ว่าง/`404` แบบ fail closed. การเพิ่มและลบตรวจ scope เดียวกันก่อนเปลี่ยนข้อมูล.

Candidate จาก Fac60k รับเฉพาะแถวที่ `fac_import.FFLAG` เป็น `0`, `1` หรือ `3`; ไม่รวมสถานะ `2`. Mapping สถานะโรงงานคือ `0` = `ยังไม่แจ้งประกอบ`, `1` = `แจ้งประกอบแล้ว`, `2` = `จำหน่ายทะเบียน` และ `3` = `หยุดชั่วคราว`.

## ข้อมูลต้นทาง Fac60k รายโรงงาน

### `GET /api/v1/eligible-factories/source-factories/:factoryRegistrationNo`

Endpoint แบบ read-only สำหรับ flow ที่ไม่ได้เริ่มจากการคลิกแถวในตาราง candidate เช่น เจ้าหน้าที่กดอนุมัติคำขอเพิ่มโรงงาน แล้วต้องเติมข้อมูลโรงงานชุดเดียวกับตอนเลือกโรงงานเข้าข่ายจากตาราง Fac60k ก่อนทำ action ถัดไป. Endpoint นี้ไม่อนุมัติคำขอและไม่แก้ข้อมูลใด ๆ.

- Authentication: required
- Permission: `eligible_factories:view`
- Request body และ query: ไม่มี

Path fields:

| Field | Location | Type | Required | Rules |
| --- | --- | --- | --- | --- |
| `factoryRegistrationNo` | path | string | yes | URL decode แล้ว trim, ความยาว 1–64 ตัวอักษร; lookup แบบ exact match กับ `fac_import.FID`, `fac_import.FACREG` หรือ `fac_import.DISPFACREG` |

เลขทะเบียนที่มี `/` ต้อง URL-encode path segment ก่อนส่ง เช่น `3-106-33/50สบ` ต้องใช้ `/source-factories/3-106-33%2F50%E0%B8%AA%E0%B8%9A`. ฝั่ง JavaScript ควรประกอบ path ด้วย `encodeURIComponent(factoryRegistrationNo)`.

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/eligible-factories/source-factories/3-106-33%2F50%E0%B8%AA%E0%B8%9A' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

Lookup ใช้กติกาต้นทางเดียวกับ candidate: รับเฉพาะ `FFLAG` `0`, `1` หรือ `3` และกรองตาม data scope ของ `eligible_factories:view`. การค้นหาเป็น exact lookup เท่านั้น ไม่ใช่ partial search; หากค่าเดียวกันชนข้ามหลายคอลัมน์ ระบบเลือกตามลำดับ `FID` → `FACREG` → `DISPFACREG` และใช้ identifier เหล่านี้เรียงซ้ำเพื่อให้ผล deterministic. ระบบตั้งใจไม่ใช้กติกา exclude โรงงานที่มี active row ใน `eligible_factories` แล้ว จึงยังคืนข้อมูลต้นทางได้เมื่อโรงงานถูกเลือกเข้าข่ายไปก่อนหน้า.

Success response เป็น candidate row เดียวใน `data` โดยใช้ชื่อ field และ semantics เดียวกับ `data[]` ของ `GET /api/v1/eligible-factories/candidates`:

| Field | Type | Required | Nullable | Meaning |
| --- | --- | --- | --- | --- |
| `data.factoryName` | string | yes | no | ชื่อโรงงานจาก Fac60k |
| `data.factoryId` | string | yes | no | source identifier: `FID` แล้ว fallback เป็น `FACREG` หรือ `DISPFACREG`; candidate UI ปัจจุบันใช้เป็นเลขทะเบียนแบบใหม่ |
| `data.factoryRegistrationNo` | string | yes | no | เลขทะเบียนสำหรับแสดง: `DISPFACREG` แล้ว fallback เป็น `FACREG` หรือ `factoryId`; candidate UI ปัจจุบันใช้เป็นเลขทะเบียนแบบเดิม |
| `data.factoryClass` | string | yes | yes | รหัสประเภทโรงงานหลัก |
| `data.factorySubclass` | string | yes | yes | รหัสประเภทโรงงานรอง |
| `data.address` | string | yes | yes | ที่อยู่โรงงานที่ประกอบจากข้อมูลต้นทาง |
| `data.provinceName` | string | yes | no | จังหวัดสำหรับแสดงผลและตรวจ scope |
| `data.industrialEstateName` | string | yes | yes | ชื่อนิคมอุตสาหกรรม |
| `data.longitude` | number | yes | yes | ลองจิจูดโรงงาน |
| `data.latitude` | number | yes | yes | ละติจูดโรงงาน |
| `data.businessActivity` | string | yes | yes | การประกอบกิจการ |
| `data.operationStatus` | string | yes | no | สถานะที่ map จาก `FFLAG` |
| `data.capitalAmount` | number | no | yes | เงินทุนเมื่อมีข้อมูล |
| `data.machineryHorsepower` | number | yes | yes | กำลังเครื่องจักรรวม |
| `data.productionCapacity` | string | yes | yes | กำลังการผลิตพร้อมหน่วยเมื่อมีข้อมูล |
| `data.wastewaterDischargeInfo` | string | no | yes | ข้อมูลการระบายน้ำทิ้งเมื่อมีข้อมูล |
| `data.boilerCount` | integer | no | yes | จำนวนหม้อน้ำเมื่อมีข้อมูล |
| `data.boilerSizeEach` | string | yes | yes | ขนาดหม้อน้ำรายลูกเมื่อมีข้อมูล |
| `data.fuelUsed` | string | yes | yes | เชื้อเพลิงที่ใช้เมื่อมีข้อมูล |
| `data.eia` | string enum | no | yes | `มี`, `ไม่มี`, `มี IEE`, `มี EIA`, `มี EHIA` หรือ `อื่นๆ`; อาจเป็น `null` เมื่อไม่ได้อ่านแหล่ง EIA |
| `data.eiaOther` | string | no | yes | รายละเอียดเมื่อ `eia` เป็น `อื่นๆ` |
| `data.projectName` | string | no | yes | ชื่อโครงการเมื่อมีข้อมูล |
| `data.hasEia` | boolean | yes | yes | สถานะ EIA ตาม candidate mapping; อาจเป็น `null` เมื่อยืนยันไม่ได้ |

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "factoryName": "บริษัท โรงงานตัวอย่าง จำกัด",
    "factoryId": "10120000325542",
    "factoryRegistrationNo": "3-106-33/50สบ",
    "factoryClass": "00100",
    "factorySubclass": "00201",
    "address": "99 หมู่ 1 ตำบลมาบตาพุด อำเภอเมืองระยอง จังหวัดระยอง 21150",
    "provinceName": "ระยอง",
    "industrialEstateName": "มาบตาพุด",
    "longitude": 101.2,
    "latitude": 12.7,
    "businessActivity": "ผลิตเคมีภัณฑ์",
    "operationStatus": "แจ้งประกอบแล้ว",
    "machineryHorsepower": 250,
    "productionCapacity": "100 ตัน/วัน",
    "boilerSizeEach": null,
    "fuelUsed": null,
    "eia": null,
    "hasEia": null
  }
}
```

Errors ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Condition | Client action |
| --- | --- | --- |
| `400` | `factoryRegistrationNo` หลัง URL decode/trim ว่างหรือยาวเกิน 64 ตัวอักษร | ตรวจการ encode และค่าเลขทะเบียนก่อนส่งใหม่ |
| `401` | ไม่มี access token ที่ใช้งานได้ | ให้ผู้ใช้ login ใหม่ |
| `403` | ไม่มี `eligible_factories:view` | ปิด action และแจ้งว่าสิทธิ์ไม่พอ |
| `404` | ไม่มีแถวที่ exact match, `FFLAG` ไม่ใช่ `0`/`1`/`3` หรือโรงงานอยู่นอก data scope | แจ้งว่าไม่พบข้อมูลที่เข้าถึงได้ โดยไม่แยกสาเหตุเรื่อง scope |

## คำขอเพิ่มโรงงาน

Flow นี้รองรับกรณีหน้า `ขอเชื่อมต่อ` แสดงโรงงานที่ `isEligible = false` และปุ่ม `แจ้งความประสงค์` ถูกกดจากแถวของผู้ประกอบการ เมื่อส่งสำเร็จ ข้อมูลจะไม่เข้า `eligible_factories` แต่จะไปอยู่ในรายการ `ขอเพิ่มโรงงาน` เพื่อให้เจ้าหน้าที่พิจารณาสถานะคำขอ โดยขั้นตอนเพิ่มโรงงานเข้าข่ายเป็นคนละ action กับการ review คำขอ

```text
PENDING_REVIEW ── APPROVE ──> APPROVED
       │
       └──── REJECT ────────> REJECTED
```

รุ่นนี้ไม่มี cancel หรือ revision. เมื่อคำขอถูก `REJECTED` ผู้ประกอบการสร้างคำขอใหม่ได้ โดยระบบเก็บคำขอเดิมเป็นประวัติแยกรายการ

### `POST /api/v1/eligible-factories/add-requests`

- Authentication: required
- Permission: ต้องมีทั้ง `factories:view` และ `factories:edit`
- Actor: `operator` เท่านั้น

Request fields:

| Field | Location | Type | Required | Rules |
| --- | --- | --- | --- | --- |
| `factoryId` | body | string | yes | ใช้ `factoryId` จาก `GET /api/v1/cems-wpms-requests/operator-factories`; trim แล้ว 1–64 ตัวอักษร |
| `reason` | body | string | yes | เหตุผลจาก modal `แจ้งความประสงค์`; trim แล้ว 1–1,000 ตัวอักษร |

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/eligible-factories/add-requests' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "factoryId": "F000123",
    "reason": "มีคำขอเชื่อมต่อระบบ CEMS และมีจุดตรวจวัดที่อยู่ในเกณฑ์"
  }'
```

Success response (`201 Created`):

```json
{
  "success": true,
  "data": {
    "id": 41,
    "factoryId": "F000123",
    "factoryRegistrationNo": "10120000325542",
    "factoryName": "บริษัท โรงงานตัวอย่าง จำกัด",
    "provinceName": "นนทบุรี",
    "reason": "มีคำขอเชื่อมต่อระบบ CEMS และมีจุดตรวจวัดที่อยู่ในเกณฑ์",
    "status": "PENDING_REVIEW",
    "statusLabel": "รอพิจารณา",
    "eligibleFactoryId": null,
    "submittedBy": 42,
    "submittedAt": "2026-08-31T10:00:00.000Z",
    "reviewedBy": null,
    "reviewedAt": null,
    "reviewNote": null
  }
}
```

Business rules:

- backend resolve ข้อมูลโรงงานและ snapshot จาก access scope ของผู้ประกอบการเอง ไม่รับชื่อ จังหวัด หรือเลขทะเบียนจาก client
- โรงงานนอก owner scope ตอบ `404 Not Found` เพื่อไม่เปิดเผย resource
- ถ้าโรงงานอยู่ใน `eligible_factories` แล้วตอบ `409 Conflict`
- ถ้ามีคำขอ `PENDING_REVIEW` ของโรงงานเดียวกันอยู่แล้วตอบ `409 Conflict`; database บังคับหนึ่ง open request ต่อโรงงานเพื่อกัน request ชนพร้อมกัน

### `GET /api/v1/eligible-factories/add-requests`

- Authentication: required
- Permission: `eligible_factories:view`

Endpoint นี้ใช้เติมแท็บ `ขอเพิ่มโรงงาน` ของหน้า `โรงงานที่เข้าข่าย` และกรองผลตาม data scope เดียวกับเมนูโรงงานเข้าข่าย ระบบคืนคำขอทุกสถานะใน response เดียวโดยไม่แบ่งหน้า และเรียง `submittedAt DESC, id DESC`

Query fields:

| Field | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `search` | string | no | - | trim, 1–200 ตัวอักษร; ค้นชื่อหรือเลขทะเบียนโรงงาน |

Query `status`, `page` และ `perPage` ไม่อยู่ใน contract แล้ว เนื่องจาก validator เป็นแบบ strict การส่ง field เหล่านี้จะได้ `400 VALIDATION_ERROR`

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/eligible-factories/add-requests' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

Primary response fields:

| Field | Type | Nullable | Meaning |
| --- | --- | --- | --- |
| `data[].id` | integer | no | request id สำหรับ action ถัดไป |
| `data[].factoryId` | string | no | identifier เดียวกับ owner factory list |
| `data[].factoryName` | string | no | ชื่อโรงงาน/บริษัท |
| `data[].factoryRegistrationNo` | string | no | เลขทะเบียนโรงงานที่ใช้แสดงในตาราง |
| `data[].provinceName` | string | no | จังหวัดสำหรับแสดงผล |
| `data[].reason` | string | no | เหตุผลจากผู้ประกอบการ |
| `data[].status` | string enum | no | `PENDING_REVIEW`, `APPROVED` หรือ `REJECTED` |
| `data[].statusLabel` | string | no | `รอพิจารณา`, `อนุมัติแล้ว` หรือ `ไม่อนุมัติ` |
| `data[].eligibleFactoryId` | integer | yes | คำขอที่อนุมัติใหม่เป็น `null` เพราะ review ไม่เพิ่มโรงงานเข้าข่าย; ข้อมูลประวัติเดิมอาจยังมี id ที่เคย link ไป `eligible_factories` |
| `data[].submittedBy` | integer | no | user id ผู้ส่งคำขอ |
| `data[].submittedAt` | ISO 8601 string | no | เวลาส่งคำขอ |
| `data[].reviewedBy` | integer | yes | user id ผู้พิจารณา |
| `data[].reviewedAt` | ISO 8601 string | yes | เวลาพิจารณา |
| `data[].reviewNote` | string | yes | หมายเหตุจาก `officerNote` ตอนพิจารณา |
| `meta.total` | integer | no | จำนวนผลลัพธ์ทั้งหมดหลัง search และ data scope; เท่ากับจำนวนสมาชิกใน `data` |

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": [
    {
      "id": 41,
      "factoryId": "F000123",
      "factoryRegistrationNo": "10120000325542",
      "factoryName": "บริษัท โรงงานตัวอย่าง จำกัด",
      "provinceName": "นนทบุรี",
      "reason": "มีคำขอเชื่อมต่อระบบ CEMS",
      "status": "PENDING_REVIEW",
      "statusLabel": "รอพิจารณา",
      "eligibleFactoryId": null,
      "submittedBy": 42,
      "submittedAt": "2026-08-31T10:00:00.000Z",
      "reviewedBy": null,
      "reviewedAt": null,
      "reviewNote": null
    }
  ],
  "meta": {
    "total": 1
  }
}
```

### `POST /api/v1/eligible-factories/add-requests/:id/review`

- Authentication: required
- Permission: ต้องมีทั้ง `eligible_factories:view` และ `eligible_factories:approve`

Path and body fields:

| Field | Location | Type | Required | Rules |
| --- | --- | --- | --- | --- |
| `id` | path | positive integer | yes | id จากรายการคำขอ |
| `decision` | body | string enum | yes | `APPROVE` หรือ `REJECT` |
| `officerNote` | body | string \| null | conditional | trim, 1–1,000 ตัวอักษร; บังคับและห้ามว่างเมื่อ `REJECT`; เมื่อ `APPROVE` ส่ง `null` หรือละ field ได้ |

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/eligible-factories/add-requests/41/review' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "decision": "APPROVE",
    "officerNote": null
  }'
```

เมื่ออนุมัติ ระบบเปลี่ยนสถานะคำขอเป็น `APPROVED` และบันทึก `reviewedBy`, `reviewedAt` กับ `reviewNote` เท่านั้น โดยไม่สร้าง ไม่ restore และไม่แก้ไขแถวใน `eligible_factories` และ `eligibleFactoryId` ของคำขอที่อนุมัติใหม่จึงเป็น `null` เมื่อปฏิเสธ ระบบเปลี่ยนสถานะเป็น `REJECTED` และบันทึก audit fields ชุดเดียวกัน โดยเก็บ `officerNote` ใน response field `reviewNote`

ข้อมูลคำขอประวัติเดิมที่เคยอนุมัติด้วย contract รุ่นก่อนอาจยังมี `eligibleFactoryId` เป็น integer ได้ Client ต้องรองรับทั้ง `null` และ legacy id โดยไม่ตีความว่าการ review รุ่นปัจจุบันสร้างโรงงานเข้าข่ายแล้ว

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "id": 41,
    "factoryId": "F000123",
    "factoryRegistrationNo": "10120000325542",
    "factoryName": "บริษัท โรงงานตัวอย่าง จำกัด",
    "provinceName": "นนทบุรี",
    "reason": "มีคำขอเชื่อมต่อระบบ CEMS",
    "status": "APPROVED",
    "statusLabel": "อนุมัติแล้ว",
    "eligibleFactoryId": null,
    "submittedBy": 42,
    "submittedAt": "2026-08-31T10:00:00.000Z",
    "reviewedBy": 9,
    "reviewedAt": "2026-08-31T10:15:00.000Z",
    "reviewNote": null
  }
}
```

ผู้ส่งคำขอพิจารณาคำขอตัวเองไม่ได้ คำขอที่อยู่นอก scope ตอบ `404` และคำขอที่ไม่ใช่ `PENDING_REVIEW` แล้วตอบ `409`

Errors ของ flow ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Condition | Client action |
| --- | --- | --- |
| `400` | body/query/path ไม่ผ่าน validation เช่น reason ว่าง, ส่ง query legacy `status`/`page`/`perPage` หรือ REJECT โดยไม่มี `officerNote` | แก้ค่าตาม field rules แล้วส่งใหม่ |
| `401` | ไม่มี access token ที่ใช้งานได้ | ให้ผู้ใช้ login ใหม่ |
| `403` | ไม่มี permission, ผู้ส่งไม่ใช่ operator หรือพยายามพิจารณาคำขอตัวเอง | ปิด action และแจ้งว่าสิทธิ์ไม่พอ |
| `404` | ไม่พบโรงงาน/คำขอภายใน data scope | reload รายการโดยไม่เปิดเผยข้อมูลนอก scope |
| `409` | โรงงานเข้าข่ายแล้ว, มี open request ซ้ำ หรือคำขอถูกพิจารณาไปแล้ว | reload สถานะล่าสุดและไม่ retry อัตโนมัติ |

## กติกาที่อยู่และจังหวัด

Candidate จาก `fac_import`, โรงงานที่เข้าข่าย และฟอร์มข้อมูลจุดตรวจวัดยังคืน/รับ `provinceName` แยกจาก `address` ตามเดิม แต่ `address` ที่มีค่าต้องเป็นที่อยู่เต็มโดยเรียง `อำเภอ → จังหวัด → ZIPCODE` เช่น `89 หมู่ 1 ตำบลบ้านเลน อำเภอบางปะอิน จังหวัดพระนครศรีอยุธยา 13160`. Backend ใช้ `ZIPCODE` ที่แยกจาก `FADDR` เมื่อประกอบข้อมูลต้นทาง และต้องไม่ตีความเลขโฉนดหรือเลขที่ดิน 5 หลักใน `FADDR` เป็นรหัสไปรษณีย์. กรุงเทพมหานครเรียง `เขต → กรุงเทพมหานคร → ZIPCODE` โดยไม่เติมคำนำหน้า `จังหวัด`.

Backend เติมจังหวัดแบบ idempotent จึงไม่เติมซ้ำเมื่อ address มีจังหวัดเดียวกันอยู่แล้ว และไม่สร้าง address ที่มีเพียงจังหวัดเมื่อ address เดิมเป็น `null`. ถ้า address ระบุจังหวัดอื่นอย่างชัดเจน ระบบรักษาค่าเดิมไว้เพื่อให้ตรวจข้อมูลขัดแย้งแทนการเติมจังหวัดซ้อน.

## อัปโหลดเอกสารแนบของจุดตรวจวัด

### `POST /api/v1/monitoring-point-forms/attachments`

- Authentication: required
- Permission: `cems_wpms_requests:edit`
- Content type: `multipart/form-data`

Request fields:

| Field | Location | Type | Required | Rules |
| --- | --- | --- | --- | --- |
| `file` | multipart form-data | binary | yes | ส่งหนึ่งไฟล์ต่อ request โดยไม่ส่ง text field เพิ่ม; รองรับ JPEG, PNG และ PDF ขนาด 1 byte ถึง 10 MiB |

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/monitoring-point-forms/attachments' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --form 'file=@./document.pdf;type=application/pdf'
```

Success response fields (`201 Created`):

| Field | Type | Nullable | Meaning |
| --- | --- | --- | --- |
| `data.uploadToken` | string | no | opaque one-time token แบบ base64url 43 ตัวอักษรสำหรับ claim ไฟล์ตอนบันทึกฟอร์ม; ห้าม client แกะหรือสร้างเอง |
| `data.fileName` | string | no | ชื่อไฟล์สำหรับแสดงผลหลัง backend sanitize ชื่อที่รับมา |
| `data.fileType` | string | no | `image/jpeg`, `image/png` หรือ `application/pdf` |
| `data.fileSize` | integer | no | ขนาดไฟล์เป็น bytes |
| `data.expiresAt` | string | no | เวลา ISO 8601 ที่ `uploadToken` หมดอายุ |

```json
{
  "success": true,
  "data": {
    "uploadToken": "mP7bX4qL9nV2cR8tY5kH1fG6dJ3sW0uE_zA4oC9iB7Q",
    "fileName": "document.pdf",
    "fileType": "application/pdf",
    "fileSize": 123456,
    "expiresAt": "2026-08-11T11:00:00.000Z"
  }
}
```

Validation and business rules:

- รองรับนามสกุล `.jpg`, `.jpeg`, `.png` และ `.pdf` โดย MIME type และ signature ของไฟล์จริงต้องตรงกับชนิดที่รองรับ.
- 10 MiB เท่ากับ 10,485,760 bytes และเป็นเพดานต่อไฟล์; ไฟล์ว่างถูกปฏิเสธ.
- Multipart body รับเฉพาะ field `file` และไม่รับ text field เพิ่มเติม.
- Endpoint รับหนึ่งไฟล์ต่อ request แต่เรียกซ้ำได้ และไม่มี explicit count cap สำหรับจำนวนรายการใน `points[].attachments[]`.
- Upload endpoint จำกัดที่ 20 requests ต่อ authenticated actor ในแต่ละช่วง 15 นาที; request ที่ผ่าน authentication/authorization และถึง limiter ถูกนับแม้ upload validation ภายหลังไม่ผ่าน.
- แต่ละ backend process ประมวลผล upload requests พร้อมกันได้สูงสุด 4 requests ร่วมกันทุก actor. Guard นี้ทำงานหลัง actor rate limiter และก่อน multipart parser; เป็น temporary process-concurrency guard ไม่ใช่ hard count cap ของจำนวนไฟล์.
- `uploadToken` ผูกกับผู้ใช้งานที่อัปโหลด, ใช้ claim ได้ครั้งเดียว และหมดอายุใน 1 ชั่วโมง.
- Upload สำเร็จยังไม่ถือว่าไฟล์ผูกกับจุดตรวจวัดจนกว่า client จะส่ง `{ "uploadToken": "..." }` ใน `points[].attachments[]` ของ `POST` หรือ `PUT`.
- Upload response ไม่คืน `fileUrl`; signed URL จะถูกสร้างหลัง claim และคืนเฉพาะใน persisted form/eligible attachment response.

Errors ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `BAD_REQUEST` | ไม่ส่งไฟล์, ไฟล์ว่าง, ชนิด/นามสกุล/signature ไม่รองรับ หรือ metadata ไฟล์ไม่ถูกต้อง | แจ้งผู้ใช้ให้เลือกไฟล์ใหม่ |
| `400` | `UPLOAD_ERROR` | ชื่อ file field ไม่ใช่ `file`, multipart ส่งเกินหนึ่งไฟล์, มี text field เพิ่มเติม หรือไฟล์เกิน transport limit 10 MiB | ส่งเฉพาะ field `file` ทีละไฟล์และลดขนาดตามเพดาน |
| `401` | `UNAUTHORIZED` | ไม่มี access token ที่ใช้งานได้ | ให้ผู้ใช้ login ใหม่ |
| `403` | `FORBIDDEN` | ไม่มี `cems_wpms_requests:edit` | ปิด action upload หรือแจ้งว่าสิทธิ์ไม่พอ |
| `429` | `RATE_LIMITED` | actor เรียก upload endpoint เกิน 20 requests ในช่วง 15 นาที | หยุด retry และลองใหม่ตามเวลาใน `Retry-After`/rate-limit response headers |
| `429` | `RATE_LIMITED` | backend process มี upload requests กำลังประมวลผลพร้อมกันครบ 4 requests แล้ว; message เป็น `Too many concurrent attachment uploads. Please try again shortly.` | รอตาม `Retry-After: 1` (วินาที) แล้ว retry; ไม่ต้องลดจำนวนไฟล์ที่ต้องแนบ |

### `GET /api/v1/monitoring-point-forms/attachments/:publicId/content`

Endpoint นี้เปิดเนื้อหาไฟล์ผ่าน signed relative URL ที่ backend คืนใน `fileUrl`. URL เป็น opaque value: client ต้องใช้ทั้ง path และ query string ตามที่ได้รับ ห้ามสร้าง `publicId`, `expires` หรือ `signature` เอง.

- Authentication: public signed URL; ไม่ใช้ Bearer token
- URL lifetime: 1 ชั่วโมง

Request fields:

| Field | Location | Type | Required | Rules |
| --- | --- | --- | --- | --- |
| `publicId` | path | UUID | yes | server-owned public id ที่ฝังอยู่ใน `fileUrl` |
| `expires` | query | Unix timestamp seconds | yes | ตัวเลข 10 หลักที่ backend เซ็นไว้ |
| `signature` | query | base64url string | yes | HMAC-SHA256 43 ตัวอักษรที่ backend สร้าง |

```bash
curl --location '<BASE_URL><FILE_URL_FROM_RESPONSE>' \
  --output document.pdf
```

สำเร็จตอบ `200 OK` เป็น binary body พร้อม `Content-Type` ตาม `fileType`, `Content-Disposition: inline`, `Cache-Control: private, no-store, max-age=0`, `Pragma: no-cache`, `Referrer-Policy: no-referrer` และ `X-Content-Type-Options: nosniff`. Backend ให้เปิดเฉพาะไฟล์ที่ claim แล้วและยังผูกกับ active form/point; pending upload เปิดผ่าน content endpoint ไม่ได้.

Errors ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `BAD_REQUEST` | `publicId`, `expires` หรือ `signature` ผิดรูปแบบ | ขอ attachment response ใหม่แทนการแก้ URL เอง |
| `403` | `FORBIDDEN` | signature ไม่ถูกต้อง | ไม่เปิด URL และ reload ข้อมูลจาก API |
| `404` | `NOT_FOUND` | ไฟล์ยังเป็น pending upload, ไม่พบหรือถูกลบ, path ไม่ถูกต้อง หรือ form/point ที่ผูกไฟล์ไม่ active | reload ฟอร์มหรือรายการโรงงาน |
| `410` | `ATTACHMENT_URL_EXPIRED` | signature ถูกต้องแต่ signed URL หมดอายุ | ขอ attachment response ใหม่เพื่อรับ signed URL ชุดใหม่ |

## ฟอร์มเพิ่ม/แก้ไขข้อมูลจุดตรวจวัด

`POST /api/v1/monitoring-point-forms` และ `PUT /api/v1/monitoring-point-forms/:id` ใช้ request body shape เดียวกัน โดยข้อมูลโครงการและ EIA เป็นข้อมูลระดับโรงงานภายใต้ `factory` ไม่ใช่ข้อมูลของแต่ละ `points[]`. Field สำหรับการใช้ปล่องร่วมกัน, สถานะ, เอกสารแนบ และลิงก์อยู่ใต้ `points[]` โดยตรง ไม่อยู่ใน `points[].details`.

Relevant request fields:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `factory.eiaInfo` | string \| null | no | field EIA เดิมของฟอร์ม; trim แล้วสูงสุด 255 ตัวอักษร |
| `factory.eiaOther` | string \| null | conditional | ช่อง “ระบุ”; trim แล้วสูงสุด 500 ตัวอักษร และต้องไม่ว่างเมื่อ `factory.eiaInfo` เป็น `อื่นๆ`; ค่าอื่นจะ normalize เป็น `null` |
| `factory.projectName` | string \| null | no | ชื่อโครงการ; trim แล้วสูงสุด 500 ตัวอักษร; ค่าว่าง normalize เป็น `null` |
| `points` | array | no | รายการจุดตรวจวัด; ว่างได้ และ validation รายจุดยังใช้ contract เดิม |
| `points[].id` | positive integer | no | stable id จาก detail/response ล่าสุด; ใช้จับคู่ active point เดิมตอน `PUT` และคง id เดิมหลัง upsert |
| `points[].timeSharingParameters` | string[] | no | รายการพารามิเตอร์ที่ใช้ปล่องร่วมกัน; `ไม่มี` ต้องเป็นรายการเดียวและห้ามอยู่ร่วมกับค่าอื่น |
| `points[].sharedStackCode` | string \| null | no | trim แล้วสูงสุด 64 ตัวอักษร; backend normalize เป็น `null` เมื่อ `timeSharingParameters` มี `ไม่มี` |
| `points[].monitoringPointStatus` | string \| null | no | ส่ง `null` ได้; ถ้ามีค่าต้องตรงหนึ่งใน 7 สถานะที่กำหนดด้านล่าง |
| `points[].attachments` | array | no | attachment references; แต่ละรายการต้องเป็น `{ id }` หรือ `{ uploadToken }` อย่างใดอย่างหนึ่งเท่านั้น และไม่มี explicit count cap |
| `points[].attachments[].id` | positive integer | conditional | id ของไฟล์ที่ผูกกับจุดนี้อยู่แล้ว; ใช้คงไฟล์เดิมเมื่อส่ง replacement array |
| `points[].attachments[].uploadToken` | string | conditional | opaque token จาก upload response สำหรับ claim ไฟล์ใหม่; ห้ามใช้ token ของผู้ใช้อื่น, token หมดอายุ หรือ token ที่เคย claim แล้ว |
| `points[].attachmentLinks` | array | no | ลิงก์เอกสารเพิ่มเติม; ไม่มี explicit count cap |
| `points[].attachmentLinks[].label` | string \| null | no | ข้อความที่ trim แล้วสูงสุด 255 ตัวอักษร; ค่าว่าง normalize เป็น `null` |
| `points[].attachmentLinks[].url` | string | yes | absolute URL ที่ใช้ `http` หรือ `https`; สูงสุด 2,048 ตัวอักษร |

ค่า `points[].monitoringPointStatus` ที่รองรับมีดังนี้:

- `เชื่อมต่อครบแล้ว`
- `ได้รับการยกเว้นทั้งหมด`
- `เชื่อมต่อแล้วแต่ยังไม่ครบ`
- `อยู่ระหว่างขยายเวลา`
- `ยังไม่ได้ดำเนินการเชื่อมต่อ`
- `อยู่ระหว่างการตรวจสอบของจังหวัด`
- `อยู่ระหว่างเชื่อมต่อ`

เมื่อไฟล์ถูก claim และบันทึกแล้ว `GET /api/v1/monitoring-point-forms/:id`, `POST` และ `PUT` คืน attachment shape ต่อไปนี้:

| Field | Type | Nullable | Meaning |
| --- | --- | --- | --- |
| `attachments[].id` | positive integer | no | server-owned attachment id สำหรับอ้างไฟล์เดิมใน `PUT` |
| `attachments[].fileName` | string | no | ชื่อไฟล์สำหรับแสดงผล |
| `attachments[].fileUrl` | string | no | signed relative URL สำหรับเปิดไฟล์ชั่วคราว |
| `attachments[].fileUrlExpiresAt` | string | no | เวลา ISO 8601 ที่ `fileUrl` หมดอายุ |
| `attachments[].fileType` | string | no | `image/jpeg`, `image/png` หรือ `application/pdf` |
| `attachments[].fileSize` | integer | no | ขนาดไฟล์เป็น bytes |

Minimal create request:

```json
{
  "factory": {
    "eiaInfo": "อื่นๆ",
    "eiaOther": "รายงานสิ่งแวดล้อมประเภทเฉพาะ",
    "projectName": "โครงการปรับปรุงระบบตรวจวัด"
  },
  "points": [
    {
      "systemType": "CEMS",
      "pointCode": "S2001",
      "timeSharingParameters": ["NOx (ppm)"],
      "sharedStackCode": "S2002",
      "monitoringPointStatus": "อยู่ระหว่างเชื่อมต่อ",
      "attachments": [
        {
          "uploadToken": "mP7bX4qL9nV2cR8tY5kH1fG6dJ3sW0uE_zA4oC9iB7Q"
        }
      ],
      "attachmentLinks": [
        {
          "label": "เอกสารอ้างอิง",
          "url": "https://example.com/reference"
        }
      ]
    }
  ]
}
```

Minimal create response (`201 Created`; `PUT` สำเร็จตอบ `200 OK` ด้วย data shape เดียวกัน):

```json
{
  "success": true,
  "data": {
    "id": 12,
    "factory": {
      "factoryName": null,
      "factoryRegistrationNoNew": null,
      "factoryRegistrationNoOld": null,
      "provinceName": null,
      "factoryTypeMain": null,
      "factoryTypeSub": null,
      "operationStatus": null,
      "eiaInfo": "อื่นๆ",
      "eiaOther": "รายงานสิ่งแวดล้อมประเภทเฉพาะ",
      "projectName": "โครงการปรับปรุงระบบตรวจวัด",
      "address": null,
      "businessActivity": null,
      "machineryHorsepower": null,
      "latitude": null,
      "longitude": null
    },
    "points": [
      {
        "id": 31,
        "systemType": "CEMS",
        "pointCode": "S2001",
        "timeSharingParameters": ["NOx (ppm)"],
        "sharedStackCode": "S2002",
        "monitoringPointStatus": "อยู่ระหว่างเชื่อมต่อ",
        "attachments": [
          {
            "id": 71,
            "fileName": "document.pdf",
            "fileUrl": "/api/v1/monitoring-point-forms/attachments/550e8400-e29b-41d4-a716-446655440000/content?expires=1786446000&signature=Q2uN8vK5xR1dF7mJ4cH9sL6pT3yW0bE_zA5gC8iD1oM",
            "fileUrlExpiresAt": "2026-08-11T11:00:00.000Z",
            "fileType": "application/pdf",
            "fileSize": 123456
          }
        ],
        "attachmentLinks": [
          {
            "label": "เอกสารอ้างอิง",
            "url": "https://example.com/reference"
          }
        ]
      }
    ],
    "createdAt": "2026-07-22T00:00:00.000Z",
    "updatedAt": "2026-07-22T00:00:00.000Z"
  }
}
```

`GET /api/v1/monitoring-point-forms` เป็น summary จึงคืน fields ระดับโรงงานทั้งสามใต้ `data[].factory` และไม่คืน `points[]`. `GET /api/v1/monitoring-point-forms/:id` คืน fields ระดับโรงงานใต้ `data.factory` และคืน `timeSharingParameters`, `sharedStackCode`, `monitoringPointStatus`, `attachments` และ `attachmentLinks` ใต้ `data.points[]` เพื่อให้หน้าแก้ไข prefill ค่าเดิมได้. Response ของ `POST` และ `PUT` ใช้ point shape เดียวกับ detail. ข้อมูลเดิมที่ไม่มีเอกสารแนบหรือลิงก์คืน `attachments: []` และ `attachmentLinks: []`; field จุดตรวจวัดอื่นที่ไม่มีค่ายังคง normalize เป็น `timeSharingParameters: []`, `sharedStackCode: null` และ `monitoringPointStatus: null`. Public `details` ตัดเฉพาะ `attachments` และ `attachmentLinks` ออกเพื่อไม่คืน attachment fields ซ้ำ; ฝั่ง request ต้องส่ง typed point fields ที่ top-level ของ `points[]` ตามตารางข้างต้น ไม่ส่งไว้ใต้ `details`.

Attachment replacement semantics:

- `POST`: ถ้าไม่ส่ง `attachments` หรือ `attachmentLinks` backend บันทึกเป็น `[]`.
- `PUT` ใช้ upsert และรักษา point id เดิม. Client ควรส่ง `points[].id` จาก detail/response ล่าสุดเพื่อจับคู่ active point โดยตรง.
- Legacy payload ที่ไม่ส่ง point id จะจับคู่จุดเดิมด้วย normalized `(systemType, pointCode)` เมื่อคู่นี้ไม่ซ้ำภายใน form. Positional fallback ใช้เฉพาะ payload เดิมที่ไม่ส่ง resource fields, มีจำนวนและลำดับที่เข้ากันได้ และไม่มีความกำกวมจากการเพิ่ม ลบ หรือสลับจุด.
- เมื่อจับคู่ point เดิมได้และไม่ส่ง array ใด backend คงค่าปัจจุบันของ array นั้น; กติกานี้ทำงานแยกกันระหว่าง `attachments` กับ `attachmentLinks`.
- `PUT`: ส่ง `attachments: []` หรือ `attachmentLinks: []` เพื่อล้าง array นั้นโดยชัดเจน.
- จุดที่ backend ยืนยันได้หลัง reconciliation ว่าเป็นจุดใหม่ และไม่ส่ง array เริ่มด้วย `[]`.
- หากส่ง `attachments` ระบบใช้เป็นรายการทดแทนทั้งหมด: `{ id }` คงไฟล์เดิมที่เป็นของ point นี้ และ `{ uploadToken }` claim ไฟล์ใหม่ใน transaction เดียวกับการบันทึก form. Client ห้ามส่ง metadata หรือ URL ของไฟล์เอง.
- `uploadToken` ต้องยังไม่หมดอายุ, ยังไม่เคย claim และเป็นของ actor คนเดียวกับ request; attachment id ต้องเป็นของ point/form เดิม.
- การส่ง `attachments: []` หรือ `attachmentLinks: []` บนจุดใหม่ที่ไม่มี `id` และยังจับคู่ไม่ได้ ไม่ใช่การยินยอมให้ลบทรัพยากรของจุดเดิม และไม่สามารถใช้ข้าม ambiguity guard ได้.
- Backend อนุญาตให้ลบจุดเดิมที่ไม่ถูกจับคู่และมีไฟล์หรือลิงก์เฉพาะเมื่อ (1) ส่ง `points: []` เพื่อ clear ทั้งหมด หรือ (2) payload จับคู่จุดเดิมได้อย่างน้อยหนึ่งจุดและจุดเดิมที่จับคู่ทั้งหมดใช้ `points[].id` อย่างชัดเจน; กรณีอื่นตอบ `409 Conflict` ก่อนเขียนข้อมูล.
- Response ของ form/eligible จะสร้าง signed relative `fileUrl` ชุดใหม่ โดยมีอายุ 1 ชั่วโมงตาม `fileUrlExpiresAt`; client ไม่ควร cache URL เกินเวลานี้.
- `attachments` และ `attachmentLinks` ไม่มี explicit count cap; แต่ละไฟล์ยังต้องผ่านเพดานขนาดรายไฟล์ของ upload contract.

Errors ของ `POST` และ `PUT` ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | attachment reference ไม่ใช่ strict `{ id }`/`{ uploadToken }`, token ผิดรูปแบบ, link ไม่ตรง contract, `points[].id` ซ้ำ หรือส่ง typed field ไว้ใต้ `details` | แสดง validation ตาม issue path และแก้ payload |
| `400` | `BAD_REQUEST` | ใช้ attachment `id` หรือ `uploadToken` ซ้ำกันที่ใดก็ได้ใน payload | เหลือ reference แต่ละค่าเพียงครั้งเดียว |
| `401` | `UNAUTHORIZED` | ไม่มี access token ที่ใช้งานได้ | ให้ผู้ใช้ login ใหม่ |
| `403` | `FORBIDDEN` | ไม่มี `cems_wpms_requests:edit` | ปิด action บันทึกหรือแจ้งว่าสิทธิ์ไม่พอ |
| `404` | `NOT_FOUND` | ไม่พบ form หรือโรงงานไม่อยู่ใน data scope ของผู้เรียก | reload รายการและหยุดแก้ไข form id เดิม |
| `409` | `CONFLICT` | สร้าง form ซ้ำ; point/attachment `id` ไม่ใช่ active resource ของ form/point นี้; `uploadToken` ไม่มี, ปลอม, หมดอายุ, เคย claim แล้ว หรือเป็นของ actor อื่น; resource เปลี่ยนระหว่าง update; หรือ legacy point matching กำกวมและเสี่ยงทำทรัพยากรหาย | reload detail เพื่อรับ id ล่าสุด, upload ไฟล์ใหม่เมื่อ token ใช้ไม่ได้ หรือเปิด form เดิมเมื่อสร้างซ้ำ |

เมื่อฟอร์มผูกกับโรงงานเข้าข่าย ระบบ sync แบบ patch:

- `projectName` ที่ไม่เป็น `null` อัปเดต `eligible_factories.project_name`; ค่า `null` หรือไม่ได้ส่งคงค่าปัจจุบัน.
- `eiaInfo` ที่เป็น `มี`, `ไม่มี`, `มี IEE`, `มี EIA`, `มี EHIA` หรือ `อื่นๆ` อัปเดต `eia`, derived `hasEia` และ `eiaOther` ให้สอดคล้องกัน.
- `eiaInfo` ที่เป็น `null` หรือไม่ได้ส่งไม่ล้าง EIA ปัจจุบันใน `eligible_factories`.
- `eiaInfo` แบบ free-text เดิมที่ไม่ตรงหกค่า canonical ยังบันทึกและอ่านกลับจากฟอร์มได้ แต่ไม่แก้ EIA ใด ๆ ใน `eligible_factories` เพื่อป้องกันข้อมูล categorical กับ `hasEia` ขัดกัน.
- ฟอร์มข้อมูลจุดตรวจวัดเองยังบันทึก `null` ได้ แม้ค่าใน `eligible_factories` จะถูกเก็บไว้ตาม patch semantics.

## ข้อมูลที่ซิงก์หลังเชื่อมต่อ

`GET /api/v1/eligible-factories` อ่านค่าปัจจุบันจาก `eligible_factories`. เมื่อคำขอของโรงงานเข้าสู่ `CONNECTED` ระบบอัปเดตพิกัดโรงงาน, EIA และชื่อโครงการใน transaction เดียวกับข้อมูล POMS.

Relevant response fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `data[].id` | integer | `eligible_factory_id` ที่ใช้ผูก request/POMS |
| `data[].address` | string \| null | ที่อยู่เต็มซึ่งมีจังหวัดก่อนรหัสไปรษณีย์เมื่อมี `provinceName` ที่ใช้งานได้ |
| `data[].provinceName` | string | จังหวัดแบบ machine-filterable ที่คงแยกจาก `address` |
| `data[].latitude` | number \| null | ละติจูดโรงงาน |
| `data[].longitude` | number \| null | ลองจิจูดโรงงาน |
| `data[].eia` | string \| null | `มี`, `ไม่มี`, `มี IEE`, `มี EIA`, `มี EHIA` หรือ `อื่นๆ` |
| `data[].eiaOther` | string \| null | รายละเอียดเมื่อ `eia` เป็น `อื่นๆ` |
| `data[].hasEia` | boolean \| null | ค่าที่ derive จาก `eia` |
| `data[].projectName` | string \| null | ชื่อโครงการล่าสุดที่ซิงก์เมื่อเชื่อมต่อ |
| `data[].cemsConnectionStatusSummary` | string | สรุป CEMS เป็น `เชื่อมต่อครบถ้วน`, `ได้รับยกเว้นทั้งหมด` หรือ `ยังไม่แล้วเสร็จ` |
| `data[].wpmsConnectionStatusSummary` | string | สรุป WPMS ด้วยกติกาเดียวกับ CEMS |
| `data[].measurementPoints[]` | array | จุดตรวจวัดจากฟอร์มที่ผูกอยู่ รวม `timeSharingParameters`, `sharedStackCode`, `monitoringPointStatus`, `attachments` และ `attachmentLinks` |
| `data[].measurementPoints[].id` | positive integer | stable monitoring point id สำหรับอ้างจุดเดิมข้ามการแก้ไข form |
| `data[].measurementPoints[].attachments` | array | เอกสารแนบของจุด; คืน `[]` เสมอเมื่อไม่มีข้อมูล |
| `data[].measurementPoints[].attachments[].id` | positive integer | server-owned attachment id |
| `data[].measurementPoints[].attachments[].fileName` | string | ชื่อไฟล์สำหรับแสดงผล |
| `data[].measurementPoints[].attachments[].fileUrl` | string | signed relative URL สำหรับเปิดไฟล์ชั่วคราว |
| `data[].measurementPoints[].attachments[].fileUrlExpiresAt` | string | เวลา ISO 8601 ที่ `fileUrl` หมดอายุ |
| `data[].measurementPoints[].attachments[].fileType` | string | MIME type ของไฟล์ |
| `data[].measurementPoints[].attachments[].fileSize` | integer | ขนาดไฟล์เป็น bytes |
| `data[].measurementPoints[].attachmentLinks` | array | ลิงก์เอกสารเพิ่มเติมของจุด; คืน `[]` เสมอเมื่อไม่มีข้อมูล |
| `data[].measurementPoints[].attachmentLinks[].label` | string \| null | ข้อความแสดงของลิงก์ |
| `data[].measurementPoints[].attachmentLinks[].url` | string | absolute `http`/`https` URL ของลิงก์ |

`GET /api/v1/eligible-factories` คืน summary ทั้งสอง field เสมอ โดยคำนวณแยกตาม `systemType` จาก `monitoringPointStatus` ระดับจุดที่ผู้ใช้ประกาศใน monitoring form และบันทึกไว้ใน `factory_monitoring_points.details_json`; summary นี้ไม่ได้ derive จากสถานะคำขอเชื่อมต่อหรือสถานะ live ของอุปกรณ์:

- ถ้ามีจุดของระบบนั้นอย่างน้อยหนึ่งจุดและทุกจุดมี `monitoringPointStatus` เป็น `เชื่อมต่อครบแล้ว` ให้ summary เป็น `เชื่อมต่อครบถ้วน`.
- ถ้ามีจุดของระบบนั้นอย่างน้อยหนึ่งจุดและทุกจุดมี `monitoringPointStatus` เป็น `ได้รับการยกเว้นทั้งหมด` ให้ summary เป็น `ได้รับยกเว้นทั้งหมด`.
- กรณีอื่นทั้งหมด รวมถึงไม่มีจุด, สถานะผสม, สถานะอื่น หรือ `null` ให้ summary เป็น `ยังไม่แล้วเสร็จ`.

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": [
    {
      "id": 25,
      "factoryId": "3-106-33/50สบ",
      "latitude": 13.7563,
      "longitude": 100.5018,
      "eia": "มี EIA",
      "eiaOther": null,
      "hasEia": true,
      "projectName": "โครงการปรับปรุงโรงงาน",
      "cemsConnectionStatusSummary": "เชื่อมต่อครบถ้วน",
      "wpmsConnectionStatusSummary": "ยังไม่แล้วเสร็จ",
      "measurementPoints": [
        {
          "id": 31,
          "systemType": "CEMS",
          "pointCode": "S2001",
          "timeSharingParameters": ["ไม่มี"],
          "sharedStackCode": null,
          "monitoringPointStatus": "เชื่อมต่อครบแล้ว",
          "attachments": [
            {
              "id": 71,
              "fileName": "document.pdf",
              "fileUrl": "/api/v1/monitoring-point-forms/attachments/550e8400-e29b-41d4-a716-446655440000/content?expires=1786446000&signature=Q2uN8vK5xR1dF7mJ4cH9sL6pT3yW0bE_zA5gC8iD1oM",
              "fileUrlExpiresAt": "2026-08-11T11:00:00.000Z",
              "fileType": "application/pdf",
              "fileSize": 123456
            }
          ],
          "attachmentLinks": [
            {
              "label": "เอกสารอ้างอิง",
              "url": "https://example.com/reference"
            }
          ]
        }
      ]
    }
  ],
  "meta": { "total": 1 }
}
```

รูปหน้าโรงงานและโลโก้เป็นข้อมูล POMS current/live จึงไม่เพิ่มใน response ของโรงงานเข้าข่าย.

`GET /api/v1/eligible-factories/candidates` ไม่มีการเปลี่ยน response contract และไม่เพิ่ม `cemsConnectionStatusSummary` หรือ `wpmsConnectionStatusSummary`.

## การถอดโรงงานออกจากเข้าข่าย

Path fields:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `id` | integer | yes | id ของ active eligible factory |

Minimal request: ไม่มี request body.

- สำเร็จตอบ `204 No Content` และทำรายการทั้งหมดใน transaction เดียว.
- หาก `eligible_factories.monitoring_point_form_id` ผูกกับฟอร์ม ระบบจะ soft-delete active `factory_monitoring_points` ทั้งหมดที่มี `form_id` เดียวกัน, soft-delete `factory_monitoring_point_forms` ที่ผูกอยู่ และ soft-delete eligible row แบบ atomic. หลังจากนั้น `POST /api/v1/monitoring-point-forms` สามารถสร้างฟอร์มใหม่ของโรงงานเดิมได้โดยไม่ชน duplicate conflict จากฟอร์มที่ถูกลบ.
- หาก eligible row ไม่มี `monitoring_point_form_id` ระบบจะ soft-delete เฉพาะ eligible row.
- ไม่พบ active row ตอบ `404 Not Found`.
- หาก eligible row ปัจจุบัน หรือ eligible row เดิมที่อ้าง `monitoring_point_form_id` เดียวกัน ยังมี active POMS connected point ระบบจะตอบ `409 Conflict` และ transaction จะไม่ soft-delete eligible row, linked monitoring-point form หรือ monitoring points เพื่อคง invariant ว่าโรงงานใน POMS ต้องเป็นโรงงานที่เข้าข่าย.

สำหรับ eligible row ที่ถูก soft-delete ก่อนเริ่มใช้ contract นี้ migration `0088_soft_delete_forms_for_removed_eligible_factories` จะ backfill โดย soft-delete active linked form และ active points ที่ยังตกค้าง. Migration จะข้ามฟอร์มที่ยังมี active eligible row ผูกอยู่ หรือมี active POMS connected point เพื่อไม่กระทบข้อมูลที่ยังใช้งาน. การ cleanup นี้ intentionally irreversible; `down` จะไม่ restore ฟอร์มหรือจุดที่ถูก soft-delete เพื่อป้องกัน stale operational data กลับมา active.

## Business Flow And Explanations

- [Connected factory profile sync workflow](../../../../../workflows/connected-factory-profile-sync.md)
- [Eligible factory monitoring-point project fields workflow](../../../../../workflows/eligible-factory-monitoring-point-project-fields.md)
- [ขอเชื่อมต่อ](../connection-requests/README.md)

## Backend Maintainer Map

| Concern | Canonical source |
| --- | --- |
| Routes | [`eligible-factories.routes.ts`](../../../../../backend/src/modules/eligible-factories/eligible-factories.routes.ts), [`monitoring-point-forms.routes.ts`](../../../../../backend/src/modules/monitoring-point-forms/monitoring-point-forms.routes.ts) |
| Workflow implementation | [`eligible-factories.controller.ts`](../../../../../backend/src/modules/eligible-factories/eligible-factories.controller.ts), [`eligible-factories.service.ts`](../../../../../backend/src/modules/eligible-factories/eligible-factories.service.ts) |
| Validators | [`eligible-factories.validator.ts`](../../../../../backend/src/modules/eligible-factories/eligible-factories.validator.ts), [`monitoring-point-forms.validator.ts`](../../../../../backend/src/modules/monitoring-point-forms/monitoring-point-forms.validator.ts) |
| Attachment lifecycle | [`monitoring-point-form-attachments.service.ts`](../../../../../backend/src/modules/monitoring-point-forms/monitoring-point-form-attachments.service.ts), [`monitoring-point-attachment-cleanup.worker.ts`](../../../../../backend/src/modules/monitoring-point-forms/monitoring-point-attachment-cleanup.worker.ts), [`monitoring-point-attachments.ts`](../../../../../backend/src/modules/monitoring-point-forms/monitoring-point-attachments.ts) |
| Schema | [`0104_create_eligible_factory_add_requests.ts`](../../../../../backend/src/db/migrations/0104_create_eligible_factory_add_requests.ts), [`0105_allow_status_only_eligible_factory_add_request_approval.ts`](../../../../../backend/src/db/migrations/0105_allow_status_only_eligible_factory_add_request_approval.ts), [`0091_create_factory_monitoring_point_attachments.ts`](../../../../../backend/src/db/migrations/0091_create_factory_monitoring_point_attachments.ts) |
| Repository | [`eligible-factories.repository.ts`](../../../../../backend/src/modules/eligible-factories/eligible-factories.repository.ts), [`eligible-factory-candidates.repository.ts`](../../../../../backend/src/modules/eligible-factories/eligible-factory-candidates.repository.ts), [`monitoring-point-forms.repository.ts`](../../../../../backend/src/modules/monitoring-point-forms/monitoring-point-forms.repository.ts) |
| Public types | [`eligible-factories.types.ts`](../../../../../backend/src/modules/eligible-factories/eligible-factories.types.ts), [`monitoring-point-forms.types.ts`](../../../../../backend/src/modules/monitoring-point-forms/monitoring-point-forms.types.ts) |
| Tests | [`eligible-factories.route.test.ts`](../../../../../backend/tests/unit/eligible-factories.route.test.ts), [`eligible-factories.service.test.ts`](../../../../../backend/tests/unit/eligible-factories.service.test.ts), [`eligible-factory-add-requests.repository-regression.test.ts`](../../../../../backend/tests/unit/eligible-factory-add-requests.repository-regression.test.ts), [`eligible-factory-candidates.repository.test.ts`](../../../../../backend/tests/unit/eligible-factory-candidates.repository.test.ts), [`eligible-factory-add-requests-migration.test.ts`](../../../../../backend/tests/unit/eligible-factory-add-requests-migration.test.ts), [`api-docs.openapi.test.ts`](../../../../../backend/tests/unit/api-docs.openapi.test.ts), [`monitoring-point-form-attachment-upload.route.test.ts`](../../../../../backend/tests/unit/monitoring-point-form-attachment-upload.route.test.ts), [`monitoring-point-form-attachments.service.test.ts`](../../../../../backend/tests/unit/monitoring-point-form-attachments.service.test.ts), [`monitoring-point-attachment-cleanup.worker.test.ts`](../../../../../backend/tests/unit/monitoring-point-attachment-cleanup.worker.test.ts), [`monitoring-point-attachments-migration.test.ts`](../../../../../backend/tests/unit/monitoring-point-attachments-migration.test.ts), [`monitoring-point-forms.attachment-reconciliation.test.ts`](../../../../../backend/tests/unit/monitoring-point-forms.attachment-reconciliation.test.ts), [`monitoring-point-forms.validator.test.ts`](../../../../../backend/tests/unit/monitoring-point-forms.validator.test.ts), [`monitoring-point-forms.repository.test.ts`](../../../../../backend/tests/unit/monitoring-point-forms.repository.test.ts), [`monitoring-point-forms.service.test.ts`](../../../../../backend/tests/unit/monitoring-point-forms.service.test.ts), [`monitoring-point-forms.route.test.ts`](../../../../../backend/tests/unit/monitoring-point-forms.route.test.ts) |
| Evidence | [คำขอเพิ่มโรงงานเข้าข่าย](../../../evidence/eligible-factories/eligible-factory-requests.tdd.md), [ข้อมูลต้นทาง Fac60k รายโรงงานสำหรับ flow อนุมัติ](../../../evidence/eligible-factories/fac60k-source-factory-lookup.tdd.md) |
