// 測試修改訂單 API
const orderData = {
  departure_time: '2026-09-26T10:30:00+08:00',  // 改時間
  passengers: 4,                                 // 改人數
  luggage: 5,                                    // 改行李
  vehicle_type: '8_seat',                          // 改車型
  passenger_notes: '已修改 - 通過 API 測試',
  has_child: false,                               // 移除孩童
  child_type: null,
  is_charter: true                                // 改為包車
}

try {
  const res = await fetch('http://localhost:3000/api/orders/ORD20260919004/edit', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  })
  
  const data = await res.json()
  console.log('修改訂單結果:')
  console.log('狀態碼:', res.status)
  console.log(JSON.stringify(data, null, 2))
  
  // 再次查詢訂單確認修改
  console.log('\n查詢訂單確認修改:')
  const check = await fetch('http://localhost:3000/api/orders/ORD20260919004')
  const order = await check.json()
  console.log('車型:', order.order.vehicle_type)
  console.log('人數:', order.order.passengers)
  console.log('行李:', order.order.luggage)
  console.log('時間:', order.order.departure_time)
  console.log('包車:', order.order.is_charter)
  console.log('孩童:', order.order.has_child)
  console.log('備註:', order.order.passenger_notes)
} catch (err) {
  console.error('錯誤:', err.message)
}
