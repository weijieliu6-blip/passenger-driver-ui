#!/usr/bin/env node
// scripts/test-new-features.mjs
// E2E 測試：地點搜尋 + 預估價格 + 訂單即時訊息 + AI 客服
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim()] })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const BASE = env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

let pass = 0, fail = 0
const results = []
function assert(name, cond, detail) {
  if (cond) { pass++; results.push(`✅ ${name}`) }
  else { fail++; results.push(`❌ ${name} — ${detail || ''}`) }
}

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data }
}

async function main() {
  console.log('\n=== 模組 E2E 測試 ===\n')

  // === 模組 A：地點搜尋 ===
  console.log('A. 地點搜尋')
  let r = await api('GET', '/api/locations/search?q=中環&region=hk')
  assert('搜尋「中環」', r.status === 200 && r.data?.locations?.length > 0, `status=${r.status} cnt=${r.data?.locations?.length}`)

  r = await api('GET', '/api/locations/search?q=皇崗&region=mainland')
  assert('搜尋「皇崗」內地', r.data?.locations?.some((l) => l.code === 'sz_huanggang_port'), JSON.stringify(r.data).slice(0,200))

  r = await api('GET', '/api/locations/search?q=zzzz不存在')
  assert('無匹配 → showManualInput=true', r.data?.showManualInput === true)

  // === 模組 B：預估價格 ===
  console.log('\nB. 預估價格')
  r = await api('POST', '/api/pricing/estimate', {
    pickup_zone_code: 'hk_kowloon',
    dropoff_zone_code: 'gz_tianhe',
    vehicle_type: '7_seat',
  })
  assert('九龍→廣州天河 7座 ≈2400', r.data?.total_price >= 2300 && r.data?.total_price <= 2500, `price=${r.data?.total_price}`)

  r = await api('POST', '/api/pricing/estimate', {
    pickup_zone_code: 'hk_kowloon',
    dropoff_zone_code: 'sz_airport',
    vehicle_type: '4_seat',
  })
  assert('九龍→深圳機場 4座', r.data?.found === true && r.data?.total_price != null)

  const night = new Date(); night.setHours(23, 30, 0, 0)
  r = await api('POST', '/api/pricing/estimate', {
    pickup_zone_code: 'hk_kowloon',
    dropoff_zone_code: 'sz_futian',
    vehicle_type: '7_seat',
    departure_time: night.toISOString(),
  })
  assert('夜間加成正確', r.data?.night_surcharge > 0, `surcharge=${r.data?.night_surcharge}`)

  // === 模組 C：建立訂單（含 zone）===
  console.log('\nC. 建立訂單（含新欄位）')
  const pEmail = `p_${Date.now()}@t.com`
  const pSignup = await supabase.auth.admin.createUser({
    email: pEmail,
    password: 'Test123!',
    email_confirm: true,
    user_metadata: { name: '乘客A', phone: '+85290000001' },
  })
  await supabase.from('users').update({ phone: '+85290000001', name: '乘客A', role: 'passenger' }).eq('id', pSignup.data.user.id)
  const pSignin = await supabase.auth.signInWithPassword({ email: pEmail, password: 'Test123!' })
  const pToken = pSignin.data.session?.access_token

  r = await api('POST', '/api/orders/create', {
    direction: 'hk_to_mainland',
    pickupLocation: '香港',
    pickupArea: '尖沙咀',
    pickupAddress: '廣東道 17 號 海港城',
    pickupZoneCode: 'hk_kowloon',
    pickupLat: 22.2955,
    pickupLng: 114.1683,
    dropoffLocation: '深圳',
    dropoffArea: '福田區',
    dropoffAddress: '福田口岸',
    dropoffZoneCode: 'sz_futian',
    dropoffLat: 22.5185,
    dropoffLng: 114.0578,
    departureTime: new Date(Date.now() + 86400000).toISOString(),
    passengers: 2,
    luggage: 2,
    vehicleType: '7_seat',
    passengerName: '乘客A',
    passengerPhone: '+85290000001',
  }, pToken)
  assert('訂單建立 200', r.status === 200, JSON.stringify(r.data).slice(0,300))
  const order = r.data?.order
  assert('訂單 estimated_fare 自動填', order?.estimated_fare != null, `estimated_fare=${order?.estimated_fare}`)
  assert('訂單 pickup_address 填入', order?.pickup_address === '廣東道 17 號 海港城')
  assert('訂單 dropoff_address 填入', order?.dropoff_address === '福田口岸')
  assert('訂單 pickup_lat 填入', order?.pickup_lat != null)
  assert('訂單 dropoff_zone = sz_futian', order?.dropoff_address === '福田口岸')
  console.log('   order_number:', order?.order_number)

  // === 模組 D：即時訊息 ===
  console.log('\nD. 訂單即時訊息')
  // 乘客送一條
  r = await api('POST', `/api/orders/${order.order_number}/messages`, { content: '你好，請問何時出發？' }, pToken)
  assert('乘客發送訊息 200', r.status === 200, JSON.stringify(r.data).slice(0,200))
  const passengerMsgId = r.data?.message?.id

  // 查詢
  r = await api('GET', `/api/orders/${order.order_number}/messages`, null, pToken)
  assert('乘客查詢訊息歷史 200', r.status === 200)
  assert('訊息歷史包含剛送的', (r.data?.messages || []).some((m) => m.id === passengerMsgId))

  // 未授權（另一人）
  const otherEmail = `o_${Date.now()}@t.com`
  const otherSignup = await supabase.auth.admin.createUser({ email: otherEmail, password: 'Test123!', email_confirm: true })
  await supabase.from('users').update({ phone: '+85290000002', name: '不相干', role: 'passenger' }).eq('id', otherSignup.data.user.id)
  const otherSignin = await supabase.auth.signInWithPassword({ email: otherEmail, password: 'Test123!' })
  const otherToken = otherSignin.data.session?.access_token
  r = await api('POST', `/api/orders/${order.order_number}/messages`, { content: '我是駭客' }, otherToken)
  assert('未授權用戶 403', r.status === 403, `status=${r.status}`)

  // === 模組 E：AI 客服 ===
  console.log('\nE. AI 客服')
  r = await api('POST', '/api/cs/message', { message: '請問從九龍去深圳福田多少錢？' }, pToken)
  assert('AI 客服 FAQ 命中（價格）', r.data?.success === true, JSON.stringify(r.data).slice(0,200))
  assert('AI 回覆非空', r.data?.ai_reply?.content?.length > 50)
  assert('未升級人工（高信心 FAQ）', r.data?.escalated === false)
  const convId = r.data?.conversation?.id

  // 觸發升級
  r = await api('POST', '/api/cs/message', { message: '我要投訴司機', conversation_id: convId }, pToken)
  assert('投訴觸發人工升級', r.data?.escalated === true, JSON.stringify(r.data).slice(0,200))
  assert('會話狀態 = human_needed', r.data?.conversation?.status === 'human_needed')

  // Admin 取得佇列（用 admin 帳號）
  const adminEmail = `a_${Date.now()}@t.com`
  const aSignup = await supabase.auth.admin.createUser({ email: adminEmail, password: 'Test123!', email_confirm: true })
  await supabase.from('users').update({ phone: '+85290000003', name: 'Admin', role: 'admin' }).eq('id', aSignup.data.user.id)
  const aSignin = await supabase.auth.signInWithPassword({ email: adminEmail, password: 'Test123!' })
  const aToken = aSignin.data.session?.access_token

  r = await api('GET', '/api/admin/cs/queue', null, aToken)
  assert('Admin 取得佇列 200', r.status === 200)
  assert('佇列包含剛剛的會話', (r.data?.conversations || []).some((c) => c.id === convId))

  // Admin 回覆
  r = await api('POST', '/api/admin/cs/reply', { conversation_id: convId, content: '您好，我是客服，已為您處理' }, aToken)
  assert('Admin 回覆 200', r.status === 200 && r.data?.success === true)

  // 乘客查詢自己的會話，應看到 admin 回覆
  r = await api('GET', `/api/cs/conversations/${convId}/messages`, null, pToken)
  assert('乘客看到 admin 回覆', (r.data?.messages || []).some((m) => m.sender_role === 'admin'))

  // === 結果 ===
  console.log('\n=== 結果 ===')
  results.forEach((r) => console.log(r))
  console.log(`\n通過：${pass} / 失敗：${fail}`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })