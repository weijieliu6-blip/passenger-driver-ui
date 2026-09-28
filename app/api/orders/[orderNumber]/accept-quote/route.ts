import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { notifyOrderAcceptedByPassenger } from '@/lib/dingtalk'

/**
 * 乘客確認接單（接受司機報價）API
 * POST /api/orders/[orderNumber]/accept-quote
 *
 * 流程：
 * - 從 price_confirmed → completed（乘客確認即視為成交）
 * - 記錄 completed_at 時間
 * - **推送釘釘通知**給司機 / 群組
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params

    // 查詢訂單完整資料（用於推送通知）
    const { data: order, error: fetchErr } = await supabaseAdmin
      .from('orders')
      .select('id, status, confirmed_price, price_currency, pickup_location, pickup_area, dropoff_location, dropoff_area, departure_time, passenger_name, passenger_phone, driver_name')
      .eq('order_number', orderNumber)
      .single()

    if (fetchErr || !order) {
      return NextResponse.json(
        { success: false, error: '訂單不存在', message: '查無此訂單' },
        { status: 404 }
      )
    }

    // 狀態檢查
    if (order.status !== 'price_confirmed' && order.status !== 'grabbed') {
      return NextResponse.json(
        { success: false, error: '訂單狀態不允許', message: `當前狀態為 ${order.status}，無法確認接單` },
        { status: 400 }
      )
    }

    // 檢查是否有報價
    if (order.confirmed_price == null) {
      return NextResponse.json(
        { success: false, error: '尚未報價', message: '司機尚未報價，無法確認' },
        { status: 400 }
      )
    }

    // 更新訂單狀態為已完成（乘客確認即視為成交）
    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    if (updateErr) throw updateErr

    // 📣 推送釘釘通知給司機（fire-and-forget，不阻塞回應）
    notifyOrderAcceptedByPassenger(
      orderNumber,
      order.pickup_location || '',
      order.pickup_area || null,
      order.dropoff_location || '',
      order.dropoff_area || null,
      order.departure_time,
      order.confirmed_price,
      (order.price_currency as 'HKD' | 'CNY') || 'HKD',
      order.passenger_name || '乘客',
      order.passenger_phone || '',
      order.driver_name || null
    ).catch((e) => console.warn('[dingtalk] notifyOrderAcceptedByPassenger failed', e))

    return NextResponse.json({
      success: true,
      message: '已確認訂單，司機已收到通知，將於約定時間接您',
      order: {
        orderNumber,
        status: 'completed',
        confirmedPrice: order.confirmed_price,
        currency: order.price_currency,
      },
    })
  } catch (error: any) {
    console.error('確認訂單失敗:', error)
    return NextResponse.json(
      { success: false, error: '確認訂單失敗', message: error.message },
      { status: 500 }
    )
  }
}
