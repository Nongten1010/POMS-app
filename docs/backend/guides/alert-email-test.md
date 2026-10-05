# ทดลองการแจ้งเตือนอีเมลทั้ง 6 แบบในเครื่อง

ชุดจำลองนี้ใช้ validator, กฎรายวัน, ตัวจัดคิว, เทมเพลต, การตรวจสิทธิ์ผู้รับก่อนส่ง และตัวส่งอีเมลของ backend จริงกับข้อมูลทดสอบในหน่วยความจำ โดยใช้ Nodemailer ส่งเข้า SMTP sink ที่ `127.0.0.1` ซึ่งเครื่องมือสร้างและปิดเอง ไม่เชื่อมฐานข้อมูล ไม่อ่าน `.env` ไม่รับ `SMTP_HOST` จาก environment และไม่ส่งต่ออีเมลออกภายนอก

## เริ่มทดสอบ

ใช้ Node.js รุ่นที่รองรับโดย backend และ dependencies ที่ติดตั้งอยู่แล้ว รันจาก `backend/`:

```bash
npm run test:alert-emails
```

ไม่ต้องเปิด backend server, สร้าง cron, ตั้ง SMTP production หรือเปิด `ALERT_EMAIL_ENABLED` เครื่องมือกำหนดเวลาเองในชุดทดสอบ โดยไม่เปลี่ยนนาฬิกาเครื่องหรือการตั้งค่า production

ผลลัพธ์แสดง `PASS` / `FAIL` รายกรณี สรุปจำนวน checks และอีเมล 6 ฉบับ พร้อมพาธรายงาน เช่น:

```text
PASS … checks · 6 captured emails
Report: /private/tmp/poms-alert-email-test-…/report.html
Evidence: /private/tmp/poms-alert-email-test-…/report.json
```

เปิด `report.html` ใน browser เพื่อดูผลตรวจรับและตัวอย่างอีเมลทั้ง 6 แบบ หากมี `FAIL` คำสั่งจะจบด้วย exit code `1` ให้ดูคอลัมน์คาดหวัง/พบจริงและหลักฐานใน `report.json` ก่อนเปิดส่งจริง

หากต้องการกำหนดโฟลเดอร์ผลลัพธ์เอง:

```bash
npm run test:alert-emails -- --output /private/tmp/poms-alert-email-test-my-run
```

โฟลเดอร์ต้องเป็นพาธใหม่รูปแบบ `/private/tmp/poms-alert-email-test-NAME` ชื่อท้ายใช้ตัวอักษรภาษาอังกฤษ ตัวเลข `_` หรือ `-` เครื่องมือไม่เขียนทับโฟลเดอร์เดิม และไม่เขียน generated files ลง repository

## ตรวจอะไรบ้าง

| กรณี | ข้อมูลทดสอบ | ผลที่ตรวจ |
|---|---|---|
| ข้อ 1 มาตรฐาน | ค่า 100 / 120 / 125 เทียบเกณฑ์ 120 | ต่ำกว่าและเท่ากับถูกปฏิเสธ ค่าเกินผ่าน validator จริง |
| ข้อ 2 EIA | ค่า 100 / 120 / 125 เทียบเกณฑ์ 120 | ใช้เงื่อนไขเดียวกันโดยแยกเหตุการณ์ EIA |
| ข้อ 3 ความครบถ้วน | 0, 19, 20, 24 ชั่วโมงจาก 24 และครบ 80% พอดีเมื่อตัดชั่วโมงหยุดเดินเครื่อง | เตือนเฉพาะต่ำกว่า 80% |
| ข้อ 4 CEMS | ไม่ส่งข้อมูลสลับรายงานต่ำกว่า 80% ต่อเนื่อง 14 / 15 วัน | เตือนข้อ 4 เมื่อครบ 15 วัน และเริ่มนับใหม่เมื่อมีวันรายงานครบ |
| ข้อ 5 WPMS | เงื่อนไขเดียวกันต่อเนื่อง 7 / 8 วัน | เตือนข้อ 5 เมื่อครบ 8 วัน และเริ่มนับใหม่เมื่อมีวันรายงานครบ |
| ข้อ 6 ค่าผิดปกติ | ค่านิ่ง ศูนย์ และติดลบ 4 / 5 ค่า, ชั่วโมงขาดหาย, Calibration และค่าปกติ | ใช้จำนวนที่กำหนด 5 ค่า, ชั่วโมงต้องต่อเนื่องและสถานะต้อง Normal |
| เวลาส่ง | ก่อน/ถึง 09:00 และก่อน/ถึง 12:05 | ข้อ 3–6 ส่งรอบ 09:00 ของวันถัดจากข้อมูล; ข้อ 1–2 รอบข้อมูล 11:00–11:59 ส่ง 12:05 เมื่อหน่วง 5 นาที |
| ไม่ส่งซ้ำ | รัน engine เดิมซ้ำและสร้าง engine ใหม่โดยใช้คิวเดิม | ไม่สร้างคิวหรือส่งรายการเดิมซ้ำ |
| ตรวจซ้ำก่อนส่ง | คิวเดิมที่ค่าตรวจวัดถูกเปลี่ยนเป็นต่ำกว่าเกณฑ์ | สถานะ `SKIPPED` ก่อนเรียก SMTP |
| SMTP ผิดพลาด | transport ทดสอบจำลองรหัส 450 และ timeout | 450 ใช้ `RETRY_PENDING` และรอถึงเวลาลองใหม่; ผลไม่แน่นอนใช้ `UNKNOWN` และไม่ส่งซ้ำเอง |

เวลาในชุดทดสอบเป็น `Asia/Bangkok` และใช้ข้อมูลรายวัน `2026-10-04` กับรอบส่ง `2026-10-05` เกณฑ์ จำนวนค่าผิดปกติ สูตรความครบถ้วน และผู้รับที่เลือกเป็น **นโยบายทดสอบ** ไม่ได้เปลี่ยนหรือยืนยันนโยบาย production

## หลักฐานที่ได้

- `report.html`: ผลตรวจรับและตัวอย่างอีเมลครบ 6 แบบ ไม่มี remote assets
- `report.json`: นโยบายทดสอบ, expected/actual แต่ละ check, fixture events, delivery IDs, event IDs, เวลา, To/CC และ SMTP envelopes ที่ sink รับจริง
- `message-01.eml` ถึง `message-06.eml`: MIME ที่ Nodemailer ส่งเข้า SMTP sink จริง มี plain text และ HTML

ผู้รับ fixture คือ `qa-officer@example.com` และ CC เป็น `diw.iemc@gmail.com` ทุกฉบับ ทั้งสองถูก SMTP sink ในเครื่องรับไว้ ไม่มีการส่งไปยังกล่องดังกล่าว

## ขอบเขตที่ยังต้องตรวจในระบบทดสอบจริง

ข้อ 1–2 ป้อน **fixture เหตุการณ์ที่ผ่าน `createIntegrationAlertEventSchema` จริง** เพราะยังไม่ได้ยืนยันตัวตรวจค่าเกินของระบบต้นทาง ชุดนี้พิสูจน์การรับ/ปฏิเสธเหตุการณ์และขั้นจัดคิวถึง SMTP ทดสอบ แต่ยังไม่พิสูจน์ว่าข้อมูลรายชั่วโมงจากต้นทางถูกเลือกเกณฑ์และสร้างเหตุการณ์ถูกต้อง

ฐานข้อมูลและคิวเป็น in-memory adapter จึงยังไม่พิสูจน์ SQL Server, query จุดเชื่อมต่อ/พารามิเตอร์/หน่วยและประวัติ activation จริง, migration, transaction, race ระหว่างหลาย worker หรือความคงทนของข้อมูลข้าม process การ restart ในชุดนี้เป็นการสร้าง engine ใหม่โดยใช้ adapter เดิม ไม่ใช่ restart backend จริง

ตัวจัดคิวและ dispatcher ถูกเรียกด้วย explicit clock ไม่ได้ทดสอบ process scheduler ที่ตรวจทุกนาที ส่วนรหัส 450 และ timeout เป็นผลจาก transport ทดสอบจำลอง ไม่ใช่การทำให้ SMTP production ล้มเหลว

SMTP sink ยืนยันว่า Nodemailer ส่ง MIME ได้จริงในเครื่อง ไม่ยืนยันการรับเข้า inbox หรือ SMTP production ก่อนเปิดใช้จริงจึงต้องตรวจเพิ่มในฐานข้อมูลทดสอบแยก พร้อมระบบต้นทางและ worker จริง แล้วจึงส่งเข้ากล่องทดสอบที่ได้รับอนุญาตและตรวจ inbox

## รัน regression ของเครื่องมือ

```bash
npx --no-install jest tests/unit/alert-email-simulation.test.ts --runInBand
```

Jest ใช้ capturing transport แทน network เพื่อตรวจว่ารายงานผ่านครบ 6 แบบ ตรวจจับ SMTP partial acceptance เป็น `FAIL` และแสดงตัวอย่าง HTML ที่ escape ข้อมูลพร้อม sandbox iframe

## แหล่งอ้างอิง

- [การตั้งค่าและปฏิบัติการอีเมลแจ้งเตือน](alert-email-operations.md)
- [สัญญา API อีเมลแจ้งเตือน](../api/menus/notifications/email-notifications.md)
- [สัญญา API เหตุการณ์จากระบบต้นทาง](../api/integrations/alert-events/README.md)
- [CLI](../../../backend/scripts/test-alert-emails.ts)
- [ข้อมูลจำลองและการตรวจรับ](../../../backend/scripts/alert-email-test/simulation.ts)
- [SMTP sink](../../../backend/scripts/alert-email-test/local-smtp.ts)
- [Regression tests](../../../backend/tests/unit/alert-email-simulation.test.ts)
