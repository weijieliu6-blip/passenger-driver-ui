/**
 * 查 users 表的 schema 和約束
 */
const SUPABASE_URL = 'https://vuuamydahzhpajjdvokl.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('❌ 缺少 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const { createClient } = require('@supabase/supabase-js')
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  // 0. 檢查 auth.users 能不能直接讀取（判斷 service key 權限）
  console.log('🧪 測試 0: 讀取 auth.users（判斷 service key 權限）')
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 5 })
  console.log('  Error:', listErr?.message || 'none')
  console.log('  現有用戶數:', list?.users?.length || 0)
  if (list?.users?.length > 0) {
    console.log('  示例（完整字段）:')
    list.users.slice(0, 2).forEach(u => {
      console.log(`    id="${u.id}"`)
      console.log(`    email="${u.email}"`)
      console.log(`    phone="${u.phone || ''}"`)
      console.log(`    role="${u.role}"`)
      console.log(`    aud="${u.aud}"`)
      console.log(`    banned_until="${u.banned_until}"`)
      console.log(`    confirmed_at="${u.email_confirmed_at}"`)
      console.log(`    app_meta=${JSON.stringify(u.app_metadata)}`)
      console.log(`    user_meta=${JSON.stringify(u.user_metadata)}`)
      console.log(`    identities=${u.identities?.length || 0}`)
      console.log('    ---')
    })
  }

  // 0b. 讀取 public.users 結構（如果 RPC 沒有限制）
  console.log('\n🧪 測試 0b: 讀取 public.users（前 5 條）')
  const { data: pubUsers, error: pubErr } = await supabaseAdmin
    .from('users')
    .select('*')
    .limit(5)
  console.log('  Error:', pubErr?.message || 'none')
  if (pubUsers?.length > 0) {
    console.log('  示例:')
    pubUsers.forEach(u => {
      console.log(`    - id="${u.id}" phone="${u.phone}" role="${u.role}"`)
    })
  }

  // 1. 嘗試創建 auth.users 用 email
  console.log('\n🧪 測試 1a: 創建 auth 用戶（普通 email）')
  const { data: d1, error: e1 } = await supabaseAdmin.auth.admin.createUser({
    email: `testuser_${Date.now()}@example.com`,
    password: 'test123456',
    email_confirm: true
  })
  console.log('  Error:', e1?.message || 'none')
  console.log('  Status:', e1?.status || 'none')
  console.log('  User ID:', d1?.user?.id || 'none')

  if (d1?.user) {
    await supabaseAdmin.auth.admin.deleteUser(d1.user.id)
    console.log('  🧹 已清理\n')
  }

  console.log('\n🧪 測試 1c: 創建 auth 用戶（用 phone 字段）')
  const testPhone = `987654${Date.now().toString().slice(-3)}`
  const { data: d3, error: e3 } = await supabaseAdmin.auth.admin.createUser({
    phone: testPhone,
    password: 'test123456',
    phone_confirm: true,
    user_metadata: { role: 'driver', name: '測試電話' }
  })
  console.log('  Error:', e3?.message || 'none')
  console.log('  Status:', e3?.status || 'none')
  console.log('  User ID:', d3?.user?.id || 'none')

  if (d3?.user) {
    await supabaseAdmin.auth.admin.deleteUser(d3.user.id)
    console.log('  🧹 已清理')
  }

  console.log('\n🧪 測試 1d: 用 signUp 創建（模擬真實註冊）')
  const { data: d4, error: e4 } = await supabaseAdmin.auth.signUp({
    phone: `9876${Date.now().toString().slice(-6)}`,
    password: 'test123456',
    options: {
      data: { role: 'driver', name: 'SignupTest' }
    }
  })
  console.log('  Error:', e4?.message || 'none')
  console.log('  User ID:', d4?.user?.id || 'none')

  console.log('🧪 測試 1b: 創建 auth 用戶（phone 格式 email）')
  const authEmail = `phone_hk_${Date.now().toString().slice(-8)}@hkcar.app`
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: authEmail,
    password: 'test123456',
    email_confirm: true
  })
  console.log('  Error:', error?.message || 'none')
  console.log('  Status:', error?.status || 'none')
  console.log('  User ID:', data?.user?.id || 'none')

  console.log('\n🧪 測試 1e: 用 signInWithPassword + phone 風格 email')
  const { data: d5, error: e5 } = await supabaseAdmin.auth.signInWithPassword({
    email: '85290000001',  // 直接用電話
    password: 'test123456'
  })
  console.log('  Error:', e5?.message || 'none')
  console.log('  User:', d5?.user?.id || 'none')
}

main().catch(console.error)
