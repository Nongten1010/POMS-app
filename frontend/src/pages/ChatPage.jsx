import { useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SendIcon from '@mui/icons-material/Send'

const statusConfig = {
  waiting: { label: 'รอเจ้าหน้าที่', color: 'warning' },
  inProgress: { label: 'กำลังดำเนินการ', color: 'primary' },
  closed: { label: 'ปิดเรื่องแล้ว', color: 'success' },
}

const statusOptions = [
  { value: 'all', label: 'ทุกสถานะ' },
  { value: 'waiting', label: statusConfig.waiting.label },
  { value: 'inProgress', label: statusConfig.inProgress.label },
  { value: 'closed', label: statusConfig.closed.label },
]

const categoryOptions = [
  'การเชื่อมต่อข้อมูล',
  'ข้อมูลโรงงาน',
  'แบบ กวภ.',
  'รายงานและสถิติ',
  'การเข้าใช้งานระบบ',
]

const initialThreads = [
  {
    id: 'chat-001',
    title: 'ปัญหาการส่งข้อมูล CEMS ไม่ต่อเนื่อง',
    status: 'waiting',
    category: 'การเชื่อมต่อข้อมูล',
    operatorName: 'บริษัท ตัวอย่างอุตสาหกรรม จำกัด',
    updatedAt: 'วันนี้ 10:24',
    messages: [
      {
        id: 'msg-001',
        role: 'operator',
        sender: 'ผู้ประกอบการ',
        time: 'วันนี้ 10:24',
        text: 'ระบบ CEMS ของโรงงานส่งข้อมูลเข้าระบบ D-POMS ไม่ต่อเนื่องตั้งแต่ช่วงเช้า แต่ฝั่งอุปกรณ์ยังแสดงค่าตรวจวัดตามปกติ ต้องตรวจสอบจุดใดก่อนครับ',
      },
      {
        id: 'msg-002',
        role: 'officer',
        sender: 'เจ้าหน้าที่ กวภ.',
        time: 'วันนี้ 10:42',
        text: 'เบื้องต้นให้ตรวจสอบสถานะ API Token, เวลาเครื่อง Server, และ log การส่งข้อมูลล่าสุด หากพบ error code จากระบบให้แนบภาพหรือข้อความ error กลับมาในกระทู้นี้ได้เลย',
      },
      {
        id: 'msg-003',
        role: 'operator',
        sender: 'ผู้ประกอบการ',
        time: 'วันนี้ 11:05',
        text: 'ตรวจสอบแล้วพบ error timeout จาก gateway ผมแนบ log เพิ่มเติมให้เจ้าหน้าที่ตรวจสอบต่อครับ',
      },
    ],
  },
  {
    id: 'chat-002',
    title: 'ขอแก้ไขข้อมูลโรงงานในระบบ',
    status: 'inProgress',
    category: 'ข้อมูลโรงงาน',
    operatorName: 'บริษัท โรงงานตัวอย่าง จำกัด',
    updatedAt: 'เมื่อวาน 16:40',
    messages: [
      {
        id: 'msg-004',
        role: 'operator',
        sender: 'ผู้ประกอบการ',
        time: 'เมื่อวาน 16:40',
        text: 'ข้อมูลเบอร์ติดต่อของผู้ประสานงานไม่ถูกต้อง ต้องการแก้ไขข้อมูลในระบบครับ',
      },
      {
        id: 'msg-005',
        role: 'officer',
        sender: 'เจ้าหน้าที่ กวภ.',
        time: 'เมื่อวาน 17:05',
        text: 'รับเรื่องแล้ว กรุณาแนบเอกสารหรือหนังสือมอบอำนาจที่เกี่ยวข้องเพื่อประกอบการแก้ไขข้อมูล',
      },
    ],
  },
  {
    id: 'chat-003',
    title: 'สอบถามการแจ้งแบบ กวภ. 02',
    status: 'closed',
    category: 'แบบ กวภ.',
    operatorName: 'บริษัท ระบบน้ำอุตสาหกรรม จำกัด',
    updatedAt: '2026-06-14',
    messages: [
      {
        id: 'msg-006',
        role: 'operator',
        sender: 'ผู้ประกอบการ',
        time: '2026-06-14',
        text: 'กรณีหยุดส่งข้อมูลเกิน 14 วันต้องแนบเอกสารใดบ้างครับ',
      },
      {
        id: 'msg-007',
        role: 'officer',
        sender: 'เจ้าหน้าที่ กวภ.',
        time: '2026-06-14',
        text: 'ให้แนบรายละเอียดสาเหตุ ช่วงเวลาที่หยุดส่งข้อมูล และเอกสารประกอบการแก้ไขปัญหาตามแบบที่ระบบกำหนด',
      },
    ],
  },
  {
    id: 'chat-004',
    title: 'สอบถามรายงานสถิติรายเดือน',
    status: 'inProgress',
    category: 'รายงานและสถิติ',
    operatorName: 'บริษัท ข้อมูลสิ่งแวดล้อม จำกัด',
    updatedAt: '2026-06-13',
    messages: [
      {
        id: 'msg-008',
        role: 'operator',
        sender: 'ผู้ประกอบการ',
        time: '2026-06-13',
        text: 'ต้องการดาวน์โหลดข้อมูลเฉพาะจังหวัดและช่วงเวลา ต้องเลือกเงื่อนไขจากเมนูใดครับ',
      },
    ],
  },
  {
    id: 'chat-005',
    title: 'ไม่พบโรงงานในหน้าขอเชื่อมต่อ',
    status: 'waiting',
    category: 'การเข้าใช้งานระบบ',
    operatorName: 'บริษัท เครื่องจักรกลาง จำกัด',
    updatedAt: '2026-06-12',
    messages: [
      {
        id: 'msg-009',
        role: 'operator',
        sender: 'ผู้ประกอบการ',
        time: '2026-06-12',
        text: 'เข้าสู่ระบบแล้วไม่พบรายการโรงงานที่ต้องการยื่นคำขอเชื่อมต่อครับ',
      },
    ],
  },
  {
    id: 'chat-006',
    title: 'ขอเปลี่ยนอีเมลผู้ประสานงาน',
    status: 'closed',
    category: 'ข้อมูลโรงงาน',
    operatorName: 'บริษัท ตัวอย่างผลิตภัณฑ์ จำกัด',
    updatedAt: '2026-06-10',
    messages: [
      {
        id: 'msg-010',
        role: 'operator',
        sender: 'ผู้ประกอบการ',
        time: '2026-06-10',
        text: 'อีเมลเดิมไม่สามารถใช้งานได้ ต้องการเปลี่ยนผู้รับแจ้งเตือนของโรงงานครับ',
      },
    ],
  },
  {
    id: 'chat-007',
    title: 'แนบไฟล์ประกอบแบบ กวภ. ไม่สำเร็จ',
    status: 'inProgress',
    category: 'แบบ กวภ.',
    operatorName: 'บริษัท ระบบบำบัดตัวอย่าง จำกัด',
    updatedAt: '2026-06-09',
    messages: [
      {
        id: 'msg-011',
        role: 'operator',
        sender: 'ผู้ประกอบการ',
        time: '2026-06-09',
        text: 'ระบบแจ้งว่าไฟล์มีขนาดเกิน ทั้งที่ไฟล์ไม่ถึง 5 MB ต้องปรับรูปแบบไฟล์หรือไม่ครับ',
      },
    ],
  },
]

const newQuestionInitialForm = {
  title: '',
  category: '',
  message: '',
  attachmentName: '',
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}`
}

function getLatestMessage(thread) {
  return thread.messages[thread.messages.length - 1]?.text ?? ''
}

function ChatPage({ isStaff = false }) {
  const fileInputRef = useRef(null)
  const [threads, setThreads] = useState(initialThreads)
  const [selectedThreadId, setSelectedThreadId] = useState(initialThreads[0]?.id ?? '')
  const [searchText, setSearchText] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortMode, setSortMode] = useState('latest')
  const [replyText, setReplyText] = useState('')
  const [replyAttachmentName, setReplyAttachmentName] = useState('')
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false)
  const [newQuestionForm, setNewQuestionForm] = useState(newQuestionInitialForm)
  const [newQuestionErrors, setNewQuestionErrors] = useState({})
  const filteredThreads = useMemo(() => {
    const normalizedSearchText = searchText.trim().toLowerCase()
    const nextThreads = threads.filter((thread) => {
      const matchesStatus = selectedStatus === 'all' || thread.status === selectedStatus
      const matchesCategory = selectedCategory === 'all' || thread.category === selectedCategory
      const matchesSearch =
        !normalizedSearchText ||
        thread.title.toLowerCase().includes(normalizedSearchText) ||
        thread.operatorName.toLowerCase().includes(normalizedSearchText) ||
        thread.messages.some((message) => message.text.toLowerCase().includes(normalizedSearchText))

      return matchesStatus && matchesCategory && matchesSearch
    })

    if (sortMode === 'waiting') {
      return [...nextThreads].sort((first, second) => {
        if (first.status === second.status) {
          return 0
        }
        return first.status === 'waiting' ? -1 : 1
      })
    }

    if (sortMode === 'closed') {
      return [...nextThreads].sort((first, second) => {
        if (first.status === second.status) {
          return 0
        }
        return first.status === 'closed' ? -1 : 1
      })
    }

    return nextThreads
  }, [threads, searchText, selectedStatus, selectedCategory, sortMode])
  const selectedThread =
    threads.find((thread) => thread.id === selectedThreadId) ?? filteredThreads[0] ?? threads[0] ?? null
  const canReply = Boolean(selectedThread) && selectedThread.status !== 'closed'

  const selectThread = (threadId) => {
    setSelectedThreadId(threadId)
    setReplyText('')
    setReplyAttachmentName('')
  }

  const updateThreadStatus = (threadId, status) => {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              status,
              updatedAt: 'วันนี้',
            }
          : thread,
      ),
    )
  }

  const submitReply = (event) => {
    event.preventDefault()

    if (!selectedThread || !canReply || (!replyText.trim() && !replyAttachmentName)) {
      return
    }

    const textParts = []

    if (replyText.trim()) {
      textParts.push(replyText.trim())
    }

    if (replyAttachmentName) {
      textParts.push(`ไฟล์แนบ: ${replyAttachmentName}`)
    }

    setThreads((current) =>
      current.map((thread) =>
        thread.id === selectedThread.id
          ? {
              ...thread,
              status: isStaff && thread.status === 'waiting' ? 'inProgress' : thread.status,
              updatedAt: 'วันนี้',
              messages: [
                ...thread.messages,
                {
                  id: makeId('msg'),
                  role: isStaff ? 'officer' : 'operator',
                  sender: isStaff ? 'เจ้าหน้าที่ กวภ.' : 'ผู้ประกอบการ',
                  time: 'ตอนนี้',
                  text: textParts.join('\n'),
                },
              ],
            }
          : thread,
      ),
    )
    setReplyText('')
    setReplyAttachmentName('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const updateNewQuestionForm = (name, value) => {
    setNewQuestionForm((current) => ({
      ...current,
      [name]: value,
    }))
    setNewQuestionErrors((current) => ({
      ...current,
      [name]: '',
    }))
  }

  const closeQuestionDialog = () => {
    setIsQuestionDialogOpen(false)
    setNewQuestionForm(newQuestionInitialForm)
    setNewQuestionErrors({})
  }

  const submitQuestion = () => {
    const nextErrors = {}

    if (!newQuestionForm.title.trim()) {
      nextErrors.title = 'กรุณากรอกเรื่อง'
    }

    if (!newQuestionForm.category) {
      nextErrors.category = 'กรุณาเลือกหมวดหมู่'
    }

    if (!newQuestionForm.message.trim()) {
      nextErrors.message = 'กรุณากรอกข้อความ'
    }

    setNewQuestionErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    const threadId = makeId('chat')
    const messageText = newQuestionForm.attachmentName
      ? `${newQuestionForm.message.trim()}\nไฟล์แนบ: ${newQuestionForm.attachmentName}`
      : newQuestionForm.message.trim()

    setThreads((current) => [
      {
        id: threadId,
        title: newQuestionForm.title.trim(),
        status: 'waiting',
        category: newQuestionForm.category,
        operatorName: 'บริษัท ตัวอย่างอุตสาหกรรม จำกัด',
        updatedAt: 'ตอนนี้',
        messages: [
          {
            id: makeId('msg'),
            role: 'operator',
            sender: 'ผู้ประกอบการ',
            time: 'ตอนนี้',
            text: messageText,
          },
        ],
      },
      ...current,
    ])
    setSelectedThreadId(threadId)
    closeQuestionDialog()
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto', bgcolor: 'background.default' }}>
      <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
        <Paper
          elevation={0}
          sx={{
            px: { xs: 1.5, md: 2 },
            py: 1.5,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={1.5}
            sx={{ alignItems: { xs: 'stretch', lg: 'center' } }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h5" component="h1">
                Chat
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsQuestionDialogOpen(true)}>
              ตั้งคำถาม
            </Button>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '360px minmax(0, 1fr)' },
            flex: 1,
            minHeight: { xs: 720, lg: 0 },
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <ThreadListPanel
            threads={filteredThreads}
            selectedThreadId={selectedThread?.id ?? ''}
            searchText={searchText}
            selectedStatus={selectedStatus}
            selectedCategory={selectedCategory}
            sortMode={sortMode}
            onSearchChange={setSearchText}
            onStatusChange={setSelectedStatus}
            onCategoryChange={setSelectedCategory}
            onSortChange={setSortMode}
            onSelectThread={selectThread}
          />
          <ChatThreadPanel
            thread={selectedThread}
            isStaff={isStaff}
            replyText={replyText}
            replyAttachmentName={replyAttachmentName}
            canReply={canReply}
            fileInputRef={fileInputRef}
            onReplyTextChange={setReplyText}
            onReplyAttachmentChange={setReplyAttachmentName}
            onSubmitReply={submitReply}
            onCloseThread={() => updateThreadStatus(selectedThread.id, 'closed')}
            onReopenThread={() => updateThreadStatus(selectedThread.id, 'inProgress')}
          />
        </Paper>
      </Stack>

      <QuestionDialog
        open={isQuestionDialogOpen}
        form={newQuestionForm}
        errors={newQuestionErrors}
        onChange={updateNewQuestionForm}
        onClose={closeQuestionDialog}
        onSubmit={submitQuestion}
      />
    </Box>
  )
}

function ThreadListPanel({
  threads,
  selectedThreadId,
  searchText,
  selectedStatus,
  selectedCategory,
  sortMode,
  onSearchChange,
  onStatusChange,
  onCategoryChange,
  onSortChange,
  onSelectThread,
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateRows: { xs: 'auto auto', lg: 'auto minmax(0, 1fr) auto' },
        minHeight: 0,
        borderRight: { xs: 0, lg: 1 },
        borderBottom: { xs: 1, lg: 0 },
        borderColor: 'divider',
        bgcolor: '#fbfdff',
      }}
    >
      <Stack spacing={1.5} sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <TextField
          size="small"
          placeholder="ค้นหาเรื่องหรือข้อความ"
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          fullWidth
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
          <TextField
            select
            size="small"
            value={selectedStatus}
            onChange={(event) => onStatusChange(event.target.value)}
            fullWidth
          >
            {statusOptions.map((status) => (
              <MenuItem key={status.value} value={status.value}>
                {status.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            value={selectedCategory}
            onChange={(event) => onCategoryChange(event.target.value)}
            fullWidth
          >
            <MenuItem value="all">ทุกหมวดหมู่</MenuItem>
            {categoryOptions.map((category) => (
              <MenuItem key={category} value={category}>
                {category}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <TextField
          select
          size="small"
          value={sortMode}
          onChange={(event) => onSortChange(event.target.value)}
          fullWidth
        >
          <MenuItem value="latest">เรียง: ล่าสุดก่อน</MenuItem>
          <MenuItem value="waiting">เรียง: รอนานที่สุดก่อน</MenuItem>
          <MenuItem value="closed">เรียง: ปิดเรื่องล่าสุด</MenuItem>
        </TextField>
      </Stack>

      <Stack
        spacing={1}
        sx={{
          minHeight: 0,
          p: 1.5,
          overflow: 'auto',
          display: { xs: 'grid', lg: 'flex' },
          gridAutoFlow: { xs: 'column', lg: 'row' },
          gridAutoColumns: { xs: 'minmax(260px, 1fr)', lg: 'auto' },
        }}
      >
        {threads.length > 0 ? (
          threads.map((thread) => (
            <ThreadListItem
              key={thread.id}
              thread={thread}
              selected={thread.id === selectedThreadId}
              onSelect={() => onSelectThread(thread.id)}
            />
          ))
        ) : (
          <Box
            sx={{
              p: 2,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              color: 'text.secondary',
              bgcolor: 'background.paper',
              textAlign: 'center',
            }}
          >
            ไม่พบเรื่องที่ตรงกับเงื่อนไข
          </Box>
        )}
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        sx={{
          display: { xs: 'none', lg: 'flex' },
          p: 1.25,
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <IconButton size="small" aria-label="หน้าก่อนหน้า">
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="body2" color="text.secondary">
          หน้า 1 / 50 · 25 รายการ
        </Typography>
        <IconButton size="small" aria-label="หน้าถัดไป">
          <ChevronRightIcon />
        </IconButton>
      </Stack>
    </Box>
  )
}

function ThreadListItem({ thread, selected, onSelect }) {
  const status = statusConfig[thread.status]

  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      sx={{
        display: 'grid',
        gap: 1,
        width: '100%',
        p: 1.5,
        border: 1,
        borderColor: selected ? 'primary.200' : 'transparent',
        borderRadius: 1,
        bgcolor: selected ? 'primary.50' : 'transparent',
        textAlign: 'left',
        cursor: 'pointer',
        '&:hover': {
          borderColor: 'divider',
          bgcolor: selected ? 'primary.50' : 'background.paper',
        },
      }}
    >
      <Typography sx={{ fontWeight: 600, color: 'neutral.900', lineHeight: 1.45 }}>
        {thread.title}
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <StatusChip status={status} />
        <Typography variant="body2" color="text.secondary">
          {thread.updatedAt}
        </Typography>
      </Stack>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {getLatestMessage(thread)}
      </Typography>
    </Box>
  )
}

function ChatThreadPanel({
  thread,
  isStaff,
  replyText,
  replyAttachmentName,
  canReply,
  fileInputRef,
  onReplyTextChange,
  onReplyAttachmentChange,
  onSubmitReply,
  onCloseThread,
  onReopenThread,
}) {
  if (!thread) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 360, color: 'text.secondary' }}>
        เลือกเรื่องที่ต้องการดูรายละเอียด
      </Box>
    )
  }

  const status = statusConfig[thread.status]

  return (
    <Box sx={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', minWidth: 0, minHeight: 0 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{
          p: { xs: 2, md: 2.5 },
          alignItems: { xs: 'stretch', md: 'flex-start' },
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" component="h2" sx={{ lineHeight: 1.45 }}>
            {thread.title}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusChip status={status} />
            <Typography variant="body2" color="text.secondary">
              ผู้ประกอบการ: {thread.operatorName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              หมวดหมู่: {thread.category}
            </Typography>
          </Stack>
        </Box>
        {isStaff ? (
          thread.status === 'closed' ? (
            <Button variant="outlined" onClick={onReopenThread}>
              เปิดเรื่องอีกครั้ง
            </Button>
          ) : (
            <Button variant="outlined" color="inherit" onClick={onCloseThread}>
              ปิดเรื่อง
            </Button>
          )
        ) : null}
      </Stack>

      <Stack
        spacing={1.75}
        sx={{
          minHeight: 0,
          p: { xs: 2, md: 2.5 },
          overflow: 'auto',
          background:
            'linear-gradient(rgba(255,255,255,0.82), rgba(255,255,255,0.82)), repeating-linear-gradient(135deg, #f8fafc 0, #f8fafc 12px, #ffffff 12px, #ffffff 24px)',
        }}
      >
        {thread.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </Stack>

      <Box
        component="form"
        onSubmit={onSubmitReply}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '44px minmax(0, 1fr)', sm: '44px minmax(0, 1fr) auto' },
          gap: 1.25,
          alignItems: 'end',
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Tooltip title="แนบไฟล์">
          <IconButton
            component="label"
            disabled={!canReply}
            sx={{ width: 44, height: 44, border: 1, borderColor: 'divider', borderRadius: 1 }}
          >
            <AttachFileIcon />
            <Box
              component="input"
              ref={fileInputRef}
              type="file"
              hidden
              onChange={(event) => onReplyAttachmentChange(event.target.files?.[0]?.name ?? '')}
            />
          </IconButton>
        </Tooltip>
        <TextField
          multiline
          maxRows={4}
          placeholder={canReply ? 'พิมพ์ข้อความตอบกลับ' : 'เรื่องนี้ปิดแล้ว'}
          value={replyAttachmentName ? `${replyText}${replyText ? '\n' : ''}ไฟล์แนบ: ${replyAttachmentName}` : replyText}
          onChange={(event) => onReplyTextChange(event.target.value.replace(`\nไฟล์แนบ: ${replyAttachmentName}`, '').replace(`ไฟล์แนบ: ${replyAttachmentName}`, ''))}
          disabled={!canReply}
          fullWidth
        />
        <Button
          type="submit"
          variant="contained"
          startIcon={<SendIcon />}
          disabled={!canReply || (!replyText.trim() && !replyAttachmentName)}
          sx={{ minHeight: 44, gridColumn: { xs: '1 / -1', sm: 'auto' } }}
        >
          ส่ง
        </Button>
      </Box>
    </Box>
  )
}

function MessageBubble({ message }) {
  const isOperator = message.role === 'operator'

  return (
    <Box sx={{ display: 'flex', justifyContent: isOperator ? 'flex-end' : 'flex-start' }}>
      <Stack spacing={0.75} sx={{ maxWidth: { xs: '92%', md: '78%' } }}>
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: isOperator ? 'right' : 'left' }}>
          {message.sender} · {message.time}
        </Typography>
        <Box
          sx={{
            px: 1.75,
            py: 1.5,
            border: 1,
            borderColor: isOperator ? 'primary.200' : 'divider',
            borderRadius: 1,
            bgcolor: isOperator ? 'primary.50' : 'background.paper',
            color: isOperator ? 'neutral.900' : 'neutral.700',
            lineHeight: 1.75,
            whiteSpace: 'pre-line',
          }}
        >
          {message.text}
        </Box>
      </Stack>
    </Box>
  )
}

function StatusChip({ status }) {
  return (
    <Chip
      label={status.label}
      size="small"
      color={status.color}
      sx={{ fontWeight: 600 }}
    />
  )
}

function QuestionDialog({ open, form, errors, onChange, onClose, onSubmit }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>ตั้งคำถาม</DialogTitle>
      <DialogContent>
        <Stack spacing={2.25} sx={{ pt: 1 }}>
          <TextField
            label="เรื่อง"
            value={form.title}
            error={Boolean(errors.title)}
            helperText={errors.title}
            onChange={(event) => onChange('title', event.target.value)}
            fullWidth
          />
          <TextField
            select
            label="หมวดหมู่"
            value={form.category}
            error={Boolean(errors.category)}
            helperText={errors.category}
            onChange={(event) => onChange('category', event.target.value)}
            fullWidth
          >
            {categoryOptions.map((category) => (
              <MenuItem key={category} value={category}>
                {category}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="ข้อความ"
            value={form.message}
            error={Boolean(errors.message)}
            helperText={errors.message}
            onChange={(event) => onChange('message', event.target.value)}
            multiline
            minRows={5}
            fullWidth
          />
          <Button
            variant="outlined"
            component="label"
            startIcon={<AttachFileIcon />}
            sx={{ justifyContent: 'flex-start', minHeight: 44, color: form.attachmentName ? 'neutral.900' : 'neutral.600' }}
          >
            {form.attachmentName || 'แนบไฟล์'}
            <Box
              component="input"
              type="file"
              hidden
              onChange={(event) => onChange('attachmentName', event.target.files?.[0]?.name ?? '')}
            />
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ยกเลิก</Button>
        <Button variant="contained" onClick={onSubmit}>
          บันทึก
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ChatPage
