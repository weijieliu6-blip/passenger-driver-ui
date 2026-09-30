import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/cs/conversations
 * 取得當前用戶的會話列表（最近 20 個）
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

  const { data, error } = await userClient
    .from('cs_conversations')
    .select('id, status, subject, assigned_admin_id, last_message_at, created_at, closed_at')
    .order('last_message_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[cs/conversations] err:', error)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }

  return NextResponse.json({ success: true, conversations: data ?? [] })
}