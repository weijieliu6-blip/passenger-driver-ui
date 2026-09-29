'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  MapPin, Calendar, Users, Car, Phone, User, AlertCircle,
  CheckCircle, ArrowLeft, CreditCard, Luggage, Baby, Clock,
  LogOut, FileText, ShieldCheck, Navigation
} from 'lucide-react'

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
  estimated_fare?: number | null
  confirmed_price?: number | null
  price_currency?: string | null
  price_confirmed_at?: string | null
  driver_name?: string | null
  driver_plate?: string | null
  driver_phone?: string | null
  completed_at?: string | null
}

const VEHICLE_LABELS: Record<string, string> = {
  '4_seat': '4座車',
  '7_seat': '7座車',
  '8_seat': '8座車'
}

const DIRECTION_LABELS: Record<string, string> = {
  'to_mainland': '跨境專車：香港 → 內地',
  'to_hk': '跨境專車：內地 → 香港',
  'hk_to_mainland': '跨境專車：香港 → 內地',
  'mainland_to_hk': '跨境專車：內地 → 香港'
}

export default function DriverOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderNumber = params.orderNumber as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [driver, setDriver] = useState<any>(null)

  // 報價表單
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState<'HKD' | 'CNY'>('HKD')
  const [vehicleModel, setVehicleModel] = useState('')
  const [drivingYears, setDrivingYears] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    checkAuthAndLoad()
  }, [orderNumber])

  const checkAuthAndLoad = async () => {
    try {
      // 1. 檢查司機登入
      const meRes = await fetch('/api/auth/me')
      const meData = await meRes.json()
      if (!meData.authenticated || meData.user?.role !== 'driver') {
        router.push(`/driver/login?redirect=${encodeURIComponent(`/driver/orders/${orderNumber}`)}`)
        return
      }
      setDriver(meData.user)

      // 2. 加載訂單
      const orderRes = await fetch(`/api/orders/${orderNumber}`)
      const orderData = await orderRes.json()
      if (!orderRes.ok) {
        throw new Error(orderData.message || '查詢訂單失敗')
      }
      setOrder(orderData.order)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmPrice = async () => {
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      alert('請輸入有效的價格')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/driver/orders/${orderNumber}/confirm-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed_price: Number(price),
          price_currency: currency,
          vehicle_model: vehicleModel || undefined,
          driving_years: drivingYears ? Number(drivingYears) : undefined
        })
      })

      const data = await res.json()

      if (data.success) {
        alert(`✅ 報價成功！\n\n已通知乘客 ${currency} ${price}`)
        router.push('/driver/dashboard')
        router.refresh()
      } else {
        alert(data.error || data.message || '報價失敗')
      }
    } catch (err: any) {
      alert('網絡錯誤：' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = async () => {
    if (!confirm('確定要登出嗎？')) return
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/driver/login')
  }

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

  const isPending = order.status === 'grabbed' && !order.confirmed_price
  const isPriceConfirmed = order.status === 'price_confirmed' || order.confirmed_price
  const isActive = ['grabbed', 'price_confirmed'].includes(order.status) && !order.completed_at

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amber-900/20 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/driver/dashboard" className="flex items-center gap-2 text-amber-400 hover:text-amber-300">
            <ArrowLeft className="w-5 h-5" />
            返回
          </Link>
          <h1 className="text-lg font-medium text-slate-50">訂單詳情</h1>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-red-400 text-sm flex items-center gap-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 訂單號和狀態 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-slate-400 mb-1">訂單號</p>
              <p className="text-xl font-mono font-semibold text-slate-100">{order.order_number}</p>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
              isPriceConfirmed
                ? 'bg-emerald-500/10'
                : 'bg-amber-500/10'
            }`}>
              {isPriceConfirmed ? (
                <>
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="font-medium text-emerald-400">已報價</span>
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5 text-amber-400" />
                  <span className="font-medium text-amber-400">待報價</span>
                </>
              )}
            </div>
          </div>
          <p className="text-sm text-slate-400">
            接單時間：{order.driver_name ? '已接單' : '未接單'}
          </p>
        </div>

        {/* 行程信息 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 mb-4">
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-400" />
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
                <p className="text-slate-100">{DIRECTION_LABELS[order.direction] || order.direction}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-slate-400 mb-1">乘客人數</p>
                <p className="text-slate-100">{order.passengers} 人</p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">行李</p>
                <p className="text-slate-100">{order.luggage} 件</p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">車型</p>
                <p className="text-slate-100">{VEHICLE_LABELS[order.vehicle_type] || order.vehicle_type}</p>
              </div>
            </div>

            {order.has_child && order.child_type && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2">
                <Baby className="w-5 h-5 text-amber-400" />
                <span className="text-sm text-amber-300">
                  帶孩童：{order.child_type === 'infant' ? '3歲以下（不佔座）' : '3歲以上（佔座）'}
                </span>
              </div>
            )}

            {order.passenger_notes && (
              <div className="p-3 bg-slate-900/50 border border-slate-600 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">乘客備註</p>
                <p className="text-sm text-slate-100">{order.passenger_notes}</p>
              </div>
            )}

            {order.estimated_fare && (
              <div className="p-3 bg-slate-900/30 border border-slate-700/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">乘客看到的預估車資（僅供參考）</p>
                <p className="text-lg font-medium text-slate-300">HK$ {order.estimated_fare}</p>
              </div>
            )}
          </div>
        </div>

        {/* 乘客信息 */}
        {order.passenger_name && (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 mb-4">
            <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-amber-400" />
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
              {order.passenger_phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-400">電話</p>
                    <a
                      href={`tel:${order.passenger_phone}`}
                      className="text-cyan-400 hover:text-cyan-300 font-mono font-medium"
                    >
                      {order.passenger_phone}
                    </a>
                  </div>
                  <a
                    href={`tel:${order.passenger_phone}`}
                    className="px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-lg text-sm flex items-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    撥打
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 報價表單（待報價時顯示） */}
        {isPending && (
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-6 mb-4">
            <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-400" />
              確認價格
            </h2>
            <p className="text-sm text-slate-400 mb-5">
              輸入最終報價（將同步給乘客），可以同時完善您的車輛資料
            </p>

            <div className="space-y-4">
              {/* 金額 + 幣種 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    最終價格 *
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="例如 600"
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-2xl font-bold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    幣種 *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrency('HKD')}
                      className={`py-3 rounded-lg text-sm font-bold transition ${
                        currency === 'HKD'
                          ? 'bg-amber-500 text-slate-900'
                          : 'bg-slate-900/50 border border-slate-600 text-slate-300'
                      }`}
                    >
                      HK$
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency('CNY')}
                      className={`py-3 rounded-lg text-sm font-bold transition ${
                        currency === 'CNY'
                          ? 'bg-amber-500 text-slate-900'
                          : 'bg-slate-900/50 border border-slate-600 text-slate-300'
                      }`}
                    >
                      ¥
                    </button>
                  </div>
                </div>
              </div>

              {/* 車輛型號和駕齡（選填） */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-amber-500/20">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Car className="inline w-4 h-4 mr-1" />
                    車輛型號
                  </label>
                  <input
                    type="text"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="例：Toyota Alphard"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    駕齡（年）
                  </label>
                  <input
                    type="number"
                    value={drivingYears}
                    onChange={(e) => setDrivingYears(e.target.value)}
                    placeholder="例：5"
                    min="0"
                    max="50"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  />
                </div>
              </div>

              {/* 預覽 */}
              {price && (
                <div className="bg-slate-900/40 rounded-xl p-4 border border-amber-500/20">
                  <p className="text-xs text-slate-400 mb-2">預覽將發送給乘客：</p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-amber-400">
                      {currency === 'CNY' ? `¥${price}` : `HK$${price}`}
                    </span>
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded">
                      {currency === 'CNY' ? '人民幣' : '港幣'}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleConfirmPrice}
                disabled={submitting || !price}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold text-lg rounded-xl hover:from-amber-400 hover:to-orange-400 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                    確認中...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    確認報價
                  </>
                )}
              </button>

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-slate-400">
                <p className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>請確認您的報價合理，價格確認後將直接顯示給乘客。如需修改請聯繫乘客協商。</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 已報價 - 顯示已確認的價格 */}
        {isPriceConfirmed && order.confirmed_price && (
          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl p-6 mb-4">
            <h2 className="text-lg font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              已確認價格
            </h2>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-4xl font-bold text-emerald-400">
                {order.price_currency === 'CNY' ? `¥${order.confirmed_price}` : `HK$${order.confirmed_price}`}
              </span>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-sm rounded-full">
                {order.price_currency === 'CNY' ? '人民幣' : '港幣'}
              </span>
            </div>
            {order.price_confirmed_at && (
              <p className="text-xs text-slate-400 mt-2">
                確認時間：{formatDepartureTime(order.price_confirmed_at)}
              </p>
            )}
            <p className="text-sm text-slate-300 mt-3">
              ✅ 乘客已收到您的報價，請保持電話暢通以便乘客聯繫
            </p>
          </div>
        )}

        {/* 行程執行入口（報價完成後即可進入） */}
        {isActive && order.confirmed_price && (
          <div className="bg-gradient-to-br from-cyan-500/10 to-sky-500/10 border border-cyan-500/30 rounded-2xl p-6 mb-4">
            <h2 className="text-lg font-semibold text-slate-100 mb-2 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-cyan-400" />
              開始行程
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              進入行程執行頁面，系統將自動上報您的位置，並可在「抵達 / 上車 / 完成」三個階段即時通知乘客。
            </p>
            <Link
              href={`/driver/orders/${orderNumber}/execute`}
              className="block w-full text-center py-3 bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-900 font-bold rounded-xl hover:from-cyan-400 hover:to-sky-400 transition"
            >
              進入行程執行 →
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}

/**
 * 格式化 ISO 時間字串 → 友好顯示
 * @example 2026-10-08T10:00:00+08:00 → "2026/10/08 10:00"
 */
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
