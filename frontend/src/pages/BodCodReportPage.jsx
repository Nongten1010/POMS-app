import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  Grid,
  MenuItem,
  Paper,
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
import { DataGrid } from '@mui/x-data-grid'

const appBarHeight = {
  xs: 64,
  md: 72,
}

const operatorSubMenus = [
  { value: 'factories', label: 'รายชื่อโรงงาน' },
  { value: 'history', label: 'ประวัติการรายงาน' },
]

const officerSubMenus = [
  { value: 'reports', label: 'รายการส่งแบบรายงาน' },
]

const currentDate = new Date()
const currentMonth = 6
const currentBuddhistYear = currentDate.getFullYear() + 543
const isFirstRoundPeriod = currentMonth >= 1 && currentMonth <= 6
const isSecondRoundPeriod = currentMonth >= 7 && currentMonth <= 12

const factoryRows = [
  {
    id: 1,
    factoryName: 'บริษัท ปูนซีเมนต์นครหลวง จำกัด (มหาชน)',
    factoryRegistration: '10190000225448',
    industryType: 'ผลิตปูนซีเมนต์',
    province: 'สระบุรี',
    monitoringPointCount: 3,
  },
  {
    id: 2,
    factoryName: 'บริษัท อินทรี อีโคไซเคิล จำกัด',
    factoryRegistration: '10190003325500',
    industryType: 'จัดการของเสีย',
    province: 'สระบุรี',
    monitoringPointCount: 1,
  },
]

const monitoringPointRowsByFactoryId = {
  1: [
    {
      id: 1,
      code: 'WP001',
      name: 'จุดระบายน้ำทิ้ง A',
      type: 'WPMS',
      parameters: 'BOD, COD',
      round1Status: 'ยังไม่ยื่น',
      round2Status: 'ยังไม่ยื่น',
    },
    {
      id: 2,
      code: 'WP002',
      name: 'จุดระบายน้ำทิ้ง B',
      type: 'WPMS',
      parameters: 'BOD, COD',
      round1Status: 'ผ่านการพิจารณา',
      round2Status: 'ยังไม่ยื่น',
    },
    {
      id: 4,
      code: 'WP004',
      name: 'จุดระบายน้ำทิ้งสำรอง',
      type: 'WPMS',
      parameters: 'pH, flow',
      round1Status: 'ยังไม่ยื่น',
      round2Status: 'ยังไม่ยื่น',
    },
  ],
  2: [
    {
      id: 3,
      code: 'WP003',
      name: 'จุดระบายน้ำทิ้งหลัก',
      type: 'WPMS',
      parameters: 'BOD, COD',
      round1Status: 'รอโรงงานแก้ไข',
      round2Status: 'ยังไม่ยื่น',
    },
  ],
}

const reportRows = [
  {
    id: 1,
    factoryName: 'บริษัท ปูนซีเมนต์นครหลวง จำกัด (มหาชน)',
    factoryRegistration: '10190000225448',
    province: 'สระบุรี',
    monitoringPointCode: 'WP001',
    monitoringPointName: 'จุดระบายน้ำทิ้ง A',
    reportRound: 'ครั้งที่ 1',
    year: currentBuddhistYear,
    reportNo: `BODCOD-${currentBuddhistYear}-0001`,
    submittedDate: '15/06/2569',
    reviewedDate: '-',
    status: 'รอพิจารณา',
  },
  {
    id: 2,
    factoryName: 'บริษัท อินทรี อีโคไซเคิล จำกัด',
    factoryRegistration: '10190003325500',
    province: 'สระบุรี',
    monitoringPointCode: 'WP003',
    monitoringPointName: 'จุดระบายน้ำทิ้งหลัก',
    reportRound: 'ครั้งที่ 1',
    year: currentBuddhistYear,
    reportNo: `BODCOD-${currentBuddhistYear}-0002`,
    submittedDate: '12/06/2569',
    reviewedDate: '18/06/2569',
    status: 'รอโรงงานแก้ไข',
  },
  {
    id: 3,
    factoryName: 'บริษัท ปูนซีเมนต์นครหลวง จำกัด (มหาชน)',
    factoryRegistration: '10190000225448',
    province: 'สระบุรี',
    monitoringPointCode: 'WP002',
    monitoringPointName: 'จุดระบายน้ำทิ้ง B',
    reportRound: 'ครั้งที่ 2',
    year: currentBuddhistYear - 1,
    reportNo: `BODCOD-${currentBuddhistYear - 1}-0018`,
    submittedDate: '20/12/2568',
    reviewedDate: '24/12/2568',
    status: 'ผ่านการพิจารณา',
  },
]

const officerReportRows = [
  reportRows[0],
  {
    ...reportRows[1],
    status: 'แก้ไขแล้ว/รอพิจารณา',
    submittedDate: '20/06/2569',
    reviewedDate: '-',
  },
  reportRows[2],
]

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

function StatusChip({ value }) {
  if (value === '-') {
    return <Typography variant="body2">-</Typography>
  }

  const color =
    value === 'ผ่านการพิจารณา'
      ? 'success'
      : value === 'รอพิจารณา' || value === 'แก้ไขแล้ว/รอพิจารณา'
        ? 'warning'
        : value === 'รอโรงงานแก้ไข'
          ? 'error'
          : value === 'ยังไม่ยื่น'
            ? 'default'
            : 'info'

  return <Chip size="small" color={color} label={value || '-'} />
}

function hasBodCodParameter(parameters = '') {
  return /\b(BOD|COD)\b/i.test(parameters)
}

function PaperLine({ children, minWidth = 160 }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        minWidth,
        borderBottom: '1px dotted #222',
        px: 0.5,
        minHeight: 20,
      }}
    >
      {children}
    </Box>
  )
}

function BodCodPaperDocument({ report }) {
  const rowsForPaper = report.measurementRows?.length
    ? report.measurementRows
    : [{ id: 'empty-1' }]
  const roundNo = report.roundNo ?? report.reportRound?.replace('ครั้งที่ ', '') ?? ''
  const selectedParameters = Array.isArray(report.parameter) ? report.parameter : [report.parameter].filter(Boolean)

  return (
    <Paper
      elevation={0}
      sx={{
        width: 794,
        minHeight: 1123,
        mx: 'auto',
        p: '42px 56px',
        color: '#000',
        bgcolor: '#fff',
        fontFamily: 'Kanit, sans-serif',
        fontSize: 14,
        lineHeight: 1.8,
      }}
    >
      <Stack spacing={1.6}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
            แบบรายงานผลการตรวจสอบความคลาดเคลื่อนของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
            และเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติม
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
            ครั้งที่ <PaperLine minWidth={70}>{roundNo}</PaperLine>/ปี<PaperLine minWidth={90}>{report.year}</PaperLine>
          </Typography>
        </Box>

        <Box>
          ชื่อบริษัท : <PaperLine minWidth={330}>{report.factoryName}</PaperLine>
        </Box>
        <Box>
          เลขทะเบียนโรงงาน : <PaperLine minWidth={170}>{report.factoryRegistration}</PaperLine>
          ประกอบกิจการ : <PaperLine minWidth={220}>{report.businessActivity}</PaperLine>
        </Box>
        <Box>
          สถานที่ตั้ง : <PaperLine minWidth={520}>{report.factoryAddress}</PaperLine>
        </Box>
        <Box>
          ปริมาณการระบายน้ำทิ้งขณะเก็บตัวอย่าง : <PaperLine minWidth={260}>{report.wastewaterFlow}</PaperLine> ลบ.ม./ชั่วโมง
        </Box>
        <Box>
          ผู้เก็บตัวอย่าง : <PaperLine minWidth={245}>{report.samplerName}</PaperLine>
          ทะเบียนเจ้าหน้าที่ : <PaperLine minWidth={180}>{report.officerRegistration}</PaperLine>
        </Box>
        <Box>
          หน่วยงาน/ชื่อห้องปฏิบัติการ : <PaperLine minWidth={420}>{report.laboratoryName}</PaperLine>
        </Box>
        <Box>
          ทะเบียนห้องปฏิบัติการ : <PaperLine minWidth={170}>{report.laboratoryRegistration}</PaperLine>
          เลขที่ใบรายงานผลวิเคราะห์ : <PaperLine minWidth={170}>{report.labReportNo}</PaperLine>
        </Box>
        <Box>
          วิธีวิเคราะห์ทดสอบในห้องปฏิบัติการ : <PaperLine minWidth={420}>{report.analysisMethod}</PaperLine>
        </Box>
        <Box>
          รายละเอียดของเครื่องมือหรือเครื่องอุปกรณ์พิเศษฯ : ยี่ห้อ (Brand) : <PaperLine minWidth={210}>{report.deviceBrand}</PaperLine>
        </Box>
        <Box>
          รุ่น (Model) : <PaperLine minWidth={210}>{report.deviceModel}</PaperLine>
          หมายเลขเครื่อง (Serial No.) : <PaperLine minWidth={200}>{report.serialNo}</PaperLine>
        </Box>
        <Box>
          รายการที่ตรวจสอบค่าความคลาดเคลื่อน :{' '}
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, mr: 2 }}>
            <Box component="span" sx={{ width: 16, height: 16, border: '1px solid #333' }}>{selectedParameters.includes('BOD') ? '/' : ''}</Box>
            BOD
          </Box>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Box component="span" sx={{ width: 16, height: 16, border: '1px solid #333' }}>{selectedParameters.includes('COD') ? '/' : ''}</Box>
            COD
          </Box>
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
                textAlign: 'center',
                verticalAlign: 'middle',
              },
              '& th': {
                bgcolor: '#c9c9c9',
                fontWeight: 700,
              },
            }}
          >
            <TableHead>
              <TableRow>
                {[
                  'วันที่เก็บตัวอย่าง',
                  'เวลาที่เก็บตัวอย่าง',
                  'ค่าที่เครื่องมือตรวจวัดได้ (มก./ลิตร) (M)',
                  'ค่าที่ห้องปฏิบัติการวิเคราะห์ได้ (มก./ลิตร) (T)',
                  'ค่าความคลาดเคลื่อน (มก./ลิตร) (E)',
                  'ค่าความคลาดเคลื่อนตามประกาศฯ (มก./ลิตร)',
                ].map((column) => (
                  <TableCell key={column}>{column}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rowsForPaper.map((row) => (
                <TableRow key={row.id} sx={{ height: 88 }}>
                  <TableCell>{row.sampleDate}</TableCell>
                  <TableCell>{row.sampleTime}</TableCell>
                  <TableCell>{row.deviceValue}</TableCell>
                  <TableCell>{row.labValue}</TableCell>
                  <TableCell>{row.errorValue}</TableCell>
                  <TableCell>{row.standardErrorValue}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ fontSize: 13 }}>
          <Box sx={{ fontWeight: 700 }}>หมายเหตุ</Box>
          <Box>1. คำนวณค่าความคลาดเคลื่อน โดยใช้สูตร E = M - T</Box>
          <Box>
            โดย E = ค่าความคลาดเคลื่อนของเครื่องตรวจวัดค่า BOD หรือเครื่องตรวจวัดค่า COD (มิลลิกรัมต่อลิตร)
          </Box>
          <Box>
            M = ผลการตรวจวัดค่า BOD หรือ COD ที่ได้จากเครื่องมือหรือเครื่องอุปกรณ์พิเศษขณะเก็บตัวอย่างน้ำ
          </Box>
          <Box>
            T = ผลการตรวจวัดค่า BOD หรือ COD ที่ได้จากห้องปฏิบัติการ (มิลลิกรัมต่อลิตร)
          </Box>
          <Box>2. ในกรณีที่ผลตรวจวัดค่า BOD หรือ COD น้อยกว่าขีดจำกัดในการวิเคราะห์ของห้องปฏิบัติการให้ใช้ค่าจริงที่วิเคราะห์ได้ในการคำนวณ</Box>
          <Box>3. การปัดเศษ ให้เป็นไปตาม มอก.929-2533</Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Box sx={{ width: 360, fontSize: 13, lineHeight: 1.8 }}>
            <Box>ผู้รายงานผลการทดสอบ <PaperLine minWidth={180}>{report.reporterName}</PaperLine></Box>
            <Box sx={{ textAlign: 'center' }}>(<PaperLine minWidth={250} />)</Box>
            <Box>ตำแหน่ง <PaperLine minWidth={250}>{report.reporterPosition}</PaperLine></Box>
            <Box>ลงวันที่ <PaperLine minWidth={230} /></Box>
          </Box>
        </Box>
      </Stack>
    </Paper>
  )
}

function ReportPreviewDialog({ open, report, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>แบบฟอร์มรายงานค่าความคลาดเคลื่อน BOD/COD</DialogTitle>
      <DialogContent dividers sx={{ bgcolor: 'neutral.100' }}>
        {report ? <BodCodPaperDocument report={report} /> : null}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center' }}>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          ปิด
        </Button>
        <Button variant="contained">
          ยืนยันการส่งแบบฟอร์ม
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function isBangkokProvince(province = '') {
  return province.includes('กรุงเทพ') || province.includes('กทม')
}

function NoticeBoldText({ children }) {
  return (
    <Box component="span" sx={{ fontWeight: 700 }}>
      {children}
    </Box>
  )
}

function ResultNoticePaperDocument({ report }) {
  const isCentral = isBangkokProvince(report.province)
  const noticeTitle = `แบบแจ้งผลการตรวจสอบ (${isCentral ? 'ส่วนกลาง' : 'ส่วนภูมิภาค'})`
  const checkboxSx = {
    width: 16,
    height: 16,
    border: '2px solid #111',
    display: 'inline-block',
    flex: '0 0 auto',
    mt: 0.45,
  }
  const signatureBlock = (role) => (
    <Box sx={{ width: 250, textAlign: 'center', fontSize: 14, lineHeight: 1.55 }}>
      <Box sx={{ borderBottom: '1px dotted #111', height: 22 }} />
      <Box>(<Box component="span" sx={{ display: 'inline-block', minWidth: 220, borderBottom: '1px dotted #111' }} />)</Box>
      <Box>ตำแหน่ง <Box component="span" sx={{ display: 'inline-block', minWidth: 150, borderBottom: '1px dotted #111' }} /></Box>
      <Box>{role}</Box>
      <Box>......../........../..........</Box>
    </Box>
  )

  return (
    <Paper
      elevation={0}
      sx={{
        width: 794,
        minHeight: 1123,
        mx: 'auto',
        p: '24px 26px',
        color: '#000',
        bgcolor: '#fff',
        fontFamily: 'Kanit, sans-serif',
        fontSize: 14.5,
        lineHeight: 1.5,
      }}
    >
      <Stack
        spacing={1.65}
        sx={{
          minHeight: 1075,
          border: '1px solid #333',
          px: 2.25,
          py: 2.75,
        }}
      >
        <Box sx={{ textAlign: 'center', textDecoration: 'underline', mb: 2.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15.5 }}>{noticeTitle}</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 15, maxWidth: 690, mx: 'auto' }}>
            การรายงานค่าความคลาดเคลื่อนของเครื่องมือหรือเครื่องอุปกรณ์พิเศษและเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติมสำหรับตรวจวัด
          </Typography>
        </Box>

        <Box>
          <Box>
            สำหรับโรงงาน : <PaperLine minWidth={245}>{report.factoryName}</PaperLine>
            การรายงานครั้งที่ <PaperLine minWidth={245}>{report.reportRound}</PaperLine>
          </Box>
          <Box>
            ทะเบียนโรงงานเลขที่ : <PaperLine minWidth={215}>{report.factoryRegistration}</PaperLine>
            อ้างอิงรายงานวันที่ : <PaperLine minWidth={230}>{report.submittedDate}</PaperLine>
          </Box>
        </Box>

        <Box sx={{ fontWeight: 700 }}>
          1. ความถูกต้องของแบบรายงาน{' '}
          <Box component="span" sx={{ ...checkboxSx, mx: 0.75, verticalAlign: 'middle' }} /> BOD{' '}
          <Box component="span" sx={{ ...checkboxSx, mx: 0.75, verticalAlign: 'middle' }} /> COD
        </Box>
        <Stack spacing={0.8} sx={{ pl: 3.5, mt: -1 }}>
          <Stack direction="row" spacing={1.35}>
            <Box sx={checkboxSx} />
            <Box>
              แบบรายงาน<NoticeBoldText>ถูกต้องครบถ้วน</NoticeBoldText>ตามประกาศกรมโรงงานอุตสาหกรรม เรื่อง หลักเกณฑ์การให้ความเห็นชอบให้โรงงานที่ต้องมีระบบบำบัดน้ำเสียต้องติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษและเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติม (ฉบับที่ 2) พ.ศ. 2565
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.35}>
            <Box sx={checkboxSx} />
            <Box>
              แบบรายงาน<NoticeBoldText>ไม่ถูกต้องครบถ้วน</NoticeBoldText>ตามประกาศกรมโรงงานอุตสาหกรรม เรื่อง หลักเกณฑ์การให้ความเห็นชอบให้โรงงานที่ต้องมีระบบบำบัดน้ำเสียต้องติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษและเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติม (ฉบับที่ 2) พ.ศ. 2565 เนื่องจาก <PaperLine minWidth={260} />
              <Box sx={{ borderBottom: '1px dotted #111', minHeight: 20 }} />
              <Box sx={{ borderBottom: '1px dotted #111', minHeight: 20 }} />
            </Box>
          </Stack>
        </Stack>

        <Box sx={{ fontWeight: 700 }}>
          2.ค่าความคลาดเคลื่อน{' '}
          <Box component="span" sx={{ ...checkboxSx, mx: 0.75, verticalAlign: 'middle' }} /> BOD{' '}
          <Box component="span" sx={{ ...checkboxSx, mx: 0.75, verticalAlign: 'middle' }} /> COD
        </Box>
        <Stack spacing={0.8} sx={{ pl: 3.5, mt: -1 }}>
          <Stack direction="row" spacing={1.35}>
            <Box sx={checkboxSx} />
            <Box>
              <NoticeBoldText>เป็นไปตามประกาศ</NoticeBoldText>กรมโรงงานอุตสาหกรรม เรื่อง หลักเกณฑ์การให้ความเห็นชอบให้โรงงานที่ต้องมีระบบบำบัดน้ำเสียต้องติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษและเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติม พ.ศ. 2550
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.35}>
            <Box sx={checkboxSx} />
            <Box>
              <NoticeBoldText>ไม่เป็นตามประกาศ</NoticeBoldText>กรมโรงงานอุตสาหกรรม เรื่อง หลักเกณฑ์การให้ความเห็นชอบให้โรงงานที่ต้องมีระบบบำบัดน้ำเสียต้องติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษและเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติม พ.ศ. 2550
            </Box>
          </Stack>
        </Stack>

        <Box sx={{ mt: 3.5 }}>
          <NoticeBoldText>หมายเหตุ</NoticeBoldText> : ในกรณีที่การบันทึกข้อมูลในแบบรายงานไม่ถูกต้องและหรือค่าความเคลื่อนไม่เป็นไปตามประกาศฯ
          <Box sx={{ pl: 7 }}>กรมโรงงานอุตสาหกรรมจะดำเนินการแจ้งผลการตรวจสอบไปยังหน่วยงานกำกับ</Box>
        </Box>

        <Box sx={{ flex: 1 }} />

        {isCentral ? (
          <Stack spacing={4} sx={{ alignItems: 'center' }}>
            <Stack direction="row" spacing={10} sx={{ justifyContent: 'center' }}>
              {signatureBlock('ผู้ตรวจสอบ')}
              {signatureBlock('ผู้ทบทวน')}
            </Stack>
            {signatureBlock('ผู้อนุมัติ')}
          </Stack>
        ) : (
          <Stack direction="row" spacing={10} sx={{ justifyContent: 'center' }}>
            {signatureBlock('ผู้ตรวจสอบ')}
            {signatureBlock('ผู้อนุมัติ')}
          </Stack>
        )}

        <Box sx={{ flex: 0.75 }} />

        <Box sx={{ fontSize: 14 }}>
          {isCentral ? (
            <>
              <Box>
                <NoticeBoldText>สอบถามข้อมูลเพิ่มเติมได้ที่</NoticeBoldText> : ศูนย์เฝ้าระวังสิ่งแวดล้อมอุตสาหกรรม กลุ่มเฝ้าระวังและเตือนภัยมลพิษโรงงาน
              </Box>
              <Box sx={{ pl: 24 }}>โทรศัพท์ : 02-4306312 ต่อ 2109&nbsp;&nbsp; Line : @iemcdiw</Box>
              <Box sx={{ pl: 24 }}>
                ไปรษณีย์อิเล็กทรอนิกส์ : <Box component="span" sx={{ color: '#0645ad', textDecoration: 'underline' }}>poms.support@diw.mail.go.th</Box>
              </Box>
            </>
          ) : (
            <>
              <Box>
                <NoticeBoldText>สอบถามข้อมูลเพิ่มเติมได้ที่</NoticeBoldText> : ศูนย์วิจัยและเตือนภัยมลพิษโรงงานภาค <PaperLine minWidth={190} />
              </Box>
              <Box sx={{ pl: 24 }}>โทรศัพท์ : 02-4306312 ต่อ <PaperLine minWidth={130} /></Box>
              <Box sx={{ pl: 24 }}>ไปรษณีย์อิเล็กทรอนิกส์ : <PaperLine minWidth={220} />(ของแต่ละศูนย์)</Box>
            </>
          )}
        </Box>
      </Stack>
    </Paper>
  )
}

function ResultNoticeDialog({ open, report, onClose }) {
  const title = report && isBangkokProvince(report.province)
    ? 'แบบแจ้งผล (ส่วนกลาง)'
    : 'แบบแจ้งผล (ส่วนภูมิภาค)'

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers sx={{ bgcolor: 'neutral.100' }}>
        {report ? <ResultNoticePaperDocument report={report} /> : null}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center' }}>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          ปิด
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function MonitoringPointDialog({ factory, open, onClose, onOpenReport }) {
  const rows = factory ? (monitoringPointRowsByFactoryId[factory.id] ?? []) : []

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        {factory?.factoryName ? `รายการจุดตรวจวัด - ${factory.factoryName}` : 'รายการจุดตรวจวัด'}
      </DialogTitle>
      <DialogContent dividers>
        <TableContainer sx={{ border: 1, borderColor: 'divider', overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 1180, ...borderedTableSx }}>
            <TableHead>
              <TableRow>
                {[
                  'รหัสจุดตรวจวัด',
                  'ชื่อจุดตรวจวัด',
                  'ประเภทจุดตรวจวัด',
                  'พารามิเตอร์',
                  `ครั้ง 1/${currentBuddhistYear}`,
                  `ครั้ง 2/${currentBuddhistYear}`,
                  'จัดการ',
                ].map((column) => (
                  <TableCell key={column} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>
                    {column}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const canReportParameter = hasBodCodParameter(row.parameters)
                const round1Status = canReportParameter ? row.round1Status : '-'
                const round2Status = canReportParameter ? row.round2Status : '-'
                const canReportRound1 = canReportParameter && isFirstRoundPeriod && row.round1Status === 'ยังไม่ยื่น'
                const canReportRound2 = canReportParameter && isSecondRoundPeriod && row.round2Status === 'ยังไม่ยื่น'

                return (
                  <TableRow key={row.id}>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.parameters}</TableCell>
                    <TableCell><StatusChip value={round1Status} /></TableCell>
                    <TableCell><StatusChip value={round2Status} /></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={tableActionStackSx}>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={!canReportRound1}
                          onClick={() => onOpenReport?.(factory, row, 'ครั้งที่ 1')}
                        >
                          รายงานครั้งที่ 1/{currentBuddhistYear}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={!canReportRound2}
                          onClick={() => onOpenReport?.(factory, row, 'ครั้งที่ 2')}
                        >
                          รายงานครั้งที่ 2/{currentBuddhistYear}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center' }}>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          ปิด
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function makeDraftReport(factory, point, reportRound) {
  const roundNo = reportRound === 'ครั้งที่ 1' ? '1' : '2'

  return {
    id: `draft-${point.id}-${reportRound}`,
    factoryName: factory.factoryName,
    factoryRegistration: factory.factoryRegistration,
    province: factory.province,
    businessActivity: factory.industryType,
    factoryAddress: 'ตำบลทับกวาง อำเภอแก่งคอย จังหวัดสระบุรี',
    monitoringPointCode: point.code,
    monitoringPointName: point.name,
    reportRound,
    roundNo,
    year: currentBuddhistYear,
    reportNo: '-',
    submittedDate: '-',
    reviewedDate: '-',
    status: 'ยังไม่ยื่น',
  }
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

function calculateErrorValue(deviceValue, labValue) {
  const deviceNumber = Number(deviceValue)
  const labNumber = Number(labValue)

  if (!Number.isFinite(deviceNumber) || !Number.isFinite(labNumber)) {
    return ''
  }

  return (deviceNumber - labNumber).toFixed(2)
}

const emptyMeasurementResult = {
  sampleDate: '',
  sampleTime: '',
  deviceValue: '',
  labValue: '',
  standardErrorValue: '',
}

function MeasurementResultDialog({ open, value, onClose, onSave }) {
  if (!open) {
    return null
  }

  return (
    <MeasurementResultDialogContent
      key={value?.id ?? 'new'}
      value={value}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

function MeasurementResultDialogContent({ value, onClose, onSave }) {
  const [form, setForm] = useState(value ?? emptyMeasurementResult)
  const errorValue = calculateErrorValue(form.deviceValue, form.labValue)

  const updateForm = (field, nextValue) => {
    setForm((current) => ({ ...current, [field]: nextValue }))
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{value ? 'แก้ไขผลการตรวจสอบความคลาดเคลื่อน' : 'เพิ่มผลการตรวจสอบความคลาดเคลื่อน'}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="วันที่เก็บตัวอย่าง"
              size="small"
              value={form.sampleDate}
              onChange={(event) => updateForm('sampleDate', event.target.value)}
              placeholder="DD/MM/BBBB"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="เวลาที่เก็บตัวอย่าง"
              size="small"
              value={form.sampleTime}
              onChange={(event) => updateForm('sampleTime', event.target.value)}
              placeholder="HH:mm"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="ค่าที่เครื่องมือตรวจวัดได้ (M)"
              size="small"
              value={form.deviceValue}
              onChange={(event) => updateForm('deviceValue', event.target.value)}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="ค่าที่ห้องปฏิบัติการวิเคราะห์ได้ (T)"
              size="small"
              value={form.labValue}
              onChange={(event) => updateForm('labValue', event.target.value)}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <ReadOnlyField label="ค่าความคลาดเคลื่อน (E)" value={errorValue} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="ค่าความคลาดเคลื่อนตามประกาศฯ"
              size="small"
              value={form.standardErrorValue}
              onChange={(event) => updateForm('standardErrorValue', event.target.value)}
              fullWidth
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center' }}>
        <Button color="inherit" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={() => onSave({ ...form, errorValue })}>
          บันทึก
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function BodCodReportFormSheet({ open, report, onClose, onPreview }) {
  const [form, setForm] = useState({
    wastewaterFlow: '',
    samplerName: '',
    officerRegistration: '',
    laboratoryName: '',
    laboratoryRegistration: '',
    labReportNo: '',
    analysisMethod: '',
    deviceBrand: '',
    deviceModel: '',
    serialNo: '',
    parameter: [],
    reporterName: '',
    reporterPosition: '',
    samplePhotoFileName: '',
    devicePhotoFileName: '',
    labReportFileName: '',
  })
  const [measurementRows, setMeasurementRows] = useState([])
  const [editingMeasurement, setEditingMeasurement] = useState(null)

  if (!report) {
    return null
  }

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }
  const handleFileChange = (field, file) => {
    updateForm(field, file?.name ?? '')
  }
  const saveMeasurement = (row) => {
    setMeasurementRows((current) => {
      if (editingMeasurement?.id) {
        return current.map((item) => (item.id === editingMeasurement.id ? { ...row, id: editingMeasurement.id } : item))
      }

      return [...current, { ...row, id: Date.now() }]
    })
    setEditingMeasurement(null)
  }
  const handlePreview = () => {
    onPreview?.({
      ...report,
      ...form,
      measurementRows,
    })
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
            justifyContent: 'center',
          }}
        >
          <Typography variant="h6" component="h2" fontWeight={700} sx={{ textAlign: 'center' }}>
            แบบรายงานผลการตรวจสอบความคลาดเคลื่อนของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ
          </Typography>
        </Stack>
        <Divider />
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <SectionPaper title="ข้อมูลทั่วไป">
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <ReadOnlyField label="ชื่อบริษัท" value={report.factoryName} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <ReadOnlyField label="เลขทะเบียนโรงงาน" value={report.factoryRegistration} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <ReadOnlyField label="ประกอบกิจการ" value={report.businessActivity} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <ReadOnlyField label="สถานที่ตั้ง" value={report.factoryAddress} multiline />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <ReadOnlyField label="ครั้งที่" value={report.roundNo} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <ReadOnlyField label="ปี" value={String(report.year)} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    label="ปริมาณการระบายน้ำทิ้งขณะเก็บตัวอย่าง (ลบ.ม./ชั่วโมง)"
                    size="small"
                    value={form.wastewaterFlow}
                    onChange={(event) => updateForm('wastewaterFlow', event.target.value)}
                    fullWidth
                  />
                </Grid>
              </Grid>
            </SectionPaper>

            <SectionPaper title="ข้อมูลผู้เก็บตัวอย่างและห้องปฏิบัติการ">
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="ผู้เก็บตัวอย่าง" size="small" value={form.samplerName} onChange={(event) => updateForm('samplerName', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="ทะเบียนเจ้าหน้าที่" size="small" value={form.officerRegistration} onChange={(event) => updateForm('officerRegistration', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField label="หน่วยงาน/ชื่อห้องปฏิบัติการ" size="small" value={form.laboratoryName} onChange={(event) => updateForm('laboratoryName', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="ทะเบียนห้องปฏิบัติการ" size="small" value={form.laboratoryRegistration} onChange={(event) => updateForm('laboratoryRegistration', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="เลขที่ใบรายงานผลวิเคราะห์" size="small" value={form.labReportNo} onChange={(event) => updateForm('labReportNo', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField label="วิธีวิเคราะห์ทดสอบในห้องปฏิบัติการ" size="small" value={form.analysisMethod} onChange={(event) => updateForm('analysisMethod', event.target.value)} fullWidth />
                </Grid>
              </Grid>
            </SectionPaper>

            <SectionPaper title="รายละเอียดเครื่องมือและรายการตรวจสอบ">
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="ยี่ห้อ (Brand)" size="small" value={form.deviceBrand} onChange={(event) => updateForm('deviceBrand', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="รุ่น (Model)" size="small" value={form.deviceModel} onChange={(event) => updateForm('deviceModel', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField label="หมายเลขเครื่อง (Serial No.)" size="small" value={form.serialNo} onChange={(event) => updateForm('serialNo', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    select
                    label="รายการที่ตรวจสอบค่าความคลาดเคลื่อน"
                    size="small"
                    value={form.parameter}
                    onChange={(event) => {
                      const selectedValue = event.target.value
                      updateForm('parameter', typeof selectedValue === 'string' ? selectedValue.split(',') : selectedValue)
                    }}
                    slotProps={{
                      select: {
                        multiple: true,
                        renderValue: (selected) => selected.join(', '),
                      },
                    }}
                    fullWidth
                  >
                    <MenuItem value="BOD">BOD</MenuItem>
                    <MenuItem value="COD">COD</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
            </SectionPaper>

            <SectionPaper title="ผลการตรวจสอบความคลาดเคลื่อน">
              <Stack spacing={1.5}>
                <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                  <Button variant="outlined" onClick={() => setEditingMeasurement({})}>
                    เพิ่มข้อมูล
                  </Button>
                </Stack>
                <TableContainer sx={{ border: 1, borderColor: 'divider', overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 1100, ...borderedTableSx }}>
                    <TableHead>
                      <TableRow>
                        {[
                          'วันที่เก็บตัวอย่าง',
                          'เวลาที่เก็บตัวอย่าง',
                          'ค่าที่เครื่องมือตรวจวัดได้ (M)',
                          'ค่าที่ห้องปฏิบัติการวิเคราะห์ได้ (T)',
                          'ค่าความคลาดเคลื่อน (E)',
                          'ค่าความคลาดเคลื่อนตามประกาศฯ',
                          'จัดการ',
                        ].map((column) => (
                          <TableCell key={column} sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>{column}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {measurementRows.length > 0 ? (
                        measurementRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.sampleDate}</TableCell>
                            <TableCell>{row.sampleTime}</TableCell>
                            <TableCell>{row.deviceValue}</TableCell>
                            <TableCell>{row.labValue}</TableCell>
                            <TableCell>{row.errorValue}</TableCell>
                            <TableCell>{row.standardErrorValue}</TableCell>
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
                          <TableCell colSpan={7} align="center">
                            <Typography variant="body2" color="text.secondary">
                              ไม่มีข้อมูลผลการตรวจสอบความคลาดเคลื่อน
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            </SectionPaper>

            <SectionPaper title="แนบไฟล์ (JPG / PNG / PDF)">
              <Grid container spacing={2}>
                {[
                  ['samplePhotoFileName', 'ภาพถ่ายขณะเก็บตัวอย่าง (ขนาดไม่เกิน 2 Mb)*'],
                  ['devicePhotoFileName', 'ภาพหน้าเครื่องมือตรวจวัดที่แสดง ณ เวลาที่เก็บตัวอย่าง (ขนาดไม่เกิน 2 Mb)*'],
                  ['labReportFileName', 'รายงานผลจากห้องปฏิบัติการ (ขนาดไม่เกิน 2 Mb)*'],
                ].map(([field, label]) => (
                  <Grid key={field} size={{ xs: 12, md: 4 }}>
                    <Stack spacing={0.5}>
                      <Button component="label" variant="outlined">
                        แนบไฟล์
                        <input hidden type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onChange={(event) => handleFileChange(field, event.target.files?.[0])} />
                      </Button>
                      <Typography variant="caption" color="text.secondary">
                        {form[field] || label}
                      </Typography>
                    </Stack>
                  </Grid>
                ))}
              </Grid>
            </SectionPaper>

            <SectionPaper title="ผู้รายงานผลการทดสอบ">
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField label="ชื่อ-นามสกุล" size="small" value={form.reporterName} onChange={(event) => updateForm('reporterName', event.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField label="ตำแหน่ง" size="small" value={form.reporterPosition} onChange={(event) => updateForm('reporterPosition', event.target.value)} fullWidth />
                </Grid>
              </Grid>
            </SectionPaper>
          </Stack>
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
          <Button variant="contained" onClick={handlePreview}>
            บันทึกแบบฟอร์ม
          </Button>
        </Stack>
      </Stack>
      <MeasurementResultDialog
        open={Boolean(editingMeasurement)}
        value={editingMeasurement?.id ? editingMeasurement : null}
        onClose={() => setEditingMeasurement(null)}
        onSave={saveMeasurement}
      />
    </Drawer>
  )
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

function ReportActions({ row, mode, onOpenReport, onOpenResultNotice }) {
  const canEdit = mode === 'operator' && row.status === 'รอโรงงานแก้ไข'
  const canProcess = mode === 'officer' && ['รอพิจารณา', 'แก้ไขแล้ว/รอพิจารณา'].includes(row.status)
  const canOpenResultNotice = row.status === 'ผ่านการพิจารณา'

  return (
    <Stack direction="row" spacing={1} sx={tableActionStackSx}>
      <Button size="small" variant="outlined" onClick={() => onOpenReport?.(row)}>
        แบบรายงานผล
      </Button>
      <Button size="small" variant="outlined" disabled={!canOpenResultNotice} onClick={() => onOpenResultNotice?.(row)}>
        แบบแจ้งผล
      </Button>
      {mode === 'operator' ? (
        <Button size="small" variant="contained" disabled={!canEdit} onClick={() => onOpenReport?.(row)}>
          แก้ไข
        </Button>
      ) : (
        <Button size="small" variant="contained" disabled={!canProcess} onClick={() => onOpenReport?.(row)}>
          ดำเนินการ
        </Button>
      )}
    </Stack>
  )
}

function getFactoryColumns(onOpenMonitoringPoints) {
  return [
    { field: 'factoryName', headerName: 'ชื่อโรงงาน/บริษัท', width: 260 },
    { field: 'factoryRegistration', headerName: 'เลขทะเบียนโรงงาน', width: 190 },
    { field: 'industryType', headerName: 'ประเภทอุตสาหกรรม', width: 180 },
    { field: 'province', headerName: 'จังหวัด', width: 130 },
    { field: 'monitoringPointCount', headerName: 'จำนวนจุดตรวจวัด', width: 160, type: 'number' },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: 200,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <FactoryActions row={params.row} onOpenMonitoringPoints={onOpenMonitoringPoints} />
      ),
    },
  ]
}

function getReportColumns(mode, onOpenReport, onOpenResultNotice) {
  return [
    { field: 'factoryName', headerName: 'ชื่อโรงงาน/บริษัท', width: 260 },
    { field: 'factoryRegistration', headerName: 'เลขทะเบียนโรงงาน', width: 190 },
    { field: 'province', headerName: 'จังหวัด', width: 130 },
    { field: 'monitoringPointCode', headerName: 'รหัสจุดตรวจวัด', width: 130 },
    { field: 'monitoringPointName', headerName: 'ชื่อจุดตรวจวัด', width: 190 },
    { field: 'reportRound', headerName: 'รอบรายงาน', width: 140 },
    { field: 'year', headerName: 'ปี พ.ศ.', width: 120 },
    { field: 'reportNo', headerName: 'เลขที่รายงาน', width: 170 },
    { field: 'submittedDate', headerName: 'วันที่ยื่นรายงาน', width: 160 },
    { field: 'reviewedDate', headerName: 'วันที่พิจารณา', width: 160 },
    {
      field: 'status',
      headerName: 'สถานะ',
      width: 180,
      renderCell: (params) => <StatusChip value={params.value} />,
    },
    {
      field: 'actions',
      headerName: 'จัดการ',
      width: mode === 'operator' ? 300 : 340,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <ReportActions
          row={params.row}
          mode={mode}
          onOpenReport={onOpenReport}
          onOpenResultNotice={onOpenResultNotice}
        />
      ),
    },
  ]
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

const dataGridSx = {
  border: 0,
  '& .MuiDataGrid-columnHeaders': {
    borderTop: 1,
    borderBottom: 1,
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

function BodCodReportPage({ userType = '' }) {
  const isOfficer = userType === 'officer'
  const availableSubMenus = isOfficer ? officerSubMenus : operatorSubMenus
  const [selectedSubMenu, setSelectedSubMenu] = useState(() => (isOfficer ? 'reports' : 'factories'))
  const [monitoringPointFactory, setMonitoringPointFactory] = useState(null)
  const [reportForm, setReportForm] = useState(null)
  const [previewReport, setPreviewReport] = useState(null)
  const [resultNoticeReport, setResultNoticeReport] = useState(null)
  const effectiveSubMenu = availableSubMenus.some((menu) => menu.value === selectedSubMenu)
    ? selectedSubMenu
    : availableSubMenus[0].value
  const factoryColumns = useMemo(() => getFactoryColumns(setMonitoringPointFactory), [])
  const reportColumns = useMemo(
    () => getReportColumns(isOfficer ? 'officer' : 'operator', setPreviewReport, setResultNoticeReport),
    [isOfficer],
  )
  const table = useMemo(() => {
    if (effectiveSubMenu === 'factories') {
      return {
        title: 'รายชื่อโรงงาน',
        rows: factoryRows,
        columns: factoryColumns,
      }
    }

    return {
      title: isOfficer ? 'รายการส่งแบบรายงาน' : 'ประวัติการรายงาน',
      rows: isOfficer ? officerReportRows : reportRows,
      columns: reportColumns,
    }
  }, [effectiveSubMenu, factoryColumns, isOfficer, reportColumns])

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
                รายงานค่าความคลาดเคลื่อน BOD/COD Online
              </Typography>
            </Box>
            <Tabs
              value={effectiveSubMenu}
              onChange={(_, value) => setSelectedSubMenu(value)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="เมนูย่อยรายงานค่าความคลาดเคลื่อน BOD/COD"
              sx={{
                minHeight: 40,
                '& .MuiTab-root': {
                  minHeight: 40,
                },
              }}
            >
              {availableSubMenus.map((menu) => (
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
            localeText={dataGridLocaleText}
            sx={dataGridSx}
          />
        </Paper>
      </Stack>
      <MonitoringPointDialog
        open={Boolean(monitoringPointFactory)}
        factory={monitoringPointFactory}
        onClose={() => setMonitoringPointFactory(null)}
        onOpenReport={(factory, point, reportRound) => {
          setReportForm(makeDraftReport(factory, point, reportRound))
          setMonitoringPointFactory(null)
        }}
      />
      <BodCodReportFormSheet
        key={reportForm?.id ?? 'bod-cod-report-form'}
        open={Boolean(reportForm)}
        report={reportForm}
        onClose={() => setReportForm(null)}
        onPreview={(report) => {
          setPreviewReport(report)
          setReportForm(null)
        }}
      />
      <ReportPreviewDialog
        open={Boolean(previewReport)}
        report={previewReport}
        onClose={() => setPreviewReport(null)}
      />
      <ResultNoticeDialog
        open={Boolean(resultNoticeReport)}
        report={resultNoticeReport}
        onClose={() => setResultNoticeReport(null)}
      />
    </>
  )
}

export default BodCodReportPage
