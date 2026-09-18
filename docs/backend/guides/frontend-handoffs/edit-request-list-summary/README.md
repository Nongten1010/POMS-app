# ส่งต่องานตารางคำขอแก้ไขโรงงาน: ข้อมูลสรุปและจุดเป้าหมาย

คู่มือนี้ตอบ [Frontend handoff 18092026-1](https://github.com/Nongten1010/POMS-app/blob/main/frontend/md/frontend-handoff-18092026-1.md) สำหรับการปรับตารางรายการคำขอแก้ไขข้อมูลพื้นฐาน โดยอ้างอิง [สัญญา list summary](../../../api/menus/master-data/factory-edit-requests.md#edit-request-list-summary) เป็นแหล่งกำหนด fields, types, nullability, filters และ permissions เพียงแห่งเดียว

## สถานะและขอบเขต

Backend ใน commit `4dbed31` มี list summary, การเก็บ ID จุดเป้าหมายจาก create/resubmission, migration และ OpenAPI แล้ว และ deploy ผ่าน merge commit `47f6d59` สำเร็จตาม [GitHub Actions](https://github.com/Nongten1010/POMS-app/actions/runs/35368111474) รวมขั้น migrations และ health check ตรวจ OpenAPI production แล้วพบ summary contract ตรงกับ source ดู [ผลทดสอบและหลักฐาน production](../../../evidence/master-data/poms-edit-request-list-summary.md) ทั้งนี้ยังไม่ได้ตรวจ authenticated GET ของคำขอจริงหรือยืนยัน frontend mapping

การปรับเอกสารรอบนี้เป็นงาน Markdown เท่านั้น ยังไม่ได้แก้หรือทดสอบ frontend mapping และไม่รวม DCON ทีม frontend ใช้คู่มือนี้เตรียมงานได้ แต่ต้องผ่านรายการตรวจรับก่อนเปิดใช้ร่วมกับ backend รุ่นใหม่

## งานปรับตาราง

1. ปรับ `mapEditRequestRows` ให้อ่าน `GET /api/v1/poms-factories/edit-requests` ตาม list summary โดยหนึ่งแถวหมายถึงหนึ่งคำขอ ใช้ `id` ของคำขอสำหรับปุ่มต่าง ๆ
2. แสดงจุดจาก `targetMeasurementPoints[]` ทุกจุดภายในแถวเดิม เช่น เรียงคนละบรรทัด โดยให้ระบบ รหัส และชื่อของแต่ละจุดอยู่คู่กัน ใช้ `connectedPointId` เป็นตัวจับคู่ ห้ามเลือก `[0]` ของ snapshots หรือจับคู่ด้วยชื่อ/รหัสจุด
3. ใช้ `factoryId` ในคอลัมน์เลขทะเบียนใหม่ตาม handoff ไม่สลับกับ `factoryRegistrationNo` ซึ่งมีความหมายเป็นเลขแสดงผลตามกติกาเดิม ทั้งนี้ contract รับรอง `factoryId` ว่าเป็น identifier ที่เก็บในคำขอ ไม่ได้รับรองว่าข้อมูลเก่าทุกแถวเป็นเลขทะเบียนใหม่ หากพบ identifier เก่า ให้ตรวจข้อมูลกับ backend ไม่สร้างเลขแทน
4. อ่านชื่อโรงงานและจังหวัดจาก `factoryName` และ `provinceName` โดยตรง จังหวัดเป็น `null` ให้แสดง `-` ไม่ต้องโหลด API โรงงานเพิ่มทีละแถว ชื่อโรงงานผูกกับคำขอ ส่วนจังหวัดอ่าน active eligible metadata ปัจจุบันตาม contract
5. ใช้ `formType` แสดงชื่อแบบฟอร์ม ใช้ `status` สำหรับเงื่อนไขปุ่ม และ `statusLabel` สำหรับข้อความสถานะ แปลง `submittedAt` เป็นวันที่ตามเขตเวลาแสดงผลของระบบและปี พ.ศ. โดยค่านี้เป็นเวลาส่งรอบล่าสุด
6. รักษา filters และ `meta.total` เดิม ไม่เพิ่มจำนวนแถวหรือยอดรวมตามจำนวนจุด และไม่โหลด detail เพื่อประกอบตารางทีละคำขอ

### การแสดงผลตามหลักฐานจุดเป้าหมาย

อ่าน `targetMeasurementPointsSource` ควบคู่กับรายการจุดเสมอ ความหมายของค่าทั้งสี่และกติกา backend อยู่ใน [หลักฐานจุดเป้าหมายของ contract](../../../api/menus/master-data/factory-edit-requests.md#edit-request-list-summary)

| ค่าที่ได้รับ | แนวทางแสดงผลและข้อควรตรวจ |
| --- | --- |
| `SUBMITTED` | แสดงทุกจุดตาม array ซึ่งอ้างอิง IDs ที่ส่งในรอบล่าสุด รวมจุดที่ส่งค่าเดิมเมื่อมีการเปลี่ยนส่วนอื่น |
| `SNAPSHOT_DIFF` | แสดงจุดที่ได้รับ พร้อมข้อความว่าอนุมานจากข้อมูลก่อน/หลัง ไม่ระบุว่าเป็นรายการที่ผู้ใช้เลือกครบทั้งหมด เพราะจุดที่ส่งค่าเดิมอาจระบุย้อนหลังไม่ได้ |
| `UNKNOWN` | แสดงว่าไม่ทราบจุดเป้าหมาย และใช้ `-` ในคอลัมน์ประเภท/รหัสจุด ห้ามแทนด้วยจุดแรกของโรงงาน |
| `NOT_APPLICABLE` | สำหรับ `BASIC_INFO` แสดงประเภท/รหัสจุดเป็น `-` ไม่แสดงเป็นข้อผิดพลาด |

หาก `pointCode` เป็น `null` หรือว่าง ให้แสดง `-` โดยยังแสดงระบบและชื่อจุดที่มีอยู่ ห้ามสร้างรหัสจำลอง ชื่อหรือรหัสซ้ำต้องไม่ทำให้จุดที่มี `connectedPointId` ต่างกันถูกยุบรวม

## เปิดรายละเอียดและแก้ไขคำขอ

List รุ่นใหม่ไม่มี snapshots, contact arrays, รายละเอียดเครื่องมือ, เอกสารหรือ `events` การเปิดดูและดำเนินการยังต้องโหลดข้อมูลเต็มตาม flow เดิม:

| การใช้งาน | API ที่ใช้ |
| --- | --- |
| เปิดดู/ดำเนินการ/เปรียบเทียบก่อน–หลัง/ประวัติ | [GET edit-request detail](../../../api/menus/master-data/factory-edit-requests.md#get-apiv1poms-factoriesedit-requestsid) |
| เติมฟอร์มคำขอที่ส่งกลับให้แก้ไข | [GET edit-request form](../../../api/menus/master-data/factory-edit-requests.md#get-apiv1poms-factoriesedit-requestsidform) |
| เติมฟอร์มสร้างคำขอจากโรงงานปัจจุบัน | [GET factory form](../../../api/menus/master-data/factory-edit-requests.md#get-apiv1poms-factoriesfactoryidform) |

การสร้าง/ส่งแก้ไขยังส่ง `measurementPoints[].connectedPointId` ตาม contract เดิม ไม่ส่ง `targetMeasurementPoints` หรือ `targetMeasurementPointsSource` กลับใน payload และไม่ใช้ summary แทนข้อมูลเต็มสำหรับเติมฟอร์ม

## รายการตรวจรับ

รายการนี้เป็นสิ่งที่ต้องตรวจใน frontend และสภาพแวดล้อมทดสอบร่วมกัน ไม่ใช่ผลทดสอบที่ผ่านแล้ว ผลทดสอบ backend ที่มีอยู่แยกไว้ใน [evidence](../../../evidence/master-data/poms-edit-request-list-summary.md)

- [ ] Regression fixture ของคำขอ `point-00024/2569` (`id: 48`) แสดง CEMS / S0915 / 10021 แม้ snapshot จะมี WPMS / P0155 / 10024 อยู่ก่อน; การผ่าน fixture ไม่ใช่หลักฐานว่าคำขอจริงบน production ถูกแก้แล้ว
- [ ] หลายระบบ หลายจุด ชื่อซ้ำ รหัสซ้ำ รหัส `null` และการสลับลำดับ snapshots ไม่ทำให้จุดที่แสดงผิดหรือหายไป และยังเป็นหนึ่งแถวต่อคำขอ
- [ ] คำขอที่มีหลักฐาน IDs โดยตรงแสดงจุดครบเมื่อส่งค่าเดิมบางจุดหรือแก้เฉพาะข้อมูลติดต่อ โดยยังผ่านกติกาว่าต้องมีข้อมูลเปลี่ยนอย่างน้อยหนึ่งส่วน
- [ ] หลัง resubmission ตารางใช้เป้าหมายและ `submittedAt` รอบล่าสุด ไม่ค้างข้อมูลรอบเดิม
- [ ] `BASIC_INFO`, คำขอเก่าที่อนุมานได้ และคำขอที่หลักฐานไม่พอ แสดงต่างกันตาม source ทั้งสี่ค่า
- [ ] ชื่อ จังหวัด วันที่ เลขทะเบียน และเงื่อนไขปุ่มตรงกับ fields ที่กำหนด ไม่มีการเอาเลขทะเบียนเดิมแทนคอลัมน์เลขใหม่
- [ ] ไม่มีการเรียก factory/detail เพิ่มทีละแถวเพื่อเติมตาราง; filters, data scope และ `meta.total` ยังทำงานตาม contract
- [ ] เปิดดู/ดำเนินการ/แก้ไข โหลด detail หรือ `/form` ได้ครบ และยังดูเอกสาร ข้อมูลติดต่อ และประวัติได้แม้ list ไม่มีข้อมูลเหล่านี้

## เงื่อนไขก่อนเปิดใช้ร่วมกัน

การตัด snapshots ออกจาก list เป็น breaking change ขั้นตอนย้าย client และ migration ที่ต้องใช้ระบุใน [API changelog](../../../api/CHANGELOG.md#poms-edit-request-list-summary) ให้ประสาน release เมื่อ frontend รองรับ summary แล้ว การมี `connectedPointId` ใน `/form` เพียงอย่างเดียวไม่ยืนยันว่าตารางพร้อม

หลัง deploy ผู้รับผิดชอบ release ต้องตรวจ `https://d-poms.diw.go.th/api/v1/openapi.json` ว่ารายการใช้ `PomsFactoryEditRequestSummary` และตรวจ authenticated GET ของ list/detail/form ด้วยบัญชีที่มีสิทธิ์ รวมถึงเคสคำขอจริงที่รายงาน หาก list ยังไม่มี fields สรุป อย่า fallback ไปเลือกจุดแรก ให้รายงานว่า contract ที่เปิดใช้อยู่ยังไม่ตรงรุ่นและตรวจ release ร่วมกับ backend

## แหล่งอ้างอิงสำหรับผู้ดูแล

- [สัญญา API และตัวอย่าง request/response](../../../api/menus/master-data/factory-edit-requests.md#edit-request-list-summary)
- [OpenAPI source](../../../../../backend/src/modules/api-docs/poms.openapi.ts)
- [การระบุจุดเป้าหมาย](../../../../../backend/src/modules/poms-factories/poms-edit-request-targets.ts)
- [Regression tests](../../../../../backend/tests/unit/poms-factories.list-summary.test.ts)
- [ผลทดสอบและข้อจำกัด](../../../evidence/master-data/poms-edit-request-list-summary.md)
