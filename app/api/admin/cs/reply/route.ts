import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

const BodySchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().min(1).max(2000),
})

/**
 * POST /api/admin/cs/reply
 * Admin 客服：回覆用戶（自動把會話狀態改為 human_active）
 *
 * 保護：admin role only
 */
export async function POST(request: NextRequest) {
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
  const adminId = userData.user.id

  // 確認 admin
  const { data: me } = await userClient.from('users').select('role').eq('id', adminId).maybeSingle()
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: '需要 admin 權限' }, { status: 403 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效 JSON' }, { status: 400 })
  }
  const parse = BodySchema.safeParse(body)
  if (!parse.success) return NextResponse.json({ error: '缺少 conversation_id / content' }, { status: 400 })

  const { conversation_id, content } = parse.data

  // 寫入訊息
  const { data: msg, error: msgErr } = await userClient.from('cs_messages').insert({
    conversation_id,
    sender_id: adminId,
    sender_role: 'admin',
    content: content.trim(),
  }).select('id, sender_role, content, created_at').single()

  if (msgErr) {
    console.error('[admin/cs/reply] msg err:', msgErr)
    return NextResponse.json({ error: '送出失敗' }, { status: 500 })
  }

  // 更新會話狀態
  await userClient
    .from('cs_conversations')
    .update({
      status: 'human_active',
      assigned_admin_id: adminId,
      last_message_at: new Date().toISOString(),
    })
    .eq('id', conversation_id)

  return NextResponse.json({ success: true, message: msg })
}