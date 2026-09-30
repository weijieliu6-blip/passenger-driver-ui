import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/orders/[orderNumber]/messages?since=<iso>
 * 查詢訂單訊息歷史（since 為可選，只回傳該時間之後的訊息）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }
  const token = authHeader.slice(7)
  const since = request.nextUrl.searchParams.get('since')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: userData } = await userClient.auth.getUser()
  if (!userData.user) return NextResponse.json({ error: 'Token 無效' }, { status: 401 })
  const userId = userData.user.id

  const { data: order } = await userClient
    .from('orders')
    .select('order_number, passenger_id, driver_id')
    .eq('order_number', orderNumber)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: '訂單不存在' }, { status: 404 })

  const { data: me } = await userClient.from('users').select('role').eq('id', userId).maybeSingle()
  const role = me?.role || 'passenger'
  const isAuthorized = order.passenger_id === userId || order.driver_id === userId || role === 'admin'
  if (!isAuthorized) return NextResponse.json({ error: '無權限' }, { status: 403 })

  let query = userClient
    .from('order_messages')
    .select('id, order_number, sender_id, sender_role, content, read_at, created_at')
    .eq('order_number', orderNumber)
    .order('created_at', { ascending: true })
    .limit(200)
  if (since) query = query.gt('created_at', since)

  const { data, error } = await query
  if (error) {
    console.error('[order-messages GET] error:', error)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }

  // 標記對方訊息為已讀（這次查詢時）
  await userClient
    .from('order_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('order_number', orderNumber)
    .is('read_at', null)
    .neq('sender_id', userId)

  return NextResponse.json({ success: true, messages: data ?? [] })
}