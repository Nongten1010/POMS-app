# Connect Form Field Inventory

เอกสารนี้ใช้เป็นข้อมูลให้ backend ออกแบบ structure payload สำหรับแบบฟอร์มขอเชื่อมต่อ CEMS/WPMS

เป้าหมายของเอกสารนี้ไม่ใช่ payload contract สุดท้าย แต่เป็นรายการช่องที่มีใน frontend ปัจจุบัน รวมช่องที่แสดงแบบมีเงื่อนไขและช่อง hidden เพื่อให้ backend ทำ response/request structure กลับมาให้ frontend ผูกตามอีกครั้ง

## Scope

- หน้า: หน้าขอเชื่อมต่อ
- ฟอร์มหลัก: แบบฟอร์มคำขอเพิ่มจุดตรวจวัด, เพิ่มพารามิเตอร์, แก้ไขคำขอ
- ระบบที่ต้องรองรับใน e-form: `CEMS`, `WPMS`
- `Mobile` และ `Station` มี UI mock ในหน้าเลือกจุดตรวจวัด แต่ยังไม่ใช่ scope หลักของฟอร์ม CEMS/WPMS รอบนี้

## คำแนะนำสำหรับ Backend

backend ควรส่ง structure กลับมาให้ frontend โดยแยกกลุ่มข้อมูลอย่างน้อย:

- ข้อมูลทั่วไปของโรงงาน
- ผู้ติดต่อประสานงาน
- อีเมลแจ้งเตือน
- จุดตรวจวัด
- รายละเอียดเฉพาะ CEMS หรือ WPMS
- เอกสารและรูปภาพ
- รายละเอียดเครื่องมือตรวจวัด
- ผู้ให้ข้อมูลหรือผู้รับมอบอำนาจ

สำหรับ field ที่ซ่อนตามเงื่อนไข ควรยังมี key ใน structure เพื่อให้ frontend สามารถเติมค่าเดิมตอนแก้ไขฟอร์มได้ แม้ field นั้นจะยังไม่แสดงใน UI ณ ตอนเปิดฟอร์ม

## รายการที่รองรับหลายรายการ

รายการเหล่านี้ใน frontend ปัจจุบันสามารถเพิ่มข้อมูลได้หลายอัน หรือเลือกได้หลายค่า backend ควรออกแบบเป็น array:

| กลุ่ม | UI label | Frontend field/key ปัจจุบัน | รูปแบบหลายรายการ | ข้อจำกัด/หมายเหตุ |
| --- | --- | --- | --- | --- |
| ผู้ติดต่อประสานงาน | ผู้ติดต่อประสานงาน | `contactName`, `contactPosition`, `contactPhone`, `contactEmail` | เพิ่มได้หลายคน | ควรจัดเป็น array ของ object ต่อ 1 ผู้ติดต่อ |
| อีเมลแจ้งเตือน | อีเมลสำหรับแจ้งเตือนโรงงาน | `notificationEmail` | เพิ่มได้หลายอีเมล | string array |
| อีเมลแจ้งเตือน | อีเมลสำหรับแจ้งเตือนเจ้าหน้าที่ | `officerNotificationEmail` | รองรับหลายอีเมล | ปัจจุบันเป็น read-only จากค่า default/ข้อมูลเดิม |
| CEMS | เข้าข่ายตามบัญชีแนบท้ายลำดับที่ | `legalAnnexNo` | เลือกได้หลายค่า | แสดงแบบมีเงื่อนไข, ตัวเลือก `1`-`13` |
| CEMS | พารามิเตอร์ที่เข้าข่าย | `eligibleParameters` | เลือกได้หลายค่า | มีตัวเลือก `ไม่มี` |
| CEMS | พารามิเตอร์ที่ได้รับการยกเว้น | `exemptedParameters` | เลือกได้หลายค่า | มีตัวเลือก `ไม่มี` |
| CEMS | พารามิเตอร์ที่เชื่อมต่อแล้ว | `connectedParameters` | เลือกได้หลายค่า | มีตัวเลือก `ไม่มี` |
| CEMS | พารามิเตอร์ที่ยังไม่เชื่อมต่อ | `pendingParameters` | เลือกได้หลายค่า | มีตัวเลือก `ไม่มี` |
| CEMS | พารามิเตอร์ที่ขอเชื่อมต่อ | `requestedParameters` | เลือกได้หลายค่า | ใช้สร้างแถวรายละเอียดเครื่องมือตรวจวัด |
| CEMS | พารามิเตอร์ที่ได้รับการยกเว้นตามประกาศฯ ข้อ | ยังไม่ผูก payload | เพิ่ม tag ได้หลายอัน | รอ backend กำหนด key/shape |
| CEMS | พารามิเตอร์ที่ติดตั้งแบบ Time sharing | `timeSharingParameters` | เลือกได้หลายค่า | มีตัวเลือก `ไม่มี`; ถ้าเลือก `ไม่มี` ซ่อน `sharedStackCode` |
| CEMS | ระบบบำบัด | `treatmentSystem` | เลือกได้หลายค่า | ถ้ามี `อื่นๆ` แสดง `treatmentSystemOther` |
| WPMS | พารามิเตอร์ที่เข้าข่าย | `eligibleParameters` | เลือกได้หลายค่า | มีตัวเลือก `ไม่มี` |
| WPMS | พารามิเตอร์ที่เชื่อมต่อแล้ว | `connectedParameters` | เลือกได้หลายค่า | มีตัวเลือก `ไม่มี` |
| WPMS | พารามิเตอร์ที่ยังไม่เชื่อมต่อ | `pendingParameters` | เลือกได้หลายค่า | มีตัวเลือก `ไม่มี` |
| WPMS | พารามิเตอร์ที่ขอเชื่อมต่อ | `requestedParameters` | เลือกได้หลายค่า | ใช้สร้างแถวรายละเอียดเครื่องมือตรวจวัด |
| WPMS | ระบบบำบัด | `treatmentSystem` | เลือกได้หลายค่า | ถ้ามี `อื่นๆ` แสดง `treatmentSystemOther` |
| เอกสารและรูปภาพ | ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน | `documentImageFile-{index}` | upload ได้หลายไฟล์ | ไม่เกิน 3 ไฟล์ |
| เอกสารและรูปภาพ | สัญลักษณ์ของโรงงานหรือโลโก้บริษัท | `documentImageFile-{index}` | upload ได้ 1 ไฟล์ | ยกเว้นจากหลายไฟล์ |
| เอกสารและรูปภาพ | ช่อง upload เอกสาร/ภาพทั่วไป | `documentImageFile-{index}` | upload ได้หลายไฟล์ | ไม่เกิน 3 ไฟล์ต่อรายการ |
| รายละเอียดเครื่องมือตรวจวัด | รายละเอียดพารามิเตอร์เครื่องมือตรวจวัด | instrument rows | มีหลายแถวตาม `requestedParameters` | ควรจัดเป็น array ของ object ต่อ 1 parameter; ไม่รวม `converterBrand` และ `converterModel` |
| เกณฑ์มาตรฐาน | ตาราง MIN/MAX | `standardCriteria.rows`, `eiaCriteria.rows` | มีหลาย row | ต้องรองรับ `normal`, `warning`, `critical` |

## ข้อมูลทั่วไปของโรงงาน

ใช้ทั้ง CEMS และ WPMS

| UI label | Frontend field/key ปัจจุบัน | ประเภท UI | เงื่อนไข/หมายเหตุ |
| --- | --- | --- | --- |
| ชื่อโรงงาน | `factoryName` | read-only | มาจากข้อมูลโรงงาน |
| เลขทะเบียนโรงงาน (เดิม) | `oldRegistrationNo` หรือ `factoryRegistrationNo` | read-only | มาจากข้อมูลโรงงาน |
| เลขทะเบียนโรงงาน (ใหม่) | `newRegistrationNo` หรือ `factoryId` | read-only | มาจากข้อมูลโรงงาน |
| การประกอบกิจการ | `businessActivity` | read-only | มาจากข้อมูลโรงงาน |
| ลำดับประเภทโรงงาน (หลัก) | `industryMainOrder` | read-only | มาจากข้อมูลโรงงาน |
| ลำดับประเภทโรงงาน (รอง) | `industrySubOrder` | read-only | มาจากข้อมูลโรงงาน |
| การประเมินผลกระทบสิ่งแวดล้อม | `eia` | dropdown | ตัวเลือก `ไม่มี`, `มี IEE`, `มี EIA`, `มี EHIA`, `อื่นๆ` |
| ระบุ | `eiaOther` | text | แสดงเมื่อ `eia = อื่นๆ` |
| ชื่อโครงการ | `projectName` | text | แสดงเมื่อ `eia` เป็น `มี IEE`, `มี EIA`, `มี EHIA` |
| สถานที่ตั้งโรงงาน | `address` | read-only | มาจากข้อมูลโรงงาน |
| ละติจูด | `latitude` | text/number | เปิดให้กรอกได้ |
| ลองติจูด | `longitude` | text/number | เปิดให้กรอกได้ |
| ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน | document image item | upload | อยู่ในข้อมูลทั่วไปของโรงงาน, ไม่เกิน 3 ไฟล์ |
| สัญลักษณ์ของโรงงานหรือโลโก้บริษัท | document image item | upload | อยู่ในข้อมูลทั่วไปของโรงงาน, 1 ไฟล์, 512 x 512 pixel, ไม่เกิน 5 Mb |

## ผู้ติดต่อประสานงาน

ใช้ทั้ง CEMS และ WPMS และเพิ่มได้หลายรายการ

| UI label | Frontend field/key ปัจจุบัน | ประเภท UI | เงื่อนไข/หมายเหตุ |
| --- | --- | --- | --- |
| ชื่อ-นามสกุล | `contactName` | text array | เพิ่มได้หลายคน |
| ตำแหน่ง | `contactPosition` | text array | ผูก index ตาม `contactName` |
| เบอร์โทร | `contactPhone` | text array | ผูก index ตาม `contactName` |
| อีเมล | `contactEmail` | email array | ผูก index ตาม `contactName` |

## อีเมลแจ้งเตือน

ใช้ทั้ง CEMS และ WPMS

| UI label | Frontend field/key ปัจจุบัน | ประเภท UI | เงื่อนไข/หมายเหตุ |
| --- | --- | --- | --- |
| อีเมลสำหรับแจ้งเตือนโรงงาน | `notificationEmail` | email array | เพิ่มได้หลายรายการ |
| อีเมลสำหรับแจ้งเตือนเจ้าหน้าที่ | `officerNotificationEmail` | email array/read-only | ปัจจุบันแสดงจากค่า default/ข้อมูลเดิม |

## จุดตรวจวัด

แสดงเมื่อเป็น flow เพิ่มจุดตรวจวัดหรือเพิ่มพารามิเตอร์

| UI label | Frontend field/key ปัจจุบัน | ประเภท UI | เงื่อนไข/หมายเหตุ |
| --- | --- | --- | --- |
| ประเภทจุดตรวจวัด | selected point type | radio | ตัวเลือก `CEMS`, `WPMS`, `Mobile`, `Station` |

เมื่อเลือก `CEMS` หรือ `WPMS` จะแสดงรายละเอียดจุดตรวจวัด, เอกสารและรูปภาพ, รายละเอียดเครื่องมือตรวจวัด, และผู้ให้ข้อมูลหรือผู้รับมอบอำนาจ

## รายละเอียดจุดตรวจวัด CEMS

| UI label | Frontend field/key ปัจจุบัน | ประเภท UI | เงื่อนไข/หมายเหตุ |
| --- | --- | --- | --- |
| รหัสจุดตรวจวัด | `pointCode` | text | เพิ่มจุดใหม่ backend อาจออกเลขให้ |
| ชื่อจุดตรวจวัด | `pointName` | text |  |
| ประเภทของหน่วยการผลิต | `productionUnitType` | text |  |
| กำลังการผลิต | `productionCapacityValue` | text/number | md 1 |
| หน่วยกำลังการผลิต | `productionCapacityUnit` | text | md 2 |
| เข้าข่ายต้องติดตั้ง CEMS ตามกฎหมาย | `cemsInstallationRequiredBy` | dropdown | มี `-` และ option จาก `cemsInstallationRequiredOptions.json` |
| อื่นๆ โปรดระบุ | `cemsInstallationRequiredOther` | text | แสดงเมื่อ `cemsInstallationRequiredBy = อื่นๆ` |
| เข้าข่ายตามบัญชีแนบท้ายลำดับที่ | `legalAnnexNo` | multiselect | แสดงเฉพาะเมื่อเลือกประกาศกระทรวงอุตสาหกรรม 2 รายการที่กำหนดไว้, ตัวเลือก `1`-`13` |
| พารามิเตอร์ที่เข้าข่าย | `eligibleParameters` | multiselect | ตัวเลือก CEMS parameter พร้อม `ไม่มี` เป็นตัวแรก |
| พารามิเตอร์ที่ได้รับการยกเว้น | `exemptedParameters` | multiselect | ตัวเลือก CEMS parameter พร้อม `ไม่มี` เป็นตัวแรก |
| พารามิเตอร์ที่เชื่อมต่อแล้ว | `connectedParameters` | multiselect | ตัวเลือก CEMS parameter พร้อม `ไม่มี` เป็นตัวแรก |
| พารามิเตอร์ที่ยังไม่เชื่อมต่อ | `pendingParameters` | multiselect | ตัวเลือก CEMS parameter พร้อม `ไม่มี` เป็นตัวแรก |
| พารามิเตอร์ที่ขอเชื่อมต่อ | `requestedParameters` | multiselect | ตัวเลือก CEMS parameter, ใช้สร้างแถวรายละเอียดเครื่องมือตรวจวัด |
| พารามิเตอร์ที่ได้รับการยกเว้นตามประกาศฯ ข้อ | ยังไม่ผูก payload | tag input | CEMS only, รอ backend กำหนด key/structure |
| พารามิเตอร์ที่ติดตั้งแบบ Time sharing | `timeSharingParameters` | multiselect | ตัวเลือก CEMS parameter พร้อม `ไม่มี` เป็นตัวแรก |
| ร่วมกับปล่อง | `sharedStackCode` | text | ซ่อนเมื่อ `timeSharingParameters` มี `ไม่มี` |
| ลักษณะปล่อง | `stackShape` | dropdown | ตัวเลือก `วงกลม`, `สี่เหลี่ยม`, `อื่นๆ` |
| เส้นผ่านศูนย์กลาง (เมตร) | `stackDiameter` | text/number | แสดงเมื่อ `stackShape = วงกลม` |
| กว้าง (เมตร) | `stackWidth` | text/number | แสดงเมื่อ `stackShape = สี่เหลี่ยม` |
| ยาว (เมตร) | `stackLength` | text/number | แสดงเมื่อ `stackShape = สี่เหลี่ยม` |
| โปรดระบุ | `stackShapeOther` | text | แสดงเมื่อ `stackShape = อื่นๆ` |
| ความสูงปล่อง (เมตร) | `stackHeight` | text/number |  |
| ความสูงของจุดตรวจวัด (เมตร) | `monitoringHeight` | text/number |  |
| อัตราการระบายอากาศเฉลี่ย (m3/hr) | `averageFlowRate` | text/number |  |
| อัตราการระบายอากาศต่ำสุด (m3/hr) | `minFlowRate` | text/number |  |
| อัตราการระบายอากาศสูงสุด (m3/hr) | `maxFlowRate` | text/number |  |
| เชื้อเพลิงหลักที่ใช้ | `primaryFuel` | dropdown | option จาก `fuelOptions.json` |
| ระบุเชื้อเพลิงหลัก | `primaryFuelOther` | text | enabled เมื่อเลือกชีวมวลหรืออื่นๆ |
| ร้อยละโดยประมาณ | `primaryFuelPercent` | text/number | สัดส่วนเชื้อเพลิงหลัก |
| เชื้อเพลิงรอง (ถ้ามี) | `secondaryFuel` | dropdown | option จาก `fuelOptions.json` |
| ระบุเชื้อเพลิงรอง | `secondaryFuelOther` | text | enabled เมื่อเลือกชีวมวลหรืออื่นๆ |
| ร้อยละโดยประมาณ | `secondaryFuelPercent` | text/number | สัดส่วนเชื้อเพลิงรอง |
| ระบบควบคุม | `combustionControlSystem` | dropdown | ตัวเลือก `ระบบปิด`, `ระบบเปิด` |
| ระบบบำบัด | `treatmentSystem` | multiselect | option จาก `treatmentSystemOptions.json` |
| มี/ไม่มีระบบบำบัด | `hasTreatmentSystem` | hidden | frontend คำนวณจาก `treatmentSystem`; ถ้าเลือก `ไม่มี` เป็น `ไม่มี` |
| ระบุระบบบำบัด | `treatmentSystemOther` | text | แสดงเมื่อ `treatmentSystem` มี `อื่นๆ` |
| พิกัดปล่องที่ติดตั้ง CEMS (ละติจูด) | `stackLatitude` | text/number |  |
| พิกัดปล่องที่ติดตั้ง CEMS (ลองติจูด) | `stackLongitude` | text/number |  |
| อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ | `connectionDevice` | dropdown | `POMS Box (กรอ.)`, `POMS Box (กนอ.)`, `POMS Client (เดิม)`, `D-POMS Client (ใหม่)`, `อื่นๆ` |
| โปรดระบุ | `connectionDeviceOther` | text | แสดงเมื่อ `connectionDevice = อื่นๆ` |

## รายละเอียดจุดตรวจวัด WPMS

| UI label | Frontend field/key ปัจจุบัน | ประเภท UI | เงื่อนไข/หมายเหตุ |
| --- | --- | --- | --- |
| รหัสจุดตรวจวัด | `pointCode` | text | เพิ่มจุดใหม่ backend อาจออกเลขให้ |
| ชื่อจุดตรวจวัด | `pointName` | text |  |
| พารามิเตอร์ที่เข้าข่าย | `eligibleParameters` | multiselect | ตัวเลือก WPMS parameter พร้อม `ไม่มี` เป็นตัวแรก |
| พารามิเตอร์ที่เชื่อมต่อแล้ว | `connectedParameters` | multiselect | ตัวเลือก WPMS parameter พร้อม `ไม่มี` เป็นตัวแรก |
| พารามิเตอร์ที่ยังไม่เชื่อมต่อ | `pendingParameters` | multiselect | ตัวเลือก WPMS parameter พร้อม `ไม่มี` เป็นตัวแรก |
| พารามิเตอร์ที่ขอเชื่อมต่อ | `requestedParameters` | multiselect | ตัวเลือก WPMS parameter, อยู่แถวเดียวกับ pending parameters |
| อัตราการระบายน้ำทิ้งเฉลี่ย (m3/d) | `averageWastewaterDischarge` | text/number |  |
| อัตราการระบายน้ำทิ้งต่ำสุด (m3/d) | `minWastewaterDischarge` | text/number |  |
| อัตราการระบายน้ำทิ้งสูงสุด (m3/d) | `maxWastewaterDischarge` | text/number |  |
| ระบบบำบัด | `treatmentSystem` | multiselect | option จาก `wpmsTreatmentSystemOptions.json` |
| มี/ไม่มีระบบบำบัด | `hasTreatmentSystem` | hidden | frontend คำนวณจาก `treatmentSystem`; ถ้าเลือก `ไม่มี` เป็น `ไม่มี` |
| ระบุระบบบำบัด | `treatmentSystemOther` | text | แสดงเมื่อ `treatmentSystem` มี `อื่นๆ` |
| ปริมาณรองรับน้ำเสียสูงสุดของระบบบำบัด | `maxTreatmentCapacity` | text/number | แสดงเมื่อ `hasTreatmentSystem = มี` |
| พิกัดจุดติดตั้งเครื่องมือตรวจวัด (ละติจูด) | `instrumentLatitude` | text/number |  |
| พิกัดจุดติดตั้งเครื่องมือตรวจวัด (ลองติจูด) | `instrumentLongitude` | text/number |  |
| พิกัดจุดระบายน้ำทิ้งออกนอกโรงงาน (ละติจูด) | `dischargeLatitude` | text/number | อยู่หลังพิกัดจุดติดตั้งเครื่องมือตรวจวัด |
| พิกัดจุดระบายน้ำทิ้งออกนอกโรงงาน (ลองติจูด) | `dischargeLongitude` | text/number | อยู่หลังพิกัดจุดติดตั้งเครื่องมือตรวจวัด |
| แหล่งกำเนิดน้ำเสีย | `wastewaterSource` | text |  |
| แหล่งรองรับน้ำทิ้ง | `dischargeReceivingSource` | text |  |
| อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ | `connectionDevice` | dropdown | `POMS Box (กรอ.)`, `POMS Box (กนอ.)`, `POMS Client (เดิม)`, `D-POMS Client (ใหม่)`, `อื่นๆ` |
| โปรดระบุ | `connectionDeviceOther` | text | แสดงเมื่อ `connectionDevice = อื่นๆ` |

## เอกสารและรูปภาพ

ช่องเอกสารและรูปภาพมีทั้ง upload file และบางรายการมีช่อง `Link`

ข้อจำกัดใน frontend:

- ทุกช่องไฟล์แสดงหมายเหตุ `ขนาดไม่เกิน 5 Mb`
- โลโก้บริษัทแสดงหมายเหตุ `ขนาด 512 x 512 pixel ไม่เกิน 5 Mb`
- ช่องทั่วไป upload ได้ไม่เกิน 3 ไฟล์
- โลโก้ upload ได้ 1 ไฟล์
- ผู้ใช้เลือกไฟล์เพิ่มทีละไฟล์ได้
- หลังเลือกไฟล์จะแสดงตัวอย่างรูปหรือไฟล์ และลบไฟล์ออกก่อน upload ได้

### เอกสารในข้อมูลทั่วไปของโรงงาน

ใช้ทั้ง CEMS และ WPMS

| รายการ | File field ปัจจุบัน | Link field | หมายเหตุ |
| --- | --- | --- | --- |
| ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน | `documentImageFile-{index}` | ไม่มี | upload ได้ไม่เกิน 3 ไฟล์ |
| สัญลักษณ์ของโรงงานหรือโลโก้บริษัท | `documentImageFile-{index}` | ไม่มี | 1 ไฟล์, accept image jpeg/png |

### เอกสารเฉพาะ CEMS

| รายการ | File field ปัจจุบัน | Link field | หมายเหตุ |
| --- | --- | --- | --- |
| ข้อมูลรายละเอียดการรายงานค่าที่สภาวะมาตรฐาน | `documentImageFile-{index}` | `documentImageLink-{index}` | มีคำอธิบายยาวในหน้า UI |
| รายงานผลการทำ RATA หรือ อื่นๆ ที่เทียบเท่า ของระบบ CEMS ครั้งล่าสุด | `documentImageFile-{index}` | `documentImageLink-{index}` |  |
| ภาพถ่ายปล่อง | `documentImageFile-{index}` | ไม่มี |  |
| ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (CEMS) | `documentImageFile-{index}` | ไม่มี |  |

### เอกสารเฉพาะ WPMS

| รายการ | File field ปัจจุบัน | Link field | หมายเหตุ |
| --- | --- | --- | --- |
| ระบบบำบัด | `documentImageFile-{index}` | ไม่มี | section เอกสารและรูปภาพ |
| ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (WPMS) | `documentImageFile-{index}` | ไม่มี | section เอกสารและรูปภาพ |

## รายละเอียดเครื่องมือตรวจวัด

ใช้ทั้ง CEMS และ WPMS โดยแถวในตารางอิงจาก `พารามิเตอร์ที่ขอเชื่อมต่อ`

ตารางนี้ต้องส่งข้อมูลได้หลายชุด โดย 1 แถว = 1 ชุดข้อมูลของพารามิเตอร์ที่ขอเชื่อมต่อ และควรออกแบบเป็น array เช่น `measurementInstruments.parameters[]`

`อุปกรณ์แปลงสัญญาณ (Converter) ยี่ห้อ` และ `อุปกรณ์แปลงสัญญาณ (Converter) รุ่น` เป็นข้อมูลระดับชุดเครื่องมือ ไม่ได้อยู่ใน array ของแต่ละพารามิเตอร์

| UI label | Frontend field/key ปัจจุบัน | ประเภท UI | เงื่อนไข/หมายเหตุ |
| --- | --- | --- | --- |
| อุปกรณ์แปลงสัญญาณ (Converter) ยี่ห้อ | `converterBrand` | text | field ระดับ `measurementInstruments`, ไม่อยู่ใน `parameters[]` |
| อุปกรณ์แปลงสัญญาณ (Converter) รุ่น | `converterModel` | text | field ระดับ `measurementInstruments`, ไม่อยู่ใน `parameters[]` |
| พารามิเตอร์ที่ขอเชื่อมต่อ | instrument row `parameter` | dropdown ใน dialog | option จาก requested parameters |
| เทคนิคตรวจวัด | instrument row `technique` | text |  |
| ช่วงการวัด | instrument row `range` | text |  |
| ยี่ห้อเครื่องมือ | instrument row `brand` | text |  |
| ผู้จำหน่ายเครื่องมือ | instrument row `supplier` | text |  |
| มาตรฐาน EIA | instrument row `eiaStandard` | derived/display | ตารางแสดงจากค่ามาตรฐานตาม EIA ใน dialog ถ้าไม่มีแสดง `-` |
| สภาวะมาตรฐาน | instrument row `standardCondition` | checkbox | CEMS only, WPMS ไม่แสดง |
| การรายงานค่า (Dry basis) | instrument row `dryBasis` | checkbox | CEMS only, WPMS ไม่แสดง |
| O2 @ 7% or Excess Air 50% | instrument row `oxygenOrExcessAir` | checkbox | CEMS only, WPMS ไม่แสดง |
| จัดการข้อมูล | dialog action | button | เปิด dialog จัดการข้อมูลเครื่องมือตรวจวัด |

## Dialog จัดการข้อมูลเครื่องมือตรวจวัด

ใช้ทั้ง CEMS และ WPMS แต่ WPMS ไม่แสดงหัวข้อการรายงานค่า

| UI label | Frontend field/key ปัจจุบัน | ประเภท UI | เงื่อนไข/หมายเหตุ |
| --- | --- | --- | --- |
| พารามิเตอร์ที่ขอเชื่อมต่อ | `parameter` | dropdown | ต้องเลือกก่อนบันทึก |
| เทคนิคตรวจวัด | `technique` | text | placeholder เช่น `NDIR` |
| ช่วงการวัด | `range` | text | placeholder เช่น `0-200` |
| ยี่ห้อเครื่องมือ | `brand` | text | placeholder เช่น `Siemens` |
| ผู้จำหน่ายเครื่องมือ | `supplier` | text | placeholder เช่น `ABC Tech` |
| สภาวะมาตรฐาน | `standardCondition` | checkbox | CEMS only |
| การรายงานค่า (Dry basis) | `dryBasis` | checkbox | CEMS only |
| O2 @ 7% or Excess Air 50% | `oxygenOrExcessAir` | checkbox | CEMS only |
| พารามิเตอร์ไม่มีค่ามาตรฐาน ตามประกาศ อก. | `standardCriteria.enabled` แบบกลับค่า | checkbox | เมื่อ checked ช่องค่ามาตรฐานและ MIN/MAX ฝั่งประกาศ อก. จะ disabled และ clear ค่า |
| ตามประกาศ อก. ค่ามาตรฐาน | `standardCriteria.standardValue` | number | ทศนิยมไม่เกิน 4 ตำแหน่ง |
| ตามประกาศ อก. MIN/MAX ปกติ | `standardCriteria.rows[level=normal]` | number table | แสดง `<= ปกติ <=` |
| ตามประกาศ อก. MIN/MAX เฝ้าระวัง | `standardCriteria.rows[level=warning]` | number table | แสดง `< เฝ้าระวัง <=` |
| ตามประกาศ อก. MIN/MAX แจ้งเตือน | `standardCriteria.rows[level=critical]` | number table | แสดง `< แจ้งเตือน <`; MAX แสดง `-` |
| พารามิเตอร์ไม่มีค่ามาตรฐาน ตาม EIA | `eiaCriteria.enabled` แบบกลับค่า | checkbox | เมื่อ checked ช่องค่ามาตรฐานและ MIN/MAX ฝั่ง EIA จะ disabled และ clear ค่า |
| ตาม EIA ค่ามาตรฐาน | `eiaCriteria.standardValue` | number | ทศนิยมไม่เกิน 4 ตำแหน่ง |
| ตาม EIA MIN/MAX ปกติ | `eiaCriteria.rows[level=normal]` | number table | แสดง `<= ปกติ <=` |
| ตาม EIA MIN/MAX เฝ้าระวัง | `eiaCriteria.rows[level=warning]` | number table | แสดง `< เฝ้าระวัง <=` |
| ตาม EIA MIN/MAX แจ้งเตือน | `eiaCriteria.rows[level=critical]` | number table | แสดง `< แจ้งเตือน <`; MAX แสดง `-` |

หมายเหตุการคำนวณใน frontend:

- เมื่อกรอกค่ามาตรฐาน ระบบคำนวณค่าเฝ้าระวังเป็น 80% ของค่ามาตรฐาน
- ตัวอย่างค่ามาตรฐาน 100: ปกติ 0-80, เฝ้าระวัง 80-100, แจ้งเตือนมากกว่า 100
- ช่องในตารางจำกัดทศนิยมไม่เกิน 4 ตำแหน่ง
- ปุ่มบันทึกใน dialog ต้องยืนยันก่อน และสำเร็จแล้วแสดง snackbar

## ผู้ให้ข้อมูลหรือผู้รับมอบอำนาจ

ใช้ทั้ง CEMS และ WPMS

| UI label | Frontend field/key ปัจจุบัน | ประเภท UI | เงื่อนไข/หมายเหตุ |
| --- | --- | --- | --- |
| ชื่อ-นามสกุล | `informationProviderName` | text | ตอนสร้างใหม่ default จากผู้ใช้ที่ login ถ้ามี |
| ตำแหน่ง | `informationProviderPosition` | text | ตอนสร้างใหม่ default จากผู้ใช้ที่ login ถ้ามี |

## Field ที่ Backend ควรตัดสินใจเพิ่มใน Structure

รายการนี้มีใน UI แล้ว แต่ frontend ยังรอ backend กำหนด payload key/shape:

| UI label | ระบบ | ประเภท UI | ข้อเสนอเบื้องต้น |
| --- | --- | --- | --- |
| พารามิเตอร์ที่ได้รับการยกเว้นตามประกาศฯ ข้อ | CEMS | tag input | ควรอยู่ใต้รายละเอียด CEMS ใกล้ `requestedParameters`; backend ควรกำหนดชื่อ key และรูปแบบ array เช่น string array หรือ object array |

## Expected Backend Output กลับมาให้ Frontend

เมื่อ backend ออกแบบเสร็จ ควรส่งเอกสารหรือ example payload กลับมาโดยระบุ:

- key จริงของทุก field
- field ไหน required
- field ไหน nullable
- field ไหนเป็น array และรูปแบบ item
- field ไหนเพิ่มได้หลายรายการ และจำกัดจำนวนเท่าไร
- field ไหนเป็น number/string/boolean
- ค่า enum ของ dropdown/multiselect
- conditional visibility ที่ backend ต้องการให้ frontend ยึด
- default value สำหรับ edit mode
- วิธีเก็บเอกสารหลายไฟล์ต่อ 1 รายการ
- key สำหรับช่อง `พารามิเตอร์ที่ได้รับการยกเว้นตามประกาศฯ ข้อ`
