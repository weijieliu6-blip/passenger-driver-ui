'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Phone, User as UserLucide,
  CheckCircle, ArrowLeft, Baby, LogOut,
  ShieldCheck, Loader2, AlertCircle, Navigation, Flag,
  MessageSquare, CarFront, type LucideIcon
} from 'lucide-react'
import { useDriverLocation } from '@/components/use-driver-location'

interface Order {
  id: number
  order_number: string
  status: string
  direction: string
  pickup_location: string
  pickup_area?: string | null
  dropoff_location: string
  dropoff_area?: string | null
  departure_time: string
  passengers: number
  luggage: number
  vehicle_type: string
  has_child: boolean
  child_type?: string | null
  passenger_name?: string | null
  passenger_phone?: string
  passenger_notes?: string | null
  confirmed_price?: number | null
  price_currency?: string | null
}

interface DriverUser {
  id: string
  name: string
  phone: string
  role: string
}

interface StageDef {
  key: 'driver_arrived' | 'trip_started' | 'trip_completed'
  label: string
  desc: string
  icon: LucideIcon
  hint: string
  color: string
}

const VEHICLE_LABELS: Record<string, string> = {
  '4_seat': '4座車',
  '7_seat': '7座車',
  '8_seat': '8座車',
}

const DIRECTION_LABELS: Record<string, string> = {
  to_mainland: '跨境專車：香港 → 內地',
  to_hk: '跨境專車：內地 → 香港',
  hk_to_mainland: '跨境專車：香港 → 內地',
  mainland_to_hk: '跨境專車：內地 → 香港',
}

/** 流程節點（依時間順序） */
const STAGES: StageDef[] = [
  {
    key: 'driver_arrived',
    label: '已抵達上車點',
    desc: '告訴乘客你已到定點等他們',
    icon: Flag,
    hint: '抵達接送點時點擊',
    color: 'amber',
  },
  {
    key: 'trip_started',
    label: '乘客已上車（行程開始）',
    desc: '乘客上車、出發前往目的地',
    icon: CarFront,
    hint: '乘客上車後立即點擊',
    color: 'sky',
  },
  {
    key: 'trip_completed',
    label: '行程已完成',
    desc: '已抵達目的地、行程結束',
    icon: CheckCircle,
    hint: '抵達目的地後結單',
    color: 'emerald',
  },
]

/**
 * 司機行程執行頁：定位上報 + 階段切換（事件流轉）
 * /driver/orders/[orderNumber]/execute
 *
 * - 進入頁面時檢查司機登入 + 訂單歸屬
 * - 啟用定位 hook（綁定當前 orderNumber）
 * - 三階段按鈕：已抵達 / 已上車 / 已完成
 * - 任意階段會 POST /api/orders/[orderNumber]/events
 */
export default function DriverExecuteOrderPage() {
  const params = useParams()
  const router = useRouter()
  const orderNumber = params.orderNumber as string

  const [order, setOrder] = useState<Order | null>(null)
  const [driver, setDriver] = useState<DriverUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [sentMessages, setSentMessages] = useState<Array<{ text: string; at: string }>>([])

  const isActiveOrder =
    !!order && ['grabbed', 'price_confirmed'].includes(order.status) && order.status !== 'completed'

  const checkAuthAndLoad = useCallback(async () => {
    try {
      const meRes = await fetch('/api/auth/me')
      const meData = await meRes.json()
      if (!meData.authenticated || meData.user?.role !== 'driver') {
        router.push(`/driver/login?redirect=${encodeURIComponent(`/driver/orders/${orderNumber}/execute`)}`)
        return
      }
      setDriver(meData.user as DriverUser)

      const orderRes = await fetch(`/api/orders/${orderNumber}`)
      const orderData = await orderRes.json()
      if (!orderRes.ok) {
        throw new Error(orderData.message || '查詢訂單失敗')
      }
      setOrder(orderData.order)
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知錯誤')
    } finally {
      setLoading(false)
    }
  }, [orderNumber, router])

  // 啟用定位（僅在訂單活躍時）
  const loc = useDriverLocation({
    enabled: isActiveOrder,
    orderNumber: isActiveOrder ? orderNumber : null,
    intervalMs: 15000,
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkAuthAndLoad()
  }, [checkAuthAndLoad])

  /**
   * 送出階段事件
   */
  const fireStage = useCallback(async (
    stage: StageDef['key'],
    extraMessage?: string
  ) => {
    if (busy) return
    setBusy(stage)
    try {
      const res = await fetch(`/api/orders/${orderNumber}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: stage,
          message: extraMessage || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.error || data.message || '操作失敗')
        return
      }
      // 重新拉訂單，更新狀態
      await checkAuthAndLoad()
    } catch (err) {
      alert('網絡錯誤：' + (err instanceof Error ? err.message : '未知錯誤'))
    } finally {
      setBusy(null)
    }
  }, [busy, checkAuthAndLoad, orderNumber])

  /** 送出文字訊息給乘客 */
  const sendMessage = async () => {
    const text = message.trim()
    if (!text) return
    if (busy) return
    setBusy('message')
    try {
      const res = await fetch(`/api/orders/${orderNumber}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'message',
          message: text,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.error || '發送失敗')
      } else {
        setSentMessages((prev) => [
          { text, at: new Date().toISOString() },
          ...prev,
        ].slice(0, 10))
        setMessage('')
      }
    } finally {
      setBusy(null)
    }
  }

  const handleLogout = async () => {
    if (!confirm('確定要登出嗎？')) return
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/driver/login')
  }

  const currentStageIndex = useMemo(() => {
    if (!order) return -1
    if (order.status === 'completed') return STAGES.length
    if (order.status === 'price_confirmed') {
      // 行程中：等到 trip_started 之前為 0，之後為 1，trip_completed 後為 2
      // 簡化：price_confirmed 對應「已上車」階段索引 1
      return 1
    }
    if (order.status === 'grabbed') return 0
    return -1
  }, [order])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amber-900/20 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400">載入中...</div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amber-900/20 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-slate-200 mb-2">{error || '訂單不存在'}</h1>
          <Link
            href="/driver/dashboard"
            className="inline-block mt-4 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium rounded-xl"
          >
            返回接單大廳
          </Link>
        </div>
      </div>
    )
  }

  const isCompleted = order.status === 'completed'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amber-900/20 to-slate-900 pb-24">
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/driver/dashboard" className="flex items-center gap-2 text-amber-400 hover:text-amber-300">
            <ArrowLeft className="w-5 h-5" />
            返回
          </Link>
          <h1 className="text-lg font-medium text-slate-50">行程執行</h1>
          <div className="flex items-center gap-3">
            {driver && (
              <span className="text-xs text-slate-400 hidden sm:inline">
                {driver.name}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400 text-sm flex items-center gap-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* 訂單基本資訊 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-400">訂單號</p>
            <p className="font-mono text-slate-100">{order.order_number}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">出發</p>
              <p className="text-slate-100 truncate">
                {order.pickup_location}
                {order.pickup_area ? ` · ${order.pickup_area}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">目的地</p>
              <p className="text-slate-100 truncate">
                {order.dropoff_location}
                {order.dropoff_area ? ` · ${order.dropoff_area}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">出發時間</p>
              <p className="text-slate-100">{formatDepartureTime(order.departure_time)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">方向</p>
              <p className="text-slate-100">{DIRECTION_LABELS[order.direction] || order.direction}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">人數/行李/車型</p>
              <p className="text-slate-100">
                {order.passengers} 人 · {order.luggage} 件 · {VEHICLE_LABELS[order.vehicle_type] || order.vehicle_type}
              </p>
            </div>
            {order.confirmed_price && (
              <div>
                <p className="text-xs text-slate-400">報價</p>
                <p className="text-emerald-300 font-bold">
                  {order.price_currency === 'CNY' ? `¥${order.confirmed_price}` : `HK$${order.confirmed_price}`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 定位上報狀態卡 */}
        {isActiveOrder && (
          <div className={`p-4 rounded-2xl border ${
            loc.error
              ? 'bg-red-500/10 border-red-500/30'
              : loc.isWatching
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-slate-800/50 border-slate-700/50'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Navigation className={`w-4 h-4 ${
                loc.error ? 'text-red-400' : loc.isWatching ? 'text-emerald-400' : 'text-slate-400'
              }`} />
              <span className="font-medium text-slate-100 text-sm">即時位置</span>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                loc.error
                  ? 'bg-red-500/20 text-red-300'
                  : loc.isWatching
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-700 text-slate-400'
              }`}>
                {loc.error ? '錯誤' : loc.isWatching ? '上報中' : '未啟動'}
              </span>
            </div>
            {loc.error && (
              <p className="text-xs text-red-300 mb-1">⚠ {loc.error}</p>
            )}
            {loc.location && (
              <p className="text-xs text-slate-400">
                {loc.location.latitude.toFixed(5)}, {loc.location.longitude.toFixed(5)}
                {loc.location.speed != null && ` · ${(loc.location.speed * 3.6).toFixed(0)} km/h`}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              已上報 {loc.sentCount} 次
              {loc.lastSentAt && ` · 最後一次 ${formatRelative(loc.lastSentAt)}`}
            </p>
          </div>
        )}

        {/* 已完成：結果卡 */}
        {isCompleted && (
          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-emerald-300">行程已完成</p>
                <p className="text-xs text-slate-400 mt-0.5">感謝您的服務，平台將持續優化派單</p>
              </div>
            </div>
          </div>
        )}

        {/* 階段操作 */}
        {isActiveOrder && (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-slate-100 mb-3">行程階段</h2>
            <div className="space-y-3">
              {STAGES.map((stage, idx) => {
                const done = currentStageIndex > idx
                const active = currentStageIndex === idx
                const pending = currentStageIndex < idx
                const Icon = stage.icon
                const disabled = pending || !!busy
                return (
                  <button
                    key={stage.key}
                    type="button"
                    onClick={() => fireStage(stage.key)}
                    disabled={disabled}
                    className={`w-full text-left p-4 rounded-xl border flex items-center gap-3 transition ${
                      done
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : active
                          ? `bg-${stage.color}-500/10 border-${stage.color}-500/40 ring-2 ring-${stage.color}-500/30`
                          : 'bg-slate-900/40 border-slate-700/50 opacity-60'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      done
                        ? 'bg-emerald-500/30'
                        : active
                          ? `bg-${stage.color}-500/30`
                          : 'bg-slate-700'
                    }`}>
                      {busy === stage.key ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-100" />
                      ) : done ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Icon className={`w-5 h-5 ${active ? `text-${stage.color}-300` : 'text-slate-400'}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${
                        done ? 'text-emerald-300' : active ? 'text-slate-100' : 'text-slate-400'
                      }`}>
                        {stage.label}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {done ? '✓ 已完成' : active ? stage.desc : stage.hint}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="mt-4 flex items-start gap-2 text-xs text-slate-400 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>每個階段都會即時通知乘客。請於抵達、上車、完成時依序點擊。</span>
            </div>
          </div>
        )}

        {/* 傳訊給乘客 */}
        {isActiveOrder && (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              傳訊給乘客
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="例：我已抵達上車點，請準備上車"
                maxLength={500}
                className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!message.trim() || !!busy}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
              >
                {busy === 'message' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  '送出'
                )}
              </button>
            </div>
            {sentMessages.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-slate-500">最近訊息（乘客端可見）：</p>
                {sentMessages.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-slate-900/50 rounded px-2 py-1.5">
                    <span className="text-slate-200 truncate">{m.text}</span>
                    <span className="text-slate-500 ml-2 shrink-0">
                      {new Date(m.at).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 乘客資訊 */}
        {order.passenger_name && (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <UserLucide className="w-4 h-4 text-amber-400" />
              乘客資訊
            </h2>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <UserLucide className="w-4 h-4 text-slate-400" />
                <span className="text-slate-100">{order.passenger_name}</span>
              </div>
              {order.passenger_phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <a
                    href={`tel:${order.passenger_phone}`}
                    className="text-cyan-400 font-mono"
                  >
                    {order.passenger_phone}
                  </a>
                  <a
                    href={`tel:${order.passenger_phone}`}
                    className="ml-auto px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg text-xs"
                  >
                    撥打
                  </a>
                </div>
              )}
              {order.passenger_notes && (
                <div className="p-3 bg-slate-900/50 border border-slate-600 rounded-lg text-sm text-slate-200">
                  備註：{order.passenger_notes}
                </div>
              )}
              {order.has_child && order.child_type && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-300 flex items-center gap-2">
                  <Baby className="w-4 h-4" />
                  帶孩童：{order.child_type === 'infant' ? '3歲以下（不佔座）' : '3歲以上（佔座）'}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function formatDepartureTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return `${Math.max(1, Math.round(diff / 1000))} 秒前`
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} 分鐘前`
  return new Date(ts).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit', hour12: false })
}