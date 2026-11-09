import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Autocomplete, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import PersonRemoveIcon from '@mui/icons-material/PersonRemove'
import { canGrantOperatorAccess, createEligibleOperatorAccessApi, maskCitizenId } from '../utils/eligibleOperatorAccess.mjs'

const statusLabels = { active: 'มีสิทธิ์', revoked: 'ยกเลิกสิทธิ์', expired: 'สิ้นสุดสิทธิ์', suspended: 'ระงับชั่วคราว' }
const actionLabels = { granted: 'เพิ่มสิทธิ์', revoked: 'ยกเลิกสิทธิ์', expired: 'สิ้นสุดสิทธิ์', suspended: 'ระงับชั่วคราว' }
const dateText = (value) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(value)) : '-'

export default function EligibleOperatorAccessDialog({ factory, accessToken, onClose }) {
  const api = useMemo(() => createEligibleOperatorAccessApi({ accessToken, enabled: import.meta.env.VITE_ELIGIBLE_OPERATOR_ACCESS_ENABLED === 'true', isDevelopment: import.meta.env.DEV }), [accessToken])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [tab, setTab] = useState('members')
  const [action, setAction] = useState(null)
  const [reason, setReason] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitLock = useRef(false)
  const id = factory.eligibleFactoryId

  useEffect(() => {
    const controller = new AbortController()
    api.list(id, controller.signal).then((result) => {
      if (!controller.signal.aborted) { setData(result); setLoading(false) }
    }).catch((failure) => {
      if (!controller.signal.aborted) { setError(failure.message); setLoading(false) }
    })
    return () => controller.abort()
  }, [api, id, revision])

  useEffect(() => {
    if (action?.type !== 'grant' || query.trim().length < 2) return undefined
    const controller = new AbortController()
    const timer = setTimeout(() => {
      api.search(id, query.trim(), controller.signal).then((items) => {
        if (!controller.signal.aborted) { setOptions(items); setSearching(false) }
      }).catch((failure) => {
        if (!controller.signal.aborted) { setSearchError(failure.message); setSearching(false) }
      })
    }, 350)
    return () => { clearTimeout(timer); controller.abort() }
  }, [action, api, id, query])

  const refresh = () => { setData(null); setError(''); setLoading(true); setRevision((value) => value + 1) }
  const openAction = (next) => {
    setAction(next); setReason(''); setSelectedUser(null); setQuery(''); setOptions([]); setSearching(false); setSearchError(''); setActionError(''); setNotice('')
  }
  const canGrant = !loading && !error && canGrantOperatorAccess(factory, data)
  const canRevoke = !loading && !error && data?.items?.some((row) => row.id === action?.row?.id && row.canRevoke === true)
  const save = async () => {
    if (submitLock.current || !action || (action.type === 'grant' && (!canGrant || !selectedUser))) return
    if (action.type === 'revoke' && !canRevoke) return
    submitLock.current = true
    setBusy(true); setActionError('')
    try {
      if (action.type === 'grant') await api.grant(id, selectedUser.userId, reason)
      else await api.revoke(id, action.row.id, reason)
      setAction(null)
      setNotice(action.type === 'grant' ? 'เพิ่มสิทธิ์สำเร็จ' : 'ยกเลิกสิทธิ์สำเร็จ')
      refresh()
    } catch (failure) {
      setActionError(failure.message)
      // Re-read authority and grants after ambiguous failures before another mutation.
      refresh()
    } finally { submitLock.current = false; setBusy(false) }
  }

  const memberColumns = [
    { field: 'name', headerName: 'ผู้ประกอบการ', minWidth: 200, flex: 1 },
    { field: 'citizenIdMasked', headerName: 'เลขบัตรประชาชน', width: 170, valueFormatter: (value) => maskCitizenId(value) },
    { field: 'status', headerName: 'สถานะสิทธิ์', width: 140, valueFormatter: (value) => statusLabels[value] ?? value },
    { field: 'grantedAt', headerName: 'วันที่ผูก', width: 180, valueFormatter: dateText },
    { field: 'grantedByName', headerName: 'ผู้ให้สิทธิ์', width: 180 },
    { field: 'manage', headerName: 'จัดการ', width: 90, sortable: false, filterable: false, renderCell: ({ row }) => (
      <Tooltip title="ยกเลิกสิทธิ์"><span><IconButton aria-label={`ยกเลิกสิทธิ์ ${row.name}`} color="error" disabled={row.canRevoke !== true || busy || loading} onClick={() => openAction({ type: 'revoke', row })}><PersonRemoveIcon fontSize="small" /></IconButton></span></Tooltip>
    ) },
  ]
  const historyColumns = [
    { field: 'occurredAt', headerName: 'วันเวลา', width: 180, valueFormatter: dateText },
    { field: 'action', headerName: 'รายการ', width: 150, valueFormatter: (value) => actionLabels[value] ?? value },
    { field: 'name', headerName: 'ผู้ประกอบการ', minWidth: 200, flex: 1 },
    { field: 'actorName', headerName: 'ผู้ดำเนินการ', width: 180 },
    { field: 'reason', headerName: 'เหตุผล', minWidth: 220, flex: 1, valueFormatter: (value) => value || '-' },
  ]
  return <>
    <Dialog open fullWidth maxWidth="lg" onClose={busy ? undefined : onClose} aria-labelledby="operator-access-title" sx={{ '& .MuiDialog-paper': { m: { xs: 1, sm: 4 }, width: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 64px)' }, maxHeight: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 64px)' } } }}>
      <DialogTitle id="operator-access-title" sx={{ pr: 7 }}>จัดการผู้มีสิทธิ์
        <IconButton aria-label="ปิดจัดการผู้มีสิทธิ์" disabled={busy} onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography fontWeight={700}>{factory.factoryName}</Typography>
        <Typography variant="body2" color="text.secondary">{factory.factoryId} · {data?.factory?.operationStatus ?? factory.operationStatus}</Typography>
        <Stack direction="row" useFlexGap spacing={1} sx={{ mt: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ flex: { xs: '1 0 100%', sm: 1 }, minWidth: 0 }} aria-label="ข้อมูลสิทธิ์ผู้ประกอบการ"><Tab value="members" label="ผู้มีสิทธิ์" /><Tab value="history" label="ประวัติ" /></Tabs>
          <Tooltip title="รีเฟรช"><span><IconButton aria-label="รีเฟรชสิทธิ์" disabled={loading || busy} onClick={refresh}><RefreshIcon /></IconButton></span></Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} disabled={!canGrant || busy} onClick={() => openAction({ type: 'grant' })}>เพิ่มผู้มีสิทธิ์</Button>
        </Stack>
        {error && <Alert severity="warning" sx={{ my: 2 }}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ my: 2 }}>{notice}</Alert>}
        {data && !canGrant && <Alert severity="info" sx={{ my: 2 }}>{data.capabilities.grantUnavailableReason || 'เพิ่มสิทธิ์ได้เฉพาะโรงงานที่ยืนยันสถานะว่ายังไม่แจ้งประกอบ'}</Alert>}
        <Box sx={{ height: 380, minWidth: 0, mt: 2 }}>
          <DataGrid rows={tab === 'members' ? data?.items ?? [] : data?.history ?? []} columns={tab === 'members' ? memberColumns : historyColumns} loading={loading} disableRowSelectionOnClick pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} localeText={{ noRowsLabel: error ? 'ไม่สามารถแสดงข้อมูลได้' : tab === 'members' ? 'ยังไม่มีผู้ประกอบการที่ผูกสิทธิ์' : 'ยังไม่มีประวัติ' }} sx={{ borderColor: 'divider' }} />
        </Box>
      </DialogContent>
      <DialogActions><Button onClick={onClose} disabled={busy}>ปิด</Button></DialogActions>
    </Dialog>
    <Dialog open={Boolean(action)} fullWidth maxWidth="sm" onClose={busy ? undefined : () => setAction(null)} aria-labelledby="operator-access-action-title">
      <DialogTitle id="operator-access-action-title">{action?.type === 'grant' ? 'เพิ่มผู้มีสิทธิ์' : 'ยืนยันยกเลิกสิทธิ์'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography>{factory.factoryName}</Typography>
          {action?.type === 'grant' ? <Autocomplete options={options} value={selectedUser} loading={searching} disabled={busy} filterOptions={(items) => items} getOptionLabel={(item) => `${item.name} (${maskCitizenId(item.citizenIdMasked)})`} isOptionEqualToValue={(a, b) => a.userId === b.userId} onChange={(_, value) => setSelectedUser(value)} onInputChange={(_, value, cause) => {
            if (cause === 'input' || cause === 'clear') { setQuery(value); setSelectedUser(null); setOptions([]); setSearchError(''); setSearching(value.trim().length >= 2) }
          }} noOptionsText={query.trim().length < 2 ? 'พิมพ์ชื่อหรือเลขบัตรประชาชนอย่างน้อย 2 ตัวอักษร' : 'ไม่พบผู้ประกอบการ'} loadingText="กำลังค้นหา..." renderInput={(params) => <TextField {...params} label="ผู้ประกอบการ" required error={Boolean(searchError)} helperText={searchError} />} /> : <Typography>ยกเลิกสิทธิ์ของ {action?.row?.name} ในโรงงานนี้หรือไม่?</Typography>}
          <TextField label="เหตุผล (ไม่บังคับ)" multiline minRows={3} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} />
          {actionError && <Alert severity="error">{actionError}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button disabled={busy} onClick={() => setAction(null)}>ยกเลิก</Button>
        <Button variant="contained" color={action?.type === 'revoke' ? 'error' : 'primary'} disabled={busy || loading || Boolean(error) || (action?.type === 'grant' ? (!selectedUser || !canGrant || searching) : !canRevoke)} startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined} onClick={save}>{busy ? 'กำลังบันทึก' : action?.type === 'grant' ? 'ยืนยันเพิ่มสิทธิ์' : 'ยืนยันยกเลิกสิทธิ์'}</Button>
      </DialogActions>
    </Dialog>
  </>
}
