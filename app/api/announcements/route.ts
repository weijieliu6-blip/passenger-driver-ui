import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getDailyBookingTips } from '@/lib/booking-tips'
import { getHolidayMessages } from '@/lib/holidays'

/**
 * 乘客端跑馬燈公告 API
 * GET /api/announcements
 *
 * 回傳結構（v2）：
 * {
 *   success: true,
 *   date: 'YYYY-MM-DD',
 *   virtual: string[]         // 當天 20 條 seeded 模擬熱訊（lib/booking-tips.ts）
 *   holiday: string[]         // 節假日文案（lib/holidays.ts，可能為空）
 *   db: Array<{ message, kind }>  // 啟用中的 DB 公告
 * }
 *
 * 設計：
 *   - virtual 用「當天日期 yyyymmdd」seed，每天 00:00 自動換內容
 *   - DB 查詢失敗時 graceful fallback：db = []
 *   - 不寫 DB、不需要 cron
 */
export async function GET(_request: NextRequest) {
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // 1) virtual（seeded 模擬熱訊，每天 20 條）
  let virtual: string[] = []
  try {
    virtual = getDailyBookingTips(now, 20)
  } catch (err) {
    console.warn('[announcements] 計算 virtual 失敗:', err)
  }

  // 2) holiday（節假日文案）
  let holiday: string[] = []
  try {
    holiday = getHolidayMessages(now)
  } catch (err) {
    console.warn('[announcements] 計算 holiday 失敗:', err)
  }

  // 3) db（從 Supabase 拉啟用中的公告；失敗回傳空陣列）
  let db: Array<{ message: string; kind: string }> = []
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    if (serviceRoleKey) {
      if (!supabaseUrl) {
        console.warn('[announcements] NEXT_PUBLIC_SUPABASE_URL 未設定，略過公告查詢')
        // env 未設定就不查；db 仍會是空陣列
      } else {
        const supabase = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
        const { data, error } = await supabase
          .from('announcements')
          .select('message, kind')
          .eq('active', true)
          .lte('starts_at', now.toISOString())
          .or('ends_at.is.null,ends_at.gte.' + now.toISOString())
          .order('created_at', { ascending: false })
          .limit(20)

        if (!error && data) {
          db = data.map((row) => ({ message: row.message, kind: row.kind }))
        } else if (error) {
          console.warn('[announcements] 查詢公告失敗:', error.message)
        }
      }
    }
  } catch (err) {
    console.warn('[announcements] Supabase 連線失敗（將回空清單）:', err)
  }

  return NextResponse.json({
    success: true,
    date: dateStr,
    virtual,
    holiday,
    db,
  })
}