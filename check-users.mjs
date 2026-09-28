// 直接查詢數據庫看 phone 98765002 是否存在
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://vuuamydahzhpajjdvokl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1dWFteWRhaHpocGFqamR2b2tsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTcxMTA3OSwiZXhwIjoyMTA1Mjg3MDc5fQ.rwVb5sO9AGR8SQSsZsw1INpKIKOLr1Nw8y6aBfVDVEo',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const phonesToCheck = ['98765000', '98765001', '98765002', '98765030', '98765430', '98765432']
const { data: users, error } = await supabase
  .from('users')
  .select('id, name, phone, role, register_method, created_at')
  .in('phone', phonesToCheck)
  
console.log('查詢結果:')
console.log(JSON.stringify(users, null, 2))
console.log('錯誤:', error?.message || '無')

// 列出所有 public.users
const { data: allUsers } = await supabase
  .from('users')
  .select('id, name, phone, role, register_method, created_at')
  .order('created_at', { ascending: false })
  .limit(20)
console.log('\n=== 最近的 20 個 public.users ===')
console.log(JSON.stringify(allUsers, null, 2))
