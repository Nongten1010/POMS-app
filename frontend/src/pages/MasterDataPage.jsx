import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { DataGrid } from '@mui/x-data-grid'
import { RequestFormBottomSheet } from './ConnectionRequestPage'

const pomsFactoriesApiBaseUrl = window.location.hostname === 'localhost'
  ? '/api-proxy/v1/poms-factories'
  : '/api/v1/poms-factories'

const pageSubMenus = [
  { value: 'factories', label: 'รายชื่อโรงงาน' },
  { value: 'requests', label: 'รายการคำขอ' },
]

const tableActionStackSx = {
  alignItems: 'center',
  flexWrap: 'nowrap',
  height: '100%',
}

const borderedTableSx = {
  borderCollapse: 'collapse',
  '& th, & td': {
    border: '1px solid',
    borderColor: 'divider',
  },
}

const eiaAssessmentOptions = ['ไม่มี', 'มี IEE', 'มี EIA', 'มี EHIA', 'อื่นๆ']
const actionableRequestStatuses = ['แก้ไขแล้ว/รอพิจารณา', 'รอพิจารณา']

const dataGridLocaleText = {
  toolbarColumns: 'คอลัมน์',
  toolbarFilters: 'ตัวกรอง',
  toolbarDensity: 'ความหนาแน่น',
  toolbarExport: 'ส่งออก',
  filterPanelInputLabel: 'ค่า',
  filterPanelColumns: 'คอลัมน์',
  filterPanelOperator: 'เงื่อนไข',
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
}

async function readMasterDataResponse(result, fallbackMessage) {
  const rawText = await result.text()
  let payload

  try {
    payload = rawText ? JSON.parse(rawText) : null
  } catch {
    payload = rawText
  }

  if (!result.ok || payload?.success === false) {
    const issueText = Array.isArray(payload?.error?.issues)
      ? payload.error.issues
          .map((issue) => [issue.pathString, issue.message].filter(Boolean).join(': '))
          .filter(Boolean)
          .join('\n')
      : ''
    throw new Error(issueText || payload?.error?.message || fallbackMessage)
  }

  return payload
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

function emptyToNull(value) {
  const text = String(value ?? '').trim()
  return text ? text : null
}

function toNumberOrNull(value) {
  const text = String(value ?? '').trim()
  if (!text) {
    return null
  }
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function toThaiRequestStatusLabel(status, label) {
  const normalized = String(label || status || '').trim()
  const statusMap = {
    PENDING_REVIEW: 'รอพิจารณา',
    REVISION_REQUESTED: 'รอโรงงานแก้ไข',
    REVISED_PENDING_REVIEW: 'แก้ไขแล้ว/รอพิจารณา',
    APPROVED: 'อนุมัติ',
    REJECTED: 'ไม่อนุมัติ',
    'ส่งกลับให้แก้ไข': 'รอโรงงานแก้ไข',
    'แก้ไขแล้ว รอพิจารณา': 'แก้ไขแล้ว/รอพิจารณา',
    อนุมัติแล้ว: 'อนุมัติ',
    ไม่อนุมัติ: 'ยกเลิก',
  }

  return statusMap[normalized] ?? normalized ?? '-'
}

function getRequestFormLabel(formType) {
  return formType === 'MEASUREMENT_POINTS' ? 'แก้ไขข้อมูลจุดตรวจวัด' : 'แก้ไขข้อมูลพื้นฐาน'
}

function sanitizeDocumentItem(document = {}) {
  const item = {
    title: document.title ?? document.fileName ?? document.originalFileName ?? 'เอกสารแนบ',
    description: document.description ?? null,
    link: document.link ?? null,
    fileName: document.fileName ?? document.originalFileName ?? document.storedFileName ?? null,
    fileUrl: document.fileUrl ?? document.url ?? document.storageUrl ?? null,
    fileType: document.fileType ?? document.mimeType ?? null,
    fileSize: document.fileSize ?? null,
  }

  return Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined))
}

function sanitizeDocuments(documents = []) {
  return Array.isArray(documents) ? documents.map(sanitizeDocumentItem) : []
}

function sumMonitoringPointCount(row) {
  if (Array.isArray(row.monitoringPointCountBySystem)) {
    return row.monitoringPointCountBySystem.reduce((total, item) => total + Number(item?.count ?? 0), 0)
  }

  return Array.isArray(row.measurementPoints) ? row.measurementPoints.length : 0
}

function getFactorySystemText(row) {
  if (Array.isArray(row.systemTypes) && row.systemTypes.length > 0) {
    return row.systemTypes.join(', ')
  }

  if (!Array.isArray(row.monitoringPointCountBySystem) || row.monitoringPointCountBySystem.length === 0) {
    return '-'
  }

  return row.monitoringPointCountBySystem
    .map((item) => `${item.systemType ?? '-'} ${Number(item.count ?? 0).toLocaleString('th-TH')}`)
    .join(', ')
}

function getMonitoringPointCode(point, index) {
  if (point?.pointCode) {
    return point.pointCode
  }
  if (point?.stationId) {
    return point.stationId
  }
  const prefix = point?.systemType === 'WPMS' ? 'P' : 'S'
  return `${prefix}${String(index + 1).padStart(4, '0')}`
}

function getLatestUpdatedAt(point) {
  const latestRow = Array.isArray(point?.data) ? point.data.at(-1) : null
  return latestRow?.cdate || '-'
}

function mapFactoryRows(rows) {
  return rows.map((row, index) => ({
    id: row.factoryId || row.factoryRegistrationNo || `factory-${index}`,
    eligibleFactoryId: row.eligibleFactoryId ?? null,
    factoryId: row.factoryId ?? row.factoryRegistrationNo ?? '',
    factoryRegistrationNo: row.factoryRegistrationNo ?? row.newRegistrationNo ?? row.factoryId ?? '',
    factoryName: row.factoryName ?? '',
    newRegistrationNo: row.factoryRegistrationNo ?? row.newRegistrationNo ?? row.factoryId ?? '',
    oldRegistrationNo: row.oldRegistrationNo ?? '',
    industryType: row.industryMainOrder ?? row.industryType ?? '-',
    industryMainOrder: row.industryMainOrder ?? row.industryType ?? '',
    industrySubOrder: row.industrySubOrder ?? '',
    businessActivity: row.industryMainOrderLabel ?? row.businessActivity ?? '-',
    address: row.factoryAddress ?? row.address ?? '',
    province: row.provinceName ?? row.province ?? '',
    industrialEstateCode: row.industrialEstateCode ?? '',
    latitude: row.latitude ?? '',
    longitude: row.longitude ?? '',
    monitoringDeviceCount: sumMonitoringPointCount(row),
    monitoringPointCount: sumMonitoringPointCount(row),
    monitoringSystemText: getFactorySystemText(row),
    requestStatus: '-',
    eia: row.eia ?? '',
    eiaOther: row.eiaOther ?? '',
    projectName: row.projectName ?? '',
    factoryFrontPhotos: sanitizeDocuments(row.factoryFrontPhotos),
    factoryLogo: row.factoryLogo ? sanitizeDocumentItem(row.factoryLogo) : null,
    status: row.status ?? 'แสดง',
    measurementPoints: Array.isArray(row.measurementPoints) ? row.measurementPoints : [],
    pendingEditRequestCount: row.pendingEditRequestCount ?? 0,
    source: row,
  }))
}

function mapEditRequestRows(rows) {
  return rows.map((row, index) => {
    const form = getRequestFormLabel(row.formType)
    const proposedPoint = Array.isArray(row.proposedMeasurementPoints) ? row.proposedMeasurementPoints[0] : null
    const currentPoint = Array.isArray(row.currentMeasurementPoints) ? row.currentMeasurementPoints[0] : null
    const point = proposedPoint ?? currentPoint

    return {
      id: row.id ?? `edit-request-${index}`,
      requestId: row.id,
      requestNo: row.requestNo ?? '-',
      requestType: form,
      form,
      formType: row.formType ?? 'BASIC_INFO',
      systemType: form === 'แก้ไขข้อมูลพื้นฐาน' ? '-' : point?.systemType ?? '-',
      pointCode: form === 'แก้ไขข้อมูลพื้นฐาน' ? '-' : point?.pointCode ?? '-',
      pointName: form === 'แก้ไขข้อมูลพื้นฐาน' ? '-' : point?.pointName ?? '-',
      submittedDate: row.submittedAt ?? row.createdAt ?? '-',
      reviewedDate: row.reviewedAt ?? '-',
      statusCode: row.status ?? '',
      status: toThaiRequestStatusLabel(row.status, row.statusLabel),
      statusLabel: row.statusLabel ?? '',
      factoryId: row.factoryId ?? '',
      factoryName: row.factoryName ?? '',
      factoryRegistrationNo: row.factoryRegistrationNo ?? row.factoryId ?? '',
      province: row.provinceName ?? row.province ?? '-',
      requestNote: row.requestNote ?? null,
      revisionReason: row.revisionReason ?? null,
      officerNote: row.officerNote ?? null,
      raw: row,
    }
  })
}

function normalizeFactoryDetail(row = {}) {
  return mapFactoryRows([row])[0] ?? null
}

function StatusChip({ value }) {
  const colorByStatus = {
    รอพิจารณา: {
      bgcolor: '#2563eb',
      borderColor: '#2563eb',
      color: '#ffffff',
    },
    เชื่อมต่อแล้ว: {
      bgcolor: '#16a34a',
      borderColor: '#16a34a',
      color: '#ffffff',
    },
    อนุมัติ: {
      bgcolor: '#16a34a',
      borderColor: '#16a34a',
      color: '#ffffff',
    },
    ยกเลิก: {
      bgcolor: '#dc2626',
      borderColor: '#dc2626',
      color: '#ffffff',
    },
    รอโรงงานแก้ไข: {
      bgcolor: '#f97316',
      borderColor: '#f97316',
      color: '#ffffff',
    },
    'แก้ไขแล้ว/รอพิจารณา': {
      bgcolor: '#2563eb',
      borderColor: '#2563eb',
      color: '#ffffff',
    },
    'แก้ไขแล้ว รอพิจารณา': {
      bgcolor: '#2563eb',
      borderColor: '#2563eb',
      color: '#ffffff',
    },
    ส่งกลับให้แก้ไข: {
      bgcolor: '#f97316',
      borderColor: '#f97316',
      color: '#ffffff',
    },
    ไม่อนุมัติ: {
      bgcolor: '#dc2626',
      borderColor: '#dc2626',
      color: '#ffffff',
    },
    อนุมัติแล้ว: {
      bgcolor: '#16a34a',
      borderColor: '#16a34a',
      color: '#ffffff',
    },
  }
  const sx = colorByStatus[value] ?? {
    borderColor: 'divider',
    color: 'text.secondary',
    bgcolor: 'background.paper',
  }

  return (
    <Chip
      label={displayValue(value)}
      size="small"
      variant={colorByStatus[value] ? 'filled' : 'outlined'}
      sx={{ fontWeight: 600, ...sx }}
    />
  )
}

function MainActions({ row, onOpen, onEditGeneral }) {
  return (
    <Stack direction="row" spacing={1} sx={tableActionStackSx}>
      <Button size="small" variant="outlined" onClick={() => onOpen(row)}>
        ดูข้อมูล
      </Button>
      <Button size="small" variant="outlined" onClick={() => onEditGeneral(row)} sx={{ whiteSpace: 'nowrap' }}>
        แก้ไขข้อมูลทั่วไปของโรงงาน
      </Button>
    </Stack>
  )
}

function getFactoryColumns(onOpen, onEditGeneral) {
  return [
    { field: 'factoryName', headerName: 'ชื่อโรงงาน/บริษัท', width: 240 },
    { field: 'newRegistrationNo', headerName: 'เลขทะเบียนโรงงาน (ใหม่)', width: 190 },
    { field: 'oldRegistrationNo', headerName: 'เลขทะเบียนโรงงาน (เก่า)', width: 190 },
    { field: 'businessActivity', headerName: 'การประกอบกิจการ', width: 170 },
    { field: 'province', headerName: 'จังหวัด', width: 130 },
    {
      field: 'monitoringPointCount',
      headerName: 'จำนวนจุดตรวจวัด',
      width: 150,
      type: 'number',
    },
    { field: 'status', headerName: 'สถานะ', width: 110 },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: 310,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1} sx={tableActionStackSx}>
          <MainActions row={params.row} onOpen={onOpen} onEditGeneral={onEditGeneral} />
        </Stack>
      ),
    },
  ]
}

function MonitoringPointActions({ point, onEdit }) {
  return (
    <Stack direction="row" spacing={1} sx={tableActionStackSx}>
      <Button
        size="small"
        variant="outlined"
        startIcon={<EditIcon />}
        onClick={() => onEdit?.(point)}
        sx={{ whiteSpace: 'nowrap' }}
      >
        แก้ไขข้อมูลจุดตรวจวัด
      </Button>
    </Stack>
  )
}

function getPageRequestColumns(onOpenRequest, onEditRequest, isAdmin = false) {
  return [
    { field: 'factoryName', headerName: 'ชื่อโรงงาน/บริษัท', width: 240 },
    {
      field: 'factoryRegistration',
      headerName: 'เลขทะเบียนโรงงาน',
      width: 190,
      sortable: false,
      renderCell: (params) => (
        <Stack sx={{ justifyContent: 'center', minHeight: '100%' }}>
          <Typography variant="body2">{params.row.factoryRegistrationNo || '-'}</Typography>
        </Stack>
      ),
    },
    { field: 'province', headerName: 'จังหวัด', width: 130 },
    { field: 'requestNo', headerName: 'เลขที่คำขอ', width: 150 },
    { field: 'submittedDate', headerName: 'วันที่ยื่นคำขอ', width: 150 },
    { field: 'systemType', headerName: 'ประเภทจุดตรวจวัด', width: 150 },
    { field: 'pointCode', headerName: 'รหัสจุดตรวจวัด', width: 170 },
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
      width: isAdmin ? 200 : 300,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1} sx={tableActionStackSx}>
          <Button size="small" variant="outlined" onClick={() => onOpenRequest?.(params.row)}>
            เปิดดู
          </Button>
          {isAdmin ? (
            actionableRequestStatuses.includes(params.row.status) ? (
              <Button size="small" variant="contained" onClick={() => onEditRequest?.(params.row)}>
                ดำเนินการ
              </Button>
            ) : null
          ) : (
            <>
              <Button
                size="small"
                variant="outlined"
                disabled={params.row.status !== 'รอโรงงานแก้ไข'}
                onClick={() => onEditRequest?.(params.row.factory)}
              >
                แก้ไข
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                disabled={['อนุมัติ', 'ยกเลิก'].includes(params.row.status)}
              >
                ยกเลิกคำขอ
              </Button>
            </>
          )}
        </Stack>
      ),
    },
  ]
}

function mapMonitoringPointRows(factory) {
  return (factory?.measurementPoints ?? []).map((point, index) => ({
    id: point.connectedPointId ?? point.id ?? point.pointCode ?? point.stationId ?? `${factory.id}-point-${index}`,
    connectedPointId: point.connectedPointId ?? point.id ?? null,
    pointCode: getMonitoringPointCode(point, index),
    pointName: point.pointName ?? point.name ?? '-',
    systemType: point.systemType ?? '-',
    parameters: Array.isArray(point.parameters)
      ? point.parameters.join(', ')
      : point.parameters ?? point.parameterText ?? 'CO (ppm), NOx (ppm), Temp. (°C), O2 (%), Flow (m3/hr)',
    latestUpdatedAt: getLatestUpdatedAt(point),
    status: point.monitoringPointStatus ?? point.status ?? 'เชื่อมต่อแล้ว',
    source: point,
  }))
}

function FactoryDetailDialog({ factory, open, onClose, onEdit }) {
  const sourceFactory = factory?.factory ?? factory
  const monitoringPointRows = useMemo(() => mapMonitoringPointRows(sourceFactory), [sourceFactory])

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
        <Typography component="span" variant="h6" sx={{ minWidth: 0 }}>
          รายการจุดตรวจวัด{sourceFactory?.factoryName ? ` - ${sourceFactory.factoryName}` : ''}
        </Typography>
        <IconButton aria-label="ปิด" size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <TableContainer sx={{ border: 1, borderColor: 'divider', overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 1020, ...borderedTableSx }}>
            <TableHead>
              <TableRow>
                {[
                  { label: 'รหัสจุดตรวจวัด', width: 150 },
                  { label: 'ชื่อจุดตรวจวัด', width: 150 },
                  { label: 'ประเภทจุดตรวจวัด', width: 160 },
                  { label: 'รายละเอียดพารามิเตอร์' },
                  { label: 'สถานะ', width: 130 },
                  { label: 'จัดการ', width: 230 },
                ].map((column) => (
                  <TableCell key={column.label} sx={{ width: column.width, fontWeight: 700, bgcolor: 'neutral.50' }}>
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {monitoringPointRows.length > 0 ? (
                monitoringPointRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.pointCode}</TableCell>
                    <TableCell>{row.pointName}</TableCell>
                    <TableCell>{row.systemType}</TableCell>
                    <TableCell>{row.parameters}</TableCell>
                    <TableCell>
                      <StatusChip value={row.status} />
                    </TableCell>
                    <TableCell sx={{ width: 230 }}>
                      <MonitoringPointActions
                        point={row}
                        onEdit={() => onEdit({ ...sourceFactory, selectedMeasurementPoint: row.source })}
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
  )
}

function MockUploadField({ label, helperText, disabled = false }) {
  return (
    <Stack spacing={1}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {label}
      </Typography>
      <Button
        component="label"
        variant="outlined"
        startIcon={<UploadFileIcon />}
        disabled={disabled}
        sx={{
          justifyContent: 'flex-start',
          height: 40,
          borderStyle: 'dashed',
          color: 'text.secondary',
          fontWeight: 400,
        }}
      >
        ภาพ/ไฟล์/QR Code
        <input hidden type="file" disabled={disabled} />
      </Button>
      <Typography variant="caption" color="text.secondary">
        {helperText}
      </Typography>
    </Stack>
  )
}

function FactoryGeneralInfoBottomSheet({ open, factory, onClose, showSaveButton = true, submitting = false, onSubmit }) {
  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit?.(factory, new FormData(event.currentTarget))
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
            height: { xs: 'calc(100dvh - 64px)', md: 'calc(100dvh - 72px)' },
            maxHeight: { xs: 'calc(100dvh - 64px)', md: 'calc(100dvh - 72px)' },
            bgcolor: 'background.default',
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
            overflow: 'hidden',
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
            แก้ไขข้อมูลทั่วไปของโรงงาน
          </Typography>
          <IconButton aria-label="ปิด" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Divider />

        <Box
          component="form"
          id="master-data-general-info-form"
          onSubmit={handleSubmit}
          sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: { xs: 2, md: 3 }, bgcolor: 'background.default' }}
        >
          <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                ข้อมูลทั่วไปของโรงงาน
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(12, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
                <TextField name="factoryName" label="ชื่อโรงงาน" size="small" defaultValue={factory?.factoryName ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 6' } }} />
                <TextField label="เลขทะเบียนโรงงาน (เดิม)" size="small" defaultValue={factory?.oldRegistrationNo ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
                <TextField label="เลขทะเบียนโรงงาน (ใหม่)" size="small" defaultValue={factory?.newRegistrationNo ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
                <TextField label="การประกอบกิจการ" size="small" defaultValue={factory?.businessActivity ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 6' } }} />
                <TextField label="ลำดับประเภทโรงงาน (หลัก)" size="small" defaultValue={factory?.industryType ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
                <TextField label="ลำดับประเภทโรงงาน (รอง)" size="small" defaultValue={factory?.industrySubOrder ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
                <TextField
                  select
                  name="eia"
                  label="การประเมินผลกระทบสิ่งแวดล้อม"
                  size="small"
                  defaultValue={factory?.eia ?? 'ไม่มี'}
                  sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }}
                >
                  {eiaAssessmentOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
                <Box sx={{ display: { xs: 'none', md: 'block' }, gridColumn: 'span 9' }} />
                <TextField name="factoryAddress" label="สถานที่ตั้งโรงงาน" size="small" defaultValue={factory?.address ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 6' } }} />
                <TextField name="latitude" label="ละติจูด" size="small" defaultValue={factory?.latitude ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
                <TextField name="longitude" label="ลองจิจูด" size="small" defaultValue={factory?.longitude ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
                <Box sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }}>
                  <MockUploadField label="ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน" helperText="ขนาดไม่เกิน 5 Mb • อัปโหลดได้ไม่เกิน 3 ไฟล์" />
                </Box>
                <Box sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }}>
                  <MockUploadField label="สัญลักษณ์ของโรงงานหรือโลโก้บริษัท" helperText="ขนาด 512 × 512 pixel ไม่เกิน 5 Mb" />
                </Box>
              </Box>
            </Stack>
          </Paper>
        </Box>

        <Divider />
        <Stack direction="row" spacing={1.5} sx={{ px: { xs: 2, md: 3 }, py: 1.5, justifyContent: 'center', bgcolor: 'background.paper' }}>
            <Button variant="outlined" color="inherit" disabled={submitting} onClick={onClose}>
              ยกเลิก
            </Button>
            {showSaveButton ? (
            <Button
              type="submit"
              form="master-data-general-info-form"
              variant="contained"
              color="secondary"
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {submitting ? 'กำลังบันทึก' : 'บันทึก'}
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Drawer>
  )
}

function ReadOnlyFormField({ label, value, sx }) {
  return (
    <TextField
      label={label}
      size="small"
      value={displayValue(value)}
      fullWidth
      multiline
      maxRows={3}
      sx={sx}
      slotProps={{
        input: {
          readOnly: true,
        },
      }}
    />
  )
}

function RequestGeneralInfoPreview({ factory }) {
  return (
    <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          ข้อมูลทั่วไปของโรงงาน
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(12, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          <ReadOnlyFormField label="ชื่อโรงงาน" value={factory?.factoryName} sx={{ gridColumn: { xs: 'auto', md: 'span 6' } }} />
          <ReadOnlyFormField label="เลขทะเบียนโรงงาน (เดิม)" value={factory?.oldRegistrationNo} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
          <ReadOnlyFormField label="เลขทะเบียนโรงงาน (ใหม่)" value={factory?.newRegistrationNo} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
          <ReadOnlyFormField label="การประกอบกิจการ" value={factory?.businessActivity} sx={{ gridColumn: { xs: 'auto', md: 'span 6' } }} />
          <ReadOnlyFormField label="ลำดับประเภทโรงงาน (หลัก)" value={factory?.industryType} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
          <ReadOnlyFormField label="ลำดับประเภทโรงงาน (รอง)" value={factory?.industrySubOrder} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
          <ReadOnlyFormField label="การประเมินผลกระทบสิ่งแวดล้อม" value={factory?.eia ?? 'ไม่มี'} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
          <Box sx={{ display: { xs: 'none', md: 'block' }, gridColumn: 'span 9' }} />
          <ReadOnlyFormField label="สถานที่ตั้งโรงงาน" value={factory?.address} sx={{ gridColumn: { xs: 'auto', md: 'span 6' } }} />
          <ReadOnlyFormField label="ละติจูด" value={factory?.latitude} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
          <ReadOnlyFormField label="ลองจิจูด" value={factory?.longitude} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
          <Box sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }}>
            <MockUploadField label="ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน" helperText="ขนาดไม่เกิน 5 Mb • อัปโหลดได้ไม่เกิน 3 ไฟล์" disabled />
          </Box>
          <Box sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }}>
            <MockUploadField label="สัญลักษณ์ของโรงงานหรือโลโก้บริษัท" helperText="ขนาด 512 × 512 pixel ไม่เกิน 5 Mb" disabled />
          </Box>
        </Box>
      </Stack>
    </Paper>
  )
}

function RequestMonitoringPointPreview({ factory, measurementPoints }) {
  const firstPoint = Array.isArray(measurementPoints) ? measurementPoints[0] : Array.isArray(factory?.measurementPoints) ? factory.measurementPoints[0] : null
  const parameters = Array.isArray(firstPoint?.parameters) ? firstPoint.parameters.join(', ') : firstPoint?.parameters

  return (
    <Stack spacing={2}>
      <RequestGeneralInfoPreview factory={factory} />
      <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
        <Stack spacing={2}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            จุดตรวจวัด
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(12, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <ReadOnlyFormField label="ประเภทจุดตรวจวัด" value={firstPoint?.systemType ?? 'CEMS'} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
            <ReadOnlyFormField label="รหัสจุดตรวจวัด" value={firstPoint ? getMonitoringPointCode(firstPoint, 0) : ''} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
            <ReadOnlyFormField label="ชื่อจุดตรวจวัด" value={firstPoint?.pointName ?? firstPoint?.name} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
          </Box>
        </Stack>
      </Paper>
      <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
        <Stack spacing={2}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            รายละเอียดจุดตรวจวัด
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(12, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <ReadOnlyFormField label="รหัสจุดตรวจวัด" value={firstPoint ? getMonitoringPointCode(firstPoint, 0) : ''} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
            <ReadOnlyFormField label="ชื่อจุดตรวจวัด" value={firstPoint?.pointName ?? firstPoint?.name} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
            <ReadOnlyFormField label="พารามิเตอร์ที่เชื่อมต่อแล้ว" value={parameters} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
            <ReadOnlyFormField label="พารามิเตอร์ที่ยังไม่เชื่อมต่อ" value="-" sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
            <ReadOnlyFormField label="พารามิเตอร์ที่ขอเชื่อมต่อ" value="-" sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
            <ReadOnlyFormField label="อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ" value="-" sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
          </Box>
        </Stack>
      </Paper>
    </Stack>
  )
}

function RequestComparisonContent({ request, variant = 'after' }) {
  const raw = request?.raw ?? request
  const baseFactory = request?.factory ?? request
  const factory = normalizeFactoryDetail({
    ...baseFactory,
    ...(variant === 'before' ? raw?.currentFactory : raw?.proposedFactory),
    factoryId: raw?.factoryId ?? baseFactory?.factoryId,
    factoryRegistrationNo: raw?.factoryRegistrationNo ?? baseFactory?.factoryRegistrationNo,
    factoryName: (variant === 'before' ? raw?.currentFactory?.factoryName : raw?.proposedFactory?.factoryName) ?? baseFactory?.factoryName,
  })
  const measurementPoints = variant === 'before'
    ? raw?.currentMeasurementPoints
    : raw?.proposedMeasurementPoints
  const isPointForm = request?.form === 'แก้ไขข้อมูลจุดตรวจวัด'

  return isPointForm
    ? <RequestMonitoringPointPreview factory={factory} measurementPoints={measurementPoints} />
    : <RequestGeneralInfoPreview factory={factory} />
}

function RequestViewBottomSheet({
  open,
  request,
  onClose,
  showReviewActions = false,
  reviewSubmitting = false,
  onApprove,
  onRequestRevision,
  onReject,
}) {
  const [activeTab, setActiveTab] = useState('after')

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      transitionDuration={{ enter: 280, exit: 220 }}
      slotProps={{
        paper: {
          sx: {
            height: { xs: 'calc(100dvh - 64px)', md: 'calc(100dvh - 72px)' },
            bgcolor: 'background.default',
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
            overflow: 'hidden',
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
          <Box sx={{ minWidth: 0, textAlign: 'center' }}>
            <Typography variant="h6" component="h2" fontWeight={700}>
              {request?.form ?? 'รายละเอียดคำขอ'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {request?.requestNo ?? '-'}
            </Typography>
          </Box>
          <IconButton aria-label="ปิด" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Divider />
        <Box sx={{ px: { xs: 2, md: 3 }, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, value) => setActiveTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 44,
              '& .MuiTab-root': { minHeight: 44, fontWeight: 600 },
              '& .MuiTabs-indicator': {
                bgcolor: activeTab === 'after' ? '#f97316' : '#2563eb',
              },
            }}
          >
            <Tab
              value="after"
              label="ข้อมูลที่แก้ไข"
              sx={{
                color: '#f97316',
                '&.Mui-selected': { color: '#f97316' },
              }}
            />
            <Tab
              value="before"
              label="ข้อมูลก่อนแก้ไข"
              sx={{
                color: '#2563eb',
                '&.Mui-selected': { color: '#2563eb' },
              }}
            />
          </Tabs>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: { xs: 2, md: 3 }, bgcolor: 'background.default' }}>
          <RequestComparisonContent request={request} variant={activeTab} />
        </Box>
        {showReviewActions ? (
          <>
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
              <Button variant="outlined" color="inherit" disabled={reviewSubmitting} onClick={onClose}>
                ยกเลิก
              </Button>
              <Button variant="outlined" color="warning" disabled={reviewSubmitting} onClick={onRequestRevision}>
                แจ้งแก้ไข
              </Button>
              <Button variant="outlined" color="error" disabled={reviewSubmitting} onClick={onReject}>
                ไม่อนุมัติ
              </Button>
              <Button
                variant="contained"
                color="secondary"
                disabled={reviewSubmitting}
                startIcon={reviewSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
                onClick={onApprove}
              >
                {reviewSubmitting ? 'กำลังบันทึก' : 'อนุมัติ'}
              </Button>
            </Stack>
          </>
        ) : null}
      </Stack>
    </Drawer>
  )
}

function makeMasterDataInitialRequest(factory) {
  const firstPoint = factory?.selectedMeasurementPoint ?? (Array.isArray(factory?.measurementPoints) ? factory.measurementPoints[0] : null)
  const systemType = firstPoint?.systemType ?? 'CEMS'
  const pointCode = firstPoint ? getMonitoringPointCode(firstPoint, 0) : ''
  const pointName = firstPoint?.pointName ?? firstPoint?.name ?? ''
  const connectedParameters = Array.isArray(firstPoint?.parameters) ? firstPoint.parameters : []
  const pointDetails = firstPoint?.details ?? {}

  return {
    id: `master-data-${factory?.id ?? 'mock'}`,
    factoryId: factory?.newRegistrationNo ?? factory?.factoryId ?? factory?.id ?? '',
    factoryName: factory?.factoryName ?? '',
    newRegistrationNo: factory?.newRegistrationNo ?? '',
    oldRegistrationNo: factory?.oldRegistrationNo ?? '',
    factoryRegistrationNo: factory?.oldRegistrationNo ?? '',
    industryMainOrder: factory?.industryType ?? '',
    industrySubOrder: factory?.industrySubOrder ?? '',
    businessActivity: factory?.businessActivity ?? '',
    eia: factory?.eia ?? '',
    address: factory?.address ?? '',
    latitude: factory?.latitude ?? '',
    longitude: factory?.longitude ?? '',
    systemType,
    contactPersons: [{ id: 1 }],
    notificationEmails: [''],
    measurementPoints: [
      {
        connectedPointId: firstPoint?.connectedPointId ?? firstPoint?.id ?? null,
        monitoringPointStatus: firstPoint?.monitoringPointStatus ?? firstPoint?.status ?? null,
        pointCode,
        code: pointCode,
        pointName,
        details: {
          ...pointDetails,
          monitoringPointKind: systemType,
          pointCode,
          pointName,
          eligibleParameters: pointDetails.eligibleParameters ?? connectedParameters,
          connectedParameters: pointDetails.connectedParameters ?? connectedParameters,
          exemptedParameters: pointDetails.exemptedParameters ?? [],
          pendingParameters: pointDetails.pendingParameters ?? [],
          requestedParameters: pointDetails.requestedParameters ?? [],
        },
        documentsAndImages: firstPoint?.documentsAndImages ?? [],
        measurementInstruments: firstPoint?.measurementInstruments ?? null,
      },
    ],
  }
}

function getFactoryRowId(factory) {
  return factory?.factoryId ?? factory?.newRegistrationNo ?? factory?.factoryRegistrationNo ?? factory?.id ?? ''
}

function buildBasicInfoPayload(factory, formData) {
  const eia = formData.get('eia') || factory?.eia || null
  return {
    formType: 'BASIC_INFO',
    factoryName: String(formData.get('factoryName') ?? factory?.factoryName ?? '').trim(),
    factoryAddress: emptyToNull(formData.get('factoryAddress') ?? factory?.address),
    latitude: toNumberOrNull(formData.get('latitude') ?? factory?.latitude),
    longitude: toNumberOrNull(formData.get('longitude') ?? factory?.longitude),
    eia,
    eiaOther: eia === 'อื่นๆ'
      ? emptyToNull(formData.has('eiaOther') ? formData.get('eiaOther') : factory?.eiaOther)
      : null,
    projectName: emptyToNull(formData.has('projectName') ? formData.get('projectName') : factory?.projectName),
    factoryFrontPhotos: sanitizeDocuments(factory?.factoryFrontPhotos),
    factoryLogo: factory?.factoryLogo ? sanitizeDocumentItem(factory.factoryLogo) : null,
    note: 'แก้ไขข้อมูลทั่วไปของโรงงาน',
  }
}

function buildMeasurementPointsPayload(requestBody, initialRequest) {
  const point = requestBody?.measurementPoints?.[0] ?? {}
  const initialPoint = initialRequest?.measurementPoints?.[0] ?? {}
  const pointName = point.pointName ?? point.details?.pointName ?? initialPoint.pointName ?? ''

  return {
    formType: 'MEASUREMENT_POINTS',
    measurementPoints: [
      {
        connectedPointId: initialPoint.connectedPointId,
        pointName,
        monitoringPointStatus: point.monitoringPointStatus ?? initialPoint.monitoringPointStatus ?? null,
        details: point.details ?? null,
        documentsAndImages: sanitizeDocuments(point.documentsAndImages ?? initialPoint.documentsAndImages),
        measurementInstruments: point.measurementInstruments ?? initialPoint.measurementInstruments ?? null,
      },
    ],
    note: 'แก้ไขข้อมูลจุดตรวจวัด',
  }
}

function MasterDataPage({ userType = '', roleCode = '', accessToken = '' }) {
  const [selectedFactory, setSelectedFactory] = useState(null)
  const [editingFactory, setEditingFactory] = useState(null)
  const [editingGeneralFactory, setEditingGeneralFactory] = useState(null)
  const [viewingRequest, setViewingRequest] = useState(null)
  const [reviewingRequest, setReviewingRequest] = useState(null)
  const [activeSubMenu, setActiveSubMenu] = useState('factories')
  const [factoryRows, setFactoryRows] = useState([])
  const [requestRows, setRequestRows] = useState([])
  const [loadingFactories, setLoadingFactories] = useState(false)
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [tableError, setTableError] = useState('')
  const [snackbarMessage, setSnackbarMessage] = useState('')
  const isAdmin = String(roleCode).toLowerCase() === 'admin' || String(userType).toLowerCase() === 'admin'
  const isOperator = String(userType).toLowerCase() === 'operator'
  const canSubmitMasterData = isAdmin || String(userType).toLowerCase() === 'operator'
  const visibleSubMenus = useMemo(
    () => (isAdmin || isOperator ? pageSubMenus : pageSubMenus.filter((menu) => menu.value !== 'requests')),
    [isAdmin, isOperator],
  )
  const effectiveSubMenu = isAdmin || isOperator ? activeSubMenu : 'factories'
  const rows = factoryRows

  const loadFactories = useCallback(async () => {
    if (!accessToken) {
      setFactoryRows([])
      return
    }

    setLoadingFactories(true)
    setTableError('')
    try {
      const result = await fetch(pomsFactoriesApiBaseUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      })
      const response = await readMasterDataResponse(result, 'โหลดรายชื่อโรงงานไม่สำเร็จ')
      setFactoryRows(mapFactoryRows(response?.data ?? []))
    } catch (error) {
      setTableError(error instanceof Error ? error.message : 'โหลดรายชื่อโรงงานไม่สำเร็จ')
      setFactoryRows([])
    } finally {
      setLoadingFactories(false)
    }
  }, [accessToken])

  const loadRequests = useCallback(async () => {
    if (!accessToken || (!isAdmin && !isOperator)) {
      setRequestRows([])
      return
    }

    setLoadingRequests(true)
    setTableError('')
    try {
      const result = await fetch(`${pomsFactoriesApiBaseUrl}/edit-requests`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      })
      const response = await readMasterDataResponse(result, 'โหลดรายการคำขอไม่สำเร็จ')
      setRequestRows(mapEditRequestRows(response?.data ?? []))
    } catch (error) {
      setTableError(error instanceof Error ? error.message : 'โหลดรายการคำขอไม่สำเร็จ')
      setRequestRows([])
    } finally {
      setLoadingRequests(false)
    }
  }, [accessToken, isAdmin, isOperator])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadFactories()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadFactories])

  useEffect(() => {
    if (effectiveSubMenu === 'requests') {
      const timeoutId = window.setTimeout(() => {
        loadRequests()
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }
    return undefined
  }, [effectiveSubMenu, loadRequests])

  const loadFactoryDetail = useCallback(async (factory) => {
    const factoryId = getFactoryRowId(factory)
    if (!accessToken || !factoryId) {
      return factory
    }

    const result = await fetch(`${pomsFactoriesApiBaseUrl}/${encodeURIComponent(factoryId)}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const response = await readMasterDataResponse(result, 'โหลดข้อมูลโรงงานไม่สำเร็จ')
    return normalizeFactoryDetail(response?.data ?? factory)
  }, [accessToken])

  const loadRequestDetail = useCallback(async (request) => {
    const requestId = request?.requestId ?? request?.id
    if (!accessToken || !requestId) {
      return request
    }

    const result = await fetch(`${pomsFactoriesApiBaseUrl}/edit-requests/${encodeURIComponent(requestId)}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const response = await readMasterDataResponse(result, 'โหลดรายละเอียดคำขอไม่สำเร็จ')
    const mapped = mapEditRequestRows([response?.data ?? {}])[0]
    return {
      ...mapped,
      raw: response?.data,
    }
  }, [accessToken])

  const handleOpenFactory = useCallback(async (factory) => {
    setActionLoading(true)
    setTableError('')
    try {
      setSelectedFactory(await loadFactoryDetail(factory))
    } catch (error) {
      setTableError(error instanceof Error ? error.message : 'โหลดข้อมูลโรงงานไม่สำเร็จ')
    } finally {
      setActionLoading(false)
    }
  }, [loadFactoryDetail])

  const handleEditFactory = useCallback(async (factory) => {
    setSelectedFactory(null)
    setActionLoading(true)
    setTableError('')
    try {
      setEditingFactory(await loadFactoryDetail(factory))
    } catch (error) {
      setTableError(error instanceof Error ? error.message : 'โหลดข้อมูลโรงงานไม่สำเร็จ')
    } finally {
      setActionLoading(false)
    }
  }, [loadFactoryDetail])
  const handleEditGeneralFactory = useCallback(async (factory) => {
    setSelectedFactory(null)
    setActionLoading(true)
    setTableError('')
    try {
      setEditingGeneralFactory(await loadFactoryDetail(factory))
    } catch (error) {
      setTableError(error instanceof Error ? error.message : 'โหลดข้อมูลโรงงานไม่สำเร็จ')
    } finally {
      setActionLoading(false)
    }
  }, [loadFactoryDetail])
  const handleOpenRequest = useCallback(async (request, review = false) => {
    setActionLoading(true)
    setTableError('')
    try {
      const detail = await loadRequestDetail(request)
      if (review) {
        setReviewingRequest(detail)
      } else {
        setViewingRequest(detail)
      }
    } catch (error) {
      setTableError(error instanceof Error ? error.message : 'โหลดรายละเอียดคำขอไม่สำเร็จ')
    } finally {
      setActionLoading(false)
    }
  }, [loadRequestDetail])

  const columns = useMemo(() => getFactoryColumns(handleOpenFactory, handleEditGeneralFactory), [handleOpenFactory, handleEditGeneralFactory])
  const pageRequestColumns = useMemo(
    () => getPageRequestColumns(
      (request) => handleOpenRequest(request, false),
      (request) => handleOpenRequest(request, true),
      isAdmin,
    ),
    [handleOpenRequest, isAdmin],
  )

  const submitFactoryEditRequest = useCallback(async (factory, body) => {
    const factoryId = getFactoryRowId(factory)
    if (!accessToken || !factoryId) {
      throw new Error('ไม่พบข้อมูลโรงงานสำหรับส่งคำขอแก้ไข')
    }

    const result = await fetch(`${pomsFactoriesApiBaseUrl}/${encodeURIComponent(factoryId)}/edit-requests`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const response = await readMasterDataResponse(result, 'ส่งคำขอแก้ไขไม่สำเร็จ')
    await Promise.all([loadFactories(), loadRequests()])
    setSnackbarMessage('ส่งคำขอแก้ไขสำเร็จ')
    return response?.data
  }, [accessToken, loadFactories, loadRequests])

  const handleSubmitGeneralInfo = useCallback(async (factory, formData) => {
    setActionLoading(true)
    setTableError('')
    try {
      await submitFactoryEditRequest(factory, buildBasicInfoPayload(factory, formData))
      setEditingGeneralFactory(null)
    } catch (error) {
      setTableError(error instanceof Error ? error.message : 'ส่งคำขอแก้ไขไม่สำเร็จ')
    } finally {
      setActionLoading(false)
    }
  }, [submitFactoryEditRequest])

  const handleSubmitMeasurementPoints = useCallback(async (requestBody) => {
    const initialRequest = makeMasterDataInitialRequest(editingFactory)
    const payload = buildMeasurementPointsPayload(requestBody, initialRequest)
    const response = await submitFactoryEditRequest(editingFactory, payload)
    setEditingFactory(null)
    return response
  }, [editingFactory, submitFactoryEditRequest])

  const reviewEditRequest = useCallback(async (decision) => {
    const requestId = reviewingRequest?.requestId ?? reviewingRequest?.id
    if (!accessToken || !requestId) {
      setTableError('ไม่พบรหัสคำขอสำหรับพิจารณา')
      return
    }

    const body = {
      decision,
      revisionReason: decision === 'REQUEST_REVISION' ? 'กรุณาแก้ไขข้อมูลให้ถูกต้อง' : null,
      officerNote: decision === 'REJECT' ? 'ไม่อนุมัติ' : null,
    }

    setActionLoading(true)
    setTableError('')
    try {
      const result = await fetch(`${pomsFactoriesApiBaseUrl}/edit-requests/${encodeURIComponent(requestId)}/review`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      await readMasterDataResponse(result, 'พิจารณาคำขอไม่สำเร็จ')
      setReviewingRequest(null)
      await Promise.all([loadFactories(), loadRequests()])
      setSnackbarMessage(
        decision === 'APPROVE'
          ? 'อนุมัติคำขอสำเร็จ'
          : decision === 'REQUEST_REVISION'
            ? 'แจ้งแก้ไขคำขอสำเร็จ'
            : 'ไม่อนุมัติคำขอสำเร็จ',
      )
    } catch (error) {
      setTableError(error instanceof Error ? error.message : 'พิจารณาคำขอไม่สำเร็จ')
    } finally {
      setActionLoading(false)
    }
  }, [accessToken, loadFactories, loadRequests, reviewingRequest])

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
            <Typography variant="h5" component="h1" fontWeight={700}>
              ข้อมูลพื้นฐาน
            </Typography>
            <Tabs
              value={effectiveSubMenu}
              onChange={(_, value) => setActiveSubMenu(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 40,
                '& .MuiTab-root': {
                  minHeight: 40,
                },
              }}
            >
              {visibleSubMenus.map((menu) => (
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
          {tableError ? (
            <Alert severity="error" sx={{ borderRadius: 0 }}>
              {tableError}
            </Alert>
          ) : null}
          <DataGrid
            rows={effectiveSubMenu === 'factories' ? rows : requestRows}
            columns={effectiveSubMenu === 'factories' ? columns : pageRequestColumns}
            loading={effectiveSubMenu === 'factories' ? loadingFactories || actionLoading : loadingRequests || actionLoading}
            disableRowSelectionOnClick
            showToolbar
            showCellVerticalBorder
            showColumnVerticalBorder
            label={effectiveSubMenu === 'factories' ? 'โรงงานที่มีอยู่ในระบบ POMS' : 'รายการคำขอแก้ไขข้อมูลพื้นฐาน'}
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
      </Stack>

      <FactoryDetailDialog
        key={selectedFactory?.id ?? 'factory-detail'}
        factory={selectedFactory}
        open={Boolean(selectedFactory)}
        onClose={() => setSelectedFactory(null)}
        onEdit={handleEditFactory}
      />

      <RequestFormBottomSheet
        open={Boolean(editingFactory)}
        formType="เพิ่มจุดตรวจวัด"
        factory={editingFactory}
        mode="edit"
        requestId={editingFactory?.id ?? ''}
        initialRequest={makeMasterDataInitialRequest(editingFactory)}
        titleOverride="แก้ไขข้อมูลจุดตรวจวัด"
        accessToken={accessToken}
        submitButtonLabel="บันทึก"
        submitWithoutPreview
        customSubmit={canSubmitMasterData ? handleSubmitMeasurementPoints : null}
        footerActions={canSubmitMasterData ? undefined : null}
        onClose={() => setEditingFactory(null)}
      />

      <FactoryGeneralInfoBottomSheet
        open={Boolean(editingGeneralFactory)}
        factory={editingGeneralFactory}
        showSaveButton={canSubmitMasterData}
        submitting={actionLoading}
        onSubmit={handleSubmitGeneralInfo}
        onClose={() => setEditingGeneralFactory(null)}
      />

      <RequestViewBottomSheet
        open={Boolean(viewingRequest)}
        request={viewingRequest}
        onClose={() => setViewingRequest(null)}
      />

      <RequestViewBottomSheet
        open={Boolean(reviewingRequest)}
        request={reviewingRequest}
        showReviewActions
        reviewSubmitting={actionLoading}
        onApprove={() => reviewEditRequest('APPROVE')}
        onRequestRevision={() => reviewEditRequest('REQUEST_REVISION')}
        onReject={() => reviewEditRequest('REJECT')}
        onClose={() => setReviewingRequest(null)}
      />
      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={4000}
        onClose={() => setSnackbarMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSnackbarMessage('')}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  )
}

export default MasterDataPage
