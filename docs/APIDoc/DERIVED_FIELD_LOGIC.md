# Derived Field Logic

เอกสารนี้ใช้บันทึก field ที่ API ไม่ได้ส่ง raw DB ตรง ๆ แต่มีการตีความ แปลงค่า fallback หรือรวมค่าจากหลาย field ก่อนส่งออก

กติกา:

- ถ้าเพิ่มหรือแก้ logic ที่ไม่ได้เป็น raw DB ตรง ๆ ต้องอัปเดตไฟล์นี้ใน change เดียวกัน
- ระบุ source table/field, logic ที่ใช้, เหตุผล, และข้อควรระวัง
- ถ้า logic เป็นเพียง fallback ชั่วคราว ให้เขียนไว้ชัดเจนว่า fallback จากอะไรไปอะไร
- ถ้าไม่แน่ใจว่า field ควรตีความอย่างไร ให้หยุดที่ raw value และถามก่อน

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

- `dbo.fac_import.DISPFACREG`
- fallback `dbo.fac_import.FACREG`
- `dbo.FACCLASS.CLASS` join ด้วย `FID`
- fallback `dbo.fac_import.CLASS`

Logic:

- ใช้เลขลำดับหลังประเภทโรงงานจาก `DISPFACREG` ก่อน เช่น `3-1-2/17ลป` -> `002`
- ถ้า `DISPFACREG` ไม่มีรูปแบบที่อ่านได้ ให้ใช้ตำแหน่งที่ 7-9 จาก `FACREG` หลังตัดอักขระที่ไม่ใช่ตัวเลข เช่น `00100300217ลป` -> `002`
- ถ้าทะเบียนอ่านไม่ได้ ให้ดึงรายการ `CLASS` ทั้งหมดของ `FID` จาก `dbo.FACCLASS`, เอาเลข 3 หลักท้ายของแต่ละ `CLASS`, ตัดค่าที่ซ้ำกับประเภทหลักออก, และ join ด้วย comma
- ถ้ายังไม่มีค่า ให้ fallback เป็นเลข 3 หลักท้ายจาก `dbo.fac_import.CLASS`
- ไม่ใช้ `fac_import.FACTYPE`
- ไม่ใช้ `fac_import.EXPSEQ`

Example:

```text
DISPFACREG = 3-1-2/17ลป
FACREG = 00100300217ลป
fac_import.CLASS = 00100
FACCLASS.CLASS = 00100

factoryClass = 0100
factorySubclass = 002
```

```text
DISPFACREG = 3-1-1/19นน
FACREG = 00100300119นน
fac_import.CLASS = 00100
FACCLASS.CLASS = 00100, 00201

factoryClass = 0100
factorySubclass = 001
```

Risk:

- ถ้า `DISPFACREG` และ `FACREG` ผิดรูปแบบ ระบบจะ fallback ไป `FACCLASS`/`fac_import.CLASS`
- `EXPSEQ = 0` ใน `fac_import` ไม่ได้หมายความว่าประเภทรองคือ `000`

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
