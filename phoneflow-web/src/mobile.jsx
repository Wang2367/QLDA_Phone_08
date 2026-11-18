import { useState } from 'react'
import {
  ArrowRight, BatteryFull, Box, ClipboardList, Eye, EyeOff, LogOut, ScanLine, Search,
  Signal, Smartphone, Trash2, Wifi, WifiOff,
} from 'lucide-react'
import { Button, Field, PageHeading, PanelHeading, ProductName, Status } from './components.jsx'
import { branchName, clock, demoAccount, deviceStatus, getProduct, isPhone, normalize, number, stock } from './data.js'

const steps = [
  { id: 'login', code: 'M01', title: 'Đăng nhập', Icon: Smartphone },
  { id: 'lookup', code: 'M02', title: 'Quét và tra cứu', Icon: ScanLine },
  { id: 'count', code: 'M03', title: 'Đối chiếu kiểm kê', Icon: ClipboardList },
]

function findCode(data, branchId, value) {
  const code = normalize(value)
  const device = data.devices.find((item) => [item.serial, ...item.imeis].some((id) => normalize(id) === code))
  if (device && device.branchId !== branchId) return { error: 'Thiết bị nằm ngoài chi nhánh đang chọn.' }
  const product = device ? getProduct(data, device.productId) : data.products.find((item) => normalize(item.sku) === code)
  if (!product) return { error: 'Không tìm thấy mã IMEI, SKU hoặc serial này.' }
  return { product, device, available: stock(data, product.id, branchId).available }
}

function MobileLogin({ branchId, onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  return <div className="android-login">
    <span className="android-logo"><Smartphone size={25} aria-hidden="true" /></span>
    <h2>Đăng nhập</h2>
    <p>Phiên Android tại chi nhánh {branchName(branchId)}.</p>
    <form onSubmit={(event) => {
      event.preventDefault()
      if (username.trim() === demoAccount.username && password === demoAccount.password) onLogin()
      else setError('Tài khoản hoặc mật khẩu chưa đúng.')
    }}>
      <Field label="Tài khoản Android"><input value={username} autoComplete="username" required
        onChange={(event) => { setUsername(event.target.value); setError('') }} placeholder="Nhập tài khoản" /></Field>
      <Field label="Mật khẩu Android"><span className="password-wrap">
        <input value={password} type={visible ? 'text' : 'password'} autoComplete="current-password" required
          onChange={(event) => { setPassword(event.target.value); setError('') }} placeholder="Nhập mật khẩu" />
        <button type="button" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setVisible(!visible)}>
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span></Field>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button variant="primary" type="submit" icon={ArrowRight}>Đăng nhập Android</Button>
      <Button onClick={() => { setUsername(demoAccount.username); setPassword(demoAccount.password); setError('') }}>Điền tài khoản mẫu</Button>
    </form>
  </div>
}

function CodeForm({ label, buttonLabel, sample, onScan }) {
  const [value, setValue] = useState('')
  return <form className="android-code-form" onSubmit={(event) => {
    event.preventDefault()
    if (value.trim()) onScan(value)
  }}>
    <Field label={label}><input value={value} required autoComplete="off"
      onChange={(event) => setValue(event.target.value)} placeholder="Nhập IMEI, SKU hoặc serial" /></Field>
    <Button variant="primary" type="submit" icon={ScanLine}>{buttonLabel}</Button>
    {sample && <button className="text-button" type="button" onClick={() => setValue(sample)}>Điền mã mẫu</button>}
  </form>
}

function MobileLookup({ data, branchId, sample }) {
  const [result, setResult] = useState(null)
  return <>
    <h2>Quét và tra cứu</h2>
    <p>Xem thiết bị và tồn kho theo mã tại chi nhánh.</p>
    <CodeForm label="Mã tra cứu" buttonLabel="Tra cứu" sample={sample} onScan={(code) => setResult(findCode(data, branchId, code))} />
    {result?.error && <p className="form-error" role="alert">{result.error}</p>}
    {result?.product && <section className="android-result" aria-label="Kết quả tra cứu" aria-live="polite">
      <ProductName product={result.product} />
      <dl>
        {result.device ? <>
          <div><dt>Serial</dt><dd>{result.device.serial}</dd></div>
          <div><dt>IMEI</dt><dd>{result.device.imeis.map((imei) => <span key={imei}>{imei}</span>)}</dd></div>
          <div><dt>Trạng thái</dt><dd><Status value={deviceStatus[result.device.status]} /></dd></div>
        </> : <div><dt>Tồn khả dụng</dt><dd>{number(result.available)}</dd></div>}
      </dl>
    </section>}
  </>
}

function readDraft(key) {
  try {
    const draft = JSON.parse(localStorage.getItem(key))
    if (Array.isArray(draft?.rows)) return draft
  } catch { /* A mobile demo can start without browser storage. */ }
  return { rows: [], savedAt: null }
}

function MobileCount({ data, branchId, sample }) {
  const draftKey = 'phoneflow-android-count-v1:' + branchId
  const [draft, setDraft] = useState(() => readDraft(draftKey))
  const [message, setMessage] = useState(null)
  const [dirty, setDirty] = useState(false)

  function notify(text, error = false) {
    setMessage({ text, error })
  }

  function addCount(code) {
    const result = findCode(data, branchId, code)
    if (result.error) return notify(result.error, true)
    const { product, device, available } = result
    if (isPhone(product) && device?.status !== 'available') {
      return notify(device ? 'Thiết bị không ở trạng thái khả dụng.' : 'Nhập IMEI hoặc serial để kiểm kê từng điện thoại.', true)
    }
    const row = draft.rows.find((item) => item.productId === product.id)
    if (device && row?.devices.includes(device.id)) return notify('Thiết bị này đã được quét, kể cả khi dùng IMEI khác.', true)

    const updated = {
      productId: product.id,
      expected: row?.expected ?? available,
      count: (row?.count ?? 0) + 1,
      devices: [...(row?.devices ?? []), ...(device ? [device.id] : [])],
    }
    setDraft({ rows: row ? draft.rows.map((item) => item === row ? updated : item) : [...draft.rows, updated], savedAt: null })
    setDirty(true)
    notify('Đã ghi nhận một lượt quét.')
  }

  function save() {
    const next = { ...draft, savedAt: new Date().toISOString() }
    try {
      localStorage.setItem(draftKey, JSON.stringify(next))
      setDraft(next)
      setDirty(false)
      notify('Đã lưu bản nháp tại ' + clock.format(new Date(next.savedAt)) + '.')
    } catch {
      notify('Trình duyệt chưa lưu được bản nháp. Bạn vẫn có thể xem số đã đếm trong tab này.', true)
    }
  }

  return <>
    <h2>Đối chiếu kiểm kê</h2>
    <p>So sánh số quét thực tế với tồn khả dụng.</p>
    <CodeForm label="Mã kiểm kê" buttonLabel="Ghi nhận mã" sample={sample} onScan={addCount} />
    {message && <p className={message.error ? 'form-error' : 'android-feedback'} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    {draft.rows.length > 0 && <div className="android-count-list" aria-label="Số lượng kiểm kê">
      {draft.rows.map((row) => {
        const product = getProduct(data, row.productId)
        const delta = row.count - row.expected
        return <section className="android-result" key={row.productId}>
          <div className="android-count-heading"><ProductName product={product} />
            <button type="button" className="icon-button" aria-label={'Xóa dòng ' + (product?.name ?? row.productId)} onClick={() => {
              setDraft({ rows: draft.rows.filter((item) => item !== row), savedAt: null })
              setDirty(true)
              setMessage(null)
            }}><Trash2 size={16} /></button>
          </div>
          <div className="android-count-values"><span>Tồn dự kiến<strong>{number(row.expected)}</strong></span>
            <span>Đã quét<strong>{number(row.count)}</strong></span><span>Chênh lệch<strong>{delta > 0 ? '+' : ''}{number(delta)}</strong></span>
          </div>
        </section>
      })}
    </div>}
    <Button icon={ClipboardList} onClick={save} disabled={!dirty}>Lưu bản nháp</Button>
    <p className="android-draft-note">{draft.savedAt ? 'Đã lưu lúc ' + clock.format(new Date(draft.savedAt)) + '. ' : ''}Bản nháp lưu trong trình duyệt. Sổ tồn chờ quy trình phê duyệt.</p>
  </>
}

export default function AndroidPreview({ data, branchId }) {
  const [screen, setScreen] = useState('login')
  const [signedIn, setSignedIn] = useState(false)
  const [online, setOnline] = useState(true)
  const sample = data.devices.find((item) => item.branchId === branchId && item.status === 'available')?.imeis[0]
    ?? data.products.find((product) => !isPhone(product))?.sku
  const Network = online ? Wifi : WifiOff

  return <>
    <PageHeading title="Mobile Android" description="Thử ba màn hình Android của PhoneFlow với dữ liệu của chi nhánh đang chọn." />
    <div className="android-layout">
      <div className="android-stage">
        <div className="android-phone">
          <div className="android-status-bar" aria-hidden="true">
            <span>09:41</span><i /><div><Signal size={12} /><Network size={13} /><BatteryFull size={16} /></div>
          </div>
          <header className="android-header">
            <div><strong>PhoneFlow</strong><small>{branchName(branchId)}</small></div>
            {signedIn && <button type="button" className="icon-button" aria-label="Đăng xuất Android" onClick={() => { setSignedIn(false); setScreen('login') }}><LogOut size={17} /></button>}
          </header>
          <div className="android-content">
            {!online && <div className="android-offline"><WifiOff size={15} />Mất mạng mô phỏng · dữ liệu lưu trên thiết bị.</div>}
            {screen === 'login' && <MobileLogin branchId={branchId} onLogin={() => { setSignedIn(true); setScreen('lookup') }} />}
            {screen === 'lookup' && <MobileLookup data={data} branchId={branchId} sample={sample} />}
            {signedIn && <div hidden={screen !== 'count'}><MobileCount data={data} branchId={branchId} sample={sample} /></div>}
          </div>
          {signedIn && <nav className="android-nav" aria-label="Điều hướng Android">
            <button type="button" aria-current={screen === 'lookup' ? 'page' : undefined} onClick={() => setScreen('lookup')}><Search size={17} />Tra cứu</button>
            <button type="button" aria-current={screen === 'count' ? 'page' : undefined} onClick={() => setScreen('count')}><Box size={17} />Kiểm kê</button>
          </nav>}
          <div className="android-gesture" aria-hidden="true"><i /></div>
        </div>
      </div>
      <section className="panel android-control-panel">
        <PanelHeading title="Màn hình Android" description={signedIn ? 'Phiên mẫu của ' + demoAccount.name : 'Đăng nhập mẫu để thử tra cứu và kiểm kê.'} />
        <div className="android-step-list">
          {steps.map(({ id, code, title, Icon }) => <button type="button" key={id} disabled={id !== 'login' && !signedIn}
            aria-pressed={screen === id} onClick={() => setScreen(id)}>
            <span className="metric-icon mint"><Icon size={18} aria-hidden="true" /></span>
            <span><small>{code}</small><strong>{title}</strong></span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>)}
        </div>
        <div className="android-network">
          <div><Network size={18} aria-hidden="true" /><div><strong>Kết nối mô phỏng</strong><small>{online ? 'Đang kết nối' : 'Đang mất mạng'}</small></div></div>
          <button className="android-toggle" type="button" role="switch" aria-label="Kết nối mô phỏng" aria-checked={online} onClick={() => setOnline(!online)}><span /></button>
        </div>
      </section>
    </div>
  </>
}

