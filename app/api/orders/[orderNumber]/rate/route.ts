import { NextRequest, NextResponse } from 'next/server'
import { getCurrentPassenger } from '@/lib/auth-server'
import { createServerClient } from '@/lib/auth-server'

/**
 * 評分訂單
 * POST /api/orders/[orderNumber]/rate
 */
export async function POST(
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
    const { rating } = body

    // 驗證評分
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: '評分必須是 1-5 的數字' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // 驗證訂單存在且屬於當前乘客
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, passenger_id, status')
      .eq('order_number', orderNumber)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: '訂單不存在' },
        { status: 404 }
      )
    }

    if (order.passenger_id !== passenger.id) {
      return NextResponse.json(
        { success: false, error: '無權限評分此訂單' },
        { status: 403 }
      )
    }

    if (order.status !== 'completed') {
      return NextResponse.json(
        { success: false, error: '只能評分已完成的訂單' },
        { status: 400 }
      )
    }

    // 更新評分
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        rating,
        rated_at: new Date().toISOString()
      })
      .eq('order_number', orderNumber)

    if (updateError) {
      console.error('Rate order error:', updateError)
      return NextResponse.json(
        { success: false, error: '評分失敗，請稍後重試' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '評分成功'
    })
  } catch (error: any) {
    console.error('Rate order failed:', error)
    return NextResponse.json(
      { success: false, error: error.message || '評分失敗' },
      { status: 500 }
    )
  }
}
