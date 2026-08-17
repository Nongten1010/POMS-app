# Payload และ Validation ของคำขอเชื่อมต่อ

[กลับไปหน้าขอเชื่อมต่อ](./README.md)

หน้า canonical นี้สรุป request contract, normalization, validation และ business rules ของ 4 endpoint ที่ใช้กับฟอร์มหน้าขอเชื่อมต่อโดยตรง:

- `POST /api/v1/cems-wpms-requests/measurement-points`
- `POST /api/v1/cems-wpms-requests/parameters`
- `PUT /api/v1/cems-wpms-requests/:id/form`
- `POST /api/v1/cems-wpms-requests/direct-connections`

ค่าที่ระบุในหน้านี้อ้างอิงพฤติกรรมจริงจาก route, controller, validator, service, migration และ unit tests ปัจจุบันของ backend

## Frontend Quick Start

ใช้ shared payload ชุดเดียวสำหรับข้อมูลโรงงาน, ผู้ติดต่อ, จุดตรวจวัด, เอกสาร และเครื่องมือวัด แล้วเลือก endpoint ตาม intent:

1. เพิ่มจุดตรวจวัดใหม่ ใช้ `POST /measurement-points`
2. เพิ่มพารามิเตอร์ให้จุดเดิม ใช้ `POST /parameters`
3. ส่งแบบแก้ไขหลังเจ้าหน้าที่แจ้งแก้ ใช้ `PUT /:id/form`
4. เจ้าหน้าที่เพิ่มจุดและเชื่อมต่อทันที ใช้ `POST /direct-connections`

ตัวอย่าง quick check สำหรับ operator add-point:

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/cems-wpms-requests/measurement-points' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data @request.json
```

## Endpoint Summary

| งาน                                            | Method | Path                                            | Auth   | Permission                          | Contract |
| ---------------------------------------------- | ------ | ----------------------------------------------- | ------ | ----------------------------------- | -------- |
| ขอเพิ่มจุดตรวจวัด                              | `POST` | `/api/v1/cems-wpms-requests/measurement-points` | Bearer | `cems_wpms_requests:edit`           | หน้านี้  |
| ขอเพิ่มพารามิเตอร์                             | `POST` | `/api/v1/cems-wpms-requests/parameters`         | Bearer | `cems_wpms_requests:edit`           | หน้านี้  |
| ส่งแบบเมื่อถูกตีกลับให้แก้ไข                   | `PUT`  | `/api/v1/cems-wpms-requests/:id/form`           | Bearer | `cems_wpms_requests:edit`           | หน้านี้  |
| เพิ่มจุดตรวจวัดโดยเจ้าหน้าที่และเชื่อมต่อทันที | `POST` | `/api/v1/cems-wpms-requests/direct-connections` | Bearer | `cems_wpms_requests:direct_connect` | หน้านี้  |

## Shared Authentication And Permission

| Endpoint                   | Authentication | Permission                          | Data scope                                                                                |
| -------------------------- | -------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `POST /measurement-points` | required       | `cems_wpms_requests:edit`           | ต้อง resolve เป็น active eligible factory; service ปัจจุบันไม่ได้ตัด location scope เพิ่ม |
| `POST /parameters`         | required       | `cems_wpms_requests:edit`           | ต้อง resolve เป็น active eligible factory; service ปัจจุบันไม่ได้ตัด location scope เพิ่ม |
| `PUT /:id/form`            | required       | `cems_wpms_requests:edit`           | owner ของคำขอเดิม                                                                         |
| `POST /direct-connections` | required       | `cems_wpms_requests:direct_connect` | actor restriction + permission scope + active eligible factory ตามหัวข้อ endpoint         |

## Shared Top-level Request Fields

ตารางนี้ใช้กับ operator flows ทั้ง 3 endpoint คือ `POST /measurement-points`, `POST /parameters` และ `PUT /:id/form`

| Field                         | Location | Required    | Nullable           | Type     | Validation และ behavior                                                                                                                                                                                                           |
| ----------------------------- | -------- | ----------- | ------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requestType`                 | body     | No          | No                 | enum     | รับได้เฉพาะ `PUT /:id/form`; ถ้าส่งต้องเป็น `NEW_CONNECTION`, `ADD_MEASUREMENT_POINT` หรือ `ADD_PARAMETER` และตรงกับคำขอเดิม; `POST /measurement-points` และ `POST /parameters` ปฏิเสธ field นี้และ backend stamp ค่าตาม endpoint |
| `factoryId`                   | body     | Yes         | No                 | string   | trim แล้วต้องยาว 1-64                                                                                                                                                                                                             |
| `factoryName`                 | body     | Yes         | No                 | string   | trim แล้วต้องยาว 1-500                                                                                                                                                                                                            |
| `factoryRegistrationNo`       | body     | No          | Yes                | string   | trim แล้วต้องยาว 1-64; ถ้าไม่ส่ง, ส่ง `null` หรือส่งค่าว่าง backend fallback เป็น `factoryId`                                                                                                                                     |
| `industryMainOrder`           | body     | No          | Yes                | string   | trim แล้วไม่เกิน 128                                                                                                                                                                                                              |
| `industryMainOrderLabel`      | body     | No          | Yes                | string   | trim แล้วไม่เกิน 500                                                                                                                                                                                                              |
| `industrySubOrder`            | body     | No          | Yes                | string   | trim แล้วไม่เกิน 128                                                                                                                                                                                                              |
| `businessActivity`            | body     | No          | Yes                | string   | trim แล้วไม่เกิน 4000                                                                                                                                                                                                             |
| `eia`                         | body     | No          | Yes                | enum     | `มี`, `ไม่มี`, `มี IEE`, `มี EIA`, `มี EHIA`, `อื่นๆ`                                                                                                                                                                             |
| `eiaOther`                    | body     | Conditional | Yes                | string   | trim แล้วไม่เกิน 500; required เมื่อ `eia = "อื่นๆ"`                                                                                                                                                                              |
| `hasEia`                      | body     | No          | Yes                | boolean  | ถ้าส่งพร้อม `eia` ต้องตรงกับค่าที่ derive จาก `eia`; backend normalize ใหม่เมื่อ `eia` มีค่า                                                                                                                                      |
| `projectName`                 | body     | No          | Yes                | string   | trim แล้วไม่เกิน 500                                                                                                                                                                                                              |
| `address`                     | body     | No          | Yes                | string   | trim แล้วไม่เกิน 1000                                                                                                                                                                                                             |
| `regionCode`                  | body     | No          | Yes                | string   | trim แล้วไม่เกิน 64                                                                                                                                                                                                               |
| `regionName`                  | body     | No          | Yes                | string   | trim แล้วไม่เกิน 128                                                                                                                                                                                                              |
| `provinceCode`                | body     | No          | Yes                | string   | trim แล้วไม่เกิน 32                                                                                                                                                                                                               |
| `provinceName`                | body     | No          | Yes                | string   | trim แล้วไม่เกิน 128                                                                                                                                                                                                              |
| `districtCode`                | body     | No          | Yes                | string   | trim แล้วไม่เกิน 32                                                                                                                                                                                                               |
| `districtName`                | body     | No          | Yes                | string   | trim แล้วไม่เกิน 128                                                                                                                                                                                                              |
| `subdistrictCode`             | body     | No          | Yes                | string   | trim แล้วไม่เกิน 32                                                                                                                                                                                                               |
| `subdistrictName`             | body     | No          | Yes                | string   | trim แล้วไม่เกิน 128                                                                                                                                                                                                              |
| `industrialEstateCode`        | body     | No          | Yes                | string   | trim แล้วไม่เกิน 32                                                                                                                                                                                                               |
| `industrialEstateName`        | body     | No          | Yes                | string   | trim แล้วไม่เกิน 255                                                                                                                                                                                                              |
| `latitude`                    | body     | No          | Yes                | number   | อยู่ในช่วง `-90..90`                                                                                                                                                                                                              |
| `longitude`                   | body     | No          | Yes                | number   | อยู่ในช่วง `-180..180`                                                                                                                                                                                                            |
| `systemType`                  | body     | Yes         | No                 | enum     | `CEMS` หรือ `WPMS`                                                                                                                                                                                                                |
| `type`                        | body     | No          | No                 | enum     | alias จาก frontend; รับ `CEMS` หรือ `WPMS` แล้ว backend strip ออก; validator ไม่เปรียบเทียบ field นี้กับ `systemType` ดังนั้น client ใหม่ควรส่งเฉพาะ `systemType`                                                                 |
| `contactName`                 | body     | Conditional | No after normalize | string   | trim แล้วไม่เกิน 255; ถ้าไม่มี `contactPersons` ต้องมีคู่กับ `contactPhone`                                                                                                                                                       |
| `contactPhone`                | body     | Conditional | No after normalize | string   | trim แล้วไม่เกิน 64; ถ้าไม่มี `contactPersons` ต้องมีคู่กับ `contactName`                                                                                                                                                         |
| `contactEmail`                | body     | No          | Yes                | string   | email <=255; backend ลบ invisible formatting chars ก่อน validate                                                                                                                                                                  |
| `contactPersons`              | body     | Conditional | No after normalize | array    | 1-20 contacts; ถ้าไม่มี array ต้องมี `contactName` และ `contactPhone`                                                                                                                                                             |
| `notificationEmails`          | body     | No          | No after normalize | string[] | email array สูงสุด 20; backend dedupe และ default เป็น `[contactEmail]` เมื่อมี `contactEmail`                                                                                                                                    |
| `officerNotificationEmails`   | body     | No          | No after normalize | string[] | email array สูงสุด 20; backend dedupe; default `[]`                                                                                                                                                                               |
| `informationProviderName`     | body     | No          | Yes                | string   | trim แล้วไม่เกิน 255                                                                                                                                                                                                              |
| `informationProviderPosition` | body     | No          | Yes                | string   | trim แล้วไม่เกิน 255                                                                                                                                                                                                              |
| `measurementPoints`           | body     | Yes         | No                 | array    | 1-100 measurement points                                                                                                                                                                                                          |
| `remarks`                     | body     | No          | Yes                | string   | trim แล้วไม่เกิน 1000                                                                                                                                                                                                             |
| unknown field                 | body     | No          | -                  | any      | reject เพราะ top-level object เป็น `.strict()`                                                                                                                                                                                    |

## Shared Nested Fields

### `contactPersons[]`

| Field      | Location | Required | Nullable | Type   | Validation  |
| ---------- | -------- | -------- | -------- | ------ | ----------- |
| `name`     | body     | Yes      | No       | string | trim 1-255  |
| `phone`    | body     | Yes      | No       | string | trim 1-64   |
| `email`    | body     | No       | Yes      | string | email <=255 |
| `position` | body     | No       | Yes      | string | trim <=255  |

### `measurementPoints[]`

| Field                    | Location | Required      | Nullable           | Type     | Validation และ behavior                                                                                               |
| ------------------------ | -------- | ------------- | ------------------ | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `pointName`              | body     | Yes           | No                 | string   | trim 1-255                                                                                                            |
| `pointCode`              | body     | Flow-specific | Yes                | string   | trim 1-64; add-parameter และ direct-connection require field นี้                                                      |
| `pointType`              | body     | Conditional   | No                 | enum     | `STACK`, `WASTEWATER`, `OTHER`; ละได้เมื่อ backend infer ได้จาก `details.monitoringPointKind` หรือ point-level `type` |
| `latitude`               | body     | No            | Yes                | number   | `-90..90`                                                                                                             |
| `longitude`              | body     | No            | Yes                | number   | `-180..180`                                                                                                           |
| `parameters`             | body     | No            | No after normalize | string[] | 1-50 entries เมื่อส่ง; trim ต่อ item; backend split comma, dedupe, และตัดค่า `ไม่มี`                                  |
| `description`            | body     | No            | Yes                | string   | trim <=1000                                                                                                           |
| `details`                | body     | Flow-specific | Yes                | object   | schema เป็น generic JSON record; business validation อยู่ใน service/validator                                         |
| `documentsAndImages`     | body     | Flow-specific | No after normalize | array    | สูงสุด 50; backend ตัด placeholder ที่ยังไม่มีไฟล์จริง                                                                |
| `measurementInstruments` | body     | Flow-specific | Yes                | object   | required ใน add-point/add-parameter; direct-connection อนุญาต null                                                    |

กฎร่วมของ `measurementPoints[]`

- ชื่อ `pointName` ห้ามซ้ำกันใน request เดียวหลัง trim และ lowercase
- `pointCode` ถ้ามี ห้ามซ้ำกันใน request เดียวหลัง trim และ lowercase
- โลโก้บริษัท (`title = "สัญลักษณ์ของโรงงานหรือโลโก้บริษัท"`) ได้เพียง 1 ไฟล์ต่อ request

### `measurementPoints[].documentsAndImages[]`

| Field         | Location | Required    | Nullable | Type    | Validation                                 |
| ------------- | -------- | ----------- | -------- | ------- | ------------------------------------------ |
| `title`       | body     | Yes         | No       | string  | trim 1-255                                 |
| `description` | body     | No          | Yes      | string  | trim <=1000                                |
| `link`        | body     | Conditional | Yes      | string  | URL <=2048 และต้องเป็น `http` หรือ `https` |
| `fileName`    | body     | No          | Yes      | string  | trim <=255                                 |
| `fileUrl`     | body     | Conditional | Yes      | string  | URL <=2048 และต้องเป็น `http` หรือ `https` |
| `fileType`    | body     | No          | Yes      | string  | trim <=128                                 |
| `fileSize`    | body     | No          | Yes      | integer | `1..5,242,880` bytes (5 MiB)               |

กฎร่วมของ document rows

- แต่ละ row ต้องมีอย่างน้อย `link` หรือ `fileUrl`
- row placeholder ที่มีเพียง `title`/`description` และ metadata อื่นว่างทั้งหมด จะถูกลบทิ้งก่อน validation หลัก
- ถ้าส่ง metadata ของไฟล์ เช่น `fileName` แต่ไม่มี `link` หรือ `fileUrl` จะถูก reject

### `measurementPoints[].measurementInstruments`

| Field            | Location | Required | Nullable           | Type   | Validation                                                                    |
| ---------------- | -------- | -------- | ------------------ | ------ | ----------------------------------------------------------------------------- |
| `converterBrand` | body     | No       | Yes                | string | trim <=255                                                                    |
| `converterModel` | body     | No       | Yes                | string | trim <=255                                                                    |
| `parameters`     | body     | No       | No after normalize | array  | สูงสุด 100; default `[]`; บาง flow backend auto-fill จาก requested parameters |

### `measurementPoints[].measurementInstruments.parameters[]`

| Field               | Location | Required | Nullable | Type    | Validation                |
| ------------------- | -------- | -------- | -------- | ------- | ------------------------- |
| `parameter`         | body     | Yes      | No       | string  | trim 1-128                |
| `technique`         | body     | No       | Yes      | string  | trim <=255                |
| `range`             | body     | No       | Yes      | string  | trim <=255                |
| `brand`             | body     | No       | Yes      | string  | trim <=255                |
| `supplier`          | body     | No       | Yes      | string  | trim <=255                |
| `eiaStandard`       | body     | No       | Yes      | string  | trim <=255                |
| `standardCondition` | body     | No       | Yes      | boolean | nullable                  |
| `dryBasis`          | body     | No       | Yes      | boolean | nullable                  |
| `oxygenOrExcessAir` | body     | No       | Yes      | boolean | nullable                  |
| `standardCriteria`  | body     | No       | Yes      | object  | ดูตาราง criteria ด้านล่าง |
| `eiaCriteria`       | body     | No       | Yes      | object  | ดูตาราง criteria ด้านล่าง |

### `standardCriteria` และ `eiaCriteria`

| Field           | Location | Required    | Nullable | Type             | Validation และ behavior                                                                      |
| --------------- | -------- | ----------- | -------- | ---------------- | -------------------------------------------------------------------------------------------- |
| `enabled`       | body     | Yes         | No       | boolean          | รับ string `true`/`false` ได้ผ่าน preprocess                                                 |
| `standardValue` | body     | Conditional | Yes      | string \| number | เมื่อ enabled และมีค่าจริง ต้องเป็น finite positive number ที่สร้าง 80% warning boundary ได้ |
| `rows`          | body     | Conditional | No       | array            | สูงสุด 3 rows; เมื่อ enabled จริงต้องมี `normal`, `warning`, `critical` ครบและไม่ซ้ำ         |
| `rows[].level`  | body     | Yes         | No       | enum             | `normal`, `warning`, `critical`                                                              |
| `rows[].min`    | body     | Yes         | Yes      | number           | finite number หรือ `null`                                                                    |
| `rows[].max`    | body     | Yes         | Yes      | number           | finite number หรือ `null`                                                                    |

criteria normalization สำคัญ

- ถ้า `enabled = true` และ `standardValue` เป็นตัวเลขที่ถูกต้อง backend จะ derive rows เป็น 3 ระดับอัตโนมัติ
- ถ้า `enabled = true` แต่ไม่มีค่า meaningful ทั้ง `standardValue` และ row ranges backend จะ normalize กลับเป็น `enabled = false`
- ถ้า `enabled = false` และไม่มีค่า meaningful backend จะตอบกลับ `{ "enabled": false, "standardValue": null, "rows": [] }`

## Shared Detail-level Business Rules

`measurementPoints[].details` เป็น generic JSON object แต่ backend ใช้ business rules ต่อไปนี้

- key ของ `details` ต้องเป็น string ยาว 1-128 ตัวอักษร
- value รับ JSON scalar, `null`, object หรือ array; array แต่ละระดับมีได้สูงสุด 100 รายการ
- unknown detail key ผ่าน generic schema ได้; มีเฉพาะ key ที่ระบุด้านล่างที่ถูกตรวจ business rule เพิ่ม

### Shared rules ทุกระบบ

- parameter-group fields `eligibleParameters`, `exemptedParameters`, `connectedParameters`, `pendingParameters`, `requestedParameters`, `timeSharingParameters` ถ้าส่งต้องเป็น `string[]`
- ค่า `ไม่มี` ใช้ได้เฉพาะกรณีเป็นตัวเดียวใน array
- `requestedParameters` ห้ามมีค่า `ไม่มี`
- ส่ง `requestedParameters` ได้โดยไม่ต้องส่ง `pendingParameters`
- ถ้าส่งทั้ง `requestedParameters` และ `pendingParameters` ทุกค่าใน `requestedParameters` ต้องเป็น subset ของ `pendingParameters`
- ถ้าส่ง `requestedParameters` แล้ว `measurementInstruments.parameters` ต้องมีชุดค่าเดียวกันกับ `requestedParameters`
- `hasTreatmentSystem` ถ้าส่งต้องเป็น `มี` หรือ `ไม่มี`
- ถ้า `hasTreatmentSystem = "มี"` ต้องมี `treatmentSystem` และห้ามเป็น `ไม่มี`
- ถ้า `hasTreatmentSystem = "ไม่มี"` then `treatmentSystem` ต้องว่างหรือมีแค่ `ไม่มี`
- ถ้า `treatmentSystem` มีค่า `อื่นๆ` ต้องส่ง `treatmentSystemOther`
- ถ้า `connectionDevice = "อื่นๆ"` ต้องส่ง `connectionDeviceOther`

### CEMS-only rules

- `pointType` ต้องเป็น `STACK`
- `details.monitoringPointKind` ถ้าส่งต้องเป็น `CEMS`
- ห้ามส่ง WPMS-only fields เช่น `averageWastewaterDischarge`, `instrumentLatitude`, `wastewaterSource`
- `stackShape` required
- `stackShape = "วงกลม"` ต้องมี `stackDiameter`
- `stackShape = "สี่เหลี่ยม"` ต้องมี `stackWidth` และ `stackLength`
- `stackShape = "อื่นๆ"` ต้องมี `stackShapeOther`
- `legalAnnexNo` ถ้าส่งต้องเป็น string array ที่มีเฉพาะ `"1"` ถึง `"13"`
- `exemptedParameterRegulationClauses` ถ้าส่งต้องเป็นหนึ่งใน `ไม่มี`, `4(1)`, `4(2)`, `11(3)`, `อื่นๆ`
- ถ้า `exemptedParameterRegulationClauses = "อื่นๆ"` ต้องมี `exemptedParameterRegulationClauseOther` และยาวไม่เกิน 500
- `primaryFuel` หรือ `secondaryFuel` ถ้ามีข้อความแนว `อื่นๆ`, `ชีวมวล`, `biomass` ต้องมี field `primaryFuelOther` หรือ `secondaryFuelOther`
- `combustionControlSystem` ถ้าส่งต้องเป็นหนึ่งใน `ระบบปิด`, `ระบบเปิด`, `ควบคุมอัตโนมัติ`

### WPMS-only rules

- `pointType` ต้องเป็น `WASTEWATER`
- `details.monitoringPointKind` ถ้าส่งต้องเป็น `WPMS`
- ห้ามส่ง CEMS-only fields เช่น `timeSharingParameters`, `sharedStackCode`, `stackShape`, `legalAnnexNo`
- ถ้า `hasTreatmentSystem = "มี"` ต้องมี `maxTreatmentCapacity`

## Flow-specific Contracts

## `POST /api/v1/cems-wpms-requests/measurement-points`

สร้างคำขอ `ADD_MEASUREMENT_POINT` สำหรับผู้ประกอบการ

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:edit`
- Data scope: ต้อง resolve identifier เป็น active row ใน `eligible_factories`; service ปัจจุบันไม่ได้ตัด location scope เพิ่ม

### Request Delta From Shared Contract

| Field                                        | Location | Required    | Nullable | Type   | Additional rule                                                                                         |
| -------------------------------------------- | -------- | ----------- | -------- | ------ | ------------------------------------------------------------------------------------------------------- |
| `requestType`                                | body     | No          | No       | -      | backend ไม่รับ user intent ผ่าน field นี้ใน dedicated endpoint และจะ stamp เป็น `ADD_MEASUREMENT_POINT` |
| `measurementPoints[].details`                | body     | Yes         | No       | object | ต้องมีและต้องไม่เป็น object ว่าง                                                                        |
| `measurementPoints[].measurementInstruments` | body     | Yes         | No       | object | ห้ามเป็น `null`                                                                                         |
| `measurementPoints[].documentsAndImages`     | body     | Conditional | No       | array  | required เมื่อ `systemType = "CEMS"`; WPMS ส่งว่างได้                                                   |
| `measurementPoints[].pointCode`              | body     | No          | Yes      | string | จุดใหม่ปกติ backend จะ clear ค่า pending code ก่อนบันทึก                                                |

### Minimal Valid Request

```json
{
  "factoryId": "F000123",
  "factoryName": "โรงงานตัวอย่าง",
  "factoryRegistrationNo": "น.60-1/2560",
  "systemType": "CEMS",
  "contactPersons": [
    {
      "name": "สมชาย ใจดี",
      "phone": "0812345678",
      "email": "ops@example.com",
      "position": "ผู้ประสานงาน"
    }
  ],
  "measurementPoints": [
    {
      "pointName": "ปล่องระบาย A",
      "pointType": "STACK",
      "details": {
        "monitoringPointKind": "CEMS",
        "stackShape": "วงกลม",
        "stackDiameter": 1.2,
        "hasTreatmentSystem": "มี",
        "treatmentSystem": "ระบบดักจับฝุ่น",
        "connectionDevice": "POMS Box (กรอ.)"
      },
      "documentsAndImages": [
        {
          "title": "ภาพถ่ายปล่อง",
          "fileUrl": "https://example.com/uploads/stack-a.jpg",
          "fileName": "stack-a.jpg",
          "fileType": "image/jpeg",
          "fileSize": 2048
        }
      ],
      "measurementInstruments": {
        "converterBrand": "Converter Brand",
        "converterModel": "CV-100",
        "parameters": [
          {
            "parameter": "NOx (ppm)",
            "technique": "NDIR"
          }
        ]
      }
    }
  ],
  "remarks": "ขอเพิ่มจุดตรวจวัดปล่องใหม่"
}
```

### Minimal Success Response

```json
{
  "success": true,
  "data": {
    "id": 101,
    "requestType": "ADD_MEASUREMENT_POINT",
    "requestTypeLabel": "เพิ่มจุดตรวจวัด",
    "status": "PENDING_DESIGN_REVIEW",
    "statusLabel": "รอพิจารณาแบบ",
    "measurementPoints": [
      {
        "pointName": "ปล่องระบาย A",
        "pointCode": null
      }
    ]
  }
}
```

### Validation And Business Rules

- ต้อง resolve โรงงานไปยัง active `eligible_factories` ได้ มิฉะนั้นตอบ `404 NOT_FOUND`
- backend clear `pointCode` ของจุดใหม่ก่อนบันทึก แม้ client ส่งค่ามา
- duplicate `pointName` และ duplicate `pointCode` ภายใน request เดียวถูก reject
- `CEMS` ต้องมีเอกสารแนบอย่างน้อย 1 รายการต่อ point; `WPMS` ไม่บังคับ

### Errors

ใช้ [shared error envelope](../../shared/README.md)

| HTTP status | Code               | Condition                                              | Client action                       |
| ----------- | ------------------ | ------------------------------------------------------ | ----------------------------------- |
| `400`       | `VALIDATION_ERROR` | body ไม่ผ่าน zod validation หรือ detail business rules | แก้ field ตาม `issues[].pathString` |
| `401`       | `UNAUTHORIZED`     | ไม่มี token หรือ token ใช้ไม่ได้                       | login ใหม่                          |
| `403`       | `FORBIDDEN`        | ไม่มี `cems_wpms_requests:edit`                        | ซ่อนปุ่มส่งคำขอ                     |
| `404`       | `NOT_FOUND`        | ไม่พบ active eligible factory                          | refresh ข้อมูลโรงงานก่อนส่งใหม่     |

## `POST /api/v1/cems-wpms-requests/parameters`

สร้างคำขอ `ADD_PARAMETER` ให้จุดตรวจวัดเดิม

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:edit`
- Data scope: ต้อง resolve identifier เป็น active row ใน `eligible_factories`; service ปัจจุบันไม่ได้ตัด location scope เพิ่ม

### Request Delta From Shared Contract

| Field                                        | Location | Required | Nullable | Type   | Additional rule                                   |
| -------------------------------------------- | -------- | -------- | -------- | ------ | ------------------------------------------------- |
| `requestType`                                | body     | No       | No       | -      | backend จะ stamp เป็น `ADD_PARAMETER`             |
| `measurementPoints`                          | body     | Yes      | No       | array  | ต้องมี exactly 1 point                            |
| `measurementPoints[].pointCode`              | body     | Yes      | No       | string | ต้องเป็นรหัสจุดเดิมของ point ที่จะเพิ่ม parameter |
| `measurementPoints[].details`                | body     | Yes      | No       | object | ต้องมีและต้องไม่ว่าง                              |
| `measurementPoints[].measurementInstruments` | body     | Yes      | No       | object | ห้ามเป็น `null`                                   |
| `measurementPoints[].documentsAndImages`     | body     | No       | No       | array  | ไม่บังคับ แม้เป็น `CEMS`                          |

### Minimal Valid Request

```json
{
  "factoryId": "F000123",
  "factoryName": "โรงงานตัวอย่าง",
  "factoryRegistrationNo": "น.60-1/2560",
  "systemType": "CEMS",
  "contactPersons": [
    {
      "name": "สมชาย ใจดี",
      "phone": "0812345678",
      "email": "ops@example.com",
      "position": "ผู้ประสานงาน"
    }
  ],
  "measurementPoints": [
    {
      "pointName": "ปล่องระบาย A",
      "pointCode": "S2001",
      "pointType": "STACK",
      "details": {
        "monitoringPointKind": "CEMS",
        "pendingParameters": ["CO (ppm)"],
        "requestedParameters": ["CO (ppm)"],
        "stackShape": "วงกลม",
        "stackDiameter": 1.2,
        "hasTreatmentSystem": "มี",
        "treatmentSystem": "ระบบดักจับฝุ่น",
        "connectionDevice": "POMS Box (กรอ.)"
      },
      "documentsAndImages": [],
      "measurementInstruments": {
        "converterBrand": "Converter Brand",
        "converterModel": "CV-100",
        "parameters": [
          {
            "parameter": "CO (ppm)",
            "technique": "NDIR"
          }
        ]
      }
    }
  ]
}
```

### Minimal Success Response

```json
{
  "success": true,
  "data": {
    "id": 102,
    "requestType": "ADD_PARAMETER",
    "requestTypeLabel": "เพิ่มพารามิเตอร์",
    "status": "PENDING_DESIGN_REVIEW",
    "measurementPoints": [
      {
        "pointName": "ปล่องระบาย A",
        "pointCode": "S2001",
        "parameters": ["CO (ppm)"]
      }
    ]
  }
}
```

### Validation And Business Rules

- ต้องมี exactly 1 measurement point
- `pointCode` ต้องมี เพราะ flow นี้อ้างถึงจุดเดิม
- ถ้า `details.requestedParameters` มีค่า ชุดค่าต้องตรงกับ `measurementInstruments.parameters`
- service recheck ซ้ำอีกชั้นว่า point เดียว, pointCode มี, details มี, measurementInstruments มี
- ต้อง resolve active eligible factory ได้เหมือน add-point

### Errors

ใช้ [shared error envelope](../../shared/README.md)

| HTTP status | Code               | Condition                                                                                                     | Client action                    |
| ----------- | ------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `400`       | `VALIDATION_ERROR` | ไม่มี `pointCode`, มีหลาย point, instrument parameters ไม่ตรง requested set หรือ field อื่นไม่ผ่าน validation | แก้ payload ให้ตรงกับ point เดิม |
| `401`       | `UNAUTHORIZED`     | ไม่มี token หรือ token ใช้ไม่ได้                                                                              | login ใหม่                       |
| `403`       | `FORBIDDEN`        | ไม่มี `cems_wpms_requests:edit`                                                                               | ซ่อนปุ่มส่งคำขอ                  |
| `404`       | `NOT_FOUND`        | ไม่พบ active eligible factory                                                                                 | refresh ข้อมูลโรงงานก่อนส่งใหม่  |

## `PUT /api/v1/cems-wpms-requests/:id/form`

ส่งแบบแก้ไขหลังเจ้าหน้าที่เปลี่ยนสถานะคำขอเป็น `WAITING_FACTORY_REVISION`

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:edit`
- Data scope: owner ของคำขอเดิม

### Request Delta From Shared Contract

| Field             | Location | Required              | Nullable            | Type    | Additional rule                                               |
| ----------------- | -------- | --------------------- | ------------------- | ------- | ------------------------------------------------------------- |
| `id`              | path     | Yes                   | No                  | integer | ต้องเป็นจำนวนเต็ม >= 1                                        |
| `requestType`     | body     | No                    | No                  | enum    | ถ้าส่งมาและไม่ตรงกับ `request.requestType` เดิม ระบบตอบ `400` |
| other body fields | body     | ตาม request type เดิม | ตาม shared contract | object  | backend inject `requestType` เดิมเข้า validation อีกครั้ง     |

### Minimal Valid Request

```json
{
  "factoryId": "F000123",
  "factoryName": "โรงงานตัวอย่าง",
  "factoryRegistrationNo": "น.60-1/2560",
  "systemType": "CEMS",
  "contactPersons": [
    {
      "name": "สมชาย ใจดี",
      "phone": "0812345678",
      "email": "ops@example.com",
      "position": "ผู้ประสานงาน"
    }
  ],
  "measurementPoints": [
    {
      "pointName": "ปล่องระบาย A",
      "pointType": "STACK",
      "details": {
        "monitoringPointKind": "CEMS",
        "stackShape": "วงกลม",
        "stackDiameter": 1.2,
        "hasTreatmentSystem": "มี",
        "treatmentSystem": "ระบบดักจับฝุ่น",
        "connectionDevice": "POMS Box (กรอ.)"
      },
      "documentsAndImages": [
        {
          "title": "ภาพถ่ายปล่อง",
          "fileUrl": "https://example.com/uploads/stack-a.jpg",
          "fileName": "stack-a.jpg",
          "fileType": "image/jpeg",
          "fileSize": 2048
        }
      ],
      "measurementInstruments": {
        "converterBrand": "Converter Brand",
        "converterModel": "CV-100",
        "parameters": [
          {
            "parameter": "NOx (ppm)",
            "technique": "NDIR"
          }
        ]
      }
    }
  ]
}
```

### Minimal Success Response

```json
{
  "success": true,
  "data": {
    "id": 101,
    "requestType": "ADD_MEASUREMENT_POINT",
    "status": "REVISED_PENDING_DESIGN_REVIEW",
    "statusLabel": "แก้ไขแล้ว/รอพิจารณาแบบ"
  }
}
```

### Validation And Business Rules

- path `id` ต้องเป็นจำนวนเต็มบวก
- request ต้องมีอยู่จริง
- requester ต้องเป็น owner ของคำขอ
- request เดิมต้องอยู่สถานะ `WAITING_FACTORY_REVISION`
- backend ใช้ `requestType` เดิมของคำขอมา validate body อีกครั้ง แม้ body จะ omit field นี้
- ถ้าเป็น add-parameter ระบบ preserve `pointCode`; ถ้าเป็น new connection หรือ add-point ระบบ clear pending point codes ของจุดใหม่ก่อน replace form
- หลังผ่าน validation จะเปลี่ยนสถานะเป็น `REVISED_PENDING_DESIGN_REVIEW`

### Errors

ใช้ [shared error envelope](../../shared/README.md)

| HTTP status | Code               | Condition                                                                   | Client action                       |
| ----------- | ------------------ | --------------------------------------------------------------------------- | ----------------------------------- |
| `400`       | `VALIDATION_ERROR` | body ไม่ผ่านกฎของ request type เดิม                                         | แก้ field ตาม `issues[].pathString` |
| `400`       | `BAD_REQUEST`      | พยายามเปลี่ยน `requestType` หรือคำขอไม่อยู่สถานะ `WAITING_FACTORY_REVISION` | reload detail/status ของคำขอเดิม    |
| `401`       | `UNAUTHORIZED`     | ไม่มี token หรือ token ใช้ไม่ได้                                            | login ใหม่                          |
| `403`       | `FORBIDDEN`        | ไม่มี permission หรือไม่ใช่ owner ของคำขอ                                   | ซ่อนการแก้ไข                        |
| `404`       | `NOT_FOUND`        | ไม่พบคำขอ หรือหา active eligible factory ใหม่ไม่เจอ                         | refresh รายการคำขอ                  |

## `POST /api/v1/cems-wpms-requests/direct-connections`

เจ้าหน้าที่เพิ่มจุดตรวจวัดและเชื่อมต่อทันที โดยไม่ผ่านสถานะรอพิจารณาแบบ

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:direct_connect`
- Data scope: active eligible factory ต้องอยู่ภายใน permission scope ของเจ้าหน้าที่
- Actor restriction: `userType` ต้องเป็น `officer` หรือ `admin` และมี role `monitoring_kpm` หรือ `admin`
- role `admin` ผ่านข้อจำกัดภูมิภาค; role `monitoring_kpm` ที่ไม่ใช่ admin รับเฉพาะ scope `ALL` หรือ `IN_REGION` ที่ resolve region ได้อย่างน้อยหนึ่งค่าและทุกค่าเป็น `ภาคกลาง`; `regionalAccess` ต้องไม่มีค่าพื้นที่นอก `ภาคกลาง`

### Top-level Fields ของ Direct Connection

endpoint นี้ใช้ schema แยกและยืดหยุ่นกว่า operator flows

| Field                       | Location | Required    | Nullable | Type     | Validation และ behavior                                                                |
| --------------------------- | -------- | ----------- | -------- | -------- | -------------------------------------------------------------------------------------- |
| `factoryId`                 | body     | Conditional | Yes      | string   | ต้องมี `factoryId` หรือ `factoryRegistrationNo` อย่างน้อยหนึ่งค่า                      |
| `factoryName`               | body     | No          | Yes      | string   | trim <=500; ถ้าไม่ส่ง backend จะใช้ชื่อ canonical จาก eligible factory                 |
| `factoryRegistrationNo`     | body     | Conditional | Yes      | string   | ถ้าไม่ส่งและมี `factoryId`, backend fallback ใช้ `factoryId`                           |
| `industryMainOrder`         | body     | No          | Yes      | string   | trim <=128                                                                             |
| `industryMainOrderLabel`    | body     | No          | Yes      | string   | trim <=500                                                                             |
| `industrySubOrder`          | body     | No          | Yes      | string   | trim <=128                                                                             |
| `businessActivity`          | body     | No          | Yes      | string   | trim <=4000                                                                            |
| `eia`                       | body     | No          | Yes      | enum     | same enum as operator flow                                                             |
| `eiaOther`                  | body     | Conditional | Yes      | string   | required เมื่อ `eia = "อื่นๆ"`                                                         |
| `hasEia`                    | body     | No          | Yes      | boolean  | normalize จาก `eia` เมื่อมี                                                            |
| `projectName`               | body     | No          | Yes      | string   | trim <=500                                                                             |
| `address`                   | body     | No          | Yes      | string   | trim <=1000                                                                            |
| `latitude`                  | body     | No          | Yes      | number   | `-90..90`                                                                              |
| `longitude`                 | body     | No          | Yes      | number   | `-180..180`                                                                            |
| `systemType`                | body     | Yes         | No       | enum     | `CEMS` หรือ `WPMS`                                                                     |
| `type`                      | body     | No          | Yes      | enum     | alias จาก frontend; nullable ได้และถูก strip; validator ไม่เปรียบเทียบกับ `systemType` |
| `contactName`               | body     | No          | Yes      | string   | ถ้าไม่ส่ง backend ใส่ `""`                                                             |
| `contactPhone`              | body     | No          | Yes      | string   | ถ้าไม่ส่ง backend ใส่ `""`                                                             |
| `contactEmail`              | body     | No          | Yes      | string   | email <=255                                                                            |
| `contactPersons`            | body     | No          | Yes      | array    | max 20; nullable                                                                       |
| `notificationEmails`        | body     | No          | Yes      | string[] | max 20; nullable                                                                       |
| `officerNotificationEmails` | body     | No          | Yes      | string[] | max 20; nullable                                                                       |
| `measurementPoints`         | body     | Yes         | No       | array    | ต้องมี exactly 1 row                                                                   |
| `remarks`                   | body     | No          | Yes      | string   | trim <=1000                                                                            |

### `measurementPoints[0]` ของ Direct Connection

| Field                    | Location | Required | Nullable | Type     | Validation และ behavior                                                              |
| ------------------------ | -------- | -------- | -------- | -------- | ------------------------------------------------------------------------------------ |
| `pointName`              | body     | No       | Yes      | string   | ถ้าไม่ส่ง backend ใช้ค่า `pointCode`                                                 |
| `pointCode`              | body     | Yes      | No       | string   | trim 1-64; service และ repository recheck ซ้ำ                                        |
| `pointType`              | body     | No       | Yes      | enum     | ถ้าไม่ส่ง backend default เป็น `STACK` สำหรับ `CEMS` หรือ `WASTEWATER` สำหรับ `WPMS` |
| `latitude`               | body     | No       | Yes      | number   | `-90..90`                                                                            |
| `longitude`              | body     | No       | Yes      | number   | `-180..180`                                                                          |
| `parameters`             | body     | No       | Yes      | string[] | max 50                                                                               |
| `description`            | body     | No       | Yes      | string   | trim <=1000                                                                          |
| `details`                | body     | No       | Yes      | object   | nullable; CEMS/WPMS rules บางส่วนยังมีผล                                             |
| `documentsAndImages`     | body     | No       | Yes      | array    | nullable; placeholder rows ถูกละทิ้งได้                                              |
| `measurementInstruments` | body     | No       | Yes      | object   | nullable                                                                             |

### Minimal Valid Request

```json
{
  "factoryId": "F000123",
  "factoryRegistrationNo": null,
  "systemType": "CEMS",
  "contactName": null,
  "contactPhone": null,
  "contactEmail": null,
  "contactPersons": null,
  "measurementPoints": [
    {
      "pointName": null,
      "pointCode": "S1128",
      "pointType": null,
      "parameters": null,
      "details": null,
      "documentsAndImages": null,
      "measurementInstruments": null
    }
  ],
  "remarks": null
}
```

### Minimal Success Response

```json
{
  "success": true,
  "data": {
    "id": 91,
    "requestType": "ADD_MEASUREMENT_POINT",
    "requestTypeLabel": "เพิ่มจุดตรวจวัด",
    "submissionSource": "OFFICER_DIRECT_API",
    "status": "CONNECTED",
    "statusLabel": "เชื่อมต่อแล้ว",
    "measurementPoints": [
      {
        "pointName": "S1128",
        "pointCode": "S1128",
        "pointType": "STACK"
      }
    ]
  }
}
```

### Validation And Business Rules

- actor ต้องผ่าน permission `cems_wpms_requests:direct_connect`
- actor ต้องผ่านข้อจำกัด role/scope ข้างต้น มิฉะนั้นตอบ `403`
- ต้อง resolve active eligible factory ภายใน officer scope ได้ มิฉะนั้นตอบ `404`
- `measurementPoints` ต้องมี exactly 1 row
- `pointCode` ต้องไม่ว่าง, ยาวไม่เกิน 64, และต้องไม่ชนกับ active connected point
- repository บันทึกคำขอด้วย `requestType = ADD_MEASUREMENT_POINT`, `submissionSource = OFFICER_DIRECT_API`, `status = CONNECTED`
- status history จะถูกบันทึกทันทีด้วยข้อความ direct-connect note

### Errors

ใช้ [shared error envelope](../../shared/README.md)

| HTTP status | Code               | Condition                                                                                                         | Client action                    |
| ----------- | ------------------ | ----------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `400`       | `VALIDATION_ERROR` | ไม่มี `factoryId/factoryRegistrationNo`, มีหลาย measurement points, document row ไม่ครบ, หรือ body ไม่ผ่าน schema | แก้ payload และส่งใหม่           |
| `401`       | `UNAUTHORIZED`     | ไม่มี token หรือ token ใช้ไม่ได้                                                                                  | login ใหม่                       |
| `403`       | `FORBIDDEN`        | ไม่มี `cems_wpms_requests:direct_connect`                                                                         | ซ่อน action สำหรับ user นี้      |
| `404`       | `NOT_FOUND`        | ไม่พบ active eligible factory ภายใน scope                                                                         | ตรวจ identifier และสิทธิ์พื้นที่ |
| `409`       | `CONFLICT`         | `pointCode` ซ้ำกับ active point                                                                                   | เปลี่ยนรหัสจุดตรวจวัด            |

## Review Payloads ที่เกี่ยวข้องกับการส่งแบบแก้ไข

แม้ไม่ใช่ 4 endpoint หลักของหน้านี้ แต่ frontend ที่ทำ flow แจ้งแก้ไขต้องใช้ payload ต่อไปนี้ร่วมด้วย

### `POST /api/v1/cems-wpms-requests/:id/review`

| Field            | Location | Required    | Nullable | Type    | Validation                                                  |
| ---------------- | -------- | ----------- | -------- | ------- | ----------------------------------------------------------- |
| `id`             | path     | Yes         | No       | integer | จำนวนเต็ม >=1                                               |
| `decision`       | body     | Yes         | No       | enum    | `APPROVE_DESIGN` หรือ `REQUEST_REVISION`                    |
| `revisionReason` | body     | Conditional | No       | string  | required เมื่อ `decision = "REQUEST_REVISION"`; trim 1-1000 |
| `officerNote`    | body     | No          | Yes      | string  | trim <=1000                                                 |

### `POST /api/v1/cems-wpms-requests/:id/status`

| Field            | Location | Required    | Nullable | Type    | Validation                                                                                     |
| ---------------- | -------- | ----------- | -------- | ------- | ---------------------------------------------------------------------------------------------- |
| `id`             | path     | Yes         | No       | integer | จำนวนเต็ม >=1                                                                                  |
| `action`         | body     | Yes         | No       | enum    | `APPROVE_FORM`, `REQUEST_REVISION`, `RETURN_TO_WAITING_CONNECTION`                             |
| `revisionReason` | body     | Conditional | No       | string  | required เมื่อ action เป็น `REQUEST_REVISION` หรือ `RETURN_TO_WAITING_CONNECTION`; trim 1-1000 |
| `officerNote`    | body     | No          | Yes      | string  | trim <=1000                                                                                    |

## API ที่ใช้เทสหลังกรอกฟอร์ม

เปิดหน้า interactive Swagger UI ได้ที่ `<BASE_URL>/api/v1/docs` หรืออ่าน OpenAPI JSON ที่ `<BASE_URL>/api/v1/openapi.json` จากนั้นกด `Authorize` เพื่อใส่ Bearer access token ก่อนใช้ `Try it out`

### `GET /api/v1/parameter-values/connection-test`

ใช้ดูข้อมูลทดสอบล่าสุดของ `stationId` หลังตั้งค่าอุปกรณ์แล้ว หน้า canonical อยู่ที่ [Parameter values](./parameter-values.md)

สิ่งที่ควรรู้

- permission คือ `cems_wpms_requests:view`
- query หลักคือ `stationId`
- response จัด `values` และ `statuses` ตามชื่อพารามิเตอร์พร้อมหน่วย
- ใช้ได้ทั้งจุดที่ `CONNECTED` และบางกรณีจุดในคำขอสถานะ `WAITING_CONNECTION` ที่ผู้เรียกมีสิทธิ์

### `POST /api/v1/device-connections/test-connection`

ใช้ตรวจ schema และสิทธิ์เข้าถึง station ของ config ก่อนบันทึก ปัจจุบัน service ตอบ `mode = "MOCK"` และ **ยังไม่เชื่อมต่อ transport/database จริง**

#### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:edit`
- Data scope: `stationId` ต้องเป็นจุด `CONNECTED` หรือจุดในคำขอ `WAITING_CONNECTION` ที่ผู้เรียกมีสิทธิ์

#### Request Fields

endpoint นี้รับ config เดี่ยวแบบ normalized; ไม่รับ batch `{ "configs": [...] }` หรือ form wrapper `{ "config": ... }` อ่าน field ย่อยทั้งหมดได้ที่ [Shared request contract ของ device config](./device-configs.md#shared-request-contract)

| Field                   | Location | Required | Nullable | Type   | Validation                                                                                     |
| ----------------------- | -------- | -------- | -------- | ------ | ---------------------------------------------------------------------------------------------- |
| `stationId`             | body     | Yes      | No       | string | trim 1-64                                                                                      |
| `deviceCode`            | body     | No       | Yes      | string | trim 1-64 เมื่อส่ง                                                                             |
| `protocol`              | body     | Yes      | No       | enum   | `POMS_BOX`, `MODBUS_RTU`, `MODBUS_TCP`, `MSSQL`, `MYSQL`                                       |
| `settings`              | body     | No       | Yes      | object | ส่ง `null`/ไม่ส่งได้; backend normalize เป็น `{}`; field ขึ้นกับ `protocol`                    |
| `channels`              | body     | No       | Yes      | array  | ส่ง `null`/ไม่ส่งได้; normalize เป็น `[]`; สูงสุด 200 rows; row ที่ส่งต้องมี string `dataType` |
| `statusManagement`      | body     | No       | Yes      | object | กฎวันเวลา/status ใช้ contract เดียวกับ device config                                           |
| unknown top-level field | body     | No       | -        | any    | reject เพราะ protocol object เป็น `.strict()`                                                  |

#### Minimal Valid Request

```json
{
  "stationId": "S2001",
  "deviceCode": "S2001/01",
  "protocol": "MSSQL",
  "settings": {
    "hostIp": "10.0.0.10",
    "port": 1433,
    "dbUser": "poms_reader",
    "dbPass": "test-only-placeholder",
    "dbName": "POMS"
  },
  "channels": [
    {
      "dataType": "CO (ppm)",
      "addressId": 1
    }
  ],
  "statusManagement": null
}
```

#### Success Response (`200 OK`)

```json
{
  "success": true,
  "data": {
    "success": true,
    "mode": "MOCK",
    "protocol": "MSSQL",
    "stationId": "S2001",
    "message": "Mock connection succeeded",
    "checkedAt": "2026-08-16T03:00:00.000Z",
    "details": {
      "endpoint": "10.0.0.10:1433/POMS",
      "channelCount": 1
    }
  }
}
```

#### Validation And Errors

- `400 VALIDATION_ERROR`: payload ไม่ตรง discriminator ของ `protocol`, `stationId` ว่าง, channels เกิน 200 หรือ schedule ไม่ผ่านกฎ
- `401 UNAUTHORIZED`: ไม่มี token หรือ token ใช้ไม่ได้
- `403 FORBIDDEN`: ไม่มี `cems_wpms_requests:edit` หรือ `stationId` อยู่นอก scope

- route source: [backend/src/modules/device-connections/device-connections.routes.ts](../../../../../backend/src/modules/device-connections/device-connections.routes.ts)
- controller: [backend/src/modules/device-connections/device-connections.controller.ts](../../../../../backend/src/modules/device-connections/device-connections.controller.ts)
- validator: [backend/src/modules/device-connections/device-connections.validator.ts](../../../../../backend/src/modules/device-connections/device-connections.validator.ts)
- service tests: [backend/tests/unit/device-connections.service.test.ts](../../../../../backend/tests/unit/device-connections.service.test.ts)
- route tests: [backend/tests/unit/device-connections.route.test.ts](../../../../../backend/tests/unit/device-connections.route.test.ts)

## Backend Maintainer Links

- Routes: [backend/src/modules/connection-requests/connection-requests.routes.ts](../../../../../backend/src/modules/connection-requests/connection-requests.routes.ts), [backend/src/modules/device-connections/device-connections.routes.ts](../../../../../backend/src/modules/device-connections/device-connections.routes.ts), [backend/src/modules/parameter-values/parameter-values.routes.ts](../../../../../backend/src/modules/parameter-values/parameter-values.routes.ts)
- Controller: [backend/src/modules/connection-requests/connection-requests.controller.ts](../../../../../backend/src/modules/connection-requests/connection-requests.controller.ts)
- Validator: [backend/src/modules/connection-requests/connection-requests.validator.ts](../../../../../backend/src/modules/connection-requests/connection-requests.validator.ts)
- Types: [backend/src/modules/connection-requests/connection-requests.types.ts](../../../../../backend/src/modules/connection-requests/connection-requests.types.ts)
- Service: [backend/src/modules/connection-requests/connection-requests.service.ts](../../../../../backend/src/modules/connection-requests/connection-requests.service.ts)
- EIA helper: [backend/src/modules/connection-requests/connection-request-eia.ts](../../../../../backend/src/modules/connection-requests/connection-request-eia.ts)
- Migrations: [backend/src/db/migrations/0019_create_cems_wpms_connection_requests.ts](../../../../../backend/src/db/migrations/0019_create_cems_wpms_connection_requests.ts), [backend/src/db/migrations/0021_extend_connection_request_forms.ts](../../../../../backend/src/db/migrations/0021_extend_connection_request_forms.ts), [backend/src/db/migrations/0022_add_connection_request_form_sections.ts](../../../../../backend/src/db/migrations/0022_add_connection_request_form_sections.ts), [backend/src/db/migrations/0024_add_connection_request_contacts.ts](../../../../../backend/src/db/migrations/0024_add_connection_request_contacts.ts), [backend/src/db/migrations/0025_add_connection_request_factory_snapshot.ts](../../../../../backend/src/db/migrations/0025_add_connection_request_factory_snapshot.ts), [backend/src/db/migrations/0026_add_connection_request_factory_coordinates.ts](../../../../../backend/src/db/migrations/0026_add_connection_request_factory_coordinates.ts), [backend/src/db/migrations/0047_add_canceled_connection_request_status.ts](../../../../../backend/src/db/migrations/0047_add_canceled_connection_request_status.ts), [backend/src/db/migrations/0066_add_connection_request_eia_assessment.ts](../../../../../backend/src/db/migrations/0066_add_connection_request_eia_assessment.ts), [backend/src/db/migrations/0074_create_officer_direct_connections.ts](../../../../../backend/src/db/migrations/0074_create_officer_direct_connections.ts)
- Tests: [backend/tests/unit/connection-requests.validator.test.ts](../../../../../backend/tests/unit/connection-requests.validator.test.ts), [backend/tests/unit/connection-requests.service.test.ts](../../../../../backend/tests/unit/connection-requests.service.test.ts), [backend/tests/unit/connection-requests.direct-connections.route.test.ts](../../../../../backend/tests/unit/connection-requests.direct-connections.route.test.ts), [backend/tests/unit/connection-request-form-enhancements.validator.test.ts](../../../../../backend/tests/unit/connection-request-form-enhancements.validator.test.ts)
- Evidence: [docs/backend/evidence/connection-requests/direct-connection-nullable-fields.tdd.md](../../../evidence/connection-requests/direct-connection-nullable-fields.tdd.md), [docs/backend/evidence/connection-requests/direct-connection-optional-documents.tdd.md](../../../evidence/connection-requests/direct-connection-optional-documents.tdd.md), [docs/backend/evidence/connection-requests/email-invisible-character-normalization.tdd.md](../../../evidence/connection-requests/email-invisible-character-normalization.tdd.md), [docs/backend/evidence/connection-requests/officer-direct-eligible-lookup.tdd.md](../../../evidence/connection-requests/officer-direct-eligible-lookup.tdd.md)
