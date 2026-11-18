import express from 'express'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { connect, query, insert, transaction } from './db.js'
import {
  HttpError, requireThat, digest, passwordMatches, sessionToken, cookieToken, profile, authenticate, authorize,
} from './auth.js'
import { snapshot, lookup, reports, ordersFor, transfersFor, servicesFor, countsFor, balances } from './read.js'
import * as ops from './operations.js'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))
app.use((req, res, next) => {
  req.requestId = randomUUID()
  res.setHeader('X-Request-ID', req.requestId)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
    let origin
    try { origin = new URL(req.headers.origin).host } catch { return next(new HttpError(403, 'Origin không hợp lệ.')) }
    if (origin !== (req.headers['x-forwarded-host'] || req.headers.host)) return next(new HttpError(403, 'Yêu cầu đến từ nguồn khác.'))
  }
  next()
})
app.get('/api/v1/health', async (req, res) => {
  await query('SELECT 1 ok')
  res.json({ status: 'ok', database: 'SQL Server', version: '5.9' })
})
const attempts = new Map()
app.post('/api/v1/auth/login', async (req, res) => {
  const key = req.ip
  const attempt = attempts.get(key) ?? { count: 0, until: Date.now() + 60000 }
  if (Date.now() > attempt.until) { attempt.count = 0; attempt.until = Date.now() + 60000 }
  requireThat(attempt.count < 15, 'Thử lại sau một phút.', 429)
  attempts.set(key, attempt)
  const username = ops.text(req.body.username, 'Tài khoản', 50).toLowerCase()
  const password = ops.text(req.body.password, 'Mật khẩu', 200)
  const [user] = await query('SELECT * FROM dbo.users WHERE username=@username AND active=1', { username })
  if (!user || !passwordMatches(password, user.passwordHash)) {
    attempt.count++
    throw new HttpError(401, 'Tài khoản hoặc mật khẩu chưa đúng.')
  }
  attempts.delete(key)
  const token = sessionToken()
  await transaction(async (tx) => {
    const previous = cookieToken(req)
    if (previous) await query('DELETE dbo.sessions WHERE tokenHash=@hash', { hash: digest(previous) }, tx)
    await insert('sessions', { tokenHash: digest(token), userId: user.id, expiresAt: new Date(Date.now() + 8 * 3600000) }, tx)
    await ops.audit(user, null, 'auth.login', user.id, {}, tx)
  })
  res.cookie('phoneflow_sid', token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: 8 * 3600000, path: '/' })
  res.json({ user: await profile(user.id) })
})
app.use('/api/v1', authenticate)
app.post('/api/v1/auth/logout', async (req, res) => {
  await query('DELETE dbo.sessions WHERE tokenHash=@hash', { hash: digest(cookieToken(req)) })
  res.clearCookie('phoneflow_sid', { path: '/' })
  res.status(204).end()
})
app.get('/api/v1/me/permissions', (req, res) => res.json({ user: req.user }))
app.use('/api/v1', (req, res, next) => {
  try {
    req.branchId = req.headers['x-branch-id'] || req.query.branchId || req.body?.branchId
    authorize(req.user, req.branchId)
    next()
  } catch (error) { next(error) }
})

function read(route, callback, permission) {
  app.get('/api/v1' + route, async (req, res) => {
    authorize(req.user, req.branchId, permission)
    res.json(await callback(req))
  })
}
function write(route, callback) {
  app.post('/api/v1' + route, async (req, res) => runWrite(req, res, callback))
}
function patch(route, callback) {
  app.patch('/api/v1' + route, async (req, res) => runWrite(req, res, callback))
}
async function runWrite(req, res, callback) {
  const key = ops.text(req.headers['idempotency-key'], 'Idempotency-Key', 100)
  const action = req.method + ' ' + req.path
  const hash = digest(JSON.stringify([req.branchId, req.body]))
  const value = await transaction(async (tx) => {
    const identity = { userId: req.user.id, action, requestKey: key }
    const [saved] = await query('SELECT * FROM dbo.request_keys WHERE userId=@userId AND action=@action AND requestKey=@requestKey', identity, tx)
    if (saved) {
      requireThat(saved.requestHash === hash, 'Khóa yêu cầu đã dùng với dữ liệu khác.')
      return JSON.parse(saved.response)
    }
    const result = await callback(req, tx)
    await insert('request_keys', { ...identity, requestHash: hash, response: JSON.stringify(result), date: new Date() }, tx)
    return result
  })
  res.json(value)
}
read('/bootstrap', (req) => snapshot(req.user, req.branchId))
read('/skus', () => query('SELECT * FROM dbo.skus'))
read('/products', () => query('SELECT * FROM dbo.products'))
write('/products', async (r, tx) => {
  authorize(r.user, r.branchId, 'catalog')
  const id = randomUUID()
  await insert('products', { id, name: ops.text(r.body.name, 'Tên', 120), brand: ops.text(r.body.brand, 'Thương hiệu', 60),
    trackingType: r.body.trackingType === 'device' ? 'device' : 'quantity' }, tx)
  await ops.audit(r.user, r.branchId, 'product.create', id, {}, tx)
  return { id }
})
write('/skus', (r, tx) => ops.saveProduct(r.user, r.branchId, r.body, tx))
patch('/skus/:id', (r, tx) => ops.saveProduct(r.user, r.branchId, r.body, tx, r.params.id))
read('/devices', async (req) => (await snapshot(req.user, req.branchId)).devices)
write('/devices', async (r, tx) => {
  authorize(r.user, r.branchId, 'catalog')
  const receipt = await ops.createReceipt(r.user, r.branchId, { ...r.body, type: 'Nhập kho', note: r.body.note || 'Đăng ký thiết bị nhập kho' }, tx)
  await ops.confirmReceipt(r.user, r.branchId, receipt.id, tx)
  return lookup(r.user, r.branchId, Array.isArray(r.body.imeis) ? r.body.imeis[0] : String(r.body.imeis).split(/[,;\s]+/)[0], tx)
})
read('/lookup', async (req) => {
  const found = await lookup(req.user, req.branchId, ops.text(req.query.q, 'Mã tra cứu', 100))
  requireThat(found, 'Không tìm thấy mã tại chi nhánh.', 404)
  return found
})
patch('/devices/:id/identifiers', async (r, tx) => {
  authorize(r.user, r.branchId, 'catalog')
  const [device] = await query('SELECT * FROM dbo.devices WHERE id=@id AND branchId=@branchId', { id: r.params.id, branchId: r.branchId }, tx)
  requireThat(device && device.status === 'available', 'Chỉ sửa định danh của máy khả dụng tại chi nhánh.')
  const imeis = r.body.imeis
  requireThat(Array.isArray(imeis) && imeis.length > 0 && imeis.length <= 4 && new Set(imeis).size === imeis.length && imeis.every((i) => /^\d{15}$/.test(i)), 'IMEI không hợp lệ.', 422)
  const sold = await query('SELECT TOP 1 id FROM dbo.sale_lines WHERE deviceId=@id', { id: device.id }, tx)
  requireThat(!sold.length, 'Thiết bị đã có lịch sử bán. Giữ định danh để truy vết.')
  await query('UPDATE dbo.devices SET serial=@serial WHERE id=@id; DELETE dbo.device_imeis WHERE deviceId=@id;', { id: device.id, serial: ops.text(r.body.serial, 'Serial', 60) }, tx)
  for (const imei of imeis) await insert('device_imeis', { imei, deviceId: device.id }, tx)
  await ops.audit(r.user, r.branchId, 'device.identifiers', device.id, {}, tx)
  return { id: device.id, imeis }
})
read('/inventory', (r) => balances(r.branchId))
read('/inventory/movements', (r) => query('SELECT * FROM dbo.stock_movements WHERE branchId=@branchId ORDER BY date DESC', { branchId: r.branchId }), 'stock')
read('/receipts', (r) => query('SELECT * FROM dbo.receipts WHERE branchId=@branchId ORDER BY date DESC', { branchId: r.branchId }), 'stock')
write('/receipts', (r, tx) => ops.createReceipt(r.user, r.branchId, r.body, tx))
write('/receipts/:id/confirm', (r, tx) => ops.confirmReceipt(r.user, r.branchId, r.params.id, tx))
read('/sales', (r) => ordersFor(r.branchId, null, true), 'sale')
write('/sales', (r, tx) => ops.createSale(r.user, r.branchId, r.body, tx))
write('/sales/:id/confirm', (r, tx) => ops.confirmSale(r.user, r.branchId, r.params.id, r.body, tx))
read('/warranty/eligibility', (r) => ops.eligibility(r.user, r.branchId, { code: r.query.q || r.query.code }), 'aftercare')
read('/warranty/policies', () => query('SELECT * FROM dbo.warranty_policies ORDER BY effectiveAt DESC'))
write('/warranty/policies', (r, tx) => ops.savePolicy(r.user, r.branchId, r.body, tx))
read('/warranty/tickets', (r) => servicesFor(r.branchId), 'aftercare')
write('/warranty/tickets', (r, tx) => ops.createService(r.user, r.branchId, r.body, 'warranty', tx))
write('/warranty/tickets/:id/events', (r, tx) => ops.transitionService(r.user, r.branchId, r.params.id, r.body, 'warranty', tx))
write('/returns', (r, tx) => ops.createService(r.user, r.branchId, r.body, 'return', tx))
write('/returns/:id/approve', (r, tx) => ops.transitionService(r.user, r.branchId, r.params.id, { ...r.body, next: 'approved' }, 'return', tx))
write('/returns/:id/receive', (r, tx) => ops.transitionService(r.user, r.branchId, r.params.id, { ...r.body, next: 'returned' }, 'return', tx))
read('/transfers', (r) => transfersFor(r.branchId), 'stock')
write('/transfers', (r, tx) => ops.createTransfer(r.user, r.branchId, r.body, tx))
for (const [path, action] of Object.entries({ approve: 'approve', dispatch: 'dispatch', discrepancies: 'report', reconcile: 'reconcile', receive: 'receive' })) {
  write('/transfers/:id/' + path, (r, tx) => ops.transitionTransfer(r.user, r.branchId, r.params.id, action, r.body, tx))
}
read('/counts', (r) => countsFor(r.branchId), 'stock')
write('/counts', (r, tx) => ops.createCount(r.user, r.branchId, r.body, tx))
for (const action of ['submit', 'approve']) write('/counts/:id/' + action, (r, tx) => ops.transitionCount(r.user, r.branchId, r.params.id, action, r.body, tx))
read('/reports/:type', (r) => reports(r.user, r.branchId, r.params.type, r.query.days), 'reports')
read('/audit-events', (r) => query('SELECT TOP 300 a.*,u.name actorName FROM dbo.audit_events a JOIN dbo.users u ON u.id=a.actorId WHERE a.branchId=@branchId ORDER BY a.date DESC', { branchId: r.branchId }), 'audit')
app.use('/api', (req, res, next) => next(new HttpError(404, 'API không tồn tại.')))

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
app.use(express.static(path.join(root, 'dist')))
app.get('/mobile', (req, res) => res.sendFile(path.join(root, 'dist/index.html')))
app.use((err, req, res, next) => {
  const sqlNumber = err.number || err.originalError?.info?.number || err.originalError?.number
  let status = err.status || 500
  let message = err.message
  if ([2601, 2627].includes(sqlNumber) || /duplicate key|UNIQUE KEY|unique index/i.test(message)) {
    status = 409; message = 'SKU, serial, IMEI hoặc giao dịch đã tồn tại.'
  }
  if (status === 500) {
    console.error(req.requestId, err.code, err.message)
    message = 'Máy chủ chưa xử lý được yêu cầu. Thử lại hoặc kiểm tra kết nối SQL Server.'
  }
  res.status(status).json({ error: { code: err.code || 'SERVER_ERROR', message }, requestId: req.requestId })
})
await connect()
const port = Number(process.env.PORT || 3001)
app.listen(port, process.env.HOST || '127.0.0.1', () => console.log('PhoneFlow API và Web: http://' + (process.env.HOST || '127.0.0.1') + ':' + port))

