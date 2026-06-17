import { useMemo, useState } from 'react'
import { Box, Button, MenuItem, Paper, Radio, Stack, TextField, Typography } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import RestartAltIcon from '@mui/icons-material/RestartAlt'

const initialCriteria = {
  factoryRegistrationNo: '',
  factoryName: '',
  operatorName: '',
  factoryTypeMain: '',
  factoryTypeSub: '',
  location: '',
  province: '',
  region: '',
  isIndustrialEstate: 'ใช่',
  industrialEstateName: '',
  industrialEstateZone: '',
  monitoringPointId: '',
  announcementInstallation: '',
  attachmentAccount: '',
  parameterDischarge: '',
  parameterConnected: '',
  parameterAccepted: '',
  parameterDisconnected: '',
  fuelMain: '',
  fuelSub: '',
  monitoringResult: '',
  unit: '',
  frequency: '',
  monitoringStartDate: '',
  monitoringEndDate: '',
  valueType: '',
}

const fields = [
  { name: 'factoryRegistrationNo', label: 'เลขทะเบียนโรงงาน', type: 'text', columns: 4 },
  { name: 'factoryName', label: 'ชื่อโรงงาน', type: 'text', columns: 4 },
  { name: 'operatorName', label: 'ประกอบกิจการ', type: 'text', columns: 4 },
  {
    name: 'factoryTypeMain',
    label: 'ลำดับประเภทโรงงาน (ลำดับหลัก)',
    type: 'select',
    columns: 4,
    options: ['ลำดับที่ 88', 'ลำดับที่ 89', 'ลำดับที่ 101', 'ลำดับที่ 105', 'ลำดับที่ 106'],
  },
  {
    name: 'factoryTypeSub',
    label: 'ลำดับประเภทโรงงาน (ลำดับรอง)',
    type: 'select',
    columns: 4,
    options: ['ลำดับรอง 1', 'ลำดับรอง 2', 'ลำดับรอง 3', 'ลำดับรอง 4'],
  },
  { type: 'spacer', columns: 4 },
  { name: 'location', label: 'สถานที่ตั้ง', type: 'text', columns: 4 },
  {
    name: 'province',
    label: 'จังหวัด',
    type: 'select',
    columns: 4,
    options: ['กรุงเทพมหานคร', 'ชลบุรี', 'ระยอง', 'สมุทรปราการ', 'ฉะเชิงเทรา', 'พระนครศรีอยุธยา'],
  },
  {
    name: 'region',
    label: 'ภาค',
    type: 'select',
    columns: 4,
    options: ['ภาคกลาง', 'ภาคเหนือ', 'ภาคใต้', 'ภาคตะวันออก', 'ภาคตะวันตก', 'ภาคตะวันออกเฉียงเหนือ'],
  },
  { name: 'isIndustrialEstate', label: 'นอกนิคม / เขต / สวนอุตสาหกรรม', type: 'radio', columns: 4 },
  { name: 'industrialEstateName', label: 'นิคมอุตสาหกรรม', type: 'text', columns: 4 },
  { name: 'industrialEstateZone', label: 'เขต/สวนอุตสาหกรรม', type: 'text', columns: 4 },
  { name: 'monitoringPointId', label: 'รหัสจุดตรวจวัด (ID)', type: 'text', columns: 4 },
  {
    name: 'announcementInstallation',
    label: 'ติดตั้งตามประกาศ',
    type: 'select',
    columns: 4,
    options: ['ติดตั้งตามประกาศ', 'ได้รับการยกเว้น', 'ไม่เข้าข่าย'],
  },
  { name: 'attachmentAccount', label: 'เข้าข่ายตามบัญชีแนบท้ายลำดับ', type: 'text', columns: 4 },
  { name: 'parameterDischarge', label: 'พารามิเตอร์ที่น้ำจ่าย', type: 'text', columns: 3 },
  { name: 'parameterConnected', label: 'พารามิเตอร์ที่เชื่อมต่อแล้ว', type: 'text', columns: 3 },
  { name: 'parameterAccepted', label: 'พารามิเตอร์ที่ยอมรับ', type: 'text', columns: 3 },
  { name: 'parameterDisconnected', label: 'พารามิเตอร์ที่ยังไม่เชื่อมต่อ', type: 'text', columns: 3 },
  {
    name: 'fuelMain',
    label: 'ชนิดเชื้อเพลิง (หลัก)',
    type: 'select',
    columns: 4,
    options: ['ก๊าซธรรมชาติ', 'ถ่านหิน', 'ชีวมวล', 'น้ำมันเตา', 'เชื้อเพลิงผสม'],
  },
  {
    name: 'fuelSub',
    label: 'ชนิดเชื้อเพลิง (รอง)',
    type: 'select',
    columns: 4,
    options: ['ก๊าซธรรมชาติ', 'ถ่านหิน', 'ชีวมวล', 'น้ำมันเตา', 'เชื้อเพลิงผสม'],
  },
  { type: 'spacer', columns: 4 },
  {
    name: 'monitoringResult',
    label: 'ผลการตรวจวัด (พารามิเตอร์)',
    type: 'select',
    columns: 4,
    options: ['Particulate', 'SO2', 'NOx', 'CO', 'HCl', 'Hg', 'Opacity', 'BOD', 'COD'],
  },
  {
    name: 'unit',
    label: 'หน่วย',
    type: 'select',
    columns: 4,
    options: ['mg/L', 'mg/Nm3', 'ppm', '%', 'pH', 'degree C'],
  },
  { type: 'spacer', columns: 4 },
  {
    name: 'frequency',
    label: 'ความถี่ (นาที/ชั่วโมง /วัน/ เดือน)',
    type: 'select',
    columns: 3,
    options: ['นาที', 'ชั่วโมง', 'วัน', 'เดือน'],
  },
  { name: 'monitoringStartDate', label: 'วันที่ตรวจวัด (เริ่มต้น)', type: 'date', columns: 3 },
  { name: 'monitoringEndDate', label: 'วันที่ตรวจวัด (สิ้นสุด)', type: 'date', columns: 3 },
  {
    name: 'valueType',
    label: 'ค่าตรวจวัด (เฉลี่ย / สูงสุด/ต่ำสุด)',
    type: 'select',
    columns: 3,
    options: ['ค่าเฉลี่ย', 'ค่าสูงสุด', 'ค่าต่ำสุด'],
  },
]

function quoteCsvValue(value) {
  const stringValue = String(value ?? '')
  return `"${stringValue.replaceAll('"', '""')}"`
}

function formatDateForFileName(date = new Date()) {
  return date.toISOString().slice(0, 19).replaceAll(':', '-')
}

function ConditionalSearchPage() {
  const [criteria, setCriteria] = useState(initialCriteria)
  const exportFields = useMemo(() => fields.filter((field) => field.type !== 'spacer'), [])
  const selectedCriteriaCount = useMemo(
    () => Object.values(criteria).filter((value) => value !== '').length,
    [criteria],
  )

  const updateCriteria = (name, value) => {
    setCriteria((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const resetCriteria = () => {
    setCriteria(initialCriteria)
  }

  const exportCriteriaCsv = () => {
    const headers = exportFields.map((field) => field.label)
    const values = exportFields.map((field) => criteria[field.name])
    const csvContent = [
      headers.map(quoteCsvValue).join(','),
      values.map(quoteCsvValue).join(','),
    ].join('\n')
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `conditional-search-${formatDateForFileName()}.csv`
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0, overflow: 'auto' }}>
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
                สืบค้นข้อมูลแบบมีเงื่อนไข
              </Typography>
              <Typography variant="body2" color="text.secondary">
                เลือกเงื่อนไขสำหรับส่งออกรายงานเป็น CSV
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(12, minmax(0, 1fr))',
              },
              columnGap: 2,
              rowGap: 3,
            }}
          >
            {fields.map((field, index) => (
              <Box
                key={field.name ?? `spacer-${index}`}
                sx={{
                  display: field.type === 'spacer' ? { xs: 'none', md: 'block' } : 'block',
                  gridColumn: {
                    xs: '1 / -1',
                    md: `span ${field.columns}`,
                  },
                }}
              >
                {field.type !== 'spacer' ? (
                  <SearchField
                    field={field}
                    value={criteria[field.name]}
                    onChange={(value) => updateCriteria(field.name, value)}
                  />
                ) : null}
              </Box>
            ))}
          </Box>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{
              mt: 3,
              justifyContent: 'flex-end',
              alignItems: { xs: 'stretch', sm: 'center' },
            }}
          >
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={exportCriteriaCsv}
              sx={{ minWidth: 132 }}
            >
              ส่งออกข้อมูล
            </Button>
            <Button
              variant="contained"
              color="inherit"
              startIcon={<RestartAltIcon />}
              onClick={resetCriteria}
              disabled={selectedCriteriaCount === 0}
              sx={{
                minWidth: 104,
                bgcolor: 'neutral.100',
                color: 'neutral.700',
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: 'neutral.200',
                  boxShadow: 'none',
                },
              }}
            >
            รีเซต
          </Button>
        </Stack>
      </Paper>
    </Stack>
  )
}

function SearchField({ field, value, onChange }) {
  if (field.type === 'radio') {
    return (
      <Box>
        <Typography variant="body2" sx={{ mb: 1, color: 'neutral.700' }}>
          {field.label}
        </Typography>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            minHeight: 40,
            px: 1,
            alignItems: 'center',
            border: 1,
            borderColor: 'neutral.300',
            borderRadius: 1,
          }}
        >
          {['ใช่', 'ไม่ใช่'].map((option) => (
            <Stack
              key={option}
              component="label"
              direction="row"
              spacing={0.5}
              sx={{
                alignItems: 'center',
                cursor: 'pointer',
                color: 'neutral.900',
                fontSize: 14,
              }}
            >
              <Radio
                size="small"
                checked={value === option}
                onChange={() => onChange(option)}
                sx={{ p: 0.25 }}
              />
              <Box component="span">{option}</Box>
            </Stack>
          ))}
        </Stack>
      </Box>
    )
  }

  if (field.type === 'select') {
    return (
      <LabeledField label={field.label}>
        <TextField
          select
          fullWidth
          size="small"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <MenuItem value="">เลือก</MenuItem>
          {field.options.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
      </LabeledField>
    )
  }

  return (
    <LabeledField label={field.label}>
      <TextField
        fullWidth
        size="small"
        type={field.type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </LabeledField>
  )
}

function LabeledField({ label, children }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1, color: 'neutral.700' }}>
        {label}
      </Typography>
      {children}
    </Box>
  )
}

export default ConditionalSearchPage
