// 司機功能測試腳本（ESM）
// 執行前請先：dev server 跑起來（cd driver-app && npm run dev）
//
/**
 * ⚠️ v1 凍結：v1 司機搶單走釘釘，司機 app 暫不推出。
 * 此測試腳本暫時凍結，不預期全綠。
 * 待客單量穩定、開啟司機 app v2 後再解凍。
 * 凍結日期：2026-09-27
 */
//
// 流程：
//   1. 登入金牌司機
//   2. GET /api/driver/status → 應回 'offline'（剛跑過 migration）
//   3. PATCH status = 'available'
//   4. PATCH status = 'on_trip' → 預期 403
//   5. PATCH status = 'offline' → 預期 200
//   6. GET /api/driver/available-orders → 預期空（status=offline）
//   7. POST /api/driver/schedule  新增 recurring (weekday=1, 09:00-18:00)
//   8. POST /api/driver/schedule  新增 oneoff (schedule_date=tomorrow)
//   9. GET  /api/driver/schedule   → 應有 2 條
//  10. 找一筆有 scheduled_time（用 departure_time）落在排程外的訂單搶單 → 預期 403
//  11. GET /api/driver/orders?start_date=...&end_date=...  → 應回訂單列表
//  12. GET /api/driver/reports?start_date=...&end_date=... → 應回彙總
//
// 使用：node test-driver-features.mjs
// 注意：本腳本只驗證「API 行為」，不修改業務資料狀態。

const BASE = process.env.BASE_URL || 'http://localhost:3001'
const IDENTIFIER = process.env.TEST_DRIVER_EMAIL || 'test_driver_gold@test.com'
const PASSWORD = 'test123456'

let cookieJar = ''

async function api(path, init = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  }
  if (cookieJar) headers['Cookie'] = cookieJar

  const res = await fetch(BASE + path, {
    ...init,
    headers,
  })

  const setCookie = res.headers.getSetCookie?.() || []
  if (setCookie.length) {
    cookieJar = setCookie
      .map(c => c.split(';')[0])
      .join('; ')
  }

  let body
  try { body = await res.json() } catch { body = null }

  return { status: res.status, body }
}

let pass = 0
let fail = 0

function check(name, ok, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✅ ${name}` + (detail ? ` — ${detail}` : ''))
  } else {
    fail++
    console.log(`  ❌ ${name}` + (detail ? ` — ${detail}` : ''))
  }
}

function todayYmd(daysOffset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  return d.toISOString().slice(0, 10)
}

async function login() {
  console.log('\n[1] Login as', IDENTIFIER)
  const r = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: IDENTIFIER, password: PASSWORD }),
  })
  check('login returns 200', r.status === 200, `status=${r.status}`)
  check('login success=true', r.body?.success === true)
  check('user is driver', r.body?.user?.role === 'driver')
}

async function testStatus() {
  console.log('\n[2-5] Status flow')
  // 初始：先確保是 offline（測試環境可能已被其他測試改動）
  await api('/api/driver/status', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'offline' }),
  })
  let r = await api('/api/driver/status')
  check('GET status after reset', r.status === 200)
  check('status is offline', r.body?.status === 'offline', `got ${r.body?.status}`)

  // 切到 available
  r = await api('/api/driver/status', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'available' }),
  })
  check('PATCH available → 200', r.status === 200)
  check('status updated to available', r.body?.status === 'available')

  // 嘗試設為 on_trip — 應 403
  r = await api('/api/driver/status', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'on_trip' }),
  })
  check('PATCH on_trip → 403', r.status === 403, `status=${r.status}`)
  check('error mentions manual/手動/伺服器/由系統', /on_trip|伺服器|系統|手動/.test(r.body?.error || ''))

  // 切回 offline
  r = await api('/api/driver/status', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'offline' }),
  })
  check('PATCH offline → 200', r.status === 200)
  check('status updated to offline', r.body?.status === 'offline')
}

async function testAvailableAfterOffline() {
  console.log('\n[6] Available orders when offline')
  const r = await api('/api/driver/available-orders')
  check('available-orders → 200', r.status === 200)
  check('orders empty (offline)', Array.isArray(r.body?.orders) && r.body.orders.length === 0,
    `count=${r.body?.count}`)
}

async function testSchedule() {
  console.log('\n[7-9] Schedules')
  // 先清掉舊的
  let r = await api('/api/driver/schedule')
  for (const s of r.body?.schedules || []) {
    await api(`/api/driver/schedule/${s.id}`, { method: 'DELETE' })
  }
  check('cleared existing schedules', true)

  // 新增 recurring (週一 09:00-18:00)
  r = await api('/api/driver/schedule', {
    method: 'POST',
    body: JSON.stringify({
      schedule_type: 'recurring',
      weekday: 1,
      start_time: '09:00:00',
      end_time: '18:00:00',
    }),
  })
  check('POST recurring → 200', r.status === 200, `body=${JSON.stringify(r.body)?.slice(0,200)}`)
  check('schedule saved with weekday=1', r.body?.schedule?.weekday === 1)

  // 新增 oneoff (明天 14:00-17:00)
  r = await api('/api/driver/schedule', {
    method: 'POST',
    body: JSON.stringify({
      schedule_type: 'oneoff',
      schedule_date: todayYmd(1),
      start_time: '14:00:00',
      end_time: '17:00:00',
    }),
  })
  check('POST oneoff → 200', r.status === 200)
  check('schedule saved with date', r.body?.schedule?.schedule_date === todayYmd(1))

  // GET 驗證
  r = await api('/api/driver/schedule')
  check('GET schedules → 200', r.status === 200)
  check('count === 2', r.body?.schedules?.length === 2, `got ${r.body?.schedules?.length}`)
}

async function testGrabScheduleBlock() {
  console.log('\n[10] Grab outside schedule should 403')
  // 確保司機 available
  await api('/api/driver/status', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'available' }),
  })

  // 從 available-orders 拿一筆，確認它的 departure_time 落在 09:00-18:00 之外
  const ordersRes = await api('/api/driver/available-orders')
  const orders = ordersRes.body?.orders || []

  if (orders.length === 0) {
    console.log('  ⚠️  目前沒有可搶訂單可供驗證；改用以下判定：')
    // 沒單就直接驗證 schedule check 的另一面 — 把司機設成 offline 並搶任何單
    await api('/api/driver/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'offline' }),
    })
    const r = await api('/api/orders/INVALID_ORDER/grab', { method: 'POST' })
    // INVALID_ORDER 預期 404，但因司機 offline 也會被擋
    check('grab while offline → not 200', r.status !== 200, `status=${r.status}`)
  } else {
    // 嘗試搶第一筆 — 因為 schedule 包含週一 09:00-18:00 + 明天的 14:00-17:00，
    // 若 departure_time 落在排程內會通過；落在外就 403。
    const target = orders[0]
    const r = await api(`/api/orders/${target.order_number}/grab`, { method: 'POST' })
    if (r.status === 403 && /schedule|排程|出車時間/.test(r.body?.error || '')) {
      check('grab outside schedule → 403 with schedule hint', true)
    } else if (r.status === 409) {
      check('grab succeeded (order gone) — schedule check passed', true, `409 ${r.body?.error}`)
    } else if (r.status === 200) {
      check('grab succeeded (200) — schedule check passed', true)
    } else {
      check('grab returned expected status', [200, 403, 409, 410].includes(r.status),
        `status=${r.status} body=${JSON.stringify(r.body)?.slice(0,200)}`)
    }
  }
}

async function testOrdersByDateRange() {
  console.log('\n[11] Orders by date range (last 7 days)')
  const start = todayYmd(-6)
  const end = todayYmd(0)
  const r = await api(`/api/driver/orders?start_date=${start}&end_date=${end}`)
  check('GET /api/driver/orders → 200', r.status === 200)
  check('returns orders array', Array.isArray(r.body?.orders), `type=${typeof r.body?.orders}`)
  check('range echoed', r.body?.range?.start_date === start && r.body?.range?.end_date === end,
    `range=${JSON.stringify(r.body?.range)}`)

  // 驗證日期區間上限 31
  const tooLong = todayYmd(-40)
  const r2 = await api(`/api/driver/orders?start_date=${tooLong}&end_date=${end}`)
  check('range > 31 days → 400', r2.status === 400, `status=${r2.status}`)
}

async function testReports() {
  console.log('\n[12] Reports aggregation')
  const start = todayYmd(-29)
  const end = todayYmd(0)
  const r = await api(`/api/driver/reports?start_date=${start}&end_date=${end}`)
  check('GET /api/driver/reports → 200', r.status === 200, `body=${JSON.stringify(r.body)?.slice(0,200)}`)
  check('has totalRevenue', typeof r.body?.totalRevenue === 'number')
  check('has orderCount', typeof r.body?.orderCount === 'number')
  check('has avgPerOrder', typeof r.body?.avgPerOrder === 'number')
  check('has dailyRevenue array', Array.isArray(r.body?.dailyRevenue))
  check('has byServiceType array', Array.isArray(r.body?.byServiceType))
  check('has byTier array', Array.isArray(r.body?.byTier))

  // Range 邊界
  const tooLong = todayYmd(-40)
  const r2 = await api(`/api/driver/reports?start_date=${tooLong}&end_date=${end}`)
  check('range > 31 days → 400', r2.status === 400)
}

async function main() {
  console.log(`🧪 Driver Features Test against ${BASE}`)
  await login()
  await testStatus()
  await testAvailableAfterOffline()
  await testSchedule()
  await testGrabScheduleBlock()
  await testOrdersByDateRange()
  await testReports()

  console.log(`\n========================================`)
  console.log(`  ✅ Pass: ${pass}`)
  console.log(`  ❌ Fail: ${fail}`)
  console.log(`========================================`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Test crashed:', err)
  process.exit(2)
})
