import sql from 'mssql/msnodesqlv8.js'
import 'dotenv/config'

export const databaseName = process.env.DB_NAME || 'PhoneFlow'
if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(databaseName)) throw new Error('DB_NAME không hợp lệ.')
export const connection = (database = databaseName) => ({
  connectionString: process.env.DB_CONNECTION_STRING ||
    'Driver={ODBC Driver 18 for SQL Server};Server=' + (process.env.DB_SERVER || 'localhost\\SQLEXPRESS') +
    ';Database=' + database + ';Trusted_Connection=yes;Encrypt=yes;TrustServerCertificate=yes;',
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  options: { abortTransactionOnError: true, useUTC: true },
  requestTimeout: 20000,
})
let pool
export async function connect() {
  pool ??= await new sql.ConnectionPool(connection()).connect()
  return pool
}
export async function query(text, values = {}, transaction = null) {
  const request = new sql.Request(transaction || await connect())
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'boolean') request.input(key, sql.Bit, value)
    else if (typeof value === 'number') request.input(key, sql.Decimal(19, 4), value)
    else if (value instanceof Date) request.input(key, sql.DateTime2, value)
    else request.input(key, sql.NVarChar(sql.MAX), value ?? null)
  }
  return (await request.query(text)).recordset ?? []
}
export async function insert(table, values, tx) {
  const keys = Object.keys(values)
  await query('INSERT dbo.[' + table + '] (' + keys.map((key) => '[' + key + ']').join(',') +
    ') VALUES (' + keys.map((key) => '@' + key).join(',') + ')', values, tx)
}
export async function transaction(callback) {
  const tx = new sql.Transaction(await connect())
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)
  try {
    await query("SET XACT_ABORT ON; DECLARE @result int; EXEC @result=sp_getapplock @Resource=N'PhoneFlow-ledger',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000; IF @result<0 THROW 51000, N'Giao dịch bận, thử lại.', 1;", {}, tx)
    const result = await callback(tx)
    await tx.commit()
    return result
  } catch (error) {
    try { await tx.rollback() } catch { /* SQL Server may already have rolled back. */ }
    throw error
  }
}
export async function close() {
  if (pool) { await pool.close(); pool = null }
}
export { sql }

