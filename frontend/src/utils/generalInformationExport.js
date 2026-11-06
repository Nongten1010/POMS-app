import { formatSummaryNumber } from './generalInformation.mjs'

function download(bytes, type, name) {
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export async function createSummaryWorkbook({ sections, systemType, generatedAt }) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const sheet = [
    [{ value: `ข้อมูลทั่วไป (${systemType}) - ทั่วประเทศ`, fontSize: 16, fontWeight: 'bold', columnSpan: 4 }, null, null, null],
    [{ value: `ข้อมูล ณ ${generatedAt}`, columnSpan: 4 }, null, null, null],
  ]
  sections.forEach((section) => {
    sheet.push([])
    sheet.push([{ value: section.title, columnSpan: 4, height: 36, wrap: true, fontWeight: 'bold' }, null, null, null])
    sheet.push(section.headers.map((value) => ({ value, fontWeight: 'bold', backgroundColor: '#F1F3F5' })))
    section.rows.forEach((values, index) => {
      sheet.push(values.map((value, column) => ({
        value: value === null ? '-' : value,
        ...(typeof value === 'number' ? { format: '#,##0.###' } : {}),
        ...(section.total && index === section.rows.length - 1 ? { fontWeight: 'bold', backgroundColor: '#F1F3F5' } : {}),
        align: column ? 'right' : 'left', height: 24,
      })))
    })
  })
  return writeExcelFile(sheet, { sheet: systemType, fontFamily: 'Tahoma', fontSize: 11, columns: [{ width: 48 }, { width: 24 }, { width: 24 }, { width: 24 }] }).toBlob()
}

export async function createSummaryPdf({ sections, systemType, generatedAt }) {
  const [{ PDFDocument, rgb }, { default: fontkit }, regularUrl, boldUrl] = await Promise.all([
    import('pdf-lib'), import('@pdf-lib/fontkit'),
    import('../assets/fonts/THSarabunNew.ttf?url'), import('../assets/fonts/THSarabunNew-Bold.ttf?url'),
  ])
  const loadFont = async (url) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Font unavailable')
    return response.arrayBuffer()
  }
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  const regular = await document.embedFont(await loadFont(regularUrl.default), { subset: true })
  const bold = await document.embedFont(await loadFont(boldUrl.default), { subset: true })
  const width = 595.28
  const height = 841.89
  const margin = 36
  let page
  let y
  const draw = (text, x, baseline, font = regular, size = 14) => page.drawText(String(text), { x, y: baseline, font, size })
  const newPage = () => {
    page = document.addPage([width, height])
    y = height - 45
    draw(`ข้อมูลทั่วไป (${systemType}) - ทั่วประเทศ`, margin, y, bold, 20)
    y -= 20
    draw(`ข้อมูล ณ ${new Intl.DateTimeFormat('th-TH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(generatedAt))}`, margin, y, regular, 12)
    y -= 30
  }
  const wrap = (value, font, size, maxWidth) => {
    const lines = ['']
    for (const { segment } of new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(String(value))) {
      const last = lines.length - 1
      if (lines[last] && font.widthOfTextAtSize(lines[last] + segment, size) > maxWidth) lines.push(segment)
      else lines[last] += segment
    }
    return lines
  }
  newPage()
  sections.forEach((section) => {
    const columns = section.headers.length
    const firstWidth = 235
    const otherWidth = (width - margin * 2 - firstWidth) / (columns - 1)
    const row = (values, highlighted = false, isHeader = false) => {
      const font = highlighted || isHeader ? bold : regular
      const lines = values.map((value, index) => wrap(index && !isHeader ? formatSummaryNumber(value) : value, font, 14, (index ? otherWidth : firstWidth) - 12))
      const rowHeight = Math.max(...lines.map((value) => value.length)) * 17 + 10
      if (highlighted || isHeader) page.drawRectangle({ x: margin, y: y - rowHeight + 7, width: width - margin * 2, height: rowHeight, color: rgb(0.94, 0.95, 0.96) })
      lines.forEach((parts, column) => parts.forEach((text, index) => {
        const right = margin + firstWidth + otherWidth * column - 6
        draw(text, column ? right - font.widthOfTextAtSize(text, 14) : margin + 6, y - index * 17 - 9, font)
      }))
      y -= rowHeight
    }
    const heading = () => {
      for (const line of wrap(section.title, bold, 16, width - margin * 2)) { draw(line, margin, y, bold, 16); y -= 20 }
      y -= 4
      row(section.headers, false, true)
    }
    const sectionHeight = wrap(section.title, bold, 16, width - margin * 2).length * 20 + 40
      + section.rows.reduce((sum, values) => sum + Math.max(...values.map((value, column) => wrap(column ? formatSummaryNumber(value) : value, bold, 14, (column ? otherWidth : firstWidth) - 12).length)) * 17 + 10, 0)
    if (y < 170 || (sectionHeight < height - 170 && y - sectionHeight < 45)) newPage()
    heading()
    section.rows.forEach((values, index) => {
      const needed = Math.max(...values.map((value, column) => wrap(column ? formatSummaryNumber(value) : value, bold, 14, (column ? otherWidth : firstWidth) - 12).length)) * 17 + 10
      if (y - needed < 45) { newPage(); heading() }
      row(values, section.total && index === section.rows.length - 1)
    })
    y -= 25
  })
  document.getPages().forEach((item, index, pages) => item.drawText(`${index + 1} / ${pages.length}`, { x: width - 65, y: 20, font: regular, size: 12 }))
  return document.save()
}

export async function exportGeneralInformation(options) {
  const { systemType, format } = options
  const bytes = format === 'xlsx' ? await createSummaryWorkbook(options) : await createSummaryPdf(options)
  download(bytes, format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf', `general-information-${systemType}.${format}`)
}
