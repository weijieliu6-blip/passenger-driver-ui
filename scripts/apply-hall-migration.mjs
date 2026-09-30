// scripts/apply-hall-migration.mjs
// 透過 Supabase Management API 拿 pooler config + 自動安裝 pg + 執行 SQL
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim()] })
)

const projectRef = env.NEXT_PUBLIC_SUPABASE_URL.split('//')[1].split('.')[0]
console.log('Project ref:', projectRef)

const poolerRes = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/config/database/pooler`,
  { headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
)
const poolerArr = await poolerRes.json()
console.log('poolerArr keys:', Object.keys(poolerArr || {}))
const poolerList = poolerArr.poolers || poolerArr || []
const primary = Array.isArray(poolerList) ? poolerList.find(p => p.database_type === 'PRIMARY') : null
if (!primary) { console.error('No PRIMARY pooler:', JSON.stringify(poolerArr).slice(0, 500)); process.exit(1) }
const connStr = primary.connection_string || primary.connectionString
console.log('Host:', primary.db_host)

let pg
try { pg = (await import('pg')) }
catch {
  const { execSync } = await import('node:child_process')
  execSync('npm install pg --no-save', { cwd: '.', stdio: 'inherit' })
  pg = await import('pg')
}

const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } })
await client.connect()
console.log('Connected.')

const files = [
  'supabase/migrations/20260930_order_hall.sql',
  'supabase/migrations/20260930_test_helper_create_user.sql',
]
for (const f of files) {
  const sql = readFileSync(f, 'utf8')
  console.log(`>>> ${f} (${sql.length} chars)`)
  try {
    await client.query(sql)
    console.log(`✅ OK`)
  } catch (e) {
    console.error(`❌ ${f}:`, e.message.slice(0, 500))
    process.exit(1)
  }
}
await client.end()
console.log('All migrations applied.')