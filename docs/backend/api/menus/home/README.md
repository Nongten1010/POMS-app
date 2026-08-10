# หน้าหลัก

> Owner: Backend

## Frontend Quick Start

หน้าหลักสำหรับผู้ประกอบการแสดงโรงงาน active ทั้งหมดที่ owner เข้าถึงได้ พร้อมสถานะเข้าข่าย แม้โรงงานยังไม่มีจุดตรวจวัด current/live ใน POMS. ผู้ใช้ที่ login ต้องมี `dashboard:view`; ผลลัพธ์ถูกกรองตาม scope ของ permission และพื้นที่ของเจ้าหน้าที่ ส่วนเจ้าหน้าที่และ public map ยังคงเห็นเฉพาะโรงงาน current/live ที่เชื่อมต่อแล้ว

### Main Flow

1. เมื่อ scope เป็น `OWN_FACTORY` อ่าน active factory master ทุกแห่งที่ผ่าน `user_juristics` หรือ `user_factory_access` แล้ว left join active `eligible_factories` เพื่อกำหนด `isEligible` และ `eligibilityStatus`.
2. โรงงานที่เข้าข่ายและเชื่อมต่อแล้วได้รับข้อมูล current/live จาก `cems_wpms_connected_measurement_points`; โรงงานไม่เข้าข่ายยังคงมี row โดยส่งเพียงเลขที่โรงงาน ชื่อ และสถานะเข้าข่าย ส่วนรายละเอียดอื่นเป็น `null`.
3. แนบ favorite, ค่ารายชั่วโมงล่าสุด และ flag ว่าทุกจุดมีข้อมูลของชั่วโมงปัจจุบันตามสิทธิ์ของผู้เรียก.
4. Scope สำหรับเจ้าหน้าที่และ public map ใช้ connected/current-live only เพื่อไม่ขยายผลลัพธ์นอกหน้าที่ของ dashboard สาธารณะ/เจ้าหน้าที่.
5. เมื่อผู้ใช้ส่งออกรายงาน ให้เรียก CSV endpoint ด้วย `stationId`; backend resolve โรงงาน สิทธิ์ และข้อมูลจริงให้เอง.

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/operator-factory-dashboard?systemType=CEMS' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

## Endpoint Summary

| งาน | Method | Path | Auth | Permission | Contract |
| --- | --- | --- | --- | --- | --- |
| รายการโรงงานบนหน้าหลัก | `GET` | `/api/v1/operator-factory-dashboard` | Bearer | `dashboard:view` | [Authenticated dashboard](#get-apiv1operator-factory-dashboard) |
| จุดโรงงานสำหรับแผนที่สาธารณะ | `GET` | `/api/v1/public/factory-map-points` | No | - | [Public map](#get-apiv1publicfactory-map-points) |
| ข้อมูลทั่วไปของโรงงาน | `GET` | `/api/v1/cems-wpms-requests/factories/:factoryId/general` | Bearer | `factories:view` | [Factory general](#get-apiv1cems-wpms-requestsfactoriesfactoryidgeneral) |
| ตั้งค่า favorite | `PUT` | `/api/v1/operator-factories/:factoryId/favorite` | Bearer | `factories:view` และ `dashboard.alerts:view` | [Favorite](#put-apiv1operator-factoriesfactoryidfavorite) |
| ส่งออกข้อมูลตรวจวัด CSV | `GET` | `/api/v1/connected-measurement-points/:stationId/measurement-export.csv` | Bearer | `dashboard.stats:export` | [Measurement CSV export](../../shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidmeasurement-exportcsv) |

## Contracts

### `GET /api/v1/operator-factory-dashboard`

Query fields:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `systemType` | `CEMS` \| `WPMS` | No | คืนเฉพาะโรงงานที่มี active point ของระบบนั้น |
| `favoriteOnly` | boolean | No | รองรับ `true`, `false`, `1`, `0`, `yes`, `no`; default `false` |

Request body: ไม่มี

Response fields ที่ใช้ระบุตัวโรงงานและการเชื่อมต่อ:

| Field | Type | Meaning |
| --- | --- | --- |
| `data[].id` | integer \| null | ฟิลด์เดิมสำหรับ compatibility ซึ่งมีค่าเป็น `factories.id`; เป็น `null` ได้เมื่อยังไม่มี factory master และห้าม fallback ไปใช้ ID จากตารางอื่น |
| `data[].eligibleFactoryId` | integer \| null | `eligible_factories.id` เมื่อโรงงานเข้าข่าย; เป็น `null` สำหรับ owner factory ที่ยังไม่เข้าข่าย |
| `data[].factoryId` | string | identifier หลักสำหรับหน้าและจุดตรวจวัด; eligible-only row ใช้เลขทะเบียนใหม่ |
| `data[].factoryName` | string | ชื่อโรงงานจาก current/live POMS point ล่าสุด; fallback เป็นโรงงานเข้าข่าย แล้วจึง factory master |
| `data[].newRegistrationNo` | string \| null | เลขทะเบียนโรงงานใหม่เมื่อเข้าข่าย; เป็น `null` เมื่อไม่เข้าข่าย |
| `data[].isEligible` | boolean | `true` เมื่อจับคู่ active `eligible_factories` ได้ |
| `data[].eligibilityStatus` | `เข้าข่าย` \| `ไม่เข้าข่าย` | label สำหรับ UI ซึ่งสอดคล้องกับ `isEligible` |
| `data[].isFavorite` | boolean | favorite ของผู้ใช้ปัจจุบัน |
| `data[].hasLatestHourlyMeasurement` | boolean | `true` เมื่อทุก active connected point มี `measurementPoints[].data` อย่างน้อย 1 แถว และ `cdate` + ชั่วโมงของ `ctime` ตรงกับชั่วโมงปัจจุบันตาม `Asia/Bangkok`; ถ้าจุดใดไม่มีข้อมูลหรือเป็นคนละชั่วโมงจะเป็น `false` |
| `data[].monitoringPointCountBySystem` | array | จำนวน active point แยก `CEMS` และ `WPMS` |
| `data[].measurementPoints` | array | active connected points และค่ารายชั่วโมงที่อ่านได้ตาม scope |
| `data[].measurementPoints[].parameters` | string[] | ชื่อพารามิเตอร์พร้อมหน่วย; `Flow` หน่วย `m3/hr` ใช้ชื่อมาตรฐาน `Flow Rate (m3/hr)` เพียงชื่อเดียว |
| `data[].measurementPoints[].parameterStandards` | object[] | เกณฑ์มาตรฐานหนึ่งรายการต่อสมาชิกใน `parameters` และเรียงลำดับเดียวกัน |
| `data[].measurementPoints[].parameterStandards[].parameter` | string | ชื่อพารามิเตอร์พร้อมหน่วย |
| `data[].measurementPoints[].parameterStandards[].standardCriteria` | object \| null | เกณฑ์ตามประกาศ อก. จาก connected-point instrument snapshot |
| `data[].measurementPoints[].parameterStandards[].eiaCriteria` | object \| null | เกณฑ์ตาม EIA จาก connected-point instrument snapshot |
| `data[].measurementPoints[].data[].<parameter label>` | number \| string \| null | ใช้ค่าตรวจวัดเมื่อ StatusCode เป็น `1`; StatusCode อื่นใช้ชื่อสถานะ เช่น `Shut Down` หรือ `No Discharge` |
| `data[].status` | `แสดง` | display status ของ row |
| `meta.total` | integer | จำนวนโรงงานหลังใช้ query filters |

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
              "ctime": "22:00:00"
            }
          ]
        }
      ]
    }
  ],
  "meta": { "total": 1 }
}
```

ตัวอย่าง row สำหรับโรงงานไม่เข้าข่ายใน `OWN_FACTORY`:

```json
{
  "id": 8,
  "eligibleFactoryId": null,
  "factoryId": "91090000325549",
  "factoryName": "บริษัท โรงงานตัวอย่าง จำกัด",
  "newRegistrationNo": null,
  "oldRegistrationNo": null,
  "factoryLogoUrl": null,
  "industryMainOrder": null,
  "industryMainOrderLabel": null,
  "industrySubOrder": null,
  "eia": null,
  "hasEia": null,
  "regionCode": null,
  "regionName": null,
  "provinceCode": null,
  "provinceName": null,
  "province": null,
  "address": null,
  "latitude": null,
  "longitude": null,
  "districtCode": null,
  "districtName": null,
  "industrialAreaType": null,
  "industrialAreaTypeLabel": null,
  "industrialEstateCode": null,
  "industrialEstateName": null,
  "isEligible": false,
  "eligibilityStatus": "ไม่เข้าข่าย",
  "isFavorite": false,
  "hasLatestHourlyMeasurement": false,
  "monitoringPointCountBySystem": [
    { "systemType": "CEMS", "count": 0 },
    { "systemType": "WPMS", "count": 0 }
  ],
  "status": "แสดง",
  "measurementPoints": []
}
```

Visibility and authorization:

- `OWN_FACTORY` คืน active factory master ทุกแห่งที่ user มีสิทธิ์ แม้ยังไม่เข้าข่ายหรือยังไม่มี connected point. โรงงานไม่เข้าข่ายคง `id`, `factoryId`, `factoryName`, eligibility fields และฟิลด์โครงสร้างสำหรับ frontend; descriptive fields เป็น `null`, array เป็น `[]`, count เป็น `0` และ boolean สถานะข้อมูลเป็น `false`.
- `ALL`, `IN_REGION` และ `IN_PROVINCE` ใช้ active POMS point และพื้นที่จาก `eligible_factories`; ไม่ต้องมี `factories` row.
- ใช้ `eligibleFactoryId` เมื่อต้องอ้างอิง row ใน `eligible_factories`; อย่านำไปแทน `id` เพราะเป็น ID จากคนละตาราง. ใช้ `factoryId` สำหรับ path/query ที่รับ identifier ของโรงงาน.
- `OWN_FACTORY` ยังต้องผ่าน `user_juristics` หรือ `user_factory_access` ที่อ้างถึง `factories`; ระบบไม่อนุมาน ownership จากเลขทะเบียน.
- row ที่ `eligible_factories.deleted_at` หรือ connected point `deleted_at` ไม่เป็น `null` จะไม่แสดง.
- โรงงานที่มีหลาย active points แสดงเป็นหนึ่ง factory row และรวม points ใน `measurementPoints`.
- ชื่อที่ลงทะเบียนเป็น `Flow`, `Flow (m3/hr)`, `Flow Rate (m3/hr)` หรือ `Flow Rate (m³/hr)` จะถูกรวมเป็น `Flow Rate (m3/hr)` และค่าใน `measurementPoints[].data` อ่านจาก source `flow_value`.
- `parameterStandards` มีเพียง `parameter`, `standardCriteria` และ `eiaCriteria`; เมื่อไม่มีเกณฑ์ที่บันทึกไว้ field เกณฑ์จะเป็น `null` และจะไม่ส่ง device/channel config อื่นใน array นี้.
- Frontend ใช้ `hasLatestHourlyMeasurement` ได้โดยตรงและไม่ต้องวนเช็ค `measurementPoints[].data` ซ้ำ. ตัวอย่างเวลาปัจจุบัน `22:50` แถวที่ถือว่าปัจจุบันต้องมีวันปัจจุบันและ `ctime` ขึ้นต้นด้วย `22:` หรือ `22.` (ช่วง `22.00-22.59 น.`).

### `GET /api/v1/public/factory-map-points`

Query fields:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `systemType` | `CEMS` \| `WPMS` | No | กรอง active point ตามระบบ |

Request body: ไม่มี

Response ใช้ identity, location, `monitoringPointCountBySystem`, `status` และ `measurementPoints` รูปแบบเดียวกับ dashboard รวมถึง `measurementPoints[].data` สำหรับข้อมูลล่าสุดรายชั่วโมงของแต่ละจุดวัด และคืน `hasLatestHourlyMeasurement` ตามกติกาเดียวกับ authenticated dashboard. Public API ไม่คืน field เฉพาะผู้ใช้คือ `isFavorite`. `data` เป็น array ว่างได้เมื่อยังไม่มีข้อมูลรายชั่วโมงล่าสุด.

ตัวอย่างต่อไปนี้สมมติว่าเรียก API วันที่ `2026-08-07` ในช่วงเวลา `21:00-21:59` ตาม `Asia/Bangkok` จึงได้ `hasLatestHourlyMeasurement: true`.

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

การแสดงค่าตรวจวัดใน `measurementPoints[].data` ใช้ [StatusCode contract](../connection-requests/parameter-values.md#statuscode-contract) เดียวกับ connection test. Backend ไม่คืน `*_status` ใน row สำหรับแสดงผล แต่ใช้ status ของพารามิเตอร์ตัดสินว่าจะคืนค่าตรวจวัดหรือชื่อสถานะ.

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

| Field | Location | Type | Required | Rules |
| --- | --- | --- | --- | --- |
| `factoryId` | path | string | Yes | 1-64 characters และต้องอยู่ใน access scope ของผู้เรียก; รองรับ connected eligible factory ที่ยังไม่มี `factories` row สำหรับ scope ที่อนุญาต |
| `isFavorite` | body | boolean | Yes | `true` เพื่อติดดาว, `false` เพื่อยกเลิก |

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

## Business Flow And Explanations

- [ขอเชื่อมต่อและ Direct Connection](../connection-requests/README.md)
- [โรงงานที่เข้าข่ายและข้อมูลที่ซิงก์](../eligible-factories/README.md)

## Backend Maintainer Map

| Concern | Canonical source |
| --- | --- |
| Routes | [connection-requests.routes.ts](../../../../../backend/src/modules/connection-requests/connection-requests.routes.ts) |
| Validators | [connection-requests.validator.ts](../../../../../backend/src/modules/connection-requests/connection-requests.validator.ts) |
| Repository | [connection-requests.repository.ts](../../../../../backend/src/modules/connection-requests/connection-requests.repository.ts) |
| Public types | [connection-requests.types.ts](../../../../../backend/src/modules/connection-requests/connection-requests.types.ts) |
| Tests | [connection-requests.repository.test.ts](../../../../../backend/tests/unit/connection-requests.repository.test.ts), [connection-requests.service.test.ts](../../../../../backend/tests/unit/connection-requests.service.test.ts), [parameter-values.repository.test.ts](../../../../../backend/tests/unit/parameter-values.repository.test.ts) |
| Evidence | [Officer-connected dashboard TDD](../../../evidence/home/officer-direct-connected-dashboard.tdd.md), [Current/live POMS factory name TDD](../../../evidence/home/operator-dashboard-current-factory-name.tdd.md) |
