import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * 預估價格 API（前端用）
 * POST /api/pricing/estimate
 *
 * Body：
 *   pickup_zone_code  - 起點 zone code（例 'hk_central'）
 *   dropoff_zone_code - 終點 zone code
 *   vehicle_type      - '4_seat' | '7_seat'
 *   departure_time    - ISO 字串（用於判斷夜間加成，可選）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pickup_zone_code, dropoff_zone_code, vehicle_type, departure_time } = body

    if (!pickup_zone_code || !dropoff_zone_code || !vehicle_type) {
      return NextResponse.json(
        { success: false, error: '缺少 pickup_zone_code / dropoff_zone_code / vehicle_type' },
        { status: 400 }
      )
    }
    if (!['4_seat', '7_seat'].includes(vehicle_type)) {
      return NextResponse.json({ success: false, error: 'vehicle_type 必須為 4_seat 或 7_seat' }, { status: 400 })
    }

    // 呼叫 RPC（含雙向 fallback + 夜間加成邏輯）
    const { data, error } = await supabaseAdmin.rpc('get_pricing_estimate', {
      p_pickup_zone: pickup_zone_code,
      p_dropoff_zone: dropoff_zone_code,
      p_vehicle_type: vehicle_type,
      p_departure_time: departure_time || null,
    })

    if (error) {
      console.error('[pricing/estimate] RPC error:', error)
      return NextResponse.json({ success: false, error: '估算失敗' }, { status: 500 })
    }

    if (!data?.found) {
      return NextResponse.json({
        success: true,
        found: false,
        message: data?.message || '此路線暫無標準報價，司機將自行報價',
      })
    }

    return NextResponse.json({
      success: true,
      found: true,
      base_price: Number(data.base_price),
      night_surcharge: Number(data.night_surcharge || 0),
      total_price: Number(data.total_price),
      currency: data.currency || 'HKD',
      estimated_minutes: data.estimated_minutes,
      notes: data.notes,
    })
  } catch (e) {
    console.error('[pricing/estimate] error:', e)
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}