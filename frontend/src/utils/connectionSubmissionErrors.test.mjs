import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchSubmissionText, getSubmissionErrorMessage, submissionConnectionError, submissionProcessingError } from './connectionSubmissionErrors.mjs'

test('processing TypeErrors and explicit server messages remain distinct', () => {
  assert.equal(getSubmissionErrorMessage(new TypeError('Cannot read properties of null')), submissionProcessingError)
  assert.equal(getSubmissionErrorMessage(new Error('Invalid parameter')), 'Invalid parameter')
})

test('transport and interrupted response failures display connection advice without retrying', async () => {
  for (const readFailure of [false, true]) {
    let calls = 0
    await assert.rejects(fetchSubmissionText('https://example.test/submit', { method: 'POST' }, async () => {
      calls += 1
      if (!readFailure) throw new TypeError('Failed to fetch')
      return { text: async () => { throw new TypeError('terminated') } }
    }), (error) => getSubmissionErrorMessage(error) === submissionConnectionError)
    assert.equal(calls, 1)
  }
})

test('HTTP errors retain status and response body for existing handling', async () => {
  for (const status of [200, 400, 401, 403, 500, 503]) {
    const { result, rawText } = await fetchSubmissionText('https://example.test/submit', { method: 'POST', body: '{}' }, async (request) => {
      assert.equal(request.method, 'POST')
      assert.equal(await request.text(), '{}')
      return new Response('{"message":"server response"}', { status })
    })
    assert.equal(result.status, status)
    assert.equal(rawText, '{"message":"server response"}')
  }
})

test('invalid request construction is a processing error and does not send', async () => {
  let called = false
  await assert.rejects(fetchSubmissionText('https://example.test/submit', { method: 'GET', body: '{}' }, async () => { called = true }), (error) => getSubmissionErrorMessage(error) === submissionProcessingError)
  assert.equal(called, false)
})
