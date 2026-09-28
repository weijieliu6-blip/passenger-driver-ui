/**
 * 徹底排查 9000000X 用戶的所有殘留
 */
const SUPABASE_URL = 'https://vuuamydahzhpajjdvokl.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const { createClient } = require('@supabase/supabase-js')
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  const phones = ['90000001', '90000002', '90000003', '90000004']

  console.log('🧪 步驟 1: 查 public.users 所有 9000000X 記錄')
  const { data: pubUsers, error: pubErr } = await supabaseAdmin
    .from('users')
    .select('*')
    .in('phone', phones)
  console.log('  Error:', pubErr?.message || 'none')
  console.log('  數量:', pubUsers?.length || 0)
  pubUsers?.forEach(u => {
    console.log(`    - id="${u.id}" phone="${u.phone}" name="${u.name}" role="${u.role}"`)
  })

  console.log('\n🧪 步驟 2: 查 auth.users 所有 9000000X 記錄')
  const { data: { users }, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  console.log('  Error:', authErr?.message || 'none')
  console.log('  總 auth.users:', users?.length || 0)

  const matches = users?.filter(u => {
    return phones.some(p => u.phone === `+852${p}` || u.phone === `852${p}` || u.phone === p)
  })
  console.log('  9000000X 匹配:', matches?.length || 0)
  matches?.forEach(u => {
    console.log(`    - id="${u.id}" phone="${u.phone}" email="${u.email}"`)
  })

  console.log('\n🧪 步驟 3: 查 driver_info 所有 9000000X 記錄')
  // 因為 driver_info 是按 id FK 的，用上面的 id 列表查
  const idsToCheck = [
    ...(pubUsers?.map(u => u.id) || []),
    ...(matches?.map(u => u.id) || [])
  ]
  console.log('  待查 id:', idsToCheck.length)

  if (idsToCheck.length > 0) {
    const { data: driverInfos } = await supabaseAdmin
      .from('driver_info')
      .select('*')
      .in('id', idsToCheck)
    console.log('  driver_info 數量:', driverInfos?.length || 0)
    driverInfos?.forEach(d => {
      console.log(`    - id="${d.id}" tier="${d.membership_tier}" plate="${d.vehicle_plate}"`)
    })
  }

  console.log('\n🧪 步驟 4: 清理！')
  // 先刪 driver_info
  if (idsToCheck.length > 0) {
    const { error: dErr } = await supabaseAdmin.from('driver_info').delete().in('id', idsToCheck)
    console.log('  刪 driver_info:', dErr?.message || '✅')
  }
  // 再刪 public.users
  const { error: pErr } = await supabaseAdmin.from('users').delete().in('phone', phones)
  console.log('  刪 public.users:', pErr?.message || '✅')
  // 最後刪 auth.users
  for (const m of matches || []) {
    const { error: aErr } = await supabaseAdmin.auth.admin.deleteUser(m.id)
    console.log(`  刪 auth.users ${m.id}:`, aErr?.message || '✅')
  }

  console.log('\n🧪 步驟 5: 驗證清理結果')
  const { data: verifyPub } = await supabaseAdmin.from('users').select('id,phone').in('phone', phones)
  console.log('  public.users 剩餘:', verifyPub?.length || 0)
}

main().catch(console.error)
