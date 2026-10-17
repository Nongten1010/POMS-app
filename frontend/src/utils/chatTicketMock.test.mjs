import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessMockTicket, createMockTicket, makeMockTickets, ticketTopics, updateMockTicket } from './chatTicketMock.mjs'

const now = '2026-10-17T12:00:00+07:00'
test('mock has six topics, two statuses and the approved ticket number format', () => {
  assert.equal(ticketTopics.length, 6)
  for (const ticket of makeMockTickets()) {
    assert.match(ticket.id, /^TK-69-\d{5}$/)
    assert.ok(['open', 'closed'].includes(ticket.status))
  }
})
test('factory colleagues share access but cannot access another factory', () => {
  const tickets = makeMockTickets()
  for (const viewer of ['operator', 'colleague']) {
    assert.equal(canAccessMockTicket(tickets[0], viewer), true)
    assert.equal(canAccessMockTicket(tickets[2], viewer), false)
    assert.equal(updateMockTicket(tickets[0], viewer, 'close', '', now).status, 'closed')
    assert.equal(updateMockTicket(tickets[2], viewer, 'close'), tickets[2])
  }
  assert.equal(canAccessMockTicket(tickets[2], 'officer'), true)
  assert.equal(canAccessMockTicket(tickets[0], 'unknown'), false)
})
test('messages retain account identity, reject blank messages and closing preserves last message time', () => {
  const original = makeMockTickets()[0]
  const replied = updateMockTicket(original, 'colleague', 'send', ' ข้อมูลเพิ่มเติม ', now)
  assert.equal(replied.messages.at(-1).sender, 'colleague')
  assert.equal(replied.messages.at(-1).text, 'ข้อมูลเพิ่มเติม')
  assert.equal(updateMockTicket(original, 'operator', 'send', '  '), original)
  const closed = updateMockTicket(replied, 'officer', 'close', '', now)
  assert.equal(closed.closedBy, 'officer')
  assert.equal(closed.messages, replied.messages)
  assert.equal(updateMockTicket(closed, 'operator', 'send', 'เพิ่มเติม'), closed)
  assert.equal(updateMockTicket(closed, 'officer', 'reopen'), closed)
  assert.equal(original.status, 'open')
})
test('creation validates factory, point, topic and first message and allocates next number', () => {
  const tickets = makeMockTickets()
  const form = { factoryId: 'factory-1', point: 'ทั้งหมด', topic: ticketTopics[0], text: 'สอบถามข้อมูล' }
  const created = createMockTicket(tickets, 'colleague', form, now)
  assert.equal(created.id, 'TK-69-00019')
  assert.equal(created.creator, 'colleague')
  assert.equal(created.messages.length, 1)
  assert.equal(createMockTicket([...tickets, created], 'operator', form, now).id, 'TK-69-00020')
  for (const override of [{ text: ' ' }, { point: 'จุดของโรงงานอื่น' }, { factoryId: 'factory-2' }, { topic: 'ไม่รู้จัก' }]) {
    assert.equal(createMockTicket(tickets, 'operator', { ...form, ...override }, now), null)
  }
  assert.equal(createMockTicket(tickets, 'officer', form, now), null)
})
