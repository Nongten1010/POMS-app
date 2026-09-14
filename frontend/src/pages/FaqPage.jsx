import { useEffect, useMemo, useRef, useState } from 'react'
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
import UploadFileIcon from '@mui/icons-material/UploadFile'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import LinkIcon from '@mui/icons-material/Link'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjsBuddhist } from '@mui/x-date-pickers/AdapterDayjsBuddhist'
import dayjs from 'dayjs'
import 'dayjs/locale/th'
import {
  buildContentApiHeaders,
  getContentApiUrl,
  readContentApiResponse,
  resolveContentDownloadUrl,
} from '../utils/contentApi.mjs'
import {
  FAQ_FILE_ACCEPT, FAQ_MAX_FILES, FAQ_MAX_LINKS,
  getFaqLink, getFaqAttachmentErrors, getFaqEditForm, buildFaqFormData,
} from '../utils/faqAttachments.mjs'

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
  files: [],
  attachments: [],
  links: [''],
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
  const [hasConflict, setHasConflict] = useState(false)

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
    setHasConflict(false)
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
    setHasConflict(false)
    setSelectedFaq(faq)
    setForm(getFaqEditForm(faq))
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
    setHasConflict(false)
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
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([field]) => {
      if (['files', 'attachments'].includes(name)) {
        return !['files', 'attachments', 'attachmentIds'].some((key) => field === key || field.startsWith(`${key}.`))
      }
      return field !== name && !field.startsWith(`${name}.`)
    })))
    if (!hasConflict) setMutationError('')
  }

  const validateForm = () => {
    const nextErrors = getFaqAttachmentErrors(form)

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
    if (isMutating || hasConflict || !validateForm()) {
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

    setIsMutating(true)
    setMutationError('')

    try {
      const result = await fetch(getContentApiUrl('faqs', isEdit ? selectedFaq.id : ''), {
        method: isEdit ? 'PUT' : 'POST',
        headers: buildContentApiHeaders(accessToken, {
          Accept: 'application/json',
        }),
        body: buildFaqFormData(form),
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

      if (error?.status === 409) {
        setHasConflict(true)
        setMutationError('รายการแนบมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกอีกครั้ง การโหลดจะใช้ข้อมูลล่าสุดแทนข้อมูลที่ยังไม่ได้บันทึก')
        setReloadKey((current) => current + 1)
      }

      if (error?.status === 404) {
        setReloadKey((current) => current + 1)
      }
    } finally {
      setIsMutating(false)
    }
  }

  const reloadSelectedFaq = async () => {
    if (isMutating || !selectedFaq?.id) return
    setIsMutating(true)
    try {
      const result = await fetch(getContentApiUrl('faqs'), { headers: { Accept: 'application/json' } })
      const payload = await readContentApiResponse(result, 'ไม่สามารถโหลดคำถามล่าสุดได้')
      if (!Array.isArray(payload?.data)) throw new Error('รูปแบบข้อมูลคำถามที่พบบ่อยไม่ถูกต้อง')
      setFaqs(payload.data)
      const latestFaq = payload.data.find((faq) => faq.id === selectedFaq.id)
      if (!latestFaq) throw new Error('ไม่พบคำถามนี้ในรายการล่าสุด กรุณาปิดหน้าต่าง')
      openEditDialog(latestFaq)
      setSuccessMessage('โหลดข้อมูลล่าสุดแล้ว กรุณาตรวจสอบก่อนบันทึก')
    } catch (error) {
      setMutationError(error?.message || 'ไม่สามารถโหลดคำถามล่าสุดได้')
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
        hasConflict={hasConflict}
        onReload={reloadSelectedFaq}
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
          <Typography sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{faq.answer}</Typography>
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            {faq.attachments?.length ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, minWidth: 0 }}>
                {faq.attachments.map((file) => (
                  <FaqAttachmentItem key={file.id} attachment={file} compact />
                ))}
              </Box>
            ) : null}
            {(faq.links ?? []).map((link, index) => (
              <Stack key={`${index}-${link}`} direction="row" spacing={1} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
                <LinkIcon color="primary" fontSize="small" />
                <Typography
                  component="a" href={getFaqLink(link) || undefined} target="_blank" rel="noopener noreferrer"
                  variant="body2" sx={{ color: 'primary.main', overflowWrap: 'anywhere', minWidth: 0 }}
                >
                  {link}
                </Typography>
              </Stack>
            ))}
          </Stack>
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
  hasConflict = false,
  onReload,
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
          {requestError ? (
            <Alert severity="error" action={hasConflict ? (
              <Button color="inherit" size="small" disabled={busy} onClick={onReload}>โหลดข้อมูลล่าสุด</Button>
            ) : undefined}>{requestError}</Alert>
          ) : null}
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
          <FaqAttachmentsEditor form={form} errors={errors} busy={busy} onChange={onChange} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button variant="contained" onClick={onSave} disabled={busy || hasConflict}>
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

function FaqAttachmentItem({ attachment, file, onRemove, disabled = false, compact = false }) {
  const previewRef = useRef(null)
  const isImage = file && ['image/png', 'image/jpeg'].includes(file.type)
  useEffect(() => {
    if (!isImage || !previewRef.current) return
    const url = URL.createObjectURL(file)
    previewRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file, isImage])
  const name = file?.name ?? attachment?.fileName ?? ''
  const size = file?.size ?? attachment?.fileSize ?? 0
  const downloadUrl = resolveContentDownloadUrl(attachment?.downloadUrl)
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1, p: compact ? 0.75 : 1,
      border: 1, borderColor: 'divider', borderRadius: 1, minWidth: 0,
      ...(compact ? { width: 240, maxWidth: '100%', flex: '0 1 240px', boxSizing: 'border-box' } : {}),
    }}>
      {isImage ? (
        <Box component="img" ref={previewRef} alt={name} sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }} />
      ) : (
        <UploadFileIcon color="action" sx={{ width: compact ? 24 : 32, height: compact ? 24 : 32, flexShrink: 0 }} />
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {compact ? (
          <Tooltip title={name}><Typography variant="body2" noWrap>{name}</Typography></Tooltip>
        ) : (
          <Typography variant="body2" noWrap title={name}>{name}</Typography>
        )}
        <Typography variant="caption" color="text.secondary">{(size / 1024 / 1024).toFixed(2)} MB</Typography>
      </Box>
      {attachment ? (
        <Tooltip title="ดาวน์โหลดไฟล์">
          <span><IconButton component="a" href={downloadUrl || undefined} download={name} size={compact ? 'small' : 'medium'} disabled={!downloadUrl || disabled} aria-label={`ดาวน์โหลด ${name}`}><DownloadIcon fontSize={compact ? 'small' : 'medium'} /></IconButton></span>
        </Tooltip>
      ) : null}
      {onRemove ? (
        <Tooltip title="นำไฟล์ออก">
          <span><IconButton onClick={onRemove} disabled={disabled} aria-label={`นำไฟล์ ${name} ออก`}><CloseIcon /></IconButton></span>
        </Tooltip>
      ) : null}
    </Box>
  )
}

function FaqAttachmentsEditor({ form, errors, busy, onChange }) {
  const attachmentError = errors.files || errors.attachments || errors.attachmentIds
  const validationErrors = getFaqAttachmentErrors(form)
  return (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">ไฟล์แนบ</Typography>
        <Button
          component="label" variant="outlined" size="small" fullWidth startIcon={<UploadFileIcon />}
          disabled={busy || form.files.length + form.attachments.length >= FAQ_MAX_FILES}
          sx={{ minHeight: 40, justifyContent: 'flex-start', borderStyle: 'dashed', '&:hover': { borderStyle: 'dashed' } }}
        >
          แนบไฟล์
          <Box component="input" type="file" multiple hidden accept={FAQ_FILE_ACCEPT} disabled={busy}
            aria-label="เลือกไฟล์แนบคำถาม"
            onChange={(event) => {
              onChange('files', [...form.files, ...Array.from(event.target.files ?? [])])
              event.target.value = ''
            }} />
        </Button>
        <Typography variant="caption" color="text.secondary">PDF, DOC, DOCX, XLS, XLSX, PNG, JPG/JPEG, TXT ไม่เกิน 10 MB ต่อไฟล์ สูงสุด 10 ไฟล์</Typography>
        {attachmentError || validationErrors.files ? <Alert severity="error">{attachmentError || validationErrors.files}</Alert> : null}
        {form.attachments.map((attachment) => (
          <FaqAttachmentItem key={attachment.id} attachment={attachment} disabled={busy}
            onRemove={() => onChange('attachments', form.attachments.filter((file) => file.id !== attachment.id))} />
        ))}
        {form.files.map((file, index) => (
          <FaqAttachmentItem key={`${index}-${file.name}-${file.lastModified}`} file={file} disabled={busy}
            onRemove={() => onChange('files', form.files.filter((_, fileIndex) => fileIndex !== index))} />
        ))}
      </Stack>
      <Stack spacing={1}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2">ลิงก์</Typography>
          <Tooltip title="เพิ่มลิงก์"><span><IconButton color="primary" aria-label="เพิ่มลิงก์" disabled={busy || form.links.length >= FAQ_MAX_LINKS}
            onClick={() => onChange('links', [...form.links, ''])}><AddIcon /></IconButton></span></Tooltip>
        </Stack>
        {form.links.map((link, index) => (
          <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <TextField label="Link" size="small" fullWidth value={link} disabled={busy}
              error={Boolean((link.trim() && !getFaqLink(link)) || errors[`links.${index}`])}
              helperText={errors[`links.${index}`]}
              onChange={(event) => onChange('links', form.links.map((value, linkIndex) => linkIndex === index ? event.target.value : value))} />
            <Tooltip title="นำลิงก์ออก"><span><IconButton aria-label={`นำลิงก์ที่ ${index + 1} ออก`} disabled={busy}
              onClick={() => onChange('links', form.links.filter((_, linkIndex) => linkIndex !== index))}><CloseIcon /></IconButton></span></Tooltip>
          </Stack>
        ))}
        {errors.links || validationErrors.links ? <Alert severity="error">{errors.links || validationErrors.links}</Alert> : null}
      </Stack>
    </Stack>
  )
}

export default FaqPage
