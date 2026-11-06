import { useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import TableChartIcon from '@mui/icons-material/TableChart'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import { fetchGeneralInformation, formatSummaryNumber, summarySections } from '../utils/generalInformation.mjs'

export default function GeneralInformationPage({ accessToken }) {
  const [systemType, setSystemType] = useState('CEMS')
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState({ loading: true, data: null, error: '', systemType: '' })
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetchGeneralInformation({ systemType, accessToken, signal: controller.signal, isDevelopment: import.meta.env.DEV })
      .then((data) => { if (!controller.signal.aborted) setResult({ loading: false, data, error: '', systemType }) })
      .catch((error) => { if (!controller.signal.aborted) setResult({ loading: false, data: null, error: error.message, systemType }) })
    return () => controller.abort()
  }, [systemType, accessToken, revision])
  const loading = result.loading || result.systemType !== systemType
  const data = loading ? null : result.data
  const sections = summarySections(data, systemType)
  const refresh = () => {
    setResult({ loading: true, data: null, error: '', systemType })
    setRevision((value) => value + 1)
  }
  const exportReport = async (format) => {
    setExporting(true)
    setExportError('')
    try {
      const { exportGeneralInformation } = await import('../utils/generalInformationExport.js')
      await exportGeneralInformation({ sections, systemType, generatedAt: data.generatedAt, format })
    } catch {
      setExportError('ไม่สามารถส่งออกไฟล์ได้ กรุณาลองใหม่')
    } finally {
      setExporting(false)
    }
  }
  return (
    <Stack spacing={2} sx={{ height: '100%', overflow: 'auto', pb: 2 }}>
      <Box sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', px: 2, py: 1.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
          <Typography component="h1" variant="h5">ข้อมูลทั่วไป</Typography>
          <Tabs value={systemType} onChange={(_, value) => { setSystemType(value); setExportError('') }} aria-label="ระบบตรวจวัด">
            <Tab value="CEMS" label="CEMS" /><Tab value="WPMS" label="WPMS" />
          </Tabs>
        </Stack>
      </Box>
      <Box sx={{ px: { xs: 1.5, md: 2 } }}>
        <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: { xs: '1 0 100%', sm: 1 }, minWidth: 180 }}>ทั่วประเทศ{data ? ` · ข้อมูล ณ ${new Intl.DateTimeFormat('th-TH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(data.generatedAt))}` : ''}</Typography>
          <Button startIcon={<RefreshIcon />} disabled={loading} onClick={refresh}>รีเฟรช</Button>
          <Button variant="outlined" startIcon={<TableChartIcon />} disabled={!data || exporting} onClick={() => exportReport('xlsx')}>Excel</Button>
          <Button variant="outlined" startIcon={<PictureAsPdfIcon />} disabled={!data || exporting} onClick={() => exportReport('pdf')}>PDF</Button>
        </Stack>
        {exporting && <Typography role="status" variant="body2">กำลังจัดเตรียมไฟล์...</Typography>}
        {exportError && <Alert severity="error" sx={{ mb: 2 }}>{exportError}</Alert>}
        {loading ? <Stack direction="row" spacing={1} role="status" sx={{ py: 3 }}><CircularProgress size={20} /><Typography>กำลังโหลดข้อมูล...</Typography></Stack>
          : result.error ? <Alert severity="error">{result.error}</Alert>
            : !data && <Alert severity="info" sx={{ mb: 2 }}>ยังไม่มีข้อมูลสรุปจากระบบ</Alert>}
        {!loading && !result.error && sections.map((section) => (
          <Box component="section" key={section.title} sx={{ py: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography component="h2" variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>{section.title}</Typography>
            <TableContainer>
              <Table size="small" aria-label={section.title} sx={{ minWidth: 560, tableLayout: 'fixed', bgcolor: 'background.paper', '& th, & td': { py: 1.25, border: 1, borderColor: 'divider' }, '& tr > :first-child': { width: '45%' } }}>
                <TableHead><TableRow>{section.headers.map((header, index) => <TableCell key={header} align={index ? 'right' : 'left'} sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>{header}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {section.rows.map((row, index) => <TableRow key={row[0]} sx={section.total && index === section.rows.length - 1 ? { bgcolor: 'action.hover', '& td, & th': { fontWeight: 700 } } : { '&:hover': { bgcolor: 'action.hover' } }}>
                    {row.map((value, column) => <TableCell key={column} component={column ? 'td' : 'th'} scope={column ? undefined : 'row'} align={column ? 'right' : 'left'} sx={{ fontVariantNumeric: 'tabular-nums' }}>{column ? formatSummaryNumber(value) : value}</TableCell>)}
                  </TableRow>)}
                  {!section.rows.length && <TableRow><TableCell colSpan={section.headers.length} align="center" sx={{ color: 'text.secondary' }}>ไม่มีข้อมูล</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ))}
      </Box>
    </Stack>
  )
}
