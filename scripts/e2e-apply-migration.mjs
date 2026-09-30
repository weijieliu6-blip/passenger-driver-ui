// 自動套用 20260930_grab_token_nullable migration
// 透過 Supabase Management API 拿 pooler config，再用 pg 連接執行 DDL
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim()] })
)

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env'); process.exit(1)
}

const projectRef = env.NEXT_PUBLIC_SUPABASE_URL.split('//')[1].split('.')[0]
console.log('Project ref:', projectRef)

// 拿 connection string
const poolerRes = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/config/database/pooler`,
  { headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
)
if (!poolerRes.ok) {
  console.error('Failed to fetch pooler config:', poolerRes.status, await poolerRes.text())
  process.exit(1)
}
const poolerArr = await poolerRes.json()
const primary = poolerArr.find(p => p.database_type === 'PRIMARY')
if (!primary) {
  console.error('No PRIMARY pooler entry')
  process.exit(1)
}
console.log('Primary pooler host:', primary.db_host, 'port:', primary.db_port, 'user:', primary.db_user)

const connStr = primary.connection_string || primary.connectionString
// connection_string 含密碼；直接連
console.log('Connecting...')

// 安裝 pg 動態 import
let pg
try {
  pg = (await import('pg'))
} catch (e) {
  console.error('pg 套件未安裝，正在安裝…')
  const { execSync } = await import('node:child_process')
  execSync('npm install pg --no-save', { cwd: '.', stdio: 'inherit' })
  pg = await import('pg')
}

const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } })
await client.connect()
console.log('Connected.')

const sql = readFileSync('supabase/migrations/20260930_grab_token_nullable.sql', 'utf8')
try {
  await client.query(sql)
  console.log('✅ Migration applied.')
} catch (e) {
  console.error('❌ Migration failed:', e.message)
  process.exit(1)
}
await client.end()