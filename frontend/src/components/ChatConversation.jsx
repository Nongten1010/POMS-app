import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import SendIcon from '@mui/icons-material/Send'
import CheckIcon from '@mui/icons-material/Check'
import { errorText, formatChatDate, mergeMessages, readNewMessages } from '../utils/chatApi.mjs'
import { TicketStatus } from './chatPresentation'

export default function ChatConversation({ id, client, options, drafts, onDismiss, onChanged, onError }) {
  const [ticket, setTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState(() => drafts.get(id) || '')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(() => client.hasPending(`send:${id}`))
  const [confirm, setConfirm] = useState(false)
  const [older, setOlder] = useState(null)
  const [refreshNote, setRefreshNote] = useState('')
  const list = useRef(null)
  const scroll = useRef(null)
  const readPosition = useRef(null)
  const reading = useRef(null)
  const writing = useRef(false)
  const live = useRef(false)
  const maxLength = options.limits.messageMaxLength

  const handleError = useCallback((failure) => {
    if (!live.current || failure.name === 'AbortError') return
    setError(errorText(failure)); onError(failure)
    if ([401, 403, 404].includes(failure.status)) { setTicket(null); setMessages([]); drafts.delete(id) }
  }, [onError, drafts, id])

  const load = useCallback(async (mode = 'refresh', cursor = null) => {
    if (reading.current) return
    const controller = new AbortController()
    reading.current = controller
    setLoading(true); setError('')
    try {
      if (mode === 'older') {
        const { data } = await client.request(`/tickets/${id}/messages`, { query: { limit: 50, olderCursor: cursor }, signal: controller.signal })
        if (!live.current || controller.signal.aborted) return
        scroll.current = { height: list.current?.scrollHeight || 0, top: list.current?.scrollTop || 0 }
        setMessages((items) => mergeMessages(items, data.messages)); setTicket(data.ticket); setOlder(data.pagination.olderCursor)
      } else {
        const first = !readPosition.current
        await readNewMessages(client, id, readPosition.current, controller.signal, (data, nextRead) => {
          if (!live.current || controller.signal.aborted) return
          readPosition.current = nextRead
          if (first) { setOlder(data.pagination.olderCursor); scroll.current = 'bottom' }
          setMessages((items) => mergeMessages(items, data.messages)); setTicket(data.ticket)
        })
        if (live.current && !controller.signal.aborted) setRefreshNote(`อัปเดตล่าสุด ${formatChatDate(new Date())}`)
      }
    } catch (failure) { handleError(failure) }
    finally {
      if (reading.current === controller) reading.current = null
      if (live.current && !controller.signal.aborted) setLoading(false)
    }
  }, [client, id, handleError])

  useEffect(() => {
    live.current = true
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) void load() })
    return () => { cancelled = true; live.current = false; reading.current?.abort(); reading.current = null }
  }, [load])

  useLayoutEffect(() => {
    if (!list.current || !scroll.current) return
    list.current.scrollTop = scroll.current === 'bottom' ? list.current.scrollHeight : scroll.current.top + list.current.scrollHeight - scroll.current.height
    scroll.current = null
  }, [messages])

  async function send(event) {
    event.preventDefault()
    if (writing.current || (!pending && (!message.trim() || !ticket?.capabilities.canReply))) return
    writing.current = true; setBusy(true); setError('')
    try {
      const result = await client.write(`send:${id}`, `/tickets/${id}/messages`, { message: message.trim() })
      // A send response must never advance the GET read cursor.
      if ((drafts.get(id) || '').trim() === result.sent.message) drafts.delete(id)
      if (!live.current) return
      setMessage((current) => current.trim() === result.sent.message ? '' : current)
      scroll.current = 'bottom'
      setMessages((items) => mergeMessages(items, [result.data.message])); setTicket(result.data.ticket); setPending(false); onChanged()
    } catch (failure) {
      handleError(failure)
      if (!live.current) return
      setPending(client.hasPending(`send:${id}`))
      if (failure.code === 'CHAT_TICKET_CLOSED') {
        setTicket((value) => value ? { ...value, status: 'closed', capabilities: { canReply: false, canClose: false } } : value)
        try {
          const { data } = await client.request(`/tickets/${id}`)
          if (live.current) { setTicket(data); onChanged() }
        } catch (detailFailure) { handleError(detailFailure) }
      }
    } finally { writing.current = false; if (live.current) setBusy(false) }
  }
  async function closeTicket() {
    if (writing.current || !ticket?.capabilities.canClose) return
    writing.current = true; setBusy(true); setError('')
    try {
      const { data } = await client.request(`/tickets/${id}/close`, { body: {} })
      if (live.current) { setTicket(data); setConfirm(false); onChanged() }
    } catch (failure) { handleError(failure); if (live.current) setConfirm(false) }
    finally { writing.current = false; if (live.current) setBusy(false) }
  }
  const point = ticket?.measurementPoint
  const canReply = ticket?.status === 'open' && ticket?.capabilities.canReply
  const events = ticket?.events || []
  const timeline = [...messages.map((item) => ({ kind: 'message', value: item })), ...events.map((item) => ({ kind: 'event', value: item }))].sort((a, b) => new Date(a.value.createdAt) - new Date(b.value.createdAt) || (a.kind === b.kind ? a.value.id - b.value.id : a.kind === 'event' && a.value.type === 'opened' ? -1 : 1))

  return <>
    <Dialog open onClose={busy ? undefined : onDismiss} fullWidth maxWidth="lg" aria-labelledby="ticket-dialog-title" slotProps={{ paper: { sx: { height: 'min(780px, calc(100dvh - 32px))', maxHeight: 'calc(100dvh - 32px)', m: 2, width: 'calc(100% - 32px)' } } }}>
      <DialogTitle component="div" sx={{ borderBottom: 1, borderColor: 'divider', p: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: 'minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr)' }, gap: { xs: 1.5, md: 2 }, alignItems: 'start' }}>
          <Box sx={{ minWidth: 0 }}><Stack direction="row" sx={{ flexWrap: 'wrap', columnGap: 1.5, rowGap: 1, alignItems: 'center' }}><Typography id="ticket-dialog-title" variant="subtitle1" sx={{ fontWeight: 700 }}>{ticket?.ticketNo || 'การสนทนา'}</Typography>{ticket && <TicketStatus status={ticket.status} />}</Stack><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{ticket?.topic.label}</Typography></Box>
          <Box sx={{ minWidth: 0, gridColumn: { xs: '1 / -1', md: 2 }, gridRow: { xs: 2, md: 1 }, textAlign: { xs: 'left', md: 'center' }, overflowWrap: 'anywhere' }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{ticket?.factory.name}</Typography>
            {ticket && <><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{ticket.factory.registrationNo} · {ticket.factory.provinceName} · {ticket.factory.regionName || '-'}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>จุดตรวจวัด: {point ? [point.pointCode, point.pointName].filter(Boolean).join(' · ') : 'ทั้งหมด'}</Typography></>}
          </Box>
          <Stack direction="row" sx={{ gap: 0.5, gridColumn: { xs: 2, md: 3 }, gridRow: 1, justifySelf: 'end', alignItems: 'center', '& .MuiIconButton-root': { p: { xs: 0.5, sm: 1 } } }}>
            <Tooltip title="รีเฟรชข้อความ"><span><IconButton disabled={loading || busy} aria-label="รีเฟรชข้อความ" onClick={() => load()}><RefreshIcon /></IconButton></span></Tooltip>
            {ticket?.status === 'open' && ticket.capabilities.canClose && <Tooltip title="ปิดการสนทนา"><Button disabled={busy || loading || pending} aria-label="ปิดการสนทนา" color="error" variant="outlined" sx={{ minWidth: { xs: 32, sm: 64 }, px: { xs: 0.5, sm: 1.5 } }} onClick={() => setConfirm(true)}><CheckIcon sx={{ display: { xs: 'block', sm: 'none' }, fontSize: 20 }} /><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>ปิดการสนทนา</Box></Button></Tooltip>}
            <Tooltip title="ปิดหน้าต่าง"><span><IconButton disabled={busy} aria-label="ปิดหน้าต่าง" onClick={onDismiss}><CloseIcon /></IconButton></span></Tooltip>
          </Stack>
        </Box>
      </DialogTitle>
      {error && <Alert severity="error">{error}</Alert>}
      {pending && <Alert severity="warning">ยังไม่ทราบผลการส่ง กรุณาลองส่งข้อความเดิมอีกครั้ง</Alert>}
      <DialogContent ref={list} sx={{ bgcolor: '#f5f7fb', p: { xs: 2, md: 3 }, minHeight: 0 }}>
        {loading && <Box sx={{ textAlign: 'center', p: 1 }}><CircularProgress size={24} aria-label="กำลังโหลดข้อความ" /></Box>}
        {older && <Box sx={{ textAlign: 'center' }}><Button disabled={loading || busy} onClick={() => load('older', older)}>โหลดข้อความก่อนหน้า</Button></Box>}
        {refreshNote && <Typography variant="caption" display="block" textAlign="center" color="text.secondary">{refreshNote}</Typography>}
        {timeline.map(({ kind, value: item }) => {
          if (kind === 'event') return <Typography key={`event:${item.id}`} variant="caption" display="block" textAlign="center" color="text.secondary" sx={{ my: 2 }}>{item.actor.name} {item.type === 'opened' ? 'เปิดการสนทนา' : 'ปิดการสนทนา'} · {formatChatDate(item.createdAt)}</Typography>
          const own = item.sender.userId === options.viewer.userId
          return <Box key={`message:${item.id}`} sx={{ display: 'flex', flexDirection: 'column', alignItems: own ? 'flex-end' : 'flex-start', my: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, overflowWrap: 'anywhere' }}>{item.sender.name} · {item.sender.roleLabel}</Typography>
            <Box sx={{ px: 2, py: 1.25, maxWidth: { xs: '92%', sm: '76%' }, bgcolor: own ? '#e6efff' : '#fff', color: own ? '#1a3c70' : 'text.primary', border: 1, borderColor: own ? '#d2e1fd' : '#e0e6ee', borderRadius: 2, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.8 }}>{item.text}</Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>{formatChatDate(item.createdAt)}</Typography>
          </Box>
        })}
      </DialogContent>
      {(canReply || pending) && <Box component="form" onSubmit={send} sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}><Stack direction="row" sx={{ gap: 1.5, alignItems: 'flex-start' }}><TextField fullWidth multiline minRows={2} maxRows={5} value={message} disabled={pending} onChange={(event) => { setMessage(event.target.value); drafts.set(id, event.target.value) }} placeholder="พิมพ์ข้อความ…" slotProps={{ htmlInput: { maxLength, 'aria-label': 'ข้อความ' } }} /><Button type="submit" variant="contained" endIcon={<SendIcon />} disabled={busy || loading || (!pending && !message.trim())} sx={{ flexShrink: 0, height: 40, alignSelf: 'flex-start' }}>{pending ? 'ลองใหม่' : 'ส่ง'}</Button></Stack><Typography variant="caption" color="text.secondary">{message.length.toLocaleString()} / {maxLength.toLocaleString()}</Typography></Box>}
      {ticket && !canReply && !pending && <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}><Typography variant="body2" color="text.secondary">{ticket.status === 'closed' ? 'การสนทนานี้ปิดแล้ว หากต้องการติดต่อเพิ่มเติม กรุณาเปิดการสนทนาใหม่' : 'ไม่มีสิทธิ์ส่งข้อความในการสนทนานี้'}</Typography>{message && <TextField sx={{ mt: 1 }} label="ข้อความที่ยังไม่ได้ส่ง" multiline fullWidth value={message} slotProps={{ input: { readOnly: true } }} />}</Box>}
    </Dialog>
    <Dialog open={confirm} onClose={busy ? undefined : () => setConfirm(false)} fullWidth maxWidth="xs" aria-labelledby="close-ticket-title"><DialogTitle id="close-ticket-title">ยืนยันปิดการสนทนา</DialogTitle><DialogContent><Typography>ต้องการปิด {ticket?.ticketNo} ใช่หรือไม่?</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>เมื่อปิดแล้วจะอ่านประวัติได้ แต่ไม่สามารถส่งข้อความหรือเปิดเรื่องเดิมกลับมาได้</Typography></DialogContent><DialogActions><Button disabled={busy} onClick={() => setConfirm(false)}>กลับไปสนทนา</Button><Button disabled={busy} color="error" variant="contained" onClick={closeTicket}>{busy ? 'กำลังบันทึก…' : 'ยืนยันปิดการสนทนา'}</Button></DialogActions></Dialog>
  </>
}
