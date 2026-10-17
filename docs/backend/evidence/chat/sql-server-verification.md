# หลักฐานการตรวจ Chat กับฐานข้อมูลทดสอบ

สัญญาที่อ้างอิง: [เมนู Chat / Ticket](../../api/menus/chat/README.md)

## ผลที่ยืนยันได้

การตรวจรอบนี้รันคำสั่งต่อไปนี้จาก `backend/`:

```bash
npm test -- --runInBand tests/integration/chat.sql-server.test.ts
```

ผลคือ **4 tests ผ่าน และ 4 tests ข้ามอย่างชัดเจน**:

| กลุ่ม | ผล | ความหมาย |
| --- | --- | --- |
| ตรวจการกำหนดฐานทดสอบ | ผ่าน 3 tests | ปฏิเสธการใช้ค่า `DB_*` แทนค่าทดสอบ, ปฏิเสธ marker ที่ไม่ใช่ฐานสมมติ และตรวจรูปแบบ port/TLS ก่อนเชื่อมต่อ |
| สถานะ transaction ของ SQL.js fixture | ผ่าน 1 test | callback เห็น `isTransaction=true` และคืนสถานะเดิมหลัง commit/rollback เพื่อให้รันแขนง query เดียวกับ production |
| เปิด Ticket / ส่งข้อความพร้อมกัน / rollback บน SQL Server | ข้าม 4 tests | ยังไม่มีหลักฐานว่าการล็อกและการทำงานพร้อมกันผ่านบน SQL Server จริง |

เครื่องที่ตรวจมี Docker CLI แต่ Docker daemon ไม่ทำงาน และไม่มีตัวแปร `POMS_SQL_TEST_*` ที่กำหนดไว้ จึงไม่ได้เชื่อมต่อหรือเขียนฐาน SQL Server ใด ไม่มีการอ่านรหัสผ่านจาก `.env` หรือใช้ฐาน production ทดแทน

[SQL.js fixture](../../../../backend/tests/helpers/chat-sql-fixture.ts) ใช้ข้อมูลสมมติและรัน query ที่สร้างโดย Knex จริง โดยแทนเฉพาะขอบเขตฐานข้อมูล รองรับการทดสอบ HTTP ด้วย middleware ยืนยันตัวตนและตัวคำนวณสิทธิ์ปัจจุบันจริง การแปลง dialect ใน fixture ตัด lock hints ออกและใช้ transaction ทีละรายการ จึงใช้ตรวจพฤติกรรมและ rollback แบบลำดับได้ แต่ **ไม่ใช่หลักฐานเรื่อง concurrency, deadlock หรือความเข้ากันได้ของ SQL Server dialect**

### หลักฐานรอบ TDD ของ fixture

เพิ่ม test ที่ขอบเขต `Knex.transaction` ก่อนแก้ fixture พบผลล้มเหลว `Expected: true; Received: undefined` ภายใน callback จากนั้นให้ fixture ตั้ง `isTransaction=true` เฉพาะระหว่าง callback และคืน property descriptor เดิมใน `finally` ทั้งเส้นทาง commit และ rollback จึงผ่าน test เดิม การแก้นี้ทำให้แขนง query ที่ตรวจ transaction ทำงานระหว่างทดสอบ แต่ยังไม่จำลองการล็อกพร้อมกันของ SQL Server

## เงื่อนไขก่อนรัน SQL Server จริง

[ชุดทดสอบ SQL Server](../../../../backend/tests/integration/chat.sql-server.test.ts) เปิดใช้เฉพาะเมื่อ `CHAT_SQL_TEST_ENABLED=true` เท่านั้น ค่าที่ไม่ใช่ `true` หรือ `false` จะทำให้ชุดทดสอบล้มเหลว หากเปิดใช้แล้วตั้งค่าเชื่อมต่อไม่ครบ ชุดทดสอบต้องล้มเหลวและไม่ลดระดับเป็นการข้าม test

เตรียม SQL Server สำหรับทดสอบแยกจาก production และฐานใหม่ที่ลบทิ้งได้ชื่อ **`poms_chat_test`** ฐานต้องยังไม่มี user table และมี extended property ระดับฐานข้อมูลดังนี้:

- ชื่อ property: `PomsTestPurpose`
- ค่า: `chat-integration-synthetic-only`

ตัวอย่าง SQL สำหรับผู้ดูแลระบบทดสอบใช้ provision ฐานใหม่เท่านั้น คำสั่งนี้ปฏิเสธเมื่อชื่อฐานมีอยู่แล้ว และไม่ล้างฐานเดิม:

```sql
USE [master];
GO
IF DB_ID(N'poms_chat_test') IS NOT NULL
    THROW 51000, 'Provision a fresh disposable chat test database; existing database is preserved', 1;
CREATE DATABASE [poms_chat_test];
GO
USE [poms_chat_test];
GO
EXEC sys.sp_addextendedproperty
    @name = N'PomsTestPurpose',
    @value = N'chat-integration-synthetic-only';
GO
```

กำหนดสิทธิ์ให้บัญชีทดสอบสร้างและแก้ไข schema ภายในฐานสมมตินี้ โดยไม่ใช้บัญชีหรือสิทธิ์ production จากนั้นส่งค่าผ่าน environment/ระบบเก็บ secret ของเครื่องทดสอบ:

| ตัวแปร | ค่าหรือข้อกำหนด |
| --- | --- |
| `CHAT_SQL_TEST_ENABLED` | `true` |
| `POMS_SQL_TEST_DATABASE` | ต้องเป็น `poms_chat_test` เท่านั้น |
| `POMS_SQL_TEST_HOST` | host ของ SQL Server สำหรับทดสอบ |
| `POMS_SQL_TEST_USER` | บัญชีสำหรับฐานทดสอบ |
| `POMS_SQL_TEST_PASSWORD` | secret ของบัญชีทดสอบ; ห้ามบันทึกใน Git หรือรายงานผล |
| `POMS_SQL_TEST_PORT` | ไม่บังคับ; ค่าเริ่มต้น `1433`, ช่วง `1`–`65535` |
| `POMS_SQL_TEST_ENCRYPT` | ไม่บังคับ; `true` หรือ `false`, ค่าเริ่มต้นเปิด encryption |
| `POMS_SQL_TEST_TRUST_SERVER_CERTIFICATE` | ไม่บังคับ; `true` หรือ `false`, ค่าเริ่มต้นไม่เชื่อถือ certificate โดยอัตโนมัติ |

เมื่อกำหนดครบแล้วรันคำสั่งเดิมจาก `backend/`:

```bash
npm test -- --runInBand tests/integration/chat.sql-server.test.ts
```

ตัว harness ตรวจ `DB_NAME()`, marker และจำนวน user tables ก่อนสร้าง fixture ไม่ fallback ไป `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` หรือ `.env` ของแอป และไม่รัน migration/seed ทั้งระบบ ใช้เพียงตารางประกอบที่เป็นข้อมูลสมมติและ [migration 0141 ของ Chat](../../../../backend/src/db/migrations/0141_create_chat_tickets.ts)

## สิ่งที่ชุด SQL Server ตรวจ

1. เปิด Ticket หลายคำขอพร้อมกันแล้วได้เลขต่างกัน; retry ด้วย key เดียวกันได้ Ticket เดิมและข้อความแรกเพียงหนึ่งรายการ
2. ส่งข้อความซ้ำพร้อมกันได้ข้อความเดียว; ส่งแข่งกับปิดเรื่องได้ผลตามลำดับการล็อก; หลังปิดปฏิเสธข้อความใหม่ แต่ retry ข้อความที่เคยสำเร็จคืนรายการเดิมได้
3. เปิดเรื่องด้วยชื่อโรงงานภาษาไทย 500 ตัวอักษร จังหวัด 128 ตัวอักษร และชื่อผู้ส่งรวม 257 ตัวอักษร แล้วอ่าน snapshot ผ่าน API เพื่อให้ SQL Server ตรวจความกว้างคอลัมน์จริง
4. เพิ่ม CHECK constraint ชั่วคราวให้ฐานปฏิเสธข้อความแรก แล้วตรวจผ่าน HTTP ว่าไม่มี Ticket ค้างและ retry key เดิมสำเร็จหลังถอด constraint; ถอด constraint ใน `finally`

ทุก assertion ของพฤติกรรม Ticket อ่านผ่าน HTTP API ไม่อ่านตารางโดยตรงเพื่อยืนยันผล ส่วนการตั้ง fixture และการจำลองข้อผิดพลาดอยู่ที่ขอบเขตฐานข้อมูล

หลังจบ ชุดทดสอบปิด connection pool แต่ **เก็บฐานสมมติไว้เพื่อให้ตรวจสอบผลได้** การรันครั้งต่อไปต้องใช้ฐานใหม่ที่ว่างและมี marker ตรงเดิม จัดการฐานเก่าในขั้นตอนดูแลสภาพแวดล้อมทดสอบแยกต่างหาก; harness ไม่ drop ฐานหรือ cleanup ข้อมูลภายนอกให้เอง

การตรวจนี้ยังไม่ครอบคลุม deployment, migration บนข้อมูลจริง หรือ contract ที่เปิดเผยจาก production ต้องบันทึกผล SQL Server ที่ไม่ข้าม tests และผลตรวจหลัง deployment เพิ่มก่อนถือว่าผ่านเงื่อนไขเหล่านั้น
