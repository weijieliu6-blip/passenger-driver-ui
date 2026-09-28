import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentDriver } from '@/lib/auth-server'
import { isWithinSchedule } from '@/lib/schedule-utils'

/**
 * 司機搶單 API（原子操作，防止兩個司機同時搶到同一單）
 * POST /api/orders/[orderNumber]/grab
 *
 * 邏輯：
 * 1. 驗證司機登入 + 會員等級（真實 Supabase Auth）
 * 2. 用 UPDATE ... WHERE status='pending' AND driver_id IS NULL
 *    如果 affected rows = 1，搶單成功
 *    如果 affected rows = 0，訂單已被搶
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params

    // 1. 真實 Supabase Auth：parseAuthToken → auth.getUser
    const driverAuth = await getCurrentDriver(request)
    if (!driverAuth) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 }
      )
    }
    if (driverAuth.role !== 'driver') {
      return NextResponse.json(
        { error: 'forbidden' },
        { status: 403 }
      )
    }

    const userId = driverAuth.id

    const supabaseUrl = 'https://vuuamydahzhpajjdvokl.supabase.co'
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!serviceRoleKey) {
      return NextResponse.json({ error: '服務器配置錯誤' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 2. 查司機資料（用 driver_info 表）
    const { data: driver, error: driverError } = await supabaseAdmin
      .from('driver_info')
      .select('id, vehicle_plate, vehicle_model, membership_tier, rating, status')
      .eq('id', userId)
      .maybeSingle()

    if (driverError) {
      console.error('查詢司機失敗:', driverError)
      return NextResponse.json({ error: '查詢司機失敗' }, { status: 500 })
    }

    // 沒司機資料 → 默認為 gold（首次接單的司機）
    const driverTier = driver?.membership_tier || 'gold'
    const driverStatus = driver?.status || 'offline'

    // 同步查 users 表拿姓名電話
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, name, phone')
      .eq('id', userId)
      .single()

    const driverInfo = {
      id: userId,
      name: user?.name || '司機',
      phone: user?.phone || '',
      vehicle_plate: driver?.vehicle_plate || '',
      membership_tier: driverTier,
      rating: driver?.rating || 5.0
    }

    // 3. 查訂單當前狀態
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: '訂單不存在' }, { status: 404 })
    }

    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: '訂單已被搶或已取消', currentStatus: order.status },
        { status: 409 }
      )
    }

    if (order.driver_id) {
      return NextResponse.json(
        { error: '訂單已被其他司機搶走' },
        { status: 409 }
      )
    }

    // 4. 檢查過期時間
    if (order.expires_at && new Date(order.expires_at) < new Date()) {
      return NextResponse.json({ error: '訂單已過期' }, { status: 410 })
    }

    // 4a. 司機必須在 available 狀態才可搶單
    if (driverStatus !== 'available') {
      return NextResponse.json(
        {
          error:
            driverStatus === 'offline'
              ? '您目前離線，無法搶單。請先到「我的」頁面切換為「可接單」'
              : '您目前正在行程中，無法搶單',
          driverStatus,
        },
        { status: 403 }
      )
    }

    // 4b. 司機必須在訂單的 departure_time 落在自己的排程內
    const departureDate = order.departure_time ? new Date(order.departure_time) : null
    if (departureDate) {
      const within = await isWithinSchedule(userId, departureDate)
      if (!within) {
        return NextResponse.json(
          {
            error: '此訂單的出發時間不在您的出車時間範圍內',
            departureTime: order.departure_time,
            hint: '請到「出車時間」頁面新增或調整排程',
          },
          { status: 403 }
        )
      }
    }

    // 5. 檢查會員等級是否允許搶單
    const tier = driverInfo.membership_tier || 'gold'
    const now = new Date()

    if (tier === 'none') {
      return NextResponse.json(
        { error: '非會員無法搶單，請升級會員或通過釘釘搶單' },
        { status: 403 }
      )
    }

    let releasedAt: Date | null = null
    switch (tier) {
      case 'gold':
        releasedAt = order.gold_released_at ? new Date(order.gold_released_at) : null
        break
      case 'platinum':
        releasedAt = order.platinum_released_at ? new Date(order.platinum_released_at) : null
        break
      case 'normal':
        releasedAt = order.normal_released_at ? new Date(order.normal_released_at) : null
        break
    }

    if (!releasedAt || now.getTime() < releasedAt.getTime()) {
      return NextResponse.json(
        {
          error: '您的會員等級尚未允許搶此訂單',
          tier,
          releasedAt: releasedAt?.toISOString(),
          waitSeconds: releasedAt ? Math.ceil((releasedAt.getTime() - now.getTime()) / 1000) : 0
        },
        { status: 403 }
      )
    }

    // 6. 原子搶單：UPDATE WHERE status='pending' AND driver_id IS NULL
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'grabbed',
        driver_id: driverInfo.id,
        driver_name: driverInfo.name,
        driver_phone: driverInfo.phone,
        driver_plate: driverInfo.vehicle_plate,
        grabbed_at: now.toISOString()
      })
      .eq('order_number', orderNumber)
      .eq('status', 'pending')
      .is('driver_id', null)
      .select()

    if (updateError) {
      console.error('搶單失敗:', updateError)
      return NextResponse.json({ error: '搶單失敗' }, { status: 500 })
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: '訂單已被其他司機搶走' },
        { status: 409 }
      )
    }

    // 6a. 將司機狀態切為 on_trip（伺服器專用 — 不可由前端 PATCH 設定）
    await supabaseAdmin
      .from('driver_info')
      .update({ status: 'on_trip' })
      .eq('id', userId)

    return NextResponse.json({
      success: true,
      message: '搶單成功！',
      order: {
        orderNumber: updated[0].order_number,
        status: updated[0].status,
        grabbedAt: updated[0].grabbed_at
      }
    })
  } catch (error: any) {
    console.error('Grab order failed:', error)
    return NextResponse.json(
      { error: '服務錯誤', message: error.message },
      { status: 500 }
    )
  }
}