import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createChatClient, mergeMessages, readNewMessages, readAllChatFactories, ticketQuery, formatChatDate } from './chatApi.mjs'

const ok = (data, extra = {}) => Response.json({ success: true, data, ...extra })
const fail = (status, code) => Response.json({ success: false, error: { code, message: code } }, { status })
test('topic selectors use local JSON with the existing API topic codes', () => {
  const topics = JSON.parse(readFileSync(new URL('../option/chatTopicOptions.json', import.meta.url), 'utf8'))
  assert.deepEqual(topics.map((topic) => topic.code), ['factory_access', 'connection_data', 'measurements_alerts', 'forms_reports', 'form_legal_guidance', 'other'])
  assert.ok(topics.every((topic) => topic.label.trim()))
  for (const file of ['ChatCreateDialog.jsx', 'ChatWorkspace.jsx']) {
    const source = readFileSync(new URL(`../components/${file}`, import.meta.url), 'utf8')
    assert.match(source, /import chatTopics from '\.\.\/option\/chatTopicOptions.json'/)
    assert.match(source, /chatTopics.map/)
    assert.doesNotMatch(source, /options\.topics|data\?\.topics/)
  }
})

test('factory selector loads every page and deduplicates factory IDs', async () => {
  const pages = []
  const result = await readAllChatFactories({ request: async (path, { query }) => {
    assert.equal(path, '/factories')
    pages.push(query.page)
    return { data: [{ id: 1 }, { id: query.page + 1 }], pagination: { totalPages: 3 } }
  } })
  assert.deepEqual(pages, [1, 2, 3])
  assert.deepEqual(result.data.map((factory) => factory.id), [1, 2, 3, 4])
})

test('factory selector stops loading further pages when aborted', async () => {
  const controller = new AbortController()
  let calls = 0
  await readAllChatFactories({ request: async () => {
    calls++
    controller.abort()
    return { data: [], pagination: { totalPages: 3 } }
  } }, controller.signal)
  assert.equal(calls, 1)
})

test('authenticated requests preserve top-level pagination and use same-origin production URL', async () => {
  const client = createChatClient('token', { fetchImpl: async (url, init) => {
    assert.equal(url, '/api/v1/chat/tickets?page=2&pageSize=25')
    assert.equal(init.headers.Authorization, 'Bearer token'); assert.equal(init.cache, 'no-store')
    return ok([], { pagination: { total: 75, page: 2 } })
  } })
  const response = await client.request('/tickets', { query: { page: 2, pageSize: 25 } })
  assert.equal(response.pagination.total, 75)
})

test('uncertain create retains UUID and original payload, accepts 200 replay and allocates next key only for new intent', async () => {
  const calls = []; let sequence = 0
  const client = createChatClient('token', { userType: 'operator', uuid: () => `uuid-${++sequence}`, fetchImpl: async (_, init) => {
    calls.push(init)
    if (calls.length === 1) throw new TypeError('network lost')
    return ok({ ticket: { id: 9 }, firstMessage: { id: 10 }, replayed: calls.length === 2 })
  } })
  const body = { eligibleFactoryId: 10, measurementPoint: null, topicCode: 'other', message: 'hello' }
  await assert.rejects(client.write('create', '/tickets', body))
  assert.equal(client.hasPending('create'), true)
  const replay = await client.write('create', '/tickets', { ...body, message: 'changed while retrying' })
  assert.equal(replay.data.replayed, true); assert.equal(replay.sent.message, 'hello')
  assert.equal(calls[0].body, calls[1].body)
  assert.equal(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key'])
  assert.equal(client.hasPending('create'), false)
  await client.write('create', '/tickets', body)
  assert.notEqual(calls[1].headers['Idempotency-Key'], calls[2].headers['Idempotency-Key'])
})

test('duplicate clicks are blocked and key conflict never creates a new intent automatically', async () => {
  let resolve; let calls = 0
  const client = createChatClient('token', { uuid: () => 'uuid', fetchImpl: async () => { calls++; return new Promise((r) => { resolve = r }) } })
  const first = client.write('send:1', '/tickets/1/messages', { message: 'hello' })
  await assert.rejects(client.write('send:1', '/tickets/1/messages', { message: 'hello' }))
  assert.equal(calls, 1)
  resolve(fail(409, 'IDEMPOTENCY_KEY_CONFLICT'))
  await assert.rejects(first, (error) => error.code === 'IDEMPOTENCY_KEY_CONFLICT')
  assert.equal(client.hasPending('send:1'), true)
})

test('closed ticket and validation errors release intent; 500 retains intent', async () => {
  for (const [status, code, pending] of [[409, 'CHAT_TICKET_CLOSED', false], [400, 'VALIDATION_ERROR', false], [403, 'FORBIDDEN', false], [404, 'NOT_FOUND', false], [500, 'INTERNAL_ERROR', true]]) {
    const client = createChatClient('token', { uuid: () => 'uuid', fetchImpl: async () => fail(status, code) })
    await assert.rejects(client.write('send:1', '/tickets/1/messages', { message: 'hello' }), (error) => error.status === status)
    assert.equal(client.hasPending('send:1'), pending)
  }
})

test('plain text rate limiting respects Retry-After without polling', async () => {
  let calls = 0
  const client = createChatClient('token', { fetchImpl: async () => { calls++; return new Response('Too many requests', { status: 429, headers: { 'Retry-After': '60' } }) } })
  await assert.rejects(client.request('/options'), (error) => error.status === 429 && error.retryAt > Date.now())
  await assert.rejects(client.request('/options'), (error) => error.status === 429)
  assert.equal(calls, 1)
})

test('refresh from GET cursor catches intervening messages and drains all batches without duplicates', async () => {
  let messages = [{ id: 100 }, { id: 102 }]; let readPosition = 100
  const queries = []
  const client = { request: async (_, { query }) => {
    queries.push(query)
    return { data: { ticket: { id: 1, status: 'open' }, messages: query.afterMessageId === 100 ? [{ id: 101 }, { id: 102 }] : [{ id: 103 }], pagination: query.afterMessageId === 100 ? { hasMore: true, nextAfterMessageId: 102 } : { hasMore: false } } }
  } }
  await readNewMessages(client, 1, readPosition, undefined, (data, next) => { messages = mergeMessages(messages, data.messages); readPosition = next })
  assert.deepEqual(messages.map((item) => item.id), [100, 101, 102, 103])
  assert.deepEqual(queries.map((query) => query.afterMessageId), [100, 102])
  assert.equal(readPosition, 103)
})

test('empty refresh updates closed ticket and preserves cursor; initial page does not follow older direction', async () => {
  let ticket; let cursor
  await readNewMessages({ request: async () => ({ data: { ticket: { status: 'closed' }, messages: [], pagination: { hasMore: false } } }) }, 1, 10, undefined, (data, next) => { ticket = data.ticket; cursor = next })
  assert.equal(ticket.status, 'closed'); assert.equal(cursor, 10)
  let calls = 0
  await readNewMessages({ request: async () => { calls++; return { data: { messages: [{ id: 50 }], pagination: { hasMore: true, olderCursor: 'opaque' } } } } }, 1, null, undefined, () => {})
  assert.equal(calls, 1)
})

test('server query mapping uses one-based pages, supported sort and only supported operators', () => {
  assert.deepEqual(ticketQuery({ page: 2, pageSize: 50 }, [{ field: 'registration', sort: 'asc' }], { items: [{ field: 'status', operator: 'is', value: 'open' }], quickFilterValues: ['factory', 'name'] }), { page: 3, pageSize: 50, sort: 'registrationNo', order: 'asc', status: 'open', q: 'factory name' })
  assert.equal(ticketQuery({ page: 0, pageSize: 25 }, [], { items: [{ field: 'latest', operator: 'onOrBefore', value: '2026-10-17T10:00:00+07:00' }] }).to, '2026-10-17T03:00:00.000Z')
  assert.match(formatChatDate('2026-10-17T03:00:00Z'), /10:00/)
})

test('disposing cancels requests and discards unresolved account intents', async () => {
  let signal
  const client = createChatClient('token', { userType: 'operator', uuid: () => 'uuid', fetchImpl: async (_, init) => {
    signal = init.signal
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))
  } })
  const request = client.write('create', '/tickets', { message: 'hello' })
  client.dispose()
  await assert.rejects(request, { name: 'AbortError' })
  assert.equal(signal.aborted, true); assert.equal(client.hasPending('create'), false)
})

test('non-operators cannot create through write or request, but can read, reply and close', async () => {
  for (const userType of ['officer', 'admin', 'director', 'citizen', undefined]) {
    const calls = []
    const client = createChatClient('token', { userType, uuid: () => 'uuid', fetchImpl: async (url) => {
      calls.push(url)
      return new Response(JSON.stringify({ success: true, data: {} }))
    } })
    await assert.rejects(client.write('create', '/tickets', { message: 'hello' }), { code: 'CHAT_CREATE_OPERATOR_ONLY' })
    await assert.rejects(client.request('/tickets', { body: { message: 'hello' } }), { code: 'CHAT_CREATE_OPERATOR_ONLY' })
    assert.equal(client.hasPending('create'), false)
    assert.equal(calls.length, 0)
    await client.request('/tickets')
    await client.write('send:1', '/tickets/1/messages', { message: 'reply' })
    await client.request('/tickets/1/close', { body: {} })
    assert.equal(calls.length, 3)
  }
})

test('production route has no mock dependency, uses capabilities, server grid and manual refresh', () => {
  const source = (file) => readFileSync(new URL(file, import.meta.url), 'utf8')
  for (const file of ['../pages/ChatPage.jsx', '../components/ChatWorkspace.jsx', '../components/ChatCreateDialog.jsx', '../components/ChatConversation.jsx']) {
    assert.doesNotMatch(source(file), /mockPeople|mockFactories|makeMockTickets|chatTicketMock|ChatTicketMockup|setInterval|WebSocket/)
  }
  const workspace = source('../components/ChatWorkspace.jsx')
  assert.match(workspace, /paginationMode="server" sortingMode="server" filterMode="server"/)
  assert.match(workspace, /canCreate/)
  assert.match(workspace, /const canCreate = userType === 'operator' && data\?\.canCreate === true && !accessError/)
  assert.match(workspace, /\{canCreate && <Button/)
  assert.match(workspace, /\{canCreate && <ChatCreateDialog/)
  assert.match(source('../pages/ChatPage.jsx'), /userType=\{userType\}/)
  assert.match(source('../App.jsx'), /<ChatPage[^>]*userType=\{userType\}/)
  assert.match(workspace, /disableToolbarButton: true/)
  const conversation = source('../components/ChatConversation.jsx')
  assert.match(conversation, /item.sender.userId === options.viewer.userId/)
  assert.match(conversation, /capabilities.canReply/)
  assert.match(conversation, /capabilities.canClose/)
  assert.match(conversation, /setConfirm\(true\)/)
  assert.doesNotMatch(conversation, /dangerouslySetInnerHTML/)
})
