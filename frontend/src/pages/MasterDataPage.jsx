import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import SettingsIcon from '@mui/icons-material/Settings'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { DataGrid } from '@mui/x-data-grid'
import { mockOperatorFactoryRows } from './HomePageMockup'

const detailTabs = [
  { value: 'basic', label: 'ข้อมูลพื้นฐาน' },
  { value: 'points', label: 'จุดตรวจวัด' },
  { value: 'requests', label: 'รายการคำขอทั้งหมด' },
]

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

function mapFactoryRows(rows) {
  return rows.map((row, index) => ({
    id: row.factoryId || `factory-${index}`,
    factoryName: row.factoryName ?? '',
    newRegistrationNo: row.factoryId ?? '',
    oldRegistrationNo: row.oldRegistrationNo ?? '',
    industryType: row.industryType || row.newRegistrationNo || '-',
    address: row.address ?? '',
    province: row.province ?? '',
    industrialEstateCode: row.industrialEstateCode ?? '',
    latitude: row.latitude ?? '',
    longitude: row.longitude ?? '',
    monitoringDeviceCount: sumMonitoringPointCount(row),
    monitoringSystemText: getFactorySystemText(row),
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
    requestNo: `REQ-2569-${String(index + 1).padStart(4, '0')}`,
    requestType: index === 0 ? 'เพิ่มจุดตรวจวัด' : 'เพิ่มพารามิเตอร์',
    systemType: point.systemType ?? '-',
    pointCode: getMonitoringPointCode(point, index),
    pointName: point.pointName ?? point.name ?? '-',
    submittedDate: index % 2 === 0 ? '15/06/2569' : '12/06/2569',
    reviewedDate: index % 2 === 0 ? '18/06/2569' : '16/06/2569',
    status: 'เชื่อมต่อแล้ว',
  }))

  return rows.length > 0
    ? rows
    : [
        {
          id: `${factory.id}-request-empty`,
          requestNo: 'REQ-2569-0001',
          requestType: 'เพิ่มจุดตรวจวัด',
          systemType: '-',
          pointCode: '-',
          pointName: '-',
          submittedDate: '15/06/2569',
          reviewedDate: '18/06/2569',
          status: 'เชื่อมต่อแล้ว',
        },
      ]
}

function StatusChip({ value }) {
  const colorByStatus = {
    รอพิจารณา: {
      borderColor: '#fed7aa',
      color: '#9a3412',
      bgcolor: '#fff7ed',
    },
    เชื่อมต่อแล้ว: {
      borderColor: '#86efac',
      color: '#166534',
      bgcolor: '#dcfce7',
    },
    รอโรงงานแก้ไข: {
      borderColor: '#bfdbfe',
      color: '#1e40af',
      bgcolor: '#eff6ff',
    },
  }
  const sx = colorByStatus[value] ?? {
    borderColor: 'divider',
    color: 'text.secondary',
    bgcolor: 'background.paper',
  }

  return <Chip label={displayValue(value)} size="small" variant="outlined" sx={{ fontWeight: 600, ...sx }} />
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

function MainActions({ row, onOpen }) {
  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={<VisibilityIcon />}
      onClick={() => onOpen(row)}
      sx={{ minWidth: 96 }}
    >
      ดูข้อมูล
    </Button>
  )
}

function getFactoryColumns(onOpen) {
  return [
    { field: 'factoryName', headerName: 'ชื่อโรงงาน/บริษัท', minWidth: 260, flex: 1.2 },
    { field: 'newRegistrationNo', headerName: 'เลขทะเบียนโรงงาน (ใหม่)', width: 190 },
    { field: 'oldRegistrationNo', headerName: 'เลขทะเบียนโรงงาน (เก่า)', width: 190 },
    { field: 'province', headerName: 'จังหวัด', width: 150 },
    { field: 'address', headerName: 'ที่ตั้ง', minWidth: 280, flex: 1 },
    {
      field: 'monitoringDeviceCount',
      headerName: 'จำนวนอุปกรณ์ตรวจวัด',
      width: 170,
      type: 'number',
    },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: 140,
      sortable: false,
      filterable: false,
      renderCell: (params) => <MainActions row={params.row} onOpen={onOpen} />,
    },
  ]
}

function MonitoringPointActions({ userType }) {
  const canEdit = userType === 'officer'
  const canConfigure = userType === 'officer' || userType === 'operator'

  if (!canEdit && !canConfigure) {
    return null
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'nowrap' }}>
      {canEdit ? (
        <Button size="small" variant="outlined" startIcon={<EditIcon />} sx={{ minWidth: 116 }}>
          แก้ไขข้อมูล
        </Button>
      ) : null}
      {canConfigure ? (
        <Button size="small" variant="outlined" startIcon={<SettingsIcon />} sx={{ minWidth: 92 }}>
          ตั้งค่า
        </Button>
      ) : null}
    </Stack>
  )
}

function getMonitoringPointColumns(userType) {
  return [
    { field: 'pointCode', headerName: 'รหัสจุดตรวจวัด', width: 170 },
    { field: 'pointName', headerName: 'ชื่อจุดตรวจวัด', minWidth: 220, flex: 1 },
    { field: 'systemType', headerName: 'ประเภทจุดตรวจวัด', width: 160 },
    { field: 'parameters', headerName: 'พารามิเตอร์', minWidth: 260, flex: 1 },
    { field: 'status', headerName: 'สถานะ', width: 160, renderCell: (params) => <StatusChip value={params.value} /> },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: userType === 'officer' ? 240 : 130,
      sortable: false,
      filterable: false,
      renderCell: () => <MonitoringPointActions userType={userType} />,
    },
  ]
}

const requestColumns = [
  { field: 'requestNo', headerName: 'เลขที่คำขอ', width: 170 },
  { field: 'requestType', headerName: 'ประเภทคำขอ', width: 170 },
  { field: 'systemType', headerName: 'ประเภทจุดตรวจวัด', width: 160 },
  { field: 'pointCode', headerName: 'รหัสจุดตรวจวัด', width: 170 },
  { field: 'pointName', headerName: 'ชื่อจุดตรวจวัด', minWidth: 220, flex: 1 },
  { field: 'submittedDate', headerName: 'วันที่ยื่นคำขอ', width: 150 },
  { field: 'reviewedDate', headerName: 'วันที่พิจารณา', width: 150 },
  { field: 'status', headerName: 'สถานะ', width: 170, renderCell: (params) => <StatusChip value={params.value} /> },
]

function mapMonitoringPointRows(factory) {
  return (factory?.measurementPoints ?? []).map((point, index) => ({
    id: point.id ?? point.pointCode ?? point.stationId ?? `${factory.id}-point-${index}`,
    pointCode: getMonitoringPointCode(point, index),
    pointName: point.pointName ?? point.name ?? '-',
    systemType: point.systemType ?? '-',
    parameters: Array.isArray(point.parameters)
      ? point.parameters.join(', ')
      : point.parameters ?? point.parameterText ?? 'CO (ppm), NOx (ppm), Temp. (°C), O2 (%), Flow (m3/hr)',
    status: point.status ?? 'เชื่อมต่อแล้ว',
  }))
}

function DetailDataGrid({ title, rows, columns }) {
  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', overflow: 'hidden', height: 300 }}>
      <DataGrid
        rows={rows}
        columns={columns}
        disableRowSelectionOnClick
        showCellVerticalBorder
        showColumnVerticalBorder
        label={title}
        pageSizeOptions={[10, 25, 50]}
        initialState={{
          pagination: {
            paginationModel: { page: 0, pageSize: 5 },
          },
        }}
        localeText={dataGridLocaleText}
        sx={dataGridSx}
      />
    </Paper>
  )
}

function BasicInfoPanel({ factory }) {
  const fields = [
    ['ชื่อโรงงาน/บริษัท', factory.factoryName],
    ['เลขทะเบียนโรงงาน (ใหม่)', factory.newRegistrationNo],
    ['เลขทะเบียนโรงงาน (เก่า)', factory.oldRegistrationNo],
    ['ประเภทอุตสาหกรรม', factory.industryType],
    ['ระบบตรวจวัด', factory.monitoringSystemText],
    ['จำนวนอุปกรณ์ตรวจวัด', factory.monitoringDeviceCount],
    ['รหัสนิคมอุตสาหกรรม', factory.industrialEstateCode],
    ['จังหวัด', factory.province],
    ['ละติจูด', factory.latitude],
    ['ลองจิจูด', factory.longitude],
    ['ที่ตั้ง', factory.address],
  ]

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
        gap: 2,
      }}
    >
      {fields.map(([label, value]) => (
        <Box key={label} sx={{ gridColumn: label === 'ที่ตั้ง' ? { xs: 'auto', md: '1 / -1' } : 'auto' }}>
          <ReadOnlyField label={label} value={value} />
        </Box>
      ))}
    </Box>
  )
}

function FactoryDetailDialog({ factory, open, onClose, userType }) {
  const [selectedTab, setSelectedTab] = useState('basic')
  const monitoringPointRows = useMemo(() => mapMonitoringPointRows(factory), [factory])
  const monitoringPointColumns = useMemo(() => getMonitoringPointColumns(userType), [userType])
  const requestRows = useMemo(() => makeRequestRows(factory), [factory])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      slotProps={{
        paper: {
          sx: {
            height: { xs: '78dvh', md: 620 },
            maxHeight: { xs: '78dvh', md: 'calc(100dvh - 96px)' },
            borderRadius: 2,
          },
        },
      }}
    >
      {factory ? (
        <Box sx={{ display: 'flex', minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
          <Stack
            direction="row"
            spacing={2}
            sx={{
              alignItems: 'flex-start',
              borderBottom: 1,
              borderColor: 'divider',
              px: { xs: 2, md: 3 },
              py: 2,
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h6" sx={{ color: 'primary.900', fontWeight: 700, lineHeight: 1.35 }}>
                {factory.factoryName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {factory.newRegistrationNo} ({factory.oldRegistrationNo})
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {factory.address}
              </Typography>
            </Box>

            <Tooltip title="ปิด">
              <IconButton aria-label="ปิด" onClick={onClose}>
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Stack>

          <Box sx={{ px: { xs: 2, md: 3 }, borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={selectedTab}
              onChange={(_, value) => setSelectedTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 44,
                '& .MuiTab-root': {
                  minHeight: 44,
                  fontWeight: 600,
                },
              }}
            >
              {detailTabs.map((tab) => (
                <Tab key={tab.value} value={tab.value} label={tab.label} />
              ))}
            </Tabs>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: { xs: 2, md: 3 }, py: 2 }}>
            {selectedTab === 'basic' ? (
              <BasicInfoPanel factory={factory} />
            ) : selectedTab === 'points' ? (
              <DetailDataGrid title="จุดตรวจวัด" rows={monitoringPointRows} columns={monitoringPointColumns} />
            ) : (
              <DetailDataGrid title="รายการคำขอทั้งหมด" rows={requestRows} columns={requestColumns} />
            )}
          </Box>
        </Box>
      ) : null}
    </Dialog>
  )
}

function MasterDataPage({ userType = '' }) {
  const [selectedFactory, setSelectedFactory] = useState(null)
  const rows = useMemo(() => mapFactoryRows(mockOperatorFactoryRows), [])
  const columns = useMemo(() => getFactoryColumns(setSelectedFactory), [])

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
                ข้อมูลพื้นฐาน
              </Typography>
              <Typography variant="body2" color="text.secondary">
                โรงงานที่มีอยู่ในระบบ POMS
              </Typography>
            </Box>
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
            rows={rows}
            columns={columns}
            disableRowSelectionOnClick
            showToolbar
            showCellVerticalBorder
            showColumnVerticalBorder
            label="โรงงานที่มีอยู่ในระบบ POMS"
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
        userType={userType}
        onClose={() => setSelectedFactory(null)}
      />
    </>
  )
}

export default MasterDataPage
