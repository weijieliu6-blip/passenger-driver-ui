'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  MapPin, Clock, Star, Award, Timer, Sparkles, AlertCircle,
  LogOut, ChevronRight, Zap, Crown, Gift, Bell, CheckCircle2
} from 'lucide-react'
import { StatusSwitcher } from '@/app/components/status-switcher'

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

interface AvailableOrder extends Order {
  // 可搶訂單
}

interface DriverProfile {
  id: string
  name: string
  membership_tier: 'none' | 'normal' | 'platinum' | 'gold'
  rating: number
  vehicle_plate?: string
}

const TIER_LABEL: Record<string, string> = {
  gold: '🥇 黃金會員',
  platinum: '💎 白金會員',
  normal: '🚗 普通會員',
  none: '❌ 非會員',
}

const TIER_COLOR: Record<string, string> = {
  gold: 'text-yellow-300 bg-yellow-500/20 border-yellow-500/40',
  platinum: 'text-purple-300 bg-purple-500/20 border-purple-500/40',
  normal: 'text-slate-300 bg-slate-500/20 border-slate-500/40',
  none: 'text-red-300 bg-red-500/20 border-red-500/40',
}

const TIER_NOTICE: Record<string, string> = {
  gold: '✅ 即時收到所有新訂單',
  platinum: '⏱️ 新訂單延遲 60 秒推送',
  normal: '⏱️ 新訂單延遲 120 秒推送',
  none: '📵 站內不推送，請通過釘釘搶單',
}

export default function DriverDashboard() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([])
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [grabbing, setGrabbing] = useState<string | null>(null)
  const [grabMessage, setGrabMessage] = useState('')
  const [lastChecked, setLastChecked] = useState<string>('')

  useEffect(() => {
    checkAuth()
  }, [])

  // 輪詢新訂單（每 5 秒）
  useEffect(() => {
    if (!driverProfile) return
    loadAvailableOrders()
    const interval = setInterval(() => {
      loadAvailableOrders()
    }, 5000)
    return () => clearInterval(interval)
  }, [driverProfile])

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

      // 從 driver 對象讀取真實的會員等級
      const tier = (data.user?.membership_tier || data.user?.driver?.membership_tier || 'gold') as DriverProfile['membership_tier']

      setDriverProfile({
        id: data.user.id,
        name: data.user.name,
        membership_tier: tier,
        rating: data.user.rating || 5.0,
        vehicle_plate: data.user.vehicle_plate,
      })

      loadOrders(data.user.id)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadOrders = async (driverId: string) => {
    try {
      const res = await fetch(`/api/driver/orders?driver_id=${driverId}`)
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

  const loadAvailableOrders = async () => {
    try {
      const res = await fetch('/api/driver/available-orders')
      const data = await res.json()
      if (data.success) {
        // 只顯示之前沒有的訂單
        setAvailableOrders(prev => {
          const prevIds = new Set(prev.map(o => o.order_number))
          const newOnes = (data.orders || []).filter((o: Order) => !prevIds.has(o.order_number))
          if (newOnes.length > 0) {
            setGrabMessage(`🔔 收到 ${newOnes.length} 個新訂單`)
            setTimeout(() => setGrabMessage(''), 5000)
          }
          return data.orders || []
        })
        setLastChecked(new Date().toLocaleTimeString('zh-HK'))
      }
    } catch (err) {
      console.error('載入可搶訂單失敗:', err)
    }
  }

  const handleGrab = async (orderNumber: string) => {
    if (!confirm(`確定搶單 ${orderNumber}？`)) return

    setGrabbing(orderNumber)
    setGrabMessage('')

    try {
      const res = await fetch(`/api/orders/${orderNumber}/grab`, {
        method: 'POST',
      })
      const data = await res.json()

      if (data.success) {
        setGrabMessage(`✅ 搶單成功！跳轉中...`)
        setTimeout(() => {
          router.push(`/driver/orders/${orderNumber}`)
        }, 1000)
      } else {
        if (data.waitSeconds && data.waitSeconds > 0) {
          setGrabMessage(`⏱️ 您的等級需要等待 ${data.waitSeconds} 秒才能搶此單`)
        } else {
          setGrabMessage(`❌ ${data.error || '搶單失敗'}`)
        }
        setTimeout(() => setGrabMessage(''), 4000)
        loadAvailableOrders()
      }
    } catch (err: any) {
      setGrabMessage(`❌ ${err.message}`)
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

  const activeOrders = orders.filter(o => ['grabbed', 'price_confirmed', 'completed'].includes(o.status))
  const completedOrders = orders.filter(o => o.status === 'completed')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* 頂部 Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-50">司機中心</h1>
            <p className="text-xs text-slate-400">管理您的訂單 · Port 3001</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusSwitcher />
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
        {/* 會員等級卡片 */}
        {driverProfile && (
          <div className={`rounded-2xl p-4 border ${TIER_COLOR[driverProfile.membership_tier]}`}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-900/40">
                {driverProfile.membership_tier === 'gold' && <Crown className="w-5 h-5" />}
                {driverProfile.membership_tier === 'platinum' && <Award className="w-5 h-5" />}
                {driverProfile.membership_tier === 'normal' && <Gift className="w-5 h-5" />}
                {driverProfile.membership_tier === 'none' && <AlertCircle className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">
                    {TIER_LABEL[driverProfile.membership_tier]}
                  </h3>
                  {driverProfile.membership_tier !== 'gold' && (
                    <Link
                      href="/driver/profile"
                      className="text-xs px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium"
                    >
                      升級
                    </Link>
                  )}
                </div>
                <p className="text-sm opacity-90">
                  {TIER_NOTICE[driverProfile.membership_tier]}
                </p>
                {lastChecked && driverProfile.membership_tier !== 'none' && (
                  <p className="text-xs opacity-60 mt-1">
                    最後檢查：{lastChecked}（每 5 秒自動刷新）
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 搶單消息提示 */}
        {grabMessage && (
          <div className={`p-3 rounded-xl text-sm font-medium ${
            grabMessage.startsWith('✅') ? 'bg-emerald-500/20 text-emerald-300' :
            grabMessage.startsWith('❌') ? 'bg-red-500/20 text-red-300' :
            grabMessage.startsWith('⏱️') ? 'bg-amber-500/20 text-amber-300' :
            'bg-sky-500/20 text-sky-300'
          }`}>
            {grabMessage}
          </div>
        )}

        {/* 🔔 可搶訂單（核心功能） */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" />
              可搶訂單 ({availableOrders.length})
            </h2>
            {availableOrders.length > 0 && (
              <span className="text-xs text-slate-400">點搶按鈕搶單</span>
            )}
          </div>

          {driverProfile?.membership_tier === 'none' ? (
            <div className="bg-slate-800/30 border border-red-500/30 rounded-xl p-8 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-slate-300 font-medium mb-2">非會員無法接收站內推送</p>
              <p className="text-xs text-slate-400 mb-4">
                請升級會員，或到釘釘群搶單
              </p>
              <Link
                href="/driver/profile"
                className="inline-block px-6 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium rounded-xl"
              >
                升級會員
              </Link>
            </div>
          ) : availableOrders.length === 0 ? (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-8 text-center">
              <Timer className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">暫無可搶訂單</p>
              <p className="text-xs text-slate-500 mt-2">
                系統每 5 秒自動檢查新訂單
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4 hover:border-amber-500/50 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-slate-100">#{order.order_number}</span>
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        <Zap className="w-3 h-3" />
                        新訂單
                      </span>
                      <span className="text-xs text-slate-500">{getTimeAgo(order.created_at)}</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm mb-3">
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
                      {order.estimated_fare && (
                        <span className="text-emerald-400 font-medium">
                          預估 HK${order.estimated_fare}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleGrab(order.order_number)}
                    disabled={grabbing === order.order_number}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-600 text-slate-900 disabled:text-slate-400 font-bold rounded-xl transition flex items-center justify-center gap-2"
                  >
                    {grabbing === order.order_number ? (
                      <>搶單中...</>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        立即搶單
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 我的訂單 */}
        {activeOrders.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-400" />
              我的訂單 ({activeOrders.length})
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

        {completedOrders.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
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
