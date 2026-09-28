import { NextRequest, NextResponse } from 'next/server'
import { findDriverByStaffId } from '@/lib/driver-pool'
import { notifyOrderPriceConfirmed } from '@/lib/dingtalk'

/**
 * 司機搶單後報價 API（用 grab_token + staff_id，不需要 session）
 * POST /api/driver/grab/[token]/quote
 *
 * body: { staff_id, confirmed_price, price_currency, vehicle_model?, driving_years? }
 *
 * 流程：
 * 1) 根據 staff_id 找 driver
 * 2) 驗證訂單歸屬該司機（grab_token + grabbed_by_driver_id）
 * 3) 狀態從 grabbed → price_confirmed
 * 4) 推送釘釘「報價已確認」通知給乘客/群組
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const staffId = String(body.staff_id ?? '').trim()
    const confirmedPrice = Number(body.confirmed_price)
    const currency = body.price_currency === 'CNY' ? 'CNY' : 'HKD'

    if (!staffId) {
      return NextResponse.json({ success: false, error: '缺少 staff_id' }, { status: 400 })
    }
    if (!Number.isFinite(confirmedPrice) || confirmedPrice <= 0) {
      return NextResponse.json({ success: false, error: '請輸入有效的價格' }, { status: 400 })
    }
    if (!['HKD', 'CNY'].includes(currency)) {
      return NextResponse.json({ success: false, error: '幣種必須是 HKD 或 CNY' }, { status: 400 })
    }

    const driver = await findDriverByStaffId(staffId).catch(() => null)
    if (!driver) {
      return NextResponse.json({ success: false, error: '司機資料不存在' }, { status: 404 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // 查訂單（用 grab_token）
    const lookupRes = await fetch(
      `${supabaseUrl}/rest/v1/orders?grab_token=eq.${encodeURIComponent(token)}&select=id,order_number,status,grabbed_by_driver_id,driver_name,passenger_name&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: 'no-store',
      }
    )
    if (!lookupRes.ok) {
      return NextResponse.json({ success: false, error: '查詢訂單失敗' }, { status: 500 })
    }
    const arr = (await lookupRes.json()) as any[]
    if (!arr || arr.length === 0) {
      return NextResponse.json({ success: false, error: '訂單不存在' }, { status: 404 })
    }
    const order = arr[0]

    if (order.grabbed_by_driver_id !== driver.id) {
      return NextResponse.json({ success: false, error: '您沒有權限操作此訂單' }, { status: 403 })
    }
    if (order.status !== 'grabbed' && order.status !== 'price_confirmed') {
      return NextResponse.json(
        { success: false, error: `訂單狀態為 ${order.status}，無法確認價格` },
        { status: 400 }
      )
    }

    // 更新訂單價格
    const updateRes = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${order.id}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        confirmed_price: confirmedPrice,
        price_currency: currency,
        price_confirmed_at: new Date().toISOString(),
        status: 'price_confirmed',
      }),
    })

    if (!updateRes.ok) {
      const errText = await updateRes.text()
      console.error('Update order failed:', errText)
      return NextResponse.json({ success: false, error: '更新訂單失敗' }, { status: 500 })
    }

    const updatedArr = (await updateRes.json()) as any[]
    const updated = updatedArr?.[0]

    // 更新 driver_info 中的車型/駕齡（如果有帶）
    if (body.vehicle_model || body.driving_years !== undefined) {
      const infoUpdate: any = { updated_at: new Date().toISOString() }
      if (body.vehicle_model) infoUpdate.vehicle_model = body.vehicle_model
      if (typeof body.driving_years === 'number') infoUpdate.driving_years = body.driving_years
      await fetch(`${supabaseUrl}/rest/v1/driver_info?id=eq.${driver.id}`, {
        method: 'PATCH',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(infoUpdate),
      }).catch((e) => console.warn('driver_info update warn', e))
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
