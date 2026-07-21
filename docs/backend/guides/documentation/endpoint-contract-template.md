# <ชื่องานหรือกลุ่ม endpoint ภาษาไทย>

[กลับไปหน้าเมนู](./README.md)

## `<METHOD> <PATH>`

อธิบายว่างานนี้ให้ผลลัพธ์อะไรแก่ client โดยไม่ใส่ implementation detail

### Authentication And Permission

- Authentication: `<required หรือ public>`
- Permission: `<permission code หรือ ->`
- Data scope: `<scope หรือ ->`

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `<field>` | `<path/query/header/body>` | `<type>` | `<Yes/No/Conditional>` | `<คำอธิบาย>` |

### Request Example

```json
{
  "<field>": "<minimal valid value>"
}
```

### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `<field>` | `<type>` | `<Yes/No>` | `<คำอธิบายและหน่วยเมื่อเกี่ยวข้อง>` |

### Success Response Example

```json
{
  "success": true,
  "data": {}
}
```

### Validation And Business Rules

- `<validation หรือ business rule ที่ client ต้องรู้>`

### Errors

ใช้ [shared error envelope](../../shared/README.md) และระบุเฉพาะ error ของ endpoint นี้:

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `<status>` | `<code>` | `<เกิดเมื่อใด>` | `<frontend ควรทำอะไร>` |

## Backend Maintainer Links

- Route: `<relative source link>`
- Validator: `<relative source link>`
- Types: `<relative source link>`
- Tests: `<relative test link>`
- Evidence: `<relative evidence link>`
