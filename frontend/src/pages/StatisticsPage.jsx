import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Badge,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Popover,
  Select,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material'
import QueryStatsIcon from '@mui/icons-material/QueryStats'
import TableChartIcon from '@mui/icons-material/TableChart'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import FilterListIcon from '@mui/icons-material/FilterList'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import { BarChart } from '@mui/x-charts/BarChart'
import {
  DataGrid,
  FilterPanelTrigger,
  GridToolbarQuickFilter,
  Toolbar,
  ToolbarButton,
  useGridApiContext,
} from '@mui/x-data-grid'

const statisticGroups = [
  {
    value: 'cems',
    label: 'CEMS',
    reports: [
      { value: 'cems-installation', label: 'สรุปข้อมูลการติดตั้ง CEMS', template: 'installation' },
      {
        value: 'cems-report-80',
        label: 'สรุปผลการรายงาน CEMS ตั้งแต่ร้อยละ 80 ต่อวันขึ้นไป (ไม่นับ Shutdown)',
        template: 'parameter',
      },
      { value: 'cems-standard-exceeded', label: 'สรุปผลการตรวจวัด CEMS เกินมาตรฐาน', template: 'parameter' },
      { value: 'cems-eia-exceeded', label: 'สรุปผลการตรวจวัด CEMS เกินค่า EIA', template: 'parameter' },
      {
        value: 'cems-missing-14-days',
        label: 'สรุปผลการไม่รายงาน CEMS ติดต่อกันเกิน 14 วัน (ไม่นับ Shutdown)',
        template: 'parameter',
      },
      {
        value: 'cems-report-low-80',
        label: 'สรุปผลการรายงาน CEMS ไม่ถึงร้อยละ 80 ต่อวัน (ไม่นับ Shutdown)',
        template: 'parameter',
      },
      {
        value: 'cems-shutdown',
        label: 'สรุปจำนวนโรงงานที่หยุดส่งข้อมูลเนื่องจากหยุดหน่วยการผลิต (Shutdown)',
        template: 'parameter',
      },
      {
        value: 'cems-abnormal',
        label: 'สรุปผลการรายงานผลตรวจวัด CEMS มีค่าผิดปกติ (ค่านิ่ง/ ค่า 0/ค่าติดลบ)',
        template: 'parameter',
      },
      { value: 'cems-exempt', label: 'สรุปข้อมูลโรงงานที่ได้รับการยกเว้นการติดตั้ง CEMS', template: 'installation' },
      {
        value: 'cems-form-01',
        label: 'สรุปข้อมูลการแจ้งแบบ กวภ. 01 (แจ้งหยุดส่งข้อมูล / หยุดหน่วยการผลิต (Shutdown)',
        template: 'parameter',
      },
      {
        value: 'cems-form-02',
        label: 'สรุปข้อมูลการแจ้งแบบ กวภ. 02 (รายงานผลการตรวจวัดกรณีหยุดส่งข้อมูลเกิน 14 วัน)',
        template: 'parameter',
      },
      {
        value: 'cems-form-04',
        label: 'สรุปข้อมูลการแจ้งแบบ กวภ. 04 (รายงานผลการตรวจวัดกรณีได้รับการยกเว้นการติดตั้ง CEMS)',
        template: 'parameter',
      },
      {
        value: 'cems-form-05',
        label: 'สรุปข้อมูลการแจ้งแบบ กวภ. 05 (รายงานผลการทวนสอบ/สอบเทียบ CEMS)',
        template: 'parameter',
      },
    ],
  },
  {
    value: 'bod-cod-online',
    label: 'BOD/COD Online',
    reports: [
      { value: 'wpms-installation', label: 'สรุปข้อมูลการติดตั้ง', template: 'installation' },
      {
        value: 'wpms-report-80',
        label: 'สรุปผลการรายงาน BOD/COD Online ตั้งแต่ร้อยละ 80 ต่อวันขึ้นไป (ไม่นับไม่ระบายน้ำทิ้งออกนอกโรงงาน)',
        template: 'parameter',
      },
      {
        value: 'wpms-standard-exceeded',
        label: 'สรุปผลการตรวจวัด BOD/COD Online เกินมาตรฐาน',
        template: 'parameter',
      },
      { value: 'wpms-eia-exceeded', label: 'สรุปผลการตรวจวัด BOD/COD Online เกินค่า EIA', template: 'parameter' },
      {
        value: 'wpms-missing-7-days',
        label: 'สรุปผลการไม่รายงาน WPMS ติดต่อกันเกิน 7 วัน (ไม่นับไม่ระบายน้ำทิ้งออกนอกโรงงาน)',
        template: 'parameter',
      },
      {
        value: 'wpms-report-low-80',
        label: 'สรุปผลรายงาน WPMS ไม่ถึงร้อยละ 80 ต่อวัน (ไม่นับไม่ระบายน้ำทิ้งออกนอกโรงงาน)',
        template: 'parameter',
      },
      {
        value: 'wpms-abnormal',
        label: 'สรุปผลการรายงานผลตรวจวัด BOD/COD Online มีค่าผิดปกติ (ค่านิ่ง/ ค่า 0/ค่าติดลบ)',
        template: 'parameter',
      },
      {
        value: 'wpms-shutdown',
        label: 'สรุปข้อมูลโรงงานที่ไม่มีการระบายน้ำทิ้งออกนอกโรงงาน (Shutdown)',
        template: 'parameter',
      },
      {
        value: 'wpms-error-check',
        label: 'สรุปข้อมูลการรายการตรวจสอบค่าความคลาดเคลื่อน BOD/COD Online',
        template: 'parameter',
      },
      {
        value: 'wpms-form-03',
        label: 'สรุปข้อมูลการแจ้งแบบ กวภ. 03 (แจ้งหยุดส่งข้อมูล / ไม่มีการระบายน้ำทิ้งออกนอกโรงงาน)',
        template: 'parameter',
      },
    ],
  },
]

const summaryViews = [
  { value: 'region', label: 'ภูมิภาค', gridLabel: 'แยกตามภูมิภาค' },
  { value: 'province', label: 'จังหวัด', gridLabel: 'แยกรายจังหวัด' },
  { value: 'factoryType', label: 'ประเภทโรงงาน', gridLabel: 'แยกตามลำดับประเภทโรงงาน' },
  { value: 'fuel', label: 'ชนิดเชื้อเพลิง', gridLabel: 'แยกตามชนิดเชื้อเพลิง' },
  { value: 'attachment', label: 'บัญชีแนบท้าย', gridLabel: 'แยกตามบัญชีแนบท้ายที่เข้าข่าย' },
  { value: 'parameter', label: 'พารามิเตอร์ที่ติดตั้ง', gridLabel: 'แยกตามพารามิเตอร์ที่ติดตั้ง' },
]

const parameterNames = ['Particulate', 'SO2', 'NOx', 'CO', 'HCl', 'Hg', 'Opacity', 'H2S']

const rowsByView = {
  region: ['ทั่วประเทศ', 'ภาคกลาง', 'ภาคเหนือ', 'ภาคใต้', 'ภาคตะวันออก', 'ภาคตะวันตก', 'ภาคตะวันออกเฉียงเหนือ'],
  province: ['ระยอง', 'ชลบุรี', 'สมุทรปราการ', 'ฉะเชิงเทรา', 'พระนครศรีอยุธยา', 'ปทุมธานี'],
  factoryType: ['ลำดับที่ 88', 'ลำดับที่ 89', 'ลำดับที่ 101', 'ลำดับที่ 105', 'ลำดับที่ 106'],
  fuel: ['ก๊าซธรรมชาติ', 'ถ่านหิน', 'ชีวมวล', 'น้ำมันเตา', 'เชื้อเพลิงผสม'],
  attachment: ['บัญชีแนบท้าย 1', 'บัญชีแนบท้าย 2', 'บัญชีแนบท้าย 3', 'เข้าข่ายมากกว่า 1 บัญชี'],
  parameter: parameterNames,
}

const installationRows = [
  { id: '1', no: '1', item: 'จำนวนโรงงานที่คาดว่าจะเข้าข่ายทั้งหมด', type: 'main', values: [117, 119, 89, 91, 18, 18, 10, 10] },
  {
    id: '2',
    no: '2',
    item: 'จำนวนโรงงานที่มีการเชื่อมต่อแล้ว (ทั้งครบถ้วนและไม่ครบถ้วน)',
    type: 'main',
    values: [96, 101, 72, 78, 15, 15, 9, 8],
  },
  { id: '3', no: '3', item: 'ดำเนินการเป็นไปตามกฎหมาย', type: 'main', values: [82, 86, 62, 66, 13, 13, 7, 7] },
  { id: '3.1', no: '3.1', item: 'ยังไม่แจ้งประกอบกิจการ', type: 'sub', values: [5, 5, 3, 3, 1, 1, 1, 1] },
  { id: '3.2', no: '3.2', item: 'แจ้งหยุดชั่วคราว', type: 'sub', values: [6, 6, 4, 4, 1, 1, 1, 1] },
  { id: '3.3', no: '3.3', item: 'ติดตั้งและเชื่อมต่อครบถ้วน', type: 'sub', values: [71, 75, 55, 59, 11, 11, 5, 5] },
  {
    id: '3.4',
    no: '3.4',
    item: 'ยกเว้นหรือแจ้งไม่ใช้บังคับ ตามประกาศข้อ 4(1) (2) และ 11(3) ทั้งโรงงาน',
    type: 'sub',
    values: [9, 9, 6, 6, 2, 2, 1, 1],
  },
  { id: '4', no: '4', item: 'ดำเนินการที่ไม่เป็นไปตามกฎหมาย', type: 'alert', values: [18, 18, 14, 14, 3, 3, 1, 1] },
  {
    id: '4.1',
    no: '4.1',
    item: 'อยู่ระหว่างเชื่อมต่อ (ยังไม่ Online ในระบบ POMS)',
    type: 'sub',
    values: [8, 8, 6, 6, 1, 1, 1, 1],
  },
  {
    id: '4.2',
    no: '4.2',
    item: 'โรงงานที่ยังไม่ได้ดำเนินการ (รอจังหวัดตรวจสอบ)',
    type: 'sub',
    values: [5, 5, 4, 4, 1, 1, 0, 0],
  },
  { id: '4.3', no: '4.3', item: 'ติดตั้งแล้วแต่ยังไม่ครบถ้วน', type: 'sub', values: [3, 3, 2, 2, 1, 1, 0, 0] },
  {
    id: '4.4',
    no: '4.4',
    item: 'ยกเว้นหรือแจ้งไม่ใช้บังคับบางรายการ / รายการที่เหลือยังไม่ติดตั้ง',
    type: 'sub',
    values: [2, 2, 2, 2, 0, 0, 0, 0],
  },
  {
    id: '5',
    no: '5',
    item: 'อยู่ระหว่างขอขยายระยะเวลาดำเนินการ',
    type: 'main',
    values: [11, 11, 8, 8, 2, 2, 1, 1],
  },
  {
    id: '5.1',
    no: '5.1',
    item: 'ติดตั้งแล้วแต่ยังไม่ครบถ้วน / อยู่ระหว่างขยายเวลาติดตั้ง',
    type: 'sub',
    values: [7, 7, 5, 5, 1, 1, 1, 1],
  },
  {
    id: '5.2',
    no: '5.2',
    item: 'ยกเว้นหรือแจ้งไม่ใช้บังคับบางรายการ / รายการที่เหลืออยู่ระหว่างขยายเวลาติดตั้ง',
    type: 'sub',
    values: [4, 4, 3, 3, 1, 1, 0, 0],
  },
]

const detailRows = [
  {
    id: 1,
    factoryName: 'บริษัท ตัวอย่างอุตสาหกรรม จำกัด',
    registrationNo: '3-88-12/45รย',
    province: 'ระยอง',
    monitoringPoint: 'ปล่อง Boiler 1',
    date: '16/06/2569',
    status: 'เข้าเงื่อนไขรายงาน',
  },
  {
    id: 2,
    factoryName: 'บริษัท โรงงานสาธิต จำกัด',
    registrationNo: '3-77-09/31ชบ',
    province: 'ชลบุรี',
    monitoringPoint: 'ปล่อง Furnace A',
    date: '16/06/2569',
    status: 'เข้าเงื่อนไขรายงาน',
  },
  {
    id: 3,
    factoryName: 'บริษัท พลังงานตัวอย่าง จำกัด',
    registrationNo: '3-55-18/22สป',
    province: 'สมุทรปราการ',
    monitoringPoint: 'ปล่อง Main Stack',
    date: '15/06/2569',
    status: 'รอตรวจสอบ',
  },
]

const detailColumns = [
  { field: 'factoryName', headerName: 'โรงงาน', width: 260 },
  { field: 'registrationNo', headerName: 'เลขทะเบียนโรงงาน', width: 170 },
  { field: 'province', headerName: 'จังหวัด', width: 130 },
  { field: 'monitoringPoint', headerName: 'จุดตรวจวัด', width: 170 },
  { field: 'date', headerName: 'วันที่', width: 130 },
  { field: 'status', headerName: 'สถานะ', width: 180 },
]

const baseGridLocaleText = {
  toolbarColumns: 'คอลัมน์',
  toolbarFilters: 'ตัวกรอง',
  toolbarDensity: 'ความหนาแน่น',
  toolbarExport: 'ส่งออก',
  toolbarExportCSV: 'ดาวน์โหลด CSV',
  toolbarExportPrint: 'พิมพ์',
  toolbarQuickFilterPlaceholder: 'ค้นหา...',
  toolbarQuickFilterLabel: 'ค้นหา',
  toolbarQuickFilterDeleteIconLabel: 'ล้างคำค้นหา',
  columnsManagementSearchTitle: 'ค้นหาคอลัมน์',
  columnsManagementShowHideAllText: 'แสดง/ซ่อนทั้งหมด',
  columnsManagementReset: 'คืนค่า',
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

function StatisticsPage() {
  const [activeGroup, setActiveGroup] = useState(statisticGroups[0].value)
  const [activeView, setActiveView] = useState(summaryViews[0].value)
  const [summaryDisplayMode, setSummaryDisplayMode] = useState('table')
  const [selectedChartRowId, setSelectedChartRowId] = useState('')
  const [detailContext, setDetailContext] = useState(null)
  const [activeReportByGroup, setActiveReportByGroup] = useState(() =>
    statisticGroups.reduce(
      (result, group) => ({
        ...result,
        [group.value]: group.reports[0].value,
      }),
      {},
    ),
  )
  const activeGroupConfig = useMemo(
    () => statisticGroups.find((group) => group.value === activeGroup) ?? statisticGroups[0],
    [activeGroup],
  )
  const activeReportValue = activeReportByGroup[activeGroupConfig.value] ?? activeGroupConfig.reports[0].value
  const activeReport = useMemo(
    () => activeGroupConfig.reports.find((report) => report.value === activeReportValue) ?? activeGroupConfig.reports[0],
    [activeGroupConfig, activeReportValue],
  )
  const activeViewConfig = summaryViews.find((view) => view.value === activeView) ?? summaryViews[0]
  const summaryRows = useMemo(() => getSummaryRows(activeReport, activeView), [activeReport, activeView])
  const activeChartRowId = summaryRows.some((row) => row.id === selectedChartRowId)
    ? selectedChartRowId
    : summaryRows[0]?.id ?? ''

  const openDetail = (context) => setDetailContext(context)

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
              สถิติข้อมูล
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ตารางสรุปผลข้อมูล CEMS และ BOD/COD Online
            </Typography>
          </Box>

          <Tabs
            value={activeGroupConfig.value}
            onChange={(_, value) => setActiveGroup(value)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="ประเภทชุดข้อมูล"
            sx={{
              flex: '0 0 auto',
              maxWidth: { xs: '100%', lg: 390 },
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
                minWidth: 128,
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
            {statisticGroups.map((group) => (
              <Tab key={group.value} value={group.value} label={group.label} />
            ))}
          </Tabs>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '330px minmax(0, 1fr)' },
          gap: 2,
          flex: 1,
          minHeight: 0,
        }}
      >
        <ReportList
          reports={activeGroupConfig.reports}
          activeReportValue={activeReport.value}
          onSelectReport={(reportValue) =>
            setActiveReportByGroup((current) => ({
              ...current,
              [activeGroupConfig.value]: reportValue,
            }))
          }
        />

        <Stack spacing={2} sx={{ minWidth: 0, minHeight: 0 }}>
          <Paper elevation={0} sx={{ p: 1.5, border: 1, borderColor: 'divider' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                แสดงผลแยกตาม:
              </Typography>
              {summaryViews.map((view) => (
                <Button
                  key={view.value}
                  variant={activeView === view.value ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setActiveView(view.value)}
                  sx={{ borderRadius: 999, px: 1.75 }}
                >
                  {view.label}
                </Button>
              ))}
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
              <TableChartIcon color="primary" />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="h6" component="h2" sx={{ lineHeight: 1.3 }}>
                  {activeReport.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  มุมมอง: {activeViewConfig.gridLabel}
                </Typography>
              </Box>
              <Tabs
                value={summaryDisplayMode}
                onChange={(_, value) => setSummaryDisplayMode(value)}
                aria-label="รูปแบบการแสดงผลสถิติ"
                sx={{
                  flex: '0 0 auto',
                  minHeight: 32,
                  p: 0.35,
                  border: 1,
                  borderColor: 'primary.light',
                  borderRadius: 999,
                  '& .MuiTabs-indicator': { display: 'none' },
                  '& .MuiTab-root': {
                    minHeight: 26,
                    minWidth: 64,
                    px: 1.5,
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'primary.main',
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                    },
                  },
                }}
              >
                <Tab value="table" label="ตาราง" />
                <Tab value="chart" label="กราฟ" />
              </Tabs>
            </Stack>

            <Box sx={{ height: 'calc(100% - 67px)', minHeight: 420 }}>
              {summaryDisplayMode === 'chart' ? (
                <SummaryBarChartSection
                  report={activeReport}
                  view={activeView}
                  rows={summaryRows}
                  selectedRowId={activeChartRowId}
                  onSelectedRowChange={setSelectedChartRowId}
                />
              ) : activeReport.template === 'installation' ? (
                <InstallationSummaryGrid report={activeReport} onOpenDetail={openDetail} />
              ) : (
                <ParameterSummaryGrid report={activeReport} view={activeView} onOpenDetail={openDetail} />
              )}
            </Box>
          </Paper>
        </Stack>
      </Box>

      <DetailDialog context={detailContext} onClose={() => setDetailContext(null)} />
    </Stack>
  )
}

function ReportList({ reports, activeReportValue, onSelectReport }) {
  return (
    <Paper
      elevation={0}
      sx={{
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        border: 1,
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 1.75, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <QueryStatsIcon color="primary" />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          เมนูรายงาน
        </Typography>
      </Stack>
      <List sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 1 }}>
        {reports.map((report) => (
          <ListItemButton
            key={report.value}
            selected={report.value === activeReportValue}
            onClick={() => onSelectReport(report.value)}
            sx={{
              alignItems: 'flex-start',
              border: 1,
              borderColor: report.value === activeReportValue ? 'primary.light' : 'transparent',
              borderRadius: 1,
              mb: 0.5,
              px: 1.25,
              py: 1,
              '&.Mui-selected': {
                bgcolor: 'primary.50',
                color: 'primary.dark',
                '&:hover': {
                  bgcolor: 'primary.100',
                },
              },
            }}
          >
            <ListItemText
              primary={report.label}
              slotProps={{
                primary: {
                  variant: 'body2',
                  fontWeight: report.value === activeReportValue ? 700 : 400,
                  lineHeight: 1.35,
                },
              }}
            />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  )
}

function getSummaryRows(report, view) {
  if (report.template === 'installation') {
    return installationRows.map((row) => ({
      ...row,
      countryFactory: row.values[0],
      countryStack: row.values[1],
      diwFactory: row.values[2],
      diwStack: row.values[3],
      pioFactory: row.values[4],
      pioStack: row.values[5],
      ieatFactory: row.values[6],
      ieatStack: row.values[7],
    }))
  }

  return buildParameterRows(view)
}

function getSummaryRowLabel(row, report, view) {
  if (!row) {
    return ''
  }

  if (report.template === 'installation') {
    return row.item ?? ''
  }

  return row.area ?? (view === 'province' ? 'จังหวัด' : 'พื้นที่/โรงงาน')
}

function getSummaryChartData(row, report) {
  if (!row) {
    return []
  }

  if (report.template === 'installation') {
    return [
      { label: 'ทั่วประเทศ', factory: row.countryFactory, stack: row.countryStack },
      { label: 'กรอ.', factory: row.diwFactory, stack: row.diwStack },
      { label: 'สอจ.', factory: row.pioFactory, stack: row.pioStack },
      { label: 'กนอ.', factory: row.ieatFactory, stack: row.ieatStack },
    ].map((item) => ({
      ...item,
      factory: Number(item.factory) || 0,
      stack: Number(item.stack) || 0,
    }))
  }

  return [
    { label: 'ทุกพารามิเตอร์', outside: row.allOutside, inside: row.allInside },
    ...parameterNames.map((parameter) => ({
      label: parameter,
      outside: row[`${parameter}Outside`],
      inside: row[`${parameter}Inside`],
    })),
  ].map((item) => ({
    ...item,
    outside: Number(item.outside) || 0,
    inside: Number(item.inside) || 0,
  }))
}

function SummaryBarChartSection({ report, view, rows, selectedRowId, onSelectedRowChange }) {
  const selectedRow = rows.find((row) => row.id === selectedRowId) ?? rows[0]
  const chartData = getSummaryChartData(selectedRow, report)
  const dropdownLabel = report.template === 'installation' ? 'รายการ' : view === 'province' ? 'จังหวัด' : 'พื้นที่/โรงงาน'
  const chartSeries =
    report.template === 'installation'
      ? [
          { dataKey: 'factory', label: 'โรงงาน', color: '#2563eb' },
          { dataKey: 'stack', label: 'ปล่อง', color: '#f97316' },
        ]
      : [
          { dataKey: 'outside', label: 'นอกนิคม', color: '#2563eb' },
          { dataKey: 'inside', label: 'ในนิคม', color: '#f97316' },
        ]

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 1.5, md: 2 },
        gap: 1.5,
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            กราฟสรุปข้อมูล
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {selectedRow ? getSummaryRowLabel(selectedRow, report, view) : 'ไม่มีข้อมูล'}
          </Typography>
        </Box>
        <FormControl size="small" sx={{ width: { xs: '100%', sm: 300 } }}>
          <InputLabel id="summary-chart-row-label">{dropdownLabel}</InputLabel>
          <Select
            labelId="summary-chart-row-label"
            value={selectedRow?.id ?? ''}
            label={dropdownLabel}
            onChange={(event) => onSelectedRowChange(event.target.value)}
          >
            {rows.map((row) => (
              <MenuItem key={row.id} value={row.id}>
                {getSummaryRowLabel(row, report, view)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Box
        sx={{
          flex: '0 0 auto',
          minHeight: 0,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: '#fff',
          overflow: 'hidden',
          p: 1,
        }}
      >
        {chartData.length > 0 ? (
          <Box sx={{ height: 380 }}>
            <BarChart
              dataset={chartData}
              xAxis={[
                {
                  scaleType: 'band',
                  dataKey: 'label',
                  tickLabelInterval: () => true,
                  tickLabelMinGap: 0,
                  valueFormatter: (value) => value,
                  tickLabelStyle: {
                    fontSize: 11,
                    fontWeight: 700,
                    fill: '#64748b',
                  },
                },
              ]}
              yAxis={[{ min: 0, label: 'จำนวนโรงงาน' }]}
              series={chartSeries}
              grid={{ horizontal: true }}
              margin={{ top: 36, right: 24, bottom: 48, left: 56 }}
              height={380}
            />
          </Box>
        ) : (
          <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
            ไม่มีข้อมูลกราฟ
          </Box>
        )}
      </Box>
    </Box>
  )
}

function InstallationSummaryGrid({ report, onOpenDetail }) {
  const columns = useMemo(
    () => [
      {
        field: 'no',
        headerName: 'ลำดับ',
        width: 82,
        align: 'center',
        headerAlign: 'center',
        sortable: false,
        filterable: false,
      },
      {
        field: 'item',
        headerName: 'รายการ',
        width: 560,
        sortable: false,
        renderCell: (params) => (
          <Typography
            variant="body2"
            sx={{
              display: 'flex',
              alignItems: 'center',
              minHeight: '100%',
              pl: params.row.type === 'sub' ? 2 : 0,
              fontWeight: params.row.type === 'sub' ? 400 : 700,
              whiteSpace: 'normal',
              lineHeight: 1.35,
            }}
          >
            {params.value}
          </Typography>
        ),
      },
      ...[
        ['countryFactory', 'ทั่วประเทศ', 'โรงงาน', 0],
        ['countryStack', 'ทั่วประเทศ', 'ปล่อง', 1],
        ['diwFactory', 'กรอ.', 'โรงงาน', 2],
        ['diwStack', 'กรอ.', 'ปล่อง', 3],
        ['pioFactory', 'สอจ.', 'โรงงาน', 4],
        ['pioStack', 'สอจ.', 'ปล่อง', 5],
        ['ieatFactory', 'กนอ.', 'โรงงาน', 6],
        ['ieatStack', 'กนอ.', 'ปล่อง', 7],
      ].map(([field, group, label]) => ({
        field,
        headerName: label,
        width: 104,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params) => renderCountButton(params.value, () => onOpenDetail({ title: report.label, group, label })),
      })),
    ],
    [onOpenDetail, report],
  )
  const rows = useMemo(() => getSummaryRows(report, ''), [report])

  return (
    <SummaryDataGrid
      rows={rows}
      columns={columns}
      columnGroupingModel={[
        { groupId: 'country', headerName: 'ทั่วประเทศ', children: [{ field: 'countryFactory' }, { field: 'countryStack' }] },
        { groupId: 'diw', headerName: 'กรอ.', children: [{ field: 'diwFactory' }, { field: 'diwStack' }] },
        { groupId: 'pio', headerName: 'สอจ.', children: [{ field: 'pioFactory' }, { field: 'pioStack' }] },
        { groupId: 'ieat', headerName: 'กนอ.', children: [{ field: 'ieatFactory' }, { field: 'ieatStack' }] },
      ]}
      columnSelectorGroups={[
        { id: 'country', label: 'ทั่วประเทศ', fields: ['countryFactory', 'countryStack'] },
        { id: 'diw', label: 'กรอ.', fields: ['diwFactory', 'diwStack'] },
        { id: 'pio', label: 'สอจ.', fields: ['pioFactory', 'pioStack'] },
        { id: 'ieat', label: 'กนอ.', fields: ['ieatFactory', 'ieatStack'] },
      ]}
      getRowClassName={(params) =>
        params.row.type === 'alert' ? 'summary-row-alert' : params.row.type === 'main' ? 'summary-row-main' : ''
      }
      freezeLeadingColumns
    />
  )
}

function ParameterSummaryGrid({ report, view, onOpenDetail }) {
  const rows = useMemo(() => buildParameterRows(view), [view])
  const columns = useMemo(
    () => [
      {
        field: 'area',
        headerName: view === 'province' ? 'จังหวัด' : 'พื้นที่/โรงงาน',
        width: 190,
        headerAlign: 'center',
        sortable: false,
        renderCell: (params) => (
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {params.value}
          </Typography>
        ),
      },
      {
        field: 'allOutside',
        headerName: 'นอกนิคมอุตสาหกรรม',
        width: 132,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params) => renderCountButton(params.value, () => onOpenDetail({ title: report.label, group: 'ทุกพารามิเตอร์' })),
      },
      {
        field: 'allInside',
        headerName: 'ในนิคมอุตสาหกรรม',
        width: 132,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params) => renderCountButton(params.value, () => onOpenDetail({ title: report.label, group: 'ทุกพารามิเตอร์' })),
      },
      ...parameterNames.flatMap((parameter) => [
        {
          field: `${parameter}Outside`,
          headerName: 'นอกนิคมอุตสาหกรรม',
          width: 132,
          align: 'center',
          headerAlign: 'center',
          renderCell: (params) => renderCountButton(params.value, () => onOpenDetail({ title: report.label, group: parameter })),
        },
        {
          field: `${parameter}Inside`,
          headerName: 'ในนิคมอุตสาหกรรม',
          width: 132,
          align: 'center',
          headerAlign: 'center',
          renderCell: (params) => renderCountButton(params.value, () => onOpenDetail({ title: report.label, group: parameter })),
        },
      ]),
    ],
    [onOpenDetail, report, view],
  )
  const columnGroupingModel = useMemo(
    () => [
      { groupId: 'allParameters', headerName: 'ทุกพารามิเตอร์ (โรงงาน)', children: [{ field: 'allOutside' }, { field: 'allInside' }] },
      ...parameterNames.map((parameter) => ({
        groupId: parameter,
        headerName: `${parameter} (โรงงาน)`,
        children: [{ field: `${parameter}Outside` }, { field: `${parameter}Inside` }],
      })),
    ],
    [],
  )

  return (
    <SummaryDataGrid
      rows={rows}
      columns={columns}
      columnGroupingModel={columnGroupingModel}
      columnSelectorGroups={[
        { id: 'allParameters', label: 'ทุกพารามิเตอร์', fields: ['allOutside', 'allInside'] },
        ...parameterNames.map((parameter) => ({
          id: parameter,
          label: parameter,
          fields: [`${parameter}Outside`, `${parameter}Inside`],
        })),
      ]}
    />
  )
}

function SummaryDataGrid({ rows, columns, columnGroupingModel, columnSelectorGroups, getRowClassName, freezeLeadingColumns = false }) {
  const [columnVisibilityModel, setColumnVisibilityModel] = useState({})
  const toolbar = useMemo(
    () =>
      function StatisticsGridToolbar(toolbarProps) {
        return (
          <StatisticsToolbar
            {...toolbarProps}
            columnSelectorGroups={columnSelectorGroups}
            columnVisibilityModel={columnVisibilityModel}
            onColumnVisibilityModelChange={setColumnVisibilityModel}
          />
        )
      },
    [columnSelectorGroups, columnVisibilityModel],
  )

  return (
    <Box sx={{ height: '100%', minHeight: 0 }}>
      <DataGrid
        rows={rows}
        columns={columns}
        columnGroupingModel={columnGroupingModel}
        columnVisibilityModel={columnVisibilityModel}
        onColumnVisibilityModelChange={setColumnVisibilityModel}
        disableRowSelectionOnClick
        disableColumnSelector
        disableDensitySelector
        showToolbar
        showCellVerticalBorder
        showColumnVerticalBorder
        pageSizeOptions={[25, 50, 100]}
        initialState={{
          pagination: {
            paginationModel: { page: 0, pageSize: 25 },
          },
        }}
        getRowHeight={() => 'auto'}
        getRowClassName={getRowClassName}
        slots={{
          toolbar,
        }}
        localeText={baseGridLocaleText}
        sx={{
          border: 0,
          '& .MuiDataGrid-columnHeaders': {
            borderTop: 1,
            borderBottom: 1,
            borderColor: 'divider',
          },
          '& .MuiDataGrid-columnHeader': {
            bgcolor: '#eef2f6',
            borderColor: 'divider',
          },
          '& .MuiDataGrid-columnHeader--emptyGroup': {
            bgcolor: '#eef2f6',
          },
          '& .MuiDataGrid-columnHeader--filledGroup': {
            bgcolor: '#d9e0e8',
          },
          '& .MuiDataGrid-columnHeader--filledGroup .MuiDataGrid-columnHeaderTitleContainer': {
            justifyContent: 'center',
            alignItems: 'center',
          },
          '& .MuiDataGrid-columnHeader--filledGroup .MuiDataGrid-columnHeaderTitleContainerContent': {
            justifyContent: 'center',
            width: '100%',
          },
          '& .MuiDataGrid-columnHeader[data-field="no"], & .MuiDataGrid-columnHeader[data-field="item"], & .MuiDataGrid-columnHeader[data-field="area"]':
            {
              height: '112px !important',
              minHeight: '112px !important',
              maxHeight: '112px !important',
              transform: 'translateY(-56px)',
              zIndex: 4,
              borderTop: 1,
              borderColor: 'divider',
            },
          '& .MuiDataGrid-columnHeader[data-field="no"] .MuiDataGrid-columnHeaderDraggableContainer, & .MuiDataGrid-columnHeader[data-field="item"] .MuiDataGrid-columnHeaderDraggableContainer, & .MuiDataGrid-columnHeader[data-field="area"] .MuiDataGrid-columnHeaderDraggableContainer':
            {
              height: '100%',
            },
          '& .MuiDataGrid-columnHeader[data-field="no"] .MuiDataGrid-columnHeaderTitleContainer, & .MuiDataGrid-columnHeader[data-field="item"] .MuiDataGrid-columnHeaderTitleContainer, & .MuiDataGrid-columnHeader[data-field="area"] .MuiDataGrid-columnHeaderTitleContainer':
            {
              height: '100%',
              alignItems: 'center',
            },
          ...(freezeLeadingColumns
            ? {
                '& .MuiDataGrid-columnHeader[data-field="no"], & .MuiDataGrid-cell[data-field="no"]': {
                  position: 'sticky',
                  left: 0,
                  zIndex: 5,
                  bgcolor: 'background.paper',
                },
                '& .MuiDataGrid-columnHeader[data-field="item"], & .MuiDataGrid-cell[data-field="item"]': {
                  position: 'sticky',
                  left: 82,
                  zIndex: 5,
                  bgcolor: 'background.paper',
                  boxShadow: '4px 0 8px -8px rgba(15, 23, 42, 0.45)',
                },
                '& .MuiDataGrid-columnHeader[data-field="no"], & .MuiDataGrid-columnHeader[data-field="item"]': {
                  zIndex: 8,
                  bgcolor: '#eef2f6',
                },
                '& .MuiDataGrid-row.summary-row-main .MuiDataGrid-cell[data-field="no"], & .MuiDataGrid-row.summary-row-main .MuiDataGrid-cell[data-field="item"], & .MuiDataGrid-row.summary-row-alert .MuiDataGrid-cell[data-field="no"], & .MuiDataGrid-row.summary-row-alert .MuiDataGrid-cell[data-field="item"]':
                  {
                    bgcolor: '#fff7e6',
                  },
              }
            : {}),
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 700,
            whiteSpace: 'normal',
            lineHeight: 1.25,
            textAlign: 'center',
          },
          '& .MuiDataGrid-cell': {
            alignItems: 'center',
            borderColor: 'divider',
            py: 0.75,
          },
          '& .MuiDataGrid-row.summary-row-main .MuiDataGrid-cell, & .MuiDataGrid-row.summary-row-alert .MuiDataGrid-cell': {
            bgcolor: '#fff7e6',
            fontWeight: 700,
            alignItems: 'center',
          },
        }}
      />
    </Box>
  )
}

function StatisticsToolbar({ columnSelectorGroups, columnVisibilityModel, onColumnVisibilityModelChange, ...toolbarProps }) {
  return (
    <Toolbar
      {...toolbarProps}
      sx={{
        justifyContent: 'flex-end',
        gap: 0.25,
        px: 1,
      }}
    >
      <ParentColumnSelectorButton
        groups={columnSelectorGroups}
        columnVisibilityModel={columnVisibilityModel}
        onColumnVisibilityModelChange={onColumnVisibilityModelChange}
      />
      <DefaultFilterButton />
      <ToolbarDivider />
      <ExportMenuButton />
      <ToolbarDivider />
      <GridToolbarQuickFilter />
    </Toolbar>
  )
}

function ToolbarDivider() {
  return <Box sx={{ alignSelf: 'center', height: 24, borderLeft: 1, borderColor: 'divider', mx: 0.5 }} />
}

function ParentColumnSelectorButton({ groups, columnVisibilityModel, onColumnVisibilityModelChange }) {
  const [anchorElement, setAnchorElement] = useState(null)
  const open = Boolean(anchorElement)

  const isFieldVisible = (field) => columnVisibilityModel[field] !== false
  const isGroupChecked = (group) => group.fields.every(isFieldVisible)
  const isGroupIndeterminate = (group) => group.fields.some(isFieldVisible) && !isGroupChecked(group)
  const setGroupVisible = (group, visible) => {
    onColumnVisibilityModelChange((current) => ({
      ...current,
      ...group.fields.reduce(
        (result, field) => ({
          ...result,
          [field]: visible,
        }),
        {},
      ),
    }))
  }
  const setAllVisible = (visible) => {
    onColumnVisibilityModelChange((current) => ({
      ...current,
      ...groups.flatMap((group) => group.fields).reduce(
        (result, field) => ({
          ...result,
          [field]: visible,
        }),
        {},
      ),
    }))
  }

  return (
    <>
      <Tooltip title="คอลัมน์">
        <ToolbarButton onClick={(event) => setAnchorElement(event.currentTarget)} color={open ? 'primary' : 'default'}>
          <ViewColumnIcon fontSize="small" />
        </ToolbarButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorElement}
        onClose={() => setAnchorElement(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 310,
              maxHeight: 430,
              mt: 0.5,
              overflow: 'hidden',
              boxShadow: '0 10px 28px rgba(15, 23, 42, 0.22)',
            },
          },
        }}
      >
        <Stack sx={{ maxHeight: 430 }}>
          <Box sx={{ p: 1.25, pb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              เลือกคอลัมน์
            </Typography>
            <Typography variant="caption" color="text.secondary">
              เลือกจากคอลัมน์แม่เพื่อซ่อน/แสดงคอลัมน์ย่อยพร้อมกัน
            </Typography>
          </Box>
          <Stack sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 1, py: 0.5 }}>
            {groups.map((group) => (
              <FormControlLabel
                key={group.id}
                control={
                  <Checkbox
                    checked={isGroupChecked(group)}
                    indeterminate={isGroupIndeterminate(group)}
                    onChange={(event) => setGroupVisible(group, event.target.checked)}
                    size="small"
                  />
                }
                label={group.label}
                sx={{
                  m: 0,
                  minHeight: 34,
                  '& .MuiFormControlLabel-label': {
                    fontSize: 14,
                  },
                }}
              />
            ))}
          </Stack>
          <Divider />
          <Stack direction="row" spacing={1} sx={{ p: 1, justifyContent: 'space-between' }}>
            <Button size="small" onClick={() => setAllVisible(true)}>
              แสดงทั้งหมด
            </Button>
            <Button size="small" color="inherit" onClick={() => setAllVisible(false)}>
              ซ่อนทั้งหมด
            </Button>
            <Button size="small" color="inherit" onClick={() => onColumnVisibilityModelChange({})}>
              คืนค่า
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </>
  )
}

function DefaultFilterButton() {
  return (
    <Tooltip title="ตัวกรอง">
      <FilterPanelTrigger
        render={(triggerProps, state) => (
          <ToolbarButton {...triggerProps} color={state.filterCount > 0 ? 'primary' : 'default'}>
            <Badge badgeContent={state.filterCount} color="primary" variant="dot">
              <FilterListIcon fontSize="small" />
            </Badge>
          </ToolbarButton>
        )}
      />
    </Tooltip>
  )
}

function ExportMenuButton() {
  const apiRef = useGridApiContext()
  const [anchorElement, setAnchorElement] = useState(null)
  const open = Boolean(anchorElement)
  const closeMenu = () => setAnchorElement(null)

  return (
    <>
      <Tooltip title="ส่งออก">
        <ToolbarButton onClick={(event) => setAnchorElement(event.currentTarget)} color={open ? 'primary' : 'default'}>
          <FileDownloadIcon fontSize="small" />
        </ToolbarButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorElement}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 190,
              mt: 0.5,
              boxShadow: '0 10px 28px rgba(15, 23, 42, 0.22)',
            },
          },
        }}
      >
        <Stack sx={{ py: 0.75 }}>
          <Button
            color="inherit"
            onClick={() => {
              apiRef.current.exportDataAsPrint()
              closeMenu()
            }}
            sx={{ justifyContent: 'flex-start', px: 2, py: 1, borderRadius: 0 }}
          >
            Print
          </Button>
          <Button
            color="inherit"
            onClick={() => {
              apiRef.current.exportDataAsCsv({
                utf8WithBom: true,
              })
              closeMenu()
            }}
            sx={{ justifyContent: 'flex-start', px: 2, py: 1, borderRadius: 0 }}
          >
            Download as CSV
          </Button>
        </Stack>
      </Popover>
    </>
  )
}

function DetailDialog({ context, onClose }) {
  return (
    <Dialog open={Boolean(context)} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{context ? `รายละเอียดข้อมูลต้นทาง: ${context.title}` : 'รายละเอียดข้อมูลต้นทาง'}</DialogTitle>
      <Divider />
      <DialogContent sx={{ height: 430 }}>
        {context?.group ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            กลุ่มข้อมูล: {context.group}
          </Typography>
        ) : null}
        <DataGrid
          rows={detailRows}
          columns={detailColumns}
          disableRowSelectionOnClick
          pageSizeOptions={[10]}
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize: 10 },
            },
          }}
          localeText={baseGridLocaleText}
          sx={{ borderColor: 'divider' }}
        />
      </DialogContent>
    </Dialog>
  )
}

function renderCountButton(value, onClick) {
  if (!value) {
    return (
      <Typography variant="body2" color="text.disabled">
        -
      </Typography>
    )
  }

  return (
    <Button variant="text" size="small" onClick={onClick} sx={{ minWidth: 0, px: 0.75, fontWeight: 700 }}>
      {Number(value).toLocaleString('th-TH')}
    </Button>
  )
}

function buildParameterRows(view) {
  const labels = rowsByView[view] ?? rowsByView.region

  return labels.map((label, rowIndex) => {
    const allOutside = rowIndex === 0 ? 24 : 4 + (rowIndex % 2)
    const allInside = rowIndex === 0 ? 8 : rowIndex % 3
    const row = {
      id: `${view}-${label}`,
      area: label,
      allOutside,
      allInside,
    }

    parameterNames.forEach((parameter, parameterIndex) => {
      row[`${parameter}Outside`] = parameterIndex === 0 ? allOutside : Math.max(0, 20 - parameterIndex * 3 + rowIndex)
      row[`${parameter}Inside`] = parameterIndex % 3 === 0 ? allInside : rowIndex % 2
    })

    return row
  })
}

export default StatisticsPage
