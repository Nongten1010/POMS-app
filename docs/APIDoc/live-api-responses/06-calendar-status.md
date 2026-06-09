# Calendar Status

Month used: `2026-06`

## GET `/api/v1/connected-measurement-points/P0001/calendar-status?month=2026-06`

Status: `200`

Meta:

```json
{
  "stationId": "P0001",
  "interval": "60m",
  "schemaName": "ingest",
  "tableName": "P0001_data_60m",
  "month": "2026-06",
  "count": 240,
  "registeredParameters": ["BOD (mg/l)", "COD (mg/l)"]
}
```

Response sample:

```json
{
  "success": true,
  "data": {
    "calendar": {
      "year": 2026,
      "month": 6,
      "days": [
        {
          "date": "2026-06-01",
          "dataCompletenessPercent": 0,
          "dataCompletenessStatus": "lowData",
          "pollutionStatus": "insufficient",
          "display": {
            "backgroundStatus": "lowData",
            "borderStatus": "insufficient"
          }
        }
      ]
    },
    "monthlySummary": [
      {
        "parameterCode": "BOD",
        "parameterName": "BOD",
        "unit": "mg/l",
        "exceededDays": 0,
        "lowDataDays": 10,
        "todayDataCompletenessPercent": 0
      },
      {
        "parameterCode": "COD",
        "parameterName": "COD",
        "unit": "mg/l",
        "exceededDays": 0,
        "lowDataDays": 10,
        "todayDataCompletenessPercent": 0
      }
    ]
  }
}
```

Status ที่พบในเดือนนี้: `insufficient` 10 วัน

## GET `/api/v1/connected-measurement-points/S0001/calendar-status?month=2026-06`

Status: `200`

Meta:

```json
{
  "stationId": "S0001",
  "interval": "60m",
  "schemaName": "ingest",
  "tableName": "S0001_data_60m",
  "month": "2026-06",
  "count": 240,
  "registeredParameters": ["CO2 (%)", "CO2 (ppm)"]
}
```

Response sample:

```json
{
  "success": true,
  "data": {
    "calendar": {
      "year": 2026,
      "month": 6,
      "days": [
        {
          "date": "2026-06-01",
          "dataCompletenessPercent": 100,
          "dataCompletenessStatus": "highData",
          "pollutionStatus": "normal",
          "display": {
            "backgroundStatus": "highData",
            "borderStatus": "normal"
          }
        }
      ]
    },
    "monthlySummary": [
      {
        "parameterCode": "CO2",
        "parameterName": "CO2",
        "unit": "%",
        "exceededDays": 0,
        "lowDataDays": 0,
        "todayDataCompletenessPercent": 100
      },
      {
        "parameterCode": "CO2",
        "parameterName": "CO2",
        "unit": "ppm",
        "exceededDays": 0,
        "lowDataDays": 0,
        "todayDataCompletenessPercent": 100
      }
    ]
  }
}
```

Status ที่พบในเดือนนี้: `normal` 10 วัน
