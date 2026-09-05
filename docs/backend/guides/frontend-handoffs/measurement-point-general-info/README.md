# ส่งต่อ frontend: ข้อมูลทั่วไปของโรงงานในฟอร์มแก้ไขจุดตรวจวัด

[กลับไป Backend Guides](../../README.md) · [เมนูข้อมูลพื้นฐาน](../../../api/menus/master-data/README.md)

ทีม frontend ใช้เอกสารนี้แก้ส่วน **ข้อมูลทั่วไปของโรงงาน** ภายในแบบฟอร์ม **แก้ไขข้อมูลจุดตรวจวัด** (`MEASUREMENT_POINTS`) ให้แก้ข้อมูลและส่งคำขอได้ครบ โดยข้อมูลจริงเปลี่ยนหลัง admin อนุมัติ

Backend ใน workspace ปรับรองรับแล้ว และผ่าน 205 tests พร้อม typecheck การทดสอบใช้ข้อมูลจำลองในเครื่อง ยังไม่ได้ยืนยันว่า backend รุ่นนี้ deploy ไปยัง environment ที่ frontend ใช้อยู่ ก่อนทดสอบร่วมกันให้ตรวจ schema `PomsFactoryEditableMeasurementPointsRequest` ใน OpenAPI ของ environment นั้นว่ามี 7 fields ด้านล่าง

เอกสารนี้เป็นคู่มือเชื่อมต่อและรายการตรวจรับ ส่วนชนิดข้อมูล ข้อจำกัด สิทธิ์ และ response ฉบับเต็มอ้างอิง [Factory edit requests](../../../api/menus/master-data/factory-edit-requests.md#measurement-point-fields) เพียงแห่งเดียว

## ผลลัพธ์ที่ต้องได้

เปิดให้แก้ข้อมูลทั่วไปต่อไปนี้ในคำขอ `MEASUREMENT_POINTS` และส่งที่ **root ของ JSON body**:

| รายการใน section ข้อมูลทั่วไป | Field |
| --- | --- |
| การประเมินผลกระทบสิ่งแวดล้อม | `eia` |
| ระบุเมื่อเลือก EIA เป็น “อื่นๆ” | `eiaOther` |
| ชื่อโครงการ | `projectName` |
| ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน | `factoryFrontPhotos` |
| สัญลักษณ์ของโรงงานหรือโลโก้บริษัท | `factoryLogo` |
| ละติจูด | `latitude` |
| ลองติจูด | `longitude` |

ชื่อโรงงาน เลขทะเบียน ประเภทโรงงาน การประกอบกิจการ และสถานที่ตั้งยังเป็นข้อมูลอ่านอย่างเดียว การแก้ section นี้ไม่ได้เปิดให้แก้ทุก field ที่อ่านจาก API ได้

แก้เฉพาะข้อมูลโรงงานได้โดยไม่ต้องเปลี่ยนค่าจุดตรวจวัด แต่ยังต้องส่ง `measurementPoints` อย่างน้อยหนึ่งรายการ พร้อม `connectedPointId` และ field ของจุดอย่างน้อยหนึ่ง field เช่น `pointName` ค่าเดิม หากไม่มีการเปลี่ยนแปลงทั้งสองส่วน API ตอบ `409 CONFLICT`

## สาเหตุและจุดที่ต้องแก้

ไฟล์หลัก: [`MasterDataPage.jsx`](../../../../../frontend/src/pages/MasterDataPage.jsx) และ [`ConnectionRequestPage.jsx`](../../../../../frontend/src/pages/ConnectionRequestPage.jsx)

| จุดในโค้ด | พฤติกรรมที่พบ | งาน frontend |
| --- | --- | --- |
| `RequestFormBottomSheet` ที่มี `titleOverride="แก้ไขข้อมูลจุดตรวจวัด"` | ส่ง `generalFactoryFieldsReadOnly` เป็น `true` | ปลดล็อกสำหรับผู้มีสิทธิ์ส่งคำขอในบริบทนี้ และคงโหมดอ่านอย่างเดียวสำหรับผู้ไม่มีสิทธิ์ |
| `buildMeasurementPointsPayload` | เลือกเฉพาะ `formType`, `measurementPoints`, `remarks` จึงตัดข้อมูลโรงงานออก | เพิ่ม 7 fields ตาม allowlist ที่ root ของ body พร้อมคง payload จุดเดิม |
| `handleSubmitMeasurementPoints` | รับเฉพาะ `requestBody` | ใช้ state การแก้ไข หรือรับ context argument ที่สองจาก `customSubmit` ซึ่งมี `formData` และ `uploadedDocuments` เพื่อแยก field ที่ไม่ส่งออกจาก field ที่ผู้ใช้ล้าง |
| `buildMeasurementPointRequestBody` | มี scalar fields โรงงานแล้ว แต่รูปแนบรวมใน `measurementPoints[].documentsAndImages` | แยกรูปโรงงานและโลโก้ออกเป็น `factoryFrontPhotos` / `factoryLogo` ใน payload สำหรับ API นี้ |
| `normalizeFactoryFormData` | หลาย field ใช้ `??` fallback ไปค่าโรงงานเดิม | อย่าให้ proposed value ที่เป็น `null` กลับกลายเป็นค่าเก่า ตรวจการมี field และรักษาความหมายของการล้างค่า |
| `makeMasterDataInitialRequest` | เส้นทาง `__fromFormEndpoint` คืนข้อมูลฟอร์มเดิม ส่วน fallback สร้าง object ใหม่และไม่ใส่ `eiaOther` / `projectName` | รักษาค่าทั้งสอง field และข้อมูลรูปในทุกเส้นทางที่ใช้จริง รวมการเปิดคำขอที่ส่งกลับ |

การปลด `generalFactoryFieldsReadOnly` อย่างเดียวทำให้พิมพ์ได้ แต่ข้อมูลยังหายก่อนส่ง API หากไม่แก้ตัวสร้าง payload ด้วย

## ลำดับการเชื่อมต่อ

| ขั้นตอน | API / งาน |
| --- | --- |
| รู้ว่ากำลังแก้จุดใด | อ่านรายละเอียดจาก `GET /api/v1/poms-factories/:factoryId` เพื่อเก็บ `measurementPoints[].connectedPointId` ของจุดที่เลือก |
| เปิดฟอร์มใหม่ | `GET /api/v1/poms-factories/:factoryId/form?formType=MEASUREMENT_POINTS&systemType=CEMS` ใช้ `WPMS` สำหรับจุดระบบน้ำ |
| อัปโหลดรูปใหม่ | `POST /api/v1/poms-factories/document-images` ส่ง multipart ทีละไฟล์ แล้วใช้ metadata ที่ API คืน |
| ส่งคำขอใหม่ | `POST /api/v1/poms-factories/:factoryId/edit-requests` สำเร็จด้วย `201` และสถานะ `PENDING_REVIEW` |
| เปิดคำขอที่ส่งกลับ | อ่าน detail จาก `GET /api/v1/poms-factories/edit-requests/:id` เพื่อเก็บ workflow/point IDs แล้วอ่าน `GET /api/v1/poms-factories/edit-requests/:id/form?systemType=CEMS` เพื่อลง proposed values |
| ส่งกลับเข้าพิจารณา | `PUT /api/v1/poms-factories/edit-requests/:id/resubmission` ใช้ body ชุดเดียวกัน สำเร็จด้วย `200` และสถานะ `REVISED_PENDING_REVIEW` |

ใช้ `submitFactoryEditRequest` เดิมได้ เพราะเลือก `POST` หรือ `PUT` จาก `__editRequestId` อยู่แล้ว ต้องรักษา marker นี้เมื่อ normalize หรือส่งต่อข้อมูลฟอร์ม

Form-prefill API ไม่คืน `connectedPointId` และ workflow ID จึงต้องเก็บ identity จาก detail แยกจากค่าที่นำไปกรอกฟอร์ม อย่าใช้ลำดับแถวเป็นตัวระบุจุดเมื่อกรอง CEMS/WPMS และอย่าใช้ `pointCode` แทน `connectedPointId`

เมื่อโรงงานมีทั้ง CEMS และ WPMS ต้องระบุ `systemType` ให้ตรงจุดที่เลือก ดูรายละเอียด [Form prefill](../../../api/menus/master-data/factory-edit-requests.md#get-apiv1poms-factoriesfactoryidform)

## สร้าง payload โดยรักษาค่าเดิม

1. เลือกเฉพาะ 7 fields ที่อนุญาต ห้าม spread `requestBody` หรือ prefill response ทั้ง object เพราะมี field อ่านอย่างเดียวและ field ของคำขอเชื่อมต่อที่ API นี้ไม่รับ
2. ไม่ส่ง field ที่ผู้ใช้ไม่ได้แก้ หรือส่งค่าเดิมที่โหลดมาครบแล้ว อย่าส่ง `null` / `[]` จากค่าเริ่มต้นที่ยังโหลดไม่เสร็จ
3. แปลงพิกัดเป็น JSON number และส่งคู่กัน `latitude` / `longitude` หากล้างให้ส่ง `null` ทั้งคู่; ค่า `0` เป็นค่าที่ถูกต้อง ไม่ใช่ค่าว่าง
4. เมื่อเลือก `eia = "อื่นๆ"` ต้องส่งข้อความ `eiaOther` หากเปลี่ยนไปค่าอื่นให้ล้างข้อความให้ตรงกับตัวเลือก อย่าเติมข้อความเก่าที่ไม่สัมพันธ์กับ EIA
5. การซ่อนช่อง `projectName` ไม่เท่ากับผู้ใช้ตั้งใจล้างชื่อโครงการ ต้องแยก field ที่ไม่อยู่ใน form ออกจากการกดล้างข้อมูล
6. ส่ง field ของจุดจาก allowlist เดิมเท่านั้น; ค่า `null`, `[]` และ omitted มีความหมายต่างกัน ห้ามใช้ `??` fallback ที่ทำให้การล้างข้อมูลกลับไปเป็นค่าเดิม

ตัวอย่างแก้ข้อมูลทั่วไป โดยไม่เปลี่ยนชื่อจุด (แทน `connectedPointId` และ `pointName` ด้วยจุดจริงของโรงงานที่เลือก):

```json
{
  "formType": "MEASUREMENT_POINTS",
  "eia": "อื่นๆ",
  "eiaOther": "รายงานเฉพาะโครงการ",
  "projectName": "โครงการปรับปรุงระบบตรวจวัด",
  "latitude": 13.1,
  "longitude": 100.1,
  "measurementPoints": [
    {
      "connectedPointId": 15,
      "pointName": "ปล่อง A"
    }
  ],
  "remarks": "แก้ไขข้อมูลทั่วไปของโรงงาน"
}
```

ตัวอย่างผู้ใช้ตั้งใจล้างชื่อโครงการ พิกัด และรูปโรงงานทั้งหมด:

```json
{
  "formType": "MEASUREMENT_POINTS",
  "projectName": null,
  "latitude": null,
  "longitude": null,
  "factoryFrontPhotos": [],
  "factoryLogo": null,
  "measurementPoints": [
    {
      "connectedPointId": 15,
      "pointName": "ปล่อง A"
    }
  ]
}
```

ตัวอย่างนี้เป็นการล้างโดยตั้งใจ ไม่ใช้เป็น default payload เมื่อ field ยังโหลดไม่ครบ เงื่อนไขทั้งหมดดู [Measurement-point Fields](../../../api/menus/master-data/factory-edit-requests.md#measurement-point-fields)

## รูปโรงงานและโลโก้

Form-prefill รวมรูปโรงงานไว้ใน `measurementPoints[0].documentsAndImages` โดยใช้ชื่อกลุ่ม:

| `title` ที่ใช้ในฟอร์ม | Field ที่ต้องส่งกลับ |
| --- | --- |
| `ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน` | `factoryFrontPhotos` เป็น array |
| `สัญลักษณ์ของโรงงานหรือโลโก้บริษัท` | `factoryLogo` เป็น object เดียว หรือ `null` |

- รักษารูปเดิมที่ยังไม่ได้ลบ และรวม metadata รูปใหม่หลัง upload สำเร็จแล้ว อย่าใช้เฉพาะ `uploadedDocuments` เพราะไม่มีรายการรูปเดิม
- ใช้ผลรวมหลังประมวลผลการเพิ่มและลบรูป ไม่ใช้รายการ preview ก่อนลบ ส่ง `factoryFrontPhotos: []` / `factoryLogo: null` เมื่อผู้ใช้ล้างจริง
- แยกรูปของโรงงานออกจากเอกสารของจุดก่อนสร้าง payload อย่าส่งการแก้รูปโรงงานไว้เฉพาะ `measurementPoints[].documentsAndImages` เพราะไม่อัปเดตข้อมูลทั่วไปของโรงงาน
- ใช้ `sanitizeDocumentItem` / `sanitizeDocuments` เพื่อส่ง metadata ตาม contract และคง `fileUrl` ที่ API คืน ห้ามส่ง `File`, `blob:` URL หรือ `filePreviewUrl` เป็นไฟล์บันทึกจริง
- ตรวจ `title` ของรูปจากข้อมูลเก่าหรือ upload ให้ตรงกลุ่มที่ UI ใช้ หากมี `factoryFrontPhotos` / `factoryLogo` จาก detail อยู่แล้ว ให้ใช้ข้อมูลนั้นร่วมในการจัดหมวด ไม่ตัดรูปที่ผู้ใช้ยังไม่ได้ลบทิ้งเพียงเพราะชื่อกลุ่มต่างกัน

Upload constraints และ metadata fields ดู [Document images upload](../../../api/menus/master-data/factory-edit-requests.md#post-apiv1poms-factoriesdocument-images)

## การแสดงผลหลังส่งและข้อผิดพลาด

หลังสร้างคำขอหรือ resubmit ให้แสดงว่า **ส่งคำขอแก้ไขสำเร็จ** ข้อมูลจริงยังไม่เปลี่ยนทันที ส่วนหน้ารายละเอียดคำขอและหน้าพิจารณาต้องแสดง proposed factory values ควบคู่กับ proposed measurement points ให้ตรวจสอบก่อนอนุมัติ

เมื่ออนุมัติคำขอที่แก้ข้อมูลทั่วไป backend บันทึกข้อมูลโรงงานและจุดตรวจวัดใน transaction เดียวกัน ข้อมูลโรงงานที่เกี่ยวข้อง sync ไปข้อมูล POMS และโรงงานที่เข้าข่ายตาม mapping เดิม หากส่วนใดล้มเหลวให้ยกเลิกทั้ง transaction

| ผลตอบกลับ | การแสดงผลและการทำงานของ frontend |
| --- | --- |
| `400 VALIDATION_ERROR` | แสดงข้อความและรายละเอียด field จาก `error`; คงฟอร์มที่กรอกไว้ให้แก้ไข |
| `401` / `403` | จัดการ session หรือสิทธิ์ตาม flow ของระบบ |
| `404 NOT_FOUND` | แจ้งว่าไม่พบข้อมูลหรือเข้าถึงไม่ได้ ไม่เลือกจุดอื่นแทนโดยอัตโนมัติ |
| `409 CONFLICT` | อ่านข้อความจริงจาก API เพราะอาจเกิดจากไม่มีข้อมูลเปลี่ยน มีคำขอเปิดอยู่ สถานะไม่อนุญาต หรือข้อมูลเปลี่ยนระหว่างรอพิจารณา; ให้โหลดสถานะล่าสุดและคงข้อมูลที่ผู้ใช้กรอกไว้ก่อนตัดสินใจ ไม่ retry บันทึกทับโดยอัตโนมัติ |
| Upload ล้มเหลว | แสดงข้อผิดพลาดและไม่แจ้งว่าส่งคำขอสำเร็จ |

Error contract ฉบับเต็ม: [Factory edit requests](../../../api/menus/master-data/factory-edit-requests.md)

## รายการตรวจรับ frontend

- [ ] ผู้มีสิทธิ์ส่งคำขอแก้ 7 fields ได้ ส่วนชื่อโรงงาน ทะเบียน และที่อยู่ยังอ่านอย่างเดียว
- [ ] ทดสอบทั้ง CEMS และ WPMS โดย `connectedPointId` ตรงกับจุดที่เลือก และระบุ `systemType` ถูกต้องเมื่อโรงงานมีทั้งสองระบบ
- [ ] เปลี่ยนเฉพาะชื่อโครงการหรือพิกัด แล้วส่งคำขอได้โดยไม่จำเป็นต้องแก้ค่าจุด
- [ ] แก้ข้อมูลโรงงานและจุดพร้อมกัน แล้ว request detail แสดง proposed values ครบทั้งสองส่วน
- [ ] ไม่เปลี่ยนอะไรเลยแล้วได้รับข้อความไม่มีข้อมูลเปลี่ยน ไม่แสดง success เท็จ
- [ ] เลือก EIA “อื่นๆ” และกรอกข้อความ; เปลี่ยนตัวเลือกกลับ; ซ่อนชื่อโครงการแล้วไม่ล้างค่าโดยไม่ได้ตั้งใจ
- [ ] เพิ่มรูป ลบบางรูป ล้างรูปทั้งหมด เปลี่ยนโลโก้ และล้างโลโก้; scalar-only edit ไม่ทำให้รูปเดิมหาย
- [ ] ค่าพิกัด `0` บันทึกได้; พิกัดไม่ครบคู่และค่านอกช่วงแสดงข้อผิดพลาด; ล้างพิกัดเป็น `null` ทั้งคู่ได้
- [ ] หลัง `REQUEST_REVISION` เปิดฟอร์มจาก request-form API แล้วเห็นค่าที่เสนอไว้ รวม `null` / รูปที่ลบไป โดยไม่มีค่าเก่ากลับมาจาก fallback
- [ ] Resubmit ใช้ `PUT` ไปยัง request ID เดิม และใช้ `formType: "MEASUREMENT_POINTS"` เดิม
- [ ] หลังสร้างคำขอแต่ก่อนอนุมัติ ข้อมูล current/live ยังเป็นค่าเดิม; หลัง admin อนุมัติจึงแสดงค่าที่แก้
- [ ] กรณี API คืน validation, permission หรือ conflict error ข้อมูลในฟอร์มยังอยู่และผู้ใช้เข้าใจสาเหตุ

เกณฑ์เสร็จ: UI แก้ได้, payload มี fields ที่ผู้ใช้แก้ครบ, proposed values เปิดกลับได้ และหลังอนุมัติอ่านข้อมูลจริงกลับได้ถูกต้อง
