# Frontend Handoff: รายการคำขอข้อมูลพื้นฐาน และงาน DCON เดิม

เอกสารนี้บันทึกความต้องการจาก frontend เพื่อส่งต่อให้ backend ไม่ใช่ canonical API contract การอัปเดตครั้งนี้แก้เฉพาะเอกสาร ไม่ได้แก้โค้ด frontend หรือ backend

## สถานะและขอบเขตงาน

| งาน | สถานะ | ขอบเขตรอบนี้ |
| --- | --- | --- |
| ตัวเลือก DCON ใน dialog ตั้งค่าอุปกรณ์ (เนื้อหาเดิม) | แก้แล้ว ตามที่ผู้ใช้แจ้ง | เก็บไว้เป็นประวัติ ไม่ต้องแก้ซ้ำ |
| API รายการคำขอแก้ไขข้อมูลพื้นฐานแบบข้อมูลสรุป (เพิ่มใหม่) | รอ backend รองรับ | ให้แก้เฉพาะงานใหม่ในหัวข้อถัดไป |

สถานะงาน DCON มีผลตรวจโค้ดและ deployment ประกอบตามหัวข้องานเดิมด้านล่าง แต่ยังไม่ได้ทดสอบการบันทึกผ่าน API จริงหรืออุปกรณ์จริงเพิ่มเติมในรอบนี้

## งานใหม่: ข้อมูลสรุปตารางรายการคำขอแก้ไขข้อมูลพื้นฐาน

อ้างอิง canonical API: [โรงงานและคำขอแก้ไขข้อมูลในระบบ POMS](../../docs/backend/api/menus/master-data/factory-edit-requests.md)

### ปัญหาที่พบ

คำขอ `point-00024/2569` (`id: 48`) ส่ง `connectedPointId: 10021` ซึ่งเป็น CEMS / S0915 ถูกต้อง แต่ list response คืน snapshot ของโรงงานทั้งสองระบบ โดย WPMS / P0155 (`connectedPointId: 10024`) อยู่ลำดับแรก และ CEMS / S0915 อยู่ลำดับที่สอง

เมื่อเทียบ snapshot ด้วย ID พบว่า WPMS ไม่เปลี่ยน ส่วน CEMS มีข้อมูลเปลี่ยน และ `currentContacts.systemType` / `proposedContacts.systemType` เป็น `CEMS` แต่ frontend เดิมอ่าน `proposedMeasurementPoints[0]` มาใส่คอลัมน์ จึงแสดง WPMS / P0155 ผิด ไม่ใช่หลักฐานว่าคำขอนี้ถูกเปลี่ยนเป็น WPMS

### สิ่งที่ต้องการจาก Backend

ปรับ `GET /api/v1/poms-factories/edit-requests` ให้คืนข้อมูลสรุปสำหรับตารางและการเลือกคำขอ แยกจากข้อมูลรายละเอียด โดยหนึ่งรายการยังหมายถึงหนึ่งคำขอ ไม่แยกเป็นหลายแถวตามจำนวนจุด

| ข้อมูลที่ frontend ต้องใช้ | Field ที่เสนอ | การใช้งาน |
| --- | --- | --- |
| ID คำขอ | `id` | เรียก API เปิดดู ดำเนินการ แก้ไข หรือยกเลิก |
| เลขที่คำขอ | `requestNo` | คอลัมน์เลขที่คำขอ |
| เลขทะเบียนโรงงานใหม่ | `factoryId` | คอลัมน์เลขทะเบียนโรงงาน ไม่ใช้เลขทะเบียนเดิมแทน |
| ชื่อโรงงาน | `factoryName` | คอลัมน์ชื่อโรงงาน/บริษัท |
| จังหวัด | `provinceName` | แสดงได้โดยไม่ต้องโหลดรายละเอียดโรงงานเพิ่ม |
| ประเภทแบบฟอร์ม | `formType` | `BASIC_INFO` หรือ `MEASUREMENT_POINTS` |
| สถานะและข้อความ | `status`, `statusLabel` | แสดงสถานะและใช้เงื่อนไขปุ่มเดิม |
| วันที่ยื่นคำขอ | `submittedAt` | ISO 8601; frontend แสดงเฉพาะวันที่เป็นปี พ.ศ. |
| จุดเป้าหมายของคำขอ | `targetMeasurementPoints[]` | ข้อมูลสรุปเฉพาะจุดที่คำขออ้างถึง ไม่ใช่ทุกจุดของโรงงาน |
| ตัวตนและข้อมูลแสดงผลของแต่ละจุด | `connectedPointId`, `systemType`, `pointCode`, `pointName` ภายใน array | แสดงประเภท/รหัสจุด และรองรับชื่อหรือรหัสซ้ำ; `pointCode` เป็น `null` ได้ |

`targetMeasurementPoints` เป็นชื่อเสนอเพื่อแยกจาก snapshot ให้ชัดเจน ให้ backend ยืนยันชื่อ field และสัญญาสุดท้ายใน canonical docs ก่อน frontend เชื่อมต่อ

### กติกาของจุดเป้าหมาย

- ยึด `measurementPoints[].connectedPointId` ที่ผู้ใช้ส่งใน create/resubmission เป็นหลัก และระบุจุดนั้นในข้อมูลสรุป แม้ส่งค่าเดิมหรือแก้เฉพาะอีเมล/ข้อมูลติดต่อ
- ห้ามเลือกจุดแรกของโรงงาน ห้ามจับคู่ด้วยชื่อหรือลำดับ array และไม่ให้ frontend เดาเป้าหมายจากความแตกต่างของ current/proposed snapshots
- `systemType`, `pointCode`, `pointName` ต้องสอดคล้องกับ ID เป้าหมายของคำขอนั้น ไม่เปลี่ยนไปใช้จุดอื่นเมื่อข้อมูลโรงงานปัจจุบันเปลี่ยน
- ถ้ามีหลายจุดเป้าหมาย ให้คืนครบใน array ไม่ตัดเหลือจุดแรก และไม่ดึงจุดที่ไม่ได้ส่งมารวม
- `BASIC_INFO` ไม่มีจุดเป้าหมายรายจุด ให้คืน `targetMeasurementPoints: []`; frontend แสดงคอลัมน์ประเภท/รหัสจุดเป็น `-`
- คำขอเก่าที่ไม่มีหลักฐานจุดเป้าหมาย ให้ backend ประเมินการกู้ข้อมูลจากหลักฐานที่มี หากระบุไม่ได้ให้ตกลงรูปแบบข้อมูลที่ระบุว่าไม่ทราบ ห้ามเลือกจุดแรกหรือแต่ง ID ขึ้นแทน

### ข้อมูลที่ไม่ต้องส่งใน List

ไม่ส่ง `currentFactory`, `proposedFactory`, `currentMeasurementPoints`, `proposedMeasurementPoints`, `currentContacts`, `proposedContacts`, รายละเอียดเครื่องมือตรวจวัด, metadata เอกสาร, contact arrays และ `events` มากับทุกแถวของ list

ข้อมูลเหล่านี้ยังต้องอยู่ใน `GET /api/v1/poms-factories/edit-requests/:id` ตามสัญญาเดิม สำหรับเปิดดู ดำเนินการ เปรียบเทียบข้อมูล เอกสารแนบ และประวัติสถานะ ห้ามตัดข้อมูลออกจาก detail API ตามไปด้วย

### ตัวอย่างเฉพาะข้อมูลจุดเป้าหมายที่ต้องได้ในเคสนี้

ตัวอย่างต่อไปนี้เป็นส่วนหนึ่งของ row ที่เสนอ ไม่ใช่ response เต็มหรือสัญญาที่ deploy แล้ว:

```json
{
  "id": 48,
  "requestNo": "point-00024/2569",
  "factoryId": "91090100125393",
  "formType": "MEASUREMENT_POINTS",
  "status": "PENDING_REVIEW",
  "statusLabel": "รอพิจารณา",
  "targetMeasurementPoints": [
    {
      "connectedPointId": 10021,
      "systemType": "CEMS",
      "pointCode": "S0915",
      "pointName": "Unit 4500 (Waste Gas)"
    }
  ]
}
```

### API และการเชื่อมต่อที่ได้รับผลกระทบ

| Endpoint | ผลกระทบที่ต้องพิจารณา |
| --- | --- |
| `GET /api/v1/poms-factories/edit-requests` | เปลี่ยน response เป็นข้อมูลสรุป พร้อมจุดเป้าหมายที่ถูกต้อง; คง filter, สิทธิ์, data scope และ envelope เดิม |
| `POST /api/v1/poms-factories/:factoryId/edit-requests` | ต้องรักษาหลักฐาน ID เป้าหมายจาก payload เพื่อสร้างข้อมูลสรุปที่เชื่อถือได้ ไม่จำเป็นต้องเพิ่ม field ที่ frontend ส่ง |
| `PUT /api/v1/poms-factories/edit-requests/:id/resubmission` | ข้อมูลสรุปต้องสอดคล้องกับจุดเป้าหมายของรอบแก้ไขล่าสุด โดยรักษาประวัติคำขอเดิม |
| `GET /api/v1/poms-factories/edit-requests/:id` | คงรายละเอียดและ snapshots ครบเหมือนเดิม ใช้เมื่อเปิดดู/ดำเนินการ |
| `GET /api/v1/poms-factories/edit-requests/:id/form` | คง prefill และ `connectedPointId` ตามสัญญาเดิม ไม่ใช้ list summary แทนข้อมูลเติมฟอร์ม |

การนำ snapshot fields ออกจาก list เป็น breaking response change สำหรับ frontend ปัจจุบัน ต้องประสานปรับ `mapEditRequestRows` ให้ใช้ข้อมูลสรุปก่อนตัด field เดิม หรือปล่อย backend/frontend แบบประสานกัน งาน frontend ส่วนนี้ยังไม่ได้แก้ในรอบเอกสารนี้

ให้ backend ปรับ canonical docs, runtime OpenAPI, tests และบันทึก breaking change ใน [API CHANGELOG](../../docs/backend/api/CHANGELOG.md) พร้อมวิธีย้าย client โดยคงพฤติกรรม detail/form และเงื่อนไขสิทธิ์เดิม

### เกณฑ์ตรวจรับงานใหม่

- เคส `point-00024/2569` แสดง CEMS / S0915 / 10021 ไม่ใช่ WPMS / P0155 / 10024
- มีหลายระบบ หลายจุด ชื่อซ้ำ รหัสว่าง หรือสลับลำดับ snapshot แล้วข้อมูลสรุปยังถูกต้อง
- ส่งค่าเดิม แก้เฉพาะอีเมล/ข้อมูลติดต่อ และ resubmit แล้วยังระบุจุดเป้าหมายได้จากหลักฐานคำขอ
- คำขอหลายจุดคืนครบทุกจุดเป้าหมาย; `BASIC_INFO` ไม่เลือกจุดของโรงงานมาแสดงเอง
- List ไม่มีข้อมูลรายละเอียดขนาดใหญ่ที่ไม่ใช้ในตาราง และไม่ต้องเรียก detail แยกทีละแถวเพื่อเติมคอลัมน์
- เปิดดู/ดำเนินการยังเรียก detail แล้วได้ข้อมูลก่อน–หลัง เอกสารและประวัติครบ แก้ไขคำขอยังเติมฟอร์มผ่าน `/form` ได้

## งานเดิม: DCON (แก้แล้ว ไม่ต้องแก้ซ้ำ)

เนื้อหาต่อไปนี้คงไว้เป็นประวัติของงานที่แก้แล้ว ไม่ใช่งานค้างในรอบนี้ เอกสาร API ที่เกี่ยวข้อง: [การตั้งค่าอุปกรณ์](../../docs/backend/api/menus/connection-requests/device-configs.md) และ [จุดตรวจวัดที่เชื่อมต่อแล้ว](../../docs/backend/api/shared/connected-measurement-points/README.md)

### ผลตรวจการรองรับ DCON

- Backend ใน commit `50d1d1d` มี validator, การบันทึก/คืน config, form prefill, migration และ OpenAPI source สำหรับ `DCON_ASCII` แล้ว ดู [สัญญา DCON และ implementation](../../docs/backend/api/menus/connection-requests/device-configs.md#dcon-device-address)
- ตรวจ `npm run typecheck` ผ่าน และชุดทดสอบ backend ที่เกี่ยวข้อง 8 suites ผ่าน 295 tests ครอบคลุม validator, service, routes ของคำขอและจุดที่เชื่อมต่อแล้ว, integration config, migration และ OpenAPI
- [Deployment ของ backend DCON](https://github.com/Nongten1010/POMS-app/actions/runs/35354260055) สำเร็จ รวมขั้นตอน database migrations และ backend health check; ระบบเป้าหมายอื่นต้องรัน migration `0122_allow_dcon_ascii_device_protocol` ก่อนใช้งาน
- ตรวจ [OpenAPI บน production](https://d-poms.diw.go.th/api/v1/openapi.json) พบ `DCON_ASCII` ใน `DeviceConnectionConfig`, `StructuredDeviceConnectionDevice` และ `IntegrationDeviceConfig`
- ยังต้องตรวจการบันทึก/โหลดกลับผ่าน API จริงและการรับค่าจากอุปกรณ์จริง การรองรับ config นี้ไม่ได้เพิ่ม driver DCON

### สิ่งที่เปลี่ยนใน Frontend

- Dropdown อุปกรณ์เรียงเป็น `Modbus RTU`, `Modbus TCP`, `DCON`, `Microsoft SQL`, `MySQL`, `POMS Box`
- เลือก `DCON` แล้วส่ง `protocol: "DCON_ASCII"` ไม่ส่ง `"DCON"` เป็น protocol
- ช่องรายละเอียดของ DCON เหมือน Modbus RTU แต่เปลี่ยน label `Slave ID` เป็น `device address` เฉพาะ DCON
- ค่าของช่อง `device address` ยังใช้ `settings.slaveId` ไม่มี field ใหม่ชื่อ `deviceAddress`
- โหลด protocol `DCON_ASCII` กลับมาแล้วแสดงตัวเลือก `DCON` พร้อมเติมค่าที่บันทึกไว้ รองรับทั้ง `connectionForms` และ raw config ตามรูปแบบเดิม
- แปลง parity `EVEN`, `ODD`, `NONE` กลับเป็นตัวเลือก `Even`, `Odd`, `None` สำหรับฟอร์ม serial และแปลงกลับเป็น code เดิมเมื่อบันทึก
- ไม่เปลี่ยนสิทธิ์ สถานะคำขอ ตารางพารามิเตอร์ รูปแบบ channels หรือ status-management schedules ไม่เพิ่ม endpoint ใหม่ และไม่เปลี่ยน PDF ในงานนี้

### API ที่ได้รับผลกระทบโดยตรง

| Method / Endpoint | สิ่งที่ frontend ต้องใช้ |
| --- | --- |
| `GET /api/v1/cems-wpms-requests/:id/device-configs?stationId=:stationId` | โหลด DCON ของคำขอ พร้อม protocol และ settings ครบถ้วน เพื่อเปิดแก้ไขและ refresh หลังบันทึก |
| `POST /api/v1/cems-wpms-requests/:id/device-configs` | รับ `DCON_ASCII` ทั้ง payload อุปกรณ์เดียว และ `config.device[]` เมื่อมีหลายอุปกรณ์ |
| `GET /api/v1/connected-measurement-points/:stationId/device-configs` | โหลด DCON ของจุดที่เชื่อมต่อแล้ว โดยไม่เปลี่ยนเป็น protocol อื่นหรือทำ settings หาย |
| `POST /api/v1/connected-measurement-points/:stationId/device-configs` | รองรับ `DCON_ASCII` ใน `config.device[]` สำหรับแทนที่การตั้งค่าปัจจุบัน รวมถึงกรณีมีหลาย protocol ในชุดเดียวกัน |

หาก endpoint รายละเอียดอื่นคืน config ชุดเดียวกัน ให้รักษา `DCON_ASCII` และ settings เช่นเดียวกัน ไม่ต้องเปลี่ยน URL หรือเพิ่ม query parameter เพื่อเลือก DCON

### Field Mapping ที่ Frontend ส่ง

ชื่อ field และรูปแบบค่าคงเหมือน Modbus RTU:

| Label | Field ใน settings | ค่าที่ frontend ส่ง |
| --- | --- | --- |
| COMPORT | `comPort` | number หรือ string เช่น `3` / `"COM3"`; ว่างเป็น `null` |
| device address | `slaveId` | number; ว่างเป็น `null` |
| Baud Rate | `baudRate` | number; ว่างเป็น `null` |
| Parity | `parity` | `EVEN`, `ODD`, `NONE`; ว่างเป็น `null` |
| Stop bits | `stopBits` | number; ว่างเป็น `null` |
| Data bits | `dataBits` | number; ว่างเป็น `null` |
| ช่วงข้อมูลตรวจวัด Min | `valueRange.min` | number หรือ `null`; ต้องรักษาค่า `0` |
| ช่วงข้อมูลตรวจวัด Max | `valueRange.max` | number หรือ `null` |
| Quantity | `quantity` | number; ว่างเป็น `null` |

หาก Min และ Max ว่างทั้งคู่ frontend ส่ง `valueRange: null` ช่องรายละเอียดไม่ได้เพิ่มกติกาบังคับกรอกใหม่ ส่วน `channels[].addressId` เป็นคนละ field กับ `settings.slaveId` และไม่เปลี่ยนชื่อหรือกติกาในงานนี้

### ตัวอย่าง Payload จาก Frontend

ตัวอย่างเป็นข้อมูลสมมติสำหรับอธิบายรูปแบบ ไม่ใช่ค่าที่แนะนำให้ใช้กับอุปกรณ์จริง

อุปกรณ์เดียวในคำขอ ผ่าน `POST /api/v1/cems-wpms-requests/:id/device-configs`:

```json
{
  "stationId": "S2001",
  "deviceCode": "DCON001",
  "protocol": "DCON_ASCII",
  "settings": {
    "comPort": "COM3",
    "slaveId": 7,
    "baudRate": 9600,
    "parity": "NONE",
    "stopBits": 1,
    "dataBits": 8,
    "quantity": 2,
    "valueRange": { "min": 0, "max": 200 }
  },
  "channels": [],
  "statusManagement": { "schedules": [] }
}
```

จุดที่เชื่อมต่อแล้ว หรือคำขอที่มีหลายอุปกรณ์ ใช้ wrapper เดิมดังนี้ โดย `config.device` ใส่ได้หลายรายการ รวมถึง protocol อื่นร่วมกับ DCON:

```json
{
  "config": {
    "stationId": "S2001",
    "device": [
      {
        "deviceCode": "DCON001",
        "protocol": "DCON_ASCII",
        "settings": {
          "comPort": "COM3",
          "slaveId": 7,
          "baudRate": 9600,
          "parity": "NONE",
          "stopBits": 1,
          "dataBits": 8,
          "quantity": 2,
          "valueRange": { "min": 0, "max": 200 }
        }
      }
    ],
    "channels": [],
    "statusManagement": { "schedules": [] }
  }
}
```

`channels` และ schedules ในตัวอย่างว่างเพื่อแสดงส่วนที่เกี่ยวข้องกับ DCON เท่านั้น การใช้งานจริงส่งค่าจากตารางตามรูปแบบเดิม ไม่ได้ล้างข้อมูลสองส่วนนี้โดยอัตโนมัติ

### ข้อกำหนด Backend ของงานเดิม (แก้แล้ว)

1. เพิ่ม `DCON_ASCII` ใน protocol ที่รับ บันทึก และคืนได้ รวมถึง validator, serializer, schema/ข้อจำกัดฐานข้อมูล และตัวแปลง config ที่เกี่ยวข้องตามโครงสร้างจริงของ backend
2. รองรับ settings ตามตารางข้างต้น โดย `slaveId` หมายถึง device address สำหรับ DCON ไม่เปลี่ยน key และไม่แปลง DCON เป็น Modbus RTU เพียงเพราะใช้ช่องกรอกเหมือนกัน
3. คืน protocol และค่าที่บันทึกให้ frontend เปิดแก้ไขได้โดยไม่สูญหาย รวมถึง `null`, ช่วงค่าที่มี `0`, channels, schedules และอุปกรณ์อื่นในชุดเดียวกัน
4. หากใช้ `connectionForms` สำหรับเติมฟอร์ม ให้คืนชนิดที่ frontend แปลงกลับได้ (`DCON_ASCII` หรือ label `DCON`) ส่วน protocol ใน config ใช้ `DCON_ASCII`
5. อัปเดต canonical docs, runtime OpenAPI และ tests สำหรับทั้งสองกลุ่ม endpoint ก่อนแจ้งว่า API รองรับแล้ว

### Flow ที่เกี่ยวข้อง แต่ Payload ไม่เปลี่ยน

- `GET /api/v1/parameter-values/connection-test?stationId=:stationId`: ปุ่มทดสอบยังส่งเพียงรหัสจุด ไม่ส่ง protocol หรือ settings โดยตรง ทีม backend/ระบบรับข้อมูลต้องตรวจเส้นทางอ่านข้อมูลของ DCON หากต้องการให้มีค่าทดสอบจริง การเพิ่ม dropdown ฝั่ง frontend ไม่ใช่การเพิ่ม driver DCON
- `POST /api/v1/cems-wpms-requests/:id/confirm-connection`: ยังใช้ `{ "action": "CONFIRM", "note": "ตั้งค่าอุปกรณ์และทดสอบแล้ว" }` เดิม โดย frontend บันทึก config และโหลดกลับให้สำเร็จก่อนเรียกยืนยัน จึงต้องไม่ติด validation ของ protocol ใหม่

### การตรวจรับงานเดิม

- DCON อยู่ต่อจาก Modbus TCP และแสดงช่องเหมือน RTU โดยไม่มี Host IP หรือช่องฐานข้อมูล
- เปลี่ยนค่า `device address` แล้ว payload เปลี่ยนเฉพาะ `settings.slaveId` ไม่มี `deviceAddress`
- บันทึกและโหลดกลับทั้งแบบอุปกรณ์เดียว หลายอุปกรณ์ และจุดที่เชื่อมต่อแล้ว ได้ `DCON_ASCII` และค่าเดิมครบ
- Modbus RTU/TCP ยังคง label `Slave ID` และ protocol เดิม; Microsoft SQL, MySQL และ POMS Box ไม่เปลี่ยน
- Frontend มี automated tests ตรวจ dropdown, label/state, mapping, payload และ response prefill ด้วยข้อมูลจำลอง ยังไม่ได้ยืนยันการบันทึก DCON ผ่าน API จริงหรือการรับค่าจากอุปกรณ์จริง
