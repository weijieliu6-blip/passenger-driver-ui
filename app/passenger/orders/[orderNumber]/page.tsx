'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, MapPin, Clock, Users, Luggage, Car, Phone,
  CheckCircle2, X, Loader2, AlertCircle, Wallet, ShieldCheck,
  Calendar, Baby, FileText, Hash, ChevronRight, Star
} from 'lucide-react'

interface DriverInfo {
  id: string
  name: string
  phone: string
  avatarUrl: string | null
  vehicleModel: string | null
  drivingYears: number
  rating: number
  totalOrders: number
}

interface Order {
  id: number
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
  is_charter: boolean | null
  has_child: boolean | null
  child_type: string | null
  passenger_name: string
  passenger_phone: string
  passenger_notes: string | null
  service_type: string | null
  direction: string | null
  estimated_fare: number | null
  confirmed_price: number | null
  price_currency: string | null
  price_confirmed_at: string | null
  driver_name: string | null
  driver_phone: string | null
  driver_plate: string | null
  driver_notes: string | null
  grabbed_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  created_at: string
  driver?: DriverInfo | null
}

export default function OrderDetailPage() {
  const params = useParams<{ orderNumber: string }>()
  const router = useRouter()
  const orderNumber = params.orderNumber

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    fetchOrder()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber])

  async function fetchOrder() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/orders/${orderNumber}`)
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.message || data.error || '訂單讀取失敗')
        return
      }
      setOrder(data.order)
    } catch (err) {
      setError(err instanceof Error ? err.message : '網絡錯誤')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!order) return
    if (!confirm(`確定要取消訂單 ${order.order_number} 嗎？`)) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/orders/${order.order_number}/cancel`, { method: 'PUT' })
      const data = await res.json()
      if (data.success) {
        alert('訂單已取消')
        fetchOrder()
      } else {
        alert(data.message || '取消失敗')
      }
    } catch (err) {
      alert('網絡錯誤')
    } finally {
      setCancelling(false)
    }
  }

  async function handleAcceptQuote() {
    if (!order) return
    if (!confirm(`確認接受司機報價 ${order.price_currency === 'CNY' ? '¥' : 'HK$'} ${order.confirmed_price}？\n\n請於上車前與司機聯繫確認。`)) return
    setAccepting(true)
    try {
      const res = await fetch(`/api/orders/${order.order_number}/accept-quote`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        alert('已確認訂單！司機會在約定時間接您。')
        fetchOrder()
      } else {
        alert(data.message || '確認失敗')
      }
    } catch (err) {
      alert('網絡錯誤')
    } finally {
      setAccepting(false)
    }
  }

  const statusMap: Record<string, { label: string; bg: string; text: string; gradient: string; icon: any }> = {
    pending: { label: '待接單', bg: 'bg-amber-500/20', text: 'text-amber-300', gradient: 'from-amber-500/15 to-orange-500/10 border-amber-500/30', icon: Clock },
    grabbed: { label: '已接單', bg: 'bg-emerald-500/20', text: 'text-emerald-300', gradient: 'from-emerald-500/15 to-teal-500/10 border-emerald-500/30', icon: CheckCircle2 },
    price_confirmed: { label: '已報價', bg: 'bg-yellow-500/20', text: 'text-yellow-300', gradient: 'from-yellow-500/20 to-amber-500/10 border-yellow-500/40', icon: CheckCircle2 },
    completed: { label: '已完成', bg: 'bg-slate-500/20', text: 'text-slate-300', gradient: 'from-slate-500/15 to-slate-600/10 border-slate-500/30', icon: CheckCircle2 },
    cancelled: { label: '已取消', bg: 'bg-red-500/20', text: 'text-red-300', gradient: 'from-red-500/15 to-pink-500/10 border-red-500/30', icon: X },
    expired: { label: '已過期', bg: 'bg-slate-500/20', text: 'text-slate-300', gradient: 'from-slate-500/15 to-slate-600/10 border-slate-500/30', icon: Clock },
  }
  const statusInfo = order ? (statusMap[order.status] || statusMap.pending) : statusMap.pending
  const StatusIcon = statusInfo.icon

  const vehicleTypeMap: Record<string, string> = {
    '4_seat': '4座車',
    '7_seat': '7座車',
    '8_seat': '8座車',
    sedan_5: '5座豐田',
    alphard_7: '7座埃爾法',
    business_9: '9座商務',
  }

  function formatDateTime(dateStr: string) {
    const d = new Date(dateStr)
    const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
    return {
      date: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${weekdays[d.getDay()]})`,
      time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-400">載入訂單中...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-slate-200 mb-2">無法載入訂單</p>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <Link
            href="/passenger/orders"
            className="inline-block px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg"
          >
            返回訂單列表
          </Link>
        </div>
      </div>
    )
  }

  const dt = formatDateTime(order.departure_time)
  const cur = order.price_currency === 'CNY' ? '¥' : 'HK$'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">返回</span>
          </button>
          <h1 className="text-base font-semibold text-slate-100">訂單詳情</h1>
          <Link href="/" className="text-cyan-400 hover:text-cyan-300 text-sm">首頁</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* 訂單狀態 + 編號 */}
        <div className={`bg-gradient-to-br ${statusInfo.gradient} backdrop-blur border rounded-2xl p-5`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Hash className="w-4 h-4 text-slate-400" />
                <span className="text-slate-100 font-mono font-bold text-lg">{order.order_number}</span>
              </div>
              <p className="text-xs text-slate-400">
                提交於 {new Date(order.created_at).toLocaleString('zh-HK', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
              </p>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${statusInfo.bg} ${statusInfo.text}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              <span className="text-sm font-medium">{statusInfo.label}</span>
            </div>
          </div>
        </div>

        {/* 路線 */}
        <div className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">行程路線</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-500 mb-0.5">出發地</p>
                <p className="text-slate-100 font-medium">{order.pickup_location}{order.pickup_area && ` - ${order.pickup_area}`}</p>
              </div>
            </div>
            <div className="ml-4 border-l-2 border-dashed border-slate-700 h-3" />
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-500 mb-0.5">目的地</p>
                <p className="text-slate-100 font-medium">{order.dropoff_location}{order.dropoff_area && ` - ${order.dropoff_area}`}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 時間 + 行程資訊 */}
        <div className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">行程詳情</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-500">出發時間</p>
                <p className="text-slate-100 font-medium">{dt.date}</p>
                <p className="text-cyan-400 font-bold">{dt.time}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-slate-900/50 rounded-lg">
                <Users className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                <p className="text-xs text-slate-500">乘客人數</p>
                <p className="text-slate-100 font-bold">{order.passengers}</p>
              </div>
              <div className="text-center p-3 bg-slate-900/50 rounded-lg">
                <Luggage className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                <p className="text-xs text-slate-500">行李件數</p>
                <p className="text-slate-100 font-bold">{order.luggage}</p>
              </div>
              <div className="text-center p-3 bg-slate-900/50 rounded-lg">
                <Car className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                <p className="text-xs text-slate-500">車型</p>
                <p className="text-slate-100 font-bold text-xs">{vehicleTypeMap[order.vehicle_type] || order.vehicle_type}</p>
              </div>
            </div>

            {(order.is_charter || order.has_child) && (
              <div className="flex flex-wrap gap-2 pt-2">
                {order.is_charter && (
                  <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-xs">包車</span>
                )}
                {order.has_child && (
                  <span className="px-2.5 py-1 bg-pink-500/20 text-pink-300 border border-pink-500/30 rounded-full text-xs flex items-center gap-1">
                    <Baby className="w-3 h-3" />
                    有孩童{order.child_type === 'over_3' ? '（3歲以上）' : '（嬰兒）'}
                  </span>
                )}
              </div>
            )}

            {order.passenger_notes && (
              <div className="bg-slate-900/50 rounded-lg p-3 mt-2">
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  備註
                </p>
                <p className="text-sm text-slate-200">{order.passenger_notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* 🔔 司機報價（醒目區塊） */}
        {order.confirmed_price != null && (
          <div className="bg-gradient-to-br from-yellow-500/20 via-amber-500/15 to-orange-500/20 border border-yellow-500/50 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center text-xl shadow-lg shadow-yellow-500/30">
                  💰
                </div>
                <div>
                  <p className="text-base font-bold text-yellow-300">司機已報價</p>
                  <p className="text-xs text-yellow-400/70">
                    {order.price_confirmed_at
                      ? new Date(order.price_confirmed_at).toLocaleString('zh-HK')
                      : '剛剛'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-amber-300">
                  {cur} {order.confirmed_price}
                </p>
                {order.estimated_fare != null && order.confirmed_price !== order.estimated_fare && (
                  <p className="text-xs text-slate-400 line-through">
                    原預估 {cur} {order.estimated_fare}
                  </p>
                )}
              </div>
            </div>

            {/* 確認 / 拒絕 按鈕 */}
            {order.status === 'price_confirmed' && (
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleAcceptQuote}
                  disabled={accepting}
                  className="flex-1 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-900 font-bold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {accepting ? <><Loader2 className="w-4 h-4 animate-spin" /> 確認中...</> : <><CheckCircle2 className="w-4 h-4" /> 確認接單</>}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition disabled:opacity-50"
                >
                  婉拒
                </button>
              </div>
            )}
          </div>
        )}

        {/* 司機資訊（已接單/已報價時） */}
        {order.driver_name && (order.status === 'grabbed' || order.status === 'price_confirmed' || order.status === 'completed') && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                司機已接單
              </h3>
              {order.grabbed_at && (
                <p className="text-xs text-slate-500">
                  {new Date(order.grabbed_at).toLocaleString('zh-HK', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                </p>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">司機姓名</span>
                <span className="text-slate-100 font-medium">{order.driver_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">聯絡電話</span>
                <a
                  href={`tel:${order.driver_phone}`}
                  className="text-cyan-400 hover:text-cyan-300 font-mono font-medium text-sm flex items-center gap-1"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {order.driver_phone}
                </a>
              </div>
              {order.driver_plate && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">車牌</span>
                  <span className="text-slate-100 font-mono">{order.driver_plate}</span>
                </div>
              )}
              {order.driver?.vehicleModel && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">車型</span>
                  <span className="text-slate-100 text-sm">{order.driver.vehicleModel}</span>
                </div>
              )}
              {order.driver && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">司機評分</span>
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-slate-100 font-medium">{order.driver.rating.toFixed(1)}</span>
                    <span className="text-slate-500 text-xs">({order.driver.totalOrders} 單)</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 取消訂單按鈕（pending 時） */}
        {order.status === 'pending' && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
          >
            {cancelling ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> 取消中...</>
            ) : (
              <><X className="w-4 h-4" /> 取消訂單</>
            )}
          </button>
        )}

        {/* 取消原因 */}
        {order.status === 'cancelled' && order.cancel_reason && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
            <p className="text-xs text-red-400 mb-1 font-medium">取消原因</p>
            <p className="text-sm text-slate-200">{order.cancel_reason}</p>
          </div>
        )}

        {/* 客服 */}
        <div className="text-center pt-4">
          <p className="text-xs text-slate-500">
            客服專線 <a href="tel:+85200000000" className="text-cyan-400 hover:text-cyan-300">+852 0000 0000</a>
          </p>
        </div>
      </main>
    </div>
  )
}
