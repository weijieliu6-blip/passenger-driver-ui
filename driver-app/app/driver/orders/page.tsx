'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  MapPin, Clock, Phone, AlertCircle, ChevronRight, ArrowLeft,
  Calendar, Filter, Inbox, Loader2, RefreshCw
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
  luggage?: number
  vehicle_type?: string
  service_type?: string | null
  passenger_name?: string | null
  passenger_phone?: string | null
  estimated_fare?: number | null
  confirmed_price?: number | null
  price_currency?: string | null
  created_at: string
  cancelled_at?: string | null
  completed_at?: string | null
}

type StatusFilter = 'all' | 'active' | 'completed' | 'cancelled'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending:        { label: '待接單',   cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  grabbed:        { label: '已接單',   cls: 'text-sky-300 bg-sky-500/10 border-sky-500/30' },
  price_confirmed:{ label: '已報價',   cls: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30' },
  completed:      { label: '已完成',   cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  cancelled:      { label: '已取消',   cls: 'text-red-300 bg-red-500/10 border-red-500/30' },
  expired:        { label: '已過期',   cls: 'text-slate-400 bg-slate-500/10 border-slate-500/30' },
}

const SERVICE_LABEL: Record<string, string> = {
  cross_border: '跨境專車',
  mainland_local: '內地專車',
}

const FILTER_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: 'all',       label: '全部' },
  { key: 'active',    label: '進行中' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
]

const MAX_RANGE_DAYS = 31

function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rangeForLast7(): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 6)
  return { start: toYmd(start), end: toYmd(end) }
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime()
  const db = new Date(b + 'T00:00:00').getTime()
  return Math.floor((db - da) / 86400000) + 1
}

function formatTime(s: string): string {
  return new Date(s).toLocaleString('zh-HK', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function formatPrice(o: Order): string {
  const cur = o.price_currency || 'HKD'
  const sym = cur === 'CNY' ? '¥' : 'HK$'
  const v = o.confirmed_price ?? o.estimated_fare ?? 0
  return `${sym}${Number(v).toLocaleString()}`
}

export default function DriverOrdersPage() {
  const router = useRouter()
  const initial = useMemo(() => rangeForLast7(), [])
  const [startDate, setStartDate] = useState(initial.start)
  const [endDate, setEndDate] = useState(initial.end)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [rangeError, setRangeError] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, filter])

  const loadOrders = async () => {
    setLoading(true)
    setError('')
    setRangeError('')
    try {
      const rangeDays = daysBetween(startDate, endDate)
      if (rangeDays > MAX_RANGE_DAYS) {
        setRangeError(`日期區間最多 ${MAX_RANGE_DAYS} 天，目前 ${rangeDays} 天`)
        setOrders([])
        setLoading(false)
        return
      }
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      })
      // 把前端 chip 對應到後端 status：all 不傳，其餘直接傳單值
      if (filter === 'active') params.set('status', 'grabbed') // 後端只支援單值，UI 用本地過濾覆蓋其他「進行中」狀態
      else if (filter !== 'all') params.set('status', filter)

      const res = await fetch(`/api/driver/orders?${params.toString()}`)
      const data = await res.json()
      if (!data.success) {
        setError(data.error || '查詢失敗')
        setOrders([])
        return
      }
      let list: Order[] = data.orders || []
      // 「進行中」= grabbed / price_confirmed
      if (filter === 'active') {
        list = list.filter(o => o.status === 'grabbed' || o.status === 'price_confirmed')
      }
      setOrders(list)
    } catch (err: any) {
      setError(err.message || '網絡錯誤')
    } finally {
      setLoading(false)
    }
  }

  const rangeDays = daysBetween(startDate, endDate)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/driver/dashboard" className="flex items-center gap-2 text-amber-400 hover:text-amber-300">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">返回</span>
          </Link>
          <h1 className="text-lg font-semibold text-slate-50 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-amber-400" />
            我的訂單
          </h1>
          <div className="flex items-center gap-2">
            <StatusSwitcher />
            <button
              onClick={loadOrders}
              className="text-slate-400 hover:text-amber-400 transition p-2"
              title="重新整理"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* 日期區間選擇 */}
        <section className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-slate-200">日期區間</span>
            <span className="ml-auto text-xs text-slate-500">最多 {MAX_RANGE_DAYS} 天 · 當前 {rangeDays} 天</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs text-slate-400 mb-1">開始日期</span>
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-slate-400 mb-1">結束日期</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={toYmd(new Date())}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </label>
          </div>
          {rangeError && (
            <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300">
              {rangeError}
            </div>
          )}
        </section>

        {/* 狀態過濾 chips */}
        <section className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="w-4 h-4 text-slate-500 flex-shrink-0" />
          {FILTER_CHIPS.map(chip => (
            <button
              key={chip.key}
              onClick={() => setFilter(chip.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition border ${
                filter === chip.key
                  ? 'bg-amber-500 border-amber-400 text-slate-900'
                  : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-slate-100'
              }`}
            >
              {chip.label}
            </button>
          ))}
          <div className="ml-auto text-xs text-slate-400">
            共 <span className="text-amber-300 font-semibold">{orders.length}</span> 單
          </div>
        </section>

        {/* 列表 */}
        <section>
          {loading ? (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-12 text-center">
              <Loader2 className="w-8 h-8 text-amber-400 mx-auto mb-3 animate-spin" />
              <p className="text-sm text-slate-400">載入中...</p>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-red-300">{error}</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-12 text-center">
              <Inbox className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 font-medium">沒有符合條件的訂單</p>
              <p className="text-xs text-slate-500 mt-2">請嘗試調整日期區間或篩選條件</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(o => {
                const badge = STATUS_LABEL[o.status] || { label: o.status, cls: 'text-slate-400 bg-slate-500/10 border-slate-500/30' }
                return (
                  <Link
                    key={o.id}
                    href={`/driver/orders/${o.order_number}`}
                    className="block bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-4 hover:border-amber-500/40 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-slate-100">#{o.order_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
                        {o.service_type && (
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-700/40 text-slate-300 border border-slate-600/50">
                            {SERVICE_LABEL[o.service_type] || o.service_type}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-400 transition" />
                    </div>

                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 text-emerald-400 flex-shrink-0" />
                        <span className="text-slate-200">
                          {o.pickup_location}{o.pickup_area ? ` ${o.pickup_area}` : ''}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 text-amber-400 flex-shrink-0" />
                        <span className="text-slate-200">
                          {o.dropoff_location}{o.dropoff_area ? ` ${o.dropoff_area}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(o.created_at)}
                      </span>
                      {o.passenger_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {o.passenger_phone}
                        </span>
                      )}
                      {(o.confirmed_price || o.estimated_fare) && (
                        <span className="ml-auto text-emerald-300 font-semibold text-sm">
                          {formatPrice(o)}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
