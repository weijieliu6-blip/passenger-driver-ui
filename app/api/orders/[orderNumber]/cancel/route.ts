import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { notifyOrderCancelled } from '@/lib/dingtalk'

/**
 * 取消订单 API
 * PUT /api/orders/[orderNumber]/cancel
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
    
    // 查询订单当前状态
    const { data: order, error: queryError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single()
    
    if (queryError || !order) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      )
    }
    
    // 检查订单状态
    if (order.status === 'cancelled') {
      return NextResponse.json({
        success: false,
        message: '订单已经被取消'
      })
    }
    
    if (order.status === 'grabbed') {
      return NextResponse.json({
        success: false,
        message: '订单已被接单，无法取消。请联系司机协商。',
        driverName: order.driver_name,
        driverPhone: order.driver_phone
      }, { status: 400 })
    }
    
    if (order.status === 'completed') {
      return NextResponse.json({
        success: false,
        message: '訂單已完成，無法取消'
      }, { status: 400 })
    }
    
    // 更新訂單狀態為已取消（允許取消待接單和已接單狀態）
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
