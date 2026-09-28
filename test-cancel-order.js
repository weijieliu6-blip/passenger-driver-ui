// 創建一個新訂單用於取消測試
const orderData = {
  direction: 'hk_to_mainland',
  serviceType: 'cross_border',
  pickupLocation: '港島',
  pickupArea: '中西區',
  dropoffLocation: '汕尾',
  dropoffArea: '陸豐市',
  departureTime: '2026-09-27T18:00:00+08:00',
  passengers: 3,
  luggage: 2,
  vehicleType: '7_seat',
  isCharter: false,
  hasChild: false,
  childType: null,
  passengerName: 'TestCancel',
  passengerPhone: '91234568',
  passengerNotes: '這個訂單是用來測試取消功能的'
}

const res = await fetch('http://localhost:3000/api/orders/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(orderData)
})

const data = await res.json()
console.log('創建訂單結果:')
console.log(JSON.stringify(data, null, 2))

if (data.order?.orderNumber) {
  // 立即取消
  console.log('\n=== 測試取消訂單 ===')
  const cancelRes = await fetch(`http://localhost:3000/api/orders/${data.order.orderNumber}/cancel`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  })
  
  const cancelData = await cancelRes.json()
  console.log('取消結果:', cancelRes.status)
  console.log(JSON.stringify(cancelData, null, 2))
  
  // 確認訂單狀態
  console.log('\n=== 確認訂單狀態 ===')
  const check = await fetch(`http://localhost:3000/api/orders/${data.order.orderNumber}`)
  const order = await check.json()
  console.log('狀態:', order.order.status)
  console.log('取消時間:', order.order.cancelled_at)
}
