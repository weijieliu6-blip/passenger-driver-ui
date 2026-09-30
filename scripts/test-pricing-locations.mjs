#!/usr/bin/env node
// scripts/test-pricing-locations.mjs
// E2E 測試：地點搜尋 + 預估價格 + 訂單建立
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim()] })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const BASE = 'http://localhost:3000'  // 強制打 dev server（NEXT_PUBLIC_SITE_URL 是 production，新路由還沒 deploy）

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

// 用 cookie 呼叫（supabase auth cookie 格式，給 parseAuthToken 用）
async function apiWithCookie(method, path, body, cookieHeader) {
  const headers = { 'Content-Type': 'application/json', 'Cookie': cookieHeader }
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data }
}

async function main() {
  console.log('\n=== 模組：地點搜尋 + 預估價格 + 訂單建立 ===\n')

  // 1) 地點搜尋（中文）
  let r = await api('GET', '/api/locations/search?q=中環&region=hk')
  assert('GET /api/locations/search?q=中環&region=hk → 200', r.status === 200, `status=${r.status}`)
  assert('回傳至少 1 個地點', Array.isArray(r.data?.locations) && r.data.locations.length > 0, JSON.stringify(r.data).slice(0,200))

  // 2) 地點搜尋（英文）
  r = await api('GET', '/api/locations/search?q=Airport')
  assert('GET /api/locations/search?q=Airport → 200', r.status === 200)
  const airportHits = (r.data?.locations || []).filter(l => /airport/i.test(l.name_en || ''))
  assert('英文搜尋包含 Airport 結果', airportHits.length > 0, JSON.stringify(r.data).slice(0,200))

  // 3) 空字串 → 熱門
  r = await api('GET', '/api/locations/search?q=')
  assert('GET /api/locations/search?q=（空）→ 200', r.status === 200)
  assert('空字串回傳熱門地點', (r.data?.locations || []).length > 0)

  // 4) 無匹配 → showManualInput=true
  r = await api('GET', '/api/locations/search?q=zzzzz不存在')
  assert('GET /api/locations/search?q=不存在 → 200', r.status === 200)
  assert('無匹配時 showManualInput=true', r.data?.showManualInput === true, JSON.stringify(r.data))

  // 5) 預估價格 RPC：港島 → 深圳福田 7座
  r = await api('POST', '/api/pricing/estimate', {
    pickup_zone_code: 'hk_island',
    dropoff_zone_code: 'sz_futian',
    vehicle_type: '7_seat',
  })
  assert('POST /api/pricing/estimate 港島→深圳福田7座 → 200', r.status === 200, JSON.stringify(r.data).slice(0,200))
  assert('found=true', r.data?.found === true)
  assert('total_price 在 900-1200 範圍', r.data?.total_price >= 900 && r.data?.total_price <= 1200, `total_price=${r.data?.total_price}`)

  // 6) 預估價格（反向 → 也能查到）
  r = await api('POST', '/api/pricing/estimate', {
    pickup_zone_code: 'sz_futian',
    dropoff_zone_code: 'hk_kowloon',
    vehicle_type: '7_seat',
  })
  assert('反向 深圳福田→九龍 也能查到', r.data?.found === true, JSON.stringify(r.data))

  // 7) 預估價格 夜間加成（22:00 出發）
  const nightTime = new Date()
  nightTime.setHours(23, 0, 0, 0) // 23:00 本地時間
  r = await api('POST', '/api/pricing/estimate', {
    pickup_zone_code: 'hk_kowloon',
    dropoff_zone_code: 'sz_futian',
    vehicle_type: '7_seat',
    departure_time: nightTime.toISOString(),
  })
  assert('夜間加成計算正確', r.data?.night_surcharge > 0, `night_surcharge=${r.data?.night_surcharge}`)

  // 8) 預估價格 不存在的路線 → found=false
  r = await api('POST', '/api/pricing/estimate', {
    pickup_zone_code: 'hk_central',
    dropoff_zone_code: 'taipei_101',  // 不存在
    vehicle_type: '7_seat',
  })
  assert('不存在路線 found=false', r.data?.found === false)

  // 9) 預估價格 4座
  r = await api('POST', '/api/pricing/estimate', {
    pickup_zone_code: 'hk_kowloon',
    dropoff_zone_code: 'sz_futian',
    vehicle_type: '4_seat',
  })
  assert('4座 估算', r.data?.found === true, `4_seat total=${r.data?.total_price}`)
  assert('4座 比 7座 便宜', r.data?.total_price < 900, `4_seat=${r.data?.total_price}`)

  // 10) 整筆訂單（不登入 → 401 or 200 with passenger_id）
  // 先註冊一個 passenger
  const email = `pricing_test_${Date.now()}@test.com`
  const signupRes = await supabase.auth.admin.createUser({
    email,
    password: 'Test123456!',
    email_confirm: true,
    user_metadata: { name: 'Pricing Test', phone: '+852' + (90000000 + Math.floor(Math.random() * 9999999)) },
  })
  if (signupRes.error) { console.error('signup err:', signupRes.error); process.exit(1) }
  const userId = signupRes.data.user.id

  // 更新 phone 與 role
  await supabase.from('users').update({ phone: '+85299998888', name: 'Pricing Test', role: 'passenger' }).eq('id', userId)

  // 登入拿 cookie（parseAuthToken 只吃 supabase auth cookie，不吃 Bearer JWT）
  const signinRes = await supabase.auth.signInWithPassword({ email, password: 'Test123456!' })
  const token = signinRes.data.session?.access_token

  // 把 access_token 包成 supabase auth cookie 格式（與 proxy.ts parseAuthToken 一致）
  const sessionPayload = JSON.stringify({
    access_token: token,
    refresh_token: signinRes.data.session?.refresh_token,
    expires_at: signinRes.data.session?.expires_at,
    expires_in: signinRes.data.session?.expires_in,
    token_type: 'bearer',
    user: signinRes.data.session?.user,
  })
  // Supabase SSR 預設用 base64(JSON) 形式（@supabase/ssr 在 Set-Cookie 寫入）
  const base64 = Buffer.from(sessionPayload).toString('base64')
  const projectRef = env.NEXT_PUBLIC_SUPABASE_URL.split('//')[1].split('.')[0]
  const cookieName = `sb-${projectRef}-auth-token`
  const cookieValue = `${cookieName}=${encodeURIComponent(base64)}`

  r = await apiWithCookie('POST', '/api/orders/create', {
    direction: 'hk_to_mainland',
    pickupLocation: '香港',
    pickupArea: '中環',
    pickupAddress: '皇后大道中 1 號',
    pickupZoneCode: 'hk_island',
    pickupLat: 22.2819,
    pickupLng: 114.1585,
    dropoffLocation: '深圳',
    dropoffArea: '福田區',
    dropoffAddress: '福田口岸',
    dropoffZoneCode: 'sz_futian',
    dropoffLat: 22.5185,
    dropoffLng: 114.0578,
    departureTime: new Date(Date.now() + 86400000).toISOString(),
    passengers: 2,
    luggage: 1,
    vehicleType: '7_seat',
    passengerName: 'Pricing Test',
    passengerPhone: '+85299998888',
  }, cookieValue)
  assert('POST /api/orders/create with zone + lat/lng → 200', r.status === 200, `status=${r.status} data=${JSON.stringify(r.data).slice(0,300)}`)
  assert('訂單 estimatedFare 已填', r.data?.order?.estimatedFare != null && Number(r.data.order.estimatedFare) > 0, `estimatedFare=${r.data?.order?.estimatedFare}`)
  assert('訂單 pickupAddress 已填', r.data?.order?.pickupAddress === '皇后大道中 1 號', `pickupAddress=${r.data?.order?.pickupAddress}`)
  assert('訂單 pickupLat 已填', r.data?.order?.pickupLat != null)
  assert('訂單 dropoffAddress 已填', r.data?.order?.dropoffAddress === '福田口岸')

  console.log('\n=== 結果 ===')
  results.forEach(r => console.log(r))
  console.log(`\n通過：${pass} / 失敗：${fail}`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })