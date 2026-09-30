import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim()] })
)

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const { data: orders } = await admin
  .from('orders')
  .select('order_number, status, driver_id, grab_token, departure_time, created_at')
  .like('order_number', 'ORD2026093%')
  .order('created_at', { ascending: false })
  .limit(15)

console.log('Recent orders:')
orders?.forEach(o => console.log(' -', JSON.stringify(o)))

// 也看 driver 狀態
const { data: drv } = await admin.from('driver_info').select('id, vehicle_plate, status, membership_tier').eq('vehicle_plate', 'TEST-DRIVER')
console.log('\nDriver info:', drv)

const { data: u } = await admin.from('users').select('id, phone, role').eq('phone', '90030001')
console.log('\nUser:', u)