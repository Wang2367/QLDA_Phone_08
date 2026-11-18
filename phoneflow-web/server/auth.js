import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { query } from './db.js'

export class HttpError extends Error {
  constructor(status, message, code = 'BUSINESS_ERROR') { super(message); this.status = status; this.code = code }
}
export function requireThat(condition, message, status = 409) {
  if (!condition) throw new HttpError(status, message)
}
export const digest = (text) => createHash('sha256').update(text).digest('hex')
export function passwordHash(password) {
  const salt = randomBytes(16).toString('hex')
  return salt + ':' + scryptSync(password, salt, 64).toString('hex')
}
export function passwordMatches(password, encoded) {
  const [salt, hash] = encoded.split(':')
  const stored = Buffer.from(hash, 'hex')
  const received = scryptSync(password, salt, 64)
  return stored.length === received.length && timingSafeEqual(stored, received)
}
const rolePermissions = {
  admin: ['catalog', 'stock', 'sale', 'aftercare', 'approve', 'reports', 'audit'],
  manager: ['stock', 'sale', 'aftercare', 'approve', 'reports', 'audit'],
  warehouse: ['stock'],
  cashier: ['sale'],
  aftercare: ['aftercare'],
}
export async function profile(userId, tx) {
  const [user] = await query('SELECT id,username,name FROM dbo.users WHERE id=@id AND active=1', { id: userId }, tx)
  if (!user) return null
  user.branches = await query('SELECT b.*,r.roleId FROM dbo.user_branch_roles r JOIN dbo.branches b ON b.id=r.branchId WHERE r.userId=@id', { id: userId }, tx)
  const grouped = new Map()
  for (const item of user.branches) {
    const entry = grouped.get(item.id) ?? { id: item.id, name: item.name, address: item.address, roles: [], permissions: [] }
    entry.roles.push(item.roleId)
    entry.permissions = [...new Set([...entry.permissions, ...(rolePermissions[item.roleId] ?? [])])]
    grouped.set(item.id, entry)
  }
  user.branches = [...grouped.values()]
  user.role = user.branches.some((b) => b.roles.includes('admin')) ? 'Quản trị hệ thống' : 'Nhân viên cửa hàng'
  return user
}
export function authorize(user, branchId, permission) {
  const branch = user.branches.find((b) => b.id === branchId)
  requireThat(branch && (!permission || branch.permissions.includes(permission)), 'Bạn không có quyền thực hiện tại chi nhánh này.', 403)
  return branch
}
export function cookieToken(req) {
  return req.headers.cookie?.split(';').map((s) => s.trim()).find((s) => s.startsWith('phoneflow_sid='))?.slice(14)
}
export async function authenticate(req, res, next) {
  try {
    const token = cookieToken(req)
    requireThat(token, 'Vui lòng đăng nhập.', 401)
    const [session] = await query('SELECT userId FROM dbo.sessions WHERE tokenHash=@hash AND expiresAt>SYSUTCDATETIME()', { hash: digest(token) })
    req.user = session && await profile(session.userId)
    requireThat(req.user, 'Phiên đăng nhập đã hết hạn.', 401)
    next()
  } catch (error) { next(error) }
}
export const sessionToken = () => randomBytes(32).toString('hex')

