import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface OrderRow {
  order_number: string
  status: string
  driver_id: string | null
  driver_name: string | null
  driver_plate: string | null
  pickup_location: string
  pickup_area: string | null
  dropoff_location: string
  dropoff_area: string | null
  completed_at: string | null
  confirmed_price: number | null
  price_currency: string | null
  departure_time: string
  passengers: number
  vehicle_type: string
}

interface DriverLocationRow {
  lat: number
  lng: number
  heading: number | null
  speed: number | null
  updated_at: string
  order_number: string | null
}

interface RideEventRow {
  id: number
  event_type: string
  actor_role: string
  payload: Record<string, unknown>
  created_at: string
}

/**
 * 乘客端行程追蹤（單筆訂單）
 * GET /api/orders/[orderNumber]/track
 *
 * 認證：開放（含乘客匿名查詢）—— 因為追蹤頁往往透過訂單連結直接進入
 * （乘客查詢時通常使用訂單連結或 cookie；這裡不強制登入，但回傳時不洩漏司機電話）
 *
 * 回傳：
 *   {
 *     orderNumber, status, pickupLocation, pickupArea, dropoffLocation, dropoffArea,
 *     driver: { id, name, plate, vehicleModel?, rating?, drivingYears?, avatarUrl? } | null,
 *     location: { lat, lng, heading?, speed?, updatedAt } | null,
 *     events: [{ id, eventType, actorRole, payload, createdAt }],
 *     pickupCoords?: { lat, lng, name },
 *     dropoffCoords?: { lat, lng, name }
 *   }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params
    if (!orderNumber) {
      return NextResponse.json({ error: '缺少 orderNumber' }, { status: 400 })
    }

    // 訂單基本資訊
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select(
        'order_number, status, driver_id, driver_name, driver_plate, driver_phone, ' +
          'pickup_location, pickup_area, dropoff_location, dropoff_area, ' +
          'completed_at, confirmed_price, price_currency, price_confirmed_at, ' +
          'departure_time, passengers, vehicle_type'
      )
      .eq('order_number', orderNumber)
      .single<OrderRow>()
    if (orderErr || !order) {
      return NextResponse.json({ error: '訂單不存在' }, { status: 404 })
    }

    const ord: OrderRow = order
    const isDriverAssigned = ['grabbed', 'price_confirmed', 'completed'].includes(ord.status)

    // 司機公開資訊（不洩漏電話）
    let driver: {
      id: string
      name: string | null
      plate: string | null
      vehicleModel: string | null
      rating: number | null
      drivingYears: number | null
      avatarUrl: string | null
    } | null = null
    if (isDriverAssigned && ord.driver_id) {
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('id, name, avatar_url')
        .eq('id', ord.driver_id)
        .single<{ id: string; name: string; avatar_url: string | null }>()
      const { data: info } = await supabaseAdmin
        .from('driver_info')
        .select('vehicle_plate, vehicle_model, rating, driving_years')
        .eq('id', ord.driver_id)
        .maybeSingle<{
          vehicle_plate: string | null
          vehicle_model: string | null
          rating: number | null
          driving_years: number | null
        }>()
      driver = {
        id: ord.driver_id,
        name: ord.driver_name ?? profile?.name ?? null,
        plate: ord.driver_plate ?? info?.vehicle_plate ?? null,
        vehicleModel: info?.vehicle_model ?? null,
        rating: info?.rating ?? null,
        drivingYears: info?.driving_years ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      }
    }

    // 即時位置
    let location: {
      lat: number
      lng: number
      heading: number | null
      speed: number | null
      updatedAt: string
    } | null = null
    if (isDriverAssigned && ord.driver_id) {
      const { data: locRow } = await supabaseAdmin
        .from('driver_locations')
        .select('lat, lng, heading, speed, updated_at, order_number')
        .eq('driver_id', ord.driver_id)
        .maybeSingle<DriverLocationRow>()
      const loc: DriverLocationRow | null = locRow
      if (loc && loc.order_number === orderNumber) {
        location = {
          lat: loc.lat,
          lng: loc.lng,
          heading: loc.heading,
          speed: loc.speed,
          updatedAt: loc.updated_at,
        }
      }
    }

    // 事件流水（取最近 50 筆）
    const { data: events } = await supabaseAdmin
      .from('ride_events')
      .select('id, event_type, actor_role, payload, created_at')
      .eq('order_number', orderNumber)
      .order('created_at', { ascending: false })
      .limit(50)

    const normalizedEvents = ((events ?? []) as RideEventRow[]).map((e) => ({
      id: e.id,
      eventType: e.event_type,
      actorRole: e.actor_role,
      payload: e.payload,
      createdAt: e.created_at,
    }))

    return NextResponse.json(
      {
        orderNumber: ord.order_number,
        status: ord.status,
        pickupLocation: ord.pickup_location,
        pickupArea: ord.pickup_area,
        dropoffLocation: ord.dropoff_location,
        dropoffArea: ord.dropoff_area,
        departureTime: ord.departure_time,
        passengers: ord.passengers,
        vehicleType: ord.vehicle_type,
        price: ord.confirmed_price
          ? { amount: ord.confirmed_price, currency: ord.price_currency }
          : null,
        completedAt: ord.completed_at,
        driver,
        location,
        events: normalizedEvents,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (err) {
    console.error('[GET /api/orders/[orderNumber]/track] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '查詢失敗' },
      { status: 500 }
    )
  }
}