import { useState } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material'
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead'
import SendIcon from '@mui/icons-material/Send'

const emailTestApiUrl = import.meta.env.DEV
  ? '/api-local/v1/email-test/send'
  : 'http://d-poms.diw.go.th/api/v1/email-test/send'

const fixedRecipient = 'yuth.s@ku.th'

function getErrorMessage(payload) {
  return payload?.error?.message || payload?.message || 'ส่งเมลทดสอบไม่สำเร็จ'
}

function EmailTestPage({ accessToken }) {
  const [subject, setSubject] = useState('POMS SMTP Test')
  const [message, setMessage] = useState('ทดสอบการส่งอีเมลจากระบบ POMS')
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [isSending, setIsSending] = useState(false)

  const canSend = Boolean(accessToken) && !isSending && subject.trim() && message.trim()

  async function handleSend() {
    if (!canSend) {
      return
    }

    setIsSending(true)
    setStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(emailTestApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || payload?.success !== true) {
        throw new Error(getErrorMessage(payload))
      }

      setStatus({
        type: 'success',
        message: `ส่งเมลทดสอบไปที่ ${payload.data?.to ?? fixedRecipient} แล้ว`,
      })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'ส่งเมลทดสอบไม่สำเร็จ',
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100%',
        bgcolor: 'grey.50',
        px: { xs: 2, md: 4 },
        py: { xs: 3, md: 4 },
      }}
    >
      <Stack spacing={3} sx={{ maxWidth: 760 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <MarkEmailReadIcon color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={600}>
              ทดสอบส่งอีเมล
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ส่งไปที่ {fixedRecipient}
            </Typography>
          </Box>
        </Stack>

        {!accessToken ? <Alert severity="warning">กรุณาเข้าสู่ระบบก่อนส่งเมลทดสอบ</Alert> : null}
        {status.type === 'success' ? <Alert severity="success">{status.message}</Alert> : null}
        {status.type === 'error' ? <Alert severity="error">{status.message}</Alert> : null}

        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 1,
            bgcolor: 'background.paper',
          }}
        >
          <Stack spacing={2.5}>
            <TextField
              label="หัวข้ออีเมล"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 120 } }}
              fullWidth
            />
            <TextField
              label="ข้อความ"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
              fullWidth
              multiline
              minRows={5}
            />
            <Box>
              <Button
                variant="contained"
                startIcon={isSending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                disabled={!canSend}
                onClick={handleSend}
              >
                ส่งเมลทดสอบ
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  )
}

export default EmailTestPage
