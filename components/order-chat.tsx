'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Loader2, MessageCircle, X } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

interface Message {
  id: number
  sender_id: string
  sender_role: string
  content: string
  read_at: string | null
  created_at: string
}

interface Props {
  orderNumber: string
  /** 當前使用者 ID（高亮自己訊息） */
  currentUserId: string
  /** 顯示為可摺疊 widget（右下角浮動按鈕）或直接嵌入（傳 embed） */
  mode?: 'floating' | 'embed'
  /** 若設定，預設開啟 */
  defaultOpen?: boolean
}

/**
 * 訂單即時聊天元件
 * - 浮動模式（右下角按鈕）或嵌入式（直接放頁面內）
 * - 使用 Supabase Realtime 訂閱 INSERT 事件
 * - 自動 polling fallback（若 realtime 失敗）
 */
export default function OrderChat({
  orderNumber,
  currentUserId,
  mode = 'floating',
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(mode === 'embed' || defaultOpen)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const lastFetchRef = useRef<string | null>(null)

  // 取得 session token
  const getAuthHeader = async (): Promise<string> => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('未登入')
    return `Bearer ${token}`
  }

  const fetchMessages = async (since?: string) => {
    try {
      setLoading(true)
      const auth = await getAuthHeader()
      const url = new URL(`/api/orders/${orderNumber}/messages`, window.location.origin)
      if (since) url.searchParams.set('since', since)
      const res = await fetch(url, { headers: { Authorization: auth } })
      const data = await res.json()
      if (data.success) {
        if (since) {
          // 增量
          setMessages((prev) => [...prev, ...data.messages])
        } else {
          setMessages(data.messages || [])
        }
        if (data.messages?.length > 0) {
          lastFetchRef.current = data.messages[data.messages.length - 1].created_at
        }
      } else {
        setError(data.error || '載入失敗')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    const trimmed = input.trim()
    if (!trimmed || sending) return
    setSending(true)
    setError(null)
    try {
      const auth = await getAuthHeader()
      const res = await fetch(`/api/orders/${orderNumber}/messages`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      })
      const data = await res.json()
      if (data.success) {
        setMessages((prev) => [...prev, data.message])
        lastFetchRef.current = data.message.created_at
        setInput('')
        // 捲到底
        setTimeout(() => {
          if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
        }, 50)
      } else {
        setError(data.error || '送出失敗')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  // 初次載入 + 訂閱 realtime
  useEffect(() => {
    if (!open) return
    fetchMessages()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const channel = supabase
      .channel(`order_messages:${orderNumber}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_messages', filter: `order_number=eq.${orderNumber}` },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          // 自動捲到底
          setTimeout(() => {
            if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
          }, 50)
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [open, orderNumber])

  // Polling fallback（每 15 秒）
  useEffect(() => {
    if (!open) return
    const interval = setInterval(() => {
      if (lastFetchRef.current) {
        fetchMessages(lastFetchRef.current).catch(() => {})
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [open])

  const panel = (
    <div
      className={`${
        mode === 'floating'
          ? 'fixed bottom-20 right-4 w-80 h-[28rem] z-50 shadow-2xl'
          : 'w-full h-[28rem]'
      } bg-slate-900 border border-slate-700 rounded-xl flex flex-col overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-cyan-400" />
          <span className="font-medium text-slate-100 text-sm">即時通訊</span>
        </div>
        {mode === 'floating' && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-200"
            aria-label="關閉"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 訊息列表 */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading && messages.length === 0 && (
          <div className="text-center text-slate-500 text-xs mt-4">
            <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
            載入中...
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center text-slate-500 text-xs mt-4">尚無訊息，發起對話吧</div>
        )}
        {messages.map((m) => {
          const isMine = m.sender_id === currentUserId
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                  isMine
                    ? 'bg-cyan-600 text-white rounded-br-sm'
                    : 'bg-slate-700 text-slate-100 rounded-bl-sm'
                }`}
              >
                {!isMine && m.sender_role !== 'system' && (
                  <div className="text-[10px] text-slate-300/80 mb-0.5">
                    {m.sender_role === 'driver' ? '🚗 司機' : m.sender_role === 'admin' ? '👨‍💼 客服' : '乘客'}
                  </div>
                )}
                <div className="break-words whitespace-pre-wrap">{m.content}</div>
                <div className={`text-[10px] mt-0.5 ${isMine ? 'text-cyan-100/70' : 'text-slate-400/70'}`}>
                  {new Date(m.created_at).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 輸入框 */}
      <div className="border-t border-slate-700 px-3 py-2 flex gap-2 bg-slate-800/30">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
          placeholder="輸入訊息..."
          disabled={sending}
          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          maxLength={2000}
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={sending || !input.trim()}
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
            className="fixed bottom-20 right-4 w-12 h-12 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg z-40 flex items-center justify-center"
            aria-label="開啟即時通訊"
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