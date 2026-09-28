// 測試手機號碼註冊 API
const registerData = {
  method: 'phone',
  phone: '98765003',
  password: 'testpass123',
  name: '手機測試用戶'
}

console.log('=== 測試 1: 手機號碼註冊 ===')
const res = await fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(registerData)
})

const data = await res.json()
console.log('狀態碼:', res.status)
console.log(JSON.stringify(data, null, 2))

if (data.success && data.user?.phone === '98765432') {
  console.log('\n=== 測試 2: 用手機號碼登入 ===')
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: '98765003',
      password: 'testpass123'
    })
  })
  
  const loginData = await loginRes.json()
  console.log('狀態碼:', loginRes.status)
  console.log(JSON.stringify(loginData, null, 2))
}
