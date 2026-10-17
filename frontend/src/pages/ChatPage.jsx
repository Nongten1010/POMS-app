import { Alert } from '@mui/material'
import ChatWorkspace from '../components/ChatWorkspace'

export default function ChatPage({ accessToken, userType, permissions, onAccessError }) {
  if (!accessToken || permissions?.chat?.view !== true) return <Alert severity="warning">กรุณาเข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์ใช้งาน Chat</Alert>
  return <ChatWorkspace key={accessToken} accessToken={accessToken} userType={userType} onAccessError={onAccessError} />
}
