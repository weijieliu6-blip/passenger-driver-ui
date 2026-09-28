// 列出所有 auth.users 中電話註冊的用戶，但 public.users 中沒有的
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://vuuamydahzhpajjdvokl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1dWFteWRhaHpocGFqamR2b2tsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTcxMTA3OSwiZXhwIjoyMTA1Mjg3MDc5fQ.rwVb5sO9AGR8SQSsZsw1INpKIKOLr1Nw8y6aBfVDVEo',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// 列出所有 auth.users
const { data: authData } = await supabase.auth.admin.listUsers()
console.log('=== auth.users ===')
authData.users.forEach(u => {
  const isPhoneUser = u.email?.startsWith('phone_')
  console.log(`${isPhoneUser ? '📱' : '📧'} ${u.email} | phone: ${u.phone || 'N/A'} | id: ${u.id.substring(0, 8)}...`)
})

console.log('\n=== public.users ===')
const { data: publicUsers } = await supabase
  .from('users')
  .select('id, name, phone, role')
  .order('created_at', { ascending: false })
publicUsers?.forEach(u => {
  console.log(`${u.role} | ${u.name} | phone: ${u.phone} | id: ${u.id.substring(0, 8)}...`)
})

console.log('\n=== 對比：只有 auth.users 沒 public.users ===')
const authIds = new Set(authData.users.map(u => u.id))
const publicIds = new Set(publicUsers?.map(u => u.id) || [])
const orphans = authData.users.filter(u => !publicIds.has(u.id))
console.log(`孤兒用戶數: ${orphans.length}`)
orphans.forEach(u => {
  console.log(`  - ${u.email} | phone: ${u.phone || 'N/A'} | id: ${u.id}`)
})
