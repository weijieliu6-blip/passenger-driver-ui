import { NextRequest, NextResponse } from 'next/server'
import { notifyOrderPriceConfirmed } from '@/lib/dingtalk'
import { getCurrentDriver } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * 司機搶單後報價 API
 * POST /api/driver/grab/[token]/quote
 *
 * body: { confirmed_price, price_currency, vehicle_model?, driving_years? }
 *
 * 認證（v2）：強制要求司機已 cookie 登入；不再接受 body.staff_id 作為身份（C4）。
 *   - 透過登入司機 id 查 driver_info
 *   - 驗證訂單 driver_id === 此司機
 *   - 狀態從 grabbed → price_confirmed
 *   - 推送釘釘「報價已確認」通知給乘客/群組
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const confirmedPrice = Number(body.confirmed_price)
    const currency = body.price_currency === 'CNY' ? 'CNY' : 'HKD'

    if (!Number.isFinite(confirmedPrice) || confirmedPrice <= 0) {
      return NextResponse.json({ success: false, error: '請輸入有效的價格' }, { status: 400 })
    }
    if (!['HKD', 'CNY'].includes(currency)) {
      return NextResponse.json({ success: false, error: '幣種必須是 HKD 或 CNY' }, { status: 400 })
    }

    // 認證
    const driver = await getCurrentDriver(request)
    if (!driver) {
      return NextResponse.json(
        { success: false, error: '請先登入司機帳號', requireLogin: true },
        { status: 401 }
      )
    }

    // 查訂單（用 grab_token）
    const { data: order, error: lookupErr } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, status, driver_id, driver_name, passenger_name')
      .eq('grab_token', token)
      .single()

    if (lookupErr || !order) {
      return NextResponse.json({ success: false, error: '訂單不存在' }, { status: 404 })
    }

    if (order.driver_id !== driver.id) {
      return NextResponse.json({ success: false, error: '您沒有權限操作此訂單' }, { status: 403 })
    }
    if (order.status !== 'grabbed' && order.status !== 'price_confirmed') {
      return NextResponse.json(
        { success: false, error: `訂單狀態為 ${order.status}，無法確認價格` },
        { status: 400 }
      )
    }

    // 更新訂單價格
    const { data: updatedArr, error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({
        confirmed_price: confirmedPrice,
        price_currency: currency,
        price_confirmed_at: new Date().toISOString(),
        status: 'price_confirmed',
      })
      .eq('id', order.id)
      .select()

    if (updateErr || !updatedArr || updatedArr.length === 0) {
      console.error('Update order failed:', updateErr)
      return NextResponse.json({ success: false, error: '更新訂單失敗' }, { status: 500 })
    }

    const updated = updatedArr[0]

    // 更新 driver_info 中的車型/駕齡（如果有帶）
    if (body.vehicle_model || body.driving_years !== undefined) {
      const infoUpdate: any = { updated_at: new Date().toISOString() }
      if (body.vehicle_model) infoUpdate.vehicle_model = body.vehicle_model
      if (typeof body.driving_years === 'number') infoUpdate.driving_years = body.driving_years
      await supabaseAdmin
        .from('driver_info')
        .update(infoUpdate)
        .eq('id', driver.id)
    }

    // 推送釘釘「價格已確認」通知
    notifyOrderPriceConfirmed(
      updated.order_number ?? order.order_number,
      driver.name,
      driver.phone,
      confirmedPrice,
      currency
    ).catch((e) => console.warn('[dingtalk] notifyOrderPriceConfirmed failed', e))

    return NextResponse.json({
      success: true,
      message: '價格已確認！乘客將收到通知',
      order: {
        orderNumber: updated.order_number ?? order.order_number,
        confirmedPrice,
        priceCurrency: currency,
        priceConfirmedAt: updated.price_confirmed_at,
        status: 'price_confirmed',
      },
    })
  } catch (error: any) {
    console.error('Quote error:', error)
    return NextResponse.json(
      { success: false, error: '確認價格失敗', message: error?.message ?? '未知錯誤' },
      { status: 500 }
    )
  }
}
