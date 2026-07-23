import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  OutlinedInput,
  Paper,
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
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import HistoryIcon from '@mui/icons-material/History'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { DataGrid } from '@mui/x-data-grid'
import { DatePicker, DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs from 'dayjs'
import buddhistEra from 'dayjs/plugin/buddhistEra'
import 'dayjs/locale/th'
import OfficerStatisticsPanel from '../components/OfficerStatisticsPanel'
import kwpEmissionMeasurementMethodOptionItems from '../option/kwpEmissionMeasurementMethodOptions.json'

dayjs.extend(buddhistEra)
dayjs.locale('th')

const appBarHeight = {
  xs: 64,
  md: 72,
}

const kwpFormReportsApiBaseUrl = import.meta.env.DEV
  ? '/api-proxy/v1/kwp-form-reports'
  : 'https://d-poms.diw.go.th/api/v1/kwp-form-reports'

const kwpFormSubmissionsApiBaseUrl = import.meta.env.DEV
  ? '/api-proxy/v1/kwp-form-submissions'
  : 'https://d-poms.diw.go.th/api/v1/kwp-form-submissions'

const connectedMeasurementPointsApiBaseUrl = import.meta.env.DEV
  ? '/api-proxy/v1/connected-measurement-points'
  : 'https://d-poms.diw.go.th/api/v1/connected-measurement-points'

const operatorSubMenus = [
  { value: 'factories', label: 'รายชื่อโรงงาน' },
  { value: 'requests', label: 'รายการคำขอ' },
]

const officerSubMenus = [
  { value: 'requests', label: 'รายการคำขอ' },
  { value: 'statistics', label: 'สถิติข้อมูล' },
]

async function readKwpApiResponse(result, fallbackMessage) {
  const rawText = await result.text()
  let response

  try {
    response = rawText ? JSON.parse(rawText) : null
  } catch {
    response = rawText
  }

  if (!result.ok || response?.success === false) {
    const message =
      response?.error?.message ??
      response?.message ??
      `${fallbackMessage} (${result.status} ${result.statusText})`
    throw new Error(message)
  }

  return response
}

function normalizeMonitoringPointDetailRows(rows) {
  return Array.isArray(rows)
    ? rows.map((row, index) => {
        const parameterDetails = Array.isArray(row.parameterDetails) ? row.parameterDetails.filter(Boolean) : []
        const details = row.details && typeof row.details === 'object' ? row.details : {}

        return {
          ...row,
          details,
          connectedPointId: row.connectedPointId ?? row.id ?? null,
          id: row.pointCode ?? row.stationId ?? row.pointName ?? `monitoring-point-detail-${index + 1}`,
          code: row.pointCode ?? '',
          name: row.pointName ?? '',
          type: row.pointType ?? '',
          parameters: parameterDetails.join(', '),
          parameterDetails,
          primaryFuel: row.primaryFuel ?? row.mainFuel ?? row.fuelType ?? '',
          secondaryFuel: row.secondaryFuel ?? row.subFuel ?? row.backupFuel ?? '',
        }
      })
    : []
}

function getMonitoringPointFactoryId(row) {
  return row?.factoryId ?? row?.newRegistrationNo ?? row?.factoryRegistration ?? row?.id ?? ''
}

function getFactoryIndustryMainOrder(factory) {
  return factory?.industryMainOrder ?? ''
}

function normalizeKwpFactoryRows(rows) {
  return Array.isArray(rows)
    ? rows.map((row, index) => ({
        ...row,
        id: row.id ?? row.factoryId ?? row.newRegistrationNo ?? `factory-${index + 1}`,
        factoryName: row.factoryName ?? '',
        newRegistrationNo: row.newRegistrationNo ?? row.factoryId ?? '',
        oldRegistrationNo: row.oldRegistrationNo ?? '',
        industryType: row.industryType ?? '',
        industryMainOrder: row.industryMainOrder ?? '',
        businessActivity: row.businessActivity ?? '',
        province: row.province ?? '',
        monitoringPointCount: Number(row.monitoringPointCount ?? 0),
      }))
    : []
}

function normalizeKwpRequestRows(rows) {
  return Array.isArray(rows)
    ? rows.map((row, index) => ({
        ...row,
        id: row.id ?? row.requestNo ?? `request-${index + 1}`,
        factoryName: row.factoryName ?? '',
        factoryRegistration: row.factoryRegistration ?? row.factoryId ?? '',
        industryType: row.industryType ?? '',
        industryMainOrder: row.industryMainOrder ?? '',
        businessActivity: row.businessActivity ?? '',
        factoryAddress: row.factoryAddress ?? '',
        province: row.province ?? '',
        type: row.type ?? '',
        monitoringPointCode: row.monitoringPointCode ?? '',
        monitoringPointName: row.monitoringPointName ?? '',
        requestNo: row.requestNo ?? '',
        form: row.form ?? row.formType ?? '',
        submittedDate: row.submittedDate ?? '-',
        reviewedDate: row.reviewedDate ?? '-',
        status: row.status ?? '',
        statusCode: row.statusCode ?? '',
        statusLabel: row.statusLabel ?? '',
        statusHistory: Array.isArray(row.statusHistory) ? row.statusHistory : [],
      }))
    : []
}

const kwpFormOptions = [
  {
    code: 'กวภ.01',
    title: 'แบบแจ้งเหตุขัดข้องของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ',
    description: 'เพื่อรายงานมลพิษอากาศจากปล่องโรงงานหรือแจ้งหยุดหน่วยการผลิต',
  },
  {
    code: 'กวภ.02',
    title: 'แบบรายงานผลการตรวจวัดมลพิษอากาศจากปล่องระบาย',
    description: 'กรณีเครื่องมือหรือเครื่องอุปกรณ์พิเศษมีเหตุขัดข้องและไม่สามารถรายงานผลการตรวจวัดได้ตั้งแต่ 15 วันขึ้นไป',
  },
  {
    code: 'กวภ.03',
    title: 'แบบแจ้งเหตุขัดข้องหรือหยุดส่งข้อมูลการตรวจวัดมลพิษทางนํ้าแบบอัตโนมัติอย่างต่อเนื่อง (WPMS)',
    description: '',
  },
  {
    code: 'กวภ.04',
    title: 'แบบรายงานผลการตรวจวัดมลพิษอากาศจากปล่องระบาย',
    description: 'ตามประกาศฯข้อ =4(1) (2) 11(3) และ 16',
  },
  {
    code: 'กวภ.05',
    title: 'แบบรายงานผลการสอบเทียบหรือทวนสอบระบบตรวจวัดคุณภาพอากาศแบบอัตโนมัติอย่างต่อเนื่อง (CEMS)',
    description: '',
  },
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

const wpmsInstrumentOptions = [
  'ค่าบีโอดี (BOD)',
  'ค่าซีโอดี (COD)',
  'ค่าบีโอดี (BOD) และ ค่าซีโอดี (COD)',
]

const wpmsParameterOptions = ['BOD', 'COD', 'flow', 'watt']
const wpmsIssueReasonOptions = [
  'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง',
  'ไม่มีการระบายน้ำทิ้งออกนอกโรงงาน',
  'ระบบรับส่งข้อมูล ระบบไฟฟ้า อินเทอร์เน็ต ขัดข้อง',
]
const kwpEmissionMeasurementMethodOptions = kwpEmissionMeasurementMethodOptionItems.map((option) => ({
  label: option.label ?? option.value ?? '',
  value: option.value ?? option.label ?? '',
  parameterNames: Array.isArray(option.parameterNames) ? option.parameterNames : [],
  parameterLabels: Array.isArray(option.parameterLabels) ? option.parameterLabels : [],
}))
const calibrationResultOptions = ['ผ่าน', 'ไม่ผ่าน']

function firstDefinedValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '') ?? ''
}

function uniqueTextValues(values) {
  const source = Array.isArray(values) ? values : [values]
  return [...new Set(source.map((value) => String(value ?? '').trim()).filter(Boolean))]
}

function normalizeParameterKey(value) {
  return String(value ?? '')
    .replace(/\([^)]*\)/g, '')
    .trim()
    .toLowerCase()
}

function getEmissionMeasurementMethodOptions(pollutant) {
  const selectedLabel = String(pollutant ?? '').trim()
  const selectedName = normalizeParameterKey(selectedLabel)

  if (!selectedLabel) {
    return []
  }

  return kwpEmissionMeasurementMethodOptions.filter((option) => {
    const labels = option.parameterLabels.map(normalizeParameterKey)
    const names = option.parameterNames.map(normalizeParameterKey)

    return labels.includes(selectedName) || names.includes(selectedName)
  })
}

function getPointDetailsValue(point, ...fieldNames) {
  const details = point?.details && typeof point.details === 'object' ? point.details : {}

  return firstDefinedValue(...fieldNames.flatMap((fieldName) => [details[fieldName], point?.[fieldName]]))
}

function formatCoordinatePair(latitude, longitude) {
  const safeLatitude = firstDefinedValue(latitude)
  const safeLongitude = firstDefinedValue(longitude)

  return safeLatitude && safeLongitude ? `${safeLatitude}, ${safeLongitude}` : ''
}

function buildKwp03InitialFormValues(point) {
  const failedParameters = uniqueTextValues(point?.parameterDetails ?? [])
  const instruments = uniqueTextValues(getPointDetailsValue(point, 'instruments'))
  const dischargePoint = firstDefinedValue(
    getPointDetailsValue(
      point,
      'dischargePoint',
      'dischargePointCoordinate',
      'wastewaterDischargePoint',
      'dischargeLocation',
    ),
    formatCoordinatePair(
      getPointDetailsValue(point, 'dischargeLatitude', 'latitude'),
      getPointDetailsValue(point, 'dischargeLongitude', 'longitude'),
    ),
  )

  return {
    defaults: {
      wastewaterSource: getPointDetailsValue(point, 'wastewaterSource', 'wasteWaterSource'),
      receivingSource: getPointDetailsValue(point, 'receivingSource', 'dischargeReceivingSource', 'receiverSource'),
      treatmentSystemType: getPointDetailsValue(point, 'treatmentSystemType', 'treatmentSystem', 'wastewaterTreatmentSystem'),
      dischargePoint,
      averageDischarge: getPointDetailsValue(point, 'averageDischarge', 'averageWastewaterDischarge', 'avgDischarge'),
      minimumDischarge: getPointDetailsValue(point, 'minimumDischarge', 'minWastewaterDischarge', 'minDischarge'),
      maximumDischarge: getPointDetailsValue(point, 'maximumDischarge', 'maxWastewaterDischarge', 'maxDischarge'),
    },
    initialState: {
      wpmsInstrument: instruments[0] ?? getPointDetailsValue(point, 'instrument', 'instrumentName', 'monitoringInstrument'),
      wpmsFailedParameters: failedParameters,
    },
  }
}

function buildKwpCemsInitialFormValues(point) {
  return {
    defaults: {
      productionStack: getPointDetailsValue(point, 'productionStack', 'productionUnitType'),
      combustionSystem: getPointDetailsValue(point, 'combustionSystem', 'combustionControlSystem'),
      productionCapacity: getPointDetailsValue(point, 'productionCapacity'),
      productionCapacityUnit: getPointDetailsValue(point, 'productionCapacityUnit'),
      cemsModel: getPointDetailsValue(point, 'cemsModel'),
    },
  }
}

function getKwpFormInitialValues(formCode, point) {
  if (formCode === 'กวภ.03') {
    return buildKwp03InitialFormValues(point)
  }

  if (['กวภ.01', 'กวภ.02', 'กวภ.04', 'กวภ.05'].includes(formCode)) {
    return buildKwpCemsInitialFormValues(point)
  }

  return {}
}

function getMonitoringPointSystemType(point) {
  const candidates = [
    point?.systemType,
    point?.measurementSystemType,
    point?.requestType,
    point?.type,
    point?.pointType,
  ]
    .map((value) => String(value ?? '').trim().toUpperCase())
    .filter(Boolean)

  if (candidates.some((value) => ['WPMS', 'WASTEWATER', 'WATER'].includes(value))) {
    return 'WPMS'
  }

  if (candidates.some((value) => ['CEMS', 'STACK'].includes(value))) {
    return 'CEMS'
  }

  return ''
}

function isKwpFormOptionDisabledForPoint(formCode, point) {
  const systemType = getMonitoringPointSystemType(point)

  if (systemType === 'WPMS') {
    return formCode !== 'กวภ.03'
  }

  if (systemType === 'CEMS') {
    return formCode === 'กวภ.03'
  }

  return false
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

function FactoryActions({ row, onOpenMonitoringPoints }) {
  return (
    <Stack direction="row" spacing={1} sx={tableActionStackSx}>
      <Button size="small" variant="outlined" onClick={() => onOpenMonitoringPoints?.(row)}>
        รายละเอียดจุดตรวจวัด
      </Button>
    </Stack>
  )
}

function RequestActions({ row, isOperator, onOpenDocument }) {
  const rowStatuses = [row.status, row.statusCode, row.statusLabel].filter(Boolean)
  const cannotProcess = rowStatuses.some((status) => (
    ['ผ่านการพิจารณา', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)
  ))
  const canOperatorModify = rowStatuses.some((status) => ['รอโรงงานแก้ไข', 'REVISION_REQUESTED'].includes(status))

  if (isOperator) {
    return (
      <Stack direction="row" spacing={1} sx={tableActionStackSx}>
        <Button size="small" variant="outlined" onClick={() => onOpenDocument?.(row, 'view')}>
          เปิดดู
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!canOperatorModify}
          onClick={() => onOpenDocument?.(row, 'edit')}
        >
          แก้ไข
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="error"
          disabled={!canOperatorModify}
          onClick={() => onOpenDocument?.(row, 'cancel')}
        >
          ยกเลิก
        </Button>
      </Stack>
    )
  }

  return (
    <Stack direction="row" spacing={1} sx={tableActionStackSx}>
      <Button size="small" variant="outlined" onClick={() => onOpenDocument?.(row, 'view')}>
        เปิดดู
      </Button>
      <Button
        size="small"
        variant="contained"
        disabled={cannotProcess}
        onClick={() => onOpenDocument?.(row, 'review')}
      >
        ดำเนินการ
      </Button>
    </Stack>
  )
}

function getKwpWorkflowStatusValues(source = {}) {
  const safeSource = source ?? {}
  return [safeSource.statusCode, safeSource.status, safeSource.statusLabel].filter(Boolean)
}

function hasKwpWorkflowStatus(source, statuses) {
  const statusSet = new Set(statuses)
  return getKwpWorkflowStatusValues(source).some((status) => statusSet.has(status))
}

const kwpStatusChipStyles = {
  blue: {
    bgcolor: '#2563eb',
    borderColor: '#2563eb',
    color: '#ffffff',
  },
  orange: {
    bgcolor: '#f97316',
    borderColor: '#f97316',
    color: '#ffffff',
  },
  purple: {
    bgcolor: '#7c3aed',
    borderColor: '#7c3aed',
    color: '#ffffff',
  },
  green: {
    bgcolor: '#16a34a',
    borderColor: '#16a34a',
    color: '#ffffff',
  },
  red: {
    bgcolor: '#dc2626',
    borderColor: '#dc2626',
    color: '#ffffff',
  },
}

const kwpStatusDisplayLabels = {
  DRAFT: 'ร่าง',
  SUBMITTED: 'รอพิจารณา',
  UNDER_REVIEW: 'อยู่ระหว่างพิจารณา',
  REVISION_REQUESTED: 'รอโรงงานแก้ไข',
  APPROVED: 'ผ่านการพิจารณา',
  REJECTED: 'ไม่ผ่านการพิจารณา',
  CANCELLED: 'ยกเลิก',
  CANCELED: 'ยกเลิก',
}

function getKwpStatusChipStyle(value) {
  const normalizedValue = String(value ?? '').trim()

  if (
    [
      'รอพิจารณา',
      'SUBMITTED',
      'แก้ไขแล้ว/รอพิจารณา',
      'อยู่ระหว่างพิจารณา',
      'UNDER_REVIEW',
    ].includes(normalizedValue)
  ) {
    return kwpStatusChipStyles.blue
  }

  if (['รอโรงงานแก้ไข', 'REVISION_REQUESTED'].includes(normalizedValue)) {
    return kwpStatusChipStyles.orange
  }

  if (['ผ่านการพิจารณา', 'APPROVED'].includes(normalizedValue)) {
    return kwpStatusChipStyles.green
  }

  if (['ไม่ผ่านการพิจารณา', 'REJECTED', 'ยกเลิก', 'CANCELLED', 'CANCELED'].includes(normalizedValue)) {
    return kwpStatusChipStyles.red
  }

  if (['ร่าง', 'DRAFT'].includes(normalizedValue)) {
    return null
  }

  return null
}

function getKwpStatusChipDisplayValue(row = {}) {
  const displayValue = row.statusLabel || row.status || row.statusCode || ''
  return kwpStatusDisplayLabels[displayValue] ?? displayValue
}

function getKwpStatusChipStyleValue(row = {}) {
  return row.statusCode || row.status || row.statusLabel || ''
}

function KwpStatusChip({ row = {} }) {
  const displayValue = getKwpStatusChipDisplayValue(row)
  const chipStyle = getKwpStatusChipStyle(getKwpStatusChipStyleValue(row)) ?? getKwpStatusChipStyle(displayValue)

  return (
    <Chip
      label={displayValue || '-'}
      size="small"
      variant={chipStyle ? 'filled' : 'outlined'}
      sx={chipStyle ? { ...chipStyle, fontWeight: 500 } : undefined}
    />
  )
}

function FormSelectionMenu({ factory, point, onSelectForm }) {
  const [anchorEl, setAnchorEl] = useState(null)
  const isOpen = Boolean(anchorEl)

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        endIcon={<KeyboardArrowDownIcon />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        เลือกแบบฟอร์ม
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={() => setAnchorEl(null)}
        slotProps={{
          paper: {
            sx: { maxWidth: 520 },
          },
        }}
      >
        {kwpFormOptions.map((option) => {
          const fullTitle = `${option.code} ${option.title}`
          const initialValues = getKwpFormInitialValues(option.code, point)
          const isDisabled = isKwpFormOptionDisabledForPoint(option.code, point)

          return (
            <MenuItem
              key={option.code}
              disabled={isDisabled}
              onClick={() => {
                if (isDisabled) {
                  return
                }

                onSelectForm?.({
                  title: fullTitle,
                  code: option.code,
                  titleText: option.title,
                  description: option.description,
                  factory,
                  point,
                  ...initialValues,
                })
                setAnchorEl(null)
              }}
              sx={{ alignItems: 'flex-start', whiteSpace: 'normal', py: 1.25 }}
            >
              <Stack spacing={0.25}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {option.code}
                </Typography>
                <Typography variant="body2">
                  {option.title}
                </Typography>
                {option.description ? (
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                    {option.description}
                  </Typography>
                ) : null}
              </Stack>
            </MenuItem>
          )
        })}
      </Menu>
    </>
  )
}

function MonitoringPointDialog({ context, rows, loading, error, open, onClose, onSelectForm }) {
  const factoryTitle = context?.factoryName
    ? `รายการจุดตรวจวัด - ${context.factoryName}${context.monitoringPointCount ? ` (${context.monitoringPointCount} จุด)` : ''}`
    : 'รายการจุดตรวจวัด'

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          pr: 1.5,
        }}
      >
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
          {factoryTitle}
        </Typography>
        <IconButton aria-label="ปิด" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <TableContainer sx={{ border: 1, borderColor: 'divider', overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 1040, ...borderedTableSx }}>
            <TableHead>
              <TableRow>
                {[
                  'รหัสจุดตรวจวัด',
                  'ชื่อจุดตรวจวัด',
                  'ประเภทจุดตรวจวัด',
                  'รายละเอียดพารามิเตอร์',
                  'จัดการ',
                ].map((column) => (
                  <TableCell key={column} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>
                    {column}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary">
                      กำลังโหลดข้อมูลจุดตรวจวัด...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Alert severity="error">{error}</Alert>
                  </TableCell>
                </TableRow>
              ) : rows.length > 0 ? (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.parameters}</TableCell>
                    <TableCell>
                      <FormSelectionMenu factory={context} point={row} onSelectForm={onSelectForm} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
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
  )
}

function ReadOnlyField({ label, value = '', multiline = false, name }) {
  return (
    <TextField
      name={name}
      label={label}
      value={value}
      size="small"
      fullWidth
      multiline={multiline}
      minRows={multiline ? 2 : undefined}
      slotProps={{
        input: {
          readOnly: true,
        },
      }}
    />
  )
}

function SectionPaper({ title, children }) {
  return (
    <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {children}
      </Stack>
    </Paper>
  )
}

function OptionMultiSelect({ label, value, onChange, options }) {
  return (
    <FormControl size="small" fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select
        multiple
        value={value}
        label={label}
        input={<OutlinedInput label={label} />}
        onChange={(event) => {
          const selectedValue = event.target.value
          onChange(typeof selectedValue === 'string' ? selectedValue.split(',') : selectedValue)
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

function ParameterMultiSelect({ label, value, onChange, options = cemsParameterOptions }) {
  return <OptionMultiSelect label={label} value={value} onChange={onChange} options={options} />
}

function OptionSelect({ label, value, onChange, options }) {
  return (
    <TextField
      select
      label={label}
      size="small"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      fullWidth
    >
      {options.map((option) => (
        <MenuItem key={option} value={option}>
          {option}
        </MenuItem>
      ))}
    </TextField>
  )
}

function normalizeHourDateTime(value) {
  return value && dayjs(value).isValid() ? dayjs(value).minute(0).second(0).millisecond(0) : null
}

function getHourDuration(startDate, endDate) {
  const start = normalizeHourDateTime(startDate)
  const end = normalizeHourDateTime(endDate)

  if (!start || !end) {
    return ''
  }

  const diffHours = end.diff(start, 'hour')
  if (diffHours < 0) {
    return ''
  }

  const days = Math.floor(diffHours / 24)
  const hours = diffHours % 24

  if (days > 0 && hours > 0) {
    return `${days} วัน ${hours} ชั่วโมง`
  }

  if (days > 0) {
    return `${days} วัน`
  }

  return `${hours} ชั่วโมง`
}

function formatDurationHours(totalHours) {
  const numericHours = Number(totalHours)

  if (!Number.isFinite(numericHours) || numericHours < 0) {
    return ''
  }

  const days = Math.floor(numericHours / 24)
  const hours = numericHours % 24

  if (days > 0 && hours > 0) {
    return `${days} วัน ${hours} ชั่วโมง`
  }

  if (days > 0) {
    return `${days} วัน`
  }

  return `${hours} ชั่วโมง`
}

function formatKwp01DurationValue(issueReport = {}) {
  if (issueReport.totalDuration || issueReport.totalDurationText) {
    return issueReport.totalDuration ?? issueReport.totalDurationText
  }

  if (issueReport.totalHours !== null && issueReport.totalHours !== undefined) {
    return formatDurationHours(issueReport.totalHours)
  }

  if (issueReport.totalDays !== null && issueReport.totalDays !== undefined && issueReport.totalDays !== '') {
    return `${issueReport.totalDays} วัน`
  }

  return ''
}

function handleHourDateTimeChange(onChange) {
  return (value) => onChange(normalizeHourDateTime(value))
}

function Kwp01Form({
  factory,
  point,
  defaults = {},
  problemDate,
  expectedDoneDate,
  unreportedParameters,
  onProblemDateChange,
  onExpectedDoneDateChange,
  onUnreportedParametersChange,
}) {
  const [combustionSystem, setCombustionSystem] = useState(() => defaults.combustionSystem ?? '')
  const [issueReason, setIssueReason] = useState(() => defaults.issueReason ?? '')
  const totalDuration = getHourDuration(problemDate, expectedDoneDate)
  const unavailableParameterOptions = point?.parameterDetails ?? []
  const primaryFuel = point?.primaryFuel ?? ''
  const secondaryFuel = point?.secondaryFuel ?? ''

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="th">
      <Stack spacing={2}>
        <SectionPaper title="ข้อมูลทั่วไปของโรงงาน">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReadOnlyField label="ชื่อโรงงาน" value={factory?.factoryName ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ทะเบียนโรงงานเลขที่" value={factory?.newRegistrationNo ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ลำดับประเภทโรงงาน" value={getFactoryIndustryMainOrder(factory)} />
            </Grid>
            <Grid size={{ xs: 12, md: 12 }}>
              <ReadOnlyField label="สถานที่ตั้งโรงงาน" value={factory?.address ?? ''} multiline />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactName" label="รายชื่อผู้ติดต่อ" size="small" defaultValue={defaults.contactName ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactPhone" label="เบอร์โทรศัพท์" size="small" defaultValue={defaults.contactPhone ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactEmail" label="e-mail" type="email" size="small" defaultValue={defaults.contactEmail ?? ''} fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="ข้อมูลจุดตรวจวัด">
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <ReadOnlyField label="รหัสจุดตรวจวัด" value={point?.code ?? ''} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <ReadOnlyField label="ชื่อจุดตรวจวัด" value={point?.name ?? ''} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField name="productionStack" label="ปล่องจากกระบวนการผลิต" size="small" defaultValue={defaults.productionStack ?? ''} fullWidth />
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <ReadOnlyField name="primaryFuel" label="เชื้อเพลิงหลัก" value={primaryFuel} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <ReadOnlyField name="secondaryFuel" label="เชื้อเพลิงสำรอง" value={secondaryFuel} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  select
                  name="combustionSystem"
                  label="ระบบการเผาไหม้เชื้อเพลิง"
                  size="small"
                  value={combustionSystem}
                  onChange={(event) => setCombustionSystem(event.target.value)}
                  fullWidth
                >
                  <MenuItem value="ระบบปิด">ระบบปิด</MenuItem>
                  <MenuItem value="ระบบเปิด">ระบบเปิด</MenuItem>
                </TextField>
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField name="productionCapacity" label="กำลังการผลิตของหน่วยการผลิต" size="small" defaultValue={defaults.productionCapacity ?? ''} fullWidth />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField name="productionCapacityUnit" label="หน่วยของกำลังการผลิต" size="small" defaultValue={defaults.productionCapacityUnit ?? ''} fullWidth />
              </Grid>
            </Grid>
          </Stack>
        </SectionPaper>

        <SectionPaper title="สาเหตุของการไม่สามารถรายงานผลการตรวจวัดได้">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                name="issueReason"
                label="สาเหตุ"
                size="small"
                value={issueReason}
                onChange={(event) => setIssueReason(event.target.value)}
                fullWidth
              >
                <MenuItem value="เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง">
                  เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง
                </MenuItem>
                <MenuItem value="หยุดหน่วยการผลิต">หยุดหน่วยการผลิต</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 9 }}>
              <TextField name="reasonDetail" label="เนื่องจาก" size="small" defaultValue={defaults.reasonDetail ?? ''} multiline minRows={3} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <DateTimePicker
                label="วัน/เดือน/ปี ที่พบปัญหาหรือหยุดหน่วยการผลิต"
                value={problemDate}
                onChange={handleHourDateTimeChange(onProblemDateChange)}
                format="DD/MM/YYYY HH:00"
                views={['year', 'month', 'day', 'hours']}
                ampm={false}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <DateTimePicker
                label="วัน/เดือน/ปี ที่คาดว่าจะดำเนินการแล้วเสร็จ"
                value={expectedDoneDate}
                onChange={handleHourDateTimeChange(onExpectedDoneDateChange)}
                format="DD/MM/YYYY HH:00"
                views={['year', 'month', 'day', 'hours']}
                ampm={false}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField
                label="รวมระยะเวลาปรับปรุงแก้ไขหรือระยะเวลาหยุดหน่วยการผลิต"
                value={totalDuration}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Alert severity="info">
                หมายเหตุ : กรณีเครื่องมือหรืออุปกรณ์พิเศษมีเหตุขัดข้องและไม่สามารถรายงานผลการตรวจวัดได้ตั้งแต่ 15 วันขึ้นไป ต้องรายงานแบบ กวภ.02 ด้วย
              </Alert>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ParameterMultiSelect
                label="รายการตรวจวัด (พารามิเตอร์) ที่ไม่สามารถรายงานผลได้"
                value={unreportedParameters}
                onChange={onUnreportedParametersChange}
                options={unavailableParameterOptions}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                name="correctiveAction"
                label="แนวทางการปรับปรุงแก้ไข (เฉพาะเครื่องมือหรืออุปกรณ์พิเศษขัดข้อง)"
                size="small"
                defaultValue={defaults.correctiveAction ?? ''}
                multiline
                minRows={3}
                fullWidth
              />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="ผู้ประกอบกิจการโรงงานหรือผู้รับมอบอำนาจ (ผู้จัดทำรายงาน)">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="reporterName" label="ชื่อ-นามสกุล" size="small" defaultValue={defaults.reporterName ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="reporterPosition" label="ตำแหน่ง" size="small" defaultValue={defaults.reporterPosition ?? ''} fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>
      </Stack>
    </LocalizationProvider>
  )
}

function getFormText(formData, name) {
  return String(formData.get(name) ?? '').trim()
}

function formatThaiDateValue(value) {
  return value && dayjs(value).isValid() ? dayjs(value).format('DD/MM/BBBB') : ''
}

function formatThaiDateHourValue(value) {
  const date = normalizeHourDateTime(value)
  return date ? date.format('DD/MM/BBBB HH:00') : ''
}

function formatApiDateValue(value) {
  return value && dayjs(value).isValid() ? dayjs(value).format('YYYY-MM-DD') : null
}

function formatApiHourDateTimeValue(value) {
  const date = normalizeHourDateTime(value)
  return date ? date.format('YYYY-MM-DDTHH:00:00') : null
}

function getDatePickerValue(value) {
  return value && dayjs(value).isValid() ? dayjs(value) : null
}

function buildKwp01PreviewData(form, formElement, dates, unreportedParameters) {
  const formData = formElement ? new FormData(formElement) : new FormData()
  const startDate = dates.problemDate
  const endDate = dates.expectedDoneDate

  return {
    title: form?.title ?? '',
    factoryName: form?.factory?.factoryName ?? '',
    factoryRegistration: form?.factory?.newRegistrationNo ?? '',
    industryType: getFactoryIndustryMainOrder(form?.factory),
    factoryAddress: form?.factory?.address ?? '',
    contactName: getFormText(formData, 'contactName'),
    contactPhone: getFormText(formData, 'contactPhone'),
    contactEmail: getFormText(formData, 'contactEmail'),
    pointCode: form?.point?.code ?? '',
    pointName: form?.point?.name ?? '',
    productionStack: getFormText(formData, 'productionStack'),
    primaryFuel: getFormText(formData, 'primaryFuel'),
    secondaryFuel: getFormText(formData, 'secondaryFuel'),
    combustionSystem: getFormText(formData, 'combustionSystem'),
    productionCapacity: getFormText(formData, 'productionCapacity'),
    productionCapacityUnit: getFormText(formData, 'productionCapacityUnit'),
    issueReason: getFormText(formData, 'issueReason'),
    reasonDetail: getFormText(formData, 'reasonDetail'),
    problemDate: formatThaiDateHourValue(startDate),
    expectedDoneDate: formatThaiDateHourValue(endDate),
    totalDays: getHourDuration(startDate, endDate),
    unreportedParameters,
    correctiveAction: getFormText(formData, 'correctiveAction'),
    reporterName: getFormText(formData, 'reporterName'),
    reporterPosition: getFormText(formData, 'reporterPosition'),
  }
}

function buildCommonFormPreviewData(form, formElement) {
  const formData = formElement ? new FormData(formElement) : new FormData()

  return {
    factoryName: form?.factory?.factoryName ?? '',
    factoryRegistration: form?.factory?.newRegistrationNo ?? '',
    industryType: getFactoryIndustryMainOrder(form?.factory),
    factoryAddress: form?.factory?.address ?? '',
    contactName: getFormText(formData, 'contactName'),
    contactPhone: getFormText(formData, 'contactPhone'),
    contactEmail: getFormText(formData, 'contactEmail'),
    pointCode: form?.point?.code ?? '',
    pointName: form?.point?.name ?? '',
    productionStack: getFormText(formData, 'productionStack'),
    primaryFuel: getFormText(formData, 'primaryFuel'),
    secondaryFuel: getFormText(formData, 'secondaryFuel'),
    combustionSystem: getFormText(formData, 'combustionSystem'),
    productionCapacity: getFormText(formData, 'productionCapacity'),
    productionCapacityUnit: getFormText(formData, 'productionCapacityUnit'),
    reporterName: getFormText(formData, 'reporterName'),
    reporterPosition: getFormText(formData, 'reporterPosition'),
  }
}

function buildKwpAttachmentPreviewFiles(files) {
  return files.map((file, index) => ({
    id: `${file.name}-${file.lastModified ?? index}-${index}`,
    name: file.name,
    type: file.type,
    url: '',
    isSubmitted: false,
  }))
}

function buildKwp02PreviewData(form, formElement, measurementRows, attachmentFiles = {}) {
  const isKwp04 = form?.title?.startsWith('กวภ.04')

  return {
    formType: isKwp04 ? 'kwp04' : 'kwp02',
    title: form?.title ?? '',
    ...buildCommonFormPreviewData(form, formElement),
    measurementRows,
    attachmentSections: [
      {
        key: 'samplingPhotos',
        title: 'ภาพถ่ายขณะเก็บตัวอย่าง',
        files: buildKwpAttachmentPreviewFiles(attachmentFiles.samplingPhotoFiles ?? []),
      },
      {
        key: 'labReports',
        title: 'รายงานผลจากห้องปฏิบัติการ',
        files: buildKwpAttachmentPreviewFiles(attachmentFiles.labReportFiles ?? []),
      },
    ],
  }
}

function getKwpSubmissionFactoryId(factory) {
  return factory?.factoryId ?? factory?.id ?? factory?.newRegistrationNo ?? ''
}

function buildKwpCommonSubmissionPayload(form, formElement) {
  const formData = formElement ? new FormData(formElement) : new FormData()
  const factory = form?.factory ?? {}
  const point = form?.point ?? {}

  return {
    factoryId: getKwpSubmissionFactoryId(factory),
    factoryName: factory.factoryName ?? '',
    factoryRegistrationNo: factory.newRegistrationNo ?? '',
    factoryAddress: factory.address ?? '',
    industryType: getFactoryIndustryMainOrder(factory),
    connectedPointId: point.connectedPointId ?? null,
    pointCode: point.code ?? '',
    pointName: point.name ?? '',
    pointType: point.type ?? '',
    productionStack: getFormText(formData, 'productionStack'),
    primaryFuel: getFormText(formData, 'primaryFuel'),
    secondaryFuel: getFormText(formData, 'secondaryFuel'),
    combustionSystem: getFormText(formData, 'combustionSystem'),
    productionCapacity: getFormText(formData, 'productionCapacity'),
    productionCapacityUnit: getFormText(formData, 'productionCapacityUnit'),
    contactName: getFormText(formData, 'contactName'),
    contactPhone: getFormText(formData, 'contactPhone'),
    contactEmail: getFormText(formData, 'contactEmail'),
    reporterName: getFormText(formData, 'reporterName'),
    reporterPosition: getFormText(formData, 'reporterPosition'),
  }
}

function buildKwp01SubmissionPayload(form, formElement, dates, unreportedParameters) {
  const formData = formElement ? new FormData(formElement) : new FormData()

  return {
    ...buildKwpCommonSubmissionPayload(form, formElement),
    issueReason: getFormText(formData, 'issueReason'),
    reasonDetail: getFormText(formData, 'reasonDetail'),
    problemDate: formatApiHourDateTimeValue(dates.problemDate),
    expectedDoneDate: formatApiHourDateTimeValue(dates.expectedDoneDate),
    unreportedParameters,
    correctiveAction: getFormText(formData, 'correctiveAction'),
  }
}

function buildKwpEmissionMeasurementItem(row, attachments = []) {
  return {
    pollutant: row.pollutant ?? '',
    sampleDate: formatApiDateValue(row.sampleDate),
    measuredValue: row.measuredValue ?? null,
    unit: row.unit ?? null,
    laboratoryNo: row.laboratoryNo ?? null,
    reportNo: row.reportNo ?? null,
    method: row.method ?? null,
    attachments,
  }
}

function buildKwp02SubmissionPayload(form, formElement, measurementRows, measurementAttachments = []) {
  return {
    ...buildKwpCommonSubmissionPayload(form, formElement),
    measurementItems: measurementRows.map((row, index) =>
      buildKwpEmissionMeasurementItem(row, index === 0 ? measurementAttachments : []),
    ),
  }
}

function buildKwp03SubmissionPayload(form, formElement, dates, selectedValues, attachments = []) {
  const formData = formElement ? new FormData(formElement) : new FormData()

  return {
    ...buildKwpCommonSubmissionPayload(form, formElement),
    instruments: selectedValues.instruments,
    wastewaterSource: getFormText(formData, 'wastewaterSource') || null,
    receivingSource: getFormText(formData, 'receivingSource') || null,
    treatmentSystemType: getFormText(formData, 'treatmentSystemType') || null,
    dischargePoint: getFormText(formData, 'dischargePoint') || null,
    averageDischarge: getFormText(formData, 'averageDischarge') || null,
    minimumDischarge: getFormText(formData, 'minimumDischarge') || null,
    maximumDischarge: getFormText(formData, 'maximumDischarge') || null,
    issueReasons: selectedValues.issueReasons,
    reasonDetail: getFormText(formData, 'reasonDetail') || null,
    problemDate: formatApiHourDateTimeValue(dates.problemDate),
    expectedDoneDate: formatApiHourDateTimeValue(dates.expectedDoneDate),
    failedParameters: selectedValues.failedParameters,
    correctiveAction: getFormText(formData, 'correctiveAction') || null,
    attachments,
  }
}

function buildKwp05SubmissionPayload(form, formElement, calibrationRows) {
  const formData = formElement ? new FormData(formElement) : new FormData()

  return {
    ...buildKwpCommonSubmissionPayload(form, formElement),
    businessActivity: getFormText(formData, 'businessActivity') || null,
    samplerName: getFormText(formData, 'samplerName') || null,
    officerRegistration: getFormText(formData, 'officerRegistration') || null,
    laboratoryName: getFormText(formData, 'laboratoryName') || null,
    laboratoryRegistration: getFormText(formData, 'laboratoryRegistration') || null,
    cemsDetail: getFormText(formData, 'cemsDetail') || null,
    reportRound: getFormText(formData, 'reportRound') || null,
    reportYear: getFormText(formData, 'reportYear') || null,
    calibrationItems: calibrationRows.map((row) => ({
      parameter: row.parameter ?? '',
      startDate: formatApiDateValue(row.startDate),
      endDate: formatApiDateValue(row.endDate),
      result: row.result || null,
      cemsModel: row.cemsModel || null,
      rataReportLink: row.rataReportLink || null,
      calibrationPhotoLink: row.calibrationPhotoLink || null,
      attachments: row.attachments ?? [],
    })),
  }
}

function buildKwp03PreviewData(form, formElement, dates, selectedValues) {
  const formData = formElement ? new FormData(formElement) : new FormData()

  return {
    formType: 'kwp03',
    title: form?.title ?? '',
    ...buildCommonFormPreviewData(form, formElement),
    instruments: selectedValues.instruments,
    measurementTimes: selectedValues.measurementTimes ?? [],
    wastewaterSource: getFormText(formData, 'wastewaterSource'),
    receivingSource: getFormText(formData, 'receivingSource'),
    treatmentSystemType: getFormText(formData, 'treatmentSystemType'),
    dischargePoint: getFormText(formData, 'dischargePoint'),
    averageDischarge: getFormText(formData, 'averageDischarge'),
    minimumDischarge: getFormText(formData, 'minimumDischarge'),
    maximumDischarge: getFormText(formData, 'maximumDischarge'),
    issueReasons: selectedValues.issueReasons,
    reasonDetail: getFormText(formData, 'reasonDetail'),
    problemDate: formatThaiDateHourValue(dates.problemDate),
    expectedDoneDate: formatThaiDateHourValue(dates.expectedDoneDate),
    totalDays: getHourDuration(dates.problemDate, dates.expectedDoneDate),
    failedParameters: selectedValues.failedParameters,
    correctiveAction: getFormText(formData, 'correctiveAction'),
  }
}

function buildKwp05PreviewData(form, formElement, calibrationRows) {
  const formData = formElement ? new FormData(formElement) : new FormData()

  return {
    formType: 'kwp05',
    title: form?.title ?? '',
    companyName: form?.factory?.factoryName ?? '',
    factoryRegistration: form?.factory?.newRegistrationNo ?? '',
    businessActivity: getFormText(formData, 'businessActivity'),
    factoryAddress: form?.factory?.address ?? '',
    samplerName: getFormText(formData, 'samplerName'),
    officerRegistration: getFormText(formData, 'officerRegistration'),
    laboratoryName: getFormText(formData, 'laboratoryName'),
    laboratoryRegistration: getFormText(formData, 'laboratoryRegistration'),
    pointCode: form?.point?.code ?? '',
    pointName: form?.point?.name ?? '',
    cemsBrand: getFormText(formData, 'cemsBrand'),
    cemsDetail: getFormText(formData, 'cemsDetail'),
    reportRound: getFormText(formData, 'reportRound'),
    reportYear: getFormText(formData, 'reportYear'),
    calibrationRows,
    reporterName: getFormText(formData, 'reporterName'),
    reporterPosition: getFormText(formData, 'reporterPosition'),
  }
}

function parseKwpHistoryDate(value) {
  if (!value) return null

  if (typeof value === 'string') {
    const thaiDateMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (thaiDateMatch) {
      const [, day, month, year] = thaiDateMatch
      const christianYear = Number(year) > 2400 ? Number(year) - 543 : Number(year)

      return new Date(christianYear, Number(month) - 1, Number(day))
    }

    const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoDateMatch) {
      const [, year, month, day] = isoDateMatch

      return new Date(Number(year), Number(month) - 1, Number(day))
    }
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

function formatKwpHistoryDate(value) {
  const parsedDate = parseKwpHistoryDate(value)
  if (!parsedDate) return '-'

  const day = String(parsedDate.getDate()).padStart(2, '0')
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
  const year = parsedDate.getFullYear() + 543

  return `${day}/${month}/${year}`
}

function formatKwpHistoryDuration(startValue, endValue, fallbackValue) {
  if (fallbackValue) return fallbackValue

  const startDate = parseKwpHistoryDate(startValue)
  const endDate = parseKwpHistoryDate(endValue)
  if (!startDate || !endDate) return ''

  const diffMs = Math.max(0, endDate.getTime() - startDate.getTime())
  const totalDays = Math.max(1, Math.ceil(diffMs / 86_400_000))

  return `${totalDays} วัน`
}

function getKwpStatusHistoryItems(history = []) {
  return history
    .filter(Boolean)
    .map((item, index) => ({ ...item, __index: index, __date: item.changedAt ?? item.date ?? null }))
    .sort((a, b) => {
      const dateA = parseKwpHistoryDate(a.__date)?.getTime() ?? 0
      const dateB = parseKwpHistoryDate(b.__date)?.getTime() ?? 0

      if (dateA !== dateB) {
        return dateA - dateB
      }

      return a.__index - b.__index
    })
}

function buildKwpStatusHistory(row) {
  if (Array.isArray(row.statusHistory) && row.statusHistory.length > 0) {
    return row.statusHistory
  }

  const history = [
    {
      id: `${row.id}-submitted`,
      statusLabel: 'รอพิจารณา',
      note: 'ผู้ประกอบการส่งแบบฟอร์ม',
      changedAt: row.submittedDate,
      changedBy: 'ผู้ประกอบการ',
    },
  ]

  if (row.status === 'รอโรงงานแก้ไข') {
    history.push({
      id: `${row.id}-revision`,
      statusLabel: 'รอโรงงานแก้ไข',
      note: row.revisionNote ?? '',
      changedAt: row.reviewedDate,
      changedBy: 'เจ้าหน้าที่ ก',
    })
  } else if (row.status === 'ผ่านการพิจารณา') {
    history.push({
      id: `${row.id}-reviewed`,
      statusLabel: 'ผ่านการพิจารณา',
      note: 'ตรวจสอบข้อมูลและเอกสารประกอบถูกต้องครบถ้วน',
      changedAt: row.reviewedDate,
      changedBy: 'เจ้าหน้าที่ ก',
    })
  } else if (row.status === 'ยื่นแบบสำเร็จ') {
    history.push({
      id: `${row.id}-completed`,
      statusLabel: 'ยื่นแบบสำเร็จ',
      note: 'บันทึกผลการพิจารณาเรียบร้อยแล้ว',
      changedAt: row.reviewedDate,
      changedBy: 'เจ้าหน้าที่ ก',
    })
  }

  return history
}

function getKwpDetailFormCode(detail = {}, row = {}) {
  const formType = String(detail.formType ?? row.formType ?? '').toUpperCase()
  const formCode = detail.form ?? row.form ?? ''
  const formTypeMap = {
    KWP01: 'กวภ.01',
    KWP02: 'กวภ.02',
    KWP03: 'กวภ.03',
    KWP04: 'กวภ.04',
    KWP05: 'กวภ.05',
  }

  return formTypeMap[formType] ?? formCode
}

function buildSubmittedAttachmentFile(file, index = 0) {
  return {
    id: file?.id ?? `${file?.originalFileName ?? 'attachment'}-${index}`,
    name: file?.originalFileName ?? file?.storedFileName ?? `ไฟล์แนบ ${index + 1}`,
    type: file?.mimeType ?? '',
    size: file?.fileSize ?? 0,
    url: file?.fileUrl ?? '',
    isSubmitted: true,
    attachmentType: file?.attachmentType ?? '',
    originalFileName: file?.originalFileName ?? file?.storedFileName ?? `ไฟล์แนบ ${index + 1}`,
    storedFileName: file?.storedFileName ?? null,
    mimeType: file?.mimeType ?? null,
    fileSize: file?.fileSize ?? null,
    storagePath: file?.storagePath ?? null,
  }
}

function getAttachmentsByType(attachments = [], attachmentType) {
  return attachments
    .filter((file) => file?.attachmentType === attachmentType)
    .map(buildSubmittedAttachmentFile)
}

function getRawAttachmentsByType(attachments = [], attachmentType) {
  return attachments.filter((file) => file?.attachmentType === attachmentType)
}

function normalizeKwpSubmissionDetailPayload(data = {}) {
  if (!data?.submission || typeof data.submission !== 'object') {
    return data ?? {}
  }

  return {
    ...data.submission,
    ...data,
  }
}

function getKwp05CalibrationItems(detail = {}) {
  const report = detail.calibrationReport ?? {}
  const candidates = [
    detail.calibrationItems,
    detail.calibrationResults,
    detail.items,
    detail.rows,
    detail.resultItems,
    detail.kwp05CalibrationItems,
    report.calibrationItems,
    report.calibrationResults,
    report.items,
    report.rows,
    report.resultItems,
  ]

  return candidates.find(Array.isArray) ?? []
}

function getKwp05ItemAttachments(item = {}) {
  return item.attachments ?? item.files ?? item.attachmentFiles ?? []
}

function getKwp05ItemParameter(item = {}) {
  return item.parameter ?? item.parameterName ?? item.parameter_name ?? item.parameterLabel ?? item.pollutant ?? ''
}

function buildKwp05CalibrationRow(item = {}, index = 0) {
  const attachments = getKwp05ItemAttachments(item)

  return {
    id: item.id ?? item.itemId ?? item.calibrationItemId ?? `calibration-${index}`,
    parameter: getKwp05ItemParameter(item),
    startDate: getDatePickerValue(item.startDate ?? item.startedAt ?? item.start_date),
    endDate: getDatePickerValue(item.endDate ?? item.endedAt ?? item.end_date),
    result: item.result ?? item.resultLabel ?? item.inspectionResult ?? '',
    verifierCompany: item.verifierCompany ?? item.verifier_company ?? item.companyName ?? '',
    cemsModel: item.cemsModel ?? item.cems_model ?? item.cemsBrandModel ?? item.model ?? '',
    rataReportLink: item.rataReportLink ?? item.linkQr1 ?? item.linkQR1 ?? item.link_qr1 ?? item.rataReportUrl ?? '',
    calibrationPhotoLink:
      item.calibrationPhotoLink ?? item.linkQr2 ?? item.linkQR2 ?? item.link_qr2 ?? item.calibrationPhotoUrl ?? '',
    rataReportFiles: getAttachmentsByType(attachments, 'RATA_REPORT'),
    calibrationPhotoFiles: getAttachmentsByType(attachments, 'CALIBRATION_PHOTO'),
  }
}

function buildKwpEditFormFromDetail(detail = {}, row = {}) {
  const code = getKwpDetailFormCode(detail, row)
  const option = kwpFormOptions.find((item) => item.code === code)
  const issueReport = detail.issueReport ?? {}
  const wpmsIssueReport = detail.wpmsIssueReport ?? {}
  const calibrationReport = detail.calibrationReport ?? {}
  const measurementItems = Array.isArray(detail.measurementItems) ? detail.measurementItems : []
  const calibrationItems = getKwp05CalibrationItems(detail)

  return {
    title: `${code} ${option?.title ?? ''}`.trim(),
    code,
    titleText: option?.title ?? '',
    description: option?.description ?? '',
    mode: 'edit',
    requestId: detail.id ?? row.id,
    requestNo: detail.requestNo ?? row.requestNo,
    latestRevisionMessage: row.revisionNote ?? detail.revisionReason ?? detail.officerNote ?? '',
    factory: {
      factoryId: detail.factoryId ?? row.factoryId,
      factoryName: detail.factoryName ?? row.factoryName,
      newRegistrationNo: detail.factoryRegistrationNo ?? row.factoryRegistration,
      industryType: detail.industryType ?? row.industryType,
      industryMainOrder: row.industryMainOrder ?? detail.industryType,
      businessActivity: detail.businessActivity ?? calibrationReport.businessActivity ?? row.businessActivity,
      address: detail.factoryAddress ?? row.factoryAddress,
    },
    point: {
      id: detail.connectedPointId ?? row.connectedPointId,
      code: detail.pointCode ?? row.monitoringPointCode,
      name: detail.pointName ?? row.monitoringPointName,
      type: detail.pointType ?? row.type,
      primaryFuel: detail.primaryFuel ?? row.primaryFuel,
      secondaryFuel: detail.secondaryFuel ?? row.secondaryFuel,
      parameterDetails: row.parameterDetails ?? [],
    },
    defaults: {
      contactName: detail.contactName ?? '',
      contactPhone: detail.contactPhone ?? '',
      contactEmail: detail.contactEmail ?? '',
      productionStack: detail.productionStack ?? '',
      primaryFuel: detail.primaryFuel ?? '',
      secondaryFuel: detail.secondaryFuel ?? '',
      combustionSystem: detail.combustionSystem ?? '',
      productionCapacity: detail.productionCapacity ?? '',
      productionCapacityUnit: detail.productionCapacityUnit ?? '',
      issueReason: issueReport.issueReason ?? '',
      reasonDetail: issueReport.reasonDetail ?? wpmsIssueReport.reasonDetail ?? '',
      correctiveAction: issueReport.correctiveAction ?? wpmsIssueReport.correctiveAction ?? '',
      reporterName: detail.reporterName ?? '',
      reporterPosition: detail.reporterPosition ?? '',
      wastewaterSource: wpmsIssueReport.wastewaterSource ?? '',
      receivingSource: wpmsIssueReport.receivingSource ?? '',
      treatmentSystemType: wpmsIssueReport.treatmentSystemType ?? '',
      dischargePoint: wpmsIssueReport.dischargePoint ?? '',
      averageDischarge: wpmsIssueReport.averageDischarge ?? '',
      minimumDischarge: wpmsIssueReport.minimumDischarge ?? '',
      maximumDischarge: wpmsIssueReport.maximumDischarge ?? '',
      businessActivity: calibrationReport.businessActivity ?? detail.businessActivity ?? '',
      reportRound: calibrationReport.reportRound ?? '',
      reportYear: calibrationReport.reportYear ?? '',
      samplerName: calibrationReport.samplerName ?? '',
      officerRegistration: calibrationReport.officerRegistration ?? '',
      laboratoryName: calibrationReport.laboratoryName ?? '',
      laboratoryRegistration: calibrationReport.laboratoryRegistration ?? '',
      cemsBrand: calibrationReport.cemsBrand ?? '',
    },
    initialState: {
      problemDate: issueReport.problemDate ?? wpmsIssueReport.problemDate ?? null,
      expectedDoneDate: issueReport.expectedDoneDate ?? wpmsIssueReport.expectedDoneDate ?? null,
      unreportedParameters: issueReport.unreportedParameters ?? [],
      measurementRows: measurementItems.map((item, index) => ({
        id: item.id ?? `measurement-${index}`,
        pollutant: item.pollutant ?? '',
        sampleDate: getDatePickerValue(item.sampleDate),
        measuredValue: item.measuredValue ?? item.numericValue ?? '',
        unit: item.unit ?? '',
        laboratoryNo: item.laboratoryNo ?? '',
        reportNo: item.reportNo ?? '',
        method: item.method ?? '',
      })),
      samplingPhotoFiles: measurementItems.flatMap((item) => getAttachmentsByType(item.attachments, 'SAMPLING_PHOTO')),
      labReportFiles: measurementItems.flatMap((item) => getAttachmentsByType(item.attachments, 'LAB_REPORT')),
      wpmsInstrument: wpmsIssueReport.instruments?.[0] ?? '',
      wpmsIssueReason: wpmsIssueReport.issueReasons?.[0] ?? '',
      wpmsFailedParameters: wpmsIssueReport.failedParameters ?? [],
      calibrationRows: calibrationItems.map(buildKwp05CalibrationRow),
    },
  }
}

function getKwpSubmissionFormSlug(row) {
  const formCode = String(row?.form ?? row?.formType ?? '').toUpperCase()
  const formMap = {
    'กวภ.01': 'kwp01',
    'กวภ.02': 'kwp02',
    'กวภ.03': 'kwp03',
    'กวภ.04': 'kwp04',
    'กวภ.05': 'kwp05',
    KWP01: 'kwp01',
    KWP02: 'kwp02',
    KWP03: 'kwp03',
    KWP04: 'kwp04',
    KWP05: 'kwp05',
  }

  return formMap[formCode] ?? ''
}

function normalizeKwpAttachmentFile(file, index = 0) {
  return {
    id: file?.id ?? `${file?.originalFileName ?? 'attachment'}-${index}`,
    name: file?.originalFileName ?? file?.storedFileName ?? `ไฟล์แนบ ${index + 1}`,
    type: file?.mimeType ?? '',
    url: file?.fileUrl ?? '',
    isSubmitted: Boolean(file?.fileUrl),
  }
}

function getKwpDetailCommonData(detail, row = {}) {
  return {
    title: detail.form ?? row.form ?? '',
    factoryName: detail.factoryName ?? row.factoryName ?? '',
    factoryRegistration: detail.factoryRegistrationNo ?? row.factoryRegistration ?? '',
    industryType: detail.industryType ?? row.industryMainOrder ?? row.industryType ?? '',
    factoryAddress: detail.factoryAddress ?? row.factoryAddress ?? '',
    contactName: detail.contactName ?? '',
    contactPhone: detail.contactPhone ?? '',
    contactEmail: detail.contactEmail ?? '',
    pointCode: detail.pointCode ?? row.monitoringPointCode ?? '',
    pointName: detail.pointName ?? row.monitoringPointName ?? '',
    productionStack: detail.productionStack ?? '',
    primaryFuel: detail.primaryFuel ?? '',
    secondaryFuel: detail.secondaryFuel ?? '',
    combustionSystem: detail.combustionSystem ?? '',
    productionCapacity: detail.productionCapacity ?? '',
    productionCapacityUnit: detail.productionCapacityUnit ?? '',
    reporterName: detail.reporterName ?? '',
    reporterPosition: detail.reporterPosition ?? '',
    latestRevisionMessage: row.revisionNote ?? '',
    status: detail.status ?? row.status ?? '',
    statusCode: detail.statusCode ?? row.statusCode ?? '',
    statusLabel: detail.statusLabel ?? row.statusLabel ?? '',
    statusHistory: buildKwpStatusHistory({ ...row, submittedDate: detail.submittedAt ?? row.submittedDate }),
  }
}

function buildKwpRequestPreviewDataFromDetail(detail, row = {}) {
  const commonData = getKwpDetailCommonData(detail, row)
  const formType = String(detail.formType ?? row.formType ?? '').toUpperCase()
  const formCode = detail.form ?? row.form ?? ''

  if (formType === 'KWP03' || formCode === 'กวภ.03') {
    const issueReport = detail.wpmsIssueReport ?? {}

    return {
      formType: 'kwp03',
      ...commonData,
      instruments: issueReport.instruments ?? [],
      measurementTimes: issueReport.measurementTimes ?? [],
      wastewaterSource: issueReport.wastewaterSource ?? '',
      receivingSource: issueReport.receivingSource ?? '',
      treatmentSystemType: issueReport.treatmentSystemType ?? '',
      dischargePoint: issueReport.dischargePoint ?? '',
      averageDischarge: issueReport.averageDischarge ?? '',
      minimumDischarge: issueReport.minimumDischarge ?? '',
      maximumDischarge: issueReport.maximumDischarge ?? '',
      issueReasons: issueReport.issueReasons ?? [],
      reasonDetail: issueReport.reasonDetail ?? '',
      problemDate: formatThaiDateHourValue(issueReport.problemDate),
      expectedDoneDate: formatThaiDateHourValue(issueReport.expectedDoneDate),
      totalDays: formatKwp01DurationValue(issueReport),
      failedParameters: issueReport.failedParameters ?? [],
      correctiveAction: issueReport.correctiveAction ?? '',
    }
  }

  if (formType === 'KWP02' || formType === 'KWP04' || formCode === 'กวภ.02' || formCode === 'กวภ.04') {
    const isKwp04 = formType === 'KWP04' || formCode === 'กวภ.04'
    const measurementRows = Array.isArray(detail.measurementItems)
      ? detail.measurementItems.map((item, index) => ({
          id: item.id ?? `measurement-${index + 1}`,
          pollutant: item.pollutant ?? '',
          sampleDate: item.sampleDate ?? null,
          measuredValue: item.measuredValue ?? '',
          unit: item.unit ?? '',
          laboratoryNo: item.laboratoryNo ?? '',
          reportNo: item.reportNo ?? '',
          method: item.method ?? '',
        }))
      : []
    const allAttachments = Array.isArray(detail.measurementItems)
      ? detail.measurementItems.flatMap((item) => item.attachments ?? [])
      : []

    return {
      formType: isKwp04 ? 'kwp04' : 'kwp02',
      ...commonData,
      measurementRows,
      attachmentSections: [
        {
          key: 'samplingPhotos',
          title: 'ภาพถ่ายขณะเก็บตัวอย่าง',
          files: allAttachments
            .filter((file) => file.attachmentType === 'SAMPLING_PHOTO')
            .map(normalizeKwpAttachmentFile),
        },
        {
          key: 'labReports',
          title: 'รายงานผลจากห้องปฏิบัติการ',
          files: allAttachments
            .filter((file) => file.attachmentType === 'LAB_REPORT')
            .map(normalizeKwpAttachmentFile),
        },
      ],
    }
  }

  if (formType === 'KWP05' || formCode === 'กวภ.05') {
    const report = detail.calibrationReport ?? {}
    const calibrationRows = getKwp05CalibrationItems(detail).map((item, index) => {
      const normalizedRow = buildKwp05CalibrationRow(item, index + 1)

      return {
        ...normalizedRow,
        startDate: item.startDate ?? item.startedAt ?? item.start_date ?? null,
        endDate: item.endDate ?? item.endedAt ?? item.end_date ?? null,
        rataReportFiles: getRawAttachmentsByType(getKwp05ItemAttachments(item), 'RATA_REPORT')
          .map((file) => normalizeKwpAttachmentFile(file, index)),
        calibrationPhotoFiles: getRawAttachmentsByType(getKwp05ItemAttachments(item), 'CALIBRATION_PHOTO')
          .map((file) => normalizeKwpAttachmentFile(file, index)),
      }
    })

    return {
      formType: 'kwp05',
      title: detail.form ?? row.form ?? 'กวภ.05',
      companyName: detail.factoryName ?? row.factoryName ?? '',
      factoryRegistration: detail.factoryRegistrationNo ?? row.factoryRegistration ?? '',
      businessActivity: report.businessActivity ?? '',
      factoryAddress: detail.factoryAddress ?? row.factoryAddress ?? '',
      samplerName: report.samplerName ?? '',
      officerRegistration: report.officerRegistration ?? '',
      laboratoryName: report.laboratoryName ?? '',
      laboratoryRegistration: report.laboratoryRegistration ?? '',
      pointCode: detail.pointCode ?? row.monitoringPointCode ?? '',
      pointName: detail.pointName ?? row.monitoringPointName ?? '',
      cemsBrand: report.cemsBrand ?? '',
      cemsDetail: report.cemsDetail ?? '',
      reportRound: report.reportRound ?? '',
      reportYear: report.reportYear ?? '',
      calibrationRows,
      reporterName: detail.reporterName ?? '',
      reporterPosition: detail.reporterPosition ?? '',
      latestRevisionMessage: row.revisionNote ?? '',
      status: detail.status ?? row.status ?? '',
      statusCode: detail.statusCode ?? row.statusCode ?? '',
      statusLabel: detail.statusLabel ?? row.statusLabel ?? '',
      statusHistory: buildKwpStatusHistory({ ...row, submittedDate: detail.submittedAt ?? row.submittedDate }),
    }
  }

  const issueReport = detail.issueReport ?? {}

  return {
    ...commonData,
    issueReason: issueReport.issueReason ?? '',
    reasonDetail: issueReport.reasonDetail ?? '',
    problemDate: formatThaiDateHourValue(issueReport.problemDate),
    expectedDoneDate: formatThaiDateHourValue(issueReport.expectedDoneDate),
    totalDays: formatKwp01DurationValue(issueReport),
    unreportedParameters: issueReport.unreportedParameters ?? [],
    correctiveAction: issueReport.correctiveAction ?? '',
  }
}

function PaperCheckbox({ checked, label }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, mr: 2 }}>
      <Box
        component="span"
        sx={{
          width: 16,
          height: 16,
          border: '1px solid #333',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          lineHeight: 1,
        }}
      >
        {checked ? '/' : ''}
      </Box>
      {label}
    </Box>
  )
}

function DottedValue({ children, minWidth = 120, sx }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        minWidth,
        borderBottom: '1px dotted #222',
        px: 0.5,
        lineHeight: 1.4,
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

function Kwp01PaperDocument({ data }) {
  const brokenTool = data.issueReason === 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง'
  const stoppedProduction = data.issueReason === 'หยุดหน่วยการผลิต'
  const closedCombustion = data.combustionSystem === 'ระบบปิด'
  const openCombustion = data.combustionSystem === 'ระบบเปิด'

  return (
    <Paper
      elevation={0}
      sx={{
        width: 794,
        minHeight: 1123,
        mx: 'auto',
        p: '38px 56px',
        color: '#000',
        bgcolor: '#fff',
        fontFamily: 'Kanit, sans-serif',
        fontSize: 14,
        lineHeight: 1.8,
      }}
    >
      <Stack spacing={1.6}>
        <Typography sx={{ textAlign: 'right', fontWeight: 700 }}>แบบ กวภ.01</Typography>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 700 }}>
            แบบแจ้งเหตุขัดข้องของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ เพื่อรายงานมลพิษอากาศจากปล่องโรงงาน
          </Typography>
          <Typography sx={{ fontWeight: 700 }}>หรือแจ้งหยุดหน่วยการผลิต</Typography>
        </Box>

        <TableContainer>
          <Table
            size="small"
            sx={{
              border: '1px solid #555',
              '& th, & td': {
                border: '1px solid #555',
                p: 0.65,
                fontSize: 13,
                color: '#000',
                verticalAlign: 'top',
              },
              '& th': {
                bgcolor: '#c9c9c9',
                fontWeight: 700,
              },
            }}
          >
            <TableBody>
              <TableRow>
                <TableCell component="th" colSpan={2}>1. รายละเอียดเกี่ยวกับโรงงาน (1 แบบต่อ 1 ปล่อง)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2} align="right">วันที่..........เดือน................พ.ศ. ................</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>ชื่อโรงงาน : {data.factoryName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>ทะเบียนโรงงานเลขที่ : {data.factoryRegistration}</TableCell>
                <TableCell>ลำดับประเภทโรงงาน : {data.industryType}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>สถานที่ตั้งโรงงาน : {data.factoryAddress}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>รายชื่อผู้ติดต่อ : {data.contactName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>เบอร์โทรศัพท์ : {data.contactPhone}</TableCell>
                <TableCell>e-mail : {data.contactEmail}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component="th" colSpan={2}>2. ข้อมูลปล่อง</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>รหัสจุดตรวจวัด : {data.pointCode}</TableCell>
                <TableCell>ชื่อจุดตรวจวัด : {data.pointName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>ปล่องจากกระบวนการผลิต : {data.productionStack}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>เชื้อเพลิงหลัก: {data.primaryFuel}</TableCell>
                <TableCell>เชื้อเพลิงสำรอง: {data.secondaryFuel}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>
                  ระบบการเผาไหม้เชื้อเพลิง :{' '}
                  <PaperCheckbox checked={closedCombustion} label="ระบบปิด" />
                  <PaperCheckbox checked={openCombustion} label="ระบบเปิด" />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>กำลังการผลิตของหน่วยการผลิต : {data.productionCapacity}</TableCell>
                <TableCell>หน่วยของกำลังการผลิต : {data.productionCapacityUnit}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component="th" colSpan={2}>3. สาเหตุของการไม่สามารถรายงานผลการตรวจวัดได้</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>3.1 สาเหตุ</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2} sx={{ pl: 5 }}>
                  <PaperCheckbox checked={brokenTool} label="เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง" />
                  เนื่องจาก : <DottedValue minWidth={360}>{brokenTool ? data.reasonDetail : ''}</DottedValue>
                  <Box sx={{ borderBottom: '1px dotted #222', mt: 1, minHeight: 20 }} />
                  <PaperCheckbox checked={stoppedProduction} label="หยุดหน่วยการผลิต" />
                  เนื่องจาก : <DottedValue minWidth={420}>{stoppedProduction ? data.reasonDetail : ''}</DottedValue>
                  <Box sx={{ borderBottom: '1px dotted #222', mt: 1, minHeight: 20 }} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>3.2 วัน/เดือน/ปี ที่พบปัญหาหรือหยุดหน่วยการผลิต : {data.problemDate}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>3.3 วัน/เดือน/ปี ที่คาดว่าจะดำเนินการแล้วเสร็จ : {data.expectedDoneDate}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2} sx={{ pl: 5 }}>
                  รวมระยะเวลาปรับปรุงแก้ไขหรือระยะเวลาหยุดหน่วยการผลิต :{' '}
                  <DottedValue minWidth={160}>{data.totalDays}</DottedValue>
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                    (หมายเหตุ : กรณีเครื่องมือหรืออุปกรณ์พิเศษมีเหตุขัดข้องและไม่สามารถรายงานผลการตรวจวัดได้ตั้งแต่ 15 วันขึ้นไป ต้องรายงานแบบ กวภ.02 ด้วย)
                  </Typography>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>
                  3.4 รายการตรวจวัด (พารามิเตอร์) ที่ไม่สามารถรายงานผลได้ :{' '}
                  <DottedValue minWidth={360}>{data.unreportedParameters.join(', ')}</DottedValue>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>
                  3.5 แนวทางการปรับปรุงแก้ไข (เฉพาะเครื่องมือหรืออุปกรณ์พิเศษขัดข้อง) :{' '}
                  <DottedValue minWidth={330}>{data.correctiveAction}</DottedValue>
                  <Box sx={{ borderBottom: '1px dotted #222', mt: 1, minHeight: 20 }} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2} sx={{ borderBottom: '1px solid #555', height: 210 }}>
                  <Box sx={{ textAlign: 'center', mt: 4 }}>
                    <Typography sx={{ fontSize: 13 }}>ข้าพเจ้าขอรับรองว่าข้อมูลข้างต้นเป็นจริงทุกประการ</Typography>
                    <Box sx={{ mt: 4, fontSize: 13 }}>
                      <DottedValue minWidth={240} /> (ลงชื่อ)
                    </Box>
                    <Typography sx={{ fontSize: 13 }}>( {data.reporterName || '........................................'} )</Typography>
                    <Typography sx={{ fontSize: 13 }}>ตำแหน่ง <DottedValue minWidth={210}>{data.reporterPosition}</DottedValue></Typography>
                    <Typography sx={{ fontSize: 13 }}>ผู้ประกอบกิจการโรงงานหรือผู้รับมอบอำนาจ</Typography>
                    <Typography sx={{ fontSize: 13 }}>ผู้จัดทำรายงาน</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Paper>
  )
}

function KwpPaperRowsOneAndTwo({ data, totalColumns = 2 }) {
  const closedCombustion = data.combustionSystem === 'ระบบปิด'
  const openCombustion = data.combustionSystem === 'ระบบเปิด'
  const leftColumns = Math.floor(totalColumns / 2)
  const rightColumns = totalColumns - leftColumns

  return (
    <>
      <TableRow>
        <TableCell component="th" colSpan={totalColumns}>
          1. รายละเอียดเกี่ยวกับโรงงาน (1 แบบต่อ 1 ปล่อง)
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={totalColumns} align="right">วันที่..........เดือน................พ.ศ. ................</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={totalColumns}>ชื่อโรงงาน : {data.factoryName}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={leftColumns}>ทะเบียนโรงงานเลขที่ : {data.factoryRegistration}</TableCell>
        <TableCell colSpan={rightColumns}>ลำดับประเภทโรงงาน : {data.industryType}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={totalColumns}>สถานที่ตั้งโรงงาน : {data.factoryAddress}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={totalColumns}>รายชื่อผู้ติดต่อ : {data.contactName}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={leftColumns}>เบอร์โทรศัพท์ : {data.contactPhone}</TableCell>
        <TableCell colSpan={rightColumns}>e-mail : {data.contactEmail}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell component="th" colSpan={totalColumns}>2. ข้อมูลปล่อง</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={leftColumns}>รหัสจุดตรวจวัด : {data.pointCode}</TableCell>
        <TableCell colSpan={rightColumns}>ชื่อจุดตรวจวัด : {data.pointName}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={totalColumns}>ปล่องจากกระบวนการผลิต : {data.productionStack}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={leftColumns}>เชื้อเพลิงหลัก: {data.primaryFuel}</TableCell>
        <TableCell colSpan={rightColumns}>เชื้อเพลิงสำรอง: {data.secondaryFuel}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={totalColumns}>
          ระบบการเผาไหม้เชื้อเพลิง :{' '}
          <PaperCheckbox checked={closedCombustion} label="ระบบปิด" />
          <PaperCheckbox checked={openCombustion} label="ระบบเปิด" />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={leftColumns}>กำลังการผลิตของหน่วยการผลิต : {data.productionCapacity}</TableCell>
        <TableCell colSpan={rightColumns}>หน่วยของกำลังการผลิต : {data.productionCapacityUnit}</TableCell>
      </TableRow>
    </>
  )
}

function KwpPaperShell({ children }) {
  return (
    <Paper
      elevation={0}
      sx={{
        width: 794,
        minHeight: 1123,
        mx: 'auto',
        p: '38px 56px',
        color: '#000',
        bgcolor: '#fff',
        fontFamily: 'Kanit, sans-serif',
        fontSize: 14,
        lineHeight: 1.8,
      }}
    >
      {children}
    </Paper>
  )
}

function AttachmentPreviewFile({ file }) {
  if (!file?.name) {
    return (
      <Typography sx={{ fontSize: 13 }}>
        -
      </Typography>
    )
  }

  return file.url && file.isSubmitted ? (
    <Typography
      component="a"
      href={file.url}
      download={file.name}
      target="_blank"
      rel="noreferrer"
      sx={{
        color: 'primary.main',
        fontSize: 13,
        textDecoration: 'underline',
        overflowWrap: 'anywhere',
      }}
    >
      {file.name}
    </Typography>
  ) : (
    <Typography sx={{ fontSize: 13 }}>{file.name}</Typography>
  )
}

function AttachmentPreviewTable({ title, files }) {
  return (
    <TableContainer sx={{ border: '1px solid #555' }}>
      <Table
        size="small"
        sx={{
          '& th, & td': {
            border: '1px solid #555',
            p: 1,
            fontSize: 13,
            color: '#000',
            verticalAlign: 'top',
          },
          '& th': {
            fontWeight: 700,
          },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 64 }}>ลำดับ</TableCell>
            <TableCell>{title}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {files.length > 0 ? (
            files.map((file, index) => (
              <TableRow key={file.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  <AttachmentPreviewFile file={file} />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={2}>-</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function Kwp02PaperDocument({ data }) {
  const isKwp04 = data.formType === 'kwp04'
  const rowsForPaper = data.measurementRows.length
    ? data.measurementRows
    : Array.from({ length: 3 }, (_, index) => ({ id: `empty-${index}` }))

  return (
    <Stack spacing={2} sx={{ alignItems: 'center' }}>
      <KwpPaperShell>
        <Stack spacing={1.6}>
          <Typography sx={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
            แบบ {isKwp04 ? 'กวภ.04' : 'กวภ.02'}
          </Typography>
          <Box sx={{ textAlign: 'center' }}>
            {isKwp04 ? (
              <>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                  แบบรายงานผลการตรวจวัดมลพิษอากาศจากปล่องระบาย ตามประกาศฯ
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                  ข้อ 4(1) (2) 11(3) และ 16
                </Typography>
              </>
            ) : (
              <>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                  แบบรายงานผลการตรวจวัดมลพิษอากาศจากปล่องระบาย กรณีเครื่องมือหรือเครื่องอุปกรณ์พิเศษ
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                  มีเหตุขัดข้องและไม่สามารถรายงานผลการตรวจวัดได้ตั้งแต่ 15 วันขึ้นไป
                </Typography>
              </>
            )}
          </Box>
          <TableContainer>
            <Table
              size="small"
              sx={{
                border: '1px solid #555',
                '& th, & td': {
                  border: '1px solid #555',
                  p: 0.65,
                  fontSize: 13,
                  color: '#000',
                  verticalAlign: 'top',
                },
                '& th': {
                  bgcolor: '#c9c9c9',
                  fontWeight: 700,
                },
              }}
            >
              <TableBody>
                <KwpPaperRowsOneAndTwo data={data} totalColumns={7} />
                <TableRow>
                  <TableCell component="th" colSpan={7}>3. รายการตรวจวัดมลพิษอากาศจากปล่องระบาย</TableCell>
                </TableRow>
                <TableRow>
                  {[
                    ['รายการ', 'สารมลพิษ'],
                    ['วันที่', 'เก็บตัวอย่าง'],
                    ['ค่าที่', 'ตรวจวัดได้'],
                    ['หน่วยการ', 'ตรวจวัด'],
                    ['เลขที่ห้อง', 'ปฏิบัติการ'],
                    ['เลขที่รายงาน'],
                    ['วิธีการตรวจวัดวิเคราะห์'],
                  ].map((column) => (
                    <TableCell key={column.join('-')} align="center" sx={{ fontWeight: 700 }}>
                      {column.map((line) => (
                        <Box key={line} component="span" sx={{ display: 'block' }}>
                          {line}
                        </Box>
                      ))}
                    </TableCell>
                  ))}
                </TableRow>
                {rowsForPaper.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.pollutant}</TableCell>
                    <TableCell>{formatThaiDateValue(row.sampleDate)}</TableCell>
                    <TableCell>{row.measuredValue}</TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell>{row.laboratoryNo}</TableCell>
                    <TableCell>{row.reportNo}</TableCell>
                    <TableCell>{row.method}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={7}>
                    หมายเหตุ : การเก็บและวิเคราะห์ตัวอย่างต้องดําเนินการโดยห้องปฏิบัติการวิเคราะห์ของหน่วยงานราชการ
                    หรือห้องปฏิบัติการวิเคราะห์เอกชนที่ขึ้นทะเบียนกับกรมโรงงานอุตสาหกรรม
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={7} sx={{ height: 260 }}>
                    <Box sx={{ textAlign: 'center', mt: 4, fontSize: 13 }}>
                      <Typography sx={{ fontSize: 13 }}>ข้าพเจ้าขอรับรองว่าข้อมูลข้างต้นเป็นจริงทุกประการ</Typography>
                      <Box sx={{ mt: 4, fontSize: 13 }}>
                        <DottedValue minWidth={300} /> (ลงชื่อ)
                      </Box>
                      <Typography sx={{ fontSize: 13 }}>( {data.reporterName || '........................................'} )</Typography>
                      <Typography sx={{ fontSize: 13 }}>ตำแหน่ง <DottedValue minWidth={260}>{data.reporterPosition}</DottedValue></Typography>
                      <Typography sx={{ fontSize: 13 }}>ผู้ประกอบกิจการโรงงานหรือผู้รับมอบอำนาจ</Typography>
                      <Typography sx={{ fontSize: 13 }}>ผู้จัดทำรายงาน</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </KwpPaperShell>
      {data.attachmentSections?.length ? (
        <KwpPaperShell>
          <Stack spacing={2}>
            <Typography sx={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
              เอกสารแนบ แบบ {isKwp04 ? 'กวภ.04' : 'กวภ.02'}
            </Typography>
            <Stack spacing={2}>
              {data.attachmentSections.map((section) => (
                <Box key={section.key}>
                  <AttachmentPreviewTable title={section.title} files={section.files} />
                </Box>
              ))}
            </Stack>
          </Stack>
        </KwpPaperShell>
      ) : null}
    </Stack>
  )
}

function MultiPaperCheckboxes({ options, selected }) {
  return options.map((option) => (
    <PaperCheckbox key={option} checked={selected.includes(option)} label={option} />
  ))
}

function Kwp03PaperDocument({ data }) {
  return (
    <KwpPaperShell>
      <Stack spacing={1.6}>
        <Typography sx={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>แบบ กวภ.03</Typography>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
            แบบแจ้งเหตุขัดข้องหรือหยุดส่งข้อมูลการตรวจวัดมลพิษทางน้ำแบบอัตโนมัติอย่างต่อเนื่อง (WPMS)
          </Typography>
        </Box>
        <TableContainer>
          <Table
            size="small"
            sx={{
              border: '1px solid #555',
              '& th, & td': {
                border: '1px solid #555',
                p: 0.6,
                fontSize: 13,
                color: '#000',
                verticalAlign: 'top',
              },
              '& th': {
                bgcolor: '#c9c9c9',
                fontWeight: 700,
              },
            }}
          >
            <TableBody>
              <TableRow>
                <TableCell component="th" colSpan={4}>1.รายละเอียดเกี่ยวกับโรงงาน (1 แบบต่อ 1 จุดตรวจวัด)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4} align="right">วันที่..........เดือน................พ.ศ. ................</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>ชื่อโรงงาน : {data.factoryName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>ทะเบียนโรงงานเลขที่ : {data.factoryRegistration}</TableCell>
                <TableCell colSpan={2}>ลำดับประเภทโรงงาน : {data.industryType}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>สถานที่ตั้งโรงงาน : {data.factoryAddress}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>รายชื่อผู้ติดต่อ : {data.contactName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>เบอร์โทรศัพท์ : {data.contactPhone}</TableCell>
                <TableCell colSpan={2}>E-mail: {data.contactEmail}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component="th" colSpan={4}>2.ข้อมูลจุดตรวจวัด</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>รหัสจุดตรวจวัด : {data.pointCode}</TableCell>
                <TableCell colSpan={2}>ชื่อจุดตรวจวัด : {data.pointName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>
                  เครื่องตรวจวัด : <MultiPaperCheckboxes options={wpmsInstrumentOptions} selected={data.instruments} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell component="th" colSpan={4}>
                  3.ข้อมูลนํ้าทิ้งระบายออกนอกโรงงาน (กรอกเฉพาะเครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง)
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>แหล่งกำเนิดน้ำเสีย : {data.wastewaterSource}</TableCell>
                <TableCell colSpan={2}>แหล่งรองรับน้ำทิ้ง : {data.receivingSource}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>ประเภทระบบบำบัด : {data.treatmentSystemType}</TableCell>
                <TableCell colSpan={2}>พิกัดจุดระบายน้ำทิ้ง : {data.dischargePoint}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>ปริมาณนํ้าทิ้งระบายออกวันที่ขัดข้อง (ลบ.ม./วัน) เฉลี่ย : {data.averageDischarge}</TableCell>
                <TableCell>ปริมาณนํ้าทิ้งระบายออกวันที่ขัดข้อง (ลบ.ม./วัน) ต่ำสุด : {data.minimumDischarge}</TableCell>
                <TableCell>ปริมาณนํ้าทิ้งระบายออกวันที่ขัดข้อง (ลบ.ม./วัน) สูงสุด : {data.maximumDischarge}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component="th" colSpan={4}>4.สาเหตุของการไม่สามารถรายงานผลการตรวจวัดได้</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>4.1 สาเหตุ</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4} sx={{ pl: 4 }}>
                  {wpmsIssueReasonOptions.map((reason) => (
                    <Box key={reason} sx={{ mb: 1.2 }}>
                      <PaperCheckbox checked={data.issueReasons.includes(reason)} label={reason} />
                      เนื่องจาก : <DottedValue minWidth={430}>{data.issueReasons.includes(reason) ? data.reasonDetail : ''}</DottedValue>
                    </Box>
                  ))}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>4.2 วัน/เดือน/ปี ที่พบปัญหาหรือหยุดหน่วยการผลิต : {data.problemDate}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>4.3 วัน/เดือน/ปี ที่คาดว่าจะดำเนินการแล้วเสร็จ : {data.expectedDoneDate}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>
                  รวมระยะเวลาปรับปรุงแก้ไขหรือระยะเวลาหยุดหน่วยการผลิต : <DottedValue minWidth={250}>{data.totalDays}</DottedValue>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>
                  4.4 รายการตรวจวัด (พารามิเตอร์) ที่ไม่สามารถรายงานผลได้ :{' '}
                  <MultiPaperCheckboxes options={wpmsParameterOptions} selected={data.failedParameters} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>
                  4.5 แนวทางการปรับปรุงแก้ไข (เฉพาะเครื่องมือหรืออุปกรณ์พิเศษขัดข้อง) :{' '}
                  <DottedValue minWidth={390}>{data.correctiveAction}</DottedValue>
                  <Box sx={{ borderBottom: '1px dotted #222', mt: 1, minHeight: 20 }} />
                  <Box sx={{ borderBottom: '1px dotted #222', mt: 1, minHeight: 20 }} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4} sx={{ height: 180 }}>
                  <Box sx={{ textAlign: 'center', mt: 2, fontSize: 13 }}>
                    <Typography sx={{ fontSize: 13 }}>ข้าพเจ้าขอรับรองว่าข้อมูลข้างต้นเป็นจริงทุกประการ</Typography>
                    <Box sx={{ mt: 4, fontSize: 13 }}>
                      <DottedValue minWidth={280} /> (ลงชื่อ)
                    </Box>
                    <Typography sx={{ fontSize: 13 }}>( {data.reporterName || '........................................'} )</Typography>
                    <Typography sx={{ fontSize: 13 }}>ตำแหน่ง <DottedValue minWidth={230}>{data.reporterPosition}</DottedValue></Typography>
                    <Typography sx={{ fontSize: 13 }}>ผู้จัดทำรายงาน/ผู้ดูแลระบบบำบัด</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </KwpPaperShell>
  )
}

function Kwp05Field({ label, value, minWidth = 120, sx, valueSx }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', minWidth: 0, fontSize: 14, lineHeight: 1.6, ...sx }}>
      <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
        {label} :
      </Box>
      <DottedValue minWidth={minWidth} sx={{ flex: 1, ml: 0.5, ...valueSx }}>
        {value}
      </DottedValue>
    </Box>
  )
}

function Kwp05FormRow({ children, sx }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, minWidth: 0, ...sx }}>
      {children}
    </Box>
  )
}

function Kwp05PaperDocument({ data }) {
  const rowsForPaper = data.calibrationRows.length
    ? data.calibrationRows
    : Array.from({ length: 2 }, (_, index) => ({ id: `empty-${index}` }))
  const tableColumns = [
    { id: 'parameter', label: 'พารามิเตอร์' },
    { id: 'startDate', label: 'วันที่เริ่มดำเนินการ' },
    { id: 'endDate', label: 'วันที่สิ้นสุดดำเนินการ' },
    { id: 'result', label: 'ผลการตรวจสอบ (ผ่าน / ไม่ผ่าน)' },
    { id: 'verifierCompany', label: 'บริษัทที่ทำการทวนสอบ / สอบเทียบ' },
    { id: 'cemsModel', label: 'ยี่ห้อ/รุ่นของ CEMS' },
    { id: 'rataReportLink', label: 'Link / QR CODE' },
    { id: 'calibrationPhotoLink', label: 'Link / QR CODE' },
  ]
  const tableColumnWidth = `${100 / tableColumns.length}%`

  return (
    <KwpPaperShell>
      <Stack spacing={0.6}>
        <Typography sx={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>แบบ กวภ.05</Typography>
        <Box sx={{ textAlign: 'center', pt: 0.25 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.35 }}>
            แบบรายงานผลการสอบเทียบหรือทวนสอบระบบตรวจวัดคุณภาพอากาศ
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.35 }}>
            แบบอัตโนมัติอย่างต่อเนื่อง (CEMS)
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.35 }}>
            ครั้งที่ <DottedValue minWidth={72}>{data.reportRound}</DottedValue> ประจำปี พ.ศ.{' '}
            <DottedValue minWidth={88}>{data.reportYear}</DottedValue>
          </Typography>
        </Box>

        <Box sx={{ pt: 2, fontSize: 14, display: 'grid', rowGap: 0.25 }}>
          <Kwp05Field label="ชื่อบริษัท" value={data.companyName} minWidth={240} sx={{ width: 330 }} />
          <Kwp05FormRow>
            <Kwp05Field label="เลขทะเบียนโรงงาน" value={data.factoryRegistration} minWidth={190} sx={{ width: 340 }} />
            <Kwp05Field label="ประกอบกิจการ" value={data.businessActivity} minWidth={190} sx={{ flex: 1 }} />
          </Kwp05FormRow>
          <Kwp05Field label="สถานที่ตั้ง" value={data.factoryAddress} minWidth={520} />
          <Kwp05FormRow>
            <Kwp05Field label="ผู้เก็บตัวอย่าง" value={data.samplerName} minWidth={250} sx={{ flex: 1.1 }} />
            <Kwp05Field label="ทะเบียนเจ้าหน้าที่" value={data.officerRegistration} minWidth={170} sx={{ flex: 0.9 }} />
          </Kwp05FormRow>
          <Kwp05Field label="หน่วยงาน/ชื่อห้องปฏิบัติการ" value={data.laboratoryName} minWidth={420} />
          <Kwp05Field label="ทะเบียนห้องปฏิบัติการ" value={data.laboratoryRegistration} minWidth={210} sx={{ width: 330 }} />
          <Kwp05Field label="รหัสจุดตรวจวัด" value={data.pointCode} minWidth={230} sx={{ width: 360 }} />
          <Kwp05Field label="ชื่อจุดตรวจวัด" value={data.pointName} minWidth={240} sx={{ width: 370 }} />
          <Kwp05Field
            label="รายละเอียดของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ : ยี่ห้อ (Brand)"
            value={data.cemsBrand || data.cemsDetail}
            minWidth={180}
          />
          <Typography sx={{ fontWeight: 700, textDecoration: 'underline', fontSize: 14, mt: 0.35 }}>
            รายการผลการสอบเทียบหรือทวนสอบ CEMS
          </Typography>
        </Box>

        <TableContainer sx={{ overflowX: 'visible' }}>
          <Table
            size="small"
            sx={{
              width: '100%',
              tableLayout: 'fixed',
              border: '1px solid #555',
              '& th, & td': {
                border: '1px solid #555',
                p: 0.55,
                fontSize: 12,
                color: '#000',
                textAlign: 'center',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              },
              '& th': {
                bgcolor: '#c9c9c9',
                fontWeight: 700,
                height: 96,
                verticalAlign: 'middle',
              },
              '& td': {
                verticalAlign: 'top',
              },
            }}
          >
            <colgroup>
              {tableColumns.map((column) => (
                <col key={column.id} style={{ width: tableColumnWidth }} />
              ))}
            </colgroup>
            <TableHead>
              <TableRow>
                {tableColumns.map((column) => (
                  <TableCell key={column.id}>{column.label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rowsForPaper.map((row) => (
                <TableRow key={row.id} sx={{ height: 88 }}>
                  <TableCell>{row.parameter}</TableCell>
                  <TableCell>{formatThaiDateValue(row.startDate)}</TableCell>
                  <TableCell>{formatThaiDateValue(row.endDate)}</TableCell>
                  <TableCell>{row.result}</TableCell>
                  <TableCell>{row.verifierCompany}</TableCell>
                  <TableCell>{row.cemsModel}</TableCell>
                  <TableCell>
                    <Kwp05AttachmentText items={formatKwp05AttachmentItems(row.rataReportFiles, row.rataReportLink)} />
                  </TableCell>
                  <TableCell>
                    <Kwp05AttachmentText
                      items={formatKwp05AttachmentItems(row.calibrationPhotoFiles, row.calibrationPhotoLink)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 5 }}>
          <Box sx={{ width: 310, fontSize: 14, lineHeight: 1.8 }}>
            <Box>
              ผู้รายงานผลการทดสอบ <DottedValue minWidth={150} />
            </Box>
            <Box sx={{ textAlign: 'center' }}>( <DottedValue minWidth={220}>{data.reporterName}</DottedValue> )</Box>
            <Box>ตำแหน่ง <DottedValue minWidth={220}>{data.reporterPosition}</DottedValue></Box>
            <Box>ลงวันที่ <DottedValue minWidth={70} />/<DottedValue minWidth={70} />/<DottedValue minWidth={88} /></Box>
          </Box>
        </Box>
      </Stack>
    </KwpPaperShell>
  )
}

function KwpStatusHistoryDialog({ open, history = [], onClose }) {
  const items = useMemo(() => getKwpStatusHistoryItems(history), [history])

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        ประวัติสถานะ
        <IconButton aria-label="ปิด" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {items.length ? (
          <Stack spacing={0}>
            {items.map((item, index) => {
              const nextItem = items[index + 1]
              const duration = formatKwpHistoryDuration(
                item.__date,
                nextItem?.__date,
                item.durationLabel ?? item.durationText ?? item.duration,
              )
              const note = item.revisionReason ?? item.officerNote ?? item.note ?? ''
              const title = `${item.statusLabel ?? item.status ?? '-'}${duration ? ` (${duration})` : ''}`

              return (
                <Box
                  key={item.id ?? `${item.statusLabel ?? 'status'}-${index}`}
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
                        วันที่: {formatKwpHistoryDate(item.__date)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ผู้บันทึก: {item.changedByName ?? item.changedBy ?? item.recorderName ?? '-'}
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
        )}
      </DialogContent>
    </Dialog>
  )
}

function Kwp01PreviewDialog({
  open,
  data,
  mode = 'submit',
  loading = false,
  submitting = false,
  submitError = '',
  onClose,
  onSubmit,
  onRequestRevision,
  onApprove,
}) {
  const [statusHistoryOpen, setStatusHistoryOpen] = useState(false)
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false)
  const [revisionOfficerNote, setRevisionOfficerNote] = useState('')
  const [revisionSubmitting, setRevisionSubmitting] = useState(false)
  const [approveSubmitting, setApproveSubmitting] = useState(false)
  const [revisionError, setRevisionError] = useState('')
  const latestRevisionMessage = mode === 'edit' ? data?.latestRevisionMessage : ''
  const canRequestRevision = mode === 'review' && hasKwpWorkflowStatus(data, [
    'SUBMITTED',
    'ส่งฟอร์ม',
    'ยื่นแบบสำเร็จ',
    'แก้ไขแล้ว/รอพิจารณา',
  ])
  const canApprove = mode === 'review' && hasKwpWorkflowStatus(data, [
    'SUBMITTED',
    'ส่งฟอร์ม',
    'ยื่นแบบสำเร็จ',
    'แก้ไขแล้ว/รอพิจารณา',
    'REVISION_REQUESTED',
    'ส่งแก้ไข',
    'รอโรงงานแก้ไข',
  ])
  const previewFormNo =
    data?.formType === 'kwp04'
      ? 'กวภ.04'
      : data?.formType === 'kwp03'
        ? 'กวภ.03'
        : data?.formType === 'kwp05'
          ? 'กวภ.05'
          : data?.formType === 'kwp02'
            ? 'กวภ.02'
            : 'กวภ.01'
  const isReadonlyViewDialog = mode === 'view'
  const handleDownload = () => {
    if (!data) return

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${previewFormNo}-document.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  const closeRevisionDialog = () => {
    if (revisionSubmitting) {
      return
    }

    setRevisionDialogOpen(false)
    setRevisionOfficerNote('')
    setRevisionError('')
  }
  const requestRevisionDocument = async () => {
    const officerNote = revisionOfficerNote.trim()

    if (!officerNote) {
      setRevisionError('กรุณาระบุรายละเอียดการแจ้งแก้ไข')
      return
    }

    setRevisionSubmitting(true)
    setRevisionError('')

    try {
      await onRequestRevision?.(officerNote)
      setRevisionSubmitting(false)
      setRevisionDialogOpen(false)
      setRevisionOfficerNote('')
      setRevisionError('')
    } catch (requestError) {
      setRevisionSubmitting(false)
      setRevisionError(requestError instanceof Error ? requestError.message : 'แจ้งแก้ไขแบบฟอร์มไม่สำเร็จ')
    }
  }
  const closePreviewDialog = () => {
    if (approveSubmitting) {
      return
    }

    setStatusHistoryOpen(false)
    onClose?.()
  }
  const approveDocument = async () => {
    setApproveSubmitting(true)

    try {
      await onApprove?.()
      setApproveSubmitting(false)
    } catch {
      setApproveSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onClose={closePreviewDialog} fullWidth maxWidth="lg">
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
            แบบฟอร์ม {previewFormNo}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<HistoryIcon />}
              disabled={!data}
              onClick={() => setStatusHistoryOpen(true)}
            >
              ประวัติสถานะ
            </Button>
            {isReadonlyViewDialog ? (
              <>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<FileDownloadIcon />}
                  disabled={!data}
                  onClick={handleDownload}
                >
                  ดาวน์โหลด
                </Button>
                <IconButton aria-label="ปิด" size="small" onClick={closePreviewDialog}>
                  <CloseIcon />
                </IconButton>
              </>
            ) : null}
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: 'neutral.100' }}>
          {loading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                กำลังโหลดข้อมูลแบบฟอร์ม...
              </Typography>
            </Box>
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
          {!loading && (data?.formType === 'kwp02' || data?.formType === 'kwp04') ? <Kwp02PaperDocument data={data} /> : null}
          {!loading && data?.formType === 'kwp03' ? <Kwp03PaperDocument data={data} /> : null}
          {!loading && data?.formType === 'kwp05' ? <Kwp05PaperDocument data={data} /> : null}
          {!loading && data && !['kwp02', 'kwp03', 'kwp04', 'kwp05'].includes(data.formType) ? <Kwp01PaperDocument data={data} /> : null}
        </DialogContent>
        {submitError ? (
          <Alert severity="error" sx={{ borderRadius: 0 }}>
            {submitError}
          </Alert>
        ) : null}
        {isReadonlyViewDialog ? null : (
          <DialogActions sx={{ justifyContent: 'center' }}>
            {mode === 'review' ? (
            <>
              <Button variant="outlined" color="inherit" disabled={approveSubmitting} onClick={closePreviewDialog}>
                ยกเลิก
              </Button>
              {canRequestRevision ? (
                <Button variant="outlined" color="warning" disabled={approveSubmitting} onClick={() => setRevisionDialogOpen(true)}>
                  แจ้งแก้ไข
                </Button>
              ) : null}
              {canApprove ? (
                <Button variant="contained" disabled={approveSubmitting || !data} onClick={approveDocument}>
                  {approveSubmitting ? 'กำลังผ่านการพิจารณา' : 'ผ่านการพิจารณา'}
                </Button>
              ) : null}
            </>
          ) : mode === 'edit' ? (
            <>
              <Button variant="outlined" color="inherit" disabled={submitting} onClick={closePreviewDialog}>
                ยกเลิก
              </Button>
              <Button variant="contained" disabled={submitting || !data} onClick={onSubmit}>
                {submitting ? 'กำลังบันทึกการแก้ไข' : 'บันทึกการแก้ไข'}
              </Button>
            </>
          ) : mode === 'cancel' ? (
            <>
              <Button variant="outlined" color="inherit" onClick={closePreviewDialog}>
                ปิด
              </Button>
              <Button variant="contained" color="error">
                ยืนยันการยกเลิก
              </Button>
            </>
          ) : (
            <>
              <Button variant="outlined" color="inherit" disabled={submitting} onClick={closePreviewDialog}>
                ยกเลิก
              </Button>
              <Button variant="contained" disabled={submitting || !data} onClick={onSubmit}>
                {submitting ? 'กำลังส่งแบบฟอร์ม' : 'ยืนยันการส่งแบบฟอร์ม'}
              </Button>
            </>
          )}
          </DialogActions>
        )}
      </Dialog>
      <KwpStatusHistoryDialog
        open={statusHistoryOpen}
        history={data?.statusHistory ?? []}
        onClose={() => setStatusHistoryOpen(false)}
      />
      <Dialog open={revisionDialogOpen} onClose={closeRevisionDialog} fullWidth maxWidth="sm">
        <DialogTitle>แจ้งแก้ไขแบบฟอร์ม</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              ระบุหมายเหตุเจ้าหน้าที่สำหรับแจ้งให้ผู้ประกอบการแก้ไขแบบฟอร์ม
            </Typography>
            <TextField
              label="รายละเอียด"
              value={revisionOfficerNote}
              onChange={(event) => {
                setRevisionOfficerNote(event.target.value)
                setRevisionError('')
              }}
              multiline
              minRows={4}
              fullWidth
              autoFocus
            />
            {revisionError ? (
              <Typography color="error" variant="body2">
                {revisionError}
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center' }}>
          <Button color="inherit" disabled={revisionSubmitting} onClick={closeRevisionDialog}>
            ยกเลิก
          </Button>
          <Button variant="contained" disabled={revisionSubmitting} onClick={requestRevisionDocument}>
            {revisionSubmitting ? 'กำลังแจ้งแก้ไข' : 'ยืนยันแจ้งแก้ไข'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

const emptyEmissionMeasurement = {
  pollutant: '',
  sampleDate: null,
  measuredValue: '',
  unit: '',
  laboratoryNo: '',
  reportNo: '',
  method: '',
  samplingPhotoFile: null,
  samplingPhotoFileName: '',
  samplingPhotoFileUrl: '',
  samplingPhotoFileType: '',
  labReportFile: null,
  labReportFileName: '',
  labReportFileUrl: '',
  labReportFileType: '',
}

function MultiFileInputButton({ label, files, onChange, maxFiles = 5 }) {
  const safeFiles = Array.isArray(files) ? files : []
  const isLimitReached = safeFiles.length >= maxFiles

  const removeFile = (removeIndex) => {
    onChange(safeFiles.filter((_, index) => index !== removeIndex))
  }

  return (
    <Stack spacing={1}>
      <Stack spacing={0.75}>
        <Button component="label" variant="outlined" fullWidth disabled={isLimitReached}>
          แนบไฟล์
          <input
            hidden
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            onChange={(event) => {
              const selectedFile = event.target.files?.[0] ?? null
              event.target.value = ''
              if (!selectedFile || isLimitReached) return
              onChange([...safeFiles, selectedFile].slice(0, maxFiles))
            }}
          />
        </Button>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Stack>
      <TableContainer sx={{ border: 1, borderColor: 'divider' }}>
        <Table size="small" sx={borderedTableSx}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 80 }}>ลำดับ</TableCell>
              <TableCell>{label}</TableCell>
              <TableCell sx={{ width: 64 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {safeFiles.length > 0 ? (
              safeFiles.map((file, index) => (
                <TableRow key={`${file.name}-${file.lastModified ?? index}`}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{file.name}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" color="error" onClick={() => removeFile(index)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  <Typography variant="body2" color="text.secondary">
                    ยังไม่มีไฟล์แนบ
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

function EmissionMeasurementDialog({ open, value, parameterOptions, onClose, onSave }) {
  if (!open) {
    return null
  }

  return (
    <EmissionMeasurementDialogContent
      key={value?.id ?? 'new'}
      value={value}
      parameterOptions={parameterOptions}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

function EmissionMeasurementDialogContent({ value, parameterOptions, onClose, onSave }) {
  const [form, setForm] = useState(value ?? emptyEmissionMeasurement)
  const measurementMethodOptions = getEmissionMeasurementMethodOptions(form.pollutant)

  const updateForm = (field, nextValue) => {
    setForm((current) => {
      const nextForm = { ...current, [field]: nextValue }

      if (field === 'pollutant') {
        nextForm.method = ''
      }

      return nextForm
    })
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>รายการตรวจวัดมลพิษอากาศจากปล่องระบาย</DialogTitle>
      <DialogContent dividers>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="th">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                label="รายการสารมลพิษ"
                size="small"
                value={form.pollutant}
                onChange={(event) => updateForm('pollutant', event.target.value)}
                fullWidth
              >
                {parameterOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <DatePicker
                label="วันที่เก็บตัวอย่าง"
                value={form.sampleDate}
                onChange={(nextValue) => updateForm('sampleDate', nextValue)}
                format="DD/MM/YYYY"
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="ค่าที่ตรวจวัดได้"
                size="small"
                value={form.measuredValue}
                onChange={(event) => updateForm('measuredValue', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="หน่วยการตรวจวัด"
                size="small"
                value={form.unit}
                onChange={(event) => updateForm('unit', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="เลขที่ห้องปฏิบัติการ"
                size="small"
                value={form.laboratoryNo}
                onChange={(event) => updateForm('laboratoryNo', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="เลขที่รายงาน"
                size="small"
                value={form.reportNo}
                onChange={(event) => updateForm('reportNo', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                select
                label="วิธีการตรวจวัดวิเคราะห์"
                size="small"
                value={form.method}
                onChange={(event) => updateForm('method', event.target.value)}
                disabled={!form.pollutant || measurementMethodOptions.length === 0}
                helperText={
                  form.pollutant && measurementMethodOptions.length === 0
                    ? 'ไม่มีตัวเลือกวิธีการตรวจวัดวิเคราะห์สำหรับสารมลพิษนี้'
                    : ''
                }
                fullWidth
              >
                {measurementMethodOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </LocalizationProvider>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={() => onSave(form)}>
          บันทึก
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function Kwp02Form({
  factory,
  point,
  defaults = {},
  measurementRows,
  setMeasurementRows,
  samplingPhotoFiles,
  setSamplingPhotoFiles,
  labReportFiles,
  setLabReportFiles,
}) {
  const [combustionSystem, setCombustionSystem] = useState(() => defaults.combustionSystem ?? '')
  const [editingMeasurement, setEditingMeasurement] = useState(null)
  const pollutantOptions = point?.parameterDetails ?? []
  const primaryFuel = point?.primaryFuel ?? ''
  const secondaryFuel = point?.secondaryFuel ?? ''

  const saveMeasurement = (row) => {
    setMeasurementRows((current) => {
      if (editingMeasurement?.id) {
        return current.map((item) => (item.id === editingMeasurement.id ? { ...row, id: editingMeasurement.id } : item))
      }

      return [...current, { ...row, id: Date.now() }]
    })
    setEditingMeasurement(null)
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="th">
      <Stack spacing={2}>
        <SectionPaper title="ข้อมูลทั่วไปของโรงงาน">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReadOnlyField label="ชื่อโรงงาน" value={factory?.factoryName ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ทะเบียนโรงงานเลขที่" value={factory?.newRegistrationNo ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ลำดับประเภทโรงงาน" value={getFactoryIndustryMainOrder(factory)} />
            </Grid>
            <Grid size={{ xs: 12, md: 12 }}>
              <ReadOnlyField label="สถานที่ตั้งโรงงาน" value={factory?.address ?? ''} multiline />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactName" label="รายชื่อผู้ติดต่อ" size="small" defaultValue={defaults.contactName ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactPhone" label="เบอร์โทรศัพท์" size="small" defaultValue={defaults.contactPhone ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactEmail" label="e-mail" type="email" size="small" defaultValue={defaults.contactEmail ?? ''} fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="ข้อมูลจุดตรวจวัด">
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <ReadOnlyField label="รหัสจุดตรวจวัด" value={point?.code ?? ''} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <ReadOnlyField label="ชื่อจุดตรวจวัด" value={point?.name ?? ''} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField name="productionStack" label="ปล่องจากกระบวนการผลิต" size="small" defaultValue={defaults.productionStack ?? ''} fullWidth />
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <ReadOnlyField name="primaryFuel" label="เชื้อเพลิงหลัก" value={primaryFuel} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <ReadOnlyField name="secondaryFuel" label="เชื้อเพลิงสำรอง" value={secondaryFuel} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  select
                  name="combustionSystem"
                  label="ระบบการเผาไหม้เชื้อเพลิง"
                  size="small"
                  value={combustionSystem}
                  onChange={(event) => setCombustionSystem(event.target.value)}
                  fullWidth
                >
                  <MenuItem value="ระบบปิด">ระบบปิด</MenuItem>
                  <MenuItem value="ระบบเปิด">ระบบเปิด</MenuItem>
                </TextField>
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField name="productionCapacity" label="กำลังการผลิตของหน่วยการผลิต" size="small" defaultValue={defaults.productionCapacity ?? ''} fullWidth />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField name="productionCapacityUnit" label="หน่วยของกำลังการผลิต" size="small" defaultValue={defaults.productionCapacityUnit ?? ''} fullWidth />
              </Grid>
            </Grid>
          </Stack>
        </SectionPaper>

        <SectionPaper title="รายการตรวจวัดมลพิษอากาศจากปล่องระบาย">
          <Stack spacing={1.5}>
            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={() => setEditingMeasurement({})}>
                เพิ่มข้อมูล
              </Button>
            </Stack>
            <TableContainer sx={{ border: 1, borderColor: 'divider', overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 1500, ...borderedTableSx }}>
                <TableHead>
                  <TableRow>
                    {[
                      'รายการสารมลพิษ',
                      'วันที่เก็บตัวอย่าง',
                      'ค่าที่ตรวจวัดได้',
                      'หน่วยการตรวจวัด',
                      'เลขที่ห้องปฏิบัติการ',
                      'เลขที่รายงาน',
                      'วิธีการตรวจวัดวิเคราะห์',
                      'จัดการ',
                    ].map((column) => (
                      <TableCell key={column} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>
                        {column}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {measurementRows.length > 0 ? (
                    measurementRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.pollutant}</TableCell>
                        <TableCell>{formatThaiDateValue(row.sampleDate)}</TableCell>
                        <TableCell>{row.measuredValue}</TableCell>
                        <TableCell>{row.unit}</TableCell>
                        <TableCell>{row.laboratoryNo}</TableCell>
                        <TableCell>{row.reportNo}</TableCell>
                        <TableCell>{row.method}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} sx={tableActionStackSx}>
                            <Button size="small" variant="outlined" onClick={() => setEditingMeasurement(row)}>
                              แก้ไข
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              onClick={() => setMeasurementRows((current) => current.filter((item) => item.id !== row.id))}
                            >
                              ลบ
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography variant="body2" color="text.secondary">
                          ไม่มีข้อมูลรายการตรวจวัด
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Alert severity="info">
              หมายเหตุ : การเก็บและวิเคราะห์ตัวอย่างต้องดําเนินการโดยห้องปฏิบัติการวิเคราะห์ของหน่วยงานราชการ
              หรือห้องปฏิบัติการวิเคราะห์เอกชนที่ขึ้นทะเบียนกับกรมโรงงานอุตสาหกรรม
            </Alert>
          </Stack>
        </SectionPaper>

        <SectionPaper title="เอกสารแนบ">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <MultiFileInputButton
                label="ภาพถ่ายขณะเก็บตัวอย่าง (JPG/PNG/PDF ไม่เกิน 5 MB)"
                files={samplingPhotoFiles}
                onChange={setSamplingPhotoFiles}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <MultiFileInputButton
                label="รายงานผลจากห้องปฏิบัติการ (JPG/PNG/PDF ไม่เกิน 5 MB)"
                files={labReportFiles}
                onChange={setLabReportFiles}
              />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="ผู้ประกอบกิจการโรงงานหรือผู้รับมอบอำนาจ (ผู้จัดทำรายงาน)">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="reporterName" label="ชื่อ-นามสกุล" size="small" defaultValue={defaults.reporterName ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="reporterPosition" label="ตำแหน่ง" size="small" defaultValue={defaults.reporterPosition ?? ''} fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>
      </Stack>
      <EmissionMeasurementDialog
        open={Boolean(editingMeasurement)}
        value={editingMeasurement?.id ? editingMeasurement : null}
        parameterOptions={pollutantOptions}
        onClose={() => setEditingMeasurement(null)}
        onSave={saveMeasurement}
      />
    </LocalizationProvider>
  )
}

function Kwp03Form({
  factory,
  point,
  defaults = {},
  problemDate,
  expectedDoneDate,
  instruments,
  issueReasons,
  failedParameters,
  onProblemDateChange,
  onExpectedDoneDateChange,
  onInstrumentsChange,
  onIssueReasonsChange,
  onFailedParametersChange,
}) {
  const totalDuration = getHourDuration(problemDate, expectedDoneDate)
  const pointParameterOptions = uniqueTextValues(point?.parameterDetails ?? [])
  const instrumentOptions = uniqueTextValues([...wpmsInstrumentOptions, instruments])
  const failedParameterOptions = [
    ...(pointParameterOptions.length ? pointParameterOptions : wpmsParameterOptions).filter((option) => option !== 'ทั้งหมด'),
    'ทั้งหมด',
  ]

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="th">
      <Stack spacing={2}>
        <SectionPaper title="รายละเอียดเกี่ยวกับโรงงาน">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReadOnlyField label="ชื่อโรงงาน" value={factory?.factoryName ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ทะเบียนโรงงานเลขที่" value={factory?.newRegistrationNo ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ลำดับประเภทโรงงาน" value={getFactoryIndustryMainOrder(factory)} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <ReadOnlyField label="สถานที่ตั้งโรงงาน" value={factory?.address ?? ''} multiline />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactName" label="รายชื่อผู้ติดต่อ" size="small" defaultValue={defaults.contactName ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactPhone" label="เบอร์โทรศัพท์" size="small" defaultValue={defaults.contactPhone ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactEmail" label="e-mail" type="email" size="small" defaultValue={defaults.contactEmail ?? ''} fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="ข้อมูลจุดตรวจวัด">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="รหัสจุดตรวจวัด" value={point?.code ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ชื่อจุดตรวจวัด" value={point?.name ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <OptionSelect
                label="เครื่องตรวจวัด"
                value={instruments}
                onChange={onInstrumentsChange}
                options={instrumentOptions}
              />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="ข้อมูลนํ้าทิ้งระบายออกนอกโรงงาน (กรอกเฉพาะเครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง)">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="wastewaterSource" label="แหล่งกำเนิดน้ำเสีย" size="small" defaultValue={defaults.wastewaterSource ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="receivingSource" label="แหล่งรองรับน้ำทิ้ง" size="small" defaultValue={defaults.receivingSource ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="treatmentSystemType" label="ประเภทระบบบำบัด" size="small" defaultValue={defaults.treatmentSystemType ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="dischargePoint" label="พิกัดจุดระบายน้ำทิ้ง" size="small" defaultValue={defaults.dischargePoint ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="averageDischarge" label="ปริมาณนํ้าทิ้งระบายออกวันที่ขัดข้อง (ลบ.ม./วัน) เฉลี่ย" size="small" defaultValue={defaults.averageDischarge ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="minimumDischarge" label="ปริมาณนํ้าทิ้งระบายออกวันที่ขัดข้อง (ลบ.ม./วัน) ต่ำสุด" size="small" defaultValue={defaults.minimumDischarge ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="maximumDischarge" label="ปริมาณนํ้าทิ้งระบายออกวันที่ขัดข้อง (ลบ.ม./วัน) สูงสุด" size="small" defaultValue={defaults.maximumDischarge ?? ''} fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="สาเหตุของการไม่สามารถรายงานผลการตรวจวัดได้">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <OptionSelect
                label="สาเหตุ"
                value={issueReasons}
                onChange={onIssueReasonsChange}
                options={wpmsIssueReasonOptions}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField name="reasonDetail" label="เนื่องจาก" size="small" defaultValue={defaults.reasonDetail ?? ''} multiline minRows={3} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <DateTimePicker
                label="วัน/เดือน/ปี ที่พบปัญหาหรือหยุดหน่วยการผลิต"
                value={problemDate}
                onChange={handleHourDateTimeChange(onProblemDateChange)}
                format="DD/MM/YYYY HH:00"
                views={['year', 'month', 'day', 'hours']}
                ampm={false}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <DateTimePicker
                label="วัน/เดือน/ปี ที่คาดว่าจะดำเนินการแล้วเสร็จ"
                value={expectedDoneDate}
                onChange={handleHourDateTimeChange(onExpectedDoneDateChange)}
                format="DD/MM/YYYY HH:00"
                views={['year', 'month', 'day', 'hours']}
                ampm={false}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="รวมระยะเวลา" value={totalDuration} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <OptionMultiSelect
                label="รายการตรวจวัด (พารามิเตอร์) ที่ไม่สามารถรายงานผลได้"
                value={failedParameters}
                onChange={onFailedParametersChange}
                options={failedParameterOptions}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                name="correctiveAction"
                label="แนวทางการปรับปรุงแก้ไข"
                size="small"
                defaultValue={defaults.correctiveAction ?? ''}
                multiline
                minRows={3}
                fullWidth
              />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="ผู้จัดทำรายงาน/ผู้ดูแลระบบบำบัด">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="reporterName" label="ชื่อ-นามสกุล" size="small" defaultValue={defaults.reporterName ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="reporterPosition" label="ตำแหน่ง" size="small" defaultValue={defaults.reporterPosition ?? ''} fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>
      </Stack>
    </LocalizationProvider>
  )
}

const emptyCalibrationResult = {
  parameter: '',
  startDate: null,
  endDate: null,
  result: '',
  verifierCompany: '',
  cemsModel: '',
  rataReportLink: '',
  calibrationPhotoLink: '',
  rataReportFiles: [],
  calibrationPhotoFiles: [],
}

function formatKwp05AttachmentItems(files = [], link = '') {
  return [
    ...files.map((file, index) => ({
      key: file.id ?? `${file.name ?? 'file'}-${index}`,
      label: file.name,
      url: file.url,
      download: file.name,
    })).filter((file) => file.label),
    String(link ?? '').trim()
      ? { key: `link-${link}`, label: String(link).trim(), url: String(link).trim() }
      : null,
  ].filter(Boolean)
}

function Kwp05AttachmentText({ items }) {
  const lines = items.filter((item) => item?.label)

  if (!lines.length) {
    return '-'
  }

  return (
    <Stack spacing={0.25}>
      {lines.map((item, index) => {
        const key = item.key ?? `${item.label}-${index}`

        return item.url ? (
          <Typography
            key={key}
            component="a"
            href={item.url}
            download={item.download}
            target="_blank"
            rel="noreferrer"
            variant="body2"
            sx={{ color: 'primary.main', textDecoration: 'underline', overflowWrap: 'anywhere' }}
          >
            {item.label}
          </Typography>
        ) : (
          <Typography key={key} variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {item.label}
          </Typography>
        )
      })}
    </Stack>
  )
}

const kwp05ResultTableColumns = [
  { id: 'parameter', label: 'พารามิเตอร์' },
  { id: 'startDate', label: 'วันที่เริ่มดำเนินการ' },
  { id: 'endDate', label: 'วันที่สิ้นสุดดำเนินการ' },
  { id: 'result', label: 'ผลการตรวจสอบ' },
  { id: 'verifierCompany', label: 'บริษัทที่ทำการทวนสอบ / สอบเทียบ' },
  { id: 'cemsModel', label: 'ยี่ห้อ/รุ่นของ CEMS' },
  { id: 'rataReportLink', label: 'Link / QR CODE' },
  { id: 'calibrationPhotoLink', label: 'Link / QR CODE' },
  { id: 'actions', label: 'จัดการ' },
]

function CalibrationResultDialog({ open, value, defaultCemsModel = '', onClose, onSave }) {
  if (!open) {
    return null
  }

  return (
    <CalibrationResultDialogContent
      key={value?.id ?? 'new'}
      value={value}
      defaultCemsModel={defaultCemsModel}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

function CalibrationResultDialogContent({ value, defaultCemsModel = '', onClose, onSave }) {
  const [form, setForm] = useState(() => (
    value
      ? { ...emptyCalibrationResult, ...value }
      : { ...emptyCalibrationResult, cemsModel: defaultCemsModel }
  ))
  const [rataReportFiles, setRataReportFiles] = useState(value?.rataReportFiles ?? [])
  const [calibrationPhotoFiles, setCalibrationPhotoFiles] = useState(value?.calibrationPhotoFiles ?? [])

  const updateForm = (field, nextValue) => {
    setForm((current) => ({ ...current, [field]: nextValue }))
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{value ? 'แก้ไขรายการผลการสอบเทียบหรือทวนสอบ CEMS' : 'เพิ่มรายการผลการสอบเทียบหรือทวนสอบ CEMS'}</DialogTitle>
      <DialogContent dividers>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="th">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                label="พารามิเตอร์"
                size="small"
                value={form.parameter}
                onChange={(event) => updateForm('parameter', event.target.value)}
                fullWidth
              >
                {cemsParameterOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <DatePicker
                label="วันที่เริ่มดำเนินการ"
                value={form.startDate}
                onChange={(nextValue) => updateForm('startDate', nextValue)}
                format="DD/MM/YYYY"
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <DatePicker
                label="วันที่สิ้นสุดดำเนินการ"
                value={form.endDate}
                onChange={(nextValue) => updateForm('endDate', nextValue)}
                format="DD/MM/YYYY"
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                label="ผลการตรวจสอบ"
                size="small"
                value={form.result}
                onChange={(event) => updateForm('result', event.target.value)}
                fullWidth
              >
                {calibrationResultOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                label="ยี่ห้อ/รุ่นของ CEMS"
                size="small"
                value={form.cemsModel}
                onChange={(event) => updateForm('cemsModel', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Divider />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                เอกสารแนบ
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <MultiFileInputButton
                label="รายงานผล RATA (JPG/PNG/PDF ไม่เกิน 10 MB)"
                files={rataReportFiles}
                onChange={setRataReportFiles}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <MultiFileInputButton
                label="ภาพขณะสอบเทียบ (JPG/PNG/PDF ไม่เกิน 10 MB)"
                files={calibrationPhotoFiles}
                onChange={setCalibrationPhotoFiles}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Link รายงานผล RATA"
                size="small"
                value={form.rataReportLink}
                onChange={(event) => updateForm('rataReportLink', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Link ภาพขณะสอบเทียบ"
                size="small"
                value={form.calibrationPhotoLink}
                onChange={(event) => updateForm('calibrationPhotoLink', event.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>
        </LocalizationProvider>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          onClick={() => onSave({
            ...form,
            rataReportFiles,
            calibrationPhotoFiles,
          })}
        >
          บันทึก
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function Kwp05Form({ factory, point, defaults = {}, calibrationRows, setCalibrationRows }) {
  const [editingCalibration, setEditingCalibration] = useState(null)
  const defaultCemsModel = defaults.cemsModel ?? point?.cemsModel ?? ''

  const saveCalibration = (row) => {
    setCalibrationRows((current) => {
      if (editingCalibration?.id) {
        return current.map((item) => (item.id === editingCalibration.id ? { ...row, id: editingCalibration.id } : item))
      }

      return [...current, { ...row, id: Date.now() }]
    })
    setEditingCalibration(null)
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="th">
      <Stack spacing={2}>
        <SectionPaper title="ข้อมูลทั่วไปของบริษัท/โรงงาน">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReadOnlyField label="ชื่อบริษัท" value={factory?.factoryName ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="เลขทะเบียนโรงงาน" value={factory?.newRegistrationNo ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="businessActivity" label="ประกอบกิจการ" size="small" defaultValue={defaults.businessActivity ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 12 }}>
              <ReadOnlyField label="สถานที่ตั้งโรงงาน" value={factory?.address ?? ''} multiline />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactName" label="รายชื่อผู้ติดต่อ" size="small" defaultValue={defaults.contactName ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactPhone" label="เบอร์โทรศัพท์" size="small" defaultValue={defaults.contactPhone ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactEmail" label="e-mail" type="email" size="small" defaultValue={defaults.contactEmail ?? ''} fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="รายละเอียดแบบรายงาน">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="reportRound" label="ครั้งที่" size="small" defaultValue={defaults.reportRound ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="reportYear" label="ประจำปี พ.ศ." size="small" defaultValue={defaults.reportYear ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="samplerName" label="ผู้เก็บตัวอย่าง" size="small" defaultValue={defaults.samplerName ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="officerRegistration" label="ทะเบียนเจ้าหน้าที่" size="small" defaultValue={defaults.officerRegistration ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="laboratoryName" label="หน่วยงาน/ชื่อห้องปฏิบัติการ" size="small" defaultValue={defaults.laboratoryName ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="laboratoryRegistration" label="ทะเบียนห้องปฏิบัติการ" size="small" defaultValue={defaults.laboratoryRegistration ?? ''} fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="ข้อมูลจุดตรวจวัดและเครื่องมือ">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="รหัสจุดตรวจวัด" value={point?.code ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ชื่อจุดตรวจวัด" value={point?.name ?? ''} />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="รายการผลการสอบเทียบหรือทวนสอบ CEMS">
          <Stack spacing={1.5}>
            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={() => setEditingCalibration({})}>
                เพิ่มข้อมูล
              </Button>
            </Stack>
            <TableContainer sx={{ border: 1, borderColor: 'divider', overflowX: 'auto' }}>
              <Table
                size="small"
                sx={{
                  minWidth: 1280,
                  tableLayout: 'fixed',
                  ...borderedTableSx,
                  '& .MuiTableBody-root .MuiTableCell-root': {
                    verticalAlign: 'top',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    {kwp05ResultTableColumns.map((column) => (
                      <TableCell
                        key={column.id}
                        sx={{ width: `${100 / kwp05ResultTableColumns.length}%`, fontWeight: 700, bgcolor: '#f8fafc' }}
                      >
                        {column.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {calibrationRows.length > 0 ? (
                    calibrationRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.parameter}</TableCell>
                        <TableCell>{formatThaiDateValue(row.startDate)}</TableCell>
                        <TableCell>{formatThaiDateValue(row.endDate)}</TableCell>
                        <TableCell>{row.result}</TableCell>
                        <TableCell>{row.verifierCompany}</TableCell>
                        <TableCell>{row.cemsModel}</TableCell>
                        <TableCell sx={{ overflowWrap: 'anywhere' }}>
                          <Kwp05AttachmentText items={formatKwp05AttachmentItems(row.rataReportFiles, row.rataReportLink)} />
                        </TableCell>
                        <TableCell sx={{ overflowWrap: 'anywhere' }}>
                          <Kwp05AttachmentText
                            items={formatKwp05AttachmentItems(row.calibrationPhotoFiles, row.calibrationPhotoLink)}
                          />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} sx={tableActionStackSx}>
                            <Button size="small" variant="outlined" onClick={() => setEditingCalibration(row)}>
                              แก้ไข
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              onClick={() => setCalibrationRows((current) => current.filter((item) => item.id !== row.id))}
                            >
                              ลบ
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        <Typography variant="body2" color="text.secondary">
                          ไม่มีข้อมูลรายการผลการสอบเทียบหรือทวนสอบ CEMS
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </SectionPaper>

        <SectionPaper title="ผู้รายงานผลการทดสอบ">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="reporterName" label="ชื่อ-นามสกุล" size="small" defaultValue={defaults.reporterName ?? ''} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="reporterPosition" label="ตำแหน่ง" size="small" defaultValue={defaults.reporterPosition ?? ''} fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>
      </Stack>
      <CalibrationResultDialog
        open={Boolean(editingCalibration)}
        value={editingCalibration?.id ? editingCalibration : null}
        defaultCemsModel={defaultCemsModel}
        onClose={() => setEditingCalibration(null)}
        onSave={saveCalibration}
      />
    </LocalizationProvider>
  )
}

function KwpFormBottomSheet({ form, open, accessToken, onClose, onExited, onSubmitted }) {
  const formRef = useRef(null)
  const initialState = form?.initialState ?? {}
  const [problemDate, setProblemDate] = useState(() => (
    initialState.problemDate && dayjs(initialState.problemDate).isValid() ? dayjs(initialState.problemDate) : null
  ))
  const [expectedDoneDate, setExpectedDoneDate] = useState(() => (
    initialState.expectedDoneDate && dayjs(initialState.expectedDoneDate).isValid()
      ? dayjs(initialState.expectedDoneDate)
      : null
  ))
  const [unreportedParameters, setUnreportedParameters] = useState(() => initialState.unreportedParameters ?? [])
  const [measurementRows, setMeasurementRows] = useState(() => initialState.measurementRows ?? [])
  const [samplingPhotoFiles, setSamplingPhotoFiles] = useState(() => initialState.samplingPhotoFiles ?? [])
  const [labReportFiles, setLabReportFiles] = useState(() => initialState.labReportFiles ?? [])
  const [wpmsInstrument, setWpmsInstrument] = useState(() => initialState.wpmsInstrument ?? '')
  const [wpmsIssueReason, setWpmsIssueReason] = useState(() => initialState.wpmsIssueReason ?? '')
  const [wpmsFailedParameters, setWpmsFailedParameters] = useState(() => initialState.wpmsFailedParameters ?? [])
  const [calibrationRows, setCalibrationRows] = useState(() => initialState.calibrationRows ?? [])
  const [previewData, setPreviewData] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const headerCode = form?.code ?? form?.title?.split(' ')?.[0] ?? ''
  const headerTitle = form?.titleText ?? form?.title?.replace(`${headerCode} `, '') ?? ''
  const headerDescription = form?.description ?? ''
  const latestRevisionMessage = form?.latestRevisionMessage ?? ''
  const isEditMode = form?.mode === 'edit'

  const uploadKwpAttachment = async (file, attachmentType) => {
    if (file?.isSubmitted) {
      return {
        originalFileName: file.originalFileName ?? file.name ?? '',
        storedFileName: file.storedFileName ?? null,
        mimeType: file.mimeType ?? file.type ?? null,
        fileSize: file.fileSize ?? file.size ?? null,
        storagePath: file.storagePath ?? null,
        fileUrl: file.fileUrl ?? file.url ?? null,
      }
    }

    const uploadBody = new FormData()
    if (attachmentType) {
      uploadBody.append('attachmentType', attachmentType)
    }
    uploadBody.append('file', file)

    const result = await fetch(`${kwpFormSubmissionsApiBaseUrl}/attachments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: uploadBody,
    })
    const response = await readKwpApiResponse(result, 'อัปโหลดไฟล์แนบไม่สำเร็จ')

    return response?.data
  }

  const uploadKwpAttachments = async (files, attachmentType) => {
    const uploadedFiles = await Promise.all(files.map((file) => uploadKwpAttachment(file, attachmentType)))

    return uploadedFiles.map((file) => ({
      attachmentType,
      originalFileName: file?.originalFileName ?? '',
      storedFileName: file?.storedFileName ?? null,
      mimeType: file?.mimeType ?? null,
      fileSize: file?.fileSize ?? null,
      storagePath: file?.storagePath ?? null,
      fileUrl: file?.fileUrl ?? null,
    }))
  }

  const buildCalibrationRowsWithAttachments = async (rows) => {
    const rowsWithAttachments = []

    for (const row of rows) {
      const rataReportAttachments = await uploadKwpAttachments(row.rataReportFiles ?? [], 'RATA_REPORT')
      const calibrationPhotoAttachments = await uploadKwpAttachments(row.calibrationPhotoFiles ?? [], 'CALIBRATION_PHOTO')

      rowsWithAttachments.push({
        ...row,
        attachments: [...rataReportAttachments, ...calibrationPhotoAttachments],
      })
    }

    return rowsWithAttachments
  }

  const submitForm = async () => {
    if (!form || !accessToken) {
      setSubmitError('กรุณาเข้าสู่ระบบเพื่อส่งแบบฟอร์ม')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      let endpoint = ''
      let payload = null

      if (form.code === 'กวภ.01') {
        endpoint = 'kwp01'
        payload = buildKwp01SubmissionPayload(
          form,
          formRef.current,
          { problemDate, expectedDoneDate },
          unreportedParameters,
        )
      } else if (form.code === 'กวภ.02' || form.code === 'กวภ.04') {
        endpoint = form.code === 'กวภ.04' ? 'kwp04' : 'kwp02'
        const samplingAttachments = await uploadKwpAttachments(samplingPhotoFiles, 'SAMPLING_PHOTO')
        const labReportAttachments = await uploadKwpAttachments(labReportFiles, 'LAB_REPORT')

        payload = buildKwp02SubmissionPayload(
          form,
          formRef.current,
          measurementRows,
          [...samplingAttachments, ...labReportAttachments],
        )
      } else if (form.code === 'กวภ.03') {
        endpoint = 'kwp03'
        payload = buildKwp03SubmissionPayload(
          form,
          formRef.current,
          { problemDate, expectedDoneDate },
          {
            instruments: wpmsInstrument ? [wpmsInstrument] : [],
            issueReasons: wpmsIssueReason ? [wpmsIssueReason] : [],
            failedParameters: wpmsFailedParameters,
          },
        )
      } else if (form.code === 'กวภ.05') {
        endpoint = 'kwp05'
        const calibrationRowsWithAttachments = await buildCalibrationRowsWithAttachments(calibrationRows)

        payload = buildKwp05SubmissionPayload(form, formRef.current, calibrationRowsWithAttachments)
      } else {
        throw new Error('รองรับการส่งแบบฟอร์มเฉพาะ กวภ.01 - กวภ.05')
      }

      if (isEditMode) {
        if (!form.requestId) {
          throw new Error('ไม่พบรหัสคำขอสำหรับบันทึกการแก้ไข')
        }

        const updateResult = await fetch(`${kwpFormSubmissionsApiBaseUrl}/${endpoint}/${form.requestId}`, {
          method: 'PATCH',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        })
        await readKwpApiResponse(updateResult, 'บันทึกการแก้ไขไม่สำเร็จ')

        const resubmitResult = await fetch(`${kwpFormSubmissionsApiBaseUrl}/${endpoint}/${form.requestId}/resubmit`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            note: 'ปรับข้อมูลและแนบเอกสารครบแล้ว',
          }),
        })
        await readKwpApiResponse(resubmitResult, 'ส่งแบบฟอร์มที่แก้ไขแล้วไม่สำเร็จ')

        setPreviewData(null)
        onSubmitted?.()
        onClose?.()
        return
      }

      const result = await fetch(`${kwpFormSubmissionsApiBaseUrl}/${endpoint}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })
      await readKwpApiResponse(result, 'ส่งแบบฟอร์มไม่สำเร็จ')

      setPreviewData(null)
      onSubmitted?.()
      onClose?.()
    } catch (requestError) {
      setSubmitError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const openPreview = () => {
    setSubmitError('')

    if (form?.title?.startsWith('กวภ.05')) {
      setPreviewData(buildKwp05PreviewData(form, formRef.current, calibrationRows))
      return
    }

    if (form?.title?.startsWith('กวภ.03')) {
      setPreviewData(buildKwp03PreviewData(
        form,
        formRef.current,
        { problemDate, expectedDoneDate },
        {
          instruments: wpmsInstrument ? [wpmsInstrument] : [],
          issueReasons: wpmsIssueReason ? [wpmsIssueReason] : [],
          failedParameters: wpmsFailedParameters,
        },
      ))
      return
    }

    if (form?.title?.startsWith('กวภ.02') || form?.title?.startsWith('กวภ.04')) {
      setPreviewData(buildKwp02PreviewData(form, formRef.current, measurementRows, {
        samplingPhotoFiles,
        labReportFiles,
      }))
      return
    }

    if (form?.title?.startsWith('กวภ.01')) {
      setPreviewData(buildKwp01PreviewData(
        form,
        formRef.current,
        { problemDate, expectedDoneDate },
        unreportedParameters,
      ))
    }
  }

  return (
    <>
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
          transition: {
            direction: 'up',
            onExited,
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
            <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1, textAlign: 'center' }}>
              <Typography variant="h6" component="h2" fontWeight={700}>
                {headerCode} {headerTitle}
              </Typography>
              {headerDescription ? (
                <Typography variant="body2" color="text.secondary">
                  {headerDescription}
                </Typography>
              ) : null}
            </Stack>
            <IconButton aria-label="ปิด" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <Divider />
          <Box
            component="form"
            ref={formRef}
            sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: { xs: 2, md: 3 } }}
          >
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
            {form?.title?.startsWith('กวภ.01') ? (
              <Kwp01Form
                factory={form.factory}
                point={form.point}
                defaults={form.defaults}
                problemDate={problemDate}
                expectedDoneDate={expectedDoneDate}
                unreportedParameters={unreportedParameters}
                onProblemDateChange={setProblemDate}
                onExpectedDoneDateChange={setExpectedDoneDate}
                onUnreportedParametersChange={setUnreportedParameters}
              />
            ) : form?.title?.startsWith('กวภ.03') ? (
              <Kwp03Form
                factory={form.factory}
                point={form.point}
                defaults={form.defaults}
                problemDate={problemDate}
                expectedDoneDate={expectedDoneDate}
                instruments={wpmsInstrument}
                issueReasons={wpmsIssueReason}
                failedParameters={wpmsFailedParameters}
                onProblemDateChange={setProblemDate}
                onExpectedDoneDateChange={setExpectedDoneDate}
                onInstrumentsChange={setWpmsInstrument}
                onIssueReasonsChange={setWpmsIssueReason}
                onFailedParametersChange={setWpmsFailedParameters}
              />
            ) : form?.title?.startsWith('กวภ.02') || form?.title?.startsWith('กวภ.04') ? (
              <Kwp02Form
                factory={form.factory}
                point={form.point}
                defaults={form.defaults}
                measurementRows={measurementRows}
                setMeasurementRows={setMeasurementRows}
                samplingPhotoFiles={samplingPhotoFiles}
                setSamplingPhotoFiles={setSamplingPhotoFiles}
                labReportFiles={labReportFiles}
                setLabReportFiles={setLabReportFiles}
              />
            ) : form?.title?.startsWith('กวภ.05') ? (
              <Kwp05Form
                factory={form.factory}
                point={form.point}
                defaults={form.defaults}
                calibrationRows={calibrationRows}
                setCalibrationRows={setCalibrationRows}
              />
            ) : null}
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
            <Button variant="contained" onClick={openPreview}>
              {isEditMode ? 'บันทึกการแก้ไข' : 'บันทึกแบบฟอร์ม'}
            </Button>
          </Stack>
        </Stack>
      </Drawer>
      <Kwp01PreviewDialog
        open={Boolean(previewData)}
        data={previewData}
        mode={isEditMode ? 'edit' : 'submit'}
        submitting={isSubmitting}
        submitError={submitError}
        onClose={() => {
          setPreviewData(null)
          setSubmitError('')
        }}
        onSubmit={submitForm}
      />
    </>
  )
}

function getFactoryColumns(onOpenMonitoringPoints) {
  return [
    { field: 'factoryName', headerName: 'ชื่อโรงงาน/บริษัท', width: 240 },
    { field: 'newRegistrationNo', headerName: 'เลขทะเบียนโรงงาน (ใหม่)', width: 190 },
    { field: 'oldRegistrationNo', headerName: 'เลขทะเบียนโรงงาน (เก่า)', width: 190 },
    { field: 'businessActivity', headerName: 'การประกอบกิจการ', width: 220 },
    { field: 'province', headerName: 'จังหวัด', width: 130 },
    { field: 'monitoringPointCount', headerName: 'จำนวนจุดตรวจวัด', width: 150, type: 'number' },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: 190,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <FactoryActions row={params.row} onOpenMonitoringPoints={onOpenMonitoringPoints} />
      ),
    },
  ]
}

function getRequestColumns(onOpenDocument, isOperator = false) {
  return [
    { field: 'factoryName', headerName: 'ชื่อโรงงาน/บริษัท', width: 240 },
    {
      field: 'factoryRegistration',
      headerName: 'เลขทะเบียนโรงงาน',
      width: 190,
      sortable: false,
    },
    { field: 'province', headerName: 'จังหวัด', width: 130 },
    { field: 'type', headerName: 'ประเภทจุดตรวจวัด', width: 150 },
    { field: 'monitoringPointCode', headerName: 'รหัสจุดตรวจวัด', width: 170 },
    { field: 'requestNo', headerName: 'เลขที่คำขอ', width: 150 },
    { field: 'form', headerName: 'แบบฟอร์ม', width: 150 },
    { field: 'submittedDate', headerName: 'วันที่ยื่นคำขอ', width: 150 },
    { field: 'reviewedDate', headerName: 'วันที่พิจารณา', width: 150 },
    {
      field: 'status',
      headerName: 'สถานะ',
      width: 190,
      renderCell: (params) => <KwpStatusChip row={params.row} />,
    },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: isOperator ? 250 : 190,
      sortable: false,
      filterable: false,
      renderCell: (params) => <RequestActions row={params.row} isOperator={isOperator} onOpenDocument={onOpenDocument} />,
    },
  ]
}

function KwpFormsPage({ userType = '', accessToken = '' }) {
  const isOperator = userType === 'operator'
  const availableSubMenus = isOperator ? operatorSubMenus : officerSubMenus
  const [monitoringPointContext, setMonitoringPointContext] = useState(null)
  const [monitoringPointRows, setMonitoringPointRows] = useState([])
  const [isLoadingMonitoringPoint, setIsLoadingMonitoringPoint] = useState(false)
  const [monitoringPointError, setMonitoringPointError] = useState('')
  const [selectedForm, setSelectedForm] = useState(null)
  const [isFormSheetOpen, setIsFormSheetOpen] = useState(false)
  const [requestDocument, setRequestDocument] = useState(null)
  const [selectedSubMenu, setSelectedSubMenu] = useState(() => (isOperator ? 'factories' : 'requests'))
  const [factoryRows, setFactoryRows] = useState([])
  const [requestRows, setRequestRows] = useState([])
  const [isLoadingFactories, setIsLoadingFactories] = useState(false)
  const [isLoadingRequests, setIsLoadingRequests] = useState(false)
  const [factoriesError, setFactoriesError] = useState('')
  const [requestsError, setRequestsError] = useState('')
  const effectiveSubMenu = availableSubMenus.some((menu) => menu.value === selectedSubMenu)
    ? selectedSubMenu
    : availableSubMenus[0].value

  const loadFactoryRows = useCallback(async (signal) => {
    if (!accessToken) {
      setFactoryRows([])
      setFactoriesError('กรุณาเข้าสู่ระบบเพื่อโหลดรายชื่อโรงงาน')
      return
    }

    setIsLoadingFactories(true)
    setFactoriesError('')

    try {
      const result = await fetch(`${kwpFormReportsApiBaseUrl}/factories`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        signal,
      })
      const response = await readKwpApiResponse(result, 'โหลดรายชื่อโรงงานไม่สำเร็จ')
      setFactoryRows(normalizeKwpFactoryRows(response?.data))
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setFactoryRows([])
        setFactoriesError(requestError.message)
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoadingFactories(false)
      }
    }
  }, [accessToken])

  const loadRequestRows = useCallback(async (signal) => {
    if (!accessToken) {
      setRequestRows([])
      setRequestsError('กรุณาเข้าสู่ระบบเพื่อโหลดรายการคำขอ')
      return
    }

    setIsLoadingRequests(true)
    setRequestsError('')

    try {
      const result = await fetch(`${kwpFormReportsApiBaseUrl}/requests`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        signal,
      })
      const response = await readKwpApiResponse(result, 'โหลดรายการคำขอไม่สำเร็จ')
      setRequestRows(normalizeKwpRequestRows(response?.data))
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setRequestRows([])
        setRequestsError(requestError.message)
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoadingRequests(false)
      }
    }
  }, [accessToken])

  const loadMonitoringPointRows = useCallback(async (context, signal) => {
    const factoryId = getMonitoringPointFactoryId(context)

    if (!factoryId) {
      setMonitoringPointRows([])
      setMonitoringPointError('ไม่พบรหัสโรงงานสำหรับเรียกข้อมูลรายละเอียดจุดตรวจวัด')
      return
    }

    if (!accessToken) {
      setMonitoringPointRows([])
      setMonitoringPointError('กรุณาเข้าสู่ระบบเพื่อโหลดรายละเอียดจุดตรวจวัด')
      return
    }

    setIsLoadingMonitoringPoint(true)
    setMonitoringPointError('')

    try {
      const result = await fetch(
        `${connectedMeasurementPointsApiBaseUrl}/factories/${encodeURIComponent(factoryId)}`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          signal,
        },
      )
      const response = await readKwpApiResponse(result, 'โหลดรายละเอียดจุดตรวจวัดไม่สำเร็จ')
      setMonitoringPointRows(normalizeMonitoringPointDetailRows(response?.data))
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setMonitoringPointRows([])
        setMonitoringPointError(requestError.message)
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoadingMonitoringPoint(false)
      }
    }
  }, [accessToken])

  useEffect(() => {
    if (effectiveSubMenu !== 'factories') {
      return
    }

    const controller = new AbortController()
    queueMicrotask(() => {
      loadFactoryRows(controller.signal)
    })

    return () => {
      controller.abort()
    }
  }, [effectiveSubMenu, loadFactoryRows])

  useEffect(() => {
    if (effectiveSubMenu !== 'requests') {
      return
    }

    const controller = new AbortController()
    queueMicrotask(() => {
      loadRequestRows(controller.signal)
    })

    return () => {
      controller.abort()
    }
  }, [effectiveSubMenu, loadRequestRows])

  useEffect(() => {
    if (!monitoringPointContext) {
      return
    }

    const controller = new AbortController()
    queueMicrotask(() => {
      loadMonitoringPointRows(monitoringPointContext, controller.signal)
    })

    return () => {
      controller.abort()
    }
  }, [loadMonitoringPointRows, monitoringPointContext])

  const openMonitoringPointDialog = useCallback((row) => {
    setMonitoringPointRows([])
    setMonitoringPointError('')
    setIsLoadingMonitoringPoint(false)
    setMonitoringPointContext(row)
  }, [])

  const openFormBottomSheet = useCallback((form) => {
    setSelectedForm(form)
    setIsFormSheetOpen(true)
  }, [])

  const closeFormBottomSheet = useCallback(() => {
    setIsFormSheetOpen(false)
  }, [])

  const clearClosedFormBottomSheet = useCallback(() => {
    setSelectedForm(null)
  }, [])

  const handleFormSubmitted = useCallback(() => {
    setSelectedSubMenu('requests')
    loadRequestRows()
  }, [loadRequestRows])

  const fetchKwpSubmissionDetail = useCallback(async (row) => {
    const formSlug = getKwpSubmissionFormSlug(row)

    if (!formSlug) {
      throw new Error('ไม่พบประเภทแบบฟอร์มสำหรับโหลดรายละเอียด')
    }

    if (!accessToken) {
      throw new Error('กรุณาเข้าสู่ระบบเพื่อโหลดรายละเอียดแบบฟอร์ม')
    }

    const result = await fetch(`${kwpFormSubmissionsApiBaseUrl}/${formSlug}/${row.id}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const response = await readKwpApiResponse(result, 'โหลดรายละเอียดแบบฟอร์มไม่สำเร็จ')

    return normalizeKwpSubmissionDetailPayload(response?.data)
  }, [accessToken])

  const openRequestDocument = useCallback(async (row, mode) => {
    if (isOperator && mode === 'edit') {
      setRequestsError('')
      setIsLoadingRequests(true)

      try {
        const detail = await fetchKwpSubmissionDetail(row)
        openFormBottomSheet(buildKwpEditFormFromDetail(detail, row))
      } catch (requestError) {
        setRequestsError(requestError.message)
      } finally {
        setIsLoadingRequests(false)
      }
      return
    }

    const formSlug = getKwpSubmissionFormSlug(row)
    if (!formSlug) {
      setRequestDocument({
        mode,
        data: null,
        loading: false,
        error: 'ไม่พบประเภทแบบฟอร์มสำหรับโหลดรายละเอียด',
      })
      return
    }

    if (!accessToken) {
      setRequestDocument({
        mode,
        data: null,
        loading: false,
        error: 'กรุณาเข้าสู่ระบบเพื่อโหลดรายละเอียดแบบฟอร์ม',
      })
      return
    }

    setRequestDocument({
      mode,
      row,
      data: null,
      loading: true,
      error: '',
    })

    try {
      const detail = await fetchKwpSubmissionDetail(row)

      setRequestDocument({
        mode,
        row,
        data: buildKwpRequestPreviewDataFromDetail(detail, row),
        loading: false,
        error: '',
      })
    } catch (requestError) {
      setRequestDocument({
        mode,
        row,
        data: null,
        loading: false,
        error: requestError.message,
      })
    }
  }, [accessToken, fetchKwpSubmissionDetail, isOperator, openFormBottomSheet])

  const requestKwpDocumentRevision = useCallback(async (officerNote) => {
    const requestId = requestDocument?.row?.id

    if (!requestId) {
      throw new Error('ไม่พบรหัสคำขอสำหรับแจ้งแก้ไข')
    }

    if (!accessToken) {
      throw new Error('กรุณาเข้าสู่ระบบเจ้าหน้าที่เพื่อแจ้งแก้ไขแบบฟอร์ม')
    }

    const result = await fetch(`${kwpFormSubmissionsApiBaseUrl}/${requestId}/workflow-actions`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'REQUEST_REVISION',
        revisionReason: officerNote,
        officerNote,
      }),
    })

    await readKwpApiResponse(result, 'แจ้งแก้ไขแบบฟอร์มไม่สำเร็จ')
    setRequestDocument(null)
    loadRequestRows()
  }, [accessToken, loadRequestRows, requestDocument?.row?.id])

  const approveKwpDocument = useCallback(async () => {
    const requestId = requestDocument?.row?.id

    try {
      if (!requestId) {
        throw new Error('ไม่พบรหัสคำขอสำหรับผ่านการพิจารณา')
      }

      if (!accessToken) {
        throw new Error('กรุณาเข้าสู่ระบบเจ้าหน้าที่เพื่อผ่านการพิจารณาแบบฟอร์ม')
      }

      setRequestDocument((current) => ({
        ...current,
        error: '',
      }))

      const result = await fetch(`${kwpFormSubmissionsApiBaseUrl}/${requestId}/workflow-actions`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'APPROVE',
          officerNote: 'ข้อมูลและเอกสารประกอบครบถ้วน',
        }),
      })

      await readKwpApiResponse(result, 'ผ่านการพิจารณาแบบฟอร์มไม่สำเร็จ')
      setRequestDocument(null)
      loadRequestRows()
    } catch (requestError) {
      setRequestDocument((current) => ({
        ...current,
        error: requestError instanceof Error ? requestError.message : 'ผ่านการพิจารณาแบบฟอร์มไม่สำเร็จ',
      }))
      throw requestError
    }
  }, [accessToken, loadRequestRows, requestDocument?.row?.id])

  const closeMonitoringPointDialog = useCallback(() => {
    setMonitoringPointRows([])
    setMonitoringPointError('')
    setIsLoadingMonitoringPoint(false)
    setMonitoringPointContext(null)
  }, [])

  const factoryColumns = useMemo(() => getFactoryColumns(openMonitoringPointDialog), [openMonitoringPointDialog])
  const requestColumns = useMemo(
    () =>
      getRequestColumns(
        openRequestDocument,
        isOperator,
      ),
    [isOperator, openRequestDocument],
  )
  const table = useMemo(
    () =>
      effectiveSubMenu === 'factories'
        ? {
            title: 'รายชื่อโรงงาน',
            columns: factoryColumns,
            rows: factoryRows,
            loading: isLoadingFactories,
            error: factoriesError,
          }
        : {
            title: 'รายการคำขอ',
            columns: requestColumns,
            rows: requestRows,
            loading: isLoadingRequests,
            error: requestsError,
          },
    [
      effectiveSubMenu,
      factoriesError,
      factoryColumns,
      factoryRows,
      isLoadingFactories,
      isLoadingRequests,
      requestColumns,
      requestRows,
      requestsError,
    ],
  )
  const isStatisticsSubMenu = effectiveSubMenu === 'statistics'

  return (
    <>
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
              แจ้งแบบ กวภ.01 - กวภ. 05
            </Typography>
            <Tabs
              value={effectiveSubMenu}
              onChange={(_, value) => setSelectedSubMenu(value)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="เมนูย่อยแจ้งแบบ กวภ.01 - กวภ. 05"
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
            <OfficerStatisticsPanel title="สถิติข้อมูลแบบแจ้ง กวภ.01 - กวภ.05" />
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
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {table.error ? (
              <Alert severity="error" sx={{ borderRadius: 0 }}>
                {table.error}
              </Alert>
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
        )}
      </Stack>
      <MonitoringPointDialog
        open={Boolean(monitoringPointContext)}
        context={monitoringPointContext}
        rows={monitoringPointRows}
        loading={isLoadingMonitoringPoint}
        error={monitoringPointError}
        onClose={closeMonitoringPointDialog}
        onSelectForm={(form) => {
          openFormBottomSheet(form)
          setMonitoringPointContext(null)
        }}
      />
      <KwpFormBottomSheet
        key={
          selectedForm
            ? `${selectedForm.requestNo ?? 'new'}-${selectedForm.code ?? 'form'}-${selectedForm.point?.code ?? 'point'}-${selectedForm.mode ?? 'create'}`
            : 'empty-form'
        }
        open={isFormSheetOpen}
        form={selectedForm}
        accessToken={accessToken}
        onClose={closeFormBottomSheet}
        onExited={clearClosedFormBottomSheet}
        onSubmitted={handleFormSubmitted}
      />
      <Kwp01PreviewDialog
        open={Boolean(requestDocument)}
        data={requestDocument?.data}
        mode={requestDocument?.mode}
        loading={Boolean(requestDocument?.loading)}
        submitError={requestDocument?.error ?? ''}
        onClose={() => setRequestDocument(null)}
        onRequestRevision={requestKwpDocumentRevision}
        onApprove={approveKwpDocument}
      />
    </>
  )
}

export default KwpFormsPage
