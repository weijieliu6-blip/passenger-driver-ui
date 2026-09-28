import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentPassenger } from '@/lib/auth-server'

/**
 * 重新預約 API
 * POST /api/orders/[orderNumber]/rebook
 *
 * 從已取消訂單複製數據生成新訂單。
 * 不直接創建訂單，而是返回舊訂單的可重用數據，
 * 前端跳轉到首頁並將數據預填進表單，讓用戶確認後下單。
 *
 * 返回：{ bookingData: { ...formData } }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params

    // 1. 查詢訂單
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single()

    if (error || !order) {
      return NextResponse.json(
        { success: false, error: '訂單不存在' },
        { status: 404 }
      )
    }

    // 2. 驗證權限：必須是訂單的所有者
    const passenger = await getCurrentPassenger(request)

    const isOwner =
      passenger &&
      ((order as any).passenger_id === passenger.id ||
        order.passenger_phone === passenger.phone)

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: '無權限重新預約此訂單' },
        { status: 403 }
      )
    }

    if (order.status !== 'cancelled') {
      return NextResponse.json(
        { success: false, error: `訂單狀態為 ${order.status}，無法重新預約` },
        { status: 400 }
      )
    }

    // 3. 構建可重用的預訂數據（與 confirm 頁一致）
    const departureDate = new Date(order.departure_time)
    const dateStr = departureDate.toISOString().split('T')[0]
    const timeStr = departureDate.toTimeString().slice(0, 5)

    // serviceType 推斷：to_hk / to_mainland 為跨境；其他為內地
    const serviceType =
      order.direction === 'to_hk' || order.direction === 'to_mainland'
        ? 'cross_border'
        : 'mainland_local'

    const directionMap: Record<string, string> = {
      to_mainland: 'hk_to_mainland',
      to_hk: 'mainland_to_hk',
    }
    const newDirection = directionMap[order.direction] || order.direction

    const bookingData = {
      serviceType,
      direction: newDirection,
      pickupLocation: order.pickup_location,
      pickupArea: order.pickup_area || '',
      dropoffLocation: order.dropoff_location,
      dropoffArea: order.dropoff_area || '',
      departureDate: dateStr,
      departureTime: timeStr,
      passengers: order.passengers,
      luggage: order.luggage,
      vehicleType: order.vehicle_type,
      isCharter: order.is_charter,
      hasChild: order.has_child,
      childType: order.child_type || '',
      passengerName: order.passenger_name || '',
      passengerPhone: order.passenger_phone,
      passengerNotes: order.passenger_notes || '',
      // 標記來源訂單
      _rebookFrom: orderNumber,
    }

    return NextResponse.json({
      success: true,
      message: '已準備好重新預約數據',
      bookingData,
    })
  } catch (error: any) {
    console.error('Rebook error:', error)
    return NextResponse.json(
      {
        success: false,
        error: '重新預約失敗',
        message: error.message || '未知錯誤',
      },
      { status: 500 }
    )
  }
}
