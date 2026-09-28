'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, Mail, Phone, LogOut, Package, MapPin, Calendar, Star, Edit, ChevronRight, Bell, X, RefreshCw } from 'lucide-react'

interface PassengerInfo {
  id: string
  email: string
  name: string
  phone: string
  role: string
  avatar_url?: string
}

interface Order {
  id: number
  order_number: string
  status: string
  pickup_location: string
  dropoff_location: string
  pickup_area?: string
  dropoff_area?: string
  departure_time: string
  created_at: string
  driver_name?: string
  driver_phone?: string
  driver_plate?: string
  rating?: number
  completed_at?: string | null
  cancelled_at?: string | null
  grabbed_at?: string | null
  confirmed_price?: number | null
  price_currency?: string | null
}

type TabType = 'active' | 'cancelled' | 'history'

export default function PassengerProfilePage() {
  const router = useRouter()
  const [passenger, setPassenger] = useState<PassengerInfo | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('active')
  const [pendingRatingCount, setPendingRatingCount] = useState(0)
  const [ratingOrder, setRatingOrder] = useState<Order | null>(null)
  const [rating, setRating] = useState(5)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null)
  const [rebookingId, setRebookingId] = useState<number | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      // 1. 獲取乘客信息
      const meRes = await fetch('/api/auth/me')
      const meData = await meRes.json()
      
      if (!meData.authenticated) {
        router.push('/passenger/login?redirect=/passenger/profile')
        return
      }
      
      setPassenger(meData.user)
      
      // 2. 獲取訂單列表
      const ordersRes = await fetch('/api/orders/passenger')
      const ordersData = await ordersRes.json()
      
      if (ordersData.success) {
        const allOrders = ordersData.orders || []
        setOrders(allOrders)
        
        // 計算待評分訂單數量
        const pendingCount = allOrders.filter(
          (o: Order) => o.status === 'completed' && !o.rating
        ).length
        setPendingRatingCount(pendingCount)
      }
    } catch (err) {
      console.error('Load profile error:', err)
      router.push('/passenger/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    if (!confirm('確定要登出嗎？')) return
    
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/')
      router.refresh()
    } catch (err) {
      alert('登出失敗，請稍後重試')
    } finally {
      setLoggingOut(false)
    }
  }

  // 取消訂單
  const handleCancelOrder = async (order: Order) => {
    const confirmMsg = (order.status === 'grabbed' || order.status === 'price_confirmed')
      ? `訂單 #${order.order_number} 已被司機接單並報價，確定要取消嗎？\n\n注意：取消已接單的訂單可能會影響您的信用`
      : `確定要取消訂單 #${order.order_number} 嗎？`
    
    if (!confirm(confirmMsg)) return
    
    setCancellingOrderId(order.id)
    try {
      const res = await fetch(`/api/orders/${order.order_number}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await res.json()
      
      if (data.success) {
        // 重新加載訂單列表
        await loadProfile()
        alert('訂單已取消')
      } else {
        alert(data.error || '取消失敗，請稍後重試')
      }
    } catch (err) {
      console.error('Cancel order error:', err)
      alert('取消失敗，請稍後重試')
    } finally {
      setCancellingOrderId(null)
    }
  }

  // 重新預約：從已取消訂單複製數據，跳轉到首頁並 prefill 表單
  const handleRebook = async (order: Order) => {
    setRebookingId(order.id)
    try {
      const res = await fetch(`/api/orders/${order.order_number}/rebook`, {
        method: 'POST'
      })
      const data = await res.json()
      
      if (!data.success) {
        alert(data.error || '重新預約失敗')
        return
      }
      
      // 保存數據到 localStorage，跳轉到首頁
      if (typeof window !== 'undefined') {
        localStorage.setItem('bookingData', JSON.stringify(data.bookingData))
        router.push('/')
      }
    } catch (err) {
      console.error('Rebook error:', err)
      alert('重新預約失敗，請稍後重試')
    } finally {
      setRebookingId(null)
    }
  }

  // 過濾訂單
  const getFilteredOrders = () => {
    switch (activeTab) {
      case 'active':
        // 進行中：待接單、已接單、已報價（任何「未結束」的訂單）
        return orders.filter(o =>
          o.status === 'pending' ||
          o.status === 'grabbed' ||
          o.status === 'price_confirmed'
        )

      case 'cancelled':
        // 已取消：所有已取消訂單（不論時間）
        return orders.filter(o => o.status === 'cancelled')

      case 'history':
        // 歷史：所有已完成的訂單
        return orders.filter(o => o.status === 'completed')

      default:
        return []
    }
  }

  const filteredOrders = getFilteredOrders()

  // 提交評分
  const submitRating = async () => {
    if (!ratingOrder) return
    
    setRatingSubmitting(true)
    try {
      const res = await fetch(`/api/orders/${ratingOrder.order_number}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      })
      
      const data = await res.json()
      
      if (data.success) {
        // 更新本地訂單數據
        setOrders(prev => prev.map(o => 
          o.order_number === ratingOrder.order_number 
            ? { ...o, rating } 
            : o
        ))
        setPendingRatingCount(prev => Math.max(0, prev - 1))
        setRatingOrder(null)
        alert('評分成功！')
      } else {
        alert(data.error || '評分失敗')
      }
    } catch (err) {
      console.error('Submit rating error:', err)
      alert('評分失敗，請稍後重試')
    } finally {
      setRatingSubmitting(false)
    }
  }

  // 訂單狀態顯示
  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string, color: string }> = {
      'pending': { label: '待接單', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      'grabbed': { label: '已接單', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
      'price_confirmed': { label: '已報價', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
      'completed': { label: '已完成', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
      'cancelled': { label: '已取消', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
    }
    const info = map[status] || { label: status, color: 'bg-slate-500/20 text-slate-400' }
    return <span className={`inline-block px-2 py-0.5 text-xs rounded border ${info.color}`}>{info.label}</span>
  }

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-HK', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">載入中...</div>
      </div>
    )
  }

  if (!passenger) {
    return null
  }

  const totalActive = orders.filter(o =>
    o.status === 'pending' || o.status === 'grabbed' || o.status === 'price_confirmed'
  ).length
  const totalCancelled = orders.filter(o => o.status === 'cancelled').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-cyan-400 hover:text-cyan-300 text-sm">
            ← 返回首頁
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-red-400 transition disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            {loggingOut ? '登出中...' : '登出'}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 個人資料卡片 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            {/* 頭像 */}
            <div className="relative">
              {passenger.avatar_url ? (
                <img 
                  src={passenger.avatar_url} 
                  alt={passenger.name}
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-cyan-500/30"
                />
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-slate-900" />
                </div>
              )}
              
              {/* 待評分提示紅點 */}
              {pendingRatingCount > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                  <span className="text-white text-xs font-bold">{pendingRatingCount}</span>
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-50">{passenger.name}</h1>
              <p className="text-sm text-slate-400">乘客帳號</p>
            </div>
            
            <Link
              href="/passenger/profile/edit"
              className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition"
            >
              <Edit className="w-4 h-4" />
              編輯資料
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
              <Mail className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="text-xs text-slate-500">電郵</div>
                <div className="text-sm text-slate-300">{passenger.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
              <Phone className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="text-xs text-slate-500">電話</div>
                <div className="text-sm text-slate-300">{passenger.phone}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 訂單列表 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
          {/* Tab 導航 */}
          <div className="flex items-center gap-2 mb-6 border-b border-slate-700 pb-4">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                activeTab === 'active'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              <Package className="w-4 h-4" />
              進行中
              {totalActive > 0 && (
                <span className="bg-cyan-500 text-slate-900 text-xs font-bold px-1.5 py-0.5 rounded">
                  {totalActive}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setActiveTab('cancelled')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                activeTab === 'cancelled'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              <Bell className="w-4 h-4" />
              已取消
              {totalCancelled > 0 && (
                <span className="bg-slate-600 text-slate-300 text-xs font-bold px-1.5 py-0.5 rounded">
                  {totalCancelled}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                activeTab === 'history'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              歷史訂單
            </button>
          </div>

          {/* Tab 說明 */}
          <div className="mb-4 text-sm text-slate-500">
            {activeTab === 'active' && '顯示正在等待接單、已接單或已報價的訂單'}
            {activeTab === 'cancelled' && '顯示所有已取消的訂單（含取消原因與重新預約）'}
            {activeTab === 'history' && '顯示所有已完成的訂單（含評分入口）'}
          </div>
          
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">
                {activeTab === 'active' && '📋'}
                {activeTab === 'cancelled' && '🗑️'}
                {activeTab === 'history' && '📜'}
              </div>
              <p className="text-slate-400 mb-4">
                {activeTab === 'active' && '目前沒有進行中的訂單'}
                {activeTab === 'cancelled' && '沒有已取消的訂單'}
                {activeTab === 'history' && '沒有歷史訂單'}
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-medium rounded-lg hover:from-cyan-400 hover:to-teal-400 transition"
              >
                立即預約
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div key={order.id} className="p-4 bg-slate-900/50 border border-slate-700/30 rounded-lg hover:border-cyan-500/30 transition">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/order/${order.order_number}`}
                        className="font-medium text-slate-200 hover:text-cyan-400 transition"
                      >
                        訂單 #{order.order_number}
                      </Link>
                      {getStatusBadge(order.status)}
                      {order.status === 'completed' && order.rating && (
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${i < order.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`}
                            />
                          ))}
                        </div>
                      )}
                      {order.status === 'completed' && !order.rating && (
                        <button
                          onClick={() => setRatingOrder(order)}
                          className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded hover:bg-yellow-500/30 transition"
                        >
                          <Star className="w-3 h-3" />
                          待評分
                        </button>
                      )}
                      {(order.status === 'grabbed' || order.status === 'price_confirmed') && order.confirmed_price && (
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded">
                          💰 {order.price_currency === 'CNY' ? '¥' : 'HK$'}{order.confirmed_price}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDate(order.departure_time)}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-sm text-slate-400">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 text-green-400 flex-shrink-0" />
                      <div>
                        <div>從: {order.pickup_location}{order.pickup_area ? ` ${order.pickup_area}` : ''}</div>
                        <div>到: {order.dropoff_location}{order.dropoff_area ? ` ${order.dropoff_area}` : ''}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-cyan-400" />
                      {formatDate(order.departure_time)}
                    </div>
                  </div>

                  {order.driver_name && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-400">
                      🚗 司機: {order.driver_name} {order.driver_phone && `(${order.driver_phone})`}
                    </div>
                  )}

                  {/* 訂單操作按鈕 */}
                  {(order.status === 'pending' || order.status === 'grabbed' || order.status === 'price_confirmed') && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50 flex gap-2 justify-end">
                      {order.status === 'pending' && (
                        <Link
                          href={`/order/${order.order_number}/edit`}
                          className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 text-sm rounded-lg hover:bg-cyan-500/30 transition"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          修改訂單
                        </Link>
                      )}
                      <Link
                        href={`/order/${order.order_number}`}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-700/50 text-slate-300 text-sm rounded-lg hover:bg-slate-700 transition"
                      >
                        查看詳情
                      </Link>
                      <button
                        onClick={() => handleCancelOrder(order)}
                        disabled={cancellingOrderId === order.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-400 text-sm rounded-lg hover:bg-red-500/30 transition disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        {cancellingOrderId === order.id ? '取消中...' : '取消訂單'}
                      </button>
                    </div>
                  )}

                  {/* 已取消訂單的重新預約按鈕 */}
                  {order.status === 'cancelled' && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50 flex gap-2 justify-end">
                      <Link
                        href={`/order/${order.order_number}`}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-700/50 text-slate-300 text-sm rounded-lg hover:bg-slate-700 transition"
                      >
                        查看詳情
                      </Link>
                      <button
                        onClick={() => handleRebook(order)}
                        disabled={rebookingId === order.id}
                        className="flex items-center gap-1 px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 text-sm font-medium rounded-lg hover:from-cyan-400 hover:to-teal-400 transition disabled:opacity-50"
                      >
                        {rebookingId === order.id ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                            準備中...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            重新預約
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 評分彈窗 */}
      {ratingOrder && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-slate-50 mb-4 text-center">
              為司機評分
            </h3>
            
            <div className="text-center mb-6">
              <div className="text-sm text-slate-400 mb-2">訂單 #{ratingOrder.order_number}</div>
              {ratingOrder.driver_name && (
                <div className="text-cyan-400 font-medium">{ratingOrder.driver_name}</div>
              )}
            </div>
            
            {/* 星級評分 */}
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1 transition hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 transition ${
                      star <= rating
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-slate-600 hover:text-yellow-400'
                    }`}
                  />
                </button>
              ))}
            </div>
            
            <div className="text-center text-sm text-slate-400 mb-6">
              {rating === 5 && '非常滿意！'}
              {rating === 4 && '滿意'}
              {rating === 3 && '一般'}
              {rating === 2 && '不太滿意'}
              {rating === 1 && '很差'}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setRatingOrder(null)}
                className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition"
              >
                稍後評分
              </button>
              <button
                onClick={submitRating}
                disabled={ratingSubmitting}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 font-medium rounded-xl hover:from-cyan-400 hover:to-teal-400 transition disabled:opacity-50"
              >
                {ratingSubmitting ? '提交中...' : '提交評分'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
