# หน้าหลัก

> Owner: Backend

## Frontend Quick Start

หน้าแรกของผู้ประกอบการใช้ `GET /api/v1/operator-factories` เพื่อแสดงโรงงานของตนเองที่ sync มากับการ login ทุกแห่ง แล้วแยก `IN_POMS` กับ `NOT_IN_POMS` จาก active row ใน `cems_wpms_connected_measurement_points`. การเป็นโรงงานเข้าข่ายและสถานะคำขอเชื่อมต่อเป็นข้อมูลคนละส่วน จึงไม่ใช้แทนสถานะ POMS.

`GET /api/v1/operator-factory-dashboard` เดิมยังคง contract แบบ connected-only สำหรับหน้าที่ต้องการโรงงาน current/live ใน POMS เท่านั้น ไม่เปลี่ยนความหมายและไม่ใช้เป็น base list ของหน้าแรกผู้ประกอบการ.

การตีความ role, permission code, grouped permission alias และ scope keyword ใช้ canonical contract เดียวกับ [สิทธิ์การใช้งาน](../permissions/README.md)

### Main Flow

1. อ่านโรงงานที่ผู้ประกอบการเป็นเจ้าของจาก factory master และ access mapping ที่ sync ตอน login โดยบังคับ effective scope เป็น `OWN_FACTORY` แม้ token จะมี scope กว้างกว่า.
2. จับคู่ active `cems_wpms_connected_measurement_points`: พบอย่างน้อยหนึ่งจุดเป็น `IN_POMS`; ไม่พบเป็น `NOT_IN_POMS`.
3. แนบ `isEligible` จาก `eligible_factories` และ `latestConnectionRequest` จากคำขอ `NEW_CONNECTION` ล่าสุด โดยไม่ใช้สองค่านี้ตัดสิน POMS membership.
4. แนบ favorite, จุดตรวจวัด และค่ารายชั่วโมงล่าสุดสำหรับโรงงานที่อยู่ใน POMS; โรงงานที่ยังไม่เชื่อมต่อยังคงแสดงด้วย `measurementPoints: []`.
5. ใช้ `meta.summary` แสดงจำนวนโรงงานใน POMS, อยู่ระหว่างเชื่อมต่อ และยังไม่เชื่อมต่อบนหน้าแรก.

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/operator-factories' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

## Endpoint Summary

| งาน                          | Method | Path                                                                     | Auth   | Permission               | Contract                                                                                                                                          |
| ---------------------------- | ------ | ------------------------------------------------------------------------ | ------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| โรงงานของผู้ประกอบการทั้งหมด  | `GET`  | `/api/v1/operator-factories`                                             | Bearer | `dashboard:view`         | [Operator overview](#get-apiv1operator-factories)                                                                                                 |
| Dashboard โรงงานใน POMS เดิม | `GET`  | `/api/v1/operator-factory-dashboard`                                     | Bearer | `dashboard:view`         | [Connected-only dashboard](#get-apiv1operator-factory-dashboard)                                                                                  |
| จุดโรงงานสำหรับแผนที่สาธารณะ | `GET`  | `/api/v1/public/factory-map-points`                                      | No     | -                        | [Public map](#get-apiv1publicfactory-map-points)                                                                                                  |
| ข้อมูลทั่วไปของโรงงาน        | `GET`  | `/api/v1/cems-wpms-requests/factories/:factoryId/general`                | Bearer | `factories:view`         | [Factory general](#get-apiv1cems-wpms-requestsfactoriesfactoryidgeneral)                                                                          |
| ตั้งค่า favorite             | `PUT`  | `/api/v1/operator-factories/:factoryId/favorite`                         | Bearer | `dashboard.alerts:view`  | [Favorite](#put-apiv1operator-factoriesfactoryidfavorite)                                                                                         |
| ส่งออกข้อมูลตรวจวัด CSV      | `GET`  | `/api/v1/connected-measurement-points/:stationId/measurement-export.csv` | Bearer | `dashboard.stats:export` | [Measurement CSV export](../../shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidmeasurement-exportcsv) |

## Contracts

### `GET /api/v1/operator-factories`

Endpoint สำหรับหน้าแรกผู้ประกอบการโดยเฉพาะ ต้อง login เป็น `userType: "operator"` และมี `dashboard:view`. ผู้ใช้ชนิดอื่นตอบ `403` แม้มี permission code เดียวกัน และ backend บังคับอ่านเฉพาะโรงงานของ actor ด้วย `OWN_FACTORY`.

Query fields:

| Field                  | Type                         | Required | Rules                                                                                              |
| ---------------------- | ---------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `systemType`           | `CEMS` \| `WPMS`             | No       | คืนเฉพาะโรงงานที่มี active POMS point ของระบบนั้น; row ที่ยังไม่อยู่ใน POMS จะไม่ตรง filter นี้    |
| `favoriteOnly`         | boolean                      | No       | รองรับ `true`, `false`, `1`, `0`, `yes`, `no`; default `false`                                     |
| `pomsMembershipStatus` | `IN_POMS` \| `NOT_IN_POMS`   | No       | กรองจาก active `cems_wpms_connected_measurement_points` เท่านั้น                                   |

Request body: ไม่มี

Response fields:

| Field                                         | Type                                   | Meaning                                                                                                                  |
| --------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `data[].id`                                   | integer \| null                        | `factories.id` ของ factory master                                                                                        |
| `data[].eligibleFactoryId`                    | integer \| null                        | active `eligible_factories.id`; เป็น `null` ได้และไม่ใช่ตัวตัดสิน POMS membership                                       |
| `data[].factoryId`                            | string                                 | identifier โรงงานสำหรับ path/query                                                                                       |
| `data[].factoryName`                          | string                                 | ชื่อโรงงาน; row ที่ยังไม่อยู่ใน POMS ยังคงใช้ข้อมูล factory master ที่ sync ตอน login                                    |
| `data[].newRegistrationNo`                    | string \| null                         | เลขทะเบียนใหม่จากข้อมูลโรงงานที่ผู้ประกอบการเป็นเจ้าของ                                                                  |
| `data[].oldRegistrationNo`                    | string \| null                         | เลขทะเบียนเดิม                                                                                                           |
| `data[].factoryLogoUrl`                       | string \| null                         | URL โลโก้จากข้อมูล POMS เมื่อมี                                                                                           |
| `data[].industryMainOrder`                    | string \| null                         | รหัสประเภทโรงงานหลัก                                                                                                     |
| `data[].industryMainOrderLabel`               | string \| null                         | ชื่อประเภทโรงงานหลัก                                                                                                     |
| `data[].industrySubOrder`                     | string \| null                         | รหัสประเภทย่อย                                                                                                           |
| `data[].eia` / `data[].hasEia`                | string \| null / boolean \| null       | สถานะ EIA                                                                                                                |
| `data[].regionCode` / `data[].regionName`     | string \| null                         | ภูมิภาค                                                                                                                  |
| `data[].provinceCode` / `data[].provinceName` | string \| null                         | จังหวัด                                                                                                                  |
| `data[].province` / `data[].address`          | string \| null                         | จังหวัด compatibility field และที่อยู่                                                                                   |
| `data[].latitude` / `data[].longitude`        | string \| null                         | พิกัดโรงงาน                                                                                                              |
| `data[].districtCode` / `data[].districtName` | string \| null                         | อำเภอ/เขต                                                                                                                |
| `data[].industrialAreaType`                   | enum \| null                           | `INDUSTRIAL_ESTATE` หรือ `OUTSIDE_INDUSTRIAL_ESTATE`                                                                      |
| `data[].industrialAreaTypeLabel`              | string \| null                         | label ประเภทพื้นที่อุตสาหกรรม                                                                                            |
| `data[].industrialEstateCode/Name`            | string \| null                         | รหัสและชื่อนิคมอุตสาหกรรม                                                                                                |
| `data[].isEligible`                           | boolean                                | เป็นโรงงานเข้าข่ายหรือไม่; แยกจากสถานะ POMS                                                                              |
| `data[].eligibilityStatus`                    | `เข้าข่าย` \| `ไม่เข้าข่าย`             | label ของ `isEligible`                                                                                                    |
| `data[].isFavorite`                           | boolean                                | favorite ของผู้ใช้ปัจจุบัน                                                                                                |
| `data[].pomsMembershipStatus`                 | `IN_POMS` \| `NOT_IN_POMS`             | มีหรือไม่มี active connected point                                                                                        |
| `data[].pomsMembershipStatusLabel`            | string                                 | `อยู่ในระบบ POMS` หรือ `ยังไม่อยู่ในระบบ POMS`                                                                            |
| `data[].latestConnectionRequest`              | object \| null                         | คำขอประเภท `NEW_CONNECTION` ล่าสุด ไม่รวมคำขอเพิ่มจุดหรือเพิ่มพารามิเตอร์                                                |
| `data[].latestConnectionRequest.id`           | integer                                | ID คำขอ                                                                                                                  |
| `data[].latestConnectionRequest.requestNo`    | string                                 | เลขที่คำขอ                                                                                                               |
| `data[].latestConnectionRequest.requestType`  | `NEW_CONNECTION`                       | ประเภทคำขอคงที่ของ field นี้                                                                                              |
| `data[].latestConnectionRequest.systemType`   | `CEMS` \| `WPMS`                       | ระบบของคำขอ                                                                                                              |
| `data[].latestConnectionRequest.statusCode`   | connection request status              | status code ปัจจุบัน                                                                                                      |
| `data[].latestConnectionRequest.statusLabel`  | string                                 | label ภาษาไทย                                                                                                            |
| `data[].latestConnectionRequest.isInProgress` | boolean                                | `false` เมื่อ `CONNECTED` หรือ `CANCELED`; สถานะอื่นเป็น `true`                                                           |
| `data[].latestConnectionRequest.updatedAt`    | ISO 8601 date-time                     | เวลาที่คำขอล่าสุดเปลี่ยนแปลง                                                                                              |
| `data[].hasLatestHourlyMeasurement`           | boolean                                | flag ข้อมูลรอบรายชั่วโมงล่าสุด ใช้กติกาเดียวกับ connected-only dashboard                                                |
| `data[].monitoringPointCountBySystem`         | array                                  | จำนวน active point แยก `CEMS` และ `WPMS`                                                                                  |
| `data[].measurementPoints`                    | array                                  | active POMS points; เป็น `[]` เมื่อ `NOT_IN_POMS`                                                                         |
| `data[].status`                               | `แสดง`                                 | display status ของ row                                                                                                    |
| `meta.total`                                  | integer                                | จำนวน row หลังใช้ query filters                                                                                           |
| `meta.summary.all`                            | integer                                | จำนวน row ทั้งหมดหลัง filter และเท่ากับ `meta.total`                                                                      |
| `meta.summary.inPoms`                         | integer                                | จำนวน `IN_POMS`                                                                                                          |
| `meta.summary.connectionInProgress`           | integer                                | จำนวน `NOT_IN_POMS` ที่ latest connection request ยังดำเนินการอยู่                                                        |
| `meta.summary.notConnected`                   | integer                                | จำนวน `NOT_IN_POMS` ที่ไม่มีคำขออยู่ระหว่างดำเนินการ                                                                      |

Minimal response (`200 OK`) สำหรับโรงงานที่ sync ตอน login แล้วและอยู่ระหว่างขอเชื่อมต่อ:

```json
{
  "success": true,
  "data": [
    {
      "id": 7,
      "eligibleFactoryId": null,
      "factoryId": "F000123",
      "factoryName": "บริษัท โรงงานตัวอย่าง จำกัด",
      "newRegistrationNo": "10120000325542",
      "oldRegistrationNo": "3-34(3)-3/54นบ",
      "factoryLogoUrl": null,
      "industryMainOrder": "106",
      "industryMainOrderLabel": "ประเภทโรงงานลำดับที่ 106",
      "industrySubOrder": "33",
      "eia": null,
      "hasEia": null,
      "regionCode": null,
      "regionName": null,
      "provinceCode": "12",
      "provinceName": "นนทบุรี",
      "province": "นนทบุรี",
      "address": "39/5 หมู่ 4 ตำบลไทรใหญ่ อำเภอไทรน้อย จังหวัดนนทบุรี 11150",
      "latitude": "13.9975",
      "longitude": "100.3125",
      "districtCode": null,
      "districtName": "ไทรน้อย",
      "industrialAreaType": "OUTSIDE_INDUSTRIAL_ESTATE",
      "industrialAreaTypeLabel": "นอกนิคมอุตสาหกรรม",
      "industrialEstateCode": null,
      "industrialEstateName": null,
      "isEligible": false,
      "eligibilityStatus": "ไม่เข้าข่าย",
      "isFavorite": false,
      "pomsMembershipStatus": "NOT_IN_POMS",
      "pomsMembershipStatusLabel": "ยังไม่อยู่ในระบบ POMS",
      "latestConnectionRequest": {
        "id": 145,
        "requestNo": "CEMS-0145/2569",
        "requestType": "NEW_CONNECTION",
        "systemType": "CEMS",
        "statusCode": "PENDING_DESIGN_REVIEW",
        "statusLabel": "รอพิจารณาแบบ",
        "isInProgress": true,
        "updatedAt": "2026-08-18T10:15:00.000Z"
      },
      "hasLatestHourlyMeasurement": false,
      "monitoringPointCountBySystem": [
        { "systemType": "CEMS", "count": 0 },
        { "systemType": "WPMS", "count": 0 }
      ],
      "status": "แสดง",
      "measurementPoints": []
    }
  ],
  "meta": {
    "total": 1,
    "summary": {
      "all": 1,
      "inPoms": 0,
      "connectionInProgress": 1,
      "notConnected": 0
    }
  }
}
```

Business and filtering rules:

- `IN_POMS` ใช้ active connected point เท่านั้น; คำขอสถานะ `CONNECTED` ที่ยังไม่มี active point ยังคงเป็น `NOT_IN_POMS`.
- `isEligible` ไม่ทำให้โรงงานเป็น `IN_POMS` และโรงงานที่ `isEligible: false` ต้องยังแสดงข้อมูล factory master ของผู้ประกอบการ.
- `latestConnectionRequest` เลือกคำขอ `NEW_CONNECTION` ล่าสุดตามเวลา; คำขอ `ADD_MEASUREMENT_POINT` และ `ADD_PARAMETER` ไม่กระทบ field นี้.
- `systemType` ตรวจจาก active point เท่านั้นและไม่เดาจากคำขอล่าสุด ดังนั้นใช้ `systemType` พร้อม `pomsMembershipStatus=NOT_IN_POMS` จะได้รายการว่าง.
- กลุ่ม summary แบ่งแบบไม่ซ้ำกันเป็น `inPoms`, `connectionInProgress` และ `notConnected`; ทุกค่าคำนวณหลังใช้ filters.
- สีที่ frontend แนะนำ: `IN_POMS` สีเขียว, `NOT_IN_POMS` + `isInProgress: true` สีเหลือง/ส้ม, และ `NOT_IN_POMS` อื่นสีเทา.

Validation ผิดตอบ `400`; ไม่มี/invalid token ตอบ `401`; ไม่ใช่ operator, ไม่มี `dashboard:view` หรือไม่ผ่าน authorization ตอบ `403`. Error body ใช้ [shared error envelope](../../shared/common-api/README.md).

### `GET /api/v1/operator-factory-dashboard`

API เดิมนี้คงไว้แบบ connected-only: คืนเฉพาะโรงงานที่มี active POMS point และไม่คืนโรงงานของผู้ประกอบการที่ยังไม่เชื่อมต่อ. หน้าแรกผู้ประกอบการให้ใช้ `GET /api/v1/operator-factories` แทน.

Query fields:

| Field          | Type             | Required | Rules                                                          |
| -------------- | ---------------- | -------- | -------------------------------------------------------------- |
| `systemType`   | `CEMS` \| `WPMS` | No       | คืนเฉพาะโรงงานที่มี active point ของระบบนั้น                   |
| `favoriteOnly` | boolean          | No       | รองรับ `true`, `false`, `1`, `0`, `yes`, `no`; default `false` |

Request body: ไม่มี

Response fields ที่ใช้ระบุตัวโรงงานและการเชื่อมต่อ:

| Field                                                              | Type                     | Meaning                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data[].id`                                                        | integer \| null          | ฟิลด์เดิมสำหรับ compatibility ซึ่งมีค่าเป็น `factories.id`; เป็น `null` ได้เมื่อยังไม่มี factory master และห้าม fallback ไปใช้ ID จากตารางอื่น                                                                                                            |
| `data[].eligibleFactoryId`                                         | integer                  | `eligible_factories.id` ของโรงงาน current/live ที่เชื่อมต่ออยู่ใน POMS                                                                                                                                                                                    |
| `data[].factoryId`                                                 | string                   | identifier หลักสำหรับหน้าและจุดตรวจวัด; eligible-only row ใช้เลขทะเบียนใหม่                                                                                                                                                                               |
| `data[].factoryName`                                               | string                   | ชื่อโรงงานจาก current/live POMS point ล่าสุด; fallback เป็น active `eligible_factories` แล้วจึง factory master                                                                                                                                            |
| `data[].newRegistrationNo`                                         | string                   | เลขทะเบียนโรงงานใหม่จาก active `eligible_factories`                                                                                                                                                                                                       |
| `data[].isEligible`                                                | `true`                   | ทุก row บนหน้าหลักเป็นโรงงานเข้าข่ายที่มี active connected point                                                                                                                                                                                          |
| `data[].eligibilityStatus`                                         | `เข้าข่าย`               | label สำหรับ UI ซึ่งสอดคล้องกับ `isEligible: true`                                                                                                                                                                                                        |
| `data[].isFavorite`                                                | boolean                  | favorite ของผู้ใช้ปัจจุบัน                                                                                                                                                                                                                                |
| `data[].hasLatestHourlyMeasurement`                                | boolean                  | `true` เมื่อทุก active connected point มี `measurementPoints[].data` อย่างน้อย 1 แถว และ `cdate` + ชั่วโมงของ `ctime` ตรงกับชั่วโมงที่คำนวณเสร็จแล้วล่าสุด ซึ่งคือชั่วโมงก่อนหน้าตาม `Asia/Bangkok`; ถ้าจุดใดไม่มีข้อมูลหรือเป็นคนละชั่วโมงจะเป็น `false` |
| `data[].monitoringPointCountBySystem`                              | array                    | จำนวน active point แยก `CEMS` และ `WPMS`                                                                                                                                                                                                                  |
| `data[].measurementPoints`                                         | array                    | active connected points และค่ารายชั่วโมงที่อ่านได้ตาม scope                                                                                                                                                                                               |
| `data[].measurementPoints[].parameters`                            | string[]                 | ชื่อพารามิเตอร์พร้อมหน่วย; `Flow` หน่วย `m3/hr` ใช้ชื่อมาตรฐาน `Flow Rate (m3/hr)` เพียงชื่อเดียว                                                                                                                                                         |
| `data[].measurementPoints[].monitoringPointStatus`                 | string \| null           | สถานะระดับจุด; active point ที่ `ได้รับการยกเว้นทั้งหมด` มี `parameters: []` และยังแสดงบน dashboard                                                                                                                                                       |
| `data[].measurementPoints[].parameterStandards`                    | object[]                 | เกณฑ์มาตรฐานหนึ่งรายการต่อสมาชิกใน `parameters` และเรียงลำดับเดียวกัน                                                                                                                                                                                     |
| `data[].measurementPoints[].parameterStandards[].parameter`        | string                   | ชื่อพารามิเตอร์พร้อมหน่วย                                                                                                                                                                                                                                 |
| `data[].measurementPoints[].parameterStandards[].standardCriteria` | object \| null           | เกณฑ์ตามประกาศ อก. จาก connected-point instrument snapshot                                                                                                                                                                                                |
| `data[].measurementPoints[].parameterStandards[].eiaCriteria`      | object \| null           | เกณฑ์ตาม EIA จาก connected-point instrument snapshot                                                                                                                                                                                                      |
| `data[].measurementPoints[].data[].<parameter label>`              | number \| string \| null | ใช้ค่าตรวจวัดเมื่อ StatusCode เป็น `1`; ค่าตรวจวัดที่เป็นตัวเลขติดลบ (รวม numeric string) คืน `"ERROR"`; StatusCode อื่นใช้ชื่อสถานะ เช่น `Shut Down` หรือ `No Discharge` และมีลำดับความสำคัญเหนือการตรวจค่าติดลบ                                         |
| `data[].status`                                                    | `แสดง`                   | display status ของ row                                                                                                                                                                                                                                    |
| `meta.total`                                                       | integer                  | จำนวนโรงงานหลังใช้ query filters                                                                                                                                                                                                                          |

Minimal response (`200 OK`) สำหรับโรงงานที่เจ้าหน้าที่เชื่อมโดยยังไม่มี `factories` row:

```json
{
  "success": true,
  "data": [
    {
      "id": null,
      "eligibleFactoryId": 17,
      "factoryId": "40100007125560",
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "newRegistrationNo": "40100007125560",
      "isEligible": true,
      "eligibilityStatus": "เข้าข่าย",
      "isFavorite": false,
      "hasLatestHourlyMeasurement": true,
      "monitoringPointCountBySystem": [
        { "systemType": "CEMS", "count": 1 },
        { "systemType": "WPMS", "count": 0 }
      ],
      "status": "แสดง",
      "measurementPoints": [
        {
          "stationId": "S4010",
          "pointName": "ปล่องหลัก",
          "pointCode": "S4010",
          "systemType": "CEMS",
          "monitoringPointStatus": "เชื่อมต่อครบแล้ว",
          "parameters": ["CO (ppm)"],
          "parameterStandards": [
            {
              "parameter": "CO (ppm)",
              "standardCriteria": {
                "enabled": true,
                "standardValue": 0.5,
                "rows": []
              },
              "eiaCriteria": null
            }
          ],
          "data": [
            {
              "station_id": "S4010",
              "CO (ppm)": 0.1,
              "cdate": "2026-08-08",
              "ctime": "21:00:00"
            }
          ]
        }
      ]
    }
  ],
  "meta": { "total": 1 }
}
```

Visibility and authorization:

- ทุก scope รวม `OWN_FACTORY`, `ALL`, `IN_REGION` และ `IN_PROVINCE` คืนเฉพาะโรงงานที่มี active POMS point ใน `cems_wpms_connected_measurement_points`; โรงงานที่มีเพียง factory master หรือยังไม่เชื่อมต่อจะไม่แสดงบนหน้าหลัก.
- `ALL`, `IN_REGION` และ `IN_PROVINCE` ใช้พื้นที่จาก active `eligible_factories`; ไม่ต้องมี `factories` row.
- ใช้ `eligibleFactoryId` เมื่อต้องอ้างอิง row ใน `eligible_factories`; อย่านำไปแทน `id` เพราะเป็น ID จากคนละตาราง. ใช้ `factoryId` สำหรับ path/query ที่รับ identifier ของโรงงาน.
- `OWN_FACTORY` ต้องมีทั้ง active connected point และสิทธิ์ ownership ที่ผ่าน `user_juristics` หรือ `user_factory_access` ซึ่งอ้างถึง `factories`; ระบบไม่อนุมาน ownership จากเลขทะเบียน.
- row ที่ `eligible_factories.deleted_at` หรือ connected point `deleted_at` ไม่เป็น `null` จะไม่แสดง.
- โรงงานที่มีหลาย active points แสดงเป็นหนึ่ง factory row และรวม points ใน `measurementPoints`.
- ชื่อที่ลงทะเบียนเป็น `Flow`, `Flow (m3/hr)`, `Flow Rate (m3/hr)` หรือ `Flow Rate (m³/hr)` จะถูกรวมเป็น `Flow Rate (m3/hr)` และค่าใน `measurementPoints[].data` อ่านจาก source `flow_value`.
- `parameterStandards` มีเพียง `parameter`, `standardCriteria` และ `eiaCriteria`; เมื่อไม่มีเกณฑ์ที่บันทึกไว้ field เกณฑ์จะเป็น `null` และจะไม่ส่ง device/channel config อื่นใน array นี้.
- ค่าพารามิเตอร์ใน `measurementPoints[].data` ที่เป็นตัวเลขติดลบ ทั้งชนิด number และ numeric string จะถูกแทนด้วย `"ERROR"`. การแปลงนี้ไม่ใช้กับ `station_id`, `cdate`, `ctime`, พิกัด หรือค่าเกณฑ์ และหาก StatusCode ระบุ operational status เช่น `Maintenance` หรือ `Shut Down` ระบบจะคืนชื่อสถานะนั้นตามเดิม.
- Frontend ใช้ `hasLatestHourlyMeasurement` ได้โดยตรงและไม่ต้องวนเช็ค `measurementPoints[].data` ซ้ำ. ตัวอย่างเวลาปัจจุบัน `22:50` API จะเลือกข้อมูลรอบ `21:00` เพราะรอบ `22:00` ยังถือว่าคำนวณไม่เสร็จ และแถวที่ทำให้ flag เป็น `true` ต้องมีวันปัจจุบันพร้อม `ctime` ขึ้นต้นด้วย `21:` หรือ `21.` (ช่วง `21.00-21.59 น.`). หากเวลาปัจจุบันอยู่ในช่วง `00:00-00:59` จะเลือกข้อมูลรอบ `23:00` ของวันก่อนหน้า.

### `GET /api/v1/public/factory-map-points`

Query fields:

| Field        | Type             | Required | Rules                     |
| ------------ | ---------------- | -------- | ------------------------- |
| `systemType` | `CEMS` \| `WPMS` | No       | กรอง active point ตามระบบ |

Request body: ไม่มี

Response ใช้ identity, location, `monitoringPointCountBySystem`, `status` และ `measurementPoints` รูปแบบเดียวกับ dashboard รวมถึง `measurementPoints[].data` สำหรับข้อมูลล่าสุดรายชั่วโมงของแต่ละจุดวัด และคืน `hasLatestHourlyMeasurement` ตามกติกาเดียวกับ authenticated dashboard. Public API ไม่คืน field เฉพาะผู้ใช้คือ `isFavorite`. `data` เป็น array ว่างได้เมื่อยังไม่มีข้อมูลรายชั่วโมงล่าสุด.

ตัวอย่างต่อไปนี้สมมติว่าเรียก API วันที่ `2026-08-07` ในช่วงเวลา `22:00-22:59` ตาม `Asia/Bangkok` และได้ข้อมูลรอบ `21:00` ซึ่งคำนวณเสร็จแล้ว จึงได้ `hasLatestHourlyMeasurement: true`.

```json
{
  "success": true,
  "data": [
    {
      "id": null,
      "eligibleFactoryId": 17,
      "factoryId": "40100007125560",
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "newRegistrationNo": "40100007125560",
      "hasLatestHourlyMeasurement": true,
      "monitoringPointCountBySystem": [
        { "systemType": "CEMS", "count": 1 },
        { "systemType": "WPMS", "count": 0 }
      ],
      "status": "แสดง",
      "measurementPoints": [
        {
          "stationId": "S4010",
          "pointName": "ปล่องหลัก",
          "pointCode": "S4010",
          "systemType": "CEMS",
          "parameters": ["CO (ppm)"],
          "parameterStandards": [
            {
              "parameter": "CO (ppm)",
              "standardCriteria": {
                "enabled": true,
                "standardValue": 0.5,
                "rows": []
              },
              "eiaCriteria": null
            }
          ],
          "data": [
            {
              "station_id": "S4010",
              "CO (ppm)": "Shut Down",
              "cdate": "2026-08-07",
              "ctime": "21:00:00"
            }
          ]
        }
      ]
    }
  ],
  "meta": { "total": 1 }
}
```

การแสดงค่าตรวจวัดใน `measurementPoints[].data` ใช้ [StatusCode contract](../connection-requests/parameter-values.md#statuscode-contract) เดียวกับ connection test. Backend ไม่คืน `*_status` ใน row สำหรับแสดงผล แต่ใช้ status ของพารามิเตอร์ตัดสินว่าจะคืนค่าตรวจวัดหรือชื่อสถานะ. เมื่อ status อนุญาตให้ใช้ค่าตรวจวัด แต่ค่าเป็นตัวเลขติดลบทั้งชนิด number หรือ numeric string ระบบจะคืน `"ERROR"` เช่นเดียวกับ authenticated dashboard.

### `GET /api/v1/cems-wpms-requests/factories/:factoryId/general`

`factoryId` เป็น identifier ที่ได้จาก dashboard และต้องอยู่ใน access scope ของผู้เรียก ระบบอ่าน factory master ก่อนและ fallback ไปยัง active connected POMS factory ที่ผูก `eligible_factories` เมื่อยังไม่มี `factories` row. ฟิลด์ที่มีเฉพาะใน master เช่น `juristicId`, `systemId` และ `authorizeStart` จะเป็น `null` ในกรณี fallback.

Request body: ไม่มี

```json
{
  "success": true,
  "data": {
    "id": null,
    "eligibleFactoryId": 17,
    "factoryId": "40100007125560",
    "factoryName": "บริษัท ตัวอย่าง จำกัด",
    "newRegistrationNo": "40100007125560",
    "juristicId": null,
    "systemId": null,
    "formDefaults": {
      "factoryId": "40100007125560",
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "factoryRegistrationNo": "40100007125560"
    }
  }
}
```

### `PUT /api/v1/operator-factories/:factoryId/favorite`

Path and body fields:

| Field        | Location | Type    | Required | Rules                                                                                                                                        |
| ------------ | -------- | ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `factoryId`  | path     | string  | Yes      | 1-64 characters และต้องอยู่ใน access scope ของผู้เรียก; รองรับ connected eligible factory ที่ยังไม่มี `factories` row สำหรับ scope ที่อนุญาต |
| `isFavorite` | body     | boolean | Yes      | `true` เพื่อติดดาว, `false` เพื่อยกเลิก                                                                                                      |

```json
{
  "isFavorite": true
}
```

Minimal response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "factoryId": "40100007125560",
    "isFavorite": true
  }
}
```

Error responses ใช้ shared error envelope. Validation ผิดตอบ `400`; ไม่ผ่าน authentication ตอบ `401`; ไม่ผ่าน permission/scope ตอบ `403` หรือ `404` ตาม access check ของ endpoint.

`public_user` ใช้ endpoint นี้ได้เมื่อมี `dashboard.alerts:view`; backend ยังคงตรวจว่า `factoryId` อยู่ใน dashboard scope ของผู้ใช้ จึงไม่ต้องเพิ่ม `factories:view` เพียงเพื่อกด favorite

## Business Flow And Explanations

- [ขอเชื่อมต่อและ Direct Connection](../connection-requests/README.md)
- [โรงงานที่เข้าข่ายและข้อมูลที่ซิงก์](../eligible-factories/README.md)

## Backend Maintainer Map

| Concern      | Canonical source                                                                                                                                                                                                                                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes       | [connection-requests.routes.ts](../../../../../backend/src/modules/connection-requests/connection-requests.routes.ts)                                                                                                                                                                                                                          |
| Validators   | [connection-requests.validator.ts](../../../../../backend/src/modules/connection-requests/connection-requests.validator.ts)                                                                                                                                                                                                                    |
| Repository   | [connection-requests.repository.ts](../../../../../backend/src/modules/connection-requests/connection-requests.repository.ts)                                                                                                                                                                                                                  |
| Public types | [connection-requests.types.ts](../../../../../backend/src/modules/connection-requests/connection-requests.types.ts)                                                                                                                                                                                                                            |
| Tests        | [connection-requests.repository.test.ts](../../../../../backend/tests/unit/connection-requests.repository.test.ts), [connection-requests.service.test.ts](../../../../../backend/tests/unit/connection-requests.service.test.ts), [parameter-values.repository.test.ts](../../../../../backend/tests/unit/parameter-values.repository.test.ts) |
| Evidence     | [Operator-owned factory overview TDD](../../../evidence/home/operator-owned-factory-overview.tdd.md), [Officer-connected dashboard TDD](../../../evidence/home/officer-direct-connected-dashboard.tdd.md), [Current/live POMS factory name TDD](../../../evidence/home/operator-dashboard-current-factory-name.tdd.md)                                                                                                                               |
