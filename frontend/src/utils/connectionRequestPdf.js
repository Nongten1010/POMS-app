import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, PDFName, PDFString, PageSizes, rgb } from 'pdf-lib'
import sarabunBoldUrl from '../assets/fonts/THSarabunNew-Bold.ttf?url'
import sarabunRegularUrl from '../assets/fonts/THSarabunNew.ttf?url'

const colors = {
  black: rgb(0, 0, 0),
  white: rgb(1, 1, 1),
  border: rgb(0.08, 0.08, 0.08),
  lightBorder: rgb(0.76, 0.8, 0.86),
  headerFill: rgb(0.9, 0.94, 1),
  muted: rgb(0.35, 0.38, 0.44),
  link: rgb(0.02, 0.28, 0.72),
}

const specialCriteriaRows = [
  { key: 'normal', label: 'ปกติ', leftSign: 'lte', rightSign: 'lte', aliases: [] },
  { key: 'warning', label: 'เฝ้าระวัง', leftSign: 'lt', rightSign: 'lte', aliases: ['watch'] },
  { key: 'critical', label: 'แจ้งเตือน', leftSign: 'lt', rightSign: 'lt', aliases: ['alert'] },
]

const pdfTextSizes = {
  body: 16,
  section: 17,
  title: 21,
  subtitle: 19,
  table: 12,
  compactTable: 11,
  signature: 15,
  footer: 11,
}

function isBlankValue(value) {
  if (value === null || value === undefined) {
    return true
  }

  if (typeof value !== 'string') {
    return false
  }

  const normalizedValue = value.trim().toLowerCase()

  return normalizedValue === ''
    || normalizedValue === 'null'
    || normalizedValue === 'none'
    || normalizedValue === 'ไม่มี'
    || normalizedValue === 'ไม่ระบุ'
}

function displayValue(value, fallback = '-') {
  if (isBlankValue(value)) {
    return fallback
  }

  return String(value).trim()
}

function normalizeArrayValue(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function joinList(values, fallback = '-') {
  if (typeof values === 'string') {
    return isBlankValue(values) ? fallback : values
  }

  const normalizedValues = Array.isArray(values) ? values.filter((value) => !isBlankValue(value)) : []

  return normalizedValues.length ? normalizedValues.join(', ') : fallback
}

function firstDefinedValue(...values) {
  return values.find((value) => !isBlankValue(value))
}

function hasObjectValue(value = {}) {
  return Object.values(value).some((item) => !isBlankValue(item))
}

function nonEmptyList(values = []) {
  return values.filter((value) => !isBlankValue(value))
}

function normalizeDocumentUrl(url) {
  if (!url) {
    return ''
  }

  if (/^(blob:|data:|https?:\/\/)/i.test(url)) {
    return url
  }

  return `https://d-poms.diw.go.th${url.startsWith('/') ? url : `/${url}`}`
}

function isImageDocument(document = {}) {
  const fileUrl = normalizeDocumentUrl(document.filePreviewUrl ?? document.fileUrl ?? document.url ?? document.storageUrl ?? document.path)
  const link = normalizeDocumentUrl(document.link)
  const candidateUrl = fileUrl || link

  return Boolean(candidateUrl) && (
    (document.fileType ?? document.mimeType ?? document.type)?.startsWith('image/') ||
    /\.(png|jpe?g|webp)(\?.*)?$/i.test(candidateUrl)
  )
}

function getDocumentImageUrl(document = {}) {
  if (!isImageDocument(document)) {
    return ''
  }

  const fileUrl = normalizeDocumentUrl(document.filePreviewUrl ?? document.fileUrl ?? document.url ?? document.storageUrl ?? document.path)
  const link = normalizeDocumentUrl(document.link)

  return fileUrl || link
}

function formatProductionCapacity(value, unit) {
  return [value, unit].map((item) => String(item ?? '').trim()).filter(Boolean).join(' ')
}

function formatThaiDate(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear() + 543

  return `${day}/${month}/${year}`
}

function formatFuel(name, other, percent) {
  const fuelName = other || name
  const fuelPercent = percent || percent === 0 ? ` ร้อยละโดยประมาณ ${percent}` : ''
  return fuelName ? `${fuelName}${fuelPercent}` : ''
}

function formatFactoryRegistration(request, factory = {}) {
  const candidates = [
    request?.factoryId,
    factory.factoryId,
    factory.newRegistrationNo,
    request?.newRegistrationNo,
    request?.factoryRegistrationNo,
    factory.oldRegistrationNo,
  ].filter(Boolean)

  return candidates[0] ?? ''
}

function getCriteriaRow(criteria, level) {
  const criteriaLevel = specialCriteriaRows.find((row) => row.key === level)
  const levels = [level, ...(criteriaLevel?.aliases ?? [])]

  return criteria?.rows?.find((row) => levels.includes(row.level)) ?? {}
}

function getEiaStandardDisplay(parameter = {}) {
  return parameter.eiaCriteria?.standardValue || parameter.eiaStandard || '-'
}

function getRequestDeviceConfigs(request) {
  return Array.isArray(request?.deviceConfigs) ? request.deviceConfigs.filter(Boolean) : []
}

function getDeviceConfigDevices(deviceConfigs) {
  return deviceConfigs.flatMap((config) =>
    Array.isArray(config?.device)
      ? config.device.map((device) => ({ ...device, stationId: config.stationId }))
      : [],
  )
}

function getDeviceConfigChannels(deviceConfigs) {
  return deviceConfigs.flatMap((config) =>
    Array.isArray(config?.channels)
      ? config.channels.map((channel) => ({ ...channel, stationId: config.stationId }))
      : [],
  )
}

function formatDeviceSettingValue(label, value) {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  return `${label}: ${value}`
}

function formatDeviceSettings(settings = {}) {
  const valueRange = settings.valueRange ?? {}
  const values = [
    formatDeviceSettingValue('COMPORT', settings.comPort ?? settings.comport),
    formatDeviceSettingValue('Slave ID', settings.slaveId),
    formatDeviceSettingValue('Baud Rate', settings.baudRate),
    formatDeviceSettingValue('Parity', settings.parity),
    formatDeviceSettingValue('Stop bits', settings.stopBits),
    formatDeviceSettingValue('Data bits', settings.dataBits),
    formatDeviceSettingValue('Quantity', settings.quantity),
    formatDeviceSettingValue('Host IP', settings.hostIp),
    formatDeviceSettingValue('Port', settings.port),
    formatDeviceSettingValue('dbUser', settings.dbUser),
    formatDeviceSettingValue('dbName', settings.dbName),
    valueRange.min !== undefined || valueRange.max !== undefined
      ? `ช่วงข้อมูลตรวจวัด: ${displayValue(valueRange.min, '-')} - ${displayValue(valueRange.max, '-')}`
      : '',
  ].filter(Boolean)

  return values.join(', ')
}

async function fetchFontBytes(url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`โหลดฟอนต์สำหรับ PDF ไม่สำเร็จ (${response.status})`)
  }

  return response.arrayBuffer()
}

async function embedImageFromUrl(pdfDoc, url, document = {}) {
  const response = await fetch(url, { credentials: 'include' })

  if (!response.ok) {
    return null
  }

  const bytes = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') ?? ''
  const fileType = document.fileType ?? document.mimeType ?? document.type ?? ''
  const fileName = getDocumentFileName(document)
  const imageTypeHint = `${contentType} ${fileType} ${fileName} ${url}`
  const isPng = /image\/png|\.png(\?.*)?$/i.test(imageTypeHint) || url.startsWith('data:image/png')
  const isJpeg = /image\/jpe?g|\.jpe?g(\?.*)?$/i.test(imageTypeHint) || url.startsWith('data:image/jpeg')

  if (isPng) {
    return pdfDoc.embedPng(bytes)
  }

  if (isJpeg) {
    return pdfDoc.embedJpg(bytes)
  }

  return null
}

function splitTextToTokens(text) {
  return String(text ?? '')
    .split(/(\s+)/)
    .filter((token) => token.length > 0)
}

function trimLineEnd(value) {
  return String(value).replace(/\s+$/u, '')
}

function formatRequestSubmittedDate(value) {
  if (isBlankValue(value)) {
    return ''
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      const [, year, month, day] = match
      return `${day}/${month}/${Number(year) + 543}`
    }

    return value
  }

  return String(value)
}

class PdfLayout {
  constructor(pdfDoc, fonts) {
    this.pdfDoc = pdfDoc
    this.fonts = fonts
    this.pageSize = PageSizes.A4
    this.margin = { top: 48, right: 48, bottom: 50, left: 48 }
    this.page = null
    this.y = 0
    this.pageNumber = 0
    this.pages = []
    this.addPage()
  }

  addPage() {
    const page = this.pdfDoc.addPage(this.pageSize)
    this.page = page
    this.pages.push(page)
    this.pageNumber += 1
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

  textWidth(text, size, bold = false) {
    return (bold ? this.fonts.bold : this.fonts.regular).widthOfTextAtSize(String(text ?? ''), size)
  }

  wrapText(text, maxWidth, size = pdfTextSizes.body, bold = false) {
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

  wrapTextWithLineWidths(text, lineWidths, size = pdfTextSizes.body, bold = false) {
    const lines = []
    let currentLine = ''
    const tokens = splitTextToTokens(text)
    const getLineWidth = () => lineWidths[Math.min(lines.length, lineWidths.length - 1)] ?? lineWidths[0] ?? this.contentWidth

    tokens.forEach((token) => {
      const maxWidth = getLineWidth()
      const nextLine = `${currentLine}${token}`
      if (this.textWidth(nextLine, size, bold) <= maxWidth) {
        currentLine = nextLine
        return
      }

      if (currentLine) {
        lines.push(trimLineEnd(currentLine))
      }

      const nextMaxWidth = getLineWidth()
      if (this.textWidth(token, size, bold) <= nextMaxWidth) {
        currentLine = token.trimStart()
        return
      }

      let brokenLine = ''
      Array.from(token).forEach((char) => {
        const charMaxWidth = getLineWidth()
        const nextBrokenLine = `${brokenLine}${char}`
        if (!brokenLine || this.textWidth(nextBrokenLine, size, bold) <= charMaxWidth) {
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
    const {
      size = pdfTextSizes.body,
      bold = false,
      color = colors.black,
      maxWidth,
      lineHeight = size * 1.45,
    } = options
    const lines = maxWidth ? this.wrapText(text, maxWidth, size, bold) : [String(text ?? '')]

    lines.forEach((line, index) => {
      this.page.drawText(line, {
        x,
        y: y - (index * lineHeight),
        size,
        font: bold ? this.fonts.bold : this.fonts.regular,
        color,
      })
    })

    return lines.length * lineHeight
  }

  drawText(text, options = {}) {
    const size = options.size ?? pdfTextSizes.body
    const lineHeight = options.lineHeight ?? size * 1.45
    const maxWidth = options.maxWidth ?? this.contentWidth
    const lines = this.wrapText(text, maxWidth, size, options.bold)
    const height = Math.max(lineHeight, lines.length * lineHeight)

    this.ensureSpace(height + 2)
    lines.forEach((line, index) => {
      this.page.drawText(line, {
        x: options.x ?? this.margin.left,
        y: this.y - size - (index * lineHeight),
        size,
        font: options.bold ? this.fonts.bold : this.fonts.regular,
        color: options.color ?? colors.black,
      })
    })
    this.y -= height

    return height
  }

  space(height = 8) {
    this.ensureSpace(height)
    this.y -= height
  }

  title(lines) {
    this.space(14)
    lines.forEach((line) => {
      const size = line.size ?? pdfTextSizes.title
      const text = line.text ?? line
      const width = this.textWidth(text, size, true)
      this.drawTextAt(text, (this.width - width) / 2, this.y - size, { size, bold: true })
      this.y -= size * 1.55
    })
    this.space(6)
  }

  requestMetaHeader(request) {
    const firstPage = this.pages[0]
    if (!firstPage) {
      return
    }

    const size = pdfTextSizes.body
    const requestNo = displayValue(request?.requestNo)
    const submittedDate = displayValue(request?.submittedDate || formatRequestSubmittedDate(request?.submittedAt))
    const leftText = `เลขที่คำขอ : ${requestNo}`
    const rightText = `วันที่ยื่นคำขอ : ${submittedDate}`
    const y = this.pageSize[1] - 30

    firstPage.drawText(leftText, {
      x: this.margin.left,
      y,
      size,
      font: this.fonts.regular,
      color: colors.black,
    })
    firstPage.drawText(rightText, {
      x: this.width - this.margin.right - this.textWidth(rightText, size),
      y,
      size,
      font: this.fonts.regular,
      color: colors.black,
    })
  }

  sectionTitle(text) {
    this.space(6)
    this.drawText(text, { size: pdfTextSizes.section, bold: true })
    this.space(2)
  }

  drawDottedLeader(startX, endX, y) {
    if (endX - startX < 12) {
      return
    }

    this.page.drawLine({
      start: { x: startX, y },
      end: { x: endX, y },
      thickness: 0.6,
      color: colors.muted,
      dashArray: [1.4, 2.4],
    })
  }

  addLinkAnnotation(x, y, width, height, url) {
    const normalizedUrl = normalizeDocumentUrl(url)

    if (!normalizedUrl) {
      return
    }

    const annotation = this.pdfDoc.context.obj({
      Type: PDFName.of('Annot'),
      Subtype: PDFName.of('Link'),
      Rect: [x, y, x + width, y + height],
      Border: [0, 0, 0],
      NewWindow: true,
      A: {
        Type: PDFName.of('Action'),
        S: PDFName.of('URI'),
        URI: PDFString.of(normalizedUrl),
        NewWindow: true,
      },
    })
    const annotationRef = this.pdfDoc.context.register(annotation)
    const { Annots } = this.page.node.normalizedEntries()
    Annots.push(annotationRef)
  }

  drawExternalLinkIcon(x, y, size = 8) {
    const stroke = { thickness: 0.8, color: colors.link }
    this.page.drawLine({ start: { x, y }, end: { x: x + size * 0.62, y }, ...stroke })
    this.page.drawLine({ start: { x, y }, end: { x, y: y + size * 0.62 }, ...stroke })
    this.page.drawLine({ start: { x, y: y + size * 0.62 }, end: { x: x + size * 0.38, y: y + size * 0.62 }, ...stroke })
    this.page.drawLine({ start: { x: x + size * 0.62, y }, end: { x: x + size * 0.62, y: y + size * 0.38 }, ...stroke })
    this.page.drawLine({ start: { x: x + size * 0.28, y: y + size * 0.32 }, end: { x: x + size, y: y + size }, ...stroke })
    this.page.drawLine({ start: { x: x + size * 0.62, y: y + size }, end: { x: x + size, y: y + size }, ...stroke })
    this.page.drawLine({ start: { x: x + size, y: y + size * 0.62 }, end: { x: x + size, y: y + size }, ...stroke })
  }

  drawLinkItem(label, url, options = {}) {
    const indent = options.indent ?? 30
    const x = this.margin.left + indent
    const size = options.size ?? pdfTextSizes.body
    const lineHeight = options.lineHeight ?? size * 1.45
    const maxWidth = this.contentWidth - indent
    const showIcon = options.showIcon !== false
    const iconWidth = showIcon ? 14 : 0
    const lines = this.wrapText(label, Math.max(48, maxWidth - iconWidth), size)
    const height = Math.max(lineHeight, lines.length * lineHeight)

    this.ensureSpace(height + 2)

    lines.forEach((line, index) => {
      const lineY = this.y - size - (index * lineHeight)
      const lineWidth = this.textWidth(line, size)

      this.page.drawText(line, {
        x,
        y: lineY,
        size,
        font: this.fonts.regular,
        color: colors.link,
      })
      this.page.drawLine({
        start: { x, y: lineY - 1.5 },
        end: { x: x + lineWidth, y: lineY - 1.5 },
        thickness: 0.45,
        color: colors.link,
      })

      if (showIcon && index === lines.length - 1) {
        this.drawExternalLinkIcon(x + lineWidth + 5, lineY + 3, 8)
      }
    })

    this.addLinkAnnotation(x, this.y - height, maxWidth, height, url)
    this.y -= height
  }

  labelValue(label, value, options = {}) {
    const indent = options.indent ?? 18
    const x = this.margin.left + indent
    const maxWidth = this.contentWidth - indent
    const size = options.size ?? pdfTextSizes.body
    const lineHeight = options.lineHeight ?? size * 1.45
    const labelText = String(label ?? '')
    const valueText = displayValue(value, options.fallback)
    const labelWidth = this.textWidth(labelText, size, options.bold)
    const suffixText = options.suffix ? String(options.suffix) : ''
    const suffixWidth = suffixText ? this.textWidth(suffixText, size, options.bold) + 8 : 0
    const valueX = x + labelWidth + 5
    const valueMaxWidth = Math.max(0, (x + maxWidth - suffixWidth) - valueX)
    const shouldUseInlineLeader = options.leader !== false
      && valueMaxWidth >= 24
      && this.textWidth(labelText, size, options.bold) < maxWidth * 0.72
    const lines = shouldUseInlineLeader
      ? this.wrapTextWithLineWidths(valueText, [valueMaxWidth, maxWidth], size, options.bold)
      : this.wrapText(`${labelText}${valueText}`, maxWidth, size, options.bold)
    const height = Math.max(lineHeight, lines.length * lineHeight)

    this.ensureSpace(height + 2)
    if (shouldUseInlineLeader) {
      this.page.drawText(labelText, {
        x,
        y: this.y - size,
        size,
        font: options.bold ? this.fonts.bold : this.fonts.regular,
        color: options.color ?? colors.black,
      })
      lines.forEach((line, index) => {
        const lineY = this.y - size - (index * lineHeight)
        const lineStartX = index === 0 ? valueX : x
        const leaderEndX = index === 0 ? x + maxWidth - suffixWidth : x + maxWidth
        this.drawDottedLeader(lineStartX, leaderEndX, lineY - 2)
        if (line) {
          this.page.drawText(line, {
            x: lineStartX + 2,
            y: lineY,
            size,
            font: options.bold ? this.fonts.bold : this.fonts.regular,
            color: options.color ?? colors.black,
          })
        }
        if (index === 0 && suffixText) {
          this.page.drawText(suffixText, {
            x: x + maxWidth - suffixWidth + 8,
            y: lineY,
            size,
            font: options.bold ? this.fonts.bold : this.fonts.regular,
            color: options.color ?? colors.black,
          })
        }
      })
    } else {
      lines.forEach((line, index) => {
        this.page.drawText(line, {
          x,
          y: this.y - size - (index * lineHeight),
          size,
          font: options.bold ? this.fonts.bold : this.fonts.regular,
          color: options.color ?? colors.black,
        })
      })
    }

    this.y -= height
  }

  drawInlineField(x, width, label, value, options = {}) {
    const size = options.size ?? pdfTextSizes.body
    const labelText = String(label ?? '')
    const valueText = displayValue(value, options.fallback)
    const labelWidth = this.textWidth(labelText, size, options.bold)
    const suffixText = options.suffix ? String(options.suffix) : ''
    const suffixWidth = suffixText ? this.textWidth(suffixText, size, options.bold) + 8 : 0
    const valueX = x + labelWidth + 5
    const endX = x + width
    const lineHeight = options.lineHeight ?? size * 1.45
    const firstLineWidth = Math.max(0, endX - suffixWidth - valueX - 4)
    const continuationWidth = Math.max(0, endX - x - 4)
    const valueLines = valueText
      ? this.wrapTextWithLineWidths(valueText, [firstLineWidth, continuationWidth], size, options.bold)
      : ['']

    this.page.drawText(labelText, {
      x,
      y: this.y - size,
      size,
      font: options.bold ? this.fonts.bold : this.fonts.regular,
      color: options.color ?? colors.black,
    })
    valueLines.forEach((line, index) => {
      const lineStartX = index === 0 ? valueX : x
      const lineY = this.y - size - (index * lineHeight)
      const leaderEndX = index === 0 ? endX - suffixWidth : endX
      this.drawDottedLeader(lineStartX, leaderEndX, lineY - 2)

      if (line) {
        this.page.drawText(line, {
          x: lineStartX + 2,
          y: lineY,
          size,
          font: options.bold ? this.fonts.bold : this.fonts.regular,
          color: options.color ?? colors.black,
        })
      }
      if (index === 0 && suffixText) {
        this.page.drawText(suffixText, {
          x: endX - suffixWidth + 8,
          y: lineY,
          size,
          font: options.bold ? this.fonts.bold : this.fonts.regular,
          color: options.color ?? colors.black,
        })
      }
    })

    return valueLines.length
  }

  labelValueRow(items, options = {}) {
    const indent = options.indent ?? 18
    const gap = options.gap ?? 16
    const x = this.margin.left + indent
    const size = options.size ?? pdfTextSizes.body
    const lineHeight = options.lineHeight ?? size * 1.45
    const totalWidth = this.contentWidth - indent
    const explicitWidth = items.reduce((sum, item) => sum + (item.width ?? 0), 0)
    const flexibleItems = items.filter((item) => !item.width).length
    const flexibleWidth = flexibleItems
      ? Math.max(0, (totalWidth - explicitWidth - (gap * (items.length - 1))) / flexibleItems)
      : 0

    const measuredItems = items.map((item) => {
      const width = item.width ?? flexibleWidth
      const labelText = String(item.label ?? '')
      const valueText = displayValue(item.value, item.fallback)
      const labelWidth = this.textWidth(labelText, size, item.bold ?? options.bold)
      const suffixText = item.suffix ? String(item.suffix) : ''
      const suffixWidth = suffixText ? this.textWidth(suffixText, size, item.bold ?? options.bold) + 8 : 0
      const firstLineWidth = Math.max(0, width - suffixWidth - labelWidth - 9)
      const continuationWidth = Math.max(0, width - 4)
      const lineCount = valueText
        ? this.wrapTextWithLineWidths(valueText, [firstLineWidth, continuationWidth], size, item.bold ?? options.bold).length
        : 1

      return { ...item, width, lineCount }
    })
    const height = Math.max(1, ...measuredItems.map((item) => item.lineCount)) * lineHeight

    this.ensureSpace(height + 2)
    let currentX = x
    measuredItems.forEach((item) => {
      const width = item.width
      this.drawInlineField(currentX, width, item.label, item.value, { ...options, ...item, size, lineHeight })
      currentX += width + gap
    })
    this.y -= height
  }

  paragraph(text, options = {}) {
    const indent = options.indent ?? 0
    this.drawText(text, {
      x: this.margin.left + indent,
      maxWidth: options.maxWidth ?? this.contentWidth - indent,
      size: options.size ?? pdfTextSizes.body,
      bold: options.bold,
    })
  }

  fixedLines(lines, options = {}) {
    const indent = options.indent ?? 0
    const size = options.size ?? pdfTextSizes.body
    const lineHeight = options.lineHeight ?? size * 1.25
    const x = this.margin.left + indent
    const height = Math.max(lineHeight, lines.length * lineHeight)

    this.ensureSpace(height + 2)
    lines.forEach((line, index) => {
      this.page.drawText(line, {
        x,
        y: this.y - size - (index * lineHeight),
        size,
        font: options.bold ? this.fonts.bold : this.fonts.regular,
        color: options.color ?? colors.black,
      })
    })
    this.y -= height
  }

  checkboxOptionRows(label, rows, options = {}) {
    const indent = options.indent ?? 30
    const optionIndent = options.optionIndent ?? 112
    const size = options.size ?? pdfTextSizes.body
    const lineHeight = options.lineHeight ?? size * 1.45
    const boxSize = options.boxSize ?? 9
    const labelX = this.margin.left + indent
    const optionX = this.margin.left + optionIndent
    const textX = optionX + boxSize + 6
    const maxWidth = this.contentWidth - optionIndent - boxSize - 6

    this.ensureSpace((rows.length * lineHeight) + 2)
    this.page.drawText(label, {
      x: labelX,
      y: this.y - size,
      size,
      font: options.bold ? this.fonts.bold : this.fonts.regular,
      color: options.color ?? colors.black,
    })
    rows.forEach((row, index) => {
      const rowText = typeof row === 'string' ? row : row.label
      const checked = typeof row === 'string' ? false : Boolean(row.checked)
      const lineTextY = this.y - size - (index * lineHeight)
      const boxY = lineTextY
      this.page.drawRectangle({
        x: optionX,
        y: boxY,
        width: boxSize,
        height: boxSize,
        borderColor: colors.black,
        borderWidth: 0.8,
      })
      if (checked) {
        this.page.drawLine({
          start: { x: optionX + 2, y: boxY + 4 },
          end: { x: optionX + 4, y: boxY + 1 },
          thickness: 1,
          color: colors.black,
        })
        this.page.drawLine({
          start: { x: optionX + 4, y: boxY + 1 },
          end: { x: optionX + boxSize - 2, y: boxY + boxSize - 2 },
          thickness: 1,
          color: colors.black,
        })
      }
      this.drawTextAt(rowText, textX, lineTextY, {
        size,
        maxWidth,
        lineHeight,
      })
    })
    this.y -= rows.length * lineHeight
  }

  treatmentSystemLine(label, hasTreatmentSystem, value, options = {}) {
    const indent = options.indent ?? 30
    const size = options.size ?? pdfTextSizes.body
    const lineHeight = options.lineHeight ?? size * 1.45
    const boxSize = options.boxSize ?? 9
    const x = this.margin.left + indent
    const maxX = this.margin.left + this.contentWidth
    const labelText = String(label ?? '')
    const noneChecked = hasTreatmentSystem === 'ไม่มี'
    const hasChecked = hasTreatmentSystem === 'มี'
    let currentX = x

    this.ensureSpace(lineHeight + 2)
    this.page.drawText(labelText, {
      x: currentX,
      y: this.y - size,
      size,
      font: options.bold ? this.fonts.bold : this.fonts.regular,
      color: options.color ?? colors.black,
    })
    currentX += this.textWidth(labelText, size, options.bold) + 8

    const drawBoxLabel = (text, checked) => {
      const boxY = this.y - size
      this.page.drawRectangle({
        x: currentX,
        y: boxY,
        width: boxSize,
        height: boxSize,
        borderColor: colors.black,
        borderWidth: 0.8,
      })
      if (checked) {
        this.page.drawLine({
          start: { x: currentX + 2, y: boxY + 4 },
          end: { x: currentX + 4, y: boxY + 1 },
          thickness: 1,
          color: colors.black,
        })
        this.page.drawLine({
          start: { x: currentX + 4, y: boxY + 1 },
          end: { x: currentX + boxSize - 2, y: boxY + boxSize - 2 },
          thickness: 1,
          color: colors.black,
        })
      }
      currentX += boxSize + 5
      this.page.drawText(text, {
        x: currentX,
        y: this.y - size,
        size,
        font: options.bold ? this.fonts.bold : this.fonts.regular,
        color: options.color ?? colors.black,
      })
      currentX += this.textWidth(text, size, options.bold) + 12
    }

    drawBoxLabel('ไม่มี', noneChecked)
    drawBoxLabel('มี (ระบุ)', hasChecked)
    this.drawDottedLeader(currentX, maxX, this.y - size - 2)
    const valueText = displayValue(value)
    if (valueText) {
      this.page.drawText(valueText, {
        x: currentX + 2,
        y: this.y - size,
        size,
        font: options.bold ? this.fonts.bold : this.fonts.regular,
        color: options.color ?? colors.black,
      })
    }
    this.y -= lineHeight
  }

  table(columns, rows, options = {}) {
    const fontSize = options.fontSize ?? pdfTextSizes.table
    const rowPadding = options.rowPadding ?? 5
    const headerHeight = options.headerHeight ?? 28
    const widths = columns.map((column) => column.width)
    const tableWidth = widths.reduce((sum, width) => sum + width, 0)
    const x = options.x ?? this.margin.left + ((this.contentWidth - tableWidth) / 2)

    const drawRow = (cells, rowHeight, yTop, header = false) => {
      let cellX = x
      cells.forEach((cell, index) => {
        const width = widths[index]
        this.page.drawRectangle({
          x: cellX,
          y: yTop - rowHeight,
          width,
          height: rowHeight,
          borderColor: colors.border,
          borderWidth: 0.7,
          color: options.headerFill === false || !header ? colors.white : colors.headerFill,
        })
        this.drawTextAt(displayValue(cell), cellX + rowPadding, yTop - rowPadding - fontSize, {
          size: fontSize,
          bold: header,
          maxWidth: width - (rowPadding * 2),
          lineHeight: fontSize * 1.35,
        })
        cellX += width
      })
    }

    const headerCells = columns.map((column) => column.label)
    this.ensureSpace(headerHeight + 12)
    drawRow(headerCells, headerHeight, this.y, true)
    this.y -= headerHeight

    const displayRows = rows.length ? rows : [columns.map(() => '')]
    displayRows.forEach((row) => {
      const cellLineCounts = row.map((cell, index) =>
        this.wrapText(displayValue(cell), widths[index] - (rowPadding * 2), fontSize).length,
      )
      const rowHeight = Math.max(options.minRowHeight ?? 24, Math.max(...cellLineCounts) * fontSize * 1.35 + (rowPadding * 2))

      this.ensureSpace(rowHeight + 4)
      drawRow(row, rowHeight, this.y)
      this.y -= rowHeight
    })
    this.space(options.after ?? 10)
  }

  drawEmbeddedImage(image, options = {}) {
    const indent = options.indent ?? 30
    const maxWidth = options.maxWidth ?? this.contentWidth - indent
    const isLandscape = image.width >= image.height
    const targetMaxWidth = isLandscape ? maxWidth : maxWidth / 2
    const x = this.margin.left + indent
    const scale = Math.min(targetMaxWidth / image.width, 1)
    const width = image.width * scale
    const height = image.height * scale

    this.ensureSpace(height + 8)
    this.page.drawImage(image, {
      x,
      y: this.y - height,
      width,
      height,
    })
    this.y -= height + 8
  }

  cemsInstrumentTable(columns, rows, options = {}) {
    const fontSize = options.fontSize ?? 10.8
    const headerFontSize = options.headerFontSize ?? 10.8
    const rowPadding = options.rowPadding ?? 4
    const widths = columns.map((column) => column.width)
    const tableWidth = widths.reduce((sum, width) => sum + width, 0)
    const x = options.x ?? this.margin.left + ((this.contentWidth - tableWidth) / 2)
    const groupHeaderHeight = options.groupHeaderHeight ?? 24
    const childHeaderHeight = options.childHeaderHeight ?? 68
    const headerHeight = groupHeaderHeight + childHeaderHeight
    const rowHeight = options.rowHeight ?? 30
    const reportingStartIndex = options.reportingStartIndex === null ? null : (options.reportingStartIndex ?? 6)
    const reportingWidth = reportingStartIndex === null ? 0 : widths.slice(reportingStartIndex).reduce((sum, width) => sum + width, 0)

    const drawCellBox = (cellX, yTop, width, height) => {
      this.page.drawRectangle({
        x: cellX,
        y: yTop - height,
        width,
        height,
        borderColor: colors.border,
        borderWidth: 0.7,
        color: colors.white,
      })
    }

    const drawCheckbox = (cellX, yTop, width, height, checked = false) => {
      drawCellBox(cellX, yTop, width, height)

      if (!checked) {
        return
      }

      const boxSize = 7
      const boxX = cellX + ((width - boxSize) / 2)
      const boxY = yTop - ((height + boxSize) / 2)
      this.page.drawLine({
        start: { x: boxX + 1.4, y: boxY + 3.4 },
        end: { x: boxX + 3, y: boxY + 1.6 },
        thickness: 0.9,
        color: colors.black,
      })
      this.page.drawLine({
        start: { x: boxX + 3, y: boxY + 1.6 },
        end: { x: boxX + 5.9, y: boxY + 5.6 },
        thickness: 0.9,
        color: colors.black,
      })
    }

    const drawCell = (cellX, yTop, width, height, text, { header = false } = {}) => {
      drawCellBox(cellX, yTop, width, height)

      const size = header ? headerFontSize : fontSize
      const lines = String(text ?? '').split('\n')
      const lineHeight = size * 1.35
      const totalTextHeight = lines.length * lineHeight
      const firstLineY = yTop - ((height - totalTextHeight) / 2) - size

      lines.forEach((line, index) => {
        if (header && line === 'O2 @ 7 %') {
          const subscriptSize = size * 0.68
          const mainFont = this.fonts.bold
          const subscriptText = '2'
          const restText = ' @ 7 %'
          const totalWidth = this.textWidth('O', size, true)
            + this.textWidth(subscriptText, subscriptSize, true)
            + this.textWidth(restText, size, true)
          const startX = cellX + Math.max(rowPadding, (width - totalWidth) / 2)
          const baseY = firstLineY - (index * lineHeight)
          this.page.drawText('O', {
            x: startX,
            y: baseY,
            size,
            font: mainFont,
            color: colors.black,
          })
          this.page.drawText(subscriptText, {
            x: startX + this.textWidth('O', size, true),
            y: baseY - 2.2,
            size: subscriptSize,
            font: mainFont,
            color: colors.black,
          })
          this.page.drawText(restText, {
            x: startX + this.textWidth('O', size, true) + this.textWidth(subscriptText, subscriptSize, true),
            y: baseY,
            size,
            font: mainFont,
            color: colors.black,
          })
          return
        }

        const lineWidth = this.textWidth(line, size, header)
        this.page.drawText(line, {
          x: cellX + Math.max(rowPadding, (width - lineWidth) / 2),
          y: firstLineY - (index * lineHeight),
          size,
          font: header ? this.fonts.bold : this.fonts.regular,
          color: colors.black,
        })
      })
    }

    this.ensureSpace(headerHeight + rowHeight + 12)

    let cellX = x
    if (reportingStartIndex === null) {
      columns.forEach((column) => {
        drawCell(cellX, this.y, column.width, headerHeight, column.label, { header: true })
        cellX += column.width
      })
    } else {
      columns.slice(0, reportingStartIndex).forEach((column) => {
        drawCell(cellX, this.y, column.width, headerHeight, column.label, { header: true })
        cellX += column.width
      })

      drawCell(cellX, this.y, reportingWidth, groupHeaderHeight, 'การรายงานค่า²', { header: true })
      let childX = cellX
      columns.slice(reportingStartIndex).forEach((column) => {
        drawCell(childX, this.y - groupHeaderHeight, column.width, childHeaderHeight, column.label, { header: true })
        childX += column.width
      })
    }
    this.y -= headerHeight

    const displayRows = rows.length ? rows : [columns.map(() => '')]
    displayRows.forEach((row) => {
      this.ensureSpace(rowHeight + 4)
      let rowX = x
      row.forEach((cell, index) => {
        if (reportingStartIndex !== null && index >= reportingStartIndex) {
          drawCheckbox(rowX, this.y, widths[index], rowHeight, Boolean(cell))
        } else {
          drawCell(rowX, this.y, widths[index], rowHeight, displayValue(cell))
        }
        rowX += widths[index]
      })
      this.y -= rowHeight
    })
    this.space(options.after ?? 10)
  }

  standardCriteriaAttachmentTable(parameters, options = {}) {
    const fontSize = options.fontSize ?? 11
    const headerFontSize = options.headerFontSize ?? 11
    const rowHeight = options.rowHeight ?? 22
    const headerTopHeight = options.headerTopHeight ?? 28
    const headerBottomHeight = options.headerBottomHeight ?? 24
    const widths = options.widths ?? [54, 55, 45, 74, 45, 55, 45, 74, 45]
    const tableWidth = widths.reduce((sum, width) => sum + width, 0)
    const x = options.x ?? this.margin.left + ((this.contentWidth - tableWidth) / 2)
    const drawCenteredText = (text, cellX, yTop, width, height, { bold = false, size = fontSize } = {}) => {
      const lines = this.wrapText(displayValue(text), width - 8, size, bold)
      const lineHeight = size * 1.25
      const totalTextHeight = lines.length * lineHeight
      const firstLineY = yTop - ((height - totalTextHeight) / 2) - size

      lines.forEach((line, index) => {
        const lineWidth = this.textWidth(line, size, bold)
        this.page.drawText(line, {
          x: cellX + Math.max(4, (width - lineWidth) / 2),
          y: firstLineY - (index * lineHeight),
          size,
          font: bold ? this.fonts.bold : this.fonts.regular,
          color: colors.black,
        })
      })
    }

    const drawCellBox = (cellX, yTop, width, height) => {
      this.page.drawRectangle({
        x: cellX,
        y: yTop - height,
        width,
        height,
        borderColor: colors.border,
        borderWidth: 0.7,
        color: colors.white,
      })
    }

    const drawCell = (cellX, yTop, width, height, text, options = {}) => {
      drawCellBox(cellX, yTop, width, height)
      drawCenteredText(text, cellX, yTop, width, height, options)
    }

    const drawComparisonSign = (cellX, centerY, sign) => {
      const signWidth = 2.5
      const signHeight = 2.5
      const midY = centerY - 1
      this.page.drawLine({
        start: { x: cellX + signWidth, y: midY + (signHeight / 2) },
        end: { x: cellX, y: midY },
        thickness: 0.45,
        color: colors.black,
      })
      this.page.drawLine({
        start: { x: cellX, y: midY },
        end: { x: cellX + signWidth, y: midY - (signHeight / 2) },
        thickness: 0.45,
        color: colors.black,
      })

      if (sign === 'lte') {
        this.page.drawLine({
          start: { x: cellX, y: centerY - 5 },
          end: { x: cellX + signWidth, y: centerY - 5 },
          thickness: 0.45,
          color: colors.black,
        })
      }

      return signWidth
    }

    const drawCriteriaCell = (cellX, yTop, width, height, criteria) => {
      drawCellBox(cellX, yTop, width, height)

      const size = fontSize
      const label = displayValue(criteria.label)
      const labelWidth = this.textWidth(label, size)
      const signWidth = 2.5
      const gap = 3
      const totalWidth = signWidth + gap + labelWidth + gap + signWidth
      const startX = cellX + Math.max(4, (width - totalWidth) / 2)
      const centerY = yTop - (height / 2)
      const textY = centerY - (size / 2) + 1

      drawComparisonSign(startX, centerY, criteria.leftSign)
      this.page.drawText(label, {
        x: startX + signWidth + gap,
        y: textY,
        size,
        font: this.fonts.regular,
        color: colors.black,
      })
      drawComparisonSign(startX + signWidth + gap + labelWidth + gap, centerY, criteria.rightSign)
    }

    const drawHeader = () => {
      const yTop = this.y
      drawCell(x, yTop, widths[0], headerTopHeight + headerBottomHeight, 'พารามิเตอร์', { bold: true, size: headerFontSize })
      const standardX = x + widths[0]
      const standardWidth = widths[1] + widths[2] + widths[3] + widths[4]
      const eiaX = standardX + standardWidth
      const eiaWidth = widths[5] + widths[6] + widths[7] + widths[8]
      drawCell(standardX, yTop, standardWidth, headerTopHeight, 'ตามประกาศ อก.', { bold: true, size: headerFontSize })
      drawCell(eiaX, yTop, eiaWidth, headerTopHeight, 'ตาม EIA', { bold: true, size: headerFontSize })

      let childX = standardX
      ;['ค่ามาตรฐาน', 'MIN', 'เกณฑ์มลพิษ', 'MAX', 'ค่ามาตรฐาน', 'MIN', 'เกณฑ์มลพิษ', 'MAX'].forEach((label, index) => {
        const width = widths[index + 1]
        drawCell(childX, yTop - headerTopHeight, width, headerBottomHeight, label, { bold: true, size: headerFontSize })
        childX += width
      })
      this.y -= headerTopHeight + headerBottomHeight
    }

    const drawParameterGroup = (parameter) => {
      const groupHeight = rowHeight * specialCriteriaRows.length
      if (this.y - groupHeight < this.margin.bottom) {
        this.addPage()
        drawHeader()
      }

      const yTop = this.y
      drawCell(x, yTop, widths[0], groupHeight, parameter.parameter)
      drawCell(
        x + widths[0],
        yTop,
        widths[1],
        groupHeight,
        parameter.standardCriteria?.standardValue,
      )
      drawCell(
        x + widths[0] + widths[1] + widths[2] + widths[3] + widths[4],
        yTop,
        widths[5],
        groupHeight,
        parameter.eiaCriteria?.standardValue,
      )

      specialCriteriaRows.forEach((criteriaLevel, index) => {
        const rowTop = yTop - (index * rowHeight)
        const standardRow = getCriteriaRow(parameter.standardCriteria, criteriaLevel.key)
        const eiaRow = getCriteriaRow(parameter.eiaCriteria, criteriaLevel.key)
        let cellX = x + widths[0] + widths[1]
        drawCell(cellX, rowTop, widths[2], rowHeight, standardRow.min)
        cellX += widths[2]
        drawCriteriaCell(cellX, rowTop, widths[3], rowHeight, criteriaLevel)
        cellX += widths[3]
        drawCell(cellX, rowTop, widths[4], rowHeight, standardRow.max)
        cellX += widths[4] + widths[5]
        drawCell(cellX, rowTop, widths[6], rowHeight, eiaRow.min)
        cellX += widths[6]
        drawCriteriaCell(cellX, rowTop, widths[7], rowHeight, criteriaLevel)
        cellX += widths[7]
        drawCell(cellX, rowTop, widths[8], rowHeight, eiaRow.max)
      })
      this.y -= groupHeight
    }

    this.ensureSpace(headerTopHeight + headerBottomHeight + rowHeight + 8)
    drawHeader()
    const displayParameters = parameters.length ? parameters : [{ parameter: '' }]
    displayParameters.forEach(drawParameterGroup)
    this.space(options.after ?? 10)
  }

  signature(name, position) {
    this.ensureSpace(100)
    const width = 250
    const x = this.width - this.margin.right - width
    const lines = [
      `ลงชื่อ ................................................ ผู้ให้ข้อมูล`,
      `( ${displayValue(name, '................................................')} )`,
      `ตำแหน่ง ${displayValue(position, '................................................')}`,
      `วันที่ ........../........../..........`,
    ]
    lines.forEach((line, index) => {
      this.drawTextAt(line, x, this.y - 16 - (index * 22), { size: pdfTextSizes.signature, maxWidth: width })
    })
    this.y -= 98
  }

  cemsInstrumentSignature(name, position, date = formatThaiDate()) {
    const size = pdfTextSizes.body - 2
    const lineHeight = 22
    const signatureX = this.width - this.margin.right - 245
    const signatureWidth = 235
    const yTop = this.y - 4
    const signatureTrailingText = 'ผู้ให้ข้อมูล'
    const signatureTrailingWidth = this.textWidth(signatureTrailingText, size)
    const fieldStartX = signatureX + Math.max(
      this.textWidth('ลงชื่อ ', size),
      this.textWidth('ตำแหน่ง ', size),
      this.textWidth('วันที่ ', size),
    ) + 4
    const fieldEndX = signatureX + signatureWidth - signatureTrailingWidth - 4

    this.ensureSpace(92)

    const drawSignatureLine = (label, value, y, trailingText = '', options = {}) => {
      const lineEndX = fieldEndX
      this.page.drawText(label, {
        x: signatureX,
        y,
        size,
        font: this.fonts.regular,
        color: colors.black,
      })
      this.drawDottedLeader(fieldStartX, lineEndX, y - 2)
      if (value) {
        const valueText = displayValue(value)
        const valueWidth = this.textWidth(valueText, size)
        const valueX = options.center
          ? fieldStartX + Math.max(2, ((lineEndX - fieldStartX - valueWidth) / 2))
          : fieldStartX + 2
        this.page.drawText(valueText, {
          x: valueX,
          y,
          size,
          font: this.fonts.regular,
          color: colors.black,
        })
      }
      if (trailingText) {
        this.page.drawText(trailingText, {
          x: fieldEndX + 4,
          y,
          size,
          font: this.fonts.regular,
          color: colors.black,
        })
      }
    }

    drawSignatureLine('ลงชื่อ ', '', yTop - size, signatureTrailingText)
    const openParenText = '( '
    const closeParenText = ' )'
    const openParenWidth = this.textWidth(openParenText, size)
    const closeParenWidth = this.textWidth(closeParenText, size)
    const parenthesisLineStartX = fieldStartX + openParenWidth
    const parenthesisLineEndX = fieldEndX - closeParenWidth
    this.page.drawText('( ', {
      x: fieldStartX,
      y: yTop - size - lineHeight,
      size,
      font: this.fonts.regular,
      color: colors.black,
    })
    this.drawDottedLeader(parenthesisLineStartX, parenthesisLineEndX, yTop - size - lineHeight - 2)
    if (name) {
      const nameText = displayValue(name)
      const nameWidth = this.textWidth(nameText, size)
      this.page.drawText(displayValue(name), {
        x: parenthesisLineStartX + Math.max(2, ((parenthesisLineEndX - parenthesisLineStartX - nameWidth) / 2)),
        y: yTop - size - lineHeight,
        size,
        font: this.fonts.regular,
        color: colors.black,
      })
    }
    this.page.drawText(closeParenText, {
      x: fieldEndX - closeParenWidth,
      y: yTop - size - lineHeight,
      size,
      font: this.fonts.regular,
      color: colors.black,
    })
    drawSignatureLine('ตำแหน่ง ', position, yTop - size - (lineHeight * 2), '', { center: true })
    drawSignatureLine('วันที่ ', date, yTop - size - (lineHeight * 3), '', { center: true })
    this.y -= 92
  }

  footer() {
    const totalPages = this.pages.length
    this.pages.forEach((page, index) => {
      const text = `${index + 1} / ${totalPages}`
      page.drawText(text, {
        x: this.width - this.margin.right - this.textWidth(text, pdfTextSizes.footer),
        y: 24,
        size: pdfTextSizes.footer,
        font: this.fonts.regular,
        color: colors.muted,
      })
    })
  }
}

function getRequestContext(request) {
  const isWpms = request?.type === 'WPMS' || request?.systemType === 'WPMS'
  const factory = request?.factory ?? {}
  const points = Array.isArray(request?.measurementPoints) ? request.measurementPoints : []
  const point = points[0] ?? {}
  const details = point.details ?? {}
  const instruments = point.measurementInstruments ?? {}
  const instrumentParameters = Array.isArray(instruments.parameters) ? instruments.parameters : []
  const documentsAndImages = mergeDocumentItems(
    getDocumentItemsFromSource(point),
    getDocumentItemsFromSource(request),
    getDocumentItemsFromSource(request?.request),
  )
  const fallbackParameterLabels = [
    ...normalizeArrayValue(details.eligibleParameters),
    ...normalizeArrayValue(details.connectedParameters),
    ...normalizeArrayValue(details.pendingParameters),
    ...normalizeArrayValue(details.requestedParameters),
    ...normalizeArrayValue(point.parameters),
  ]
  const documentParameters = instrumentParameters.length
    ? instrumentParameters
    : Array.from(new Set(fallbackParameterLabels.filter(Boolean))).map((parameter) => ({ parameter }))

  return {
    isWpms,
    factory,
    point,
    details,
    instruments,
    documentsAndImages,
    documentParameters,
    contactPersons: Array.isArray(request?.contactPersons) ? request.contactPersons : [],
    notificationEmails: Array.isArray(request?.notificationEmails) ? request.notificationEmails : [],
    officerNotificationEmails: Array.isArray(request?.officerNotificationEmails) ? request.officerNotificationEmails : [],
  }
}

const documentCollectionKeys = [
  'documentsAndImages',
  'documentImages',
  'documents',
  'attachments',
  'files',
]

function normalizeDocumentItem(document = {}) {
  if (!document || typeof document !== 'object') {
    return null
  }

  const files = Array.isArray(document.files)
    ? document.files.map((file) => ({
        ...file,
        fileName: file.fileName ?? file.originalFileName ?? file.name ?? file.storedFileName ?? '',
        fileUrl: file.fileUrl ?? file.url ?? file.storageUrl ?? file.path ?? '',
        fileType: file.fileType ?? file.mimeType ?? file.type ?? '',
        fileSize: file.fileSize ?? file.size ?? null,
      }))
    : document.files

  return {
    ...document,
    title: document.title ?? document.documentTitle ?? document.documentType ?? document.category ?? '',
    link: document.link ?? document.urlLink ?? document.documentLink ?? '',
    fileName: document.fileName ?? document.originalFileName ?? document.name ?? document.storedFileName ?? '',
    fileUrl: document.fileUrl ?? document.url ?? document.storageUrl ?? document.path ?? '',
    fileType: document.fileType ?? document.mimeType ?? document.type ?? '',
    fileSize: document.fileSize ?? document.size ?? null,
    ...(Array.isArray(files) ? { files } : {}),
  }
}

function getDocumentItemsFromSource(source = {}) {
  return documentCollectionKeys
    .flatMap((key) => (Array.isArray(source?.[key]) ? source[key] : []))
    .map(normalizeDocumentItem)
    .filter(Boolean)
}

function mergeDocumentItems(...documentGroups) {
  const seen = new Set()

  return documentGroups.flat().filter((document) => {
    const key = [
      document.id,
      document.title,
      document.link,
      document.fileUrl,
      document.fileName,
    ].filter(Boolean).join('|')

    if (key && seen.has(key)) {
      return false
    }

    if (key) {
      seen.add(key)
    }

    return true
  })
}

function renderGeneralFactorySection(layout, request, context) {
  const { factory } = context
  layout.sectionTitle('1. ข้อมูลทั่วไปของโรงงาน')
  layout.labelValueRow([
    { label: 'ชื่อโรงงาน : ', value: request?.factoryName ?? factory.factoryName },
    { label: 'เลขทะเบียน : ', value: formatFactoryRegistration(request, factory) },
  ])
  layout.labelValueRow([
    { label: 'ลำดับประเภทโรงงาน (หลัก) : ', value: request?.industryMainOrder ?? factory.industryMainOrder },
    { label: 'ลำดับประเภทโรงงาน (รอง) : ', value: request?.industrySubOrder ?? factory.industrySubOrder },
  ])
  layout.labelValue('ประกอบกิจการ : ', request?.businessActivity ?? factory.businessActivity)
  layout.labelValue('เขตประกอบการ/นิคมอุตสาหกรรม (ถ้ามี) : ', request?.industrialEstate ?? factory.industrialEstate)
  layout.labelValue('การประเมินผลกระทบสิ่งแวดล้อม : ', request?.eia ?? factory.eia)
  layout.labelValue('ที่ตั้ง เลขที่ : ', request?.address ?? factory.address)
  layout.labelValueRow([
    { label: 'พิกัดโรงงาน ละติจูด : ', value: request?.latitude ?? factory.latitude },
    { label: 'ลองจิจูด : ', value: request?.longitude ?? factory.longitude },
  ])
}

function renderContactsSection(layout, context) {
  layout.sectionTitle('2. ข้อมูลผู้ติดต่อประสานงาน')
  const contacts = context.contactPersons.filter(hasObjectValue)
  const displayContacts = contacts.length ? contacts : [{}]

  displayContacts.forEach((contact, index) => {
    layout.labelValue(`2.${index + 1} ชื่อผู้ติดต่อประสานงาน : `, contact.name)
    layout.labelValueRow([
      { label: 'ตำแหน่ง : ', value: contact.position },
      { label: 'อีเมล : ', value: contact.email },
    ])
    layout.drawInlineField(layout.margin.left + 18, (layout.contentWidth - 18 - 16) / 2, 'โทรศัพท์ : ', contact.phone)
    layout.y -= pdfTextSizes.body * 1.45
  })
}

function renderEmailsSection(layout, context) {
  layout.sectionTitle('3. อีเมลสำหรับแจ้งเตือนค่าเกินมาตรฐาน')
  const notificationEmails = nonEmptyList(context.notificationEmails)
  const officerNotificationEmails = nonEmptyList(context.officerNotificationEmails)

  layout.paragraph('3.1 สำหรับโรงงาน', { indent: 18, bold: true })
  ;(notificationEmails.length ? notificationEmails : ['']).forEach((email, index) => (
    layout.labelValue(`${index + 1}) `, email, { indent: 28 })
  ))
  layout.paragraph('3.2 สำหรับเจ้าหน้าที่', { indent: 18, bold: true })
  ;(officerNotificationEmails.length ? officerNotificationEmails : ['']).forEach((email, index) => (
    layout.labelValue(`${index + 1}) `, email, { indent: 28 })
  ))
}

function renderInstrumentTable(layout, parameters, isWpms) {
  const columns = isWpms
    ? [
        { label: 'พารามิเตอร์ที่ขอเชื่อมต่อ', width: 94 },
        { label: 'เทคนิคตรวจวัด', width: 82 },
        { label: 'ช่วงการวัด', width: 68 },
        { label: 'ยี่ห้อเครื่องมือ', width: 76 },
        { label: 'ผู้จำหน่ายเครื่องมือ', width: 82 },
        { label: 'มาตรฐาน EIA', width: 66 },
      ]
    : [
        { label: 'พารามิเตอร์\nที่ขอเชื่อมต่อ', width: 86 },
        { label: 'เทคนิคตรวจวัด', width: 56 },
        { label: 'ช่วงการวัด', width: 46 },
        { label: 'ยี่ห้อเครื่องมือ', width: 66 },
        { label: 'ผู้จำหน่ายเครื่องมือ', width: 68 },
        { label: 'มาตรฐาน\nEIA', width: 50 },
        { label: 'สภาวะ\nมาตรฐาน', width: 52 },
        { label: 'สภาวะแห้ง\n(Dry basis)', width: 58 },
        { label: 'O2 @ 7 %\nor Excess\nAir 50 %', width: 50 },
      ]
  const rows = parameters.map((parameter) => (
    isWpms
      ? [
          parameter.parameter,
          parameter.technique,
          parameter.range,
          parameter.brand,
          parameter.supplier,
          getEiaStandardDisplay(parameter),
        ]
      : [
          parameter.parameter,
          parameter.technique,
          parameter.range,
          parameter.brand,
          parameter.supplier,
          getEiaStandardDisplay(parameter),
          parameter.standardCondition ? '✓' : '',
          parameter.dryBasis ? '✓' : '',
          parameter.oxygenOrExcessAir ? '✓' : '',
        ]
  ))
  if (!isWpms) {
    layout.cemsInstrumentTable(columns, rows, {
      fontSize: 11,
      headerFontSize: 11,
      rowHeight: 22,
      x: 34,
    })
    return
  }

  layout.cemsInstrumentTable(columns, rows, {
    fontSize: 11,
    headerFontSize: 11,
    rowHeight: 22,
    groupHeaderHeight: 0,
    childHeaderHeight: 58,
    reportingStartIndex: null,
  })
}

function renderStandardCriteriaAttachment(layout, parameters) {
  layout.addPage()
  layout.sectionTitle('รายละเอียดเกณฑ์มาตรฐาน')
  layout.space(10)
  layout.standardCriteriaAttachmentTable(parameters)
}

function renderDeviceConfigPages(layout, request) {
  const deviceConfigs = getRequestDeviceConfigs(request)

  if (!deviceConfigs.length) {
    return
  }

  const devices = getDeviceConfigDevices(deviceConfigs)
  const channels = getDeviceConfigChannels(deviceConfigs)
  const standardTableX = layout.margin.left + ((layout.contentWidth - 492) / 2)
  layout.addPage()
  layout.sectionTitle('การตั้งค่าอุปกรณ์')
  layout.paragraph('ข้อมูลอุปกรณ์', { indent: 18, bold: true })
  layout.table(
    [
      { label: 'รหัสจุดตรวจวัด', width: 92 },
      { label: 'รหัสอุปกรณ์', width: 100 },
      { label: 'Protocol', width: 80 },
      { label: 'รายละเอียดการเชื่อมต่อ', width: 220 },
    ],
    devices.map((device) => [
      device.stationId,
      device.deviceCode,
      device.protocol,
      formatDeviceSettings(device.settings),
    ]),
    { x: standardTableX, fontSize: 11, minRowHeight: 30, headerHeight: 34, headerFill: false },
  )
  layout.paragraph('การเชื่อมต่อพารามิเตอร์', { indent: 18, bold: true })
  layout.table(
    [
      { label: 'รหัสอุปกรณ์', width: 58 },
      { label: 'Address ID', width: 54 },
      { label: 'พารามิเตอร์', width: 62 },
      { label: 'สถานะ', width: 52 },
      { label: 'Min', width: 42 },
      { label: 'Max', width: 42 },
      { label: 'รูปแบบค่า', width: 70 },
      { label: 'Offset', width: 42 },
      { label: 'Encoding', width: 70 },
    ],
    channels.map((channel) => {
      const valueRange = channel.valueRange ?? {}

      return [
        channel.deviceCode,
        channel.addressId,
        channel.dataType,
        channel.status,
        valueRange.min,
        valueRange.max,
        channel.valueFormat,
        channel.offset,
        channel.encoding,
      ]
    }),
    { x: standardTableX, fontSize: 11, minRowHeight: 28, headerHeight: 32, headerFill: false },
  )
}

function getDocumentFileName(document = {}) {
  if (Array.isArray(document.files)) {
    return document.files
      .map((file) => file.fileName ?? file.originalFileName ?? file.name ?? file.storedFileName)
      .filter(Boolean)
      .join(', ')
  }

  return document.fileName ?? document.originalFileName ?? document.name ?? document.storedFileName ?? ''
}

function expandDocumentFiles(document = {}) {
  if (!Array.isArray(document.files) || !document.files.length) {
    return [document]
  }

  return document.files.map((file, index) => ({
    ...document,
    ...file,
    title: document.title,
    description: document.description,
    link: index === 0 ? document.link : '',
  }))
}

async function renderDocumentAttachmentList(layout, documents) {
  const expandedDocuments = documents.flatMap(expandDocumentFiles)
  const listItems = expandedDocuments.flatMap((document) => {
    const items = []
    const linkUrl = normalizeDocumentUrl(document.link)
    const fileName = getDocumentFileName(document)

    if (linkUrl) {
      items.push(`Link: ${linkUrl}`)
    }

    if (fileName && !isImageDocument(document)) {
      items.push(fileName)
    }

    return items
  })

  listItems.forEach((item, index) => {
    layout.labelValue(`${index + 1}) `, item, { indent: 30, leader: false })
  })

  const imageDocuments = expandedDocuments.filter(isImageDocument)
  for (const document of imageDocuments) {
    const imageUrl = getDocumentImageUrl(document)
    if (!imageUrl) {
      continue
    }

    try {
      const image = await embedImageFromUrl(layout.pdfDoc, imageUrl, document)
      if (image) {
        layout.drawEmbeddedImage(image, { indent: 30 })
      }
    } catch {
      // Ignore images that cannot be loaded into the PDF preview.
    }
  }
}

function getDocumentsByTitles(documentsAndImages, titles) {
  return documentsAndImages.filter((document) => titles.includes(document?.title))
}

async function renderCemsDocumentSections(layout, documentsAndImages) {
  const items = [
    {
      label: 'ข้อมูลรายละเอียดการรายงานค่าที่สภาวะมาตรฐาน',
      title: 'ข้อมูลรายละเอียดการรายงานค่าที่สภาวะมาตรฐาน',
      descriptionLines: [
        'ให้แสดงรายละเอียดหรือแนบเอกสารหรือรูปภาพหน้าโปรแกรมของเครื่องมือที่แสดงให้เห็นถึงการคำนวณ',
        'และการรายงานค่าของมลพิษในอากาศเสียที่สภาวะมาตรฐาน ความดัน 1 บรรยากาศ หรือ 760 มิลลิเมตร',
        'ปรอท อุณหภูมิ 25 องศาเซลเซียสที่สภาวะแห้ง (Dry basis) โดยมีปริมาตรอากาศส่วนเกินในการเผาไหม้',
        '(Excess air) ร้อยละ 50 หรือมีปริมาตรออกซิเจนในอากาศเสีย ร้อยละ 7 หรือ ปริมาตรออกซิเจนในอากาศเสีย',
        'ณ สภาวะจริงในขณะตรวจวัด (การเผาไหม้แบบระบบปิดหรือไม่มีการเผาไหม้)',
      ],
    },
    {
      label: 'รายงานผลการทำ RATA หรือ อื่นๆ ที่เทียบเท่า ของระบบ CEMS ครั้งล่าสุด (สามารถแนบไฟล์เอกสาร หรือ QR Code ได้)',
      title: 'รายงานผลการทำ RATA หรือ อื่นๆ ที่เทียบเท่า ของระบบ CEMS ครั้งล่าสุด',
    },
    { label: 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน', title: 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน' },
    { label: 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท', title: 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท' },
    { label: 'ภาพถ่ายปล่อง', title: 'ภาพถ่ายปล่อง' },
    { label: 'ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (CEMS)', title: 'ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (CEMS)' },
  ]

  layout.addPage()
  layout.sectionTitle('เอกสารและรูปภาพ')
  for (const item of items) {
    layout.paragraph(item.label, { indent: 18, bold: true })
    if (item.descriptionLines) {
      layout.fixedLines(item.descriptionLines, { indent: 30, lineHeight: 19 })
    }
    await renderDocumentAttachmentList(layout, getDocumentsByTitles(documentsAndImages, [item.title]))
  }
}

async function renderWpmsDocumentSections(layout, documentsAndImages) {
  const items = [
    { label: 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน', titles: ['ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน'] },
    { label: 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท', titles: ['สัญลักษณ์ของโรงงานหรือโลโก้บริษัท'] },
    { label: 'ภาพถ่ายระบบบำบัด', titles: ['ภาพถ่ายระบบบำบัด', 'ระบบบำบัด'] },
    { label: 'ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (WPMS)', titles: ['ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (WPMS)'] },
  ]

  layout.addPage()
  layout.sectionTitle('เอกสารและรูปภาพ')
  for (const item of items) {
    layout.paragraph(item.label, { indent: 18, bold: true })
    await renderDocumentAttachmentList(layout, getDocumentsByTitles(documentsAndImages, item.titles))
  }
}

async function renderWpms(layout, request, context) {
  const { details, point, instruments, documentParameters, signatureDate } = context
  const treatmentSystemLabel = joinList(normalizeArrayValue(details.treatmentSystem))
  const wpmsTreatmentSystem = firstDefinedValue(details.treatmentSystemOther, treatmentSystemLabel)

  layout.title([
    { text: 'แบบบันทึกข้อมูลโรงงานสำหรับการขอเชื่อมต่อระบบเฝ้าระวังและเตือนภัย', size: pdfTextSizes.title },
    { text: 'มลพิษระยะไกล (Digital Pollution Online Monitoring System : D-POMS)', size: pdfTextSizes.title },
    { text: '(สำหรับระบบเฝ้าระวังมลพิษน้ำระยะไกล (Water Pollution Monitoring : WPMS))', size: pdfTextSizes.subtitle },
  ])
  renderGeneralFactorySection(layout, request, context)
  renderContactsSection(layout, context)
  renderEmailsSection(layout, context)
  layout.addPage()
  layout.sectionTitle('4. รายละเอียดจุดตรวจวัด')
  layout.paragraph('4.1 อัตราการระบายน้ำทิ้ง (Flow Rate)', { indent: 18 })
  layout.labelValue('4.1.1 อัตราการระบายน้ำทิ้ง (Flow Rate) เฉลี่ย : ', details.averageWastewaterDischarge ?? details.averageDischarge, { indent: 30, suffix: 'm³/d' })
  layout.labelValue('4.1.2 อัตราการระบายน้ำทิ้ง (Flow Rate) ต่ำสุด : ', details.minWastewaterDischarge ?? details.minDischarge, { indent: 30, suffix: 'm³/d' })
  layout.labelValue('4.1.3 อัตราการระบายน้ำทิ้ง (Flow Rate) สูงสุด : ', details.maxWastewaterDischarge ?? details.maxDischarge, { indent: 30, suffix: 'm³/d' })
  layout.treatmentSystemLine('4.2 ระบบบำบัด :', details.hasTreatmentSystem, wpmsTreatmentSystem, { indent: 18 })
  layout.labelValue('ปริมาณรองรับน้ำเสียสูงสุดของระบบบำบัด : ', firstDefinedValue(details.maxTreatmentCapacity, details.treatmentCapacity), { indent: 30 })
  layout.labelValueRow([
    { label: '4.3 พิกัดจุดที่ติดตั้งเครื่องมือตรวจวัด ละติจูด : ', value: details.instrumentLatitude ?? point.instrumentLatitude ?? point.latitude, width: 310 },
    { label: 'ลองจิจูด : ', value: details.instrumentLongitude ?? point.instrumentLongitude ?? point.longitude },
  ])
  layout.labelValueRow([
    { label: '4.4 พิกัดจุดระบายน้ำทิ้งออกนอกโรงงาน ละติจูด : ', value: details.dischargeLatitude ?? details.outfallLatitude ?? point.latitude, width: 330 },
    { label: 'ลองจิจูด : ', value: details.dischargeLongitude ?? details.outfallLongitude ?? point.longitude },
  ])
  layout.labelValue('4.5 แหล่งกำเนิดน้ำเสีย : ', firstDefinedValue(details.wastewaterSource, details.wastewaterOrigin))
  layout.labelValue('4.6 แหล่งรองรับน้ำทิ้ง : ', firstDefinedValue(details.dischargeReceivingSource, details.receivingSource))
  layout.labelValue('4.7 อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ : ', firstDefinedValue(details.connectionDeviceOther, details.connectionDevice))
  layout.addPage()
  layout.sectionTitle('5. รายละเอียดเครื่องมือตรวจวัด')
  layout.labelValueRow([
    { label: 'อุปกรณ์แปลงสัญญาณ (Converter) ยี่ห้อ : ', value: instruments.converterBrand, width: 300 },
    { label: 'รุ่น : ', value: instruments.converterModel },
  ])
  layout.space(8)
  renderInstrumentTable(layout, documentParameters, true)
  layout.cemsInstrumentSignature(
    request?.informationProviderName ?? details.informationProviderName,
    request?.informationProviderPosition ?? details.informationProviderPosition,
    signatureDate,
  )
  renderStandardCriteriaAttachment(layout, documentParameters)
  renderDeviceConfigPages(layout, request)
  await renderWpmsDocumentSections(layout, context.documentsAndImages)
}

async function renderCems(layout, request, context) {
  const { details, point, instruments, documentParameters, signatureDate } = context
  const systemName = 'ระบบตรวจวัดคุณภาพอากาศจากปล่องแบบอัตโนมัติอย่างต่อเนื่อง'
  const systemCode = 'Continuous Emission Monitoring Systems : CEMS'

  layout.title([
    { text: 'แบบบันทึกข้อมูลโรงงานสำหรับการขอเชื่อมต่อระบบเฝ้าระวัง', size: pdfTextSizes.title },
    { text: 'และเตือนภัยมลพิษระยะไกล (Digital Pollution Online Monitoring System : D-POMS)', size: pdfTextSizes.title },
    { text: `(${systemName}`, size: pdfTextSizes.subtitle },
    { text: `${systemCode})`, size: pdfTextSizes.subtitle },
  ])
  renderGeneralFactorySection(layout, request, context)
  renderContactsSection(layout, context)
  renderEmailsSection(layout, context)
  layout.addPage()
  layout.sectionTitle('4. รายละเอียดจุดตรวจวัด')
  layout.paragraph('4.1 รายละเอียดของหน่วยที่ติดตั้ง CEMS', { indent: 22, bold: true })
  layout.labelValue('4.1.1 รหัสจุดตรวจวัด : ', point.pointCode ?? request?.monitoringPointCode, { indent: 38 })
  layout.labelValue('4.1.2 ชื่อจุดตรวจวัด : ', point.pointName, { indent: 38 })
  layout.labelValue('4.1.3 ประเภทของหน่วยการผลิต : ', details.productionUnitType, { indent: 38 })
  layout.labelValue('4.1.4 กำลังการผลิตต่อหน่วย : ', details.productionCapacity ?? formatProductionCapacity(details.productionCapacityValue, details.productionCapacityUnit), { indent: 38 })
  layout.paragraph('4.2 การติดตั้ง CEMS', { indent: 18, bold: true })
  layout.labelValue('4.2.1 เข้าข่ายต้องติดตั้ง CEMS ตามกฎหมาย : ', details.cemsInstallationRequiredOther ?? details.cemsInstallationRequiredBy, { indent: 30 })
  layout.labelValue('4.2.2 เข้าข่ายตามบัญชีแนบท้ายลำดับที่ : ', joinList(details.legalAnnexNo), { indent: 30 })
  layout.labelValue('4.2.3 พารามิเตอร์ที่เข้าข่าย : ', joinList(details.eligibleParameters ?? point.parameters), { indent: 30 })
  layout.labelValue('4.2.4 พารามิเตอร์ที่ได้รับการยกเว้นตามประกาศฯ ข้อ : ', joinList(details.exemptedParameterRegulationClauses), { indent: 30 })
  layout.labelValue('พารามิเตอร์ : ', joinList(details.exemptedParameters), { indent: 30 })
  layout.labelValue('4.2.5 พารามิเตอร์ที่เชื่อมต่อแล้ว : ', joinList(details.connectedParameters), { indent: 30 })
  layout.labelValue('4.2.6 พารามิเตอร์ที่ยังไม่เชื่อมต่อ : ', joinList(details.pendingParameters ?? point.parameters), { indent: 30 })
  layout.labelValue('4.2.7 พารามิเตอร์ที่ติดตั้งแบบ Time sharing : ', joinList(details.timeSharingParameters), { indent: 30 })
  layout.labelValue('ร่วมกับปล่อง : ', details.sharedStackCode ?? details.sharedStack, { indent: 30 })
  layout.paragraph('4.3 รายละเอียดปล่อง', { indent: 18, bold: true })
  layout.checkboxOptionRows('4.3.1 ลักษณะปล่อง :', [
    {
      label: `วงกลม (เส้นผ่านศูนย์กลาง ${displayValue(details.stackDiameter, '............')} เมตร)`,
      checked: details.stackShape === 'วงกลม',
    },
    {
      label: `สี่เหลี่ยม (กว้าง ${displayValue(details.stackWidth, '............')} เมตร / ยาว ${displayValue(details.stackLength, '............')} เมตร)`,
      checked: details.stackShape === 'สี่เหลี่ยม',
    },
    {
      label: `อื่นๆ (ระบุ) ${displayValue(details.stackShapeOther, '....................................................')}`,
      checked: details.stackShape === 'อื่นๆ',
    },
  ], { indent: 30, optionIndent: 136, boxSize: 9 })
  layout.labelValueRow([
    { label: '4.3.2 ความสูงปล่อง : ', value: details.stackHeight, width: 220, suffix: 'เมตร' },
    { label: 'ความสูงของจุดตรวจวัด : ', value: details.monitoringHeight, suffix: 'เมตร' },
  ], { indent: 30 })
  layout.paragraph('4.3.3 อัตราการระบายอากาศ (Flow Rate)', { indent: 30 })
  layout.labelValue('4.3.3.1 อัตราการระบายอากาศ (Flow Rate) เฉลี่ย : ', details.averageFlowRate, { indent: 48, suffix: 'm3/hr' })
  layout.labelValue('4.3.3.2 อัตราการระบายอากาศ (Flow Rate) ต่ำสุด : ', details.minFlowRate, { indent: 48, suffix: 'm3/hr' })
  layout.labelValue('4.3.3.3 อัตราการระบายอากาศ (Flow Rate) สูงสุด : ', details.maxFlowRate, { indent: 48, suffix: 'm3/hr' })
  layout.labelValueRow([
    { label: '4.3.4 เชื้อเพลิงหลักที่ใช้ : ', value: details.primaryFuelOther || details.primaryFuel, width: 220 },
    { label: 'ร้อยละโดยประมาณ : ', value: details.primaryFuelPercent },
  ], { indent: 30 })
  layout.labelValue('4.3.5 เชื้อเพลิงรอง (ถ้ามี) : ', formatFuel(details.secondaryFuel, details.secondaryFuelOther, details.secondaryFuelPercent), { indent: 30 })
  layout.labelValue('4.3.6 ระบบการควบคุมปริมาณอากาศและสภาวะการเผาไหม้ : ', details.combustionControlSystem, { indent: 30 })
  layout.treatmentSystemLine(
    '4.3.7 ระบบบำบัด :',
    details.hasTreatmentSystem,
    details.treatmentSystemOther ?? joinList(normalizeArrayValue(details.treatmentSystem)),
    { indent: 30 },
  )
  layout.labelValueRow([
    { label: '4.3.8 พิกัดปล่องที่ติดตั้ง CEMS ละติจูด : ', value: details.stackLatitude, width: 300 },
    { label: 'ลองจิจูด : ', value: details.stackLongitude },
  ], { indent: 30 })
  layout.paragraph('4.4 รายละเอียดคอมพิวเตอร์หรืออุปกรณ์ติดตั้งโปรแกรม', { indent: 18, bold: true })
  layout.labelValue('อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ : ', details.connectionDeviceOther ?? details.connectionDevice, { indent: 30 })
  layout.addPage()
  layout.sectionTitle('5. รายละเอียดเครื่องมือตรวจวัด')
  layout.labelValueRow([
    { label: 'อุปกรณ์แปลงสัญญาณ (Converter) ยี่ห้อ : ', value: instruments.converterBrand, width: 300 },
    { label: 'รุ่น : ', value: instruments.converterModel },
  ])
  layout.space(8)
  renderInstrumentTable(layout, documentParameters, false)
  layout.cemsInstrumentSignature(
    request?.informationProviderName ?? details.informationProviderName,
    request?.informationProviderPosition ?? details.informationProviderPosition,
    signatureDate,
  )
  renderStandardCriteriaAttachment(layout, documentParameters)
  renderDeviceConfigPages(layout, request)
  await renderCemsDocumentSections(layout, context.documentsAndImages)
}

export async function createConnectionRequestPdf(request, options = {}) {
  if (!request) {
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
  const layout = new PdfLayout(pdfDoc, fonts)
  const context = {
    ...getRequestContext(request),
    signatureDate: options.showRequestMetaHeader
      ? displayValue(request?.submittedDate || formatRequestSubmittedDate(request?.submittedAt))
      : undefined,
  }

  if (context.isWpms) {
    await renderWpms(layout, request, context)
  } else {
    await renderCems(layout, request, context)
  }

  if (options.showRequestMetaHeader) {
    layout.requestMetaHeader(request)
  }

  layout.footer()

  return pdfDoc.save()
}
