import { useMemo, useState } from 'react'
import { Box, Container } from '@mui/material'
import DpomsAppBar from './components/DpomsAppBar'
import DpomsLoginDialog from './components/DpomsLoginDialog'
import DpomsSidebar from './components/DpomsSidebar'
import ApiDocumentationPage from './pages/ApiDocumentationPage'
import ConnectionRequestPage from './pages/ConnectionRequestPage'
import EligibleFactoriesPage from './pages/EligibleFactoriesPage'
import EmailTestPage from './pages/EmailTestPage'
import HomePage from './pages/HomePage'
import KwpFormsPage from './pages/KwpFormsPage'
import NotificationPage from './pages/NotificationPage'
import PermissionManagementPage from './pages/PermissionManagementPage'

const authStorageKey = 'dpoms.authResponse'

const defaultPermissions = {
  dashboard: {
    data: 'ALL',
    view: true,
  },
  feedback: {
    data: 'ALL',
    view: true,
  },
  laws: {
    data: 'ALL',
    view: true,
  },
  faq: {
    data: 'ALL',
    view: true,
  },
  email_test: {
    data: 'ALL',
    view: true,
  },
}

const menuPermissionMap = {
  home: 'dashboard',
  'master-data': 'factories',
  'connection-request': 'connection',
  forms: 'kwp_forms',
  'bod-cod-report': 'bod_cod_errors',
  notifications: 'notifications',
  statistics: 'statistics',
  'conditional-search': 'conditional_search',
  'support-request': 'helpdesk',
  feedback: 'feedback',
  laws: 'laws',
  faq: 'faq',
  chat: 'chat',
  permissions: 'permissions',
  'eligible-factories': 'eligible_factories',
  'api-documentation': 'api_documentation',
  'email-test': 'email_test',
}

function loadStoredAuth() {
  try {
    const storedAuth = localStorage.getItem(authStorageKey)
    return storedAuth ? JSON.parse(storedAuth) : null
  } catch {
    localStorage.removeItem(authStorageKey)
    return null
  }
}

function getResponseValue(response, keys) {
  if (!response || typeof response !== 'object') {
    return ''
  }

  for (const key of keys) {
    if (response[key]) {
      return response[key]
    }
  }

  return getResponseValue(response.data, keys) || getResponseValue(response.user, keys)
}

function getAuthResponsePayload(auth) {
  if (!auth || typeof auth !== 'object') {
    return null
  }

  return auth.response ?? auth
}

function getPermissionsFromAuth(auth) {
  const response = getAuthResponsePayload(auth)
  const permissions = response?.permissions ?? response?.data?.permissions

  if (!permissions || typeof permissions !== 'object') {
    return defaultPermissions
  }

  return permissions
}

function getAccessTokenFromAuth(auth) {
  const response = getAuthResponsePayload(auth)
  return response?.accessToken ?? response?.data?.accessToken ?? ''
}

function getUserTypeFromAuth(auth) {
  return auth?.userType ?? getAuthResponsePayload(auth)?.userType ?? ''
}

function canViewMenu(menuValue, permissions) {
  const permissionKey = menuPermissionMap[menuValue]
  return permissions?.[permissionKey]?.view === true
}

function getFirstViewableMenu(permissions) {
  return Object.keys(menuPermissionMap).find((menuValue) => canViewMenu(menuValue, permissions)) ?? 'home'
}

function getUserFromAuth(auth) {
  if (!auth) {
    return null
  }

  const response = getAuthResponsePayload(auth)
  const responseUser = response?.user ?? response?.data?.user
  const name =
    getResponseValue(responseUser, ['name', 'fullName', 'displayName', 'username']) ||
    getResponseValue(response, ['name', 'fullName', 'displayName', 'username']) ||
    auth.username ||
    (auth.userType === 'officer' ? 'เจ้าหน้าที่ D-POMS' : 'ผู้ใช้งาน i-Industry')
  const role =
    auth.userType === 'officer'
      ? 'เจ้าหน้าที่'
      : auth.userType === 'operator'
        ? 'ผู้ประกอบการ'
        : 'ประชาชนทั่วไป'

  return { name, role }
}

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [authResponse, setAuthResponse] = useState(() => loadStoredAuth())
  const currentUser = getUserFromAuth(authResponse)
  const accessToken = getAccessTokenFromAuth(authResponse)
  const userType = getUserTypeFromAuth(authResponse)
  const activePermissions = useMemo(() => getPermissionsFromAuth(authResponse), [authResponse])
  const [selectedMenu, setSelectedMenu] = useState('home')
  const visibleSelectedMenu = canViewMenu(selectedMenu, activePermissions)
    ? selectedMenu
    : getFirstViewableMenu(activePermissions)
  const isWorkspacePage =
    visibleSelectedMenu === 'home' ||
    visibleSelectedMenu === 'permissions' ||
    visibleSelectedMenu === 'connection-request' ||
    visibleSelectedMenu === 'forms' ||
    visibleSelectedMenu === 'notifications' ||
    visibleSelectedMenu === 'eligible-factories' ||
    visibleSelectedMenu === 'api-documentation' ||
    visibleSelectedMenu === 'email-test'

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DpomsAppBar
        isAuthenticated={Boolean(currentUser)}
        user={currentUser ?? undefined}
        onMenuToggle={() => setIsMenuOpen((current) => !current)}
        onLogin={() => setIsLoginOpen(true)}
        onLogout={() => {
          localStorage.removeItem(authStorageKey)
          setAuthResponse(null)
        }}
      />
      <DpomsSidebar
        open={isMenuOpen}
        selectedValue={visibleSelectedMenu}
        permissions={activePermissions}
        onSelect={setSelectedMenu}
        onClose={() => setIsMenuOpen(false)}
      />
      <DpomsLoginDialog
        open={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(auth) => {
          localStorage.setItem(authStorageKey, JSON.stringify(auth))
          setAuthResponse(auth)
          setIsLoginOpen(false)
        }}
      />

      <Container
        maxWidth={false}
        sx={{
          width: '100%',
          ...(isWorkspacePage
            ? {
                height: { xs: 'calc(100dvh - 64px)', md: 'calc(100dvh - 72px)' },
                overflow: 'hidden',
                p: 0,
              }
            : {
                py: { xs: 4, md: 6 },
              }),
        }}
      >
        {visibleSelectedMenu === 'home' ? (
          <HomePage accessToken={accessToken} />
        ) : visibleSelectedMenu === 'permissions' ? (
          <PermissionManagementPage accessToken={accessToken} />
        ) : visibleSelectedMenu === 'connection-request' ? (
          <ConnectionRequestPage userType={userType} accessToken={accessToken} />
        ) : visibleSelectedMenu === 'forms' ? (
          <KwpFormsPage userType={userType} />
        ) : visibleSelectedMenu === 'notifications' ? (
          <NotificationPage accessToken={accessToken} />
        ) : visibleSelectedMenu === 'eligible-factories' ? (
          <EligibleFactoriesPage accessToken={accessToken} />
        ) : visibleSelectedMenu === 'api-documentation' ? (
          <ApiDocumentationPage />
        ) : visibleSelectedMenu === 'email-test' ? (
          <EmailTestPage accessToken={accessToken} />
        ) : (
          <HomePage accessToken={accessToken} />
        )}
      </Container>
    </Box>
  )
}

export default App
