import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

const officerManualUrl = new URL('../manuals/คู่มือ สำหรับเจ้าหน้าที่.pdf', import.meta.url).href
const operatorManualUrl = new URL('../manuals/คู่มือ สำหรับผู้ประกอบการ.pdf', import.meta.url).href
const adminManualUrl = new URL('../manuals/คู่มือ สำหรับผู้ดูแลระบบ.pdf', import.meta.url).href

function getAvailableManuals(userType = '', roleCode = '') {
  const isOperator = userType === 'operator'
  const isCitizen =
    !userType || userType === 'citizen' || userType === 'public' || roleCode === 'public_user' || roleCode === 'public_anonymous'
  const isAdmin = roleCode === 'admin'

  return [
    {
      id: 'operator',
      title: 'คู่มือ สำหรับผู้ประกอบการ.pdf',
      description: 'คู่มือการใช้งานระบบสำหรับผู้ประกอบการ',
      url: operatorManualUrl,
      visible: true,
    },
    {
      id: 'officer',
      title: 'คู่มือ สำหรับเจ้าหน้าที่.pdf',
      description: 'คู่มือการใช้งานระบบสำหรับเจ้าหน้าที่',
      url: officerManualUrl,
      visible: !isOperator && !isCitizen,
    },
    {
      id: 'admin',
      title: 'คู่มือ สำหรับผู้ดูแลระบบ.pdf',
      description: 'คู่มือการใช้งานระบบสำหรับผู้ดูแลระบบ',
      url: adminManualUrl,
      visible: isAdmin,
    },
  ].filter((manual) => manual.visible)
}

function ManualsPage({ userType = '', roleCode = '' }) {
  const manuals = useMemo(() => getAvailableManuals(userType, roleCode), [roleCode, userType])
  const [selectedManualId, setSelectedManualId] = useState(() => manuals[0]?.id ?? '')
  const selectedManual = manuals.find((manual) => manual.id === selectedManualId) ?? manuals[0]

  return (
    <Box sx={{ height: '100%', minHeight: 0, bgcolor: 'background.default' }}>
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
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { xs: 'stretch', md: 'center' } }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
                คู่มือการใช้งาน
              </Typography>
              <Typography variant="body2" color="text.secondary">
                เลือกคู่มือที่ต้องการเปิดดูภายในระบบ
              </Typography>
            </Box>
            {selectedManual ? (
              <Button
                component="a"
                href={selectedManual.url}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                startIcon={<OpenInNewIcon />}
              >
                เปิดในแท็บใหม่
              </Button>
            ) : null}
          </Stack>
        </Paper>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            px: { xs: 2, md: 3 },
            pb: { xs: 2, md: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            {manuals.length > 0 ? (
              <Tabs
                value={selectedManual?.id ?? false}
                onChange={(_, value) => setSelectedManualId(value)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                  minHeight: 72,
                  '& .MuiTabs-indicator': {
                    height: 3,
                  },
                  '& .MuiTab-root': {
                    alignItems: 'center',
                    minHeight: 72,
                    maxWidth: 360,
                    px: 2,
                    py: 1.25,
                    borderRight: 1,
                    borderColor: 'divider',
                    color: 'text.primary',
                    textAlign: 'left',
                    textTransform: 'none',
                  },
                  '& .MuiTab-root.Mui-selected': {
                    bgcolor: 'primary.50',
                    color: 'primary.main',
                  },
                  '& .MuiTab-iconWrapper': {
                    mr: 1.25,
                  },
                }}
              >
                {manuals.map((manual) => (
                  <Tab
                    key={manual.id}
                    value={manual.id}
                    icon={<MenuBookIcon fontSize="small" />}
                    iconPosition="start"
                    label={(
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          {manual.title}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block' }}
                          noWrap
                        >
                          {manual.description}
                        </Typography>
                      </Box>
                    )}
                  />
                ))}
              </Tabs>
            ) : (
              <Box sx={{ p: 2 }}>
                <Typography color="text.secondary">ไม่มีคู่มือที่สามารถเปิดดูได้</Typography>
              </Box>
            )}
          </Paper>

          <Paper
            elevation={0}
            sx={{
              flex: 1,
              minHeight: 0,
              border: 1,
              borderColor: 'divider',
              overflow: 'hidden',
              bgcolor: '#1f2937',
            }}
          >
            {selectedManual ? (
              <Box
                component="iframe"
                title={selectedManual.title}
                src={selectedManual.url}
                sx={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  minHeight: { xs: '70dvh', lg: 0 },
                  border: 0,
                  bgcolor: 'background.paper',
                }}
              />
            ) : (
              <Stack sx={{ height: '100%', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                <Typography>ไม่มีคู่มือที่สามารถเปิดดูได้</Typography>
              </Stack>
            )}
          </Paper>
        </Box>
      </Stack>
    </Box>
  )
}

export default ManualsPage
