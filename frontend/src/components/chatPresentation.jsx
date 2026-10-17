import { Chip } from '@mui/material'

export function TicketStatus({ status }) {
  const color = status === 'open' ? '#2563eb' : '#16a34a'
  return <Chip size="small" variant="filled" label={status === 'open' ? 'เปิดการสนทนา' : 'ปิดการสนทนา'} sx={{ bgcolor: color, borderColor: color, color: '#ffffff', fontWeight: 500 }} />
}
