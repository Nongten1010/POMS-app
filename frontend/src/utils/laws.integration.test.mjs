import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { Children, isValidElement } from 'react'
import { createServer } from 'vite'

function findElements(element, predicate) {
  if (!isValidElement(element)) return []
  return [
    ...(predicate(element) ? [element] : []),
    ...Children.toArray(element.props.children).flatMap((child) => findElements(child, predicate)),
  ]
}

test('law file controls keep PDF validation and open existing buttons in a new tab', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'poms-laws-test-'))
  const server = await createServer({
    cacheDir,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    plugins: [{
      name: 'law-file-test-exports',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('/src/pages/LawsPage.jsx')) {
          return `${code}\nexport { LawListItem, LawFormDialog, FileAttachField, getFileValidationMessage, getEditableLawType, getLawTypeLabel, buildLawFormData, emptyForm };`
        }
      },
    }],
  })
  try {
    const {
      LawListItem, LawFormDialog, FileAttachField, getFileValidationMessage,
      getEditableLawType, getLawTypeLabel, buildLawFormData, emptyForm,
    } = await server.ssrLoadModule('/src/pages/LawsPage.jsx')
    await t.test('create and edit offer five new types in order and send distinct multipart values', () => {
      const options = [
        ['MINISTERIAL_REGULATION', 'กฎกระทรวงอุตสาหกรรม'],
        ['MINISTRY_ANNOUNCEMENT', 'ประกาศกระทรวงอุตสาหกรรม'],
        ['DEPARTMENT_ANNOUNCEMENT', 'ประกาศกรมโรงงานอุตสาหกรรม'],
        ['REGULATION_REQUIREMENT', 'ระเบียบ ข้อบังคับ และข้อกำหนด'],
        ['OTHER', 'อื่นๆ'],
      ]
      for (const mode of ['create', 'edit']) {
        const element = LawFormDialog({ mode, open: true, form: emptyForm, errors: {} })
        const [select] = findElements(element, (child) => child.props.label === 'ประเภท')
        assert.deepEqual(Children.toArray(select.props.children).map(({ props }) => [props.value, props.children]), options)
      }
      for (const [type, label] of options) {
        assert.equal(getEditableLawType(type), type)
        assert.equal(getLawTypeLabel(type, 'Old label'), label)
        const body = buildLawFormData({ ...emptyForm, title: ' Test ', category: 'CEMS', type, publishedDate: '2026-09-14' })
        assert.deepEqual(Object.fromEntries(body), { title: 'Test', category: 'CEMS', type, publishedDate: '2026-09-14' })
      }
      for (const type of ['RULE_AND_ANNOUNCEMENT', '', null, undefined]) {
        assert.equal(getEditableLawType(type), '')
      }
      assert.equal(getLawTypeLabel('RULE_AND_ANNOUNCEMENT', 'กฎและประกาศ'), 'กฎและประกาศ')
    })
    await t.test('desktop and mobile links use new tabs without forcing downloads', () => {
      for (const isAdmin of [true, false]) {
        for (const downloadUrl of ['https://example.com/law.pdf', '']) {
          const element = LawListItem({
            law: { title: 'Test law', file: { downloadUrl, fileName: 'law.pdf' } },
            isAdmin,
          })
          const links = findElements(element, (child) => child.props.component === 'a')
          assert.equal(links.length, 2)
          for (const { props } of links) {
            assert.equal(props.href, downloadUrl || undefined)
            assert.equal(props.target, '_blank')
            assert.equal(props.rel, 'noopener noreferrer')
            assert.equal(props.download, undefined)
            assert.equal(props.disabled, !downloadUrl)
          }
          assert.equal(links[0].props['aria-label'], 'ดาวน์โหลดไฟล์')
          assert.equal(links[1].props.children, 'ดาวน์โหลดไฟล์')
        }
      }
    })
    await t.test('file selection and submission accept only nonempty PDF files up to 10 MB', () => {
      const element = FileAttachField({})
      const [input] = findElements(element, (child) => child.props.type === 'file')
      assert.equal(input.props.accept, 'application/pdf,.pdf')
      const pdf = { name: 'law.PDF', type: 'application/pdf', size: 1024 }
      assert.equal(getFileValidationMessage(pdf), '')
      assert.equal(getFileValidationMessage(null), '')
      for (const file of [
        { ...pdf, name: 'law.docx' },
        { ...pdf, type: 'image/png' },
        { ...pdf, size: 0 },
        { ...pdf, size: 10 * 1024 * 1024 + 1 },
      ]) {
        assert.notEqual(getFileValidationMessage(file), '')
      }
      assert.equal(getFileValidationMessage({ ...pdf, size: 10 * 1024 * 1024 }), '')
    })
  } finally {
    await server.close()
    await rm(cacheDir, { recursive: true, force: true })
  }
})
