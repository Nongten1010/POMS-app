import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material'
import useChatResource from './useChatResource'
import { errorText, readAllChatFactories } from '../utils/chatApi.mjs'
import chatTopics from '../option/chatTopicOptions.json'

export default function ChatCreateDialog({ open, client, options, onClose, onCreated, onError }) {
  const [form, setForm] = useState({ factory: null, point: '', topic: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const lock = useRef(false)
  const live = useRef(false)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const handleReadError = useCallback((failure) => {
    if (failure.status === 404) {
      setForm((value) => ({ ...value, factory: null, point: '' }))
      setError(errorText(failure))
    }
    onError(failure)
  }, [onError])
  const factoryClient = useMemo(() => ({ request: (_path, { signal }) => readAllChatFactories(client, signal) }), [client])
  const factories = useChatResource(factoryClient, '/factories', {}, open, handleReadError)
  const points = useChatResource(client, `/factories/${form.factory?.id}/measurement-points`, {}, open && Boolean(form.factory), handleReadError)
  const list = factories.response?.data || []
  const selectedList = form.factory && !list.some((item) => item.id === form.factory.id) ? [form.factory, ...list] : list
  const maxLength = options.limits.messageMaxLength
  async function submit(event) {
    event.preventDefault()
    if (lock.current) return
    const point = points.response?.data.find((item) => `${item.kind}:${item.id}` === form.point)
    if (!pending && (!form.factory || !form.topic || !form.message.trim() || form.message.trim().length > maxLength || (form.point && !point))) return
    lock.current = true; setBusy(true); setError('')
    try {
      const result = await client.write('create', '/tickets', { eligibleFactoryId: Number(form.factory.id), measurementPoint: point ? { kind: point.kind, id: Number(point.id) } : null, topicCode: form.topic, message: form.message.trim() })
      if (!live.current) return
      setForm({ factory: null, point: '', topic: '', message: '' }); setPending(false)
      onCreated(result.data.ticket)
    } catch (failure) {
      if (!live.current || failure.name === 'AbortError') return
      setError(errorText(failure)); setPending(client.hasPending('create')); onError(failure)
      if (failure.status === 404) { setForm((value) => ({ ...value, factory: null, point: '' })); factories.refresh() }
    } finally { lock.current = false; if (live.current) setBusy(false) }
  }
  const locked = busy || pending
  return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="new-ticket-title">
    <Box component="form" onSubmit={submit}><DialogTitle id="new-ticket-title">เปิดการสนทนา</DialogTitle>
      <DialogContent><Stack sx={{ pt: 1.5, gap: 2.5 }}>
        <Alert severity="info">เพื่อให้เจ้าหน้าที่ตรวจสอบและตอบคำถามได้รวดเร็วยิ่งขึ้น กรุณาเลือกโรงงาน จุดตรวจวัด และหัวข้อให้ตรงกับเรื่องที่ต้องการสอบถาม พร้อมอธิบายปัญหาหรือคำถามอย่างละเอียดและชัดเจน</Alert>
        {error && <Alert severity="error">{error}</Alert>}
        {pending && <Alert severity="warning">ยังไม่ทราบผลคำขอเดิม กรุณาลองส่งคำขอเดิมอีกครั้งก่อนเริ่มเรื่องใหม่</Alert>}
        {factories.error && <Alert severity="error" action={<Button onClick={factories.refresh}>ลองใหม่</Button>}>{factories.error}</Alert>}
        <Autocomplete
          options={selectedList}
          value={form.factory}
          disabled={locked || factories.loading}
          getOptionLabel={(item) => [item.name, item.registrationNo].filter(Boolean).join(' · ')}
          getOptionKey={(item) => item.id}
          isOptionEqualToValue={(item, value) => item.id === value.id}
          onChange={(_event, factory) => setForm((value) => ({ ...value, factory, point: '' }))}
          noOptionsText="ไม่พบโรงงาน"
          clearText="ล้างโรงงานที่เลือก"
          openText="แสดงรายชื่อโรงงาน"
          closeText="ปิดรายชื่อโรงงาน"
          renderInput={(params) => <TextField {...params} label="โรงงาน" required helperText={factories.loading ? 'กำลังโหลดโรงงาน' : !list.length ? 'ไม่มีโรงงานที่เลือกได้' : ''} />}
        />
        {points.error && <Alert severity="error" action={<Button onClick={points.refresh}>ลองใหม่</Button>}>{points.error}</Alert>}
        <TextField select label="จุดตรวจวัด" value={form.point} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} disabled={locked || !form.factory || points.loading || Boolean(points.error)} onChange={(event) => setForm({ ...form, point: event.target.value })} helperText={points.loading ? 'กำลังโหลดจุดตรวจวัด' : ''}>
          <MenuItem value="">ทั้งหมด</MenuItem>{(points.response?.data || []).map((item) => <MenuItem key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>{[item.pointCode, item.pointName].filter(Boolean).join(' · ')}</MenuItem>)}
        </TextField>
        <TextField select label="หัวข้อ" required value={form.topic} disabled={locked} onChange={(event) => setForm({ ...form, topic: event.target.value })}>{chatTopics.map((topic) => <MenuItem sx={{ whiteSpace: 'normal' }} key={topic.code} value={topic.code}>{topic.label}</MenuItem>)}</TextField>
        <TextField label="ข้อความ" required multiline minRows={4} value={form.message} disabled={locked} onChange={(event) => setForm({ ...form, message: event.target.value })} slotProps={{ htmlInput: { maxLength } }} helperText={`${form.message.length.toLocaleString()} / ${maxLength.toLocaleString()}`} />
      </Stack></DialogContent>
      <DialogActions><Button disabled={busy} onClick={onClose}>ยกเลิก</Button><Button type="submit" variant="contained" disabled={busy || (!pending && (!form.factory || !form.topic || !form.message.trim() || points.loading || Boolean(points.error)))}>{busy ? 'กำลังส่ง…' : pending ? 'ลองส่งคำขอเดิมอีกครั้ง' : 'ส่งข้อความและเปิดการสนทนา'}</Button></DialogActions>
    </Box>
  </Dialog>
}
