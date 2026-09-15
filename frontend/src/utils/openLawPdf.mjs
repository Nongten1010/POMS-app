import { readContentApiResponse } from './contentApi.mjs'

export async function openLawPdf(url, {
  signal, title = 'PDF', browser = window, fetchImpl = fetch, urlApi = URL,
} = {}) {
  // Reserve the tab during the click so asynchronous fetching does not trigger popup blocking.
  const tab = browser.open('about:blank', '_blank')
  if (!tab) throw new Error('กรุณาอนุญาตให้เว็บไซต์เปิดแท็บใหม่ แล้วลองอีกครั้ง')
  let blobUrl = ''
  try {
    tab.opener = null
    tab.document.title = title
    tab.document.body.textContent = 'กำลังโหลดเอกสาร PDF...'
    const response = await fetchImpl(url, { signal, headers: { Accept: 'application/pdf' } })
    if (!response.ok) {
      await readContentApiResponse(response, 'ไม่สามารถโหลดเอกสาร PDF ได้')
    }
    const file = await response.blob()
    const header = await file.slice(0, 1024).text()
    if (!header.includes('%PDF-')) throw new Error('ไฟล์ที่ได้รับไม่ใช่เอกสาร PDF')
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (tab.closed) return

    blobUrl = urlApi.createObjectURL(new Blob([file], { type: 'application/pdf' }))
    tab.location.replace(blobUrl)
    // Keep the URL valid for the viewer's print/download controls until the tab closes.
    const interval = browser.setInterval(() => {
      if (tab.closed) {
        browser.clearInterval(interval)
        urlApi.revokeObjectURL(blobUrl)
      }
    }, 1000)
  } catch (error) {
    if (blobUrl) urlApi.revokeObjectURL(blobUrl)
    if (!tab.closed) tab.close()
    throw error
  }
}
