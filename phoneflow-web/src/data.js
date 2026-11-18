export const branches = [
  { id: 'q1', name: 'Quận 1', address: 'Chi nhánh Quận 1' },
  { id: 'q3', name: 'Quận 3', address: 'Chi nhánh Quận 3' },
  { id: 'pn', name: 'Phú Nhuận', address: 'Chi nhánh Phú Nhuận' },
  { id: 'gv', name: 'Gò Vấp', address: 'Chi nhánh Gò Vấp' },
  { id: 'td', name: 'Thủ Đức', address: 'Chi nhánh Thủ Đức' },
]

export const categories = ['Điện thoại', 'Phụ kiện']
export const demoAccount = { username: 'demo', password: 'phoneflow', name: 'Quang', role: 'Quản lý cửa hàng' }

const catalog = [
  ['IPH-16P-256', 'iPhone 16 Pro 256GB', 'Apple', 'Điện thoại', 29990000, 'slate', 8],
  ['SAM-S25U-256', 'Galaxy S25 Ultra 256GB', 'Samsung', 'Điện thoại', 25490000, 'lilac', 6],
  ['IPH-15-128', 'iPhone 15 128GB', 'Apple', 'Điện thoại', 16490000, 'rose', 7],
  ['XMI-14T-256', 'Xiaomi 14T 256GB', 'Xiaomi', 'Điện thoại', 10990000, 'mint', 3],
  ['OPP-R13-256', 'OPPO Reno13 256GB', 'OPPO', 'Điện thoại', 10490000, 'amber', 2],
  ['APP-AIRP4', 'AirPods 4', 'Apple', 'Phụ kiện', 3290000, 'lilac', 22],
  ['ANK-USB-30', 'Sạc Anker Nano 30W', 'Anker', 'Phụ kiện', 490000, 'mint', 38],
  ['APL-CAB-C1', 'Cáp USB-C 1m', 'Apple', 'Phụ kiện', 390000, 'slate', 34],
  ['UAG-MAG-16', 'Ốp MagSafe iPhone 16', 'UAG', 'Phụ kiện', 590000, 'rose', 17],
  ['BEL-GLS-16', 'Kính cường lực iPhone 16', 'Belkin', 'Phụ kiện', 290000, 'amber', 21],
]

const names = ['Nguyễn Hoàng Nam', 'Trần Ngọc Linh', 'Lê Minh Khôi', 'Phạm Thanh Hà', 'Vũ Tuấn Kiệt', 'Đỗ Mai Anh', 'Nguyễn Thảo Vy', 'Bùi Đức Huy', 'Huỳnh Gia Hân', 'Đinh Minh Trí']
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

export function seedData() {
  const products = catalog.map(([sku, name, brand, category, price, tone], index) => ({
    id: String(index + 1), sku, name, brand, category, price, tone,
  }))
  const devices = []
  const quantities = {}
  const orders = []
  const services = []
  const movements = []
  const transfers = []
  let serial = 0
  let orderNumber = 1044

  function makeDevice(productId, branchId, status) {
    serial += 1
    const code = String(serial).padStart(7, '0')
    return {
      id: 'device-' + serial, productId, branchId, status,
      serial: 'PF' + code, imeis: ['35012345' + code, '35112345' + code],
    }
  }

  for (const [branchIndex, branch] of branches.entries()) {
    for (const [index, product] of products.entries()) {
      const qty = Math.max(1, catalog[index][6] - branchIndex * (isPhone(product) ? 1 : 4))
      if (isPhone(product)) {
        for (let i = 0; i < qty; i++) devices.push(makeDevice(product.id, branch.id, 'available'))
      } else {
        quantities[inventoryKey(branch.id, product.id)] = { available: qty, quarantine: index === 8 ? 2 : 0 }
      }
    }

    const daySales = [[0, 5], [2, 6], [0, 3, 5], [4, 6], [1, 2, 7], [0, 8], [1, 3, 5]]
    for (let day = 0; day < 28; day++) {
      const items = daySales[day % daySales.length].slice(0, branchIndex > 1 ? 2 : 3)
      for (const [slot, productIndex] of items.entries()) {
        const product = products[(productIndex + (day >= 7 ? 1 : 0)) % products.length]
        const device = isPhone(product) ? makeDevice(product.id, branch.id, 'sold') : null
        if (device) devices.push(device)
        orders.push({
          id: 'HD-' + orderNumber++, branchId: branch.id, customer: names[(day * 2 + slot + branchIndex) % names.length],
          date: dayAgo(day, day === 0 ? 10 + slot : 9 + slot * 2, 12 + slot * 11),
          method: ['Chuyển khoản', 'Tiền mặt', 'Thẻ'][slot % 3], total: product.price,
          lines: [{ productId: product.id, name: product.name, sku: product.sku, deviceId: device?.id, qty: 1, price: product.price }],
        })
      }
    }

    const recentPhones = orders.filter((order) => order.branchId === branch.id && order.lines[0].deviceId).slice(0, 4)
    recentPhones.forEach((order, index) => {
      const status = ['received', 'processing', 'done', 'received'][index]
      const date = dayAgo(index % 3, 15)
      services.push({
        id: 'BH-' + (101 + branchIndex * 10 + index), branchId: branch.id, type: 'warranty', status,
        orderId: order.id, lineIndex: 0, qty: 1, reason: ['Kiểm tra pin', 'Màn hình chập chờn', 'Kiểm tra kết nối', 'Kiểm tra loa'][index], date,
        history: [{ status, date }],
      })
    })

    movements.push(
      { id: 'NK-' + (201 + branchIndex), branchId: branch.id, productId: '7', qty: 18, type: 'Nhập kho', date: dayAgo(1, 9), note: 'Bổ sung sạc Anker' },
      { id: 'XK-' + (131 + branchIndex), branchId: branch.id, productId: '8', qty: 5, type: 'Xuất kho', date: dayAgo(2, 14), note: 'Hàng trưng bày' },
    )
  }
  transfers.push({
    id: 'DC-301', from: 'q1', to: 'q3', branchId: 'q1', productId: '7', qty: 4, status: 'moving',
    note: 'Bổ sung hàng cho Quận 3', date: dayAgo(1, 11),
  }, {
    id: 'DC-302', from: 'q1', to: 'pn', branchId: 'q1', productId: '8', qty: 6, status: 'pending',
    note: 'Cân đối tồn theo chi nhánh', date: dayAgo(0, 10),
  })
  return { products, devices, quantities, orders, services, movements, transfers, next: { order: orderNumber, warranty: 501, return: 201, move: 601, transfer: 401 } }
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

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function amount(value) {
  const qty = Number(value)
  assert(Number.isSafeInteger(qty) && qty > 0, 'Số lượng phải là số nguyên dương.')
  return qty
}

function adjust(data, productId, branchId, status, delta) {
  const key = inventoryKey(branchId, productId)
  const current = data.quantities[key] ?? { available: 0, quarantine: 0 }
  const nextQty = current[status] + delta
  assert(nextQty >= 0, 'Tồn khả dụng không đủ cho giao dịch này.')
  data.quantities[key] = { ...current, [status]: nextQty }
}

function take(data, branchId, line, newStatus) {
  const product = getProduct(data, line.productId)
  assert(product, 'Sản phẩm không tồn tại.')
  const qty = amount(line.qty)
  if (!isPhone(product)) {
    adjust(data, product.id, branchId, 'available', -qty)
    return
  }
  const device = data.devices.find((item) => item.id === line.deviceId)
  assert(qty === 1 && device?.productId === product.id && device.branchId === branchId && device.status === 'available',
    'Thiết bị này không còn khả dụng tại chi nhánh.')
  device.status = newStatus
}

function movement(data, branchId, productId, qty, type, note) {
  const prefix = type === 'Nhập kho' ? 'NK-' : type === 'Xuất kho' ? 'XK-' : 'BT-'
  const row = { id: prefix + data.next.move++, branchId, productId, qty, type, date: new Date().toISOString(), note }
  data.movements.unshift(row)
  return row
}

export function addProduct(data, values) {
  const sku = values.sku.trim().toUpperCase()
  const price = Number(values.price)
  assert(sku && values.name.trim() && values.brand.trim(), 'Vui lòng điền đủ mã, tên và thương hiệu.')
  assert(!data.products.some((product) => normalize(product.sku) === normalize(sku)), 'Mã SKU đã tồn tại.')
  assert(Number.isSafeInteger(price) && price > 0, 'Đơn giá phải là số nguyên dương.')
  const product = { ...values, sku, price, name: values.name.trim(), brand: values.brand.trim(), id: crypto.randomUUID(), tone: 'slate' }
  data.products.push(product)
  return product
}

export function checkout(data, branchId, cart, customer, method, simulateFailure) {
  assert(cart.length, 'Thêm ít nhất một sản phẩm vào đơn.')
  assert(!simulateFailure, 'Thanh toán mô phỏng thất bại. Đơn hàng và tồn kho chưa đổi.')
  const id = 'HD-' + data.next.order++
  const lines = cart.map((item) => {
    take(data, branchId, item, 'sold')
    const product = getProduct(data, item.productId)
    movement(data, branchId, product.id, item.qty, 'Bán hàng', id)
    return { ...item, name: product.name, sku: product.sku, price: product.price }
  })
  const order = {
    id, branchId, lines, customer: buyerName(customer), method, date: new Date().toISOString(),
    total: lines.reduce((total, line) => total + line.price * line.qty, 0),
  }
  data.orders.unshift(order)
  return order
}

export function stockRecord(data, branchId, values) {
  const product = getProduct(data, values.productId)
  assert(product, 'Chọn sản phẩm.')
  const qty = isPhone(product) ? 1 : amount(values.qty)
  const note = values.note.trim()
  assert(note, 'Nhập mã chứng từ hoặc lý do.')
  if (values.type === 'Xuất kho') {
    take(data, branchId, { ...values, qty }, 'exported')
  } else if (isPhone(product)) {
    const imeis = values.imeis.split(/[,;\s]+/).filter(Boolean)
    const serial = values.serial.toUpperCase().trim()
    assert(serial && imeis.length && imeis.every((imei) => /^\d{15}$/.test(imei)), 'Nhập serial và ít nhất một IMEI gồm 15 chữ số.')
    assert(new Set(imeis).size === imeis.length, 'Các IMEI trong phiếu phải khác nhau.')
    assert(!data.devices.some((device) => normalize(device.serial) === normalize(serial) || device.imeis.some((imei) => imeis.includes(imei))),
      'Serial hoặc IMEI đã thuộc thiết bị khác.')
    data.devices.push({ id: crypto.randomUUID(), productId: product.id, branchId, status: 'available', serial, imeis })
  } else {
    adjust(data, product.id, branchId, 'available', qty)
  }
  return movement(data, branchId, product.id, qty, values.type, note)
}

export function createTransfer(data, branchId, values) {
  const product = getProduct(data, values.productId)
  assert(product && branches.some((branch) => branch.id === values.to && branch.id !== branchId), 'Chọn sản phẩm và chi nhánh nhận hợp lệ.')
  const qty = isPhone(product) ? 1 : amount(values.qty)
  const available = isPhone(product)
    ? data.devices.some((device) => device.id === values.deviceId && device.productId === product.id && device.branchId === branchId && device.status === 'available')
    : stock(data, product.id, branchId).available >= qty
  assert(available, 'Tồn khả dụng không đủ để tạo phiếu.')
  const transfer = { id: 'DC-' + data.next.transfer++, from: branchId, to: values.to, productId: product.id, deviceId: values.deviceId, qty, note: values.note.trim(), status: 'pending', date: new Date().toISOString() }
  data.transfers.unshift(transfer)
  return transfer
}

export function updateTransfer(data, branchId, id, action, note = '') {
  const item = data.transfers.find((transfer) => transfer.id === id)
  assert(item, 'Không tìm thấy phiếu điều chuyển.')
  const fromSource = item.from === branchId
  const toDestination = item.to === branchId
  if (action === 'approve' && fromSource && item.status === 'pending') {
    item.status = 'approved'
  } else if (action === 'dispatch' && fromSource && item.status === 'approved') {
    take(data, item.from, item, 'moving')
    item.status = 'moving'
    movement(data, item.from, item.productId, item.qty, 'Xuất điều chuyển', item.id)
  } else if (action === 'report' && toDestination && item.status === 'moving') {
    assert(note.trim(), 'Nhập nội dung biên bản chênh lệch.')
    item.status = 'review'
    item.discrepancy = note.trim()
  } else if (action === 'reconcile' && toDestination && item.status === 'review') {
    assert(note.trim(), 'Nhập kết luận đối soát.')
    item.status = 'moving'
    item.resolution = note.trim()
  } else if (action === 'receive' && toDestination && item.status === 'moving') {
    if (item.deviceId) {
      const device = data.devices.find((entry) => entry.id === item.deviceId)
      assert(device?.status === 'moving', 'Trạng thái thiết bị không khớp phiếu.')
      Object.assign(device, { branchId, status: 'available' })
    } else {
      adjust(data, item.productId, branchId, 'available', item.qty)
    }
    item.status = 'received'
    movement(data, branchId, item.productId, item.qty, 'Nhận điều chuyển', item.id)
  } else {
    throw new Error('Chi nhánh hoặc trạng thái phiếu không phù hợp.')
  }
  item.updatedAt = new Date().toISOString()
  return item
}

export function createService(data, branchId, type, orderId, lineIndex, reason) {
  const order = data.orders.find((entry) => entry.branchId === branchId && entry.id === orderId)
  const line = order?.lines[lineIndex]
  assert(line && reason.trim(), 'Chọn sản phẩm từ hóa đơn và nhập lý do.')
  const existing = data.services.filter((entry) => entry.orderId === orderId && entry.lineIndex === lineIndex && entry.type === type)
  assert(type === 'warranty' ? existing.every((entry) => entry.status === 'done') : existing.length < line.qty,
    'Sản phẩm đã có phiếu đang xử lý hoặc hết số lượng có thể trả.')
  const date = new Date().toISOString()
  const status = type === 'warranty' ? 'received' : 'pending'
  const id = type === 'warranty' ? 'BH-' + data.next.warranty++ : 'DT-' + data.next.return++
  const entry = { id, branchId, type, orderId, lineIndex, qty: 1, reason: reason.trim(), date, status, history: [{ status, date }] }
  data.services.unshift(entry)
  return entry
}

export function updateService(data, branchId, id, next, note, condition) {
  const entry = data.services.find((item) => item.id === id && item.branchId === branchId)
  const transitions = { received: 'processing', processing: 'done', pending: 'approved', approved: 'returned' }
  assert(entry && transitions[entry.status] === next, 'Trạng thái phiếu đã thay đổi.')
  if (next === 'returned') {
    const order = data.orders.find((item) => item.id === entry.orderId)
    const line = order.lines[entry.lineIndex]
    const target = condition === 'available' ? 'available' : 'quarantine'
    if (line.deviceId) {
      const device = data.devices.find((item) => item.id === line.deviceId)
      assert(device?.status === 'sold', 'Thiết bị đã được nhận lại hoặc trạng thái không khớp.')
      Object.assign(device, { branchId, status: target })
    } else {
      adjust(data, line.productId, branchId, target, entry.qty)
    }
    movement(data, branchId, line.productId, entry.qty, 'Hàng đổi trả', entry.id)
    entry.condition = target
  }
  entry.status = next
  entry.history.push({ status: next, date: new Date().toISOString(), note: note.trim() })
  return entry
}

