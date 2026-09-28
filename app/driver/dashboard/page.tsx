'use client'

import { useState, useEffect } from 'react'
import { MapPin, Clock, Star, Award, Timer, Sparkles, TrendingUp } from 'lucide-react'

// Mock 司機資料
const mockDriverProfile = {
  name: '張師傅',
  membershipTier: 'diamond' as const,
  rating: 4.9,
}

// Mock 訂單數據
const mockOrders = [
  {
    id: '1',
    pickupLocation: '香港國際機場',
    dropoffLocation: '汕尾市區酒店',
    departureTime: '2026-09-18T14:30:00',
    estimatedPrice: 800,
    passengerRating: 4.8,
    isVIP: true, // 鑽石會員專屬優先單
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    pickupLocation: '香港尖沙咀',
    dropoffLocation: '汕尾紅海灣',
    departureTime: '2026-09-18T16:00:00',
    estimatedPrice: 850,
    passengerRating: 4.5,
    isVIP: false,
    createdAt: new Date(Date.now() - 300000).toISOString(), // 5分鐘前
  },
  {
    id: '3',
    pickupLocation: '香港九龍站',
    dropoffLocation: '汕尾火車站',
    departureTime: '2026-09-19T09:00:00',
    estimatedPrice: 780,
    passengerRating: 4.7,
    isVIP: false,
    createdAt: new Date(Date.now() - 600000).toISOString(), // 10分鐘前
  },
]

export default function DriverDashboard() {
  const [orders] = useState(mockOrders)
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null)

  const handleAcceptOrder = async (orderId: string) => {
    setAcceptingOrderId(orderId)
    
    // 模擬接單延遲
    setTimeout(() => {
      alert('接單成功！')
      setAcceptingOrderId(null)
    }, 1000)
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('zh-TW', {
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

  const getMembershipLabel = (tier: string) => {
    const labels = {
      diamond: '鑽石會員',
      gold: '黃金會員',
      free: '免費會員',
    }
    return labels[tier as keyof typeof labels] || '免費會員'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-50">司機接單大廳</h1>
              <p className="text-sm text-slate-400 mt-1">實時訂單推送</p>
            </div>
            <a
              href="/driver/profile"
              className="px-4 py-2 bg-slate-700 text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-600 transition"
            >
              個人資料
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 司機狀態卡片 */}
        <div className="mb-8 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-2 border-amber-500/50 rounded-2xl p-6 backdrop-blur shadow-xl shadow-amber-500/20">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center">
                <Award className="w-10 h-10 text-slate-900" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-cyan-400 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-slate-900" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-slate-50 mb-1">{mockDriverProfile.name}</h3>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 text-sm font-bold rounded-full">
                  {getMembershipLabel(mockDriverProfile.membershipTier)}
                </span>
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 text-yellow-400 fill-current" />
                  <span className="text-lg font-semibold text-yellow-400">{mockDriverProfile.rating}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-slate-900/30 rounded-lg">
              <div className="text-sm text-slate-400 mb-1">今日接單</div>
              <div className="text-2xl font-bold text-cyan-400">12</div>
            </div>
            <div className="text-center p-3 bg-slate-900/30 rounded-lg">
              <div className="text-sm text-slate-400 mb-1">本月收入</div>
              <div className="text-2xl font-bold text-green-400">$23.5K</div>
            </div>
            <div className="text-center p-3 bg-slate-900/30 rounded-lg">
              <div className="text-sm text-slate-400 mb-1">接單率</div>
              <div className="text-2xl font-bold text-orange-400">95%</div>
            </div>
          </div>
        </div>

        {/* 會員升級提示（僅非鑽石會員顯示） */}
        {mockDriverProfile.membershipTier !== 'diamond' && (
          <div className="mb-6 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-xl p-4">
            <div className="flex gap-3">
              <TrendingUp className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-orange-300 mb-1">升級至鑽石會員，搶先看到高價值訂單</div>
                <p className="text-sm text-orange-200/80 mb-3">
                  立即看單 + 專屬優先單標記 + 優先客服支持
                </p>
                <a
                  href="/driver/profile"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-900 font-medium rounded-lg hover:from-orange-400 hover:to-amber-400 transition"
                >
                  立即升級
                </a>
              </div>
            </div>
          </div>
        )}

        {/* 最新訂單列表標題 */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-50 mb-2">最新訂單列表</h2>
          <p className="text-slate-400">實時更新，快速搶單</p>
        </div>

        {/* 訂單列表 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {orders.map((order) => (
            <div
              key={order.id}
              className={`relative backdrop-blur rounded-2xl p-6 transition-all shadow-xl ${
                order.isVIP
                  ? 'bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border-2 border-amber-400 shadow-amber-400/30'
                  : 'bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/50'
              }`}
            >
              {/* 鑽石會員專屬標記 */}
              {order.isVIP && (
                <div className="absolute -top-3 -right-3 flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full shadow-lg">
                  <Sparkles className="w-4 h-4 text-slate-900" />
                  <span className="text-xs font-bold text-slate-900">鑽石專屬</span>
                </div>
              )}

              {/* 訂單頭部 */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${order.isVIP ? 'bg-amber-400' : 'bg-green-400'}`}></div>
                  <span className={`text-xs font-medium ${order.isVIP ? 'text-amber-400' : 'text-green-400'}`}>
                    {order.isVIP ? 'VIP新單' : '新訂單'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Timer className="w-3 h-3" />
                  {getTimeAgo(order.createdAt)}
                </div>
              </div>

              {/* 路線信息 */}
              <div className="mb-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    order.isVIP ? 'bg-amber-400/20' : 'bg-cyan-500/10'
                  }`}>
                    <MapPin className={`w-5 h-5 ${order.isVIP ? 'text-amber-400' : 'text-cyan-400'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-slate-400 mb-0.5">出發</div>
                    <div className="text-base font-semibold text-slate-50">{order.pickupLocation}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    order.isVIP ? 'bg-yellow-400/20' : 'bg-teal-500/10'
                  }`}>
                    <MapPin className={`w-5 h-5 ${order.isVIP ? 'text-yellow-400' : 'text-teal-400'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-slate-400 mb-0.5">目的地</div>
                    <div className="text-base font-semibold text-slate-50">{order.dropoffLocation}</div>
                  </div>
                </div>
              </div>

              {/* 詳細信息 */}
              <div className="space-y-2 mb-4 pb-4 border-b border-slate-700/50">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock className="w-4 h-4" />
                    <span>出發時間</span>
                  </div>
                  <span className="text-slate-300 font-medium">{formatTime(order.departureTime)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span>乘客評分</span>
                  </div>
                  <span className="text-slate-300 font-medium">{order.passengerRating}</span>
                </div>
              </div>

              {/* 價格和搶單按鈕 */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 mb-1">預估金額</div>
                  <div className={`text-2xl font-bold ${order.isVIP ? 'text-amber-400' : 'text-cyan-400'}`}>
                    HKD ${order.estimatedPrice}
                  </div>
                </div>
                <button
                  onClick={() => handleAcceptOrder(order.id)}
                  disabled={acceptingOrderId === order.id}
                  className={`px-5 py-3 font-bold rounded-xl focus:outline-none focus:ring-4 transition-all shadow-lg transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                    order.isVIP
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 hover:from-amber-300 hover:to-yellow-400 focus:ring-amber-500/50 shadow-amber-400/30'
                      : 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 hover:from-cyan-400 hover:to-teal-400 focus:ring-cyan-500/50 shadow-cyan-500/20'
                  }`}
                >
                  {acceptingOrderId === order.id ? '搶單中...' : '立即搶單'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

  const [orders, setOrders] = useState<Order[]>([])
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null)

  useEffect(() => {
    loadDriverProfile()
    loadOrders()
    
    // 訂閱實時訂單更新
    const channel = supabase
      .channel('orders_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('訂單更新:', payload)
          loadOrders()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadDriverProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return
      }

      const { data, error } = await supabase
        .from('drivers_profile')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      setDriverProfile(data)
    } catch (error) {
      console.error('載入司機資料失敗:', error)
    }
  }

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'pending')
        .order('passenger_rating', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('載入訂單失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptOrder = async (orderId: string) => {
    setAcceptingOrderId(orderId)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        alert('請先登入')
        return
      }

      const { error } = await supabase
        .from('orders')
        .update({
          driver_id: user.id,
          status: 'accepted',
        })
        .eq('id', orderId)
        .eq('status', 'pending') // 確保訂單還是待接單狀態

      if (error) throw error

      alert('接單成功！')
      loadOrders()
    } catch (error: any) {
      console.error('接單失敗:', error)
      alert(error.message || '接單失敗，可能已被其他司機搶單')
    } finally {
      setAcceptingOrderId(null)
    }
  }

  // 過濾訂單：根據會員等級和創建時間
  const visibleOrders = orders.filter((order) => {
    if (!driverProfile) return false
    return shouldShowOrder(driverProfile.membership_tier, order.created_at)
  })

  // 計算還有多少訂單被隱藏
  const hiddenOrdersCount = orders.length - visibleOrders.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-50">司機接單大廳</h1>
              <p className="text-sm text-slate-400 mt-1">實時訂單推送</p>
            </div>
            {driverProfile && (
              <div className="text-right">
                <div className="text-sm text-slate-400">當前等級</div>
                <div className="text-lg font-semibold text-cyan-400">
                  {getMembershipTierLabel(driverProfile.membership_tier)}
                </div>
                <div className="flex items-center gap-1 text-sm text-yellow-400 mt-1">
                  <Star className="w-4 h-4 fill-current" />
                  {driverProfile.rating.toFixed(1)}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 會員等級提示 */}
        {driverProfile && driverProfile.membership_tier === 'free' && (
          <div className="mb-6 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-xl p-4">
            <div className="flex gap-3">
              <TrendingUp className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-orange-300 mb-1">升級會員搶先接單</div>
                <p className="text-sm text-orange-200/80 mb-3">
                  升級至黃金或鑽石會員，提前15-30秒查看新訂單，搶佔先機！
                </p>
                <a
                  href="/driver/profile"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-900 font-medium rounded-lg hover:from-orange-400 hover:to-amber-400 transition"
                >
                  立即升級
                </a>
              </div>
            </div>
          </div>
        )}

        {/* 隱藏訂單提示 */}
        {hiddenOrdersCount > 0 && (
          <div className="mb-6 bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300">
                還有 <span className="font-bold text-cyan-400">{hiddenOrdersCount}</span> 個訂單暫未顯示，
                {driverProfile?.membership_tier === 'free' && '升級會員即可提前查看'}
                {driverProfile?.membership_tier === 'gold' && '鑽石會員可提前15秒查看'}
              </div>
            </div>
          </div>
        )}

        {/* 訂單列表 */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">載入中...</div>
        ) : visibleOrders.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <div className="text-slate-400">暫無待接訂單</div>
            <p className="text-sm text-slate-500 mt-2">新訂單會自動推送到這裡</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {visibleOrders.map((order) => (
              <div
                key={order.id}
                className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-6 hover:border-cyan-500/50 transition-all shadow-lg"
              >
                {/* 訂單頭部 */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-green-400">新訂單</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {getRelativeTime(order.created_at)}
                  </div>
                </div>

                {/* 路線信息 */}
                <div className="mb-4">
                  <div className="flex items-start gap-3 mb-2">
                    <MapPin className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm text-slate-400">出發</div>
                      <div className="text-lg font-medium text-slate-50">{order.pickup_location}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm text-slate-400">目的地</div>
                      <div className="text-lg font-medium text-slate-50">{order.dropoff_location}</div>
                    </div>
                  </div>
                </div>

                {/* 詳細信息 */}
                <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-slate-700/50">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300">{formatDateTime(order.departure_time)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-slate-300">乘客評分 {order.passenger_rating.toFixed(1)}</span>
                  </div>
                </div>

                {/* 價格和接單按鈕 */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-400">預估價格</div>
                    <div className="text-2xl font-bold text-cyan-400">{formatPrice(order.price_hkd)}</div>
                  </div>
                  <button
                    onClick={() => handleAcceptOrder(order.id)}
                    disabled={acceptingOrderId === order.id}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-semibold rounded-lg hover:from-cyan-400 hover:to-teal-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {acceptingOrderId === order.id ? '接單中...' : '立即接單'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 快速導航 */}
        <div className="mt-8 flex justify-center">
          <a
            href="/driver/profile"
            className="px-6 py-3 bg-slate-700 text-slate-300 font-medium rounded-lg hover:bg-slate-600 transition"
          >
            查看我的資料
          </a>
        </div>
      </main>
    </div>
  )
}
