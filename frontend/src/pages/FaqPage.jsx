import { useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

const initialFaqItems = [
  {
    id: 'faq-001',
    question: 'ผู้ประกอบการต้องใช้บัญชีใดในการเข้าสู่ระบบ D-POMS?',
    category: 'การเข้าใช้งานระบบ',
    updatedDate: '2026-06-17',
    answer:
      'ผู้ประกอบการสามารถเข้าสู่ระบบด้วยบัญชี i-Industry ที่ใช้กับบริการของกระทรวงอุตสาหกรรม จากนั้นระบบจะแสดงข้อมูลโรงงานและเมนูที่ผู้ใช้งานมีสิทธิ์เข้าถึง',
  },
  {
    id: 'faq-002',
    question: 'หากระบบ CEMS หรือ BOD/COD Online ส่งข้อมูลไม่ได้ ต้องดำเนินการอย่างไร?',
    category: 'การเชื่อมต่อข้อมูล',
    updatedDate: '2026-06-12',
    answer:
      'ให้ตรวจสอบสถานะอุปกรณ์และการเชื่อมต่อก่อน หากไม่สามารถส่งข้อมูลได้ต่อเนื่อง ให้ดำเนินการแจ้งแบบที่เกี่ยวข้องตามประเภทของระบบและระยะเวลาที่หยุดส่งข้อมูล',
  },
  {
    id: 'faq-003',
    question: 'สามารถแก้ไขข้อมูลคำขอเชื่อมต่อหลังส่งแบบฟอร์มแล้วได้หรือไม่?',
    category: 'ขอเชื่อมต่อ',
    updatedDate: '2026-06-05',
    answer:
      'หากคำขอยังอยู่ในสถานะร่างหรือถูกส่งกลับให้แก้ไข ผู้ใช้งานสามารถปรับปรุงข้อมูลและส่งใหม่ได้ แต่หากอยู่ระหว่างการพิจารณาให้รอผลจากเจ้าหน้าที่ก่อน',
  },
  {
    id: 'faq-004',
    question: 'รายงานสถิติสามารถดาวน์โหลดเป็นไฟล์ได้หรือไม่?',
    category: 'รายงานและสถิติ',
    updatedDate: '2026-05-28',
    answer:
      'ในหน้ารายงานที่รองรับการส่งออก ผู้ใช้งานสามารถกดปุ่มส่งออกเพื่อดาวน์โหลดข้อมูลตามสิทธิ์และเงื่อนไขที่เลือกไว้',
  },
]

const faqCategories = [
  'การเข้าใช้งานระบบ',
  'การเชื่อมต่อข้อมูล',
  'ขอเชื่อมต่อ',
  'การแจ้งแบบ กวภ.',
  'รายงานและสถิติ',
]

const emptyForm = {
  question: '',
  category: '',
  updatedDate: '',
  answer: '',
}

function createFaqId() {
  return `faq-${Date.now()}`
}

function FaqPage({ isAdmin = false }) {
  const [faqs, setFaqs] = useState(initialFaqItems)
  const [searchText, setSearchText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [dialogMode, setDialogMode] = useState('')
  const [selectedFaq, setSelectedFaq] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const filteredFaqs = useMemo(() => {
    const normalizedSearchText = searchText.trim().toLowerCase()

    return faqs.filter((faq) => {
      const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory
      const matchesSearch =
        !normalizedSearchText ||
        faq.question.toLowerCase().includes(normalizedSearchText) ||
        faq.answer.toLowerCase().includes(normalizedSearchText)

      return matchesCategory && matchesSearch
    })
  }, [faqs, searchText, selectedCategory])

  const openCreateDialog = () => {
    setSelectedFaq(null)
    setForm({
      ...emptyForm,
      updatedDate: new Date().toISOString().slice(0, 10),
    })
    setErrors({})
    setDialogMode('create')
  }

  const openEditDialog = (faq) => {
    setSelectedFaq(faq)
    setForm({
      question: faq.question,
      category: faq.category,
      updatedDate: faq.updatedDate,
      answer: faq.answer,
    })
    setErrors({})
    setDialogMode('edit')
  }

  const openDeleteDialog = (faq) => {
    setSelectedFaq(faq)
    setDialogMode('delete')
  }

  const closeDialog = () => {
    setDialogMode('')
    setSelectedFaq(null)
    setErrors({})
  }

  const updateForm = (name, value) => {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
    setErrors((current) => ({
      ...current,
      [name]: '',
    }))
  }

  const validateForm = () => {
    const nextErrors = {}

    if (!form.question.trim()) {
      nextErrors.question = 'กรุณากรอกคำถาม'
    }

    if (!form.category) {
      nextErrors.category = 'กรุณาเลือกหมวดหมู่'
    }

    if (!form.updatedDate) {
      nextErrors.updatedDate = 'กรุณาเลือกวันที่อัปเดต'
    }

    if (!form.answer.trim()) {
      nextErrors.answer = 'กรุณากรอกคำตอบ'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const saveFaq = () => {
    if (!validateForm()) {
      return
    }

    if (dialogMode === 'edit' && selectedFaq) {
      setFaqs((current) =>
        current.map((faq) =>
          faq.id === selectedFaq.id
            ? {
                ...faq,
                ...form,
              }
            : faq,
        ),
      )
    } else {
      setFaqs((current) => [
        ...current,
        {
          id: createFaqId(),
          ...form,
        },
      ])
    }

    closeDialog()
  }

  const deleteFaq = () => {
    if (selectedFaq) {
      setFaqs((current) => current.filter((faq) => faq.id !== selectedFaq.id))
    }

    closeDialog()
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
                คำถามที่พบบ่อย
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ค้นหาคำถามและคำตอบเกี่ยวกับการใช้งานระบบ D-POMS
              </Typography>
            </Box>
            {isAdmin ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
                เพิ่มคำถาม
              </Button>
            ) : null}
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2 },
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Stack spacing={2}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 240px' },
                gap: 1.5,
              }}
            >
              <TextField
                size="small"
                placeholder="ค้นหาคำถามหรือคำตอบ"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                fullWidth
              />
              <TextField
                select
                size="small"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                fullWidth
              >
                <MenuItem value="all">ทุกหมวดหมู่</MenuItem>
                {faqCategories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Stack spacing={1.5}>
              {filteredFaqs.length > 0 ? (
                filteredFaqs.map((faq, index) => (
                  <FaqListItem
                    key={faq.id}
                    faq={faq}
                    isAdmin={isAdmin}
                    defaultExpanded={index === 0}
                    onEdit={openEditDialog}
                    onDelete={openDeleteDialog}
                  />
                ))
              ) : (
                <Box
                  sx={{
                    p: 3,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    textAlign: 'center',
                    color: 'text.secondary',
                  }}
                >
                  ไม่พบคำถามที่ตรงกับเงื่อนไข
                </Box>
              )}
            </Stack>
          </Stack>
        </Paper>
      </Stack>

      <FaqFormDialog
        open={dialogMode === 'create' || dialogMode === 'edit'}
        mode={dialogMode}
        form={form}
        errors={errors}
        onChange={updateForm}
        onClose={closeDialog}
        onSave={saveFaq}
      />

      <Dialog open={dialogMode === 'delete'} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle>ลบคำถาม</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            ต้องการลบคำถาม “{selectedFaq?.question}” หรือไม่
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>ยกเลิก</Button>
          <Button color="error" variant="contained" onClick={deleteFaq}>
            ลบ
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function FaqListItem({ faq, isAdmin, defaultExpanded, onEdit, onDelete }) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'neutral.200',
        borderRadius: '8px !important',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        '&:before': {
          display: 'none',
        },
        '&.Mui-expanded': {
          borderColor: 'primary.200',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
        },
      }}
    >
      <AccordionSummary
        expandIcon={
          <Box
            sx={{
              width: 32,
              height: 32,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 1,
              color: 'text.secondary',
              bgcolor: 'neutral.100',
            }}
          >
            <ExpandMoreIcon />
          </Box>
        }
        sx={{
          px: 2,
          py: 0.5,
          '& .MuiAccordionSummary-content': {
            my: 1.5,
            minWidth: 0,
          },
          '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': {
            transform: 'rotate(180deg)',
          },
        }}
      >
        <Stack spacing={1} sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, color: 'neutral.900', lineHeight: 1.45 }}>
            {faq.question}
          </Typography>
          <Stack direction="row" spacing={1.25} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip
              label={faq.category}
              size="small"
              sx={{
                bgcolor: 'primary.50',
                color: 'primary.dark',
                fontWeight: 600,
              }}
            />
            <Typography variant="body2" color="text.secondary">
              อัปเดต {faq.updatedDate}
            </Typography>
          </Stack>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: '#fbfdff',
            color: 'neutral.700',
            lineHeight: 1.75,
          }}
        >
          <Typography sx={{ whiteSpace: 'pre-line' }}>{faq.answer}</Typography>
          {isAdmin ? (
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', pt: 1.5 }}>
              <Tooltip title="แก้ไข">
                <IconButton color="primary" onClick={() => onEdit(faq)}>
                  <EditIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="ลบ">
                <IconButton color="error" onClick={() => onDelete(faq)}>
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          ) : null}
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}

function FaqFormDialog({ open, mode, form, errors, onChange, onClose, onSave }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === 'edit' ? 'แก้ไขคำถาม' : 'เพิ่มคำถาม'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.25} sx={{ pt: 1 }}>
          <TextField
            label="คำถาม"
            value={form.question}
            error={Boolean(errors.question)}
            helperText={errors.question}
            onChange={(event) => onChange('question', event.target.value)}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              label="หมวดหมู่"
              value={form.category}
              error={Boolean(errors.category)}
              helperText={errors.category}
              onChange={(event) => onChange('category', event.target.value)}
              fullWidth
            >
              {faqCategories.map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="วันที่อัปเดต"
              type="date"
              value={form.updatedDate}
              error={Boolean(errors.updatedDate)}
              helperText={errors.updatedDate}
              onChange={(event) => onChange('updatedDate', event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Stack>
          <TextField
            label="คำตอบ"
            value={form.answer}
            error={Boolean(errors.answer)}
            helperText={errors.answer}
            onChange={(event) => onChange('answer', event.target.value)}
            fullWidth
            multiline
            minRows={5}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ยกเลิก</Button>
        <Button variant="contained" onClick={onSave}>
          บันทึก
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default FaqPage
