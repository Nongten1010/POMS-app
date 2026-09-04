export class ContentApiError extends Error {
  constructor(message, { code = '', details = {}, status = 0 } = {}) {
    super(message)
    this.name = 'ContentApiError'
    this.code = code
    this.details = details
    this.status = status
  }
}

function normalizeDetailValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(' ')
  }

  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

export function normalizeContentErrorDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(details)
      .map(([field, value]) => [field, normalizeDetailValue(value)])
      .filter(([, value]) => value),
  )
}

export async function readContentApiResponse(result, fallbackMessage) {
  const rawText = await result.text()
  let payload = null

  try {
    payload = rawText ? JSON.parse(rawText) : null
  } catch {
    payload = null
  }

  if (!result.ok || payload?.success === false) {
    throw new ContentApiError(payload?.error?.message || fallbackMessage, {
      code: payload?.error?.code,
      details: normalizeContentErrorDetails(payload?.error?.details),
      status: result.status,
    })
  }

  return payload
}

export function buildContentApiHeaders(accessToken, headers = {}) {
  if (!accessToken) {
    return headers
  }

  return {
    ...headers,
    Authorization: `Bearer ${accessToken}`,
  }
}

export function getContentApiUrl(resource, id = '', isDevelopment = Boolean(import.meta.env?.DEV)) {
  const prefix = isDevelopment ? '/api-proxy/v1' : '/api/v1'
  const baseUrl = `${prefix}/${resource}`

  return id ? `${baseUrl}/${encodeURIComponent(id)}` : baseUrl
}

export function resolveContentDownloadUrl(url, isDevelopment = Boolean(import.meta.env?.DEV)) {
  if (typeof url !== 'string' || !url.trim()) {
    return ''
  }

  if (isDevelopment && url.startsWith('/api/')) {
    return `/api-proxy/${url.slice('/api/'.length)}`
  }

  return url
}
