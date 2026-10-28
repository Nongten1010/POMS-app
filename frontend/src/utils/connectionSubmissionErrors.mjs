export const submissionProcessingError = 'เกิดข้อผิดพลาดในการประมวลผล กรุณาตรวจสอบรายการคำขอก่อนส่งซ้ำ'
export const submissionConnectionError = 'ไม่สามารถรับผลตอบกลับจากระบบได้ กรุณาตรวจสอบการเชื่อมต่อและรายการคำขอก่อนส่งซ้ำหลังจาก 15 วินาที'

export async function fetchSubmissionText(url, options, fetchImpl = fetch) {
  // Validate request construction outside the transport error boundary.
  const request = new Request(new URL(url, globalThis.location?.href), options)
  try {
    const result = await fetchImpl(request)
    const rawText = await result.text()
    return { result, rawText }
  } catch (cause) {
    throw new Error(submissionConnectionError, { cause })
  }
}

export function getSubmissionErrorMessage(error) {
  if (error instanceof TypeError) return submissionProcessingError
  if (error instanceof Error && error.message.trim() === 'Script or active web content is not allowed') {
    return 'ไม่สามารถอัปโหลดไฟล์แนบได้ เนื่องจากประเภทหรือเนื้อหาของไฟล์ไม่เป็นไปตามข้อกำหนดของระบบ กรุณาตรวจสอบไฟล์แนบแล้วลองใหม่'
  }
  return error instanceof Error ? error.message : submissionProcessingError
}
