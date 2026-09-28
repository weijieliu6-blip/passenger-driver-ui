import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * 更新司機招募申請狀態
 * PATCH /api/admin/applications/[id]
 * Body: { status: 'pending'|'reviewing'|'approved'|'rejected', reviewer_note?: string }
 *
 * 注意：admin UI 沒接登入權限，先信任 SSR session 後續接上
 */

const VALID_STATUSES = ['pending', 'reviewing', 'approved', 'rejected'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { status, reviewer_note } = body as { status?: string; reviewer_note?: string }

    if (!status || !VALID_STATUSES.includes(status as any)) {
      return NextResponse.json(
        { success: false, error: `狀態無效（需為 ${VALID_STATUSES.join(' / ')}）` },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ success: false, error: '伺服器配置錯誤' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const update: Record<string, any> = { status }
    if (typeof reviewer_note === 'string') {
      update.reviewer_note = reviewer_note.trim() || null
    }
    if (status !== 'pending') {
      update.reviewed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('driver_applications')
      .update(update)
      .eq('id', id)
      .select('id, status, reviewer_note, reviewed_at')
      .single()

    if (error) {
      console.error('[admin/applications PATCH] error:', error)
      return NextResponse.json(
        { success: false, error: '更新失敗：' + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, application: data })
  } catch (err) {
    console.error('[admin/applications PATCH] unexpected:', err)
    return NextResponse.json({ success: false, error: '伺服器異常' }, { status: 500 })
  }
}
