import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { notifyOrderCancelled } from '@/lib/dingtalk'
import { getCurrentPassenger, getCurrentUser } from '@/lib/auth-server'

/**
 * 取消订单 API
 * PUT /api/orders/[orderNumber]/cancel
 *
 * 認證：必須登入，且為訂單本人（passenger_id === passenger.id）或 admin
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params

    if (!orderNumber) {
      return NextResponse.json(
        { error: '缺少订单号' },
        { status: 400 }
      )
    }

    // 1) 認證
    const passenger = await getCurrentPassenger(request)
    const user = await getCurrentUser(request)
    if (!passenger && user?.role !== 'admin') {
      return NextResponse.json(
        { error: '請先登入' },
        { status: 401 }
      )
    }

    // 2) 查询订单当前状态
    const { data: order, error: queryError } = await supabaseAdmin
      .from('orders')
      .select('id, passenger_id, status')
      .eq('order_number', orderNumber)
      .single()

    if (queryError || !order) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      )
    }

    // 3) 授權：僅本人或 admin 可取消
    const isOwner = !!passenger && order.passenger_id === passenger.id
    const isAdmin = user?.role === 'admin'
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: '無權限取消此訂單' },
        { status: 403 }
      )
    }

    // 4) 檢查訂單狀態（管理員可強制取消已 grabbed 訂單）
    if (order.status === 'cancelled') {
      return NextResponse.json({
        success: false,
        message: '订单已经被取消'
      })
    }

    if (order.status === 'grabbed' && !isAdmin) {
      const { data: driver } = await supabaseAdmin
        .from('orders')
        .select('driver_name, driver_phone')
        .eq('id', order.id)
        .single()
      return NextResponse.json({
        success: false,
        message: '订单已被接单，无法取消。请联系司机协商。',
        driverName: driver?.driver_name ?? null,
        driverPhone: driver?.driver_phone ?? null
      }, { status: 400 })
    }

    if (order.status === 'completed') {
      return NextResponse.json({
        success: false,
        message: '訂單已完成，無法取消'
      }, { status: 400 })
    }

    // 更新訂單狀態為已取消
    const { data: cancelledOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('order_number', orderNumber)
      .in('status', ['pending', 'grabbed'])
      .select()
      .single()

    if (updateError || !cancelledOrder) {
      return NextResponse.json(
        { error: '取消订单失败，请稍后重试' },
        { status: 500 }
      )
    }

    console.log('✅ 订单已取消:', cancelledOrder.order_number)

    // 推送取消通知到钉钉群
    try {
      const pickupArea = cancelledOrder.pickup_area
        ? `${cancelledOrder.pickup_location} ${cancelledOrder.pickup_area}`
        : cancelledOrder.pickup_location

      const dropoffArea = cancelledOrder.dropoff_area
        ? `${cancelledOrder.dropoff_location} ${cancelledOrder.dropoff_area}`
        : cancelledOrder.dropoff_location

      await notifyOrderCancelled(
        cancelledOrder.order_number,
        pickupArea,
        dropoffArea
      )
    } catch (pushError) {
      console.error('钉钉通知失败:', pushError)
      // 通知失败不影响取消操作
    }

    return NextResponse.json({
      success: true,
      message: '订单已成功取消',
      order: {
        id: cancelledOrder.id,
        orderNumber: cancelledOrder.order_number,
        status: cancelledOrder.status,
        cancelledAt: cancelledOrder.cancelled_at
      }
    })

  } catch (error) {
    console.error('取消订单失败:', error)

    return NextResponse.json(
      {
        error: '取消订单失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}
