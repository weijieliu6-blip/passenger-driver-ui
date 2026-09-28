import { NextRequest, NextResponse } from 'next/server'
import { findDriverByStaffId, registerDriver, grabOrderAtomically, incrementDriverGrab } from '@/lib/driver-pool'
import { notifyOrderGrabbed } from '@/lib/dingtalk'

/**
 * v1 釘釘搶單 — 司機池註冊 + 搶單
 *
 * GET  /api/driver/grab/[token]?staff_id=xxx
 *   → 查詢訂單是否可搶；若 staff_id 已綁定司機就回傳已註冊狀態
 *
 * POST /api/driver/grab/[token]
 *   body: { staff_id, name?, phone?, plate?, car_type?, driving_years?, seats? }
 *   → 若 staff_id 已存在於 drivers 表 → 直接搶單
 *   → 否則 → 用剩餘欄位註冊後搶單
 *
 * 並發安全：以 `UPDATE orders SET status='grabbed' WHERE grab_token=... AND status='pending'`
 *         作為原子守門；沒搶到就回 409（已被搶）或 410（過期）
 */

interface GrabRequestBody {
  staff_id: string
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

const CAR_TYPE_MAP = ['sedan_5', 'alphard_7', 'business_9'] as const
const SEATS = [5, 7, 9] as const

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

    // 查司機是否已註冊
    let existing = null
    if (staffId) {
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

    const body = (await request.json()) as GrabRequestBody
    if (!body.staff_id || typeof body.staff_id !== 'string') {
      return bad('缺少 staff_id')
    }

    // 1) 確保司機存在
    let driver = await findDriverByStaffId(body.staff_id).catch(() => null)
    if (!driver) {
      // 第一次註冊：必填欄位驗證
      const missing: string[] = []
      if (!body.name) missing.push('name')
      if (!body.phone) missing.push('phone')
      if (!body.plate) missing.push('plate')
      if (!body.car_type) missing.push('car_type')
      if (body.driving_years === undefined || body.driving_years === null) missing.push('driving_years')
      if (!body.seats) missing.push('seats')
      if (missing.length > 0) {
        return bad(`缺少必填欄位: ${missing.join(', ')}`)
      }

      // 簡單格式驗證
      const phoneOk = /^[\d\-\+\s]{6,20}$/.test(body.phone!)
      if (!phoneOk) return bad('電話格式不正確')
      const dy = Number(body.driving_years)
      if (!Number.isFinite(dy) || dy < 0 || dy > 50) return bad('駕齡需為 0-50 之間的整數')
      if (!CAR_TYPE_MAP.includes(body.car_type!)) return bad('不支援的車類型')
      if (!SEATS.includes(body.seats!)) return bad('座位數需為 5/7/9')

      try {
        driver = await registerDriver({
          dingtalk_staff_id: body.staff_id,
          name: body.name!,
          phone: body.phone!,
          plate: body.plate!,
          car_type: body.car_type!,
          driving_years: dy,
          seats: body.seats!,
        })
      } catch (e) {
        return bad('註冊司機失敗：' + (e instanceof Error ? e.message : '未知錯誤'))
      }
    }

    // 2) 原子搶單
    const result = await grabOrderAtomically(
      token,
      driver.id,
      driver.name,
      driver.phone,
      driver.plate
    )

    if (!result.ok) {
      if (result.reason === 'not_found') return bad('訂單不存在', 404)
      if (result.reason === 'expired') {
        return NextResponse.json(
          { success: false, status: 'expired', message: '訂單已過期' },
          { status: 410 }
        )
      }
      // already_grabbed
      return NextResponse.json(
        { success: false, status: 'grabbed', message: '來晚了，訂單已被其他司機搶走' },
        { status: 409 }
      )
    }

    // 3) 累加搶單次數（非關鍵，失敗不影響）
    incrementDriverGrab(driver.id).catch((e) => console.warn('incrementDriverGrab failed', e))

    // 4) 釘釘通知（非阻塞）
    notifyOrderGrabbed(result.order.order_number, driver.name, driver.phone).catch((e) =>
      console.warn('notifyOrderGrabbed failed', e)
    )

    // 5) 回傳乘客聯繫方式（給司機下一步打電話用）
    return NextResponse.json({
      success: true,
      message: '搶單成功',
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        plate: driver.plate,
      },
      order: {
        orderNumber: result.order.order_number,
        passengerName: result.order.passenger_name,
        passengerPhone: result.order.passenger_phone,
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