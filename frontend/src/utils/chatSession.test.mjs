import test from 'node:test'
import assert from 'node:assert/strict'
import { getChatViewerId, CHAT_MESSAGE_MAX_LENGTH } from './chatSession.mjs'

test('chat identity supports login envelopes and numeric user IDs', () => {
  assert.equal(getChatViewerId({ user: { id: 12 } }), 12)
  assert.equal(getChatViewerId({ response: { data: { user: { userId: '13' } } } }), 13)
  assert.equal(CHAT_MESSAGE_MAX_LENGTH, 2000)
})

test('chat identity falls back to token subject but never usernames or invalid IDs', () => {
  const token = `header.${Buffer.from(JSON.stringify({ sub: '42' })).toString('base64url')}.signature`
  assert.equal(getChatViewerId({ response: { accessToken: token, user: { username: 'another-name' } } }), 42)
  for (const auth of [null, {}, { user: { id: 0 } }, { user: { id: 'username' } }, { accessToken: 'invalid' }]) {
    assert.equal(getChatViewerId(auth), null)
  }
})
