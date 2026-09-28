// 創建測試訂單
const orderData = {
  direction: 'hk_to_mainland',
  serviceType: 'cross_border',
  pickupLocation: '新界',
  pickupArea: '沙田區',
  dropoffLocation: '汕尾',
  dropoffArea: '海豐縣',
  departureTime: '2026-09-25T14:00:00+08:00',
  passengers: 2,
  luggage: 3,
  vehicleType: '7_seat',
  isCharter: false,
  hasChild: true,
  childType: 'over_3',
  passengerName: 'TestEdit',
  passengerPhone: '91234568',
  passengerNotes: '測試修改訂單功能'
}

try {
  const res = await fetch('http://localhost:3000/api/orders/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  })
  
  const data = await res.json()
  console.log('創建訂單結果:')
  console.log(JSON.stringify(data, null, 2))
  console.log('\n訂單號: ' + (data.order?.orderNumber || 'N/A'))
} catch (err) {
  console.error('錯誤:', err.message)
}
