import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
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
  Tooltip,
  Typography,
} from '@mui/material'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import SearchIcon from '@mui/icons-material/Search'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { PickerDay } from '@mui/x-date-pickers/PickerDay'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjsBuddhist } from '@mui/x-date-pickers/AdapterDayjsBuddhist'
import { LineChart } from '@mui/x-charts/LineChart'
import dayjs from 'dayjs'
import 'dayjs/locale/th'
import locationOptions from '../option/locationOptions.json'

const longdoMapKey = import.meta.env.VITE_LONGDO_MAP_KEY ?? ''
const longdoMapScriptId = 'longdo-map-script'

const factoryTypes = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'wpms', label: 'WPMS' },
  { value: 'cems', label: 'CEMS' },
]

const sortOptions = [
  { value: 'reference', label: 'จากพิกัดอ้างอิง' },
  { value: 'name', label: 'ชื่อโรงงาน' },
  { value: 'distance', label: 'ระยะทางใกล้สุด' },
]

const referencePoint = { lon: 100.574, lat: 13.91 }
const operatorFactoriesApiUrl = import.meta.env.DEV
  ? '/api-proxy/v1/operator-factory-dashboard'
  : 'https://d-poms.diw.go.th/api/v1/operator-factory-dashboard'
const publicFactoryMapPointsApiUrl = import.meta.env.DEV
  ? '/api-proxy/v1/public/factory-map-points'
  : 'https://d-poms.diw.go.th/api/v1/public/factory-map-points'
const connectedMeasurementPointsApiBaseUrl = import.meta.env.DEV
  ? '/api-proxy/v1/connected-measurement-points'
  : 'https://d-poms.diw.go.th/api/v1/connected-measurement-points'
const logoBackgrounds = ['#dbeafe', '#fef3c7', '#fee2e2', '#dcfce7', '#e0f2fe', '#ffedd5', '#ecfdf3']
const allLocationOption = { label: 'ทั้งหมด', value: 'all' }
const regionOptions = locationOptions.regions
const locationProvinceItems = locationOptions.provinces
const provinceRegionMap = Object.fromEntries(locationProvinceItems.map((province) => [province.value, province.region]))
const datePickerStatusStyles = {
  lowData: { backgroundColor: '#e5e7eb' },
  highData: { backgroundColor: '#dbeafe' },
  normal: { borderColor: '#22c55e' },
  warning: { borderColor: '#f59e0b' },
  exceeded: { borderColor: '#ef4444' },
}
const statisticParameters = ['CO (ppm)', 'NOx (ppm)', 'Temp. (°C)', 'O2 (%)', 'Flow (m3/hr)']
const statisticStatusColors = {
  normal: '#46b529',
  warning: '#f59e0b',
  exceeded: '#ef4444',
  unavailable: '#9ca3af',
  insufficient: '#9ca3af',
  noData: '#9ca3af',
  invalid: '#9ca3af',
}
const pollutionTrendLegendItems = [
  { label: 'ปกติ ค่ามลพิษ ≤ 180', color: statisticStatusColors.normal },
  { label: 'เฝ้าระวัง ค่ามลพิษ ≤ 190', color: statisticStatusColors.warning },
  { label: 'เกินมาตรฐาน ค่ามลพิษ > 190', color: statisticStatusColors.exceeded },
  { label: 'ข้อมูลไม่เพียงพอ', color: statisticStatusColors.unavailable },
]

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

function getOperatorFactoriesApiUrl(systemType) {
  const baseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'd-poms.diw.go.th'
      ? '/api/v1/operator-factory-dashboard'
      : operatorFactoriesApiUrl
  const params = new URLSearchParams()

  if (systemType === 'CEMS' || systemType === 'WPMS') {
    params.set('systemType', systemType)
  }

  return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl
}

function getPublicFactoryMapPointsApiUrl(systemType) {
  const baseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'd-poms.diw.go.th'
      ? '/api/v1/public/factory-map-points'
      : publicFactoryMapPointsApiUrl
  const params = new URLSearchParams()

  if (systemType === 'CEMS' || systemType === 'WPMS') {
    params.set('systemType', systemType)
  }

  return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl
}

function getOperatorFactoryFavoriteApiUrl(factoryId) {
  const encodedFactoryId = encodeURIComponent(factoryId)
  const baseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'd-poms.diw.go.th'
      ? '/api/v1/operator-factories'
      : (import.meta.env.DEV ? '/api-proxy/v1/operator-factories' : 'https://d-poms.diw.go.th/api/v1/operator-factories')

  return `${baseUrl}/${encodedFactoryId}/favorite`
}

function getConnectedMeasurementPointApiUrl(stationId, resource, params = {}) {
  const baseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'd-poms.diw.go.th'
      ? '/api/v1/connected-measurement-points'
      : connectedMeasurementPointsApiBaseUrl
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.set(key, value)
    }
  })

  const path = `${baseUrl}/${encodeURIComponent(stationId)}/${resource}`
  return searchParams.toString() ? `${path}?${searchParams.toString()}` : path
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : null
}

function normalizeStatus(status) {
  return ['normal', 'warning', 'exceeded'].includes(status) ? status : 'unavailable'
}

function getParameterLabelFromThreshold(threshold) {
  if (threshold?.parameterLabel) {
    return threshold.parameterLabel
  }

  if (threshold?.parameterName && threshold?.unit) {
    return `${threshold.parameterName} (${threshold.unit})`
  }

  return threshold?.parameterCode ?? ''
}

function getParameterLabelFromSummary(row) {
  if (row?.parameterLabel) {
    return row.parameterLabel
  }

  if (row?.parameterName && row?.unit) {
    return `${row.parameterName} (${row.unit})`
  }

  return row?.parameterCode ?? ''
}

function getMeasurementParameterValue(values, parameter) {
  if (!values || !parameter) {
    return null
  }

  return values[parameter.label] ?? values[parameter.code] ?? null
}

function mapCalendarSummaryRows(rows) {
  if (!Array.isArray(rows)) {
    return []
  }

  return rows.map((row) => ({
    parameter: getParameterLabelFromSummary(row),
    exceededDays: `${Number(row.exceededDays ?? 0).toLocaleString('th-TH')} วัน`,
    lowDataDays: `${Number(row.lowDataDays ?? 0).toLocaleString('th-TH')} วัน`,
    todayPercent:
      row.todayDataCompletenessPercent === null || row.todayDataCompletenessPercent === undefined
        ? '-'
        : `${Number(row.todayDataCompletenessPercent).toLocaleString('th-TH')}%`,
  }))
}

function mapDatePickerStatusByDay(days) {
  if (!Array.isArray(days)) {
    return {}
  }

  return days.reduce((result, day) => {
    if (!day?.date) {
      return result
    }

    result[day.date] = {
      backgroundStatus: day.display?.backgroundStatus ?? day.dataCompletenessStatus ?? null,
      borderStatus: day.display?.borderStatus ?? day.pollutionStatus ?? null,
    }
    return result
  }, {})
}

function mapMeasurementStatistics(payload, selectedPoint) {
  const data = payload?.data ?? {}
  const thresholds = Array.isArray(data.thresholds) ? data.thresholds : []
  const parameterMap = thresholds
    .map((threshold) => ({
      code: threshold?.parameterCode,
      label: getParameterLabelFromThreshold(threshold),
    }))
    .filter((parameter) => parameter.code && parameter.label)
  const fallbackParameters = Array.isArray(payload?.meta?.registeredParameters) ? payload.meta.registeredParameters : []
  const parameters = parameterMap.length > 0 ? parameterMap.map((parameter) => parameter.label) : fallbackParameters
  const pointRows = Array.isArray(data.measurementPoints) ? data.measurementPoints : []
  const selectedRows =
    pointRows.find((point) => [point?.stationId, point?.pointCode].includes(selectedPoint)) ?? pointRows[0] ?? {}
  const rows = Array.isArray(selectedRows.rows) ? selectedRows.rows : []

  return {
    parameters: parameters.length > 0 ? parameters : statisticParameters,
    rows: rows.map((row) => {
      const values = {}
      const chartValues = {}
      const statuses = {}

      if (parameterMap.length > 0) {
        parameterMap.forEach((parameter) => {
          const value = getMeasurementParameterValue(row.values, parameter)
          values[parameter.label] = value?.displayValue ?? value?.value ?? ''
          chartValues[parameter.label] = toFiniteNumber(value?.value)
          statuses[parameter.label] = normalizeStatus(value?.status)
        })
      } else {
        parameters.forEach((parameter) => {
          const value = row.values?.[parameter]
          values[parameter] = value?.displayValue ?? value?.value ?? ''
          chartValues[parameter] = toFiniteNumber(value?.value)
          statuses[parameter] = normalizeStatus(value?.status)
        })
      }

      return {
        date: selectedRows.date ?? payload?.meta?.date ?? '',
        time: row.time ?? '',
        chartTime: row.chartTime ?? String(row.time ?? '').slice(0, 5).replace('.', ':'),
        values,
        chartValues,
        statuses,
      }
    }),
  }
}

function getApiErrorMessage(payload, fallback) {
  return payload?.message || payload?.error || fallback
}

function hasFactoryCoordinate(factory) {
  return Number.isFinite(factory.lon) && Number.isFinite(factory.lat)
}

function getRegionByProvince(province) {
  return provinceRegionMap[province] ?? ''
}

function getProvinceOptionsByRegion(region) {
  const provinces = region === 'all'
    ? locationProvinceItems
    : locationProvinceItems.filter((province) => province.region === region)

  return [allLocationOption, ...provinces.map(({ label, value }) => ({ label, value }))]
}

function getDistrictOptionsByProvince(province) {
  const selectedProvince = locationProvinceItems.find((item) => item.value === province)

  return selectedProvince?.districts ?? [allLocationOption]
}

function getDistanceFromReference(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return null
  }

  const earthRadiusKm = 6371
  const toRadians = (degrees) => (degrees * Math.PI) / 180
  const deltaLat = toRadians(lat - referencePoint.lat)
  const deltaLon = toRadians(lon - referencePoint.lon)
  const firstLat = toRadians(referencePoint.lat)
  const secondLat = toRadians(lat)
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(deltaLon / 2) ** 2

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function getFactorySystems(row) {
  const systemsFromCounts = Array.isArray(row.monitoringPointCountBySystem)
    ? row.monitoringPointCountBySystem
        .filter((item) => Number(item?.count ?? 0) > 0 && item?.systemType)
        .map((item) => item.systemType)
    : []
  const systemsFromPoints = Array.isArray(row.measurementPoints)
    ? row.measurementPoints.map((point) => point?.systemType).filter(Boolean)
    : []

  return Array.from(new Set([...systemsFromCounts, ...systemsFromPoints]))
}

function getFactoryLogoText(factoryName, registrationNo) {
  const source = String(factoryName || registrationNo || '').trim()
  return source.slice(0, 2).toUpperCase() || 'DP'
}

function normalizeUploadUrl(url) {
  const value = String(url ?? '').trim()

  if (!value) {
    return ''
  }

  try {
    const parsedUrl = new URL(value)

    if (parsedUrl.pathname.startsWith('/uploads/')) {
      return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
    }

    return value
  } catch {
    if (value.startsWith('/uploads/')) {
      return value
    }

    if (value.startsWith('uploads/')) {
      return `/${value}`
    }

    if (value.startsWith('/')) {
      return value
    }

    return value
  }
}

function getAbsoluteAssetUrl(url) {
  const value = String(url ?? '').trim()

  if (!value || /^https?:\/\//i.test(value) || value.startsWith('data:')) {
    return value
  }

  if (typeof window === 'undefined') {
    return value
  }

  return new URL(value.startsWith('/') ? value : `/${value}`, window.location.origin).toString()
}

function mapOperatorFactory(row, index) {
  const lon = toFiniteNumber(row.longitude)
  const lat = toFiniteNumber(row.latitude)
  const systems = getFactorySystems(row)

  return {
    id: row.factoryId ?? row.id ?? row.newRegistrationNo ?? `factory-${index}`,
    sourceId: row.id ?? null,
    factoryId: row.factoryId ?? row.id ?? '',
    name: row.factoryName ?? '',
    newRegistrationNo: row.newRegistrationNo ?? '',
    oldRegistrationNo: row.oldRegistrationNo ?? row.factoryRegistrationNo ?? '',
    address: row.address ?? '',
    province: row.province ?? '',
    industrialEstateCode: row.industrialEstateCode ?? '',
    systems,
    distance: getDistanceFromReference(lon, lat),
    lon,
    lat,
    logoText: getFactoryLogoText(row.factoryName, row.newRegistrationNo),
    logoBg: logoBackgrounds[index % logoBackgrounds.length],
    logoUrl: normalizeUploadUrl(row.factoryLogoUrl ?? row.logoUrl),
    isFavorite: row.isFavorite === true,
    measurementPoints: Array.isArray(row.measurementPoints) ? row.measurementPoints : [],
  }
}

function loadLongdoMapScript() {
  if (!longdoMapKey) {
    return Promise.reject(new Error('missing-map-key'))
  }

  if (window.longdo) {
    return Promise.resolve(window.longdo)
  }

  const existingScript = document.getElementById(longdoMapScriptId)
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener('load', () => resolve(window.longdo), { once: true })
      existingScript.addEventListener('error', reject, { once: true })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = longdoMapScriptId
    script.src = `https://api.longdo.com/map/?key=${encodeURIComponent(longdoMapKey)}`
    script.async = true
    script.onload = () => resolve(window.longdo)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function HomePage({ accessToken = '', permissions }) {
  const [factoryType, setFactoryType] = useState('all')
  const [sortBy, setSortBy] = useState('reference')
  const [searchValue, setSearchValue] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [selectedFactory, setSelectedFactory] = useState(null)
  const [isMobileListExpanded, setIsMobileListExpanded] = useState(true)
  const [factoryOrderFilter, setFactoryOrderFilter] = useState('')
  const [industrialEstateFilter, setIndustrialEstateFilter] = useState('all')
  const canUseFavorite = permissions?.dashboard?.favorite === true
  const [industrialEstateNameFilter, setIndustrialEstateNameFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('all')
  const [provinceFilter, setProvinceFilter] = useState('all')
  const [districtFilter, setDistrictFilter] = useState('all')
  const [latestInspectionResultFilter, setLatestInspectionResultFilter] = useState('all')
  const [monitoringFilter, setMonitoringFilter] = useState('all')
  const [factories, setFactories] = useState([])
  const [factoriesError, setFactoriesError] = useState('')
  const [favoriteUpdatingFactoryId, setFavoriteUpdatingFactoryId] = useState('')
  const [favoriteError, setFavoriteError] = useState('')
  const apiSystemType = factoryType === 'cems' ? 'CEMS' : factoryType === 'wpms' ? 'WPMS' : ''
  const effectiveFactories = factories
  const effectiveFactoriesError = factoriesError
  useEffect(() => {
    let isActive = true
    const requestUrl = accessToken
      ? getOperatorFactoriesApiUrl(apiSystemType)
      : getPublicFactoryMapPointsApiUrl(apiSystemType)
    const requestOptions = accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined

    fetch(requestUrl, requestOptions)
      .then(async (result) => {
        const payload = await result.json().catch(() => null)

        if (!result.ok) {
          throw new Error(payload?.message || `โหลดรายชื่อโรงงานไม่สำเร็จ (${result.status} ${result.statusText})`)
        }

        if (isActive) {
          const rows = Array.isArray(payload?.data) ? payload.data.map(mapOperatorFactory) : []
          setFactories(rows)
          setFactoriesError('')
        }
      })
      .catch((error) => {
        if (isActive) {
          setFactories([])
          setFactoriesError(error instanceof Error ? error.message : 'โหลดรายชื่อโรงงานไม่สำเร็จ')
        }
      })

    return () => {
      isActive = false
    }
  }, [accessToken, apiSystemType])

  const filteredFactories = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    const filtered = effectiveFactories.filter((factory) => {
      const matchesType =
        factoryType === 'all' || factory.systems.some((system) => system.toLowerCase() === factoryType)
      const matchesFactoryOrder =
        !factoryOrderFilter.trim() || factory.newRegistrationNo.toLowerCase().includes(factoryOrderFilter.trim().toLowerCase())
      const matchesIndustrialEstate =
        industrialEstateFilter === 'all' ||
        (industrialEstateFilter === 'industrial-estate' && Boolean(factory.industrialEstateCode)) ||
        (industrialEstateFilter === 'outside-industrial-estate' && !factory.industrialEstateCode)
      const matchesIndustrialEstateName =
        !industrialEstateNameFilter.trim() ||
        factory.industrialEstateCode.toLowerCase().includes(industrialEstateNameFilter.trim().toLowerCase())
      const matchesRegion = regionFilter === 'all' || getRegionByProvince(factory.province) === regionFilter
      const matchesProvince = provinceFilter === 'all' || factory.province === provinceFilter
      const matchesDistrict =
        districtFilter === 'all' || factory.address.toLowerCase().includes(districtFilter.toLowerCase())
      const matchesKeyword =
        !keyword ||
        [factory.name, factory.newRegistrationNo, factory.oldRegistrationNo, factory.address, factory.province]
          .join(' ')
          .toLowerCase()
          .includes(keyword)

      return (
        matchesType &&
        matchesFactoryOrder &&
        matchesIndustrialEstate &&
        matchesIndustrialEstateName &&
        matchesRegion &&
        matchesProvince &&
        matchesDistrict &&
        matchesKeyword
      )
    })

    return filtered.toSorted((first, second) => {
      if (sortBy === 'name') {
        return first.name.localeCompare(second.name, 'th')
      }

      return (first.distance ?? Number.POSITIVE_INFINITY) - (second.distance ?? Number.POSITIVE_INFINITY)
    })
  }, [
    districtFilter,
    effectiveFactories,
    factoryOrderFilter,
    factoryType,
    industrialEstateNameFilter,
    industrialEstateFilter,
    provinceFilter,
    regionFilter,
    searchValue,
    sortBy,
  ])
  const handleFavoriteToggle = async (factory) => {
    const favoriteIdentifiers = [
      factory?.factoryId,
      factory?.newRegistrationNo,
      factory?.sourceId,
    ].filter((value, index, list) => value && list.indexOf(value) === index)

    if (!accessToken || favoriteIdentifiers.length === 0) {
      return
    }

    const nextFavorite = !factory.isFavorite
    setFavoriteUpdatingFactoryId(factory.factoryId || factory.id)
    setFavoriteError('')

    try {
      let favoritePayload = null
      let favoriteError = null

      for (const identifier of favoriteIdentifiers) {
        const result = await fetch(getOperatorFactoryFavoriteApiUrl(identifier), {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ isFavorite: nextFavorite }),
        })
        const payload = await result.json().catch(() => null)

        if (result.ok && payload?.success !== false) {
          favoritePayload = payload
          break
        }

        favoriteError = new Error(payload?.message ?? payload?.error?.message ?? `อัปเดตรายการติดตามไม่สำเร็จ (${result.status} ${result.statusText})`)
        if (payload?.error?.code !== 'NOT_FOUND') {
          break
        }
      }

      if (!favoritePayload) {
        throw favoriteError ?? new Error('อัปเดตรายการติดตามไม่สำเร็จ')
      }

      const updatedFavorite = favoritePayload?.data?.isFavorite ?? nextFavorite
      const updateFactoryFavorite = (currentFactory) =>
        currentFactory.factoryId === factory.factoryId ||
        currentFactory.id === factory.id ||
        currentFactory.sourceId === factory.sourceId
          ? { ...currentFactory, isFavorite: updatedFavorite }
          : currentFactory

      setFactories((current) => current.map(updateFactoryFavorite))
      setSelectedFactory((current) => (current ? updateFactoryFavorite(current) : current))
    } catch (error) {
      setFavoriteError(error instanceof Error ? error.message : 'อัปเดตรายการติดตามไม่สำเร็จ')
    } finally {
      setFavoriteUpdatingFactoryId('')
    }
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      <HomeFilters
        factoryType={factoryType}
        sortBy={sortBy}
        searchValue={searchValue}
        onFactoryTypeChange={setFactoryType}
        onSortByChange={setSortBy}
        onSearchValueChange={setSearchValue}
        onAdvancedOpen={() => setAdvancedOpen(true)}
      />

      <Box
        sx={{
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(360px, 40%) minmax(0, 1fr)' },
          gridTemplateRows: '1fr',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <FactoryList
          factories={filteredFactories}
          loading={false}
          error={favoriteError || effectiveFactoriesError}
          isMobileExpanded={isMobileListExpanded}
          canUseFavorite={canUseFavorite}
          canViewDetails={Boolean(accessToken)}
          favoriteUpdatingFactoryId={favoriteUpdatingFactoryId}
          onMobileToggle={() => setIsMobileListExpanded((current) => !current)}
          onFactorySelect={setSelectedFactory}
          onFavoriteToggle={handleFavoriteToggle}
        />
        <FactoryMap factories={filteredFactories} />
      </Box>

      <AdvancedSearchDialog
        open={advancedOpen}
        factoryOrderFilter={factoryOrderFilter}
        industrialEstateFilter={industrialEstateFilter}
        industrialEstateNameFilter={industrialEstateNameFilter}
        regionFilter={regionFilter}
        provinceFilter={provinceFilter}
        districtFilter={districtFilter}
        provinceOptions={getProvinceOptionsByRegion(regionFilter)}
        districtOptions={getDistrictOptionsByProvince(provinceFilter)}
        latestInspectionResultFilter={latestInspectionResultFilter}
        monitoringFilter={monitoringFilter}
        onFactoryOrderFilterChange={setFactoryOrderFilter}
        onIndustrialEstateFilterChange={(nextValue) => {
          setIndustrialEstateFilter(nextValue)
          if (nextValue !== 'industrial-estate') {
            setIndustrialEstateNameFilter('')
          }
        }}
        onIndustrialEstateNameFilterChange={setIndustrialEstateNameFilter}
        onRegionFilterChange={(nextValue) => {
          setRegionFilter(nextValue)
          setProvinceFilter('all')
          setDistrictFilter('all')
        }}
        onProvinceFilterChange={(nextValue) => {
          setProvinceFilter(nextValue)
          setDistrictFilter('all')
        }}
        onDistrictFilterChange={setDistrictFilter}
        onLatestInspectionResultFilterChange={setLatestInspectionResultFilter}
        onMonitoringFilterChange={setMonitoringFilter}
        onClose={() => setAdvancedOpen(false)}
      />
      <FactoryBottomSheet
        factory={selectedFactory}
        accessToken={accessToken}
        open={Boolean(selectedFactory)}
        onClose={() => setSelectedFactory(null)}
      />
    </Box>
  )
}

function HomeFilters({
  factoryType,
  sortBy,
  searchValue,
  onFactoryTypeChange,
  onSortByChange,
  onSearchValueChange,
  onAdvancedOpen,
}) {
  return (
    <Paper
      elevation={0}
      square
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        p: { xs: 1.5, sm: 2 },
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 1.25, md: 2 }}
        sx={{ alignItems: { xs: 'stretch', md: 'flex-end' } }}
      >
        <Stack direction="row" spacing={1} sx={{ flex: { md: '0 0 auto' } }}>
          <FormControl size="small" sx={{ minWidth: { xs: 0, sm: 150, md: 180 }, flex: 1 }}>
            <InputLabel id="factory-type-label">ประเภท</InputLabel>
            <Select
              labelId="factory-type-label"
              value={factoryType}
              label="ประเภท"
              onChange={(event) => onFactoryTypeChange(event.target.value)}
            >
              {factoryTypes.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: { xs: 0, sm: 170, md: 220 }, flex: 1 }}>
            <InputLabel id="factory-sort-label">จัดเรียงตาม</InputLabel>
            <Select
              labelId="factory-sort-label"
              value={sortBy}
              label="จัดเรียงตาม"
              onChange={(event) => onSortByChange(event.target.value)}
            >
              {sortOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          sx={{
            flex: 1,
            justifyContent: { md: 'flex-end' },
          }}
        >
          <TextField
            size="small"
            value={searchValue}
            placeholder="ค้นหาชื่อโรงงาน"
            onChange={(event) => onSearchValueChange(event.target.value)}
            sx={{
              flex: 1,
              maxWidth: { md: 360 },
              '& .MuiInputBase-root': {
                bgcolor: 'background.paper',
              },
            }}
            slotProps={{
              input: {
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
              },
            }}
          />
          <Button
            variant="contained"
            onClick={onAdvancedOpen}
            sx={{
              minWidth: { xs: 140, sm: 170 },
              background: 'linear-gradient(90deg, #1f6feb 0%, #7c3aed 100%)',
              '&:hover': {
                background: 'linear-gradient(90deg, #185abc 0%, #6d28d9 100%)',
              },
            }}
          >
            ค้นหาขั้นสูง
          </Button>
        </Stack>
      </Stack>
    </Paper>
  )
}

function FactoryList({
  factories,
  loading,
  error,
  isMobileExpanded,
  canUseFavorite = false,
  canViewDetails = false,
  favoriteUpdatingFactoryId = '',
  onMobileToggle,
  onFactorySelect,
  onFavoriteToggle,
}) {
  return (
    <Box
      sx={{
        minHeight: 0,
        order: { md: 1 },
        display: 'grid',
        gridTemplateRows: { xs: 'auto minmax(0, 1fr)', md: '1fr' },
        overflow: 'hidden',
        position: { xs: 'absolute', md: 'static' },
        top: { xs: isMobileExpanded ? 0 : '44%', md: 'auto' },
        right: { xs: 0, md: 'auto' },
        bottom: { xs: 0, md: 'auto' },
        left: { xs: 0, md: 'auto' },
        zIndex: { xs: 2, md: 'auto' },
        borderRight: { md: 1 },
        borderColor: 'divider',
        bgcolor: '#fbfdff',
        transition: { xs: 'top 180ms ease', md: 'none' },
      }}
    >
      <IconButton
        aria-label={isMobileExpanded ? 'ย่อรายชื่อโรงงาน' : 'ขยายรายชื่อโรงงาน'}
        onClick={onMobileToggle}
        sx={{
          display: { xs: 'flex', md: 'none' },
          width: 72,
          height: 28,
          mx: 'auto',
          my: 0.75,
          borderRadius: 999,
          color: 'neutral.500',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 5,
            width: 48,
            height: 4,
            borderRadius: 999,
            bgcolor: 'neutral.300',
          },
        }}
      >
      </IconButton>

      <Stack spacing={1.5} sx={{ minHeight: 0, overflow: 'auto', px: { xs: 1.5, md: 2 }, pb: { xs: 1.5, md: 2 }, pt: { md: 2 } }}>
        {loading ? (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              textAlign: 'center',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              กำลังโหลดรายชื่อโรงงาน...
            </Typography>
          </Paper>
        ) : null}

        {error ? (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              textAlign: 'center',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          </Paper>
        ) : null}

        {factories.map((factory) => (
          <FactoryCard
            key={factory.id}
            factory={factory}
            canUseFavorite={canUseFavorite}
            canViewDetails={canViewDetails}
            favoriteUpdating={favoriteUpdatingFactoryId === factory.factoryId}
            onSelect={() => onFactorySelect(factory)}
            onFavoriteToggle={() => onFavoriteToggle?.(factory)}
          />
        ))}

        {!loading && !error && factories.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 3,
              textAlign: 'center',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              ไม่พบข้อมูลโรงงานตามเงื่อนไข
            </Typography>
          </Paper>
        ) : null}
      </Stack>
    </Box>
  )
}

function FactoryCard({
  factory,
  canUseFavorite = false,
  canViewDetails = false,
  favoriteUpdating = false,
  onSelect,
  onFavoriteToggle,
}) {
  const [activeSystem, setActiveSystem] = useState(null)
  const activeMeasurementTable = activeSystem ? getMeasurementTable(factory, activeSystem) : null

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        p: { xs: 1.25, sm: 1.5 },
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        textAlign: 'left',
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
        <Box
          sx={{
            width: { xs: 64, sm: 72 },
            height: { xs: 64, sm: 72 },
            flex: '0 0 auto',
            display: 'grid',
            placeItems: 'center',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1.25,
            bgcolor: factory.logoBg,
            color: 'primary.900',
            fontWeight: 600,
            fontSize: 20,
            overflow: 'hidden',
          }}
        >
          {factory.logoUrl ? (
            <Box
              component="img"
              src={factory.logoUrl}
              alt={factory.name || 'factory logo'}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            factory.logoText
          )}
        </Box>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: 'primary.900',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {factory.name}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {[factory.factoryId, factory.oldRegistrationNo ? `(${factory.oldRegistrationNo})` : ''].filter(Boolean).join(' ')}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {factory.address}
          </Typography>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mt: 0.5 }}>
            {factory.systems.map((system) => (
              <Chip
                key={system}
                size="small"
                label={system}
                clickable
                aria-expanded={activeSystem === system}
                onClick={() => setActiveSystem((current) => (current === system ? null : system))}
                sx={{
                  height: 22,
                  bgcolor: activeSystem === system ? 'primary.700' : 'secondary.600',
                  color: activeSystem === system ? 'primary.contrastText' : 'secondary.contrastText',
                  fontWeight: 600,
                  '& .MuiChip-label': { px: 1 },
                  '&:hover': {
                    bgcolor: activeSystem === system ? 'primary.800' : 'secondary.700',
                  },
                }}
              />
            ))}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ flex: 1, textAlign: 'right', minWidth: 54 }}
            >
              {factory.distance === null ? '-' : `${factory.distance.toFixed(1)} กม.`}
            </Typography>
          </Stack>
        </Box>

        <Stack spacing={0.75} sx={{ flex: '0 0 auto', alignItems: 'center' }}>
          {canUseFavorite ? (
            <Tooltip title={factory.isFavorite ? 'ยกเลิกติดตาม' : 'ติดตาม'}>
              <IconButton
                size="small"
                aria-label={factory.isFavorite ? 'ยกเลิกติดตาม' : 'ติดตาม'}
                disabled={favoriteUpdating}
                onClick={onFavoriteToggle}
                sx={{
                  width: 38,
                  height: 38,
                  border: 1,
                  borderColor: factory.isFavorite ? '#facc15' : 'divider',
                  bgcolor: factory.isFavorite ? '#fef9c3' : 'transparent',
                  color: factory.isFavorite ? '#eab308' : 'inherit',
                  '&:hover': {
                    bgcolor: factory.isFavorite ? '#fef08a' : 'action.hover',
                  },
                }}
              >
                {factory.isFavorite ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          ) : null}
          {canViewDetails ? (
            <Tooltip title="ดูรายละเอียด">
              <IconButton
                size="small"
                aria-label={`ดูรายละเอียด ${factory.name}`}
                onClick={onSelect}
                sx={{ width: 38, height: 38, color: 'neutral.400' }}
              >
                <ChevronRightIcon />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
      </Stack>

      {activeMeasurementTable ? (
        <MeasurementTable table={activeMeasurementTable} sx={{ mt: 1.25 }} />
      ) : null}
    </Paper>
  )
}

function getMeasurementTable(factory, systemType) {
  const measurementPoints = factory.measurementPoints.filter((point) => point?.systemType === systemType)
  const parameters = Array.from(
    new Set(
      measurementPoints.flatMap((point) => {
        if (Array.isArray(point?.parameters) && point.parameters.length > 0) {
          return point.parameters
        }

        const dataRows = Array.isArray(point?.data) ? point.data : []
        return dataRows.flatMap((row) =>
          Object.keys(row).filter((key) => !['station_id', 'cdate', 'ctime'].includes(key)),
        )
      }),
    ),
  )
  const rows = measurementPoints.flatMap((point) => {
    const dataRows = Array.isArray(point?.data) ? point.data : []
    return dataRows.map((row) => [
      row.station_id ?? point.pointCode ?? point.stationId ?? '',
      row.cdate ?? '',
      row.ctime ?? '',
      ...parameters.map((parameter) => formatMeasurementValue(row[parameter])),
    ])
  })

  return {
    columns: ['จุดตรวจวัด', 'วันที่', 'เวลา', ...parameters],
    rows,
  }
}

function formatMeasurementValue(value) {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  if (typeof value === 'number') {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const numericValue = Number(value)
  if (Number.isFinite(numericValue) && String(value).trim() !== '') {
    return numericValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return String(value)
}

function MeasurementTable({ table, sx }) {
  const valueStartIndex = 3

  return (
    <TableContainer
      sx={{
        border: 1,
        borderColor: 'divider',
        overflowX: 'auto',
        ...sx,
      }}
    >
      <Table size="small" sx={{ minWidth: 620, ...borderedTableSx }}>
        <TableHead>
          <TableRow>
            {table.columns.map((column) => (
              <TableCell
                key={column}
                sx={{
                  fontWeight: 700,
                  bgcolor: 'neutral.50',
                  whiteSpace: 'nowrap',
                }}
              >
                {column}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {table.rows.length > 0 ? (
            table.rows.map((row, rowIndex) => (
              <TableRow key={`${row.join('|')}-${rowIndex}`}>
                {row.map((value, index) => (
                  <TableCell
                    key={`${value}-${index}`}
                    sx={{
                      fontWeight: 300,
                      color: index < valueStartIndex ? 'text.primary' : '#46b529',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {value}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={table.columns.length} align="center" sx={{ fontWeight: 300 }}>
                <Typography variant="body2" color="text.secondary">
                  ไม่มีข้อมูลค่าการตรวจวัด
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    const replacements = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return replacements[character]
  })
}

function encodeSvgDataUrl(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function getFactoryMapMarkerIcon(factory) {
  if (factory.logoUrl) {
    return getAbsoluteAssetUrl(factory.logoUrl)
  }

  const label = escapeHtml(factory.logoText || getFactoryLogoText(factory.name, factory.factoryId))
  const fill = escapeHtml(factory.logoBg || '#dbeafe')

  return encodeSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.25" />
      </filter>
      <circle cx="24" cy="24" r="22" fill="#ffffff" filter="url(#shadow)" />
      <circle cx="24" cy="24" r="19" fill="${fill}" />
      <text x="24" y="28" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="800" fill="#0f172a">${label}</text>
    </svg>
  `)
}

function FactoryMap({ factories }) {
  const placeholderRef = useRef(null)
  const mapRef = useRef(null)
  const [mapError, setMapError] = useState('')

  useEffect(() => {
    let cancelled = false

    loadLongdoMapScript()
      .then((longdo) => {
        if (cancelled || !placeholderRef.current || mapRef.current) {
          return
        }

        mapRef.current = new longdo.Map({
          placeholder: placeholderRef.current,
          language: 'th',
          location: referencePoint,
          zoom: 10,
          ui: longdo.UiComponent.Mobile,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setMapError('กรุณาตั้งค่า VITE_LONGDO_MAP_KEY เพื่อแสดง Longdo Map')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const longdo = window.longdo
    const map = mapRef.current

    if (!longdo || !map) {
      return
    }

    map.Overlays.clear()
    const factoriesWithCoordinates = factories.filter(hasFactoryCoordinate)

    factoriesWithCoordinates.forEach((factory) => {
      map.Overlays.add(
        new longdo.Marker(
          { lon: factory.lon, lat: factory.lat },
          {
            title: factory.name,
            detail: `${factory.newRegistrationNo} (${factory.oldRegistrationNo})<br>${factory.address}`,
            icon: {
              url: getFactoryMapMarkerIcon(factory),
              offset: { x: 24, y: 24 },
              size: { width: 48, height: 48 },
            },
            weight: longdo.OverlayWeight.Top,
          },
        ),
      )
    })

    if (factoriesWithCoordinates.length > 0) {
      const center = getMapCenter(factoriesWithCoordinates)
      map.location(center, true)
      map.zoom(factoriesWithCoordinates.length === 1 ? 13 : 10, true)
    }
  }, [factories])

  return (
    <Box
      sx={{
        minHeight: 0,
        order: { md: 2 },
        position: { xs: 'absolute', md: 'relative' },
        inset: { xs: 0, md: 'auto' },
        overflow: 'hidden',
        bgcolor: '#eaf6fb',
      }}
    >
      <Box ref={placeholderRef} sx={{ width: '100%', height: '100%' }} />
      {mapError ? (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            p: 3,
            background:
              'linear-gradient(135deg, rgba(239, 246, 255, 0.92), rgba(236, 253, 243, 0.92))',
          }}
        >
          <Paper
            elevation={0}
            sx={{ maxWidth: 360, p: 2.5, border: 1, borderColor: 'divider', textAlign: 'center' }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Longdo Map
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {mapError}
            </Typography>
          </Paper>
        </Box>
      ) : null}
    </Box>
  )
}

function FactoryBottomSheet({ factory, accessToken = '', open, onClose }) {
  const [selectedDate, setSelectedDate] = useState(() => dayjs())
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState(() => dayjs())
  const [selectedStatisticSystem, setSelectedStatisticSystem] = useState('')
  const [selectedStatisticPoint, setSelectedStatisticPoint] = useState('')
  const [selectedTrendParameter, setSelectedTrendParameter] = useState(statisticParameters[0])
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [datePickerStatusByDay, setDatePickerStatusByDay] = useState({})
  const [calendarSummary, setCalendarSummary] = useState([])
  const [calendarError, setCalendarError] = useState('')
  const [measurementStatisticParameters, setMeasurementStatisticParameters] = useState(statisticParameters)
  const [measurementStatisticRows, setMeasurementStatisticRows] = useState([])
  const [measurementStatisticError, setMeasurementStatisticError] = useState('')
  const statisticSystemOptions = useMemo(() => getStatisticSystemOptions(factory), [factory])
  const activeStatisticSystem = statisticSystemOptions.includes(selectedStatisticSystem)
    ? selectedStatisticSystem
    : statisticSystemOptions[0] ?? ''
  const statisticPoints = useMemo(
    () => getStatisticPointsBySystem(factory, activeStatisticSystem),
    [activeStatisticSystem, factory],
  )
  const activeStatisticPoint = statisticPoints.some((point) => point.value === selectedStatisticPoint)
    ? selectedStatisticPoint
    : statisticPoints[0]?.value
  const activeStatisticPointLabel =
    statisticPoints.find((point) => point.value === activeStatisticPoint)?.label ?? activeStatisticPoint ?? '-'
  const statisticRows = measurementStatisticRows
  const activeCalendarSummaryRows = calendarSummary.length > 0 ? calendarSummary : []
  const activeStatisticParameters =
    measurementStatisticParameters.length > 0 ? measurementStatisticParameters : statisticParameters
  const activeTrendParameter = activeStatisticParameters.includes(selectedTrendParameter)
    ? selectedTrendParameter
    : activeStatisticParameters[0] ?? statisticParameters[0]
  const exportDialogKey = [
    factory?.id,
    activeStatisticSystem,
    statisticPoints.map((point) => point.value).join(','),
    activeStatisticParameters.join(','),
    selectedDate?.format?.('YYYY-MM-DD'),
  ].join('|')

  useEffect(() => {
    if (!open || !accessToken || !activeStatisticPoint) {
      return
    }

    let isActive = true
    const month = selectedCalendarMonth.format('YYYY-MM')

    fetch(getConnectedMeasurementPointApiUrl(activeStatisticPoint, 'calendar-status', { month }), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(async (result) => {
        const payload = await result.json().catch(() => null)

        if (!result.ok) {
          throw new Error(getApiErrorMessage(payload, `โหลดข้อมูล calendar ไม่สำเร็จ (${result.status} ${result.statusText})`))
        }

        if (isActive) {
          setDatePickerStatusByDay(mapDatePickerStatusByDay(payload?.data?.calendar?.days))
          setCalendarSummary(mapCalendarSummaryRows(payload?.data?.monthlySummary))
          setCalendarError('')
        }
      })
      .catch((error) => {
        if (isActive) {
          setDatePickerStatusByDay({})
          setCalendarSummary([])
          setCalendarError(error instanceof Error ? error.message : 'โหลดข้อมูล calendar ไม่สำเร็จ')
        }
      })

    return () => {
      isActive = false
    }
  }, [accessToken, activeStatisticPoint, open, selectedCalendarMonth])

  useEffect(() => {
    if (!open || !accessToken || !activeStatisticPoint) {
      return
    }

    let isActive = true
    const date = selectedDate.format('YYYY-MM-DD')

    fetch(getConnectedMeasurementPointApiUrl(activeStatisticPoint, 'measurement-statistics', { date }), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(async (result) => {
        const payload = await result.json().catch(() => null)

        if (!result.ok) {
          throw new Error(getApiErrorMessage(payload, `โหลดสถิติข้อมูลไม่สำเร็จ (${result.status} ${result.statusText})`))
        }

        if (isActive) {
          const mapped = mapMeasurementStatistics(payload, activeStatisticPoint)
          setMeasurementStatisticParameters(mapped.parameters)
          setMeasurementStatisticRows(mapped.rows)
          setMeasurementStatisticError('')
        }
      })
      .catch((error) => {
        if (isActive) {
          setMeasurementStatisticParameters(statisticParameters)
          setMeasurementStatisticRows([])
          setMeasurementStatisticError(error instanceof Error ? error.message : 'โหลดสถิติข้อมูลไม่สำเร็จ')
        }
      })

    return () => {
      isActive = false
    }
  }, [accessToken, activeStatisticPoint, open, selectedDate])

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        '& .MuiDrawer-paper': {
          height: { xs: 'calc(100dvh - 64px)', md: 'calc(100dvh - 72px)' },
          maxHeight: { xs: 'calc(100dvh - 64px)', md: 'calc(100dvh - 72px)' },
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          overflow: 'hidden',
        },
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 4,
          borderRadius: 999,
          bgcolor: 'neutral.300',
          mx: 'auto',
          mt: 1.5,
          mb: 1,
          flex: '0 0 auto',
        }}
      />

      {factory ? (
        <Box sx={{ overflow: 'auto', px: { xs: 2, md: 3 }, pb: { xs: 2, md: 3 } }}>
          <Stack
            direction="row"
            spacing={2}
            sx={{
              alignItems: 'flex-start',
              borderBottom: 1,
              borderColor: 'divider',
              pb: 2,
            }}
          >
            <Box
              aria-label="รูปภาพโรงงาน"
              sx={{
                width: { xs: 64, sm: 80, md: 96 },
                height: { xs: 64, sm: 80, md: 96 },
                flex: '0 0 auto',
                display: 'grid',
                placeItems: 'center',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1.5,
                bgcolor: factory.logoBg,
                color: 'primary.900',
                fontSize: { xs: 20, md: 28 },
                fontWeight: 600,
              }}
            >
              {factory.logoText}
            </Box>

            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      color: 'primary.900',
                      fontWeight: 600,
                      lineHeight: 1.35,
                      wordBreak: 'break-word',
                    }}
                  >
                    {factory.name}
                  </Typography>
                </Box>

                <Tooltip title="ปิด">
                  <IconButton aria-label="ปิด" onClick={onClose} sx={{ flex: '0 0 auto' }}>
                    <CloseIcon />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Stack spacing={0.5} sx={{ mt: 0.75 }}>
                <FactoryMeta label="เลขทะเบียนโรงงาน" value={factory.factoryId || '-'} hideLabel valueSx={{ fontWeight: 400 }} />
                <FactoryMeta label="ที่อยู่" value={factory.address} hideLabel valueSx={{ fontWeight: 400 }} />
              </Stack>
            </Box>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
              gap: { xs: 2, md: 3 },
              borderBottom: 1,
              borderColor: 'divider',
              pt: { xs: 2, md: 3 },
              pb: { xs: 2, md: 3 },
            }}
          >
            <FactoryStatisticPanel
              selectedDate={selectedDate}
              onDateChange={(nextDate) => {
                setSelectedDate(nextDate)
                setSelectedCalendarMonth(nextDate)
              }}
              statusByDay={datePickerStatusByDay}
              onMonthChange={setSelectedCalendarMonth}
              systemOptions={statisticSystemOptions}
              selectedSystem={activeStatisticSystem}
              onSystemChange={(nextSystem) => {
                setSelectedStatisticSystem(nextSystem)
                setSelectedStatisticPoint('')
              }}
              points={statisticPoints}
              selectedPoint={activeStatisticPoint}
              onPointChange={setSelectedStatisticPoint}
              rows={statisticRows}
              parameters={activeStatisticParameters}
              error={measurementStatisticError}
              onExport={() => setExportDialogOpen(true)}
            />
            <Stack spacing={2} sx={{ minWidth: 0 }}>
              <PollutionTrendPanel
                rows={statisticRows}
                parameters={activeStatisticParameters}
                selectedDate={selectedDate}
                selectedPointLabel={activeStatisticPointLabel}
                selectedParameter={activeTrendParameter}
                onParameterChange={setSelectedTrendParameter}
              />
              <CalendarSummaryPanel rows={activeCalendarSummaryRows} error={calendarError} />
            </Stack>
          </Box>
          <ExportReportDialog
            key={exportDialogKey}
            open={exportDialogOpen}
            factory={factory}
            systemOptions={statisticSystemOptions}
            selectedSystem={activeStatisticSystem}
            points={statisticPoints}
            parameters={activeStatisticParameters}
            selectedDate={selectedDate}
            onClose={() => setExportDialogOpen(false)}
          />
        </Box>
      ) : null}
    </Drawer>
  )
}

function getStatisticSystemOptions(factory) {
  const points = Array.isArray(factory?.measurementPoints) ? factory.measurementPoints : []
  const pointSystems = points.map((point) => point?.systemType).filter(Boolean)
  const factorySystems = Array.isArray(factory?.systems) ? factory.systems.filter(Boolean) : []

  return Array.from(new Set([...pointSystems, ...factorySystems]))
}

function getStatisticPointsBySystem(factory, selectedSystem = '') {
  const points = Array.isArray(factory?.measurementPoints) ? factory.measurementPoints : []
  const filteredPoints = selectedSystem ? points.filter((point) => point?.systemType === selectedSystem) : points
  const mappedPoints = filteredPoints.map((point, index) => {
    const label = point.pointCode ?? point.stationId ?? point.pointName ?? `จุดที่ ${index + 1}`
    return {
      value: point.stationId ?? point.pointCode ?? label,
      label,
    }
  })

  if (points.length > 0) {
    return mappedPoints
  }

  return mappedPoints.length > 0
    ? mappedPoints
    : [
        { value: 'WP-01', label: 'WP-01' },
        { value: 'WP-02', label: 'WP-02' },
      ]
}

function CalendarSummaryPanel({ rows, error = '' }) {
  return (
    <Box
      sx={{
        minWidth: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        overflow: 'hidden',
        p: 1.5,
      }}
    >
      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>
        สรุปผลการตรวจวัด
      </Typography>
      <TableContainer
        sx={{
          minWidth: 0,
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Table
          size="small"
          sx={{
            width: '100%',
            tableLayout: 'fixed',
            '& .MuiTableCell-root': {
              fontSize: '11px !important',
              lineHeight: 1.35,
              px: 0.75,
              py: 0.75,
              wordBreak: 'break-word',
            },
            '& .MuiTableCell-root:last-of-type': {
              borderRight: 0,
            },
            '& .MuiTableBody-root .MuiTableRow-root:last-of-type .MuiTableCell-root': {
              borderBottom: 0,
            },
            ...borderedTableSx,
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '27%', bgcolor: '#f3f4f6', color: '#475569', fontWeight: 700 }}>
                พารามิเตอร์
              </TableCell>
              <TableCell align="center" sx={{ width: '20%', bgcolor: '#ef4444', color: '#fff', fontWeight: 700 }}>
                เกินมาตรฐาน
                <br />
                (วัน)
              </TableCell>
              <TableCell align="center" sx={{ width: '29%', bgcolor: '#f97316', color: '#fff', fontWeight: 700 }}>
                ข้อมูลไม่ถึง
                <br />
                ร้อยละ 80 ต่อวัน (วัน)
              </TableCell>
              <TableCell align="center" sx={{ width: '24%', bgcolor: '#2f9d4a', color: '#fff', fontWeight: 700 }}>
                การส่งข้อมูล
                <br />
                วันนี้ (%)
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.parameter}>
                <TableCell sx={{ fontWeight: 700 }}>{row.parameter}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 400 }}>
                  {row.exceededDays}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 400 }}>
                  {row.lowDataDays}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  {row.todayPercent}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ fontWeight: 400, color: 'text.secondary' }}>
                  {error || 'ไม่มีข้อมูลสรุปรายเดือน'}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

function PollutionTrendPanel({ rows, parameters, selectedDate, selectedPointLabel, selectedParameter, onParameterChange }) {
  const selectedDateLabel = selectedDate?.format?.('D MMMM BBBB') ?? ''
  const chartData = useMemo(
    () =>
      rows.map((row, index) => ({
        hour: Number(row.chartTime?.slice(0, 2)) || index,
        time: row.chartTime || row.time.slice(0, 5).replace('.', ':'),
        value: row.chartValues?.[selectedParameter] ?? toFiniteNumber(row.values[selectedParameter]),
        color: statisticStatusColors[row.statuses?.[selectedParameter]] ?? statisticStatusColors.unavailable,
      })),
    [rows, selectedParameter],
  )
  const ColoredChartMark = useMemo(
    () =>
      function ColoredChartMark({ dataIndex, hidden, x, y }) {
        const color = chartData[dataIndex]?.color ?? statisticStatusColors.unavailable

        if (hidden || !Number.isFinite(x) || !Number.isFinite(y)) {
          return null
        }

        return <circle cx={x} cy={y} r={4} fill={color} stroke={color} strokeWidth={2} />
      },
    [chartData],
  )

  return (
    <Box
      sx={{
        minWidth: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Typography variant="subtitle1" sx={{ px: 1.25, py: 0.75, fontWeight: 700 }}>
        ค่าแนวโน้มสถานการณ์มลพิษ{' '}
        <Box component="span" sx={{ color: 'primary.main' }}>
          {selectedParameter} {selectedDateLabel} ({selectedPointLabel})
        </Box>
      </Typography>

      <Tabs
        value={selectedParameter}
        onChange={(_, nextValue) => onParameterChange(nextValue)}
        variant="scrollable"
        scrollButtons="auto"
	        sx={{
	          minHeight: 34,
	          borderBottom: 1,
	          borderColor: 'divider',
	          '& .MuiTab-root': {
	            minHeight: 34,
	            px: 1.25,
	            fontWeight: 700,
	          },
	        }}
      >
        {parameters.map((parameter) => (
          <Tab key={parameter} value={parameter} label={parameter} />
        ))}
      </Tabs>

      <Box sx={{ height: 320, px: 0.25, pt: 0.5, pb: 0 }}>
        <LineChart
          dataset={chartData}
          xAxis={[
            {
              dataKey: 'hour',
              scaleType: 'linear',
              min: 0,
              max: Math.max(23, chartData.length - 1),
              height: 56,
              tickInterval: chartData.map((item) => item.hour),
              tickLabelInterval: () => true,
              tickLabelMinGap: 0,
              valueFormatter: (value) => `${String(value).padStart(2, '0')}:00`,
              tickLabelStyle: {
                angle: -35,
                textAnchor: 'end',
                fontSize: 11,
              },
            },
          ]}
          yAxis={[
            {
              min: 0,
              label: `ระดับค่ามลพิษ ${selectedParameter}`,
            },
          ]}
          series={[
            {
              dataKey: 'value',
              color: statisticStatusColors.normal,
              showMark: true,
              curve: 'linear',
            },
          ]}
          slots={{ mark: ColoredChartMark }}
          grid={{ horizontal: true, vertical: true }}
          margin={{ top: 20, right: 10, bottom: 10, left: 10 }}
          height={320}
          sx={{ width: '100%' }}
        />
      </Box>
    <Stack
      direction="row"
      spacing={1.5}
      useFlexGap
      sx={{ px: 1.25, pb: 1.25, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}
    >
      {pollutionTrendLegendItems.map((item) => (
        <Stack key={item.label} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: 999,
              bgcolor: item.color,
              flex: '0 0 auto',
            }}
          />
          <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600 }}>
            {item.label}
          </Typography>
        </Stack>
      ))}
    </Stack>
    </Box>
  )
}

function DatePickerStatusDay({ day, outsideCurrentMonth, statusByDay = {}, sx, ...other }) {
  const status = outsideCurrentMonth ? null : statusByDay[day.format('YYYY-MM-DD')]
  const backgroundColor = status?.backgroundStatus
    ? datePickerStatusStyles[status.backgroundStatus]?.backgroundColor
    : undefined
  const borderColor = status?.borderStatus ? datePickerStatusStyles[status.borderStatus]?.borderColor : undefined

  return (
    <PickerDay
      day={day}
      outsideCurrentMonth={outsideCurrentMonth}
      sx={{
        position: 'relative',
        bgcolor: backgroundColor,
        '&:hover': {
          bgcolor: backgroundColor ?? 'action.hover',
        },
        '&.Mui-selected': {
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
        },
        '&.Mui-selected:hover': {
          bgcolor: 'primary.dark',
        },
        ...(borderColor
          ? {
              '&::after': {
                content: '""',
                position: 'absolute',
                left: 8,
                right: 8,
                bottom: 5,
                height: 3,
                borderRadius: 999,
                bgcolor: borderColor,
              },
            }
          : null),
        ...sx,
      }}
      {...other}
    />
  )
}

function FactoryStatisticPanel({
  selectedDate,
  onDateChange,
  statusByDay,
  onMonthChange,
  systemOptions,
  selectedSystem,
  onSystemChange,
  points,
  selectedPoint,
  onPointChange,
  rows,
  parameters,
  error,
  onExport,
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.25}
        sx={{ px: 1.5, py: 1.25, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          สถิติข้อมูล
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          sx={{ justifyContent: { xs: 'flex-start', sm: 'flex-end' }, flexWrap: 'wrap', rowGap: 1 }}
        >
          <Button
            size="small"
            variant="contained"
            startIcon={<FileDownloadIcon fontSize="small" />}
            onClick={onExport}
            sx={{ minWidth: 92, fontWeight: 700 }}
          >
            Export
          </Button>
          <FormControl size="small" sx={{ width: 150 }}>
            <Select value={selectedSystem ?? ''} onChange={(event) => onSystemChange(event.target.value)} displayEmpty>
              {systemOptions.length === 0 ? <MenuItem value="">--เลือก--</MenuItem> : null}
              {systemOptions.map((system) => (
                <MenuItem key={system} value={system}>
                  {system}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <LocalizationProvider dateAdapter={AdapterDayjsBuddhist} adapterLocale="th">
            <DatePicker
              value={selectedDate}
              format="DD-MM-YYYY"
              onChange={(nextDate) => {
                if (nextDate) {
                  onDateChange(nextDate)
                }
              }}
              onMonthChange={onMonthChange}
              slotProps={{
                day: {
                  statusByDay,
                },
                textField: {
                  size: 'small',
                  sx: { width: 154 },
                },
              }}
              slots={{ day: DatePickerStatusDay }}
            />
          </LocalizationProvider>
        </Stack>
      </Stack>
      <Tabs
        value={selectedPoint ?? false}
        onChange={(_, nextValue) => onPointChange(nextValue)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 40,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': {
            minHeight: 40,
            px: 2,
            fontWeight: 700,
          },
        }}
      >
        {points.map((point) => (
          <Tab key={point.value} value={point.value} label={point.label} />
        ))}
      </Tabs>

      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 760, ...borderedTableSx }}>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  width: 140,
                  minWidth: 140,
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  fontWeight: 700,
                  bgcolor: 'neutral.50',
                }}
              >
                เวลา
              </TableCell>
              {parameters.map((parameter) => (
                <TableCell key={parameter} sx={{ minWidth: 104, fontWeight: 700, bgcolor: 'neutral.50' }}>
                  {parameter}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length > 0 ? rows.map((row) => (
              <TableRow key={`${row.date}-${row.time}`}>
                <TableCell
                  sx={{
                    minWidth: 140,
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    bgcolor: 'background.paper',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.time}
                </TableCell>
                {parameters.map((parameter) => (
                  <TableCell
                    key={parameter}
                    sx={{
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      color: statisticStatusColors[row.statuses[parameter]] ?? statisticStatusColors.unavailable,
                    }}
                  >
                    {formatMeasurementValue(row.values[parameter])}
                  </TableCell>
                ))}
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={parameters.length + 1} align="center" sx={{ fontWeight: 400 }}>
                  <Typography variant="body2" color="text.secondary">
                    {error || 'ไม่มีข้อมูลสถิติ'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

function ExportReportDialog({
  open,
  factory,
  systemOptions,
  selectedSystem,
  points,
  parameters,
  selectedDate,
  onClose,
}) {
  const defaultPoint = points[0]?.value ?? ''
  const [reportType, setReportType] = useState(() => selectedSystem)
  const [measurementPoint, setMeasurementPoint] = useState(defaultPoint)
  const [parameter, setParameter] = useState('all')
  const [frequency, setFrequency] = useState('')
  const [startDate, setStartDate] = useState(selectedDate)
  const [endDate, setEndDate] = useState(selectedDate)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle
        sx={{
          color: '#16a34a',
          fontWeight: 700,
          borderBottom: 1,
          borderColor: 'divider',
          pr: 6,
        }}
      >
        ส่งออกรายงาน
        <IconButton
          aria-label="ปิด"
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12, color: 'text.secondary' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: '24px !important' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
          }}
        >
          <TextField
            size="small"
            label="ชื่อโรงงาน"
            value={factory?.name ?? ''}
            InputProps={{ readOnly: true }}
            fullWidth
          />

          <TextField
            size="small"
            label="เลขทะเบียนโรงงาน"
            value={factory?.factoryId ?? ''}
            InputProps={{ readOnly: true }}
            fullWidth
          />

          <FormControl size="small" fullWidth>
            <InputLabel id="export-report-type-label">ประเภท</InputLabel>
            <Select
              labelId="export-report-type-label"
              value={reportType}
              label="ประเภท"
              onChange={(event) => setReportType(event.target.value)}
              displayEmpty
            >
              <MenuItem value="">--เลือก--</MenuItem>
              {systemOptions.map((system) => (
                <MenuItem key={system} value={system}>
                  {system}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel id="export-measurement-point-label">จุดตรวจวัด</InputLabel>
            <Select
              labelId="export-measurement-point-label"
              value={measurementPoint}
              label="จุดตรวจวัด"
              onChange={(event) => setMeasurementPoint(event.target.value)}
              displayEmpty
            >
              <MenuItem value="">--เลือก--</MenuItem>
              {points.map((point) => (
                <MenuItem key={point.value} value={point.value}>
                  {point.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel id="export-parameter-label">พารามิเตอร์</InputLabel>
            <Select
              labelId="export-parameter-label"
              value={parameter}
              label="พารามิเตอร์"
              onChange={(event) => setParameter(event.target.value)}
              displayEmpty
            >
              <MenuItem value="all">ทั้งหมด</MenuItem>
              {parameters.map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel id="export-frequency-label" shrink>
              ความถี่
            </InputLabel>
            <Select
              labelId="export-frequency-label"
              value={frequency}
              label="ความถี่"
              notched
              onChange={(event) => setFrequency(event.target.value)}
              displayEmpty
            >
              <MenuItem value="">--เลือก--</MenuItem>
              <MenuItem value="hourly">รายชั่วโมง</MenuItem>
              <MenuItem value="daily">รายวัน</MenuItem>
              <MenuItem value="monthly">รายเดือน</MenuItem>
              <MenuItem value="yearly">รายปี</MenuItem>
            </Select>
          </FormControl>

          <LocalizationProvider dateAdapter={AdapterDayjsBuddhist} adapterLocale="th">
            <DatePicker
              value={startDate}
              label="วันที่เริ่ม"
              format="DD-MM-YYYY"
              onChange={(nextDate) => {
                if (nextDate) {
                  setStartDate(nextDate)
                }
              }}
              slotProps={{ textField: { size: 'small', fullWidth: true, placeholder: '--เลือก--' } }}
            />
          </LocalizationProvider>
          <LocalizationProvider dateAdapter={AdapterDayjsBuddhist} adapterLocale="th">
            <DatePicker
              value={endDate}
              label="วันที่สิ้นสุด"
              format="DD-MM-YYYY"
              onChange={(nextDate) => {
                if (nextDate) {
                  setEndDate(nextDate)
                }
              }}
              slotProps={{ textField: { size: 'small', fullWidth: true, placeholder: '--เลือก--' } }}
            />
          </LocalizationProvider>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          ปิด
        </Button>
        <Button variant="contained" onClick={onClose} sx={{ fontWeight: 700 }}>
          ส่งออก CSV
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function FactoryMeta({ label, value, sx, valueSx, hideLabel = false }) {
  return (
    <Box sx={{ minWidth: 0, ...sx }}>
      {hideLabel ? null : (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {label}
        </Typography>
      )}
      <Typography
        variant="body2"
        sx={{
          color: 'text.primary',
          fontWeight: 600,
          lineHeight: 1.5,
          overflowWrap: 'anywhere',
          ...valueSx,
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

function AdvancedSearchDialog({
  open,
  factoryOrderFilter,
  industrialEstateFilter,
  industrialEstateNameFilter,
  regionFilter,
  provinceFilter,
  districtFilter,
  provinceOptions,
  districtOptions,
  latestInspectionResultFilter,
  monitoringFilter,
  onFactoryOrderFilterChange,
  onIndustrialEstateFilterChange,
  onIndustrialEstateNameFilterChange,
  onRegionFilterChange,
  onProvinceFilterChange,
  onDistrictFilterChange,
  onLatestInspectionResultFilterChange,
  onMonitoringFilterChange,
  onClose,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      slotProps={{
        paper: {
          sx: {
            width: 'min(692px, calc(100vw - 24px))',
            maxWidth: 'min(692px, calc(100vw - 24px))',
            borderRadius: 1.25,
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          pr: 6,
          py: 1.25,
          px: 1.5,
          color: 'primary.main',
          fontSize: 15,
          fontWeight: 800,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        ค้นหาขั้นสูง
        <IconButton
          aria-label="ปิด"
          onClick={onClose}
          sx={{ position: 'absolute', right: 10, top: 6, color: 'primary.900' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 2.5, pt: '24px !important', pb: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
            gap: 2,
          }}
        >
          <TextField
            size="small"
            label="ลำดับประเภทโรงงาน"
            value={factoryOrderFilter}
            placeholder="พิมพ์เพื่อค้นหา"
            onChange={(event) => onFactoryOrderFilterChange(event.target.value)}
            fullWidth
            sx={{ gridColumn: '1 / -1' }}
          />

          <FormControl size="small" fullWidth>
            <InputLabel id="advanced-industrial-estate-filter-label">พื้นที่ประกอบกิจการ</InputLabel>
            <Select
              labelId="advanced-industrial-estate-filter-label"
              value={industrialEstateFilter}
              label="พื้นที่ประกอบกิจการ"
              onChange={(event) => onIndustrialEstateFilterChange(event.target.value)}
            >
              <MenuItem value="all">ทั้งหมด</MenuItem>
              <MenuItem value="industrial-estate">ในนิคมอุตสาหกรรม</MenuItem>
              <MenuItem value="outside-industrial-estate">นอกนิคมอุตสาหกรรม</MenuItem>
            </Select>
          </FormControl>

          {industrialEstateFilter === 'industrial-estate' ? (
            <TextField
              size="small"
              label="นิคมอุตสาหกรรม"
              value={industrialEstateNameFilter}
              placeholder="พิมพ์เพื่อค้นหา"
              onChange={(event) => onIndustrialEstateNameFilterChange(event.target.value)}
              fullWidth
              sx={{ gridColumn: { xs: '1 / -1', sm: 'span 2' } }}
            />
          ) : null}

          <FormControl size="small" fullWidth sx={{ gridColumn: { xs: '1 / -1', sm: '1' } }}>
            <InputLabel id="advanced-region-label">ภาค</InputLabel>
            <Select
              labelId="advanced-region-label"
              value={regionFilter}
              label="ภาค"
              onChange={(event) => onRegionFilterChange(event.target.value)}
            >
              {regionOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel id="advanced-province-label">จังหวัด</InputLabel>
            <Select
              labelId="advanced-province-label"
              value={provinceFilter}
              label="จังหวัด"
              onChange={(event) => onProvinceFilterChange(event.target.value)}
            >
              {provinceOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel id="advanced-district-label">เขต/อำเภอ</InputLabel>
            <Select
              labelId="advanced-district-label"
              value={districtFilter}
              label="เขต/อำเภอ"
              onChange={(event) => onDistrictFilterChange(event.target.value)}
            >
              {districtOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth sx={{ gridColumn: { xs: '1 / -1', sm: '1' } }}>
            <InputLabel id="advanced-latest-result-label">มีผลการตรวจวัดชั่วโมงล่าสุด</InputLabel>
            <Select
              labelId="advanced-latest-result-label"
              value={latestInspectionResultFilter}
              label="มีผลการตรวจวัดชั่วโมงล่าสุด"
              onChange={(event) => onLatestInspectionResultFilterChange(event.target.value)}
            >
              <MenuItem value="all">ทั้งหมด</MenuItem>
              <MenuItem value="has-result">มีผลการตรวจวัด</MenuItem>
              <MenuItem value="no-result">ไม่มีผลการตรวจวัด</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel id="advanced-monitoring-label">การเฝ้าระวัง</InputLabel>
            <Select
              labelId="advanced-monitoring-label"
              value={monitoringFilter}
              label="การเฝ้าระวัง"
              onChange={(event) => onMonitoringFilterChange(event.target.value)}
            >
              <MenuItem value="all">ทั้งหมด</MenuItem>
              <MenuItem value="normal">ปกติ</MenuItem>
              <MenuItem value="watch">เฝ้าระวัง</MenuItem>
              <MenuItem value="exceeded">เกินมาตรฐาน</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.75, pt: 1, gap: 0.75 }}>
        <Button variant="outlined" color="inherit" size="small" onClick={onClose} sx={{ minWidth: 40, height: 34 }}>
          ปิด
        </Button>
        <Button variant="contained" size="small" onClick={onClose} sx={{ minWidth: 58, height: 34, fontWeight: 700 }}>
          ค้นหา
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function getMapCenter(factoryList) {
  const sum = factoryList.reduce(
    (current, factory) => ({
      lon: current.lon + factory.lon,
      lat: current.lat + factory.lat,
    }),
    { lon: 0, lat: 0 },
  )

  return {
    lon: sum.lon / factoryList.length,
    lat: sum.lat / factoryList.length,
  }
}

export default HomePage
