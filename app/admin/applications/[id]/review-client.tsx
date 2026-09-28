'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 申請審核互動區：變更狀態 + 寫審核備註
 */
export default function ApplicationReviewClient({
  applicationId,
  currentStatus,
}: {
  applicationId: string
  currentStatus: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [reviewerNote, setReviewerNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function updateStatus(newStatus: string) {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, reviewer_note: reviewerNote.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || '更新失敗')
        return
      }
      setStatus(newStatus)
      setSuccess(`已更新為「${LABELS[newStatus]}」`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '網絡錯誤')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mt-4">
      <h3 className="text-sm font-bold text-cyan-300 mb-3">⚙️ 審核操作</h3>

      {error && (
        <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm text-emerald-300">
          ✅ {success}
        </div>
      )}

      <label className="block text-xs text-slate-400 mb-1">審核備註</label>
      <textarea
        value={reviewerNote}
        onChange={e => setReviewerNote(e.target.value)}
        placeholder="例如：已致電核對，待補交中港車牌副本"
        rows={3}
        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none mb-4"
      />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => updateStatus('reviewing')}
          disabled={saving || status === 'reviewing'}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 font-bold text-sm rounded-lg transition"
        >
          🔵 標為跟進中
        </button>
        <button
          onClick={() => updateStatus('approved')}
          disabled={saving || status === 'approved'}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 font-bold text-sm rounded-lg transition"
        >
          ✅ 批准
        </button>
        <button
          onClick={() => updateStatus('rejected')}
          disabled={saving || status === 'rejected'}
          className="px-4 py-2 bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 font-bold text-sm rounded-lg transition"
        >
          ❌ 拒絕
        </button>
        <button
          onClick={() => updateStatus('pending')}
          disabled={saving || status === 'pending'}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 font-bold text-sm rounded-lg transition"
        >
          ↩️ 重設為待審
        </button>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        目前狀態：<span className="text-amber-300 font-bold">{LABELS[status] || status}</span>
      </div>
    </div>
  )
}

const LABELS: Record<string, string> = {
  pending: '待審',
  reviewing: '跟進中',
  approved: '已批准',
  rejected: '已拒絕',
}
