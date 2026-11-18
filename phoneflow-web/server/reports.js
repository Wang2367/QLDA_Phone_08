import { query } from './db.js'
import { authorize, requireThat } from './auth.js'

const dayMs = 86400000
const offsetMs = 7 * 3600000
const types = ['sales', 'inventory', 'in-transit', 'warranty']

export function reportWindow(value = 7, now = new Date()) {
  requireThat((typeof value === 'string' && /^\d+$/.test(value)) || typeof value === 'number', 'days phải là số nguyên từ 1 đến 90.', 422)
  const days = Number(value)
  requireThat(Number.isInteger(days) && days >= 1 && days <= 90, 'days phải là số nguyên từ 1 đến 90.', 422)
  const today = new Date(now.getTime() + offsetMs).toISOString().slice(0, 10)
  const midnight = Date.parse(today + 'T00:00:00+07:00')
  const dateOnly = (timestamp) => new Date(timestamp + offsetMs).toISOString().slice(0, 10)
  const start = midnight - (days - 1) * dayMs
  const end = midnight + dayMs
  const previousStart = start - days * dayMs
  return {
    days,
    period: { from: dateOnly(start), to: today, startUtc: new Date(start).toISOString(), endUtc: new Date(end).toISOString() },
    previousPeriod: { from: dateOnly(previousStart), to: dateOnly(start - dayMs), startUtc: new Date(previousStart).toISOString(), endUtc: new Date(start).toISOString() },
  }
}

function sumSales(rows) {
  return rows.reduce((total, row) => ({ total: total.total + row.total, orders: total.orders + row.orders }), { total: 0, orders: 0 })
}

async function salesReport(branchId, window) {
  const daily = (await query(
    "SELECT CONVERT(char(10),DATEADD(hour,7,date),23) day,SUM(total) total,COUNT(*) orders " +
    "FROM dbo.sales_orders WHERE branchId=@branchId AND status='paid' AND date>=@start AND date<@end " +
    "GROUP BY CONVERT(char(10),DATEADD(hour,7,date),23) ORDER BY day",
    { branchId, start: new Date(window.previousPeriod.startUtc), end: new Date(window.period.endUtc) },
  )).map((row) => ({ ...row, total: Number(row.total) }))
  return {
    ...window, daily,
    current: sumSales(daily.filter((row) => row.day >= window.period.from)),
    previous: sumSales(daily.filter((row) => row.day < window.period.from)),
  }
}

async function inventoryReport(branchId) {
  const items = await query(
    "SELECT s.id productId,s.sku,s.name,s.category,s.active," +
    "CASE WHEN s.category=N'Điện thoại' THEN (SELECT COUNT(*) FROM dbo.devices d WHERE d.productId=s.id AND d.branchId=@branchId AND d.status='available') ELSE COALESCE(b.available,0) END available," +
    "CASE WHEN s.category=N'Điện thoại' THEN (SELECT COUNT(*) FROM dbo.devices d WHERE d.productId=s.id AND d.branchId=@branchId AND d.status='quarantine') ELSE COALESCE(b.quarantine,0) END quarantine," +
    "(SELECT COUNT(*) FROM dbo.devices d WHERE d.productId=s.id AND d.branchId=@branchId AND d.status='warranty') inWarranty," +
    "COALESCE((SELECT SUM(l.qty-l.receivedQty) FROM dbo.transfer_lines l JOIN dbo.transfers t ON t.id=l.transferId WHERE l.productId=s.id AND t.fromBranch=@branchId AND t.status IN ('moving','review')),0) movingOut," +
    "COALESCE((SELECT SUM(l.qty-l.receivedQty) FROM dbo.transfer_lines l JOIN dbo.transfers t ON t.id=l.transferId WHERE l.productId=s.id AND t.toBranch=@branchId AND t.status IN ('moving','review')),0) movingIn " +
    "FROM dbo.skus s LEFT JOIN dbo.stock_balances b ON b.productId=s.id AND b.branchId=@branchId ORDER BY s.sku",
    { branchId },
  )
  const totals = { available: 0, quarantine: 0, inWarranty: 0, movingOut: 0, movingIn: 0 }
  for (const row of items) for (const field of Object.keys(totals)) totals[field] += row[field]
  return { items, totals }
}

async function inTransitReport(branchId) {
  const items = await query(
    "SELECT t.id transferId,l.id lineId,t.fromBranch,t.toBranch,fb.name fromName,tb.name toName,t.status,t.date," +
    "l.productId,s.sku,s.name productName,l.deviceId,l.qty qtySent,l.receivedQty, l.qty-l.receivedQty remainingQty," +
    "CASE WHEN t.fromBranch=@branchId THEN 'outgoing' ELSE 'incoming' END direction " +
    "FROM dbo.transfers t JOIN dbo.transfer_lines l ON l.transferId=t.id JOIN dbo.skus s ON s.id=l.productId " +
    "JOIN dbo.branches fb ON fb.id=t.fromBranch JOIN dbo.branches tb ON tb.id=t.toBranch " +
    "WHERE (t.fromBranch=@branchId OR t.toBranch=@branchId) AND t.status IN ('moving','review') AND l.receivedQty<l.qty ORDER BY t.date DESC,t.id,l.id",
    { branchId },
  )
  const totals = { documents: new Set(items.map((row) => row.transferId)).size, remainingQty: 0, outgoingQty: 0, incomingQty: 0 }
  for (const row of items) {
    totals.remainingQty += row.remainingQty
    totals[row.direction === 'outgoing' ? 'outgoingQty' : 'incomingQty'] += row.remainingQty
  }
  return { items, totals }
}

async function warrantyReport(branchId, window) {
  const items = await query(
    "SELECT t.id,t.status,t.reason,t.date,t.createdBy,t.saleLineId,t.policyId,l.saleId orderId,l.productId,l.deviceId," +
    "l.name productName,l.sku,s.customer " +
    "FROM dbo.warranty_tickets t JOIN dbo.sale_lines l ON l.id=t.saleLineId JOIN dbo.sales_orders s ON s.id=l.saleId " +
    "WHERE t.branchId=@branchId AND t.date>=@start AND t.date<@end ORDER BY t.date DESC,t.id",
    { branchId, start: new Date(window.period.startUtc), end: new Date(window.period.endUtc) },
  )
  const byStatus = ['received', 'processing', 'done'].map((status) => ({ status, count: items.filter((item) => item.status === status).length }))
  return { days: window.days, period: window.period, items, byStatus,
    totals: { tickets: items.length, ...Object.fromEntries(byStatus.map((row) => [row.status, row.count])) } }
}

export async function reports(user, branchId, type = 'sales', days = 7) {
  authorize(user, branchId, 'reports')
  requireThat(types.includes(type), 'Loại báo cáo hợp lệ: sales, inventory, in-transit, warranty.', 422)
  const now = new Date()
  const window = reportWindow(days, now)
  const context = { type, branchId, asOf: now.toISOString(), timeZone: 'Asia/Bangkok' }
  if (type === 'sales') return { ...context, ...await salesReport(branchId, window) }
  if (type === 'inventory') return { ...context, ...await inventoryReport(branchId) }
  if (type === 'in-transit') return { ...context, ...await inTransitReport(branchId) }
  return { ...context, ...await warrantyReport(branchId, window) }
}

