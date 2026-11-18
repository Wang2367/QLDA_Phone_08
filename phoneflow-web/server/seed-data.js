import { branches, isPhone } from '../src/data.js'

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
    note: 'Bổ sung hàng cho chi nhánh Ba Đình', date: dayAgo(1, 11),
  }, {
    id: 'DC-302', from: 'q1', to: 'pn', branchId: 'q1', productId: '8', qty: 6, status: 'pending',
    note: 'Cân đối tồn theo chi nhánh', date: dayAgo(0, 10),
  })
  return { products, devices, quantities, orders, services, movements, transfers, next: { order: orderNumber, warranty: 501, return: 201, move: 601, transfer: 401 } }
}
