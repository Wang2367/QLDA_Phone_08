import { randomUUID } from 'node:crypto'
import { query, insert } from './db.js'
import { authorize, requireThat } from './auth.js'
import { balances, ordersFor, servicesFor, transfersFor, countsFor } from './read.js'

const uid = () => randomUUID()
const date = () => new Date()
export function text(value, label, max = 300, optional = false) {
  requireThat(typeof value === 'string' || (optional && value == null), label + ' không hợp lệ.', 422)
  const result = String(value ?? '').trim()
  requireThat((optional || result.length > 0) && result.length <= max, label + ' không hợp lệ.', 422)
  return result
}
export function integer(value, min = 1, max = 1000000) {
  const n = Number(value)
  requireThat(Number.isSafeInteger(n) && n >= min && n <= max, 'Số lượng không hợp lệ.', 422)
  return n
}
async function one(table, id, tx) {
  const [row] = await query('SELECT * FROM dbo.[' + table + '] WHERE id=@id', { id }, tx)
  requireThat(row, 'Không tìm thấy dữ liệu.', 404)
  return row
}
async function documentId(prefix, tx) {
  const [row] = await query('SELECT NEXT VALUE FOR dbo.document_sequence n', {}, tx)
  return prefix + row.n
}
export async function audit(user, branchId, action, entityId, details, tx) {
  await insert('audit_events', { id: uid(), branchId: branchId ?? null, actorId: user.id, action, entityId,
    details: JSON.stringify(details ?? {}), date: date() }, tx)
}
async function permission(user, branchId, p) { return authorize(user, branchId, p) }
async function bump(productId, branchId, tx) {
  await query('IF NOT EXISTS(SELECT 1 FROM dbo.stock_balances WHERE branchId=@branchId AND productId=@productId) INSERT dbo.stock_balances(branchId,productId) VALUES(@branchId,@productId); UPDATE dbo.stock_balances SET revision=revision+1 WHERE branchId=@branchId AND productId=@productId;', { productId, branchId }, tx)
}
async function changeQuantity(productId, branchId, bucket, delta, tx) {
  await bump(productId, branchId, tx)
  const [row] = await query('UPDATE dbo.stock_balances SET [' + bucket + ']=[' + bucket + ']+@delta OUTPUT INSERTED.available WHERE productId=@productId AND branchId=@branchId AND [' + bucket + ']+@delta>=0', { productId, branchId, delta }, tx)
  requireThat(row, 'Tồn kho không đủ hoặc đã thay đổi.')
}
async function move(user, branchId, line, type, sourceType, sourceId, deltaAvailable, deltaQuarantine, leg, tx) {
  const id = await documentId('BT-', tx)
  await insert('stock_movements', { id, branchId, productId: line.productId, deviceId: line.deviceId ?? null,
    actorId: user.id, qty: line.qty, deltaAvailable, deltaQuarantine, type, sourceType, sourceId, leg,
    note: sourceId, date: date() }, tx)
  return id
}
async function take(branchId, line, newStatus, tx) {
  const product = await one('skus', line.productId, tx)
  if (product.category === 'Điện thoại') {
    const device = await one('devices', line.deviceId, tx)
    requireThat(line.qty === 1 && device.productId === product.id && device.branchId === branchId && device.status === 'available', 'IMEI không còn khả dụng tại chi nhánh.')
    await query('UPDATE dbo.devices SET status=@status WHERE id=@id', { status: newStatus, id: device.id }, tx)
    await bump(product.id, branchId, tx)
  } else {
    requireThat(!line.deviceId, 'Phụ kiện dùng SKU và số lượng.', 422)
    await changeQuantity(product.id, branchId, 'available', -line.qty, tx)
  }
}
async function put(branchId, line, status, tx) {
  if (line.deviceId) {
    await query('UPDATE dbo.devices SET branchId=@branchId,status=@status WHERE id=@id', { branchId, status, id: line.deviceId }, tx)
    await bump(line.productId, branchId, tx)
  } else await changeQuantity(line.productId, branchId, status, line.qty, tx)
}
async function validLines(input, tx) {
  requireThat(Array.isArray(input) && input.length > 0 && input.length <= 100, 'Danh sách hàng không hợp lệ.', 422)
  const seen = new Set()
  const rows = []
  for (const value of input) {
    const product = await one('skus', value.productId, tx)
    requireThat(product.active, 'Sản phẩm đã ngừng sử dụng.')
    const qty = integer(value.qty ?? 1)
    const deviceId = value.deviceId || null
    if (product.category === 'Điện thoại') {
      requireThat(deviceId && qty === 1 && !seen.has(deviceId), 'Chọn một thiết bị khác nhau cho từng dòng.', 422)
      seen.add(deviceId)
    } else requireThat(!deviceId, 'Phụ kiện dùng số lượng.', 422)
    rows.push({ productId: product.id, deviceId, qty })
  }
  return rows
}

export async function saveProduct(user, branchId, values, tx, id) {
  await permission(user, branchId, 'catalog')
  const sku = text(values.sku, 'SKU', 40).toUpperCase()
  const name = text(values.name, 'Tên sản phẩm', 120)
  const brand = text(values.brand, 'Thương hiệu', 60)
  const price = integer(values.price, 1, 1000000000000)
  requireThat(['Điện thoại', 'Phụ kiện'].includes(values.category), 'Loại sản phẩm không hợp lệ.', 422)
  if (id) {
    const old = await one('skus', id, tx)
    requireThat(old.category === values.category, 'Loại theo dõi của SKU đã tạo được cố định.')
    await query('UPDATE dbo.skus SET name=@name,sku=@sku,brand=@brand,price=@price,active=@active WHERE id=@id', {
      id, name, sku, brand, price, active: values.active !== false,
    }, tx)
    await query('UPDATE dbo.products SET name=@name,brand=@brand WHERE id=@id', { id: old.parentId, name, brand }, tx)
  } else {
    id = uid()
    const parentId = uid()
    await insert('products', { id: parentId, name, brand, trackingType: values.category === 'Điện thoại' ? 'device' : 'quantity' }, tx)
    await insert('skus', { id, parentId, name, sku, brand, price, category: values.category, tone: 'slate', active: true }, tx)
    await insert('warranty_policies', { id: uid(), productId: id, months: 12,
      coverage: 'Lỗi kỹ thuật được hậu mãi xác nhận.', exclusions: 'Rơi vỡ, vào nước hoặc sửa chữa trái quy định.', effectiveAt: date() }, tx)
  }
  await audit(user, branchId, id ? 'catalog.save' : 'catalog.create', id, { sku }, tx)
  return one('skus', id, tx)
}

export async function createReceipt(user, branchId, input, tx) {
  await permission(user, branchId, 'stock')
  const type = input.type || 'Nhập kho'
  requireThat(['Nhập kho', 'Xuất kho'].includes(type), 'Loại phiếu không hợp lệ.', 422)
  const note = text(input.note, 'Chứng từ hoặc lý do')
  const entries = input.lines || [input]
  requireThat(Array.isArray(entries) && entries.length > 0 && entries.length <= 100, 'Danh sách hàng không hợp lệ.', 422)
  const id = await documentId(type === 'Nhập kho' ? 'NK-' : 'XK-', tx)
  await insert('receipts', { id, branchId, actorId: user.id, type, status: 'draft', note, date: date() }, tx)
  for (const entry of entries) {
    const product = await one('skus', entry.productId, tx)
    requireThat(product.active, 'SKU đã ngừng sử dụng.')
    let serial = null
    let imeis = null
    if (product.category === 'Điện thoại' && type === 'Nhập kho') {
      serial = text(entry.serial, 'Serial', 60).toUpperCase()
      const list = Array.isArray(entry.imeis) ? entry.imeis : String(entry.imeis || '').split(/[,;\s]+/).filter(Boolean)
      requireThat(list.length > 0 && list.length <= 4 && list.every((i) => /^\d{15}$/.test(i)) && new Set(list).size === list.length,
        'Cần một đến bốn IMEI 15 số khác nhau.', 422)
      imeis = JSON.stringify(list)
    }
    const qty = product.category === 'Điện thoại' ? 1 : integer(entry.qty)
    await insert('receipt_lines', { id: uid(), receiptId: id, productId: product.id, qty,
      deviceId: type === 'Xuất kho' ? entry.deviceId || null : null, serial, imeis }, tx)
  }
  await audit(user, branchId, 'receipt.create', id, {}, tx)
  return { id, status: 'draft' }
}
export async function confirmReceipt(user, branchId, id, tx) {
  await permission(user, branchId, 'stock')
  const receipt = await one('receipts', id, tx)
  requireThat(receipt.branchId === branchId, 'Phiếu thuộc chi nhánh khác.', 403)
  requireThat(receipt.status === 'draft', 'Phiếu đã được xác nhận.')
  const lines = await query('SELECT * FROM dbo.receipt_lines WHERE receiptId=@id', { id }, tx)
  for (const line of lines) {
    const product = await one('skus', line.productId, tx)
    if (receipt.type === 'Xuất kho') await take(branchId, line, 'exported', tx)
    else if (product.category === 'Điện thoại') {
      line.deviceId = uid()
      await insert('devices', { id: line.deviceId, branchId, productId: line.productId, serial: line.serial, status: 'available' }, tx)
      for (const imei of JSON.parse(line.imeis)) await insert('device_imeis', { imei, deviceId: line.deviceId }, tx)
      await query('UPDATE dbo.receipt_lines SET deviceId=@deviceId WHERE id=@id', { id: line.id, deviceId: line.deviceId }, tx)
      await bump(line.productId, branchId, tx)
    } else await changeQuantity(line.productId, branchId, 'available', line.qty, tx)
    await move(user, branchId, line, receipt.type, 'receipt', line.id, receipt.type === 'Nhập kho' ? line.qty : -line.qty, 0, 'confirm', tx)
  }
  await query("UPDATE dbo.receipts SET status='confirmed' WHERE id=@id", { id }, tx)
  await audit(user, branchId, 'receipt.confirm', id, { lines: lines.length }, tx)
  return { id, status: 'confirmed' }
}
export async function createSale(user, branchId, input, tx) {
  await permission(user, branchId, 'sale')
  const lines = await validLines(input.lines, tx)
  const id = await documentId('HD-', tx)
  const customer = text(input.customer || 'Khách lẻ', 'Khách hàng', 100)
  const prepared = []
  let total = 0
  for (const [index, line] of lines.entries()) {
    const p = await one('skus', line.productId, tx)
    if (line.deviceId) {
      const d = await one('devices', line.deviceId, tx)
      requireThat(d.productId === p.id && d.branchId === branchId && d.status === 'available', 'Thiết bị không khả dụng.')
    }
    const [policy] = await query('SELECT TOP 1 id FROM dbo.warranty_policies WHERE productId=@id AND effectiveAt<=SYSUTCDATETIME() ORDER BY effectiveAt DESC,id DESC', { id: p.id }, tx)
    total += Number(p.price) * line.qty
    prepared.push({ ...line, id: uid(), saleId: id, lineIndex: index, price: Number(p.price), name: p.name, sku: p.sku, policyId: policy?.id ?? null })
  }
  await insert('sales_orders', { id, branchId, cashierId: user.id, customer, status: 'draft', method: null, total, date: date() }, tx)
  for (const line of prepared) await insert('sale_lines', line, tx)
  await audit(user, branchId, 'sale.create', id, {}, tx)
  return (await ordersFor(branchId, tx, true)).find((o) => o.id === id)
}
export async function confirmSale(user, branchId, id, input, tx) {
  await permission(user, branchId, 'sale')
  const sale = await one('sales_orders', id, tx)
  requireThat(sale.branchId === branchId, 'Đơn thuộc chi nhánh khác.', 403)
  requireThat(sale.status === 'draft', 'Đơn đã được thanh toán.')
  requireThat(input.result === 'success', 'Thanh toán mô phỏng thất bại. Đơn vẫn chờ, tồn kho giữ nguyên.', 422)
  requireThat(['Tiền mặt', 'Chuyển khoản', 'Thẻ'].includes(input.method), 'Phương thức thanh toán không hợp lệ.', 422)
  const lines = await query('SELECT * FROM dbo.sale_lines WHERE saleId=@id ORDER BY lineIndex', { id }, tx)
  for (const line of lines) {
    await take(branchId, line, 'sold', tx)
    await move(user, branchId, line, 'Bán hàng', 'sale', line.id, -line.qty, 0, 'payment', tx)
  }
  await query("UPDATE dbo.sales_orders SET status='paid',method=@method,invoiceNo=id,paidAt=SYSUTCDATETIME(),date=SYSUTCDATETIME() WHERE id=@id", { method: input.method, id }, tx)
  await audit(user, branchId, 'sale.confirm', id, { total: Number(sale.total) }, tx)
  return (await ordersFor(branchId, tx)).find((o) => o.id === id)
}


export async function createTransfer(user, branchId, input, tx) {
  await permission(user, branchId, 'stock')
  const to = text(input.to, 'Chi nhánh nhận', 64)
  requireThat(to !== branchId, 'Chi nhánh nguồn và đích phải khác nhau.', 422)
  await one('branches', to, tx)
  const lines = await validLines(input.lines || [input], tx)
  const available = await balances(branchId, tx)
  for (const line of lines) {
    requireThat(available.find((b) => b.productId === line.productId).available >= line.qty, 'Nguồn không đủ tồn.')
    if (line.deviceId) {
      const d = await one('devices', line.deviceId, tx)
      requireThat(d.branchId === branchId && d.productId === line.productId && d.status === 'available', 'Thiết bị không khả dụng tại nguồn.')
    }
  }
  const id = await documentId('DC-', tx)
  await insert('transfers', { id, fromBranch: branchId, toBranch: to, createdBy: user.id,
    status: 'pending', note: text(input.note, 'Ghi chú', 300, true), date: date() }, tx)
  for (const line of lines) await insert('transfer_lines', { ...line, id: uid(), transferId: id, receivedQty: 0 }, tx)
  await audit(user, branchId, 'transfer.create', id, { to }, tx)
  return (await transfersFor(branchId, tx)).find((t) => t.id === id)
}
export async function transitionTransfer(user, branchId, id, action, input, tx) {
  const transfer = await one('transfers', id, tx)
  const sourceAction = ['approve', 'dispatch'].includes(action)
  requireThat(branchId === (sourceAction ? transfer.fromBranch : transfer.toBranch), 'Thao tác ở sai chi nhánh.', 403)
  await permission(user, branchId, ['approve', 'reconcile'].includes(action) ? 'approve' : 'stock')
  const transitions = { approve: ['pending', 'approved'], dispatch: ['approved', 'moving'], receive: ['moving', 'received'], report: ['moving', 'review'], reconcile: ['review', 'moving'] }
  requireThat(transitions[action] && transfer.status === transitions[action][0], 'Trạng thái phiếu đã thay đổi.')
  const lines = await query('SELECT * FROM dbo.transfer_lines WHERE transferId=@id', { id }, tx)
  if (action === 'approve') {
    const inventory = await balances(branchId, tx)
    const sums = new Map()
    for (const line of lines) sums.set(line.productId, (sums.get(line.productId) || 0) + line.qty)
    for (const [productId, qty] of sums) requireThat(inventory.find((b) => b.productId === productId)?.available >= qty, 'Tồn nguồn không đủ để duyệt.')
    await query('UPDATE dbo.transfers SET approvedBy=@userId WHERE id=@id', { id, userId: user.id }, tx)
  }
  if (action === 'dispatch') {
    for (const line of lines) {
      await take(branchId, line, 'moving', tx)
      await move(user, branchId, line, 'Xuất điều chuyển', 'transfer', line.id, -line.qty, 0, 'dispatch', tx)
    }
  }
  if (action === 'report') {
    const note = text(input.note, 'Biên bản sai lệch', 500)
    await insert('transfer_discrepancies', { id: uid(), transferId: id, actorId: user.id, note, date: date() }, tx)
    await query('UPDATE dbo.transfers SET discrepancy=@note,resolution=NULL WHERE id=@id', { id, note }, tx)
  }
  if (action === 'reconcile') {
    const note = text(input.note, 'Kết luận đối soát', 500)
    await query('UPDATE dbo.transfer_discrepancies SET resolution=@note,resolvedAt=SYSUTCDATETIME() WHERE transferId=@id AND resolvedAt IS NULL; UPDATE dbo.transfers SET resolution=@note WHERE id=@id;', { id, note }, tx)
  }
  if (action === 'receive') {
    const unresolved = await query('SELECT id FROM dbo.transfer_discrepancies WHERE transferId=@id AND resolvedAt IS NULL', { id }, tx)
    requireThat(!unresolved.length, 'Còn biên bản chưa xử lý.')
    for (const line of lines) {
      if (line.deviceId) {
        const device = await one('devices', line.deviceId, tx)
        requireThat(device.status === 'moving' && device.branchId === transfer.fromBranch, 'Thiết bị đang chuyển không khớp.')
      }
      await put(branchId, line, 'available', tx)
      await move(user, branchId, line, 'Nhận điều chuyển', 'transfer', line.id, line.qty, 0, 'receive', tx)
      await query('UPDATE dbo.transfer_lines SET receivedQty=qty WHERE id=@id', { id: line.id }, tx)
    }
    await query('UPDATE dbo.transfers SET receivedBy=@userId WHERE id=@id', { id, userId: user.id }, tx)
  }
  await query('UPDATE dbo.transfers SET status=@status,updatedAt=SYSUTCDATETIME() WHERE id=@id', { id, status: transitions[action][1] }, tx)
  await audit(user, branchId, 'transfer.' + action, id, input, tx)
  return (await transfersFor(branchId, tx)).find((t) => t.id === id)
}
export async function eligibility(user, branchId, input, tx) {
  await permission(user, branchId, 'aftercare')
  const rows = await query("SELECT TOP 30 l.*,s.customer,s.date saleDate,p.months,p.coverage,p.exclusions FROM dbo.sale_lines l JOIN dbo.sales_orders s ON s.id=l.saleId LEFT JOIN dbo.warranty_policies p ON p.id=l.policyId WHERE s.branchId=@branchId AND s.status='paid' AND (s.id=@code OR l.deviceId IN (SELECT d.id FROM dbo.devices d LEFT JOIN dbo.device_imeis i ON i.deviceId=d.id WHERE i.imei=@code OR d.serial=@code)) ORDER BY s.date DESC,l.lineIndex", { branchId, code: text(input.code || input.q, 'Mã tra cứu', 100) }, tx)
  const results = []
  for (const row of rows) {
    const returned = await query("SELECT COALESCE(SUM(qty),0) qty FROM dbo.returns WHERE saleLineId=@id AND status='returned'", { id: row.id }, tx)
    const until = new Date(row.saleDate)
    until.setUTCMonth(until.getUTCMonth() + Number(row.months || 0))
    results.push({ ...row, price: Number(row.price), eligible: Boolean(row.policyId && until >= date() && returned[0].qty < row.qty),
      expiresAt: until.toISOString(), reason: !row.policyId ? 'Chưa có chính sách.' : returned[0].qty >= row.qty ? 'Hàng đã hoàn trả.' : until < date() ? 'Hết thời hạn bảo hành.' : 'Trong thời hạn; hậu mãi xác nhận điều kiện lỗi.' })
  }
  return results
}
export async function createService(user, branchId, input, type, tx) {
  await permission(user, branchId, 'aftercare')
  const [line] = await query("SELECT l.*,s.branchId FROM dbo.sale_lines l JOIN dbo.sales_orders s ON s.id=l.saleId WHERE s.id=@orderId AND l.lineIndex=@lineIndex AND s.status='paid'", { orderId: input.orderId, lineIndex: integer(input.lineIndex, 0, 99) }, tx)
  requireThat(line && line.branchId === branchId, 'Không tìm thấy dòng bán ở chi nhánh.', 404)
  const reason = text(input.reason, 'Lý do', 500)
  if (type === 'warranty') {
    const details = (await eligibility(user, branchId, { code: input.orderId }, tx)).find((l) => l.id === line.id)
    requireThat(details?.eligible, details?.reason || 'Không đủ điều kiện bảo hành.')
    const open = await query("SELECT id FROM dbo.warranty_tickets WHERE saleLineId=@id AND status<>'done'", { id: line.id }, tx)
    requireThat(!open.length, 'Dòng bán đã có phiếu bảo hành đang mở.')
    const id = await documentId('BH-', tx)
    await insert('warranty_tickets', { id, saleLineId: line.id, policyId: line.policyId, branchId, reason, status: 'received', createdBy: user.id, date: date() }, tx)
    await insert('warranty_events', { id: uid(), ticketId: id, actorId: user.id, status: 'received', note: reason, date: date() }, tx)
    await audit(user, branchId, 'warranty.create', id, {}, tx)
    return (await servicesFor(branchId, tx)).find((s) => s.id === id)
  }
  const qty = integer(input.qty || 1)
  const [already] = await query('SELECT COALESCE(SUM(qty),0) qty FROM dbo.returns WHERE saleLineId=@id', { id: line.id }, tx)
  requireThat(qty + already.qty <= line.qty, 'Vượt số lượng còn có thể đổi trả.')
  if (line.deviceId) {
    const device = await one('devices', line.deviceId, tx)
    const [latest] = await query("SELECT TOP 1 l.id FROM dbo.sale_lines l JOIN dbo.sales_orders s ON s.id=l.saleId WHERE l.deviceId=@id AND s.status='paid' ORDER BY s.paidAt DESC,s.id DESC", { id: line.deviceId }, tx)
    requireThat(device.status === 'sold' && latest?.id === line.id, 'Thiết bị đã đổi trạng thái hoặc có giao dịch bán mới.')
  }
  const id = await documentId('DT-', tx)
  await insert('returns', { id, saleLineId: line.id, branchId, qty, reason, status: 'pending', createdBy: user.id, date: date() }, tx)
  await insert('return_events', { id: uid(), returnId: id, actorId: user.id, status: 'pending', note: reason, date: date() }, tx)
  await audit(user, branchId, 'return.create', id, {}, tx)
  return (await servicesFor(branchId, tx)).find((s) => s.id === id)
}
export async function transitionService(user, branchId, id, input, type, tx) {
  const table = type === 'warranty' ? 'warranty_tickets' : 'returns'
  const item = await one(table, id, tx)
  requireThat(item.branchId === branchId, 'Phiếu thuộc chi nhánh khác.', 403)
  await permission(user, branchId, type === 'return' && input.next === 'approved' ? 'approve' : 'aftercare')
  const transitions = type === 'warranty' ? { received: 'processing', processing: 'done' } : { pending: 'approved', approved: 'returned' }
  requireThat(transitions[item.status] === input.next, 'Trạng thái phiếu đã thay đổi.')
  const note = text(input.note, 'Ghi chú', 500, true)
  const line = await one('sale_lines', item.saleLineId, tx)
  if (type === 'warranty' && line.deviceId) {
    const device = await one('devices', line.deviceId, tx)
    if (input.next === 'processing') {
      requireThat(device.status === 'sold', 'Thiết bị đang có nghiệp vụ khác.')
      await query("UPDATE dbo.devices SET status='warranty' WHERE id=@id", { id: device.id }, tx)
    } else {
      requireThat(device.status === 'warranty', 'Thiết bị không ở trạng thái bảo hành.')
      await query("UPDATE dbo.devices SET status='sold' WHERE id=@id", { id: device.id }, tx)
    }
  }
  if (input.next === 'returned') {
    requireThat(['available', 'quarantine'].includes(input.condition), 'Cần phân loại hàng nhận.', 422)
    const activeWarranty = await query("SELECT id FROM dbo.warranty_tickets WHERE saleLineId=@id AND status<>'done'", { id: line.id }, tx)
    requireThat(!activeWarranty.length, 'Cần hoàn tất phiếu bảo hành trước khi nhận hàng trả.')
    if (line.deviceId) {
      const device = await one('devices', line.deviceId, tx)
      requireThat(device.status === 'sold', 'Thiết bị đã được nhận lại.')
    }
    await put(branchId, { ...line, qty: item.qty }, input.condition, tx)
    await move(user, branchId, { ...line, qty: item.qty }, 'Hàng đổi trả', 'return', id,
      input.condition === 'available' ? item.qty : 0, input.condition === 'quarantine' ? item.qty : 0, 'receive', tx)
    await query('UPDATE dbo.returns SET condition=@condition WHERE id=@id', { id, condition: input.condition }, tx)
  }
  if (input.next === 'approved') await query('UPDATE dbo.returns SET approvedBy=@userId WHERE id=@id', { id, userId: user.id }, tx)
  await query('UPDATE dbo.[' + table + '] SET status=@status WHERE id=@id', { id, status: input.next }, tx)
  await insert(type === 'warranty' ? 'warranty_events' : 'return_events', { id: uid(), [type === 'warranty' ? 'ticketId' : 'returnId']: id,
    actorId: user.id, status: input.next, note, date: date() }, tx)
  await audit(user, branchId, type + '.' + input.next, id, { note }, tx)
  return (await servicesFor(branchId, tx)).find((s) => s.id === id)
}
export async function savePolicy(user, branchId, input, tx) {
  await permission(user, branchId, 'catalog')
  await one('skus', input.productId, tx)
  const id = uid()
  const when = new Date(input.effectiveAt || Date.now())
  requireThat(!Number.isNaN(when.getTime()), 'Ngày hiệu lực không hợp lệ.', 422)
  await insert('warranty_policies', { id, productId: input.productId, months: integer(input.months, 1, 120),
    coverage: text(input.coverage, 'Điều kiện', 300), exclusions: text(input.exclusions, 'Loại trừ', 300), effectiveAt: when }, tx)
  await audit(user, branchId, 'policy.create', id, input, tx)
  return one('warranty_policies', id, tx)
}
export async function createCount(user, branchId, input, tx) {
  await permission(user, branchId, 'stock')
  requireThat(Array.isArray(input.rows) && input.rows.length > 0 && input.rows.length <= 100, 'Phiếu kiểm kê cần có hàng.', 422)
  requireThat(new Set(input.rows.map((r) => r.productId)).size === input.rows.length, 'SKU bị trùng trong phiếu.', 422)
  const current = await balances(branchId, tx)
  const id = await documentId('KK-', tx)
  await insert('stock_counts', { id, branchId, createdBy: user.id, status: 'draft',
    note: text(input.note || 'Kiểm kê theo mã quét', 'Ghi chú'), date: date() }, tx)
  for (const row of input.rows) {
    const product = await one('skus', row.productId, tx)
    const balance = current.find((b) => b.productId === row.productId)
    requireThat(balance && balance.available === Number(row.expected) && balance.revision === Number(row.revision), 'Tồn đã thay đổi. Đối chiếu lại dữ liệu trước khi gửi kiểm kê.')
    const counted = integer(row.count ?? row.counted, 0)
    const devices = row.devices ?? []
    if (product.category === 'Điện thoại') {
      requireThat(Array.isArray(devices) && devices.length === counted && new Set(devices).size === devices.length, 'Danh sách thiết bị kiểm kê không hợp lệ.', 422)
      for (const deviceId of devices) {
        const d = await one('devices', deviceId, tx)
        requireThat(d.productId === product.id && d.branchId === branchId && d.status === 'available', 'Thiết bị không còn khả dụng.')
      }
    } else requireThat(devices.length === 0, 'Phụ kiện dùng số lượng.', 422)
    await insert('count_lines', { id: uid(), countId: id, productId: product.id, expected: balance.available, counted,
      revision: balance.revision, devices: JSON.stringify(devices) }, tx)
  }
  await audit(user, branchId, 'count.create', id, {}, tx)
  return (await countsFor(branchId, tx)).find((c) => c.id === id)
}
export async function transitionCount(user, branchId, id, action, input, tx) {
  await permission(user, branchId, action === 'approve' ? 'approve' : 'stock')
  const count = await one('stock_counts', id, tx)
  requireThat(count.branchId === branchId, 'Phiếu thuộc chi nhánh khác.', 403)
  requireThat(count.status === (action === 'submit' ? 'draft' : 'submitted'), 'Trạng thái kiểm kê đã thay đổi.')
  if (action === 'approve') {
    const note = text(input.note, 'Kết luận kiểm kê')
    const current = await balances(branchId, tx)
    const lines = await query('SELECT * FROM dbo.count_lines WHERE countId=@id', { id }, tx)
    for (const line of lines) {
      const balance = current.find((b) => b.productId === line.productId)
      requireThat(balance.available === line.expected && balance.revision === line.revision, 'Tồn đã thay đổi sau kiểm kê. Cần lập phiếu mới.')
      const product = await one('skus', line.productId, tx)
      const difference = line.counted - line.expected
      if (product.category === 'Điện thoại') {
        const found = JSON.parse(line.devices)
        const available = await query("SELECT id FROM dbo.devices WHERE branchId=@branchId AND productId=@productId AND status='available'", { branchId, productId: product.id }, tx)
        for (const d of available.filter((d) => !found.includes(d.id))) await query("UPDATE dbo.devices SET status='quarantine' WHERE id=@id", { id: d.id }, tx)
        await bump(product.id, branchId, tx)
      } else await changeQuantity(product.id, branchId, 'available', difference, tx)
      if (difference) await move(user, branchId, { productId: product.id, qty: Math.abs(difference) }, 'Điều chỉnh kiểm kê', 'count', line.id,
        difference, product.category === 'Điện thoại' ? -difference : 0, 'approve', tx)
    }
    await query("UPDATE dbo.stock_counts SET status='approved',approvedBy=@userId,approvedAt=SYSUTCDATETIME(),note=@note WHERE id=@id", { id, userId: user.id, note }, tx)
  } else await query("UPDATE dbo.stock_counts SET status='submitted',submittedAt=SYSUTCDATETIME() WHERE id=@id", { id }, tx)
  await audit(user, branchId, 'count.' + action, id, input, tx)
  return (await countsFor(branchId, tx)).find((c) => c.id === id)
}

