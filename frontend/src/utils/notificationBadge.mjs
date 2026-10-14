export function getThaiToday(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map(({ type, value }) => [type, value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export async function fetchTodayNotificationCount({ apiBaseUrl, query, date, accessToken, signal, fetchImpl = fetch }) {
  let count = 0
  let previousPage = null
  for (let page = 1; ; page++) {
    signal?.throwIfAborted()
    const params = new URLSearchParams(query)
    params.set('dateFrom', date)
    params.set('dateTo', date)
    params.set('page', String(page))
    params.set('pageSize', '100')
    const result = await fetchImpl(`${apiBaseUrl}?${params}`, {
      signal, headers: { Authorization: `Bearer ${accessToken}` },
    })
    const response = await result.json()
    if (!result.ok || response?.success === false || !Array.isArray(response?.data)) {
      throw new Error('Unable to load notification badge count')
    }
    signal?.throwIfAborted()
    const rows = response.data
    const pageSignature = JSON.stringify(rows)
    if (rows.length && pageSignature === previousPage) {
      throw new Error('Notification pagination returned the same page')
    }
    previousPage = pageSignature
    count += rows.length
    if (rows.length < 100) return count
  }
}
