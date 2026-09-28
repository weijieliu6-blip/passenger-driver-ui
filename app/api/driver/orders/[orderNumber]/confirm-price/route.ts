import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentDriver } from '@/lib/auth-server'
import type { PriceCurrency } from '@/lib/supabase'

/**
 * 司機確認價格 API
 * POST /api/driver/orders/[orderNumber]/confirm-price
 *
 * 流程：
 * 1. 驗證司機登入
 * 2. 驗證訂單歸屬該司機
 * 3. 設置 confirmed_price, price_currency, price_confirmed_at
 * 4. 狀態從 grabbed → price_confirmed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params

    // 1. 驗證司機登入
    const driver = await getCurrentDriver(request)
    if (!driver) {
      return NextResponse.json(
        { success: false, error: '請先登入司機帳號' },
        { status: 401 }
      )
    }

    // 2. 解析請求體
    const body = await request.json()
    const { confirmed_price, price_currency, vehicle_model, driving_years } = body

    // 3. 驗證必填字段
    if (!confirmed_price || typeof confirmed_price !== 'number' || confirmed_price <= 0) {
      return NextResponse.json(
        { success: false, error: '請輸入有效的價格' },
        { status: 400 }
      )
    }

    const currency: PriceCurrency = price_currency === 'CNY' ? 'CNY' : 'HKD'
    if (!['HKD', 'CNY'].includes(currency)) {
      return NextResponse.json(
        { success: false, error: '幣種必須是 HKD 或 CNY' },
        { status: 400 }
      )
    }

    // 4. 查詢訂單並驗證歸屬
    const { data: order, error: queryError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, status, driver_id, driver_name, passenger_id, passenger_name')
      .eq('order_number', orderNumber)
      .single()

    if (queryError || !order) {
      return NextResponse.json(
        { success: false, error: '訂單不存在' },
        { status: 404 }
      )
    }

    if (order.driver_id !== driver.id) {
      return NextResponse.json(
        { success: false, error: '您沒有權限操作此訂單' },
        { status: 403 }
      )
    }

    if (order.status !== 'grabbed' && order.status !== 'price_confirmed') {
      return NextResponse.json(
        {
          success: false,
          error: `訂單狀態為 ${order.status}，無法確認價格`,
        },
        { status: 400 }
      )
    }

    // 5. 更新訂單價格
    const updateData: any = {
      confirmed_price,
      price_currency: currency,
      price_confirmed_at: new Date().toISOString(),
      status: 'price_confirmed',
    }

    // 如果司機第一次報價，更新 driver_info 中的車輛型號和駕齡
    if (vehicle_model || driving_years !== undefined) {
      const infoUpdate: any = { updated_at: new Date().toISOString() }
      if (vehicle_model) infoUpdate.vehicle_model = vehicle_model
      if (typeof driving_years === 'number' && driving_years >= 0) {
        infoUpdate.driving_years = driving_years
      }

      await supabaseAdmin
        .from('driver_info')
        .update(infoUpdate)
        .eq('id', driver.id)
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('order_number', orderNumber)
      .select('id, order_number, confirmed_price, price_currency, price_confirmed_at, status')
      .single()

    if (updateError || !updated) {
      console.error('Update order error:', updateError)
      return NextResponse.json(
        { success: false, error: '更新訂單失敗，請稍後重試' },
        { status: 500 }
      )
    }

    console.log(
      `✅ 司機 ${driver.name} 確認訂單 ${orderNumber} 價格：${currency} ${confirmed_price}`
    )

    return NextResponse.json({
      success: true,
      message: '價格已確認！乘客將收到通知',
      order: {
        id: updated.id,
        orderNumber: updated.order_number,
        confirmedPrice: updated.confirmed_price,
        priceCurrency: updated.price_currency,
        priceConfirmedAt: updated.price_confirmed_at,
        status: updated.status,
      },
    })
  } catch (error: any) {
    console.error('Confirm price error:', error)
    return NextResponse.json(
      {
        success: false,
        error: '確認價格失敗',
        message: error.message || '未知錯誤',
      },
      { status: 500 }
    )
  }
}
