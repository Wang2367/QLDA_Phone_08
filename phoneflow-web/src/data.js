import { post, sale, receipt } from './api.js'
export const branches = [
  { id: 'q1', name: 'Hoàn Kiếm', address: 'Chi nhánh Hoàn Kiếm, Hà Nội' },
  { id: 'q3', name: 'Ba Đình', address: 'Chi nhánh Ba Đình, Hà Nội' },
  { id: 'pn', name: 'Cầu Giấy', address: 'Chi nhánh Cầu Giấy, Hà Nội' },
  { id: 'gv', name: 'Đống Đa', address: 'Chi nhánh Đống Đa, Hà Nội' },
  { id: 'td', name: 'Hà Đông', address: 'Chi nhánh Hà Đông, Hà Nội' },
]

export const categories = ['Điện thoại', 'Phụ kiện']


export const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format
export const number = new Intl.NumberFormat('vi-VN').format
export const shortDay = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' })
export const fullDay = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
export const clock = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })
export const normalize = (value) => String(value ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').trim()
export const includes = (value, query) => normalize(value).includes(normalize(query))
export const branchName = (id) => branches.find((branch) => branch.id === id)?.name ?? id
export const isPhone = (product) => product.category === 'Điện thoại'
export const inventoryKey = (branchId, productId) => [branchId, productId].join(':')
export const getProduct = (data, id) => data.products.find((product) => product.id === id)
export const buyerName = (name) => name?.trim() || 'Khách lẻ'
export const initials = (name) => name.split(/\s+/).slice(-2).map((word) => word[0]).join('').toUpperCase()

export function dayAgo(days, hour = 12, minute = 0) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}


export function stock(data, productId, branchId) {
  const devices = data.devices.filter((item) => item.productId === productId && item.branchId === branchId)
  const trackedQty = data.quantities[inventoryKey(branchId, productId)] ?? { available: 0, quarantine: 0 }
  return {
    available: trackedQty.available + devices.filter((device) => device.status === 'available').length,
    quarantine: trackedQty.quarantine + devices.filter((device) => device.status === 'quarantine').length,
    moving: data.transfers.filter((item) => item.productId === productId && item.from === branchId && ['moving', 'review'].includes(item.status)).reduce((sum, item) => sum + item.qty, 0),
  }
}

export function matchingProducts(data, branchId, query) {
  const productsFromDevices = data.devices.filter((device) =>
    device.branchId === branchId && [device.serial, ...device.imeis].some((item) => includes(item, query)),
  ).map((device) => device.productId)
  return data.products.filter((product) => [product.name, product.sku, product.brand].some((item) => includes(item, query)) || productsFromDevices.includes(product.id))
}

export function orderMatch(data, branchId, query) {
  const exact = normalize(query)
  if (!exact) return []
  return data.orders.filter((order) => order.branchId === branchId).flatMap((order) => order.lines.flatMap((line, index) => {
    const device = data.devices.find((item) => item.id === line.deviceId)
    const matched = [order.id, device?.serial, ...(device?.imeis ?? [])].some((item) => normalize(item) === exact)
    return matched ? [{ order, line, index, device }] : []
  }))
}

export const serviceStatus = {
  received: ['Tiếp nhận', 'amber'], processing: ['Đang xử lý', 'blue'], done: ['Hoàn tất', 'green'],
  pending: ['Chờ duyệt', 'amber'], approved: ['Đã duyệt', 'blue'], returned: ['Đã nhận lại', 'green'],
}
export const transferStatus = {
  pending: ['Chờ duyệt', 'amber'], approved: ['Đã duyệt', 'blue'], moving: ['Đang chuyển', 'blue'],
  review: ['Chờ đối soát', 'amber'], received: ['Đã nhận', 'green'],
}
export const deviceStatus = {
  available: ['Khả dụng', 'green'], sold: ['Đã bán', 'blue'], moving: ['Đang chuyển', 'blue'],
  quarantine: ['Cách ly', 'amber'], exported: ['Đã xuất', 'neutral'],
}

export async function addProduct(data, values) {
  return post('/skus', values)
}
export async function checkout(data, branchId, cart, customer, method, simulateFailure) {
  return sale(branchId, cart, customer, method, simulateFailure)
}
export async function stockRecord(data, branchId, values) {
  return receipt(branchId, values)
}
export async function createTransfer(data, branchId, values) {
  return post('/transfers', values, { branchId })
}
export async function updateTransfer(data, branchId, id, action, note = '') {
  const paths = { report: 'discrepancies' }
  return post('/transfers/' + id + '/' + (paths[action] || action), { note }, { branchId })
}
export async function createService(data, branchId, type, orderId, lineIndex, reason) {
  return post(type === 'warranty' ? '/warranty/tickets' : '/returns', { orderId, lineIndex, reason }, { branchId })
}
export async function updateService(data, branchId, id, next, note, condition) {
  const path = id.startsWith('BH-') ? '/warranty/tickets/' + id + '/events'
    : '/returns/' + id + (next === 'approved' ? '/approve' : '/receive')
  return post(path, { next, note, condition }, { branchId })
}

