import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import ApiIcon from '@mui/icons-material/Api'
import ArticleIcon from '@mui/icons-material/Article'
import AssessmentIcon from '@mui/icons-material/Assessment'
import ChatIcon from '@mui/icons-material/Chat'
import DatasetIcon from '@mui/icons-material/Dataset'
import FactoryIcon from '@mui/icons-material/Factory'
import FeedbackIcon from '@mui/icons-material/Feedback'
import GavelIcon from '@mui/icons-material/Gavel'
import HelpIcon from '@mui/icons-material/Help'
import HomeIcon from '@mui/icons-material/Home'
import LinkIcon from '@mui/icons-material/Link'
import NotificationsIcon from '@mui/icons-material/Notifications'
import QueryStatsIcon from '@mui/icons-material/QueryStats'
import SearchIcon from '@mui/icons-material/Search'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'

const appBarHeight = {
  xs: 64,
  md: 72,
}

const menuItems = [
  {
    label: 'หน้าหลัก',
    value: 'home',
    icon: <HomeIcon />,
  },
  {
    label: 'ข้อมูลพื้นฐาน',
    value: 'master-data',
    icon: <DatasetIcon />,
  },
  {
    label: 'ขอเชื่อมต่อ',
    value: 'connection-request',
    icon: <LinkIcon />,
  },
  {
    label: 'แจ้งแบบ กวภ. 01 - กวภ. 05',
    value: 'forms',
    icon: <ArticleIcon />,
  },
  {
    label: 'รายงานค่าความคลาดเคลื่อน BOD/COD Online',
    value: 'bod-cod-report',
    icon: <AssessmentIcon />,
  },
  {
    label: 'การแจ้งเตือน',
    value: 'notifications',
    icon: <NotificationsIcon />,
  },
  {
    label: 'สถิติข้อมูล',
    value: 'statistics',
    icon: <QueryStatsIcon />,
  },
  {
    label: 'การสืบค้นข้อมูลแบบมีเงื่อนไข',
    value: 'conditional-search',
    icon: <SearchIcon />,
  },
  {
    label: 'แจ้งขอความช่วยเหลือ',
    value: 'support-request',
    icon: <SupportAgentIcon />,
  },
  {
    label: 'ข้อเสนอแนะ',
    value: 'feedback',
    icon: <FeedbackIcon />,
  },
  {
    label: 'กฎหมายที่เกี่ยวข้อง',
    value: 'laws',
    icon: <GavelIcon />,
  },
  {
    label: 'คำถามที่พบบ่อย',
    value: 'faq',
    icon: <HelpIcon />,
  },
  {
    label: 'Chat',
    value: 'chat',
    icon: <ChatIcon />,
  },
  {
    label: 'สิทธิ์การใช้งาน',
    value: 'permissions',
    icon: <AdminPanelSettingsIcon />,
  },
  {
    label: 'โรงงานที่เข้าข่าย',
    value: 'eligible-factories',
    icon: <FactoryIcon />,
  },
  {
    label: 'API Documentation',
    value: 'api-documentation',
    icon: <ApiIcon />,
  },
]

function DpomsSidebar({ open, selectedValue = 'home', onClose, onSelect }) {
  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      slotProps={{
        backdrop: {
          sx: {
            top: appBarHeight,
          },
        },
      }}
      sx={{
        zIndex: (theme) => theme.zIndex.appBar,
        '& .MuiDrawer-paper': {
          top: appBarHeight,
          height: {
            xs: `calc(100% - ${appBarHeight.xs}px)`,
            md: `calc(100% - ${appBarHeight.md}px)`,
          },
          width: { xs: 'calc(100vw - 32px)', sm: 336 },
          maxWidth: 336,
          borderRight: 1,
          borderColor: 'divider',
          boxShadow: '0 18px 48px rgba(15, 23, 42, 0.18)',
        },
      }}
    >
      <Box sx={{ height: '100%', overflow: 'auto', bgcolor: 'background.paper' }}>
        <List sx={{ px: 1, py: 1 }}>
          {menuItems.map((item) => {
            const isSelected = item.value === selectedValue

            return (
            <ListItemButton
              key={item.label}
              selected={isSelected}
              onClick={() => {
                onSelect?.(item.value)
                onClose()
              }}
              sx={{
                minHeight: 44,
                borderRadius: 1,
                mb: 0.25,
                '&.Mui-selected': {
                  bgcolor: 'primary.50',
                  color: 'primary.dark',
                  '&:hover': {
                    bgcolor: 'primary.100',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: isSelected ? 'primary.dark' : 'text.secondary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{
                  primary: {
                    variant: 'body2',
                    fontWeight: 300,
                  },
                }}
              />
            </ListItemButton>
            )
          })}
        </List>
      </Box>
    </Drawer>
  )
}

export default DpomsSidebar
