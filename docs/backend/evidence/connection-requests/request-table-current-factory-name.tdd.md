# หลักฐาน TDD: ชื่อโรงงานในตารางรายการคำขอใช้ current/live POMS

## Canonical Contract

- [ขอเชื่อมต่อ](../../api/menus/connection-requests/README.md#request-table-location-source)

## Reproduction

กรณีคำขอ `OLDC-69-00001` และจุดตรวจวัด `S1125` มีชื่อที่ถูกต้องใน request snapshot และ active `cems_wpms_connected_measurement_points` แต่ `factories.name` ถูก external login sync เขียนเป็นชื่อชั่วคราว. ก่อนแก้ `GET /api/v1/cems-wpms-requests/table-rows` คืนชื่อจาก factory summary จึงแสดงชื่อชั่วคราวแทน current/live POMS.

ผล read-only service invocation ก่อนแก้:

```json
{
  "requestNo": "OLDC-69-00001",
  "factoryName": "โรงงาน 10120000325542",
  "monitoringPointCode": "S1125",
  "statusCode": "CONNECTED"
}
```

## RED / GREEN Report

| Stage                    | Command                                                                                                                                                   | Result | Evidence                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| RED                      | `npm test -- --runInBand tests/unit/connection-requests.service.test.ts -t "uses the current POMS factory name in request rows without a factory master"` | FAIL   | repository/service ยังไม่มี current POMS name lookup ที่ไม่พึ่ง factory master      |
| GREEN: service           | command เดิม                                                                                                                                              | PASS   | table row ใช้ current POMS name ก่อน factory master และ request snapshot            |
| GREEN: repository        | `npm test -- --runInBand tests/unit/connection-requests.repository.test.ts -t "loads current POMS factory names without requiring a factory master"`      | PASS   | query อ่าน active POMS rows ด้วย factory identifiers และ `eligibleFactoryId` โดยตรง |
| GREEN: live service read | `connectionRequestsService.listTableRows({}, 7, "ALL")` แล้วเลือก request เป้าหมาย                                                                        | PASS   | response คืนชื่อเดียวกับ active POMS point                                          |

ผล read-only service invocation หลังแก้:

```json
{
  "requestNo": "OLDC-69-00001",
  "factoryName": "บริษัท เมโทร ปาร์ติเกิล จำกัด",
  "monitoringPointCode": "S1125",
  "statusCode": "CONNECTED"
}
```

## Guarantees

- current/live point ที่ soft-delete แล้วไม่ถูกใช้เป็นแหล่งชื่อ.
- เมื่อมีหลาย active points เลือกค่าจาก row ที่อัปเดตล่าสุด และใช้ `id` เป็น tie-breaker.
- จับคู่ current/live point ด้วย `eligible_factory_id` หรือ `factory_id` เทียบกับ identifier ของคำขอ โดยไม่ต้องมี row ใน `factories`.
- ไม่เปลี่ยน permission, regional scope หรือ ownership filtering ของรายการคำขอ.
- ไม่มี database migration และไม่ต้องอัปเดตข้อมูลโรงงานเป้าหมายซ้ำ.

## Final Verification

- `npm run build` ผ่าน.
- `npm run typecheck` ผ่าน.
- ESLint และ Prettier สำหรับไฟล์ที่เปลี่ยนผ่านโดยไม่มี warning.
- Relevant suites ผ่าน `106/106` tests.
- Full backend suite ผ่าน `82/82` suites และ `733/733` tests.
