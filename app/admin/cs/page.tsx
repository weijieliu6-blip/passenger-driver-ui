'use client'

import { useEffect, useState, useRef } from 'react'
import { Loader2, Send, MessageCircle, CheckCircle, X } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

interface Conversation {
  id: string
  user_id: string
  status: string
  subject: string | null
  assigned_admin_id: string | null
  last_message_at: string
  created_at: string
}

interface Message {
  id: number
  conversation_id: string
  sender_id: string | null
  sender_role: string
  content: string
  created_at: string
}

export default function AdminCsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [adminToken, setAdminToken] = useState<string>('')
  const scrollerRef = useRef<HTMLDivElement>(null)

  // 取得 admin token
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) setAdminToken(data.session.access_token)
    })
  }, [])

  const fetchConversations = async () => {
    if (!adminToken) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/cs/queue', { headers: { Authorization: `Bearer ${adminToken}` } })
      const data = await res.json()
      if (data.success) setConversations(data.conversations || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (adminToken) {
      fetchConversations()
      const interval = setInterval(fetchConversations, 15000)
      return () => clearInterval(interval)
    }
  }, [adminToken])

  const fetchMessages = async (convId: string) => {
    try {
      const res = await fetch(`/api/cs/conversations/${convId}/messages`, { headers: { Authorization: `Bearer ${adminToken}` } })
      const data = await res.json()
      if (data.success) setMessages(data.messages || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (activeConv && adminToken) {
      fetchMessages(activeConv)
      // 訂閱 realtime
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const supabase = createClient(supabaseUrl, supabaseAnonKey)
      const channel = supabase
        .channel(`cs:${activeConv}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cs_messages', filter: `conversation_id=eq.${activeConv}` }, (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
          // 自動捲
          setTimeout(() => { if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight }, 50)
        })
        .subscribe()
      return () => { channel.unsubscribe() }
    }
  }, [activeConv, adminToken])

  const sendReply = async () => {
    if (!activeConv || !input.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/admin/cs/reply', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: activeConv, content: input.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setInput('')
        fetchConversations() // 重新整理佇列
      } else {
        alert('送出失敗：' + (data.error || ''))
      }
    } catch (e: any) {
      alert('送出失敗：' + e.message)
    } finally {
      setSending(false)
    }
  }

  const closeConv = async (convId: string) => {
    if (!confirm('關閉此會話？')) return
    // 用 admin SQL 寫權限（暫不做專用 API，直接 update）
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${adminToken}` } },
    })
    await supabase.from('cs_conversations').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', convId)
    fetchConversations()
    if (activeConv === convId) setActiveConv(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* 左：佇列 */}
      <aside className="w-80 border-r border-slate-800 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-800">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-cyan-400" />
            客服佇列
          </h1>
          <p className="text-xs text-slate-500 mt-1">{conversations.length} 個待回覆</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-4 text-center text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin inline mr-1" />載入中...</div>}
          {!loading && conversations.length === 0 && (
            <div className="p-4 text-center text-slate-500 text-sm">目前沒有待回覆的會話 🎉</div>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveConv(c.id)}
              className={`w-full text-left px-4 py-3 border-b border-slate-800 hover:bg-slate-900 transition ${
                activeConv === c.id ? 'bg-slate-900 border-l-2 border-l-cyan-500' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">{c.user_id.slice(0, 8)}…</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  c.status === 'human_needed' ? 'bg-amber-500/20 text-amber-300' :
                  'bg-cyan-500/20 text-cyan-300'
                }`}>
                  {c.status === 'human_needed' ? '待回覆' : '處理中'}
                </span>
              </div>
              <div className="text-sm text-slate-200 truncate">{c.subject || '（無主題）'}</div>
              <div className="text-xs text-slate-500 mt-1">
                {new Date(c.last_message_at).toLocaleString('zh-HK', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* 右：對話 */}
      <main className="flex-1 flex flex-col">
        {!activeConv ? (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            請選擇左側會話開始回覆
          </div>
        ) : (
          <>
            <div className="px-6 py-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">會話 {activeConv.slice(0, 8)}…</h2>
                <p className="text-xs text-slate-500">用戶 ID：{activeConv}</p>
              </div>
              <button
                onClick={() => closeConv(activeConv)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded transition flex items-center gap-1"
              >
                <CheckCircle className="w-4 h-4" />
                關閉會話
              </button>
            </div>
            <div ref={scrollerRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {messages.length === 0 && <div className="text-center text-slate-500 text-sm">尚無訊息</div>}
              {messages.map((m) => {
                const isMe = m.sender_role === 'admin'
                return (
                  <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${
                      isMe ? 'bg-cyan-600 text-white rounded-br-sm' :
                      m.sender_role === 'ai' ? 'bg-slate-700 text-slate-200 rounded-bl-sm border border-slate-600' :
                      'bg-slate-800 text-slate-100 rounded-bl-sm border border-slate-700'
                    }`}>
                      {!isMe && (
                        <div className="text-[10px] text-slate-400 mb-0.5">
                          {m.sender_role === 'ai' ? '🤖 AI' : m.sender_role === 'user' ? '👤 用戶' : m.sender_role}
                        </div>
                      )}
                      <div className="break-words whitespace-pre-wrap">{m.content}</div>
                      <div className={`text-[10px] mt-0.5 ${isMe ? 'text-cyan-100/70' : 'text-slate-500/70'}`}>
                        {new Date(m.created_at).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="px-6 py-3 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                placeholder="回覆用戶…"
                disabled={sending}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <button
                onClick={sendReply}
                disabled={sending || !input.trim()}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded transition"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 inline mr-1" />送出</>}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}