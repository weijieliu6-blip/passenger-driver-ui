import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentDriver } from '@/lib/auth-server'
import type { RideEventType } from '@/lib/driver-tracking'

/**
 * 司機端推送行程事件（抵達/上車/完成/訊息）
 * POST /api/orders/[orderNumber]/events
 *
 * Body: {
 *   event_type: 'driver_arrived' | 'driver_picked_up' | 'trip_started' | 'trip_completed' | 'message' | 'price_confirmed',
 *   message?: string,           // 選填，僅 message 類型生效
 *   payload?: Record<string, unknown>
 * }
 *
 * 認證：需登入司機，且訂單 driver_id = 此司機
 *
 * 副作用：
 *   - driver_arrived  → 不變更 orders.status
 *   - trip_started    → orders.status = price_confirmed（已含報價）
 *   - trip_completed  → orders.status = completed, completed_at = now
 *   - price_confirmed → orders.status = price_confirmed
 *   - 其他事件型別只寫 ride_events，不動訂單狀態
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params
    if (!orderNumber) {
      return NextResponse.json({ error: '缺少 orderNumber' }, { status: 400 })
    }

    const driver = await getCurrentDriver(request)
    if (!driver) {
      return NextResponse.json({ error: '未登入或非司機身份' }, { status: 401 })
    }

    interface EventBody {
      event_type?: RideEventType
      message?: unknown
      payload?: unknown
    }
    let body: EventBody
    try {
      body = (await request.json()) as EventBody
    } catch {
      return NextResponse.json({ error: '請求格式錯誤（JSON）' }, { status: 400 })
    }

    const allowed: RideEventType[] = [
      'status_changed',
      'message',
      'driver_arrived',
      'driver_picked_up',
      'trip_started',
      'trip_completed',
      'price_confirmed',
    ]
    const eventType: RideEventType | undefined = body?.event_type
    if (!eventType || !allowed.includes(eventType)) {
      return NextResponse.json(
        { error: `event_type 必須是 ${allowed.join('|')} 之一` },
        { status: 400 }
      )
    }
    const message: string | undefined =
      typeof body?.message === 'string' && body.message.trim()
        ? body.message.trim().slice(0, 500)
        : undefined
    const payload: Record<string, unknown> =
      body?.payload && typeof body.payload === 'object'
        ? (body.payload as Record<string, unknown>)
        : {}

    // 取出訂單並驗證歸屬
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('order_number, status, driver_id, driver_name')
      .eq('order_number', orderNumber)
      .single<{
        order_number: string
        status: string
        driver_id: string | null
        driver_name: string | null
      }>()
    if (orderErr || !order) {
      return NextResponse.json({ error: '訂單不存在' }, { status: 404 })
    }
    if (order.driver_id !== driver.id) {
      return NextResponse.json({ error: '此訂單不屬於當前司機' }, { status: 403 })
    }

    // 依事件類型決定是否要變更訂單狀態
    let newStatus: string | null = null
    const extraFields: Record<string, unknown> = {}

    switch (eventType) {
      case 'driver_arrived':
        // 司機抵達上車點：仍維持 grabbed/price_confirmed，只記事件
        break
      case 'driver_picked_up':
        // 乘客上車：等同 trip_started；視為行程開始
        newStatus = 'price_confirmed'
        break
      case 'trip_started':
        newStatus = 'price_confirmed'
        break
      case 'price_confirmed':
        newStatus = 'price_confirmed'
        break
      case 'trip_completed':
        newStatus = 'completed'
        extraFields.completed_at = new Date().toISOString()
        break
      default:
        // message / status_changed → 不動訂單
        break
    }

    // 一次性寫：ride_events + orders 更新
    const rideEventPromise = supabaseAdmin.from('ride_events').insert({
      order_number: orderNumber,
      actor_role: 'driver',
      event_type: eventType,
      payload: { ...payload, ...(message ? { message } : {}) },
    })
    const orderUpdatePromise = newStatus && newStatus !== order.status
      ? supabaseAdmin
          .from('orders')
          .update({ status: newStatus, ...extraFields })
          .eq('order_number', orderNumber)
      : null

    const [rideEventResult, orderUpdateResult] = await Promise.allSettled([
      rideEventPromise,
      orderUpdatePromise ?? Promise.resolve(null),
    ])

    if (rideEventResult.status === 'rejected') {
      console.error('[POST events] ride_events insert failed:', rideEventResult.reason)
      return NextResponse.json({ error: '寫入事件失敗' }, { status: 500 })
    }
    if (orderUpdateResult && orderUpdateResult.status === 'rejected') {
      console.error('[POST events] order update failed:', orderUpdateResult.reason)
      // 訂單更新失敗不應回滾事件（事件已是事實記錄）
    }

    return NextResponse.json({
      success: true,
      eventType,
      newOrderStatus: newStatus ?? order.status,
      orderCompleted: newStatus === 'completed',
    })
  } catch (err) {
    console.error('[POST /api/orders/[orderNumber]/events] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '伺服器錯誤' },
      { status: 500 }
    )
  }
}