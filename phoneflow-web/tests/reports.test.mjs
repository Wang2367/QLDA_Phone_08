import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { query, insert, transaction, close } from '../server/db.js'
import { reportWindow } from '../server/reports.js'
import { revenuePoints } from '../src/report-chart.js'

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001/api/v1'

test('A12 dates use Bangkok calendar and exact half-open periods', () => {
  const window = reportWindow('7', new Date('2026-11-17T18:30:00Z'))
  assert.deepEqual(window.period, { from: '2026-11-12', to: '2026-11-18', startUtc: '2026-11-11T17:00:00.000Z', endUtc: '2026-11-18T17:00:00.000Z' })
  assert.equal(window.previousPeriod.from, '2026-11-05')
  assert.equal(window.previousPeriod.endUtc, window.period.startUtc)
  for (const days of [1, 7, 30, 90]) {
    const result = reportWindow(days, new Date('2024-03-01T00:00:00Z'))
    assert.equal(Date.parse(result.period.endUtc) - Date.parse(result.period.startUtc), days * 86400000)
  }
  for (const invalid of [0, 91, 1.5, 'invalid', '', null, true, ['7'], {}, Infinity]) assert.throws(() => reportWindow(invalid))
})

test('A12 chart buckets preserve totals and date labels for 7, 30, 90 days', () => {
  for (const days of [7, 30, 90]) {
    const window = reportWindow(days, new Date('2026-11-17T18:30:00Z'))
    const report = { ...window, daily: [
      { day: window.period.from, total: 100 },
      { day: window.period.to, total: 200 },
      { day: window.previousPeriod.from, total: 300 },
      { day: window.previousPeriod.to, total: 400 },
    ] }
    const points = revenuePoints(report)
    assert.equal(points.length, days === 7 ? 7 : 6)
    assert.equal(points.reduce((sum, p) => sum + p.current, 0), 300)
    assert.equal(points.reduce((sum, p) => sum + p.previous, 0), 700)
    assert.equal(points.at(-1).label, '18/11')
  }
})

test('A12 four report types, SQL totals, filtering and permissions', async (t) => {
  let cookie
  const fixture = 'A12-' + randomUUID()
  const saleIds = []
  const lineIds = []
  const transferIds = []
  const ticketIds = []
  async function call(path, { branch = 'q1', body, session = cookie } = {}) {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET',
      headers: { Cookie: session || '', 'X-Branch-ID': branch, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined })
    return { status: response.status, value: response.status === 204 ? null : await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0] }
  }
  async function report(type, branch = 'q1', days = '7') {
    const result = await call('/reports/' + type + '?days=' + days, { branch })
    assert.equal(result.status, 200, JSON.stringify(result.value))
    return result.value
  }
  const login = await call('/auth/login', { body: { username: 'quang', password: process.env.SEED_PASSWORD || 'PhoneFlow@123' } })
  assert.equal(login.status, 200)
  cookie = login.cookie
  const before = {}
  for (const type of ['sales', 'inventory', 'in-transit', 'warranty']) before[type] = await report(type)
  const { period, previousPeriod } = before.sales
  try {
    await transaction(async (tx) => {
      const sales = [
        ['start', 'q1', period.startUtc, 100, 'paid'],
        ['last', 'q1', new Date(Date.parse(period.endUtc) - 1), 200, 'paid'],
        ['prev-start', 'q1', previousPeriod.startUtc, 300, 'paid'],
        ['prev-last', 'q1', new Date(Date.parse(period.startUtc) - 1), 400, 'paid'],
        ['too-old', 'q1', new Date(Date.parse(previousPeriod.startUtc) - 1), 500, 'paid'],
        ['future', 'q1', period.endUtc, 600, 'paid'],
        ['draft', 'q1', period.startUtc, 700, 'draft'],
        ['other', 'q3', period.startUtc, 800, 'paid'],
      ]
      for (const [name, branchId, time, total, status] of sales) {
        const id = fixture + '-' + name
        saleIds.push(id)
        await insert('sales_orders', { id, branchId, date: new Date(time), cashierId: 'quang', customer: 'A12 fixture',
          status, total, method: 'Tiền mặt', invoiceNo: status === 'paid' ? id : null, paidAt: status === 'paid' ? new Date(time) : null }, tx)
        const lineId = randomUUID()
        lineIds.push(lineId)
        await insert('sale_lines', { id: lineId, saleId: id, lineIndex: 0, productId: '7', qty: 1, price: total, name: 'A12 fixture', sku: 'ANK-USB-30', policyId: 'policy-7' }, tx)
      }
      for (const [index, status, time, branchId] of [
        [0, 'received', period.startUtc, 'q1'],
        [1, 'done', new Date(Date.parse(period.endUtc) - 1), 'q1'],
        [2, 'processing', period.endUtc, 'q1'],
        [3, 'processing', previousPeriod.startUtc, 'q1'],
        [7, 'received', period.startUtc, 'q3'],
      ]) {
        const id = randomUUID()
        ticketIds.push(id)
        await insert('warranty_tickets', { id, branchId, saleLineId: lineIds[index], policyId: 'policy-7',
          status, date: new Date(time), reason: 'A12 fixture', createdBy: 'quang' }, tx)
      }
      for (const [fromBranch, toBranch, status, qty, receivedQty] of [
        ['q1', 'q3', 'moving', 4, 1], ['q3', 'q1', 'review', 5, 0],
        ['q1', 'q3', 'pending', 10, 0], ['q1', 'q3', 'received', 5, 5],
        ['q3', 'pn', 'moving', 9, 0],
      ]) {
        const id = randomUUID()
        transferIds.push(id)
        await insert('transfers', { id, fromBranch, toBranch, status, note: fixture, date: new Date(previousPeriod.startUtc), createdBy: 'quang' }, tx)
        await insert('transfer_lines', { id: randomUUID(), transferId: id, productId: '7', qty, receivedQty }, tx)
      }
    })
    await t.test('sales keeps daily compatibility and separates both exact periods', async () => {
      const result = await report('sales')
      assert.equal(result.type, 'sales')
      assert.equal(result.timeZone, 'Asia/Bangkok')
      assert.equal(result.current.total - before.sales.current.total, 300)
      assert.equal(result.current.orders - before.sales.current.orders, 2)
      assert.equal(result.previous.total - before.sales.previous.total, 700)
      assert.equal(result.previous.orders - before.sales.previous.orders, 2)
      assert.ok(result.daily.every((r) => r.day >= previousPeriod.from && r.day <= period.to))
      assert.equal(result.daily.reduce((s, r) => s + r.total, 0), result.current.total + result.previous.total)
      for (const days of ['30', '90']) assert.equal((await report('sales', 'q1', days)).days, Number(days))
    })
    await t.test('inventory is current stock and reports both directions without double counting available', async () => {
      const result = await report('inventory')
      assert.equal(result.daily, undefined)
      assert.equal(result.totals.available, before.inventory.totals.available)
      assert.equal(result.totals.movingOut - before.inventory.totals.movingOut, 3)
      assert.equal(result.totals.movingIn - before.inventory.totals.movingIn, 5)
      const [sql] = await query("SELECT COALESCE(SUM(available),0) qty FROM dbo.stock_balances b JOIN dbo.skus s ON s.id=b.productId WHERE b.branchId='q1' AND s.category=N'Phụ kiện'")
      assert.equal(result.items.filter((r) => r.category === 'Phụ kiện').reduce((s, r) => s + r.available, 0), sql.qty)
      assert.equal(result.items.reduce((s, r) => s + r.available, 0), result.totals.available)
    })
    await t.test('in-transit includes moving/review, remaining quantity and selected branch only', async () => {
      const result = await report('in-transit')
      const fixtures = result.items.filter((row) => transferIds.includes(row.transferId))
      assert.deepEqual(new Set(fixtures.map((row) => row.transferId)), new Set(transferIds.slice(0, 2)))
      assert.equal(result.totals.outgoingQty - before['in-transit'].totals.outgoingQty, 3)
      assert.equal(result.totals.incomingQty - before['in-transit'].totals.incomingQty, 5)
      assert.equal(result.totals.documents - before['in-transit'].totals.documents, 2)
      assert.ok(result.items.every((r) => r.fromBranch === 'q1' || r.toBranch === 'q1'))
      const [sql] = await query("SELECT COALESCE(SUM(l.qty-l.receivedQty),0) qty FROM dbo.transfer_lines l JOIN dbo.transfers t ON t.id=l.transferId WHERE (t.fromBranch='q1' OR t.toBranch='q1') AND t.status IN ('moving','review') AND l.receivedQty<l.qty")
      assert.equal(result.totals.remainingQty, sql.qty)
    })
    await t.test('warranty filters ticket creation date and sums each status', async () => {
      const result = await report('warranty')
      assert.equal(result.daily, undefined)
      assert.equal(result.totals.tickets - before.warranty.totals.tickets, 2)
      assert.equal(result.totals.received - before.warranty.totals.received, 1)
      assert.equal(result.totals.done - before.warranty.totals.done, 1)
      assert.deepEqual(new Set(result.items.filter((row) => ticketIds.includes(row.id)).map((row) => row.id)), new Set(ticketIds.slice(0, 2)))
      const [sql] = await query('SELECT COUNT(*) count FROM dbo.warranty_tickets WHERE branchId=@branchId AND date>=@start AND date<@end',
        { branchId: 'q1', start: new Date(period.startUtc), end: new Date(period.endUtc) })
      assert.equal(result.totals.tickets, sql.count)
      assert.equal(result.byStatus.reduce((s, r) => s + r.count, 0), result.items.length)
    })
    await t.test('unsupported type, invalid days, missing role and wrong branch are rejected', async () => {
      assert.equal((await call('/reports/unknown')).status, 422)
      for (const days of ['0', '91', '7.5', 'abc', '', '7&days=30']) assert.equal((await call('/reports/sales?days=' + days)).status, 422)
      const restricted = await call('/auth/login', { session: '', body: { username: 'thungan.hk', password: process.env.SEED_PASSWORD || 'PhoneFlow@123' } })
      assert.equal(restricted.status, 200)
      for (const type of ['sales', 'inventory', 'in-transit', 'warranty']) {
        assert.equal((await call('/reports/' + type, { session: restricted.cookie })).status, 403)
        assert.equal((await call('/reports/' + type, { branch: 'q3', session: restricted.cookie })).status, 403)
        assert.equal((await call('/reports/' + type, { session: '' })).status, 401)
      }
    })
  } finally {
    await transaction(async (tx) => {
      for (const id of ticketIds) await query('DELETE dbo.warranty_tickets WHERE id=@id', { id }, tx)
      for (const id of transferIds) await query('DELETE dbo.transfer_lines WHERE transferId=@id;DELETE dbo.transfers WHERE id=@id', { id }, tx)
      for (const id of lineIds) await query('DELETE dbo.sale_lines WHERE id=@id', { id }, tx)
      for (const id of saleIds) await query('DELETE dbo.sales_orders WHERE id=@id', { id }, tx)
    })
    await call('/auth/logout', { body: {} })
  }
})
test.after(close)

