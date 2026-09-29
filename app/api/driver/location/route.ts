import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentDriver } from '@/lib/auth-server'
import type { DriverLocationPing } from '@/lib/driver-tracking'

/**
 * 司機端上報即時位置（行車中每 15s 由 client 呼叫）
 * POST /api/driver/location
 *
 * Body: DriverLocationPing
 * - lat, lng 必填
 * - heading/speed/accuracy 可選
 * - order_number 可選（綁定到當前訂單，讓乘客端可以訂閱）
 *
 * 認證：需登入司機；service_role 寫入 driver_locations
 */
export async function POST(request: NextRequest) {
  try {
    const driver = await getCurrentDriver(request)
    if (!driver) {
      return NextResponse.json({ error: '未登入或非司機身份' }, { status: 401 })
    }

    let body: Partial<DriverLocationPing>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: '請求格式錯誤（JSON）' }, { status: 400 })
    }

    const lat = Number(body?.lat)
    const lng = Number(body?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'lat/lng 必須是合法數值' }, { status: 400 })
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'lat/lng 超出合法範圍' }, { status: 400 })
    }

    const heading = body?.heading != null ? Number(body.heading) : null
    const speed = body?.speed != null ? Number(body.speed) : null
    const accuracy = body?.accuracy != null ? Number(body.accuracy) : null
    const orderNumber = typeof body?.order_number === 'string' && body.order_number.trim()
      ? body.order_number.trim()
      : null

    // 若綁定訂單，驗證該訂單確實是此司機的活躍訂單（避免亂綁）
    if (orderNumber) {
      const { data: order, error: orderErr } = await supabaseAdmin
        .from('orders')
        .select('order_number, driver_id, status')
        .eq('order_number', orderNumber)
        .single<{ order_number: string; driver_id: string | null; status: string }>()
      if (orderErr || !order) {
        return NextResponse.json({ error: '訂單不存在' }, { status: 404 })
      }
      if (order.driver_id !== driver.id) {
        return NextResponse.json({ error: '此訂單不屬於當前司機' }, { status: 403 })
      }
      const allowedStatuses = ['grabbed', 'price_confirmed']
      if (!allowedStatuses.includes(order.status)) {
        return NextResponse.json(
          { error: `訂單狀態 ${order.status} 不允許上報位置` },
          { status: 400 }
        )
      }
    }

    // upsert：每個 driver_id 一列（最新覆蓋）
    const { data, error } = await supabaseAdmin
      .from('driver_locations')
      .upsert(
        {
          driver_id: driver.id,
          lat,
          lng,
          heading: Number.isFinite(heading as number) ? (heading as number) : null,
          speed: Number.isFinite(speed as number) ? (speed as number) : null,
          accuracy: Number.isFinite(accuracy as number) ? (accuracy as number) : null,
          order_number: orderNumber,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'driver_id' }
      )
      .select('driver_id, lat, lng, heading, speed, accuracy, order_number, updated_at')
      .single()

    if (error || !data) {
      console.error('[POST /api/driver/location] upsert failed:', error)
      return NextResponse.json(
        { error: '寫入位置失敗', detail: error?.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, location: data })
  } catch (err) {
    console.error('[POST /api/driver/location] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '伺服器錯誤' },
      { status: 500 }
    )
  }
}