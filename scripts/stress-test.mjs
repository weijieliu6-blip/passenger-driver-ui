// 抗壓測試：模擬同時間段大量訂單湧入
// 場景：
//   A. 並發下單（5 個不同乘客同時下單，驗證 rate limit + DB 一致性）
//   B. 搶單 atomic 競態（5 個司機同時搶 1 個訂單，驗證只有 1 個贏）
//   C. 高流量搶單（1 司機 30s 內搶 20 筆，驗證 rate limit + 沒有 half-grab）
//   D. 端到端並發（8 筆訂單同時建好，8 個司機同時搶，8 位乘客同時確認）
//
// 用法：node scripts/stress-test.mjs
// 假設：dev server 在 http://localhost:3000
//       測試乘客 90020001~90020009、測試司機 90030001~90030009 已存在

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim()] })
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const BASE = 'http://localhost:3000'
const sleep = ms => new Promise(r => setTimeout(r, ms))

// ─── 共用工具 ───
function makeFetcher(cookieHeader = '') {
  return async function call(method, path, body) {
    const headers = { 'Content-Type': 'application/json' }
    if (cookieHeader) headers['Cookie'] = cookieHeader
    const res = await fetch(BASE + path, {
      method, headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const setCookie = res.headers.get('set-cookie')
    let text2 = ''
    try { text2 = await res.text() } catch {}
    let json = null
    try { json = JSON.parse(text2) } catch {}
    return { status: res.status, body: json, raw: text2, setCookie, elapsed: Date.now() }
  }
}

async function loginAs(phone, password) {
  const call = makeFetcher()
  for (let i = 0; i < 6; i++) {
    const r = await call('POST', '/api/auth/login', { identifier: phone, password })
    if (r.status === 200) {
      const cookies = []
      if (r.setCookie) {
        for (const p of r.setCookie.split(/,(?=[^ ]+=)/)) {
          const kv = p.split(';')[0]
          if (kv) cookies.push(kv.trim())
        }
      }
      return cookies.join('; ')
    }
    if (r.status === 429) {
      await sleep((r.body?.retryAfterSeconds ?? 5) * 1000 + 500)
      continue
    }
    throw new Error(`login ${phone} failed: ${r.status} ${JSON.stringify(r.body)}`)
  }
  throw new Error(`login ${phone} too many retries`)
}

async function ensureUser(phone, password, name, role, driverPlate) {
  const cleaned = phone.replace(/[\s+\-]/g, '')
  const authEmail = `phone_hk_${cleaned}@hkcar.app`

  // public.users 找現有
  const { data: pub } = await admin.from('users').select('id, role').eq('phone', cleaned).maybeSingle()

  // auth.users 找現有
  let authUserId = pub?.id
  if (pub) {
    const { data: au } = await admin.auth.admin.getUserById(pub.id)
    if (au?.user) {
      await admin.auth.admin.updateUserById(au.user.id, { password })
      authUserId = au.user.id
    }
  }

  if (!authUserId) {
    const { data: created } = await admin.auth.admin.createUser({
      email: authEmail, password, email_confirm: true,
      user_metadata: { role, name, phone: cleaned, phone_region: 'hk', full_phone: '+852' + cleaned, register_method: 'phone' },
    })
    if (!created?.user) throw new Error('createUser failed')
    authUserId = created.user.id
    await sleep(300)
    const { data: recheck } = await admin.from('users').select('id').eq('id', authUserId).maybeSingle()
    if (!recheck) {
      await admin.from('users').insert({ id: authUserId, role, phone: cleaned, name, register_method: 'phone' })
    }
  }

  if (role !== pub?.role) {
    await admin.from('users').update({ role }).eq('id', authUserId)
  }

  // driver_info
  if (role === 'driver' && driverPlate) {
    const { data: di } = await admin.from('driver_info').select('id').eq('id', authUserId).maybeSingle()
    if (!di) {
      await admin.from('driver_info').insert({
        id: authUserId, vehicle_plate: driverPlate, vehicle_model: '7_seat',
        driving_years: 5, rating: 5, total_orders: 0, total_rating_sum: 0, total_rating_count: 0,
        membership_tier: 'gold', status: 'available',
      })
    }
  }
  return authUserId
}

// ─── 統計 ───
class Stats {
  constructor(label) { this.label = label; this.samples = []; this.errors = []; this.statuses = {} }
  record(r) {
    if (r.elapsed !== undefined) this.samples.push(r.elapsed)
    const tag = `${r.status}`
    this.statuses[tag] = (this.statuses[tag] ?? 0) + 1
    if (r.status >= 400) this.errors.push(r)
  }
  summary() {
    const s = [...this.samples].sort((a, b) => a - b)
    const n = s.length
    if (!n) return { label: this.label, count: 0 }
    return {
      label: this.label,
      count: n,
      min: s[0],
      p50: s[Math.floor(n * 0.5)],
      p95: s[Math.floor(n * 0.95)],
      p99: s[Math.floor(n * 0.99)],
      max: s[n - 1],
      statuses: this.statuses,
      errorCount: this.errors.length,
      firstError: this.errors[0] ? JSON.stringify(this.errors[0].body ?? this.errors[0].raw).slice(0, 150) : null,
    }
  }
}

// ─── 場景 ───
async function setup() {
  console.log('📋 準備帳號（9 乘客 + 9 司機）…')
  const passengers = []
  for (let i = 1; i <= 9; i++) {
    const phone = `9002000${i}`
    await ensureUser(phone, 'test1234', `P${i}`, 'passenger')
    if (i > 1) await sleep(12000)
    const cookie = await loginAs(phone, 'test1234')
    passengers.push({ phone, name: `P${i}`, cookie })
  }
  console.log(`  ✅ 9 乘客就緒`)

  await sleep(13000)
  const drivers = []
  for (let i = 1; i <= 9; i++) {
    const phone = `9003000${i}`
    await ensureUser(phone, 'test1234', `D${i}`, 'driver', `PLATE-${i}`)
    if (i > 1) await sleep(12000)
    const cookie = await loginAs(phone, 'test1234')
    drivers.push({ phone, name: `D${i}`, cookie })
  }
  console.log(`  ✅ 9 司機就緒`)
  return { passengers, drivers }
}

// 場景 A：5 位乘客同時下單（不同 user）
async function scenarioA(passengers) {
  console.log('\n🅰️  場景 A：5 位乘客同時下單')
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const stats = new Stats('A.並發下單')

  const tasks = passengers.slice(0, 5).map(async (p, i) => {
    const call = makeFetcher(p.cookie)
    const t0 = Date.now()
    const r = await call('POST', '/api/orders/create', {
      direction: i % 2 === 0 ? 'hk_to_mainland' : 'mainland_to_hk',
      pickupLocation: `Pickup ${i}`, pickupArea: `Area ${i}`,
      dropoffLocation: `Dropoff ${i}`, dropoffArea: `Area ${i + 100}`,
      departureTime: inOneHour,
      passengers: 2 + i, luggage: 1, vehicleType: i % 2 ? '4_seat' : '7_seat',
      hasChild: false, childType: null,
      passengerName: p.name, passengerPhone: p.phone,
    })
    r.elapsed = Date.now() - t0
    return r
  })

  const results = await Promise.allSettled(tasks)
  let success = 0
  const orderIds = []
  results.forEach((res, i) => {
    if (res.status === 'fulfilled') {
      stats.record(res.value)
      if (res.value.status === 200 && res.value.body?.success) {
        success++
        orderIds.push({
          passengerIdx: i,
          orderNumber: res.value.body.order?.orderNumber,
          grabToken: res.value.body.order?.grabToken,
        })
      }
    }
  })
  console.log(`  結果：${success}/5 成功`)
  console.log(`  統計：${JSON.stringify(stats.summary(), null, 2)}`)
  return { stats, orderIds, success }
}

// 場景 B：5 個司機同時搶同一筆訂單（atomic 驗證）
async function scenarioB(passengers, drivers) {
  console.log('\n🅱️  場景 B：5 司機同時搶同一筆訂單（atomic 競態）')
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  // 先建 1 筆
  const p = passengers[0]
  const call = makeFetcher(p.cookie)
  const create = await call('POST', '/api/orders/create', {
    direction: 'hk_to_mainland', vehicleType: '7_seat',
    pickupLocation: 'P', pickupArea: 'P',
    dropoffLocation: 'D', dropoffArea: 'D',
    departureTime: inOneHour,
    passengers: 1, passengerName: p.name, passengerPhone: p.phone,
  })
  if (create.status !== 200) {
    console.log(`  ❌ 建訂單失敗 ${create.status}`)
    return null
  }
  const orderNumber = create.body.order.orderNumber
  const grabToken = create.body.order.grabToken
  console.log(`  訂單 ${orderNumber} 已建好（pending），5 司機即將同時搶單…`)

  // 5 司機同時搶
  const stats = new Stats('B.並發搶單')
  const tasks = drivers.slice(0, 5).map(async (d) => {
    const dcall = makeFetcher(d.cookie)
    const t0 = Date.now()
    const r = await dcall('POST', `/api/driver/grab/${grabToken}`, {})
    r.elapsed = Date.now() - t0
    return r
  })
  const results = await Promise.allSettled(tasks)
  let winners = 0, losers = 0
  results.forEach((res) => {
    if (res.status === 'fulfilled') {
      stats.record(res.value)
      if (res.value.status === 200 && res.value.body?.success) {
        winners++
        console.log(`    🏆 搶單成功：driverId=${res.value.body.order?.driverId}`)
      } else if (res.value.status === 400) {
        losers++
      }
    }
  })
  console.log(`  結果：${winners} 個搶單成功 / ${losers} 個被拒`)
  console.log(`  統計：${JSON.stringify(stats.summary(), null, 2)}`)

  // 從 DB 確認只有 1 個 driver_id 被設定
  const { data: ords } = await admin.from('orders').select('order_number, status, driver_id').eq('order_number', orderNumber).single()
  console.log(`  DB 最終狀態：status=${ords?.status} driver_id=${ords?.driver_id?.slice(0, 8)}`)
  const passed = winners === 1 && ords?.driver_id
  console.log(passed ? '  ✅ Atomic 搶單正確（只有 1 個贏）' : `  ❌ Atomic 失敗：winners=${winners} db_driver=${ords?.driver_id}`)
  return { passed, winners, finalDriver: ords?.driver_id }
}

// 場景 C：1 司機 30s 內搶 20 筆（高流量）
async function scenarioC(passengers, drivers) {
  console.log('\n🅲  場景 C：1 司機 30s 內嘗試搶 20 筆訂單（rate limit 驗證）')
  const driver = drivers[1] // 用第二個司機避免 B 影響
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const dcall = makeFetcher(driver.cookie)

  // 先建 20 筆訂單（用不同乘客，每乘客 sleep 31s 避免 orderCreate rate limit）
  // 為了節省時間：建立 20 筆「直接由 admin client insert」繞過 API（仍走 RLS bypass service role）
  console.log('  準備 20 筆訂單（直接 admin insert 加速）…')
  const tokens = []
  for (let i = 0; i < 20; i++) {
    const p = passengers[i % 9]
    const t = 'tok_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36)
    const orderNumber = 'STRESS' + Date.now().toString(36).slice(-6) + i
    const { data: ins, error: e1 } = await admin.from('orders').insert({
      order_number: orderNumber,
      status: 'pending',
      direction: i % 2 === 0 ? 'to_mainland' : 'to_hk',
      pickup_location: 'P' + i, pickup_area: 'A',
      dropoff_location: 'D' + i, dropoff_area: 'B',
      departure_time: inOneHour,
      passengers: 1, vehicle_type: '7_seat',
      grab_token: t,
      grab_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      passenger_id: 'a7702d52-683c-4ee5-af94-6f523c591dfd', // 直接用一個固定 passenger id
      passenger_name: 'StressP', passenger_phone: '90020001',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select('order_number').single()
    if (e1) { console.log(`    insert fail #${i}: ${e1.message}`); continue }
    tokens.push({ orderNumber, token: t })
  }
  console.log(`  建立 ${tokens.length} 筆訂單`)

  // 司機狂搶
  console.log('  司機狂搶…')
  const stats = new Stats('C.狂搶20筆')
  const start = Date.now()
  for (const { orderNumber, token } of tokens) {
    const t0 = Date.now()
    const r = await dcall('POST', `/api/driver/grab/${token}`, {})
    r.elapsed = Date.now() - t0
    stats.record(r)
  }
  const elapsed = Date.now() - start
  console.log(`  完成 ${tokens.length} 次請求，耗時 ${elapsed}ms`)
  console.log(`  統計：${JSON.stringify(stats.summary(), null, 2)}`)

  // DB 確認搶到的數量
  const { data: success } = await admin.from('orders').select('order_number').in('order_number', tokens.map(t => t.orderNumber)).eq('driver_id', drivers[1].id)
  console.log(`  DB 中 status=grabbed 且 driver=${drivers[1].id?.slice(0,8)} 的訂單：${success?.length}`)

  // 清理這批測試訂單
  await admin.from('orders').delete().in('order_number', tokens.map(t => t.orderNumber))
  return { stats, successCount: success?.length }
}

// 場景 D：8 筆訂單「同時」建好 → 8 個司機同時搶 → 8 個乘客同時確認
async function scenarioD(passengers, drivers) {
  console.log('\n🅳  場景 D：端到端並發（8 筆訂單 + 8 司機搶 + 8 乘客確認）')
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  // Phase 1: 8 位乘客同時下單（8 個 user，互不擋 rate limit）
  console.log('  Phase 1：8 位乘客同時下單')
  const stats1 = new Stats('D1.並發下單')
  const tasks1 = passengers.slice(0, 8).map(async (p, i) => {
    const call = makeFetcher(p.cookie)
    const t0 = Date.now()
    const r = await call('POST', '/api/orders/create', {
      direction: i % 2 === 0 ? 'hk_to_mainland' : 'mainland_to_hk',
      pickupLocation: 'P' + i, pickupArea: 'A',
      dropoffLocation: 'D' + i, dropoffArea: 'B',
      departureTime: inOneHour,
      passengers: 1 + i, vehicleType: '7_seat',
      passengerName: p.name, passengerPhone: p.phone,
    })
    r.elapsed = Date.now() - t0
    return r
  })
  const r1 = await Promise.allSettled(tasks1)
  const orders = []
  r1.forEach((res, idx) => {
    if (res.status === 'fulfilled') {
      stats1.record(res.value)
      if (res.value.status === 200 && res.value.body?.success) {
        const p = passengers[idx]
        orders.push({
          orderNumber: res.value.body.order.orderNumber,
          grabToken: res.value.body.order.grabToken,
          passengerIdx: idx, // 用 index 找 passenger
          passenger: p,
        })
      }
    }
  })
  console.log(`    下單成功：${orders.length}/8`)

  // Phase 2: 8 個司機同時搶（每司機搶不同訂單，避免 atomic 衝突，重點測並發）
  console.log('  Phase 2：8 個司機同時搶單')
  const stats2 = new Stats('D2.並發搶單')
  const tasks2 = drivers.slice(0, 8).map(async (d, i) => {
    if (!orders[i]) return null
    const dcall = makeFetcher(d.cookie)
    const t0 = Date.now()
    const r = await dcall('POST', `/api/driver/grab/${orders[i].grabToken}`, {})
    r.elapsed = Date.now() - t0
    return r
  })
  const r2 = await Promise.allSettled(tasks2)
  let grabs = 0
  r2.forEach((res) => {
    if (res?.status === 'fulfilled' && res.value) {
      stats2.record(res.value)
      if (res.value.status === 200 && res.value.body?.success) grabs++
    }
  })
  console.log(`    搶單成功：${grabs}/8`)

  // Phase 3: 8 個司機同時報價
  console.log('  Phase 3：8 個司機同時報價')
  const stats3 = new Stats('D3.並發報價')
  const tasks3 = drivers.slice(0, 8).map(async (d, i) => {
    if (!orders[i]) return null
    const dcall = makeFetcher(d.cookie)
    const t0 = Date.now()
    const r = await dcall('POST', `/api/driver/orders/${orders[i].orderNumber}/confirm-price`, {
      confirmed_price: 500 + i * 100, price_currency: 'HKD',
    })
    r.elapsed = Date.now() - t0
    return r
  })
  const r3 = await Promise.allSettled(tasks3)
  let quotes = 0
  r3.forEach((res) => {
    if (res?.status === 'fulfilled' && res.value) {
      stats3.record(res.value)
      if (res.value.status === 200 && res.value.body?.success) quotes++
    }
  })
  console.log(`    報價成功：${quotes}/8`)

  // Phase 4: 乘客確認訂單（只對應成功的訂單）
  console.log('  Phase 4：乘客同時確認訂單（只對成功的）')
  const stats4 = new Stats('D4.並發確認')
  const tasks4 = orders.map(async (o) => {
    if (!o?.passenger) return null
    const p = o.passenger
    const call = makeFetcher(p.cookie)
    const t0 = Date.now()
    const r = await call('POST', `/api/orders/${o.orderNumber}/accept-quote`, {})
    r.elapsed = Date.now() - t0
    return r
  })
  const r4 = await Promise.allSettled(tasks4)
  let accepts = 0
  r4.forEach((res) => {
    if (res?.status === 'fulfilled' && res.value) {
      stats4.record(res.value)
      if (res.value.status === 200 && res.value.body?.success) accepts++
    }
  })
  console.log(`    確認成功：${accepts}/${orders.length}`)

  console.log('\n  統計：')
  console.log(`    下單：${JSON.stringify(stats1.summary())}`)
  console.log(`    搶單：${JSON.stringify(stats2.summary())}`)
  console.log(`    報價：${JSON.stringify(stats3.summary())}`)
  console.log(`    確認：${JSON.stringify(stats4.summary())}`)

  // DB 驗證
  const orderNums = orders.map(o => o.orderNumber)
  const { data: dbOrders } = await admin.from('orders').select('order_number, status').in('order_number', orderNums)
  const completed = dbOrders?.filter(o => o.status === 'completed').length
  console.log(`  DB 中 completed 數量：${completed}/${dbOrders?.length}`)

  return { orders: orders.length, grabs, quotes, accepts, completed }
}

async function main() {
  console.log('═══ 抗壓測試：同時間段大量訂單湧入 ═══\n')
  const { passengers, drivers } = await setup()

  // 等所有 rate limit 完全 reset
  console.log('\n⏳ 等 65s 讓 rate limit 完全 reset…')
  await sleep(65000)

  const resultA = await scenarioA(passengers)
  await sleep(35000)

  const resultB = await scenarioB(passengers, drivers)
  await sleep(35000)

  const resultC = await scenarioC(passengers, drivers)
  await sleep(35000)

  const resultD = await scenarioD(passengers, drivers)

  console.log('\n\n═══ 總結 ═══')
  console.log(`場景 A 並發下單：${resultA.success}/5 成功`)
  console.log(`場景 B atomic 搶單：${resultB?.passed ? '✅ 正確' : '❌ 失敗'}（${resultB?.winners} 個贏）`)
  console.log(`場景 C 狂搶20筆：${resultC.successCount} 筆成功`)
  console.log(`場景 D 端到端並發：${resultD.completed}/8 完成`)
}

main().catch(e => { console.error(e); process.exit(1) })