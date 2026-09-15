import assert from 'node:assert/strict'
import test from 'node:test'
import { openLawPdf } from './openLawPdf.mjs'

function createHarness() {
  const events = []
  let poll
  let blob
  const tab = {
    opener: {}, closed: false,
    document: { title: '', body: { textContent: '' } },
    location: { replace: (url) => events.push(['navigate', url]) },
    close() { this.closed = true; events.push(['close']) },
  }
  return {
    events, tab, getBlob: () => blob, poll: () => poll(),
    options: {
      title: 'Law.pdf',
      browser: {
        open: (...args) => { events.push(['open', ...args]); return tab },
        setInterval: (callback) => { poll = callback; return 1 },
        clearInterval: (id) => events.push(['clearInterval', id]),
      },
      urlApi: {
        createObjectURL: (value) => { blob = value; return 'blob:law-pdf' },
        revokeObjectURL: (url) => events.push(['revoke', url]),
      },
      fetchImpl: async (url, options) => {
        events.push(['fetch', url, options])
        return new Response('%PDF-1.7\nTest PDF', {
          headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="law.pdf"' },
        })
      },
    },
  }
}

test('law viewer opens a tab before fetching and converts forced download responses to PDF blobs', async () => {
  const h = createHarness()
  await openLawPdf('/api/v1/laws/law-id/download', h.options)
  assert.deepEqual(h.events[0], ['open', 'about:blank', '_blank'])
  assert.equal(h.events[1][0], 'fetch')
  assert.equal(h.tab.opener, null)
  assert.equal(h.tab.document.title, 'Law.pdf')
  assert.equal(h.getBlob().type, 'application/pdf')
  assert.equal(await h.getBlob().text(), '%PDF-1.7\nTest PDF')
  assert.deepEqual(h.events.at(-1), ['navigate', 'blob:law-pdf'])
  h.poll()
  assert.equal(h.events.some(([event]) => event === 'revoke'), false)
  h.tab.closed = true
  h.poll()
  assert.deepEqual(h.events.slice(-2), [['clearInterval', 1], ['revoke', 'blob:law-pdf']])
})

test('blocked popup does not fetch or silently download the file', async () => {
  const h = createHarness()
  h.options.browser.open = () => null
  await assert.rejects(openLawPdf('/law.pdf', h.options), /อนุญาต/)
  assert.equal(h.events.length, 0)
})

test('network errors, non-PDF and API errors close the reserved tab and surface the error', async () => {
  for (const fetchImpl of [
    async () => new Response('not a PDF', { headers: { 'Content-Type': 'application/pdf' } }),
    async () => new Response('', { status: 200 }),
    async () => new Response(JSON.stringify({ success: false, error: { message: 'Missing law' } }), { status: 404 }),
    async () => { throw new Error('Network failed') },
  ]) {
    const h = createHarness()
    await assert.rejects(openLawPdf('/law.pdf', { ...h.options, fetchImpl }), /PDF|Missing law|Network failed/)
    assert.equal(h.tab.closed, true)
    assert.equal(h.getBlob(), undefined)
  }
})

test('closing the tab while loading does not create a blob URL', async () => {
  const h = createHarness()
  const fetchImpl = h.options.fetchImpl
  h.options.fetchImpl = async (...args) => {
    h.tab.closed = true
    return fetchImpl(...args)
  }
  await openLawPdf('/law.pdf', h.options)
  assert.equal(h.getBlob(), undefined)
})

test('aborted requests close their reserved tab without creating a blob', async () => {
  const h = createHarness()
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(openLawPdf('/law.pdf', { ...h.options, signal: controller.signal }), { name: 'AbortError' })
  assert.equal(h.tab.closed, true)
  assert.equal(h.getBlob(), undefined)
})

test('navigation failure releases the created blob and closes the reserved tab', async () => {
  const h = createHarness()
  h.tab.location.replace = () => { throw new Error('Navigation failed') }
  await assert.rejects(openLawPdf('/law.pdf', h.options), /Navigation failed/)
  assert.ok(h.events.some(([event]) => event === 'revoke'))
  assert.equal(h.tab.closed, true)
})
