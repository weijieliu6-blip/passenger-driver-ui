import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/cs/conversations/[id]/messages
 * 取得某會話的所有訊息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }
  const token = authHeader.slice(7)
  const since = request.nextUrl.searchParams.get('since')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: userData } = await userClient.auth.getUser()
  if (!userData.user) return NextResponse.json({ error: 'Token 無效' }, { status: 401 })
  const userId = userData.user.id

  // 確認授權（自己的會話或 admin）
  const { data: conv } = await userClient
    .from('cs_conversations')
    .select('id, user_id, status')
    .eq('id', id)
    .maybeSingle()
  if (!conv) return NextResponse.json({ error: '會話不存在' }, { status: 404 })

  const { data: me } = await userClient.from('users').select('role').eq('id', userId).maybeSingle()
  const role = me?.role || 'passenger'
  const isAuthorized = conv.user_id === userId || role === 'admin'
  if (!isAuthorized) return NextResponse.json({ error: '無權限' }, { status: 403 })

  let query = userClient
    .from('cs_messages')
    .select('id, conversation_id, sender_id, sender_role, content, ai_confidence, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(500)
  if (since) query = query.gt('created_at', since)

  const { data, error } = await query
  if (error) {
    console.error('[cs/messages GET] err:', error)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }

  return NextResponse.json({ success: true, messages: data ?? [], conversation: conv })
}