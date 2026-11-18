const prefix = '/api/v1'
const intentStorage = 'phoneflow-server-intents-v1'
function restoreIntents() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(intentStorage))
    return { keys: new Map(saved?.keys || []), pending: new Map(saved?.pending || []) }
  } catch { return { keys: new Map(), pending: new Map() } }
}
const { keys, pending } = restoreIntents()
function saveIntents() {
  try { sessionStorage.setItem(intentStorage, JSON.stringify({ keys: [...keys], pending: [...pending] })) }
  catch { /* A running tab still retains request keys in memory. */ }
}
let currentBranch = ''
export function useBranch(id) { currentBranch = id }
export function branch() { return currentBranch }
export function operationKey(action) {
  if (!keys.has(action)) { keys.set(action, crypto.randomUUID()); saveIntents() }
  return keys.get(action)
}
export function finishOperation(action) { keys.delete(action); saveIntents() }
export function resetRequests() { keys.clear(); pending.clear(); saveIntents() }
export async function request(path, { method = 'GET', body, key, branchId = currentBranch, signal } = {}) {
  const identity = [method, path, branchId, JSON.stringify(body)].join('|')
  const headers = {}
  if (branchId) headers['X-Branch-ID'] = branchId
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET' && !path.startsWith('/auth/')) headers['Idempotency-Key'] = key || operationKey(identity)
  let response
  try {
    response = await fetch(prefix + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin', signal })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Mất kết nối máy chủ. Thử lại khi mạng ổn định.')
  }
  const value = response.status === 204 ? null : await response.json()
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('phoneflow:expired'))
    if (response.status < 500) finishOperation(identity)
    const error = new Error(value?.error?.message || 'Yêu cầu chưa hoàn thành.')
    error.status = response.status
    throw error
  }
  finishOperation(identity)
  return value
}
export const post = (path, body, options) => request(path, { method: 'POST', body, ...options })
export async function receipt(branchId, values) {
  const action = JSON.stringify(['receipt', branchId, values])
  const key = operationKey(action)
  const created = await post('/receipts', values, { branchId, key: key + ':create' })
  const result = await post('/receipts/' + created.id + '/confirm', {}, { branchId, key: key + ':confirm' })
  finishOperation(action)
  return result
}
export async function sale(branchId, lines, customer, method, failure) {
  const action = JSON.stringify(['sale', branchId, lines, customer])
  const key = operationKey(action)
  let created = pending.get(action)
  if (!created) {
    created = await post('/sales', { lines, customer }, { branchId, key: key + ':create' })
    pending.set(action, created)
    saveIntents()
  }
  const result = await post('/sales/' + created.id + '/confirm', { method, result: failure ? 'failure' : 'success' }, { branchId })
  pending.delete(action)
  finishOperation(action)
  return result
}

