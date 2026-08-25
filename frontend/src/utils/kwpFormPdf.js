import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, PageSizes, rgb } from 'pdf-lib'
import sarabunBoldUrl from '../assets/fonts/THSarabunNew-Bold.ttf?url'
import sarabunRegularUrl from '../assets/fonts/THSarabunNew.ttf?url'

const colors = {
  black: rgb(0, 0, 0),
  white: rgb(1, 1, 1),
  border: rgb(0.08, 0.08, 0.08),
  headerFill: rgb(0.9, 0.94, 1),
  muted: rgb(0.35, 0.38, 0.44),
}

const textSizes = {
  body: 16,
  title: 20,
  subtitle: 18,
  section: 17,
  table: 12,
  small: 11,
  signature: 15,
}

function displayValue(value, fallback = '-') {
  if (value === null || value === undefined) return fallback
  const text = String(value).trim()
  if (!text || ['null', 'none', 'ไม่มี', 'ไม่ระบุ'].includes(text.toLowerCase())) return fallback
  return text
}

function joinList(values, fallback = '-') {
  if (typeof values === 'string') return displayValue(values, fallback)
  const list = Array.isArray(values) ? values.map((item) => displayValue(item, '')).filter(Boolean) : []
  return list.length ? list.join(', ') : fallback
}

function formatDate(value) {
  return displayValue(value, '')
}

function getRequestNo(data) {
  return displayValue(
    data?.requestNo
      ?? data?.requestNumber
      ?? data?.requestCode
      ?? data?.submission?.requestNo
      ?? data?.submission?.requestNumber,
    '',
  )
}

async function fetchFontBytes(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`โหลดฟอนต์สำหรับ PDF ไม่สำเร็จ (${response.status})`)
  }
  return response.arrayBuffer()
}

function normalizeKwpDocumentUrl(url) {
  if (!url) {
    return ''
  }

  if (/^(blob:|data:|https?:\/\/)/i.test(url)) {
    return url
  }

  return `https://d-poms.diw.go.th${String(url).startsWith('/') ? url : `/${url}`}`
}

function getKwpDocumentFileName(document = {}) {
  return document.fileName ?? document.originalFileName ?? document.name ?? document.storedFileName ?? ''
}

function getKwpDocumentFileUrl(document = {}) {
  return normalizeKwpDocumentUrl(
    document.filePreviewUrl ?? document.fileUrl ?? document.url ?? document.storageUrl ?? document.path,
  )
}

function isKwpImageDocument(document = {}) {
  const type = document.fileType ?? document.mimeType ?? document.type ?? ''
  const name = getKwpDocumentFileName(document)
  const url = getKwpDocumentFileUrl(document)

  return type.startsWith('image/') || /\.(png|jpe?g)(\?.*)?$/i.test(`${name} ${url}`)
}

async function getKwpImageBytes(document = {}) {
  if (typeof File !== 'undefined' && document.rawFile instanceof File) {
    return document.rawFile.arrayBuffer()
  }

  const url = getKwpDocumentFileUrl(document)
  if (!url) {
    return null
  }

  const response = await fetch(url)
  if (!response.ok) {
    return null
  }

  return response.arrayBuffer()
}

async function embedKwpImage(layout, document = {}) {
  if (!isKwpImageDocument(document)) {
    return null
  }

  const bytes = await getKwpImageBytes(document)
  if (!bytes) {
    return null
  }

  const name = getKwpDocumentFileName(document)
  const type = document.fileType ?? document.mimeType ?? document.type ?? ''

  try {
    if (type.includes('png') || /\.png(\?.*)?$/i.test(name)) {
      return await layout.pdfDoc.embedPng(bytes)
    }
    return await layout.pdfDoc.embedJpg(bytes)
  } catch {
    return null
  }
}

function splitTextToTokens(text) {
  return String(text ?? '').split(/(\s+)/).filter((token) => token.length > 0)
}

function trimLineEnd(value) {
  return String(value).replace(/\s+$/u, '')
}

class KwpPdfLayout {
  constructor(pdfDoc, fonts) {
    this.pdfDoc = pdfDoc
    this.fonts = fonts
    this.pageSize = PageSizes.A4
    this.margin = { top: 46, right: 46, bottom: 50, left: 46 }
    this.page = null
    this.y = 0
    this.addPage()
  }

  addPage() {
    this.page = this.pdfDoc.addPage(this.pageSize)
    this.y = this.pageSize[1] - this.margin.top
  }

  get width() {
    return this.pageSize[0]
  }

  get contentWidth() {
    return this.width - this.margin.left - this.margin.right
  }

  ensureSpace(height) {
    if (this.y - height < this.margin.bottom) {
      this.addPage()
    }
  }

  textWidth(text, size = textSizes.body, bold = false) {
    return (bold ? this.fonts.bold : this.fonts.regular).widthOfTextAtSize(String(text ?? ''), size)
  }

  wrapText(text, maxWidth, size = textSizes.body, bold = false) {
    const lines = []
    let currentLine = ''
    const tokens = splitTextToTokens(text)

    tokens.forEach((token) => {
      const nextLine = `${currentLine}${token}`
      if (this.textWidth(nextLine, size, bold) <= maxWidth) {
        currentLine = nextLine
        return
      }

      if (currentLine) {
        lines.push(trimLineEnd(currentLine))
      }

      if (this.textWidth(token, size, bold) <= maxWidth) {
        currentLine = token.trimStart()
        return
      }

      let brokenLine = ''
      Array.from(token).forEach((char) => {
        const nextBrokenLine = `${brokenLine}${char}`
        if (!brokenLine || this.textWidth(nextBrokenLine, size, bold) <= maxWidth) {
          brokenLine = nextBrokenLine
          return
        }
        lines.push(brokenLine)
        brokenLine = char
      })
      currentLine = brokenLine
    })

    if (currentLine) {
      lines.push(trimLineEnd(currentLine))
    }

    return lines.length ? lines : ['']
  }

  drawTextAt(text, x, y, options = {}) {
    const size = options.size ?? textSizes.body
    const bold = options.bold ?? false
    const maxWidth = options.maxWidth
    const lineHeight = options.lineHeight ?? size * 1.38
    const lines = maxWidth ? this.wrapText(text, maxWidth, size, bold) : [String(text ?? '')]

    lines.forEach((line, index) => {
      this.page.drawText(line, {
        x,
        y: y - (index * lineHeight),
        size,
        font: bold ? this.fonts.bold : this.fonts.regular,
        color: options.color ?? colors.black,
      })
    })

    return lines.length * lineHeight
  }

  drawCentered(text, options = {}) {
    const size = options.size ?? textSizes.title
    const y = options.y ?? this.y
    const width = this.textWidth(text, size, options.bold ?? true)
    this.drawTextAt(text, (this.width - width) / 2, y, { size, bold: options.bold ?? true })
  }

  space(height = 8) {
    this.ensureSpace(height)
    this.y -= height
  }

  header(formNo, titleLines = []) {
    const requestNo = getRequestNo(this.data)
    if (requestNo) {
      this.drawTextAt(`เลขที่คำขอ ${requestNo}`, this.margin.left, this.y, {
        size: textSizes.body,
        bold: true,
      })
    }
    this.drawTextAt(`แบบ ${formNo}`, this.width - this.margin.right - this.textWidth(`แบบ ${formNo}`, textSizes.section, true), this.y, {
      size: textSizes.section,
      bold: true,
    })
    this.y -= 28
    titleLines.forEach((line) => {
      this.drawCentered(line, { size: textSizes.subtitle, bold: true, y: this.y })
      this.y -= 24
    })
    this.space(8)
  }

  sectionTitle(text) {
    this.space(6)
    this.drawTextAt(text, this.margin.left, this.y, { size: textSizes.section, bold: true })
    this.y -= 22
  }

  paragraph(text, options = {}) {
    const size = options.size ?? textSizes.body
    const indent = options.indent ?? 0
    const x = this.margin.left + indent
    const maxWidth = this.contentWidth - indent
    const lines = this.wrapText(text, maxWidth, size, options.bold)
    const lineHeight = options.lineHeight ?? size * 1.45
    this.ensureSpace(lines.length * lineHeight + 4)
    lines.forEach((line, index) => {
      this.drawTextAt(line, x, this.y - (index * lineHeight), { size, bold: options.bold })
    })
    this.y -= lines.length * lineHeight
  }

  drawDottedLine(x1, x2, y) {
    if (x2 - x1 <= 8) return
    this.page.drawLine({
      start: { x: x1, y },
      end: { x: x2, y },
      thickness: 0.6,
      color: colors.muted,
      dashArray: [1.4, 2.4],
    })
  }

  labelValue(label, value, options = {}) {
    const size = options.size ?? textSizes.body
    const indent = options.indent ?? 0
    const x = this.margin.left + indent
    const y = this.y
    const labelText = `${label} : `
    const labelWidth = this.textWidth(labelText, size, options.boldLabel ?? false)
    const endX = options.endX ?? (this.width - this.margin.right)
    const valueX = x + labelWidth + 3
    const maxValueWidth = Math.max(50, endX - valueX)
    const valueText = displayValue(value)
    const lines = this.wrapText(valueText, maxValueWidth, size)
    const lineHeight = size * 1.45
    const height = Math.max(lineHeight, lines.length * lineHeight)
    this.ensureSpace(height + 2)
    this.drawTextAt(labelText, x, y, { size, bold: options.boldLabel })
    lines.forEach((line, index) => {
      const lineY = y - (index * lineHeight)
      this.drawDottedLine(valueX, endX, lineY - 2)
      this.drawTextAt(line, valueX + 2, lineY, { size, maxWidth: maxValueWidth - 4 })
    })
    this.y -= height
  }

  twoColumn(left, right, options = {}) {
    const gutter = options.gutter ?? 18
    const leftWidth = options.leftWidth ?? ((this.contentWidth - gutter) / 2)
    const rightX = this.margin.left + leftWidth + gutter
    const endY = this.y
    const originalY = this.y
    this.labelValue(left.label, left.value, { ...options, endX: this.margin.left + leftWidth })
    const leftEndY = this.y
    this.y = originalY
    this.labelValue(right.label, right.value, { ...options, indent: rightX - this.margin.left, endX: this.width - this.margin.right })
    this.y = Math.min(leftEndY, this.y)
    if (this.y === endY) this.y -= textSizes.body * 1.45
  }

  checkbox(label, checked, x, y, options = {}) {
    const size = options.boxSize ?? 9
    this.page.drawRectangle({
      x,
      y: y - size + 2,
      width: size,
      height: size,
      borderColor: colors.border,
      borderWidth: 0.8,
    })
    if (checked) {
      this.drawTextAt('/', x + 2, y - size + 3, { size: textSizes.body, bold: true })
    }
    this.drawTextAt(label, x + size + 5, y, { size: options.size ?? textSizes.body })
  }

  table(columns, rows, options = {}) {
    const x = this.margin.left
    const width = this.contentWidth
    const headerHeight = options.headerHeight ?? 42
    const rowHeight = options.rowHeight ?? 30
    const fontSize = options.fontSize ?? textSizes.table
    const colWidths = columns.map((column) => column.width)
    const totalWidth = colWidths.reduce((sum, item) => sum + item, 0)
    const normalizedWidths = colWidths.map((item) => (item / totalWidth) * width)

    const drawRow = (cells, y, height, isHeader = false) => {
      let currentX = x
      cells.forEach((cell, index) => {
        const cellWidth = normalizedWidths[index]
        this.page.drawRectangle({
          x: currentX,
          y: y - height,
          width: cellWidth,
          height,
          color: isHeader ? colors.headerFill : colors.white,
          borderColor: colors.border,
          borderWidth: 0.7,
        })
        const text = cell?.text ?? cell ?? ''
        const bold = isHeader || cell?.bold
        const lines = this.wrapText(text, Math.max(10, cellWidth - 8), fontSize, bold)
        const lineHeight = fontSize * 1.25
        const textHeight = lines.length * lineHeight
        const startY = y - ((height - textHeight) / 2) - fontSize
        lines.forEach((line, lineIndex) => {
          const lineWidth = this.textWidth(line, fontSize, bold)
          const textX = currentX + Math.max(4, (cellWidth - lineWidth) / 2)
          this.drawTextAt(line, textX, startY - (lineIndex * lineHeight), { size: fontSize, bold })
        })
        currentX += cellWidth
      })
    }

    const headerCells = columns.map((column) => column.label)
    this.ensureSpace(headerHeight + rowHeight)
    drawRow(headerCells, this.y, headerHeight, true)
    this.y -= headerHeight

    rows.forEach((row) => {
      this.ensureSpace(rowHeight)
      drawRow(row, this.y, rowHeight, false)
      this.y -= rowHeight
    })
  }

  signature(label = 'ผู้จัดทำรายงาน', data = {}) {
    this.ensureSpace(128)
    const width = 250
    const x = this.width - this.margin.right - width
    const rowGap = 25
    let y = this.y - 20
    this.drawTextAt(`${label} `, x, y, { size: textSizes.signature })
    this.drawDottedLine(x + 100, x + width, y - 2)
    y -= rowGap
    this.drawTextAt('( ', x + 32, y, { size: textSizes.signature })
    this.drawDottedLine(x + 48, x + width - 18, y - 2)
    const name = displayValue(data.reporterName, '')
    if (name) {
      const nameWidth = this.textWidth(name, textSizes.signature)
      this.drawTextAt(name, x + 48 + ((width - 66 - nameWidth) / 2), y, { size: textSizes.signature })
    }
    this.drawTextAt(' )', x + width - 15, y, { size: textSizes.signature })
    y -= rowGap
    this.drawTextAt('ตำแหน่ง ', x, y, { size: textSizes.signature })
    this.drawDottedLine(x + 54, x + width, y - 2)
    const position = displayValue(data.reporterPosition, '')
    if (position) {
      const positionWidth = this.textWidth(position, textSizes.signature)
      this.drawTextAt(position, x + 54 + ((width - 54 - positionWidth) / 2), y, { size: textSizes.signature })
    }
    y -= rowGap
    this.drawTextAt('วันที่ ', x, y, { size: textSizes.signature })
    this.drawDottedLine(x + 38, x + width, y - 2)
    this.y = y - 20
  }
}

function commonFactorySections(layout, data, pointLabel = 'ข้อมูลปล่อง') {
  layout.sectionTitle('1. รายละเอียดเกี่ยวกับโรงงาน')
  layout.labelValue('ชื่อโรงงาน', data.factoryName ?? data.companyName)
  layout.twoColumn(
    { label: 'เลขทะเบียนโรงงาน', value: data.factoryRegistration },
    { label: 'ลำดับประเภทโรงงาน', value: data.industryType },
  )
  layout.labelValue('สถานที่ตั้งโรงงาน', data.factoryAddress)
  layout.labelValue('รายชื่อผู้ติดต่อ', data.contactName)
  layout.twoColumn(
    { label: 'เบอร์โทรศัพท์', value: data.contactPhone },
    { label: 'อีเมล', value: data.contactEmail },
  )

  layout.sectionTitle(`2. ${pointLabel}`)
  layout.twoColumn(
    { label: 'รหัสจุดตรวจวัด', value: data.pointCode },
    { label: 'ชื่อจุดตรวจวัด', value: data.pointName },
  )
  layout.labelValue('ปล่องจากกระบวนการผลิต', data.productionStack)
  layout.twoColumn(
    { label: 'เชื้อเพลิงหลัก', value: data.primaryFuel },
    { label: 'เชื้อเพลิงรอง', value: data.secondaryFuel },
  )
  layout.twoColumn(
    { label: 'กำลังการผลิตของหน่วยการผลิต', value: data.productionCapacity },
    { label: 'หน่วยของกำลังการผลิต', value: data.productionCapacityUnit },
  )
}

function drawKwp01(layout, data) {
  const x = layout.margin.left
  const width = layout.contentWidth
  const right = x + width
  const labelSize = 13
  const titleSize = 16
  const rowLine = 0.35
  const grey = rgb(0.74, 0.74, 0.74)
  let y = layout.y

  const drawLine = (x1, y1, x2, y2, thickness = rowLine) => {
    layout.page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness,
      color: colors.border,
    })
  }
  const drawRow = (height, { fill = null, verticals = [] } = {}) => {
    layout.page.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      ...(fill ? { color: fill } : {}),
      borderColor: colors.border,
      borderWidth: rowLine,
    })
    verticals.forEach((vx) => drawLine(vx, y, vx, y - height))
    y -= height
    return y + height
  }
  const drawCellText = (text, tx, ty, maxWidth, options = {}) => {
    layout.drawTextAt(text, tx, ty, {
      size: options.size ?? labelSize,
      bold: options.bold ?? false,
      maxWidth,
      lineHeight: (options.size ?? labelSize) * 1.22,
    })
  }
  const drawDottedValue = (label, value, tx, ty, endX, options = {}) => {
    const labelText = `${label} : `
    const size = options.size ?? labelSize
    const labelWidth = layout.textWidth(labelText, size, options.boldLabel ?? false)
    const valueX = tx + labelWidth + 2
    drawCellText(labelText, tx, ty, Math.max(20, endX - tx), { size, bold: options.boldLabel })
    drawCellText(displayValue(value, ''), valueX + 2, ty, Math.max(20, endX - valueX - 8), { size })
  }
  const drawBox = (tx, ty, checked) => {
    layout.page.drawRectangle({
      x: tx,
      y: ty - 2,
      width: 10,
      height: 10,
      borderColor: colors.border,
      borderWidth: 0.8,
    })
    if (checked) {
      const boxY = ty - 2
      layout.page.drawLine({
        start: { x: tx + 2, y: boxY + 4 },
        end: { x: tx + 4, y: boxY + 1 },
        thickness: 1,
        color: colors.border,
      })
      layout.page.drawLine({
        start: { x: tx + 4, y: boxY + 1 },
        end: { x: tx + 8, y: boxY + 8 },
        thickness: 1,
        color: colors.border,
      })
    }
  }
  const wrapTwoLineDottedValue = (value, firstLineWidth, secondLineWidth) => {
    const text = displayValue(value, '')
    if (!text) return []
    const firstLine = layout.wrapText(text, firstLineWidth, labelSize)[0] ?? ''
    const remainingText = text.slice(firstLine.length).trimStart()
    const secondLine = remainingText ? (layout.wrapText(remainingText, secondLineWidth, labelSize)[0] ?? '') : ''
    return [firstLine, secondLine].filter(Boolean).slice(0, 2)
  }

  const formNo = 'แบบ กวภ.01'
  const requestNo = getRequestNo(data)
  if (requestNo) {
    drawCellText(`เลขที่คำขอ ${requestNo}`, x, y, 220, { size: labelSize, bold: true })
  }
  drawCellText(formNo, right - layout.textWidth(formNo, titleSize, true), y, 120, { size: titleSize, bold: true })
  y -= 36
  layout.drawCentered('แบบแจ้งเหตุขัดข้องของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ เพื่อรายงานมลพิษอากาศจากปล่องโรงงาน', {
    y,
    size: titleSize,
    bold: true,
  })
  y -= 24
  layout.drawCentered('หรือแจ้งหยุดหน่วยการผลิต', { y, size: titleSize, bold: true })
  y -= 24

  drawRow(20, { fill: grey })
  drawCellText('1.    รายละเอียดเกี่ยวกับโรงงาน  (1 แบบต่อ 1 ปล่อง)', x + 10, y + 8, width - 20, { bold: true })
  drawRow(20)
  drawDottedValue('วันที่', '', right - 160, y + 8, right)
  drawRow(20)
  drawDottedValue('ชื่อโรงงาน', data.factoryName, x + 8, y + 8, right)
  drawRow(20, { verticals: [x + width * 0.66] })
  drawDottedValue('ทะเบียนโรงงานเลขที่', data.factoryRegistration, x + 8, y + 8, x + width * 0.66)
  drawDottedValue('ลำดับประเภทโรงงาน', data.industryType, x + width * 0.66 + 8, y + 8, right)
  drawRow(20)
  drawDottedValue('สถานที่ตั้งโรงงาน', data.factoryAddress, x + 8, y + 8, right)
  drawRow(20)
  drawDottedValue('รายชื่อผู้ติดต่อ', data.contactName, x + 8, y + 8, right)
  drawRow(20, { verticals: [x + width * 0.66] })
  drawDottedValue('เบอร์โทรศัพท์', data.contactPhone, x + 8, y + 8, x + width * 0.66)
  drawDottedValue('e-mail', data.contactEmail, x + width * 0.66 + 8, y + 8, right)

  drawRow(20, { fill: grey })
  drawCellText('2.    ข้อมูลปล่อง', x + 10, y + 8, width - 20, { bold: true })
  drawRow(20, { verticals: [x + width * 0.66] })
  drawDottedValue('รหัสจุดตรวจวัด', data.pointCode, x + 8, y + 8, x + width * 0.66)
  drawDottedValue('ชื่อจุดตรวจวัด', data.pointName, x + width * 0.66 + 8, y + 8, right)
  drawRow(20)
  drawDottedValue('ปล่องจากกระบวนการผลิต', data.productionStack, x + 8, y + 8, right)
  drawRow(20, { verticals: [x + width * 0.66] })
  drawDottedValue('เชื้อเพลิงหลัก', data.primaryFuel, x + 8, y + 8, x + width * 0.66)
  drawDottedValue('เชื้อเพลิงสำรอง', data.secondaryFuel, x + width * 0.66 + 8, y + 8, right)
  drawRow(20)
  drawCellText('ระบบการเผาไหม้เชื้อเพลิง :', x + 8, y + 8, 155)
  drawBox(x + 132, y + 8, data.combustionSystem === 'ระบบปิด')
  drawCellText('ระบบปิด', x + 146, y + 8, 60)
  drawBox(x + 196, y + 8, data.combustionSystem === 'ระบบเปิด')
  drawCellText('ระบบเปิด', x + 210, y + 8, 60)
  drawRow(20, { verticals: [x + width * 0.66] })
  drawDottedValue('กำลังการผลิตของหน่วยการผลิต', data.productionCapacity, x + 8, y + 8, x + width * 0.66)
  drawDottedValue('หน่วยของกำลังการผลิต', data.productionCapacityUnit, x + width * 0.66 + 8, y + 8, right)

  drawRow(20, { fill: grey })
  drawCellText('3.    สาเหตุของการไม่สามารถรายงานผลการตรวจวัดได้', x + 10, y + 8, width - 20, { bold: true })
  drawRow(20)
  drawCellText('3.1 สาเหตุ', x + 8, y + 8, width - 16)
  const brokenTool = data.issueReason === 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง'
  const stoppedProduction = data.issueReason === 'หยุดหน่วยการผลิต'
  const drawReasonOption = ({ checked, label, value, optionY, labelWidth }) => {
    const boxX = x + 8
    const textX = x + 24
    const renderedLabelWidth = layout.textWidth(label, labelSize)
    const firstLineStartX = textX + renderedLabelWidth + 8
    const secondLineStartX = x + 8
    const lineEndX = right - 12
    const reasonText = displayValue(value, '')
    const firstLineWidth = Math.max(40, lineEndX - firstLineStartX - 4)
    const secondLineWidth = Math.max(40, lineEndX - secondLineStartX - 4)
    const reasonLines = wrapTwoLineDottedValue(reasonText, firstLineWidth, secondLineWidth)

    drawBox(boxX, optionY, checked)
    drawCellText(label, textX, optionY, labelWidth)
    layout.drawDottedLine(firstLineStartX, lineEndX, optionY - 4)
    layout.drawDottedLine(secondLineStartX, lineEndX, optionY - 21)
    if (reasonLines[0]) {
      drawCellText(reasonLines[0], firstLineStartX + 3, optionY, firstLineWidth)
    }
    if (reasonLines[1]) {
      drawCellText(reasonLines[1], secondLineStartX + 3, optionY - 17, secondLineWidth)
    }
  }
  const drawTwoLineDottedField = ({ label, value, rowHeight, firstLineY, secondLineY }) => {
    const textX = x + 8
    const labelText = `${label} :`
    const labelWidth = layout.textWidth(labelText, labelSize)
    const firstLineStartX = textX + labelWidth + 8
    const secondLineStartX = x + 8
    const lineEndX = right - 12
    const valueText = displayValue(value, '')
    const firstLineWidth = Math.max(40, lineEndX - firstLineStartX - 4)
    const secondLineWidth = Math.max(40, lineEndX - secondLineStartX - 4)
    const valueLines = wrapTwoLineDottedValue(valueText, firstLineWidth, secondLineWidth)

    drawRow(rowHeight)
    drawCellText(labelText, textX, y + firstLineY, labelWidth)
    layout.drawDottedLine(firstLineStartX, lineEndX, y + firstLineY - 4)
    layout.drawDottedLine(secondLineStartX, lineEndX, y + secondLineY - 4)
    if (valueLines[0]) {
      drawCellText(valueLines[0], firstLineStartX + 3, y + firstLineY, firstLineWidth)
    }
    if (valueLines[1]) {
      drawCellText(valueLines[1], secondLineStartX + 3, y + secondLineY, secondLineWidth)
    }
  }
  drawRow(82)
  drawReasonOption({
    checked: brokenTool,
    label: 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง เนื่องจาก :',
    value: brokenTool ? data.reasonDetail : '',
    optionY: y + 64,
    labelWidth: 300,
  })
  drawReasonOption({
    checked: stoppedProduction,
    label: 'หยุดหน่วยการผลิต เนื่องจาก :',
    value: stoppedProduction ? data.reasonDetail : '',
    optionY: y + 28,
    labelWidth: 190,
  })
  drawRow(20)
  drawDottedValue('3.2 วัน/เดือน/ปี ที่พบปัญหาหรือหยุดหน่วยการผลิต', data.problemDate, x + 8, y + 8, right)
  drawRow(56)
  drawDottedValue('3.3 วัน/เดือน/ปี ที่คาดว่าจะดำเนินการแล้วเสร็จ', data.expectedDoneDate, x + 8, y + 44, right)
  drawDottedValue('รวมระยะเวลาปรับปรุงแก้ไขหรือระยะเวลาหยุดหน่วยการผลิต (วัน)', data.totalDays, x + 8, y + 26, x + width * 0.78)
  drawCellText('(หมายเหตุ : กรณีเครื่องมือหรืออุปกรณ์พิเศษมีเหตุขัดข้องและไม่สามารถรายงานผลการตรวจวัดได้ตั้งแต่ 15 วันขึ้นไป ต้องรายงานแบบ กวภ.02 ด้วย)', x + 8, y + 9, width - 16, { size: 11.4, bold: true })
  drawTwoLineDottedField({
    label: '3.4 รายการตรวจวัด (พารามิเตอร์) ที่ไม่สามารถรายงานผลได้',
    value: joinList(data.unreportedParameters, ''),
    rowHeight: 36,
    firstLineY: 23,
    secondLineY: 7,
  })
  drawTwoLineDottedField({
    label: '3.5 แนวทางการปรับปรุงแก้ไข (เฉพาะเครื่องมือหรืออุปกรณ์พิเศษขัดข้อง)',
    value: data.correctiveAction,
    rowHeight: 42,
    firstLineY: 27,
    secondLineY: 9,
  })

  const signatureBoxTop = y
  const signatureBoxBottom = Math.max(28, layout.margin.bottom - 20)
  const signatureBoxHeight = Math.max(90, signatureBoxTop - signatureBoxBottom)
  drawRow(signatureBoxHeight)
  const signCenterX = x + width * 0.5
  const signTopY = signatureBoxTop - 18
  const signLineWidth = 144
  const lineStartX = signCenterX - (signLineWidth / 2)
  const lineEndX = signCenterX + (signLineWidth / 2)
  const drawCenteredCellText = (text, centerX, ty, maxWidth, options = {}) => {
    const size = options.size ?? labelSize
    const bold = options.bold ?? false
    const textWidth = layout.textWidth(text, size, bold)
    drawCellText(text, centerX - (textWidth / 2), ty, maxWidth, { size, bold })
  }
  const drawSignatureLine = (lineY, startX = lineStartX, endX = lineEndX) => {
    layout.page.drawLine({
      start: { x: startX, y: lineY },
      end: { x: endX, y: lineY },
      thickness: rowLine,
      color: colors.border,
      dashArray: [1.2, 2.1],
    })
  }

  drawCenteredCellText('ข้าพเจ้าขอรับรองว่าข้อมูลข้างต้นเป็นจริงทุกประการ', signCenterX, signTopY, 280)
  drawSignatureLine(signTopY - 29)
  drawCellText('(ลงชื่อ)', lineEndX + 8, signTopY - 25, 60)

  const parenthesisY = signTopY - 49
  drawCellText('(', lineStartX - 18, parenthesisY, 10)
  drawSignatureLine(parenthesisY - 4, lineStartX, lineEndX)
  const reporterName = displayValue(data.reporterName, '')
  if (reporterName) {
    const nameWidth = layout.textWidth(reporterName, labelSize)
    drawCellText(reporterName, signCenterX - (nameWidth / 2), parenthesisY, lineEndX - lineStartX)
  }
  drawCellText(')', lineEndX + 14, parenthesisY, 10)

  const positionY = signTopY - 70
  const positionLabel = 'ตำแหน่ง'
  drawCellText(positionLabel, lineStartX - 40, positionY, 38)
  drawSignatureLine(positionY - 4, lineStartX, lineEndX)
  const reporterPosition = displayValue(data.reporterPosition, '')
  if (reporterPosition) {
    const positionWidth = layout.textWidth(reporterPosition, labelSize)
    const positionLineStartX = lineStartX
    drawCellText(reporterPosition, positionLineStartX + ((lineEndX - positionLineStartX - positionWidth) / 2), positionY, lineEndX - positionLineStartX)
  }
  drawCenteredCellText('ผู้ประกอบกิจการโรงงานหรือผู้รับมอบอำนาจ', signCenterX, signTopY - 91, 240)
  drawCenteredCellText('ผู้จัดทำรายงาน', signCenterX, signTopY - 108, 120)
  layout.y = y
}

function drawGenericKwp02(layout, data) {
  layout.header('กวภ.04', ['แบบรายงานผลการตรวจวัดมลพิษอากาศจากปล่องระบาย ตามประกาศฯ', 'ข้อ 4(1) (2) 11(3) และ 16'])
  commonFactorySections(layout, data)
  layout.sectionTitle('3. รายการตรวจวัดมลพิษอากาศจากปล่องระบาย')
  const rows = (data.measurementRows?.length ? data.measurementRows : [{}]).map((row) => [
    displayValue(row.pollutant),
    formatDate(row.sampleDate),
    displayValue(row.measuredValue),
    displayValue(row.unit),
    displayValue(row.laboratoryNo),
    displayValue(row.reportNo),
    displayValue(row.methodOther || row.method),
  ])
  layout.table(
    [
      { label: 'สารมลพิษ', width: 1.2 },
      { label: 'วันที่เก็บตัวอย่าง', width: 1 },
      { label: 'ค่าที่ตรวจวัดได้', width: 1 },
      { label: 'หน่วยการตรวจวัด', width: 1 },
      { label: 'เลขที่ห้องปฏิบัติการ', width: 1.1 },
      { label: 'เลขที่รายงาน', width: 1.1 },
      { label: 'วิธีการตรวจวัดวิเคราะห์', width: 1.8 },
    ],
    rows,
    { headerHeight: 48, rowHeight: 42 },
  )
  layout.paragraph('หมายเหตุ : การเก็บและวิเคราะห์ตัวอย่างต้องดำเนินการโดยห้องปฏิบัติการวิเคราะห์ของหน่วยงานราชการ หรือห้องปฏิบัติการวิเคราะห์เอกชนที่ขึ้นทะเบียนกับกรมโรงงานอุตสาหกรรม', { size: textSizes.small })
  layout.signature('ผู้จัดทำรายงาน', data)
}

function getKwpPdfAttachmentSections(data = {}) {
  const sections = [...(data.attachmentSections ?? [])]

  if (data.formType === 'kwp05') {
    const calibrationRows = data.calibrationRows ?? []

    sections.push(
      {
        title: 'รายงานผล RATA',
        links: calibrationRows.map((row) => row.rataReportLink).filter(Boolean),
        files: calibrationRows.flatMap((row) => row.rataReportFiles ?? []),
      },
      {
        title: 'ภาพขณะสอบเทียบ',
        links: calibrationRows.map((row) => row.calibrationPhotoLink).filter(Boolean),
        files: calibrationRows.flatMap((row) => row.calibrationPhotoFiles ?? []),
      },
    )
  }

  return sections
    .map((section) => ({
      title: section.title || 'เอกสารแนบ',
      links: (section.links ?? (section.link ? [section.link] : [])).map(normalizeKwpDocumentUrl).filter(Boolean),
      files: section.files ?? [],
    }))
    .filter((section) => section.links.length || section.files.length)
}

function drawKwpAttachmentListItem(layout, index, text) {
  const size = textSizes.body
  const x = layout.margin.left + 30
  const label = `${index}) `
  const labelWidth = layout.textWidth(label, size)
  const valueX = x + labelWidth
  const maxWidth = layout.contentWidth - 30 - labelWidth
  const lines = layout.wrapText(text, maxWidth, size)
  const lineHeight = size * 1.35

  layout.ensureSpace(lines.length * lineHeight + 4)
  layout.drawTextAt(label, x, layout.y, { size })
  lines.forEach((line, lineIndex) => {
    layout.drawTextAt(line, valueX, layout.y - (lineIndex * lineHeight), { size, maxWidth })
  })
  layout.y -= lines.length * lineHeight
}

function drawKwpEmbeddedImage(layout, image) {
  const isLandscape = image.width >= image.height
  const maxWidth = isLandscape ? layout.contentWidth - 30 : (layout.contentWidth - 30) / 2
  let imageWidth = maxWidth
  let imageHeight = image.height * (imageWidth / image.width)
  const maxHeight = layout.pageSize[1] - layout.margin.top - layout.margin.bottom

  if (imageHeight > maxHeight) {
    const ratio = maxHeight / imageHeight
    imageWidth *= ratio
    imageHeight *= ratio
  }

  layout.ensureSpace(imageHeight + 16)
  layout.page.drawImage(image, {
    x: layout.margin.left + 30,
    y: layout.y - imageHeight,
    width: imageWidth,
    height: imageHeight,
  })
  layout.y -= imageHeight + 14
}

async function drawKwpAttachmentPages(layout, data, title) {
  const sections = getKwpPdfAttachmentSections(data)

  if (!sections.length) {
    return
  }

  layout.addPage()
  layout.sectionTitle(title)

  for (const section of sections) {
    layout.paragraph(section.title, { bold: true })

    const listItems = [
      ...section.links.map((link) => `Link: ${link}`),
      ...section.files
        .filter((file) => getKwpDocumentFileName(file) && !isKwpImageDocument(file))
        .map((file) => getKwpDocumentFileName(file)),
    ]

    listItems.forEach((item, index) => drawKwpAttachmentListItem(layout, index + 1, item))

    const imageDocuments = section.files.filter(isKwpImageDocument)
    for (const imageDocument of imageDocuments) {
      const image = await embedKwpImage(layout, imageDocument)
      if (image) {
        drawKwpEmbeddedImage(layout, image)
      }
    }

    layout.space(12)
  }
}

async function drawKwp02(layout, data) {
  const isKwp04 = data.formType === 'kwp04'
  if (isKwp04) {
    drawGenericKwp02(layout, data)
    await drawKwpAttachmentPages(layout, data, 'เอกสารแนบ แบบ กวภ.04')
    return
  }

  const x = layout.margin.left
  const width = layout.contentWidth
  const right = x + width
  const labelSize = 13
  const titleSize = 16
  const rowLine = 0.35
  const grey = rgb(0.74, 0.74, 0.74)
  let y = layout.y

  const drawLine = (x1, y1, x2, y2, thickness = rowLine) => {
    layout.page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness,
      color: colors.border,
    })
  }
  const drawRow = (height, { fill = null, verticals = [] } = {}) => {
    layout.page.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      ...(fill ? { color: fill } : {}),
      borderColor: colors.border,
      borderWidth: rowLine,
    })
    verticals.forEach((vx) => drawLine(vx, y, vx, y - height))
    y -= height
    return y + height
  }
  const drawCellText = (text, tx, ty, maxWidth, options = {}) => {
    layout.drawTextAt(text, tx, ty, {
      size: options.size ?? labelSize,
      bold: options.bold ?? false,
      maxWidth,
      lineHeight: (options.size ?? labelSize) * 1.22,
    })
  }
  const drawDottedValue = (label, value, tx, ty, endX, options = {}) => {
    const labelText = `${label} : `
    const size = options.size ?? labelSize
    const labelWidth = layout.textWidth(labelText, size, options.boldLabel ?? false)
    const valueX = tx + labelWidth + 2
    drawCellText(labelText, tx, ty, Math.max(20, endX - tx), { size, bold: options.boldLabel })
    drawCellText(displayValue(value, ''), valueX + 2, ty, Math.max(20, endX - valueX - 8), { size })
  }
  const drawBox = (tx, ty, checked) => {
    layout.page.drawRectangle({
      x: tx,
      y: ty - 2,
      width: 10,
      height: 10,
      borderColor: colors.border,
      borderWidth: 0.8,
    })
    if (checked) {
      const boxY = ty - 2
      layout.page.drawLine({
        start: { x: tx + 2, y: boxY + 4 },
        end: { x: tx + 4, y: boxY + 1 },
        thickness: 1,
        color: colors.border,
      })
      layout.page.drawLine({
        start: { x: tx + 4, y: boxY + 1 },
        end: { x: tx + 8, y: boxY + 8 },
        thickness: 1,
        color: colors.border,
      })
    }
  }
  const drawCenteredCellText = (text, centerX, ty, maxWidth, options = {}) => {
    const size = options.size ?? labelSize
    const bold = options.bold ?? false
    const textWidth = layout.textWidth(text, size, bold)
    drawCellText(text, centerX - (textWidth / 2), ty, maxWidth, { size, bold })
  }

  const requestNo = getRequestNo(data)
  if (requestNo) {
    drawCellText(`เลขที่คำขอ ${requestNo}`, x, y, 220, { size: labelSize, bold: true })
  }
  const formNo = 'แบบ กวภ.02'
  drawCellText(formNo, right - layout.textWidth(formNo, titleSize, true), y, 120, { size: titleSize, bold: true })
  y -= 36
  layout.drawCentered('แบบรายงานผลการตรวจวัดมลพิษอากาศจากปล่องระบาย กรณีเครื่องมือหรือเครื่องอุปกรณ์พิเศษ', {
    y,
    size: titleSize,
    bold: true,
  })
  y -= 24
  layout.drawCentered('มีเหตุขัดข้องและไม่สามารถรายงานผลการตรวจวัดได้ตั้งแต่ 15 วันขึ้นไป', { y, size: titleSize, bold: true })
  y -= 24

  drawRow(20, { fill: grey })
  drawCellText('1.    รายละเอียดเกี่ยวกับโรงงาน  (1 แบบต่อ 1 ปล่องต่อ 1 ครั้ง)', x + 10, y + 8, width - 210, { bold: true })
  drawDottedValue('รายงานครั้งที่', data.reportRound, right - 188, y + 8, right)
  drawRow(20)
  drawDottedValue('วันที่', '', right - 160, y + 8, right)
  drawRow(20)
  drawDottedValue('ชื่อโรงงาน', data.factoryName, x + 8, y + 8, right)
  drawRow(20, { verticals: [x + width * 0.66] })
  drawDottedValue('ทะเบียนโรงงานเลขที่', data.factoryRegistration, x + 8, y + 8, x + width * 0.66)
  drawDottedValue('ลำดับประเภทโรงงาน', data.industryType, x + width * 0.66 + 8, y + 8, right)
  drawRow(20)
  drawDottedValue('สถานที่ตั้งโรงงาน', data.factoryAddress, x + 8, y + 8, right)
  drawRow(20)
  drawDottedValue('รายชื่อผู้ติดต่อ', data.contactName, x + 8, y + 8, right)
  drawRow(20, { verticals: [x + width * 0.66] })
  drawDottedValue('เบอร์โทรศัพท์', data.contactPhone, x + 8, y + 8, x + width * 0.66)
  drawDottedValue('e-mail', data.contactEmail, x + width * 0.66 + 8, y + 8, right)

  drawRow(20, { fill: grey })
  drawCellText('2.    ข้อมูลปล่อง', x + 10, y + 8, width - 20, { bold: true })
  drawRow(20, { verticals: [x + width * 0.66] })
  drawDottedValue('รหัสจุดตรวจวัด', data.pointCode, x + 8, y + 8, x + width * 0.66)
  drawDottedValue('ชื่อจุดตรวจวัด', data.pointName, x + width * 0.66 + 8, y + 8, right)
  drawRow(20)
  drawDottedValue('ปล่องจากกระบวนการผลิต', data.productionStack, x + 8, y + 8, right)
  drawRow(20, { verticals: [x + width * 0.66] })
  drawDottedValue('เชื้อเพลิงหลัก', data.primaryFuel, x + 8, y + 8, x + width * 0.66)
  drawDottedValue('เชื้อเพลิงสำรอง', data.secondaryFuel, x + width * 0.66 + 8, y + 8, right)
  drawRow(20)
  drawCellText('ระบบการเผาไหม้เชื้อเพลิง :', x + 8, y + 8, 155)
  drawBox(x + 132, y + 8, data.combustionSystem === 'ระบบปิด')
  drawCellText('ระบบปิด', x + 146, y + 8, 60)
  drawBox(x + 196, y + 8, data.combustionSystem === 'ระบบเปิด')
  drawCellText('ระบบเปิด', x + 210, y + 8, 60)
  drawRow(20, { verticals: [x + width * 0.66] })
  drawDottedValue('กำลังการผลิตของหน่วยการผลิต', data.productionCapacity, x + 8, y + 8, x + width * 0.66)
  drawDottedValue('หน่วยของกำลังการผลิต', data.productionCapacityUnit, x + width * 0.66 + 8, y + 8, right)

  drawRow(20, { fill: grey })
  drawCellText('3.    รายการตรวจวัดมลพิษอากาศจากปล่องระบาย', x + 10, y + 8, width - 20, { bold: true })

  const tableTop = y
  const headerHeight = 36
  const rowHeight = 20
  const rows = data.measurementRows?.length ? data.measurementRows : []
  const tableColumns = [
    { label: 'รายการ\nสารมลพิษ', width: 1.05 },
    { label: 'วันที่เก็บ\nตัวอย่าง', width: 1 },
    { label: 'ค่าที่\nตรวจวัดได้', width: 0.9 },
    { label: 'หน่วยการ\nตรวจวัด', width: 0.85 },
    { label: 'เลขที่\nห้องปฏิบัติการ', width: 1.05 },
    { label: 'เลขที่รายงาน', width: 1.05 },
    { label: 'วิธีการตรวจวัดวิเคราะห์', width: 1.9 },
  ]
  const totalColumnWeight = tableColumns.reduce((sum, column) => sum + column.width, 0)
  const colWidths = tableColumns.map((column) => (column.width / totalColumnWeight) * width)
  const tableHeight = headerHeight + (rows.length * rowHeight)

  layout.page.drawRectangle({
    x,
    y: tableTop - tableHeight,
    width,
    height: tableHeight,
    borderColor: colors.border,
    borderWidth: rowLine,
  })
  drawLine(x, tableTop - headerHeight, right, tableTop - headerHeight)
  let currentX = x
  tableColumns.forEach((column, index) => {
    const colWidth = colWidths[index]
    if (index > 0) drawLine(currentX, tableTop, currentX, tableTop - tableHeight)
    const headerLines = column.label.split('\n')
    const lineHeight = 13
    const firstY = tableTop - ((headerHeight - (headerLines.length * lineHeight)) / 2) - 9
    headerLines.forEach((line, lineIndex) => {
      drawCenteredCellText(line, currentX + (colWidth / 2), firstY - (lineIndex * lineHeight), colWidth - 6, { size: 13, bold: true })
    })
    currentX += colWidth
  })
  rows.forEach((row, rowIndex) => {
    const rowTop = tableTop - headerHeight - (rowIndex * rowHeight)
    if (rowIndex > 0) drawLine(x, rowTop, right, rowTop)
    const cells = [
      displayValue(row.pollutant, ''),
      formatDate(row.sampleDate),
      displayValue(row.measuredValue, ''),
      displayValue(row.unit, ''),
      displayValue(row.laboratoryNo, ''),
      displayValue(row.reportNo, ''),
      displayValue(row.methodOther || row.method, ''),
    ]
    let cellX = x
    cells.forEach((cell, cellIndex) => {
      const colWidth = colWidths[cellIndex]
      const cellLines = layout.wrapText(cell, colWidth - 8, 11.4)
      const lineHeight = 12
      const firstY = rowTop - ((rowHeight - (cellLines.length * lineHeight)) / 2) - 8
      cellLines.slice(0, 2).forEach((line, lineIndex) => {
        drawCenteredCellText(line, cellX + (colWidth / 2), firstY - (lineIndex * lineHeight), colWidth - 8, { size: 11.4 })
      })
      cellX += colWidth
    })
  })
  y = tableTop - tableHeight

  drawRow(24)
  drawCellText('หมายเหตุ : การเก็บและวิเคราะห์ตัวอย่างต้องดำเนินการโดยห้องปฏิบัติการวิเคราะห์ของหน่วยงานราชการ หรือห้องปฏิบัติการวิเคราะห์เอกชนที่ขึ้นทะเบียนกับกรมโรงงานอุตสาหกรรม', x + 8, y + 10, width - 16, { size: 9.8, bold: true })

  const signatureBoxTop = y
  const signatureBoxBottom = Math.max(28, layout.margin.bottom - 20)
  const signatureBoxHeight = Math.max(90, signatureBoxTop - signatureBoxBottom)
  drawRow(signatureBoxHeight)
  const signatureBoxBottomY = signatureBoxTop - signatureBoxHeight
  const signCenterX = x + width * 0.5
  const signTopY = signatureBoxBottomY + 126
  const signLineWidth = 144
  const lineStartX = signCenterX - (signLineWidth / 2)
  const lineEndX = signCenterX + (signLineWidth / 2)
  const drawSignatureLine = (lineY, startX = lineStartX, endX = lineEndX) => {
    layout.page.drawLine({
      start: { x: startX, y: lineY },
      end: { x: endX, y: lineY },
      thickness: rowLine,
      color: colors.border,
      dashArray: [1.2, 2.1],
    })
  }

  drawCenteredCellText('ข้าพเจ้าขอรับรองว่าข้อมูลข้างต้นเป็นจริงทุกประการ', signCenterX, signTopY, 280)
  drawSignatureLine(signTopY - 29)
  drawCellText('(ลงชื่อ)', lineEndX + 8, signTopY - 25, 60)
  const parenthesisY = signTopY - 49
  drawCellText('(', lineStartX - 18, parenthesisY, 10)
  drawSignatureLine(parenthesisY - 4)
  const reporterName = displayValue(data.reporterName, '')
  if (reporterName) {
    const nameWidth = layout.textWidth(reporterName, labelSize)
    drawCellText(reporterName, signCenterX - (nameWidth / 2), parenthesisY, lineEndX - lineStartX)
  }
  drawCellText(')', lineEndX + 14, parenthesisY, 10)
  const positionY = signTopY - 70
  drawCellText('ตำแหน่ง', lineStartX - 42, positionY, 40)
  drawSignatureLine(positionY - 4)
  const reporterPosition = displayValue(data.reporterPosition, '')
  if (reporterPosition) {
    const positionWidth = layout.textWidth(reporterPosition, labelSize)
    drawCellText(reporterPosition, lineStartX + ((lineEndX - lineStartX - positionWidth) / 2), positionY, lineEndX - lineStartX)
  }
  drawCenteredCellText('ผู้ประกอบกิจการโรงงานหรือผู้รับมอบอำนาจ', signCenterX, signTopY - 91, 240)
  drawCenteredCellText('ผู้จัดทำรายงาน', signCenterX, signTopY - 108, 120)
  layout.y = y

  await drawKwpAttachmentPages(layout, data, 'เอกสารแนบ แบบ กวภ.02')
}

function drawKwp03(layout, data) {
  layout.header('กวภ.03', [
    'แบบแจ้งเหตุขัดข้องหรือหยุดส่งข้อมูลการตรวจวัดมลพิษทางน้ำแบบอัตโนมัติอย่างต่อเนื่อง (WPMS)',
  ])
  commonFactorySections(layout, data, 'ข้อมูลจุดตรวจวัด')
  layout.labelValue('เครื่องตรวจวัด', joinList(data.instruments))
  layout.sectionTitle('3. ข้อมูลน้ำทิ้งระบายออกนอกโรงงาน')
  layout.twoColumn(
    { label: 'แหล่งกำเนิดน้ำเสีย', value: data.wastewaterSource },
    { label: 'แหล่งรองรับน้ำทิ้ง', value: data.receivingSource },
  )
  layout.twoColumn(
    { label: 'ประเภทระบบบำบัด', value: data.treatmentSystemType },
    { label: 'พิกัดจุดระบายน้ำทิ้ง', value: data.dischargePoint },
  )
  layout.labelValue('ปริมาณน้ำทิ้งระบายออกวันที่ขัดข้อง เฉลี่ย', data.averageDischarge)
  layout.twoColumn(
    { label: 'ต่ำสุด', value: data.minimumDischarge },
    { label: 'สูงสุด', value: data.maximumDischarge },
  )
  layout.sectionTitle('4. สาเหตุของการไม่สามารถรายงานผลการตรวจวัดได้')
  layout.labelValue('สาเหตุ', joinList(data.issueReasons))
  layout.labelValue('เนื่องจาก', data.reasonDetail)
  layout.labelValue('วัน/เดือน/ปี ที่พบปัญหาหรือหยุดหน่วยการผลิต', data.problemDate)
  layout.labelValue('วัน/เดือน/ปี ที่คาดว่าจะดำเนินการแล้วเสร็จ', data.expectedDoneDate)
  layout.labelValue('รวมระยะเวลาปรับปรุงแก้ไขหรือระยะเวลาหยุดหน่วยการผลิต', data.totalDays)
  layout.labelValue('รายการตรวจวัด (พารามิเตอร์) ที่ไม่สามารถรายงานผลได้', joinList(data.failedParameters))
  layout.labelValue('แนวทางการปรับปรุงแก้ไข', data.correctiveAction)
  layout.signature('ผู้จัดทำรายงาน/ผู้ดูแลระบบบำบัด', data)
}

function drawKwp05(layout, data) {
  layout.header('กวภ.05', [
    'แบบรายงานผลการสอบเทียบหรือทวนสอบระบบตรวจวัดคุณภาพอากาศ',
    'แบบอัตโนมัติอย่างต่อเนื่อง (CEMS)',
  ])
  layout.twoColumn(
    { label: 'ครั้งที่', value: data.reportRound },
    { label: 'ประจำปี พ.ศ.', value: data.reportYear },
    { leftWidth: 220 },
  )
  layout.sectionTitle('1. รายละเอียดเกี่ยวกับโรงงาน')
  layout.labelValue('ชื่อบริษัท', data.companyName)
  layout.twoColumn(
    { label: 'เลขทะเบียนโรงงาน', value: data.factoryRegistration },
    { label: 'ประกอบกิจการ', value: data.businessActivity },
  )
  layout.labelValue('สถานที่ตั้ง', data.factoryAddress)
  layout.twoColumn(
    { label: 'ผู้เก็บตัวอย่าง', value: data.samplerName },
    { label: 'ทะเบียนเจ้าหน้าที่', value: data.officerRegistration },
  )
  layout.labelValue('หน่วยงาน/ชื่อห้องปฏิบัติการ', data.laboratoryName)
  layout.labelValue('ทะเบียนห้องปฏิบัติการ', data.laboratoryRegistration)
  layout.twoColumn(
    { label: 'รหัสจุดตรวจวัด', value: data.pointCode },
    { label: 'ชื่อจุดตรวจวัด', value: data.pointName },
  )
  layout.labelValue('รายละเอียดของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ ยี่ห้อ (Brand)', data.cemsBrand || data.cemsDetail)
  layout.sectionTitle('2. รายการผลการสอบเทียบหรือทวนสอบ CEMS')
  const rows = (data.calibrationRows?.length ? data.calibrationRows : [{}]).map((row) => [
    joinList(row.parameter),
    formatDate(row.startDate),
    formatDate(row.endDate),
    displayValue(row.result),
    displayValue(row.verifierCompany || data.laboratoryName),
    displayValue(row.cemsModel),
    displayValue(row.rataReportLink || row.rataReportFiles?.[0]?.name),
    displayValue(row.calibrationPhotoLink || row.calibrationPhotoFiles?.[0]?.name),
  ])
  layout.table(
    [
      { label: 'พารามิเตอร์', width: 1.1 },
      { label: 'วันที่เริ่มดำเนินการ', width: 1 },
      { label: 'วันที่สิ้นสุดดำเนินการ', width: 1 },
      { label: 'ผลการตรวจสอบ', width: 1 },
      { label: 'บริษัทที่ทำการทวนสอบ / สอบเทียบ', width: 1.2 },
      { label: 'ยี่ห้อ/รุ่นของ CEMS', width: 1.1 },
      { label: 'Link / QR CODE', width: 1 },
      { label: 'Link / QR CODE', width: 1 },
    ],
    rows,
    { headerHeight: 58, rowHeight: 70, fontSize: textSizes.small },
  )
  layout.signature('ผู้รายงานผลการทดสอบ', data)
}

export async function createKwpFormPdf(data) {
  if (!data) {
    throw new Error('ไม่พบข้อมูลสำหรับสร้าง PDF')
  }

  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  const [regularFontBytes, boldFontBytes] = await Promise.all([
    fetchFontBytes(sarabunRegularUrl),
    fetchFontBytes(sarabunBoldUrl),
  ])
  const fonts = {
    regular: await pdfDoc.embedFont(regularFontBytes),
    bold: await pdfDoc.embedFont(boldFontBytes),
  }
  const layout = new KwpPdfLayout(pdfDoc, fonts)
  layout.data = data

  if (data.formType === 'kwp02' || data.formType === 'kwp04') {
    await drawKwp02(layout, data)
  } else if (data.formType === 'kwp03') {
    drawKwp03(layout, data)
    await drawKwpAttachmentPages(layout, data, 'เอกสารแนบ แบบ กวภ.03')
  } else if (data.formType === 'kwp05') {
    drawKwp05(layout, data)
    await drawKwpAttachmentPages(layout, data, 'เอกสารแนบ แบบ กวภ.05')
  } else {
    drawKwp01(layout, data)
    await drawKwpAttachmentPages(layout, data, 'เอกสารแนบ แบบ กวภ.01')
  }

  return pdfDoc.save()
}
