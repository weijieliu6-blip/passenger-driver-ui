import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentDriver } from '@/lib/auth-server'

/**
 * 司機營收報表 API
 * GET /api/driver/reports?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 *
 * 回傳：
 *   - totalRevenue / orderCount / avgPerOrder
 *   - dailyRevenue: 每日的 revenue + orderCount
 *   - byServiceType: cross_border vs mainland_local
 *   - byTier: 訂單對應乘客下單時的會員等級（目前所有訂單都同源於 driver，等於自己訂單的分佈）
 *
 * 只計算 status = 'completed' 的訂單
 * 最大區間 31 天
 */

const MAX_DAYS = 31

function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const [, y, mo, d] = m
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
  return isNaN(dt.getTime()) ? null : dt
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function fillMissingDays(
  start: Date,
  end: Date,
  raw: Record<string, { revenue: number; count: number }>
): { date: string; revenue: number; orderCount: number }[] {
  const out: { date: string; revenue: number; orderCount: number }[] = []
  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime()) {
    const key = toYmd(cursor)
    out.push({
      date: key,
      revenue: raw[key]?.revenue || 0,
      orderCount: raw[key]?.count || 0,
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
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
    const startDateStr = searchParams.get('start_date')
    const endDateStr = searchParams.get('end_date')

    const now = new Date()
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    let start = new Date(todayUtc)
    start.setUTCDate(start.getUTCDate() - 29) // 預設 30 天
    let end = todayUtc

    if (startDateStr) {
      const d = parseDate(startDateStr)
      if (!d) return NextResponse.json({ success: false, error: 'start_date 格式錯誤' }, { status: 400 })
      start = d
    }
    if (endDateStr) {
      const d = parseDate(endDateStr)
      if (!d) return NextResponse.json({ success: false, error: 'end_date 格式錯誤' }, { status: 400 })
      end = d
    }

    if (start > end) {
      return NextResponse.json({ success: false, error: 'start_date 不能晚於 end_date' }, { status: 400 })
    }

    const dayDiff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
    if (dayDiff > MAX_DAYS) {
      return NextResponse.json(
        { success: false, error: `日期區間最多 ${MAX_DAYS} 天，目前 ${dayDiff} 天` },
        { status: 400 }
      )
    }

    const startIso = start.toISOString()
    const endExclusive = new Date(end)
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1)
    const endIso = endExclusive.toISOString()

    // 1. 取所有 completed 訂單（一次性 SELECT，不在 SQL 做聚合以便靈活組裝）
    const { data: rows, error } = await supabaseAdmin
      .from('orders')
      .select('order_number, status, service_type, confirmed_price, price_currency, completed_at, created_at')
      .eq('driver_id', driver.id)
      .eq('status', 'completed')
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('查報表失敗:', error)
      return NextResponse.json(
        { success: false, error: '查詢失敗', message: error.message },
        { status: 500 }
      )
    }

    let totalRevenue = 0
    const dayMap: Record<string, { revenue: number; count: number }> = {}
    const byService: Record<string, { revenue: number; count: number }> = {}
    const byTier: Record<string, { revenue: number; count: number }> = {}
    let orderCount = 0

    for (const o of rows || []) {
      const price = Number(o.confirmed_price || 0)
      if (!price) continue
      totalRevenue += price
      orderCount++

      const dayKey = (o.completed_at || o.created_at).slice(0, 10)
      dayMap[dayKey] = dayMap[dayKey] || { revenue: 0, count: 0 }
      dayMap[dayKey].revenue += price
      dayMap[dayKey].count++

      const svc = o.service_type || 'unknown'
      byService[svc] = byService[svc] || { revenue: 0, count: 0 }
      byService[svc].revenue += price
      byService[svc].count++

      // 訂單對應的「會員等級」目前系統中無此欄位；以司機自己的等級作為分組基準（最常見的做法）
      const tier = driver.membership_tier || 'gold'
      byTier[tier] = byTier[tier] || { revenue: 0, count: 0 }
      byTier[tier].revenue += price
      byTier[tier].count++
    }

    const dailyRevenue = fillMissingDays(start, end, dayMap)
    const byServiceType = Object.entries(byService).map(([service_type, v]) => ({
      service_type,
      revenue: Math.round(v.revenue * 100) / 100,
      count: v.count,
    }))
    const byTierOut = Object.entries(byTier).map(([tier, v]) => ({
      tier,
      revenue: Math.round(v.revenue * 100) / 100,
      count: v.count,
    }))

    return NextResponse.json({
      success: true,
      range: {
        start_date: toYmd(start),
        end_date: toYmd(end),
      },
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      orderCount,
      avgPerOrder: orderCount > 0 ? Math.round((totalRevenue / orderCount) * 100) / 100 : 0,
      dailyRevenue,
      byServiceType,
      byTier: byTierOut,
    })
  } catch (error: any) {
    console.error('報表查詢錯誤:', error)
    return NextResponse.json(
      { success: false, error: '查詢失敗', message: error.message },
      { status: 500 }
    )
  }
}
