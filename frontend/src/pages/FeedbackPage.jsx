import { useMemo, useRef, useState } from 'react'
import { Alert, Box, Button, Chip, Paper, Snackbar, Stack, TextField, Typography } from '@mui/material'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SendIcon from '@mui/icons-material/Send'

const feedbackEmail = 'feedback@d-poms.diw.go.th'

const initialForm = {
  email: '',
  name: '',
  phone: '',
  subject: '',
  fileName: '',
  details: '',
}

function buildMailtoUrl(form) {
  const subject = form.subject || 'ข้อเสนอแนะ D-POMS'
  const body = [
    `อีเมล: ${form.email}`,
    `ชื่อ: ${form.name}`,
    `เบอร์ติดต่อ: ${form.phone}`,
    `เรื่อง: ${form.subject}`,
    `ไฟล์แนบ: ${form.fileName || '-'}`,
    '',
    'รายละเอียด:',
    form.details,
  ].join('\n')

  return `mailto:${feedbackEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function FeedbackPage() {
  const fileInputRef = useRef(null)
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const hasFormValue = useMemo(
    () => Object.values(form).some((value) => value !== ''),
    [form],
  )

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

  const resetForm = () => {
    setForm(initialForm)
    setErrors({})
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const validateForm = () => {
    const nextErrors = {}

    if (!form.email.trim()) {
      nextErrors.email = 'กรุณากรอกที่อยู่อีเมล'
    }

    if (!form.name.trim()) {
      nextErrors.name = 'กรุณากรอกชื่อ'
    }

    if (!form.subject.trim()) {
      nextErrors.subject = 'กรุณากรอกเรื่อง'
    }

    if (!form.details.trim()) {
      nextErrors.details = 'กรุณากรอกรายละเอียด'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const sendFeedback = () => {
    if (!validateForm()) {
      return
    }

    window.location.href = buildMailtoUrl(form)
    setSnackbarOpen(true)
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
                ข้อเสนอแนะ
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ส่งความคิดเห็นหรือข้อเสนอแนะเกี่ยวกับการใช้งานระบบ
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Stack spacing={3}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{
                alignItems: { xs: 'flex-start', md: 'center' },
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'neutral.900' }}>
                  แบบฟอร์มข้อเสนอแนะ
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  กรอกข้อเสนอแนะเพื่อเปิดอีเมลพร้อมรายละเอียดที่ต้องการส่ง
                </Typography>
              </Box>
              <Chip label={feedbackEmail} size="small" variant="outlined" color="primary" />
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(12, minmax(0, 1fr))',
                },
                columnGap: 2,
                rowGap: 3,
              }}
            >
              <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 3' } }}>
                <LabeledField label="ที่อยู่อีเมล">
                  <TextField
                    fullWidth
                    size="small"
                    type="email"
                    value={form.email}
                    error={Boolean(errors.email)}
                    helperText={errors.email}
                    onChange={(event) => updateForm('email', event.target.value)}
                  />
                </LabeledField>
              </Box>
              <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 3' } }}>
                <LabeledField label="ชื่อ">
                  <TextField
                    fullWidth
                    size="small"
                    value={form.name}
                    error={Boolean(errors.name)}
                    helperText={errors.name}
                    onChange={(event) => updateForm('name', event.target.value)}
                  />
                </LabeledField>
              </Box>
              <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 3' } }}>
                <LabeledField label="เบอร์ติดต่อ">
                  <TextField
                    fullWidth
                    size="small"
                    value={form.phone}
                    onChange={(event) => updateForm('phone', event.target.value)}
                  />
                </LabeledField>
              </Box>
              <Box sx={{ display: { xs: 'none', md: 'block' }, gridColumn: 'span 3' }} />

              <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 3' } }}>
                <LabeledField label="เรื่อง">
                  <TextField
                    fullWidth
                    size="small"
                    value={form.subject}
                    error={Boolean(errors.subject)}
                    helperText={errors.subject}
                    onChange={(event) => updateForm('subject', event.target.value)}
                  />
                </LabeledField>
              </Box>
              <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 3' } }}>
                <LabeledField label="ไฟล์แนบ">
                  <Button
                    fullWidth
                    variant="outlined"
                    component="label"
                    startIcon={<AttachFileIcon />}
                    sx={{
                      height: 40,
                      justifyContent: 'flex-start',
                      color: form.fileName ? 'neutral.900' : 'neutral.600',
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
                      {form.fileName || 'เลือกไฟล์'}
                    </Box>
                    <Box
                      component="input"
                      ref={fileInputRef}
                      type="file"
                      hidden
                      onChange={(event) => updateForm('fileName', event.target.files?.[0]?.name ?? '')}
                    />
                  </Button>
                </LabeledField>
              </Box>
              <Box sx={{ display: { xs: 'none', md: 'block' }, gridColumn: 'span 6' }} />

              <Box sx={{ gridColumn: '1 / -1' }}>
                <LabeledField label="รายละเอียด">
                  <TextField
                    fullWidth
                    multiline
                    minRows={6}
                    value={form.details}
                    error={Boolean(errors.details)}
                    helperText={errors.details}
                    onChange={(event) => updateForm('details', event.target.value)}
                  />
                </LabeledField>
              </Box>
            </Box>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{
                justifyContent: 'flex-end',
                alignItems: { xs: 'stretch', sm: 'center' },
              }}
            >
              <Button variant="contained" startIcon={<SendIcon />} onClick={sendFeedback} sx={{ minWidth: 96 }}>
                ส่ง
              </Button>
              <Button
                variant="contained"
                color="inherit"
                startIcon={<RestartAltIcon />}
                onClick={resetForm}
                disabled={!hasFormValue}
                sx={{
                  minWidth: 104,
                  bgcolor: 'neutral.100',
                  color: 'neutral.700',
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: 'neutral.200',
                    boxShadow: 'none',
                  },
                }}
              >
                รีเซต
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSnackbarOpen(false)}>
          เปิดอีเมลสำหรับส่งข้อเสนอแนะแล้ว
        </Alert>
      </Snackbar>
    </Box>
  )
}

function LabeledField({ label, children }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1, color: 'neutral.700' }}>
        {label}
      </Typography>
      {children}
    </Box>
  )
}

export default FeedbackPage
