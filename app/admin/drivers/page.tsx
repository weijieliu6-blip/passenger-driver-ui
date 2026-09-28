import { createClient } from '@supabase/supabase-js'

/**
 * 後台 — 司機列表（SSR）
 */

export const dynamic = 'force-dynamic'

const CAR_TYPE_LABEL: Record<string, string> = {
  sedan_5: '5座豐田',
  alphard_7: '7座埃爾法',
  business_9: '9座商務',
}

export default async function AdminDriversPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: drivers, error } = await supabase
    .from('drivers')
    .select('id, dingtalk_staff_id, name, phone, plate, car_type, driving_years, seats, registered_at, total_grabs, completed_orders, cancelled_orders, active')
    .order('registered_at', { ascending: false })
    .limit(200)

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300">
        載入失敗：{error.message}
      </div>
    )
  }

  const list = drivers ?? []

  const total = list.length
  const active = list.filter((d: any) => d.active).length
  const totalGrabs = list.reduce((s: number, d: any) => s + (d.total_grabs ?? 0), 0)
  const totalCompleted = list.reduce((s: number, d: any) => s + (d.completed_orders ?? 0), 0)
  const completionRate = totalGrabs > 0 ? ((totalCompleted / totalGrabs) * 100).toFixed(1) : '0.0'

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">司機列表</h2>

      {/* 統計卡片 */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <Stat label="總司機" value={total} color="text-cyan-300" />
        <Stat label="活躍" value={active} color="text-emerald-300" />
        <Stat label="總搶單" value={totalGrabs} color="text-amber-300" />
        <Stat label="完成率" value={`${completionRate}%`} color="text-emerald-300" />
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left font-medium">註冊時間</th>
                <th className="px-3 py-2 text-left font-medium">稱呼</th>
                <th className="px-3 py-2 text-left font-medium">電話</th>
                <th className="px-3 py-2 text-left font-medium">車牌</th>
                <th className="px-3 py-2 text-left font-medium">車型</th>
                <th className="px-3 py-2 text-left font-medium">駕齡</th>
                <th className="px-3 py-2 text-left font-medium">座位</th>
                <th className="px-3 py-2 text-left font-medium">搶單</th>
                <th className="px-3 py-2 text-left font-medium">完成</th>
                <th className="px-3 py-2 text-left font-medium">取消</th>
                <th className="px-3 py-2 text-left font-medium">狀態</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d: any) => (
                <tr key={d.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {new Date(d.registered_at).toLocaleString('zh-HK')}
                  </td>
                  <td className="px-3 py-2 text-slate-100 font-medium">{d.name}</td>
                  <td className="px-3 py-2 text-slate-300 font-mono text-xs">{d.phone}</td>
                  <td className="px-3 py-2 text-slate-300 font-mono">{d.plate}</td>
                  <td className="px-3 py-2 text-slate-300">{CAR_TYPE_LABEL[d.car_type] ?? d.car_type}</td>
                  <td className="px-3 py-2 text-slate-300">{d.driving_years} 年</td>
                  <td className="px-3 py-2 text-slate-300">{d.seats}</td>
                  <td className="px-3 py-2 text-amber-300">{d.total_grabs}</td>
                  <td className="px-3 py-2 text-emerald-300">{d.completed_orders}</td>
                  <td className="px-3 py-2 text-red-300">{d.cancelled_orders}</td>
                  <td className="px-3 py-2">
                    {d.active ? (
                      <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-300">活躍</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-700/40 text-slate-400">停用</span>
                    )}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                    目前沒有司機
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

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-2xl font-bold ${color} mt-1`}>{value}</div>
    </div>
  )
}