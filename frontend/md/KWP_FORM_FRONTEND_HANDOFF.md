# KWP01 datetime duration frontend handoff

เอกสารนี้บันทึกการแก้ไข frontend เฉพาะหน้า **แจ้งแบบ กวภ.01 - กวภ.05** สำหรับแบบ **กวภ.01** เพื่อให้ backend ใช้ตรวจสอบและปรับ payload/API contract ต่อ

## Scope ที่แก้ไข

- ไฟล์ frontend: `src/pages/KwpFormsPage.jsx`
- พื้นที่หน้าจอ: หน้า **แจ้งแบบ กวภ.01 - กวภ.05**
- แบบฟอร์มที่ได้รับผลกระทบ: **กวภ.01** เท่านั้น
- แบบฟอร์ม กวภ.02, กวภ.03, กวภ.04, กวภ.05 ยังใช้ logic วันที่เดิม

## ส่วนที่แก้ไข

### 1. ช่องวันที่ใน e-form กวภ.01

ตำแหน่งในหน้า:

- Section: `สาเหตุของการไม่สามารถรายงานผลการตรวจวัดได้`
- Field: `วัน/เดือน/ปี ที่พบปัญหาหรือหยุดหน่วยการผลิต`
- Field: `วัน/เดือน/ปี ที่คาดว่าจะดำเนินการแล้วเสร็จ`

แบบเดิม:

- ใช้ `DatePicker`
- เลือกได้เฉพาะวัน/เดือน/ปี
- แสดง format `DD/MM/YYYY`
- ไม่มีข้อมูลชั่วโมง

แบบใหม่:

- ใช้ `DateTimePicker`
- เลือกได้ถึงระดับชั่วโมง
- ไม่ให้เลือกนาที
- แสดง format `DD/MM/YYYY HH:00`
- ค่าเวลาจะถูก normalize เป็นนาที/วินาที/มิลลิวินาที = `00`

ตัวอย่างค่าที่ผู้ใช้เลือก:

- `01/07/2569 08:00`
- `05/07/2569 06:00`

### 2. ช่องรวมระยะเวลาปรับปรุงแก้ไขหรือระยะเวลาหยุดหน่วยการผลิต

ตำแหน่งในหน้า:

- Section: `สาเหตุของการไม่สามารถรายงานผลการตรวจวัดได้`
- Field: `รวมระยะเวลาปรับปรุงแก้ไขหรือระยะเวลาหยุดหน่วยการผลิต`

แบบเดิม:

- คำนวณด้วย `getDayRange(startDate, endDate)`
- คิดเป็นจำนวนวันแบบ inclusive โดยใช้ `startOf('day')`
- แสดงเป็นตัวเลขวัน เช่น `5`
- Label เดิมมี `(วัน)`

แบบใหม่:

- คำนวณจากผลต่างของ `expectedDoneDate - problemDate` เป็นจำนวนชั่วโมงจริง
- แสดงเป็นข้อความวัน/ชั่วโมง
- ไม่บวกวันแบบ inclusive
- ไม่แสดง `(วัน)` ใน label แล้ว

ตัวอย่าง:

- เริ่ม `01/07/2569 08:00` จบ `05/07/2569 06:00` แสดง `3 วัน 22 ชั่วโมง`
- เริ่ม `01/07/2569 08:00` จบ `02/07/2569 05:00` แสดง `21 ชั่วโมง`
- ถ้าวันเวลาสิ้นสุดน้อยกว่าวันเวลาเริ่มต้น จะแสดงค่าว่าง

### 3. Preview/PDF ของ กวภ.01

ตำแหน่งใน PDF:

- ข้อ `3.2 วัน/เดือน/ปี ที่พบปัญหาหรือหยุดหน่วยการผลิต`
- ข้อ `3.3 วัน/เดือน/ปี ที่คาดว่าจะดำเนินการแล้วเสร็จ`
- ช่อง `รวมระยะเวลาปรับปรุงแก้ไขหรือระยะเวลาหยุดหน่วยการผลิต`

แบบเดิม:

- วันที่แสดงเฉพาะ `DD/MM/BBBB`
- รวมระยะเวลาแสดงเป็นจำนวนวัน
- Label รวมระยะเวลาใช้ `(วัน)`

แบบใหม่:

- วันที่แสดงเป็น `DD/MM/BBBB HH:00`
- รวมระยะเวลาแสดงเป็นข้อความ เช่น `3 วัน 22 ชั่วโมง` หรือ `21 ชั่วโมง`
- Label รวมระยะเวลาไม่ระบุ `(วัน)` แล้ว

### 4. การเปิดดูข้อมูลเดิมจาก response

ตำแหน่ง logic:

- Function: `buildKwpRequestPreviewDataFromDetail`

แบบเดิม:

- อ่าน `issueReport.problemDate`
- อ่าน `issueReport.expectedDoneDate`
- อ่าน `issueReport.totalDays`

แบบใหม่:

- วันที่ใช้ formatter ที่รองรับชั่วโมง ถ้า response มีเวลา
- รวมระยะเวลารองรับ field เพิ่มเติมตามลำดับนี้:
  - `issueReport.totalDuration`
  - `issueReport.totalDurationText`
  - `issueReport.totalHours`
  - fallback เป็น `issueReport.totalDays`
- ถ้ายังได้รับ `totalDays` จาก backend เดิม จะแสดงเป็น `x วัน`

## API ที่ได้รับผลกระทบ

### Create กวภ.01

Endpoint:

```http
POST /api/v1/kwp-form-submissions/kwp01
```

ผลกระทบ:

- Field `problemDate` ควรรองรับข้อมูลวันและชั่วโมง
- Field `expectedDoneDate` ควรรองรับข้อมูลวันและชั่วโมง
- Field รวมระยะเวลาควรรองรับการเก็บ/คืนค่าเป็นชั่วโมงหรือข้อความวัน/ชั่วโมง ไม่ใช่เฉพาะจำนวนวัน

### Edit กวภ.01

Endpoint:

```http
PATCH /api/v1/kwp-form-submissions/kwp01/:id
```

ผลกระทบ:

- ใช้ payload structure เดียวกับ create
- ต้องรองรับ field วันที่แบบมีชั่วโมงเหมือน create
- ต้องรองรับ duration แบบชั่วโมงเหมือน create

### Resubmit กวภ.01

Endpoint:

```http
POST /api/v1/kwp-form-submissions/kwp01/:id/resubmit
```

ผลกระทบ:

- ตัว endpoint resubmit เองไม่ได้รับ field วันที่โดยตรง
- แต่ flow edit + resubmit จะใช้ข้อมูลที่บันทึกผ่าน `PATCH /kwp01/:id`

### Get detail กวภ.01

Endpoint:

```http
GET /api/v1/kwp-form-submissions/kwp01/:id
```

ผลกระทบ:

- Response `issueReport.problemDate` ควรคืนข้อมูลวันที่พร้อมชั่วโมง
- Response `issueReport.expectedDoneDate` ควรคืนข้อมูลวันที่พร้อมชั่วโมง
- Response `issueReport` ควรคืน duration ที่ frontend ใช้แสดงได้ชัดเจน

## Structure ที่ frontend ต้องการให้ backend พิจารณา

แนะนำให้ backend ปรับจาก date-only เป็น datetime-hour ใน field เดิม หรือเพิ่ม field ใหม่แล้วตกลง contract ร่วมกัน

ตัวเลือกที่แนะนำ:

```json
{
  "problemDate": "2026-07-01T08:00:00",
  "expectedDoneDate": "2026-07-05T06:00:00",
  "totalHours": 94,
  "totalDurationText": "3 วัน 22 ชั่วโมง"
}
```

หมายเหตุ:

- `problemDate` และ `expectedDoneDate` ต้องไม่สนใจนาที หรือ normalize นาทีเป็น `00`
- `totalHours` เหมาะสำหรับเก็บและคำนวณ
- `totalDurationText` เหมาะสำหรับแสดงผล ถ้า backend ต้องการควบคุมข้อความ
- ถ้า backend ไม่ต้องการเก็บ `totalDurationText` frontend สามารถคำนวณจาก `totalHours` ได้

## Contract เดิมที่ควรแก้ฝั่ง backend

จาก contract/API เดิม:

- `problemDate`: `YYYY-MM-DD`
- `expectedDoneDate`: `YYYY-MM-DD`
- `totalDays`: `number`

ข้อจำกัดของ contract เดิม:

- เก็บชั่วโมงไม่ได้
- คำนวณ duration ข้ามวันแบบละเอียดไม่ได้
- ไม่รองรับกรณีเช่น `21 ชั่วโมง` หรือ `3 วัน 22 ชั่วโมง`

## Frontend compatibility ปัจจุบัน

Frontend รองรับการแสดงผล response ได้ทั้งแบบใหม่และแบบเก่า:

- ถ้า response มี `totalDuration` หรือ `totalDurationText` จะใช้ค่านั้นก่อน
- ถ้ามี `totalHours` จะคำนวณเป็นข้อความวัน/ชั่วโมง
- ถ้ามีแค่ `totalDays` จะ fallback เป็น `x วัน`

ส่วน payload ที่ส่งจริงควรอัปเดตตาม backend contract ใหม่เมื่อ backend พร้อม เพื่อให้เก็บข้อมูลชั่วโมงได้ครบถ้วน

---

# Reporter field layout update

เอกสารส่วนนี้บันทึกการแก้ไข layout เพิ่มเติมในหน้า **แจ้งแบบ กวภ.01 - กวภ.05**

## Scope ที่แก้ไข

- ไฟล์ frontend: `src/pages/KwpFormsPage.jsx`
- พื้นที่หน้าจอ: หน้า **แจ้งแบบ กวภ.01 - กวภ.05**
- แบบฟอร์มที่ได้รับผลกระทบ: **กวภ.01, กวภ.02, กวภ.03, กวภ.04, กวภ.05**

## ส่วนที่แก้ไข

Section ผู้จัดทำรายงานของแต่ละแบบฟอร์ม:

- กวภ.01: `ผู้ประกอบกิจการโรงงานหรือผู้รับมอบอำนาจ (ผู้จัดทำรายงาน)`
- กวภ.02/กวภ.04: `ผู้ประกอบกิจการโรงงานหรือผู้รับมอบอำนาจ (ผู้จัดทำรายงาน)`
- กวภ.03: `ผู้จัดทำรายงาน/ผู้ดูแลระบบบำบัด`
- กวภ.05: `ผู้รายงานผลการทดสอบ`

Field ที่ปรับ:

- `reporterName` / label `ชื่อ-นามสกุล`
- `reporterPosition` / label `ตำแหน่ง`

## แบบเดิม

- `reporterName` ใช้ grid size `md: 6`
- `reporterPosition` ใช้ grid size `md: 6`
- บน desktop แสดง 2 ช่องเต็มแถวแบบครึ่งต่อครึ่ง

## แบบใหม่

- `reporterName` ใช้ grid size `md: 3`
- `reporterPosition` ใช้ grid size `md: 3`
- บน mobile ยังใช้ `xs: 12` เหมือนเดิม
- เป็นการแก้ layout เท่านั้น ไม่เปลี่ยนชื่อ field ใน form และไม่เปลี่ยน payload

## API ที่ได้รับผลกระทบ

ไม่มีผลกระทบกับ API

Field ที่ส่ง payload ยังเป็นชื่อเดิม:

- `reporterName`
- `reporterPosition`

Endpoint ที่ยังใช้ field เดิม:

- `POST /api/v1/kwp-form-submissions/kwp01`
- `POST /api/v1/kwp-form-submissions/kwp02`
- `POST /api/v1/kwp-form-submissions/kwp03`
- `POST /api/v1/kwp-form-submissions/kwp04`
- `POST /api/v1/kwp-form-submissions/kwp05`
- `PATCH /api/v1/kwp-form-submissions/kwp01/:id`
- `PATCH /api/v1/kwp-form-submissions/kwp02/:id`
- `PATCH /api/v1/kwp-form-submissions/kwp03/:id`
- `PATCH /api/v1/kwp-form-submissions/kwp04/:id`
- `PATCH /api/v1/kwp-form-submissions/kwp05/:id`

---

# Emission measurement method dropdown update

เอกสารส่วนนี้บันทึกการแก้ไข field ใน dialog ของหน้า **แจ้งแบบ กวภ.01 - กวภ.05**

## Scope ที่แก้ไข

- ไฟล์ frontend: `src/pages/KwpFormsPage.jsx`
- ไฟล์ option: `src/option/kwpEmissionMeasurementMethodOptions.json`
- พื้นที่หน้าจอ: หน้า **แจ้งแบบ กวภ.01 - กวภ.05**
- แบบฟอร์มที่ได้รับผลกระทบ: **กวภ.02** และ **กวภ.04**

## ส่วนที่แก้ไข

Dialog:

- `รายการตรวจวัดมลพิษอากาศจากปล่องระบาย`

Field:

- `วิธีการตรวจวัดวิเคราะห์`
- payload field: `measurementItems[].method`

## แบบเดิม

- Field `วิธีการตรวจวัดวิเคราะห์` เป็น text input
- ผู้ใช้พิมพ์ค่าเองได้อิสระ
- ไม่มีไฟล์ option กลางสำหรับรายการวิธีตรวจวัด

## แบบใหม่

- Field `วิธีการตรวจวัดวิเคราะห์` เปลี่ยนเป็น dropdown
- ตัวเลือกอ่านจากไฟล์ `src/option/kwpEmissionMeasurementMethodOptions.json`
- ข้อมูลในไฟล์เป็น mock data ชั่วคราว
- รูปแบบ option ใช้ `label`, `value`, `parameterNames`, และ `parameterLabels`
- Dropdown จะแสดงเฉพาะ option ที่สัมพันธ์กับ `รายการสารมลพิษ` ที่เลือกไว้
- เมื่อเปลี่ยน `รายการสารมลพิษ` frontend จะ clear ค่า `method` เดิม เพื่อกัน method ที่ไม่ตรงพารามิเตอร์
- ค่าใน form state และ payload ยังเก็บใน field เดิมคือ `method`

ตัวอย่าง option structure:

```json
[
  {
    "parameterNames": ["As"],
    "parameterLabels": ["As (mg/m3)"],
    "label": "US EPA Method 5 - Particulate matter",
    "value": "US EPA Method 5 - Particulate matter"
  }
]
```

วิธีเชื่อมโยงกับสารมลพิษ:

- `parameterNames` ใช้เก็บชื่อพารามิเตอร์แบบไม่รวมหน่วย เช่น `As`, `Sb`
- `parameterLabels` ใช้เก็บ label ที่แสดงใน dropdown รายการสารมลพิษ เช่น `As (mg/m3)`, `Sb (mg/m3)`
- Frontend จะตัดข้อมูลในวงเล็บหน่วยออกก่อนเทียบเสมอ
- ตัวอย่างเช่น `CO (ppm)` และ `CO (%)` จะใช้ตัวเลือกเดียวกันกับ `CO`
- ดังนั้นการเชื่อมโยงหลักควรใช้ `parameterNames`; `parameterLabels` เป็นข้อมูลประกอบสำหรับอ่านง่ายหรือรองรับ label เฉพาะทางเท่านั้น

ตัวอย่าง mock data ปัจจุบัน:

- `Antimony (Sb)` ผูกกับ `Sb` / `Sb (mg/m3)`
- `Arsenic (As)` ผูกกับ `As` / `As (mg/m3)`

## API ที่ได้รับผลกระทบ

Endpoint ที่เกี่ยวข้อง:

- `POST /api/v1/kwp-form-submissions/kwp02`
- `POST /api/v1/kwp-form-submissions/kwp04`
- `PATCH /api/v1/kwp-form-submissions/kwp02/:id`
- `PATCH /api/v1/kwp-form-submissions/kwp04/:id`
- `GET /api/v1/kwp-form-submissions/kwp02/:id`
- `GET /api/v1/kwp-form-submissions/kwp04/:id`

ผลกระทบกับ payload:

- ไม่มีการเปลี่ยนชื่อ field
- ยังใช้ `measurementItems[].method` เหมือนเดิม
- ค่าที่ส่งจะเป็นหนึ่งใน `value` จากไฟล์ option

ข้อที่ backend ควรพิจารณา:

- ถ้าฝั่ง backend ต้อง validate ค่า `method` ควร sync รายการ option จริงกับ frontend
- ถ้า backend ส่ง option มาในอนาคต ควรมี key สำหรับเชื่อมกับพารามิเตอร์ เช่น `parameterName`, `parameterCode`, หรือ `parameterLabel`
- ถ้า backend จะเป็นเจ้าของ master data ในอนาคต อาจเปลี่ยนจาก JSON frontend เป็น API option endpoint ได้

---

# KWP03 e-form layout and datetime update

เอกสารส่วนนี้บันทึกการแก้ไข frontend เฉพาะแบบ **กวภ.03** ในหน้า **แจ้งแบบ กวภ.01 - กวภ.05**

## Scope ที่แก้ไข

- ไฟล์ frontend: `src/pages/KwpFormsPage.jsx`
- พื้นที่หน้าจอ: หน้า **แจ้งแบบ กวภ.01 - กวภ.05**
- แบบฟอร์มที่ได้รับผลกระทบ: **กวภ.03**

## ส่วนที่แก้ไข

### 1. ตัดช่องเวลาเครื่องตรวจวัด

ตำแหน่งในหน้า:

- Section: `ข้อมูลจุดตรวจวัด`
- Field: `เวลาเครื่องตรวจวัด`

แบบเดิม:

- มี dropdown `เวลาเครื่องตรวจวัด`
- มี state `wpmsMeasurementTime`
- ส่ง/preview ค่าเป็น `measurementTimes`

แบบใหม่:

- ตัด field `เวลาเครื่องตรวจวัด` ออกจาก e-form กวภ.03
- Preview/PDF ของ กวภ.03 ไม่แสดงแถว `เวลาเครื่องตรวจวัด`
- Frontend ไม่อ่านค่า default `wpmsMeasurementTime` สำหรับฟอร์มนี้แล้ว
- Payload/API contract ให้ backend กำหนดต่อ ไม่สรุปจาก frontend change นี้

### 2. แก้คำผิดของประเภทระบบบำบัด

ตำแหน่งในหน้า:

- Section: `ข้อมูลนํ้าทิ้งระบายออกนอกโรงงาน (กรอกเฉพาะเครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง)`
- Field: `ประเภทระบบบำบัด`

แบบเดิม:

- Label เขียนผิดเป็น `ประเภทรบบบำบัด`
- Preview/PDF เขียนผิดเป็น `ประเภทรบบบำบัด`

แบบใหม่:

- Label ใน e-form แก้เป็น `ประเภทระบบบำบัด`
- Label ใน preview/PDF แก้เป็น `ประเภทระบบบำบัด`
- Field name/payload key ยังเป็น `treatmentSystemType` เหมือนเดิม

### 3. วันที่ของ กวภ.03 เลือกชั่วโมงได้

ตำแหน่งในหน้า:

- Section: `สาเหตุของการไม่สามารถรายงานผลการตรวจวัดได้`
- Field: `วัน/เดือน/ปี ที่พบปัญหาหรือหยุดหน่วยการผลิต`
- Field: `วัน/เดือน/ปี ที่คาดว่าจะดำเนินการแล้วเสร็จ`

แบบเดิม:

- ใช้ `DatePicker`
- เลือกได้เฉพาะวัน/เดือน/ปี
- แสดง format `DD/MM/YYYY`
- รวมระยะเวลาแสดงเป็นจำนวนวัน

แบบใหม่:

- ใช้ `DateTimePicker`
- เลือกได้ถึงระดับชั่วโมง
- ไม่ให้เลือกนาที
- แสดง format `DD/MM/YYYY HH:00`
- ค่าเวลาถูก normalize เป็นนาที/วินาที/มิลลิวินาที = `00`
- รวมระยะเวลาใน e-form และ preview/PDF แสดงเป็นวัน/ชั่วโมง เช่น `3 วัน 22 ชั่วโมง` หรือ `21 ชั่วโมง`

## API ที่ได้รับผลกระทบ

Endpoint ที่เกี่ยวข้อง:

- `POST /api/v1/kwp-form-submissions/kwp03`
- `PATCH /api/v1/kwp-form-submissions/kwp03/:id`
- `GET /api/v1/kwp-form-submissions/kwp03/:id`

ผลกระทบที่ backend ควรพิจารณา:

- `measurementTimes` ไม่ควรเป็น field บังคับสำหรับ กวภ.03 แล้ว
- `problemDate` ควรรองรับข้อมูลวันและชั่วโมง
- `expectedDoneDate` ควรรองรับข้อมูลวันและชั่วโมง
- Duration ควรรองรับระดับชั่วโมง ไม่ใช่เฉพาะจำนวนวัน
- `treatmentSystemType` ยังเป็น key เดิม เปลี่ยนเฉพาะ label frontend
- Frontend change นี้เน้น e-form/preview เป็นหลัก ส่วน payload สุดท้ายให้ backend ส่ง contract กลับมาเพื่อปรับตามอีกครั้ง

---

# KWP05 e-form field removal and attachment note update

เอกสารส่วนนี้บันทึกการแก้ไข frontend เฉพาะแบบ **กวภ.05** ในหน้า **แจ้งแบบ กวภ.01 - กวภ.05**

## Scope ที่แก้ไข

- ไฟล์ frontend: `src/pages/KwpFormsPage.jsx`
- พื้นที่หน้าจอ: หน้า **แจ้งแบบ กวภ.01 - กวภ.05**
- แบบฟอร์มที่ได้รับผลกระทบ: **กวภ.05**

## ส่วนที่แก้ไข

### 1. ตัดช่องยี่ห้อ Brand ออกจาก e-form

ตำแหน่งเดิม:

- Section: `ข้อมูลจุดตรวจวัดและเครื่องมือ`
- Field: `ยี่ห้อ (Brand)`

แบบเดิม:

- มี text input `ยี่ห้อ (Brand)` ใน e-form กวภ.05

แบบใหม่:

- ตัด field `ยี่ห้อ (Brand)` ออกจาก e-form กวภ.05

### 2. ตัดช่องบริษัทที่ทำการทวนสอบ / สอบเทียบออกจาก dialog

Dialog:

- `เพิ่มรายการผลการสอบเทียบหรือทวนสอบ CEMS`
- `แก้ไขรายการผลการสอบเทียบหรือทวนสอบ CEMS`

Field เดิม:

- `บริษัทที่ทำการทวนสอบ / สอบเทียบ`

แบบเดิม:

- มี text input `บริษัทที่ทำการทวนสอบ / สอบเทียบ` ใน dialog รายการผลการสอบเทียบหรือทวนสอบ CEMS

แบบใหม่:

- ตัด field `บริษัทที่ทำการทวนสอบ / สอบเทียบ` ออกจาก dialog

### 3. เปลี่ยนหมายเหตุช่องแนบไฟล์

ตำแหน่ง:

- Dialog `เพิ่มรายการผลการสอบเทียบหรือทวนสอบ CEMS`
- Dialog `แก้ไขรายการผลการสอบเทียบหรือทวนสอบ CEMS`

Field แนบไฟล์:

- `รายงานผล RATA`
- `ภาพขณะสอบเทียบ`

แบบเดิม:

- Label ไม่มีหมายเหตุขนาดไฟล์

แบบใหม่:

- `รายงานผล RATA (JPG/PNG/PDF ไม่เกิน 10 MB)`
- `ภาพขณะสอบเทียบ (JPG/PNG/PDF ไม่เกิน 10 MB)`

## API ที่ได้รับผลกระทบ

Frontend change นี้เน้น e-form/dialog เป็นหลัก ส่วน payload/API contract สุดท้ายให้ backend กำหนดต่อ

Field ที่ backend ควรพิจารณา:

- `cemsBrand`
- `calibrationItems[].verifierCompany`
- attachment file size policy ของ กวภ.05 ควรสอดคล้องกับ 10 MB

---

# KWP01 connected measurement point prefill fields

เอกสารส่วนนี้บันทึก field ที่ frontend ต้องการให้ backend เพิ่มใน API จุดตรวจวัด เพื่อ prefill แบบ **กวภ.01** ในหน้า **แจ้งแบบ กวภ.01 - กวภ.05**

## API ที่เกี่ยวข้อง

```http
GET /api/v1/connected-measurement-points/factories/:factoryId
```

## Scope ที่ต้องการ

- ใช้กับ flow สร้าง e-form ใหม่จากตาราง `รายชื่อโรงงาน`
- เมื่อผู้ใช้เลือกโรงงาน แล้วเลือกจุดตรวจวัด จากนั้นเปิดแบบ **กวภ.01**
- ข้อมูลจาก response ของ API นี้ควรช่วย prefill ช่องใน section `ข้อมูลจุดตรวจวัด`

## Field ที่ต้องการเพิ่มใน response

| Response field | ช่องใน e-form กวภ.01 | หมายเหตุ |
| --- | --- | --- |
| `productionStack` | `ปล่องจากกระบวนการผลิต` | ควรเป็น string หรือ null |
| `combustionSystem` | `ระบบการเผาไหม้เชื้อเพลิง` | ควรเป็น `ระบบปิด`, `ระบบเปิด`, หรือ null |
| `productionCapacity` | `กำลังการผลิตของหน่วยการผลิต` | ควรเป็น string หรือ null |
| `productionCapacityUnit` | `หน่วยของกำลังการผลิต` | ควรเป็น string หรือ null |

## Field ที่ API มีใช้งานแล้วใน frontend

ข้อมูลที่ frontend ใช้จาก API นี้อยู่แล้ว:

- `pointCode` -> `รหัสจุดตรวจวัด`
- `pointName` -> `ชื่อจุดตรวจวัด`
- `pointType`
- `parameterDetails` -> option ของ `รายการตรวจวัด (พารามิเตอร์) ที่ไม่สามารถรายงานผลได้`
- `primaryFuel` -> `เชื้อเพลิงหลัก`
- `secondaryFuel` -> `เชื้อเพลิงสำรอง`

## ตัวอย่าง response shape ที่ต้องการ

```json
{
  "pointCode": "S0001",
  "pointName": "ปล่องระบาย A",
  "pointType": "CEMS",
  "parameterDetails": ["NOx (ppm)", "SO2 (ppm)"],
  "primaryFuel": "ก๊าซธรรมชาติ",
  "secondaryFuel": "น้ำมันเตา",
  "productionStack": "ปล่องจากหม้อไอน้ำ",
  "combustionSystem": "ระบบปิด",
  "productionCapacity": "100",
  "productionCapacityUnit": "ตัน/วัน"
}
```

## API impact

- เป็นการเพิ่ม field ใน response ของ `GET /api/v1/connected-measurement-points/factories/:factoryId`
- ไม่ควร breaking change กับ frontend เดิม เพราะเป็น optional response field
- เมื่อ backend เพิ่ม field แล้ว frontend จะสามารถนำไป prefill ช่อง กวภ.01 ได้ครบขึ้น

---

# KWP05 CEMS brand/model prefill source

เอกสารส่วนนี้บันทึก field ที่ frontend ต้องการให้ backend เตรียมข้อมูลสำหรับช่อง **ยี่ห้อ/รุ่นของ CEMS** ในแบบ **กวภ.05**

## ช่องที่ต้องการ prefill

- แบบฟอร์ม: **กวภ.05**
- Dialog: `เพิ่มรายการผลการสอบเทียบหรือทวนสอบ CEMS` / `แก้ไขรายการผลการสอบเทียบหรือทวนสอบ CEMS`
- Field ใน e-form: `ยี่ห้อ/รุ่นของ CEMS`
- Field ใน frontend row state ปัจจุบัน: `cemsModel`

## Source data ที่ต้องการให้ backend ใช้

ให้ใช้ข้อมูลจากช่อง **ยี่ห้อเครื่องมือ** ใน dialog **จัดการข้อมูลเครื่องมือตรวจวัด** ของหน้าขอเชื่อมต่อ

Source path ที่อ้างอิง:

```text
measurementPoints.measurementInstruments.parameters.brand
```

## Field ที่ต้องการเพิ่ม/คืนใน response

แนะนำให้ backend คืน field สำหรับ frontend ใช้ prefill เช่น:

| Response field | ช่องใน e-form กวภ.05 | Source |
| --- | --- | --- |
| `cemsModel` | `ยี่ห้อ/รุ่นของ CEMS` | `measurementPoints.measurementInstruments.parameters.brand` |

## หมายเหตุการ map ข้อมูล

- ถ้าในหนึ่งจุดตรวจวัดมีหลาย parameter และ brand เหมือนกัน ให้คืนค่า brand เดียว
- ถ้ามีหลาย brand ให้ backend พิจารณา format ที่เหมาะสม เช่น join ด้วย `, ` หรือแยกเป็นรายการตาม parameter
- ถ้าไม่มีค่า brand ให้คืน `null` หรือ string ว่างตาม contract ที่ backend กำหนด
- Frontend change รอบนี้เป็นการบันทึก requirement ให้ backend ก่อน ยังไม่ได้เปลี่ยน payload contract

---

# CEMS connected point API response and KWP payload summary

เอกสารส่วนนี้สรุป API จุดตรวจวัดสำหรับ **CEMS** และ inventory payload ที่แต่ละแบบ กวภ.01 - กวภ.05 ควรมี เพื่อให้ backend ใช้ตรวจ contract/validation ต่อ

## API สำหรับ CEMS ที่เกี่ยวข้อง

```http
GET /api/v1/connected-measurement-points/factories/:factoryId
```

API นี้ใช้ตอน frontend โหลดข้อมูลจุดตรวจวัดของโรงงาน เพื่อเลือกจุดตรวจวัดและ prefill ข้อมูลใน e-form กวภ.

## Response เดิมที่ frontend ใช้อยู่

รายการ field เดิมที่ frontend ใช้จาก response จุดตรวจวัด CEMS:

| Field | ใช้กับช่อง/ส่วนไหน |
| --- | --- |
| `id` หรือ `connectedPointId` | อ้างอิงจุดตรวจวัดที่เลือก |
| `pointCode` | `รหัสจุดตรวจวัด` |
| `pointName` | `ชื่อจุดตรวจวัด` |
| `pointType` | ประเภทจุดตรวจวัด เช่น CEMS/WPMS |
| `parameterDetails` | ตัวเลือก/รายการพารามิเตอร์ของจุดตรวจวัด |
| `primaryFuel` | `เชื้อเพลิงหลัก` |
| `secondaryFuel` | `เชื้อเพลิงสำรอง` |
| `details` | raw detail object สำหรับข้อมูลประกอบที่ backend ส่งมา |

## Response ใหม่ที่ต้องการเพิ่มสำหรับ CEMS

รายการ field ที่ต้องการให้ backend เพิ่มใน response เพื่อให้ frontend prefill แบบ กวภ. ได้ครบขึ้น:

| Field ใหม่ | ใช้กับช่อง | หมายเหตุ |
| --- | --- | --- |
| `productionStack` | `ปล่องจากกระบวนการผลิต` | ใช้ใน กวภ.01 |
| `combustionSystem` | `ระบบการเผาไหม้เชื้อเพลิง` | ใช้ใน กวภ.01 |
| `productionCapacity` | `กำลังการผลิตของหน่วยการผลิต` | ใช้ใน กวภ.01 |
| `productionCapacityUnit` | `หน่วยของกำลังการผลิต` | ใช้ใน กวภ.01 |
| `cemsModel` | `ยี่ห้อ/รุ่นของ CEMS` | ใช้ใน กวภ.05, source จาก `measurementPoints.measurementInstruments.parameters.brand` |

แนะนำให้ field ใหม่เป็น optional หรือ nullable เพื่อไม่กระทบข้อมูลเก่าที่ยังไม่มีค่า

## Payload กลางที่ควรมีในทุกแบบฟอร์ม

ทุกแบบ กวภ.01 - กวภ.05 ควรมีข้อมูลอ้างอิงโรงงาน/จุดตรวจวัด/ผู้จัดทำรายงานชุดเดียวกัน:

```json
{
  "factoryId": "string | number",
  "factoryName": "string",
  "factoryRegistrationNo": "string",
  "factoryAddress": "string",
  "industryType": "string",
  "connectedPointId": "string | number",
  "pointCode": "string",
  "pointName": "string",
  "pointType": "CEMS | WPMS",
  "productionStack": "string",
  "primaryFuel": "string",
  "secondaryFuel": "string",
  "combustionSystem": "string",
  "productionCapacity": "string | number",
  "productionCapacityUnit": "string",
  "contactName": "string",
  "contactPhone": "string",
  "contactEmail": "string",
  "reporterName": "string",
  "reporterPosition": "string"
}
```

## Payload กวภ.01

แบบ กวภ.01 ควรมี payload เพิ่มจาก payload กลาง:

```json
{
  "issueReason": "string",
  "reasonDetail": "string",
  "problemDate": "ISO datetime string",
  "expectedDoneDate": "ISO datetime string",
  "durationText": "string",
  "totalHours": "number",
  "unreportedParameters": ["string"],
  "correctiveAction": "string"
}
```

หมายเหตุ:

- ช่องวัน/เดือน/ปีใน กวภ.01 เลือกชั่วโมงได้แล้ว แต่ไม่เลือกนาที
- ระยะเวลาควรรองรับหน่วยชั่วโมง เช่น `3 วัน 22 ชั่วโมง` หรือ `21 ชั่วโมง`

## Payload กวภ.02

แบบ กวภ.02 ควรมี payload เพิ่มจาก payload กลาง:

```json
{
  "measurementItems": [
    {
      "pollutant": "string",
      "sampleDate": "ISO date/datetime string",
      "measuredValue": "string | number",
      "unit": "string",
      "laboratoryNo": "string",
      "reportNo": "string",
      "method": "string",
      "attachments": [
        {
          "fileName": "string",
          "fileUrl": "string",
          "fileType": "string"
        }
      ]
    }
  ]
}
```

หมายเหตุ:

- `method` มาจาก dropdown วิธีการตรวจวัดวิเคราะห์
- ตัวเลือก `method` ต้องสัมพันธ์กับ `pollutant` โดยไม่สนใจหน่วย เช่น `CO (ppm)` และ `CO (%)` ใช้ชุดตัวเลือกเดียวกับ `CO`

## Payload กวภ.03

แบบ กวภ.03 ควรมี payload เพิ่มจาก payload กลาง:

```json
{
  "instruments": ["string"],
  "wastewaterSource": "string",
  "receivingSource": "string",
  "treatmentSystemType": "string",
  "dischargePoint": "string",
  "averageDischarge": "string | number",
  "minimumDischarge": "string | number",
  "maximumDischarge": "string | number",
  "issueReasons": ["string"],
  "reasonDetail": "string",
  "problemDate": "ISO datetime string",
  "expectedDoneDate": "ISO datetime string",
  "durationText": "string",
  "totalHours": "number",
  "failedParameters": ["string"],
  "correctiveAction": "string",
  "attachments": [
    {
      "fileName": "string",
      "fileUrl": "string",
      "fileType": "string"
    }
  ]
}
```

หมายเหตุ:

- Frontend ตัดช่อง `เวลาเครื่องตรวจวัด` ออกจาก e-form กวภ.03 แล้ว
- ถ้า backend ยังต้องการ field เวลาเดิม ให้กำหนด contract ใหม่ให้ชัดเจนอีกครั้ง

## Payload กวภ.04

แบบ กวภ.04 ใช้โครงสร้างใกล้กับ กวภ.02:

```json
{
  "measurementItems": [
    {
      "pollutant": "string",
      "sampleDate": "ISO date/datetime string",
      "measuredValue": "string | number",
      "unit": "string",
      "laboratoryNo": "string",
      "reportNo": "string",
      "method": "string",
      "attachments": [
        {
          "fileName": "string",
          "fileUrl": "string",
          "fileType": "string"
        }
      ]
    }
  ]
}
```

หมายเหตุ:

- `method` ใช้ option mapping ชุดเดียวกับ กวภ.02

## Payload กวภ.05

แบบ กวภ.05 ควรมี payload เพิ่มจาก payload กลาง:

```json
{
  "businessActivity": "string",
  "samplerName": "string",
  "officerRegistration": "string",
  "laboratoryName": "string",
  "laboratoryRegistration": "string",
  "cemsDetail": "string",
  "reportRound": "string | number",
  "reportYear": "string | number",
  "calibrationItems": [
    {
      "parameter": "string",
      "startDate": "ISO date/datetime string",
      "endDate": "ISO date/datetime string",
      "result": "string",
      "cemsModel": "string",
      "rataReportLink": "string",
      "calibrationPhotoLink": "string",
      "attachments": [
        {
          "fileName": "string",
          "fileUrl": "string",
          "fileType": "string"
        }
      ]
    }
  ]
}
```

หมายเหตุ:

- Frontend ตัดช่อง `ยี่ห้อ (Brand)` ออกจาก e-form กวภ.05 แล้ว จึงไม่ควรบังคับ field `cemsBrand` ใน payload
- Frontend ตัดช่อง `บริษัทที่ทำการทวนสอบ / สอบเทียบ` ออกจาก dialog แล้ว จึงไม่ควรบังคับ field `calibrationItems[].verifierCompany`
- `calibrationItems[].cemsModel` ควรใช้ค่าจาก `cemsModel` ที่ backend เพิ่มใน response จุดตรวจวัด CEMS
