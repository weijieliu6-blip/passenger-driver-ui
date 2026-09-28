// 完整測試兩地區註冊/登入

console.log('=== 測試 1: 內地手機號註冊 ===')
let res = await fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'phone',
    region: 'mainland',
    phone: '13800138001',
    password: 'testpass123',
    name: '內地測試用戶'
  })
})
let data = await res.json()
console.log('狀態碼:', res.status)
console.log(JSON.stringify(data, null, 2))

if (data.success) {
  console.log('\n=== 測試 2: 用內地號碼登入（純號碼） ===')
  let loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: '13800138001',
      password: 'testpass123'
    })
  })
  console.log('狀態碼:', loginRes.status)
  console.log(JSON.stringify(await loginRes.json(), null, 2))

  console.log('\n=== 測試 3: 用 +86 前綴登入 ===')
  loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: '+8613800138001',
      password: 'testpass123'
    })
  })
  console.log('狀態碼:', loginRes.status)
  console.log(JSON.stringify(await loginRes.json(), null, 2))
}

console.log('\n=== 測試 4: 香港手機號註冊 ===')
res = await fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'phone',
    region: 'hk',
    phone: '98765010',
    password: 'testpass123',
    name: '香港測試用戶'
  })
})
data = await res.json()
console.log('狀態碼:', res.status)
console.log(JSON.stringify(data, null, 2))

console.log('\n=== 測試 5: 用 +852 前綴登入 ===')
res = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    identifier: '+85298765010',
    password: 'testpass123'
  })
})
data = await res.json()
console.log('狀態碼:', res.status)
console.log(JSON.stringify(data, null, 2))

console.log('\n=== 測試 6: 無效內地號碼 ===')
res = await fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'phone',
    region: 'mainland',
    phone: '23800138001',  // 首位 2 不合法
    password: 'testpass123',
    name: '錯誤號碼'
  })
})
data = await res.json()
console.log('狀態碼:', res.status, '|', data.message)
