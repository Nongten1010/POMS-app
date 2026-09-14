import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { Children, isValidElement, createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { getFaqEditForm, buildFaqFormData } from './faqAttachments.mjs'

function findElements(element, predicate) {
  if (!isValidElement(element)) return []
  return [
    ...(predicate(element) ? [element] : []),
    ...Children.toArray(element.props.children).flatMap((child) => findElements(child, predicate)),
  ]
}

test('FAQ attachment controls and rendered responses', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'poms-faq-test-'))
  const server = await createServer({
    cacheDir, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
    plugins: [{
      name: 'faq-test-exports', enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('/src/pages/FaqPage.jsx')) {
          return `${code}\nexport { FaqAttachmentsEditor, FaqAttachmentItem, FaqListItem, FaqFormDialog };`
        }
      },
    }],
  })
  try {
    const { FaqAttachmentsEditor, FaqAttachmentItem, FaqListItem, FaqFormDialog } = await server.ssrLoadModule('/src/pages/FaqPage.jsx')
    const attachment = { id: '11111111-1111-4111-8111-111111111111', fileName: 'guide.pdf', fileSize: 1024, downloadUrl: '/api/v1/faqs/faq-id/attachments/file-id' }
    const faq = { question: 'Question', answer: 'First\nSecond', category: 'CEMS', updatedDate: '2026-09-14', attachments: [attachment], links: ['https://example.com/guide'] }
    await t.test('main-list attachments wrap at 240px while dialog attachments retain their layout', () => {
      const list = FaqListItem({ faq: { ...faq, attachments: [attachment, { ...attachment, id: 'second' }] } })
      const items = findElements(list, (item) => item.type === FaqAttachmentItem)
      assert.equal(items.length, 2)
      assert.ok(items.every((item) => item.props.compact === true))
      const groups = findElements(list, (item) => item.props.sx?.flexWrap === 'wrap'
        && Children.toArray(item.props.children).some((child) => child.type === FaqAttachmentItem))
      assert.equal(groups.length, 1)
      const editor = FaqAttachmentsEditor({ form: getFaqEditForm(faq), errors: {}, busy: false })
      assert.ok(findElements(editor, (item) => item.type === FaqAttachmentItem).every((item) => !item.props.compact))
      const markup = renderToStaticMarkup(createElement(FaqAttachmentItem, { attachment, compact: true }))
      assert.match(markup, /width:240px/)
      assert.match(markup, /max-width:100%/)
      assert.match(markup, /text-overflow:ellipsis/)
      assert.match(markup, /aria-label="guide.pdf"/)
      const editorMarkup = renderToStaticMarkup(createElement(FaqAttachmentItem, { attachment }))
      assert.doesNotMatch(editorMarkup, /width:240px/)
    })
    await t.test('editing can retain old files while adding files, then explicitly remove old files and links', () => {
      let form = getFaqEditForm(faq)
      const editor = (busy = false) => FaqAttachmentsEditor({ form, errors: {}, busy, onChange: (name, value) => { form = { ...form, [name]: value } } })
      const [input] = findElements(editor(), (item) => item.props.type === 'file')
      assert.equal(input.props.multiple, true)
      const file = new File(['notes'], 'notes.txt')
      const target = { files: [file], value: 'notes.txt' }
      input.props.onChange({ target })
      assert.equal(target.value, '')
      assert.deepEqual(form.files, [file])
      assert.deepEqual(form.attachments, [attachment])
      let items = findElements(editor(), (item) => item.type === FaqAttachmentItem)
      assert.equal(items.length, 2)
      items[0].props.onRemove()
      assert.deepEqual(form.attachments, [])
      const [removeLink] = findElements(editor(), (item) => item.props['aria-label'] === 'นำลิงก์ที่ 1 ออก')
      removeLink.props.onClick()
      assert.equal(buildFaqFormData(form).get('links'), '[]')
      assert.equal(buildFaqFormData(form).get('attachmentIds'), '[]')
      items = findElements(editor(true), (item) => item.type === FaqAttachmentItem)
      assert.ok(items.every((item) => item.props.disabled))
      items = findElements(editor(), (item) => item.type === FaqAttachmentItem)
      items[0].props.onRemove()
      assert.deepEqual(form.files, [])
    })
    await t.test('response attachments and safe links render for public readers and admin', () => {
      for (const isAdmin of [false, true]) {
        const markup = renderToStaticMarkup(createElement(FaqListItem, { faq, isAdmin, defaultExpanded: true }))
        assert.match(markup, /guide\.pdf/)
        assert.match(markup, /href="\/api-proxy\/v1\/faqs\/faq-id\/attachments\/file-id"/)
        assert.match(markup, /href="https:\/\/example.com\/guide"/)
        assert.match(markup, /target="_blank"/)
        assert.match(markup, /First\nSecond/)
      }
      const markup = renderToStaticMarkup(createElement(FaqListItem, { faq: { ...faq, links: ['javascript:alert(1)'] } }))
      assert.doesNotMatch(markup, /href="javascript:/)
    })
    await t.test('create and edit use attachment editor and conflicts block save until reload', () => {
      for (const mode of ['create', 'edit']) {
        const form = getFaqEditForm(faq)
        let reloaded = false
        const dialog = FaqFormDialog({ mode, open: true, form, errors: {}, busy: false, hasConflict: true, requestError: 'Conflict', onReload: () => { reloaded = true } })
        assert.equal(findElements(dialog, (item) => item.type === FaqAttachmentsEditor).length, 1)
        const [save] = findElements(dialog, (item) => item.props.variant === 'contained')
        assert.equal(save.props.disabled, true)
        const [alert] = findElements(dialog, (item) => Boolean(item.props.action))
        alert.props.action.props.onClick()
        assert.equal(reloaded, true)
      }
    })
  } finally {
    await server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})
