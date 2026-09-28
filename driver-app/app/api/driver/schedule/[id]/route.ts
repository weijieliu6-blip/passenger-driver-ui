import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentDriver } from '@/lib/auth-server'

/**
 * 刪除單條排程
 * DELETE /api/driver/schedule/[id]
 */

const SUPABASE_URL = 'https://vuuamydahzhpajjdvokl.supabase.co'

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const driver = await getCurrentDriver(request)
    if (!driver || driver.role !== 'driver') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 })
    }

    const supabaseAdmin = getAdminClient()
    // 只能刪自己的排程
    const { error } = await supabaseAdmin
      .from('driver_schedules')
      .delete()
      .eq('id', id)
      .eq('driver_id', driver.id)

    if (error) {
      console.error('刪除排程失敗:', error)
      return NextResponse.json({ error: '刪除失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete schedule failed:', error)
    return NextResponse.json(
      { error: '服務錯誤', message: error.message },
      { status: 500 }
    )
  }
}
