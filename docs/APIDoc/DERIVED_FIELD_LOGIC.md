# Derived Field Logic

เอกสารนี้ใช้บันทึก field ที่ API ไม่ได้ส่ง raw DB ตรง ๆ แต่มีการตีความ แปลงค่า fallback หรือรวมค่าจากหลาย field ก่อนส่งออก

กติกา:

- ถ้าเพิ่มหรือแก้ logic ที่ไม่ได้เป็น raw DB ตรง ๆ ต้องอัปเดตไฟล์นี้ใน change เดียวกัน
- ระบุ source table/field, logic ที่ใช้, เหตุผล, และข้อควรระวัง
- ถ้า logic เป็นเพียง fallback ชั่วคราว ให้เขียนไว้ชัดเจนว่า fallback จากอะไรไปอะไร
- ถ้าไม่แน่ใจว่า field ควรตีความอย่างไร ให้หยุดที่ raw value และถามก่อน

## Operator Factory Dashboard

Endpoint: `GET /api/v1/operator-factory-dashboard`

Code:

- `backend/src/modules/connection-requests/connection-requests.repository.ts`
- `backend/src/modules/connection-requests/connection-requests.service.ts`

### `factoryLogoUrl`

Source:

- `cems_wpms_connected_measurement_points.documents_json`
- nested field `documentsAndImages[].fileUrl`

Logic:

- ใช้เฉพาะ connected measurement point ที่ `system_type = CEMS`
- หาเอกสารที่ `title = สัญลักษณ์ของโรงงานหรือโลโก้บริษัท` ก่อน
- ถ้าไม่พบ title ดังกล่าว ให้ fallback ไปที่ `documentsAndImages[3]` ตามลำดับฟอร์ม CEMS ปัจจุบัน
- คืน `fileUrl` ของเอกสารแรกที่พบ
- ถ้าเป็น WPMS หรือไม่มี `fileUrl` ให้คืน `null`

Reason:

- รูป logo อยู่ใน section เอกสารและรูปภาพของฟอร์มคำขอ CEMS ไม่ได้อยู่ในตาราง `factories`
- dashboard ต้องใช้ URL เดียวสำหรับแสดงโลโก้โรงงาน โดยไม่ส่ง `documentsAndImages` ทั้งก้อน

Risk:

- fallback index `3` อิงกับลำดับเอกสารของ frontend ปัจจุบัน หากลำดับฟอร์ม CEMS เปลี่ยน ควรอัปเดต logic หรือใช้ title เป็นหลักต่อไป

## Measurement Statistics

Endpoint: `GET /api/v1/connected-measurement-points/:stationId/measurement-statistics`

Code:

- `backend/src/modules/connection-requests/connection-requests.service.ts`
- `backend/src/modules/connection-requests/connection-requests.repository.ts`

### `data.measurementPoints[].latitude` / `data.measurementPoints[].longitude`

Source:

- `dbo.cems_wpms_measurement_points.latitude`
- `dbo.cems_wpms_measurement_points.longitude`
- fallback `dbo.cems_wpms_measurement_points.details_json.stackLatitude`
- fallback `dbo.cems_wpms_measurement_points.details_json.stackLongitude`
- fallback `dbo.cems_wpms_measurement_points.details_json.instrumentLatitude`
- fallback `dbo.cems_wpms_measurement_points.details_json.instrumentLongitude`

Fallback order:

- `latitude`: `latitude -> details.stackLatitude -> details.instrumentLatitude -> null`
- `longitude`: `longitude -> details.stackLongitude -> details.instrumentLongitude -> null`

Transformation:

- Numeric DB values are returned as numbers.
- String values from `details_json` are parsed to numbers.
- Empty, missing, or non-numeric values return `null`.

Reason:

- Existing request forms store CEMS stack coordinates in `details_json.stackLatitude/stackLongitude` and WPMS instrument coordinates in `details_json.instrumentLatitude/instrumentLongitude`.
- Older rows may have `cems_wpms_measurement_points.latitude/longitude` as `NULL` even though the request detail page has coordinates in `details_json`.

Known risks:

- If both the top-level columns and `details_json` values exist but differ, the top-level columns win.
- The fallback depends on the current frontend field names in request details.

## Eligible Factory Candidates

Endpoint: `GET /api/v1/eligible-factories/candidates`

Code:

- `backend/src/modules/eligible-factories/eligible-factory-candidates.repository.ts`
- `backend/src/modules/eligible-factories/fac-import.mapper.ts`

### `factoryRegistrationNo`

Source:

- `dbo.fac_import.DISPFACREG`
- fallback `dbo.fac_import.FACREG`
- fallback `dbo.fac_import.FID`

Logic:

- ใช้ค่าแรกที่มีข้อมูลตามลำดับ `DISPFACREG -> FACREG -> FID`

Reason:

- บาง row อาจไม่มีเลขทะเบียนโรงงานแบบแสดงผล แต่ API ต้องมีเลขอ้างอิงโรงงาน

### `factoryId`

Source:

- `dbo.fac_import.FID`
- fallback `dbo.fac_import.FACREG`
- fallback `dbo.fac_import.DISPFACREG`

Logic:

- ใช้ค่าแรกที่มีข้อมูลตามลำดับ `FID -> FACREG -> DISPFACREG`

Reason:

- ใช้เป็น id ฝั่ง API สำหรับ row จากฐานโรงงาน กรอ.

### `factoryName`

Source:

- `dbo.fac_import.FNAME`

Logic:

- ถ้าไม่มีชื่อโรงงาน จะส่ง `ไม่ระบุชื่อโรงงาน`

Risk:

- เป็นข้อความ fallback ของระบบ ไม่ใช่ค่าจาก DB

### `factoryClass`

Source:

- `dbo.fac_import.CLASS`

Logic:

- เอาเฉพาะตัวเลข
- ใช้เลข 4 หลักท้าย
- pad ซ้ายด้วย `0` ให้ครบ 4 หลัก

Example:

```text
CLASS = 00100 -> factoryClass = 0100
```

Status:

- Confirmed by current domain decision.

### `factorySubclass`

Source:

- `dbo.FACCLASS.CLASS` join ด้วย `FID`

Logic:

- ดึงรายการ `CLASS` ทั้งหมดของ `FID` จาก `dbo.FACCLASS`
- เอาเลข 4 หลักท้ายของแต่ละ `CLASS` แล้ว pad ซ้ายด้วย `0` ให้เป็น 4 หลัก
- ตัดรหัสที่ซ้ำกับประเภทหลักออก เช่น `factoryClass = 0100` และ `FACCLASS.CLASS = 00100` จะไม่คืน `0100`
- ตัดค่าซ้ำ และถ้าเหลือหลายค่าให้ join ด้วย comma
- ถ้า `FACCLASS` ไม่มีค่า ให้คืน `null`
- ไม่ใช้ `fac_import.DISPFACREG`
- ไม่ใช้ `fac_import.FACREG`
- ไม่ใช้ `fac_import.CLASS`
- ไม่ใช้ `fac_import.FACTYPE`
- ไม่ใช้ `fac_import.EXPSEQ`

Example:

```text
fac_import.CLASS = 00100
FACCLASS.CLASS = 00100

factoryClass = 0100
factorySubclass = null
```

```text
fac_import.CLASS = 00100
FACCLASS.CLASS = 00100, 00201

factoryClass = 0100
factorySubclass = 0201
```

```text
fac_import.CLASS = 05301
FACCLASS.CLASS = 07000, 07300, 07702

factoryClass = 5301
factorySubclass = 7000,7300,7702
```

```text
fac_import.CLASS = 00403
FACCLASS.CLASS = 00000, 00003, 00403

factoryClass = 0403
factorySubclass = 0000,0003
```

Risk:

- ถ้า `FACCLASS` ไม่มี row สำหรับ `FID` ระบบจะคืน `null` แม้ `fac_import.CLASS` มีค่า
- ถ้า `FACCLASS` มีเฉพาะรหัสที่ซ้ำกับประเภทหลัก ระบบจะคืน `null`
- `DISPFACREG`/`FACREG` เป็นเลขทะเบียน ไม่ใช่ source ของ `factorySubclass`

### `provinceName`

Source:

- `dbo.fac_import.PROV`

Logic:

- แปลงรหัสจังหวัด กรอ. เป็นชื่อจังหวัดด้วย map ในโค้ด
- ถ้าไม่พบใน map จะส่ง `รหัสจังหวัด {code}`
- ถ้าไม่มีค่า จะส่ง `ไม่ระบุจังหวัด`

Risk:

- ชื่อจังหวัดมาจาก map ในระบบ ไม่ใช่ join master table จาก DB

### `industrialEstateName`

Source:

- `dbo.fac_import.COLONY_INDUST_CODE`
- lookup `dbo.FAC_COLONY_INDUST.COLONY_INDUST_DESC`

Logic:

- ถ้า lookup เจอ ส่งชื่อจาก `COLONY_INDUST_DESC`
- ถ้า lookup ไม่เจอ แต่ source มี code ส่ง code เดิม
- ถ้าไม่มี code ส่ง `null`

Risk:

- ค่าที่ส่งออกอาจเป็นชื่อเต็มหรือ code แล้วแต่ lookup สำเร็จหรือไม่

### `longitude` / `latitude`

Source:

- `dbo.fac_import.LONGITUDE_X`
- `dbo.fac_import.LATITUDE_Y`

Logic:

- ลองอ่านเป็น `latitude = LATITUDE_Y`, `longitude = LONGITUDE_X`
- ถ้าไม่อยู่ในช่วง WGS84 ให้ลองสลับเป็น `latitude = LONGITUDE_X`, `longitude = LATITUDE_Y`
- ถ้าทั้งคู่เป็น `0` ส่ง `null`
- ถ้า latitude ไม่อยู่ช่วง `-90..90` หรือ longitude ไม่อยู่ช่วง `-180..180` ส่ง `null`
- ไม่มีการแปลง projected coordinate เป็น WGS84

Example:

```text
LONGITUDE_X = 547213
LATITUDE_Y = 2034352

latitude = null
longitude = null
```

Risk:

- ค่า projected coordinate เช่น UTM จะถูกตัดทิ้งเป็น `null` เพราะระบบยังไม่มี conversion

### `operationStatus`

Source:

- `dbo.fac_import.FFLAG`

Logic:

- `1` -> `แจ้งประกอบแล้ว`
- `3` -> `หยุดชั่วคราว`
- ไม่มีค่า -> `ไม่ระบุสถานะ`
- ค่าอื่น -> `สถานะ {code}`

Risk:

- ค่าอื่นนอกจาก `1` และ `3` เป็นข้อความ fallback ของระบบ

### `machineryHorsepower`

Source:

- `dbo.fac_import.HP2`
- fallback `dbo.fac_import.HP`

Logic:

- ใช้เลขแรกที่ parse ได้ตามลำดับ `HP2 -> HP`

### `productionCapacity`

Source:

- lookup `dbo.FAC_PROD` join `dbo.UNIT`
- fallback `dbo.fac_import.CAPPROD`

Logic:

- ถ้า lookup `FAC_PROD` ได้ จะรวม `PRODNAME`, `PRODQUAN`, `UNIT.UNT_ENAME`
- ถ้า lookup ไม่ได้และ `CAPPROD` เป็นตัวเลข จะส่งค่า `CAPPROD` เป็น string

Risk:

- fallback `CAPPROD` มีรายละเอียดน้อยกว่า lookup จาก `FAC_PROD`

### `address`

Source:

- `dbo.fac_import.FADDR`
- `dbo.fac_import.FMOO`
- `dbo.fac_import.SOI`
- `dbo.fac_import.ROAD`
- `dbo.fac_import.TUMBOL`
- `dbo.fac_import.AMP`
- `dbo.fac_import.ZIPCODE`

Logic:

- รวม field ที่มีข้อมูลเป็น string เดียว
- เติมคำหน้า เช่น `หมู่`, `ซอย`, `ถนน`, `ตำบล`, `อำเภอ`

Risk:

- เป็น formatted address ของระบบ ไม่ใช่ raw DB field เดี่ยว

## Selected Eligible Factories

Endpoint: `GET /api/v1/eligible-factories`

Code:

- `backend/src/modules/eligible-factories/eligible-factories.repository.ts`
- `backend/src/modules/eligible-factories/eligible-factories.service.ts`
- `backend/src/modules/eligible-factories/factory-type-sequence.ts`

### `factoryClass` / `factorySubclass`

Source:

- `eligible_factories.factory_type_sequence`

Logic:

- DB เก็บประเภทโรงงานเป็นค่าเดียว เช่น `9200 / 0200,0602,0605`
- API แยกค่าหน้า `/` เป็น `factoryClass`
- API แยกค่าหลัง `/` เป็นรายการ `factorySubclass`
- ก่อนส่งออกและก่อนบันทึกข้อมูลใหม่ ระบบตัดรหัสรองที่ซ้ำกับประเภทหลักออก โดยเทียบเลข 4 หลักท้ายของ `factoryClass` กับรหัสใน `factorySubclass`
- สำหรับข้อมูลใหม่จากหน้า “โรงงานทั้งหมด (กรอ.)” ค่า `factorySubclass` มาจาก raw `FACCLASS.CLASS` แล้วใช้เลข 4 หลักท้าย เช่น `07000` -> `7000`, `07300` -> `7300`, `07702` -> `7702`
- ค่า `0000` หรือ `0003` จะเกิดได้เฉพาะเมื่อ raw source เป็นค่าแบบ `00000` หรือ `00003` จริง ไม่ใช่การเดาจาก stored value ที่เหลือแค่ `000` หรือ `003`
- ถ้าตัดแล้วไม่เหลือรหัสรอง จะส่ง `factorySubclass = null`

Example:

```text
factory_type_sequence = 9200 / 0200,0602,0605

factoryClass = 9200
factorySubclass = 0200,0602,0605
```

```text
factory_type_sequence = 0902 / 902

factoryClass = 0902
factorySubclass = null
```

Cleanup:

- Migration `0040_normalize_eligible_factory_type_sequences.ts` ปรับข้อมูลเก่าใน `eligible_factories.factory_type_sequence` ให้ตรงกับ rule เดียวกัน
- ก่อน update migration จะสำรองเฉพาะแถวที่ถูกแก้ไว้ใน `eligible_factory_type_sequence_cleanup_0040`
- Rollback migration จะคืนค่าเดิมจาก backup table
- Migration `0041_format_eligible_factory_subclasses_to_four_digits.ts` ปรับข้อมูลเก่าที่เหลือให้ `factorySubclass` เป็น 4 หลัก และสำรองค่าก่อนแก้ไว้ใน `eligible_factory_type_sequence_cleanup_0041`
- Migration `0042_use_last_four_digits_for_factory_subclasses.ts` ปรับ rule เป็นการใช้เลข 4 หลักท้ายจริง และสำรองค่าก่อนแก้ไว้ใน `eligible_factory_type_sequence_cleanup_0042`
- Migration `0043_rehydrate_eligible_factory_subclasses_from_source.ts` ปรับข้อมูลเก่าซ้ำอีกครั้งโดยใช้ `eligible_factories.source_factory_id` ไปดึง raw `FACCLASS.CLASS` จากฐาน กรอ. จริง แล้วสำรองค่าก่อนแก้ไว้ใน `eligible_factory_type_sequence_cleanup_0043`

Risk:

- Rule นี้ตัดเฉพาะรหัสรอง 4 หลักที่เท่ากับเลข 4 หลักท้ายของประเภทหลักหลัง pad เป็น 4 หลักเท่านั้น
- เคสเช่น `0403 / 000,003,00403` จะกลายเป็น `0403 / 0000,0003`
- ถ้าข้อมูลเก่าถูก normalize ผิดจนสูญเลขหลักหน้าไปแล้ว เช่น source เดิม `07000` ถูกเก็บเป็น `0000` จะต้องเติมจาก source เดิมอีกครั้ง เพราะค่า `7000` ไม่เหลืออยู่ใน stored value; migration `0043` ทำงานส่วนนี้เฉพาะแถวที่มี `source_factory_id`

## CEMS/WPMS Request Factory Snapshot

Endpoint: `POST /api/v1/cems-wpms-requests/measurement-points`, `POST /api/v1/cems-wpms-requests/parameters`, `PUT /api/v1/cems-wpms-requests/:id/form`, `GET /api/v1/cems-wpms-requests/:id`, `GET /api/v1/cems-wpms-requests/search-options`

Code:

- `backend/src/modules/connection-requests/connection-requests.repository.ts`
- `backend/src/modules/connection-requests/connection-requests.validator.ts`
- `backend/src/db/migrations/0048_create_request_factory_snapshots.ts`

### `regionCode` / `regionName`

Source:

- request payload `regionCode`, `regionName`
- fallback `provinces.region` from the current `factories.province_id`

Logic:

- When a request form is submitted, backend stores one active snapshot row in `cems_wpms_request_factory_snapshots`.
- `regionName` uses payload `regionName` first, then falls back to `provinces.region`.
- `regionCode` uses payload `regionCode` first, then falls back to the effective `regionName` because the current province master stores region as text, not a separate code.

Reason:

- Advanced search must use the factory location as it was when the request was submitted, not whatever the factory master changes to later.

Risk:

- Historical rows before migration can only be backfilled if the request still matches a row in `factories`; otherwise these fields remain `null`.

### `provinceCode` / `provinceName` / `industrialEstateCode` / `industrialEstateName`

Source:

- request payload location fields
- fallback `factories.province_id`
- fallback `provinces.name_th`
- fallback `industrial_estates.code`
- fallback `industrial_estates.name_th`

Logic:

- Payload fields win because they represent the submitted form.
- If payload omits province or estate, backend looks up `factories` by `factoryId` / `factoryRegistrationNo`, then joins `provinces` and `industrial_estates`.
- Migration `0048` backfills old requests using the same factory/province/estate relationship where possible.

Reason:

- Keeps search dimensions denormalized and indexed for request search while preserving the submitted request state.

Risk:

- Old requests whose factory id or registration number no longer matches `factories` cannot be fully backfilled.
- District/subdistrict are not derived from address text; they are stored only when the request payload sends separate fields.

### `industryMainOrderLabel`

Source:

- request payload `industryMainOrderLabel`
- stored `cems_wpms_request_factory_snapshots.factory_main_type_label`

Logic:

- API keeps the machine filter code in `industryMainOrder`.
- API stores and returns the display description separately as `industryMainOrderLabel`.
- `GET /api/v1/cems-wpms-requests/search-options` returns factory main type options with `code = factory_main_type_code`, `label = factory_main_type_code`, and `description = factory_main_type_label`.

Reason:

- Frontend needs dropdown display like `8802 - ประเภทโรงงานลำดับที่ 88(2): การผลิตพลังงานไฟฟ้าจากพลังงานความร้อน` while filtering by stable code `8802`.

Risk:

- Existing rows only have `industry_main_order`; their `industryMainOrderLabel` stays `null` until resubmitted or backfilled from a trusted factory type description source.

## CEMS/WPMS Request Status Timeline

Endpoint: `GET /api/v1/cems-wpms-requests/:id` and request detail/list hydration surfaces that include `statusHistory`

Code:

- `backend/src/modules/connection-requests/connection-requests.repository.ts`
- `backend/src/modules/connection-requests/connection-requests.types.ts`

### `statusHistory[].changedBy`

Source:

- `cems_wpms_request_status_history.changed_by`
- `users.id`
- `users.prename_th`
- `users.first_name`
- `users.last_name`
- `users.username`

Logic:

- API keeps the raw user id as `changedById`.
- API returns `changedBy` as a display name from `users`.
- Name format joins Thai prefix and first name without an extra space, then appends last name with a space, for example `นายสมชาย เจ้าหน้าที่`.
- If the name fields are empty, fallback to `users.username`.
- If username is also empty or the join does not find a user row, fallback to `User #<changedById>`.

Reason:

- Frontend timeline should display a human-readable actor while retaining the audit id.

Risk:

- Historical rows whose `users` record was deleted or never hydrated will show the fallback `User #<id>`.

### `statusHistory[].durationDays` / `durationText`

Source:

- Current row `cems_wpms_request_status_history.changed_at`
- Next row `cems_wpms_request_status_history.changed_at`
- Terminal status list: `CONNECTED`, `CANCELED`

Logic:

- Each row's `endedAt` is the next status row's `changed_at`.
- If the row itself is terminal and has no next row, `endedAt` equals its own `changedAt`.
- If the row is the latest row but not terminal, `endedAt`, `durationDays`, and `durationText` are `null`.
- `durationDays` counts inclusive calendar dates from ISO date parts, not elapsed hours. Example: `2026-06-26` to `2026-06-27` returns `2`.
- `durationText` formats the value as `<N> วัน`.

Reason:

- Business reporting wants calendar-day counting, including both request start date and terminal status date.

Risk:

- The calculation uses the ISO date part in the stored timestamp response. It does not convert timestamps into local timezone dates before counting.

### `statusDurationSummary`

Source:

- First `statusHistory` row
- Last `statusHistory` row
- Terminal status list: `CONNECTED`, `CANCELED`

Logic:

- `startedAt`, `startDate`, `startStatus`, and `startStatusLabel` come from the first status row.
- `endStatus` and `endStatusLabel` come from the latest status row.
- If the latest status is `CONNECTED` or `CANCELED`, `endedAt`, `endDate`, `totalDurationDays`, and `totalDurationText` are populated.
- If the latest status is not terminal, those completion fields stay `null`.
- `totalDurationDays` counts inclusive calendar dates from the first row's date to the latest terminal row's date.

Reason:

- The summary gives one clear total from the first submitted status through the final terminal state.

Risk:

- Requests without any status history return a null summary.

## CEMS/WPMS Request Table Waiting Connection Countdown

Endpoint: `GET /api/v1/cems-wpms-requests/table-rows`

Code:

- `backend/src/modules/connection-requests/connection-requests.service.ts`
- `backend/src/modules/connection-requests/connection-requests.types.ts`

### `connectionDueAt` / `waitingConnectionDaysRemaining` / `waitingConnectionText`

Source:

- `cems_wpms_connection_requests.status`
- `cems_wpms_connection_requests.connection_due_at`
- Current server clock at response mapping time

Logic:

- These fields are populated only when the row status is `WAITING_CONNECTION` and `connection_due_at` is a valid timestamp.
- `connectionDueAt` returns the ISO timestamp from `connection_due_at`.
- `waitingConnectionDaysRemaining` is `ceil((connectionDueAt - now) / 1 day)`, clamped to `0` when the due date has already passed.
- `waitingConnectionText` formats the value as `รอเชื่อมต่อ <N> วัน`.
- Rows in any other status return `null` for all three fields.

Reason:

- The request table needs a direct display label such as `รอเชื่อมต่อ 18 วัน` without changing the existing `status` / `statusCode` contract.

Risk:

- The countdown is computed from the server clock at request time. Values can change between requests and may differ from a browser-side clock near day boundaries.
