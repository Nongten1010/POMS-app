# อีเมลแจ้งเตือนมลพิษ

[กลับไปหน้าเมนู](./README.md)

API นี้ใช้ดูตัวอย่างอีเมลจากเหตุการณ์ที่มีสิทธิ์เข้าถึง และตรวจสถานะการส่งอีเมลที่ระบบจัดเข้าคิวแล้ว การเรียก preview ไม่ส่งอีเมลและไม่เพิ่มผู้รับ ส่วนการตั้งค่ารอบและเปิด worker อยู่ใน [คู่มืออีเมลแจ้งเตือน](../../../guides/alert-email-operations.md)

## รูปแบบข้อความตาม PDF

อีเมลทั้ง 6 แบบใช้ข้อความจากคอลัมน์ `เตือนผ่าน e-mail` ของเอกสาร “ข้อความแจ้งเตือน D-POMS.pdf” เป็นจดหมาย เริ่ม `เรียน เจ้าหน้าที่ที่เกี่ยวข้อง` ตามด้วย `เรื่อง` และรายละเอียดเรียงบริษัท `1)` / `2)` → จุด `1.1` / `1.2` → พารามิเตอร์ โดยระบุ `(CEMS)` หรือ `(WPMS)` ตามระบบของจุด

| กรณี | เรื่องก่อนต่อท้ายวันที่และจำนวนบริษัท |
| --- | --- |
| 1 `STANDARD_EXCEEDED` | D-POMS แจ้งเตือนผลตรวจวัดมลพิษเกินค่ามาตรฐานกระทรวงอุตสาหกรรม |
| 2 `EIA_EXCEEDED` | D-POMS แจ้งเตือนผลตรวจวัดมลพิษเกินค่าควบคุม EIA/ IEE /EHIA |
| 3 `DAILY_COMPLETENESS_LOW` | D-POMS แจ้งเตือนการรายงานผลตรวจวัดมลพิษเข้าสู่ระบบไม่ถึงร้อยละ 80 ต่อวัน |
| 4 `CONSECUTIVE_NO_REPORT` / `CEMS` | D-POMS แจ้งเตือนการไม่รายงานผลตรวจวัดมลพิษจากระบบ CEMS หรือรายงานไม่ถึงร้อยละ 80 ต่อวัน ติดต่อกันตั้งแต่ 15 วันขึ้นไป |
| 5 `CONSECUTIVE_NO_REPORT` / `WPMS` | D-POMS แจ้งเตือนการไม่รายงานผลตรวจวัด BOD/COD Online หรือรายงานไม่ถึงร้อยละ 80 ต่อวัน ติดต่อกันเกิน 7 วัน |
| 6 `ABNORMAL_VALUE` | D-POMS แจ้งเตือนการรายงานผลการตรวจวัดมีค่าผิดปกติ (ศูนย์/ติดลบ/ค่านิ่ง) |

เรื่องรายชั่วโมงต่อท้าย `ในวันที่ d-m-พ.ศ. เวลา HH.mm น. จำนวน N บริษัท` โดยใช้ `eventDate` และ `startedAt` เวลาไทย รายวันต่อท้าย `ในวันที่ d-m-พ.ศ. จำนวน N บริษัท` โดยใช้ `eventDate` ของข้อมูลที่ตรวจ ไม่ใช้วันที่หรือเวลาใน `scheduledAt` แทน เช่น ข้อมูลวันที่ 4 ตุลาคมส่งวันที่ 5 ตุลาคม 09:00 น. เรื่องยังแสดง `ในวันที่ 4-10-2569` จำนวนบริษัทนับจากบริษัทในอีเมลชุดนั้น

รายละเอียดบริษัทใช้ชื่อ ทะเบียน และจังหวัด จังหวัดอ่านจากข้อมูลโรงงานที่เข้าข่ายซึ่งผูกกับจุด current/live POMS ที่ตรงโรงงาน ระบบ และสถานี หากข้อมูลขาดแสดง `ไม่ระบุ` ไม่เดาจังหวัดจากที่อยู่หรือ payload สำหรับกรณี 4–5 ใช้วันเริ่มลำดับรายงานไม่ครบที่ระบบบันทึกจริงพร้อมจำนวนวัน ไม่หักจำนวนวันจากวันสิ้นสุดเพื่อเดาวันเริ่ม เพราะนโยบาย `PAUSE` อาจเว้นวันยกเว้น รายละเอียดใช้ `ไม่รายงานหรือรายงานไม่ถึงร้อยละ 80 ต่อวันตั้งแต่วันที่` ตามเงื่อนไขที่ผู้ใช้ยืนยัน

ข้อ 6 แสดงเวลาเริ่มจาก `firstAbnormalAt` และระยะเวลารวมถึง `endedAt` ซึ่งเป็นเวลาของค่าผิดปกติล่าสุดที่ตรวจพบ ไม่ใช้ `confirmedAbnormalAt` เป็นเวลาสิ้นสุด เพราะเป็นเพียงเวลาที่จำนวนค่าต่อเนื่องครบเกณฑ์ยืนยัน เช่น ยืนยันเมื่อครบ 5 ค่าแล้วแต่ยังผิดปกติต่อ ระยะเวลาต้องรวมค่าที่ตรวจพบต่อมาด้วย หากไม่ได้บันทึก `endedAt` ให้แสดงระยะเวลาไม่ระบุแทนการเดาหรือใช้เวลายืนยันแทน แต่หากระบุ timestamp ที่ผิดรูปแบบหรือเวลาสิ้นสุดก่อนเวลาเริ่ม/เวลายืนยัน จะไม่สร้าง preview และตอบ `400 BAD_REQUEST`

จัดรูปแบบอีเมลเป็นการ์ดสีขาวบนพื้นเทาอ่อน ใช้หัวเรื่องสีน้ำเงินเข้มและข้อความสีเข้ม แยกการ์ดบริษัทกับแถวค่าตรวจวัดด้วยระยะห่างและน้ำหนักตัวอักษร และพื้นสีอ่อนเน้นข้อความดำเนินการเดิม ไม่บังคับให้ข้อมูลเป็นตัวอักษรสีแดงตามตัวอย่าง PDF ตามที่ผู้ใช้ยืนยัน ปรับเฉพาะการนำเสนอโดยไม่เพิ่มหรือเปลี่ยนข้อความ ข้อมูล ปุ่ม CTA ลิงก์เพิ่มเติม หรือรายละเอียดเกณฑ์จากแม่แบบ พารามิเตอร์ยังแสดงหน่วยจริงที่มากับเหตุการณ์ ไม่เปลี่ยนหน่วยตามค่าตัวอย่าง PDF กรณี 4 มีข้อความกำชับตรวจด้วยห้องปฏิบัติการที่ขึ้นทะเบียนและรายงานอย่างน้อยเดือนละ 1 ครั้ง `(รายงาน กวภ.02)` ตามต้นฉบับ ทุกแบบลงท้ายข้อความดำเนินการ `ขอแสดงความนับถือ` และชื่อหน่วยงาน/ข้อมูลติดต่อกรมโรงงานอุตสาหกรรมตาม PDF

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
| `scheduledAt` | body | string | Yes | ISO 8601 timestamp ที่มี `Z` หรือ offset เช่น `2026-10-05T12:05:00+07:00`; เป็นรอบส่งที่ขอ preview; เรื่องใช้ `eventDate` และเวลาเริ่มตรวจวัด `startedAt` ไม่ใช้รอบนี้แทน |

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
| `data.subject` | string | No | เรื่องตามแม่แบบ PDF รวมวันที่ตรวจวัด เวลาเริ่มตรวจวัดเมื่อเป็นรายชั่วโมง และจำนวนบริษัท |
| `data.text` | string | No | จดหมาย plain text ตามแม่แบบ PDF |
| `data.html` | string | No | อีเมล HTML แบบการ์ดสีขาวบนพื้นเทาอ่อน ข้อความสีน้ำเงินเข้ม/เทา จัดฟอนต์และระยะห่างเพื่ออ่านง่าย มี inline styles และไม่มี script ข้อความเพิ่มเติม หรือ CTA |

### ตัวอย่างผลตอบกลับ

```json
{
  "success": true,
  "data": {
    "scheduledAt": "2026-10-05T12:05:00+07:00",
    "eventCount": 1,
    "subject": "D-POMS แจ้งเตือนผลตรวจวัดมลพิษเกินค่ามาตรฐานกระทรวงอุตสาหกรรม ในวันที่ 5-10-2569 เวลา 11.00 น. จำนวน 1 บริษัท",
    "text": "เรียน เจ้าหน้าที่ที่เกี่ยวข้อง\nเรื่อง D-POMS แจ้งเตือนผลตรวจวัดมลพิษเกินค่ามาตรฐานกระทรวงอุตสาหกรรม ในวันที่ 5-10-2569 เวลา 11.00 น. จำนวน 1 บริษัท\n\n1) บริษัท ตัวอย่าง จำกัด (01000000000001) จังหวัด ระยอง\n    1.1 Stack 1 (CEMS)\n        - SO2 = 250 ppm\n\n** โปรดดำเนินการตรวจสอบ และแก้ไขโดยเร็ว **\nขอแสดงความนับถือ\n--------------------------------------------------\nศูนย์เฝ้าระวังสิ่งแวดล้อมอุตสาหกรรม\nกองวิจัยและเตือนภัยมลพิษโรงงาน กรมโรงงานอุตสาหกรรม\nโทร. 02-430-6312 ต่อ 2109\nไปรษณีย์อิเล็กทรอนิกส์ : poms.support@diw.mail.go.th\nLine ID : @iemcdiw",
    "html": "<!DOCTYPE html><html lang=\"th\">...</html>"
  }
}
```

`html` ในตัวอย่างย่อเฉพาะเพื่ออ่าน contract; response จริงคืนจดหมายเต็ม ตัวอย่างนี้ตรวจช่วงเริ่ม 11:00 น. และขอ preview รอบ 12:05 น. เรื่องจึงแสดง `11.00` ตามเวลาเริ่มตรวจวัด

### การตรวจสอบและกติกา

- ใช้ strict schema; field เช่น `to`, `cc` หรือเนื้อหาอีเมลที่ client กำหนดเองจะถูกปฏิเสธ
- Timestamp ต้องเป็นวันที่จริงและมี timezone; วันที่ที่ไม่มีอยู่ เช่น 30 กุมภาพันธ์ ไม่ผ่าน validation
- ทุกเหตุการณ์ต้องมี `alertType` และ `eventDate` เดียวกัน รายชั่วโมงต้องมี `startedAt` ที่ตรงเวลาเดียวกัน แม้เขียน timestamp ด้วย offset ต่างกันได้ สำหรับ `CONSECUTIVE_NO_REPORT` ต้องมี `systemType` เดียวกันด้วย
- `scheduledAt` ต้องไม่น้อยกว่า `endedAt` ของทุกเหตุการณ์ เช่น ช่วงตรวจวัด 11:00–11:59:59 ต้องใช้รอบหลังช่วงนั้นสิ้นสุด
- `STANDARD_EXCEEDED` และ `EIA_EXCEEDED` ต้องมีช่วงตรวจวัดครบ ค่าและเกณฑ์เป็น finite number, `measuredValue > thresholdValue` และ `thresholdType` ตรงกับประเภทเหตุการณ์ ข้อมูลเดิมที่ต่ำกว่าหรือเท่ากับเกณฑ์ไม่สามารถสร้าง preview ได้
- พารามิเตอร์แสดงพร้อมหน่วย เช่น `CO (ppm)` และ `CO (%)`; renderer escape ข้อความจากข้อมูลโรงงานและเหตุการณ์ก่อนใส่ HTML
- เหตุการณ์รายชั่วโมงต้องมี payload ต้นฉบับที่ตรวจสอบได้เพื่อยืนยันเวลาไทย หากข้อมูลเดิมสูญเสีย timezone และไม่มีหลักฐานต้นฉบับ จะตอบ `400 BAD_REQUEST`
- Preview ไม่สร้าง delivery, ไม่เรียก SMTP และไม่เปลี่ยน `notificationStatus`

### ข้อผิดพลาด

ใช้ [shared error envelope](../../shared/common-api/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | ID ผิดรูปแบบ/ซ้ำ จำนวนเกินขอบเขต timestamp ไม่ถูกต้อง หรือ field ที่ไม่รู้จัก | แก้ request ก่อนเรียกใหม่ |
| `400` | `BAD_REQUEST` | รวมหลายประเภท/วันที่ตรวจวัด/เวลาเริ่มตรวจวัดรายชั่วโมง รอบก่อนสิ้นสุดช่วงตรวจวัด ช่วงเวลาค่าผิดปกติไม่ถูกต้อง หลักฐานไม่พอ หรือค่ารายชั่วโมงไม่เกินเกณฑ์จริง | แยกประเภท วันที่ และช่วงตรวจวัด แล้วตรวจข้อมูลเหตุการณ์ |
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
| `SKIPPED` | เงื่อนไขส่งไม่ผ่านแล้ว เช่น ผู้รับอยู่นอกขอบเขต เหตุการณ์ถูก `DISMISSED` พารามิเตอร์/หน่วยไม่มี activation ที่ตรงช่วง หรือข้อมูลรายชั่วโมงเดิมไม่เกินเกณฑ์จริง; หากหนึ่งเหตุการณ์ไม่ผ่านจะข้าม delivery ทั้งชุด |

`errorCode=RECIPIENT_SCOPE_CHANGED` สำหรับ `SKIPPED` เป็น code รวมของ event eligibility ที่ไม่ผ่านก่อนส่ง รวมเหตุการณ์รายชั่วโมงที่ค่าไม่เกินเกณฑ์หรือ cadence/type ไม่ตรง ไม่ได้ระบุว่ามีการแก้อีเมลผู้รับเสมอไป ประวัติ activation แยกจากเวลาแก้ config; รายละเอียดการนับและ migration อยู่ใน [คู่มือปฏิบัติการ](../../../guides/alert-email-operations.md) และลองอีเมลครบหกแบบได้ด้วย [ชุดทดสอบในเครื่อง](../../../guides/alert-email-test.md)

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
    "subject": "D-POMS แจ้งเตือนผลตรวจวัดมลพิษเกินค่ามาตรฐานกระทรวงอุตสาหกรรม ในวันที่ 5-10-2569 เวลา 11.00 น. จำนวน 1 บริษัท",
    "text": "เรียน เจ้าหน้าที่ที่เกี่ยวข้อง\nเรื่อง D-POMS แจ้งเตือนผลตรวจวัดมลพิษเกินค่ามาตรฐานกระทรวงอุตสาหกรรม ในวันที่ 5-10-2569 เวลา 11.00 น. จำนวน 1 บริษัท\n...",
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
- เนื้อหาเป็น snapshot ณ เวลาจัดเข้าคิว การแก้ข้อมูลโรงงานหรือเปลี่ยนแม่แบบ PDF ภายหลังไม่สร้างข้อความใหม่และไม่ส่งซ้ำอัตโนมัติสำหรับ batch เดิม แม่แบบที่ปรับใช้กับ preview และ batch ใหม่เท่านั้น ส่วน worker ตรวจขอบเขตผู้รับและเงื่อนไขส่งอีกครั้งก่อนส่ง

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
