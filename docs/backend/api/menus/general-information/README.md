# ข้อมูลทั่วไป

> Owner: Backend

## เริ่มใช้งานสำหรับ Frontend

เรียกสรุปทั่วประเทศสำหรับ CEMS หรือ WPMS เมื่อเข้าหน้า เปลี่ยนแท็บ หรือกดรีเฟรช เจ้าหน้าที่ทุกระดับและแอดมินเห็นชุดข้อมูลเดียวกัน ไม่จำกัดภาค จังหวัด นิคม หรือประเภทโรงงานตามสิทธิ์เมนูอื่น ผู้ประกอบการและประชาชนเข้าไม่ได้

```bash
curl --get 'https://d-poms.diw.go.th/api/v1/general-information' \
  --data-urlencode 'systemType=CEMS' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

1. เลือก `systemType` และเรียก API พร้อม access token
2. แสดงข้อมูลทั้ง 4 หัวข้อจากคำตอบเดียว ไม่คำนวณยอดโรงงานจากผลบวกยอดย่อย
3. ส่งออก Excel/PDF จาก snapshot ที่แสดง โดยไม่มี endpoint ส่งออกแยก

หน้านี้เป็นสัญญาที่รองรับโดย source ใน repository การเผยแพร่ production ต้องผ่าน deployment และตรวจ `/api/v1/openapi.json` หลัง deploy อีกครั้ง

## สรุป Endpoint

| งาน | Method | Path | Auth | สิทธิ์ |
| --- | --- | --- | --- | --- |
| อ่านสรุปข้อมูลทั่วประเทศ | `GET` | `/api/v1/general-information` | Bearer | `userType=officer/admin` หรือ role `admin` จากบัญชีปัจจุบัน ไม่มี permission code เพิ่มเติม |

## `GET /api/v1/general-information`

### คำขอ

| Field | ตำแหน่ง | Type | Required | ความหมาย |
| --- | --- | --- | --- | --- |
| `Authorization` | header | string | Yes | `Bearer <ACCESS_TOKEN>` ตรวจลายเซ็นและโหลดสิทธิ์บัญชีล่าสุด |
| `systemType` | query | string | Yes | ค่าเดียว `CEMS` หรือ `WPMS` ตามตัวพิมพ์นี้ |

ไม่มี request body ไม่รับ query อื่น รวมถึงตัวกรองพื้นที่ pagination หรือ role จาก client

ตัวอย่างข้อมูลคำขอในรูป JSON สำหรับอธิบาย query:

```json
{ "systemType": "CEMS" }
```

### คำตอบสำเร็จ

`200` พร้อม `Cache-Control: private, no-store` ไม่มีข้อมูลส่วนบุคคลหรือรายการโรงงานรายตัว จำนวนเป็น JSON number จำนวนเต็มไม่ติดลบ อัตราการระบายเป็น JSON number ที่คำนวณได้ หรือ `null` ไม่ส่งสตริงตัวเลข

| Field | Type | Nullable | ความหมาย |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` |
| `data.systemType` | string | No | ระบบที่ร้องขอ |
| `data.generatedAt` | string / date-time | No | เวลาจัดทำข้อมูล UTC แบบ ISO 8601 มี timezone |
| `data.regions` | count[] | No | ครบ 6 ภาคตามลำดับ เหนือ กลาง ตะวันออกเฉียงเหนือ ตะวันตก ตะวันออก ใต้ |
| `data.total` | count | No | ยอดทั่วประเทศที่นับไม่ซ้ำ |
| `data.estates` | count[] | No | 2 แถว `ในนิคมฯ`, `นอกนิคมฯ` ตามลำดับ |
| `data.parameters` | parameter[] | No | รวมต่างหน่วยของพารามิเตอร์เดียวกัน เรียงตามชื่อ อาจเป็น `[]` |
| `data.flowRates` | flow[] | No | อัตราการระบายครบ 6 ภาคตามลำดับ `regions` |
| `data.flowTotal` | flow | No | อัตราการระบายทั่วประเทศ |

| โครงสร้าง | Field | Type | ความหมาย |
| --- | --- | --- | --- |
| count / parameter | `label` | string | ชื่อกลุ่มรายงาน เช่น `ภาคเหนือ`, `ทั่วประเทศ`, `CO`; สำหรับ parameter เป็นรหัสกลุ่มไม่มีหน่วยตาม handoff |
| count / parameter | `factoryCount` | integer ≥ 0 | จำนวนโรงงานไม่ซ้ำในกลุ่ม |
| count / parameter | `pointCount` | integer ≥ 0 | จำนวนจุดไม่ซ้ำในกลุ่ม |
| parameter | `displayName` | string | ชื่อรวมหน่วย เช่น `CO (%, ppm)`; ถ้าข้อมูลเก่าไม่มีหน่วยใช้ `CO (ไม่ระบุหน่วย)` |
| parameter | `units` | string[] | หน่วยที่พบจากข้อมูลล่าสุด เรียงตามตัวอักษร ไม่ซ้ำ; อาจว่าง |
| flow | `label` | string | ชื่อภาค หรือ `ทั่วประเทศ` |
| flow | `average` | number / null | เฉลี่ยค่าเฉลี่ยของจุดที่มีค่า |
| flow | `min` | number / null | ต่ำสุดจากช่องค่าต่ำสุดที่มีข้อมูล |
| flow | `max` | number / null | สูงสุดจากช่องค่าสูงสุดที่มีข้อมูล |

ตัวอย่างเมื่อยังไม่มีจุดเคยเชื่อมต่อ เป็นชุดว่างจริง ไม่มีตัวเลขจำลอง:

```json
{
  "success": true,
  "data": {
    "systemType": "CEMS",
    "generatedAt": "2026-11-06T03:00:00.000Z",
    "regions": [
      { "label": "ภาคเหนือ", "factoryCount": 0, "pointCount": 0 },
      { "label": "ภาคกลาง", "factoryCount": 0, "pointCount": 0 },
      { "label": "ภาคตะวันออกเฉียงเหนือ", "factoryCount": 0, "pointCount": 0 },
      { "label": "ภาคตะวันตก", "factoryCount": 0, "pointCount": 0 },
      { "label": "ภาคตะวันออก", "factoryCount": 0, "pointCount": 0 },
      { "label": "ภาคใต้", "factoryCount": 0, "pointCount": 0 }
    ],
    "total": { "label": "ทั่วประเทศ", "factoryCount": 0, "pointCount": 0 },
    "estates": [
      { "label": "ในนิคมฯ", "factoryCount": 0, "pointCount": 0 },
      { "label": "นอกนิคมฯ", "factoryCount": 0, "pointCount": 0 }
    ],
    "parameters": [],
    "flowRates": [
      { "label": "ภาคเหนือ", "average": null, "min": null, "max": null },
      { "label": "ภาคกลาง", "average": null, "min": null, "max": null },
      { "label": "ภาคตะวันออกเฉียงเหนือ", "average": null, "min": null, "max": null },
      { "label": "ภาคตะวันตก", "average": null, "min": null, "max": null },
      { "label": "ภาคตะวันออก", "average": null, "min": null, "max": null },
      { "label": "ภาคใต้", "average": null, "min": null, "max": null }
    ],
    "flowTotal": { "label": "ทั่วประเทศ", "average": null, "min": null, "max": null }
  }
}
```

### กติกาการนับและการคำนวณ

- ใช้เฉพาะจุดที่เคยเชื่อมต่อจาก `cems_wpms_connected_measurement_points` รวมแถว soft-deleted และจุดที่ซ่อน/ยกเลิกการเชื่อมต่อ ไม่เอารายการ eligible-only หรือคำขอที่ยังไม่สำเร็จมานับ
- ใช้ข้อมูล profile ปัจจุบันตาม `FACTORY_PROFILE_MODE` และยังอ่าน profile โรงงานที่ soft-delete แล้วได้เพื่อไม่ทำประวัติจุดหาย การอ่านนี้ไม่แก้ฐานข้อมูล
- ตัวตนโรงงานใช้เลขทะเบียนใหม่จาก eligible profile ถ้ามี มิฉะนั้นใช้เลขทะเบียนที่ connected point บันทึก แล้วจึง `factory_id` โดย trim และไม่แยกตัวพิมพ์ ห้ามใช้จำนวนแถวใน `factories` เป็นยอดโรงงาน POMS
- ตัวตนจุดอยู่ภายในโรงงานและระบบเดียวกัน ใช้ `point_code` เมื่อมี หรือ `source_measurement_point_id` เมื่อไม่มีรหัส เลือกข้อมูลล่าสุดตาม `updated_at` และใช้ `id` สูงสุดเมื่อตรงกัน รหัสเหมือนกันในคนละโรงงานไม่ถูกรวมกัน
- โรงงานที่มีทั้ง CEMS และ WPMS นับในแต่ละระบบได้ พารามิเตอร์หนึ่งมีหลายหน่วยหรือหลายจุดยังนับโรงงานหนึ่งครั้งต่อพารามิเตอร์ จุดหนึ่งมี CO ต่างหน่วยก็นับจุด CO ครั้งเดียว แต่ CO กับ CO2 แยกกัน
- ภาคอ้างอิงจังหวัดตาม [พื้นที่รับผิดชอบ](../../shared/regional-jurisdictions/README.md) ชัยนาทและอุทัยธานีเป็นภาคกลาง เหนือมี 16 จังหวัด ภาคว่างยังคืนจำนวน 0
- นิคมใช้ชื่อที่มีความหมายจริง `null`/ว่าง/ขีด `-`, `–`, `—` และคำชัดเจน `ไม่มี`, `นอกนิคมฯ`, `นอกนิคมอุตสาหกรรม` เป็นนอกนิคม ส่วนข้อความคลุมเครือ `ไม่ทราบ`, `ไม่ระบุ`, `unknown`, `n/a`, `null`, `undefined` ตอบ `503` ไม่สร้างกลุ่มเพิ่ม
- อัตราการระบายใช้ `details_json` ของจุดล่าสุด: CEMS `averageFlowRate`, `minFlowRate`, `maxFlowRate`; WPMS `averageWastewaterDischarge`, `minWastewaterDischarge`, `maxWastewaterDischarge` ไม่ใช้ค่าทดสอบอุปกรณ์หรือค่าตรวจวัดออนไลน์
- หน่วยผลลัพธ์ CEMS `m³/hr`, WPMS `m³/d` ข้อมูลเดิมที่ไม่มี metadata หน่วยใช้หน่วยตามฟอร์มนี้ ถ้ามี `flowRateUnit` สำหรับ CEMS หรือ `wastewaterDischargeUnit` สำหรับ WPMS จะปรับก่อนรวม รองรับ `m3/hr`, `m3/h`, `m3/d`, `m3/day`, `m3/s`, `l/s`, `l/min` รวม `³` ตัวพิมพ์ใหญ่และช่องว่าง
- แต่ละช่องขาดได้แยกกัน: `null`/ไม่ส่ง/ข้อความว่างไม่นำเข้าสูตรช่องนั้น; `0` เป็นค่าจริง; ตัวเลขเดิมที่บันทึกเป็น decimal string อ่านได้ แต่ค่าลบ boolean ตัวเลขที่ไม่สิ้นสุด หรือหน่วยไม่รู้จักตอบ `503`
- ยอดทั่วประเทศและอัตราการระบายทั่วประเทศคำนวณจากทุกจุด ไม่บวกยอดโรงงานรายพารามิเตอร์หรือเฉลี่ยค่าเฉลี่ยรายภาค ทั้ง 4 หัวข้อใช้ผลอ่านฐานข้อมูลครั้งเดียว

### ข้อผิดพลาด

ใช้ [shared error envelope](../../shared/common-api/README.md#shared-response-shape) ยกเว้น global rate limiter ซึ่งตอบ plain text ตามระบบเดิม

| HTTP | Code | เงื่อนไข / วิธีจัดการ |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | query ขาด/ผิด/ซ้ำ/มี field อื่น ให้แก้คำขอ |
| `401` | `UNAUTHORIZED` | token ไม่ถูกต้อง หมดอายุ หรือบัญชีใช้ไม่ได้ ให้ login ใหม่ |
| `403` | `FORBIDDEN` | บัญชีปัจจุบันไม่ใช่เจ้าหน้าที่หรือแอดมิน |
| `429` | plain text | เกิน global limit 300 requests/15 นาที/IP รอตาม `Retry-After` |
| `500` | `INTERNAL_ERROR` | ฐานข้อมูลหรือระบบขัดข้อง ไม่ส่ง SQL/stack trace |
| `503` | `GENERAL_INFORMATION_DATA_INCOMPLETE` | ข้อมูลต้นทางไม่มีตัวตนโรงงาน จัดภาค/นิคมไม่ได้ หรือ JSON/ตัวเลข/หน่วยผิดรูปแบบ ให้ตรวจข้อมูลก่อนลองใหม่ ไม่ส่งยอดบางส่วนและไม่เพิ่มหมวดโดยพลการ |

เมื่อไม่มีข้อมูลจริง API ตอบ `200` พร้อม `0`/`null` ส่วน `404`/`501` ไม่ใช่ผลสำเร็จของ endpoint ที่รองรับแล้ว

## แหล่งอ้างอิงสำหรับผู้ดูแล Backend

| Concern | Source |
| --- | --- |
| Routes / authorization | [general-information.routes.ts](../../../../../backend/src/modules/general-information/general-information.routes.ts) |
| Validator / system type | [general-information.validator.ts](../../../../../backend/src/modules/general-information/general-information.validator.ts) |
| Aggregation | [general-information.service.ts](../../../../../backend/src/modules/general-information/general-information.service.ts) |
| Database row types / query | [general-information.repository.ts](../../../../../backend/src/modules/general-information/general-information.repository.ts) |
| Runtime OpenAPI | [general-information.openapi.ts](../../../../../backend/src/modules/api-docs/general-information.openapi.ts) |
| HTTP tests | [general-information.api.test.ts](../../../../../backend/tests/unit/general-information.api.test.ts) |
| TDD / verification evidence | [หลักฐาน HTTP API](../../../evidence/general-information/http-api.tdd.md) |

ที่มาความต้องการ: [Frontend handoff](../../../../../frontend/md/frontend-handoff-06112026.md) เป็นเอกสารส่งงาน ส่วนสัญญา backend อ้างอิงหน้านี้
