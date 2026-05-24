import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Chip,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
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
import SearchIcon from '@mui/icons-material/Search'
import { roleOptions, statusOptions, systemUsers } from '../datas/users.sample'

const scopeOptions = ['ทั้งหมด', 'จังหวัด', 'นิคม', 'ไม่อนุญาต']

const permissionSections = [
  {
    title: 'หน้าหลัก',
    scope: true,
    permissions: ['ข้อมูลปัจจุบัน', 'Favorite', 'การค้นหา', 'การค้นหาขั้นสูง', 'สถิติ / Export'],
  },
  {
    title: 'ข้อมูลพื้นฐาน',
    scope: true,
    permissions: ['การแก้ไข', 'อนุมัติ/อนุญาต'],
  },
  {
    title: 'ขอเชื่อมต่อ',
    scope: true,
    permissions: ['การแก้ไข', 'อนุมัติ/อนุญาต'],
  },
  {
    title: 'แจ้งแบบ กวภ. 01 - กวภ. 05',
    scope: true,
    permissions: ['การแก้ไข', 'อนุมัติ/อนุญาต'],
  },
  {
    title: 'รายงานค่าความคลาดเคลื่อน BOD/COD Online',
    scope: true,
    permissions: ['การแก้ไข', 'อนุมัติ/อนุญาต'],
  },
  {
    title: 'การแจ้งเตือน',
    scope: true,
    permissions: ['สถานะการแจ้งเตือน', 'อนุมัติ/อนุญาต'],
  },
  { title: 'สถิติข้อมูล', permissions: ['มีสิทธิ์ใช้งาน'] },
  { title: 'การสืบค้นข้อมูลแบบมีเงื่อนไข', permissions: ['มีสิทธิ์ใช้งาน'] },
  { title: 'แจ้งขอความช่วยเหลือ', permissions: ['มีสิทธิ์ใช้งาน'] },
  { title: 'ข้อเสนอแนะ', permissions: ['มีสิทธิ์ใช้งาน'] },
  { title: 'กฎหมายที่เกี่ยวข้อง', permissions: ['มีสิทธิ์ใช้งาน', 'การแก้ไข'] },
  { title: 'คำถามที่พบบ่อย', permissions: ['มีสิทธิ์ใช้งาน', 'การแก้ไข'] },
  { title: 'Chat', permissions: ['มีสิทธิ์ใช้งาน', 'ตอบคำถาม (Admin)'] },
  { title: 'จัดการสิทธิ์การใช้งาน', permissions: ['มีสิทธิ์ใช้งาน (Admin)'] },
  { title: 'จัดการโรงงานที่เข้าข่าย (Admin)', permissions: ['มีสิทธิ์ใช้งาน (Admin)'] },
  { title: 'API Documentation', permissions: ['มีสิทธิ์ใช้งาน'] },
]

const defaultUser = {
  username: '',
  fullName: '',
  affiliation: '',
  position: '',
  level: '',
  password: '',
  role: 'กรอ.',
  status: 'ใช้งาน',
}

function PermissionManagementPage() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [dialogMode, setDialogMode] = useState('edit')
  const [selectedUser, setSelectedUser] = useState(null)
  const [deleteUser, setDeleteUser] = useState(null)
  const [snackbarOpen, setSnackbarOpen] = useState(false)

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return systemUsers
    }

    return systemUsers.filter((user) => {
      return (
        user.username.toLowerCase().includes(normalizedQuery) ||
        user.fullName.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [query])

  const pagedUsers = useMemo(() => {
    const start = page * rowsPerPage
    return filteredUsers.slice(start, start + rowsPerPage)
  }, [filteredUsers, page, rowsPerPage])

  const openAddDialog = () => {
    setDialogMode('add')
    setSelectedUser(defaultUser)
  }

  const openEditDialog = (user) => {
    setDialogMode('edit')
    setSelectedUser(user)
  }

  const openDeleteDialog = (user) => {
    setDeleteUser(user)
  }

  const closeDialog = () => {
    setSelectedUser(null)
  }

  const closeDeleteDialog = () => {
    setDeleteUser(null)
  }

  const confirmDelete = () => {
    setDeleteUser(null)
  }

  const handleSave = () => {
    setSelectedUser(null)
    setSnackbarOpen(true)
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
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          สิทธิ์การใช้งาน
        </Typography>
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
                Saved successfully
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
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                รายชื่อเจ้าหน้าที่ในระบบ
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ทั้งหมด {systemUsers.length.toLocaleString()} รายชื่อ
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>
              เพิ่มผู้ใช้งาน
            </Button>
          </Stack>

          <TextField
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(0)
            }}
            placeholder="ค้นหา Username หรือ ชื่อ-นามสกุล"
            label="ค้นหา"
            fullWidth
            slotProps={{
              input: {
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              },
            }}
          />

          <TableContainer
            sx={{
              flex: 1,
              minHeight: 0,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <Table stickyHeader size="small" aria-label="รายชื่อเจ้าหน้าที่ในระบบ">
              <TableHead>
                <TableRow>
                  <TableCell>Username</TableCell>
                  <TableCell>ชื่อ-นามสกุล</TableCell>
                  <TableCell>สังกัด</TableCell>
                  <TableCell>ตำแหน่ง</TableCell>
                  <TableCell>ระดับ</TableCell>
                  <TableCell>สิทธิ์ในระบบ</TableCell>
                  <TableCell>สถานะ</TableCell>
                  <TableCell align="right">Option</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedUsers.map((user) => (
                  <TableRow hover key={user.id}>
                    <TableCell sx={{ fontWeight: 300, whiteSpace: 'nowrap' }}>{user.username}</TableCell>
                    <TableCell sx={{ minWidth: 160 }}>{user.fullName}</TableCell>
                    <TableCell sx={{ minWidth: 220 }}>{user.affiliation}</TableCell>
                    <TableCell sx={{ minWidth: 160 }}>{user.position}</TableCell>
                    <TableCell sx={{ minWidth: 120 }}>{user.level}</TableCell>
                    <TableCell>
                      <Chip label={user.role} size="small" variant="outlined" sx={{ fontWeight: 300 }} />
                    </TableCell>
                    <TableCell>
                      <StatusChip status={user.status} />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Edit">
                        <IconButton aria-label={`แก้ไข ${user.username}`} onClick={() => openEditDialog(user)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          aria-label={`ลบ ${user.username}`}
                          color="error"
                          onClick={() => openDeleteDialog(user)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={filteredUsers.length}
            page={page}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[25, 50, 100]}
            labelRowsPerPage="แถวต่อหน้า"
            onPageChange={(_, nextPage) => setPage(nextPage)}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(Number(event.target.value))
              setPage(0)
            }}
          />
        </Stack>
      </Paper>

      <UserPermissionDialog
        mode={dialogMode}
        open={Boolean(selectedUser)}
        user={selectedUser}
        onClose={closeDialog}
        onSave={handleSave}
      />
      <DeleteConfirmDialog
        open={Boolean(deleteUser)}
        user={deleteUser}
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

function UserPermissionDialog({ mode, open, user, onClose, onSave }) {
  const isAddMode = mode === 'add'
  const title = isAddMode ? 'เพิ่มผู้ใช้งาน' : 'แก้ไขสิทธิ์การใช้งาน'

  return (
    <Dialog
      key={`${mode}-${user?.id ?? 'new'}`}
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      slotProps={{
        paper: {
          component: 'form',
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
              {isAddMode ? 'กรอกข้อมูลผู้ใช้งานและกำหนดสิทธิ์เริ่มต้น' : user?.username}
            </Typography>
          </Box>
          <IconButton aria-label="ปิด" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={3}>
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
                <TextField label="Username" defaultValue={user?.username} disabled={!isAddMode} fullWidth />
                <TextField label="Password" type="password" autoComplete="new-password" fullWidth />
                <TextField label="ชื่อ-นามสกุล" defaultValue={user?.fullName} disabled={!isAddMode} fullWidth />
                <TextField label="สังกัด" defaultValue={user?.affiliation} disabled={!isAddMode} fullWidth />
                <TextField label="ตำแหน่ง" defaultValue={user?.position} disabled={!isAddMode} fullWidth />
                <TextField label="ระดับ" defaultValue={user?.level} disabled fullWidth />
                <FormControl fullWidth>
                  <InputLabel id="system-role-label">สิทธิ์ในระบบ</InputLabel>
                  <Select
                    labelId="system-role-label"
                    label="สิทธิ์ในระบบ"
                    defaultValue={user?.role ?? roleOptions[0]}
                  >
                    {roleOptions.map((role) => (
                      <MenuItem key={role} value={role}>
                        {role}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel id="status-label">สถานะ</InputLabel>
                  <Select labelId="status-label" label="สถานะ" defaultValue={user?.status ?? statusOptions[0]}>
                    {statusOptions.map((status) => (
                      <MenuItem key={status} value={status}>
                        {status}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Stack>
          </Paper>

          {permissionSections.map((section) => (
            <PermissionSection key={section.title} section={section} />
          ))}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose} color="inherit">
          ยกเลิก
        </Button>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={onSave}>
          บันทึก
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function DeleteConfirmDialog({ open, user, onClose, onConfirm }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h5" component="span" sx={{ fontWeight: 600 }}>
          ยืนยันการลบ
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Typography color="text.secondary">
          ต้องการลบผู้ใช้งาน {user?.username} ใช่หรือไม่
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose} color="inherit">
          ยกเลิก
        </Button>
        <Button variant="contained" color="error" startIcon={<DeleteIcon />} onClick={onConfirm}>
          ลบ
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function PermissionSection({ section }) {
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
          {section.scope ? (
            <FormControl fullWidth size="small">
              <InputLabel id={`${section.title}-scope-label`}>ข้อมูล</InputLabel>
              <Select
                labelId={`${section.title}-scope-label`}
                label="ข้อมูล"
                defaultValue={section.title === 'หน้าหลัก' ? 'ทั้งหมด' : 'จังหวัด'}
              >
                {scopeOptions.map((scope) => (
                  <MenuItem key={scope} value={scope}>
                    {scope}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
          {section.permissions.map((permission, index) => (
            <FormControlLabel
              key={permission}
              control={<Checkbox defaultChecked={index === 0} />}
              label={permission}
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
