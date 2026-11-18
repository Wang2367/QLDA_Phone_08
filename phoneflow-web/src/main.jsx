import { createRoot } from 'react-dom/client'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight, Bell, Boxes, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, Eye,
  EyeOff, LayoutDashboard, LogOut, Menu, Package, Search, ShieldCheck,
  ShoppingCart, Smartphone, Store, X,
} from 'lucide-react'
import { branches, includes, initials, matchingProducts, stock } from './data.js'
import { Brand, Button, Empty, Field, Modal, Select, TextSearch } from './components.jsx'
import Dashboard from './dashboard.jsx'
import Products, { PointOfSale, Receipt } from './sales.jsx'
import { AfterSales, Warehouse } from './operations.jsx'
import AndroidPreview from './mobile.jsx'
import { request, post, useBranch, resetRequests } from './api.js'
import './styles.css'

const screens = [
  { id: 'tong-quan', permission: 'reports', title: 'Tổng quan', icon: LayoutDashboard, Page: Dashboard, keywords: 'dashboard báo cáo doanh thu' },
  { id: 'san-pham', title: 'Sản phẩm', icon: Package, Page: Products, keywords: 'danh mục IMEI SKU' },
  { id: 'pos', permission: 'sale', title: 'Bán hàng POS', icon: ShoppingCart, Page: PointOfSale, keywords: 'hóa đơn thanh toán' },
  { id: 'kho', permission: 'stock', title: 'Quản lý kho', icon: Boxes, Page: Warehouse, keywords: 'nhập xuất điều chuyển' },
  { id: 'hau-mai', permission: 'aftercare', title: 'Bảo hành & đổi trả', icon: ShieldCheck, Page: AfterSales, keywords: 'hậu mãi phiếu bảo hành' },
  { id: 'mobile', title: 'Mobile Web', icon: Smartphone, Page: AndroidPreview, keywords: 'điện thoại quét mã IMEI kiểm kê' },
]
const branchKey = 'phoneflow-branch-v1'

function readStorage(storage, key) {
  try { return storage().getItem(key) } catch { return null }
}

function writeStorage(storage, key, value) {
  try { storage().setItem(key, value) } catch { /* The demo can run without persistent storage. */ }
}

function getLocation() {
  const [path, query] = (window.location.hash.replace(/^#\/?/, '') || (window.location.pathname === '/mobile' ? 'mobile' : '')).split('?')
  const id = path === 'dang-nhap' || screens.some((screen) => screen.id === path) ? path : 'tong-quan'
  return { id, query: query ?? '' }
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return <main className="login-shell">
    <section className="login-main">
      <Brand />
      <div className="login-card">
        <h1>Đăng nhập</h1><p>Truy cập không gian quản lý cửa hàng.</p>
        <form onSubmit={async (event) => {
          event.preventDefault()
          if (busy) return
          setBusy(true); setError('')
          try { await onLogin(username.trim(), password) } catch (error) { setError(error.message) }
          finally { setBusy(false) }
        }}>
          <Field label="Tài khoản"><input autoComplete="username" value={username} onChange={(event) => { setUsername(event.target.value); setError('') }} required placeholder="Nhập tài khoản" /></Field>
          <Field label="Mật khẩu"><span className="password-wrap"><input type={visible ? 'text' : 'password'} autoComplete="current-password" value={password}
            onChange={(event) => { setPassword(event.target.value); setError('') }} required placeholder="Nhập mật khẩu" />
            <button type="button" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></Field>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button variant="primary" type="submit" icon={ArrowRight} disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</Button>
        </form>
        <button type="button" className="demo-fill" onClick={() => { setUsername('quang'); setPassword('PhoneFlow@123'); setError('') }}>Điền tài khoản mẫu <ArrowRight size={15} /></button>
      </div>
      <span className="login-foot">PhoneFlow · Quản lý chuỗi cửa hàng</span>
    </section>
    <aside className="login-visual" aria-label="Bán hàng, Kho và Bảo hành">
      <div className="login-visual-copy"><span className="visual-brand"><Store size={23} /></span><h2>Quản lý<br />cửa hàng điện thoại</h2>
        <p>Bán hàng, tồn kho và bảo hành tại 5 chi nhánh Hà Nội.</p></div>
      <div className="login-graphic" aria-hidden="true">
        <div className="login-graphic-chart">
          <div><span /><span /></div>
          {[40, 61, 47, 83, 68, 97, 81].map((height, index) => <i key={index} style={{ '--height': height + '%' }} />)}
        </div>
        <div className="login-graphic-icon"><Smartphone size={31} /></div>
        <div className="login-check"><span><CheckCircle2 size={20} /></span><div>Đã thanh toán<small>Đơn bán hàng</small></div></div>
      </div>
    </aside>
  </main>
}

function Sidebar({ id, branchId, user, screens, setBranch, navigate, open, close }) {
  return <><button type="button" aria-label="Đóng điều hướng" tabIndex={open ? 0 : -1} className={'sidebar-scrim' + (open ? ' visible' : '')} onClick={close} />
    <aside className={'sidebar' + (open ? ' open' : '')}>
      <button className="brand-button" aria-label="PhoneFlow · Tổng quan" onClick={() => navigate('tong-quan')}><Brand /></button>
      <div className="branch-control">
        <span className="branch-icon"><Store size={18} strokeWidth={1.8} aria-hidden="true" /></span>
        <div><label htmlFor="current-branch">Chi nhánh</label>
          <Select id="current-branch" value={branchId} label="Chi nhánh" onChange={(event) => setBranch(event.target.value)}>
            {user.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
        </div>
      </div>
      <div className="nav-label">QUẢN LÝ</div>
      <nav className="side-nav" aria-label="Menu chính">
        {screens.map(({ id: slug, title, icon: Icon }) => <a key={slug} href={'#/' + slug} onClick={close} aria-current={id === slug ? 'page' : undefined}>
          <Icon size={19} strokeWidth={1.8} aria-hidden="true" /><span>{title}</span>{id === slug && <span className="nav-current" />}
        </a>)}
      </nav>
      <div className="sidebar-bottom"><span className="demo-indicator"><i />SQL Server · Đã kết nối</span></div>
    </aside>
  </>
}

function Header({ user, screen, openMenu, openSearch, alerts, logout, navigate }) {
  function closeDetails(event) { event.currentTarget.closest('details').open = false }
  return <header className="topbar">
    <div className="topbar-route">
      <button className="icon-button mobile-menu" type="button" aria-label="Mở điều hướng" onClick={openMenu}><Menu size={20}/></button>
      <Store size={17} aria-hidden="true" className="breadcrumb-icon" /><span>Quản lý cửa hàng</span>
      <ChevronRight size={14} aria-hidden="true" /><strong>{screen.title}</strong>
    </div>
    <div className="topbar-actions">
      <button className="global-search" type="button" aria-label="Tìm kiếm nhanh" onClick={openSearch}><Search size={17} /><span>Tìm kiếm nhanh</span><kbd>Ctrl K</kbd></button>
      <details className="top-popover notification-popover">
        <summary className="icon-button" aria-label="Thông báo"><Bell size={19} />{alerts.length > 0 && <i />}</summary>
        <div className="popover-content">
          <strong>Thông báo</strong>
          {alerts.length ? alerts.map((alert) => <button type="button" key={alert.id} onClick={(event) => { closeDetails(event); navigate(alert.page, alert.params) }}>
            <span className="metric-icon amber"><CircleAlert size={16} /></span><span>{alert.text}</span><ArrowRight size={15} />
          </button>) : <p className="muted">Chi nhánh hiện không có cảnh báo.</p>}
        </div>
      </details>
      <div className="topbar-divider" />
      <details className="top-popover profile-popover">
        <summary className="profile-button" aria-label={'Tài khoản ' + user.name}>
          <span className="avatar">{initials(user.name)}</span>
          <span><strong>{user.name}</strong><small>Quản lý</small></span><ChevronDown size={14} />
        </summary>
        <div className="popover-content"><strong>{user.role}</strong>
          <button type="button" onClick={(event) => { closeDetails(event); logout() }}><LogOut size={17} /><span>Đăng xuất</span></button>
        </div>
      </details>
    </div>
  </header>
}

function GlobalSearch({ onClose, data, branchId, navigate, openReceipt }) {
  const [value, setValue] = useState('')
  const search = value.trim()
  const pages = screens.filter((screen) => !search || includes(screen.title + ' ' + screen.keywords, search))
  const products = search ? matchingProducts(data, branchId, search).slice(0, 4) : []
  const orders = search ? data.orders.filter((order) => order.branchId === branchId && includes(order.id + ' ' + order.customer, search)).slice(0, 3) : []
  const action = (callback) => { onClose(); callback() }
  return <Modal title="Tìm kiếm nhanh" description="Tìm trang, sản phẩm, IMEI hoặc hóa đơn của chi nhánh." onClose={onClose}>
    <TextSearch value={value} onChange={setValue} label="Tìm trên PhoneFlow" placeholder="Ví dụ: iPhone, quản lý kho, HD-1044…" />
    {pages.length + products.length + orders.length ? <div className="search-results">
      {pages.map(({ id, icon: Icon, title }) => <button type="button" key={id} onClick={() => action(() => navigate(id))}><Icon size={17} /><span>{title}</span><ArrowRight size={15} /></button>)}
      {products.map((product) => <button type="button" key={product.id} onClick={() => action(() => navigate('san-pham', { product: product.id, q: search }))}><Package size={17} /><span>{product.name}<small>{product.sku}</small></span><ArrowRight size={15} /></button>)}
      {orders.map((order) => <button type="button" key={order.id} onClick={() => action(() => openReceipt(order))}><ShoppingCart size={17} /><span>{order.id}<small>{order.customer}</small></span><ArrowRight size={15} /></button>)}
    </div> : <Empty title="Không có kết quả phù hợp" />}
  </Modal>
}

function App() {
  const [data, setData] = useState(null)
  const [user, setUser] = useState(null)
  const [starting, setStarting] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [branchId, setBranchId] = useState(() => readStorage(() => localStorage, branchKey) || '')
  const activeBranch = useRef(branchId)
  activeBranch.current = branchId
  const [location, setLocation] = useState(getLocation)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  const loadVersion = useRef(0)
  const [retry, setRetry] = useState(0)
  const fullMobile = window.location.pathname === '/mobile'

  function notify(text, tone = 'success') {
    setToast({ text, tone })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4400)
  }
  async function refresh(selected = branchId) {
    const version = ++loadVersion.current
    const payload = await request('/bootstrap', { branchId: selected })
    if (version === loadVersion.current && selected === activeBranch.current) {
      setData(payload)
      setLoadError('')
    }
    return payload
  }
  function applyUser(profile) {
    const allowed = profile.branches
    const selected = allowed.find((b) => b.id === branchId)?.id || allowed.find((b) => b.id === 'q1')?.id || allowed[0]?.id
    if (!selected) throw new Error('Tài khoản chưa được cấp chi nhánh.')
    setUser(profile)
    setBranchId(selected)
    activeBranch.current = selected
    useBranch(selected)
    writeStorage(() => localStorage, branchKey, selected)
    return selected
  }
  useEffect(() => {
    let active = true
    request('/me/permissions').then(async ({ user: profile }) => {
      if (!active) return
      const selected = applyUser(profile)
      await refresh(selected)
    }).catch((error) => {
      if (active && error.status !== 401) setLoadError(error.message)
    }).finally(() => { if (active) setStarting(false) })
    return () => { active = false }
  }, [retry])

  useEffect(() => {
    const onHash = () => { setLocation(getLocation()); setMenuOpen(false); setReceipt(null); window.scrollTo(0, 0) }
    const expired = () => { setUser(null); setData(null); setReceipt(null); setSearchOpen(false) }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('phoneflow:expired', expired)
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('phoneflow:expired', expired) }
  }, [])
  useEffect(() => {
    if (!user || !branchId) return
    let active = true
    useBranch(branchId)
    setData(null)
    refresh(branchId).catch((error) => { if (active) setLoadError(error.message) })
    const onFocus = () => {
      if (document.visibilityState === 'visible') refresh(branchId).catch((error) => { if (active) setLoadError(error.message) })
    }
    const interval = setInterval(onFocus, 20000)
    window.addEventListener('focus', onFocus)
    return () => { active = false; clearInterval(interval); window.removeEventListener('focus', onFocus) }
  }, [user?.id, branchId])

  useEffect(() => {
    const onKey = (event) => {
      if (user && !fullMobile && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]')) {
        event.preventDefault(); setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [user, fullMobile])

  function navigate(id, params = {}) {
    const query = new URLSearchParams(params).toString()
    window.location.hash = '/' + id + (query ? '?' + query : '')
    setMenuOpen(false)
  }
  async function commit(mutate, confirmation) {
    const result = await mutate(data)
    try { await refresh(branchId) } catch (error) { setLoadError('Đã ghi giao dịch. ' + error.message) }
    if (confirmation) notify(confirmation)
    return result
  }
  async function logout() {
    try { await post('/auth/logout', {}) } catch (error) { notify(error.message, 'error'); return }
    resetRequests()
    setUser(null); setData(null); setReceipt(null); setSearchOpen(false); setToast(null)
    navigate('dang-nhap')
  }
  const permissions = user?.branches.find((b) => b.id === branchId)?.permissions || []
  const allowedScreens = screens.filter((screen) => !screen.permission || permissions.includes(screen.permission))
  const screen = allowedScreens.find(({ id }) => id === location.id) ?? allowedScreens[0]
  const Page = screen?.Page

  if (starting) return <main className="connection-state"><Brand /><p>Đang kết nối PhoneFlow…</p></main>
  if (!user && loadError) return <main className="connection-state"><Brand /><p role="alert">{loadError}</p><Button onClick={() => { setLoadError(''); setStarting(true); setRetry(retry + 1) }}>Kết nối lại</Button></main>
  if (!user) return <Login onLogin={async (username, password) => {
    resetRequests()
    const { user: profile } = await post('/auth/login', { username, password })
    const selected = applyUser(profile)
    await refresh(selected)
    const p = profile.branches.find((b) => b.id === selected).permissions
    navigate(fullMobile ? 'mobile' : screens.find((s) => !s.permission || p.includes(s.permission)).id)
  }} />

  const shared = { data, branchId, params: new URLSearchParams(location.query), navigate, commit, notify, openReceipt: setReceipt, user, permissions, refresh, onBranch: (id) => { setBranchId(id); writeStorage(() => localStorage, branchKey, id) } }
  const lowStock = data?.products.filter((product) => stock(data, product.id, branchId).available < 5).length || 0
  const openWarranty = data?.services.filter((ticket) => ticket.type === 'warranty' && ticket.status !== 'done').length || 0
  const alerts = [
    lowStock && permissions.includes('stock') && { id: 'low-stock', text: lowStock + ' SKU có tồn khả dụng dưới 5', page: 'kho' },
    openWarranty && permissions.includes('aftercare') && { id: 'open-warranty', text: openWarranty + ' phiếu bảo hành đang mở', page: 'hau-mai' },
  ].filter(Boolean)
  const body = data ? fullMobile ? <AndroidPreview {...shared} key={user.id + ':' + branchId} standalone logout={logout} /> : <Page {...shared} key={[screen.id, branchId, location.query].join(':')} />
    : <Empty title={loadError || 'Đang tải dữ liệu…'} />
  return <div className={fullMobile ? 'mobile-standalone-shell' : 'app-shell'}>
    {!fullMobile && <Sidebar id={screen.id} branchId={branchId} user={user} screens={allowedScreens}
      setBranch={(value) => { setBranchId(value); writeStorage(() => localStorage, branchKey, value); setReceipt(null) }}
      navigate={navigate} open={menuOpen} close={() => setMenuOpen(false)} />}
    <div className={fullMobile ? '' : 'workspace'}>
      {!fullMobile && <Header user={user} screen={screen} openMenu={() => setMenuOpen(true)} openSearch={() => setSearchOpen(true)} alerts={alerts} navigate={navigate} logout={logout} />}
      <main id="main-content" tabIndex={-1} className={fullMobile ? '' : 'content'}>
        {loadError && data && <p className="form-error" role="alert">{loadError}<Button onClick={() => refresh().catch((e) => setLoadError(e.message))}>Tải lại</Button></p>}
        {body}
      </main>
    </div>
    {searchOpen && data && <GlobalSearch onClose={() => setSearchOpen(false)} data={data} branchId={branchId} navigate={navigate} openReceipt={setReceipt} />}
    {receipt && <Receipt order={receipt} onClose={() => setReceipt(null)} />}
    {toast && <div className={'toast ' + toast.tone} role="status"><CheckCircle2 size={20} /><span>{toast.text}</span><button type="button" className="icon-button" aria-label="Đóng thông báo" onClick={() => setToast(null)}><X size={17} /></button></div>}
  </div>
}

createRoot(document.getElementById('root')).render(<App />)

