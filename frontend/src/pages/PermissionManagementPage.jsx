import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Fade,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import SaveIcon from '@mui/icons-material/Save'
import { DataGrid } from '@mui/x-data-grid'
import provinceOptions from '../option/provinceOptions.json'
import regionOptions from '../option/regionOptions.json'

const usersApiUrl = import.meta.env.DEV
  ? '/api-proxy/v1/users?status=all'
  : 'https://d-poms.diw.go.th/api/v1/users?status=all'

const createUserApiUrl = import.meta.env.DEV
  ? '/api-proxy/v1/users/local-accounts'
  : 'https://d-poms.diw.go.th/api/v1/users/local-accounts'

const getUserDetailApiUrl = (id) =>
  import.meta.env.DEV ? `/api-proxy/v1/users/${id}` : `https://d-poms.diw.go.th/api/v1/users/${id}`

const getUpdateUserApiUrl = (id) =>
  import.meta.env.DEV ? `/api-proxy/v1/users/${id}` : `https://d-poms.diw.go.th/api/v1/users/${id}`

const getDeleteUserApiUrl = (id) =>
  import.meta.env.DEV ? `/api-proxy/v1/users/${id}` : `https://d-poms.diw.go.th/api/v1/users/${id}`

const roleNameThByCode = {
  public_anonymous: 'ประชาชน ไม่ login',
  public_user: 'ประชาชน login',
  factory_operator: 'โรงงาน (ผู้ประกอบการ)',
  diw_central: 'กรอ.',
  provincial_office: 'สอจ.',
  industrial_estate: 'กนอ.',
  monitoring_kpm: 'เจ้าหน้าที่ศูนย์เฝ้า (กฝม.)',
  monitoring_5_centers: 'เจ้าหน้าที่ศูนย์เฝ้า (5 ศูนย์)',
  center_director: 'ผอ.ศูนย์',
  kpm_director: 'ผอ.กฝม.',
  kwp_director: 'ผอ.กวภ.',
  admin: 'Admin',
}

const roleOptions = Object.entries(roleNameThByCode).map(([value, label]) => ({
  label,
  value,
}))

const statusOptions = [
  { label: 'ใช้งาน', value: 'active' },
  { label: 'ระงับใช้งาน', value: 'suspended' },
]

const scopeOptions = [
  { label: 'ทั้งหมด', value: 'ALL' },
  { label: 'จังหวัด', value: 'IN_PROVINCE' },
  { label: 'ภาค', value: 'IN_REGION' },
  { label: 'นิคม', value: 'IN_ESTATE' },
  { label: 'โรงงานตนเอง', value: 'OWN_FACTORY' },
  { label: 'ไม่อนุญาต', value: 'NONE' },
]

const permissionSections = [
  {
    title: 'หน้าหลัก',
    permissionKey: 'dashboard',
    scope: true,
    locationScope: true,
    permissions: [
      { label: 'ข้อมูลปัจจุบัน', action: 'view' },
      { label: 'Favorite', action: 'favorite' },
      { label: 'การค้นหา', action: 'search' },
      { label: 'การค้นหาขั้นสูง', action: 'advanced_search' },
      { label: 'สถิติ / Export', action: ['statistics', 'export'] },
    ],
  },
  {
    title: 'ข้อมูลพื้นฐาน',
    permissionKey: 'factories',
    scope: true,
    locationScope: true,
    permissions: [
      { label: 'มีสิทธิ์ใช้งาน', action: 'view' },
      { label: 'การแก้ไข', action: 'edit' },
      { label: 'อนุมัติ/อนุญาต', action: 'approve' },
    ],
  },
  {
    title: 'ขอเชื่อมต่อ',
    permissionKey: 'connection',
    scope: true,
    locationScope: true,
    permissions: [
      { label: 'มีสิทธิ์ใช้งาน', action: 'view' },
      { label: 'การแก้ไข', action: 'edit' },
      { label: 'อนุมัติ/อนุญาต', action: 'approve' },
    ],
  },
  {
    title: 'แจ้งแบบ กวภ. 01 - กวภ. 05',
    permissionKey: 'kwp_forms',
    scope: true,
    locationScope: true,
    permissions: [
      { label: 'มีสิทธิ์ใช้งาน', action: 'view' },
      { label: 'การแก้ไข', action: 'edit' },
      { label: 'อนุมัติ/อนุญาต', action: 'approve' },
    ],
  },
  {
    title: 'รายงานค่าความคลาดเคลื่อน BOD/COD Online',
    permissionKey: 'bod_cod_errors',
    scope: true,
    locationScope: true,
    permissions: [
      { label: 'มีสิทธิ์ใช้งาน', action: 'view' },
      { label: 'การแก้ไข', action: 'edit' },
      { label: 'อนุมัติ/อนุญาต', action: 'approve' },
    ],
  },
  {
    title: 'การแจ้งเตือน',
    permissionKey: 'notifications',
    scope: true,
    locationScope: true,
    permissions: [
      { label: 'มีสิทธิ์ใช้งาน', action: 'view' },
      { label: 'สถานะการแจ้งเตือน', action: 'view_status' },
      { label: 'การแก้ไข', action: 'edit' },
      { label: 'อนุมัติ/อนุญาต', action: 'approve' },
    ],
  },
  {
    title: 'สถิติข้อมูล',
    permissionKey: 'statistics',
    locationScope: true,
    permissions: [{ label: 'มีสิทธิ์ใช้งาน', action: 'view' }],
  },
  {
    title: 'การสืบค้นข้อมูลแบบมีเงื่อนไข',
    permissionKey: 'conditional_search',
    locationScope: true,
    permissions: [{ label: 'มีสิทธิ์ใช้งาน', action: 'view' }],
  },
  { title: 'แจ้งขอความช่วยเหลือ', permissionKey: 'helpdesk', permissions: [{ label: 'มีสิทธิ์ใช้งาน', action: 'view' }] },
  { title: 'ข้อเสนอแนะ', permissionKey: 'feedback', permissions: [{ label: 'มีสิทธิ์ใช้งาน', action: 'view' }] },
  {
    title: 'กฎหมายที่เกี่ยวข้อง',
    permissionKey: 'laws',
    permissions: [
      { label: 'มีสิทธิ์ใช้งาน', action: 'view' },
      { label: 'การแก้ไข', action: 'edit' },
    ],
  },
  {
    title: 'คำถามที่พบบ่อย',
    permissionKey: 'faq',
    permissions: [
      { label: 'มีสิทธิ์ใช้งาน', action: 'view' },
      { label: 'การแก้ไข', action: 'edit' },
    ],
  },
  {
    title: 'Chat',
    permissionKey: 'chat',
    permissions: [
      { label: 'มีสิทธิ์ใช้งาน', action: 'view' },
      { label: 'ตอบคำถาม (Admin)', action: 'edit' },
    ],
  },
  {
    title: 'จัดการสิทธิ์การใช้งาน',
    permissionKey: 'permissions',
    permissions: [{ label: 'มีสิทธิ์ใช้งาน (Admin)', action: 'view' }],
  },
  {
    title: 'จัดการโรงงานที่เข้าข่าย (Admin)',
    permissionKey: 'eligible_factories',
    permissions: [{ label: 'มีสิทธิ์ใช้งาน (Admin)', action: 'view' }],
  },
]

const defaultUser = {
  username: '',
  fullName: '',
  affiliation: '',
  position: '',
  level: '',
  password: '',
  role: 'กรอ.',
  roleCode: 'diw_central',
  status: 'ใช้งาน',
  statusValue: 'active',
  permissions: {},
}

function mapApiUser(user, permissions = {}, fallbackId) {
  const roleCode = typeof user.roles === 'string' ? user.roles : user.primaryRole?.code ?? user.roles?.[0]?.code

  return {
    id: user.id ?? fallbackId,
    username: user.username ?? '',
    fullName: user.fullName ?? '',
    affiliation: user.department ?? '',
    position: user.lineNameTh ?? '',
    level: user.levelNameTh ?? '',
    role: roleNameThByCode[roleCode] ?? user.primaryRole?.nameTh ?? user.roles?.[0]?.nameTh ?? roleCode ?? '-',
    roleCode: roleCode ?? '',
    status: user.isActive ? 'ใช้งาน' : 'ระงับใช้งาน',
    statusValue: user.isActive ? 'active' : 'suspended',
    source: user.source ?? 'created',
    permissions,
  }
}

function emptyToNull(value) {
  const normalizedValue = String(value ?? '').trim()
  return normalizedValue ? normalizedValue : null
}

function getPermissionDataValue(value) {
  const normalizedValue = String(value ?? 'ALL')
  return normalizedValue === 'NONE' ? null : normalizedValue
}

function getPermissionLocationValue(value) {
  return String(value ?? 'all')
}

function getScopedLocationValue(dataScope, expectedScope, submittedValue, currentValue) {
  if (dataScope !== expectedScope) {
    return 'all'
  }

  return submittedValue === null
    ? getPermissionLocationValue(currentValue)
    : getPermissionLocationValue(submittedValue)
}

function buildPermissionsFromForm(formData, currentPermissions = {}) {
  return Object.fromEntries(
    permissionSections.map((section) => {
      const currentPermission = currentPermissions?.[section.permissionKey] ?? {}
      const scopeInput = formData.get(`permission.${section.permissionKey}.data`)
      const regionInput = formData.get(`permission.${section.permissionKey}.region`)
      const provinceInput = formData.get(`permission.${section.permissionKey}.province`)
      const dataScope =
        scopeInput === null
          ? currentPermission.data === undefined
            ? 'ALL'
            : currentPermission.data
          : getPermissionDataValue(scopeInput)
      const permission = {
        data: dataScope,
      }

      if (section.locationScope) {
        permission.region = getScopedLocationValue(
          dataScope,
          'IN_REGION',
          regionInput,
          currentPermission.region,
        )
        permission.province = getScopedLocationValue(
          dataScope,
          'IN_PROVINCE',
          provinceInput,
          currentPermission.province,
        )
      }

      section.permissions.forEach((item) => {
        const checked = formData.get(`permission.${section.permissionKey}.${item.name ?? item.label}`) === 'on'
        const actions = Array.isArray(item.action) ? item.action : [item.action]
        actions.forEach((action) => {
          permission[action] = checked
        })
      })

      return [section.permissionKey, permission]
    }),
  )
}

function PermissionManagementPage({ accessToken = '' }) {
  const [dialogMode, setDialogMode] = useState('edit')
  const [selectedUser, setSelectedUser] = useState(null)
  const [deleteUser, setDeleteUser] = useState(null)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('Saved successfully')
  const [users, setUsers] = useState([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [isSavingUser, setIsSavingUser] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [isDeletingUser, setIsDeletingUser] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (!accessToken) {
      return
    }

    const controller = new AbortController()

    async function loadUsers() {
      setIsLoadingUsers(true)
      setUsersError('')

      try {
        const result = await fetch(usersApiUrl, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          signal: controller.signal,
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
            `โหลดรายชื่อเจ้าหน้าที่ไม่สำเร็จ (${result.status} ${result.statusText})`
          throw new Error(message)
        }

        const nextUsers = Array.isArray(response?.data) ? response.data.map(mapApiUser) : []
        setUsers(nextUsers)
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setUsers([])
          setUsersError(requestError.message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingUsers(false)
        }
      }
    }

    loadUsers()

    return () => {
      controller.abort()
    }
  }, [accessToken])

  const effectiveUsers = useMemo(() => (accessToken ? users : []), [accessToken, users])
  const effectiveUsersError = accessToken ? usersError : 'กรุณาเข้าสู่ระบบเพื่อดูรายชื่อเจ้าหน้าที่'
  const isTableLoading = Boolean(accessToken) && isLoadingUsers

  const userColumns = [
    { field: 'username', headerName: 'Username', width: 180 },
    { field: 'fullName', headerName: 'ชื่อ-นามสกุล', width: 220 },
    { field: 'affiliation', headerName: 'สังกัด', width: 260 },
    { field: 'position', headerName: 'ตำแหน่ง', width: 180 },
    { field: 'level', headerName: 'ระดับ', width: 150 },
    {
      field: 'role',
      headerName: 'สิทธิ์ในระบบ',
      width: 210,
      renderCell: (params) => <Chip label={params.value} size="small" variant="outlined" sx={{ fontWeight: 300 }} />,
    },
    {
      field: 'status',
      headerName: 'สถานะ',
      width: 140,
      renderCell: (params) => <StatusChip status={params.value} />,
    },
    {
      field: 'option',
      headerName: 'Option',
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Tooltip title="Edit">
            <IconButton aria-label={`แก้ไข ${params.row.username}`} size="small" onClick={() => openEditDialog(params.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              aria-label={`ลบ ${params.row.username}`}
              size="small"
              color="error"
              onClick={() => openDeleteDialog(params.row)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ]

  const openAddDialog = () => {
    setDialogMode('add')
    setSaveError('')
    setSelectedUser(defaultUser)
  }

  const openEditDialog = async (user) => {
    setDialogMode('edit')
    setSaveError('')
    setSelectedUser({
      ...user,
      isLoadingDetail: true,
      detailError: '',
      detailVersion: 0,
    })

    if (!accessToken) {
      setSelectedUser({
        ...user,
        isLoadingDetail: false,
        detailError: 'กรุณาเข้าสู่ระบบเพื่อโหลดข้อมูลสิทธิ์ผู้ใช้งาน',
        detailVersion: 1,
      })
      return
    }

    try {
      const result = await fetch(getUserDetailApiUrl(user.id), {
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
          `โหลดข้อมูลสิทธิ์ผู้ใช้งานไม่สำเร็จ (${result.status} ${result.statusText})`
        throw new Error(message)
      }

      setSelectedUser({
        ...mapApiUser(response?.user ?? {}, response?.permissions ?? {}, user.id),
        isLoadingDetail: false,
        detailError: '',
        detailVersion: 1,
      })
    } catch (requestError) {
      setSelectedUser({
        ...user,
        isLoadingDetail: false,
        detailError: requestError.message,
        detailVersion: 1,
      })
    }
  }

  const openDeleteDialog = (user) => {
    setDeleteError('')
    setDeleteUser(user)
  }

  const closeDialog = () => {
    setSelectedUser(null)
    setSaveError('')
  }

  const closeDeleteDialog = () => {
    if (isDeletingUser) {
      return
    }

    setDeleteUser(null)
    setDeleteError('')
  }

  const confirmDelete = async () => {
    if (!accessToken) {
      setDeleteError('กรุณาเข้าสู่ระบบก่อนลบผู้ใช้งาน')
      return
    }

    if (!deleteUser?.id) {
      setDeleteError('ไม่พบรหัสผู้ใช้งานสำหรับลบ')
      return
    }

    setIsDeletingUser(true)
    setDeleteError('')

    try {
      const result = await fetch(getDeleteUserApiUrl(deleteUser.id), {
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
          `ลบผู้ใช้งานไม่สำเร็จ (${result.status} ${result.statusText})`
        throw new Error(message)
      }

      setUsers((currentUsers) => currentUsers.filter((user) => user.id !== deleteUser.id))
      setDeleteUser(null)
      setSnackbarMessage('Deleted successfully')
      setSnackbarOpen(true)
    } catch (requestError) {
      setDeleteError(requestError.message)
    } finally {
      setIsDeletingUser(false)
    }
  }

  const handleSave = async (formValues) => {
    if (!accessToken) {
      setSaveError(dialogMode === 'add' ? 'กรุณาเข้าสู่ระบบก่อนเพิ่มผู้ใช้งาน' : 'กรุณาเข้าสู่ระบบก่อนแก้ไขผู้ใช้งาน')
      return
    }

    setIsSavingUser(true)
    setSaveError('')

    try {
      const isAddMode = dialogMode === 'add'
      const result = await fetch(isAddMode ? createUserApiUrl : getUpdateUserApiUrl(selectedUser.id), {
        method: isAddMode ? 'POST' : 'PATCH',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formValues),
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
          `${dialogMode === 'add' ? 'เพิ่ม' : 'แก้ไข'}ผู้ใช้งานไม่สำเร็จ (${result.status} ${result.statusText})`
        throw new Error(message)
      }

      setSelectedUser(null)
      setSnackbarMessage('Saved successfully')
      setSnackbarOpen(true)
    } catch (requestError) {
      setSaveError(requestError.message)
    } finally {
      setIsSavingUser(false)
    }
  }

  return (
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
      <Paper
        elevation={0}
        sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
        >
          <Typography variant="h5" component="h1" sx={{ flex: 1, fontWeight: 600 }}>
            สิทธิ์การใช้งาน
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>
            เพิ่มผู้ใช้งาน
          </Button>
        </Stack>
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
      </Paper>

      <Paper
        elevation={0}
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          p: { xs: 2, md: 3 },
          border: 1,
          borderColor: 'divider',
        }}
        >
        <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
          {effectiveUsersError ? <Alert severity="warning">{effectiveUsersError}</Alert> : null}

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <DataGrid
              rows={effectiveUsers}
              columns={userColumns}
              loading={isTableLoading}
              disableRowSelectionOnClick
              showToolbar
              showCellVerticalBorder
              showColumnVerticalBorder
              label="รายชื่อเจ้าหน้าที่ในระบบ"
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
        </Stack>
      </Paper>

      <UserPermissionDialog
        mode={dialogMode}
        open={Boolean(selectedUser)}
        user={selectedUser}
        isSaving={isSavingUser}
        saveError={saveError}
        onClose={closeDialog}
        onSave={handleSave}
      />
      <DeleteConfirmDialog
        open={Boolean(deleteUser)}
        user={deleteUser}
        isDeleting={isDeletingUser}
        error={deleteError}
        onClose={closeDeleteDialog}
        onConfirm={confirmDelete}
      />
    </Stack>
  )
}

function StatusChip({ status }) {
  const isActive = status === 'ใช้งาน'

  return (
    <Chip
      label={status}
      size="small"
      variant="outlined"
      sx={{
        bgcolor: 'background.paper',
        borderColor: isActive ? '#86efac' : '#fca5a5',
        color: isActive ? '#166534' : '#991b1b',
        fontWeight: 300,
      }}
    />
  )
}

function UserPermissionDialog({ mode, open, user, isSaving = false, saveError = '', onClose, onSave }) {
  const isAddMode = mode === 'add'
  const title = isAddMode ? 'เพิ่มผู้ใช้งาน' : 'แก้ไขสิทธิ์การใช้งาน'
  const selectedRoleValue =
    user?.roleCode ?? roleOptions.find((role) => role.label === user?.role)?.value ?? roleOptions[0].value
  const dialogRoleOptions = roleOptions.some((role) => role.value === selectedRoleValue)
    ? roleOptions
    : [
        ...roleOptions,
        {
          label: user?.role ?? selectedRoleValue,
          value: selectedRoleValue,
        },
      ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      slotProps={{
        paper: {
          component: 'form',
          onSubmit: (event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            const statusValue = String(formData.get('status') ?? statusOptions[0].value)
            const baseUserPayload = {
              fullName: String(formData.get('fullName') ?? '').trim(),
              username: String(formData.get('username') ?? '').trim(),
              department: emptyToNull(formData.get('department')),
              lineNameTh: emptyToNull(formData.get('lineNameTh')),
              levelNameTh: emptyToNull(formData.get('levelNameTh')),
              roles: String(formData.get('roles') ?? roleOptions[0].value),
              isActive: statusValue === 'active',
            }
            const payload = isAddMode
              ? {
                  ...baseUserPayload,
                  department: baseUserPayload.department ?? '',
                  lineNameTh: baseUserPayload.lineNameTh ?? '',
                  levelNameTh: baseUserPayload.levelNameTh ?? '',
                  password: String(formData.get('password') ?? ''),
                }
              : {
                  user: {
                    ...baseUserPayload,
                    password: String(formData.get('password') ?? ''),
                    source: user?.source ?? 'created',
                  },
                  permissions: buildPermissionsFromForm(formData, user?.permissions),
                }

            onSave?.(payload)
          },
          sx: {
            borderRadius: 2,
            m: { xs: 1.5, sm: 3 },
            maxHeight: { xs: 'calc(100dvh - 24px)', sm: 'calc(100dvh - 48px)' },
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" component="span" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isAddMode ? 'กรอกข้อมูลผู้ใช้งาน' : user?.username}
            </Typography>
          </Box>
          <IconButton aria-label="ปิด" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ p: { xs: 2, md: 3 } }}>
        <Stack key={`${mode}-${user?.id ?? 'new'}-${user?.detailVersion ?? 0}`} spacing={3}>
          {user?.isLoadingDetail ? (
            <Alert
              severity="info"
              icon={<CircularProgress size={18} />}
              sx={{ alignItems: 'center' }}
            >
              กำลังโหลดข้อมูลสิทธิ์ผู้ใช้งาน
            </Alert>
          ) : null}
          {user?.detailError ? <Alert severity="warning">{user.detailError}</Alert> : null}
          {saveError ? <Alert severity="error">{saveError}</Alert> : null}

          <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
            <Stack spacing={2}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                ข้อมูลพื้นฐาน
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                }}
              >
                <TextField
                  label="Username"
                  name="username"
                  defaultValue={user?.username}
                  required
                  fullWidth
                />
                <TextField
                  label="Password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required={isAddMode}
                  slotProps={{
                    htmlInput: {
                      minLength: isAddMode ? 8 : undefined,
                    },
                  }}
                  helperText={isAddMode ? 'อย่างน้อย 8 ตัวอักษร' : undefined}
                  fullWidth
                />
                <TextField
                  label="ชื่อ-นามสกุล"
                  name="fullName"
                  defaultValue={user?.fullName}
                  required
                  fullWidth
                />
                <TextField
                  label="สังกัด"
                  name="department"
                  defaultValue={user?.affiliation}
                  fullWidth
                />
                <TextField
                  label="ตำแหน่ง"
                  name="lineNameTh"
                  defaultValue={user?.position}
                  fullWidth
                />
                <TextField
                  label="ระดับ"
                  name="levelNameTh"
                  defaultValue={user?.level}
                  fullWidth
                />
                <FormControl fullWidth required>
                  <InputLabel id="system-role-label">สิทธิ์ในระบบ</InputLabel>
                  <Select
                    labelId="system-role-label"
                    label="สิทธิ์ในระบบ"
                    name="roles"
                    defaultValue={selectedRoleValue}
                  >
                    {dialogRoleOptions.map((role) => (
                      <MenuItem key={role.value} value={role.value}>
                        {role.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth required>
                  <InputLabel id="status-label">สถานะ</InputLabel>
                  <Select
                    labelId="status-label"
                    label="สถานะ"
                    name="status"
                    defaultValue={user?.statusValue ?? statusOptions[0].value}
                  >
                    {statusOptions.map((status) => (
                      <MenuItem key={status.value} value={status.value}>
                        {status.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Stack>
          </Paper>

          {isAddMode
            ? null
            : permissionSections.map((section) => (
                <PermissionSection key={section.title} section={section} permissions={user?.permissions} />
              ))}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose} color="inherit">
          ยกเลิก
        </Button>
        <Button
          type="submit"
          variant="contained"
          startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
          disabled={isSaving || user?.isLoadingDetail}
        >
          {isSaving ? 'กำลังบันทึก' : 'บันทึก'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function DeleteConfirmDialog({ open, user, isDeleting = false, error = '', onClose, onConfirm }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h5" component="span" sx={{ fontWeight: 600 }}>
          ยืนยันการลบ
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography color="text.secondary">
            ต้องการลบผู้ใช้งาน {user?.username} ใช่หรือไม่
          </Typography>
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose} color="inherit" disabled={isDeleting}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          color="error"
          startIcon={isDeleting ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />}
          disabled={isDeleting}
          onClick={onConfirm}
        >
          {isDeleting ? 'กำลังลบ' : 'ลบ'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function getScopeValue(value) {
  if (value === null || value === undefined) {
    return 'NONE'
  }

  return value
}

function getLocationScopeValue(value) {
  return value ?? 'all'
}

function isActionChecked(permission, action) {
  if (Array.isArray(action)) {
    return action.some((item) => permission?.[item] === true)
  }

  return permission?.[action] === true
}

function PermissionSection({ section, permissions = {} }) {
  const permission = permissions?.[section.permissionKey]
  const [scopeValue, setScopeValue] = useState(getScopeValue(permission?.data))
  const [regionValue, setRegionValue] = useState(getLocationScopeValue(permission?.region))
  const [provinceValue, setProvinceValue] = useState(getLocationScopeValue(permission?.province))
  const isRegionEnabled = scopeValue === 'IN_REGION'
  const isProvinceEnabled = scopeValue === 'IN_PROVINCE'

  useEffect(() => {
    setScopeValue(getScopeValue(permission?.data))
    setRegionValue(getLocationScopeValue(permission?.region))
    setProvinceValue(getLocationScopeValue(permission?.province))
  }, [permission?.data, permission?.province, permission?.region])

  const handleScopeChange = (event) => {
    const nextScope = event.target.value
    setScopeValue(nextScope)
    if (nextScope !== 'IN_REGION') {
      setRegionValue('all')
    }
    if (nextScope !== 'IN_PROVINCE') {
      setProvinceValue('all')
    }
  }

  return (
    <Box
      sx={{
        p: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
      }}
    >
      <Stack spacing={1.5}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {section.title}
        </Typography>
        <Divider />
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          <FormControl fullWidth size="small">
            <InputLabel id={`${section.title}-scope-label`}>ข้อมูล</InputLabel>
            <Select
              labelId={`${section.title}-scope-label`}
              label="ข้อมูล"
              name={`permission.${section.permissionKey}.data`}
              value={scopeValue}
              onChange={handleScopeChange}
            >
              {scopeOptions.map((scope) => (
                <MenuItem key={scope.value} value={scope.value}>
                  {scope.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {section.locationScope ? (
            <FormControl fullWidth size="small">
              <InputLabel id={`${section.title}-region-label`}>ภาค</InputLabel>
              <Select
                labelId={`${section.title}-region-label`}
                label="ภาค"
                name={`permission.${section.permissionKey}.region`}
                value={regionValue}
                onChange={(event) => setRegionValue(event.target.value)}
                disabled={!isRegionEnabled}
              >
                {regionOptions.map((region) => (
                  <MenuItem key={region.value} value={region.value}>
                    {region.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
          {section.locationScope ? (
            <FormControl fullWidth size="small">
              <InputLabel id={`${section.title}-province-label`}>จังหวัด</InputLabel>
              <Select
                labelId={`${section.title}-province-label`}
                label="จังหวัด"
                name={`permission.${section.permissionKey}.province`}
                value={provinceValue}
                onChange={(event) => setProvinceValue(event.target.value)}
                disabled={!isProvinceEnabled}
              >
                {provinceOptions.map((province) => (
                  <MenuItem key={province.value} value={province.value}>
                    {province.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
        </Box>
        <Box
          sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          {section.permissions.map((item) => (
            <FormControlLabel
              key={item.label}
              control={
                <Checkbox
                  name={`permission.${section.permissionKey}.${item.name ?? item.label}`}
                  defaultChecked={isActionChecked(permission, item.action)}
                />
              }
              label={item.label}
              sx={{
                minHeight: 40,
                m: 0,
                '& .MuiFormControlLabel-label': {
                  fontSize: 14,
                },
              }}
            />
          ))}
        </Box>
      </Stack>
    </Box>
  )
}

export default PermissionManagementPage
