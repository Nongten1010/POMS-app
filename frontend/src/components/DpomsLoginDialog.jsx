import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import BusinessIcon from '@mui/icons-material/Business'
import LoginIcon from '@mui/icons-material/Login'
import PersonIcon from '@mui/icons-material/Person'
import PersonAddIcon from '@mui/icons-material/PersonAdd'

const officerTypes = [
  { label: 'สำนักงานปลัดกระทรวงอุตสาหกรรม', value: '1' },
  { label: 'กรมโรงงานอุตสาหกรรม', value: '2' },
  { label: 'การนิคมอุตสาหกรรมแห่งประเทศไทย', value: '8' },
  { label: 'หน่วยงานอื่นๆ', value: '0' },
]

const publicUserTypes = [
  { label: 'ประชาชนทั่วไป', value: 'citizen' },
  { label: 'ผู้ประกอบการ', value: 'operator' },
]

const loginUrl = import.meta.env.DEV
  ? '/api-proxy/v1/auth/login'
  : 'https://d-poms.diw.go.th/api/v1/auth/login'

function formatLoginError(result, response) {
  const statusLabel = [result.status, result.statusText].filter(Boolean).join(' ')
  const message =
    response?.error?.message ??
    response?.message ??
    response?.error ??
    'เข้าสู่ระบบไม่สำเร็จ'

  return statusLabel ? `${statusLabel} - ${message}` : message
}

function DpomsLoginDialog({ open, onClose, onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState(0)
  const [departmentID, setDepartmentID] = useState(officerTypes[0].value)
  const [publicUserType, setPublicUserType] = useState(publicUserTypes[0].value)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isOfficer = activeTab === 1

  const handleSubmit = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const username = String(formData.get('username') ?? '').trim()
    const password = String(formData.get('password') ?? '')
    const userType = isOfficer ? 'officer' : publicUserType
    const requestBody = {
      userType,
      username,
      password,
      ...(isOfficer ? { departmentID } : {}),
    }

    setError('')
    setIsSubmitting(true)

    try {
      const result = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
      const rawText = await result.text()
      let response = rawText

      try {
        response = rawText ? JSON.parse(rawText) : null
      } catch {
        response = rawText
      }

      if (!result.ok) {
        throw new Error(formatLoginError(result, response))
      }

      onLoginSuccess?.({
        userType,
        departmentID: isOfficer ? departmentID : null,
        publicUserType: isOfficer ? null : publicUserType,
        username,
        response,
      })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={false}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          component: 'form',
          onSubmit: handleSubmit,
          sx: {
            borderRadius: 2,
            m: { xs: 2, sm: 4 },
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack spacing={0.5}>
          <Typography variant="h5" component="span" sx={{ fontWeight: 600 }}>
            เข้าสู่ระบบ
          </Typography>
          <Typography variant="body2" color="text.secondary">
            เลือกประเภทผู้ใช้งานเพื่อเข้าสู่ระบบ D-POMS
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2.5}>
          <Tabs
            value={activeTab}
            onChange={(_, value) => setActiveTab(value)}
            variant="fullWidth"
            aria-label="ประเภทการเข้าสู่ระบบ"
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              minHeight: 44,
              '& .MuiTab-root': {
                minHeight: 44,
                fontWeight: 300,
                lineHeight: 1.2,
              },
            }}
          >
            <Tab
              icon={<PersonIcon />}
              iconPosition="start"
              label={
                <Box component="span" sx={{ textAlign: 'center' }}>
                  ประชาชนทั่วไป
                  <Box component="span" sx={{ display: 'block' }}>
                    ผู้ประกอบการ
                  </Box>
                </Box>
              }
            />
            <Tab icon={<BusinessIcon />} iconPosition="start" label="เจ้าหน้าที่" />
          </Tabs>

          <Alert
            severity="info"
            variant="outlined"
            sx={{
              bgcolor: 'primary.50',
              borderColor: 'primary.200',
            }}
          >
            {isOfficer
              ? 'เข้าสู่ระบบด้วยรหัส i-Industry หรือ กรมโรงงาน (U)'
              : 'เข้าสู่ระบบด้วยรหัส i-Industry'}
          </Alert>

          {error ? (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          ) : null}

          {isOfficer ? (
            <FormControl fullWidth required>
              <InputLabel id="officer-type-label">ประเภทหน่วยงาน</InputLabel>
              <Select
                labelId="officer-type-label"
                value={departmentID}
                label="ประเภทหน่วยงาน"
                onChange={(event) => setDepartmentID(event.target.value)}
              >
                {officerTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <FormControl fullWidth required>
              <InputLabel id="public-user-type-label">ประเภทผู้ใช้งาน</InputLabel>
              <Select
                labelId="public-user-type-label"
                value={publicUserType}
                label="ประเภทผู้ใช้งาน"
                onChange={(event) => setPublicUserType(event.target.value)}
              >
                {publicUserTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            }}
          >
            <TextField
              label={isOfficer ? 'เลขบัตรประจำตัวประชาชน หรือ U' : 'เลขบัตรประจำตัวประชาชน'}
              name="username"
              autoComplete="username"
              required
              fullWidth
            />
            <TextField
              label="รหัสผ่าน"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              fullWidth
            />
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexWrap: 'wrap' }}>
        {!isOfficer ? (
          <Button
            component="a"
            href="https://i.industry.go.th"
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            startIcon={<PersonAddIcon />}
          >
            ลงทะเบียน
          </Button>
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} color="inherit">
          ยกเลิก
        </Button>
        <Button
          type="submit"
          variant="contained"
          startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <LoginIcon />}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'กำลังเข้าสู่ระบบ' : 'เข้าสู่ระบบ'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DpomsLoginDialog
