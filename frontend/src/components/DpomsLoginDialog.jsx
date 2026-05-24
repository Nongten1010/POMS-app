import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
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
  'สำนักงานปลัดกระทรวงอุตสาหกรรม',
  'กรมโรงงานอุตสาหกรรม',
  'การนิคมแห่งประเทศไทย',
]

const publicUserTypes = ['ประชาชนทั่วไป', 'เจ้าหน้าที่']

function DpomsLoginDialog({ open, onClose, onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState(0)
  const [officerType, setOfficerType] = useState(officerTypes[0])
  const [publicUserType, setPublicUserType] = useState(publicUserTypes[0])

  const isOfficer = activeTab === 1

  const handleSubmit = (event) => {
    event.preventDefault()
    onLoginSuccess?.({
      userType: isOfficer ? 'officer' : 'public',
      officerType: isOfficer ? officerType : null,
      publicUserType: isOfficer ? null : publicUserType,
    })
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

          {isOfficer ? (
            <FormControl fullWidth required>
              <InputLabel id="officer-type-label">ประเภทหน่วยงาน</InputLabel>
              <Select
                labelId="officer-type-label"
                value={officerType}
                label="ประเภทหน่วยงาน"
                onChange={(event) => setOfficerType(event.target.value)}
              >
                {officerTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
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
                  <MenuItem key={type} value={type}>
                    {type}
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
        <Button type="submit" variant="contained" startIcon={<LoginIcon />}>
          เข้าสู่ระบบ
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DpomsLoginDialog
