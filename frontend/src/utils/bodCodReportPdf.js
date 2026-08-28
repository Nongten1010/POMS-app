import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, PageSizes, rgb } from 'pdf-lib'
import sarabunBoldUrl from '../assets/fonts/THSarabunNew-Bold.ttf?url'
import sarabunRegularUrl from '../assets/fonts/THSarabunNew.ttf?url'

const colors = {
  black: rgb(0, 0, 0),
  border: rgb(0.08, 0.08, 0.08),
  headerFill: rgb(0.74, 0.74, 0.74),
  muted: rgb(0.35, 0.38, 0.44),
  white: rgb(1, 1, 1),
}

const textSizes = {
  body: 14,
  title: 17,
  section: 14,
  small: 12,
  table: 13,
}

const lineWidth = 0.35

function isBlankValue(value) {
  if (value === null || value === undefined) return true
  const text = String(value).trim()
  return !text || ['null', 'none', 'ไม่มี', 'ไม่ระบุ'].includes(text.toLowerCase())
}

function displayValue(value, fallback = '-') {
  return isBlankValue(value) ? fallback : String(value).trim()
}

function displayText(value, fallback = '') {
  return isBlankValue(value) ? fallback : String(value).trim()
}

function getRequestNo(data = {}) {
  return displayText(
    data.reportNo
      ?? data.requestNo
      ?? data.requestNumber
      ?? data.submission?.requestNo
      ?? data.submission?.requestNumber,
  )
}

function getSubmittedDate(data = {}) {
  return displayText(
    data.submittedDate
      ?? data.submittedAt
      ?? data.requestDate
      ?? data.requestedAt
      ?? data.createdAt,
  )
}

function normalizeDocumentUrl(url) {
  if (!url) return ''
  if (/^(blob:|data:|https?:\/\/)/i.test(url)) return url
  return `https://d-poms.diw.go.th${String(url).startsWith('/') ? url : `/${url}`}`
}

function getDocumentFileName(document = {}) {
  if (typeof File !== 'undefined' && document instanceof File) return document.name ?? ''

  return document.fileName
    ?? document.originalFileName
    ?? document.name
    ?? document.storedFileName
    ?? ''
}

function getDocumentUrl(document = {}) {
  return normalizeDocumentUrl(
    document.url
      ?? document.downloadUrl
      ?? document.fileUrl
      ?? document.publicUrl
      ?? document.signedUrl
      ?? document.storageUrl
      ?? document.storagePath
      ?? document.filePath
      ?? document.path
      ?? '',
  )
}

function isImageDocument(document = {}) {
  const type = document.type ?? document.fileType ?? document.mimeType ?? ''
  const name = getDocumentFileName(document)
  const url = getDocumentUrl(document)

  return type.startsWith('image/') || /\.(png|jpe?g|webp)(\?.*)?$/i.test(`${name} ${url}`)
}

async function getImageBytes(document = {}) {
  if (typeof File !== 'undefined' && document instanceof File) {
    return document.arrayBuffer()
  }

  if (typeof File !== 'undefined' && document.rawFile instanceof File) {
    return document.rawFile.arrayBuffer()
  }

  const url = getDocumentUrl(document)
  if (!url) return null

  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) return null

  return response.arrayBuffer()
}

async function embedImageDocument(layout, document = {}) {
  if (!isImageDocument(document)) return null

  const bytes = await getImageBytes(document)
  if (!bytes) return null

  const type = document.type ?? document.fileType ?? document.mimeType ?? ''
  const name = getDocumentFileName(document)
  const url = getDocumentUrl(document)
  const hint = `${type} ${name} ${url}`

  if (/image\/png|\.png(\?.*)?$/i.test(hint) || url.startsWith('data:image/png')) {
    return layout.pdfDoc.embedPng(bytes)
  }

  return layout.pdfDoc.embedJpg(bytes)
}

function getAttachmentFiles(report = {}) {
  const files = {
    samplePhotos: [],
    devicePhotos: [],
    labReports: [],
  }

  if (report.attachmentFiles) {
    files.samplePhotos = report.attachmentFiles.samplePhotos ?? []
    files.devicePhotos = report.attachmentFiles.devicePhotos ?? []
    files.labReports = report.attachmentFiles.labReports ?? []
    return files
  }

  if (!Array.isArray(report.attachments)) return files

  const fieldByType = {
    SAMPLE_PHOTO: 'samplePhotos',
    DEVICE_PHOTO: 'devicePhotos',
    LAB_REPORT: 'labReports',
  }

  report.attachments.forEach((attachment) => {
    const field = fieldByType[attachment.attachmentType]
    if (field) files[field].push(attachment)
  })

  return files
}

async function fetchFontBytes(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`โหลดฟอนต์สำหรับ PDF ไม่สำเร็จ (${response.status})`)
  }
  return response.arrayBuffer()
}

function splitTextToTokens(text) {
  return String(text ?? '').split(/(\s+)/).filter((token) => token.length > 0)
}

function trimLineEnd(value) {
  return String(value).replace(/\s+$/u, '')
}

class BodCodPdfLayout {
  constructor(pdfDoc, fonts) {
    this.pdfDoc = pdfDoc
    this.fonts = fonts
    this.pageSize = PageSizes.A4
    this.margin = { top: 42, right: 46, bottom: 42, left: 46 }
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

  get height() {
    return this.pageSize[1]
  }

  get contentWidth() {
    return this.width - this.margin.left - this.margin.right
  }

  textWidth(text, size = textSizes.body, bold = false) {
    return (bold ? this.fonts.bold : this.fonts.regular).widthOfTextAtSize(String(text ?? ''), size)
  }

  wrapText(text, maxWidth, size = textSizes.body, bold = false) {
    const lines = []
    let currentLine = ''

    splitTextToTokens(text).forEach((token) => {
      const nextLine = `${currentLine}${token}`
      if (this.textWidth(nextLine, size, bold) <= maxWidth) {
        currentLine = nextLine
        return
      }

      if (currentLine) lines.push(trimLineEnd(currentLine))

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

    if (currentLine) lines.push(trimLineEnd(currentLine))
    return lines.length ? lines : ['']
  }

  drawText(text, x, y, options = {}) {
    const size = options.size ?? textSizes.body
    const bold = options.bold ?? false
    const lines = options.maxWidth ? this.wrapText(text, options.maxWidth, size, bold) : [String(text ?? '')]
    const lineHeight = options.lineHeight ?? size * 1.25

    lines.forEach((line, index) => {
      this.page.drawText(line, {
        x,
        y: y - (index * lineHeight),
        size,
        font: bold ? this.fonts.bold : this.fonts.regular,
        color: colors.black,
      })
    })

    return lines.length * lineHeight
  }

  drawCentered(text, y, options = {}) {
    const size = options.size ?? textSizes.title
    const bold = options.bold ?? true
    const width = this.textWidth(text, size, bold)
    this.drawText(text, (this.width - width) / 2, y, { size, bold })
  }

  drawLine(x1, y1, x2, y2, thickness = lineWidth) {
    this.page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness,
      color: colors.border,
    })
  }

  drawDottedLine(x1, x2, y) {
    if (x2 <= x1) return
    this.page.drawLine({
      start: { x: x1, y },
      end: { x: x2, y },
      thickness: 0.45,
      color: colors.muted,
      dashArray: [1.3, 2.5],
    })
  }

  drawRect(x, y, width, height, options = {}) {
    this.page.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      color: options.fill ?? colors.white,
      borderColor: colors.border,
      borderWidth: options.borderWidth ?? lineWidth,
    })
  }

  ensureSpace(height) {
    if (this.y - height < this.margin.bottom) {
      this.addPage()
    }
  }

  paragraph(text, options = {}) {
    const size = options.size ?? textSizes.body
    const indent = options.indent ?? 0
    const x = this.margin.left + indent
    const maxWidth = this.contentWidth - indent
    const lines = this.wrapText(text, maxWidth, size, options.bold)
    const lineHeight = options.lineHeight ?? size * 1.35
    this.ensureSpace(lines.length * lineHeight + 4)
    lines.forEach((line, index) => {
      this.drawText(line, x, this.y - (index * lineHeight), { size, bold: options.bold })
    })
    this.y -= lines.length * lineHeight
  }

  sectionTitle(text) {
    this.ensureSpace(32)
    this.drawText(text, this.margin.left, this.y, { size: textSizes.title, bold: true })
    this.y -= 24
  }

  drawEmbeddedImage(image, options = {}) {
    const indent = options.indent ?? 30
    const maxWidth = options.maxWidth ?? this.contentWidth - indent
    const isLandscape = image.width >= image.height
    const targetMaxWidth = isLandscape ? maxWidth : maxWidth / 2
    const width = image.width * Math.min(targetMaxWidth / image.width, 1)
    const height = image.height * Math.min(targetMaxWidth / image.width, 1)

    this.ensureSpace(height + 8)
    this.page.drawImage(image, {
      x: this.margin.left + indent,
      y: this.y - height,
      width,
      height,
    })
    this.y -= height + 8
  }
}

function drawHeader(layout, report = {}) {
  const x = layout.margin.left
  const right = layout.width - layout.margin.right
  const requestNo = getRequestNo(report)
  const submittedDate = getSubmittedDate(report)

  if (requestNo) {
    layout.drawText(`เลขที่คำขอ ${requestNo}`, x, layout.y, { size: textSizes.body })
  }

  if (submittedDate) {
    const submittedDateText = `วันที่ยื่นคำขอ ${submittedDate}`
    layout.drawText(submittedDateText, right - layout.textWidth(submittedDateText, textSizes.body), layout.y, {
      size: textSizes.body,
    })
  }

  layout.y -= 38
  layout.drawCentered('แบบรายงานผลการตรวจสอบความคลาดเคลื่อนของเครื่องมือหรือเครื่องอุปกรณ์พิเศษ', layout.y, {
    size: textSizes.title,
    bold: true,
  })
  layout.y -= 24
  layout.drawCentered('และเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติม', layout.y, {
    size: textSizes.title,
    bold: true,
  })
  layout.y -= 24

  const roundText = `ครั้งที่ ${displayText(report.roundNo ?? String(report.reportRound ?? '').replace('ครั้งที่ ', ''), '........')}/ปี ${displayText(report.year ?? report.reportYear, '........')}`
  layout.drawCentered(roundText, layout.y, { size: textSizes.title, bold: true })
  layout.y -= 28
}

function drawValueLine(layout, label, value, x, y, endX, options = {}) {
  const size = options.size ?? textSizes.body
  const labelText = `${label} :`
  const labelWidth = layout.textWidth(labelText, size, options.boldLabel)
  const valueX = x + labelWidth + 5

  layout.drawText(labelText, x, y, { size, bold: options.boldLabel })
  layout.drawDottedLine(valueX, endX, y - 2)
  layout.drawText(displayText(value), valueX + 2, y, {
    size,
    maxWidth: Math.max(20, endX - valueX - 4),
    lineHeight: size * 1.18,
  })
}

function drawCheck(layout, x, y, checked) {
  const size = 10
  layout.page.drawRectangle({
    x,
    y: y - 2,
    width: size,
    height: size,
    borderColor: colors.border,
    borderWidth: 0.7,
  })

  if (!checked) return

  layout.drawLine(x + 2, y + 3, x + 4, y, 0.9)
  layout.drawLine(x + 4, y, x + 9, y + 8, 0.9)
}

function isCentralRegionReportValue(report = {}) {
  return String(report.regionName ?? report.regionCode ?? report.region ?? '').trim() === 'ภาคกลาง'
}

function getResultNoticeValues(report = {}) {
  const resultNotice = report.resultNotice ?? {}
  const checkedParameters = Array.isArray(resultNotice.checkedParameters)
    ? resultNotice.checkedParameters
    : [resultNotice.checkedParameters ?? report.parameter].filter(Boolean)

  return {
    reportCorrectness: resultNotice.reportCorrectness ?? '',
    checkedParameters,
    reviewResult: resultNotice.reviewResult ?? '',
    comment: resultNotice.comment ?? '',
    inspectorName: resultNotice.inspectorName ?? '',
    inspectorPosition: resultNotice.inspectorPosition ?? '',
  }
}

function drawInlineDottedValue(layout, label, value, x, y, endX, options = {}) {
  const size = options.size ?? textSizes.body
  const labelWidth = layout.textWidth(label, size, options.boldLabel)
  const valueX = x + labelWidth + 4

  layout.drawText(label, x, y, { size, bold: options.boldLabel })
  layout.drawDottedLine(valueX, endX, y - 2)
  if (!isBlankValue(value)) {
    layout.drawText(displayText(value), valueX + 2, y, {
      size,
      maxWidth: Math.max(20, endX - valueX - 4),
      lineHeight: size * 1.18,
    })
  }
}

function drawNoticeCheckboxText(layout, x, y, checked, text, options = {}) {
  drawCheck(layout, x, y - 1, checked)
  const textX = x + 18
  const size = options.size ?? textSizes.body
  return layout.drawText(text, textX, y, {
    size,
    bold: options.bold,
    maxWidth: options.maxWidth ?? layout.contentWidth - (textX - layout.margin.left),
    lineHeight: options.lineHeight ?? size * 1.2,
  })
}

function drawResultNoticeBody(layout, report = {}) {
  const isCentral = isCentralRegionReportValue(report)
  const notice = getResultNoticeValues(report)
  const boxX = 32
  const boxRight = layout.width - 32
  const boxTop = layout.height - 34
  const boxBottom = 40
  const x = boxX + 12
  const right = boxRight - 12
  const midX = x + ((right - x) / 2)
  const titleSize = textSizes.body
  let y = boxTop - 26

  layout.page.drawRectangle({
    x: boxX,
    y: boxBottom,
    width: boxRight - boxX,
    height: boxTop - boxBottom,
    borderColor: colors.border,
    borderWidth: lineWidth,
  })

  const noticeTitle = `แบบแจ้งผลการตรวจสอบ (${isCentral ? 'ส่วนกลาง' : 'ส่วนภูมิภาค'})`
  const noticeTitleWidth = layout.textWidth(noticeTitle, textSizes.title, true)
  layout.drawCentered(noticeTitle, y, { size: textSizes.title, bold: true })
  layout.drawLine((layout.width - noticeTitleWidth) / 2, y - 3, (layout.width + noticeTitleWidth) / 2, y - 3, 0.4)
  y -= 20
  const subtitle = 'การรายงานค่าความคลาดเคลื่อนของเครื่องมือหรือเครื่องอุปกรณ์พิเศษและเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติม'
  const subtitleWidth = layout.textWidth(subtitle, textSizes.body, true)
  layout.drawCentered(subtitle, y, { size: textSizes.body, bold: true })
  layout.drawLine((layout.width - subtitleWidth) / 2, y - 3, (layout.width + subtitleWidth) / 2, y - 3, 0.4)
  if (isCentral) {
    y -= 20
    layout.drawCentered('สำหรับตรวจวัด', y, { size: textSizes.body, bold: true })
  }
  y -= isCentral ? 34 : 48

  drawInlineDottedValue(layout, 'สำหรับโรงงาน :', report.factoryName, x, y, midX - 4, { boldLabel: true })
  drawInlineDottedValue(layout, 'การรายงานครั้งที่', report.reportRound, midX + 4, y, right, { boldLabel: true })
  y -= 18
  drawInlineDottedValue(layout, 'ทะเบียนโรงงานเลขที่ :', report.factoryRegistration ?? report.factoryRegistrationNo, x, y, midX - 4, { boldLabel: true })
  drawInlineDottedValue(layout, 'อ้างอิงรายงานวันที่ :', report.submittedDate, midX + 4, y, right, { boldLabel: true })
  y -= 24

  const checkedParameterText = notice.checkedParameters.join(', ')
  const hasCheckedParameter = (parameter) => checkedParameterText.includes(parameter)
  const isCorrectReport = notice.reportCorrectness === 'ถูกต้องครบถ้วน'
  const isIncorrectReport = notice.reportCorrectness === 'ไม่ถูกต้องครบถ้วน'
  const shouldNotifyResult = notice.reviewResult === 'เห็นควรแจ้งผลการตรวจสอบ'
  const shouldRequestCorrection = notice.reviewResult === 'เห็นควรให้แก้ไขเพิ่มเติม'

  layout.drawText('1. ความถูกต้องของแบบรายงาน', x, y, { size: titleSize, bold: true })
  const bodX = x + layout.textWidth('1. ความถูกต้องของแบบรายงาน', titleSize, true) + 8
  drawCheck(layout, bodX, y - 1, hasCheckedParameter('BOD'))
  layout.drawText('BOD', bodX + 16, y, { size: titleSize, bold: true })
  const codX = bodX + 46
  drawCheck(layout, codX, y - 1, hasCheckedParameter('COD'))
  layout.drawText('COD', codX + 16, y, { size: titleSize, bold: true })
  y -= 19

  let height = drawNoticeCheckboxText(
    layout,
    x + 22,
    y,
    isCorrectReport,
    'แบบรายงานถูกต้องครบถ้วนตามประกาศกรมโรงงานอุตสาหกรรม เรื่อง หลักเกณฑ์การให้ความเห็นชอบให้โรงงานที่ต้องมีระบบบำบัดน้ำเสียต้องติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษและเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติม (ฉบับที่ 2) พ.ศ. 2565',
    { maxWidth: right - x - 40, bold: false },
  )
  y -= Math.max(38, height + 6)

  const incorrectPrefix = 'แบบรายงานไม่ถูกต้องครบถ้วนตามประกาศกรมโรงงานอุตสาหกรรม เรื่อง หลักเกณฑ์การให้ความเห็นชอบให้โรงงานที่ต้องมีระบบบำบัดน้ำเสียต้องติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษและเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติม (ฉบับที่ 2) พ.ศ. 2565 เนื่องจาก'
  height = drawNoticeCheckboxText(layout, x + 22, y, isIncorrectReport, incorrectPrefix, {
    maxWidth: right - x - 40,
  })
  y -= Math.max(30, height)
  const reasonLines = layout.wrapText(isIncorrectReport ? notice.comment : '', right - (x + 56), titleSize)
  const firstReason = reasonLines.shift() ?? ''
  drawInlineDottedValue(layout, '', firstReason, x + 56, y, right)
  y -= 18
  layout.drawDottedLine(x, right, y - 2)
  if (reasonLines[0]) layout.drawText(reasonLines[0], x + 2, y, { size: titleSize, maxWidth: right - x - 4 })
  y -= 18
  layout.drawDottedLine(x, right, y - 2)
  if (reasonLines[1]) layout.drawText(reasonLines[1], x + 2, y, { size: titleSize, maxWidth: right - x - 4 })
  y -= 24

  layout.drawText('2.ค่าความคลาดเคลื่อน', x, y, { size: titleSize, bold: true })
  const secondBodX = x + layout.textWidth('2.ค่าความคลาดเคลื่อน', titleSize, true) + 8
  drawCheck(layout, secondBodX, y - 1, hasCheckedParameter('BOD'))
  layout.drawText('BOD', secondBodX + 16, y, { size: titleSize, bold: true })
  const secondCodX = secondBodX + 46
  drawCheck(layout, secondCodX, y - 1, hasCheckedParameter('COD'))
  layout.drawText('COD', secondCodX + 16, y, { size: titleSize, bold: true })
  y -= 21

  height = drawNoticeCheckboxText(
    layout,
    x + 22,
    y,
    shouldNotifyResult,
    'เป็นไปตามประกาศกรมโรงงานอุตสาหกรรม เรื่อง หลักเกณฑ์การให้ความเห็นชอบให้โรงงานที่ต้องมีระบบบำบัดน้ำเสียต้องติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษและเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติม พ.ศ. 2550',
    { maxWidth: right - x - 40 },
  )
  y -= Math.max(38, height + 6)
  height = drawNoticeCheckboxText(
    layout,
    x + 22,
    y,
    shouldRequestCorrection,
    'ไม่เป็นตามประกาศกรมโรงงานอุตสาหกรรม เรื่อง หลักเกณฑ์การให้ความเห็นชอบให้โรงงานที่ต้องมีระบบบำบัดน้ำเสียต้องติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษและเครื่องมือหรือเครื่องอุปกรณ์เพิ่มเติม พ.ศ. 2550',
    { maxWidth: right - x - 40 },
  )
  y -= Math.max(48, height + 16)

  layout.drawText('หมายเหตุ', x, y, { size: titleSize, bold: true })
  layout.drawText(': ในกรณีที่การบันทึกข้อมูลในแบบรายงานไม่ถูกต้องและหรือค่าความคลาดเคลื่อนไม่เป็นไปตามประกาศฯ', x + 52, y, {
    size: titleSize,
    maxWidth: right - x - 52,
    lineHeight: 17,
  })
  y -= 18
  layout.drawText('กรมโรงงานอุตสาหกรรมจะดำเนินการแจ้งผลการตรวจสอบไปยังหน่วยงานกำกับ', x + 52, y, {
    size: titleSize,
  })

  const signatureTop = isCentral ? 330 : 258
  if (isCentral) {
    drawResultNoticeSignature(layout, x + 72, signatureTop, 'ผู้ตรวจสอบ', notice.inspectorName, notice.inspectorPosition)
    drawResultNoticeSignature(layout, x + 300, signatureTop, 'ผู้ทบทวน', '', 'ผอ.กฝม.')
    drawResultNoticeSignature(layout, x + 186, signatureTop - 102, 'ผู้อนุมัติ', '', 'ผอ.กวภ.')
  } else {
    drawResultNoticeSignature(layout, x + 72, signatureTop, 'ผู้ตรวจสอบ', notice.inspectorName, notice.inspectorPosition)
    drawResultNoticeSignature(layout, x + 300, signatureTop, 'ผู้อนุมัติ', '', 'ผอ.ศวภ.')
  }

  drawResultNoticeContact(layout, isCentral, x, right, 114)
}

function drawResultNoticeSignature(layout, x, y, role, name = '', position = '') {
  const width = 160
  const centerX = x + (width / 2)
  const size = textSizes.body
  layout.drawDottedLine(x, x + width, y)
  layout.drawText('(ลงชื่อ)', x + width + 4, y + 2, { size })
  layout.drawText('(', x - 6, y - 22, { size })
  layout.drawDottedLine(x, x + width, y - 20)
  layout.drawText(')', x + width + 4, y - 22, { size })
  if (name) {
    const nameWidth = layout.textWidth(name, size)
    layout.drawText(name, centerX - (nameWidth / 2), y - 18, { size })
  }
  layout.drawText('ตำแหน่ง', x - 45, y - 43, { size })
  layout.drawDottedLine(x, x + width, y - 42)
  if (position) {
    const positionWidth = layout.textWidth(position, size)
    layout.drawText(position, centerX - (positionWidth / 2), y - 40, { size })
  }
  const roleWidth = layout.textWidth(role, size, true)
  layout.drawText(role, centerX - (roleWidth / 2), y - 64, { size, bold: true })
  const dateText = '......../........../..........'
  const dateWidth = layout.textWidth(dateText, size)
  layout.drawText(dateText, centerX - (dateWidth / 2), y - 84, { size })
}

function drawResultNoticeContact(layout, isCentral, x, right, y) {
  const size = textSizes.body
  layout.drawText('สอบถามข้อมูลเพิ่มเติมได้ที่', x, y, { size, bold: true })
  const detailX = x + layout.textWidth('สอบถามข้อมูลเพิ่มเติมได้ที่ : ', size, true)
  if (isCentral) {
    layout.drawText(': ศูนย์เฝ้าระวังสิ่งแวดล้อมอุตสาหกรรม กลุ่มเฝ้าระวังและเตือนภัยมลพิษโรงงาน', detailX - 4, y, { size })
    layout.drawText('โทรศัพท์ : 02-4306312 ต่อ 2109  Line : @iemcdiw', detailX + 48, y - 18, { size })
    layout.drawText('ไปรษณีย์อิเล็กทรอนิกส์ : poms.support@diw.mail.go.th', detailX + 48, y - 36, { size })
    return
  }

  layout.drawText(': ศูนย์วิจัยและเตือนภัยมลพิษโรงงานภาค', detailX - 4, y, { size })
  layout.drawDottedLine(detailX + 176, right - 60, y - 2)
  layout.drawText('โทรศัพท์ : 02-4306312 ต่อ', detailX + 48, y - 18, { size })
  layout.drawDottedLine(detailX + 168, right - 120, y - 20)
  layout.drawText('ไปรษณีย์อิเล็กทรอนิกส์ :', detailX + 48, y - 36, { size })
  layout.drawDottedLine(detailX + 170, right - 126, y - 38)
  layout.drawText('(ของแต่ละศูนย์)', right - 122, y - 36, { size })
}

function drawMainFormFields(layout, report = {}) {
  const x = layout.margin.left
  const right = layout.width - layout.margin.right
  const midX = x + ((right - x) * 0.55)
  const rowGap = 18
  let y = layout.y

  const line = (label, value, startX, endX, suffix = '') => {
    drawValueLine(layout, label, value, startX, y, suffix ? endX - layout.textWidth(suffix, textSizes.body) - 4 : endX)
    if (suffix) {
      layout.drawText(suffix, endX - layout.textWidth(suffix, textSizes.body), y, { size: textSizes.body })
    }
  }
  const next = (gap = rowGap) => {
    y -= gap
  }

  line('ชื่อบริษัท', report.factoryName, x, right)
  next()
  line('เลขทะเบียนโรงงาน', report.factoryRegistration ?? report.factoryRegistrationNo, x, midX - 8)
  line('ประกอบกิจการ', report.businessActivity, midX + 8, right)
  next()
  line('สถานที่ตั้ง', report.factoryAddress, x, right)
  next()
  line('ปริมาณการระบายน้ำทิ้งขณะเก็บตัวอย่าง', report.wastewaterFlow, x, right, 'ลบ.ม./ชั่วโมง')
  next()
  line('ผู้เก็บตัวอย่าง', report.samplerName, x, midX - 8)
  line('ทะเบียนเจ้าหน้าที่', report.officerRegistration, midX + 8, right)
  next()
  line('หน่วยงาน/ชื่อห้องปฏิบัติการ', report.laboratoryName, x, right)
  next()
  line('ทะเบียนห้องปฏิบัติการ', report.laboratoryRegistration, x, midX - 8)
  line('เลขที่ใบรายงานผลวิเคราะห์', report.labReportNo, midX + 8, right)
  next()
  line('วิธีวิเคราะห์ทดสอบในห้องปฏิบัติการ', report.analysisMethod, x, right)
  next()
  line('รายละเอียดของเครื่องมือหรือเครื่องอุปกรณ์พิเศษฯ ยี่ห้อ (Brand)', report.deviceBrand, x, right)
  next()
  line('รุ่น (Model)', report.deviceModel, x, midX - 8)
  line('หมายเลขเครื่อง (Serial No.)', report.serialNo, midX + 8, right)
  next()

  const selectedParameters = Array.isArray(report.parameter)
    ? report.parameter
    : [report.parameter ?? report.selectedParameterCode].filter(Boolean)
  const label = 'รายการที่ตรวจสอบค่าความคลาดเคลื่อน :'
  layout.drawText(label, x, y, { size: textSizes.body })
  const bodX = x + layout.textWidth(label, textSizes.body) + 10
  const codX = bodX + 76
  drawCheck(layout, bodX, y - 1, selectedParameters.includes('BOD'))
  layout.drawText('บีโอดี', bodX + 16, y, { size: textSizes.body })
  drawCheck(layout, codX, y - 1, selectedParameters.includes('COD'))
  layout.drawText('ซีโอดี', codX + 16, y, { size: textSizes.body })
  next(34)

  layout.y = y
}

function drawMeasurementTable(layout, report = {}) {
  const rows = Array.isArray(report.measurementRows) && report.measurementRows.length
    ? report.measurementRows
    : [{}]
  const x = layout.margin.left
  const width = layout.contentWidth
  const columns = [
    { label: 'วันที่เก็บ\nตัวอย่าง' },
    { label: 'เวลาที่เก็บ\nตัวอย่าง' },
    { label: 'ค่าที่เครื่องมือ\nตรวจวัดได้' },
    { label: 'ค่าที่ห้องปฏิบัติการ\nวิเคราะห์ได้' },
    { label: 'ค่าความ\nคลาดเคลื่อน' },
    { label: 'ค่าความคลาดเคลื่อน\nตามประกาศฯ' },
  ]
  const colWidths = columns.map(() => width / columns.length)
  const headerHeight = 86
  const rowHeight = 56
  let y = layout.y

  const drawCell = (text, cellX, topY, cellWidth, height, options = {}) => {
    layout.drawRect(cellX, topY, cellWidth, height, {
      fill: options.fill ?? colors.white,
      borderWidth: lineWidth,
    })
    const size = options.size ?? textSizes.table
    const bold = options.bold ?? false
    const lines = String(text ?? '').split('\n').flatMap((line) => layout.wrapText(line, cellWidth - 8, size, bold))
    const lineHeight = size * 1.18
    const totalHeight = lines.length * lineHeight
    const startY = topY - ((height - totalHeight) / 2) - size
    lines.forEach((line, index) => {
      const textWidth = layout.textWidth(line, size, bold)
      layout.drawText(line, cellX + Math.max(4, (cellWidth - textWidth) / 2), startY - (index * lineHeight), { size, bold })
    })
  }

  let cellX = x
  columns.forEach((column, index) => {
    drawCell(column.label, cellX, y, colWidths[index], headerHeight, {
      fill: colors.headerFill,
      bold: true,
    })
    cellX += colWidths[index]
  })
  y -= headerHeight

  rows.forEach((row) => {
    const cells = [
      row.sampleDate,
      row.sampleTime,
      row.deviceValue,
      row.labValue,
      row.errorValue,
      row.standardErrorValue,
    ]
    cellX = x
    cells.forEach((cell, index) => {
      drawCell(displayValue(cell), cellX, y, colWidths[index], rowHeight)
      cellX += colWidths[index]
    })
    y -= rowHeight
  })

  layout.y = y
}

function drawNotes(layout) {
  const x = layout.margin.left
  const numberX = x + layout.textWidth('หมายเหตุ  ', textSizes.small, true)
  const detailX = numberX + 16
  const maxWidth = layout.contentWidth
  const lines = [
    { number: '1.', text: 'คำนวณค่าความคลาดเคลื่อน โดยใช้สูตร  E = M - T', prefix: 'หมายเหตุ  ', bold: true },
    { text: 'โดย E = ค่าความคลาดเคลื่อนของเครื่องตรวจวัดค่าบีโอดีหรือเครื่องตรวจวัดค่าซีโอดี (มิลลิกรัมต่อลิตร)', indent: detailX },
    { text: 'M = ผลการตรวจวัดค่าบีโอดีหรือซีโอดีที่ได้จากเครื่องมือหรือเครื่องอุปกรณ์พิเศษขณะเก็บตัวอย่างน้ำ (มิลลิกรัมต่อลิตร)', indent: detailX },
    { text: 'T = ผลการตรวจวัดค่าบีโอดีหรือซีโอดีที่ได้จากห้องปฏิบัติการ (มิลลิกรัมต่อลิตร)', indent: detailX },
    { number: '2.', text: 'ในกรณีที่ผลตรวจวัดค่าบีโอดีหรือซีโอดีน้อยกว่าขีดจำกัดในการวิเคราะห์ของห้องปฏิบัติการให้ใช้ค่าจริงที่วิเคราะห์ได้ในการคำนวณ', bold: true },
    { number: '3.', text: 'การปัดเศษ ให้เป็นไปตาม มอก.929-2533', bold: true },
  ]

  layout.y -= 20
  lines.forEach((line) => {
    if (line.prefix) {
      layout.drawText(line.prefix, x, layout.y, { size: textSizes.small, bold: true })
    }

    if (line.number) {
      layout.drawText(line.number, numberX, layout.y, { size: textSizes.small, bold: line.bold ?? false })
    }

    const textX = line.indent ?? detailX
    const height = layout.drawText(line.text, textX, layout.y, {
      size: textSizes.small,
      bold: line.bold ?? false,
      maxWidth: maxWidth - (textX - x),
      lineHeight: 14,
    })
    layout.y -= Math.max(14, height)
  })
}

function drawSignature(layout, report = {}) {
  const contentRight = layout.width - layout.margin.right
  const lineEndX = contentRight
  const lineStartX = contentRight - 132
  const signCenterX = (lineStartX + lineEndX) / 2
  const labelSize = 13
  const signatureTopY = Math.max(layout.margin.bottom + 94, Math.min(layout.y - 28, 178))
  const drawSignatureLine = (lineY) => {
    layout.page.drawLine({
      start: { x: lineStartX, y: lineY },
      end: { x: lineEndX, y: lineY },
      thickness: lineWidth,
      color: colors.border,
      dashArray: [1.2, 2.1],
    })
  }
  const drawSignatureLabel = (label, ty) => {
    const labelGap = 8
    const labelWidth = layout.textWidth(label, labelSize)
    layout.drawText(label, lineStartX - labelWidth - labelGap, ty, { size: labelSize })
  }

  drawSignatureLabel('ผู้รายงานผลการทดสอบ', signatureTopY)
  drawSignatureLine(signatureTopY - 4)
  const parenthesisY = signatureTopY - 23
  layout.drawText('(', lineStartX - 8, parenthesisY, { size: labelSize })
  drawSignatureLine(parenthesisY - 4)
  const name = displayText(report.reporterName)
  if (name) {
    const nameWidth = layout.textWidth(name, labelSize)
    layout.drawText(name, signCenterX - (nameWidth / 2), parenthesisY, { size: labelSize })
  }
  layout.drawText(')', lineEndX + 2, parenthesisY, { size: labelSize })
  const positionY = signatureTopY - 45
  drawSignatureLabel('ตำแหน่ง', positionY)
  drawSignatureLine(positionY - 4)
  const position = displayText(report.reporterPosition)
  if (position) {
    const positionWidth = layout.textWidth(position, labelSize)
    layout.drawText(position, lineStartX + ((lineEndX - lineStartX - positionWidth) / 2), positionY, { size: labelSize })
  }
  const dateY = signatureTopY - 67
  drawSignatureLabel('ลงวันที่', dateY)
  drawSignatureLine(dateY - 4)
  layout.y = dateY - 24
}

async function renderAttachmentList(layout, documents = []) {
  const imageDocuments = documents.filter(isImageDocument)
  for (const document of imageDocuments) {
    try {
      const image = await embedImageDocument(layout, document)
      if (image) {
        layout.drawEmbeddedImage(image, { indent: 30 })
      }
    } catch {
      // Ignore images that cannot be loaded into the PDF preview.
    }
  }
}

async function renderDocumentSections(layout, report = {}) {
  const attachmentFiles = getAttachmentFiles(report)
  const sections = [
    { label: 'ภาพถ่ายขณะเก็บตัวอย่าง', files: attachmentFiles.samplePhotos },
    { label: 'ภาพหน้าเครื่องมือตรวจวัดที่แสดง ณ เวลาที่เก็บตัวอย่าง', files: attachmentFiles.devicePhotos },
    { label: 'รายงานผลจากห้องปฏิบัติการ', files: attachmentFiles.labReports },
  ]
    .map((section) => ({
      ...section,
      files: section.files.filter(isImageDocument),
    }))
    .filter((section) => section.files.length)

  if (!sections.length) {
    return
  }

  layout.addPage()
  layout.sectionTitle('เอกสารและรูปภาพ')

  for (const section of sections) {
    layout.paragraph(section.label, { indent: 18, bold: true })
    await renderAttachmentList(layout, section.files)
    layout.y -= 8
  }
}

export async function createBodCodReportPdf(report = {}) {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  const [regularBytes, boldBytes] = await Promise.all([
    fetchFontBytes(sarabunRegularUrl),
    fetchFontBytes(sarabunBoldUrl),
  ])
  const fonts = {
    regular: await pdfDoc.embedFont(regularBytes),
    bold: await pdfDoc.embedFont(boldBytes),
  }

  const layout = new BodCodPdfLayout(pdfDoc, fonts)

  drawHeader(layout, report)
  drawMainFormFields(layout, report)
  drawMeasurementTable(layout, report)
  drawNotes(layout)
  drawSignature(layout, report)
  await renderDocumentSections(layout, report)

  return pdfDoc.save()
}

export async function createBodCodResultNoticePdf(report = {}) {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  const [regularBytes, boldBytes] = await Promise.all([
    fetchFontBytes(sarabunRegularUrl),
    fetchFontBytes(sarabunBoldUrl),
  ])
  const fonts = {
    regular: await pdfDoc.embedFont(regularBytes),
    bold: await pdfDoc.embedFont(boldBytes),
  }

  const layout = new BodCodPdfLayout(pdfDoc, fonts)

  drawResultNoticeBody(layout, report)

  return pdfDoc.save()
}
