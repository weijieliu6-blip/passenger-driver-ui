'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Phone, Search, Clock, MapPin, Users, Luggage, Car, X, ArrowLeft, AlertCircle, Loader2, User, Navigation, CheckCircle2 } from 'lucide-react'

interface Order {
  id: string
  order_number: string
  status: string
  pickup_location: string
  pickup_area: string | null
  dropoff_location: string
  dropoff_area: string | null
  departure_time: string
  passengers: number
  luggage: number
  vehicle_type: string
  driver_name: string | null
  driver_phone: string | null
  driver_plate: string | null
  confirmed_price: number | null
  price_currency: string | null
  price_confirmed_at: string | null
  estimated_fare: number | null
  service_type: string | null
  direction: string | null
  is_charter: boolean | null
  has_child: boolean | null
  passenger_notes: string | null
  created_at: string
}

interface PassengerInfo {
  id: string
  name: string
  phone: string
}

export default function PassengerOrdersPage() {
  return (
    <Suspense fallback={null}>
      <PassengerOrdersContent />
    </Suspense>
  )
}

function PassengerOrdersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const phoneParam = searchParams.get('phone')
  
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [phone, setPhone] = useState(phoneParam || '')
  const [searched, setSearched] = useState(false)
  const [passenger, setPassenger] = useState<PassengerInfo | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  // 檢查登入狀態
  useEffect(() => {
    checkAuth()
  }, [])

  // 首次加载如果有 phone 参数则自动查询
  useEffect(() => {
    if (phoneParam) {
      handleSearch()
    } else if (passenger) {
      // 已登入用戶自動查詢
      handleSearch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passenger])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      const data = await response.json()
      if (data.authenticated) {
        setPassenger(data.user)
        setPhone(data.user.phone)
      }
    } catch (err) {
      console.error('Check auth error:', err)
    } finally {
      setAuthChecked(true)
    }
  }

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    // 已登入用戶無需輸入電話
    if (!passenger && !phone.trim()) {
      setError('請輸入手機號碼')
      return
    }
    
    if (!passenger && !/^[\d\s\-+()]{8,}$/.test(phone.trim())) {
      setError('請輸入有效的手機號碼（至少8位數字）')
      return
    }
    
    setError('')
    setLoading(true)
    setSearched(true)
    
    try {
      // 已登入：查詢綁定訂單；未登入：通過電話查詢
      const url = passenger 
        ? '/api/orders/passenger'
        : `/api/orders/passenger?phone=${encodeURIComponent(phone.trim())}`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        setOrders(data.orders)
      } else {
        setError(data.message || '獲取訂單失敗')
      }
    } catch (err) {
      setError('網絡錯誤，請稍後重試')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelOrder = async (orderId: string, orderNumber: string) => {
    if (!confirm(`確定要取消訂單 ${orderNumber} 嗎？`)) {
      return
    }

    try {
      setCancellingId(orderId)
      const response = await fetch(`/api/orders/${orderNumber}/cancel`, {
        method: 'PUT'
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert('訂單已成功取消')
        handleSearch()
      } else {
        alert(data.message || '取消訂單失敗')
      }
    } catch (err) {
      alert('取消訂單失敗，請稍後重試')
    } finally {
      setCancellingId(null)
    }
  }

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { text: string; bgClass: string; textClass: string; icon: any; gradient: string }> = {
      pending: {
        text: '待接單',
        bgClass: 'bg-amber-500/20',
        textClass: 'text-amber-300',
        icon: Clock,
        gradient: 'from-amber-500/10 to-orange-500/10 border-amber-500/30'
      },
      grabbed: {
        text: '已接單',
        bgClass: 'bg-emerald-500/20',
        textClass: 'text-emerald-300',
        icon: CheckCircle2,
        gradient: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/30'
      },
      price_confirmed: {
        text: '已報價',
        bgClass: 'bg-yellow-500/20',
        textClass: 'text-yellow-300',
        icon: CheckCircle2,
        gradient: 'from-yellow-500/15 to-amber-500/10 border-yellow-500/40'
      },
      completed: {
        text: '已完成',
        bgClass: 'bg-slate-500/20',
        textClass: 'text-slate-300',
        icon: CheckCircle2,
        gradient: 'from-slate-500/10 to-slate-600/10 border-slate-500/30'
      },
      cancelled: {
        text: '已取消',
        bgClass: 'bg-red-500/20',
        textClass: 'text-red-300',
        icon: X,
        gradient: 'from-red-500/10 to-pink-500/10 border-red-500/30'
      },
      expired: {
        text: '已過期',
        bgClass: 'bg-slate-500/20',
        textClass: 'text-slate-300',
        icon: Clock,
        gradient: 'from-slate-500/10 to-slate-600/10 border-slate-500/30'
      }
    }
    return statusMap[status] || statusMap.pending
  }

  const getVehicleTypeText = (type: string) => {
    const map: Record<string, string> = {
      '4_seat': '4座車',
      '7_seat': '7座車',
      '8_seat': '8座車'
    }
    return map[type] || type
  }

  const formatDepartureTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const day = date.getDate()
      const hour = date.getHours()
      const minute = date.getMinutes().toString().padStart(2, '0')
      const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
      const weekday = weekdays[date.getDay()]
      const period = hour >= 5 && hour < 12 ? '早上' : hour >= 12 && hour < 18 ? '下午' : '晚上'
      const hourStr = hour.toString().padStart(2, '0')
      
      return {
        date: `${year}年${month}月${day}日 (${weekday})`,
        time: `${period} ${hourStr}:${minute}`
      }
    } catch {
      return { date: dateStr, time: '' }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">返回首頁</span>
          </button>
          <h1 className="text-base font-semibold text-slate-100">我的訂單</h1>
          {passenger ? (
            <Link href="/passenger/profile" className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-sm">
              <User className="w-4 h-4" />
              個人中心
            </Link>
          ) : (
            <Link href="/passenger/login" className="text-cyan-400 hover:text-cyan-300 text-sm">
              登入
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* 已登入用戶提示 */}
        {passenger && (
          <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-center gap-2">
            <User className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-cyan-300">
              已登入：{passenger.name}（{passenger.phone}）- 顯示您的所有訂單
            </span>
          </div>
        )}
        
        {/* 搜索卡片 - 僅未登入用戶顯示 */}
        {!passenger && (
          <div className="mb-6 bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border border-cyan-500/30 rounded-2xl p-6 backdrop-blur">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg flex items-center justify-center">
                <Search className="w-5 h-5 text-slate-900" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">查詢我的訂單</h2>
                <p className="text-xs text-cyan-300">輸入手機號碼查看訂單狀態</p>
              </div>
            </div>
            
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex-1 relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="請輸入手機號碼"
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-semibold rounded-lg hover:from-cyan-400 hover:to-teal-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  '查詢'
                )}
              </button>
            </form>
            
            <div className="mt-3 text-center">
              <p className="text-xs text-slate-500">
                不想每次輸電話？{' '}
                <Link href="/passenger/login" className="text-cyan-400 hover:text-cyan-300">
                  註冊帳號
                </Link>
              </p>
            </div>
            
            {error && (
              <div className="mt-3 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-3" />
            <p className="text-slate-400">查詢中...</p>
          </div>
        )}

        {/* 订单列表 */}
        {!loading && searched && orders.length === 0 && (
          <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-300 mb-2">暫無訂單記錄</p>
            <p className="text-sm text-slate-500 mb-6">
              {passenger ? `${passenger.name}還沒有訂單` : (phone ? `手機號 ${phone} 還沒有訂單` : '請先輸入手機號碼查詢')}
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-semibold rounded-lg hover:from-cyan-400 hover:to-teal-400 transition"
            >
              立即下單
            </button>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-400">
                共找到 <span className="text-cyan-400 font-bold">{orders.length}</span> 筆訂單
              </p>
              <button
                onClick={() => handleSearch()}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
              >
                <Loader2 className="w-3 h-3" />
                重新整理
              </button>
            </div>
            
            {orders.map((order) => {
              const statusInfo = getStatusInfo(order.status)
              const StatusIcon = statusInfo.icon
              const dt = formatDepartureTime(order.departure_time)
              const pickupText = order.pickup_area 
                ? `${order.pickup_location} - ${order.pickup_area}`
                : order.pickup_location
              const dropoffText = order.dropoff_area
                ? `${order.dropoff_location} - ${order.dropoff_area}`
                : order.dropoff_location

              return (
                <Link
                  key={order.id}
                  href={`/passenger/orders/${order.order_number}`}
                  className={`block bg-gradient-to-br ${statusInfo.gradient} backdrop-blur border rounded-2xl p-5 transition-all hover:scale-[1.01] hover:border-cyan-500/50 cursor-pointer`}
                >
                  {/* 订单头部 */}
                  <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-700/30">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-slate-100 font-mono">
                          {order.order_number}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500">
                        提交：{new Date(order.created_at).toLocaleString('zh-HK', {
                          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
                        })}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${statusInfo.bgClass} ${statusInfo.textClass}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span className="text-sm font-medium">{statusInfo.text}</span>
                    </div>
                  </div>

                  {/* 路线信息 */}
                  <div className="mb-4 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MapPin className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 mb-0.5">出發地</p>
                        <p className="text-slate-100 font-medium truncate">{pickupText}</p>
                      </div>
                    </div>

                    <div className="ml-4 border-l-2 border-dashed border-slate-700 h-3" />

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MapPin className="w-4 h-4 text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 mb-0.5">目的地</p>
                        <p className="text-slate-100 font-medium truncate">{dropoffText}</p>
                      </div>
                    </div>
                  </div>

                  {/* 出发时间 */}
                  <div className="bg-slate-900/50 rounded-lg p-3 mb-4 flex items-center gap-3">
                    <Clock className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500">出發時間</p>
                      <p className="text-sm text-slate-100 font-medium truncate">{dt.date}</p>
                      <p className="text-sm text-cyan-400 font-medium">{dt.time}</p>
                    </div>
                  </div>

                  {/* 详细信息 */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800/60 rounded-full text-xs text-slate-300">
                      <Users className="w-3 h-3" />
                      {order.passengers} 人
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800/60 rounded-full text-xs text-slate-300">
                      <Luggage className="w-3 h-3" />
                      {order.luggage} 件
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800/60 rounded-full text-xs text-slate-300">
                      <Car className="w-3 h-3" />
                      {getVehicleTypeText(order.vehicle_type)}
                    </span>
                  </div>

                  {/* 🔔 司機報價（深藍紫 + 銀色字，專業不刺眼） */}
                  {order.confirmed_price != null && (
                    <div className="bg-gradient-to-r from-slate-800 via-slate-800/95 to-slate-800 border border-slate-600 rounded-xl p-4 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-base shadow-md shadow-cyan-500/20">
                            💬
                          </div>
                          <div>
                            <p className="text-xs text-slate-300 font-medium">司機已報價</p>
                            <p className="text-[10px] text-slate-500">
                              {order.price_confirmed_at
                                ? new Date(order.price_confirmed_at).toLocaleString('zh-HK', {
                                    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
                                  })
                                : '剛剛'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-slate-50">
                            {order.price_currency === 'CNY' ? '¥' : 'HK$'} {order.confirmed_price}
                          </div>
                          {order.estimated_fare != null && order.confirmed_price !== order.estimated_fare && (
                            <p className="text-[10px] text-slate-500">
                              預估 {order.price_currency === 'CNY' ? '¥' : 'HK$'} {order.estimated_fare}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="w-full py-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-lg text-sm font-medium transition"
                      >
                        查看詳情並確認 →
                      </button>
                    </div>
                  )}

                  {/* 司機信息（已接单时显示） */}
                  {(order.status === 'grabbed' || order.status === 'price_confirmed') && order.driver_name && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 mb-4">
                      <p className="text-xs text-emerald-400 mb-2 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        司機已接單
                      </p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">司機姓名</span>
                          <span className="text-sm text-slate-100 font-medium">{order.driver_name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">聯絡電話</span>
                          <a
                            href={`tel:${order.driver_phone}`}
                            onClick={e => e.stopPropagation()}
                            className="text-sm text-cyan-400 hover:text-cyan-300 font-mono font-medium"
                          >
                            {order.driver_phone}
                          </a>
                        </div>
                        {order.driver_plate && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">車牌</span>
                            <span className="text-sm text-slate-100 font-mono">{order.driver_plate}</span>
                          </div>
                        )}
                      </div>
                      {/* 即時追蹤入口 */}
                      <Link
                        href={`/passenger/track/${order.order_number}`}
                        onClick={e => e.stopPropagation()}
                        className="mt-3 w-full py-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        即時追蹤司機位置
                      </Link>
                    </div>
                  )}

                  {/* 操作按钮 */}
                  {order.status === 'pending' && (
                    <button
                      type="button"
                      onClick={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleCancelOrder(order.id, order.order_number)
                      }}
                      disabled={cancellingId === order.id}
                      className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      {cancellingId === order.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          取消中...
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4" />
                          取消訂單
                        </>
                      )}
                    </button>
                  )}

                  {/* 查看詳情鏈接（pending 以外的訂單） */}
                  {order.status !== 'pending' && (
                    <div className="text-center text-xs text-cyan-400 mt-2">
                      點擊卡片查看完整詳情 →
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}

        {/* 初始状态提示 - 未登入用戶 */}
        {!loading && !searched && !passenger && (
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-slate-800/60 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-300 mb-2">請輸入手機號碼</p>
            <p className="text-sm text-slate-500 mb-6">我們將查詢該號碼的所有訂單記錄</p>
            <Link
              href="/passenger/login"
              className="inline-block px-6 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-semibold rounded-lg hover:from-cyan-400 hover:to-teal-400 transition"
            >
              註冊帳號享受更多功能
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
