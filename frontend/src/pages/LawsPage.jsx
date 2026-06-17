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

const initialLawItems = [
  {
    id: 'law-001',
    title: 'ประกาศกระทรวงอุตสาหกรรม เรื่อง การติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษเพื่อตรวจวัดมลพิษจากสถานปล่องโรงงาน',
    type: 'ประกาศกระทรวง',
    publishedDate: '2025-01-15',
    fileName: 'law-001.pdf',
  },
  {
    id: 'law-002',
    title: 'ประกาศกรมโรงงานอุตสาหกรรม เรื่อง หลักเกณฑ์การรายงานผลการตรวจวัดมลพิษทางน้ำแบบออนไลน์',
    type: 'ประกาศกรม',
    publishedDate: '2025-03-22',
    fileName: 'law-002.pdf',
  },
  {
    id: 'law-003',
    title: 'พระราชบัญญัติโรงงาน พ.ศ. 2535 และที่แก้ไขเพิ่มเติม',
    type: 'พระราชบัญญัติ',
    publishedDate: '1992-04-02',
    fileName: 'law-003.pdf',
  },
  {
    id: 'law-004',
    title: 'กฎกระทรวงกำหนดมาตรฐานควบคุมการระบายน้ำทิ้งจากโรงงาน',
    type: 'กฎกระทรวง',
    publishedDate: '2024-11-01',
    fileName: 'law-004.pdf',
  },
  {
    id: 'law-005',
    title: 'ประกาศกรมโรงงานอุตสาหกรรม เรื่อง การทวนสอบและสอบเทียบระบบ CEMS',
    type: 'ประกาศกรม',
    publishedDate: '2025-07-09',
    fileName: 'law-005.pdf',
  },
  {
    id: 'law-006',
    title: 'แนวทางปฏิบัติการแจ้งเหตุขัดข้องของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ',
    type: 'แนวปฏิบัติ',
    publishedDate: '2025-08-30',
    fileName: 'law-006.pdf',
  },
]

const lawTypes = ['ประกาศกระทรวง', 'ประกาศกรม', 'พระราชบัญญัติ', 'กฎกระทรวง', 'แนวปฏิบัติ']

const emptyForm = {
  title: '',
  type: '',
  publishedDate: '',
  fileName: '',
}

function formatThaiDate(value) {
  if (!value) {
    return '-'
  }

  return value
}

function createLawId() {
  return `law-${Date.now()}`
}

function LawsPage({ isAdmin = false }) {
  const [laws, setLaws] = useState(initialLawItems)
  const [dialogMode, setDialogMode] = useState('')
  const [selectedLaw, setSelectedLaw] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const sortedLaws = useMemo(
    () => [...laws].sort((first, second) => first.title.localeCompare(second.title, 'th')),
    [laws],
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

    if (!form.publishedDate) {
      nextErrors.publishedDate = 'กรุณาเลือกวันที่ประกาศ'
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
      `ประเภท: ${law.type}`,
      `วันที่ประกาศ: ${law.publishedDate}`,
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
            spacing={1.5}
            sx={{ alignItems: { xs: 'stretch', lg: 'center' } }}
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
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
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
            {sortedLaws.map((law) => (
              <LawListItem
                key={law.id}
                law={law}
                isAdmin={isAdmin}
                onDownload={downloadLaw}
                onEdit={openEditDialog}
                onDelete={openDeleteDialog}
              />
            ))}
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
            label={law.type}
            size="small"
            sx={{
              bgcolor: 'primary.50',
              color: 'primary.dark',
              fontWeight: 600,
            }}
          />
          <Typography variant="body2" color="text.secondary">
            วันที่ประกาศ {formatThaiDate(law.publishedDate)}
          </Typography>
        </Stack>
      </Stack>

      <Button
        variant="contained"
        startIcon={<DownloadIcon />}
        onClick={() => onDownload(law)}
        sx={{ justifySelf: { xs: 'stretch', md: 'end' }, whiteSpace: 'nowrap' }}
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
              label="ประเภท"
              value={form.type}
              error={Boolean(errors.type)}
              helperText={errors.type}
              onChange={(event) => onChange('type', event.target.value)}
              fullWidth
            >
              {lawTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
            <FileAttachField fileName={form.fileName} onChange={(fileName) => onChange('fileName', fileName)} />
          </Stack>
          <TextField
            label="วันที่ประกาศ"
            type="date"
            value={form.publishedDate}
            error={Boolean(errors.publishedDate)}
            helperText={errors.publishedDate}
            onChange={(event) => onChange('publishedDate', event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
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
