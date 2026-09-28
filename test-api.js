// 测试订单创建 API
const testOrder = {
  direction: 'to_mainland',
  pickupLocation: '香港國際機場',
  dropoffLocation: '深圳灣口岸',
  departureTime: '2026-09-20T10:00:00',
  passengers: 2,
  luggage: 1,
  vehicleType: '4_seat',
  isCharter: false,
  hasChild: false,
  passengerPhone: '12345678',
  passengerName: '测试用户'
}

console.log('📤 发送测试订单...')
console.log(JSON.stringify(testOrder, null, 2))

fetch('http://localhost:3000/api/orders/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(testOrder)
})
  .then(res => res.json())
  .then(data => {
    console.log('\n✅ 响应结果：')
    console.log(JSON.stringify(data, null, 2))
  })
  .catch(err => {
    console.error('\n❌ 错误：', err.message)
  })
