import { useCallback, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
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
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { DataGrid } from '@mui/x-data-grid'
import { mockOperatorFactoryRows } from './HomePageMockup'
import { RequestFormBottomSheet } from './ConnectionRequestPage'

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

const requestStatusMockValues = [
  'อนุมัติ',
  'ยกเลิก',
  'รอโรงงานแก้ไข',
  'แก้ไขแล้ว/รอพิจารณา',
  'รอพิจารณา',
]

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

function displayValue(value) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

function sumMonitoringPointCount(row) {
  if (Array.isArray(row.monitoringPointCountBySystem)) {
    return row.monitoringPointCountBySystem.reduce((total, item) => total + Number(item?.count ?? 0), 0)
  }

  return Array.isArray(row.measurementPoints) ? row.measurementPoints.length : 0
}

function getFactorySystemText(row) {
  if (!Array.isArray(row.monitoringPointCountBySystem) || row.monitoringPointCountBySystem.length === 0) {
    return '-'
  }

  return row.monitoringPointCountBySystem
    .map((item) => `${item.systemType ?? '-'} ${Number(item.count ?? 0).toLocaleString('th-TH')}`)
    .join(', ')
}

function getMonitoringPointCode(point, index) {
  const prefix = point?.systemType === 'WPMS' ? 'P' : 'S'
  return `${prefix}${String(index + 1).padStart(4, '0')}`
}

function getRequestNo(index) {
  return index === 0 ? 'base-69-00001' : 'point-69-00002'
}

function getLatestUpdatedAt(point) {
  const latestRow = Array.isArray(point?.data) ? point.data.at(-1) : null
  return latestRow?.cdate || '-'
}

function mapFactoryRows(rows) {
  return rows.map((row, index) => ({
    id: row.factoryId || `factory-${index}`,
    factoryName: row.factoryName ?? '',
    newRegistrationNo: row.factoryId ?? '',
    oldRegistrationNo: row.oldRegistrationNo ?? '',
    industryType: row.industryType || row.newRegistrationNo || '-',
    businessActivity: row.industryMainOrderLabel ?? row.businessActivity ?? row.industryType ?? '-',
    address: row.address ?? '',
    province: row.province ?? '',
    industrialEstateCode: row.industrialEstateCode ?? '',
    latitude: row.latitude ?? '',
    longitude: row.longitude ?? '',
    monitoringDeviceCount: sumMonitoringPointCount(row),
    monitoringPointCount: sumMonitoringPointCount(row),
    monitoringSystemText: getFactorySystemText(row),
    requestStatus: '-',
    status: row.status ?? 'แสดง',
    measurementPoints: Array.isArray(row.measurementPoints) ? row.measurementPoints : [],
    source: row,
  }))
}

function makeRequestRows(factory) {
  if (!factory) {
    return []
  }

  const points = Array.isArray(factory.measurementPoints) ? factory.measurementPoints : []
  const rows = points.map((point, index) => ({
    id: `${factory.id}-request-${index + 1}`,
    requestNo: getRequestNo(index),
    requestType: index === 0 ? 'เพิ่มจุดตรวจวัด' : 'เพิ่มพารามิเตอร์',
    systemType: index === 0 ? '-' : point.systemType ?? '-',
    pointCode: index === 0 ? '-' : getMonitoringPointCode(point, index),
    pointName: point.pointName ?? point.name ?? '-',
    submittedDate: index % 2 === 0 ? '15/06/2569' : '12/06/2569',
    reviewedDate: index % 2 === 0 ? '18/06/2569' : '16/06/2569',
    codeIssuedDate: index % 2 === 0 ? '18/06/2569' : '16/06/2569',
    form: index === 0 ? 'แก้ไขข้อมูลพื้นฐาน' : 'แก้ไขข้อมูลจุดตรวจวัด',
    status: requestStatusMockValues[index % requestStatusMockValues.length],
  }))

  return rows.length > 0
    ? rows
    : [
        {
          id: `${factory.id}-request-empty`,
          requestNo: 'base-69-00001',
          requestType: 'เพิ่มจุดตรวจวัด',
          systemType: '-',
          pointCode: '-',
          pointName: '-',
          submittedDate: '15/06/2569',
          reviewedDate: '18/06/2569',
          codeIssuedDate: '18/06/2569',
          form: 'แก้ไขข้อมูลพื้นฐาน',
          status: requestStatusMockValues[0],
        },
      ]
}

function makeAllRequestRows(factories) {
  return factories.flatMap((factory, factoryIndex) =>
    makeRequestRows(factory).map((request, index) => ({
      ...request,
      status: requestStatusMockValues[(factoryIndex + index) % requestStatusMockValues.length],
      factoryId: factory.id,
      factoryName: factory.factoryName,
      factoryRegistrationNo: factory.newRegistrationNo,
      province: factory.province,
      factory,
    })),
  )
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

function ReadOnlyField({ label, value }) {
  return (
    <TextField
      label={label}
      value={displayValue(value)}
      size="small"
      fullWidth
      multiline
      maxRows={3}
      slotProps={{
        input: {
          readOnly: true,
        },
      }}
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

const requestColumns = [
  { field: 'requestNo', headerName: 'เลขที่คำขอ', width: 150 },
  { field: 'requestType', headerName: 'ประเภทคำขอ', width: 150 },
  { field: 'systemType', headerName: 'ประเภทจุดตรวจวัด', width: 160 },
  { field: 'pointCode', headerName: 'รหัสจุดตรวจวัด', width: 170 },
  { field: 'pointName', headerName: 'ชื่อจุดตรวจวัด', width: 220 },
  { field: 'submittedDate', headerName: 'วันที่ยื่นคำขอ', width: 150 },
  { field: 'reviewedDate', headerName: 'วันที่พิจารณา', width: 150 },
  { field: 'status', headerName: 'สถานะ', width: 170, renderCell: (params) => <StatusChip value={params.value} /> },
  {
    field: 'actions',
    headerName: 'จัดการ',
    width: 130,
    sortable: false,
    filterable: false,
    renderCell: () => (
      <Button size="small" variant="outlined">
        เปิดดู
      </Button>
    ),
  },
]

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
    id: point.id ?? point.pointCode ?? point.stationId ?? `${factory.id}-point-${index}`,
    pointCode: getMonitoringPointCode(point, index),
    pointName: point.pointName ?? point.name ?? '-',
    systemType: point.systemType ?? '-',
    parameters: Array.isArray(point.parameters)
      ? point.parameters.join(', ')
      : point.parameters ?? point.parameterText ?? 'CO (ppm), NOx (ppm), Temp. (°C), O2 (%), Flow (m3/hr)',
    latestUpdatedAt: getLatestUpdatedAt(point),
    status: point.status ?? 'เชื่อมต่อแล้ว',
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
                        onEdit={() => onEdit(sourceFactory)}
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

function FactoryGeneralInfoBottomSheet({ open, factory, onClose, showSaveButton = true }) {
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

        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: { xs: 2, md: 3 }, bgcolor: 'background.default' }}>
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
                <TextField label="ชื่อโรงงาน" size="small" defaultValue={factory?.factoryName ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 6' } }} />
                <TextField label="เลขทะเบียนโรงงาน (เดิม)" size="small" defaultValue={factory?.oldRegistrationNo ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
                <TextField label="เลขทะเบียนโรงงาน (ใหม่)" size="small" defaultValue={factory?.newRegistrationNo ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
                <TextField label="การประกอบกิจการ" size="small" defaultValue={factory?.businessActivity ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 6' } }} />
                <TextField label="ลำดับประเภทโรงงาน (หลัก)" size="small" defaultValue={factory?.industryType ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
                <TextField label="ลำดับประเภทโรงงาน (รอง)" size="small" defaultValue={factory?.industrySubOrder ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
                <TextField
                  select
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
                <TextField label="สถานที่ตั้งโรงงาน" size="small" defaultValue={factory?.address ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 6' } }} />
                <TextField label="ละติจูด" size="small" defaultValue={factory?.latitude ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
                <TextField label="ลองจิจูด" size="small" defaultValue={factory?.longitude ?? ''} sx={{ gridColumn: { xs: 'auto', md: 'span 3' } }} />
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
          <Button variant="outlined" color="inherit" onClick={onClose}>
            ยกเลิก
          </Button>
          {showSaveButton ? (
            <Button variant="contained" color="secondary" onClick={onClose}>
              บันทึก
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

function RequestMonitoringPointPreview({ factory }) {
  const firstPoint = Array.isArray(factory?.measurementPoints) ? factory.measurementPoints[0] : null
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

function RequestComparisonContent({ request }) {
  const factory = request?.factory
  const isPointForm = request?.form === 'แก้ไขข้อมูลจุดตรวจวัด'

  return isPointForm ? <RequestMonitoringPointPreview factory={factory} /> : <RequestGeneralInfoPreview factory={factory} />
}

function RequestViewBottomSheet({ open, request, onClose, showReviewActions = false }) {
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
              <Button variant="outlined" color="inherit" onClick={onClose}>
                ยกเลิก
              </Button>
              <Button variant="outlined" color="warning" onClick={onClose}>
                แจ้งแก้ไข
              </Button>
              <Button variant="contained" color="secondary" onClick={onClose}>
                อนุมัติ
              </Button>
            </Stack>
          </>
        ) : null}
      </Stack>
    </Drawer>
  )
}

function makeMasterDataInitialRequest(factory) {
  const firstPoint = Array.isArray(factory?.measurementPoints) ? factory.measurementPoints[0] : null
  const systemType = firstPoint?.systemType ?? 'CEMS'
  const pointCode = firstPoint ? getMonitoringPointCode(firstPoint, 0) : ''
  const pointName = firstPoint?.pointName ?? firstPoint?.name ?? ''
  const connectedParameters = Array.isArray(firstPoint?.parameters) ? firstPoint.parameters : []

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
        pointCode,
        code: pointCode,
        pointName,
        details: {
          monitoringPointKind: systemType,
          pointCode,
          pointName,
          eligibleParameters: connectedParameters,
          connectedParameters,
          exemptedParameters: [],
          pendingParameters: [],
          requestedParameters: [],
        },
      },
    ],
  }
}

function MasterDataPage({ userType = '', roleCode = '' }) {
  const [selectedFactory, setSelectedFactory] = useState(null)
  const [editingFactory, setEditingFactory] = useState(null)
  const [editingGeneralFactory, setEditingGeneralFactory] = useState(null)
  const [viewingRequest, setViewingRequest] = useState(null)
  const [reviewingRequest, setReviewingRequest] = useState(null)
  const [activeSubMenu, setActiveSubMenu] = useState('factories')
  const isAdmin = String(roleCode || userType).toLowerCase() === 'admin'
  const visibleSubMenus = useMemo(
    () => (isAdmin ? pageSubMenus : pageSubMenus.filter((menu) => menu.value !== 'requests')),
    [isAdmin],
  )
  const effectiveSubMenu = isAdmin ? activeSubMenu : 'factories'
  const rows = useMemo(() => mapFactoryRows(mockOperatorFactoryRows), [])
  const requestRows = useMemo(() => makeAllRequestRows(rows), [rows])

  const handleEditFactory = useCallback((factory) => {
    setSelectedFactory(null)
    setEditingFactory(factory)
  }, [])
  const handleEditGeneralFactory = useCallback((factory) => {
    setSelectedFactory(null)
    setEditingGeneralFactory(factory)
  }, [])
  const columns = useMemo(() => getFactoryColumns(setSelectedFactory, handleEditGeneralFactory), [handleEditGeneralFactory])
  const pageRequestColumns = useMemo(() => getPageRequestColumns(setViewingRequest, setReviewingRequest, isAdmin), [isAdmin])

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
          <DataGrid
            rows={effectiveSubMenu === 'factories' ? rows : requestRows}
            columns={effectiveSubMenu === 'factories' ? columns : pageRequestColumns}
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
        footerActions={
          <>
            <Button variant="outlined" color="inherit" onClick={() => setEditingFactory(null)}>
              ยกเลิก
            </Button>
            {isAdmin ? (
              <Button variant="contained" color="secondary" onClick={() => setEditingFactory(null)}>
                บันทึก
              </Button>
            ) : null}
          </>
        }
        onClose={() => setEditingFactory(null)}
      />

      <FactoryGeneralInfoBottomSheet
        open={Boolean(editingGeneralFactory)}
        factory={editingGeneralFactory}
        showSaveButton={isAdmin}
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
        onClose={() => setReviewingRequest(null)}
      />
    </>
  )
}

export default MasterDataPage
