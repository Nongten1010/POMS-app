# ส่งต่อ Frontend: ข้อมูลนิคมในหน้าขอเชื่อมต่อ

[กลับไป Backend Guides](../../README.md) · [เมนูขอเชื่อมต่อ](../../../api/menus/connection-requests/README.md)

เอกสารนี้เป็นคู่มือสำหรับทีม Frontend และ QA ในการเพิ่มข้อมูลนิคมอุตสาหกรรมในฟอร์มขอเชื่อมต่อ CEMS/WPMS โดยใช้ API ที่มีอยู่แล้ว ครอบคลุมการเลือกโรงงาน เปิดคำขอเดิม ส่งแบบฟอร์ม พรีวิว และ PDF

**สถานะงาน:** ตรวจโค้ดและเส้นทางข้อมูลแล้ว ยังไม่ได้แก้ application code เอกสารนี้ระบุงานที่จะทำและเกณฑ์ตรวจรับ ไม่ใช่หลักฐานว่างานพัฒนาเสร็จแล้ว

## อ่านและใช้เอกสารนี้อย่างไร

1. อ่านขอบเขตและรูปแบบหน้าจอ เพื่อเข้าใจผลลัพธ์ที่ต้องการ
2. ใช้ตารางแหล่งข้อมูลเลือกค่าที่ถูกต้องสำหรับแต่ละ flow
3. แก้เฉพาะจุดที่เกี่ยวข้องตามตารางไฟล์ โดยรักษา `null` และ snapshot
4. ตรวจ Network payload พรีวิว และ PDF ด้วยรายการตรวจรับท้ายเอกสาร

API contract ฉบับเต็มอยู่ที่ [Payload และ validation](../../../api/menus/connection-requests/request-payloads-and-validation.md), [ฟอร์มและการอ่านคำขอ](../../../api/menus/connection-requests/README.md#connection-request-form-prefill) และ [โหลดคำขอก่อนหน้า](../../../api/menus/connection-requests/previous-request.md) เอกสารนี้ใช้ประกอบการลงมือ ไม่แทน contract เหล่านั้น

## ขอบเขตงาน

- แก้ Frontend เพื่อรักษาและแสดง `industrialEstateCode` / `industrialEstateName` ที่ Backend รองรับอยู่แล้ว
- เก็บ `industrialAreaType` / `industrialAreaTypeLabel` เมื่อแหล่งข้อมูลคืนมา เพื่อใช้แสดงผลเท่านั้น
- ครอบคลุมฟอร์ม CEMS และ WPMS ทั้งผู้ประกอบการและเจ้าหน้าที่ รวมการส่งกลับแก้ไขผ่าน `PUT /:id/form`
- ใช้ endpoint และ permission เดิม ไม่เพิ่ม endpoint หรือสร้าง flow `NEW_CONNECTION` ใหม่
- ไม่แก้ Backend, schema, workflow การอนุมัติ หรือหน้าจออื่นที่ไม่เกี่ยวข้อง

คำว่า **snapshot** ในเอกสารนี้หมายถึงข้อมูลที่บันทึกไว้ในคำขอต้นทาง ส่วน **ข้อมูลปัจจุบัน** หมายถึงข้อมูลโรงงานหรือจุดตรวจวัดที่ API ปัจจุบันคืนมา ทั้งสองแหล่งอาจมีค่าไม่ตรงกัน

## ผลลัพธ์บนหน้าจอ

แนวทางแสดงผลของงานนี้คือเพิ่มสามรายการในส่วน **ข้อมูลทั่วไปของโรงงาน** และให้ทั้งหมดเป็นข้อมูลอ่านอย่างเดียว:

| รายการ | ค่าที่แสดง | ส่งใน write payload หรือไม่ |
| --- | --- | --- |
| พื้นที่ประกอบกิจการ | ในนิคมอุตสาหกรรม / นอกนิคมอุตสาหกรรม / ไม่ระบุ | ไม่ส่ง `industrialAreaType` และ `industrialAreaTypeLabel` |
| รหัสนิคมอุตสาหกรรม | `industrialEstateCode`; ไม่มีค่าแสดง `—` | ส่ง code หรือ `null` ตามแหล่งข้อมูล |
| ชื่อนิคมอุตสาหกรรม | `industrialEstateName`; ไม่มีค่าแสดง `—` | ส่ง name หรือ `null` ตามแหล่งข้อมูล |

ผู้ใช้ไม่แก้ข้อมูลนิคมจากคำขอเชื่อมต่อ หากต้องเปลี่ยนข้อมูลต้นทางให้ใช้กระบวนการแก้ข้อมูลโรงงานที่มีอยู่

ตัวอย่างเมื่อมีข้อมูล:

```text
พื้นที่ประกอบกิจการ: ในนิคมอุตสาหกรรม
รหัสนิคมอุตสาหกรรม: IEAT001
ชื่อนิคมอุตสาหกรรม: นิคมอุตสาหกรรมมาบตาพุด
```

### กติกาแสดงใน/นอกนิคม

1. ใช้ `industrialAreaType` และ label ที่สอดคล้องกันจากแหล่งข้อมูลเดียวกับ code/name เมื่อมีข้อมูลยืนยัน เช่น `INDUSTRIAL_ESTATE` หรือ `OUTSIDE_INDUSTRIAL_ESTATE`
2. เมื่อ snapshot ไม่มีข้อมูลประเภทพื้นที่ แต่มี code หรือ name ให้แสดงว่าอยู่ในนิคมได้ ไม่ตัดสินจาก code เพียงอย่างเดียว
3. เมื่อไม่มีทั้งข้อมูลประเภทพื้นที่และ code/name ให้แสดง **ไม่ระบุ** แทนการสรุปเองว่าอยู่นอกนิคม
4. โรงงานนอกนิคมที่ API ยืนยันประเภทพื้นที่แล้วให้แสดง **นอกนิคมอุตสาหกรรม** ส่วน code/name คงค่าจากต้นทาง หากเป็น `null` ให้แสดง `—`
5. ไม่ล้างหรือเปลี่ยน code/name เพียงเพราะประเภทพื้นที่เป็นนอกนิคม และไม่ใช้ป้ายจากข้อมูลปัจจุบันประกอบ snapshot เก่า

## แหล่งข้อมูลของแต่ละ flow

Paths ในตารางมี prefix `/api/v1` ใช้ authentication และ permission ตาม [เมนูขอเชื่อมต่อ](../../../api/menus/connection-requests/README.md)

| การใช้งาน | แหล่งข้อมูล | หลักการเลือกค่า |
| --- | --- | --- |
| เลือกโรงงานของผู้ประกอบการ | `GET /cems-wpms-requests/operator-factories` | ตัว map ต้องเก็บ code/name และประเภทพื้นที่เมื่อมี |
| เลือกโรงงานของเจ้าหน้าที่ | `GET /cems-wpms-requests/eligible-factories` | ใช้ตัว map เดียวกัน จึงต้องรองรับทั้งสองแหล่ง |
| สร้างคำขอเพิ่มจุดและพบคำขอก่อนหน้า | `GET /cems-wpms-requests/factories/:factoryId/previous-request` | ใช้ code/name จาก `data.formData` ของคำขอต้นทาง รวม `null`; ป้ายพื้นที่ต้องอิงชุดข้อมูลนี้ |
| สร้างคำขอเพิ่มจุดและไม่พบคำขอก่อนหน้า | endpoint เดิมคืน `hasPreviousRequest: false` | ใช้ข้อมูลโรงงานที่เลือกตามพฤติกรรม Frontend ปัจจุบัน |
| สร้างคำขอเพิ่มพารามิเตอร์ | `GET /connected-measurement-points/:stationId/parameter-form` | ใช้ค่าจาก `formDefaults` ตาม contract ของ prefill ปัจจุบัน และรักษา `null` |
| เปิดคำขอเดิมเพื่อดูหรือแก้ไข | `GET /cems-wpms-requests/:id/detail` ในโค้ดปัจจุบัน | ใช้ snapshot ของคำขอนั้น ไม่ดึงข้อมูลปัจจุบันมาทับ |
| ส่งคำขอเดิมกลับเข้าพิจารณา | `PUT /cems-wpms-requests/:id/form` | ส่ง code/name จาก snapshot ที่เปิดแก้ไข |

การเริ่มคำขอเพิ่มพารามิเตอร์จาก prefill ปัจจุบันและการเปิดแก้คำขอเพิ่มพารามิเตอร์เดิมเป็นคนละกรณี: กรณีหลังต้องรักษา snapshot ของคำขอที่กำลังแก้

### ประเภทคำขอและ endpoint ที่ส่ง

| Flow ที่มีอยู่ใน Frontend | Endpoint |
| --- | --- |
| สร้างคำขอเพิ่มจุดทั่วไป | `POST /cems-wpms-requests/measurement-points` |
| สร้างคำขอเพิ่มพารามิเตอร์ | `POST /cems-wpms-requests/parameters` |
| เพิ่มจุดโดยเจ้าหน้าที่แบบ direct connection | `POST /cems-wpms-requests/direct-connections` |
| แก้ไขและส่งกลับ | `PUT /cems-wpms-requests/:id/form` |

โค้ดหน้าปัจจุบันยังไม่มี flow สร้าง `NEW_CONNECTION` แยกต่างหาก จึงไม่เพิ่ม endpoint หรือเปลี่ยนวิธีเลือกประเภทคำขอในงานนี้ แต่เมื่อเปิดคำขอเดิมชนิด `NEW_CONNECTION`, `ADD_MEASUREMENT_POINT` หรือ `ADD_PARAMETER` ต้องรักษาข้อมูลนิคมเหมือนกัน

รายละเอียดของ direct connection และการส่งฟอร์มเจ้าหน้าที่ดู [Payload และ validation](../../../api/menus/connection-requests/request-payloads-and-validation.md) และ [ส่งฟอร์มเพิ่มจุดโดยเจ้าหน้าที่](../../../api/menus/connection-requests/officer-add-point-submission.md)

## จุดที่ต้องแก้ใน Frontend

| ไฟล์ / ฟังก์ชัน | สิ่งที่พบ | งานที่ต้องทำ |
| --- | --- | --- |
| [`ConnectionRequestPage.jsx`](../../../../../frontend/src/pages/ConnectionRequestPage.jsx): `mapOperatorFactoryRow()` | ปัจจุบันไม่เก็บข้อมูลนิคมทั้งสี่ field | เก็บ code/name โดยรักษา `null`; เก็บประเภทพื้นที่และ label เมื่อมี |
| ไฟล์เดียวกัน: `mapRequestDetailRow()` | `...detail` เก็บ field ระดับบนอยู่แล้ว | ตรวจว่าข้อมูลจากระดับบนและ `detail.factory` ส่งต่อได้ครบ ไม่ต้องเขียน map ซ้ำหากไม่จำเป็น |
| ไฟล์เดียวกัน: `getInitialRequestFactory()` | ยังไม่เลือก code/name จาก request ระดับบนโดยตรง จึงอาจใช้ fallback แทน snapshot | เลือกค่าจาก snapshot ก่อน และรักษา explicit `null` |
| ไฟล์เดียวกัน: `getParameterFormDefaultsFromPayload()` | ใช้ `compactDefinedObject()` ซึ่งกรอง `null` ออก | รักษา `null` ของ code/name เฉพาะเส้นทางนี้ ไม่เปลี่ยนกติกาของทุก field โดยไม่จำเป็น |
| ไฟล์เดียวกัน: `RequestFormBottomSheet` | ข้อมูลทั่วไปยังไม่มีช่องนิคม | เพิ่มสามรายการแบบอ่านอย่างเดียวให้ใช้แหล่งข้อมูลของ flow ที่เปิดอยู่ |
| ไฟล์เดียวกัน: `buildMeasurementPointRequestBody()` | ยังไม่ส่ง code/name | เพิ่มสอง field ระดับบนจาก `formFactory`; ครอบคลุมทั้งการสร้างพรีวิวและการส่งจริง |
| [`previousConnectionRequest.mjs`](../../../../../frontend/src/utils/previousConnectionRequest.mjs): `buildPreviousConnectionRequestPrefill()` | เก็บ code/name จาก snapshot แล้ว แต่ประเภทพื้นที่จากโรงงานปัจจุบันอาจติดมาด้วย | รักษาการคัดลอก code/name เดิม และไม่ให้ป้ายพื้นที่ปัจจุบันขัดกับ snapshot |
| [`connectionRequestPdf.js`](../../../../../frontend/src/utils/connectionRequestPdf.js) | ยังอ่าน `industrialEstate` | เปลี่ยนการอ่านเป็น `industrialEstateName` และแสดง code ประกอบเมื่อมี โดยใช้แหล่งข้อมูลเดียวกับฟอร์ม |

### รักษา `null` ให้ถูกต้อง

- แยก **มี field และค่าเป็น `null`** ออกจาก **ไม่มี field**: `null` ของ snapshot ไม่ใช่คำสั่งให้ไปหยิบค่าปัจจุบัน
- เลือกค่าระดับบนของ request ก่อน หากไม่มี field จึงดู snapshot ใน `request.factory` ตาม shape ที่ API คืนมา
- สำหรับคำขอเดิม หาก snapshot ไม่มีข้อมูลนิคมจริง ให้แสดงว่าไม่มีข้อมูล และส่ง `null` ตาม contract แทนการเติมค่าจากโรงงานปัจจุบัน
- หลีกเลี่ยง `snapshotValue ?? currentValue` และ `snapshotValue || currentValue` ในจุดที่ต้องรักษา `null`; ตรวจว่ามี property ก่อนเลือกแหล่งข้อมูล
- เปลี่ยนเฉพาะการเลือกข้อมูลนิคม ไม่ปรับกติกา fallback ของข้อมูลโรงงานอื่นทั้งชุด

## Payload ที่ต้องส่ง

ตัวอย่างต่อไปนี้เป็น **ส่วนที่เพิ่มใน payload เดิม** ไม่ใช่ request body ที่ครบทุก field:

```json
{
  "industrialEstateCode": "IEAT001",
  "industrialEstateName": "นิคมอุตสาหกรรมมาบตาพุด"
}
```

เมื่อค่าจากแหล่งข้อมูลเป็น `null`:

```json
{
  "industrialEstateCode": null,
  "industrialEstateName": null
}
```

ส่งทั้งสอง field ในระดับบนของ body โดยไม่ย้ายไปไว้ใน `measurementPoints` และไม่ส่ง `industrialAreaType`, `industrialAreaTypeLabel` หรือ field เก่า `industrialEstate` เพิ่มเข้า API ให้ประกอบ body จาก field ที่อนุญาต ไม่ spread ข้อมูลสำหรับแสดงผลทั้งหมดลง payload

ใช้ validation และข้อจำกัด code/name ที่กำหนดไว้ใน [Shared Request Fields](../../../api/menus/connection-requests/request-payloads-and-validation.md) ไม่เพิ่มเงื่อนไขบังคับข้อมูลนิคมสำหรับโรงงานนอกนิคมหรือคำขอเก่า

## พรีวิวและ PDF

- ก่อนส่ง: พรีวิวกับ payload จริงต้องได้ code/name จาก `formFactory` ชุดเดียวกัน
- หลังส่งหรือเปิดคำขอเดิม: พรีวิวกับ PDF ต้องใช้ snapshot ของคำขอที่เลือก รวมค่าที่เป็น `null`
- เปลี่ยนการอ่าน `industrialEstate` เป็น `industrialEstateName`; เมื่อมีชื่อและรหัสให้แสดง `นิคมอุตสาหกรรมมาบตาพุด (IEAT001)` เมื่อมีเฉพาะชื่อให้แสดงชื่อ และเมื่อมีเฉพาะรหัสให้แสดงรหัส
- เมื่อไม่มี code/name ให้แสดง `—` ไม่เติมข้อมูลจากโรงงานปัจจุบัน
- ข้อมูลประเภทพื้นที่ที่ใช้แสดงผลให้เก็บแยกจาก write payload หากพรีวิวต้องใช้ label เพิ่ม ต้องไม่ทำให้ label หลุดไปใน POST/PUT

## ผลกระทบต่อฟอร์มร่วม

[`MasterDataPage.jsx`](../../../../../frontend/src/pages/MasterDataPage.jsx) ใช้ `RequestFormBottomSheet` ร่วมกันทั้งฟอร์มและการเปิดดูข้อมูล จึงต้องตรวจผลกระทบจากการเพิ่มช่องและปรับตัวสร้าง payload

ตรวจว่า `customSubmit` ยังคงประกอบ payload ตาม allowlist ของเมนูข้อมูลพื้นฐาน ไม่เพิ่ม field นิคมจาก shared form โดยอัตโนมัติ และพรีวิวเดิมยังเปิดได้ งานนี้ไม่รวมการเปลี่ยน contract หรือ workflow ของเมนูข้อมูลพื้นฐาน

## รายการตรวจรับของ Frontend และ QA

ทดสอบข้อมูลสมมติอย่างน้อยสี่ชุด: มี code+name, มี name แต่ไม่มี code, นอกนิคมที่ API ยืนยันและ code/name เป็น `null`, และ snapshot เก่าที่ไม่มีข้อมูลประเภทพื้นที่

- [ ] รายชื่อโรงงานของผู้ประกอบการและเจ้าหน้าที่รักษา code/name และประเภทพื้นที่เมื่อมี
- [ ] ช่องทั้งสามแสดงแบบอ่านอย่างเดียวใน CEMS และ WPMS
- [ ] โรงงานที่มีชื่อแต่ไม่มีรหัสไม่ถูกแสดงเป็นนอกนิคมเพราะตรวจ code อย่างเดียว
- [ ] โรงงานนอกนิคมที่มีข้อมูลยืนยันแสดงถูกต้อง และกรณีข้อมูลไม่พอแสดง “ไม่ระบุ”
- [ ] Payload ของ `/measurement-points`, `/parameters`, `/direct-connections` และ `PUT /:id/form` ส่ง code/name ครบ ตาม flow ที่ใช้ได้จริง
- [ ] Network payload ไม่มี `industrialAreaType`, `industrialAreaTypeLabel` หรือ `industrialEstate`
- [ ] เปิด snapshot A ขณะที่ข้อมูลปัจจุบันเป็น B แล้วฟอร์ม พรีวิว PDF และ resubmit ยังเป็น A
- [ ] Snapshot เป็น `null` แต่ข้อมูลปัจจุบันมีนิคมแล้ว ค่าในฟอร์มและ payload ยังคงเป็น `null`
- [ ] เปิดคำขอเดิมทั้งสามประเภทแล้วค่าระดับบนและค่าภายใน `factory` ไม่หายระหว่าง map
- [ ] `parameter-form` คืน `formDefaults` ที่ code/name เป็น `null` แล้วไม่ถูกกรองหรือเติมค่าจาก fallback
- [ ] คัดลอกคำขอก่อนหน้าแล้ว code/name และป้ายพื้นที่ไม่มาจากคนละช่วงเวลา
- [ ] กรณีไม่พบคำขอก่อนหน้าใช้ข้อมูลโรงงานที่เลือก; กรณีโหลด API ไม่สำเร็จยังแสดงข้อผิดพลาดตามพฤติกรรมเดิม
- [ ] พรีวิวก่อนส่ง พรีวิวคำขอเดิม และ PDF แสดงชื่อ/รหัสตรงกับแหล่งข้อมูลที่กำหนด
- [ ] ฟอร์มและพรีวิวที่ `MasterDataPage.jsx` ใช้ร่วมกันยังทำงาน และ write payload ของเมนูนั้นอยู่ใน allowlist เดิม

### การตรวจอัตโนมัติที่เกี่ยวข้อง

เพิ่มกรณีนิคมในชุดทดสอบเดิมหรือไฟล์ทดสอบ Frontend ที่เจาะจง โดยทดสอบฟังก์ชันจริงและเส้นทางข้อมูล ไม่ตรวจเพียงว่ามีข้อความชื่อ field ใน source code

ชุดทดสอบเดิมที่เกี่ยวข้อง:

- [`previousConnectionRequest.test.mjs`](../../../../../frontend/src/utils/previousConnectionRequest.test.mjs)
- [`addParameterForm.integration.test.mjs`](../../../../../frontend/src/utils/addParameterForm.integration.test.mjs)

คำสั่งรันเฉพาะชุดเดิมจาก repository root:

```bash
cd frontend
node --test src/utils/previousConnectionRequest.test.mjs src/utils/addParameterForm.integration.test.mjs
```

หลังเพิ่มกรณีทดสอบใหม่ให้รันไฟล์นั้นด้วย และตรวจ build ของ Frontend:

```bash
npm run build
```

ตอนตรวจเพื่อจัดทำเอกสาร ชุดเดิมผ่าน 19 tests และการเรียกฟังก์ชันจริงด้วยข้อมูลจำลองยืนยันว่า mapper/payload ทำข้อมูลนิคมหาย, initial factory อาจเลือก fallback แทน snapshot, `formDefaults` ทำ `null` หาย และ prefill คำขอก่อนหน้าอาจติดป้ายพื้นที่ปัจจุบันมา ผลนี้ยังไม่ใช่การทดสอบ API จริงหรือการตรวจหน้าจอครบ flow; ชุดทดสอบเดิมมีข้อความแจ้งเปิด WebSocket ไม่ได้ในสภาพแวดล้อมจำกัด แต่ tests จบสำเร็จ

ก่อนส่งมอบให้ตรวจ diff ว่าเปลี่ยนเฉพาะ Frontend ที่เกี่ยวข้องและเอกสารที่ได้รับอนุญาต พร้อมสรุปผลรายการตรวจรับที่ทำได้จริง
