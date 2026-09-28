import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentDriver } from '@/lib/auth-server'

/**
 * 司機狀態 API
 * GET  /api/driver/status         取得當前司機狀態
 * PATCH /api/driver/status        body { status: 'available' | 'offline' }
 *
 * 注意：on_trip 為伺服器專用（搶單成功後由系統切換），
 *      司機無法主動設為 on_trip。
 */

const SUPABASE_URL = 'https://vuuamydahzhpajjdvokl.supabase.co'

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET(request: NextRequest) {
  try {
    const driver = await getCurrentDriver(request)
    if (!driver || driver.role !== 'driver') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getAdminClient()
    const { data, error } = await supabaseAdmin
      .from('driver_info')
      .select('status')
      .eq('id', driver.id)
      .maybeSingle()

    if (error) {
      console.error('查司機狀態失敗:', error)
      return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      status: data?.status || 'offline',
    })
  } catch (error: any) {
    console.error('Get driver status failed:', error)
    return NextResponse.json(
      { error: '服務錯誤', message: error.message },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const driver = await getCurrentDriver(request)
    if (!driver || driver.role !== 'driver') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const next = body?.status

    if (!['on_trip', 'available', 'offline'].includes(next)) {
      return NextResponse.json(
        { error: '無效的狀態值' },
        { status: 400 }
      )
    }

    // on_trip 只能由伺服器在搶單成功後設定，司機不能主動切
    if (next === 'on_trip') {
      return NextResponse.json(
        {
          error: '禁止手動設定 on_trip 狀態',
          hint: 'on_trip 由伺服器在搶單成功後自動設定，完成訂單後再切換',
        },
        { status: 403 }
      )
    }

    const supabaseAdmin = getAdminClient()
    const { data, error } = await supabaseAdmin
      .from('driver_info')
      .update({ status: next })
      .eq('id', driver.id)
      .select('status')
      .single()

    if (error) {
      console.error('更新司機狀態失敗:', error)
      return NextResponse.json({ error: '更新失敗' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      status: data.status,
    })
  } catch (error: any) {
    console.error('Update driver status failed:', error)
    return NextResponse.json(
      { error: '服務錯誤', message: error.message },
      { status: 500 }
    )
  }
}
