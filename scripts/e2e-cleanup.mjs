import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim()] })
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// 1) 刪掉所有 __CONSUMED__ 的 grab_token（測試留下的）
const { data: stuck } = await admin.from('orders').select('id, order_number, grab_token').like('grab_token', '__CONSUMED__%')
console.log('Stuck consumed orders:', stuck?.length)
for (const o of stuck ?? []) {
  console.log('  resetting', o.order_number)
  await admin.from('orders').delete().eq('id', o.id)
}

// 2) 刪掉測試訂單
const { data: ords } = await admin.from('orders').select('id, order_number').like('order_number', 'ORD20260930%')
if (ords?.length) {
  await admin.from('orders').delete().in('id', ords.map(o => o.id))
  console.log(`deleted ${ords.length} ORD20260930* orders`)
}