# หลักฐาน TDD: บันทึกจุดตรวจวัดของโรงงานที่เข้าข่ายแล้ว

## ที่มาและพฤติกรรมที่ต้องการ

อ้างอิงคำขอแก้บั๊กวันที่ 1 ตุลาคม 2026: โรงงานเลข `40900061525690` อยู่ในรายการเข้าข่ายแล้ว แต่กดบันทึกจุดตรวจวัดแล้วส่ง `POST /eligible-factories` และได้รับ `409 CONFLICT` พร้อมข้อความ `Factory is already selected as eligible`.

ไม่ได้ใช้ไฟล์แผนงานแยก พฤติกรรมที่ตรวจมาจากอาการที่ผู้ใช้รายงาน:

1. เพิ่มจุดตรวจวัดครั้งแรกให้โรงงานเข้าข่ายเดิมได้โดยส่งข้อมูลโรงงานและ `points[]` ไปที่ `POST /monitoring-point-forms`.
2. เมื่อมีฟอร์มเดิม ต้องใช้ `PUT /monitoring-point-forms/:id` และคงรหัสจุดเดิมไว้.
3. การเลือกโรงงานใหม่และการบันทึกฟอร์มจากขั้นตอนอนุมัติยังทำงานตามเดิม.
4. เมื่อไม่มีการเข้าสู่ระบบหรือ API ปฏิเสธ ต้องคงข้อมูลในฟอร์มและไม่ส่งคำขอเขียนอื่นเพื่อหลบข้อผิดพลาด.

## สาเหตุและการแก้

`mapEligibleFactory()` เดิมคืนข้อมูลจาก mapper ทั่วไป ซึ่งไม่มี `saveWithMonitoringPointForm` และไม่เก็บ `monitoringPointFormId`. ฟังก์ชันบันทึกจึงเลือกเส้นทางสร้างโรงงานเข้าข่ายเมื่อไม่มีรหัสฟอร์มที่โหลดกลับมาจาก lookup.

แก้เฉพาะ mapper ของรายการโรงงานที่เข้าข่ายให้ตั้ง `saveWithMonitoringPointForm: true` และเก็บ `monitoringPointFormId` โดยรองรับ `formId` เดิมด้วย. ไม่เพิ่ม endpoint หรือเปลี่ยนสัญญา backend; ใช้ POST/PUT ของฟอร์มตามสัญญาที่มีอยู่.

## RED และ GREEN

เทสต์อยู่ที่ [eligibleFactorySave.integration.test.mjs](../../frontend/src/utils/eligibleFactorySave.integration.test.mjs). ใช้ Vite โหลดหน้าจริงและ parser อ่าน callback บันทึกจาก source ปัจจุบัน จึงไม่มีสำเนาตรรกะการเลือก endpoint ในเทสต์. ใช้ mapper และ serializer จริง; จำลองเฉพาะ fetch และ state setters.

คำสั่ง RED ที่รันก่อนแก้ application code:

```sh
cd frontend
node --test src/utils/eligibleFactorySave.integration.test.mjs
```

ผลก่อนแก้: 4 subtests ล้มเหลวจากบั๊กที่ต้องการจับ ได้แก่ endpoint ผิดในกรณีเพิ่มจุดครั้งแรก/จุดว่าง และรหัสฟอร์มปัจจุบัน/legacy หาย. ตัว runner รวม parent test จึงรายงาน `tests 13, pass 8, fail 5`. ตัวอย่างหลักฐานคือ `/api-proxy/v1/eligible-factories` แทน endpoint ฟอร์ม และ `undefined !== 55`.

หลังแก้ รันชุดเดิมร่วมกับเทสต์ที่เกี่ยวข้อง:

```sh
node --test src/utils/eligibleFactorySave.integration.test.mjs src/utils/eligibleFactoryStatus.integration.test.mjs src/utils/eligibleFactoryAddRequest.test.mjs
```

ผล GREEN: `tests 21, pass 21, fail 0, skipped 0`.

## ข้อรับประกันจากเทสต์

| พฤติกรรม | ประเภท | ผล |
| --- | --- | --- |
| โรงงานเข้าข่ายเดิมที่ไม่มีฟอร์มส่ง POST ของฟอร์ม พร้อมจุด CEMS และ WPMS | Integration | PASS |
| ฟอร์มเดิมส่ง PUT พร้อม ID ของจุดเดิมและจุดใหม่ | Integration | PASS |
| เก็บรหัสฟอร์มทั้ง `monitoringPointFormId` และ legacy `formId` | Integration | PASS |
| โรงงานเข้าข่ายที่ส่งรายการจุดว่างยังใช้ endpoint ฟอร์ม | Integration | PASS |
| การเลือก candidate ใหม่ยังใช้ endpoint เลือกโรงงาน | Integration | PASS |
| ขั้นตอนอนุมัติที่ตั้ง flag เดิมยังส่งฟอร์ม | Integration | PASS |
| HTTP 400/403/409/500 คงฟอร์ม ไม่แจ้งสำเร็จ และไม่ retry ไปเขียน endpoint อื่น | Integration | PASS |
| Network error คงฟอร์มและล้างสถานะกำลังบันทึก | Integration | PASS |
| ไม่มี access token แล้วไม่มี request ออกไป | Integration | PASS |

## ตรวจผ่านหน้าจอจริง

ทดสอบ component จริงใน Chrome ผ่าน CUA โดยใช้หน้า fixture บน `127.0.0.1` ที่ intercept ทุก API request และไม่ forward ไป production:

| สถานการณ์ | หลักฐานที่มองเห็นบนหน้า | ผล |
| --- | --- | --- |
| เปิดโรงงานเข้าข่าย เพิ่มจุด `New stack` และกดบันทึก | แสดงข้อความบันทึกสำเร็จ; POST `/api/v1/monitoring-point-forms`; `pointCount: 1`; ตารางแสดง CEMS 1 จุด | PASS |
| เปิดฟอร์ม 55 ที่มีจุด 7 เพิ่ม `Second stack` และกดบันทึก | แสดงข้อความบันทึกสำเร็จ; PUT `/api/v1/monitoring-point-forms/55`; `pointNames: ["Existing stack", "Second stack"]`; `pointIds: [7, null]`; ตารางแสดง CEMS 2 จุด | PASS |

## การตรวจเพิ่มเติมและ coverage

- `node_modules/.bin/eslint src/pages/EligibleFactoriesPage.jsx`: PASS.
- `node --check src/utils/eligibleFactorySave.integration.test.mjs`: PASS.
- `npm run build -- --outDir /private/tmp/poms-eligible-save-build-20261001`: PASS. มีคำเตือนขนาด bundle มากกว่า 500 kB; ไม่เกี่ยวกับเส้นทางบันทึกที่แก้.
- ฝั่ง backend: `npm test -- --runInBand tests/unit/monitoring-point-forms.route.test.ts tests/unit/monitoring-point-forms.service.test.ts tests/unit/monitoring-point-forms.validator.test.ts --cacheDirectory=/private/tmp/poms-eligible-backend-jest-cache`: PASS, 3 suites และ 64 tests. ไม่มีการแก้ backend.
- `git diff --check`: PASS.
- ไม่พบ instrumentation ที่มี `[DEBUG-` ในไฟล์ที่เกี่ยวข้อง.

คำสั่ง coverage ที่รันจาก `frontend/`:

```sh
NODE_V8_COVERAGE=/private/tmp/poms-eligible-save-coverage.NyePga node --test --experimental-test-coverage --test-coverage-include='**/EligibleFactoriesPage.jsx' src/utils/eligibleFactorySave.integration.test.mjs src/utils/eligibleFactoryStatus.integration.test.mjs src/utils/eligibleFactoryAddRequest.test.mjs
```

อ่าน raw V8 coverage ของ module จริงจาก Vite: ฟังก์ชัน production ที่แก้ `mapEligibleFactory` ถูกเรียก 10 ครั้ง และทุกบล็อกที่ V8 รายงานถูกเรียก (`3/3`, 100%). ครอบคลุม ID แบบปัจจุบัน, legacy และไม่มีฟอร์ม. เป็น coverage เฉพาะฟังก์ชันที่แก้ ไม่ใช่ coverage ทั้งหน้า/ทั้ง frontend. ตารางรวมของ Node ที่กรองชื่อไฟล์ไม่แสดง Vite module URL จึงไม่ใช้ค่า 100% จากตารางว่างเป็นหลักฐาน.

## ความปลอดภัยและข้อจำกัด

การแก้ไม่เปลี่ยน token handling, backend authentication, authorization, validation หรือการตรวจรายการซ้ำ. เทสต์ตรวจว่าไม่มี token แล้วไม่ส่งคำขอ และเมื่อได้รับ 403/409 จะคงฟอร์มและหยุด. ใช้เฉพาะ token จำลองในการทดสอบ ไม่บันทึก credential จริง.

ณ ขั้นตอนเก็บหลักฐาน RED/GREEN ยังไม่ได้ deploy หรือทดสอบเขียนข้อมูลบน `d-poms.diw.go.th`. การทดสอบบนเครื่องและ API จำลองไม่ใช่หลักฐานว่าข้อมูล production ถูกบันทึกแล้ว; ผล deploy ต้องตรวจแยกจากผลทดสอบนี้.

ช่วง RED/GREEN ไม่ได้สร้าง checkpoint commit เพราะขณะนั้นผู้ใช้ยังไม่ได้สั่ง commit. รายงานนี้เก็บหลักฐานก่อนและหลังแก้ โดยไม่รวมการแก้ไขอื่นที่มีอยู่ใน worktree; หลังตรวจผ่าน ผู้ใช้จึงอนุญาตให้ push production.
