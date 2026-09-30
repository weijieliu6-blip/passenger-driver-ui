import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim()] })
)

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const { data: drv } = await admin.from('driver_info').select('*').eq('vehicle_plate', 'TEST-DRIVER')
console.log('Driver:', drv)

// 模擬 grab route 的 UPDATE，看看結果
const { data: tokenOrd } = await admin.from('orders').select('id, order_number, status, grab_token, driver_id').eq('grab_token', 'test6n7ud7azxxf').maybeSingle()
console.log('Order by token:', tokenOrd)

const drvId = drv[0]?.id
if (drvId && tokenOrd) {
  const { data: upd, error: uerr } = await admin
    .from('orders')
    .update({
      status: 'grabbed',
      driver_id: drvId,
      driver_name: 'Test Driver',
      driver_phone: '90030001',
      driver_plate: 'TEST-DRIVER',
      grabbed_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      first_driver_offered_at: new Date().toISOString(),
      grab_token: null,
    })
    .eq('grab_token', 'test6n7ud7azxxf')
    .eq('status', 'pending')
    .select()
    .single()
  console.log('UPDATE result:', upd ? 'OK ' + upd.order_number : 'FAIL', uerr?.message)
}