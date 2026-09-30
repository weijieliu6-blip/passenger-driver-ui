import { NextRequest, NextResponse } from 'next/server'
import { findDriverByStaffId } from '@/lib/driver-pool'
import { notifyOrderGrabbed } from '@/lib/dingtalk'
import { getCurrentDriver } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit'

/**
 * v1 釘釘搶單 — 司機池註冊 + 搶單
 *
 * 已棄用「以 staff_id 自動註冊 + 搶單」的舊流程（C4 漏洞）：
 *   - 任何人拿到任意 staff_id 就能冒充該司機註冊並搶單。
 *
 * 新流程（v2）：
 *   - 強制要求司機已透過 Supabase Auth cookie 登入。
 *   - GET 仍支援 ?staff_id= 作為輔助識別（向後相容）；
 *     POST 不再接受 body 註冊，僅用登入司機自己的 driver_info。
 *   - 搶單成功 UPDATE 同時清空 grab_token 防止重用（H4）。
 *
 * GET  /api/driver/grab/[token]?staff_id=xxx
 *   → 查詢訂單是否可搶；若 cookie 已登入司機 → 回傳該司機狀態
 *
 * POST /api/driver/grab/[token]
 *   → 司機必須已登入（cookie）；無需 body；原子搶單
 */

interface GrabRequestBody {
  staff_id?: string
  name?: string
  phone?: string
  plate?: string
  car_type?: 'sedan_5' | 'alphard_7' | 'business_9'
  driving_years?: number
  seats?: 5 | 7 | 9
}

function bad(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const staffId = request.nextUrl.searchParams.get('staff_id') ?? ''

    if (!token) return bad('缺少 token')

    // 查訂單
    const order = await fetchOrderForGrab(token)
    if (!order) return bad('訂單不存在', 404)

    const now = Date.now()
    if (order.status === 'grabbed' || order.status === 'price_confirmed') {
      return NextResponse.json(
        { success: false, status: order.status, message: '訂單已被其他司機搶走' },
        { status: 409 }
      )
    }
    if (order.status === 'cancelled') {
      return NextResponse.json(
        { success: false, status: 'cancelled', message: '訂單已取消' },
        { status: 409 }
      )
    }
    if (order.status === 'expired' || now > new Date(order.grabTokenExpiresAt).getTime()) {
      return NextResponse.json(
        { success: false, status: 'expired', message: '訂單已過期' },
        { status: 410 }
      )
    }

    // 查司機狀態：優先 cookie，其次 staff_id（向後相容 / UI 顯示）
    const driver = await getCurrentDriver(request)
    let existing = null
    if (driver) {
      // 從 driver_info 查公開資訊
      const { data } = await supabaseAdmin
        .from('driver_info')
        .select('vehicle_plate, vehicle_model, rating, driving_years, membership_tier')
        .eq('id', driver.id)
        .maybeSingle()
      existing = data
        ? {
            id: driver.id,
            name: driver.name,
            phone: driver.phone,
            plate: data.vehicle_plate,
            carType: data.vehicle_model,
            membershipTier: data.membership_tier,
          }
        : { id: driver.id, name: driver.name, phone: driver.phone }
    } else if (staffId) {
      // 僅用於 UI 顯示「請登入」前的狀態；不能用於搶單
      try {
        existing = await findDriverByStaffId(staffId)
      } catch {
        existing = null
      }
    }

    return NextResponse.json({
      success: true,
      order,
      driver: existing,
      needsRegistration: !existing,
      authenticated: !!driver,
    })
  } catch (error) {
    console.error('[GET /api/driver/grab/[token]] error:', error)
    return bad(error instanceof Error ? error.message : '查詢失敗', 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token) return bad('缺少 token')

    // Rate limit：搶單（POST）。
    // 改為 per-driver：原本 key 是 grab:${token}，每 token 各算一次，
    //   導致單一司機可以無限搶不同訂單（撞不到限流）；改為 grab:${driverId}。
    // 先做 auth 才能拿到 driverId
    const driver = await getCurrentDriver(request)
    if (!driver) {
      return NextResponse.json(
        {
          success: false,
          error: '請先登入司機帳號',
          requireLogin: true,
          loginUrl: `/driver/login?redirect=${encodeURIComponent(`/driver/grab/${token}`)}`,
        },
        { status: 401 }
      )
    }

    const rl = rateLimit(`grab:${driver.id}`, RATE_LIMITS.grab)
    if (!rl.allowed) {
      const seconds = Math.ceil(rl.resetMs / 1000)
      return NextResponse.json(
        { success: false, error: `請求太頻繁，請於 ${seconds} 秒後重試` },
        {
          status: 429,
          headers: { 'Retry-After': String(seconds) },
        }
      )
    }

    // 1) 強制要求司機已登入（已上移，這裡僅保留註解）

    // body 已忽略——不再支援 staff_id 註冊 / 改姓名 / 改電話
    // 保留 body 解析僅為偵錯舊呼叫端
    try {
      const _body = (await request.json()) as GrabRequestBody
      void _body
    } catch {
      // 空 body 也是合法的
    }

    // 2) 確保 driver_info 存在（首次登入後尚未填資料的司機不能搶單）
    const { data: driverInfo } = await supabaseAdmin
      .from('driver_info')
      .select('vehicle_plate')
      .eq('id', driver.id)
      .maybeSingle()

    if (!driverInfo?.vehicle_plate) {
      return NextResponse.json(
        {
          success: false,
          error: '請先完善車牌資料',
          requireProfileUpdate: true,
          profileUrl: '/driver/profile',
        },
        { status: 400 }
      )
    }

    const driverPlate = driverInfo.vehicle_plate

    // 3) 原子搶單 + 清空 grab_token 防止重用（H4）
    //    grab_token 欄位目前 NOT NULL + UNIQUE（migration 20260930 才會改），
    //    用 '__CONSUMED__-<ts>-<rand>' 作為唯一 sentinel；後續 deployment 跑 migration 後可改回 NULL
    const consumedMarker = '__CONSUMED__-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)
    const { data: order, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'grabbed',
        driver_id: driver.id,
        driver_name: driver.name,
        driver_phone: driver.phone,
        driver_plate: driverPlate,
        grabbed_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
        first_driver_offered_at: new Date().toISOString(),
        grab_token: consumedMarker,
      })
      .eq('grab_token', token)
      .eq('status', 'pending')
      .select()
      .single()

    if (updateError || !order) {
      const { data: currentOrder } = await supabaseAdmin
        .from('orders')
        .select('status, order_number')
        .eq('grab_token', token)
        .single()

      if (currentOrder?.status === 'grabbed' || currentOrder?.status === 'price_confirmed') {
        return NextResponse.json({
          success: false,
          status: currentOrder.status,
          message: '來晚了，訂單已被其他司機搶走',
        })
      }

      return NextResponse.json(
        { error: '搶單失敗，訂單可能已被搶或已過期' },
        { status: 400 }
      )
    }

    console.log(
      '✅ 訂單被搶:',
      order.order_number,
      '司機:',
      driver.name,
      '(ID:',
      driver.id,
      ')'
    )

    // 4) 釘釘「訂單已接」通知
    try {
      const pushResult = await notifyOrderGrabbed(
        order.order_number,
        driver.name,
        driver.phone
      )
      if (!pushResult?.success) {
        console.error(`❌ 「訂單已接」推送失敗: #${order.order_number}`, pushResult?.error)
      }
    } catch (e) {
      console.error(`❌ 「訂單已接」推送異常: #${order.order_number}`, e)
    }

    // 5) 回傳乘客聯繫方式（給司機下一步打電話用）
    return NextResponse.json({
      success: true,
      message: '搶單成功',
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        plate: driverPlate,
      },
      order: {
        orderNumber: order.order_number,
        passengerName: order.passenger_name,
        passengerPhone: order.passenger_phone,
      },
    })
  } catch (error) {
    console.error('[POST /api/driver/grab/[token]] error:', error)
    return bad(error instanceof Error ? error.message : '搶單失敗', 500)
  }
}

// 內部 helper：只撈搶單頁需要的欄位
async function fetchOrderForGrab(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const url = `${supabaseUrl}/rest/v1/orders?grab_token=eq.${encodeURIComponent(token)}&select=id,order_number,status,grab_token,grab_token_expires_at,passenger_name,passenger_phone,pickup_location,pickup_area,dropoff_location,dropoff_area,departure_time,passengers,luggage,vehicle_type,has_child,child_type,passenger_notes,estimated_fare&limit=1`
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const arr = (await res.json()) as any[]
  if (!arr || arr.length === 0) return null
  const o = arr[0]
  return {
    id: o.id,
    orderNumber: o.order_number,
    status: o.status,
    grabTokenExpiresAt: o.grab_token_expires_at,
    pickupLocation: o.pickup_area ? `${o.pickup_location} ${o.pickup_area}` : o.pickup_location,
    dropoffLocation: o.dropoff_area ? `${o.dropoff_location} ${o.dropoff_area}` : o.dropoff_location,
    departureTime: o.departure_time,
    passengers: o.passengers,
    luggage: o.luggage,
    vehicleType: o.vehicle_type,
    hasChild: o.has_child,
    childType: o.child_type,
    notes: o.passenger_notes,
    estimatedFare: o.estimated_fare,
  }
}
