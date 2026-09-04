import { useEffect, useMemo, useState } from 'react'
import {
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
import AttachFileIcon from '@mui/icons-material/AttachFile'
import DeleteIcon from '@mui/icons-material/Delete'
import DownloadIcon from '@mui/icons-material/Download'
import EditIcon from '@mui/icons-material/Edit'
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
  resolveContentDownloadUrl,
} from '../utils/contentApi.mjs'

const MAX_PDF_SIZE = 10 * 1024 * 1024

const lawCategories = [
  { value: 'CEMS', label: 'CEMS' },
  { value: 'WPMS', label: 'WPMS' },
  { value: 'OTHER', label: 'อื่นๆ' },
]
const lawTypes = [
  { value: 'MINISTERIAL_REGULATION', label: 'กฎกระทรวง' },
  { value: 'RULE_AND_ANNOUNCEMENT', label: 'กฎและประกาศ' },
  { value: 'REGULATION_REQUIREMENT', label: 'ระเบียบ ข้อบังคับ และข้อกำหนด' },
  { value: 'OTHER', label: 'อื่นๆ' },
]
const lawCategoryOptions = [
  { value: 'all', label: 'ทั้งหมด' },
  ...lawCategories,
]

const emptyForm = {
  title: '',
  category: '',
  type: '',
  publishedDate: '',
  file: null,
}

function getLawCategoryLabel(category, categoryLabel = '') {
  return categoryLabel || lawCategories.find((option) => option.value === category)?.label || category
}

function getLawTypeLabel(type, typeLabel = '') {
  return typeLabel || lawTypes.find((option) => option.value === type)?.label || type
}

function formatBuddhistDate(value) {
  const date = dayjs(value)

  if (!value || !date.isValid()) {
    return '-'
  }

  return `${date.format('DD-MM')}-${date.year() + 543}`
}

function getFileValidationMessage(file) {
  if (!file) {
    return ''
  }

  if (file.type !== 'application/pdf' || !file.name.toLocaleLowerCase().endsWith('.pdf')) {
    return 'กรุณาเลือกไฟล์ PDF เท่านั้น'
  }

  if (file.size < 1) {
    return 'ไฟล์ PDF ต้องไม่เป็นไฟล์ว่าง'
  }

  if (file.size > MAX_PDF_SIZE) {
    return 'ไฟล์ PDF ต้องมีขนาดไม่เกิน 10 MB'
  }

  return ''
}

function buildLawFormData(form) {
  const body = new FormData()

  body.append('title', form.title.trim())
  body.append('category', form.category)
  body.append('type', form.type)
  body.append('publishedDate', form.publishedDate)

  if (form.file) {
    body.append('file', form.file)
  }

  return body
}

function LawsPage({ isAdmin = false, accessToken = '' }) {
  const [laws, setLaws] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [loadRequestKey, setLoadRequestKey] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [dialogMode, setDialogMode] = useState('')
  const [selectedLaw, setSelectedLaw] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [operationError, setOperationError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    const loadLaws = async () => {
      setIsLoading(true)
      setLoadError('')

      try {
        const result = await fetch(getContentApiUrl('laws'), {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        const payload = await readContentApiResponse(result, 'ไม่สามารถโหลดรายการกฎหมายได้')

        if (!Array.isArray(payload?.data)) {
          throw new Error('รูปแบบข้อมูลรายการกฎหมายไม่ถูกต้อง')
        }

        if (isActive) {
          setLaws(payload.data)
        }
      } catch (error) {
        if (isActive && error?.name !== 'AbortError') {
          setLoadError(error?.message || 'ไม่สามารถโหลดรายการกฎหมายได้')
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadLaws()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [loadRequestKey])

  const sortedLaws = useMemo(
    () => {
      const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase('th')

      return laws
        .filter((law) => selectedCategory === 'all' || law.category === selectedCategory)
        .filter((law) => {
          if (!normalizedSearchTerm) {
            return true
          }

          return [
            law.title,
            getLawCategoryLabel(law.category, law.categoryLabel),
            getLawTypeLabel(law.type, law.typeLabel),
            law.file?.fileName,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLocaleLowerCase('th').includes(normalizedSearchTerm))
        })
        .sort((first, second) => String(first.title).localeCompare(String(second.title), 'th'))
    },
    [laws, searchTerm, selectedCategory],
  )

  const openCreateDialog = () => {
    setSelectedLaw(null)
    setForm(emptyForm)
    setErrors({})
    setOperationError('')
    setDialogMode('create')
  }

  const openEditDialog = (law) => {
    setSelectedLaw(law)
    setForm({
      title: law.title,
      category: law.category,
      type: law.type,
      publishedDate: law.publishedDate,
      file: null,
    })
    setErrors({})
    setOperationError('')
    setDialogMode('edit')
  }

  const openDeleteDialog = (law) => {
    setSelectedLaw(law)
    setErrors({})
    setOperationError('')
    setDialogMode('delete')
  }

  const resetDialog = () => {
    setDialogMode('')
    setSelectedLaw(null)
    setForm(emptyForm)
    setErrors({})
    setOperationError('')
  }

  const closeDialog = () => {
    if (!isSaving && !isDeleting) {
      resetDialog()
    }
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
    setOperationError('')
  }

  const validateForm = () => {
    const nextErrors = {}

    if (!form.title.trim()) {
      nextErrors.title = 'กรุณากรอกชื่อรายการ'
    } else if (form.title.trim().length > 500) {
      nextErrors.title = 'ชื่อรายการต้องยาวไม่เกิน 500 ตัวอักษร'
    }

    if (!form.type) {
      nextErrors.type = 'กรุณาเลือกประเภท'
    }

    if (!form.category) {
      nextErrors.category = 'กรุณาเลือกหมวดหมู่'
    }

    if (!form.publishedDate) {
      nextErrors.publishedDate = 'กรุณาเลือกวันที่'
    }

    if (dialogMode === 'create' && !form.file) {
      nextErrors.file = 'กรุณาแนบไฟล์ PDF'
    } else {
      const fileError = getFileValidationMessage(form.file)

      if (fileError) {
        nextErrors.file = fileError
      }
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const saveLaw = async () => {
    if (isSaving || isDeleting || !validateForm()) {
      return
    }

    if (!accessToken) {
      setOperationError('กรุณาเข้าสู่ระบบอีกครั้งก่อนบันทึกรายการ')
      return
    }

    const isEdit = dialogMode === 'edit'

    if (isEdit && !selectedLaw?.id) {
      setOperationError('ไม่พบรายการกฎหมายที่ต้องการแก้ไข')
      return
    }

    setIsSaving(true)
    setOperationError('')

    try {
      const result = await fetch(getContentApiUrl('laws', isEdit ? selectedLaw.id : ''), {
        method: isEdit ? 'PUT' : 'POST',
        headers: buildContentApiHeaders(accessToken, { Accept: 'application/json' }),
        body: buildLawFormData(form),
      })
      const payload = await readContentApiResponse(
        result,
        isEdit ? 'ไม่สามารถแก้ไขรายการกฎหมายได้' : 'ไม่สามารถเพิ่มรายการกฎหมายได้',
      )
      const savedLaw = payload?.data

      if (!savedLaw?.id) {
        throw new Error('รูปแบบข้อมูลรายการกฎหมายไม่ถูกต้อง')
      }

      if (isEdit) {
        setLaws((current) =>
          current.map((law) => (law.id === selectedLaw.id ? savedLaw : law)),
        )
      } else {
        setLaws((current) => [...current, savedLaw])
      }

      setSuccessMessage(isEdit ? 'แก้ไขรายการกฎหมายสำเร็จ' : 'เพิ่มรายการกฎหมายสำเร็จ')
      resetDialog()
    } catch (error) {
      setOperationError(error?.message || 'ไม่สามารถบันทึกรายการกฎหมายได้')

      if (error?.details && typeof error.details === 'object') {
        setErrors((current) => ({ ...current, ...error.details }))
      }

      if (error?.status === 404) {
        setLoadRequestKey((current) => current + 1)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const deleteLaw = async () => {
    if (isDeleting || isSaving) {
      return
    }

    if (!selectedLaw?.id) {
      setOperationError('ไม่พบรายการกฎหมายที่ต้องการลบ')
      return
    }

    if (!accessToken) {
      setOperationError('กรุณาเข้าสู่ระบบอีกครั้งก่อนลบรายการ')
      return
    }

    const lawId = selectedLaw.id
    setIsDeleting(true)
    setOperationError('')

    try {
      const result = await fetch(getContentApiUrl('laws', lawId), {
        method: 'DELETE',
        headers: buildContentApiHeaders(accessToken, { Accept: 'application/json' }),
      })
      const payload = await readContentApiResponse(result, 'ไม่สามารถลบรายการกฎหมายได้')
      const deletion = payload?.data

      if (deletion?.deleted !== true || deletion.id !== lawId) {
        throw new Error('ไม่ได้รับผลยืนยันการลบรายการกฎหมาย')
      }

      setLaws((current) => current.filter((law) => law.id !== lawId))
      setSuccessMessage('ลบรายการกฎหมายสำเร็จ')
      resetDialog()
    } catch (error) {
      setOperationError(error?.message || 'ไม่สามารถลบรายการกฎหมายได้')

      if (error?.status === 404) {
        setLoadRequestKey((current) => current + 1)
      }
    } finally {
      setIsDeleting(false)
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
            spacing={2}
            sx={{
              alignItems: { xs: 'stretch', lg: 'center' },
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h5" component="h1">
                กฎหมายที่เกี่ยวข้อง
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ดาวน์โหลดเอกสารกฎหมาย ประกาศ และแนวปฏิบัติที่เกี่ยวข้องกับระบบ D-POMS
              </Typography>
            </Box>
            {isAdmin ? (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openCreateDialog}
                disabled={isLoading}
                sx={{ whiteSpace: 'nowrap' }}
              >
                เพิ่มรายการ
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
          <Stack spacing={1.5}>
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
                sx={{ width: { xs: '100%', sm: 240 } }}
              >
                {lawCategoryOptions.map((category) => (
                  <MenuItem key={category.value} value={category.value}>
                    {category.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ค้นหารายการกฎหมาย"
                size="small"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                  htmlInput: {
                    'aria-label': 'ค้นหารายการกฎหมาย',
                  },
                }}
                sx={{ width: { xs: '100%', sm: 360 } }}
              />
            </Box>
            {isLoading ? (
              <Stack
                role="status"
                aria-live="polite"
                direction="row"
                spacing={1.5}
                sx={{ alignItems: 'center', justifyContent: 'center', py: 4 }}
              >
                <CircularProgress size={24} />
                <Typography color="text.secondary">กำลังโหลดรายการกฎหมาย...</Typography>
              </Stack>
            ) : loadError ? (
              <Alert
                severity="error"
                action={(
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => setLoadRequestKey((current) => current + 1)}
                  >
                    ลองใหม่
                  </Button>
                )}
              >
                {loadError}
              </Alert>
            ) : sortedLaws.length > 0 ? (
              sortedLaws.map((law) => (
                <LawListItem
                  key={law.id}
                  law={law}
                  isAdmin={isAdmin}
                  onEdit={openEditDialog}
                  onDelete={openDeleteDialog}
                />
              ))
            ) : (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                ไม่พบรายการกฎหมาย
              </Typography>
            )}
          </Stack>
        </Paper>
      </Stack>

      <LawFormDialog
        open={dialogMode === 'create' || dialogMode === 'edit'}
        mode={dialogMode}
        form={form}
        errors={errors}
        existingFileName={selectedLaw?.file?.fileName || ''}
        isSaving={isSaving}
        operationError={operationError}
        onChange={updateForm}
        onClose={closeDialog}
        onSave={saveLaw}
      />

      <Dialog open={dialogMode === 'delete'} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle>ลบรายการกฎหมาย</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography color="text.secondary">
              ต้องการลบรายการ “{selectedLaw?.title}” หรือไม่
            </Typography>
            {operationError ? <Alert severity="error">{operationError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={isDeleting}>ยกเลิก</Button>
          <Button
            color="error"
            variant="contained"
            onClick={deleteLaw}
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />}
          >
            {isDeleting ? 'กำลังลบ...' : 'ลบ'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
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

function LawListItem({ law, isAdmin, onEdit, onDelete }) {
  const downloadUrl = resolveContentDownloadUrl(law.file?.downloadUrl)
  const downloadFileName = law.file?.fileName || undefined

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          md: isAdmin ? 'minmax(0, 1fr) auto auto' : 'minmax(0, 1fr) auto',
        },
        gap: 1.5,
        alignItems: 'center',
        p: { xs: 1.5, md: 2 },
        border: 1,
        borderColor: 'neutral.200',
        borderRadius: 1.5,
        bgcolor: 'background.paper',
      }}
    >
      <Stack spacing={1} sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, color: 'neutral.900' }}>
          {law.title}
        </Typography>
        <Stack direction="row" spacing={1.25} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip
            label={getLawCategoryLabel(law.category, law.categoryLabel)}
            size="small"
            variant="outlined"
            color="primary"
          />
          <Chip
            label={getLawTypeLabel(law.type, law.typeLabel)}
            size="small"
            sx={{
              bgcolor: 'primary.50',
              color: 'primary.dark',
              fontWeight: 600,
            }}
          />
          <Typography variant="body2" color="text.secondary">
            วันที่ {formatBuddhistDate(law.publishedDate)}
          </Typography>
        </Stack>
      </Stack>

      <Tooltip title="ดาวน์โหลดไฟล์">
        <IconButton
          component="a"
          href={downloadUrl || undefined}
          download={downloadFileName}
          color="primary"
          aria-label="ดาวน์โหลดไฟล์"
          disabled={!downloadUrl}
          sx={{ display: { xs: 'inline-flex', md: 'none' }, justifySelf: 'start' }}
        >
          <DownloadIcon />
        </IconButton>
      </Tooltip>
      <Button
        component="a"
        href={downloadUrl || undefined}
        download={downloadFileName}
        variant="contained"
        startIcon={<DownloadIcon />}
        disabled={!downloadUrl}
        sx={{
          display: { xs: 'none', md: 'inline-flex' },
          justifySelf: 'end',
          whiteSpace: 'nowrap',
        }}
      >
        ดาวน์โหลดไฟล์
      </Button>

      {isAdmin ? (
        <Stack direction="row" spacing={0.75} sx={{ justifySelf: { xs: 'start', md: 'end' } }}>
          <Tooltip title="แก้ไข">
            <IconButton
              color="primary"
              onClick={() => onEdit(law)}
              aria-label={`แก้ไข ${law.title}`}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="ลบ">
            <IconButton
              color="error"
              onClick={() => onDelete(law)}
              aria-label={`ลบ ${law.title}`}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      ) : null}
    </Box>
  )
}

function LawFormDialog({
  open,
  mode,
  form,
  errors,
  existingFileName,
  isSaving,
  operationError,
  onChange,
  onClose,
  onSave,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      disableEscapeKeyDown={isSaving}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>{mode === 'edit' ? 'แก้ไขรายการกฎหมาย' : 'เพิ่มรายการกฎหมาย'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.25} sx={{ pt: 1 }}>
          {operationError ? <Alert severity="error">{operationError}</Alert> : null}
          <TextField
            label="ชื่อรายการ"
            value={form.title}
            error={Boolean(errors.title)}
            helperText={errors.title}
            onChange={(event) => onChange('title', event.target.value)}
            disabled={isSaving}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            fullWidth
            multiline
            minRows={2}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              label="หมวดหมู่"
              value={form.category}
              error={Boolean(errors.category)}
              helperText={errors.category}
              onChange={(event) => onChange('category', event.target.value)}
              disabled={isSaving}
              fullWidth
            >
              {lawCategories.map((category) => (
                <MenuItem key={category.value} value={category.value}>
                  {category.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="ประเภท"
              value={form.type}
              error={Boolean(errors.type)}
              helperText={errors.type}
              onChange={(event) => onChange('type', event.target.value)}
              disabled={isSaving}
              fullWidth
            >
              {lawTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <LocalizationProvider dateAdapter={AdapterDayjsBuddhist} adapterLocale="th">
              <DatePicker
                label="วันที่"
                value={form.publishedDate ? dayjs(form.publishedDate) : null}
                format="DD-MM-YYYY"
                disabled={isSaving}
                onChange={(nextDate) => {
                  onChange('publishedDate', nextDate?.isValid() ? nextDate.format('YYYY-MM-DD') : '')
                }}
                slotProps={{
                  textField: {
                    error: Boolean(errors.publishedDate),
                    helperText: errors.publishedDate,
                    fullWidth: true,
                  },
                }}
              />
            </LocalizationProvider>
            <FileAttachField
              file={form.file}
              existingFileName={existingFileName}
              error={errors.file}
              disabled={isSaving}
              onChange={(file) => onChange('file', file)}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>ยกเลิก</Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : null}
        >
          {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function FileAttachField({ file, existingFileName, error, disabled, onChange }) {
  const fileName = file?.name || existingFileName
  const helperText = error
    || (existingFileName && !file
      ? 'ไม่เลือกไฟล์ใหม่จะใช้ไฟล์เดิม'
      : 'รองรับไฟล์ PDF ขนาดไม่เกิน 10 MB')

  return (
    <Stack spacing={0.5} sx={{ width: '100%', minWidth: 0 }}>
      <Button
        fullWidth
        variant="outlined"
        component="label"
        disabled={disabled}
        startIcon={<AttachFileIcon />}
        aria-invalid={Boolean(error)}
        aria-describedby="law-file-helper-text"
        sx={{
          minHeight: 56,
          justifyContent: 'flex-start',
          color: fileName ? 'neutral.900' : 'neutral.600',
          borderColor: error ? 'error.main' : 'neutral.300',
          overflow: 'hidden',
        }}
      >
        <Box
          component="span"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {fileName || 'แนบไฟล์ PDF'}
        </Box>
        <Box
          component="input"
          type="file"
          accept="application/pdf,.pdf"
          aria-label="เลือกไฟล์กฎหมาย PDF"
          hidden
          onChange={(event) => {
            onChange(event.target.files?.[0] ?? null)
            event.target.value = ''
          }}
        />
      </Button>
      <Typography
        id="law-file-helper-text"
        variant="caption"
        color={error ? 'error.main' : 'text.secondary'}
        sx={{ px: 1.75 }}
      >
        {helperText}
      </Typography>
    </Stack>
  )
}

export default LawsPage
