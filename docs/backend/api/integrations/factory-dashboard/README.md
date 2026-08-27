# Dashboard ข้อมูลตรวจวัดรายโรงงานสำหรับระบบภายนอก

> Owner: Backend

API นี้ให้ระบบภายนอกที่ไม่ได้ login อ่านข้อมูลโรงงาน current/live หนึ่งแห่ง โดยส่งเลขทะเบียนโรงงานใหม่และ `X-API-Key` ที่ออกให้ endpoint นี้โดยเฉพาะ Response ใช้รูปแบบเดียวกับ dashboard หลัก แต่ `data` มีหนึ่งรายการและไม่คืน `isFavorite` ซึ่งเป็นข้อมูลเฉพาะผู้ใช้ที่ login

## Quick Start

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/integrations/factories/40100007125560/dashboard' \
  --header 'X-API-Key: <FACTORY_DASHBOARD_API_KEY>'
```

ตั้งค่า key ฝั่ง backend ผ่าน `FACTORY_DASHBOARD_API_KEYS` โดยคั่นหลาย key ด้วย comma ห้ามใส่ key จริงใน source code, เอกสาร หรือ log และ endpoint นี้ไม่ fallback ไปใช้ `INTEGRATION_API_KEYS`, `DEVICE_CONFIG_API_KEYS` หรือ `ALERT_EVENT_API_KEYS`

API key ต้องเก็บและเรียกใช้จาก server ของระบบภายนอกเท่านั้น ห้ามฝังใน frontend, mobile application หรือ JavaScript ที่ผู้ใช้ดาวน์โหลดได้

## `GET /api/v1/integrations/factories/:registrationNo/dashboard`

คืนข้อมูลชั่วโมงที่คำนวณเสร็จล่าสุดของ active measurement points สำหรับโรงงานที่เลือก เวลารอบข้อมูลคำนวณตาม `Asia/Bangkok` ด้วยกติกาเดียวกับ `GET /api/v1/operator-factory-dashboard`

### Authentication And Permission

- Authentication: required ผ่าน header `X-API-Key`
- Key source: `FACTORY_DASHBOARD_API_KEYS`
- Bearer token: ไม่ใช้
- Permission code และ user scope: ไม่ใช้
- Data scope: โรงงาน current/live ที่มี active row ใน `cems_wpms_connected_measurement_points`
- Rate limit: global limit `300` requests ต่อ `15` นาทีต่อ client IP

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `registrationNo` | path | string | Yes | เลขทะเบียนโรงงานใหม่จำนวน 14 หลัก ตรงกับ `eligible_factories.factory_registration_no_new` |
| `X-API-Key` | header | string | Yes | key เฉพาะ endpoint จาก `FACTORY_DASHBOARD_API_KEYS` |

Request body: ไม่มี

### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | เป็น `true` |
| `data` | object[] | No | มีหนึ่งโรงงานเสมอเมื่อได้ `200 OK` |
| `data[].id` | integer | Yes | `factories.id`; เป็น `null` ได้เมื่อไม่มี factory master |
| `data[].eligibleFactoryId` | integer | Yes | ID จาก `eligible_factories` |
| `data[].factoryId` | string | No | identifier หลักของโรงงานใน dashboard |
| `data[].factoryName` | string | No | ชื่อโรงงาน current/live |
| `data[].newRegistrationNo` | string | Yes | เลขทะเบียนโรงงานใหม่ 14 หลัก |
| `data[].oldRegistrationNo` | string | Yes | เลขทะเบียนเดิม |
| `data[].factoryLogoUrl` | string | Yes | URL ตราสัญลักษณ์โรงงาน |
| `data[].industryMainOrder` | string | Yes | รหัสประเภทโรงงานหลัก |
| `data[].industryMainOrderLabel` | string | Yes | ชื่อประเภทโรงงานหลักสำหรับแสดงผล |
| `data[].industrySubOrder` | string | Yes | รหัสประเภทย่อย |
| `data[].eia` | string | Yes | สถานะ EIA |
| `data[].hasEia` | boolean | Yes | flag สถานะ EIA |
| `data[].regionCode`, `data[].regionName` | string | Yes | รหัสและชื่อภาค |
| `data[].provinceCode`, `data[].provinceName`, `data[].province` | string | Yes | รหัสและชื่อจังหวัด |
| `data[].districtCode`, `data[].districtName` | string | Yes | รหัสและชื่ออำเภอ |
| `data[].address` | string | Yes | ที่อยู่โรงงาน |
| `data[].latitude`, `data[].longitude` | string | Yes | พิกัดโรงงาน |
| `data[].industrialAreaType`, `data[].industrialAreaTypeLabel` | string | Yes | ประเภทพื้นที่อุตสาหกรรมและชื่อแสดงผล |
| `data[].industrialEstateCode`, `data[].industrialEstateName` | string | Yes | รหัสและชื่อนิคมอุตสาหกรรม |
| `data[].isEligible` | `true` | No | โรงงานที่คืนเป็นโรงงานเข้าข่าย |
| `data[].eligibilityStatus` | `เข้าข่าย` | No | label สถานะโรงงานเข้าข่าย |
| `data[].hasLatestHourlyMeasurement` | boolean | No | `true` เมื่อ active points ทุกจุดมีข้อมูลตรงรอบชั่วโมงที่คำนวณเสร็จล่าสุด |
| `data[].monitoringPointCountBySystem` | object[] | No | จำนวน active points แยก `CEMS` และ `WPMS` |
| `data[].status` | `แสดง` | No | สถานะแถว dashboard |
| `data[].measurementPoints` | object[] | No | active measurement points ของโรงงาน |
| `data[].measurementPoints[].stationId` | string | Yes | station identifier |
| `data[].measurementPoints[].pointName` | string | No | ชื่อจุดตรวจวัด |
| `data[].measurementPoints[].pointCode` | string | Yes | รหัสจุดตรวจวัด |
| `data[].measurementPoints[].systemType` | `CEMS` \| `WPMS` | No | ระบบตรวจวัด |
| `data[].measurementPoints[].monitoringPointStatus` | string | Yes | สถานะระดับจุดตรวจวัด |
| `data[].measurementPoints[].parameters` | string[] | No | ชื่อพารามิเตอร์พร้อมหน่วย เช่น `CO (ppm)`, `BOD (mg/l)` หรือ `Flow Rate (m3/hr)` |
| `data[].measurementPoints[].parameterStandards` | object[] | No | เกณฑ์มาตรฐานตามลำดับเดียวกับ `parameters` |
| `data[].measurementPoints[].data` | object[] | No | ข้อมูลรอบชั่วโมงล่าสุด; key ค่าตรวจวัดเป็นชื่อพารามิเตอร์พร้อมหน่วย |
| `data[].measurementPoints[].data[].station_id` | string | No | station identifier ในแถวข้อมูล |
| `data[].measurementPoints[].data[].cdate` | string | No | วันที่ข้อมูล `YYYY-MM-DD` |
| `data[].measurementPoints[].data[].ctime` | string | No | เวลาของรอบข้อมูล |
| `meta.total` | `1` | No | จำนวนโรงงานใน response |

รายละเอียดการแปลงค่าติดลบ, operational status และเกณฑ์มาตรฐานใช้ contract เดียวกับ [หน้าหลัก](../../menus/home/README.md#get-apiv1operator-factory-dashboard)

### Success Response Example

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
      "oldRegistrationNo": null,
      "factoryLogoUrl": null,
      "industryMainOrder": "106",
      "industryMainOrderLabel": "ประเภทโรงงานลำดับที่ 106: ผลิตภัณฑ์ตัวอย่าง",
      "industrySubOrder": null,
      "eia": "มี",
      "hasEia": true,
      "regionCode": "ภาคกลาง",
      "regionName": "ภาคกลาง",
      "provinceCode": "10",
      "provinceName": "กรุงเทพมหานคร",
      "province": "กรุงเทพมหานคร",
      "address": "100 ถนนตัวอย่าง",
      "latitude": "13.7563",
      "longitude": "100.5018",
      "districtCode": null,
      "districtName": null,
      "industrialAreaType": "OUTSIDE_INDUSTRIAL_ESTATE",
      "industrialAreaTypeLabel": "นอกนิคมอุตสาหกรรม",
      "industrialEstateCode": null,
      "industrialEstateName": null,
      "isEligible": true,
      "eligibilityStatus": "เข้าข่าย",
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
              "cdate": "2026-08-26",
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

### Validation And Business Rules

- ค้นด้วยเลขทะเบียนใหม่เท่านั้นและเปรียบเทียบแบบ exact match
- คืนเฉพาะ active `eligible_factories` ที่มี active connected point ใน `cems_wpms_connected_measurement_points`
- หากเวลาปัจจุบันตาม `Asia/Bangkok` เป็น `22:xx` ระบบเลือกข้อมูลรอบ `21:00`; ช่วง `00:xx` เลือกรอบ `23:00` ของวันก่อนหน้า
- `data` ไม่คืน `isFavorite` เพราะ API key ไม่ผูกกับผู้ใช้ที่ login
- response ส่ง `Cache-Control: no-store`; client ไม่ควร cache response และห้าม log `X-API-Key`
- key ใน `FACTORY_DASHBOARD_API_KEYS` แยกจาก integration endpoints อื่นโดยเด็ดขาด
- key scope ปัจจุบันจำกัดที่ endpoint แต่ยังไม่ผูกสิทธิ์รายโรงงาน; key ที่ผ่านสามารถเลือก active connected factory ใดก็ได้ด้วยเลขทะเบียน

### Errors

`400`, `401` และ `404` ใช้ [shared error envelope](../../shared/README.md) ส่วน `429` มาจาก global rate-limit middleware และตอบข้อความพร้อม `Retry-After`/`RateLimit` headers:

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | `registrationNo` ไม่ใช่ตัวเลข 14 หลัก | ตรวจเลขทะเบียนก่อนเรียกใหม่ |
| `401` | `UNAUTHORIZED` | ไม่มี `X-API-Key` หรือ key ไม่อยู่ใน `FACTORY_DASHBOARD_API_KEYS` | ตรวจ key เฉพาะ endpoint |
| `404` | `NOT_FOUND` | ไม่พบโรงงาน current/live ที่ active และเชื่อมต่อ POMS แล้ว | ตรวจเลขทะเบียนหรือสถานะการเชื่อมต่อ |
| `429` | - | เรียกเกิน global rate limit | รอตาม `Retry-After` แล้วจึงลองใหม่ |

## Backend Maintainer Links

- Route: [`integrations.routes.ts`](../../../../../backend/src/modules/integrations/integrations.routes.ts)
- Authentication: [`integration-api-key.middleware.ts`](../../../../../backend/src/modules/integrations/integration-api-key.middleware.ts)
- Controller: [`integration-factory-dashboard.controller.ts`](../../../../../backend/src/modules/integrations/integration-factory-dashboard.controller.ts)
- Validator: [`integration-factory-dashboard.validator.ts`](../../../../../backend/src/modules/integrations/integration-factory-dashboard.validator.ts)
- Service: [`integration-factory-dashboard.service.ts`](../../../../../backend/src/modules/integrations/integration-factory-dashboard.service.ts)
- Dashboard source: [`connection-requests.service.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.service.ts)
- Types: [`connection-requests.types.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.types.ts)
- Runtime OpenAPI: [`poms.openapi.ts`](../../../../../backend/src/modules/api-docs/poms.openapi.ts)
- Tests: [`integration-factory-dashboard.route.test.ts`](../../../../../backend/tests/unit/integration-factory-dashboard.route.test.ts), [`integration-factory-dashboard.service.test.ts`](../../../../../backend/tests/unit/integration-factory-dashboard.service.test.ts), [`integration-factory-dashboard.openapi.test.ts`](../../../../../backend/tests/unit/integration-factory-dashboard.openapi.test.ts)
- Evidence: [`factory-dashboard-api.tdd.md`](../../../evidence/integrations/factory-dashboard-api.tdd.md)
