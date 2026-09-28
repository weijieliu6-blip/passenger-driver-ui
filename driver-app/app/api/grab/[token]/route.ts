import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { notifyOrderGrabbed } from '@/lib/dingtalk'
import { getCurrentDriver } from '@/lib/auth-server'

/**
 * 獲取訂單詳情（用於搶單頁面展示）
 * GET /api/grab/[token]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json(
        { error: '缺少 token 參數' },
        { status: 400 }
      )
    }

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('grab_token', token)
      .single()

    if (error || !order) {
      return NextResponse.json(
        { error: '訂單不存在' },
        { status: 404 }
      )
    }

    if (order.status === 'grabbed' || order.status === 'price_confirmed') {
      return NextResponse.json({
        success: false,
        status: order.status,
        message: '訂單已被接'
      })
    }

    if (order.status === 'cancelled') {
      return NextResponse.json({
        success: false,
        status: 'cancelled',
        message: '訂單已取消'
      })
    }

    const now = new Date()
    const expiresAt = new Date(order.grab_token_expires_at)

    if (now > expiresAt) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'expired' })
        .eq('id', order.id)

      return NextResponse.json({
        success: false,
        status: 'expired',
        message: '訂單已過期'
      })
    }

    const pickupArea = order.pickup_area
      ? `${order.pickup_location} ${order.pickup_area}`
      : order.pickup_location

    const dropoffArea = order.dropoff_area
      ? `${order.dropoff_location} ${order.dropoff_area}`
      : order.dropoff_location

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        pickupLocation: pickupArea,
        dropoffLocation: dropoffArea,
        departureTime: order.departure_time,
        passengers: order.passengers,
        luggage: order.luggage,
        vehicleType: order.vehicle_type,
        hasChild: order.has_child,
        childType: order.child_type,
        notes: order.passenger_notes,
        createdAt: order.created_at,
        estimatedFare: order.estimated_fare
      }
    })

  } catch (error) {
    console.error('獲取訂單失敗:', error)

    return NextResponse.json(
      {
        error: '獲取訂單失敗',
        message: error instanceof Error ? error.message : '未知錯誤'
      },
      { status: 500 }
    )
  }
}

/**
 * 確認搶單
 * POST /api/grab/[token]
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const driver = await getCurrentDriver(request)
    if (!driver) {
      return NextResponse.json(
        {
          success: false,
          error: '請先登入司機帳號',
          requireLogin: true,
          loginUrl: '/driver/login?redirect=' + encodeURIComponent(`/grab/${token}`),
        },
        { status: 401 }
      )
    }

    const driverName = driver.name
    const driverPhone = driver.phone
    const driverPlate = driver.vehicle_plate

    if (!driverPlate) {
      return NextResponse.json(
        {
          success: false,
          error: '請先完善車牌資料',
          requireProfileUpdate: true,
          profileUrl: '/driver/profile',
        },
        { status: 400 }
      )
    }

    const { data: order, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'grabbed',
        driver_id: driver.id,
        driver_name: driverName,
        driver_phone: driverPhone,
        driver_plate: driverPlate,
        grabbed_at: new Date().toISOString(),
      })
      .eq('grab_token', token)
      .eq('status', 'pending')
      .select()
      .single()

    if (updateError || !order) {
      const { data: currentOrder } = await supabaseAdmin
        .from('orders')
        .select('status, order_number')
        .eq('grab_token', token)
        .single()

      if (currentOrder?.status === 'grabbed' || currentOrder?.status === 'price_confirmed') {
        return NextResponse.json({
          success: false,
          status: currentOrder.status,
          message: '來晚了，訂單已被其他司機搶走',
        })
      }

      return NextResponse.json(
        { error: '搶單失敗，訂單可能已被搶或已過期' },
        { status: 400 }
      )
    }

    console.log(
      '✅ 訂單被搶:',
      order.order_number,
      '司機:',
      driverName,
      '(ID:',
      driver.id,
      ')'
    )

    const { data: existingInfo } = await supabaseAdmin
      .from('driver_info')
      .select('id')
      .eq('id', driver.id)
      .maybeSingle()

    if (!existingInfo) {
      await supabaseAdmin
        .from('driver_info')
        .insert({
          id: driver.id,
          vehicle_plate: driverPlate,
          vehicle_model: driver.vehicle_type || null,
          driving_years: 0,
          total_orders: 0,
          rating: 5.0,
        })
    }

    try {
      await notifyOrderGrabbed(order.order_number, driverName, driverPhone)
    } catch (pushError) {
      console.error('釘釘通知失敗:', pushError)
    }

    return NextResponse.json({
      success: true,
      message: '接單成功',
      order: {
        orderNumber: order.order_number,
        passengerName: order.passenger_name,
        passengerPhone: order.passenger_phone,
        pickupLocation: order.pickup_area
          ? `${order.pickup_location} ${order.pickup_area}`
          : order.pickup_location,
        dropoffLocation: order.dropoff_area
          ? `${order.dropoff_location} ${order.dropoff_area}`
          : order.dropoff_location,
        departureTime: order.departure_time,
        passengers: order.passengers,
        luggage: order.luggage,
        vehicleType: order.vehicle_type,
        notes: order.passenger_notes,
        nextStepUrl: `/driver/orders/${order.order_number}`,
      },
    })
  } catch (error) {
    console.error('搶單失敗:', error)

    return NextResponse.json(
      {
        error: '搶單失敗',
        message: error instanceof Error ? error.message : '未知錯誤',
      },
      { status: 500 }
    )
  }
}
