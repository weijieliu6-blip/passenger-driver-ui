import { createClient } from '@supabase/supabase-js'

/**
 * 後台 — 訂單管理（SSR，每次請求重抓）
 * v1：訂單列表 + 統計 + 收入估算 + 趨勢圖（純 SVG）
 */

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  pending: { label: '待接單', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  grabbed: { label: '已搶單', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  price_confirmed: { label: '已報價', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  completed: { label: '已完成', color: 'bg-slate-700/40 text-slate-300 border-slate-600/40' },
  cancelled: { label: '已取消', color: 'bg-red-500/20 text-red-300 border-red-500/40' },
  expired: { label: '已過期', color: 'bg-slate-700/40 text-slate-400 border-slate-600/40' },
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const statusFilter = params.status || 'all'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 取全部訂單做統計（限制 1000 筆以避免效能問題）
  const { data: allOrders } = await supabase
    .from('orders')
    .select('id, status, confirmed_price, price_currency, created_at')
    .order('created_at', { ascending: false })
    .limit(1000)

  const list = allOrders ?? []

  // 統計
  const stats = {
    total: list.length,
    pending: list.filter((o: any) => o.status === 'pending').length,
    grabbed: list.filter((o: any) => o.status === 'grabbed' || o.status === 'price_confirmed').length,
    completed: list.filter((o: any) => o.status === 'completed').length,
    cancelled: list.filter((o: any) => o.status === 'cancelled' || o.status === 'expired').length,
    revenueHKD: list
      .filter((o: any) => o.status === 'completed' && (o.price_currency === 'HKD' || !o.price_currency))
      .reduce((s: number, o: any) => s + (Number(o.confirmed_price) || 0), 0),
    revenueCNY: list
      .filter((o: any) => o.status === 'completed' && o.price_currency === 'CNY')
      .reduce((s: number, o: any) => s + (Number(o.confirmed_price) || 0), 0),
  }

  const completionRate = stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : '0.0'
  const grabRate = stats.total > 0
    ? (((stats.completed + stats.grabbed) / stats.total) * 100).toFixed(1)
    : '0.0'

  // 最近 7 天訂單趨勢（按日 group）
  const now = new Date()
  const trendData: { date: string; count: number; revenue: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    const dayEnd = new Date(dayStart)
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

    const dayOrders = list.filter((o: any) => {
      const t = new Date(o.created_at).getTime()
      return t >= dayStart.getTime() && t < dayEnd.getTime()
    })
    const revenue = dayOrders
      .filter((o: any) => o.status === 'completed')
      .reduce((s: number, o: any) => s + (Number(o.confirmed_price) || 0), 0)

    trendData.push({
      date: `${dayStart.getUTCMonth() + 1}/${dayStart.getUTCDate()}`,
      count: dayOrders.length,
      revenue,
    })
  }
  const maxCount = Math.max(...trendData.map(d => d.count), 1)

  // 過濾後的訂單列表
  const filteredOrders = statusFilter === 'all'
    ? list
    : list.filter((o: any) => o.status === statusFilter)

  const displayOrders = filteredOrders.slice(0, 50)

  return (
    <div>
      <h2 className="text-xl font-bold mb-5">訂單管理</h2>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="總訂單" value={stats.total} color="text-cyan-300" sub="所有狀態" />
        <Stat label="待接單" value={stats.pending} color="text-amber-300" sub="需立即推播" />
        <Stat label="進行中" value={stats.grabbed} color="text-sky-300" sub="已搶單 / 已報價" />
        <Stat label="已完成" value={stats.completed} color="text-emerald-300" sub={`完成率 ${completionRate}%`} />
      </div>

      {/* 收入 + 轉化率 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl p-4">
          <div className="text-xs text-emerald-400 mb-1">💰 已完成訂單收入（HKD）</div>
          <div className="text-2xl font-bold text-emerald-300">
            HK$ {stats.revenueHKD.toLocaleString()}
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-xl p-4">
          <div className="text-xs text-orange-400 mb-1">💰 已完成訂單收入（CNY）</div>
          <div className="text-2xl font-bold text-orange-300">
            ¥ {stats.revenueCNY.toLocaleString()}
          </div>
        </div>
        <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-4">
          <div className="text-xs text-cyan-400 mb-1">📈 搶單率（已完成 + 進行中 / 總數）</div>
          <div className="text-2xl font-bold text-cyan-300">{grabRate}%</div>
        </div>
      </div>

      {/* 7 天趨勢圖 */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-300">📊 最近 7 天訂單趨勢</h3>
          <span className="text-xs text-slate-500">含未來 24h 已預訂</span>
        </div>
        <div className="flex items-end gap-1.5 h-32">
          {trendData.map((d, i) => {
            const heightPct = maxCount > 0 ? (d.count / maxCount) * 100 : 0
            const isToday = i === trendData.length - 1
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1">
                <div className="text-[10px] text-slate-400 font-mono">{d.count}</div>
                <div
                  className={`w-full rounded-t transition-all ${
                    isToday
                      ? 'bg-gradient-to-t from-cyan-500 to-cyan-300 shadow-lg shadow-cyan-500/20'
                      : 'bg-gradient-to-t from-slate-700 to-slate-600'
                  }`}
                  style={{ height: `${Math.max(heightPct, 5)}%` }}
                  title={`${d.date}: ${d.count} 筆 (收入 HK$${d.revenue})`}
                />
                <div className={`text-[10px] ${isToday ? 'text-cyan-400 font-bold' : 'text-slate-500'}`}>
                  {d.date}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 狀態過濾 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <FilterTab current={statusFilter} value="all" label="全部" count={stats.total} />
        <FilterTab current={statusFilter} value="pending" label="🟡 待接單" count={stats.pending} />
        <FilterTab current={statusFilter} value="grabbed" label="🔵 已搶單" count={stats.grabbed} />
        <FilterTab current={statusFilter} value="completed" label="🟢 已完成" count={stats.completed} />
        <FilterTab current={statusFilter} value="cancelled" label="🔴 已取消" count={stats.cancelled} />
      </div>

      {/* 訂單列表 */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left font-medium">訂單號</th>
                <th className="px-3 py-2 text-left font-medium">狀態</th>
                <th className="px-3 py-2 text-left font-medium">路線</th>
                <th className="px-3 py-2 text-left font-medium">乘客</th>
                <th className="px-3 py-2 text-left font-medium">搶單司機</th>
                <th className="px-3 py-2 text-right font-medium">報價</th>
                <th className="px-3 py-2 text-left font-medium">建立時間</th>
              </tr>
            </thead>
            <tbody>
              {displayOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-slate-500">
                    目前沒有符合條件的訂單
                  </td>
                </tr>
              ) : (
                displayOrders.map((o: any) => {
                  const badge = STATUS_BADGE[o.status] ?? { label: o.status, color: 'bg-slate-700/40 text-slate-300 border-slate-600/40' }
                  const route = `${o.pickup_location} → ${o.dropoff_location}`
                  const priceText = o.confirmed_price
                    ? `${o.price_currency === 'CNY' ? '¥' : 'HK$'}${o.confirmed_price}`
                    : '—'
                  return (
                    <tr key={o.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                      <td className="px-3 py-2 font-mono text-cyan-300">{o.order_number}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-300 max-w-xs truncate">{route}</td>
                      <td className="px-3 py-2 text-slate-300">
                        <div>{o.passenger_name ?? '—'}</div>
                        <div className="text-xs text-slate-500">{o.passenger_phone}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {o.driver_name ? (
                          <>
                            <div>{o.driver_name}</div>
                            <div className="text-xs text-slate-500">{o.driver_plate ?? '—'}</div>
                          </>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-300">{priceText}</td>
                      <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(o.created_at).toLocaleString('zh-HK')}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        顯示前 50 筆（總 {filteredOrders.length} 筆符合條件）
      </div>
    </div>
  )
}

function Stat({ label, value, color, sub }: { label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}

function FilterTab({ current, value, label, count }: { current: string; value: string; label: string; count: number }) {
  const active = current === value
  return (
    <a
      href={value === 'all' ? '/admin/orders' : `/admin/orders?status=${value}`}
      className={`px-3 py-1.5 rounded-lg text-xs transition border ${
        active
          ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300'
          : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500'
      }`}
    >
      {label} <span className="ml-1 opacity-60">({count})</span>
    </a>
  )
}
