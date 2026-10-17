# ส่งต่อ Frontend: Chat รับรายการทั้งหมดและแบ่งหน้าในเว็บ

งานนี้ถอด `page` และ `pageSize` ออกจาก request ของ **`GET /chat/factories` และ `GET /chat/tickets` เท่านั้น** Backend คืนทุกรายการที่ผ่านสิทธิ์และตัวกรอง ให้ frontend แบ่งหน้าเอง การอ่านประวัติข้อความด้วย `limit`/cursor และรายการโรงงานในเมนูอื่นใช้สัญญาเดิม

Source frontend ที่ตรวจจาก commit `e9580424` เชื่อม API แล้วผ่าน `ChatPage` → `ChatWorkspace`, `ChatCreateDialog` และ `ChatConversation` จึงต้องปรับตัวเรียก API/ตารางที่มีอยู่ ไม่ต้องสร้างเส้นทางเชื่อม mockup ใหม่ การเปลี่ยนรายการเป็นไม่แบ่งหน้าในเอกสารนี้ **ยังไม่ deploy**; หลักฐาน backend release ก่อนหน้าไม่ใช่หลักฐานว่า production รองรับสัญญาใหม่นี้แล้ว

## สัญญาที่ต้องใช้อ้างอิง

- [Chat API: สิทธิ์, endpoints, fields, ตัวอย่าง request/response และ errors](../../../api/menus/chat/README.md)
- [Breaking change และ migration](../../../api/CHANGELOG.md#chat-unpaged-lists)
- [จัดการสิทธิ์การใช้งาน](../../../api/menus/permissions/README.md) และ [Authentication](../../../api/shared/authentication/README.md)
- [Production Swagger UI](https://d-poms.diw.go.th/api/v1/docs/) และ [OpenAPI JSON](https://d-poms.diw.go.th/api/v1/openapi.json)
- [หลักฐาน backend release ก่อนหน้าและข้อจำกัดการทดสอบ](../../../evidence/chat/backend-verification.md)
- [ต้นฉบับความต้องการ UX จาก frontend](../../../../../frontend/md/frontend-handoff-17102026.md)

Canonical Chat API ระบุสัญญาของการเปลี่ยนนี้ เอกสารนี้เป็นรายการงานและตรวจรับ ไม่ใช่สำเนาสัญญาอีกชุด ให้ตรวจ runtime OpenAPI หลัง deploy ว่าตรงกับ canonical ก่อนยืนยันผล production

## ไฟล์ที่ต้องปรับ

| ไฟล์ / จุดทำงาน | สภาพที่ตรวจพบ | งานที่ต้องทำ |
| --- | --- | --- |
| [`utils/chatApi.mjs`](../../../../../frontend/src/utils/chatApi.mjs) → `readAllChatFactories` | ส่ง `{page, pageSize:25}` และ loop ตาม `pagination.totalPages` | โหลด `/factories` ครั้งเดียวโดยไม่ส่งสอง key นี้ รับ `data` ทั้งชุดและคงการยกเลิก request; ส่ง `q` ได้เมื่อต้องการค้นจาก server |
| `utils/chatApi.mjs` → `ticketQuery` | รับ pagination model และแปลงหน้าเป็น `page + 1` | ถอด pagination ออกจาก query และ dependency ของการโหลด คงเฉพาะ search/filter/sort ที่ backend รองรับ |
| [`components/ChatWorkspace.jsx`](../../../../../frontend/src/components/ChatWorkspace.jsx) → DataGrid | `paginationMode="server"` และใช้ `response.pagination.totalPages - 1` จำกัดหน้าจอ | ใช้ client pagination จาก `rows` ทั้งชุด; คำนวณจำนวนหน้าใน UI จากจำนวนแถวและ page size ของ UI เอง ไม่ใช้ response `totalPages` |
| `ChatWorkspace.jsx` → `canCreate` | ยังบังคับ `userType === 'operator'` เพิ่มจาก `data.canCreate` | งานสิทธิ์ที่ยังค้าง: ใช้ `options.canCreate` และสถานะโหลด/ข้อผิดพลาด เจ้าหน้าที่ที่มี `chat:view` ต้องเปิดเรื่องได้ |
| `utils/chatApi.mjs` → `assertCanCreate` | ขวางการสร้าง Ticket ของผู้ที่ไม่ใช่ operator ก่อนเรียก server | เอาเงื่อนไขตามประเภทบัญชีออกให้ตรงสิทธิ์ backend ไม่เพิ่มช่องสิทธิ์ใหม่ |
| [`components/ChatCreateDialog.jsx`](../../../../../frontend/src/components/ChatCreateDialog.jsx) | เรียก `readAllChatFactories` ผ่าน `factoryClient` | ใช้ผลโรงงานทั้งหมดจากคำขอเดียว ตรวจว่าค้นหาใน Autocomplete ได้ครบและยังรองรับยกเลิก/เปลี่ยนโรงงาน |
| [`utils/chatApi.test.mjs`](../../../../../frontend/src/utils/chatApi.test.mjs) | คาดหวัง loop โรงงานหลายหน้า, query `page/pageSize`, server pagination และห้าม non-operator สร้าง | เปลี่ยน regression ให้ตรงสัญญาใหม่ตามรายการตรวจรับด้านล่าง |

[`App.jsx`](../../../../../frontend/src/App.jsx) และ [`pages/ChatPage.jsx`](../../../../../frontend/src/pages/ChatPage.jsx) ส่ง session/access token และตรวจ `permissions.chat.view` แล้ว ให้คง flow ล็อกอินปกติ ส่วนหน้าจัดการสิทธิ์ยังใช้สองช่องเดิม ไม่เพิ่ม `chat.ask` หรือบังคับติ๊ก “ตอบคำถาม (Admin)”

## 1. โหลดโรงงานและ Ticket ทั้งชุด

- โรงงาน: เรียก `GET /chat/factories` หรือส่งเฉพาะ `q` ตามต้องการ ไม่มี loop `page` หรือ sentinel page และไม่ตัดรายการเหลือ 25/50/100 เองก่อนส่งเข้าตัวเลือก
- Ticket: เรียก `GET /chat/tickets` พร้อม search/filter/sort ตามเดิม เช่น `?status=open&sort=lastMessageAt&order=desc` โดยไม่มี pagination query
- ส่ง `page` หรือ `pageSize` แม้เป็นค่าเดิม/ค่าว่างก็เป็น query key ที่ไม่อนุญาตและได้ `400 VALIDATION_ERROR`; ห้ามใช้ default query ของ helper เดิมเติมกลับมา
- Backend ยังคง top-level `pagination` เพื่อความเข้ากันได้: `page=1`, `pageSize=total=data.length`, `totalPages=1` เมื่อมีข้อมูลหรือ `0` เมื่อว่าง ข้อมูลว่างมี `pageSize=0` จึงห้ามนำ metadata นี้ไปตั้ง page size ของ DataGrid
- คำว่า “ทั้งหมด” หมายถึงผลที่ตรงสิทธิ์ปัจจุบันและตัวกรองเท่านั้น ไม่ใช่ข้อมูลทุกโรงงานในระบบ ผู้ใช้ไม่สามารถเพิ่มสิทธิ์ผ่าน query
- ผล `data=[]` เป็นผลสำเร็จที่ไม่มีรายการ แยกจาก loading/error และไม่ fallback เป็นข้อมูล mock
- โรงงานไม่มีจุดตรวจวัดยังเปิดเรื่องระดับโรงงานได้โดยส่ง `measurementPoint:null`; หากโรงงานว่างให้ปิดปุ่มส่งและแจ้งว่าไม่มีโรงงานที่เลือกได้
- เมื่อเปลี่ยนโรงงานให้ล้างจุดเดิมและละทิ้งผล request ที่ล้าสมัย จุดที่เลือกต้องเก็บทั้ง `{kind,id}` ไม่ใช้ label/รหัสจุดแทน ID

## 2. แบ่งหน้า Ticket ใน DataGrid

1. เก็บ response `data` ทั้งชุดและส่งเป็น `rows` ให้ DataGrid ตั้ง `paginationMode="client"` หรือใช้ค่าเริ่มต้นของ library โดยคง `paginationModel` เป็น state ของหน้าจอ (`page` เริ่มที่ `0`, page size เช่น 25/50/100)
2. ถอด `rowCount` ที่ใช้สำหรับ server pagination และการ clamp หน้าจอด้วย `response.pagination.totalPages` ให้ตารางใช้จำนวนแถวจริง หรือคำนวณหน้าสุดท้ายจาก `Math.max(0, Math.ceil(rows.length / uiPageSize) - 1)`
3. การเปลี่ยนหน้าหรือจำนวนแถวต่อหน้าเปลี่ยนเฉพาะ UI ไม่ส่ง request ใหม่ การสร้าง query สำหรับ `useChatResource` ต้องไม่ขึ้นกับ pagination model อีกต่อไป
4. คง `sortingMode="server"` และ `filterMode="server"` เพื่อใช้ความหมายการค้นหา/ตัวกรองเดิม เมื่อเปลี่ยน search/filter/sort ให้ reset หน้าจอเป็น `0` แล้วโหลดข้อมูลที่ตรง query ทั้งชุดใหม่ ไม่กรองเฉพาะหน้าที่แสดง
5. หลัง refresh/เปิดเรื่อง/ปิดเรื่อง ถ้าจำนวนผลลดจนหน้าเดิมไม่มีข้อมูล ให้ clamp หรือ reset หน้าจอ ป้องกันผล request เก่าทับ query/บัญชีใหม่ และรักษาสถานะ loading/error
6. หากเปิด Export ในอนาคต ให้กำหนดชัดว่าทั้งชุดที่ตรงตัวกรองหรือเฉพาะหน้าจอ ปัจจุบัน `ChatWorkspace` ปิด CSV/print ใน toolbar อยู่แล้ว ไม่จำเป็นต้องเพิ่ม feature นี้ในงาน pagination

คง mapping sort/filter ใน `ticketQuery` และ validation ตาม canonical เดิม ไม่ส่ง DataGrid model ทั้งก้อนหรือเพิ่ม query fields นอกสัญญา API ข้อมูล list มี `lastMessageAt` และ `capabilities` แต่ไม่มี `messages`/`events`; โหลดรายละเอียดเมื่อเปิดบทสนทนา

## 3. สิทธิ์และพฤติกรรมที่ต้องคงไว้

- ใช้ Bearer token จาก session ปกติของแอปและ URL ตาม [`contentApi.mjs`](../../../../../frontend/src/utils/contentApi.mjs); ไม่สร้าง token ทดสอบหรือหน้าล็อกอิน Chat แยก
- **มีสิทธิ์ใช้งาน** คือ `permissions.chat.view` / `chat:view` เปิดเรื่อง สนทนา และปิดเรื่องในขอบเขตโรงงานได้ ไม่ใช้ `userType`, `isStaff`, role หรือ `chat.edit` ขวางเพิ่ม
- ปุ่มเปิดเรื่องใช้ `options.canCreate`; ส่ง/ปิดใช้ `ticket.capabilities.canReply`/`canClose` และสถานะปัจจุบัน Backend เป็นผู้ตรวจสิทธิ์ทุก request
- `options.viewer.userId` เทียบกับ `message.sender.userId` สำหรับข้อความของตัวเอง ไม่เทียบ role; Ticket ID, ticket number, ผู้ส่งและวันเวลามาจาก backend
- ข้อความ trim แล้วต้องไม่ว่าง และไม่เกิน `options.limits.messageMaxLength` ซึ่งปัจจุบันเป็น 2,000 หน่วย UTF-16 (`string.length`) แสดงเป็น plain text ไม่ประมวลผล HTML
- เมื่อ logout/login อีกบัญชีหรือสิทธิ์ถูกถอน ให้ยกเลิกคำขอเดิมและล้างข้อมูลที่ไม่มีสิทธิ์ดู ห้ามนำข้อมูลที่เคยโหลดครบแล้วมาใช้ข้ามบัญชี

## 4. บทสนทนาและการส่งซ้ำ

การเปลี่ยนสองรายการไม่เปลี่ยน [`ChatConversation.jsx`](../../../../../frontend/src/components/ChatConversation.jsx) หรือสัญญาข้อความ ให้รักษาพฤติกรรมเหล่านี้เมื่อปรับ frontend:

- โหลดข้อความล่าสุดด้วย `limit=50`; ใช้ `olderCursor` สำหรับประวัติก่อนหน้า ส่วน refresh ใช้ `afterMessageId` และติดตาม `nextAfterMessageId` เมื่อ `hasMore=true` จนจบรอบ ไม่ส่ง cursor ทั้งสองทิศทางพร้อมกัน ไม่มี polling/WebSocket
- ตำแหน่งอ่านข้อความใหม่เลื่อนเฉพาะเมื่อ GET สำเร็จ แยกจาก ID สูงสุดที่แสดง หลังอ่านถึง `100` → คนอื่นส่ง `101` → เราส่งได้ `102` การ refresh ต้องยังเริ่มหลัง `100` เพื่อไม่ข้าม `101`; deduplicate ตาม `message.id`
- อัปเดต `data.ticket` แม้ไม่มีข้อความใหม่เพื่อรับสถานะปิด/สิทธิ์ล่าสุด แสดง events จาก server และรักษาตำแหน่ง scroll เมื่อโหลดประวัติเก่า
- create/send ใช้ UUID `Idempotency-Key` หนึ่ง key ต่อเจตนาส่ง ถ้า timeout หรือไม่รู้ผล ให้ส่ง payload/key เดิม ไม่สร้าง key ใหม่โดยอัตโนมัติ ยอมรับ `201` และ `200` replay เป็นผลสำเร็จโดยไม่แสดงซ้ำ
- คง draft เมื่อส่งไม่สำเร็จและไม่ลบข้อความใหม่ที่ผู้ใช้พิมพ์ระหว่างรอ ปิด dialog ไม่ใช่การเรียก `/close`; ปิดเรื่องจริงต้องผ่านปุ่มและการยืนยันเดิม

| ผลจาก API | การทำงานของ frontend |
| --- | --- |
| `400 VALIDATION_ERROR` | ตรวจ field/query ที่ส่ง โดยเฉพาะ pagination key ที่ต้องถอด; ไม่ retry คำขอผิดเดิมอัตโนมัติ |
| `401` / `403` | ใช้ flow session/สิทธิ์เดิม ล้างข้อมูลที่เข้าถึงไม่ได้และหยุด action |
| `404` | ไม่พบหรือไม่มีสิทธิ์เข้าถึง ให้โหลดรายการที่เกี่ยวข้องใหม่ ไม่เปิดเผย resource จาก cache ต่อ |
| `409 CHAT_TICKET_CLOSED` | รีเฟรชสถานะ ปิดช่องส่ง และคง draft พร้อมคำอธิบาย |
| `409 IDEMPOTENCY_KEY_CONFLICT` | ตรวจคำขอเดิม ไม่เปลี่ยน key เพื่อส่งใหม่ทันที |
| `429` | รอตาม `Retry-After`; รองรับทั้ง JSON และข้อความล้วน |
| เครือข่ายขาด / `500` | แสดง error/retry; create/send ที่ยังไม่ทราบผลคง payload/key เดิม |

## รายการตรวจรับและการเปิดใช้

- [ ] ตรวจ Network ทั้งสอง GET ไม่มี `page`/`pageSize` และตัวเลือกโรงงานโหลดครั้งเดียวต่อการเปิด/รีเฟรชที่กำหนด ไม่มี loop รายหน้า
- [ ] ผลเกิน 100 รายการของโรงงานและ Ticket ได้ครบตามสิทธิ์/ตัวกรอง ไม่ถูกตัดที่ 25/50/100; ค้นโรงงานที่อยู่นอก 25 รายการแรกได้
- [ ] Ticket แบ่ง 25/50/100 แถวในเว็บได้ จำนวนหน้าถูกต้อง เปลี่ยนหน้าหรือ page size ไม่เกิด GET เพิ่ม และ metadata `totalPages=1` ไม่บังคับให้เห็นเพียงหน้าแรก
- [ ] ค้นหา กรอง เรียง และ refresh ได้ผลจาก server ครบ รีเซ็ต/clamp หน้าได้เมื่อผลลดลง; ผลว่างไม่ตั้ง DataGrid page size เป็น `0`
- [ ] บัญชีเห็นเฉพาะโรงงานตามสิทธิ์เดิม; โรงงานไม่มีจุดเปิดเรื่องได้ เปลี่ยนโรงงานแล้วไม่ส่งจุดของโรงงานเก่า
- [ ] ปรับ tests เดิมใน `chatApi.test.mjs` ให้พิสูจน์คำขอไม่มี pagination, โรงงานคำขอเดียว, ตารางแบ่งหน้าจากข้อมูลทั้งหมด และ filter/sort mapping เดิม
- [ ] งานสิทธิ์ที่ยังค้าง: บัญชีภาณุ/เจ้าหน้าที่ที่มี `chat.view=true`, `chat.edit=false` ผ่านทั้ง UI และ API helper เพื่อเปิดเรื่องได้; ทดสอบปฏิเสธเมื่อ backend ถอนสิทธิ์
- [ ] เปิดเรื่อง–ส่ง–รีเฟรช–ปิด–reload ผ่าน session ปกติ; การ retry ไม่สร้างซ้ำ ประวัติเกิน 50 ข้อความและกรณี ID `100/101/102` ยังครบ
- [ ] รัน `npm run lint`, `npm test`, `npm run build` ใน `frontend/` และ browser test ตามพฤติกรรมข้างต้น รายงานผลจริงโดยแยก failure เดิมออกจากงานนี้

ประสานการปล่อย frontend และ backend ร่วมกัน: client เดิมส่ง pagination แล้วจะได้ `400` จาก backend ใหม่ ส่วน client ใหม่ที่เรียกครั้งเดียวจะได้เพียง 25 รายการแรกจาก backend เก่า หลัง deploy ตรวจ live OpenAPI ว่าสอง GET ไม่มี pagination query และทดสอบผลเกิน 100 รายการก่อนถือว่า release เสร็จ ไม่มี database migration สำหรับการเปลี่ยนนี้

การตรวจ production ด้วยบัญชีภาณุใช้หน้าล็อกอินปกติ เลือกโรงงานตามสิทธิ์ สร้าง Ticket ทดสอบที่มี marker ชัดเจน บันทึก Ticket ID และให้ backend ล้างเฉพาะข้อมูลรอบทดสอบหลังตรวจว่าไม่มีข้อความของผู้อื่นปะปน ไม่เพิ่มปุ่มลบถาวรใน frontend หรือเปลี่ยนสิทธิ์บัญชีเพื่อให้ผลทดสอบผ่าน เอกสารนี้ไม่ได้ยืนยันว่าได้ทำ production test หรือ cleanup แล้ว
