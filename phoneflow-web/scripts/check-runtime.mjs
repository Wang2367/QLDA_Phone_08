import { writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { query, close } from '../server/db.js'
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001/api/v1'
const login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'quang',password:process.env.SEED_PASSWORD || 'PhoneFlow@123'})})
if(!login.ok) throw new Error('Login check failed')
const cookie=login.headers.get('set-cookie').split(';')[0]
const headers={Cookie:cookie,'X-Branch-ID':'q1'}
const [record] = await query("SELECT d.id,d.serial,d.status,i.imei FROM dbo.devices d JOIN dbo.device_imeis i ON i.deviceId=d.id WHERE d.serial='G5-UI-001' ORDER BY i.imei")
const [server] = await query("SELECT CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) instance,CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(60)) version")
const [summary] = await query('SELECT (SELECT COUNT(*) FROM dbo.sales_orders) sales,(SELECT COUNT(*) FROM dbo.devices) devices,(SELECT COUNT(*) FROM dbo.audit_events) auditEvents,(SELECT COUNT(*) FROM dbo.stock_counts) stockCounts')
const found = await fetch(base+'/lookup?q='+record.imei,{headers})
if(!found.ok || (await found.json()).device.id!==record.id) throw new Error('Persisted lookup check failed')
const durations=await Promise.all(Array.from({length:30},async()=>{
 const start=performance.now()
 const result=await fetch(base+'/lookup?q='+record.imei,{headers})
 if(!result.ok) throw new Error('Concurrent lookup failed: '+result.status)
 await result.json()
 return Math.round(performance.now()-start)
}))
durations.sort((a,b)=>a-b)
const evidence={date:new Date().toISOString(),node:process.version,platform:process.platform,sqlServer:server,
 persistedDevice:record,summary,lookup:{concurrentRequests:30,successful:30,p95Ms:durations[Math.ceil(.95*durations.length)-1],maxMs:durations.at(-1),timingsMs:durations},
 notes:'Kiểm tra kỹ thuật trên localhost, cùng một máy chạy API và SQL Server. Nhóm 6 xác nhận cấu hình và thử tải chính thức.'}
await writeFile(new URL('../docs/runtime-evidence.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n')
console.log(JSON.stringify(evidence,null,2))
await fetch(base+'/auth/logout',{method:'POST',headers})
await close()

