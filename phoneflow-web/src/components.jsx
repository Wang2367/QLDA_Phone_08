import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownLeft, ArrowUpRight, Box, Cable, Check, ChevronDown, Headphones,
  PackageOpen, Search, Shield, Smartphone, X, Zap,
} from 'lucide-react'
import { number } from './data.js'

export function Button({ children, icon: Icon, variant = 'secondary', className = '', type = 'button', ...props }) {
  return <button type={type} className={'button ' + variant + ' ' + className} {...props}>
    {Icon && <Icon size={17} aria-hidden="true" />}{children}
  </button>
}

export function Brand({ light = false }) {
  return <div className={'brand' + (light ? ' light' : '')}>
    <span className="brand-mark"><Smartphone size={20} strokeWidth={2.25} aria-hidden="true" /></span>
    <span>Phone<span>Flow</span></span>
  </div>
}

export function PageHeading({ title, description, children }) {
  return <div className="page-heading">
    <div><h1>{title}</h1><p>{description}</p></div>
    {children && <div className="heading-actions">{children}</div>}
  </div>
}

export function PanelHeading({ title, description, children }) {
  return <div className="panel-heading">
    <div><h2>{title}</h2>{description && <p>{description}</p>}</div>{children}
  </div>
}

export function TextSearch({ value, onChange, label, placeholder = label }) {
  return <div className="search-field">
    <Search size={17} aria-hidden="true" />
    <input type="search" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
  </div>
}

export function Select({ label, children, icon: Icon, className = '', ...props }) {
  return <span className={'select-wrap ' + className}>
    {Icon && <Icon size={16} aria-hidden="true" />}
    <select aria-label={label} {...props}>{children}</select>
    <ChevronDown size={14} className="select-arrow" aria-hidden="true" />
  </span>
}

export function Field({ label, children, help }) {
  return <label className="form-field"><span>{label}</span>{children}{help && <small>{help}</small>}</label>
}

export function Tabs({ value, onChange, items, label }) {
  return <div className="tabs" role="group" aria-label={label}>
    {items.map(({ id, name, count }) => <button type="button" key={id} className={value === id ? 'active' : ''}
      onClick={() => onChange(id)} aria-pressed={value === id}>
      {name}{count !== undefined && <span>{number(count)}</span>}
    </button>)}
  </div>
}

export function Status({ value }) {
  const [label, color] = value ?? ['—', 'neutral']
  return <span className={'status ' + color}><span />{label}</span>
}

export function ProductIcon({ product, size = 20 }) {
  const Icon = product?.category === 'Điện thoại' ? Smartphone :
    product?.name.startsWith('AirPods') ? Headphones :
      product?.name.includes('Cáp') ? Cable :
        product?.name.includes('Sạc') ? Zap :
          product?.name.includes('Kính') ? Shield : Box
  return <span className={'product-icon ' + (product?.tone ?? 'slate')}><Icon size={size} strokeWidth={1.75} aria-hidden="true" /></span>
}

export function ProductName({ product, subtitle }) {
  return <div className="product-name"><ProductIcon product={product} /><div>
    <strong>{product?.name ?? 'Sản phẩm'}</strong><small>{subtitle ?? product?.sku}</small>
  </div></div>
}

export function Delta({ value, label }) {
  if (value === null) return <span className="metric-context">{label}</span>
  const trendUp = value >= 0
  const Icon = trendUp ? ArrowUpRight : ArrowDownLeft
  return <span className={'metric-delta ' + (trendUp ? 'up' : 'down')}>
    <Icon size={14} aria-hidden="true" /> {value > 0 ? '+' : ''}{number(value)}% <span>{label}</span>
  </span>
}

export function Empty({ title, children }) {
  return <div className="empty-state"><PackageOpen size={28} strokeWidth={1.5} aria-hidden="true" /><strong>{title}</strong>{children && <p>{children}</p>}</div>
}

export function Modal({ title, description, children, onClose, wide = false }) {
  const dialogRef = useRef(null)
  const titleRef = useRef('dlg-' + Math.random().toString(36).slice(2))

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow; dialog.close() }
  }, [])

  return <dialog ref={dialogRef} aria-labelledby={titleRef.current} className={'modal' + (wide ? ' wide' : '')}
    onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => {
      if (event.target === event.currentTarget) {
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
      }
    }}>
    <div className="modal-header">
      <div><h2 id={titleRef.current}>{title}</h2>{description && <p>{description}</p>}</div>
      <button className="icon-button" type="button" aria-label="Đóng" onClick={onClose}><X size={19} /></button>
    </div>
    <div className="modal-content">{children}</div>
  </dialog>
}

export function ActionForm({ children, actionLabel, onSubmit, onClose, disabled = false }) {
  const [error, setError] = useState('')
  return <form className="action-form" onSubmit={(event) => {
    event.preventDefault()
    setError('')
    try { onSubmit(new FormData(event.currentTarget)) } catch (issue) { setError(issue.message) }
  }}>
    {children}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><Button onClick={onClose}>Hủy</Button><Button type="submit" variant="primary" icon={Check} disabled={disabled}>{actionLabel}</Button></div>
  </form>
}

