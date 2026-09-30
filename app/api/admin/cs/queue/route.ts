import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/admin/cs/queue
 * Admin 取得待處理會話列表（status = human_needed 或 human_active）
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: userData } = await userClient.auth.getUser()
  if (!userData.user) return NextResponse.json({ error: 'Token 無效' }, { status: 401 })

  const { data: me } = await userClient.from('users').select('role').eq('id', userData.user.id).maybeSingle()
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: '需要 admin 權限' }, { status: 403 })
  }

  const { data, error } = await userClient
    .from('cs_conversations')
    .select('id, user_id, status, subject, assigned_admin_id, last_message_at, created_at')
    .in('status', ['human_needed', 'human_active'])
    .order('last_message_at', { ascending: true })

  if (error) {
    console.error('[admin/cs/queue] err:', error)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }

  return NextResponse.json({ success: true, conversations: data ?? [] })
}