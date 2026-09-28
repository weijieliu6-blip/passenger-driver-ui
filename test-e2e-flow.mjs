// 端到端測試：完整訂單流程
// 1. 乘客下單
// 2. 司機註冊登入
// 3. 司機搶單
// 4. 司機確認價格
// 5. 乘客查詢訂單詳情（含司機資料和確認價格）

const BASE = 'http://localhost:3000'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })
  const data = await res.json()
  return { status: res.status, data }
}

async function testPassengerFlow() {
  console.log('\n=== 測試 1：乘客註冊並下單 ===')

  // 1. 乘客註冊
  const passengerEmail = `passenger_${Date.now()}@test.com`
  let res = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      method: 'email',
      email: passengerEmail,
      password: 'test1234',
      name: '測試乘客',
      role: 'passenger'
    })
  })
  console.log('註冊狀態:', res.status, '|', res.data.message)
  if (!res.data.success) {
    console.log('錯誤:', res.data)
    return null
  }

  const passengerCookies = res.headers?.getSetCookie?.() || []

  // 2. 乘客下單
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  res = await request('/api/orders/create', {
    method: 'POST',
    body: JSON.stringify({
      direction: 'to_mainland',
      pickupLocation: '九龍',
      pickupArea: '尖沙咀',
      dropoffLocation: '深圳',
      dropoffArea: '福田口岸',
      departureTime: tomorrow.toISOString(),
      passengers: 3,
      luggage: 2,
      vehicleType: '7_seat',
      isCharter: false,
      hasChild: false,
      passengerName: '測試乘客',
      passengerPhone: '91234567',
      passengerNotes: '測試訂單',
      estimatedFare: 600
    })
  })
  console.log('下單狀態:', res.status, '|', res.data.message)
  console.log('訂單號:', res.data.order?.orderNumber)

  return res.data.order?.orderNumber
}

async function testDriverRegisterAndLogin() {
  console.log('\n=== 測試 2：司機註冊 + 登入 ===')

  // 1. 司機註冊
  const driverEmail = `driver_${Date.now()}@test.com`
  let res = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      method: 'email',
      email: driverEmail,
      password: 'test1234',
      name: '陳師傅',
      role: 'driver'
    })
  })

  if (!res.data.success) {
    console.log('司機註冊失敗:', res.data.message)
    // 嘗試登入
    res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: driverEmail,
        password: 'test1234'
      })
    })
  }

  console.log('司機狀態:', res.status, '|', res.data.message)
  console.log('司機角色:', res.data.user?.role)

  // 2. 設置司機車牌（直接更新 database）
  if (res.data.user?.id) {
    // 用 supabase admin 直接更新
    const supabaseUrl = 'https://vuuamydahzhpajjdvokl.supabase.co'
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (serviceRoleKey) {
      // 更新 driver_info 記錄
      const { createClient } = await import('@supabase/supabase-js')
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })

      // 創建 driver_info 記錄
      await admin.from('driver_info').upsert({
        id: res.data.user.id,
        vehicle_plate: '粵B12345',
        vehicle_model: 'Toyota Alphard',
        driving_years: 5,
        rating: 5.0,
        total_orders: 0
      })

      console.log('✅ 已設置司機車牌和資料')
    }
  }

  // 返回登入後的 cookies
  return res
}

async function testDriverGrabAndPrice(orderNumber, driverCookies) {
  console.log('\n=== 測試 3：司機搶單並確認價格 ===')

  // 1. 查詢訂單 grab_token
  let res = await request(`/api/orders/${orderNumber}`)
  if (!res.data.success) {
    console.log('查詢訂單失敗')
    return false
  }

  const grabToken = res.data.order.grab_token
  console.log('訂單狀態:', res.data.order.status, '| grab_token:', grabToken?.slice(0, 10) + '...')

  // 2. 司機搶單（POST /api/grab/[token]）
  res = await fetch(`${BASE}/api/grab/${grabToken}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: driverCookies?.join('; ') || ''
    }
  })
  const grabData = await res.json()
  console.log('搶單狀態:', res.status, '|', grabData.message)
  console.log('訂單狀態:', grabData.order?.orderNumber)

  if (!grabData.success) return false

  // 3. 司機確認價格
  res = await fetch(`${BASE}/api/driver/orders/${orderNumber}/confirm-price`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: driverCookies?.join('; ') || ''
    },
    body: JSON.stringify({
      confirmed_price: 580,
      price_currency: 'HKD',
      vehicle_model: 'Toyota Alphard',
      driving_years: 5
    })
  })
  const priceData = await res.json()
  console.log('確認價格:', res.status, '|', priceData.message)
  console.log('已確認價格:', priceData.order?.confirmedPrice, priceData.order?.priceCurrency)

  return priceData.success
}

async function testPassengerViewsOrder(orderNumber) {
  console.log('\n=== 測試 4：乘客查詢訂單詳情（含司機信息和確認價格）===')

  const res = await request(`/api/orders/${orderNumber}`)
  if (!res.data.success) {
    console.log('查詢失敗:', res.data.message)
    return false
  }

  const order = res.data.order
  console.log('訂單狀態:', order.status)
  console.log('司機姓名:', order.driver?.name)
  console.log('司機車輛:', order.driver?.vehicleModel)
  console.log('司機駕齡:', order.driver?.drivingYears, '年')
  console.log('司機評分:', order.driver?.rating)
  console.log('確認價格:', order.confirmed_price, order.price_currency)
  console.log('價格確認時間:', order.price_confirmed_at)

  return true
}

async function testDriverPublicProfile(driverId) {
  console.log('\n=== 測試 5：乘客查詢司機公開資料 ===')

  const res = await request(`/api/drivers/${driverId}`)
  if (!res.data.success) {
    console.log('查詢失敗:', res.data.message)
    return false
  }

  const d = res.data.driver
  console.log('司機姓名:', d.name)
  console.log('電話遮蔽:', d.maskedPhone)
  console.log('車牌:', d.vehiclePlate)
  console.log('車型:', d.vehicleModel)
  console.log('駕齡:', d.drivingYears, '年')
  console.log('評分:', d.rating)
  console.log('接單數:', d.totalOrders)
  console.log('評價數:', reviews?.length || 0)
  console.log('會員等級:', d.membershipTier)

  return true
}

async function testRebook(originalOrderNumber, passengerCookies) {
  console.log('\n=== 測試 6：取消訂單並重新預約 ===')

  // 1. 取消訂單
  let res = await fetch(`${BASE}/api/orders/${originalOrderNumber}/cancel`, {
    method: 'PUT',
    headers: {
      cookie: passengerCookies?.join('; ') || ''
    }
  })
  let data = await res.json()
  console.log('取消狀態:', res.status, '|', data.message)

  if (!data.success) {
    console.log('取消失敗，跳過 rebook 測試')
    return
  }

  // 2. 重新預約
  res = await fetch(`${BASE}/api/orders/${originalOrderNumber}/rebook`, {
    method: 'POST',
    headers: {
      cookie: passengerCookies?.join('; ') || ''
    }
  })
  data = await res.json()
  console.log('重新預約:', res.status, '|', data.message)

  if (data.success) {
    console.log('✅ 準備好重新預約數據：')
    console.log('  - 出發地:', data.bookingData.pickupLocation)
    console.log('  - 目的地:', data.bookingData.dropoffLocation)
    console.log('  - 乘客人數:', data.bookingData.passengers)
    console.log('  - 車型:', data.bookingData.vehicleType)
  }
}

async function main() {
  // 1. 乘客下單
  const orderNumber = await testPassengerFlow()
  if (!orderNumber) {
    console.log('\n❌ 乘客流程失敗，終止測試')
    return
  }

  // 2. 司機註冊登入
  const driverLoginRes = await testDriverRegisterAndLogin()
  if (!driverLoginRes.data.success) {
    console.log('\n❌ 司機登入失敗，終止測試')
    return
  }
  const driverId = driverLoginRes.data.user.id
  const driverCookies = driverLoginRes.headers?.getSetCookie?.() || []

  // 3. 司機搶單 + 確認價格
  const grabSuccess = await testDriverGrabAndPrice(orderNumber, driverCookies)
  if (!grabSuccess) {
    console.log('\n❌ 司機搶單/報價失敗')
    return
  }

  // 4. 乘客查詢訂單
  await testPassengerViewsOrder(orderNumber)

  // 5. 乘客查詢司機資料
  await testDriverPublicProfile(driverId)

  // 6. 測試 rebook
  await testRebook(orderNumber, [])

  console.log('\n\n🎉 端到端測試完成！')
}

main().catch(err => {
  console.error('測試異常:', err)
  process.exit(1)
})
