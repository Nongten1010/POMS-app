# Operator Cancel Connection Request Workflow

Status: Implemented and verified

## Goal

ให้ผู้ประกอบการยกเลิกคำขอของโรงงานตนเองจากหน้าขอเชื่อมต่อได้อย่างปลอดภัย โดย backend เปลี่ยนคำขอเป็น terminal status `CANCELED`, เก็บผู้ดำเนินการและเหตุผลใน status history และตอบ contract ที่ frontend นำไป refresh รายการ/รายละเอียดได้โดยไม่ต้องคาดเดาสถานะ.

## Trigger

ผู้ประกอบการกดปุ่ม “ยกเลิก” ในหน้าขอเชื่อมต่อ ยืนยันการตัดสินใจใน UI แล้ว frontend เรียก API พร้อม bearer token ของผู้ประกอบการ.

## Actor And Scope

- ผู้ดำเนินการต้อง authenticate แล้ว.
- ใช้ flow ผู้ประกอบการเท่านั้น; endpoint ต้องตรวจ ownership/location scope ตามกติกา `OWN_FACTORY` เดิมก่อนเปลี่ยนข้อมูล.
- ห้ามยกเลิกคำขอของโรงงานอื่น แม้ทราบ request ID.
- งานนี้เป็น backend contract, validation, tests และ canonical Markdown เท่านั้น; ไม่แก้ `frontend/`.

## Existing System Facts

- `CANCELED` มีอยู่แล้วและเป็น terminal status ร่วมกับ `CONNECTED`.
- ระบบเดิม auto-cancel คำขอที่ค้าง `WAITING_CONNECTION` เกิน `connectionDueAt`.
- ระบบเดิมยังไม่มี public endpoint เฉพาะสำหรับให้ผู้ประกอบการยกเลิกคำขอเอง.
- status history รองรับ note, actor และเวลาที่เปลี่ยนสถานะอยู่แล้ว.

## Proposed API Shape

- Method: `POST` เพราะเป็น domain action ที่สร้าง audit/status-history event และไม่ใช่การลบ resource.
- Resource: `/api/v1/cems-wpms-requests/:id/cancel`.
- Authentication: bearer access token.
- Authorization: permission ที่ผู้ประกอบการหน้าขอเชื่อมต่อใช้อยู่ บวก resource ownership check.
- Request body: `{ "reason": "..." }`; `reason` เป็น optional และไม่ส่ง body ก็ได้.
- Success: `200 OK` พร้อม project-standard envelope `{ "success": true, "data": ... }` และ full request DTO ล่าสุดที่มี `status = "CANCELED"`; รูปแบบนี้ตรงกับ endpoint เปลี่ยนสถานะเดิม.
- ไม่ลบ request, measurement point snapshot, document หรือ status history.

## Atomic Runtime Flow

1. Validate path `id` และ request body.
2. Load request ภายใต้ scope ของ actor.
3. Reject หากไม่พบ, ไม่มีสิทธิ์, หรือสถานะปัจจุบันไม่อนุญาต.
4. ใน transaction เดียว เปลี่ยน status เป็น `CANCELED`, เก็บ audit actor และเพิ่ม status-history row พร้อมเหตุผล.
5. Return request DTO ล่าสุด.

## Allowed Statuses

ผู้ประกอบการยกเลิกคำขอ `OPERATOR_FORM` ของโรงงานตนเองได้จากทุกสถานะที่ workflow ยังไม่สิ้นสุด:

| Current status | Cancel allowed | เหตุผล |
| --- | --- | --- |
| `PENDING_DESIGN_REVIEW` | yes | คำขอยังรอเจ้าหน้าที่ตรวจแบบและยังไม่เกิดการเชื่อมต่อจริง |
| `WAITING_FACTORY_REVISION` | yes | คำขอถูกส่งกลับให้โรงงานแก้ไข ผู้ประกอบการจึงเลือกยุติแทนการส่งใหม่ได้ |
| `REVISED_PENDING_DESIGN_REVIEW` | yes | แบบแก้ไขยังอยู่ระหว่างรอตรวจและ workflow ยังย้อนกลับได้ |
| `WAITING_CONNECTION` | yes | แบบผ่านแล้วแต่โรงงานยังตั้งค่า/เชื่อมต่อไม่สำเร็จ จึงยังยุติคำขอได้ |
| `CONNECTION_CONFIRMED` | yes | ผู้ประกอบการยืนยันแล้วแต่เจ้าหน้าที่ยังไม่ verify เป็นการเชื่อมต่อสำเร็จ |
| `CONNECTED` | no | เป็น terminal status และเกิดข้อมูลเชื่อมต่อที่ใช้งานจริงแล้ว การเลิกใช้งานต้องเป็น workflow แยก ไม่ใช่ยกเลิกคำขอเดิม |
| `CANCELED` | retry only | endpoint ตอบข้อมูลเดิมแบบ idempotent แต่ไม่แก้ข้อมูลและไม่สร้าง status-history event ซ้ำ |

กติกานี้ใช้เฉพาะคำขอที่ `submissionSource = OPERATOR_FORM`; flow `OFFICER_DIRECT_API` เริ่มและจบที่ `CONNECTED` จึงไม่เข้าเงื่อนไขยกเลิกนี้.

## Error Contract

- `400 Bad Request`: path/body ผิดรูปแบบตาม convention เดิมของโปรเจกต์.
- `401 Unauthorized`: ไม่มี bearer token ที่ถูกต้อง.
- `403 Forbidden`: actor ไม่ใช่เจ้าของ/อยู่นอก scope ตาม established behavior.
- `404 Not Found`: ไม่พบคำขอใน scoped lookup.
- `409 Conflict`: คำขอเป็น `CONNECTED` หรือเปลี่ยนไปอยู่สถานะอื่นที่ยกเลิกไม่ได้ก่อน transaction สำเร็จ; `CANCELED` ไม่เป็น conflict เพราะรองรับ retry แบบ idempotent.
- `500 Internal Server Error`: unexpected failure โดยไม่เปิดเผยรายละเอียดภายใน.

## Retry And Concurrency

- คำขอแรกที่ยกเลิกจาก non-terminal status ต้องเปลี่ยนสถานะและเพิ่ม history exactly once.
- หาก endpoint อ่านพบ `CANCELED` อยู่แล้ว ให้ตอบ `200 OK` ด้วย full request DTO ปัจจุบัน โดยไม่แก้ `reason`, actor, timestamp หรือเพิ่ม history row.
- กติกานี้รองรับ double-click, client retry และ response แรกสูญหายโดยไม่สร้าง audit ซ้ำ.
- การตรวจ current status และการเขียน status/history ต้องอยู่ใน transaction เดียวและ lock แถวคำขอ เพื่อไม่ให้ cancel แข่งกับ officer verify แล้วทั้งสอง action สำเร็จพร้อมกัน.
- หาก action อื่นชนะและเปลี่ยนเป็น `CONNECTED` ก่อน ให้ cancel ตอบ `409 Conflict`.

## TDD Guarantees To Implement After Spec Approval

- Route บังคับ authentication และ permission ที่ถูกต้อง.
- Operator ยกเลิกได้เฉพาะ request ใน scope ของตน.
- สถานะที่อนุญาตเปลี่ยนเป็น `CANCELED` และบันทึก history/actor/reason แบบ atomic.
- สถานะที่ไม่อนุญาตตอบ conflict และไม่เขียนข้อมูล.
- reason ที่มีค่าต้องผ่าน validation และ reason ที่ไม่ส่ง/ว่างต้องยกเลิกได้.
- repository failure ไม่ทิ้ง partial status/history update.
- focused unit/integration tests ผ่านและ changed-code coverage อย่างน้อย 80%.

## Open Decisions

ไม่มีประเด็นค้างที่ต้องถามก่อน implement.

## Resolved Decisions

- ผู้ประกอบการยกเลิกได้จากทุก non-terminal status ของคำขอ `OPERATOR_FORM` ที่อยู่ใน scope ของตน.
- `CONNECTED` และ `CANCELED` ยกเลิกไม่ได้ เพราะเป็น terminal status; การเลิกใช้จุดที่เชื่อมต่อแล้วต้องเป็นคนละ business workflow.
- `reason` ไม่บังคับ. ถ้าไม่ส่ง, ส่ง `null`, หรือส่งข้อความที่เหลือว่างหลัง trim ให้บันทึก note เป็น `null`; ถ้ามีข้อความให้ trim และจำกัดไม่เกิน 1000 ตัวอักษรตามขนาด note ที่ workflow เดิมใช้.
- การเรียกซ้ำเมื่อเป็น `CANCELED` ตอบ `200 OK` แบบ idempotent พร้อมข้อมูลปัจจุบัน และไม่เขียน status history ซ้ำ.
- Success response คืน full request DTO ใน envelope เดียวกับ status-action endpoint เดิม เพื่อให้ client refresh หน้าจอจากข้อมูล authoritative ชุดเดียว.
- เวอร์ชันแรกไม่มี email, push notification หรือ notification side effect; ผลที่เกิดมีเฉพาะ status update, audit fields และ status history. การแจ้งเตือนเป็น workflow แยกหากต้องการภายหลัง.

## Side Effects

- เก็บ request, factory snapshot, measurement-point snapshot, documents, point code และ device config เดิมไว้เพื่อ audit; endpoint นี้ไม่ hard-delete ข้อมูล.
- ไม่ materialize หรือแก้ `cems_wpms_connected_measurement_points` เพราะ cancel ใช้ได้ก่อน `CONNECTED` เท่านั้น.
- ไม่ส่ง email หรือ notification.
- observable mutation มีเพียง `status = CANCELED`, request audit fields และ status-history row ของการยกเลิกครั้งแรก.

## Definition Of Done

- Endpoint, validation, authorization และ ownership behavior ตรงตามสเปกนี้.
- RED/GREEN evidence ยืนยัน happy path, optional reason, forbidden ownership, invalid status, idempotent retry และ concurrency-safe persistence.
- Canonical backend API document อธิบาย contract และลิงก์กลับมาที่ workflow นี้.
- Focused tests, typecheck และ coverage ของ changed code ผ่านเกณฑ์ TDD โดยไม่มีการแก้ `frontend/`.

Implementation evidence: [`docs/testing/operator-cancel-connection-request.tdd.md`](../docs/testing/operator-cancel-connection-request.tdd.md).

## Cancel Request Body

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `reason` | string \| null | no | trim ก่อนบันทึก; ค่าว่างเป็น `null`; ถ้ามีข้อความต้องยาวไม่เกิน 1000 ตัวอักษร |

Minimal request without a reason:

```json
{}
```

Request with a reason:

```json
{
  "reason": "ยุติโครงการติดตั้งระบบตรวจวัด"
}
```
