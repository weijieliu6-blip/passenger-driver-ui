'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Calendar, Plus, Trash2, Clock, AlertCircle,
  Loader2, Repeat, CalendarDays, RefreshCw
} from 'lucide-react'
import { StatusSwitcher } from '@/app/components/status-switcher'

type ScheduleType = 'recurring' | 'oneoff'

interface Schedule {
  id: string
  driver_id: string
  schedule_type: ScheduleType
  weekday: number | null
  start_time: string | null
  end_time: string | null
  schedule_date: string | null
  created_at: string
}

const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

function formatTime12(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

export default function DriverSchedulePage() {
  const router = useRouter()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const [formType, setFormType] = useState<ScheduleType>('recurring')
  const [weekday, setWeekday] = useState(1)
  const [scheduleDate, setScheduleDate] = useState(todayYmd())
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    loadSchedules()
  }, [])

  const loadSchedules = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/driver/schedule')
      const data = await res.json()
      if (!data.success) {
        setError(data.error || '查詢失敗')
        setSchedules([])
        return
      }
      // 後端已 sort by created_at asc；前端依「類型+時間」再次排序
      const sorted = [...(data.schedules || [])].sort((a, b) => {
        if (a.schedule_type !== b.schedule_type) {
          return a.schedule_type === 'recurring' ? -1 : 1
        }
        if (a.schedule_type === 'recurring') {
          return (a.weekday ?? 0) - (b.weekday ?? 0)
        }
        return (a.schedule_date || '').localeCompare(b.schedule_date || '')
      })
      setSchedules(sorted)
    } catch (err: any) {
      setError(err.message || '網絡錯誤')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    setFormError('')
    if (!startTime || !endTime) {
      setFormError('請填寫開始與結束時間')
      return
    }
    if (startTime >= endTime) {
      setFormError('結束時間需晚於開始時間')
      return
    }

    const payload: Record<string, any> = {
      schedule_type: formType,
      start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
      end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
    }
    if (formType === 'recurring') payload.weekday = weekday
    if (formType === 'oneoff') payload.schedule_date = scheduleDate

    setCreating(true)
    try {
      const res = await fetch('/api/driver/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) {
        setFormError(data.error || '新增失敗')
        return
      }
      await loadSchedules()
    } catch (err: any) {
      setFormError(err.message || '網絡錯誤')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除此排程？')) return
    try {
      const res = await fetch(`/api/driver/schedule/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || '刪除失敗')
        return
      }
      await loadSchedules()
    } catch (err: any) {
      alert(err.message || '網絡錯誤')
    }
  }

  const recurringList = useMemo(() => schedules.filter(s => s.schedule_type === 'recurring'), [schedules])
  const oneoffList = useMemo(() => schedules.filter(s => s.schedule_type === 'oneoff'), [schedules])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/driver/dashboard" className="flex items-center gap-2 text-amber-400 hover:text-amber-300">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">返回</span>
          </Link>
          <h1 className="text-lg font-semibold text-slate-50 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            出車時間
          </h1>
          <div className="flex items-center gap-2">
            <StatusSwitcher />
            <button
              onClick={loadSchedules}
              className="text-slate-400 hover:text-amber-400 transition p-2"
              title="重新整理"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* 新增排程 */}
        <section className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-amber-400" />
            新增排程
          </h2>

          {/* 類型切換 */}
          <div className="flex bg-slate-900/60 rounded-lg p-1 mb-4">
            <button
              type="button"
              onClick={() => setFormType('recurring')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition flex items-center justify-center gap-1 ${
                formType === 'recurring'
                  ? 'bg-amber-500 text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Repeat className="w-4 h-4" />
              每週循環
            </button>
            <button
              type="button"
              onClick={() => setFormType('oneoff')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition flex items-center justify-center gap-1 ${
                formType === 'oneoff'
                  ? 'bg-amber-500 text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              指定日期
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {formType === 'recurring' ? (
              <label className="block">
                <span className="block text-xs text-slate-400 mb-1">星期</span>
                <select
                  value={weekday}
                  onChange={(e) => setWeekday(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {WEEKDAY_LABELS.map((w, i) => (
                    <option key={i} value={i}>{w}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block">
                <span className="block text-xs text-slate-400 mb-1">日期</span>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={todayYmd()}
                  className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </label>
            )}

            <label className="block">
              <span className="block text-xs text-slate-400 mb-1">開始時間</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-slate-400 mb-1">結束時間</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </label>
          </div>

          {formError && (
            <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300">
              {formError}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={creating}
            className="mt-4 w-full md:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-semibold rounded-xl hover:from-amber-400 hover:to-orange-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                新增中...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                新增排程
              </>
            )}
          </button>

          <div className="mt-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs text-slate-400 flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              沒有任何排程時，預設為全天可接單。新增排程後，只有落在排程時段內的訂單會推送給您。
            </span>
          </div>
        </section>

        {/* 列表 */}
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
        ) : (
          <>
            <section className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
              <h2 className="text-base font-semibold text-slate-100 mb-3 flex items-center gap-2">
                <Repeat className="w-4 h-4 text-amber-400" />
                每週循環 ({recurringList.length})
              </h2>
              {recurringList.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">尚未設定每週排程</p>
              ) : (
                <div className="space-y-2">
                  {recurringList.map(s => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 bg-slate-900/40 border border-slate-700/30 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300 font-semibold">
                          {WEEKDAY_LABELS[s.weekday ?? 0].replace('週', '')}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-100">
                            {WEEKDAY_LABELS[s.weekday ?? 0]}
                          </p>
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime12(s.start_time)} - {formatTime12(s.end_time)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="text-slate-500 hover:text-red-400 p-2 transition"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
              <h2 className="text-base font-semibold text-slate-100 mb-3 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-400" />
                指定日期 ({oneoffList.length})
              </h2>
              {oneoffList.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">尚未設定指定日期排程</p>
              ) : (
                <div className="space-y-2">
                  {oneoffList.map(s => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 bg-slate-900/40 border border-slate-700/30 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-300 text-xs font-semibold">
                          {s.schedule_date?.slice(5) || ''}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-100">
                            {s.schedule_date}
                          </p>
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime12(s.start_time)} - {formatTime12(s.end_time)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="text-slate-500 hover:text-red-400 p-2 transition"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
