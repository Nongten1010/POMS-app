import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
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

const initialLawItems = [
  {
    id: 'law-001',
    title: 'ประกาศกระทรวงอุตสาหกรรม เรื่อง การติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษเพื่อตรวจวัดมลพิษจากสถานปล่องโรงงาน',
    category: 'CEMS',
    type: 'RULE_AND_ANNOUNCEMENT',
    publishedDate: '2025-01-15',
    fileName: 'law-001.pdf',
  },
  {
    id: 'law-002',
    title: 'ประกาศกรมโรงงานอุตสาหกรรม เรื่อง หลักเกณฑ์การรายงานผลการตรวจวัดมลพิษทางน้ำแบบออนไลน์',
    category: 'WPMS',
    type: 'RULE_AND_ANNOUNCEMENT',
    publishedDate: '2025-03-22',
    fileName: 'law-002.pdf',
  },
  {
    id: 'law-003',
    title: 'พระราชบัญญัติโรงงาน พ.ศ. 2535 และที่แก้ไขเพิ่มเติม',
    category: 'OTHER',
    type: 'OTHER',
    publishedDate: '1992-04-02',
    fileName: 'law-003.pdf',
  },
  {
    id: 'law-004',
    title: 'กฎกระทรวงกำหนดมาตรฐานควบคุมการระบายน้ำทิ้งจากโรงงาน',
    category: 'WPMS',
    type: 'MINISTERIAL_REGULATION',
    publishedDate: '2024-11-01',
    fileName: 'law-004.pdf',
  },
  {
    id: 'law-005',
    title: 'ประกาศกรมโรงงานอุตสาหกรรม เรื่อง การทวนสอบและสอบเทียบระบบ CEMS',
    category: 'CEMS',
    type: 'RULE_AND_ANNOUNCEMENT',
    publishedDate: '2025-07-09',
    fileName: 'law-005.pdf',
  },
  {
    id: 'law-006',
    title: 'แนวทางปฏิบัติการแจ้งเหตุขัดข้องของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ',
    category: 'OTHER',
    type: 'REGULATION_REQUIREMENT',
    publishedDate: '2025-08-30',
    fileName: 'law-006.pdf',
  },
]

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
  fileName: '',
}

function getLawCategoryLabel(category) {
  return lawCategories.find((option) => option.value === category)?.label ?? category
}

function getLawTypeLabel(type) {
  return lawTypes.find((option) => option.value === type)?.label ?? type
}

function formatBuddhistDate(value) {
  const date = dayjs(value)

  if (!value || !date.isValid()) {
    return '-'
  }

  return `${date.format('DD-MM')}-${date.year() + 543}`
}

function createLawId() {
  return `law-${Date.now()}`
}

function LawsPage({ isAdmin = false }) {
  const [laws, setLaws] = useState(initialLawItems)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [dialogMode, setDialogMode] = useState('')
  const [selectedLaw, setSelectedLaw] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const sortedLaws = useMemo(
    () => {
      const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase('th')

      return laws
        .filter((law) => selectedCategory === 'all' || law.category === selectedCategory)
        .filter((law) => {
          if (!normalizedSearchTerm) {
            return true
          }

          return [law.title, getLawCategoryLabel(law.category), getLawTypeLabel(law.type), law.fileName]
            .filter(Boolean)
            .some((value) => value.toLocaleLowerCase('th').includes(normalizedSearchTerm))
        })
        .sort((first, second) => first.title.localeCompare(second.title, 'th'))
    },
    [laws, searchTerm, selectedCategory],
  )

  const openCreateDialog = () => {
    setSelectedLaw(null)
    setForm(emptyForm)
    setErrors({})
    setDialogMode('create')
  }

  const openEditDialog = (law) => {
    setSelectedLaw(law)
    setForm({
      title: law.title,
      category: law.category,
      type: law.type,
      publishedDate: law.publishedDate,
      fileName: law.fileName,
    })
    setErrors({})
    setDialogMode('edit')
  }

  const openDeleteDialog = (law) => {
    setSelectedLaw(law)
    setDialogMode('delete')
  }

  const closeDialog = () => {
    setDialogMode('')
    setSelectedLaw(null)
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

    if (!form.title.trim()) {
      nextErrors.title = 'กรุณากรอกชื่อรายการ'
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

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const saveLaw = () => {
    if (!validateForm()) {
      return
    }

    if (dialogMode === 'edit' && selectedLaw) {
      setLaws((current) =>
        current.map((law) =>
          law.id === selectedLaw.id
            ? {
                ...law,
                ...form,
                fileName: form.fileName || law.fileName,
              }
            : law,
        ),
      )
    } else {
      const id = createLawId()
      setLaws((current) => [
        ...current,
        {
          id,
          ...form,
          fileName: form.fileName || `${id}.pdf`,
        },
      ])
    }

    closeDialog()
  }

  const deleteLaw = () => {
    if (selectedLaw) {
      setLaws((current) => current.filter((law) => law.id !== selectedLaw.id))
    }

    closeDialog()
  }

  const downloadLaw = (law) => {
    const content = [
      law.title,
      `หมวดหมู่: ${getLawCategoryLabel(law.category)}`,
      `ประเภท: ${getLawTypeLabel(law.type)}`,
      `วันที่: ${formatBuddhistDate(law.publishedDate)}`,
    ].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = law.fileName || `${law.id}.txt`
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
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
            {sortedLaws.length > 0 ? (
              sortedLaws.map((law) => (
                <LawListItem
                  key={law.id}
                  law={law}
                  isAdmin={isAdmin}
                  onDownload={downloadLaw}
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
        onChange={updateForm}
        onClose={closeDialog}
        onSave={saveLaw}
      />

      <Dialog open={dialogMode === 'delete'} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle>ลบรายการกฎหมาย</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            ต้องการลบรายการ “{selectedLaw?.title}” หรือไม่
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>ยกเลิก</Button>
          <Button color="error" variant="contained" onClick={deleteLaw}>
            ลบ
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function LawListItem({ law, isAdmin, onDownload, onEdit, onDelete }) {
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
            label={getLawCategoryLabel(law.category)}
            size="small"
            variant="outlined"
            color="primary"
          />
          <Chip
            label={getLawTypeLabel(law.type)}
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
          color="primary"
          onClick={() => onDownload(law)}
          aria-label="ดาวน์โหลดไฟล์"
          sx={{ display: { xs: 'inline-flex', md: 'none' }, justifySelf: 'start' }}
        >
          <DownloadIcon />
        </IconButton>
      </Tooltip>
      <Button
        variant="contained"
        startIcon={<DownloadIcon />}
        onClick={() => onDownload(law)}
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
            <IconButton color="primary" onClick={() => onEdit(law)}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="ลบ">
            <IconButton color="error" onClick={() => onDelete(law)}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      ) : null}
    </Box>
  )
}

function LawFormDialog({ open, mode, form, errors, onChange, onClose, onSave }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === 'edit' ? 'แก้ไขรายการกฎหมาย' : 'เพิ่มรายการกฎหมาย'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.25} sx={{ pt: 1 }}>
          <TextField
            label="ชื่อรายการ"
            value={form.title}
            error={Boolean(errors.title)}
            helperText={errors.title}
            onChange={(event) => onChange('title', event.target.value)}
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
            <FileAttachField fileName={form.fileName} onChange={(fileName) => onChange('fileName', fileName)} />
          </Stack>
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

function FileAttachField({ fileName, onChange }) {
  return (
    <Button
      fullWidth
      variant="outlined"
      component="label"
      startIcon={<AttachFileIcon />}
      sx={{
        minHeight: 56,
        justifyContent: 'flex-start',
        color: fileName ? 'neutral.900' : 'neutral.600',
        borderColor: 'neutral.300',
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
        {fileName || 'แนบไฟล์'}
      </Box>
      <Box
        component="input"
        type="file"
        hidden
        onChange={(event) => onChange(event.target.files?.[0]?.name ?? '')}
      />
    </Button>
  )
}

export default LawsPage
