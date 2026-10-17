# ส่งต่อ Frontend: เชื่อมหน้า Chat กับ API จริง

เอกสารนี้ระบุงาน frontend ที่ต้องทำต่อจาก Chat mockup เพื่อให้ผู้ใช้ล็อกอินผ่านเว็บ production ตามปกติ แล้วเปิดเรื่อง สนทนา อ่านประวัติ และปิดเรื่องผ่าน backend จริงได้ โดยคงหน้ารายการและ dialog เดิมเป็นหลัก

Backend ของสิทธิ์ **มีสิทธิ์ใช้งาน** ขึ้น production แล้วผ่าน [PR #22](https://github.com/Nongten1010/POMS-app/pull/22) และ [deployment 39037039487](https://github.com/Nongten1010/POMS-app/actions/runs/39037039487) ที่ commit `d7c807eda815f6594a2b02801f062831aed805d5` ตรวจ live OpenAPI ตรงกับ release แล้ว แต่ยังไม่ได้ยืนยันการเปิด–สนทนา–ปิดผ่านหน้าเว็บด้วยบัญชีภาณุ เพราะ frontend ยังใช้ mockup

## สัญญาที่ต้องใช้อ้างอิง

- [Chat API: สิทธิ์, endpoints, fields, ตัวอย่าง request/response, pagination และ errors](../../../api/menus/chat/README.md)
- [จัดการสิทธิ์การใช้งาน](../../../api/menus/permissions/README.md)
- [Authentication](../../../api/shared/authentication/README.md)
- [Production Swagger UI](https://d-poms.diw.go.th/api/v1/docs/) และ [OpenAPI JSON](https://d-poms.diw.go.th/api/v1/openapi.json)
- [ผลตรวจ backend และข้อจำกัดการทดสอบ](../../../evidence/chat/backend-verification.md)
- [ต้นฉบับความต้องการ UX จาก frontend](../../../../../frontend/md/frontend-handoff-17102026.md)

Canonical Chat API และ runtime OpenAPI เป็นสัญญาปัจจุบัน เอกสารนี้เป็นรายการเชื่อมต่อและตรวจรับ ไม่ใช่สัญญา API อีกชุด ส่วนที่เอกสาร mockup เดิมยังระบุว่า “ต้องยืนยัน” เช่น ความยาวข้อความและเลข Ticket ให้ใช้คำตอบจาก canonical contract

## สิ่งที่ต้องแก้ในไฟล์ frontend

| ไฟล์ / จุดทำงาน | สภาพปัจจุบัน | งานที่ต้องทำ |
| --- | --- | --- |
| [`App.jsx`](../../../../../frontend/src/App.jsx), จุด render `ChatPage` | ส่งเพียง `isStaff` | ส่ง `accessToken` จาก session ปกติและ permission ที่หน้าใช้ โดยคง menu guard `permissions.chat.view` |
| [`pages/ChatPage.jsx`](../../../../../frontend/src/pages/ChatPage.jsx) | re-export `ChatTicketMockup` | เปลี่ยนให้เป็นหน้าที่โหลดข้อมูลจริง หรือส่ง props ไปยัง component ที่เชื่อม API แล้ว |
| [`components/ChatTicketMockup.jsx`](../../../../../frontend/src/components/ChatTicketMockup.jsx) | `makeMockTickets`, `mockFactories`, `mockPeople` เป็นแหล่งข้อมูล; สร้าง/ส่ง/ปิดด้วย local state | เชื่อม API สำหรับทุก action แยก list, detail/messages, form, loading และ error state; เก็บ layout เดิมได้ |
| `ChatTicketMockup` ปุ่มเปิดเรื่องและ `createTicket` | ซ่อนปุ่มเมื่อ `viewer === 'officer'` | ใช้ `options.canCreate`; เจ้าหน้าที่ที่มีสิทธิ์ต้องเปิดเรื่องได้ |
| `ChatTicketMockup` ปุ่มรีเฟรช | เปลี่ยนเพียงข้อความเวลา `refreshNote` | โหลดข้อความและสถานะจาก server จริง แล้วอัปเดตเวลาเมื่อโหลดสำเร็จเท่านั้น |
| [`utils/chatTicketMock.mjs`](../../../../../frontend/src/utils/chatTicketMock.mjs) | สร้างเลข Ticket เอง และกำหนดสิทธิ์/พื้นที่/ผู้ส่งจำลอง | เอาออกจากเส้นทางใช้งานจริง; หากเก็บไว้เป็น fixture ให้ใช้เฉพาะ test/demo ที่แยกชัดเจน |
| API helper ใหม่ เช่น `utils/chatApi.mjs` | ยังไม่มีตัวเรียก Chat API | รวม URL, Bearer header, error parsing, query และ idempotency ตาม convention เดิม |
| [`utils/contentApi.mjs`](../../../../../frontend/src/utils/contentApi.mjs) | มี URL/header/error helper ที่หน้าอื่นใช้อยู่ | ใช้เป็นแบบอย่างหรือ reuse ส่วนที่เข้ากันได้ โดยรักษาพฤติกรรมหน้าอื่น และอย่าทิ้ง top-level `pagination` |
| [`pages/PermissionManagementPage.jsx`](../../../../../frontend/src/pages/PermissionManagementPage.jsx) | `chat.view` และ `chat.edit` ตรงกับ backend แล้ว | คง payload ของสองช่องเดิม ไม่เพิ่ม `chat.ask` และไม่บังคับติ๊ก Admin เพื่อเปิดเรื่อง |

ไฟล์ใหม่ที่ระบุเป็นข้อเสนอการจัดโค้ด ไม่จำเป็นต้องเปลี่ยนชื่อหรือย้าย component หากเชื่อมการทำงานครบได้ในโครงสร้างเดิม

## 1. ใช้ session ปกติและสิทธิ์จาก server

- ทุก Chat request ใช้ `Authorization: Bearer <accessToken>` ที่ส่งมาจาก session ของแอป ไม่สร้าง token ทดสอบหรือหน้าล็อกอิน Chat แยกใน production
- ใช้ base URL ตาม convention ปัจจุบัน: development `/api-proxy/v1`, production `/api/v1` บน origin ของเว็บ; [`vite.config.js`](../../../../../frontend/vite.config.js) มี proxy ให้แล้ว และ proxy development นี้ชี้ production จริง
- เข้าเมนูได้เมื่อ `permissions.chat.view === true`; โหลด `GET /chat/options` เพื่อรับ `viewer`, `topics`, `limits`, `canCreate`
- **ติ๊กมีสิทธิ์ใช้งานก็เปิดเรื่องและสนทนาได้** ภายในขอบเขตโรงงาน ไม่ตรวจ `isStaff`, `userType`, `roleCode`, `chat.ask` หรือ `chat.edit` เพื่อปิดกั้นปุ่มเปิดเรื่อง
- ปุ่มเปิดเรื่องใช้ `options.canCreate`; ช่องพิมพ์และปุ่มส่งใช้ Ticket `capabilities.canReply`; ปุ่มปิดใช้ `capabilities.canClose` พร้อมสถานะ `open`
- ช่อง “ตอบคำถาม (Admin)” ยังคง map เป็น legacy `chat:answer` แต่ไม่ใช่เงื่อนไขเพิ่มของ Chat endpoints และไม่ได้เปลี่ยน role บัญชี
- ใช้ `options.viewer.userId` เทียบกับ `message.sender.userId` เพื่อจัดข้อความของตัวเองด้านขวา บัญชีอื่นด้านซ้าย แม้มีบทบาทเดียวกัน
- เมื่อ session เปลี่ยนหรือออกจากระบบ ให้ยกเลิก request เก่าและล้างข้อมูล Chat ที่ผูกกับบัญชีก่อนหน้า

## 2. แทนแหล่งข้อมูลจำลองด้วย API

ทุก path ในตารางนี้ต่อท้าย base URL ข้างต้น รายละเอียด fields และตัวอย่างเต็มอยู่ใน [Chat API](../../../api/menus/chat/README.md)

| งานในหน้า | API ที่ใช้ | สิ่งที่นำไปแสดงหรือเก็บ |
| --- | --- | --- |
| เปิดหน้า Chat | `GET /chat/options` | ตัวตนจริง หัวข้อ สิทธิ์เปิดเรื่อง และความยาวข้อความ |
| เลือกโรงงาน | `GET /chat/factories` | โรงงานตามสิทธิ์ พร้อม pagination/search |
| เลือกจุดตรวจวัด | `GET /chat/factories/:id/measurement-points` | จุดของโรงงานที่เลือก พร้อม `kind` และ `id` |
| โหลด/รีเฟรชรายการ | `GET /chat/tickets` | `data[]` และ top-level `pagination` |
| ส่งฟอร์มเปิดเรื่อง | `POST /chat/tickets` | `data.ticket`, `data.firstMessage`, `data.replayed` |
| โหลดรายละเอียดอย่างเดียว | `GET /chat/tickets/:id` | `data` เป็น Ticket พร้อม events |
| เปิด dialog / อ่านข้อความ | `GET /chat/tickets/:id/messages` | `data.ticket`, `data.messages`, `data.pagination` |
| ส่งข้อความในเรื่อง | `POST /chat/tickets/:id/messages` | `data.ticket`, `data.message`, `data.replayed` |
| ยืนยันปิดเรื่อง | `POST /chat/tickets/:id/close` | `data` เป็น Ticket สถานะล่าสุด |

ตอนเปิด dialog ใช้ `/messages` เป็นคำขอหลักได้ เพราะมี Ticket พร้อม events อยู่แล้ว ไม่จำเป็นต้องเรียก detail ซ้ำโดยไม่มีเหตุผล

### Mapping ที่ต้องเปลี่ยนจาก mock

| ค่าเดิมใน UI | ค่าจริงที่ใช้ |
| --- | --- |
| `ticket.id` เป็น `TK-69-...` | `id` เป็นเลขสำหรับ API/DataGrid row; แสดงเลขเรื่องด้วย `ticketNo` |
| `ticket.topic` เป็นข้อความ | `topic.label` สำหรับแสดง; `topic.code` / `topicCode` สำหรับค่าที่ส่ง |
| `ticket.factoryId` และ lookup `mockFactories` | รายละเอียดใน `ticket.factory`; ฟอร์มส่ง `eligibleFactoryId` |
| `registration`, `region`, `province` จาก mock | `factory.registrationNo`, `factory.regionName`, `factory.provinceName` |
| `ticket.point` เป็นข้อความ | `measurementPoint` เป็น object หรือ `null`; แสดง `pointCode`/`pointName` โดยรองรับ code ว่าง |
| `latest` จากข้อความตัวสุดท้ายของแถว | `lastMessageAt` เพราะรายการ Ticket ไม่ส่ง messages มาด้วย |
| `creator` และ `mockPeople` | `openedBy`, `openedAt`, `closedBy`, `closedAt` และ `events` จาก server |
| `item.sender` เป็น `operator` / `officer` | `sender.userId`, `sender.name`, `sender.roleLabel` |
| `item.at` | `createdAt`; แสดงเวลา `Asia/Bangkok` |
| message key จาก index | ใช้ `message.id`; event key แยกด้วยชนิด เช่น `event:<id>` |

ห้ามสร้าง Ticket No., timestamp, ผู้เปิด/ผู้ส่ง/ผู้ปิด หรือสิทธิ์เองใน browser แสดงชื่อและข้อมูลโรงงาน snapshot ที่ Ticket ส่งมา แม้โรงงานหรือจุดนั้นจะไม่อยู่ในตัวเลือกปัจจุบัน

## 3. ฟอร์มเปิดเรื่อง

1. เริ่มฟอร์มโดยยังไม่เลือกโรงงาน ไม่ใช้ `factory-1` เป็นค่าเริ่มต้น โหลดโรงงานที่เลือกได้จาก API และแสดงชื่อพร้อมเลขทะเบียนเพื่อแยกชื่อซ้ำ
2. ตัวเลือกโรงงานมีหลายหน้า ต้องรองรับ search/เปลี่ยนหน้าหรือโหลดต่อ ไม่แสดงเฉพาะ 25 รายการแรกแล้วถือว่าครบ
3. เมื่อเปลี่ยนโรงงานให้ล้างจุดตรวจวัดเป็น “ทั้งหมด” แล้วโหลดจุดของโรงงานใหม่ ยกเลิก/ละทิ้งผล request ของโรงงานเดิมที่กลับมาช้ากว่า
4. “ทั้งหมด” หมายถึงเรื่องระดับโรงงาน ส่ง `measurementPoint: null`; จุดใดจุดหนึ่งส่ง `{kind,id}` โดยเก็บทั้งสองค่า ไม่ใช้รหัสจุดหรือข้อความ label เป็น ID และไม่รวมจุดต่าง `kind` ที่มีเลข ID เท่ากัน
5. หาก API คืนจุดเป็น `[]` ยังเปิดเรื่องระดับโรงงานได้ หากโรงงานเป็น `[]` ให้แสดงว่าไม่มีโรงงานที่เลือกได้และปิดปุ่มส่ง ไม่ใช้โรงงานจำลองหรือให้กรอกเลขทะเบียนเพื่อข้ามสิทธิ์
6. หัวข้อโหลดจาก `options.topics` แสดง `label` และส่ง `code` เป็น `topicCode`
7. ตรวจข้อความหลัง trim ต้องไม่ว่าง จำกัดตาม `options.limits.messageMaxLength` ซึ่งปัจจุบันคือ 2,000 แบบ UTF-16 เช่น JavaScript `string.length`
8. ส่งเฉพาะ `eligibleFactoryId`, `measurementPoint`, `topicCode`, `message` ตาม canonical contract เปลี่ยน string จาก select เป็น integer ก่อนส่ง ID; ไม่ส่ง field ของ mock หรือ field ที่ server เป็นผู้กำหนด
9. หลังได้ `201` หรือผล retry `200` ใช้ Ticket/ข้อความที่ server คืน เปิด dialog และรีเฟรชรายการตาม sort/filter ปัจจุบัน เก็บข้อความที่กรอกไว้หากยังส่งไม่สำเร็จ

## 4. รายการ Ticket และ DataGrid

- ใช้ pagination, sorting และ filtering ฝั่ง server ไม่เรียง/กรองเฉพาะข้อมูลหน้าปัจจุบันแล้วแสดงเหมือนเป็นทั้งระบบ
- DataGrid page เริ่ม `0` แต่ API `page` เริ่ม `1`; ส่ง `page + 1`, ใช้ `rowCount = pagination.total` และรองรับ `pageSize` 25/50/100
- ตั้งต้นเป็น `sort=lastMessageAt&order=desc`; reset page เมื่อเปลี่ยน filter/search และรองรับผลลัพธ์ว่างหรือหน้าที่เลื่อนหลัง refresh
- map sort เดิม `id → ticketNo`, `latest → lastMessageAt`, `registration → registrationNo`, `region → regionName`, `province → provinceName`; sort `topic`, `factoryName`, `status` ใช้ชื่อ enum ตาม API ไม่ส่ง DataGrid model ทั้งก้อน
- API รองรับ sort หนึ่ง field ต่อคำขอ ให้ UI เลือกหนึ่ง field และส่งเฉพาะ query ที่รองรับ ห้ามส่ง operator/filter syntax ของ DataGrid ตรงๆ
- กรองสถานะ/หัวข้อ/โรงงาน/พื้นที่ด้วย `status`, `topicCode`, `eligibleFactoryId`, `regionName`, `provinceName`; ค้นด้วย `q`; ช่วงข้อความล่าสุดใช้ `from`/`to` เป็น ISO ที่มี timezone ดู validation ใน canonical API
- ไม่อ้าง `ticket.messages` จาก list; อ่านเวลาข้อความล่าสุดจาก `lastMessageAt` โดยตรง การปิดเรื่องไม่เปลี่ยนเวลานี้
- ถ้าเก็บปุ่ม Export เดิม ให้ระบุชัดว่า export เฉพาะข้อมูลที่โหลดอยู่ หรือซ่อนจนกำหนดขอบเขตงาน ห้ามทำให้ผู้ใช้เข้าใจว่าได้ข้อมูลครบทุกหน้าจาก response หน้าเดียว

## 5. บทสนทนา ประวัติ และการรีเฟรช

- เปิด dialog ด้วย numeric Ticket ID แล้วโหลดข้อความล่าสุด เริ่มที่ `limit=50` ตาม default ของ API; ข้อความแต่ละ batch เรียง ID จากน้อยไปมาก
- เก็บข้อความและ cursor แยกตาม Ticket; ใช้ `olderCursor` ที่ server ให้สำหรับ “โหลดข้อความก่อนหน้า” และ prepend โดยไม่กระโดดออกจากตำแหน่งที่ผู้ใช้กำลังอ่าน ปรับ `useEffect` เดิมที่ scroll ลงล่างเมื่อจำนวนข้อความเพิ่ม ไม่ให้ทำเช่นนั้นตอนโหลดประวัติเก่า
- เก็บตำแหน่งการอ่านข้อความใหม่ล่าสุดจาก `GET /messages` แยกจาก ID สูงสุดที่แสดงใน UI เริ่มจาก ID สุดท้ายของ batch ล่าสุดที่อ่านจาก GET; การ append ผล send/replay ของตนเองต้องไม่เลื่อนตำแหน่งการอ่านนี้
- เมื่อผู้ใช้กดรีเฟรช ส่ง `afterMessageId` จากตำแหน่งการอ่านดังกล่าว; หาก `hasMore=true` ให้ใช้ `nextAfterMessageId` โหลด batch ต่อจนหมดภายในการกดครั้งนั้น อัปเดตตำแหน่งเมื่อรับ batch จาก GET สำเร็จเท่านั้น และคงตำแหน่งเดิมเมื่อไม่มีข้อความใหม่
- ตัวอย่างที่ต้องไม่ข้าม: อ่านถึง ID `100` → คนอื่นส่ง `101` → เราส่งเองได้ `102`; แสดง `102` จาก send response ได้ แต่ refresh ยังต้องเริ่มหลัง `100` เพื่อรับ `101` ด้วย แล้ว deduplicate `102` ไม่ให้แสดงซ้ำ
- ห้ามส่ง `olderCursor` พร้อม `afterMessageId`; ไม่สร้าง/แก้ cursor เอง และไม่ตั้ง timer polling หรือ WebSocket
- รวมข้อความตาม `message.id` แล้วเรียงตาม ID เพื่อกันข้อความซ้ำจาก send response, retry และ refresh
- ทุกครั้งที่โหลด messages ต้องอัปเดต `data.ticket` ด้วย แม้ `messages=[]` เพราะเรื่องอาจถูกปิดโดยคนอื่นและไม่มีข้อความใหม่
- ส่งข้อความแล้วใช้ `data.message` และ `data.ticket` ที่ตอบกลับ; ล้างช่องพิมพ์เฉพาะข้อความที่ส่งสำเร็จ ไม่ล้างข้อความใหม่ที่ผู้ใช้พิมพ์ระหว่างรอ
- แสดงเหตุการณ์ `opened`/`closed` จาก `ticket.events` แยกจากข้อความ ไม่สร้างข้อความสมมติเพื่อแทน event และไม่แสดงเหตุการณ์ซ้ำจากทั้ง event กับ header
- แสดงข้อความเป็น plain text ผ่าน React รองรับขึ้นบรรทัดใหม่ ไม่ใช้ HTML rendering; รองรับชื่อยาวและหลายบัญชีที่มี role เดียวกัน
- กด X หรือ backdrop ปิดเพียง dialog; เรียก `/close` เฉพาะปุ่ม “ปิดการสนทนา” หลัง dialog ยืนยัน
- หลังปิดสำเร็จ อัปเดตผู้ปิด เวลา events และ capabilities จาก response; อ่านประวัติได้ แต่ไม่มีส่งใหม่ แก้ไข/ลบข้อความ หรือเปิดเรื่องเดิมซ้ำ

## 6. ป้องกันการสร้างซ้ำและจัดการข้อผิดพลาด

`POST` เปิดเรื่องและส่งข้อความต้องมี `Idempotency-Key` แบบ UUID เช่น `crypto.randomUUID()` สร้างหนึ่ง key ต่อเจตนาส่งหนึ่งครั้ง ไม่สร้าง key ใหม่ทุก network attempt ส่วนปิดเรื่องไม่ต้องมี key

- ระหว่างส่งให้ disable ปุ่มซ้ำ; เก็บ `{key,payload}` ของคำขอที่ยังไม่รู้ผลไว้ หาก timeout/เครือข่ายขาด ให้ retry payload และ key เดิมก่อนถือว่าส่งไม่สำเร็จ
- สร้าง key ใหม่เมื่อเริ่มส่งเรื่อง/ข้อความใหม่จริงๆ หลังทราบผลของครั้งก่อนแล้ว อย่าแก้ payload ของคำขอที่กำลัง retry และอย่าเปลี่ยน key อัตโนมัติเพื่อแก้ `409`
- ยอมรับทั้ง `201` สร้างใหม่และ `200` ที่ `replayed=true` เป็นผลสำเร็จ ใช้ ID เดิมจาก server เพื่อลดรายการซ้ำ
- ป้องกัน response ของ Ticket/บัญชีเก่ามาทับหน้าปัจจุบันด้วย request cancellation หรือ request identity; การยกเลิก request ฝั่ง browser ไม่รับรองว่าคำสั่งเขียนไม่ได้บันทึกบน server

| ผลจาก API | การทำงานของ frontend |
| --- | --- |
| `400` validation | แสดงข้อผิดพลาดของ field/ข้อความรวมและคง draft; ไม่แสดงว่าส่งสำเร็จ |
| `401` | ใช้ flow session หมดอายุ/ล็อกอินของแอป |
| `403` | รีเฟรชสิทธิ์ ล้างข้อมูลที่เข้าถึงไม่ได้ และหยุด action แม้เคยเห็นปุ่ม |
| `404` | แจ้งไม่พบหรือไม่มีสิทธิ์เข้าถึง โหลด list/options ที่เกี่ยวข้องใหม่ ไม่เปิดเผยข้อมูลจาก cache ต่อ |
| `409 CHAT_TICKET_CLOSED` | แจ้งเรื่องถูกปิด รีเฟรชสถานะ และปิดช่องส่ง โดยไม่ลบ draft ทิ้งเงียบๆ |
| `409 IDEMPOTENCY_KEY_CONFLICT` | แจ้งคำขอส่งซ้ำไม่ตรงกัน ให้ตรวจคำขอเดิม ไม่ส่ง key ใหม่ซ้ำทันที |
| `429` | แสดงให้รอตาม `Retry-After`; รองรับทั้ง JSON และข้อความล้วน |
| เครือข่ายขาด / `500` | แสดง error/retry และคง draft; สำหรับ create/send ใช้คำขอเดิมเมื่อผลยังไม่แน่นอน |

รายละเอียด error ทั้งหมดอยู่ใน canonical Chat API ให้แยกสถานะ “กำลังโหลด”, “ไม่มีข้อมูล”, “โหลดไม่สำเร็จ” และ “กำลังส่ง” ไม่ fallback เป็นข้อมูล mock เมื่อเรียก API ไม่สำเร็จ

## รายการตรวจรับก่อนส่ง frontend

- [ ] `App → ChatPage` ส่ง session จริง ทุก Chat request ใช้ Bearer token; logout/login อีกบัญชีไม่เห็นข้อมูลเดิม
- [ ] บัญชีผู้ประกอบการ เจ้าหน้าที่ และผู้ดูแลที่มี `chat.view=true`, `chat.edit=false` เปิดเรื่อง สนทนา และปิดได้เมื่อมีขอบเขตโรงงาน; การถอน `chat.view` หยุดการใช้งาน
- [ ] บัญชีที่ดูได้เฉพาะจังหวัด/โรงงานของตนไม่เห็นข้อมูลข้ามขอบเขต ไม่มีการกรองสิทธิ์ด้วยข้อมูล mock
- [ ] ตัวเลือกโรงงานเกิน 25 รายการค้นหา/โหลดต่อได้; โรงงานที่ไม่มีจุดยังเลือก “ทั้งหมด” ได้; เปลี่ยนโรงงานไม่ส่งจุดเดิม
- [ ] หัวข้อและชื่อผู้ใช้เป็นข้อมูลจริง; ข้อความบัญชีปัจจุบันชิดขวา บัญชีอื่นที่ role เดียวกันชิดซ้าย
- [ ] เปิดเรื่องแล้ว reload หน้าเว็บยังพบ Ticket และประวัติเดิม เลข Ticket/เวลามาจาก server
- [ ] คลิกส่งซ้ำหรือจำลอง timeout แล้ว retry ไม่สร้าง Ticket/ข้อความซ้ำ และไม่ทำ draft หาย
- [ ] รายการเกินหนึ่งหน้า กรอง/ค้น/เรียงแล้วได้ผลรวมจาก server ถูกต้อง
- [ ] ประวัติเกิน 50 ข้อความโหลดเก่าและโหลดข้อความใหม่หลาย batch ได้ครบ ไม่ซ้ำ/ขาดช่วง; ข้อความของคนอื่นที่เข้ามาก่อนข้อความที่เพิ่งส่งเองต้องปรากฏหลัง refresh ด้วย
- [ ] คนอื่นปิดเรื่องระหว่างเปิด dialog: กดรีเฟรชแม้ไม่มีข้อความใหม่ต้องเห็นสถานะปิด; ส่งใหม่ได้ `409` แล้ว UI หยุดส่ง
- [ ] ปิด dialog ไม่เรียก `/close`; ยืนยันปิดเรื่องแล้วอ่านประวัติและผู้ปิดได้ การปิดซ้ำไม่เพิ่ม event
- [ ] ไม่เกิดข้อมูล mock ในเส้นทาง production และไม่มีงานแนบไฟล์/polling/reopen ที่เกิน contract
- [ ] ตรวจและปรับ tests ที่ยังผูกกับ mock โดยเฉพาะ [`chatTicketMock.test.mjs`](../../../../../frontend/src/utils/chatTicketMock.test.mjs) และ [`sidebarChat.integration.test.mjs`](../../../../../frontend/src/utils/sidebarChat.integration.test.mjs); เพิ่ม regression ของ API flow และ permissions ตามพฤติกรรมใหม่

`sidebarChat.integration.test.mjs` เดิมยังคาดว่า Chat ของผู้ประกอบการถูกปิดเพื่อปรับปรุง แต่ source sidebar ปัจจุบันไม่ได้จำกัดแบบนั้นแล้ว ให้ทบทวน expectation ของ test ตามสิทธิ์ปัจจุบัน ไม่สั่งลบเงื่อนไขที่ไม่มีใน source

รัน scripts ที่มีอยู่ใน `frontend/`: `npm run lint`, `npm test`, `npm run build` พร้อม browser test ตามรายการข้างต้น แยก failure เดิมออกจาก regression ของงานนี้และรายงานตามจริง

การตรวจ production หลัง frontend deploy ให้ใช้บัญชีภาณุผ่านหน้าล็อกอินปกติ เลือกโรงงานจากรายการที่บัญชีเข้าถึงได้ สร้าง Ticket ทดสอบที่มี marker ชัดเจน แล้วตรวจเปิด–ส่ง–รีเฟรช–ปิด–reload บันทึก Ticket ID และส่งให้ backend ล้างเฉพาะข้อมูลรอบทดสอบหลังตรวจว่าไม่มีข้อความของผู้อื่นปะปน ไม่เพิ่มปุ่มลบถาวรใน frontend และไม่ล้างข้อมูลเดิมของบัญชี

## เกณฑ์เสร็จงาน

ผู้ใช้เปิดเมนู Chat บน production แล้วทำรายการจริงได้ครบด้วย session ปกติ ไม่มีหน้าทดสอบหรือสิทธิ์ซ่อนที่ต้องตั้งเพิ่ม ข้อมูลยังอยู่หลัง reload และผ่านรายการตรวจรับด้านสิทธิ์ ขอบเขตโรงงาน การส่งซ้ำ และสถานะปิด พร้อมหลักฐานผล browser test และการล้างข้อมูลทดสอบ
