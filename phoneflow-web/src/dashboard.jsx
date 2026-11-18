import { useState } from 'react'
import {
  Activity, ArrowRight, Boxes, CalendarDays, CircleCheck, PackagePlus, Search,
  ShieldCheck, ShoppingBag, ShoppingCart, Wallet,
} from 'lucide-react'
import { clock, dayAgo, initials, isPhone, money, number, shortDay, stock } from './data.js'
import { Button, Delta, Empty, PageHeading, PanelHeading, Select, Status } from './components.jsx'

function getRange(rows, first, last = 0) {
  const start = new Date(dayAgo(first, 0)).getTime()
  const end = new Date(dayAgo(last, 23, 59)).getTime() + 60000
  return rows.filter((row) => {
    const time = new Date(row.date).getTime()
    return time >= start && time < end
  })
}

const revenue = (orders) => orders.reduce((sum, order) => sum + order.total, 0)
const growth = (value, old) => old > 0 ? Math.round((value / old - 1) * 1000) / 10 : null

function RevenueChart({ orders, days }) {
  const [active, setActive] = useState(null)
  const count = days === 7 ? 7 : 6
  const step = days / count
  const points = Array.from({ length: count }, (_, index) => {
    const first = days - index * step - 1
    const last = first - step + 1
    return {
      label: shortDay.format(new Date(dayAgo(last))),
      current: revenue(getRange(orders, first, last)),
      previous: revenue(getRange(orders, first + days, last + days)),
    }
  })
  const largest = Math.max(...points.flatMap((point) => [point.current, point.previous]), 1000000)
  const tick = Math.ceil(largest / 4 / 5000000) * 5000000
  const max = tick * 4
  return <section className="panel chart-panel">
    <PanelHeading title="Doanh thu bán hàng" description="Đơn đã thanh toán theo thời gian">
      <div className="chart-legend"><span><i />Kỳ này</span><span><i />Kỳ trước</span></div>
    </PanelHeading>
    <div className="chart-frame">
      <div className="chart-axis" aria-hidden="true">{[4, 3, 2, 1, 0].map((i) => <span key={i}>{i ? number(tick * i / 1000000) + ' tr' : '0'}</span>)}</div>
      <div className="chart-area">
        <div className="chart-lines" aria-hidden="true">{[4, 3, 2, 1, 0].map((i) => <i key={i} />)}</div>
        <div className="chart-bars" style={{ '--bucket-count': count }} aria-label="Biểu đồ doanh thu kỳ này và kỳ trước">
          {points.map((point, index) => <div className="chart-group" key={point.label}>
            <button type="button" className="bar-pair" onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)} onBlur={() => setActive(null)} onClick={() => setActive(active === index ? null : index)}
              aria-label={point.label + ': kỳ này ' + money(point.current) + ', kỳ trước ' + money(point.previous)}>
              <span className="bar previous" style={{ '--value': point.previous / max * 100 + '%' }} />
              <span className="bar current" style={{ '--value': point.current / max * 100 + '%' }} />
            </button>
            {active === index && <span className="chart-tip">{point.label}<b>{money(point.current)}</b></span>}
            <span className="chart-label">{point.label}</span>
          </div>)}
        </div>
      </div>
    </div>
  </section>
}

function StockChart({ productStock, total, navigate }) {
  const phones = productStock.filter(({ product }) => isPhone(product)).reduce((sum, row) => sum + row.available, 0)
  const accessories = total - phones
  const percent = total ? phones / total * 100 : 0
  return <section className="panel stock-chart">
    <PanelHeading title="Cơ cấu tồn kho" description="Hàng khả dụng tại chi nhánh" />
    <div className="donut" role="img" aria-label={number(total) + ' sản phẩm khả dụng'}
      style={{ '--phone-pct': percent + '%' }}>
      <div><strong>{number(total)}</strong><small>đơn vị khả dụng</small></div>
    </div>
    <div className="stock-legend">
      <span><i />Điện thoại<strong>{number(phones)}</strong></span>
      <span><i />Phụ kiện<strong>{number(accessories)}</strong></span>
    </div>
    <button className="text-button stock-link" onClick={() => navigate('kho')}>Xem tồn kho <ArrowRight size={15} /></button>
  </section>
}

function Orders({ items, onOpen, navigate }) {
  return <section className="panel orders-panel">
    <PanelHeading title="Đơn hàng gần đây" description="Giao dịch tại chi nhánh đang chọn">
      <Button icon={ArrowRight} onClick={() => navigate('pos')}>Đi đến POS</Button>
    </PanelHeading>
    {items.length === 0 ? <Empty title="Chưa có đơn hàng trong kỳ" /> :
      <div className="table-scroll"><table>
        <thead><tr><th>Mã hóa đơn</th><th>Khách hàng</th><th>Thời gian</th><th>Thanh toán</th><th className="align-right">Tổng tiền</th></tr></thead>
        <tbody>{items.map((order) => <tr key={order.id}>
          <td><button className="id-link" onClick={() => onOpen(order)}>{order.id}</button></td>
          <td><span className="customer"><span>{initials(order.customer)}</span>{order.customer}</span></td>
          <td>{shortDay.format(new Date(order.date))} · {clock.format(new Date(order.date))}</td>
          <td><Status value={['Đã thanh toán', 'green']} /></td><td className="align-right strong">{money(order.total)}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>
}

export default function Dashboard({ data, branchId, navigate, openReceipt }) {
  const [days, setDays] = useState(7)
  const branchOrders = data.orders.filter((order) => order.branchId === branchId)
  const orders = getRange(branchOrders, days - 1).sort((a, b) => b.date.localeCompare(a.date))
  const previous = getRange(branchOrders, days * 2 - 1, days)
  const productStock = data.products.map((product) => ({ product, ...stock(data, product.id, branchId) }))
  const total = productStock.reduce((sum, row) => sum + row.available, 0)
  const low = productStock.filter((row) => row.available < 5).length
  const tickets = data.services.filter((ticket) => ticket.branchId === branchId && ticket.type === 'warranty' && ticket.status !== 'done')
  const metrics = [
    { label: 'Doanh thu', Value: money(revenue(orders)), Icon: Wallet, tone: 'coral', delta: growth(revenue(orders), revenue(previous)), context: 'so với kỳ trước' },
    { label: 'Đơn đã thanh toán', Value: number(orders.length), Icon: ShoppingBag, tone: 'mint', delta: growth(orders.length, previous.length), context: 'so với kỳ trước' },
    { label: 'Tồn khả dụng', Value: number(total), Icon: Boxes, tone: 'lilac', delta: null, context: low + ' SKU có tồn dưới 5' },
    { label: 'Bảo hành đang mở', Value: number(tickets.length), Icon: ShieldCheck, tone: 'amber', delta: null, context: tickets.filter((ticket) => ticket.status === 'received').length + ' phiếu mới tiếp nhận' },
  ]
  const start = shortDay.format(new Date(dayAgo(days - 1)))
  const end = shortDay.format(new Date())
  return <>
    <PageHeading title="Tổng quan" description="Theo dõi bán hàng, tồn kho và bảo hành tại chi nhánh.">
      <Select label="Kỳ báo cáo" icon={CalendarDays} value={days} onChange={(event) => setDays(Number(event.target.value))}>
        {[7, 30, 90].map((day) => <option key={day} value={day}>{day} ngày gần đây</option>)}
      </Select>
      <Button variant="primary" icon={ShoppingCart} onClick={() => navigate('pos')}>Tạo đơn bán</Button>
    </PageHeading>
    <div className="range-label"><Activity size={14} aria-hidden="true" /> Số liệu từ {start} đến {end}</div>
    <div className="metrics">
      {metrics.map(({ label, Value, Icon, tone, delta, context }) => <section className="panel metric" key={label}>
        <div className="metric-top"><span className={'metric-icon ' + tone}><Icon size={19} strokeWidth={1.8} aria-hidden="true" /></span><span>{label}</span></div>
        <strong className="metric-number">{Value}</strong>
        <Delta value={delta} label={delta === null && context === 'so với kỳ trước' ? 'Chưa có dữ liệu kỳ trước' : context} />
      </section>)}
    </div>
    <div className="dashboard-grid">
      <RevenueChart orders={branchOrders} days={days} />
      <StockChart productStock={productStock} total={total} navigate={navigate} />
      <Orders items={orders.slice(0, 5)} onOpen={openReceipt} navigate={navigate} />
      <section className="panel quick-panel">
        <PanelHeading title="Thao tác nhanh" description="Đi đến nghiệp vụ thường dùng" />
        {[
          ['Nhập kho', 'Ghi nhận hàng mới', PackagePlus, 'mint', 'kho', { mode: 'receipt' }],
          ['Tìm sản phẩm', 'Tra theo SKU hoặc IMEI', Search, 'lilac', 'san-pham'],
          ['Tiếp nhận bảo hành', 'Tra hóa đơn và thiết bị', CircleCheck, 'amber', 'hau-mai', { mode: 'lookup' }],
        ].map(([title, subtitle, Icon, color, page, params]) => <button key={title} className="quick-row" onClick={() => navigate(page, params)}>
          <span className={'metric-icon ' + color}><Icon size={18} aria-hidden="true" /></span>
          <span><strong>{title}</strong><small>{subtitle}</small></span><ArrowRight size={16} aria-hidden="true" />
        </button>)}
      </section>
    </div>
  </>
}

