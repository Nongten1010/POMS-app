# Measurement Statistics

Date used: `2026-06-09`

## GET `/api/v1/connected-measurement-points/P0001/measurement-statistics?date=2026-06-09`

Status: `200`

Meta:

```json
{
  "stationId": "P0001",
  "interval": "60m",
  "schemaName": "ingest",
  "tableName": "P0001_data_60m",
  "date": "2026-06-09",
  "count": 24,
  "registeredParameters": ["BOD (mg/l)", "COD (mg/l)"]
}
```

Response sample:

```json
{
  "success": true,
  "data": {
    "metadata": {
      "description": "สถิติรายชั่วโมงสำหรับตารางสถิติข้อมูลและกราฟแนวโน้มสถานการณ์มลพิษ",
      "date": "2026-06-09"
    },
    "thresholds": [],
    "measurementPoints": [
      {
        "pointCode": "P0001",
        "stationId": "P0001",
        "date": "2026-06-09",
        "rows": [
          {
            "time": "00.00-00.59 น.",
            "chartTime": "00:00",
            "dataCompletenessPercent": 0,
            "values": {
              "BOD": {
                "value": null,
                "displayValue": "-",
                "status": "insufficient"
              },
              "COD": {
                "value": null,
                "displayValue": "-",
                "status": "insufficient"
              }
            }
          }
        ]
      }
    ]
  }
}
```

Status ที่พบ: `insufficient` ทั้ง `BOD` และ `COD` รวม 24 ชั่วโมง

## GET `/api/v1/connected-measurement-points/S0001/measurement-statistics?date=2026-06-09`

Status: `200`

Meta:

```json
{
  "stationId": "S0001",
  "interval": "60m",
  "schemaName": "ingest",
  "tableName": "S0001_data_60m",
  "date": "2026-06-09",
  "count": 24,
  "registeredParameters": ["CO2 (%)", "CO2 (ppm)"]
}
```

Response sample:

```json
{
  "success": true,
  "data": {
    "metadata": {
      "description": "สถิติรายชั่วโมงสำหรับตารางสถิติข้อมูลและกราฟแนวโน้มสถานการณ์มลพิษ",
      "date": "2026-06-09"
    },
    "thresholds": [],
    "measurementPoints": [
      {
        "pointCode": "S0001",
        "stationId": "S0001",
        "date": "2026-06-09",
        "rows": [
          {
            "time": "00.00-00.59 น.",
            "chartTime": "00:00",
            "dataCompletenessPercent": 100,
            "values": {
              "CO2": {
                "value": 539,
                "displayValue": "539.00",
                "status": "insufficient"
              }
            }
          },
          {
            "time": "01.00-01.59 น.",
            "chartTime": "01:00",
            "dataCompletenessPercent": 100,
            "values": {
              "CO2": {
                "value": 540,
                "displayValue": "540.00",
                "status": "insufficient"
              }
            }
          }
        ]
      }
    ]
  }
}
```

Observation: meta มี `CO2 (%)` และ `CO2 (ppm)` แต่ `values` มี key เดียวคือ `CO2`.

