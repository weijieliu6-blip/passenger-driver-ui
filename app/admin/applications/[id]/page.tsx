import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import ApplicationReviewClient from './review-client'

/**
 * 後台 — 單筆司機招募申請詳情 + 審核
 * Server Component 載入資料 → Client Component 處理狀態更新
 */

export const dynamic = 'force-dynamic'

const CAR_TYPE_LABEL: Record<string, string> = {
  sedan_5: '5 座豐田 Camry',
  alphard_7: '7 座埃爾法',
  business_9: '9 座商務車',
}

export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: app, error } = await supabase
    .from('driver_applications')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !app) {
    notFound()
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-5">申請詳情</h2>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
        <Row label="申請編號" value={<span className="font-mono text-xs">{app.id}</span>} />
        <Row label="提交時間" value={new Date(app.created_at).toLocaleString('zh-HK')} />

        <div className="border-t border-slate-800 my-4" />
        <h3 className="text-sm font-bold text-cyan-300 mb-3">👤 基本資料</h3>
        <Row label="姓名" value={<span className="text-slate-100 font-medium">{app.name}</span>} />
        <Row label="電話" value={<a href={`tel:${app.phone}`} className="text-cyan-400 hover:text-cyan-300">{app.phone}</a>} />
        <Row label="電郵" value={app.email || <span className="text-slate-500">（未填）</span>} />
        <Row label="常駐城市" value={app.city || <span className="text-slate-500">（未填）</span>} />

        <div className="border-t border-slate-800 my-4" />
        <h3 className="text-sm font-bold text-cyan-300 mb-3">🚗 車輛資料</h3>
        <Row label="車型" value={CAR_TYPE_LABEL[app.car_type] || app.car_type} />
        <Row label="車牌" value={<span className="font-mono">{app.plate}</span>} />
        <Row label="駕齡" value={`${app.driving_years} 年`} />
        <Row
          label="跨境證件"
          value={
            app.has_cross_border_permit ? (
              <span className="text-emerald-400">✓ 已持有</span>
            ) : (
              <span className="text-slate-500">未持有</span>
            )
          }
        />

        {app.message && (
          <>
            <div className="border-t border-slate-800 my-4" />
            <h3 className="text-sm font-bold text-cyan-300 mb-3">📝 備註</h3>
            <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-sm text-slate-300 whitespace-pre-wrap">
              {app.message}
            </div>
          </>
        )}

        {app.reviewer_note && (
          <>
            <div className="border-t border-slate-800 my-4" />
            <h3 className="text-sm font-bold text-cyan-300 mb-3">💬 審核備註</h3>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-sm text-slate-300 whitespace-pre-wrap">
              {app.reviewer_note}
            </div>
            {app.reviewed_at && (
              <div className="text-xs text-slate-500 mt-1">
                審核時間：{new Date(app.reviewed_at).toLocaleString('zh-HK')}
              </div>
            )}
          </>
        )}
      </div>

      <ApplicationReviewClient
        applicationId={app.id}
        currentStatus={app.status}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 items-baseline">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="col-span-2 text-sm">{value}</div>
    </div>
  )
}
