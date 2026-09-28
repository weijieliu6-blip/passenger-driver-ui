import { createClient } from '@supabase/supabase-js'

/**
 * 司機池 CRUD（service_role 專用）
 * v1 釘釘搶單流程使用，不依賴 auth.users，純以 dingtalk_staff_id 為唯一識別
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase env vars for driver pool')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export type CarType = 'sedan_5' | 'alphard_7' | 'business_9'
export type Seats = 5 | 7 | 9

export interface Driver {
  id: string
  dingtalk_staff_id: string
  name: string
  phone: string
  plate: string
  car_type: CarType
  driving_years: number
  seats: Seats
  registered_at: string
  total_grabs: number
  completed_orders: number
  cancelled_orders: number
  active: boolean
  updated_at: string
}

export interface RegisterDriverInput {
  dingtalk_staff_id: string
  name: string
  phone: string
  plate: string
  car_type: CarType
  driving_years: number
  seats: Seats
}

/**
 * 以 dingtalk_staff_id 查詢司機（不存在的話回傳 null）
 */
export async function findDriverByStaffId(staffId: string): Promise<Driver | null> {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('dingtalk_staff_id', staffId)
    .maybeSingle()

  if (error) throw error
  return (data as Driver | null) ?? null
}

/**
 * 註冊司機（若 dingtalk_staff_id 已存在則回傳既有資料，視同 idempotent）
 */
export async function registerDriver(input: RegisterDriverInput): Promise<Driver> {
  const existing = await findDriverByStaffId(input.dingtalk_staff_id)
  if (existing) return existing

  const { data, error } = await supabase
    .from('drivers')
    .insert({
      dingtalk_staff_id: input.dingtalk_staff_id,
      name: input.name,
      phone: input.phone,
      plate: input.plate,
      car_type: input.car_type,
      driving_years: input.driving_years,
      seats: input.seats,
    })
    .select()
    .single()

  if (error) throw error
  return data as Driver
}

/**
 * 累加司機搶單次數（不丟錯，外面忽略）
 */
export async function incrementDriverGrab(driverId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_driver_total_grabs', { p_driver_id: driverId })
  // 如果 RPC 不存在，改用直接 SQL（透過 from('drivers').update + filter）
  if (error) {
    // 後備：用 raw SQL 透過 supabase-js 的 from('drivers').select + RPC fallback
    const { data: d, error: e2 } = await supabase
      .from('drivers')
      .select('total_grabs')
      .eq('id', driverId)
      .single()
    if (e2 || !d) return
    await supabase
      .from('drivers')
      .update({ total_grabs: (d.total_grabs ?? 0) + 1 })
      .eq('id', driverId)
  }
}

/**
 * 查詢訂單是否已被搶（搭配 FOR UPDATE 用）
 * 這裡只用於查詢，真正的鎖在 SQL transaction 裡做
 */
export async function getOrderByGrabToken(token: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, status, grab_token, grab_token_expires_at, grabbed_by_driver_id')
    .eq('grab_token', token)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * 把訂單標記為 grabbed，並寫入司機關聯
 * 用原子 SQL（UPDATE ... WHERE status='pending' RETURNING）來避免雙搶
 *
 * 兼容舊版 DB（若 v1 migration 還沒跑，自動退而求其次只寫 legacy 欄位）
 */
export async function grabOrderAtomically(
  token: string,
  driverId: string,
  driverName: string,
  driverPhone: string,
  driverPlate: string
): Promise<{ ok: boolean; order?: any; reason?: 'already_grabbed' | 'expired' | 'not_found' }> {
  // 先抓訂單看是否過期（不抓 grabbed_by_driver_id，避免 column not exist）
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, order_number, status, grab_token_expires_at')
    .eq('grab_token', token)
    .maybeSingle()
  if (orderErr) throw orderErr
  if (!order) return { ok: false, reason: 'not_found' }

  const now = new Date()
  const expiresAt = new Date(order.grab_token_expires_at)
  if (now > expiresAt) {
    return { ok: false, reason: 'expired' }
  }

  const nowIso = now.toISOString()
  // 先試完整欄位（包含 v1 新欄位）
  const fullUpdate = {
    status: 'grabbed',
    grabbed_by_driver_id: driverId,
    grabbed_at: nowIso,
    accepted_at: nowIso,
    first_driver_offered_at: nowIso,
    driver_name: driverName,
    driver_phone: driverPhone,
    driver_plate: driverPlate,
  }

  let updated: any = null
  let error: any = null
  const firstAttempt = await supabase
    .from('orders')
    .update(fullUpdate)
    .eq('grab_token', token)
    .eq('status', 'pending')
    .select('id, order_number, status, passenger_name, passenger_phone')
    .maybeSingle()
  updated = firstAttempt.data
  error = firstAttempt.error

  // 若欄位不存在，退而使用 legacy 欄位（確保雙搶防呆仍有效）
  if (error && (/column.*does not exist/i.test(error.message) || /Could not find the .* column/i.test(error.message))) {
    const legacyUpdate = {
      status: 'grabbed',
      grabbed_at: nowIso,
      driver_name: driverName,
      driver_phone: driverPhone,
      driver_plate: driverPlate,
    }
    const second = await supabase
      .from('orders')
      .update(legacyUpdate)
      .eq('grab_token', token)
      .eq('status', 'pending')
      .select('id, order_number, status, passenger_name, passenger_phone')
      .maybeSingle()
    updated = second.data
    error = second.error
  }

  if (error) throw error
  if (!updated) {
    // 沒更新到任何 row：代表狀態已不是 pending
    return { ok: false, reason: 'already_grabbed' }
  }
  return { ok: true, order: updated }
}