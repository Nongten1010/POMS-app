# Frontend handoff: ตั้งสถานะหลายช่วง

[กลับไปหน้า handoff](./README.md) · [Canonical API contract](../../../api/menus/connection-requests/device-configs.md#status-management-fields)

## เป้าหมาย

Frontend ต้องเพิ่ม แสดง ลบ บันทึก และโหลด `statusManagement.schedules[]` ได้หลายรายการ โดย payload ใหม่ใช้ `schedules` เป็น source of truth และไม่พึ่ง legacy top-level fields

## ช่องว่างที่ตรวจพบใน frontend ปัจจุบัน

| จุด | พฤติกรรมปัจจุบัน | ผลกระทบ | งานที่ต้องแก้ |
| --- | --- | --- | --- |
| `connectionParameterStatusOptions` | มี `No Discharge` | backend รับเป็น status enum เดียวกับ channel และ schedule | คง mapping ค่าเดิมให้ตรงกับ API |
| `datetime-local` | เก็บ/ส่งค่า `YYYY-MM-DDTHH:mm` ตรง ๆ | รูปแบบไม่ตรง API ซึ่งใช้ช่องว่างและมีวินาที | แปลงเป็น `YYYY-MM-DD HH:mm:ss` ก่อนสร้าง payload |
| `addSchedule` | ตรวจเพียงว่ามี start/end/status | เวลาเรียงผิด, overlap และรายการที่ 101 ไปพบ error หลัง submit | validate ก่อนเพิ่มและไม่ยิง API เมื่อผิด |
| schedule object | ใส่ `id: Date.now()` และส่ง `schedules` ต่อโดยไม่ map | ส่ง UI-only field ออกนอก frontend | ใช้ `id` เป็น React key ได้ แต่ strip ก่อนเรียก API |
| `buildDeviceConfigStatusManagement` | ส่ง legacy top-level fields พร้อม schedules | payload มีสองแหล่งข้อมูล | เมื่อมี UI รุ่นใหม่ให้ส่ง `{ schedules }` เป็นหลัก |
| ค่า prefill | API คืน `YYYY-MM-DD HH:mm:ss` ซึ่งใส่ตรงลง `datetime-local` ไม่ได้ | input แสดงไม่ถูกต้องหรือว่าง | แปลงเป็น `YYYY-MM-DDTHH:mm` ก่อน set state |

Backend ใช้ `.passthrough()` กับ schedule object ในปัจจุบัน จึงอาจรับ `id` ได้ แต่ `id` ไม่ใช่ contract และห้ามพึ่งพาพฤติกรรมนี้

## Contract ที่ต้องส่ง

หนึ่ง `statusManagement` มี schedules ได้สูงสุด 100 รายการ แต่ละรายการต้องมี:

| Field | กติกา |
| --- | --- |
| `selectedParameters` | array 1-200 ค่า ใช้ค่าจาก `parameterOptions` หรือ `ทั้งหมด` |
| `startAt` | local datetime รูปแบบ `YYYY-MM-DD HH:mm:ss` โดยไม่มี timezone |
| `endAt` | local datetime รูปแบบ `YYYY-MM-DD HH:mm:ss` โดยไม่มี timezone และต้องมากกว่า `startAt` |
| `status` | หนึ่งใน enum ที่กำหนดเท่านั้น |

สถานะที่ backend รับ:

```js
const deviceConnectionParameterStatuses = [
  'Normal',
  'Calibration',
  'Defective',
  'Maintenance',
  'Start up',
  'Shut Down',
  'No Discharge',
  'Turnaround',
  'Etc.',
]
```

หน้าตั้งสถานะชั่วคราวจะซ่อน `Normal` จาก dropdown ตาม UX ได้ แต่ API รองรับทั้ง `Normal` และ `No Discharge`

## ตัวอย่าง payload

```json
{
  "statusManagement": {
    "schedules": [
      {
        "selectedParameters": ["CO (ppm)", "NOx (ppm)"],
        "startAt": "2026-08-05 08:00:00",
        "endAt": "2026-08-05 10:00:00",
        "status": "Maintenance"
      },
      {
        "selectedParameters": ["CO (ppm)"],
        "startAt": "2026-08-05 13:00:00",
        "endAt": "2026-08-05 15:00:00",
        "status": "Calibration"
      }
    ]
  }
}
```

เมื่อล้างทั้งหมด:

```json
{
  "statusManagement": {
    "schedules": []
  }
}
```

อย่าส่ง `selectedParameters`, `startAt`, `endAt`, `status` ที่ top level เพื่อแทนรายการแรก Backend ยังรองรับ fields เหล่านั้นสำหรับ client legacy เท่านั้น และเมื่อ `schedules` มีรายการ backend จะใช้ schedules เป็นหลัก

## การแปลงเวลา

เก็บค่าจาก `<input type="datetime-local">` ใน state ได้ แต่ต้องเปลี่ยนตัวคั่น `T` เป็นช่องว่างและเติมวินาทีก่อนสร้าง payload ห้ามเติม `Z`, `+07:00` หรือ timezone อื่น:

```js
function toApiLocalDateTime(value) {
  if (!value) return null

  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return null

  return `${match[1]} ${match[2]}:${match[3] ?? '00'}`
}

function toDateTimeLocal(value) {
  if (!value) return ''

  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):\d{2}$/.exec(value)
  return match ? `${match[1]}T${match[2]}` : ''
}
```

เมื่อโหลดค่าจาก API ให้ใช้ `toDateTimeLocal` แปลง `YYYY-MM-DD HH:mm:ss` เป็น `YYYY-MM-DDTHH:mm` สำหรับ input โดยตรง ไม่ต้องคำนวณ timezone หรือสร้าง `Date` object

## กฎเวลาและพารามิเตอร์

- ใช้ช่วงแบบ `[startAt, endAt)` ดังนั้นช่วงถัดไปเริ่มตรง `endAt` เดิมได้
- block เมื่อ `endAt <= startAt`
- block เมื่อช่วงเวลาทับกันและมีพารามิเตอร์ร่วมอย่างน้อยหนึ่งค่า
- `ทั้งหมด` ครอบคลุมทุกพารามิเตอร์และถือว่าทับกับ schedule อื่นทุก parameter
- ถ้า UI ไม่ได้เลือกพารามิเตอร์ ให้ normalize เป็น `['ทั้งหมด']` ก่อน validate
- block รายการที่ 101
- parameter ต้องมาจาก `parameterOptions`; channel label ที่มีหน่วยใช้ได้เมื่อสอดคล้องกับ parameter ของจุด
- normalize ค่าเป็นรูปแบบเดียวกันก่อนตรวจ overlap; เมื่อเป็น `YYYY-MM-DD HH:mm:ss` ครบทุกค่าแล้วสามารถเปรียบเทียบตามลำดับ string ได้

## รูป payload builder ที่แนะนำ

```js
function buildStatusManagementPayload(statusManagement) {
  const schedules = (statusManagement?.schedules ?? []).map((schedule) => ({
    selectedParameters: schedule.selectedParameters?.length
      ? schedule.selectedParameters
      : ['ทั้งหมด'],
    startAt: toApiLocalDateTime(schedule.startAt),
    endAt: toApiLocalDateTime(schedule.endAt),
    status: schedule.status,
  }))

  return { schedules }
}
```

ตัวอย่างนี้จงใจไม่ spread schedule เพื่อไม่ส่ง `id` หรือ UI-only fields อื่น

## Definition of done

- payload ทุก schedule ใช้ `YYYY-MM-DD HH:mm:ss` และไม่มี timezone
- รองรับ `No Discharge` และไม่มี UI-only `id`
- เพิ่ม/ลบ/ล้างแล้ว GET หลังบันทึกให้ข้อมูลตรงกับ UI
- adjacent schedules บันทึกได้ แต่ overlapping schedules ถูก block
- ทำงานเหมือนกันทั้ง request endpoint และ connected-measurement-point endpoint
