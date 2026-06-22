import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Snackbar,
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
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import EditIcon from '@mui/icons-material/Edit'
import RefreshIcon from '@mui/icons-material/Refresh'
import SaveIcon from '@mui/icons-material/Save'

const monitoringPointFormsApiUrl = import.meta.env.DEV
  ? '/api-local/v1/monitoring-point-forms'
  : 'http://d-poms.diw.go.th/api/v1/monitoring-point-forms'

const cemsParameterOptions = [
  'NOx (ppm)',
  'SO2 (ppm)',
  'CO (ppm)',
  'CO2 (ppm)',
  'O2 (%)',
  'Opacity (%)',
  'Particulate (mg/m³)',
  'Flow (m³/hr)',
  'Temp. (°C)',
]

const wpmsParameterOptions = ['BOD (mg/l)', 'COD (mg/l)', 'Flow (m³/hr)', 'pH', 'TSS (mg/l)']

const cemsRequiredOptions = [
  'เข้าข่ายต้องติดตั้ง CEMS ตามกฎหมาย',
  'ไม่เข้าข่ายต้องติดตั้ง CEMS',
  'อื่นๆ โปรดระบุ',
]

const accountingOptions = [
  'เข้าข่ายตามบัญชีแนบท้ายลำดับที่',
  'ไม่เข้าข่ายตามบัญชีแนบท้าย',
  'รอตรวจสอบข้อมูล',
]

const legalAnnexOptions = Array.from({ length: 12 }, (_item, index) => String(index + 1))

const emptyFactory = {
  factoryName: 'สถานีบ่มใบยาสบหนอง',
  factoryRegistrationNoNew: '10520000225172',
  factoryRegistrationNoOld: '3-1-2/17ลป',
  provinceName: 'ลำปาง',
  factoryTypeMain: '100',
  factoryTypeSub: '003,000',
  operationStatus: 'แจ้งประกอบแล้ว',
  eiaInfo: '-',
  address: '1 หมู่ 9 ถนนบ้านช่องคอม ตำบล4 อำเภอ13 52240',
  businessActivity: 'บ่มใบยาสูบ',
}

function createEmptyPoint(systemType = 'CEMS') {
  const now = Date.now()

  return {
    clientId: `point-${systemType.toLowerCase()}-${now}`,
    systemType,
    pointCode: '',
    pointName: '',
    productionUnitType: '',
    productionCapacity: '',
    cemsInstallationRequiredBy: systemType === 'CEMS' ? 'เข้าข่ายต้องติดตั้ง CEMS ตามกฎหมาย' : '',
    cemsInstallationRequiredOther: '',
    legalAnnexNo: [],
    accountingConnectionStatus: 'เข้าข่ายตามบัญชีแนบท้ายลำดับที่',
    eligibleParameters: [],
    exemptedParameters: [],
    connectedParameters: [],
    pendingParameters: [],
    primaryFuel: '',
    primaryFuelOther: '',
    secondaryFuel: '',
    secondaryFuelOther: '',
  }
}

function getErrorMessage(payload, fallback) {
  return payload?.error?.message || payload?.message || fallback
}

function mapFormToState(form) {
  return {
    formId: form.id,
    factory: {
      ...emptyFactory,
      ...form.factory,
    },
    points: form.points.map((point) => ({
      ...createEmptyPoint(point.systemType),
      ...point,
      legalAnnexNo: normalizeStringList(point.legalAnnexNo),
      clientId: `point-${point.id}`,
    })),
  }
}

function normalizePayload(factory, points) {
  return {
    factory,
    points: points.map(toPayloadPoint),
  }
}

function toPayloadPoint(point) {
  const payloadPoint = { ...point }
  delete payloadPoint.clientId
  delete payloadPoint.formId
  delete payloadPoint.createdAt
  delete payloadPoint.updatedAt

  return {
    ...payloadPoint,
    legalAnnexNo: normalizeStringList(payloadPoint.legalAnnexNo),
    details: null,
  }
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function MonitoringPointFormsPage({ accessToken }) {
  const [forms, setForms] = useState([])
  const [formId, setFormId] = useState(null)
  const [factory, setFactory] = useState(emptyFactory)
  const [points, setPoints] = useState([createEmptyPoint('CEMS')])
  const [selectedPointIndex, setSelectedPointIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState({ type: 'idle', text: '' })

  const selectedPoint = points[selectedPointIndex] ?? points[0]
  const canSave =
    Boolean(accessToken) &&
    !isSaving &&
    factory.factoryName.trim() &&
    factory.factoryRegistrationNoNew.trim() &&
    points.length > 0 &&
    points.every((point) => point.pointName.trim())

  const summary = useMemo(
    () => ({
      total: points.length,
      cems: points.filter((point) => point.systemType === 'CEMS').length,
      wpms: points.filter((point) => point.systemType === 'WPMS').length,
    }),
    [points],
  )

  const loadForms = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(monitoringPointFormsApiUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.success !== true) {
        throw new Error(getErrorMessage(payload, 'เรียกดูข้อมูลจุดตรวจวัดไม่สำเร็จ'))
      }
      setForms(payload.data ?? [])
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'เรียกดูข้อมูลจุดตรวจวัดไม่สำเร็จ',
      })
    } finally {
      setIsLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadForms()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadForms])

  function updateFactory(field, value) {
    setFactory((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updatePoint(field, value) {
    setPoints((current) =>
      current.map((point, index) => (index === selectedPointIndex ? { ...point, [field]: value } : point)),
    )
  }

  function updatePointSystemType(systemType) {
    setPoints((current) =>
      current.map((point, index) =>
        index === selectedPointIndex
          ? {
              ...point,
              systemType,
              cemsInstallationRequiredBy:
                systemType === 'CEMS' ? point.cemsInstallationRequiredBy || cemsRequiredOptions[0] : '',
              eligibleParameters: [],
              exemptedParameters: [],
              connectedParameters: [],
              pendingParameters: [],
            }
          : point,
      ),
    )
  }

  function addPoint() {
    setPoints((current) => {
      const next = [...current, createEmptyPoint('CEMS')]
      setSelectedPointIndex(next.length - 1)
      return next
    })
  }

  function removeSelectedPoint() {
    if (points.length <= 1) {
      return
    }

    setPoints((current) => current.filter((_point, index) => index !== selectedPointIndex))
    setSelectedPointIndex((current) => Math.max(0, current - 1))
  }

  async function loadFormDetail(id) {
    if (!accessToken) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${monitoringPointFormsApiUrl}/${id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.success !== true) {
        throw new Error(getErrorMessage(payload, 'โหลดข้อมูลสำหรับแก้ไขไม่สำเร็จ'))
      }
      const next = mapFormToState(payload.data)
      setFormId(next.formId)
      setFactory(next.factory)
      setPoints(next.points.length ? next.points : [createEmptyPoint('CEMS')])
      setSelectedPointIndex(0)
      setMessage({ type: 'success', text: 'โหลดข้อมูลสำหรับแก้ไขแล้ว' })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'โหลดข้อมูลสำหรับแก้ไขไม่สำเร็จ',
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave() {
    if (!canSave) {
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(formId ? `${monitoringPointFormsApiUrl}/${formId}` : monitoringPointFormsApiUrl, {
        method: formId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(normalizePayload(factory, points)),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.success !== true) {
        throw new Error(getErrorMessage(payload, 'บันทึกข้อมูลจุดตรวจวัดไม่สำเร็จ'))
      }
      const next = mapFormToState(payload.data)
      setFormId(next.formId)
      setFactory(next.factory)
      setPoints(next.points)
      setSelectedPointIndex(0)
      setMessage({ type: 'success', text: 'บันทึกข้อมูลจุดตรวจวัดแล้ว' })
      await loadForms()
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'บันทึกข้อมูลจุดตรวจวัดไม่สำเร็จ',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const parameterOptions = selectedPoint?.systemType === 'WPMS' ? wpmsParameterOptions : cemsParameterOptions

  return (
    <Box sx={{ height: '100%', overflow: 'auto', bgcolor: 'grey.50', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              เพิ่ม/แก้ไข ข้อมูลจุดตรวจวัด
            </Typography>
            <Typography variant="body2" color="text.secondary">
              เลือกโรงงานเข้าข่ายและกำหนดข้อมูลจุดตรวจวัดได้หลายจุด
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip label={`ทั้งหมด ${summary.total} จุด`} size="small" />
            <Chip label={`CEMS ${summary.cems}`} color="primary" size="small" />
            <Chip label={`WPMS ${summary.wpms}`} color="success" size="small" />
            <Tooltip title="โหลดรายการล่าสุด">
              <span>
                <IconButton onClick={loadForms} disabled={!accessToken || isLoading}>
                  {isLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {!accessToken ? <Alert severity="warning">กรุณาเข้าสู่ระบบก่อนบันทึกหรือเรียกดูข้อมูล</Alert> : null}

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1" fontWeight={700}>
              รายการที่บันทึกแล้ว
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ชื่อโรงงาน</TableCell>
                    <TableCell>เลขทะเบียนใหม่</TableCell>
                    <TableCell align="center">CEMS</TableCell>
                    <TableCell align="center">WPMS</TableCell>
                    <TableCell align="right">จัดการ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {forms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ color: 'text.secondary' }}>
                        ยังไม่มีข้อมูลที่บันทึก
                      </TableCell>
                    </TableRow>
                  ) : (
                    forms.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell>{item.factory.factoryName}</TableCell>
                        <TableCell>{item.factory.factoryRegistrationNoNew}</TableCell>
                        <TableCell align="center">{item.cemsPointCount}</TableCell>
                        <TableCell align="center">{item.wpmsPointCount}</TableCell>
                        <TableCell align="right">
                          <Button size="small" startIcon={<EditIcon />} onClick={() => loadFormDetail(item.id)}>
                            แก้ไข
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
          <Stack spacing={2.5}>
            <Typography variant="subtitle1" fontWeight={700}>
              ข้อมูลทั่วไปของโรงงาน
            </Typography>
            <Grid container spacing={2}>
              <FactoryTextField label="ชื่อโรงงาน" value={factory.factoryName} onChange={(value) => updateFactory('factoryName', value)} />
              <FactoryTextField label="เลขทะเบียนโรงงานแบบใหม่" value={factory.factoryRegistrationNoNew} onChange={(value) => updateFactory('factoryRegistrationNoNew', value)} />
              <FactoryTextField label="เลขทะเบียนโรงงานแบบเดิม" value={factory.factoryRegistrationNoOld} onChange={(value) => updateFactory('factoryRegistrationNoOld', value)} />
              <FactoryTextField label="จังหวัด" value={factory.provinceName} onChange={(value) => updateFactory('provinceName', value)} />
              <FactoryTextField label="ลำดับประเภทโรงงานหลัก" value={factory.factoryTypeMain} onChange={(value) => updateFactory('factoryTypeMain', value)} />
              <FactoryTextField label="ลำดับประเภทโรงงานรอง" value={factory.factoryTypeSub} onChange={(value) => updateFactory('factoryTypeSub', value)} />
              <FactoryTextField label="สถานะการประกอบกิจการ" value={factory.operationStatus} onChange={(value) => updateFactory('operationStatus', value)} />
              <FactoryTextField label="ข้อมูล EIA" value={factory.eiaInfo} onChange={(value) => updateFactory('eiaInfo', value)} />
              <FactoryTextField md={6} label="สถานที่ตั้ง" value={factory.address} onChange={(value) => updateFactory('address', value)} />
              <FactoryTextField md={6} label="การประกอบกิจการ" value={factory.businessActivity} onChange={(value) => updateFactory('businessActivity', value)} />
            </Grid>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
          <Stack spacing={2.5}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  ข้อมูลจุดตรวจวัด
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  เลือกจุดเพื่อแก้ไข หรือเพิ่มจุดตรวจวัดใหม่
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={addPoint}>
                  เพิ่มจุดตรวจวัด
                </Button>
                <Button variant="outlined" color="inherit" startIcon={<DeleteOutlineIcon />} onClick={removeSelectedPoint} disabled={points.length <= 1}>
                  ลบจุดนี้
                </Button>
              </Stack>
            </Stack>

            <Tabs
              value={selectedPointIndex}
              onChange={(_event, value) => setSelectedPointIndex(value)}
              variant="scrollable"
              scrollButtons="auto"
            >
              {points.map((point, index) => (
                <Tab
                  key={point.clientId}
                  label={`${point.systemType} จุดที่ ${index + 1}`}
                  sx={{ minHeight: 42, borderRadius: 8, mr: 1 }}
                />
              ))}
            </Tabs>
            <Divider />

            {selectedPoint ? (
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    จุดตรวจวัด
                  </Typography>
                  <RadioGroup row value={selectedPoint.systemType} onChange={(event) => updatePointSystemType(event.target.value)}>
                    <Stack direction="row" spacing={2}>
                      <Chip
                        icon={<Radio checked={selectedPoint.systemType === 'CEMS'} />}
                        label="CEMS"
                        variant={selectedPoint.systemType === 'CEMS' ? 'filled' : 'outlined'}
                        color={selectedPoint.systemType === 'CEMS' ? 'primary' : 'default'}
                        onClick={() => updatePointSystemType('CEMS')}
                      />
                      <Chip
                        icon={<Radio checked={selectedPoint.systemType === 'WPMS'} />}
                        label="WPMS"
                        variant={selectedPoint.systemType === 'WPMS' ? 'filled' : 'outlined'}
                        color={selectedPoint.systemType === 'WPMS' ? 'success' : 'default'}
                        onClick={() => updatePointSystemType('WPMS')}
                      />
                    </Stack>
                  </RadioGroup>
                </Box>

                <Typography variant="subtitle2" fontWeight={700}>
                  รายละเอียดจุดตรวจวัด
                </Typography>
                <Grid container spacing={2}>
                  <PointTextField label="รหัสจุดตรวจวัด" value={selectedPoint.pointCode} onChange={(value) => updatePoint('pointCode', value)} />
                  <PointTextField label="ชื่อจุดตรวจวัด" value={selectedPoint.pointName} onChange={(value) => updatePoint('pointName', value)} />
                  <PointTextField label="ประเภทของหน่วยการผลิต" value={selectedPoint.productionUnitType} onChange={(value) => updatePoint('productionUnitType', value)} />
                  <PointTextField label="กำลังการผลิตต่อหน่วย" value={selectedPoint.productionCapacity} onChange={(value) => updatePoint('productionCapacity', value)} />
                  {selectedPoint.systemType === 'CEMS' ? (
                    <>
                      <PointSelectField label="เข้าข่ายต้องติดตั้ง CEMS ตามกฎหมาย" value={selectedPoint.cemsInstallationRequiredBy} options={cemsRequiredOptions} onChange={(value) => updatePoint('cemsInstallationRequiredBy', value)} />
                      <PointTextField label="อื่นๆ โปรดระบุ" value={selectedPoint.cemsInstallationRequiredOther} onChange={(value) => updatePoint('cemsInstallationRequiredOther', value)} />
                    </>
                  ) : null}
                  <PointSelectField label="สถานะบัญชีแนบท้าย" value={selectedPoint.accountingConnectionStatus} options={accountingOptions} onChange={(value) => updatePoint('accountingConnectionStatus', value)} />
                  <PointMultiSelectField label="เข้าข่ายตามบัญชีแนบท้ายลำดับที่" value={selectedPoint.legalAnnexNo} options={legalAnnexOptions} onChange={(value) => updatePoint('legalAnnexNo', value)} />
                  <PointMultiSelectField label="พารามิเตอร์ที่เข้าข่าย" value={selectedPoint.eligibleParameters} options={parameterOptions} onChange={(value) => updatePoint('eligibleParameters', value)} />
                  <PointMultiSelectField label="พารามิเตอร์ที่ได้รับการยกเว้น" value={selectedPoint.exemptedParameters} options={parameterOptions} onChange={(value) => updatePoint('exemptedParameters', value)} />
                  <PointMultiSelectField label="พารามิเตอร์ที่เชื่อมต่อแล้ว" value={selectedPoint.connectedParameters} options={parameterOptions} onChange={(value) => updatePoint('connectedParameters', value)} />
                  <PointMultiSelectField label="พารามิเตอร์ที่ยังไม่เชื่อมต่อ" value={selectedPoint.pendingParameters} options={parameterOptions} onChange={(value) => updatePoint('pendingParameters', value)} />
                  <PointTextField label="เชื้อเพลิง (หลัก)" value={selectedPoint.primaryFuel} onChange={(value) => updatePoint('primaryFuel', value)} />
                  <PointTextField label="เชื้อเพลิงหลักอื่นๆ" value={selectedPoint.primaryFuelOther} onChange={(value) => updatePoint('primaryFuelOther', value)} />
                  <PointTextField label="เชื้อเพลิง (รอง)" value={selectedPoint.secondaryFuel} onChange={(value) => updatePoint('secondaryFuel', value)} />
                  <PointTextField label="เชื้อเพลิงรองอื่นๆ" value={selectedPoint.secondaryFuelOther} onChange={(value) => updatePoint('secondaryFuelOther', value)} />
                </Grid>
              </Stack>
            ) : null}
          </Stack>
        </Paper>

        <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'center', pb: 2 }}>
          <Button variant="outlined" color="inherit" onClick={() => {
            setFormId(null)
            setFactory(emptyFactory)
            setPoints([createEmptyPoint('CEMS')])
            setSelectedPointIndex(0)
          }}>
            ยกเลิก
          </Button>
          <Button variant="contained" color="success" startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />} disabled={!canSave} onClick={handleSave}>
            บันทึก
          </Button>
        </Stack>
      </Stack>

      <Snackbar open={message.type !== 'idle'} autoHideDuration={4500} onClose={() => setMessage({ type: 'idle', text: '' })}>
        <Alert severity={message.type === 'success' ? 'success' : 'error'} onClose={() => setMessage({ type: 'idle', text: '' })}>
          {message.text}
        </Alert>
      </Snackbar>
    </Box>
  )
}

function FactoryTextField({ label, value, onChange, md = 3 }) {
  return (
    <Grid size={{ xs: 12, md }}>
      <TextField label={label} value={value ?? ''} onChange={(event) => onChange(event.target.value)} fullWidth />
    </Grid>
  )
}

function PointTextField({ label, value, onChange }) {
  return (
    <Grid size={{ xs: 12, md: 3 }}>
      <TextField label={label} value={value ?? ''} onChange={(event) => onChange(event.target.value)} fullWidth />
    </Grid>
  )
}

function PointSelectField({ label, value, options, onChange }) {
  return (
    <Grid size={{ xs: 12, md: 3 }}>
      <FormControl fullWidth>
        <InputLabel>{label}</InputLabel>
        <Select label={label} value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Grid>
  )
}

function PointMultiSelectField({ label, value, options, onChange }) {
  return (
    <Grid size={{ xs: 12, md: 3 }}>
      <FormControl fullWidth>
        <InputLabel>{label}</InputLabel>
        <Select
          multiple
          label={label}
          value={value ?? []}
          onChange={(event) => onChange(typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)}
          input={<OutlinedInput label={label} />}
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
    </Grid>
  )
}

export default MonitoringPointFormsPage
