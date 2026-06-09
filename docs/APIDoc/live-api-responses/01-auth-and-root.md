# Auth And Root

## GET `/api/v1`

Status: `200`

Response:

```json
{
  "success": true,
  "message": "POMS API",
  "version": "0.1.0"
}
```

## POST `/api/v1/auth/login`

Request ใช้สำหรับยิงชุดนี้:

```json
{
  "userType": "officer",
  "username": "weekit",
  "departmentID": "2",
  "password": "<masked>"
}
```

Status: `200`

Response shape จริงบน server:

```json
{
  "accessToken": "<masked>",
  "user": {
    "userType": "admin",
    "username": "1102001567054",
    "fullName": "นายวีกิจ ชมญาติ",
    "department": "กรมโรงงานอุตสาหกรรม",
    "lineNameTh": "นักวิชาการคอมพิวเตอร์",
    "levelNameTh": "ชำนาญการ",
    "roles": "admin",
    "isActive": true
  },
  "permissions": {
    "dashboard": {
      "data": "ALL",
      "view": true
    },
    "factories": {
      "data": "ALL",
      "view": true,
      "edit": true
    },
    "connection": {
      "data": "ALL",
      "view": true,
      "edit": true
    }
  }
}
```

หมายเหตุ: production response วาง `accessToken` ไว้ top-level ไม่ได้อยู่ใต้ `data.accessToken`.

