import { useMemo, useState } from 'react'
import { Box, Button, Chip, Paper, Stack, Tab, Tabs, Typography } from '@mui/material'
import AddTaskIcon from '@mui/icons-material/AddTask'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import LinkIcon from '@mui/icons-material/Link'
import { DataGrid } from '@mui/x-data-grid'

const factoryRows = [
  {
    id: 1,
    factoryName: 'บริษัท เอเชีย ไบโอเคมีคอล จำกัด',
    newRegistrationNo: '3-101-45/67สป',
    oldRegistrationNo: 'จ3-45(1)-12/2548',
    factoryTypeOrder: '101 / 45',
    location: '99 หมู่ 4 ตำบลบางปูใหม่ อำเภอเมืองสมุทรปราการ',
    province: 'สมุทรปราการ',
    industrialEstate: 'นิคมอุตสาหกรรมบางปู',
    coordinates: '13.544012, 100.652410',
    operation: 'ผลิตสารเคมีและวัตถุดิบชีวภาพ',
    operationStatus: 'แจ้งประกอบแล้ว',
    capital: '120,000,000 บาท',
    machineHorsepower: '4,850 แรงม้า',
    productionCapacity: '18,000 ตัน/ปี',
    wastewaterDischarge: 'ระบายออกนอกโรงงานผ่านระบบบำบัดกลาง',
    boilerCount: 2,
    boilerSize: '8 ตัน/ชม., 6 ตัน/ชม.',
    fuel: 'ก๊าซธรรมชาติ',
    eia: 'มี',
  },
  {
    id: 2,
    factoryName: 'บริษัท ไทยฟู้ดส์ โปรเซสซิ่ง จำกัด',
    newRegistrationNo: '3-009-18/66นฐ',
    oldRegistrationNo: 'จ3-9(2)-88/2552',
    factoryTypeOrder: '9 / 18',
    location: '145 หมู่ 8 ตำบลกระทุ่มล้ม อำเภอสามพราน',
    province: 'นครปฐม',
    industrialEstate: '-',
    coordinates: '13.724391, 100.300415',
    operation: 'แปรรูปอาหารและผลิตภัณฑ์จากพืช',
    operationStatus: 'แจ้งประกอบแล้ว',
    capital: '85,000,000 บาท',
    machineHorsepower: '2,120 แรงม้า',
    productionCapacity: '9,500 ตัน/ปี',
    wastewaterDischarge: 'บำบัดภายในและระบายตามใบอนุญาต',
    boilerCount: 1,
    boilerSize: '5 ตัน/ชม.',
    fuel: 'ชีวมวล',
    eia: 'ไม่มี',
  },
  {
    id: 3,
    factoryName: 'บริษัท อีสเทิร์น เมทัล เวิร์คส์ จำกัด',
    newRegistrationNo: '3-064-22/65ชบ',
    oldRegistrationNo: 'จ3-64(1)-31/2546',
    factoryTypeOrder: '64 / 22',
    location: '700/88 หมู่ 1 ตำบลบ้านเก่า อำเภอพานทอง',
    province: 'ชลบุรี',
    industrialEstate: 'นิคมอุตสาหกรรมอมตะซิตี้ ชลบุรี',
    coordinates: '13.438762, 101.051155',
    operation: 'ผลิตชิ้นส่วนโลหะและเคลือบผิวโลหะ',
    operationStatus: 'ยังไม่แจ้ง',
    capital: '210,000,000 บาท',
    machineHorsepower: '7,300 แรงม้า',
    productionCapacity: '24,000 ตัน/ปี',
    wastewaterDischarge: 'มีจุดระบายน้ำทิ้งออกนอกโรงงาน',
    boilerCount: 3,
    boilerSize: '10 ตัน/ชม. จำนวน 2 ลูก, 4 ตัน/ชม.',
    fuel: 'ก๊าซธรรมชาติและน้ำมันเตา',
    eia: 'มี',
  },
  {
    id: 4,
    factoryName: 'บริษัท กรีนรับเบอร์ อินดัสทรี จำกัด',
    newRegistrationNo: '3-052-11/64รย',
    oldRegistrationNo: 'จ3-52(3)-09/2551',
    factoryTypeOrder: '52 / 11',
    location: '55 หมู่ 6 ตำบลมาบข่า อำเภอนิคมพัฒนา',
    province: 'ระยอง',
    industrialEstate: '-',
    coordinates: '12.793421, 101.156880',
    operation: 'ผลิตยางแผ่นและผลิตภัณฑ์ยาง',
    operationStatus: 'ยกเลิก',
    capital: '64,000,000 บาท',
    machineHorsepower: '1,780 แรงม้า',
    productionCapacity: '7,800 ตัน/ปี',
    wastewaterDischarge: 'ไม่มีการระบายออกนอกโรงงาน',
    boilerCount: 1,
    boilerSize: '3 ตัน/ชม.',
    fuel: 'ชีวมวล',
    eia: 'ไม่มี',
  },
  {
    id: 5,
    factoryName: 'บริษัท นอร์ทเทิร์น เพเปอร์ มิลล์ จำกัด',
    newRegistrationNo: '3-038-07/66ลป',
    oldRegistrationNo: 'จ3-38(1)-44/2549',
    factoryTypeOrder: '38 / 7',
    location: '222 หมู่ 3 ตำบลบ้านเสด็จ อำเภอเมืองลำปาง',
    province: 'ลำปาง',
    industrialEstate: '-',
    coordinates: '18.358105, 99.581670',
    operation: 'ผลิตเยื่อกระดาษและกระดาษอุตสาหกรรม',
    operationStatus: 'แจ้งประกอบแล้ว',
    capital: '155,000,000 บาท',
    machineHorsepower: '5,640 แรงม้า',
    productionCapacity: '32,000 ตัน/ปี',
    wastewaterDischarge: 'ระบายออกนอกโรงงานหลังบำบัด',
    boilerCount: 2,
    boilerSize: '12 ตัน/ชม., 8 ตัน/ชม.',
    fuel: 'ถ่านหินและชีวมวล',
    eia: 'มี',
  },
]

const subMenus = [
  { value: 'all', label: 'โรงงานทั้งหมด' },
  { value: 'eligible', label: 'โรงงานที่เข้าข่าย' },
  { value: 'requests', label: 'คำขอเชื่อมต่อ' },
]

const baseColumns = [
  { field: 'factoryName', headerName: 'ชื่อโรงงาน', width: 240 },
  { field: 'newRegistrationNo', headerName: 'เลขทะเบียนโรงงานแบบใหม่', width: 180 },
  { field: 'oldRegistrationNo', headerName: 'เลขทะเบียนโรงงานแบบเดิม', width: 190 },
  { field: 'factoryTypeOrder', headerName: 'ลำดับประเภทโรงงาน (หลัก /รอง)', width: 220 },
  { field: 'location', headerName: 'สถานที่ตั้ง', width: 320 },
  { field: 'province', headerName: 'จังหวัด', width: 130 },
  { field: 'industrialEstate', headerName: 'นิคมอุตสาหกรรม', width: 210 },
  { field: 'coordinates', headerName: 'พิกัดโรงงาน', width: 170 },
  { field: 'operation', headerName: 'การประกอบกิจการ', width: 260 },
  {
    field: 'operationStatus',
    headerName: 'สถานะการประกอบกิจการ',
    width: 190,
    renderCell: (params) => <StatusChip value={params.value} />,
  },
  { field: 'capital', headerName: 'เงินทุน', width: 160 },
  { field: 'machineHorsepower', headerName: 'แรงม้าเครื่องจักร', width: 160 },
  { field: 'productionCapacity', headerName: 'กำลังการผลิต', width: 170 },
  {
    field: 'wastewaterDischarge',
    headerName: 'ข้อมูลการระบายน้ำทิ้งออกนอกโรงงาน',
    width: 290,
  },
  { field: 'boilerCount', headerName: 'จำนวนหม้อน้ำ', width: 130, type: 'number' },
  { field: 'boilerSize', headerName: 'ขนาดของหม้อน้ำแต่ละลูก', width: 220 },
  { field: 'fuel', headerName: 'เชื้อเพลิงที่ใช้', width: 190 },
  {
    field: 'eia',
    headerName: 'ข้อมูล EIA',
    width: 130,
    renderCell: (params) => <EiaChip value={params.value} />,
  },
]

function EligibleFactoriesPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [eligibleFactoryIds, setEligibleFactoryIds] = useState([1, 3])

  const eligibleRows = useMemo(
    () => factoryRows.filter((row) => eligibleFactoryIds.includes(row.id)),
    [eligibleFactoryIds],
  )

  const allFactoryColumns = useMemo(
    () => [
      ...baseColumns,
      {
        field: 'option',
        headerName: 'Option',
        width: 130,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const isEligible = eligibleFactoryIds.includes(params.row.id)

          return (
            <Button
              size="small"
              variant={isEligible ? 'outlined' : 'contained'}
              color="secondary"
              startIcon={<AddTaskIcon />}
              disabled={isEligible}
              onClick={() => {
                setEligibleFactoryIds((current) =>
                  current.includes(params.row.id) ? current : [...current, params.row.id],
                )
              }}
            >
              เข้าข่าย
            </Button>
          )
        },
      },
    ],
    [eligibleFactoryIds],
  )

  const eligibleFactoryColumns = useMemo(
    () => [
      ...baseColumns,
      {
        field: 'option',
        headerName: 'Option',
        width: 130,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<HighlightOffIcon />}
            onClick={() => {
              setEligibleFactoryIds((current) => current.filter((id) => id !== params.row.id))
            }}
          >
            นำออก
          </Button>
        ),
      },
    ],
    [],
  )

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
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h5" component="h1">
              โรงงานที่เข้าข่าย
            </Typography>
            <Typography variant="body2" color="text.secondary">
              จัดการรายการโรงงานจากข้อมูล กรอ. และรายการโรงงานที่ถูกจัดเข้าข่าย
            </Typography>
          </Box>

          <Tabs
            value={activeTab}
            onChange={(_, value) => setActiveTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="เมนูย่อยโรงงานที่เข้าข่าย"
            sx={{
              flex: '0 0 auto',
              maxWidth: { xs: '100%', md: 520 },
              '& .MuiTab-root': {
                minHeight: 40,
                px: 1.5,
                fontWeight: 600,
              },
            }}
          >
            {subMenus.map((menu) => (
              <Tab key={menu.value} value={menu.value} label={menu.label} />
            ))}
          </Tabs>
        </Stack>
      </Paper>

      {activeTab === 'all' ? (
        <FactoryDataGrid title="โรงงานทั้งหมด (กรอ.)" rows={factoryRows} columns={allFactoryColumns} />
      ) : activeTab === 'eligible' ? (
        <FactoryDataGrid
          title="โรงงานที่เข้าข่าย"
          rows={eligibleRows}
          columns={eligibleFactoryColumns}
        />
      ) : (
        <ConnectionRequestsPanel />
      )}
    </Stack>
  )
}

function FactoryDataGrid({ title, rows, columns }) {
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
      <Box sx={{ height: '100%', minHeight: 420 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          disableRowSelectionOnClick
          showToolbar
          label={title}
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
            footerRowSelected: (count) => `เลือก ${count.toLocaleString()} รายการ`,
          }}
          sx={{
            border: 0,
            '& .MuiDataGrid-columnHeaders': {
              borderBottom: 1,
              borderColor: 'divider',
            },
            '& .MuiDataGrid-columnHeader': {
              borderRight: 1,
              borderColor: 'divider',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 600,
            },
            '& .MuiDataGrid-cell': {
              alignItems: 'center',
              borderRight: 1,
              borderColor: 'divider',
            },
            '& .MuiDataGrid-row': {
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

function StatusChip({ value }) {
  const colorByStatus = {
    แจ้งประกอบแล้ว: {
      borderColor: '#86efac',
      color: '#166534',
      bgcolor: '#dcfce7',
    },
    ยกเลิก: {
      borderColor: '#fca5a5',
      color: '#991b1b',
      bgcolor: '#fee2e2',
    },
    ยังไม่แจ้ง: {
      borderColor: '#fcd34d',
      color: '#92400e',
      bgcolor: '#fef3c7',
    },
  }

  return (
    <Chip
      label={value}
      size="small"
      variant="outlined"
      sx={{
        fontWeight: 300,
        ...(colorByStatus[value] ?? {}),
      }}
    />
  )
}

function EiaChip({ value }) {
  const hasEia = value === 'มี'

  return (
    <Chip
      label={value}
      size="small"
      variant="outlined"
      sx={{
        fontWeight: 300,
        borderColor: hasEia ? '#86efac' : '#cbd5e1',
        color: hasEia ? '#166534' : 'text.secondary',
        bgcolor: hasEia ? '#dcfce7' : 'background.paper',
      }}
    />
  )
}

function ConnectionRequestsPanel() {
  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        minHeight: 420,
        p: 3,
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 1,
            color: 'primary.dark',
            bgcolor: 'primary.50',
          }}
        >
          <LinkIcon />
        </Box>
        <Box>
          <Typography variant="h6" component="h2">
            คำขอเชื่อมต่อ
          </Typography>
          <Typography color="text.secondary">
            ส่วนนี้พร้อมสำหรับเชื่อมต่อข้อมูลคำขอในขั้นถัดไป
          </Typography>
        </Box>
      </Stack>
    </Paper>
  )
}

export default EligibleFactoriesPage
