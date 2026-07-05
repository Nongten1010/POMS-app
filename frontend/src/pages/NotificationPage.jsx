import { useCallback, useEffect, useMemo, useState } from 'react'
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

const alertEventsApiBaseUrl = import.meta.env.DEV
  ? '/api-proxy/v1/alert-events'
  : 'https://d-poms.diw.go.th/api/v1/alert-events'

const notificationGroups = [
  {
    value: 'cems',
    label: 'CEMS',
    menus: [
      {
        value: 'cems-standard-exceeded',
        label: 'ผลการตรวจวัด CEMS เกินมาตรฐาน',
        columnSet: 'measurement-exceeded',
        query: { systemType: 'CEMS', alertType: 'STANDARD_EXCEEDED', thresholdType: 'STANDARD' },
      },
      {
        value: 'cems-eia-exceeded',
        label: 'ผลการตรวจวัด CEMS เกินค่า EIA กำหนด',
        columnSet: 'measurement-exceeded',
        query: { systemType: 'CEMS', alertType: 'EIA_EXCEEDED', thresholdType: 'EIA' },
      },
      {
        value: 'cems-daily-report-less-than-80',
        label: 'รายงานผล CEMS ไม่ถึงร้อยละ 80 ต่อวัน',
        columnSet: 'daily-report-less-than-80',
        query: { systemType: 'CEMS', alertType: 'DAILY_COMPLETENESS_LOW' },
      },
      {
        value: 'cems-missing-more-than-14-days',
        label: 'ไม่รายงานผล CEMS ติดต่อกันเกิน 14 วัน',
        columnSet: 'consecutive-missing-report',
        query: { systemType: 'CEMS', alertType: 'CONSECUTIVE_NO_REPORT' },
      },
      {
        value: 'cems-abnormal-value',
        label: 'รายงานผลตรวจวัด CEMS มีค่าผิดปกติ (ค่านิ่ง/ ค่า 0/ค่าติดลบ)',
        tabLabelLines: ['รายงานผลตรวจวัด CEMS', 'มีค่าผิดปกติ (ค่านิ่ง/ ค่า 0/ค่าติดลบ)'],
        columnSet: 'abnormal-measurement',
        query: { systemType: 'CEMS', alertType: 'ABNORMAL_VALUE' },
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
        query: { systemType: 'WPMS', displaySystemType: 'BOD_COD_ONLINE', alertType: 'STANDARD_EXCEEDED', thresholdType: 'STANDARD' },
      },
      {
        value: 'bod-cod-eia-exceeded',
        label: 'ผลการตรวจวัด BOD/COD Online เกินค่า EIA กำหนด',
        tabLabelLines: ['ผลการตรวจวัด BOD/COD Online', 'เกินค่า EIA กำหนด'],
        columnSet: 'measurement-exceeded',
        query: { systemType: 'WPMS', displaySystemType: 'BOD_COD_ONLINE', alertType: 'EIA_EXCEEDED', thresholdType: 'EIA' },
      },
      {
        value: 'bod-cod-daily-report-less-than-80',
        label: 'รายงานผล BOD/COD Online ไม่ถึงร้อยละ 80 ต่อวัน',
        tabLabelLines: ['รายงานผล BOD/COD Online', 'ไม่ถึงร้อยละ 80 ต่อวัน'],
        columnSet: 'daily-report-less-than-80',
        query: { systemType: 'WPMS', displaySystemType: 'BOD_COD_ONLINE', alertType: 'DAILY_COMPLETENESS_LOW' },
      },
      {
        value: 'bod-cod-missing-more-than-7-days',
        label: 'ไม่รายงานผล BOD/COD Online ติดต่อกันเกิน 7 วัน',
        tabLabelLines: ['ไม่รายงานผล BOD/COD Online', 'ติดต่อกันเกิน 7 วัน'],
        columnSet: 'consecutive-missing-report',
        query: { systemType: 'WPMS', displaySystemType: 'BOD_COD_ONLINE', alertType: 'CONSECUTIVE_NO_REPORT' },
      },
      {
        value: 'bod-cod-abnormal-value',
        label: 'รายงานผลตรวจวัด BOD/COD Online มีค่าผิดปกติ (ค่านิ่ง/ ค่า 0/ค่าติดลบ)',
        tabLabelLines: [
          'รายงานผลตรวจวัด BOD/COD Online',
          'มีค่าผิดปกติ (ค่านิ่ง/ ค่า 0/ค่าติดลบ)',
        ],
        columnSet: 'abnormal-measurement',
        query: { systemType: 'WPMS', displaySystemType: 'BOD_COD_ONLINE', alertType: 'ABNORMAL_VALUE' },
      },
    ],
  },
]

async function readAlertEventsApiResponse(result) {
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
      `โหลดข้อมูลการแจ้งเตือนไม่สำเร็จ (${result.status} ${result.statusText})`
    throw new Error(message)
  }

  return response
}

function formatAlertNumber(value, suffix = '') {
  if (value === null || value === undefined || value === '') return ''

  return `${value}${suffix}`
}

function getMonitoringPointLabel(row = {}) {
  const code = row.pointCode ?? row.stationId ?? ''
  const name = row.pointName ?? ''

  return [code, name].filter(Boolean).join(' - ')
}

function mapAlertEventRow(row = {}, index = 0) {
  return {
    ...row,
    id: row.id ?? `alert-event-${index + 1}`,
    order: index + 1,
    factoryName: row.factoryName ?? '',
    factoryRegistrationNo: row.factoryRegistrationNo ?? '',
    date: row.eventDateText ?? row.eventDate ?? row.alertDateText ?? '',
    detectedAt: row.detectedAt ?? row.createdAt ?? '',
    time: row.timeRange ?? '',
    monitoringPoint: getMonitoringPointLabel(row),
    parameter: row.parameterLabel ?? row.parameterName ?? row.parameterCode ?? '',
    standardValue: formatAlertNumber(row.thresholdValue),
    measuredValue: formatAlertNumber(row.measuredValue),
    unit: row.unit ?? '',
    submissionPercent: row.completenessPercentText ?? formatAlertNumber(row.completenessPercent),
    fromDate: row.dateFromText ?? row.dateFrom ?? row.startedAt ?? '',
    toDate: row.dateToText ?? row.dateTo ?? row.endedAt ?? '',
    totalDays: row.consecutiveDays ?? '',
    abnormality: row.abnormalLabel ?? row.abnormalType ?? '',
    notificationStatus: row.notificationStatusLabel ?? row.notificationStatus ?? '',
  }
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
  const [notificationRows, setNotificationRows] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
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
  const buildAlertEventsUrl = useCallback((menuConfig) => {
    const query = new URLSearchParams()

    Object.entries(menuConfig.query ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, value)
      }
    })
    query.set('page', '1')
    query.set('pageSize', '100')

    return `${alertEventsApiBaseUrl}?${query.toString()}`
  }, [])

  useEffect(() => {
    if (!accessToken) {
      return
    }

    const controller = new AbortController()
    const loadAlertEvents = async () => {
      setIsLoading(true)
      setLoadError('')

      try {
        const result = await fetch(buildAlertEventsUrl(activeMenuConfig), {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        const response = await readAlertEventsApiResponse(result)
        const rows = Array.isArray(response?.data) ? response.data : []

        setNotificationRows(rows.map(mapAlertEventRow))
      } catch (error) {
        if (error.name !== 'AbortError') {
          setNotificationRows([])
          setLoadError(error instanceof Error ? error.message : 'โหลดข้อมูลการแจ้งเตือนไม่สำเร็จ')
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadAlertEvents()

    return () => controller.abort()
  }, [accessToken, activeMenuConfig, buildAlertEventsUrl])

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
      {accessToken && loadError ? <Alert severity="error">{loadError}</Alert> : null}

      <NotificationTable
        title={activeMenuConfig.label}
        groupLabel={activeGroupConfig.label}
        rows={accessToken ? notificationRows : []}
        columns={activeColumns}
        loading={Boolean(accessToken) && isLoading}
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

function NotificationTable({ title, groupLabel, rows, columns, loading = false }) {
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
          loading={loading}
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
