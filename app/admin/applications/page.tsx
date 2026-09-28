import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

/**
 * 後台 — 司機招募申請審核列表（SSR）
 *
 * 顯示 driver_applications 表的待審 / 審核中 / 已批 / 已拒 申請
 * 可連結到詳情頁審核
 */

export const dynamic = 'force-dynamic'

const CAR_TYPE_LABEL: Record<string, string> = {
  sedan_5: '🚗 5 座豐田',
  alphard_7: '🚙 7 座埃爾法',
  business_9: '🚐 9 座商務',
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  reviewing: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  rejected: 'bg-red-500/20 text-red-300 border-red-500/40',
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待審',
  reviewing: '跟進中',
  approved: '已批准',
  rejected: '已拒絕',
}

type SearchParams = { status?: string }

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const filterStatus = params.status || 'all'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 統計
  const { data: all } = await supabase
    .from('driver_applications')
    .select('status')

  const stats = {
    all: all?.length ?? 0,
    pending: all?.filter((x: any) => x.status === 'pending').length ?? 0,
    reviewing: all?.filter((x: any) => x.status === 'reviewing').length ?? 0,
    approved: all?.filter((x: any) => x.status === 'approved').length ?? 0,
    rejected: all?.filter((x: any) => x.status === 'rejected').length ?? 0,
  }

  // 列表
  let query = supabase
    .from('driver_applications')
    .select('id, name, phone, email, plate, car_type, driving_years, city, has_cross_border_permit, message, status, reviewer_note, created_at, reviewed_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (filterStatus !== 'all') {
    query = query.eq('status', filterStatus)
  }

  const { data: list, error } = await query

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">司機招募申請</h2>
        <div className="text-xs text-slate-400">
          共 <span className="text-amber-300 font-bold">{stats.pending}</span> 筆待審
        </div>
      </div>

      {/* 狀態過濾 */}
      <div className="flex flex-wrap gap-2 mb-5">
        <FilterTab current={filterStatus} value="all" label="全部" count={stats.all} />
        <FilterTab current={filterStatus} value="pending" label="🟡 待審" count={stats.pending} />
        <FilterTab current={filterStatus} value="reviewing" label="🔵 跟進中" count={stats.reviewing} />
        <FilterTab current={filterStatus} value="approved" label="🟢 已批准" count={stats.approved} />
        <FilterTab current={filterStatus} value="rejected" label="🔴 已拒絕" count={stats.rejected} />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 mb-4">
          載入失敗：{error.message}
        </div>
      )}

      {!list || list.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-slate-400">
            {filterStatus === 'all' ? '目前沒有任何司機申請' : `目前沒有「${STATUS_LABEL[filterStatus] || filterStatus}」的申請`}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">提交時間</th>
                  <th className="px-3 py-2 text-left font-medium">姓名</th>
                  <th className="px-3 py-2 text-left font-medium">電話</th>
                  <th className="px-3 py-2 text-left font-medium">電郵</th>
                  <th className="px-3 py-2 text-left font-medium">車牌</th>
                  <th className="px-3 py-2 text-left font-medium">車型</th>
                  <th className="px-3 py-2 text-left font-medium">駕齡</th>
                  <th className="px-3 py-2 text-left font-medium">城市</th>
                  <th className="px-3 py-2 text-left font-medium">跨境證</th>
                  <th className="px-3 py-2 text-left font-medium">狀態</th>
                  <th className="px-3 py-2 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a: any) => (
                  <tr key={a.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString('zh-HK')}
                    </td>
                    <td className="px-3 py-2 text-slate-100 font-medium">{a.name}</td>
                    <td className="px-3 py-2 text-slate-300">
                      <a href={`tel:${a.phone}`} className="hover:text-cyan-400">
                        {a.phone}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-slate-400 text-xs">
                      {a.email || '-'}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-300">{a.plate}</td>
                    <td className="px-3 py-2 text-xs">{CAR_TYPE_LABEL[a.car_type] || a.car_type}</td>
                    <td className="px-3 py-2 text-slate-300">{a.driving_years}年</td>
                    <td className="px-3 py-2 text-slate-400 text-xs">{a.city || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      {a.has_cross_border_permit ? (
                        <span className="text-emerald-400">✓</span>
                      ) : (
                        <span className="text-slate-600">✗</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded border ${STATUS_BADGE[a.status] || ''}`}>
                        {STATUS_LABEL[a.status] || a.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/applications/${a.id}`}
                        className="text-xs text-cyan-400 hover:text-cyan-300 whitespace-nowrap"
                      >
                        審核 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterTab({ current, value, label, count }: { current: string; value: string; label: string; count: number }) {
  const active = current === value
  return (
    <Link
      href={value === 'all' ? '/admin/applications' : `/admin/applications?status=${value}`}
      className={`px-3 py-1.5 rounded-lg text-xs transition border ${
        active
          ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300'
          : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500'
      }`}
    >
      {label} <span className="ml-1 opacity-60">({count})</span>
    </Link>
  )
}
