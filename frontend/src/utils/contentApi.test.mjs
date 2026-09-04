import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ContentApiError,
  buildContentApiHeaders,
  getContentApiUrl,
  normalizeContentErrorDetails,
  readContentApiResponse,
  resolveContentDownloadUrl,
} from './contentApi.mjs'

test('builds production and development content API URLs', () => {
  assert.equal(getContentApiUrl('laws', '', false), '/api/v1/laws')
  assert.equal(getContentApiUrl('faqs', 'faq/id', true), '/api-proxy/v1/faqs/faq%2Fid')
})

test('adds the bearer token only when it is available', () => {
  assert.deepEqual(buildContentApiHeaders('', { Accept: 'application/json' }), {
    Accept: 'application/json',
  })
  assert.deepEqual(buildContentApiHeaders('token-123', { Accept: 'application/json' }), {
    Accept: 'application/json',
    Authorization: 'Bearer token-123',
  })
})

test('normalizes server field errors for form helper text', () => {
  assert.deepEqual(
    normalizeContentErrorDetails({
      question: ['กรุณากรอกคำถาม', 'ความยาวไม่ถูกต้อง'],
      category: 'กรุณาเลือกหมวดหมู่',
      ignored: null,
    }),
    {
      question: 'กรุณากรอกคำถาม ความยาวไม่ถูกต้อง',
      category: 'กรุณาเลือกหมวดหมู่',
    },
  )
})

test('reads a successful API envelope', async () => {
  const payload = await readContentApiResponse(
    new Response(JSON.stringify({ success: true, data: [{ id: 'law-1' }] }), { status: 200 }),
    'โหลดข้อมูลไม่สำเร็จ',
  )

  assert.deepEqual(payload.data, [{ id: 'law-1' }])
})

test('throws a structured API error', async () => {
  await assert.rejects(
    () => readContentApiResponse(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'ข้อมูลไม่ถูกต้อง',
            details: { file: ['กรุณาแนบไฟล์ PDF'] },
          },
        }),
        { status: 400 },
      ),
      'บันทึกข้อมูลไม่สำเร็จ',
    ),
    (error) => {
      assert.ok(error instanceof ContentApiError)
      assert.equal(error.message, 'ข้อมูลไม่ถูกต้อง')
      assert.equal(error.code, 'VALIDATION_ERROR')
      assert.equal(error.status, 400)
      assert.deepEqual(error.details, { file: 'กรุณาแนบไฟล์ PDF' })
      return true
    },
  )
})

test('maps API download paths through the local proxy', () => {
  assert.equal(
    resolveContentDownloadUrl('/api/v1/laws/law-1/file', true),
    '/api-proxy/v1/laws/law-1/file',
  )
  assert.equal(
    resolveContentDownloadUrl('https://files.example/law.pdf', true),
    'https://files.example/law.pdf',
  )
})
