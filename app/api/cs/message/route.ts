import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { matchFaq, shouldEscalate, FAQ } from '@/lib/cs-faq'

const BodySchema = z.object({
  conversation_id: z.string().uuid().optional(),  // 已存在會話時帶
  message: z.string().min(1).max(2000),
})

/**
 * POST /api/cs/message
 * 客服會話：用戶發送訊息 → AI 回覆，必要時升級人工
 *
 * Body: { conversation_id?, message }
 * 回傳: { conversation_id, status, messages: [{role, content, created_at, ...}], escalated: boolean }
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
  const userId = userData.user.id

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '無效 JSON' }, { status: 400 })
  }
  const parse = BodySchema.safeParse(body)
  if (!parse.success) return NextResponse.json({ error: '缺少 message' }, { status: 400 })
  const { conversation_id, message } = parse.data

  // 1) 取得 / 建立會話
  let convId = conversation_id
  if (!convId) {
    const { data: newConv, error: convErr } = await userClient
      .from('cs_conversations')
      .insert({ user_id: userId, status: 'ai' })
      .select('id')
      .single()
    if (convErr) {
      console.error('[cs/message] create conv err:', convErr)
      return NextResponse.json({ error: '建立會話失敗' }, { status: 500 })
    }
    convId = newConv.id
  } else {
    // 確認授權
    const { data: conv } = await userClient.from('cs_conversations').select('id, status, user_id').eq('id', convId).maybeSingle()
    if (!conv || conv.user_id !== userId) {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }
  }

  // 2) 寫入用戶訊息
  const { error: userMsgErr } = await userClient.from('cs_messages').insert({
    conversation_id: convId,
    sender_id: userId,
    sender_role: 'user',
    content: message.trim(),
  })
  if (userMsgErr) {
    console.error('[cs/message] user msg err:', userMsgErr)
    return NextResponse.json({ error: '訊息送出失敗' }, { status: 500 })
  }

  // 3) 查詢最近對話歷史（給 AI 上下文）
  const { data: history } = await userClient
    .from('cs_messages')
    .select('sender_role, content, created_at')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: false })
    .limit(10)

  // 4) FAQ 匹配 + 升級判斷
  const faqMatch = matchFaq(message)
  const score = faqMatch?.score || 0
  const escalated = shouldEscalate(message, score)

  let aiReply = ''
  let confidence = 0.0
  let shouldPersistAi = true

  if (escalated) {
    // 升級人工
    await userClient
      .from('cs_conversations')
      .update({
        status: 'human_needed',
        subject: message.slice(0, 80),
        last_message_at: new Date().toISOString(),
      })
      .eq('id', convId)

    aiReply = '👨‍💼 正在為您轉接人工客服，請稍候...\n\n' +
              '通常 5-15 分鐘內會有客服回覆您。\n' +
              '如緊急事項，請撥打：+852 0000 0000'
    confidence = 0.0
  } else {
    // 嘗試呼叫 Claude API（若設定），否則用 FAQ
    const arKKey = process.env.ARK_API_KEY
    if (arKKey && score < 2) {
      // FAQ 信心低，呼叫 Claude
      try {
        const arKRes = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${arKKey}`,
          },
          body: JSON.stringify({
            model: process.env.ARK_MODEL || 'doubao-pro-32k',
            messages: [
              {
                role: 'system',
                content:
                  '你是「中港車預約平台」的 AI 客服助理。請用繁體中文簡潔回答（< 200 字）。' +
                  '僅回答本平台相關問題：跨境車預約、價格、路線、車型、口岸、行李、安全。' +
                  '若超出範圍，回覆「我將為您轉接人工客服」。',
              },
              ...((history || []).reverse().slice(0, 6).map((m) => ({
                role: m.sender_role === 'user' ? 'user' : 'assistant',
                content: m.content,
              })) || []),
              { role: 'user', content: message },
            ],
            temperature: 0.3,
            max_tokens: 400,
          }),
        })
        if (arKRes.ok) {
          const data = await arKRes.json()
          aiReply = data.choices?.[0]?.message?.content || faqMatch?.entry.answer || '抱歉，請稍後再試'
          confidence = 0.7
        } else {
          aiReply = faqMatch?.entry.answer || '抱歉，請稍後再試或聯繫人工客服'
          confidence = faqMatch ? 0.6 : 0.3
        }
      } catch (e) {
        console.error('[cs/message] arK err:', e)
        aiReply = faqMatch?.entry.answer || '抱歉，請稍後再試'
        confidence = faqMatch ? 0.6 : 0.3
      }
    } else if (faqMatch) {
      aiReply = faqMatch.entry.answer
      confidence = Math.min(0.95, 0.5 + score * 0.15)
    } else {
      aiReply = '抱歉，我還不太理解您的問題。\n\n您可以：\n• 重新描述問題\n• 輸入「人工」轉接真人'
      confidence = 0.2
      shouldPersistAi = false
    }

    await userClient
      .from('cs_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', convId)
  }

  // 5) 寫入 AI 回覆
  let aiMessage: any = null
  if (shouldPersistAi && aiReply) {
    const { data: aiMsg, error: aiMsgErr } = await userClient.from('cs_messages').insert({
      conversation_id: convId,
      sender_id: null,
      sender_role: 'ai',
      content: aiReply,
      ai_confidence: confidence,
      metadata: { escalated, faq_score: score, faq_category: faqMatch?.entry.category },
    }).select('id, sender_role, content, created_at, ai_confidence').single()
    if (!aiMsgErr) aiMessage = aiMsg
  }

  // 6) 取得最新狀態
  const { data: convState } = await userClient
    .from('cs_conversations')
    .select('id, status, subject, assigned_admin_id, last_message_at')
    .eq('id', convId)
    .single()

  return NextResponse.json({
    success: true,
    conversation: convState,
    ai_reply: aiMessage,
    escalated,
    confidence,
  })
}