import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  IconButton,
  Menu,
  MenuItem,
  OutlinedInput,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { DataGrid } from '@mui/x-data-grid'

const subMenus = [
  { value: 'factories', label: 'รายชื่อโรงงาน' },
  { value: 'requests', label: 'รายการคำขอ' },
]

const cemsParameterOptions = [
  'CO2 (%)',
  'CO2 (ppm)',
  'CO (ppm)',
  'Flow (m³/hr)',
  'H2S (ppm)',
  'HCl (mg/m³)',
  'Hg (mg/m³)',
  'Moisture in Stack (%)',
  'NOx (ppm)',
  'O2 (%)',
  'Opacity (%)',
  'Opacity (mg/m³)',
  'Particulate (mg/m³)',
  'Pressure in Stack (mmHg)',
  'SO2 (ppm)',
  'SOx (ppm)',
  'Temp. (°C)',
  'TRS (ppm)',
  'TSP (mg/m³)',
  'HCL (ppm)',
  'Loading (mg/hr)',
]

const monitoringPointTypeOptions = ['CEMS', 'WPMS', 'Mobile', 'Station']

const wpmsInstrumentParameters = [
  'BOD (mg/l)',
  'COD (mg/l)',
  'Flow (m³/hr)',
  'Watt (kW)',
  'Loading (mg/hr)',
]

const measurementInstrumentColumns = [
  'พารามิเตอร์ที่ขอเชื่อมต่อ',
  'เทคนิคการตรวจวัด',
  'ช่วงการตรวจวัด',
  'ยี่ห้อเครื่องมือ',
  'ผู้จำหน่ายเครื่องมือ',
  'มาตรฐาน EIA',
  'สภาวะมาตรฐาน',
  'การรายงานค่า (Dry basis)',
  'O₂ @ 7% or Excess Air 50%',
  'จัดการ',
]

const specialCriteriaRows = [
  { key: 'normal', label: 'ปกติ', color: 'success' },
  { key: 'warning', label: 'เฝ้าระวัง', color: 'warning' },
  { key: 'critical', label: 'แจ้งเตือน', color: 'error' },
]

const emptyInstrumentParameter = {
  parameter: '',
  technique: '',
  range: '',
  brand: '',
  supplier: '',
  eiaStandard: '',
  standardCondition: false,
  dryBasis: false,
  oxygenOrExcessAir: false,
}

const waitingConnectionSx = {
  bgcolor: '#5b21b6',
  borderColor: '#5b21b6',
  color: '#ffffff',
}

const borderedTableSx = {
  '& th, & td': {
    borderRight: 1,
    borderBottom: 1,
    borderColor: 'divider',
  },
  '& th:last-of-type, & td:last-of-type': {
    borderRight: 0,
  },
  '& tbody tr:last-of-type td': {
    borderBottom: 0,
  },
}

const tableActionStackSx = {
  alignItems: 'center',
  flexWrap: 'nowrap',
  height: 'auto',
  '& .MuiButton-root': {
    alignSelf: 'center',
    minHeight: 30,
    height: 30,
    whiteSpace: 'nowrap',
  },
}

const connectionTypeOptions = ['Modbus RTU', 'Modbus TCP', 'Microsoft SQL', 'MySQL']

const baudRateOptions = ['2400', '4800', '9600', '14400', '19200', '38400']
const parityOptions = ['Even', 'Odd', 'None']
const stopBitsOptions = ['1', '2']
const dataBitsOptions = ['7', '8']
const dataValueFormatOptions = ['ค่าข้อมูลตรวจวัด', 'ค่ากระแสไฟฟ้า', 'ค่าแรงดันไฟฟ้า']
const connectionParameterStatusOptions = [
  'Normal',
  'Calibration',
  'Defective',
  'Maintenance',
  'Start up',
  'Shut Down',
  'Turnaround',
  'Etc.',
]
const encodingDataOptions = [
  'Signed16 - Big Endian',
  'Signed16 - Little Endian',
  'Unsigned16 - Big Endian',
  'Unsigned16 - Little Endian',
  'Signed32 - Big Endian',
  'Signed32 - Little Endian',
  'Unsigned32 - Big Endian',
  'Unsigned32 - Little Endian',
  'Float32 - Big Endian',
  'Float32 - Little Endian',
  'Float64 - Big Endian',
  'Float64 - Little Endian',
]

const parameterUnitMap = {
  'CO2 (%)': '%',
  'CO2 (ppm)': 'ppm',
  'CO (ppm)': 'ppm',
  'Flow (m³/hr)': 'm³/hr',
  'H2S (ppm)': 'ppm',
  'HCl (mg/m³)': 'mg/m³',
  'Hg (mg/m³)': 'mg/m³',
  'Moisture in Stack (%)': '%',
  'NOx (ppm)': 'ppm',
  'O2 (%)': '%',
  'Opacity (%)': '%',
  'Opacity (mg/m³)': 'mg/m³',
  'Particulate (mg/m³)': 'mg/m³',
  'Pressure in Stack (mmHg)': 'mmHg',
  'SO2 (ppm)': 'ppm',
  'SOx (ppm)': 'ppm',
  'Temp. (°C)': '°C',
  'TRS (ppm)': 'ppm',
  'TSP (mg/m³)': 'mg/m³',
  'HCL (ppm)': 'ppm',
  'Loading (mg/hr)': 'mg/hr',
  'BOD (mg/l)': 'mg/l',
  'COD (mg/l)': 'mg/l',
  'Watt (kW)': 'kW',
}

function getDefaultConnectionForm(type) {
  if (type === 'Modbus RTU') {
    return {
      comport: '',
      slaveId: '',
      baudRate: '',
      parity: '',
      stopBits: '',
      dataBits: '',
      measureMin: '',
      measureMax: '',
      quantity: '',
    }
  }
  if (type === 'Modbus TCP') {
    return {
      slaveId: '',
      hostIp: '',
      port: '',
    }
  }
  if (type === 'Microsoft SQL') {
    return {
      hostIp: '',
      port: '',
      dbUser: '',
      dbPass: '',
      dbName: '',
    }
  }
  return {
    hostIp: '',
    port: '',
    dbUser: '',
    dbPass: '',
    dbName: '',
  }
}

const documentImageItems = [
  {
    title: 'ข้อมูลรายละเอียดการรายงานค่าที่สภาวะมาตรฐาน',
    description:
      'ให้แสดงรายละเอียดหรือแนบเอกสารหรือรูปภาพหน้าโปรแกรมของเครื่องมือที่แสดงให้เห็นถึงการคำนวณและการรายงานค่าของมลพิษในอากาศเสียที่สภาวะมาตรฐาน ความดัน 1 บรรยากาศ หรือ 760 มิลลิเมตรปรอท อุณหภูมิ 25 องศาเซลเซียสที่สภาวะแห้ง (Dry basis) โดยมีปริมาตรอากาศส่วนเกินในการเผาไหม้ (Excess air) ร้อยละ 50 หรือมีปริมาตรออกซิเจนในอากาศเสีย ร้อยละ 7 หรือ ปริมาตรออกซิเจนในอากาศเสีย ณ สภาวะจริงในขณะตรวจวัด (การเผาไหม้แบบระบบปิดหรือไม่มีการเผาไหม้)',
    hasLink: true,
    uploadLabel: 'ภาพ/ไฟล์/QR Code',
  },
  {
    title: 'รายงานผลการทำ RATA หรือ อื่นๆ ที่เทียบเท่า ของระบบ CEMS ครั้งล่าสุด',
    hasLink: true,
    uploadLabel: 'ภาพ/ไฟล์/QR Code',
  },
  {
    title: 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน',
    uploadLabel: 'ภาพ/ไฟล์/QR Code',
    accept: 'image/jpeg,image/png',
  },
  {
    title: 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท',
    uploadLabel: 'ภาพ/ไฟล์/QR Code',
    accept: 'image/jpeg,image/png',
  },
  {
    title: 'ภาพถ่ายปล่อง',
    uploadLabel: 'ภาพ/ไฟล์/QR Code',
    accept: 'image/jpeg,image/png',
  },
  {
    title: 'ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (CEMS)',
    uploadLabel: 'ภาพ/ไฟล์/QR Code',
    accept: 'image/jpeg,image/png',
  },
]

const groupedDocumentImageTitles = [
  'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน',
  'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท',
  'ภาพถ่ายปล่อง',
  'ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (CEMS)',
]

const appBarHeight = {
  xs: 64,
  md: 72,
}

const measurementPointsRequestApiUrl =
  import.meta.env.DEV
    ? '/api-proxy/v1/cems-wpms-requests/measurement-points'
    : 'http://d-poms.diw.go.th/api/v1/cems-wpms-requests/measurement-points'
const operatorFactoriesApiUrl = import.meta.env.DEV
  ? '/api-proxy/v1/cems-wpms-requests/operator-factories'
  : 'http://d-poms.diw.go.th/api/v1/cems-wpms-requests/operator-factories'
const requestTableRowsApiUrl = import.meta.env.DEV
  ? '/api-proxy/v1/cems-wpms-requests/table-rows'
  : 'http://d-poms.diw.go.th/api/v1/cems-wpms-requests/table-rows'
const requestDetailApiBaseUrl = import.meta.env.DEV
  ? '/api-proxy/v1/cems-wpms-requests'
  : 'http://d-poms.diw.go.th/api/v1/cems-wpms-requests'

function getMeasurementPointsRequestApiUrl() {
  if (typeof window === 'undefined') {
    return measurementPointsRequestApiUrl
  }

  if (window.location.hostname === 'd-poms.diw.go.th') {
    return '/api/v1/cems-wpms-requests/measurement-points'
  }

  return measurementPointsRequestApiUrl
}

function getRequestDetailApiUrl(id) {
  if (typeof window !== 'undefined' && window.location.hostname === 'd-poms.diw.go.th') {
    return `/api/v1/cems-wpms-requests/${id}/detail`
  }

  return `${requestDetailApiBaseUrl}/${id}/detail`
}

function getRequestStatusApiUrl(id) {
  if (typeof window !== 'undefined' && window.location.hostname === 'd-poms.diw.go.th') {
    return `/api/v1/cems-wpms-requests/${id}/status`
  }

  return `${requestDetailApiBaseUrl}/${id}/status`
}

function getDeviceConfigsApiUrl(id, stationId) {
  const query = stationId ? `?stationId=${encodeURIComponent(stationId)}` : ''

  if (typeof window !== 'undefined' && window.location.hostname === 'd-poms.diw.go.th') {
    return `/api/v1/cems-wpms-requests/${id}/device-configs${query}`
  }

  return `${requestDetailApiBaseUrl}/${id}/device-configs${query}`
}

const factoryRows = []
const monitoringPointRows = []

function getConnectionParameterOptions(context) {
  const existingParameters = context?.parameters ?? []
  return [...new Set(existingParameters)]
}

function getMonitoringPointCode(context) {
  return context?.pointCode || context?.code || context?.monitoringPointCode || context?.stationId || ''
}

function getConnectionDeviceCode(context, index) {
  const monitoringPointCode = getMonitoringPointCode(context)
  return monitoringPointCode ? `${monitoringPointCode}/${String(index + 1).padStart(2, '0')}` : ''
}

function getDeviceConfigRequestId(context) {
  return context?.REQUEST_ID
    ?? context?.requestId
    ?? context?.request?.REQUEST_ID
    ?? context?.request?.requestId
    ?? context?.request?.id
    ?? context?.cemsWpmsRequestId
    ?? context?.id
    ?? ''
}

function mapOperatorFactoryRow(row) {
  const monitoringPointCount = Number(row.monitoringPointCount ?? 0)

  return {
    id: row.id,
    factoryId: row.factoryId ?? '',
    factoryName: row.factoryName ?? '',
    newRegistrationNo: row.factoryId ?? '',
    oldRegistrationNo: row.newRegistrationNo ?? '',
    factoryRegistrationNo: row.oldRegistrationNo ?? '',
    industryType: row.industryType ?? '',
    industryMainOrder: row.industryMainOrder ?? '',
    industrySubOrder: row.industrySubOrder ?? '',
    businessActivity: row.businessActivity ?? '',
    eia: row.eia ?? '',
    projectName: row.projectName ?? '',
    address: row.address ?? '',
    latitude: row.latitude ?? '',
    longitude: row.longitude ?? '',
    province: row.province ?? '',
    monitoringPointCount,
    isEligible: row.isEligible === true,
    eligibilityStatus: row.eligibilityStatus ?? '',
    requestStatusCode: row.requestStatusCode ?? null,
    requestStatus: row.requestStatus ?? row.requestStatusLabel ?? (monitoringPointCount > 0 ? 'เชื่อมต่อแล้ว' : 'ยังไม่มีจุดตรวจวัด'),
    status: row.status ?? 'แสดง',
  }
}

function mapRequestTableRow(row) {
  return {
    id: row.id,
    factoryId: row.factoryId ?? '',
    factoryName: row.factoryName ?? '',
    industryType: row.industryType ?? '',
    province: row.province ?? '',
    type: row.type ?? '',
    requestNo: row.requestNo ?? '',
    submittedAt: row.submittedAt ?? null,
    submittedDate: row.submittedDate ?? '',
    monitoringPointCode: row.monitoringPointCode ?? '',
    codeIssuedAt: row.codeIssuedAt ?? null,
    codeIssuedDate: row.codeIssuedDate ?? '',
    form: row.form ?? '',
    status: row.status ?? '',
    statusCode: row.statusCode ?? '',
    requestType: row.requestType ?? '',
  }
}

function mapRequestDetailRow(detail = {}, row = {}) {
  const factory = detail.factory ?? {}
  const firstPoint = Array.isArray(detail.measurementPoints) ? detail.measurementPoints[0] : null

  return {
    ...row,
    ...detail,
    id: detail.id ?? row.id,
    factoryId: detail.factoryId ?? factory.factoryId ?? row.factoryId ?? '',
    factoryName: detail.factoryName ?? factory.factoryName ?? row.factoryName ?? '',
    industryType: detail.industryType ?? factory.industryType ?? row.industryType ?? '',
    province: detail.province ?? factory.province ?? row.province ?? '',
    type: detail.type ?? detail.systemType ?? firstPoint?.details?.monitoringPointKind ?? row.type ?? '',
    requestNo: detail.requestNo ?? row.requestNo ?? '',
    submittedDate: detail.submittedDate ?? row.submittedDate ?? '',
    monitoringPointCode: detail.monitoringPointCode ?? firstPoint?.code ?? firstPoint?.monitoringPointCode ?? row.monitoringPointCode ?? '',
    codeIssuedDate: detail.codeIssuedDate ?? row.codeIssuedDate ?? '',
    form: detail.form ?? row.form ?? '',
    status: detail.status ?? row.status ?? '',
    statusCode: detail.statusCode ?? row.statusCode ?? '',
    requestType: detail.requestType ?? row.requestType ?? '',
  }
}

function getFormValue(formData, key, fallback = '') {
  if (!formData) {
    return fallback
  }

  const value = formData.get(key)
  return value === null ? fallback : String(value)
}

function getFormValues(formData, key) {
  if (!formData) {
    return []
  }

  return formData.getAll(key).map((value) => String(value)).filter(Boolean)
}

function getOptionalFormValue(formData, key) {
  const value = getFormValue(formData, key).trim()
  return value || null
}

function getFactoryNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numericValue = Number(value)
  return Number.isNaN(numericValue) ? value : numericValue
}

function getEiaValue(factory = {}) {
  if (typeof factory.hasEia === 'boolean') {
    return factory.hasEia ? 'มี' : 'ไม่มี'
  }

  return factory.eia ?? null
}

function getHasEiaValue(factory = {}) {
  if (typeof factory.hasEia === 'boolean') {
    return factory.hasEia
  }

  if (factory.eia === 'มี') {
    return true
  }

  if (factory.eia === 'ไม่มี') {
    return false
  }

  return null
}

function buildMeasurementInstrumentParameters(formData) {
  const rawParameters = getFormValues(formData, 'measurementInstrumentParameters')

  return rawParameters
    .map((rawParameter) => {
      try {
        return JSON.parse(rawParameter)
      } catch {
        return null
      }
    })
    .filter((parameter) => parameter?.parameter)
    .map((parameter) => ({
      parameter: parameter.parameter,
      technique: parameter.technique ?? null,
      range: parameter.range ?? null,
      brand: parameter.brand ?? null,
      supplier: parameter.supplier ?? null,
      eiaStandard: parameter.eiaStandard ?? null,
      standardCondition: Boolean(parameter.standardCondition),
      dryBasis: Boolean(parameter.dryBasis),
      oxygenOrExcessAir: Boolean(parameter.oxygenOrExcessAir),
      standardCriteria: parameter.standardCriteria ?? { enabled: false },
      eiaCriteria: parameter.eiaCriteria ?? { enabled: false },
    }))
}

function buildDocumentsAndImages(formData) {
  return documentImageItems.map((item, index) => {
    const file = formData?.get(`documentImageFile-${index}`)
    const fileName = file instanceof File && file.name ? file.name : null
    const fileType = file instanceof File && file.type ? file.type : null
    const fileSize = file instanceof File && typeof file.size === 'number' && file.size > 0 ? file.size : null

    return {
      title: item.title,
      description: item.description ?? null,
      link: getOptionalFormValue(formData, `documentImageLink-${index}`),
      fileName,
      fileUrl: null,
      fileType,
      fileSize,
    }
  })
}

function buildMeasurementPointRequestBody(factory = {}, monitoringPointType = 'CEMS', formData = null) {
  const isWpms = monitoringPointType === 'WPMS'
  const systemType = isWpms ? 'WPMS' : 'CEMS'
  const contactPersons = getFormValues(formData, 'contactName').map((name, index) => ({
    name,
    position: getFormValues(formData, 'contactPosition')[index] ?? '',
    phone: getFormValues(formData, 'contactPhone')[index] ?? '',
    email: getFormValues(formData, 'contactEmail')[index] ?? '',
  }))
  const notificationEmails = getFormValues(formData, 'notificationEmail')
  const officerNotificationEmails = getFormValues(formData, 'officerNotificationEmail')
  const pointCode = getFormValue(formData, 'pointCode')
  const pointName = getFormValue(formData, 'pointName')
  const converterBrand = getFormValue(formData, 'converterBrand')
  const converterModel = getFormValue(formData, 'converterModel')
  const instrumentParameters = buildMeasurementInstrumentParameters(formData)
  const documentsAndImages = buildDocumentsAndImages(formData)

  return {
    factoryId: factory.factoryId ?? factory.newRegistrationNo ?? '',
    factoryName: factory.factoryName ?? '',
    factoryRegistrationNo: factory.factoryRegistrationNo ?? factory.oldRegistrationNo ?? '',
    industryMainOrder: factory.industryMainOrder ?? factory.industryMainOrderNo ?? null,
    industrySubOrder: factory.industrySubOrder ?? factory.industrySubOrderNo ?? null,
    businessActivity: factory.businessActivity ?? null,
    eia: getEiaValue(factory),
    hasEia: getHasEiaValue(factory),
    projectName: factory.projectName ?? 'ไม่ระบุ',
    address: factory.address ?? null,
    latitude: getFactoryNumber(factory.latitude),
    longitude: getFactoryNumber(factory.longitude),
    systemType,
    contactPersons,
    notificationEmails,
    officerNotificationEmails,
    measurementPoints: [
      isWpms
        ? {
            pointCode,
            pointName,
            pointType: 'WASTEWATER',
            details: {
              monitoringPointKind: 'WPMS',
              averageWastewaterDischarge: toNumberOrNull(getFormValue(formData, 'averageWastewaterDischarge')),
              minWastewaterDischarge: toNumberOrNull(getFormValue(formData, 'minWastewaterDischarge')),
              maxWastewaterDischarge: toNumberOrNull(getFormValue(formData, 'maxWastewaterDischarge')),
              hasTreatmentSystem: getFormValue(formData, 'hasTreatmentSystem'),
              treatmentSystem: getFormValue(formData, 'treatmentSystem'),
              maxTreatmentCapacity: toNumberOrNull(getFormValue(formData, 'maxTreatmentCapacity')),
              instrumentLatitude: toNumberOrNull(getFormValue(formData, 'instrumentLatitude')),
              instrumentLongitude: toNumberOrNull(getFormValue(formData, 'instrumentLongitude')),
              wastewaterSource: getFormValue(formData, 'wastewaterSource'),
              dischargeReceivingSource: getFormValue(formData, 'dischargeReceivingSource'),
              connectionDevice: getFormValue(formData, 'connectionDevice'),
              connectionDeviceOther: getFormValue(formData, 'connectionDeviceOther'),
            },
            measurementInstruments: {
              converterBrand: converterBrand || null,
              converterModel: converterModel || null,
              parameters: instrumentParameters,
            },
          }
        : {
            pointCode,
            pointName,
            pointType: 'STACK',
            details: {
              monitoringPointKind: 'CEMS',
              productionUnitType: getOptionalFormValue(formData, 'productionUnitType'),
              productionCapacity: getOptionalFormValue(formData, 'productionCapacity'),
              cemsInstallationRequiredBy: getOptionalFormValue(formData, 'cemsInstallationRequiredBy'),
              cemsInstallationRequiredOther: getOptionalFormValue(formData, 'cemsInstallationRequiredOther'),
              legalAnnexNo: getOptionalFormValue(formData, 'legalAnnexNo'),
              eligibleParameters: getFormValues(formData, 'eligibleParameters'),
              exemptedParameters: getFormValues(formData, 'exemptedParameters'),
              connectedParameters: getFormValues(formData, 'connectedParameters'),
              pendingParameters: getFormValues(formData, 'pendingParameters'),
              stackShape: getOptionalFormValue(formData, 'stackShape'),
              stackDiameter: toNumberOrNull(getFormValue(formData, 'stackDiameter')),
              stackWidth: toNumberOrNull(getFormValue(formData, 'stackWidth')),
              stackLength: toNumberOrNull(getFormValue(formData, 'stackLength')),
              stackShapeOther: getOptionalFormValue(formData, 'stackShapeOther'),
              stackHeight: toNumberOrNull(getFormValue(formData, 'stackHeight')),
              monitoringHeight: toNumberOrNull(getFormValue(formData, 'monitoringHeight')),
              averageFlowRate: toNumberOrNull(getFormValue(formData, 'averageFlowRate')),
              minFlowRate: toNumberOrNull(getFormValue(formData, 'minFlowRate')),
              maxFlowRate: toNumberOrNull(getFormValue(formData, 'maxFlowRate')),
              primaryFuel: getOptionalFormValue(formData, 'primaryFuel'),
              primaryFuelOther: getOptionalFormValue(formData, 'primaryFuelOther'),
              primaryFuelPercent: toNumberOrNull(getFormValue(formData, 'primaryFuelPercent')),
              secondaryFuel: getOptionalFormValue(formData, 'secondaryFuel'),
              secondaryFuelOther: getOptionalFormValue(formData, 'secondaryFuelOther'),
              secondaryFuelPercent: toNumberOrNull(getFormValue(formData, 'secondaryFuelPercent')),
              combustionControlSystem: getOptionalFormValue(formData, 'combustionControlSystem'),
              hasTreatmentSystem: getOptionalFormValue(formData, 'hasTreatmentSystem'),
              treatmentSystem: getOptionalFormValue(formData, 'treatmentSystem'),
              treatmentSystemOther: getOptionalFormValue(formData, 'treatmentSystemOther'),
              stackLatitude: toNumberOrNull(getFormValue(formData, 'stackLatitude')),
              stackLongitude: toNumberOrNull(getFormValue(formData, 'stackLongitude')),
              connectionDevice: getOptionalFormValue(formData, 'connectionDevice'),
              connectionDeviceOther: getOptionalFormValue(formData, 'connectionDeviceOther'),
            },
            documentsAndImages,
            measurementInstruments: {
              converterBrand: converterBrand || null,
              converterModel: converterModel || null,
              parameters: instrumentParameters,
            },
          },
    ],
    remarks: isWpms ? 'ขอเพิ่มจุดตรวจวัด WPMS' : 'ขอเพิ่มจุดตรวจวัด',
  }
}

function StatusChip({ value }) {
  if (value === 'รอเชื่อมต่อ') {
    return <Chip label={value} size="small" variant="outlined" sx={{ ...waitingConnectionSx, fontWeight: 300 }} />
  }

  const color =
    value === 'เชื่อมต่อแล้ว'
      ? 'success'
      : value === 'รอโรงงานแก้ไข'
        ? 'warning'
        : value === 'ยืนยันการเชื่อมต่อ'
          ? 'info'
          : 'default'

  return <Chip label={value} color={color} size="small" variant={color === 'default' ? 'outlined' : 'filled'} />
}

function MenuButton({ label, options, onSelect, disabled = false }) {
  const [anchorEl, setAnchorEl] = useState(null)
  const isMenuOpen = Boolean(anchorEl)

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        endIcon={<KeyboardArrowDownIcon />}
        disabled={disabled}
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        {label}
      </Button>
      <Menu anchorEl={anchorEl} open={isMenuOpen} onClose={() => setAnchorEl(null)}>
        {options.map((option) => (
          <MenuItem
            key={typeof option === 'string' ? option : option.label}
            disabled={typeof option === 'string' ? false : option.disabled}
            onClick={() => {
              onSelect?.(typeof option === 'string' ? option : option.label)
              setAnchorEl(null)
            }}
          >
            {typeof option === 'string' ? option : option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

function FactoryStatusMenu({ status }) {
  const [selectedStatus, setSelectedStatus] = useState(status)

  return (
    <MenuButton
      label={selectedStatus}
      options={['แสดง', 'ซ่อน']}
      onSelect={(option) => setSelectedStatus(option)}
    />
  )
}

function OfficerFactoryActions({ row, onOpenMonitoringPoints }) {
  return (
    <Stack direction="row" spacing={1} sx={tableActionStackSx}>
      <Button size="small" variant="outlined" onClick={() => onOpenMonitoringPoints?.(row)}>
        ดูข้อมูล
      </Button>
      <Button size="small" color="error" variant="outlined">
        ลบ
      </Button>
      <FactoryStatusMenu status={row.status} />
    </Stack>
  )
}

function OperatorFactoryActions({ row, onOpenRequestForm, onOpenMonitoringPoints }) {
  return (
    <Stack direction="row" spacing={1} sx={tableActionStackSx}>
      <Button size="small" variant="outlined" onClick={() => onOpenMonitoringPoints?.(row)}>
        ดูข้อมูล
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={() => onOpenRequestForm?.(row, 'เพิ่มจุดตรวจวัด')}
      >
        เพิ่มจุดตรวจวัด
      </Button>
    </Stack>
  )
}

function OfficerRequestActions({ row, onOpenRequestDocument, onOpenRequestProcess }) {
  return (
    <Stack direction="row" spacing={1} sx={tableActionStackSx}>
      <Button size="small" variant="outlined" onClick={() => onOpenRequestDocument?.(row)}>
        เปิดดู
      </Button>
      <Button size="small" variant="contained" onClick={() => onOpenRequestProcess?.(row)}>
        ดำเนินการ
      </Button>
    </Stack>
  )
}

function ConnectionSettingsButton({ disabled, onClick }) {
  return (
    <Button
      size="small"
      variant="outlined"
      disabled={disabled}
      onClick={onClick}
      sx={{
        ...waitingConnectionSx,
        '&:hover': {
          bgcolor: '#4c1d95',
          borderColor: '#4c1d95',
        },
        '&.Mui-disabled': {
          bgcolor: 'action.disabledBackground',
          borderColor: 'divider',
          color: 'text.disabled',
        },
      }}
    >
      ตั้งค่า
    </Button>
  )
}

function OperatorRequestActions({ row, onOpenConnectionSettings, onOpenRequestDocument }) {
  const { status } = row
  const canModifyRequest = status === 'รอโรงงานแก้ไข'
  const canConfigureConnection = status === 'รอเชื่อมต่อ'

  return (
    <Stack direction="row" spacing={1} sx={tableActionStackSx}>
      <Button size="small" variant="outlined" onClick={() => onOpenRequestDocument?.(row)}>
        เปิดดู
      </Button>
      <Button size="small" variant="outlined" disabled={!canModifyRequest}>
        แก้ไข
      </Button>
      <Button size="small" color="error" variant="outlined" disabled={!canModifyRequest}>
        ยกเลิกคำขอ
      </Button>
      <ConnectionSettingsButton
        disabled={!canConfigureConnection}
        onClick={() => onOpenConnectionSettings?.(row)}
      />
    </Stack>
  )
}

function MonitoringPointActions({ point, isOperator, canAddParameterForFactory, onOpenConnectionSettings }) {
  const { status } = point
  const canConsider = ['รอพิจารณาแบบ', 'ยืนยันการเชื่อมต่อ', 'แก้ไขแล้ว/รอพิจารณาแบบ'].includes(status)
  const canModifyRequest = status === 'รอโรงงานแก้ไข'
  const canConfigureConnection = ['รอเชื่อมต่อ', 'ยืนยันการเชื่อมต่อ'].includes(status)
  const canAddParameter = canAddParameterForFactory && status === 'เชื่อมต่อแล้ว'

  if (!isOperator) {
    return (
      <Stack direction="row" spacing={1} sx={tableActionStackSx}>
        <Button size="small" variant="outlined">
          เปิดดู
        </Button>
        <Button size="small" variant="contained" disabled={!canConsider}>
          พิจารณา
        </Button>
      </Stack>
    )
  }

  return (
    <Stack direction="row" spacing={1} sx={tableActionStackSx}>
      <Button size="small" variant="outlined">
        เปิดดู
      </Button>
      <Button size="small" variant="outlined" disabled={!canModifyRequest}>
        แก้ไข
      </Button>
      <Button size="small" variant="outlined" disabled={!canAddParameter}>
        เพิ่มพารามิเตอร์
      </Button>
      <ConnectionSettingsButton
        disabled={!canConfigureConnection}
        onClick={() => onOpenConnectionSettings?.(point)}
      />
    </Stack>
  )
}

function MonitoringPointListDialog({ open, factory, isOperator, onOpenConnectionSettings, onClose }) {
  const rows = monitoringPointRows.filter((row) => row.factoryId === factory?.id)
  const canAddParameterForFactory = factory?.eligibilityStatus === 'เข้าข่าย'

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>รายการจุดตรวจวัด{factory?.factoryName ? ` - ${factory.factoryName}` : ''}</DialogTitle>
      <DialogContent dividers>
        <TableContainer sx={{ border: 1, borderColor: 'divider', overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 1120, ...borderedTableSx }}>
            <TableHead>
              <TableRow>
                {[
                  'รหัสจุดตรวจวัด',
                  'ชื่อจุดตรวจวัด',
                  'ประเภทจุดตรวจวัด',
                  'รายละเอียดพารามิเตอร์',
                  'สถานะ',
                  'จัดการ',
                ].map((column) => (
                  <TableCell key={column} sx={{ fontWeight: 700, bgcolor: 'neutral.50' }}>
                    {column}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.parameters.join(', ')}</TableCell>
                    <TableCell>
                      <StatusChip value={row.status} />
                    </TableCell>
                    <TableCell>
                      <MonitoringPointActions
                        point={row}
                        isOperator={isOperator}
                        canAddParameterForFactory={canAddParameterForFactory}
                        onOpenConnectionSettings={onOpenConnectionSettings}
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary">
                      ไม่มีข้อมูลจุดตรวจวัด
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ปิด
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function DocumentLine({ label, value = '', width = '100%' }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', width, minWidth: 0 }}>
      <Box component="span" sx={{ flex: '0 0 auto' }}>
        {label}
      </Box>
      <Box
        component="span"
        sx={{
          flex: 1,
          minWidth: 48,
          mx: 0.5,
          borderBottom: '1px dotted #555',
          lineHeight: 1.4,
          px: 0.5,
        }}
      >
        {value}
      </Box>
    </Box>
  )
}

function DocumentPage({ children, pageNo, totalPages = 5, revisionText = 'แก้ไข : 14 พฤศจิกายน 2567' }) {
  return (
    <Paper
      elevation={0}
      sx={{
        width: 794,
        minHeight: 1123,
        mx: 'auto',
        p: '54px 72px',
        color: '#000',
        bgcolor: '#fff',
        fontFamily: 'Kanit, sans-serif',
        fontSize: 16,
        lineHeight: 1.9,
        position: 'relative',
      }}
    >
      <Typography variant="body2" sx={{ position: 'absolute', top: 18, right: 72, fontWeight: 400 }}>
        {revisionText}
      </Typography>
      {children}
      <Typography sx={{ position: 'absolute', bottom: 28, left: 0, right: 0, textAlign: 'center', fontWeight: 700 }}>
        {pageNo}/{totalPages}
      </Typography>
    </Paper>
  )
}

function displayValue(value, fallback = '') {
  if (value === null || value === undefined || value === 'undefined') {
    return fallback
  }

  return String(value)
}

function joinList(values, fallback = '') {
  return Array.isArray(values) && values.length > 0 ? values.join(', ') : fallback
}

function formatFuel(name, other, percent) {
  const fuelName = other || name
  const fuelPercent = percent || percent === 0 ? ` ร้อยละโดยประมาณ ${percent}` : ''
  return fuelName ? `${fuelName}${fuelPercent}` : ''
}

function isPendingDesignReview(request) {
  return [request?.status, request?.statusLabel, request?.statusCode].includes('รอพิจารณาแบบ')
    || [request?.status, request?.statusLabel, request?.statusCode].includes('PENDING_DESIGN_REVIEW')
}

function RequestDocumentDialog({
  open,
  request,
  mode = 'view',
  title,
  loading,
  error,
  approving,
  onApprove,
  onClose,
  footerContent,
  footerActions,
}) {
  const isWpms = request?.type === 'WPMS'
  const factory = request?.factory ?? {}
  const points = Array.isArray(request?.measurementPoints) ? request.measurementPoints : []
  const point = points[0] ?? {}
  const details = point.details ?? {}
  const instruments = point.measurementInstruments ?? {}
  const instrumentParameters = Array.isArray(instruments.parameters) ? instruments.parameters : []
  const contactPersons = Array.isArray(request?.contactPersons) ? request.contactPersons : []
  const notificationEmails = Array.isArray(request?.notificationEmails) ? request.notificationEmails : []
  const officerNotificationEmails = Array.isArray(request?.officerNotificationEmails) ? request.officerNotificationEmails : []
  const firstCriteriaParameter = instrumentParameters.find((parameter) => parameter.standardCriteria || parameter.eiaCriteria)
  const documentParameters = instrumentParameters
  const systemName = isWpms
    ? 'ระบบตรวจวัดคุณภาพน้ำทิ้งอัตโนมัติอย่างต่อเนื่อง'
    : 'ระบบตรวจวัดคุณภาพอากาศจากปล่องแบบอัตโนมัติอย่างต่อเนื่อง'
  const systemCode = isWpms ? 'Water Pollution Monitoring System : WPMS' : 'Continuous Emission Monitoring Systems : CEMS'
  const canReview = mode === 'process' && isPendingDesignReview(request)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{title ?? `แบบฟอร์มคำขอ${request?.requestNo ? ` - ${request.requestNo}` : ''}`}</DialogTitle>
      <DialogContent dividers sx={{ bgcolor: 'neutral.100' }}>
        {loading ? (
          <Typography variant="body2" sx={{ mb: 2 }}>
            กำลังโหลดข้อมูลแบบฟอร์ม...
          </Typography>
        ) : null}
        {error ? (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {error}
          </Typography>
        ) : null}
        <Stack spacing={2}>
          {isWpms ? (
            <>
              <DocumentPage pageNo={1} totalPages={3} revisionText="แก้ไข : 14-11-67">
                <Stack spacing={3}>
                  <Box sx={{ textAlign: 'center', mt: 3 }}>
                    <Typography sx={{ fontSize: 20, fontWeight: 700 }}>แบบบันทึกข้อมูลโรงงานสำหรับการขอเชื่อมต่อระบบเฝ้าระวังและเตือนภัย</Typography>
                    <Typography sx={{ fontSize: 20, fontWeight: 700 }}>
                      มลพิษระยะไกล (Pollution Online Monitoring System : POMS)
                    </Typography>
                    <Typography sx={{ fontSize: 18, fontWeight: 700 }}>
                      (สำหรับระบบเฝ้าระวังมลพิษน้ำระยะไกล (Water Pollution Monitoring : WPMS))
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>1. ข้อมูลทั่วไปของโรงงาน</Typography>
                    <Stack spacing={1.1} sx={{ pl: 3, mt: 1 }}>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <DocumentLine label="ชื่อโรงงาน" value={request?.factoryName ?? factory.factoryName} />
                        <DocumentLine label="เลขทะเบียน" value={request?.factoryRegistrationNo ?? factory.newRegistrationNo ?? request?.factoryId} />
                      </Box>
                      <DocumentLine label="ประกอบกิจการ" value={request?.businessActivity ?? factory.businessActivity} />
                      <DocumentLine label="เขตประกอบการ/นิคมอุตสาหกรรม (ถ้ามี)" value="" />
                      <DocumentLine label="ที่ตั้ง เลขที่" value={request?.address ?? factory.address} />
                      <DocumentLine label="ตำบล" value="" />
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <DocumentLine label="พิกัดโรงงาน ละติจูด" value={displayValue(request?.latitude ?? factory.latitude)} />
                        <DocumentLine label="ลองติจูด" value={displayValue(request?.longitude ?? factory.longitude)} />
                      </Box>
                    </Stack>
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>2. ข้อมูลผู้ติดต่อประสานงาน</Typography>
                    {[1, 2].map((index) => (
                      <Stack key={index} spacing={1} sx={{ pl: 3, mt: 1 }}>
                        <DocumentLine label={`2.${index} ชื่อผู้ติดต่อประสานงาน`} value={contactPersons[index - 1]?.name} />
                        <DocumentLine label="ตำแหน่ง" value={contactPersons[index - 1]?.position} />
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <DocumentLine label="โทรศัพท์" value={contactPersons[index - 1]?.phone} />
                          <DocumentLine label="โทรศัพท์มือถือ" value={contactPersons[index - 1]?.phone} />
                        </Box>
                        <DocumentLine label="อีเมล" value={contactPersons[index - 1]?.email} />
                      </Stack>
                    ))}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>3. อีเมลสำหรับแจ้งเตือนค่าเกินมาตรฐาน</Typography>
                    <Stack spacing={0.5} sx={{ pl: 3, mt: 1 }}>
                      <DocumentLine label="3.1" value={notificationEmails[0]} />
                      <DocumentLine label="3.2" value={notificationEmails[1] ?? officerNotificationEmails[0]} />
                    </Stack>
                  </Box>
                </Stack>
              </DocumentPage>

              <DocumentPage pageNo={2} totalPages={3} revisionText="แก้ไข : 14-11-67">
                <Stack spacing={1.6}>
                  <Typography sx={{ fontWeight: 700 }}>4. รายละเอียดจุดตรวจวัดจุดที่ : {point.pointName ?? ''}</Typography>
                  <Box sx={{ pl: 3 }}>
                    <Typography>4.1 อัตราการระบายน้ำทิ้ง (Flow Rate)</Typography>
                    <Box sx={{ display: 'flex', gap: 2, pl: 5 }}>
                      <DocumentLine label="เฉลี่ย :" value={details.averageWastewaterDischarge ? `${details.averageWastewaterDischarge} m³/d` : ''} />
                      <DocumentLine label="ต่ำสุด :" value={details.minWastewaterDischarge ? `${details.minWastewaterDischarge} m³/d` : ''} />
                      <DocumentLine label="สูงสุด :" value={details.maxWastewaterDischarge ? `${details.maxWastewaterDischarge} m³/d` : ''} />
                    </Box>
                    <Typography>
                      4.2 ระบบบำบัด : □ ไม่มี &nbsp;&nbsp; □ มี (ระบุ) {details.treatmentSystemOther ?? details.treatmentSystem ?? ''}
                      /ปริมาณรองรับน้ำเสียสูงสุดของระบบบำบัด : {displayValue(details.maxTreatmentCapacity)}
                    </Typography>
                    <DocumentLine
                      label="4.3 พิกัดจุดที่ติดตั้งเครื่องมือตรวจวัด (BOD/COD Online) : ละติจูด"
                      value={`${displayValue(details.instrumentLatitude)}  ลองติจูด ${displayValue(details.instrumentLongitude)}`}
                    />
                    <DocumentLine
                      label="4.4 พิกัดจุดระบายน้ำทิ้งออกนอกโรงงาน : ละติจูด"
                      value={`${displayValue(point.latitude)}  ลองติจูด ${displayValue(point.longitude)}`}
                    />
                    <DocumentLine label="4.5 แหล่งกำเนิดน้ำเสีย :" value={details.wastewaterSource} />
                    <DocumentLine label="4.6 แหล่งรองรับน้ำทิ้ง :" value={details.dischargeReceivingSource} />
                    <DocumentLine label="4.7 อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ :" value={details.connectionDeviceOther ?? details.connectionDevice} />
                    <DocumentLine
                      label="4.8 อุปกรณ์แปลงสัญญาณ (Converter) ยี่ห้อ :"
                      value={`${displayValue(instruments.converterBrand)}   รุ่น : ${displayValue(instruments.converterModel)}`}
                    />
                  </Box>
                  <TableContainer>
                    <Table size="small" sx={{ border: '1px solid #555', '& th, & td': { border: '1px solid #555', p: 0.7, fontSize: 12 } }}>
                      <TableHead>
                        <TableRow>
                          {['พารามิเตอร์ที่ขอเชื่อมต่อ', 'เทคนิคตรวจวัด', 'ช่วงการวัด', 'ยี่ห้อเครื่องมือ', 'ผู้จำหน่ายเครื่องมือ', 'มาตรฐาน EIA', 'เลขช่องสัญญาณ'].map((column) => (
                            <TableCell key={column} align="center" sx={{ fontWeight: 700 }}>{column}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {documentParameters.map((parameter) => (
                          <TableRow key={parameter.parameter}>
                            <TableCell>{parameter.parameter}</TableCell>
                            <TableCell>{parameter.technique}</TableCell>
                            <TableCell>{parameter.range}</TableCell>
                            <TableCell>{parameter.brand}</TableCell>
                            <TableCell>{parameter.supplier}</TableCell>
                            <TableCell>{parameter.eiaStandard}</TableCell>
                            <TableCell>{parameter.signalChannel}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1 }}>
                    <Box>
                      <Typography variant="caption">หมายถึง ค่าที่ส่งต้องเป็นหน่วยเดียวกับหน่วยที่กำหนดในตาราง</Typography>
                      <Typography variant="caption" display="block">หมายถึง เลขช่องสัญญาณจากโปรแกรมส่งข้อมูล</Typography>
                    </Box>
                    <Box sx={{ width: 260 }}>
                      <DocumentLine label="ลงชื่อ" value="" />
                      <Typography sx={{ textAlign: 'center' }}>(........................................)</Typography>
                      <DocumentLine label="ตำแหน่ง" value="" />
                      <DocumentLine label="วันที่" value="........./........./........." />
                    </Box>
                  </Box>
                </Stack>
              </DocumentPage>

              <DocumentPage pageNo={3} totalPages={3} revisionText="แก้ไข : 14-11-67">
                <Stack spacing={3}>
                  {[
                    ['ตามประกาศ อก.', firstCriteriaParameter?.standardCriteria],
                    ['ตาม EIA', firstCriteriaParameter?.eiaCriteria],
                  ].map(([title, criteria]) => (
                    <Box key={title} sx={{ width: 520 }}>
                      <Typography sx={{ color: 'red', fontWeight: 700 }}>{title}</Typography>
                      <Table size="small" sx={{ border: '1px solid #555', '& th, & td': { border: '1px solid #555', p: 0.8 } }}>
                        <TableHead>
                          <TableRow>
                            <TableCell align="center" sx={{ bgcolor: '#00677a', color: '#fff', fontWeight: 700 }}>MIN</TableCell>
                            <TableCell align="center" sx={{ bgcolor: '#00677a', color: '#fff', fontWeight: 700 }}>เกณฑ์มลพิษ</TableCell>
                            <TableCell align="center" sx={{ bgcolor: '#00677a', color: '#fff', fontWeight: 700 }}>MAX</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(criteria?.rows ?? []).map((row) => (
                            <TableRow key={row.level}>
                              <TableCell align="center">{displayValue(row.min)}</TableCell>
                              <TableCell align="center">{row.level}</TableCell>
                              <TableCell align="center">{displayValue(row.max)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <DocumentLine label="ค่ามาตรฐาน" value={criteria?.standardValue} width="60%" />
                    </Box>
                  ))}
                </Stack>
              </DocumentPage>
            </>
          ) : (
            <>
          <DocumentPage pageNo={1}>
            <Stack spacing={3}>
              <Box sx={{ textAlign: 'center', mt: 3 }}>
                <Typography sx={{ fontSize: 20, fontWeight: 700 }}>แบบบันทึกข้อมูลโรงงานสำหรับการขอเชื่อมต่อระบบเฝ้าระวัง</Typography>
                <Typography sx={{ fontSize: 20, fontWeight: 700 }}>
                  และเตือนภัยมลพิษระยะไกล (Pollution Online Monitoring System : POMS)
                </Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 700 }}>({systemName}</Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 700 }}>{systemCode})</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700 }}>1. ข้อมูลทั่วไปของโรงงาน</Typography>
                <Stack spacing={1.1} sx={{ pl: 3, mt: 1 }}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <DocumentLine label="ชื่อโรงงาน" value={request?.factoryName ?? factory.factoryName} />
                    <DocumentLine label="เลขทะเบียน" value={request?.factoryRegistrationNo ?? factory.newRegistrationNo ?? request?.factoryId} />
                  </Box>
                  <DocumentLine label="ลำดับประเภทโรงงาน" value={request?.industryMainOrder ?? factory.industryMainOrder} width="58%" />
                  <DocumentLine label="ประกอบกิจการ" value={request?.businessActivity ?? factory.businessActivity} width="58%" />
                  <DocumentLine label="เขตประกอบการ/นิคมอุตสาหกรรม (ถ้ามี)" value="-" width="85%" />
                  <DocumentLine label="การประเมินผลกระทบสิ่งแวดล้อม" value={request?.eia ?? factory.eia} width="85%" />
                  <DocumentLine label="ที่ตั้ง เลขที่" value={request?.address ?? factory.address} />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <DocumentLine label="พิกัดโรงงาน ละติจูด" value={displayValue(request?.latitude ?? factory.latitude)} />
                    <DocumentLine label="ลองติจูด" value={displayValue(request?.longitude ?? factory.longitude)} />
                  </Box>
                </Stack>
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700 }}>2. ข้อมูลผู้ติดต่อประสานงาน</Typography>
                {[1, 2].map((index) => (
                  <Stack key={index} spacing={1} sx={{ pl: 3, mt: 1 }}>
                    <DocumentLine label={`2.${index} ชื่อผู้ติดต่อประสานงาน`} value={contactPersons[index - 1]?.name} width="62%" />
                    <DocumentLine label="ตำแหน่ง" value={contactPersons[index - 1]?.position} width="62%" />
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <DocumentLine label="โทรศัพท์" value={contactPersons[index - 1]?.phone} />
                      <DocumentLine label="โทรศัพท์มือถือ" value={contactPersons[index - 1]?.phone} />
                    </Box>
                    <DocumentLine label="อีเมล" value={contactPersons[index - 1]?.email} width="50%" />
                  </Stack>
                ))}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700 }}>3. อีเมลสำหรับแจ้งเตือนค่าเกินมาตรฐาน</Typography>
                <Typography sx={{ pl: 3, fontWeight: 700 }}>3.1 สำหรับโรงงาน</Typography>
                <Stack spacing={0.5} sx={{ pl: 4 }}>
                  <DocumentLine label="1)" value={notificationEmails[0]} width="46%" />
                  <DocumentLine label="2)" value={notificationEmails[1]} width="46%" />
                </Stack>
              </Box>
            </Stack>
          </DocumentPage>

          <DocumentPage pageNo={2}>
            <Stack spacing={2.5}>
              <Box>
                <Typography sx={{ pl: 3, fontWeight: 700 }}>3.2 สำหรับเจ้าหน้าที่</Typography>
                <Stack spacing={0.5} sx={{ pl: 4 }}>
                  <DocumentLine label="1)" value={officerNotificationEmails[0]} width="46%" />
                  <DocumentLine label="2)" value={officerNotificationEmails[1]} width="46%" />
                </Stack>
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700 }}>4. รายละเอียดจุดตรวจวัดจุดที่ : ...</Typography>
                <Typography sx={{ pl: 3, mt: 1, fontWeight: 700 }}>
                  4.1 รายละเอียดของหน่วยที่ติดตั้ง {isWpms ? 'WPMS (จุดระบายน้ำทิ้ง)' : 'CEMS'}
                </Typography>
                <Stack spacing={1} sx={{ pl: 5, mt: 1 }}>
                  <DocumentLine label="4.1.1 รหัสจุดตรวจวัด :" value={point.pointCode ?? request?.monitoringPointCode} width="66%" />
                  <DocumentLine label="4.1.2 ชื่อจุดตรวจวัด :" value={point.pointName} width="66%" />
                  <DocumentLine label="4.1.3 ประเภทของหน่วยการผลิต :" value={details.productionUnitType ?? (isWpms ? 'ระบบบำบัดน้ำเสีย' : '')} width="66%" />
                  <DocumentLine label="4.1.4 กำลังการผลิตต่อหน่วย :" value={details.productionCapacity} width="66%" />
                </Stack>
              </Box>
              <Box>
                <Typography sx={{ pl: 3, fontWeight: 700 }}>4.2 การติดตั้ง {isWpms ? 'WPMS' : 'CEMS'}</Typography>
                <Stack spacing={1} sx={{ pl: 5, mt: 1 }}>
                  <DocumentLine label={`4.2.1 เข้าข่ายต้องติดตั้ง ${isWpms ? 'WPMS' : 'CEMS'} ตามกฎหมาย :`} value={details.cemsInstallationRequiredOther ?? details.cemsInstallationRequiredBy} />
                  <DocumentLine label="4.2.2 เข้าข่ายตามบัญชีแนบท้ายลำดับที่ :" value={details.legalAnnexNo} />
                  <DocumentLine label="4.2.3 พารามิเตอร์ที่เข้าข่าย :" value={joinList(details.eligibleParameters ?? point.parameters)} />
                  <DocumentLine label="4.2.4 พารามิเตอร์ที่ได้รับการยกเว้นตามประกาศฯ ข้อ :" value={joinList(details.exemptedParameters)} />
                  <DocumentLine label="4.2.5 พารามิเตอร์ที่เชื่อมต่อแล้ว :" value={joinList(details.connectedParameters)} />
                  <DocumentLine label="4.2.6 พารามิเตอร์ที่ยังไม่เชื่อมต่อ :" value={joinList(details.pendingParameters ?? point.parameters)} />
                </Stack>
              </Box>
              <Box>
                <Typography sx={{ pl: 3, fontWeight: 700 }}>4.3 รายละเอียด{isWpms ? 'จุดติดตั้งเครื่องมือตรวจวัด' : 'ปล่อง'}</Typography>
                <Stack spacing={1} sx={{ pl: 5, mt: 1 }}>
                  {isWpms ? (
                    <>
                      <DocumentLine label="4.3.1 อัตราการระบายน้ำทิ้งเฉลี่ย :" value={details.averageWastewaterDischarge} />
                      <DocumentLine label="4.3.2 อัตราการระบายน้ำทิ้งต่ำสุด :" value={details.minWastewaterDischarge} />
                      <DocumentLine label="4.3.3 อัตราการระบายน้ำทิ้งสูงสุด :" value={details.maxWastewaterDischarge} />
                      <DocumentLine label="4.3.4 พิกัดจุดติดตั้งเครื่องมือตรวจวัด ละติจูด :" value={`${displayValue(details.instrumentLatitude)}  ลองติจูด ${displayValue(details.instrumentLongitude)}`} />
                    </>
                  ) : (
                    <>
                      <Typography>
                        4.3.1 ลักษณะปล่อง : □ วงกลม (เส้นผ่านศูนย์กลาง {displayValue(details.stackDiameter, '............')} เมตร)
                      </Typography>
                      <Typography sx={{ pl: 12 }}>
                        □ สี่เหลี่ยม (กว้าง {displayValue(details.stackWidth, '............')} เมตร / ยาว {displayValue(details.stackLength, '............')} เมตร)
                      </Typography>
                      <Typography sx={{ pl: 12 }}>□ อื่นๆ (ระบุ) {displayValue(details.stackShapeOther, '....................................................')}</Typography>
                      <DocumentLine label="4.3.2 ความสูงปล่อง :" value={`${displayValue(details.stackHeight)} เมตร / ความสูงของจุดตรวจวัด : ${displayValue(details.monitoringHeight)} เมตร`} />
                      <Typography>4.3.3 อัตราการระบายอากาศ (Flow Rate)</Typography>
                      <Stack spacing={1} sx={{ pl: 5 }}>
                        <DocumentLine
                          label="4.3.3.1 อัตราการระบายอากาศ (Flow Rate) เฉลี่ย :"
                          value={details.averageFlowRate || details.averageFlowRate === 0 ? `${details.averageFlowRate} m³/hr` : ''}
                          width="82%"
                        />
                        <DocumentLine
                          label="4.3.3.2 อัตราการระบายอากาศ (Flow Rate) ต่ำสุด :"
                          value={details.minFlowRate || details.minFlowRate === 0 ? `${details.minFlowRate} m³/hr` : ''}
                          width="82%"
                        />
                        <DocumentLine
                          label="4.3.3.3 อัตราการระบายอากาศ (Flow Rate) สูงสุด :"
                          value={details.maxFlowRate || details.maxFlowRate === 0 ? `${details.maxFlowRate} m³/hr` : ''}
                          width="82%"
                        />
                      </Stack>
                      <DocumentLine label="4.3.4 เชื้อเพลิงหลักที่ใช้ :" value={formatFuel(details.primaryFuel, details.primaryFuelOther, details.primaryFuelPercent)} />
                    </>
                  )}
                </Stack>
              </Box>
            </Stack>
          </DocumentPage>

          <DocumentPage pageNo={3}>
            <Stack spacing={3}>
              <Box>
                <Stack spacing={1} sx={{ pl: 5 }}>
                  <DocumentLine label="4.3.5 เชื้อเพลิงรอง (ถ้ามี) :" value={formatFuel(details.secondaryFuel, details.secondaryFuelOther, details.secondaryFuelPercent)} />
                  <DocumentLine label="4.3.6 ระบบการควบคุมปริมาณอากาศและสภาวะการเผาไหม้ :" value={details.combustionControlSystem} />
                  <Typography>
                    4.3.7 ระบบบำบัด : □ ไม่มี &nbsp;&nbsp; □ มี (ระบุ) {details.treatmentSystemOther ?? details.treatmentSystem ?? ''}
                  </Typography>
                  <DocumentLine label={`4.3.8 พิกัด${isWpms ? 'จุดติดตั้งเครื่องมือ' : 'ปล่องที่ติดตั้ง CEMS'} : ละติจูด`} value={`${displayValue(details.stackLatitude ?? details.instrumentLatitude)}  ลองติจูด ${displayValue(details.stackLongitude ?? details.instrumentLongitude)}`} />
                </Stack>
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700 }}>4.4 รายละเอียดคอมพิวเตอร์หรืออุปกรณ์ติดตั้งโปรแกรม</Typography>
                <DocumentLine label="อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ :" value={details.connectionDeviceOther ?? details.connectionDevice} />
              </Box>
              {!isWpms ? (
                <>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>4.5 ข้อมูลรายละเอียดการรายงานค่าที่สภาวะมาตรฐาน</Typography>
                    <Typography sx={{ textIndent: 48, mt: 1 }}>
                      ให้แสดงรายละเอียดหรือแนบเอกสารหรือรูปภาพหน้าโปรแกรมของเครื่องมือที่แสดงให้เห็นถึงการคำนวณและการรายงานค่าของมลพิษในอากาศเสียที่สภาวะมาตรฐาน ความดัน 1 บรรยากาศ หรือ 760 มิลลิเมตรปรอท อุณหภูมิ 25 องศาเซลเซียสที่สภาวะแห้ง (Dry basis)
                    </Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 700 }}>4.6 รายงานผลการทำ RATA หรือ อื่นๆ ที่เทียบเท่า ของระบบ CEMS ครั้งล่าสุด</Typography>
                  <Typography sx={{ fontWeight: 700 }}>4.7 ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน</Typography>
                  <Typography sx={{ fontWeight: 700 }}>4.8 สัญลักษณ์ของโรงงานหรือโลโก้บริษัท</Typography>
                  <Typography sx={{ fontWeight: 700 }}>4.9 ภาพถ่ายปล่อง</Typography>
                  <Typography sx={{ fontWeight: 700 }}>4.10 ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (CEMS)</Typography>
                </>
              ) : (
                <>
                  <Typography sx={{ fontWeight: 700 }}>4.5 แหล่งกำเนิดน้ำเสีย : {details.wastewaterSource ?? ''}</Typography>
                  <Typography sx={{ fontWeight: 700 }}>4.6 แหล่งรองรับน้ำทิ้ง : {details.dischargeReceivingSource ?? ''}</Typography>
                </>
              )}
            </Stack>
          </DocumentPage>

          <DocumentPage pageNo={4}>
            <Stack spacing={2}>
              <Typography sx={{ fontWeight: 700 }}>5. รายละเอียดเครื่องมือตรวจวัด</Typography>
              <DocumentLine label="อุปกรณ์แปลงสัญญาณ (Converter) ยี่ห้อ :" value={`${displayValue(instruments.converterBrand)}   รุ่น : ${displayValue(instruments.converterModel)}`} />
              <TableContainer>
                <Table size="small" sx={{ border: '1px solid #555', '& th, & td': { border: '1px solid #555', p: 0.7, fontSize: 12 } }}>
                  <TableHead>
                    <TableRow>
                      {['พารามิเตอร์ที่ขอเชื่อมต่อ', 'เทคนิคตรวจวัด', 'ช่วงการวัด', 'ยี่ห้อเครื่องมือ', 'ผู้จำหน่ายเครื่องมือ', 'มาตรฐาน EIA', 'สภาวะมาตรฐาน', 'Dry basis', 'O₂ @ 7%'].map((column) => (
                        <TableCell key={column} align="center" sx={{ fontWeight: 700 }}>{column}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {documentParameters.map((parameter) => (
                      <TableRow key={parameter.parameter}>
                        <TableCell>{parameter.parameter}</TableCell>
                        <TableCell>{parameter.technique}</TableCell>
                        <TableCell>{parameter.range}</TableCell>
                        <TableCell>{parameter.brand}</TableCell>
                        <TableCell>{parameter.supplier}</TableCell>
                        <TableCell>{parameter.eiaStandard}</TableCell>
                        <TableCell align="center">{parameter.standardCondition ? '✓' : ''}</TableCell>
                        <TableCell align="center">{parameter.dryBasis ? '✓' : ''}</TableCell>
                        <TableCell align="center">{parameter.oxygenOrExcessAir ? '✓' : ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2 }}>
                <Typography variant="caption">หมายเหตุ: ✓ ใช่, ✕ ไม่ใช่</Typography>
                <Box sx={{ width: 260 }}>
                  <DocumentLine label="ลงชื่อ" value="" />
                  <Typography sx={{ textAlign: 'center' }}>(........................................)</Typography>
                  <DocumentLine label="ตำแหน่ง" value="" />
                  <DocumentLine label="วันที่" value="........./........./........." />
                </Box>
              </Box>
            </Stack>
          </DocumentPage>

          <DocumentPage pageNo={5}>
            <Stack spacing={3}>
              <Typography sx={{ fontWeight: 700 }}>แนบรายละเอียดเกณฑ์มาตรฐาน</Typography>
              {[
                ['ตามประกาศ อก.', firstCriteriaParameter?.standardCriteria],
                ['ตาม EIA', firstCriteriaParameter?.eiaCriteria],
              ].map(([title, criteria]) => (
                <Box key={title} sx={{ width: 520 }}>
                  <Typography sx={{ color: 'red', fontWeight: 700 }}>{title}</Typography>
                  <Table size="small" sx={{ border: '1px solid #555', '& th, & td': { border: '1px solid #555', p: 0.8 } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell align="center" sx={{ bgcolor: '#00677a', color: '#fff', fontWeight: 700 }}>MIN</TableCell>
                        <TableCell align="center" sx={{ bgcolor: '#00677a', color: '#fff', fontWeight: 700 }}>เกณฑ์มลพิษ</TableCell>
                        <TableCell align="center" sx={{ bgcolor: '#00677a', color: '#fff', fontWeight: 700 }}>MAX</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(criteria?.rows ?? []).map((row) => (
                        <TableRow key={row.level}>
                          <TableCell align="center">{displayValue(row.min)}</TableCell>
                          <TableCell align="center">{row.level}</TableCell>
                          <TableCell align="center">{displayValue(row.max)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <DocumentLine label="ค่ามาตรฐาน" value={criteria?.standardValue} width="60%" />
                </Box>
              ))}
            </Stack>
          </DocumentPage>
            </>
          )}
        </Stack>
      </DialogContent>
      {footerContent || footerActions ? (
        <DialogActions sx={{ display: 'block', px: 3, py: 2 }}>
          {footerContent}
          {footerActions}
        </DialogActions>
      ) : (
        <DialogActions sx={{ justifyContent: 'center' }}>
          <Button color="inherit" disabled={approving} onClick={onClose}>ปิด</Button>
          {canReview ? (
            <>
              <Button variant="outlined" disabled={approving}>แจ้งแก้ไข</Button>
              <Button variant="contained" disabled={approving || loading} onClick={onApprove}>
                {approving ? 'กำลังอนุมัติ' : 'อนุมัติ'}
              </Button>
            </>
          ) : null}
        </DialogActions>
      )}
    </Dialog>
  )
}

function PositiveNumberField({ label, value, onChange, min = 1, placeholder }) {
  return (
    <TextField
      label={label}
      type="number"
      size="small"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      fullWidth
      slotProps={{ htmlInput: { min, step: 1 } }}
    />
  )
}

function OptionSelectField({ label, value, options, onChange, defaultOption }) {
  return (
    <TextField select label={label} size="small" value={value} onChange={(event) => onChange(event.target.value)} fullWidth>
      <MenuItem value="">
        <em>ไม่ระบุ</em>
      </MenuItem>
      {options.map((option) => (
        <MenuItem key={option} value={option}>
          {option}{option === defaultOption ? ' (default)' : ''}
        </MenuItem>
      ))}
    </TextField>
  )
}

function ConnectionFormFields({ connectionType, value, onChange }) {
  const updateField = (field, nextValue) => onChange({ ...value, [field]: nextValue })

  if (!connectionType) {
    return null
  }

  if (connectionType === 'Modbus RTU') {
    return (
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <PositiveNumberField label="COMPORT" value={value.comport} onChange={(nextValue) => updateField('comport', nextValue)} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <PositiveNumberField label="Slave ID" value={value.slaveId} onChange={(nextValue) => updateField('slaveId', nextValue)} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <OptionSelectField label="Baud Rate" value={value.baudRate} options={baudRateOptions} defaultOption="9600" onChange={(nextValue) => updateField('baudRate', nextValue)} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <OptionSelectField label="Parity" value={value.parity} options={parityOptions} defaultOption="None" onChange={(nextValue) => updateField('parity', nextValue)} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <OptionSelectField label="Stop bits" value={value.stopBits} options={stopBitsOptions} defaultOption="1" onChange={(nextValue) => updateField('stopBits', nextValue)} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <OptionSelectField label="Data bits" value={value.dataBits} options={dataBitsOptions} defaultOption="8" onChange={(nextValue) => updateField('dataBits', nextValue)} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ช่วงข้อมูลตรวจวัด Min" size="small" value={value.measureMin} onChange={(event) => updateField('measureMin', event.target.value)} placeholder="เช่น 0" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ช่วงข้อมูลตรวจวัด Max" size="small" value={value.measureMax} onChange={(event) => updateField('measureMax', event.target.value)} placeholder="เช่น 200" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <PositiveNumberField label="Quantity" value={value.quantity} onChange={(nextValue) => updateField('quantity', nextValue)} />
        </Grid>
      </Grid>
    )
  }

  if (connectionType === 'Modbus TCP') {
    return (
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <PositiveNumberField label="Slave ID" value={value.slaveId} onChange={(nextValue) => updateField('slaveId', nextValue)} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="Host IP" size="small" value={value.hostIp} onChange={(event) => updateField('hostIp', event.target.value)} placeholder="เช่น 192.168.1.10" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <PositiveNumberField label="Port" value={value.port} onChange={(nextValue) => updateField('port', nextValue)} />
        </Grid>
      </Grid>
    )
  }

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 3 }}>
        <TextField label="Host IP" size="small" value={value.hostIp} onChange={(event) => updateField('hostIp', event.target.value)} placeholder="เช่น 192.168.1.254" fullWidth />
      </Grid>
      <Grid size={{ xs: 12, md: 3 }}>
        <PositiveNumberField label="Port" value={value.port} onChange={(nextValue) => updateField('port', nextValue)} />
      </Grid>
      <Grid size={{ xs: 12, md: 3 }}>
        <TextField label="dbUser" size="small" value={value.dbUser} onChange={(event) => updateField('dbUser', event.target.value)} fullWidth />
      </Grid>
      <Grid size={{ xs: 12, md: 3 }}>
        <TextField label="dbPass" type="password" size="small" value={value.dbPass} onChange={(event) => updateField('dbPass', event.target.value)} fullWidth />
      </Grid>
      <Grid size={{ xs: 12, md: 3 }}>
        <TextField label="dbName" size="small" value={value.dbName} onChange={(event) => updateField('dbName', event.target.value)} fullWidth />
      </Grid>
    </Grid>
  )
}

function createEmptyParameterMappingRow(parameter, index) {
  return {
    id: `${parameter}-${index}`,
    deviceCode: '',
    addressId: '',
    parameter,
    unit: parameterUnitMap[parameter] ?? '',
    min: '',
    max: '',
    valueFormat: '',
    offset: '',
    encodingData: '',
    status: '',
  }
}

function mapParameterMappingRows(parameterMappings = [], parameterOptions = []) {
  if (!parameterMappings.length) {
    return parameterOptions.map(createEmptyParameterMappingRow)
  }

  return parameterMappings.map((mapping, index) => {
    const parameter = mapping.parameter ?? mapping.parameterName ?? ''

    return {
      id: mapping.id ?? `${parameter}-${index}`,
      deviceCode: mapping.deviceCode ?? mapping.device_code ?? '',
      addressId: mapping.addressId ?? mapping.address_id ?? mapping.address ?? '',
      parameter,
      unit: mapping.unit ?? parameterUnitMap[parameter] ?? '',
      min: mapping.min ?? mapping.measureMin ?? '',
      max: mapping.max ?? mapping.measureMax ?? '',
      valueFormat: mapping.valueFormat ?? mapping.dataValueFormat ?? '',
      offset: mapping.offset ?? '',
      encodingData: mapping.encodingData ?? mapping.encoding ?? '',
      status: mapping.status ?? '',
    }
  })
}

function ConnectionParameterTable({ deviceCodeOptions, rows, setRows }) {
  const updateRow = (index, field, nextValue) => {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) {
          return row
        }
        if (field === 'parameter') {
          return { ...row, parameter: nextValue, unit: parameterUnitMap[nextValue] ?? row.unit }
        }
        return { ...row, [field]: nextValue }
      }),
    )
  }
  const columns = [
    { label: 'รหัสอุปกรณ์', width: 170 },
    { label: 'Address ID', width: 124 },
    { label: 'พารามิเตอร์', width: 144 },
    { label: 'Min', width: 108 },
    { label: 'Max', width: 108 },
    { label: 'รูปแบบค่าข้อมูลตรวจวัด', width: 220 },
    { label: 'ค่า Offset', width: 108 },
    { label: 'Encoding data', width: 230 },
    { label: 'สถานะ', width: 170 },
  ]

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        การเชื่อมต่อพารามิเตอร์
      </Typography>
      <TableContainer sx={{ border: 1, borderColor: 'divider', overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 1302, ...borderedTableSx }}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.label} sx={{ width: column.width, minWidth: column.width, fontWeight: 700, bgcolor: 'neutral.50' }}>
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row, index) => (
                <TableRow key={`${row.addressId}-${row.parameter}-${index}`}>
                  <TableCell sx={{ minWidth: 170 }}>
                    <TextField
                      select
                      size="small"
                      value={deviceCodeOptions.includes(row.deviceCode) ? row.deviceCode : ''}
                      onChange={(event) => updateRow(index, 'deviceCode', event.target.value)}
                      fullWidth
                    >
                      <MenuItem value="">
                        <em>ไม่ระบุ</em>
                      </MenuItem>
                      {deviceCodeOptions.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell sx={{ minWidth: 124 }}>
                    <PositiveNumberField
                      label=""
                      min={40001}
                      value={row.addressId}
                      onChange={(nextValue) => updateRow(index, 'addressId', nextValue)}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 144 }}>
                    <TextField
                      size="small"
                      value={row.parameter}
                      fullWidth
                      slotProps={{ input: { readOnly: true } }}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 108 }}>
                    <TextField
                      size="small"
                      value={row.min}
                      onChange={(event) => updateRow(index, 'min', event.target.value)}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 108 }}>
                    <TextField
                      size="small"
                      value={row.max}
                      onChange={(event) => updateRow(index, 'max', event.target.value)}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 220 }}>
                    <TextField
                      select
                      size="small"
                      value={row.valueFormat}
                      onChange={(event) => updateRow(index, 'valueFormat', event.target.value)}
                      fullWidth
                    >
                      <MenuItem value="">
                        <em>ไม่ระบุ</em>
                      </MenuItem>
                      {dataValueFormatOptions.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell sx={{ minWidth: 108 }}>
                    <TextField
                      type="number"
                      size="small"
                      value={row.offset}
                      onChange={(event) => updateRow(index, 'offset', event.target.value)}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 230 }}>
                    <TextField
                      select
                      size="small"
                      value={row.encodingData}
                      onChange={(event) => updateRow(index, 'encodingData', event.target.value)}
                      fullWidth
                    >
                      <MenuItem value="">
                        <em>ไม่ระบุ</em>
                      </MenuItem>
                      {encodingDataOptions.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell sx={{ minWidth: 170 }}>
                    <TextField
                      select
                      size="small"
                      value={row.status}
                      onChange={(event) => updateRow(index, 'status', event.target.value)}
                      fullWidth
                    >
                      <MenuItem value="">
                        <em>ไม่ระบุ</em>
                      </MenuItem>
                      {connectionParameterStatusOptions.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} align="center">
                  <Typography variant="body2" color="text.secondary">
                    ยังไม่มีข้อมูลการเชื่อมต่อพารามิเตอร์
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  )
}

function StatusManagementSection({ parameterOptions, statusManagement, onChange }) {
  const allOption = 'ทั้งหมด'
  const [selectedParameters, setSelectedParameters] = useState(statusManagement?.selectedParameters ?? [])
  const [status, setStatus] = useState(statusManagement?.status ?? '')
  const [startAt, setStartAt] = useState(statusManagement?.startAt ?? '')
  const [endAt, setEndAt] = useState(statusManagement?.endAt ?? '')
  const updateStatusManagement = (nextValue) => {
    onChange?.({
      selectedParameters,
      startAt,
      endAt,
      status,
      schedules: statusManagement?.schedules ?? [],
      ...nextValue,
    })
  }

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          จัดการสถานะ
        </Typography>
        <Typography variant="body2" color="text.secondary">
          ตั้งเวลาสำหรับเปลี่ยนสถานะชั่วคราว รายพารามิเตอร์ โดยสามารถเลือกทั้งหมดได้
        </Typography>
      </Stack>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>เลือกพารามิเตอร์</InputLabel>
            <Select
              multiple
              value={selectedParameters}
              label="เลือกพารามิเตอร์"
              input={<OutlinedInput label="เลือกพารามิเตอร์" />}
              onChange={(event) => {
                const selectedValue = event.target.value
                const nextValue = typeof selectedValue === 'string' ? selectedValue.split(',') : selectedValue
                const nextSelectedParameters = nextValue.includes(allOption) ? [allOption] : nextValue
                setSelectedParameters(nextSelectedParameters)
                updateStatusManagement({ selectedParameters: nextSelectedParameters })
              }}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((item) => (
                    <Chip key={item} label={item} size="small" />
                  ))}
                </Box>
              )}
            >
              {[allOption, ...parameterOptions].map((option) => (
                <MenuItem key={option} value={option}>
                  <Checkbox checked={selectedParameters.includes(option)} />
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, md: 2 }}>
          <TextField
            label="วันเวลาเริ่มต้น"
            type="datetime-local"
            size="small"
            value={startAt ?? ''}
            onChange={(event) => {
              setStartAt(event.target.value)
              updateStatusManagement({ startAt: event.target.value || null })
            }}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 2 }}>
          <TextField
            label="วันเวลาสิ้นสุด"
            type="datetime-local"
            size="small"
            value={endAt ?? ''}
            onChange={(event) => {
              setEndAt(event.target.value)
              updateStatusManagement({ endAt: event.target.value || null })
            }}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 2 }}>
          <TextField
            select
            label="สถานะ"
            size="small"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              updateStatusManagement({ status: event.target.value })
            }}
            fullWidth
          >
            <MenuItem value="">
              <em>ไม่ระบุ</em>
            </MenuItem>
            {connectionParameterStatusOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>
    </Stack>
  )
}

const protocolCodeMap = {
  'Modbus RTU': 'MODBUS_RTU',
  'Modbus TCP': 'MODBUS_TCP',
  'Microsoft SQL': 'MICROSOFT_SQL',
  MySQL: 'MYSQL',
}

const protocolLabelMap = {
  MODBUS_RTU: 'Modbus RTU',
  MODBUS_TCP: 'Modbus TCP',
  MICROSOFT_SQL: 'Microsoft SQL',
  MYSQL: 'MySQL',
}

function normalizeConnectionType(type) {
  return protocolLabelMap[type] ?? type ?? ''
}

function mapConnectionForms(forms = []) {
  return forms.map((form, index) => {
    const type = normalizeConnectionType(form.type ?? form.connectionType ?? form.protocol)
    const values = form.values ?? form.settings ?? form.config ?? form.connectionConfig ?? form

    return {
      id: form.id ?? Date.now() + index,
      type,
      values: {
        ...getDefaultConnectionForm(type),
        ...values,
      },
    }
  })
}

function mapTestResultRows(testResults = []) {
  return testResults.map((result, index) => ({
    id: result.id ?? index,
    values: result.values ?? result.data ?? result.parameters ?? {},
    timestamp: result.timestamp ?? result.createdAt ?? result.testedAt ?? '',
  }))
}

const parityCodeMap = {
  Even: 'EVEN',
  Odd: 'ODD',
  None: 'NONE',
}

const valueFormatCodeMap = {
  ค่าข้อมูลตรวจวัด: 'MEASUREMENT_VALUE',
  ค่ากระแสไฟฟ้า: 'CURRENT_VALUE',
  ค่าแรงดันไฟฟ้า: 'VOLTAGE_VALUE',
}

const encodingCodeMap = {
  'Signed16 - Big Endian': 'SIGNED16_BIG_ENDIAN',
  'Signed16 - Little Endian': 'SIGNED16_LITTLE_ENDIAN',
  'Unsigned16 - Big Endian': 'UNSIGNED16_BIG_ENDIAN',
  'Unsigned16 - Little Endian': 'UNSIGNED16_LITTLE_ENDIAN',
  'Signed32 - Big Endian': 'SIGNED32_BIG_ENDIAN',
  'Signed32 - Little Endian': 'SIGNED32_LITTLE_ENDIAN',
  'Unsigned32 - Big Endian': 'UNSIGNED32_BIG_ENDIAN',
  'Unsigned32 - Little Endian': 'UNSIGNED32_LITTLE_ENDIAN',
  'Float32 - Big Endian': 'FLOAT32_BIG_ENDIAN',
  'Float32 - Little Endian': 'FLOAT32_LITTLE_ENDIAN',
  'Float64 - Big Endian': 'FLOAT64_BIG_ENDIAN',
  'Float64 - Little Endian': 'FLOAT64_LITTLE_ENDIAN',
}

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const numericValue = Number(value)
  return Number.isNaN(numericValue) ? null : numericValue
}

function getParameterDataType(parameter) {
  return parameter?.split(' ')?.[0] ?? ''
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== '' && item !== null && item !== undefined),
  )
}

function buildConnectionSettings(form) {
  const values = form?.values ?? {}
  const type = normalizeConnectionType(form?.type)

  if (type === 'Modbus RTU') {
    return compactObject({
      comPort: toNumberOrNull(values.comport),
      slaveId: toNumberOrNull(values.slaveId),
      baudRate: toNumberOrNull(values.baudRate),
      parity: parityCodeMap[values.parity] ?? values.parity,
      stopBits: toNumberOrNull(values.stopBits),
      dataBits: toNumberOrNull(values.dataBits),
      quantity: toNumberOrNull(values.quantity),
    })
  }

  if (type === 'Modbus TCP') {
    return compactObject({
      hostIp: values.hostIp,
      slaveId: toNumberOrNull(values.slaveId),
      port: toNumberOrNull(values.port),
    })
  }

  return compactObject({
    hostIp: values.hostIp,
    port: toNumberOrNull(values.port),
    dbUser: values.dbUser,
    dbPass: values.dbPass,
    dbName: values.dbName,
  })
}

function buildDeviceConfigChannels(rows) {
  return rows
    .filter((row) => row.parameter)
    .map((row) => ({
      addressId: toNumberOrNull(row.addressId),
      dataType: getParameterDataType(row.parameter),
      unit: row.unit || parameterUnitMap[row.parameter] || '',
      valueRange: {
        min: toNumberOrNull(row.min),
        max: toNumberOrNull(row.max),
      },
      valueFormat: (valueFormatCodeMap[row.valueFormat] ?? row.valueFormat) || 'MEASUREMENT_VALUE',
      offset: toNumberOrNull(row.offset),
      encoding: (encodingCodeMap[row.encodingData] ?? row.encodingData) || 'UNSIGNED16_BIG_ENDIAN',
      status: row.status || 'Normal',
    }))
}

function ConnectionSettingsDialog({ open, context, accessToken, onClose }) {
  const [deviceConfig, setDeviceConfig] = useState(null)
  const [deviceConfigLoading, setDeviceConfigLoading] = useState(false)
  const [deviceConfigError, setDeviceConfigError] = useState('')
  const [testResultRows, setTestResultRows] = useState([])
  const [connectionForms, setConnectionForms] = useState([])
  const [parameterMappingRows, setParameterMappingRows] = useState([])
  const [statusManagementValue, setStatusManagementValue] = useState(null)
  const [deviceConfigSaving, setDeviceConfigSaving] = useState(false)
  const parameterOptions = deviceConfig?.parameterOptions ?? getConnectionParameterOptions(context)
  const deviceCodeOptions = deviceConfig?.deviceCodeOptions ?? connectionForms.map((_, index) => getConnectionDeviceCode(context, index)).filter(Boolean)
  const statusManagement = statusManagementValue ?? deviceConfig?.statusManagement ?? null

  useEffect(() => {
    if (!open) {
      return
    }

    let isActive = true
    const requestId = getDeviceConfigRequestId(context)
    const stationId = getMonitoringPointCode(context)

    queueMicrotask(() => {
      if (!isActive) {
        return
      }

      setDeviceConfig(null)
      setConnectionForms([])
      setParameterMappingRows([])
      setStatusManagementValue(null)
      setTestResultRows([])
      setDeviceConfigError('')
    })

    if (!requestId || !stationId) {
      queueMicrotask(() => {
        if (isActive) {
          setDeviceConfigError('ไม่พบรหัสคำขอหรือรหัสจุดตรวจวัดสำหรับโหลดการตั้งค่าอุปกรณ์')
        }
      })
      return
    }

    if (!accessToken) {
      queueMicrotask(() => {
        if (isActive) {
          setDeviceConfigError('กรุณาเข้าสู่ระบบเจ้าหน้าที่เพื่อโหลดการตั้งค่าอุปกรณ์')
        }
      })
      return
    }

    queueMicrotask(() => {
      if (isActive) {
        setDeviceConfigLoading(true)
      }
    })

    fetch(getDeviceConfigsApiUrl(requestId, stationId), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(async (result) => {
        const payload = await result.json().catch(() => null)

        if (!result.ok) {
          throw new Error(payload?.message || `โหลดการตั้งค่าอุปกรณ์ไม่สำเร็จ (${result.status} ${result.statusText})`)
        }

        if (isActive) {
          const data = payload?.data ?? {}
          setDeviceConfig(data)
          setConnectionForms(mapConnectionForms(data.connectionForms ?? []))
          setParameterMappingRows(mapParameterMappingRows(data.parameterMappings ?? [], data.parameterOptions ?? []))
          setStatusManagementValue(data.statusManagement ?? null)
          setTestResultRows(mapTestResultRows(data.testResults ?? []))
        }
      })
      .catch((error) => {
        if (isActive) {
          setDeviceConfigError(error instanceof Error ? error.message : 'โหลดการตั้งค่าอุปกรณ์ไม่สำเร็จ')
        }
      })
      .finally(() => {
        if (isActive) {
          setDeviceConfigLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [accessToken, context, open])

  const updateConnectionForm = (id, nextValue) => {
    setConnectionForms((current) => current.map((form) => (form.id === id ? nextValue : form)))
  }
  const handleTestConnection = () => {
    setTestResultRows([])
  }
  const handleSaveDeviceConfig = () => {
    const requestId = getDeviceConfigRequestId(context)
    const stationId = getMonitoringPointCode(context)
    const firstForm = connectionForms[0] ?? { type: '', values: {} }
    const settings = buildConnectionSettings(firstForm)
    const channels = buildDeviceConfigChannels(parameterMappingRows)

    if (!requestId || !stationId) {
      setDeviceConfigError('ไม่พบรหัสคำขอหรือรหัสจุดตรวจวัดสำหรับบันทึกการตั้งค่าอุปกรณ์')
      return
    }

    if (!accessToken) {
      setDeviceConfigError('กรุณาเข้าสู่ระบบเพื่อบันทึกการตั้งค่าอุปกรณ์')
      return
    }

    setDeviceConfigSaving(true)
    setDeviceConfigError('')

    fetch(getDeviceConfigsApiUrl(requestId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stationId,
        deviceCode: parameterMappingRows[0]?.deviceCode || deviceCodeOptions[0] || getConnectionDeviceCode(context, 0),
        protocol: protocolCodeMap[normalizeConnectionType(firstForm.type)] ?? firstForm.type,
        settings,
        channels,
        statusManagement: {
          selectedParameters: statusManagement?.selectedParameters?.length ? statusManagement.selectedParameters : ['ทั้งหมด'],
          startAt: statusManagement?.startAt || null,
          endAt: statusManagement?.endAt || null,
          status: statusManagement?.status || 'Normal',
          schedules: statusManagement?.schedules ?? [],
        },
      }),
    })
      .then(async (result) => {
        const payload = await result.json().catch(() => null)

        if (!result.ok) {
          throw new Error(payload?.message || `บันทึกการตั้งค่าอุปกรณ์ไม่สำเร็จ (${result.status} ${result.statusText})`)
        }

        const data = payload?.data ?? deviceConfig
        setDeviceConfig(data)
        setConnectionForms(mapConnectionForms(data?.connectionForms ?? connectionForms))
        setParameterMappingRows(mapParameterMappingRows(data?.parameterMappings ?? parameterMappingRows, data?.parameterOptions ?? parameterOptions))
        setStatusManagementValue(data?.statusManagement ?? statusManagement)
        setTestResultRows(mapTestResultRows(data?.testResults ?? testResultRows))
      })
      .catch((error) => {
        setDeviceConfigError(error instanceof Error ? error.message : 'บันทึกการตั้งค่าอุปกรณ์ไม่สำเร็จ')
      })
      .finally(() => {
        setDeviceConfigSaving(false)
      })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>ตั้งค่าอุปกรณ์</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {deviceConfigLoading ? (
            <Typography variant="body2">กำลังโหลดการตั้งค่าอุปกรณ์...</Typography>
          ) : null}
          {deviceConfigError ? (
            <Typography color="error" variant="body2">
              {deviceConfigError}
            </Typography>
          ) : null}
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                อุปกรณ์ (Connection)
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() =>
                  setConnectionForms((current) => [
                    ...current,
                    {
                      id: Date.now(),
                      type: '',
                      values: {},
                    },
                  ])
                }
              >
                เพิ่มอุปกรณ์
              </Button>
            </Stack>
            {connectionForms.map((form, index) => (
              <Paper key={form.id} elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
                <Stack spacing={2}>
                  <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                    <Button
                      color="error"
                      variant="outlined"
                      disabled={connectionForms.length === 1}
                      onClick={() => setConnectionForms((current) => current.filter((item) => item.id !== form.id))}
                    >
                      ลบอุปกรณ์
                    </Button>
                  </Stack>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <OptionSelectField
                      label={`อุปกรณ์ (Connection) ${index + 1}`}
                      value={form.type}
                      options={connectionTypeOptions}
                      defaultOption=""
                      onChange={(nextType) =>
                        updateConnectionForm(form.id, {
                          id: form.id,
                            type: nextType,
                            values: getDefaultConnectionForm(nextType),
                          })
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <ReadOnlyField label="รหัสอุปกรณ์" value={deviceCodeOptions[index] ?? getConnectionDeviceCode(context, index)} />
                    </Grid>
                  </Grid>
                  <ConnectionFormFields
                    connectionType={form.type}
                    value={form.values}
                    onChange={(nextValue) => updateConnectionForm(form.id, { ...form, values: nextValue })}
                  />
                </Stack>
              </Paper>
            ))}
          </Stack>
          <Divider />
          <StatusManagementSection
            key={`status-${JSON.stringify(statusManagement)}-${parameterOptions.join('|')}`}
            parameterOptions={parameterOptions}
            statusManagement={statusManagement}
            onChange={setStatusManagementValue}
          />
          <Divider />
          <ConnectionParameterTable
            deviceCodeOptions={deviceCodeOptions}
            rows={parameterMappingRows}
            setRows={setParameterMappingRows}
          />
          <Divider />
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              ทดสอบการเชื่อมต่อ
            </Typography>
            <TableContainer sx={{ border: 1, borderColor: 'divider', overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: Math.max(720, parameterOptions.length * 160), ...borderedTableSx }}>
                <TableHead>
                  <TableRow>
                    {[...parameterOptions, 'Timestamp'].map((column) => (
                      <TableCell key={column} sx={{ fontWeight: 700, bgcolor: 'neutral.50' }}>
                        {column}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {testResultRows.length > 0 ? (
                    testResultRows.map((row) => (
                      <TableRow key={row.id}>
                        {parameterOptions.map((parameter) => (
                          <TableCell key={parameter}>{row.values[parameter]}</TableCell>
                        ))}
                        <TableCell>{row.timestamp}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={parameterOptions.length + 1} align="center">
                        <Typography variant="body2" color="text.secondary">
                          ยังไม่มีผลการทดสอบ
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center' }}>
        <Button color="inherit" onClick={onClose}>
          ปิด
        </Button>
        <Button variant="contained" onClick={handleTestConnection}>
          ทดสอบ
        </Button>
        <Button variant="contained" disabled={deviceConfigSaving} onClick={handleSaveDeviceConfig}>
          {deviceConfigSaving ? 'กำลังบันทึก' : 'บันทึก'}
        </Button>
        <Button color="secondary" variant="contained" onClick={onClose}>
          ยืนยันการเชื่อมต่อ
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function getFactoryColumns(isOperator, onOpenRequestForm, onOpenMonitoringPoints) {
  const columns = [
    { field: 'factoryName', headerName: 'ชื่อโรงงาน/บริษัท', width: 240 },
    { field: 'newRegistrationNo', headerName: 'เลขทะเบียนโรงงาน (ใหม่)', width: 190 },
    { field: 'oldRegistrationNo', headerName: 'เลขทะเบียนโรงงาน (เก่า)', width: 190 },
    { field: 'industryType', headerName: 'ประเภทอุตสาหกรรม', width: 170 },
    { field: 'province', headerName: 'จังหวัด', width: 130 },
    { field: 'monitoringPointCount', headerName: 'จำนวนจุดตรวจวัด', width: 150, type: 'number' },
    {
      field: 'requestStatus',
      headerName: 'สถานะคำขอ',
      width: 170,
      renderCell: (params) => <StatusChip value={params.value} />,
    },
    { field: 'status', headerName: 'สถานะ', width: 110 },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: isOperator ? 240 : 290,
      sortable: false,
      filterable: false,
      renderCell: (params) =>
        isOperator ? (
          <OperatorFactoryActions
            row={params.row}
            onOpenRequestForm={onOpenRequestForm}
            onOpenMonitoringPoints={onOpenMonitoringPoints}
          />
        ) : (
          <OfficerFactoryActions row={params.row} onOpenMonitoringPoints={onOpenMonitoringPoints} />
      ),
    },
  ]

  return isOperator ? columns.filter((column) => column.field !== 'requestStatus') : columns
}

function ReadOnlyField({ label, value, sx }) {
  return (
    <TextField
      label={label}
      value={value}
      size="small"
      fullWidth
      slotProps={{
        input: {
          readOnly: true,
        },
      }}
      sx={sx}
    />
  )
}

function UploadFileField({ label, accept, name }) {
  const [fileName, setFileName] = useState('')

  return (
    <Stack spacing={0.75}>
      <Button
        component="label"
        variant="outlined"
        size="small"
        fullWidth
        startIcon={<UploadFileIcon />}
        sx={{
          minHeight: 40,
          justifyContent: 'flex-start',
          borderStyle: 'dashed',
          color: fileName ? 'text.primary' : 'text.secondary',
          bgcolor: 'background.paper',
          '&:hover': {
            borderStyle: 'dashed',
            bgcolor: 'primary.50',
          },
        }}
      >
        {fileName || label}
        <Box
          component="input"
          type="file"
          name={name}
          accept={accept}
          hidden
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')}
        />
      </Button>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  )
}

function ParameterMultiSelect({ label, name, value: controlledValue, onChange }) {
  const [internalValue, setInternalValue] = useState([])
  const value = controlledValue ?? internalValue

  return (
    <FormControl size="small" fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select
        multiple
        name={name}
        value={value}
        label={label}
        input={<OutlinedInput label={label} />}
        onChange={(event) => {
          const selectedValue = event.target.value
          const nextValue = typeof selectedValue === 'string' ? selectedValue.split(',') : selectedValue
          if (onChange) {
            onChange(nextValue)
          } else {
            setInternalValue(nextValue)
          }
        }}
        renderValue={(selected) => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selected.map((item) => (
              <Chip key={item} label={item} size="small" />
            ))}
          </Box>
        )}
      >
        {cemsParameterOptions.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

function CemsMonitoringPointDetails() {
  const [stackShape, setStackShape] = useState('')
  const [primaryFuel, setPrimaryFuel] = useState('')
  const [secondaryFuel, setSecondaryFuel] = useState('')
  const [hasTreatmentSystem, setHasTreatmentSystem] = useState('')
  const [treatmentSystem, setTreatmentSystem] = useState('')
  const [connectionDevice, setConnectionDevice] = useState('')

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="pointCode" label="รหัสจุดตรวจวัด" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="pointName" label="ชื่อจุดตรวจวัด" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="productionUnitType" label="ประเภทของหน่วยการผลิต" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="productionCapacity" label="กำลังการผลิตต่อหน่วย" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="cemsInstallationRequiredBy" select label="เข้าข่ายต้องติดตั้ง CEMS ตามกฎหมาย" size="small" fullWidth defaultValue="">
            <MenuItem value="">-</MenuItem>
            <MenuItem value="ประกาศ อก.">ประกาศ อก.</MenuItem>
            <MenuItem value="กกพ.">กกพ.</MenuItem>
            <MenuItem value="กทม.">กทม.</MenuItem>
            <MenuItem value="อื่นๆ">อื่นๆ</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="cemsInstallationRequiredOther" label="อื่นๆ โปรดระบุ" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="legalAnnexNo" select label="เข้าข่ายตามบัญชีแนบท้ายลำดับที่" size="small" fullWidth defaultValue="">
            <MenuItem value="">-</MenuItem>
            <MenuItem value="เฉพาะประกาศปี 65">เฉพาะประกาศปี 65</MenuItem>
            <MenuItem value="กทม.">กทม.</MenuItem>
          </TextField>
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect name="eligibleParameters" label="พารามิเตอร์ที่เข้าข่าย" />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect name="exemptedParameters" label="พารามิเตอร์ที่ได้รับการยกเว้น" />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect name="connectedParameters" label="พารามิเตอร์ที่เชื่อมต่อแล้ว" />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect name="pendingParameters" label="พารามิเตอร์ที่ยังไม่เชื่อมต่อ" />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            select
            name="stackShape"
            label="ลักษณะปล่อง"
            size="small"
            fullWidth
            value={stackShape}
            onChange={(event) => setStackShape(event.target.value)}
          >
            <MenuItem value="">-</MenuItem>
            <MenuItem value="วงกลม">วงกลม</MenuItem>
            <MenuItem value="สี่เหลี่ยม">สี่เหลี่ยม</MenuItem>
            <MenuItem value="อื่นๆ">อื่นๆ</MenuItem>
          </TextField>
        </Grid>
        {stackShape === 'วงกลม' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField name="stackDiameter" label="เส้นผ่านศูนย์กลาง (เมตร)" size="small" fullWidth />
          </Grid>
        ) : null}
        {stackShape === 'สี่เหลี่ยม' ? (
          <>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="stackWidth" label="กว้าง (เมตร)" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="stackLength" label="ยาว (เมตร)" size="small" fullWidth />
            </Grid>
          </>
        ) : null}
        {stackShape === 'อื่นๆ' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField name="stackShapeOther" label="โปรดระบุ" size="small" fullWidth />
          </Grid>
        ) : null}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="stackHeight" label="ความสูงปล่อง (เมตร)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="monitoringHeight" label="ความสูงของจุดตรวจวัด (เมตร)" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="averageFlowRate" label="อัตราการระบายอากาศเฉลี่ย (m³/hr)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="minFlowRate" label="อัตราการระบายอากาศต่ำสุด (m³/hr)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="maxFlowRate" label="อัตราการระบายอากาศสูงสุด (m³/hr)" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            select
            name="primaryFuel"
            label="เชื้อเพลิงหลักที่ใช้"
            size="small"
            fullWidth
            value={primaryFuel}
            onChange={(event) => setPrimaryFuel(event.target.value)}
          >
            <MenuItem value="">-</MenuItem>
            <MenuItem value="ก๊าซธรรมชาติ">ก๊าซธรรมชาติ</MenuItem>
            <MenuItem value="น้ำมันเตา">น้ำมันเตา</MenuItem>
            <MenuItem value="ถ่านหิน">ถ่านหิน</MenuItem>
            <MenuItem value="ชีวมวล">ชีวมวล</MenuItem>
            <MenuItem value="อื่นๆ">อื่นๆ</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="primaryFuelOther" label="โปรดระบุ" size="small" fullWidth disabled={primaryFuel !== 'อื่นๆ'} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="primaryFuelPercent" label="ร้อยละโดยประมาณ" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            select
            name="secondaryFuel"
            label="เชื้อเพลิงรอง (ถ้ามี)"
            size="small"
            fullWidth
            value={secondaryFuel}
            onChange={(event) => setSecondaryFuel(event.target.value)}
          >
            <MenuItem value="">-</MenuItem>
            <MenuItem value="ไม่มี">ไม่มี</MenuItem>
            <MenuItem value="ก๊าซธรรมชาติ">ก๊าซธรรมชาติ</MenuItem>
            <MenuItem value="น้ำมันเตา">น้ำมันเตา</MenuItem>
            <MenuItem value="ถ่านหิน">ถ่านหิน</MenuItem>
            <MenuItem value="ชีวมวล">ชีวมวล</MenuItem>
            <MenuItem value="อื่นๆ">อื่นๆ</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="secondaryFuelOther" label="โปรดระบุ" size="small" fullWidth disabled={secondaryFuel !== 'อื่นๆ'} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="secondaryFuelPercent" label="ร้อยละโดยประมาณ" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="combustionControlSystem" label="ระบบการควบคุมปริมาณอากาศและสภาวะการเผาไหม้" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            select
            name="hasTreatmentSystem"
            label="ระบบบำบัด"
            size="small"
            fullWidth
            value={hasTreatmentSystem}
            onChange={(event) => setHasTreatmentSystem(event.target.value)}
          >
            <MenuItem value="">-</MenuItem>
            <MenuItem value="ไม่มี">ไม่มี</MenuItem>
            <MenuItem value="มี">มี</MenuItem>
          </TextField>
        </Grid>
        {hasTreatmentSystem === 'มี' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              select
              name="treatmentSystem"
              label="ระบุระบบบำบัด"
              size="small"
              fullWidth
              value={treatmentSystem}
              onChange={(event) => setTreatmentSystem(event.target.value)}
            >
              <MenuItem value="">-</MenuItem>
              <MenuItem value="ระบบดักจับฝุ่น">ระบบดักจับฝุ่น</MenuItem>
              <MenuItem value="สครับเบอร์">สครับเบอร์</MenuItem>
              <MenuItem value="ถุงกรอง">ถุงกรอง</MenuItem>
              <MenuItem value="อื่นๆ">อื่นๆ</MenuItem>
            </TextField>
          </Grid>
        ) : null}
        {hasTreatmentSystem === 'มี' && treatmentSystem === 'อื่นๆ' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField name="treatmentSystemOther" label="ระบุรายละเอียดของระบบบำบัด" size="small" fullWidth />
          </Grid>
        ) : null}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="stackLatitude" label="พิกัดปล่องที่ติดตั้ง CEMS (ละติจูด)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="stackLongitude" label="พิกัดปล่องที่ติดตั้ง CEMS (ลองติจูด)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            select
            name="connectionDevice"
            label="อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ"
            size="small"
            fullWidth
            value={connectionDevice}
            onChange={(event) => setConnectionDevice(event.target.value)}
          >
            <MenuItem value="">-</MenuItem>
            <MenuItem value="POMS Box (กรอ.)">POMS Box (กรอ.)</MenuItem>
            <MenuItem value="POMS Box (กนอ.)">POMS Box (กนอ.)</MenuItem>
            <MenuItem value="POMS Client (เดิม)">POMS Client (เดิม)</MenuItem>
            <MenuItem value="POMS Client (ใหม่)">POMS Client (ใหม่)</MenuItem>
            <MenuItem value="อื่นๆ">อื่นๆ</MenuItem>
          </TextField>
        </Grid>
        {connectionDevice === 'อื่นๆ' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField name="connectionDeviceOther" label="โปรดระบุ" size="small" fullWidth />
          </Grid>
        ) : null}
      </Grid>
    </Stack>
  )
}

function DocumentsAndImagesSection() {
  const itemsWithIndex = documentImageItems.map((item, index) => ({ ...item, index }))
  const groupedItems = itemsWithIndex.filter((item) => groupedDocumentImageTitles.includes(item.title))
  const standaloneItems = itemsWithIndex.filter((item) => !groupedDocumentImageTitles.includes(item.title))

  return (
    <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
      <Stack spacing={2.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          เอกสารและรูปภาพ
        </Typography>
        {standaloneItems.map((item) => (
          <Stack key={item.title} spacing={1.5}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {item.title}
              </Typography>
              {item.description ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {item.description}
                </Typography>
              ) : null}
            </Box>
            <Grid container spacing={2}>
              {item.hasLink ? (
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField name={`documentImageLink-${item.index}`} label="Link" size="small" fullWidth />
                </Grid>
              ) : null}
              <Grid size={{ xs: 12, md: 3 }}>
                <UploadFileField
                  name={`documentImageFile-${item.index}`}
                  label={item.uploadLabel}
                  accept={item.accept}
                />
              </Grid>
            </Grid>
          </Stack>
        ))}
        <Grid container spacing={2}>
          {groupedItems.map((item) => (
            <Grid key={item.title} size={{ xs: 12, md: 3 }}>
              <Stack spacing={1.5}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {item.title}
                </Typography>
                <UploadFileField
                  name={`documentImageFile-${item.index}`}
                  label={item.uploadLabel}
                  accept={item.accept}
                />
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Paper>
  )
}

function SpecialCriteriaTable() {
  return (
    <TableContainer sx={{ border: 1, borderColor: 'divider' }}>
      <Table size="small" sx={borderedTableSx}>
        <TableHead>
          <TableRow>
            {['MIN', 'เกณฑ์มลพิษ', 'MAX'].map((header) => (
              <TableCell
                key={header}
                align="center"
                sx={{ bgcolor: 'primary.600', color: 'primary.contrastText', fontWeight: 700 }}
              >
                {header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {specialCriteriaRows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>
                <TextField size="small" fullWidth />
              </TableCell>
              <TableCell align="center">
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body2">{row.key === 'critical' ? '<' : '≤'}</Typography>
                  <Chip label={row.label} color={row.color} size="small" sx={{ fontWeight: 700 }} />
                  <Typography variant="body2">{row.key === 'critical' ? '<' : '≤'}</Typography>
                </Stack>
              </TableCell>
              <TableCell>
                <TextField size="small" fullWidth />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function StandardCriteriaSection({ label }) {
  return (
    <Stack spacing={1.5}>
      <FormControlLabel control={<Checkbox size="small" />} label={label} />
      <SpecialCriteriaTable />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField label="ค่ามาตรฐาน" size="small" fullWidth />
        </Grid>
      </Grid>
    </Stack>
  )
}

function InstrumentDataDialog({ open, parameterOptions, value, onClose, onSave }) {
  const [form, setForm] = useState({
    parameter: value?.parameter ?? '',
    technique: value?.technique ?? emptyInstrumentParameter.technique,
    range: value?.range ?? emptyInstrumentParameter.range,
    brand: value?.brand ?? emptyInstrumentParameter.brand,
    supplier: value?.supplier ?? emptyInstrumentParameter.supplier,
    eiaStandard: value?.eiaStandard ?? emptyInstrumentParameter.eiaStandard,
    standardCondition: value?.standardCondition ?? emptyInstrumentParameter.standardCondition,
    dryBasis: value?.dryBasis ?? emptyInstrumentParameter.dryBasis,
    oxygenOrExcessAir: value?.oxygenOrExcessAir ?? emptyInstrumentParameter.oxygenOrExcessAir,
  })

  const updateForm = (field, nextValue) => setForm((current) => ({ ...current, [field]: nextValue }))

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>จัดการข้อมูลเครื่องมือตรวจวัด</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                label="พารามิเตอร์ที่ขอเชื่อมต่อ"
                size="small"
                value={form.parameter}
                onChange={(event) => updateForm('parameter', event.target.value)}
                fullWidth
              >
                <MenuItem value="">
                  <em>ไม่ระบุ</em>
                </MenuItem>
                {parameterOptions.map((parameter) => (
                  <MenuItem key={parameter} value={parameter}>
                    {parameter}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="เทคนิคตรวจวัด"
                size="small"
                value={form.technique}
                onChange={(event) => updateForm('technique', event.target.value)}
                placeholder="เช่น NDIR"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="ช่วงการวัด"
                size="small"
                value={form.range}
                onChange={(event) => updateForm('range', event.target.value)}
                placeholder="เช่น 0-200"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="ยี่ห้อเครื่องมือ"
                size="small"
                value={form.brand}
                onChange={(event) => updateForm('brand', event.target.value)}
                placeholder="เช่น Siemens"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="ผู้จำหน่ายเครื่องมือ"
                size="small"
                value={form.supplier}
                onChange={(event) => updateForm('supplier', event.target.value)}
                placeholder="เช่น ABC Tech"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="มาตรฐาน EIA"
                size="small"
                value={form.eiaStandard}
                onChange={(event) => updateForm('eiaStandard', event.target.value)}
                placeholder="เช่น 12000"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1, width: '100%' }}>
                <Typography variant="body2" sx={{ mb: 0.75, fontWeight: 700 }}>
                  การรายงานค่า
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={form.standardCondition}
                      onChange={(event) => updateForm('standardCondition', event.target.checked)}
                    />
                  }
                  label="สภาวะมาตรฐาน"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={form.dryBasis}
                      onChange={(event) => updateForm('dryBasis', event.target.checked)}
                    />
                  }
                  label="การรายงานค่า (Dry basis)"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={form.oxygenOrExcessAir}
                      onChange={(event) => updateForm('oxygenOrExcessAir', event.target.checked)}
                    />
                  }
                  label="O₂ @ 7% or Excess Air 50%"
                />
              </FormControl>
            </Grid>
          </Grid>
          <Divider />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <StandardCriteriaSection label="พารามิเตอร์ไม่มีค่ามาตรฐาน ตามประกาศ อก." />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <StandardCriteriaSection label="พารามิเตอร์ไม่มีค่ามาตรฐาน ตาม EIA" />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ปิด
        </Button>
        <Button variant="contained" disabled={!form.parameter} onClick={() => onSave(form)}>
          บันทึก
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function MeasurementInstrumentSection({ parameterOptions }) {
  const [instrumentRows, setInstrumentRows] = useState([])
  const [editingRowIndex, setEditingRowIndex] = useState(null)
  const [instrumentDialogOpen, setInstrumentDialogOpen] = useState(false)
  const editingValue = editingRowIndex === null ? null : instrumentRows[editingRowIndex]

  return (
    <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          รายละเอียดเครื่องมือตรวจวัด
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Grid container spacing={2} sx={{ flex: 1 }}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="converterBrand" label="อุปกรณ์แปลงสัญญาณ (Converter) ยี่ห้อ" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="converterModel" label="อุปกรณ์แปลงสัญญาณ (Converter) รุ่น" size="small" fullWidth />
            </Grid>
          </Grid>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={parameterOptions.length === 0}
            onClick={() => {
              setEditingRowIndex(null)
              setInstrumentDialogOpen(true)
            }}
            sx={{ alignSelf: { xs: 'stretch', md: 'flex-start' } }}
          >
            เพิ่มพารามิเตอร์
          </Button>
        </Stack>
        <TableContainer sx={{ border: 1, borderColor: 'divider', overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 1280, ...borderedTableSx }}>
            <TableHead>
              <TableRow>
                {measurementInstrumentColumns.map((column) => (
                  <TableCell key={column} sx={{ fontWeight: 700, bgcolor: 'neutral.50' }}>
                    {column}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {instrumentRows.length > 0 ? (
                instrumentRows.map((data, index) => {
                  return (
                    <TableRow key={`${data.parameter}-${index}`}>
                      <TableCell>
                        <input type="hidden" name="measurementInstrumentParameters" value={JSON.stringify(data)} />
                        {data.parameter}
                      </TableCell>
                      <TableCell>{data?.technique ?? ''}</TableCell>
                      <TableCell>{data?.range ?? ''}</TableCell>
                      <TableCell>{data?.brand ?? ''}</TableCell>
                      <TableCell>{data?.supplier ?? ''}</TableCell>
                      <TableCell>{data?.eiaStandard ?? ''}</TableCell>
                      <TableCell>{data?.standardCondition ? '✓' : ''}</TableCell>
                      <TableCell>{data?.dryBasis ? '✓' : ''}</TableCell>
                      <TableCell>{data?.oxygenOrExcessAir ? '✓' : ''}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={tableActionStackSx}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setEditingRowIndex(index)
                              setInstrumentDialogOpen(true)
                            }}
                          >
                            จัดการข้อมูล
                          </Button>
                          <Button
                            size="small"
                            color="warning"
                            variant="outlined"
                            onClick={() =>
                              setInstrumentRows((current) =>
                                current.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        parameter: row.parameter,
                                        technique: '',
                                        range: '',
                                        brand: '',
                                        supplier: '',
                                        eiaStandard: '',
                                        standardCondition: false,
                                        dryBasis: false,
                                        oxygenOrExcessAir: false,
                                      }
                                    : row,
                                ),
                              )
                            }
                          >
                            ล้าง
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={measurementInstrumentColumns.length} align="center">
                    <Typography variant="body2" color="text.secondary">
                      ยังไม่มีข้อมูลเครื่องมือตรวจวัด
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
      {instrumentDialogOpen ? (
        <InstrumentDataDialog
          key={editingRowIndex === null ? 'new' : `edit-${editingRowIndex}`}
          open
          parameterOptions={parameterOptions}
          value={editingValue}
          onClose={() => setInstrumentDialogOpen(false)}
          onSave={(nextValue) => {
            setInstrumentRows((current) =>
              editingRowIndex === null
                ? [...current, nextValue]
                : current.map((row, index) => (index === editingRowIndex ? nextValue : row)),
            )
            setInstrumentDialogOpen(false)
          }}
        />
      ) : null}
    </Paper>
  )
}

function WpmsMonitoringPointDetails() {
  const [hasTreatmentSystem, setHasTreatmentSystem] = useState('')
  const [connectionDevice, setConnectionDevice] = useState('')

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="pointCode" label="รหัสจุดตรวจวัด" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="pointName" label="ชื่อจุดตรวจวัด" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="averageWastewaterDischarge" label="อัตราการระบายน้ำทิ้งเฉลี่ย (m³/d)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="minWastewaterDischarge" label="อัตราการระบายน้ำทิ้งต่ำสุด (m³/d)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="maxWastewaterDischarge" label="อัตราการระบายน้ำทิ้งสูงสุด (m³/d)" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            select
            name="hasTreatmentSystem"
            label="ระบบบำบัด"
            size="small"
            fullWidth
            value={hasTreatmentSystem}
            onChange={(event) => setHasTreatmentSystem(event.target.value)}
          >
            <MenuItem value="">-</MenuItem>
            <MenuItem value="ไม่มี">ไม่มี</MenuItem>
            <MenuItem value="มี">มี</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="treatmentSystem" label="ระบุ" size="small" fullWidth />
        </Grid>
        {hasTreatmentSystem === 'มี' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField name="maxTreatmentCapacity" label="ปริมาณรองรับน้ำเสียสูงสุดของระบบบำบัด" size="small" fullWidth />
          </Grid>
        ) : null}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="instrumentLatitude" label="พิกัดจุดติดตั้งเครื่องมือตรวจวัด (ละติจูด)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="instrumentLongitude" label="พิกัดจุดติดตั้งเครื่องมือตรวจวัด (ลองติจูด)" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="wastewaterSource" label="แหล่งกำเนิดน้ำเสีย" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="dischargeReceivingSource" label="แหล่งรองรับน้ำทิ้ง" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            select
            name="connectionDevice"
            label="อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ"
            size="small"
            fullWidth
            value={connectionDevice}
            onChange={(event) => setConnectionDevice(event.target.value)}
          >
            <MenuItem value="">-</MenuItem>
            <MenuItem value="POMS Box (กรอ.)">POMS Box (กรอ.)</MenuItem>
            <MenuItem value="POMS Box (กนอ.)">POMS Box (กนอ.)</MenuItem>
            <MenuItem value="POMS Client (เดิม)">POMS Client (เดิม)</MenuItem>
            <MenuItem value="POMS Client (ใหม่)">POMS Client (ใหม่)</MenuItem>
            <MenuItem value="อื่นๆ">อื่นๆ</MenuItem>
          </TextField>
        </Grid>
        {connectionDevice === 'อื่นๆ' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField name="connectionDeviceOther" label="โปรดระบุ" size="small" fullWidth />
          </Grid>
        ) : null}
      </Grid>
    </Stack>
  )
}

function MobileMonitoringPointDetails() {
  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="รหัสหน่วยตรวจวัด" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ชื่อหน่วยตรวจวัด" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="หมายเลขเครื่องมือ/อุปกรณ์" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ผู้รับผิดชอบหน่วยตรวจวัด" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect label="พารามิเตอร์ที่ตรวจวัด" />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ" size="small" fullWidth />
        </Grid>
      </Grid>
    </Stack>
  )
}

function StationMonitoringPointDetails() {
  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="รหัสสถานีตรวจวัด" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ชื่อสถานีตรวจวัด" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ประเภทสถานี" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="พื้นที่ติดตั้งสถานี" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="พิกัดสถานี (ละติจูด)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="พิกัดสถานี (ลองติจูด)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect label="พารามิเตอร์ที่ตรวจวัด" />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ" size="small" fullWidth />
        </Grid>
      </Grid>
    </Stack>
  )
}

function MonitoringPointDetails({ point }) {
  if (point.type === 'CEMS') {
    return <CemsMonitoringPointDetails />
  }
  if (point.type === 'WPMS') {
    return <WpmsMonitoringPointDetails />
  }
  if (point.type === 'Mobile') {
    return <MobileMonitoringPointDetails />
  }
  if (point.type === 'Station') {
    return <StationMonitoringPointDetails />
  }
  return null
}

function RequestFormBottomSheet({ open, formType, factory, accessToken, onClose, onSubmitted }) {
  const formRef = useRef(null)
  const [contacts, setContacts] = useState([{ id: 1 }])
  const [factoryEmails, setFactoryEmails] = useState([{ id: 1, value: '' }])
  const [monitoringPoints, setMonitoringPoints] = useState([{ id: 1, type: '' }])
  const [selectedMonitoringPointId, setSelectedMonitoringPointId] = useState(1)
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false)
  const [submitPreviewRequest, setSubmitPreviewRequest] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const officerEmails = ['']
  const showMonitoringPointSection = formType === 'เพิ่มจุดตรวจวัด'
  const selectedMonitoringPoint = monitoringPoints.find((point) => point.id === selectedMonitoringPointId)
    ?? monitoringPoints[0]
  const buildCurrentRequestBody = () => {
    const formData = formRef.current ? new FormData(formRef.current) : null
    return buildMeasurementPointRequestBody(factory, selectedMonitoringPoint?.type, formData)
  }
  const openSubmitConfirm = () => {
    setSubmitError('')
    setSubmitPreviewRequest(buildCurrentRequestBody())
    setSubmitConfirmOpen(true)
  }
  const submitRequest = async () => {
    if (!accessToken) {
      setSubmitError('กรุณาเข้าสู่ระบบเพื่อส่งแบบฟอร์มคำขอ')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')
    const requestBody = submitPreviewRequest ?? buildCurrentRequestBody()

    try {
      const result = await fetch(getMeasurementPointsRequestApiUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
      const rawText = await result.text()
      let response = rawText

      try {
        response = rawText ? JSON.parse(rawText) : null
      } catch {
        response = rawText
      }

      if (!result.ok || response?.success === false) {
        const message =
          response?.error?.message ??
          response?.message ??
          `ส่งแบบฟอร์มไม่สำเร็จ (${result.status} ${result.statusText})`
        throw new Error(message)
      }

      setSubmitConfirmOpen(false)
      setSubmitPreviewRequest(null)
      onSubmitted?.(response?.data ?? null)
      onClose()
    } catch (error) {
      const message = error instanceof TypeError
        ? 'ส่งแบบฟอร์มไม่สำเร็จ: browser ไม่สามารถเชื่อมต่อ API ได้ กรุณาเปิดผ่าน Vite dev server หรือ domain d-poms.diw.go.th และตรวจ CORS/HTTPS ของ API'
        : error instanceof Error
          ? error.message
          : 'ส่งแบบฟอร์มไม่สำเร็จ'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      transitionDuration={{ enter: 280, exit: 220 }}
      slotProps={{
        paper: {
          sx: {
            height: {
              xs: `calc(100dvh - ${appBarHeight.xs}px)`,
              md: `calc(100dvh - ${appBarHeight.md}px)`,
            },
            bgcolor: 'background.default',
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
          },
        },
      }}
    >
      <Stack sx={{ height: '100%', minHeight: 0 }}>
        <Stack
          direction="row"
          sx={{
            px: { xs: 2, md: 3 },
            py: 1.5,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ width: 40 }} />
          <Typography variant="h6" component="h2" fontWeight={700}>
            แบบฟอร์มคำขอ {formType}
          </Typography>
          <IconButton aria-label="ปิด" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Divider />

        <Box
          component="form"
          ref={formRef}
          sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: { xs: 2, md: 3 }, bgcolor: 'background.default' }}
        >
          <Stack spacing={2}>
            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
              <Stack spacing={2}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  ข้อมูลทั่วไปของโรงงาน
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ReadOnlyField label="ชื่อโรงงาน" value={factory?.factoryName ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="เลขทะเบียนโรงงาน (เดิม)" value={factory?.oldRegistrationNo ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="เลขทะเบียนโรงงาน (ใหม่)" value={factory?.newRegistrationNo ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ReadOnlyField label="ลำดับประเภทโรงงาน (หลัก)" value={factory?.industryMainOrder ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ReadOnlyField label="ลำดับประเภทโรงงาน (รอง)" value={factory?.industrySubOrder ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ReadOnlyField label="การประกอบกิจการ" value={factory?.businessActivity ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Box
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        minHeight: 40,
                      }}
                    >
                      <RadioGroup row value={factory?.eia ?? 'ไม่มี'}>
                        <FormControlLabel
                          value="มี"
                          control={<Radio size="small" />}
                          label="มีการประเมินผลกระทบสิ่งแวดล้อม (EIA)"
                          disabled
                        />
                        <FormControlLabel value="ไม่มี" control={<Radio size="small" />} label="ไม่มี" disabled />
                      </RadioGroup>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="ชื่อโครงการ" value={factory?.projectName ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ReadOnlyField label="สถานที่ตั้งโรงงาน" value={factory?.address ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="ละติจูด" value={factory?.latitude ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="ลองติจูด" value={factory?.longitude ?? ''} />
                  </Grid>
                </Grid>
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
              <Stack spacing={2}>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    ผู้ติดต่อประสานงาน
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setContacts((current) => [...current, { id: Date.now() }])}
                  >
                    เพิ่มข้อมูล
                  </Button>
                </Stack>
                {contacts.map((contact) => (
                  <Grid
                    container
                    spacing={2}
                    key={contact.id}
                  >
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField name="contactName" label="ชื่อ-นามสกุล" size="small" fullWidth />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField name="contactPosition" label="ตำแหน่ง" size="small" fullWidth />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField name="contactPhone" label="เบอร์โทร" size="small" fullWidth />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField name="contactEmail" label="อีเมล" size="small" fullWidth />
                    </Grid>
                  </Grid>
                ))}
              </Stack>
            </Paper>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', height: '100%' }}>
                <Stack spacing={2}>
                  <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      อีเมลสำหรับแจ้งเตือนโรงงาน
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() =>
                        setFactoryEmails((current) => [...current, { id: Date.now(), value: '' }])
                      }
                    >
                      เพิ่มข้อมูล
                    </Button>
                  </Stack>
                  {factoryEmails.map((email) => (
                    <TextField
                      key={email.id}
                      label="อีเมล"
                      name="notificationEmail"
                      type="email"
                      size="small"
                      defaultValue={email.value}
                      fullWidth
                    />
                  ))}
                </Stack>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', height: '100%' }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    อีเมลสำหรับแจ้งเตือนเจ้าหน้าที่
                  </Typography>
                  {officerEmails.map((email) => (
                    <ReadOnlyField key={email || 'empty-officer-email'} label="อีเมล" value={email} />
                  ))}
                </Stack>
                </Paper>
              </Grid>
            </Grid>

            {showMonitoringPointSection ? (
              <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    จุดตรวจวัด
                  </Typography>
                  <RadioGroup
                    row
                    value={selectedMonitoringPoint?.type ?? ''}
                    onChange={(event) => {
                      const nextPoint = {
                        id: selectedMonitoringPoint?.id ?? Date.now(),
                        type: event.target.value,
                      }
                      setMonitoringPoints([nextPoint])
                      setSelectedMonitoringPointId(nextPoint.id)
                    }}
                  >
                    {monitoringPointTypeOptions.map((type) => (
                      <FormControlLabel
                        key={type}
                        value={type}
                        control={<Radio size="small" />}
                        label={type}
                      />
                    ))}
                  </RadioGroup>
                </Stack>
              </Paper>
            ) : null}

            {showMonitoringPointSection && monitoringPoints.length > 0 ? (
              <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    รายละเอียดจุดตรวจวัด
                  </Typography>
                  {monitoringPoints.map((point) => (
                    <Box key={point.id} sx={{ display: point.id === selectedMonitoringPoint?.id ? 'block' : 'none' }}>
                      <MonitoringPointDetails point={point} />
                    </Box>
                  ))}
                </Stack>
              </Paper>
            ) : null}

            {showMonitoringPointSection && monitoringPoints.length > 0
              ? monitoringPoints.map((point) =>
                  point.type === 'CEMS' || point.type === 'WPMS' ? (
                    <Box key={point.id} sx={{ display: point.id === selectedMonitoringPoint?.id ? 'block' : 'none' }}>
                      <Stack spacing={2}>
                        {point.type === 'CEMS' ? <DocumentsAndImagesSection /> : null}
                        <MeasurementInstrumentSection
                          parameterOptions={
                            point.type === 'CEMS' ? cemsParameterOptions : wpmsInstrumentParameters
                          }
                        />
                      </Stack>
                    </Box>
                  ) : null,
                )
              : null}
          </Stack>
        </Box>
        <Divider />
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            px: { xs: 2, md: 3 },
            py: 1.5,
            justifyContent: 'center',
            bgcolor: 'background.paper',
          }}
        >
          <Button variant="outlined" color="inherit" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button variant="contained" onClick={openSubmitConfirm}>
            ส่งแบบฟอร์มคำขอ
          </Button>
        </Stack>
      </Stack>
      <RequestDocumentDialog
        open={submitConfirmOpen}
        request={submitPreviewRequest}
        title="ยืนยันการส่งแบบฟอร์มคำขอ"
        onClose={() => {
          setSubmitConfirmOpen(false)
          setSubmitPreviewRequest(null)
        }}
        footerContent={
          <Stack spacing={0.5} sx={{ alignItems: 'center', textAlign: 'center', mb: 1.5 }}>
            <Typography>กรุณาตรวจสอบความถูกต้องของข้อมูลในแบบฟอร์ม</Typography>
            <Typography color="text.secondary">
              เมื่อส่งแบบฟอร์มคำขอแล้วจะไม่สามารถแก้ไขได้ จนกว่าจะผ่านการพิจารณาจากเจ้าหน้าที่
            </Typography>
            {submitError ? (
              <Typography color="error" variant="body2">
                {submitError}
              </Typography>
            ) : null}
          </Stack>
        }
        footerActions={
          <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'center' }}>
            <Button
              color="inherit"
              disabled={isSubmitting}
              onClick={() => {
                setSubmitConfirmOpen(false)
                setSubmitPreviewRequest(null)
              }}
            >
              ยกเลิก
            </Button>
            <Button variant="contained" disabled={isSubmitting} onClick={submitRequest}>
              {isSubmitting ? 'กำลังส่ง' : 'ยืนยันส่งแบบฟอร์ม'}
            </Button>
          </Stack>
        }
      />
    </Drawer>
  )
}

function getRequestColumns(isOperator, onOpenConnectionSettings, onOpenRequestDocument, onOpenRequestProcess) {
  return [
    { field: 'factoryName', headerName: 'ชื่อโรงงาน/บริษัท', width: 240 },
    { field: 'industryType', headerName: 'ประเภทอุตสาหกรรม', width: 170 },
    { field: 'province', headerName: 'จังหวัด', width: 130 },
    { field: 'type', headerName: 'ประเภทจุดตรวจวัด', width: 150 },
    { field: 'requestNo', headerName: 'เลขที่คำขอ', width: 150 },
    { field: 'submittedDate', headerName: 'วันที่ยื่นคำขอ', width: 150 },
    { field: 'monitoringPointCode', headerName: 'รหัสจุดตรวจวัด', width: 170 },
    { field: 'codeIssuedDate', headerName: 'วันที่ออกรหัส', width: 150 },
    { field: 'form', headerName: 'แบบฟอร์ม', width: 150 },
    {
      field: 'status',
      headerName: 'สถานะ',
      width: 170,
      renderCell: (params) => <StatusChip value={params.value} />,
    },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: isOperator ? 350 : 180,
      sortable: false,
      filterable: false,
      renderCell: (params) =>
        isOperator ? (
          <OperatorRequestActions
            row={params.row}
            onOpenConnectionSettings={onOpenConnectionSettings}
            onOpenRequestDocument={onOpenRequestDocument}
          />
        ) : (
          <OfficerRequestActions
            row={params.row}
            onOpenRequestDocument={onOpenRequestDocument}
            onOpenRequestProcess={onOpenRequestProcess}
          />
        ),
    },
  ]
}

function ConnectionRequestPage({ userType = '', accessToken = '' }) {
  const [requestForm, setRequestForm] = useState(null)
  const [requestDocument, setRequestDocument] = useState(null)
  const [requestDocumentMode, setRequestDocumentMode] = useState('view')
  const [requestDocumentLoading, setRequestDocumentLoading] = useState(false)
  const [requestDocumentApproving, setRequestDocumentApproving] = useState(false)
  const [requestDocumentError, setRequestDocumentError] = useState('')
  const [monitoringPointFactory, setMonitoringPointFactory] = useState(null)
  const [connectionSettingsContext, setConnectionSettingsContext] = useState(null)
  const [operatorFactoryRows, setOperatorFactoryRows] = useState([])
  const [operatorFactoriesError, setOperatorFactoriesError] = useState('')
  const [requestTableRows, setRequestTableRows] = useState([])
  const [requestTableError, setRequestTableError] = useState('')
  const isOperator = userType === 'operator'
  const availableSubMenus = useMemo(
    () => (isOperator ? subMenus : subMenus.filter((menu) => menu.value !== 'factories')),
    [isOperator],
  )
  const [selectedSubMenu, setSelectedSubMenu] = useState(() => (userType === 'operator' ? 'factories' : 'requests'))
  const effectiveSubMenu = availableSubMenus.some((menu) => menu.value === selectedSubMenu)
    ? selectedSubMenu
    : availableSubMenus[0]?.value
  const factoryColumns = useMemo(
    () =>
      getFactoryColumns(
        isOperator,
        (factory, formType) => setRequestForm({ factory, formType }),
        setMonitoringPointFactory,
      ),
    [isOperator],
  )
  const handleOpenRequestDocument = useCallback((row, mode = 'view') => {
    setRequestDocument(row)
    setRequestDocumentMode(mode)
    setRequestDocumentError('')

    if (!row?.id) {
      setRequestDocumentLoading(false)
      setRequestDocumentError('ไม่พบรหัสคำขอสำหรับโหลดรายละเอียด')
      return
    }

    if (!accessToken) {
      setRequestDocumentLoading(false)
      setRequestDocumentError('กรุณาเข้าสู่ระบบเพื่อดูรายละเอียดคำขอ')
      return
    }

    setRequestDocumentLoading(true)

    fetch(getRequestDetailApiUrl(row.id), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(async (result) => {
        const payload = await result.json().catch(() => null)

        if (!result.ok) {
          throw new Error(payload?.message || `โหลดรายละเอียดคำขอไม่สำเร็จ (${result.status} ${result.statusText})`)
        }

        setRequestDocument(mapRequestDetailRow(payload?.data ?? {}, row))
        setRequestDocumentError('')
      })
      .catch((error) => {
        setRequestDocumentError(error instanceof Error ? error.message : 'โหลดรายละเอียดคำขอไม่สำเร็จ')
      })
      .finally(() => {
        setRequestDocumentLoading(false)
      })
  }, [accessToken])
  const approveRequestDocument = useCallback(() => {
    if (!requestDocument?.id) {
      setRequestDocumentError('ไม่พบรหัสคำขอสำหรับอนุมัติ')
      return
    }

    if (!accessToken) {
      setRequestDocumentError('กรุณาเข้าสู่ระบบเจ้าหน้าที่เพื่ออนุมัติคำขอ')
      return
    }

    setRequestDocumentApproving(true)
    setRequestDocumentError('')

    fetch(getRequestStatusApiUrl(requestDocument.id), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'APPROVE_FORM',
        officerNote: 'แบบถูกต้อง',
      }),
    })
      .then(async (result) => {
        const payload = await result.json().catch(() => null)

        if (!result.ok) {
          throw new Error(payload?.message || `อนุมัติคำขอไม่สำเร็จ (${result.status} ${result.statusText})`)
        }

        const updatedRequest = payload?.data ? mapRequestDetailRow(payload.data, requestDocument) : requestDocument
        setRequestDocument(updatedRequest)
        setRequestTableRows((rows) =>
          rows.map((row) => (row.id === requestDocument.id ? { ...row, ...updatedRequest } : row)),
        )
      })
      .catch((error) => {
        setRequestDocumentError(error instanceof Error ? error.message : 'อนุมัติคำขอไม่สำเร็จ')
      })
      .finally(() => {
        setRequestDocumentApproving(false)
      })
  }, [accessToken, requestDocument])
  const requestColumns = useMemo(
    () =>
      getRequestColumns(
        isOperator,
        setConnectionSettingsContext,
        (row) => handleOpenRequestDocument(row, 'view'),
        (row) => handleOpenRequestDocument(row, 'process'),
      ),
    [handleOpenRequestDocument, isOperator],
  )
  useEffect(() => {
    if (!isOperator || effectiveSubMenu !== 'factories') {
      return
    }

    if (!accessToken) {
      return
    }

    let isActive = true

    fetch(operatorFactoriesApiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(async (result) => {
        const payload = await result.json().catch(() => null)

        if (!result.ok) {
          throw new Error(payload?.message || `โหลดรายชื่อโรงงานไม่สำเร็จ (${result.status} ${result.statusText})`)
        }

        if (isActive) {
          setOperatorFactoryRows(Array.isArray(payload?.data) ? payload.data.map(mapOperatorFactoryRow) : [])
          setOperatorFactoriesError('')
        }
      })
      .catch((error) => {
        if (isActive) {
          setOperatorFactoryRows([])
          setOperatorFactoriesError(error instanceof Error ? error.message : 'โหลดรายชื่อโรงงานไม่สำเร็จ')
        }
      })

    return () => {
      isActive = false
    }
  }, [accessToken, effectiveSubMenu, isOperator])
  useEffect(() => {
    if (effectiveSubMenu !== 'requests') {
      return
    }

    if (!accessToken) {
      return
    }

    let isActive = true

    fetch(requestTableRowsApiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(async (result) => {
        const payload = await result.json().catch(() => null)

        if (!result.ok) {
          throw new Error(payload?.message || `โหลดรายการคำขอไม่สำเร็จ (${result.status} ${result.statusText})`)
        }

        if (isActive) {
          setRequestTableRows(Array.isArray(payload?.data) ? payload.data.map(mapRequestTableRow) : [])
          setRequestTableError('')
        }
      })
      .catch((error) => {
        if (isActive) {
          setRequestTableRows([])
          setRequestTableError(error instanceof Error ? error.message : 'โหลดรายการคำขอไม่สำเร็จ')
        }
      })

    return () => {
      isActive = false
    }
  }, [accessToken, effectiveSubMenu])
  const table = useMemo(
    () =>
      effectiveSubMenu === 'factories'
        ? {
            title: 'รายชื่อโรงงาน',
            rows: isOperator ? (accessToken ? operatorFactoryRows : []) : factoryRows,
            columns: factoryColumns,
            loading: false,
          }
        : {
            title: 'รายการคำขอ',
            rows: accessToken ? requestTableRows : [],
            columns: requestColumns,
            loading: false,
          },
    [accessToken, effectiveSubMenu, factoryColumns, isOperator, operatorFactoryRows, requestColumns, requestTableRows],
  )
  const effectiveOperatorFactoriesError =
    isOperator && effectiveSubMenu === 'factories' && !accessToken
      ? 'กรุณาเข้าสู่ระบบเพื่อดูรายชื่อโรงงาน'
      : operatorFactoriesError
  const effectiveRequestTableError =
    effectiveSubMenu === 'requests' && !accessToken
      ? 'กรุณาเข้าสู่ระบบเพื่อดูรายการคำขอ'
      : requestTableError
  const handleRequestSubmitted = useCallback((request) => {
    if (request) {
      setRequestTableRows((rows) => [mapRequestTableRow(request), ...rows])
    }
    setSelectedSubMenu('requests')
  }, [])

  return (
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
      <Paper
        elevation={0}
        sx={{
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            px: { xs: 2, md: 3 },
            py: { xs: 1.5, md: 2 },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="h5" component="h1" fontWeight={700}>
            ขอเชื่อมต่อ
          </Typography>
          <Tabs
            value={effectiveSubMenu}
            onChange={(_, value) => setSelectedSubMenu(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 40,
              '& .MuiTab-root': {
                minHeight: 40,
              },
            }}
          >
            {availableSubMenus.map((menu) => (
              <Tab key={menu.value} value={menu.value} label={menu.label} />
            ))}
          </Tabs>
        </Stack>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          flex: 1,
          minHeight: 0,
          border: 1,
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        {effectiveSubMenu === 'factories' && effectiveOperatorFactoriesError ? (
          <Typography color="error" variant="body2" sx={{ px: 2, py: 1 }}>
            {effectiveOperatorFactoriesError}
          </Typography>
        ) : null}
        {effectiveSubMenu === 'requests' && effectiveRequestTableError ? (
          <Typography color="error" variant="body2" sx={{ px: 2, py: 1 }}>
            {effectiveRequestTableError}
          </Typography>
        ) : null}
        <DataGrid
          rows={table.rows}
          columns={table.columns}
          loading={table.loading}
          disableRowSelectionOnClick
          showToolbar
          showCellVerticalBorder
          showColumnVerticalBorder
          label={table.title}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize: 10 },
            },
          }}
          localeText={{
            noRowsLabel: 'ไม่มีข้อมูล',
            columnMenuSortAsc: 'เรียงจากน้อยไปมาก',
            columnMenuSortDesc: 'เรียงจากมากไปน้อย',
            columnMenuFilter: 'ตัวกรอง',
            columnMenuHideColumn: 'ซ่อนคอลัมน์',
            columnMenuManageColumns: 'จัดการคอลัมน์',
            footerRowSelected: (count) => `เลือก ${count.toLocaleString('th-TH')} รายการ`,
          }}
          sx={{
            border: 0,
            '& .MuiDataGrid-columnHeaders': {
              borderTop: 1,
              borderBottom: 1,
              borderColor: 'divider',
            },
            '& .MuiDataGrid-columnHeader': {
              borderColor: 'divider',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 600,
            },
            '& .MuiDataGrid-cell': {
              alignItems: 'center',
              borderColor: 'divider',
            },
            '& .MuiDataGrid-cell--textLeft': {
              display: 'flex',
              alignItems: 'center',
            },
            '& .MuiDataGrid-row--lastVisible .MuiDataGrid-cell': {
              borderBottom: 1,
              borderColor: 'divider',
            },
            '& .MuiDataGrid-toolbarLabel': {
              fontWeight: 600,
            },
          }}
        />
      </Paper>
      <RequestFormBottomSheet
        open={Boolean(requestForm)}
        formType={requestForm?.formType ?? ''}
        factory={requestForm?.factory}
        accessToken={accessToken}
        onSubmitted={handleRequestSubmitted}
        onClose={() => setRequestForm(null)}
      />
      <MonitoringPointListDialog
        open={Boolean(monitoringPointFactory)}
        factory={monitoringPointFactory}
        isOperator={isOperator}
        onOpenConnectionSettings={setConnectionSettingsContext}
        onClose={() => setMonitoringPointFactory(null)}
      />
      <RequestDocumentDialog
        open={Boolean(requestDocument)}
        request={requestDocument}
        mode={requestDocumentMode}
        loading={requestDocumentLoading}
        error={requestDocumentError}
        onClose={() => {
          setRequestDocument(null)
          setRequestDocumentMode('view')
          setRequestDocumentError('')
          setRequestDocumentLoading(false)
          setRequestDocumentApproving(false)
        }}
        approving={requestDocumentApproving}
        onApprove={approveRequestDocument}
      />
      <ConnectionSettingsDialog
        open={Boolean(connectionSettingsContext)}
        context={connectionSettingsContext}
        accessToken={accessToken}
        onClose={() => setConnectionSettingsContext(null)}
      />
    </Stack>
  )
}

export default ConnectionRequestPage
