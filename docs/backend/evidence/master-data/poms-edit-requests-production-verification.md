# ผลตรวจ API คำขอแก้ไขโรงงาน POMS บน production

ผลตรวจนี้เกิดก่อนงานปรับ list summary ใน [ผลทดสอบงานแก้รายการคำขอ](./poms-edit-request-list-summary.md) จึงไม่ใช่หลักฐานการ deploy ของงานใหม่นั้น

หลักฐาน ณ วันที่ 18 กันยายน 2026 เวลา 22:47 น. (`Asia/Bangkok`) เทียบกับ local HEAD `3f32148` และการแก้ไขฟอร์มใน commit `ac0dc5e` เอกสารนี้เป็นผลตรวจ ณ เวลาหนึ่ง ไม่ใช่ API contract ฉบับใหม่

Contract หลัก: [คำขอแก้ไขข้อมูลโรงงาน POMS](../../api/menus/master-data/factory-edit-requests.md)

## ผลตรวจ

| Endpoint (ทุกเส้นใช้ `GET` และ prefix `/api/v1`) | การเปลี่ยนในรอบ `ac0dc5e` | หลักฐาน production |
| --- | --- | --- |
| `/poms-factories/edit-requests` | ไม่เปลี่ยน handler รายการคำขอในรอบนี้ | OpenAPI ยังระบุ `listPomsFactoryEditRequests`, query `status`, `factoryId`, `search` และ response `PomsFactoryEditRequestsResponse`; เรียกโดยไม่มี token ได้ `401 UNAUTHORIZED` |
| `/poms-factories/:factoryId/form` | เพิ่ม `measurementPoints[].connectedPointId` | OpenAPI response อ้าง `PomsFactoryFormResponse` และ schema รายจุดกำหนด `connectedPointId` เป็น required integer ขั้นต่ำ `1` |
| `/poms-factories/edit-requests/:id/form` | เพิ่ม `measurementPoints[].connectedPointId` | OpenAPI response อ้าง `PomsFactoryEditRequestFormResponse` และ schema รายจุดกำหนด `connectedPointId` เป็น required integer ขั้นต่ำ `1` |

สรุป: **contract ของฟอร์มที่แก้ล่าสุดเผยแพร่ผ่าน OpenAPI บน production แล้ว** ส่วน URL รายการคำขอที่ผู้ใช้ระบุไม่ได้เป็น endpoint ที่เพิ่ม field ในรอบนี้ ฝั่ง client อ่าน ID จากฟอร์มเพื่อเลือกจุดและส่ง create/resubmission ตาม contract หลัก

## หลักฐานและวิธีตรวจ

- อ่าน [Production OpenAPI](https://d-poms.diw.go.th/api/v1/openapi.json) สำเร็จและ parse เป็น JSON
- ตรวจ reference จาก response ของฟอร์มทั้งสองเส้นไปถึง schema รายจุด พร้อมตรวจ `required`, `type: integer`, `minimum: 1` และตัวอย่าง `connectedPointId: 15`: ผ่านทั้งสองเส้น
- OpenAPI ระบุ Bearer authentication และ permission `factories:view` สำหรับทั้งสามเส้น
- SHA-256 ของ OpenAPI ที่อ่านในรอบนี้: `749e6150605dc304224d225f652c945d3d04af45ce806792f5cad65c7b3e269a`
- ตรวจ diff จาก `ac0dc5e^` ถึง `3f32148`: controller, routes และ repository ของ `poms-factories` ไม่เปลี่ยน; service เปลี่ยนตัวแปลงฟอร์มให้คืน `connectedPointId` และปรับ types ที่เกี่ยวข้อง โดยไม่แก้ `listEditRequests`
- Implementation: [routes](../../../../backend/src/modules/poms-factories/poms-factories.routes.ts), [service](../../../../backend/src/modules/poms-factories/poms-factories.service.ts), [OpenAPI source](../../../../backend/src/modules/api-docs/poms.openapi.ts)

คำสั่งตรวจแบบอ่านอย่างเดียว ไม่ต้องใช้ credentials:

```bash
curl --fail --silent --show-error --max-time 30 \
  https://d-poms.diw.go.th/api/v1/openapi.json \
  -o /tmp/poms-edit-request-openapi.json

curl --silent --show-error --max-time 30 \
  -w '\nHTTP_STATUS=%{http_code}\n' \
  https://d-poms.diw.go.th/api/v1/poms-factories/edit-requests
```

ผลจาก endpoint รายการเมื่อไม่มี Authorization header:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid Authorization header"
  }
}
```

HTTP status: `401`

## ขอบเขตการยืนยัน

- ยืนยันได้ว่า production ให้บริการ OpenAPI ที่มี field ใหม่แล้ว ไม่ได้ยืนยัน deployment commit ของ server จากเอกสาร OpenAPI เพียงอย่างเดียว
- ยังไม่ได้เรียก response `200` ด้วยบัญชีที่มีสิทธิ์ จึงยังไม่ยืนยันข้อมูลรายการจริง หรือ `connectedPointId` ของฟอร์มโรงงาน/คำขอจริงจาก production
- ไม่มีการสร้าง แก้ไข ยกเลิก หรืออนุมัติคำขอ และไม่มีการแก้ application code ในงานตรวจสอบนี้
- ไม่รัน application test suite ซ้ำในงานเอกสารนี้; ผลตรวจข้างต้นมาจาก Git diff, schema ที่ production ให้บริการ และ unauthenticated GET จริง
