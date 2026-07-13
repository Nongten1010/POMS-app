# Frontend handoff: แบบฟอร์มเพิ่มจุดตรวจวัด CEMS/WPMS

Backend contract update: 2026-07-13

เอกสารหลักของ API คือ [CEMS_WPMS_REQUEST_APIS.md](./CEMS_WPMS_REQUEST_APIS.md). ไฟล์นี้สรุปเฉพาะสิ่งที่ frontend ต้องทำต่อจาก backend change รอบนี้.

## Endpoint

```text
POST /api/v1/cems-wpms-requests/document-images
POST /api/v1/cems-wpms-requests/measurement-points
POST /api/v1/cems-wpms-requests/parameters
```

## Contract เกณฑ์ 80% สำหรับ CEMS/WPMS

```json
{
  "enabled": true,
  "standardValue": "100",
  "rows": [
    { "level": "normal", "min": 0, "max": 80 },
    { "level": "warning", "min": 80, "max": 100 },
    { "level": "critical", "min": 100, "max": null }
  ]
}
```

- ความหมายคือ `0 < ปกติ ≤ 80`, `80 < เฝ้าระวัง ≤ 100`, `100 < แจ้งเตือน ≤ -`.
- Frontend คำนวณทันทีและไม่ให้แก้ MIN/MAX ที่ derive แล้วเอง.
- Checkbox `พารามิเตอร์ไม่มีค่ามาตรฐาน ...` ถูกเลือก หมายถึง `{ "enabled": false }`; เมื่อเอา checkbox ออกจึงเปิดช่องค่ามาตรฐานและส่ง `enabled: true`.
- ค่ามาตรฐานใหม่ต้องเป็น finite number มากกว่า `0` และสร้างขอบ 80% ที่ต่างจากค่ามาตรฐานได้; frontend แสดง error และปิดปุ่มบันทึกสำหรับค่าว่าง ศูนย์ ค่าติดลบ overflow หรือค่าจิ๋วจนช่วงเฝ้าระวังว่าง.
- Backend derive/เขียนทับ numeric rows ด้วยสูตร 80% ในทุก write flow เพื่อป้องกัน payload ที่ไม่สอดคล้องกัน.
- `enabled` รับ boolean หรือ legacy string `"true"`/`"false"`; ค่าอื่นถูก reject.
- ค่า legacy ที่ไม่ใช่ตัวเลขยังใช้ rows ที่ส่งมาครบ 3 ระดับได้.

ไม่ต้องมี endpoint ใหม่หรือ migration; ค่าเกณฑ์ยังอยู่ใน `measurementPoints[].measurementInstruments` ตามเดิม.

## UI ที่แก้แล้วในรอบนี้

- Footer dialog อยู่กึ่งกลางทั้ง CEMS/WPMS.
- บันทึกและแก้ไขผ่าน dialog ยืนยัน แล้วแสดง success Snackbar.
- ตารางไม่มีปุ่มลบ จึงไม่มี delete flow.
- ตารางสร้างแถวจาก `requestedParameters` และไม่มีปุ่มเพิ่มพารามิเตอร์ภายใน section.
- WPMS ไม่แสดงหัวข้อ/คอลัมน์การรายงานค่า; CEMS ยังแสดงตามเดิม.

## Payload rules ที่ backend บังคับแล้ว

### พารามิเตอร์

```ts
details: {
  eligibleParameters: string[];
  exemptedParameters: string[];
  connectedParameters: string[];
  pendingParameters: string[];
  requestedParameters: string[];
}
```

- ตัวเลือก `ไม่มี` ต้องอยู่ลำดับแรกใน UI และเลือกเดี่ยว ห้ามปนค่าจริง.
- `requestedParameters` ห้ามมี `ไม่มี` และต้องเป็น subset ของ `pendingParameters`.
- สร้าง options ของ requested field จากค่า pending ปัจจุบัน ไม่ใช่จาก master list เต็ม.
- CEMS canonical labels ใหม่คือ `CS2 (ppm)`, `CS2 (ppb)`, `CS2 (mg/m³)`. แก้ frontend JSON จาก `mg/m3` เป็น `mg/m³`.
- `measurementInstruments.parameters[]` ควรมี row เฉพาะ requested parameters และใช้ label พร้อมหน่วยเดียวกัน.

### EIA ของหัวคำขอ

```ts
{
  eia: 'มี' | 'ไม่มี' | 'มี IEE' | 'มี EIA' | 'มี EHIA' | 'อื่นๆ' | null;
  eiaOther: string | null;
  hasEia: boolean | null;
}
```

- Backend รับ payload แบบละเอียดจาก frontend แล้ว และ response จะคืน `eia`, `eiaOther`, `hasEia` ทั้งสาม field.
- `eia = "อื่นๆ"` ต้องส่ง `eiaOther` ที่ไม่ว่าง.
- `hasEia` ต้องสอดคล้องกับ `eia`: `ไม่มี`/`อื่นๆ` เป็น `false`; ค่า `มี`, `มี IEE`, `มี EIA`, `มี EHIA` เป็น `true`.
- คำขอเก่าที่ยังไม่มี categorical snapshot จะ fallback จาก `has_eia` เป็น `มี`/`ไม่มี`; จึงไม่สามารถกู้ subtype เดิมของข้อมูลเก่าได้.
- หน้าแก้ไขต้องอ่าน `response.data.eiaOther` กลับเข้าฟอร์มด้วย ไม่เช่นนั้นค่า `อื่นๆ` จะหายตอน resubmit.

### CEMS

```ts
details: {
  legalAnnexNo: Array<'1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | '13'>;
  exemptedParameterRegulationClauses: string[];
  primaryFuel: string | null;
  primaryFuelOther: string | null;
  secondaryFuel: string | null;
  secondaryFuelOther: string | null;
  combustionControlSystem: 'ระบบปิด' | 'ระบบเปิด';
  hasTreatmentSystem: 'มี' | 'ไม่มี';
  treatmentSystem: string[];
  treatmentSystemOther: string | null;
  connectionDevice: string | null;
}
```

- `ชีวมวล`, `Biomass`, `อื่นๆ` ต้องกรอก fuel Other ของช่องเดียวกัน.
- ถ้าเลือก treatment `อื่นๆ` ต้องกรอก `treatmentSystemOther`.
- เปลี่ยน visible option จาก `POMS` เป็น `D-POMS`; backend ยังคงรับค่าเก่าเพื่อ history.
- ช่อง `พารามิเตอร์ที่ได้รับการยกเว้นตามประกาศฯ ข้อ` ต้อง bind เป็น `details.exemptedParameterRegulationClauses`; backend รับและเก็บ `string[]` แล้ว.

### WPMS

WPMS ใช้ treatment options จาก `frontend/src/option/wpmsTreatmentSystemOptions.json` และต้องส่งเอกสารด้วย:

```ts
measurementPoints: [{
  pointType: 'WASTEWATER',
  details: {
    monitoringPointKind: 'WPMS',
    pendingParameters: string[],
    requestedParameters: string[],
    hasTreatmentSystem: 'มี' | 'ไม่มี',
    treatmentSystem: string[],
    treatmentSystemOther: string | null,
    maxTreatmentCapacity: number | null,
    connectionDevice: string | null,
  },
  documentsAndImages: DocumentImage[];
  measurementInstruments: MeasurementInstruments;
}]
```

จุดที่ต้องแก้ใน `buildMeasurementPointRequestBody`: WPMS branch ปัจจุบันไม่มี `documentsAndImages`; ต้องใส่ field ระดับเดียวกับ `details` และ `measurementInstruments`.

## Upload flow

Backend รับหนึ่งไฟล์ต่อ multipart request. สำหรับ input แบบ multiple ให้ loop upload ทีละไฟล์ แล้วรวม `response.data` ทุกตัว:

```ts
type DocumentImage = {
  title: string;
  description?: string | null;
  link?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
};
```

กติกา:

- แต่ละไฟล์ไม่เกิน `5 * 1024 * 1024` bytes.
- หมายเหตุทั่วไปใช้ข้อความ `ขนาดไม่เกิน 5 MB`.
- โลโก้ใช้ข้อความ `ขนาด 512 × 512 Pixel และไม่เกิน 5 MB` และ input ต้องไม่เป็น multiple.
- Title โลโก้ต้องเป็น `สัญลักษณ์ของโรงงานหรือโลโก้บริษัท`; backend รับได้ไม่เกินหนึ่ง metadata row ต่อคำขอ แม้คำขอจะมีหลาย measurement point.
- Title อื่นส่งซ้ำได้หลาย row.
- ทุก document row ที่ส่งจริงต้องมี URL อย่างน้อยหนึ่ง field ระหว่าง `link` หรือ `fileUrl`; `fileName` อย่างเดียวไม่ถือว่าอัปโหลดสำเร็จ.
- Backend กรองได้เฉพาะ empty placeholder shape ที่ frontend สร้างตาม contract; object ที่มี field ผิด, file size ผิด หรือ metadata บางส่วนจะถูก reject ไม่ถูกทิ้งเงียบ ๆ.
- Backend รอบนี้ไม่ตรวจ pixel dimension จาก binary เพราะ requirement ระบุเป็น UI note; frontend ควรตรวจ 512 × 512 ก่อน upload หากต้องการบังคับจริง.
- ไฟล์ PNG/JPEG/PDF ต้องมี binary signature ตรงกับ MIME type และนามสกุล; เปลี่ยนเฉพาะชื่อไฟล์หรือ MIME ไม่ทำให้ไฟล์ชนิดอื่นผ่าน.

หมายเหตุ compatibility: คำขอเก่าที่มี metadata `fileSize` มากกว่า 5 MiB จะ resubmit ไม่ผ่าน contract ใหม่ จนกว่าจะลบหรืออัปโหลดไฟล์นั้นใหม่ให้ไม่เกิน 5 MiB.

## Resubmit contract

Frontend ไม่จำเป็นต้องส่ง `requestType` ใน `PUT /api/v1/cems-wpms-requests/:id/form`. Backend จะใช้ประเภทเดิมของคำขอ (`NEW_CONNECTION`, `ADD_MEASUREMENT_POINT` หรือ `ADD_PARAMETER`) และตรวจ validation ของประเภทนั้นก่อนบันทึก ถ้าส่ง `requestType` ที่ไม่ตรงกับคำขอเดิม backend จะ reject จึงห้ามใช้ field นี้เปลี่ยนชนิดคำขอ.

## จุดที่ต้องแก้ใน frontend ก่อนทดสอบ submit

| Priority | File/area | สิ่งที่ต้องแก้ |
| --- | --- | --- |
| P0 | `ConnectionRequestPage.jsx` WPMS payload | เพิ่ม `documentsAndImages` ใน measurement point |
| P0 | requested parameter fields | ใช้ pending list เป็น options และ sync instrument rows จาก requested list |
| P0 | EIA response prefill | อ่าน `eiaOther` จาก response กลับเข้า state เมื่อแก้ไขคำขอ |
| P0 | treatment multiselect serialization | ห้าม split ทุกค่าด้วย comma เพราะ option WPMS บางค่ามี comma อยู่ใน label; เก็บ array จาก component โดยตรง |
| P0 | contact serialization | สร้างแต่ละ contact เป็น object ก่อนกรอง อย่ากรอง name/position/phone/email แยก array แล้วจับคู่ด้วย index |
| P1 | exemption regulation tags | bind ช่อง tag กับ `details.exemptedParameterRegulationClauses` |
| P1 | parameter multiselect | ทำ `ไม่มี` exclusive; ตรวจว่าต้องเพิ่ม exempted field ให้ WPMS |
| P1 | `cemsParameterOptions.json` | เปลี่ยน `CS2 (mg/m3)` เป็น `CS2 (mg/m³)` |
| P1 | connection device options | เปลี่ยน visible `POMS ...` ทุกค่าที่ requirement ต้องการเป็น `D-POMS ...` |
| P1 | upload helper text | ใช้ `MB`/`Pixel` ตามข้อความที่กำหนดและเพิ่ม client-side 5 MB check |
| P2 | Mobile/Station | ใส่ name/state/payload mapping; ตอนนี้เป็นเพียงช่องแสดงผลและไม่ได้ submit end-to-end |

## Error paths ที่ควรผูกกับ UI

Backend validation issue paths ที่เกี่ยวข้อง:

```text
measurementPoints.0.details.legalAnnexNo
measurementPoints.0.details.exemptedParameterRegulationClauses
measurementPoints.0.details.requestedParameters
measurementPoints.0.details.pendingParameters
measurementPoints.0.details.primaryFuelOther
measurementPoints.0.details.secondaryFuelOther
measurementPoints.0.details.treatmentSystem
measurementPoints.0.details.treatmentSystemOther
measurementPoints.0.documentsAndImages
measurementPoints.0.documentsAndImages.0.fileSize
eiaOther
hasEia
```

Upload มากกว่า 5 MB คืน HTTP 400 และ `error.code = "UPLOAD_ERROR"`.

Validation error คืน `error.details` เดิมสำหรับ compatibility และเพิ่ม `error.issues[]` ซึ่งมี `code`, `path`, `pathString`, `message`; frontend ควรใช้ `pathString` ผูก error กับ nested field.

## Acceptance checklist สำหรับ frontend

- [ ] CEMS submit ด้วย annex `13` ผ่าน และ `14` ไม่อยู่ใน UI.
- [ ] Requested field แสดงเฉพาะ pending values.
- [ ] `ไม่มี` ไม่สามารถเลือกพร้อมค่าจริง.
- [ ] CEMS/WPMS treatment ส่ง array และ Other detail ครบ.
- [ ] WPMS final JSON มีเอกสารระบบบำบัดและภาพเครื่องมือ.
- [ ] แนบ non-logo title เดียวกัน 2 ไฟล์แล้ว final JSON มี 2 rows.
- [ ] โลโก้เลือกได้ไฟล์เดียวและ note ตรงข้อความ.
- [ ] ไฟล์ 5 MB ผ่าน; 5 MB + 1 byte แสดง error ก่อนหรือหลัง upload อย่างชัดเจน.
- [ ] EIA ทุกชนิดส่ง `eia`/`eiaOther`/`hasEia` แล้วเปิดแก้ไขได้ค่าเดิมจาก response.
- [ ] ช่องประกาศฯ ข้อ ส่งเป็น `details.exemptedParameterRegulationClauses: string[]`.
- [ ] WPMS treatment label ที่มี comma round-trip แล้วจำนวนตัวเลือกไม่เพิ่ม.
