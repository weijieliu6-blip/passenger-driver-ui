// 清理測試用戶（admin API）
// 由於 service_role_key 可以管理用戶，但我們這裡直接從 auth.users 刪除

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(
  'https://vuuamydahzhpajjdvokl.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// 列出所有 phone_* 用戶
const { data: users } = await supabase.auth.admin.listUsers()
console.log('所有用戶:')
users.users.forEach(u => {
  console.log(`- ${u.email} | ${u.phone || 'no phone'} | ${u.id}`)
})
