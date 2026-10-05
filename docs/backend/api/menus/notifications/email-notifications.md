# อีเมลแจ้งเตือนมลพิษ

[กลับไปหน้าเมนู](./README.md)

API นี้ใช้ดูตัวอย่างอีเมลจากเหตุการณ์ที่มีสิทธิ์เข้าถึง และตรวจสถานะการส่งอีเมลที่ระบบจัดเข้าคิวแล้ว การเรียก preview ไม่ส่งอีเมลและไม่เพิ่มผู้รับ ส่วนการตั้งค่ารอบและเปิด worker อยู่ใน [คู่มืออีเมลแจ้งเตือน](../../../guides/alert-email-operations.md)

## `POST /api/v1/alert-email-previews`

สร้าง subject, plain text และ HTML ของอีเมลหนึ่งประเภท เพื่อให้ผู้ดูแลตรวจข้อความก่อนใช้งาน

### การยืนยันตัวตนและสิทธิ์

- Authentication: Bearer access token
- Permission: `notifications:edit`
- Data scope: ทุก `eventIds` ต้องอยู่ใน data scope และ regional access ของผู้เรียก หากมีรายการที่ไม่พบหรืออยู่นอกขอบเขต จะไม่สร้าง preview ทั้งชุด

### ฟิลด์คำขอ

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `eventIds` | body | integer[] | Yes | ID เหตุการณ์ 1–100 รายการ เป็นจำนวนบวกและห้ามซ้ำ |
| `scheduledAt` | body | string | Yes | ISO 8601 timestamp ที่มี `Z` หรือ offset เช่น `2026-10-05T12:05:00+07:00`; เป็นรอบแจ้งเตือนที่ต้องการแสดง |

### ตัวอย่างคำขอ

```json
{
  "eventIds": [1001],
  "scheduledAt": "2026-10-05T12:05:00+07:00"
}
```

### ฟิลด์ผลตอบกลับ

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` |
| `data.scheduledAt` | string | No | รอบแจ้งเตือนที่ส่งใน request |
| `data.eventCount` | integer | No | จำนวนเหตุการณ์ใน preview |
| `data.subject` | string | No | หัวข้ออีเมล รวมประเภท จำนวนโรงงาน และรอบเวลาไทย |
| `data.text` | string | No | เนื้อหาอีเมล plain text |
| `data.html` | string | No | เอกสาร HTML สำหรับอีเมล มี styles อยู่ใน element และไม่มี script |

### ตัวอย่างผลตอบกลับ

```json
{
  "success": true,
  "data": {
    "scheduledAt": "2026-10-05T12:05:00+07:00",
    "eventCount": 1,
    "subject": "[D-POMS] ผลตรวจวัดเกินมาตรฐาน — 1 โรงงาน — 5 ต.ค. 2569 เวลา 12:05 น.",
    "text": "ผลตรวจวัดเกินมาตรฐาน\nพบเหตุการณ์ในโรงงาน 1 แห่ง\nรอบแจ้งเตือน: 5 ต.ค. 2569 เวลา 12:05 น. (เวลาไทย)\n...",
    "html": "<!DOCTYPE html><html lang=\"th\">...</html>"
  }
}
```

`text` และ `html` ในตัวอย่างย่อเฉพาะเพื่ออ่าน contract; response จริงคืนเนื้อหาเต็ม และข้อความวันที่อาจมี spacing ตาม formatter

### การตรวจสอบและกติกา

- ใช้ strict schema; field เช่น `to`, `cc` หรือเนื้อหาอีเมลที่ client กำหนดเองจะถูกปฏิเสธ
- Timestamp ต้องเป็นวันที่จริงและมี timezone; วันที่ที่ไม่มีอยู่ เช่น 30 กุมภาพันธ์ ไม่ผ่าน validation
- ทุกเหตุการณ์ต้องมี `alertType` เดียวกัน สำหรับ `CONSECUTIVE_NO_REPORT` ต้องมี `systemType` เดียวกันด้วย
- `scheduledAt` ต้องไม่น้อยกว่า `endedAt` ของทุกเหตุการณ์ เช่น ช่วงตรวจวัด 11:00–11:59:59 ต้องใช้รอบหลังช่วงนั้นสิ้นสุด
- `STANDARD_EXCEEDED` และ `EIA_EXCEEDED` ต้องมีช่วงตรวจวัดครบ ค่าและเกณฑ์เป็นตัวเลข และ `thresholdType` ตรงกับประเภทเหตุการณ์
- พารามิเตอร์แสดงพร้อมหน่วย เช่น `CO (ppm)` และ `CO (%)`; renderer escape ข้อความจากข้อมูลโรงงานและเหตุการณ์ก่อนใส่ HTML
- ลิงก์ในอีเมลไปที่ `https://d-poms.diw.go.th/` และผู้รับต้องเข้าสู่ระบบเพื่อเปิดข้อมูลตามสิทธิ์
- เหตุการณ์รายชั่วโมงต้องมี payload ต้นฉบับที่ตรวจสอบได้เพื่อยืนยันเวลาไทย หากข้อมูลเดิมสูญเสีย timezone และไม่มีหลักฐานต้นฉบับ จะตอบ `400 BAD_REQUEST`
- Preview ไม่สร้าง delivery, ไม่เรียก SMTP และไม่เปลี่ยน `notificationStatus`

### ข้อผิดพลาด

ใช้ [shared error envelope](../../shared/common-api/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | ID ผิดรูปแบบ/ซ้ำ จำนวนเกินขอบเขต timestamp ไม่ถูกต้อง หรือ field ที่ไม่รู้จัก | แก้ request ก่อนเรียกใหม่ |
| `400` | `BAD_REQUEST` | รวมหลายประเภท รอบก่อนสิ้นสุดช่วงตรวจวัด หรือหลักฐานไม่พอสร้างอีเมล | แยกประเภทและตรวจข้อมูลเหตุการณ์ |
| `401` | `UNAUTHORIZED` | ไม่มี access token ที่ใช้ได้ | เข้าสู่ระบบใหม่ |
| `403` | `FORBIDDEN` | ไม่มี `notifications:edit` | ให้ผู้มีสิทธิ์ดำเนินการ |
| `404` | `NOT_FOUND` | มีเหตุการณ์ที่ไม่พบหรืออยู่นอก scope | เลือกจากรายการเหตุการณ์ที่ผู้เรียกมีสิทธิ์ |

## `GET /api/v1/alert-email-deliveries/:id`

ดูเนื้อหาและผลการส่งของ delivery หนึ่งรายการ สถานะนี้เป็นผล SMTP และแยกจาก `notificationStatus` ที่เจ้าหน้าที่ใช้ติดตามเหตุการณ์

### การยืนยันตัวตนและสิทธิ์

- Authentication: Bearer access token
- Permission: `notifications:view_status`
- Data scope: ผู้เรียกต้องเข้าถึงทุกเหตุการณ์ในอีเมลชุดนั้น จึงจะเห็นผู้รับ เนื้อหา และผลการส่ง

### ฟิลด์คำขอ

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `id` | path | integer | Yes | delivery ID เป็นจำนวนบวก |

### ตัวอย่างคำขอ

```text
GET /api/v1/alert-email-deliveries/42
```

### ฟิลด์ผลตอบกลับ

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` |
| `data.id` / `data.batchId` | integer | No | delivery ID และ ID ชุดอีเมล |
| `data.cadence` | `HOURLY` \| `DAILY` | No | รอบรายชั่วโมงหรือรายวัน |
| `data.alertType` | string | No | ประเภทเหตุการณ์ในชุดอีเมล |
| `data.systemType` | string | Yes | ระบบตรวจวัดของชุดเมื่อแยกตามระบบ |
| `data.scheduledAt` | string | No | รอบแจ้งเตือน ISO timestamp |
| `data.periodStart` / `data.periodEnd` | string | No | ช่วงตรวจสอบ โดยปลายช่วงไม่รวมอยู่ในช่วง (`[start, end)`) |
| `data.recipient` | string | No | ผู้รับหลักของ delivery |
| `data.cc` | string[] | No | ผู้รับสำเนา รวม `diw.iemc@gmail.com` |
| `data.subject` / `data.text` / `data.html` | string | No | snapshot เนื้อหาที่จัดเข้าคิว |
| `data.eventIds` | integer[] | No | เหตุการณ์ที่รวมในอีเมล |
| `data.status` | string | No | สถานะในตารางด้านล่าง |
| `data.attempts` | integer | No | จำนวนครั้งที่ worker claim งาน รวมการตรวจผู้รับก่อนส่ง |
| `data.nextAttemptAt` | string | Yes | เวลาที่อนุญาตให้ลองใหม่ |
| `data.messageId` | string | Yes | message ID ที่ SMTP ตอบกลับเมื่อมี |
| `data.errorCode` | string | Yes | เหตุผลของสถานะที่ระบบบันทึก; ไม่ใช่ raw SMTP error |
| `data.acceptedRecipients` / `data.rejectedRecipients` | string[] | No | ผู้รับใน envelope ที่ SMTP ยอมรับ/ปฏิเสธ |
| `data.createdAt` / `data.updatedAt` | string | No | เวลา ISO ของรายการ |
| `data.completedAt` | string | Yes | เวลาสิ้นสุดการประมวลผลเมื่อมี |

| Status | Meaning |
| --- | --- |
| `QUEUED` | รอ worker และรอบเวลาที่กำหนด |
| `PROCESSING` | มี worker claim งานแล้ว |
| `SMTP_ACCEPTED` | SMTP ยอมรับผู้รับทั้งหมดใน envelope; ยังไม่ใช่หลักฐานว่าถึง inbox |
| `RETRY_PENDING` | ความล้มเหลวที่ปลอดภัยต่อการลองใหม่ อยู่ระหว่างรอ retry |
| `FAILED` | SMTP ปฏิเสธถาวร ลองครบจำนวน หรือยอมรับเพียงบางผู้รับ; ไม่ส่งซ้ำทั้งชุดอัตโนมัติ |
| `UNKNOWN` | ยืนยันผล SMTP ไม่ได้ เช่น timeout หรือ worker ขาดการติดต่อหลังเริ่มงาน; ไม่ retry อัตโนมัติ |
| `SKIPPED` | เงื่อนไขส่งไม่ผ่านแล้ว เช่น ผู้รับอยู่นอกขอบเขต หรือเหตุการณ์ถูก `DISMISSED` |

### ตัวอย่างผลตอบกลับ

```json
{
  "success": true,
  "data": {
    "id": 42,
    "batchId": 42,
    "cadence": "HOURLY",
    "alertType": "STANDARD_EXCEEDED",
    "systemType": "CEMS",
    "scheduledAt": "2026-10-05T05:05:00.000Z",
    "periodStart": "2026-10-05T04:00:00.000Z",
    "periodEnd": "2026-10-05T05:00:00.000Z",
    "recipient": "officer@example.org",
    "cc": ["diw.iemc@gmail.com"],
    "subject": "[D-POMS] ผลตรวจวัดเกินมาตรฐาน — 1 โรงงาน — 5 ต.ค. 2569 เวลา 12:05 น.",
    "text": "ผลตรวจวัดเกินมาตรฐาน\n...",
    "html": "<!DOCTYPE html><html lang=\"th\">...</html>",
    "eventIds": [1001],
    "status": "SMTP_ACCEPTED",
    "attempts": 1,
    "nextAttemptAt": null,
    "messageId": "<example@example.org>",
    "errorCode": null,
    "acceptedRecipients": ["officer@example.org", "diw.iemc@gmail.com"],
    "rejectedRecipients": [],
    "createdAt": "2026-10-05T05:05:00.000Z",
    "updatedAt": "2026-10-05T05:05:01.000Z",
    "completedAt": "2026-10-05T05:05:01.000Z"
  }
}
```

### การตรวจสอบและกติกา

- ไม่เปิดข้อมูล lease หรือ key ที่ worker ใช้กันซ้ำให้ client
- API นี้อ่านสถานะเท่านั้น ไม่มี endpoint ส่งซ้ำหรือเปิด worker
- เนื้อหาเป็น snapshot ณ เวลาจัดเข้าคิว การแก้ข้อมูลโรงงานภายหลังไม่เปลี่ยนอีเมลที่จัดคิวไว้แล้ว แต่ worker ตรวจขอบเขตผู้รับอีกครั้งก่อนส่ง

### ข้อผิดพลาด

ใช้ [shared error envelope](../../shared/common-api/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | `id` ไม่ใช่จำนวนเต็มบวก | ตรวจ delivery ID |
| `401` | `UNAUTHORIZED` | access token ใช้ไม่ได้ | เข้าสู่ระบบใหม่ |
| `403` | `FORBIDDEN` | ไม่มี `notifications:view_status` | ให้ผู้มีสิทธิ์ดำเนินการ |
| `404` | `NOT_FOUND` | ไม่พบ delivery หรือมีเหตุการณ์ในชุดที่อยู่นอก scope | ตรวจจากรายการที่มีสิทธิ์เข้าถึง |

## แหล่งอ้างอิงสำหรับผู้ดูแล Backend

- Preview route/validator/service: [`alert-email-preview.ts`](../../../../../backend/src/modules/alert-emails/alert-email-preview.ts)
- Delivery route/validator/service: [`alert-email-history.ts`](../../../../../backend/src/modules/alert-emails/alert-email-history.ts)
- Delivery persistence: [`alert-email-outbox.repository.ts`](../../../../../backend/src/modules/alert-emails/alert-email-outbox.repository.ts)
- Rendering: [`alert-email-template.ts`](../../../../../backend/src/modules/alert-emails/alert-email-template.ts)
- Dispatch: [`alert-email-dispatch.ts`](../../../../../backend/src/modules/alert-emails/alert-email-dispatch.ts)
- Scheduling/batching: [`alert-email-engine.ts`](../../../../../backend/src/modules/alert-emails/alert-email-engine.ts)
- Daily detector: [`alert-email-daily-detector.ts`](../../../../../backend/src/modules/alert-emails/alert-email-daily-detector.ts)
- Current points and recipients: [`alert-email-source.repository.ts`](../../../../../backend/src/modules/alert-emails/alert-email-source.repository.ts)
- Measurement loading and parameter activation: [`alert-email-measurements.ts`](../../../../../backend/src/modules/alert-emails/alert-email-measurements.ts)
- OpenAPI: [`poms.openapi.ts`](../../../../../backend/src/modules/api-docs/poms.openapi.ts)
- Tests: [`alert-email-preview.service.test.ts`](../../../../../backend/tests/unit/alert-email-preview.service.test.ts), [`alert-email-history.test.ts`](../../../../../backend/tests/unit/alert-email-history.test.ts), [`alert-email-template.test.ts`](../../../../../backend/tests/unit/alert-email-template.test.ts), [`alert-email-dispatch.test.ts`](../../../../../backend/tests/unit/alert-email-dispatch.test.ts), [`alert-email.openapi.test.ts`](../../../../../backend/tests/unit/alert-email.openapi.test.ts)
- Evidence: [TDD อีเมลแจ้งเตือน](../../../evidence/notifications/alert-email.tdd.md)
