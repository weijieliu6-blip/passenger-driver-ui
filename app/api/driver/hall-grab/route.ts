import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'

const BodySchema = z.object({
  order_number: z.string().min(1),
})

/**
 * POST /api/driver/hall-grab
 * 司機搶大廳訂單（原子操作：RPC grab_hall_order）
 *
 * Body: { order_number: string }
 * 回傳: { success, order? | error, currentStatus? }
 *
 * 保護：
 *   - 必須登入且 role=driver
 *   - 訂單必須為 pending_hall 狀態
 *   - 搶到即原子更新（多人同時搶僅一人成功）
 *   - Rate limit：10 req/60s per driver
 */
export async function POST(request: NextRequest) {
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

  // 角色檢查：必須是司機
  const { data: profile } = await userClient
    .from('users')
    .select('role')
    .eq('id', driverId)
    .single()
  if (profile?.role !== 'driver') {
    return NextResponse.json({ error: '需要司機身份', code: 'NOT_DRIVER' }, { status: 403 })
  }

  // Rate limit：每司機 10 req / 60s
  const rl = rateLimit(`hallGrab:${driverId}`, { limit: 10, windowMs: 60_000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: '請求過於頻繁，請稍後再試', retryAfterMs: rl.resetMs },
      { status: 429 }
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效 JSON' }, { status: 400 })
  }
  const parse = BodySchema.safeParse(body)
  if (!parse.success) return NextResponse.json({ error: '缺少 order_number' }, { status: 400 })

  // 呼叫 RPC（grab_hall_order 內含原子更新 + 並發保護）
  const { data, error } = await userClient.rpc('grab_hall_order', {
    p_order_number: parse.data.order_number,
    p_driver_id: driverId,
  })

  if (error) {
    console.error('[hall-grab] RPC err:', JSON.stringify(error))
    return NextResponse.json({ error: '搶單失敗', debug: error.message }, { status: 500 })
  }

  if (!data?.success) {
    const status = (data?.current_status as string) || 'unknown'
    return NextResponse.json(
      {
        success: false,
        error: data?.error || '搶單失敗',
        currentStatus: status,
      },
      { status: 409 }
    )
  }

  return NextResponse.json({ success: true, order_number: parse.data.order_number })
}