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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import StarBorderIcon from '@mui/icons-material/StarBorder'

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

const factories = [
  {
    id: 'paper-khan-na',
    name: 'บริษัท โรงงานกระดาษกานนา (ประเทศไทย) จำกัด',
    newRegistrationNo: '10120100125172',
    oldRegistrationNo: '3-38(2)-1/17นน',
    address: '6/2 ม.3 ซ.วัดบางพูด ต.สุภาษิตดล ต.บางพูด อ.ปากเกร็ด จ.นนทบุรี',
    province: 'นนทบุรี',
    systems: ['WPMS'],
    distance: 8.5,
    lon: 100.5471,
    lat: 13.9272,
    logoText: 'กน',
    logoBg: '#dbeafe',
  },
  {
    id: 'aharn-inter',
    name: 'บริษัท อาหารอินเทอร์ จำกัด',
    newRegistrationNo: '10740000125244',
    oldRegistrationNo: '3-4(1)-1/24สค',
    address: '4/2 ม.7 ซ.พุทธมณฑลสาย 5 ถ.เพชรเกษม ต.อ้อมน้อย อ.กระทุ่มแบน จ.สมุทรสาคร',
    province: 'สมุทรสาคร',
    systems: ['WPMS'],
    distance: 25.6,
    lon: 100.5488,
    lat: 13.7057,
    logoText: 'AI',
    logoBg: '#fef3c7',
  },
  {
    id: 'ind-hides',
    name: 'บริษัท อินเดอร์ไฮด์ จำกัด (มหาชน)',
    newRegistrationNo: '91630000325500',
    oldRegistrationNo: 'น3-29-3/50สบ',
    address: '111 ม.6 ซ.กม.34 ถ.สุขุมวิท ต.บางปูใหม่ อ.เมืองสมุทรปราการ จ.สมุทรปราการ',
    province: 'สมุทรปราการ',
    systems: ['WPMS'],
    distance: 44.8,
    lon: 100.6712,
    lat: 13.5431,
    logoText: 'IHL',
    logoBg: '#fee2e2',
  },
  {
    id: 'bangpoo-34',
    name: 'เขตประกอบการอุตสาหกรรมฟอกหนังกม.34 บจก.',
    newRegistrationNo: '91630000225361',
    oldRegistrationNo: 'น3-101-2/36สบ',
    address: '223/2 ม.6 ซ.ฟอกหนัง กม.34 ถ.สุขุมวิท ต.บางปูใหม่ อ.เมืองสมุทรปราการ จ.สมุทรปราการ',
    province: 'สมุทรปราการ',
    systems: ['WPMS'],
    distance: 44.9,
    lon: 100.6658,
    lat: 13.5394,
    logoText: '34',
    logoBg: '#dcfce7',
  },
  {
    id: 'prime-tan',
    name: 'บริษัท ไพรม แทน จำกัด',
    newRegistrationNo: '1010200125404',
    oldRegistrationNo: '3-29-1/40สบ',
    address: '1087 ม.6 ซ.ฟอกหนัง กม.34 ถ.สุขุมวิท ต.บางปูใหม่ อ.เมืองสมุทรปราการ จ.สมุทรปราการ',
    province: 'สมุทรปราการ',
    systems: ['WPMS'],
    distance: 45,
    lon: 100.6565,
    lat: 13.5359,
    logoText: 'PT',
    logoBg: '#e0f2fe',
  },
  {
    id: 'thaitannery',
    name: 'บริษัท วาย.อาร์.ซี.เท็กซ์ไทล์ จำกัด',
    newRegistrationNo: '10740100125607',
    oldRegistrationNo: '3-22(3)-1/60ลค',
    address: '134,134/3 ม.6 ถ.เศรษฐกิจ 1 ต.อ้อมน้อย อ.กระทุ่มแบน จ.สมุทรสาคร',
    province: 'สมุทรสาคร',
    systems: ['CEMS', 'WPMS'],
    distance: 27.1,
    lon: 100.2892,
    lat: 13.6903,
    logoText: 'YRC',
    logoBg: '#ffedd5',
  },
  {
    id: 'thai-tanning',
    name: 'บริษัท โรงงานฟอกหนังไทย จำกัด (มหาชน)',
    newRegistrationNo: '10110200225253',
    oldRegistrationNo: '3-22(4)-2/25สบ',
    address: '386 ม.2 ถ.สุขุมวิท ต.บางปูใหม่ อ.เมืองสมุทรปราการ จ.สมุทรปราการ',
    province: 'สมุทรปราการ',
    systems: ['WPMS'],
    distance: 45.5,
    lon: 100.6788,
    lat: 13.5428,
    logoText: 'TTP',
    logoBg: '#ecfdf3',
  },
  {
    id: 'phattana',
    name: 'บริษัท พัฒนาฟ้าไทย จำกัด',
    newRegistrationNo: '10110001125355',
    oldRegistrationNo: '3-22(3)-11/35สบ',
    address: '525/1 ม.2 ถ.สุขุมวิท กม.35 ต.บางปูใหม่ อ.เมืองสมุทรปราการ จ.สมุทรปราการ',
    province: 'สมุทรปราการ',
    systems: ['WPMS'],
    distance: 45.6,
    lon: 100.684,
    lat: 13.5365,
    logoText: 'TD',
    logoBg: '#fee2e2',
  },
  {
    id: 'pathum-thani',
    name: 'บริษัท ปทุมธานี บริวเวอรี่ จำกัด',
    newRegistrationNo: '10130000125354',
    oldRegistrationNo: '3-19(2)-1/35ปท',
    address: '2 ม.9 ซ.วัดเจ้า ถ.กรุงเทพ-ปทุมธานี ต.บางคูวัด อ.เมืองปทุมธานี จ.ปทุมธานี',
    province: 'ปทุมธานี',
    systems: ['WPMS'],
    distance: 9,
    lon: 100.5254,
    lat: 14.0099,
    logoText: 'PB',
    logoBg: '#fef3c7',
  },
]

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

function HomePage() {
  const [factoryType, setFactoryType] = useState('all')
  const [sortBy, setSortBy] = useState('reference')
  const [searchValue, setSearchValue] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [selectedFactory, setSelectedFactory] = useState(null)
  const [isMobileListExpanded, setIsMobileListExpanded] = useState(true)
  const [provinceFilter, setProvinceFilter] = useState('all')
  const [maxDistance, setMaxDistance] = useState('all')
  const provinceOptions = useMemo(
    () => ['all', ...Array.from(new Set(factories.map((factory) => factory.province)))],
    [],
  )

  const filteredFactories = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    const filtered = factories.filter((factory) => {
      const matchesType =
        factoryType === 'all' || factory.systems.some((system) => system.toLowerCase() === factoryType)
      const matchesProvince = provinceFilter === 'all' || factory.province === provinceFilter
      const matchesDistance = maxDistance === 'all' || factory.distance <= Number(maxDistance)
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

      return first.distance - second.distance
    })
  }, [factoryType, maxDistance, provinceFilter, searchValue, sortBy])

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

function FactoryList({ factories, isMobileExpanded, onMobileToggle, onFactorySelect }) {
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
        {factories.map((factory) => (
          <FactoryCard key={factory.id} factory={factory} onSelect={() => onFactorySelect(factory)} />
        ))}

        {factories.length === 0 ? (
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
            {factory.newRegistrationNo} ({factory.oldRegistrationNo})
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
                sx={{
                  height: 22,
                  bgcolor: 'secondary.600',
                  color: 'secondary.contrastText',
                  fontWeight: 600,
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            ))}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ flex: 1, textAlign: 'right', minWidth: 54 }}
            >
              {factory.distance.toFixed(1)} กม.
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
    </Paper>
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
    factories.forEach((factory) => {
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

    if (factories.length > 0) {
      const center = getMapCenter(factories)
      map.location(center, true)
      map.zoom(factories.length === 1 ? 13 : 10, true)
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
                width: { xs: 82, sm: 104, md: 128 },
                height: { xs: 82, sm: 104, md: 128 },
                flex: '0 0 auto',
                display: 'grid',
                placeItems: 'center',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1.5,
                bgcolor: factory.logoBg,
                color: 'primary.900',
                fontSize: { xs: 24, md: 32 },
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

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 0.8fr) minmax(0, 1.2fr)' },
                  gap: 1.25,
                  mt: 2,
                }}
              >
                <FactoryMeta
                  label="เลขทะเบียนโรงงาน"
                  value={`${factory.newRegistrationNo} (${factory.oldRegistrationNo})`}
                />
                <FactoryMeta label="ที่อยู่" value={factory.address} />
              </Box>
            </Box>
          </Stack>
        </Box>
      ) : null}
    </Drawer>
  )
}

function FactoryMeta({ label, value, sx }) {
  return (
    <Box sx={{ minWidth: 0, ...sx }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'text.primary',
          fontWeight: 600,
          lineHeight: 1.5,
          overflowWrap: 'anywhere',
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
