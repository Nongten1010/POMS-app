# Chat: การเปิดเรื่องและติดตามปัญหา

> Owner: Backend

## เริ่มเชื่อมต่อจาก frontend

รายการไฟล์และขั้นตอนเปลี่ยน mockup เป็นการใช้งานจริงอยู่ที่ [ส่งต่อ frontend: เชื่อมหน้า Chat](../../../guides/frontend-handoffs/chat/README.md)

Chat เป็นการเปิด Ticket พร้อมข้อความแรกเพื่อสอบถามหรือแจ้งปัญหา ผู้ประกอบการ เจ้าหน้าที่ และผู้ดูแลเปิดเรื่อง ติดตาม และตอบได้ตามสิทธิ์การทำงานและขอบเขตโรงงานที่ได้รับ ระบบโหลดข้อมูลเมื่อเข้าหน้า เปิด Ticket หรือกดรีเฟรช ไม่มี polling หรือ WebSocket

1. เรียก `GET /chat/options` เพื่อแสดงบัญชีปัจจุบัน หัวข้อ และสิทธิ์เปิดเรื่อง
2. เรียก `GET /chat/factories` แล้ว `GET /chat/factories/:id/measurement-points` เพื่อเลือกโรงงานและจุดตรวจวัด ถ้าไม่เลือกจุดให้ส่ง `measurementPoint: null`
3. เปิดเรื่องด้วย `POST /chat/tickets` พร้อมข้อความแรกและ `Idempotency-Key` ใหม่ เก็บ key เดิมไว้เมื่อจำเป็นต้องส่งคำขอเดิมซ้ำ
4. เรียกรายการ `GET /chat/tickets` และรายละเอียด/ข้อความเมื่อเปิดสนทนา ใช้ `capabilities` ตัดสินว่าจะแสดงปุ่มตอบและปิดหรือไม่
5. หลังส่งข้อความหรือปิด Ticket ใช้ผลตอบกลับปรับสถานะทันที แล้วรีเฟรชรายการเมื่อจำเป็น

ทุก path ด้านล่างมี prefix `/api/v1` และใช้ [Bearer authentication](../../shared/authentication/README.md) ตัวอย่างใช้ token จาก environment ของผู้ทดสอบ:

```bash
curl "$BASE_URL/api/v1/chat/options" \
  --header "Authorization: Bearer $ACCESS_TOKEN"

curl "$BASE_URL/api/v1/chat/tickets" \
  --request POST \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header 'Content-Type: application/json' \
  --header 'Idempotency-Key: 7c66b2a3-0b21-4eba-b5e8-2fe377bccb01' \
  --data '{"eligibleFactoryId":10,"measurementPoint":null,"topicCode":"other","message":"ต้องการสอบถามขั้นตอนการใช้งาน"}'
```

## สิทธิ์และขอบเขตข้อมูล

| การทำงาน | เงื่อนไข |
| --- | --- |
| อ่านตัวเลือก `/options` | `chat:view` |
| อ่านโรงงาน รายการ Ticket รายละเอียด และข้อความ | `chat:view` และขอบเขตปัจจุบันจาก `eligible_factories:view` |
| เปิด Ticket | `chat:view` และขอบเขตปัจจุบันจาก `eligible_factories:view` ใช้ได้กับผู้ประกอบการ เจ้าหน้าที่ และผู้ดูแล |
| ส่งข้อความและปิด Ticket | `chat:view` และขอบเขตปัจจุบันจาก `eligible_factories:view` ไม่จำกัดเฉพาะผู้สร้าง Ticket |

ในหน้าจัดการสิทธิ์ ช่อง **มีสิทธิ์ใช้งาน** คือ `permissions.chat.view` และบันทึกเป็น `chat:view` เพียงช่องนี้ก็เปิดเรื่อง ส่งข้อความ และปิด Ticket ที่อยู่ในขอบเขตได้ทันที ทั้งสิทธิ์ที่บันทึกอยู่เดิมและการบันทึกใหม่ ไม่ต้องมี `chat:ask` หรือ `chat:answer` เพิ่ม

ช่อง **ตอบคำถาม (Admin)** คือ `permissions.chat.edit` ซึ่งยังบันทึกเป็น `chat:answer` ตามเดิมและไม่เปลี่ยน role บัญชี ระบบยังรับและคืน legacy `chat:ask`/`chat:answer` เพื่อความเข้ากันได้ แต่ไม่ใช้เป็นเงื่อนไขเพิ่มของ Chat endpoints เมื่อถอน `chat:view` จะใช้ Chat ไม่ได้แม้ยังมีสิทธิ์ legacy เหล่านี้ ดูรูปแบบการบันทึกที่ [จัดการสิทธิ์การใช้งาน](../permissions/README.md)

Backend โหลดสิทธิ์ปัจจุบันทุก request และตรวจขอบเขตโรงงานทุกครั้ง รวมถึงการส่งซ้ำด้วย idempotency key เดิม ผู้ดูแลไม่มีทางข้ามสิทธิ์หรือขอบเขต ผู้ประกอบการต้องมีความสัมพันธ์โรงงานที่ยังมีผลแม้ได้รับ scope `ALL` ไม่ใช้ชื่อ role, จังหวัด, เลขทะเบียน หรือ `userId` ที่ client ส่งมาเพื่อให้สิทธิ์

ถ้า scope โรงงานหายไป ใช้ไม่ได้ หรือข้อมูลกำหนดพื้นที่ไม่ครบ ผลรายการจะว่างและ resource นอกขอบเขตตอบ `404` ส่วนการขาด `chat:view` ตอบ `403` ผลตอบกลับหลังผ่าน authentication ใช้ `Cache-Control: private, no-store`

โรงงานในเมนูนี้อ้างถึง `eligible_factories` โดยเลือกได้แม้ยังไม่เชื่อมต่อ POMS หรือยังไม่มีจุดตรวจวัด หากบัญชีมีสิทธิ์เข้าถึงอยู่แล้ว การกรอกเลขทะเบียนเองไม่สร้างสิทธิ์ให้ผู้ใช้ ส่วนข้อมูลโรงงาน current/live ใน POMS คือ active rows ใน `cems_wpms_connected_measurement_points` และตาราง `factories` ใช้ประกอบการยืนยันตัวตน/สิทธิ์โรงงาน

สำหรับ operator หรือ scope `OWN_FACTORY` ต้องจับคู่ตัวตนโรงงานได้เพียงหนึ่ง master โดยนับรวม master ที่ถูกลบด้วย จากนั้นจึงตรวจว่า master และความสัมพันธ์สิทธิ์ปัจจุบันยังใช้งานอยู่ หาก source ID/เลขทะเบียนชี้คนละโรงงาน หรือเลขทะเบียนเดิมถูกนำมาใช้ซ้ำ จะไม่เปิดเผยข้อมูลจนแก้ความกำกวมของตัวตนโรงงาน

เมื่อตัดสิทธิ์หรือถอดโรงงานออก ข้อมูล Ticket และประวัติยังถูกเก็บแต่ API ตัดสินการมองเห็นด้วยสิทธิ์ปัจจุบัน ไม่โยงประวัติไปยังโรงงานใหม่เพียงเพราะมีเลขทะเบียนเดิม หากคืนโรงงาน ID เดิมและคืนสิทธิ์จึงกลับมาเห็นได้ จุดตรวจวัดที่ถูกถอดภายหลังไม่ทำให้ประวัติ Ticket สูญหาย และไม่โยงไปยังจุดใหม่ที่นำรหัสเดิมมาใช้

## รายการ endpoint

| งาน | Method | Path | ผลสำเร็จ |
| --- | --- | --- | --- |
| ตัวเลือกและบัญชีปัจจุบัน | `GET` | `/chat/options` | `200` |
| โรงงานที่เลือกได้ | `GET` | `/chat/factories` | `200` |
| จุดตรวจวัดของโรงงาน | `GET` | `/chat/factories/:id/measurement-points` | `200` |
| รายการ Ticket | `GET` | `/chat/tickets` | `200` |
| เปิด Ticket พร้อมข้อความแรก | `POST` | `/chat/tickets` | `201` สร้างใหม่, `200` ส่งซ้ำ |
| รายละเอียด Ticket | `GET` | `/chat/tickets/:id` | `200` |
| ข้อความและสถานะปัจจุบัน | `GET` | `/chat/tickets/:id/messages` | `200` |
| ส่งข้อความ | `POST` | `/chat/tickets/:id/messages` | `201` ส่งใหม่, `200` ส่งซ้ำ |
| ปิด Ticket | `POST` | `/chat/tickets/:id/close` | `200` |

## โครงสร้างข้อมูลร่วม

ทุกผลสำเร็จมี `success: true` รายการโรงงาน/Ticket วาง `data` และ `pagination` ที่ระดับบนสุด ส่วนผลข้อความวาง pagination ภายใน `data`

| โครงสร้าง/field | Type | Nullable | ความหมาย |
| --- | --- | --- | --- |
| `ChatActor.userId` | integer | ไม่ | ID บัญชีที่คงที่ ใช้เปรียบเทียบว่าเป็นข้อความของผู้ใช้ปัจจุบัน |
| `ChatActor.name`, `roleCode`, `roleLabel` | string | ไม่ | ชื่อและบทบาทแสดงผล; ในข้อความและเหตุการณ์เป็น snapshot ณ เวลาทำรายการ |
| `ChatFactory.id` | integer | ไม่ | ID โรงงานที่เข้าข่าย |
| `ChatFactory.name`, `registrationNo`, `provinceName` | string | ไม่ | ชื่อโรงงาน เลขทะเบียน และจังหวัด; ใน Ticket เป็น snapshot เมื่อเปิดเรื่อง |
| `ChatFactory.regionName` | string | ได้ | ภาคของโรงงาน; ใน Ticket เป็น snapshot เมื่อเปิดเรื่อง |
| `ChatMeasurementPoint.kind` | `eligible` / `connected` | ไม่ | ชนิดแหล่งอ้างอิง; ใช้ร่วมกับ `id` เสมอ |
| `ChatMeasurementPoint.id` | integer | ไม่ | ID ของจุดในแหล่งที่ระบุ |
| `ChatMeasurementPoint.systemType` | `CEMS` / `WPMS` | ไม่ | ระบบตรวจวัด |
| `ChatMeasurementPoint.pointCode` | string | ได้ | รหัสแสดงผล; จุดเตรียมเชื่อมต่ออาจยังไม่มีรหัส |
| `ChatMeasurementPoint.pointName` | string | ไม่ | ชื่อจุดตรวจวัด |
| `ChatMessage.id`, `ticketId` | integer | ไม่ | ID ข้อความและ Ticket |
| `ChatMessage.text` | string | ไม่ | ข้อความ plain text; frontend แสดงเป็นข้อความ ไม่ประมวลผล HTML |
| `ChatMessage.sender` | `ChatActor` | ไม่ | ผู้ส่งจริงจากบัญชีบน server |
| `ChatMessage.createdAt` | string date-time | ไม่ | เวลาส่ง UTC |
| `ChatEvent.id` | integer | ไม่ | ID เหตุการณ์ |
| `ChatEvent.type` | `opened` / `closed` | ไม่ | การเปิดหรือปิดเรื่อง แยกจากข้อความ |
| `ChatEvent.actor`, `createdAt` | `ChatActor`, string date-time | ไม่ | ผู้ดำเนินการและเวลา UTC |
| `ChatPagination.page`, `pageSize` | integer | ไม่ | หน้าปัจจุบันและจำนวนต่อหน้า |
| `ChatPagination.total`, `totalPages` | integer | ไม่ | จำนวนรายการและจำนวนหน้าตามสิทธิ์และตัวกรอง |

โครงสร้าง Ticket ที่ใช้ร่วมกัน:

| Field | Type | Nullable | ความหมาย |
| --- | --- | --- | --- |
| `id` | integer | ไม่ | ID สำหรับเรียก API |
| `ticketNo` | string | ไม่ | เลขแสดงผล `TK-69-00001`; ปี พ.ศ. 2 หลักตาม `Asia/Bangkok` และเลขลำดับเริ่มใหม่ทุกปี |
| `topic.code`, `topic.label` | string | ไม่ | รหัสหัวข้อและชื่อแสดงผล |
| `factory` | `ChatFactory` | ไม่ | โรงงานของ Ticket |
| `measurementPoint` | `ChatMeasurementPoint` | ได้ | snapshot จุดที่เลือก; `null` หมายถึงเรื่องระดับโรงงาน ไม่ใช่การแนบทุกจุด |
| `status` | `open` / `closed` | ไม่ | สถานะ Ticket |
| `openedBy`, `openedAt` | `ChatActor`, string date-time | ไม่ | ผู้เปิดเรื่องและเวลาเปิด UTC |
| `closedBy`, `closedAt` | `ChatActor`, string date-time | ได้ | ผู้ปิดและเวลาปิด; `null` ขณะเปิด |
| `lastMessageAt` | string date-time | ไม่ | เวลาข้อความล่าสุด UTC; ปิด Ticket ไม่เปลี่ยนค่านี้ |
| `capabilities.canReply`, `capabilities.canClose` | boolean | ไม่ | สิทธิ์ของผู้เรียกปัจจุบันร่วมกับสถานะ Ticket |
| `events` | `ChatEvent[]` | ไม่ | มีใน `ChatTicketDetail` เท่านั้น ไม่มีในรายการ `ChatTicketSummary` |

วันเวลาที่ตอบกลับเป็น UTC ให้ frontend แสดงตามเขตเวลาที่ต้องการ เลขลำดับ Ticket สูงสุด `99999` ต่อปี หากเต็มระบบตอบ conflict โดยไม่สร้าง Ticket หรือข้อความครึ่งหนึ่ง

## `GET /chat/options`

ข้อมูลเริ่มต้นของหน้า ต้องมี `chat:view` ไม่ต้องส่ง body หรือ query การมี `canCreate=true` ยังไม่รับรองสิทธิ์ในโรงงานที่เลือก

| Request field | Location | Type | Required | คำอธิบาย |
| --- | --- | --- | --- | --- |
| `Authorization` | header | string | ใช่ | Bearer access token |

Request JSON: `{}` หมายถึงไม่มี body สำหรับ GET

| Response field | Type | Nullable | คำอธิบาย |
| --- | --- | --- | --- |
| `data.viewer` | `ChatActor` | ไม่ | บัญชีปัจจุบัน |
| `data.topics` | `{code,label}[]` | ไม่ | หัวข้อที่ backend รองรับ |
| `data.limits.messageMaxLength` | integer | ไม่ | `2000` |
| `data.canCreate` | boolean | ไม่ | เป็น `true` เมื่อมี `chat:view` จากช่องมีสิทธิ์ใช้งาน; ยังต้องเลือกโรงงานที่มีสิทธิ์ |

```json
{"success":true,"data":{"viewer":{"userId":101,"name":"ผู้ประกอบการตัวอย่าง","roleCode":"factory_operator","roleLabel":"ผู้ประกอบการ"},"topics":[{"code":"factory_access","label":"ข้อมูลโรงงานและสิทธิ์การใช้งาน"},{"code":"connection_data","label":"การขอเชื่อมต่อและการส่งข้อมูล"},{"code":"measurements_alerts","label":"ผลตรวจวัดและการแจ้งเตือน"},{"code":"forms_reports","label":"แบบฟอร์มและการยื่นรายงาน"},{"code":"form_legal_guidance","label":"ข้อมูลในแบบฟอร์ม กฎหมายและประกาศฯ"},{"code":"other","label":"อื่นๆ"}],"limits":{"messageMaxLength":2000},"canCreate":true}}
```

## `GET /chat/factories`

คืนโรงงานในขอบเขตปัจจุบัน รวมโรงงานที่ยังไม่มีจุดตรวจวัด ใช้สิทธิ์อ่าน

| Request field | Location | Type | Required | คำอธิบาย |
| --- | --- | --- | --- | --- |
| `q` | query | string | ไม่ | trim; 1–200 ตัวอักษร; ค้นชื่อโรงงาน/เลขทะเบียน |
| `page` | query | integer 1–1,000,000 | ไม่ | ค่าเริ่มต้น `1` |
| `pageSize` | query | `25` / `50` / `100` | ไม่ | ค่าเริ่มต้น `25` |

ตัวอย่าง query ในรูป JSON (ส่งเป็น URL query ไม่ใช่ body):

```json
{"page":1,"pageSize":25}
```

| Response field | Type | Nullable | คำอธิบาย |
| --- | --- | --- | --- |
| `data` | `ChatFactory[]` | ไม่ | รายการโรงงานที่มีสิทธิ์ |
| `pagination` | `ChatPagination` | ไม่ | จำนวนตามตัวกรองและสิทธิ์ |

```json
{"success":true,"data":[{"id":10,"name":"โรงงานตัวอย่าง","registrationNo":"EXAMPLE-001","provinceName":"ระยอง","regionName":"ภาคตะวันออก"}],"pagination":{"page":1,"pageSize":25,"total":1,"totalPages":1}}
```

## `GET /chat/factories/:id/measurement-points`

คืนตัวเลือกจุดที่ยังใช้งานสำหรับโรงงานนั้น ใช้สิทธิ์อ่าน ตรวจความเป็นเจ้าของจุดอีกครั้งเมื่อสร้าง Ticket ห้ามใช้ `pointCode` เป็นตัวระบุหรือรวมจุดที่ชื่อ/รหัสตรงกันเอง

| Request field | Location | Type | Required | คำอธิบาย |
| --- | --- | --- | --- | --- |
| `id` | path | positive integer | ใช่ | `ChatFactory.id` |

ตัวอย่าง path parameters: `{"id":10}` ไม่มี request body

| Response field | Type | Nullable | คำอธิบาย |
| --- | --- | --- | --- |
| `data` | `ChatMeasurementPoint[]` | ไม่ | `[]` เมื่อไม่มีจุด; ผู้ใช้ยังเปิดเรื่องระดับโรงงานได้ |

```json
{"success":true,"data":[{"kind":"eligible","id":501,"systemType":"CEMS","pointCode":null,"pointName":"ปล่องตัวอย่าง"}]}
```

`kind=eligible` อ้างจุดในแบบข้อมูลโรงงานที่เข้าข่าย ส่วน `kind=connected` อ้างจุด current/live ที่เชื่อมต่อแล้ว ID คนละชนิดอาจมีเลขเท่ากันได้ จุด connected ที่สร้างใหม่หลังซิงก์หรือใช้รหัสเดิมจะไม่แทนที่อัตลักษณ์ที่ Ticket เดิมอ้างถึง

## `GET /chat/tickets`

ใช้สิทธิ์อ่าน คืนเฉพาะรายการในขอบเขตปัจจุบัน ไม่มีข้อความหรือประวัติเหตุการณ์ทั้งหมดในแต่ละแถว

| Request field | Location | Type | Required | คำอธิบาย |
| --- | --- | --- | --- | --- |
| `page`, `pageSize` | query | integer | ไม่ | เช่นเดียวกับรายการโรงงาน |
| `q` | query | string | ไม่ | trim; 1–200 ตัวอักษร; ค้นเลข Ticket หัวข้อ ชื่อ/เลขทะเบียนโรงงาน จังหวัด และภาคใน snapshot |
| `status` | query | `open` / `closed` | ไม่ | กรองสถานะ |
| `topicCode` | query | topic code | ไม่ | หนึ่งใน 6 หัวข้อจาก `/options` |
| `eligibleFactoryId` | query | positive integer | ไม่ | กรองโรงงานโดยยังตรวจขอบเขต |
| `regionName`, `provinceName` | query | string | ไม่ | กรองพื้นที่ใน snapshot Ticket; trim; ความยาว 1–100 / 1–128 ตามลำดับ การให้สิทธิ์ยังใช้พื้นที่โรงงานปัจจุบัน |
| `from`, `to` | query | string date-time | ไม่ | ขอบเขตเวลาของข้อความล่าสุด รวมเวลาขอบเขตทั้งสองด้าน; รับ ISO 8601 ที่มี timezone (`Z` หรือ offset) และแปลงเป็น UTC; `from <= to` |
| `sort` | query | enum | ไม่ | `lastMessageAt` (ค่าเริ่มต้น), `ticketNo`, `topic`, `factoryName`, `registrationNo`, `regionName`, `provinceName`, `status` |
| `order` | query | `asc` / `desc` | ไม่ | ค่าเริ่มต้น `desc`; ใช้ ID เป็นลำดับรองเมื่อค่าเท่ากัน |

ตัวอย่าง query:

```json
{"page":1,"pageSize":25,"status":"open","sort":"lastMessageAt","order":"desc"}
```

| Response field | Type | Nullable | คำอธิบาย |
| --- | --- | --- | --- |
| `data` | `ChatTicketSummary[]` | ไม่ | ใช้โครงสร้าง Ticket ด้านบนโดยไม่มี `events` |
| `pagination` | `ChatPagination` | ไม่ | จำนวนหลังกรองขอบเขตและเงื่อนไข |

```json
{"success":true,"data":[{"id":1,"ticketNo":"TK-69-00001","topic":{"code":"other","label":"อื่นๆ"},"factory":{"id":10,"name":"โรงงานตัวอย่าง","registrationNo":"EXAMPLE-001","provinceName":"ระยอง","regionName":"ภาคตะวันออก"},"measurementPoint":null,"status":"open","openedBy":{"userId":101,"name":"ผู้ประกอบการตัวอย่าง","roleCode":"factory_operator","roleLabel":"ผู้ประกอบการ"},"openedAt":"2026-10-17T03:00:00.000Z","closedBy":null,"closedAt":null,"lastMessageAt":"2026-10-17T03:00:00.000Z","capabilities":{"canReply":true,"canClose":true}}],"pagination":{"page":1,"pageSize":25,"total":1,"totalPages":1}}
```

รายการเป็นข้อมูลปัจจุบัน เมื่อมีข้อความใหม่ระหว่างเปลี่ยนหน้าหรือรีเฟรช แถวอาจเลื่อนหน้าได้ ไม่มี snapshot ของทั้งชุดผลลัพธ์

## `POST /chat/tickets`

ต้องมี `chat:view` และเข้าถึงโรงงานตามขอบเขต `eligible_factories:view` ใช้ได้กับผู้ประกอบการ เจ้าหน้าที่ และผู้ดูแล สร้าง Ticket เหตุการณ์เปิด และข้อความแรกเป็นงานเดียวกัน ถ้าส่วนใดไม่สำเร็จจะไม่เหลือ Ticket ว่าง

| Request field | Location | Type | Required | คำอธิบาย |
| --- | --- | --- | --- | --- |
| `Idempotency-Key` | header | UUID string | ใช่ | normalize เป็นตัวพิมพ์เล็ก; key ใหม่ต่อการเปิดเรื่องหนึ่งครั้ง; ใช้ key เดิมเฉพาะ retry payload เดิม |
| `eligibleFactoryId` | body | positive integer | ใช่ | โรงงานที่อยู่ในขอบเขต |
| `measurementPoint` | body | object / null | ไม่ | ค่าเริ่มต้น `null` สำหรับเรื่องระดับโรงงาน หรือ `{kind,id}` สำหรับจุดเดียว |
| `measurementPoint.kind` | body | `eligible` / `connected` | เมื่อเป็น object | แหล่งของ ID จุด |
| `measurementPoint.id` | body | positive integer | เมื่อเป็น object | จุดที่ยังใช้งานและเป็นของโรงงานที่เลือก |
| `topicCode` | body | topic code | ใช่ | หนึ่งใน 6 หัวข้อ |
| `message` | body | string | ใช่ | trim ก่อนบันทึก; ต้องมีข้อความ 1–2,000 ตัวอักษร |

```json
{"eligibleFactoryId":10,"measurementPoint":null,"topicCode":"other","message":"ต้องการสอบถามขั้นตอนการใช้งาน"}
```

| Response field | Type | Nullable | คำอธิบาย |
| --- | --- | --- | --- |
| `data.ticket` | `ChatTicketDetail` | ไม่ | Ticket พร้อมเหตุการณ์เปิด |
| `data.firstMessage` | `ChatMessage` | ไม่ | ข้อความแรกที่บันทึกแล้ว |
| `data.replayed` | boolean | ไม่ | `false` เมื่อสร้างใหม่ (`201`), `true` เมื่อ retry สำเร็จ (`200`) |

```json
{"success":true,"data":{"ticket":{"id":1,"ticketNo":"TK-69-00001","topic":{"code":"other","label":"อื่นๆ"},"factory":{"id":10,"name":"โรงงานตัวอย่าง","registrationNo":"EXAMPLE-001","provinceName":"ระยอง","regionName":"ภาคตะวันออก"},"measurementPoint":null,"status":"open","openedBy":{"userId":101,"name":"ผู้ประกอบการตัวอย่าง","roleCode":"factory_operator","roleLabel":"ผู้ประกอบการ"},"openedAt":"2026-10-17T03:00:00.000Z","closedBy":null,"closedAt":null,"lastMessageAt":"2026-10-17T03:00:00.000Z","capabilities":{"canReply":true,"canClose":true},"events":[{"id":1,"type":"opened","actor":{"userId":101,"name":"ผู้ประกอบการตัวอย่าง","roleCode":"factory_operator","roleLabel":"ผู้ประกอบการ"},"createdAt":"2026-10-17T03:00:00.000Z"}]},"firstMessage":{"id":1,"ticketId":1,"text":"ต้องการสอบถามขั้นตอนการใช้งาน","sender":{"userId":101,"name":"ผู้ประกอบการตัวอย่าง","roleCode":"factory_operator","roleLabel":"ผู้ประกอบการ"},"createdAt":"2026-10-17T03:00:00.000Z"},"replayed":false}}
```

ไม่รับ field เพิ่มเติม เช่น `sender`, `userId`, `status`, `ticketNo`, `createdAt` หรือ role จาก client ผู้ส่งและ snapshot ทั้งหมดมาจาก server

## `GET /chat/tickets/:id`

ใช้สิทธิ์อ่าน คืนรายละเอียด เหตุการณ์ และความสามารถปัจจุบัน ข้อความโหลดแยกผ่าน endpoint ถัดไป

| Request field | Location | Type | Required | คำอธิบาย |
| --- | --- | --- | --- | --- |
| `id` | path | positive integer | ใช่ | ID Ticket |

ตัวอย่าง path parameters: `{"id":1}` ไม่มี request body

| Response field | Type | Nullable | คำอธิบาย |
| --- | --- | --- | --- |
| `data` | `ChatTicketDetail` | ไม่ | โครงสร้าง Ticket พร้อม `events` |

```json
{"success":true,"data":{"id":1,"ticketNo":"TK-69-00001","topic":{"code":"other","label":"อื่นๆ"},"factory":{"id":10,"name":"โรงงานตัวอย่าง","registrationNo":"EXAMPLE-001","provinceName":"ระยอง","regionName":"ภาคตะวันออก"},"measurementPoint":null,"status":"open","openedBy":{"userId":101,"name":"ผู้ประกอบการตัวอย่าง","roleCode":"factory_operator","roleLabel":"ผู้ประกอบการ"},"openedAt":"2026-10-17T03:00:00.000Z","closedBy":null,"closedAt":null,"lastMessageAt":"2026-10-17T03:00:00.000Z","capabilities":{"canReply":true,"canClose":true},"events":[{"id":1,"type":"opened","actor":{"userId":101,"name":"ผู้ประกอบการตัวอย่าง","roleCode":"factory_operator","roleLabel":"ผู้ประกอบการ"},"createdAt":"2026-10-17T03:00:00.000Z"}]}}
```

## `GET /chat/tickets/:id/messages`

ใช้สิทธิ์อ่าน เปิดครั้งแรกคืนข้อความล่าสุดตาม `limit` แต่เรียงใน response จากเก่าไปใหม่ ใช้ cursor โหลดเก่าหรือรีเฟรชใหม่เอง และใช้สถานะใน `data.ticket` เสมอแม้ไม่มีข้อความเพิ่ม

| Request field | Location | Type | Required | คำอธิบาย |
| --- | --- | --- | --- | --- |
| `id` | path | positive integer | ใช่ | ID Ticket |
| `limit` | query | integer 1–100 | ไม่ | ค่าเริ่มต้น `50` |
| `olderCursor` | query | string | ไม่ | cursor ที่ server ส่งกลับสำหรับโหลดข้อความเก่ากว่า ยาว 1–256 และมีเฉพาะตัวอักษร ตัวเลข `_` `-`; ห้ามสร้างหรือแก้เอง |
| `afterMessageId` | query | positive integer | ไม่ | โหลดข้อความใหม่กว่าที่แสดงอยู่; ใช้คู่กับ `olderCursor` ไม่ได้ |

ตัวอย่าง query: `{"limit":50}`

| Response field | Type | Nullable | คำอธิบาย |
| --- | --- | --- | --- |
| `data.ticket` | `ChatTicketDetail` | ไม่ | สถานะ เหตุการณ์ และสิทธิ์ปัจจุบัน |
| `data.messages` | `ChatMessage[]` | ไม่ | ข้อความในหน้าเรียง ID จากน้อยไปมาก |
| `data.pagination.olderCursor` | string | ได้ | ใช้โหลดหน้าข้อความเก่าต่อ; `null` เมื่อไม่มี |
| `data.pagination.nextAfterMessageId` | integer | ได้ | ใช้ต่อจาก batch ใหม่เมื่อรีเฟรชแบบ `afterMessageId` และ `hasMore=true`; มิฉะนั้น `null` |
| `data.pagination.hasMore` | boolean | ไม่ | ยังมีข้อความต่อในทิศทางที่ร้องขอ |

```json
{"success":true,"data":{"ticket":{"id":1,"ticketNo":"TK-69-00001","topic":{"code":"other","label":"อื่นๆ"},"factory":{"id":10,"name":"โรงงานตัวอย่าง","registrationNo":"EXAMPLE-001","provinceName":"ระยอง","regionName":"ภาคตะวันออก"},"measurementPoint":null,"status":"open","openedBy":{"userId":101,"name":"ผู้ประกอบการตัวอย่าง","roleCode":"factory_operator","roleLabel":"ผู้ประกอบการ"},"openedAt":"2026-10-17T03:00:00.000Z","closedBy":null,"closedAt":null,"lastMessageAt":"2026-10-17T03:00:00.000Z","capabilities":{"canReply":true,"canClose":true},"events":[{"id":1,"type":"opened","actor":{"userId":101,"name":"ผู้ประกอบการตัวอย่าง","roleCode":"factory_operator","roleLabel":"ผู้ประกอบการ"},"createdAt":"2026-10-17T03:00:00.000Z"}]},"messages":[{"id":1,"ticketId":1,"text":"ต้องการสอบถามขั้นตอนการใช้งาน","sender":{"userId":101,"name":"ผู้ประกอบการตัวอย่าง","roleCode":"factory_operator","roleLabel":"ผู้ประกอบการ"},"createdAt":"2026-10-17T03:00:00.000Z"}],"pagination":{"olderCursor":null,"nextAfterMessageId":null,"hasMore":false}}}
```

## `POST /chat/tickets/:id/messages`

ต้องมี `chat:view` และเข้าถึง Ticket ตามขอบเขตโรงงานปัจจุบัน รับเฉพาะ Ticket ที่ยัง `open` สำหรับข้อความใหม่

| Request field | Location | Type | Required | คำอธิบาย |
| --- | --- | --- | --- | --- |
| `id` | path | positive integer | ใช่ | ID Ticket |
| `Idempotency-Key` | header | UUID string | ใช่ | key ใหม่ต่อหนึ่งข้อความ |
| `message` | body | string | ใช่ | trim; 1–2,000 ตัวอักษร; ไม่รับ field เพิ่มเติม |

```json
{"message":"ขอข้อมูลเพิ่มเติมเกี่ยวกับขั้นตอนนี้"}
```

| Response field | Type | Nullable | คำอธิบาย |
| --- | --- | --- | --- |
| `data.ticket` | `ChatTicketDetail` | ไม่ | สถานะล่าสุดของ Ticket |
| `data.message` | `ChatMessage` | ไม่ | ข้อความที่บันทึกแล้ว |
| `data.replayed` | boolean | ไม่ | ใหม่ `false`/`201`; retry `true`/`200` |

```json
{"success":true,"data":{"ticket":{"id":1,"ticketNo":"TK-69-00001","topic":{"code":"other","label":"อื่นๆ"},"factory":{"id":10,"name":"โรงงานตัวอย่าง","registrationNo":"EXAMPLE-001","provinceName":"ระยอง","regionName":"ภาคตะวันออก"},"measurementPoint":null,"status":"open","openedBy":{"userId":101,"name":"ผู้ประกอบการตัวอย่าง","roleCode":"factory_operator","roleLabel":"ผู้ประกอบการ"},"openedAt":"2026-10-17T03:00:00.000Z","closedBy":null,"closedAt":null,"lastMessageAt":"2026-10-17T03:05:00.000Z","capabilities":{"canReply":true,"canClose":true},"events":[{"id":1,"type":"opened","actor":{"userId":101,"name":"ผู้ประกอบการตัวอย่าง","roleCode":"factory_operator","roleLabel":"ผู้ประกอบการ"},"createdAt":"2026-10-17T03:00:00.000Z"}]},"message":{"id":2,"ticketId":1,"text":"ขอข้อมูลเพิ่มเติมเกี่ยวกับขั้นตอนนี้","sender":{"userId":101,"name":"ผู้ประกอบการตัวอย่าง","roleCode":"factory_operator","roleLabel":"ผู้ประกอบการ"},"createdAt":"2026-10-17T03:05:00.000Z"},"replayed":false}}
```

Idempotency แยกตามบัญชีและการทำงาน; สำหรับส่งข้อความแยกตาม Ticket ด้วย key เดิมและ payload เดิมคืนรายการเดิมโดยไม่เพิ่มข้อความ แม้ Ticket ถูกปิดไปหลังส่งสำเร็จ แต่ยังต้องมีสิทธิ์ปัจจุบัน การ retry เปิดเรื่องที่สำเร็จแล้วไม่บังคับให้จุดเดิมยัง active หากโรงงานและสิทธิ์ยังผ่าน key เดิมที่ payload เปลี่ยนตอบ `409` และต้องใช้ key ใหม่สำหรับข้อความใหม่ การส่งใหม่หลังปิดตอบ `409` จึงไม่ควรเปลี่ยน key เพื่อ retry ข้อความที่อาจบันทึกสำเร็จไปแล้ว

## `POST /chat/tickets/:id/close`

ต้องมี `chat:view` และเข้าถึง Ticket ตามขอบเขตโรงงานปัจจุบัน ปิดแล้วอ่านประวัติได้แต่ส่งข้อความใหม่หรือเปิด Ticket เดิมอีกครั้งไม่ได้ การปิดกล่องสนทนาใน UI ไม่ใช่การเรียก endpoint นี้

| Request field | Location | Type | Required | คำอธิบาย |
| --- | --- | --- | --- | --- |
| `id` | path | positive integer | ใช่ | ID Ticket |
| body | body | empty object | ไม่ | ส่ง `{}` หรือไม่ส่ง body; ไม่รับ field เพิ่มเติม |

```json
{}
```

| Response field | Type | Nullable | คำอธิบาย |
| --- | --- | --- | --- |
| `data` | `ChatTicketDetail` | ไม่ | `status=closed`, มีผู้ปิด/เวลาปิด/เหตุการณ์ปิด; `canReply=false`, `canClose=false` |

```json
{"success":true,"data":{"id":1,"ticketNo":"TK-69-00001","topic":{"code":"other","label":"อื่นๆ"},"factory":{"id":10,"name":"โรงงานตัวอย่าง","registrationNo":"EXAMPLE-001","provinceName":"ระยอง","regionName":"ภาคตะวันออก"},"measurementPoint":null,"status":"closed","openedBy":{"userId":101,"name":"ผู้ประกอบการตัวอย่าง","roleCode":"factory_operator","roleLabel":"ผู้ประกอบการ"},"openedAt":"2026-10-17T03:00:00.000Z","closedBy":{"userId":101,"name":"ผู้ประกอบการตัวอย่าง","roleCode":"factory_operator","roleLabel":"ผู้ประกอบการ"},"closedAt":"2026-10-17T03:10:00.000Z","lastMessageAt":"2026-10-17T03:05:00.000Z","capabilities":{"canReply":false,"canClose":false},"events":[{"id":1,"type":"opened","actor":{"userId":101,"name":"ผู้ประกอบการตัวอย่าง","roleCode":"factory_operator","roleLabel":"ผู้ประกอบการ"},"createdAt":"2026-10-17T03:00:00.000Z"},{"id":2,"type":"closed","actor":{"userId":101,"name":"ผู้ประกอบการตัวอย่าง","roleCode":"factory_operator","roleLabel":"ผู้ประกอบการ"},"createdAt":"2026-10-17T03:10:00.000Z"}]}}
```

เรียกปิดซ้ำคืนผลเดิมโดยไม่สร้างเหตุการณ์เพิ่มและไม่เปลี่ยนผู้ปิด/เวลาปิด หากส่งข้อความพร้อมกับปิด server จัดลำดับให้แน่นอน: ข้อความที่บันทึกก่อนปิดอยู่ในประวัติ; ข้อความใหม่ที่เข้าหลังปิดถูกปฏิเสธ การปิดไม่เปลี่ยน `lastMessageAt`

## Validation และข้อผิดพลาด

ใช้ [shared error envelope](../../shared/common-api/README.md) ยกเว้น global rate limit เดิมที่คืนข้อความล้วนด้วย `Content-Type: text/html; charset=utf-8` ไม่มีรายละเอียดฐานข้อมูลหรือ stack trace ใน response

| HTTP | Code | ใช้กับ | เงื่อนไข/แนวทาง client |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | ทุก endpoint ที่รับ input | ID/query/body/header ผิดรูปแบบ, ข้อความว่าง/เกิน 2,000, field ที่ไม่อนุญาต, cursor ไม่ถูกต้อง; แก้ input |
| `400` | `BAD_REQUEST` | request ที่มี body / อ่านข้อความ | JSON ผิดรูปแบบ หรือ cursor ถอดรหัสไม่ได้ รูปแบบภายในผิด/เป็นของ Ticket อื่น; แก้ JSON หรือใช้ cursor ล่าสุดจาก server |
| `401` | `UNAUTHORIZED` | ทุก endpoint | ไม่มี/หมดอายุ token; เข้าสู่ระบบใหม่ |
| `403` | `FORBIDDEN` | ทุก endpoint | ขาด `chat:view`; โหลดสิทธิ์ใหม่และซ่อนเมนู Chat |
| `404` | `NOT_FOUND` | factory points, create, detail, messages, close | ไม่มี resource หรืออยู่นอกขอบเขต; ไม่เปิดเผยว่ามีข้อมูลของผู้อื่น |
| `409` | `IDEMPOTENCY_KEY_CONFLICT` | create/send | key เดิมแต่ payload ไม่เหมือนเดิม; ตรวจการ retry ไม่ส่งซ้ำด้วย key ใหม่โดยอัตโนมัติ |
| `409` | `CHAT_TICKET_CLOSED` | send | ส่งข้อความใหม่หลังปิด; รีเฟรช Ticket และปิดช่องพิมพ์ |
| `409` | `CHAT_TICKET_NUMBER_EXHAUSTED` | create | running ปีปัจจุบันครบ `99999`; แจ้งผู้ดูแล |
| `413` | `PAYLOAD_TOO_LARGE` | request ที่มี body | request body เกิน 1 MB; ลดขนาดข้อมูล โดยข้อความแต่ละรายการยังจำกัด 2,000 ตัวอักษร |
| `429` | `RATE_LIMIT_EXCEEDED` | create/send/close | เกิน 30 write requests ต่อนาทีต่อบัญชีใน process; รอตาม `Retry-After` |
| `429` | ไม่มี JSON code | ทุก endpoint | เกิน global 300 requests ต่อ 15 นาทีต่อ IP; response เป็นข้อความล้วนด้วย `Content-Type: text/html; charset=utf-8` และ `Retry-After` |
| `500` | `INTERNAL_ERROR` | ทุก endpoint | ข้อผิดพลาดระบบ; ถ้าเป็น create/send ให้ retry payload/key เดิมหลังตรวจสถานะ |

scope จาก query ไม่สามารถเพิ่มสิทธิ์ได้ ระบบตรวจ query และ body ตามรายการที่ระบุเท่านั้น จำกัด sort ตาม enum และเก็บข้อความเป็น plain text ไม่มี endpoint แก้ไข/ลบข้อความ เปิด Ticket ที่ปิดแล้ว แนบไฟล์ มอบหมายเจ้าหน้าที่ หรือ internal note

ID ที่รับจาก client ต้องเป็น integer ระหว่าง `1` ถึง `2147483647` endpoint รายการโรงงาน รายการ Ticket และรายการข้อความปฏิเสธ query key ที่อยู่นอกตาราง ทุก write endpoint ปฏิเสธ body field ที่ไม่ได้ระบุ

## แหล่งอ้างอิงสำหรับผู้ดูแล backend

| เรื่อง | Source |
| --- | --- |
| Routes และ HTTP responses | [chat.routes.ts](../../../../../backend/src/modules/chat/chat.routes.ts) |
| Types และหัวข้อ | [chat.types.ts](../../../../../backend/src/modules/chat/chat.types.ts) |
| Validators | [chat.validator.ts](../../../../../backend/src/modules/chat/chat.validator.ts) |
| สิทธิ์และ factory selectors | [chat.access.ts](../../../../../backend/src/modules/chat/chat.access.ts), [chat-factories.repository.ts](../../../../../backend/src/modules/chat/chat-factories.repository.ts) |
| การบันทึก Ticket และประวัติ | [chat.repository.ts](../../../../../backend/src/modules/chat/chat.repository.ts) |
| Migration | [0141_create_chat_tickets.ts](../../../../../backend/src/db/migrations/0141_create_chat_tickets.ts) |
| OpenAPI runtime | [chat.openapi.ts](../../../../../backend/src/modules/api-docs/chat.openapi.ts) |
| HTTP behavior tests | [chat.routes.test.ts](../../../../../backend/tests/unit/chat.routes.test.ts) |
| Contract publication tests | [chat.openapi.test.ts](../../../../../backend/tests/unit/chat.openapi.test.ts) |
| SQL Server transaction checks | [chat.sql-server.test.ts](../../../../../backend/tests/integration/chat.sql-server.test.ts) |
| ผลตรวจ implementation | [TDD, tests และ security review](../../../evidence/chat/backend-verification.md) |
| ผลตรวจและเงื่อนไขฐานทดสอบ | [หลักฐานการตรวจ SQL Server](../../../evidence/chat/sql-server-verification.md) |

ดู [ขอบเขตสิทธิ์](../permissions/README.md) และ [โรงงานที่เข้าข่าย](../eligible-factories/README.md) สำหรับสัญญาร่วมของข้อมูลโรงงานและสิทธิ์ การใช้งานจริงต้องรัน migration ของ Chat ก่อนให้ client เรียก endpoint ชุดนี้
