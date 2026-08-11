# คู่มือ Frontend: เอกสารแนบรายจุดตรวจวัด

[กลับไป API contract โรงงานที่เข้าข่าย](./README.md)

เอกสารนี้เป็น handoff สำหรับต่อ UI หน้า **โรงงานที่เข้าข่าย** เข้ากับ attachment API ที่ใช้งานบน production แล้ว ส่วน field, validation และ error contract ฉบับเต็มให้ยึด [หน้า API หลัก](./README.md#อัปโหลดเอกสารแนบของจุดตรวจวัด) เป็น canonical source.

## สิ่งที่ต้องเปลี่ยนจาก state เดิม

| State เดิมในหน้า                    | State/API ใหม่                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `attachmentFiles: File[]`           | เก็บ `File` เฉพาะระหว่างรอ upload; หลัง upload สำเร็จเก็บ `uploadToken`, `fileName`, `fileType`, `fileSize`, `expiresAt` |
| `attachmentLink: string`            | เปลี่ยนเป็น `attachmentLinks: Array<{ label: string \| null; url: string }>`                                             |
| point id แบบ synthetic string       | เก็บ `points[].id` จาก API เฉพาะค่าที่เป็น positive integer; จุดใหม่ไม่ส่ง `id`                                          |
| file metadata ที่ frontend สร้างเอง | ห้ามส่ง; request ส่งเฉพาะ `{ id }` หรือ `{ uploadToken }`                                                                |

แนะนำให้แยกไฟล์ใน UI เป็นสองสถานะ:

```ts
type PersistedAttachment = {
  id: number;
  fileName: string;
  fileUrl: string;
  fileUrlExpiresAt: string;
  fileType: "image/jpeg" | "image/png" | "application/pdf";
  fileSize: number;
};

type PendingAttachment = {
  uploadToken: string;
  fileName: string;
  fileType: "image/jpeg" | "image/png" | "application/pdf";
  fileSize: number;
  expiresAt: string;
};
```

## Flow เพิ่มไฟล์

1. ตรวจชนิดไฟล์และขนาดไม่เกิน 10 MiB ที่ UI ก่อน.
2. ส่งไฟล์ทีละรายการด้วย `POST /api/v1/monitoring-point-forms/attachments` โดยใช้ `FormData` field ชื่อ `file` เท่านั้น.
3. เก็บ `data.uploadToken` จาก `201 Created`; upload response ยังไม่มี `fileUrl`.
4. ตอนบันทึกฟอร์ม ส่ง persisted file เป็น `{ id }` และไฟล์ที่เพิ่ง upload เป็น `{ uploadToken }` ใน `points[].attachments`.
5. ใช้ attachment object จาก response ของ `POST`/`PUT` แทน pending state ทั้งหมด เพราะหลัง claim แล้ว `uploadToken` ใช้ซ้ำไม่ได้.

```ts
const formData = new FormData();
formData.append("file", file);

const uploadResponse = await api.post(
  "/api/v1/monitoring-point-forms/attachments",
  formData,
);

const pendingAttachment = uploadResponse.data.data;
```

ตัวอย่าง point payload ตอนบันทึก:

```json
{
  "id": 31,
  "systemType": "CEMS",
  "pointCode": "S2001",
  "attachments": [
    { "id": 71 },
    {
      "uploadToken": "mP7bX4qL9nV2cR8tY5kH1fG6dJ3sW0uE_zA4oC9iB7Q"
    }
  ],
  "attachmentLinks": [
    {
      "label": "เอกสารอ้างอิง",
      "url": "https://example.com/reference"
    }
  ]
}
```

Upload token มีอายุ 1 ชั่วโมงและผูกกับผู้ใช้งานที่อัปโหลด หากบันทึกฟอร์มไม่สำเร็จสามารถ retry token เดิมได้ก่อนหมดอายุ; ถ้า API ตอบ `409 CONFLICT` ให้ upload ไฟล์นั้นใหม่.

## Flow หน้าแก้ไข

1. โหลด `GET /api/v1/monitoring-point-forms/:id` และเก็บ `points[].id` เดิมไว้ใน form state.
2. Prefill `attachments[]` และ `attachmentLinks[]` จาก response โดยตรง.
3. เมื่อส่ง `PUT`, array ที่ส่งถือเป็นรายการทดแทนทั้งหมด:
   - `{ id }` หมายถึงคง persisted file นั้นไว้
   - `{ uploadToken }` หมายถึงเพิ่มไฟล์ใหม่
   - ไม่ส่ง field หมายถึงคงค่าเดิมของ field นั้น
   - ส่ง `[]` หมายถึงล้างทั้งหมด
4. ห้ามส่ง browser-local/synthetic point id ใน `points[].id`.

เพื่อให้ behavior ของ UI ชัดเจน แนะนำให้ frontend ส่ง full attachment/link arrays จาก state ทุกครั้งที่ผู้ใช้แก้รายการ และส่ง `points[].id` สำหรับทุกจุดเดิม.

## เปิดไฟล์และแสดงในตาราง

`fileUrl` เป็น signed relative URL อายุ 1 ชั่วโมงและไม่ต้องแนบ Bearer token ให้ประกอบกับ API origin ก่อนเปิด:

```ts
const absoluteUrl = new URL(attachment.fileUrl, API_ORIGIN).toString();
window.open(absoluteUrl, "_blank", "noopener,noreferrer");
```

ถ้าเปิดไฟล์แล้วได้ `410 ATTACHMENT_URL_EXPIRED` ให้ reload form หรือ `GET /api/v1/eligible-factories` เพื่อรับ signed URL ชุดใหม่ ห้ามแก้ `expires` หรือ `signature` เอง.

สำหรับคอลัมน์ `เอกสารแนบ`:

- ใช้ `measurementPoints[].attachments.length + measurementPoints[].attachmentLinks.length` เป็นจำนวนรายการของแต่ละจุด.
- ถ้าผลรวมทุกจุดเป็น `0` แสดง `-`.
- ใน popover ให้ group ด้วย `measurementPoints[].id` และแสดง `pointCode`/`pointName` เป็นหัวกลุ่ม.
- ไฟล์เปิดด้วย `attachments[].fileUrl`; link เปิดด้วย `attachmentLinks[].url`.

## การจัดการ Error ที่ UI ต้องรองรับ

| Status/code                        | Frontend action                                                |
| ---------------------------------- | -------------------------------------------------------------- |
| `400 BAD_REQUEST` / `UPLOAD_ERROR` | แสดงว่าไฟล์หรือ multipart ไม่ถูกต้อง; ไม่เพิ่มรายการเข้า state |
| `401 UNAUTHORIZED`                 | ใช้ login/refresh-token flow เดิม                              |
| `403 FORBIDDEN`                    | ปิด action upload/save และแจ้งสิทธิ์ไม่เพียงพอ                 |
| `409 CONFLICT`                     | Reload detail; ถ้า token ใช้ไม่ได้ให้อัปโหลดไฟล์ใหม่           |
| `410 ATTACHMENT_URL_EXPIRED`       | Reload API เพื่อรับ `fileUrl` ใหม่                             |
| `429 RATE_LIMITED`                 | รอตาม `Retry-After` แล้ว retry โดยไม่ลบไฟล์ออกจาก upload queue |

Backend รับ upload สูงสุด 20 requests ต่อผู้ใช้ใน 15 นาที และประมวลผลพร้อมกันได้ 4 requests ต่อ backend process. Frontend ควรจำกัด upload concurrency ไว้ที่ 2–3 requests และใช้ queue เพื่อให้ retry ได้โดยไม่กระทบเงื่อนไข “ไม่จำกัดจำนวนไฟล์สะสม”.

## Checklist ก่อนส่ง QA

- เพิ่ม JPEG, PNG และ PDF ได้ และ reject ไฟล์เกิน 10 MiB ก่อนเรียก API.
- เพิ่มหลายไฟล์แล้วบันทึก ได้ persisted attachment `id` กลับมาครบ.
- เปิดหน้าแก้ไขแล้ว point `id`, attachments และ links ยังอยู่ครบ.
- ลบไฟล์หนึ่งรายการแล้ว `PUT` ส่ง `{ id }` ของไฟล์ที่เหลือครบ.
- ล้างทั้งหมดแล้วส่ง `attachments: []` / `attachmentLinks: []`.
- ตารางโรงงานที่เข้าข่ายนับไฟล์รวม link และ group ตามจุดตรวจวัดถูกต้อง.
- รับ `429` แล้ว queue รอตาม `Retry-After` โดยไม่ upload ซ้ำเองแบบไม่จำกัด.
- รับ `410` แล้ว refresh signed URL ก่อนเปิดใหม่.

## Contract และตัวอย่างฉบับเต็ม

- [Upload, download, form request/response และ error contract](./README.md#อัปโหลดเอกสารแนบของจุดตรวจวัด)
- [ข้อมูล attachment ใน `GET /api/v1/eligible-factories`](./README.md#ข้อมูลที่ซิงก์หลังเชื่อมต่อ)
- [Endpoint registry](../../ENDPOINTS.md)
