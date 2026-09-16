// Record the existing template's drawing coordinates; only translate rows vertically.
// Borders, horizontal spacing, checkboxes and dotted lines remain template-owned.
export class KwpPdfTemplate {
  constructor(layout) {
    this.layout = layout
    this.page = layout.page
    this.startY = layout.y
    this.bottom = 24
    this.sections = []
    this.currentSection = { rows: [] }
    this.sections.push(this.currentSection)
    this.current = { top: layout.y + 18, minimum: 0, operations: [] }
    layout.templateRecording = true
    layout.page = {
      drawText: (text, options) => this.current.operations.push({ kind: 'text', text, ...options }),
      drawLine: (options) => this.current.operations.push({ kind: 'line', ...options }),
      drawRectangle: (options) => this.current.operations.push({ kind: 'rectangle', ...options }),
    }
  }

  flush(nextTop) {
    const row = this.current
    if (!row) return
    let height = row.minimum || Math.max(0, row.top - nextTop)
    for (const op of row.operations) {
      if (op.kind === 'text') {
        const descent = op.font.heightAtSize(op.size) - op.font.heightAtSize(op.size, { descender: false })
        height = Math.max(height, row.top - op.y + descent + 0.5)
      }
    }
    row.height = height
    if (row.operations.length) this.currentSection.rows.push(row)
    this.current = null
  }

  section(top) {
    this.flush(top)
    this.currentSection = { rows: [] }
    this.sections.push(this.currentSection)
  }

  row(top, minimum, { header = false, keepWithNext = false } = {}) {
    this.flush(top)
    this.current = { top, minimum, header, keepWithNext, operations: [] }
  }

  textBounds(row, op) {
    const ascent = op.font.heightAtSize(op.size, { descender: false })
    const descent = op.font.heightAtSize(op.size) - ascent
    return { top: row.top - op.y - ascent, bottom: row.top - op.y + descent }
  }

  drawSlice(row, from = 0, to = row.height) {
    const { layout } = this
    const pageTop = layout.y
    const mapY = (depth) => pageTop - (depth - from)
    for (const op of row.operations) {
      if (op.kind === 'text') {
        const bounds = this.textBounds(row, op)
        if (bounds.top < from - 0.01 || bounds.bottom > to + 0.01) continue
        layout.drawTextAt(op.text, op.x, mapY(row.top - op.y), {
          size: op.size, bold: op.font === layout.fonts.bold, color: op.color,
        })
      } else if (op.kind === 'rectangle') {
        const top = row.top - op.y - op.height
        const bottom = Math.abs(top) < 0.01 && Math.abs(op.height - row.minimum) < 0.01 ? row.height : top + op.height
        const clippedTop = Math.max(from, top)
        const clippedBottom = Math.min(to, bottom)
        if (clippedBottom <= clippedTop) continue
        const { kind: _kind, ...options } = op
        layout.page.drawRectangle({ ...options, y: mapY(clippedBottom), height: clippedBottom - clippedTop })
      } else {
        let start = row.top - op.start.y
        let end = row.top - op.end.y
        if (Math.abs(op.start.x - op.end.x) < 0.01) {
          if (Math.abs(start - row.minimum) < 0.01) start = row.height
          if (Math.abs(end - row.minimum) < 0.01) end = row.height
          const top = Math.max(from, Math.min(start, end))
          const bottom = Math.min(to, Math.max(start, end))
          if (bottom <= top) continue
          start = top
          end = bottom
        } else if (Math.min(start, end) < from - 0.01 || Math.max(start, end) > to + 0.01) continue
        const { kind: _kind, ...options } = op
        layout.page.drawLine({ ...options, start: { x: op.start.x, y: mapY(start) }, end: { x: op.end.x, y: mapY(end) } })
      }
    }
    layout.y -= to - from
  }

  safeCut(row, from, maximum) {
    let cut = Math.min(row.height, from + maximum)
    const textBounds = row.operations.filter((op) => op.kind === 'text').map((op) => this.textBounds(row, op))
    let changed = true
    while (changed) {
      changed = false
      for (const bounds of textBounds) {
        if (bounds.top < cut && bounds.bottom > cut) {
          cut = bounds.top - 0.001
          changed = true
        }
      }
    }
    if (cut <= from) throw new Error('พื้นที่หน้า PDF ไม่พอสำหรับข้อความหนึ่งบรรทัด')
    return cut
  }

  finish(finalY) {
    this.flush(finalY)
    const { layout } = this
    layout.page = this.page
    layout.templateRecording = false
    layout.y = this.startY + 18
    const pageHeight = layout.pageSize[1] - layout.margin.top - this.bottom
    const remaining = () => layout.y - this.bottom
    for (const section of this.sections.filter((item) => item.rows.length)) {
      const headers = section.rows.filter((row) => row.header)
      const rows = section.rows.filter((row) => !row.header)
      if (!rows.length) continue
      const headerHeight = headers.reduce((sum, row) => sum + row.height, 0)
      const capacity = pageHeight - headerHeight
      const total = section.rows.reduce((sum, row) => sum + row.height, 0)
      const firstHeight = rows[0].height + (rows[0].keepWithNext ? rows[1]?.height ?? 0 : 0)
      if ((total <= pageHeight && total > remaining()) || headerHeight + Math.min(firstHeight, capacity) > remaining()) layout.addPage()
      const drawHeaders = () => headers.forEach((row) => this.drawSlice(row))
      const nextPage = () => { layout.addPage(); drawHeaders() }
      drawHeaders()
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index]
        const required = row.height + (row.keepWithNext ? rows[index + 1]?.height ?? 0 : 0)
        if (Math.min(required, capacity) > remaining() && !(row.height > capacity && rows[index - 1]?.keepWithNext)) nextPage()
        if (row.height <= capacity) {
          this.drawSlice(row)
          continue
        }
        let from = 0
        while (from < row.height) {
          const to = this.safeCut(row, from, remaining())
          this.drawSlice(row, from, to)
          from = to
          if (from < row.height) nextPage()
        }
      }
    }
  }
}
