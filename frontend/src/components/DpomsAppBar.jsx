import {
  AppBar,
  Avatar,
  Box,
  Button,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import LoginIcon from '@mui/icons-material/Login'
import LogoutIcon from '@mui/icons-material/Logout'
import MenuIcon from '@mui/icons-material/Menu'
import logo from '../assets/logo.png'

const APP_VERSION = 'v1.5'

function DpomsAppBar({
  isAuthenticated = false,
  user = {
    name: 'D-POMS User',
    role: 'ผู้ใช้งานระบบ',
  },
  onMenuToggle,
  onLogin,
  onLogout,
  onProfileClick,
}) {
  const displayName = typeof user.name === 'string' && user.name.trim() ? user.name : 'D-POMS User'
  const displayDepartment = typeof user.department === 'string' && user.department.trim()
    ? user.department
    : 'ไม่ระบุ'
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Toolbar sx={{ gap: 1.5, minHeight: { xs: 64, md: 72 } }}>
          <Tooltip title="เปิดเมนู">
            <IconButton
              edge="start"
              aria-label="เปิดเมนู"
              onClick={onMenuToggle}
              sx={{ flex: '0 0 auto' }}
            >
              <MenuIcon />
            </IconButton>
          </Tooltip>

          <Box
            component="img"
            src={logo}
            alt="D-POMS logo"
            sx={{
              width: { xs: 36, md: 42 },
              height: { xs: 36, md: 42 },
              objectFit: 'contain',
              flex: '0 0 auto',
            }}
          />

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'baseline', minWidth: 0 }}>
              <Typography
                variant="h6"
                component="div"
                sx={{
                  fontWeight: 600,
                  lineHeight: 1.15,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                D-POMS
              </Typography>
              <Typography
                component="span"
                color="text.secondary"
                sx={{ flex: '0 0 auto', fontSize: 11, lineHeight: 1 }}
              >
                {APP_VERSION}
              </Typography>
            </Stack>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: { xs: 'none', sm: 'block' },
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              ระบบเฝ้าระวังและเตือนภัยมลพิษระยะไกล
            </Typography>
          </Box>

          {isAuthenticated ? (
            <>
              <Button
                color="inherit"
                onClick={onProfileClick}
                sx={{
                  minWidth: 0,
                  px: { xs: 0.75, sm: 1.5 },
                  flex: '0 0 auto',
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                  <Avatar
                    sx={{
                      width: 34,
                      height: 34,
                      bgcolor: 'primary.main',
                      fontSize: 13,
                      fontWeight: 300,
                    }}
                  >
                    {initials}
                  </Avatar>
                  <Box
                    sx={{
                      display: { xs: 'none', md: 'block' },
                      minWidth: 0,
                      textAlign: 'left',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 300, lineHeight: 1.2 }}>
                      {displayName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                      {displayDepartment}
                    </Typography>
                  </Box>
                </Stack>
              </Button>
              <Tooltip title="ออกจากระบบ">
                <IconButton
                  color="inherit"
                  aria-label="ออกจากระบบ"
                  onClick={onLogout}
                  sx={{ flex: '0 0 auto' }}
                >
                  <LogoutIcon />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <Button
              variant="contained"
              startIcon={<LoginIcon />}
              onClick={onLogin}
              sx={{ flex: '0 0 auto' }}
            >
              Login
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <Toolbar sx={{ minHeight: { xs: 64, md: 72 } }} />
    </>
  )
}

export default DpomsAppBar
