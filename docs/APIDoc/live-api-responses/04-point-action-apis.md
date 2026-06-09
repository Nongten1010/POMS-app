# Point Action APIs

## GET `/api/v1/connected-measurement-points/P0001/requests`

Status: `200`

```json
{
  "success": true,
  "data": [
    {
      "id": 6,
      "requestNo": "WPMS-69-00001",
      "requestType": "ADD_MEASUREMENT_POINT",
      "status": "CONNECTED",
      "statusLabel": "เชื่อมต่อแล้ว",
      "measurementPoints": [
        {
          "pointCode": "P0001",
          "parameters": ["BOD (mg/l)", "COD (mg/l)"]
        }
      ]
    }
  ],
  "meta": {
    "total": 1
  }
}
```

## GET `/api/v1/connected-measurement-points/S0001/requests`

Status: `200`

```json
{
  "success": true,
  "data": [
    {
      "id": 7,
      "requestNo": "CEMS-69-00002",
      "requestType": "ADD_PARAMETER",
      "status": "PENDING_DESIGN_REVIEW",
      "statusLabel": "รอพิจารณาแบบ",
      "measurementPoints": [
        {
          "pointCode": "S0001",
          "parameters": ["CO (ppm)"]
        }
      ]
    },
    {
      "id": 5,
      "requestNo": "CEMS-69-00001",
      "requestType": "ADD_MEASUREMENT_POINT",
      "status": "CONNECTED",
      "statusLabel": "เชื่อมต่อแล้ว",
      "measurementPoints": [
        {
          "pointCode": "S0001",
          "parameters": ["CO2 (%)", "CO2 (ppm)"]
        }
      ]
    }
  ],
  "meta": {
    "total": 2
  }
}
```

## GET `/api/v1/connected-measurement-points/P0001/parameter-form`

Status: `200`

```json
{
  "success": true,
  "data": {
    "requestType": "ADD_PARAMETER",
    "sourceRequestNo": "WPMS-69-00001",
    "stationId": "P0001",
    "formDefaults": {
      "measurementPoints": [
        {
          "pointCode": "P0001",
          "parameters": ["BOD (mg/l)", "COD (mg/l)"],
          "measurementInstruments": {
            "parameters": [
              {
                "parameter": "BOD (mg/l)"
              },
              {
                "parameter": "COD (mg/l)"
              }
            ]
          }
        }
      ]
    }
  }
}
```

## GET `/api/v1/connected-measurement-points/S0001/parameter-form`

Status: `200`

```json
{
  "success": true,
  "data": {
    "requestType": "ADD_PARAMETER",
    "sourceRequestNo": "CEMS-69-00001",
    "stationId": "S0001",
    "formDefaults": {
      "measurementPoints": [
        {
          "pointCode": "S0001",
          "parameters": ["CO2 (%)", "CO2 (ppm)"],
          "measurementInstruments": {
            "parameters": [
              {
                "parameter": "CO2 (%)"
              },
              {
                "parameter": "CO2 (ppm)"
              }
            ]
          }
        }
      ]
    }
  }
}
```

## GET `/api/v1/connected-measurement-points/P0001/device-configs`

Status: `200`

```json
{
  "success": true,
  "data": {
    "requestNo": "WPMS-69-00001",
    "stationId": "P0001",
    "monitoringPoint": {
      "pointCode": "P0001",
      "parameters": ["BOD (mg/l)", "COD (mg/l)"]
    },
    "parameterOptions": ["BOD (mg/l)", "COD (mg/l)"],
    "connectionForms": [
      {
        "protocol": "MODBUS_TCP"
      }
    ],
    "statusManagement": {
      "selectedParameters": ["ทั้งหมด"],
      "status": "Normal"
    }
  }
}
```

## GET `/api/v1/connected-measurement-points/S0001/device-configs`

Status: `200`

```json
{
  "success": true,
  "data": {
    "requestNo": "CEMS-69-00001",
    "stationId": "S0001",
    "monitoringPoint": {
      "pointCode": "S0001",
      "parameters": ["CO2 (%)", "CO2 (ppm)"]
    },
    "parameterOptions": ["CO2 (%)", "CO2 (ppm)"],
    "connectionForms": [
      {
        "protocol": "MODBUS_RTU"
      },
      {
        "protocol": "MODBUS_RTU"
      }
    ],
    "statusManagement": {
      "selectedParameters": ["ทั้งหมด"],
      "status": "Normal"
    }
  }
}
```

