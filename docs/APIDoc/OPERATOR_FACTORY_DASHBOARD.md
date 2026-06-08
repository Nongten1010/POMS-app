# Operator Factory Dashboard API

เอกสารสำหรับหน้าแผนที่/รายการโรงงานที่มีปุ่ม `CEMS`, `WPMS`, ปุ่มดาว favorite และตารางค่าตรวจวัดล่าสุดรายชั่วโมง

## Data Source

หน้านี้ใช้ข้อมูลปัจจุบันของโรงงานและจุดตรวจวัด ไม่ใช้รายการคำขอเป็นข้อมูลหลักของหน้า

| ส่วนข้อมูล | Source |
| --- | --- |
| โรงงานและสิทธิ์ผู้ใช้ | `factories` + `user_juristics` |
| โรงงานที่เข้าข่ายและข้อมูลเสริม เช่น ที่อยู่/พิกัด | ต้องมี record ใน `eligible_factories` โดย join ด้วย `eligible_factories.factory_registration_no_new = factories.code` |
| จุดตรวจวัดปัจจุบัน | `cems_wpms_connected_measurement_points` |
| ค่าตรวจวัดล่าสุดรายชั่วโมง | Parameter DB ตาราง `{stationId}_data_60m` เช่น `S0001_data_60m` |
| Favorite | `user_factory_favorites` |

หมายเหตุ: endpoint นี้คืนเฉพาะโรงงานที่อยู่ใน `eligible_factories`, มี `status = "แสดง"`, และมีจุดตรวจวัดที่เชื่อมแล้วอย่างน้อย 1 จุดใน `cems_wpms_connected_measurement_points` เท่านั้น

## GET รายการโรงงานสำหรับหน้าแผนที่

| Item | Value |
| --- | --- |
| URL | `GET /api/v1/operator-factory-dashboard` |
| Header | `Authorization: Bearer <accessToken>` |
| Permission | `factories:view` |
| Body | ไม่มี |

Query params:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `systemType` | `CEMS`\|`WPMS` | No | ใช้ตอนกดปุ่ม CEMS หรือ WPMS เพื่อกรองโรงงานที่มีจุดตรวจวัดระบบนั้น |
| `favoriteOnly` | boolean | No | `true` เพื่อดูเฉพาะโรงงานที่ user ปัจจุบันติดดาว |

ตัวอย่าง:

```bash
curl "http://localhost:3000/api/v1/operator-factory-dashboard?systemType=CEMS" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Response Shape

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "factoryId": "factory-001",
      "factoryName": "บริษัท ทดสอบ จำกัด",
      "newRegistrationNo": "3-106-33/50สบ",
      "province": "สระบุรี",
      "address": "99 หมู่ 1",
      "latitude": "13.7563",
      "longitude": "100.5018",
      "isFavorite": true,
      "monitoringPointCountBySystem": [
        {
          "systemType": "CEMS",
          "count": 1
        },
        {
          "systemType": "WPMS",
          "count": 0
        }
      ],
      "status": "แสดง",
      "measurementPoints": [
        {
          "stationId": "S0001",
          "pointName": "ปล่อง A",
          "pointCode": "S0001",
          "systemType": "CEMS",
          "parameters": ["CO (ppm)", "NOx (ppm)", "Temp. (°C)", "O2 (%)", "Flow (m3/hr)"],
          "data": [
            {
              "station_id": "NB-C21",
              "cdate": "2026-02-25",
              "ctime": "22.00-22.59 น.",
              "CO (ppm)": 0.05,
              "NOx (ppm)": 10.54,
              "Temp. (°C)": 93.35,
              "O2 (%)": 12.58,
              "Flow (m3/hr)": 1981710
            },
            {
              "station_id": "NB-C22",
              "cdate": "2026-02-25",
              "ctime": "22.00-22.59 น.",
              "CO (ppm)": 0,
              "NOx (ppm)": 12.37,
              "Temp. (°C)": 93.11,
              "O2 (%)": 12.52,
              "Flow (m3/hr)": 1906655.5
            }
          ]
        }
      ]
    }
  ],
  "meta": {
    "total": 1
  }
}
```

## Field Dictionary

| Field | Type | Description |
| --- | --- | --- |
| `id` | number|null | primary key จาก `factories.id` สำหรับใช้เป็น row id ในตาราง |
| `factoryId` | string | รหัสโรงงานจาก `factories.fid` |
| `factoryName` | string | ชื่อโรงงาน |
| `newRegistrationNo` | string|null | เลขทะเบียนโรงงานใหม่จาก `factories.code` |
| `province` | string|null | จังหวัด |
| `address` | string|null | ที่อยู่โรงงาน |
| `latitude` | string|null | พิกัด latitude ของโรงงาน |
| `longitude` | string|null | พิกัด longitude ของโรงงาน |
| `isFavorite` | boolean | โรงงานนี้ถูก user ปัจจุบันติดดาวหรือไม่ |
| `monitoringPointCountBySystem` | array | จำนวนจุดตรวจวัดแยกตามระบบ |
| `status` | string | คืนเฉพาะ `แสดง` |
| `measurementPoints[].stationId` | string|null | รหัสสถานีที่ใช้ lookup ตาราง parameter DB เช่น `S0001` |
| `measurementPoints[].pointName` | string | ชื่อจุดตรวจวัด |
| `measurementPoints[].pointCode` | string|null | รหัสจุดตรวจวัด |
| `measurementPoints[].systemType` | `CEMS`\|`WPMS` | ระบบของจุดตรวจวัด |
| `measurementPoints[].parameters` | string[] | parameter ที่ลงทะเบียนไว้กับจุดตรวจวัด พร้อมหน่วย เช่น `NOx (ppm)` |
| `measurementPoints[].data` | object[] | ค่าตรวจวัดล่าสุดรายชั่วโมงจาก `{stationId}_data_60m`; value fields ใช้ชื่อเดียวกับ `parameters` เช่น `NOx (ppm)` |

## Frontend Mapping

| UI | Field |
| --- | --- |
| ชื่อโรงงาน | `factoryName` |
| เลขทะเบียน | `newRegistrationNo` |
| ที่อยู่ | `address` |
| ป้าย CEMS/WPMS | `monitoringPointCountBySystem[].count > 0` |
| ดาว favorite | `isFavorite` |
| แผนที่ marker | `latitude`, `longitude` |
| ตารางค่าตรวจวัด | `measurementPoints[].data` |
| จุดตรวจวัดในตาราง | `measurementPoints[].data[].station_id` |
| วันที่ | `measurementPoints[].data[].cdate` |
| เวลา | `measurementPoints[].data[].ctime` |

## PUT Favorite

| Item | Value |
| --- | --- |
| URL | `PUT /api/v1/cems-wpms-requests/operator-factories/:factoryId/favorite` |
| Header | `Authorization: Bearer <accessToken>` |
| Permission | `factories:view` + `dashboard.alerts:view` |

Request body:

```json
{
  "isFavorite": true
}
```

ตัวอย่าง:

```bash
curl -X PUT "http://localhost:3000/api/v1/cems-wpms-requests/operator-factories/factory-001/favorite" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "isFavorite": true }'
```

Response:

```json
{
  "success": true,
  "data": {
    "factoryId": "factory-001",
    "isFavorite": true
  }
}
```

## Important Notes

- ไม่ต้องส่ง `requestId` จาก frontend
- response หน้านี้ไม่ใช้ `cems_wpms_connection_requests` เป็นข้อมูลหลัก
- ถ้ากดปุ่ม `CEMS` บน dashboard ให้เรียก `/api/v1/operator-factory-dashboard?systemType=CEMS`
- ถ้ากดปุ่ม `WPMS` บน dashboard ให้เรียก `/api/v1/operator-factory-dashboard?systemType=WPMS`
- ถ้าต้องแสดงเฉพาะ favorite ให้เรียก `?favoriteOnly=true`
- ถ้าหน้าขอเชื่อมต่อต้องใช้รายชื่อโรงงานเข้าข่ายสำหรับเพิ่มจุดตรวจวัด ให้ใช้ `GET /api/v1/cems-wpms-requests/operator-factories`
