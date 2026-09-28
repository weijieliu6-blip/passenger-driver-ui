'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from 'recharts'
import {
  ArrowLeft, Calendar, Loader2, AlertCircle, TrendingUp,
  ShoppingBag, BarChart3, Wallet, RefreshCw,
} from 'lucide-react'
import { StatusSwitcher } from '@/app/components/status-switcher'

interface DailyRevenue { date: string; revenue: number; orderCount: number }
interface ByServiceType { service_type: string; revenue: number; count: number }
interface ByTier { tier: string; revenue: number; count: number }
interface ReportPayload {
  success: boolean
  range: { start_date: string; end_date: string }
  totalRevenue: number
  orderCount: number
  avgPerOrder: number
  dailyRevenue: DailyRevenue[]
  byServiceType: ByServiceType[]
  byTier: ByTier[]
  error?: string
}

const MAX_RANGE_DAYS = 31

function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function defaultRange(): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 29) // 30 天
  return { start: toYmd(start), end: toYmd(end) }
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime()
  const db = new Date(b + 'T00:00:00').getTime()
  return Math.floor((db - da) / 86400000) + 1
}

const SERVICE_NAME: Record<string, string> = {
  cross_border: '跨境專車',
  mainland_local: '內地專車',
  unknown: '未分類',
}

const TIER_NAME: Record<string, string> = {
  gold: '🥇 黃金會員',
  platinum: '💎 白金會員',
  normal: '🚗 普通會員',
  none: '❌ 非會員',
}

const PIE_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ef4444', '#14b8a6']

function formatCurrency(n: number): string {
  return `HK$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function shortDate(s: string): string {
  // s = YYYY-MM-DD
  return s.slice(5) // MM-DD
}

export default function DriverReportsPage() {
  const router = useRouter()
  const initial = useMemo(() => defaultRange(), [])
  const [startDate, setStartDate] = useState(initial.start)
  const [endDate, setEndDate] = useState(initial.end)
  const [data, setData] = useState<ReportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rangeError, setRangeError] = useState('')

  useEffect(() => {
    loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  const loadReport = async () => {
    setLoading(true)
    setError('')
    setRangeError('')
    try {
      const rangeDays = daysBetween(startDate, endDate)
      if (rangeDays > MAX_RANGE_DAYS) {
        setRangeError(`日期區間最多 ${MAX_RANGE_DAYS} 天，目前 ${rangeDays} 天`)
        setData(null)
        setLoading(false)
        return
      }
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
      const res = await fetch(`/api/driver/reports?${params.toString()}`)
      const payload: ReportPayload = await res.json()
      if (!payload.success) {
        setError(payload.error || '查詢失敗')
        setData(null)
        return
      }
      setData(payload)
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
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/driver/dashboard" className="flex items-center gap-2 text-amber-400 hover:text-amber-300">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">返回</span>
          </Link>
          <h1 className="text-lg font-semibold text-slate-50 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            營收報表
          </h1>
          <div className="flex items-center gap-2">
            <StatusSwitcher />
            <button
              onClick={loadReport}
              className="text-slate-400 hover:text-amber-400 transition p-2"
              title="重新整理"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* 日期區間 */}
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
        ) : data ? (
          <>
            {/* 總營收卡片 (BIG) */}
            <section className="bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-500/5 border border-amber-500/30 rounded-2xl p-6 shadow-xl shadow-amber-500/5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 text-amber-300">
                  <Wallet className="w-5 h-5" />
                  <span className="text-sm font-medium">總營收</span>
                </div>
                <div className="text-xs text-slate-400">
                  {data.range.start_date} ~ {data.range.end_date}
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-amber-300 via-orange-300 to-amber-200 bg-clip-text text-transparent">
                  HK${data.totalRevenue.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                僅統計已完成訂單（completed）
              </p>
            </section>

            {/* 訂單數 + 平均 */}
            <section className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
                <div className="flex items-center gap-2 text-sky-300 mb-2">
                  <ShoppingBag className="w-4 h-4" />
                  <span className="text-xs">訂單數</span>
                </div>
                <div className="text-3xl font-bold text-slate-100">
                  {data.orderCount.toLocaleString()}
                </div>
                <p className="text-xs text-slate-500 mt-1">已完成</p>
              </div>
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
                <div className="flex items-center gap-2 text-emerald-300 mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs">平均每單</span>
                </div>
                <div className="text-3xl font-bold text-slate-100">
                  HK${data.avgPerOrder.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-slate-500 mt-1">單均營收</p>
              </div>
            </section>

            {/* 每日營收折線圖 */}
            <section className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  每日營收
                </h2>
                <span className="text-xs text-slate-500">{data.dailyRevenue.length} 天</span>
              </div>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.dailyRevenue}>
                    <defs>
                      <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={{ stroke: '#334155' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={{ stroke: '#334155' }}
                      tickLine={false}
                      tickFormatter={(v) => `${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        color: '#f1f5f9',
                      }}
                      labelStyle={{ color: '#cbd5e1' }}
                      formatter={(v, name) => {
                        const key = String(name)
                        if (key === 'revenue') return [formatCurrency(Number(v)), '營收']
                        if (key === 'orderCount') return [v, '訂單數']
                        return [v, key]
                      }}
                      labelFormatter={(l) => `日期：${l}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#f59e0b' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* 服務類型圓餅圖 + 等級分佈柱狀圖 */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
                <h2 className="text-base font-semibold text-slate-100 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  服務類型佔比
                </h2>
                {data.byServiceType.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">無資料</p>
                ) : (
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.byServiceType.map(d => ({
                            ...d,
                            name: SERVICE_NAME[d.service_type] || d.service_type,
                          }))}
                          dataKey="revenue"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          innerRadius={40}
                          paddingAngle={2}
                          stroke="#1e293b"
                          strokeWidth={2}
                        >
                          {data.byServiceType.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: 8,
                            color: '#f1f5f9',
                          }}
                          formatter={(v) => formatCurrency(Number(v))}
                        />
                        <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
                <h2 className="text-base font-semibold text-slate-100 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  會員等級營收分佈
                </h2>
                {data.byTier.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">無資料</p>
                ) : (
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.byTier.map(d => ({
                        ...d,
                        name: TIER_NAME[d.tier] || d.tier,
                      }))}>
                        <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: '#94a3b8', fontSize: 11 }}
                          axisLine={{ stroke: '#334155' }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: '#94a3b8', fontSize: 11 }}
                          axisLine={{ stroke: '#334155' }}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: 8,
                            color: '#f1f5f9',
                          }}
                          formatter={(v) => formatCurrency(Number(v))}
                          cursor={{ fill: '#334155', opacity: 0.3 }}
                        />
                        <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </section>

            {/* 服務類型明細 */}
            {data.byServiceType.length > 0 && (
              <section className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
                <h2 className="text-base font-semibold text-slate-100 mb-3">服務類型明細</h2>
                <div className="space-y-2">
                  {data.byServiceType.map((s, idx) => (
                    <div key={s.service_type} className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                        />
                        <span className="text-sm text-slate-200">
                          {SERVICE_NAME[s.service_type] || s.service_type}
                        </span>
                        <span className="text-xs text-slate-500">{s.count} 單</span>
                      </div>
                      <span className="text-sm font-semibold text-amber-300">
                        {formatCurrency(s.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}
