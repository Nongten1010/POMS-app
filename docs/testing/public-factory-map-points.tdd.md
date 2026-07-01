# หลักฐาน TDD สำหรับ Public Factory Map Points

## แผนตั้งต้น

ไม่มีไฟล์ `*.plan.md` แยกต่างหาก จึงสรุป user journeys จากคำขอให้สร้าง public API สำหรับแสดงจุดโรงงานทั้งหมดบนแผนที่ก่อน login

## User journeys

- ในฐานะผู้ใช้ที่ยังไม่ได้ login ต้องการโหลดจุดโรงงานที่เชื่อมต่อแล้วบนแผนที่ได้ เพื่อให้หน้าแรกมี marker แสดงก่อนยืนยันตัวตน
- ในฐานะผู้ใช้ public API ต้องการให้ endpoint แผนที่ไม่คืน field เฉพาะผู้ใช้และข้อมูล measurement ดิบ เพื่อไม่ให้ public access เปิดเผยสถานะส่วนตัวของ dashboard

## รายงานงานที่ทำ

### Contract ของ public route

- คำสั่ง RED: `npm test -- --runTestsByPath tests/unit/connection-requests.operator-factories.route.test.ts --runInBand`
- ผล RED: fail ด้วย `TS2339: Property 'listPublicFactoryMapPoints' does not exist`
- คำสั่ง GREEN: `npm test -- --runTestsByPath tests/unit/connection-requests.operator-factories.route.test.ts --runInBand`
- ผล GREEN: `Test Suites: 1 passed, 1 total`, `Tests: 6 passed, 6 total`
- สิ่งที่รับประกัน: `GET /api/v1/public/factory-map-points?systemType=CEMS` คืน `200` ได้โดยไม่ต้องส่ง `Authorization`, เรียก public service พร้อม filter ที่ parse แล้ว และไม่คืน `isFavorite`, `factoryLogoUrl`, `hasLatestHourlyMeasurement`, และ `measurementPoints[].data`

### การกรองข้อมูลของ public service

- คำสั่งตรวจสอบ: `npm test -- --runTestsByPath tests/unit/connection-requests.service.test.ts --runInBand`
- ผลลัพธ์: `Test Suites: 1 passed, 1 total`, `Tests: 50 passed, 50 total`
- สิ่งที่รับประกัน: public map points ใช้ factory scope `ALL`, คืนเฉพาะ row ที่มี connected measurement point, เก็บเฉพาะ metadata ที่จำเป็นสำหรับ marker, มีจำนวน connected point แยกตามระบบ และตัด field เฉพาะผู้ใช้/ข้อมูลดิบออกจาก service response

## Test specification

| # | สิ่งที่รับประกัน | ไฟล์ test หรือคำสั่ง | ประเภท test | ผลลัพธ์ | หลักฐาน |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | ผู้ใช้ที่ยังไม่ login เรียก public factory map endpoint ได้โดยไม่ต้องมี bearer token | `backend/tests/unit/connection-requests.operator-factories.route.test.ts` | API route | PASS | `6 passed` |
| 2 | public endpoint parse `systemType` และส่งต่อให้ public service เท่านั้น | `backend/tests/unit/connection-requests.operator-factories.route.test.ts` | API route | PASS | `toHaveBeenCalledWith({ systemType: 'CEMS' })` |
| 3 | public response ไม่มี favorite state, factory logo URL, latest-hourly boolean หรือ raw measurement data | `backend/tests/unit/connection-requests.operator-factories.route.test.ts` และ `backend/tests/unit/connection-requests.service.test.ts` | API route + service | PASS | assertion `not.toHaveProperty(...)` |
| 4 | public service อ่านด้วย factory scope `ALL` และเก็บเฉพาะ public map metadata ของจุดที่เชื่อมต่อแล้ว | `backend/tests/unit/connection-requests.service.test.ts` | Service | PASS | `50 passed` |

## Coverage และข้อจำกัดที่ทราบ

- คำสั่ง coverage: `npm run test:coverage -- --runInBand`
- ผล coverage: `Test Suites: 35 passed, 35 total`, `Tests: 340 passed, 340 total`
- global coverage จากการรันทั้ง repo คือ statements `46.5%`, branches `43.88%`, functions `49.96%`, และ lines `48.26%` เพราะ Jest coverage ปัจจุบันรวม migrations, seeds, controllers, repositories และไฟล์ setup ลักษณะ generated-style ที่ coverage ต่ำ
- change นี้เป็น backend/API เท่านั้น ยังไม่รวมการ wire frontend เพราะคำขอรอบนี้ให้ทำ API
- ระหว่าง TDD stage ยังไม่ได้ตรวจ production live ควรตรวจหลัง deploy เพราะ production อาจตามหลัง local code

## หลักฐานก่อน merge

- RED: route test อ้างถึง public service method ที่ยังไม่มี ทำให้ fail ก่อนแก้ production code
- Spec-review follow-up: ปรับ public service ให้ไม่โหลด path ของ favorite/logo/raw latest-hourly และคืนเฉพาะโรงงานที่มี connected measurement point
- GREEN: route และ service tests ผ่านหลังเพิ่ม public route, controller, validator, service method, public DTOs และ documentation
