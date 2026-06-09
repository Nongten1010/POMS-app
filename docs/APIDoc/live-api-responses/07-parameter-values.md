# Parameter Values

Date used for list endpoint: `2026-06-09`

## GET `/api/v1/parameter-values/tables`

Status: `200`

Meta:

```json
{
  "total": 12
}
```

Response sample:

```json
{
  "success": true,
  "data": [
    {
      "schemaName": "ingest",
      "tableName": "P0001_data_1day",
      "columnCount": 392,
      "rowCount": 240
    },
    {
      "schemaName": "ingest",
      "tableName": "P0001_data_1m",
      "columnCount": 392,
      "rowCount": 240
    },
    {
      "schemaName": "ingest",
      "tableName": "S0001_data_60m",
      "columnCount": 392,
      "rowCount": 250
    }
  ],
  "meta": {
    "total": 12
  }
}
```

## GET `/api/v1/parameter-values/latest?stationId=P0001&interval=60m`

Status: `200`

```json
{
  "success": true,
  "data": {
    "station_id": "P0001",
    "bod_value": null,
    "bod_units": null,
    "bod_status": null,
    "cod_value": null,
    "cod_units": null,
    "cod_status": null,
    "cdate": "2026-06-10",
    "ctime": "23:00:00",
    "udate": "2026-06-10",
    "utime": "23:00:00"
  },
  "meta": {
    "stationId": "P0001",
    "interval": "60m",
    "schemaName": "ingest",
    "tableName": "P0001_data_60m",
    "count": 1,
    "registeredParameters": ["BOD (mg/l)", "COD (mg/l)"],
    "returnedColumns": [
      "station_id",
      "bod_value",
      "bod_units",
      "bod_status",
      "cod_value",
      "cod_units",
      "cod_status",
      "cdate",
      "ctime",
      "udate",
      "utime"
    ]
  }
}
```

## GET `/api/v1/parameter-values/latest?stationId=S0001&interval=60m`

Status: `200`

```json
{
  "success": true,
  "data": {
    "station_id": "S0001",
    "co2_value": "563",
    "co2_units": "ppm",
    "co2_status": "Normal",
    "cdate": "2026-06-10",
    "ctime": "23:00:00",
    "udate": "2026-06-10",
    "utime": "23:00:00"
  },
  "meta": {
    "stationId": "S0001",
    "interval": "60m",
    "schemaName": "ingest",
    "tableName": "S0001_data_60m",
    "count": 1,
    "registeredParameters": ["CO2 (%)", "CO2 (ppm)"],
    "returnedColumns": [
      "station_id",
      "co2_value",
      "co2_units",
      "co2_status",
      "cdate",
      "ctime",
      "udate",
      "utime"
    ]
  }
}
```

Observation: `registeredParameters` มีสองตัว แต่ `returnedColumns` มี `co2_*` ชุดเดียว.

## GET `/api/v1/parameter-values/latest?stationId=S0001&interval=real`

Status: `200`

```json
{
  "success": true,
  "data": {
    "station_id": "S0001",
    "co2_value": "533",
    "co2_units": "ppm",
    "co2_status": "Normal",
    "cdate": "2026-06-10",
    "ctime": "23:00:00",
    "udate": "2026-06-10",
    "utime": "23:00:00"
  },
  "meta": {
    "stationId": "S0001",
    "interval": "real",
    "schemaName": "ingest",
    "tableName": "S0001_data_real",
    "count": 1,
    "registeredParameters": ["CO2 (%)", "CO2 (ppm)"],
    "returnedColumns": [
      "station_id",
      "co2_value",
      "co2_units",
      "co2_status",
      "cdate",
      "ctime",
      "udate",
      "utime"
    ]
  }
}
```

## GET `/api/v1/parameter-values/connection-test?stationId=P0001`

Status: `200`

```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2026-06-10 23:00:00",
      "values": {
        "BOD (mg/l)": null,
        "COD (mg/l)": null
      },
      "statuses": {
        "BOD (mg/l)": null,
        "COD (mg/l)": null
      }
    }
  ],
  "meta": {
    "stationId": "P0001",
    "interval": "test",
    "schemaName": "ingest",
    "tableName": "P0001_data_test",
    "count": 5,
    "registeredParameters": ["BOD (mg/l)", "COD (mg/l)"]
  }
}
```

## GET `/api/v1/parameter-values/connection-test?stationId=S0001`

Status: `200`

```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2026-06-10 23:00:00",
      "values": {
        "CO2 (%)": "583",
        "CO2 (ppm)": "583"
      },
      "statuses": {
        "CO2 (%)": "Normal",
        "CO2 (ppm)": "Normal"
      }
    },
    {
      "timestamp": "2026-06-10 22:00:00",
      "values": {
        "CO2 (%)": "582",
        "CO2 (ppm)": "582"
      },
      "statuses": {
        "CO2 (%)": "Normal",
        "CO2 (ppm)": "Normal"
      }
    }
  ],
  "meta": {
    "stationId": "S0001",
    "interval": "test",
    "schemaName": "ingest",
    "tableName": "S0001_data_test",
    "count": 5,
    "registeredParameters": ["CO2 (%)", "CO2 (ppm)"]
  }
}
```

## GET `/api/v1/parameter-values?stationId=P0001&interval=60m&startDate=2026-06-09&endDate=2026-06-09`

Status: `200`

```json
{
  "success": true,
  "data": [
    {
      "station_id": "P0001",
      "bod_value": null,
      "bod_units": null,
      "bod_status": null,
      "cod_value": null,
      "cod_units": null,
      "cod_status": null,
      "cdate": "2026-06-09",
      "ctime": "23:00:00",
      "udate": "2026-06-09",
      "utime": "23:00:00"
    }
  ],
  "meta": {
    "stationId": "P0001",
    "interval": "60m",
    "schemaName": "ingest",
    "tableName": "P0001_data_60m",
    "startDate": "2026-06-09",
    "endDate": "2026-06-09",
    "count": 24,
    "registeredParameters": ["BOD (mg/l)", "COD (mg/l)"],
    "returnedColumns": [
      "station_id",
      "bod_value",
      "bod_units",
      "bod_status",
      "cod_value",
      "cod_units",
      "cod_status",
      "cdate",
      "ctime",
      "udate",
      "utime"
    ]
  }
}
```

## GET `/api/v1/parameter-values?stationId=S0001&interval=60m&startDate=2026-06-09&endDate=2026-06-09`

Status: `200`

```json
{
  "success": true,
  "data": [
    {
      "station_id": "S0001",
      "co2_value": "562",
      "co2_units": "ppm",
      "co2_status": "Normal",
      "cdate": "2026-06-09",
      "ctime": "23:00:00",
      "udate": "2026-06-09",
      "utime": "23:00:00"
    }
  ],
  "meta": {
    "stationId": "S0001",
    "interval": "60m",
    "schemaName": "ingest",
    "tableName": "S0001_data_60m",
    "startDate": "2026-06-09",
    "endDate": "2026-06-09",
    "count": 24,
    "registeredParameters": ["CO2 (%)", "CO2 (ppm)"],
    "returnedColumns": [
      "station_id",
      "co2_value",
      "co2_units",
      "co2_status",
      "cdate",
      "ctime",
      "udate",
      "utime"
    ]
  }
}
```

