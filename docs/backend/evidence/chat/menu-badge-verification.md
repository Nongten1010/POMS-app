# ผลตรวจ Badge ของ Chat

[กลับไป Evidence](../README.md) · [Canonical contract](../../api/shared/menu-badges/README.md#chat-ที่มีข้อความล่าสุดจากอีกฝ่าย)

เพิ่ม `data.chat` ใน `GET /api/v1/me/menu-badges` พร้อม response type, runtime OpenAPI และ canonical contract โดยใช้ขอบเขตอ่านของรายการ Chat เดิม

## เงื่อนไขที่ตรวจ

| เงื่อนไข | หลักฐาน |
| --- | --- |
| ห้องเปิดที่ข้อความล่าสุดเป็นเจ้าหน้าที่/ผู้ดูแลระบบทำให้ผู้ประกอบการเห็น Badge | repository tests ผ่านทั้ง `officer` และ `admin` |
| ห้องเปิดที่ข้อความล่าสุดเป็นผู้ประกอบการทำให้เจ้าหน้าที่/ผู้ดูแลระบบเห็น Badge | repository tests รวมข้อความแรกและการตอบกลับ |
| ห้องปิดไม่นับ ไม่ว่าข้อความล่าสุดเป็นฝั่งใด | repository และ HTTP tests |
| ตรวจแต่ละห้อง ไม่ใช้เพียงห้องที่เคลื่อนไหวล่าสุด | repository test มีสองห้องที่ทำให้คนละฝั่งเห็น Badge |
| ใช้ message ID ล่าสุดเมื่อเวลาส่งเท่ากัน และ persona ที่บันทึก ณ ส่ง | repository tests รวมการเปลี่ยนชนิดบัญชีภายหลัง |
| คนละบัญชีแต่ฝั่งเดียวกันไม่ทำให้ติด Badge | repository tests ของเพื่อนร่วมโรงงานและเจ้าหน้าที่อีกคน |
| ใช้โรงงานปัจจุบัน/จังหวัด/ภาค/นิคม/ประเภทโรงงาน และสิทธิ์ที่ถอนแล้ว | repository tests ที่ใช้ SQL fixture และ query จริง |
| มีเพียง `chat:view` ก็อ่าน Badge ได้ ขาดสิทธิ์คืน `false` | service และ HTTP tests รวมโหลดสิทธิ์ใหม่ด้วย token เดิม |
| ผลลัพธ์ครบ 7 boolean, query error ไม่ถูกแทนด้วย `false` | service, HTTP และ runtime OpenAPI tests |

## ผลตรวจใน workspace

`npm run build` ผ่าน และชุดทดสอบที่เกี่ยวข้องบนฐาน release ล่าสุด **11 suites / 296 tests ผ่านทั้งหมด**:

```bash
cd backend
npm test -- --runInBand --runTestsByPath \
  tests/unit/menu-badges.chat.repository.test.ts \
  tests/unit/menu-badges.service.test.ts \
  tests/unit/menu-badges.route.test.ts \
  tests/unit/menu-badges.openapi.test.ts \
  tests/unit/chat.repository.test.ts \
  tests/unit/chat.access.test.ts \
  tests/unit/chat-factories.repository.test.ts \
  tests/unit/chat.routes.test.ts \
  tests/unit/chat.openapi.test.ts \
  tests/unit/api-docs.openapi.test.ts \
  tests/unit/api-docs.route.test.ts
```

ทดสอบการจัดรูปแบบเฉพาะไฟล์ TypeScript ที่เปลี่ยน และตรวจ relative links/reachability ของเอกสารที่เปลี่ยนจาก backend hub โปรเจกต์ยังไม่มี script `docs:check` จึงไม่ได้อ้างว่าผ่าน docs guard เต็มรูปแบบ

## ข้อจำกัดและการตรวจหลัง deployment

- SQL fixture ใช้ SQL.js รัน query จาก Knex ของระบบจริง แต่แปลงไวยากรณ์บางส่วนของ SQL Server จึงยังไม่ได้ยืนยัน execution plan หรือประสิทธิภาพบน SQL Server จริง ใช้ index `chat_messages(ticket_id, id)` เดิมและเลือกเพียง ticket ID แรก ไม่เพิ่ม migration
- ยังไม่ได้ commit, push หรือ deploy ผลตรวจนี้จึงไม่ยืนยันว่า production ใช้สัญญาใหม่ หลัง deploy ต้องตรวจ `/api/v1/openapi.json` ว่ามี required boolean `MenuBadges.chat` และลอง API ด้วยบัญชีแต่ละฝั่งในขอบเขตที่เหมาะสม

## การประเมินงานด้วย `ecc:agent-self-evaluation`

ผลประเมิน **4.6/5** พร้อมส่งตรวจโค้ดภายใต้ขอบเขตงานนี้

| ด้าน | คะแนน | หลักฐานและข้อจำกัด |
| --- | --- | --- |
| Accuracy | 4/5 | build และ 296 tests ผ่าน; ยังไม่มีผล SQL Server จริง จึงต้องตรวจหลัง deployment ก่อนสรุปผล production |
| Completeness | 5/5 | ครบผู้ประกอบการ/เจ้าหน้าที่ สถานะห้อง ข้อความล่าสุด หลายห้อง และสิทธิ์เดิม พร้อม contract ทั้งสองแหล่ง |
| Clarity | 5/5 | canonical page มี response field และตารางเกณฑ์แยกฝั่ง; หน้า Chat ลิงก์กลับสัญญากลาง |
| Actionability | 5/5 | มีโค้ด ชุดทดสอบ คำสั่งตรวจซ้ำ และรายการตรวจหลัง deployment ที่ชัดเจน |
| Conciseness | 4/5 | เงื่อนไขใหม่อยู่ใน query เดียว; formatter ทำให้ diff ของ service มีการเยื้องส่วนเดิมเพิ่ม ควรตรวจด้วย diff ที่ละเว้น whitespace |

ข้อปรับปรุงลำดับแรกคือยืนยัน query และ contract บนระบบจริงหลัง deployment ที่ได้รับอนุญาต ประเมินว่าผู้ใช้จะเห็นตรงกันได้เพราะพฤติกรรมที่ขอมีการทดสอบครบ และระบุขอบเขตผลตรวจไว้อย่างชัดเจน

## Documentation impact

```text
Docs impact: updated
Canonical docs: docs/backend/api/shared/menu-badges/README.md; docs/backend/api/menus/chat/README.md
Reason: เพิ่ม data.chat และกติกาข้อความล่าสุดของห้องที่เปิดการสนทนา พร้อม runtime OpenAPI
Client impact: frontend
Breaking change: no
```
