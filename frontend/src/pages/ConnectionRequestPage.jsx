import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Autocomplete,
  Badge,
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
  Popover,
  Radio,
  RadioGroup,
  Select,
  Alert,
  Snackbar,
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
import DescriptionIcon from '@mui/icons-material/Description'
import HistoryIcon from '@mui/icons-material/History'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import LinkIcon from '@mui/icons-material/Link'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { DataGrid } from '@mui/x-data-grid'
import cemsInstallationRequiredOptionItems from '../option/cemsInstallationRequiredOptions.json'
import cemsParameterOptionItems from '../option/cemsParameterOptions.json'
import fuelOptionItems from '../option/fuelOptions.json'
import treatmentSystemOptionItems from '../option/treatmentSystemOptions.json'
import wpmsTreatmentSystemOptionItems from '../option/wpmsTreatmentSystemOptions.json'
import wpmsParameterOptionItems from '../option/wpmsParameterOptions.json'
import OfficerStatisticsPanel from '../components/OfficerStatisticsPanel'
import { createConnectionRequestPdf } from '../utils/connectionRequestPdf'
import { deriveCriteriaRows, isCriteriaInputValid } from '../utils/instrumentCriteria.mjs'

const subMenus = [
  { value: 'factories', label: 'รายชื่อโรงงาน' },
  { value: 'requests', label: 'รายการคำขอ', badgeContent: 1 },
  { value: 'statistics', label: 'สถิติข้อมูล' },
]

const getOptionValue = (option) => (typeof option === 'string' ? option : option.value ?? option.label)
const getOptionLabel = (option) => (typeof option === 'string' ? option : option.label ?? option.value)

const cemsParameterOptions = cemsParameterOptionItems.map((option) => option.label)
const parameterNoneOption = 'ไม่มี'
const withNoneOption = (options = []) => [parameterNoneOption, ...options.filter((option) => option !== parameterNoneOption)]

const monitoringPointTypeOptions = ['CEMS', 'WPMS']

const wpmsInstrumentParameters = wpmsParameterOptionItems.map((option) => option.label)
const cemsInstallationRequiredOptions = cemsInstallationRequiredOptionItems.map((option) => ({
  label: getOptionLabel(option),
  value: getOptionValue(option),
}))
const fuelOptions = fuelOptionItems.map((option) => ({
  label: getOptionLabel(option),
  value: getOptionValue(option),
}))
const treatmentSystemOptions = treatmentSystemOptionItems.map((option) => ({
  label: getOptionLabel(option),
  value: getOptionValue(option),
}))
const wpmsTreatmentSystemOptions = wpmsTreatmentSystemOptionItems.map((option) => ({
  label: getOptionLabel(option),
  value: getOptionValue(option),
}))
const legalAnnexNoOptions = Array.from({ length: 13 }, (_, index) => String(index + 1))
const isOtherOption = (value = '') => value === 'อื่นๆ' || value.includes('อื่นๆ')
const isBiomassOption = (value = '') => value.includes('ชีวมวล') || value.toLowerCase().includes('biomass')
const eiaAssessmentOptions = ['ไม่มี', 'มี IEE', 'มี EIA', 'มี EHIA', 'อื่นๆ']
const eiaProjectOptions = ['มี IEE', 'มี EIA', 'มี EHIA']
const combustionControlSystemOptions = ['ระบบปิด', 'ระบบเปิด']
const cemsLegalAnnexRequiredOptions = cemsInstallationRequiredOptions.slice(0, 2).map((option) => option.value)
const connectionDeviceOptions = ['POMS Box (กรอ.)', 'POMS Box (กนอ.)', 'POMS Client (เดิม)', 'D-POMS Client (ใหม่)', 'อื่นๆ']

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

function createCriteria(standardValue = '', rows = {}, enabled = false) {
  return {
    enabled,
    standardValue,
    rows: specialCriteriaRows.map((row) => ({
      level: row.key,
      min: rows[row.key]?.min ?? '',
      max: rows[row.key]?.max ?? '',
    })),
  }
}

function normalizeInstrumentCriteria(criteria = {}) {
  const rowsByLevel = Array.isArray(criteria?.rows)
    ? Object.fromEntries(criteria.rows.map((row) => [row.level, row]))
    : criteria?.rows ?? {}

  return {
    enabled: Boolean(criteria?.enabled),
    standardValue: criteria?.standardValue ?? '',
    rows: specialCriteriaRows.map((row) => ({
      level: row.key,
      min: rowsByLevel[row.key]?.min ?? '',
      max: rowsByLevel[row.key]?.max ?? '',
    })),
  }
}

function buildInstrumentDialogForm(value = {}) {
  return {
    parameter: value?.parameter ?? '',
    technique: value?.technique ?? emptyInstrumentParameter.technique,
    range: value?.range ?? emptyInstrumentParameter.range,
    brand: value?.brand ?? emptyInstrumentParameter.brand,
    supplier: value?.supplier ?? emptyInstrumentParameter.supplier,
    eiaStandard: value?.eiaStandard ?? emptyInstrumentParameter.eiaStandard,
    standardCondition: value?.standardCondition ?? emptyInstrumentParameter.standardCondition,
    dryBasis: value?.dryBasis ?? emptyInstrumentParameter.dryBasis,
    oxygenOrExcessAir: value?.oxygenOrExcessAir ?? emptyInstrumentParameter.oxygenOrExcessAir,
    standardCriteria: normalizeInstrumentCriteria(value?.standardCriteria),
    eiaCriteria: normalizeInstrumentCriteria(value?.eiaCriteria),
  }
}

const mockCemsEligibleParameters = [
  'NOx (ppm)',
  'SO2 (ppm)',
  'CO (ppm)',
  'Temp. (C°)',
  'O2 (%)',
  'Opacity (%)',
  'Flow Rate (m3/hr)',
  'Particulate (mg/m3)',
]

const mockCemsExemptedParameters = [
  'As (mg/m3)',
  'Cl (mg/m3)',
  'Cl (ppm)',
  'CO2 (%)',
  'Cresol (ppm)',
  'Cu (mg/m3)',
  'Dioxins/Furans (µg/m3)',
  'H2S (ppm)',
  'H2SO4 (ppm)',
  'HCl (mg/m3)',
  'HCl (ppm)',
  'HF (ppm)',
  'Hg (mg/m3)',
  'Moisture (%)',
  'Opacity (mg/m3)',
  'Pb (mg/m3)',
  'Pressure (mmHg)',
  'Sb (mg/m3)',
  'TRS (ppm)',
  'Xylene (ppm)',
]

function getInitialInstrumentRows(initialInstruments = {}) {
  if (Array.isArray(initialInstruments.parameters) && initialInstruments.parameters.length) {
    return initialInstruments.parameters
  }

  return []
}

const mockCemsMonitoringPointDetails = {
  pointCode: 'CEMS-STACK-001',
  pointName: 'ปล่องระบาย A',
  productionUnitType: 'หม้อไอน้ำ',
  productionCapacity: '10 ตันไอน้ำ/ชั่วโมง',
  cemsInstallationRequiredBy: cemsInstallationRequiredOptions[0]?.value ?? '',
  legalAnnexNo: ['1'],
  eligibleParameters: mockCemsEligibleParameters,
  exemptedParameters: mockCemsExemptedParameters,
  connectedParameters: [],
  pendingParameters: mockCemsEligibleParameters,
  timeSharingParameters: [],
  sharedStackCode: '',
  stackShape: 'วงกลม',
  stackDiameter: '1.2',
  stackHeight: '30',
  monitoringHeight: '20',
  averageFlowRate: '1200',
  minFlowRate: '1000',
  maxFlowRate: '1500',
  primaryFuel: 'ก๊าซธรรมชาติ (NG)',
  primaryFuelPercent: '80',
  secondaryFuel: 'ไม่มี',
  combustionControlSystem: 'ควบคุมอัตโนมัติ',
  hasTreatmentSystem: 'มี',
  treatmentSystem: 'สครับเบอร์แบบเปียก (ไม่มี media) (Wet Scrubber)',
  stackLatitude: '13.7563',
  stackLongitude: '100.5018',
  connectionDevice: 'POMS Box (กรอ.)',
}

const mockWpmsMonitoringPointDetails = {
  pointCode: 'WPMS-WW-001',
  pointName: 'จุดระบายน้ำทิ้ง A',
  eligibleParameters: ['BOD (mg/l)', 'COD (mg/l)', 'Flow rate (m3/hr)'],
  connectedParameters: [],
  pendingParameters: ['BOD (mg/l)', 'COD (mg/l)', 'Flow rate (m3/hr)'],
  averageWastewaterDischarge: '500',
  minWastewaterDischarge: '300',
  maxWastewaterDischarge: '800',
  hasTreatmentSystem: 'มี',
  treatmentSystem: 'อื่นๆ',
  treatmentSystemOther: 'ระบบบำบัดชีวภาพ',
  maxTreatmentCapacity: '1000',
  instrumentLatitude: '13.7563',
  instrumentLongitude: '100.5018',
  wastewaterSource: 'กระบวนการผลิต',
  dischargeReceivingSource: 'คลองสาธารณะ',
  connectionDevice: 'POMS Box (กรอ.)',
}

const mockMeasurementInstrumentDetails = {
  converterBrand: 'Converter Brand',
  converterModel: 'CV-100',
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
  ...[...cemsParameterOptionItems, ...wpmsParameterOptionItems].reduce((units, option) => {
    units[option.label] = option.unit
    return units
  }, {}),
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

function normalizeArrayValue(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim()
    if (!trimmedValue) {
      return []
    }
    if (isKnownMultiSelectOption(trimmedValue)) {
      return [trimmedValue]
    }

    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function isKnownMultiSelectOption(value) {
  const optionValues = [
    parameterNoneOption,
    ...cemsParameterOptions,
    ...wpmsInstrumentParameters,
    ...legalAnnexNoOptions,
    ...treatmentSystemOptions.map((option) => option.value),
    ...wpmsTreatmentSystemOptions.map((option) => option.value),
  ]

  return optionValues.includes(value)
}

function splitProductionCapacity(details = {}) {
  if (details.productionCapacityValue || details.productionCapacityUnit) {
    return {
      value: details.productionCapacityValue ?? '',
      unit: details.productionCapacityUnit ?? '',
    }
  }

  const productionCapacity = details.productionCapacity ?? ''
  const [value = '', ...unitParts] = String(productionCapacity).trim().split(/\s+/)

  return {
    value,
    unit: unitParts.join(' '),
  }
}

function formatProductionCapacity(value, unit) {
  return [value, unit].map((item) => String(item ?? '').trim()).filter(Boolean).join(' ')
}

function normalizeDecimalInput(value, maxDecimals = 4) {
  const rawValue = String(value ?? '')

  if (!rawValue.includes('.')) {
    return rawValue
  }

  const [integerPart, decimalPart = ''] = rawValue.split('.')
  return `${integerPart}.${decimalPart.slice(0, maxDecimals)}`
}

function formatCriteriaNumber(value) {
  return Number(value.toFixed(4)).toString()
}

function createInstrumentRowForParameter(parameter) {
  return {
    ...emptyInstrumentParameter,
    parameter,
    standardCriteria: createCriteria(),
    eiaCriteria: createCriteria(),
  }
}

function syncInstrumentRowsWithRequestedParameters(currentRows = [], requestedParameters = []) {
  const parameters = requestedParameters.filter((parameter) => parameter && parameter !== parameterNoneOption)
  return parameters.map((parameter) => {
    const existingRow = currentRows.find((row) => row.parameter === parameter)
    return existingRow ?? createInstrumentRowForParameter(parameter)
  })
}

function getEiaAssessmentValue(factory = {}) {
  const eia = factory.eia ?? ''

  if (eiaAssessmentOptions.includes(eia)) {
    return eia
  }

  if (eia === 'มี') {
    return 'มี EIA'
  }

  return eia || 'ไม่มี'
}

function getEiaFormValue(formData, factory = {}) {
  return getFormValue(formData, 'eia', getEiaAssessmentValue(factory))
}

function getHasEiaFormValue(formData, factory = {}) {
  return eiaProjectOptions.includes(getEiaFormValue(formData, factory))
}

function createCriteriaRowsFromStandardValue(standardValue) {
  const derivedRows = deriveCriteriaRows(standardValue)
  if (!derivedRows) {
    return createCriteria(standardValue).rows
  }

  return derivedRows.map((row) => ({
    ...row,
    min: row.min === '' ? '' : formatCriteriaNumber(Number(row.min)),
    max: row.max === '' ? '' : formatCriteriaNumber(Number(row.max)),
  }))
}

function getDefaultConnectionForm(type) {
  if (type === 'Modbus RTU') {
    return {
      comPort: '',
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
  },
  {
    title: 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท',
    uploadLabel: 'ภาพ/ไฟล์/QR Code',
    accept: 'image/jpeg,image/png',
    singleFile: true,
    helperText: 'ขนาด 512 × 512 pixel ไม่เกิน 5 Mb',
  },
  {
    title: 'ภาพถ่ายปล่อง',
    uploadLabel: 'ภาพ/ไฟล์/QR Code',
  },
  {
    title: 'ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (CEMS)',
    uploadLabel: 'ภาพ/ไฟล์/QR Code',
  },
  {
    title: 'ภาพถ่ายระบบบำบัด',
    legacyTitles: ['ระบบบำบัด'],
    uploadLabel: 'ภาพ/ไฟล์/QR Code',
  },
  {
    title: 'ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (WPMS)',
    uploadLabel: 'ภาพ/ไฟล์/QR Code',
  },
]

const factoryGeneralDocumentImageTitles = ['ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน', 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท']
const cemsDocumentImageTitles = ['ข้อมูลรายละเอียดการรายงานค่าที่สภาวะมาตรฐาน', 'รายงานผลการทำ RATA หรือ อื่นๆ ที่เทียบเท่า ของระบบ CEMS ครั้งล่าสุด', 'ภาพถ่ายปล่อง', 'ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (CEMS)']
const wpmsDocumentImageTitles = ['ภาพถ่ายระบบบำบัด', 'ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (WPMS)']

function documentTitleMatchesItem(document, item) {
  return [item.title, ...(item.legacyTitles ?? [])].includes(document?.title)
}

const documentCollectionKeys = [
  'documentsAndImages',
  'documentImages',
  'documents',
  'attachments',
  'files',
]

function normalizeDocumentFile(file = {}) {
  return {
    ...file,
    fileName: file.fileName ?? file.originalFileName ?? file.name ?? file.storedFileName ?? '',
    fileUrl: file.fileUrl ?? file.url ?? file.storageUrl ?? file.path ?? '',
    fileType: file.fileType ?? file.mimeType ?? file.type ?? '',
    fileSize: file.fileSize ?? file.size ?? null,
  }
}

function normalizeDocumentItem(document = {}) {
  if (!document || typeof document !== 'object') {
    return null
  }

  const files = Array.isArray(document.files)
    ? document.files.map(normalizeDocumentFile)
    : document.files

  return {
    ...document,
    title: document.title ?? document.documentTitle ?? document.documentType ?? document.category ?? '',
    link: document.link ?? document.urlLink ?? document.documentLink ?? '',
    fileName: document.fileName ?? document.originalFileName ?? document.name ?? document.storedFileName ?? '',
    fileUrl: document.fileUrl ?? document.url ?? document.storageUrl ?? document.path ?? '',
    fileType: document.fileType ?? document.mimeType ?? document.type ?? '',
    fileSize: document.fileSize ?? document.size ?? null,
    ...(Array.isArray(files) ? { files } : {}),
  }
}

function getDocumentItemsFromSource(source = {}) {
  return documentCollectionKeys
    .flatMap((key) => (Array.isArray(source?.[key]) ? source[key] : []))
    .map(normalizeDocumentItem)
    .filter(Boolean)
}

function mergeDocumentItems(...documentGroups) {
  const seen = new Set()

  return documentGroups.flat().filter((document) => {
    const key = [
      document.id,
      document.title,
      document.link,
      document.fileUrl,
      document.fileName,
    ].filter(Boolean).join('|')

    if (key && seen.has(key)) {
      return false
    }

    if (key) {
      seen.add(key)
    }

    return true
  })
}

function normalizeAttachmentUrl(url) {
  if (!url) {
    return ''
  }

  if (/^(blob:|data:|https?:\/\/)/i.test(url)) {
    return url
  }

  return `https://d-poms.diw.go.th${url.startsWith('/') ? url : `/${url}`}`
}

function getAttachmentFileName(document = {}) {
  return document.fileName ?? document.originalFileName ?? document.name ?? document.storedFileName ?? ''
}

function getAttachmentFileUrl(document = {}) {
  return normalizeAttachmentUrl(document.filePreviewUrl ?? document.fileUrl ?? document.url ?? document.storageUrl ?? document.path)
}

function isImageAttachment(document = {}) {
  const fileUrl = getAttachmentFileUrl(document)
  const link = normalizeAttachmentUrl(document.link)
  const fileType = document.fileType ?? document.mimeType ?? document.type ?? ''
  const fileName = getAttachmentFileName(document)
  const candidate = `${fileUrl || link} ${fileName}`

  return fileType.startsWith('image/') || /\.(png|jpe?g|webp)(\?.*)?$/i.test(candidate)
}

function expandAttachmentFiles(document = {}) {
  if (!Array.isArray(document.files) || !document.files.length) {
    return [document]
  }

  return document.files.map((file, index) => ({
    ...document,
    ...file,
    title: document.title,
    description: document.description,
    link: index === 0 ? document.link : '',
  }))
}

function getRequestAttachmentGroups(request = {}) {
  const firstPoint = Array.isArray(request?.measurementPoints) ? request.measurementPoints[0] : null
  const documents = mergeDocumentItems(
    getDocumentItemsFromSource(firstPoint),
    getDocumentItemsFromSource(request),
    getDocumentItemsFromSource(request?.request),
  )
  const groups = new Map()

  documents.flatMap(expandAttachmentFiles).forEach((document) => {
    const title = document.title || 'เอกสารแนบ'
    const linkUrl = normalizeAttachmentUrl(document.link)
    const fileName = getAttachmentFileName(document)
    const fileUrl = getAttachmentFileUrl(document)
    const items = []

    if (linkUrl) {
      items.push({ type: 'link', label: linkUrl, url: linkUrl })
    }

    if (fileName && !isImageAttachment(document)) {
      items.push({ type: 'file', label: fileName, url: fileUrl })
    }

    if (!items.length) {
      return
    }

    if (!groups.has(title)) {
      groups.set(title, [])
    }

    groups.get(title).push(...items)
  })

  return Array.from(groups.entries()).map(([title, items]) => ({ title, items }))
}

const appBarHeight = {
  xs: 64,
  md: 72,
}

const measurementPointsRequestApiUrl =
  import.meta.env.DEV
    ? '/api-proxy/v1/cems-wpms-requests/measurement-points'
    : 'https://d-poms.diw.go.th/api/v1/cems-wpms-requests/measurement-points'
const parametersRequestApiUrl =
  import.meta.env.DEV
    ? '/api-proxy/v1/cems-wpms-requests/parameters'
    : 'https://d-poms.diw.go.th/api/v1/cems-wpms-requests/parameters'
const documentImagesApiUrl =
  import.meta.env.DEV
    ? '/api-proxy/v1/cems-wpms-requests/document-images'
    : 'https://d-poms.diw.go.th/api/v1/cems-wpms-requests/document-images'
const operatorFactoriesApiUrl = import.meta.env.DEV
  ? '/api-proxy/v1/cems-wpms-requests/operator-factories'
  : 'https://d-poms.diw.go.th/api/v1/cems-wpms-requests/operator-factories'
const eligibleFactoriesApiUrl = import.meta.env.DEV
  ? '/api-proxy/v1/cems-wpms-requests/eligible-factories'
  : 'https://d-poms.diw.go.th/api/v1/cems-wpms-requests/eligible-factories'
const requestTableRowsApiUrl = import.meta.env.DEV
  ? '/api-proxy/v1/cems-wpms-requests/table-rows'
  : 'https://d-poms.diw.go.th/api/v1/cems-wpms-requests/table-rows'
const requestDetailApiBaseUrl = import.meta.env.DEV
  ? '/api-proxy/v1/cems-wpms-requests'
  : 'https://d-poms.diw.go.th/api/v1/cems-wpms-requests'
const parameterValuesApiBaseUrl = import.meta.env.DEV
  ? '/api-proxy/v1/parameter-values'
  : 'https://d-poms.diw.go.th/api/v1/parameter-values'
const connectedMeasurementPointsApiBaseUrl = import.meta.env.DEV
  ? '/api-proxy/v1/connected-measurement-points'
  : 'https://d-poms.diw.go.th/api/v1/connected-measurement-points'

function getMeasurementPointsRequestApiUrl() {
  if (typeof window === 'undefined') {
    return measurementPointsRequestApiUrl
  }

  if (window.location.hostname === 'd-poms.diw.go.th') {
    return '/api/v1/cems-wpms-requests/measurement-points'
  }

  return measurementPointsRequestApiUrl
}

function getParametersRequestApiUrl() {
  if (typeof window === 'undefined') {
    return parametersRequestApiUrl
  }

  if (window.location.hostname === 'd-poms.diw.go.th') {
    return '/api/v1/cems-wpms-requests/parameters'
  }

  return parametersRequestApiUrl
}

function getDocumentImagesApiUrl() {
  if (typeof window === 'undefined') {
    return documentImagesApiUrl
  }

  if (window.location.hostname === 'd-poms.diw.go.th') {
    return '/api/v1/cems-wpms-requests/document-images'
  }

  return documentImagesApiUrl
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

function getRequestFormApiUrl(id) {
  if (typeof window !== 'undefined' && window.location.hostname === 'd-poms.diw.go.th') {
    return `/api/v1/cems-wpms-requests/${id}/form`
  }

  return `${requestDetailApiBaseUrl}/${id}/form`
}

function getConnectedMeasurementPointsApiUrl(filters = {}) {
  const normalizedFilters = typeof filters === 'string' ? { factoryId: filters } : filters
  const searchParams = new URLSearchParams()

  if (normalizedFilters.factoryId) {
    searchParams.set('factoryId', normalizedFilters.factoryId)
  }

  if (normalizedFilters.stationId) {
    searchParams.set('stationId', normalizedFilters.stationId)
  }

  const query = searchParams.toString() ? `?${searchParams.toString()}` : ''

  if (typeof window !== 'undefined' && window.location.hostname === 'd-poms.diw.go.th') {
    return `/api/v1/connected-measurement-points${query}`
  }

  return `${connectedMeasurementPointsApiBaseUrl}${query}`
}

function getConnectedMeasurementPointRequestsApiUrl(stationId) {
  const encodedStationId = encodeURIComponent(stationId)

  if (typeof window !== 'undefined' && window.location.hostname === 'd-poms.diw.go.th') {
    return `/api/v1/connected-measurement-points/${encodedStationId}/requests`
  }

  return `${connectedMeasurementPointsApiBaseUrl}/${encodedStationId}/requests`
}

function getConnectedMeasurementPointParameterFormApiUrl(stationId) {
  const encodedStationId = encodeURIComponent(stationId)

  if (typeof window !== 'undefined' && window.location.hostname === 'd-poms.diw.go.th') {
    return `/api/v1/connected-measurement-points/${encodedStationId}/parameter-form`
  }

  return `${connectedMeasurementPointsApiBaseUrl}/${encodedStationId}/parameter-form`
}

function getConnectedMeasurementPointDeviceConfigsApiUrl(stationId) {
  const encodedStationId = encodeURIComponent(stationId)

  if (typeof window !== 'undefined' && window.location.hostname === 'd-poms.diw.go.th') {
    return `/api/v1/connected-measurement-points/${encodedStationId}/device-configs`
  }

  return `${connectedMeasurementPointsApiBaseUrl}/${encodedStationId}/device-configs`
}

function getDeviceConfigsApiUrl(id, stationId) {
  const query = stationId ? `?stationId=${encodeURIComponent(stationId)}` : ''

  if (typeof window !== 'undefined' && window.location.hostname === 'd-poms.diw.go.th') {
    return `/api/v1/cems-wpms-requests/${id}/device-configs${query}`
  }

  return `${requestDetailApiBaseUrl}/${id}/device-configs${query}`
}

function getConfirmConnectionApiUrl(id) {
  if (typeof window !== 'undefined' && window.location.hostname === 'd-poms.diw.go.th') {
    return `/api/v1/cems-wpms-requests/${id}/confirm-connection`
  }

  return `${requestDetailApiBaseUrl}/${id}/confirm-connection`
}

function getVerifyConnectionApiUrl(id) {
  if (typeof window !== 'undefined' && window.location.hostname === 'd-poms.diw.go.th') {
    return `/api/v1/cems-wpms-requests/${id}/verify-connection`
  }

  return `${requestDetailApiBaseUrl}/${id}/verify-connection`
}

function getConnectionTestApiUrl(stationId) {
  const query = `?stationId=${encodeURIComponent(stationId)}`

  if (typeof window !== 'undefined' && window.location.hostname === 'd-poms.diw.go.th') {
    return `/api/v1/parameter-values/connection-test${query}`
  }

  return `${parameterValuesApiBaseUrl}/connection-test${query}`
}

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

function createDefaultConnectionItem(context, index = 0) {
  return {
    id: Date.now() + index,
    deviceCode: getConnectionDeviceCode(context, index),
    type: '',
    values: {},
  }
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

function isConnectedMeasurementPointDeviceConfigContext(context) {
  return context?.deviceConfigSource === 'connected-measurement-point'
}

function normalizeEmailList(value) {
  if (Array.isArray(value)) {
    return value.map((email) => String(email ?? '').trim()).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean)
  }

  return []
}

function mapOperatorFactoryRow(row) {
  const monitoringPointCount = Number(row.monitoringPointCount ?? 0)

  return {
    id: row.id,
    factoryId: row.factoryId ?? '',
    factoryName: row.factoryName ?? '',
    newRegistrationNo: row.factoryId ?? '',
    oldRegistrationNo: row.oldRegistrationNo ?? row.factoryRegistrationNo ?? '',
    factoryRegistrationNo: row.oldRegistrationNo ?? row.factoryRegistrationNo ?? '',
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
    officerNotificationEmails: normalizeEmailList(row.officerNotificationEmails),
    monitoringPointCount,
    isEligible: row.isEligible === true,
    eligibilityStatus: row.eligibilityStatus ?? '',
    requestStatusCode: row.requestStatusCode ?? null,
    requestStatus: row.requestStatus ?? row.requestStatusLabel ?? (monitoringPointCount > 0 ? 'เชื่อมต่อแล้ว' : 'ยังไม่มีจุดตรวจวัด'),
    status: row.status ?? 'แสดง',
  }
}

function formatDatePartAsThaiDate(value) {
  if (typeof value !== 'string') return ''

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return ''

  const [, year, month, day] = match
  return `${day}/${month}/${Number(year) + 543}`
}

function mapRequestTableRow(row) {
  return {
    id: row.id,
    factoryId: row.factoryId ?? '',
    factoryName: row.factoryName ?? '',
    newRegistrationNo: row.newRegistrationNo ?? row.factoryId ?? '',
    oldRegistrationNo: row.oldRegistrationNo ?? row.factoryRegistrationNo ?? '',
    industryType: row.industryType ?? '',
    province: row.province ?? '',
    type: row.type ?? '',
    requestNo: row.requestNo ?? '',
    submittedAt: row.submittedAt ?? null,
    submittedDate: formatDatePartAsThaiDate(row.submittedAt) || row.submittedDate || '',
    monitoringPointCode: row.monitoringPointCode ?? '',
    codeIssuedAt: row.codeIssuedAt ?? null,
    codeIssuedDate: row.codeIssuedDate ?? '',
    form: row.form ?? '',
    status: row.status ?? '',
    statusCode: row.statusCode ?? '',
    requestType: row.requestType ?? '',
  }
}

function mapConnectedMeasurementPointRow(row) {
  const point = row.point ?? {}

  return {
    id: row.id ?? point.id ?? row.requestId,
    requestId: row.requestId ?? row.id ?? '',
    requestNo: row.requestNo ?? '',
    factoryId: row.factory?.factoryId ?? row.factoryId ?? '',
    factory: row.factory ?? {},
    type: row.type ?? row.systemType ?? '',
    code: point.pointCode ?? point.code ?? row.pointCode ?? '',
    pointCode: point.pointCode ?? point.code ?? row.pointCode ?? '',
    name: point.pointName ?? point.name ?? row.pointName ?? '',
    pointName: point.pointName ?? point.name ?? row.pointName ?? '',
    pointType: point.pointType ?? row.pointType ?? '',
    typeLabel: point.pointType ?? row.pointType ?? '',
    parameters: Array.isArray(point.parameters) ? point.parameters : [],
    status: row.status ?? 'เชื่อมต่อแล้ว',
    statusCode: row.statusCode ?? 'CONNECTED',
    connectedAt: row.connectedAt ?? null,
    deviceConfigs: Array.isArray(row.deviceConfigs) ? row.deviceConfigs : [],
    request: {
      id: row.requestId ?? row.id ?? '',
      requestId: row.requestId ?? row.id ?? '',
      requestNo: row.requestNo ?? '',
    },
  }
}

function mapRequestDetailRow(detail = {}, row = {}) {
  const factory = detail.factory ?? {}
  const sourceMeasurementPoints = Array.isArray(detail.measurementPoints) ? detail.measurementPoints : row.measurementPoints
  const requestDocuments = mergeDocumentItems(
    getDocumentItemsFromSource(row),
    getDocumentItemsFromSource(detail),
    getDocumentItemsFromSource(detail.request),
  )
  const measurementPoints = Array.isArray(sourceMeasurementPoints)
    ? sourceMeasurementPoints.map((point, index) => {
        const pointDocuments = getDocumentItemsFromSource(point)
        const documentsAndImages = index === 0
          ? mergeDocumentItems(pointDocuments, requestDocuments)
          : pointDocuments

        return {
          ...point,
          pointCode: point.pointCode ?? point.code ?? point.monitoringPointCode ?? point.stationId ?? '',
          pointName: point.pointName ?? point.name ?? point.monitoringPointName ?? '',
          pointType: point.pointType ?? point.type ?? '',
          details: point.details ?? {},
          measurementInstruments: point.measurementInstruments ?? { parameters: [] },
          documentsAndImages,
        }
      })
    : sourceMeasurementPoints
  const firstPoint = Array.isArray(measurementPoints) ? measurementPoints[0] : null

  return {
    ...row,
    ...detail,
    measurementPoints,
    id: detail.id ?? row.id,
    factoryId: detail.factoryId ?? factory.factoryId ?? row.factoryId ?? '',
    factoryName: detail.factoryName ?? factory.factoryName ?? row.factoryName ?? '',
    newRegistrationNo: detail.newRegistrationNo ?? factory.newRegistrationNo ?? row.newRegistrationNo ?? detail.factoryId ?? factory.factoryId ?? row.factoryId ?? '',
    oldRegistrationNo: detail.oldRegistrationNo ?? detail.factoryRegistrationNo ?? factory.oldRegistrationNo ?? row.oldRegistrationNo ?? row.factoryRegistrationNo ?? '',
    industryType: detail.industryType ?? factory.industryType ?? row.industryType ?? '',
    province: detail.province ?? factory.province ?? row.province ?? '',
    type: detail.type ?? detail.systemType ?? firstPoint?.details?.monitoringPointKind ?? row.type ?? '',
    systemType: detail.systemType ?? detail.type ?? firstPoint?.details?.monitoringPointKind ?? row.systemType ?? row.type ?? '',
    requestNo: detail.requestNo ?? row.requestNo ?? '',
    submittedDate: formatDatePartAsThaiDate(detail.submittedAt) || detail.submittedDate || row.submittedDate || '',
    monitoringPointCode: detail.monitoringPointCode ?? firstPoint?.pointCode ?? firstPoint?.code ?? firstPoint?.monitoringPointCode ?? row.monitoringPointCode ?? '',
    codeIssuedDate: detail.codeIssuedDate ?? row.codeIssuedDate ?? '',
    form: detail.form ?? row.form ?? '',
    status: detail.status ?? row.status ?? '',
    statusCode: detail.statusCode ?? row.statusCode ?? '',
    statusLabel: detail.statusLabel ?? row.statusLabel ?? '',
    requestType: detail.requestType ?? row.requestType ?? '',
  }
}

function getInitialRequestPoint(request = {}) {
  const safeRequest = request ?? {}

  return Array.isArray(safeRequest.measurementPoints) ? safeRequest.measurementPoints[0] ?? {} : {}
}

function getInitialRequestFactory(request = {}, fallbackFactory = {}) {
  const safeRequest = request ?? {}
  const factory = safeRequest.factory ?? {}

  return {
    ...fallbackFactory,
    ...factory,
    factoryId: safeRequest.factoryId ?? factory.factoryId ?? fallbackFactory.factoryId ?? '',
    factoryName: safeRequest.factoryName ?? factory.factoryName ?? fallbackFactory.factoryName ?? '',
    newRegistrationNo: safeRequest.newRegistrationNo ?? factory.newRegistrationNo ?? fallbackFactory.newRegistrationNo ?? safeRequest.factoryId ?? '',
    oldRegistrationNo: safeRequest.factoryRegistrationNo ?? safeRequest.oldRegistrationNo ?? factory.oldRegistrationNo ?? fallbackFactory.oldRegistrationNo ?? '',
    factoryRegistrationNo: safeRequest.factoryRegistrationNo ?? factory.factoryRegistrationNo ?? fallbackFactory.factoryRegistrationNo ?? '',
    industryMainOrder: safeRequest.industryMainOrder ?? factory.industryMainOrder ?? fallbackFactory.industryMainOrder ?? '',
    industrySubOrder: safeRequest.industrySubOrder ?? factory.industrySubOrder ?? fallbackFactory.industrySubOrder ?? '',
    businessActivity: safeRequest.businessActivity ?? factory.businessActivity ?? fallbackFactory.businessActivity ?? '',
    eia: safeRequest.eia ?? factory.eia ?? fallbackFactory.eia ?? '',
    eiaOther: safeRequest.eiaOther ?? factory.eiaOther ?? fallbackFactory.eiaOther ?? '',
    hasEia: safeRequest.hasEia ?? factory.hasEia ?? fallbackFactory.hasEia,
    projectName: safeRequest.projectName ?? factory.projectName ?? fallbackFactory.projectName ?? '',
    address: safeRequest.address ?? factory.address ?? fallbackFactory.address ?? '',
    latitude: safeRequest.latitude ?? factory.latitude ?? fallbackFactory.latitude ?? '',
    longitude: safeRequest.longitude ?? factory.longitude ?? fallbackFactory.longitude ?? '',
  }
}

function getRequestSystemType(request = {}, fallback = 'CEMS') {
  const safeRequest = request ?? {}
  const point = getInitialRequestPoint(safeRequest)
  const details = point.details ?? {}
  const pointType = point.pointType
  const systemType = safeRequest.systemType ?? safeRequest.type ?? details.monitoringPointKind

  if (systemType === 'WPMS' || pointType === 'WASTEWATER') {
    return 'WPMS'
  }

  return fallback || 'CEMS'
}

function getLatestRevisionMessage(request = {}) {
  const safeRequest = request ?? {}
  const directMessage = safeRequest.revisionReason ?? safeRequest.officerNote ?? safeRequest.revisionNote

  if (directMessage) {
    return directMessage
  }

  const history = Array.isArray(safeRequest.statusHistory) ? safeRequest.statusHistory : []
  const revisionHistory = history
    .filter((item) =>
      [item.status, item.statusLabel, item.statusCode].includes('WAITING_FACTORY_REVISION')
        || [item.status, item.statusLabel, item.statusCode].includes('รอโรงงานแก้ไข'),
    )
    .sort((a, b) => {
      const dateA = a.changedAt ? new Date(a.changedAt).getTime() : 0
      const dateB = b.changedAt ? new Date(b.changedAt).getTime() : 0

      if (dateA !== dateB) {
        return dateB - dateA
      }

      return Number(b.id ?? 0) - Number(a.id ?? 0)
    })

  return revisionHistory[0]?.revisionReason
    ?? revisionHistory[0]?.officerNote
    ?? revisionHistory[0]?.note
    ?? ''
}

function getStatusHistoryDate(item = {}) {
  return item.changedAt ?? null
}

function getStatusHistoryLabel(item = {}) {
  return item.statusLabel ?? item.statusName ?? item.label ?? item.status ?? item.statusCode ?? '-'
}

function getStatusHistoryRecorder(item = {}) {
  return item.changedByName
    ?? item.changedByFullName
    ?? item.createdByName
    ?? item.updatedByName
    ?? item.recorderName
    ?? item.userName
    ?? item.changedBy
    ?? item.createdBy
    ?? '-'
}

function getStatusHistoryNote(item = {}) {
  return item.revisionReason ?? item.officerNote ?? item.note ?? ''
}

function formatStatusHistoryDate(value) {
  if (!value) return '-'

  if (typeof value === 'string') {
    const datePartMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (datePartMatch) {
      const [, year, month, day] = datePartMatch
      return `${day}/${month}/${Number(year) + 543}`
    }
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatStatusHistoryDuration(startValue, endValue, fallbackValue) {
  if (fallbackValue) return fallbackValue
  if (!startValue || !endValue) return ''

  const startDate = new Date(startValue)
  const endDate = new Date(endValue)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return ''

  const diffMs = Math.max(0, endDate.getTime() - startDate.getTime())
  const totalDays = Math.max(1, Math.ceil(diffMs / 86_400_000))

  return `${totalDays} วัน`
}

function getStatusHistoryItems(history = []) {
  return history
    .filter(Boolean)
    .map((item, index) => ({
      ...item,
      __index: index,
      __date: getStatusHistoryDate(item),
    }))
    .sort((a, b) => {
      const dateA = a.__date ? new Date(a.__date).getTime() : 0
      const dateB = b.__date ? new Date(b.__date).getTime() : 0

      if (dateA !== dateB) {
        return dateA - dateB
      }

      return Number(a.id ?? a.__index) - Number(b.id ?? b.__index)
    })
}

function withFormIds(items = []) {
  return items.length ? items.map((item, index) => ({ ...item, id: item.id ?? index + 1 })) : [{ id: 1 }]
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

  return formData
    .getAll(key)
    .flatMap((value) => {
      const stringValue = String(value)
      try {
        const parsedValue = JSON.parse(stringValue)
        return Array.isArray(parsedValue) ? parsedValue : [parsedValue]
      } catch {
        return [stringValue]
      }
    })
    .map((value) => String(value).trim())
    .filter(Boolean)
}

function buildContactPersons(formData) {
  if (!formData) {
    return []
  }

  const names = formData.getAll('contactName')
  const positions = formData.getAll('contactPosition')
  const phones = formData.getAll('contactPhone')
  const emails = formData.getAll('contactEmail')
  const rowCount = Math.max(names.length, positions.length, phones.length, emails.length)

  return Array.from({ length: rowCount }, (_, index) => ({
    name: String(names[index] ?? '').trim(),
    position: String(positions[index] ?? '').trim() || null,
    phone: String(phones[index] ?? '').trim(),
    email: String(emails[index] ?? '').trim() || null,
  })).filter((contact) => contact.name || contact.position || contact.phone || contact.email)
}

function formatApiErrorMessage(response, fallbackMessage) {
  const issues = Array.isArray(response?.error?.issues) ? response.error.issues : []
  if (issues.length) {
    return issues
      .map((issue) => [issue.pathString, issue.message].filter(Boolean).join(': '))
      .filter(Boolean)
      .join('\n')
  }

  return response?.error?.message ?? response?.message ?? fallbackMessage
}

function getOptionalFormValue(formData, key) {
  const value = getFormValue(formData, key).trim()
  return value || null
}

function isBlankValue(value) {
  return value === null || value === undefined || value === '' || value === 'undefined'
}

function compactDefinedObject(object = {}) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => !isBlankValue(value)),
  )
}

function toPayloadNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const numericValue = Number(value)
  return Number.isNaN(numericValue) ? null : numericValue
}

function normalizeCriteriaPayload(criteria) {
  if (!criteria) {
    return { enabled: false }
  }

  return {
    enabled: Boolean(criteria.enabled),
    standardValue: criteria.standardValue ?? '',
    rows: (criteria.rows ?? []).map((row) => ({
      level: row.level,
      min: toPayloadNumberOrNull(row.min),
      max: toPayloadNumberOrNull(row.max),
    })),
  }
}

function buildMeasurementInstrumentParameters(instrumentRows = []) {
  return instrumentRows
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
      standardCriteria: normalizeCriteriaPayload(parameter.standardCriteria),
      eiaCriteria: normalizeCriteriaPayload(parameter.eiaCriteria),
    }))
}

function getDocumentImageFiles(formData, index) {
  if (!formData) {
    return []
  }

  return formData.getAll(`documentImageFile-${index}`).filter((file) => file instanceof File && file.name)
}

function buildDocumentsAndImages(formData, uploadedDocuments = [], { includePreviewUrls = false, existingDocuments = [] } = {}) {
  return documentImageItems.flatMap((item, index) => {
    const uploadedItems = uploadedDocuments.filter((document) => documentTitleMatchesItem(document, item))
    const existingItems = existingDocuments.filter((document) => documentTitleMatchesItem(document, item))
    const files = getDocumentImageFiles(formData, index)
    const documentPayload = {
      title: item.title,
      description: item.description ?? null,
      link: getOptionalFormValue(formData, `documentImageLink-${index}`),
      fileName: null,
      fileUrl: null,
      fileType: null,
      fileSize: null,
    }

    if (uploadedItems.length) {
      return uploadedItems.map((document) => ({
        ...documentPayload,
        ...document,
        title: item.title,
        description: document.description ?? item.description ?? null,
      }))
    }

    if (files.length) {
      return files.map((file) => ({
        ...documentPayload,
        fileName: file.name,
        fileType: file.type || null,
        fileSize: typeof file.size === 'number' && file.size > 0 ? file.size : null,
        ...(includePreviewUrls ? { filePreviewUrl: URL.createObjectURL(file) } : {}),
      }))
    }

    if (existingItems.length) {
      return existingItems.map((document) => ({
        ...documentPayload,
        ...document,
        title: item.title,
        description: document.description ?? item.description ?? null,
      }))
    }

    return [documentPayload]
  })
}

async function uploadDocumentImages(formData, accessToken) {
  const uploadedDocuments = []

  for (const [index, item] of documentImageItems.entries()) {
    const files = getDocumentImageFiles(formData, index)
    const link = getOptionalFormValue(formData, `documentImageLink-${index}`)

    if (!files.length && !link) {
      continue
    }

    const uploadFiles = files.length ? files : [null]

    for (const file of uploadFiles) {
      const uploadFormData = new FormData()
      uploadFormData.append('title', item.title)

      if (item.description) {
        uploadFormData.append('description', item.description)
      }

      if (link) {
        uploadFormData.append('link', link)
      }

      if (file) {
        uploadFormData.append('file', file)
      }

      const result = await fetch(getDocumentImagesApiUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: uploadFormData,
      })
      const rawText = await result.text()
      const response = (() => {
        try {
          return rawText ? JSON.parse(rawText) : null
        } catch {
          return rawText
        }
      })()

      if (!result.ok || response?.success === false) {
        const message =
          response?.error?.message ??
          response?.message ??
          `อัปโหลดเอกสารและรูปภาพไม่สำเร็จ (${result.status} ${result.statusText})`
        throw new Error(message)
      }

      uploadedDocuments.push(response?.data ?? null)
    }
  }

  return uploadedDocuments
}

function buildMeasurementPointRequestBody(
  factory = {},
  monitoringPointType = 'CEMS',
  formData = null,
  uploadedDocuments = [],
  instrumentRows = [],
  options = {},
) {
  const isWpms = monitoringPointType === 'WPMS'
  const systemType = isWpms ? 'WPMS' : 'CEMS'
  const contactPersons = buildContactPersons(formData)
  const notificationEmails = getFormValues(formData, 'notificationEmail')
  const officerNotificationEmails = getFormValues(formData, 'officerNotificationEmail')
  const pointCode = getFormValue(formData, 'pointCode')
  const pointName = getFormValue(formData, 'pointName')
  const converterBrand = getFormValue(formData, 'converterBrand')
  const converterModel = getFormValue(formData, 'converterModel')
  const instrumentParameters = buildMeasurementInstrumentParameters(instrumentRows)
  const documentsAndImages = buildDocumentsAndImages(formData, uploadedDocuments, options)
  const treatmentSystems = getFormValues(formData, 'treatmentSystem')

  return {
    factoryId: factory.factoryId ?? factory.newRegistrationNo ?? '',
    factoryName: factory.factoryName ?? '',
    factoryRegistrationNo: factory.factoryRegistrationNo ?? factory.oldRegistrationNo ?? '',
    industryMainOrder: factory.industryMainOrder ?? factory.industryMainOrderNo ?? null,
    industrySubOrder: factory.industrySubOrder ?? factory.industrySubOrderNo ?? null,
    businessActivity: factory.businessActivity ?? null,
    eia: getEiaFormValue(formData, factory),
    eiaOther: getOptionalFormValue(formData, 'eiaOther'),
    hasEia: getHasEiaFormValue(formData, factory),
    projectName: getOptionalFormValue(formData, 'projectName') ?? null,
    address: factory.address ?? null,
    latitude: toNumberOrNull(getFormValue(formData, 'latitude', factory.latitude ?? '')),
    longitude: toNumberOrNull(getFormValue(formData, 'longitude', factory.longitude ?? '')),
    systemType,
    contactPersons,
    notificationEmails,
    officerNotificationEmails,
    informationProviderName: getOptionalFormValue(formData, 'informationProviderName'),
    informationProviderPosition: getOptionalFormValue(formData, 'informationProviderPosition'),
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
              eligibleParameters: getFormValues(formData, 'eligibleParameters'),
              connectedParameters: getFormValues(formData, 'connectedParameters'),
              pendingParameters: getFormValues(formData, 'pendingParameters'),
              requestedParameters: getFormValues(formData, 'requestedParameters'),
              hasTreatmentSystem: getFormValue(formData, 'hasTreatmentSystem'),
              treatmentSystem: treatmentSystems,
              treatmentSystemOther: getOptionalFormValue(formData, 'treatmentSystemOther'),
              maxTreatmentCapacity: toNumberOrNull(getFormValue(formData, 'maxTreatmentCapacity')),
              instrumentLatitude: toNumberOrNull(getFormValue(formData, 'instrumentLatitude')),
              instrumentLongitude: toNumberOrNull(getFormValue(formData, 'instrumentLongitude')),
              dischargeLatitude: toNumberOrNull(getFormValue(formData, 'dischargeLatitude')),
              dischargeLongitude: toNumberOrNull(getFormValue(formData, 'dischargeLongitude')),
              wastewaterSource: getFormValue(formData, 'wastewaterSource'),
              dischargeReceivingSource: getFormValue(formData, 'dischargeReceivingSource'),
              connectionDevice: getFormValue(formData, 'connectionDevice'),
              connectionDeviceOther: getFormValue(formData, 'connectionDeviceOther'),
            },
            documentsAndImages,
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
              productionCapacity: formatProductionCapacity(
                getFormValue(formData, 'productionCapacityValue'),
                getFormValue(formData, 'productionCapacityUnit'),
              ) || null,
              productionCapacityValue: getOptionalFormValue(formData, 'productionCapacityValue'),
              productionCapacityUnit: getOptionalFormValue(formData, 'productionCapacityUnit'),
              cemsInstallationRequiredBy: getOptionalFormValue(formData, 'cemsInstallationRequiredBy'),
              cemsInstallationRequiredOther: getOptionalFormValue(formData, 'cemsInstallationRequiredOther'),
              legalAnnexNo: getFormValues(formData, 'legalAnnexNo'),
              eligibleParameters: getFormValues(formData, 'eligibleParameters'),
              exemptedParameters: getFormValues(formData, 'exemptedParameters'),
              connectedParameters: getFormValues(formData, 'connectedParameters'),
              pendingParameters: getFormValues(formData, 'pendingParameters'),
              requestedParameters: getFormValues(formData, 'requestedParameters'),
              exemptedParameterRegulationClauses: getFormValues(formData, 'exemptedParameterRegulationClauses'),
              timeSharingParameters: getFormValues(formData, 'timeSharingParameters'),
              sharedStackCode: getOptionalFormValue(formData, 'sharedStackCode'),
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
              treatmentSystem: treatmentSystems,
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

function OperatorFactoryActions({ row, onOpenRequestForm, onOpenMonitoringPoints, onOpenIntentDialog }) {
  if (!row.isEligible) {
    return (
      <Stack direction="row" spacing={1} sx={tableActionStackSx}>
        <Button size="small" variant="outlined" onClick={() => onOpenIntentDialog?.(row)}>
          แจ้งความประสงค์
        </Button>
      </Stack>
    )
  }

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
  const isProcessDisabled = [row?.status, row?.statusLabel, row?.statusCode].includes('รอโรงงานแก้ไข')
    || [row?.status, row?.statusLabel, row?.statusCode].includes('WAITING_FACTORY_REVISION')
    || [row?.status, row?.statusLabel, row?.statusCode].includes('รอเชื่อมต่อ')
    || [row?.status, row?.statusLabel, row?.statusCode].includes('WAITING_CONNECTION')
    || [row?.status, row?.statusLabel, row?.statusCode].includes('เชื่อมต่อแล้ว')
    || [row?.status, row?.statusLabel, row?.statusCode].includes('CONNECTED')

  return (
    <Stack direction="row" spacing={1} sx={tableActionStackSx}>
      <Button size="small" variant="outlined" onClick={() => onOpenRequestDocument?.(row)}>
        เปิดดู
      </Button>
      <Button
        size="small"
        variant="contained"
        disabled={isProcessDisabled}
        onClick={() => onOpenRequestProcess?.(row)}
      >
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

function OperatorRequestActions({ row, onOpenConnectionSettings, onOpenRequestDocument, onOpenRequestEdit }) {
  const { status, statusCode } = row
  const canModifyRequest = [status, statusCode].includes('รอโรงงานแก้ไข')
    || [status, statusCode].includes('WAITING_FACTORY_REVISION')
  const canConfigureConnection = status === 'รอเชื่อมต่อ'

  return (
    <Stack direction="row" spacing={1} sx={tableActionStackSx}>
      <Button size="small" variant="outlined" onClick={() => onOpenRequestDocument?.(row)}>
        เปิดดู
      </Button>
      <Button
        size="small"
        variant="outlined"
        disabled={!canModifyRequest}
        onClick={() => onOpenRequestEdit?.(row)}
      >
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

function MonitoringPointActions({ point, useOperatorActions, onOpenPointDetails, onOpenAddParameter, onOpenConnectionSettings }) {
  const { status, statusCode } = point
  const canConsider = ['รอพิจารณาแบบ', 'ยืนยันการเชื่อมต่อ', 'แก้ไขแล้ว/รอพิจารณาแบบ'].includes(status)
  const isConnected = [status, statusCode].includes('เชื่อมต่อแล้ว')
    || [status, statusCode].includes('CONNECTED')
  const canConfigureConnection = isConnected
  const canAddParameter = isConnected

  if (!useOperatorActions) {
    return (
      <Stack direction="row" spacing={1} sx={tableActionStackSx}>
        <Button size="small" variant="outlined" onClick={() => onOpenPointDetails?.(point)}>
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
      <Button size="small" variant="outlined" onClick={() => onOpenPointDetails?.(point)}>
        เปิดดู
      </Button>
      <Button size="small" variant="outlined" disabled={!canAddParameter} onClick={() => onOpenAddParameter?.(point)}>
        เพิ่มพารามิเตอร์
      </Button>
      <ConnectionSettingsButton
        disabled={!canConfigureConnection}
        onClick={() => onOpenConnectionSettings?.({
          ...point,
          deviceConfigSource: 'connected-measurement-point',
        })}
      />
    </Stack>
  )
}

function MonitoringPointListDialog({ open, factory, useOperatorActions, accessToken, onOpenAddParameter, onOpenConnectionSettings, onClose }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pointDetailRows, setPointDetailRows] = useState([])
  const [pointDetailOpen, setPointDetailOpen] = useState(false)
  const [pointDetailLoading, setPointDetailLoading] = useState(false)
  const [pointDetailError, setPointDetailError] = useState('')
  const [selectedPointDetailTab, setSelectedPointDetailTab] = useState(0)

  useEffect(() => {
    if (!open) {
      return
    }

    let isActive = true
    const factoryId = factory?.factoryId ?? factory?.id ?? ''

    queueMicrotask(() => {
      if (!isActive) {
        return
      }

      setRows([])
      setError('')
      setLoading(false)
    })

    if (!factoryId) {
      queueMicrotask(() => {
        if (isActive) {
          setError('ไม่พบรหัสโรงงานสำหรับโหลดจุดตรวจวัด')
        }
      })
      return
    }

    if (!accessToken) {
      queueMicrotask(() => {
        if (isActive) {
          setError('กรุณาเข้าสู่ระบบเพื่อดูข้อมูลจุดตรวจวัด')
        }
      })
      return
    }

    queueMicrotask(() => {
      if (isActive) {
        setLoading(true)
      }
    })

    fetch(getConnectedMeasurementPointsApiUrl(factoryId), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(async (result) => {
        const payload = await result.json().catch(() => null)

        if (!result.ok) {
          throw new Error(payload?.error?.message || payload?.message || `โหลดข้อมูลจุดตรวจวัดไม่สำเร็จ (${result.status} ${result.statusText})`)
        }

        if (isActive) {
          const nextRows = Array.isArray(payload?.data) ? payload.data.map(mapConnectedMeasurementPointRow) : []
          setRows(nextRows)
        }
      })
      .catch((fetchError) => {
        if (isActive) {
          setError(fetchError instanceof Error ? fetchError.message : 'โหลดข้อมูลจุดตรวจวัดไม่สำเร็จ')
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [accessToken, factory, open])

  const handleOpenPointDetails = (point) => {
    const stationId = point?.pointCode ?? point?.code ?? ''

    setPointDetailOpen(true)
    setPointDetailRows([])
    setSelectedPointDetailTab(0)
    setPointDetailError('')

    if (!stationId) {
      setPointDetailError('ไม่พบรหัสจุดตรวจวัดสำหรับโหลดรายละเอียด')
      return
    }

    if (!accessToken) {
      setPointDetailError('กรุณาเข้าสู่ระบบเพื่อดูรายละเอียดจุดตรวจวัด')
      return
    }

    setPointDetailLoading(true)

    fetch(getConnectedMeasurementPointRequestsApiUrl(stationId), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(async (result) => {
        const payload = await result.json().catch(() => null)

        if (!result.ok) {
          throw new Error(payload?.error?.message || payload?.message || `โหลดรายละเอียดจุดตรวจวัดไม่สำเร็จ (${result.status} ${result.statusText})`)
        }

        const nextRows = getConnectedPointRequestRowsFromPayload(payload)
        setPointDetailRows(nextRows)
        setSelectedPointDetailTab(0)
      })
      .catch((fetchError) => {
        setPointDetailError(fetchError instanceof Error ? fetchError.message : 'โหลดรายละเอียดจุดตรวจวัดไม่สำเร็จ')
      })
      .finally(() => {
        setPointDetailLoading(false)
      })
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            pr: 2,
          }}
        >
          <Typography component="span" variant="h6" sx={{ minWidth: 0 }}>
            รายการจุดตรวจวัด{factory?.factoryName ? ` - ${factory.factoryName}` : ''}
          </Typography>
          <IconButton aria-label="ปิด" size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {loading ? (
            <Typography variant="body2" sx={{ mb: 2 }}>
              กำลังโหลดข้อมูลจุดตรวจวัด...
            </Typography>
          ) : null}
          {error ? (
            <Typography color="error" variant="body2" sx={{ mb: 2 }}>
              {error}
            </Typography>
          ) : null}
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
                    <TableCell>{row.typeLabel}</TableCell>
                    <TableCell>{row.parameters.join(', ')}</TableCell>
                    <TableCell>
                      <StatusChip value={row.status} />
                    </TableCell>
                    <TableCell>
                      <MonitoringPointActions
                        point={row}
                        useOperatorActions={useOperatorActions}
                        onOpenPointDetails={handleOpenPointDetails}
                        onOpenAddParameter={(point) => {
                          onOpenAddParameter?.(point)
                          onClose?.()
                        }}
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
      </Dialog>
      <ConnectedPointRequestsDialog
        open={pointDetailOpen}
        rows={pointDetailRows}
        loading={pointDetailLoading}
        error={pointDetailError}
        selectedIndex={selectedPointDetailTab}
        onSelectedIndexChange={setSelectedPointDetailTab}
        onClose={() => {
          setPointDetailOpen(false)
          setPointDetailRows([])
          setPointDetailError('')
          setPointDetailLoading(false)
          setSelectedPointDetailTab(0)
        }}
      />
    </>
  )
}

function displayValue(value, fallback = '') {
  if (isBlankValue(value)) {
    return fallback
  }

  return String(value)
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

function getEiaStandardDisplay(parameter = {}) {
  return parameter.eiaCriteria?.standardValue || parameter.eiaStandard || '-'
}

function getConnectedPointTabLabel(row, index) {
  return row?.requestNo
    || row?.request?.requestNo
    || row?.point?.pointName
    || row?.measurementPoints?.[0]?.pointName
    || row?.pointName
    || `คำขอที่ ${index + 1}`
}

function mapConnectedPointRequestToDocumentRequest(row = {}) {
  if (Array.isArray(row.measurementPoints)) {
    const factory = row.factory ?? {}
    const requestDocuments = mergeDocumentItems(
      getDocumentItemsFromSource(row),
      getDocumentItemsFromSource(row.request),
    )
    const measurementPoints = row.measurementPoints.map((point, index) => ({
      ...point,
      documentsAndImages: index === 0
        ? mergeDocumentItems(getDocumentItemsFromSource(point), requestDocuments)
        : getDocumentItemsFromSource(point),
    }))

    return {
      ...row,
      id: row.id ?? row.requestId,
      requestNo: row.requestNo ?? row.request?.requestNo ?? '',
      type: row.type ?? row.systemType ?? measurementPoints?.[0]?.details?.monitoringPointKind ?? '',
      systemType: row.systemType ?? row.type ?? measurementPoints?.[0]?.details?.monitoringPointKind ?? '',
      status: row.status ?? row.statusLabel ?? '',
      statusCode: row.statusCode ?? '',
      factoryId: row.factoryId ?? factory.factoryId ?? '',
      factoryName: row.factoryName ?? factory.factoryName ?? '',
      newRegistrationNo: row.newRegistrationNo ?? factory.newRegistrationNo ?? row.factoryId ?? factory.factoryId ?? '',
      oldRegistrationNo: row.oldRegistrationNo ?? factory.oldRegistrationNo ?? row.factoryRegistrationNo ?? '',
      industryType: row.industryType ?? factory.industryType ?? '',
      province: row.province ?? factory.province ?? '',
      factory,
      measurementPoints,
      deviceConfigs: Array.isArray(row.deviceConfigs) ? row.deviceConfigs : [],
    }
  }

  const point = row?.point ?? {}
  const factory = row?.factory ?? {}
  const documentsAndImages = mergeDocumentItems(
    getDocumentItemsFromSource(point),
    getDocumentItemsFromSource(row),
    getDocumentItemsFromSource(row.request),
  )

  return {
    ...row,
    id: row.requestId ?? row.id,
    requestNo: row.requestNo ?? '',
    type: row.type ?? '',
    systemType: row.type ?? row.systemType ?? '',
    status: row.status ?? '',
    statusCode: row.statusCode ?? '',
    connectedAt: row.connectedAt ?? null,
    factoryId: factory.factoryId ?? row.factoryId ?? '',
    factoryName: factory.factoryName ?? row.factoryName ?? '',
    newRegistrationNo: factory.newRegistrationNo ?? row.newRegistrationNo ?? '',
    oldRegistrationNo: factory.oldRegistrationNo ?? row.oldRegistrationNo ?? '',
    industryType: factory.industryType ?? row.industryType ?? '',
    province: factory.province ?? row.province ?? '',
    factory,
    measurementPoints: [
      {
        ...point,
        id: point.id ?? row.id,
        pointCode: point.pointCode ?? row.pointCode ?? '',
        pointName: point.pointName ?? row.pointName ?? '',
        pointType: point.pointType ?? row.pointType ?? '',
        parameters: Array.isArray(point.parameters) ? point.parameters : [],
        details: point.details ?? {},
        measurementInstruments: point.measurementInstruments ?? { parameters: [] },
        documentsAndImages,
      },
    ],
    deviceConfigs: Array.isArray(row.deviceConfigs) ? row.deviceConfigs : [],
  }
}

function getConnectedPointRequestRowsFromPayload(payload) {
  const data = payload?.data

  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.rows)) {
    return data.rows
  }

  if (Array.isArray(data?.requests)) {
    return data.requests
  }

  if (data && typeof data === 'object') {
    return [data]
  }

  return []
}

function getParameterFormDefaultsFromPayload(payload, point = {}) {
  const data = payload?.data ?? {}
  const formDefaults = data?.formDefaults ?? data?.defaults ?? {}
  const mergedDefaults = {
    ...compactDefinedObject(data),
    ...compactDefinedObject(formDefaults),
  }
  const stationId = point?.pointCode ?? point?.code ?? point?.stationId ?? ''
  const pointName = point?.pointName ?? point?.name ?? ''
  const systemType = point?.type ?? mergedDefaults?.systemType ?? mergedDefaults?.type ?? ''
  const measurementPoints = Array.isArray(mergedDefaults?.measurementPoints)
    ? mergedDefaults.measurementPoints
    : []
  const firstPoint = measurementPoints[0] ?? {}
  const nextPoint = {
    ...firstPoint,
    pointCode: firstPoint.pointCode ?? stationId,
    pointName: firstPoint.pointName ?? pointName,
    pointType: firstPoint.pointType ?? point?.pointType ?? (systemType === 'WPMS' ? 'WASTEWATER' : 'STACK'),
    details: firstPoint.details ?? {},
    documentsAndImages: Array.isArray(firstPoint.documentsAndImages) ? firstPoint.documentsAndImages : [],
    measurementInstruments: firstPoint.measurementInstruments ?? { parameters: [] },
  }

  return {
    ...mergedDefaults,
    id: mergedDefaults.id ?? `add-parameter-${stationId || Date.now()}`,
    systemType,
    type: systemType,
    measurementPoints: [nextPoint],
  }
}

function ConnectedPointRequestsDialog({ open, rows, loading, error, selectedIndex, onSelectedIndexChange, onClose }) {
  const selectedRow = rows[selectedIndex] ?? rows[0] ?? null
  const selectedRequest = useMemo(
    () => (selectedRow ? mapConnectedPointRequestToDocumentRequest(selectedRow) : null),
    [selectedRow],
  )
  const selectedRequestKey = selectedRequest
    ? `${selectedRequest.id || selectedRequest.requestId || selectedRequest.requestNo || selectedIndex}`
    : ''
  const [pdfPreviewState, setPdfPreviewState] = useState({ key: '', url: '', error: '' })
  const pdfPreviewUrl = pdfPreviewState.key === selectedRequestKey ? pdfPreviewState.url : ''
  const pdfPreviewError = pdfPreviewState.key === selectedRequestKey ? pdfPreviewState.error : ''
  const shouldGeneratePdfPreview = Boolean(open && !loading && !error && selectedRequest && selectedRequestKey)
  const pdfPreviewLoading = shouldGeneratePdfPreview && pdfPreviewState.key !== selectedRequestKey

  useEffect(() => {
    if (!shouldGeneratePdfPreview) {
      return undefined
    }

    let isActive = true
    let nextPdfUrl = ''

    createConnectionRequestPdf(selectedRequest)
      .then((pdfBytes) => {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' })
        nextPdfUrl = URL.createObjectURL(blob)

        if (isActive) {
          setPdfPreviewState({ key: selectedRequestKey, url: nextPdfUrl, error: '' })
        }
      })
      .catch((pdfError) => {
        if (isActive) {
          setPdfPreviewState({
            key: selectedRequestKey,
            url: '',
            error: pdfError instanceof Error ? pdfError.message : 'สร้าง PDF preview ไม่สำเร็จ',
          })
        }
      })

    return () => {
      isActive = false

      if (nextPdfUrl) {
        URL.revokeObjectURL(nextPdfUrl)
      }
    }
  }, [selectedRequest, selectedRequestKey, shouldGeneratePdfPreview])
  useEffect(() => () => {
    if (pdfPreviewState.url) {
      URL.revokeObjectURL(pdfPreviewState.url)
    }
  }, [pdfPreviewState.url])
  const tabsContent = rows.length > 1 ? (
    <Paper elevation={0} sx={{ mb: 2, mx: 'auto', maxWidth: 794, border: 1, borderColor: 'divider' }}>
      <Tabs
        value={Math.min(selectedIndex, rows.length - 1)}
        onChange={(_, value) => onSelectedIndexChange(value)}
        variant="scrollable"
        scrollButtons="auto"
      >
        {rows.map((row, index) => (
          <Tab key={`${row.requestId}-${row.id}-${index}`} value={index} label={getConnectedPointTabLabel(row, index)} />
        ))}
      </Tabs>
    </Paper>
  ) : null

  return (
    <RequestDocumentDialog
      open={open}
      request={selectedRequest}
      title="รายละเอียดจุดตรวจวัด"
      loading={loading}
      error={error}
      onClose={onClose}
      pdfPreviewUrl={pdfPreviewUrl}
      pdfPreviewLoading={pdfPreviewLoading}
      pdfPreviewError={pdfPreviewError}
      contentHeader={tabsContent}
    />
  )
}

function isPendingDesignReview(request) {
  return [request?.status, request?.statusLabel, request?.statusCode].includes('รอพิจารณาแบบ')
    || [request?.status, request?.statusLabel, request?.statusCode].includes('PENDING_DESIGN_REVIEW')
    || [request?.status, request?.statusLabel, request?.statusCode].includes('แก้ไขแล้ว/รอพิจารณาแบบ')
    || [request?.status, request?.statusLabel, request?.statusCode].includes('REVISED_PENDING_DESIGN_REVIEW')
}

function isConnectionConfirmed(request) {
  return [request?.status, request?.statusLabel, request?.statusCode].includes('ยืนยันการเชื่อมต่อ')
    || [request?.status, request?.statusLabel, request?.statusCode].includes('CONNECTION_CONFIRMED')
}

function StatusHistoryContent({ history = [] }) {
  const items = useMemo(() => getStatusHistoryItems(history), [history])

  return (
    items.length ? (
      <Stack spacing={0}>
        {items.map((item, index) => {
          const nextItem = items[index + 1]
          const duration = formatStatusHistoryDuration(
            item.__date,
            nextItem?.__date,
            item.durationLabel ?? item.durationText ?? item.duration,
          )
          const note = getStatusHistoryNote(item)
          const title = `${getStatusHistoryLabel(item)}${duration ? ` (${duration})` : ''}`

          return (
            <Box
              key={item.id ?? `${item.status ?? 'status'}-${index}`}
              sx={{
                display: 'grid',
                gridTemplateColumns: '24px minmax(0, 1fr)',
                columnGap: 1.5,
              }}
            >
              <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    mt: 0.75,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    border: 2,
                    borderColor: 'background.paper',
                    boxShadow: '0 0 0 1px',
                    color: 'primary.main',
                    zIndex: 1,
                  }}
                />
                {index < items.length - 1 ? (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 22,
                      bottom: 0,
                      width: 2,
                      bgcolor: 'divider',
                    }}
                  />
                ) : null}
              </Box>
              <Box sx={{ pb: index < items.length - 1 ? 2.5 : 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
                {note ? (
                  <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: 'pre-line' }}>
                    หมายเหตุ: {note}
                  </Typography>
                ) : null}
                <Stack spacing={0.25} sx={{ mt: note ? 1.5 : 0.75 }}>
                  <Typography variant="body2" color="text.secondary">
                    วันที่: {formatStatusHistoryDate(item.__date)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ผู้บันทึก: {displayValue(getStatusHistoryRecorder(item), '-')}
                  </Typography>
                </Stack>
              </Box>
            </Box>
          )
        })}
      </Stack>
    ) : (
      <Typography variant="body2" color="text.secondary">
        ไม่มีประวัติสถานะ
      </Typography>
    )
  )
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
  onVerifyConnection,
  onRequestRevision,
  onClose,
  contentHeader,
  footerContent,
  footerActions,
  pdfPreviewUrl,
  pdfPreviewLoading,
  pdfPreviewError,
  onExited,
}) {
  const canReview = mode === 'process' && isPendingDesignReview(request)
  const canVerifyConnection = mode === 'process' && isConnectionConfirmed(request)
  const [statusHistoryAnchorEl, setStatusHistoryAnchorEl] = useState(null)
  const [attachmentAnchorEl, setAttachmentAnchorEl] = useState(null)
  const statusHistory = Array.isArray(request?.statusHistory) ? request.statusHistory : []
  const attachmentGroups = useMemo(() => getRequestAttachmentGroups(request), [request])
  const attachmentCount = attachmentGroups.reduce((sum, group) => sum + group.items.length, 0)
  const isAttachmentPopoverOpen = Boolean(attachmentAnchorEl)
  const isStatusHistoryPopoverOpen = Boolean(statusHistoryAnchorEl)
  const isReadonlyViewDialog = mode === 'view' && !footerContent && !footerActions
  const hasPdfPreviewContent = Boolean(pdfPreviewUrl || pdfPreviewLoading || pdfPreviewError)
  const isRevisedPendingReview = mode === 'process'
    && (
      [request?.status, request?.statusLabel, request?.statusCode].includes('แก้ไขแล้ว/รอพิจารณาแบบ')
      || [request?.status, request?.statusLabel, request?.statusCode].includes('REVISED_PENDING_DESIGN_REVIEW')
    )
  const latestRevisionMessage = isRevisedPendingReview ? getLatestRevisionMessage(request) : ''

  return (
    <Fragment>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="lg"
        slotProps={{ transition: { onExited } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            pr: 3,
          }}
        >
          <Typography component="span" variant="h6" sx={{ minWidth: 0 }}>
            {title ?? `แบบฟอร์มคำขอ${request?.requestNo ? ` - ${request.requestNo}` : ''}`}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DescriptionIcon />}
              disabled={loading || !request || attachmentCount === 0}
              onClick={(event) => setAttachmentAnchorEl(event.currentTarget)}
            >
              เอกสารแนบ{attachmentCount ? ` (${attachmentCount})` : ''}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<HistoryIcon />}
              disabled={loading || !request}
              onClick={(event) => setStatusHistoryAnchorEl(event.currentTarget)}
            >
              ประวัติสถานะ
            </Button>
            {isReadonlyViewDialog ? (
              <IconButton aria-label="ปิด" size="small" onClick={onClose}>
                <CloseIcon />
              </IconButton>
            ) : null}
          </Stack>
        </DialogTitle>
      <Popover
        open={isAttachmentPopoverOpen}
        anchorEl={attachmentAnchorEl}
        onClose={() => setAttachmentAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 380,
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 520,
              overflowY: 'auto',
              p: 2,
              borderRadius: 2,
              boxShadow: '0 18px 48px rgba(15, 23, 42, 0.18)',
            },
          },
        }}
      >
        <Stack spacing={1.5}>
          {attachmentGroups.length ? (
            attachmentGroups.map((group) => (
              <Box key={group.title}>
                <Typography variant="subtitle2" sx={{ mb: 0.75, fontWeight: 700 }}>
                  {group.title}
                </Typography>
                <Stack spacing={0.5}>
                  {group.items.map((item, index) => (
                    <Button
                      key={`${group.title}-${item.type}-${item.label}-${index}`}
                      variant="text"
                      disabled={!item.url}
                      onClick={() => {
                        if (item.url) {
                          window.open(item.url, '_blank', 'noopener,noreferrer')
                          setAttachmentAnchorEl(null)
                        }
                      }}
                      sx={{
                        justifyContent: 'flex-start',
                        minHeight: 44,
                        px: 1,
                        py: 0.75,
                        color: 'text.primary',
                        textAlign: 'left',
                        textTransform: 'none',
                        borderRadius: 1.5,
                      }}
                    >
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                        {item.type === 'link' ? (
                          <LinkIcon fontSize="small" color="primary" />
                        ) : (
                          <DescriptionIcon fontSize="small" color="action" />
                        )}
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                            {item.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.type === 'link' ? 'Link' : 'File'}
                          </Typography>
                        </Box>
                      </Stack>
                    </Button>
                  ))}
                </Stack>
              </Box>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              ไม่มีเอกสารแนบ
            </Typography>
          )}
        </Stack>
      </Popover>
      <Popover
        open={isStatusHistoryPopoverOpen}
        anchorEl={statusHistoryAnchorEl}
        onClose={() => setStatusHistoryAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 420,
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 520,
              overflowY: 'auto',
              p: 2,
              borderRadius: 2,
              boxShadow: '0 18px 48px rgba(15, 23, 42, 0.18)',
            },
          },
        }}
      >
        <StatusHistoryContent history={statusHistory} />
      </Popover>
      <DialogContent
        dividers
        sx={{
          bgcolor: 'neutral.100',
          ...(hasPdfPreviewContent
            ? {
                minHeight: { xs: '70vh', md: '78vh' },
                overflow: 'hidden',
              }
            : {}),
        }}
      >
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
        {latestRevisionMessage ? (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 2,
              border: 1,
              borderColor: 'warning.main',
              bgcolor: 'warning.50',
              color: 'text.primary',
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
              <WarningAmberIcon color="warning" fontSize="small" sx={{ mt: 0.25 }} />
              <Stack spacing={0.75}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  รายละเอียดการแก้ไข
                </Typography>
                <Typography variant="body2">{latestRevisionMessage}</Typography>
              </Stack>
            </Stack>
          </Paper>
        ) : null}
        {contentHeader}
        {pdfPreviewLoading ? (
          <Typography variant="body2" sx={{ mb: 2 }}>
            กำลังสร้าง PDF preview...
          </Typography>
        ) : null}
        {pdfPreviewError ? (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {pdfPreviewError}
          </Typography>
        ) : null}
        {pdfPreviewUrl ? (
          <Box
            component="iframe"
            title="PDF preview"
            src={pdfPreviewUrl}
            sx={{
              display: 'block',
              width: '100%',
              height: { xs: '70vh', md: '78vh' },
              border: 0,
              bgcolor: '#fff',
            }}
          />
        ) : null}
      </DialogContent>
      {footerContent || footerActions ? (
        <DialogActions sx={{ display: 'block', px: 3, py: 2 }}>
          {footerContent}
          {footerActions}
        </DialogActions>
      ) : isReadonlyViewDialog ? null : (
        <DialogActions sx={{ justifyContent: 'center', gap: 1 }}>
          <Button variant="outlined" color="inherit" disabled={approving} onClick={onClose}>
            ปิด
          </Button>
          {canReview ? (
            <>
              <Button variant="outlined" disabled={approving || loading} onClick={onRequestRevision}>
                แจ้งแก้ไข
              </Button>
              <Button variant="contained" disabled={approving || loading} onClick={onApprove}>
                {approving ? 'กำลังอนุมัติ' : 'อนุมัติ'}
              </Button>
            </>
          ) : null}
          {canVerifyConnection ? (
            <>
              <Button variant="outlined" disabled={approving || loading} onClick={onRequestRevision}>
                แจ้งแก้ไข
              </Button>
              <Button variant="contained" disabled={approving || loading} onClick={onVerifyConnection}>
                {approving ? 'กำลังยืนยัน' : 'ยืนยันการเชื่อมต่อ'}
              </Button>
            </>
          ) : null}
        </DialogActions>
      )}
      </Dialog>
    </Fragment>
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

function TextInputField({ label, value, onChange, placeholder }) {
  return (
    <TextField
      label={label}
      size="small"
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      fullWidth
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
          <TextInputField label="COMPORT" value={value.comPort ?? value.comport ?? ''} onChange={(nextValue) => updateField('comPort', nextValue)} />
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
    alertLow: '',
    alertHigh: '',
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
    const parameter = mapping.parameter ?? mapping.parameterName ?? mapping.dataType ?? ''
    const valueRange = mapping.valueRange ?? {}
    const alertRange = mapping.alertRange ?? mapping.alert ?? {}
    const valueFormat = mapping.valueFormat ?? mapping.dataValueFormat ?? ''
    const encodingData = mapping.encodingData ?? mapping.encoding ?? ''

    return {
      id: mapping.id ?? `${parameter}-${index}`,
      configId: mapping.configId ?? mapping.config_id ?? '',
      deviceCode: mapping.deviceCode ?? mapping.device_code ?? '',
      addressId: mapping.addressId ?? mapping.address_id ?? mapping.address ?? '',
      parameter,
      unit: mapping.unit ?? parameterUnitMap[parameter] ?? '',
      min: mapping.min ?? mapping.measureMin ?? valueRange.min ?? '',
      max: mapping.max ?? mapping.measureMax ?? valueRange.max ?? '',
      alertLow: mapping.alertLow ?? mapping.alert_low ?? alertRange.low ?? alertRange.min ?? '',
      alertHigh: mapping.alertHigh ?? mapping.alert_high ?? alertRange.high ?? alertRange.max ?? '',
      valueFormat: valueFormatLabelMap[valueFormat] ?? valueFormat,
      offset: mapping.offset ?? '',
      encodingData: encodingLabelMap[encodingData] ?? encodingData,
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
    { label: 'สถานะ', width: 170 },
    { label: 'Min', width: 108 },
    { label: 'Max', width: 108 },
    { label: 'Alert(Low)', width: 118 },
    { label: 'Alert(High)', width: 118 },
    { label: 'รูปแบบค่าข้อมูลตรวจวัด', width: 220 },
    { label: 'ค่า Offset', width: 108 },
    { label: 'Encoding data', width: 230 },
  ]

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        การเชื่อมต่อพารามิเตอร์
      </Typography>
      <TableContainer sx={{ border: 1, borderColor: 'divider', overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 1538, ...borderedTableSx }}>
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
                  <TableCell sx={{ minWidth: 118 }}>
                    <TextField
                      size="small"
                      value={row.alertLow}
                      onChange={(event) => updateRow(index, 'alertLow', event.target.value)}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 118 }}>
                    <TextField
                      size="small"
                      value={row.alertHigh}
                      onChange={(event) => updateRow(index, 'alertHigh', event.target.value)}
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
  'Microsoft SQL': 'MSSQL',
  MySQL: 'MYSQL',
}

const protocolLabelMap = {
  MODBUS_RTU: 'Modbus RTU',
  MODBUS_TCP: 'Modbus TCP',
  MSSQL: 'Microsoft SQL',
  MICROSOFT_SQL: 'Microsoft SQL',
  MYSQL: 'MySQL',
}

const allowedProtocolCodes = new Set(['MODBUS_RTU', 'MODBUS_TCP', 'MSSQL', 'MYSQL'])

function normalizeConnectionType(type) {
  return protocolLabelMap[type] ?? type ?? ''
}

function getConnectionProtocolCode(type) {
  const normalizedType = normalizeConnectionType(type)

  if (allowedProtocolCodes.has(normalizedType)) {
    return normalizedType
  }

  return protocolCodeMap[normalizedType] ?? ''
}

function mapConnectionForms(forms = []) {
  return forms.map((form, index) => {
    const type = normalizeConnectionType(form.type ?? form.connectionType ?? form.protocol)
    const values = form.values ?? form.settings ?? form.config ?? form.connectionConfig ?? form
    const valueRange = values.valueRange ?? {}

    return {
      id: form.id ?? Date.now() + index,
      configId: form.configId ?? form.config_id ?? form.id ?? '',
      deviceCode: form.deviceCode ?? form.device_code ?? '',
      type,
      values: {
        ...getDefaultConnectionForm(type),
        ...values,
        comPort: getComPortValue(values),
        measureMin: values.measureMin ?? valueRange.min ?? '',
        measureMax: values.measureMax ?? valueRange.max ?? '',
      },
    }
  })
}

function mapTestResultRows(testResults = []) {
  return testResults.map((result, index) => ({
    id: result.id ?? index,
    values: result.values ?? result.data ?? result.parameters ?? {},
    status: result.status ?? result.statusLabel ?? result.connectionStatus ?? '',
    statuses: result.statuses ?? result.parameterStatuses ?? result.statusByParameter ?? {},
    timestamp: result.timestamp ?? result.createdAt ?? result.testedAt ?? '',
  }))
}

function getRawDeviceConfig(data) {
  if (Array.isArray(data)) {
    return data.reduce((result, config) => ({
      ...result,
      stationId: result.stationId ?? config?.stationId,
      device: [
        ...(Array.isArray(result.device) ? result.device : []),
        ...(Array.isArray(config?.device) ? config.device : []),
      ],
      channels: [
        ...(Array.isArray(result.channels) ? result.channels : []),
        ...(Array.isArray(config?.channels) ? config.channels : []),
      ],
      statusManagement: result.statusManagement ?? config?.statusManagement ?? null,
    }), {})
  }

  if (Array.isArray(data?.device) || Array.isArray(data?.channels)) {
    return data
  }

  const rawConfigs = data?.rawConfigs?.config ?? data?.rawConfigs ?? data?.config

  if (!rawConfigs || Array.isArray(rawConfigs) || typeof rawConfigs !== 'object') {
    return {}
  }

  return rawConfigs
}

function getDeviceConfigConnectionForms(data) {
  if (data?.connectionForms?.length) {
    return data.connectionForms
  }

  const rawConfig = getRawDeviceConfig(data)
  return Array.isArray(rawConfig.device) ? rawConfig.device : []
}

function getDeviceConfigParameterMappings(data) {
  if (data?.parameterMappings?.length) {
    return data.parameterMappings
  }

  const rawConfig = getRawDeviceConfig(data)
  return Array.isArray(rawConfig.channels) ? rawConfig.channels : []
}

function getDeviceConfigParameterOptions(data, fallback = []) {
  if (Array.isArray(data?.parameterOptions) && data.parameterOptions.length) {
    return data.parameterOptions
  }

  const rawConfig = getRawDeviceConfig(data)
  const channelParameters = Array.isArray(rawConfig.channels)
    ? rawConfig.channels.map((channel) => channel.dataType ?? channel.parameter ?? channel.name).filter(Boolean)
    : []

  return channelParameters.length ? [...new Set(channelParameters)] : fallback
}

function getDeviceConfigStatusManagement(data) {
  return data?.statusManagement ?? getRawDeviceConfig(data).statusManagement ?? null
}

function getTestResultParameterStatus(row, parameter) {
  if (row.statuses && typeof row.statuses === 'object') {
    return row.statuses[parameter] ?? ''
  }

  return row.status ?? ''
}

function getTestResultColumnCount(parameterOptions) {
  return (parameterOptions.length * 2) + 1
}

const parityCodeMap = {
  Even: 'EVEN',
  Odd: 'ODD',
  None: 'NONE',
}

const valueFormatCodeMap = {
  ค่าข้อมูลตรวจวัด: 'MEASUREMENT_VALUE',
  ค่ากระแสไฟฟ้า: 'CURRENT',
  ค่าแรงดันไฟฟ้า: 'VOLTAGE',
}

const valueFormatLabelMap = {
  MEASUREMENT_VALUE: 'ค่าข้อมูลตรวจวัด',
  CURRENT: 'ค่ากระแสไฟฟ้า',
  CURRENT_VALUE: 'ค่ากระแสไฟฟ้า',
  VOLTAGE: 'ค่าแรงดันไฟฟ้า',
  VOLTAGE_VALUE: 'ค่าแรงดันไฟฟ้า',
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

const encodingLabelMap = Object.fromEntries(Object.entries(encodingCodeMap).map(([label, code]) => [code, label]))

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const numericValue = Number(value)
  return Number.isNaN(numericValue) ? null : numericValue
}

function toNumberOrStringOrNull(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const numericValue = Number(value)
  return Number.isNaN(numericValue) ? value : numericValue
}

function getComPortValue(values) {
  return values.comPort
    ?? values.comport
    ?? values.COMPORT
    ?? values.com_port
    ?? values.com
    ?? values.serialPort
    ?? values.serial_port
    ?? ''
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== '' && item !== null && item !== undefined),
  )
}

function buildValueRange(min, max) {
  const valueRange = {
    min: toNumberOrNull(min),
    max: toNumberOrNull(max),
  }

  if (valueRange.min === null && valueRange.max === null) {
    return undefined
  }

  return valueRange
}

function buildConnectionSettings(form) {
  const values = form?.values ?? {}
  const type = normalizeConnectionType(form?.type)

  if (type === 'Modbus RTU') {
    return compactObject({
      comPort: toNumberOrStringOrNull(getComPortValue(values)),
      slaveId: toNumberOrNull(values.slaveId),
      baudRate: toNumberOrNull(values.baudRate),
      parity: parityCodeMap[values.parity] ?? values.parity,
      stopBits: toNumberOrNull(values.stopBits),
      dataBits: toNumberOrNull(values.dataBits),
      quantity: toNumberOrNull(values.quantity),
      valueRange: buildValueRange(values.measureMin, values.measureMax),
    })
  }

  if (type === 'Modbus TCP') {
    return compactObject({
      hostIp: values.hostIp,
      slaveId: toNumberOrNull(values.slaveId),
      port: toNumberOrNull(values.port),
      valueRange: buildValueRange(values.measureMin, values.measureMax),
    })
  }

  return compactObject({
    hostIp: values.hostIp,
    port: toNumberOrNull(values.port),
    dbUser: values.dbUser,
    dbPass: values.dbPass,
    dbName: values.dbName,
    valueRange: buildValueRange(values.measureMin, values.measureMax),
  })
}

function validateDeviceConfigForm(form) {
  const values = form?.values ?? {}
  const type = normalizeConnectionType(form?.type)
  const protocol = getConnectionProtocolCode(form?.type)

  if (!type) {
    return 'กรุณาเลือกอุปกรณ์ (Connection)'
  }

  if (!protocol) {
    return 'กรุณาเลือกอุปกรณ์ (Connection) ให้ถูกต้อง'
  }

  if (type === 'Modbus RTU' && !getComPortValue(values)) {
    return 'กรุณากรอก COMPORT'
  }

  if (type === 'Modbus TCP' && !values.hostIp) {
    return 'กรุณากรอก Host IP'
  }

  if (type === 'Modbus TCP' && !values.port) {
    return 'กรุณากรอก Port'
  }

  if (['Microsoft SQL', 'MySQL'].includes(type) && !values.hostIp) {
    return 'กรุณากรอก Host IP'
  }

  if (['Microsoft SQL', 'MySQL'].includes(type) && !values.port) {
    return 'กรุณากรอก Port'
  }

  return ''
}

function buildDeviceConfigChannels(rows, deviceCode) {
  return rows
    .filter((row) => row.parameter)
    .map((row) => compactObject({
      deviceCode,
      addressId: toNumberOrNull(row.addressId),
      dataType: row.parameter,
      valueRange: buildValueRange(row.min, row.max),
      alertLow: toNumberOrNull(row.alertLow),
      alertHigh: toNumberOrNull(row.alertHigh),
      valueFormat: (valueFormatCodeMap[row.valueFormat] ?? row.valueFormat) || 'MEASUREMENT_VALUE',
      offset: toNumberOrNull(row.offset),
      encoding: (encodingCodeMap[row.encodingData] ?? row.encodingData) || 'UNSIGNED16_BIG_ENDIAN',
      status: row.status || 'Normal',
    }))
}

function buildDeviceConfigStatusManagement(statusManagement) {
  return {
    selectedParameters: statusManagement?.selectedParameters?.length ? statusManagement.selectedParameters : ['ทั้งหมด'],
    startAt: statusManagement?.startAt || null,
    endAt: statusManagement?.endAt || null,
    status: statusManagement?.status || 'Normal',
    schedules: statusManagement?.schedules ?? [],
  }
}

function buildDeviceConfigPayloadItem({ form, stationId, deviceCode, channels, statusManagement }) {
  return {
    stationId,
    deviceCode,
    protocol: getConnectionProtocolCode(form.type),
    settings: buildConnectionSettings(form),
    channels,
    statusManagement: buildDeviceConfigStatusManagement(statusManagement),
  }
}

function buildStructuredDeviceConfigPayload({ stationId, deviceItems, channelGroups, statusManagement }) {
  return {
    config: {
      stationId,
      device: deviceItems,
      channels: channelGroups.flat(),
      statusManagement: buildDeviceConfigStatusManagement(statusManagement),
    },
  }
}

function buildDeviceConfigDeviceItem(form, deviceCode) {
  return {
    deviceCode,
    protocol: getConnectionProtocolCode(form.type),
    settings: buildConnectionSettings(form),
  }
}

function ConnectionSettingsDialog({ open, context, accessToken, onClose, onSaved }) {
  const [deviceConfig, setDeviceConfig] = useState(null)
  const [deviceConfigLoading, setDeviceConfigLoading] = useState(false)
  const [deviceConfigError, setDeviceConfigError] = useState('')
  const [testResultRows, setTestResultRows] = useState([])
  const [connectionForms, setConnectionForms] = useState([])
  const [parameterMappingRows, setParameterMappingRows] = useState([])
  const [statusManagementValue, setStatusManagementValue] = useState(null)
  const [deviceConfigTesting, setDeviceConfigTesting] = useState(false)
  const [deviceConfigSaving, setDeviceConfigSaving] = useState(false)
  const [deviceConfigConfirming, setDeviceConfigConfirming] = useState(false)
  const useConnectedPointDeviceConfigs = isConnectedMeasurementPointDeviceConfigContext(context)
  const parameterOptions = getDeviceConfigParameterOptions(deviceConfig, getConnectionParameterOptions(context))
  const generatedDeviceCodeOptions = connectionForms
    .map((form, index) => form.deviceCode ?? getConnectionDeviceCode(context, index))
    .filter(Boolean)
  const mappedDeviceCodeOptions = parameterMappingRows.map((row) => row.deviceCode).filter(Boolean)
  const deviceCodeOptions = [
    ...new Set([
      ...(deviceConfig?.deviceCodeOptions ?? []),
      ...generatedDeviceCodeOptions,
      ...mappedDeviceCodeOptions,
    ]),
  ]
  const statusManagement = statusManagementValue ?? deviceConfig?.statusManagement ?? null

  useEffect(() => {
    if (!open) {
      return
    }

    let isActive = true
    const requestId = getDeviceConfigRequestId(context)
    const stationId = getMonitoringPointCode(context)
    const loadApiUrl = useConnectedPointDeviceConfigs
      ? (stationId ? getConnectedMeasurementPointDeviceConfigsApiUrl(stationId) : '')
      : (requestId && stationId ? getDeviceConfigsApiUrl(requestId, stationId) : '')

    queueMicrotask(() => {
      if (!isActive) {
        return
      }

      setDeviceConfig(null)
      setConnectionForms([createDefaultConnectionItem(context)])
      setParameterMappingRows([])
      setStatusManagementValue(null)
      setTestResultRows([])
      setDeviceConfigTesting(false)
      setDeviceConfigConfirming(false)
      setDeviceConfigError('')
    })

    if (!stationId || (!useConnectedPointDeviceConfigs && !requestId)) {
      queueMicrotask(() => {
        if (isActive) {
          setDeviceConfigError(useConnectedPointDeviceConfigs
            ? 'ไม่พบรหัสจุดตรวจวัดสำหรับโหลดการตั้งค่าอุปกรณ์'
            : 'ไม่พบรหัสคำขอหรือรหัสจุดตรวจวัดสำหรับโหลดการตั้งค่าอุปกรณ์')
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

    fetch(loadApiUrl, {
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
          const nextParameterOptions = getDeviceConfigParameterOptions(data, getConnectionParameterOptions(context))
          const nextConnectionForms = mapConnectionForms(getDeviceConfigConnectionForms(data))
          setDeviceConfig(data)
          setConnectionForms(nextConnectionForms.length ? nextConnectionForms : [createDefaultConnectionItem(context)])
          setParameterMappingRows(mapParameterMappingRows(getDeviceConfigParameterMappings(data), nextParameterOptions))
          setStatusManagementValue(getDeviceConfigStatusManagement(data))
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
  }, [accessToken, context, open, useConnectedPointDeviceConfigs])

  const updateConnectionForm = (id, nextValue) => {
    setConnectionForms((current) => current.map((form) => (form.id === id ? nextValue : form)))
  }
  const handleTestConnection = () => {
    const stationId = getMonitoringPointCode(context)

    if (!stationId) {
      setDeviceConfigError('ไม่พบรหัสจุดตรวจวัดสำหรับทดสอบการเชื่อมต่อ')
      return
    }

    if (!accessToken) {
      setDeviceConfigError('กรุณาเข้าสู่ระบบเพื่อทดสอบการเชื่อมต่อ')
      return
    }

    setDeviceConfigTesting(true)
    setDeviceConfigError('')

    fetch(getConnectionTestApiUrl(stationId), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(async (result) => {
        const payload = await result.json().catch(() => null)

        if (!result.ok) {
          throw new Error(payload?.error?.message || payload?.message || `ทดสอบการเชื่อมต่อไม่สำเร็จ (${result.status} ${result.statusText})`)
        }

        const rows = Array.isArray(payload?.data) ? payload.data : []
        const registeredParameters = Array.isArray(payload?.meta?.registeredParameters)
          ? payload.meta.registeredParameters
          : []

        setTestResultRows(mapTestResultRows(rows))

        if (registeredParameters.length) {
          setDeviceConfig((current) => ({
            ...(current ?? {}),
            parameterOptions: registeredParameters,
          }))
        }
      })
      .catch((error) => {
        setDeviceConfigError(error instanceof Error ? error.message : 'ทดสอบการเชื่อมต่อไม่สำเร็จ')
      })
      .finally(() => {
        setDeviceConfigTesting(false)
      })
  }
  const buildCurrentDeviceConfigRequest = () => {
    const requestId = getDeviceConfigRequestId(context)
    const stationId = getMonitoringPointCode(context)
    const forms = connectionForms.length ? connectionForms : [{ type: '', values: {} }]
    const validationMessage = forms.map(validateDeviceConfigForm).find(Boolean)

    if (!stationId || (!useConnectedPointDeviceConfigs && !requestId)) {
      throw new Error(useConnectedPointDeviceConfigs
        ? 'ไม่พบรหัสจุดตรวจวัดสำหรับบันทึกการตั้งค่าอุปกรณ์'
        : 'ไม่พบรหัสคำขอหรือรหัสจุดตรวจวัดสำหรับบันทึกการตั้งค่าอุปกรณ์')
    }

    if (!accessToken) {
      throw new Error('กรุณาเข้าสู่ระบบเพื่อบันทึกการตั้งค่าอุปกรณ์')
    }

    if (validationMessage) {
      throw new Error(validationMessage)
    }

    if (forms.length > 1 && parameterMappingRows.some((row) => !row.deviceCode)) {
      throw new Error('กรุณาเลือกรหัสอุปกรณ์ในตารางการเชื่อมต่อพารามิเตอร์ให้ครบ')
    }

    const deviceItems = forms.map((form, index) => {
      const deviceCode = form.deviceCode || deviceCodeOptions[index] || getConnectionDeviceCode(context, index)

      return buildDeviceConfigDeviceItem(form, deviceCode)
    })

    const channelGroups = forms.map((form, index) => {
      const deviceCode = deviceItems[index]?.deviceCode || form.deviceCode || deviceCodeOptions[index] || getConnectionDeviceCode(context, index)
      const configRows = forms.length > 1
        ? parameterMappingRows.filter((row) => row.deviceCode === deviceCode)
        : parameterMappingRows

      return buildDeviceConfigChannels(configRows, useConnectedPointDeviceConfigs || forms.length > 1 ? deviceCode : undefined)
    })

    if (channelGroups.some((channels) => channels.length === 0)) {
      throw new Error('กรุณาเพิ่ม mapping ค่าพารามิเตอร์อย่างน้อย 1 รายการ')
    }

    if (channelGroups.some((channels) => channels.some((channel) => channel.addressId === null || channel.addressId === undefined))) {
      throw new Error('กรุณากรอก Address ID ในตารางการเชื่อมต่อพารามิเตอร์ให้ครบ')
    }

    const requestBody = useConnectedPointDeviceConfigs || forms.length > 1
      ? buildStructuredDeviceConfigPayload({
          stationId,
          deviceItems,
          channelGroups,
          statusManagement,
        })
      : buildDeviceConfigPayloadItem({
          form: forms[0],
          stationId,
          deviceCode: deviceItems[0]?.deviceCode,
          channels: channelGroups[0],
          statusManagement,
        })

    return { requestId, stationId, requestBody }
  }

  const applyDeviceConfigResponse = (data) => {
    const nextConnectionForms = mapConnectionForms(getDeviceConfigConnectionForms(data).length ? getDeviceConfigConnectionForms(data) : connectionForms)
    setDeviceConfig(data)
    setConnectionForms(nextConnectionForms.length ? nextConnectionForms : [createDefaultConnectionItem(context)])
    setParameterMappingRows(mapParameterMappingRows(
      getDeviceConfigParameterMappings(data).length ? getDeviceConfigParameterMappings(data) : parameterMappingRows,
      getDeviceConfigParameterOptions(data, parameterOptions),
    ))
    setStatusManagementValue(getDeviceConfigStatusManagement(data) ?? statusManagement)
    setTestResultRows(mapTestResultRows(data?.testResults ?? testResultRows))
  }

  const saveDeviceConfig = async () => {
    const { requestId, stationId, requestBody } = buildCurrentDeviceConfigRequest()
    const saveApiUrl = useConnectedPointDeviceConfigs
      ? getConnectedMeasurementPointDeviceConfigsApiUrl(stationId)
      : getDeviceConfigsApiUrl(requestId)
    const refreshApiUrl = useConnectedPointDeviceConfigs
      ? getConnectedMeasurementPointDeviceConfigsApiUrl(stationId)
      : getDeviceConfigsApiUrl(requestId, stationId)

    const saveResult = await fetch(saveApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const savePayload = await saveResult.json().catch(() => null)

    if (!saveResult.ok) {
      throw new Error(savePayload?.error?.message || savePayload?.message || `บันทึกการตั้งค่าอุปกรณ์ไม่สำเร็จ (${saveResult.status} ${saveResult.statusText})`)
    }

    const refreshResult = await fetch(refreshApiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const refreshPayload = await refreshResult.json().catch(() => null)

    if (!refreshResult.ok) {
      throw new Error(refreshPayload?.error?.message || refreshPayload?.message || `โหลดการตั้งค่าอุปกรณ์ล่าสุดไม่สำเร็จ (${refreshResult.status} ${refreshResult.statusText})`)
    }

    const data = refreshPayload?.data ?? deviceConfig
    applyDeviceConfigResponse(data)
    return { requestId, stationId, data }
  }

  const handleSaveDeviceConfig = () => {
    setDeviceConfigSaving(true)
    setDeviceConfigError('')
    saveDeviceConfig()
      .then(async () => {
        await onSaved?.()
        onClose?.()
      })
      .catch((error) => {
        setDeviceConfigError(error instanceof Error ? error.message : 'บันทึกการตั้งค่าอุปกรณ์ไม่สำเร็จ')
      })
      .finally(() => {
        setDeviceConfigSaving(false)
      })
  }

  const handleConfirmConnection = () => {
    if (useConnectedPointDeviceConfigs) {
      setDeviceConfigError('การยืนยันการเชื่อมต่อใช้ได้เฉพาะคำขอที่รอยืนยันการเชื่อมต่อ')
      return
    }

    setDeviceConfigConfirming(true)
    setDeviceConfigError('')
    saveDeviceConfig()
      .then(async ({ requestId }) => {
        const result = await fetch(getConfirmConnectionApiUrl(requestId), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'CONFIRM',
            note: 'ตั้งค่าอุปกรณ์และทดสอบแล้ว',
          }),
        })
        const payload = await result.json().catch(() => null)

        if (!result.ok) {
          throw new Error(payload?.error?.message || payload?.message || `ยืนยันการเชื่อมต่อไม่สำเร็จ (${result.status} ${result.statusText})`)
        }

        await onSaved?.()
        onClose?.()
      })
      .catch((error) => {
        setDeviceConfigError(error instanceof Error ? error.message : 'ยืนยันการเชื่อมต่อไม่สำเร็จ')
      })
      .finally(() => {
        setDeviceConfigConfirming(false)
      })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          pr: 2,
        }}
      >
        ตั้งค่าอุปกรณ์
        <IconButton aria-label="ปิด" size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
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
                    createDefaultConnectionItem(context, current.length),
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
                          deviceCode: form.deviceCode,
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
              <Table size="small" sx={{ minWidth: Math.max(720, getTestResultColumnCount(parameterOptions) * 120), ...borderedTableSx }}>
                <TableHead>
                  <TableRow>
                    {parameterOptions.map((column) => (
                      <Fragment key={column}>
                        <TableCell sx={{ fontWeight: 700, bgcolor: 'neutral.50' }}>
                          {column}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: 'neutral.50' }}>
                          Status
                        </TableCell>
                      </Fragment>
                    ))}
                    <TableCell sx={{ fontWeight: 700, bgcolor: 'neutral.50' }}>
                      Timestamp
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {testResultRows.length > 0 ? (
                    testResultRows.map((row) => (
                      <TableRow key={row.id}>
                        {parameterOptions.map((parameter) => (
                          <Fragment key={parameter}>
                            <TableCell>{row.values[parameter]}</TableCell>
                            <TableCell>{getTestResultParameterStatus(row, parameter)}</TableCell>
                          </Fragment>
                        ))}
                        <TableCell>{row.timestamp}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={getTestResultColumnCount(parameterOptions)} align="center">
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
        <Button variant="contained" disabled={deviceConfigTesting || deviceConfigSaving || deviceConfigConfirming} onClick={handleTestConnection}>
          {deviceConfigTesting ? 'กำลังทดสอบ' : 'ทดสอบ'}
        </Button>
        <Button variant="contained" disabled={deviceConfigSaving || deviceConfigConfirming} onClick={handleSaveDeviceConfig}>
          {deviceConfigSaving ? 'กำลังบันทึก' : 'บันทึก'}
        </Button>
        {!useConnectedPointDeviceConfigs ? (
          <Button color="secondary" variant="contained" disabled={deviceConfigSaving || deviceConfigConfirming} onClick={handleConfirmConnection}>
            {deviceConfigConfirming ? 'กำลังยืนยัน' : 'ยืนยันการเชื่อมต่อ'}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  )
}

function getFactoryColumns(isOperator, onOpenRequestForm, onOpenMonitoringPoints, onOpenIntentDialog, useOperatorColumns = isOperator) {
  const columns = [
    { field: 'factoryName', headerName: 'ชื่อโรงงาน/บริษัท', width: 240 },
    { field: 'newRegistrationNo', headerName: 'เลขทะเบียนโรงงาน (ใหม่)', width: 190 },
    { field: 'oldRegistrationNo', headerName: 'เลขทะเบียนโรงงาน (เก่า)', width: 190 },
    { field: 'businessActivity', headerName: 'การประกอบกิจการ', width: 170 },
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
      width: useOperatorColumns ? 260 : 290,
      sortable: false,
      filterable: false,
      renderCell: (params) =>
        useOperatorColumns ? (
          <OperatorFactoryActions
            row={params.row}
            onOpenRequestForm={onOpenRequestForm}
            onOpenMonitoringPoints={onOpenMonitoringPoints}
            onOpenIntentDialog={onOpenIntentDialog}
          />
        ) : (
          <OfficerFactoryActions row={params.row} onOpenMonitoringPoints={onOpenMonitoringPoints} />
      ),
    },
  ]

  return useOperatorColumns ? columns.filter((column) => column.field !== 'requestStatus') : columns
}

function ReadOnlyField({ label, value, sx }) {
  return (
    <TextField
      label={label}
      value={displayValue(value)}
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

const maxUploadFileSizeBytes = 5 * 1024 * 1024

function UploadFileField({ label, accept, name, currentFileName = '', multiple = true, helperText = 'ขนาดไม่เกิน 5 Mb', maxFiles = multiple ? 3 : 1 }) {
  const inputRef = useRef(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [fileError, setFileError] = useState('')
  const selectedFilesRef = useRef([])
  const fileNames = selectedFiles.map((item) => item.file.name).join(', ')
  const buttonLabel = fileNames || currentFileName || label

  useEffect(() => {
    selectedFilesRef.current = selectedFiles
  }, [selectedFiles])

  useEffect(() => () => {
    selectedFilesRef.current.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl)
      }
    })
  }, [])

  const syncInputFiles = (items) => {
    if (!inputRef.current) {
      return
    }

    const dataTransfer = new DataTransfer()
    items.forEach((item) => dataTransfer.items.add(item.file))
    inputRef.current.files = dataTransfer.files
  }

  const handleFilesChange = (event) => {
    const selectedInputFiles = Array.from(event.target.files ?? [])
    const oversizedFiles = selectedInputFiles.filter((file) => file.size > maxUploadFileSizeBytes)
    const acceptedFiles = selectedInputFiles.filter((file) => file.size <= maxUploadFileSizeBytes)
    const incomingFiles = acceptedFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${file.size}`,
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
    }))
    const filesById = new Map(selectedFiles.map((item) => [item.id, item]))
    setFileError(oversizedFiles.length
      ? `ไฟล์ ${oversizedFiles.map((file) => file.name).join(', ')} มีขนาดเกิน 5 MB`
      : '')

    incomingFiles.forEach((item) => {
      const duplicateItem = filesById.get(item.id)
      if (duplicateItem) {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl)
        }
        return
      }
      filesById.set(item.id, item)
    })

    const nextFiles = multiple ? Array.from(filesById.values()).slice(0, maxFiles) : incomingFiles.slice(0, 1)
    setSelectedFiles(nextFiles)
    syncInputFiles(nextFiles)
  }

  const removeSelectedFile = (targetIndex) => {
    const removedFile = selectedFiles[targetIndex]
    if (removedFile?.previewUrl) {
      URL.revokeObjectURL(removedFile.previewUrl)
    }

    const nextFiles = selectedFiles.filter((_, index) => index !== targetIndex)
    setSelectedFiles(nextFiles)
    setFileError('')
    syncInputFiles(nextFiles)
  }

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
          color: fileNames || currentFileName ? 'text.primary' : 'text.secondary',
          bgcolor: 'background.paper',
          '&:hover': {
            borderStyle: 'dashed',
            bgcolor: 'primary.50',
          },
        }}
      >
        {buttonLabel}
        <Box
          component="input"
          ref={inputRef}
          type="file"
          name={name}
          accept={accept}
          multiple={multiple}
          hidden
          onChange={handleFilesChange}
        />
      </Button>
      <Typography variant="caption" color="text.secondary">
        {currentFileName && !fileNames ? `ไฟล์เดิม: ${currentFileName} • ${helperText}` : `${helperText}${multiple ? ` • อัปโหลดได้ไม่เกิน ${maxFiles} ไฟล์` : ''}`}
      </Typography>
      {fileError ? (
        <Typography variant="caption" color="error">
          {fileError}
        </Typography>
      ) : null}
      {selectedFiles.length ? (
        <Stack spacing={1}>
          {selectedFiles.map((item, index) => (
            <Box
              key={item.id}
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                p: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              {item.previewUrl ? (
                <Box
                  component="img"
                  src={item.previewUrl}
                  alt={item.file.name}
                  sx={{
                    width: 48,
                    height: 48,
                    objectFit: 'cover',
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                    flex: '0 0 auto',
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'neutral.50',
                    flex: '0 0 auto',
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    FILE
                  </Typography>
                </Box>
              )}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" noWrap title={item.file.name}>
                  {item.file.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {(item.file.size / 1024 / 1024).toFixed(2)} MB
                </Typography>
              </Box>
              <IconButton size="small" aria-label={`ลบไฟล์ ${item.file.name}`} onClick={() => removeSelectedFile(index)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Stack>
      ) : null}
    </Stack>
  )
}

function ParameterMultiSelect({
  label,
  name,
  options = cemsParameterOptions,
  value: controlledValue,
  defaultValue = [],
  onChange,
}) {
  const [internalValue, setInternalValue] = useState(normalizeArrayValue(defaultValue))
  const value = controlledValue ?? internalValue

  return (
    <FormControl size="small" fullWidth>
      {name ? <input type="hidden" name={name} value={JSON.stringify(value)} /> : null}
      <InputLabel>{label}</InputLabel>
      <Select
        multiple
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
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

function OptionMultiSelect({
  label,
  name,
  options = [],
  value: controlledValue,
  defaultValue = [],
  onChange,
}) {
  const [internalValue, setInternalValue] = useState(normalizeArrayValue(defaultValue))
  const value = controlledValue ?? internalValue

  return (
    <FormControl size="small" fullWidth>
      {name ? <input type="hidden" name={name} value={JSON.stringify(value)} /> : null}
      <InputLabel>{label}</InputLabel>
      <Select
        multiple
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
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

function TagInputField({ label, name, value: controlledValue, defaultValue = [], onChange, placeholder = 'พิมพ์แล้วกด Enter' }) {
  const [internalValue, setInternalValue] = useState(normalizeArrayValue(defaultValue))
  const value = controlledValue ?? internalValue

  return (
    <>
      {name ? <input type="hidden" name={name} value={JSON.stringify(value)} /> : null}
      <Autocomplete
        multiple
        freeSolo
        options={[]}
        value={value}
        onChange={(_, nextValue) => {
          const normalizedValue = nextValue.map((item) => String(item).trim()).filter(Boolean)
          if (onChange) {
            onChange(normalizedValue)
          } else {
            setInternalValue(normalizedValue)
          }
        }}
        renderTags={(tagValue, getTagProps) =>
          tagValue.map((option, index) => {
            const { key, ...tagProps } = getTagProps({ index })

            return (
              <Chip
                key={key}
                label={option}
                size="small"
                {...tagProps}
              />
            )
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            size="small"
            placeholder={placeholder}
            fullWidth
          />
        )}
      />
    </>
  )
}

function CemsMonitoringPointDetails({ initialPoint = {}, requestedParameters = [], onRequestedParametersChange, isOperator = false }) {
  const initialDetails = { ...mockCemsMonitoringPointDetails, ...(initialPoint.details ?? {}) }
  const pointCodeValue = initialPoint.pointCode ?? initialPoint.code ?? (isOperator ? '' : initialDetails.pointCode)
  const initialProductionCapacity = splitProductionCapacity(initialDetails)
  const [stackShape, setStackShape] = useState(initialDetails.stackShape)
  const [primaryFuel, setPrimaryFuel] = useState(initialDetails.primaryFuel)
  const [secondaryFuel, setSecondaryFuel] = useState(initialDetails.secondaryFuel)
  const [treatmentSystem, setTreatmentSystem] = useState(normalizeArrayValue(initialDetails.treatmentSystem))
  const [connectionDevice, setConnectionDevice] = useState(initialDetails.connectionDevice)
  const [cemsInstallationRequiredBy, setCemsInstallationRequiredBy] = useState(initialDetails.cemsInstallationRequiredBy)
  const [timeSharingParameters, setTimeSharingParameters] = useState(normalizeArrayValue(initialDetails.timeSharingParameters))
  const showLegalAnnexNo = cemsLegalAnnexRequiredOptions.includes(cemsInstallationRequiredBy)
  const showPrimaryFuelOther = isOtherOption(primaryFuel) || isBiomassOption(primaryFuel)
  const showSecondaryFuelOther = isOtherOption(secondaryFuel) || isBiomassOption(secondaryFuel)
  const hasTreatmentSystem = treatmentSystem.length > 0 && !treatmentSystem.includes('ไม่มี') ? 'มี' : 'ไม่มี'
  const hasTreatmentSystemOther = treatmentSystem.some((item) => item === 'อื่นๆ')
  const showSharedStackCode = !timeSharingParameters.includes(parameterNoneOption)

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            name="pointCode"
            label="รหัสจุดตรวจวัด"
            size="small"
            defaultValue={pointCodeValue}
            slotProps={{
              input: {
                readOnly: isOperator,
              },
            }}
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="pointName" label="ชื่อจุดตรวจวัด" size="small" defaultValue={initialPoint.pointName ?? initialDetails.pointName} fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="productionUnitType" label="ประเภทของหน่วยการผลิต" size="small" defaultValue={initialDetails.productionUnitType} fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 1 }}>
          <TextField name="productionCapacityValue" label="กำลังการผลิต" size="small" defaultValue={initialProductionCapacity.value} fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 2 }}>
          <TextField name="productionCapacityUnit" label="หน่วยกำลังการผลิต" size="small" defaultValue={initialProductionCapacity.unit} fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            name="cemsInstallationRequiredBy"
            select
            label="เข้าข่ายต้องติดตั้ง CEMS ตามกฎหมาย"
            size="small"
            fullWidth
            value={cemsInstallationRequiredBy}
            onChange={(event) => setCemsInstallationRequiredBy(event.target.value)}
          >
            <MenuItem value="">-</MenuItem>
            {cemsInstallationRequiredOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        {cemsInstallationRequiredBy === 'อื่นๆ' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField name="cemsInstallationRequiredOther" label="อื่นๆ โปรดระบุ" size="small" defaultValue={initialDetails.cemsInstallationRequiredOther} fullWidth />
          </Grid>
        ) : null}
        {showLegalAnnexNo ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <ParameterMultiSelect
              name="legalAnnexNo"
              label="เข้าข่ายตามบัญชีแนบท้ายลำดับที่"
              options={legalAnnexNoOptions}
              defaultValue={normalizeStringArray(initialDetails.legalAnnexNo)}
            />
          </Grid>
        ) : null}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect name="eligibleParameters" label="พารามิเตอร์ที่เข้าข่าย" options={withNoneOption(cemsParameterOptions)} defaultValue={initialDetails.eligibleParameters ?? []} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect name="exemptedParameters" label="พารามิเตอร์ที่ได้รับการยกเว้น" options={withNoneOption(cemsParameterOptions)} defaultValue={initialDetails.exemptedParameters ?? []} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect name="connectedParameters" label="พารามิเตอร์ที่เชื่อมต่อแล้ว" options={withNoneOption(cemsParameterOptions)} defaultValue={initialDetails.connectedParameters ?? []} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect name="pendingParameters" label="พารามิเตอร์ที่ยังไม่เชื่อมต่อ" options={withNoneOption(cemsParameterOptions)} defaultValue={initialDetails.pendingParameters ?? []} />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect
            name="requestedParameters"
            label="พารามิเตอร์ที่ขอเชื่อมต่อ"
            options={cemsParameterOptions}
            value={requestedParameters}
            onChange={onRequestedParametersChange}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TagInputField
            name="exemptedParameterRegulationClauses"
            label="พารามิเตอร์ที่ได้รับการยกเว้นตามประกาศฯ ข้อ"
            defaultValue={normalizeStringArray(initialDetails.exemptedParameterRegulationClauses)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect
            name="timeSharingParameters"
            label="พารามิเตอร์ที่ติดตั้งแบบ Time sharing"
            options={withNoneOption(cemsParameterOptions)}
            value={timeSharingParameters}
            onChange={setTimeSharingParameters}
          />
        </Grid>
        {showSharedStackCode ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              name="sharedStackCode"
              label="ร่วมกับปล่อง"
              size="small"
              defaultValue={initialDetails.sharedStackCode ?? initialDetails.sharedStack}
              fullWidth
            />
          </Grid>
        ) : null}
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
            <TextField name="stackDiameter" label="เส้นผ่านศูนย์กลาง (เมตร)" size="small" defaultValue={initialDetails.stackDiameter} fullWidth />
          </Grid>
        ) : null}
        {stackShape === 'สี่เหลี่ยม' ? (
          <>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="stackWidth" label="กว้าง (เมตร)" size="small" defaultValue={initialDetails.stackWidth} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="stackLength" label="ยาว (เมตร)" size="small" defaultValue={initialDetails.stackLength} fullWidth />
            </Grid>
          </>
        ) : null}
        {stackShape === 'อื่นๆ' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField name="stackShapeOther" label="โปรดระบุ" size="small" defaultValue={initialDetails.stackShapeOther} fullWidth />
          </Grid>
        ) : null}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="stackHeight" label="ความสูงปล่อง (เมตร)" size="small" defaultValue={initialDetails.stackHeight} fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="monitoringHeight" label="ความสูงของจุดตรวจวัด (เมตร)" size="small" defaultValue={initialDetails.monitoringHeight} fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="averageFlowRate" label="อัตราการระบายอากาศเฉลี่ย (m³/hr)" size="small" defaultValue={initialDetails.averageFlowRate} fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="minFlowRate" label="อัตราการระบายอากาศต่ำสุด (m³/hr)" size="small" defaultValue={initialDetails.minFlowRate} fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="maxFlowRate" label="อัตราการระบายอากาศสูงสุด (m³/hr)" size="small" defaultValue={initialDetails.maxFlowRate} fullWidth />
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
            {fuelOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="primaryFuelOther" label="ระบุเชื้อเพลิงหลัก" size="small" defaultValue={initialDetails.primaryFuelOther} fullWidth disabled={!showPrimaryFuelOther} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="primaryFuelPercent" label="ร้อยละโดยประมาณ" size="small" defaultValue={initialDetails.primaryFuelPercent} fullWidth />
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
            {fuelOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="secondaryFuelOther" label="ระบุเชื้อเพลิงรอง" size="small" defaultValue={initialDetails.secondaryFuelOther} fullWidth disabled={!showSecondaryFuelOther} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="secondaryFuelPercent" label="ร้อยละโดยประมาณ" size="small" defaultValue={initialDetails.secondaryFuelPercent} fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="combustionControlSystem" select label="ระบบควบคุม" size="small" defaultValue={initialDetails.combustionControlSystem} fullWidth>
            <MenuItem value="">-</MenuItem>
            {combustionControlSystemOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <input
            type="hidden"
            name="hasTreatmentSystem"
            value={hasTreatmentSystem}
          />
          <OptionMultiSelect
            name="treatmentSystem"
            label="ระบบบำบัด"
            value={treatmentSystem}
            options={treatmentSystemOptions}
            onChange={setTreatmentSystem}
          />
        </Grid>
        {hasTreatmentSystemOther ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField name="treatmentSystemOther" label="ระบุระบบบำบัด" size="small" defaultValue={initialDetails.treatmentSystemOther} fullWidth />
          </Grid>
        ) : null}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="stackLatitude" label="พิกัดปล่องที่ติดตั้ง CEMS (ละติจูด)" size="small" defaultValue={initialDetails.stackLatitude} fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="stackLongitude" label="พิกัดปล่องที่ติดตั้ง CEMS (ลองติจูด)" size="small" defaultValue={initialDetails.stackLongitude} fullWidth />
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
            {connectionDeviceOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        {connectionDevice === 'อื่นๆ' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField name="connectionDeviceOther" label="โปรดระบุ" size="small" defaultValue={initialDetails.connectionDeviceOther} fullWidth />
          </Grid>
        ) : null}
      </Grid>
    </Stack>
  )
}

function DocumentsAndImagesSection({ initialDocuments = [], systemType = 'CEMS' }) {
  const itemsWithIndex = documentImageItems.map((item, index) => ({ ...item, index }))
  const sectionTitles = systemType === 'WPMS' ? wpmsDocumentImageTitles : cemsDocumentImageTitles
  const sectionItems = itemsWithIndex.filter((item) => sectionTitles.includes(item.title))

  return (
    <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
      <Stack spacing={2.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          เอกสารและรูปภาพ
        </Typography>
        {sectionItems.map((item) => (
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
              <Grid size={{ xs: 12, md: 3 }}>
                <UploadFileField
                  name={`documentImageFile-${item.index}`}
                  label={item.uploadLabel}
                  accept={item.accept}
                  currentFileName={initialDocuments.find((document) => documentTitleMatchesItem(document, item))?.fileName ?? ''}
                  multiple={!item.singleFile}
                  helperText={item.helperText ?? 'ขนาดไม่เกิน 5 Mb'}
                />
              </Grid>
              {item.hasLink ? (
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    name={`documentImageLink-${item.index}`}
                    label="Link"
                    size="small"
                    defaultValue={initialDocuments[item.index]?.link ?? ''}
                    fullWidth
                  />
                </Grid>
              ) : null}
            </Grid>
          </Stack>
        ))}
      </Stack>
    </Paper>
  )
}

function SpecialCriteriaTable({ value, onChange, disabled = false }) {
  const updateRow = (level, field, nextValue) => {
    onChange({
      ...value,
      rows: value.rows.map((row) => (row.level === level ? { ...row, [field]: nextValue } : row)),
    })
  }
  const getCriteriaOperators = (level) => {
    if (level === 'normal') {
      return { left: '≤', right: '≤' }
    }
    if (level === 'warning') {
      return { left: '<', right: '≤' }
    }
    return { left: '<', right: '<' }
  }

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
                <TextField
                  size="small"
                  value={value.rows.find((criteriaRow) => criteriaRow.level === row.key)?.min ?? ''}
                  onChange={(event) => updateRow(row.key, 'min', normalizeDecimalInput(event.target.value))}
                  disabled={disabled}
                  fullWidth
                />
              </TableCell>
              <TableCell align="center">
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body2">{getCriteriaOperators(row.key).left}</Typography>
                  <Chip label={row.label} color={row.color} size="small" sx={{ fontWeight: 700 }} />
                  <Typography variant="body2">{getCriteriaOperators(row.key).right}</Typography>
                </Stack>
              </TableCell>
              <TableCell>
                <TextField
                  size="small"
                  value={row.key === 'critical'
                    ? '-'
                    : value.rows.find((criteriaRow) => criteriaRow.level === row.key)?.max ?? ''}
                  onChange={(event) => updateRow(row.key, 'max', normalizeDecimalInput(event.target.value))}
                  disabled={disabled}
                  fullWidth
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function StandardCriteriaSection({ label, value, onChange }) {
  const hasNoStandard = !value.enabled
  const hasInvalidStandard = !isCriteriaInputValid(value)
  const updateHasNoStandard = (checked) => {
    onChange({
      ...value,
      enabled: !checked,
      ...(checked
        ? {
            standardValue: '',
            rows: createCriteria().rows,
          }
        : {}),
    })
  }
  const updateStandardValue = (nextValue) => {
    const normalizedValue = normalizeDecimalInput(nextValue)
    onChange({
      ...value,
      enabled: true,
      standardValue: normalizedValue,
      rows: createCriteriaRowsFromStandardValue(normalizedValue),
    })
  }

  return (
    <Stack spacing={1.5}>
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={hasNoStandard}
            onChange={(event) => updateHasNoStandard(event.target.checked)}
          />
        }
        label={label}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <TextField
            label="ค่ามาตรฐาน"
            type="number"
            size="small"
            value={value.standardValue}
            onChange={(event) => updateStandardValue(event.target.value)}
            disabled={hasNoStandard}
            error={hasInvalidStandard}
            helperText={hasInvalidStandard ? 'ค่ามาตรฐานต้องเป็นตัวเลขมากกว่า 0' : 'ค่าเฝ้าระวังคำนวณอัตโนมัติที่ 80%'}
            slotProps={{
              formHelperText: {
                sx: { whiteSpace: 'nowrap' },
              },
            }}
            fullWidth
          />
        </Grid>
      </Grid>
      <SpecialCriteriaTable value={value} onChange={onChange} disabled={hasNoStandard} />
    </Stack>
  )
}

function InstrumentDataDialog({ open, parameterOptions, value, onClose, onSave, isWpms = false }) {
  const [form, setForm] = useState(() => buildInstrumentDialogForm(value))
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)

  const updateForm = (field, nextValue) => setForm((current) => ({ ...current, [field]: nextValue }))
  const canSave = Boolean(form.parameter)
    && isCriteriaInputValid(form.standardCriteria)
    && isCriteriaInputValid(form.eiaCriteria)
  const confirmSave = () => {
    onSave(form)
    setSaveConfirmOpen(false)
  }

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
            {!isWpms ? (
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
            ) : null}
          </Grid>
          <Divider />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <StandardCriteriaSection
                label="พารามิเตอร์ไม่มีค่ามาตรฐาน ตามประกาศ อก."
                value={form.standardCriteria}
                onChange={(nextValue) => updateForm('standardCriteria', nextValue)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <StandardCriteriaSection
                label="พารามิเตอร์ไม่มีค่ามาตรฐาน ตาม EIA"
                value={form.eiaCriteria}
                onChange={(nextValue) => updateForm('eiaCriteria', nextValue)}
              />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center' }}>
        <Button color="inherit" onClick={onClose}>
          ปิด
        </Button>
        <Button variant="contained" disabled={!canSave} onClick={() => setSaveConfirmOpen(true)}>
          บันทึก
        </Button>
      </DialogActions>
      <Dialog open={saveConfirmOpen} onClose={() => setSaveConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>ยืนยันการบันทึก</DialogTitle>
        <DialogContent dividers>
          <Typography>ยืนยันบันทึกข้อมูลเครื่องมือตรวจวัดนี้</Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center' }}>
          <Button color="inherit" onClick={() => setSaveConfirmOpen(false)}>
            ยกเลิก
          </Button>
          <Button variant="contained" onClick={confirmSave}>
            ยืนยัน
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  )
}

function MeasurementInstrumentSection({ parameterOptions, rows, setRows, initialInstruments = {}, isWpms = false }) {
  const instrumentRows = rows
  const [editingRowIndex, setEditingRowIndex] = useState(null)
  const [instrumentDialogOpen, setInstrumentDialogOpen] = useState(false)
  const [saveSuccessOpen, setSaveSuccessOpen] = useState(false)
  const editingValue = editingRowIndex === null ? null : instrumentRows[editingRowIndex]
  const columns = isWpms
    ? measurementInstrumentColumns.filter((column) => !['สภาวะมาตรฐาน', 'การรายงานค่า (Dry basis)', 'O₂ @ 7% or Excess Air 50%'].includes(column))
    : measurementInstrumentColumns

  return (
    <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          รายละเอียดเครื่องมือตรวจวัด
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Grid container spacing={2} sx={{ flex: 1 }}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                name="converterBrand"
                label="อุปกรณ์แปลงสัญญาณ (Converter) ยี่ห้อ"
                size="small"
                defaultValue={initialInstruments.converterBrand ?? mockMeasurementInstrumentDetails.converterBrand}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                name="converterModel"
                label="อุปกรณ์แปลงสัญญาณ (Converter) รุ่น"
                size="small"
                defaultValue={initialInstruments.converterModel ?? mockMeasurementInstrumentDetails.converterModel}
                fullWidth
              />
            </Grid>
          </Grid>
        </Stack>
        <TableContainer sx={{ border: 1, borderColor: 'divider', overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: isWpms ? 920 : 1280, ...borderedTableSx }}>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
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
                      <TableCell>{data.parameter}</TableCell>
                      <TableCell>{data?.technique ?? ''}</TableCell>
                      <TableCell>{data?.range ?? ''}</TableCell>
                      <TableCell>{data?.brand ?? ''}</TableCell>
                      <TableCell>{data?.supplier ?? ''}</TableCell>
                      <TableCell>{getEiaStandardDisplay(data)}</TableCell>
                      {!isWpms ? (
                        <>
                          <TableCell>{data?.standardCondition ? '✓' : ''}</TableCell>
                          <TableCell>{data?.dryBasis ? '✓' : ''}</TableCell>
                          <TableCell>{data?.oxygenOrExcessAir ? '✓' : ''}</TableCell>
                        </>
                      ) : null}
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
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center">
                    <Typography variant="body2" color="text.secondary">
                      เลือกพารามิเตอร์ที่ขอเชื่อมต่อเพื่อแสดงรายละเอียดเครื่องมือตรวจวัด
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
          isWpms={isWpms}
          onSave={(nextValue) => {
            setRows((current) =>
              editingRowIndex === null
                ? [...current, nextValue]
                : current.map((row, index) => (index === editingRowIndex ? nextValue : row)),
            )
            setInstrumentDialogOpen(false)
            setSaveSuccessOpen(true)
          }}
        />
      ) : null}
      <Snackbar
        open={saveSuccessOpen}
        autoHideDuration={3000}
        onClose={() => setSaveSuccessOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSaveSuccessOpen(false)}>
          บันทึกข้อมูลเครื่องมือตรวจวัดสำเร็จ
        </Alert>
      </Snackbar>
    </Paper>
  )
}

function InformationProviderSection({ currentUser, initialProvider = {}, useLoginDefaults = false }) {
  const defaultName = useLoginDefaults
    ? currentUser?.name ?? ''
    : initialProvider.name ?? ''
  const defaultPosition = useLoginDefaults
    ? currentUser?.position ?? ''
    : initialProvider.position ?? ''

  return (
    <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          ผู้ให้ข้อมูลหรือผู้รับมอบอำนาจ
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              name="informationProviderName"
              label="ชื่อ-นามสกุล"
              size="small"
              defaultValue={defaultName}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              name="informationProviderPosition"
              label="ตำแหน่ง"
              size="small"
              defaultValue={defaultPosition}
              fullWidth
            />
          </Grid>
        </Grid>
      </Stack>
    </Paper>
  )
}

function WpmsMonitoringPointDetails({ initialPoint = {}, requestedParameters = [], onRequestedParametersChange, isOperator = false }) {
  const initialDetails = { ...mockWpmsMonitoringPointDetails, ...(initialPoint.details ?? {}) }
  const pointCodeValue = initialPoint.pointCode ?? initialPoint.code ?? (isOperator ? '' : initialDetails.pointCode)
  const [treatmentSystem, setTreatmentSystem] = useState(normalizeArrayValue(initialDetails.treatmentSystem))
  const [connectionDevice, setConnectionDevice] = useState(initialDetails.connectionDevice)
  const hasTreatmentSystem = treatmentSystem.length > 0 && !treatmentSystem.includes('ไม่มี') ? 'มี' : 'ไม่มี'
  const hasTreatmentSystemOther = treatmentSystem.some((item) => item === 'อื่นๆ')

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            name="pointCode"
            label="รหัสจุดตรวจวัด"
            size="small"
            defaultValue={pointCodeValue}
            slotProps={{
              input: {
                readOnly: isOperator,
              },
            }}
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="pointName" label="ชื่อจุดตรวจวัด" size="small" defaultValue={initialPoint.pointName ?? initialDetails.pointName} fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect
            name="eligibleParameters"
            label="พารามิเตอร์ที่เข้าข่าย"
            options={withNoneOption(wpmsInstrumentParameters)}
            defaultValue={initialDetails.eligibleParameters ?? []}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect
            name="connectedParameters"
            label="พารามิเตอร์ที่เชื่อมต่อแล้ว"
            options={withNoneOption(wpmsInstrumentParameters)}
            defaultValue={initialDetails.connectedParameters ?? []}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect
            name="pendingParameters"
            label="พารามิเตอร์ที่ยังไม่เชื่อมต่อ"
            options={withNoneOption(wpmsInstrumentParameters)}
            defaultValue={initialDetails.pendingParameters ?? []}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect
            name="requestedParameters"
            label="พารามิเตอร์ที่ขอเชื่อมต่อ"
            options={wpmsInstrumentParameters}
            value={requestedParameters}
            onChange={onRequestedParametersChange}
          />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="averageWastewaterDischarge" label="อัตราการระบายน้ำทิ้งเฉลี่ย (m³/d)" size="small" defaultValue={initialDetails.averageWastewaterDischarge} fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="minWastewaterDischarge" label="อัตราการระบายน้ำทิ้งต่ำสุด (m³/d)" size="small" defaultValue={initialDetails.minWastewaterDischarge} fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="maxWastewaterDischarge" label="อัตราการระบายน้ำทิ้งสูงสุด (m³/d)" size="small" defaultValue={initialDetails.maxWastewaterDischarge} fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <input
            type="hidden"
            name="hasTreatmentSystem"
            value={hasTreatmentSystem}
          />
          <OptionMultiSelect
            name="treatmentSystem"
            label="ระบบบำบัด"
            value={treatmentSystem}
            options={wpmsTreatmentSystemOptions}
            onChange={setTreatmentSystem}
          />
        </Grid>
        {hasTreatmentSystemOther ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField name="treatmentSystemOther" label="ระบุระบบบำบัด" size="small" defaultValue={initialDetails.treatmentSystemOther} fullWidth />
          </Grid>
        ) : null}
        {hasTreatmentSystem === 'มี' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField name="maxTreatmentCapacity" label="ปริมาณรองรับน้ำเสียสูงสุดของระบบบำบัด" size="small" defaultValue={initialDetails.maxTreatmentCapacity} fullWidth />
          </Grid>
        ) : null}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="instrumentLatitude" label="พิกัดจุดติดตั้งเครื่องมือตรวจวัด (ละติจูด)" size="small" defaultValue={initialDetails.instrumentLatitude} fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="instrumentLongitude" label="พิกัดจุดติดตั้งเครื่องมือตรวจวัด (ลองติจูด)" size="small" defaultValue={initialDetails.instrumentLongitude} fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="dischargeLatitude" label="พิกัดจุดระบายน้ำทิ้งออกนอกโรงงาน (ละติจูด)" size="small" defaultValue={initialDetails.dischargeLatitude ?? initialDetails.outfallLatitude} fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="dischargeLongitude" label="พิกัดจุดระบายน้ำทิ้งออกนอกโรงงาน (ลองติจูด)" size="small" defaultValue={initialDetails.dischargeLongitude ?? initialDetails.outfallLongitude} fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="wastewaterSource" label="แหล่งกำเนิดน้ำเสีย" size="small" defaultValue={initialDetails.wastewaterSource} fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField name="dischargeReceivingSource" label="แหล่งรองรับน้ำทิ้ง" size="small" defaultValue={initialDetails.dischargeReceivingSource} fullWidth />
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
            {connectionDeviceOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        {connectionDevice === 'อื่นๆ' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField name="connectionDeviceOther" label="โปรดระบุ" size="small" defaultValue={initialDetails.connectionDeviceOther} fullWidth />
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

function MonitoringPointDetails({ point, initialPoint = {}, requestedParameters = [], onRequestedParametersChange, isOperator = false }) {
  if (point.type === 'CEMS') {
    return (
      <CemsMonitoringPointDetails
        initialPoint={initialPoint}
        requestedParameters={requestedParameters}
        onRequestedParametersChange={onRequestedParametersChange}
        isOperator={isOperator}
      />
    )
  }
  if (point.type === 'WPMS') {
    return (
      <WpmsMonitoringPointDetails
        initialPoint={initialPoint}
        requestedParameters={requestedParameters}
        onRequestedParametersChange={onRequestedParametersChange}
        isOperator={isOperator}
      />
    )
  }
  if (point.type === 'Mobile') {
    return <MobileMonitoringPointDetails />
  }
  if (point.type === 'Station') {
    return <StationMonitoringPointDetails />
  }
  return null
}

function RequestFormBottomSheet({
  open,
  formType,
  factory,
  accessToken,
  currentUser,
  isOperator = false,
  mode = 'create',
  requestId,
  initialRequest,
  loading = false,
  loadError = '',
  onClose,
  onSubmitted,
}) {
  const formRef = useRef(null)
  const submitPreviewPdfUrlRef = useRef('')
  const isEditMode = mode === 'edit'
  const isAddParameterMode = mode === 'add-parameter'
  const useInitialRequestValues = isEditMode || isAddParameterMode
  const initialPoint = getInitialRequestPoint(initialRequest)
  const initialInstruments = initialPoint.measurementInstruments ?? {}
  const initialDocuments = mergeDocumentItems(
    getDocumentItemsFromSource(initialPoint),
    getDocumentItemsFromSource(initialRequest),
  )
  const formFactory = useInitialRequestValues ? getInitialRequestFactory(initialRequest, factory) : factory
  const latestRevisionMessage = isEditMode ? getLatestRevisionMessage(initialRequest) : ''
  const initialContactPersons = useInitialRequestValues && Array.isArray(initialRequest?.contactPersons)
    ? withFormIds(initialRequest.contactPersons)
    : [{ id: 1 }]
  const initialNotificationEmails = useInitialRequestValues && Array.isArray(initialRequest?.notificationEmails) && initialRequest.notificationEmails.length
    ? initialRequest.notificationEmails.map((email, index) => ({ id: index + 1, value: email }))
    : [{ id: 1, value: '' }]
  const initialOfficerNotificationEmails = normalizeEmailList(
    useInitialRequestValues ? initialRequest?.officerNotificationEmails : formFactory?.officerNotificationEmails,
  )
  const initialMonitoringPointType = useInitialRequestValues && initialRequest ? getRequestSystemType(initialRequest) : ''
  const initialMonitoringPoints = [{ id: 1, type: initialMonitoringPointType }]
  const initialRequestedParameters = normalizeArrayValue(
    initialPoint.details?.requestedParameters?.length
      ? initialPoint.details.requestedParameters
      : (initialInstruments.parameters ?? []).map((parameter) => parameter.parameter),
  )
  const [contacts, setContacts] = useState(initialContactPersons)
  const [factoryEmails, setFactoryEmails] = useState(initialNotificationEmails)
  const [monitoringPoints, setMonitoringPoints] = useState(initialMonitoringPoints)
  const [measurementInstrumentRows, setMeasurementInstrumentRows] = useState(
    getInitialInstrumentRows(initialInstruments),
  )
  const [requestedParameters, setRequestedParameters] = useState(initialRequestedParameters)
  const [selectedMonitoringPointId, setSelectedMonitoringPointId] = useState(1)
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false)
  const [submitPreviewRequest, setSubmitPreviewRequest] = useState(null)
  const [submitPreviewPdfUrl, setSubmitPreviewPdfUrl] = useState('')
  const [submitPreviewPdfLoading, setSubmitPreviewPdfLoading] = useState(false)
  const [submitPreviewPdfError, setSubmitPreviewPdfError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccessOpen, setSubmitSuccessOpen] = useState(false)
  const submitPreviewSessionRef = useRef(0)
  const [eiaAssessment, setEiaAssessment] = useState(getEiaAssessmentValue(formFactory))
  const officerEmails = initialOfficerNotificationEmails.length ? initialOfficerNotificationEmails : ['']
  const showMonitoringPointSection = formType === 'เพิ่มจุดตรวจวัด' || isAddParameterMode
  const selectedMonitoringPoint = monitoringPoints.find((point) => point.id === selectedMonitoringPointId)
    ?? monitoringPoints[0]
  const updateRequestedParameters = (nextValue) => {
    setRequestedParameters(nextValue)
    setMeasurementInstrumentRows((current) => syncInstrumentRowsWithRequestedParameters(current, nextValue))
  }
  const buildCurrentRequestBody = () => {
    const formData = formRef.current ? new FormData(formRef.current) : null
    const requestBody = buildMeasurementPointRequestBody(
      formFactory,
      selectedMonitoringPoint?.type,
      formData,
      [],
      measurementInstrumentRows,
      { includePreviewUrls: true, existingDocuments: initialDocuments },
    )

    if (isEditMode) {
      requestBody.remarks = 'แก้ไขตามเจ้าหน้าที่แจ้ง'
    } else if (isAddParameterMode) {
      requestBody.remarks = 'ขอเพิ่มพารามิเตอร์'
    }

    return requestBody
  }
  const clearSubmitPreviewPdf = useCallback(() => {
    if (submitPreviewPdfUrlRef.current) {
      URL.revokeObjectURL(submitPreviewPdfUrlRef.current)
      submitPreviewPdfUrlRef.current = ''
    }
    setSubmitPreviewPdfUrl('')
    setSubmitPreviewPdfLoading(false)
    setSubmitPreviewPdfError('')
  }, [])

  useEffect(() => () => {
    if (submitPreviewPdfUrlRef.current) {
      URL.revokeObjectURL(submitPreviewPdfUrlRef.current)
      submitPreviewPdfUrlRef.current = ''
    }
  }, [])

  const closeSubmitConfirm = useCallback(() => {
    setSubmitConfirmOpen(false)
  }, [])

  const handleSubmitConfirmExited = useCallback(() => {
    submitPreviewSessionRef.current += 1
    setSubmitPreviewRequest(null)
    clearSubmitPreviewPdf()
  }, [clearSubmitPreviewPdf])

  const openSubmitConfirm = async () => {
    setSubmitError('')
    clearSubmitPreviewPdf()
    const previewSessionId = submitPreviewSessionRef.current + 1
    submitPreviewSessionRef.current = previewSessionId
    const requestBody = buildCurrentRequestBody()
    setSubmitPreviewRequest(requestBody)
    setSubmitConfirmOpen(true)
    setSubmitPreviewPdfLoading(true)

    try {
      const pdfBytes = await createConnectionRequestPdf(requestBody)
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const pdfUrl = URL.createObjectURL(blob)
      if (submitPreviewSessionRef.current !== previewSessionId) {
        URL.revokeObjectURL(pdfUrl)
        return
      }
      submitPreviewPdfUrlRef.current = pdfUrl
      setSubmitPreviewPdfUrl(pdfUrl)
    } catch (error) {
      if (submitPreviewSessionRef.current === previewSessionId) {
        setSubmitPreviewPdfError(error instanceof Error ? error.message : 'สร้าง PDF preview ไม่สำเร็จ')
      }
    } finally {
      if (submitPreviewSessionRef.current === previewSessionId) {
        setSubmitPreviewPdfLoading(false)
      }
    }
  }
  const submitRequest = async () => {
    if (!accessToken) {
      setSubmitError('กรุณาเข้าสู่ระบบเพื่อส่งแบบฟอร์มคำขอ')
      return
    }

    if (isEditMode && !requestId) {
      setSubmitError('ไม่พบรหัสคำขอสำหรับแก้ไขแบบฟอร์ม')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const formData = formRef.current ? new FormData(formRef.current) : null
      const monitoringPointType = selectedMonitoringPoint?.type
      const uploadedDocuments = ['CEMS', 'WPMS'].includes(monitoringPointType) ? await uploadDocumentImages(formData, accessToken) : []
      const requestBody = buildMeasurementPointRequestBody(
        formFactory,
        monitoringPointType,
        formData,
        uploadedDocuments,
        measurementInstrumentRows,
        { existingDocuments: initialDocuments },
      )
      if (isEditMode) {
        requestBody.remarks = 'แก้ไขตามเจ้าหน้าที่แจ้ง'
      } else if (isAddParameterMode) {
        requestBody.remarks = 'ขอเพิ่มพารามิเตอร์'
      }

      const submitApiUrl = isEditMode
        ? getRequestFormApiUrl(requestId)
        : isAddParameterMode
          ? getParametersRequestApiUrl()
          : getMeasurementPointsRequestApiUrl()

      const result = await fetch(submitApiUrl, {
        method: isEditMode ? 'PUT' : 'POST',
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
        throw new Error(formatApiErrorMessage(response, `ส่งแบบฟอร์มไม่สำเร็จ (${result.status} ${result.statusText})`))
      }

      closeSubmitConfirm()
      await onSubmitted?.(response?.data ?? null)
      setSubmitSuccessOpen(true)
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
          key={`${mode}-${requestId ?? 'new'}-${initialRequest?.id ?? 'draft'}`}
          sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: { xs: 2, md: 3 }, bgcolor: 'background.default' }}
        >
          <Stack spacing={2}>
            {loading ? (
              <Typography variant="body2" color="text.secondary">
                กำลังโหลดข้อมูลคำขอเดิม...
              </Typography>
            ) : null}
            {loadError ? (
              <Typography variant="body2" color="error">
                {loadError}
              </Typography>
            ) : null}
            {isEditMode && latestRevisionMessage ? (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: 1,
                  borderColor: 'warning.main',
                  bgcolor: 'warning.50',
                  color: 'text.primary',
                }}
              >
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                  <WarningAmberIcon color="warning" fontSize="small" sx={{ mt: 0.25 }} />
                  <Stack spacing={0.75}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      รายละเอียดการแก้ไข
                    </Typography>
                    <Typography variant="body2">{latestRevisionMessage}</Typography>
                  </Stack>
                </Stack>
              </Paper>
            ) : null}
            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
              <Stack spacing={2}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  ข้อมูลทั่วไปของโรงงาน
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ReadOnlyField label="ชื่อโรงงาน" value={formFactory?.factoryName ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="เลขทะเบียนโรงงาน (เดิม)" value={formFactory?.oldRegistrationNo ?? formFactory?.factoryRegistrationNo ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="เลขทะเบียนโรงงาน (ใหม่)" value={formFactory?.newRegistrationNo ?? formFactory?.factoryId ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ReadOnlyField label="การประกอบกิจการ" value={formFactory?.businessActivity ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="ลำดับประเภทโรงงาน (หลัก)" value={formFactory?.industryMainOrder ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="ลำดับประเภทโรงงาน (รอง)" value={formFactory?.industrySubOrder ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      select
                      name="eia"
                      label="การประเมินผลกระทบสิ่งแวดล้อม"
                      size="small"
                      value={eiaAssessment}
                      onChange={(event) => setEiaAssessment(event.target.value)}
                      fullWidth
                    >
                      {eiaAssessmentOptions.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  {eiaAssessment === 'อื่นๆ' ? (
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField name="eiaOther" label="ระบุ" size="small" defaultValue={formFactory?.eiaOther ?? ''} fullWidth />
                    </Grid>
                  ) : null}
                  {eiaProjectOptions.includes(eiaAssessment) ? (
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField name="projectName" label="ชื่อโครงการ" size="small" defaultValue={formFactory?.projectName ?? ''} fullWidth />
                    </Grid>
                  ) : null}
                  <Grid size={{ xs: 12 }}>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <ReadOnlyField label="สถานที่ตั้งโรงงาน" value={formFactory?.address ?? ''} />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <TextField name="latitude" label="ละติจูด" size="small" defaultValue={formFactory?.latitude ?? ''} fullWidth />
                      </Grid>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <TextField name="longitude" label="ลองติจูด" size="small" defaultValue={formFactory?.longitude ?? ''} fullWidth />
                      </Grid>
                    </Grid>
                  </Grid>
                  {documentImageItems
                    .map((item, index) => ({ ...item, index }))
                    .filter((item) => factoryGeneralDocumentImageTitles.includes(item.title))
                    .map((item) => (
                      <Grid key={item.title} size={{ xs: 12, md: 3 }}>
                        <Stack spacing={1}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {item.title}
                          </Typography>
                          <UploadFileField
                            name={`documentImageFile-${item.index}`}
                            label={item.uploadLabel}
                            accept={item.accept}
                            currentFileName={initialDocuments.find((document) => documentTitleMatchesItem(document, item))?.fileName ?? ''}
                            multiple={!item.singleFile}
                            helperText={item.helperText ?? 'ขนาดไม่เกิน 5 Mb'}
                          />
                        </Stack>
                      </Grid>
                    ))}
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
                      <TextField name="contactName" label="ชื่อ-นามสกุล" size="small" defaultValue={contact.name ?? ''} fullWidth />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField name="contactPosition" label="ตำแหน่ง" size="small" defaultValue={contact.position ?? ''} fullWidth />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField name="contactPhone" label="เบอร์โทร" size="small" defaultValue={contact.phone ?? ''} fullWidth />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField name="contactEmail" label="อีเมล" size="small" defaultValue={contact.email ?? ''} fullWidth />
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
                  {officerEmails.map((email, index) => (
                    <TextField
                      key={`${email || 'empty-officer-email'}-${index}`}
                      name="officerNotificationEmail"
                      label="อีเมล"
                      size="small"
                      defaultValue={email}
                      slotProps={{
                        input: {
                          readOnly: true,
                        },
                      }}
                      fullWidth
                    />
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
                      const nextType = event.target.value
                      const nextPoint = {
                        id: selectedMonitoringPoint?.id ?? Date.now(),
                        type: nextType,
                      }
                      setMeasurementInstrumentRows([])
                      setRequestedParameters([])
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
                      <MonitoringPointDetails
                        point={point}
                        initialPoint={point.type === initialMonitoringPointType ? initialPoint : {}}
                        requestedParameters={requestedParameters}
                        onRequestedParametersChange={updateRequestedParameters}
                        isOperator={isOperator}
                      />
                    </Box>
                  ))}
                </Stack>
              </Paper>
            ) : null}

            {showMonitoringPointSection && monitoringPoints.length > 0
              ? monitoringPoints.map((point) =>
                  point.type === 'CEMS' || point.type === 'WPMS' ? (
                    <Box key={`${point.id}-${point.type}`} sx={{ display: point.id === selectedMonitoringPoint?.id ? 'block' : 'none' }}>
                      <Stack spacing={2}>
                        <DocumentsAndImagesSection
                          systemType={point.type}
                          initialDocuments={point.type === initialMonitoringPointType ? initialDocuments : []}
                        />
                        <MeasurementInstrumentSection
                          parameterOptions={requestedParameters}
                          rows={measurementInstrumentRows}
                          setRows={setMeasurementInstrumentRows}
                          initialInstruments={point.type === initialMonitoringPointType ? initialInstruments : {}}
                          isWpms={point.type === 'WPMS'}
                        />
                        <InformationProviderSection
                          currentUser={currentUser}
                          initialProvider={
                            point.type === initialMonitoringPointType
                              ? {
                                  name: initialRequest?.informationProviderName ?? initialPoint.details?.informationProviderName,
                                  position: initialRequest?.informationProviderPosition ?? initialPoint.details?.informationProviderPosition,
                                }
                              : {}
                          }
                          useLoginDefaults={!useInitialRequestValues}
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
          <Button variant="contained" disabled={loading || Boolean(loadError)} onClick={openSubmitConfirm}>
            ส่งแบบฟอร์มคำขอ
          </Button>
        </Stack>
      </Stack>
      <RequestDocumentDialog
        open={submitConfirmOpen}
        request={submitPreviewRequest}
        title="ยืนยันการส่งแบบฟอร์มคำขอ"
        onClose={closeSubmitConfirm}
        pdfPreviewUrl={submitPreviewPdfUrl}
        pdfPreviewLoading={submitPreviewPdfLoading}
        pdfPreviewError={submitPreviewPdfError}
        onExited={handleSubmitConfirmExited}
        footerContent={
          <Stack spacing={0.5} sx={{ alignItems: 'center', textAlign: 'center', mb: 1.5 }}>
            <Typography>กรุณาตรวจสอบความถูกต้องของข้อมูลในแบบฟอร์ม</Typography>
            <Typography color="text.secondary">
              เมื่อส่งแบบฟอร์มคำขอแล้วจะไม่สามารถแก้ไขได้ จนกว่าจะผ่านการพิจารณาจากเจ้าหน้าที่
            </Typography>
            {submitError ? (
              <Typography color="error" variant="body2" sx={{ whiteSpace: 'pre-line' }}>
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
              onClick={closeSubmitConfirm}
            >
              ยกเลิก
            </Button>
            <Button variant="contained" disabled={isSubmitting} onClick={submitRequest}>
              {isSubmitting ? 'กำลังส่ง' : 'ยืนยันส่งแบบฟอร์ม'}
            </Button>
          </Stack>
        }
      />
      <Snackbar
        open={submitSuccessOpen}
        autoHideDuration={3000}
        onClose={() => setSubmitSuccessOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSubmitSuccessOpen(false)}>
          {isEditMode ? 'แก้ไขแบบฟอร์มคำขอสำเร็จ' : 'บันทึกแบบฟอร์มคำขอสำเร็จ'}
        </Alert>
      </Snackbar>
    </Drawer>
  )
}

function getRequestColumns(
  isOperator,
  onOpenConnectionSettings,
  onOpenRequestDocument,
  onOpenRequestProcess,
  onOpenRequestEdit,
) {
  return [
    { field: 'factoryName', headerName: 'ชื่อโรงงาน/บริษัท', width: 240 },
    {
      field: 'factoryRegistration',
      headerName: 'เลขทะเบียนโรงงาน',
      width: 190,
      sortable: false,
      renderCell: (params) => (
        <Stack sx={{ justifyContent: 'center', minHeight: '100%' }}>
          <Typography variant="body2">{params.row.newRegistrationNo || '-'}</Typography>
        </Stack>
      ),
    },
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
            onOpenRequestEdit={onOpenRequestEdit}
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

function ConnectionRequestPage({ userType = '', roleCode = '', accessToken = '', currentUser = null }) {
  const [requestForm, setRequestForm] = useState(null)
  const [requestFormError, setRequestFormError] = useState('')
  const [requestDocumentOpen, setRequestDocumentOpen] = useState(false)
  const [requestDocument, setRequestDocument] = useState(null)
  const [requestDocumentMode, setRequestDocumentMode] = useState('view')
  const [requestDocumentLoading, setRequestDocumentLoading] = useState(false)
  const [requestDocumentApproving, setRequestDocumentApproving] = useState(false)
  const [requestDocumentError, setRequestDocumentError] = useState('')
  const [requestDocumentPdfUrl, setRequestDocumentPdfUrl] = useState('')
  const [requestDocumentPdfLoading, setRequestDocumentPdfLoading] = useState(false)
  const [requestDocumentPdfError, setRequestDocumentPdfError] = useState('')
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)
  const [verifyConnectionConfirmOpen, setVerifyConnectionConfirmOpen] = useState(false)
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false)
  const [revisionOfficerNote, setRevisionOfficerNote] = useState('')
  const [monitoringPointFactory, setMonitoringPointFactory] = useState(null)
  const [connectionSettingsContext, setConnectionSettingsContext] = useState(null)
  const [intentRequestFactory, setIntentRequestFactory] = useState(null)
  const [intentReason, setIntentReason] = useState('')
  const [operatorFactoryRows, setOperatorFactoryRows] = useState([])
  const [operatorFactoriesError, setOperatorFactoriesError] = useState('')
  const [requestTableRows, setRequestTableRows] = useState([])
  const [requestTableError, setRequestTableError] = useState('')
  const isOperator = userType === 'operator'
  const isAdmin = roleCode === 'admin'
  const canViewFactoryTable = isOperator || isAdmin
  const availableSubMenus = useMemo(
    () => {
      if (isOperator) {
        return subMenus.filter((menu) => menu.value !== 'statistics')
      }

      if (isAdmin) {
        return subMenus
      }

      return subMenus.filter((menu) => menu.value !== 'factories')
    },
    [isAdmin, isOperator],
  )
  const [selectedSubMenu, setSelectedSubMenu] = useState(() => (userType === 'operator' || roleCode === 'admin' ? 'factories' : 'requests'))
  const effectiveSubMenu = availableSubMenus.some((menu) => menu.value === selectedSubMenu)
    ? selectedSubMenu
    : availableSubMenus[0]?.value
  const openIntentDialog = useCallback((factory) => {
    setIntentRequestFactory(factory)
    setIntentReason('')
  }, [])
  const closeIntentDialog = useCallback(() => {
    setIntentRequestFactory(null)
    setIntentReason('')
  }, [])
  const submitIntentRequest = useCallback(() => {
    closeIntentDialog()
  }, [closeIntentDialog])
  const fetchFactoryRows = useCallback(async ({ signal } = {}) => {
    if (!canViewFactoryTable || !accessToken) {
      return []
    }

    const result = await fetch(isAdmin ? eligibleFactoriesApiUrl : operatorFactoriesApiUrl, {
      signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const payload = await result.json().catch(() => null)

    if (!result.ok) {
      throw new Error(payload?.message || `โหลดรายชื่อโรงงานไม่สำเร็จ (${result.status} ${result.statusText})`)
    }

    return Array.isArray(payload?.data) ? payload.data.map(mapOperatorFactoryRow) : []
  }, [accessToken, canViewFactoryTable, isAdmin])
  const fetchRequestTableRows = useCallback(async ({ signal } = {}) => {
    if (!accessToken) {
      return []
    }

    const result = await fetch(requestTableRowsApiUrl, {
      signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const payload = await result.json().catch(() => null)

    if (!result.ok) {
      throw new Error(payload?.message || `โหลดรายการคำขอไม่สำเร็จ (${result.status} ${result.statusText})`)
    }

    return Array.isArray(payload?.data) ? payload.data.map(mapRequestTableRow) : []
  }, [accessToken])
  const loadRequestTableRows = useCallback(async (options) => {
    const rows = await fetchRequestTableRows(options)
    setRequestTableRows(rows)
    setRequestTableError('')
    return rows
  }, [fetchRequestTableRows])
  const clearRequestDocumentPdf = useCallback(() => {
    setRequestDocumentPdfUrl('')
    setRequestDocumentPdfLoading(false)
    setRequestDocumentPdfError('')
  }, [])
  const generateRequestDocumentPdf = useCallback(async (request) => {
    setRequestDocumentPdfLoading(true)
    setRequestDocumentPdfError('')

    try {
      const pdfBytes = await createConnectionRequestPdf(request)
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const pdfUrl = URL.createObjectURL(blob)
      setRequestDocumentPdfUrl(pdfUrl)
    } catch (error) {
      setRequestDocumentPdfError(error instanceof Error ? error.message : 'สร้าง PDF preview ไม่สำเร็จ')
    } finally {
      setRequestDocumentPdfLoading(false)
    }
  }, [])
  useEffect(() => () => {
    if (requestDocumentPdfUrl) {
      URL.revokeObjectURL(requestDocumentPdfUrl)
    }
  }, [requestDocumentPdfUrl])
  const factoryColumns = useMemo(
    () =>
      getFactoryColumns(
        isOperator,
        (factory, formType) => setRequestForm({ factory, formType }),
        setMonitoringPointFactory,
        openIntentDialog,
        canViewFactoryTable,
      ),
    [canViewFactoryTable, isOperator, openIntentDialog],
  )
  const handleOpenRequestDocument = useCallback(async (row, mode = 'view') => {
    clearRequestDocumentPdf()
    setRequestDocument(row)
    setRequestDocumentMode(mode)
    setRequestDocumentError('')
    setRequestDocumentOpen(true)

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

    try {
      const result = await fetch(getRequestDetailApiUrl(row.id), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      const payload = await result.json().catch(() => null)

      if (!result.ok) {
        throw new Error(payload?.message || `โหลดรายละเอียดคำขอไม่สำเร็จ (${result.status} ${result.statusText})`)
      }

      const detailedRequest = mapRequestDetailRow(payload?.data ?? {}, row)
      setRequestDocument(detailedRequest)
      setRequestDocumentError('')
      setRequestDocumentLoading(false)
      await generateRequestDocumentPdf(detailedRequest)
    } catch (error) {
      setRequestDocumentError(error instanceof Error ? error.message : 'โหลดรายละเอียดคำขอไม่สำเร็จ')
      setRequestDocumentLoading(false)
    }
  }, [accessToken, clearRequestDocumentPdf, generateRequestDocumentPdf])
  const handleOpenEditRequestForm = useCallback((row) => {
    setRequestFormError('')

    if (!row?.id) {
      setRequestFormError('ไม่พบรหัสคำขอสำหรับแก้ไขแบบฟอร์ม')
      return
    }

    const editForm = {
      mode: 'edit',
      formType: 'เพิ่มจุดตรวจวัด',
      factory: row,
      requestId: row.id,
      row,
      loading: true,
      initialRequest: null,
    }

    setRequestForm(editForm)

    if (!accessToken) {
      setRequestForm((current) => (current?.requestId === row.id ? { ...current, loading: false } : current))
      setRequestFormError('กรุณาเข้าสู่ระบบเพื่อแก้ไขแบบฟอร์ม')
      return
    }

    fetch(getRequestDetailApiUrl(row.id), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(async (result) => {
        const payload = await result.json().catch(() => null)

        if (!result.ok) {
          throw new Error(payload?.message || `โหลดข้อมูลคำขอเดิมไม่สำเร็จ (${result.status} ${result.statusText})`)
        }

        const detailRequest = mapRequestDetailRow(payload?.data ?? {}, row)
        setRequestForm((current) =>
          current?.requestId === row.id
            ? {
                ...current,
                factory: getInitialRequestFactory(detailRequest, row),
                initialRequest: detailRequest,
                loading: false,
              }
            : current,
        )
      })
      .catch((error) => {
        setRequestForm((current) => (current?.requestId === row.id ? { ...current, loading: false } : current))
        setRequestFormError(error instanceof Error ? error.message : 'โหลดข้อมูลคำขอเดิมไม่สำเร็จ')
      })
  }, [accessToken])
  const handleOpenAddParameterForm = useCallback((point) => {
    setRequestFormError('')

    const stationId = point?.pointCode ?? point?.code ?? point?.stationId ?? ''

    if (!stationId) {
      setRequestFormError('ไม่พบรหัสจุดตรวจวัดสำหรับเพิ่มพารามิเตอร์')
      return
    }

    const formState = {
      mode: 'add-parameter',
      formType: 'เพิ่มพารามิเตอร์',
      factory: {
        ...(point?.factory ?? {}),
        factoryId: point?.factoryId ?? point?.factory?.factoryId ?? '',
      },
      point,
      loading: true,
      initialRequest: null,
    }

    setRequestForm(formState)

    if (!accessToken) {
      setRequestForm((current) =>
        current?.mode === 'add-parameter' && (current?.point?.pointCode ?? current?.point?.code) === stationId
          ? { ...current, loading: false }
          : current,
      )
      setRequestFormError('กรุณาเข้าสู่ระบบเพื่อเพิ่มพารามิเตอร์')
      return
    }

    fetch(getConnectedMeasurementPointParameterFormApiUrl(stationId), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(async (result) => {
        const payload = await result.json().catch(() => null)

        if (!result.ok) {
          throw new Error(payload?.error?.message || payload?.message || `โหลดข้อมูลสำหรับเพิ่มพารามิเตอร์ไม่สำเร็จ (${result.status} ${result.statusText})`)
        }

        const initialRequest = getParameterFormDefaultsFromPayload(payload, point)
        setRequestForm((current) =>
          current?.mode === 'add-parameter' && (current?.point?.pointCode ?? current?.point?.code) === stationId
            ? {
                ...current,
                factory: getInitialRequestFactory(initialRequest, current.factory),
                initialRequest,
                loading: false,
              }
            : current,
        )
      })
      .catch((error) => {
        setRequestForm((current) =>
          current?.mode === 'add-parameter' && (current?.point?.pointCode ?? current?.point?.code) === stationId
            ? { ...current, loading: false }
            : current,
        )
        setRequestFormError(error instanceof Error ? error.message : 'โหลดข้อมูลสำหรับเพิ่มพารามิเตอร์ไม่สำเร็จ')
      })
  }, [accessToken])
  const closeRequestDocumentDialog = useCallback(() => {
    setRequestDocumentOpen(false)
  }, [])
  const handleRequestDocumentExited = useCallback(() => {
    setRequestDocument(null)
    setRequestDocumentMode('view')
    setRequestDocumentError('')
    setRequestDocumentLoading(false)
    setRequestDocumentApproving(false)
    setApproveConfirmOpen(false)
    setVerifyConnectionConfirmOpen(false)
    setRevisionDialogOpen(false)
    setRevisionOfficerNote('')
    clearRequestDocumentPdf()
  }, [clearRequestDocumentPdf])
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

        await loadRequestTableRows()
        setRequestDocumentOpen(false)
        setApproveConfirmOpen(false)
      })
      .catch((error) => {
        setRequestDocumentError(error instanceof Error ? error.message : 'อนุมัติคำขอไม่สำเร็จ')
      })
      .finally(() => {
        setRequestDocumentApproving(false)
      })
  }, [accessToken, loadRequestTableRows, requestDocument])
  const closeVerifyConnectionConfirmDialog = useCallback(() => {
    if (requestDocumentApproving) {
      return
    }

    setVerifyConnectionConfirmOpen(false)
  }, [requestDocumentApproving])
  const verifyConnectionDocument = useCallback(() => {
    if (!requestDocument?.id) {
      setRequestDocumentError('ไม่พบรหัสคำขอสำหรับยืนยันการเชื่อมต่อ')
      return
    }

    if (!accessToken) {
      setRequestDocumentError('กรุณาเข้าสู่ระบบเจ้าหน้าที่เพื่อยืนยันการเชื่อมต่อ')
      return
    }

    setRequestDocumentApproving(true)
    setRequestDocumentError('')

    fetch(getVerifyConnectionApiUrl(requestDocument.id), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        note: 'ตรวจสอบแล้ว',
      }),
    })
      .then(async (result) => {
        const payload = await result.json().catch(() => null)

        if (!result.ok) {
          throw new Error(payload?.error?.message || payload?.message || `ยืนยันการเชื่อมต่อไม่สำเร็จ (${result.status} ${result.statusText})`)
        }

        await loadRequestTableRows()
        setRequestDocumentOpen(false)
        setVerifyConnectionConfirmOpen(false)
      })
      .catch((error) => {
        setRequestDocumentError(error instanceof Error ? error.message : 'ยืนยันการเชื่อมต่อไม่สำเร็จ')
      })
      .finally(() => {
        setRequestDocumentApproving(false)
      })
  }, [accessToken, loadRequestTableRows, requestDocument])
  const openRevisionDialog = useCallback(() => {
    setRevisionOfficerNote('')
    setRequestDocumentError('')
    setRevisionDialogOpen(true)
  }, [])
  const closeRevisionDialog = useCallback(() => {
    if (requestDocumentApproving) {
      return
    }

    setRevisionDialogOpen(false)
    setRevisionOfficerNote('')
  }, [requestDocumentApproving])
  const requestRevisionDocument = useCallback(() => {
    const officerNote = revisionOfficerNote.trim()
    const revisionAction = isConnectionConfirmed(requestDocument) ? 'RETURN_TO_WAITING_CONNECTION' : 'REQUEST_REVISION'

    if (!requestDocument?.id) {
      setRequestDocumentError('ไม่พบรหัสคำขอสำหรับแจ้งแก้ไข')
      return
    }

    if (!accessToken) {
      setRequestDocumentError('กรุณาเข้าสู่ระบบเจ้าหน้าที่เพื่อแจ้งแก้ไขคำขอ')
      return
    }

    if (!officerNote) {
      setRequestDocumentError('กรุณากรอกหมายเหตุเจ้าหน้าที่')
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
        action: revisionAction,
        revisionReason: officerNote,
        officerNote,
      }),
    })
      .then(async (result) => {
        const payload = await result.json().catch(() => null)

        if (!result.ok) {
          throw new Error(payload?.message || `แจ้งแก้ไขคำขอไม่สำเร็จ (${result.status} ${result.statusText})`)
        }

        await loadRequestTableRows()
        setRequestDocumentOpen(false)
        setRevisionDialogOpen(false)
        setRevisionOfficerNote('')
      })
      .catch((error) => {
        setRequestDocumentError(error instanceof Error ? error.message : 'แจ้งแก้ไขคำขอไม่สำเร็จ')
      })
      .finally(() => {
        setRequestDocumentApproving(false)
      })
  }, [accessToken, loadRequestTableRows, requestDocument, revisionOfficerNote])
  const handleOpenRequestDocumentView = useCallback((row) => {
    void handleOpenRequestDocument(row, 'view')
  }, [handleOpenRequestDocument])
  const handleOpenRequestDocumentProcess = useCallback((row) => {
    void handleOpenRequestDocument(row, 'process')
  }, [handleOpenRequestDocument])
  const requestColumns = useMemo(
    () =>
      getRequestColumns(
        isOperator,
        setConnectionSettingsContext,
        handleOpenRequestDocumentView,
        handleOpenRequestDocumentProcess,
        handleOpenEditRequestForm,
      ),
    [handleOpenEditRequestForm, handleOpenRequestDocumentProcess, handleOpenRequestDocumentView, isOperator],
  )
  useEffect(() => {
    if (!canViewFactoryTable || effectiveSubMenu !== 'factories') {
      return
    }

    if (!accessToken) {
      return
    }

    const controller = new AbortController()

    fetchFactoryRows({ signal: controller.signal })
      .then((rows) => {
        setOperatorFactoryRows(rows)
        setOperatorFactoriesError('')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setOperatorFactoryRows([])
          setOperatorFactoriesError(error instanceof Error ? error.message : 'โหลดรายชื่อโรงงานไม่สำเร็จ')
        }
      })

    return () => {
      controller.abort()
    }
  }, [accessToken, canViewFactoryTable, effectiveSubMenu, fetchFactoryRows])
  useEffect(() => {
    if (effectiveSubMenu !== 'requests') {
      return
    }

    if (!accessToken) {
      return
    }

    const controller = new AbortController()

    fetchRequestTableRows({ signal: controller.signal })
      .then((rows) => {
        setRequestTableRows(rows)
        setRequestTableError('')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setRequestTableRows([])
          setRequestTableError(error instanceof Error ? error.message : 'โหลดรายการคำขอไม่สำเร็จ')
        }
      })

    return () => {
      controller.abort()
    }
  }, [accessToken, effectiveSubMenu, fetchRequestTableRows])
  const table = useMemo(
    () =>
      effectiveSubMenu === 'factories'
        ? {
            title: 'รายชื่อโรงงาน',
            rows: accessToken ? operatorFactoryRows : [],
            columns: factoryColumns,
            loading: false,
          }
        : {
            title: 'รายการคำขอ',
            rows: accessToken ? requestTableRows : [],
            columns: requestColumns,
            loading: false,
          },
    [accessToken, effectiveSubMenu, factoryColumns, operatorFactoryRows, requestColumns, requestTableRows],
  )
  const isStatisticsSubMenu = effectiveSubMenu === 'statistics'
  const effectiveOperatorFactoriesError =
    canViewFactoryTable && effectiveSubMenu === 'factories' && !accessToken
      ? 'กรุณาเข้าสู่ระบบเพื่อดูรายชื่อโรงงาน'
      : operatorFactoriesError
  const effectiveRequestTableError =
    effectiveSubMenu === 'requests' && !accessToken
      ? 'กรุณาเข้าสู่ระบบเพื่อดูรายการคำขอ'
      : requestTableError
  const handleRequestSubmitted = useCallback(async (request) => {
    setSelectedSubMenu('requests')
    try {
      await loadRequestTableRows()
    } catch (error) {
      setRequestTableError(error instanceof Error ? error.message : 'โหลดรายการคำขอไม่สำเร็จ')

      if (request) {
        setRequestTableRows((rows) => {
          const mappedRequest = mapRequestTableRow(request)
          const editRequestId = requestForm?.mode === 'edit' ? requestForm.requestId : null

          if (editRequestId) {
            return rows.map((row) => (row.id === editRequestId ? { ...row, ...mappedRequest } : row))
          }

          return [mappedRequest, ...rows]
        })
      }
    }
  }, [loadRequestTableRows, requestForm])
  const isReturningConnectionConfig = isConnectionConfirmed(requestDocument)
  const revisionDialogTitle = isReturningConnectionConfig ? 'แจ้งแก้ไขการเชื่อมต่อ' : 'แจ้งแก้ไขแบบฟอร์ม'
  const revisionDialogDescription = isReturningConnectionConfig
    ? 'ระบุหมายเหตุเจ้าหน้าที่สำหรับส่งกลับให้ผู้ประกอบการแก้ไขข้อมูลการเชื่อมต่อ'
    : 'ระบุหมายเหตุเจ้าหน้าที่สำหรับแจ้งให้ผู้ประกอบการแก้ไขแบบฟอร์ม'
  const pageSizeOptions = [25, 50, 100]
  const initialPageSize = 25

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
              <Tab
                key={menu.value}
                value={menu.value}
                label={
                  menu.badgeContent ? (
                    <Badge
                      badgeContent={menu.badgeContent}
                      color="error"
                      sx={{
                        pr: 2,
                        '& .MuiBadge-badge': {
                          right: 2,
                          top: 2,
                        },
                      }}
                    >
                      <Box component="span">{menu.label}</Box>
                    </Badge>
                  ) : (
                    menu.label
                  )
                }
              />
            ))}
          </Tabs>
        </Stack>
      </Paper>

      {isStatisticsSubMenu ? (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <OfficerStatisticsPanel title="สถิติข้อมูลคำขอเชื่อมต่อ" />
        </Box>
      ) : (
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
            pageSizeOptions={pageSizeOptions}
            initialState={{
              pagination: {
                paginationModel: { page: 0, pageSize: initialPageSize },
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
      )}
      <Dialog open={Boolean(intentRequestFactory)} onClose={closeIntentDialog} fullWidth maxWidth="sm">
        <DialogTitle>แจ้งความประสงค์</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {intentRequestFactory?.factoryName ?? '-'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {intentRequestFactory?.newRegistrationNo ?? intentRequestFactory?.factoryId ?? '-'}
              </Typography>
            </Box>
            <TextField
              label="เหตุผล"
              value={intentReason}
              onChange={(event) => setIntentReason(event.target.value)}
              multiline
              minRows={3}
              fullWidth
              autoFocus
              placeholder="ระบุเหตุผลที่ต้องการแจ้งความประสงค์"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'flex-end', px: 3, py: 2 }}>
          <Button color="inherit" onClick={closeIntentDialog}>
            ยกเลิก
          </Button>
          <Button variant="contained" onClick={submitIntentRequest}>
            ส่งข้อความ
          </Button>
        </DialogActions>
      </Dialog>
      <RequestFormBottomSheet
        key={`${requestForm?.mode ?? 'create'}-${requestForm?.requestId ?? requestForm?.point?.pointCode ?? requestForm?.point?.code ?? 'new'}-${requestForm?.initialRequest?.id ?? 'draft'}`}
        open={Boolean(requestForm)}
        formType={requestForm?.formType ?? ''}
        factory={requestForm?.factory}
        accessToken={accessToken}
        currentUser={currentUser}
        isOperator={isOperator}
        mode={requestForm?.mode ?? 'create'}
        requestId={requestForm?.requestId}
        initialRequest={requestForm?.initialRequest}
        loading={requestForm?.loading}
        loadError={requestFormError}
        onSubmitted={handleRequestSubmitted}
        onClose={() => {
          setRequestForm(null)
          setRequestFormError('')
        }}
      />
      <MonitoringPointListDialog
        open={Boolean(monitoringPointFactory)}
        factory={monitoringPointFactory}
        useOperatorActions={canViewFactoryTable}
        accessToken={accessToken}
        onOpenAddParameter={handleOpenAddParameterForm}
        onOpenConnectionSettings={setConnectionSettingsContext}
        onClose={() => setMonitoringPointFactory(null)}
      />
      <RequestDocumentDialog
        open={requestDocumentOpen}
        request={requestDocument}
        mode={requestDocumentMode}
        loading={requestDocumentLoading}
        error={requestDocumentError}
        onClose={closeRequestDocumentDialog}
        pdfPreviewUrl={requestDocumentPdfUrl}
        pdfPreviewLoading={requestDocumentPdfLoading}
        pdfPreviewError={requestDocumentPdfError}
        onExited={handleRequestDocumentExited}
        approving={requestDocumentApproving}
        onApprove={() => setApproveConfirmOpen(true)}
        onVerifyConnection={() => setVerifyConnectionConfirmOpen(true)}
        onRequestRevision={openRevisionDialog}
      />
      <Dialog
        open={approveConfirmOpen}
        onClose={() => {
          if (!requestDocumentApproving) {
            setApproveConfirmOpen(false)
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>ยืนยันการอนุมัติ</DialogTitle>
        <DialogContent dividers>
          <Typography>อนุมัติแบบฟอร์มนี้และออกรหัสจุดตรวจวัด</Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center' }}>
          <Button color="inherit" disabled={requestDocumentApproving} onClick={() => setApproveConfirmOpen(false)}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            disabled={requestDocumentApproving}
            onClick={approveRequestDocument}
          >
            {requestDocumentApproving ? 'กำลังอนุมัติ' : 'ยืนยันอนุมัติ'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={verifyConnectionConfirmOpen} onClose={closeVerifyConnectionConfirmDialog} fullWidth maxWidth="sm">
        <DialogTitle>ยืนยันการเชื่อมต่อ</DialogTitle>
        <DialogContent dividers>
          <Typography>เมื่อยืนยันการเชื่อมต่อ จุดตรวจวัดนี้จะแสดงผลในระบบ D-POMS</Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center' }}>
          <Button color="inherit" disabled={requestDocumentApproving} onClick={closeVerifyConnectionConfirmDialog}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            disabled={requestDocumentApproving}
            onClick={verifyConnectionDocument}
          >
            {requestDocumentApproving ? 'กำลังยืนยัน' : 'ยืนยันการเชื่อมต่อ'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={revisionDialogOpen} onClose={closeRevisionDialog} fullWidth maxWidth="sm">
        <DialogTitle>{revisionDialogTitle}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {revisionDialogDescription}
            </Typography>
            <TextField
              label="รายละเอียด"
              value={revisionOfficerNote}
              onChange={(event) => setRevisionOfficerNote(event.target.value)}
              multiline
              minRows={4}
              fullWidth
              autoFocus
            />
            {requestDocumentError ? (
              <Typography color="error" variant="body2">
                {requestDocumentError}
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center' }}>
          <Button color="inherit" disabled={requestDocumentApproving} onClick={closeRevisionDialog}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            disabled={requestDocumentApproving}
            onClick={requestRevisionDocument}
          >
            {requestDocumentApproving ? 'กำลังแจ้งแก้ไข' : 'ยืนยันแจ้งแก้ไข'}
          </Button>
        </DialogActions>
      </Dialog>
      <ConnectionSettingsDialog
        open={Boolean(connectionSettingsContext)}
        context={connectionSettingsContext}
        accessToken={accessToken}
        onSaved={() =>
          loadRequestTableRows().catch((error) => {
            setRequestTableError(error instanceof Error ? error.message : 'โหลดรายการคำขอไม่สำเร็จ')
          })
        }
        onClose={() => setConnectionSettingsContext(null)}
      />
    </Stack>
  )
}

export default ConnectionRequestPage
