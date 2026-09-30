import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/driver/hall-orders
 * 司機從接單大廳拉取訂單（pending_hall 狀態）
 *
 * Query：
 *   limit - 預設 50
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: userData } = await userClient.auth.getUser()
  if (!userData.user) return NextResponse.json({ error: 'Token 無效' }, { status: 401 })
  const driverId = userData.user.id

  // 確認角色（必須是 driver）
  const { data: me } = await userClient.from('users').select('role, name').eq('id', driverId).maybeSingle()
  if (me?.role !== 'driver') {
    return NextResponse.json({ error: '需要司機帳號' }, { status: 403 })
  }

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10), 100)

  // 用 RLS 拉取（司機 role 自動可見 pending_hall）
  const { data, error } = await userClient
    .from('orders')
    .select(`
      id, order_number, direction, pickup_location, pickup_area, pickup_address,
      dropoff_location, dropoff_area, dropoff_address,
      departure_time, passengers, luggage, vehicle_type, is_charter,
      has_child, child_type, passenger_name, passenger_phone, passenger_notes,
      estimated_fare, entered_hall_at, created_at
    `)
    .eq('status', 'pending_hall')
    .order('entered_hall_at', { ascending: true })  // 早進大廳的優先（公平）
    .limit(limit)

  if (error) {
    console.error('[hall-orders] err:', error)
    return NextResponse.json({ error: '拉取失敗' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    orders: data ?? [],
    count: data?.length ?? 0,
    driver: { id: driverId, name: me.name },
  })
}