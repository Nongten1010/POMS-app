import provinceOptions from '../option/provinceOptions.json' with { type: 'json' }

const postalCode = '[0-9๐-๙]{5}'
const postalLabel = '(?:รหัส\\s*ไปรษณีย์|รหัส\\s*ปณ\\.?|\\bpostal\\s+code|\\bzip(?:\\s+code)?)'
const labeledPostalCode = new RegExp(
  `\\s*(?:\\(\\s*${postalLabel}\\s*[:：]?\\s*${postalCode}\\s*\\)|${postalLabel}\\s*[:：]?\\s*${postalCode}(?=$|\\s|[,.;()]))`,
  'giu',
)

const areaLabel = '(?:จังหวัด|อำเภอ|ตำบล|แขวง|เขต|[จอต]\\.)'
const thaiName = '[ก-ฮะ-์]+(?:\\s*[-,]\\s*[ก-ฮะ-์]+)*'
const provinceNames = provinceOptions.filter(({ value }) => value !== 'all').map(({ value }) => value)
const bareProvince = `(?:^|[\\s,])(?:${provinceNames.join('|')}|กรุงเทพฯ|กทม\\.?)`
const postalCodeAfterArea = new RegExp(
  `(${areaLabel}\\s*${thaiName}\\s*|${bareProvince}\\s*|${areaLabel}\\s*[0-9๐-๙]+\\s+)` +
    `(?:\\(\\s*${postalCode}\\s*\\)|${postalCode})(?=\\s*(?:$|[,.;(]|จังหวัด|จ\\.|กรุงเทพมหานคร|ประเทศไทย|Thailand\\b))`,
  'giu',
)

export function formatFactoryAddress(address) {
  if (typeof address !== 'string') return address

  // Unlabeled postcodes need an area prefix so five-digit house and land numbers survive.
  const formatted = address.replace(postalCodeAfterArea, (_, area) => area.trimEnd()).replace(labeledPostalCode, '')
  return formatted === address ? address : formatted.trim()
}
