# Frontend handoff: Validation และ error handling

[กลับไปหน้า handoff](./README.md) · [Canonical API contract](../../../api/menus/connection-requests/device-configs.md)

## แบ่งหน้าที่ validation

Frontend ควร block ข้อมูลที่ผู้ใช้แก้ได้ทันทีและทราบแน่จาก contract:

- required structural context: access token, `requestId` ตาม context และ `stationId`
- connection type ต้อง map เป็น protocol ที่ backend รองรับ
- schedule ต้องมี parameter, start, end, status
- datetime ต้องเป็นวันเวลาที่มีอยู่จริง แปลงเป็น `YYYY-MM-DD HH:mm:ss` ได้ และมีลำดับถูกต้อง
- overlap, `ทั้งหมด`, max 100 schedules
- status ต้องอยู่ใน enum

Backend ยังคงเป็นผู้ตรวจ boundary ทั้งหมด รวมถึง:

- authentication, permission และ data scope
- request status/owner และ station relation
- request body shape, `stationId`, `protocol`, batch/channel limits
- schedule enum/time/overlap/parameter membership

อย่าปิดปุ่ม submit เพียงเพราะ optional settings/channel fields ว่าง แต่ต้องไม่ยิง API เมื่อ structural context หรือ schedule ที่ผู้ใช้เพิ่งสร้างผิด

## Validation error envelope

เมื่อ Zod validation ไม่ผ่าน backend ตอบ `400` รูปแบบ:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "statusManagement": ["..."]
    },
    "issues": [
      {
        "code": "custom",
        "path": ["statusManagement", "schedules", 1, "startAt"],
        "pathString": "statusManagement.schedules.1.startAt",
        "message": "Schedule overlaps schedules[0] for the same parameter"
      }
    ]
  }
}
```

Frontend ควรอ่านตามลำดับ:

1. `error.issues[]` เพื่อ map `pathString` ไปยัง field/row ที่ตรงที่สุด
2. `error.details` สำหรับ validation summary หรือ `BAD_REQUEST` context
3. `error.message` เป็น fallback

`BAD_REQUEST` จาก business rule อาจมี `details` แต่ไม่มี `issues` เช่น station ไม่อยู่ใน request หรือ schedule ใช้ parameter ที่ไม่อยู่ในจุด

## Mapping ที่ควรรองรับ

| Error | UI behavior |
| --- | --- |
| schedule time/overlap | แสดงใต้ input หรือแถว schedule ที่เกี่ยวข้อง |
| parameter ไม่อยู่ในจุด | refresh `parameterOptions` และให้ผู้ใช้เลือกใหม่ |
| `POMS_BOX`/protocol ไม่ถูกต้อง | block ก่อน submit และแจ้งให้เลือก connection ใหม่ |
| `401 UNAUTHORIZED` | login ใหม่/refresh token ตามระบบ auth |
| `403 FORBIDDEN` | ปิด action และแจ้งสิทธิ์ไม่เพียงพอ |
| `404 NOT_FOUND` | ปิด dialog หรือ refresh รายการต้นทาง |
| `500 INTERNAL_ERROR` | แสดงข้อความทั่วไป ห้ามแสดง stack/detail ภายใน |

## ข้อกำหนด UX

- validation message ต้องอยู่ใกล้ field หรือ schedule row
- ค่าใน form ต้องไม่หายเมื่อ API ตอบ error
- disable ปุ่มระหว่าง request เพื่อป้องกัน submit ซ้ำ
- หลัง POST สำเร็จ ให้ GET endpoint เดิมอีกครั้งและใช้ response เป็น source of truth
- log ฝั่ง browser ห้ามพิมพ์ access token, `dbPass` หรือ response ที่มี secret
