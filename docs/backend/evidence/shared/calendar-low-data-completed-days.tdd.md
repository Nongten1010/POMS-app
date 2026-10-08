# หลักฐานทดสอบสรุปวันข้อมูลต่ำกว่า 80% เฉพาะวันที่จบแล้ว

## สัญญาที่เกี่ยวข้อง

- [กติกาสถิติและปฏิทิน](../../api/shared/connected-measurement-points/README.md#home-measurement-rules)
- [ผลกระทบและการย้าย client](../../api/CHANGELOG.md#low-data-completed-days)
- [Regression tests](../../../../backend/tests/unit/calendar-status.completed-days.test.ts)

## สาเหตุ

`trailingLowDataSummaries` เริ่มนับจาก `endDate` โดยไม่ตรวจว่าวันนั้นจบแล้วหรือไม่ วันนี้ต่ำกว่า 80% จึงถูกนับเพิ่ม และวันนี้ถึง 80% หรือยังไม่มีชั่วโมงจบแล้วจะตัดช่วงต่อเนื่องของวันก่อนหน้า การตัดแถววันนี้ออกหลังนับจึงแก้ไม่ครบ

## กรณีจำลอง

กำหนดเวลาคงที่เป็น `2026-10-08T03:30:00.000Z` หรือ `2026-10-08 10:30` ตาม `Asia/Bangkok` จุด `P0260` มีพารามิเตอร์ `Flow Rate (m3/hr)` ส่งตรงเวลาหนึ่งชั่วโมงต่อวันในวันที่ 7 และ 8 ตุลาคม:

| รายการ | ก่อนแก้ | หลังแก้ |
| --- | --- | --- |
| `calendar-status.summary.lowDataDays` | 2 | 1 |
| `monthlySummary[].lowDataDays` | 2 | 1 |
| `details.summary.affectedDays` | 2 | 1 |
| `details.rows[].date` | วันที่ 7 และ 8 | วันที่ 7 เท่านั้น |
| เปอร์เซ็นต์วันที่ 8 | 10% | 10% |

เมื่อเพิ่มข้อมูลวันนี้ให้ครบ 8 หรือ 10 ชั่วโมง เปอร์เซ็นต์วันนี้เป็น 80% หรือ 100% แต่จำนวนวันยังคง 1 และรายละเอียดคงเฉพาะวันที่ 7

## RED / GREEN

คำสั่งรันจาก `backend/`:

```bash
npm test -- --runInBand tests/unit/calendar-status.completed-days.test.ts
```

- **RED:** ก่อนแก้ implementation ชุดแรกมี 13 tests: ล้มเหลว 11 และผ่าน 2 อาการตรงกับการรวมวันปัจจุบันและการตัดช่วงของวันก่อนหน้า
- **GREEN:** หลังแก้ชุดแรกผ่าน 13/13 และเมื่อเพิ่มกรณีตรวจวันเกินมาตรฐานของวันนี้ ชุด regression ผ่าน 14/14
- ชุดนี้เรียก service จริงโดย mock เฉพาะ repository และตรึงเวลา จึงทดสอบเส้นทางคำนวณทั้ง summary, รายพารามิเตอร์, measurement statistics และ details

## ขอบเขตที่ตรวจ

- ทั้งไม่ส่ง `endDate` และส่งวันนี้อย่างชัดเจน
- วันนี้ต่ำกว่า/เท่ากับ/สูงกว่า 80% โดยไม่เพิ่มวันและไม่ตัดช่วงต่อเนื่อง
- วันเริ่มใช้งานที่ยังไม่จบและไม่มี source rows
- วันย้อนหลังล่าสุดที่จบแล้วต้องยังถูกนับ
- เที่ยงคืนไทย รวมกรณี UTC ยังเป็นวันก่อนหน้า
- เมื่อผ่านเที่ยงคืน ใช้ฐาน 24 ชั่วโมงสำหรับวันที่เพิ่งจบ
- วันเปลี่ยนปี โดย streak ย้อนข้ามปีได้
- หยุดช่วงเมื่อวันที่จบแล้วส่งข้อมูลได้อย่างน้อย 80%
- เปอร์เซ็นต์และสถานะปฏิทินของวันนี้ยังแสดงตามข้อมูลระหว่างวัน และวันนี้ยังอยู่ในรายละเอียดเกินมาตรฐานได้
- ปฏิเสธผู้ไม่มีสิทธิ์ก่อนโหลดข้อมูล

การทดสอบใน repository ยืนยันพฤติกรรม implementation เท่านั้น ระบบจริงต้องตรวจซ้ำหลัง deploy ด้วยบัญชีที่มีสิทธิ์ และตรวจ runtime OpenAPI ตามกติกา release


## ผลตรวจร่วม

- `npm run build` และ `npm run typecheck`: ผ่าน
- ESLint เฉพาะไฟล์ TypeScript ที่แก้: 0 errors, 0 warnings
- ชุดทดสอบที่เกี่ยวข้อง 11 suites: 264/264 tests ผ่าน รวม API routes, OpenAPI, การตรวจสิทธิ์ และการคำนวณย้อนหลัง
- ก่อนส่ง production: checkout แยกจาก `12b8c6545da384fcb41702913fe45aea301d582a` มีเฉพาะ diff งานนี้ ผ่าน build/typecheck/lint และ backend suite ทั้งหมด 306 suites, 3,851 tests โดยใช้ environment จำลองและพอร์ต localhost ไม่ใช้ credentials จริง
- Coverage ของ service และ OpenAPI ที่เกี่ยวข้อง: statements 88.65%, lines 91.13%
- ไม่พบ secret หรือ debug log ใหม่ใน diff; การตรวจสิทธิ์ยังเกิดก่อนโหลดข้อมูล ไม่มีการเพิ่ม query หรือเปลี่ยน validation/authentication
- ลิงก์เอกสารที่เพิ่มหรือปรับมีไฟล์ปลายทางครบ และหลักฐานนี้เข้าถึงได้จาก backend hub ผ่าน evidence index
- `git diff --check`: ผ่าน

Docs impact: updated
Canonical docs: docs/backend/api/shared/connected-measurement-points/README.md; docs/backend/api/menus/home/README.md; docs/backend/api/CHANGELOG.md#low-data-completed-days
Reason: จำนวนวันและรายละเอียด lowData ใช้เฉพาะวันที่จบแล้วตาม Asia/Bangkok และ OpenAPI/เอกสารตรงกับ implementation
Client impact: frontend
Breaking change: yes
