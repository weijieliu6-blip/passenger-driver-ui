'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  MapPin, AlertCircle, ArrowLeft, CheckCircle,
  Loader2, Flag, CarFront, Navigation, RefreshCcw, User as UserLucide,
  MessageSquare, Star
} from 'lucide-react'
import { findLocationCoord, getCenterOfLocations } from '@/lib/location-coords'
import { supabase } from '@/lib/supabase'

// Leaflet 在 SSR 會炸，改用 dynamic import
const TrackMap = dynamic(() => import('@/components/track-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  ),
})

interface TrackData {
  orderNumber: string
  status: string
  pickupLocation: string
  pickupArea: string | null
  dropoffLocation: string
  dropoffArea: string | null
  departureTime: string
  passengers: number
  vehicleType: string
  price: { amount: number; currency: string } | null
  completedAt: string | null
  driver: {
    id: string
    name: string | null
    plate: string | null
    vehicleModel?: string | null
    rating?: number | null
    drivingYears?: number | null
    avatarUrl?: string | null
  } | null
  location: { lat: number; lng: number; heading?: number | null; speed?: number | null; updatedAt: string } | null
  events: Array<{
    id: number
    eventType: string
    actorRole: string
    payload: Record<string, unknown>
    createdAt: string
  }>
}

const STATUS_TEXT: Record<string, { label: string; color: string; desc: string }> = {
  pending: { label: '待接單', color: 'amber', desc: '正在等待司機接單' },
  grabbed: { label: '已接單', color: 'sky', desc: '司機已接單，請保持電話暢通' },
  price_confirmed: { label: '行程進行中', color: 'emerald', desc: '司機正前往為您服務' },
  completed: { label: '已完成', color: 'slate', desc: '行程已結束' },
  cancelled: { label: '已取消', color: 'red', desc: '訂單已取消' },
  expired: { label: '已過期', color: 'slate', desc: '訂單已過期' },
}

const POLL_INTERVAL = 8000

export default function PassengerTrackPage() {
  const params = useParams()
  const router = useRouter()
  const orderNumber = params.orderNumber as string

  const [data, setData] = useState<TrackData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState<number>(0)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // 主查詢
  const fetchTrack = async () => {
    try {
      const res = await fetch(`/api/orders/${orderNumber}/track`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || '查詢失敗')
        return
      }
      setData(json)
      setLastRefresh(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : '網絡錯誤')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!orderNumber) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTrack()
    // 輪詢（每 8 秒）
    const timer = setInterval(() => {
      // 隱藏時仍持續（背景也要拿最新位置），但降低頻率以省電
      fetchTrack()
    }, POLL_INTERVAL)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber])

  // Supabase Realtime：訂閱 driver_locations 與 ride_events 變化
  useEffect(() => {
    if (!orderNumber || !data) return
    // 只在已有司機綁定時訂閱
    if (!data.driver?.id) return
    try {
      const ch = supabase
        .channel(`track-${orderNumber}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'driver_locations',
            filter: `driver_id=eq.${data.driver.id}`,
          },
          () => {
            // 任一變化就重新拉（簡化邏輯，避免增量同步複雜度）
            fetchTrack()
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'ride_events',
            filter: `order_number=eq.${orderNumber}`,
          },
          () => {
            fetchTrack()
          }
        )
        .subscribe()
      channelRef.current = ch
    } catch (e) {
      console.warn('Realtime subscribe failed', e)
    }
    return () => {
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current)
        } catch {}
        channelRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber, data?.driver?.id])

  // 起點 / 終點座標
  const pickupCoord = useMemo(() => {
    if (!data) return undefined
    return (
      findLocationCoord(data.pickupArea || '') ||
      findLocationCoord(data.pickupLocation || '')
    )
  }, [data])

  const dropoffCoord = useMemo(() => {
    if (!data) return undefined
    return (
      findLocationCoord(data.dropoffArea || '') ||
      findLocationCoord(data.dropoffLocation || '')
    )
  }, [data])

  const mapCenter = useMemo(() => {
    const pts: Array<[number, number]> = []
    if (pickupCoord) pts.push([pickupCoord.lng, pickupCoord.lat])
    if (dropoffCoord) pts.push([dropoffCoord.lng, dropoffCoord.lat])
    if (data?.location) pts.push([data.location.lng, data.location.lat])
    if (pts.length === 0) return [114.17, 22.32] as [number, number]
    return getCenterOfLocations(
      pts.map(([lng, lat]) => ({ lng, lat, name: 'point' }))
    )
  }, [pickupCoord, dropoffCoord, data])

  // 從事件推出目前階段
  const stage = useMemo(() => {
    if (!data) return null
    if (data.status === 'completed') return 'completed'
    const types = new Set(data.events.map((e) => e.eventType))
    if (types.has('trip_completed')) return 'completed'
    if (types.has('driver_picked_up') || types.has('trip_started') || data.status === 'price_confirmed') {
      return 'in_trip'
    }
    if (types.has('driver_arrived')) return 'driver_arrived'
    if (data.driver) return 'driver_assigned'
    return 'pending'
  }, [data])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-400">載入行程...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-slate-200 mb-2">行程查詢失敗</h1>
          <p className="text-slate-400 text-sm mb-4">{error || '未找到訂單'}</p>
          <Link href="/passenger/orders" className="inline-block px-5 py-2 bg-cyan-500 text-white rounded-lg">
            返回訂單列表
          </Link>
        </div>
      </div>
    )
  }

  const statusInfo = STATUS_TEXT[data.status] ?? STATUS_TEXT.pending
  const isLive = ['grabbed', 'price_confirmed'].includes(data.status)
  const driverMessages = data.events
    .filter((e) => e.eventType === 'message')
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-[#0B0E14] pb-8">
      {/* Header */}
      <header className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push(`/passenger/orders/${orderNumber}`)}
            className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">訂單詳情</span>
          </button>
          <h1 className="text-base font-semibold text-slate-100">行程追蹤</h1>
          <button
            onClick={fetchTrack}
            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            刷新
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* 狀態卡 */}
        <div className={`rounded-2xl p-4 border bg-${statusInfo.color}-500/10 border-${statusInfo.color}-500/30`}>
          <div className="flex items-center gap-3">
            {isLive ? (
              <div className="relative">
                <span className={`absolute inset-0 rounded-full bg-${statusInfo.color}-400/40 animate-ping`} />
                <span className={`relative w-3 h-3 rounded-full bg-${statusInfo.color}-400 inline-block`} />
              </div>
            ) : (
              <CheckCircle className={`w-5 h-5 text-${statusInfo.color}-400`} />
            )}
            <div className="flex-1">
              <p className={`font-semibold text-${statusInfo.color}-300`}>{statusInfo.label}</p>
              <p className="text-xs text-slate-400">{statusInfo.desc}</p>
            </div>
            {isLive && (
              <span className="text-[10px] text-slate-500">
                更新於 {/* eslint-disable-next-line react-hooks/purity */}
                {Math.round((Date.now() - lastRefresh) / 1000)}s 前
              </span>
            )}
          </div>
        </div>

        {/* 地圖 */}
        <div className="rounded-2xl overflow-hidden border border-slate-700/50 h-[320px]">
          <TrackMap
            pickup={pickupCoord ? { name: data.pickupArea || data.pickupLocation, lng: pickupCoord.lng, lat: pickupCoord.lat } : null}
            dropoff={dropoffCoord ? { name: data.dropoffArea || data.dropoffLocation, lng: dropoffCoord.lng, lat: dropoffCoord.lat } : null}
            driverLocation={data.location}
            center={mapCenter}
          />
        </div>

        {/* 階段時間軸 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-cyan-400" />
            行程進度
          </h2>
          <div className="space-y-4">
            {[
              { key: 'driver_assigned', label: '司機已接單', icon: UserLucide },
              { key: 'driver_arrived', label: '司機已抵達上車點', icon: Flag },
              { key: 'in_trip', label: '行程進行中', icon: CarFront },
              { key: 'completed', label: '已抵達目的地', icon: CheckCircle },
            ].map((s, idx, all) => {
              const order = all.findIndex((x) => x.key === stage)
              const current = order === idx
              const done = order > idx || stage === 'completed' || (stage === 'in_trip' && s.key === 'driver_assigned') || (stage === 'in_trip' && s.key === 'driver_arrived')
              const Icon = s.icon
              return (
                <div key={s.key} className="flex items-start gap-3 relative">
                  {idx < all.length - 1 && (
                    <div className={`absolute left-4 top-9 bottom-0 w-0.5 ${
                      done ? 'bg-emerald-500/40' : 'bg-slate-700'
                    }`} />
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                    done ? 'bg-emerald-500/30' : current ? 'bg-cyan-500/30 ring-2 ring-cyan-400/40' : 'bg-slate-700'
                  }`}>
                    {done ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Icon className={`w-4 h-4 ${current ? 'text-cyan-300' : 'text-slate-500'}`} />
                    )}
                  </div>
                  <div className="flex-1 pt-1">
                    <p className={`text-sm font-medium ${
                      done ? 'text-emerald-300' : current ? 'text-cyan-200' : 'text-slate-400'
                    }`}>
                      {s.label}
                    </p>
                    {current && (
                      <p className="text-xs text-slate-500 mt-0.5">進行中</p>
                    )}
                    {done && (
                      <p className="text-xs text-emerald-400/70 mt-0.5">✓ 已完成</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 司機資訊 */}
        {data.driver && (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <UserLucide className="w-4 h-4 text-cyan-400" />
              您的司機
            </h2>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                {data.driver.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.driver.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <UserLucide className="w-7 h-7 text-slate-900" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-lg font-semibold text-slate-100">{data.driver.name || '司機'}</p>
                  {data.driver.rating != null && data.driver.rating > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 rounded text-yellow-400 text-xs">
                      <Star className="w-3 h-3 fill-current" />
                      {data.driver.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate">
                  {data.driver.vehicleModel && `${data.driver.vehicleModel} · `}
                  {data.driver.drivingYears != null && `${data.driver.drivingYears} 年駕齡 · `}
                  {data.driver.plate && `車牌 ${data.driver.plate}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 司機訊息 */}
        {driverMessages.length > 0 && (
          <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/50 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              司機訊息
            </h2>
            <div className="space-y-2">
              {driverMessages.map((m) => (
                <div key={m.id} className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-3">
                  <p className="text-sm text-slate-100">{String(m.payload?.message ?? '')}</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {new Date(m.createdAt).toLocaleString('zh-HK', {
                      hour: '2-digit', minute: '2-digit', hour12: false,
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 行程信息 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-slate-100 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-cyan-400" />
            行程信息
          </h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                <MapPin className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-400">出發地</p>
                <p className="text-slate-100 text-sm">
                  {data.pickupLocation}
                  {data.pickupArea && <span className="text-slate-400 ml-1">· {data.pickupArea}</span>}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                <MapPin className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-400">目的地</p>
                <p className="text-slate-100 text-sm">
                  {data.dropoffLocation}
                  {data.dropoffArea && <span className="text-slate-400 ml-1">· {data.dropoffArea}</span>}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-700/50 text-xs">
              <div>
                <p className="text-slate-500">出發時間</p>
                <p className="text-slate-100">{formatTime(data.departureTime)}</p>
              </div>
              <div>
                <p className="text-slate-500">人數 / 車型</p>
                <p className="text-slate-100">{data.passengers} 人 · {vehicleLabel(data.vehicleType)}</p>
              </div>
              {data.price && (
                <div>
                  <p className="text-slate-500">價格</p>
                  <p className="text-emerald-300 font-bold">
                    {data.price.currency === 'CNY' ? `¥${data.price.amount}` : `HK$${data.price.amount}`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-600">
          每 {POLL_INTERVAL / 1000} 秒自動更新 · {new Date(lastRefresh).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </main>
    </div>
  )
}

function formatTime(iso: string) {
  const dt = new Date(iso)
  if (isNaN(dt.getTime())) return iso
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  const hh = String(dt.getHours()).padStart(2, '0')
  const mi = String(dt.getMinutes()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:${mi}`
}

function vehicleLabel(type: string) {
  const map: Record<string, string> = {
    '4_seat': '4座',
    '7_seat': '7座',
    '8_seat': '8座',
  }
  return map[type] || type
}