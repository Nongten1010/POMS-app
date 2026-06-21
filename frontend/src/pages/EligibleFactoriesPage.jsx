import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Box, Button, Chip, Fade, Paper, Snackbar, Stack, Tab, Tabs, Typography } from '@mui/material'
import AddTaskIcon from '@mui/icons-material/AddTask'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import RefreshIcon from '@mui/icons-material/Refresh'
import { DataGrid } from '@mui/x-data-grid'

const eligibleFactoryCandidatesApiUrl = import.meta.env.DEV
  ? '/api-proxy/v1/eligible-factories/candidates'
  : 'http://d-poms.diw.go.th/api/v1/eligible-factories/candidates'

const eligibleFactoriesApiUrl = import.meta.env.DEV
  ? '/api-proxy/v1/eligible-factories'
  : 'http://d-poms.diw.go.th/api/v1/eligible-factories'

const emptyValue = '-'

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

function formatNumber(value) {
  return typeof value === 'number' ? value.toLocaleString('th-TH') : emptyValue
}

function formatWithUnit(value, unit) {
  return typeof value === 'number' ? `${formatNumber(value)} ${unit}` : emptyValue
}

function formatCoordinates(latitude, longitude) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return emptyValue
  }

  return `${latitude}, ${longitude}`
}

function formatFactoryTypeOrder(factoryClass, factorySubclass) {
  return [factoryClass, factorySubclass].filter(Boolean).join(' / ') || emptyValue
}

function getFactoryKey(row) {
  return row.factoryId || row.factoryRegistrationNo || row.id
}

function mapFactoryRow(row, index, idPrefix = 'factory') {
  const factoryKey = getFactoryKey(row) || `${idPrefix}-${index}`

  return {
    id: idPrefix === 'eligible' ? `eligible-${row.id ?? factoryKey}` : factoryKey,
    factoryKey,
    eligibleFactoryId: row.id ?? null,
    candidatePayload: row,
    factoryName: row.factoryName ?? emptyValue,
    newRegistrationNo: row.factoryId ?? emptyValue,
    oldRegistrationNo: row.factoryRegistrationNo ?? emptyValue,
    factoryTypeOrder: formatFactoryTypeOrder(row.factoryClass, row.factorySubclass),
    location: row.address ?? emptyValue,
    province: row.provinceName ?? emptyValue,
    industrialEstate: row.industrialEstateName ?? emptyValue,
    coordinates: formatCoordinates(row.latitude, row.longitude),
    operation: row.businessActivity ?? emptyValue,
    operationStatus: row.operationStatus ?? emptyValue,
    capital: formatWithUnit(row.capitalAmount, 'บาท'),
    machineHorsepower: formatWithUnit(row.machineryHorsepower, 'แรงม้า'),
    productionCapacity: row.productionCapacity ?? emptyValue,
    wastewaterDischarge: row.wastewaterDischargeInfo ?? emptyValue,
    boilerCount: typeof row.boilerCount === 'number' ? row.boilerCount : null,
    boilerSize: row.boilerSizeEach ?? emptyValue,
    fuel: row.fuelUsed ?? emptyValue,
    eia: row.hasEia === true ? 'มี' : row.hasEia === false ? 'ไม่มี' : emptyValue,
  }
}

function mapCandidateFactory(row, index) {
  return mapFactoryRow(row, index, 'candidate')
}

function mapEligibleFactory(row, index) {
  return mapFactoryRow(row, index, 'eligible')
}

function createEligibleFactoryPayload(row) {
  const candidate = row.candidatePayload ?? {}

  return {
    factoryName: candidate.factoryName ?? null,
    factoryId: candidate.factoryId ?? null,
    factoryRegistrationNo: candidate.factoryRegistrationNo ?? null,
    factoryClass: candidate.factoryClass ?? null,
    factorySubclass: candidate.factorySubclass ?? null,
    address: candidate.address ?? null,
    provinceName: candidate.provinceName ?? null,
    industrialEstateName: candidate.industrialEstateName ?? null,
    longitude: candidate.longitude ?? null,
    latitude: candidate.latitude ?? null,
    businessActivity: candidate.businessActivity ?? null,
    operationStatus: candidate.operationStatus ?? null,
    capitalAmount: candidate.capitalAmount ?? null,
    machineryHorsepower: candidate.machineryHorsepower ?? null,
    productionCapacity: candidate.productionCapacity ?? null,
    wastewaterDischargeInfo: candidate.wastewaterDischargeInfo ?? null,
    boilerCount: candidate.boilerCount ?? null,
    boilerSizeEach: candidate.boilerSizeEach ?? null,
    fuelUsed: candidate.fuelUsed ?? null,
    hasEia: candidate.hasEia ?? null,
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
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('นำเข้าโรงงานเข้าข่ายสำเร็จ')
  const eligibleFactoryKeySet = useMemo(
    () => new Set(eligibleFactoryRows.map((row) => row.factoryKey)),
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

  const effectiveFactoryRows = useMemo(() => (accessToken ? factoryRows : []), [accessToken, factoryRows])
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

  const handleMarkEligible = useCallback(
    async (row) => {
      if (!accessToken) {
        setEligibleActionError('กรุณาเข้าสู่ระบบก่อนเพิ่มโรงงานเข้าข่าย')
        return
      }

      setEligibleActionError('')
      setSavingEligibleFactoryIds((current) =>
        current.includes(row.id) ? current : [...current, row.id],
      )

      try {
        const result = await fetch(eligibleFactoriesApiUrl, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createEligibleFactoryPayload(row)),
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
            `เพิ่มโรงงานเข้าข่ายไม่สำเร็จ (${result.status} ${result.statusText})`
          throw new Error(message)
        }

        await loadEligibleFactories()
        setSnackbarMessage('นำเข้าโรงงานเข้าข่ายสำเร็จ')
        setSnackbarOpen(true)
      } catch (requestError) {
        setEligibleActionError(requestError.message)
      } finally {
        setSavingEligibleFactoryIds((current) => current.filter((id) => id !== row.id))
      }
    },
    [accessToken, loadEligibleFactories],
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
      ...baseColumns,
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
              startIcon={<AddTaskIcon />}
              disabled={isEligible || isSaving}
              onClick={() => handleMarkEligible(params.row)}
            >
              {isSaving ? 'กำลังบันทึก' : 'เข้าข่าย'}
            </Button>
          )
        },
      },
    ],
    [eligibleFactoryKeySet, handleMarkEligible, savingEligibleFactoryIdSet],
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
        renderCell: (params) => {
          const isDeleting = deletingEligibleFactoryIdSet.has(params.row.id)

          return (
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
          )
        },
      },
    ],
    [deletingEligibleFactoryIdSet, handleRemoveEligible],
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
    </Stack>
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
    <FactoryDataGrid
      title="คำขอเชื่อมต่อ"
      rows={connectionRequestRows}
      columns={connectionRequestColumns}
    />
  )
}

export default EligibleFactoriesPage
