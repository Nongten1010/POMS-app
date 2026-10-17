import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import ChatBubbleOutlineIcon from '@mui/icons-material/Chat'
import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import SendIcon from '@mui/icons-material/Send'
import CheckIcon from '@mui/icons-material/Check'
import { canAccessMockTicket, createMockTicket, makeMockTickets, mockFactories, mockPeople, ticketTopics, updateMockTicket } from '../utils/chatTicketMock.mjs'

const blankForm = { factoryId: 'factory-1', point: 'ทั้งหมด', topic: '', text: '' }
const formatDate = (value) => new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' }).format(new Date(value))
const statusLabel = (status) => status === 'open' ? 'เปิดการสนทนา' : 'ปิดการสนทนา'
function TicketStatus({ status }) {
  const color = status === 'open' ? '#2563eb' : '#16a34a'
  return <Chip size="small" variant="filled" label={statusLabel(status)} sx={{ bgcolor: color, borderColor: color, color: '#ffffff', fontWeight: 500 }} />
}

export default function ChatTicketMockup({ isStaff = false }) {
  const viewer = isStaff ? 'officer' : 'operator'
  const [tickets, setTickets] = useState(makeMockTickets)
  const [selectedId, setSelectedId] = useState(null)
  const [message, setMessage] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState(blankForm)
  const [formError, setFormError] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const [refreshNote, setRefreshNote] = useState('')
  const messageList = useRef(null)
  const selected = tickets.find((ticket) => ticket.id === selectedId && canAccessMockTicket(ticket, viewer))
  const factory = mockFactories.find((item) => item.id === selected?.factoryId)
  const formFactory = mockFactories.find((item) => item.id === form.factoryId)
  const rows = useMemo(() => tickets.filter((ticket) => canAccessMockTicket(ticket, viewer)).map((ticket) => {
    const item = mockFactories.find((entry) => entry.id === ticket.factoryId)
    return { ...ticket, factoryName: item.name, registration: item.registration, region: item.region, province: item.province, latest: new Date(ticket.messages.at(-1).at) }
  }), [tickets, viewer])
  useEffect(() => {
    if (messageList.current) messageList.current.scrollTop = messageList.current.scrollHeight
  }, [selectedId, selected?.messages.length])
  function openTicket(id) { setSelectedId(id); setMessage(''); setRefreshNote('') }
  const columns = [
    { field: 'id', headerName: 'Ticket No.', width: 110 },
    { field: 'topic', headerName: 'หัวข้อ', width: 220, type: 'singleSelect', valueOptions: ticketTopics },
    { field: 'factoryName', headerName: 'ชื่อโรงงาน', width: 270 },
    { field: 'registration', headerName: 'เลขทะเบียนโรงงาน', width: 160 },
    { field: 'region', headerName: 'ภาค', width: 135 },
    { field: 'province', headerName: 'จังหวัด', width: 115 },
    { field: 'status', headerName: 'สถานะ', width: 120, type: 'singleSelect', valueOptions: [{ value: 'open', label: statusLabel('open') }, { value: 'closed', label: statusLabel('closed') }], renderCell: ({ value }) => <TicketStatus status={value} /> },
    { field: 'latest', headerName: 'ข้อความล่าสุด', type: 'dateTime', width: 140, valueFormatter: (value) => value ? formatDate(value) : '-' },
    { field: 'actions', headerName: 'จัดการ', width: 145, sortable: false, filterable: false, disableColumnMenu: true, renderCell: ({ row }) => <Button size="small" variant={row.status === 'open' ? 'contained' : 'outlined'} startIcon={<ChatBubbleOutlineIcon />} onClick={() => openTicket(row.id)}>{row.status === 'open' ? 'สนทนา' : 'ดูประวัติ'}</Button> },
  ]
  function sendMessage(event) {
    event.preventDefault()
    if (!selected || !message.trim()) return
    setTickets((items) => items.map((ticket) => ticket.id === selectedId ? updateMockTicket(ticket, viewer, 'send', message) : ticket))
    setMessage(''); setRefreshNote('')
  }
  function createTicket(event) {
    event.preventDefault()
    const ticket = createMockTicket(tickets, viewer, form)
    if (!ticket) { setFormError('กรุณาเลือกข้อมูลและกรอกข้อความให้ครบถ้วน'); return }
    setTickets((items) => [...items, ticket]); setNewOpen(false); openTicket(ticket.id)
  }
  return <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
    <Paper elevation={0} sx={{ px: { xs: 1.5, md: 2 }, py: 1.5, border: 1, borderColor: 'divider' }}>
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', lg: 'center' } }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="h5" component="h1">Chat</Typography>
        <Typography variant="body2" color="text.secondary">แจ้งปัญหาการใช้งานกับเจ้าหน้าที่</Typography>
      </Box>
      {viewer !== 'officer' && <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm({ ...blankForm }); setFormError(''); setNewOpen(true) }}>เปิดการสนทนา</Button>}
    </Stack>
    </Paper>
    <Paper elevation={0} sx={{ flex: 1, minHeight: 0, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
      <DataGrid rows={rows} columns={columns} disableRowSelectionOnClick showToolbar showCellVerticalBorder showColumnVerticalBorder label="รายการสนทนา" pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { page: 0, pageSize: 25 } }, sorting: { sortModel: [{ field: 'latest', sort: 'desc' }] } }}
        localeText={{
          toolbarColumns: 'คอลัมน์', toolbarFilters: 'ตัวกรอง', toolbarDensity: 'ความหนาแน่น', toolbarExport: 'ส่งออก',
          filterPanelInputLabel: 'ค่า', filterPanelColumns: 'คอลัมน์', filterPanelOperator: 'เงื่อนไข',
          noRowsLabel: 'ไม่มีรายการสนทนา', noResultsOverlayLabel: 'ไม่พบรายการสนทนา',
          columnMenuSortAsc: 'เรียงจากน้อยไปมาก', columnMenuSortDesc: 'เรียงจากมากไปน้อย',
          columnMenuFilter: 'ตัวกรอง', columnMenuHideColumn: 'ซ่อนคอลัมน์', columnMenuManageColumns: 'จัดการคอลัมน์',
          footerRowSelected: (count) => `เลือก ${count.toLocaleString()} รายการ`,
        }}
        sx={{
          border: 0,
          '& .MuiDataGrid-columnHeaders': { borderTop: 1, borderBottom: 1, borderColor: 'divider' },
          '& .MuiDataGrid-columnHeader': { borderColor: 'divider' },
          '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600 },
          '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center', borderColor: 'divider' },
          '& .MuiDataGrid-row--lastVisible .MuiDataGrid-cell': { borderBottom: 1, borderColor: 'divider' },
          '& .MuiDataGrid-toolbarLabel': { fontWeight: 600 },
        }} />
    </Paper>
    <Dialog open={Boolean(selected)} onClose={() => setSelectedId(null)} fullWidth maxWidth="lg" aria-labelledby="ticket-dialog-title" slotProps={{ paper: { sx: { height: 'min(780px, calc(100dvh - 32px))', maxHeight: 'calc(100dvh - 32px)', m: 2, width: 'calc(100% - 32px)' } } }}>
      {selected && <>
        <DialogTitle component="div" sx={{ borderBottom: 1, borderColor: 'divider', p: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: 'minmax(0, 1fr) minmax(0, 1.2fr) auto' }, gap: { xs: 1.5, md: 2 }, alignItems: 'start' }}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" alignItems="center" sx={{ flexWrap: 'wrap', columnGap: 1.5, rowGap: 1 }}>
                <Typography id="ticket-dialog-title" variant="subtitle1" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{selected.id}</Typography>
                <TicketStatus status={selected.status} />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, overflowWrap: 'anywhere' }}>{selected.topic}</Typography>
            </Box>
            <Box sx={{ minWidth: 0, gridColumn: { xs: '1 / -1', md: '2' }, gridRow: { xs: 2, md: 1 }, textAlign: { xs: 'left', md: 'center' }, overflowWrap: 'anywhere' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{factory.name}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{factory.registration} · {factory.province} · {factory.region}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>จุดตรวจวัด: {selected.point}</Typography>
            </Box>
            <Stack direction="row" alignItems="center" sx={{ gap: 0.5, gridColumn: { xs: 2, md: 3 }, gridRow: 1, '& .MuiIconButton-root': { p: { xs: 0.5, sm: 1 } } }}>
              <Tooltip title="รีเฟรชข้อความ"><IconButton aria-label="รีเฟรชข้อความ" onClick={() => setRefreshNote(`อัปเดตล่าสุด ${formatDate(new Date())}`)}><RefreshIcon /></IconButton></Tooltip>
              {selected.status === 'open' && <Tooltip title="ปิดการสนทนา"><Button aria-label="ปิดการสนทนา" color="error" variant="outlined" sx={{ minWidth: { xs: 32, sm: 64 }, px: { xs: 0.5, sm: 1.5 } }} onClick={() => setConfirmClose(true)}><CheckIcon sx={{ display: { xs: 'block', sm: 'none' }, fontSize: 20 }} /><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>ปิดการสนทนา</Box></Button></Tooltip>}
              <Tooltip title="ปิดหน้าต่าง"><IconButton aria-label="ปิดหน้าต่าง" onClick={() => setSelectedId(null)}><CloseIcon /></IconButton></Tooltip>
            </Stack>
          </Box>
        </DialogTitle>
        <DialogContent ref={messageList} sx={{ bgcolor: '#f5f7fb', p: { xs: 2, md: 3 }, minHeight: 0 }}>
          {refreshNote && <Typography role="status" variant="caption" display="block" textAlign="center" color="text.secondary">{refreshNote}</Typography>}
          <Typography variant="caption" display="block" textAlign="center" color="text.secondary" sx={{ my: 2 }}>{mockPeople[selected.creator].name} เปิดการสนทนา · {formatDate(selected.messages[0].at)}</Typography>
          {selected.messages.map((item, index) => {
            const own = item.sender === viewer
            return <Box key={`${selected.id}-${index}`} sx={{ display: 'flex', flexDirection: 'column', alignItems: own ? 'flex-end' : 'flex-start', my: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>{mockPeople[item.sender].name} · {mockPeople[item.sender].role}</Typography>
              <Box sx={{ px: 2, py: 1.25, maxWidth: { xs: '92%', sm: '76%' }, bgcolor: own ? '#e6efff' : '#fff', color: own ? '#1a3c70' : 'text.primary', border: 1, borderColor: own ? '#d2e1fd' : '#e0e6ee', borderRadius: 2, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.8 }}>{item.text}</Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>{formatDate(item.at)}</Typography>
            </Box>
          })}
          {selected.status === 'closed' && <Typography variant="caption" display="block" textAlign="center" color="text.secondary" sx={{ my: 2 }}>{mockPeople[selected.closedBy].name} ปิดการสนทนา · {formatDate(selected.closedAt)}</Typography>}
        </DialogContent>
        {selected.status === 'open' ? <Box component="form" onSubmit={sendMessage} sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Stack direction="row" sx={{ gap: 1.5, alignItems: 'flex-start' }}><TextField fullWidth multiline minRows={2} maxRows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="พิมพ์ข้อความ…" slotProps={{ htmlInput: { maxLength: 2000, 'aria-label': 'ข้อความ' } }} /><Button type="submit" variant="contained" endIcon={<SendIcon />} disabled={!message.trim()} sx={{ flexShrink: 0, height: 40, alignSelf: 'flex-start' }}>ส่ง</Button></Stack>
          <Typography variant="caption" color="text.secondary">{message.length.toLocaleString()} / 2,000</Typography>
        </Box> : <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', textAlign: 'center' }}><Typography variant="body2" color="text.secondary">การสนทนานี้ปิดแล้ว หากต้องการติดต่อเพิ่มเติม กรุณาเปิดการสนทนาใหม่</Typography></Box>}
      </>}
    </Dialog>
    <Dialog open={newOpen} onClose={() => setNewOpen(false)} fullWidth maxWidth="sm" aria-labelledby="new-ticket-title">
      <Box component="form" onSubmit={createTicket}><DialogTitle id="new-ticket-title">เปิดการสนทนา</DialogTitle>
        <DialogContent><Stack sx={{ pt: 1.5, gap: 2.5 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField select label="โรงงาน" value={form.factoryId} onChange={(event) => setForm({ ...form, factoryId: event.target.value, point: 'ทั้งหมด' })} required>{mockFactories.filter((item) => canAccessMockTicket({ factoryId: item.id }, viewer)).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField>
          <TextField select label="จุดตรวจวัด" value={form.point} onChange={(event) => setForm({ ...form, point: event.target.value })} required>{['ทั้งหมด', ...formFactory.points].map((point) => <MenuItem key={point} value={point}>{point}</MenuItem>)}</TextField>
          <TextField select label="หัวข้อ" value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} required>{ticketTopics.map((topic) => <MenuItem key={topic} value={topic}>{topic}</MenuItem>)}</TextField>
          <TextField label="ข้อความ" multiline minRows={4} value={form.text} onChange={(event) => setForm({ ...form, text: event.target.value })} required slotProps={{ htmlInput: { maxLength: 2000 } }} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setNewOpen(false)}>ยกเลิก</Button><Button type="submit" variant="contained" disabled={!form.text.trim() || !form.topic}>ส่งข้อความและเปิดการสนทนา</Button></DialogActions>
      </Box>
    </Dialog>
    <Dialog open={confirmClose && Boolean(selected)} onClose={() => setConfirmClose(false)} maxWidth="xs" fullWidth aria-labelledby="close-ticket-title">
      <DialogTitle id="close-ticket-title">ยืนยันปิดการสนทนา</DialogTitle>
      <DialogContent><Typography>ต้องการปิด {selected?.id} ใช่หรือไม่?</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>เมื่อปิดแล้วจะอ่านประวัติได้ แต่ไม่สามารถส่งข้อความหรือเปิดเรื่องเดิมกลับมาได้</Typography></DialogContent>
      <DialogActions><Button onClick={() => setConfirmClose(false)}>กลับไปสนทนา</Button><Button color="error" variant="contained" onClick={() => { setTickets((items) => items.map((ticket) => ticket.id === selectedId ? updateMockTicket(ticket, viewer, 'close') : ticket)); setConfirmClose(false); setMessage('') }}>ยืนยันปิดการสนทนา</Button></DialogActions>
    </Dialog>
  </Stack>
}
