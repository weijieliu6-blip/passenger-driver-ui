/**
 * 測試 4 個會員等級司機
 * 1. 創建 4 個司機帳號（不同會員等級）
 * 2. 模擬乘客下單
 * 3. 各等級司機在不同時間點可以搶單
 */

const SUPABASE_URL = 'https://vuuamydahzhpajjdvokl.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PASSENGER_URL = 'http://localhost:3000'
const DRIVER_URL = 'http://localhost:3001'

if (!SERVICE_ROLE_KEY) {
  console.error('❌ 缺少 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const { createClient } = require('@supabase/supabase-js')
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// 4 個測試司機
const TEST_DRIVERS = [
  { phone: '90000001', name: '陳黃金', tier: 'gold' },
  { phone: '90000002', name: '林白金', tier: 'platinum' },
  { phone: '90000003', name: '黃普通', tier: 'normal' },
  { phone: '90000004', name: '吳非會員', tier: 'none' },
]

async function cleanupTestDrivers() {
  console.log('🧹 清理舊的測試司機...')
  for (const driver of TEST_DRIVERS) {
    const fullPhone = `+852${driver.phone}`
    const altPhone1 = `852${driver.phone}`
    const altPhone2 = driver.phone

    // 1. 先找 auth.users（用 phone 匹配）
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
    const found = users.find(u => u.phone === fullPhone || u.phone === altPhone1 || u.phone === altPhone2)

    if (found) {
      // 2. 先刪 public.users（會通過 CASCADE 刪 driver_info）
      await supabaseAdmin.from('users').delete().eq('id', found.id)

      // 3. 再刪 auth.users
      await supabaseAdmin.auth.admin.deleteUser(found.id)
      console.log(`    🗑️ 刪除: ${driver.name} (auth: ${found.phone})`)
    } else {
      // 保險起見，清理可能的 public.users 殘留
      await supabaseAdmin.from('users').delete().eq('phone', driver.phone)
    }
  }
  console.log('  ✅ 清理完成\n')
}

async function createOrUpdateDriver(driver) {
  // phone 字段（格式 +852 + 8位本地電話）
  const fullPhone = `+852${driver.phone}`

  // 先查詢是否已存在（從 public.users）
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id, phone')
    .eq('phone', driver.phone)
    .single()

  let userId
  if (existing) {
    userId = existing.id
    console.log(`  ✓ 用戶已存在: ${driver.name} (${userId})`)
  } else {
    // 1. 用 phone 字段創建 auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      phone: fullPhone,
      password: 'test123456',
      phone_confirm: true,
      user_metadata: { role: 'driver', name: driver.name }
    })

    if (authError) {
      console.error(`  ✗ 創建 auth 用戶失敗: ${driver.name}`, authError.message)
      return null
    }
    userId = authUser.user.id
    console.log(`  ✓ 創建 auth 用戶: ${driver.name}`)

    // 2. 同步創建 public.users 記錄（FK 到 auth.users）
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        phone: driver.phone,
        name: driver.name,
        role: 'driver'
      })

    if (userError) {
      console.error(`  ✗ 創建 public.users 失敗:`, userError.message)
      // 回滾：刪除 auth user
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return null
    }
  }

  // 3. 更新/創建司機資料（設置會員等級）到 driver_info 表
  const { error: driverError } = await supabaseAdmin
    .from('driver_info')
    .upsert({
      id: userId,
      vehicle_plate: `TEST-${driver.phone.slice(-4)}`,
      vehicle_model: 'Toyota Alphard',
      driving_years: 5,
      total_orders: 0,
      rating: 5.0,
      membership_tier: driver.tier
    })

  if (driverError) {
    console.error(`  ✗ 更新司機失敗: ${driver.name}`, driverError.message)
    return null
  }

  console.log(`  ✅ 會員等級已設置: ${driver.name} → ${driver.tier}`)
  return userId
}

async function createTestOrder() {
  console.log('\n📦 模擬乘客下單...')
  const orderData = {
    direction: 'hk_to_mainland',
    pickupLocation: '香港中環 IFC',
    pickupArea: '中環',
    dropoffLocation: '深圳福田口岸',
    dropoffArea: '福田',
    departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    passengers: 4,
    luggage: 2,
    vehicleType: '7_seat',
    isCharter: false,
    hasChild: false,
    passengerName: '測試乘客',
    passengerPhone: '13800138000',
    passengerNotes: '【測試訂單】會員分級推送',
    estimatedFare: 500,
    serviceType: 'cross_border'
  }

  try {
    const res = await fetch(`${PASSENGER_URL}/api/orders/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    })

    const data = await res.json()

    if (!data.success) {
      console.error('  ✗ 下單失敗:', data.error || data.message)
      return null
    }

    console.log(`  ✅ 訂單創建成功: ${data.order.orderNumber}`)
    return data.order
  } catch (err) {
    console.error('  ✗ 下單請求失敗:', err.message)
    return null
  }
}

async function testAvailableOrders(driver, userId) {
  console.log(`\n🔍 ${driver.name} (${driver.tier}) 查詢可搶訂單...`)

  try {
    // 1. 真實 Supabase 登入：拿到 session 的真實 cookie
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 注意：admin client 沒法 signInWithPassword；用 anon key 客戶端登入
    const anonClient = createClient(
      SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    if (!process.env.SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.log('  ⚠️ 缺少 SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY，無法登入')
      return
    }

    const fullPhone = `+852${driver.phone}`
    const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
      phone: fullPhone,
      password: 'test123456'
    })

    if (signInErr || !signInData?.session) {
      console.log(`  ⚠️ 登入失敗: ${signInErr?.message || 'no session'}`)
      return
    }

    // 2. 構造真實的 sb-{ref}-auth-token cookie
    const session = signInData.session
    const sessionData = JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: 'Bearer'
    })
    const projectRef = SUPABASE_URL.split('//')[1]?.split('.')[0]
    const cookieHeader = `sb-${projectRef}-auth-token=${encodeURIComponent(sessionData)}`

    const res = await fetch(`${DRIVER_URL}/api/driver/available-orders`, {
      headers: { Cookie: cookieHeader }
    })

    if (res.status === 401) {
      console.log(`  ⚠️ 未登入`)
      return
    }
    if (res.status === 403) {
      console.log(`  ⚠️ 權限不足`)
      return
    }

    const data = await res.json()

    if (!data.success) {
      console.log(`  ⚠️ 查詢失敗: ${data.error}`)
      return
    }

    console.log(`  會員等級: ${data.tier}`)
    console.log(`  可搶訂單: ${data.count || 0} 個`)

    if (data.tier === 'none') {
      console.log(`  ❌ 非會員不接收站內推送`)
    } else if (data.orders && data.orders.length > 0) {
      data.orders.slice(0, 3).forEach(o => {
        console.log(`  ✅ ${o.order_number}: 可搶`)
      })
    }
  } catch (err) {
    console.log(`  ❌ 請求失敗: ${err.message}`)
  }
}

async function main() {
  console.log('═══════════════════════════════════════')
  console.log('   🧪 會員分級推送測試')
  console.log('═══════════════════════════════════════')

  // 清理舊的測試司機（避免 auth.users 衝突）
  await cleanupTestDrivers()

  console.log('\n📋 步驟 1: 創建/更新 4 個測試司機帳號')
  const driverIds = {}
  for (const driver of TEST_DRIVERS) {
    const uid = await createOrUpdateDriver(driver)
    if (uid) driverIds[driver.phone] = uid
  }

  // Guard: 必須每個司機都拿到 id 才能繼續（否則後續登入會 fail）
  for (const driver of TEST_DRIVERS) {
    if (!driverIds[driver.phone]) {
      throw new Error(`no id for ${driver.phone} (${driver.name})`)
    }
  }

  console.log('\n📋 步驟 2: 模擬乘客下單')
  const order = await createTestOrder()

  if (!order) {
    console.log('\n⚠️ 乘客端未啟動或下單失敗')
    console.log('請確認 http://localhost:3000 可訪問')
    process.exit(1)
  }

  console.log('\n📋 步驟 3: 立即查詢（剛下單 0 秒）')
  for (const driver of TEST_DRIVERS) {
    await testAvailableOrders(driver, driverIds[driver.phone])
  }

  console.log('\n📋 步驟 4: 等待 65 秒（讓白金會員也能搶）')
  console.log('  （腳本將 sleep 65 秒...）')
  await new Promise(r => setTimeout(r, 65000))

  for (const driver of TEST_DRIVERS) {
    await testAvailableOrders(driver, driverIds[driver.phone])
  }

  console.log('\n═══════════════════════════════════════')
  console.log('  測試完成！')
  console.log('═══════════════════════════════════════')
  console.log('\n測試司機（public.users / driver_info）：')
  TEST_DRIVERS.forEach(d => {
    console.log(`  ${d.tier.padEnd(10)} → 電話 ${d.phone} (${d.name})`)
  })
  console.log('\n⚠️ 這些用戶沒創建 auth.users，所以無法登入')
  console.log('   如需登入測試，用真實的註冊流程創建帳號')
}

main().catch(console.error)
