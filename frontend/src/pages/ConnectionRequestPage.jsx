import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  IconButton,
  Menu,
  MenuItem,
  OutlinedInput,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { DataGrid } from '@mui/x-data-grid'

const subMenus = [
  { value: 'factories', label: 'รายชื่อโรงงาน' },
  { value: 'requests', label: 'รายการคำขอ' },
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

const monitoringPointTypeOptions = ['CEMS', 'WPMS', 'Mobile', 'Station']

const documentImageItems = [
  {
    title: 'ข้อมูลรายละเอียดการรายงานค่าที่สภาวะมาตรฐาน',
    description:
      'ให้แสดงรายละเอียดหรือแนบเอกสารหรือรูปภาพหน้าโปรแกรมของเครื่องมือที่แสดงให้เห็นถึงการคำนวณและการรายงานค่าของมลพิษในอากาศเสียที่สภาวะมาตรฐาน ความดัน 1 บรรยากาศ หรือ 760 มิลลิเมตรปรอท อุณหภูมิ 25 องศาเซลเซียสที่สภาวะแห้ง (Dry basis) โดยมีปริมาตรอากาศส่วนเกินในการเผาไหม้ (Excess air) ร้อยละ 50 หรือมีปริมาตรออกซิเจนในอากาศเสีย ร้อยละ 7 หรือ ปริมาตรออกซิเจนในอากาศเสีย ณ สภาวะจริงในขณะตรวจวัด (การเผาไหม้แบบระบบปิดหรือไม่มีการเผาไหม้)',
    hasLink: true,
    uploadLabel: 'ภาพ/ไฟล์/QR Code',
  },
  {
    title: 'รายงานผลการทำ RATA หรือ อื่นๆ ที่เทียบเท่า ของระบบ CEMS ครั้งล่าสุด',
    hasLink: true,
    uploadLabel: 'ภาพ/ไฟล์/QR Code',
  },
  {
    title: 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน',
    uploadLabel: 'ภาพ/ไฟล์/QR Code (JPG / PNG ขนาดไม่เกิน 3Mb)',
    accept: 'image/jpeg,image/png',
  },
  {
    title: 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท',
    uploadLabel: 'ภาพ/ไฟล์/QR Code (JPG / PNG ขนาดไม่เกิน 3Mb)',
    accept: 'image/jpeg,image/png',
  },
  {
    title: 'ภาพถ่ายปล่อง',
    uploadLabel: 'ภาพ/ไฟล์/QR Code (JPG / PNG ขนาดไม่เกิน 3Mb)',
    accept: 'image/jpeg,image/png',
  },
  {
    title: 'ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (CEMS)',
    uploadLabel: 'ภาพ/ไฟล์/QR Code (JPG / PNG ขนาดไม่เกิน 3Mb)',
    accept: 'image/jpeg,image/png',
  },
]

const groupedDocumentImageTitles = [
  'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน',
  'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท',
  'ภาพถ่ายปล่อง',
  'ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (CEMS)',
]

const appBarHeight = {
  xs: 64,
  md: 72,
}

const factoryRows = [
  {
    id: 1,
    factoryName: 'บริษัท เอเชีย เคมีคอล จำกัด',
    newRegistrationNo: '3-101-45/66',
    oldRegistrationNo: 'รง.4-101-2545',
    industryType: 'ผลิตเคมีภัณฑ์',
    industryMainOrder: '042 โรงงานประกอบกิจการเกี่ยวกับเคมีภัณฑ์',
    industrySubOrder: '04201 ผลิตสารเคมีพื้นฐาน',
    businessActivity: 'ผลิตสารเคมีสำหรับอุตสาหกรรม',
    eia: 'มี',
    projectName: 'โครงการควบคุมคุณภาพน้ำระยะที่ 1',
    address: '88 หมู่ 4 ตำบลมาบตาพุด อำเภอเมืองระยอง จังหวัดระยอง',
    latitude: '12.6819',
    longitude: '101.1446',
    province: 'ระยอง',
    monitoringPointCount: 3,
    requestStatus: 'รอพิจารณาแบบ',
    status: 'แสดง',
  },
  {
    id: 2,
    factoryName: 'บริษัท กรีน วอเตอร์ จำกัด',
    newRegistrationNo: '3-088-12/65',
    oldRegistrationNo: 'รง.4-088-1212',
    industryType: 'บำบัดน้ำเสีย',
    industryMainOrder: '101 โรงงานประกอบกิจการเกี่ยวกับการบำบัดน้ำเสีย',
    industrySubOrder: '10102 บำบัดน้ำเสียรวม',
    businessActivity: 'ให้บริการบำบัดน้ำเสียอุตสาหกรรม',
    eia: 'ไม่มี',
    projectName: '-',
    address: '199 หมู่ 7 ตำบลบ่อวิน อำเภอศรีราชา จังหวัดชลบุรี',
    latitude: '13.0524',
    longitude: '101.0653',
    province: 'ชลบุรี',
    monitoringPointCount: 2,
    requestStatus: 'รอเชื่อมต่อ',
    status: 'แสดง',
  },
  {
    id: 3,
    factoryName: 'บริษัท ไทยฟู้ด โปรเซสซิ่ง จำกัด',
    newRegistrationNo: '3-064-89/64',
    oldRegistrationNo: 'รง.4-064-4589',
    industryType: 'แปรรูปอาหาร',
    industryMainOrder: '006 โรงงานประกอบกิจการเกี่ยวกับอาหาร',
    industrySubOrder: '00605 แปรรูปอาหารสำเร็จรูป',
    businessActivity: 'ผลิตและแปรรูปอาหารแช่แข็ง',
    eia: 'ไม่มี',
    projectName: '-',
    address: '45 หมู่ 2 ตำบลบางพลีใหญ่ อำเภอบางพลี จังหวัดสมุทรปราการ',
    latitude: '13.6062',
    longitude: '100.7066',
    province: 'สมุทรปราการ',
    monitoringPointCount: 1,
    requestStatus: 'รอโรงงานแก้ไข',
    status: 'แสดง',
  },
  {
    id: 4,
    factoryName: 'บริษัท อีสเทิร์น เพาเวอร์ จำกัด',
    newRegistrationNo: '3-092-37/66',
    oldRegistrationNo: 'รง.4-092-3037',
    industryType: 'ผลิตพลังงาน',
    industryMainOrder: '088 โรงงานประกอบกิจการเกี่ยวกับพลังงาน',
    industrySubOrder: '08801 ผลิตพลังงานไฟฟ้า',
    businessActivity: 'ผลิตและจำหน่ายพลังงานไฟฟ้า',
    eia: 'มี',
    projectName: 'โครงการโรงไฟฟ้าพลังงานความร้อนร่วม',
    address: '120 หมู่ 9 ตำบลบางสมัคร อำเภอบางปะกง จังหวัดฉะเชิงเทรา',
    latitude: '13.5447',
    longitude: '100.9982',
    province: 'ฉะเชิงเทรา',
    monitoringPointCount: 4,
    requestStatus: 'ยืนยันการเชื่อมต่อ',
    status: 'ซ่อน',
  },
  {
    id: 5,
    factoryName: 'บริษัท เมทัล เวิร์คส์ จำกัด',
    newRegistrationNo: '3-105-21/63',
    oldRegistrationNo: 'รง.4-105-2121',
    industryType: 'ผลิตโลหะ',
    industryMainOrder: '064 โรงงานประกอบกิจการเกี่ยวกับโลหะ',
    industrySubOrder: '06403 ชุบและปรับสภาพผิวโลหะ',
    businessActivity: 'ผลิตชิ้นส่วนโลหะและชุบผิว',
    eia: 'มี',
    projectName: 'โครงการปรับปรุงระบบบำบัดอากาศ',
    address: '77 หมู่ 5 ตำบลท่าตูม อำเภอศรีมหาโพธิ จังหวัดปราจีนบุรี',
    latitude: '13.9311',
    longitude: '101.5482',
    province: 'ปราจีนบุรี',
    monitoringPointCount: 2,
    requestStatus: 'เชื่อมต่อแล้ว',
    status: 'แสดง',
  },
  {
    id: 6,
    factoryName: 'บริษัท นิว วอเตอร์ มอนิเตอร์ จำกัด',
    newRegistrationNo: '3-122-09/67',
    oldRegistrationNo: 'รง.4-122-0909',
    industryType: 'ผลิตเครื่องดื่ม',
    industryMainOrder: '007 โรงงานประกอบกิจการเกี่ยวกับเครื่องดื่ม',
    industrySubOrder: '00701 ผลิตเครื่องดื่มไม่มีแอลกอฮอล์',
    businessActivity: 'ผลิตเครื่องดื่มบรรจุขวด',
    eia: 'ไม่มี',
    projectName: '-',
    address: '55 หมู่ 3 ตำบลสามพราน อำเภอสามพราน จังหวัดนครปฐม',
    latitude: '13.7312',
    longitude: '100.2157',
    province: 'นครปฐม',
    monitoringPointCount: 0,
    requestStatus: 'ยังไม่มีจุดตรวจวัด',
    status: 'แสดง',
  },
]

const requestRows = [
  {
    id: 1,
    factoryName: 'บริษัท เอเชีย เคมีคอล จำกัด',
    industryType: 'ผลิตเคมีภัณฑ์',
    province: 'ระยอง',
    type: 'เชื่อมต่อใหม่',
    requestNo: 'CR-2567-0001',
    submittedDate: '12/03/2567',
    monitoringPointCode: '-',
    codeIssuedDate: '-',
    form: 'เชื่อมต่อใหม่',
    status: 'รอพิจารณาแบบ',
  },
  {
    id: 2,
    factoryName: 'บริษัท กรีน วอเตอร์ จำกัด',
    industryType: 'บำบัดน้ำเสีย',
    province: 'ชลบุรี',
    type: 'เพิ่มจุดตรวจวัด',
    requestNo: 'CR-2567-0002',
    submittedDate: '15/03/2567',
    monitoringPointCode: 'POMS-RYG-0007',
    codeIssuedDate: '18/03/2567',
    form: 'เพิ่มจุดตรวจวัด',
    status: 'รอเชื่อมต่อ',
  },
  {
    id: 3,
    factoryName: 'บริษัท ไทยฟู้ด โปรเซสซิ่ง จำกัด',
    industryType: 'แปรรูปอาหาร',
    province: 'สมุทรปราการ',
    type: 'เพิ่มพารามิเตอร์',
    requestNo: 'CR-2567-0003',
    submittedDate: '20/03/2567',
    monitoringPointCode: 'POMS-SPK-0012',
    codeIssuedDate: '22/03/2567',
    form: 'เพิ่มพารามิเตอร์',
    status: 'รอโรงงานแก้ไข',
  },
  {
    id: 4,
    factoryName: 'บริษัท อีสเทิร์น เพาเวอร์ จำกัด',
    industryType: 'ผลิตพลังงาน',
    province: 'ฉะเชิงเทรา',
    type: 'เชื่อมต่อใหม่',
    requestNo: 'CR-2567-0004',
    submittedDate: '25/03/2567',
    monitoringPointCode: 'POMS-CCO-0021',
    codeIssuedDate: '29/03/2567',
    form: 'เชื่อมต่อใหม่',
    status: 'ยืนยันการเชื่อมต่อ',
  },
  {
    id: 5,
    factoryName: 'บริษัท เมทัล เวิร์คส์ จำกัด',
    industryType: 'ผลิตโลหะ',
    province: 'ปราจีนบุรี',
    type: 'เพิ่มจุดตรวจวัด',
    requestNo: 'CR-2567-0005',
    submittedDate: '02/04/2567',
    monitoringPointCode: 'POMS-PCB-0016',
    codeIssuedDate: '05/04/2567',
    form: 'เพิ่มจุดตรวจวัด',
    status: 'เชื่อมต่อแล้ว',
  },
]

function StatusChip({ value }) {
  const color =
    value === 'เชื่อมต่อแล้ว'
      ? 'success'
      : value === 'รอโรงงานแก้ไข'
        ? 'warning'
        : value === 'ยืนยันการเชื่อมต่อ'
          ? 'info'
          : 'default'

  return <Chip label={value} color={color} size="small" variant={color === 'default' ? 'outlined' : 'filled'} />
}

function MenuButton({ label, options, onSelect, disabled = false }) {
  const [anchorEl, setAnchorEl] = useState(null)
  const isMenuOpen = Boolean(anchorEl)

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        endIcon={<KeyboardArrowDownIcon />}
        disabled={disabled}
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        {label}
      </Button>
      <Menu anchorEl={anchorEl} open={isMenuOpen} onClose={() => setAnchorEl(null)}>
        {options.map((option) => (
          <MenuItem
            key={typeof option === 'string' ? option : option.label}
            disabled={typeof option === 'string' ? false : option.disabled}
            onClick={() => {
              onSelect?.(typeof option === 'string' ? option : option.label)
              setAnchorEl(null)
            }}
          >
            {typeof option === 'string' ? option : option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

function FactoryStatusMenu({ status }) {
  const [selectedStatus, setSelectedStatus] = useState(status)

  return (
    <MenuButton
      label={selectedStatus}
      options={['แสดง', 'ซ่อน']}
      onSelect={(option) => setSelectedStatus(option)}
    />
  )
}

function FactoryFormMenu({ disabled = false, requestStatus, monitoringPointCount = 0, onSelect }) {
  const hasNoMonitoringPoint = requestStatus === 'ยังไม่มีจุดตรวจวัด'

  return (
    <MenuButton
      label="แบบฟอร์มคำขอ"
      options={[
        { label: 'เชื่อมต่อใหม่', disabled: monitoringPointCount > 0 },
        { label: 'เพิ่มจุดตรวจวัด', disabled: hasNoMonitoringPoint },
      ]}
      disabled={disabled}
      onSelect={onSelect}
    />
  )
}

function OfficerFactoryActions({ status }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', height: '100%' }}>
      <Button size="small" variant="outlined">
        ดูข้อมูล
      </Button>
      <Button size="small" variant="outlined">
        ดูคำขอ
      </Button>
      <Button size="small" color="error" variant="outlined">
        ลบ
      </Button>
      <FactoryStatusMenu status={status} />
    </Stack>
  )
}

function OperatorFactoryActions({ row, onOpenRequestForm }) {
  const { requestStatus, monitoringPointCount } = row
  const canSubmitRequestForm = ['เชื่อมต่อแล้ว', 'ยังไม่มีจุดตรวจวัด'].includes(requestStatus)

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', height: '100%' }}>
      <Button size="small" variant="outlined">
        ดูข้อมูล
      </Button>
      <Button size="small" variant="outlined">
        ดูคำขอ
      </Button>
      <FactoryFormMenu
        disabled={!canSubmitRequestForm}
        requestStatus={requestStatus}
        monitoringPointCount={monitoringPointCount}
        onSelect={(formType) => onOpenRequestForm?.(row, formType)}
      />
    </Stack>
  )
}

function OfficerRequestActions() {
  return (
    <Button size="small" variant="contained">
      ดำเนินการ
    </Button>
  )
}

function OperatorRequestActions({ status }) {
  const canModifyRequest = status === 'รอโรงงานแก้ไข'

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', height: '100%' }}>
      <Button size="small" variant="outlined">
        เปิดดู
      </Button>
      <Button size="small" variant="outlined" disabled={!canModifyRequest}>
        แก้ไข
      </Button>
      <Button size="small" color="error" variant="outlined" disabled={!canModifyRequest}>
        ยกเลิกคำขอ
      </Button>
    </Stack>
  )
}

function getFactoryColumns(isOperator, onOpenRequestForm) {
  return [
    { field: 'factoryName', headerName: 'ชื่อโรงงาน/บริษัท', width: 240 },
    { field: 'newRegistrationNo', headerName: 'เลขทะเบียนโรงงาน (ใหม่)', width: 190 },
    { field: 'oldRegistrationNo', headerName: 'เลขทะเบียนโรงงาน (เก่า)', width: 190 },
    { field: 'industryType', headerName: 'ประเภทอุตสาหกรรม', width: 170 },
    { field: 'province', headerName: 'จังหวัด', width: 130 },
    { field: 'monitoringPointCount', headerName: 'จำนวนจุดตรวจวัด', width: 150, type: 'number' },
    {
      field: 'requestStatus',
      headerName: 'สถานะคำขอ',
      width: 170,
      renderCell: (params) => <StatusChip value={params.value} />,
    },
    { field: 'status', headerName: 'สถานะ', width: 110 },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: isOperator ? 330 : 360,
      sortable: false,
      filterable: false,
      renderCell: (params) =>
        isOperator ? (
          <OperatorFactoryActions
            row={params.row}
            onOpenRequestForm={onOpenRequestForm}
          />
        ) : (
          <OfficerFactoryActions status={params.row.status} />
        ),
    },
  ]
}

function ReadOnlyField({ label, value, sx }) {
  return (
    <TextField
      label={label}
      value={value}
      size="small"
      fullWidth
      slotProps={{
        input: {
          readOnly: true,
        },
      }}
      sx={sx}
    />
  )
}

function UploadFileField({ label, accept }) {
  const [fileName, setFileName] = useState('')

  return (
    <Stack spacing={0.75}>
      <Button
        component="label"
        variant="outlined"
        size="small"
        fullWidth
        startIcon={<UploadFileIcon />}
        sx={{
          minHeight: 40,
          justifyContent: 'flex-start',
          borderStyle: 'dashed',
          color: fileName ? 'text.primary' : 'text.secondary',
          bgcolor: 'background.paper',
          '&:hover': {
            borderStyle: 'dashed',
            bgcolor: 'primary.50',
          },
        }}
      >
        {fileName || label}
        <Box
          component="input"
          type="file"
          accept={accept}
          hidden
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')}
        />
      </Button>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  )
}

function ParameterMultiSelect({ label }) {
  const [value, setValue] = useState([])

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
          setValue(typeof selectedValue === 'string' ? selectedValue.split(',') : selectedValue)
        }}
        renderValue={(selected) => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selected.map((item) => (
              <Chip key={item} label={item} size="small" />
            ))}
          </Box>
        )}
      >
        {cemsParameterOptions.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

function CemsMonitoringPointDetails() {
  const [stackShape, setStackShape] = useState('')
  const [primaryFuel, setPrimaryFuel] = useState('')
  const [secondaryFuel, setSecondaryFuel] = useState('')
  const [hasTreatmentSystem, setHasTreatmentSystem] = useState('')
  const [treatmentSystem, setTreatmentSystem] = useState('')
  const [connectionDevice, setConnectionDevice] = useState('')

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="รหัสจุดตรวจวัด" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ชื่อจุดตรวจวัด" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ประเภทของหน่วยการผลิต" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="กำลังการผลิตต่อหน่วย" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField select label="เข้าข่ายต้องติดตั้ง CEMS ตามกฎหมาย" size="small" fullWidth defaultValue="">
            <MenuItem value="">-</MenuItem>
            <MenuItem value="ประกาศ อก.">ประกาศ อก.</MenuItem>
            <MenuItem value="กกพ.">กกพ.</MenuItem>
            <MenuItem value="กทม.">กทม.</MenuItem>
            <MenuItem value="อื่นๆ">อื่นๆ</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="อื่นๆ โปรดระบุ" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField select label="เข้าข่ายตามบัญชีแนบท้ายลำดับที่" size="small" fullWidth defaultValue="">
            <MenuItem value="">-</MenuItem>
            <MenuItem value="เฉพาะประกาศปี 65">เฉพาะประกาศปี 65</MenuItem>
            <MenuItem value="กทม.">กทม.</MenuItem>
          </TextField>
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect label="พารามิเตอร์ที่เข้าข่าย" />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect label="พารามิเตอร์ที่ได้รับการยกเว้น" />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect label="พารามิเตอร์ที่เชื่อมต่อแล้ว" />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect label="พารามิเตอร์ที่ยังไม่เชื่อมต่อ" />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            select
            label="ลักษณะปล่อง"
            size="small"
            fullWidth
            value={stackShape}
            onChange={(event) => setStackShape(event.target.value)}
          >
            <MenuItem value="">-</MenuItem>
            <MenuItem value="วงกลม">วงกลม</MenuItem>
            <MenuItem value="สี่เหลี่ยม">สี่เหลี่ยม</MenuItem>
            <MenuItem value="อื่นๆ">อื่นๆ</MenuItem>
          </TextField>
        </Grid>
        {stackShape === 'วงกลม' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField label="เส้นผ่านศูนย์กลาง (เมตร)" size="small" fullWidth />
          </Grid>
        ) : null}
        {stackShape === 'สี่เหลี่ยม' ? (
          <>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField label="กว้าง (เมตร)" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField label="ยาว (เมตร)" size="small" fullWidth />
            </Grid>
          </>
        ) : null}
        {stackShape === 'อื่นๆ' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField label="โปรดระบุ" size="small" fullWidth />
          </Grid>
        ) : null}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ความสูงปล่อง (เมตร)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ความสูงของจุดตรวจวัด (เมตร)" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="อัตราการระบายอากาศเฉลี่ย (m³/hr)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="อัตราการระบายอากาศต่ำสุด (m³/hr)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="อัตราการระบายอากาศสูงสุด (m³/hr)" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            select
            label="เชื้อเพลิงหลักที่ใช้"
            size="small"
            fullWidth
            value={primaryFuel}
            onChange={(event) => setPrimaryFuel(event.target.value)}
          >
            <MenuItem value="">-</MenuItem>
            <MenuItem value="ก๊าซธรรมชาติ">ก๊าซธรรมชาติ</MenuItem>
            <MenuItem value="น้ำมันเตา">น้ำมันเตา</MenuItem>
            <MenuItem value="ถ่านหิน">ถ่านหิน</MenuItem>
            <MenuItem value="ชีวมวล">ชีวมวล</MenuItem>
            <MenuItem value="อื่นๆ">อื่นๆ</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="โปรดระบุ" size="small" fullWidth disabled={primaryFuel !== 'อื่นๆ'} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ร้อยละโดยประมาณ" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            select
            label="เชื้อเพลิงรอง (ถ้ามี)"
            size="small"
            fullWidth
            value={secondaryFuel}
            onChange={(event) => setSecondaryFuel(event.target.value)}
          >
            <MenuItem value="">-</MenuItem>
            <MenuItem value="ไม่มี">ไม่มี</MenuItem>
            <MenuItem value="ก๊าซธรรมชาติ">ก๊าซธรรมชาติ</MenuItem>
            <MenuItem value="น้ำมันเตา">น้ำมันเตา</MenuItem>
            <MenuItem value="ถ่านหิน">ถ่านหิน</MenuItem>
            <MenuItem value="ชีวมวล">ชีวมวล</MenuItem>
            <MenuItem value="อื่นๆ">อื่นๆ</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="โปรดระบุ" size="small" fullWidth disabled={secondaryFuel !== 'อื่นๆ'} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ร้อยละโดยประมาณ" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ระบบการควบคุมปริมาณอากาศและสภาวะการเผาไหม้" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            select
            label="ระบบบำบัด"
            size="small"
            fullWidth
            value={hasTreatmentSystem}
            onChange={(event) => setHasTreatmentSystem(event.target.value)}
          >
            <MenuItem value="">-</MenuItem>
            <MenuItem value="ไม่มี">ไม่มี</MenuItem>
            <MenuItem value="มี">มี</MenuItem>
          </TextField>
        </Grid>
        {hasTreatmentSystem === 'มี' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              select
              label="ระบุระบบบำบัด"
              size="small"
              fullWidth
              value={treatmentSystem}
              onChange={(event) => setTreatmentSystem(event.target.value)}
            >
              <MenuItem value="">-</MenuItem>
              <MenuItem value="ระบบดักจับฝุ่น">ระบบดักจับฝุ่น</MenuItem>
              <MenuItem value="สครับเบอร์">สครับเบอร์</MenuItem>
              <MenuItem value="ถุงกรอง">ถุงกรอง</MenuItem>
              <MenuItem value="อื่นๆ">อื่นๆ</MenuItem>
            </TextField>
          </Grid>
        ) : null}
        {hasTreatmentSystem === 'มี' && treatmentSystem === 'อื่นๆ' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField label="ระบุรายละเอียดของระบบบำบัด" size="small" fullWidth />
          </Grid>
        ) : null}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="พิกัดปล่องที่ติดตั้ง CEMS (ละติจูด)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="พิกัดปล่องที่ติดตั้ง CEMS (ลองติจูด)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            select
            label="อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ"
            size="small"
            fullWidth
            value={connectionDevice}
            onChange={(event) => setConnectionDevice(event.target.value)}
          >
            <MenuItem value="">-</MenuItem>
            <MenuItem value="POMS Box (กรอ.)">POMS Box (กรอ.)</MenuItem>
            <MenuItem value="POMS Box (กนอ.)">POMS Box (กนอ.)</MenuItem>
            <MenuItem value="POMS Client (เดิม)">POMS Client (เดิม)</MenuItem>
            <MenuItem value="POMS Client (ใหม่)">POMS Client (ใหม่)</MenuItem>
            <MenuItem value="อื่นๆ">อื่นๆ</MenuItem>
          </TextField>
        </Grid>
        {connectionDevice === 'อื่นๆ' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField label="โปรดระบุ" size="small" fullWidth />
          </Grid>
        ) : null}
      </Grid>
    </Stack>
  )
}

function DocumentsAndImagesSection() {
  const groupedItems = documentImageItems.filter((item) => groupedDocumentImageTitles.includes(item.title))
  const standaloneItems = documentImageItems.filter((item) => !groupedDocumentImageTitles.includes(item.title))

  return (
    <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
      <Stack spacing={2.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          เอกสารและรูปภาพ
        </Typography>
        {standaloneItems.map((item) => (
          <Stack key={item.title} spacing={1.5}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {item.title}
              </Typography>
              {item.description ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {item.description}
                </Typography>
              ) : null}
            </Box>
            <Grid container spacing={2}>
              {item.hasLink ? (
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="Link" size="small" fullWidth />
                </Grid>
              ) : null}
              <Grid size={{ xs: 12, md: 3 }}>
                <UploadFileField label={item.uploadLabel} accept={item.accept} />
              </Grid>
            </Grid>
          </Stack>
        ))}
        <Grid container spacing={2}>
          {groupedItems.map((item) => (
            <Grid key={item.title} size={{ xs: 12, md: 3 }}>
              <Stack spacing={1.5}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {item.title}
                </Typography>
                <UploadFileField label={item.uploadLabel} accept={item.accept} />
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Paper>
  )
}

function WpmsMonitoringPointDetails() {
  const [hasTreatmentSystem, setHasTreatmentSystem] = useState('')
  const [connectionDevice, setConnectionDevice] = useState('')

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="รหัสจุดตรวจวัด" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ชื่อจุดตรวจวัด" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="อัตราการระบายน้ำทิ้งเฉลี่ย (m³/d)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="อัตราการระบายน้ำทิ้งต่ำสุด (m³/d)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="อัตราการระบายน้ำทิ้งสูงสุด (m³/d)" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            select
            label="ระบบบำบัด"
            size="small"
            fullWidth
            value={hasTreatmentSystem}
            onChange={(event) => setHasTreatmentSystem(event.target.value)}
          >
            <MenuItem value="">-</MenuItem>
            <MenuItem value="ไม่มี">ไม่มี</MenuItem>
            <MenuItem value="มี">มี</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ระบุ" size="small" fullWidth />
        </Grid>
        {hasTreatmentSystem === 'มี' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField label="ปริมาณรองรับน้ำเสียสูงสุดของระบบบำบัด" size="small" fullWidth />
          </Grid>
        ) : null}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="พิกัดจุดติดตั้งเครื่องมือตรวจวัด (ละติจูด)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="พิกัดจุดติดตั้งเครื่องมือตรวจวัด (ลองติจูด)" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="แหล่งกำเนิดน้ำเสีย" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="แหล่งรองรับน้ำทิ้ง" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            select
            label="อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ"
            size="small"
            fullWidth
            value={connectionDevice}
            onChange={(event) => setConnectionDevice(event.target.value)}
          >
            <MenuItem value="">-</MenuItem>
            <MenuItem value="POMS Box (กรอ.)">POMS Box (กรอ.)</MenuItem>
            <MenuItem value="POMS Box (กนอ.)">POMS Box (กนอ.)</MenuItem>
            <MenuItem value="POMS Client (เดิม)">POMS Client (เดิม)</MenuItem>
            <MenuItem value="POMS Client (ใหม่)">POMS Client (ใหม่)</MenuItem>
            <MenuItem value="อื่นๆ">อื่นๆ</MenuItem>
          </TextField>
        </Grid>
        {connectionDevice === 'อื่นๆ' ? (
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField label="โปรดระบุ" size="small" fullWidth />
          </Grid>
        ) : null}
      </Grid>
    </Stack>
  )
}

function MobileMonitoringPointDetails() {
  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="รหัสหน่วยตรวจวัด" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ชื่อหน่วยตรวจวัด" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="หมายเลขเครื่องมือ/อุปกรณ์" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ผู้รับผิดชอบหน่วยตรวจวัด" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect label="พารามิเตอร์ที่ตรวจวัด" />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ" size="small" fullWidth />
        </Grid>
      </Grid>
    </Stack>
  )
}

function StationMonitoringPointDetails() {
  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="รหัสสถานีตรวจวัด" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ชื่อสถานีตรวจวัด" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="ประเภทสถานี" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="พื้นที่ติดตั้งสถานี" size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="พิกัดสถานี (ละติจูด)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="พิกัดสถานี (ลองติจูด)" size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <ParameterMultiSelect label="พารามิเตอร์ที่ตรวจวัด" />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField label="อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ" size="small" fullWidth />
        </Grid>
      </Grid>
    </Stack>
  )
}

function MonitoringPointDetails({ point }) {
  if (point.type === 'CEMS') {
    return <CemsMonitoringPointDetails />
  }
  if (point.type === 'WPMS') {
    return <WpmsMonitoringPointDetails />
  }
  if (point.type === 'Mobile') {
    return <MobileMonitoringPointDetails />
  }
  return <StationMonitoringPointDetails />
}

function RequestFormBottomSheet({ open, formType, factory, onClose }) {
  const [contacts, setContacts] = useState([{ id: 1 }])
  const [factoryEmails, setFactoryEmails] = useState([{ id: 1, value: 'factory@company.com' }])
  const [monitoringPoints, setMonitoringPoints] = useState([])
  const [selectedMonitoringPointId, setSelectedMonitoringPointId] = useState(null)
  const officerEmails = ['officer@poms.go.th']
  const showMonitoringPointSection = ['เชื่อมต่อใหม่', 'เพิ่มจุดตรวจวัด'].includes(formType)
  const isSingleMonitoringPointForm = formType === 'เพิ่มจุดตรวจวัด'
  const selectedMonitoringPoint = monitoringPoints.find((point) => point.id === selectedMonitoringPointId)
    ?? monitoringPoints[0]

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
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ width: 40 }} />
          <Typography variant="h6" component="h2" fontWeight={700}>
            แบบฟอร์มคำขอ {formType}
          </Typography>
          <IconButton aria-label="ปิด" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Divider />

        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: { xs: 2, md: 3 }, bgcolor: 'background.default' }}>
          <Stack spacing={2}>
            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
              <Stack spacing={2}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  ข้อมูลทั่วไปของโรงงาน
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ReadOnlyField label="ชื่อโรงงาน" value={factory?.factoryName ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="เลขทะเบียนโรงงาน (เดิม)" value={factory?.oldRegistrationNo ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="เลขทะเบียนโรงงาน (ใหม่)" value={factory?.newRegistrationNo ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ReadOnlyField label="ลำดับประเภทโรงงาน (หลัก)" value={factory?.industryMainOrder ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ReadOnlyField label="ลำดับประเภทโรงงาน (รอง)" value={factory?.industrySubOrder ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ReadOnlyField label="การประกอบกิจการ" value={factory?.businessActivity ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Box
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        minHeight: 40,
                      }}
                    >
                      <RadioGroup row value={factory?.eia ?? 'ไม่มี'}>
                        <FormControlLabel
                          value="มี"
                          control={<Radio size="small" />}
                          label="มีการประเมินผลกระทบสิ่งแวดล้อม (EIA)"
                          disabled
                        />
                        <FormControlLabel value="ไม่มี" control={<Radio size="small" />} label="ไม่มี" disabled />
                      </RadioGroup>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="ชื่อโครงการ" value={factory?.projectName ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ReadOnlyField label="สถานที่ตั้งโรงงาน" value={factory?.address ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="ละติจูด" value={factory?.latitude ?? ''} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <ReadOnlyField label="ลองติจูด" value={factory?.longitude ?? ''} />
                  </Grid>
                </Grid>
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
              <Stack spacing={2}>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    ผู้ติดต่อประสานงาน
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setContacts((current) => [...current, { id: Date.now() }])}
                  >
                    เพิ่มข้อมูล
                  </Button>
                </Stack>
                {contacts.map((contact) => (
                  <Grid
                    container
                    spacing={2}
                    key={contact.id}
                  >
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField label="ชื่อ-นามสกุล" size="small" fullWidth />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField label="ตำแหน่ง" size="small" fullWidth />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField label="เบอร์โทร" size="small" fullWidth />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField label="อีเมล" size="small" fullWidth />
                    </Grid>
                  </Grid>
                ))}
              </Stack>
            </Paper>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', height: '100%' }}>
                <Stack spacing={2}>
                  <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      อีเมลสำหรับแจ้งเตือนโรงงาน
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() =>
                        setFactoryEmails((current) => [...current, { id: Date.now(), value: '' }])
                      }
                    >
                      เพิ่มข้อมูล
                    </Button>
                  </Stack>
                  {factoryEmails.map((email) => (
                    <TextField
                      key={email.id}
                      label="อีเมล"
                      type="email"
                      size="small"
                      defaultValue={email.value}
                      fullWidth
                    />
                  ))}
                </Stack>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', height: '100%' }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    อีเมลสำหรับแจ้งเตือนเจ้าหน้าที่
                  </Typography>
                  {officerEmails.map((email) => (
                    <ReadOnlyField key={email} label="อีเมล" value={email} />
                  ))}
                </Stack>
                </Paper>
              </Grid>
            </Grid>

            {showMonitoringPointSection ? (
              <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    จุดตรวจวัด
                  </Typography>
                  {isSingleMonitoringPointForm ? (
                    <RadioGroup
                      row
                      value={selectedMonitoringPoint?.type ?? ''}
                      onChange={(event) => {
                        const nextPoint = {
                          id: selectedMonitoringPoint?.id ?? Date.now(),
                          type: event.target.value,
                        }
                        setMonitoringPoints([nextPoint])
                        setSelectedMonitoringPointId(nextPoint.id)
                      }}
                    >
                      {monitoringPointTypeOptions.map((type) => (
                        <FormControlLabel
                          key={type}
                          value={type}
                          control={<Radio size="small" />}
                          label={type}
                        />
                      ))}
                    </RadioGroup>
                  ) : (
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                      {monitoringPoints.map((point, index) => (
                        <Chip
                          key={point.id}
                          label={`${point.type} จุดที่ ${index + 1}`}
                          color={point.id === selectedMonitoringPoint?.id ? 'primary' : 'default'}
                          variant={point.id === selectedMonitoringPoint?.id ? 'filled' : 'outlined'}
                          clickable
                          onClick={() => setSelectedMonitoringPointId(point.id)}
                          onDelete={() => {
                            setMonitoringPoints((current) => current.filter((item) => item.id !== point.id))
                            setSelectedMonitoringPointId((current) => (current === point.id ? null : current))
                          }}
                        />
                      ))}
                      <MenuButton
                        label="+ เพิ่มจุดตรวจวัด"
                        options={monitoringPointTypeOptions}
                        onSelect={(type) => {
                          const nextPoint = { id: Date.now(), type }
                          setMonitoringPoints((current) => [...current, nextPoint])
                          setSelectedMonitoringPointId(nextPoint.id)
                        }}
                      />
                    </Stack>
                  )}
                </Stack>
              </Paper>
            ) : null}

            {showMonitoringPointSection && monitoringPoints.length > 0 ? (
              <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    รายละเอียดจุดตรวจวัด
                  </Typography>
                  {monitoringPoints.map((point) => (
                    <Box key={point.id} sx={{ display: point.id === selectedMonitoringPoint?.id ? 'block' : 'none' }}>
                      <MonitoringPointDetails point={point} />
                    </Box>
                  ))}
                </Stack>
              </Paper>
            ) : null}

            {showMonitoringPointSection && monitoringPoints.length > 0
              ? monitoringPoints.map((point) =>
                  point.type === 'CEMS' ? (
                    <Box key={point.id} sx={{ display: point.id === selectedMonitoringPoint?.id ? 'block' : 'none' }}>
                    <DocumentsAndImagesSection />
                  </Box>
                  ) : null,
                )
              : null}
          </Stack>
        </Box>
      </Stack>
    </Drawer>
  )
}

function getRequestColumns(isOperator) {
  return [
    { field: 'factoryName', headerName: 'ชื่อโรงงาน/บริษัท', width: 240 },
    { field: 'industryType', headerName: 'ประเภทอุตสาหกรรม', width: 170 },
    { field: 'province', headerName: 'จังหวัด', width: 130 },
    { field: 'type', headerName: 'ประเภท', width: 150 },
    { field: 'requestNo', headerName: 'เลขที่คำขอ', width: 150 },
    { field: 'submittedDate', headerName: 'วันที่ยื่นคำขอ', width: 150 },
    { field: 'monitoringPointCode', headerName: 'รหัสจุดตรวจวัด', width: 170 },
    { field: 'codeIssuedDate', headerName: 'วันที่ออกรหัส', width: 150 },
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
      width: isOperator ? 270 : 130,
      sortable: false,
      filterable: false,
      renderCell: (params) =>
        isOperator ? <OperatorRequestActions status={params.row.status} /> : <OfficerRequestActions />,
    },
  ]
}

function ConnectionRequestPage({ userType = '' }) {
  const [selectedSubMenu, setSelectedSubMenu] = useState('factories')
  const [requestForm, setRequestForm] = useState(null)
  const isOperator = userType === 'operator'
  const factoryColumns = useMemo(
    () => getFactoryColumns(isOperator, (factory, formType) => setRequestForm({ factory, formType })),
    [isOperator],
  )
  const requestColumns = useMemo(() => getRequestColumns(isOperator), [isOperator])
  const table = useMemo(
    () =>
      selectedSubMenu === 'factories'
        ? {
            title: 'รายชื่อโรงงาน',
            rows: factoryRows,
            columns: factoryColumns,
          }
        : {
            title: 'รายการคำขอ',
            rows: requestRows,
            columns: requestColumns,
          },
    [factoryColumns, requestColumns, selectedSubMenu],
  )

  return (
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
            ขอเชื่อมต่อ
          </Typography>
          <Tabs
            value={selectedSubMenu}
            onChange={(_, value) => setSelectedSubMenu(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 40,
              '& .MuiTab-root': {
                minHeight: 40,
              },
            }}
          >
            {subMenus.map((menu) => (
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
          rows={table.rows}
          columns={table.columns}
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
      <RequestFormBottomSheet
        open={Boolean(requestForm)}
        formType={requestForm?.formType ?? ''}
        factory={requestForm?.factory}
        onClose={() => setRequestForm(null)}
      />
    </Stack>
  )
}

export default ConnectionRequestPage
