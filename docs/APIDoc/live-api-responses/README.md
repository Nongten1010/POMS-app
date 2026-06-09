# Live API Responses

ผลยิง API จริงจาก `http://d-poms.diw.go.th` เมื่อ `2026-06-09`.

ใช้ login admin mock:

```json
{
  "userType": "officer",
  "username": "weekit",
  "departmentID": "2",
  "password": "<masked>"
}
```

Token ถูก mask ออกจากเอกสารนี้ทั้งหมด

## Files

| File | API |
| --- | --- |
| [00-summary.md](./00-summary.md) | สรุปจุดตรวจวัดและข้อสังเกต |
| [01-auth-and-root.md](./01-auth-and-root.md) | `POST /auth/login`, `GET /api/v1` |
| [02-connected-measurement-points.md](./02-connected-measurement-points.md) | `GET /connected-measurement-points` และ legacy alias |
| [03-operator-factory-dashboard.md](./03-operator-factory-dashboard.md) | `GET /operator-factory-dashboard` |
| [04-point-action-apis.md](./04-point-action-apis.md) | `/:stationId/requests`, `parameter-form`, `device-configs` |
| [05-measurement-statistics.md](./05-measurement-statistics.md) | `/:stationId/measurement-statistics` |
| [06-calendar-status.md](./06-calendar-status.md) | `/:stationId/calendar-status` |
| [07-parameter-values.md](./07-parameter-values.md) | `/parameter-values/*` |

