import { useState } from 'react'
import { ClipboardList, ScanLine, Wifi, WifiOff, LogOut, ArrowRight, Smartphone } from 'lucide-react'
import { Button, Field, PageHeading, ProductName, Select, Status } from './components.jsx'
import { branchName, deviceStatus, getProduct, isPhone, normalize, number } from './data.js'
import { request, post, operationKey, finishOperation } from './api.js'
import Counts from './counts.jsx'
import { TransferDetail } from './operations.jsx'

export default function Mobile({ data, branchId, user, permissions, commit, standalone, logout, onBranch }) {
  const key = 'phoneflow-count-server-v1:' + user.id + ':' + branchId
  const [screen, setScreen] = useState('lookup')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [transferId, setTransferId] = useState(null)
  const [draft, setDraft] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(key)); return Array.isArray(saved?.rows) ? saved : { rows: [] } } catch { return { rows: [] } }
  })
  const [dirty, setDirty] = useState(false)
  const transfer = data.transfers.find((t) => t.id === transferId)
  const deviceSample = data.devices.find((d) => d.status === 'available')?.imeis[0]
  const sample = deviceSample || data.products.find((p) => p.category === 'Phụ kiện')?.sku

  function saveLocal(next) {
    localStorage.setItem(key, JSON.stringify(next))
    setDirty(false)
  }
  async function scan() {
    if (!query.trim() || busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      let found
      if (offline) {
        const code = normalize(query)
        const device = data.devices.find((d) => [d.serial, ...d.imeis].some((id) => normalize(id) === code))
        const product = device ? getProduct(data, device.productId) : data.products.find((p) => normalize(p.sku) === code)
        if (!product) throw new Error('Mã chưa có trong dữ liệu đã tải. Kết nối lại để tra máy chủ.')
        found = { product, device, ...data.balances.find((b) => b.productId === product.id) }
      } else found = await request('/lookup?q=' + encodeURIComponent(query.trim()))
      setResult(found)
      if (screen === 'count') {
        const { product, device } = found
        if (isPhone(product) && device?.status !== 'available') throw new Error('Quét IMEI của thiết bị khả dụng.')
        const row = draft.rows.find((r) => r.productId === product.id)
        if (device && row?.devices.includes(device.id)) throw new Error('Thiết bị đã quét, kể cả khi dùng IMEI khác.')
        const nextRow = { productId: product.id, expected: row?.expected ?? found.available,
          revision: row?.revision ?? found.revision, count: (row?.count ?? 0) + 1,
          devices: [...(row?.devices || []), ...(device ? [device.id] : [])] }
        const next = { rows: row ? draft.rows.map((r) => r === row ? nextRow : r) : [...draft.rows, nextRow] }
        setDraft(next); setDirty(true); setMessage('Đã ghi một lượt quét.')
      }
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function sendCount() {
    setError(''); setMessage('')
    if (offline) { setError('Kết nối lại để gửi phiếu lên máy chủ.'); return }
    setBusy(true)
    try {
      const action = JSON.stringify(['mobile-count', branchId, draft.rows])
      const key = operationKey(action)
      const count = await post('/counts', { rows: draft.rows, note: 'Kiểm kê từ Mobile Web' }, { key: key + ':create' })
      await commit(() => post('/counts/' + count.id + '/submit', {}, { key: key + ':submit' }), 'Đã gửi ' + count.id + ' chờ duyệt.')
      finishOperation(action)
      const empty = { rows: [] }
      setDraft(empty); saveLocal(empty); setMessage('Đã gửi ' + count.id + ' chờ duyệt.'); setResult(null)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const body = <div className="android-phone">
    <header className="android-header"><div><strong>PhoneFlow Mobile</strong><small>{user.name} · {branchName(branchId)}</small></div>
      {standalone && <button type="button" className="icon-button" aria-label="Đăng xuất" onClick={logout}><LogOut size={17} /></button>}
    </header>
    {standalone && <Select label="Chi nhánh Mobile" value={branchId} onChange={(e) => onBranch(e.target.value)}>
      {user.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </Select>}
    <div className="android-content">
      <div className="mobile-network-row"><span>{offline ? 'Đang mất mạng' : 'Đã kết nối API'}</span>
        <button className="icon-button" aria-label="Mô phỏng kết nối" onClick={() => setOffline(!offline)}>{offline ? <WifiOff size={17} /> : <Wifi size={17} />}</button>
      </div>
      {['lookup', 'count'].includes(screen) && <>
        <h2>{screen === 'lookup' ? 'Quét và tra cứu' : 'Đối chiếu kiểm kê'}</h2>
        <form className="android-code-form" onSubmit={(e) => { e.preventDefault(); scan() }}>
          <Field label={screen === 'lookup' ? 'Mã tra cứu' : 'Mã kiểm kê'}><input required value={query} onChange={(e) => setQuery(e.target.value)} placeholder="IMEI, SKU hoặc serial" /></Field>
          <Button variant="primary" type="submit" icon={ScanLine} disabled={busy}>{busy ? 'Đang xử lý…' : screen === 'count' ? 'Ghi nhận mã' : 'Tra cứu'}</Button>
          <button type="button" className="text-button" onClick={() => setQuery(sample || '')}>Điền mã mẫu</button>
        </form>
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="android-feedback" role="status">{message}</p>}
      {result && screen === 'lookup' && <section className="android-result" aria-label="Kết quả tra cứu"><ProductName product={result.product} />
        {result.device && <dl><div><dt>Serial</dt><dd>{result.device.serial}</dd></div><div><dt>IMEI</dt><dd>{result.device.imeis.map((i) => <span key={i}>{i}</span>)}</dd></div>
          <div><dt>Trạng thái</dt><dd><Status value={deviceStatus[result.device.status]} /></dd></div></dl>}
        {!result.device && <p>Khả dụng: {number(result.available)}</p>}
        {offline && <small>Dữ liệu đã tải trước khi mất mạng.</small>}
      </section>}
      {screen === 'count' && <>
        {draft.rows.map((row) => <section className="android-result" key={row.productId}><ProductName product={getProduct(data, row.productId)} />
          <div className="android-count-values"><span>Dự kiến<strong>{row.expected}</strong></span><span>Đã quét<strong>{row.count}</strong></span><span>Chênh lệch<strong>{row.count - row.expected}</strong></span></div>
          <Button onClick={() => { setDraft({ rows: draft.rows.filter((r) => r !== row) }); setDirty(true) }}>Xóa dòng</Button>
        </section>)}
        <div className="form-actions"><Button disabled={!dirty} onClick={() => { try { saveLocal(draft); setMessage('Đã lưu bản nháp trên thiết bị.') } catch { setError('Chưa lưu được bản nháp.') } }}>Lưu nháp</Button>
          <Button variant="primary" disabled={busy || !draft.rows.length || offline} onClick={sendCount}>Gửi duyệt</Button></div>
        <p className="android-draft-note">Nếu tồn thay đổi, đối chiếu lại mã và số lượng trước khi lập phiếu mới.</p>
        <Button onClick={() => { setDraft({ rows: [] }); setDirty(true); setError(''); setResult(null) }}>Đếm lại</Button>
      </>}
      {screen === 'counts' && <Counts data={data} commit={commit} permissions={permissions} />}
      {screen === 'receive' && <>
        <h2>Nhận điều chuyển</h2>
        <div className="device-list">{data.transfers.filter((t) => t.to === branchId && t.status !== 'received').map((t) =>
          <button className="device-option" key={t.id} onClick={() => setTransferId(t.id)}><span><strong>{t.id}</strong><small>{branchName(t.from)} · {t.qty} sản phẩm</small></span><ArrowRight size={16} /></button>)}
        </div>
        {!data.transfers.some((t) => t.to === branchId && t.status !== 'received') && <p className="muted small">Chưa có phiếu nhận đang mở.</p>}
      </>}
    </div>
    <nav className="android-nav" aria-label="Điều hướng Mobile">
      {[
        ['lookup', 'Tra cứu', ScanLine, true], ['count', 'Đếm', ClipboardList, permissions.includes('stock')],
        ['counts', 'Phiếu đếm', ClipboardList, permissions.includes('stock')], ['receive', 'Nhận hàng', Smartphone, permissions.includes('stock')],
      ].filter((s) => s[3]).map(([id, label, Icon]) => <button key={id} type="button" aria-current={screen === id ? 'page' : undefined}
        onClick={() => { setScreen(id); setError(''); setMessage(''); setResult(null) }}><Icon size={17} />{label}</button>)}
    </nav>
  </div>
  return <>
    {!standalone && <PageHeading title="Mobile Web" description="Dùng chung API và dữ liệu SQL Server với Web."><a className="button secondary" href="/mobile" target="_blank" rel="noreferrer">Mở Mobile riêng</a></PageHeading>}
    <div className={standalone ? 'mobile-full' : 'android-layout'}><div className="android-stage">{body}</div></div>
    {transfer && <TransferDetail item={transfer} data={data} product={getProduct(data, transfer.productId)} branchId={branchId} commit={commit} permissions={permissions} onClose={() => setTransferId(null)} />}
  </>
}

