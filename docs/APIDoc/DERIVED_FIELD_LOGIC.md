# Derived Field Logic

เอกสารนี้ใช้บันทึก field ที่ API ไม่ได้ส่ง raw DB ตรง ๆ แต่มีการตีความ แปลงค่า fallback หรือรวมค่าจากหลาย field ก่อนส่งออก

กติกา:

- ถ้าเพิ่มหรือแก้ logic ที่ไม่ได้เป็น raw DB ตรง ๆ ต้องอัปเดตไฟล์นี้ใน change เดียวกัน
- ระบุ source table/field, logic ที่ใช้, เหตุผล, และข้อควรระวัง
- ถ้า logic เป็นเพียง fallback ชั่วคราว ให้เขียนไว้ชัดเจนว่า fallback จากอะไรไปอะไร
- ถ้าไม่แน่ใจว่า field ควรตีความอย่างไร ให้หยุดที่ raw value และถามก่อน

## Connected Measurement Point Modal Detail

Endpoint:

- `GET /api/v1/connected-measurement-points/factories/:factoryId`

Code:

- `backend/src/modules/connection-requests/connection-requests.service.ts`

### `parameterDetails`, `primaryFuel`, `secondaryFuel`

Source:

- Current connected point lookup: `dbo.cems_wpms_connection_requests` with connected `measurementPoints`
- Stored parameter source: `dbo.cems_wpms_measurement_points.parameters_json`
- The connected/current copy in `dbo.cems_wpms_connected_measurement_points.parameters_json` is populated from the same measurement-point parameter set during connection sync.
- Stored fuel source: `measurementPoints[].details.primaryFuel` and `measurementPoints[].details.secondaryFuel`, using the same camelCase field names as CEMS/WPMS request forms.

Fallback order:

- Match the requested `factoryId` against connected measurement points using existing `listConnectedMeasurementPoints({ factoryId })` behavior.
- Return each matched point's parsed `parameters` array as `parameterDetails`.
- Return each matched point's `details.primaryFuel` and `details.secondaryFuel`; missing, non-string, or blank values become `null`.

Transformation:

- `pointCode`, `pointName`, and `pointType` are direct aliases from each matched measurement point.
- `parameterDetails` is the parsed parameter array returned by the backend DTO instead of the raw JSON string.
- `primaryFuel` and `secondaryFuel` are trimmed string values from `details`; blank strings are normalized to `null`.

Reason:

- The "รายละเอียดจุดตรวจวัด" modal needs code, name, type, parameter detail, primary fuel, and secondary fuel.
- Keeping this endpoint narrow avoids sending request, factory, and device-config fields into the modal.
- The response is a collection because one factory can have multiple connected measurement points; when no connected points match, the API returns `data: []` with `meta.total: 0`.

Known risks:

- If `parameters_json` contains bare parameter codes instead of labels with units, this endpoint returns those stored values as-is. The submit/sync path should keep storing display-ready labels such as `NOx (ppm)` where available.

### WPMS กวภ.03 prefill fields

Source:

- Current connected point lookup: `dbo.cems_wpms_connection_requests` with connected `measurementPoints`
- Stored WPMS detail source: `measurementPoints[].details` from `dbo.cems_wpms_measurement_points.details_json`
- Stored instrument source: `measurementPoints[].measurementInstruments` from `dbo.cems_wpms_measurement_points.instruments_json`

Fallback order:

- `wastewaterSource`: `details.wastewaterSource -> null`
- `receivingSource`: `details.dischargeReceivingSource -> null`
- `treatmentSystemType`: `details.treatmentSystem` แบบ string -> trim; แบบ string[] -> ตัดค่าว่าง/ค่าซ้ำแล้ว join ด้วย `, ` -> null
- `dischargePoint`: `details.dischargePoint -> details.instrumentLatitude + details.instrumentLongitude -> null`
- `averageDischarge`: `details.averageWastewaterDischarge -> null`
- `minimumDischarge`: `details.minWastewaterDischarge -> null`
- `maximumDischarge`: `details.maxWastewaterDischarge -> null`
- `measurementTimes`: unique non-empty `measurementInstruments.parameters[].technique`
- `instruments`: derived from registered WPMS parameter labels. If both BOD and COD are present, return `ค่าบีโอดี (BOD) และ ค่าซีโอดี (COD)`; otherwise return the matching single กวภ.03 option.

Transformation:

- These fields are added only when the connected point response row has system type `WPMS`; CEMS rows keep the existing modal shape.
- String detail values are trimmed; blank or missing values become `null`.
- `treatmentSystemType` คง response type เป็น `string|null` เพื่อ backward compatibility: ค่า Multiselect แบบ array จะถูก join เป็นข้อความเดียวตามลำดับที่บันทึก.
- Numeric detail values are returned as numbers when stored as numbers; string values are trimmed and returned as strings.
- `dischargePoint` joins latitude and longitude as `<latitude>, <longitude>` only when both are present.

Reason:

- แบบ กวภ.03 needs the WPMS point and wastewater-discharge fields prefilled from the connected measurement point API used by the frontend: `GET /api/v1/connected-measurement-points/factories/:factoryId`.

Known risks:

- Historical rows with non-standard detail keys will return `null` for the new prefill fields until those keys are explicitly mapped.
- `measurementTimes` depends on `technique`; if old WPMS submissions used technique for measurement method instead of interval, the frontend may still need manual user review.

## KWP Form Report Factory Table Fields

Endpoint:

- `GET /api/v1/kwp-form-reports/factories`

Code:

- `backend/src/modules/kwp-form-reports/kwp-form-reports.repository.ts`

### `businessActivity`, `industryMainOrder`

Source:

- Base factory row: `dbo.factories`
- Eligibility enrichment: `dbo.eligible_factories`

Fallback order:

- `businessActivity`: `eligible_factories.business_activity`
- `industryMainOrder`: main factory class from `eligible_factories.factory_type_sequence`

Transformation:

- `businessActivity` is returned directly from the eligible-factory enrichment value.
- `industryMainOrder` uses the same factory-type sequence parser as the connection-request/eligible-factory workflows and returns only the main 5-digit class.

Reason:

- The KWP factory table is built from POMS connected factories, but the more complete industry/business activity text is maintained in the eligible-factory enrichment table.
- The frontend needs "การประกอบกิจการ" as a separate value matching the connection-request screen instead of overloading `industryType`.
- The frontend also needs the main factory type sequence only, not the full main/sub sequence.

Known risks:

- If the eligible-factory join keys do not match the POMS factory row, `businessActivity` and `industryMainOrder` remain `null`.

## BOD/COD Online Deviation Report Frontend Table Fields

Endpoints:

- `GET /api/v1/bod-cod-deviation-reports/factories`
- `GET /api/v1/bod-cod-deviation-reports`

Code:

- `backend/src/modules/bod-cod-deviations/bod-cod-deviation-reports.repository.ts`

### Factory table aliases and measurement point rows

Source:

- Base rows: `dbo.cems_wpms_connected_measurement_points`
- Optional enrichment: `dbo.factories`, `dbo.eligible_factories`, `dbo.provinces`, `dbo.industrial_estates`
- Current-year report slots: `dbo.bod_cod_deviation_reports`

Fallback order:

- `factoryId` / `id`: `factories.fid` first, then `cems_wpms_connected_measurement_points.factory_id`
- `province`: same value as `provinces.name_th`
- `industryType`: `eligible_factories.business_activity` first, then `factories.system_detail`
- `address`: `eligible_factories.address` first, then `cems_wpms_connected_measurement_points.factory_address`
- `measurementPoints[].stationId`: `point_code` first, then `point_name`
- report slot lookup: `connected_measurement_point_id` first, then `point_code`

Transformation:

- `factoryRegistration` and `newRegistrationNo` both come from `cems_wpms_connected_measurement_points.factory_registration_no` for frontend table compatibility.
- `measurementPoints[].code`, `name`, and `type` are frontend aliases for `point_code`, `point_name`, and `system_type`.
- `measurementPoints[].parameters` is a comma-separated display string parsed from `parameters_json`; the parsed array is also returned as `parameterCodes`.
- `round1Status` and `round2Status` are Thai display labels derived from the two current Buddhist-year report slots. Missing slots return `ยังไม่ยื่น`.

Reason:

- The BOD/COD frontend table binds directly to `newRegistrationNo`, `oldRegistrationNo`, `province`, `measurementPoints[].code`, `measurementPoints[].name`, `measurementPoints[].type`, `measurementPoints[].parameters`, `round1Status`, and `round2Status`.
- Keeping the backend aliases lets the frontend consume API rows without renaming columns.

Known risks:

- `oldRegistrationNo` depends on optional enrichment from `eligible_factories`; if no enrichment row matches, it returns `null`.
- `parameters_json` may contain labels such as `BOD (mg/l)` instead of plain `BOD`; frontend filtering should keep checking for BOD/COD text rather than exact array values.

### Report table frontend fields

Source:

- Base rows: `dbo.bod_cod_deviation_reports`
- Measurement count: `dbo.bod_cod_deviation_measurements`
- Optional factory/province filtering: `dbo.factories`, `dbo.provinces`

Transformation:

- `factoryRegistration` is an alias for `factory_registration_no`; `factoryRegistrationNo` is preserved for backend consumers.
- `province` is an alias for `province_name`; `provinceName` is preserved.
- `reportRound` is converted from numeric `report_round` to Thai display text such as `ครั้งที่ 1`; the numeric value is preserved as `reportRoundNo`.
- `year` is an alias for numeric `report_year`; `reportYear` is preserved.
- `status` is Thai display text for frontend chips; machine status is preserved as `statusCode`.
- For operator scope (`OWN_FACTORY`), pending workflow states `SUBMITTED`, `REVISED_PENDING_REVIEW`, and `WAITING_APPROVAL` display as `รอพิจารณา` until the report is approved.
- `submittedDate` is `submitted_at` formatted as `DD/MM/BBBB`.
- `reviewedDate` is `-` while status is `DRAFT`, `SUBMITTED`, or `REVISED_PENDING_REVIEW`; otherwise it uses `updated_at` formatted as `DD/MM/BBBB`.

Reason:

- The frontend report grid binds directly to `factoryRegistration`, `province`, `reportRound`, `year`, `submittedDate`, `reviewedDate`, and `status`.
- `statusCode`, `reportRoundNo`, ISO datetime fields, and backend name fields remain available for workflow logic and future forms.

Known risks:

- There is no dedicated reviewed-at column in the first BOD/COD report schema, so `reviewedDate` uses `updated_at` after review-like statuses. If exact review timestamps become required, add a stored review timestamp and replace this fallback.

### Saved form workflow and measurement fields

Endpoints:

- `POST /api/v1/bod-cod-deviation-reports`
- `GET /api/v1/bod-cod-deviation-reports/:id`
- `PUT /api/v1/bod-cod-deviation-reports/:id/resubmission`
- `POST /api/v1/bod-cod-deviation-reports/:id/workflow-actions`

Source:

- Form header: `dbo.bod_cod_deviation_reports`
- Measurement rows: `dbo.bod_cod_deviation_measurements`
- Attachment metadata: `dbo.bod_cod_deviation_attachments`
- Workflow steps: `dbo.bod_cod_approval_steps`
- Workflow events: `dbo.bod_cod_approval_events`

Transformation:

- `approvalTrack` is derived from the submitted `provinceName`: provinces in `ภาคกลาง` become `CENTRAL`; every other province becomes `REGIONAL`.
- `steps` are initialized from `approvalTrack` when the form is saved:
  - `CENTRAL`: เจ้าหน้าที่กฝม. (ตรวจสอบความถูกต้อง + บันทึก/แก้ไขแบบแจ้งผล) -> ผอ.กฝม. (ทบทวน) -> ผอ.กวภ. (อนุมัติ)
  - `REGIONAL`: เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์ (ตรวจสอบความถูกต้อง + บันทึก/แก้ไขแบบแจ้งผล) -> ผอ.ศูนย์ (อนุมัติ)
- `currentStep` is the step where `is_current = true`.
- `allowedActions` is derived from report status, current step, and permission scope. Operator `OWN_FACTORY` currently receives `CANCEL` while the report is not final; officer scopes can receive `APPROVE`, `REQUEST_REVISION`, and `REJECT` when the current step is pending.
- `deviationValueMgL` comes from database generated column `device_value_mg_l - lab_value_mg_l`.
- `isWithinStandard` is derived on save: if `standardDeviationMgL` is absent, return `null`; otherwise compare `ABS(deviationValueMgL) <= standardDeviationMgL`.
- `selectedParameterLabel` keeps the unit with the parameter display name, e.g. `BOD (mg/l)` and `COD (mg/l)`.
- Resubmission is allowed only when the stored report status is `REVISION_REQUESTED` and the current approval step status is also `REVISION_REQUESTED`.
- Resubmission sets report status to `REVISED_PENDING_REVIEW`, replaces measurement rows and attachment metadata, resets step 1 to `PENDING` + `is_current = true`, resets every later step to `WAITING` + `is_current = false`, clears prior per-step decisions from the current step rows, and records `RESUBMIT_REVISION` in `bod_cod_approval_events`.
- Resubmission does not allow identity fields to drift from the original report slot: `reportRoundNo`, `reportYear`, `factoryRegistrationNo`, `connectedMeasurementPointId`, `pointCode`, and `selectedParameterCode` must match the stored report.
- Officer workflow actions validate against the current report status, current step status, permission scope, and `regionalAccess`.
- `APPROVE` sets the current step to `APPROVED`; if another step exists, that next step becomes `PENDING` and the report becomes `WAITING_APPROVAL`, otherwise the report becomes `APPROVED`.
- `REQUEST_REVISION` from the first officer-side steps (`INSPECTOR` or `RESULT_NOTICE`) sets the current step and report to `REVISION_REQUESTED`; the next operator resubmission restarts approval from step 1.
- `REQUEST_REVISION` from director-side steps (`REVIEWER` or `APPROVER`) is an internal rollback, not an operator revision request: the report returns to `SUBMITTED`, step 1 becomes `PENDING` + `is_current = true`, later steps become `WAITING` + `is_current = false`, and the revision reason is still kept in `bod_cod_approval_events`.
- `REJECT` sets the current step to `REJECTED`, clears the active current step, and sets the report to terminal status `REJECTED`.
- Each officer workflow action inserts a row into `bod_cod_approval_events`; `REQUEST_REVISION` stores `revisionReason` as the event note, while `APPROVE` and `REJECT` store `officerNote`.
- `statusHistory` is returned by the list and detail APIs in the same shape as KWP form reports. The first `SUBMITTED` item is synthesized from `bod_cod_deviation_reports.submitted_at` and `created_by` so existing reports without a submit event still have a complete timeline. Later items come from `bod_cod_approval_events` joined to `users`.
- `statusHistory.status` maps event actions to timeline statuses, not the report-level workflow status: `REQUEST_REVISION` -> `REVISION_REQUESTED`, `RESUBMIT_REVISION` -> `SUBMITTED`, `REJECT` -> `REJECTED`, and every `APPROVE` event -> `APPROVED`. Report-level status and the active approval step remain separate fields under `statusCode`, `currentStep`, and `steps`.

Reason:

- The frontend should not hardcode Bangkok-vs-regional step branching. Backend owns `approvalTrack`, `steps`, `currentStep`, and `allowedActions`.
- The saved form must be reopenable with the same values the paper-like preview needs: header fields, lab/device fields, measurements, attachment metadata, and workflow state.
- The frontend should be able to render BOD/COD and KWP timelines from the same `statusHistory[]` contract.
- Operator save access must be checked against `user_juristics`; the backend must not rely only on factory identifiers supplied in the request body.
- Operator resubmission must return the report to the first officer step, even if a later reviewer/approver requested the revision, so officers review the corrected report through the full track again.

Known risks:

- `reportNo` is generated from the current count for the submitted Buddhist year. If high concurrency becomes likely, replace it with a database-backed sequence.
- Attachment upload bytes are not handled by this JSON endpoint; the endpoint stores metadata for files already uploaded or otherwise staged.
- The resubmission API soft-replaces attachment metadata only and does not delete object storage files; orphan file cleanup should be handled by a separate job.

## Auth Regional Access

Endpoints:

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- regional filters on connection-request/factory read endpoints that use the JWT claim

Code:

- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/regional-access.ts`
- `backend/src/modules/connection-requests/connection-requests.repository.ts`
- `backend/src/modules/connection-requests/connection-requests.service.ts`

### `user.regionalAccess`

Source:

- Primary: `dbo.officer_profiles.regional_access_json`
- Backfill/fallback source for known regional centers: `dbo.officer_profiles.department_name_th`
- Backfill/fallback source for known regional centers: `dbo.officer_profiles.line_name_th`

Fallback order:

- Parse `regional_access_json` first.
- If no stored regional access exists, infer only when profile text contains a known regional-center abbreviation first:
  - `ศวภ.ตอ.` -> `ภาคตะวันออก`
  - `ศวภ.ตต.` -> `ภาคตะวันตก`
  - `ศวภ.ตอน.` -> `ภาคตะวันออกเฉียงเหนือ`
  - `ศวภ.น.` -> `ภาคเหนือ`
  - `ศวภ.ต.` -> `ภาคใต้`
- If no regional-center abbreviation is found, infer central office text:
  - `กวภ.` or `กองวิจัยและเตือนภัยมลพิษโรงงาน` -> `ภาคกลาง`
- If neither source has a known region, return no `regionalAccess`.

Transformation:

- API stores and returns a normalized object: `{ "regions": ["ภาค..."] }`.
- Duplicate and blank region values are removed.
- Old JSON shapes with `regionCodes` or `regionNames` are parsed for compatibility and normalized into `regions`.
- The JWT includes `regionalAccess` so request/factory reads can apply region filters without another DB lookup.

Reason:

- Regional officers and center directors must see only the requests/factories in their assigned region, while existing role permissions can remain unchanged.
- POMS currently has `provinces.region` as the proven region source; there is no separate region-code master in this checkout.

Known risks:

- Officers without stored regional access and without one of the known `ศวภ.*`/`กวภ.` office texts remain governed by their existing permission scope.
- If a profile contains both the parent division name and a `ศวภ.*` abbreviation, the `ศวภ.*` region wins so regional users are not accidentally granted `ภาคกลาง`.
- Text inference is intentionally limited to known abbreviations and should be replaced by explicit `regional_access_json` where possible.
- Existing JWTs issued before a regional access change keep their previous claim until the user logs in again or refreshes the session.

## Managed User Permission Form Location Fields

Endpoints:

- `GET /api/v1/users/:id`
- `POST /api/v1/users/local-accounts`
- `PATCH /api/v1/users/:id`

Code:

- `backend/src/modules/users/users.validator.ts`
- `backend/src/modules/users/users.service.ts`
- `backend/src/modules/users/users.repository.ts`

### `user.provinceId` / `user.provinceName`

Source:

- Stored value: `dbo.officer_profiles.province_id`
- Display value: `dbo.provinces.name_th`

Transformation:

- Create/update payload may send either `provinceId` or `provinceName`.
- If a Thai province name is sent, backend resolves it through `dbo.provinces.name_th` and stores only the matching `provinces.id` in `officer_profiles.province_id`.
- Profile/detail endpoints may return `provinceId` from the profile and `provinceName` from the joined province master.
- The permission-management edit contract does not accept or return user-level `provinceId` / `provinceName`; menu location scope must use `permissions.<module>.province`.
- `all`, blank string, or `null` is treated as clearing the province scope value.

Reason:

- The permission-management form uses province labels for users, while permission scope enforcement relies on stable province IDs.

Known risks:

- If the province master is missing or renamed, saving by `provinceName` fails with `Unknown province`; clients should prefer `provinceId` when possible.

### `user.regionalAccess` from profile region fields

Source:

- Form payload fields: `regionName`, `regions`, or canonical `regionalAccess`
- Stored value: `dbo.officer_profiles.regional_access_json`

Transformation:

- `regionName` is converted to `{ "regions": ["..."] }`.
- `regions` is normalized through the same `regionalAccess.regions` contract.
- Canonical `regionalAccess` takes precedence when both canonical and form-specific region fields are sent.
- `all`, blank string, or `null` clears the regional access value.

Reason:

- The existing regional filtering code already consumes `regionalAccess.regions`, so form-specific region inputs are normalized into that single backend contract.

Known risks:

- This is user-level regional access used by login/auth filtering. The permission-management edit contract does not accept or return user-level `regionName`, `regions`, or `regionalAccess`; per-menu location scope is stored separately on `user_permissions`.

### `permissions.<module>.region` / `permissions.<module>.province`

Source:

- Form payload fields: `permissions.<module>.region`, `permissions.<module>.province`
- Stored values: `dbo.user_permissions.region_name`, `dbo.user_permissions.province_id`
- Display value for province: `dbo.provinces.name_th`

Transformation:

- `permissions.<module>.data = IN_REGION` accepts `region` as a string or `null`; backend stores non-empty values as `user_permissions.region_name`.
- `permissions.<module>.data = IN_PROVINCE` accepts `province` as a string or `null`; backend accepts non-empty province values as either `provinces.id` or `provinces.name_th` and stores `provinces.id`.
- For scopes other than `IN_REGION`, backend clears `region_name`.
- For scopes other than `IN_PROVINCE`, backend clears `province_id`.
- Permission-management `GET /api/v1/users/:id`, `POST /api/v1/auth/login`, and `GET /api/v1/auth/me` return each permission group with `region` and `province`; `province` is the Thai display name when a province id is stored.
- JWT `scopes` are flattened back to the broad scope string, such as `IN_REGION`, so existing authorization middleware can keep reading `req.user.scopes[permissionCode]`.
- JWT also includes `scopeDetails[permissionCode]` with the selected `region` / `province` so runtime filters for menu-scoped modules, including `kwp_forms` and `bod_cod_errors`, can apply the exact per-menu location selection.

Reason:

- The permission-management screen edits data visibility by menu. A user can have dashboard scoped by region while factory data is scoped by province, so this cannot live only on the officer profile.

Known risks:

- Existing JWTs issued before `scopeDetails` was added still carry only the broad scope value; users should log in again or refresh their session before relying on per-menu `region` / `province` runtime filters.

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

## Public Factory Map Points

Endpoint: `GET /api/v1/public/factory-map-points`

Code:

- `backend/src/modules/connection-requests/connection-requests.routes.ts`
- `backend/src/modules/connection-requests/connection-requests.controller.ts`
- `backend/src/modules/connection-requests/connection-requests.service.ts`

### public map point rows

Source:

- Same eligible/visible factory summary source used by `GET /api/v1/operator-factory-dashboard`
- `factories`, `eligible_factories`, `provinces`, `industrial_estates`
- `cems_wpms_connected_measurement_points` for connected point counts, station metadata, and `documents_json` used only to derive `factoryLogoUrl`

Logic:

- The endpoint is intentionally public and does not require `Authorization`.
- The service reads with factory scope `ALL` and no regional/user-owned filter.
- Rows without connected measurement points are removed because they are not map points.
- `systemType=CEMS|WPMS` filters by connected measurement point system type when supplied.
- Rows reuse dashboard-derived location/type/count fields and derive `factoryLogoUrl` with the same CEMS document-title fallback as `GET /api/v1/operator-factory-dashboard`, then remove user-specific or internal fields:
  - `isFavorite`
  - `hasLatestHourlyMeasurement`
  - `measurementPoints[].data`
- The endpoint returns `factoryLogoUrl` but does not expose `documentsAndImages` or other document metadata.
- `measurementPoints[]` keeps only station/point identity, `systemType`, and parameter display labels.
- Fallback order for all inherited dashboard-derived fields is unchanged from `GET /api/v1/operator-factory-dashboard`; this endpoint only applies the public-field removal step after those values are resolved.

Reason:

- The landing map must show factory points before login without exposing account-specific state or raw measurement payloads.
- A separate public endpoint keeps the authenticated operator dashboard contract unchanged.

Risk:

- The endpoint exposes all visible eligible factories with at least one connected measurement point regardless of operator ownership; changes to public disclosure policy should be made here rather than by opening authenticated dashboard routes.

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
- ใช้เลข 5 หลักท้าย
- pad ซ้ายด้วย `0` ให้ครบ 5 หลัก

Example:

```text
CLASS = 00100 -> factoryClass = 00100
```

Status:

- Confirmed by current domain decision.

### `factorySubclass`

Source:

- `dbo.FACCLASS.CLASS` join ด้วย `FID`

Logic:

- ดึงรายการ `CLASS` ทั้งหมดของ `FID` จาก `dbo.FACCLASS`
- เอาเลข 5 หลักท้ายของแต่ละ `CLASS` แล้ว pad ซ้ายด้วย `0` ให้เป็น 5 หลัก
- ตัดรหัสที่ซ้ำกับประเภทหลักออก เช่น `factoryClass = 00100` และ `FACCLASS.CLASS = 00100` จะไม่คืน `00100`
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

factoryClass = 00100
factorySubclass = null
```

```text
fac_import.CLASS = 00100
FACCLASS.CLASS = 00100, 00201

factoryClass = 00100
factorySubclass = 00201
```

```text
fac_import.CLASS = 05301
FACCLASS.CLASS = 07000, 07300, 07702

factoryClass = 05301
factorySubclass = 07000,07300,07702
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

- DB เก็บประเภทโรงงานเป็นค่าเดียว เช่น `09200 / 00200,00602,00605`
- API แยกค่าหน้า `/` เป็น `factoryClass`
- API แยกค่าหลัง `/` เป็นรายการ `factorySubclass`
- ก่อนส่งออกและก่อนบันทึกข้อมูลใหม่ ระบบตัดรหัสรองที่ซ้ำกับประเภทหลักออก โดยเทียบรหัส 5 หลักของ `factoryClass` กับรหัสใน `factorySubclass`
- สำหรับข้อมูลใหม่จากหน้า “โรงงานทั้งหมด (กรอ.)” ค่า `factorySubclass` มาจาก raw `FACCLASS.CLASS` แล้วใช้เลข 5 หลักท้าย เช่น `07000` -> `07000`, `07300` -> `07300`, `07702` -> `07702`
- ค่า `00000` หรือ `00003` จะเกิดได้เฉพาะเมื่อ raw source เป็นค่าแบบ `00000` หรือ `00003` จริง ไม่ใช่การเดาจาก stored value ที่เหลือแค่ `000` หรือ `003`
- ถ้าตัดแล้วไม่เหลือรหัสรอง จะส่ง `factorySubclass = null`

Example:

```text
factory_type_sequence = 09200 / 00200,00602,00605

factoryClass = 09200
factorySubclass = 00200,00602,00605
```

```text
factory_type_sequence = 00902 / 902

factoryClass = 00902
factorySubclass = null
```

Cleanup:

- Migration `0040_normalize_eligible_factory_type_sequences.ts` ปรับข้อมูลเก่าใน `eligible_factories.factory_type_sequence` ให้ตรงกับ rule เดียวกัน
- ก่อน update migration จะสำรองเฉพาะแถวที่ถูกแก้ไว้ใน `eligible_factory_type_sequence_cleanup_0040`
- Rollback migration จะคืนค่าเดิมจาก backup table
- Migration `0041_format_eligible_factory_subclasses_to_four_digits.ts` ปรับข้อมูลเก่าที่เหลือให้ `factorySubclass` เป็น 4 หลัก และสำรองค่าก่อนแก้ไว้ใน `eligible_factory_type_sequence_cleanup_0041`
- Migration `0042_use_last_four_digits_for_factory_subclasses.ts` ปรับ rule เป็นการใช้เลข 4 หลักท้ายจริง และสำรองค่าก่อนแก้ไว้ใน `eligible_factory_type_sequence_cleanup_0042`
- Migration `0043_rehydrate_eligible_factory_subclasses_from_source.ts` ปรับข้อมูลเก่าซ้ำอีกครั้งโดยใช้ `eligible_factories.source_factory_id` ไปดึง raw `FACCLASS.CLASS` จากฐาน กรอ. จริง แล้วสำรองค่าก่อนแก้ไว้ใน `eligible_factory_type_sequence_cleanup_0043`
- Migration `0065_rehydrate_factory_type_sequences_to_five_digits.ts` ปรับข้อมูลเก่าให้ใช้รหัสหลัก/รอง 5 หลักจาก `fac_import.CLASS` และ `FACCLASS.CLASS` พร้อม backup ใน `eligible_factory_type_sequence_cleanup_0065`

Risk:

- Rule นี้ตัดเฉพาะรหัสรอง 5 หลักที่เท่ากับรหัสหลักหลัง pad เป็น 5 หลักเท่านั้น
- เคสเช่น `00403 / 000,003,00403` จะกลายเป็น `00403 / 00000,00003`
- ถ้าข้อมูลเก่าถูก normalize ผิดจนสูญเลขหลักหน้าไปแล้ว เช่น source เดิม `07000` ถูกเก็บเป็น `0000` จะต้องเติมจาก source เดิมอีกครั้ง เพราะค่า `7000` ไม่เหลืออยู่ใน stored value; migration `0043` ทำงานส่วนนี้เฉพาะแถวที่มี `source_factory_id`

## CEMS/WPMS Request Factory Snapshot

Endpoint: `POST /api/v1/cems-wpms-requests/measurement-points`, `POST /api/v1/cems-wpms-requests/parameters`, `PUT /api/v1/cems-wpms-requests/:id/form`, `GET /api/v1/cems-wpms-requests/:id`

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

### `operator-factories[].officerNotificationEmails`

Source:

- `GET /api/v1/cems-wpms-requests/operator-factories`
- factory location from `factories` joined with `provinces` and `industrial_estates`
- email master table `officer_notification_email_recipients`

Logic:

- Backend derives `industrialAreaType` from `industrialEstateCode` or `industrialEstateName`.
- If `industrialAreaType = INDUSTRIAL_ESTATE`, backend returns the `INDUSTRIAL_ESTATE` email row from `officer_notification_email_recipients`.
- If the factory is outside an industrial estate, backend looks up the `PROVINCE` row by `provinceName`.
- If no matching row exists, backend returns an empty array instead of guessing an email address.

Reason:

- The request form needs officer notification recipients attached to the selected factory without hardcoding province/IEAT email rules in the frontend.
- Keeping the email list in a table lets officers update province recipients through a future admin/data migration path.

Risk:

- Province names must match the master value returned by the factory query.
- Provinces not present in the seeded source image currently return `[]` until the table is updated.
- Email addresses are seeded from the provided spreadsheet screenshots and should be corrected in DB if an office changes mailbox.

### `industryMainOrderLabel`

Source:

- request payload `industryMainOrderLabel`
- stored `cems_wpms_request_factory_snapshots.factory_main_type_label`

Logic:

- API keeps the machine filter code in `industryMainOrder`.
- API stores and returns the display description separately as `industryMainOrderLabel`.

Reason:

- Frontend needs dropdown display like `08802 - ประเภทโรงงานลำดับที่ 88(2): การผลิตพลังงานไฟฟ้าจากพลังงานความร้อน` while filtering by stable code `08802`.

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

## KWP Form Submission Detail Attachment URLs

Endpoint:

- `GET /api/v1/kwp-form-submissions/kwp01/:id`
- `GET /api/v1/kwp-form-submissions/kwp02/:id`
- `GET /api/v1/kwp-form-submissions/kwp04/:id`

Code:

- `backend/src/modules/kwp-form-submissions/kwp-form-submissions.repository.ts`
- `backend/src/modules/kwp-form-submissions/kwp-form-attachments.service.ts`
- `backend/src/modules/kwp-form-submissions/kwp-form-submissions.controller.ts`

### `measurementItems[].attachments[].fileUrl`

Source:

- `kwp_form_attachments.storage_path`
- `PUBLIC_BASE_URL` when configured
- request protocol/host when `PUBLIC_BASE_URL` is not configured
- `UPLOAD_PUBLIC_PATH`

Logic:

- The database stores the file location in `storage_path`, for example `kwp/form-attachments/2026/07/13-lab-report.pdf`.
- The detail API returns `fileUrl` only when `storage_path` is present.
- `fileUrl` is built as `<baseUrl><UPLOAD_PUBLIC_PATH>/<encoded storage_path>`.
- `baseUrl` comes from `PUBLIC_BASE_URL`; if that env value is empty, the controller derives it from the incoming request protocol and host.
- If `storage_path` is already stored with a leading slash or starts with `UPLOAD_PUBLIC_PATH`, the helper strips that prefix before building the public URL to avoid duplicated paths such as `/uploads/uploads/...`.
- Path parts are URL-encoded before joining.

Reason:

- Frontend detail pages need a direct URL to preview/download uploaded evidence while the database remains storage-backend neutral.

Risk:

- If `PUBLIC_BASE_URL`, reverse-proxy headers, or `UPLOAD_PUBLIC_PATH` are misconfigured, the returned URL can point to the wrong host/path even though the stored file exists.

## BOD/COD Deviation Attachment URLs

Endpoint:

- `POST /api/v1/bod-cod-deviation-reports/attachments`
- `GET /api/v1/bod-cod-deviation-reports/:id`

### `attachments[].fileUrl`

Source:

- `bod_cod_deviation_attachments.storage_path`
- `PUBLIC_BASE_URL` when configured
- request protocol/host when `PUBLIC_BASE_URL` is not configured
- `UPLOAD_PUBLIC_PATH`

Logic:

- The upload API stores the file under `UPLOAD_DIR/bod-cod/deviation-attachments/YYYY/MM/<uuid>.<ext>` and returns `storagePath` plus `fileUrl`.
- The database stores the file location in `storage_path`, for example `bod-cod/deviation-attachments/2026/07/lab-report.pdf`.
- The detail API returns `fileUrl` only when `storage_path` is present and the request context provides a public base URL and public upload path.
- `fileUrl` is built as `<baseUrl><UPLOAD_PUBLIC_PATH>/<encoded storage_path>`.
- If `storage_path` is already stored with a leading slash or starts with `UPLOAD_PUBLIC_PATH`, the shared helper strips that prefix before building the public URL to avoid duplicated paths such as `/uploads/uploads/...`.

Reason:

- BOD/COD detail pages need a direct URL to preview/download uploaded sample photos, device photos, and lab reports while the database remains storage-backend neutral.

Risk:

- Existing BOD/COD attachment rows that were created before the upload API may have `storage_path = null`; those rows cannot produce `fileUrl` until the file is uploaded again and the returned metadata is saved.
- If `PUBLIC_BASE_URL`, reverse-proxy headers, or `UPLOAD_PUBLIC_PATH` are misconfigured, the returned URL can point to the wrong host/path even though the stored file exists.

## KWP Form Workflow Step Fields

Endpoint:

- `GET /api/v1/kwp-form-submissions/:id/workflow`
- `POST /api/v1/kwp-form-submissions/:id/workflow-actions`

Code:

- `backend/src/modules/kwp-form-submissions/kwp-form-submissions.repository.ts`
- `backend/src/modules/kwp-form-submissions/kwp-form-submissions.validator.ts`
- `backend/src/modules/kwp-form-submissions/kwp-form-submissions.controller.ts`

### `form` / `statusLabel` / `reviewedAt` / `currentStep` / `steps` / `allowedActions` / `revisionReason`

Source:

- `kwp_form_submissions.form_type`
- `kwp_form_submissions.status`
- `kwp_form_submissions.officer_note`
- `kwp_form_submissions.reviewed_at`
- `kwp_form_status_history.status`
- `kwp_form_status_history.note`

Logic:

- `form` maps `form_type` to the Thai display form number: `KWP01` -> `กวภ.01`, `KWP02` -> `กวภ.02`, `KWP03` -> `กวภ.03`, `KWP04` -> `กวภ.04`, and `KWP05` -> `กวภ.05`.
- `statusLabel` maps the machine status to the Thai display label used by KWP tables.
- `reviewedAt` returns `kwp_form_submissions.reviewed_at` as an ISO timestamp. If the database value is `null`, the response returns `null`; if the value cannot be parsed as a date, the response returns the raw string value.
- `steps` is derived from the current status and always returns the backend-owned sequence: `SUBMITTED` and `REVISION_REQUESTED`. `APPROVED` is a terminal status, not a progress step.
- `currentStep` is the first step whose derived step status is `CURRENT`.
- `allowedActions` is derived from the current status and caller scope:
  - Officer scopes with `SUBMITTED` return `REQUEST_REVISION` and `APPROVE`.
  - Officer scopes with `REVISION_REQUESTED` return `APPROVE`.
  - Operator scope `OWN_FACTORY` with `REVISION_REQUESTED` returns `RESUBMIT`.
  - Operator scope `OWN_FACTORY` with `SUBMITTED` returns an empty array.
  - terminal or unsupported statuses return an empty array.
- `revisionReason` returns the latest `kwp_form_status_history.note` whose status is `REVISION_REQUESTED`; if the workflow never requested revision or that history row has no note, the response returns `null`.
- `POST /workflow-actions` also inserts each transition into `kwp_form_status_history` with the action note.

Fallback order:

- `form`: mapped from `form_type`; no fallback is used because `form_type` is constrained by the database to `KWP01`-`KWP05`.
- `statusLabel`: mapped from `status`; no fallback is used because `status` is constrained by the database status set.
- `reviewedAt`: ISO date conversion, then raw string if parsing fails, then `null` when the source is `null`.
- `currentStep`: first `steps[]` item with `status = CURRENT`, then the first step in the generated step list, then a defensive pending `SUBMITTED` step if the generated list is unexpectedly empty.
- `steps`: derived from the current status plus whether `kwp_form_status_history` contains any `REVISION_REQUESTED` row. When a revision happened and the current status later returns to `APPROVED`, the `REVISION_REQUESTED` step is marked `DONE` instead of `SKIPPED`.
- `allowedActions`: derived from current status and caller scope; unsupported statuses fall back to an empty array.
- `revisionReason`: latest revision-request history note, then `null`.

Reason:

- Frontend must show the same step workflow for กวภ.01-05 without inferring action availability from Thai labels.
- The revision note follows the same pattern as the CEMS/WPMS connection request workflow: a required reason is captured when the officer sends a request back for correction.

Risk:

- `kwp_form_submissions.officer_note` stores the latest officer note only. Full historical notes must be read from `kwp_form_status_history`.

## Officer Connection Request Eligible Factory Fields

Endpoint:

- `GET /api/v1/cems-wpms-requests/eligible-factories`

Code:

- `backend/src/modules/connection-requests/connection-requests.controller.ts`
- `backend/src/modules/connection-requests/connection-requests.service.ts`
- `backend/src/modules/eligible-factories/eligible-factories.service.ts`
- `backend/src/modules/eligible-factories/eligible-factories.repository.ts`

### Operator-table-compatible factory fields

Source:

- `eligible_factories.id`
- `eligible_factories.factory_registration_no_new`
- `eligible_factories.factory_registration_no_old`
- `eligible_factories.factory_name`
- `eligible_factories.factory_type_sequence`
- `eligible_factories.address`
- `eligible_factories.latitude`
- `eligible_factories.longitude`
- `eligible_factories.province_name`
- `eligible_factories.industrial_estate_name`
- `eligible_factories.business_activity`
- `eligible_factories.has_eia`
- `cems_wpms_connected_measurement_points` for current POMS monitoring point counts
- `provinces.name_th`
- `provinces.region`
- `officer_notification_email_recipients` via `connectionRequestsRepository.listOfficerNotificationEmailsForFactories`

Logic:

- `factoryId` and `newRegistrationNo` both return `factory_registration_no_new` so the officer form can use the same identifier shape as `/cems-wpms-requests/operator-factories`.
- `oldRegistrationNo` returns `null` when the old registration value is the same as `factory_registration_no_new`; otherwise it returns the old registration value exposed by the eligible factory DTO.
- `industryMainOrder` and `industrySubOrder` come from splitting `factory_type_sequence` through the eligible factory service mapping.
- `industryType` mirrors `businessActivity` because the selected eligible factory data has business activity text but no separate industry-type label.
- `eia` maps `has_eia`: `true` -> `มี`, `false` -> `ไม่มี`, and `null` -> `null`.
- `latitude` and `longitude` are stringified when present to match the existing operator factory table response.
- `officerNotificationEmails` are looked up by factory id, province, and whether `industrialEstateName` is present.
- `monitoringPointCount` counts current POMS monitoring points from `cems_wpms_connected_measurement_points` after applying the optional `systemType` filter.
- `requestStatusCode` is always `null` because this endpoint is a factory-reference endpoint for filling a new/officer-side form, not a request workflow listing.
- `status` is always `แสดง` and `eligibilityStatus` is always `เข้าข่าย` because only non-deleted selected eligible factories are returned.
- Permission scope filtering happens before the response mapping:
  - `ALL` returns all selected eligible factories.
  - `IN_REGION` uses `eligible_factories.province_name -> provinces.name_th -> provinces.region` and keeps only matching regions.
  - `IN_PROVINCE` keeps only matching `eligible_factories.province_name`.
  - `regionalAccess.regions` applies an additional region allow-list using the same province-region lookup.

Fallback order:

- `factoryId` / `newRegistrationNo`: `factory_registration_no_new`.
- `oldRegistrationNo`: distinct old registration value, then `null`.
- `industryType`: `businessActivity`, then `null`.
- `eia`: boolean mapping from `has_eia`, then `null`.
- `officerNotificationEmails`: email lookup result, then an empty array.
- `monitoringPointCount`: filtered current POMS monitoring points, then `0`.
- `requestStatusCode`: always `null`.
- `permission scope`: exact province match for `IN_PROVINCE`; exact region match after province lookup for `IN_REGION`; no fallback to broader access when the required province/region is missing.

Reason:

- The officer connection-request page needs the same table contract as the operator factory list, but its source is the selected eligible factory data imported from the old/DIW source so officers can start filling forms for any eligible factory.
- Officer-visible results must respect the same location-bound permission model as other officer connection-request views.

Risk:

- `industryType` is not a dedicated DIW industry label in this response; it intentionally mirrors `businessActivity` until a separate source field is added.
- `oldRegistrationNo` depends on the selected eligible factory DTO. If that DTO omits the old registration value, the response returns `null` even when the database has an old registration column.
- `systemType` filtering depends on current POMS monitoring points. Eligible factories without matching connected/current POMS points are excluded when `systemType` is provided.
- Region filtering depends on `provinces.name_th` matching `eligible_factories.province_name`; mismatched province spelling can hide a row for region-scoped users.

## CEMS/WPMS measurement criteria ranges

Applies to:

- `POST /api/v1/cems-wpms-requests/measurement-points`
- `POST /api/v1/cems-wpms-requests/parameters`
- `PUT /api/v1/cems-wpms-requests/:id/form`
- create/resubmit flows sharing `measurementCriteriaSchema`

Source:

- `measurementPoints[].measurementInstruments.parameters[].standardCriteria.standardValue`
- `measurementPoints[].measurementInstruments.parameters[].eiaCriteria.standardValue`

Logic:

- For finite positive numeric standard `S`, derive `normal = { min: 0, max: 0.8S }`, `warning = { min: 0.8S, max: S }`, and `critical = { min: S, max: null }`.
- MIN is an exclusive lower boundary and MAX is an inclusive upper boundary.
- Floating-point noise is reduced with 15 significant digits.
- Numeric client rows are overwritten by the canonical derived rows.

Fallback order:

1. Derive from a valid numeric `standardValue`.
2. Retain complete three-level rows for legacy non-numeric standards.
3. Normalize disabled empty criteria to `{ enabled: false, standardValue: null, rows: [] }`.

Numeric-looking zero, negative, overflow, or subnormal values that cannot produce a distinct 80% interval are rejected. Unsupported `enabled` coercions are rejected; only booleans and legacy strings `"true"`/`"false"` are normalized.

Reason:

- Frontend displays the surveillance boundary immediately while backend prevents inconsistent or tampered ranges from being persisted.

Risk:

- Existing numeric criteria with custom rows are canonicalized on their next write.
- The JSON does not encode inclusive/exclusive operators; consumers must follow this documented boundary meaning.
