import { query } from './db.js'
import { authorize } from './auth.js'

export async function devicesFor(branchId, tx) {
  const devices = await query('SELECT * FROM dbo.devices WHERE branchId=@branchId', { branchId }, tx)
  const imeis = await query('SELECT i.* FROM dbo.device_imeis i JOIN dbo.devices d ON d.id=i.deviceId WHERE d.branchId=@branchId', { branchId }, tx)
  return devices.map((d) => ({ ...d, imeis: imeis.filter((i) => i.deviceId === d.id).map((i) => i.imei) }))
}
export async function ordersFor(branchId, tx, includeDrafts = false) {
  const rows = await query("SELECT * FROM dbo.sales_orders WHERE branchId=@branchId AND (@drafts=1 OR status='paid') ORDER BY date DESC", { branchId, drafts: includeDrafts }, tx)
  const lines = await query('SELECT l.* FROM dbo.sale_lines l JOIN dbo.sales_orders s ON s.id=l.saleId WHERE s.branchId=@branchId ORDER BY l.lineIndex', { branchId }, tx)
  return rows.map((row) => ({ ...row, total: Number(row.total),
    lines: lines.filter((line) => line.saleId === row.id).map((line) => ({ ...line, price: Number(line.price) })),
  }))
}
export async function transfersFor(branchId, tx) {
  const headers = await query('SELECT id,fromBranch [from],toBranch [to],status,note,discrepancy,resolution,date,updatedAt FROM dbo.transfers WHERE fromBranch=@branchId OR toBranch=@branchId ORDER BY date DESC', { branchId }, tx)
  const lines = await query('SELECT l.* FROM dbo.transfer_lines l JOIN dbo.transfers h ON h.id=l.transferId WHERE h.fromBranch=@branchId OR h.toBranch=@branchId ORDER BY l.id', { branchId }, tx)
  return headers.map((h) => {
    const children = lines.filter((l) => l.transferId === h.id)
    return { ...children[0], ...h, lines: children }
  })
}
export async function servicesFor(branchId, tx) {
  const tickets = await query("SELECT t.*,l.saleId orderId,l.lineIndex,'warranty' type,1 qty FROM dbo.warranty_tickets t JOIN dbo.sale_lines l ON l.id=t.saleLineId WHERE t.branchId=@branchId", { branchId }, tx)
  const returns = await query("SELECT t.*,l.saleId orderId,l.lineIndex,'return' type FROM dbo.returns t JOIN dbo.sale_lines l ON l.id=t.saleLineId WHERE t.branchId=@branchId", { branchId }, tx)
  const events = await query("SELECT e.*,e.ticketId parentId FROM dbo.warranty_events e JOIN dbo.warranty_tickets t ON t.id=e.ticketId WHERE t.branchId=@branchId UNION ALL SELECT e.id,e.returnId,e.actorId,e.status,e.note,e.date,e.returnId FROM dbo.return_events e JOIN dbo.returns t ON t.id=e.returnId WHERE t.branchId=@branchId ORDER BY date", { branchId }, tx)
  return [...tickets, ...returns].map((item) => ({ ...item, history: events.filter((e) => e.parentId === item.id) }))
}
export async function countsFor(branchId, tx) {
  const rows = await query('SELECT * FROM dbo.stock_counts WHERE branchId=@branchId ORDER BY date DESC', { branchId }, tx)
  const lines = await query('SELECT l.* FROM dbo.count_lines l JOIN dbo.stock_counts c ON c.id=l.countId WHERE c.branchId=@branchId', { branchId }, tx)
  return rows.map((row) => ({ ...row, rows: lines.filter((line) => line.countId === row.id).map((line) => ({ ...line, devices: JSON.parse(line.devices || '[]') })) }))
}
export async function balances(branchId, tx) {
  return query("SELECT s.id productId,CASE WHEN s.category=N'Điện thoại' THEN (SELECT COUNT(*) FROM dbo.devices d WHERE d.productId=s.id AND d.branchId=@branchId AND d.status='available') ELSE COALESCE(b.available,0) END available,CASE WHEN s.category=N'Điện thoại' THEN (SELECT COUNT(*) FROM dbo.devices d WHERE d.productId=s.id AND d.branchId=@branchId AND d.status='quarantine') ELSE COALESCE(b.quarantine,0) END quarantine,COALESCE(b.revision,0) revision FROM dbo.skus s LEFT JOIN dbo.stock_balances b ON b.productId=s.id AND b.branchId=@branchId", { branchId }, tx)
}
export async function snapshot(user, branchId, tx) {
  const branch = authorize(user, branchId)
  const can = (p) => branch.permissions.includes(p)
  const products = (await query('SELECT * FROM dbo.skus', {}, tx)).map((p) => ({ ...p, price: Number(p.price) }))
  const rows = await query('SELECT * FROM dbo.stock_balances WHERE branchId=@branchId', { branchId }, tx)
  return {
    products,
    devices: await devicesFor(branchId, tx),
    quantities: Object.fromEntries(rows.map((r) => [[r.branchId, r.productId].join(':'), r])),
    orders: can('sale') || can('aftercare') || can('reports') ? await ordersFor(branchId, tx) : [],
    services: can('aftercare') || can('reports') ? await servicesFor(branchId, tx) : [],
    movements: can('stock') || can('reports') ? await query('SELECT * FROM dbo.stock_movements WHERE branchId=@branchId ORDER BY date DESC', { branchId }, tx) : [],
    transfers: can('stock') || can('reports') ? await transfersFor(branchId, tx) : [],
    counts: can('stock') || can('approve') ? await countsFor(branchId, tx) : [],
    balances: await balances(branchId, tx),
    branches: await query('SELECT * FROM dbo.branches'),
  }
}
export async function lookup(user, branchId, code, tx) {
  authorize(user, branchId)
  const [device] = await query('SELECT TOP 1 d.* FROM dbo.devices d LEFT JOIN dbo.device_imeis i ON i.deviceId=d.id WHERE d.branchId=@branchId AND (d.serial=@code OR i.imei=@code)', { branchId, code: String(code).trim() }, tx)
  const [product] = await query('SELECT TOP 1 * FROM dbo.skus WHERE id=@id OR sku=@code', { id: device?.productId, code: String(code).trim() }, tx)
  if (!product) return null
  const quantity = (await balances(branchId, tx)).find((b) => b.productId === product.id)
  const imeis = device ? await query('SELECT imei FROM dbo.device_imeis WHERE deviceId=@id', { id: device.id }, tx) : []
  return { product: { ...product, price: Number(product.price) }, device: device ? { ...device, imeis: imeis.map((i) => i.imei) } : null, ...quantity, updatedAt: new Date().toISOString() }
}
export { reports } from './reports.js'

