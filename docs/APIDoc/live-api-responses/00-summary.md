# Summary

Base URL: `http://d-poms.diw.go.th`

วันที่ยิง: `2026-06-09`

## Connected Measurement Points

| stationId | systemType | requestNo | statusCode | status | connectedAt | parameters |
| --- | --- | --- | --- | --- | --- | --- |
| `P0001` | `WPMS` | `WPMS-69-00001` | `CONNECTED` | `เชื่อมต่อแล้ว` | `2026-06-08T08:33:51.647Z` | `BOD (mg/l)`, `COD (mg/l)` |
| `S0001` | `CEMS` | `CEMS-69-00001` | `CONNECTED` | `เชื่อมต่อแล้ว` | `2026-06-07T16:18:30.239Z` | `CO2 (%)`, `CO2 (ppm)` |

## Endpoint Status

| API | Result |
| --- | --- |
| `GET /api/v1` | `200` |
| `POST /api/v1/auth/login` | `200` |
| `GET /api/v1/connected-measurement-points` | `200` |
| `GET /api/v1/cems-wpms-requests/connected-measurement-points` | `200` |
| `GET /api/v1/operator-factory-dashboard?systemType=CEMS` | `200` |
| `GET /api/v1/operator-factory-dashboard?systemType=WPMS` | `200` |
| `GET /api/v1/connected-measurement-points/:stationId/requests` | `200` |
| `GET /api/v1/connected-measurement-points/:stationId/parameter-form` | `200` |
| `GET /api/v1/connected-measurement-points/:stationId/device-configs` | `200` |
| `GET /api/v1/connected-measurement-points/:stationId/measurement-statistics` | `200` |
| `GET /api/v1/connected-measurement-points/:stationId/calendar-status` | `200` |
| `GET /api/v1/parameter-values/tables` | `200` |
| `GET /api/v1/parameter-values/latest` | `200` |
| `GET /api/v1/parameter-values/connection-test` | `200` |
| `GET /api/v1/parameter-values` | `200` |

## Findings

1. จุดตรวจวัดทั้ง `P0001` และ `S0001` อยู่สถานะคำขอ `CONNECTED` / `เชื่อมต่อแล้ว`.
2. `P0001` register พารามิเตอร์ครบ 2 ตัว แต่ค่าจริงและ status ในตาราง ingest เป็น `null`.
3. `S0001` register พารามิเตอร์ครบ 2 ตัว (`CO2 (%)`, `CO2 (ppm)`) แต่ API ค่า latest/list/statistics ยุบ column เป็น `co2_*` ชุดเดียว จึงแยกสองหน่วยไม่ได้ใน response กลุ่มนั้น.
4. `S0001` endpoint `connection-test` แยก `CO2 (%)` และ `CO2 (ppm)` ได้ถูกต้อง และ status เป็น `Normal`.
5. `operator-factory-dashboard?systemType=CEMS` และ `?systemType=WPMS` ยังคืนทั้งจุด `P0001/WPMS` และ `S0001/CEMS` ใน factory เดียวกัน.

