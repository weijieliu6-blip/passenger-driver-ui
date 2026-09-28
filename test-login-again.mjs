// 嘗試登入 98765002
const res = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    identifier: '98765002',
    password: 'testpass123'
  })
})

const data = await res.json()
console.log('狀態碼:', res.status)
console.log(JSON.stringify(data, null, 2))
