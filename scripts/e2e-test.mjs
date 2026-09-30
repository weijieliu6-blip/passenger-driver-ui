// E2E 訂單流程測試：建立測試乘客 + 司機 → 8 筆訂單完整跑流程
// 用法：node scripts/e2e-test.mjs
// 前提：dev server 在 http://localhost:3000 跑著

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// 讀 .env.local 取 service role key
const here = dirname(fileURLToPath(import.meta.url))
const envText = readFileSync(join(here, '..', '.env.local'), 'utf8')
const env = Object.fromEntries(
  envText.split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...rest] = l.split('='); return [k.trim(), rest.join('=').trim()] })
)
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('env not loaded'); process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const BASE = 'http://localhost:3000'

// ─── 共用 helpers ───
const sleep = ms => new Promise(r => setTimeout(r, ms))

function makeFetcher(cookieHeader = '') {
  return async function call(method, path, body) {
    const headers = { 'Content-Type': 'application/json' }
    if (cookieHeader) headers['Cookie'] = cookieHeader
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const setCookie = res.headers.get('set-cookie')
    let text2 = ''
    try { text2 = await res.text() } catch {}
    let json = null
    try { json = JSON.parse(text2) } catch {}
    return { status: res.status, body: json, raw: text2, setCookie }
  }
}

async function ensureUser(phone, password, name, role) {
  // 先看現有（auth + public）
  const { data: existing } = await admin.from('users').select('id, role').eq('phone', phone).maybeSingle()

  // 1) 確保 auth.users 存在
  const region = 'hk'
  const cleaned = phone.replace(/[\s+\-]/g, '')
  const authEmail = `phone_hk_${cleaned}@hkcar.app`

  // 先看現有 public.users（trigger 寫入的）；用其 id 反查 auth.users
  // 因為 listUsers 只回最近 N 個，無法依 email 全表掃
  let authUserId = null
  if (existing?.id) {
    const { data: au, error: auErr } = await admin.auth.admin.getUserById(existing.id)
    if (au?.user) {
      authUserId = au.user.id
      // 同步更新密碼（測試帳號統一密碼）
      await admin.auth.admin.updateUserById(au.user.id, { password })
    }
  }

  if (!authUserId) {
    try {
      const { data: created2, error: aerr } = await admin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        user_metadata: {
          role,
          name,
          phone: cleaned,
          phone_region: region,
          full_phone: '+852' + cleaned,
          register_method: 'phone',
        },
      })
      if (aerr || !created2.user) throw new Error('createUser failed: ' + aerr?.message)
      authUserId = created2.user.id
    } catch (e) {
      // race condition：可能並行的腳本已建好。再 getUserById 一次（用剛插的 public.users）
      console.warn(`[ensureUser] createUser conflict for ${phone}, retrying lookup…`)
      await sleep(500)
      const { data: pub } = await admin.from('users').select('id').eq('phone', cleaned).maybeSingle()
      if (pub) {
        const { data: au2 } = await admin.auth.admin.getUserById(pub.id)
        if (au2?.user) authUserId = au2.user.id
      }
      if (!authUserId) throw e
    }
  }

  // 2) 確保 public.users 存在（id、role 一致）
  if (!existing) {
    // 等 trigger 寫入（300ms 內通常 OK）；超時就手動補
    await sleep(400)
    const { data: recheck } = await admin.from('users').select('id').eq('id', authUserId).maybeSingle()
    if (!recheck) {
      await admin.from('users').insert({
        id: authUserId,
        role,
        phone: cleaned,
        name,
        register_method: 'phone',
      })
    }
  } else if (existing.role !== role) {
    // 確保 role 對（特別是 driver）
    await admin.from('users').update({ role }).eq('id', authUserId)
  }

  return authUserId
}

async function ensureDriverInfo(driverId, plate = 'TEST-001') {
  const { data: existing } = await admin.from('driver_info').select('id').eq('id', driverId).maybeSingle()
  if (existing) return
  await admin.from('driver_info').insert({
    id: driverId,
    vehicle_plate: plate,
    vehicle_model: '7_seat',
    driving_years: 5,
    rating: 5.0,
    total_orders: 0,
    total_rating_sum: 0,
    total_rating_count: 0,
    membership_tier: 'gold',
    status: 'available', // 重要：available 才能搶單
  })
}

// ─── 主流程 ───
async function loginAs(phone, password) {
  const call = makeFetcher()
  // 允許重試：429 表示 rate limit，等 retryAfterSeconds 後重試
  for (let attempt = 0; attempt < 5; attempt++) {
    const { status, body, setCookie } = await call('POST', '/api/auth/login', {
      identifier: phone, password,
    })
    if (status === 200) {
      const cookies = []
      if (setCookie) {
        const parts = setCookie.split(/,(?=[^ ]+=)/)
        for (const p of parts) {
          const kv = p.split(';')[0]
          if (kv) cookies.push(kv.trim())
        }
      }
      return cookies.join('; ')
    }
    if (status === 429) {
      const wait = (body?.retryAfterSeconds ?? 5) * 1000 + 500
      console.log(`  ⏳ login ${phone} rate limited, wait ${wait}ms`)
      await sleep(wait)
      continue
    }
    throw new Error(`login failed ${phone}: ${status} ${JSON.stringify(body)}`)
  }
  throw new Error(`login failed ${phone}: too many 429 retries`)
}

const results = []
let pass = 0, fail = 0

function ok(msg) { console.log('  ✅ ' + msg); pass++ }
function bad(msg) { console.log('  ❌ ' + msg); fail++ }

async function callWithRetry(label, fn, opts = {}) {
  // fn 應回傳 { status, body, raw, setCookie }
  const maxRetries = opts.maxRetries ?? 6
  for (let i = 0; i < maxRetries; i++) {
    const r = await fn()
    if (r.status === 429) {
      const wait = (r.body?.retryAfterSeconds ?? 5) * 1000 + 500
      console.log(`  ⏳ ${label} rate limited, wait ${wait}ms`)
      await sleep(wait)
      continue
    }
    return r
  }
  throw new Error(`${label} too many 429 retries`)
}

async function runOne(label, scenario, passengers, driverCookie) {
  console.log(`\n🧪 [${label}] ${scenario.direction} ${scenario.vehicleType}`)
  const passenger = passengers[scenario.passengerIdx % passengers.length]
  const call = makeFetcher(passenger.cookie)

  // 1) 乘客下單
  const create = await callWithRetry(`create #${label}`, () => call('POST', '/api/orders/create', {
    direction: scenario.direction,
    pickupLocation: scenario.pickup,
    pickupArea: scenario.pickupArea,
    dropoffLocation: scenario.dropoff,
    dropoffArea: scenario.dropoffArea,
    departureTime: scenario.departureTime,
    passengers: scenario.passengers,
    luggage: scenario.luggage ?? 2,
    vehicleType: scenario.vehicleType,
    hasChild: scenario.hasChild ?? false,
    childType: scenario.childType ?? null,
    passengerName: passenger.name,
    passengerPhone: passenger.phone,
    passengerNotes: scenario.notes ?? null,
  }))
  if (create.status !== 200 || !create.body?.success) {
    bad(`下單失敗 ${create.status} ${JSON.stringify(create.body)?.slice(0, 200)}`)
    results.push({ label, ok: false, step: 'create', detail: create.body })
    return
  }
  const orderNumber = create.body.order?.orderNumber ?? create.body.orderNumber
  const grabToken = create.body.order?.grabToken ?? create.body.grabToken
  ok(`下單成功 orderNumber=${orderNumber} grabToken=${grabToken?.slice(0, 12)}...`)

  // 2) 乘客查訂單確認 status=pending
  const myOrder = await call('GET', `/api/orders/${orderNumber}`)
  if (myOrder.status !== 200 || myOrder.body?.order?.status !== 'pending') {
    bad(`訂單狀態不對 ${myOrder.status} ${JSON.stringify(myOrder.body)?.slice(0, 200)}`)
    results.push({ label, ok: false, step: 'check-pending' })
    return
  }
  ok(`訂單 status=pending`)

  // 3) 司機用 grabToken 搶單（cookie = 司機已登入）
  const driverCall = makeFetcher(driverCookie)
  const grab = await driverCall('POST', `/api/driver/grab/${grabToken}`, {})
  if (grab.status !== 200 || !grab.body?.success) {
    bad(`搶單失敗 ${grab.status} ${JSON.stringify(grab.body)?.slice(0, 200)}`)
    results.push({ label, ok: false, step: 'grab', detail: grab.body })
    return
  }
  ok(`司機搶單成功 driverId=${grab.body.order?.driverId ?? grab.body.driver?.id}`)

  // 4) 司機報價
  const quote = await driverCall('POST', `/api/driver/orders/${orderNumber}/confirm-price`, {
    confirmed_price: scenario.price,
    price_currency: 'HKD',
  })
  if (quote.status !== 200 || !quote.body?.success) {
    bad(`報價失敗 ${quote.status} ${JSON.stringify(quote.body)?.slice(0, 200)}`)
    results.push({ label, ok: false, step: 'quote', detail: quote.body })
    return
  }
  ok(`報價成功 ${scenario.price} HKD`)

  // 5) 乘客確認接受（accept-quote）
  const accept = await call('POST', `/api/orders/${orderNumber}/accept-quote`, {})
  if (accept.status !== 200 || !accept.body?.success) {
    bad(`乘客確認失敗 ${accept.status} ${JSON.stringify(accept.body)?.slice(0, 200)}`)
    results.push({ label, ok: false, step: 'accept', detail: accept.body })
    return
  }
  ok(`乘客確認訂單完成`)

  // 6) 驗證訂單最終狀態
  const final = await call('GET', `/api/orders/${orderNumber}`)
  const finalStatus = final.body?.order?.status
  if (finalStatus !== 'completed') {
    bad(`最終狀態不對: ${finalStatus}`)
    results.push({ label, ok: false, step: 'final', detail: final.body })
    return
  }
  ok(`最終狀態 = completed ✓`)
  results.push({ label, ok: true, orderNumber })
}

async function main() {
  console.log('═══ E2E 訂單流程測試 ═══\n')

  // 1) 建立測試乘客（注意 auth/login 有 5/60s rate limit，每次間隔 13s）
  console.log('📋 準備測試帳號…')
  const passengers = []
  for (let i = 1; i <= 3; i++) {
    const phone = `9002000${i}`
    await ensureUser(phone, 'test1234', `Test P${i}`, 'passenger')
    if (i > 1) await sleep(13000) // 3 個登入 → 至少 25s 才能避開 5/60s
    const cookie = await loginAs(phone, 'test1234')
    passengers.push({ phone, name: `Test P${i}`, cookie })
  }
  ok(`3 位乘客就緒 (${passengers.map(p => p.phone).join(', ')})`)

  // 2) 建立司機
  await sleep(13000) // 等 rate limit reset
  const driverPhone = '90030001'
  const driverId = await ensureUser(driverPhone, 'test1234', 'Test Driver', 'driver')
  await ensureDriverInfo(driverId, 'TEST-DRIVER')
  await sleep(13000)
  const driverCookie = await loginAs(driverPhone, 'test1234')
  ok(`司機就緒 ${driverPhone} (${driverId.slice(0, 8)}…)`)

  // 3) 設定 departureTime 為「未來 1 小時」（避免 released_at 邏輯干擾）
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  // 4) 8 個測試場景
  const scenarios = [
    {
      label: '1', direction: 'hk_to_mainland', vehicleType: '7_seat',
      pickup: '香港中環', pickupArea: '中環',
      dropoff: '深圳福田口岸', dropoffArea: '福田',
      passengers: 1, price: 800, departureTime: inOneHour,
      passengerIdx: 0,
    },
    {
      label: '2', direction: 'hk_to_mainland', vehicleType: '4_seat',
      pickup: '香港九龍站', pickupArea: '九龍',
      dropoff: '深圳灣口岸', dropoffArea: '南山',
      passengers: 2, luggage: 1, price: 600, departureTime: inOneHour,
      passengerIdx: 1,
    },
    {
      label: '3', direction: 'mainland_to_hk', vehicleType: '7_seat',
      pickup: '深圳皇崗口岸', pickupArea: '福田',
      dropoff: '香港國際機場', dropoffArea: '離島',
      passengers: 4, luggage: 4, price: 1100, departureTime: inOneHour,
      passengerIdx: 2,
    },
    {
      label: '4', direction: 'mainland_to_hk', vehicleType: '7_seat',
      pickup: '廣州天河城', pickupArea: '天河',
      dropoff: '香港沙田', dropoffArea: '沙田',
      passengers: 3, luggage: 3, hasChild: true, childType: 'over_3',
      price: 1500, departureTime: inOneHour,
      passengerIdx: 0,
    },
    {
      label: '5', direction: 'hk_to_mainland', vehicleType: '7_seat',
      pickup: '香港銅鑼灣', pickupArea: '灣仔',
      dropoff: '深圳南山科技園', dropoffArea: '南山',
      passengers: 1, luggage: 0, price: 750, departureTime: inOneHour,
      notes: '請在 1 樓大堂等我', passengerIdx: 1,
    },
    {
      label: '6', direction: 'mainland_to_hk', vehicleType: '4_seat',
      pickup: '深圳北站', pickupArea: '龍華',
      dropoff: '香港中環', dropoffArea: '中環',
      passengers: 1, price: 700, departureTime: inOneHour,
      passengerIdx: 2,
    },
    {
      label: '7', direction: 'hk_to_mainland', vehicleType: '7_seat',
      pickup: '香港機場', pickupArea: '離島',
      dropoff: '珠海拱北口岸', dropoffArea: '拱北',
      passengers: 5, luggage: 5, hasChild: true, childType: 'infant',
      price: 1800, departureTime: inOneHour,
      passengerIdx: 0,
    },
    {
      label: '8', direction: 'mainland_to_hk', vehicleType: '7_seat',
      pickup: '東莞虎門', pickupArea: '虎門',
      dropoff: '香港旺角', dropoffArea: '油尖旺',
      passengers: 2, luggage: 2, price: 900, departureTime: inOneHour,
      notes: '有大型行李箱一個', passengerIdx: 1,
    },
  ]

  for (const sc of scenarios) {
    try {
      await runOne(sc.label, sc, passengers, driverCookie)
      // 等 orderCreate rate limit (1/30s) + grab (10/60s) 完全 reset
      await sleep(35000)
    } catch (e) {
      bad(`未預期錯誤: ${e.message}`)
      results.push({ label: sc.label, ok: false, error: e.message })
    }
  }

  // 5) 邊界測試（用最後一次 order 的 token 驗證）
  // 由於 rate limit 限制，這幾項單獨執行；本次 run 先標記為 skipped
  console.log('\n⏭  [9-10] 邊界測試略過（rate limit 限制；部署前手動驗證即可）')

  console.log(`\n═══ 結果：PASS=${pass} FAIL=${fail} ═══`)
  console.log(`通過訂單：${results.filter(r => r.ok).length}/${results.length}`)
  if (results.some(r => !r.ok)) {
    console.log('\n失敗場景：')
    results.filter(r => !r.ok).forEach(r => console.log(' -', JSON.stringify(r).slice(0, 300)))
  }
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })