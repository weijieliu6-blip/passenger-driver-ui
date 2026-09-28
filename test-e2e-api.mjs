// 直接測試 API（不需要瀏覽器）
const BASE = 'http://localhost:3000'
let driverCookie = ''
let passengerCookie = ''

function extractCookies(headers) {
  // Set-Cookie headers need to be concatenated
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie().join('; ')
  }
  return ''
}

async function test(name, path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    redirect: 'manual'
  })

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text.slice(0, 200) }
  }

  return { status: res.status, data, headers: res.headers }
}

async function main() {
  console.log('\n=== Step 1: 司機註冊 ===')
  const driverEmail = `driver_${Date.now()}@test.com`
  let res = await test('/api/auth/register', '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      method: 'email',
      email: driverEmail,
      password: 'test1234',
      name: '測試司機',
      role: 'driver'
    })
  })
  console.log(`Status: ${res.status}`)
  console.log(`Result:`, res.data)
  driverCookie = extractCookies(res.headers)
  console.log(`Cookie set: ${driverCookie ? 'Yes' : 'No'}`)

  if (!res.data.success) {
    console.log('❌ 司機註冊失敗')
    return
  }
  const driverId = res.data.user.id

  console.log('\n=== Step 2: 乘客註冊 ===')
  const passengerEmail = `passenger_${Date.now()}@test.com`
  res = await test('/api/auth/register', '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      method: 'email',
      email: passengerEmail,
      password: 'test1234',
      name: '測試乘客',
      role: 'passenger'
    })
  })
  console.log(`Status: ${res.status}`)
  console.log(`Result:`, res.data)
  passengerCookie = extractCookies(res.headers)

  if (!res.data.success) {
    console.log('❌ 乘客註冊失敗')
    return
  }

  console.log('\n=== Step 3: 乘客下單 ===')
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  res = await test('/api/orders/create', '/api/orders/create', {
    method: 'POST',
    headers: { cookie: passengerCookie },
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
      passengerNotes: 'API 測試訂單',
      estimatedFare: 600
    })
  })
  console.log(`Status: ${res.status}`)
  console.log(`Result:`, res.data)

  if (!res.data.success) {
    console.log('❌ 下單失敗')
    return
  }
  const orderNumber = res.data.order.order_number

  console.log(`\n=== Step 4: 司機查詢訂單詳情 ===`)
  res = await test(`/api/orders/${orderNumber}`, `/api/orders/${orderNumber}`, {
    method: 'GET',
    headers: { cookie: driverCookie }
  })
  console.log(`Status: ${res.status}`)
  console.log(`Status: ${res.data.order?.status}`)
  console.log(`Order Number: ${res.data.order?.order_number}`)
  console.log(`grab_token: ${res.data.order?.grab_token?.slice(0, 20)}...`)

  if (!res.data.success) {
    console.log('❌ 訂單查詢失敗')
    return
  }

  const grabToken = res.data.order.grab_token

  console.log(`\n=== Step 5: 司機搶單 ===`)
  res = await test(`/api/grab/${grabToken}`, `/api/grab/${grabToken}`, {
    method: 'POST',
    headers: { cookie: driverCookie }
  })
  console.log(`Status: ${res.status}`)
  console.log(`Result:`, res.data.message || res.data)

  if (!res.data.success) {
    console.log('❌ 搶單失敗')
    return
  }

  console.log(`\n=== Step 6: 司機確認價格 ===`)
  res = await test(`/api/driver/orders/${orderNumber}/confirm-price`, `/api/driver/orders/${orderNumber}/confirm-price`, {
    method: 'POST',
    headers: { cookie: driverCookie },
    body: JSON.stringify({
      confirmed_price: 580,
      price_currency: 'HKD',
      vehicle_model: 'Toyota Alphard',
      driving_years: 5
    })
  })
  console.log(`Status: ${res.status}`)
  console.log(`Result:`, res.data)
  console.log(`Order status: ${res.data.order?.status}`)
  console.log(`Confirmed price: ${res.data.order?.confirmedPrice} ${res.data.order?.priceCurrency}`)

  console.log(`\n=== Step 7: 乘客查看訂單詳情（含司機信息）===")
  res = await test(`/api/orders/${orderNumber}`, `/api/orders/${orderNumber}`, {
    method: 'GET',
    headers: { cookie: passengerCookie }
  })
  console.log(`Status: ${res.status}`)
  console.log(`Order status: ${res.data.order?.status}`)
  console.log(`Confirmed price: ${res.data.order?.confirmed_price} ${res.data.order?.price_currency}`)
  console.log(`Driver:`, res.data.order?.driver)

  console.log(`\n=== Step 8: 乘客查看司機公開資料 ===`)
  res = await test(`/api/drivers/${driverId}`, `/api/drivers/${driverId}`, {
    method: 'GET'
  })
  console.log(`Status: ${res.status}`)
  console.log(`Driver name: ${res.data.driver?.name}`)
  console.log(`Masked phone: ${res.data.driver?.maskedPhone}`)
  console.log(`Vehicle: ${res.data.driver?.vehicleModel} (${res.data.driver?.vehiclePlate})`)
  console.log(`Driving years: ${res.data.driver?.drivingYears}`)
  console.log(`Rating: ${res.data.driver?.rating}`)
  console.log(`Reviews count: ${res.data.reviews?.length || 0}`)

  console.log(`\n=== Step 9: 取消訂單 ===`)
  res = await test(`/api/orders/${orderNumber}/cancel`, `/api/orders/${orderNumber}/cancel`, {
    method: 'PUT',
    headers: { cookie: passengerCookie }
  })
  console.log(`Status: ${res.status}`)
  console.log(`Result:`, res.data)

  console.log(`\n=== Step 10: 重新預約 ===`)
  res = await test(`/api/orders/${orderNumber}/rebook`, `/api/orders/${orderNumber}/rebook`, {
    method: 'POST',
    headers: { cookie: passengerCookie }
  })
  console.log(`Status: ${res.status}`)
  console.log(`Result:`, res.data.message || res.data)
  if (res.data.success) {
    console.log(`Booking data:`)
    console.log(`  - Pickup: ${res.data.bookingData.pickupLocation} ${res.data.bookingData.pickupArea}`)
    console.log(`  - Dropoff: ${res.data.bookingData.dropoffLocation} ${res.data.bookingData.dropoffArea}`)
    console.log(`  - Passengers: ${res.data.bookingData.passengers}`)
    console.log(`  - Vehicle: ${res.data.bookingData.vehicleType}`)
  }

  console.log('\n=== 端到端測試完成 ===')
}

main().catch(err => {
  console.error('測試異常:', err)
})
