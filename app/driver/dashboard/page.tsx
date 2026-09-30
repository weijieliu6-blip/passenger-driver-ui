'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Clock, Star, Award, Timer, Sparkles, TrendingUp, AlertCircle, RefreshCw, LogOut, ChevronRight, Phone } from 'lucide-react'

// 訂單類型
interface Order {
  id: number
  order_number: string
  status: string
  pickup_location: string
  pickup_area?: string | null
  dropoff_location: string
  dropoff_area?: string | null
  departure_time: string
  passengers: number
  vehicle_type: string
  estimated_fare?: number | null
  confirmed_price?: number | null
  price_currency?: string | null
  created_at: string
  rating?: number | null
}

// 司機類型
interface DriverProfile {
  id: string
  name: string
  membership_tier: 'free' | 'gold' | 'diamond'
  rating: number
  vehicle_plate?: string
}

export default function DriverDashboard() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()

      if (!data.authenticated) {
        router.push('/driver/login?redirect=/driver/dashboard')
        return
      }

      if (data.user?.role !== 'driver') {
        setError('此帳號不是司機帳號')
        return
      }

      setDriverProfile({
        id: data.user.id,
        name: data.user.name,
        membership_tier: 'free',
        rating: 5.0,
        vehicle_plate: data.user.vehicle_plate,
      })

      loadOrders(data.user.id)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadOrders = async (driverId: string) => {
    try {
      // 加載司機的全部訂單（用於顯示「我的訂單」）
      const res = await fetch(`/api/orders/passenger?driver_id=${driverId}`)
      const data = await res.json()

      if (data.success) {
        setOrders(data.orders || [])
      }
    } catch (err) {
      console.error('載入訂單失敗:', err)
    } finally {
      setLoading(false)
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

  const getTimeAgo = (dateString: string) => {
    const now = Date.now()
    const created = new Date(dateString).getTime()
    const diffMs = now - created
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return '剛剛'
    if (diffMins < 60) return `${diffMins}分鐘前`
    const diffHours = Math.floor(diffMins / 60)
    return `${diffHours}小時前`
  }

  const handleLogout = async () => {
    if (!confirm('確定要登出嗎？')) return
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/driver/login')
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: '待接單', color: 'text-amber-400 bg-amber-500/10' },
      grabbed: { label: '已接單', color: 'text-sky-400 bg-sky-500/10' },
      price_confirmed: { label: '已報價', color: 'text-emerald-400 bg-emerald-500/10' },
      completed: { label: '已完成', color: 'text-slate-400 bg-slate-500/10' },
      cancelled: { label: '已取消', color: 'text-red-400 bg-red-500/10' },
    }
    return map[status] || { label: status, color: 'text-slate-400 bg-slate-500/10' }
  }

  const formatPrice = (order: Order) => {
    const currency = order.price_currency || 'HKD'
    const symbol = currency === 'CNY' ? '¥' : 'HK$'
    const amount = order.confirmed_price || order.estimated_fare || 0
    return `${symbol}${amount}`
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 border border-red-500/30 rounded-2xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-slate-100 mb-2">{error}</h1>
          <Link
            href="/driver/login"
            className="inline-block mt-4 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium rounded-xl"
          >
            前往登入
          </Link>
        </div>
      </div>
    )
  }

  const pendingOrders = orders.filter(o => o.status === 'pending')
  const activeOrders = orders.filter(o => ['grabbed', 'price_confirmed'].includes(o.status))
  const completedOrders = orders.filter(o => o.status === 'completed')
  const cancelledOrders = orders.filter(o => o.status === 'cancelled')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-50">司機中心</h1>
            <p className="text-xs text-slate-400">管理您的訂單</p>
          </div>
          <div className="flex items-center gap-3">
            {driverProfile && (
              <div className="text-right">
                <div className="text-sm font-medium text-slate-200">{driverProfile.name}</div>
                <div className="flex items-center gap-1 text-xs text-yellow-400">
                  <Star className="w-3 h-3 fill-current" />
                  {driverProfile.rating.toFixed(1)}
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400 transition p-2"
              title="登出"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 接單大廳入口（醒目 CTA） */}
        <Link
          href="/driver/hall"
          className="block bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border-2 border-cyan-500/40 rounded-2xl p-5 hover:border-cyan-400/60 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-110 transition-transform">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-cyan-300 mb-1 text-lg flex items-center gap-2">
                進入接單大廳
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </h3>
              <p className="text-sm text-slate-300">超過 1 小時無人搶的訂單會進入這裡，先搶先得</p>
              <p className="text-xs text-slate-400 mt-1">💡 平台零抽成，價格由您自行設定</p>
            </div>
          </div>
        </Link>

        {/* 統計卡片 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{pendingOrders.length}</div>
            <div className="text-xs text-slate-400 mt-1">待接單</div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-sky-400">{activeOrders.length}</div>
            <div className="text-xs text-slate-400 mt-1">進行中</div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{completedOrders.length}</div>
            <div className="text-xs text-slate-400 mt-1">已完成</div>
          </div>
        </div>

        {/* 進行中訂單 */}
        {activeOrders.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-400" />
              進行中訂單 ({activeOrders.length})
            </h2>
            <div className="space-y-3">
              {activeOrders.map((order) => {
                const badge = getStatusBadge(order.status)
                return (
                  <Link
                    key={order.id}
                    href={`/driver/orders/${order.order_number}`}
                    className="block bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-4 hover:border-amber-500/30 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-slate-200">#{order.order_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-400 transition" />
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 text-emerald-400 flex-shrink-0" />
                        <span className="text-slate-200">
                          {order.pickup_location}{order.pickup_area ? ` ${order.pickup_area}` : ''}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 text-amber-400 flex-shrink-0" />
                        <span className="text-slate-200">
                          {order.dropoff_location}{order.dropoff_area ? ` ${order.dropoff_area}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(order.departure_time)}
                        </span>
                        <span>{order.passengers} 人</span>
                      </div>
                    </div>

                    {!order.confirmed_price && order.status === 'grabbed' && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                        <span className="text-amber-300">點擊輸入最終報價</span>
                      </div>
                    )}

                    {order.confirmed_price && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                        <span className="text-xs text-slate-400">已確認價格</span>
                        <span className="text-lg font-bold text-emerald-400">
                          {formatPrice(order)}
                        </span>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* 待接訂單（佔位說明） */}
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-3 flex items-center gap-2">
            <Timer className="w-5 h-5 text-amber-400" />
            待接訂單 ({pendingOrders.length})
          </h2>
          {pendingOrders.length === 0 ? (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-8 text-center">
              <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">目前沒有待接訂單</p>
              <p className="text-xs text-slate-500 mt-2">
                新訂單會通過釘釘群推送鏈接給您
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-medium text-slate-200">#{order.order_number}</span>
                    <span className="text-xs text-amber-400">{getTimeAgo(order.created_at)}</span>
                  </div>
                  <div className="text-sm text-slate-300">
                    {order.pickup_location} → {order.dropoff_location}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 已完成訂單 */}
        {completedOrders.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" />
              最近完成 ({completedOrders.length})
            </h2>
            <div className="space-y-2">
              {completedOrders.slice(0, 5).map((order) => {
                const badge = getStatusBadge(order.status)
                return (
                  <Link
                    key={order.id}
                    href={`/driver/orders/${order.order_number}`}
                    className="block bg-slate-800/30 backdrop-blur border border-slate-700/30 rounded-xl p-3 hover:border-slate-600/50 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-slate-300">#{order.order_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {order.pickup_location} → {order.dropoff_location}
                        </div>
                      </div>
                      <div className="text-right">
                        {order.confirmed_price && (
                          <div className="text-sm font-bold text-emerald-400">{formatPrice(order)}</div>
                        )}
                        {order.rating && (
                          <div className="flex items-center gap-0.5 mt-1">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs text-yellow-400">{order.rating}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* 快速導航 */}
        <div className="pt-4 border-t border-slate-700/50">
          <Link
            href="/driver/profile"
            className="flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/50 rounded-xl transition"
          >
            <span className="text-slate-300">個人資料</span>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </Link>
        </div>
      </main>
    </div>
  )
}
