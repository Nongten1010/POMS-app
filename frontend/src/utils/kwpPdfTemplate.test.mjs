import assert from 'node:assert/strict'
import test from 'node:test'
import { KwpPdfTemplate } from './kwpPdfTemplate.mjs'

function fixture() {
  const text = []
  const rectangles = []
  const lines = []
  let pageNumber = 1
  const page = {
    drawRectangle: (options) => rectangles.push({ ...options, page: pageNumber }),
    drawLine: (options) => lines.push({ ...options, page: pageNumber }),
  }
  const font = { heightAtSize: (_, options) => options?.descender === false ? 8 : 10 }
  const layout = {
    y: 202, margin: { top: 20 }, pageSize: [200, 240], fonts: { regular: font, bold: {} }, page,
    addPage() { pageNumber += 1; this.y = 220; this.page = page },
    drawTextAt(value, x, y) { text.push({ text: value, x, y, page: pageNumber }) },
  }
  const flow = new KwpPdfTemplate(layout)
  flow.bottom = 24
  function row(top, height, value, options = {}) {
    flow.row(top, height, options)
    layout.page.drawRectangle({ x: 20, y: top - height, width: 160, height })
    if (value) layout.page.drawText(value, { x: 28, y: top - 12, size: 10, font })
  }
  return { layout, flow, font, text, rectangles, lines, row }
}

test('short template rows preserve their original borders, text and dotted line coordinates', () => {
  const f = fixture()
  f.row(220, 20, 'factory')
  f.layout.page.drawLine({ start: { x: 80, y: 204 }, end: { x: 175, y: 204 }, dashArray: [1.2, 2.1] })
  f.row(200, 20, 'point')
  f.flow.finish(180)
  assert.deepEqual(f.text, [{ text: 'factory', x: 28, y: 208, page: 1 }, { text: 'point', x: 28, y: 188, page: 1 }])
  assert.deepEqual(f.rectangles.map(({ y, height }) => ({ y, height })), [{ y: 200, height: 20 }, { y: 180, height: 20 }])
  assert.deepEqual(f.lines[0].dashArray, [1.2, 2.1])
  assert.equal(f.lines[0].start.y, 204)
})

test('wrapped text grows its original frame and moves the following row, not the columns', () => {
  const f = fixture()
  f.row(220, 20, 'line1')
  f.layout.page.drawText('line2', { x: 90, y: 190, size: 10, font: f.font })
  f.layout.page.drawLine({ start: { x: 80, y: 220 }, end: { x: 80, y: 200 } })
  f.row(200, 20, 'next')
  f.flow.finish(180)
  assert.equal(f.rectangles[0].height, 32.5)
  assert.equal(f.lines[0].end.y, 187.5)
  assert.equal(f.text.find((item) => item.text === 'next').y, 175.5)
  assert.equal(f.text.find((item) => item.text === 'line2').x, 90)
})

test('a section moves as a unit and an oversized section repeats the existing header', () => {
  const f = fixture()
  f.row(220, 130, 'intro')
  f.flow.section(90)
  f.row(90, 20, 'HEADER', { header: true })
  for (let i = 0; i < 4; i += 1) f.row(70 - i * 50, 50, `ROW-${i}`)
  f.flow.finish(-130)
  for (const page of new Set(f.text.filter((item) => item.text.startsWith('ROW')).map((item) => item.page))) {
    assert.equal(f.text.find((item) => item.page === page).text, 'HEADER')
  }
  assert.ok(f.rectangles.every((item) => item.y >= 24))
})

test('a subheading stays with a multi-page item and no text is lost at page cuts', () => {
  const f = fixture()
  f.flow.section(220)
  f.row(220, 20, 'HEADER', { header: true })
  f.row(200, 20, 'SUBHEADING', { keepWithNext: true })
  f.row(180, 20, '')
  for (let i = 0; i < 45; i += 1) f.layout.page.drawText(`LINE-${i}`, { x: 28, y: 168 - i * 12, size: 10, font: f.font })
  f.flow.finish(160)
  assert.equal(f.text.find((item) => item.text === 'SUBHEADING').page, f.text.find((item) => item.text === 'LINE-0').page)
  assert.deepEqual(f.text.filter((item) => item.text.startsWith('LINE-')).map((item) => item.text), Array.from({ length: 45 }, (_, i) => `LINE-${i}`))
  assert.ok(f.text.every((item) => item.y >= 26 && item.y <= 220))
  assert.ok(f.rectangles.every((item) => item.y >= 24))
})
