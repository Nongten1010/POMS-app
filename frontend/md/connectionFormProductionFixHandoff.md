# Frontend Handoff: แก้หน้าขอเชื่อมต่อหลังทดสอบ Production จริง

อัปเดต: 2026-07-13

หน้า: หน้าขอเชื่อมต่อ CEMS/WPMS
ไฟล์หลักที่ต้องแก้: `frontend/src/pages/ConnectionRequestPage.jsx`

เอกสารที่เกี่ยวข้อง:

- [รายการช่องจาก frontend](./connectionFormFieldInventory.md)
- [API contract CEMS/WPMS](./CEMS_WPMS_REQUEST_APIS.md)
- [Backend frontend handoff](../../docs/APIDoc/CEMS_WPMS_REQUEST_FORM_FRONTEND_HANDOFF.md)

## สรุปผล Production

Backend/API production เก็บ payload ที่ส่งมาครบ แต่ frontend ยังไม่ครบ end-to-end ทุกช่อง

ทดสอบด้วยคำขอจริง:

| รายการ | ผล |
| --- | --- |
| Request No. | `CEMS-69-00004` |
| Request ID | `6` |
| Test marker | `TEST-PROD-CONTRACT-20260713122846` |
| ประเภทคำขอ | `ADD_MEASUREMENT_POINT` |
| สถานะ | `PENDING_DESIGN_REVIEW` / รอพิจารณาแบบ |
| Upload รูปจริง | HTTP `201` |
| Submit request | HTTP `201` |
| GET request | HTTP `200` |
| GET detail | HTTP `200` |
| Header fields ที่เทียบ | 31 ช่อง ตรงทั้งหมด |
| Measurement point fields ที่เทียบ | 7 ช่อง ตรงทั้งหมด |
| CEMS detail fields ที่เทียบ | 39 ช่อง ตรงทั้งหมด |
| Missing key / value mismatch | `0 / 0` |

Backend อาจเติม nullable/default fields ใน response เช่น:

```json
{
  "link": null,
  "fileName": null,
  "fileUrl": null,
  "fileType": null,
  "fileSize": null
}
```

และ criteria ที่ปิดจะกลับมาเป็น:

```json
{
  "enabled": false,
  "standardValue": null,
  "rows": []
}
```

นี่เป็น response normalization ไม่ใช่ข้อมูลหาย Frontend ต้องอ่าน shape นี้ได้

> คำขอ production ข้างต้นเป็นข้อมูลทดสอบจริงและยังค้างอยู่ เพราะปัจจุบันไม่มี public cancel endpoint สำหรับ operator

## รายการที่ Frontend ต้องแก้

| Priority | จุดแก้ | ปัญหาปัจจุบัน | ผลที่ต้องได้ |
| --- | --- | --- | --- |
| P0 | WPMS final payload | WPMS branch ไม่ใส่ `documentsAndImages` | เอกสารระบบบำบัด/ภาพเครื่องมือถูกส่งและอ่านกลับครบ |
| P0 | CEMS regulation tags | `TagInputField` ไม่มี name/state ที่เข้า payload | ส่ง `details.exemptedParameterRegulationClauses: string[]` |
| P0 | EIA edit prefill | `getInitialRequestFactory()` ไม่ map `eiaOther` | เปิดแก้ไข `eia = อื่นๆ` แล้วข้อความเดิมยังอยู่ |
| P0 | Contact serialization | กรองแต่ละ column แล้วจับคู่ด้วย index | ชื่อ/ตำแหน่ง/โทรศัพท์/อีเมลของแต่ละคนไม่สลับกัน |
| P0 | Array values ที่มี comma | `getFormValues()` split comma ทุกค่า | WPMS treatment label ที่มี comma อยู่ครบเป็นหนึ่งค่า |
| P1 | Parameter label | ใช้ `CS2 (mg/m3)` | ใช้ canonical `CS2 (mg/m³)` ทั้ง option/payload/response |
| P1 | Error binding | UI ยังควรผูก nested errors จาก `issues[]` | แสดง error ตรง field ด้วย `pathString` |
| P2 | Mobile/Station | มี UI แต่ input ไม่มี name/state/payload mapping | ซ่อนหรือ disable จนมี backend contract หรือทำให้ครบ end-to-end |

## P0.1 เพิ่มเอกสารใน WPMS Payload

ตัวแปร `documentsAndImages` ถูกสร้างแล้วใน `buildMeasurementPointRequestBody()` แต่ถูกใส่เฉพาะ CEMS branch

WPMS measurement point ต้องเป็นแบบนี้:

```js
{
  pointCode,
  pointName,
  pointType: 'WASTEWATER',
  details: {
    // WPMS details
  },
  documentsAndImages,
  measurementInstruments: {
    converterBrand: converterBrand || null,
    converterModel: converterModel || null,
    parameters: instrumentParameters,
  },
}
```

ห้ามใส่ `documentsAndImages` ไว้ใน `details` ต้องอยู่ระดับเดียวกับ `details` และ `measurementInstruments`

Acceptance:

- เลือกเอกสาร `ระบบบำบัด` 2 ไฟล์ แล้ว Network payload มี 2 document rows
- เลือก `ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (WPMS)` แล้ว payload มี row นั้น
- เปิดคำขอจาก response แล้ว preview/download เอกสารได้

## P0.2 Bind Regulation Clause Tags

ปัจจุบันมี UI:

```jsx
<TagInputField label="พารามิเตอร์ที่ได้รับการยกเว้นตามประกาศฯ ข้อ" />
```

แต่ไม่มี `name`, controlled state หรือ field ใน payload

ควรเก็บเป็น array โดยตรง:

```js
const [exemptedParameterRegulationClauses, setExemptedParameterRegulationClauses] = useState(
  normalizeStringArray(initialDetails.exemptedParameterRegulationClauses),
)
```

```jsx
<TagInputField
  label="พารามิเตอร์ที่ได้รับการยกเว้นตามประกาศฯ ข้อ"
  value={exemptedParameterRegulationClauses}
  onChange={setExemptedParameterRegulationClauses}
/>
```

และ payload ต้องมี:

```js
details: {
  exemptedParameterRegulationClauses,
}
```

แนะนำให้ส่ง state array เข้า `buildMeasurementPointRequestBody()` โดยตรง ไม่ควร serialize เป็น comma-separated string เพราะข้อความ tag อาจมี comma ได้

Acceptance:

- เพิ่ม tag 2 ค่าแล้ว payload เป็น string array 2 ค่า
- GET detail และเปิด edit แล้วยังเห็น tag เดิมครบและลำดับเดิม
- Backend error path `measurementPoints.0.details.exemptedParameterRegulationClauses` แสดงใต้ช่องนี้

## P0.3 Map `eiaOther` กลับเข้า Edit Form

เพิ่ม `eiaOther` ใน `getInitialRequestFactory()`:

```js
return {
  ...fallbackFactory,
  ...factory,
  // existing fields
  eia: safeRequest.eia ?? factory.eia ?? fallbackFactory.eia ?? '',
  eiaOther: safeRequest.eiaOther ?? factory.eiaOther ?? fallbackFactory.eiaOther ?? '',
  hasEia: safeRequest.hasEia ?? factory.hasEia ?? fallbackFactory.hasEia,
}
```

กติกา payload:

```js
{
  eia: 'มี' | 'ไม่มี' | 'มี IEE' | 'มี EIA' | 'มี EHIA' | 'อื่นๆ' | null,
  eiaOther: string | null,
  hasEia: boolean | null,
}
```

- `eia = อื่นๆ` ต้องมี `eiaOther` และ `hasEia = false`
- `eia = ไม่มี` ต้องมี `hasEia = false`
- `มี`, `มี IEE`, `มี EIA`, `มี EHIA` ต้องมี `hasEia = true`

Acceptance:

- สร้างคำขอด้วย `อื่นๆ` และข้อความทดสอบ
- เปิด edit แล้ว dropdown และข้อความ `ระบุ` ต้องตรงกับ response
- resubmit โดยไม่แก้ EIA แล้วค่าต้องไม่หาย

## P0.4 สร้าง Contact Object ก่อนกรอง

ปัจจุบันเรียก `getFormValues()` แยก name/position/phone/email แล้วจับคู่ด้วย index หากช่อง optional ว่างและถูก filter ออก ค่าอาจเลื่อนไปอยู่ผิดคน

ให้สร้าง object ตาม row index ก่อน แล้วค่อย validate/filter ทั้ง object:

```js
const names = formData.getAll('contactName')
const positions = formData.getAll('contactPosition')
const phones = formData.getAll('contactPhone')
const emails = formData.getAll('contactEmail')
const rowCount = Math.max(names.length, positions.length, phones.length, emails.length)

const contactPersons = Array.from({ length: rowCount }, (_, index) => ({
  name: String(names[index] ?? '').trim(),
  position: String(positions[index] ?? '').trim() || null,
  phone: String(phones[index] ?? '').trim(),
  email: String(emails[index] ?? '').trim() || null,
})).filter((contact) => contact.name || contact.position || contact.phone || contact.email)
```

จากนั้น validate แต่ละ row ว่ามี `name` และ `phone` ก่อน submit

Acceptance:

- คนที่ 1 มี position ว่าง คนที่ 2 มี position แล้วค่าห้ามเลื่อนข้ามคน
- คนที่ 1 ไม่มี email คนที่ 2 มี email แล้ว response ต้องจับคู่ถูกคน
- เพิ่ม/ลบ contact row แล้ว payload มีจำนวนและลำดับตรง UI

## P0.5 ห้าม Split Array ทุกค่าด้วย Comma

`getFormValues()` ปัจจุบันใช้:

```js
.flatMap((value) => String(value).split(','))
```

แต่ WPMS มี label จริงที่มี comma เช่น:

```text
การลอยตัวด้วยฟองอากาศ (Dissolved Air Flotation, DAF)
```

ค่าดังกล่าวต้องอยู่เป็นหนึ่ง array item

แนวทางที่แนะนำ:

- เก็บค่าจาก MUI multiple select เป็น state array
- ส่ง array เข้า request builder โดยตรง
- ห้ามใช้ comma-separated hidden value เป็น source of truth
- หากจำเป็นต้องใช้ hidden input ให้ serialize เป็น JSON แล้ว `JSON.parse()` แบบมี validation

Acceptance:

- เลือก `Dissolved Air Flotation, DAF` แล้ว payload มีหนึ่งค่า ไม่ใช่สองค่า
- GET detail และ edit แล้วยังเลือก option เดิมเพียงหนึ่งรายการ
- ใช้กติกาเดียวกันกับ treatment/tag fields อื่นที่ label อาจมี comma

## P1. Canonical Parameter Label

แก้ `frontend/src/option/cemsParameterOptions.json`:

```json
{ "name": "CS2", "unit": "mg/m³", "label": "CS2 (mg/m³)" }
```

ห้ามส่ง `CS2 (mg/m3)` เพราะ backend ใช้ label พร้อมหน่วยเป็น machine-stable value สำหรับเทียบ requested/pending/instrument rows

Acceptance:

- pending, requested และ instrument parameter ใช้ `CS2 (mg/m³)` เหมือนกันทุกตำแหน่ง
- เปิดข้อมูลเดิมที่เป็น `mg/m3` ควรมี compatibility mapping ก่อนแสดง หากมีข้อมูล legacy

## P1. Validation Error Binding

Validation error shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {},
    "issues": [
      {
        "code": "custom",
        "path": ["measurementPoints", 0, "details", "requestedParameters"],
        "pathString": "measurementPoints.0.details.requestedParameters",
        "message": "..."
      }
    ]
  }
}
```

Frontend ควร index error ด้วย `pathString` และผูกกับ field ที่ตรงกัน โดยยังอ่าน `error.details` เป็น fallback สำหรับ compatibility

Paths สำคัญ:

```text
eiaOther
hasEia
measurementPoints.0.details.legalAnnexNo
measurementPoints.0.details.exemptedParameterRegulationClauses
measurementPoints.0.details.pendingParameters
measurementPoints.0.details.requestedParameters
measurementPoints.0.details.primaryFuelOther
measurementPoints.0.details.secondaryFuelOther
measurementPoints.0.details.treatmentSystemOther
measurementPoints.0.documentsAndImages
measurementPoints.0.measurementInstruments.parameters
```

## P2. Mobile และ Station

`MobileMonitoringPointDetails()` และ `StationMonitoringPointDetails()` ปัจจุบันมี input ที่ไม่มี `name`, state หรือ request mapping จึงไม่ได้ submit จริง

รอบ CEMS/WPMS นี้ควรเลือกอย่างใดอย่างหนึ่ง:

1. ซ่อน/disable Mobile และ Station พร้อมข้อความ `ยังไม่เปิดใช้งาน`; หรือ
2. กำหนด backend contract, validation, payload, response mapping และ tests ให้ครบก่อนเปิดให้เลือก

ห้ามปล่อยให้กรอกได้แต่ข้อมูลหายหลัง submit

## Production Upload URL: ไม่ใช่ Frontend Bug หลัก

Production upload ตอบ `fileUrl` เป็น `http://d-poms.diw.go.th/...` ขณะที่หน้าเว็บใช้งานผ่าน HTTPS

- ไฟล์จริงเปิดผ่าน HTTPS ได้ HTTP `200`
- Backend production ควรตั้ง `PUBLIC_BASE_URL=https://d-poms.diw.go.th`
- Frontend ไม่ควร hardcode host ใหม่
- หากต้องมี temporary guard ให้เปลี่ยนเฉพาะ same-host `http://d-poms.diw.go.th/` เป็น current HTTPS origin ก่อน preview/download และถอด guard ออกหลัง config ถูกแก้

## Target Payload ย่อ

```json
{
  "eia": "อื่นๆ",
  "eiaOther": "รายละเอียด",
  "hasEia": false,
  "contactPersons": [
    {
      "name": "ผู้ติดต่อ 1",
      "position": null,
      "phone": "0800000001",
      "email": null
    },
    {
      "name": "ผู้ติดต่อ 2",
      "position": "วิศวกร",
      "phone": "0800000002",
      "email": "contact@example.com"
    }
  ],
  "measurementPoints": [
    {
      "pointType": "STACK",
      "details": {
        "pendingParameters": ["CO (ppm)"],
        "requestedParameters": ["CO (ppm)"],
        "exemptedParameterRegulationClauses": ["ข้อ 1", "ข้อ 2"],
        "treatmentSystem": ["ค่าที่มี comma ต้องยังเป็นหนึ่งค่า"]
      },
      "documentsAndImages": [],
      "measurementInstruments": {
        "converterBrand": null,
        "converterModel": null,
        "parameters": []
      }
    }
  ]
}
```

หมายเหตุ: ค่า `pointType` ต้องเป็น `STACK` สำหรับ CEMS หรือ `WASTEWATER` สำหรับ WPMS

## Definition of Done

- [ ] Network payload จากหน้า CEMS มี regulation clauses, contacts, documents และ instruments ครบ
- [ ] Network payload จากหน้า WPMS มี `documentsAndImages` ครบ
- [ ] Treatment label ที่มี comma round-trip เป็นหนึ่งค่า
- [ ] EIA `อื่นๆ` เปิด edit/resubmit แล้ว `eiaOther` ไม่หาย
- [ ] Contact optional fields ว่างได้โดยไม่เลื่อนไปผิดคน
- [ ] `CS2 (mg/m³)` ตรงกันใน pending/requested/instrument rows
- [ ] Error จาก `issues[].pathString` แสดงตรง nested field
- [ ] Upload preview/download ไม่ใช้ mixed-content URL
- [ ] Mobile/Station ถูกซ่อน/disable หรือรองรับ payload/response ครบ
- [ ] Unit/component tests ครอบคลุม request builder และ response-to-form mapper
- [ ] E2E test ดัก request body ของ CEMS และ WPMS แล้ว assert fields ตาม checklist
- [ ] ทดสอบใน non-production ก่อน และไม่สร้าง production request เพิ่มจนกว่าจะมีวิธี cleanup test data
