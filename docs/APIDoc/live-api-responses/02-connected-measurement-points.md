# Connected Measurement Points

## GET `/api/v1/connected-measurement-points`

Status: `200`

Meta:

```json
{
  "total": 2
}
```

Response summary:

```json
{
  "success": true,
  "data": [
    {
      "id": 7,
      "requestId": 6,
      "requestNo": "WPMS-69-00001",
      "type": "WPMS",
      "status": "เชื่อมต่อแล้ว",
      "statusCode": "CONNECTED",
      "connectedAt": "2026-06-08T08:33:51.647Z",
      "factory": {
        "factoryId": "10190000225448",
        "factoryName": "บริษัท ปูนซิเมนต์นครหลวง จำกัด (มหาชน) โรงงาน 2",
        "newRegistrationNo": "3-101-2/44สบ",
        "province": "สระบุรี",
        "eligibilityStatus": "ไม่เข้าข่าย"
      },
      "point": {
        "pointName": "จุดระบายน้ำทิ้ง A",
        "pointCode": "P0001",
        "pointType": "WASTEWATER",
        "parameters": ["BOD (mg/l)", "COD (mg/l)"],
        "measurementInstruments": {
          "parameters": [
            {
              "parameter": "BOD (mg/l)",
              "technique": "NDIR",
              "range": "0-200"
            },
            {
              "parameter": "COD (mg/l)",
              "technique": "NDIR",
              "range": "0-180"
            }
          ]
        }
      },
      "deviceConfigs": [
        {
          "stationId": "P0001",
          "device": [
            {
              "deviceCode": "P0001/01",
              "protocol": "MODBUS_TCP"
            }
          ],
          "channels": [
            {
              "deviceCode": "P0001/01",
              "addressId": 40001,
              "dataType": "BOD (mg/l)",
              "status": "Start up"
            },
            {
              "deviceCode": "P0001/01",
              "addressId": 40002,
              "dataType": "COD (mg/l)",
              "status": "Start up"
            }
          ],
          "statusManagement": {
            "selectedParameters": ["ทั้งหมด"],
            "status": "Normal"
          }
        }
      ]
    },
    {
      "id": 6,
      "requestId": 5,
      "requestNo": "CEMS-69-00001",
      "type": "CEMS",
      "status": "เชื่อมต่อแล้ว",
      "statusCode": "CONNECTED",
      "connectedAt": "2026-06-07T16:18:30.239Z",
      "factory": {
        "factoryId": "10190000225448",
        "factoryName": "บริษัท ปูนซิเมนต์นครหลวง จำกัด (มหาชน) โรงงาน 2",
        "newRegistrationNo": "3-101-2/44สบ",
        "province": "สระบุรี",
        "eligibilityStatus": "ไม่เข้าข่าย"
      },
      "point": {
        "pointName": "ปล่องระบาย A",
        "pointCode": "S0001",
        "pointType": "STACK",
        "parameters": ["CO2 (%)", "CO2 (ppm)"],
        "measurementInstruments": {
          "parameters": [
            {
              "parameter": "CO2 (%)",
              "technique": "NDIR",
              "range": "0-200"
            },
            {
              "parameter": "CO2 (ppm)",
              "technique": "NDIR",
              "range": "0-180"
            }
          ]
        }
      },
      "deviceConfigs": [
        {
          "stationId": "S0001",
          "device": [
            {
              "deviceCode": "S0001/02",
              "protocol": "MODBUS_RTU",
              "settings": {
                "comPort": 1,
                "slaveId": 1,
                "baudRate": 9600
              }
            },
            {
              "deviceCode": "S0001/01",
              "protocol": "MODBUS_RTU",
              "settings": {
                "comPort": 1,
                "slaveId": 1,
                "baudRate": 9600
              }
            }
          ],
          "channels": [
            {
              "deviceCode": "S0001/02",
              "addressId": 40002,
              "dataType": "CO2 (ppm)",
              "status": "Start up"
            },
            {
              "deviceCode": "S0001/01",
              "addressId": 40001,
              "dataType": "CO2 (%)",
              "status": "Start up"
            }
          ],
          "statusManagement": {
            "selectedParameters": ["ทั้งหมด"],
            "status": "Normal"
          }
        }
      ]
    }
  ],
  "meta": {
    "total": 2
  }
}
```

## GET `/api/v1/cems-wpms-requests/connected-measurement-points`

Status: `200`

เป็น legacy alias และ response เหมือน `GET /api/v1/connected-measurement-points`.

## GET `/api/v1/connected-measurement-points?stationId=P0001`

Status: `200`

Meta:

```json
{
  "total": 1
}
```

คืนเฉพาะจุด `P0001`.

## GET `/api/v1/connected-measurement-points?stationId=S0001`

Status: `200`

Meta:

```json
{
  "total": 1
}
```

คืนเฉพาะจุด `S0001`.

