import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * 查詢單個訂單詳情 API
 * GET /api/orders/[orderNumber]
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

    // 構造附加信息
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
    })
  } catch (error: any) {
    console.error('查詢訂單失敗:', error)
    return NextResponse.json(
      { error: '查詢訂單失敗', message: error.message },
      { status: 500 }
    )
  }
}
