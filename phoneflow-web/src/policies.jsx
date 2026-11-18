import { useEffect, useState } from 'react'
import { Modal, ActionForm, Field, Select, ProductName } from './components.jsx'
import { request, post } from './api.js'
import { fullDay, getProduct } from './data.js'

export default function Policies({ data, commit, onClose }) {
  const [policies, setPolicies] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    request('/warranty/policies').then(setPolicies).catch((e) => setError(e.message))
  }, [data])
  return <Modal title="Chính sách bảo hành" description="Mỗi chính sách mới có ngày hiệu lực riêng, giữ chính sách của các dòng bán cũ." onClose={onClose} wide>
    <ActionForm actionLabel="Thêm phiên bản" onClose={onClose} onSubmit={async (f) => {
      await commit(() => post('/warranty/policies', { productId: f.get('productId'), months: Number(f.get('months')),
        coverage: f.get('coverage'), exclusions: f.get('exclusions'), effectiveAt: new Date(f.get('effectiveAt')).toISOString() }), 'Đã lưu chính sách bảo hành.')
    }}>
      <Field label="SKU áp dụng"><Select label="SKU áp dụng" name="productId" required>{data.products.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
      <div className="form-grid"><Field label="Thời hạn (tháng)"><input name="months" type="number" min="1" max="120" defaultValue="12" required /></Field>
        <Field label="Có hiệu lực từ"><input name="effectiveAt" type="datetime-local" required /></Field></div>
      <Field label="Điều kiện áp dụng"><textarea name="coverage" maxLength={300} required rows={2} /></Field>
      <Field label="Trường hợp loại trừ"><textarea name="exclusions" maxLength={300} required rows={2} /></Field>
    </ActionForm>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="table-scroll modal-table"><table><thead><tr><th>SKU</th><th>Thời hạn</th><th>Hiệu lực</th></tr></thead>
      <tbody>{policies.map((p) => <tr key={p.id}><td><ProductName product={getProduct(data,p.productId)} /></td><td>{p.months} tháng</td><td>{fullDay.format(new Date(p.effectiveAt))}</td></tr>)}</tbody>
    </table></div>
  </Modal>
}

