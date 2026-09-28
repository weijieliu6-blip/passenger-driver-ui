import { createClient } from '@supabase/supabase-js'

/**
 * 後台 — 訂單列表（SSR，每次請求都重抓）
 * v16 revalidate 已移除；管理後台資料量小，每次重抓即可
 */

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  pending: { label: '待接單', color: 'bg-amber-500/20 text-amber-300' },
  grabbed: { label: '已搶單', color: 'bg-sky-500/20 text-sky-300' },
  price_confirmed: { label: '已報價', color: 'bg-emerald-500/20 text-emerald-300' },
  completed: { label: '已完成', color: 'bg-slate-700/40 text-slate-300' },
  cancelled: { label: '已取消', color: 'bg-red-500/20 text-red-300' },
  expired: { label: '已過期', color: 'bg-slate-700/40 text-slate-400' },
}

export default async function AdminOrdersPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, status, pickup_location, pickup_area, dropoff_location, dropoff_area, departure_time, passengers, vehicle_type, passenger_name, passenger_phone, driver_name, driver_phone, driver_plate, grabbed_at, created_at, confirmed_price, price_currency'
    )
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300">
        載入失敗：{error.message}
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">訂單列表（最近 50 筆）</h2>
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
                <th className="px-3 py-2 text-left font-medium">搶單時間</th>
                <th className="px-3 py-2 text-left font-medium">建立時間</th>
              </tr>
            </thead>
            <tbody>
              {(orders ?? []).map((o: any) => {
                const badge = STATUS_BADGE[o.status] ?? { label: o.status, color: 'bg-slate-700/40 text-slate-300' }
                const route = `${o.pickup_location}${o.pickup_area ? ` ${o.pickup_area}` : ''} → ${o.dropoff_location}${o.dropoff_area ? ` ${o.dropoff_area}` : ''}`
                return (
                  <tr key={o.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                    <td className="px-3 py-2 font-mono text-cyan-300">{o.order_number}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${badge.color}`}>{badge.label}</span>
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
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {o.grabbed_at ? new Date(o.grabbed_at).toLocaleString('zh-HK') : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {new Date(o.created_at).toLocaleString('zh-HK')}
                    </td>
                  </tr>
                )
              })}
              {(orders ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    目前沒有訂單
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}