import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  Grid,
  IconButton,
  MenuItem,
  Paper,
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
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { DataGrid } from '@mui/x-data-grid'
import OfficerStatisticsPanel from '../components/OfficerStatisticsPanel'

const appBarHeight = {
  xs: 64,
  md: 72,
}

const bodCodDeviationReportsApiBaseUrl = import.meta.env.DEV
  ? '/api-proxy/v1/bod-cod-deviation-reports'
  : 'https://d-poms.diw.go.th/api/v1/bod-cod-deviation-reports'

const operatorSubMenus = [
  { value: 'factories', label: 'รายชื่อโรงงาน' },
  { value: 'history', label: 'ประวัติการรายงาน' },
]

const officerSubMenus = [
  { value: 'reports', label: 'รายการส่งแบบรายงาน' },
  { value: 'statistics', label: 'สถิติข้อมูล' },
]

const currentDate = new Date()
const currentMonth = currentDate.getMonth() + 1
const currentBuddhistYear = currentDate.getFullYear() + 543
const isFirstRoundPeriod = currentMonth >= 1 && currentMonth <= 6
const isSecondRoundPeriod = currentMonth >= 7 && currentMonth <= 12

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

const waitingStatusSx = {
  bgcolor: '#5b21b6',
  borderColor: '#5b21b6',
  color: '#ffffff',
}

function StatusChip({ value }) {
  if (value === '-') {
    return <Typography variant="body2">-</Typography>
  }

  if (
    [
      'รอพิจารณา',
      'แก้ไขแล้ว/รอพิจารณา',
      'SUBMITTED',
      'REVISED_PENDING_REVIEW',
    ].includes(value)
  ) {
    return <Chip label={value} size="small" variant="outlined" sx={{ ...waitingStatusSx, fontWeight: 300 }} />
  }

  const color =
    value === 'ผ่านการพิจารณา' || value === 'APPROVED'
      ? 'success'
      : value === 'รอโรงงานแก้ไข' || value === 'REVISION_REQUESTED'
        || value === 'รอทบทวน'
        || value === 'รออนุมัติ'
        || value === 'WAITING_REVIEW'
        || value === 'WAITING_APPROVAL'
        ? 'warning'
        : value === 'กรอกแบบแจ้งผล' || value === 'WAITING_RESULT_NOTICE'
          ? 'info'
          : 'default'

  return <Chip size="small" color={color} label={value || '-'} variant={color === 'default' ? 'outlined' : 'filled'} />
}

function hasBodCodParameter(parameters = '') {
  return /\b(BOD|COD)\b/i.test(parameters)
}

async function readBodCodApiResponse(result, fallbackMessage) {
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

function toNumberOrNull(value) {
  if (value === '' || value === undefined || value === null) {
    return null
  }

  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

function formatThaiDateValue(value) {
  if (!value) return '-'

  if (typeof value === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    return value
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  const day = String(parsedDate.getDate()).padStart(2, '0')
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
  const year = parsedDate.getFullYear() + 543

  return `${day}/${month}/${year}`
}

function formatApiDateValue(value) {
  if (!value) return null

  if (typeof value === 'string') {
    const thaiDateMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (thaiDateMatch) {
      const [, day, month, year] = thaiDateMatch
      const christianYear = Number(year) > 2400 ? Number(year) - 543 : Number(year)

      return `${christianYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }

    const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoDateMatch) {
      return `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}`
    }
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  const year = parsedDate.getFullYear()
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
  const day = String(parsedDate.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function normalizeBodCodStatusHistory(detail = {}) {
  const history = detail.statusHistory ?? detail.history ?? detail.workflowHistory ?? detail.events

  if (Array.isArray(history)) {
    return history.map((item, index) => ({
      ...item,
      id: item.id ?? `${item.status ?? item.statusLabel ?? 'status'}-${index}`,
      status: item.status ?? '',
      statusLabel: item.statusLabel ?? item.status ?? '',
      note: item.note ?? null,
      changedAt: item.changedAt ?? item.date ?? null,
      changedDate: item.changedDate ?? null,
      changedBy: item.changedBy ?? item.changedByName ?? item.recorderName ?? null,
      changedById: item.changedById ?? null,
    }))
  }

  return []
}

function mapBodCodFactoryRow(row = {}, index = 0) {
  const measurementPoints = Array.isArray(row.measurementPoints)
    ? row.measurementPoints.map((point, pointIndex) => ({
        ...point,
        id: point.id ?? point.connectedMeasurementPointId ?? point.stationId ?? `point-${index}-${pointIndex}`,
        code: point.code ?? point.pointCode ?? point.stationId ?? '',
        name: point.name ?? point.pointName ?? '',
        type: point.type ?? point.systemType ?? point.pointType ?? '',
        parameters: point.parameters ?? (Array.isArray(point.parameterCodes) ? point.parameterCodes.join(', ') : ''),
        round1Status:
          point.round1Status ??
          point.reportSlots?.find((slot) => Number(slot.roundNo) === 1)?.statusLabel ??
          'ยังไม่ยื่น',
        round2Status:
          point.round2Status ??
          point.reportSlots?.find((slot) => Number(slot.roundNo) === 2)?.statusLabel ??
          'ยังไม่ยื่น',
      }))
    : []

  return {
    ...row,
    id: row.id ?? row.factoryId ?? row.newRegistrationNo ?? `factory-${index + 1}`,
    factoryId: row.factoryId ?? row.id ?? '',
    factoryName: row.factoryName ?? '',
    factoryRegistration: row.factoryRegistration ?? row.newRegistrationNo ?? '',
    newRegistrationNo: row.newRegistrationNo ?? row.factoryRegistration ?? '',
    oldRegistrationNo: row.oldRegistrationNo ?? '',
    industryType: row.industryType ?? '',
    province: row.province ?? row.provinceName ?? '',
    monitoringPointCount: Number(row.monitoringPointCount ?? measurementPoints.length),
    measurementPoints,
  }
}

const operatorPendingStatusCodes = [
  'SUBMITTED',
  'REVISED_PENDING_REVIEW',
  'WAITING_RESULT_NOTICE',
  'WAITING_REVIEW',
  'WAITING_APPROVAL',
]

function getBodCodDisplayStatus(row = {}, { isOperatorView = false } = {}) {
  if (isOperatorView && operatorPendingStatusCodes.includes(row.statusCode)) {
    return 'รอพิจารณา'
  }

  return row.status ?? row.statusLabel ?? row.statusCode ?? ''
}

function mapBodCodReportRow(row = {}, index = 0, options = {}) {
  const reportRoundNo = row.reportRoundNo ?? row.roundNo
  const displayStatus = getBodCodDisplayStatus(row, options)

  return {
    ...row,
    id: row.id ?? row.reportId ?? `report-${index + 1}`,
    factoryName: row.factoryName ?? '',
    factoryRegistration: row.factoryRegistration ?? row.factoryRegistrationNo ?? row.newRegistrationNo ?? '',
    province: row.province ?? row.provinceName ?? '',
    monitoringPointCode: row.monitoringPointCode ?? row.pointCode ?? '',
    monitoringPointName: row.monitoringPointName ?? row.pointName ?? '',
    reportRound: row.reportRound ?? (reportRoundNo ? `ครั้งที่ ${reportRoundNo}` : ''),
    roundNo: String(reportRoundNo ?? '').trim(),
    year: row.year ?? row.reportYear ?? currentBuddhistYear,
    reportNo: row.reportNo ?? '-',
    submittedDate: row.submittedDate ?? formatThaiDateValue(row.submittedAt),
    reviewedDate: row.reviewedDate ?? formatThaiDateValue(row.reviewedAt),
    status: displayStatus,
    statusCode: row.statusCode ?? '',
    statusLabel: displayStatus || row.statusLabel || row.status || '',
    statusHistory: normalizeBodCodStatusHistory(row),
    revisionNote: row.revisionNote ?? row.officerNote ?? row.revisionReason ?? '',
  }
}

function mapBodCodReportDetail(detail = {}, row = {}, options = {}) {
  const mappedRow = mapBodCodReportRow({ ...row, ...detail }, 0, options)
  const measurements = Array.isArray(detail.measurements) ? detail.measurements : []
  const measurementRows = measurements.map((measurement, index) => ({
    id: measurement.id ?? `measurement-${index + 1}`,
    sampleDate: formatThaiDateValue(measurement.sampleDate),
    sampleTime: measurement.sampleTime ?? '',
    deviceValue: measurement.deviceValueMgL ?? '',
    labValue: measurement.labValueMgL ?? '',
    errorValue: measurement.deviationValueMgL ?? calculateErrorValue(measurement.deviceValueMgL, measurement.labValueMgL),
    standardErrorValue: measurement.standardDeviationMgL ?? '',
  }))

  return {
    ...mappedRow,
    factoryId: detail.factoryId ?? row.factoryId ?? '',
    monitoringPointId: detail.monitoringPointId ?? detail.connectedMeasurementPointId ?? row.monitoringPointId ?? row.connectedMeasurementPointId,
    businessActivity: detail.businessActivity ?? row.businessActivity ?? '',
    factoryAddress: detail.factoryAddress ?? row.factoryAddress ?? '',
    wastewaterFlow: detail.wastewaterFlowM3PerHour ?? row.wastewaterFlow ?? '',
    samplerName: detail.samplerName ?? row.samplerName ?? '',
    officerRegistration: detail.officerRegistrationNo ?? row.officerRegistration ?? '',
    laboratoryName: detail.laboratoryName ?? row.laboratoryName ?? '',
    laboratoryRegistration: detail.laboratoryRegistrationNo ?? row.laboratoryRegistration ?? '',
    labReportNo: detail.labReportNo ?? row.labReportNo ?? '',
    analysisMethod: detail.analysisMethod ?? row.analysisMethod ?? '',
    deviceBrand: detail.deviceBrand ?? row.deviceBrand ?? '',
    deviceModel: detail.deviceModel ?? row.deviceModel ?? '',
    serialNo: detail.deviceSerialNo ?? row.serialNo ?? '',
    parameter: detail.selectedParameterCode ?? row.selectedParameterCode ?? row.parameter ?? '',
    reporterName: detail.reporterName ?? row.reporterName ?? '',
    reporterPosition: detail.reporterPosition ?? row.reporterPosition ?? '',
    measurementRows,
    measurements,
    attachments: Array.isArray(detail.attachments) ? detail.attachments : [],
    statusHistory: normalizeBodCodStatusHistory(detail).length ? normalizeBodCodStatusHistory(detail) : mappedRow.statusHistory,
    allowedActions: detail.allowedActions ?? row.allowedActions ?? [],
    currentStep: detail.currentStep ?? row.currentStep ?? null,
    steps: detail.steps ?? row.steps ?? [],
    resultNotice: detail.resultNotice ?? row.resultNotice ?? null,
  }
}

function isBodCodLocalFile(file) {
  return typeof File !== 'undefined' && file instanceof File
}

async function uploadBodCodAttachmentFile(file, accessToken) {
  const formData = new FormData()
  formData.append('file', file)

  const result = await fetch(`${bodCodDeviationReportsApiBaseUrl}/attachments`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  })
  const response = await readBodCodApiResponse(result, 'อัปโหลดไฟล์แนบไม่สำเร็จ')

  return response?.data ?? {}
}

async function buildBodCodAttachmentMetadata(files = [], attachmentType, accessToken) {
  const metadataList = await Promise.all(
    files.map(async (file) => (isBodCodLocalFile(file) ? uploadBodCodAttachmentFile(file, accessToken) : file)),
  )

  return metadataList.map((file) => ({
    attachmentType,
    originalFileName: file.originalFileName ?? file.name ?? '',
    storedFileName: file.storedFileName ?? null,
    mimeType: file.mimeType ?? file.type ?? null,
    fileSize: file.fileSize ?? file.size ?? null,
    storagePath: file.storagePath ?? null,
  }))
}

async function buildBodCodReportPayload(report = {}, accessToken = '') {
  const measurementRows = Array.isArray(report.measurementRows) ? report.measurementRows : []
  const attachmentFiles = report.attachmentFiles ?? {}
  const attachments = [
    ...(await buildBodCodAttachmentMetadata(attachmentFiles.samplePhotos ?? [], 'SAMPLE_PHOTO', accessToken)),
    ...(await buildBodCodAttachmentMetadata(attachmentFiles.devicePhotos ?? [], 'DEVICE_PHOTO', accessToken)),
    ...(await buildBodCodAttachmentMetadata(attachmentFiles.labReports ?? [], 'LAB_REPORT', accessToken)),
  ]

  return {
    reportRoundNo: Number(report.roundNo ?? report.reportRoundNo ?? String(report.reportRound ?? '').replace('ครั้งที่ ', '')) || null,
    reportYear: Number(report.year ?? report.reportYear) || currentBuddhistYear,
    factoryId: report.factoryId ?? report.id ?? '',
    factoryName: report.factoryName ?? '',
    factoryRegistrationNo: report.factoryRegistration ?? report.factoryRegistrationNo ?? '',
    businessActivity: report.businessActivity ?? null,
    factoryAddress: report.factoryAddress ?? null,
    provinceName: report.province ?? report.provinceName ?? null,
    connectedMeasurementPointId: report.monitoringPointId ?? report.connectedMeasurementPointId ?? report.pointId ?? null,
    pointCode: report.monitoringPointCode ?? report.pointCode ?? '',
    pointName: report.monitoringPointName ?? report.pointName ?? '',
    wastewaterFlowM3PerHour: toNumberOrNull(report.wastewaterFlow),
    samplerName: report.samplerName ?? null,
    officerRegistrationNo: report.officerRegistration ?? null,
    laboratoryName: report.laboratoryName ?? null,
    laboratoryRegistrationNo: report.laboratoryRegistration ?? null,
    labReportNo: report.labReportNo ?? null,
    analysisMethod: report.analysisMethod ?? null,
    deviceBrand: report.deviceBrand ?? null,
    deviceModel: report.deviceModel ?? null,
    deviceSerialNo: report.serialNo ?? null,
    selectedParameterCode: report.parameter ?? report.selectedParameterCode ?? '',
    reporterName: report.reporterName ?? null,
    reporterPosition: report.reporterPosition ?? null,
    revisionNote: report.revisionNote ?? undefined,
    measurements: measurementRows.map((measurement) => ({
      sampleDate: formatApiDateValue(measurement.sampleDate),
      sampleTime: measurement.sampleTime || null,
      deviceValueMgL: toNumberOrNull(measurement.deviceValue),
      labValueMgL: toNumberOrNull(measurement.labValue),
      standardDeviationMgL: toNumberOrNull(measurement.standardErrorValue),
    })),
    attachments,
  }
}

function buildBodCodResultNoticePayload(noticeForm = {}) {
  const checkedParameters = Array.isArray(noticeForm.checkedParameters)
    ? noticeForm.checkedParameters
    : [noticeForm.checkedParameters]
  const uniqueCheckedParameters = [...new Set(checkedParameters.map((value) => String(value ?? '').trim()).filter(Boolean))]

  return {
    reportCorrectness: noticeForm.reportCorrectness ?? '',
    checkedParameters: uniqueCheckedParameters,
    reviewResult: noticeForm.reviewResult ?? '',
    comment: String(noticeForm.comment ?? '').trim() || null,
    inspectorName: String(noticeForm.inspectorName ?? '').trim(),
    inspectorPosition: String(noticeForm.inspectorPosition ?? '').trim(),
  }
}

function PaperLine({ children, minWidth = 160 }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        minWidth,
        borderBottom: '1px dotted #222',
        px: 0.5,
        minHeight: 20,
      }}
    >
      {children}
    </Box>
  )
}

function getBodCodAttachmentUrl(file = {}) {
  const rawUrl =
    file.url ??
    file.downloadUrl ??
    file.fileUrl ??
    file.publicUrl ??
    file.signedUrl ??
    file.storageUrl ??
    file.storagePath ??
    file.filePath ??
    file.path ??
    ''

  if (!rawUrl) {
    return ''
  }

  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl
  }

  const normalizedPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`

  return import.meta.env.DEV ? normalizedPath : `https://d-poms.diw.go.th${normalizedPath}`
}

function buildBodCodPaperAttachmentFile(file = {}, index = 0) {
  return {
    id: file.id ?? `${getAttachmentFileName(file)}-${index}`,
    name: getAttachmentFileName(file),
    url: getBodCodAttachmentUrl(file),
  }
}

function BodCodPaperShell({ children }) {
  return (
    <Paper
      elevation={0}
      sx={{
        width: 794,
        minHeight: 1123,
        mx: 'auto',
        p: '42px 56px',
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

function BodCodAttachmentPreviewFile({ file }) {
  if (!file?.name) {
    return <Typography sx={{ fontSize: 13 }}>-</Typography>
  }

  return file.url ? (
    <Typography
      component="a"
      href={file.url}
      download={file.name}
      target="_blank"
      rel="noreferrer"
      sx={{
        color: 'primary.main',
        cursor: 'pointer',
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

function BodCodAttachmentPreviewTable({ title, files }) {
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
                  <BodCodAttachmentPreviewFile file={file} />
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

function parseReportHistoryDate(value) {
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

function formatReportHistoryDate(value) {
  const parsedDate = parseReportHistoryDate(value)
  if (!parsedDate) return '-'

  const day = String(parsedDate.getDate()).padStart(2, '0')
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
  const year = parsedDate.getFullYear() + 543

  return `${day}/${month}/${year}`
}

function formatReportHistoryDuration(startValue, endValue, fallbackValue) {
  if (fallbackValue) return fallbackValue

  const startDate = parseReportHistoryDate(startValue)
  const endDate = parseReportHistoryDate(endValue)
  if (!startDate || !endDate) return ''

  const diffMs = Math.max(0, endDate.getTime() - startDate.getTime())
  const totalDays = Math.max(1, Math.ceil(diffMs / 86_400_000))

  return `${totalDays} วัน`
}

function getReportStatusHistoryItems(history = []) {
  return history
    .filter(Boolean)
    .map((item, index) => ({
      ...item,
      __index: index,
      __date: item.changedAt ?? item.changedDate ?? item.date ?? null,
    }))
    .sort((a, b) => {
      const dateA = parseReportHistoryDate(a.__date)?.getTime() ?? 0
      const dateB = parseReportHistoryDate(b.__date)?.getTime() ?? 0

      if (dateA !== dateB) {
        return dateA - dateB
      }

      return a.__index - b.__index
    })
}

function buildFallbackReportStatusHistory(report = {}) {
  const safeReport = report ?? {}

  if (Array.isArray(safeReport.statusHistory) && safeReport.statusHistory.length > 0) {
    return safeReport.statusHistory
  }

  return []
}

function getLatestReportRevisionMessage(report = {}) {
  const safeReport = report ?? {}

  if (safeReport.revisionNote || safeReport.officerNote) {
    return safeReport.revisionNote ?? safeReport.officerNote
  }

  const history = Array.isArray(safeReport.statusHistory) ? safeReport.statusHistory : []
  const revisionItem = [...history].reverse().find((item) => item.statusLabel === 'รอโรงงานแก้ไข')

  return revisionItem?.note ?? ''
}

function ReportStatusHistoryDialog({ open, history = [], onClose }) {
  const items = useMemo(() => getReportStatusHistoryItems(history), [history])

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
              const duration = formatReportHistoryDuration(
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
                        วันที่: {item.changedDate ?? formatReportHistoryDate(item.__date)}
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

function BodCodPaperDocument({ report }) {
  const rowsForPaper = report.measurementRows?.length
    ? report.measurementRows
    : [{ id: 'empty-1' }]
  const roundNo = report.roundNo ?? report.reportRound?.replace('ครั้งที่ ', '') ?? ''
  const selectedParameters = Array.isArray(report.parameter) ? report.parameter : [report.parameter].filter(Boolean)
  const attachmentFiles = getBodCodAttachmentFiles(report)
  const attachmentSections = [
    {
      key: 'samplePhotos',
      title: 'ภาพถ่ายขณะเก็บตัวอย่าง',
      files: attachmentFiles.samplePhotos.map(buildBodCodPaperAttachmentFile),
    },
    {
      key: 'devicePhotos',
      title: 'ภาพหน้าเครื่องมือตรวจวัดที่แสดง ณ เวลาที่เก็บตัวอย่าง',
      files: attachmentFiles.devicePhotos.map(buildBodCodPaperAttachmentFile),
    },
    {
      key: 'labReports',
      title: 'รายงานผลจากห้องปฏิบัติการ',
      files: attachmentFiles.labReports.map(buildBodCodPaperAttachmentFile),
    },
  ]

  return (
    <Stack spacing={2} sx={{ alignItems: 'center' }}>
      <BodCodPaperShell>
        <Stack spacing={1.6}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
              แบบรายงานผลการตรวจสอบความคลาดเคลื่อนของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ
            </Typography>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
              และเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติม
            </Typography>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
              ครั้งที่ <PaperLine minWidth={70}>{roundNo}</PaperLine>/ปี<PaperLine minWidth={90}>{report.year}</PaperLine>
            </Typography>
          </Box>

          <Box>
            ชื่อบริษัท : <PaperLine minWidth={330}>{report.factoryName}</PaperLine>
          </Box>
          <Box>
            เลขทะเบียนโรงงาน : <PaperLine minWidth={170}>{report.factoryRegistration}</PaperLine>
            ประกอบกิจการ : <PaperLine minWidth={220}>{report.businessActivity}</PaperLine>
          </Box>
          <Box>
            สถานที่ตั้ง : <PaperLine minWidth={520}>{report.factoryAddress}</PaperLine>
          </Box>
          <Box>
            ปริมาณการระบายน้ำทิ้งขณะเก็บตัวอย่าง : <PaperLine minWidth={260}>{report.wastewaterFlow}</PaperLine> ลบ.ม./ชั่วโมง
          </Box>
          <Box>
            ผู้เก็บตัวอย่าง : <PaperLine minWidth={245}>{report.samplerName}</PaperLine>
            ทะเบียนเจ้าหน้าที่ : <PaperLine minWidth={180}>{report.officerRegistration}</PaperLine>
          </Box>
          <Box>
            หน่วยงาน/ชื่อห้องปฏิบัติการ : <PaperLine minWidth={420}>{report.laboratoryName}</PaperLine>
          </Box>
          <Box>
            ทะเบียนห้องปฏิบัติการ : <PaperLine minWidth={170}>{report.laboratoryRegistration}</PaperLine>
            เลขที่ใบรายงานผลวิเคราะห์ : <PaperLine minWidth={170}>{report.labReportNo}</PaperLine>
          </Box>
          <Box>
            วิธีวิเคราะห์ทดสอบในห้องปฏิบัติการ : <PaperLine minWidth={420}>{report.analysisMethod}</PaperLine>
          </Box>
          <Box>
            รายละเอียดของเครื่องมือหรือเครื่องอุปกรณ์พิเศษฯ : ยี่ห้อ (Brand) : <PaperLine minWidth={210}>{report.deviceBrand}</PaperLine>
          </Box>
          <Box>
            รุ่น (Model) : <PaperLine minWidth={210}>{report.deviceModel}</PaperLine>
            หมายเลขเครื่อง (Serial No.) : <PaperLine minWidth={200}>{report.serialNo}</PaperLine>
          </Box>
          <Box>
            รายการที่ตรวจสอบค่าความคลาดเคลื่อน :{' '}
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, mr: 2 }}>
              <Box component="span" sx={{ width: 16, height: 16, border: '1px solid #333' }}>{selectedParameters.includes('BOD') ? '/' : ''}</Box>
              BOD
            </Box>
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
              <Box component="span" sx={{ width: 16, height: 16, border: '1px solid #333' }}>{selectedParameters.includes('COD') ? '/' : ''}</Box>
              COD
            </Box>
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
                  textAlign: 'center',
                  verticalAlign: 'middle',
                },
                '& th': {
                  bgcolor: '#c9c9c9',
                  fontWeight: 700,
                },
              }}
            >
              <TableHead>
                <TableRow>
                  {[
                    'วันที่เก็บตัวอย่าง',
                    'เวลาที่เก็บตัวอย่าง',
                    'ค่าที่เครื่องมือตรวจวัดได้ (มก./ลิตร) (M)',
                    'ค่าที่ห้องปฏิบัติการวิเคราะห์ได้ (มก./ลิตร) (T)',
                    'ค่าความคลาดเคลื่อน (มก./ลิตร) (E)',
                    'ค่าความคลาดเคลื่อนตามประกาศฯ (มก./ลิตร)',
                  ].map((column) => (
                    <TableCell key={column}>{column}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rowsForPaper.map((row) => (
                  <TableRow key={row.id} sx={{ height: 88 }}>
                    <TableCell>{row.sampleDate}</TableCell>
                    <TableCell>{row.sampleTime}</TableCell>
                    <TableCell>{row.deviceValue}</TableCell>
                    <TableCell>{row.labValue}</TableCell>
                    <TableCell>{row.errorValue}</TableCell>
                    <TableCell>{row.standardErrorValue}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ fontSize: 13 }}>
            <Box sx={{ fontWeight: 700 }}>หมายเหตุ</Box>
            <Box>1. คำนวณค่าความคลาดเคลื่อน โดยใช้สูตร E = M - T</Box>
            <Box>
              โดย E = ค่าความคลาดเคลื่อนของเครื่องตรวจวัดค่า BOD หรือเครื่องตรวจวัดค่า COD (มิลลิกรัมต่อลิตร)
            </Box>
            <Box>
              M = ผลการตรวจวัดค่า BOD หรือ COD ที่ได้จากเครื่องมือหรือเครื่องอุปกรณ์พิเศษขณะเก็บตัวอย่างน้ำ
            </Box>
            <Box>
              T = ผลการตรวจวัดค่า BOD หรือ COD ที่ได้จากห้องปฏิบัติการ (มิลลิกรัมต่อลิตร)
            </Box>
            <Box>2. ในกรณีที่ผลตรวจวัดค่า BOD หรือ COD น้อยกว่าขีดจำกัดในการวิเคราะห์ของห้องปฏิบัติการให้ใช้ค่าจริงที่วิเคราะห์ได้ในการคำนวณ</Box>
            <Box>3. การปัดเศษ ให้เป็นไปตาม มอก.929-2533</Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Box sx={{ width: 360, fontSize: 13, lineHeight: 1.8 }}>
              <Box>ผู้รายงานผลการทดสอบ <PaperLine minWidth={180}>{report.reporterName}</PaperLine></Box>
              <Box sx={{ textAlign: 'center' }}>(<PaperLine minWidth={250} />)</Box>
              <Box>ตำแหน่ง <PaperLine minWidth={250}>{report.reporterPosition}</PaperLine></Box>
              <Box>ลงวันที่ <PaperLine minWidth={230} /></Box>
            </Box>
          </Box>
        </Stack>
      </BodCodPaperShell>
      <BodCodPaperShell>
        <Stack spacing={2}>
          <Typography sx={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
            เอกสารแนบ
          </Typography>
          <Stack spacing={2}>
            {attachmentSections.map((section) => (
              <Box key={section.key}>
                <BodCodAttachmentPreviewTable title={section.title} files={section.files} />
              </Box>
            ))}
          </Stack>
        </Stack>
      </BodCodPaperShell>
    </Stack>
  )
}

function ReportPreviewDialog({
  open,
  report,
  mode = 'view',
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
  const [revisionError, setRevisionError] = useState('')
  const statusHistory = report ? buildFallbackReportStatusHistory(report) : []
  const reportStatusValues = [report?.status, report?.statusCode, report?.statusLabel].filter(Boolean)
  const isWaitingApproval = reportStatusValues.some((status) => ['WAITING_APPROVAL', 'รออนุมัติ'].includes(status))
  const handleDownload = () => {
    if (!report) return

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${report.reportNo || 'bod-cod-report'}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  const closePreviewDialog = () => {
    setStatusHistoryOpen(false)
    onClose?.()
  }
  const closeRevisionDialog = () => {
    if (revisionSubmitting) {
      return
    }

    setRevisionDialogOpen(false)
    setRevisionOfficerNote('')
    setRevisionError('')
  }
  const requestRevisionReport = async () => {
    const officerNote = revisionOfficerNote.trim()

    if (!officerNote) {
      setRevisionError('กรุณาระบุรายละเอียดการแจ้งแก้ไข')
      return
    }

    setRevisionSubmitting(true)
    setRevisionError('')

    try {
      await onRequestRevision?.(report, officerNote)
      setRevisionSubmitting(false)
      setRevisionDialogOpen(false)
      setRevisionOfficerNote('')
      setRevisionError('')
    } catch (error) {
      setRevisionSubmitting(false)
      setRevisionError(error instanceof Error ? error.message : 'แจ้งแก้ไขไม่สำเร็จ')
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
            แบบฟอร์มรายงานค่าความคลาดเคลื่อน BOD/COD
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<HistoryIcon />}
              disabled={!report}
              onClick={() => setStatusHistoryOpen(true)}
            >
              ประวัติสถานะ
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<FileDownloadIcon />}
              disabled={!report}
              onClick={handleDownload}
            >
              ดาวน์โหลด
            </Button>
            <IconButton aria-label="ปิด" onClick={closePreviewDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: 'neutral.100' }}>
          {report ? <BodCodPaperDocument report={report} /> : null}
        </DialogContent>
        {submitError ? (
          <Alert severity="error" sx={{ borderRadius: 0 }}>
            {submitError}
          </Alert>
        ) : null}
        {mode === 'view' ? null : (
          <DialogActions sx={{ justifyContent: 'center' }}>
            {mode === 'review' ? (
              <>
                <Button variant="outlined" color="inherit" disabled={submitting} onClick={closePreviewDialog}>
                  ยกเลิก
                </Button>
                <Button variant="outlined" color="warning" disabled={submitting || !report} onClick={() => setRevisionDialogOpen(true)}>
                  แจ้งแก้ไข
                </Button>
                <Button variant="contained" disabled={submitting || !report} onClick={() => onApprove?.(report)}>
                  {submitting
                    ? isWaitingApproval
                      ? 'กำลังอนุมัติ'
                      : 'กำลังผ่านการพิจารณา'
                    : isWaitingApproval
                      ? 'อนุมัติ'
                      : 'ผ่านการพิจารณา'}
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
            ) : mode === 'submit' ? (
              <>
                <Button variant="outlined" color="inherit" disabled={submitting} onClick={closePreviewDialog}>
                  ยกเลิก
                </Button>
                <Button variant="contained" disabled={submitting || !report} onClick={() => onSubmit?.(report)}>
                  {submitting ? 'กำลังส่งแบบฟอร์ม' : 'ยืนยันการส่งแบบฟอร์ม'}
                </Button>
              </>
            ) : mode === 'edit' ? (
              <>
                <Button variant="outlined" color="inherit" disabled={submitting} onClick={closePreviewDialog}>
                  ยกเลิก
                </Button>
                <Button variant="contained" disabled={submitting || !report} onClick={() => onSubmit?.(report)}>
                  {submitting ? 'กำลังบันทึกการแก้ไข' : 'บันทึกการแก้ไข'}
                </Button>
              </>
            ) : null}
          </DialogActions>
        )}
      </Dialog>
      <ReportStatusHistoryDialog
        open={statusHistoryOpen}
        history={statusHistory}
        onClose={() => setStatusHistoryOpen(false)}
      />
      <Dialog open={revisionDialogOpen} onClose={closeRevisionDialog} fullWidth maxWidth="sm">
        <DialogTitle>แจ้งแก้ไขรายงาน</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              ระบุหมายเหตุเจ้าหน้าที่สำหรับแจ้งให้ผู้ประกอบการแก้ไขรายงานค่าความคลาดเคลื่อน BOD/COD
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
          <Button variant="contained" disabled={revisionSubmitting} onClick={requestRevisionReport}>
            {revisionSubmitting ? 'กำลังแจ้งแก้ไข' : 'ยืนยันแจ้งแก้ไข'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

function isBangkokProvince(province = '') {
  return province.includes('กรุงเทพ') || province.includes('กทม')
}

function NoticeBoldText({ children }) {
  return (
    <Box component="span" sx={{ fontWeight: 700 }}>
      {children}
    </Box>
  )
}

function ResultNoticePaperDocument({ report }) {
  const isCentral = isBangkokProvince(report.province)
  const noticeForm = getResultNoticeFormValues(report)
  const checkedParameters = Array.isArray(report?.resultNotice?.checkedParameters)
    ? report.resultNotice.checkedParameters
    : [noticeForm.checkedParameters]
  const hasCheckedParameter = (parameter) => checkedParameters.includes(parameter)
  const isCorrectReport = noticeForm.reportCorrectness === 'ถูกต้องครบถ้วน'
  const isIncorrectReport = noticeForm.reportCorrectness === 'ไม่ถูกต้องครบถ้วน'
  const shouldNotifyResult = noticeForm.reviewResult === 'เห็นควรแจ้งผลการตรวจสอบ'
  const shouldRequestCorrection = noticeForm.reviewResult === 'เห็นควรให้แก้ไขเพิ่มเติม'
  const noticeTitle = `แบบแจ้งผลการตรวจสอบ (${isCentral ? 'ส่วนกลาง' : 'ส่วนภูมิภาค'})`
  const checkboxSx = {
    width: 16,
    height: 16,
    border: '2px solid #111',
    display: 'inline-block',
    flex: '0 0 auto',
    mt: 0.45,
  }
  const checkboxMark = (checked) => (
    <Box component="span" sx={{ ...checkboxSx, textAlign: 'center', lineHeight: '12px', fontSize: 13, fontWeight: 700 }}>
      {checked ? '✓' : ''}
    </Box>
  )
  const signatureBlock = (role, position = '') => (
    <Box sx={{ width: 250, textAlign: 'center', fontSize: 14, lineHeight: 1.55 }}>
      <Box sx={{ borderBottom: '1px dotted #111', height: 22 }} />
      <Box>(
        <Box component="span" sx={{ display: 'inline-block', minWidth: 220, borderBottom: '1px dotted #111' }}>
          {role === 'ผู้ตรวจสอบ' ? noticeForm.inspectorName : ''}
        </Box>
        )
      </Box>
      <Box>
        ตำแหน่ง{' '}
        <Box component="span" sx={{ display: 'inline-block', minWidth: 150, borderBottom: '1px dotted #111' }}>
          {role === 'ผู้ตรวจสอบ' ? noticeForm.inspectorPosition : position}
        </Box>
      </Box>
      <Box>{role}</Box>
      <Box>......../........../..........</Box>
    </Box>
  )

  return (
    <Paper
      elevation={0}
      sx={{
        width: 794,
        minHeight: 1123,
        mx: 'auto',
        p: '24px 26px',
        color: '#000',
        bgcolor: '#fff',
        fontFamily: 'Kanit, sans-serif',
        fontSize: 14.5,
        lineHeight: 1.5,
      }}
    >
      <Stack
        spacing={1.65}
        sx={{
          minHeight: 1075,
          border: '1px solid #333',
          px: 2.25,
          py: 2.75,
        }}
      >
        <Box sx={{ textAlign: 'center', textDecoration: 'underline', mb: 2.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15.5 }}>{noticeTitle}</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 15, maxWidth: 690, mx: 'auto' }}>
            การรายงานค่าความคลาดเคลื่อนของเครื่องมือหรือเครื่องอุปกรณ์พิเศษและเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติมสำหรับตรวจวัด
          </Typography>
        </Box>

        <Box>
          <Box>
            สำหรับโรงงาน : <PaperLine minWidth={245}>{report.factoryName}</PaperLine>
            การรายงานครั้งที่ <PaperLine minWidth={245}>{report.reportRound}</PaperLine>
          </Box>
          <Box>
            ทะเบียนโรงงานเลขที่ : <PaperLine minWidth={215}>{report.factoryRegistration}</PaperLine>
            อ้างอิงรายงานวันที่ : <PaperLine minWidth={230}>{report.submittedDate}</PaperLine>
          </Box>
        </Box>

        <Box sx={{ fontWeight: 700 }}>
          1. ความถูกต้องของแบบรายงาน{' '}
          <Box component="span" sx={{ mx: 0.75, verticalAlign: 'middle' }}>{checkboxMark(hasCheckedParameter('BOD'))}</Box> BOD{' '}
          <Box component="span" sx={{ mx: 0.75, verticalAlign: 'middle' }}>{checkboxMark(hasCheckedParameter('COD'))}</Box> COD
        </Box>
        <Stack spacing={0.8} sx={{ pl: 3.5, mt: -1 }}>
          <Stack direction="row" spacing={1.35}>
            {checkboxMark(isCorrectReport)}
            <Box>
              แบบรายงาน<NoticeBoldText>ถูกต้องครบถ้วน</NoticeBoldText>ตามประกาศกรมโรงงานอุตสาหกรรม เรื่อง หลักเกณฑ์การให้ความเห็นชอบให้โรงงานที่ต้องมีระบบบำบัดน้ำเสียต้องติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษและเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติม (ฉบับที่ 2) พ.ศ. 2565
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.35}>
            {checkboxMark(isIncorrectReport)}
            <Box>
              แบบรายงาน<NoticeBoldText>ไม่ถูกต้องครบถ้วน</NoticeBoldText>ตามประกาศกรมโรงงานอุตสาหกรรม เรื่อง หลักเกณฑ์การให้ความเห็นชอบให้โรงงานที่ต้องมีระบบบำบัดน้ำเสียต้องติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษและเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติม (ฉบับที่ 2) พ.ศ. 2565 เนื่องจาก <PaperLine minWidth={260}>{isIncorrectReport ? noticeForm.comment : ''}</PaperLine>
              <Box sx={{ borderBottom: '1px dotted #111', minHeight: 20 }} />
              <Box sx={{ borderBottom: '1px dotted #111', minHeight: 20 }} />
            </Box>
          </Stack>
        </Stack>

        <Box sx={{ fontWeight: 700 }}>
          2.ค่าความคลาดเคลื่อน{' '}
          <Box component="span" sx={{ mx: 0.75, verticalAlign: 'middle' }}>{checkboxMark(hasCheckedParameter('BOD'))}</Box> BOD{' '}
          <Box component="span" sx={{ mx: 0.75, verticalAlign: 'middle' }}>{checkboxMark(hasCheckedParameter('COD'))}</Box> COD
        </Box>
        <Stack spacing={0.8} sx={{ pl: 3.5, mt: -1 }}>
          <Stack direction="row" spacing={1.35}>
            {checkboxMark(shouldNotifyResult)}
            <Box>
              <NoticeBoldText>เป็นไปตามประกาศ</NoticeBoldText>กรมโรงงานอุตสาหกรรม เรื่อง หลักเกณฑ์การให้ความเห็นชอบให้โรงงานที่ต้องมีระบบบำบัดน้ำเสียต้องติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษและเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติม พ.ศ. 2550
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.35}>
            {checkboxMark(shouldRequestCorrection)}
            <Box>
              <NoticeBoldText>ไม่เป็นตามประกาศ</NoticeBoldText>กรมโรงงานอุตสาหกรรม เรื่อง หลักเกณฑ์การให้ความเห็นชอบให้โรงงานที่ต้องมีระบบบำบัดน้ำเสียต้องติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษและเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติม พ.ศ. 2550
            </Box>
          </Stack>
        </Stack>

        <Box sx={{ mt: 3.5 }}>
          <NoticeBoldText>หมายเหตุ</NoticeBoldText> : ในกรณีที่การบันทึกข้อมูลในแบบรายงานไม่ถูกต้องและหรือค่าความเคลื่อนไม่เป็นไปตามประกาศฯ
          <Box sx={{ pl: 7 }}>กรมโรงงานอุตสาหกรรมจะดำเนินการแจ้งผลการตรวจสอบไปยังหน่วยงานกำกับ</Box>
        </Box>

        <Box sx={{ flex: 1 }} />

        {isCentral ? (
          <Stack spacing={4} sx={{ alignItems: 'center' }}>
            <Stack direction="row" spacing={10} sx={{ justifyContent: 'center' }}>
              {signatureBlock('ผู้ตรวจสอบ')}
              {signatureBlock('ผู้ทบทวน', 'ผอ.กฝม.')}
            </Stack>
            {signatureBlock('ผู้อนุมัติ', 'ผอ.กวภ.')}
          </Stack>
        ) : (
          <Stack direction="row" spacing={10} sx={{ justifyContent: 'center' }}>
            {signatureBlock('ผู้ตรวจสอบ')}
            {signatureBlock('ผู้อนุมัติ', 'ผอ.ศวภ.')}
          </Stack>
        )}

        <Box sx={{ flex: 0.75 }} />

        <Box sx={{ fontSize: 14 }}>
          {isCentral ? (
            <>
              <Box>
                <NoticeBoldText>สอบถามข้อมูลเพิ่มเติมได้ที่</NoticeBoldText> : ศูนย์เฝ้าระวังสิ่งแวดล้อมอุตสาหกรรม กลุ่มเฝ้าระวังและเตือนภัยมลพิษโรงงาน
              </Box>
              <Box sx={{ pl: 24 }}>โทรศัพท์ : 02-4306312 ต่อ 2109&nbsp;&nbsp; Line : @iemcdiw</Box>
              <Box sx={{ pl: 24 }}>
                ไปรษณีย์อิเล็กทรอนิกส์ : <Box component="span" sx={{ color: '#0645ad', textDecoration: 'underline' }}>poms.support@diw.mail.go.th</Box>
              </Box>
            </>
          ) : (
            <>
              <Box>
                <NoticeBoldText>สอบถามข้อมูลเพิ่มเติมได้ที่</NoticeBoldText> : ศูนย์วิจัยและเตือนภัยมลพิษโรงงานภาค <PaperLine minWidth={190} />
              </Box>
              <Box sx={{ pl: 24 }}>โทรศัพท์ : 02-4306312 ต่อ <PaperLine minWidth={130} /></Box>
              <Box sx={{ pl: 24 }}>ไปรษณีย์อิเล็กทรอนิกส์ : <PaperLine minWidth={220} />(ของแต่ละศูนย์)</Box>
            </>
          )}
        </Box>
      </Stack>
    </Paper>
  )
}

const defaultResultNoticeForm = {
  reportCorrectness: '',
  checkedParameters: '',
  reviewResult: '',
  comment: '',
  inspectorName: '',
  inspectorPosition: '',
}

function getResultNoticeFormValues(report = {}) {
  const resultNotice = report?.resultNotice ?? {}
  const checkedParameters = Array.isArray(resultNotice.checkedParameters)
    ? resultNotice.checkedParameters
    : [resultNotice.checkedParameters]
  const firstCheckedParameter = checkedParameters.find((value) => value) ?? report?.parameter ?? defaultResultNoticeForm.checkedParameters

  return {
    reportCorrectness: resultNotice.reportCorrectness ?? defaultResultNoticeForm.reportCorrectness,
    checkedParameters: firstCheckedParameter,
    reviewResult: resultNotice.reviewResult ?? defaultResultNoticeForm.reviewResult,
    comment: resultNotice.comment ?? defaultResultNoticeForm.comment,
    inspectorName: resultNotice.inspectorName ?? defaultResultNoticeForm.inspectorName,
    inspectorPosition: resultNotice.inspectorPosition ?? defaultResultNoticeForm.inspectorPosition,
  }
}

function ResultNoticeDialog({ open, report, mode = 'view', submitting = false, submitError = '', onClose, onConfirm }) {
  const [noticeForm, setNoticeForm] = useState(() => getResultNoticeFormValues(report))
  const [statusHistoryOpen, setStatusHistoryOpen] = useState(false)
  const title = report && isBangkokProvince(report.province)
    ? 'แบบแจ้งผล (ส่วนกลาง)'
    : 'แบบแจ้งผล (ส่วนภูมิภาค)'
  const isEditMode = mode === 'edit'
  const statusHistory = report ? buildFallbackReportStatusHistory(report) : []
  const updateNoticeForm = (field, value) => {
    setNoticeForm((current) => ({ ...current, [field]: value }))
  }
  const handleDownload = () => {
    if (!report) return

    const blob = new Blob([JSON.stringify(report.resultNotice ?? report, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${report.reportNo || 'bod-cod-result-notice'}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  const closeDialog = () => {
    setStatusHistoryOpen(false)
    onClose?.()
  }

  return (
    <>
      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="lg">
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
            {title}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<HistoryIcon />}
              disabled={!report}
              onClick={() => setStatusHistoryOpen(true)}
            >
              ประวัติสถานะ
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<FileDownloadIcon />}
              disabled={!report}
              onClick={handleDownload}
            >
              ดาวน์โหลด
            </Button>
            <IconButton aria-label="ปิด" onClick={closeDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: isEditMode ? 'background.default' : 'neutral.100' }}>
          {report && isEditMode ? (
            <Stack spacing={2}>
              <SectionPaper title="ข้อมูลรายงาน">
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ReadOnlyField label="ชื่อโรงงาน" value={report.factoryName} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="เลขทะเบียนโรงงาน" value={report.factoryRegistration} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="รอบรายงาน" value={`${report.reportRound}/${report.year}`} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="รหัสจุดตรวจวัด" value={report.monitoringPointCode} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="วันที่ยื่นรายงาน" value={report.submittedDate} />
                  </Grid>
                </Grid>
              </SectionPaper>

              <SectionPaper title="ผลการตรวจสอบแบบรายงาน">
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      select
                      label="ความถูกต้องของแบบรายงาน"
                      size="small"
                      value={noticeForm.reportCorrectness}
                      onChange={(event) => updateNoticeForm('reportCorrectness', event.target.value)}
                      fullWidth
                    >
                      <MenuItem value="ถูกต้องครบถ้วน">ถูกต้องครบถ้วน</MenuItem>
                      <MenuItem value="ไม่ถูกต้องครบถ้วน">ไม่ถูกต้องครบถ้วน</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      select
                      label="รายการที่ตรวจสอบ"
                      size="small"
                      value={noticeForm.checkedParameters}
                      onChange={(event) => updateNoticeForm('checkedParameters', event.target.value)}
                      fullWidth
                    >
                      <MenuItem value="BOD">BOD</MenuItem>
                      <MenuItem value="COD">COD</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      select
                      label="ผลการพิจารณา"
                      size="small"
                      value={noticeForm.reviewResult}
                      onChange={(event) => updateNoticeForm('reviewResult', event.target.value)}
                      fullWidth
                    >
                      <MenuItem value="เห็นควรแจ้งผลการตรวจสอบ">เห็นควรแจ้งผลการตรวจสอบ</MenuItem>
                      <MenuItem value="เห็นควรให้แก้ไขเพิ่มเติม">เห็นควรให้แก้ไขเพิ่มเติม</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="หมายเหตุ / รายละเอียดเพิ่มเติม"
                      size="small"
                      value={noticeForm.comment}
                      onChange={(event) => updateNoticeForm('comment', event.target.value)}
                      multiline
                      minRows={3}
                      fullWidth
                    />
                  </Grid>
                </Grid>
              </SectionPaper>
            </Stack>
          ) : null}
          {report && !isEditMode ? <ResultNoticePaperDocument report={report} /> : null}
        </DialogContent>
        {submitError ? (
          <Alert severity="error" sx={{ borderRadius: 0 }}>
            {submitError}
          </Alert>
        ) : null}
        {isEditMode ? (
          <DialogActions sx={{ justifyContent: 'center' }}>
            <Button variant="outlined" color="inherit" disabled={submitting} onClick={closeDialog}>
              ยกเลิก
            </Button>
            <Button variant="contained" loading={submitting} onClick={() => onConfirm?.(report, noticeForm)}>
              ส่งอนุมัติ
            </Button>
          </DialogActions>
        ) : null}
      </Dialog>
      <ReportStatusHistoryDialog
        open={statusHistoryOpen}
        history={statusHistory}
        onClose={() => setStatusHistoryOpen(false)}
      />
    </>
  )
}

function MonitoringPointDialog({ factory, open, onClose, onOpenReport }) {
  const rows = Array.isArray(factory?.measurementPoints) ? factory.measurementPoints : []

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
        <Typography component="span" variant="h6" sx={{ fontWeight: 700, minWidth: 0 }}>
          {factory?.factoryName ? `รายการจุดตรวจวัด - ${factory.factoryName}` : 'รายการจุดตรวจวัด'}
        </Typography>
        <IconButton aria-label="ปิด" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <TableContainer sx={{ border: 1, borderColor: 'divider', overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 1180, ...borderedTableSx }}>
            <TableHead>
              <TableRow>
                {[
                  'รหัสจุดตรวจวัด',
                  'ชื่อจุดตรวจวัด',
                  'ประเภทจุดตรวจวัด',
                  'พารามิเตอร์',
                  `ครั้ง 1/${currentBuddhistYear}`,
                  `ครั้ง 2/${currentBuddhistYear}`,
                  'จัดการ',
                ].map((column) => (
                  <TableCell key={column} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>
                    {column}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const canReportParameter = hasBodCodParameter(row.parameters)
                const round1Status = canReportParameter ? row.round1Status : '-'
                const round2Status = canReportParameter ? row.round2Status : '-'
                const canReportRound1 = canReportParameter && isFirstRoundPeriod && row.round1Status === 'ยังไม่ยื่น'
                const canReportRound2 = canReportParameter && isSecondRoundPeriod && row.round2Status === 'ยังไม่ยื่น'

                return (
                  <TableRow key={row.id}>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.parameters}</TableCell>
                    <TableCell><StatusChip value={round1Status} /></TableCell>
                    <TableCell><StatusChip value={round2Status} /></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={tableActionStackSx}>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={!canReportRound1}
                          onClick={() => onOpenReport?.(factory, row, 'ครั้งที่ 1')}
                        >
                          รายงานครั้งที่ 1/{currentBuddhistYear}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={!canReportRound2}
                          onClick={() => onOpenReport?.(factory, row, 'ครั้งที่ 2')}
                        >
                          รายงานครั้งที่ 2/{currentBuddhistYear}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
    </Dialog>
  )
}

function getDefaultBodCodParameter(parameters = '') {
  const parameterText = String(parameters ?? '').toUpperCase()

  if (parameterText.includes('BOD')) {
    return 'BOD'
  }

  if (parameterText.includes('COD')) {
    return 'COD'
  }

  return ''
}

function makeDraftReport(factory, point, reportRound) {
  const roundNo = reportRound === 'ครั้งที่ 1' ? '1' : '2'
  const parameter = getDefaultBodCodParameter(point.parameters)

  return {
    id: `draft-${point.id}-${reportRound}`,
    factoryId: factory.factoryId ?? factory.id ?? '',
    factoryName: factory.factoryName,
    factoryRegistration: factory.factoryRegistration ?? factory.newRegistrationNo,
    province: factory.province,
    businessActivity: factory.industryType,
    factoryAddress: factory.address ?? '',
    monitoringPointId: point.id ?? point.connectedMeasurementPointId,
    monitoringPointCode: point.code,
    monitoringPointName: point.name,
    pointCode: point.code,
    pointName: point.name,
    reportRound,
    roundNo,
    year: currentBuddhistYear,
    reportNo: '-',
    submittedDate: '-',
    reviewedDate: '-',
    status: 'ยังไม่ยื่น',
    wastewaterFlow: '120.5',
    samplerName: 'นายสมชาย ใจดี',
    officerRegistration: 'LAB-REG-2569-001',
    laboratoryName: 'ห้องปฏิบัติการสิ่งแวดล้อมอุตสาหกรรม',
    laboratoryRegistration: 'กวภ-LAB-1234-2569',
    labReportNo: 'LAB-REPORT-2569-001',
    analysisMethod: 'Standard Methods for the Examination of Water and Wastewater',
    deviceBrand: 'EnviroTech',
    deviceModel: 'WPMS-5000',
    serialNo: 'SN-WPMS-2569-001',
    parameter,
    reporterName: 'นายสมชาย ใจดี',
    reporterPosition: 'ผู้จัดการสิ่งแวดล้อม',
    measurementRows: [
      {
        id: 'measurement-1',
        sampleDate: '01/07/2569',
        sampleTime: '09:30',
        deviceValue: '12.50',
        labValue: '10.00',
        errorValue: '2.50',
        standardErrorValue: '3.00',
      },
    ],
    attachmentFiles: {
      samplePhotos: [],
      devicePhotos: [],
      labReports: [],
    },
  }
}

function makeEditableReport(row) {
  return {
    ...row,
    mode: 'edit',
    roundNo: row.roundNo ?? row.reportRoundNo ?? row.reportRound?.replace('ครั้งที่ ', '') ?? '',
    businessActivity: row.businessActivity ?? '',
    factoryAddress: row.factoryAddress ?? '',
    latestRevisionMessage: getLatestReportRevisionMessage(row),
    statusHistory: buildFallbackReportStatusHistory(row),
  }
}

function ReadOnlyField({ label, value = '', multiline = false }) {
  return (
    <TextField
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

function calculateErrorValue(deviceValue, labValue) {
  const deviceNumber = Number(deviceValue)
  const labNumber = Number(labValue)

  if (!Number.isFinite(deviceNumber) || !Number.isFinite(labNumber)) {
    return ''
  }

  return (deviceNumber - labNumber).toFixed(2)
}

const emptyMeasurementResult = {
  sampleDate: '',
  sampleTime: '',
  deviceValue: '',
  labValue: '',
  standardErrorValue: '',
}

const attachmentTypeFieldMap = {
  SAMPLE_PHOTO: 'samplePhotos',
  DEVICE_PHOTO: 'devicePhotos',
  LAB_REPORT: 'labReports',
}

function getAttachmentFileName(file = {}) {
  return file.originalFileName ?? file.name ?? file.storedFileName ?? ''
}

function getBodCodFormValues(report = {}) {
  const safeReport = report ?? {}

  return {
    wastewaterFlow: safeReport.wastewaterFlow ?? '',
    samplerName: safeReport.samplerName ?? '',
    officerRegistration: safeReport.officerRegistration ?? '',
    laboratoryName: safeReport.laboratoryName ?? '',
    laboratoryRegistration: safeReport.laboratoryRegistration ?? '',
    labReportNo: safeReport.labReportNo ?? '',
    analysisMethod: safeReport.analysisMethod ?? '',
    deviceBrand: safeReport.deviceBrand ?? '',
    deviceModel: safeReport.deviceModel ?? '',
    serialNo: safeReport.serialNo ?? '',
    parameter: safeReport.parameter ?? '',
    reporterName: safeReport.reporterName ?? '',
    reporterPosition: safeReport.reporterPosition ?? '',
  }
}

function getBodCodMeasurementResult(report = {}) {
  return (report ?? {}).measurementRows?.[0] ?? emptyMeasurementResult
}

function getBodCodAttachmentFiles(report = {}) {
  const safeReport = report ?? {}
  const files = {
    samplePhotos: [],
    devicePhotos: [],
    labReports: [],
  }

  if (safeReport.attachmentFiles) {
    files.samplePhotos = safeReport.attachmentFiles.samplePhotos ?? []
    files.devicePhotos = safeReport.attachmentFiles.devicePhotos ?? []
    files.labReports = safeReport.attachmentFiles.labReports ?? []

    return files
  }

  if (!Array.isArray(safeReport.attachments)) {
    return files
  }

  safeReport.attachments.forEach((attachment) => {
    const field = attachmentTypeFieldMap[attachment.attachmentType]
    if (field) {
      files[field].push(attachment)
    }
  })

  return files
}

function AttachmentFileInput({ label, files, onChange }) {
  const safeFiles = Array.isArray(files) ? files : []
  const removeFile = (removeIndex) => {
    onChange(safeFiles.filter((_, index) => index !== removeIndex))
  }

  return (
    <Stack spacing={1}>
      <Stack spacing={0.75}>
        <Button component="label" variant="outlined" fullWidth>
          แนบไฟล์
          <input
            hidden
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            onChange={(event) => {
              const selectedFile = event.target.files?.[0] ?? null
              event.target.value = ''
              if (!selectedFile) return
              onChange([...safeFiles, selectedFile])
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
              <TableCell sx={{ width: 72 }}>ลำดับ</TableCell>
              <TableCell>{label}</TableCell>
              <TableCell sx={{ width: 56 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {safeFiles.length > 0 ? (
              safeFiles.map((file, index) => (
                <TableRow key={`${getAttachmentFileName(file)}-${file.lastModified ?? file.id ?? index}`}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{getAttachmentFileName(file)}</TableCell>
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

function BodCodReportFormSheet({ open, report, onClose, onPreview }) {
  const [form, setForm] = useState(() => getBodCodFormValues(report))
  const [measurementResult, setMeasurementResult] = useState(() => getBodCodMeasurementResult(report))
  const [attachmentFiles, setAttachmentFiles] = useState(() => getBodCodAttachmentFiles(report))
  const latestRevisionMessage = getLatestReportRevisionMessage(report)
  const isEditMode = report?.mode === 'edit'
  const measurementErrorValue = calculateErrorValue(measurementResult.deviceValue, measurementResult.labValue)

  if (!report) {
    return null
  }

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }
  const updateMeasurementResult = (field, value) => {
    setMeasurementResult((current) => ({ ...current, [field]: value }))
  }
  const updateAttachmentFiles = (field, value) => {
    setAttachmentFiles((current) => ({ ...current, [field]: value }))
  }
  const handlePreview = () => {
    const hasMeasurementResult = Object.values(measurementResult).some((value) => String(value ?? '').trim())

    onPreview?.({
      ...report,
      ...form,
      attachmentFiles,
      measurementRows: hasMeasurementResult
        ? [{ ...measurementResult, id: 'measurement-1', errorValue: measurementErrorValue }]
        : [],
    })
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
            justifyContent: 'center',
          }}
        >
          <Typography variant="h6" component="h2" fontWeight={700} sx={{ textAlign: 'center' }}>
            แบบรายงานผลการตรวจสอบความคลาดเคลื่อนของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ
          </Typography>
        </Stack>
        <Divider />
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            {latestRevisionMessage ? (
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
            <SectionPaper title="ข้อมูลทั่วไป">
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <ReadOnlyField label="ชื่อบริษัท" value={report.factoryName} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <ReadOnlyField label="เลขทะเบียนโรงงาน" value={report.factoryRegistration} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <ReadOnlyField label="ประกอบกิจการ" value={report.businessActivity} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <ReadOnlyField label="สถานที่ตั้ง" value={report.factoryAddress} multiline />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <ReadOnlyField label="ครั้งที่" value={report.roundNo} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <ReadOnlyField label="ปี" value={String(report.year)} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    label="ปริมาณการระบายน้ำทิ้งขณะเก็บตัวอย่าง (ลบ.ม./ชั่วโมง)"
                    size="small"
                    value={form.wastewaterFlow}
                    onChange={(event) => updateForm('wastewaterFlow', event.target.value)}
                    fullWidth
                  />
                </Grid>
              </Grid>
            </SectionPaper>

            <SectionPaper title="ข้อมูลผู้เก็บตัวอย่างและห้องปฏิบัติการ">
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="ผู้เก็บตัวอย่าง" size="small" value={form.samplerName} onChange={(event) => updateForm('samplerName', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="ทะเบียนเจ้าหน้าที่" size="small" value={form.officerRegistration} onChange={(event) => updateForm('officerRegistration', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="หน่วยงาน/ชื่อห้องปฏิบัติการ" size="small" value={form.laboratoryName} onChange={(event) => updateForm('laboratoryName', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="ทะเบียนห้องปฏิบัติการ" size="small" value={form.laboratoryRegistration} onChange={(event) => updateForm('laboratoryRegistration', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="เลขที่ใบรายงานผลวิเคราะห์" size="small" value={form.labReportNo} onChange={(event) => updateForm('labReportNo', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="วิธีวิเคราะห์ทดสอบในห้องปฏิบัติการ" size="small" value={form.analysisMethod} onChange={(event) => updateForm('analysisMethod', event.target.value)} fullWidth />
                </Grid>
              </Grid>
            </SectionPaper>

            <SectionPaper title="รายละเอียดเครื่องมือและรายการตรวจสอบ">
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="ยี่ห้อ (Brand)" size="small" value={form.deviceBrand} onChange={(event) => updateForm('deviceBrand', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="รุ่น (Model)" size="small" value={form.deviceModel} onChange={(event) => updateForm('deviceModel', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="หมายเลขเครื่อง (Serial No.)" size="small" value={form.serialNo} onChange={(event) => updateForm('serialNo', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    select
                    label="รายการที่ตรวจสอบค่าความคลาดเคลื่อน"
                    size="small"
                    value={form.parameter}
                    onChange={(event) => updateForm('parameter', event.target.value)}
                    fullWidth
                  >
                    <MenuItem value="BOD">BOD</MenuItem>
                    <MenuItem value="COD">COD</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
            </SectionPaper>

            <SectionPaper title="ผลการตรวจสอบความคลาดเคลื่อน">
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    label="วันที่เก็บตัวอย่าง"
                    size="small"
                    value={measurementResult.sampleDate}
                    onChange={(event) => updateMeasurementResult('sampleDate', event.target.value)}
                    placeholder="DD/MM/BBBB"
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    label="เวลาที่เก็บตัวอย่าง"
                    size="small"
                    value={measurementResult.sampleTime}
                    onChange={(event) => updateMeasurementResult('sampleTime', event.target.value)}
                    placeholder="HH:mm"
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12 }} sx={{ display: { xs: 'none', md: 'block' } }} />
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    label="ค่าที่เครื่องมือตรวจวัดได้ (M)"
                    size="small"
                    value={measurementResult.deviceValue}
                    onChange={(event) => updateMeasurementResult('deviceValue', event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    label="ค่าที่ห้องปฏิบัติการวิเคราะห์ได้ (T)"
                    size="small"
                    value={measurementResult.labValue}
                    onChange={(event) => updateMeasurementResult('labValue', event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <ReadOnlyField label="ค่าความคลาดเคลื่อน (E)" value={measurementErrorValue} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    label="ค่าความคลาดเคลื่อนตามประกาศฯ"
                    size="small"
                    value={measurementResult.standardErrorValue}
                    onChange={(event) => updateMeasurementResult('standardErrorValue', event.target.value)}
                    fullWidth
                  />
                </Grid>
              </Grid>
            </SectionPaper>

            <SectionPaper title="เอกสารแนบ (JPG / PNG / PDF) (ขนาดไม่เกิน 2 Mb)*">
              <Grid container spacing={2}>
                {[
                  ['samplePhotos', 'ภาพถ่ายขณะเก็บตัวอย่าง'],
                  ['devicePhotos', 'ภาพหน้าเครื่องมือตรวจวัดที่แสดง ณ เวลาที่เก็บตัวอย่าง'],
                  ['labReports', 'รายงานผลจากห้องปฏิบัติการ'],
                ].map(([field, label]) => (
                  <Grid key={field} size={{ xs: 12, md: 4 }}>
                    <AttachmentFileInput
                      label={label}
                      files={attachmentFiles[field]}
                      onChange={(nextFiles) => updateAttachmentFiles(field, nextFiles)}
                    />
                  </Grid>
                ))}
              </Grid>
            </SectionPaper>

            <SectionPaper title="ผู้รายงานผลการทดสอบ">
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField label="ชื่อ-นามสกุล" size="small" value={form.reporterName} onChange={(event) => updateForm('reporterName', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField label="ตำแหน่ง" size="small" value={form.reporterPosition} onChange={(event) => updateForm('reporterPosition', event.target.value)} fullWidth />
                </Grid>
              </Grid>
            </SectionPaper>
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
          <Button variant="contained" onClick={handlePreview}>
            {isEditMode ? 'บันทึกการแก้ไข' : 'บันทึกแบบฟอร์ม'}
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  )
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

function ReportActions({ row, mode, roleCode = '', onOpenReport, onOpenResultNotice }) {
  const statusValues = [row.status, row.statusCode, row.statusLabel].filter(Boolean)
  const hasStatus = (statuses) => statusValues.some((status) => statuses.includes(status))
  const canEdit = mode === 'operator' && hasStatus(['รอโรงงานแก้ไข', 'REVISION_REQUESTED'])
  const canReviewPending = hasStatus([
    'รอพิจารณา',
    'แก้ไขแล้ว/รอพิจารณา',
    'SUBMITTED',
    'REVISED_PENDING_REVIEW',
  ])
  const canReviewWaiting = roleCode === 'kpm_director' && hasStatus(['รอทบทวน', 'WAITING_REVIEW'])
  const canApproveWaiting = ['center_director', 'kwp_director'].includes(roleCode) && hasStatus(['รออนุมัติ', 'WAITING_APPROVAL'])
  const canProcess = mode === 'officer' && (canReviewPending || canReviewWaiting || canApproveWaiting)
  const canOpenResultNotice = hasStatus(['ผ่านการพิจารณา', 'APPROVED'])
    || (mode === 'officer' && hasStatus(['รอทบทวน', 'รออนุมัติ', 'WAITING_REVIEW', 'WAITING_APPROVAL']))
  const canFillResultNotice = mode === 'officer'
    && roleCode === 'monitoring_kpm'
    && row.statusCode === 'WAITING_RESULT_NOTICE'

  return (
    <Stack direction="row" spacing={1} sx={tableActionStackSx}>
      <Button size="small" variant="outlined" onClick={() => onOpenReport?.(row, 'view')}>
        แบบรายงานผล
      </Button>
      <Button size="small" variant="outlined" disabled={!canOpenResultNotice} onClick={() => onOpenResultNotice?.(row)}>
        แบบแจ้งผล
      </Button>
      {mode === 'operator' ? (
        <>
          <Button size="small" variant="contained" disabled={!canEdit} onClick={() => onOpenReport?.(row, 'edit')}>
            แก้ไข
          </Button>
          <Button size="small" variant="outlined" color="error" disabled={!canEdit} onClick={() => onOpenReport?.(row, 'cancel')}>
            ยกเลิก
          </Button>
        </>
      ) : (
        <>
          <Button size="small" variant="contained" disabled={!canFillResultNotice} onClick={() => onOpenResultNotice?.(row, 'edit')}>
            กรอกแบบแจ้งผล
          </Button>
          <Button size="small" variant="contained" disabled={!canProcess} onClick={() => onOpenReport?.(row, 'review')}>
            ดำเนินการ
          </Button>
        </>
      )}
    </Stack>
  )
}

function getFactoryColumns(onOpenMonitoringPoints) {
  return [
    { field: 'factoryName', headerName: 'ชื่อโรงงาน/บริษัท', width: 240 },
    { field: 'newRegistrationNo', headerName: 'เลขทะเบียนโรงงาน (ใหม่)', width: 190 },
    { field: 'oldRegistrationNo', headerName: 'เลขทะเบียนโรงงาน (เก่า)', width: 190 },
    { field: 'industryType', headerName: 'ประเภทอุตสาหกรรม', width: 170 },
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

function getReportColumns(mode, roleCode, onOpenReport, onOpenResultNotice) {
  return [
    { field: 'factoryName', headerName: 'ชื่อโรงงาน/บริษัท', width: 260 },
    { field: 'factoryRegistration', headerName: 'เลขทะเบียนโรงงาน', width: 190 },
    { field: 'province', headerName: 'จังหวัด', width: 130 },
    { field: 'monitoringPointCode', headerName: 'รหัสจุดตรวจวัด', width: 130 },
    { field: 'monitoringPointName', headerName: 'ชื่อจุดตรวจวัด', width: 190 },
    { field: 'reportRound', headerName: 'รอบรายงาน', width: 140 },
    { field: 'year', headerName: 'ปี พ.ศ.', width: 120 },
    { field: 'reportNo', headerName: 'เลขที่รายงาน', width: 170 },
    { field: 'submittedDate', headerName: 'วันที่ยื่นรายงาน', width: 160 },
    { field: 'reviewedDate', headerName: 'วันที่พิจารณา', width: 160 },
    {
      field: 'status',
      headerName: 'สถานะ',
      width: 180,
      renderCell: (params) => <StatusChip value={params.value} />,
    },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: mode === 'operator' ? 390 : 620,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <ReportActions
          row={params.row}
          mode={mode}
          roleCode={roleCode}
          onOpenReport={onOpenReport}
          onOpenResultNotice={onOpenResultNotice}
        />
      ),
    },
  ]
}

const dataGridLocaleText = {
  noRowsLabel: 'ไม่มีข้อมูล',
  columnMenuSortAsc: 'เรียงจากน้อยไปมาก',
  columnMenuSortDesc: 'เรียงจากมากไปน้อย',
  columnMenuFilter: 'ตัวกรอง',
  columnMenuHideColumn: 'ซ่อนคอลัมน์',
  columnMenuManageColumns: 'จัดการคอลัมน์',
  footerRowSelected: (count) => `เลือก ${count.toLocaleString('th-TH')} รายการ`,
}

const dataGridSx = {
  border: 0,
  '& .MuiDataGrid-columnHeaders': {
    borderTop: 1,
    borderBottom: 1,
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
}

function BodCodReportPage({ userType = '', accessToken = '', roleCode = '' }) {
  const isOfficer = userType === 'officer'
  const availableSubMenus = isOfficer ? officerSubMenus : operatorSubMenus
  const [factoryTableRows, setFactoryTableRows] = useState([])
  const [reportTableRows, setReportTableRows] = useState([])
  const [tableLoading, setTableLoading] = useState(false)
  const [tableError, setTableError] = useState('')
  const [previewSubmitting, setPreviewSubmitting] = useState(false)
  const [previewSubmitError, setPreviewSubmitError] = useState('')
  const [selectedSubMenu, setSelectedSubMenu] = useState(() => (isOfficer ? 'reports' : 'factories'))
  const [monitoringPointFactory, setMonitoringPointFactory] = useState(null)
  const [reportForm, setReportForm] = useState(null)
  const [previewReport, setPreviewReport] = useState(null)
  const [previewMode, setPreviewMode] = useState('view')
  const [resultNoticeReport, setResultNoticeReport] = useState(null)
  const [resultNoticeMode, setResultNoticeMode] = useState('view')
  const [resultNoticeSubmitting, setResultNoticeSubmitting] = useState(false)
  const [resultNoticeSubmitError, setResultNoticeSubmitError] = useState('')
  const effectiveSubMenu = availableSubMenus.some((menu) => menu.value === selectedSubMenu)
    ? selectedSubMenu
    : availableSubMenus[0].value
  const fetchFactoryRows = useCallback(async ({ signal } = {}) => {
    if (!accessToken) {
      return []
    }

    const result = await fetch(`${bodCodDeviationReportsApiBaseUrl}/factories`, {
      signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const response = await readBodCodApiResponse(result, 'โหลดรายชื่อโรงงานไม่สำเร็จ')

    return Array.isArray(response?.data) ? response.data.map(mapBodCodFactoryRow) : []
  }, [accessToken])
  const fetchReportRows = useCallback(async ({ signal } = {}) => {
    if (!accessToken) {
      return []
    }

    const result = await fetch(bodCodDeviationReportsApiBaseUrl, {
      signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const response = await readBodCodApiResponse(result, 'โหลดรายการรายงานไม่สำเร็จ')

    return Array.isArray(response?.data)
      ? response.data.map((row, index) => mapBodCodReportRow(row, index, { isOperatorView: !isOfficer }))
      : []
  }, [accessToken, isOfficer])
  const fetchReportDetail = useCallback(async (row) => {
    if (!accessToken) {
      throw new Error('กรุณาเข้าสู่ระบบเพื่อโหลดรายละเอียดรายงาน')
    }

    if (!row?.id) {
      throw new Error('ไม่พบรหัสรายงาน')
    }

    const result = await fetch(`${bodCodDeviationReportsApiBaseUrl}/${row.id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const response = await readBodCodApiResponse(result, 'โหลดรายละเอียดรายงานไม่สำเร็จ')

    return mapBodCodReportDetail(response?.data ?? {}, row, { isOperatorView: !isOfficer })
  }, [accessToken, isOfficer])
  const loadFactoryRows = useCallback(async (options) => {
    const rows = await fetchFactoryRows(options)
    setFactoryTableRows(rows)
    return rows
  }, [fetchFactoryRows])
  const loadReportRows = useCallback(async (options) => {
    const rows = await fetchReportRows(options)
    setReportTableRows(rows)
    return rows
  }, [fetchReportRows])
  const reloadCurrentTable = useCallback(async () => {
    if (isOfficer || effectiveSubMenu !== 'factories') {
      await loadReportRows()
      return
    }

    await loadFactoryRows()
  }, [effectiveSubMenu, isOfficer, loadFactoryRows, loadReportRows])
  useEffect(() => {
    if (isOfficer || effectiveSubMenu !== 'factories') {
      return
    }

    const controller = new AbortController()
    fetchFactoryRows({ signal: controller.signal })
      .then((rows) => {
        setFactoryTableRows(rows)
        setTableError('')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setFactoryTableRows([])
          setTableError(error instanceof Error ? error.message : 'โหลดรายชื่อโรงงานไม่สำเร็จ')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setTableLoading(false)
        }
      })

    return () => controller.abort()
  }, [effectiveSubMenu, fetchFactoryRows, isOfficer])
  useEffect(() => {
    if (!isOfficer && effectiveSubMenu === 'factories') {
      return
    }

    const controller = new AbortController()
    fetchReportRows({ signal: controller.signal })
      .then((rows) => {
        setReportTableRows(rows)
        setTableError('')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setReportTableRows([])
          setTableError(error instanceof Error ? error.message : 'โหลดรายการรายงานไม่สำเร็จ')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setTableLoading(false)
        }
      })

    return () => controller.abort()
  }, [effectiveSubMenu, fetchReportRows, isOfficer])
  const factoryColumns = useMemo(() => getFactoryColumns(setMonitoringPointFactory), [])
  const reportColumns = useMemo(
    () => getReportColumns(isOfficer ? 'officer' : 'operator', roleCode, (row, mode) => {
      setTableError('')
      fetchReportDetail(row)
        .then((detail) => {
          if (!isOfficer && mode === 'edit') {
            setReportForm(makeEditableReport(detail))
            return
          }

          setPreviewMode(mode ?? 'view')
          setPreviewReport(detail)
        })
        .catch((error) => {
          setTableError(error instanceof Error ? error.message : 'โหลดรายละเอียดรายงานไม่สำเร็จ')
        })
    }, (row, mode = 'view') => {
      setTableError('')
      setResultNoticeSubmitError('')
      fetchReportDetail(row)
        .then((detail) => {
          setResultNoticeMode(mode)
          setResultNoticeReport(detail)
        })
        .catch((error) => {
          setTableError(error instanceof Error ? error.message : 'โหลดรายละเอียดรายงานไม่สำเร็จ')
        })
    }),
    [fetchReportDetail, isOfficer, roleCode],
  )
  const confirmResultNotice = async (report, noticeForm) => {
    if (!report) return

    if (!accessToken) {
      setResultNoticeSubmitError('กรุณาเข้าสู่ระบบเจ้าหน้าที่เพื่อบันทึกแบบแจ้งผล')
      return
    }

    setResultNoticeSubmitting(true)
    setResultNoticeSubmitError('')

    try {
      const result = await fetch(`${bodCodDeviationReportsApiBaseUrl}/${report.id}/result-notice`, {
        method: report.resultNotice ? 'PUT' : 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(buildBodCodResultNoticePayload(noticeForm)),
      })
      await readBodCodApiResponse(result, 'บันทึกแบบแจ้งผลไม่สำเร็จ')
      await submitWorkflowAction(report, 'APPROVE', 'บันทึกแบบแจ้งผลและส่งอนุมัติ')
      setResultNoticeReport(null)
      setResultNoticeMode('view')
      await loadReportRows()
    } catch (error) {
      setResultNoticeSubmitError(error instanceof Error ? error.message : 'ส่งอนุมัติไม่สำเร็จ')
    } finally {
      setResultNoticeSubmitting(false)
    }
  }
  const submitPreviewReport = async (report) => {
    if (!accessToken) {
      setPreviewSubmitError('กรุณาเข้าสู่ระบบเพื่อส่งแบบฟอร์ม')
      return
    }

    setPreviewSubmitting(true)
    setPreviewSubmitError('')

    try {
      const isEditMode = previewMode === 'edit' || report?.mode === 'edit'
      const payload = await buildBodCodReportPayload(report, accessToken)
      const result = await fetch(
        isEditMode
          ? `${bodCodDeviationReportsApiBaseUrl}/${report.id}/resubmission`
          : bodCodDeviationReportsApiBaseUrl,
        {
          method: isEditMode ? 'PUT' : 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        },
      )
      await readBodCodApiResponse(result, isEditMode ? 'บันทึกการแก้ไขไม่สำเร็จ' : 'ส่งแบบฟอร์มไม่สำเร็จ')
      setPreviewReport(null)
      setPreviewMode('view')
      await reloadCurrentTable()
    } catch (error) {
      setPreviewSubmitError(error instanceof Error ? error.message : 'ส่งแบบฟอร์มไม่สำเร็จ')
    } finally {
      setPreviewSubmitting(false)
    }
  }
  const submitWorkflowAction = async (report, action, officerNote = '') => {
    if (!accessToken) {
      throw new Error('กรุณาเข้าสู่ระบบเจ้าหน้าที่เพื่อดำเนินการ')
    }

    if (!report?.id) {
      throw new Error('ไม่พบรหัสรายงานสำหรับดำเนินการ')
    }

    const note = String(officerNote ?? '').trim()
    const payload = {
      action,
      officerNote: note || (action === 'APPROVE' ? 'ข้อมูลถูกต้อง ส่งต่อผู้อนุมัติ' : ''),
    }

    if (action === 'REQUEST_REVISION') {
      payload.revisionReason = note
    }

    const result = await fetch(`${bodCodDeviationReportsApiBaseUrl}/${report.id}/workflow-actions`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })
    await readBodCodApiResponse(result, action === 'REQUEST_REVISION' ? 'แจ้งแก้ไขไม่สำเร็จ' : 'ผ่านการพิจารณาไม่สำเร็จ')
  }
  const requestReportRevision = async (report, officerNote) => {
    setPreviewSubmitError('')
    await submitWorkflowAction(report, 'REQUEST_REVISION', officerNote)
    setPreviewReport(null)
    setPreviewMode('view')
    await loadReportRows()
  }
  const approveReport = async (report) => {
    setPreviewSubmitting(true)
    setPreviewSubmitError('')

    try {
      await submitWorkflowAction(report, 'APPROVE', 'ข้อมูลถูกต้อง ส่งต่อผู้อนุมัติ')
      setPreviewReport(null)
      setPreviewMode('view')
      await loadReportRows()
    } catch (error) {
      setPreviewSubmitError(error instanceof Error ? error.message : 'ผ่านการพิจารณาไม่สำเร็จ')
    } finally {
      setPreviewSubmitting(false)
    }
  }
  const table = useMemo(() => {
    if (effectiveSubMenu === 'factories') {
      return {
        title: 'รายชื่อโรงงาน',
        rows: factoryTableRows,
        columns: factoryColumns,
      }
    }

    return {
      title: isOfficer ? 'รายการส่งแบบรายงาน' : 'ประวัติการรายงาน',
      rows: reportTableRows,
      columns: reportColumns,
    }
  }, [effectiveSubMenu, factoryColumns, factoryTableRows, isOfficer, reportColumns, reportTableRows])
  const isStatisticsSubMenu = effectiveSubMenu === 'statistics'

  return (
    <>
      <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
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
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" component="h1" fontWeight={700}>
                รายงานค่าความคลาดเคลื่อน BOD/COD Online
              </Typography>
            </Box>
            <Tabs
              value={effectiveSubMenu}
              onChange={(_, value) => setSelectedSubMenu(value)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="เมนูย่อยรายงานค่าความคลาดเคลื่อน BOD/COD"
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

        {isStatisticsSubMenu ? (
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <OfficerStatisticsPanel title="สถิติข้อมูลรายงานค่าความคลาดเคลื่อน BOD/COD Online" showRoundFilter />
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
            {tableError ? (
              <Alert severity="error" sx={{ borderRadius: 0 }}>
                {tableError}
              </Alert>
            ) : null}
            <DataGrid
              rows={table.rows}
              columns={table.columns}
              loading={tableLoading}
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
              localeText={dataGridLocaleText}
              sx={dataGridSx}
            />
          </Paper>
        )}
      </Stack>
      <MonitoringPointDialog
        open={Boolean(monitoringPointFactory)}
        factory={monitoringPointFactory}
        onClose={() => setMonitoringPointFactory(null)}
        onOpenReport={(factory, point, reportRound) => {
          setReportForm(makeDraftReport(factory, point, reportRound))
          setMonitoringPointFactory(null)
        }}
      />
      <BodCodReportFormSheet
        key={reportForm?.id ?? 'bod-cod-report-form'}
        open={Boolean(reportForm)}
        report={reportForm}
        onClose={() => setReportForm(null)}
        onPreview={(report) => {
          setPreviewMode(report?.mode === 'edit' ? 'edit' : 'submit')
          setPreviewSubmitError('')
          setPreviewReport(report)
          setReportForm(null)
        }}
      />
      <ReportPreviewDialog
        open={Boolean(previewReport)}
        report={previewReport}
        mode={previewMode}
        submitting={previewSubmitting}
        submitError={previewSubmitError}
        onClose={() => {
          setPreviewReport(null)
          setPreviewMode('view')
          setPreviewSubmitError('')
        }}
        onSubmit={submitPreviewReport}
        onRequestRevision={requestReportRevision}
        onApprove={approveReport}
      />
      <ResultNoticeDialog
        key={resultNoticeReport ? `${resultNoticeReport.id}-${resultNoticeMode}-${resultNoticeReport.resultNotice?.updatedAt ?? 'new'}` : 'result-notice-dialog'}
        open={Boolean(resultNoticeReport)}
        report={resultNoticeReport}
        mode={resultNoticeMode}
        onClose={() => {
          setResultNoticeReport(null)
          setResultNoticeMode('view')
          setResultNoticeSubmitError('')
        }}
        submitting={resultNoticeSubmitting}
        submitError={resultNoticeSubmitError}
        onConfirm={confirmResultNotice}
      />
    </>
  )
}

export default BodCodReportPage
