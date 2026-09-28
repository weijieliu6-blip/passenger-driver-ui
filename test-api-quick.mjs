// 簡單測試：檢查 API 是否正常

const BASE = 'http://localhost:3000'

async function test(name, path, options = {}) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    })
    const data = await res.json().catch(() => ({}))
    console.log(`${name.padEnd(50)} | ${res.status} | ${data.success !== false ? '✅' : '❌'} ${data.message || data.error || ''}`)
    return { status: res.status, data, ok: res.ok }
  } catch (err) {
    console.log(`${name.padEnd(50)} | ❌ ${err.message}`)
    return null
  }
}

async function main() {
  console.log('=== API 端點測試 ===\n')

  // 1. 司機註冊
  const driverEmail = `driver_${Date.now()}@test.com`
  console.log('Step 1: 司機註冊')
  const regRes = await test('POST /api/auth/register (driver)', '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      method: 'email',
      email: driverEmail,
      password: 'test1234',
      name: '測試司機',
      role: 'driver'
    })
  })

  // 2. 乘客註冊
  const passengerEmail = `passenger_${Date.now()}@test.com`
  console.log('\nStep 2: 乘客註冊')
  await test('POST /api/auth/register (passenger)', '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      method: 'email',
      email: passengerEmail,
      password: 'test1234',
      name: '測試乘客',
      role: 'passenger'
    })
  })

  // 3. 乘客下單
  console.log('\nStep 3: 乘客下單')
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const orderRes = await test('POST /api/orders/create', '/api/orders/create', {
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
      passengerNotes: 'API 測試',
      estimatedFare: 600
    })
  })

  if (!orderRes?.data.success) {
    console.log('\n❌ 下單失敗，終止測試')
    return
  }

  const orderNumber = orderRes.data.order.orderNumber
  console.log(`\n訂單號: ${orderNumber}`)

  // 4. 查詢訂單詳情
  console.log('\nStep 4: 查詢訂單詳情')
  const orderDetailRes = await test(`GET /api/orders/${orderNumber}`, `/api/orders/${orderNumber}`)

  if (orderDetailRes?.data.success && orderDetailRes.data.order.grab_token) {
    const grabToken = orderDetailRes.data.order.grab_token

    // 5. 直接測試 rebook（訂單還沒取消，先取消）
    // 先取消訂單
    console.log('\nStep 5: 取消訂單（為 rebook 測試）')
    const cancelRes = await test(`PUT /api/orders/${orderNumber}/cancel`, `/api/orders/${orderNumber}/cancel`, {
      method: 'PUT'
    })

    if (cancelRes?.data.success) {
      console.log('\nStep 6: 重新預約 API')
      await test(`POST /api/orders/${orderNumber}/rebook`, `/api/orders/${orderNumber}/rebook`, {
        method: 'POST'
      })
    }
  }

  console.log('\n=== 測試完成 ===')
}

main().catch(err => {
  console.error('測試異常:', err)
})
