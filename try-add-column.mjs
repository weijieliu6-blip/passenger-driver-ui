// 嘗試直接 ALTER TABLE 添加 register_method 字段
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://vuuamydahzhpajjdvokl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1dWFteWRhaHpocGFqamR2b2tsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTcxMTA3OSwiZXhwIjoyMTA1Mjg3MDc5fQ.rwVb5sO9AGR8SQSsZsw1INpKIKOLr1Nw8y6aBfVDVEo',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// 用 rpc 嘗試執行 SQL
const sql = `
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS register_method TEXT DEFAULT 'email';
`

const { data, error } = await supabase.rpc('exec_sql', { sql })
console.log('結果:', data, error?.message || '無錯誤')
