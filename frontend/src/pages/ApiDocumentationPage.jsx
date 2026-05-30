import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

const accessTokenExample = "Bearer <accessToken>";

const userResponseExample = {
  username: "string",
  fullName: "string",
  department: "string",
  lineNameTh: "string",
  levelNameTh: "string",
  roles: "diw_central",
  isActive: true,
};

const permissionsResponseExample = {
  dashboard: {
    data: "ALL",
    view: true,
    favorite: true,
    search: true,
    advanced_search: true,
    statistics: true,
    export: true,
  },
  conditional_search: {
    data: null,
    view: true,
  },
  statistics: {
    data: "ALL",
    view: true,
  },
  factories: {
    data: "ALL",
    view: true,
    edit: true,
    approve: true,
  },
  connection: {
    data: "ALL",
    view: true,
    edit: true,
    approve: true,
  },
  kwp_forms: {
    data: "ALL",
    view: true,
    edit: true,
    approve: true,
  },
  bod_cod_errors: {
    data: "ALL",
    view: true,
    edit: true,
    approve: true,
  },
  notifications: {
    data: "ALL",
    view: true,
    view_status: true,
    edit: true,
    approve: true,
  },
  helpdesk: {
    data: "ALL",
    view: true,
  },
  feedback: {
    data: "ALL",
    view: true,
  },
  laws: {
    data: "ALL",
    view: true,
    edit: true,
  },
  faq: {
    data: "ALL",
    view: true,
    edit: true,
  },
  chat: {
    data: "ALL",
    view: true,
    edit: true,
  },
  permissions: {
    data: "ALL",
    view: true,
  },
  eligible_factories: {
    data: "ALL",
    view: true,
  },
  api_documentation: {
    data: "ALL",
    view: true,
  },
};

const loginResponseExample = {
  accessToken: "string",
  user: userResponseExample,
  permissions: permissionsResponseExample,
};

const meResponseExample = {
  user: userResponseExample,
  permissions: permissionsResponseExample,
};

const usersListResponseExample = {
  success: true,
  data: [
    {
      id: 2,
      username: "officer_kpm",
      fullName: "สมหญิง รักษ์สิ่งแวดล้อม",
      department: "กรมโรงงานอุตสาหกรรม",
      lineNameTh: "นักวิทยาศาสตร์",
      levelNameTh: "ชำนาญการ",
      roles: "monitoring_kpm",
      isActive: true,
    },
    {
      id: 3,
      username: "officer_sng",
      fullName: "ธีระ จังหวัดงาน",
      department: "สำนักงานอุตสาหกรรมจังหวัดสระบุรี",
      lineNameTh: "นักวิชาการอุตสาหกรรม",
      levelNameTh: "ชำนาญการ",
      roles: "provincial_office",
      isActive: true,
    },
  ],
  meta: {
    total: 2,
  },
};

const createUserRequestExample = {
  fullName: "ชื่อ-นามสกุล",
  username: "Username",
  password: "Password",
  department: "สังกัด",
  lineNameTh: "ตำแหน่ง",
  levelNameTh: "ระดับ",
  roles: "monitoring_kpm",
  isActive: true,
};

const createUserResponseExample = {
  success: true,
};

const userDetailResponseExample = {
  user: {
    username: "1100000000001",
    fullName: "นางสมหญิง รักษ์สิ่งแวดล้อม",
    department: "กรมโรงงานอุตสาหกรรม",
    lineNameTh: "นักวิทยาศาสตร์",
    levelNameTh: "ชำนาญการ",
    roles: "monitoring_kpm",
    isActive: true,
    source: "api",
  },
  permissions: {
    dashboard: {
      data: "ALL",
      view: true,
      favorite: true,
      search: true,
      advanced_search: true,
      statistics: true,
    },
    conditional_search: {
      data: null,
      view: true,
    },
    statistics: {
      data: "ALL",
      view: true,
    },
    factories: {
      data: "ALL",
      view: true,
      edit: true,
      approve: true,
    },
    connection: {
      data: "ALL",
      view: true,
      edit: true,
      approve: true,
    },
    kwp_forms: {
      data: "ALL",
      view: true,
      edit: true,
      approve: true,
    },
    bod_cod_errors: {
      data: "ALL",
      view: true,
      edit: true,
      approve: true,
    },
    notifications: {
      data: "ALL",
      view: true,
    },
    helpdesk: {
      data: null,
      view: true,
    },
    feedback: {
      data: null,
      view: true,
    },
    laws: {
      data: null,
      view: true,
    },
    faq: {
      data: null,
      view: true,
    },
    chat: {
      data: null,
      view: true,
      edit: true,
    },
  },
};

const updateUserRequestExample = {
  user: {
    username: "frontend",
    fullName: "ภาณุ เล้าสุวรรณ",
    department: null,
    lineNameTh: "Develop",
    levelNameTh: "Frontend",
    roles: "admin",
    isActive: true,
    password: "Password",
    source: "created",
  },
  permissions: {
    dashboard: {
      data: "ALL",
      view: true,
      favorite: true,
      search: true,
      advanced_search: true,
      statistics: true,
      export: true,
    },
    conditional_search: {
      data: "ALL",
      view: true,
    },
    statistics: {
      data: "ALL",
      view: true,
    },
    factories: {
      data: "ALL",
      view: true,
      edit: true,
      approve: true,
    },
    connection: {
      data: "ALL",
      view: true,
      edit: true,
      approve: true,
    },
    kwp_forms: {
      data: "ALL",
      view: true,
      edit: true,
      approve: true,
    },
    bod_cod_errors: {
      data: "ALL",
      view: true,
      edit: true,
      approve: true,
    },
    notifications: {
      data: "ALL",
      view: true,
      view_status: true,
      edit: true,
      approve: true,
    },
    helpdesk: {
      data: "ALL",
      view: true,
    },
    feedback: {
      data: "ALL",
      view: true,
    },
    laws: {
      data: "ALL",
      view: true,
      edit: true,
    },
    faq: {
      data: "ALL",
      view: true,
      edit: true,
    },
    chat: {
      data: "ALL",
      view: true,
      edit: true,
    },
    permissions: {
      data: "ALL",
      view: true,
    },
    eligible_factories: {
      data: "ALL",
      view: true,
    },
    api_documentation: {
      data: "ALL",
      view: true,
    },
  },
};

const updateUserResponseExample = {
  success: true,
};

const deleteUserResponseExample = {
  success: true,
};

const eligibleFactoryExample = {
  id: 1,
  factoryName: "ห้างหุ้นส่วนสามัญ สถานีบ่มใบยาสบหนอง",
  factoryId: "10550000125197",
  factoryRegistrationNo: "3-1-1/19นน",
  factoryClass: null,
  factorySubclass: null,
  address: "189 หมู่ 10 ถนนวรนคร",
  provinceName: "น่าน",
  industrialEstateName: null,
  longitude: 0,
  latitude: 0,
  businessActivity: "บ่มใบยาสูบ",
  operationStatus: "แจ้งประกอบแล้ว",
  capitalAmount: null,
  machineryHorsepower: null,
  productionCapacity: "0",
  wastewaterDischargeInfo: null,
  boilerCount: null,
  boilerSizeEach: null,
  fuelUsed: null,
  hasEia: null,
};

const eligibleFactoryCandidateExample = {
  factoryName: "ห้างหุ้นส่วนจำกัด สมุทรรีไซเคิล 00001 จำกัด",
  factoryId: "mock-factory-000001",
  factoryRegistrationNo: "3-002-02/51สป",
  factoryClass: "หลัก",
  factorySubclass: null,
  address: "2/1 หมู่ 2",
  provinceName: "สมุทรปราการ",
  industrialEstateName: "นิคมอุตสาหกรรมบางปู",
  longitude: 100.6280124,
  latitude: 13.5383181,
  businessActivity: "หลอมและรีไซเคิลโลหะ",
  operationStatus: "หยุดประกอบกิจการชั่วคราว",
  capitalAmount: 1001250,
  machineryHorsepower: 51,
  productionCapacity: "11 ตัน/วัน",
  wastewaterDischargeInfo: "มีการระบายน้ำทิ้งออกนอกโรงงาน",
  boilerCount: 2,
  boilerSizeEach: "6 ตัน/ชั่วโมง",
  fuelUsed: "น้ำมันเตา",
  hasEia: false,
};

const eligibleFactoryCandidatesResponseExample = {
  success: true,
  data: [eligibleFactoryCandidateExample],
  meta: {
    total: 60000,
    source: "mock",
  },
};

const eligibleFactoriesListResponseExample = {
  success: true,
  data: [eligibleFactoryExample],
  meta: {
    total: 1,
  },
};

const createEligibleFactoryRequestExample = {
  factoryName: "ห้างหุ้นส่วนจำกัด โรงกลึงก๊กกวง",
  factoryId: "10100302325234",
  factoryRegistrationNo: "3-64(6)-45/17",
  factoryClass: "1",
  factorySubclass: "3",
  address: "50/10-11-12 ซอยบรมบรรพต ถนนบริพัตร",
  provinceName: "กรุงเทพมหานคร",
  industrialEstateName: null,
  longitude: null,
  latitude: null,
  businessActivity: "ทำผลิตภัณฑ์โลหะต่าง ๆ",
  operationStatus: "แจ้งประกอบแล้ว",
  capitalAmount: 1825000,
  machineryHorsepower: 75,
  productionCapacity: null,
  wastewaterDischargeInfo: null,
  boilerCount: null,
  boilerSizeEach: null,
  fuelUsed: null,
  hasEia: null,
};

const createEligibleFactoryResponseExample = {
  success: true,
};

const deleteEligibleFactoryResponseExample = {
  success: true,
};

const eligibleFactoryFieldRows = [
  [
    "id",
    "number",
    "รหัสรายการโรงงานที่เข้าข่าย ใช้กับ DELETE /eligible-factories/:id",
  ],
  ["factoryName", "string", "ชื่อโรงงาน"],
  ["factoryId", "string", "เลขทะเบียนโรงงานแบบใหม่"],
  ["factoryRegistrationNo", "string", "เลขทะเบียนโรงงานแบบเดิม"],
  ["factoryClass", "string|null", "ลำดับประเภทโรงงานหลัก"],
  ["factorySubclass", "string|null", "ลำดับประเภทโรงงานรอง"],
  ["address", "string|null", "สถานที่ตั้ง"],
  ["provinceName", "string|null", "จังหวัด"],
  ["industrialEstateName", "string|null", "นิคมอุตสาหกรรม"],
  ["longitude", "number|null", "ลองจิจูด"],
  ["latitude", "number|null", "ละติจูด"],
  ["businessActivity", "string|null", "การประกอบกิจการ"],
  ["operationStatus", "string|null", "สถานะการประกอบกิจการ"],
  ["capitalAmount", "number|null", "เงินทุน"],
  ["machineryHorsepower", "number|null", "แรงม้าเครื่องจักร"],
  ["productionCapacity", "string|null", "กำลังการผลิต"],
  [
    "wastewaterDischargeInfo",
    "string|null",
    "ข้อมูลการระบายน้ำทิ้งออกนอกโรงงาน",
  ],
  ["boilerCount", "number|null", "จำนวนหม้อน้ำ"],
  ["boilerSizeEach", "string|null", "ขนาดของหม้อน้ำแต่ละลูก"],
  ["fuelUsed", "string|null", "เชื้อเพลิงที่ใช้"],
  ["hasEia", "boolean|null", "ข้อมูล EIA"],
];

const connectionRequestFormExample = {
  factoryId: "factory-001",
  factoryName: "บริษัท ทดสอบ จำกัด",
  factoryRegistrationNo: "3-106-33/50สบ",
  systemType: "CEMS",
  contactName: "สมชาย ใจดี",
  contactPhone: "0812345678",
  contactEmail: "ops@example.com",
  measurementPoints: [
    {
      pointName: "ปล่องระบาย A",
      pointCode: "STACK-A",
      pointType: "STACK",
      latitude: 13.7563,
      longitude: 100.5018,
      parameters: ["NOx", "SO2", "PM"],
      description: "จุดตรวจวัดหลัก",
      details: {
        stackShape: "วงกลม",
        stackDiameter: 1.2,
        stackHeight: 30,
        monitoringHeight: 20,
        averageFlowRate: 1200,
        primaryFuel: "ก๊าซธรรมชาติ",
        connectionDevice: "POMS Box (กรอ.)",
      },
      documentsAndImages: [
        {
          title: "ภาพถ่ายปล่อง",
          fileName: "stack.png",
          fileUrl: "https://example.com/files/stack.png",
          fileType: "image/png",
          fileSize: 1024,
        },
      ],
      measurementInstruments: {
        converterBrand: "Converter Brand",
        converterModel: "CV-100",
        parameters: [
          {
            parameter: "NOx",
            technique: "NDIR",
            range: "0-200",
            brand: "Siemens",
            supplier: "ABC Tech",
            eiaStandard: "120",
            standardCondition: true,
            dryBasis: true,
            oxygenOrExcessAir: true,
          },
        ],
      },
    },
  ],
  remarks: "ขอเพิ่มจุดตรวจวัด",
};

const addParameterRequestExample = {
  ...connectionRequestFormExample,
  measurementPoints: [
    {
      pointName: "ปล่องระบาย A",
      pointCode: "STACK-A",
      pointType: "STACK",
      parameters: ["CO"],
      description: "เพิ่มพารามิเตอร์ CO ให้จุดตรวจวัดเดิม",
      measurementInstruments: {
        converterBrand: "Converter Brand",
        converterModel: "CV-100",
        parameters: [
          {
            parameter: "CO",
            technique: "NDIR",
            range: "0-100",
            brand: "Siemens",
            supplier: "ABC Tech",
            eiaStandard: "50",
            standardCondition: true,
            dryBasis: true,
            oxygenOrExcessAir: true,
          },
        ],
      },
    },
  ],
  remarks: "ขอเพิ่มพารามิเตอร์",
};

const connectionStatusRequestExample = {
  action: "APPROVE_FORM",
  officerNote: "แบบถูกต้อง",
};

const deviceConfigRequestExample = {
  stationId: "STACK-A",
  protocol: "MODBUS_TCP",
  settings: {
    hostIp: "192.168.1.10",
    slaveId: 1,
    port: 502,
  },
  channels: [
    {
      addressId: 40001,
      dataType: "NOx",
      unit: "ppm",
      valueRange: { min: 0, max: 200 },
      valueFormat: "MEASUREMENT_VALUE",
      offset: 0,
      encoding: "UNSIGNED16_BIG_ENDIAN",
    },
  ],
  statusManagement: {
    selectedParameters: ["ทั้งหมด"],
    startAt: null,
    endAt: null,
    status: "Normal",
    schedules: [],
  },
};

const connectionRequestExample = {
  id: 1,
  requestNo: "CR-20260530-0001",
  requestType: "ADD_MEASUREMENT_POINT",
  requestTypeLabel: "เพิ่มจุดตรวจวัด",
  factoryId: "factory-001",
  factoryName: "บริษัท ทดสอบ จำกัด",
  factoryRegistrationNo: "3-106-33/50สบ",
  systemType: "CEMS",
  status: "PENDING_DESIGN_REVIEW",
  statusLabel: "รอพิจารณาแบบ",
  contactName: "สมชาย ใจดี",
  contactPhone: "0812345678",
  contactEmail: "ops@example.com",
  remarks: "ขอเพิ่มจุดตรวจวัด",
  measurementPoints: connectionRequestFormExample.measurementPoints.map(
    (point, index) => ({
      id: index + 1,
      ...point,
    }),
  ),
  statusHistory: [
    {
      id: 1,
      status: "PENDING_DESIGN_REVIEW",
      statusLabel: "รอพิจารณาแบบ",
      note: "ผู้ประกอบการส่งฟอร์ม",
      changedBy: 42,
      changedAt: "2026-05-30T10:00:00.000Z",
    },
  ],
  createdBy: 42,
  createdAt: "2026-05-30T10:00:00.000Z",
  updatedAt: "2026-05-30T10:00:00.000Z",
};

const connectionRequestResponseExample = {
  success: true,
  data: connectionRequestExample,
};

const connectionRequestTableRowsResponseExample = {
  success: true,
  data: [
    {
      id: 1,
      factoryId: "factory-001",
      factoryName: "บริษัท ทดสอบ จำกัด",
      industryType: "ผลิตเคมีภัณฑ์",
      province: "สระบุรี",
      type: "CEMS",
      requestNo: "CR-20260530-0001",
      submittedAt: "2026-05-30T10:00:00.000Z",
      submittedDate: "30/05/2569",
      monitoringPointCode: "STACK-A",
      codeIssuedAt: "2026-05-30T10:05:00.000Z",
      codeIssuedDate: "30/05/2569",
      form: "เพิ่มจุดตรวจวัด",
      status: "รอเชื่อมต่อ",
      statusCode: "WAITING_CONNECTION",
      requestType: "ADD_MEASUREMENT_POINT",
    },
  ],
  meta: { total: 1 },
};

const operatorFactoriesResponseExample = {
  success: true,
  data: [
    {
      id: 1,
      factoryId: "factory-001",
      factoryName: "บริษัท ทดสอบ จำกัด",
      newRegistrationNo: "3-106-33/50สบ",
      oldRegistrationNo: null,
      industryType: "ผลิตเคมีภัณฑ์",
      province: "สระบุรี",
      monitoringPointCount: 1,
      requestStatus: "เชื่อมต่อแล้ว",
      requestStatusCode: "CONNECTED",
      status: "แสดง",
    },
  ],
  meta: { total: 1 },
};

const connectionRequestDetailResponseExample = {
  success: true,
  data: {
    ...connectionRequestExample,
    factory: operatorFactoriesResponseExample.data[0],
    deviceConfigs: [
      {
        id: 10,
        requestId: 1,
        stationId: "STACK-A",
        protocol: "MODBUS_TCP",
        settings: {
          hostIp: "192.168.1.10",
          slaveId: 1,
          port: 502,
        },
        channels: deviceConfigRequestExample.channels,
        statusManagement: deviceConfigRequestExample.statusManagement,
      },
    ],
  },
};

const connectedMeasurementPointsResponseExample = {
  success: true,
  data: [
    {
      id: 1,
      requestId: 1,
      requestNo: "CR-20260530-0001",
      factory: operatorFactoriesResponseExample.data[0],
      type: "CEMS",
      status: "เชื่อมต่อแล้ว",
      statusCode: "CONNECTED",
      connectedAt: "2026-05-30T10:30:00.000Z",
      point: connectionRequestExample.measurementPoints[0],
      deviceConfigs: connectionRequestDetailResponseExample.data.deviceConfigs,
    },
  ],
  meta: { total: 1 },
};

const deviceConfigFormDetailResponseExample = {
  success: true,
  data: {
    requestId: 1,
    requestNo: "CR-20260530-0001",
    stationId: "STACK-A",
    monitoringPoint: connectionRequestExample.measurementPoints[0],
    parameterOptions: ["NOx", "SO2", "O2"],
    deviceCodeOptions: ["STACK-A/01"],
    connectionForms: [
      {
        id: 10,
        configId: 10,
        type: "Modbus TCP",
        deviceCode: "STACK-A/01",
        values: {
          slaveId: "1",
          hostIp: "192.168.1.10",
          port: "502",
        },
      },
    ],
    statusManagement: {
      selectedParameters: ["ทั้งหมด"],
      startAt: null,
      endAt: null,
      status: "Normal",
      schedules: [],
    },
    parameterMappings: [
      {
        configId: 10,
        deviceCode: "STACK-A/01",
        addressId: "40001",
        parameter: "NOx",
        unit: "ppm",
        min: "0",
        max: "200",
        valueFormat: "ค่าข้อมูลตรวจวัด",
        offset: "0",
        encodingData: "Unsigned16 - Big Endian",
        status: "Normal",
      },
    ],
    testResults: [],
    rawConfigs: connectionRequestDetailResponseExample.data.deviceConfigs,
  },
};

const connectionRequestFieldRows = [
  ["factoryId", "string", "รหัสโรงงานหรือ fid"],
  ["factoryName", "string", "ชื่อโรงงาน"],
  ["factoryRegistrationNo", "string", "เลขทะเบียนโรงงาน"],
  ["systemType", "CEMS|WPMS", "ประเภทระบบ"],
  ["contactName", "string", "ชื่อผู้ติดต่อ"],
  ["contactPhone", "string", "เบอร์โทรผู้ติดต่อ"],
  ["contactEmail", "string|null", "อีเมลผู้ติดต่อ"],
  ["measurementPoints", "array", "รายการจุดตรวจวัด"],
  ["measurementPoints[].pointName", "string", "ชื่อจุดตรวจวัด"],
  ["measurementPoints[].pointCode", "string|null", "รหัสจุดตรวจวัด"],
  [
    "measurementPoints[].pointType",
    "STACK|WASTEWATER|OTHER",
    "ประเภทจุดตรวจวัด",
  ],
  ["measurementPoints[].parameters", "string[]", "รายการพารามิเตอร์"],
  [
    "measurementPoints[].details",
    "object|null",
    "รายละเอียดจุดตรวจวัด: required สำหรับฟอร์มเพิ่มจุดตรวจวัด",
  ],
  [
    "measurementPoints[].documentsAndImages",
    "array",
    "เอกสารและรูปภาพ: required สำหรับฟอร์มเพิ่มจุดตรวจวัด",
  ],
  [
    "measurementPoints[].measurementInstruments",
    "object|null",
    "รายละเอียดเครื่องมือตรวจวัด: required สำหรับฟอร์มเพิ่มจุดตรวจวัดและเพิ่มพารามิเตอร์",
  ],
];

const connectionRequestTableFieldRows = [
  ["factoryName", "string", "ชื่อโรงงาน/บริษัท"],
  ["industryType", "string|null", "ประเภทอุตสาหกรรม"],
  ["province", "string|null", "จังหวัด"],
  ["type", "CEMS|WPMS", "ประเภทจุดตรวจวัด"],
  ["requestNo", "string", "เลขที่คำขอ"],
  ["submittedDate", "string", "วันที่ยื่นคำขอ รูปแบบ dd/mm/yyyy พ.ศ."],
  ["monitoringPointCode", "string|null", "รหัสจุดตรวจวัด"],
  ["codeIssuedDate", "string|null", "วันที่ออกรหัส"],
  ["form", "string", "ชื่อแบบฟอร์ม"],
  ["status", "string", "สถานะภาษาไทย"],
  ["statusCode", "string", "สถานะสำหรับ logic"],
];

const authDictionarySections = [
  {
    title: "User Types",
    columns: ["Label", "Value"],
    rows: [
      ["เจ้าหน้าที่", "officer"],
      ["ผู้ประกอบการ", "operator"],
      ["ประชาชนทั่วไป", "citizen"],
    ],
  },
  {
    title: "Department IDs",
    columns: ["Label", "Value"],
    rows: [
      ["สำนักงานปลัดกระทรวงอุตสาหกรรม", "1"],
      ["กรมโรงงานอุตสาหกรรม", "2"],
      ["การนิคมแห่งประเทศไทย", "8"],
      ["หน่วยงานอื่นๆ", "0"],
    ],
  },
  {
    title: "User Response Fields",
    columns: ["Field", "Type", "Description"],
    rows: [
      ["user.username", "string", "ชื่อผู้ใช้งาน"],
      ["user.fullName", "string", "ชื่อ-นามสกุล"],
      ["user.department", "string", "หน่วยงาน"],
      ["user.lineNameTh", "string", "สายงานภาษาไทย"],
      ["user.levelNameTh", "string", "ระดับภาษาไทย"],
      ["user.roles", "string", "บทบาทผู้ใช้งานตาม Role Codes"],
      ["user.isActive", "boolean", "สถานะการใช้งาน"],
    ],
  },
  {
    title: "Role Codes",
    columns: ["Code", "nameTh", "nameEn", "ใช้กับ UI"],
    rows: [
      [
        "public_anonymous",
        "ประชาชน ไม่ login",
        "Public Anonymous",
        "public/no auth เท่านั้น",
      ],
      ["public_user", "ประชาชน login", "Public Logged-in", "citizen login"],
      [
        "factory_operator",
        "โรงงาน (ผู้ประกอบการ)",
        "Factory Operator",
        "ผู้ประกอบการ/โรงงาน",
      ],
      ["diw_central", "กรอ.", "DIW Central", "เจ้าหน้าที่ กรอ. ส่วนกลาง"],
      [
        "provincial_office",
        "สอจ.",
        "Provincial Industrial Office",
        "สำนักงานอุตสาหกรรมจังหวัด",
      ],
      ["industrial_estate", "กนอ.", "Industrial Estate Authority", "การนิคมฯ"],
      [
        "monitoring_kpm",
        "เจ้าหน้าที่ศูนย์เฝ้า (กฝม.)",
        "Pollution Monitoring (KPM)",
        "เจ้าหน้าที่ กฝม.",
      ],
      [
        "monitoring_5_centers",
        "เจ้าหน้าที่ศูนย์เฝ้า (5 ศูนย์)",
        "Regional Centers (5)",
        "เจ้าหน้าที่ 5 ศูนย์ภูมิภาค",
      ],
      ["center_director", "ผอ.ศูนย์", "Center Director", "ผู้อำนวยการศูนย์"],
      ["kpm_director", "ผอ.กฝม.", "KPM Director", "ผู้อำนวยการ กฝม."],
      ["kwp_director", "ผอ.กวภ.", "KWP Director", "ผู้อำนวยการ กวภ."],
      ["admin", "Admin", "Administrator", "ผู้ดูแลระบบ"],
    ],
  },
  {
    title: "Permission Data Scope",
    columns: ["Value", "Description"],
    rows: [
      ["ALL", "เห็นข้อมูลทั้งหมด"],
      ["IN_PROVINCE", "เห็นข้อมูลในจังหวัดที่เกี่ยวข้อง"],
      ["IN_ESTATE", "เห็นข้อมูลในนิคมอุตสาหกรรมที่เกี่ยวข้อง"],
      ["OWN_FACTORY", "เห็นเฉพาะข้อมูลโรงงานของตนเอง"],
      ["null", "ไม่อนุญาต"],
    ],
  },
  {
    title: "Permission Keys",
    columns: ["Module", "Actions"],
    rows: [
      [
        "dashboard",
        "data, view, favorite, search, advanced_search, statistics, export",
      ],
      ["conditional_search", "data, view"],
      ["statistics", "data, view"],
      ["factories", "data, view, edit, approve"],
      ["connection", "data, view, edit, approve"],
      ["kwp_forms", "data, view, edit, approve"],
      ["bod_cod_errors", "data, view, edit, approve"],
      ["notifications", "data, view, view_status, edit, approve"],
      ["helpdesk", "data, view"],
      ["feedback", "data, view"],
      ["laws", "data, view, edit"],
      ["faq", "data, view, edit"],
      ["chat", "data, view, edit"],
      ["permissions", "data, view"],
      ["eligible_factories", "data, view"],
      ["api_documentation", "data, view"],
    ],
  },
];

const apiCategories = [
  {
    name: "Authentication",
    endpoints: [
      {
        id: "auth-login",
        method: "POST",
        path: "/auth/login",
        url: "http://d-poms.diw.go.th/api/v1/auth/login",
        testUrl: "/api-proxy/v1/auth/login",
        description: "เข้าสู่ระบบสำหรับเจ้าหน้าที่หรือผู้ใช้งานตามประเภทบัญชี",
        defaultHeaders: {},
        defaultBody: {
          userType: "officer",
          username: "citizenID-or-UID",
          password: "password",
          departmentID: "2",
        },
        bodyFields: [
          {
            name: "userType",
            type: "string",
            required: true,
            example: "officer, operator, citizen",
          },
          {
            name: "username",
            type: "string",
            required: true,
            example: "1234567890123, U1234",
          },
          {
            name: "password",
            type: "string",
            required: true,
            example: "demo1234",
          },
          {
            name: "departmentID",
            type: "string",
            required: "เฉพาะเจ้าหน้าที่",
            example: "1, 2, 8, 0",
          },
        ],
        responseExample: loginResponseExample,
        dataDictionaries: [
          {
            title: "Request Body",
            columns: ["Field", "Type", "Required", "Description"],
            rows: [
              [
                "userType",
                "string",
                "Yes",
                "ประเภทผู้ใช้งาน: officer, operator, citizen",
              ],
              ["username", "string", "Yes", "เลขบัตรประชาชน หรือ UID"],
              ["password", "string", "Yes", "รหัสผ่าน"],
              [
                "departmentID",
                "string",
                "Required when userType = officer",
                "รหัสหน่วยงานสำหรับเจ้าหน้าที่",
              ],
            ],
          },
          {
            title: "Login Response Fields",
            columns: ["Field", "Type", "Description"],
            rows: [
              [
                "accessToken",
                "string",
                "Token สำหรับส่งใน Authorization header ของ API ที่ต้อง login",
              ],
              ["user", "object", "ข้อมูลผู้ใช้งาน"],
              ["permissions", "object", "สิทธิ์การใช้งานตาม module/action"],
            ],
          },
          ...authDictionarySections,
        ],
      },
      {
        id: "auth-me",
        method: "GET",
        path: "/auth/me",
        url: "http://d-poms.diw.go.th/api/v1/auth/me",
        testUrl: "/api-proxy/v1/auth/me",
        description: "ดึงข้อมูลผู้ใช้งานปัจจุบันจาก access token",
        defaultHeaders: {
          Authorization: accessTokenExample,
        },
        headerFields: [
          {
            name: "Authorization",
            type: "string",
            required: true,
            example: accessTokenExample,
          },
        ],
        responseExample: meResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Response Fields",
            columns: ["Field", "Type", "Description"],
            rows: [
              ["user", "object", "ข้อมูลผู้ใช้งาน"],
              ["permissions", "object", "สิทธิ์การใช้งานตาม module/action"],
            ],
          },
          ...authDictionarySections.slice(2),
        ],
      },
    ],
  },
  {
    name: "Users",
    endpoints: [
      {
        id: "users-create",
        method: "POST",
        path: "/users/local-accounts",
        url: "http://d-poms.diw.go.th/api/v1/users/local-accounts",
        testUrl: "/api-proxy/v1/users/local-accounts",
        description: "เพิ่มผู้ใช้งานจาก dialog เพิ่มผู้ใช้งาน",
        defaultHeaders: {
          Authorization: accessTokenExample,
        },
        defaultBody: createUserRequestExample,
        headerFields: [
          {
            name: "Authorization",
            type: "string",
            required: true,
            example: accessTokenExample,
          },
        ],
        bodyFields: [
          {
            name: "fullName",
            type: "string",
            required: true,
            example: "ชื่อ-นามสกุล",
          },
          {
            name: "username",
            type: "string",
            required: true,
            example: "Username",
          },
          {
            name: "password",
            type: "string",
            required: true,
            example: "Password อย่างน้อย 8 ตัวอักษร",
          },
          {
            name: "department",
            type: "string",
            required: false,
            example: "สังกัด",
          },
          {
            name: "lineNameTh",
            type: "string",
            required: false,
            example: "ตำแหน่ง",
          },
          {
            name: "levelNameTh",
            type: "string",
            required: false,
            example: "ระดับ",
          },
          {
            name: "roles",
            type: "string",
            required: true,
            example: "monitoring_kpm",
          },
          {
            name: "isActive",
            type: "boolean",
            required: true,
            example: "true, false",
          },
        ],
        responseExample: createUserResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Request Body",
            columns: ["Field", "Type", "Required", "Description"],
            rows: [
              ["fullName", "string", "Yes", "ชื่อ-นามสกุล"],
              ["username", "string", "Yes", "Username"],
              ["password", "string", "Yes", "Password อย่างน้อย 8 ตัวอักษร"],
              ["department", "string", "No", "สังกัด"],
              ["lineNameTh", "string", "No", "ตำแหน่ง"],
              ["levelNameTh", "string", "No", "ระดับ"],
              [
                "roles",
                "string",
                "Yes",
                "สิทธิ์ในระบบ ใช้ role code จาก Role Codes",
              ],
              [
                "isActive",
                "boolean",
                "Yes",
                "true = ใช้งาน, false = ระงับใช้งาน",
              ],
            ],
          },
          authDictionarySections[3],
        ],
      },
      {
        id: "users-list-officers",
        method: "GET",
        path: "/users?status=all",
        url: "http://d-poms.diw.go.th/api/v1/users?status=all",
        testUrl: "/api-proxy/v1/users?status=all",
        description: "ดึงรายชื่อเจ้าหน้าที่ในระบบสำหรับหน้าสิทธิ์การใช้งาน",
        defaultHeaders: {
          Authorization: accessTokenExample,
        },
        headerFields: [
          {
            name: "Authorization",
            type: "string",
            required: true,
            example: accessTokenExample,
          },
        ],
        responseExample: usersListResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Query Parameters",
            columns: ["Field", "Type", "Required", "Description"],
            rows: [
              ["status", "string", "No", "สถานะผู้ใช้งาน ในหน้านี้ใช้ all"],
            ],
          },
          {
            title: "User List Fields",
            columns: ["Field", "Type", "Description"],
            rows: [
              ["id", "number", "รหัสผู้ใช้งาน"],
              ["username", "string", "ชื่อผู้ใช้งาน"],
              ["fullName", "string", "ชื่อ-นามสกุล"],
              ["department", "string", "หน่วยงาน"],
              ["lineNameTh", "string", "ตำแหน่ง/สายงานภาษาไทย"],
              ["levelNameTh", "string", "ระดับภาษาไทย"],
              [
                "roles",
                "string",
                "role code ของผู้ใช้งาน ใช้เทียบ nameTh จาก Role Codes",
              ],
              ["isActive", "boolean", "สถานะการใช้งาน"],
              ["meta.total", "number", "จำนวนข้อมูลทั้งหมด"],
            ],
          },
          authDictionarySections[3],
        ],
      },
      {
        id: "users-detail",
        method: "GET",
        path: "/users/<id>",
        url: "http://d-poms.diw.go.th/api/v1/users/<id>",
        testUrl: "/api-proxy/v1/users/2",
        description:
          "ดึงข้อมูลผู้ใช้งานและ permissions สำหรับ dialog แก้ไขสิทธิ์การใช้งาน",
        defaultHeaders: {
          Authorization: accessTokenExample,
        },
        headerFields: [
          {
            name: "Authorization",
            type: "string",
            required: true,
            example: accessTokenExample,
          },
        ],
        responseExample: userDetailResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Path Parameters",
            columns: ["Field", "Type", "Required", "Description"],
            rows: [["id", "number|string", "Yes", "รหัสผู้ใช้งาน"]],
          },
          {
            title: "User Detail Fields",
            columns: ["Field", "Type", "Description"],
            rows: [
              ["user.username", "string", "ชื่อผู้ใช้งาน"],
              ["user.fullName", "string", "ชื่อ-นามสกุล"],
              ["user.department", "string", "หน่วยงาน"],
              ["user.lineNameTh", "string", "ตำแหน่ง/สายงานภาษาไทย"],
              ["user.levelNameTh", "string", "ระดับภาษาไทย"],
              [
                "user.roles",
                "string",
                "role code ของผู้ใช้งาน ใช้เทียบ nameTh จาก Role Codes",
              ],
              ["user.isActive", "boolean", "สถานะการใช้งาน"],
              ["user.source", "string", "แหล่งที่มา: api, created"],
              [
                "permissions",
                "object",
                "สิทธิ์การใช้งานตาม module/action สำหรับ map ลงฟอร์ม",
              ],
            ],
          },
          {
            title: "User Source Values",
            columns: ["Value", "Description"],
            rows: [
              ["api", "ข้อมูลมาจาก API"],
              ["created", "ข้อมูลถูกสร้างในระบบ"],
            ],
          },
          authDictionarySections[3],
          authDictionarySections[4],
          authDictionarySections[5],
        ],
      },
      {
        id: "users-update",
        method: "PATCH",
        path: "/users/:id",
        url: "http://d-poms.diw.go.th/api/v1/users/:id",
        testUrl: "/api-proxy/v1/users/2",
        description: "บันทึกข้อมูลจาก dialog แก้ไขสิทธิ์การใช้งาน",
        defaultHeaders: {
          Authorization: accessTokenExample,
        },
        defaultBody: updateUserRequestExample,
        headerFields: [
          {
            name: "Authorization",
            type: "string",
            required: true,
            example: accessTokenExample,
          },
        ],
        bodyFields: [
          {
            name: "user",
            type: "object",
            required: true,
            example: "ข้อมูลผู้ใช้งาน",
          },
          {
            name: "user.username",
            type: "string",
            required: true,
            example: "frontend",
          },
          {
            name: "user.fullName",
            type: "string",
            required: true,
            example: "ภาณุ เล้าสุวรรณ",
          },
          {
            name: "user.department",
            type: "string|null",
            required: false,
            example: "null, กรมโรงงานอุตสาหกรรม",
          },
          {
            name: "user.lineNameTh",
            type: "string|null",
            required: false,
            example: "Develop",
          },
          {
            name: "user.levelNameTh",
            type: "string|null",
            required: false,
            example: "Frontend",
          },
          {
            name: "user.roles",
            type: "string",
            required: true,
            example: "admin",
          },
          {
            name: "user.isActive",
            type: "boolean",
            required: true,
            example: "true, false",
          },
          {
            name: "user.password",
            type: "string",
            required: true,
            example: "Password",
          },
          {
            name: "user.source",
            type: "string",
            required: true,
            example: "api, created",
          },
          {
            name: "permissions",
            type: "object",
            required: true,
            example: "สิทธิ์การใช้งานตาม module/action",
          },
        ],
        responseExample: updateUserResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Path Parameters",
            columns: ["Field", "Type", "Required", "Description"],
            rows: [["id", "number|string", "Yes", "รหัสผู้ใช้งาน"]],
          },
          {
            title: "Request Body",
            columns: ["Field", "Type", "Required", "Description"],
            rows: [
              ["user", "object", "Yes", "ข้อมูลผู้ใช้งาน"],
              ["user.username", "string", "Yes", "Username"],
              ["user.fullName", "string", "Yes", "ชื่อ-นามสกุล"],
              ["user.department", "string|null", "No", "สังกัด"],
              ["user.lineNameTh", "string|null", "No", "ตำแหน่ง"],
              ["user.levelNameTh", "string|null", "No", "ระดับ"],
              [
                "user.roles",
                "string",
                "Yes",
                "สิทธิ์ในระบบ ใช้ role code จาก Role Codes",
              ],
              [
                "user.isActive",
                "boolean",
                "Yes",
                "true = ใช้งาน, false = ระงับใช้งาน",
              ],
              ["user.password", "string", "Yes", "Password"],
              ["user.source", "string", "Yes", "แหล่งที่มา: api, created"],
              [
                "permissions",
                "object",
                "Yes",
                "สิทธิ์การใช้งานตาม module/action",
              ],
            ],
          },
          authDictionarySections[3],
          authDictionarySections[4],
          authDictionarySections[5],
        ],
      },
      {
        id: "users-delete",
        method: "DELETE",
        path: "/users/:id",
        url: "http://d-poms.diw.go.th/api/v1/users/:id",
        testUrl: "/api-proxy/v1/users/2",
        description: "ลบผู้ใช้งานจากหน้าสิทธิ์การใช้งาน",
        defaultHeaders: {
          Authorization: accessTokenExample,
        },
        headerFields: [
          {
            name: "Authorization",
            type: "string",
            required: true,
            example: accessTokenExample,
          },
        ],
        responseExample: deleteUserResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Path Parameters",
            columns: ["Field", "Type", "Required", "Description"],
            rows: [["id", "number|string", "Yes", "รหัสผู้ใช้งาน"]],
          },
        ],
      },
    ],
  },
  {
    name: "Eligible Factories",
    endpoints: [
      {
        id: "eligible-factory-candidates",
        method: "GET",
        path: "/eligible-factories/candidates",
        url: "http://d-poms.diw.go.th/api/v1/eligible-factories/candidates",
        testUrl: "/api-proxy/v1/eligible-factories/candidates",
        description: "ดึงรายการโรงงานทั้งหมดจาก กรอ. สำหรับตารางโรงงานทั้งหมด",
        defaultHeaders: {
          Authorization: accessTokenExample,
        },
        headerFields: [
          {
            name: "Authorization",
            type: "string",
            required: true,
            example: accessTokenExample,
          },
        ],
        responseExample: eligibleFactoryCandidatesResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Candidate Factory Fields",
            columns: ["Field", "Type", "Description"],
            rows: eligibleFactoryFieldRows.filter(([field]) => field !== "id"),
          },
          {
            title: "Response Meta Fields",
            columns: ["Field", "Type", "Description"],
            rows: [
              ["meta.total", "number", "จำนวนข้อมูลทั้งหมด"],
              ["meta.source", "string", "แหล่งข้อมูล เช่น mock"],
            ],
          },
        ],
      },
      {
        id: "eligible-factories-list",
        method: "GET",
        path: "/eligible-factories",
        url: "http://d-poms.diw.go.th/api/v1/eligible-factories",
        testUrl: "/api-proxy/v1/eligible-factories",
        description: "ดึงรายการโรงงานที่ถูกนำเข้าเป็นโรงงานที่เข้าข่ายแล้ว",
        defaultHeaders: {
          Authorization: accessTokenExample,
        },
        headerFields: [
          {
            name: "Authorization",
            type: "string",
            required: true,
            example: accessTokenExample,
          },
        ],
        responseExample: eligibleFactoriesListResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Eligible Factory Fields",
            columns: ["Field", "Type", "Description"],
            rows: eligibleFactoryFieldRows,
          },
          {
            title: "Response Meta Fields",
            columns: ["Field", "Type", "Description"],
            rows: [["meta.total", "number", "จำนวนข้อมูลทั้งหมด"]],
          },
        ],
      },
      {
        id: "eligible-factories-create",
        method: "POST",
        path: "/eligible-factories",
        url: "http://d-poms.diw.go.th/api/v1/eligible-factories",
        testUrl: "/api-proxy/v1/eligible-factories",
        description: "นำเข้าโรงงานจากตารางโรงงานทั้งหมดเป็นโรงงานที่เข้าข่าย",
        defaultHeaders: {
          Authorization: accessTokenExample,
        },
        defaultBody: createEligibleFactoryRequestExample,
        headerFields: [
          {
            name: "Authorization",
            type: "string",
            required: true,
            example: accessTokenExample,
          },
        ],
        bodyFields: eligibleFactoryFieldRows
          .filter(([field]) => field !== "id")
          .map(([name, type, example]) => ({
            name,
            type,
            required: false,
            example,
          })),
        responseExample: createEligibleFactoryResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Request Body Fields",
            columns: ["Field", "Type", "Description"],
            rows: eligibleFactoryFieldRows.filter(([field]) => field !== "id"),
          },
        ],
      },
      {
        id: "eligible-factories-delete",
        method: "DELETE",
        path: "/eligible-factories/:id",
        url: "http://d-poms.diw.go.th/api/v1/eligible-factories/:id",
        testUrl: "/api-proxy/v1/eligible-factories/1",
        description: "นำโรงงานออกจากรายการโรงงานที่เข้าข่าย",
        defaultHeaders: {
          Authorization: accessTokenExample,
        },
        headerFields: [
          {
            name: "Authorization",
            type: "string",
            required: true,
            example: accessTokenExample,
          },
        ],
        responseExample: deleteEligibleFactoryResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Path Parameters",
            columns: ["Field", "Type", "Required", "Description"],
            rows: [
              [
                "id",
                "number|string",
                "Yes",
                "รหัสรายการโรงงานที่เข้าข่ายจาก GET /eligible-factories",
              ],
            ],
          },
        ],
      },
    ],
  },
  {
    name: "CEMS/WPMS Requests",
    endpoints: [
      {
        id: "cems-wpms-create-measurement-point",
        method: "POST",
        path: "/cems-wpms-requests/measurement-points",
        url: "http://d-poms.diw.go.th/api/v1/cems-wpms-requests/measurement-points",
        testUrl: "/api-proxy/v1/cems-wpms-requests/measurement-points",
        description: "บันทึกแบบฟอร์มคำขอเพิ่มจุดตรวจวัด",
        defaultHeaders: { Authorization: accessTokenExample },
        defaultBody: connectionRequestFormExample,
        responseExample: connectionRequestResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Request Body Fields",
            columns: ["Field", "Type", "Description"],
            rows: connectionRequestFieldRows,
          },
        ],
      },
      {
        id: "cems-wpms-create-parameter",
        method: "POST",
        path: "/cems-wpms-requests/parameters",
        url: "http://d-poms.diw.go.th/api/v1/cems-wpms-requests/parameters",
        testUrl: "/api-proxy/v1/cems-wpms-requests/parameters",
        description: "บันทึกแบบฟอร์มคำขอเพิ่มพารามิเตอร์ให้จุดตรวจวัดเดิม",
        defaultHeaders: { Authorization: accessTokenExample },
        defaultBody: addParameterRequestExample,
        responseExample: connectionRequestResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Request Body Fields",
            columns: ["Field", "Type", "Description"],
            rows: [
              ...connectionRequestFieldRows,
              [
                "validation",
                "rule",
                "ฟอร์มเพิ่มพารามิเตอร์ต้องส่ง measurementPoints 1 รายการ",
              ],
            ],
          },
        ],
      },
      {
        id: "cems-wpms-change-status",
        method: "POST",
        path: "/cems-wpms-requests/:id/status",
        url: "http://d-poms.diw.go.th/api/v1/cems-wpms-requests/:id/status",
        testUrl: "/api-proxy/v1/cems-wpms-requests/1/status",
        description:
          "เจ้าหน้าที่ตรวจฟอร์มและเปลี่ยนสถานะ APPROVE_FORM หรือ REQUEST_REVISION",
        defaultHeaders: { Authorization: accessTokenExample },
        defaultBody: connectionStatusRequestExample,
        responseExample: connectionRequestResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Request Body Fields",
            columns: ["Field", "Type", "Description"],
            rows: [
              [
                "action",
                "APPROVE_FORM|REQUEST_REVISION",
                "APPROVE_FORM = อนุมัติแบบ, REQUEST_REVISION = ขอแก้ไข",
              ],
              [
                "revisionReason",
                "string",
                "Required เมื่อ action = REQUEST_REVISION",
              ],
              ["officerNote", "string|null", "หมายเหตุเจ้าหน้าที่"],
            ],
          },
        ],
      },
      {
        id: "cems-wpms-create-device-config",
        method: "POST",
        path: "/cems-wpms-requests/:id/device-configs",
        url: "http://d-poms.diw.go.th/api/v1/cems-wpms-requests/:id/device-configs",
        testUrl: "/api-proxy/v1/cems-wpms-requests/1/device-configs",
        description: "บันทึกฟอร์มตั้งค่าอุปกรณ์และผูก config กับคำขอ",
        defaultHeaders: { Authorization: accessTokenExample },
        defaultBody: deviceConfigRequestExample,
        responseExample: {
          success: true,
          data: connectionRequestDetailResponseExample.data.deviceConfigs[0],
        },
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Request Body Fields",
            columns: ["Field", "Type", "Description"],
            rows: [
              [
                "stationId",
                "string",
                "ต้องตรงกับ pointCode หรือ pointName ในคำขอ",
              ],
              [
                "protocol",
                "MODBUS_RTU|MODBUS_TCP|MSSQL|MYSQL",
                "ชนิดการเชื่อมต่ออุปกรณ์",
              ],
              ["settings", "object", "ค่าตั้งค่าตาม protocol"],
              ["channels", "array", "รายการ channel/พารามิเตอร์ที่เชื่อมต่อ"],
              [
                "statusManagement",
                "object|null",
                "Optional: ค่าจัดการสถานะ selectedParameters, startAt, endAt, status, schedules",
              ],
            ],
          },
        ],
      },
      {
        id: "cems-wpms-device-config-form-detail",
        method: "GET",
        path: "/cems-wpms-requests/:id/device-configs",
        url: "http://d-poms.diw.go.th/api/v1/cems-wpms-requests/:id/device-configs",
        testUrl:
          "/api-proxy/v1/cems-wpms-requests/1/device-configs?stationId=STACK-A",
        description:
          "รายละเอียดฟอร์มตั้งค่าอุปกรณ์ สำหรับดึงข้อมูลเดิมลง dialog ตามจุดตรวจวัด",
        defaultHeaders: { Authorization: accessTokenExample },
        responseExample: deviceConfigFormDetailResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Path Parameters",
            columns: ["Field", "Type", "Required", "Description"],
            rows: [["id", "number", "Yes", "รหัสคำขอ CEMS/WPMS"]],
          },
          {
            title: "Query Parameters",
            columns: ["Field", "Type", "Required", "Description"],
            rows: [
              [
                "stationId",
                "string",
                "No",
                "รหัส/ชื่อจุดตรวจวัด เช่น STACK-A ถ้าไม่ส่งจะใช้จุดแรกในคำขอ",
              ],
            ],
          },
          {
            title: "Response Fields",
            columns: ["Field", "Type", "Description"],
            rows: [
              [
                "connectionForms",
                "array",
                "ข้อมูลกล่องอุปกรณ์ Connection พร้อม type, deviceCode, values",
              ],
              [
                "statusManagement",
                "object",
                "ค่าจัดการสถานะ selectedParameters, startAt, endAt, status",
              ],
              [
                "parameterMappings",
                "array",
                "แถวการเชื่อมต่อพารามิเตอร์สำหรับลงตารางด้านล่าง",
              ],
              [
                "parameterOptions",
                "string[]",
                "ตัวเลือกพารามิเตอร์จากจุดตรวจวัดในคำขอ",
              ],
              [
                "deviceCodeOptions",
                "string[]",
                "ตัวเลือกรหัสอุปกรณ์ เช่น STACK-A/01",
              ],
              ["rawConfigs", "array", "ข้อมูล config ต้นฉบับจาก backend"],
            ],
          },
        ],
      },
      {
        id: "cems-wpms-device-config-form-detail-by-config",
        method: "GET",
        path: "/cems-wpms-requests/:id/device-configs/:configId",
        url: "http://d-poms.diw.go.th/api/v1/cems-wpms-requests/:id/device-configs/:configId",
        testUrl: "/api-proxy/v1/cems-wpms-requests/1/device-configs/10",
        description:
          "รายละเอียดฟอร์มตั้งค่าอุปกรณ์ราย config สำหรับเปิดแก้ไขอุปกรณ์เดียว",
        defaultHeaders: { Authorization: accessTokenExample },
        responseExample: deviceConfigFormDetailResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Path Parameters",
            columns: ["Field", "Type", "Required", "Description"],
            rows: [
              ["id", "number", "Yes", "รหัสคำขอ CEMS/WPMS"],
              ["configId", "number", "Yes", "รหัส device config"],
            ],
          },
          {
            title: "Response Fields",
            columns: ["Field", "Type", "Description"],
            rows: [
              [
                "connectionForms",
                "array",
                "จะมีเฉพาะอุปกรณ์ของ configId ที่ระบุ",
              ],
              [
                "parameterMappings",
                "array",
                "รายการพารามิเตอร์/channels ของ configId ที่ระบุ",
              ],
              [
                "statusManagement",
                "object",
                "ค่า default สำหรับส่วนจัดการสถานะใน dialog",
              ],
              ["rawConfigs", "array", "config ต้นฉบับ 1 รายการ"],
            ],
          },
        ],
      },
      {
        id: "cems-wpms-table-rows",
        method: "GET",
        path: "/cems-wpms-requests/table-rows",
        url: "http://d-poms.diw.go.th/api/v1/cems-wpms-requests/table-rows",
        testUrl: "/api-proxy/v1/cems-wpms-requests/table-rows",
        description:
          "รายการคำขอสำหรับลงตาราง เจ้าหน้าที่เห็นทั้งหมดตาม scope, ผู้ประกอบการเห็นเฉพาะของตัวเอง",
        defaultHeaders: { Authorization: accessTokenExample },
        responseExample: connectionRequestTableRowsResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Query Parameters",
            columns: ["Field", "Type", "Required", "Description"],
            rows: [
              ["status", "string", "No", "filter ตาม statusCode"],
              [
                "requestType",
                "string",
                "No",
                "NEW_CONNECTION, ADD_MEASUREMENT_POINT, ADD_PARAMETER",
              ],
              ["factoryId", "string", "No", "filter ตามโรงงาน"],
            ],
          },
          {
            title: "Table Row Fields",
            columns: ["Field", "Type", "Description"],
            rows: connectionRequestTableFieldRows,
          },
        ],
      },
      {
        id: "cems-wpms-operator-factories",
        method: "GET",
        path: "/cems-wpms-requests/operator-factories",
        url: "http://d-poms.diw.go.th/api/v1/cems-wpms-requests/operator-factories",
        testUrl: "/api-proxy/v1/cems-wpms-requests/operator-factories",
        description: "รายชื่อโรงงานสำหรับลงตารางรายชื่อโรงงานของผู้ประกอบการ",
        defaultHeaders: { Authorization: accessTokenExample },
        responseExample: operatorFactoriesResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Factory Row Fields",
            columns: ["Field", "Type", "Description"],
            rows: [
              ["factoryName", "string", "ชื่อโรงงาน/บริษัท"],
              ["newRegistrationNo", "string", "เลขทะเบียนโรงงานใหม่"],
              ["oldRegistrationNo", "string|null", "เลขทะเบียนโรงงานเก่า"],
              ["industryType", "string|null", "ประเภทอุตสาหกรรม"],
              ["province", "string|null", "จังหวัด"],
              [
                "monitoringPointCount",
                "number",
                "จำนวนจุดตรวจวัดที่เชื่อมต่อแล้ว",
              ],
              [
                "requestStatus",
                "string",
                "สถานะคำขอล่าสุด หรือ ยังไม่มีจุดตรวจวัด",
              ],
            ],
          },
        ],
      },
      {
        id: "cems-wpms-request-detail",
        method: "GET",
        path: "/cems-wpms-requests/:id/detail",
        url: "http://d-poms.diw.go.th/api/v1/cems-wpms-requests/:id/detail",
        testUrl: "/api-proxy/v1/cems-wpms-requests/1/detail",
        description:
          "รายละเอียดคำขอรายคำขอ สำหรับทำ PDF และเรียกข้อมูลเดิมลงฟอร์มเพิ่มพารามิเตอร์",
        defaultHeaders: { Authorization: accessTokenExample },
        responseExample: connectionRequestDetailResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Response Sections",
            columns: ["Field", "Type", "Description"],
            rows: [
              [
                "data.factory",
                "object|null",
                "ข้อมูลโรงงานสำหรับเติมฟอร์ม/PDF",
              ],
              ["data.measurementPoints", "array", "รายการจุดตรวจวัดในคำขอ"],
              ["data.statusHistory", "array", "ประวัติสถานะ"],
              ["data.deviceConfigs", "array", "config อุปกรณ์ที่ผูกกับคำขอ"],
            ],
          },
        ],
      },
      {
        id: "cems-wpms-connected-measurement-points",
        method: "GET",
        path: "/cems-wpms-requests/connected-measurement-points",
        url: "http://d-poms.diw.go.th/api/v1/cems-wpms-requests/connected-measurement-points",
        testUrl:
          "/api-proxy/v1/cems-wpms-requests/connected-measurement-points",
        description:
          "รายละเอียดรายจุดตรวจวัดจากทุกคำขอ เฉพาะ status เชื่อมต่อแล้ว สำหรับทำ PDF",
        defaultHeaders: { Authorization: accessTokenExample },
        responseExample: connectedMeasurementPointsResponseExample,
        dataDictionaries: [
          {
            title: "Headers Request",
            columns: ["Header", "Type", "Required", "Description"],
            rows: [["Authorization", "string", "Yes", "Bearer <accessToken>"]],
          },
          {
            title: "Query Parameters",
            columns: ["Field", "Type", "Required", "Description"],
            rows: [
              ["factoryId", "string", "No", "filter จุดตรวจวัดของโรงงานเดียว"],
            ],
          },
          {
            title: "Response Fields",
            columns: ["Field", "Type", "Description"],
            rows: [
              ["requestNo", "string", "เลขที่คำขอ"],
              ["factory", "object|null", "ข้อมูลโรงงาน"],
              ["point", "object", "รายละเอียดจุดตรวจวัด"],
              ["deviceConfigs", "array", "config อุปกรณ์ของจุดตรวจวัดนั้น"],
              [
                "connectedAt",
                "string|null",
                "วันที่เจ้าหน้าที่ verify เป็นเชื่อมต่อแล้ว",
              ],
            ],
          },
        ],
      },
    ],
  },
];

const endpoints = apiCategories.flatMap((category) =>
  category.endpoints.map((endpoint) => ({
    ...endpoint,
    category: category.name,
  })),
);

const defaultBodiesByEndpoint = Object.fromEntries(
  endpoints.map((endpoint) => [
    endpoint.id,
    formatJson(endpoint.defaultBody ?? {}),
  ]),
);

const defaultHeadersByEndpoint = Object.fromEntries(
  endpoints.map((endpoint) => [
    endpoint.id,
    formatJson(endpoint.defaultHeaders ?? {}),
  ]),
);

function ApiDocumentationPage() {
  const [selectedEndpointId, setSelectedEndpointId] = useState(endpoints[0].id);
  const selectedEndpoint =
    endpoints.find((endpoint) => endpoint.id === selectedEndpointId) ??
    endpoints[0];
  const [requestBodies, setRequestBodies] = useState(defaultBodiesByEndpoint);
  const [requestHeadersByEndpoint, setRequestHeadersByEndpoint] = useState(
    defaultHeadersByEndpoint,
  );
  const [response, setResponse] = useState(null);
  const [error, setError] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const requestBody =
    requestBodies[selectedEndpoint.id] ??
    defaultBodiesByEndpoint[selectedEndpoint.id];
  const requestHeaders =
    requestHeadersByEndpoint[selectedEndpoint.id] ??
    defaultHeadersByEndpoint[selectedEndpoint.id];

  const parsedBody = useMemo(() => parseJson(requestBody), [requestBody]);
  const parsedHeaders = useMemo(
    () => parseJson(requestHeaders),
    [requestHeaders],
  );
  const hasBody = Boolean(selectedEndpoint.defaultBody);
  const hasHeaders = Boolean(selectedEndpoint.headerFields?.length);

  const handleTest = async () => {
    if (hasBody && parsedBody.error) {
      setError(`JSON Body ไม่ถูกต้อง: ${parsedBody.error}`);
      setResponse(null);
      return;
    }

    if (parsedHeaders.error) {
      setError(`Headers JSON ไม่ถูกต้อง: ${parsedHeaders.error}`);
      setResponse(null);
      return;
    }

    setIsTesting(true);
    setError("");
    setResponse(null);

    try {
      const startedAt = performance.now();
      const headers = {
        Accept: "application/json",
        ...parsedHeaders.value,
      };

      if (hasBody) {
        headers["Content-Type"] = "application/json";
      }

      const result = await fetch(selectedEndpoint.testUrl, {
        method: selectedEndpoint.method,
        headers,
        ...(hasBody ? { body: JSON.stringify(parsedBody.value) } : {}),
      });
      const elapsedMs = Math.round(performance.now() - startedAt);
      const rawText = await result.text();

      let data = rawText;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = rawText;
      }

      setResponse({
        status: result.status,
        statusText: result.statusText,
        ok: result.ok,
        elapsedMs,
        headers: Object.fromEntries(result.headers.entries()),
        data,
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyRequest = async () => {
    await navigator.clipboard?.writeText(
      hasBody ? requestBody : requestHeaders,
    );
  };

  return (
    <Stack spacing={2} sx={{ height: "100%", minHeight: 0 }}>
      <Paper
        elevation={0}
        sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          border: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          sx={{ alignItems: { xs: "flex-start", md: "center" } }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
              API Documentation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              รายละเอียด API แยกตามหมวดหมู่ พร้อมทดสอบ request และดู response
            </Typography>
          </Box>
          <Chip label="Swagger style" color="primary" variant="outlined" />
        </Stack>
      </Paper>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "336px minmax(0, 1fr)" },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            minHeight: 0,
            border: 1,
            borderColor: "divider",
            overflow: "auto",
          }}
        >
          <Box
            sx={{
              p: 2,
              bgcolor: "neutral.50",
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              หมวดหมู่
            </Typography>
          </Box>
          <Stack spacing={1.5} sx={{ p: 1.5 }}>
            {apiCategories.map((category) => (
              <Box key={category.name}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  {category.name}
                </Typography>
                <Stack spacing={1}>
                  {category.endpoints.map((endpoint) => (
                    <EndpointListItem
                      key={endpoint.id}
                      endpoint={endpoint}
                      selected={endpoint.id === selectedEndpoint.id}
                      onClick={() => {
                        setSelectedEndpointId(endpoint.id);
                        setResponse(null);
                        setError("");
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            minWidth: 0,
            minHeight: 0,
            border: 1,
            borderColor: "divider",
            overflow: "auto",
          }}
        >
          <Stack spacing={0}>
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                sx={{ alignItems: { xs: "stretch", md: "center" } }}
              >
                <MethodChip method={selectedEndpoint.method} />
                <Typography
                  variant="body1"
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: "monospace",
                    overflowWrap: "anywhere",
                  }}
                >
                  {selectedEndpoint.url}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={
                    isTesting ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : (
                      <PlayArrowIcon />
                    )
                  }
                  onClick={handleTest}
                  disabled={isTesting}
                >
                  Test API
                </Button>
              </Stack>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1.5 }}
              >
                {selectedEndpoint.description}
              </Typography>
            </Box>

            <Divider />

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  xl: "minmax(0, 1fr) minmax(0, 1fr)",
                },
              }}
            >
              <Stack spacing={2} sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
                {hasHeaders ? (
                  <RequestEditor
                    title="Headers"
                    fields={selectedEndpoint.headerFields}
                    label="Headers JSON"
                    value={requestHeaders}
                    onChange={(nextValue) =>
                      setRequestHeadersByEndpoint((current) => ({
                        ...current,
                        [selectedEndpoint.id]: nextValue,
                      }))
                    }
                    error={parsedHeaders.error}
                    helperText="แก้ไข header เพื่อทดสอบ API"
                  />
                ) : null}

                {hasBody ? (
                  <RequestEditor
                    title="Request Body"
                    fields={selectedEndpoint.bodyFields}
                    label="JSON Body"
                    value={requestBody}
                    onChange={(nextValue) =>
                      setRequestBodies((current) => ({
                        ...current,
                        [selectedEndpoint.id]: nextValue,
                      }))
                    }
                    error={parsedBody.error}
                    helperText="แก้ไขค่า request body เพื่อทดสอบ API"
                  />
                ) : null}

                {!hasHeaders && !hasBody ? <EmptyRequest /> : null}

                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ justifyContent: "flex-end" }}
                >
                  <Button
                    startIcon={<ContentCopyIcon />}
                    onClick={handleCopyRequest}
                  >
                    {hasBody ? "Copy Body" : "Copy Headers"}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setRequestBodies((current) => ({
                        ...current,
                        [selectedEndpoint.id]:
                          defaultBodiesByEndpoint[selectedEndpoint.id],
                      }));
                      setRequestHeadersByEndpoint((current) => ({
                        ...current,
                        [selectedEndpoint.id]:
                          defaultHeadersByEndpoint[selectedEndpoint.id],
                      }));
                    }}
                  >
                    Reset
                  </Button>
                </Stack>
              </Stack>

              <Stack
                spacing={2}
                sx={{
                  p: { xs: 2, md: 3 },
                  minWidth: 0,
                  borderTop: { xs: 1, xl: 0 },
                  borderLeft: { xs: 0, xl: 1 },
                  borderColor: "divider",
                }}
              >
                <SectionTitle title="Response" />
                {selectedEndpoint.responseExample ? (
                  <CodeBlock
                    title="Expected Response Body"
                    value={formatJson(selectedEndpoint.responseExample)}
                  />
                ) : null}
                {error ? <Alert severity="error">{error}</Alert> : null}
                {response ? (
                  <ResponseViewer response={response} />
                ) : (
                  <EmptyResponse />
                )}
              </Stack>
            </Box>

            {selectedEndpoint.dataDictionaries?.length ? (
              <>
                <Divider />
                <DataDictionary sections={selectedEndpoint.dataDictionaries} />
              </>
            ) : null}
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function parseJson(value) {
  try {
    return { value: JSON.parse(value || "{}"), error: "" };
  } catch (parseError) {
    return { value: null, error: parseError.message };
  }
}

function EndpointListItem({ endpoint, selected, onClick }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        width: "100%",
        p: 1.5,
        border: 1,
        borderColor: selected ? "primary.200" : "divider",
        borderRadius: 1,
        bgcolor: selected ? "primary.50" : "background.paper",
        cursor: "pointer",
        textAlign: "left",
        font: "inherit",
        "&:hover": {
          bgcolor: selected ? "primary.50" : "neutral.50",
        },
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <MethodChip method={endpoint.method} />
        <Typography
          variant="caption"
          sx={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "monospace",
          }}
        >
          {endpoint.path}
        </Typography>
      </Stack>
    </Box>
  );
}

function MethodChip({ method }) {
  const isPost = method === "POST";

  return (
    <Chip
      label={method}
      size="small"
      sx={{
        width: 64,
        bgcolor: isPost ? "#16a34a" : "#2563eb",
        color: "#ffffff",
        fontFamily: "monospace",
        fontWeight: 600,
        borderRadius: 1,
      }}
    />
  );
}

function SectionTitle({ title }) {
  return (
    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
      {title}
    </Typography>
  );
}

function RequestEditor({
  title,
  fields,
  label,
  value,
  onChange,
  error,
  helperText,
}) {
  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <SectionTitle title={title} />
      <Box
        sx={{
          overflow: "auto",
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        <FieldHeader />
        {fields.map((field) => (
          <FieldRow key={field.name} field={field} />
        ))}
      </Box>
      <TextField
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        multiline
        minRows={title === "Headers" ? 5 : 9}
        error={Boolean(error)}
        helperText={error ? `JSON ไม่ถูกต้อง: ${error}` : helperText}
        fullWidth
        spellCheck={false}
        sx={{
          "& textarea": {
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 13,
            lineHeight: 1.55,
          },
        }}
      />
    </Stack>
  );
}

function DataDictionary({ sections }) {
  return (
    <Stack spacing={2.5} sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
      <Box>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
          Data Dictionary
        </Typography>
        <Typography variant="body2" color="text.secondary">
          รายละเอียด field, code, และ permission ที่เกี่ยวข้องกับ API นี้
        </Typography>
      </Box>

      {sections.map((section) => (
        <DictionaryTable key={section.title} section={section} />
      ))}
    </Stack>
  );
}

function DictionaryTable({ section }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
        {section.title}
      </Typography>
      <Box
        sx={{
          overflow: "auto",
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `repeat(${section.columns.length}, minmax(160px, 1fr))`,
            minWidth: Math.max(640, section.columns.length * 180),
            bgcolor: "neutral.50",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          {section.columns.map((column) => (
            <Typography
              key={column}
              variant="caption"
              sx={{
                px: 1.5,
                py: 1,
                fontWeight: 600,
                borderRight: 1,
                borderColor: "divider",
                "&:last-child": { borderRight: 0 },
              }}
            >
              {column}
            </Typography>
          ))}
        </Box>

        {section.rows.map((row, rowIndex) => (
          <Box
            key={`${section.title}-${rowIndex}`}
            sx={{
              display: "grid",
              gridTemplateColumns: `repeat(${section.columns.length}, minmax(160px, 1fr))`,
              minWidth: Math.max(640, section.columns.length * 180),
              borderBottom: 1,
              borderColor: "divider",
              "&:last-child": { borderBottom: 0 },
            }}
          >
            {row.map((cell, cellIndex) => (
              <Typography
                key={`${section.title}-${rowIndex}-${cellIndex}`}
                variant="body2"
                sx={{
                  px: 1.5,
                  py: 1,
                  overflowWrap: "anywhere",
                  borderRight: 1,
                  borderColor: "divider",
                  "&:last-child": { borderRight: 0 },
                }}
              >
                {cell}
              </Typography>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function FieldHeader() {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns:
          "minmax(140px, 1fr) 96px 96px minmax(160px, 1.25fr)",
        gap: 1,
        minWidth: 640,
        px: 1.5,
        py: 1,
        bgcolor: "neutral.50",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      {["Name", "Type", "Required", "Example"].map((field) => (
        <Typography key={field} variant="caption" sx={{ fontWeight: 600 }}>
          {field}
        </Typography>
      ))}
    </Box>
  );
}

function FieldRow({ field }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns:
          "minmax(140px, 1fr) 96px 96px minmax(160px, 1.25fr)",
        gap: 1,
        minWidth: 640,
        px: 1.5,
        py: 1,
        borderBottom: 1,
        borderColor: "divider",
        "&:last-child": { borderBottom: 0 },
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}
      >
        {field.name}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {field.type}
      </Typography>
      <Typography
        variant="body2"
        color={field.required ? "error.main" : "text.secondary"}
      >
        {field.required ? "Yes" : "No"}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}
      >
        {field.example}
      </Typography>
    </Box>
  );
}

function EmptyRequest() {
  return (
    <Box
      sx={{
        p: 3,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "neutral.50",
        color: "text.secondary",
      }}
    >
      <Typography variant="body2">
        API นี้ไม่มี request body หรือ headers ที่ต้องระบุ
      </Typography>
    </Box>
  );
}

function EmptyResponse() {
  return (
    <Box
      sx={{
        p: 3,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "neutral.50",
        color: "text.secondary",
      }}
    >
      <Typography variant="body2">
        กด Test API เพื่อดู status, headers และ response body
      </Typography>
    </Box>
  );
}

function ResponseViewer({ response }) {
  const responseText = JSON.stringify(response.data, null, 2);
  const headersText = JSON.stringify(response.headers, null, 2);

  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Chip
          label={`${response.status} ${response.statusText}`}
          color={response.ok ? "success" : "error"}
          variant="outlined"
        />
        <Chip label={`${response.elapsedMs} ms`} variant="outlined" />
      </Stack>

      <CodeBlock title="Response Body" value={responseText} />
      <CodeBlock title="Headers" value={headersText} />
    </Stack>
  );
}

function CodeBlock({ title, value }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
        {title}
      </Typography>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          maxHeight: 320,
          overflow: "auto",
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          bgcolor: "#0f172a",
          color: "#e2e8f0",
          fontSize: 13,
          lineHeight: 1.55,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        {value || "null"}
      </Box>
    </Box>
  );
}

export default ApiDocumentationPage;
