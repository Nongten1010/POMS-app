import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createServer } from 'vite'

test('document links remain in request payload while only files use the upload API', async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'poms-document-upload-test-'))
  const originalFetch = globalThis.fetch
  const server = await createServer({
    cacheDir,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    plugins: [{
      name: 'document-upload-test-exports',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('/src/pages/ConnectionRequestPage.jsx')) {
          return `${code}\nexport { uploadDocumentImages, buildDocumentsAndImages };`
        }
      },
    }],
  })

  try {
    const { uploadDocumentImages, buildDocumentsAndImages } = await server.ssrLoadModule('/src/pages/ConnectionRequestPage.jsx')
    const link = 'https://drive.google.com/drive/folders/example'
    const formData = new FormData()
    formData.append('documentImageLink-0', link)
    const uploads = []
    globalThis.fetch = async (_url, options) => {
      uploads.push(options.body)
      return { ok: true, text: async () => JSON.stringify({ success: true, data: {
        title: 'ข้อมูลรายละเอียดการรายงานค่าที่สภาวะมาตรฐาน',
        fileName: 'report.pdf', fileUrl: 'https://example.com/report.pdf', fileType: 'application/pdf', fileSize: 3,
      } }) }
    }

    assert.deepEqual(await uploadDocumentImages(formData, 'token', '/document-images'), [])
    assert.equal(uploads.length, 0)
    const linkDocument = buildDocumentsAndImages(formData)[0]
    assert.equal(linkDocument.link, link)
    assert.equal(linkDocument.fileUrl, null)

    formData.append('documentImageFile-0', new File(['pdf'], 'report.pdf', { type: 'application/pdf' }))
    const uploaded = await uploadDocumentImages(formData, 'token', '/document-images')
    assert.equal(uploads.length, 1)
    assert.equal(uploads[0].get('file').name, 'report.pdf')
    assert.equal(uploads[0].get('link'), link)
    const fileDocument = buildDocumentsAndImages(formData, uploaded)[0]
    assert.equal(fileDocument.fileUrl, 'https://example.com/report.pdf')
    assert.equal(fileDocument.link, link)
  } finally {
    globalThis.fetch = originalFetch
    await server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})
