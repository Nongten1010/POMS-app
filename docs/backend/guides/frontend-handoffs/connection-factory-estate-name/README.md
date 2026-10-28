# ส่งต่อ Frontend: ชื่อนิคมในรายการโรงงานหน้าขอเชื่อมต่อ

ทั้งสอง endpoint คืน `data[].industrialEstateName` สำหรับใช้แสดงชื่อนิคมในรายการโรงงาน:

| ผู้ใช้งาน | Endpoint | Permission |
| --- | --- | --- |
| ผู้ประกอบการ | `GET /api/v1/cems-wpms-requests/operator-factories` | `factories:view` |
| เจ้าหน้าที่ | `GET /api/v1/cems-wpms-requests/eligible-factories` | `cems_wpms_requests:view` |

Contract เต็ม รวม query, response, สิทธิ์และกติกาโรงงานไม่เข้าข่าย อยู่ที่ [API เมนูขอเชื่อมต่อ](../../../api/menus/connection-requests/README.md#operator-factory-list-source) ส่วน [OpenAPI production](https://d-poms.diw.go.th/api/v1/openapi.json) และ [Swagger UI](https://d-poms.diw.go.th/api/v1/docs/) ใช้ตรวจ contract ที่เซิร์ฟเวอร์เผยแพร่อยู่

## สิ่งที่ Frontend ใช้ได้

- เก็บ `industrialEstateName` จากแต่ละแถวใน response ไว้ใน model รายการโรงงาน
- แสดงชื่อนิคมจากค่านี้โดยตรง เมื่อเป็น `null` ให้แสดง `—` หรือข้อความว่างตามรูปแบบหน้าจอ
- ค่าเป็น `string | null` และส่ง key นี้ทุกแถว; คืน `null` เมื่อไม่มีข้อมูลนิคม หรือเป็นโรงงานไม่เข้าข่ายในรายการผู้ประกอบการ
- ใช้ชื่อ field `industrialEstateName` เหมือนกันทั้งสอง endpoint

ตัวอย่างส่วนของแถวที่มีชื่อนิคม:

```json
{
  "industrialEstateName": "นิคมอุตสาหกรรมมาบตาพุด"
}
```

ตัวอย่างส่วนของแถวที่ไม่มีข้อมูล:

```json
{
  "industrialEstateName": null
}
```

การเพิ่มนี้เป็น response field ที่รองรับ client เดิม ไม่มี request field หรือ query ใหม่ และไม่ต้อง migration ฐานข้อมูล การเพิ่มชื่อนิคมรอบนี้ครอบคลุมเฉพาะสอง endpoint ด้านบน

## รายการตรวจรับ

1. รายการผู้ประกอบการแสดงชื่อนิคมของโรงงานเข้าข่ายได้ตรงกับ API
2. รายการเจ้าหน้าที่แสดงชื่อนิคมจาก field เดียวกัน
3. แถวที่ `industrialEstateName: null` ไม่แสดงข้อความ `null` หรือ `undefined`
4. โรงงานไม่เข้าข่ายยังแสดงได้และใช้ `eligibilityRequest` / `canRequestEligibility` ตามเดิม

## การตรวจ Backend

ตรวจ typecheck, build, regression ของ service/routes และ OpenAPI จาก clean worktree ก่อนส่ง release โดยใช้ข้อมูลทดสอบสมมติ ไม่เก็บ token หรือ production credential ในเอกสารนี้

สถานะ deploy และหลักฐาน production จะบันทึกหลัง workflow และ runtime contract ผ่านการตรวจแล้ว

## แหล่งอ้างอิง

- [Service: สร้าง response ของทั้งสองรายการ](../../../../../backend/src/modules/connection-requests/connection-requests.service.ts)
- [Response types](../../../../../backend/src/modules/connection-requests/connection-requests.types.ts)
- [OpenAPI source](../../../../../backend/src/modules/api-docs/connection-requests.openapi.ts)
- [Service regression tests](../../../../../backend/tests/unit/connection-requests.service.test.ts)
- [Route regression tests](../../../../../backend/tests/unit/connection-requests.operator-factories.route.test.ts)
- [OpenAPI regression tests](../../../../../backend/tests/unit/api-docs.openapi.test.ts)
