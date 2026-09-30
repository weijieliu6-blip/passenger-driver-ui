#!/usr/bin/env node
// scripts/run-migration.mjs
// 直接用 pg + Supabase pooler 跑 migration SQL
// 用法: node scripts/run-migration.mjs <name>
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const repoRoot = process.cwd()
const envFile = join(repoRoot, '.env.local')
const env = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const [k, ...r] = l.split('=')
      return [k.trim(), r.join('=').trim()]
    })
)

const name = process.argv[2]
if (!name) {
  console.error('用法: node scripts/run-migration.mjs <name>')
  console.error('可用：pricing_and_locations | order_number_advisory_lock | grab_token_nullable | seed')
  process.exit(1)
}

const migrationMap = {
  pricing_and_locations: 'supabase/migrations/20260930_pricing_and_locations.sql',
  order_number_advisory_lock: 'supabase/migrations/20260930_order_number_advisory_lock.sql',
  grab_token_nullable: 'supabase/migrations/20260930_grab_token_nullable.sql',
  seed: 'supabase/seed_locations_and_pricing.sql',
  order_hall: 'supabase/migrations/20260930_order_hall.sql',
  test_helper: 'supabase/migrations/20260930_test_helper_create_user.sql',
}

const filename = migrationMap[name]
if (!filename) {
  console.error('未知 migration:', name)
  process.exit(1)
}

const sqlPath = join(repoRoot, filename)
if (!existsSync(sqlPath)) {
  console.error('檔案不存在:', sqlPath)
  process.exit(1)
}

const sql = readFileSync(sqlPath, 'utf8')

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
const projectRef = supabaseUrl.split('//')[1].split('.')[0]

console.log(`[run-migration] target=${projectRef}`)
console.log(`[run-migration] file=${filename} (${sql.length} chars)`)

// 1) 取 connection string (Service role 不能用 management API，要從 dashboard 拿)
// 退而求其次：直接用 SUPABASE_DB_URL 環境變數
const dbUrl = env.SUPABASE_DB_URL
if (!dbUrl) {
  console.error('\n❌ SUPABASE_DB_URL 未設定')
  console.error('請到 Supabase Dashboard → Project Settings → Database → Connection string → Session pooler 複製')
  console.error('格式: postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres')
  console.error('然後加到 .env.local: SUPABASE_DB_URL=postgres://...')
  process.exit(1)
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  console.log('[run-migration] ✅ 已連線')
  await client.query(sql)
  console.log(`[run-migration] ✅ ${filename} 執行成功`)
} catch (e) {
  console.error('[run-migration] ❌ 失敗:', e.message)
  if (e.detail) console.error('detail:', e.detail)
  if (e.hint) console.error('hint:', e.hint)
  process.exit(1)
} finally {
  await client.end()
}