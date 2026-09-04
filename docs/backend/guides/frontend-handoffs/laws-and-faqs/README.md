# Frontend Handoff: กฎหมายและคำถามที่พบบ่อย

ใช้เอกสารนี้เมื่อเปลี่ยนหน้า `กฎหมายที่เกี่ยวข้อง` และ `คำถามที่พบบ่อย` จาก mock state ไปใช้ backend API จริง งานเสร็จเมื่อทั้งสองหน้าอ่านและแก้ข้อมูลผ่าน API, ไม่มีการสร้าง ID ฝั่ง browser และผ่าน checklist ท้ายเอกสาร

API ชุดนี้อยู่บน production แล้วที่ commit [`eec7819`](https://github.com/Nongten1010/POMS-app/commit/eec7819d54aca6a90f9bff897a76f960d7ad9396)

## อ่าน Contract ก่อนแก้

- [กฎหมายที่เกี่ยวข้อง](../../../api/menus/laws/README.md)
- [คำถามที่พบบ่อย](../../../api/menus/faqs/README.md)
- [Production OpenAPI](https://d-poms.diw.go.th/api/v1/openapi.json)
- [Production Swagger UI](https://d-poms.diw.go.th/api/v1/docs/)

Canonical API pages และ OpenAPI เป็น source of truth สำหรับ method, path, fields, enums, validation, permission และ response หากข้อมูลในเอกสาร handoff นี้ไม่ตรง ให้หยุดและตรวจ canonical contract ก่อนแก้โค้ด

## ไฟล์ Frontend ที่เกี่ยวข้อง

- [`App.jsx`](../../../../../frontend/src/App.jsx) — ส่ง `accessToken` และสถานะ permission ให้หน้าเมนู
- [`LawsPage.jsx`](../../../../../frontend/src/pages/LawsPage.jsx) — เอา `initialLawItems`, local ID และไฟล์ดาวน์โหลดจำลองออก
- [`FaqPage.jsx`](../../../../../frontend/src/pages/FaqPage.jsx) — เอา `initialFaqItems` และ local ID ออก
- [`vite.config.js`](../../../../../frontend/vite.config.js) — มี `/api-proxy` สำหรับเรียก production API ระหว่างพัฒนาอยู่แล้ว

ขอบเขตนี้ไม่ต้องแก้ backend, route, enum หรือหน้าตา UI เดิม

## Endpoint Map

| งาน               | Method และ path           | Auth                 | Body                  |
| ----------------- | ------------------------- | -------------------- | --------------------- |
| โหลดกฎหมายทั้งหมด | `GET /api/v1/laws`        | Public               | ไม่มี                 |
| เพิ่มกฎหมาย       | `POST /api/v1/laws`       | Bearer + `laws:edit` | `multipart/form-data` |
| แก้กฎหมาย         | `PUT /api/v1/laws/:id`    | Bearer + `laws:edit` | `multipart/form-data` |
| ลบกฎหมาย          | `DELETE /api/v1/laws/:id` | Bearer + `laws:edit` | ไม่มี                 |
| ดาวน์โหลด PDF     | ใช้ `file.downloadUrl`    | Public               | ไม่มี                 |
| โหลด FAQ ทั้งหมด  | `GET /api/v1/faqs`        | Public               | ไม่มี                 |
| เพิ่ม FAQ         | `POST /api/v1/faqs`       | Bearer + `faq:edit`  | JSON                  |
| แก้ FAQ           | `PUT /api/v1/faqs/:id`    | Bearer + `faq:edit`  | JSON                  |
| ลบ FAQ            | `DELETE /api/v1/faqs/:id` | Bearer + `faq:edit`  | ไม่มี                 |

List APIs คืนข้อมูลทั้งหมดใน `data[]` ครั้งเดียว ให้ค้นหา กรอง และเรียงรายการใน frontend ต่อไป ห้ามส่ง `page`, `perPage`, filter หรือ sort query

## 1. เตรียม API URL และ Auth

ใช้ convention เดียวกับหน้าอื่นในโปรเจกต์:

```js
const apiBaseUrl = import.meta.env.DEV
  ? "/api-proxy/v1"
  : "https://d-poms.diw.go.th/api/v1";

const lawsApiUrl = `${apiBaseUrl}/laws`;
const faqsApiUrl = `${apiBaseUrl}/faqs`;
```

แก้ `App.jsx` ให้ส่ง token เข้า page โดยคง permission check เดิม:

```jsx
<LawsPage
  accessToken={accessToken}
  isAdmin={roleCode === 'admin' || activePermissions?.laws?.edit === true}
/>

<FaqPage
  accessToken={accessToken}
  isAdmin={roleCode === 'admin' || activePermissions?.faq?.edit === true}
/>
```

Public GET ไม่ต้องส่ง token ส่วน POST, PUT และ DELETE ต้องส่ง:

```js
headers: {
  Authorization: `Bearer ${accessToken}`,
}
```

การซ่อนปุ่มด้วย `isAdmin` เป็นเพียง UI guard; backend เป็นผู้ตัดสินสิทธิ์สุดท้ายด้วย `401` และ `403`

## 2. ใช้ Response และ Error กลาง

ทุก JSON endpoint ใช้ envelope `{ success, data }` หรือ `{ success: false, error }` ให้ใช้ข้อมูลที่ backend ตอบกลับแทนการสร้าง ID หรือประกอบ record เอง

```js
async function readApiResponse(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success !== true) {
    const error = new Error(payload?.error?.message || "ไม่สามารถดำเนินการได้");
    error.status = response.status;
    error.details = payload?.error?.details ?? {};
    throw error;
  }

  return payload.data;
}

function firstErrorMessage(value) {
  return Array.isArray(value) ? value[0] : value;
}
```

- แสดง `error.message` เป็นข้อความรวม
- map `error.details` กลับเข้า helper text ของ field โดยรองรับทั้ง string และ string array
- เมื่อได้ `401` ให้ใช้ flow session/login ของระบบ
- เมื่อได้ `403` ให้แจ้งว่าไม่มีสิทธิ์และไม่เปลี่ยน state ฝั่งหน้า
- เมื่อ update/delete ได้ `404` ให้โหลด list ใหม่

## 3. เชื่อมหน้า Laws

1. เปลี่ยน initial state เป็น `[]` แล้วโหลด `GET /laws` เมื่อเปิดหน้า
2. เพิ่ม loading, load error และ retry state โดยยกเลิก request เมื่อ component unmount
3. ใช้ shape จาก API โดยตรง โดยเฉพาะ `law.file.fileName` และ `law.file.downloadUrl`; เลิกใช้ `law.fileName`
4. เก็บ `File` object จริงใน form แยกจากชื่อไฟล์ ห้ามเก็บเฉพาะ `event.target.files[0].name`
5. จำกัด file picker ด้วย `accept="application/pdf,.pdf"`; create ต้องเลือกไฟล์ ส่วน update ไม่เลือกไฟล์ใหม่ได้
6. หลัง create/update สำเร็จ ให้นำ record ใน response ไปเพิ่มหรือแทนที่ใน state
7. หลัง delete สำเร็จและ `data.deleted === true` จึงเอารายการออกจาก state
8. เปลี่ยนปุ่มดาวน์โหลดให้เปิด `file.downloadUrl` และลบ logic ที่สร้าง text `Blob`

ตัวอย่าง body สำหรับ create/update:

```js
function buildLawFormData(form, file) {
  const body = new FormData();
  body.append("title", form.title.trim());
  body.append("category", form.category);
  body.append("type", form.type);
  body.append("publishedDate", form.publishedDate);
  if (file) body.append("file", file);
  return body;
}
```

ห้ามกำหนด `Content-Type` เองเมื่อส่ง `FormData`; browser ต้องสร้าง multipart boundary ให้

`file.downloadUrl` จาก backend เป็น path รูป `/api/v1/laws/:id/file` บน production ระหว่างใช้ Vite dev proxy ให้แปลงเฉพาะ URL นี้:

```js
function resolveDownloadUrl(downloadUrl) {
  if (import.meta.env.DEV && downloadUrl.startsWith("/api/v1/")) {
    return downloadUrl.replace("/api/v1/", "/api-proxy/v1/");
  }
  return downloadUrl;
}
```

## 4. เชื่อมหน้า FAQ

1. เปลี่ยน initial state เป็น `[]` แล้วโหลด `GET /faqs` เมื่อเปิดหน้า
2. เพิ่ม loading, load error และ retry state
3. POST และ PUT ส่ง JSON เฉพาะ `question`, `answer`, `category`, `updatedDate`
4. ส่ง header `Content-Type: application/json` และ Bearer token สำหรับ write requests
5. ใช้ record ที่ backend ตอบหลัง create/update แทนการสร้าง `faq-${Date.now()}`
6. หลัง delete สำเร็จและ `data.deleted === true` จึงเอารายการออกจาก state
7. คง search และ category filter ไว้ฝั่ง frontend โดยค่า `all` ใช้ใน UI เท่านั้น

## 5. State และ Interaction

- ปิดปุ่มบันทึก/ลบระหว่าง request เพื่อกัน double submit
- ปิด dialog หลัง API สำเร็จเท่านั้น
- เมื่อ API ล้มเหลว ให้เก็บค่าที่ผู้ใช้กรอกและแสดง error ใน dialog เดิม
- empty `data[]` ต้องแสดง empty state ปัจจุบัน ไม่ fallback กลับไปใช้ mock
- sort กฎหมายตาม `title` และ filter/search ทั้งสองหน้าใน browser ตามเดิม
- วันที่ที่ส่ง API ต้องเป็น ค.ศ. รูป `YYYY-MM-DD`; การแสดงปี พ.ศ. ทำเฉพาะ UI

## Acceptance Checklist

- [ ] `initialLawItems`, `initialFaqItems`, `createLawId` และ `createFaqId` ถูกนำออก
- [ ] `App.jsx` ส่ง `accessToken` ให้ทั้งสองหน้า
- [ ] Public list โหลดได้แม้ยังไม่ login
- [ ] List requests ไม่มี pagination/filter/sort query
- [ ] Create law ส่ง PDF จริงและแสดง field error เมื่อไม่มีไฟล์
- [ ] Update law โดยไม่เลือกไฟล์ใหม่ยังใช้ไฟล์เดิม
- [ ] PDF จาก `file.downloadUrl` ดาวน์โหลดได้ทั้ง dev proxy และ production
- [ ] FAQ create/update ส่ง JSON fields ครบและใช้ record ที่ server คืนมา
- [ ] Write requests ทุกตัวส่ง Bearer token
- [ ] `400`, `401`, `403` และ `404` ไม่ทำให้ local state แสดงผลสำเร็จหลอก
- [ ] Loading, empty, error และ retry states ใช้งานได้
- [ ] `cd frontend && npm test` ผ่าน
- [ ] `cd frontend && npm run lint` ผ่าน
- [ ] `cd frontend && npm run build` ผ่าน

งาน frontend ถือว่าเสร็จเมื่อ checklist ครบและ Network panel แสดงว่าทั้ง 9 operations ใช้ path, auth และ payload ตรง canonical contract โดยไม่มี mock fallback เหลืออยู่
