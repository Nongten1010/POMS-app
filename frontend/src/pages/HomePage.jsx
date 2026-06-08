import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  ButtonBase,
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
import SearchIcon from '@mui/icons-material/Search'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjsBuddhist } from '@mui/x-date-pickers/AdapterDayjsBuddhist'
import { LineChart } from '@mui/x-charts/LineChart'
import dayjs from 'dayjs'
import 'dayjs/locale/th'

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
  : 'http://d-poms.diw.go.th/api/v1/operator-factory-dashboard'
const logoBackgrounds = ['#dbeafe', '#fef3c7', '#fee2e2', '#dcfce7', '#e0f2fe', '#ffedd5', '#ecfdf3']
const calendarStatusStyles = {
  lowData: { backgroundColor: '#e5e7eb', borderColor: 'transparent' },
  highData: { backgroundColor: '#dbeafe', borderColor: 'transparent' },
  normal: { backgroundColor: 'transparent', borderColor: '#22c55e' },
  warning: { backgroundColor: 'transparent', borderColor: '#f59e0b' },
  exceeded: { backgroundColor: 'transparent', borderColor: '#ef4444' },
}
const calendarLegendItems = [
  { label: 'ส่งข้อมูลน้อยกว่า 80%', ...calendarStatusStyles.lowData },
  { label: 'ส่งข้อมูลมากกว่า 80%', ...calendarStatusStyles.highData },
  { label: 'ปกติทั้งวัน', ...calendarStatusStyles.normal },
  { label: 'เฝ้าระวัง', ...calendarStatusStyles.warning },
  { label: 'เกินมาตรฐาน', ...calendarStatusStyles.exceeded },
]
const calendarSummaryRows = [
  { parameter: 'CO (ppm)', exceededDays: '4 วัน', lowDataDays: '1 วัน', todayPercent: '95%' },
  { parameter: 'NOx (ppm)', exceededDays: '2 วัน', lowDataDays: '2 วัน', todayPercent: '92%' },
  { parameter: 'Temp. (°C)', exceededDays: '1 วัน', lowDataDays: '0 วัน', todayPercent: '98%' },
  { parameter: 'O2 (%)', exceededDays: '3 วัน', lowDataDays: '1 วัน', todayPercent: '90%' },
  { parameter: 'Flow (m3/hr)', exceededDays: '0 วัน', lowDataDays: '0 วัน', todayPercent: '99%' },
]
const mockCalendarStatusByDay = {
  '2026-06-02': 'lowData',
  '2026-06-03': 'highData',
  '2026-06-05': 'normal',
  '2026-06-08': 'warning',
  '2026-06-11': 'exceeded',
  '2026-06-14': 'highData',
  '2026-06-17': 'normal',
  '2026-06-19': 'lowData',
  '2026-06-23': 'warning',
  '2026-06-26': 'exceeded',
}
const statisticParameters = ['CO (ppm)', 'NOx (ppm)', 'Temp. (°C)', 'O2 (%)', 'Flow (m3/hr)']
const statisticStatusColors = {
  normal: '#46b529',
  warning: '#f59e0b',
  exceeded: '#ef4444',
  unavailable: '#9ca3af',
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

function toFiniteNumber(value) {
  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : null
}

function hasFactoryCoordinate(factory) {
  return Number.isFinite(factory.lon) && Number.isFinite(factory.lat)
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

function mapOperatorFactory(row, index) {
  const lon = toFiniteNumber(row.longitude)
  const lat = toFiniteNumber(row.latitude)
  const systems = getFactorySystems(row)

  return {
    id: row.factoryId ?? row.id ?? row.newRegistrationNo ?? `factory-${index}`,
    factoryId: row.factoryId ?? row.id ?? '',
    name: row.factoryName ?? '',
    newRegistrationNo: row.newRegistrationNo ?? '',
    oldRegistrationNo: row.oldRegistrationNo ?? row.factoryRegistrationNo ?? '',
    address: row.address ?? '',
    province: row.province ?? '',
    systems,
    distance: getDistanceFromReference(lon, lat),
    lon,
    lat,
    logoText: getFactoryLogoText(row.factoryName, row.newRegistrationNo),
    logoBg: logoBackgrounds[index % logoBackgrounds.length],
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

function HomePage({ accessToken = '' }) {
  const [factoryType, setFactoryType] = useState('all')
  const [sortBy, setSortBy] = useState('reference')
  const [searchValue, setSearchValue] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [selectedFactory, setSelectedFactory] = useState(null)
  const [isMobileListExpanded, setIsMobileListExpanded] = useState(true)
  const [provinceFilter, setProvinceFilter] = useState('all')
  const [maxDistance, setMaxDistance] = useState('all')
  const [factories, setFactories] = useState([])
  const [factoriesError, setFactoriesError] = useState('')
  const apiSystemType = factoryType === 'cems' ? 'CEMS' : factoryType === 'wpms' ? 'WPMS' : ''
  const effectiveFactories = useMemo(() => (accessToken ? factories : []), [accessToken, factories])
  const effectiveFactoriesError = accessToken ? factoriesError : 'กรุณาเข้าสู่ระบบเพื่อดูรายชื่อโรงงาน'
  const provinceOptions = useMemo(
    () => ['all', ...Array.from(new Set(effectiveFactories.map((factory) => factory.province).filter(Boolean)))],
    [effectiveFactories],
  )

  useEffect(() => {
    if (!accessToken) {
      return
    }

    let isActive = true

    fetch(getOperatorFactoriesApiUrl(apiSystemType), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
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
      const matchesProvince = provinceFilter === 'all' || factory.province === provinceFilter
      const matchesDistance =
        maxDistance === 'all' || (factory.distance !== null && factory.distance <= Number(maxDistance))
      const matchesKeyword =
        !keyword ||
        [factory.name, factory.newRegistrationNo, factory.oldRegistrationNo, factory.address, factory.province]
          .join(' ')
          .toLowerCase()
          .includes(keyword)

      return matchesType && matchesProvince && matchesDistance && matchesKeyword
    })

    return filtered.toSorted((first, second) => {
      if (sortBy === 'name') {
        return first.name.localeCompare(second.name, 'th')
      }

      return (first.distance ?? Number.POSITIVE_INFINITY) - (second.distance ?? Number.POSITIVE_INFINITY)
    })
  }, [effectiveFactories, factoryType, maxDistance, provinceFilter, searchValue, sortBy])

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
          error={effectiveFactoriesError}
          isMobileExpanded={isMobileListExpanded}
          onMobileToggle={() => setIsMobileListExpanded((current) => !current)}
          onFactorySelect={setSelectedFactory}
        />
        <FactoryMap factories={filteredFactories} />
      </Box>

      <AdvancedSearchDialog
        open={advancedOpen}
        provinceOptions={provinceOptions}
        provinceFilter={provinceFilter}
        maxDistance={maxDistance}
        onProvinceFilterChange={setProvinceFilter}
        onMaxDistanceChange={setMaxDistance}
        onClose={() => setAdvancedOpen(false)}
      />
      <FactoryBottomSheet
        factory={selectedFactory}
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

function FactoryList({ factories, loading, error, isMobileExpanded, onMobileToggle, onFactorySelect }) {
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
          <FactoryCard key={factory.id} factory={factory} onSelect={() => onFactorySelect(factory)} />
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

function FactoryCard({ factory, onSelect }) {
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
          }}
        >
          {factory.logoText}
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
            {[factory.newRegistrationNo, factory.oldRegistrationNo ? `(${factory.oldRegistrationNo})` : ''].filter(Boolean).join(' ')}
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
          <Tooltip title="ติดตาม">
            <IconButton
              size="small"
              aria-label="ติดตาม"
              sx={{
                width: 38,
                height: 38,
                border: 1,
                borderColor: 'divider',
                color: factory.isFavorite ? 'secondary.600' : 'inherit',
              }}
            >
              <StarBorderIcon fontSize="small" />
            </IconButton>
          </Tooltip>
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

function FactoryBottomSheet({ factory, open, onClose }) {
  const [selectedDate, setSelectedDate] = useState(() => dayjs())
  const [selectedStatisticPoint, setSelectedStatisticPoint] = useState('')
  const [selectedTrendParameter, setSelectedTrendParameter] = useState(statisticParameters[0])
  const statisticPoints = useMemo(() => getStatisticPoints(factory), [factory])
  const activeStatisticPoint = statisticPoints.some((point) => point.value === selectedStatisticPoint)
    ? selectedStatisticPoint
    : statisticPoints[0]?.value
  const statisticRows = useMemo(
    () => getStatisticRows(selectedDate, activeStatisticPoint),
    [activeStatisticPoint, selectedDate],
  )

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
            <Box
              sx={{
                minWidth: 0,
              }}
            >
              <Stack spacing={2}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '320px minmax(0, 1fr)' },
                    gap: 1.5,
                    alignItems: 'start',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    p: 1.5,
                  }}
                >
                  <Stack spacing={1.25} sx={{ width: { xs: '100%', sm: 320 }, alignItems: 'flex-start' }}>
                    <LocalizationProvider dateAdapter={AdapterDayjsBuddhist} adapterLocale="th">
                      <DateCalendar
                        value={selectedDate}
                        onChange={(nextDate) => {
                          if (nextDate) {
                            setSelectedDate(nextDate)
                          }
                        }}
                        sx={{
                          width: { xs: '100%', sm: 320 },
                          bgcolor: 'background.paper',
                          m: 0,
                        }}
                        slots={{ day: CalendarStatusDay }}
                        slotProps={{ day: { statusByDay: mockCalendarStatusByDay } }}
                      />
                    </LocalizationProvider>

                    {[calendarLegendItems.slice(0, 2), calendarLegendItems.slice(2)].map((legendRow, index) => (
                      <Stack
                        key={index}
                        direction="row"
                        spacing={1.5}
                        useFlexGap
                        sx={{ width: '100%', minWidth: 0, flexWrap: 'nowrap' }}
                      >
                        {legendRow.map((item) => (
                          <Stack
                            key={item.label}
                            direction="row"
                            spacing={0.75}
                            sx={{ alignItems: 'center', minWidth: 0, flex: '0 0 auto' }}
                          >
                            <Box
                              sx={{
                                width: 14,
                                height: item.backgroundColor === 'transparent' ? 10 : 6,
                                borderRadius: 999,
                                bgcolor: item.backgroundColor,
                                border: 2,
                                borderColor: item.borderColor,
                                flex: '0 0 auto',
                              }}
                            />
                            <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600 }}>
                              {item.label}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    ))}
                  </Stack>

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
                        {calendarSummaryRows.map((row) => (
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
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>

                <PollutionTrendPanel
                  rows={statisticRows}
                  selectedDate={selectedDate}
                  selectedParameter={selectedTrendParameter}
                  onParameterChange={setSelectedTrendParameter}
                />
              </Stack>
            </Box>
            <FactoryStatisticPanel
              selectedDate={selectedDate}
              points={statisticPoints}
              selectedPoint={activeStatisticPoint}
              onPointChange={setSelectedStatisticPoint}
              rows={statisticRows}
            />
          </Box>
        </Box>
      ) : null}
    </Drawer>
  )
}

function getStatisticPoints(factory) {
  const points = Array.isArray(factory?.measurementPoints) ? factory.measurementPoints : []
  const mappedPoints = points.map((point, index) => {
    const label = point.pointCode ?? point.stationId ?? point.pointName ?? `จุดที่ ${index + 1}`
    return {
      value: point.stationId ?? point.pointCode ?? label,
      label,
    }
  })

  return mappedPoints.length > 0
    ? mappedPoints
    : [
        { value: 'WP-01', label: 'WP-01' },
        { value: 'WP-02', label: 'WP-02' },
      ]
}

function getStatisticRows(selectedDate, selectedPoint) {
  const date = selectedDate?.format?.('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD')
  const pointOffset = selectedPoint === 'WP-02' ? 0.02 : 0

  return Array.from({ length: 24 }, (_, hour) => {
    const status =
      hour === 2 || hour === 13
        ? 'warning'
        : hour === 8 || hour === 17
          ? 'exceeded'
          : hour === 5 || hour === 21
            ? 'unavailable'
            : 'normal'
    const time = `${String(hour).padStart(2, '0')}.00-${String(hour).padStart(2, '0')}.59 น.`
    const co = 0.04 + ((hour + 1) % 5) * 0.01 + pointOffset
    const nox = 9.2 + (hour % 8) * 0.18 + pointOffset * 10
    const temp = 93.1 + (hour % 7) * 0.1
    const oxygen = 12.2 + (hour % 6) * 0.1
    const flow = 1800000 + hour * 5200 + (selectedPoint === 'WP-02' ? 43000 : 0)

    return {
      date,
      time,
      values: {
        'CO (ppm)': co,
        'NOx (ppm)': nox,
        'Temp. (°C)': temp,
        'O2 (%)': oxygen,
        'Flow (m3/hr)': flow,
      },
      statuses: {
        'CO (ppm)': status,
        'NOx (ppm)': hour === 4 || hour === 18 ? 'warning' : status,
        'Temp. (°C)': hour === 8 ? 'exceeded' : status,
        'O2 (%)': hour === 5 || hour === 21 ? 'unavailable' : 'normal',
        'Flow (m3/hr)': hour === 17 ? 'exceeded' : status,
      },
    }
  })
}

function PollutionTrendPanel({ rows, selectedDate, selectedParameter, onParameterChange }) {
  const selectedDateLabel = selectedDate?.format?.('D MMMM BBBB') ?? ''
  const chartData = useMemo(
    () =>
      rows.map((row) => ({
        time: row.time.slice(0, 5).replace('.', ':'),
        value: Number(row.values[selectedParameter] ?? 0),
      })),
    [rows, selectedParameter],
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
        ค่าแนวโน้มสถานการณ์มลพิษ :{' '}
        <Box component="span" sx={{ color: 'primary.main' }}>
          {selectedParameter} {selectedDateLabel}
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
        {statisticParameters.map((parameter) => (
          <Tab key={parameter} value={parameter} label={parameter} />
        ))}
      </Tabs>

      <Box sx={{ height: 320, px: 0.25, pt: 0.5, pb: 0 }}>
        <LineChart
          dataset={chartData}
          xAxis={[
            {
              data: chartData.map((item) => item.time),
              dataKey: 'time',
              scaleType: 'band',
              height: 56,
              tickInterval: chartData.map((item) => item.time),
              tickLabelInterval: () => true,
              tickLabelMinGap: 0,
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

function FactoryStatisticPanel({ selectedDate, points, selectedPoint, onPointChange, rows }) {
  const selectedDateLabel = selectedDate?.format?.('D MMMM BBBB') ?? ''

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
      <Typography variant="subtitle1" sx={{ px: 1.5, py: 1.25, fontWeight: 700 }}>
        สถิติข้อมูล{' '}
        <Box component="span" sx={{ color: 'primary.main' }}>
          {selectedDateLabel}
        </Box>
      </Typography>
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
                  zIndex: 2,
                  fontWeight: 700,
                  bgcolor: 'neutral.50',
                }}
              >
                เวลา
              </TableCell>
              {statisticParameters.map((parameter) => (
                <TableCell key={parameter} sx={{ minWidth: 104, fontWeight: 700, bgcolor: 'neutral.50' }}>
                  {parameter}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.date}-${row.time}`}>
                <TableCell
                  sx={{
                    minWidth: 140,
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    bgcolor: 'background.paper',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.time}
                </TableCell>
                {statisticParameters.map((parameter) => (
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
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

function CalendarStatusDay({
  day,
  disabled,
  disableHighlightToday,
  isAnimating,
  isFirstVisibleCell,
  isLastVisibleCell,
  isVisuallySelected,
  outsideCurrentMonth,
  selected,
  showDaysOutsideCurrentMonth,
  today,
  statusByDay = {},
  onBlur,
  onDaySelect,
  onFocus,
  onKeyDown,
  onMouseEnter,
  sx,
  ...other
}) {
  const status = outsideCurrentMonth ? null : statusByDay[day.format('YYYY-MM-DD')]
  const statusStyle = status ? calendarStatusStyles[status] : null
  const isSelected = selected || isVisuallySelected

  void disableHighlightToday
  void isAnimating
  void isFirstVisibleCell
  void isLastVisibleCell
  void showDaysOutsideCurrentMonth

  return (
    <ButtonBase
      {...other}
      component="button"
      disabled={disabled || outsideCurrentMonth}
      onBlur={(event) => onBlur?.(event, day)}
      onClick={() => onDaySelect?.(day)}
      onFocus={(event) => onFocus?.(event, day)}
      onKeyDown={(event) => onKeyDown?.(event, day)}
      onMouseEnter={(event) => onMouseEnter?.(event, day)}
      sx={{
        width: 36,
        height: 36,
        m: '0 2px',
        borderRadius: '50%',
        fontSize: 14,
        lineHeight: 1,
        color: outsideCurrentMonth ? 'text.disabled' : 'text.primary',
        bgcolor: isSelected ? 'primary.main' : 'transparent',
        border: today ? 1 : 2,
        borderColor: today ? 'primary.main' : 'transparent',
        ...sx,
        ...(statusStyle
          ? {
              bgcolor: isSelected
                ? 'primary.main'
                : statusStyle.backgroundColor === 'transparent'
                  ? 'transparent'
                  : statusStyle.backgroundColor,
              border: 2,
              borderColor: statusStyle.borderColor === 'transparent' && today ? 'primary.main' : statusStyle.borderColor,
              color: isSelected ? 'primary.contrastText' : 'text.primary',
              '&:hover': {
                bgcolor: statusStyle.backgroundColor === 'transparent' ? 'action.hover' : statusStyle.backgroundColor,
              },
              ...(isSelected
                ? {
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                  }
                : null),
            }
          : {
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }),
      }}
    >
      {day.date()}
    </ButtonBase>
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
  provinceOptions,
  provinceFilter,
  maxDistance,
  onProvinceFilterChange,
  onMaxDistanceChange,
  onClose,
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pr: 6 }}>
        ค้นหาขั้นสูง
        <IconButton
          aria-label="ปิด"
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl size="small" fullWidth>
            <InputLabel id="province-filter-label">จังหวัด</InputLabel>
            <Select
              labelId="province-filter-label"
              value={provinceFilter}
              label="จังหวัด"
              onChange={(event) => onProvinceFilterChange(event.target.value)}
            >
              {provinceOptions.map((province) => (
                <MenuItem key={province} value={province}>
                  {province === 'all' ? 'ทุกจังหวัด' : province}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel id="distance-filter-label">ระยะทาง</InputLabel>
            <Select
              labelId="distance-filter-label"
              value={maxDistance}
              label="ระยะทาง"
              onChange={(event) => onMaxDistanceChange(event.target.value)}
            >
              <MenuItem value="all">ทุกระยะทาง</MenuItem>
              <MenuItem value="10">ไม่เกิน 10 กม.</MenuItem>
              <MenuItem value="30">ไม่เกิน 30 กม.</MenuItem>
              <MenuItem value="50">ไม่เกิน 50 กม.</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          variant="outlined"
          onClick={() => {
            onProvinceFilterChange('all')
            onMaxDistanceChange('all')
          }}
        >
          ล้างค่า
        </Button>
        <Button variant="contained" onClick={onClose}>
          ใช้งาน
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
