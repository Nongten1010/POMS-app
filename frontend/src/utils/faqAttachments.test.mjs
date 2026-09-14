import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFaqFormData, getFaqEditForm, getFaqAttachmentErrors, getFaqLink } from './faqAttachments.mjs'

const faq = {
  id: '8d6a040b-f133-41f6-860d-4bb4dc08e72e',
  question: ' Question ', answer: ' Line 1\nLine 2 ', category: 'CEMS', updatedDate: '2026-09-14',
  attachments: [{ id: '11111111-1111-4111-8111-111111111111' }, { id: '22222222-2222-4222-8222-222222222222' }],
  links: ['https://example.com/old'],
}

test('FAQ edit prefills copies of attachments and links, including legacy empty responses', () => {
  const form = getFaqEditForm(faq)
  assert.deepEqual(form.attachments, faq.attachments)
  assert.notEqual(form.attachments, faq.attachments)
  assert.notEqual(form.links, faq.links)
  assert.deepEqual(form.files, [])
  const legacy = getFaqEditForm({ ...faq, attachments: undefined, links: undefined })
  assert.deepEqual(legacy.attachments, [])
  assert.deepEqual(legacy.links, [''])
})

test('FAQ multipart keeps selected UUIDs, appends files repeatedly, and preserves answer line breaks', async () => {
  const form = getFaqEditForm(faq)
  form.attachments = [form.attachments[1]]
  form.links = [' https://example.com/new ', '', '  ']
  form.files = [new File(['%PDF-1.7'], 'guide.pdf'), new File(['notes'], 'guide.txt')]
  const body = buildFaqFormData(form)
  assert.equal(body.get('question'), 'Question')
  assert.equal(body.get('answer'), 'Line 1\nLine 2')
  assert.equal(body.get('category'), 'CEMS')
  assert.equal(body.get('updatedDate'), '2026-09-14')
  assert.deepEqual(JSON.parse(body.get('attachmentIds')), [faq.attachments[1].id])
  assert.deepEqual(JSON.parse(body.get('links')), ['https://example.com/new'])
  assert.deepEqual(body.getAll('files').map((file) => file.name), ['guide.pdf', 'guide.txt'])
  assert.equal(await body.getAll('files')[0].text(), '%PDF-1.7')
  assert.equal(body.has('files[]'), false)
  assert.equal(body.has('links[]'), false)
  assert.equal(body.has('id'), false)
  const request = new Request('https://example.com/api/v1/faqs', { method: 'POST', body })
  assert.match(request.headers.get('Content-Type'), /^multipart\/form-data; boundary=/)
})

test('FAQ clear-all and create send explicit empty arrays without old attachment IDs', () => {
  const form = { ...getFaqEditForm(faq), attachments: [], links: [''] }
  const body = buildFaqFormData(form)
  assert.equal(body.get('links'), '[]')
  assert.equal(body.get('attachmentIds'), '[]')
  assert.equal(body.has('files'), false)
})

test('FAQ file limits count retained plus new attachments and validate all supported extensions', () => {
  const validFile = { name: 'guide.pdf', size: 10 * 1024 * 1024 }
  for (const ext of ['PDF', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'txt']) {
    assert.deepEqual(getFaqAttachmentErrors({ files: [{ ...validFile, name: `guide.${ext}` }] }), {})
  }
  assert.deepEqual(getFaqAttachmentErrors({ files: [validFile], attachments: Array(9).fill({}) }), {})
  assert.ok(getFaqAttachmentErrors({ files: [validFile], attachments: Array(10).fill({}) }).files)
  for (const file of [
    { ...validFile, name: 'guide.exe' }, { ...validFile, name: 'guide.pdf.exe' },
    { ...validFile, size: 0 }, { ...validFile, size: validFile.size + 1 },
    { ...validFile, name: `${'a'.repeat(256)}.pdf` },
  ]) assert.ok(getFaqAttachmentErrors({ files: [file] }).files)
})

test('FAQ URL validation allows HTTP/HTTPS only without credentials and limits count and length', () => {
  assert.equal(getFaqLink(' https://example.com/a '), 'https://example.com/a')
  assert.equal(getFaqLink('http://example.com'), 'http://example.com')
  for (const link of ['javascript:alert(1)', '//example.com', 'ftp://example.com', 'https://', 'https://user:pass@example.com', 'https://example.com/' + 'a'.repeat(2048)]) {
    assert.equal(getFaqLink(link), '')
    assert.ok(getFaqAttachmentErrors({ links: [link] }).links)
  }
  assert.deepEqual(getFaqAttachmentErrors({ links: ['', '  ', ...Array(20).fill('https://example.com')] }), {})
  assert.ok(getFaqAttachmentErrors({ links: Array(21).fill('https://example.com') }).links)
})
