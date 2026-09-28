// 查 Supabase 實際的表結構
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://vuuamydahzhpajjdvokl.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  // 查所有 public 表
  const { data, error } = await supabase
    .rpc('exec_sql', { sql: `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `})
    .then(r => r)
    .catch(async () => {
      // 沒有 exec_sql，直接查 orders 表結構
      const { data: tables } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
      return { data: tables, error: null }
    })

  console.log('Tables:', JSON.stringify(data, null, 2))

  // 嘗試查 users 表
  const { data: users, error: u1 } = await supabase
    .from('users')
    .select('id, phone, name, role')
    .eq('role', 'driver')
    .limit(5)

  console.log('\nSample drivers (from users):', users, u1?.message)

  // 嘗試查 driver_info 表
  const { data: driverInfo, error: u2 } = await supabase
    .from('driver_info')
    .select('*')
    .limit(5)

  console.log('\nDriver info sample:', driverInfo, u2?.message)

  // 查 orders 表結構
  const { data: sample } = await supabase
    .from('orders')
    .select('*')
    .limit(1)

  console.log('\nOrder sample columns:', sample?.[0] ? Object.keys(sample[0]) : 'no orders')
}

main().catch(console.error)
