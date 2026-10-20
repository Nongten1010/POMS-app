import test from 'node:test'
import assert from 'node:assert/strict'
import { getChatViewerId, CHAT_MESSAGE_MAX_LENGTH, hasChatReplyBadge, isChatMessageOnRight } from './chatSession.mjs'

test('staff see all staff messages on the right regardless of account', () => {
  for (const userType of ['officer', 'admin']) {
    const viewer = { userType, userId: 10 }
    for (const roleLabel of ['เจ้าหน้าที่', 'ผู้ดูแลระบบ']) {
      assert.equal(isChatMessageOnRight({ userId: 99, roleLabel }, viewer), true)
    }
    assert.equal(isChatMessageOnRight({ userId: 10, roleLabel: 'ผู้ประกอบการ' }, viewer), false)
    assert.equal(isChatMessageOnRight({}, viewer), false)
  }
})

test('operator alignment continues to use the current account', () => {
  const viewer = { userType: 'operator', userId: 10 }
  assert.equal(isChatMessageOnRight({ userId: 10 }, viewer), true)
  assert.equal(isChatMessageOnRight({ userId: 99, roleLabel: 'ผู้ประกอบการ' }, viewer), false)
  assert.equal(isChatMessageOnRight({ userId: 99, roleLabel: 'เจ้าหน้าที่' }, viewer), false)
  assert.equal(isChatMessageOnRight({}, {}), false)
})

test('chat reply badges require the opposite sender type', () => {
  for (const viewer of ['operator', 'officer', 'citizen', undefined]) {
    for (const sender of ['operator', 'officer', null, undefined, 'unknown']) {
      const expected = (viewer === 'operator' && sender === 'officer')
        || (viewer === 'officer' && sender === 'operator')
      assert.equal(hasChatReplyBadge(viewer, sender), expected)
    }
  }
})

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
