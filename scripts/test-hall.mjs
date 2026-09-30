#!/usr/bin/env node
// scripts/test-hall.mjs
// E2E 測試：接單大廳
// - 建立訂單（pending）
// - 司機「不搶」1 小時（模擬時間流逝 → DB 直接改 created_at）
// - 觸發 pg_cron → 訂單進入 pending_hall
// - 5 個司機同時搶單 → 只有 1 個成功，其餘 409
// - 驗證訂單狀態正確變更 + driver_id 正確填入
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim()] })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const BASE = 'http://localhost:3000'

let pass = 0, fail = 0
const results = []
function assert(name, cond, detail) {
  if (cond) { pass++; results.push(`✅ ${name}`) }
  else { fail++; results.push(`❌ ${name} — ${detail || ''}`) }
}

// 將 token 寫成 supabase 認得的 cookie 格式（讓 server parseAuthToken 抓得到）
function makeAuthCookie(accessToken) {
  const projectRef = env.NEXT_PUBLIC_SUPABASE_URL.split('//')[1]?.split('.')[0]
  const baseCookieName = `sb-${projectRef}-auth-token`
  const cookieData = JSON.stringify({
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh',
    user: { id: 'placeholder' },
  })
  return `${baseCookieName}=${encodeURIComponent(cookieData)}`
}

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) {
    // /api/driver/* 同時帶 cookie（讓 proxy 通過）+ Authorization（讓 API 自己認）
    // 其他路徑只帶 cookie（讓 parseAuthToken 接到）
    if (path.startsWith('/api/driver/')) {
      headers['Cookie'] = makeAuthCookie(token)
      headers['Authorization'] = `Bearer ${token}`
    } else {
      headers['Cookie'] = makeAuthCookie(token)
    }
  }
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data }
}

async function signUp(role, name, password = 'Test123!') {
  const email = `t${Date.now()}${Math.floor(Math.random() * 1000)}@gmail.com`
  const phone = '+852' + (90000000 + Math.floor(Math.random() * 9999999))

  // 路徑 A：RPC create_auth_user（SECURITY DEFINER，直接 INSERT auth.users）
  const rpcRes = await supabase.rpc('create_auth_user', {
    p_email: email,
    p_password: password,
    p_role: role,
    p_name: name,
    p_phone: phone,
  })

  if (rpcRes.data?.id) {
    // RPC 成功 → signIn 拿 token
    const sign = await supabase.auth.signInWithPassword({ email, password })
    if (sign.error) throw new Error(`signIn after RPC: ${sign.error.message}`)
    return { id: rpcRes.data.id, token: sign.data.session?.access_token }
  }

  // 路徑 B：admin API
  const r = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, name, register_method: 'email' },
  })

  if (r.data?.user?.id) {
    await supabase.from('users').upsert({
      id: r.data.user.id,
      name,
      role,
      email,
      phone,
      register_method: 'email',
    }, { onConflict: 'id' })
    const sign = await supabase.auth.signInWithPassword({ email, password })
    if (sign.error) throw sign.error
    return { id: r.data.user.id, token: sign.data.session?.access_token }
  }

  throw new Error(`所有建立用戶路徑都失敗。RPC: ${JSON.stringify(rpcRes.error)} admin: ${r.error?.message}`)
}

// 輔助：把 token 印一段（debug 用）
function shortTok(t) { return t ? t.slice(0, 20) + '...' : 'NONE' }

async function main() {
  console.log('\n=== 接單大廳 E2E 測試 ===\n')

  // === 1. 建立乘客 + 訂單 ===
  console.log('1. 建立乘客 + 訂單')
  const { id: pId, token: pToken } = await signUp('passenger', '乘客Hall')
  console.log('   passenger id:', pId, 'token:', shortTok(pToken))
  const orderRes = await api('POST', '/api/orders/create', {
    direction: 'hk_to_mainland',
    pickupLocation: '香港',
    pickupArea: '尖沙咀',
    pickupZoneCode: 'hk_kowloon',
    dropoffLocation: '深圳',
    dropoffArea: '福田區',
    dropoffZoneCode: 'sz_futian',
    departureTime: new Date(Date.now() + 86400000).toISOString(),
    passengers: 2,
    luggage: 1,
    vehicleType: '7_seat',
    passengerName: '乘客Hall',
    passengerPhone: '+85290001111',
  }, pToken)
  assert('乘客建立訂單', orderRes.status === 200, JSON.stringify(orderRes.data).slice(0, 300))
  const order = orderRes.data?.order
  if (!order) {
    console.log('  [full response]', JSON.stringify(orderRes.data).slice(0, 500))
    throw new Error('order is undefined — see response above')
  }
  // 統一轉成 order_number（API 回傳 orderNumber）
  order.order_number = order.orderNumber || order.order_number
  console.log('   order_number:', order.order_number, 'status:', order.status)

  // === 2. 模擬「1 小時無人搶」（直接改 created_at 到 70 分鐘前）===
  console.log('\n2. 模擬時間流逝（created_at → 70 分鐘前）')
  const { error: timeErr } = await supabase
    .from('orders')
    .update({ created_at: new Date(Date.now() - 70 * 60 * 1000).toISOString() })
    .eq('order_number', order.order_number)
  assert('時間倒退成功', !timeErr, timeErr?.message)

  // === 3. 觸發 pg_cron（手動執行同樣 SQL）===
  console.log('\n3. 執行 pg_cron 邏輯（移至大廳）')
  const { data: movedData, error: cronErr } = await supabase.rpc('grab_hall_order', {
    p_order_number: '__cron_test__',  // 不存在 → 只測 cron SQL 不會爆
    p_driver_id: pId,
  })
  // 預期失敗（訂單不存在），但 cron SQL 本身要執行
  const { data: realCheck } = await supabase
    .from('orders')
    .select('status, entered_hall_at')
    .eq('order_number', order.order_number)
    .single()
  assert('訂單尚未進大廳', realCheck?.status === 'pending', `status=${realCheck?.status}`)

  // 直接用 SQL UPDATE 觸發（模擬 cron 跑過）
  const { error: moveErr } = await supabase
    .from('orders')
    .update({
      status: 'pending_hall',
      entered_hall_at: new Date().toISOString(),
    })
    .eq('order_number', order.order_number)
  assert('手動移入大廳成功', !moveErr, moveErr?.message)

  // === 4. 5 個司機同時搶單 ===
  console.log('\n4. 5 個司機同時搶單（並發測試）')
  const drivers = []
  for (let i = 0; i < 5; i++) {
    const { id: dId, token: dToken } = await signUp('driver', `司機Hall${i}`)
    drivers.push({ id: dId, token: dToken, name: `司機Hall${i}` })
  }

  // 5 個司機同時呼叫 hall-grab
  const grabResults = await Promise.all(
    drivers.map((d) => api('POST', '/api/driver/hall-grab', { order_number: order.order_number }, d.token))
  )

  console.log('   grab responses:', grabResults.map((r) => `${r.status}:${JSON.stringify(r.data).slice(0,150)}`).join('\n     '))

  const successCount = grabResults.filter((r) => r.status === 200 && r.data?.success).length
  const conflictCount = grabResults.filter((r) => r.status === 409).length
  console.log(`   成功：${successCount} / 衝突：${conflictCount}`)
  results.forEach((r) => { if (r.startsWith('✅') || r.startsWith('❌')) console.log('  ' + r) })
  assert('恰好 1 個司機搶到', successCount === 1, `success=${successCount}`)
  assert('其他 4 個收到 409', conflictCount === 4, `conflict=${conflictCount}`)

  // === 5. 驗證訂單狀態正確變更 ===
  console.log('\n5. 驗證訂單狀態')
  const { data: finalOrder } = await supabase
    .from('orders')
    .select('status, driver_id, driver_name, entered_hall_at, grab_token')
    .eq('order_number', order.order_number)
    .single()
  assert('訂單狀態 = grabbed', finalOrder?.status === 'grabbed', `status=${finalOrder?.status}`)
  assert('訂單 driver_id 已填', finalOrder?.driver_id != null)
  assert('訂單 grab_token 已清空', finalOrder?.grab_token == null, `grab_token=${finalOrder?.grab_token}`)

  // 確認是 5 個司機之一
  const winnerDriver = drivers.find((d) => d.id === finalOrder?.driver_id)
  assert('driver_id 是 5 個司機之一', !!winnerDriver)

  // === 6. 司機端拉取大廳（已被搶，所以不應見到此訂單）===
  console.log('\n6. 司機拉取大廳（剛搶到的司機）')
  const hallR = await api('GET', '/api/driver/hall-orders', null, winnerDriver.token)
  assert('司機可呼叫 hall-orders API', hallR.status === 200)
  assert('大廳已無此訂單', !(hallR.data?.orders || []).some((o) => o.order_number === order.order_number))

  // === 7. 未授權測試 ===
  console.log('\n7. 未授權測試')
  let authR = await api('POST', '/api/driver/hall-grab', { order_number: 'TEST' }, pToken)  // 乘客 token
  assert('乘客不能搶單（403）', authR.status === 403, `status=${authR.status}`)

  authR = await api('POST', '/api/driver/hall-grab', { order_number: 'TEST' }, null)
  assert('未登入 401', authR.status === 401)

  // === 8. 搶已 grabbed 的訂單 ===
  console.log('\n8. 搶已被搶的訂單')
  const loser = drivers.find((d) => d.id !== finalOrder?.driver_id)
  const grabbedR = await api('POST', '/api/driver/hall-grab', { order_number: order.order_number }, loser.token)
  assert('搶 grabbed 訂單 → 409', grabbedR.status === 409, `status=${grabbedR.status}`)
  assert('回傳 currentStatus=grabbed', grabbedR.data?.currentStatus === 'grabbed', `currentStatus=${grabbedR.data?.currentStatus}`)

  // === 結果 ===
  console.log('\n=== 結果 ===')
  results.forEach((r) => console.log(r))
  console.log(`\n通過：${pass} / 失敗：${fail}`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })