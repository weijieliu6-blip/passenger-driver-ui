import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentDriver } from '@/lib/auth-server'
import { isWithinSchedule } from '@/lib/schedule-utils'

/**
 * 司機查詢「可搶訂單列表」
 * 根據司機的會員等級過濾「在當前時間應該看到的訂單」
 * GET /api/driver/available-orders
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 真實 Supabase Auth：parseAuthToken → auth.getUser
    const driver = await getCurrentDriver(request)
    if (!driver) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 }
      )
    }
    if (driver.role !== 'driver') {
      return NextResponse.json(
        { error: 'forbidden' },
        { status: 403 }
      )
    }

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

    // 2. 查司機的會員等級 + 狀態（從 driver_info 表 — 唯一真相來源）
    const { data: driverRow, error: driverError } = await supabaseAdmin
      .from('driver_info')
      .select('membership_tier, status')
      .eq('id', driver.id)
      .maybeSingle()

    if (driverError) {
      console.error('查司機失敗:', driverError)
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    // 沒資料默認 gold
    const tier = driverRow?.membership_tier || 'gold'
    const driverStatus = driverRow?.status || 'offline'

    // 3. 根據會員等級決定查詢條件
    // 非會員（none）不會有任何站內推送，所以這裡直接返回空
    if (tier === 'none') {
      return NextResponse.json({
        success: true,
        orders: [],
        tier,
        message: '非會員不接收站內推送，請在釘釘群搶單'
      })
    }

    // 司機不在 available 狀態 → 返回空（不可用 403，向下相容老客戶端）
    if (driverStatus !== 'available') {
      return NextResponse.json({
        success: true,
        orders: [],
        tier,
        driverStatus,
        message:
          driverStatus === 'offline'
            ? '您目前離線，切換為「可接單」後可接收訂單'
            : '您目前正在行程中，完成後即可繼續接單',
      })
    }

    // 4. 查所有「待搶單 + 未過期 + 已釋放給當前等級」的訂單
    const now = new Date().toISOString()

    let releasedAtField: string
    switch (tier) {
      case 'gold':
        releasedAtField = 'gold_released_at'
        break
      case 'platinum':
        releasedAtField = 'platinum_released_at'
        break
      case 'normal':
        releasedAtField = 'normal_released_at'
        break
      default:
        releasedAtField = 'gold_released_at'
    }

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('status', 'pending')
      .is('driver_id', null)
      .gt('expires_at', now)
      .lte(releasedAtField, now)
      .order('created_at', { ascending: false })
      .limit(50)

    if (ordersError) {
      console.error('查詢可搶訂單失敗:', ordersError)
      return NextResponse.json(
        { error: '查詢失敗：' + ordersError.message },
        { status: 500 }
      )
    }

    // 5. 依司機出車時間（Schedule）過濾訂單
    //    用每張單的 departure_time 判斷是否落在司機排班內。
    //    沒設排程的司機會全返回（schedule-utils 內已處理）。
    const filtered: typeof orders = []
    if (orders && orders.length > 0) {
      for (const order of orders) {
        const when = order.departure_time
          ? new Date(order.departure_time)
          : new Date()
        const within = await isWithinSchedule(driver.id, when)
        if (within) filtered.push(order)
      }
    }

    return NextResponse.json({
      success: true,
      orders: filtered,
      tier,
      driverStatus,
      count: filtered.length
    })
  } catch (error: any) {
    console.error('Get available orders failed:', error)
    return NextResponse.json(
      { error: '服務錯誤', message: error.message },
      { status: 500 }
    )
  }
}