// 直接查詢數據庫看 phone 98765002 是否存在
const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(
  'https://vuuamydahzhpajjdvokl.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data: users, error } = await supabase
  .from('users')
  .select('*')
  .or('phone.eq.98765000,phone.eq.98765001,phone.eq.98765002,phone.eq.98765030')
  
console.log('查詢結果:')
console.log(JSON.stringify(users, null, 2))
console.log('錯誤:', error)
