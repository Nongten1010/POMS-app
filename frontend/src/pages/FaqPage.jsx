import { useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SearchIcon from '@mui/icons-material/Search'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjsBuddhist } from '@mui/x-date-pickers/AdapterDayjsBuddhist'
import dayjs from 'dayjs'
import 'dayjs/locale/th'
import {
  buildContentApiHeaders,
  getContentApiUrl,
  readContentApiResponse,
} from '../utils/contentApi.mjs'

const faqCategories = [
  { value: 'CEMS', label: 'CEMS' },
  { value: 'WPMS', label: 'WPMS' },
  { value: 'OTHER', label: 'อื่นๆ' },
]
const faqCategoryOptions = [
  { value: 'all', label: 'ทั้งหมด' },
  ...faqCategories,
]

const emptyForm = {
  question: '',
  category: '',
  updatedDate: '',
  answer: '',
}

function getFaqCategoryLabel(faq) {
  return (
    faq.categoryLabel ||
    faqCategories.find((option) => option.value === faq.category)?.label ||
    faq.category
  )
}

function formatBuddhistDate(value) {
  const date = dayjs(value)

  if (!value || !date.isValid()) {
    return '-'
  }

  return `${date.format('DD-MM')}-${date.year() + 543}`
}

function FaqPage({ isAdmin = false, accessToken = '' }) {
  const [faqs, setFaqs] = useState([])
  const [searchText, setSearchText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [dialogMode, setDialogMode] = useState('')
  const [selectedFaq, setSelectedFaq] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [isMutating, setIsMutating] = useState(false)
  const [mutationError, setMutationError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadFaqs() {
      setIsLoading(true)
      setLoadError('')

      try {
        const result = await fetch(getContentApiUrl('faqs'), {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        const payload = await readContentApiResponse(result, 'ไม่สามารถโหลดคำถามที่พบบ่อยได้')

        if (!Array.isArray(payload?.data)) {
          throw new Error('รูปแบบข้อมูลคำถามที่พบบ่อยไม่ถูกต้อง')
        }

        if (!controller.signal.aborted) {
          setFaqs(payload.data)
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setLoadError(error?.message || 'ไม่สามารถโหลดคำถามที่พบบ่อยได้')
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadFaqs()

    return () => controller.abort()
  }, [reloadKey])

  const filteredFaqs = useMemo(() => {
    const normalizedSearchText = searchText.trim().toLocaleLowerCase('th')

    return faqs.filter((faq) => {
      const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory
      const matchesSearch =
        !normalizedSearchText ||
        [faq.question, faq.answer, getFaqCategoryLabel(faq)].some((value) =>
          String(value ?? '')
            .toLocaleLowerCase('th')
            .includes(normalizedSearchText),
        )

      return matchesCategory && matchesSearch
    })
  }, [faqs, searchText, selectedCategory])

  const openCreateDialog = () => {
    setSelectedFaq(null)
    setForm({
      ...emptyForm,
      updatedDate: dayjs().format('YYYY-MM-DD'),
    })
    setErrors({})
    setMutationError('')
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
    setMutationError('')
    setDialogMode('edit')
  }

  const openDeleteDialog = (faq) => {
    setSelectedFaq(faq)
    setErrors({})
    setMutationError('')
    setDialogMode('delete')
  }

  const resetDialog = () => {
    setDialogMode('')
    setSelectedFaq(null)
    setForm(emptyForm)
    setErrors({})
    setMutationError('')
  }

  const closeDialog = () => {
    if (isMutating) {
      return
    }

    resetDialog()
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
    setMutationError('')
  }

  const validateForm = () => {
    const nextErrors = {}

    if (!form.question.trim()) {
      nextErrors.question = 'กรุณากรอกคำถาม'
    } else if (form.question.trim().length > 1000) {
      nextErrors.question = 'คำถามต้องยาวไม่เกิน 1,000 ตัวอักษร'
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

  const saveFaq = async () => {
    if (isMutating || !validateForm()) {
      return
    }

    const isEdit = dialogMode === 'edit' && Boolean(selectedFaq)

    if (!accessToken) {
      setMutationError('กรุณาเข้าสู่ระบบอีกครั้งก่อนบันทึกรายการ')
      return
    }

    if (isEdit && !selectedFaq?.id) {
      setMutationError('ไม่พบคำถามที่ต้องการแก้ไข')
      return
    }

    const requestBody = {
      question: form.question.trim(),
      answer: form.answer.trim(),
      category: form.category,
      updatedDate: form.updatedDate,
    }

    setIsMutating(true)
    setMutationError('')

    try {
      const result = await fetch(getContentApiUrl('faqs', isEdit ? selectedFaq.id : ''), {
        method: isEdit ? 'PUT' : 'POST',
        headers: buildContentApiHeaders(accessToken, {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(requestBody),
      })
      const payload = await readContentApiResponse(
        result,
        isEdit ? 'ไม่สามารถแก้ไขคำถามได้' : 'ไม่สามารถเพิ่มคำถามได้',
      )

      if (
        !payload?.data ||
        Array.isArray(payload.data) ||
        typeof payload.data !== 'object' ||
        typeof payload.data.id !== 'string'
      ) {
        throw new Error('รูปแบบข้อมูลคำถามที่พบบ่อยไม่ถูกต้อง')
      }

      if (isEdit) {
        setFaqs((current) =>
          current.map((faq) => (faq.id === selectedFaq.id ? payload.data : faq)),
        )
        setSuccessMessage('แก้ไขคำถามเรียบร้อยแล้ว')
      } else {
        setFaqs((current) => [...current, payload.data])
        setSuccessMessage('เพิ่มคำถามเรียบร้อยแล้ว')
      }

      resetDialog()
    } catch (error) {
      if (error?.details && typeof error.details === 'object') {
        setErrors((current) => ({ ...current, ...error.details }))
      }
      setMutationError(
        error?.message || (isEdit ? 'ไม่สามารถแก้ไขคำถามได้' : 'ไม่สามารถเพิ่มคำถามได้'),
      )

      if (error?.status === 404) {
        setReloadKey((current) => current + 1)
      }
    } finally {
      setIsMutating(false)
    }
  }

  const deleteFaq = async () => {
    if (isMutating) {
      return
    }

    if (!selectedFaq?.id) {
      setMutationError('ไม่พบคำถามที่ต้องการลบ')
      return
    }

    if (!accessToken) {
      setMutationError('กรุณาเข้าสู่ระบบอีกครั้งก่อนลบรายการ')
      return
    }

    const faqId = selectedFaq.id
    setIsMutating(true)
    setMutationError('')

    try {
      const result = await fetch(getContentApiUrl('faqs', faqId), {
        method: 'DELETE',
        headers: buildContentApiHeaders(accessToken, { Accept: 'application/json' }),
      })
      const payload = await readContentApiResponse(result, 'ไม่สามารถลบคำถามได้')

      if (payload?.data?.deleted !== true || payload?.data?.id !== faqId) {
        throw new Error('ระบบไม่ยืนยันการลบคำถาม')
      }

      setFaqs((current) => current.filter((faq) => faq.id !== faqId))
      setSuccessMessage('ลบคำถามเรียบร้อยแล้ว')
      resetDialog()
    } catch (error) {
      setMutationError(error?.message || 'ไม่สามารถลบคำถามได้')

      if (error?.status === 404) {
        setReloadKey((current) => current + 1)
      }
    } finally {
      setIsMutating(false)
    }
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
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openCreateDialog}
                disabled={isLoading || Boolean(loadError)}
              >
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
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1.5,
              }}
            >
              <TextField
                select
                size="small"
                label="หมวดหมู่"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                disabled={isLoading}
                sx={{ width: { xs: '100%', sm: 240 } }}
              >
                {faqCategoryOptions.map((category) => (
                  <MenuItem key={category.value} value={category.value}>
                    {category.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                placeholder="ค้นหาคำถามหรือคำตอบ"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                disabled={isLoading}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                  htmlInput: {
                    'aria-label': 'ค้นหาคำถามหรือคำตอบ',
                  },
                }}
                sx={{ width: { xs: '100%', sm: 360 } }}
              />
            </Box>

            <Stack spacing={1.5} aria-busy={isLoading}>
              {isLoading ? (
                <Box
                  role="status"
                  sx={{
                    p: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                    color: 'text.secondary',
                  }}
                >
                  <CircularProgress size={24} />
                  <Typography color="text.secondary">กำลังโหลดคำถามที่พบบ่อย...</Typography>
                </Box>
              ) : loadError ? (
                <Alert
                  severity="error"
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => setReloadKey((current) => current + 1)}
                    >
                      ลองอีกครั้ง
                    </Button>
                  }
                >
                  {loadError}
                </Alert>
              ) : filteredFaqs.length > 0 ? (
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
        requestError={mutationError}
        busy={isMutating}
        onChange={updateForm}
        onClose={closeDialog}
        onSave={saveFaq}
      />

      <Dialog open={dialogMode === 'delete'} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle>ลบคำถาม</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography color="text.secondary">
              ต้องการลบคำถาม “{selectedFaq?.question}” หรือไม่
            </Typography>
            {mutationError ? <Alert severity="error">{mutationError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={isMutating}>
            ยกเลิก
          </Button>
          <Button color="error" variant="contained" onClick={deleteFaq} disabled={isMutating}>
            {isMutating ? (
              <>
                <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
                กำลังลบ...
              </>
            ) : (
              'ลบ'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={4000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') {
            setSuccessMessage('')
          }
        }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setSuccessMessage('')}
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
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
              label={getFaqCategoryLabel(faq)}
              size="small"
              sx={{
                bgcolor: 'primary.50',
                color: 'primary.dark',
                fontWeight: 600,
              }}
            />
            <Typography variant="body2" color="text.secondary">
              อัปเดต {formatBuddhistDate(faq.updatedDate)}
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
                <IconButton
                  color="primary"
                  aria-label={`แก้ไขคำถาม ${faq.question}`}
                  onClick={() => onEdit(faq)}
                >
                  <EditIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="ลบ">
                <IconButton
                  color="error"
                  aria-label={`ลบคำถาม ${faq.question}`}
                  onClick={() => onDelete(faq)}
                >
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

function FaqFormDialog({
  open,
  mode,
  form,
  errors,
  requestError,
  busy,
  onChange,
  onClose,
  onSave,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      disableEscapeKeyDown={busy}
      fullWidth
      maxWidth="sm"
      aria-busy={busy}
    >
      <DialogTitle>{mode === 'edit' ? 'แก้ไขคำถาม' : 'เพิ่มคำถาม'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.25} sx={{ pt: 1 }}>
          {requestError ? <Alert severity="error">{requestError}</Alert> : null}
          <TextField
            label="คำถาม"
            value={form.question}
            error={Boolean(errors.question)}
            helperText={errors.question}
            onChange={(event) => onChange('question', event.target.value)}
            disabled={busy}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
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
              disabled={busy}
              fullWidth
            >
              {faqCategories.map((category) => (
                <MenuItem key={category.value} value={category.value}>
                  {category.label}
                </MenuItem>
              ))}
            </TextField>
            <LocalizationProvider dateAdapter={AdapterDayjsBuddhist} adapterLocale="th">
              <DatePicker
                label="วันที่อัปเดต"
                value={form.updatedDate ? dayjs(form.updatedDate) : null}
                format="DD-MM-YYYY"
                disabled={busy}
                onChange={(nextDate) => {
                  onChange('updatedDate', nextDate?.isValid() ? nextDate.format('YYYY-MM-DD') : '')
                }}
                slotProps={{
                  textField: {
                    error: Boolean(errors.updatedDate),
                    helperText: errors.updatedDate,
                    fullWidth: true,
                  },
                }}
              />
            </LocalizationProvider>
          </Stack>
          <TextField
            label="คำตอบ"
            value={form.answer}
            error={Boolean(errors.answer)}
            helperText={errors.answer}
            onChange={(event) => onChange('answer', event.target.value)}
            disabled={busy}
            fullWidth
            multiline
            minRows={5}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={onSave} disabled={busy}>
          {busy ? (
            <>
              <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
              กำลังบันทึก...
            </>
          ) : (
            'บันทึก'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default FaqPage
