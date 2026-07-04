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
      "oldRegistrationNo": "รง.4-เก่า-001",
      "factoryLogoUrl": "https://example.com/files/logo.png",
      "industryMainOrder": "8802",
      "industryMainOrderLabel": "ประเภทโรงงานลำดับที่ 88(2): การผลิตพลังงานไฟฟ้าจากพลังงานความร้อน",
      "industrySubOrder": null,
      "eia": "ไม่มี",
      "hasEia": false,
      "regionCode": "ภาคตะวันออก",
      "regionName": "ภาคตะวันออก",
      "provinceCode": "24",
      "provinceName": "ฉะเชิงเทรา",
      "province": "สระบุรี",
      "address": "99 หมู่ 1",
      "latitude": "13.7563",
      "longitude": "100.5018",
      "districtCode": null,
      "districtName": null,
      "industrialAreaType": "INDUSTRIAL_ESTATE",
      "industrialAreaTypeLabel": "ในนิคมอุตสาหกรรม",
      "industrialEstateCode": "MTP",
      "industrialEstateName": "นิคมอุตสาหกรรมมาบตาพุด",
      "isFavorite": true,
      "hasLatestHourlyMeasurement": true,
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
| `oldRegistrationNo` | string|null | เลขทะเบียนโรงงานเก่าจาก `factories.factory_registration_no_old` |
| `factoryLogoUrl` | string|null | URL รูปโลโก้จากเอกสารแนบ CEMS title `สัญลักษณ์ของโรงงานหรือโลโก้บริษัท`; ถ้าไม่มีคืน `null` |
| `industryMainOrder` | string|null | รหัสประเภทโรงงานหลัก 4 หลักจาก `eligible_factories.factory_type_sequence` เช่น `8802` |
| `industryMainOrderLabel` | string|null | คำอธิบายประเภทโรงงานหลักจาก DIW source `dbo.TCLASS` เช่น `ประเภทโรงงานลำดับที่ 88(2): ...` |
| `industrySubOrder` | string|null | รหัสประเภทโรงงานรองจาก `eligible_factories.factory_type_sequence` |
| `eia` | `มี`\|`ไม่มี`\|null | label ผล EIA/การเข้าข่าย EIA |
| `hasEia` | boolean|null | boolean สำหรับ filter/logic ฝั่ง frontend |
| `regionCode` / `regionName` | string|null | ภาคจาก `provinces.region` |
| `provinceCode` / `provinceName` | string|null | จังหวัดจาก `factories.province_id` + `provinces.name_th` |
| `province` | string|null | จังหวัดเดิมเพื่อ backward compatibility; ค่าเดียวกับ `provinceName` |
| `address` | string|null | ที่อยู่โรงงาน |
| `latitude` | string|null | พิกัด latitude ของโรงงาน |
| `longitude` | string|null | พิกัด longitude ของโรงงาน |
| `districtCode` / `districtName` | string|null | อำเภอ/เขต; ตอนนี้ยังไม่มี source แยกใน dashboard จึงคืน `null` |
| `industrialAreaType` | `INDUSTRIAL_ESTATE`\|`OUTSIDE_INDUSTRIAL_ESTATE` | อยู่ในนิคม/นอกนิคม ใช้จากการมี `industrialEstateCode` หรือ `industrialEstateName` |
| `industrialAreaTypeLabel` | string | label ไทยสำหรับพื้นที่ประกอบกิจการ |
| `industrialEstateCode` / `industrialEstateName` | string|null | รหัส/ชื่อนิคมจาก `industrial_estates`; มีค่าเมื่อ `industrialAreaType = INDUSTRIAL_ESTATE` |
| `isFavorite` | boolean | โรงงานนี้ถูก user ปัจจุบันติดดาวหรือไม่ |
| `hasLatestHourlyMeasurement` | boolean | มีค่าตรวจวัดชั่วโมงล่าสุดใน `measurementPoints[].data` อย่างน้อย 1 แถวหรือไม่ |
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
| ลำดับประเภทโรงงาน | `industryMainOrder`, `industryMainOrderLabel` |
| ภาค | `regionName` |
| จังหวัด | `provinceName` |
| เขต/อำเภอ | `districtName` |
| พื้นที่ประกอบกิจการ | `industrialAreaType`, `industrialAreaTypeLabel` |
| นิคมอุตสาหกรรม | `industrialEstateName` |
| มีผลการตรวจวัดชั่วโมงล่าสุด | `hasLatestHourlyMeasurement` |
| ที่อยู่ | `address` |
| ป้าย CEMS/WPMS | `monitoringPointCountBySystem[].count > 0` |
| ดาว favorite | `isFavorite` |
| แผนที่ marker | `latitude`, `longitude` |
| ตารางค่าตรวจวัด | `measurementPoints[].data` |
| จุดตรวจวัดในตาราง | `measurementPoints[].data[].station_id` |
| วันที่ | `measurementPoints[].data[].cdate` |
| เวลา | `measurementPoints[].data[].ctime` |

## Detail Page APIs

API สำหรับหน้ารายละเอียดหลังเลือกจุดตรวจวัด/โรงงานจากหน้าแผนที่หรือรายการโรงงาน

Base URL:

```text
/api/v1/connected-measurement-points/:stationId
```

Header:

```http
Authorization: Bearer <accessToken>
```

Permission สำหรับ `calendar-status` และ `measurement-statistics`: `dashboard.stats:view`

Data source:

| ส่วนข้อมูล | Source |
| --- | --- |
| โรงงาน/จุดตรวจวัด | current connected measurement point |
| ข้อมูลรายชั่วโมง | Parameter DB ตาราง `{stationId}_data_60m` เช่น `S0001_data_60m` |
| พารามิเตอร์ที่แสดง | registered parameters ของจุดตรวจวัดนั้น |

`stationId` ต้องเป็น safe SQL identifier เพราะ backend ใช้ประกอบชื่อตาราง parameter ingestion เช่น `S0001`, `P0001`

### GET Measurement Point Modal Detail

```http
GET /api/v1/connected-measurement-points/factories/factory-001
```

ใช้กับ modal "รายละเอียดจุดตรวจวัด" โดยคืนรายการจุดตรวจวัดของโรงงาน และแต่ละแถวมีเฉพาะ 4 field:

```json
{
  "success": true,
  "data": [
    {
      "pointCode": "S0001",
      "pointName": "ปล่อง A",
      "pointType": "STACK",
      "parameterDetails": ["NOx (ppm)", "SO2 (ppm)"]
    }
  ],
  "meta": {
    "total": 1
  }
}
```

### GET Calendar Status

```http
GET /api/v1/connected-measurement-points/S0001/calendar-status?month=2026-06
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `month` | query string | Yes | เดือนรูปแบบ `YYYY-MM` |

Response หลัก: `data.factory`, `data.calendar.days[]`, `data.monthlySummary[]`, `meta.tableName`, `meta.registeredParameters`

กติกา `pollutionStatus` ของปฏิทิน: ใช้ลำดับ `normal < warning < exceeded < insufficient`; ค่า `normal`, `warning`, และ `exceeded` ตัดจากค่า `min` ของแถว `level: normal`, `level: warning`, และ `level: critical` ตามลำดับ โดย `level: critical` แสดงใน API เป็น `pollutionStatus: "exceeded"` และ `insufficient` ใช้เฉพาะวันที่ `dataCompletenessStatus` เป็น `lowData`

ตัวอย่าง response:

```json
{
  "success": true,
  "data": {
    "factory": {
      "factoryId": "factory-001",
      "factoryName": "บริษัท ทดสอบ จำกัด",
      "systemType": "CEMS"
    },
    "calendar": {
      "year": 2026,
      "month": 6,
      "days": [
        {
          "date": "2026-06-09",
          "dataCompletenessPercent": 83,
          "dataCompletenessStatus": "highData",
          "pollutionStatus": "exceeded",
          "display": {
            "backgroundStatus": "highData",
            "borderStatus": "exceeded"
          }
        }
      ]
    },
    "monthlySummary": [
      {
        "parameterCode": "CO",
        "parameterName": "CO",
        "unit": "ppm",
        "exceededDays": 1,
        "lowDataDays": 0,
        "todayDataCompletenessPercent": 83
      }
    ]
  },
  "meta": {
    "stationId": "S0001",
    "interval": "60m",
    "schemaName": "ingest",
    "tableName": "S0001_data_60m",
    "month": "2026-06",
    "count": 20,
    "registeredParameters": ["CO (ppm)"]
  }
}
```

### GET Measurement Statistics

```http
GET /api/v1/connected-measurement-points/S0001/measurement-statistics?date=2026-06-09
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `date` | query string | Yes | วันที่รูปแบบ `YYYY-MM-DD` |

Response หลัก: `data.factory`, `data.thresholds[]`, `data.measurementPoints[]`, `data.measurementPoints[].rows[]`, `meta.tableName`, `meta.registeredParameters`

`data.measurementPoints[]` คืนรายละเอียดจุดตรวจวัดที่เลือกพร้อมข้อมูลสถิติ ได้แก่ `pointCode`, `stationId`, `pointName`, `latitude`, `longitude`, `date`, และ `rows[]`

`latitude`/`longitude` ใช้ค่าจาก `cems_wpms_measurement_points.latitude/longitude` ก่อน ถ้าไม่มีค่า จะ fallback ไปที่ `details.stackLatitude/stackLongitude` สำหรับ CEMS หรือ `details.instrumentLatitude/instrumentLongitude` สำหรับ WPMS

หมายเหตุ `data.thresholds[]`: ต้องคืนรายการตามพารามิเตอร์ที่ถูกตั้งค่าไว้สำหรับจุดตรวจวัดนั้น เช่น `CO (ppm)`, `NOx (ppm)`, `Temp. (°C)` แม้บางพารามิเตอร์ยังไม่มีค่าเกณฑ์มาตรฐานครบ ให้คงแถวนั้นไว้และส่ง `normalMax: null`, `warningMax: null` เพื่อให้ frontend สร้าง column ได้ครบ ไม่ drop พารามิเตอร์ออกจากหน้าจอ

ตัวอย่าง response:

```json
{
  "success": true,
  "data": {
    "factory": {
      "factoryId": "factory-001",
      "factoryName": "บริษัท ทดสอบ จำกัด",
      "systemType": "CEMS"
    },
    "thresholds": [
      {
        "parameterCode": "CO",
        "parameterLabel": "CO (ppm)",
        "unit": "ppm",
        "normalMax": 180,
        "warningMax": 190
      },
      {
        "parameterCode": "NOX",
        "parameterLabel": "NOx (ppm)",
        "unit": "ppm",
        "normalMax": 180,
        "warningMax": 190
      },
      {
        "parameterCode": "TEMP",
        "parameterLabel": "Temp. (°C)",
        "unit": "°C",
        "normalMax": null,
        "warningMax": null
      }
    ],
    "measurementPoints": [
      {
        "pointCode": "S0001",
        "stationId": "S0001",
        "pointName": "ปล่องระบาย S0001",
        "latitude": 13.7563,
        "longitude": 100.5018,
        "date": "2026-06-09",
        "rows": [
          {
            "time": "00.00-00.59 น.",
            "chartTime": "00:00",
            "dataCompletenessPercent": 100,
            "values": {
              "CO (ppm)": {
                "value": 0.05,
                "displayValue": "0.05",
                "status": "normal"
              },
              "NOx (ppm)": {
                "value": null,
                "displayValue": "-",
                "status": "insufficient"
              },
              "Temp. (°C)": {
                "value": null,
                "displayValue": "-",
                "status": "insufficient"
              }
            }
          }
        ]
      }
    ]
  },
  "meta": {
    "stationId": "S0001",
    "interval": "60m",
    "schemaName": "ingest",
    "tableName": "S0001_data_60m",
    "date": "2026-06-09",
    "count": 1,
    "registeredParameters": ["CO (ppm)"]
  }
}
```

หมายเหตุ: `measurement-statistics` สร้าง `rows` ครบ 24 ชั่วโมงเสมอ ถ้าชั่วโมงไหนไม่มีข้อมูลจะได้ `displayValue = "-"` และ status เป็น `noData` หรือ `insufficient`
และ key ใน `values` ใช้ชื่อพารามิเตอร์พร้อมหน่วย เช่น `CO2 (%)`, `CO2 (ppm)`, `BOD (mg/L)` เพื่อไม่ให้พารามิเตอร์ base เดียวกันทับกันเอง

Status values:

| Status | ใช้เมื่อ |
| --- | --- |
| `normal` | ค่าปกติ |
| `warning` | ค่าอยู่ช่วงเฝ้าระวัง |
| `exceeded` | ค่าเกินมาตรฐาน |
| `insufficient` | ข้อมูลไม่พอ หรือ completeness ต่ำกว่า 80% |
| `noData` | ไม่มี row ของชั่วโมงนั้น |
| `invalid` | source status ไม่รู้จักหรือข้อมูลผิดรูปแบบ |

Column mapping:

| Registered parameter | Columns |
| --- | --- |
| `CO (ppm)` | `co_value`, `co_units`, `co_status` |
| `NOx (ppm)` | `nox_value`, `nox_units`, `nox_status` |
| `Temp. (°C)` | `temp_value`, `temp_units`, `temp_status` |
| `O2 (%)` | `o2_value`, `o2_units`, `o2_status` |
| `Flow (m3/hr)` | `flow_value`, `flow_units`, `flow_status` |

## PUT Favorite

| Item | Value |
| --- | --- |
| URL | `PUT /api/v1/operator-factories/:factoryId/favorite` |
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
curl -X PUT "http://localhost:3000/api/v1/operator-factories/factory-001/favorite" \
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
