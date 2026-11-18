import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { query, close } from '../server/db.js'

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001/api/v1'
const stamp = Date.now().toString().slice(-10)
const imeis = ['86801' + stamp, '86802' + stamp]
let cookie = ''
async function api(path, body, options = {}) {
  const method = options.method || (body === undefined ? 'GET' : 'POST')
  const headers = { Cookie: options.cookie ?? cookie, 'X-Branch-ID': options.branch || 'q1' }
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; headers['Idempotency-Key'] = options.key || randomUUID() }
  const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const payload = response.status === 204 ? null : await response.json()
  return { status: response.status, payload, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}
async function ok(path, body, options) {
  const r = await api(path, body, options)
  assert.equal(r.status, 200, JSON.stringify(r.payload))
  return r.payload
}
async function receive(productId, qty, extra = {}) {
  const receipt = await ok('/receipts', { productId, qty, type: 'Nhập kho', note: 'TECH-' + stamp, ...extra })
  return ok('/receipts/' + receipt.id + '/confirm', {})
}
async function state(branch = 'q1') { return ok('/bootstrap', undefined, { branch }) }

test('Nhóm 5 SQL/API integration', async (t) => {
  const login = await api('/auth/login', { username: 'quang', password: process.env.SEED_PASSWORD || 'PhoneFlow@123' })
  assert.equal(login.status, 200)
  cookie = login.cookie
  let device
  let order
  let transfer
  await t.test('SQL connection and branch authorization', async () => {
    assert.equal((await ok('/health')).database, 'SQL Server')
    const restricted = await api('/auth/login', { username: 'thungan.hk', password: process.env.SEED_PASSWORD || 'PhoneFlow@123' }, { cookie: '' })
    assert.equal(restricted.status, 200)
    assert.equal((await api('/bootstrap', undefined, { cookie: restricted.cookie, branch: 'q3' })).status, 403)
    assert.equal((await api('/receipts', { productId: '7', qty: 1, note: 'forbidden' }, { cookie: restricted.cookie })).status, 403)
    assert.equal((await api('/bootstrap', undefined, { cookie: '' })).status, 401)
  })
  await t.test('Dual IMEI and complete rollback on duplicate', async () => {
    await receive('1', 1, { serial: 'TECH-' + stamp, imeis })
    device = (await state()).devices.find((d) => d.serial === 'TECH-' + stamp)
    assert.deepEqual(new Set(device.imeis), new Set(imeis))
    assert.equal((await ok('/lookup?q=' + imeis[1])).device.id, device.id)
    const draft = await ok('/receipts', { productId: '1', note: 'duplicate', serial: 'DUP-' + stamp, imeis: [imeis[0]] })
    assert.equal((await api('/receipts/' + draft.id + '/confirm', {})).status, 409)
    assert.equal((await state()).devices.some((d) => d.serial === 'DUP-' + stamp), false)
  })
  await t.test('Failed payment preserves stock; concurrent sale and repeat confirmation', async () => {
    const lines = [{ productId: '1', deviceId: device.id, qty: 1, price: 1 }]
    order = await ok('/sales', { lines, customer: 'Technical ' + stamp })
    const other = await ok('/sales', { lines })
    assert.equal(order.total, 29990000)
    assert.equal((await api('/sales/' + order.id + '/confirm', { result: 'failure', method: 'Tiền mặt' })).status, 422)
    assert.equal((await state()).devices.find((d) => d.id === device.id).status, 'available')
    const confirmKey = randomUUID()
    const body = { result: 'success', method: 'Tiền mặt' }
    const raced = await Promise.all([api('/sales/' + order.id + '/confirm', body, { key: confirmKey }), api('/sales/' + other.id + '/confirm', body)])
    assert.deepEqual(raced.map((r) => r.status).sort(), [200, 409])
    // Determine winner rather than assuming completion order.
    if (raced[0].status !== 200) order = other
    else {
      assert.equal((await api('/sales/' + order.id + '/confirm', body, { key: confirmKey })).status, 200)
      assert.equal((await api('/sales/' + order.id + '/confirm', { ...body, method: 'Thẻ' }, { key: confirmKey })).status, 409)
    }
    assert.equal((await state()).devices.find((d) => d.id === device.id).status, 'sold')
  })
  await t.test('Overselling quantity rolls back every line', async () => {
    const draft = await ok('/sales', { lines: [{ productId: '7', qty: 100000 }] })
    const before = (await state()).quantities['q1:7'].available
    assert.equal((await api('/sales/' + draft.id + '/confirm', { result: 'success', method: 'Tiền mặt' })).status, 409)
    assert.equal((await state()).quantities['q1:7'].available, before)
  })
  await t.test('Warranty policy, state history and approved quarantine return', async () => {
    const eligibility = await ok('/warranty/eligibility?q=' + imeis[0])
    assert.equal(eligibility.find((p) => p.saleId === order.id).eligible, true)
    const ticket = await ok('/warranty/tickets', { orderId: order.id, lineIndex: 0, reason: 'Kiểm tra kỹ thuật' })
    await ok('/warranty/tickets/' + ticket.id + '/events', { next: 'processing', note: 'Bàn giao' })
    const complete = await ok('/warranty/tickets/' + ticket.id + '/events', { next: 'done', note: 'Xong' })
    assert.equal(complete.history.length, 3)
    const returned = await ok('/returns', { orderId: order.id, lineIndex: 0, reason: 'Hàng lỗi' })
    await ok('/returns/' + returned.id + '/approve', {})
    await ok('/returns/' + returned.id + '/receive', { condition: 'quarantine' })
    assert.equal((await state()).devices.find((d) => d.id === device.id).status, 'quarantine')
    assert.equal((await api('/returns', { orderId: order.id, lineIndex: 0, reason: 'Lặp' })).status, 409)
  })
  await t.test('Transfer discrepancy, reconciliation, branch rights and single receipt', async () => {
    await receive('7', 6)
    transfer = await ok('/transfers', { productId: '7', qty: 2, to: 'q3', note: 'Technical transfer' })
    await ok('/transfers/' + transfer.id + '/approve', {})
    const sourceBefore = (await state()).quantities['q1:7'].available
    const targetBefore = (await state('q3')).quantities['q3:7'].available
    await ok('/transfers/' + transfer.id + '/dispatch', {})
    assert.equal((await state()).quantities['q1:7'].available, sourceBefore - 2)
    assert.equal((await api('/transfers/' + transfer.id + '/receive', {})).status, 403)
    await ok('/transfers/' + transfer.id + '/discrepancies', { note: 'Đối soát số kiện' }, { branch: 'q3' })
    assert.equal((await api('/transfers/' + transfer.id + '/receive', {}, { branch: 'q3' })).status, 409)
    await ok('/transfers/' + transfer.id + '/reconcile', { note: 'Đã xác minh đủ hàng' }, { branch: 'q3' })
    const key = randomUUID()
    await ok('/transfers/' + transfer.id + '/receive', {}, { branch: 'q3', key })
    await ok('/transfers/' + transfer.id + '/receive', {}, { branch: 'q3', key })
    assert.equal((await state('q3')).quantities['q3:7'].available, targetBefore + 2)
  })
  await t.test('Counts require approval and detect stock changed since counting', async () => {
    let balance = (await state()).balances.find((b) => b.productId === '7')
    const count = await ok('/counts', { rows: [{ productId: '7', expected: balance.available, revision: balance.revision, count: balance.available - 1, devices: [] }] })
    await ok('/counts/' + count.id + '/submit', {})
    await receive('7', 1)
    assert.equal((await api('/counts/' + count.id + '/approve', { note: 'Stale test' })).status, 409)
    balance = (await state()).balances.find((b) => b.productId === '7')
    const fresh = await ok('/counts', { rows: [{ productId: '7', expected: balance.available, revision: balance.revision, count: balance.available - 1, devices: [] }] })
    await ok('/counts/' + fresh.id + '/submit', {})
    await ok('/counts/' + fresh.id + '/approve', { note: 'Đã xác minh thiếu một' })
    assert.equal((await state()).quantities['q1:7'].available, balance.available - 1)
  })
  await t.test('Ledger and dashboard reconcile directly to SQL', async () => {
    const report = await ok('/reports/sales?days=7')
    const [sql] = await query("SELECT SUM(total) amount FROM dbo.sales_orders WHERE branchId='q1' AND status='paid' AND date>=@start AND date<@end", { start: new Date(report.previousPeriod.startUtc), end: new Date(report.period.endUtc) })
    assert.equal(report.daily.reduce((sum, d) => sum + d.total, 0), Number(sql.amount))
    const [ledger] = await query("SELECT SUM(deltaAvailable) balance FROM dbo.stock_movements WHERE productId='7' AND branchId='q1'")
    assert.equal((await state()).quantities['q1:7'].available, Number(ledger.balance))
    assert.ok((await ok('/audit-events')).length > 0)
  })
  await t.test('Catalog updates preserve historical price and policy; archive blocks new use', async () => {
    const item = await ok('/skus', { sku: 'TEST-' + stamp, name: 'Phụ kiện kiểm tra', brand: 'PhoneFlow', category: 'Phụ kiện', price: 59000 })
    await receive(item.id, 2)
    const draft = await ok('/sales', { lines: [{ productId: item.id, qty: 1 }] })
    const paid = await ok('/sales/' + draft.id + '/confirm', { method: 'Tiền mặt', result: 'success' })
    const policyId = paid.lines[0].policyId
    await ok('/warranty/policies', { productId: item.id, months: 24, coverage: 'Phiên bản mới', exclusions: 'Rơi vỡ' })
    await ok('/skus/' + item.id, { ...item, price: 79000, active: false }, { method: 'PATCH' })
    const retained = (await ok('/sales')).find((sale) => sale.id === paid.id)
    assert.equal(retained.total, 59000)
    assert.equal(retained.lines[0].policyId, policyId)
    assert.equal((await api('/sales', { lines: [{ productId: item.id, qty: 1 }] })).status, 409)
  })
  await t.test('Logout invalidates the server session', async () => {
    assert.equal((await api('/auth/logout', {})).status, 204)
    assert.equal((await api('/bootstrap')).status, 401)
  })
})
test.after(close)

