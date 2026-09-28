import { NextRequest, NextResponse } from 'next/server'

/**
 * 乘客端輪詢用 — 訂單狀態 + 司機資訊（若有）
 * GET /api/orders/[orderNumber]/status
 *
 * 回傳：{ orderNumber, status, driver?: { name, phone, plate }, updatedAt }
 * 比 /api/orders/[orderNumber] 更輕量；不附帶 user/driver_info 等 join
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params
    if (!orderNumber) {
      return NextResponse.json({ error: '缺少 orderNumber' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Supabase 未配置' }, { status: 500 })
    }

    const url =
      `${supabaseUrl}/rest/v1/orders?order_number=eq.${encodeURIComponent(orderNumber)}` +
      `&select=order_number,status,grabbed_at,driver_name,driver_phone,driver_plate,updated_at` +
      `&limit=1`
    const res = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }
    const rows = (await res.json()) as any[]
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: '訂單不存在' }, { status: 404 })
    }
    const o = rows[0]

    const payload: any = {
      orderNumber: o.order_number,
      status: o.status,
      updatedAt: o.updated_at,
    }
    if (o.status === 'grabbed' || o.status === 'price_confirmed' || o.status === 'completed') {
      if (o.driver_name || o.driver_phone || o.driver_plate) {
        payload.driver = {
          name: o.driver_name ?? null,
          phone: o.driver_phone ?? null,
          plate: o.driver_plate ?? null,
        }
      }
    }
    if (o.grabbed_at) payload.grabbedAt = o.grabbed_at

    return NextResponse.json(payload, {
      headers: {
        // 強制 CDN/瀏覽器不緩存
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('[GET /api/orders/[orderNumber]/status] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查詢失敗' },
      { status: 500 }
    )
  }
}