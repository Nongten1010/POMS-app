# Frontend Handoff: จุด Badge บน Sidebar

ส่วนนี้เป็นความต้องการจาก frontend สำหรับส่งต่อให้ backend ออกแบบและพัฒนา ไม่ใช่ API contract ที่เปิดใช้งานแล้ว

### ขอบเขต

- ต้องการ API เดียวที่สรุปว่าแต่ละเมนูบน Sidebar มีรายการเข้าเกณฑ์แจ้งเตือนหรือไม่
- ส่ง boolean เท่านั้น: `true` แสดงจุด Badge, `false` ซ่อนจุด Badge ไม่ต้องส่งจำนวนหรือรายละเอียดรายการ
- Badge ตัวนับในเมนูย่อย frontend ทำไว้แล้ว งานนี้ไม่ต้องทำ API จำนวนสำหรับเมนูย่อย และไม่เปลี่ยนการทำงานของตัวนับเดิม
- ครอบคลุมข้อมูลพื้นฐาน ขอเชื่อมต่อ กวภ. BOD/COD โรงงานที่เข้าข่าย และการแจ้งเตือน
- ไม่เปลี่ยน API รายการเดิม ขั้นตอนคำขอ สิทธิ์กดปุ่ม หรือข้อมูลธุรกิจ หากจำเป็นต้องเปลี่ยนส่วนเหล่านี้ให้ถามก่อน
- ชื่อ endpoint ให้ backend ออกแบบและแจ้งกลับ frontend ก่อนเชื่อมต่อ

### ตัวตน สิทธิ์ และขอบเขตข้อมูล

1. ต้องยืนยันตัวตนและใช้บัญชีที่ login อยู่จาก token/session โดยอ่านสิทธิ์ล่าสุดของบัญชี ไม่รับ user ID, role หรือ scope จาก frontend มาเป็นตัวตัดสิน
2. ต้องมีสิทธิ์ `view` ของเมนูนั้นก่อน เมนูที่ไม่มีสิทธิ์ให้คืน `false` โดยไม่เปิดเผยว่ามีข้อมูลอยู่หรือไม่
3. ต้องใช้ขอบเขตการมองเห็นเดียวกับ API รายการของเมนูนั้น เช่น โรงงานที่ผูกหรือได้รับมอบหมาย ภาค จังหวัด และพื้นที่ตามสิทธิ์จริง ห้ามนับจากข้อมูลทั้งระบบ
4. สองบัญชีที่มี role เดียวกันแต่มีขอบเขตข้อมูลต่างกัน อาจได้ค่า Badge ต่างกัน
5. หลังจำกัดสิทธิ์และขอบเขตแล้ว ให้ตรวจว่ามีอย่างน้อยหนึ่งรายการตรงสถานะตามตารางด้านล่างหรือไม่
6. ไม่เพิ่มการกรองด้วยสิทธิ์ `edit`/`approve`, `allowedActions`, ผู้สร้างคำขอ หรือ `currentStep` นอกเหนือจากกติกาการเข้าถึงรายการเดิมและเงื่อนไขที่ระบุด้านล่างโดยอัตโนมัติ หากต้องการนับเฉพาะรายการที่กดดำเนินการได้จริง ให้ตกลงเพิ่มเติมก่อน เพราะไม่ใช่เกณฑ์ Badge ที่ frontend ทำอยู่
7. Badge ไม่ให้สิทธิ์ดำเนินการเพิ่มเติม API บันทึก/อนุมัติยังต้องตรวจสิทธิ์ของตัวเองตามเดิม

### สถานะที่ใช้ตัดสินแต่ละเมนู

เมนูคำขอทั้งหมดไม่จำกัดเฉพาะวันนี้ ไม่ใช่การตรวจว่าอ่านแล้วหรือยัง และใช้รหัสสถานะจริง ไม่ใช้ข้อความภาษาไทยที่ frontend อาจแสดงรวมหลายสถานะ

| Key ที่เสนอ | เมนู / สิทธิ์เข้าเมนู | กลุ่มผู้ใช้ | สถานะที่ทำให้คืน `true` |
| --- | --- | --- | --- |
| `factories` | ข้อมูลพื้นฐาน / `factories.view` | ผู้ประกอบการ | `REVISION_REQUESTED` |
| `factories` | ข้อมูลพื้นฐาน / `factories.view` | เจ้าหน้าที่และแอดมิน | `PENDING_REVIEW`, `REVISED_PENDING_REVIEW` |
| `connection` | ขอเชื่อมต่อ / `connection.view` | ผู้ประกอบการ | `WAITING_FACTORY_REVISION`, `WAITING_CONNECTION` |
| `connection` | ขอเชื่อมต่อ / `connection.view` | เจ้าหน้าที่และแอดมิน | `PENDING_DESIGN_REVIEW`, `REVISED_PENDING_DESIGN_REVIEW`, `CONNECTION_CONFIRMED` |
| `kwp_forms` | แจ้งแบบ กวภ. / `kwp_forms.view` | ผู้ประกอบการ | `REVISION_REQUESTED` |
| `kwp_forms` | แจ้งแบบ กวภ. / `kwp_forms.view` | เจ้าหน้าที่และแอดมิน | `SUBMITTED`, `UNDER_REVIEW` |
| `bod_cod_errors` | BOD/COD / `bod_cod_errors.view` | ผู้ประกอบการ | `REVISION_REQUESTED` |
| `bod_cod_errors` | BOD/COD / `bod_cod_errors.view` | เจ้าหน้าที่ทั่วไปและแอดมิน | `SUBMITTED`, `REVISED_PENDING_REVIEW`, `WAITING_RESULT_NOTICE` |
| `bod_cod_errors` | BOD/COD / `bod_cod_errors.view` | เจ้าหน้าที่กลุ่ม Director | `WAITING_REVIEW`, `WAITING_APPROVAL` |
| `eligible_factories` | โรงงานที่เข้าข่าย / `eligible_factories.view` | ผู้ไม่ใช่ผู้ประกอบการ และมี `eligible_factories.approve === true` เพื่อเข้าถึงเมนูย่อยขอเพิ่มโรงงาน | `PENDING_REVIEW` |

- ผู้ประกอบการหมายถึง `userType = operator`; เจ้าหน้าที่หมายถึง `userType = officer`; แอดมินหมายถึง role `admin`
- BOD/COD กลุ่ม Director คือ `kpm_director`, `center_director`, `kwp_director` ตรวจทั้ง `roleCode` และ `roleCodes` โดยนับทั้งรอทบทวนและรออนุมัติสำหรับทั้งสาม role ไม่แยกเฉพาะขั้นที่ role นั้นอนุมัติได้
- BOD/COD หากมี `admin` ร่วมกับ Director ให้ใช้เกณฑ์แอดมิน ไม่รวมสองกลุ่มเข้าด้วยกัน
- เมนูข้อมูลพื้นฐาน ขอเชื่อมต่อ และ กวภ. ไม่แยก Director ออกจากเจ้าหน้าที่
- ขอเชื่อมต่อ: frontend ยังรองรับชื่อสถานะตั้งค่าอุปกรณ์ `WAITING_FACTORY_DEVICE_CONFIG`, `WAITING_FACTORY_DEVICE_CONFIGURATION`, `WAITING_DEVICE_CONFIG` หาก backend มีค่าเหล่านี้ให้ถือเป็นกลุ่มเดียวกับ `WAITING_CONNECTION`; ไม่ต้องสร้างสถานะใหม่
- ผู้ใช้ที่ไม่เข้าเงื่อนไขกลุ่มใดให้คืน `false` สำหรับเมนูคำขอนั้น
- ชื่อ permission ในตารางเป็น key ฝั่ง frontend ให้ backend จับคู่กับ effective permission ของเมนูเดียวกันตาม contract เดิม ไม่สร้าง permission ใหม่หรือใช้ชื่อ UI key เป็น permission backend โดยไม่ตรวจ mapping

### เมนูการแจ้งเตือน

Key ที่เสนอ: `notifications`; ต้องมี `notifications.view` และใช้ scope ของผู้ใช้เดียวกับ API `/api/v1/alert-events`

- คืน `true` เมื่อมีอย่างน้อยหนึ่งเหตุการณ์ที่เข้าเกณฑ์ของเมนูย่อยใดเมนูย่อยหนึ่งในกลุ่ม CEMS หรือ BOD/COD Online รวม 10 เมนูย่อย
- ใช้ `eventDate` เท่ากับวันที่ปัจจุบันตาม `Asia/Bangkok` เท่านั้น ไม่ใช้ `createdAt` หรือ `detectedAt`
- ไม่กรองว่ายังไม่อ่านหรือส่งแจ้งเตือนแล้วหรือไม่
- CEMS ใช้ `systemType = CEMS`; BOD/COD Online ใช้ `systemType = WPMS` ร่วมกับ `displaySystemType = BOD_COD_ONLINE` ตามตัวกรอง API เดิม
- แต่ละกลุ่มมี `STANDARD_EXCEEDED` ร่วมกับ `thresholdType = STANDARD`, `EIA_EXCEEDED` ร่วมกับ `thresholdType = EIA`, `DAILY_COMPLETENESS_LOW`, `CONSECUTIVE_NO_REPORT` และ `ABNORMAL_VALUE`
- เกณฑ์จำนวนวันขาดรายงานและเกณฑ์ตรวจวัดใช้เหตุการณ์ที่ API เดิมจัดประเภทไว้แล้ว ไม่คำนวณกฎตรวจวัดใหม่ใน API Badge

### ตัวอย่างผลลัพธ์ที่เสนอ

โครงสร้างนี้เป็นข้อเสนอให้ backend ยืนยัน ไม่ใช่ response ที่มีอยู่แล้ว

```json
{
  "success": true,
  "data": {
    "factories": true,
    "connection": false,
    "kwp_forms": true,
    "bod_cod_errors": false,
    "eligible_factories": true,
    "notifications": true
  }
}
```

- คืนครบทั้ง 6 key เป็น boolean เสมอ รวมกรณีไม่มีสิทธิ์หรือไม่มีรายการให้ใช้ `false`
- ไม่มี token หรือ token ใช้ไม่ได้ให้ใช้ authentication error ตามระบบเดิม ไม่ตอบเป็น success ที่ทุกเมนูเป็น `false`
- หากประมวลผลล้มเหลว ให้คืน error ตามระบบเดิม ไม่แทนความผิดพลาดด้วย `false` เพราะจะทำให้เข้าใจว่าไม่มีรายการค้าง
- ไม่ต้องคืนจำนวนแยกเมนูย่อย ไม่ต้องส่งรายชื่อโรงงานหรือข้อมูลส่วนบุคคล

### ประสิทธิภาพและการเรียกใช้

- ใช้ `EXISTS` หรือ query ที่หยุดได้เมื่อพบรายการแรก พร้อม index ที่เหมาะกับ scope และสถานะ ไม่โหลดทุกรายการและไม่ใช้ `COUNT` เพียงเพื่อทราบว่ามีหรือไม่มี
- ผลต้องไม่ขึ้นกับ pagination ของตาราง เช่น รายการเข้าเกณฑ์ที่อยู่หน้าที่ 2 ยังต้องทำให้เป็น `true`
- หากใช้ cache ต้องแยกตามบัญชีและ effective permissions/scope ห้ามแชร์ผลระหว่างบัญชีที่มี role เดียวกันแต่คนละขอบเขต
- การเปลี่ยนสิทธิ์ การมอบหมายพื้นที่ และการข้ามวันเวลาไทยต้องไม่ใช้ cache เก่าจนเผยข้อมูลนอกสิทธิ์หรือแสดงวันผิด
- ฝั่ง frontend จะเรียกส่วนกลางเพื่อใช้ร่วมกันบน Sidebar ไม่เรียกแยกทีละเมนูหรือทุกครั้งที่เปิด Sidebar
- แนวทางรีเฟรชที่เสนอ: หลัง login, หลังดำเนินการเปลี่ยนสถานะสำเร็จ และทุกประมาณ 60 วินาทีเฉพาะขณะหน้าเว็บมองเห็น; กลับเข้าแท็บให้รีเฟรชเมื่อข้อมูลเก่า
- ยังไม่จำเป็นต้องเพิ่ม WebSocket/SSE ในรอบนี้ และไม่เปลี่ยนวิธีนับ Badge ในเมนูย่อย

### กรณีที่ต้องทดสอบก่อนส่งต่อ

- ไม่มี `view` แม้มีรายการในระบบ ต้องคืน `false`; เมนูขอเพิ่มโรงงานต้องผ่านเงื่อนไข `approve` เพิ่มด้วย
- บัญชี role เดียวกันแต่คนละโรงงาน/พื้นที่ ไม่เห็นผลจากข้อมูลของกันและกัน
- แต่ละกลุ่มผู้ใช้ตรวจเฉพาะสถานะตามตาราง รวม Director และกรณีมี `admin` ร่วมด้วย
- รายการตรงเกณฑ์อยู่ถัดจากหน้าแรกยังคืน `true`
- รายการสุดท้ายเปลี่ยนพ้นสถานะที่นับแล้ว ต้องคืน `false` เมื่อเรียกใหม่ตามนโยบาย cache ที่ตกลง
- `eventDate` เป็นวันนี้แต่สร้างวันอื่นต้องนับ; สร้างวันนี้แต่ `eventDate` เป็นเมื่อวานต้องไม่นับ
- ตรวจรอยต่อเที่ยงคืนไทย และการแก้ไขสิทธิ์/assignment ระหว่าง session
- ตรวจว่าตัวนับเมนูย่อย API รายการเดิม และ workflow เดิมไม่เปลี่ยนพฤติกรรม

### สิ่งที่ Backend ต้องส่งกลับให้ Frontend

ยืนยัน endpoint, response keys, authentication/error contract, การจับคู่ permission และนโยบาย cache/refresh พร้อมลิงก์ canonical documentation ใต้ `docs/backend/` และ runtime OpenAPI ที่ปรับแล้ว ส่วนนี้เป็น frontend handoff เท่านั้น ให้ backend จัดทำ API contract ในพื้นที่ canonical ไม่คัดลอก contract มาดูแลซ้ำในไฟล์นี้
