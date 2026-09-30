'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import {
  ArrowLeft, MapPin, Clock, Users, Luggage, Car, Loader2, AlertCircle,
  RefreshCw, Timer, Baby, FileText, Sparkles, Package, X
} from 'lucide-react'

interface HallOrder {
  id: number
  order_number: string
  direction: string
  pickup_location: string
  pickup_area: string | null
  pickup_address: string | null
  dropoff_location: string
  dropoff_area: string | null
  dropoff_address: string | null
  departure_time: string
  passengers: number
  luggage: number
  vehicle_type: string
  is_charter: boolean | null
  has_child: boolean | null
  child_type: string | null
  passenger_name: string
  passenger_notes: string | null
  estimated_fare: number | null
  entered_hall_at: string
  created_at: string
}

const VEHICLE_LABELS: Record<string, string> = {
  '4_seat': '4座車',
  '7_seat': '7座車',
  '8_seat': '8座車',
}

const DIRECTION_LABELS: Record<string, string> = {
  to_mainland: '香港 → 內地',
  to_hk: '內地 → 香港',
  hk_to_mainland: '香港 → 內地',
  mainland_to_hk: '內地 → 香港',
}

export default function DriverHallPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<HallOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string>('')
  const [driverName, setDriverName] = useState<string>('')
  const [grabbing, setGrabbing] = useState<string | null>(null)
  const [grabError, setGrabError] = useState<string | null>(null)
  const [authChecking, setAuthChecking] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 取得 session
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.access_token) {
        router.push('/driver/login?redirect=/driver/hall')
        return
      }
      setToken(data.session.access_token)
      // 取得用戶名稱
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${data.session.access_token}` } })
        .then(r => r.json())
        .then(d => {
          if (!d?.user) {
            router.push('/driver/login?redirect=/driver/hall')
            return
          }
          if (d.user.role !== 'driver') {
            setError('此帳號不是司機帳號')
            setAuthChecking(false)
            return
          }
          setDriverName(d.user.name || '司機')
          setAuthChecking(false)
        })
        .catch(() => {
          router.push('/driver/login?redirect=/driver/hall')
        })
    })
  }, [router])

  // 拉取訂單
  const fetchOrders = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/driver/hall-orders', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) {
        setOrders(data.orders || [])
        setError(null)
      } else {
        setError(data.error || '拉取失敗')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      fetchOrders()
      // 每 15 秒 polling（新訂單進大廳 / 被人搶走）
      pollRef.current = setInterval(fetchOrders, 15000)
      return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }
  }, [token, fetchOrders])

  const handleGrab = async (orderNumber: string) => {
    if (!confirm(`搶單 ${orderNumber}？\n\n搶到後請儘速與乘客聯繫並填寫報價`)) return
    setGrabbing(orderNumber)
    setGrabError(null)
    try {
      const res = await fetch('/api/driver/hall-grab', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_number: orderNumber }),
      })
      const data = await res.json()
      if (data.success) {
        // 搶到 → 跳轉到訂單詳情填報價
        router.push(`/driver/orders/${orderNumber}`)
      } else {
        setGrabError(`${data.error}${data.currentStatus ? `（目前狀態：${data.currentStatus}）` : ''}`)
        fetchOrders() // 重新整理
      }
    } catch (e: any) {
      setGrabError(e.message)
    } finally {
      setGrabbing(null)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('zh-HK', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const timeAgo = (dateString: string) => {
    const now = Date.now()
    const t = new Date(dateString).getTime()
    const diffMins = Math.floor((now - t) / 60000)
    if (diffMins < 1) return '剛剛'
    if (diffMins < 60) return `${diffMins} 分鐘前`
    const hours = Math.floor(diffMins / 60)
    if (hours < 24) return `${hours} 小時前`
    return `${Math.floor(hours / 24)} 天前`
  }

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-slate-200">{error}</p>
          <Link href="/driver/dashboard" className="inline-block mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded">
            返回司機中心
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/driver/dashboard" className="text-slate-400 hover:text-slate-200">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                接單大廳
              </h1>
              <p className="text-xs text-slate-500">{driverName} · {orders.length} 筆可搶</p>
            </div>
          </div>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-cyan-400 transition disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* 提要 */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-2">
            <Timer className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-300">
              <strong className="text-cyan-300">接單大廳</strong>：超過 1 小時無人搶的訂單會自動進入這裡。先到先搶，越早進入越優先（依進入時間排序）。
            </div>
          </div>
        </div>

        {grabError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-300 flex-1">{grabError}</div>
            <button onClick={() => setGrabError(null)} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 訂單列表 */}
      <main className="max-w-2xl mx-auto px-4 space-y-3">
        {loading && orders.length === 0 ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">載入中...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 mb-1">大廳目前沒有訂單</p>
            <p className="text-xs text-slate-500">新訂單進大廳時會自動出現，每 15 秒自動刷新</p>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="bg-slate-800/50 backdrop-blur border border-slate-700/50 hover:border-cyan-500/40 rounded-xl p-4 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-slate-200">#{order.order_number}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">
                    大廳 · {timeAgo(order.entered_hall_at)}進入
                  </span>
                </div>
                {order.estimated_fare != null && (
                  <div className="text-right">
                    <div className="text-xs text-slate-500">預估</div>
                    <div className="text-base font-bold text-emerald-400">HK$ {order.estimated_fare}</div>
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 text-emerald-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-200">
                      {order.pickup_location}
                      {order.pickup_area && <span className="text-slate-400 ml-1">· {order.pickup_area}</span>}
                    </p>
                    {order.pickup_address && (
                      <p className="text-xs text-slate-500">{order.pickup_address}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 text-amber-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-200">
                      {order.dropoff_location}
                      {order.dropoff_area && <span className="text-slate-400 ml-1">· {order.dropoff_area}</span>}
                    </p>
                    {order.dropoff_address && (
                      <p className="text-xs text-slate-500">{order.dropoff_address}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 pb-3 border-b border-slate-700/50">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(order.departure_time)}
                </span>
                <span>{DIRECTION_LABELS[order.direction] || order.direction}</span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {order.passengers} 人
                </span>
                <span className="flex items-center gap-1">
                  <Car className="w-3 h-3" />
                  {VEHICLE_LABELS[order.vehicle_type] || order.vehicle_type}
                </span>
                {order.luggage > 0 && (
                  <span className="flex items-center gap-1">
                    <Luggage className="w-3 h-3" />
                    {order.luggage} 件
                  </span>
                )}
                {order.has_child && (
                  <span className="flex items-center gap-1 text-pink-300">
                    <Baby className="w-3 h-3" />
                    有孩童
                  </span>
                )}
                {order.is_charter && (
                  <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-[10px]">包車</span>
                )}
              </div>

              {order.passenger_notes && (
                <div className="mt-3 flex items-start gap-2">
                  <FileText className="w-3 h-3 text-slate-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-slate-400">{order.passenger_notes}</p>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-slate-700/50">
                <button
                  onClick={() => handleGrab(order.order_number)}
                  disabled={grabbing === order.order_number}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white font-bold rounded-lg transition shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
                >
                  {grabbing === order.order_number ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />搶單中...</>
                  ) : (
                    <>立即搶單</>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}