# Operator Factory Dashboard

## GET `/api/v1/operator-factory-dashboard?systemType=CEMS`

Status: `200`

Meta:

```json
{
  "total": 1
}
```

Response summary:

```json
{
  "success": true,
  "data": [
    {
      "factoryId": "10190000225448",
      "factoryName": "บริษัท ปูนซิเมนต์นครหลวง จำกัด (มหาชน) โรงงาน 2",
      "newRegistrationNo": "3-101-2/44สบ",
      "province": "สระบุรี",
      "status": "แสดง",
      "monitoringPointCountBySystem": [
        {
          "systemType": "CEMS",
          "count": 1
        },
        {
          "systemType": "WPMS",
          "count": 1
        }
      ],
      "measurementPoints": [
        {
          "stationId": "P0001",
          "pointCode": "P0001",
          "systemType": "WPMS",
          "parameters": ["BOD (mg/l)", "COD (mg/l)"],
          "data": [
            {
              "station_id": "P0001",
              "BOD (mg/l)": null,
              "COD (mg/l)": null,
              "cdate": "2026-06-10",
              "ctime": "23:00:00"
            }
          ]
        },
        {
          "stationId": "S0001",
          "pointCode": "S0001",
          "systemType": "CEMS",
          "parameters": ["CO2 (%)", "CO2 (ppm)"],
          "data": [
            {
              "station_id": "S0001",
              "CO2 (ppm)": "563",
              "cdate": "2026-06-10",
              "ctime": "23:00:00"
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

## GET `/api/v1/operator-factory-dashboard?systemType=WPMS`

Status: `200`

Meta:

```json
{
  "total": 1
}
```

Response summary เหมือน CEMS คือยังคืนทั้ง `P0001/WPMS` และ `S0001/CEMS` ใน `measurementPoints`.

## Observation

แม้ส่ง `systemType=CEMS` หรือ `systemType=WPMS` response ยังมี measurement point ทั้งสองระบบอยู่ใน factory เดียวกัน.

