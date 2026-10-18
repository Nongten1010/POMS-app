import { Chip } from '@mui/material'

export function TicketStatus({ status }) {
  const color = status === 'open' ? '#2563eb' : '#e5e7eb'
  return <Chip size="small" variant="filled" label={status === 'open' ? 'เปิดการสนทนา' : 'ปิดการสนทนา'} sx={{ bgcolor: color, borderColor: color, color: status === 'open' ? '#ffffff' : '#374151', fontWeight: 500 }} />
}
