import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { sql, connection, databaseName, connect, query, insert, transaction, close } from '../server/db.js'
import { passwordHash } from '../server/auth.js'
import { branches, isPhone } from '../src/data.js'
import { seedData } from '../server/seed-data.js'

const master = await new sql.ConnectionPool(connection('master')).connect()
try {
  const request = master.request()
  request.input('name', sql.NVarChar(128), databaseName)
  await request.query("IF DB_ID(@name) IS NULL EXEC('CREATE DATABASE [" + databaseName + "]')")
} finally { await master.close() }
await connect()
const schema = await readFile(new URL('../sql/001_schema.sql', import.meta.url), 'utf8')
for (const batch of schema.split(/^\s*GO\s*$/mi).filter((part) => part.trim())) await query(batch)
await transaction(async (tx) => {
  const [count] = await query('SELECT COUNT(*) count FROM dbo.users', {}, tx)
  if (count.count) { console.log('Schema hiện hành. Dữ liệu đã có, giữ nguyên.'); return }
  for (const branch of branches) await insert('branches', branch, tx)
  for (const [id, name] of Object.entries({ admin: 'Quản trị', manager: 'Quản lý', warehouse: 'Thủ kho', cashier: 'Thu ngân', aftercare: 'Hậu mãi' })) await insert('roles', { id, name }, tx)
  const accounts = [
    ['quang', 'Quang', 'admin', branches.map((b) => b.id)],
    ['cong', 'Công', 'warehouse', branches.map((b) => b.id)],
    ['tuan', 'Tuấn', 'aftercare', branches.map((b) => b.id)],
    ['quanly.hk', 'Quản lý Hoàn Kiếm', 'manager', ['q1']],
    ['thungan.hk', 'Thu ngân Hoàn Kiếm', 'cashier', ['q1']],
  ]
  for (const [username, name, roleId, branchIds] of accounts) {
    await insert('users', { id: username, username, name, passwordHash: passwordHash(process.env.SEED_PASSWORD || 'PhoneFlow@123'), active: true }, tx)
    for (const branchId of branchIds) await insert('user_branch_roles', { userId: username, branchId, roleId }, tx)
  }
  const seed = seedData()
  for (const p of seed.products) {
    await insert('products', { id: 'p-' + p.id, name: p.name, brand: p.brand, trackingType: isPhone(p) ? 'device' : 'quantity' }, tx)
    await insert('skus', { ...p, parentId: 'p-' + p.id, active: true }, tx)
    await insert('warranty_policies', { id: 'policy-' + p.id, productId: p.id, months: 12,
      coverage: 'Lỗi kỹ thuật theo kiểm tra của bộ phận hậu mãi.', exclusions: 'Rơi vỡ, vào nước, can thiệp sửa chữa trái quy định.',
      effectiveAt: new Date('2020-01-01T00:00:00Z') }, tx)
  }
  for (const d of seed.devices) {
    const { imeis, ...device } = d
    await insert('devices', device, tx)
    for (const imei of imeis) await insert('device_imeis', { imei, deviceId: d.id }, tx)
  }
  for (const [key, qty] of Object.entries(seed.quantities)) {
    const [branchId, productId] = key.split(':')
    await insert('stock_balances', { branchId, productId, ...qty, revision: 0 }, tx)
  }
  for (const order of seed.orders) {
    const { lines, ...header } = order
    await insert('sales_orders', { ...header, date: new Date(header.date), paidAt: new Date(header.date), status: 'paid', invoiceNo: order.id, cashierId: 'quang' }, tx)
    for (const [lineIndex, line] of lines.entries()) await insert('sale_lines', {
      ...line, deviceId: line.deviceId ?? null, id: order.id + '-' + lineIndex, saleId: order.id, lineIndex, policyId: 'policy-' + line.productId,
    }, tx)
  }
  for (const ticket of seed.services) {
    await insert('warranty_tickets', { id: ticket.id, saleLineId: ticket.orderId + '-' + ticket.lineIndex, branchId: ticket.branchId,
      policyId: 'policy-' + seed.orders.find((o) => o.id === ticket.orderId).lines[ticket.lineIndex].productId,
      reason: ticket.reason, status: ticket.status, createdBy: 'tuan', date: new Date(ticket.date) }, tx)
    for (const event of ticket.history) await insert('warranty_events', { id: randomUUID(), ticketId: ticket.id, actorId: 'tuan', status: event.status, note: 'Dữ liệu mẫu khởi tạo.', date: new Date(event.date) }, tx)
  }
  // Opening balances are explicit. Earlier seeded sales are historical records.
  for (const branch of branches) {
    for (const product of seed.products) {
      const matching = seed.devices.filter((d) => d.branchId === branch.id && d.productId === product.id && d.status === 'available')
      const qty = seed.quantities[branch.id + ':' + product.id] ?? {}
      const available = isPhone(product) ? matching.length : qty.available
      if (available) await insert('stock_movements', { id: randomUUID(), branchId: branch.id, productId: product.id,
        deviceId: null, actorId: 'quang', qty: available, deltaAvailable: available, deltaQuarantine: 0,
        type: 'Số dư đầu kỳ', sourceType: 'opening', sourceId: branch.id + '-' + product.id, leg: 'available',
        note: 'Số dư khởi tạo tại thời điểm đưa hệ thống vào sử dụng.', date: new Date() }, tx)
      if (qty.quarantine) await insert('stock_movements', { id: randomUUID(), branchId: branch.id, productId: product.id, deviceId: null,
        actorId: 'quang', qty: qty.quarantine, deltaAvailable: 0, deltaQuarantine: qty.quarantine, type: 'Số dư cách ly',
        sourceType: 'opening', sourceId: branch.id + '-' + product.id, leg: 'quarantine', note: 'Khởi tạo hàng cách ly.', date: new Date() }, tx)
    }
  }
  console.log('Đã tạo 5 chi nhánh, 5 tài khoản, danh mục và lịch sử bán hàng mẫu.')
})
await close()
console.log('SQL Server ' + databaseName + ' sẵn sàng.')

