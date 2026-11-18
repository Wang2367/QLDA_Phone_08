import { useState } from 'react'
import { Button, ActionForm, Modal, Field, ProductName, Status, Empty } from './components.jsx'
import { getProduct, fullDay, number } from './data.js'
import { post } from './api.js'

export default function Counts({ data, commit, permissions }) {
  const [selected, setSelected] = useState(null)
  const item = data.counts.find((c) => c.id === selected)
  const labels = { draft: ['Bản nháp', 'neutral'], submitted: ['Chờ duyệt', 'amber'], approved: ['Đã điều chỉnh', 'green'] }
  return <>
    {data.counts.length ? <div className="table-scroll"><table>
      <thead><tr><th>Mã phiếu</th><th>Ngày tạo</th><th>Số SKU</th><th>Trạng thái</th><th>Người tạo</th></tr></thead>
      <tbody>{data.counts.map((c) => <tr key={c.id}><td><button className="id-link" onClick={() => setSelected(c.id)}>{c.id}</button></td>
        <td>{fullDay.format(new Date(c.date))}</td><td>{c.rows.length}</td><td><Status value={labels[c.status]} /></td><td>{c.createdBy}</td></tr>)}</tbody>
    </table></div> : <Empty title="Chưa có phiếu kiểm kê">Tạo phiếu tại Mobile Web hoặc mục Mobile.</Empty>}
    {item && <Modal title={'Kiểm kê ' + item.id} onClose={() => setSelected(null)} wide>
      <Status value={labels[item.status]} />
      <div className="table-scroll"><table><thead><tr><th>Sản phẩm</th><th>Dự kiến</th><th>Đếm</th><th>Lệch</th></tr></thead>
        <tbody>{item.rows.map((r) => <tr key={r.id}><td><ProductName product={getProduct(data, r.productId)} /></td><td>{number(r.expected)}</td><td>{number(r.counted)}</td><td>{number(r.counted - r.expected)}</td></tr>)}</tbody>
      </table></div>
      {item.status === 'draft' && <ActionForm actionLabel="Gửi duyệt" onClose={() => setSelected(null)} onSubmit={async () => {
        await commit(() => post('/counts/' + item.id + '/submit', {}), 'Đã gửi phiếu kiểm kê.')
      }} />}
      {item.status === 'submitted' && permissions.includes('approve') && <ActionForm actionLabel="Duyệt điều chỉnh tồn" onClose={() => setSelected(null)} onSubmit={async (f) => {
        await commit(() => post('/counts/' + item.id + '/approve', { note: f.get('note') }), 'Đã phê duyệt điều chỉnh.')
      }}>
        <Field label="Kết luận kiểm kê"><textarea name="note" rows={2} required placeholder="Xác nhận số lượng và lý do điều chỉnh…" /></Field>
        <p className="muted small">Thiết bị thiếu khi đối chiếu chuyển sang cách ly để xác minh.</p>
      </ActionForm>}
    </Modal>}
  </>
}

