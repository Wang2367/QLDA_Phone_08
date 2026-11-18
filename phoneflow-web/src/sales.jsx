import { useEffect, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, ClipboardList, CreditCard, Minus,
  PackagePlus, Plus, ScanLine, Trash2,
} from 'lucide-react'
import {
  addProduct, categories, checkout, clock, deviceStatus, getProduct, includes, isPhone,
  matchingProducts, money, number, shortDay, stock,
} from './data.js'
import {
  ActionForm, Button, Empty, Field, Modal, PageHeading, PanelHeading, ProductIcon,
  ProductName, Select, Status, Tabs, TextSearch,
} from './components.jsx'

const PAGE_SIZE = 7

export function CategoryFilter({ category, setCategory }) {
  return <Tabs label="Loại sản phẩm" value={category} onChange={setCategory} items={[
    { id: 'all', name: 'Tất cả' }, ...categories.map((name) => ({ id: name, name })),
  ]} />
}

function ProductForm({ commit, onClose }) {
  return <Modal title="Thêm sản phẩm" description="Tạo mã SKU trong danh mục. Nhập hàng tại trang Kho." onClose={onClose}>
    <ActionForm actionLabel="Lưu sản phẩm" onClose={onClose} onSubmit={(form) => {
      commit((draft) => addProduct(draft, Object.fromEntries(form)), 'Đã thêm sản phẩm vào danh mục.')
      onClose()
    }}>
      <Field label="Tên sản phẩm"><input name="name" required maxLength={90} autoFocus placeholder="Ví dụ: iPhone 16 Pro 256GB" /></Field>
      <div className="form-grid">
        <Field label="Mã SKU"><input name="sku" required maxLength={30} placeholder="IPH-16P-256" /></Field>
        <Field label="Thương hiệu"><input name="brand" required maxLength={35} placeholder="Apple" /></Field>
        <Field label="Loại sản phẩm"><Select name="category" label="Loại sản phẩm">{categories.map((name) => <option key={name}>{name}</option>)}</Select></Field>
        <Field label="Giá bán (₫)"><input name="price" type="number" min={1} step={1} required placeholder="0" /></Field>
      </div>
    </ActionForm>
  </Modal>
}

function ProductDetails({ product, data, branchId, initialQuery, onClose }) {
  const [query, setQuery] = useState(initialQuery)
  const devices = data.devices.filter((device) => device.productId === product.id && device.branchId === branchId)
  const filtered = devices.filter((device) => [device.serial, ...device.imeis].some((value) => includes(value, query)))
  const deviceRows = filtered.slice(0, 10)
  const quantities = stock(data, product.id, branchId)
  return <Modal title={product.name} description={product.sku + ' · ' + product.brand} onClose={onClose} wide>
    <div className="summary-strip">
      <span>Giá bán<strong>{money(product.price)}</strong></span>
      <span>Khả dụng<strong>{number(quantities.available)}</strong></span>
      <span>Đang chuyển<strong>{number(quantities.moving)}</strong></span>
      <span>Cách ly<strong>{number(quantities.quarantine)}</strong></span>
    </div>
    {isPhone(product) && <>
      <TextSearch label="Tìm thiết bị theo IMEI hoặc serial" placeholder="Tìm IMEI hoặc serial…" value={query} onChange={setQuery} />
      {deviceRows.length ? <div className="table-scroll modal-table"><table>
        <thead><tr><th>Serial</th><th>IMEI</th><th>Trạng thái</th></tr></thead>
        <tbody>{deviceRows.map((device) => <tr key={device.id}><td className="mono">{device.serial}</td><td className="mono device-imeis">{device.imeis.map((imei) => <span key={imei}>{imei}</span>)}</td><td><Status value={deviceStatus[device.status]} /></td></tr>)}</tbody>
      </table></div> : <Empty title="Không tìm thấy thiết bị" >Kiểm tra mã hoặc chọn chi nhánh khác.</Empty>}
      {filtered.length > deviceRows.length && <p className="muted small">Hiển thị 10 thiết bị đầu tiên. Nhập IMEI hoặc serial để lọc.</p>}
    </>}
    <div className="form-actions"><Button onClick={onClose}>Đóng</Button></div>
  </Modal>
}

export default function Products({ data, branchId, params, commit }) {
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [category, setCategory] = useState('all')
  const [availability, setAvailability] = useState('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(params.get('product'))
  const [add, setAdd] = useState(false)
  const items = matchingProducts(data, branchId, query)
    .filter((product) => category === 'all' || product.category === category)
    .map((product) => ({ product, available: stock(data, product.id, branchId).available }))
    .filter(({ available }) => availability === 'all' || (availability === 'low' ? available > 0 && available < 5 : available === 0))
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, pages)
  const rows = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const selectedProduct = getProduct(data, selected)
  return <>
    <PageHeading title="Quản lý sản phẩm" description="Danh mục điện thoại, phụ kiện và thiết bị theo SKU, IMEI.">
      <Button variant="primary" icon={PackagePlus} onClick={() => setAdd(true)}>Thêm sản phẩm</Button>
    </PageHeading>
    <section className="panel records-panel">
      <div className="records-toolbar">
        <CategoryFilter category={category} setCategory={(value) => { setCategory(value); setPage(1) }} />
        <div className="filter-actions">
          <TextSearch value={query} onChange={(value) => { setQuery(value); setPage(1) }} label="Tìm sản phẩm theo tên, SKU, IMEI hoặc serial" placeholder="Tìm tên, SKU, IMEI…" />
          <Select label="Trạng thái tồn kho" value={availability} onChange={(event) => { setAvailability(event.target.value); setPage(1) }}>
            <option value="all">Mọi trạng thái</option><option value="low">Sắp hết hàng</option><option value="none">Hết hàng</option>
          </Select>
        </div>
      </div>
      {rows.length ? <div className="table-scroll"><table>
        <thead><tr><th>Sản phẩm</th><th>Loại</th><th>Khả dụng</th><th className="align-right">Giá bán</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
        <tbody>{rows.map(({ product, available }) => <tr key={product.id}>
          <td><ProductName product={product} /></td><td>{product.category}</td><td className="strong">{number(available)}</td>
          <td className="align-right strong">{money(product.price)}</td>
          <td><Status value={available === 0 ? ['Hết hàng', 'neutral'] : available < 5 ? ['Sắp hết', 'amber'] : ['Còn hàng', 'green']} /></td>
          <td><button className="row-go" aria-label={'Xem ' + product.name} onClick={() => setSelected(product.id)}><ArrowRight size={17} /></button></td>
        </tr>)}</tbody>
      </table></div> : <Empty title="Không tìm thấy sản phẩm">Thử từ khóa hoặc bộ lọc khác.</Empty>}
      <div className="pagination">
        <span>{items.length ? ((safePage - 1) * PAGE_SIZE + 1) + '–' + Math.min(safePage * PAGE_SIZE, items.length) + ' trên ' : ''}{number(items.length)} sản phẩm</span>
        <div><button type="button" className="icon-button" aria-label="Trang trước" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}><ChevronLeft size={17} /></button>
          <span>{safePage} / {pages}</span><button type="button" className="icon-button" aria-label="Trang tiếp theo" disabled={safePage === pages} onClick={() => setPage(safePage + 1)}><ChevronRight size={17} /></button></div>
      </div>
    </section>
    {add && <ProductForm commit={commit} onClose={() => setAdd(false)} />}
    {selectedProduct && <ProductDetails product={selectedProduct} data={data} branchId={branchId}
      initialQuery={matchingProducts(data, branchId, query).includes(selectedProduct) && ![selectedProduct.name, selectedProduct.sku, selectedProduct.brand].some((value) => includes(value, query)) ? query : ''}
      onClose={() => setSelected(null)} />}
  </>
}

function Payment({ total, onClose, onPay, customer }) {
  return <Modal title="Thanh toán mô phỏng" description={customer.trim() || 'Khách lẻ'} onClose={onClose}>
    <div className="payment-total"><span>Tổng thanh toán</span><strong>{money(total)}</strong></div>
    <ActionForm actionLabel="Xác nhận thanh toán" onClose={onClose} onSubmit={(form) => onPay(form.get('method'), form.get('result') === 'failure')}>
      <Field label="Phương thức thanh toán"><Select name="method" label="Phương thức thanh toán">
        {['Tiền mặt', 'Chuyển khoản', 'Thẻ'].map((method) => <option key={method}>{method}</option>)}
      </Select></Field>
      <Field label="Kết quả giả lập"><Select name="result" label="Kết quả giả lập"><option value="success">Thành công</option><option value="failure">Thất bại</option></Select></Field>
    </ActionForm>
  </Modal>
}

export function Receipt({ order, onClose }) {
  return <Modal title={'Hóa đơn ' + order.id} description={shortDay.format(new Date(order.date)) + ' · ' + clock.format(new Date(order.date))} onClose={onClose} wide>
    <div className="receipt-header"><div><span>Khách hàng</span><strong>{order.customer}</strong></div><div><span>Phương thức</span><strong>{order.method}</strong></div><Status value={['Đã thanh toán', 'green']} /></div>
    <div className="table-scroll modal-table"><table>
      <thead><tr><th>Sản phẩm</th><th className="align-right">SL</th><th className="align-right">Thành tiền</th></tr></thead>
      <tbody>{order.lines.map((line, index) => <tr key={index}><td><strong>{line.name}</strong><small className="table-sub">{line.sku}</small></td>
        <td className="align-right">{number(line.qty)}</td><td className="align-right">{money(line.qty * line.price)}</td></tr>)}</tbody>
    </table></div>
    <div className="payment-total"><span>Tổng tiền</span><strong>{money(order.total)}</strong></div>
    <div className="form-actions"><Button variant="primary" onClick={onClose}>Xong</Button></div>
  </Modal>
}

const cartKey = (branchId) => 'phoneflow-cart-1:' + branchId

export function PointOfSale({ data, branchId, params, commit, notify, openReceipt }) {
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [category, setCategory] = useState('all')
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(cartKey(branchId))) ?? [] } catch { return [] }
  })
  const [customer, setCustomer] = useState('')
  const [deviceProduct, setDeviceProduct] = useState(null)
  const [paying, setPaying] = useState(false)
  const [view, setView] = useState('sale')
  const [orderQuery, setOrderQuery] = useState('')
  useEffect(() => {
    try { sessionStorage.setItem(cartKey(branchId), JSON.stringify(cart)) } catch { /* Session storage is optional. */ }
  }, [cart, branchId])

  const items = matchingProducts(data, branchId, query).filter((product) => category === 'all' || product.category === category)
  const lines = cart.map((item) => ({ ...item, product: getProduct(data, item.productId) })).filter((line) => line.product)
  const total = lines.reduce((sum, item) => sum + item.product.price * item.qty, 0)
  const quantity = lines.reduce((sum, item) => sum + item.qty, 0)
  const history = data.orders.filter((order) => order.branchId === branchId && includes(order.id + ' ' + order.customer, orderQuery))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 18)
  const getAvailableDevices = (productId) => data.devices.filter((device) => device.productId === productId &&
    device.branchId === branchId && device.status === 'available' && !cart.some((item) => item.deviceId === device.id))
  const addAccessory = (product) => {
    const available = stock(data, product.id, branchId).available
    const item = cart.find((line) => line.productId === product.id && !line.deviceId)
    if ((item?.qty ?? 0) >= available) {
      notify('Số lượng trong giỏ đã bằng tồn khả dụng.', 'error')
      return
    }
    setCart(item ? cart.map((line) => line === item ? { ...line, qty: line.qty + 1 } : line) : [...cart, { productId: product.id, qty: 1 }])
  }
  const cartId = (item) => item.deviceId ?? item.productId

  return <>
    <PageHeading title="Bán hàng POS" description="Chọn sản phẩm, lập đơn và thử luồng thanh toán.">
      {view === 'sale' && <Button onClick={() => setView('orders')} icon={ClipboardList}>Lịch sử hóa đơn</Button>}
      {view === 'orders' && <Button onClick={() => setView('sale')} icon={ArrowLeft}>Quay lại bán hàng</Button>}
    </PageHeading>
    {view === 'orders' ? <section className="panel records-panel">
      <div className="records-toolbar"><PanelHeading title="Hóa đơn đã thanh toán" /><TextSearch label="Tìm hóa đơn" placeholder="Tìm mã hóa đơn, khách hàng…" value={orderQuery} onChange={setOrderQuery} /></div>
      {history.length ? <div className="table-scroll"><table>
        <thead><tr><th>Hóa đơn</th><th>Khách hàng</th><th>Ngày</th><th>Phương thức</th><th className="align-right">Tổng tiền</th></tr></thead>
        <tbody>{history.map((order) => <tr key={order.id}><td><button className="id-link" onClick={() => openReceipt(order)}>{order.id}</button></td>
          <td>{order.customer}</td><td>{shortDay.format(new Date(order.date))}</td><td>{order.method}</td><td className="align-right strong">{money(order.total)}</td></tr>)}</tbody>
      </table></div> : <Empty title="Không có hóa đơn phù hợp" />}
    </section> : <div className="pos-grid">
      <section className="panel pos-products">
        <PanelHeading title="Chọn hàng" description="Điện thoại theo IMEI, phụ kiện theo số lượng" />
        <TextSearch label="Tìm hàng để bán" value={query} onChange={setQuery} placeholder="Tìm tên, SKU, IMEI…" />
        <CategoryFilter category={category} setCategory={setCategory} />
        {items.length ? <div className="product-grid">{items.map((product) => {
          const available = isPhone(product) ? getAvailableDevices(product.id).length : stock(data, product.id, branchId).available
          return <button type="button" className="sale-product" key={product.id} disabled={available === 0}
            onClick={() => isPhone(product) ? setDeviceProduct(product) : addAccessory(product)}>
            <div><ProductIcon product={product} size={22} /><span className="product-add"><Plus size={18} /></span></div>
            <strong>{product.name}</strong><small>{product.sku} · {available} khả dụng</small><b>{money(product.price)}</b>
          </button>
        })}</div> : <Empty title="Không tìm thấy hàng" />}
      </section>
      <section className="panel cart-panel">
        <PanelHeading title="Đơn hiện tại" description={quantity + ' sản phẩm trong đơn'} />
        <Field label="Khách hàng"><input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Khách lẻ" maxLength={80} /></Field>
        {lines.length ? <div className="cart-lines">{lines.map((item) => {
          const device = data.devices.find((entry) => entry.id === item.deviceId)
          return <div className="cart-row" key={cartId(item)}>
            <ProductName product={item.product} subtitle={device ? device.imeis[0] : money(item.product.price)} />
            <div className="cart-row-bottom">
              <div className="quantity-control">
                {!device && <button aria-label={'Giảm ' + item.product.name} disabled={item.qty <= 1} onClick={() => setCart(cart.map((value) => cartId(value) === cartId(item) ? { ...value, qty: value.qty - 1 } : value))}><Minus size={14} /></button>}
                <span>{item.qty}</span>
                {!device && <button aria-label={'Tăng ' + item.product.name} onClick={() => addAccessory(item.product)}><Plus size={14} /></button>}
              </div>
              <strong>{money(item.qty * item.product.price)}</strong>
              <button className="icon-button small-button" aria-label={'Xóa ' + item.product.name} onClick={() => setCart(cart.filter((value) => cartId(value) !== cartId(item)))}><Trash2 size={15} /></button>
            </div>
          </div>
        })}</div> : <Empty title="Đơn hàng đang trống">Chọn sản phẩm để bắt đầu.</Empty>}
        <div className="cart-total"><span>Tổng thanh toán</span><strong>{money(total)}</strong></div>
        <Button variant="primary" icon={CreditCard} onClick={() => setPaying(true)} disabled={!lines.length}>Thanh toán</Button>
      </section>
    </div>}
    {deviceProduct && <Modal title="Chọn thiết bị" description={deviceProduct.name} onClose={() => setDeviceProduct(null)}>
      <div className="device-list">{getAvailableDevices(deviceProduct.id)
        .sort((left, right) => Number([right.serial, ...right.imeis].some((value) => query && includes(value, query))) - Number([left.serial, ...left.imeis].some((value) => query && includes(value, query))))
        .map((device) => <button className="device-option" key={device.id} onClick={() => {
          setCart([...cart, { productId: deviceProduct.id, deviceId: device.id, qty: 1 }])
          setDeviceProduct(null)
        }}><span className="metric-icon lilac"><ScanLine size={18} /></span><span><strong>{device.serial}</strong><small>{device.imeis.join(' · ')}</small></span><Check size={17} /></button>)}</div>
    </Modal>}
    {paying && <Payment customer={customer} total={total} onClose={() => setPaying(false)} onPay={(method, failure) => {
      const order = commit((draft) => checkout(draft, branchId, lines.map(({ productId, deviceId, qty }) => ({ productId, deviceId, qty })), customer, method, failure),
        'Đã thanh toán và cập nhật tồn kho mô phỏng.')
      setCart([])
      setCustomer('')
      setPaying(false)
      openReceipt(order)
    }} />}
  </>
}

