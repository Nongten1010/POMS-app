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
