'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  MapPin, Calendar, Users, Car, Clock, Phone, User, AlertCircle,
  CheckCircle, XCircle, CreditCard, ChevronRight, MessageCircle,
  Shield, Sparkles, Edit, Navigation
} from 'lucide-react'
import OrderWaitCard from '@/app/components/order-wait-card'

interface DriverInfo {
  id: string
  name: string
  phone: string
  avatarUrl?: string | null
  vehicleModel?: string | null
  drivingYears?: number
  rating?: number
  totalOrders?: number
}

interface Order {
  id: number
  order_number: string
  direction: string
  pickup_location: string
  pickup_area?: string | null
  dropoff_location: string
  dropoff_area?: string | null
  departure_time: string
  passengers: number
  vehicle_type: string
  passenger_name: string
  passenger_phone: string
  status: string
  created_at: string
  driver_id?: string | null
  driver_name?: string | null
  driver_phone?: string | null
  driver_plate?: string | null
  estimated_fare?: number | null
  confirmed_price?: number | null
  price_currency?: string | null
  price_confirmed_at?: string | null
  grabbed_at?: string | null
  completed_at?: string | null
  rating?: number | null
  driver?: DriverInfo | null
  /** 司機接單 deadline（建立訂單時 = now + 24h） */
  dispatch_deadline_at?: string | null
  /** 司機接單時間（更明確語義） */
  accepted_at?: string | null
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderNumber = params.orderNumber as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (orderNumber) {
      fetchOrder()
    }
  }, [orderNumber])

  // 30 秒輪詢訂單狀態（v1 釘釘搶單流程：訂單狀態一變就更新司機資訊）
  useEffect(() => {
    if (!orderNumber) return
    // 只在 pending / grabbed 狀態下輪詢；已結束就不輪詢
    if (order && !['pending', 'grabbed'].includes(order.status)) return

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderNumber}/status`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (data.error) return
        setOrder((prev) => {
          if (!prev) return prev
          if (prev.status === data.status && prev.driver_name === (data.driver?.name ?? null)) {
            return prev
          }
          return {
            ...prev,
            status: data.status,
            grabbed_at: data.grabbedAt ?? prev.grabbed_at,
            driver_name: data.driver?.name ?? prev.driver_name,
            driver_phone: data.driver?.phone ?? prev.driver_phone,
            driver_plate: data.driver?.plate ?? prev.driver_plate,
          }
        })
      } catch {
        // 忽略輪詢錯誤
      }
    }, 30_000)
    return () => clearInterval(intervalId)
  }, [orderNumber, order?.status])

  const fetchOrder = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/orders/${orderNumber}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || '查詢訂單失敗')
      }

      setOrder(data.order)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: '待接單', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' }
      case 'grabbed':
        return { label: '已接單', icon: CheckCircle, color: 'text-sky-400', bg: 'bg-sky-500/10' }
      case 'price_confirmed':
        return { label: '已報價', icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
      case 'completed':
        return { label: '已完成', icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
      case 'cancelled':
        return { label: '已取消', icon: XCircle, color: 'text-slate-400', bg: 'bg-slate-500/10' }
      case 'expired':
        return { label: '已過期', icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/10' }
      default:
        return { label: status, icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/10' }
    }
  }

  const getDirectionLabel = (direction: string) => {
    switch (direction) {
      case 'to_mainland': return '去內地'
      case 'to_hk': return '回香港'
      case 'hk_to_mainland': return '去內地'
      case 'mainland_to_hk': return '回香港'
      default: return direction
    }
  }

  const getVehicleTypeLabel = (type: string) => {
    switch (type) {
      case '7_seat': return '7座車'
      case '8_seat': return '8座車'
      case '4_seat': return '4座車'
      default: return type
    }
  }

  /**
   * 格式化價格，自動標明幣種
   */
  const formatPrice = (amount?: number | null, currency?: string | null) => {
    if (amount === null || amount === undefined) return null
    if (currency === 'CNY') {
      return { symbol: '¥', amount, text: `¥${amount}`, label: '人民幣' }
    }
    return { symbol: 'HK$', amount, text: `HK$${amount}`, label: '港幣' }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-sky-400/30 border-t-sky-400 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-400">查詢訂單中...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-slate-200 mb-2">訂單查詢失敗</h1>
          <p className="text-slate-400 mb-6">{error || '未找到訂單信息'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl transition-colors"
          >
            返回首頁
          </button>
        </div>
      </div>
    )
  }

  const statusInfo = getStatusInfo(order.status)
  const StatusIcon = statusInfo.icon
  const isDriverAssigned = ['grabbed', 'price_confirmed', 'completed'].includes(order.status) && order.driver_id
  const confirmedPrice = formatPrice(order.confirmed_price, order.price_currency)
  const estimatedPrice = formatPrice(order.estimated_fare, 'HKD')

  return (
    <div className="min-h-screen bg-[#0B0E14] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 頭部 */}
        <div className="mb-6">
          <Link href="/" className="text-sky-400 hover:text-sky-300 transition-colors mb-4 inline-block">
            ← 返回首頁
          </Link>
          <h1 className="text-2xl font-bold text-slate-100">訂單詳情</h1>
        </div>

        {/* 訂單號和狀態 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-slate-400 mb-1">訂單號</p>
              <p className="text-xl font-mono font-semibold text-slate-100">{order.order_number}</p>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${statusInfo.bg}`}>
              <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
              <span className={`font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
            </div>
          </div>
          <p className="text-sm text-slate-400">
            下單時間：{formatDepartureTime(order.created_at)}
          </p>
        </div>

        {/* 等待接單時間卡（pending 顯示，已接單則切換為簡潔橫幅） */}
        <OrderWaitCard order={order} serverNowMs={Date.now()} />

        {/* 司機已接單提示橫幅 */}
        {order.status === 'grabbed' && (
          <div className="bg-gradient-to-r from-sky-500/10 to-cyan-500/10 border border-sky-500/30 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-sky-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sky-300">司機已接單</p>
              <p className="text-xs text-slate-400 mt-0.5">司機確認後將會輸入最終報價，請留意通知</p>
            </div>
            <Link
              href={`/passenger/track/${orderNumber}`}
              className="px-3 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
            >
              <Navigation className="w-3.5 h-3.5" />
              追蹤
            </Link>
          </div>
        )}

        {order.status === 'price_confirmed' && (
          <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-emerald-300">司機已報價</p>
              <p className="text-xs text-slate-400 mt-0.5">請聯繫司機確認行程細節</p>
            </div>
            <Link
              href={`/passenger/track/${orderNumber}`}
              className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
            >
              <Navigation className="w-3.5 h-3.5" />
              即時追蹤
            </Link>
          </div>
        )}

        {/* 行程信息 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 mb-4">
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-sky-400" />
            行程信息
          </h2>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                <MapPin className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-400 mb-1">出發地</p>
                <p className="text-slate-100">
                  {order.pickup_location}
                  {order.pickup_area && <span className="text-slate-400 ml-1">· {order.pickup_area}</span>}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                <MapPin className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-400 mb-1">目的地</p>
                <p className="text-slate-100">
                  {order.dropoff_location}
                  {order.dropoff_area && <span className="text-slate-400 ml-1">· {order.dropoff_area}</span>}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700/50">
              <div>
                <p className="text-sm text-slate-400 mb-1">出發時間</p>
                <p className="text-slate-100">{formatDepartureTime(order.departure_time)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">行程方向</p>
                <p className="text-slate-100">{getDirectionLabel(order.direction)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-400 mb-1">乘客人數</p>
                <p className="text-slate-100">{order.passengers} 人</p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">車型</p>
                <p className="text-slate-100">{getVehicleTypeLabel(order.vehicle_type)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 價格信息 */}
        {(confirmedPrice || estimatedPrice) && (
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-6 mb-4">
            <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-400" />
              價格信息
            </h2>

            {confirmedPrice && (
              <div className="mb-4">
                <p className="text-sm text-slate-400 mb-2">司機確認價格</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold text-amber-400">{confirmedPrice.text}</span>
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-sm font-medium rounded-full">
                    {confirmedPrice.label}
                  </span>
                </div>
                {order.price_confirmed_at && (
                  <p className="text-xs text-slate-500 mt-2">
                    確認時間：{formatDepartureTime(order.price_confirmed_at)}
                  </p>
                )}
              </div>
            )}

            {!confirmedPrice && estimatedPrice && (
              <div>
                <p className="text-sm text-slate-400 mb-2">預估車資（僅供參考）</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-slate-300">{estimatedPrice.text}</span>
                  <span className="px-3 py-1 bg-slate-700/50 text-slate-400 text-sm rounded-full">
                    {estimatedPrice.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  ⚠️ 最終價格由司機確認，可能會有差異
                </p>
              </div>
            )}

            {confirmedPrice && estimatedPrice && confirmedPrice.amount !== estimatedPrice.amount && (
              <div className="mt-3 p-3 bg-slate-900/40 rounded-lg text-xs text-slate-400">
                <p>預估車資：{estimatedPrice.text} → 確認價格：{confirmedPrice.text}</p>
              </div>
            )}
          </div>
        )}

        {/* 乘客信息 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 mb-4">
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-sky-400" />
            乘客信息
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-sm text-slate-400">姓名</p>
                <p className="text-slate-100">{order.passenger_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-sm text-slate-400">電話</p>
                <p className="text-slate-100 font-mono">{order.passenger_phone}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 司機信息（如已接單） */}
        {isDriverAssigned && (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl overflow-hidden mb-4">
            {/* 可點擊跳轉的司機頭部 */}
            <Link
              href={`/passenger/driver/${order.driver_id}`}
              className="block p-6 hover:bg-slate-700/30 transition-colors group"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  司機信息
                </h2>
                <div className="flex items-center gap-1 text-sm text-sky-400 group-hover:text-sky-300">
                  <span>查看詳情</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* 頭像 */}
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                  {order.driver?.avatarUrl ? (
                    <img src={order.driver.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-slate-900" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xl font-semibold text-slate-100">{order.driver_name}</p>
                    {order.driver?.rating !== undefined && order.driver.rating > 0 && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 rounded text-yellow-400 text-xs">
                        <span>★</span>
                        <span className="font-medium">{order.driver.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
                    {order.driver?.vehicleModel && (
                      <span>{order.driver.vehicleModel}</span>
                    )}
                    {order.driver?.drivingYears !== undefined && order.driver.drivingYears > 0 && (
                      <span>· {order.driver.drivingYears} 年駕齡</span>
                    )}
                    {order.driver?.totalOrders !== undefined && order.driver.totalOrders > 0 && (
                      <span>· 已接 {order.driver.totalOrders} 單</span>
                    )}
                  </div>
                  {order.driver_plate && (
                    <p className="text-xs text-slate-500 mt-1">車牌：{order.driver_plate}</p>
                  )}
                </div>
              </div>
            </Link>

            {/* 聯繫按鈕 */}
            <div className="border-t border-slate-700/50 p-4 grid grid-cols-2 gap-3">
              {order.driver_phone && (
                <a
                  href={`tel:${order.driver_phone}`}
                  className="flex items-center justify-center gap-2 py-3 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 rounded-xl transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  <span className="font-medium">聯繫司機</span>
                </a>
              )}
              <a
                href="tel:4001234567"
                className="flex items-center justify-center gap-2 py-3 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600 text-slate-300 rounded-xl transition-colors"
              >
                <Shield className="w-4 h-4" />
                <span className="font-medium">聯繫平台</span>
              </a>
            </div>
          </div>
        )}

        {/* 訂單操作 */}
        {(order.status === 'pending' || order.status === 'grabbed') && (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 mb-4">
            <h3 className="text-sm font-medium text-slate-400 mb-3">訂單操作</h3>
            <div className="grid grid-cols-2 gap-3">
              {order.status === 'pending' && (
                <Link
                  href={`/order/${order.order_number}/edit`}
                  className="flex items-center justify-center gap-2 py-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  <span className="font-medium">修改訂單</span>
                </Link>
              )}
              <button
                onClick={async () => {
                  const msg = order.status === 'grabbed'
                    ? `訂單已被司機接單，確定要取消嗎？\n\n注意：取消已接單訂單可能會影響您的信用`
                    : `確定要取消訂單嗎？`
                  if (!confirm(msg)) return
                  const res = await fetch(`/api/orders/${order.order_number}/cancel`, { method: 'PUT' })
                  const data = await res.json()
                  if (data.success) {
                    alert('訂單已取消')
                    router.push('/passenger/profile')
                  } else {
                    alert(data.error || data.message || '取消失敗')
                  }
                }}
                className={`flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl transition-colors ${
                  order.status === 'grabbed' ? 'col-span-2' : ''
                }`}
              >
                <XCircle className="w-4 h-4" />
                <span className="font-medium">取消訂單</span>
              </button>
            </div>
          </div>
        )}

        {/* 評分區（如已完成未評分） */}
        {order.status === 'completed' && !order.rating && (
          <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 rounded-2xl p-6 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <MessageCircle className="w-5 h-5 text-yellow-400" />
              <h3 className="font-semibold text-yellow-300">為司機評分</h3>
            </div>
            <p className="text-sm text-slate-400 mb-3">您的評分有助於提升平台服務質量</p>
            <Link
              href={`/passenger/profile`}
              className="block w-full text-center py-3 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-xl transition-colors"
            >
              去評分
            </Link>
          </div>
        )}

        {/* 已評分 */}
        {order.status === 'completed' && order.rating && (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 mb-4">
            <h3 className="font-medium text-slate-300 mb-3">您的評分</h3>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`text-2xl ${star <= (order.rating || 0) ? 'text-yellow-400' : 'text-slate-600'}`}
                >
                  ★
                </span>
              ))}
              <span className="ml-2 text-sm text-slate-400">{order.rating}.0</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 格式化出發時間（ISO string → 友好顯示）
 * @example 2026-10-08T10:00:00+08:00 → "2026/10/08 10:00"
 */
function formatDepartureTime(iso: string): string {
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
