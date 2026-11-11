import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { displayMinuteValue, fetchMinuteMeasurements } from '../utils/minuteMeasurements.mjs'

export default function MinuteMeasurementsDialog({ context, onClose, url, accessToken }) {
  const [result, setResult] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    fetchMinuteMeasurements({ url, accessToken, context, signal: controller.signal }).then((payload) => {
      if (!controller.signal.aborted) setResult({ ...payload, context, accessToken })
    }).catch((error) => {
      if (!controller.signal.aborted) setResult({ error: error.message, context, accessToken })
    })
    return () => controller.abort()
  }, [context, url, accessToken])
  const current = result?.context === context && result?.accessToken === accessToken ? result : null
  const loading = !current
  const data = current?.data
  const rows = data?.rows ?? []
  const parameters = data?.parameters ?? []
  const columns = 1 + parameters.length * 2
  const hour = data?.hour ?? String(context.hour).padStart(2, '0')
  const [year, month, day] = (data?.date ?? context.date).split('-')
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="lg" aria-labelledby="minute-measurements-title"
      slotProps={{ paper: { sx: { m: { xs: 1, sm: 3 }, width: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 48px)' }, maxHeight: 'calc(100% - 32px)' } } }}>
      <DialogTitle sx={{ pr: 7 }}>
        <Typography id="minute-measurements-title" component="span" fontWeight={700}>ข้อมูลรายนาที {hour}:00–{hour}:59 น.</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {data?.stationId ?? context.stationId} · {data?.pointName ?? context.pointName} · {day}/{month}/{Number(year) + 543}
        </Typography>
        <IconButton aria-label="ปิดข้อมูลรายนาที" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {current?.error && <Alert severity="error" sx={{ m: 2 }}>{current.error}</Alert>}
        {loading && <Stack role="status" direction="row" spacing={1} sx={{ p: 2, alignItems: 'center' }}><CircularProgress size={20} /><Typography>กำลังโหลดข้อมูลรายนาที</Typography></Stack>}
        {current?.meta?.minutesWithData === 0 && <Alert severity="info" sx={{ m: 2 }}>ไม่พบข้อมูลในชั่วโมงนี้</Alert>}
        <TableContainer sx={{ overflow: 'auto', minHeight: 0 }}>
          <Table stickyHeader size="small" aria-label="ข้อมูลตรวจวัดรายนาที" sx={{ tableLayout: 'fixed', width: '100%', minWidth: columns * 140,
            '& th, & td': { width: `${100 / columns}%`, borderRight: 1, borderColor: 'divider', overflowWrap: 'anywhere', verticalAlign: 'top' },
            '& th': { fontWeight: 700, bgcolor: 'background.paper' },
            '& .minute-time': { position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 2 },
            '& thead .minute-time': { zIndex: 4 },
          }}>
            <TableHead><TableRow>
              <TableCell className="minute-time">เวลา</TableCell>
              {parameters.flatMap((parameter) => [
                <TableCell key={`${parameter}-value`}>{parameter}</TableCell>,
                <TableCell key={`${parameter}-status`}>สถานะ {parameter}</TableCell>,
              ])}
            </TableRow></TableHead>
            <TableBody>{rows.map((row) => <TableRow key={row.time}>
              <TableCell className="minute-time" component="th" scope="row">{row.time}</TableCell>
              {parameters.flatMap((parameter) => [
                <TableCell key={`${parameter}-value`} sx={{ whiteSpace: 'pre-wrap' }}>{displayMinuteValue(row.values[parameter]?.value)}</TableCell>,
                <TableCell key={`${parameter}-status`}>{displayMinuteValue(row.values[parameter]?.status)}</TableCell>,
              ])}
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ height: 8, flexShrink: 0 }} />
      </DialogContent>
    </Dialog>
  )
}
