import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  Fade,
  FormControl,
  FormControlLabel,
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
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import AddTaskIcon from '@mui/icons-material/AddTask'
import AddIcon from '@mui/icons-material/Add'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined'
import EditIcon from '@mui/icons-material/Edit'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import RefreshIcon from '@mui/icons-material/Refresh'
import { DataGrid } from '@mui/x-data-grid'
import cemsInstallationRequiredOptions from '../option/cemsInstallationRequiredOptions.json'
import cemsParameterOptionItems from '../option/cemsParameterOptions.json'
import fuelOptions from '../option/fuelOptions.json'
import wpmsParameterOptionItems from '../option/wpmsParameterOptions.json'

const eligibleFactoryCandidatesApiUrl = import.meta.env.DEV
  ? '/api-proxy/v1/eligible-factories/candidates'
  : 'http://d-poms.diw.go.th/api/v1/eligible-factories/candidates'

const eligibleFactoriesApiUrl = import.meta.env.DEV
  ? '/api-proxy/v1/eligible-factories'
  : 'http://d-poms.diw.go.th/api/v1/eligible-factories'

const monitoringPointFormsApiUrl = import.meta.env.DEV
  ? '/api-proxy/v1/monitoring-point-forms'
  : 'http://d-poms.diw.go.th/api/v1/monitoring-point-forms'

const emptyValue = '-'

const subMenus = [
  { value: 'all', label: 'โรงงานทั้งหมด' },
  { value: 'eligible', label: 'โรงงานที่เข้าข่าย' },
  { value: 'requests', label: 'คำขอเชื่อมต่อ' },
]

const cemsParameterOptions = cemsParameterOptionItems.map((option) => option.label)
const wpmsParameterOptions = wpmsParameterOptionItems.map((option) => option.label)
const legalAnnexOptions = Array.from({ length: 12 }, (_, index) => String(index + 1))
const fuelOtherTriggerValues = ['เชื้อเพลิงชีวมวล (Biomass)', 'เชื้อเพลิงอื่นๆ']

const baseColumns = [
  { field: 'factoryName', headerName: 'ชื่อโรงงาน', width: 240 },
  { field: 'newRegistrationNo', headerName: 'เลขทะเบียนโรงงานแบบใหม่', width: 180 },
  { field: 'oldRegistrationNo', headerName: 'เลขทะเบียนโรงงานแบบเดิม', width: 190 },
  { field: 'factoryClass', headerName: 'ลำดับประเภทโรงงานหลัก', width: 190 },
  { field: 'factorySubclass', headerName: 'ลำดับประเภทโรงงานรอง', width: 190 },
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
  { field: 'productionCapacity', headerName: 'กำลังการผลิต', width: 170 },
  { field: 'machineryHorsepower', headerName: 'แรงม้าเครื่องจักร', width: 160, type: 'number' },
]

const eligibleMonitoringColumns = [
  {
    field: 'cemsPointCount',
    headerName: 'CEMS',
    width: 110,
    align: 'center',
    headerAlign: 'center',
    headerClassName: 'eligible-cems-header',
  },
  {
    field: 'wpmsPointCount',
    headerName: 'WPMS',
    width: 110,
    align: 'center',
    headerAlign: 'center',
    headerClassName: 'eligible-wpms-header',
  },
]

const connectionRequestRows = [
  {
    id: 'connection-request-1',
    factoryName: 'บริษัท พรีเมี่ยม อิควิปเม้นท์ แอนด์ เอ็นจิเนียริ่ง จำกัด',
    factoryRegistrationNo: '82010400125514',
    province: 'กรุงเทพมหานคร',
    reason: 'มีคำขอเชื่อมต่อระบบ CEMS และมีจุดตรวจวัดที่อยู่ในเกณฑ์พิจารณา',
  },
  {
    id: 'connection-request-2',
    factoryName: 'บริษัท เอสแอล โฮมโพรดักส์ จำกัด',
    factoryRegistrationNo: '82010000125609',
    province: 'กรุงเทพมหานคร',
    reason: 'มีคำขอเชื่อมต่อระบบ WPMS และมีการส่งข้อมูลตรวจวัดต่อเนื่อง',
  },
]

function getSubMenuLabel(menu) {
  if (menu.value !== 'requests') {
    return menu.label
  }

  return (
    <Badge
      badgeContent={connectionRequestRows.length}
      color="error"
      sx={{
        pr: 1.75,
        '& .MuiBadge-badge': {
          minWidth: 18,
          height: 18,
          px: 0.6,
          fontSize: 10,
          fontWeight: 700,
        },
      }}
    >
      <Box component="span">{menu.label}</Box>
    </Badge>
  )
}

const connectionRequestColumns = [
  { field: 'factoryName', headerName: 'ชื่อโรงงาน/บริษัท', minWidth: 260, flex: 1 },
  { field: 'factoryRegistrationNo', headerName: 'เลขทะเบียนโรงงาน', width: 190 },
  { field: 'province', headerName: 'จังหวัด', width: 150 },
  { field: 'reason', headerName: 'เหตุผล', minWidth: 320, flex: 1 },
  {
    field: 'actions',
    headerName: 'จัดการ',
    width: 160,
    sortable: false,
    filterable: false,
    renderCell: () => (
      <Button size="small" variant="contained" color="secondary" startIcon={<AddTaskIcon />}>
        เลือกเข้าข่าย
      </Button>
    ),
  },
]

function formatCoordinates(latitude, longitude) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return emptyValue
  }

  return `${latitude}, ${longitude}`
}

function getFactoryKey(row) {
  return row.factoryId || row.factoryRegistrationNo || row.id
}

function getMonitoringPointType(point = {}) {
  return point.systemType ?? point.type ?? point.details?.monitoringPointKind ?? (point.pointType === 'WASTEWATER' ? 'WPMS' : point.pointType === 'STACK' ? 'CEMS' : '')
}

function countMonitoringPointsByType(points = [], type) {
  const count = points.filter((point) => getMonitoringPointType(point) === type).length
  return count || emptyValue
}

function normalizeDisplayValue(value) {
  return value === emptyValue || value === undefined || value === null ? '' : value
}

function normalizeFactoryId(value) {
  return String(normalizeDisplayValue(value)).trim()
}

function normalizeArrayValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  return normalizeDisplayValue(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function shouldShowFuelOther(value) {
  return fuelOtherTriggerValues.includes(value)
}

async function readJsonResponse(result, fallbackMessage) {
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
      `${fallbackMessage} (${result.status} ${result.statusText})`
    throw new Error(message)
  }

  return response
}

function mapFactoryRow(row, index, idPrefix = 'factory') {
  const factoryKey = getFactoryKey(row) || `${idPrefix}-${index}`
  const measurementPoints = Array.isArray(row.measurementPoints) ? row.measurementPoints : []

  return {
    id: idPrefix === 'eligible' ? `eligible-${row.id ?? factoryKey}` : factoryKey,
    factoryKey,
    factoryId: row.factoryId ?? emptyValue,
    eligibleFactoryId: row.id ?? null,
    candidatePayload: row,
    factoryName: row.factoryName ?? emptyValue,
    newRegistrationNo: row.factoryId ?? emptyValue,
    oldRegistrationNo: row.factoryRegistrationNo ?? emptyValue,
    factoryClass: row.factoryClass ?? emptyValue,
    factorySubclass: row.factorySubclass ?? emptyValue,
    location: row.address ?? emptyValue,
    province: row.provinceName ?? emptyValue,
    industrialEstate: row.industrialEstateName ?? emptyValue,
    coordinates: formatCoordinates(row.latitude, row.longitude),
    operation: row.businessActivity ?? emptyValue,
    operationStatus: row.operationStatus ?? emptyValue,
    productionCapacity: row.productionCapacity ?? emptyValue,
    machineryHorsepower: typeof row.machineryHorsepower === 'number' ? row.machineryHorsepower : null,
    boilerSizeEach: row.boilerSizeEach ?? emptyValue,
    fuel: row.fuelUsed ?? emptyValue,
    eia: row.eia ?? (row.hasEia === true ? 'มี' : row.hasEia === false ? 'ไม่มี' : emptyValue),
    measurementPoints,
    cemsPointCount: countMonitoringPointsByType(measurementPoints, 'CEMS'),
    wpmsPointCount: countMonitoringPointsByType(measurementPoints, 'WPMS'),
  }
}

function mapCandidateFactory(row, index) {
  return mapFactoryRow(row, index, 'candidate')
}

function mapEligibleFactory(row, index) {
  return mapFactoryRow(row, index, 'eligible')
}

function createDefaultMonitoringPoint(type = 'CEMS', order = 1) {
  return {
    id: `${type.toLowerCase()}-${Date.now()}-${order}`,
    type,
    pointCode: '',
    pointName: '',
    productionUnitType: '',
    productionCapacity: '',
    cemsInstallationRequiredBy: '',
    cemsInstallationRequiredOther: '',
    legalAnnexNo: [],
    accountingConnectionStatus: '',
    primaryFuel: '',
    primaryFuelOther: '',
    secondaryFuel: '',
    secondaryFuelOther: '',
    eligibleParameters: [],
    exemptedParameters: [],
    connectedParameters: [],
    pendingParameters: [],
  }
}

function mapMonitoringPointToForm(point = {}, index = 0) {
  const type = getMonitoringPointType(point) === 'WPMS' ? 'WPMS' : 'CEMS'
  const details = point.details ?? {}

  return {
    ...createDefaultMonitoringPoint(type, index + 1),
    id: point.id ?? `${type.toLowerCase()}-${Date.now()}-${index + 1}`,
    type,
    pointCode: point.pointCode ?? point.code ?? '',
    pointName: point.pointName ?? point.name ?? '',
    productionUnitType: point.productionUnitType ?? details.productionUnitType ?? '',
    productionCapacity: point.productionCapacity ?? details.productionCapacity ?? '',
    cemsInstallationRequiredBy: point.cemsInstallationRequiredBy ?? details.cemsInstallationRequiredBy ?? '',
    cemsInstallationRequiredOther: point.cemsInstallationRequiredOther ?? details.cemsInstallationRequiredOther ?? '',
    legalAnnexNo: normalizeArrayValue(point.legalAnnexNo ?? details.legalAnnexNo),
    accountingConnectionStatus: point.accountingConnectionStatus ?? details.accountingConnectionStatus ?? '',
    primaryFuel: point.primaryFuel ?? details.primaryFuel ?? '',
    primaryFuelOther: point.primaryFuelOther ?? details.primaryFuelOther ?? '',
    secondaryFuel: point.secondaryFuel ?? details.secondaryFuel ?? '',
    secondaryFuelOther: point.secondaryFuelOther ?? details.secondaryFuelOther ?? '',
    eligibleParameters: point.eligibleParameters ?? details.eligibleParameters ?? [],
    exemptedParameters: point.exemptedParameters ?? details.exemptedParameters ?? [],
    connectedParameters: point.connectedParameters ?? details.connectedParameters ?? [],
    pendingParameters: point.pendingParameters ?? details.pendingParameters ?? [],
  }
}

function mapMonitoringPointForEligibleState(point) {
  const isWpms = point.type === 'WPMS'

  return {
    pointCode: point.pointCode || null,
    pointName: point.pointName || null,
    pointType: isWpms ? 'WASTEWATER' : 'STACK',
    systemType: point.type,
    details: isWpms
      ? {
          monitoringPointKind: 'WPMS',
          eligibleParameters: point.eligibleParameters ?? [],
          connectedParameters: point.connectedParameters ?? [],
          pendingParameters: point.pendingParameters ?? [],
        }
      : {
          monitoringPointKind: 'CEMS',
          productionUnitType: point.productionUnitType || null,
          productionCapacity: point.productionCapacity || null,
          cemsInstallationRequiredBy: point.cemsInstallationRequiredBy || null,
          cemsInstallationRequiredOther: point.cemsInstallationRequiredOther || null,
          legalAnnexNo: normalizeArrayValue(point.legalAnnexNo),
          primaryFuel: point.primaryFuel || null,
          primaryFuelOther: point.primaryFuelOther || null,
          secondaryFuel: point.secondaryFuel || null,
          secondaryFuelOther: point.secondaryFuelOther || null,
          eligibleParameters: point.eligibleParameters ?? [],
          exemptedParameters: point.exemptedParameters ?? [],
          connectedParameters: point.connectedParameters ?? [],
          pendingParameters: point.pendingParameters ?? [],
        },
  }
}

function mapMonitoringPointFormPayload(point) {
  return {
    systemType: point.type,
    pointCode: normalizeDisplayValue(point.pointCode) || null,
    pointName: normalizeDisplayValue(point.pointName),
    productionUnitType: normalizeDisplayValue(point.productionUnitType) || (point.type === 'WPMS' ? 'ระบบบำบัดน้ำเสีย' : null),
    productionCapacity: normalizeDisplayValue(point.productionCapacity) || null,
    cemsInstallationRequiredBy: point.type === 'CEMS' ? normalizeDisplayValue(point.cemsInstallationRequiredBy) || null : null,
    cemsInstallationRequiredOther: point.type === 'CEMS' ? normalizeDisplayValue(point.cemsInstallationRequiredOther) || null : null,
    legalAnnexNo: normalizeArrayValue(point.legalAnnexNo),
    accountingConnectionStatus: normalizeDisplayValue(point.accountingConnectionStatus) || null,
    eligibleParameters: point.eligibleParameters ?? [],
    exemptedParameters: point.type === 'CEMS' ? point.exemptedParameters ?? [] : [],
    connectedParameters: point.connectedParameters ?? [],
    pendingParameters: point.pendingParameters ?? [],
    primaryFuel: point.type === 'CEMS' ? normalizeDisplayValue(point.primaryFuel) || null : null,
    primaryFuelOther: point.type === 'CEMS' ? normalizeDisplayValue(point.primaryFuelOther) || null : null,
    secondaryFuel: point.type === 'CEMS' ? normalizeDisplayValue(point.secondaryFuel) || null : null,
    secondaryFuelOther: point.type === 'CEMS' ? normalizeDisplayValue(point.secondaryFuelOther) || null : null,
    details: null,
  }
}

function createMonitoringPointFormPayload(row, monitoringPoints = []) {
  return {
    factory: {
      factoryName: normalizeDisplayValue(row.factoryName),
      factoryRegistrationNoNew: normalizeDisplayValue(row.newRegistrationNo),
      factoryRegistrationNoOld: normalizeDisplayValue(row.oldRegistrationNo) || null,
      provinceName: normalizeDisplayValue(row.province) || null,
      factoryTypeMain: normalizeDisplayValue(row.factoryClass) || null,
      factoryTypeSub: normalizeDisplayValue(row.factorySubclass) || null,
      operationStatus: normalizeDisplayValue(row.operationStatus) || null,
      eiaInfo: normalizeDisplayValue(row.eia) || null,
      address: normalizeDisplayValue(row.location) || null,
      businessActivity: normalizeDisplayValue(row.operation) || null,
    },
    points: monitoringPoints.map(mapMonitoringPointFormPayload),
  }
}

function EligibleFactoriesPage({ accessToken = '' }) {
  const [activeTab, setActiveTab] = useState('all')
  const [factoryRows, setFactoryRows] = useState([])
  const [eligibleFactoryRows, setEligibleFactoryRows] = useState([])
  const [isLoadingFactories, setIsLoadingFactories] = useState(false)
  const [isLoadingEligibleFactories, setIsLoadingEligibleFactories] = useState(false)
  const [factoriesError, setFactoriesError] = useState('')
  const [eligibleFactoriesError, setEligibleFactoriesError] = useState('')
  const [eligibleActionError, setEligibleActionError] = useState('')
  const [savingEligibleFactoryIds, setSavingEligibleFactoryIds] = useState([])
  const [deletingEligibleFactoryIds, setDeletingEligibleFactoryIds] = useState([])
  const [selectedFactoryForSheet, setSelectedFactoryForSheet] = useState(null)
  const [monitoringPoints, setMonitoringPoints] = useState([])
  const [activeMonitoringPointId, setActiveMonitoringPointId] = useState('')
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('นำเข้าโรงงานเข้าข่ายสำเร็จ')
  const eligibleFactoryKeySet = useMemo(
    () => new Set(eligibleFactoryRows.map((row) => row.factoryKey)),
    [eligibleFactoryRows],
  )
  const eligibleFactoryIdSet = useMemo(
    () => new Set(eligibleFactoryRows.map((row) => normalizeFactoryId(row.factoryId)).filter(Boolean)),
    [eligibleFactoryRows],
  )
  const savingEligibleFactoryIdSet = useMemo(
    () => new Set(savingEligibleFactoryIds),
    [savingEligibleFactoryIds],
  )
  const deletingEligibleFactoryIdSet = useMemo(
    () => new Set(deletingEligibleFactoryIds),
    [deletingEligibleFactoryIds],
  )

  const loadFactoryCandidates = useCallback(
    async (signal) => {
      if (!accessToken) {
        return
      }

      setIsLoadingFactories(true)
      setFactoriesError('')

      try {
        const result = await fetch(eligibleFactoryCandidatesApiUrl, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          signal,
        })
        const rawText = await result.text()
        let response = rawText

        try {
          response = rawText ? JSON.parse(rawText) : null
        } catch {
          response = rawText
        }

        if (!result.ok || response?.success === false) {
          const message =
            response?.error?.message ??
            response?.message ??
            `โหลดข้อมูลโรงงานจาก กรอ. ไม่สำเร็จ (${result.status} ${result.statusText})`
          throw new Error(message)
        }

        const nextRows = Array.isArray(response?.data) ? response.data.map(mapCandidateFactory) : []
        setFactoryRows(nextRows)
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setFactoryRows([])
          setFactoriesError(requestError.message)
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoadingFactories(false)
        }
      }
    },
    [accessToken],
  )

  const loadEligibleFactories = useCallback(
    async (signal) => {
      if (!accessToken) {
        return
      }

      setIsLoadingEligibleFactories(true)
      setEligibleFactoriesError('')

      try {
        const result = await fetch(eligibleFactoriesApiUrl, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          signal,
        })
        const rawText = await result.text()
        let response = rawText

        try {
          response = rawText ? JSON.parse(rawText) : null
        } catch {
          response = rawText
        }

        if (!result.ok || response?.success === false) {
          const message =
            response?.error?.message ??
            response?.message ??
            `โหลดข้อมูลโรงงานที่เข้าข่ายไม่สำเร็จ (${result.status} ${result.statusText})`
          throw new Error(message)
        }

        const nextRows = Array.isArray(response?.data) ? response.data.map(mapEligibleFactory) : []
        setEligibleFactoryRows(nextRows)
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setEligibleFactoryRows([])
          setEligibleFactoriesError(requestError.message)
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoadingEligibleFactories(false)
        }
      }
    },
    [accessToken],
  )

  useEffect(() => {
    if (!accessToken) {
      return
    }

    const controller = new AbortController()

    async function loadRows() {
      await loadFactoryCandidates(controller.signal)
    }

    loadRows()

    return () => {
      controller.abort()
    }
  }, [accessToken, loadFactoryCandidates])

  useEffect(() => {
    if (!accessToken) {
      return
    }

    const controller = new AbortController()

    async function loadRows() {
      await loadEligibleFactories(controller.signal)
    }

    loadRows()

    return () => {
      controller.abort()
    }
  }, [accessToken, loadEligibleFactories])

  const effectiveFactoryRows = useMemo(
    () =>
      accessToken
        ? factoryRows.filter((row) => !eligibleFactoryIdSet.has(normalizeFactoryId(row.factoryId)))
        : [],
    [accessToken, eligibleFactoryIdSet, factoryRows],
  )
  const effectiveEligibleFactoryRows = useMemo(
    () => (accessToken ? eligibleFactoryRows : []),
    [accessToken, eligibleFactoryRows],
  )
  const effectiveFactoriesError = accessToken
    ? factoriesError
    : 'กรุณาเข้าสู่ระบบเพื่อดูข้อมูลโรงงานจาก กรอ.'
  const effectiveEligibleFactoriesError = accessToken
    ? eligibleFactoriesError
    : 'กรุณาเข้าสู่ระบบเพื่อดูข้อมูลโรงงานที่เข้าข่าย'

  const handleOpenEligibleSheet = useCallback(async (row, options = {}) => {
    const shouldStartEmpty = options.startEmpty === true
    const existingPoints = !shouldStartEmpty && Array.isArray(row.measurementPoints)
      ? row.measurementPoints.map(mapMonitoringPointToForm)
      : []
    const firstPoint = existingPoints[0] ?? null
    setSelectedFactoryForSheet(row)
    setMonitoringPoints(existingPoints)
    setActiveMonitoringPointId(firstPoint?.id ?? '')
    setEligibleActionError('')

    if (shouldStartEmpty || !accessToken || !normalizeDisplayValue(row.newRegistrationNo)) {
      return
    }

    try {
      const query = new URLSearchParams({
        factoryRegistrationNoNew: normalizeDisplayValue(row.newRegistrationNo),
      })
      const listResult = await fetch(`${monitoringPointFormsApiUrl}?${query.toString()}`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      })
      const listResponse = await readJsonResponse(listResult, 'โหลดข้อมูลฟอร์มจุดตรวจวัดไม่สำเร็จ')
      const existingForm = Array.isArray(listResponse?.data) ? listResponse.data[0] : null

      if (!existingForm?.id) {
        return
      }

      const detailResult = await fetch(`${monitoringPointFormsApiUrl}/${existingForm.id}`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      })
      const detailResponse = await readJsonResponse(detailResult, 'โหลดรายละเอียดฟอร์มจุดตรวจวัดไม่สำเร็จ')
      const detail = detailResponse?.data ?? existingForm
      const nextPoints = Array.isArray(detail.points) ? detail.points.map(mapMonitoringPointToForm) : []
      const nextFirstPoint = nextPoints[0] ?? null

      setSelectedFactoryForSheet((current) =>
        current?.id === row.id
          ? {
              ...current,
              monitoringPointFormId: detail.id ?? existingForm.id,
              measurementPoints: detail.points ?? current.measurementPoints,
            }
          : current,
      )
      if (nextPoints.length) {
        setMonitoringPoints(nextPoints)
        setActiveMonitoringPointId(nextFirstPoint?.id ?? '')
      }
    } catch (requestError) {
      setEligibleActionError(requestError.message)
    }
  }, [accessToken])

  const handleCloseEligibleSheet = useCallback(() => {
    setSelectedFactoryForSheet(null)
    setMonitoringPoints([])
    setActiveMonitoringPointId('')
  }, [])

  const handleMonitoringPointsChange = useCallback((updater) => {
    setMonitoringPoints((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater
      return next
    })
  }, [])

  const handleSaveMonitoringPointForm = useCallback(
    async (row, nextMonitoringPoints = []) => {
      if (!accessToken) {
        setEligibleActionError('กรุณาเข้าสู่ระบบก่อนบันทึกข้อมูลจุดตรวจวัด')
        return
      }

      setEligibleActionError('')
      setSavingEligibleFactoryIds((current) =>
        current.includes(row.id) ? current : [...current, row.id],
      )

      try {
        const formId = row.monitoringPointFormId ?? row.formId ?? null
        const result = await fetch(
          formId ? `${monitoringPointFormsApiUrl}/${formId}` : monitoringPointFormsApiUrl,
          {
            method: formId ? 'PUT' : 'POST',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(createMonitoringPointFormPayload(row, nextMonitoringPoints)),
          },
        )
        const response = await readJsonResponse(result, 'บันทึกข้อมูลจุดตรวจวัดไม่สำเร็จ')
        const savedData = response?.data ?? {}
        const savedFormId = savedData.id ?? formId
        const savedPoints = nextMonitoringPoints.map(mapMonitoringPointForEligibleState)
        const updateRows = (current) =>
          current.map((factoryRow) =>
            factoryRow.id === row.id || factoryRow.factoryKey === row.factoryKey
              ? {
                  ...factoryRow,
                  monitoringPointFormId: savedFormId,
                  measurementPoints: savedPoints,
                  cemsPointCount: countMonitoringPointsByType(nextMonitoringPoints, 'CEMS'),
                  wpmsPointCount: countMonitoringPointsByType(nextMonitoringPoints, 'WPMS'),
                }
              : factoryRow,
          )

        setFactoryRows(updateRows)
        setEligibleFactoryRows(updateRows)
        handleCloseEligibleSheet()
        setSnackbarMessage('บันทึกข้อมูลจุดตรวจวัดสำเร็จ')
        setSnackbarOpen(true)
      } catch (requestError) {
        setEligibleActionError(requestError.message)
      } finally {
        setSavingEligibleFactoryIds((current) => current.filter((id) => id !== row.id))
      }
    },
    [accessToken, handleCloseEligibleSheet],
  )

  const handleRemoveEligible = useCallback(
    async (row) => {
      if (!accessToken) {
        setEligibleActionError('กรุณาเข้าสู่ระบบก่อนนำโรงงานออกจากรายการเข้าข่าย')
        return
      }

      if (!row.eligibleFactoryId) {
        setEligibleActionError('ไม่พบรหัสรายการโรงงานที่เข้าข่ายสำหรับนำออก')
        return
      }

      setEligibleActionError('')
      setDeletingEligibleFactoryIds((current) =>
        current.includes(row.id) ? current : [...current, row.id],
      )

      try {
        const result = await fetch(`${eligibleFactoriesApiUrl}/${row.eligibleFactoryId}`, {
          method: 'DELETE',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        })
        const rawText = await result.text()
        let response = rawText

        try {
          response = rawText ? JSON.parse(rawText) : null
        } catch {
          response = rawText
        }

        if (!result.ok || response?.success === false) {
          const message =
            response?.error?.message ??
            response?.message ??
            `นำโรงงานออกจากรายการเข้าข่ายไม่สำเร็จ (${result.status} ${result.statusText})`
          throw new Error(message)
        }

        await loadEligibleFactories()
        setSnackbarMessage('นำโรงงานออกจากรายการเข้าข่ายสำเร็จ')
        setSnackbarOpen(true)
      } catch (requestError) {
        setEligibleActionError(requestError.message)
      } finally {
        setDeletingEligibleFactoryIds((current) => current.filter((id) => id !== row.id))
      }
    },
    [accessToken, loadEligibleFactories],
  )

  const allFactoryColumns = useMemo(
    () => [
      {
        field: 'option',
        headerName: 'Option',
        width: 130,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const isEligible = eligibleFactoryKeySet.has(params.row.factoryKey)
          const isSaving = savingEligibleFactoryIdSet.has(params.row.id)

          return (
            <Button
              size="small"
              variant={isEligible ? 'outlined' : 'contained'}
              color="secondary"
              startIcon={<AddIcon />}
              disabled={isEligible || isSaving}
              onClick={() => handleOpenEligibleSheet(params.row, { startEmpty: true })}
            >
              {isSaving ? 'กำลังบันทึก' : 'เลือกเข้าข่าย'}
            </Button>
          )
        },
      },
      ...baseColumns,
    ],
    [eligibleFactoryKeySet, handleOpenEligibleSheet, savingEligibleFactoryIdSet],
  )

  const eligibleFactoryColumns = useMemo(
    () => [
      {
        field: 'option',
        headerName: 'Option',
        width: 185,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const isDeleting = deletingEligibleFactoryIdSet.has(params.row.id)

          return (
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}
            >
              <Button
                size="small"
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => handleOpenEligibleSheet(params.row)}
              >
                แก้ไข
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<HighlightOffIcon />}
                disabled={isDeleting}
                onClick={() => handleRemoveEligible(params.row)}
              >
                {isDeleting ? 'กำลังนำออก' : 'นำออก'}
              </Button>
            </Stack>
          )
        },
      },
      ...baseColumns.slice(0, 3),
      ...eligibleMonitoringColumns,
      ...baseColumns.slice(3),
    ],
    [deletingEligibleFactoryIdSet, handleOpenEligibleSheet, handleRemoveEligible],
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

          {activeTab === 'all' ? (
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              disabled={!accessToken || isLoadingFactories}
              onClick={() => loadFactoryCandidates()}
              sx={{ flex: '0 0 auto' }}
            >
              {isLoadingFactories ? 'กำลังโหลด' : 'โหลดข้อมูลใหม่'}
            </Button>
          ) : null}

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
              <Tab key={menu.value} value={menu.value} label={getSubMenuLabel(menu)} />
            ))}
          </Tabs>
        </Stack>
      </Paper>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        TransitionComponent={Fade}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        message={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CheckCircleIcon fontSize="small" />
            <Typography component="span" variant="body2">
              {snackbarMessage}
            </Typography>
          </Stack>
        }
        sx={{
          '& .MuiSnackbarContent-root': {
            minWidth: 0,
            bgcolor: '#166534',
            color: '#ffffff',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16)',
          },
        }}
      />

      {eligibleActionError ? <Alert severity="error">{eligibleActionError}</Alert> : null}

      {activeTab === 'all' ? (
        <FactoryDataGrid
          title="โรงงานทั้งหมด (กรอ.)"
          rows={effectiveFactoryRows}
          columns={allFactoryColumns}
          loading={isLoadingFactories}
          error={effectiveFactoriesError}
        />
      ) : activeTab === 'eligible' ? (
        <FactoryDataGrid
          title="โรงงานที่เข้าข่าย"
          rows={effectiveEligibleFactoryRows}
          columns={eligibleFactoryColumns}
          loading={isLoadingEligibleFactories}
          error={effectiveEligibleFactoriesError}
        />
      ) : (
        <ConnectionRequestsPanel />
      )}

      <EligibleFactoryBottomSheet
        open={Boolean(selectedFactoryForSheet)}
        factory={selectedFactoryForSheet}
        monitoringPoints={monitoringPoints}
        activeMonitoringPointId={activeMonitoringPointId}
        saving={selectedFactoryForSheet ? savingEligibleFactoryIdSet.has(selectedFactoryForSheet.id) : false}
        onClose={handleCloseEligibleSheet}
        onActiveMonitoringPointChange={setActiveMonitoringPointId}
        onMonitoringPointsChange={handleMonitoringPointsChange}
        onSubmit={() => {
          if (selectedFactoryForSheet) {
            handleSaveMonitoringPointForm(selectedFactoryForSheet, monitoringPoints)
          }
        }}
      />
    </Stack>
  )
}

function EligibleFactoryBottomSheet({
  open,
  factory,
  monitoringPoints,
  activeMonitoringPointId,
  saving,
  onClose,
  onActiveMonitoringPointChange,
  onMonitoringPointsChange,
  onSubmit,
}) {
  const activePoint = monitoringPoints.find((point) => point.id === activeMonitoringPointId) ?? monitoringPoints[0]
  const activePointIndex = Math.max(0, monitoringPoints.findIndex((point) => point.id === activePoint?.id))

  const updateActivePoint = useCallback(
    (patch) => {
      if (!activePoint) {
        return
      }

      onMonitoringPointsChange((current) =>
        current.map((point) => (point.id === activePoint.id ? { ...point, ...patch } : point)),
      )
    },
    [activePoint, onMonitoringPointsChange],
  )

  const handleTypeChange = useCallback(
    (nextType) => {
      if (!activePoint) {
        return
      }

      const nextPoint = createDefaultMonitoringPoint(nextType, activePointIndex + 1)
      onMonitoringPointsChange((current) =>
        current.map((point) => (point.id === activePoint.id ? { ...nextPoint, id: point.id } : point)),
      )
    },
    [activePoint, activePointIndex, onMonitoringPointsChange],
  )

  const handleAddPoint = useCallback(() => {
    const nextPoint = createDefaultMonitoringPoint('CEMS', monitoringPoints.length + 1)
    onMonitoringPointsChange((current) => [...current, nextPoint])
    onActiveMonitoringPointChange(nextPoint.id)
  }, [monitoringPoints.length, onActiveMonitoringPointChange, onMonitoringPointsChange])

  const handleRemovePoint = useCallback(() => {
    if (!activePoint) {
      return
    }

    const nextPoints = monitoringPoints.filter((point) => point.id !== activePoint.id)
    onMonitoringPointsChange(nextPoints)
    onActiveMonitoringPointChange(nextPoints[0]?.id ?? '')
  }, [activePoint, monitoringPoints, onActiveMonitoringPointChange, onMonitoringPointsChange])

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          maxHeight: '92vh',
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
        },
      }}
    >
      <Stack spacing={2} sx={{ p: { xs: 2, md: 3 }, overflow: 'auto' }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6">เพิ่ม/แก้ไข ข้อมูลจุดตรวจวัด</Typography>
            <Typography variant="body2" color="text.secondary">
              เลือกโรงงานเข้าข่ายและกำหนดข้อมูลจุดตรวจวัดได้หลายจุด
            </Typography>
          </Box>
          <IconButton aria-label="ปิด" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
          <Typography sx={{ mb: 1.5, fontWeight: 700 }}>ข้อมูลทั่วไปของโรงงาน</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ชื่อโรงงาน" value={factory?.factoryName} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="เลขทะเบียนโรงงานแบบใหม่" value={factory?.newRegistrationNo} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="เลขทะเบียนโรงงานแบบเดิม" value={factory?.oldRegistrationNo} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="จังหวัด" value={factory?.province} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ลำดับประเภทโรงงานหลัก" value={factory?.factoryClass} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ลำดับประเภทโรงงานรอง" value={factory?.factorySubclass} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="สถานะการประกอบกิจการ" value={factory?.operationStatus} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ReadOnlyField label="ข้อมูล EIA" value={factory?.eia} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReadOnlyField label="สถานที่ตั้ง" value={factory?.location} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReadOnlyField label="การประกอบกิจการ" value={factory?.operation} />
            </Grid>
          </Grid>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', md: 'center' }, mb: 2 }}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>ข้อมูลจุดตรวจวัด</Typography>
              <Typography variant="body2" color="text.secondary">
                เลือกจุดเพื่อแก้ไข หรือเพิ่มจุดตรวจวัดใหม่
              </Typography>
            </Box>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddPoint}>
              เพิ่มจุดตรวจวัด
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              disabled={!activePoint}
              onClick={handleRemovePoint}
            >
              ลบจุดนี้
            </Button>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, mb: 2 }}>
            {monitoringPoints.map((point, index) => (
              <Chip
                key={point.id}
                label={`${point.type} จุดที่ ${index + 1}`}
                color={point.id === activePoint?.id ? 'primary' : 'default'}
                variant={point.id === activePoint?.id ? 'filled' : 'outlined'}
                onClick={() => onActiveMonitoringPointChange(point.id)}
              />
            ))}
          </Stack>

          {monitoringPoints.length ? (
            <Divider sx={{ mb: 2 }} />
          ) : null}

          {activePoint ? (
            <MonitoringPointForm point={activePoint} onChange={updateActivePoint} onTypeChange={handleTypeChange} />
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: 3,
                border: 1,
                borderStyle: 'dashed',
                borderColor: 'divider',
                bgcolor: 'background.default',
                textAlign: 'center',
              }}
            >
              <Typography color="text.secondary">
                ยังไม่มีข้อมูลจุดตรวจวัด
              </Typography>
            </Paper>
          )}
        </Paper>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'center' }}>
          <Button variant="outlined" color="inherit" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button variant="contained" color="secondary" disabled={saving} startIcon={<AddTaskIcon />} onClick={onSubmit}>
            {saving ? 'กำลังบันทึก' : 'บันทึก'}
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  )
}

function ReadOnlyField({ label, value }) {
  return (
    <TextField
      label={label}
      value={value ?? emptyValue}
      size="small"
      fullWidth
      InputProps={{ readOnly: true }}
    />
  )
}

function MonitoringPointForm({ point, onChange, onTypeChange }) {
  const isWpms = point.type === 'WPMS'
  const parameterOptions = isWpms ? wpmsParameterOptions : cemsParameterOptions

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
        <Typography sx={{ mb: 1, fontWeight: 700 }}>จุดตรวจวัด</Typography>
        <RadioGroup row value={point.type} onChange={(event) => onTypeChange(event.target.value)}>
          <FormControlLabel value="CEMS" control={<Radio size="small" />} label="CEMS" />
          <FormControlLabel value="WPMS" control={<Radio size="small" />} label="WPMS" />
        </RadioGroup>
      </Paper>

      <Stack spacing={2}>
        <Typography sx={{ mb: 1.5, fontWeight: 700 }}>รายละเอียดจุดตรวจวัด</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              label="รหัสจุดตรวจวัด"
              size="small"
              fullWidth
              value={point.pointCode}
              onChange={(event) => onChange({ pointCode: event.target.value })}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              label="ชื่อจุดตรวจวัด"
              size="small"
              fullWidth
              value={point.pointName}
              onChange={(event) => onChange({ pointName: event.target.value })}
            />
          </Grid>

          {!isWpms ? (
            <>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="ประเภทของหน่วยการผลิต"
                  size="small"
                  fullWidth
                  value={point.productionUnitType}
                  onChange={(event) => onChange({ productionUnitType: event.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="กำลังการผลิตต่อหน่วย"
                  size="small"
                  fullWidth
                  value={point.productionCapacity}
                  onChange={(event) => onChange({ productionCapacity: event.target.value })}
                />
              </Grid>
            </>
          ) : null}
        </Grid>

        {!isWpms ? (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                label="เข้าข่ายต้องติดตั้ง CEMS ตามกฎหมาย"
                size="small"
                fullWidth
                value={point.cemsInstallationRequiredBy}
                onChange={(event) => onChange({ cemsInstallationRequiredBy: event.target.value })}
              >
                <MenuItem value="">-</MenuItem>
                {cemsInstallationRequiredOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                label="อื่นๆ โปรดระบุ"
                size="small"
                fullWidth
                value={point.cemsInstallationRequiredOther}
                onChange={(event) => onChange({ cemsInstallationRequiredOther: event.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <ParameterMultiSelect
                label="เข้าข่ายตามบัญชีแนบท้ายลำดับที่"
                options={legalAnnexOptions}
                value={point.legalAnnexNo}
                onChange={(value) => onChange({ legalAnnexNo: value })}
              />
            </Grid>
          </Grid>
        ) : null}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}>
            <ParameterMultiSelect
              label="พารามิเตอร์ที่เข้าข่าย"
              options={parameterOptions}
              value={point.eligibleParameters}
              onChange={(value) => onChange({ eligibleParameters: value })}
            />
          </Grid>
          {!isWpms ? (
            <Grid size={{ xs: 12, md: 3 }}>
              <ParameterMultiSelect
                label="พารามิเตอร์ที่ได้รับการยกเว้น"
                options={parameterOptions}
                value={point.exemptedParameters}
                onChange={(value) => onChange({ exemptedParameters: value })}
              />
            </Grid>
          ) : null}
          <Grid size={{ xs: 12, md: 3 }}>
            <ParameterMultiSelect
              label="พารามิเตอร์ที่เชื่อมต่อแล้ว"
              options={parameterOptions}
              value={point.connectedParameters}
              onChange={(value) => onChange({ connectedParameters: value })}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <ParameterMultiSelect
              label="พารามิเตอร์ที่ยังไม่เชื่อมต่อ"
              options={parameterOptions}
              value={point.pendingParameters}
              onChange={(value) => onChange({ pendingParameters: value })}
            />
          </Grid>
        </Grid>
        {!isWpms ? (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                label="เชื้อเพลิง (หลัก)"
                size="small"
                fullWidth
                value={point.primaryFuel}
                onChange={(event) => {
                  const nextValue = event.target.value
                  onChange({
                    primaryFuel: nextValue,
                    primaryFuelOther: shouldShowFuelOther(nextValue) ? point.primaryFuelOther : '',
                  })
                }}
              >
                <MenuItem value="">-</MenuItem>
                {fuelOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {shouldShowFuelOther(point.primaryFuel) ? (
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="ระบุ (เชื้อเพลิงหลัก)"
                  size="small"
                  fullWidth
                  value={point.primaryFuelOther}
                  onChange={(event) => onChange({ primaryFuelOther: event.target.value })}
                />
              </Grid>
            ) : null}
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                label="เชื้อเพลิง (รอง)"
                size="small"
                fullWidth
                value={point.secondaryFuel}
                onChange={(event) => {
                  const nextValue = event.target.value
                  onChange({
                    secondaryFuel: nextValue,
                    secondaryFuelOther: shouldShowFuelOther(nextValue) ? point.secondaryFuelOther : '',
                  })
                }}
              >
                <MenuItem value="">-</MenuItem>
                {fuelOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {shouldShowFuelOther(point.secondaryFuel) ? (
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="ระบุ (เชื้อเพลิงรอง)"
                  size="small"
                  fullWidth
                  value={point.secondaryFuelOther}
                  onChange={(event) => onChange({ secondaryFuelOther: event.target.value })}
                />
              </Grid>
            ) : null}
          </Grid>
        ) : null}
      </Stack>
    </Stack>
  )
}

function ParameterMultiSelect({ label, options, value = [], onChange }) {
  return (
    <FormControl size="small" fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select
        multiple
        value={value}
        label={label}
        input={<OutlinedInput label={label} />}
        onChange={(event) => {
          const nextValue = typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value
          onChange(nextValue)
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

function FactoryDataGrid({ title, rows, columns, loading = false, error = '' }) {
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
      {error ? (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          {error}
        </Alert>
      ) : null}
      <Box sx={{ height: '100%', minHeight: 420 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          disableVirtualization
          showToolbar
          showCellVerticalBorder
          showColumnVerticalBorder
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
            '& .MuiDataGrid-cell[data-field="option"]': {
              display: 'flex',
              alignItems: 'center',
            },
            '& .MuiDataGrid-columnHeader[data-field="option"], & .MuiDataGrid-cell[data-field="option"]': {
              position: 'sticky',
              left: 0,
              zIndex: 5,
              bgcolor: 'background.paper',
              boxShadow: '4px 0 8px -8px rgba(15, 23, 42, 0.45)',
            },
            '& .MuiDataGrid-columnHeader[data-field="option"]': {
              zIndex: 8,
              bgcolor: '#eef2f6',
            },
            '& .MuiDataGrid-columnHeader.eligible-cems-header': {
              bgcolor: '#ffedd5',
              color: '#9a3412',
            },
            '& .MuiDataGrid-columnHeader.eligible-wpms-header': {
              bgcolor: '#dbeafe',
              color: '#1e40af',
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

function ConnectionRequestsPanel() {
  return (
    <FactoryDataGrid
      title="คำขอเชื่อมต่อ"
      rows={connectionRequestRows}
      columns={connectionRequestColumns}
    />
  )
}

export default EligibleFactoriesPage
