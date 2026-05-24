import { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import CancelIcon from '@mui/icons-material/Cancel'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import EditIcon from '@mui/icons-material/Edit'
import InfoIcon from '@mui/icons-material/Info'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import SaveIcon from '@mui/icons-material/Save'
import SendIcon from '@mui/icons-material/Send'
import WarningIcon from '@mui/icons-material/Warning'
import DpomsAppBar from './components/DpomsAppBar'
import DpomsLoginDialog from './components/DpomsLoginDialog'
import DpomsSidebar from './components/DpomsSidebar'
import PermissionManagementPage from './pages/PermissionManagementPage'

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [selectedMenu, setSelectedMenu] = useState('home')

  const primaryColors = [
    ['50', '#eef6ff'],
    ['100', '#d9ebff'],
    ['200', '#b8dcff'],
    ['300', '#8cc8ff'],
    ['400', '#5aa9f5'],
    ['500', '#2f80ed'],
    ['600', '#1f6feb'],
    ['700', '#185abc'],
    ['800', '#174a94'],
    ['900', '#153f7a'],
  ]
  const secondaryColors = [
    ['50', '#ecfdf3'],
    ['100', '#d1fae0'],
    ['200', '#a7f3c1'],
    ['300', '#6ee798'],
    ['400', '#39d474'],
    ['500', '#20b85a'],
    ['600', '#16a34a'],
    ['700', '#15803d'],
    ['800', '#166534'],
    ['900', '#14532d'],
  ]
  const neutralColors = [
    ['0', '#ffffff'],
    ['50', '#f8fafc'],
    ['100', '#f1f5f9'],
    ['200', '#e2e8f0'],
    ['300', '#cbd5e1'],
    ['400', '#94a3b8'],
    ['500', '#64748b'],
    ['600', '#475569'],
    ['700', '#334155'],
    ['800', '#1e293b'],
    ['900', '#0f172a'],
  ]
  const statusGroups = [
    {
      title: 'Success',
      description: 'เชื่อมต่อแล้ว, ผ่าน, อนุมัติ, ยื่นแบบสำเร็จ, ส่งแล้ว',
      bg: '#dcfce7',
      border: '#86efac',
      text: '#166534',
      labels: ['เชื่อมต่อแล้ว', 'ผ่าน', 'อนุมัติ', 'ยื่นแบบสำเร็จ', 'ส่งแล้ว'],
    },
    {
      title: 'Pending Review',
      description: 'รอพิจารณาแบบ, รอพิจารณา, รอดำเนินการ',
      bg: '#fef3c7',
      border: '#fcd34d',
      text: '#92400e',
      labels: ['รอพิจารณาแบบ', 'รอพิจารณา', 'รอดำเนินการ'],
    },
    {
      title: 'Revised Review',
      description: 'แก้ไขแล้ว/รอพิจารณาแบบ',
      bg: '#e0f2fe',
      border: '#7dd3fc',
      text: '#075985',
      labels: ['แก้ไขแล้ว/รอพิจารณาแบบ'],
    },
    {
      title: 'Waiting Connection',
      description: 'รอเชื่อมต่อ',
      bg: '#ede9fe',
      border: '#c4b5fd',
      text: '#5b21b6',
      labels: ['รอเชื่อมต่อ'],
    },
    {
      title: 'Action Required',
      description: 'รอโรงงานแก้ไข, แก้ไข',
      bg: '#ffedd5',
      border: '#fdba74',
      text: '#9a3412',
      labels: ['รอโรงงานแก้ไข', 'แก้ไข'],
    },
    {
      title: 'Rejected',
      description: 'ยกเลิก, ไม่ผ่าน, ไม่อนุมัติ, ไม่ส่ง',
      bg: '#fee2e2',
      border: '#fca5a5',
      text: '#991b1b',
      labels: ['ยกเลิก', 'ไม่ผ่าน', 'ไม่อนุมัติ', 'ไม่ส่ง'],
    },
  ]
  const actionTypes = [
    {
      title: 'Information',
      description: 'ใช้กับการดูรายละเอียด เปิดข้อมูล หรือไปหน้ารายการที่เกี่ยวข้อง',
      label: 'ดูรายละเอียด',
      icon: <InfoIcon />,
      main: '#2563eb',
      hover: '#1d4ed8',
      subtle: '#dbeafe',
      text: '#1e40af',
    },
    {
      title: 'Confirm',
      description: 'ใช้กับการยืนยัน อนุมัติ ผ่าน หรือบันทึกผลที่เป็นบวก',
      label: 'อนุมัติ',
      icon: <CheckCircleIcon />,
      main: '#16a34a',
      hover: '#15803d',
      subtle: '#dcfce7',
      text: '#166534',
    },
    {
      title: 'Reject',
      description: 'ใช้กับไม่อนุมัติ ไม่ผ่าน ไม่ส่งคืน หรือการปฏิเสธผลพิจารณา',
      label: 'ไม่อนุมัติ',
      icon: <CancelIcon />,
      main: '#dc2626',
      hover: '#b91c1c',
      subtle: '#fee2e2',
      text: '#991b1b',
    },
    {
      title: 'Warning',
      description: 'ใช้กับการเตือน ส่งกลับแก้ไข หรือ action ที่ต้องคิดก่อนกด',
      label: 'ส่งกลับแก้ไข',
      icon: <WarningIcon />,
      main: '#d97706',
      hover: '#b45309',
      subtle: '#fef3c7',
      text: '#92400e',
    },
    {
      title: 'Submit',
      description: 'ใช้กับการยื่นแบบ ส่งข้อมูล หรือส่งให้ระบบปลายทาง',
      label: 'ยื่นแบบ',
      icon: <SendIcon />,
      main: '#0f766e',
      hover: '#115e59',
      subtle: '#ccfbf1',
      text: '#134e4a',
    },
    {
      title: 'Draft / Edit',
      description: 'ใช้กับบันทึกร่าง แก้ไขข้อมูล หรือ action ที่ยังไม่ final',
      label: 'บันทึกร่าง',
      icon: <SaveIcon />,
      secondaryIcon: <EditIcon />,
      main: '#64748b',
      hover: '#475569',
      subtle: '#f1f5f9',
      text: '#334155',
    },
  ]

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DpomsAppBar
        isAuthenticated={Boolean(currentUser)}
        user={currentUser ?? undefined}
        onMenuToggle={() => setIsMenuOpen((current) => !current)}
        onLogin={() => setIsLoginOpen(true)}
      />
      <DpomsSidebar
        open={isMenuOpen}
        selectedValue={selectedMenu}
        onSelect={setSelectedMenu}
        onClose={() => setIsMenuOpen(false)}
      />
      <DpomsLoginDialog
        open={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={({ userType, officerType }) => {
          setCurrentUser({
            name: userType === 'officer' ? 'เจ้าหน้าที่ D-POMS' : 'ผู้ใช้งาน i-Industry',
            role: userType === 'officer' ? officerType : 'ประชาชนทั่วไป / ผู้ประกอบการ',
          })
          setIsLoginOpen(false)
        }}
      />

      <Container
        maxWidth={false}
        sx={{
          width: '100%',
          ...(selectedMenu === 'permissions'
            ? {
                height: { xs: 'calc(100dvh - 64px)', md: 'calc(100dvh - 72px)' },
                overflow: 'hidden',
                p: { xs: 1.5, md: 2 },
              }
            : {
                py: { xs: 4, md: 6 },
              }),
        }}
      >
        {selectedMenu === 'permissions' ? (
          <PermissionManagementPage />
        ) : (
        <Stack spacing={4}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 5 },
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Stack spacing={3} sx={{ alignItems: 'flex-start' }}>
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                sx={{ flexWrap: 'wrap' }}
              >
                <Chip label="Primary #1F6FEB" color="primary" />
                <Chip label="Secondary #16A34A" color="secondary" />
                <Chip label="Neutral #0F172A" variant="outlined" />
              </Stack>

              <Box>
                <Typography variant="h3" component="h1" gutterBottom>
                  D-POMS color system
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ maxWidth: 720 }}
                >
                  A practical palette for operational screens: clear primary actions,
                  calm success states, and neutral surfaces for tables, forms, and cards.
                </Typography>
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" startIcon={<RocketLaunchIcon />}>
                  Primary action
                </Button>
                <Button variant="contained" color="secondary" startIcon={<CheckCircleIcon />}>
                  Confirm
                </Button>
                <Button variant="outlined">Secondary action</Button>
              </Stack>
            </Stack>
          </Paper>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 4 }}>
              <PaletteCard
                title="Primary Colors"
                description="Use for main actions, active navigation, links, and focused states."
                colors={primaryColors}
              />
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <PaletteCard
                title="Secondary Colors"
                description="Use for positive status, confirmation actions, and supporting accents."
                colors={secondaryColors}
              />
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <PaletteCard
                title="Neutral Colors"
                description="Use for backgrounds, borders, text hierarchy, and dense content surfaces."
                colors={neutralColors}
              />
            </Grid>
          </Grid>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
              <Grid size={{ xs: 12, md: 4 }}>
                <UsageBlock
                  label="Page background"
                  value="#F8FAFC"
                  sx={{ bgcolor: 'neutral.50', borderColor: 'neutral.200' }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <UsageBlock
                  label="Card surface"
                  value="#FFFFFF"
                  sx={{ bgcolor: 'background.paper', borderColor: 'neutral.200' }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <UsageBlock
                  label="Primary text"
                  value="#0F172A"
                  sx={{ bgcolor: 'neutral.900', color: 'neutral.0', borderColor: 'neutral.900' }}
                />
              </Grid>
            </Grid>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="h5" gutterBottom>
                  Status Colors
                </Typography>
                <Typography color="text.secondary">
                  Color mapping for application states, designed for chips, badges, table
                  statuses, and approval workflow labels.
                </Typography>
              </Box>

              <Grid container spacing={2}>
                {statusGroups.map((group) => (
                  <Grid key={group.title} size={{ xs: 12, md: 6, lg: 4 }}>
                    <StatusCard group={group} />
                  </Grid>
                ))}
              </Grid>
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="h5" gutterBottom>
                  Action Type Buttons
                </Typography>
                <Typography color="text.secondary">
                  Button color examples by action intent. Use contained for primary
                  workflow actions, outlined for secondary actions, and text for low-emphasis
                  actions.
                </Typography>
              </Box>

              <Grid container spacing={2}>
                {actionTypes.map((action) => (
                  <Grid key={action.title} size={{ xs: 12, md: 6, lg: 4 }}>
                    <ActionTypeCard action={action} />
                  </Grid>
                ))}
              </Grid>
            </Stack>
          </Paper>
        </Stack>
        )}
      </Container>
    </Box>
  )
}

function PaletteCard({ title, description, colors }) {
  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        p: 3,
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Stack spacing={2} sx={{ height: '100%' }}>
        <Box>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Typography color="text.secondary">{description}</Typography>
        </Box>
        <Divider />
        <Stack spacing={1}>
          {colors.map(([label, color]) => (
            <ColorRow key={label} label={label} color={color} />
          ))}
        </Stack>
      </Stack>
    </Paper>
  )
}

function ColorRow({ label, color }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
      <Box
        sx={{
          width: 44,
          height: 32,
          flex: '0 0 auto',
          borderRadius: 1,
          bgcolor: color,
          border: 1,
          borderColor: 'divider',
        }}
      />
      <Typography variant="body2" sx={{ minWidth: 36, fontWeight: 300 }}>
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
        {color}
      </Typography>
    </Stack>
  )
}

function UsageBlock({ label, value, sx }) {
  return (
    <Box
      sx={{
        height: '100%',
        p: 2.5,
        border: 1,
        borderRadius: 1,
        ...sx,
      }}
    >
      <Typography variant="overline" sx={{ opacity: 0.78 }}>
        {label}
      </Typography>
      <Typography variant="h6">{value}</Typography>
    </Box>
  )
}

function StatusCard({ group }) {
  return (
    <Box
      sx={{
        height: '100%',
        p: 2,
        border: 1,
        borderColor: group.border,
        borderRadius: 1,
        bgcolor: group.bg,
      }}
    >
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="subtitle1" sx={{ color: group.text, fontWeight: 600 }}>
            {group.title}
          </Typography>
          <Typography variant="body2" sx={{ color: group.text, opacity: 0.84 }}>
            {group.description}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {group.labels.map((label) => (
            <Chip
              key={label}
              label={label}
              size="small"
              sx={{
                borderColor: group.border,
                bgcolor: 'background.paper',
                color: group.text,
                fontWeight: 300,
              }}
              variant="outlined"
            />
          ))}
        </Stack>

        <Typography variant="caption" sx={{ color: group.text, fontFamily: 'monospace' }}>
          {group.bg} / {group.border} / {group.text}
        </Typography>
      </Stack>
    </Box>
  )
}

function ActionTypeCard({ action }) {
  return (
    <Box
      sx={{
        height: '100%',
        p: 2,
        border: 1,
        borderColor: action.subtle,
        borderRadius: 1,
        bgcolor: 'background.paper',
      }}
    >
      <Stack spacing={1.75}>
        <Box
          sx={{
            width: 44,
            height: 44,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 1,
            bgcolor: action.subtle,
            color: action.text,
          }}
        >
          {action.secondaryIcon ?? action.icon}
        </Box>

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {action.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {action.description}
          </Typography>
        </Box>

        <Stack spacing={1}>
          <Button
            variant="contained"
            startIcon={action.icon}
            sx={{
              bgcolor: action.main,
              color: '#ffffff',
              '&:hover': { bgcolor: action.hover },
            }}
          >
            {action.label}
          </Button>
          <Button
            variant="outlined"
            startIcon={action.icon}
            sx={{
              borderColor: action.main,
              color: action.text,
              '&:hover': {
                borderColor: action.hover,
                bgcolor: action.subtle,
              },
            }}
          >
            {action.label}
          </Button>
          <Button
            variant="text"
            startIcon={action.icon}
            sx={{
              color: action.text,
              '&:hover': { bgcolor: action.subtle },
            }}
          >
            {action.label}
          </Button>
        </Stack>

        <Typography variant="caption" sx={{ color: action.text, fontFamily: 'monospace' }}>
          {action.main} / {action.hover} / {action.subtle}
        </Typography>
      </Stack>
    </Box>
  )
}

export default App
