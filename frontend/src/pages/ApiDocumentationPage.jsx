import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'

const accessTokenExample = 'Bearer <accessToken>'

const apiCategories = [
  {
    name: 'Authentication',
    endpoints: [
      {
        id: 'auth-login',
        method: 'POST',
        path: '/auth/login',
        url: 'http://d-poms.diw.go.th/api/v1/auth/login',
        testUrl: '/api-proxy/v1/auth/login',
        description: 'เข้าสู่ระบบสำหรับเจ้าหน้าที่หรือผู้ใช้งานตามประเภทบัญชี',
        defaultHeaders: {},
        defaultBody: {
          userType: 'officer',
          username: 'weekit',
          password: 'demo1234',
          departmentID: '1',
        },
        bodyFields: [
          { name: 'userType', type: 'string', required: true, example: 'officer, operator, citizen' },
          { name: 'username', type: 'string', required: true, example: '1234567890123, U1234' },
          { name: 'password', type: 'string', required: true, example: 'demo1234' },
          { name: 'departmentID', type: 'string', required: 'เฉพาะเจ้าหน้าที่', example: '1, 2, 8, 0' },
        ],
      },
      {
        id: 'auth-me',
        method: 'GET',
        path: '/auth/me',
        url: 'http://d-poms.diw.go.th/api/v1/auth/me',
        testUrl: '/api-proxy/v1/auth/me',
        description: 'ดึงข้อมูลผู้ใช้งานปัจจุบันจาก access token',
        defaultHeaders: {
          Authorization: accessTokenExample,
        },
        headerFields: [
          {
            name: 'Authorization',
            type: 'string',
            required: true,
            example: accessTokenExample,
          },
        ],
      },
    ],
  },
]

const endpoints = apiCategories.flatMap((category) =>
  category.endpoints.map((endpoint) => ({ ...endpoint, category: category.name })),
)

const defaultBodiesByEndpoint = Object.fromEntries(
  endpoints.map((endpoint) => [endpoint.id, formatJson(endpoint.defaultBody ?? {})]),
)

const defaultHeadersByEndpoint = Object.fromEntries(
  endpoints.map((endpoint) => [endpoint.id, formatJson(endpoint.defaultHeaders ?? {})]),
)

function ApiDocumentationPage() {
  const [selectedEndpointId, setSelectedEndpointId] = useState(endpoints[0].id)
  const selectedEndpoint = endpoints.find((endpoint) => endpoint.id === selectedEndpointId) ?? endpoints[0]
  const [requestBodies, setRequestBodies] = useState(defaultBodiesByEndpoint)
  const [requestHeadersByEndpoint, setRequestHeadersByEndpoint] = useState(defaultHeadersByEndpoint)
  const [response, setResponse] = useState(null)
  const [error, setError] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const requestBody = requestBodies[selectedEndpoint.id] ?? defaultBodiesByEndpoint[selectedEndpoint.id]
  const requestHeaders =
    requestHeadersByEndpoint[selectedEndpoint.id] ?? defaultHeadersByEndpoint[selectedEndpoint.id]

  const parsedBody = useMemo(() => parseJson(requestBody), [requestBody])
  const parsedHeaders = useMemo(() => parseJson(requestHeaders), [requestHeaders])
  const hasBody = Boolean(selectedEndpoint.defaultBody)
  const hasHeaders = Boolean(selectedEndpoint.headerFields?.length)

  const handleTest = async () => {
    if (hasBody && parsedBody.error) {
      setError(`JSON Body ไม่ถูกต้อง: ${parsedBody.error}`)
      setResponse(null)
      return
    }

    if (parsedHeaders.error) {
      setError(`Headers JSON ไม่ถูกต้อง: ${parsedHeaders.error}`)
      setResponse(null)
      return
    }

    setIsTesting(true)
    setError('')
    setResponse(null)

    try {
      const startedAt = performance.now()
      const headers = {
        Accept: 'application/json',
        ...parsedHeaders.value,
      }

      if (hasBody) {
        headers['Content-Type'] = 'application/json'
      }

      const result = await fetch(selectedEndpoint.testUrl, {
        method: selectedEndpoint.method,
        headers,
        ...(hasBody ? { body: JSON.stringify(parsedBody.value) } : {}),
      })
      const elapsedMs = Math.round(performance.now() - startedAt)
      const rawText = await result.text()

      let data = rawText
      try {
        data = rawText ? JSON.parse(rawText) : null
      } catch {
        data = rawText
      }

      setResponse({
        status: result.status,
        statusText: result.statusText,
        ok: result.ok,
        elapsedMs,
        headers: Object.fromEntries(result.headers.entries()),
        data,
      })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsTesting(false)
    }
  }

  const handleCopyRequest = async () => {
    await navigator.clipboard?.writeText(hasBody ? requestBody : requestHeaders)
  }

  return (
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
      <Paper
        elevation={0}
        sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { xs: 'flex-start', md: 'center' } }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
              API Documentation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              รายละเอียด API แยกตามหมวดหมู่ พร้อมทดสอบ request และดู response
            </Typography>
          </Box>
          <Chip label="Swagger style" color="primary" variant="outlined" />
        </Stack>
      </Paper>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: '336px minmax(0, 1fr)' },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            minHeight: 0,
            border: 1,
            borderColor: 'divider',
            overflow: 'auto',
          }}
        >
          <Box sx={{ p: 2, bgcolor: 'neutral.50', borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              หมวดหมู่
            </Typography>
          </Box>
          <Stack spacing={1.5} sx={{ p: 1.5 }}>
            {apiCategories.map((category) => (
              <Box key={category.name}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  {category.name}
                </Typography>
                <Stack spacing={1}>
                  {category.endpoints.map((endpoint) => (
                    <EndpointListItem
                      key={endpoint.id}
                      endpoint={endpoint}
                      selected={endpoint.id === selectedEndpoint.id}
                      onClick={() => {
                        setSelectedEndpointId(endpoint.id)
                        setResponse(null)
                        setError('')
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            minWidth: 0,
            minHeight: 0,
            border: 1,
            borderColor: 'divider',
            overflow: 'auto',
          }}
        >
          <Stack spacing={0}>
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
              >
                <MethodChip method={selectedEndpoint.method} />
                <Typography
                  variant="body1"
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: 'monospace',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {selectedEndpoint.url}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={isTesting ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
                  onClick={handleTest}
                  disabled={isTesting}
                >
                  Test API
                </Button>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                {selectedEndpoint.description}
              </Typography>
            </Box>

            <Divider />

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) minmax(0, 1fr)' },
              }}
            >
              <Stack spacing={2} sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
                {hasHeaders ? (
                  <RequestEditor
                    title="Headers"
                    fields={selectedEndpoint.headerFields}
                    label="Headers JSON"
                    value={requestHeaders}
                    onChange={(nextValue) =>
                      setRequestHeadersByEndpoint((current) => ({
                        ...current,
                        [selectedEndpoint.id]: nextValue,
                      }))
                    }
                    error={parsedHeaders.error}
                    helperText="แก้ไข header เพื่อทดสอบ API"
                  />
                ) : null}

                {hasBody ? (
                  <RequestEditor
                    title="Request Body"
                    fields={selectedEndpoint.bodyFields}
                    label="JSON Body"
                    value={requestBody}
                    onChange={(nextValue) =>
                      setRequestBodies((current) => ({
                        ...current,
                        [selectedEndpoint.id]: nextValue,
                      }))
                    }
                    error={parsedBody.error}
                    helperText="แก้ไขค่า request body เพื่อทดสอบ API"
                  />
                ) : null}

                {!hasHeaders && !hasBody ? <EmptyRequest /> : null}

                <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                  <Button startIcon={<ContentCopyIcon />} onClick={handleCopyRequest}>
                    {hasBody ? 'Copy Body' : 'Copy Headers'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setRequestBodies((current) => ({
                        ...current,
                        [selectedEndpoint.id]: defaultBodiesByEndpoint[selectedEndpoint.id],
                      }))
                      setRequestHeadersByEndpoint((current) => ({
                        ...current,
                        [selectedEndpoint.id]: defaultHeadersByEndpoint[selectedEndpoint.id],
                      }))
                    }}
                  >
                    Reset
                  </Button>
                </Stack>
              </Stack>

              <Stack
                spacing={2}
                sx={{
                  p: { xs: 2, md: 3 },
                  minWidth: 0,
                  borderTop: { xs: 1, xl: 0 },
                  borderLeft: { xs: 0, xl: 1 },
                  borderColor: 'divider',
                }}
              >
                <SectionTitle title="Response" />
                {error ? <Alert severity="error">{error}</Alert> : null}
                {response ? <ResponseViewer response={response} /> : <EmptyResponse />}
              </Stack>
            </Box>
          </Stack>
        </Paper>
      </Box>
    </Stack>
  )
}

function formatJson(value) {
  return JSON.stringify(value, null, 2)
}

function parseJson(value) {
  try {
    return { value: JSON.parse(value || '{}'), error: '' }
  } catch (parseError) {
    return { value: null, error: parseError.message }
  }
}

function EndpointListItem({ endpoint, selected, onClick }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        width: '100%',
        p: 1.5,
        border: 1,
        borderColor: selected ? 'primary.200' : 'divider',
        borderRadius: 1,
        bgcolor: selected ? 'primary.50' : 'background.paper',
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        '&:hover': {
          bgcolor: selected ? 'primary.50' : 'neutral.50',
        },
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <MethodChip method={endpoint.method} />
        <Typography
          variant="caption"
          sx={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: 'monospace',
          }}
        >
          {endpoint.path}
        </Typography>
      </Stack>
    </Box>
  )
}

function MethodChip({ method }) {
  const isPost = method === 'POST'

  return (
    <Chip
      label={method}
      size="small"
      sx={{
        width: 64,
        bgcolor: isPost ? '#16a34a' : '#2563eb',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontWeight: 600,
        borderRadius: 1,
      }}
    />
  )
}

function SectionTitle({ title }) {
  return (
    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
      {title}
    </Typography>
  )
}

function RequestEditor({ title, fields, label, value, onChange, error, helperText }) {
  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <SectionTitle title={title} />
      <Box sx={{ overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <FieldHeader />
        {fields.map((field) => (
          <FieldRow key={field.name} field={field} />
        ))}
      </Box>
      <TextField
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        multiline
        minRows={title === 'Headers' ? 5 : 9}
        error={Boolean(error)}
        helperText={error ? `JSON ไม่ถูกต้อง: ${error}` : helperText}
        fullWidth
        spellCheck={false}
        sx={{
          '& textarea': {
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: 13,
            lineHeight: 1.55,
          },
        }}
      />
    </Stack>
  )
}

function FieldHeader() {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(140px, 1fr) 96px 96px minmax(160px, 1.25fr)',
        gap: 1,
        minWidth: 640,
        px: 1.5,
        py: 1,
        bgcolor: 'neutral.50',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {['Name', 'Type', 'Required', 'Example'].map((field) => (
        <Typography key={field} variant="caption" sx={{ fontWeight: 600 }}>
          {field}
        </Typography>
      ))}
    </Box>
  )
}

function FieldRow({ field }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(140px, 1fr) 96px 96px minmax(160px, 1.25fr)',
        gap: 1,
        minWidth: 640,
        px: 1.5,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-child': { borderBottom: 0 },
      }}
    >
      <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
        {field.name}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {field.type}
      </Typography>
      <Typography variant="body2" color={field.required ? 'error.main' : 'text.secondary'}>
        {field.required ? 'Yes' : 'No'}
      </Typography>
      <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
        {field.example}
      </Typography>
    </Box>
  )
}

function EmptyRequest() {
  return (
    <Box
      sx={{
        p: 3,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'neutral.50',
        color: 'text.secondary',
      }}
    >
      <Typography variant="body2">API นี้ไม่มี request body หรือ headers ที่ต้องระบุ</Typography>
    </Box>
  )
}

function EmptyResponse() {
  return (
    <Box
      sx={{
        p: 3,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'neutral.50',
        color: 'text.secondary',
      }}
    >
      <Typography variant="body2">กด Test API เพื่อดู status, headers และ response body</Typography>
    </Box>
  )
}

function ResponseViewer({ response }) {
  const responseText = JSON.stringify(response.data, null, 2)
  const headersText = JSON.stringify(response.headers, null, 2)

  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Chip
          label={`${response.status} ${response.statusText}`}
          color={response.ok ? 'success' : 'error'}
          variant="outlined"
        />
        <Chip label={`${response.elapsedMs} ms`} variant="outlined" />
      </Stack>

      <CodeBlock title="Response Body" value={responseText} />
      <CodeBlock title="Headers" value={headersText} />
    </Stack>
  )
}

function CodeBlock({ title, value }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
        {title}
      </Typography>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          maxHeight: 320,
          overflow: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: '#0f172a',
          color: '#e2e8f0',
          fontSize: 13,
          lineHeight: 1.55,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {value || 'null'}
      </Box>
    </Box>
  )
}

export default ApiDocumentationPage
