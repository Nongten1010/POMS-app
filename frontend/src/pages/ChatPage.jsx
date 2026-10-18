import { Alert } from '@mui/material'
import ChatWorkspace from '../components/ChatWorkspace'

export default function ChatPage({ accessToken, viewerId, userType, permissions, onAccessError }) {
  if (!accessToken || permissions?.chat?.view !== true) return <Alert severity="warning">กรุณาเข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์ใช้งาน Chat</Alert>
  return <ChatWorkspace key={accessToken} accessToken={accessToken} viewerId={viewerId} userType={userType} onAccessError={onAccessError} />
}
