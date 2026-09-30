'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageCircle, Send, Loader2, X } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

interface Message {
  id: number
  conversation_id: string
  sender_id: string | null
  sender_role: string
  content: string
  ai_confidence: number | null
  created_at: string
}

interface Conversation {
  id: string
  status: string
  subject: string | null
}

interface Props {
  /** 顯示模式 */
  mode?: 'floating' | 'embed'
  defaultOpen?: boolean
}

/**
 * 客服 Widget（乘客端）
 * - 自動建立會話
 * - 發送訊息給 AI，必要時升級人工
 * - 訂閱 Realtime 接收 AI / 客服回覆
 */
export default function CsWidget({ mode = 'floating', defaultOpen = false }: Props) {
  const [open, setOpen] = useState(mode === 'embed' || defaultOpen)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string>('')
  const scrollerRef = useRef<HTMLDivElement>(null)

  // 取得 session
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) setToken(data.session.access_token)
    })
  }, [])

  // 載入最後一個會話
  const loadLatestConversation = async () => {
    if (!token) return
    try {
      const res = await fetch('/api/cs/conversations', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success && data.conversations?.length > 0) {
        const latest = data.conversations[0]
        setConversation(latest)
        // 載入訊息
        const mRes = await fetch(`/api/cs/conversations/${latest.id}/messages`, { headers: { Authorization: `Bearer ${token}` } })
        const mData = await mRes.json()
        if (mData.success) setMessages(mData.messages || [])
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (open && token) loadLatestConversation()
  }, [open, token])

  // 訂閱 realtime
  useEffect(() => {
    if (!conversation || !open) return
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const channel = supabase
      .channel(`cs_user:${conversation.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cs_messages', filter: `conversation_id=eq.${conversation.id}` }, (payload) => {
        const newMsg = payload.new as Message
        setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]))
        setTimeout(() => { if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight }, 50)
      })
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [conversation, open])

  const sendMessage = async () => {
    const trimmed = input.trim()
    if (!trimmed || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/cs/message', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversation?.id,
          message: trimmed,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setInput('')
        if (!conversation) {
          setConversation({
            id: data.conversation.id,
            status: data.conversation.status,
            subject: data.conversation.subject,
          })
        } else {
          // 更新狀態
          setConversation((prev) => prev ? { ...prev, status: data.conversation.status } : null)
        }
        // 加入 AI 回覆（如有）
        if (data.ai_reply) {
          setMessages((prev) => [...prev, data.ai_reply])
        }
        // 自動捲
        setTimeout(() => { if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight }, 100)
      } else {
        setError(data.error || '送出失敗')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const panel = (
    <div
      className={`${
        mode === 'floating' ? 'fixed bottom-20 right-4 w-80 h-[28rem] z-50 shadow-2xl' : 'w-full h-[28rem]'
      } bg-slate-900 border border-slate-700 rounded-xl flex flex-col overflow-hidden`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-cyan-400" />
          <span className="font-medium text-slate-100 text-sm">AI 客服</span>
          {conversation?.status === 'human_needed' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">待人工</span>
          )}
          {conversation?.status === 'human_active' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">人工客服</span>
          )}
        </div>
        {mode === 'floating' && (
          <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-200" aria-label="關閉">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 text-xs mt-4">
            <div className="mb-3">👋 您好！</div>
            <div>我是 AI 客服助理，可以回答價格、路線、車型、口岸等問題。</div>
            <div className="mt-2">輸入「人工」可轉接真人客服</div>
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.sender_role === 'user'
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                  isMe ? 'bg-cyan-600 text-white rounded-br-sm' :
                  m.sender_role === 'ai' ? 'bg-slate-700 text-slate-100 rounded-bl-sm border border-slate-600' :
                  'bg-emerald-600 text-white rounded-bl-sm'
                }`}
              >
                {!isMe && (
                  <div className="text-[10px] text-slate-300/80 mb-0.5">
                    {m.sender_role === 'ai' ? '🤖 AI' : '👨‍💼 客服'}
                  </div>
                )}
                <div className="break-words whitespace-pre-wrap">{m.content}</div>
                <div className={`text-[10px] mt-0.5 ${isMe ? 'text-cyan-100/70' : 'text-slate-400/70'}`}>
                  {new Date(m.created_at).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-slate-700 px-3 py-2 flex gap-2 bg-slate-800/30">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder={!token ? '請先登入' : '輸入訊息...'}
          disabled={sending || !token}
          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          maxLength={2000}
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={sending || !input.trim() || !token}
          className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded transition"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      {error && <div className="px-3 py-1 text-xs text-red-400 border-t border-slate-700">{error}</div>}
    </div>
  )

  if (mode === 'floating') {
    return (
      <>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="fixed bottom-32 right-4 w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg z-40 flex items-center justify-center"
            aria-label="開啟客服"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
        )}
        {open && panel}
      </>
    )
  }
  return panel
}