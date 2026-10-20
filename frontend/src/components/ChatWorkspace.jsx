import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Box, Button, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material'
import { DataGrid, getGridDateOperators, getGridSingleSelectOperators, getGridStringOperators } from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import ChatIcon from '@mui/icons-material/Chat'
import RefreshIcon from '@mui/icons-material/Refresh'
import ChatCreateDialog from './ChatCreateDialog'
import ChatConversation from './ChatConversation'
import useChatResource from './useChatResource'
import { TicketStatus } from './chatPresentation'
import { createChatClient, errorText, formatChatDate } from '../utils/chatApi.mjs'
import chatTopics from '../option/chatTopicOptions.json'
import { CHAT_MESSAGE_MAX_LENGTH, hasChatReplyBadge } from '../utils/chatSession.mjs'

export default function ChatWorkspace({ accessToken, viewerId, userType, onAccessError }) {
  const client = useMemo(() => createChatClient(accessToken, { userType }), [accessToken, userType])
  const [drafts] = useState(() => new Map())
  const [selectedId, setSelectedId] = useState(null)
  const [newOpen, setNewOpen] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 })
  const [sort, setSort] = useState([{ field: 'latest', sort: 'desc' }])
  const [filter, setFilter] = useState({ items: [], quickFilterValues: [] })
  const [revision, setRevision] = useState(0)
  const handleError = useCallback((error) => {
    if ([401, 403].includes(error.status)) {
      setAccessError(errorText(error)); setSelectedId(null); setNewOpen(false); drafts.clear(); onAccessError?.(error.status)
    } else if (error.status === 404) {
      setSelectedId(null); setRevision((value) => value + 1)
    }
  }, [onAccessError, drafts])
  const handleListError = useCallback((error) => {
    if ([401, 403].includes(error.status)) handleError(error)
  }, [handleError])
  const list = useChatResource(client, '/tickets', {}, !accessError, handleListError)
  const refreshList = list.refresh
  useEffect(() => () => { client.dispose(); drafts.clear() }, [client, drafts])
  useEffect(() => {
    if (!revision) return
    refreshList()
  }, [revision, refreshList])
  const data = { viewer: { userId: viewerId, userType }, limits: { messageMaxLength: CHAT_MESSAGE_MAX_LENGTH } }
  const canCreate = userType === 'operator' && !accessError
  const rows = (list.response?.data || []).map((ticket) => ({ ...ticket, topic: ticket.topic.code, topicLabel: ticket.topic.label, factoryName: ticket.factory.name, registration: ticket.factory.registrationNo, region: ticket.factory.regionName || '-', province: ticket.factory.provinceName, latest: new Date(ticket.lastMessageAt) }))
  const columns = [
    { field: 'ticketNo', headerName: 'Ticket No.', width: 110, filterable: false },
    { field: 'topic', headerName: 'หัวข้อ', width: 220, type: 'singleSelect', valueOptions: chatTopics.map((topic) => ({ value: topic.code, label: topic.label })), filterOperators: getGridSingleSelectOperators().filter((operator) => operator.value === 'is') },
    { field: 'factoryName', headerName: 'ชื่อโรงงาน', width: 270, filterable: false },
    { field: 'registration', headerName: 'เลขทะเบียนโรงงาน', width: 160, filterable: false },
    { field: 'region', headerName: 'ภาค', width: 135, filterOperators: getGridStringOperators().filter((operator) => operator.value === 'equals') },
    { field: 'province', headerName: 'จังหวัด', width: 115, filterOperators: getGridStringOperators().filter((operator) => operator.value === 'equals') },
    { field: 'status', headerName: 'สถานะ', width: 120, type: 'singleSelect', valueOptions: [{ value: 'open', label: 'เปิดการสนทนา' }, { value: 'closed', label: 'ปิดการสนทนา' }], filterOperators: getGridSingleSelectOperators().filter((operator) => operator.value === 'is'), renderCell: ({ value }) => <TicketStatus status={value} /> },
    { field: 'latest', headerName: 'ข้อความล่าสุด', type: 'dateTime', width: 140, filterOperators: getGridDateOperators(true).filter((operator) => ['onOrAfter', 'onOrBefore'].includes(operator.value)), valueFormatter: (value) => formatChatDate(value) },
    { field: 'actions', headerName: 'จัดการ', width: 145, sortable: false, filterable: false, disableColumnMenu: true, disableExport: true, renderCell: ({ row }) => {
      const showBadge = hasChatReplyBadge(userType, row.lastMessageSenderType)
      const label = row.status === 'open' ? 'สนทนา' : 'ดูประวัติ'
      return <Badge color="error" variant="dot" invisible={!showBadge}>
        <Button size="small" variant={row.status === 'open' ? 'contained' : 'outlined'} startIcon={<ChatIcon />} aria-label={showBadge ? `${label}: มีข้อความล่าสุดจาก${userType === 'operator' ? 'เจ้าหน้าที่' : 'ผู้ประกอบการ'}` : label} onClick={() => setSelectedId(row.id)}>{label}</Button>
      </Badge>
    } },
  ]
  return <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
    <Paper elevation={0} sx={{ px: { xs: 1.5, md: 2 }, py: 1.5, border: 1, borderColor: 'divider' }}><Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', lg: 'center' } }}>
      <Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="h5" component="h1">Chat</Typography><Typography variant="body2" color="text.secondary">แจ้งปัญหาการใช้งานกับเจ้าหน้าที่</Typography></Box>
      <Tooltip title="รีเฟรชรายการ"><span><IconButton aria-label="รีเฟรชรายการ" disabled={list.loading || Boolean(accessError)} onClick={list.refresh}><RefreshIcon /></IconButton></span></Tooltip>
      {canCreate && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewOpen(true)}>เปิดการสนทนา</Button>}
    </Stack></Paper>
    {(accessError || list.error) && <Alert severity="error" action={!accessError && <Button onClick={list.refresh}>ลองใหม่</Button>}>{accessError || list.error}</Alert>}
    <Paper elevation={0} sx={{ flex: 1, minHeight: 0, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
      <DataGrid rows={accessError ? [] : rows} columns={columns} loading={list.loading} disableRowSelectionOnClick showToolbar showCellVerticalBorder showColumnVerticalBorder label="รายการสนทนา" pageSizeOptions={[25, 50, 100]}
        paginationMode="client" sortingMode="client" filterMode="client" paginationModel={pagination} sortModel={sort} filterModel={filter}
        onPaginationModelChange={setPagination} onSortModelChange={(value) => { setSort(value.slice(0, 1)); setPagination((current) => ({ ...current, page: 0 })) }}
        onFilterModelChange={(value) => { setFilter(value); setPagination((current) => ({ ...current, page: 0 })) }}
        slotProps={{ toolbar: { csvOptions: { disableToolbarButton: true }, printOptions: { disableToolbarButton: true }, showQuickFilter: true, quickFilterProps: { debounceMs: 400 } } }}
        localeText={{ toolbarColumns: 'คอลัมน์', toolbarFilters: 'ตัวกรอง', toolbarQuickFilterPlaceholder: 'ค้นหา Ticket หรือโรงงาน', filterPanelInputLabel: 'ค่า', filterPanelColumns: 'คอลัมน์', filterPanelOperator: 'เงื่อนไข', noRowsLabel: 'ไม่มีรายการสนทนา', noResultsOverlayLabel: 'ไม่พบรายการสนทนา', columnMenuSortAsc: 'เรียงจากน้อยไปมาก', columnMenuSortDesc: 'เรียงจากมากไปน้อย', columnMenuFilter: 'ตัวกรอง', columnMenuHideColumn: 'ซ่อนคอลัมน์', columnMenuManageColumns: 'จัดการคอลัมน์' }}
        sx={{ border: 0, '& .MuiDataGrid-columnHeaders': { borderTop: 1, borderBottom: 1, borderColor: 'divider' }, '& .MuiDataGrid-columnHeader': { borderColor: 'divider' }, '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600 }, '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center', borderColor: 'divider' }, '& .MuiDataGrid-row--lastVisible .MuiDataGrid-cell': { borderBottom: 1, borderColor: 'divider' }, '& .MuiDataGrid-toolbarLabel': { fontWeight: 600 } }} />
    </Paper>
    {canCreate && <ChatCreateDialog open={newOpen} client={client} options={data} onClose={() => setNewOpen(false)} onCreated={(ticket) => { setNewOpen(false); setSelectedId(ticket.id); list.refresh() }} onError={handleError} />}
    {selectedId && data && !accessError && <ChatConversation key={selectedId} id={selectedId} client={client} options={data} drafts={drafts} onDismiss={() => setSelectedId(null)} onChanged={list.refresh} onError={handleError} />}
  </Stack>
}
