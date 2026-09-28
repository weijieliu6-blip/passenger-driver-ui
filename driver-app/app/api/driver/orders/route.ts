import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentDriver } from '@/lib/auth-server'

/**
 * 司機訂單列表 API
 * GET /api/driver/orders?driver_id=xxx
 *      &start_date=YYYY-MM-DD
 *      &end_date=YYYY-MM-DD
 *      &status=pending|grabbed|price_confirmed|completed|cancelled
 *
 * - 只回當前司機的訂單（driver_id 來自 auth）
 * - start_date / end_date 為包含邊界的日期區間（最大 31 天）
 * - status 為可選過濾
 * - 包含 cancelled 與 completed
 * - 依 created_at DESC 排序
 */

const MAX_DAYS = 31

function parseDate(s: string): Date | null {
  // Accept YYYY-MM-DD；時區以 UTC 解析一天，避免跨日誤差
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const [, y, mo, d] = m
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
  return isNaN(dt.getTime()) ? null : dt
}

export async function GET(request: NextRequest) {
  try {
    const driver = await getCurrentDriver(request)
    if (!driver) {
      return NextResponse.json(
        { success: false, error: '請先登入司機帳號' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const queryDriverId = searchParams.get('driver_id')
    const startDateStr = searchParams.get('start_date')
    const endDateStr = searchParams.get('end_date')
    const statusFilter = searchParams.get('status')

    if (queryDriverId && queryDriverId !== driver.id) {
      return NextResponse.json(
        { success: false, error: '無權訪問其他司機的訂單' },
        { status: 403 }
      )
    }

    // 預設區間：最近 7 天（包含今天）
    const now = new Date()
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    let start = new Date(todayUtc)
    start.setUTCDate(start.getUTCDate() - 6) // 過去 7 天
    let end = todayUtc

    if (startDateStr) {
      const d = parseDate(startDateStr)
      if (!d) {
        return NextResponse.json({ success: false, error: 'start_date 格式錯誤' }, { status: 400 })
      }
      start = d
    }
    if (endDateStr) {
      const d = parseDate(endDateStr)
      if (!d) {
        return NextResponse.json({ success: false, error: 'end_date 格式錯誤' }, { status: 400 })
      }
      end = d
    }

    if (start > end) {
      return NextResponse.json(
        { success: false, error: 'start_date 不能晚於 end_date' },
        { status: 400 }
      )
    }

    const dayDiff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
    if (dayDiff > MAX_DAYS) {
      return NextResponse.json(
        { success: false, error: `日期區間最多 ${MAX_DAYS} 天，目前 ${dayDiff} 天` },
        { status: 400 }
      )
    }

    // 包含 end_date 整天：end_of_day = end_date + 1 day (exclusive)
    const startIso = start.toISOString()
    const endExclusive = new Date(end)
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1)
    const endIso = endExclusive.toISOString()

    let query = supabaseAdmin
      .from('orders')
      .select('*')
      .eq('driver_id', driver.id)
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .order('created_at', { ascending: false })

    if (statusFilter && statusFilter !== 'all') {
      const allowed = ['pending', 'grabbed', 'price_confirmed', 'completed', 'cancelled', 'expired']
      if (!allowed.includes(statusFilter)) {
        return NextResponse.json(
          { success: false, error: `無效的 status: ${statusFilter}` },
          { status: 400 }
        )
      }
      query = query.eq('status', statusFilter)
    }

    const { data: orders, error } = await query

    if (error) {
      console.error('查詢司機訂單失敗:', error)
      return NextResponse.json(
        { success: false, error: '查詢訂單失敗', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      orders: orders || [],
      count: orders?.length || 0,
      range: {
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
      },
    })
  } catch (error: any) {
    console.error('司機訂單列表錯誤:', error)
    return NextResponse.json(
      { success: false, error: '查詢失敗', message: error.message },
      { status: 500 }
    )
  }
}
