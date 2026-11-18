import { useState } from 'react'
import Counts from './counts.jsx'
import Policies from './policies.jsx'
import { request } from './api.js'
import {
  ArrowDownToLine, ArrowLeftRight, ArrowRight, ArrowUpFromLine, ClipboardPlus,
  Package, ScanLine, ShieldPlus,
} from 'lucide-react'
import {
  branchName, branches, clock, createService, createTransfer, fullDay, getProduct, includes, isPhone,
  number, orderMatch, serviceStatus, shortDay, stock, stockRecord, transferStatus, updateService,
  updateTransfer,
} from './data.js'
import {
  ActionForm, Button, Empty, Field, Modal, PageHeading, PanelHeading,
  ProductName, Select, Status, Tabs, TextSearch,
} from './components.jsx'

function StockForm({ mode, data, branchId, commit, onClose }) {
  const [productId, setProductId] = useState('')
  const product = getProduct(data, productId)
  const phone = product && isPhone(product)
  const type = mode === 'out' ? 'Xuất kho' : 'Nhập kho'
  const transfer = mode === 'transfer'
  const choices = data.devices.filter((device) => device.productId === productId && device.branchId === branchId && device.status === 'available')
  return <Modal title={transfer ? 'Tạo phiếu điều chuyển' : type} description={branchName(branchId)} onClose={onClose}>
    <ActionForm actionLabel={transfer ? 'Tạo phiếu' : 'Xác nhận ' + type.toLowerCase()} onClose={onClose}
      onSubmit={async (form) => {
        const values = Object.fromEntries(form)
        await commit((draft) => transfer ? createTransfer(draft, branchId, values) : stockRecord(draft, branchId, { ...values, type }),
          transfer ? 'Đã tạo phiếu chờ duyệt.' : 'Đã ghi phiếu và cập nhật tồn kho.')
        onClose()
      }}>
      {transfer && <Field label="Chi nhánh nhận"><Select label="Chi nhánh nhận" name="to" required defaultValue="">
        <option value="" disabled>Chọn chi nhánh nhận</option>{branches.filter((branch) => branch.id !== branchId).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
      </Select></Field>}
      <Field label="Sản phẩm"><Select name="productId" label="Sản phẩm" value={productId} onChange={(event) => setProductId(event.target.value)} required>
        <option value="">Chọn sản phẩm</option>
        {data.products.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}
      </Select></Field>
      {product && (phone ? mode === 'receipt' ? <div className="form-grid">
        <Field label="Serial"><input name="serial" placeholder="PF0000123" required maxLength={30} /></Field>
        <Field label="IMEI" help="Mỗi IMEI 15 số, cách nhau bằng dấu phẩy."><input name="imeis" placeholder="350123450000123, 351…" required /></Field>
      </div> : <Field label="Thiết bị khả dụng"><Select key={productId} label="Thiết bị khả dụng" name="deviceId" required defaultValue="">
        <option value="" disabled>{choices.length ? 'Chọn serial hoặc IMEI' : 'Không có thiết bị khả dụng'}</option>
        {choices.map((device) => <option key={device.id} value={device.id}>{device.serial} · {device.imeis[0]}</option>)}
      </Select></Field> : <Field label="Số lượng" help={mode !== 'receipt' ? 'Khả dụng: ' + number(stock(data, product.id, branchId).available) : undefined}>
        <input name="qty" type="number" min="1" step="1" required defaultValue="1" key={productId} />
      </Field>)}
      <Field label={transfer ? 'Ghi chú' : 'Chứng từ hoặc lý do'}>
        <textarea name="note" rows={2} required={!transfer} maxLength={200} placeholder={transfer ? 'Lý do điều chuyển…' : 'Mã chứng từ hoặc thông tin hàng hóa…'} />
      </Field>
    </ActionForm>
  </Modal>
}

export function TransferDetail({ item, product, branchId, commit, onClose, permissions = [], data }) {
  const [review, setReview] = useState(false)
  const action = item.from === branchId ? {
    pending: ['approve', 'Duyệt phiếu'], approved: ['dispatch', 'Xác nhận xuất'],
  }[item.status] : {
    moving: ['receive', 'Xác nhận nhận'], review: ['reconcile', 'Hoàn tất đối soát'],
  }[item.status]
  const [code, label] = review ? ['report', 'Lưu biên bản'] : action ?? []
  const allowed = !['approve', 'reconcile'].includes(code) || permissions.includes('approve')
  return <Modal key={item.id} title={'Phiếu ' + item.id} description={branchName(item.from) + ' → ' + branchName(item.to)} onClose={onClose}>
    <div className="detail-product"><ProductName product={product} /><Status value={transferStatus[item.status]} /></div>
    {item.lines?.length > 1 && <div className="table-scroll"><table><thead><tr><th>Sản phẩm</th><th>SL</th></tr></thead><tbody>{item.lines.map((line) => <tr key={line.id}><td><ProductName product={getProduct(data, line.productId)} /></td><td>{line.qty}</td></tr>)}</tbody></table></div>}
    <dl className="detail-list">
      <div><dt>Số lượng</dt><dd>{number(item.qty)}</dd></div>
      <div><dt>Ngày tạo</dt><dd>{fullDay.format(new Date(item.date))}</dd></div>
      {item.note && <div><dt>Ghi chú</dt><dd>{item.note}</dd></div>}
      {item.discrepancy && <div><dt>Biên bản chênh lệch</dt><dd>{item.discrepancy}</dd></div>}
      {item.resolution && <div><dt>Kết luận đối soát</dt><dd>{item.resolution}</dd></div>}
    </dl>
    {action && allowed && <ActionForm actionLabel={label} onClose={onClose} onSubmit={async (form) => {
      await commit((draft) => updateTransfer(draft, branchId, item.id, code, form.get('note') ?? ''), 'Đã cập nhật phiếu ' + item.id + '.')
      onClose()
    }}>
      {code === 'receive' && <Button variant="ghost" onClick={() => setReview(true)}>Ghi nhận chênh lệch</Button>}
      {['report', 'reconcile'].includes(code) && <Field label={review ? 'Nội dung biên bản' : 'Kết luận xử lý'}><textarea name="note" required rows={3} maxLength={250} /></Field>}
    </ActionForm>}
    {!action && <div className="form-actions"><Button onClick={onClose}>Đóng</Button></div>}
  </Modal>
}

export function Warehouse({ data, branchId, params, commit, permissions }) {
  const initialMode = params.get('mode')
  const [tab, setTab] = useState(initialMode === 'receipt' ? 'movements' : 'stock')
  const [mode, setMode] = useState(initialMode === 'receipt' ? 'receipt' : null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const products = data.products.map((product) => ({ product, ...stock(data, product.id, branchId) }))
  const totals = products.reduce((acc, item) => ({
    available: acc.available + item.available, moving: acc.moving + item.moving, quarantine: acc.quarantine + item.quarantine,
  }), { available: 0, moving: 0, quarantine: 0 })
  const inventory = products.filter(({ product }) => includes(product.name + ' ' + product.sku, query))
  const movements = data.movements.filter((item) => item.branchId === branchId && includes([item.id, item.type, item.note, getProduct(data, item.productId)?.name].join(' '), query))
    .sort((left, right) => right.date.localeCompare(left.date))
  const transfers = data.transfers.filter((item) => [item.from, item.to].includes(branchId) && includes([item.id, getProduct(data, item.productId)?.name, branchName(item.to)].join(' '), query))
  const transfer = transfers.find((item) => item.id === selected)
  return <>
    <PageHeading title="Quản lý kho" description="Theo dõi tồn khả dụng, nhập xuất và điều chuyển giữa chi nhánh.">
      <Button icon={ArrowUpFromLine} onClick={() => { setTab('movements'); setMode('out') }}>Xuất kho</Button>
      <Button variant="primary" icon={ArrowDownToLine} onClick={() => { setTab('movements'); setMode('receipt') }}>Nhập kho</Button>
    </PageHeading>
    <div className="summary-strip warehouse-summary">
      <span><Package size={19} />Khả dụng<strong>{number(totals.available)}</strong></span>
      <span><ArrowLeftRight size={19} />Đang chuyển đi<strong>{number(totals.moving)}</strong></span>
      <span><ScanLine size={19} />Cách ly<strong>{number(totals.quarantine)}</strong></span>
    </div>
    <section className="panel records-panel">
      <div className="records-toolbar">
        <Tabs label="Nghiệp vụ kho" value={tab} onChange={(value) => { setTab(value); setQuery('') }}
          items={[{ id: 'stock', name: 'Tồn kho' }, { id: 'movements', name: 'Nhập / xuất' }, { id: 'transfers', name: 'Điều chuyển' }, { id: 'counts', name: 'Kiểm kê' }]} />
        <div className="filter-actions">
          <TextSearch label="Tìm trong kho" value={query} onChange={setQuery} placeholder={tab === 'stock' ? 'Tìm sản phẩm, SKU…' : 'Tìm mã phiếu, sản phẩm…'} />
          {tab === 'transfers' && <Button icon={ArrowLeftRight} onClick={() => setMode('transfer')}>Tạo phiếu</Button>}
        </div>
      </div>
      {tab === 'counts' && <Counts data={data} commit={commit} permissions={permissions} />}
      {tab === 'stock' && (inventory.length ? <div className="table-scroll"><table>
        <thead><tr><th>Sản phẩm</th><th>Loại theo dõi</th><th className="align-right">Khả dụng</th><th className="align-right">Đang chuyển đi</th><th className="align-right">Cách ly</th></tr></thead>
        <tbody>{inventory.map(({ product, available, moving, quarantine }) => <tr key={product.id}>
          <td><ProductName product={product} /></td><td>{isPhone(product) ? 'Theo IMEI' : 'Theo SKU'}</td>
          <td className="align-right strong">{number(available)}</td><td className="align-right">{number(moving)}</td><td className="align-right">{number(quarantine)}</td>
        </tr>)}</tbody>
      </table></div> : <Empty title="Không tìm thấy sản phẩm" />)}
      {tab === 'movements' && (movements.length ? <div className="table-scroll"><table>
        <thead><tr><th>Mã phiếu</th><th>Sản phẩm</th><th>Loại giao dịch</th><th className="align-right">SL</th><th>Chứng từ / lý do</th><th>Ngày</th></tr></thead>
        <tbody>{movements.map((item) => <tr key={item.id}><td className="strong">{item.id}</td>
          <td><ProductName product={getProduct(data, item.productId)} /></td><td><Status value={[item.type, item.type === 'Nhập kho' ? 'green' : 'blue']} /></td>
          <td className="align-right">{number(item.qty)}</td><td>{item.note}</td><td>{shortDay.format(new Date(item.date))}</td>
        </tr>)}</tbody>
      </table></div> : <Empty title="Không tìm thấy giao dịch" />)}
      {tab === 'transfers' && (transfers.length ? <div className="table-scroll"><table>
        <thead><tr><th>Mã phiếu</th><th>Sản phẩm</th><th>Tuyến điều chuyển</th><th className="align-right">SL</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
        <tbody>{transfers.map((item) => <tr key={item.id}><td><button className="id-link" onClick={() => setSelected(item.id)}>{item.id}</button></td>
          <td><ProductName product={getProduct(data, item.productId)} /></td><td>{branchName(item.from)} → {branchName(item.to)}</td>
          <td className="align-right">{number(item.qty)}</td><td><Status value={transferStatus[item.status]} /></td>
          <td><button className="row-go" aria-label={'Xem phiếu ' + item.id} onClick={() => setSelected(item.id)}><ArrowRight size={17} /></button></td>
        </tr>)}</tbody>
      </table></div> : <Empty title="Chưa có phiếu điều chuyển" />)}
    </section>
    {mode && <StockForm mode={mode} data={data} branchId={branchId} commit={commit} onClose={() => setMode(null)} />}
    {transfer && <TransferDetail item={transfer} data={data} product={getProduct(data, transfer.productId)} branchId={branchId} commit={commit} permissions={permissions} onClose={() => setSelected(null)} />}
  </>
}

function ServiceLookup({ type, data, branchId, commit, onClose, onCreated, initialQuery }) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [searched, setSearched] = useState(initialQuery ?? '')
  const [selection, setSelection] = useState('')
  const [policies, setPolicies] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const hits = orderMatch(data, branchId, searched)
  const result = hits.find(({ order, index }) => [order.id, index].join(':') === selection)
  const hint = data.orders.find((order) => order.branchId === branchId)?.id
  return <Modal title={type === 'warranty' ? 'Tiếp nhận bảo hành' : 'Tạo phiếu đổi trả'}
    description="Tra cứu theo mã hóa đơn, IMEI hoặc serial của thiết bị." onClose={onClose} wide>
    <form className="lookup-form" onSubmit={async (event) => {
      event.preventDefault(); setSearched(query.trim()); setSelection(''); setPolicies([]); setError(''); setLoading(true)
      try { if (type === 'warranty') setPolicies(await request('/warranty/eligibility?q=' + encodeURIComponent(query.trim()))) }
      catch(e) { setError(e.message) } finally { setLoading(false) }
    }}>
      <TextSearch value={query} onChange={setQuery} label="Tra cứu hóa đơn, IMEI hoặc serial" placeholder={hint ? 'Ví dụ: ' + hint : 'Mã hóa đơn, IMEI hoặc serial…'} />
      <Button type="submit" icon={ScanLine} variant="primary" disabled={!query.trim() || loading}>{loading ? 'Đang tra…' : 'Tra cứu'}</Button>
    </form>
    {searched && (hits.length ? <div className="device-list">{hits.map(({ order, line, index, device }) => {
      const key = [order.id, index].join(':')
      return <button className={'device-option' + (selection === key ? ' selected' : '')} key={key} onClick={() => setSelection(key)}>
        <ProductName product={getProduct(data, line.productId)} subtitle={order.id + ' · ' + (device?.imeis[0] ?? line.sku)} />
        <span>{order.customer}</span><ArrowRight size={16} />
      </button>
    })}</div> : <Empty title="Không tìm thấy giao dịch tại chi nhánh">Kiểm tra mã hoặc chọn đúng chi nhánh.</Empty>)}
    {error && <p className="form-error" role="alert">{error}</p>}
    {result && type === 'warranty' && policies.filter((p) => p.saleId === result.order.id && p.lineIndex === result.index).map((p) => <div className="android-result" key={p.id}><Status value={[p.eligible ? 'Trong hạn bảo hành' : 'Chưa đủ điều kiện', p.eligible ? 'green' : 'amber']} /><p>{p.reason}</p><p className="small muted">{p.coverage} · Loại trừ: {p.exclusions}</p><p className="small">Hết hạn {fullDay.format(new Date(p.expiresAt))}</p></div>)}
    {result && <ActionForm actionLabel={type === 'warranty' ? 'Tạo phiếu bảo hành' : 'Tạo phiếu đổi trả'} onClose={onClose}
      onSubmit={async (form) => {
        const entry = await commit((draft) => createService(draft, branchId, type, result.order.id, result.index, form.get('reason')), 'Đã tạo phiếu hậu mãi.')
        onCreated(entry.id)
      }}>
      <Field label={type === 'warranty' ? 'Mô tả lỗi' : 'Lý do đổi trả'}><textarea name="reason" rows={3} maxLength={240} required placeholder="Ghi nhận phản ánh của khách hàng…" /></Field>
    </ActionForm>}
  </Modal>
}

function ServiceDetail({ item, order, data, branchId, commit, onClose, permissions }) {
  const line = order?.lines[item.lineIndex]
  const device = data.devices.find((device) => device.id === line?.deviceId)
  const transition = {
    received: ['processing', 'Bắt đầu xử lý'], processing: ['done', 'Hoàn tất bảo hành'],
    pending: ['approved', 'Duyệt đổi trả'], approved: ['returned', 'Xác nhận nhận lại hàng'],
  }[item.status]
  return <Modal title={'Phiếu ' + item.id} description={item.type === 'warranty' ? 'Bảo hành' : 'Đổi trả'} onClose={onClose} wide>
    <div className="detail-product"><ProductName product={getProduct(data, line?.productId)} subtitle={device?.imeis.join(' · ') ?? line?.sku} /><Status value={serviceStatus[item.status]} /></div>
    <dl className="detail-list">
      <div><dt>Hóa đơn</dt><dd>{item.orderId}</dd></div><div><dt>Khách hàng</dt><dd>{order?.customer}</dd></div>
      <div><dt>Lý do</dt><dd>{item.reason}</dd></div>
      {item.condition && <div><dt>Phân loại hàng nhận</dt><dd>{item.condition === 'available' ? 'Khả dụng' : 'Cách ly'}</dd></div>}
    </dl>
    <PanelHeading title="Lịch sử xử lý" />
    <ol className="history-list">{item.history.map((event, index) => <li key={index}>
      <span className="history-dot" /><div><strong>{serviceStatus[event.status][0]}</strong><small>{fullDay.format(new Date(event.date))} · {clock.format(new Date(event.date))}</small>{event.note && <p>{event.note}</p>}</div>
    </li>)}</ol>
    {transition && permissions.includes(item.type === 'return' && transition[0] === 'approved' ? 'approve' : 'aftercare') ? <ActionForm actionLabel={transition[1]} onClose={onClose} onSubmit={async (form) => {
      await commit((draft) => updateService(draft, branchId, item.id, transition[0], form.get('note') ?? '', form.get('condition')), 'Đã cập nhật ' + item.id + '.')
    }}>
      {transition[0] === 'returned' && <Field label="Tình trạng hàng nhận"><Select name="condition" label="Tình trạng hàng nhận">
        <option value="quarantine">Lỗi · chuyển cách ly</option><option value="available">Đạt kiểm tra · trả tồn khả dụng</option>
      </Select></Field>}
      <Field label="Ghi chú xử lý"><input name="note" maxLength={200} placeholder="Kết quả kiểm tra hoặc nội dung bàn giao…" /></Field>
    </ActionForm> : <div className="form-actions"><Button onClick={onClose}>Đóng</Button></div>}
  </Modal>
}

export function AfterSales({ data, branchId, params, commit, permissions }) {
  const [type, setType] = useState('warranty')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [lookup, setLookup] = useState(params.get('mode') === 'lookup')
  const [selected, setSelected] = useState(params.get('ticket'))
  const [policiesOpen, setPoliciesOpen] = useState(false)
  const branchServices = data.services.filter((item) => item.branchId === branchId)
  const rows = branchServices.filter((item) => item.type === type && (status === 'all' || status === item.status))
    .map((item) => ({ item, order: data.orders.find((order) => order.id === item.orderId) }))
    .filter(({ item, order }) => {
      const line = order?.lines[item.lineIndex]
      const device = data.devices.find((entry) => entry.id === line?.deviceId)
      return includes([item.id, item.orderId, order?.customer, line?.name, device?.serial, ...(device?.imeis ?? [])].join(' '), query)
    })
    .sort((a, b) => b.item.date.localeCompare(a.item.date))
  const ticket = branchServices.find((item) => item.id === selected)
  const statuses = type === 'warranty' ? ['received', 'processing', 'done'] : ['pending', 'approved', 'returned']
  return <>
    <PageHeading title="Bảo hành và đổi trả" description="Tra cứu giao dịch, tiếp nhận phiếu và theo dõi tiến trình xử lý.">
      {permissions.includes('catalog') && <Button onClick={() => setPoliciesOpen(true)}>Chính sách bảo hành</Button>}
      <Button variant="primary" icon={type === 'warranty' ? ShieldPlus : ClipboardPlus} onClick={() => setLookup(true)}>
        {type === 'warranty' ? 'Tiếp nhận bảo hành' : 'Tạo phiếu đổi trả'}
      </Button>
    </PageHeading>
    <section className="panel records-panel">
      <div className="records-toolbar">
        <Tabs label="Loại phiếu hậu mãi" value={type} onChange={(value) => { setType(value); setStatus('all'); setQuery('') }}
          items={[{ id: 'warranty', name: 'Bảo hành', count: branchServices.filter((item) => item.type === 'warranty').length },
            { id: 'return', name: 'Đổi trả', count: branchServices.filter((item) => item.type === 'return').length }]} />
        <div className="filter-actions">
          <TextSearch label="Tìm phiếu hậu mãi" placeholder="Tìm phiếu, khách hàng, IMEI…" value={query} onChange={setQuery} />
          <Select label="Trạng thái phiếu" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Mọi trạng thái</option>{statuses.map((key) => <option value={key} key={key}>{serviceStatus[key][0]}</option>)}
          </Select>
        </div>
      </div>
      {rows.length ? <div className="table-scroll"><table>
        <thead><tr><th>Mã phiếu</th><th>Sản phẩm</th><th>Khách hàng</th><th>Ngày tạo</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
        <tbody>{rows.map(({ item, order }) => <tr key={item.id}>
          <td><button className="id-link" onClick={() => setSelected(item.id)}>{item.id}</button><small className="table-sub">{item.orderId}</small></td>
          <td><ProductName product={getProduct(data, order?.lines[item.lineIndex]?.productId)} /></td><td>{order?.customer}</td>
          <td>{shortDay.format(new Date(item.date))}</td><td><Status value={serviceStatus[item.status]} /></td>
          <td><button className="row-go" aria-label={'Xem ' + item.id} onClick={() => setSelected(item.id)}><ArrowRight size={17} /></button></td>
        </tr>)}</tbody>
      </table></div> : <Empty title="Không có phiếu phù hợp">Đổi bộ lọc hoặc tạo phiếu từ hóa đơn đã thanh toán.</Empty>}
    </section>
    {lookup && <ServiceLookup type={type} data={data} branchId={branchId} commit={commit} initialQuery={params.get('q')}
      onClose={() => setLookup(false)} onCreated={(id) => { setLookup(false); setSelected(id) }} />}
    {ticket && <ServiceDetail key={ticket.id} item={ticket} order={data.orders.find((order) => order.id === ticket.orderId)}
      data={data} branchId={branchId} commit={commit} permissions={permissions} onClose={() => setSelected(null)} />}
    {policiesOpen && <Policies data={data} commit={commit} onClose={() => setPoliciesOpen(false)} />}
  </>
}

