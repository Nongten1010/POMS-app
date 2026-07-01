import { useMemo, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
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
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import HistoryIcon from '@mui/icons-material/History'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { DataGrid } from '@mui/x-data-grid'
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs from 'dayjs'
import buddhistEra from 'dayjs/plugin/buddhistEra'
import 'dayjs/locale/th'
import OfficerStatisticsPanel from '../components/OfficerStatisticsPanel'

dayjs.extend(buddhistEra)
dayjs.locale('th')

const appBarHeight = {
  xs: 64,
  md: 72,
}

const operatorSubMenus = [
  { value: 'factories', label: 'รายชื่อโรงงาน' },
  { value: 'requests', label: 'รายการคำขอ', badgeContent: 1 },
]

const officerSubMenus = [
  { value: 'requests', label: 'รายการคำขอ', badgeContent: 1 },
  { value: 'statistics', label: 'สถิติข้อมูล' },
]

const factoryRows = [
  {
    id: 1,
    factoryName: 'บริษัท ปูนซีเมนต์นครหลวง จำกัด (มหาชน)',
    newRegistrationNo: '10190000225448',
    oldRegistrationNo: '3-101-2/44สบ',
    industryType: '',
    province: 'สระบุรี',
    monitoringPointCount: 2,
  },
  {
    id: 2,
    factoryName: 'บริษัท ปูนซีเมนต์นครหลวง จำกัด (มหาชน)',
    newRegistrationNo: '10190000325446',
    oldRegistrationNo: '3-101-3/44สบ',
    industryType: '',
    province: 'สระบุรี',
    monitoringPointCount: 0,
  },
  {
    id: 3,
    factoryName: 'บริษัท ปูนซีเมนต์นครหลวง จำกัด (มหาชน)',
    newRegistrationNo: '10190000125572',
    oldRegistrationNo: '3-101-1/57สบ',
    industryType: '',
    province: 'สระบุรี',
    monitoringPointCount: 0,
  },
  {
    id: 4,
    factoryName: 'บริษัท อินทรี อีโคไซเคิล จำกัด',
    newRegistrationNo: '10190003325500',
    oldRegistrationNo: '3-106-33/50สบ',
    industryType: '',
    province: 'สระบุรี',
    monitoringPointCount: 0,
  },
  {
    id: 5,
    factoryName: 'บริษัท อินทรี อีโคไซเคิล จำกัด',
    newRegistrationNo: '72080000125562',
    oldRegistrationNo: 'น.106-1/2556-จบหช.',
    industryType: '',
    province: 'สุพรรณบุรี',
    monitoringPointCount: 0,
  },
  {
    id: 6,
    factoryName: 'บริษัท อินทรี อีโคไซเคิล จำกัด',
    newRegistrationNo: '10900179425649',
    oldRegistrationNo: '3-106-13/64สบ',
    industryType: '',
    province: 'สงขลา',
    monitoringPointCount: 0,
  },
  {
    id: 7,
    factoryName: 'บริษัท อินทรี อีโคไซเคิล จำกัด',
    newRegistrationNo: '10900061425657',
    oldRegistrationNo: '3-105-35/65สบ',
    industryType: '',
    province: 'สงขลา',
    monitoringPointCount: 0,
  },
]
const monitoringPointRowsByFactoryId = {
  1: [
    {
      id: 1,
      code: 'SO002',
      name: 'ปล่องระบาย A',
      type: 'STACK',
      parameters: 'NOx (ppm)',
      status: 'เชื่อมต่อแล้ว',
    },
    {
      id: 2,
      code: 'SO001',
      name: 'ปล่องระบาย A',
      type: 'STACK',
      parameters: 'CO (ppm), NOx (ppm), Temp. (°C), O2 (%), Flow (m³/hr)',
      status: 'เชื่อมต่อแล้ว',
    },
  ],
}

const requestRows = [
  {
    id: 'kwp-request-1',
    factoryName: 'บริษัท ปูนซีเมนต์นครหลวง จำกัด (มหาชน)',
    factoryRegistration: '10190000225448',
    industryType: '10100 / 3',
    factoryAddress: '9 หมู่ 9 ถนนมิตรภาพ ตำบลทับกวาง อำเภอแก่งคอย สระบุรี',
    province: 'สระบุรี',
    type: 'CEMS',
    monitoringPointCode: 'S0001',
    monitoringPointName: 'ปล่องระบาย A',
    requestNo: 'KWP-69-00001',
    form: 'กวภ.01',
    submittedDate: '15/06/2569',
    reviewedDate: '-',
    status: 'รอพิจารณา',
    statusHistory: [
      {
        id: 'kwp-request-1-history-1',
        statusLabel: 'รอพิจารณา',
        note: 'ผู้ประกอบการส่งแบบฟอร์ม กวภ.01 เพื่อให้เจ้าหน้าที่ตรวจสอบ',
        changedAt: '15/06/2569',
        durationText: 'อยู่ระหว่างดำเนินการ',
        changedBy: 'บริษัท ปูนซีเมนต์นครหลวง จำกัด (มหาชน)',
      },
    ],
  },
  {
    id: 'kwp-request-2',
    factoryName: 'บริษัท ปูนซีเมนต์นครหลวง จำกัด (มหาชน)',
    factoryRegistration: '10190000325446',
    industryType: '10100 / 3',
    factoryAddress: '22 หมู่ 3 ถนนมิตรภาพ ตำบลทับกวาง อำเภอแก่งคอย สระบุรี',
    province: 'สระบุรี',
    type: 'CEMS',
    monitoringPointCode: 'S0002',
    monitoringPointName: 'ปล่องระบาย B',
    requestNo: 'KWP-69-00002',
    form: 'กวภ.02',
    submittedDate: '14/06/2569',
    reviewedDate: '15/06/2569',
    status: 'รอโรงงานแก้ไข',
    revisionNote: 'กรุณาแนบเอกสารประกอบเพิ่มเติม และตรวจสอบรายละเอียดผลการตรวจวัดให้ครบถ้วน',
    statusHistory: [
      {
        id: 'kwp-request-2-history-1',
        statusLabel: 'รอพิจารณา',
        note: 'ผู้ประกอบการส่งแบบฟอร์ม กวภ.02 พร้อมเอกสารประกอบ',
        changedAt: '14/06/2569',
        durationText: '1 วัน',
        changedBy: 'บริษัท ปูนซีเมนต์นครหลวง จำกัด (มหาชน)',
      },
      {
        id: 'kwp-request-2-history-2',
        statusLabel: 'รอโรงงานแก้ไข',
        note: 'กรุณาแนบเอกสารประกอบเพิ่มเติม และตรวจสอบรายละเอียดผลการตรวจวัดให้ครบถ้วน',
        changedAt: '15/06/2569',
        durationText: 'อยู่ระหว่างดำเนินการ',
        changedBy: 'เจ้าหน้าที่ ก',
      },
    ],
  },
  {
    id: 'kwp-request-3',
    factoryName: 'บริษัท อินทรี อีโคไซเคิล จำกัด',
    factoryRegistration: '72080000125562',
    industryType: '10600 / 3',
    factoryAddress: '55 หมู่ 2 ตำบลสระแก้ว อำเภอเมืองสุพรรณบุรี สุพรรณบุรี',
    province: 'สุพรรณบุรี',
    type: 'WPMS',
    monitoringPointCode: 'P0001',
    monitoringPointName: 'จุดระบายน้ำทิ้ง A',
    requestNo: 'KWP-69-00003',
    form: 'กวภ.03',
    submittedDate: '13/06/2569',
    reviewedDate: '14/06/2569',
    status: 'ยื่นแบบสำเร็จ',
    statusHistory: [
      {
        id: 'kwp-request-3-history-1',
        statusLabel: 'รอพิจารณา',
        note: 'ผู้ประกอบการส่งแบบฟอร์ม กวภ.03',
        changedAt: '13/06/2569',
        durationText: '1 วัน',
        changedBy: 'บริษัท อินทรี อีโคไซเคิล จำกัด',
      },
      {
        id: 'kwp-request-3-history-2',
        statusLabel: 'ผ่านการพิจารณา',
        note: 'เจ้าหน้าที่ตรวจสอบข้อมูลและเอกสารประกอบครบถ้วน',
        changedAt: '14/06/2569',
        durationText: '1 วัน',
        changedBy: 'เจ้าหน้าที่ ก',
      },
      {
        id: 'kwp-request-3-history-3',
        statusLabel: 'ยื่นแบบสำเร็จ',
        note: 'ระบบบันทึกผลการพิจารณาเรียบร้อยแล้ว',
        changedAt: '14/06/2569',
        changedBy: 'ระบบ',
      },
    ],
  },
  {
    id: 'kwp-request-4',
    factoryName: 'บริษัท ปูนซีเมนต์นครหลวง จำกัด (มหาชน)',
    factoryRegistration: '10190000425445',
    industryType: '10100 / 3',
    factoryAddress: '88 หมู่ 7 ถนนมิตรภาพ ตำบลทับกวาง อำเภอแก่งคอย สระบุรี',
    province: 'สระบุรี',
    type: 'CEMS',
    monitoringPointCode: 'S0004',
    monitoringPointName: 'ปล่องระบาย C',
    requestNo: 'KWP-69-00004',
    form: 'กวภ.04',
    submittedDate: '12/06/2569',
    reviewedDate: '16/06/2569',
    status: 'ผ่านการพิจารณา',
    statusHistory: [
      {
        id: 'kwp-request-4-history-1',
        statusLabel: 'รอพิจารณา',
        note: 'ผู้ประกอบการส่งแบบฟอร์ม กวภ.04 พร้อมรายงานผลการตรวจวัด',
        changedAt: '12/06/2569',
        durationText: '4 วัน',
        changedBy: 'บริษัท ปูนซีเมนต์นครหลวง จำกัด (มหาชน)',
      },
      {
        id: 'kwp-request-4-history-2',
        statusLabel: 'ผ่านการพิจารณา',
        note: 'ตรวจสอบข้อมูลผลการตรวจวัดและเอกสารแนบถูกต้องครบถ้วน',
        changedAt: '16/06/2569',
        changedBy: 'เจ้าหน้าที่ ก',
      },
    ],
  },
  {
    id: 'kwp-request-5',
    factoryName: 'บริษัท เซาท์เทิร์นเพาเวอร์ จำกัด',
    factoryRegistration: '90140000225610',
    industryType: '08800 / 2',
    factoryAddress: '11 หมู่ 5 ตำบลบางปูใหม่ อำเภอเมืองสมุทรปราการ สมุทรปราการ',
    province: 'สมุทรปราการ',
    type: 'CEMS',
    monitoringPointCode: 'S0005',
    monitoringPointName: 'ปล่องระบายหลัก',
    requestNo: 'KWP-69-00005',
    form: 'กวภ.05',
    submittedDate: '10/06/2569',
    reviewedDate: '17/06/2569',
    status: 'รอพิจารณา',
    statusHistory: [
      {
        id: 'kwp-request-5-history-1',
        statusLabel: 'รอพิจารณา',
        note: 'ผู้ประกอบการส่งแบบฟอร์ม กวภ.05 รายงานผลการสอบเทียบหรือทวนสอบ CEMS',
        changedAt: '10/06/2569',
        durationText: 'อยู่ระหว่างดำเนินการ',
        changedBy: 'บริษัท เซาท์เทิร์นเพาเวอร์ จำกัด',
      },
    ],
  },
]

const kwpFormOptions = [
  {
    code: 'กวภ.01',
    title: 'แบบแจ้งเหตุขัดข้องของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ',
    description: 'เพื่อรายงานมลพิษอากาศจากปล่องโรงงานหรือแจ้งหยุดหน่วยการผลิต',
  },
  {
    code: 'กวภ.02',
    title: 'แบบรายงานผลการตรวจวัดมลพิษอากาศจากปล่องระบาย',
    description: 'กรณีเครื่องมือหรือเครื่องอุปกรณ์พิเศษมีเหตุขัดข้องและไม่สามารถรายงานผลการตรวจวัดได้ตั้งแต่ 15 วันขึ้นไป',
  },
  {
    code: 'กวภ.03',
    title: 'แบบแจ้งเหตุขัดข้องหรือหยุดส่งข้อมูลการตรวจวัดมลพิษทางนํ้าแบบอัตโนมัติอย่างต่อเนื่อง (WPMS)',
    description: '',
  },
  {
    code: 'กวภ.04',
    title: 'แบบรายงานผลการตรวจวัดมลพิษอากาศจากปล่องระบาย',
    description: 'ตามประกาศฯข้อ =4(1) (2) 11(3) และ 16',
  },
  {
    code: 'กวภ.05',
    title: 'แบบรายงานผลการสอบเทียบหรือทวนสอบระบบตรวจวัดคุณภาพอากาศแบบอัตโนมัติอย่างต่อเนื่อง (CEMS)',
    description: '',
  },
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

const wpmsInstrumentOptions = [
  'ค่าบีโอดี (BOD)',
  'ค่าซีโอดี (COD)',
  'ค่าบีโอดี (BOD) และ ค่าซีโอดี (COD)',
]

const wpmsMeasurementTimeOptions = ['Real Time', '5 นาที', '10 นาที', '15 นาที', '20 นาที', '30 นาที']
const wpmsParameterOptions = ['BOD', 'COD', 'flow', 'watt']
const wpmsIssueReasonOptions = [
  'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง',
  'ไม่มีการระบายน้ำทิ้งออกนอกโรงงาน',
  'ระบบรับส่งข้อมูล ระบบไฟฟ้า อินเทอร์เน็ต ขัดข้อง',
]
const calibrationResultOptions = ['ผ่าน', 'ไม่ผ่าน']

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

function FactoryActions({ row, onOpenMonitoringPoints }) {
  return (
    <Stack direction="row" spacing={1} sx={tableActionStackSx}>
      <Button size="small" variant="outlined" onClick={() => onOpenMonitoringPoints?.(row)}>
        รายละเอียดจุดตรวจวัด
      </Button>
    </Stack>
  )
}

function RequestActions({ row, isOperator, onOpenDocument }) {
  const cannotProcess = ['ยื่นแบบสำเร็จ', 'รอโรงงานแก้ไข'].includes(row.status)
  const canOperatorModify = row.status === 'รอโรงงานแก้ไข'

  if (isOperator) {
    return (
      <Stack direction="row" spacing={1} sx={tableActionStackSx}>
        <Button size="small" variant="outlined" onClick={() => onOpenDocument?.(row, 'view')}>
          เปิดดู
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!canOperatorModify}
          onClick={() => onOpenDocument?.(row, 'edit')}
        >
          แก้ไข
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="error"
          disabled={!canOperatorModify}
          onClick={() => onOpenDocument?.(row, 'cancel')}
        >
          ยกเลิก
        </Button>
      </Stack>
    )
  }

  return (
    <Stack direction="row" spacing={1} sx={tableActionStackSx}>
      <Button size="small" variant="outlined" onClick={() => onOpenDocument?.(row, 'view')}>
        เปิดดู
      </Button>
      <Button
        size="small"
        variant="contained"
        disabled={cannotProcess}
        onClick={() => onOpenDocument?.(row, 'review')}
      >
        ดำเนินการ
      </Button>
    </Stack>
  )
}

function FormSelectionMenu({ factory, point, onSelectForm }) {
  const [anchorEl, setAnchorEl] = useState(null)
  const isOpen = Boolean(anchorEl)

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        endIcon={<KeyboardArrowDownIcon />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        เลือกแบบฟอร์ม
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={() => setAnchorEl(null)}
        slotProps={{
          paper: {
            sx: { maxWidth: 520 },
          },
        }}
      >
        {kwpFormOptions.map((option) => {
          const fullTitle = `${option.code} ${option.title}`

          return (
            <MenuItem
              key={option.code}
              onClick={() => {
                onSelectForm?.({
                  title: fullTitle,
                  code: option.code,
                  titleText: option.title,
                  description: option.description,
                  factory,
                  point,
                })
                setAnchorEl(null)
              }}
              sx={{ alignItems: 'flex-start', whiteSpace: 'normal', py: 1.25 }}
            >
              <Stack spacing={0.25}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {option.code}
                </Typography>
                <Typography variant="body2">
                  {option.title}
                </Typography>
                {option.description ? (
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                    {option.description}
                  </Typography>
                ) : null}
              </Stack>
            </MenuItem>
          )
        })}
      </Menu>
    </>
  )
}

function MonitoringPointDialog({ factory, open, onClose, onSelectForm }) {
  const rows = factory ? (monitoringPointRowsByFactoryId[factory.id] ?? []) : []
  const factoryTitle = factory?.factoryName
    ? `รายการจุดตรวจวัด - ${factory.factoryName}${factory.monitoringPointCount ? ` โรงงาน ${factory.monitoringPointCount}` : ''}`
    : 'รายการจุดตรวจวัด'

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
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
          {factoryTitle}
        </Typography>
        <IconButton aria-label="ปิด" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <TableContainer sx={{ border: 1, borderColor: 'divider', overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 1040, ...borderedTableSx }}>
            <TableHead>
              <TableRow>
                {[
                  'รหัสจุดตรวจวัด',
                  'ชื่อจุดตรวจวัด',
                  'ประเภทจุดตรวจวัด',
                  'รายละเอียดพารามิเตอร์',
                  'จัดการ',
                ].map((column) => (
                  <TableCell key={column} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>
                    {column}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.parameters}</TableCell>
                    <TableCell>
                      <FormSelectionMenu factory={factory} point={row} onSelectForm={onSelectForm} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
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

function OptionMultiSelect({ label, value, onChange, options }) {
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
          onChange(typeof selectedValue === 'string' ? selectedValue.split(',') : selectedValue)
        }}
        renderValue={(selected) => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selected.map((item) => (
              <Chip key={item} label={item} size="small" />
            ))}
          </Box>
        )}
      >
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

function ParameterMultiSelect({ label, value, onChange }) {
  return <OptionMultiSelect label={label} value={value} onChange={onChange} options={cemsParameterOptions} />
}

function getDayRange(startDate, endDate) {
  if (!startDate || !endDate || !dayjs(startDate).isValid() || !dayjs(endDate).isValid()) {
    return ''
  }

  const diff = dayjs(endDate).startOf('day').diff(dayjs(startDate).startOf('day'), 'day')
  return diff >= 0 ? String(diff + 1) : ''
}

function Kwp01Form({
  factory,
  point,
  problemDate,
  expectedDoneDate,
  unreportedParameters,
  onProblemDateChange,
  onExpectedDoneDateChange,
  onUnreportedParametersChange,
}) {
  const [combustionSystem, setCombustionSystem] = useState('')
  const [issueReason, setIssueReason] = useState('')
  const totalDays = getDayRange(problemDate, expectedDoneDate)

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="th">
      <Stack spacing={2}>
        <SectionPaper title="ข้อมูลทั่วไปของโรงงาน">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReadOnlyField label="ชื่อโรงงาน" value={factory?.factoryName ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ทะเบียนโรงงานเลขที่" value={factory?.newRegistrationNo ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ลำดับประเภทโรงงาน" value={factory?.industryType ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 12 }}>
              <ReadOnlyField label="สถานที่ตั้งโรงงาน" value={factory?.address ?? ''} multiline />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactName" label="รายชื่อผู้ติดต่อ" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactPhone" label="เบอร์โทรศัพท์" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactEmail" label="e-mail" type="email" size="small" fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="ข้อมูลจุดตรวจวัด">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="รหัสจุดตรวจวัด" value={point?.code ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ชื่อจุดตรวจวัด" value={point?.name ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="productionStack" label="ปล่องจากกระบวนการผลิต" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="primaryFuel" label="เชื้อเพลิงหลัก" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="secondaryFuel" label="เชื้อเพลิงสำรอง" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                name="combustionSystem"
                label="ระบบการเผาไหม้เชื้อเพลิง"
                size="small"
                value={combustionSystem}
                onChange={(event) => setCombustionSystem(event.target.value)}
                fullWidth
              >
                <MenuItem value="ระบบปิด">ระบบปิด</MenuItem>
                <MenuItem value="ระบบเปิด">ระบบเปิด</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="productionCapacity" label="กำลังการผลิตของหน่วยการผลิต" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="productionCapacityUnit" label="หน่วยของกำลังการผลิต" size="small" fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="สาเหตุของการไม่สามารถรายงานผลการตรวจวัดได้">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                name="issueReason"
                label="สาเหตุ"
                size="small"
                value={issueReason}
                onChange={(event) => setIssueReason(event.target.value)}
                fullWidth
              >
                <MenuItem value="เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง">
                  เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง
                </MenuItem>
                <MenuItem value="หยุดหน่วยการผลิต">หยุดหน่วยการผลิต</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 9 }}>
              <TextField name="reasonDetail" label="เนื่องจาก" size="small" multiline minRows={3} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <DatePicker
                label="วัน/เดือน/ปี ที่พบปัญหาหรือหยุดหน่วยการผลิต"
                value={problemDate}
                onChange={onProblemDateChange}
                format="DD/MM/BBBB"
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <DatePicker
                label="วัน/เดือน/ปี ที่คาดว่าจะดำเนินการแล้วเสร็จ"
                value={expectedDoneDate}
                onChange={onExpectedDoneDateChange}
                format="DD/MM/BBBB"
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField
                label="รวมระยะเวลาปรับปรุงแก้ไขหรือระยะเวลาหยุดหน่วยการผลิต (วัน)"
                value={totalDays}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Alert severity="info">
                หมายเหตุ : กรณีเครื่องมือหรืออุปกรณ์พิเศษมีเหตุขัดข้องและไม่สามารถรายงานผลการตรวจวัดได้ตั้งแต่ 15 วันขึ้นไป ต้องรายงานแบบ กวภ.02 ด้วย
              </Alert>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ParameterMultiSelect
                label="รายการตรวจวัด (พารามิเตอร์) ที่ไม่สามารถรายงานผลได้"
                value={unreportedParameters}
                onChange={onUnreportedParametersChange}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                name="correctiveAction"
                label="แนวทางการปรับปรุงแก้ไข (เฉพาะเครื่องมือหรืออุปกรณ์พิเศษขัดข้อง)"
                size="small"
                multiline
                minRows={3}
                fullWidth
              />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="ผู้ประกอบกิจการโรงงานหรือผู้รับมอบอำนาจ (ผู้จัดทำรายงาน)">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField name="reporterName" label="ชื่อ-นามสกุล" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField name="reporterPosition" label="ตำแหน่ง" size="small" fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>
      </Stack>
    </LocalizationProvider>
  )
}

function getFormText(formData, name) {
  return String(formData.get(name) ?? '').trim()
}

function formatThaiDateValue(value) {
  return value && dayjs(value).isValid() ? dayjs(value).format('DD/MM/BBBB') : ''
}

function buildKwp01PreviewData(form, formElement, dates, unreportedParameters) {
  const formData = formElement ? new FormData(formElement) : new FormData()
  const startDate = dates.problemDate
  const endDate = dates.expectedDoneDate

  return {
    title: form?.title ?? '',
    factoryName: form?.factory?.factoryName ?? '',
    factoryRegistration: form?.factory?.newRegistrationNo ?? '',
    industryType: form?.factory?.industryType ?? '',
    factoryAddress: form?.factory?.address ?? '',
    contactName: getFormText(formData, 'contactName'),
    contactPhone: getFormText(formData, 'contactPhone'),
    contactEmail: getFormText(formData, 'contactEmail'),
    pointCode: form?.point?.code ?? '',
    pointName: form?.point?.name ?? '',
    productionStack: getFormText(formData, 'productionStack'),
    primaryFuel: getFormText(formData, 'primaryFuel'),
    secondaryFuel: getFormText(formData, 'secondaryFuel'),
    combustionSystem: getFormText(formData, 'combustionSystem'),
    productionCapacity: getFormText(formData, 'productionCapacity'),
    productionCapacityUnit: getFormText(formData, 'productionCapacityUnit'),
    issueReason: getFormText(formData, 'issueReason'),
    reasonDetail: getFormText(formData, 'reasonDetail'),
    problemDate: formatThaiDateValue(startDate),
    expectedDoneDate: formatThaiDateValue(endDate),
    totalDays: getDayRange(startDate, endDate),
    unreportedParameters,
    correctiveAction: getFormText(formData, 'correctiveAction'),
    reporterName: getFormText(formData, 'reporterName'),
    reporterPosition: getFormText(formData, 'reporterPosition'),
  }
}

function buildCommonFormPreviewData(form, formElement) {
  const formData = formElement ? new FormData(formElement) : new FormData()

  return {
    factoryName: form?.factory?.factoryName ?? '',
    factoryRegistration: form?.factory?.newRegistrationNo ?? '',
    industryType: form?.factory?.industryType ?? '',
    factoryAddress: form?.factory?.address ?? '',
    contactName: getFormText(formData, 'contactName'),
    contactPhone: getFormText(formData, 'contactPhone'),
    contactEmail: getFormText(formData, 'contactEmail'),
    pointCode: form?.point?.code ?? '',
    pointName: form?.point?.name ?? '',
    productionStack: getFormText(formData, 'productionStack'),
    primaryFuel: getFormText(formData, 'primaryFuel'),
    secondaryFuel: getFormText(formData, 'secondaryFuel'),
    combustionSystem: getFormText(formData, 'combustionSystem'),
    productionCapacity: getFormText(formData, 'productionCapacity'),
    productionCapacityUnit: getFormText(formData, 'productionCapacityUnit'),
    reporterName: getFormText(formData, 'reporterName'),
    reporterPosition: getFormText(formData, 'reporterPosition'),
  }
}

function buildKwp02PreviewData(form, formElement, measurementRows) {
  const isKwp04 = form?.title?.startsWith('กวภ.04')

  return {
    formType: isKwp04 ? 'kwp04' : 'kwp02',
    title: form?.title ?? '',
    ...buildCommonFormPreviewData(form, formElement),
    measurementRows,
  }
}

function buildKwp03PreviewData(form, formElement, dates, selectedValues) {
  const formData = formElement ? new FormData(formElement) : new FormData()

  return {
    formType: 'kwp03',
    title: form?.title ?? '',
    ...buildCommonFormPreviewData(form, formElement),
    instruments: selectedValues.instruments,
    measurementTimes: selectedValues.measurementTimes,
    wastewaterSource: getFormText(formData, 'wastewaterSource'),
    receivingSource: getFormText(formData, 'receivingSource'),
    treatmentSystemType: getFormText(formData, 'treatmentSystemType'),
    dischargePoint: getFormText(formData, 'dischargePoint'),
    averageDischarge: getFormText(formData, 'averageDischarge'),
    minimumDischarge: getFormText(formData, 'minimumDischarge'),
    maximumDischarge: getFormText(formData, 'maximumDischarge'),
    issueReasons: selectedValues.issueReasons,
    reasonDetail: getFormText(formData, 'reasonDetail'),
    problemDate: formatThaiDateValue(dates.problemDate),
    expectedDoneDate: formatThaiDateValue(dates.expectedDoneDate),
    totalDays: getDayRange(dates.problemDate, dates.expectedDoneDate),
    failedParameters: selectedValues.failedParameters,
    correctiveAction: getFormText(formData, 'correctiveAction'),
  }
}

function buildKwp05PreviewData(form, formElement, calibrationRows) {
  const formData = formElement ? new FormData(formElement) : new FormData()

  return {
    formType: 'kwp05',
    title: form?.title ?? '',
    companyName: form?.factory?.factoryName ?? '',
    factoryRegistration: form?.factory?.newRegistrationNo ?? '',
    businessActivity: getFormText(formData, 'businessActivity'),
    factoryAddress: form?.factory?.address ?? '',
    samplerName: getFormText(formData, 'samplerName'),
    officerRegistration: getFormText(formData, 'officerRegistration'),
    laboratoryName: getFormText(formData, 'laboratoryName'),
    laboratoryRegistration: getFormText(formData, 'laboratoryRegistration'),
    pointCode: form?.point?.code ?? '',
    pointName: form?.point?.name ?? '',
    cemsBrand: getFormText(formData, 'cemsBrand'),
    cemsDetail: getFormText(formData, 'cemsDetail'),
    reportRound: getFormText(formData, 'reportRound'),
    reportYear: getFormText(formData, 'reportYear'),
    calibrationRows,
    reporterName: getFormText(formData, 'reporterName'),
    reporterPosition: getFormText(formData, 'reporterPosition'),
  }
}

function parseKwpHistoryDate(value) {
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

function formatKwpHistoryDate(value) {
  const parsedDate = parseKwpHistoryDate(value)
  if (!parsedDate) return '-'

  const day = String(parsedDate.getDate()).padStart(2, '0')
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
  const year = parsedDate.getFullYear() + 543

  return `${day}/${month}/${year}`
}

function formatKwpHistoryDuration(startValue, endValue, fallbackValue) {
  if (fallbackValue) return fallbackValue

  const startDate = parseKwpHistoryDate(startValue)
  const endDate = parseKwpHistoryDate(endValue)
  if (!startDate || !endDate) return ''

  const diffMs = Math.max(0, endDate.getTime() - startDate.getTime())
  const totalDays = Math.max(1, Math.ceil(diffMs / 86_400_000))

  return `${totalDays} วัน`
}

function getKwpStatusHistoryItems(history = []) {
  return history
    .filter(Boolean)
    .map((item, index) => ({ ...item, __index: index, __date: item.changedAt ?? item.date ?? null }))
    .sort((a, b) => {
      const dateA = parseKwpHistoryDate(a.__date)?.getTime() ?? 0
      const dateB = parseKwpHistoryDate(b.__date)?.getTime() ?? 0

      if (dateA !== dateB) {
        return dateA - dateB
      }

      return a.__index - b.__index
    })
}

function buildKwpStatusHistory(row) {
  if (Array.isArray(row.statusHistory) && row.statusHistory.length > 0) {
    return row.statusHistory
  }

  const history = [
    {
      id: `${row.id}-submitted`,
      statusLabel: 'รอพิจารณา',
      note: 'ผู้ประกอบการส่งแบบฟอร์ม',
      changedAt: row.submittedDate,
      changedBy: 'ผู้ประกอบการ',
    },
  ]

  if (row.status === 'รอโรงงานแก้ไข') {
    history.push({
      id: `${row.id}-revision`,
      statusLabel: 'รอโรงงานแก้ไข',
      note: row.revisionNote ?? '',
      changedAt: row.reviewedDate,
      changedBy: 'เจ้าหน้าที่ ก',
    })
  } else if (row.status === 'ผ่านการพิจารณา') {
    history.push({
      id: `${row.id}-reviewed`,
      statusLabel: 'ผ่านการพิจารณา',
      note: 'ตรวจสอบข้อมูลและเอกสารประกอบถูกต้องครบถ้วน',
      changedAt: row.reviewedDate,
      changedBy: 'เจ้าหน้าที่ ก',
    })
  } else if (row.status === 'ยื่นแบบสำเร็จ') {
    history.push({
      id: `${row.id}-completed`,
      statusLabel: 'ยื่นแบบสำเร็จ',
      note: 'บันทึกผลการพิจารณาเรียบร้อยแล้ว',
      changedAt: row.reviewedDate,
      changedBy: 'เจ้าหน้าที่ ก',
    })
  }

  return history
}

function buildKwpEditForm(row) {
  const option = kwpFormOptions.find((item) => item.code === row.form)
  const titleText = option?.title ?? ''

  return {
    title: `${row.form} ${titleText}`.trim(),
    code: row.form,
    titleText,
    description: option?.description ?? '',
    mode: 'edit',
    requestNo: row.requestNo,
    latestRevisionMessage: row.revisionNote ?? '',
    factory: {
      factoryName: row.factoryName,
      newRegistrationNo: row.factoryRegistration,
      industryType: row.industryType,
      address: row.factoryAddress,
    },
    point: {
      code: row.monitoringPointCode,
      name: row.monitoringPointName,
      type: row.type,
    },
  }
}

function buildKwpRequestPreviewData(row) {
  const commonData = {
    title: row.form,
    factoryName: row.factoryName,
    factoryRegistration: row.factoryRegistration,
    industryType: row.industryType,
    factoryAddress: row.factoryAddress,
    contactName: 'นายสมชาย ใจดี',
    contactPhone: '02-123-4567',
    contactEmail: 'contact@example.com',
    pointCode: row.monitoringPointCode,
    pointName: row.monitoringPointName,
    productionStack: row.monitoringPointName,
    primaryFuel: 'ถ่านหิน',
    secondaryFuel: 'ก๊าซธรรมชาติ',
    combustionSystem: 'ระบบปิด',
    productionCapacity: '120',
    productionCapacityUnit: 'ตัน/ชั่วโมง',
    reporterName: 'นายสมชาย ใจดี',
    reporterPosition: 'ผู้จัดการสิ่งแวดล้อม',
    latestRevisionMessage: row.revisionNote ?? '',
    statusHistory: buildKwpStatusHistory(row),
  }

  if (row.form === 'กวภ.03') {
    return {
      formType: 'kwp03',
      ...commonData,
      instruments: ['ค่าบีโอดี (BOD)', 'ค่าซีโอดี (COD)'],
      measurementTimes: ['Real Time'],
      wastewaterSource: 'ระบบบำบัดน้ำเสียรวม',
      receivingSource: 'คลองสาธารณะ',
      treatmentSystemType: 'ระบบบำบัดชีวภาพ',
      dischargePoint: '13.806601, 100.708653',
      averageDischarge: '500',
      minimumDischarge: '320',
      maximumDischarge: '740',
      issueReasons: ['ระบบรับส่งข้อมูล ระบบไฟฟ้า อินเทอร์เน็ต ขัดข้อง'],
      reasonDetail: 'สัญญาณเครือข่ายขัดข้อง',
      problemDate: row.submittedDate,
      expectedDoneDate: row.reviewedDate,
      totalDays: '2',
      failedParameters: ['BOD', 'COD'],
      correctiveAction: 'ประสานผู้ให้บริการและตรวจสอบระบบรับส่งข้อมูล',
    }
  }

  if (row.form === 'กวภ.02' || row.form === 'กวภ.04') {
    return {
      formType: row.form === 'กวภ.04' ? 'kwp04' : 'kwp02',
      ...commonData,
      measurementRows: [
        {
          id: `${row.id}-measurement-1`,
          pollutant: 'NOx',
          sampleDate: '2026-06-14',
          measuredValue: '120',
          unit: 'ppm',
          laboratoryNo: 'LAB-001',
          reportNo: 'REP-69-001',
          method: 'US EPA Method 7E',
          samplingPhotoFileName: 'sampling-photo.jpg',
          labReportFileName: 'lab-report.pdf',
        },
        {
          id: `${row.id}-measurement-2`,
          pollutant: 'SO2',
          sampleDate: '2026-06-14',
          measuredValue: '80',
          unit: 'ppm',
          laboratoryNo: 'LAB-001',
          reportNo: 'REP-69-002',
          method: 'US EPA Method 6C',
          samplingPhotoFileName: 'sampling-photo-2.jpg',
          labReportFileName: 'lab-report-2.pdf',
        },
      ],
    }
  }

  if (row.form === 'กวภ.05') {
    return {
      formType: 'kwp05',
      title: row.form,
      companyName: row.factoryName,
      factoryRegistration: row.factoryRegistration,
      businessActivity: row.industryType,
      factoryAddress: row.factoryAddress,
      samplerName: 'นายสมชาย ใจดี',
      officerRegistration: 'LAB-REG-2569-001',
      laboratoryName: 'ห้องปฏิบัติการสิ่งแวดล้อมอุตสาหกรรม',
      laboratoryRegistration: 'ทดสอบ-1234-2569',
      pointCode: row.monitoringPointCode,
      pointName: row.monitoringPointName,
      cemsBrand: 'EnviroTech CEMS-5000',
      cemsDetail: 'EnviroTech CEMS-5000',
      reportRound: '1',
      reportYear: String(new Date().getFullYear() + 543),
      calibrationRows: [
        {
          id: `${row.id}-calibration-1`,
          parameter: 'NOx (ppm)',
          startDate: '2026-06-10',
          endDate: '2026-06-11',
          result: 'ผ่าน',
          verifierCompany: 'บริษัท ตรวจวัดสิ่งแวดล้อมไทย จำกัด',
          cemsModel: 'CEMS-5000',
          linkQr1: 'https://example.com/rata-nox',
          linkQr2: 'https://example.com/cert-nox',
        },
      ],
      reporterName: 'นายสมชาย ใจดี',
      reporterPosition: 'ผู้จัดการสิ่งแวดล้อม',
      latestRevisionMessage: row.revisionNote ?? '',
      statusHistory: buildKwpStatusHistory(row),
    }
  }

  return {
    ...commonData,
    issueReason: 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง',
    reasonDetail: 'เครื่องวิเคราะห์ก๊าซไม่สามารถส่งข้อมูลได้',
    problemDate: row.submittedDate,
    expectedDoneDate: '20/06/2569',
    totalDays: '6',
    unreportedParameters: ['NOx (ppm)', 'SO2 (ppm)'],
    correctiveAction: 'ซ่อมบำรุงเครื่องมือและตรวจสอบระบบรับส่งข้อมูล',
  }
}

function PaperCheckbox({ checked, label }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, mr: 2 }}>
      <Box
        component="span"
        sx={{
          width: 16,
          height: 16,
          border: '1px solid #333',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          lineHeight: 1,
        }}
      >
        {checked ? '/' : ''}
      </Box>
      {label}
    </Box>
  )
}

function DottedValue({ children, minWidth = 120, sx }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        minWidth,
        borderBottom: '1px dotted #222',
        px: 0.5,
        lineHeight: 1.4,
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

function Kwp01PaperDocument({ data }) {
  const brokenTool = data.issueReason === 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง'
  const stoppedProduction = data.issueReason === 'หยุดหน่วยการผลิต'
  const closedCombustion = data.combustionSystem === 'ระบบปิด'
  const openCombustion = data.combustionSystem === 'ระบบเปิด'

  return (
    <Paper
      elevation={0}
      sx={{
        width: 794,
        minHeight: 1123,
        mx: 'auto',
        p: '38px 56px',
        color: '#000',
        bgcolor: '#fff',
        fontFamily: 'Kanit, sans-serif',
        fontSize: 14,
        lineHeight: 1.8,
      }}
    >
      <Stack spacing={1.6}>
        <Typography sx={{ textAlign: 'right', fontWeight: 700 }}>แบบ กวภ.01</Typography>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 700 }}>
            แบบแจ้งเหตุขัดข้องของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ เพื่อรายงานมลพิษอากาศจากปล่องโรงงาน
          </Typography>
          <Typography sx={{ fontWeight: 700 }}>หรือแจ้งหยุดหน่วยการผลิต</Typography>
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
                verticalAlign: 'top',
              },
              '& th': {
                bgcolor: '#c9c9c9',
                fontWeight: 700,
              },
            }}
          >
            <TableBody>
              <TableRow>
                <TableCell component="th" colSpan={2}>1. รายละเอียดเกี่ยวกับโรงงาน (1 แบบต่อ 1 ปล่อง)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2} align="right">วันที่..........เดือน................พ.ศ. ................</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>ชื่อโรงงาน : {data.factoryName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>ทะเบียนโรงงานเลขที่ : {data.factoryRegistration}</TableCell>
                <TableCell>ลำดับประเภทโรงงาน : {data.industryType}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>สถานที่ตั้งโรงงาน : {data.factoryAddress}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>รายชื่อผู้ติดต่อ : {data.contactName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>เบอร์โทรศัพท์ : {data.contactPhone}</TableCell>
                <TableCell>e-mail : {data.contactEmail}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component="th" colSpan={2}>2. ข้อมูลปล่อง</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>รหัสจุดตรวจวัด : {data.pointCode}</TableCell>
                <TableCell>ชื่อจุดตรวจวัด : {data.pointName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>ปล่องจากกระบวนการผลิต : {data.productionStack}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>เชื้อเพลิงหลัก: {data.primaryFuel}</TableCell>
                <TableCell>เชื้อเพลิงสำรอง: {data.secondaryFuel}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>
                  ระบบการเผาไหม้เชื้อเพลิง :{' '}
                  <PaperCheckbox checked={closedCombustion} label="ระบบปิด" />
                  <PaperCheckbox checked={openCombustion} label="ระบบเปิด" />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>กำลังการผลิตของหน่วยการผลิต : {data.productionCapacity}</TableCell>
                <TableCell>หน่วยของกำลังการผลิต : {data.productionCapacityUnit}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component="th" colSpan={2}>3. สาเหตุของการไม่สามารถรายงานผลการตรวจวัดได้</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>3.1 สาเหตุ</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2} sx={{ pl: 5 }}>
                  <PaperCheckbox checked={brokenTool} label="เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง" />
                  เนื่องจาก : <DottedValue minWidth={360}>{brokenTool ? data.reasonDetail : ''}</DottedValue>
                  <Box sx={{ borderBottom: '1px dotted #222', mt: 1, minHeight: 20 }} />
                  <PaperCheckbox checked={stoppedProduction} label="หยุดหน่วยการผลิต" />
                  เนื่องจาก : <DottedValue minWidth={420}>{stoppedProduction ? data.reasonDetail : ''}</DottedValue>
                  <Box sx={{ borderBottom: '1px dotted #222', mt: 1, minHeight: 20 }} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>3.2 วัน/เดือน/ปี ที่พบปัญหาหรือหยุดหน่วยการผลิต : {data.problemDate}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>3.3 วัน/เดือน/ปี ที่คาดว่าจะดำเนินการแล้วเสร็จ : {data.expectedDoneDate}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2} sx={{ pl: 5 }}>
                  รวมระยะเวลาปรับปรุงแก้ไขหรือระยะเวลาหยุดหน่วยการผลิต (วัน) :{' '}
                  <DottedValue minWidth={160}>{data.totalDays}</DottedValue>
                  <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                    (หมายเหตุ : กรณีเครื่องมือหรืออุปกรณ์พิเศษมีเหตุขัดข้องและไม่สามารถรายงานผลการตรวจวัดได้ตั้งแต่ 15 วันขึ้นไป ต้องรายงานแบบ กวภ.02 ด้วย)
                  </Typography>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>
                  3.4 รายการตรวจวัด (พารามิเตอร์) ที่ไม่สามารถรายงานผลได้ :{' '}
                  <DottedValue minWidth={360}>{data.unreportedParameters.join(', ')}</DottedValue>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>
                  3.5 แนวทางการปรับปรุงแก้ไข (เฉพาะเครื่องมือหรืออุปกรณ์พิเศษขัดข้อง) :{' '}
                  <DottedValue minWidth={330}>{data.correctiveAction}</DottedValue>
                  <Box sx={{ borderBottom: '1px dotted #222', mt: 1, minHeight: 20 }} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2} sx={{ borderBottom: '1px solid #555', height: 210 }}>
                  <Box sx={{ textAlign: 'center', mt: 4 }}>
                    <Typography sx={{ fontSize: 13 }}>ข้าพเจ้าขอรับรองว่าข้อมูลข้างต้นเป็นจริงทุกประการ</Typography>
                    <Box sx={{ mt: 4, fontSize: 13 }}>
                      <DottedValue minWidth={240} /> (ลงชื่อ)
                    </Box>
                    <Typography sx={{ fontSize: 13 }}>( {data.reporterName || '........................................'} )</Typography>
                    <Typography sx={{ fontSize: 13 }}>ตำแหน่ง <DottedValue minWidth={210}>{data.reporterPosition}</DottedValue></Typography>
                    <Typography sx={{ fontSize: 13 }}>ผู้ประกอบกิจการโรงงานหรือผู้รับมอบอำนาจ</Typography>
                    <Typography sx={{ fontSize: 13 }}>ผู้จัดทำรายงาน</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Paper>
  )
}

function KwpPaperRowsOneAndTwo({ data, totalColumns = 2 }) {
  const closedCombustion = data.combustionSystem === 'ระบบปิด'
  const openCombustion = data.combustionSystem === 'ระบบเปิด'
  const leftColumns = Math.floor(totalColumns / 2)
  const rightColumns = totalColumns - leftColumns

  return (
    <>
      <TableRow>
        <TableCell component="th" colSpan={totalColumns}>
          1. รายละเอียดเกี่ยวกับโรงงาน (1 แบบต่อ 1 ปล่อง)
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={totalColumns} align="right">วันที่..........เดือน................พ.ศ. ................</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={totalColumns}>ชื่อโรงงาน : {data.factoryName}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={leftColumns}>ทะเบียนโรงงานเลขที่ : {data.factoryRegistration}</TableCell>
        <TableCell colSpan={rightColumns}>ลำดับประเภทโรงงาน : {data.industryType}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={totalColumns}>สถานที่ตั้งโรงงาน : {data.factoryAddress}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={totalColumns}>รายชื่อผู้ติดต่อ : {data.contactName}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={leftColumns}>เบอร์โทรศัพท์ : {data.contactPhone}</TableCell>
        <TableCell colSpan={rightColumns}>e-mail : {data.contactEmail}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell component="th" colSpan={totalColumns}>2. ข้อมูลปล่อง</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={leftColumns}>รหัสจุดตรวจวัด : {data.pointCode}</TableCell>
        <TableCell colSpan={rightColumns}>ชื่อจุดตรวจวัด : {data.pointName}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={totalColumns}>ปล่องจากกระบวนการผลิต : {data.productionStack}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={leftColumns}>เชื้อเพลิงหลัก: {data.primaryFuel}</TableCell>
        <TableCell colSpan={rightColumns}>เชื้อเพลิงสำรอง: {data.secondaryFuel}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={totalColumns}>
          ระบบการเผาไหม้เชื้อเพลิง :{' '}
          <PaperCheckbox checked={closedCombustion} label="ระบบปิด" />
          <PaperCheckbox checked={openCombustion} label="ระบบเปิด" />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={leftColumns}>กำลังการผลิตของหน่วยการผลิต : {data.productionCapacity}</TableCell>
        <TableCell colSpan={rightColumns}>หน่วยของกำลังการผลิต : {data.productionCapacityUnit}</TableCell>
      </TableRow>
    </>
  )
}

function KwpPaperShell({ children }) {
  return (
    <Paper
      elevation={0}
      sx={{
        width: 794,
        minHeight: 1123,
        mx: 'auto',
        p: '38px 56px',
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

function AttachmentPreview({ title, fileName, fileUrl, fileType }) {
  return (
    <Box sx={{ border: '1px solid #555', p: 1.5, minHeight: 220 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>{title}</Typography>
      {fileUrl && fileType?.startsWith('image/') ? (
        <Box
          component="img"
          src={fileUrl}
          alt={fileName}
          sx={{ display: 'block', maxWidth: '100%', maxHeight: 420, mx: 'auto', objectFit: 'contain' }}
        />
      ) : (
        <Typography sx={{ fontSize: 13 }}>{fileName || '-'}</Typography>
      )}
    </Box>
  )
}

function Kwp02PaperDocument({ data }) {
  const isKwp04 = data.formType === 'kwp04'
  const rowsForPaper = data.measurementRows.length
    ? data.measurementRows
    : Array.from({ length: 3 }, (_, index) => ({ id: `empty-${index}` }))

  return (
    <Stack spacing={2} sx={{ alignItems: 'center' }}>
      <KwpPaperShell>
        <Stack spacing={1.6}>
          <Typography sx={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
            แบบ {isKwp04 ? 'กวภ.04' : 'กวภ.02'}
          </Typography>
          <Box sx={{ textAlign: 'center' }}>
            {isKwp04 ? (
              <>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                  แบบรายงานผลการตรวจวัดมลพิษอากาศจากปล่องระบาย ตามประกาศฯ
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                  ข้อ 4(1) (2) 11(3) และ 16
                </Typography>
              </>
            ) : (
              <>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                  แบบรายงานผลการตรวจวัดมลพิษอากาศจากปล่องระบาย กรณีเครื่องมือหรือเครื่องอุปกรณ์พิเศษ
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                  มีเหตุขัดข้องและไม่สามารถรายงานผลการตรวจวัดได้ตั้งแต่ 15 วันขึ้นไป
                </Typography>
              </>
            )}
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
                  verticalAlign: 'top',
                },
                '& th': {
                  bgcolor: '#c9c9c9',
                  fontWeight: 700,
                },
              }}
            >
              <TableBody>
                <KwpPaperRowsOneAndTwo data={data} totalColumns={7} />
                <TableRow>
                  <TableCell component="th" colSpan={7}>3. รายการตรวจวัดมลพิษอากาศจากปล่องระบาย</TableCell>
                </TableRow>
                <TableRow>
                  {[
                    ['รายการ', 'สารมลพิษ'],
                    ['วันที่', 'เก็บตัวอย่าง'],
                    ['ค่าที่', 'ตรวจวัดได้'],
                    ['หน่วยการ', 'ตรวจวัด'],
                    ['เลขที่ห้อง', 'ปฏิบัติการ'],
                    ['เลขที่รายงาน'],
                    ['วิธีการตรวจวัดวิเคราะห์'],
                  ].map((column) => (
                    <TableCell key={column.join('-')} align="center" sx={{ fontWeight: 700 }}>
                      {column.map((line) => (
                        <Box key={line} component="span" sx={{ display: 'block' }}>
                          {line}
                        </Box>
                      ))}
                    </TableCell>
                  ))}
                </TableRow>
                {rowsForPaper.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.pollutant}</TableCell>
                    <TableCell>{formatThaiDateValue(row.sampleDate)}</TableCell>
                    <TableCell>{row.measuredValue}</TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell>{row.laboratoryNo}</TableCell>
                    <TableCell>{row.reportNo}</TableCell>
                    <TableCell>{row.method}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={7}>
                    หมายเหตุ : การเก็บและวิเคราะห์ตัวอย่างต้องดําเนินการโดยห้องปฏิบัติการวิเคราะห์ของหน่วยงานราชการ
                    หรือห้องปฏิบัติการวิเคราะห์เอกชนที่ขึ้นทะเบียนกับกรมโรงงานอุตสาหกรรม
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={7} sx={{ height: 260 }}>
                    <Box sx={{ textAlign: 'center', mt: 4, fontSize: 13 }}>
                      <Typography sx={{ fontSize: 13 }}>ข้าพเจ้าขอรับรองว่าข้อมูลข้างต้นเป็นจริงทุกประการ</Typography>
                      <Box sx={{ mt: 4, fontSize: 13 }}>
                        <DottedValue minWidth={300} /> (ลงชื่อ)
                      </Box>
                      <Typography sx={{ fontSize: 13 }}>( {data.reporterName || '........................................'} )</Typography>
                      <Typography sx={{ fontSize: 13 }}>ตำแหน่ง <DottedValue minWidth={260}>{data.reporterPosition}</DottedValue></Typography>
                      <Typography sx={{ fontSize: 13 }}>ผู้ประกอบกิจการโรงงานหรือผู้รับมอบอำนาจ</Typography>
                      <Typography sx={{ fontSize: 13 }}>ผู้จัดทำรายงาน</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </KwpPaperShell>
      {data.measurementRows.length ? (
        <KwpPaperShell>
          <Stack spacing={2}>
            <Typography sx={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
              เอกสารแนบ แบบ {isKwp04 ? 'กวภ.04' : 'กวภ.02'}
            </Typography>
            {data.measurementRows.map((row, index) => (
              <Box key={row.id} sx={{ breakInside: 'avoid' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>
                  รายการที่ {index + 1} : {row.pollutant || '-'}
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <AttachmentPreview
                      title="ภาพถ่ายขณะเก็บตัวอย่าง"
                      fileName={row.samplingPhotoFileName}
                      fileUrl={row.samplingPhotoFileUrl}
                      fileType={row.samplingPhotoFileType}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <AttachmentPreview
                      title="รายงานผลจากห้องปฏิบัติการ"
                      fileName={row.labReportFileName}
                      fileUrl={row.labReportFileUrl}
                      fileType={row.labReportFileType}
                    />
                  </Grid>
                </Grid>
              </Box>
            ))}
          </Stack>
        </KwpPaperShell>
      ) : null}
    </Stack>
  )
}

function MultiPaperCheckboxes({ options, selected }) {
  return options.map((option) => (
    <PaperCheckbox key={option} checked={selected.includes(option)} label={option} />
  ))
}

function Kwp03PaperDocument({ data }) {
  return (
    <KwpPaperShell>
      <Stack spacing={1.6}>
        <Typography sx={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>แบบ กวภ.03</Typography>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
            แบบแจ้งเหตุขัดข้องหรือหยุดส่งข้อมูลการตรวจวัดมลพิษทางน้ำแบบอัตโนมัติอย่างต่อเนื่อง (WPMS)
          </Typography>
        </Box>
        <TableContainer>
          <Table
            size="small"
            sx={{
              border: '1px solid #555',
              '& th, & td': {
                border: '1px solid #555',
                p: 0.6,
                fontSize: 13,
                color: '#000',
                verticalAlign: 'top',
              },
              '& th': {
                bgcolor: '#c9c9c9',
                fontWeight: 700,
              },
            }}
          >
            <TableBody>
              <TableRow>
                <TableCell component="th" colSpan={4}>1.รายละเอียดเกี่ยวกับโรงงาน (1 แบบต่อ 1 จุดตรวจวัด)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4} align="right">วันที่..........เดือน................พ.ศ. ................</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>ชื่อโรงงาน : {data.factoryName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>ทะเบียนโรงงานเลขที่ : {data.factoryRegistration}</TableCell>
                <TableCell colSpan={2}>ลำดับประเภทโรงงาน : {data.industryType}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>สถานที่ตั้งโรงงาน : {data.factoryAddress}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>รายชื่อผู้ติดต่อ : {data.contactName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>เบอร์โทรศัพท์ : {data.contactPhone}</TableCell>
                <TableCell colSpan={2}>E-mail: {data.contactEmail}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component="th" colSpan={4}>2.ข้อมูลจุดตรวจวัด</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>รหัสจุดตรวจวัด : {data.pointCode}</TableCell>
                <TableCell colSpan={2}>ชื่อจุดตรวจวัด : {data.pointName}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>
                  เครื่องตรวจวัด : <MultiPaperCheckboxes options={wpmsInstrumentOptions} selected={data.instruments} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>
                  เวลาเครื่องตรวจวัด : <MultiPaperCheckboxes options={wpmsMeasurementTimeOptions} selected={data.measurementTimes} />
                  <DottedValue minWidth={80} /> นาที
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell component="th" colSpan={4}>
                  3.ข้อมูลนํ้าทิ้งระบายออกนอกโรงงาน (กรอกเฉพาะเครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง)
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>แหล่งกำเนิดน้ำเสีย : {data.wastewaterSource}</TableCell>
                <TableCell colSpan={2}>แหล่งรองรับน้ำทิ้ง : {data.receivingSource}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>ประเภทรบบบำบัด : {data.treatmentSystemType}</TableCell>
                <TableCell colSpan={2}>พิกัดจุดระบายน้ำทิ้ง : {data.dischargePoint}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>ปริมาณนํ้าทิ้งระบายออกวันที่ขัดข้อง (ลบ.ม./วัน) เฉลี่ย : {data.averageDischarge}</TableCell>
                <TableCell>ปริมาณนํ้าทิ้งระบายออกวันที่ขัดข้อง (ลบ.ม./วัน) ต่ำสุด : {data.minimumDischarge}</TableCell>
                <TableCell>ปริมาณนํ้าทิ้งระบายออกวันที่ขัดข้อง (ลบ.ม./วัน) สูงสุด : {data.maximumDischarge}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component="th" colSpan={4}>4.สาเหตุของการไม่สามารถรายงานผลการตรวจวัดได้</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>4.1 สาเหตุ</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4} sx={{ pl: 4 }}>
                  {wpmsIssueReasonOptions.map((reason) => (
                    <Box key={reason} sx={{ mb: 1.2 }}>
                      <PaperCheckbox checked={data.issueReasons.includes(reason)} label={reason} />
                      เนื่องจาก : <DottedValue minWidth={430}>{data.issueReasons.includes(reason) ? data.reasonDetail : ''}</DottedValue>
                    </Box>
                  ))}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>4.2 วัน/เดือน/ปี ที่พบปัญหาหรือหยุดหน่วยการผลิต : {data.problemDate}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>4.3 วัน/เดือน/ปี ที่คาดว่าจะดำเนินการแล้วเสร็จ : {data.expectedDoneDate}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>
                  รวมระยะเวลาปรับปรุงแก้ไขหรือระยะเวลาหยุดหน่วยการผลิต (วัน) : <DottedValue minWidth={250}>{data.totalDays}</DottedValue>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>
                  4.4 รายการตรวจวัด (พารามิเตอร์) ที่ไม่สามารถรายงานผลได้ :{' '}
                  <MultiPaperCheckboxes options={wpmsParameterOptions} selected={data.failedParameters} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>
                  4.5 แนวทางการปรับปรุงแก้ไข (เฉพาะเครื่องมือหรืออุปกรณ์พิเศษขัดข้อง) :{' '}
                  <DottedValue minWidth={390}>{data.correctiveAction}</DottedValue>
                  <Box sx={{ borderBottom: '1px dotted #222', mt: 1, minHeight: 20 }} />
                  <Box sx={{ borderBottom: '1px dotted #222', mt: 1, minHeight: 20 }} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4} sx={{ height: 180 }}>
                  <Box sx={{ textAlign: 'center', mt: 2, fontSize: 13 }}>
                    <Typography sx={{ fontSize: 13 }}>ข้าพเจ้าขอรับรองว่าข้อมูลข้างต้นเป็นจริงทุกประการ</Typography>
                    <Box sx={{ mt: 4, fontSize: 13 }}>
                      <DottedValue minWidth={280} /> (ลงชื่อ)
                    </Box>
                    <Typography sx={{ fontSize: 13 }}>( {data.reporterName || '........................................'} )</Typography>
                    <Typography sx={{ fontSize: 13 }}>ตำแหน่ง <DottedValue minWidth={230}>{data.reporterPosition}</DottedValue></Typography>
                    <Typography sx={{ fontSize: 13 }}>ผู้จัดทำรายงาน/ผู้ดูแลระบบบำบัด</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </KwpPaperShell>
  )
}

function Kwp05Field({ label, value, minWidth = 120, sx, valueSx }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', minWidth: 0, fontSize: 14, lineHeight: 1.6, ...sx }}>
      <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
        {label} :
      </Box>
      <DottedValue minWidth={minWidth} sx={{ flex: 1, ml: 0.5, ...valueSx }}>
        {value}
      </DottedValue>
    </Box>
  )
}

function Kwp05FormRow({ children, sx }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, minWidth: 0, ...sx }}>
      {children}
    </Box>
  )
}

function Kwp05PaperDocument({ data }) {
  const rowsForPaper = data.calibrationRows.length
    ? data.calibrationRows
    : Array.from({ length: 2 }, (_, index) => ({ id: `empty-${index}` }))
  const tableColumns = [
    { label: 'พารามิเตอร์', width: '11%' },
    { label: 'วันที่เริ่มดำเนินการ', width: '11.5%' },
    { label: 'วันที่สิ้นสุดดำเนินการ', width: '11.5%' },
    { label: 'ผลการตรวจสอบ (ผ่าน / ไม่ผ่าน)', width: '10%' },
    { label: 'บริษัทที่ทำการทวนสอบ / สอบเทียบ', width: '12%' },
    { label: 'ยี่ห้อ/รุ่นของ CEMS', width: '10%' },
    { label: 'Link / QR CODE', width: '17%' },
    { label: 'Link / QR CODE', width: '17%' },
  ]

  return (
    <KwpPaperShell>
      <Stack spacing={0.6}>
        <Typography sx={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>แบบ กวภ.05</Typography>
        <Box sx={{ textAlign: 'center', pt: 0.25 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.35 }}>
            แบบรายงานผลการสอบเทียบหรือทวนสอบระบบตรวจวัดคุณภาพอากาศ
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.35 }}>
            แบบอัตโนมัติอย่างต่อเนื่อง (CEMS)
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.35 }}>
            ครั้งที่ <DottedValue minWidth={72}>{data.reportRound}</DottedValue> ประจำปี พ.ศ.{' '}
            <DottedValue minWidth={88}>{data.reportYear}</DottedValue>
          </Typography>
        </Box>

        <Box sx={{ pt: 2, fontSize: 14, display: 'grid', rowGap: 0.25 }}>
          <Kwp05Field label="ชื่อบริษัท" value={data.companyName} minWidth={240} sx={{ width: 330 }} />
          <Kwp05FormRow>
            <Kwp05Field label="เลขทะเบียนโรงงาน" value={data.factoryRegistration} minWidth={190} sx={{ width: 340 }} />
            <Kwp05Field label="ประกอบกิจการ" value={data.businessActivity} minWidth={190} sx={{ flex: 1 }} />
          </Kwp05FormRow>
          <Kwp05Field label="สถานที่ตั้ง" value={data.factoryAddress} minWidth={520} />
          <Kwp05FormRow>
            <Kwp05Field label="ผู้เก็บตัวอย่าง" value={data.samplerName} minWidth={250} sx={{ flex: 1.1 }} />
            <Kwp05Field label="ทะเบียนเจ้าหน้าที่" value={data.officerRegistration} minWidth={170} sx={{ flex: 0.9 }} />
          </Kwp05FormRow>
          <Kwp05Field label="หน่วยงาน/ชื่อห้องปฏิบัติการ" value={data.laboratoryName} minWidth={420} />
          <Kwp05Field label="ทะเบียนห้องปฏิบัติการ" value={data.laboratoryRegistration} minWidth={210} sx={{ width: 330 }} />
          <Kwp05Field label="รหัสจุดตรวจวัด" value={data.pointCode} minWidth={230} sx={{ width: 360 }} />
          <Kwp05Field label="ชื่อจุดตรวจวัด" value={data.pointName} minWidth={240} sx={{ width: 370 }} />
          <Kwp05Field
            label="รายละเอียดของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ : ยี่ห้อ (Brand)"
            value={data.cemsBrand || data.cemsDetail}
            minWidth={180}
          />
          <Typography sx={{ fontWeight: 700, textDecoration: 'underline', fontSize: 14, mt: 0.35 }}>
            รายการผลการสอบเทียบหรือทวนสอบ CEMS
          </Typography>
        </Box>

        <TableContainer sx={{ overflowX: 'visible' }}>
          <Table
            size="small"
            sx={{
              width: '100%',
              tableLayout: 'fixed',
              border: '1px solid #555',
              '& th, & td': {
                border: '1px solid #555',
                p: 0.55,
                fontSize: 12,
                color: '#000',
                textAlign: 'center',
                verticalAlign: 'middle',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              },
              '& th': {
                bgcolor: '#c9c9c9',
                fontWeight: 700,
                height: 96,
              },
            }}
          >
            <colgroup>
              {tableColumns.map((column) => (
                <col key={column.label} style={{ width: column.width }} />
              ))}
            </colgroup>
            <TableHead>
              <TableRow>
                {tableColumns.map((column) => (
                  <TableCell key={column.label}>{column.label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rowsForPaper.map((row) => (
                <TableRow key={row.id} sx={{ height: 88 }}>
                  <TableCell>{row.parameter}</TableCell>
                  <TableCell>{formatThaiDateValue(row.startDate)}</TableCell>
                  <TableCell>{formatThaiDateValue(row.endDate)}</TableCell>
                  <TableCell>{row.result}</TableCell>
                  <TableCell>{row.verifierCompany}</TableCell>
                  <TableCell>{row.cemsModel}</TableCell>
                  <TableCell>{row.linkQr1}</TableCell>
                  <TableCell>{row.linkQr2}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 5 }}>
          <Box sx={{ width: 310, fontSize: 14, lineHeight: 1.8 }}>
            <Box>
              ผู้รายงานผลการทดสอบ <DottedValue minWidth={150} />
            </Box>
            <Box sx={{ textAlign: 'center' }}>( <DottedValue minWidth={220}>{data.reporterName}</DottedValue> )</Box>
            <Box>ตำแหน่ง <DottedValue minWidth={220}>{data.reporterPosition}</DottedValue></Box>
            <Box>ลงวันที่ <DottedValue minWidth={70} />/<DottedValue minWidth={70} />/<DottedValue minWidth={88} /></Box>
          </Box>
        </Box>
      </Stack>
    </KwpPaperShell>
  )
}

function KwpStatusHistoryDialog({ open, history = [], onClose }) {
  const items = useMemo(() => getKwpStatusHistoryItems(history), [history])

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
              const duration = formatKwpHistoryDuration(
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
                        วันที่: {formatKwpHistoryDate(item.__date)}
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

function Kwp01PreviewDialog({ open, data, mode = 'submit', onClose }) {
  const [statusHistoryOpen, setStatusHistoryOpen] = useState(false)
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false)
  const [revisionOfficerNote, setRevisionOfficerNote] = useState('')
  const [revisionSubmitting, setRevisionSubmitting] = useState(false)
  const [revisionError, setRevisionError] = useState('')
  const latestRevisionMessage = mode === 'edit' ? data?.latestRevisionMessage : ''
  const previewFormNo =
    data?.formType === 'kwp04'
      ? 'กวภ.04'
      : data?.formType === 'kwp03'
        ? 'กวภ.03'
        : data?.formType === 'kwp05'
          ? 'กวภ.05'
          : data?.formType === 'kwp02'
            ? 'กวภ.02'
            : 'กวภ.01'
  const handleDownload = () => {
    if (!data) return

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${previewFormNo}-document.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  const closeRevisionDialog = () => {
    if (revisionSubmitting) {
      return
    }

    setRevisionDialogOpen(false)
    setRevisionOfficerNote('')
    setRevisionError('')
  }
  const requestRevisionDocument = () => {
    if (!revisionOfficerNote.trim()) {
      setRevisionError('กรุณาระบุรายละเอียดการแจ้งแก้ไข')
      return
    }

    setRevisionSubmitting(true)
    window.setTimeout(() => {
      setRevisionSubmitting(false)
      setRevisionDialogOpen(false)
      setRevisionOfficerNote('')
      setRevisionError('')
      onClose?.()
    }, 300)
  }
  const closePreviewDialog = () => {
    setStatusHistoryOpen(false)
    onClose?.()
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
            แบบฟอร์ม {previewFormNo}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<HistoryIcon />}
            disabled={!data}
            onClick={() => setStatusHistoryOpen(true)}
            sx={{ flexShrink: 0 }}
          >
            ประวัติสถานะ
          </Button>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: 'neutral.100' }}>
          {latestRevisionMessage ? (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 2,
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
          {data?.formType === 'kwp02' || data?.formType === 'kwp04' ? <Kwp02PaperDocument data={data} /> : null}
          {data?.formType === 'kwp03' ? <Kwp03PaperDocument data={data} /> : null}
          {data?.formType === 'kwp05' ? <Kwp05PaperDocument data={data} /> : null}
          {data && !['kwp02', 'kwp03', 'kwp04', 'kwp05'].includes(data.formType) ? <Kwp01PaperDocument data={data} /> : null}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center' }}>
          {mode === 'review' ? (
            <>
              <Button variant="outlined" color="inherit" onClick={closePreviewDialog}>
                ยกเลิก
              </Button>
              <Button variant="outlined" color="warning" onClick={() => setRevisionDialogOpen(true)}>
                แจ้งแก้ไข
              </Button>
              <Button variant="contained">
                ผ่านการพิจารณา
              </Button>
            </>
          ) : mode === 'view' ? (
            <>
              <Button variant="outlined" color="inherit" onClick={closePreviewDialog}>
                ปิด
              </Button>
              <Button variant="contained" startIcon={<FileDownloadIcon />} disabled={!data} onClick={handleDownload}>
                Download
              </Button>
            </>
          ) : mode === 'edit' ? (
            <>
              <Button variant="outlined" color="inherit" onClick={closePreviewDialog}>
                ยกเลิก
              </Button>
              <Button variant="contained">
                บันทึกการแก้ไข
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
          ) : (
            <>
              <Button variant="outlined" color="inherit" onClick={closePreviewDialog}>
                ยกเลิก
              </Button>
              <Button variant="contained">
                ยืนยันการส่งแบบฟอร์ม
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
      <KwpStatusHistoryDialog
        open={statusHistoryOpen}
        history={data?.statusHistory ?? []}
        onClose={() => setStatusHistoryOpen(false)}
      />
      <Dialog open={revisionDialogOpen} onClose={closeRevisionDialog} fullWidth maxWidth="sm">
        <DialogTitle>แจ้งแก้ไขแบบฟอร์ม</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              ระบุหมายเหตุเจ้าหน้าที่สำหรับแจ้งให้ผู้ประกอบการแก้ไขแบบฟอร์ม
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
          <Button variant="contained" disabled={revisionSubmitting} onClick={requestRevisionDocument}>
            {revisionSubmitting ? 'กำลังแจ้งแก้ไข' : 'ยืนยันแจ้งแก้ไข'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

const emptyEmissionMeasurement = {
  pollutant: '',
  sampleDate: null,
  measuredValue: '',
  unit: '',
  laboratoryNo: '',
  reportNo: '',
  method: '',
  samplingPhotoFileName: '',
  samplingPhotoFileUrl: '',
  samplingPhotoFileType: '',
  labReportFileName: '',
  labReportFileUrl: '',
  labReportFileType: '',
}

function FileInputButton({ label, fileName, onChange }) {
  return (
    <Stack spacing={0.5}>
      <Button component="label" size="small" variant="outlined">
        แนบไฟล์
        <input
          hidden
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          onChange={(event) => {
            const file = event.target.files?.[0]
            onChange(file ?? null)
          }}
        />
      </Button>
      <Typography variant="caption" color="text.secondary">
        {fileName || label}
      </Typography>
    </Stack>
  )
}

function EmissionMeasurementDialog({ open, value, onClose, onSave }) {
  if (!open) {
    return null
  }

  return (
    <EmissionMeasurementDialogContent
      key={value?.id ?? 'new'}
      value={value}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

function EmissionMeasurementDialogContent({ value, onClose, onSave }) {
  const [form, setForm] = useState(value ?? emptyEmissionMeasurement)
  const [fileError, setFileError] = useState('')

  const updateForm = (field, nextValue) => {
    setForm((current) => ({ ...current, [field]: nextValue }))
  }
  const handleFileChange = (field, file) => {
    if (!file) {
      updateForm(field, '')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError('ไฟล์ต้องมีขนาดไม่เกิน 5 MB')
      return
    }

    setFileError('')
    const fileUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
    const fileTypeField = field.replace('FileName', 'FileType')
    const fileUrlField = field.replace('FileName', 'FileUrl')
    setForm((current) => ({
      ...current,
      [field]: file.name,
      [fileTypeField]: file.type,
      [fileUrlField]: fileUrl,
    }))
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{value ? 'แก้ไขรายการตรวจวัด' : 'เพิ่มรายการตรวจวัด'}</DialogTitle>
      <DialogContent dividers>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="th">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                label="รายการสารมลพิษ"
                size="small"
                value={form.pollutant}
                onChange={(event) => updateForm('pollutant', event.target.value)}
                fullWidth
              >
                {cemsParameterOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <DatePicker
                label="วันที่เก็บตัวอย่าง"
                value={form.sampleDate}
                onChange={(nextValue) => updateForm('sampleDate', nextValue)}
                format="DD/MM/BBBB"
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="ค่าที่ตรวจวัดได้"
                size="small"
                value={form.measuredValue}
                onChange={(event) => updateForm('measuredValue', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="หน่วยการตรวจวัด"
                size="small"
                value={form.unit}
                onChange={(event) => updateForm('unit', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="เลขที่ห้องปฏิบัติการ"
                size="small"
                value={form.laboratoryNo}
                onChange={(event) => updateForm('laboratoryNo', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="เลขที่รายงาน"
                size="small"
                value={form.reportNo}
                onChange={(event) => updateForm('reportNo', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="วิธีการตรวจวัดวิเคราะห์"
                size="small"
                value={form.method}
                onChange={(event) => updateForm('method', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FileInputButton
                label="ภาพถ่ายขณะเก็บตัวอย่าง (JPG/PNG/PDF ไม่เกิน 5 MB)"
                fileName={form.samplingPhotoFileName}
                onChange={(file) => handleFileChange('samplingPhotoFileName', file)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FileInputButton
                label="รายงานผลจากห้องปฏิบัติการ (JPG/PNG/PDF ไม่เกิน 5 MB)"
                fileName={form.labReportFileName}
                onChange={(file) => handleFileChange('labReportFileName', file)}
              />
            </Grid>
            {fileError ? (
              <Grid size={{ xs: 12 }}>
                <Alert severity="error">{fileError}</Alert>
              </Grid>
            ) : null}
          </Grid>
        </LocalizationProvider>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={() => onSave(form)}>
          บันทึก
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function Kwp02Form({ factory, point, measurementRows, setMeasurementRows }) {
  const [combustionSystem, setCombustionSystem] = useState('')
  const [editingMeasurement, setEditingMeasurement] = useState(null)

  const saveMeasurement = (row) => {
    setMeasurementRows((current) => {
      if (editingMeasurement?.id) {
        return current.map((item) => (item.id === editingMeasurement.id ? { ...row, id: editingMeasurement.id } : item))
      }

      return [...current, { ...row, id: Date.now() }]
    })
    setEditingMeasurement(null)
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="th">
      <Stack spacing={2}>
        <SectionPaper title="ข้อมูลทั่วไปของโรงงาน">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReadOnlyField label="ชื่อโรงงาน" value={factory?.factoryName ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ทะเบียนโรงงานเลขที่" value={factory?.newRegistrationNo ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ลำดับประเภทโรงงาน" value={factory?.industryType ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 12 }}>
              <ReadOnlyField label="สถานที่ตั้งโรงงาน" value={factory?.address ?? ''} multiline />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactName" label="รายชื่อผู้ติดต่อ" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactPhone" label="เบอร์โทรศัพท์" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactEmail" label="e-mail" type="email" size="small" fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="ข้อมูลจุดตรวจวัด">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="รหัสจุดตรวจวัด" value={point?.code ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ชื่อจุดตรวจวัด" value={point?.name ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="productionStack" label="ปล่องจากกระบวนการผลิต" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="primaryFuel" label="เชื้อเพลิงหลัก" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="secondaryFuel" label="เชื้อเพลิงสำรอง" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                name="combustionSystem"
                label="ระบบการเผาไหม้เชื้อเพลิง"
                size="small"
                value={combustionSystem}
                onChange={(event) => setCombustionSystem(event.target.value)}
                fullWidth
              >
                <MenuItem value="ระบบปิด">ระบบปิด</MenuItem>
                <MenuItem value="ระบบเปิด">ระบบเปิด</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="productionCapacity" label="กำลังการผลิตของหน่วยการผลิต" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="productionCapacityUnit" label="หน่วยของกำลังการผลิต" size="small" fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="รายการตรวจวัดมลพิษอากาศจากปล่องระบาย">
          <Stack spacing={1.5}>
            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={() => setEditingMeasurement({})}>
                เพิ่มข้อมูล
              </Button>
            </Stack>
            <TableContainer sx={{ border: 1, borderColor: 'divider', overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 1500, ...borderedTableSx }}>
                <TableHead>
                  <TableRow>
                    {[
                      'รายการสารมลพิษ',
                      'วันที่เก็บตัวอย่าง',
                      'ค่าที่ตรวจวัดได้',
                      'หน่วยการตรวจวัด',
                      'เลขที่ห้องปฏิบัติการ',
                      'เลขที่รายงาน',
                      'วิธีการตรวจวัดวิเคราะห์',
                      'ภาพถ่ายขณะเก็บตัวอย่าง',
                      'รายงานผลจากห้องปฏิบัติการ',
                      'จัดการ',
                    ].map((column) => (
                      <TableCell key={column} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>
                        {column}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {measurementRows.length > 0 ? (
                    measurementRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.pollutant}</TableCell>
                        <TableCell>{formatThaiDateValue(row.sampleDate)}</TableCell>
                        <TableCell>{row.measuredValue}</TableCell>
                        <TableCell>{row.unit}</TableCell>
                        <TableCell>{row.laboratoryNo}</TableCell>
                        <TableCell>{row.reportNo}</TableCell>
                        <TableCell>{row.method}</TableCell>
                        <TableCell>{row.samplingPhotoFileName}</TableCell>
                        <TableCell>{row.labReportFileName}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} sx={tableActionStackSx}>
                            <Button size="small" variant="outlined" onClick={() => setEditingMeasurement(row)}>
                              แก้ไข
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              onClick={() => setMeasurementRows((current) => current.filter((item) => item.id !== row.id))}
                            >
                              ลบ
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} align="center">
                        <Typography variant="body2" color="text.secondary">
                          ไม่มีข้อมูลรายการตรวจวัด
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Alert severity="info">
              หมายเหตุ : การเก็บและวิเคราะห์ตัวอย่างต้องดําเนินการโดยห้องปฏิบัติการวิเคราะห์ของหน่วยงานราชการ
              หรือห้องปฏิบัติการวิเคราะห์เอกชนที่ขึ้นทะเบียนกับกรมโรงงานอุตสาหกรรม
            </Alert>
          </Stack>
        </SectionPaper>

        <SectionPaper title="ผู้ประกอบกิจการโรงงานหรือผู้รับมอบอำนาจ (ผู้จัดทำรายงาน)">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField name="reporterName" label="ชื่อ-นามสกุล" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField name="reporterPosition" label="ตำแหน่ง" size="small" fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>
      </Stack>
      <EmissionMeasurementDialog
        open={Boolean(editingMeasurement)}
        value={editingMeasurement?.id ? editingMeasurement : null}
        onClose={() => setEditingMeasurement(null)}
        onSave={saveMeasurement}
      />
    </LocalizationProvider>
  )
}

function Kwp03Form({
  factory,
  point,
  problemDate,
  expectedDoneDate,
  instruments,
  measurementTimes,
  issueReasons,
  failedParameters,
  onProblemDateChange,
  onExpectedDoneDateChange,
  onInstrumentsChange,
  onMeasurementTimesChange,
  onIssueReasonsChange,
  onFailedParametersChange,
}) {
  const totalDays = getDayRange(problemDate, expectedDoneDate)

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="th">
      <Stack spacing={2}>
        <SectionPaper title="รายละเอียดเกี่ยวกับโรงงาน">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReadOnlyField label="ชื่อโรงงาน" value={factory?.factoryName ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ทะเบียนโรงงานเลขที่" value={factory?.newRegistrationNo ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ลำดับประเภทโรงงาน" value={factory?.industryType ?? ''} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <ReadOnlyField label="สถานที่ตั้งโรงงาน" value={factory?.address ?? ''} multiline />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactName" label="รายชื่อผู้ติดต่อ" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactPhone" label="เบอร์โทรศัพท์" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="contactEmail" label="e-mail" type="email" size="small" fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="ข้อมูลจุดตรวจวัด">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="รหัสจุดตรวจวัด" value={point?.code ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ชื่อจุดตรวจวัด" value={point?.name ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <OptionMultiSelect
                label="เครื่องตรวจวัด"
                value={instruments}
                onChange={onInstrumentsChange}
                options={wpmsInstrumentOptions}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <OptionMultiSelect
                label="เวลาเครื่องตรวจวัด"
                value={measurementTimes}
                onChange={onMeasurementTimesChange}
                options={wpmsMeasurementTimeOptions}
              />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="ข้อมูลนํ้าทิ้งระบายออกนอกโรงงาน (กรอกเฉพาะเครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง)">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="wastewaterSource" label="แหล่งกำเนิดน้ำเสีย" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="receivingSource" label="แหล่งรองรับน้ำทิ้ง" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="treatmentSystemType" label="ประเภทรบบบำบัด" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="dischargePoint" label="พิกัดจุดระบายน้ำทิ้ง" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="averageDischarge" label="ปริมาณนํ้าทิ้งระบายออกวันที่ขัดข้อง (ลบ.ม./วัน) เฉลี่ย" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="minimumDischarge" label="ปริมาณนํ้าทิ้งระบายออกวันที่ขัดข้อง (ลบ.ม./วัน) ต่ำสุด" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="maximumDischarge" label="ปริมาณนํ้าทิ้งระบายออกวันที่ขัดข้อง (ลบ.ม./วัน) สูงสุด" size="small" fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="สาเหตุของการไม่สามารถรายงานผลการตรวจวัดได้">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <OptionMultiSelect
                label="สาเหตุ"
                value={issueReasons}
                onChange={onIssueReasonsChange}
                options={wpmsIssueReasonOptions}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField name="reasonDetail" label="เนื่องจาก" size="small" multiline minRows={3} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <DatePicker
                label="วัน/เดือน/ปี ที่พบปัญหาหรือหยุดหน่วยการผลิต"
                value={problemDate}
                onChange={onProblemDateChange}
                format="DD/MM/BBBB"
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <DatePicker
                label="วัน/เดือน/ปี ที่คาดว่าจะดำเนินการแล้วเสร็จ"
                value={expectedDoneDate}
                onChange={onExpectedDoneDateChange}
                format="DD/MM/BBBB"
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="รวมระยะเวลา (วัน)" value={totalDays} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <OptionMultiSelect
                label="รายการตรวจวัด (พารามิเตอร์) ที่ไม่สามารถรายงานผลได้"
                value={failedParameters}
                onChange={onFailedParametersChange}
                options={wpmsParameterOptions}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                name="correctiveAction"
                label="แนวทางการปรับปรุงแก้ไข"
                size="small"
                multiline
                minRows={3}
                fullWidth
              />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="ผู้จัดทำรายงาน/ผู้ดูแลระบบบำบัด">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField name="reporterName" label="ชื่อ-นามสกุล" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField name="reporterPosition" label="ตำแหน่ง" size="small" fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>
      </Stack>
    </LocalizationProvider>
  )
}

const emptyCalibrationResult = {
  parameter: '',
  startDate: null,
  endDate: null,
  result: '',
  verifierCompany: '',
  cemsModel: '',
  linkQr1: '',
  linkQr2: '',
}

function CalibrationResultDialog({ open, value, onClose, onSave }) {
  if (!open) {
    return null
  }

  return (
    <CalibrationResultDialogContent
      key={value?.id ?? 'new'}
      value={value}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

function CalibrationResultDialogContent({ value, onClose, onSave }) {
  const [form, setForm] = useState(value ?? emptyCalibrationResult)

  const updateForm = (field, nextValue) => {
    setForm((current) => ({ ...current, [field]: nextValue }))
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{value ? 'แก้ไขรายการผลการสอบเทียบหรือทวนสอบ CEMS' : 'เพิ่มรายการผลการสอบเทียบหรือทวนสอบ CEMS'}</DialogTitle>
      <DialogContent dividers>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="th">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                label="พารามิเตอร์"
                size="small"
                value={form.parameter}
                onChange={(event) => updateForm('parameter', event.target.value)}
                fullWidth
              >
                {cemsParameterOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <DatePicker
                label="วันที่เริ่มดำเนินการ"
                value={form.startDate}
                onChange={(nextValue) => updateForm('startDate', nextValue)}
                format="DD/MM/BBBB"
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <DatePicker
                label="วันที่สิ้นสุดดำเนินการ"
                value={form.endDate}
                onChange={(nextValue) => updateForm('endDate', nextValue)}
                format="DD/MM/BBBB"
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                label="ผลการตรวจสอบ"
                size="small"
                value={form.result}
                onChange={(event) => updateForm('result', event.target.value)}
                fullWidth
              >
                {calibrationResultOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                label="บริษัทที่ทำการทวนสอบ / สอบเทียบ"
                size="small"
                value={form.verifierCompany}
                onChange={(event) => updateForm('verifierCompany', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                label="ยี่ห้อ/รุ่นของ CEMS"
                size="small"
                value={form.cemsModel}
                onChange={(event) => updateForm('cemsModel', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                label="Link / QR CODE"
                size="small"
                value={form.linkQr1}
                onChange={(event) => updateForm('linkQr1', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                label="Link / QR CODE"
                size="small"
                value={form.linkQr2}
                onChange={(event) => updateForm('linkQr2', event.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>
        </LocalizationProvider>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={() => onSave(form)}>
          บันทึก
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function Kwp05Form({ factory, point, calibrationRows, setCalibrationRows }) {
  const [editingCalibration, setEditingCalibration] = useState(null)

  const saveCalibration = (row) => {
    setCalibrationRows((current) => {
      if (editingCalibration?.id) {
        return current.map((item) => (item.id === editingCalibration.id ? { ...row, id: editingCalibration.id } : item))
      }

      return [...current, { ...row, id: Date.now() }]
    })
    setEditingCalibration(null)
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="th">
      <Stack spacing={2}>
        <SectionPaper title="ข้อมูลทั่วไปของบริษัท/โรงงาน">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReadOnlyField label="ชื่อบริษัท" value={factory?.factoryName ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="เลขทะเบียนโรงงาน" value={factory?.newRegistrationNo ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="businessActivity" label="ประกอบกิจการ" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 12 }}>
              <ReadOnlyField label="สถานที่ตั้งโรงงาน" value={factory?.address ?? ''} multiline />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="reportRound" label="ครั้งที่" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="reportYear" label="ประจำปี พ.ศ." size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="samplerName" label="ผู้เก็บตัวอย่าง" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="officerRegistration" label="ทะเบียนเจ้าหน้าที่" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField name="laboratoryName" label="หน่วยงาน/ชื่อห้องปฏิบัติการ" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="laboratoryRegistration" label="ทะเบียนห้องปฏิบัติการ" size="small" fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="ข้อมูลจุดตรวจวัดและเครื่องมือ">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="รหัสจุดตรวจวัด" value={point?.code ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ชื่อจุดตรวจวัด" value={point?.name ?? ''} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField name="cemsBrand" label="ยี่ห้อ (Brand)" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                name="cemsDetail"
                label="รายละเอียดของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ"
                size="small"
                fullWidth
              />
            </Grid>
          </Grid>
        </SectionPaper>

        <SectionPaper title="รายการผลการสอบเทียบหรือทวนสอบ CEMS">
          <Stack spacing={1.5}>
            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={() => setEditingCalibration({})}>
                เพิ่มข้อมูล
              </Button>
            </Stack>
            <TableContainer sx={{ border: 1, borderColor: 'divider', overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 1280, ...borderedTableSx }}>
                <TableHead>
                  <TableRow>
                    {[
                      'พารามิเตอร์',
                      'วันที่เริ่มดำเนินการ',
                      'วันที่สิ้นสุดดำเนินการ',
                      'ผลการตรวจสอบ',
                      'บริษัทที่ทำการทวนสอบ / สอบเทียบ',
                      'ยี่ห้อ/รุ่นของ CEMS',
                      'Link / QR CODE',
                      'Link / QR CODE',
                      'จัดการ',
                    ].map((column) => (
                      <TableCell key={column} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>
                        {column}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {calibrationRows.length > 0 ? (
                    calibrationRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.parameter}</TableCell>
                        <TableCell>{formatThaiDateValue(row.startDate)}</TableCell>
                        <TableCell>{formatThaiDateValue(row.endDate)}</TableCell>
                        <TableCell>{row.result}</TableCell>
                        <TableCell>{row.verifierCompany}</TableCell>
                        <TableCell>{row.cemsModel}</TableCell>
                        <TableCell>{row.linkQr1}</TableCell>
                        <TableCell>{row.linkQr2}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} sx={tableActionStackSx}>
                            <Button size="small" variant="outlined" onClick={() => setEditingCalibration(row)}>
                              แก้ไข
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              onClick={() => setCalibrationRows((current) => current.filter((item) => item.id !== row.id))}
                            >
                              ลบ
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        <Typography variant="body2" color="text.secondary">
                          ไม่มีข้อมูลรายการผลการสอบเทียบหรือทวนสอบ CEMS
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </SectionPaper>

        <SectionPaper title="ผู้รายงานผลการทดสอบ">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField name="reporterName" label="ชื่อ-นามสกุล" size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField name="reporterPosition" label="ตำแหน่ง" size="small" fullWidth />
            </Grid>
          </Grid>
        </SectionPaper>
      </Stack>
      <CalibrationResultDialog
        open={Boolean(editingCalibration)}
        value={editingCalibration?.id ? editingCalibration : null}
        onClose={() => setEditingCalibration(null)}
        onSave={saveCalibration}
      />
    </LocalizationProvider>
  )
}

function KwpFormBottomSheet({ form, open, onClose }) {
  const formRef = useRef(null)
  const [problemDate, setProblemDate] = useState(null)
  const [expectedDoneDate, setExpectedDoneDate] = useState(null)
  const [unreportedParameters, setUnreportedParameters] = useState([])
  const [measurementRows, setMeasurementRows] = useState([])
  const [wpmsInstruments, setWpmsInstruments] = useState([])
  const [wpmsMeasurementTimes, setWpmsMeasurementTimes] = useState([])
  const [wpmsIssueReasons, setWpmsIssueReasons] = useState([])
  const [wpmsFailedParameters, setWpmsFailedParameters] = useState([])
  const [calibrationRows, setCalibrationRows] = useState([])
  const [previewData, setPreviewData] = useState(null)
  const headerCode = form?.code ?? form?.title?.split(' ')?.[0] ?? ''
  const headerTitle = form?.titleText ?? form?.title?.replace(`${headerCode} `, '') ?? ''
  const headerDescription = form?.description ?? ''
  const latestRevisionMessage = form?.latestRevisionMessage ?? ''
  const isEditMode = form?.mode === 'edit'

  const openPreview = () => {
    if (form?.title?.startsWith('กวภ.05')) {
      setPreviewData(buildKwp05PreviewData(form, formRef.current, calibrationRows))
      return
    }

    if (form?.title?.startsWith('กวภ.03')) {
      setPreviewData(buildKwp03PreviewData(
        form,
        formRef.current,
        { problemDate, expectedDoneDate },
        {
          instruments: wpmsInstruments,
          measurementTimes: wpmsMeasurementTimes,
          issueReasons: wpmsIssueReasons,
          failedParameters: wpmsFailedParameters,
        },
      ))
      return
    }

    if (form?.title?.startsWith('กวภ.02') || form?.title?.startsWith('กวภ.04')) {
      setPreviewData(buildKwp02PreviewData(form, formRef.current, measurementRows))
      return
    }

    if (form?.title?.startsWith('กวภ.01')) {
      setPreviewData(buildKwp01PreviewData(
        form,
        formRef.current,
        { problemDate, expectedDoneDate },
        unreportedParameters,
      ))
    }
  }

  return (
    <>
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
            <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1, textAlign: 'center' }}>
              <Typography variant="h6" component="h2" fontWeight={700}>
                {headerCode} {headerTitle}
              </Typography>
              {headerDescription ? (
                <Typography variant="body2" color="text.secondary">
                  {headerDescription}
                </Typography>
              ) : null}
            </Stack>
            <IconButton aria-label="ปิด" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <Divider />
          <Box
            component="form"
            ref={formRef}
            sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: { xs: 2, md: 3 } }}
          >
            {latestRevisionMessage ? (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 2,
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
            {form?.title?.startsWith('กวภ.01') ? (
              <Kwp01Form
                factory={form.factory}
                point={form.point}
                problemDate={problemDate}
                expectedDoneDate={expectedDoneDate}
                unreportedParameters={unreportedParameters}
                onProblemDateChange={setProblemDate}
                onExpectedDoneDateChange={setExpectedDoneDate}
                onUnreportedParametersChange={setUnreportedParameters}
              />
            ) : form?.title?.startsWith('กวภ.03') ? (
              <Kwp03Form
                factory={form.factory}
                point={form.point}
                problemDate={problemDate}
                expectedDoneDate={expectedDoneDate}
                instruments={wpmsInstruments}
                measurementTimes={wpmsMeasurementTimes}
                issueReasons={wpmsIssueReasons}
                failedParameters={wpmsFailedParameters}
                onProblemDateChange={setProblemDate}
                onExpectedDoneDateChange={setExpectedDoneDate}
                onInstrumentsChange={setWpmsInstruments}
                onMeasurementTimesChange={setWpmsMeasurementTimes}
                onIssueReasonsChange={setWpmsIssueReasons}
                onFailedParametersChange={setWpmsFailedParameters}
              />
            ) : form?.title?.startsWith('กวภ.02') || form?.title?.startsWith('กวภ.04') ? (
              <Kwp02Form
                factory={form.factory}
                point={form.point}
                measurementRows={measurementRows}
                setMeasurementRows={setMeasurementRows}
              />
            ) : form?.title?.startsWith('กวภ.05') ? (
              <Kwp05Form
                factory={form.factory}
                point={form.point}
                calibrationRows={calibrationRows}
                setCalibrationRows={setCalibrationRows}
              />
            ) : null}
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
            <Button variant="contained" onClick={openPreview}>
              {isEditMode ? 'บันทึกการแก้ไข' : 'บันทึกแบบฟอร์ม'}
            </Button>
          </Stack>
        </Stack>
      </Drawer>
      <Kwp01PreviewDialog
        open={Boolean(previewData)}
        data={previewData}
        onClose={() => setPreviewData(null)}
      />
    </>
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

function getRequestColumns(onOpenDocument, isOperator = false) {
  return [
    { field: 'factoryName', headerName: 'ชื่อโรงงาน/บริษัท', width: 240 },
    {
      field: 'factoryRegistration',
      headerName: 'เลขทะเบียนโรงงาน',
      width: 190,
      sortable: false,
    },
    { field: 'province', headerName: 'จังหวัด', width: 130 },
    { field: 'type', headerName: 'ประเภทจุดตรวจวัด', width: 150 },
    { field: 'monitoringPointCode', headerName: 'รหัสจุดตรวจวัด', width: 170 },
    { field: 'requestNo', headerName: 'เลขที่คำขอ', width: 150 },
    { field: 'form', headerName: 'แบบฟอร์ม', width: 150 },
    { field: 'submittedDate', headerName: 'วันที่ยื่นคำขอ', width: 150 },
    { field: 'reviewedDate', headerName: 'วันที่พิจารณา', width: 150 },
    { field: 'status', headerName: 'สถานะ', width: 170 },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: isOperator ? 250 : 190,
      sortable: false,
      filterable: false,
      renderCell: (params) => <RequestActions row={params.row} isOperator={isOperator} onOpenDocument={onOpenDocument} />,
    },
  ]
}

function KwpFormsPage({ userType = '' }) {
  const isOperator = userType === 'operator'
  const availableSubMenus = isOperator ? operatorSubMenus : officerSubMenus
  const [monitoringPointFactory, setMonitoringPointFactory] = useState(null)
  const [selectedForm, setSelectedForm] = useState(null)
  const [requestDocument, setRequestDocument] = useState(null)
  const [selectedSubMenu, setSelectedSubMenu] = useState(() => (isOperator ? 'factories' : 'requests'))
  const effectiveSubMenu = availableSubMenus.some((menu) => menu.value === selectedSubMenu)
    ? selectedSubMenu
    : availableSubMenus[0].value
  const factoryColumns = useMemo(() => getFactoryColumns(setMonitoringPointFactory), [])
  const requestColumns = useMemo(
    () => getRequestColumns((row, mode) => {
      if (isOperator && mode === 'edit') {
        setSelectedForm(buildKwpEditForm(row))
        return
      }

      setRequestDocument({
        mode,
        data: buildKwpRequestPreviewData(row),
      })
    }, isOperator),
    [isOperator],
  )
  const table = useMemo(
    () =>
      effectiveSubMenu === 'factories'
        ? {
            title: 'รายชื่อโรงงาน',
            columns: factoryColumns,
            rows: factoryRows,
          }
        : {
            title: 'รายการคำขอ',
            columns: requestColumns,
            rows: requestRows,
          },
    [effectiveSubMenu, factoryColumns, requestColumns],
  )
  const isStatisticsSubMenu = effectiveSubMenu === 'statistics'

  return (
    <>
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
              แจ้งแบบ กวภ.01 - กวภ. 05
            </Typography>
            <Tabs
              value={effectiveSubMenu}
              onChange={(_, value) => setSelectedSubMenu(value)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="เมนูย่อยแจ้งแบบ กวภ.01 - กวภ. 05"
              sx={{
                minHeight: 40,
                '& .MuiTab-root': {
                  minHeight: 40,
                },
              }}
            >
              {availableSubMenus.map((menu) => (
                <Tab
                  key={menu.value}
                  value={menu.value}
                  label={
                    menu.badgeContent ? (
                      <Badge
                        badgeContent={menu.badgeContent}
                        color="error"
                        sx={{
                          pr: 2,
                          '& .MuiBadge-badge': {
                            right: 2,
                            top: 2,
                          },
                        }}
                      >
                        <Box component="span">{menu.label}</Box>
                      </Badge>
                    ) : (
                      menu.label
                    )
                  }
                />
              ))}
            </Tabs>
          </Stack>
        </Paper>

        {isStatisticsSubMenu ? (
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <OfficerStatisticsPanel title="สถิติข้อมูลแบบแจ้ง กวภ.01 - กวภ.05" />
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
        )}
      </Stack>
      <MonitoringPointDialog
        open={Boolean(monitoringPointFactory)}
        factory={monitoringPointFactory}
        onClose={() => setMonitoringPointFactory(null)}
        onSelectForm={(form) => {
          setSelectedForm(form)
          setMonitoringPointFactory(null)
        }}
      />
      <KwpFormBottomSheet
        key={selectedForm ? `${selectedForm.requestNo ?? 'new'}-${selectedForm.code ?? 'form'}-${selectedForm.mode ?? 'create'}` : 'empty-form'}
        open={Boolean(selectedForm)}
        form={selectedForm}
        onClose={() => setSelectedForm(null)}
      />
      <Kwp01PreviewDialog
        open={Boolean(requestDocument)}
        data={requestDocument?.data}
        mode={requestDocument?.mode}
        onClose={() => setRequestDocument(null)}
      />
    </>
  )
}

export default KwpFormsPage
