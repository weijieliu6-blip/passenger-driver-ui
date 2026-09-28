// 測試錯誤格式
console.log('=== 測試 1: 無效電話號碼（首位不是5/6/7/8/9）===')
let res = await fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'phone',
    phone: '12345678',
    password: 'testpass123',
    name: '錯誤號碼測試'
  })
})
let data = await res.json()
console.log('狀態碼:', res.status, '|', data.message)

console.log('\n=== 測試 2: 電話號碼太短 ===')
res = await fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'phone',
    phone: '98765',
    password: 'testpass123',
    name: '太短測試'
  })
})
data = await res.json()
console.log('狀態碼:', res.status, '|', data.message)

console.log('\n=== 測試 3: 密碼太短 ===')
res = await fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'phone',
    phone: '98765005',
    password: '123',
    name: '短密碼測試'
  })
})
data = await res.json()
console.log('狀態碼:', res.status, '|', data.message)

console.log('\n=== 測試 4: 帶空格的電話 ===')
res = await fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'phone',
    phone: '9876 5050',
    password: 'testpass123',
    name: '空格測試'
  })
})
data = await res.json()
console.log('狀態碼:', res.status, '|', data?.message || data?.user?.phone)

console.log('\n=== 測試 5: 電郵格式錯誤 ===')
res = await fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'email',
    email: 'not-an-email',
    password: 'testpass123',
    name: '錯誤電郵'
  })
})
data = await res.json()
console.log('狀態碼:', res.status, '|', data.message)
