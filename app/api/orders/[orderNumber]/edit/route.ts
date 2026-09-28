import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentPassenger } from '@/lib/auth-server'

/**
 * 修改訂單
 * PUT /api/orders/[orderNumber]/edit
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const passenger = await getCurrentPassenger(request)
    
    if (!passenger) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const { orderNumber } = await params
    const body = await request.json()

    // 使用 service role 確保有權限更新
    const supabaseUrl = 'https://vuuamydahzhpajjdvokl.supabase.co'
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 查詢訂單並驗證權限
    const { data: order, error: queryError } = await supabase
      .from('orders')
      .select('id, passenger_id, passenger_phone, status')
      .eq('order_number', orderNumber)
      .single()

    if (queryError || !order) {
      return NextResponse.json(
        { success: false, error: '訂單不存在' },
        { status: 404 }
      )
    }

    // 驗證權限：只能修改自己的訂單
    const ownsById = order.passenger_id === passenger.id
    const ownsByPhone = order.passenger_phone === passenger.phone
    if (!ownsById && !ownsByPhone) {
      return NextResponse.json(
        { success: false, error: '無權限修改此訂單' },
        { status: 403 }
      )
    }

    // 只允許修改待接單的訂單
    if (order.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: '只能修改待接單的訂單' },
        { status: 400 }
      )
    }

    // 構建更新數據
    const updateData: any = {}
    
    // 允許修改的字段
    if (body.departure_time !== undefined) updateData.departure_time = body.departure_time
    if (body.passengers !== undefined) updateData.passengers = body.passengers
    if (body.luggage !== undefined) updateData.luggage = body.luggage
    if (body.vehicle_type !== undefined) updateData.vehicle_type = body.vehicle_type
    if (body.is_charter !== undefined) updateData.is_charter = body.is_charter
    if (body.has_child !== undefined) updateData.has_child = body.has_child
    if (body.child_type !== undefined) updateData.child_type = body.child_type
    if (body.pickup_location !== undefined) updateData.pickup_location = body.pickup_location
    if (body.pickup_area !== undefined) updateData.pickup_area = body.pickup_area
    if (body.dropoff_location !== undefined) updateData.dropoff_location = body.dropoff_location
    if (body.dropoff_area !== undefined) updateData.dropoff_area = body.dropoff_area
    if (body.passenger_notes !== undefined) updateData.passenger_notes = body.passenger_notes
    if (body.passenger_name !== undefined) updateData.passenger_name = body.passenger_name

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: '沒有要更新的字段' },
        { status: 400 }
      )
    }

    // 執行更新
    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('order_number', orderNumber)

    if (updateError) {
      console.error('Update order error:', updateError)
      return NextResponse.json(
        { success: false, error: '更新失敗，請稍後重試' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '訂單已更新'
    })
  } catch (error: any) {
    console.error('Edit order failed:', error)
    return NextResponse.json(
      { success: false, error: error.message || '更新失敗' },
      { status: 500 }
    )
  }
}
