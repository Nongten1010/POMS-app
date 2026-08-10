# API Breaking Changes

ไฟล์นี้บันทึกเฉพาะการเปลี่ยน API ที่ทำให้ client ต้องแก้ตาม การเปลี่ยนทั่วไปและประวัติรายละเอียดดูจาก Git history

## 2026-08-10 — Dashboard ใช้ค่ารายชั่วโมงที่คำนวณเสร็จแล้ว

- **Affected menu:** [หน้าหลัก](./menus/home/README.md#get-apiv1operator-factory-dashboard)
- **Impact:** `GET /api/v1/operator-factory-dashboard` และ `GET /api/v1/public/factory-map-points` เปลี่ยน `measurementPoints[].data` จาก timestamp ล่าสุดในตาราง `60m` เป็น timestamp ล่าสุดที่ไม่เกินชั่วโมงก่อนหน้าตาม `Asia/Bangkok`; `hasLatestHourlyMeasurement` เป็น `true` เมื่อทุก active point มีข้อมูลตรงกับชั่วโมงก่อนหน้า.
- **Migration:** Frontend ใช้ `measurementPoints[].data` และ `hasLatestHourlyMeasurement` ได้ตามเดิม แต่ต้องคาดหวังว่าเมื่อเรียกเวลา `21:00-21:59` จะแสดงรอบ `20:00` เพราะรอบ `21:00` ยังถือว่าคำนวณไม่เสร็จ; ช่วง `00:00-00:59` จะแสดงรอบ `23:00` ของวันก่อนหน้า.
- **Old contract:** API เลือก timestamp ล่าสุดโดยไม่จำกัด cutoff และตรวจ flag เทียบกับชั่วโมงปัจจุบัน ทำให้ข้อมูลของรอบที่ยังคำนวณไม่เสร็จอาจถูกแสดง.
- **New contract:** API เลือก timestamp ล่าสุดไม่เกินปลายชั่วโมงก่อนหน้า และตรวจ flag เทียบกับวันและชั่วโมงเดียวกันของรอบที่คำนวณเสร็จแล้วล่าสุด.

## 2026-08-10 — ลบฟอร์มข้อมูลจุดตรวจวัดพร้อมโรงงานที่ถูกถอดออกจากเข้าข่าย

- **Affected menu:** [โรงงานที่เข้าข่าย](./menus/eligible-factories/README.md#การถอดโรงงานออกจากเข้าข่าย)
- **Impact:** เมื่อ `DELETE /api/v1/eligible-factories/:id` สำเร็จด้วย `204 No Content`, linked monitoring-point form และ active monitoring points ของฟอร์มนั้นจะถูก soft-delete ไปพร้อมกับ eligible row; client จะใช้ form id เดิมต่อไม่ได้ แต่สามารถสร้างฟอร์มใหม่ของโรงงานเดิมด้วย `POST /api/v1/monitoring-point-forms` โดยไม่พบ duplicate conflict จากฟอร์มเดิม. เมื่อ deploy migration ฟอร์มตกค้างที่ผูกกับ eligible row ซึ่งถูกลบก่อนการเปลี่ยนนี้อาจถูก cleanup ด้วย แม้ไม่มี DELETE ใหม่.
- **Migration:** หลัง DELETE สำเร็จ ให้ล้าง form id และข้อมูลจุดตรวจวัดเดิมออกจาก client state; หากเลือกโรงงานกลับเป็นโรงงานเข้าข่ายอีกครั้ง ให้สร้างฟอร์มใหม่ด้วย `POST` แทนการแก้ form id เดิม. Deploy `0088_soft_delete_forms_for_removed_eligible_factories` เพื่อ soft-delete active orphaned forms/points ที่มีเฉพาะลิงก์จาก deleted eligible rows; migration จะข้ามฟอร์มที่มี active eligible link หรือ active POMS connected point และมี intentionally irreversible `down` ซึ่งไม่ restore ข้อมูลที่ cleanup แล้ว. Client ควร reload ข้อมูลหลัง deploy และยังต้องรองรับ `409 Conflict` ซึ่งไม่ลบ eligible row, form หรือ point ใด ๆ.
- **Old contract:** DELETE soft-delete เฉพาะ `eligible_factories`; linked `factory_monitoring_point_forms` และ `factory_monitoring_points` ยังคง active ทำให้การสร้างฟอร์มใหม่ของโรงงานเดิมอาจตอบ duplicate `409 Conflict`, และข้อมูล orphan ที่เกิดก่อน deploy ยังคงตกค้าง.
- **New contract:** DELETE ทำงานแบบ atomic; เมื่อไม่มี active connected point บน eligible row ปัจจุบันหรือ eligible row เดิมที่อ้าง form เดียวกัน และมี `monitoring_point_form_id` ระบบ soft-delete active points ของฟอร์ม, linked form และ eligible row ใน transaction เดียว. หากไม่มี linked form จะลบเฉพาะ eligible row; หากมี active connected point ตามเงื่อนไขดังกล่าวจะตอบ `409 Conflict` และไม่ลบข้อมูลใด ๆ. Migration `0088` ใช้ safety rules เดียวกันกับ orphan เดิม พร้อม skip ข้อมูลที่ยังมี active eligible link หรือ active connected point.

## 2026-08-10 — แยก citizen/operator persona สำหรับบัญชี i-Industry เดียวกัน

- **Affected API:** [Authentication](./shared/authentication/README.md)
- **Impact:** `POST /api/v1/auth/login` ใช้ credential i-Industry ชุดเดียวกันกับ `userType: "citizen"` หรือ `"operator"`; response และ JWT ใช้ role/permission ของ persona ที่เลือก. Operator request ที่ DIW ส่ง `juristics: []` เปลี่ยนเป็น `200 OK` citizen fallback แทน operator session หรือ `401`. `GET /api/v1/auth/me` รักษา persona จาก signed token แม้ stored user row เดียวกันรองรับทั้งสอง persona. Production access token ถูกจำกัดอายุสูงสุด `15` นาทีและ legacy token ที่ออกเกิน `15` นาทีแล้วจะถูกปฏิเสธหลัง deploy.
- **Migration:** frontend ต้องอ่าน effective `user.userType` และ `user.roleCodes` จาก response หลัง login ทุกครั้ง; เมื่อขอ operator แต่ได้ `userType: "citizen"` ให้พาเข้าหน้า/เมนูประชาชน และห้ามอนุมาน persona จากประเภทที่ผู้ใช้กดก่อนส่ง request. Operator UI ต้องรองรับ `ownedFactoryIds: []` เมื่อมีนิติบุคคลแต่ไม่มี factory ใน payload. เมื่อ API คืน `401` เพราะ access token หมดอายุ ให้ล้าง session และพากลับหน้า login; ผู้ใช้ที่ถือ legacy token อาจต้อง login ใหม่ทันทีหลัง deploy.
- **Old contract:** external citizen path ใช้ i-Industry account เดียวกับ operator ไม่ได้; operator request ได้ operator persona ตาม request และ `/auth/me` rebuild persona จาก stored `users.user_type`.
- **New contract:** citizen request ได้ `public_user`; operator request ได้ `factory_operator` เมื่อ `juristics.length > 0`; operator request ที่ไม่มีนิติบุคคลได้ `public_user` fallback. Persona permission ไม่รวม role อื่น, ยังเคารพ per-user deny/การจำกัด scope และ citizen/operator token ของ account เดียวกันทำงานพร้อมกันได้.

## 2026-08-10 — จำกัดรายการโรงงานทั้งหมดไว้เฉพาะหน้าขอเชื่อมต่อ

- **Affected menus:** [หน้าหลัก](./menus/home/README.md) และ [ขอเชื่อมต่อ](./menus/connection-requests/README.md)
- **Impact:** `GET /api/v1/operator-factory-dashboard` กลับมาคืนเฉพาะโรงงาน current/live ที่มี active `cems_wpms_connected_measurement_points` สำหรับทุก scope รวม `OWN_FACTORY`; `GET /api/v1/cems-wpms-requests/operator-factories` ยังคืนทุกโรงงานที่ owner เข้าถึงได้ พร้อมแถวข้อมูลขั้นต่ำสำหรับโรงงานไม่เข้าข่าย.
- **Migration:** หน้าแรกต้องใช้ `/api/v1/operator-factory-dashboard` และไม่คาดหวัง factory master ที่ยังไม่เชื่อมต่อ; หน้าขอเชื่อมต่อใช้ `/api/v1/cems-wpms-requests/operator-factories` เมื่อต้องแสดงโรงงานของ owner ครบทั้งหมดและแยก action ด้วย `isEligible`/`eligibilityStatus`.
- **Old contract ชั่วคราว:** `/api/v1/operator-factory-dashboard` scope `OWN_FACTORY` ถูกขยายให้คืน active factory master ทุกแห่งของ owner รวมโรงงานไม่เข้าข่ายหรือยังไม่มี connected point.
- **New contract:** dashboard เป็น connected/current-live only ทุก scope และทุก row มี `isEligible: true` กับ `eligibilityStatus: "เข้าข่าย"`; การคืน noneligible minimal row จำกัดอยู่ที่ endpoint หน้าขอเชื่อมต่อเท่านั้น.

## 2026-08-10 — คืนโรงงานทั้งหมดของ owner ในหน้าขอเชื่อมต่อ พร้อมแถวข้อมูลขั้นต่ำสำหรับโรงงานไม่เข้าข่าย

- **Affected menu:** [ขอเชื่อมต่อ](./menus/connection-requests/README.md)
- **Impact:** `GET /api/v1/cems-wpms-requests/operator-factories` คืนทุก active factory ที่ owner เข้าถึงได้ ไม่ตัดโรงงานที่ไม่มี active `eligible_factories`; โรงงานไม่เข้าข่ายส่ง `factoryId`, `factoryName`, `isEligible: false`, `eligibilityStatus: "ไม่เข้าข่าย"` และค่าโครงสร้างที่ปลอดภัย ส่วน descriptive fields เป็น `null`.
- **Migration:** frontend หน้าขอเชื่อมต่อต้องใช้ `isEligible`/`eligibilityStatus` แยก action เข้าข่ายกับไม่เข้าข่าย, รองรับ descriptive fields เป็น `null`, ใช้ `factoryId` เป็นเลขที่โรงงาน และรองรับ array ว่างกับ count `0`.
- **Old contract:** endpoint รายชื่อโรงงานหน้าขอเชื่อมต่ออาจตัดโรงงานไม่เข้าข่ายออก จึงเห็นเพียง 2 โรงงานที่จับคู่ active `eligible_factories` ในกรณีตัวอย่าง 7 โรงงาน.
- **New contract:** owner เห็นครบ 7 โรงงานในหน้าขอเชื่อมต่อ; 2 โรงงานเข้าข่ายได้รายละเอียดและข้อมูล current/live ตามเดิม ส่วน 5 โรงงานไม่เข้าข่ายได้แถวข้อมูลขั้นต่ำโดยไม่ผูก request หรือจุดตรวจวัดเข้ากับ response.

## 2026-08-09 — Calendar Status ใช้สรุปและรายละเอียดทั้งปีแบบหนึ่งแถวต่อวัน

- **Affected API:** [Calendar Status และ Calendar Status details](./shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidcalendar-status)
- **Impact:** `calendar-status.data.monthlySummary[].exceededDays` และ `lowDataDays` เปลี่ยนจากจำนวนของเดือนเป็นจำนวนของทั้งปีที่ระบุใน `month`; endpoint `/calendar-status/details` เปลี่ยน query จาก `month=YYYY-MM` เป็น `year=YYYY` และเปลี่ยน response จาก `data.days[]` แบบหลายเหตุการณ์ต่อวันเป็น `data.rows[]` สูงสุดหนึ่งแถวต่อวัน
- **Migration:** เมื่อผู้ใช้คลิก counter ให้ frontend ส่งปีจาก `calendar.year` เป็น `year`, ใช้ `data.rows` โดยตรง, แสดง `date`/`displayTime`/`value` สำหรับ `summaryType=exceeded` และแสดง `date`/`dataCompletenessPercent` สำหรับ `summaryType=lowData`; อย่าอ่าน `time` ใน low-data row และไม่ต้องส่ง pagination params
- **Old contract:** counters นับเฉพาะเดือน; details รับ `month`, คืน `data.metadata.month`, `meta.month`, `data.days[].exceededOccurrences[]`, `missingTimes`, `lowDataCauses`, `totalExceededOccurrences` และ `totalMissingHours`
- **New contract:** counters นับทั้งปีโดย `calendar.days` ยังเป็นเดือนที่ขอและ `todayDataCompletenessPercent` ยังคงใช้ daily summary ล่าสุดของเดือนที่ขอ; details รับ `year`, คืน `data.metadata.year`, `meta.year`, `summary.affectedDays` และ `data.rows[]` เรียงวันที่ โดย `exceeded` เลือกค่าแรกที่เกินตามเวลาและ `lowData` ไม่มี field เวลา

## 2026-08-09 — CSV export รวม operational status ไว้ในคอลัมน์พารามิเตอร์

- **Affected API:** [Measurement CSV export](./shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidmeasurement-exportcsv)
- **Impact:** `GET /api/v1/connected-measurement-points/:stationId/measurement-export.csv` ตัดคอลัมน์ `<Parameter> Status` ทุกคอลัมน์ออก และ parameter cell เปลี่ยนเป็น mixed value ระหว่าง decimal string กับ operational-status string
- **Migration:** frontend หรือผู้ใช้งานไฟล์ต้องอ่านหนึ่งคอลัมน์ต่อพารามิเตอร์; เมื่อ cell เป็นตัวเลขหมายถึงสถานะปกติ และเมื่อเป็นข้อความให้แสดงเป็น operational status โดยตรง เช่น `Calibration`, `NoData` หรือ `No Discharge`
- **Old contract:** แต่ละพารามิเตอร์มีสองคอลัมน์ `<Parameter>` และ `<Parameter> Status`; สถานะปกติส่ง `value,Normal`, `NoData` เป็นช่องว่าง และ `No Discharge` ถูก map เป็น `Etc.`
- **New contract:** แต่ละพารามิเตอร์มีหนึ่งคอลัมน์; `Normal`, `Ok`, StatusCode `1` หรือสถานะว่างพร้อม numeric value ส่งตัวเลขสองตำแหน่ง ส่วนสถานะอื่นส่งชื่อ operational status แทนตัวเลข; completeness ต่ำกว่า 80% ยังคงเป็นช่องว่าง

## 2026-08-06 — เปลี่ยนข้อกฎหมายยกเว้นพารามิเตอร์จาก array เป็นค่าเดียว

- **Affected menu:** [ขอเชื่อมต่อ](./menus/connection-requests/README.md)
- **Impact:** `POST /api/v1/cems-wpms-requests/measurement-points`, `POST /api/v1/cems-wpms-requests/direct-connections` และ `PUT /api/v1/cems-wpms-requests/:id/form` รับข้อกฎหมายยกเว้นเป็นค่าเดียว; legacy single-item array ยังรับได้ชั่วคราวและ normalize เป็น string แต่ array หลายค่าถูกปฏิเสธด้วย `400 VALIDATION_ERROR`
- **Migration:** เปลี่ยน form state เป็น single selection และส่ง `null` หรือ string ค่าเดียวใน `ไม่มี`, `4(1)`, `4(2)`, `11(3)`, `อื่นๆ` โดยไม่พึ่ง compatibility ของ single-item array; เมื่อเลือก `อื่นๆ` ต้องส่ง `exemptedParameterRegulationClauseOther` ที่ไม่ว่างและยาวไม่เกิน 500 ตัวอักษร และเมื่อเลือกค่าอื่น client ควรส่ง `null`
- **Old contract:** client เดิมอาจส่ง array หนึ่งหรือหลายค่า เช่น `exemptedParameterRegulationClauses: ["4(1)"]`
- **New contract:** canonical write ของ `exemptedParameterRegulationClauses` เป็น `string | null` แม้ชื่อ field เป็นพหูพจน์; backend รับ supported legacy single-item array แล้วเก็บเป็น string, ปฏิเสธ multi-item array และ normalize `exemptedParameterRegulationClauseOther` เป็น `null` เมื่อไม่ได้เลือก `อื่นๆ`; detail ของรายการที่สร้างหรือ resubmit แล้วคืน string ส่วน historical row ที่ยังไม่ถูกบันทึกซ้ำอาจยังคืน legacy array

## 2026-08-04 — Device status schedules รองรับหลายช่วงแบบ validated contract

- **Affected menu:** [ตั้งค่าอุปกรณ์ของจุดตรวจวัด](./menus/connection-requests/device-configs.md) และ [Integration Device Config](./integrations/device-configs/README.md)
- **Impact:** `statusManagement.schedules[]` บังคับ parameter, local datetime รูปแบบ `YYYY-MM-DD HH:mm:ss` โดยไม่มี timezone, status enum และไม่อนุญาตช่วงทับกันของพารามิเตอร์เดียวกัน; Integration API จะขยาย `ทั้งหมด` เป็นชื่อพารามิเตอร์จริงแทนการคืนคำว่า `ทั้งหมด`
- **Migration:** frontend ต้องเก็บทุกรายการที่กดเพิ่มไว้ใน `schedules`, จำกัดไม่เกิน 100 ช่วง และส่งเวลาเช่น `2026-08-05 08:00:00`; Worker ต้องอ่านเวลาแบบ local datetime ไม่มี timezone, อ่านรายการที่เรียงตาม `startAt` และไม่พึ่ง `parameter === "ทั้งหมด"`
- **Old contract:** schedule fields รับ string/null แบบไม่ตรวจ business rule, top-level fields จำเป็นแม้มี `schedules`, และ Integration API อาจคืน `parameter: "ทั้งหมด"`
- **New contract:** `schedules` ที่มีรายการเป็น source of truth และ legacy top-level fields จะถูกละเว้น; payload เดิมที่ใช้ `T`, `Z` หรือ timezone offset ยังรับได้เพื่อ compatibility แต่ backend normalize request, stored legacy data และทุก response เป็น `YYYY-MM-DD HH:mm:ss`; validation ผิดตอบ `400` และ Integration API คืนหนึ่งรายการต่อ configured parameter

## 2026-08-02 — Integration Alert Events รับเวลาเริ่มชั่วโมงเพียงค่าเดียว

- **Affected integration:** [Integration Alert Events](./integrations/alert-events/README.md)
- **Impact:** `POST /api/v1/integrations/alert-events` ไม่รับ `events[].startTime` และ `events[].endTime`; strict validation จะตอบ `400 VALIDATION_ERROR` หาก client ยังส่ง field เดิม
- **Migration:** เปลี่ยนเป็นส่ง `events[].time` รูปแบบ `HH:00` โดยใช้เวลาเริ่มของชั่วโมงที่พบค่าเกิน เช่น `20:00`; backend จะสร้างช่วง `20:00:00` ถึง `20:59:59` ใน timezone `+07:00` ให้เอง
- **Old contract:** แต่ละ event ต้องส่ง `eventDate`, `startTime` รูปแบบ `HH:mm` และ `endTime` รูปแบบ `HH:mm`
- **New contract:** แต่ละ event ต้องส่ง `eventDate` และ `time` รูปแบบต้นชั่วโมง `HH:00`; response ยังคงมี `startedAt`, `endedAt` และ `timeRange`

## 2026-07-31 — รักษารหัสฐานข้อมูลจริงเมื่อบันทึก Device Config จากค่า masked

- **Affected menu:** [ตั้งค่าอุปกรณ์ในเมนูขอเชื่อมต่อ](./menus/connection-requests/device-configs.md)
- **Impact:** POST Device Config จะไม่บันทึก `settings.dbPass = "********"` ทับรหัสจริงอีกต่อไป โดยรักษารหัสเดิมที่มี device key เดียวกัน หรือคืน `400 BAD_REQUEST` เมื่อไม่มีรหัสจริงให้รักษา
- **Migration:** client ใช้ `********` เป็น placeholder สำหรับ “ไม่เปลี่ยนรหัส” ได้ แต่ต้องให้ผู้ใช้กรอกรหัสจริงใหม่เมื่อได้รับ `400 BAD_REQUEST` จากข้อมูลเดิมที่เคยถูกเขียนทับ
- **Old contract:** backend ยอมรับ `********` เป็น password ใหม่และบันทึกลง `settings_json`
- **New contract:** backend รักษารหัสจริงเดิมเมื่อรับ `********`; password ค่าอื่นรวมถึงค่าที่ผู้ใช้กรอกใหม่จะถูกบันทึกตาม request

## 2026-07-31 — Integration Device Config ส่ง database password จริงให้ Worker

- **Affected integration:** [Integration Device Config](./integrations/device-configs/README.md)
- **Impact:** `GET /api/v1/integrations/device-configs/:stationId` เปลี่ยนความหมายของ `deviceConfigs[].dbPass` จาก masked placeholder เป็น database password จริงเมื่อมีการตั้งค่า จึงเป็นข้อมูลลับที่ห้าม cache หรือบันทึกลง log
- **Migration:** จำกัด `DEVICE_CONFIG_API_KEYS` เฉพาะ Worker ที่จำเป็น เรียกผ่าน HTTPS ตรวจว่า client ไม่ log header/response และใช้ค่าจาก `dbPass` เป็น credential จริง; response มี `Cache-Control: no-store`
- **Old contract:** `dbPass` เป็น `********` เมื่อมีค่า และเป็น `null` เมื่อไม่ได้ตั้ง
- **New contract:** `dbPass` เป็น password จริงเมื่อมีค่า และเป็น `null` เมื่อไม่ได้ตั้ง โดย endpoint อื่นยังคง mask password

## 2026-07-24 — คืนรหัสจุดตรวจวัดที่ออกหลังอนุมัติเป็น S/W เริ่มที่ 2001

- **Affected menu:** [ขอเชื่อมต่อ](./menus/connection-requests/README.md)
- **Impact:** `measurementPoints[].pointCode` ที่ backend ออกใหม่หลังอนุมัติแบบผู้ประกอบการเปลี่ยนกลับเป็น `S...`/`W...`; Direct Connection ยังคงใช้รหัสที่เจ้าหน้าที่กรอกเอง.
- **Migration:** client ต้องรับรหัสจุดเป็น opaque string และรองรับ `S2001`, `S2002`, ... สำหรับ CEMS กับ `W2001`, `W2002`, ... สำหรับ WPMS; การรองรับรหัสที่มี `/` เดิมยังคงไว้เพื่อ backward compatibility.
- **Old contract:** CEMS ออก `CEMS-NNNN/YYYY` และ WPMS ออก `WEMS-NNNN/YYYY` โดยเริ่ม sequence ใหม่ทุกปี พ.ศ.
- **New contract:** CEMS ออก `S2001`, `S2002`, ... และ WPMS ออก `W2001`, `W2002`, ... โดยแยก sequence ตามระบบและไม่เริ่มใหม่เมื่อเปลี่ยนปี.

## 2026-07-24 — เปลี่ยนรูปแบบเลขที่คำขอเชื่อมต่อเป็นลำดับ 4 หลักและปี พ.ศ. เต็ม

- **Affected menu:** [ขอเชื่อมต่อ](./menus/connection-requests/README.md)
- **Impact:** `requestNo` ของคำขอ CEMS/WPMS ที่สร้างใหม่เปลี่ยนรูปแบบทั้งคำขอผู้ประกอบการและ Direct Connection; ฟิลด์และกติกาของรหัสจุดตรวจวัดไม่เปลี่ยน.
- **Migration:** client ต้องรองรับ `/` ใน `requestNo`, แสดงค่าเป็น opaque string และไม่แยกปีหรือลำดับจากรูปแบบเดิม.
- **Old contract:** คำขอใหม่ใช้ `CEMS-YY-NNNNN` หรือ `WPMS-YY-NNNNN`.
- **New contract:** คำขอใหม่ใช้ `CEMS-NNNN/YYYY` หรือ `WEMS-NNNN/YYYY` เช่น `CEMS-0001/2569` และ `WEMS-0001/2569`; ลำดับแยกตามระบบและเริ่มใหม่ตามปี พ.ศ. โดยผู้ประกอบการกับเจ้าหน้าที่ใช้ลำดับร่วมกัน.

## 2026-07-24 — ใช้เลขที่คำขอชุดเดียวกันสำหรับ Direct Connection

- **Affected menu:** [ขอเชื่อมต่อ](./menus/connection-requests/README.md)
- **Impact:** `requestNo` ใน response ของ `POST /api/v1/cems-wpms-requests/direct-connections` เปลี่ยน prefix สำหรับรายการใหม่; สถานะ `CONNECTED`, `submissionSource=OFFICER_DIRECT_API` และรหัสจุดที่เจ้าหน้าที่กรอกเองไม่เปลี่ยน.
- **Migration:** client ต้องแยก Direct Connection ด้วย `submissionSource` แทนการตรวจ prefix `OLDC`/`OLDW` และต้องรองรับเลขชุดเดียวกับคำขอผู้ประกอบการ.
- **Old contract:** Direct Connection ใช้ `OLDC-YY-NNNNN` สำหรับ CEMS และ `OLDW-YY-NNNNN` สำหรับ WPMS โดยมี sequence แยก.
- **New contract ณ เวลาที่เปลี่ยน:** Direct Connection ใช้ลำดับร่วมกับคำขอผู้ประกอบการของระบบและปีเดียวกัน; รูปแบบ `CEMS-YY-NNNNN`/`WPMS-YY-NNNNN` ถูกแทนที่ภายหลังด้วยรายการ breaking change ด้านบน.

## 2026-07-24 — เปลี่ยนรูปแบบเลขรายงานความคลาดเคลื่อน BOD/COD และแยก running ตามภาคกับปี

- **Affected menu:** [รายงานค่าความคลาดเคลื่อน BOD/COD Online](./menus/bod-cod-deviation-reports/README.md)
- **Impact:** `reportNo` ของรายงานที่สร้างใหม่มี `/` และเปลี่ยนรูปแบบ; client ที่ validate, sort หรือแยกส่วนเลขตามรูปแบบเดิมต้องปรับให้ใช้เป็น opaque string
- **Migration:** รองรับ `BODCOD-YYYY-NNNN` สำหรับข้อมูลเดิมและ `Error-RR-NNNN/YYYY` สำหรับข้อมูลใหม่ ไม่ต้องส่ง `regionCode` เพิ่มเพราะ backend หา region จากข้อมูลโรงงาน และต้อง URL-encode หากนำเลขไปใช้เป็น path/query value
- **Old contract:** รายงานใหม่ใช้ running รวมรายปีรูปแบบ `BODCOD-2569-0001`
- **New contract:** รายงานใหม่ใช้ `Error-02-0001/2569` เป็นต้น โดย running แยกตาม `ภาค + ปีรายงาน พ.ศ.` ใช้ร่วมกันระหว่าง BOD/COD และรอบ 1-2 และจำกัดลำดับที่ `0001`-`9999`

## 2026-07-24 — เปลี่ยนรูปแบบเลขคำขอ กวภ. และแยก running ตามแบบ ภาค และปี

- **Affected menu:** [แจ้งแบบ กวภ. 01 - กวภ. 05](./menus/kwp-forms/README.md)
- **Impact:** ค่า `requestNo` ของคำขอที่สร้างใหม่มี `/` และเปลี่ยนรูปแบบ; client ที่ validate, sort หรือแยกส่วนเลขตามรูปแบบเดิมต้องปรับให้ใช้เป็น opaque string
- **Migration:** รองรับทั้ง `KWP-YY-NNNNN` สำหรับข้อมูลเดิมและ `FNN-RR-NNNN/YYYY` สำหรับข้อมูลใหม่ ไม่ต้องส่ง `regionCode` เพิ่มเพราะ backend หา region จากข้อมูลโรงงาน
- **Old contract:** กวภ.01-กวภ.05 ใช้ running รวมรายปีรูปแบบ `KWP-69-00001`
- **New contract:** ใช้ `F01-04-0001/2569` เป็นต้น โดย running แยกตาม `แบบ + ภาค + ปี พ.ศ.` และจำกัดลำดับที่ `0001`-`9999`

## 2026-07-24 — เปลี่ยนรหัสจุดตรวจวัดที่ออกใหม่เป็นลำดับรายปี

- **Affected menu:** [ขอเชื่อมต่อ](./menus/connection-requests/README.md)
- **Impact:** `measurementPoints[].pointCode` ที่ backend ออกใหม่หลังอนุมัติแบบเปลี่ยนรูปแบบ และมี `/` อยู่ใน identifier; client ที่ส่งรหัสผ่าน path parameter ต้อง URL-encode path segment.
- **Migration:** รองรับ `CEMS-NNNN/YYYY` และ `WEMS-NNNN/YYYY`, ใช้ `encodeURIComponent(pointCode)` เมื่อนำไปวางใน path และยังคงรับรหัสเดิมเป็น opaque identifier โดยไม่แปลงค่า.
- **Old contract:** CEMS ออก `S2001`, `S2002`, ... และ WPMS ออก `W2001`, `W2002`, ... โดยใช้ลำดับต่อเนื่องแยกตามระบบแต่ไม่แยกปี.
- **New contract ณ เวลาที่เปลี่ยน:** CEMS ออก `CEMS-0001/2569`, `CEMS-0002/2569`, ... และ WPMS ออก `WEMS-0001/2569`, `WEMS-0002/2569`, ...; contract นี้ถูกแทนที่ภายหลังด้วยรายการคืนรหัสเป็น `S2001`/`W2001` ด้านบน.

## 2026-07-22 — จำกัดรายชื่อโรงงานของผู้ประกอบการไว้ที่โรงงานเข้าข่าย (ยกเลิกแล้ว 2026-08-10)

- **Affected menu:** [ขอเชื่อมต่อ](./menus/connection-requests/README.md)
- **Impact ณ เวลาที่เปลี่ยน:** `GET /api/v1/cems-wpms-requests/operator-factories` หยุดส่งโรงงานที่ user เข้าถึงได้แต่ไม่มี active `eligible_factories`.
- **Migration ณ เวลาที่เปลี่ยน:** client ถูกกำหนดไม่ให้ใช้ endpoint นี้เป็นรายการโรงงานทั้งหมดของ user.
- **Old contract:** ใช้ `factories` เป็นฐานข้อมูลโรงงานและ left join `eligible_factories` เพื่อเสริมข้อมูล จึงส่งได้ทั้งโรงงานเข้าข่ายและไม่เข้าข่าย.
- **New contract ณ เวลาที่เปลี่ยน:** รับเฉพาะ active `eligible_factories`; contract นี้ถูกยกเลิกเมื่อ 2026-08-10 และ contract ปัจจุบันกลับมาคืนทุกโรงงานที่ owner เข้าถึงได้ พร้อม `isEligible` และ `eligibilityStatus`.

## 2026-07-21 — เปลี่ยน prefix รหัสจุดตรวจวัด WPMS ที่ออกใหม่

- **Affected menu:** [ขอเชื่อมต่อ](./menus/connection-requests/README.md)
- **Impact:** client หรือ integration ที่ตรวจรูปแบบรหัส WPMS ใหม่เป็น `P` ต้องรองรับ `W`; รหัส `Pxxxx` เดิมยังคงอยู่และยังใช้เป็น identifier เดิม
- **Migration:** ปรับ validation, regex, routing หรือ table-name mapping ที่อนุมาน prefix ให้รองรับรหัสใหม่ `W2001`, `W2002`, ... พร้อมคงการรองรับ `Pxxxx` เดิม
- **Old contract:** จุด WPMS ที่ backend ออกให้อัตโนมัติใช้ `P0001`, `P0002`, ...
- **New contract:** จุด WPMS ที่ backend ออกให้อัตโนมัติเริ่มขั้นต่ำที่ `W2001` และเรียงต่อไป; จุด CEMS เริ่มขั้นต่ำที่ `S2001`

## Entry Format

```md
## YYYY-MM-DD — <ชื่อการเปลี่ยน>

- **Affected menu:** [<ชื่อเมนู>](./menus/<menu-slug>/README.md)
- **Impact:** <สิ่งที่ client เดิมจะพบ>
- **Migration:** <ขั้นตอนที่ client ต้องทำ>
- **Old contract:** <field/path/behavior เดิม>
- **New contract:** <field/path/behavior ใหม่>
```

ห้ามใช้ไฟล์นี้แทนรายละเอียด contract ปัจจุบัน รายการทุกอันต้องลิงก์ไปยัง canonical page ที่อัปเดตแล้ว
