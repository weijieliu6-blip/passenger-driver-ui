// 再次查詢訂單詳情（重新調用）
console.log('=== 第一次查詢 ===')
let res = await fetch('http://localhost:3000/api/orders/ORD20260919004', {
  cache: 'no-store',
  headers: { 'Cache-Control': 'no-cache' }
})
let data = await res.json()
console.log('備註:', data.order.passenger_notes)

console.log('\n=== 等待 2 秒後第二次查詢 ===')
await new Promise(r => setTimeout(r, 2000))
res = await fetch('http://localhost:3000/api/orders/ORD20260919004', {
  cache: 'no-store',
  headers: { 'Cache-Control': 'no-cache' }
})
data = await res.json()
console.log('備註:', data.order.passenger_notes)
console.log('時間:', data.order.departure_time)
