import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentPassenger, getCurrentDriver, getCurrentUser } from '@/lib/auth-server'

/**
 * 查询单个订单详情 API
 * GET /api/orders/[orderNumber]
 *
 * 認證策略：
 *   - 未登入：只回公開摘要（訂單號 + 狀態 + 車輛/時間/地址摘要，不含乘客姓名電話、司機姓名電話車牌）
 *   - 已登入乘客：只能讀自己的訂單（passenger_id === passenger.id）
 *   - 已登入司機：只能讀自己接的訂單（driver_id === driver.id）
 *   - admin：可讀任意訂單
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params

    // 查詢訂單
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: '訂單不存在', message: `找不到訂單號：${orderNumber}` },
          { status: 404 }
        )
      }
      throw error
    }

    // 認證與授權
    const passenger = await getCurrentPassenger(request)
    const driver = await getCurrentDriver(request)
    const user = await getCurrentUser(request)

    const isOwnerPassenger = !!passenger && order.passenger_id === passenger.id
    const isOwnerDriver = !!driver && order.driver_id === driver.id
    const isAdmin = user?.role === 'admin'

    if (!isOwnerPassenger && !isOwnerDriver && !isAdmin) {
      // 未登入或非相關人員：只回公開摘要
      const publicSummary = {
        orderNumber: order.order_number,
        status: order.status,
        direction: order.direction,
        vehicleType: order.vehicle_type,
        passengers: order.passengers,
        departureTime: order.departure_time,
        pickupLocation: order.pickup_location,
        pickupArea: order.pickup_area,
        dropoffLocation: order.dropoff_location,
        dropoffArea: order.dropoff_area,
        createdAt: order.created_at,
      }
      return NextResponse.json({
        success: true,
        order: publicSummary,
        readScope: 'public',
      })
    }

    // 構造附加信息（已通過授權）
    const orderInfo: any = {
      ...order,
    }

    // 如果有 driver_id，附帶司機公開信息
    if (order.driver_id) {
      const { data: driverUser } = await supabaseAdmin
        .from('users')
        .select('id, name, phone, avatar_url')
        .eq('id', order.driver_id)
        .single()

      const { data: driverInfo } = await supabaseAdmin
        .from('driver_info')
        .select('vehicle_model, driving_years, rating, total_orders')
        .eq('id', order.driver_id)
        .maybeSingle()

      orderInfo.driver = driverUser
        ? {
            id: driverUser.id,
            name: driverUser.name,
            phone: driverUser.phone,
            avatarUrl: driverUser.avatar_url,
            vehicleModel: driverInfo?.vehicle_model,
            drivingYears: driverInfo?.driving_years ?? 0,
            rating: driverInfo?.rating ?? 5.0,
            totalOrders: driverInfo?.total_orders ?? 0,
          }
        : null
    }

    return NextResponse.json({
      success: true,
      order: orderInfo,
      readScope: isOwnerPassenger ? 'passenger' : isOwnerDriver ? 'driver' : 'admin',
    })
  } catch (error: any) {
    console.error('查詢訂單失敗:', error)
    return NextResponse.json(
      { error: '查詢訂單失敗', message: error.message },
      { status: 500 }
    )
  }
}
