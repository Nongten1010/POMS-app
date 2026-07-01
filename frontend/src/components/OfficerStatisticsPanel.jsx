import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import TableChartIcon from '@mui/icons-material/TableChart'
import { DataGrid } from '@mui/x-data-grid'

const yearOptions = ['ทั้งหมด', '2569', '2568']
const roundOptions = ['ทั้งหมด', 'ครั้งที่ 1', 'ครั้งที่ 2']

const summaryViews = [
  { value: 'region', label: 'ภูมิภาค', gridLabel: 'แยกตามภูมิภาค' },
  { value: 'province', label: 'จังหวัด', gridLabel: 'แยกรายจังหวัด' },
  { value: 'factoryType', label: 'ประเภทโรงงาน', gridLabel: 'แยกตามลำดับประเภทโรงงาน' },
  { value: 'industrialEstate', label: 'ในนิคม/นอกนิคม', gridLabel: 'แยกตามในนิคมอุตสาหกรรม/นอกนิคม' },
]

const baseRows = [
  {
    id: '1',
    no: '1',
    item: 'จำนวนโรงงานและจุดตรวจวัดทั้งหมดที่ยื่นเรื่อง',
    type: 'main',
    values: [117, 119, 89, 91, 18, 18, 10, 10],
    bodCodValues: [96, 21],
  },
  {
    id: '2',
    no: '2',
    item: 'จำนวนโรงงานและจุดตรวจวัดที่สถานะอยู่ระหว่างพิจารณาหรือรอโรงงานแก้ไข',
    type: 'main',
    values: [26, 31, 18, 22, 6, 6, 2, 3],
    bodCodValues: [22, 8],
  },
  {
    id: '2.1',
    no: '2.1',
    item: 'อยู่ระหว่างพิจารณา',
    type: 'sub',
    values: [15, 18, 11, 13, 3, 3, 1, 2],
    bodCodValues: [13, 4],
  },
  {
    id: '2.2',
    no: '2.2',
    item: 'รอโรงงานแก้ไข',
    type: 'sub',
    values: [11, 13, 7, 9, 3, 3, 1, 1],
    bodCodValues: [9, 4],
  },
  {
    id: '3',
    no: '3',
    item: 'จำนวนโรงงานและจุดตรวจวัดที่ตรวจสอบหรือดำเนินการแล้วเสร็จ',
    type: 'main',
    values: [91, 88, 71, 69, 12, 12, 8, 7],
    bodCodValues: [74, 13],
  },
  {
    id: '3.1',
    no: '3.1',
    item: 'ตรวจสอบผ่านหรือดำเนินการแล้วเสร็จ',
    type: 'sub',
    values: [82, 80, 64, 63, 11, 11, 7, 6],
    bodCodValues: [67, 11],
  },
  {
    id: '3.2',
    no: '3.2',
    item: 'ยกเลิกหรือไม่เข้าเงื่อนไขดำเนินการต่อ',
    type: 'sub',
    values: [9, 8, 7, 6, 1, 1, 1, 1],
    bodCodValues: [7, 2],
  },
  {
    id: '4',
    no: '4',
    item: 'จำนวนโรงงานที่ส่งและไม่ส่งรายงานการตรวจสอบค่าความคลาดเคลื่อน',
    type: 'alert',
    values: [96, 21, 72, 17, 15, 3, 9, 1],
    bodCodValues: [96, 21],
    bodCodOnly: true,
  },
  {
    id: '4.1',
    no: '4.1',
    item: 'โรงงานที่ส่งรายงานการตรวจสอบค่าความคลาดเคลื่อน',
    type: 'sub',
    values: [96, 0, 72, 0, 15, 0, 9, 0],
    bodCodValues: [96, 0],
    bodCodOnly: true,
  },
  {
    id: '4.2',
    no: '4.2',
    item: 'โรงงานที่ไม่ส่งรายงานการตรวจสอบค่าความคลาดเคลื่อน',
    type: 'sub',
    values: [0, 21, 0, 17, 0, 3, 0, 1],
    bodCodValues: [0, 21],
    bodCodOnly: true,
  },
]

const viewFactors = {
  region: 1,
  province: 0.72,
  factoryType: 0.58,
  industrialEstate: 0.46,
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

function scaleValue(value, factor) {
  if (!value) return 0

  return Math.max(1, Math.round(value * factor))
}

function getSummaryRows(activeView, year, round, showRoundFilter) {
  const viewFactor = viewFactors[activeView] ?? 1
  const yearFactor = year === '2568' ? 0.82 : 1
  const roundFactor = showRoundFilter && round === 'ครั้งที่ 2' ? 0.62 : 1
  const factor = viewFactor * yearFactor * roundFactor

  return baseRows
    .filter((row) => showRoundFilter || !row.bodCodOnly)
    .map((row) => {
      const values = row.values.map((value) => scaleValue(value, factor))
      const bodCodValues = row.bodCodValues.map((value) => scaleValue(value, factor))

      return {
        ...row,
        countryFactory: values[0],
        countryPoint: values[1],
        diwFactory: values[2],
        diwPoint: values[3],
        pioFactory: values[4],
        pioPoint: values[5],
        ieatFactory: values[6],
        ieatPoint: values[7],
        submittedReportFactories: bodCodValues[0],
        notSubmittedReportFactories: bodCodValues[1],
      }
    })
}

function countCell(value) {
  if (!value) return '-'

  return (
    <Button variant="text" size="small" sx={{ minWidth: 0, fontWeight: 700, color: 'primary.main' }}>
      {value}
    </Button>
  )
}

function OfficerStatisticsPanel({ title = 'สถิติข้อมูล', showRoundFilter = false }) {
  const [activeView, setActiveView] = useState(summaryViews[0].value)
  const [year, setYear] = useState('ทั้งหมด')
  const [round, setRound] = useState('ทั้งหมด')
  const activeViewConfig = summaryViews.find((view) => view.value === activeView) ?? summaryViews[0]
  const rows = useMemo(() => getSummaryRows(activeView, year, round, showRoundFilter), [activeView, round, showRoundFilter, year])
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
        ['countryFactory', 'ทั่วประเทศ', 'โรงงาน'],
        ['countryPoint', 'ทั่วประเทศ', 'จุดตรวจวัด'],
        ['diwFactory', 'กรอ.', 'โรงงาน'],
        ['diwPoint', 'กรอ.', 'จุดตรวจวัด'],
        ['pioFactory', 'สอจ.', 'โรงงาน'],
        ['pioPoint', 'สอจ.', 'จุดตรวจวัด'],
        ['ieatFactory', 'กนอ.', 'โรงงาน'],
        ['ieatPoint', 'กนอ.', 'จุดตรวจวัด'],
      ].map(([field, , label]) => ({
        field,
        headerName: label,
        width: 112,
        align: 'center',
        headerAlign: 'center',
        sortable: false,
        renderCell: (params) => countCell(params.value),
      })),
      ...(showRoundFilter
        ? [
            {
              field: 'submittedReportFactories',
              headerName: 'ส่งรายงาน',
              width: 124,
              align: 'center',
              headerAlign: 'center',
              sortable: false,
              renderCell: (params) => countCell(params.value),
            },
            {
              field: 'notSubmittedReportFactories',
              headerName: 'ไม่ส่งรายงาน',
              width: 124,
              align: 'center',
              headerAlign: 'center',
              sortable: false,
              renderCell: (params) => countCell(params.value),
            },
          ]
        : []),
    ],
    [showRoundFilter],
  )
  const columnGroupingModel = useMemo(
    () => [
      { groupId: 'country', headerName: 'ทั่วประเทศ', children: [{ field: 'countryFactory' }, { field: 'countryPoint' }] },
      { groupId: 'diw', headerName: 'กรอ.', children: [{ field: 'diwFactory' }, { field: 'diwPoint' }] },
      { groupId: 'pio', headerName: 'สอจ.', children: [{ field: 'pioFactory' }, { field: 'pioPoint' }] },
      { groupId: 'ieat', headerName: 'กนอ.', children: [{ field: 'ieatFactory' }, { field: 'ieatPoint' }] },
      ...(showRoundFilter
        ? [
            {
              groupId: 'reportSubmission',
              headerName: 'การส่งรายงาน',
              children: [{ field: 'submittedReportFactories' }, { field: 'notSubmittedReportFactories' }],
            },
          ]
        : []),
    ],
    [showRoundFilter],
  )

  return (
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', px: 2, py: 1.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} sx={{ alignItems: { xs: 'stretch', md: 'center' } }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, flexShrink: 0 }}>
            แสดงผลแยกตาม:
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            {summaryViews.map((view) => (
              <Button
                key={view.value}
                variant={activeView === view.value ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setActiveView(view.value)}
                sx={{ borderRadius: 999, px: 2 }}
              >
                {view.label}
              </Button>
            ))}
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="officer-stat-year-label">ปี พ.ศ.</InputLabel>
              <Select labelId="officer-stat-year-label" label="ปี พ.ศ." value={year} onChange={(event) => setYear(event.target.value)}>
                {yearOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {showRoundFilter ? (
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel id="officer-stat-round-label">ครั้งที่</InputLabel>
                <Select labelId="officer-stat-round-label" label="ครั้งที่" value={round} onChange={(event) => setRound(event.target.value)}>
                  {roundOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ flex: 1, minHeight: 0, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
        <Stack direction="row" spacing={2} sx={{ px: 2, py: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
            <TableChartIcon color="primary" />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" fontWeight={700}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                มุมมอง: {activeViewConfig.gridLabel}
              </Typography>
            </Box>
          </Stack>
          <ToggleButtonGroup exclusive value="table" size="small" sx={{ flexShrink: 0 }}>
            <ToggleButton value="table">ตาราง</ToggleButton>
            <ToggleButton value="chart" disabled>
              กราฟ
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Box sx={{ height: 'calc(100% - 74px)', minHeight: 0, borderTop: 1, borderColor: 'divider' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            columnGroupingModel={columnGroupingModel}
            disableRowSelectionOnClick
            disableColumnSelector
            disableDensitySelector
            showToolbar
            showCellVerticalBorder
            showColumnVerticalBorder
            getRowHeight={() => 'auto'}
            pageSizeOptions={[25, 50, 100]}
            initialState={{
              pagination: {
                paginationModel: { page: 0, pageSize: 25 },
              },
            }}
            getRowClassName={(params) =>
              params.row.type === 'alert' ? 'summary-row-alert' : params.row.type === 'main' ? 'summary-row-main' : ''
            }
            localeText={dataGridLocaleText}
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
              },
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
              },
            }}
          />
        </Box>
      </Paper>
    </Stack>
  )
}

export default OfficerStatisticsPanel
