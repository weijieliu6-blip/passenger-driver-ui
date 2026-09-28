'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Power, AlertCircle } from 'lucide-react'

type DriverStatus = 'on_trip' | 'available' | 'offline'

const STATUS_LABEL: Record<DriverStatus, string> = {
  on_trip: '行程中',
  available: '可接單',
  offline: '離線',
}

const STATUS_STYLE: Record<DriverStatus, string> = {
  on_trip: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  available: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
  offline: 'bg-slate-700/30 border-slate-600/40 text-slate-400',
}

const STATUS_DOT: Record<DriverStatus, string> = {
  on_trip: 'bg-amber-400',
  available: 'bg-emerald-400',
  offline: 'bg-slate-500',
}

export function StatusSwitcher() {
  const router = useRouter()
  const [status, setStatus] = useState<DriverStatus>('offline')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    fetch('/api/driver/status')
      .then(r => r.json())
      .then(d => {
        if (!mounted) return
        if (d?.status) setStatus(d.status)
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [])

  const updateStatus = async (next: DriverStatus) => {
    setError('')
    setOpen(false)
    if (next === status) return
    if (next === 'on_trip') {
      setError('on_trip 為系統自動設定')
      return
    }
    setUpdating(true)
    try {
      const res = await fetch('/api/driver/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || data.hint || '更新失敗')
        return
      }
      setStatus(data.status)
      router.refresh()
    } catch (err: any) {
      setError(err.message || '網絡錯誤')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => !updating && setOpen(o => !o)}
        disabled={loading || updating}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition ${STATUS_STYLE[status]} ${updating ? 'opacity-60' : ''}`}
      >
        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]} ${status === 'available' ? 'animate-pulse' : ''}`} />
        <Power className="w-3 h-3" />
        {STATUS_LABEL[status]}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden">
            <p className="px-3 py-2 text-xs text-slate-500 border-b border-slate-700/50">
              切換狀態
            </p>
            {(['available', 'offline'] as DriverStatus[]).map(s => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition ${
                  status === s
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'text-slate-200 hover:bg-slate-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} />
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <div className="absolute right-0 mt-2 px-3 py-2 bg-red-500/15 border border-red-500/40 text-red-300 text-xs rounded-lg whitespace-nowrap flex items-center gap-1 z-20">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  )
}
