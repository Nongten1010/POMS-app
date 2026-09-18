# Frontend Handoff: ข้อมูลสรุปรายการคำขอแก้ไขข้อมูลพื้นฐาน

สถานะ: รอ backend ยืนยันและรองรับ response ใหม่ จากนั้น frontend จึงปรับการอ่านข้อมูลตาราง

เอกสารนี้บันทึกความต้องการจาก frontend ไม่ใช่ API contract ที่ยืนยันว่ารองรับแล้ว รอบนี้สร้างเฉพาะเอกสาร ไม่ได้แก้โค้ด frontend/backend และไม่รวมงาน DCON

สัญญา API ที่ backend ดูแลอยู่ที่ [โรงงานและคำขอแก้ไขข้อมูลในระบบ POMS](../../docs/backend/api/menus/master-data/factory-edit-requests.md) ให้ยืนยันรูปแบบสุดท้ายในเอกสาร canonical และ OpenAPI โดยไม่ใช้ handoff นี้แทนสัญญา API

## วัตถุประสงค์

แยกข้อมูลสำหรับตารางออกจากรายละเอียดคำขอ เพื่อลดข้อมูลที่ไม่จำเป็นใน list response และให้ตารางแสดงจุดตรวจวัดที่คำขอนั้นเกี่ยวข้องได้ถูกต้อง โดยไม่ต้องโหลด detail เพิ่มทีละแถวหรือให้ frontend เดาจุดเป้าหมายจาก snapshots

ปุ่มเปิดดูและดำเนินการเรียก API รายละเอียดอีกครั้งอยู่แล้ว จึงไม่จำเป็นต้องส่งข้อมูลรายละเอียดทั้งหมดมากับรายการ

## ปัญหาที่พบ

คำขอ `point-00024/2569` (`id: 48`) ของโรงงาน `91090100125393` ส่ง `connectedPointId: 10021` ซึ่งเป็น **CEMS / S0915** ถูกต้อง แต่ response รายการคำขอมี snapshot ของทั้งโรงงาน โดยเรียงจุดดังนี้:

| ลำดับ | connectedPointId | systemType | pointCode | ผลเทียบ current/proposed |
| --- | --- | --- | --- | --- |
| 1 | 10024 | WPMS | P0155 | ไม่เปลี่ยน |
| 2 | 10021 | CEMS | S0915 | มีข้อมูลเปลี่ยน |

Frontend ปัจจุบันอ่าน `proposedMeasurementPoints[0]` หรือ `currentMeasurementPoints[0]` จึงแสดง WPMS / P0155 ผิด ทั้งที่คำขอรอบนี้มีเป้าหมายเป็น CEMS / S0915 ปัญหานี้เป็นคนละส่วนกับการเลือก ID ตอนส่งคำขอที่แก้แล้ว

## API รายการที่ต้องปรับ

`GET /api/v1/poms-factories/edit-requests`

คืนข้อมูลสรุปสำหรับตาราง โดยหนึ่งรายการยังหมายถึงหนึ่งคำขอ ไม่แตกเป็นหลายแถวตามจำนวนจุด คง query filters, permissions, data scope, response envelope และ `meta.total` เดิม

### ข้อมูลที่ Frontend ต้องใช้

| Field ที่เสนอ | การใช้งาน |
| --- | --- |
| `id` | ID คำขอสำหรับเปิดดู ดำเนินการ แก้ไข และยกเลิก |
| `requestNo` | เลขที่คำขอ |
| `factoryId` | เลขทะเบียนโรงงานใหม่สำหรับคอลัมน์เลขทะเบียน ไม่ใช้เลขทะเบียนเดิมแทน |
| `factoryName` | ชื่อโรงงาน/บริษัท |
| `provinceName` | จังหวัด โดยไม่ต้องเรียก API โรงงานเพิ่ม |
| `formType` | `BASIC_INFO` หรือ `MEASUREMENT_POINTS` สำหรับแสดงชื่อแบบฟอร์ม |
| `status` | รหัสสถานะสำหรับเงื่อนไขปุ่มเดิม |
| `statusLabel` | ข้อความสถานะสำหรับแสดงผล |
| `submittedAt` | ISO 8601; frontend แสดงเฉพาะวันที่เป็นปี พ.ศ. |
| `targetMeasurementPoints` | array ข้อมูลสรุปจุดเป้าหมายของคำขอ ไม่ใช่ทุกจุดในโรงงาน |
| `targetMeasurementPoints[].connectedPointId` | ID จุดตรวจวัดใน POMS ที่คำขออ้างถึง ไม่ใช้ `sourceMeasurementPointId` แทน |
| `targetMeasurementPoints[].systemType` | `CEMS` หรือ `WPMS` ของจุดเป้าหมายนั้น |
| `targetMeasurementPoints[].pointCode` | รหัสจุดตรวจวัด; รองรับ `null` โดยแสดง `-` ไม่สร้างรหัสจำลอง |
| `targetMeasurementPoints[].pointName` | ชื่อจุดตรวจวัดสำหรับแสดงผล ไม่ใช้เป็นตัวจับคู่ |

`targetMeasurementPoints` เป็นชื่อเสนอเพื่อให้แยกจาก current/proposed snapshots ชัดเจน ต้องให้ backend ยืนยันชื่อ field, type และ nullability ใน canonical docs ก่อน frontend เชื่อมต่อ

### กติกาจุดเป้าหมาย

1. ระบุเป้าหมายจาก `measurementPoints[].connectedPointId` ที่ส่งใน create/resubmission ไม่เลือกจุดแรกของโรงงาน
2. ไม่ใช้ชื่อ รหัสจุด หรือลำดับ array เป็นตัวตนของจุด และไม่ให้ frontend เปรียบเทียบ snapshots เพื่อเดาว่าผู้ใช้เลือกจุดไหน
3. แม้ส่งค่าเดิมหรือแก้เฉพาะอีเมล/ข้อมูลติดต่อ ต้องยังระบุจุดที่ส่งมากับคำขอได้
4. เมื่อมีหลายจุดเป้าหมาย ให้คืนครบใน array ไม่ตัดเหลือจุดแรก และไม่รวมจุดอื่นที่ไม่ได้อยู่ในคำขอ
5. ข้อมูลสรุปต้องสอดคล้องกับคำขอและรอบแก้ไขนั้น ไม่สลับเป้าหมายตามลำดับหรือข้อมูลโรงงานปัจจุบันที่เปลี่ยนภายหลัง
6. `BASIC_INFO` ไม่เลือกจุดรายจุด ให้คืน `targetMeasurementPoints: []` และ frontend แสดงประเภท/รหัสจุดเป็น `-`
7. คำขอเก่าที่ไม่มีหลักฐานจุดเป้าหมาย ให้ backend ประเมินข้อมูลที่มีและกำหนดพฤติกรรมกรณีระบุไม่ได้ใน canonical docs ห้ามเลือกจุดแรกหรือแต่ง ID แทน

### ข้อมูลที่ไม่ต้องส่งใน List

- `currentFactory`, `proposedFactory`
- `currentMeasurementPoints`, `proposedMeasurementPoints` และรายละเอียดจุดทั้งหมดของโรงงาน
- `currentContacts`, `proposedContacts`, ผู้ติดต่อและอีเมลแบบเต็ม
- รายละเอียดเครื่องมือตรวจวัด เอกสาร/รูปภาพ และ `events`

ตัดเฉพาะข้อมูลขนาดใหญ่ที่ไม่ใช้ในตารางออกจาก list ไม่ใช่ลบข้อมูลเหล่านี้จากคำขอหรือ API รายละเอียด

### ตัวอย่างเฉพาะจุดเป้าหมายของเคสที่พบ

ตัวอย่างนี้แสดงบาง field ของ row ไม่ใช่ response เต็มหรือผลจาก API ที่ deploy แล้ว:

```json
{
  "id": 48,
  "requestNo": "point-00024/2569",
  "factoryId": "91090100125393",
  "formType": "MEASUREMENT_POINTS",
  "status": "PENDING_REVIEW",
  "statusLabel": "รอพิจารณา",
  "targetMeasurementPoints": [
    {
      "connectedPointId": 10021,
      "systemType": "CEMS",
      "pointCode": "S0915",
      "pointName": "Unit 4500 (Waste Gas)"
    }
  ]
}
```

## API รายละเอียดและแบบฟอร์มคงเดิม

| Endpoint | พฤติกรรมที่ต้องรักษา |
| --- | --- |
| `GET /api/v1/poms-factories/edit-requests/:id` | คืนรายละเอียดครบสำหรับเปิดดู ดำเนินการ เปรียบเทียบก่อน/หลัง เอกสารแนบ และประวัติสถานะ |
| `GET /api/v1/poms-factories/edit-requests/:id/form` | คืนข้อมูลเติมฟอร์มรอบแก้ไข รวม `measurementPoints[].connectedPointId` ตามสัญญาเดิม |
| `GET /api/v1/poms-factories/:factoryId/form` | คืนข้อมูลเติมฟอร์มสร้างคำขอและ ID ของแต่ละจุดตามสัญญาเดิม |

การสร้างข้อมูลสรุปต้องรักษาหลักฐานเป้าหมายจาก `POST /api/v1/poms-factories/:factoryId/edit-requests` และ `PUT /api/v1/poms-factories/edit-requests/:id/resubmission` โดย frontend ยังคงส่ง `connectedPointId` เดิม ไม่ต้องส่ง field ใหม่เพื่อให้ backend เดาจุดเป้าหมาย

## การเปลี่ยนผ่านและงาน Frontend

- Frontend ต้องปรับ `mapEditRequestRows` ให้ใช้ response สรุปที่ตกลงกัน แทนการอ่าน `[0]` ของ snapshots
- กรณีคำขอหลายจุด ต้องแสดงข้อมูลเป้าหมายครบ ไม่ซ่อนปัญหาด้วยการเลือกเพียงรายการแรก
- ปุ่มเปิดดู/ดำเนินการยังโหลด detail และปุ่มแก้ไขยังโหลด `/form` ไม่ใช้ข้อมูลสรุปแทนข้อมูลเต็ม
- การตัด snapshot fields จาก list เป็น breaking change สำหรับ frontend ปัจจุบัน ต้องประสาน deployment หรือเพิ่มข้อมูลสรุปก่อนแล้วค่อยนำ fields เดิมออกเมื่อ client พร้อม
- Backend ต้องอัปเดต canonical docs, runtime OpenAPI, tests และ [API CHANGELOG](../../docs/backend/api/CHANGELOG.md) พร้อมผลกระทบและวิธีย้าย client
- การทำเอกสารนี้ยังไม่ได้แก้ frontend mapping หรือทดสอบ response ใหม่จาก API จริง

## เกณฑ์ตรวจรับ

- `point-00024/2569` แสดง **CEMS / S0915 / 10021** ไม่ใช่ WPMS / P0155 / 10024
- โรงงานหลายระบบ หลายจุด ชื่อซ้ำ รหัสว่าง หรือสลับลำดับ snapshot ไม่ทำให้เป้าหมายเปลี่ยน
- ส่งค่าเดิม แก้เฉพาะข้อมูลติดต่อ และ resubmit แล้วยังระบุจุดเป้าหมายถูกต้อง
- คำขอหลายจุดคืนครบทุกเป้าหมาย ส่วน `BASIC_INFO` ไม่เลือกจุดของโรงงานมาแทน
- ตารางไม่ต้องเรียก detail ทีละแถวเพื่อเติมคอลัมน์ และไม่มีข้อมูลรายละเอียดขนาดใหญ่ที่ไม่ใช้ใน list
- เปิดดู/ดำเนินการ/แก้ไขยังได้รายละเอียด เอกสาร ประวัติ และข้อมูลเปรียบเทียบครบเหมือนเดิม
