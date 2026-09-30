import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * ⚠️ 一次性 Migration Runner（本地測試用）
 *
 * POST /api/_internal/run-migration
 * Body: { secret: string, name: 'pricing_and_locations' | 'order_number_advisory_lock' | 'grab_token_nullable' }
 *
 * 透過 service role 在 Supabase DB 執行指定 migration 的 SQL。
 * 受 INTERNAL_MIGRATION_SECRET 環境變數保護（必須設定）。
 *
 * 注意：這個 endpoint 只在開發環境下存在；正式環境部署前移除。
 */

export async function POST(request: NextRequest) {
  // 生產環境保護
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_INTERNAL_MIGRATION) {
    return NextResponse.json({ error: '已停用' }, { status: 404 })
  }

  const secret = process.env.INTERNAL_MIGRATION_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'INTERNAL_MIGRATION_SECRET 未設定' }, { status: 500 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '需要 JSON body' }, { status: 400 })
  }

  if (body?.secret !== secret) {
    return NextResponse.json({ error: 'secret 不正確' }, { status: 401 })
  }

  const here = dirname(fileURLToPath(import.meta.url))
  const repoRoot = join(here, '..', '..', '..', '..') // app/api/_internal → repo root
  const migrationMap: Record<string, string> = {
    pricing_and_locations: 'supabase/migrations/20260930_pricing_and_locations.sql',
    order_number_advisory_lock: 'supabase/migrations/20260930_order_number_advisory_lock.sql',
    grab_token_nullable: 'supabase/migrations/20260930_grab_token_nullable.sql',
    seed: 'supabase/seed_locations_and_pricing.sql',
  }

  const filename = migrationMap[body?.name]
  if (!filename) {
    return NextResponse.json({ error: '未知的 migration name，可用：' + Object.keys(migrationMap).join(', ') }, { status: 400 })
  }

  const sqlPath = join(repoRoot, filename)
  let sql: string
  try {
    sql = readFileSync(sqlPath, 'utf8')
  } catch (e: any) {
    return NextResponse.json({ error: `讀取 ${filename} 失敗: ${e.message}` }, { status: 500 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env 缺失' }, { status: 500 })
  }

  // 用 pg 套件直接 DDL
  let pg
  try {
    pg = await import('pg')
  } catch {
    return NextResponse.json({ error: '需要安裝 pg 套件：npm i pg --no-save' }, { status: 500 })
  }

  // 拿 connection string（透過 management API 或 pgBouncer session mode）
  // 此端點只為本地/開發使用，會失敗時回報明確錯誤
  const projectRef = supabaseUrl.split('//')[1].split('.')[0]
  const managementRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/database/pooler`, {
    headers: { Authorization: `Bearer ${serviceKey}` },
  })
  if (!managementRes.ok) {
    return NextResponse.json({
      error: `Management API 取 connection string 失敗（${managementRes.status}）。SUPABASE_SERVICE_ROLE_KEY 不能用於 Management API。請設定 SUPABASE_DB_URL 環境變數（從 Supabase Dashboard → Connect → Session pooler 取得）。`,
    }, { status: 500 })
  }

  const poolerArr = await managementRes.json()
  const primary = poolerArr.find((p: any) => p.database_type === 'PRIMARY')
  if (!primary) {
    return NextResponse.json({ error: '找不到 PRIMARY pooler entry' }, { status: 500 })
  }

  const client = new pg.Client({
    connectionString: primary.connection_string || primary.connectionString,
    ssl: { rejectUnauthorized: false },
  })
  try {
    await client.connect()
    await client.query(sql)
    return NextResponse.json({ success: true, file: filename, length: sql.length })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, detail: e.detail, hint: e.hint }, { status: 500 })
  } finally {
    await client.end()
  }
}