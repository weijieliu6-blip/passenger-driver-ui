import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * 地點搜尋 API
 * GET /api/locations/search?q=中環&region=hk&limit=10
 *
 * 查詢參數：
 *   q       - 搜尋關鍵字（中英文皆可，模糊匹配）
 *   region  - 過濾區域 'hk' | 'mainland'（可選）
 *   category - 過濾類別 'airport' | 'port' | 'mall' | 'hotel' | 'station' | 'landmark' | 'residential'（可選）
 *   limit   - 限制回傳數量（預設 10，上限 50）
 *
 * 回傳：locations[] + 是否需要手動輸入提示（如果 q 太短或無匹配）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const region = searchParams.get('region')
    const category = searchParams.get('category')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50)

    // 太短或空字串：回傳熱門地點
    if (!q || q.length < 1) {
      const { data: popular } = await supabaseAdmin
        .from('locations')
        .select('id, code, name_zh, name_en, region, category, zone_code, address_zh, lat, lng')
        .eq('active', true)
        .order('category', { ascending: true })
        .limit(limit)
      return NextResponse.json({
        success: true,
        locations: popular ?? [],
        showManualInput: true,
      })
    }

    // 模糊搜尋（中英文皆可）
    // ILIKE 在 Postgres 不支援中文模糊，所以用 OR 條件覆蓋
    let query = supabaseAdmin
      .from('locations')
      .select('id, code, name_zh, name_en, region, category, zone_code, address_zh, lat, lng')
      .eq('active', true)
      .or(`name_zh.ilike.%${q}%,name_en.ilike.%${q}%,code.ilike.%${q}%,address_zh.ilike.%${q}%`)
      .order('name_zh', { ascending: true })
      .limit(limit)

    if (region) query = query.eq('region', region)
    if (category) query = query.eq('category', category)

    const { data, error } = await query
    if (error) {
      console.error('[locations/search] error:', error)
      return NextResponse.json({ success: false, error: '搜尋失敗' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      locations: data ?? [],
      // 若無匹配，建議用戶手動輸入
      showManualInput: !data || data.length === 0,
    })
  } catch (e) {
    console.error('[locations/search] error:', e)
    return NextResponse.json({ success: false, error: '伺服器錯誤' }, { status: 500 })
  }
}