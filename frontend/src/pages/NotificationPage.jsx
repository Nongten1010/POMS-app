import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Chip,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import { DataGrid } from '@mui/x-data-grid'

const notificationGroups = [
  {
    value: 'cems',
    label: 'CEMS',
    menus: [
      {
        value: 'cems-standard-exceeded',
        label: 'ผลการตรวจวัด CEMS เกินมาตรฐาน',
        columnSet: 'measurement-exceeded',
      },
      {
        value: 'cems-eia-exceeded',
        label: 'ผลการตรวจวัด CEMS เกินค่า EIA กำหนด',
        columnSet: 'measurement-exceeded',
      },
      {
        value: 'cems-daily-report-less-than-80',
        label: 'รายงานผล CEMS ไม่ถึงร้อยละ 80 ต่อวัน',
        columnSet: 'daily-report-less-than-80',
      },
      {
        value: 'cems-missing-more-than-14-days',
        label: 'ไม่รายงานผล CEMS ติดต่อกันเกิน 14 วัน',
        columnSet: 'consecutive-missing-report',
      },
      {
        value: 'cems-abnormal-value',
        label: 'รายงานผลตรวจวัด CEMS มีค่าผิดปกติ (ค่านิ่ง/ ค่า 0/ค่าติดลบ)',
        tabLabelLines: ['รายงานผลตรวจวัด CEMS', 'มีค่าผิดปกติ (ค่านิ่ง/ ค่า 0/ค่าติดลบ)'],
        columnSet: 'abnormal-measurement',
      },
    ],
  },
  {
    value: 'bod-cod-online',
    label: 'BOD/COD Online',
    menus: [
      {
        value: 'bod-cod-standard-exceeded',
        label: 'ผลการตรวจวัด BOD/COD Online เกินมาตรฐาน',
        tabLabelLines: ['ผลการตรวจวัด BOD/COD Online', 'เกินมาตรฐาน'],
        columnSet: 'measurement-exceeded',
      },
      {
        value: 'bod-cod-eia-exceeded',
        label: 'ผลการตรวจวัด BOD/COD Online เกินค่า EIA กำหนด',
        tabLabelLines: ['ผลการตรวจวัด BOD/COD Online', 'เกินค่า EIA กำหนด'],
        columnSet: 'measurement-exceeded',
      },
      {
        value: 'bod-cod-daily-report-less-than-80',
        label: 'รายงานผล BOD/COD Online ไม่ถึงร้อยละ 80 ต่อวัน',
        tabLabelLines: ['รายงานผล BOD/COD Online', 'ไม่ถึงร้อยละ 80 ต่อวัน'],
        columnSet: 'daily-report-less-than-80',
      },
      {
        value: 'bod-cod-missing-more-than-7-days',
        label: 'ไม่รายงานผล BOD/COD Online ติดต่อกันเกิน 7 วัน',
        tabLabelLines: ['ไม่รายงานผล BOD/COD Online', 'ติดต่อกันเกิน 7 วัน'],
        columnSet: 'consecutive-missing-report',
      },
      {
        value: 'bod-cod-abnormal-value',
        label: 'รายงานผลตรวจวัด BOD/COD Online มีค่าผิดปกติ (ค่านิ่ง/ ค่า 0/ค่าติดลบ)',
        tabLabelLines: [
          'รายงานผลตรวจวัด BOD/COD Online',
          'มีค่าผิดปกติ (ค่านิ่ง/ ค่า 0/ค่าติดลบ)',
        ],
        columnSet: 'abnormal-measurement',
      },
    ],
  },
]

const commonFactories = [
  {
    factoryName: 'บริษัท พรีเมี่ยม อิควิปเม้นท์ แอนด์ เอ็นจิเนียริ่ง จำกัด',
    factoryRegistrationNo: '82010400125514',
    monitoringPoint: 'S0001 - STACK-A',
  },
  {
    factoryName: 'บริษัท เอวาเวลล์ โฮมโพรดักส์ จำกัด',
    factoryRegistrationNo: '82010000125609',
    monitoringPoint: 'S0002 - STACK-B',
  },
  {
    factoryName: 'บริษัท อินทรี อีโคไซเคิล จำกัด',
    factoryRegistrationNo: '72080000125562',
    monitoringPoint: 'P0001 - WW-01',
  },
]

function makeMeasurementExceededRows(prefix, parameter, unit, standardValue, measuredValues) {
  return commonFactories.map((factory, index) => ({
    id: `${prefix}-${index + 1}`,
    ...factory,
    date: '15/06/2569',
    time: `${String(8 + index).padStart(2, '0')}:00`,
    parameter,
    standardValue,
    measuredValue: measuredValues[index],
    unit,
    notificationStatus: index === 0 ? 'รอส่งแจ้งเตือน' : index === 1 ? 'ส่งแจ้งเตือนแล้ว' : 'รับทราบแล้ว',
  }))
}

function makeDailyReportRows(prefix, parameter, unit, percents) {
  return commonFactories.map((factory, index) => ({
    id: `${prefix}-${index + 1}`,
    ...factory,
    parameter,
    unit,
    date: '15/06/2569',
    submissionPercent: percents[index],
    notificationStatus: index === 0 ? 'รอส่งแจ้งเตือน' : index === 1 ? 'ส่งแจ้งเตือนแล้ว' : 'อยู่ระหว่างติดตาม',
  }))
}

function makeMissingReportRows(prefix, parameter, unit, totalDays) {
  return commonFactories.map((factory, index) => ({
    id: `${prefix}-${index + 1}`,
    ...factory,
    parameter,
    unit,
    fromDate: '01/06/2569',
    toDate: index === 0 ? '15/06/2569' : index === 1 ? '16/06/2569' : '17/06/2569',
    totalDays: totalDays[index],
    notificationStatus: index === 0 ? 'รอส่งแจ้งเตือน' : index === 1 ? 'ส่งแจ้งเตือนแล้ว' : 'อยู่ระหว่างติดตาม',
  }))
}

function makeAbnormalRows(prefix, parameter, unit, abnormalities) {
  return commonFactories.map((factory, index) => ({
    id: `${prefix}-${index + 1}`,
    ...factory,
    parameter,
    unit,
    date: '15/06/2569',
    time: `${String(10 + index).padStart(2, '0')}:00`,
    abnormality: abnormalities[index],
    notificationStatus: index === 0 ? 'รอส่งแจ้งเตือน' : index === 1 ? 'ส่งแจ้งเตือนแล้ว' : 'รับทราบแล้ว',
  }))
}

const notificationRowsByMenu = {
  'cems-standard-exceeded': makeMeasurementExceededRows('cems-standard', 'NOx', 'ppm', '180', ['195', '202', '190']),
  'cems-eia-exceeded': makeMeasurementExceededRows('cems-eia', 'SO2', 'ppm', '120', ['135', '142', '131']),
  'cems-daily-report-less-than-80': makeDailyReportRows('cems-daily', 'CO', 'ppm', ['72%', '68%', '75%']),
  'cems-missing-more-than-14-days': makeMissingReportRows('cems-missing', 'NOx', 'ppm', ['15', '16', '17']),
  'cems-abnormal-value': makeAbnormalRows('cems-abnormal', 'O2', '%', ['ค่านิ่งต่อเนื่อง', 'ค่า 0 ต่อเนื่อง', 'ค่าติดลบ']),
  'bod-cod-standard-exceeded': makeMeasurementExceededRows('bod-standard', 'COD', 'mg/L', '120', ['138', '145', '132']),
  'bod-cod-eia-exceeded': makeMeasurementExceededRows('bod-eia', 'BOD', 'mg/L', '20', ['28', '31', '25']),
  'bod-cod-daily-report-less-than-80': makeDailyReportRows('bod-daily', 'COD', 'mg/L', ['70%', '76%', '65%']),
  'bod-cod-missing-more-than-7-days': makeMissingReportRows('bod-missing', 'BOD', 'mg/L', ['8', '9', '10']),
  'bod-cod-abnormal-value': makeAbnormalRows('bod-abnormal', 'COD', 'mg/L', ['ค่านิ่งต่อเนื่อง', 'ค่า 0 ต่อเนื่อง', 'ค่าติดลบ']),
}
const defaultNotificationColumns = [
  { field: 'order', headerName: 'ลำดับ', width: 90 },
  { field: 'factoryName', headerName: 'ชื่อโรงงาน', width: 280 },
  { field: 'province', headerName: 'จังหวัด', width: 140 },
  { field: 'detectedAt', headerName: 'วันที่แจ้งเตือน', width: 180 },
]
const measurementExceededColumns = [
  { field: 'factoryName', headerName: 'ชื่อโรงงาน', width: 260 },
  { field: 'factoryRegistrationNo', headerName: 'เลขทะเบียนโรงงาน', width: 180 },
  { field: 'date', headerName: 'วันที่', width: 130 },
  { field: 'time', headerName: 'เวลา', width: 110 },
  { field: 'monitoringPoint', headerName: 'จุดตรวจวัด', width: 180 },
  { field: 'parameter', headerName: 'พารามิเตอร์', width: 160 },
  { field: 'standardValue', headerName: 'ค่ามาตรฐาน', width: 150 },
  { field: 'measuredValue', headerName: 'ผลตรวจวัด', width: 150 },
  { field: 'unit', headerName: 'หน่วย', width: 120 },
  { field: 'notificationStatus', headerName: 'สถานะการแจ้งเตือน', width: 190 },
]
const dailyReportLessThan80Columns = [
  { field: 'factoryName', headerName: 'ชื่อโรงงาน', width: 260 },
  { field: 'factoryRegistrationNo', headerName: 'เลขทะเบียนโรงงาน', width: 180 },
  { field: 'monitoringPoint', headerName: 'จุดตรวจวัด', width: 180 },
  { field: 'parameter', headerName: 'พารามิเตอร์', width: 160 },
  { field: 'unit', headerName: 'หน่วย', width: 120 },
  { field: 'date', headerName: 'วันที่', width: 130 },
  { field: 'submissionPercent', headerName: 'ส่งร้อยละ', width: 130 },
  { field: 'notificationStatus', headerName: 'สถานะการแจ้งเตือน', width: 190 },
]
const consecutiveMissingReportColumns = [
  { field: 'factoryName', headerName: 'ชื่อโรงงาน', width: 260 },
  { field: 'factoryRegistrationNo', headerName: 'เลขทะเบียนโรงงาน', width: 180 },
  { field: 'monitoringPoint', headerName: 'จุดตรวจวัด', width: 180 },
  { field: 'parameter', headerName: 'พารามิเตอร์', width: 160 },
  { field: 'unit', headerName: 'หน่วย', width: 120 },
  { field: 'fromDate', headerName: 'ตั้งแต่วันที่', width: 150 },
  { field: 'toDate', headerName: 'ถึงวันที่', width: 150 },
  { field: 'totalDays', headerName: 'รวม (วัน)', width: 130 },
  { field: 'notificationStatus', headerName: 'สถานะการแจ้งเตือน', width: 190 },
]
const abnormalMeasurementColumns = [
  { field: 'factoryName', headerName: 'ชื่อโรงงาน', width: 260 },
  { field: 'factoryRegistrationNo', headerName: 'เลขทะเบียนโรงงาน', width: 180 },
  { field: 'monitoringPoint', headerName: 'จุดตรวจวัด', width: 180 },
  { field: 'parameter', headerName: 'พารามิเตอร์', width: 160 },
  { field: 'unit', headerName: 'หน่วย', width: 120 },
  { field: 'date', headerName: 'วันที่', width: 130 },
  { field: 'time', headerName: 'เวลา', width: 110 },
  { field: 'abnormality', headerName: 'ความผิดปกติ', width: 180 },
  { field: 'notificationStatus', headerName: 'สถานะการแจ้งเตือน', width: 190 },
]

function NotificationPage({ accessToken = '' }) {
  const [activeGroup, setActiveGroup] = useState(notificationGroups[0].value)
  const activeGroupConfig = useMemo(
    () => notificationGroups.find((group) => group.value === activeGroup) ?? notificationGroups[0],
    [activeGroup],
  )
  const [activeMenuByGroup, setActiveMenuByGroup] = useState(() =>
    notificationGroups.reduce(
      (result, group) => ({
        ...result,
        [group.value]: group.menus[0].value,
      }),
      {},
    ),
  )
  const activeMenu = activeMenuByGroup[activeGroupConfig.value] ?? activeGroupConfig.menus[0].value
  const activeMenuConfig = useMemo(
    () => activeGroupConfig.menus.find((menu) => menu.value === activeMenu) ?? activeGroupConfig.menus[0],
    [activeGroupConfig, activeMenu],
  )
  const activeColumns =
    activeMenuConfig.columnSet === 'measurement-exceeded'
      ? measurementExceededColumns
      : activeMenuConfig.columnSet === 'daily-report-less-than-80'
        ? dailyReportLessThan80Columns
        : activeMenuConfig.columnSet === 'consecutive-missing-report'
          ? consecutiveMissingReportColumns
          : activeMenuConfig.columnSet === 'abnormal-measurement'
            ? abnormalMeasurementColumns
            : defaultNotificationColumns
  const activeRows = notificationRowsByMenu[activeMenuConfig.value] ?? []

  return (
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
      <Paper
        elevation={0}
        sx={{
          px: { xs: 1.5, md: 2 },
          py: 1.5,
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { xs: 'stretch', lg: 'center' } }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h5" component="h1">
              การแจ้งเตือน
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ติดตามรายการแจ้งเตือนค่าเกินมาตรฐานและสถานะการส่งแจ้งเตือน
            </Typography>
          </Box>

          <Tabs
            value={activeGroupConfig.value}
            onChange={(_, value) => setActiveGroup(value)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="ประเภทการแจ้งเตือน"
            sx={{
              flex: '0 0 auto',
              maxWidth: { xs: '100%', lg: 360 },
              minHeight: 42,
              p: 0.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: '#f8fafc',
              '& .MuiTabs-indicator': {
                display: 'none',
              },
              '& .MuiTab-root': {
                minHeight: 32,
                minWidth: 120,
                mx: 0.25,
                px: 2,
                borderRadius: 0.75,
                color: 'text.secondary',
                fontWeight: 600,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  boxShadow: '0 2px 8px rgba(25, 118, 210, 0.24)',
                },
              },
            }}
          >
            {notificationGroups.map((group) => (
              <Tab key={group.value} value={group.value} label={group.label} />
            ))}
          </Tabs>
        </Stack>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: 1,
          border: 1,
          borderColor: 'divider',
          bgcolor: '#f8fafc',
        }}
      >
        <Tabs
          value={activeMenu}
          onChange={(_, value) =>
            setActiveMenuByGroup((current) => ({
              ...current,
              [activeGroupConfig.value]: value,
            }))
          }
          variant="scrollable"
          scrollButtons="auto"
          aria-label={`เมนูย่อย${activeGroupConfig.label}`}
          sx={{
            minHeight: 52,
            '& .MuiTabs-indicator': {
              display: 'none',
            },
            '& .MuiTab-root': {
              minHeight: 52,
              width: 280,
              minWidth: 280,
              maxWidth: 280,
              mr: 1,
              px: 1.5,
              py: 1,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              color: 'text.secondary',
              fontWeight: 600,
              alignItems: 'flex-start',
              textAlign: 'left',
              whiteSpace: 'normal',
              lineHeight: 1.35,
              '&.Mui-selected': {
                borderColor: 'primary.main',
                bgcolor: 'primary.50',
                color: 'primary.dark',
                boxShadow: 'inset 0 0 0 1px currentColor',
              },
            },
          }}
        >
          {activeGroupConfig.menus.map((menu) => (
            <Tab key={menu.value} value={menu.value} label={<TabLabel menu={menu} />} />
          ))}
        </Tabs>
      </Paper>

      {!accessToken ? <Alert severity="warning">กรุณาเข้าสู่ระบบเพื่อดูข้อมูลการแจ้งเตือน</Alert> : null}

      <NotificationTable
        title={activeMenuConfig.label}
        groupLabel={activeGroupConfig.label}
        rows={accessToken ? activeRows : []}
        columns={activeColumns}
      />
    </Stack>
  )
}

function TabLabel({ menu }) {
  if (!menu.tabLabelLines) {
    return menu.label
  }

  return (
    <Box component="span" sx={{ display: 'block' }}>
      {menu.tabLabelLines.map((line) => (
        <Box key={line} component="span" sx={{ display: 'block' }}>
          {line}
        </Box>
      ))}
    </Box>
  )
}

function NotificationTable({ title, groupLabel, rows, columns }) {
  return (
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
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          px: { xs: 1.5, md: 2 },
          py: 1.25,
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <NotificationsActiveIcon color="primary" />
        <Typography variant="h6" component="h2" sx={{ flex: 1 }}>
          {title}
        </Typography>
        <Chip label={groupLabel} size="small" color="primary" variant="outlined" />
        <Chip label={`${rows.length.toLocaleString('th-TH')} รายการ`} size="small" variant="outlined" />
      </Stack>
      <Box sx={{ height: 'calc(100% - 58px)', minHeight: 360 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          disableRowSelectionOnClick
          showToolbar
          showCellVerticalBorder
          showColumnVerticalBorder
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize: 25 },
            },
          }}
          localeText={{
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
            '& .MuiDataGrid-row--lastVisible .MuiDataGrid-cell': {
              borderBottom: 1,
              borderColor: 'divider',
            },
            '& .MuiDataGrid-toolbarLabel': {
              fontWeight: 600,
            },
          }}
        />
      </Box>
    </Paper>
  )
}

export default NotificationPage
